// Service worker Papi Kos: game tetap bisa DIBUKA tanpa internet (halaman + kode game disimpan di HP).
// Aturan utama: pembaruan tidak boleh tertahan.
//  - Halaman game (index.html) SELALU diambil dari server dulu. Simpanan hanya dipakai kalau server tidak terjangkau
//    (offline / lebih dari NAV_TIMEOUT_MS). Jadi begitu ada build baru, pemain online langsung mendapatkannya, dan
//    cek versi (src/net/version.ts) tetap bekerja seperti biasa.
//  - /api/* dan version.json tidak pernah disentuh (selalu langsung ke server).
//  - assets/* bernama hash (isinya tidak pernah berubah): diambil dari simpanan, kalau belum ada dari server.
//  - File lain (ikon, sprite, manifest): dari simpanan, sambil diperbarui di belakang.
// File ini disalin ke build sebagai sw.js oleh vite.config.ts (plugin serviceWorkerFile), yang mengisi PRECACHE dengan
// semua kode game build tersebut. Karena isinya berubah tiap build, browser memasang service worker baru tiap rilis.
// Darurat: ganti isi file ini dengan versi yang hanya memanggil self.registration.unregister(); browser
// memeriksa file ini setiap halaman dibuka, jadi service worker lama akan lepas sendiri.

const VERSION = 'v11'
const SHELL = `papikos-shell-${VERSION}`
const ASSETS = `papikos-assets-${VERSION}`
const KEEP = [SHELL, ASSETS]
/** Batas file di simpanan aset (build lama ikut tersimpan sampai terdesak). */
const MAX_ASSETS = 160
/** Server tidak menjawab selama ini → pakai halaman simpanan (kalau ada). */
const NAV_TIMEOUT_MS = 8000
/** Semua file assets/ build ini (diisi saat build), disimpan saat pemasangan supaya menu yang belum pernah dibuka pun jalan offline. */
const PRECACHE = ["assets/AccountBox-9db2FSoN.js","assets/AdminApp-BEwv7_3P.js","assets/Angkringan-DTaWfeoU.js","assets/App-CU_U9YpB.js","assets/App-DNo8DZNp.css","assets/Bakpia-BwZwckh8.js","assets/Batik-DxW6mdEr.js","assets/Becak-CgtHOxi3.js","assets/CanvasRenderer-C_hk2Cqo.js","assets/Filter-LkBJeSeY.js","assets/KopiJoss-Dst2vFIx.js","assets/MinigameHost-Dnj638Ud.js","assets/RenderTargetSystem-ClYAs3HF.js","assets/WebGLRenderer-BzCHGUZ1.js","assets/WebGPURenderer-lO2cKJC5.js","assets/activeKos-BKJUVzJ_.js","assets/admin-Y1nBJx_i.css","assets/audio-CmDrIjpi.js","assets/browserAll-cyeEFaS_.js","assets/cloud-6E2ijBN7.js","assets/friends-jWu9jMe9.js","assets/getTexelRangeRects-C6WWANWu.js","assets/index-CUGIV6CL.css","assets/index-SvUl-92j.js","assets/pwa-DF7ombOa.js","assets/ref-BxFHwI13.js","assets/sfx-CX5SepZI.js","assets/store-SGl8bGnM.js","assets/sync-BbbZPr_5.js","assets/useSmoothT-DlEsILuh.js","assets/version-ptysXaZq.js","assets/wallet-B3rhit0H.js","assets/webworkerAll-CTSmEGw5.js"]

const scope = () => new URL(self.registration ? self.registration.scope : self.location.href)

/**
 * Cara melayani sebuah permintaan. MURNI (dites di tests/ui/serviceWorker.test.ts).
 * @returns {'skip' | 'page' | 'asset' | 'static'}
 */
function routeFor(url, method, mode, scopePath) {
  if (method !== 'GET') return 'skip'
  if (url.origin !== self.location.origin) return 'skip'
  if (url.pathname.startsWith('/api/')) return 'skip'
  if (!url.pathname.startsWith(scopePath)) return 'skip'
  const rest = url.pathname.slice(scopePath.length)
  if (rest === 'version.json' || rest === 'sw.js') return 'skip'
  if (mode === 'navigate') return 'page'
  if (rest.startsWith('assets/')) return 'asset'
  if (rest === '' || rest === 'index.html') return 'page'
  return 'static'
}
self.papikosRouteFor = routeFor

async function trim(cache) {
  const keys = await cache.keys()
  for (let i = 0; i < keys.length - MAX_ASSETS; i++) await cache.delete(keys[i])
}

/** Halaman game: server dulu; simpanan hanya kalau server tidak terjangkau. */
async function page(request) {
  const cache = await caches.open(SHELL)
  const key = scope().href
  const network = fetch(request).then((res) => {
    if (res.ok && res.type === 'basic') void cache.put(key, res.clone())
    return res
  })
  const cached = await cache.match(key)
  if (!cached) return network
  return new Promise((resolve) => {
    let done = false
    const finish = (res) => {
      if (done) return
      done = true
      resolve(res)
    }
    const timer = setTimeout(() => finish(cached), NAV_TIMEOUT_MS)
    network.then(
      (res) => {
        clearTimeout(timer)
        finish(res)
      },
      () => {
        clearTimeout(timer)
        finish(cached)
      },
    )
  })
}

/** File ber-hash: isinya tetap, jadi simpanan dulu. */
async function asset(request) {
  const cache = await caches.open(ASSETS)
  const hit = await cache.match(request)
  if (hit) return hit
  const res = await fetch(request)
  if (res.ok && res.type === 'basic') {
    await cache.put(request, res.clone())
    void trim(cache)
  }
  return res
}

/** Ikon, sprite, manifest: simpanan dulu (cepat), diperbarui di belakang. */
async function staticFile(event) {
  const cache = await caches.open(SHELL)
  const hit = await cache.match(event.request)
  const network = fetch(event.request).then((res) => {
    if (res.ok && res.type === 'basic') void cache.put(event.request, res.clone())
    return res
  })
  if (hit) {
    event.waitUntil(network.catch(() => undefined))
    return hit
  }
  return network
}

self.addEventListener('install', (event) => {
  self.skipWaiting()
  // simpan halaman game sekarang juga, supaya bisa dibuka offline sejak kunjungan pertama
  // (satu file gagal tidak menggagalkan pemasangan)
  event.waitUntil(
    (async () => {
      const shell = await caches.open(SHELL)
      await shell.add(scope().href).catch(() => undefined)
      const assets = await caches.open(ASSETS)
      await Promise.all(
        PRECACHE.map(async (path) => {
          const url = new URL(path, scope()).href
          if (!(await assets.match(url))) await assets.add(url).catch(() => undefined)
        }),
      )
      await trim(assets)
    })(),
  )
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      for (const k of await caches.keys()) if (k.startsWith('papikos-') && !KEEP.includes(k)) await caches.delete(k)
      await self.clients.claim()
    })(),
  )
})

self.addEventListener('fetch', (event) => {
  const req = event.request
  const route = routeFor(new URL(req.url), req.method, req.mode, scope().pathname)
  if (route === 'page') event.respondWith(page(req))
  else if (route === 'asset') event.respondWith(asset(req))
  else if (route === 'static') event.respondWith(staticFile(event))
})
