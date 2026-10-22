# Pulau Balok — catatan pengembang

Game edukasi 3D bergaya balok untuk anak 4–5 tahun, berbahasa Indonesia, dimainkan bersama lewat WiFi rumah.
File ini untuk **pengembang**. Panduan untuk orang tua (cara main, fitur, aturan) ada di `BACA-SAYA.txt`.

## Menjalankan

```bash
python3 server.py          # HTTP :8080, HTTPS :8443 (sertifikat dibuat otomatis lewat openssl)
python3 server.py 8766     # port lain; HTTPS = port + 363
PB_DATA_DIR=/tmp/uji python3 server.py 8766   # folder data lain (WAJIB untuk uji)
```

> ⚠️ `data/pulau-balok.db` berisi kemajuan pemain sungguhan (poin, koin, pencapaian). Jangan dihapus atau dipakai untuk uji.
> Uji selalu dengan `PB_DATA_DIR`. Cadangan dibuat dengan API backup SQLite ke `data/backups/`.

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
| `js/world.js` | Fisika pijakan + konten dunia tambahan Pulau Balok: Menara Langit, bangunan, gunung, kapal, trampolin, bandara, tempat sewa, NPC; juga fungsi daratan tiga pulau (`onLand`, `clampLand`, `islandOf`) dan `kit` (alat bangun) |
| `js/city.js` | Pulau Kota (superelips, bentuk membulat `geo()`/`S()` ikut digabung): jalan dengan tikungan bulat (`rrPoint`), gedung bervariasi, bus kota (8 halte), kereta (4 stasiun, jembatan layang `trainH`, terowongan `HILL`), rumah sakit (`HOSPITAL.beds`), perpustakaan (`SPOTS.books`), kapal ferry antarpulau, loket kegiatan berbayar, kebun binatang, toko stiker, supermarket (bisa dimasuki), Mall Kota 2 lantai (topi, stiker, mesin capit, food court), Teater Kota (panggung; naskah `STORIES` ada di `game.js`), roller coaster (`COASTER`: kurva CatmullRom + putaran `LOOP`, orientasi kuaternion per titik dengan parallel transport, pose diinterpolasi; 6 kursi, kursi terisi dicek dari posisi pemain lain), kora-kora, bom-bom car, istana balon, polantas, arena balap, bianglala, komidi putar, menara pandang, lalu lintas, ruko pengisi (`buildDensity`), zona aman kota |
| `js/pad.js` | Kanvas menulis/menggambar/puzzle |
| `js/farm.js` | Pulau Kebun ala Roblox: perahu, alun-alun desa (toko bibit, pasar, balai, bengkel), 12 kavling pemain (`KAVS`), tombol aksi yang muncul saat dekat (`#farmAct`, F/Enter), hotbar & Mode Bangun (`#farmBar`, bayangan grid, putar, simpan ke tas), pasar pemain. Tiap kavling digambar `KavView` sebagai beberapa `InstancedMesh` (per bentuk, warna per instance); pemandangan diam memakai bentuk membulat `geo()`/`S()` seperti `city.js` dan digabung `staticBatch` |
| `js/farm-state.js` | Aturan kebun (tanpa three.js): delapan tanaman, katalog `ITEMS` (petak, jalan, pagar, bunga, pohon, bangku, lampu, ayunan, kolam, sumur, gudang, rumah), grid kavling 24 m / tanah 8 m (`canPlace`, `placeItem`, `pickUp`), `promptFor` (tombol aksi), tanah dan pasar (`takeLand`/`putLand`), migrasi simpanan lama (`normalizeFarm`) |
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
- **Malam & zombie:** `setPhase`, `alive`, `zspawn`, `zstate` (`[id, jenis, x, z, arah, hp, max, bangkit, status, tinggi]`), `zdead` (+`k` jenis), `zhit` (+`pw` dorongan), `zhurt`, `zspit` (ludah lendir), `zslam` (hentakan Raja), `zfx` (efek mendarat), `shot`
- **Kebun:** `farmHello` → `farmWorld` (kavling milikku + kebun semua pemain), `farmPlot` (kebun seorang pemain berubah; disiarkan dari `save`), `farmMarket`, `farmList`, `farmBuy`, `farmCancel`, `farmSync` (delta: `coins`, `harvest`, `landOut`, `landIn`, `inv`)
- **Lain-lain:** `poke` (pukul main-main), `summit` (sampai puncak menara), `ride` / `rideOk` / `rideNo` / `rideOff` / `rideEnd` (penumpang kendaraan)

Kode pose `p` pada `move`: 1 terjun bebas, 2 terbang bersayap, 3 berenang, 4 ATV, 5 jetski, 8 pesawat (pengemudi); 6/7/9 penumpang ATV/jetski/pesawat.

