# Pulau Balok — catatan pengembang

Game edukasi 3D bergaya balok untuk anak 4–5 tahun, berbahasa Indonesia, dimainkan bersama lewat WiFi rumah.
File ini untuk **pengembang**. Panduan untuk orang tua (cara main, fitur, aturan) ada di `BACA-SAYA.txt`.

## Menjalankan

```bash
python3 server.py          # HTTP :8080, HTTPS :8443 (sertifikat dibuat otomatis lewat openssl)
python3 server.py 8766     # port lain; HTTPS = port + 363
```

Buka `http://localhost:8080`. Perangkat lain di WiFi yang sama membuka alamat IP komputer ini.
Mikrofon (obrolan suara, jawaban lisan) hanya diizinkan browser lewat **https**, jadi pakai port 8443.
`GET /info` mengembalikan port dan IP lokal (dipakai launcher untuk mendeteksi server yang sudah jalan).

Launcher untuk orang tua: `Mulai Pulau Balok (Mac).command` dan `Mulai Pulau Balok (Windows).bat`.

## Aturan dasar proyek

- **Server hanya pustaka bawaan Python.** Orang tua menjalankannya lewat launcher tanpa `pip install`.
  WebSocket ditulis sendiri; penyimpanan memakai `sqlite3`.
- **Klien tanpa build step.** ES module biasa + `lib/three.module.min.js` (Three.js r169). Tidak ada npm di runtime.
- Semua teks, komentar, dan suara dalam bahasa Indonesia.
- `data/` (database + sertifikat) dan `.backup/` (file versi 1) tidak masuk git dan diblokir dari HTTP.

## Struktur

| File | Isi |
|---|---|
| `server.py` | HTTP/HTTPS statis, WebSocket `/ws`, SQLite, ruang per lokasi, jam dunia (siang/malam/zona aman), relay pesan |
| `index.html` | Seluruh HUD, layar, dan CSS (inline) |
| `js/game.js` | Inti game: dunia pulau, 17 lokasi belajar (`Zone`), pemain, kamera, kontrol, jaringan, zombie, toko, NPC talk, kendaraan, terjun sayap |
| `js/world.js` | Fisika pijakan + konten dunia tambahan: Menara Langit, bangunan, gunung, kapal, trampolin, bandara, tempat sewa, NPC |
| `js/pad.js` | Kanvas menulis/menggambar/puzzle |
| `js/listen.js` | Pengenal suara (Web Speech) + pencocokan jawaban lisan |
| `js/net.js` | Koneksi WebSocket + WebRTC mesh (obrolan suara) |
| `js/fx.js` | Efek perayaan (konfeti, balon) |

## Database (`data/pulau-balok.db`)

| Tabel | Isi |
|---|---|
| `players` | `key` (nama huruf kecil), `name`, `data` (JSON simpanan pemain), `updated` |
| `scores` | poin per lokasi per pemain (papan Top 3) |
| `recent` | soal terakhir per lokasi (supaya soal tidak berulang) |
| `config` | pengaturan keluarga (lama siang/malam, zombie, zona aman, dll.) |

SQLite adalah sumber utama; `localStorage` hanya cadangan saat server mati.

## Protokol WebSocket

Pesan berbentuk JSON `{ t: '<jenis>', ... }`.

- **Masuk & simpanan:** `login`, `names`, `save`, `setPlayer`, `deletePlayer`, `family`, `setConfig`
- **Dunia bersama:** `move` (x, z, y, f, m, `p` = pose/kendaraan, `pc` = jumlah penumpang), `emote`, `greet`, `voice`, `rtc`
- **Ruang lokasi belajar:** `zone`, `start`, `answer`, `next`, `qkey`
- **Malam & zombie:** `setPhase`, `alive`, `zspawn`, `zstate`, `zdead`, `zhit`, `zhurt`, `shot`
- **Lain-lain:** `poke` (pukul main-main), `summit` (sampai puncak menara), `ride` / `rideOk` / `rideNo` / `rideOff` / `rideEnd` (penumpang kendaraan)

