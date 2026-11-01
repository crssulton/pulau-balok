// Medan Pulau Kebun v2: peta ketinggian (kisi 3 m) dari noise + wilayah (gunung salju, hutan berbukit,
// gurun, danau & sungai, pantai, padang desa). Mesh dibagi kotak 48 m supaya yang jauh tidak digambar.
// Tinggi untuk fisika diambil dari segitiga yang sama dengan mesh, jadi kaki pemain pas di permukaan.
import * as THREE from '/lib/three.module.min.js';
import { MAT } from '../core/geo.js';

export const CX = 0, CZ = -400;          // pusat pulau (sama dengan Pulau Kebun di game lama)
export const SPAN = 400;                 // setengah lebar area peta (pulau sampai ±360 m)
const STEP = 3, N = Math.round((SPAN * 2) / STEP) + 1;
export const SEA = -0.55;                // permukaan laut/danau

/* ---------- noise ---------- */
function hash(x, z) { let h = (x * 374761393 + z * 668265263) | 0; h = Math.imul(h ^ (h >>> 13), 1274126177); return ((h ^ (h >>> 16)) >>> 0) / 4294967296; }
const sm = (t) => t * t * (3 - 2 * t);
function vnoise(x, z) {
  const xi = Math.floor(x), zi = Math.floor(z), xf = sm(x - xi), zf = sm(z - zi);
  const a = hash(xi, zi), b = hash(xi + 1, zi), c = hash(xi, zi + 1), d = hash(xi + 1, zi + 1);
  return (a + (b - a) * xf + (c - a) * zf + (a - b - c + d) * xf * zf) * 2 - 1;
}
function fbm(x, z, oct = 4) { let s = 0, a = 0.5, f = 1; for (let i = 0; i < oct; i++) { s += vnoise(x * f, z * f) * a; f *= 2.03; a *= 0.5; } return s; }
function ridge(x, z, oct = 4) { let s = 0, a = 0.5, f = 1; for (let i = 0; i < oct; i++) { const n = 1 - Math.abs(vnoise(x * f + 31, z * f - 17)); s += n * n * a; f *= 2.1; a *= 0.5; } return s; }
const smooth = (a, b, x) => { const t = Math.max(0, Math.min(1, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
const lerp = (a, b, t) => a + (b - a) * t;

/* ---------- wilayah (u,v relatif pusat; v positif = utara, ke arah dermaga & Pulau Balok) ---------- */
export const REGIONS = {
  gunung: { u: 10, v: -235, r: 135 },
  hutan: { u: 205, v: -10, r: 115 },
  gurun: { u: -200, v: -150, r: 95 },
  danau: { u: -165, v: 55, r: 40 },
  bunga: { u: 150, v: 175, r: 70 },
};
const RIVER = [[-165, 55], [-200, 70], [-240, 60], [-280, 78], [-330, 70], [-380, 80]];
export function coastR(u, v) {
  const a = Math.atan2(u, v);
  return 318 + vnoise(Math.cos(a) * 2.2 + 5, Math.sin(a) * 2.2 + 5) * 38 + vnoise(Math.cos(a) * 6 + 9, Math.sin(a) * 6) * 12;
}
const mask = (u, v, R) => 1 - smooth(R.r * 0.35, R.r, Math.hypot(u - R.u, v - R.v));
function riverDist(u, v) {
  let best = 1e9;
  for (let i = 0; i + 1 < RIVER.length; i++) {
    const [ax, az] = RIVER[i], [bx, bz] = RIVER[i + 1], dx = bx - ax, dz = bz - az;
    const t = Math.max(0, Math.min(1, ((u - ax) * dx + (v - az) * dz) / (dx * dx + dz * dz)));
    best = Math.min(best, Math.hypot(u - ax - t * dx, v - az - t * dz));
  }
  return best;
}

// tinggi "asli" dari rumus (dipakai sekali untuk mengisi kisi)
function heightFn(u, v) {
  const d = Math.hypot(u, v), cr = coastR(u, v);
  let h = 2.2 + fbm(u * 0.012, v * 0.012) * 4.5 + fbm(u * 0.05, v * 0.05, 2) * 0.8;
  // bukit-bukit hutan
  const hm = mask(u, v, REGIONS.hutan); h += hm * (6 + fbm(u * 0.025 + 3, v * 0.025, 3) * 14);
  // gunung bersalju (punggung bergerigi)
  const gm = mask(u, v, REGIONS.gunung) ** 1.4; h += gm * (18 + ridge(u * 0.011, v * 0.011, 5) * 78);
  // gurun: bukit pasir bergelombang
  const dm = mask(u, v, REGIONS.gurun); h = lerp(h, 2.4 + Math.sin(u * 0.09 + Math.sin(v * 0.05) * 2) * 1.6 + fbm(u * 0.03, v * 0.03, 2) * 2, dm);
  // padang bunga: landai
  const bm = mask(u, v, REGIONS.bunga); h = lerp(h, 1.4 + fbm(u * 0.02, v * 0.02, 2) * 1.5, bm);
  // danau dan sungai
  const lm = 1 - smooth(REGIONS.danau.r * 0.55, REGIONS.danau.r, Math.hypot(u - REGIONS.danau.u, v - REGIONS.danau.v));
  h = lerp(h, -3.2, lm);
  const rd = riverDist(u, v); if (u < REGIONS.danau.u + 5) h = lerp(h, -2.2, 1 - smooth(3.5, 11, rd));
  // desa di tengah: datar; padang sekitarnya bergelombang lembut (tempat kebun lama & membangun)
  const flat = 1 - smooth(30, 112, d); h = lerp(h, d < 30 ? 0 : 0.5 + fbm(u * 0.03, v * 0.03, 2) * 0.6, flat);
  if (d < 32) h = 0;
  // lingkar jalan desa
  if (Math.abs(d - 46) < 5) h = lerp(h, 0.25, 1 - smooth(2.5, 5, Math.abs(d - 46)));
  // jalan ke dermaga (utara): rata
  if (Math.abs(u) < 7 && v > 20) h = lerp(h, 0.4, 1 - smooth(4, 7, Math.abs(u)));
  // pantai lalu laut
  const shore = smooth(cr - 34, cr + 6, d);
  h = lerp(h, Math.min(h, 0.7 + (cr - d) * 0.04), smooth(cr - 50, cr - 20, d));
  h = lerp(h, -7, shore);
  return h;
}

/* ---------- kisi ketinggian ---------- */
export const H = new Float32Array(N * N);
const gx0 = CX - SPAN, gz0 = CZ - SPAN;
let built = false;
export function buildHeights() {
  if (built) return; built = true;
  for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) H[j * N + i] = heightFn(gx0 + i * STEP - CX, gz0 + j * STEP - CZ);
}
// tinggi tepat di (x,z): interpolasi pada segitiga yang sama dengan mesh
export function heightAt(x, z) {
  const fx = (x - gx0) / STEP, fz = (z - gz0) / STEP;
  if (fx < 0 || fz < 0 || fx >= N - 1 || fz >= N - 1) return -7;
  const i = Math.floor(fx), j = Math.floor(fz), tx = fx - i, tz = fz - j, k = j * N + i;
  const a = H[k], b = H[k + 1], c = H[k + N], d = H[k + N + 1];
  return tx + tz < 1 ? a + (b - a) * tx + (c - a) * tz : d + (c - d) * (1 - tx) + (b - d) * (1 - tz);
}
export function slopeAt(x, z) {
  const e = 1.5; return Math.hypot(heightAt(x + e, z) - heightAt(x - e, z), heightAt(x, z + e) - heightAt(x, z - e)) / (2 * e);
}
// jalan setapak (diwarnai di medan, jadi selalu mengikuti tanah)
export const onPath = (x, z) => { const u = x - CX, v = z - CZ, d = Math.hypot(u, v); return Math.abs(d - 46) < 2.4 || (Math.abs(u) < 2.4 && v > 14 && v < coastR(0, 1) - 8); };
export const onLand = (x, z, pad = 0) => { const u = x - CX, v = z - CZ; return Math.hypot(u, v) < coastR(u, v) - pad; };

// wilayah untuk warna, tumbuhan, salju
export function biomeAt(x, z, h = heightAt(x, z)) {
  const u = x - CX, v = z - CZ;
  if (h > 34) return 'salju';
  if (h < 1.2 && Math.hypot(u, v) > coastR(u, v) - 48) return 'pantai';
  if (mask(u, v, REGIONS.gurun) > 0.5) return 'gurun';
  if (mask(u, v, REGIONS.gunung) > 0.25) return 'gunung';
  if (mask(u, v, REGIONS.hutan) > 0.35) return 'hutan';
  if (mask(u, v, REGIONS.bunga) > 0.4) return 'bunga';
  return 'padang';
}

/* ---------- mesh ---------- */
const COL = {
  grass: new THREE.Color('#71c24c'), grass2: new THREE.Color('#8bd25a'), forest: new THREE.Color('#4f9e3b'), sand: new THREE.Color('#ecd9a0'),
  desert: new THREE.Color('#f0c27a'), desert2: new THREE.Color('#e6a95e'), rock: new THREE.Color('#9097a3'), rock2: new THREE.Color('#7b8290'),
  snow: new THREE.Color('#f7fbff'), path: new THREE.Color('#e2c98e'), wet: new THREE.Color('#bfa877'), bed: new THREE.Color('#7fb5a8'), flower: new THREE.Color('#9ad75f'),
};
for (const c of Object.values(COL)) c.convertSRGBToLinear();
const TILE = 16; // kuadrat per kotak (48 m)
export function buildTerrainMesh(scene, render) {
  const c = new THREE.Color(), meshes = [];
  for (let tj = 0; tj < N - 1; tj += TILE) for (let ti = 0; ti < N - 1; ti += TILE) {
    const ni = Math.min(TILE, N - 1 - ti), nj = Math.min(TILE, N - 1 - tj);
    // lewati kotak yang seluruhnya laut dalam
    let any = false;
    for (let j = tj; j <= tj + nj && !any; j++) for (let i = ti; i <= ti + ni; i++) if (H[j * N + i] > -5) { any = true; break; }
    if (!any) continue;
    const vc = (ni + 1) * (nj + 1), pos = new Float32Array(vc * 3), col = new Float32Array(vc * 3), idx = [];
    let k = 0;
    for (let j = 0; j <= nj; j++) for (let i = 0; i <= ni; i++, k++) {
      const gi = ti + i, gj = tj + j, x = gx0 + gi * STEP, z = gz0 + gj * STEP, h = H[gj * N + gi];
      pos[k * 3] = x; pos[k * 3 + 1] = h; pos[k * 3 + 2] = z;
      const sl = slopeAt(x, z), b = biomeAt(x, z, h), n = (hash(gi, gj) - 0.5) * 0.06;
      if (h < -0.2) c.copy(COL.bed);
      else if (onPath(x, z)) c.copy(COL.path);
      else if (b === 'salju' && sl < 1.4) c.copy(COL.snow);
      else if (sl > 0.95) c.copy(COL.rock).lerp(COL.rock2, hash(gi + 7, gj));
      else if (b === 'pantai') c.copy(h < 0.2 ? COL.wet : COL.sand);
      else if (b === 'gurun') c.copy(COL.desert).lerp(COL.desert2, (Math.sin(x * 0.09) + 1) * 0.3);
      else if (b === 'gunung') c.copy(COL.forest).lerp(COL.rock, Math.min(1, Math.max(0, (h - 14) / 20)));
      else if (b === 'hutan') c.copy(COL.forest).lerp(COL.grass, hash(gi, gj + 3) * 0.3);
      else if (b === 'bunga') c.copy(COL.flower);
      else c.copy(COL.grass).lerp(COL.grass2, (fbm(x * 0.03, z * 0.03, 2) + 0.5) * 0.7);
      col[k * 3] = c.r + n; col[k * 3 + 1] = c.g + n; col[k * 3 + 2] = c.b + n;
    }
    const W = ni + 1;
    for (let j = 0; j < nj; j++) for (let i = 0; i < ni; i++) {
      const a = j * W + i, b = a + 1, cc = a + W, d = cc + 1;
      idx.push(a, cc, b, b, cc, d); // diagonal b–c, sama dengan heightAt()
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
    geo.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(vc * 2), 2));
    // normal dihitung dari kisi (bukan per kotak) supaya tidak ada garis sambungan antar kotak
    const nor = new Float32Array(vc * 3); k = 0;
    for (let j = 0; j <= nj; j++) for (let i = 0; i <= ni; i++, k++) {
      const gi = ti + i, gj = tj + j, hl = H[gj * N + Math.max(0, gi - 1)], hr = H[gj * N + Math.min(N - 1, gi + 1)], hd = H[Math.max(0, gj - 1) * N + gi], hu = H[Math.min(N - 1, gj + 1) * N + gi];
      const nx = (hl - hr) / (2 * STEP), nz = (hd - hu) / (2 * STEP), l = Math.hypot(nx, 1, nz);
      nor[k * 3] = nx / l; nor[k * 3 + 1] = 1 / l; nor[k * 3 + 2] = nz / l;
    }
    geo.setAttribute('normal', new THREE.BufferAttribute(nor, 3));
    geo.setIndex(idx); geo.computeBoundingSphere();
    const m = new THREE.Mesh(geo, MAT.smooth); m.receiveShadow = true; m.matrixAutoUpdate = false;
    scene.add(m); render?.addChunk(m); meshes.push(m);
  }
  return meshes;
}