## Keputusan desain yang tidak terlihat dari satu file

- **Ronde bersama identik di semua perangkat.** `Zone.generate()` menukar sementara `Math.random` dengan RNG dari seed server (`mulberry32`). Apa pun yang memakai `Math.random` selama ronde dibuat (mis. variasi intonasi suara) harus memakai RNG sendiri, kalau tidak perangkat akan berbeda soal.
- **Ruang per lokasi.** Pemain pertama = tuan rumah (lobi + pilih level + Mulai); yang datang belakangan ikut ronde berjalan; ruang kosong = sesi selesai. Skor dihitung di server saat jawaban dibuka.
- **Tuan rumah zombie** = pemain dengan id terkecil; dia yang menjalankan otak zombie (`zombieHostTick`: status jalan/ancang-ancang/lompat/ludah/pingsan/teriak/hentak) dan menyiarkan `zstate`. **Gelombang** (`waveInfo()`) dihitung dari jam dunia sehingga semua perangkat sepakat tanpa pesan tambahan. Ludah & hentakan disiarkan sebagai kejadian; tiap perangkat menghitung sendiri apakah pemainnya terkena (adil walau jaringan lambat). Hadiah (`dropsFor`) ditentukan dari hash id zombie supaya koin yang terbang terlihat sama di semua perangkat. Jam siang/malam & rotasi zona aman ada di server (`world_loop`).
- **Fisika pijakan (`world.js`).** Semua balok yang bisa dipijak/ditabrak adalah kotak berotasi di `solids`, diindeks per kotak 16 m (`grid`); balok bergerak (kapal, lift) ada di `movingSolids`. `stepVertical()` mengembalikan tinggi jatuh saat mendarat (jatuh > 3,2 m di menara mengurangi nyawa, kecuali sebelum lantai 3).
- **Penggabungan balok statis.** `staticBatch()` di `game.js` menyatukan semua balok diam menjadi `InstancedMesh` per bahan. Benda yang bergerak/berkedip/disembunyikan **harus** berada di grup dengan `userData.dynamic = true` (`DYN`, `TD`, `f.level()`), kalau tidak ia ikut "membeku".
- **Atap/lantai atas bangunan** disembunyikan saat pemain di dalam (`hideable()` + `updateHide()`); daftar yang sama dipakai `inBuilding()` untuk aturan malam.
- **Malam = hanya zona aman yang aman.** NPC disembunyikan, bangunan/menara/laut/bandara mengusir pemain ke titik `PLACES[*].go`, jetski & pesawat ditutup.
- **Tiga pulau.** Pulau Balok (bulat, pusat 0,0, R≈99), Pulau Kota (kotak 234 m, pusat 0,330), dan Pulau Kebun (bulat besar, pusat 0,-400, R=120). `islandOf()` membedakan z < -200 (kebun), z > 165 (kota), dan sisanya (balok); server memakai pembagian yang sama. Batas pantai, zombie, kendaraan, dan peta memakai fungsi daratan di `world.js`.
- **Pulau Kebun.** Dari peta Pulau Balok pilih **Perahu Kebun**, lalu **Berlayar ke Pulau Kebun**. Perahu gratis membutuhkan 12 detik simulasi dan dapat dipakai pulang juga. Saat malam zombie tetap muncul; zona aman tetap: Dermaga dan Alun-alun. Warga (`W.addNpc`) punya tombol Bicara, pulang saat malam, dan kios ikut tutup.
- **Kavling & membangun (ala Roblox).** Server membagi satu dari 12 kavling (`farm.kav`, tidak bisa diganti perangkat) saat pemain pertama tiba, dan kebun semua pemain terlihat. Kavling 24×24 m dibagi 3×3 tanah; tanah dibeli di Pak Lurah (tengah dulu). Barang (`farm.items`: `{k, x, z, r}` dalam sel 1 m relatif ke sudut kavling) harus utuh di satu tanah milik sendiri dan tidak bertumpuk. Mode Bangun: pilih barang di hotbar, bayangan mengikuti depan pemain atau titik ketukan (`groundTap`), tombol aksi = Taruh; Simpan memindahkan barang ke tas (`farm.inv`) untuk ditaruh lagi atau dijual ke Pak Darto setengah harga. Berkebun tanpa memilih alat: dekati Petak Tanam → Tanam/Siram/Panen muncul sendiri; dekat Rumah → Tidur (maju satu hari). Simpanan versi 2 (81 petak tetap) otomatis diubah: petak & tanaman tetap, bangunan masuk tas.
- **Pasar Pulau.** Bu Mira membeli semua hasil panen dan menjual hasil panen kembali dengan koin. Pasar pemain memakai tabel SQLite `farm_listings`: hasil panen, tanah (barang di atasnya disimpan di kolom `extra` dengan posisi relatif, lalu ditaruh di tanah kosong pertama pembeli), atau barang di tas ditahan saat iklan dibuat dan dipindahkan dalam satu operasi server ketika pemain lain membeli; penjual menerima koin walau berada di perangkat lain. Iklan sendiri dapat dibatalkan. `farmSync` hanya mengirim delta supaya kemajuan kebun yang belum tersimpan tidak tertimpa. Aturan ini ada dua kali dan harus sama: `farm_take()`/`farm_give()`/`farm_data()` di `server.py` dan `takeLand()`/`putLand()`/`normalizeFarm()` di `farm-state.js`.
- **Kendaraan umum kota dihitung dari jam (`Date.now()`)**, jadi posisi bus/kapal/bianglala sama di semua perangkat tanpa sinkronisasi. Penumpang duduk = kode pose 10; mobil sewaan = 11 (penumpang 12), gokart = 13, bom-bom car = 14. `transitPose()` bisa mengembalikan `q` (kuaternion, coaster) atau `pitch`/`roll` (kora-kora) untuk memiringkan badan pemain.
- **Simpanan pemain hanya bertambah.** Kolom baru (`emotes`, `raceBest`, `lastPos`, topi toko) diberi nilai awal di `DEFAULT` dan digabung dengan `merge()`; jangan pernah mengubah/menghapus kolom lama. `lastPos` diisi `captureCheckpoint()` (hanya saat berdiri aman) dan dipakai `resumeCheckpoint()` saat *Ayo Main*.
- **Perangkat sentuh** (`(hover:none) and (pointer:coarse)`) → `body.mobile`: layar penuh saat *Ayo Main* (orientasi bebas, tidak dikunci), tombol `#rotBtn` jadi layar penuh. Menu orang tua bisa dibuka sebelum login (`#loginParent`; server melayani `family/setPlayer/giveCoins/setConfig/setPhase/zspawn/deletePlayer` tanpa nama) dan menjeda pemain (`parentPause`).
- **Bentuk non-kotak ikut digabung.** `staticBatch()` juga menggabung mesh yang geometrinya ditandai `geometry.userData.batch` (silinder, kerucut, bola, kubah, atap limas di `city.js`), dikelompokkan per geometri + bahan.
- **Kota ramai** (`buildLife()` di `city.js`): warga latar `CROWD` digambar sebagai 6 `InstancedMesh` (pose sendi dihitung per orang; mode walk/wander/sit/stand/jump/run/ride, menyapa pemain), merpati `BIRDS` (instanced, kabur saat pemain bergerak dekat, `feedBirds()`), menu jajanan `SHOPS` (spot `kind:'shop'` → `shopMenu()` di `game.js`), wahana gratis `PLAY` (perosotan/ayunan/putar-putar/kuda goyang lewat jalur transit yang sama), dan `instancer()` yang menggabungkan hiasan bergerak (layang-layang, bebek, ayunan, ondel-ondel) jadi satu draw call per bentuk. Penjual tanpa obrolan khusus adalah warga instanced, bukan NPC penuh (hemat draw call). Semua lokal per perangkat (tidak lewat jaringan); balon pemain hanya terlihat di perangkat sendiri.
- **Sinkron penumpang**: `move` membawa `rd` ("idPengemudi:kursi:jenis") saat menumpang mobil teman dan `tk` (token wahana + `age`) saat naik bus/kereta/wahana; perangkat lain menempelkan pemain itu ke kursi kendaraan yang mereka lihat sendiri (`ridingPose()`), bukan ke posisi yang tertunda. Server meneruskan kedua kolom ini.
- **Hadiah koin**: pesan `giveCoins` (orang tua) → pemain online menerima `gift`; offline: `coins` ditambahkan di data server (+`updated`).
- **Mall 5 lantai** (`MALL` di `city.js`): pelat lantai berlubang untuk atrium & tangga, tiap lantai `f.level()` yang disembunyikan; pengunjung punya `mlv` agar ikut tersembunyi; lift = aktivitas `lift` (teleport antarlantai).
- **Jeda**: `setPause()` di `game.js`; pemain yang jeda mengirim `move` dengan kode pose `p = 99` (`P_PAUSE`), sehingga perangkat lain menyembunyikannya dan `zTargets()` mengabaikannya (tanpa ubah server). `visibilitychange` menjeda otomatis.
- **Tuan rumah zombie & siang**: server memilih tuan rumah dari pemain yang tidak sedang jeda (pose 99) dan memilih ulang saat status jeda berubah. Saat siang server tidak meneruskan `zstate`, klien mengabaikan `zstate`, tuan rumah melelehkan semua zombie tiap bingkai, dan perangkat lain membersihkan sendiri setelah 3 detik.
- **Raja menahan pagi**: server mencatat pulau tempat Raja hidup dari `zstate` (`boss.isl`); saat waktu malam habis, pagi ditunda (`world.hold`) bila pulau itu sama dengan pulau pemain yang hidup & tidak jeda, paling lama 5 menit. Laporan lebih tua dari 6 detik diabaikan.
- **Kombo bela diri**: `MOVES` (R/L/K/S) di `game.js`; `punch()` memulai gerakan (kombo lanjut bila ditekan ≤0,7 dtk setelah gerakan sebelumnya), `strike()` memberi kerusakan di sepertiga gerakan, `fightPose()` menggerakkan lengan/kaki/badan. Teman melihatnya lewat kolom `fm` pada `move` (diteruskan server). Tombol pukul memakai `pointerdown` agar bisa sambil joystick.
- **Pembagian zombie**: `spawnZombie()` memilih acak satu pemain aktif (`zActive()`: tidak jeda/kalah), jadi jumlah zombie per pulau sebanding jumlah pemainnya; 70% muncul 12–22 m dari pemain (40 percobaan, cocok untuk kota padat), sisanya dari air mancur / gorong-gorong terdekat (`ZSPAWN` kini juga di tiap perempatan kota). Raja Zombie muncul di pulau dengan pemain aktif terbanyak.
- **Zombie adaptif**: `zHost.heat` (0–3, langkah 0,5) naik saat semua zombie habis sebelum gelombang selesai → serbuan (`zPending`) + `zfx` `k:'heat'`; heat menaikkan kuota, batas, laju muncul, nyawa (+35%/level), kecepatan (+12%/level), dan jenis (`heatKinds`).
- **Kebun Binatang Nusantara** (`buildZoo`, `ZOO.species` berisi fakta, kuis, dan suara) dan **flying fox** (`ZIP`: kabel parabola, gerak disimulasikan sekali `zipPrep()` lalu diinterpolasi; transit `id:'zip'`). Kota saat malam (`CITY_NIGHT`) menghentikan semua gerak hiasan.
- **Pembaca buku & rumah sakit** ada di `game.js` (`BOOKS`, `openBooks()`, `hospitalMenu()`/`careTick()`); buku yang tamat disimpan di `save.booksRead` (kolom baru, additive).
- **Penggabungan per pulau.** `staticBatch()` dipanggil terpisah untuk Pulau Balok dan Pulau Kota; `islandCull()` menyembunyikan pulau yang jauh (>270–290 m), sehingga tiap pulau hanya menggambar dirinya sendiri.
- **Rintangan menara dihitung lokal** di tiap perangkat (tidak disinkronkan); jumlahnya mengikuti level dari menu orang tua.

