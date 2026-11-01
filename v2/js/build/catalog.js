// Katalog Mode Bangun: bentuk balok (satu sel 1 m), warna, dan kotak tabrakannya.
// Tiap bentuk punya satu atau beberapa "bagian" (geometri + bahan) yang digambar sebagai InstancedMesh,
// jadi ribuan balok tetap hanya beberapa draw call.
import * as THREE from '/lib/three.module.min.js';
import { roundedBox } from '../core/geo.js';

export const PALETTE = [
  '#f4f4f4', '#a9b0bd', '#4a4f5c', '#2c2f3a', // putih, abu muda, abu tua, hitam
  '#e8434b', '#ff8a2a', '#ffd23a', '#b7e34a', // merah, oranye, kuning, hijau muda
  '#3fb25a', '#2ec4b6', '#3a9df5', '#3a5cf5', // hijau, toska, biru langit, biru
  '#9a62e0', '#ff8fc0', '#c98a52', '#8a5a35', // ungu, merah muda, kayu muda, cokelat
];
export const PALETTE_NAMES = ['Putih', 'Abu muda', 'Abu tua', 'Hitam', 'Merah', 'Oranye', 'Kuning', 'Hijau muda', 'Hijau', 'Toska', 'Biru langit', 'Biru', 'Ungu', 'Merah muda', 'Kayu muda', 'Cokelat'];

const _m = new THREE.Matrix4(), _v = new THREE.Vector3(), _n = new THREE.Matrix3(), _c = new THREE.Color();
// gabungkan beberapa geometri (posisi relatif pusat sel) menjadi satu, dengan warna per titik
function merge(items) {
  let vc = 0, ic = 0;
  for (const it of items) { vc += it.geo.attributes.position.count; ic += it.geo.index ? it.geo.index.count : it.geo.attributes.position.count; }
  const pos = new Float32Array(vc * 3), nor = new Float32Array(vc * 3), uv = new Float32Array(vc * 2), col = new Float32Array(vc * 3), idx = new Uint32Array(ic);
  let vo = 0, io = 0;
  for (const it of items) {
    const g = it.geo, gp = g.attributes.position, gn = g.attributes.normal, gu = g.attributes.uv;
    _m.compose(_v.set(...(it.p || [0, 0, 0])), new THREE.Quaternion().setFromEuler(new THREE.Euler(...(it.r || [0, 0, 0]))), new THREE.Vector3(...(it.s || [1, 1, 1])));
    _n.getNormalMatrix(_m); _c.set(it.c || '#ffffff').convertSRGBToLinear();
    for (let i = 0; i < gp.count; i++) {
      _v.fromBufferAttribute(gp, i).applyMatrix4(_m); pos.set([_v.x, _v.y, _v.z], (vo + i) * 3);
      _v.fromBufferAttribute(gn, i).applyMatrix3(_n).normalize(); nor.set([_v.x, _v.y, _v.z], (vo + i) * 3);
      if (gu) uv.set([gu.getX(i), gu.getY(i)], (vo + i) * 2);
      col.set([_c.r, _c.g, _c.b], (vo + i) * 3);
    }
    if (g.index) for (let i = 0; i < g.index.count; i++) idx[io++] = g.index.getX(i) + vo; else for (let i = 0; i < gp.count; i++) idx[io++] = i + vo;
    vo += gp.count;
  }
  const out = new THREE.BufferGeometry();
  out.setAttribute('position', new THREE.BufferAttribute(pos, 3)); out.setAttribute('normal', new THREE.BufferAttribute(nor, 3));
  out.setAttribute('uv', new THREE.BufferAttribute(uv, 2)); out.setAttribute('color', new THREE.BufferAttribute(col, 3));
  out.setIndex(new THREE.BufferAttribute(idx, 1)); out.computeBoundingSphere();
  return out;
}
const box = (sx, sy, sz) => new THREE.BoxGeometry(sx, sy, sz);

// prisma segitiga: tinggi di belakang (-z), landai turun ke depan (+z)
function wedgeGeo() {
  const g = new THREE.BufferGeometry();
  const A = [-0.5, -0.5, -0.5], B = [0.5, -0.5, -0.5], C = [0.5, -0.5, 0.5], D = [-0.5, -0.5, 0.5], E = [-0.5, 0.5, -0.5], F = [0.5, 0.5, -0.5];
  const tris = [[A, C, B], [A, D, C], [A, B, F], [A, F, E], [D, E, F], [D, F, C], [A, E, D], [B, C, F]];
  const uvs = [[0, 0, 1, 1, 1, 0], [0, 0, 0, 1, 1, 1], [0, 0, 1, 0, 1, 1], [0, 0, 1, 1, 0, 1], [0, 0, 0, 1, 1, 1], [0, 0, 1, 1, 1, 0], [1, 0, 1, 1, 0, 0], [0, 0, 1, 0, 0, 1]];
  const pos = [], uv = [];
  tris.forEach((t, i) => { for (const p of t) pos.push(...p); uv.push(...uvs[i]); });
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.computeVertexNormals();
  return g;
}

