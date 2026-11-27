import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, 'papikos');
const PORT = Number(process.env.PORT || 5173);

function detectClientBuild() {
  try {
    const dir = path.join(ROOT, 'assets');
    const file = fs.readdirSync(dir).find((n) => /^version-.*\.js$/.test(n));
    if (!file) return { build: 'local', time: Date.now() };
    const src = fs.readFileSync(path.join(dir, file), 'utf8');
    const m = src.match(/build:"([^"]+)",time:(\d+)/);
    if (m) return { build: m[1], time: Number(m[2]) };
  } catch {}
  return { build: 'local', time: Date.now() };
}
const CLIENT_BUILD = detectClientBuild();

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.mjs': 'application/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.webmanifest': 'application/manifest+json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.svg': 'image/svg+xml',
  '.gif': 'image/gif',
  '.ico': 'image/x-icon',
  '.mp3': 'audio/mpeg',
  '.ogg': 'audio/ogg',
  '.wav': 'audio/wav',
  '.mp4': 'video/mp4',
  '.webm': 'video/webm',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.ttf': 'font/ttf',
  '.otf': 'font/otf',
  '.wasm': 'application/wasm',
  '.txt': 'text/plain; charset=utf-8',
};

function send(res, status, body, headers = {}) {
  const buf = Buffer.isBuffer(body) ? body : Buffer.from(typeof body === 'string' ? body : JSON.stringify(body));
  res.writeHead(status, { 'Content-Length': buf.length, 'Cache-Control': 'no-store', ...headers });
  res.end(buf);
}

function sendJson(res, status, obj) {
  send(res, status, JSON.stringify(obj), { 'Content-Type': 'application/json; charset=utf-8' });
}

function notFound(res) { sendJson(res, 404, { error: 'Not found' }); }

function readBody(req) {
  return new Promise((resolve) => {
    let data = '';
    req.on('data', (c) => { data += c; if (data.length > 5_000_000) req.destroy(); });
    req.on('end', () => { try { resolve(data ? JSON.parse(data) : {}); } catch { resolve({}); } });
    req.on('error', () => resolve({}));
  });
}

function safeJoin(base, reqPath) {
  const decoded = decodeURIComponent(reqPath.split('?')[0]);
  const clean = decoded.replace(/\\/g, '/');
  const rel = clean.replace(/^\/+/, '');
  const full = path.normalize(path.join(base, rel));
  if (!full.startsWith(path.normalize(base))) return null;
  return full;
}

const fileCache = new Map();

function serveFile(req, res, filePath) {
  const started = Date.now();
  fs.stat(filePath, (err, st) => {
    if (err || !st.isFile()) return notFound(res);
    const ext = path.extname(filePath).toLowerCase();
    const type = MIME[ext] || 'application/octet-stream';
    const compressible = /^(text\/|application\/(javascript|json|manifest\+json|wasm|xml)|image\/svg\+xml|font\/(ttf|otf))/.test(type);
    const accept = String(req.headers['accept-encoding'] || '');
    const base = path.basename(filePath);
    const noStore = ext === '.html' || base === 'sw.js' || base === 'version.json';
    // Hashed build assets are often patched in-place in this repo, so do not make them immutable.
    // no-cache + ETag keeps them fresh while allowing cheap 304 revalidation.
    const cacheControl = noStore ? 'no-cache' : 'no-cache';
    const etag = `W/"${st.size.toString(16)}-${Math.floor(st.mtimeMs).toString(16)}"`;
    const inm = String(req.headers['if-none-match'] || '');
    if (inm && inm === etag) {
      res.writeHead(304, { 'ETag': etag, 'Cache-Control': cacheControl, 'Vary': 'Accept-Encoding' });
      console.log(`[static] 304 ${Date.now() - started}ms ${path.relative(ROOT, filePath)}`);
      return res.end();
    }
    const canGzip = compressible && st.size > 1024 && accept.includes('gzip');
    const key = filePath;
    let cached = fileCache.get(key);
    if (!cached || cached.mtimeMs !== st.mtimeMs || cached.size !== st.size) {
      const raw = fs.readFileSync(filePath);
      const gz = compressible && st.size > 1024 ? zlib.gzipSync(raw, { level: 6 }) : null;
      cached = { mtimeMs: st.mtimeMs, size: st.size, raw, gz };
      fileCache.set(key, cached);
    }
    if (canGzip && cached.gz) {
      res.writeHead(200, { 'Content-Type': type, 'Content-Encoding': 'gzip', 'Vary': 'Accept-Encoding', 'Content-Length': cached.gz.length, 'Cache-Control': cacheControl, 'ETag': etag });
      console.log(`[static] 200 gzip ${cached.gz.length}B ${Date.now() - started}ms ${path.relative(ROOT, filePath)}`);
      return res.end(cached.gz);
    }
    const headers = { 'Content-Type': type, 'Content-Length': cached.raw.length, 'Cache-Control': cacheControl, 'ETag': etag };
    if (compressible) headers['Vary'] = 'Accept-Encoding';
    res.writeHead(200, headers);
    console.log(`[static] 200 raw ${cached.raw.length}B ${Date.now() - started}ms ${path.relative(ROOT, filePath)}`);
    res.end(cached.raw);
  });
}