## Menambah tempat baru

Uji permainan dengan `PB_DATA_DIR` terpisah; alur minimum: naik perahu → cangkul/tanam/siram → tidur → panen → jual/beli → muat ulang → perahu pulang. Pastikan Pulau Kota dan tempat belajar lama tetap dapat diakses.

1. Tambah entri di `PLACES` (`world.js`): `name`, `emoji`, `pos`/`x,z`, `r`. Otomatis muncul di peta, pohon tidak tumbuh di sana, dan kamera saat tiba lewat peta tidak terhalang.
2. Bangun dengan `frame(x, z, faceCenter(x, z))` → `f.solid()` (bisa dipijak), `f.deco()` (hiasan), `f.level()` + `hideable()` untuk atap.
3. NPC: `addNpc({ id, name, role, x: [x, z], lines | talk })`. `talk(api)` bisa memakai `api.say`, `api.ask` (kuis, jawaban benar = +1 ⭐), `api.choose`, `api.food`, `api.eat`.

## Pengujian

Tidak ada test runner. Pengujian dilakukan dengan Playwright headless (Chrome + SwiftShader) yang mengendalikan game lewat kait uji di `window`:
`__pb` (pemain, teleport, kamera, simpanan), `__pbWorld` (isi `world.js`), `__pbSend`, `__pbZ` / `__pbSpawn` (zombie), `__pbW` (jam dunia), `__pbTalk`, `__pbClimb`, `__pbVeh`, `__pbPara`, `__pbEat`, `__pbRenderer`.

Catatan: di SwiftShader game hanya ±2 fps dan `dt` dibatasi 0,05 s, jadi waktu game berjalan ±10× lebih lambat dari waktu nyata. Untuk menguji fisika (mis. memanjat 20 lantai), jalankan `stepVertical` / `pushOut` langsung dalam loop 60 fps di `page.evaluate`, jangan menunggu render.
Jalankan server uji di port lain (mis. 8766) dengan `PB_DATA_DIR` ke folder sementara, lalu hapus folder sementara itu saja. **Jangan pernah menghapus `data/`.**
