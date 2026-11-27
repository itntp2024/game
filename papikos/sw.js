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

const VERSION = 'v13'
const SHELL = `papikos-shell-${VERSION}`
const ASSETS = `papikos-assets-${VERSION}`
const KEEP = [SHELL, ASSETS]
/** Batas file di simpanan aset (build lama ikut tersimpan sampai terdesak). */
const MAX_ASSETS = 160
/** Server tidak menjawab selama ini → pakai halaman simpanan (kalau ada). */
const NAV_TIMEOUT_MS = 8000
/**
 * Hanya aset inti untuk boot/layar awal. Sisanya di-cache on-demand oleh handler asset saat pertama dipakai,
 * supaya pemasangan SW tidak mengunduh puluhan chunk besar sekaligus (yang bikin load awal/update terasa berat).
 */
const PRECACHE = [
  "assets/index-SvUl-92jv2.js",
  "assets/index-CUGIV6CLv2.css",
  "assets/App-CU_U9YpBv2.js",
  "assets/App-DNo8DZNpv2.css",
  "assets/activeKos-BKJUVzJ_v2.js",
  "assets/store-SGl8bGnMv2.js",
  "assets/wallet-B3rhit0Hv2.js",
  "assets/pwa-DF7ombOav2.js",
  "assets/version-ptysXaZqv2.js",
  "assets/cloud-6E2ijBN7v2.js",
  "assets/ref-BxFHwI13v2.js",
  "assets/sfx-CX5SepZIv2.js",
]

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

/** Asset: network-first agar patch in-place di nama file yang sama tidak terjebak cache lama. */
async function asset(request) {
  const cache = await caches.open(ASSETS)
  try {
    const res = await fetch(request)
    if (res.ok && res.type === 'basic') {
      await cache.put(request, res.clone())
      void trim(cache)
    }
    return res
  } catch {
    const hit = await cache.match(request)
    if (hit) return hit
    throw new Error('offline')
  }
}

/** Ikon, sprite, manifest: network-first, fallback ke cache. */
async function staticFile(event) {
  const cache = await caches.open(SHELL)
  try {
    const res = await fetch(event.request)
    if (res.ok && res.type === 'basic') await cache.put(event.request, res.clone())
    return res
  } catch {
    const hit = await cache.match(event.request)
    if (hit) return hit
    return fetch(event.request)
  }
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