const memory = { save: null, saveMeta: null, receipts: [], wallet: { paid: 1_000_000_000_000, free: 1_000_000_000_000 }, juragan: true };

async function handleApi(req, res, url) {
  const p = url.pathname;
  const m = req.method.toUpperCase();

  if (p === '/api/version' && m === 'GET') {
    return sendJson(res, 200, { build: CLIENT_BUILD.build, time: CLIENT_BUILD.time, autoFrom: Date.now() + 864000000, popupFrom: Date.now() + 864000000 });
  }
  if (p === '/api/time' && m === 'GET') {
    return sendJson(res, 200, { now: Date.now() });
  }
  if (p === '/api/client-error' && m === 'POST') return sendJson(res, 200, { ok: true });
  if (p === '/api/move/done' && m === 'POST') return sendJson(res, 200, { ok: true });
  if (p === '/api/config' && m === 'GET') return sendJson(res, 200, { googleClientId: null, devLogin: false, googleDevice: false, turnstileSiteKey: null });
  if (p === '/api/guest' && m === 'POST') return sendJson(res, 200, { key: 'local-guest-key' });
  if (p === '/api/auth/session' && m === 'GET') return sendJson(res, 401, { error: 'Not logged in' });
  if (p === '/api/auth/logout' && m === 'POST') return sendJson(res, 200, { ok: true });

  if (p === '/api/save' && m === 'GET') {
    if (!memory.save) return sendJson(res, 404, { error: 'No save' });
    try {
      const parsed = JSON.parse(memory.save);
      if (!parsed?.state?.namesChosen) return sendJson(res, 404, { error: 'No save' });
    } catch {}
    return sendJson(res, 200, { save: memory.save, savedAt: memory.saveMeta?.savedAt ?? Date.now(), cheat: false });
  }
  if (p === '/api/save' && m === 'PUT') {
    const body = await readBody(req);
    if (body && typeof body.save === 'string') {
      memory.save = body.save;
      memory.saveMeta = { savedAt: Date.now(), ...body };
    }
    return sendJson(res, 200, { ok: true, cheat: false });
  }

  if (p === '/api/papikos/start' && m === 'POST') {
    const body = await readBody(req);
    const hasNames = body && typeof body.kosName === 'string' && typeof body.ownerName === 'string';
    if (memory.save) {
      try {
        const parsed = JSON.parse(memory.save);
        const named = !!parsed?.state?.namesChosen;
        if (named) return sendJson(res, 200, { save: memory.save, existing: true });
        if (hasNames) return sendJson(res, 200, { save: null, existing: false });
      } catch {}
      return sendJson(res, 200, { save: memory.save, existing: true });
    }
    return sendJson(res, 200, { save: body?.save ?? null, existing: false });
  }
  if (p === '/api/papikos/me' && m === 'GET') {
    return sendJson(res, 200, { id: 'local-player', wallet: { ...memory.wallet }, juragan: memory.juragan, noJudol: true, promoUntil: null, promoLabel: null });
  }
  if (p === '/api/local/grant' && m === 'POST') {
    const body = await readBody(req);
    if (typeof body.cash === 'number') memory.grantCash = (memory.grantCash || 0) + body.cash;
    if (typeof body.paid === 'number') memory.wallet.paid += body.paid;
    if (typeof body.free === 'number') memory.wallet.free += body.free;
    return sendJson(res, 200, { ok: true, wallet: { ...memory.wallet }, grantCash: memory.grantCash || 0 });
  }
  if (p === '/api/papikos/receipts' && m === 'GET') return sendJson(res, 200, { receipts: memory.receipts });
  if (p === '/api/papikos/shop/buy' && m === 'POST') {
    const body = await readBody(req);
    const item = body?.item;
    const args = body?.args ?? body;
    const spend = (diamonds) => {
      const d = Number(diamonds || 0);
      if (!(d > 0)) return true;
      const total = memory.wallet.paid + memory.wallet.free;
      if (total < d) return false;
      const usePaid = Math.min(memory.wallet.paid, d);
      memory.wallet.paid -= usePaid;
      memory.wallet.free -= (d - usePaid);
      return true;
    };
    const receipt = (obj) => ({ id: 'local-' + item + '-' + Date.now() + '-' + Math.random().toString(36).slice(2,8), time: Date.now(), ...obj });
    if (item === 'tukang') {
      if (!spend(args?.diamonds)) return sendJson(res, 400, { error: 'Diamond tidak cukup.' });
      const r = receipt({ item: 'tukang' });
      memory.receipts.push(r);
      return sendJson(res, 200, { ok: true, wallet: { ...memory.wallet }, receipt: r });
    }
    if (item === 'speedup') {
      if (!spend(args?.diamonds)) return sendJson(res, 400, { error: 'Diamond tidak cukup.' });
      const r = receipt({ item: 'speedup', target: args?.target });
      memory.receipts.push(r);
      return sendJson(res, 200, { ok: true, wallet: { ...memory.wallet }, receipt: r });
    }
    if (item === 'speedupAll') {
      const targets = Array.isArray(args?.targets) ? args.targets : [];
      if (!targets.length) return sendJson(res, 400, { error: 'Tidak ada pembangunan aktif.' });
      if (!spend(args?.diamonds)) return sendJson(res, 400, { error: 'Diamond tidak cukup.' });
      const r = receipt({ item: 'speedupAll', targets });
      memory.receipts.push(r);
      return sendJson(res, 200, { ok: true, wallet: { ...memory.wallet }, receipt: r });
    }
    if (item === 'topUpFor') {
      if (!spend(args?.diamonds)) return sendJson(res, 400, { error: 'Diamond tidak cukup.' });
      const r = receipt({ item: 'topUpFor', action: args?.action, cash: Number(args?.cash || 0), diamonds: Number(args?.diamonds || 0) });
      memory.receipts.push(r);
      return sendJson(res, 200, { ok: true, wallet: { ...memory.wallet }, receipt: r });
    }
    if (item === 'cosmetic') {
      const COSMETIC_PRICES = {"wall-pink":150,"wall-sage":150,"wall-biru":150,"wall-mentega":150,"wall-polkadot":300,"wall-love":300,"wall-garis":250,"wall-kotak":250,"wall-bata":250,"wall-pelangi":400,"stairs-kayu":150,"stairs-merah":150,"stairs-putih":200,"stairs-emas":300,"stairs-pelangi":300,"roof-hijau":150,"roof-biru":150,"roof-ungu":150,"roof-hitam":150,"roof-taman":300,"roofshape-pelana":250,"roofshape-limas":300,"roofshape-kerucut":350,"roofshape-kubah":400,"roofshape-joglo":400,"sign-kayu":150,"sign-akrilik":200,"sign-neon":250,"sign-led":250,"pet-oren":300,"pet-hitam":300,"pet-belang":300,"pet-anjing":300,"pet-ayam":200,"pet-kelinci":250,"decor-pot":80,"decor-lampu":100,"decor-bangku":120,"decor-flamingo":150,"decor-ayunan":200,"decor-kolam":250,"decor-airmancur":300,"frame-emas":200,"frame-api":200,"frame-berlian":250,"frame-batik":200,"title-sultan":150,"title-santuy":150,"title-galak":150};
      const id = String(args?.id || '');
      const building = String(args?.building || 'main');
      const price = COSMETIC_PRICES[id];
      if (!price) return sendJson(res, 400, { error: 'Item kosmetik tidak dikenal.' });
      if (!spend(price)) return sendJson(res, 400, { error: 'Diamond tidak cukup.' });
      const r = receipt({ item: 'cosmetic', cosmetic: id, building });
      memory.receipts.push(r);
      return sendJson(res, 200, { ok: true, wallet: { ...memory.wallet }, receipt: r });
    }
    if (item === 'apartment') {
      const building = String(args?.building || 'main');
      const cost = building === 'main' ? 800 : 800;
      if (!spend(cost)) return sendJson(res, 400, { error: 'Diamond tidak cukup.' });
      const r = receipt({ item: 'apartment', target: { kind: 'apartment', building } });
      memory.receipts.push(r);
      return sendJson(res, 200, { ok: true, wallet: { ...memory.wallet }, receipt: r });
    }
    if (item === 'bigBuy') {
      const action = args?.action;
      const cash = Number(args?.cash || 0);
      const diamonds = Math.max(0, Math.floor(Number(args?.diamonds || 0)));
      if (!action) return sendJson(res, 400, { error: 'Aksi tidak valid.' });
      if (diamonds > 0 && !spend(diamonds)) return sendJson(res, 400, { error: 'Diamond tidak cukup.' });
      const r = receipt({ item: 'topUpFor', action, cash, diamonds });
      memory.receipts.push(r);
      return sendJson(res, 200, { ok: true, wallet: { ...memory.wallet }, receipt: r });
    }
    if (item === 'exchange') {
      const diamonds = Math.max(0, Math.floor(Number(args?.diamonds || 0)));
      if (!diamonds) return sendJson(res, 400, { error: 'Jumlah diamond tidak valid.' });
      if (diamonds > 500000) return sendJson(res, 400, { error: 'Maksimal 500000 diamond sekali tukar.' });
      if (!spend(diamonds)) return sendJson(res, 400, { error: 'Diamond tidak cukup.' });
      const exBonus = diamonds>=500000?1.5:diamonds>=200000?1:diamonds>=50000?0.5:diamonds>=10000?0.35:diamonds>=2000?0.2:diamonds>=500?0.1:diamonds>=100?0.05:0;
      const cash = Math.round(diamonds * 100000 * (1 + exBonus));
      const r = receipt({ item: 'cash', cash, diamonds, note: 'Tukar diamond' });
      memory.receipts.push(r);
      return sendJson(res, 200, { ok: true, wallet: { ...memory.wallet }, receipt: r });
    }
    const SIMPLE_GEM_ITEMS = {
      applicants: 30, fillRooms: 50, rentBoost: 100, moodFull: 30, fixAll: 30,
      vvip: 80, rivalShield: 60, rename: 250, kos3: 1000, buyExp: 60, expBig: 250,
    };
    if (Object.prototype.hasOwnProperty.call(SIMPLE_GEM_ITEMS, item)) {
      const price = SIMPLE_GEM_ITEMS[item];
      if (!spend(price)) return sendJson(res, 400, { error: 'Diamond tidak cukup.' });
      const r = receipt({ item });
      memory.receipts.push(r);
      return sendJson(res, 200, { ok: true, wallet: { ...memory.wallet }, receipt: r });
    }
    return sendJson(res, 400, { error: 'Item toko ini belum didukung di mode lokal: ' + String(item) });
  }
  if (p === '/api/papikos/juragan/activate' && m === 'POST') {
    const cost = 490;
    const total = memory.wallet.paid + memory.wallet.free;
    if (total < cost) return sendJson(res, 400, { error: 'Diamond tidak cukup.' });
    const usePaid = Math.min(memory.wallet.paid, cost);
    memory.wallet.paid -= usePaid;
    memory.wallet.free -= (cost - usePaid);
    memory.juragan = true;
    const r = { id: 'local-juragan-' + Date.now() + '-' + Math.random().toString(36).slice(2,8), item: 'juragan', time: Date.now() };
    memory.receipts.push(r);
    return sendJson(res, 200, { ok: true, wallet: { ...memory.wallet }, juragan: true, receipt: r });
  }
  if (p === '/api/papikos/daily' && m === 'GET') {
    const now = Date.now();
    memory.daily = memory.daily || { day: 1, claimedToday: false, lastClaimAt: 0, streak: 0 };
    const rewards = [10, 15, 20, 30, 40, 60, 100];
    const day = Math.min(7, Math.max(1, memory.daily.day || 1));
    return sendJson(res, 200, { now, nextAt: now + 86400000, claimedToday: !!memory.daily.claimedToday, day, streak: memory.daily.streak || 0, rewards });
  }
  if (p === '/api/papikos/daily/claim' && m === 'POST') {
    const now = Date.now();
    memory.daily = memory.daily || { day: 1, claimedToday: false, lastClaimAt: 0, streak: 0 };
    const rewards = [10, 15, 20, 30, 40, 60, 100];
    const day = Math.min(7, Math.max(1, memory.daily.day || 1));
    if (memory.daily.claimedToday) return sendJson(res, 400, { error: 'Hadiah hari ini sudah diambil.' });
    const diamonds = rewards[day - 1] || 10;
    memory.daily.claimedToday = true;
    memory.daily.lastClaimAt = now;
    memory.daily.streak = (memory.daily.streak || 0) + 1;
    memory.wallet.free += diamonds;
    const nextDay = day >= 7 ? 1 : day + 1;
    const respDay = day;
    memory.daily.day = nextDay;
    return sendJson(res, 200, { now, nextAt: now + 86400000, claimedToday: true, day: respDay, streak: memory.daily.streak, rewards, diamonds });
  }
  if (p === '/api/papikos/missions' && m === 'POST') {
    const body = await readBody(req);
    const counters = body?.counters || {};
    const level = Number(body?.level || 1);
    const tier = level >= 30 ? 3 : level >= 15 ? 2 : level >= 5 ? 1 : 0;
    const now = Date.now();
    memory.missions = memory.missions || {};
    const defs = {
      daily: [
        { id:"d-rent", title:"Tukang tagih", emoji:"💵", counter:"rentCollected", targets:[40,150,400,900], cash:[5e4,12e4,3e5,7e5], text:a=>`Tagih sewa ${a} kali` },
        { id:"d-cash", title:"Cuan hari ini", emoji:"💰", counter:"cashEarned", targets:[2e6,8e6,3e7,12e7], cash:[5e4,12e4,3e5,7e5], text:a=>`Kumpulkan pemasukan Rp ${a.toLocaleString('id-ID')}` },
        { id:"d-movein", title:"Kos ramai", emoji:"🔑", counter:"moveIns", targets:[1,2,3,4], cash:[5e4,12e4,3e5,7e5], text:a=>`Terima ${a} penghuni baru` },
        { id:"d-days", title:"Rajin kelola", emoji:"📅", counter:"daysPlayed", targets:[5,10,20,30], cash:[5e4,12e4,3e5,7e5], text:a=>`Kelola kos selama ${a} hari game` },
        { id:"d-facility", title:"Naik kelas", emoji:"🛋️", counter:"facilityBuys", targets:[1,2,4,6], cash:[5e4,12e4,3e5,7e5], text:a=>`Beli ${a} fasilitas` },
        { id:"d-events", title:"Sigap", emoji:"⚡", counter:"eventsResolved", targets:[2,4,6,8], cash:[5e4,12e4,3e5,7e5], text:a=>`Tangani ${a} kejadian` },
      ],
      weekly: [
        { id:"w-rent", title:"Langganan tagih", emoji:"💵", counter:"rentCollected", targets:[900,3750,9e3,2e4], cash:[45e4,1e6,25e5,6e6], text:a=>`Tagih sewa ${a} kali` },
        { id:"w-cash", title:"Cuan seminggu", emoji:"💰", counter:"cashEarned", targets:[45e6,18e7,75e7,3e9], cash:[45e4,1e6,25e5,6e6], text:a=>`Kumpulkan pemasukan Rp ${a.toLocaleString('id-ID')}` },
        { id:"w-movein", title:"Kos laris", emoji:"🔑", counter:"moveIns", targets:[12,24,36,50], cash:[45e4,1e6,25e5,6e6], text:a=>`Terima ${a} penghuni baru` },
        { id:"w-facility", title:"Borong fasilitas", emoji:"🛋️", counter:"facilityBuys", targets:[18,36,60,90], cash:[45e4,1e6,25e5,6e6], text:a=>`Beli ${a} fasilitas` },
        { id:"w-days", title:"Betah mengelola", emoji:"📅", counter:"daysPlayed", targets:[120,180,270,360], cash:[45e4,1e6,25e5,6e6], text:a=>`Kelola kos selama ${a} hari game` },
        { id:"w-renov", title:"Tukang renov", emoji:"🔨", counter:"renovations", targets:[3,6,9,12], cash:[45e4,1e6,25e5,6e6], text:a=>`Selesaikan ${a} renovasi kamar` },
      ],
      monthly: [
        { id:"m-cash", title:"Cuan sebulan", emoji:"💰", counter:"cashEarned", targets:[18e7,75e7,3e9,12e9], cash:[18e5,45e5,11e6,28e6], text:a=>`Kumpulkan pemasukan Rp ${a.toLocaleString('id-ID')}` },
        { id:"m-facility", title:"Kos serba ada", emoji:"🛋️", counter:"facilityBuys", targets:[60,120,210,300], cash:[18e5,45e5,11e6,28e6], text:a=>`Beli ${a} fasilitas` },
        { id:"m-movein", title:"Magnet penghuni", emoji:"🔑", counter:"moveIns", targets:[36,75,120,160], cash:[18e5,45e5,11e6,28e6], text:a=>`Terima ${a} penghuni baru` },
        { id:"m-days", title:"Pengelola setia", emoji:"📅", counter:"daysPlayed", targets:[450,660,900,1200], cash:[18e5,45e5,11e6,28e6], text:a=>`Kelola kos selama ${a} hari game` },
        { id:"m-events", title:"Pemadam masalah", emoji:"⚡", counter:"eventsResolved", targets:[90,180,270,360], cash:[18e5,45e5,11e6,28e6], text:a=>`Tangani ${a} kejadian` },
      ]
    };
    const durations = { daily: 86400000, weekly: 7*86400000, monthly: 30*86400000 };
    const scopes = {};
    for (const [scope, list] of Object.entries(defs)) {
      const st = memory.missions[scope] || (memory.missions[scope] = { claimed: {}, chestClaimed: false, resetsAt: now + durations[scope], base: {} });
      if (now >= st.resetsAt) { st.claimed = {}; st.chestClaimed = false; st.base = {}; st.resetsAt = now + durations[scope]; }
      const missions = list.map(def => {
        const target = def.targets[tier] ?? def.targets[def.targets.length - 1];
        const cash = def.cash[tier] ?? def.cash[def.cash.length - 1];
        const cur = Number(counters[def.counter] || 0);
        if (st.base[def.id] == null) st.base[def.id] = cur;
        const progress = Math.max(0, cur - (st.base[def.id] || 0));
        const claimed = !!st.claimed[def.id];
        return { id: def.id, title: def.title, emoji: def.emoji, text: def.text(target), target, cash, progress: Math.min(progress, target), claimed };
      });
      const allClaimed = missions.length > 0 && missions.every(m => m.claimed);
      const chestCash = missions.reduce((a,m)=>a+m.cash,0);
      scopes[scope] = { missions, resetsAt: st.resetsAt, chest: { ready: allClaimed && !st.chestClaimed, claimed: !!st.chestClaimed, cash: chestCash } };
    }
    return sendJson(res, 200, { now, scopes, refreshedAt: now, resetsAt: Math.min(...Object.values(scopes).map(s=>s.resetsAt)) });
  }
  if (p === '/api/papikos/missions/claim' && m === 'POST') {
    const body = await readBody(req);
    const scope = String(body?.scope || '');
    const mission = String(body?.mission || '');
    const counters = body?.counters || {};
    const level = Number(body?.level || 1);
    const tier = level >= 30 ? 3 : level >= 15 ? 2 : level >= 5 ? 1 : 0;
    const now = Date.now();
    memory.missions = memory.missions || {};
    const defs = {
      daily: [
        { id:"d-rent", counter:"rentCollected", targets:[40,150,400,900], cash:[5e4,12e4,3e5,7e5] },
        { id:"d-cash", counter:"cashEarned", targets:[2e6,8e6,3e7,12e7], cash:[5e4,12e4,3e5,7e5] },
        { id:"d-movein", counter:"moveIns", targets:[1,2,3,4], cash:[5e4,12e4,3e5,7e5] },
        { id:"d-days", counter:"daysPlayed", targets:[5,10,20,30], cash:[5e4,12e4,3e5,7e5] },
        { id:"d-facility", counter:"facilityBuys", targets:[1,2,4,6], cash:[5e4,12e4,3e5,7e5] },
        { id:"d-events", counter:"eventsResolved", targets:[2,4,6,8], cash:[5e4,12e4,3e5,7e5] },
      ],
      weekly: [
        { id:"w-rent", counter:"rentCollected", targets:[900,3750,9e3,2e4], cash:[45e4,1e6,25e5,6e6] },
        { id:"w-cash", counter:"cashEarned", targets:[45e6,18e7,75e7,3e9], cash:[45e4,1e6,25e5,6e6] },
        { id:"w-movein", counter:"moveIns", targets:[12,24,36,50], cash:[45e4,1e6,25e5,6e6] },
        { id:"w-facility", counter:"facilityBuys", targets:[18,36,60,90], cash:[45e4,1e6,25e5,6e6] },
        { id:"w-days", counter:"daysPlayed", targets:[120,180,270,360], cash:[45e4,1e6,25e5,6e6] },
        { id:"w-renov", counter:"renovations", targets:[3,6,9,12], cash:[45e4,1e6,25e5,6e6] },
      ],
      monthly: [
        { id:"m-cash", counter:"cashEarned", targets:[18e7,75e7,3e9,12e9], cash:[18e5,45e5,11e6,28e6] },
        { id:"m-facility", counter:"facilityBuys", targets:[60,120,210,300], cash:[18e5,45e5,11e6,28e6] },
        { id:"m-movein", counter:"moveIns", targets:[36,75,120,160], cash:[18e5,45e5,11e6,28e6] },
        { id:"m-days", counter:"daysPlayed", targets:[450,660,900,1200], cash:[18e5,45e5,11e6,28e6] },
        { id:"m-events", counter:"eventsResolved", targets:[90,180,270,360], cash:[18e5,45e5,11e6,28e6] },
      ]
    };
    const list = defs[scope];
    if (!list) return sendJson(res, 400, { error: 'Scope misi tidak dikenal.' });
    const st = memory.missions[scope] || (memory.missions[scope] = { claimed: {}, chestClaimed: false, resetsAt: now + 86400000, base: {} });
    const makeReceipt = (cash, label) => {
      const receipt = { id: 'local-mission-' + Date.now() + '-' + Math.random().toString(36).slice(2,8), item: 'cash', cash, time: now, note: label };
      memory.receipts.push(receipt);
      return receipt;
    };
    if (mission === 'chest') {
      const allClaimed = list.every(def => st.claimed[def.id]);
      if (!allClaimed) return sendJson(res, 400, { error: 'Semua misi belum selesai.' });
      if (st.chestClaimed) return sendJson(res, 400, { error: 'Peti sudah diambil.' });
      st.chestClaimed = true;
      const chestCash = list.reduce((a,def)=>a+(def.cash[tier] ?? def.cash[def.cash.length-1]),0);
      return sendJson(res, 200, { ok: true, receipt: makeReceipt(chestCash, 'Peti misi ' + scope) });
    }
    const def = list.find(d => d.id === mission);
    if (!def) return sendJson(res, 400, { error: 'Misi tidak ditemukan.' });
    if (st.claimed[mission]) return sendJson(res, 400, { error: 'Hadiah misi sudah diambil.' });
    const target = def.targets[tier] ?? def.targets[def.targets.length - 1];
    const cur = Number(counters[def.counter] || 0);
    if (st.base[def.id] == null) st.base[def.id] = cur;
    const progress = Math.max(0, cur - (st.base[def.id] || 0));
    if (progress < target) return sendJson(res, 400, { error: 'Misi belum selesai.' });
    st.claimed[mission] = true;
    const cash = def.cash[tier] ?? def.cash[def.cash.length - 1];
    return sendJson(res, 200, { ok: true, receipt: makeReceipt(cash, 'Hadiah misi') });
  }
  if (p === '/api/papikos/hustle' && m === 'GET') return sendJson(res, 200, { enabled: false, kosAllowed: true, paidToday: 0, paidMax: 0, energy: { now: 0, max: 0, nextIn: 0 }, games: [] });
  if (p === '/api/papikos/feedback' && m === 'POST') return sendJson(res, 200, { ok: true, id: 'local-feedback' });
  if (p === '/api/papikos/feedback/mine' && m === 'GET') return sendJson(res, 200, { items: [], unreadCount: 0 });
  if (p.startsWith('/api/papikos/feedback/mine/') && m === 'GET') return sendJson(res, 404, { error: 'Not found' });
  if (p === '/api/papikos/restart' && m === 'GET') return sendJson(res, 200, { canRestart: true, resets: 0, resetsAt: Date.now() + 86400000, now: Date.now() });
  if (p === '/api/papikos/restart' && m === 'POST') return sendJson(res, 400, { error: 'Restart online tidak tersedia di mode lokal.' });

  if (p.startsWith('/api/papikos/')) {
    if (m === 'GET') return sendJson(res, 200, { ok: true, items: [], rows: [], receipts: [], now: Date.now() });
    return sendJson(res, 200, { ok: true });
  }
  if (p.startsWith('/api/')) return notFound(res);
  return false;
}

