// Memuat bangunan kavling ke Voxels, dan mengubah kebun versi lama (farm.items) menjadi balok v2
// saat pemain pertama kali datang ke Pulau Kebun v2. Data lama TIDAK diubah (simpanan hanya bertambah).
import { SHAPE_INDEX } from './catalog.js';
import { PLOT, BUILD_H, CX, CZ, onIsland, heightAt } from '../world/kebun.js';

const C = { putih: 0, abu: 1, abutua: 2, hitam: 3, merah: 4, oranye: 5, kuning: 6, hijaumuda: 7, hijau: 8, toska: 9, langit: 10, biru: 11, ungu: 12, pink: 13, kayu: 14, coklat: 15 };

// v=2: x/z relatif pusat pulau (bebas di seluruh pulau); v=1 atau kebun lama: relatif sudut kavling `plot`
export function loadBlocks(voxels, owner, blocks, v = 2, plot = null) {
  voxels.clearOwner(owner);
  if (!Array.isArray(blocks)) return 0;
  const bx = v >= 2 ? CX : plot?.ox, bz = v >= 2 ? CZ : plot?.oz;
  if (bx == null) return 0;
  let n = 0;
  for (const b of blocks) {
    if (!Array.isArray(b)) continue;
    const [x, y, z, s, c, r] = b, t = typeof s === 'string' ? SHAPE_INDEX[s] : s;
    const wx = bx + (x | 0), wz = bz + (z | 0);
    if (t == null || !(y >= -4 && y < BUILD_H) || !onIsland(wx + 0.5, wz + 0.5, -2)) continue;
    const col = typeof c === 'string' && /^#[0-9a-f]{6}$/i.test(c) ? c : (c | 0) & 15;
    voxels.add(wx, y | 0, wz, t, col, r | 0, owner); n++;
  }
  return n;
}
// balok berkoordinat kavling -> koordinat pulau (v2)
// dinaikkan setinggi tanah di kavling itu (padang di sekitar desa sedikit bergelombang)
export const toIsland = (blocks, plot) => {
  const dy = Math.max(0, Math.round(heightAt(plot.cx, plot.cz)));
  return blocks.map(([x, y, z, ...rest]) => [x + plot.ox - CX, y + dy, z + plot.oz - CZ, ...rest]);
};

// barang kebun lama (sel 1 m relatif sudut kavling) -> daftar balok v2
export function migrateFarm(items) {
  const out = [], seen = new Set();
  const put = (x, y, z, s, c, r = 0) => {
    const k = `${x},${y},${z}`; if (seen.has(k) || x < 0 || z < 0 || x >= PLOT || z >= PLOT) return;
    seen.add(k); out.push([x, y, z, s, c, r]);
  };
  const fill = (x0, z0, w, d, y, s, c, r = 0) => { for (let x = x0; x < x0 + w; x++) for (let z = z0; z < z0 + d; z++) put(x, y, z, s, c, r); };
  const walls = (x0, z0, w, d, h, c, roof) => {
    for (let y = 0; y < h; y++) for (let x = x0; x < x0 + w; x++) for (let z = z0; z < z0 + d; z++) {
      const edge = x === x0 || z === z0 || x === x0 + w - 1 || z === z0 + d - 1;
      if (!edge) continue;
      const door = y < 2 && z === z0 + d - 1 && x === x0 + Math.floor(w / 2);
      if (door) { if (y === 0) put(x, y, z, 'pintu', C.coklat, 2); continue; }
      put(x, y, z, y === 1 && (x + z) % 3 === 0 ? 'kaca' : 'kubus', c);
    }
    fill(x0, z0, w, d, h, 'setengah', roof);
  };
  for (const it of items || []) {
    const w0 = { petak: 2, jalan: 2, pagar: 2, bunga: 1, pohon: 2, bangku: 2, lampu: 1, ayunan: 3, kolam: 4, sumur: 2, gudang: 4, rumah: 6 }[it.k];
    const d0 = { petak: 2, jalan: 2, pagar: 1, bunga: 1, pohon: 2, bangku: 1, lampu: 1, ayunan: 2, kolam: 4, sumur: 2, gudang: 4, rumah: 6 }[it.k];
    if (!w0) continue;
    const [w, d] = it.r & 1 ? [d0, w0] : [w0, d0], x = it.x | 0, z = it.z | 0;
    switch (it.k) {
      case 'petak': fill(x, z, w, d, 0, 'setengah', C.coklat); if (it.crop) put(x, 1, z, 'semak', C.hijau); break;
      case 'jalan': fill(x, z, w, d, 0, 'lantai', C.abu); break;
      case 'pagar': fill(x, z, w, d, 0, 'pagar', C.kayu, w > d ? 0 : 1); break;
      case 'bunga': put(x, 0, z, 'bunga', C.pink); break;
      case 'pohon': put(x, 0, z, 'pohon', C.hijau); break;
      case 'bangku': fill(x, z, w, d, 0, 'setengah', C.kayu); break;
      case 'lampu': put(x, 0, z, 'lampu', C.hitam); break;
      case 'ayunan': put(x, 0, z, 'tiang', C.merah); put(x + w - 1, 0, z + d - 1, 'tiang', C.merah); fill(x, z, w, d, 2, 'lantai', C.merah); break;
      case 'kolam': fill(x + 1, z + 1, w - 2, d - 2, 0, 'air', C.langit); fill(x, z, w, d, 0, 'setengah', C.abu); break;
      case 'sumur': fill(x, z, w, d, 0, 'kubus', C.abu); break;
      case 'gudang': walls(x, z, w, d, 2, C.kayu, C.merah); break;
      case 'rumah': walls(x, z, w, d, 3, C.kuning, C.merah); break;
      default:
    }
  }
  return out;
}