// kotak tabrakan dalam koordinat sel 0..1 (sebelum diputar)
const FULL = [[0, 0, 0, 1, 1, 1]];
export const SHAPES = [
  { id: 'kubus', name: 'Balok', icon: '🧱', parts: [{ geo: () => merge([{ geo: box(1, 1, 1) }]), mat: 'block' }], col: FULL },
  { id: 'setengah', name: 'Setengah', icon: '▬', parts: [{ geo: () => merge([{ geo: box(1, 0.5, 1), p: [0, -0.25, 0] }]), mat: 'block' }], col: [[0, 0, 0, 1, 0.5, 1]] },
  { id: 'lantai', name: 'Lantai', icon: '⬜', parts: [{ geo: () => merge([{ geo: box(1, 0.2, 1), p: [0, -0.4, 0] }]), mat: 'block' }], col: [[0, 0, 0, 1, 0.2, 1]] },
  { id: 'tangga', name: 'Tangga', icon: '📶', parts: [{ geo: () => merge([{ geo: box(1, 0.5, 1), p: [0, -0.25, 0] }, { geo: box(1, 0.5, 0.5), p: [0, 0.25, -0.25] }]), mat: 'block' }], col: [[0, 0, 0, 1, 0.5, 1], [0, 0.5, 0, 1, 1, 0.5]] },
  { id: 'lereng', name: 'Atap Miring', icon: '📐', parts: [{ geo: () => merge([{ geo: wedgeGeo() }]), mat: 'block' }], col: [[0, 0, 0, 1, 0.5, 1], [0, 0.5, 0, 1, 1, 0.5]] },
  { id: 'dinding', name: 'Dinding', icon: '🟫', parts: [{ geo: () => merge([{ geo: box(1, 1, 0.24), p: [0, 0, -0.38] }]), mat: 'block' }], col: [[0, 0, 0, 1, 1, 0.24]] },
  { id: 'kaca', name: 'Kaca', icon: '🪟', parts: [{ geo: () => merge([{ geo: box(1, 1, 0.12), p: [0, 0, -0.38] }]), mat: 'glass' }, { geo: () => merge([{ geo: box(1, 0.1, 0.2), p: [0, -0.45, -0.38] }, { geo: box(1, 0.1, 0.2), p: [0, 0.45, -0.38] }, { geo: box(0.1, 1, 0.2), p: [-0.45, 0, -0.38] }, { geo: box(0.1, 1, 0.2), p: [0.45, 0, -0.38] }]), mat: 'block', fixed: '#f4f4f4' }], col: [[0, 0, 0, 1, 1, 0.24]] },
  { id: 'pintu', name: 'Pintu', icon: '🚪', parts: [{ geo: () => merge([{ geo: box(0.9, 0.98, 0.1), p: [0, 0, -0.44] }, { geo: new THREE.SphereGeometry(0.06, 8, 6), p: [0.3, 0, -0.37], c: '#ffd23a' }]), mat: 'block' }], col: [] },
  { id: 'tiang', name: 'Tiang', icon: '🏛️', parts: [{ geo: () => merge([{ geo: new THREE.CylinderGeometry(0.32, 0.32, 1, 14) }]), mat: 'smooth' }], col: [[0.18, 0, 0.18, 0.82, 1, 0.82]] },
  { id: 'bola', name: 'Bola', icon: '⚪', parts: [{ geo: () => merge([{ geo: new THREE.SphereGeometry(0.5, 18, 12) }]), mat: 'smooth' }], col: [[0.1, 0, 0.1, 0.9, 0.95, 0.9]] },
  { id: 'kubah', name: 'Kubah', icon: '🕌', parts: [{ geo: () => merge([{ geo: new THREE.SphereGeometry(0.5, 18, 10, 0, Math.PI * 2, 0, Math.PI / 2), p: [0, -0.5, 0], s: [1, 2, 1] }, { geo: new THREE.CircleGeometry(0.5, 18), p: [0, -0.5, 0], r: [Math.PI / 2, 0, 0] }]), mat: 'smooth' }], col: [[0.1, 0, 0.1, 0.9, 0.9, 0.9]] },
  { id: 'kerucut', name: 'Kerucut', icon: '🔺', parts: [{ geo: () => merge([{ geo: new THREE.ConeGeometry(0.5, 1, 16) }]), mat: 'smooth' }], col: [[0.2, 0, 0.2, 0.8, 0.6, 0.8]] },
  { id: 'lengkung', name: 'Lengkung', icon: '🌉', parts: [{ geo: () => merge([
    { geo: box(0.22, 1, 1), p: [-0.39, 0, 0] }, { geo: box(0.22, 1, 1), p: [0.39, 0, 0] }, { geo: box(1, 0.16, 1), p: [0, 0.42, 0] },
    { geo: box(0.16, 0.14, 1), p: [-0.22, 0.29, 0] }, { geo: box(0.16, 0.14, 1), p: [0.22, 0.29, 0] }, { geo: box(0.1, 0.1, 1), p: [-0.27, 0.18, 0] }, { geo: box(0.1, 0.1, 1), p: [0.27, 0.18, 0] },
  ]), mat: 'block' }], col: [[0, 0, 0, 0.28, 1, 1], [0.72, 0, 0, 1, 1, 1], [0, 0.78, 0, 1, 1, 1]] },
  { id: 'pagar', name: 'Pagar', icon: '🪵', parts: [{ geo: () => merge([{ geo: box(0.16, 0.9, 0.16), p: [-0.38, -0.05, 0] }, { geo: box(0.16, 0.9, 0.16), p: [0.38, -0.05, 0] }, { geo: box(1, 0.12, 0.08), p: [0, 0.2, 0] }, { geo: box(1, 0.12, 0.08), p: [0, -0.2, 0] }]), mat: 'block' }], col: [[0, 0, 0.4, 1, 1, 0.6]] },
  { id: 'lampu', name: 'Lampu', icon: '💡', parts: [{ geo: () => merge([{ geo: new THREE.CylinderGeometry(0.06, 0.08, 0.8, 8), p: [0, -0.1, 0] }, { geo: box(0.3, 0.06, 0.3), p: [0, -0.47, 0] }]), mat: 'smooth' }, { geo: () => merge([{ geo: roundedBox(0.3, 0.3, 0.3, 0.08), p: [0, 0.38, 0] }]), mat: 'glow', fixed: '#fff1a8' }], col: [[0.38, 0, 0.38, 0.62, 1, 0.62]], light: true },
  { id: 'pohon', name: 'Pohon', icon: '🌳', parts: [{ geo: () => merge([{ geo: new THREE.CylinderGeometry(0.16, 0.2, 1.4, 8), p: [0, 0.2, 0], c: '#8a5a35' }, { geo: roundedBox(1.5, 1.2, 1.5, 0.35), p: [0, 1.35, 0] }, { geo: roundedBox(1.0, 0.8, 1.0, 0.3), p: [0.15, 2.05, -0.1] }]), mat: 'smooth' }], col: [[0.34, 0, 0.34, 0.66, 1, 0.66]], tall: 3, defColor: 8, tint: true },
  { id: 'semak', name: 'Semak', icon: '🌿', parts: [{ geo: () => merge([{ geo: roundedBox(0.9, 0.6, 0.9, 0.25), p: [0, -0.2, 0] }, { geo: roundedBox(0.6, 0.4, 0.6, 0.2), p: [0.1, 0.12, 0.05] }]), mat: 'smooth' }], col: [], soft: true, defColor: 8 },
  { id: 'bunga', name: 'Bunga', icon: '🌷', parts: [{ geo: () => merge([{ geo: new THREE.CylinderGeometry(0.03, 0.03, 0.5, 5), p: [0, -0.25, 0], c: '#3fb25a' }, { geo: new THREE.SphereGeometry(0.13, 10, 8), p: [0, 0.05, 0] }, { geo: new THREE.SphereGeometry(0.05, 8, 6), p: [0, 0.05, 0.11], c: '#ffd23a' }]), mat: 'smooth' }], col: [], defColor: 13 },
  { id: 'air', name: 'Air', icon: '💧', parts: [{ geo: () => merge([{ geo: box(1, 0.8, 1), p: [0, -0.1, 0] }]), mat: 'glass' }], col: [], defColor: 10 },
];
export const SHAPE_INDEX = Object.fromEntries(SHAPES.map((s, i) => [s.id, i]));

// kotak tabrakan sel (x,y,z) dengan rotasi r (kelipatan 90°) dalam koordinat dunia
export function cellBoxes(shape, x, y, z, r, out) {
  for (const [a, b, c, d, e, f] of shape.col) {
    // putar di sekitar pusat sel (0.5, 0.5)
    let x0 = a - 0.5, z0 = c - 0.5, x1 = d - 0.5, z1 = f - 0.5;
    for (let i = 0; i < (r & 3); i++) { [x0, z0, x1, z1] = [-z1, x0, -z0, x1]; }
    out.push({ minx: x + 0.5 + Math.min(x0, x1), miny: y + b, minz: z + 0.5 + Math.min(z0, z1), maxx: x + 0.5 + Math.max(x0, x1), maxy: y + e, maxz: z + 0.5 + Math.max(z0, z1), tag: shape.soft ? 'soft' : 0 });
  }
  return out;
}

// geometri dibuat sekali saat dibutuhkan
export function partGeometry(part) { return (part._g ||= part.geo()); }
