# Papi Kos - Local Copy

Salinan aset frontend Papi Kos yang diambil dari `https://play.mahbar.id/papikos/` untuk dijalankan secara lokal.

## Isi

- `papikos/` - HTML, JS, CSS, manifest, icon, dan sprite yang dibutuhkan game.
- `server.mjs` - server lokal kecil untuk menyajikan file statis dan stub endpoint API yang dipakai game.
- `package.json` - shortcut untuk menjalankan server.

## Cara main

1. Pastikan Node.js terpasang (disarankan Node 18+).
2. Dari folder ini jalankan:

```bash
npm start
```

atau:

```bash
node server.mjs
```

3. Buka `http://localhost:5173/papikos/`.

## Catatan penting

- Ini adalah **salinan frontend build** yang diambil dari situs publik. Kode sumber asli tidak disertakan.
- Progress/save utama game tetap disimpan di `localStorage` browser.
- Server lokal ini hanya stub untuk endpoint online (login, cloud save, daily/missions/hustle/receipts/toko online, dsb.) supaya game tidak gagal saat endpoint dipanggil. Fitur yang bergantung backend resmi tidak akan berfungsi penuh secara offline/local.
- Beberapa aset/sprite fasilitas kendaraan tertentu yang tidak tersedia publik di path yang sama mungkin tidak terunduh; game utama tetap bisa dicoba.
- Jangan gunakan salinan ini untuk membypass proteksi, mengedit save orang lain, atau menyerang server resmi.
