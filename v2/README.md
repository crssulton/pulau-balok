# Pulau Balok v2 — catatan pengembang

Engine baru Pulau Balok, ditulis ulang dari nol. Tahap pertama: **Pulau Kebun** sebagai pulau pembangun bebas
yang besar (±650 m) dengan medan sungguhan. Pulau Balok dan Pulau Kota masih memakai game lama (`/`) dan akan
dipindahkan ke engine ini satu per satu.

Buka `http://localhost:8080/v2/` (server yang sama: `python3 server.py`). Dari layar awal game lama ada tombol
**🌱 Pulau Kebun Baru**; perahu di dermaga v2 kembali ke game lama.

## Aturan yang tetap sama dengan game lama

- Tanpa build step: ES module biasa + `/lib/three.module.min.js`. Server hanya pustaka bawaan Python.
- Semua teks, komentar, dan suara dalam bahasa Indonesia.
- **Simpanan pemain hanya bertambah.** v2 memakai simpanan yang sama (tabel `players`), menambah kolom
  `build2` dan tidak pernah menghapus kolom lama (`farm`, `zones`, dst. tetap utuh untuk game lama).
- Batas waktu bermain dari menu orang tua (`settings.limit`, `time.sec`, `time.bonus`) tetap berlaku di v2.

## Struktur

| File | Isi |
|---|---|
| `js/main.js` | Menyatukan semuanya: masuk, HUD, Mode Bangun UI, peta, jaringan, loop |
| `js/core/render.js` | Renderer, langit gradasi (shader), awan instanced, laut (shader ombak), siang/malam, **kualitas otomatis** (resolusi & tingkat Hemat/Seimbang/Bagus mengikuti FPS), culling kotak dunia jauh, bayangan mengikuti pemain |
| `js/core/geo.js` | `roundedBox` (sudut bulat ala Roblox), tekstur tepi balok, bahan bersama, **`StaticBatch`** (semua benda diam digabung per kotak 32 m → sedikit draw call) |
| `js/core/physics.js` | Kotak AABB di kisi hash 8 m + sumber balok (Voxels) + tanah berbukit; `ray()` untuk kamera dan memilih tempat membangun |
| `js/core/controller.js` | Gerak pemain: percepatan/perlambatan, coyote time, buffer lompat, tinggi lompat bisa diatur, naik anak tangga otomatis, **terbang** (Mode Bangun), tidak bisa masuk air dalam |
| `js/core/camera.js` | Kamera orang ketiga: orbit, zoom, mengikuti halus, **tidak menembus dinding/pohon/gunung** |
| `js/core/avatar.js` | Karakter ala Roblox (kepala besar berwajah, sendi) + animasi prosedural (diam, jalan, lari, lompat, jatuh, mendarat), topi |
| `js/core/input.js` | Keyboard, mouse, sentuh (joystick, seret kamera, cubit zoom, ketuk) |
| `js/world/terrain.js` | Peta ketinggian (kisi 3 m) dari noise + wilayah: gunung salju, hutan berbukit, gurun, danau & sungai, padang bunga, pantai. Mesh per kotak 48 m. `heightAt()` memakai segitiga yang sama dengan mesh |
| `js/world/kebun.js` | Desa, dermaga, tumbuhan per wilayah, salju turun, warga, tempat-tempat di peta |
| `js/build/catalog.js` | Bentuk balok (kubus, setengah, lantai, tangga, atap miring, dinding, kaca, pintu, tiang, bola, kubah, kerucut, lengkung, pagar, lampu, pohon, semak, bunga, air), palet 16 warna, kotak tabrakan per bentuk |
| `js/build/voxels.js` | Semua balok di pulau (kisi 1 m). Satu `InstancedMesh` per bagian bentuk; tambah/hapus = ubah satu instance |
| `js/build/builder.js` | Mode Bangun: bayangan, taruh/hapus/cat/pipet, kuas 1×1–3×3, putar, urungkan/ulangi, aturan boleh-tidaknya menaruh |
| `js/build/plots.js` | Memuat simpanan `build2`; mengubah kebun versi lama (`farm.items`) menjadi balok |

## Simpanan `build2`

```json
{ "v": 2, "blocks": [[x, y, z, "kubus", 4, 0], [x, y, z, "kaca", "#ff66cc", 1]] }
```

`x`/`z` relatif pusat pulau (0, -400), `y` = tinggi dunia (boleh -4 sampai 109). Bentuk disimpan sebagai **nama**
(katalog boleh bertambah tanpa merusak simpanan). Warna = nomor palet 0–15 atau `#rrggbb` (warna bebas).
`v: 1` (koordinat kavling) dan kebun lama otomatis diubah saat dimuat.

## Protokol (tambahan untuk v2 di `server.py`)

- `login` dengan `v2: true` → klien v2 tidak pernah dipilih menjadi tuan rumah zombie (`elect_zhost`); `pub()` membawa `v2`.
- `buildHello` → `buildWorld { kav, plots: [{key, name, kav, v, blocks | null, items}] }` (bangunan semua pemain;
  `blocks: null` = belum pernah membuka v2, kebun lamanya dikirim sebagai `items`).
- `save` yang mengubah `build2` → disiarkan `buildPlot` ke semua.
- `move` dari v2 memakai format lama. Di luar lingkar Pulau Kebun lama (125 m) v2 mengirim `p: 99` supaya pemain
  game lama tidak melihatnya melayang di pulau lain. Zombie game lama mengabaikan pemain v2.
- Login "pemain baru" dengan nama yang sudah ada **tidak pernah** menimpa simpanan (dijaga di klien dan server).

## Performa

Diukur di Pulau Kebun dengan semua wilayah: ±180 draw call, ±300 ribu segitiga di kualitas Bagus; kotak dunia di
luar jarak pandang tidak digambar (Hemat: 140 m). Tablet mulai di Seimbang, perangkat RAM ≤3 GB di Hemat, dan
pengatur otomatis menurunkan resolusi lalu tingkat kualitas bila FPS turun. FPS bisa ditampilkan di ⚙️ Pengaturan.

## Pengujian

Playwright + Chrome (SwiftShader). Jalankan server uji dengan folder data sementara (**jangan pernah `data/`**):

```bash
PB_DATA_DIR=/tmp/uji python3 server.py 8766
python3 v2/tests/v2world.py /tmp/hasil 8766    # semua wilayah + jumlah draw call (buat pemain dulu lewat v2free/v2mobile)
python3 v2/tests/v2free.py /tmp/hasil 8766     # membangun, kuas, terbang, simpan & muat ulang
python3 v2/tests/v2mobile.py /tmp/hasil 8766   # tata letak tablet, joystick, ketuk-bangun
python3 v2/tests/v2multi.py /tmp/hasil 8766    # bangunan tersiar ke pemain lain (butuh `pip install websockets`)
python3 v2/tests/v1smoke.py /tmp/hasil 8766    # game lama tetap jalan
```

Kait uji: `window.__pb2` (`R`, `ctl`, `cam`, `voxels`, `builder`, `physics`, `world`, `teleport(x, z)`).
SwiftShader hanya beberapa fps dan `dt` dibatasi 0,05 s, jadi waktu game berjalan lebih lambat dari waktu nyata.

## Berikutnya

1. Pindahkan **Pulau Balok** (17 tempat belajar, menara, NPC) ke engine ini.
2. Pindahkan **Pulau Kota** (jalan, kendaraan, wahana, mall).
3. Zombie malam, kendaraan, dan obrolan suara di v2; lalu `/` diarahkan ke v2.