function isAssetPath(p) { return /\.[a-zA-Z0-9]+$/.test(p); }

const server = http.createServer(async (req, res) => {
  try {
    const url = new URL(req.url || '/', `http://${req.headers.host || 'localhost'}`);
    const p = url.pathname;

    if (p.startsWith('/api/')) {
      const handled = await handleApi(req, res, url);
      if (handled === false) return notFound(res);
      return;
    }

    if (p === '/' || p === '') { res.writeHead(302, { Location: '/papikos/' }); return res.end(); }

    if (p === '/papikos' || p.startsWith('/papikos/')) {
      let rel = p === '/papikos' ? '/index.html' : p.slice('/papikos'.length);
      if (rel === '/' || rel === '') rel = '/index.html';
      const filePath = safeJoin(ROOT, rel);
      if (!filePath) return notFound(res);
      fs.stat(filePath, (err, st) => {
        if (!err && st.isFile()) return serveFile(req, res, filePath);
        if (!isAssetPath(rel)) return serveFile(req, res, path.join(ROOT, 'index.html'));
        return notFound(res);
      });
      return;
    }

    if (p.startsWith('/assets/')) {
      const filePath = safeJoin(ROOT, p);
      if (!filePath) return notFound(res);
      return serveFile(req, res, filePath);
    }

    return notFound(res);
  } catch (e) {
    console.error(e);
    if (!res.headersSent) sendJson(res, 500, { error: 'Internal server error' });
  }
});

server.listen(PORT, () => {
  console.log(`Papi Kos local server running at http://localhost:${PORT}/papikos/`);
});
