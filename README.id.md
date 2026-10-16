<div align="center">

[English](README.md) · **Bahasa Indonesia**

# Sinetron Story

**Pimpin rumah produksi sinetron dan ubah drama air mata, kisah horor dan sinetron azab jadi rating tertinggi. Game manajemen pixel art yang bisa langsung dimainkan di browser.**

[![TypeScript](https://img.shields.io/badge/TypeScript-7-3178C6?logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![Phaser](https://img.shields.io/badge/Phaser-4.2.1-8A2BE2)](https://phaser.io/)
[![Vite](https://img.shields.io/badge/Vite-8-646CFF?logo=vite&logoColor=white)](https://vite.dev/)
[![PWA](https://img.shields.io/badge/PWA-bisa%20diinstal-5A0FC8?logo=pwa&logoColor=white)](#pasang-sebagai-aplikasi)
[![Lisensi: MIT](https://img.shields.io/badge/lisensi-MIT-green)](LICENSE)
[![Demo](https://img.shields.io/badge/main-demo%20live-e8762b)](https://sinetron-story.axolotl1429.workers.dev)

### [▶ Main sekarang](https://sinetron-story.axolotl1429.workers.dev)

<img src="docs/screenshots/hero-desktop.jpg" alt="Studio saat bulan Ramadan di desktop: kru syuting di set, status produksi, tangga rating dan linimasa netizen" width="100%">

</div>

## Tentang

Sinetron Story adalah game manajemen ala Kairosoft (mirip *Game Dev Story*) tentang bikin sinetron. Mulai dari studio garasi dengan kru seadanya, pilih genre dan latar, tentukan pemeran utama, syuting, editing, lalu tunggu vonis kritikus dan penonton di rumah. Naik dari TV lokal ke TV nasional dan streaming, bertarung di perang rating mingguan melawan stasiun saingan, hadapi gosip, boikot dan komisi penyiaran, sampai punya *Istana Sinetron*.

Satu karier berjalan sepuluh tahun dalam game dan ditutup dengan rekap dan gelar, lalu bisa lanjut main. Bahasa di dalam game santai ala obrolan sehari-hari. Semua judul, stasiun, penyanyi, sponsor dan selebriti di game ini fiktif.

## Tangkapan layar

<table>
  <tr>
    <td colspan="2"><img src="docs/screenshots/desktop-rating.jpg" alt="Pengumuman rating: keluarga nonton TV, skor kritikus dan rating penonton"></td>
    <td colspan="2"><img src="docs/screenshots/desktop-title.jpg" alt="Layar judul di desktop dengan studio"></td>
  </tr>
  <tr>
    <td><img src="docs/screenshots/phone-studio.jpg" alt="Studio dengan kru bekerja di HP"></td>
    <td><img src="docs/screenshots/phone-rating.jpg" alt="Ulasan kritikus dan rating penonton di HP"></td>
    <td><img src="docs/screenshots/phone-audisi.jpg" alt="Audisi pemeran dengan tiga kandidat di HP"></td>
    <td><img src="docs/screenshots/phone-award.jpg" alt="Malam anugerah tahunan di HP"></td>
  </tr>
</table>

## Fitur

- **Siklus produksi lengkap.** Pilih dari 10 genre (Romansa, Komedi, Keluarga, Azab, Religi, Remaja, Horor, Laga, Siluman, Kolosal) dan 12 latar, tentukan platform dan budget, pilih pemeran utama, lalu lihat kru menggarap naskah, syuting dan editing, lengkap dengan blooper.
- **Momen pengumuman rating.** Keluarga di sofa bereaksi menonton sinetronmu sementara empat kritikus memberi nilai, lalu rating penonton keluar. Combo genre dan latar rahasia menunggu untuk ditemukan.
- **Perang rating mingguan.** Tiap sinetron yang tayang bersaing dengan lima acara saingan di tangga rating platformnya. Tertinggal terus, stasiun bakal menyetop; bertahan di nomor satu, dapat bonus, promo dan tambahan episode.
- **Kru dan bintang.** Rekrut sutradara, penulis, kameramen dan aktor. Gelar audisi untuk cek chemistry, hadapi tuntutan naik gaji dan mogok, dan lihat aktormu jadi selebgram yang diincar stasiun lain.
- **Plot twist, OST, sekuel.** Mainkan kartu plot twist di tengah musim (kebanyakan, netizen muak), gandeng penyanyi dangdut fiktif untuk lagu tema, dan jadikan sinetron hit sekuel atau spin-off.
- **Syuting di lokasi.** Pilih lokasi di peta pixel Nusantara sampai luar negeri, masing-masing dengan bonus dan combo rahasia.
- **Dunia yang berisik.** Gosip soal aktormu, kampanye #Boikot, sponsor product placement, linimasa netizen ala X, dan teguran Komisi Penyiaran Imajiner (KPI) kalau kebanyakan azab, horor dan plot twist.
- **Musim Ramadan.** Kalender Ramadan yang bergeser tiap tahun mendongkrak sinetron religi dan keluarga, plus slot Sinetron Ramadan bersponsor.
- **Besarkan studio.** Lima level studio dari Studio Garasi sampai Istana Sinetron, peralatan, kontrak eksklusif bintang dan kampanye akbar.
- **Karier sepuluh tahun,** 27 prestasi, anugerah tahunan, Hall of Fame, tutorial terpandu, dan backup save lewat file atau kode.
- **Main di mana saja.** Layout responsif untuk HP, landscape dan layar lebar, bisa diinstal sebagai PWA dan dimainkan offline.

## Cara main

1. **Rekrut kru.** Minimal butuh penulis, kameramen dan aktor. Tutorial akan memandu awalnya.
2. **Mulai produksi.** Pilih judul, genre dan latar, lalu platform dan budget, lalu pemeran utama.
3. **Garap.** Biarkan kru mengerjakan naskah, syuting dan editing. Pilih lokasi, OST atau sponsor kalau mau.
4. **Tayangkan.** Saksikan pengumuman rating, lalu jaga posisi di tangga rating dengan promo dan plot twist.
5. **Berkembang.** Pakai uang dan poin riset untuk staf, peralatan dan upgrade studio. Hati-hati utang: bank menyita studio setelah tiga bulan merah yang dalam.

## Kontrol

| Aksi | Desktop | HP |
|---|---|---|
| Zoom studio | Roda mouse | Tampilan pas layar |
| Geser kamera | Seret, tombol panah atau WASD | Tidak perlu di HP |
| Jeda / lanjut | Spasi | Tombol kecepatan |
| Tutup dialog | Esc | Tombol ✕ |
| Gulir dialog panjang | Roda mouse, panah, PgUp / PgDn | Seret |

## Teknologi

- [Phaser 4](https://phaser.io/) untuk rendering, input dan scene
- [TypeScript 7](https://www.typescriptlang.org/) mode strict, dicek dengan `tsc --noEmit`
- [Vite 8](https://vite.dev/) dengan [vite-plugin-pwa](https://vite-pwa-org.netlify.app/) (precache offline, manifest) dan [vite-plugin-singlefile](https://github.com/richardtallent/vite-plugin-singlefile) untuk build satu file
- Semua musik dan efek suara disintesis dengan WebAudio, tanpa file audio
- [Playwright](https://playwright.dev/) untuk tes end-to-end, responsif, audio, keamanan dan soak
- Python (Pillow, NumPy, SciPy) untuk pipeline sprite
- Font: Pixelify Sans, Silkscreen dan Baloo 2 lewat Fontsource

## Struktur proyek

```
sinetron-story/
├── index.html
├── public/              # _headers (CSP dan cache), ikon PWA
├── src/
│   ├── main.ts          # boot, skala responsif
│   ├── scenes/          # Boot, Title, Game
│   ├── sim.ts           # simulasi murni (tanpa Phaser): produksi, skor, pendapatan, event, anugerah
│   ├── rating.ts economy.ts twists.ts ost.ts v5.ts   # perang rating, ekonomi, plot twist, OST, gosip, KPI
│   ├── data.ts titles.ts locations.ts             # genre, tema, generator judul, lokasi peta
│   ├── state.ts sanitize.ts backup.ts             # format save, migrasi, impor/ekspor backup
│   ├── screens*.ts sidepanel.ts ui.ts tutorial.ts # dialog dan UI kit
│   ├── studio.ts art.ts assets.ts                 # layout studio, art prosedural, pemuatan sprite
│   ├── audio.ts         # sequencer WebAudio dan SFX
│   └── assets/          # sprite sheet dan latar
├── tools/               # tes e2e, responsif, audio dan keamanan, bot balance, pipeline aset
├── vite.config.ts       # build PWA
├── vite.single.config.ts    # build satu file
└── wrangler.embed.jsonc # konfigurasi Cloudflare Worker
```

## Mulai

Butuh Node.js 20.19 atau lebih baru.

```bash
git clone https://github.com/vhmns14/sinetron-story.git
cd sinetron-story
npm install
npm run dev          # server lokal dengan hot reload
npm run typecheck    # cek TypeScript strict
npm run build        # build PWA produksi ke dist/
npm run preview      # jalankan hasil build
npm run build:single # seluruh game dalam satu file HTML, di dist-single/
```

### Tes

Sebagian besar tes menjalankan game asli di Chromium headless, jadi build dulu dan instal browser sekali:

```bash
npx playwright install chromium
npm run build
npm run test:e2e     # playthrough lengkap, screenshot di shots/
npm run test:v5      # backup, tutorial, gosip, audisi, sponsor, KPI, ending, migrasi save
npm run test:resp    # layout dari HP kecil sampai 1920x1080, plus resize langsung
npm run audit:sec    # header, nol pelanggaran CSP, fuzzing impor backup
npm run test:soak    # bot main 10 tahun dalam game
npm run test:titles  # cek generator judul
npm run test:audio   # tes sequencer dengan AudioContext tiruan
npm run balance      # simulasi balance headless
```

## Deploy

`npm run build` menghasilkan situs statis di `dist/` dengan base path relatif, jadi bisa ditaruh di hosting statis mana pun atau sub-path (Cloudflare, Netlify, GitHub Pages, server sendiri). `public/_headers` berisi Content Security Policy ketat dan aturan cache untuk hosting yang membacanya.

**Cloudflare Workers (static assets):**

```bash
npm run build
npx wrangler deploy --assets dist --name sinetron-story --compatibility-date 2026-10-01
```

**Cloudflare Workers (satu script embed),** seperti situs live. Ubah dulu `wrangler.embed.jsonc` dengan akun dan route milikmu:

```bash
npm run build
python3 tools/build-embed.py     # menulis deploy-embed/worker.js
npx wrangler deploy -c wrangler.embed.jsonc
```

### Pasang sebagai aplikasi

Buka game di Chrome, Edge atau Safari, lalu pilih *Install* atau *Tambahkan ke Layar Utama*. Setelah dibuka sekali, game bisa dimainkan offline.

## Rencana dan keterbatasan

- UI hanya berbahasa Indonesia. Terjemahan Inggris belum direncanakan.
- Save disimpan di localStorage browser. Menghapus data situs berarti save ikut hilang, jadi pakai *Backup Save* untuk simpan cadangan.
- `npm audit` menandai satu advisory yang hanya berlaku saat build, di dependensi vite-plugin-singlefile. Tidak ada yang ikut terkirim ke pemain.
- Balance disetel pakai bot. Masukan dari pemain asli sangat diterima.
- Tes butuh Chromium lokal lewat Playwright dan belum terhubung ke CI.
- Ide ke depan: genre dan latar baru, kartu plot twist baru, lokasi syuting luar negeri baru.

## Lisensi

[MIT](LICENSE) © 2026 vahmi sofyan. Dibuat oleh KodeKecil.