Kode pose `p` pada `move`: 1 terjun bebas, 2 terbang bersayap, 3 berenang, 4 ATV, 5 jetski, 8 pesawat (pengemudi); 6/7/9 penumpang ATV/jetski/pesawat.

## Keputusan desain yang tidak terlihat dari satu file

- **Ronde bersama identik di semua perangkat.** `Zone.generate()` menukar sementara `Math.random` dengan RNG dari seed server (`mulberry32`). Apa pun yang memakai `Math.random` selama ronde dibuat (mis. variasi intonasi suara) harus memakai RNG sendiri, kalau tidak perangkat akan berbeda soal.
- **Ruang per lokasi.** Pemain pertama = tuan rumah (lobi + pilih level + Mulai); yang datang belakangan ikut ronde berjalan; ruang kosong = sesi selesai. Skor dihitung di server saat jawaban dibuka.
- **Tuan rumah zombie** = pemain dengan id terkecil; dia yang menggerakkan zombie dan menyiarkan `zstate`. Jam siang/malam & rotasi zona aman ada di server (`world_loop`).
- **Fisika pijakan (`world.js`).** Semua balok yang bisa dipijak/ditabrak adalah kotak berotasi di `solids`, diindeks per kotak 16 m (`grid`); balok bergerak (kapal, lift) ada di `movingSolids`. `stepVertical()` mengembalikan tinggi jatuh saat mendarat (jatuh > 3,2 m di menara mengurangi nyawa, kecuali sebelum lantai 3).
- **Penggabungan balok statis.** `staticBatch()` di `game.js` menyatukan semua balok diam menjadi `InstancedMesh` per bahan. Benda yang bergerak/berkedip/disembunyikan **harus** berada di grup dengan `userData.dynamic = true` (`DYN`, `TD`, `f.level()`), kalau tidak ia ikut "membeku".
- **Atap/lantai atas bangunan** disembunyikan saat pemain di dalam (`hideable()` + `updateHide()`); daftar yang sama dipakai `inBuilding()` untuk aturan malam.
- **Malam = hanya zona aman yang aman.** NPC disembunyikan, bangunan/menara/laut/bandara mengusir pemain ke titik `PLACES[*].go`, jetski & pesawat ditutup.
- **Rintangan menara dihitung lokal** di tiap perangkat (tidak disinkronkan); jumlahnya mengikuti level dari menu orang tua.

## Menambah tempat baru

1. Tambah entri di `PLACES` (`world.js`): `name`, `emoji`, `pos`/`x,z`, `r`. Otomatis muncul di peta, pohon tidak tumbuh di sana, dan kamera saat tiba lewat peta tidak terhalang.
2. Bangun dengan `frame(x, z, faceCenter(x, z))` → `f.solid()` (bisa dipijak), `f.deco()` (hiasan), `f.level()` + `hideable()` untuk atap.
3. NPC: `addNpc({ id, name, role, x: [x, z], lines | talk })`. `talk(api)` bisa memakai `api.say`, `api.ask` (kuis, jawaban benar = +1 ⭐), `api.choose`, `api.food`, `api.eat`.

## Pengujian

Tidak ada test runner. Pengujian dilakukan dengan Playwright headless (Chrome + SwiftShader) yang mengendalikan game lewat kait uji di `window`:
`__pb` (pemain, teleport, kamera, simpanan), `__pbWorld` (isi `world.js`), `__pbSend`, `__pbZ` / `__pbSpawn` (zombie), `__pbW` (jam dunia), `__pbTalk`, `__pbClimb`, `__pbVeh`, `__pbPara`, `__pbEat`, `__pbRenderer`.

Catatan: di SwiftShader game hanya ±2 fps dan `dt` dibatasi 0,05 s, jadi waktu game berjalan ±10× lebih lambat dari waktu nyata. Untuk menguji fisika (mis. memanjat 20 lantai), jalankan `stepVertical` / `pushOut` langsung dalam loop 60 fps di `page.evaluate`, jangan menunggu render.
Jalankan server uji di port lain (mis. 8766) dan hapus `data/` sesudahnya.
