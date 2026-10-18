// Pulau Kota: pulau kedua bertema kota. Tempat menghabiskan koin hasil belajar di Pulau Balok.
// Isi: jalan & lampu lalu lintas, gedung tinggi, bus kota otomatis (8 halte), kapal ferry antarpulau,
// toko topi, restoran, klinik, bioskop, bianglala, komidi putar, menara pandang, perpustakaan, taman (zona aman), mobil lalu-lalang.
// Semua balok diam ikut digabung (InstancedMesh) supaya ringan; yang bergerak dihitung dari jam (sama di semua perangkat).
import * as THREE from '../lib/three.module.min.js';
import * as W from './world.js';

const { frame, addSolid, sign, addNpc, closedSign, numChoices, shuffle, pick, randi, rand, clamp, ease } = W.kit;
let K = null;
const CX = W.CITY.x, CZ = W.CITY.z, TAU = Math.PI * 2;
const L = (x, z) => [CX + x, CZ + z]; // koordinat lokal kota -> dunia
const nowS = () => Date.now() / 1000;
const CDYN = new THREE.Group(); // benda bergerak di kota (disembunyikan saat pemain di Pulau Balok)

/* ---------------- bahan bersama ---------------- */
export const windowMat = new THREE.MeshLambertMaterial({ color: '#35507e', emissive: '#ffd98a', emissiveIntensity: 0 });
const glassMat = new THREE.MeshLambertMaterial({ color: '#bfe6ff', transparent: true, opacity: 0.45 });
const LIGHT = { r: [new THREE.MeshBasicMaterial({ color: '#ff3b30' }), new THREE.MeshBasicMaterial({ color: '#4a1c1a' })], y: [new THREE.MeshBasicMaterial({ color: '#ffd23a' }), new THREE.MeshBasicMaterial({ color: '#4a3d14' })], g: [new THREE.MeshBasicMaterial({ color: '#34c759' }), new THREE.MeshBasicMaterial({ color: '#163d22' })] };

/* ---------------- tempat-tempat kota (peta, titik datang, pengusiran malam) ---------------- */
export const CITY_PLACES = {};
export const safeSpots = []; // zona aman kota (selalu aman saat malam)
export const lamps = []; // titik lampu jalan [x, z] untuk cahaya malam
// gorong-gorong tempat zombie kota muncul: ujung jalan lingkar + tiap perempatan dalam kota (dipilih yang terdekat dengan pemain)
export const ZSPAWN = [L(0, -96), L(0, 96), L(-96, 0), L(96, 0), ...[-48, 0, 48].flatMap((x) => [-48, 0, 48].map((z) => L(x + 6.5, z + 6.5)))];
function place(id, name, emoji, x, z, gx, gz) { const [wx, wz] = L(x, z), [ox, oz] = L(gx, gz); CITY_PLACES[id] = { name, emoji, x: wx, z: wz, go: [ox, oz], look: [wx, wz] }; }

/* ---------------- balok bantu (koordinat lokal kota) ---------------- */
let root = null;
function B(x, z, w, d, h, color, y0 = 0, solid = false, parent = root) {
  const [wx, wz] = L(x, z); const m = K.box(w, h, d, color, wx, y0 + h / 2, wz, parent);
  if (solid) addSolid(wx, wz, w / 2, d / 2, y0, y0 + h);
  return m;
}
const deco = (x, z, w, d, h, color, y0 = 0) => B(x, z, w, d, h, color, y0, false);
const flat = (x, z, w, d, color, y = 0.02) => { const [wx, wz] = L(x, z); return K.box(w, 0.04, d, color, wx, y, wz, root, false); };
const ROADS = [-96, -48, 0, 48, 96], BLOCKS = [-72, -24, 24, 72], RW = 8, RC = 14; // RC = jari-jari tikungan jalan lingkar luar
// bentuk membulat (silinder, kerucut, bola, kubah, atap limas): geometri bersama sehingga ikut digabung seperti kotak
const GEO = {};
function geo(k) {
  if (GEO[k]) return GEO[k];
  const g = { cyl: () => new THREE.CylinderGeometry(0.5, 0.5, 1, 18), cone: () => new THREE.ConeGeometry(0.5, 1, 18), roof: () => new THREE.ConeGeometry(Math.SQRT1_2, 1, 4, 1).rotateY(Math.PI / 4),
    sph: () => new THREE.SphereGeometry(0.5, 14, 10), dome: () => new THREE.SphereGeometry(0.5, 18, 8, 0, TAU, 0, Math.PI / 2),
    tri: () => new THREE.ExtrudeGeometry(new THREE.Shape([new THREE.Vector2(-0.5, 0), new THREE.Vector2(0.5, 0), new THREE.Vector2(0, -1)]), { depth: 0.04, bevelEnabled: false }).translate(0, 0, -0.02) }[k]();
  g.userData.batch = true; return (GEO[k] = g);
}
function S(k, sx, sy, sz, color, x, y, z, parent = root, shadow = true) {
  const m = new THREE.Mesh(geo(k), typeof color === 'string' ? K.mat(color) : color); m.scale.set(sx, sy, sz); m.position.set(x, y, z);
  m.castShadow = shadow; m.receiveShadow = true; parent.add(m); return m;
}
// koordinat lokal kota, y0 = alas benda (kubah: alas di y0, tinggi sy)
const SL = (k, x, z, sx, sy, sz, color, y0 = 0) => { const [wx, wz] = L(x, z); return k === 'dome' ? S(k, sx, sy * 2, sz, color, wx, y0, wz) : S(k, sx, sy, sz, color, wx, y0 + sy / 2, wz); };
// pohon bulat (batang + tajuk bola)
function treeR(x, z, s = 1, col = '#47a84d') { SL('cyl', x, z, 0.45 * s, 2.2 * s, 0.45 * s, '#8a5a35'); SL('sph', x, z, 2.6 * s, 2.3 * s, 2.6 * s, col, 1.8 * s); SL('sph', x + 0.5 * s, z - 0.3 * s, 1.5 * s, 1.4 * s, 1.5 * s, '#5cbf5c', 3.4 * s); addSolid(...L(x, z), 0.3 * s, 0.3 * s, 0, 2); }
// jalur persegi bersudut membulat (jalan lingkar, bus, kereta): d = jarak tempuh -> [x, z, yaw]
function rrPoint(r, rc, d) {
  const s = 2 * (r - rc), a = (Math.PI / 2) * rc, seg = s + a, P = 4 * seg; d = ((d % P) + P) % P;
  const k = Math.floor(d / seg), u = d - k * seg; let x, z, yaw;
  if (u < s) { x = -r + rc + u; z = -r; yaw = Math.PI / 2; } else { const th = (u - s) / rc; x = r - rc + Math.sin(th) * rc; z = -(r - rc) - Math.cos(th) * rc; yaw = Math.PI / 2 - th; }
  for (let i = 0; i < k; i++) { [x, z] = [-z, x]; yaw -= Math.PI / 2; }
  return [x, z, yaw];
}
const rrLen = (r, rc) => 4 * (2 * (r - rc) + (Math.PI / 2) * rc);
// jarak titik ke garis jalur bersudut membulat
function rrDist(r, rc, x, z) { const qx = Math.abs(x) - (r - rc), qz = Math.abs(z) - (r - rc); return Math.abs(Math.hypot(Math.max(qx, 0), Math.max(qz, 0)) + Math.min(Math.max(qx, qz), 0) - rc); }
// bentuk pulau superelips untuk tanah (pasir, rumput)
function seShape(a, n = W.CITY.n, seg = 200) {
  const sh = new THREE.Shape();
  for (let i = 0; i <= seg; i++) { const t = (i / seg) * TAU, c = Math.cos(t), sn = Math.sin(t); const x = a * Math.sign(c) * Math.abs(c) ** (2 / n), y = a * Math.sign(sn) * Math.abs(sn) ** (2 / n); if (i) sh.lineTo(x, y); else sh.moveTo(x, y); }
  return sh;
}
// bukit terowongan kereta (sisi timur)
const HILL = { x: 108.5, z: 35, rx: 8.3, rz: 16, h: 11 };
const inHill = (x, z, m = 0) => ((x - HILL.x) / (HILL.rx + m)) ** 2 + ((z - HILL.z) / (HILL.rz + m)) ** 2 < 1;

/* ---------------- gedung tinggi dengan jendela (menyala saat malam) ---------------- */
// fancy = gedung pengisi: sudut membulat + atap bervariasi (limas, bertingkat, kubah kaca, taman atap, tandon air)
function tower(x, z, w, d, h, color, roofCol = '#4a4f5c', fancy = false) {
  B(x, z, w, d, h, color, 0, true);
  for (let y = 2.2; y < h - 1.2; y += 3) {
    deco(x, z + d / 2 + 0.03, w * 0.86, 0.06, 1.3, windowMat, y); deco(x, z - d / 2 - 0.03, w * 0.86, 0.06, 1.3, windowMat, y);
    deco(x + w / 2 + 0.03, z, 0.06, d * 0.86, 1.3, windowMat, y); deco(x - w / 2 - 0.03, z, 0.06, d * 0.86, 1.3, windowMat, y);
  }
  if (!fancy) {
    deco(x, z, w + 0.4, d + 0.4, 0.4, roofCol, h);
    if (h > 25) { deco(x + w * 0.2, z, 1.2, 1.2, 1, '#9aa7b4', h + 0.4); deco(x - w * 0.25, z + d * 0.2, 0.15, 0.15, 4, '#c8ccd6', h + 0.4); }
    return;
  }
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) SL('cyl', x + sx * w / 2, z + sz * d / 2, 1, h, 1, color);
  const m = Math.min(w, d), st = h < 13 ? (Math.random() < 0.65 ? 'limas' : 'taman') : pick(['tingkat', 'kubah', 'taman', 'tandon']);
  if (st === 'limas') { deco(x, z, w + 0.6, d + 0.6, 0.3, '#ffffff', h); SL('roof', x, z, w + 1.4, m * 0.42, d + 1.4, roofCol, h + 0.3); return; }
  deco(x, z, w + 0.4, d + 0.4, 0.4, st === 'taman' ? '#5fb953' : roofCol, h);
  if (st === 'tingkat') { const th = Math.round(h * 0.14) + 2; B(x, z, w * 0.62, d * 0.62, th, color, h + 0.4); deco(x, z + d * 0.31 + 0.03, w * 0.5, 0.06, th * 0.5, windowMat, h + 1.2); deco(x, z, w * 0.66, d * 0.66, 0.35, roofCol, h + 0.4 + th); SL('cone', x, z, 1.4, 5, 1.4, '#c8ccd6', h + 0.75 + th); }
  else if (st === 'kubah') SL('dome', x, z, m * 0.78, m * 0.34, m * 0.78, '#7cc8f5', h + 0.4);
  else if (st === 'taman') for (let i = 0; i < 4; i++) SL('sph', x + (i % 2 ? 1 : -1) * w * 0.25, z + (i < 2 ? 1 : -1) * d * 0.25, 2, 1.6, 2, i % 2 ? '#3fae4f' : '#ff8fc0', h + 0.4);
  else { SL('cyl', x + w * 0.2, z, 2.2, 2.2, 2.2, '#9aa7b4', h + 0.4); SL('cone', x + w * 0.2, z, 2.4, 0.8, 2.4, '#7a8590', h + 2.6); deco(x - w * 0.25, z + d * 0.2, 0.15, 0.15, 4, '#c8ccd6', h + 0.4); }
}
// gedung bulat: badan silinder + pita kaca + kubah & puncak runcing
function towerRound(x, z, r, h, color) {
  SL('cyl', x, z, r * 2, h, r * 2, color);
  for (let y = 2.2; y < h - 1.2; y += 3) SL('cyl', x, z, r * 2 + 0.1, 1.3, r * 2 + 0.1, windowMat, y);
  SL('cyl', x, z, r * 2 + 0.5, 0.4, r * 2 + 0.5, '#4a4f5c', h); SL('dome', x, z, r * 1.7, r * 0.6, r * 1.7, '#7cc8f5', h + 0.4); SL('cone', x, z, 0.6, 5, 0.6, '#c8ccd6', h + 0.3 + r * 0.6);
  const [wx, wz] = L(x, z); addSolid(wx, wz, r * 0.76, r * 0.76, 0, h + 0.4); addSolid(wx, wz, r * 0.76, r * 0.76, 0, h + 0.4, Math.PI / 4);
}
const TOWER_COLS = ['#d8d2c4', '#c9d6e3', '#e8d9c3', '#b8c4d0', '#e3c9b8', '#cfd8c4', '#d6c8dc'];

/* ---------------- loket kegiatan (meja + atap + papan + penjaga) ---------------- */
function counter(x, z, face, col, label, npc) {
  // face: arah hadap loket (0 = menghadap +z lokal)
  const f = frame(...L(x, z), face);
  f.solid(0, 0, 3.4, 0.9, 0, 1.05, col); f.deco(0, 0, 3.6, 1.1, 1.05, 0.08, '#ffffff', f.g, false);
  for (const sx of [-1.7, 1.7]) f.deco(sx, -0.9, 0.14, 0.14, 0, 2.9, '#8a5a35', f.g, false);
  for (let i = 0; i < 5; i++) f.deco(-1.6 + i * 0.8, -0.5, 0.8, 1.8, 2.8, 0.18, i % 2 ? '#ffffff' : col, f.g, false);
  const sp = sign(label, 4.6, { bg: '#ffffff' }); putW(f, sp, 0, 3.8, -0.4, CDYN);
  const spot = f.W(0, 1.6);
  if (npc) addNpc({ ...npc, x: f.W(0, -0.9), face, y: 0 });
  return { x: spot[0], z: spot[1], face };
}
export const SPOTS = {}; // loket kegiatan: { x, z, kind }
// taruh benda di koordinat lokal sebuah bingkai, tapi ke grup berkoordinat dunia
function putW(f, obj, lx, y, lz, parent) { const [x, z] = f.W(lx, lz); obj.position.set(x, y, z); parent.add(obj); return obj; }

/* =========================================================
   BUS KOTA: 2 bus mengelilingi jalan tengah, berhenti di 8 halte
   ========================================================= */
const BUS = { R: 50, rc: 7, speed: 9, dwell: 6, price: 2, stops: [], seg: [], T: 0 };
BUS.side = 2 * (BUS.R - BUS.rc) + (Math.PI / 2) * BUS.rc; BUS.len = 4 * BUS.side;
// halte di bagian lurus: [sisi, jarak dari ujung sisi]
const STOP_D = [[0, 26], [0, 74], [1, 26], [1, 74], [2, 26], [2, 74], [3, 26], [3, 74]].map(([k, u]) => k * BUS.side + u - BUS.rc);
const STOP_NAMES = ['Alun-alun', 'Mall Kota', 'Restoran', 'Bianglala', 'Perpustakaan', 'Taman Kota', 'Teater', 'Rumah Sakit'];
const SIDE_N = [[0, -1], [1, 0], [0, 1], [-1, 0]];
function rectPoint(d) {
  const [x, z, yaw] = rrPoint(BUS.R, BUS.rc, d), k = Math.floor((((d % BUS.len) + BUS.len) % BUS.len) / BUS.side);
  return { x, z, yaw, nx: SIDE_N[k][0], nz: SIDE_N[k][1] };
}
function busState(t) {
  let u = ((t % BUS.T) + BUS.T) % BUS.T;
  for (let i = 0; i < 8; i++) {
    const s = BUS.seg[i];
    if (u < BUS.dwell) return { d: STOP_D[i], stop: i, next: i };
    u -= BUS.dwell;
    if (u < s.dur) return { d: STOP_D[i] + s.dist * ease(u / s.dur), stop: -1, next: (i + 1) % 8 };
    u -= s.dur;
  }
  return { d: STOP_D[0], stop: 0, next: 0 };
}
const BUS_SEATS = [[0.55, 0.45, 2.6], [-0.55, 0.45, 2.6], [0.55, 0.45, 0.8], [-0.55, 0.45, 0.8], [0.55, 0.45, -1.0], [-0.55, 0.45, -1.0]];
function makeBus(col) {
  const g = new THREE.Group();
  K.box(2.6, 0.9, 10, col, 0, 0.85, 0, g); g.userData.roof = K.box(2.6, 0.5, 10, col, 0, 2.95, 0, g); K.box(2.62, 0.18, 10.02, '#3a7cf5', 0, 1.4, 0, g, false);
  const gl = new THREE.Mesh(K.BOX, glassMat); gl.scale.set(2.56, 1.4, 9.9); gl.position.y = 2.0; g.add(gl);
  for (const z of [-4.9, -1.6, 1.6, 4.9]) for (const sx of [-1.27, 1.27]) K.box(0.08, 1.4, 0.18, col, sx, 2.0, z, g, false);
  K.box(2.5, 0.1, 9.8, '#6b7380', 0, 1.0, 0, g, false);
  for (const z of [-3.4, 3.4]) for (const sx of [-1.25, 1.25]) K.box(0.4, 0.8, 0.8, '#1d1d1d', sx, 0.4, z, g, false);
  K.box(1.8, 0.4, 0.06, '#1d2b53', 0, 2.95, 5.02, g, false); K.box(0.4, 0.25, 0.06, '#fff3a0', -0.9, 0.9, 5.02, g, false); K.box(0.4, 0.25, 0.06, '#fff3a0', 0.9, 0.9, 5.02, g, false);
  for (const [x, , z] of BUS_SEATS) K.box(0.8, 0.45, 0.6, '#e8434b', x, 1.25, z - 0.1, g, false);
  return g;
}
function buildBus() {
  // jadwal: berhenti 6 detik di tiap halte, lalu jalan ke halte berikutnya
  BUS.seg = STOP_D.map((d, i) => { const dist = (STOP_D[(i + 1) % 8] - d + BUS.len) % BUS.len || BUS.len; return { dist, dur: dist / BUS.speed }; });
  BUS.T = BUS.seg.reduce((t, s) => t + BUS.dwell + s.dur, 0);
  STOP_D.forEach((d, i) => {
    const p = rectPoint(d), wx = p.x + p.nx * 4.4, wz = p.z + p.nz * 4.4, sx = p.x + p.nx * 6.2, sz = p.z + p.nz * 6.2;
    const f = frame(...L(sx, sz), Math.atan2(-p.nx, -p.nz)); // halte menghadap jalan
    f.deco(0, 0, 4, 1.4, 2.6, 0.12, '#3a7cf5'); for (const x of [-1.8, 1.8]) f.deco(x, -0.5, 0.12, 0.12, 0, 2.6, '#c8ccd6', f.g, false);
    f.deco(0, -0.65, 4, 0.06, 0.6, 1.8, glassMat, f.g, false); f.solid(0, -0.2, 3, 0.5, 0, 0.45, '#a5764a');
    const sp = sign(`🚏 Halte ${STOP_NAMES[i]}`, 3.4, { bg: '#ffd23a' }); putW(f, sp, 0, 3.4, 0, CDYN);
    const [ox, oz] = L(wx, wz); BUS.stops.push({ i, name: STOP_NAMES[i], x: ox, z: oz });
  });
  BUS.cars = [0, 0.5].map((off, k) => { const m = makeBus(k ? '#ffb300' : '#3fb25a'); CDYN.add(m); return { off: off * BUS.T, m }; });
}
function busPose(b, t) {
  const st = busState(t + b.off), p = rectPoint(st.d); const [x, z] = L(p.x, p.z);
  return { x, z, yaw: p.yaw, stop: st.stop, next: st.next };
}

/* =========================================================
   KAPAL FERRY: Pulau Balok <-> Pulau Kota (dibayar koin)
   ========================================================= */
const FERRY = { price: 5, dwell: 15, speed: 7, sides: [], T: 0, travel: 0 };
const FERRY_SEATS = [[1.0, -0.2, 2], [-1.0, -0.2, 2], [1.0, -0.2, 0], [-1.0, -0.2, 0], [1.0, -0.2, -2], [-1.0, -0.2, -2]];
function makeFerry() {
  const g = new THREE.Group();
  K.box(5, 1.4, 16, '#ffffff', 0, -0.4, 0, g); K.box(5.02, 0.3, 16.02, '#1d4f91', 0, -0.9, 0, g); K.box(5.04, 0.2, 16.04, '#e8434b', 0, 0.15, 0, g);
  K.box(3.6, 1.0, 2.2, '#ffffff', 0, -0.2, 8.6, g); K.box(4.8, 0.1, 15.6, '#c98f4f', 0, 0.32, 0, g);
  K.box(3.6, 2.2, 3.4, '#f4ecd8', 0, 1.45, -5.2, g); K.box(4, 0.3, 3.8, '#3a7cf5', 0, 2.7, -5.2, g); K.box(3.62, 0.6, 3.42, '#bfe6ff', 0, 1.9, -5.2, g, false);
  K.box(0.5, 1.6, 0.5, '#e8434b', 0, 3.6, -5.6, g); K.box(0.06, 0.6, 1.0, '#ffd23a', 0, 4.6, -5.0, g, false);
  for (const sx of [-2.4, 2.4]) K.box(0.1, 0.8, 15, '#ffffff', sx, 0.75, 0, g, false);
  for (const [x, , z] of FERRY_SEATS) K.box(1.2, 0.4, 0.6, '#3a7cf5', x, 0.55, z - 0.2, g, false);
  const nm = sign('⛴️ KM Kota', 3, { bg: '#ffffff' }); nm.position.set(0, 3.8, -5.2); g.add(nm);
  return g;
}
function ferryPort1() {
  // dermaga kapal di utara Pulau Balok: tangga + jembatan tinggi (jetski bisa lewat di bawahnya)
  const p = W.PLACES.pelabuhan, a = Math.atan2(p.z, p.x), P = (r) => [Math.cos(a) * r, Math.sin(a) * r];
  const [cx, cz] = P(110); const f = frame(cx, cz, Math.atan2(-cx, -cz)), TOP = 1.9;
  f.solid(0, 0, 3, 24, 1.6, 0.3, '#c98f4f'); f.solid(0, -11, 8, 6, 1.6, 0.3, '#b07a42');
  for (let z = -12; z <= 10; z += 4.5) f.deco(0, z, 0.4, 0.4, -1.2, 2.8, '#7a5432');
  for (const x of [-1.5, 1.5]) { f.deco(x, 3, 0.12, 18, TOP + 0.8, 0.1, '#ffffff', f.g, false); f.solid(x, 3, 0.15, 18, TOP, 2.2, null); }
  for (const x of [-4, 4]) f.solid(x, -11, 0.2, 6, TOP, 2.2, null);
  for (let i = 0; i < 4; i++) f.solid(0, 12.5 + i, 3, 1, 0, TOP - 0.45 * (i + 1), i % 2 ? '#c98f4f' : '#b07a42');
  f.solid(-2.6, -12.4, 1.6, 0.8, TOP, 1.0, '#3a7cf5');
  const sp = sign('⛴️ Kapal ke Pulau Kota · 🪙 ' + FERRY.price, 5.6, { bg: '#d8f0ff' }); putW(f, sp, 0, TOP + 3.4, -10, DYN_ALWAYS);
  { const [x, z] = f.W(0, -10); closedSign(x, TOP + 2.2, z); }
  const [wx, wz] = f.W(0, -12.6), [dx, dz] = P(126);
  FERRY.sides[0] = { name: 'Pulau Balok', wait: [wx, wz, TOP], dock: [dx, dz] };
  addNpc({ id: 'ferry1', name: 'Pak Sahrul', role: 'Petugas Kapal', x: f.W(-2.6, -13.2), y: TOP, face: Math.atan2(-cx, -cz) + Math.PI, shirt: '#1d2b53', pants: '#2c2f3a', hat: 'nelayan', pitch: -0.3,
    lines: [`Kapal ke Pulau Kota berangkat setiap sebentar. Ongkosnya ${FERRY.price} koin. Tunggu kapal merapat, lalu ketuk Naik!`, 'Di Pulau Kota ada bus, bianglala, toko topi, dan bioskop!', 'Koin didapat dari belajar di Pulau Balok, ya.'] });
}
function ferryPort2() {
  // dermaga di selatan Pulau Kota
  for (let z = -112; z >= -128; z -= 2) deco(30, z, 3, 1.9, 0.18, z % 4 ? '#b58552' : '#a57745', 0.03);
  addSolid(...L(30, -120), 1.5, 9, -1, 0.21);
  for (const x of [28.3, 31.7]) addSolid(...L(x, -120), 0.1, 9, 0.21, 2.2);
  for (let z = -114; z >= -126; z -= 4) for (const x of [28.4, 31.6]) deco(x, z, 0.25, 0.25, 2.3, '#7a5432', -1.1);
  const [wx, wz] = L(30, -126.5), [dx, dz] = L(30, -131.5);
  FERRY.sides[1] = { name: 'Pulau Kota', wait: [wx, wz, 0.21], dock: [dx, dz] };
}
function buildFerry() {
  ferryPort1(); ferryPort2();
  const [a, b] = FERRY.sides, dist = Math.hypot(b.dock[0] - a.dock[0], b.dock[1] - a.dock[1]);
  FERRY.travel = dist / FERRY.speed; FERRY.T = 2 * (FERRY.dwell + FERRY.travel);
  FERRY.m = makeFerry(); DYN_ALWAYS.add(FERRY.m);
}
// state kapal: docked (0/1) atau berlayar
function ferryState(t) {
  const u = ((t % FERRY.T) + FERRY.T) % FERRY.T, [a, b] = FERRY.sides, D = FERRY.dwell, Tr = FERRY.travel;
  const lerp = (p, q, k) => [p[0] + (q[0] - p[0]) * k, p[1] + (q[1] - p[1]) * k];
  if (u < D) return { at: 0, pos: a.dock, yaw: Math.atan2(b.dock[0] - a.dock[0], b.dock[1] - a.dock[1]), left: D - u };
  if (u < D + Tr) { const k = ease((u - D) / Tr); return { at: -1, to: 1, pos: lerp(a.dock, b.dock, k), yaw: Math.atan2(b.dock[0] - a.dock[0], b.dock[1] - a.dock[1]), left: D + Tr - u }; }
  if (u < 2 * D + Tr) return { at: 1, pos: b.dock, yaw: Math.atan2(a.dock[0] - b.dock[0], a.dock[1] - b.dock[1]), left: 2 * D + Tr - u };
  const k = ease((u - 2 * D - Tr) / Tr); return { at: -1, to: 0, pos: lerp(b.dock, a.dock, k), yaw: Math.atan2(a.dock[0] - b.dock[0], a.dock[1] - b.dock[1]), left: FERRY.T - u };
}

/* =========================================================
   TAMAN HIBURAN: bianglala & komidi putar
   ========================================================= */
const WHEEL = { x: 60, z: 24, y: 14.5, R: 12.5, n: 8, period: 50, price: 3 };
const CAROUSEL = { x: 82, z: 30, R: 3.4, n: 6, period: 14, ride: 30, price: 2 };
function buildFun() {
  // bianglala: roda di bidang y-z, berputar mengelilingi sumbu x
  const [wx, wz] = L(WHEEL.x, WHEEL.z);
  for (const sx of [-1.6, 1.6]) for (const sz of [-1, 1]) { const m = K.box(0.5, 16, 0.5, '#e8434b', wx + sx, 7.5, wz + sz * 4.5, root); m.rotation.x = -sz * 0.29; }
  addSolid(wx, wz, 2, 5, 0, 1.2);
  const wheel = new THREE.Group(); wheel.position.set(wx, WHEEL.y, wz); CDYN.add(wheel);
  for (let i = 0; i < 24; i++) { const a = (i / 24) * TAU; const m = K.box(0.3, 0.3, 3.4, i % 2 ? '#ffd23a' : '#3a7cf5', 0, Math.sin(a) * WHEEL.R, Math.cos(a) * WHEEL.R, wheel, false); m.rotation.x = -a; }
  for (let i = 0; i < 8; i++) { const a = (i / 8) * TAU; const m = K.box(0.2, 0.2, WHEEL.R, '#ffffff', 0, Math.sin(a) * WHEEL.R / 2, Math.cos(a) * WHEEL.R / 2, wheel, false); m.rotation.x = -a; }
  K.box(3.4, 1, 1, '#2c2f3a', 0, 0, 0, wheel, false);
  const cols = ['#e8434b', '#ff8a2a', '#ffd23a', '#3fb25a', '#3a7cf5', '#9a62e0', '#ff8fc0', '#2ec4f0'];
  WHEEL.cabins = cols.map((c) => { const g = new THREE.Group(); K.box(1.8, 1.5, 1.8, c, 0, 0, 0, g, false); K.box(2, 0.15, 2, '#ffffff', 0, 0.85, 0, g, false); K.box(1.82, 0.6, 1.82, '#bfe6ff', 0, 0.2, 0, g, false); CDYN.add(g); return g; });
  WHEEL.g = wheel;
  // panggung naik di bawah roda
  const [px, pz] = L(WHEEL.x + 3.2, WHEEL.z); K.box(3, 0.5, 3, '#a5764a', px, 0.25, pz, root); addSolid(px, pz, 1.5, 1.5, 0, 0.5);
  SPOTS.wheel = { x: px, z: pz, y: 0.5, kind: 'wheel' };
  const sp = sign(`🎡 Bianglala · 🪙 ${WHEEL.price}`, 4, { bg: '#ffd23a' }); sp.position.set(px + 1, 4, pz); CDYN.add(sp);
  // komidi putar
  const [cx, cz] = L(CAROUSEL.x, CAROUSEL.z); const car = new THREE.Group(); car.position.set(cx, 0, cz); CDYN.add(car);
  K.box(8, 0.35, 8, '#ff8fc0', 0, 0.18, 0, car, false); K.box(0.6, 4, 0.6, '#ffd23a', 0, 2, 0, car, false);
  const roof = new THREE.Group(); car.add(roof); CAROUSEL.roof = roof;
  for (let k = 0; k < 4; k++) K.box(8.6 - k * 2, 0.5, 8.6 - k * 2, k % 2 ? '#ffffff' : '#e8434b', 0, 4.2 + k * 0.5, 0, roof, false);
  CAROUSEL.horses = [];
  for (let i = 0; i < CAROUSEL.n; i++) {
    const a = (i / CAROUSEL.n) * TAU, h = new THREE.Group(); h.position.set(Math.cos(a) * CAROUSEL.R, 0, Math.sin(a) * CAROUSEL.R); h.rotation.y = -a; car.add(h);
    K.box(0.12, 4, 0.12, '#ffd23a', 0, 2, 0, h, false); K.box(0.5, 0.7, 1.4, ['#ffffff', '#ffd23a', '#9a62e0'][i % 3], 0, 1.4, 0, h, false); K.box(0.4, 0.6, 0.4, '#ffffff', 0, 1.9, 0.6, h, false);
    CAROUSEL.horses.push(h);
  }
  CAROUSEL.g = car; addSolid(cx, cz, 0.4, 0.4, 0, 4);
  const [sx, sz] = L(CAROUSEL.x - 6.5, CAROUSEL.z); SPOTS.carousel = { x: sx, z: sz, y: 0, kind: 'carousel' };
  const sp2 = sign(`🎠 Komidi Putar · 🪙 ${CAROUSEL.price}`, 4, { bg: '#ff8fc0' }); sp2.position.set(sx, 5.5, sz); CDYN.add(sp2);
}
const wheelAngle = (t, i) => (t / WHEEL.period) * TAU + (i / WHEEL.n) * TAU;
function cabinPos(t, i) { const a = wheelAngle(t, i); const [wx, wz] = L(WHEEL.x, WHEEL.z); return { x: wx, y: WHEEL.y + Math.sin(a) * WHEEL.R - 1.1, z: wz + Math.cos(a) * WHEEL.R }; }

/* =========================================================
   MENARA KOTA: lift berbayar ke dek pandang setinggi 60 m
   ========================================================= */
export const SKY = { price: 3, top: 60 };
function buildSky() {
  const x = 24, z = 26; tower(x, z, 10, 10, SKY.top, '#c9d6e3', '#3a7cf5');
  const [wx, wz] = L(x, z);
  K.box(18, 0.6, 18, '#e9e4d8', wx, SKY.top + 0.3, wz, root); addSolid(wx, wz, 9, 9, SKY.top, SKY.top + 0.6);
  const T = SKY.top + 0.6;
  for (const [ox, oz, w, d] of [[0, 9, 18, 0.2], [0, -9, 18, 0.2], [9, 0, 0.2, 18], [-9, 0, 0.2, 18]]) { K.box(w, 1, d, '#ffffff', wx + ox, T + 0.5, wz + oz, root, false); addSolid(wx + ox, wz + oz, w / 2 + 0.05, d / 2 + 0.05, T, T + 2.3); }
  for (const [ox, oz] of [[5, 6], [-5, 6], [6, -5]]) { K.box(0.2, 1.2, 0.2, '#2c2f3a', wx + ox, T + 0.6, wz + oz, root); K.box(0.4, 0.4, 1, '#2c2f3a', wx + ox, T + 1.4, wz + oz, root); }
  const sp = sign('🏙️ Dek Pandang Menara Kota', 5, { bg: '#d8f0ff' }); sp.position.set(wx, T + 3, wz - 6); CDYN.add(sp);
  const pad = new THREE.Mesh(new THREE.TorusGeometry(1.0, 0.18, 8, 28), new THREE.MeshBasicMaterial({ color: '#7cc8f5' })); pad.rotation.x = -Math.PI / 2; pad.position.set(wx - 5, T + 0.12, wz - 5); CDYN.add(pad);
  const sp2 = sign('⬇️ Turun', 2.4, { bg: '#d8f0ff' }); sp2.position.set(wx - 5, T + 2, wz - 5); CDYN.add(sp2);
  SKY.deck = [wx + 3, wz + 3, T]; SKY.down = [wx - 5, wz - 5, T];
  // loket lift di depan menara
  SPOTS.sky = { ...counter(x, z - 8, Math.PI, '#3a7cf5', `🛗 Lift Menara · 🪙 ${SKY.price}`, { id: 'liftkota', name: 'Mbak Tari', role: 'Penjaga Lift', girl: true, shirt: '#3a7cf5', pants: '#1d2b53', pitch: 0.1, lines: ['Naik lift ke dek pandang, lihat seluruh kota dari atas!', 'Dari atas, bus kota kelihatan kecil sekali!'] }), kind: 'sky' };
}

/* =========================================================
   LALU LINTAS: mobil di jalan lingkar & lampu lalu lintas
   ========================================================= */
export function makeCar(col = '#e8434b') {
  const g = new THREE.Group();
  K.box(1.9, 0.75, 3.8, col, 0, 0.7, 0, g); K.box(1.7, 0.7, 2.0, col, 0, 1.4, -0.2, g); K.box(1.72, 0.45, 2.02, '#bfe6ff', 0, 1.45, -0.2, g, false);
  for (const sx of [-0.9, 0.9]) for (const sz of [-1.2, 1.2]) K.box(0.3, 0.6, 0.6, '#1d1d1d', sx, 0.3, sz, g, false);
  K.box(0.3, 0.2, 0.06, '#fff3a0', -0.6, 0.75, 1.92, g, false); K.box(0.3, 0.2, 0.06, '#fff3a0', 0.6, 0.75, 1.92, g, false);
  return g;
}
const TRAFFIC = [];
function buildTraffic() {
  ['#e8434b', '#3a7cf5', '#ffffff', '#ffd23a', '#3fb25a', '#9a62e0'].forEach((c, i) => {
    const m = makeCar(c); CDYN.add(m); const cw = i % 2 === 0; TRAFFIC.push({ m, r: cw ? 94 : 98, rc: cw ? RC - 2 : RC + 2, dir: cw ? -1 : 1, off: i * 130, speed: 11 });
  });
  // lampu lalu lintas di 9 perempatan tengah
  TRAFFIC.lights = [];
  for (const x of [-48, 0, 48]) for (const z of [-48, 0, 48]) {
    const [wx, wz] = L(x + 4.6, z + 4.6); K.box(0.2, 4, 0.2, '#2c2f3a', wx, 2, wz, root); K.box(0.5, 1.5, 0.5, '#1d1d1d', wx, 4.5, wz, root);
    const ls = ['r', 'y', 'g'].map((c, k) => { const m = new THREE.Mesh(K.BOX, LIGHT[c][1]); m.scale.setScalar(0.32); m.position.set(wx, 5.0 - k * 0.45, wz + 0.26); CDYN.add(m); return { m, c }; });
    TRAFFIC.lights.push({ ls, off: (x + z) * 0.05 });
  }
}

/* =========================================================
   BANGUN KOTA
   ========================================================= */
function buildGround() {
  // pasir pantai + rumput + trotoar + jalan
  const [cx, cz] = L(0, 0);
  const slab = (a, depth, y, color) => { const g = new THREE.ExtrudeGeometry(seShape(a), { depth, bevelEnabled: false }).rotateX(-Math.PI / 2); const m = new THREE.Mesh(g, K.mat(color)); m.position.set(cx, y, cz); m.receiveShadow = true; root.add(m); return m; };
  slab(W.CITY.land, 1.2, -1.2, '#f2d993'); slab(W.CITY.land + 7, 0.6, -1.5, '#e0c27a');
  { const g = new THREE.ShapeGeometry(seShape(111)).rotateX(-Math.PI / 2); const m = new THREE.Mesh(g, K.mat('#67c25a')); m.position.set(cx, 0.01, cz); m.receiveShadow = true; root.add(m); }
  for (const bx of BLOCKS) for (const bz of BLOCKS) flat(bx, bz, 40, 40, '#cfd3d8', 0.03);
  const road = K.mat('#3d4250'), E = 96 - RC; // jalan lingkar luar lurus sampai ±E lalu menikung
  for (const r of ROADS) { const outer = Math.abs(r) === 96, len = outer ? 2 * E : 200; flat(r, 0, RW, len, '#3d4250', 0.05); flat(0, r, len, RW, '#3d4250', 0.05); }
  for (const [sx, sz] of [[1, 1], [-1, 1], [-1, -1], [1, -1]]) {
    const fa = Math.atan2(sz, sx) - Math.PI / 4, [ox, oz] = L(sx * E, sz * E);
    const ring = new THREE.Mesh(new THREE.RingGeometry(RC - RW / 2, RC + RW / 2, 24, 1, -fa - Math.PI / 2, Math.PI / 2).rotateX(-Math.PI / 2), road); ring.position.set(ox, 0.05, oz); ring.receiveShadow = true; root.add(ring);
    for (let k = 1; k < 6; k++) { const f = fa + (k / 6) * (Math.PI / 2); const m = K.box(0.25, 0.04, 2.4, '#ffffff', ox + Math.cos(f) * RC, 0.08, oz + Math.sin(f) * RC, root, false); m.rotation.y = -f; }
    for (const k of [1, 2]) { const f = fa + (k / 3) * (Math.PI / 2), lx = ox + Math.cos(f) * (RC + 5), lz = oz + Math.sin(f) * (RC + 5); K.box(0.2, 4, 0.2, '#2c2f3a', lx, 2, lz, root); K.box(0.6, 0.15, 0.6, '#2c2f3a', lx, 4.05, lz, root); lamps.push([lx, lz]); }
  }
  // marka jalan putus-putus & zebra cross
  for (const r of ROADS) for (let t = -98; t < 98; t += 6) {
    if (ROADS.some((q) => Math.abs(q - t - 1.5) < 5)) continue;
    if (Math.abs(r) === 96 && Math.abs(t + 1.5) > E - 2) continue;
    flat(r, t + 1.5, 0.25, 2.4, '#ffffff', 0.08); flat(t + 1.5, r, 2.4, 0.25, '#ffffff', 0.08);
  }
  for (const x of [-48, 0, 48]) for (const z of [-48, 0, 48]) for (let k = -3; k <= 3; k++) {
    flat(x + k * 1.1, z - 5.5, 0.6, 2.2, '#ffffff', 0.09); flat(x + k * 1.1, z + 5.5, 0.6, 2.2, '#ffffff', 0.09);
    flat(x - 5.5, z + k * 1.1, 2.2, 0.6, '#ffffff', 0.09); flat(x + 5.5, z + k * 1.1, 2.2, 0.6, '#ffffff', 0.09);
  }
  // lampu jalan di trotoar
  for (const r of [-52, 52]) for (let t = -84; t <= 84; t += 24) for (const [x, z] of [[r, t], [t, r]]) {
    const [wx, wz] = L(x, z); K.box(0.2, 4, 0.2, '#2c2f3a', wx, 2, wz, root); K.box(0.6, 0.15, 0.6, '#2c2f3a', wx, 4.05, wz, root); lamps.push([wx, wz]);
  }
  for (const r of [-101, 101]) for (let t = -60; t <= 60; t += 30) for (const [x, z] of [[r, t], [t, r]]) {
    if (inHill(x, z, 1)) continue; const [wx, wz] = L(x, z); K.box(0.2, 4, 0.2, '#2c2f3a', wx, 2, wz, root); K.box(0.6, 0.15, 0.6, '#2c2f3a', wx, 4.05, wz, root); lamps.push([wx, wz]);
  }
  for (const [x, z] of [[0, -96], [0, 96], [-96, 0], [96, 0]]) flat(x + 2.6, z + 2.6, 1.4, 1.4, '#1d1d1d', 0.1);
  for (const x of [-48, 0, 48]) for (const z of [-48, 0, 48]) { flat(x + 6.5, z + 6.5, 1.5, 1.5, '#4a4f5c', 0.1); flat(x + 6.5, z + 6.5, 1.1, 1.1, '#2c2f3a', 0.11); } // tutup gorong-gorong
}
// pohon kelapa & payung pantai di sepanjang pesisir
function buildBeach() {
  const n = W.CITY.n, a = 112.5; let k = 0;
  for (let i = 0; i < 64; i++) {
    const t = (i / 64) * TAU + 0.05, c = Math.cos(t), sn = Math.sin(t), x = a * Math.sign(c) * Math.abs(c) ** (2 / n), z = a * Math.sign(sn) * Math.abs(sn) ** (2 / n);
    if ((x > 14 && x < 46 && z < -95) || (x < -100 && z > 28 && z < 78) || inHill(x, z, 3) || rrDist(TRAIN.r, TRAIN.rc, x, z) < 4.5) continue;
    const [wx, wz] = L(x, z); if (W.hitsSolid(wx, wz, 1.2, 1.2, 0.5)) continue;
    const ax = Math.abs(x) > Math.abs(z) ? Math.sign(x) : 0, az = ax ? 0 : Math.sign(z); // arah ke laut
    const tr = S('cyl', 0.45, 6.2, 0.45, '#9a6b3f', wx, 3.0, wz); tr.rotation.set(az * 0.12, 0, -ax * 0.12);
    const tx = wx + ax * 0.75, tz = wz + az * 0.75;
    for (let j = 0; j < 5; j++) { const f = (j / 5) * TAU + i; const m = S('sph', 3.4, 0.45, 1.1, j % 2 ? '#3fae4f' : '#2f9a45', tx + Math.cos(f) * 1.4, 6.0, tz + Math.sin(f) * 1.4); m.rotation.set(0, -f, -0.35); }
    for (let j = 0; j < 3; j++) S('sph', 0.45, 0.45, 0.45, '#7a5432', tx + Math.cos(j * 2.1) * 0.4, 5.7, tz + Math.sin(j * 2.1) * 0.4);
    addSolid(wx, wz, 0.3, 0.3, 0, 5);
    if (k++ % 3 === 1) { // payung pantai + tikar
      const px = wx - ax * 0.5 + az * 3, pz = wz - az * 0.5 + ax * 3, col = pick(['#e8434b', '#3a7cf5', '#ffd23a', '#ff8fc0']);
      S('cyl', 0.1, 2.6, 0.1, '#ffffff', px, 1.3, pz); S('cone', 3.2, 0.9, 3.2, col, px, 2.9, pz); K.box(1.4, 0.04, 2.2, pick(['#ffffff', '#7cc8f5', '#ffd23a']), px + 1.2, 0.03, pz, root, false);
    }
  }
}
// zona aman kota: lingkaran hijau saat malam
const safeRings = [];
function safeZone(id, x, z, r) {
  const [wx, wz] = L(x, z); safeSpots.push({ id, x: wx, z: wz, r });
  const m = new THREE.Mesh(new THREE.RingGeometry(r - 0.6, r, 48), new THREE.MeshBasicMaterial({ color: '#3fd16a', transparent: true, opacity: 0.85, side: THREE.DoubleSide }));
  m.rotation.x = -Math.PI / 2; m.position.set(wx, 0.15, wz); m.visible = false; CDYN.add(m); safeRings.push(m);
}
function buildPlazas() {
  // Alun-alun + air mancur (zona aman)
  { const x = -24, z = -24; flat(x, z, 36, 36, '#e9dcbc', 0.05);
    for (let i = 0; i < 24; i++) { const a = (i / 24) * TAU; B(x + Math.cos(a) * 5.5, z + Math.sin(a) * 5.5, 1.5, 1.5, 0.7, '#b9b3a6'); }
    const [wx, wz] = L(x, z); addSolid(wx, wz, 5, 5, 0, 0.7); const water = new THREE.Mesh(new THREE.CylinderGeometry(5, 5, 0.1, 32), new THREE.MeshLambertMaterial({ color: '#4cb4ea' })); water.position.set(wx, 0.62, wz); root.add(water);
    B(x, z, 1.2, 1.2, 3, '#e9e4d8', 0.6);
    const jets = []; for (let i = 0; i < 6; i++) { const a = (i / 6) * TAU; const j = new THREE.Mesh(K.BOX, new THREE.MeshLambertMaterial({ color: '#bfe8ff', transparent: true, opacity: 0.7 })); j.scale.set(0.2, 2, 0.2); j.position.set(wx + Math.cos(a) * 3, 1.6, wz + Math.sin(a) * 3); CDYN.add(j); jets.push(j); }
    K.animated.push({ obj: jets[0], fn: (t) => jets.forEach((j, i) => { const h = 1.6 + Math.sin(t * 3 + i) * 0.5; j.scale.y = h; j.position.y = 0.7 + h / 2; }) });
    for (const [bx, bz] of [[-12, 0], [12, 0]]) B(x + bx, z + bz, 0.6, 2.4, 0.45, '#a5764a', 0, true);
    safeZone('alun', x, z, 13); place('alun', 'Alun-alun', '⛲', x, z, x, z + 12); }
  // Tugu Kota (zona aman)
  { const x = -24, z = 24; flat(x, z, 34, 34, '#d9cba8', 0.05);
    B(x, z, 6, 6, 1, '#cbbd99', 0, true); B(x, z, 2.4, 2.4, 14, '#f4ecd8', 1, true); B(x, z, 3, 3, 1.4, '#ffd23a', 15); B(x, z, 1.4, 1.4, 2, '#ffd23a', 16.4);
    for (const [fx, fz] of [[-8, -8], [8, -8], [-8, 8], [8, 8]]) { B(x + fx, z + fz, 0.15, 0.15, 6, '#d0d0d0'); deco(x + fx + 0.7, z + fz, 1.3, 0.06, 0.45, '#e8434b', 5.3); deco(x + fx + 0.7, z + fz, 1.3, 0.06, 0.45, '#ffffff', 4.85); }
    safeZone('tugu', x, z, 12); place('tugu', 'Tugu Kota', '🗽', x, z, x - 15, z); }
  // Taman Kota: pohon, kolam, ayunan, kios es krim (zona aman)
  { const x = -24, z = 72; flat(x, z, 38, 38, '#5fb953', 0.05);
    for (let i = 0; i < 14; i++) { const a = (i / 14) * TAU, r = 15 + (i % 2) * 2; const tx = x + Math.cos(a) * r, tz = z + Math.sin(a) * r;
      treeR(tx, tz, 1, i % 2 ? '#3fae4f' : '#47a84d'); }
    flat(x + 4, z - 4, 10, 7, '#4cb4ea', 0.07);
    B(x + 7, z + 6, 3, 0.6, 0.45, '#a5764a', 0, true);
    safeZone('taman', x, z, 13); place('taman', 'Taman Kota', '🌳', x, z, x, z - 15);
    SPOTS.icecream = { ...counter(x + 10, z - 10, Math.PI * 0.75, '#ff8fc0', '🍦 Es Krim · 🪙 1', { id: 'eskota', name: 'Bu Wati', role: 'Penjual Es Krim', girl: true, shirt: '#ffffff', pants: '#ff8fc0', pitch: 0.12 }), kind: 'icecream' }; }
}
function buildBlocks() {
  // gedung pengisi di sudut-sudut blok (bentuk kota)
  const fill = (bx, bz, n = 4, hmin = 12, hmax = 34) => {
    const corners = [[-12, -12], [12, -12], [-12, 12], [12, 12]];
    for (let i = 0; i < n; i++) { const [ox, oz] = corners[i]; tower(bx + ox, bz + oz, 12, 12, randi(hmin, hmax), pick(TOWER_COLS), pick(['#4a4f5c', '#b5523b', '#3a5f9e']), true); }
  };
  for (const [ox, oz] of [[-12, -12], [-12, 12], [12, 12]]) { const h = randi(14, 40); if (oz > 0 && ox < 0) towerRound(-72 + ox, 72 + oz, 5.6, h + 8, pick(TOWER_COLS)); else tower(-72 + ox, 72 + oz, 12, 12, h, pick(TOWER_COLS), pick(['#4a4f5c', '#b5523b', '#3a5f9e']), true); }
  fill(24, 72, 1, 8, 14);
  // Pemadam kebakaran
  { const x = -72, z = -72; tower(x, z - 6, 22, 14, 8, '#e8434b', '#ffffff'); for (const sx of [-6, 0, 6]) deco(x + sx, z + 1.05, 4.4, 0.1, 4.6, '#ffd23a');
    const t = makeCar('#e8434b'); t.scale.set(1.3, 1.3, 1.6); const [tx, tz] = L(x - 6, z + 8); t.position.set(tx, 0, tz); root.add(t); addSolid(tx, tz, 1.3, 3, 0, 2);
    const sp = sign('🚒 Pemadam Kebakaran', 5, { bg: '#ffd23a' }); const [sx, sz] = L(x, z + 1); sp.position.set(sx, 10, sz); CDYN.add(sp);
    addNpc({ id: 'damkar', name: 'Pak Bambang', role: 'Pemadam Kebakaran', x: L(x + 4, z + 6), face: 0, shirt: '#ffd23a', pants: '#e8434b', hat: 'tinggi', pitch: -0.35, talk: sirenTalk('🚒', 'Pemadam kebakaran memadamkan api dan menolong orang. Kalau ada kebakaran, telepon 113!') });
    place('damkar', 'Pemadam Kebakaran', '🚒', x, z, x, z + 14); }
  // Kantor polisi
  { const x = -24, z = -72; tower(x, z - 6, 22, 14, 12, '#3a5f9e', '#ffffff');
    const c = makeCar('#ffffff'); const [tx, tz] = L(x + 6, z + 8); c.position.set(tx, 0, tz); root.add(c); addSolid(tx, tz, 1, 2, 0, 1.8); K.box(1.2, 0.25, 0.4, '#3a7cf5', tx, 1.85, tz, root);
    const sp = sign('🚓 Kantor Polisi', 4.6, { bg: '#d8f0ff' }); sp.position.set(L(x, 0)[0], 14, L(0, z + 1)[1]); CDYN.add(sp);
    addNpc({ id: 'polisi', name: 'Pak Polisi Rudi', role: 'Polisi', x: L(x - 4, z + 6), face: 0, shirt: '#3a5f9e', pants: '#1d2b53', hat: 'polisi', pitch: -0.3, talk: sirenTalk('🚓', 'Polisi menjaga keamanan. Kalau tersesat, cari polisi, ya! Ingat: menyeberang lewat zebra cross.') });
    place('polisi', 'Kantor Polisi', '🚓', x, z, x, z + 14); }
  // Terminal pelabuhan kota
  { const x = 24, z = -72; tower(x, z - 4, 20, 12, 7, '#f4ecd8', '#3a7cf5');
    const sp = sign('⛴️ Pelabuhan Kota', 5, { bg: '#d8f0ff' }); sp.position.set(L(x, 0)[0], 10, L(0, z + 3)[1]); CDYN.add(sp);
    place('pelabuhan', 'Pelabuhan Kota', '⛴️', 30, -110, 30, -104);
    addNpc({ id: 'ferry2', name: 'Bu Lastri', role: 'Petugas Kapal', x: L(27, -124), y: 0.21, face: Math.PI, girl: true, shirt: '#1d2b53', pants: '#2c2f3a', hat: 'nelayan', pitch: 0.05,
      lines: [`Kapal ke Pulau Balok berangkat dari ujung dermaga ini. Ongkosnya ${FERRY.price} koin.`, 'Selamat datang di Pulau Kota!'] }); }
  // Sewa mobil
  { const x = 72, z = -72; tower(x + 6, z - 8, 18, 12, 6, '#cfd8c4', '#3fb25a');
    for (const [ox, c] of [[-8, '#e8434b'], [-4, '#3a7cf5'], [0, '#ffd23a']]) { const m = makeCar(c); const [px, pz] = L(x + ox, z + 4); m.position.set(px, 0, pz); root.add(m); addSolid(px, pz, 1, 2, 0, 1.8); }
    const [rx, rz] = L(x + 6, z + 8);
    W.RENT.car = { name: 'Mobil', emoji: '🚗', price: 10, min: 3, x: rx, z: rz, y: 0.12, yaw: 0 };
    const sp = sign('🚗 Sewa Mobil · 🪙 10 · 3 menit', 5.4, { bg: '#ffd23a' }); sp.position.set(rx, 4.2, rz - 2); CDYN.add(sp);
    addNpc({ id: 'sewamobil', name: 'Bang Jaka', role: 'Penyewaan Mobil', x: L(x + 9, z + 7), face: 0, shirt: '#3fb25a', pants: '#2c2f3a', pitch: -0.3, lines: ['Mau keliling kota naik mobil? Sewanya 10 koin. Berdiri di depan sini, lalu ketuk Sewa!', 'Di kota kita menyetir di jalur kiri, ya. Hati-hati di perempatan!'] });
    place('mobil', 'Sewa Mobil', '🚗', x, z, x + 6, z + 12); }
  buildHospital();
  // Restoran
  { const x = 72, z = -24; tower(x, z - 4, 20, 14, 9, '#ffb347', '#e8434b');
    SPOTS.food = { ...counter(x - 4, z + 8, 0, '#ff8a2a', '🍔 Restoran · ❤️ · 🪙 5', { id: 'koki', name: 'Pak Koki Udin', role: 'Koki', shirt: '#ffffff', pants: '#2c2f3a', hat: 'koki', pitch: -0.25 }), kind: 'food' };
    place('restoran', 'Restoran', '🍔', x, z, x - 4, z + 13); }
  buildLibrary();
  addNpc({ id: 'polantas', name: 'Pak Polantas', role: 'Polisi Lalu Lintas', x: L(6.5, -6.5), face: Math.PI * 0.75, shirt: '#ffffff', pants: '#1d2b53', hat: 'polisi', pitch: -0.3, talk: talkTraffic });
  place('bianglala', 'Taman Hiburan', '🎡', 66, 24, 66, 6);
  place('menara', 'Menara Kota', '🏙️', 24, 24, 24, 9);
}
/* ---------------- kegiatan tambahan: kebun binatang, toko stiker, supermarket, polantas, balap, kereta ---------------- */
/* =========================================================
   KEBUN BINATANG NUSANTARA: hewan bergerak di kandang berhabitat, papan info + kuis, kandang elus, pengunjung
   ========================================================= */
// species: dipakai game.js (beri makan, papan info, kuis, suara)
export const ZOO = { animals: [], species: [], all: [], inst: null };
const ZSP = [
  { kind: 'gajah', name: 'Gajah Sumatra', e: '🐘', from: 'Sumatra', slot: [-13, -13], ground: '#d9c08a', n: 2, speed: 0.7, snd: 'gajah',
    facts: ['Gajah adalah hewan darat paling besar. Belalainya untuk minum, mandi, dan mengambil makanan.', 'Gajah Sumatra makan rumput dan daun sampai seharian. Makannya banyak sekali!'],
    quiz: ['Gajah minum memakai apa?', ['👃 Belalai', '🦶 Kaki', '👂 Telinga'], 0] },
  { kind: 'harimau', name: 'Harimau Sumatra', e: '🐅', from: 'Sumatra', slot: [-13, 0], ground: '#4f9a45', n: 1, speed: 1.3, snd: 'auman',
    facts: ['Harimau Sumatra hanya ada di Indonesia. Lorengnya hitam, seperti sidik jari, tidak ada yang sama!', 'Harimau pandai berenang dan suka bermain air.'],
    quiz: ['Harimau Sumatra punya garis apa di badannya?', ['🦓 Loreng hitam', '🔵 Bintik biru', '⭐ Bintang'], 0] },
  { kind: 'orangutan', name: 'Orangutan', e: '🦧', from: 'Kalimantan & Sumatra', slot: [-13, 13], ground: '#3fae4f', n: 2, speed: 0.8, snd: 'monyet',
    facts: ['Orangutan artinya orang hutan. Lengannya panjang sekali untuk berayun di pohon.', 'Orangutan tidur di sarang dari daun yang dibuatnya di atas pohon.'],
    quiz: ['Orangutan suka tinggal di mana?', ['🌳 Pohon', '🌊 Laut', '🏜️ Gurun'], 0] },
  { kind: 'jerapah', name: 'Jerapah & Zebra', e: '🦒', from: 'Afrika', slot: [13, -13], ground: '#e6cf8a', n: 3, speed: 0.9, snd: 'jerapah',
    facts: ['Jerapah punya leher paling panjang, jadi bisa makan daun di pohon yang tinggi!', 'Zebra bergaris hitam putih. Mereka suka berkumpul bersama teman-temannya.'],
    quiz: ['Hewan apa yang lehernya paling panjang?', ['🦒 Jerapah', '🐘 Gajah', '🦓 Zebra'], 0] },
  { kind: 'komodo', name: 'Komodo', e: '🦎', from: 'Nusa Tenggara Timur', slot: [13, 0], ground: '#d8b878', n: 2, speed: 0.5, snd: 'desis',
    facts: ['Komodo adalah kadal paling besar di dunia, dan hanya ada di Indonesia!', 'Komodo menjulurkan lidahnya untuk mencium bau. Lidahnya bercabang dua.'],
    quiz: ['Komodo mencium bau memakai apa?', ['👅 Lidah', '👃 Hidung saja', '👂 Telinga'], 0] },
  { kind: 'pinguin', name: 'Pinguin', e: '🐧', from: 'Kutub Selatan', slot: [0, 13], ground: '#eef6fb', n: 4, speed: 0.9, snd: 'pinguin',
    facts: ['Pinguin adalah burung, tapi tidak bisa terbang. Pinguin jago berenang!', 'Pinguin tinggal di tempat yang sangat dingin dan berjalan megal-megol.'],
    quiz: ['Pinguin itu jago apa?', ['🏊 Berenang', '✈️ Terbang', '🧗 Memanjat'], 0] },
  { kind: 'elus', name: 'Kelinci & Kambing', e: '🐇', from: 'Peternakan', slot: [13, 13], ground: '#7ccf6a', n: 5, speed: 1.0, snd: 'kambing', pet: true,
    facts: ['Kelinci punya telinga panjang dan suka makan wortel. Kambing bersuara mbeee!', 'Elus hewan pelan-pelan, ya. Hewan juga bisa merasa sakit.'],
    quiz: ['Kambing bersuara apa?', ['🐐 Mbeee', '🐄 Mooo', '🐓 Kukuruyuk'], 0] },
];
// model balok hewan; mengembalikan grup + bagian yang bisa digerakkan
function zooModel(kind, sub = 0) {
  const g = new THREE.Group(), P = {}, b = (w, h, d, c, x, y, z, p = g) => K.box(w, h, d, c, x, y, z, p, false);
  const grp = (x, y, z, p = g) => { const q = new THREE.Group(); q.position.set(x, y, z); p.add(q); return q; };
  const legs = (c, xs, zs, h, w = 0.3) => { for (const x of xs) for (const z of zs) b(w, h, w, c, x, h / 2, z); };
  const eyes = (y, z, x = 0.2, p = g) => { for (const s of [-1, 1]) b(0.1, 0.12, 0.05, '#1d1d1d', s * x, y, z, p); };
  if (kind === 'gajah') { const c = '#9aa0a6'; b(2.2, 1.7, 3, c, 0, 2.05, 0); legs('#8a9096', [-0.7, 0.7], [-1, 1], 1.3, 0.6); const h = grp(0, 2.6, 1.6); b(1.5, 1.4, 1.2, c, 0, 0, 0.2, h); for (const s of [-1, 1]) b(0.18, 1.1, 0.9, '#b8bec4', s * 0.85, 0, 0, h); eyes(0.2, 0.81, 0.4, h);
    P.trunk = grp(0, -0.3, 0.75, h); b(0.42, 1.5, 0.42, '#8a9096', 0, -0.7, 0, P.trunk); b(0.16, 0.5, 0.16, '#f4ecd8', 0.45, -0.5, 0.15, h); b(0.16, 0.5, 0.16, '#f4ecd8', -0.45, -0.5, 0.15, h); P.tail = grp(0, 2.4, -1.5); b(0.1, 0.9, 0.1, c, 0, -0.45, 0, P.tail); if (sub) g.scale.setScalar(0.6); }
  else if (kind === 'harimau') { const c = '#ff8a2a'; b(1.1, 1.0, 2.2, c, 0, 1.15, 0); for (let i = 0; i < 4; i++) b(1.12, 1.02, 0.12, '#1d1d1d', 0, 1.2, -0.7 + i * 0.45); legs('#e8761f', [-0.38, 0.38], [-0.8, 0.8], 0.7); const h = grp(0, 1.6, 1.2); b(0.9, 0.8, 0.7, c, 0, 0, 0.1, h); b(0.5, 0.3, 0.2, '#ffffff', 0, -0.2, 0.46, h); eyes(0.12, 0.46, 0.2, h); for (const s of [-1, 1]) b(0.2, 0.2, 0.1, c, s * 0.32, 0.45, 0, h);
    P.head = h; P.tail = grp(0, 1.4, -1.1); b(0.14, 0.14, 1.2, c, 0, 0, -0.6, P.tail); b(0.15, 0.15, 0.25, '#1d1d1d', 0, 0, -1.15, P.tail); }
  else if (kind === 'orangutan') { const c = '#b8561f'; b(0.9, 1.1, 0.7, c, 0, 1.25, 0); b(0.75, 0.7, 0.6, c, 0, 2.15, 0.05); b(0.55, 0.45, 0.15, '#e3a27a', 0, 2.05, 0.36); eyes(2.2, 0.44, 0.13); for (const s of [-1, 1]) { b(0.3, 1.5, 0.3, c, s * 0.62, 1.15, 0); b(0.32, 0.7, 0.32, c, s * 0.25, 0.35, 0); } if (sub) g.scale.setScalar(0.55); }
  else if (kind === 'jerapah' && sub < 2) { const c = '#ffd23a'; b(1.2, 1.2, 2, c, 0, 2.4, 0); legs('#e6b82f', [-0.4, 0.4], [-0.7, 0.7], 1.9); P.head = grp(0, 2.8, 0.8); b(0.5, 3, 0.5, c, 0, 1.4, 0, P.head); b(0.7, 0.6, 1.1, c, 0, 3.1, 0.3, P.head); eyes(3.2, 0.86, 0.2, P.head); for (const s of [-1, 1]) b(0.1, 0.4, 0.1, '#a5764a', s * 0.2, 3.55, 0.1, P.head); for (let i = 0; i < 6; i++) b(0.32, 0.32, 0.05, '#a5764a', (i % 2 ? 0.3 : -0.3), 2.1 + (i % 3) * 0.3, 1.01); if (sub) g.scale.setScalar(0.7); }
  else if (kind === 'jerapah') { const c = '#ffffff'; b(1.0, 1.0, 1.9, c, 0, 1.45, 0); for (let i = 0; i < 5; i++) b(1.02, 1.02, 0.14, '#1d1d1d', 0, 1.45, -0.75 + i * 0.38); legs('#f4f4f4', [-0.33, 0.33], [-0.7, 0.7], 1.0, 0.24); P.head = grp(0, 1.8, 0.9); b(0.42, 1.0, 0.42, c, 0, 0.35, 0.1, P.head); b(0.45, 0.45, 0.85, c, 0, 0.8, 0.4, P.head); b(0.12, 0.6, 0.6, '#1d1d1d', 0, 0.75, 0.0, P.head); eyes(0.95, 0.83, 0.2, P.head); } // zebra
  else if (kind === 'komodo') { const c = '#7a7360'; b(0.9, 0.5, 2.2, c, 0, 0.45, 0); legs('#6b6452', [-0.55, 0.55], [-0.6, 0.6], 0.35, 0.25); P.head = grp(0, 0.5, 1.15); b(0.6, 0.38, 0.8, c, 0, 0, 0.35, P.head); eyes(0.12, 0.6, 0.22, P.head); P.tongue = grp(0, -0.05, 0.75, P.head); b(0.1, 0.03, 0.5, '#ffd23a', 0, 0, 0.25, P.tongue); P.tail = grp(0, 0.45, -1.1); b(0.5, 0.3, 1.8, c, 0, 0, -0.9, P.tail); if (sub) g.scale.setScalar(0.8); }
  else if (kind === 'pinguin') { b(0.7, 0.95, 0.6, '#1d2b53', 0, 0.6, 0); b(0.5, 0.75, 0.1, '#ffffff', 0, 0.55, 0.3); b(0.55, 0.5, 0.5, '#1d2b53', 0, 1.3, 0); b(0.18, 0.1, 0.25, '#ff8a2a', 0, 1.25, 0.35); eyes(1.38, 0.26, 0.13); for (const s of [-1, 1]) { b(0.1, 0.6, 0.35, '#1d2b53', s * 0.4, 0.7, 0); b(0.22, 0.08, 0.3, '#ff8a2a', s * 0.15, 0.04, 0.1); } }
  else if (kind === 'elus' && sub < 3) { const c = sub === 1 ? '#c9a36b' : '#ffffff'; b(0.55, 0.5, 0.75, c, 0, 0.35, 0); b(0.45, 0.42, 0.42, c, 0, 0.7, 0.35); eyes(0.75, 0.57, 0.12); b(0.08, 0.06, 0.04, '#ff8fc0', 0, 0.66, 0.57); for (const s of [-1, 1]) b(0.12, 0.55, 0.1, c, s * 0.12, 1.15, 0.3); b(0.2, 0.2, 0.2, '#ffffff', 0, 0.45, -0.42); }
  else { const c = sub === 4 ? '#8a6a55' : '#f4f4f4'; b(0.8, 0.7, 1.3, c, 0, 0.95, 0); legs('#d8d2c4', [-0.25, 0.25], [-0.45, 0.45], 0.6, 0.18); P.head = grp(0, 1.25, 0.7); b(0.42, 0.45, 0.6, c, 0, 0, 0.2, P.head); eyes(0.08, 0.51, 0.16, P.head); for (const s of [-1, 1]) b(0.08, 0.35, 0.08, '#8a8f99', s * 0.14, 0.35, -0.05, P.head); b(0.1, 0.25, 0.08, '#d8d2c4', 0, -0.32, 0.4, P.head); } // kambing
  return { g, P };
}
function buildZoo() {
  const ZX = 72, ZZ = 72, [cx, cz] = L(ZX, ZZ); ZOO.cx = cx; ZOO.cz = cz;
  flat(ZX, ZZ, 40, 40, '#9be07f', 0.05); flat(ZX, ZZ, 15, 40, '#e9d3a0', 0.07); flat(ZX, ZZ, 40, 3, '#e9d3a0', 0.07);
  // gapura masuk di selatan
  for (const sx of [-5, 5]) { B(ZX + sx, ZZ - 19.4, 1.2, 1.2, 5, '#8a5a35', 0, true); SL('sph', ZX + sx, ZZ - 19.4, 1.4, 1.2, 1.4, '#3fae4f', 5); }
  deco(ZX, ZZ - 19.4, 11.2, 0.8, 1.1, '#3fb25a', 4.2);
  { const sp = sign('🦁 Kebun Binatang Nusantara', 6.2, { bg: '#d8ffe2' }); const [sx, sz] = L(ZX, ZZ - 20); sp.position.set(sx, 6.3, sz); CDYN.add(sp); }
  // air mancur gajah di tengah
  { const [x, z] = L(ZX, ZZ); const water = new THREE.Mesh(new THREE.CylinderGeometry(2.6, 2.6, 0.1, 28), new THREE.MeshLambertMaterial({ color: '#4cb4ea' })); water.position.set(x, 0.55, z); root.add(water);
    for (let i = 0; i < 16; i++) { const a = (i / 16) * TAU; B(ZX + Math.cos(a) * 2.9, ZZ + Math.sin(a) * 2.9, 1, 1, 0.6, '#b9b3a6'); } addSolid(x, z, 3, 3, 0, 0.6);
    const m = zooModel('gajah', 1); m.g.position.set(x, 0.6, z); m.g.rotation.y = Math.PI; root.add(m.g); }
  for (const [i, s] of ZSP.entries()) {
    const [ox, oz] = s.slot, px = ZX + ox, pz = ZZ + oz, [wx, wz] = L(px, pz);
    flat(px, pz, 9.8, 9.8, s.ground, 0.06);
    // pagar (kandang elus: pagar rendah dengan pintu menghadap jalan tengah)
    const side = ox ? -Math.sign(ox) : 0, fh = s.pet ? 0.7 : 1.2;
    // sisi yang menghadap jalan tengah diberi kaca untuk melihat (kandang elus: pintu terbuka)
    for (const [fx, fz, alongX, open] of [[0, -5, true, ox === 0], [0, 5, true, false], [-5, 0, false, ox > 0], [5, 0, false, ox < 0]]) {
      const piece = (c, len, col, h, solid = true) => { const [x, z] = alongX ? [px + fx + c, pz + fz] : [px + fx, pz + fz + c]; const w = alongX ? len : 0.25, d = alongX ? 0.25 : len; if (solid) B(x, z, w, d, h, col, 0, true); else deco(x, z, w, d, h, col); return [x, z, w, d]; };
      if (!open) { const [x, z, w, d] = piece(0, 10, '#a5764a', fh); deco(x, z, w + 0.1, d + 0.1, 0.12, '#ffffff', fh); continue; }
      for (const c of [-3.1, 3.1]) { const [x, z, w, d] = piece(c, 3.8, '#a5764a', fh); deco(x, z, w + 0.1, d + 0.1, 0.12, '#ffffff', fh); }
      if (!s.pet) { const [x, z, w, d] = piece(0, 2.4, '#a5764a', 0.3); deco(x, z, w, d, 1.3, glassMat, 0.3); deco(x, z, w + 0.1, d + 0.1, 0.1, '#ffffff', 1.6); addSolid(...L(x, z), w / 2, d / 2, 0, 1.6); }
    }
    // habitat
    if (s.kind === 'gajah') { flat(px - 2, pz + 2, 4, 3, '#4cb4ea', 0.08); SL('sph', px + 3, pz - 3, 2.4, 1.2, 2, '#9a8a6a', 0); }
    if (s.kind === 'harimau') { SL('sph', px - 2.5, pz - 2.5, 3.4, 1.8, 2.8, '#8a8f99', 0); flat(px + 2.5, pz + 2.5, 3, 3, '#4cb4ea', 0.08); treeR(px + 3.2, pz - 3.2, 0.7, '#2f8a3f'); }
    if (s.kind === 'orangutan') { SL('cyl', px - 2, pz + 2, 0.6, 6, 0.6, '#8a5a35'); SL('sph', px - 2, pz + 2, 4, 2.4, 4, '#2f8a3f', 5.2); deco(px - 2, pz + 2, 2.6, 2.6, 0.25, '#c9a36b', 3.2); SL('cyl', px + 2, pz - 2, 0.12, 4, 0.12, '#c9a36b'); deco(px, pz - 2, 4, 0.1, 0.1, '#c9a36b', 3.9); addSolid(...L(px - 2, pz + 2), 0.4, 0.4, 0, 4); }
    if (s.kind === 'jerapah') { SL('cyl', px + 2.5, pz + 2.5, 0.4, 4, 0.4, '#8a5a35'); SL('cyl', px + 2.5, pz + 2.5, 4.2, 0.6, 4.2, '#5f9a3a', 4); flat(px - 2.5, pz - 2.5, 2.5, 2, '#4cb4ea', 0.08); }
    if (s.kind === 'komodo') { for (const [rx, rz, r] of [[-2.5, 2, 1.6], [2.4, -2.6, 1.2], [2.6, 2.4, 0.9]]) SL('sph', px + rx, pz + rz, r * 2, r, r * 1.6, '#a39a86', 0); }
    if (s.kind === 'pinguin') { flat(px, pz + 1.5, 7, 4, '#2f8fd6', 0.08); for (const [rx, rz] of [[-3, -2.8], [3, -3]]) SL('sph', px + rx, pz + rz, 2, 1.1, 1.6, '#ffffff', 0); }
    if (s.pet) { for (const [rx, rz] of [[-3, 3], [3, 3]]) { const m = deco(px + rx, pz + rz, 1.4, 1, 0.9, '#e6c26b'); } SL('cyl', px - 3, pz - 3, 1.6, 0.4, 1.6, '#a5764a'); for (let k = 0; k < 5; k++) SL('cyl', px - 3.3 + k * 0.15, pz - 3, 0.08, 0.6, 0.08, '#ff8a2a', 0.4); }
    // papan info (dibaca & kuis di game.js)
    const bx = ox ? px - Math.sign(ox) * 5.6 : px + 3.4, bz = ox ? pz + 3.4 : pz - 5.6, face = ox ? (ox > 0 ? -Math.PI / 2 : Math.PI / 2) : Math.PI;
    { const bd = W.kit.board(2.6, 1.5, (q, w, h) => { q.fillStyle = '#fff6df'; q.fillRect(0, 0, w, h); q.strokeStyle = '#3fb25a'; q.lineWidth = 16; q.strokeRect(0, 0, w, h); q.textAlign = 'center'; q.textBaseline = 'middle'; q.font = `120px ${K.FONT}`; q.fillText(s.e, w * 0.2, h / 2); q.fillStyle = '#1d2b53'; q.font = `800 50px ${K.FONT}`; q.fillText(s.name, w * 0.62, h * 0.38); q.font = `600 34px ${K.FONT}`; q.fillStyle = '#5b6b8c'; q.fillText('Asal: ' + s.from, w * 0.62, h * 0.7); }, 512, 296);
      const [qx, qz] = L(bx, bz); bd.position.set(qx, 1.9, qz); bd.rotation.y = face; root.add(bd); K.box(0.12, 1.2, 0.12, '#8a5a35', qx, 0.6, qz, root); }
    const [sx, sz] = L(ox ? bx - Math.sign(ox) * 1.1 : bx, ox ? bz : bz - 1.1); SPOTS['zoo_' + s.kind] = { x: sx, z: sz, kind: 'animal:' + i };
    // hewan
    const list = [];
    for (let k = 0; k < s.n; k++) {
      const m = zooModel(s.kind, k), a = rand(0, TAU), r = rand(0, 2.5); m.g.position.set(wx + Math.cos(a) * r, 0, wz + Math.sin(a) * r); m.g.rotation.y = rand(0, TAU); CDYN.add(m.g);
      const an = { ...m, sp: s, si: i, home: [wx, wz], tgt: null, wait: rand(0, 3), ph: rand(0, 6), speed: s.speed * (s.kind === 'elus' && k > 2 ? 0.8 : 1) * (m.g.scale.x < 0.9 ? 1.2 : 1), jumpT: 0, sub: k, climb: 0 };
      list.push(an); ZOO.all.push(an);
    }
    ZOO.species.push({ ...s, list }); ZOO.animals.push({ kind: s.kind, name: s.name, e: s.e, fact: s.facts[0], g: list[0].g, list, jumpT: 0 });
    // pengunjung di pagar
    for (let k = 0; k < 2; k++) { const off = (k ? 1.8 : -1.8); const [vx, vz] = L(ox ? px - Math.sign(ox) * 6.4 : px + off - 1.5, ox ? pz + off - 1.5 : pz - 6.4); person({ mode: 'stand', x: vx, z: vz, yaw: ox ? (ox > 0 ? Math.PI / 2 : -Math.PI / 2) : 0, act: pick(['photo', 'cheer', 'look', 'clap']), kid: Math.random() < 0.6 }); }
  }
  { const s = ZSP.find((q) => q.pet), [x, z] = L(ZX + s.slot[0] - Math.sign(s.slot[0]) * 3.2, ZZ + s.slot[1]); SPOTS.pet = { x, z, kind: 'pet' }; }
  ZOO.inst = instancer(ZOO.all.map((a) => a.g), CDYN);
  SPOTS.zoo = { ...counter(ZX - 4.5, ZZ - 9, Math.PI / 2, '#3fb25a', '🥕 Beri makan · 🪙 1', { id: 'zoo', name: 'Pak Jono', role: 'Penjaga Kebun Binatang', shirt: '#3fb25a', pants: '#8a5a35', hat: 'caping', pitch: -0.3 }), kind: 'zoo' };
  wanderer(cx - 7.2, cx + 7.2, cz - 19, cz + 19, 10, {}, (x, z) => Math.hypot(x - cx, z - cz) > 3.6 && !W.hitsSolid(x, z, 0.35, 0.35, 0));
  place('zoo', 'Kebun Binatang', '🦁', ZX, ZZ, ZX, ZZ - 16);
}
// hewan berkeliaran di kandang; tiap jenis punya gerak khas
function zooTick(dt, t, P) {
  if (Math.hypot(P.pos.x - ZOO.cx, P.pos.z - ZOO.cz) > 70) return;
  for (const a of ZOO.all) {
    const g = a.g, kind = a.sp.kind; let moving = false;
    a.jumpT = Math.max(0, a.jumpT - dt);
    if (a.called > 0) { a.called -= dt; a.tgt = a.callTo; }
    if (!a.tgt) { if ((a.wait -= dt) <= 0) { const r = rand(0.5, 3.4), q = rand(0, TAU); a.tgt = [a.home[0] + Math.cos(q) * r, a.home[1] + Math.sin(q) * r]; a.wait = rand(2, 6); if (kind === 'orangutan' && Math.random() < 0.4) a.climbT = 6; } }
    else { const dx = a.tgt[0] - g.position.x, dz = a.tgt[1] - g.position.z, d = Math.hypot(dx, dz); if (d < 0.2) { a.tgt = null; } else { const sp = a.speed * (kind === 'elus' && a.sub < 3 ? 1.6 : 1) * dt; g.position.x += (dx / d) * Math.min(sp, d); g.position.z += (dz / d) * Math.min(sp, d); let rd = Math.atan2(dx, dz) - g.rotation.y; rd = Math.atan2(Math.sin(rd), Math.cos(rd)); g.rotation.y += rd * Math.min(1, dt * 4); moving = true; } }
    a.ph += dt * (moving ? 8 : 1.5);
    let y = moving ? Math.abs(Math.sin(a.ph)) * 0.06 : 0;
    if (kind === 'elus' && a.sub < 3 && moving) y = Math.abs(Math.sin(a.ph * 0.8)) * 0.45; // kelinci melompat
    if (kind === 'pinguin') { g.rotation.z = moving ? Math.sin(a.ph) * 0.18 : 0; }
    if (kind === 'orangutan') { a.climbT = Math.max(0, (a.climbT || 0) - dt); a.climb += ((a.climbT > 0 ? 3.0 : 0) - a.climb) * Math.min(1, dt * 1.2); y += a.climb; }
    if (a.jumpT > 0) y += Math.abs(Math.sin(a.jumpT * 7)) * 0.7;
    g.position.y = y;
    const P2 = a.P;
    if (P2.trunk) P2.trunk.rotation.x = Math.sin(t * 1.3 + a.ph) * 0.35 + (a.jumpT > 0 ? -1.2 : 0);
    if (P2.tail) P2.tail.rotation.y = Math.sin(t * 2.4 + a.ph) * 0.5;
    if (P2.tongue) P2.tongue.scale.z = Math.max(0.01, Math.sin(t * 3 + a.ph) > 0.6 ? 1 : 0.01);
    if (P2.head && kind === 'jerapah') P2.head.rotation.x = moving ? 0 : Math.max(0, Math.sin(t * 0.5 + a.ph)) * 0.5;
    if (P2.head && kind === 'harimau') P2.head.rotation.y = Math.sin(t * 0.7 + a.ph) * 0.4;
  }
  syncInst(ZOO.inst);
}
export function feedAnimal(i) { const s = ZOO.species[i]; if (!s) return null; for (const a of s.list) { a.jumpT = 2.4; a.called = 4; a.callTo = callPoint(a); } return ZOO.animals[i]; }
// titik di dalam kandang yang paling dekat jalan tengah (hewan datang mendekati pengunjung)
function callPoint(a) { const [hx, hz] = a.home, dx = ZOO.cx - hx, dz = ZOO.cz - hz; return Math.abs(dx) > Math.abs(dz) ? [hx + Math.sign(dx) * 3.6 + rand(-0.3, 0.3), hz + rand(-2, 2)] : [hx + rand(-2, 2), hz + Math.sign(dz) * 3.6]; }
// kandang elus: hewan mendekati pemain lalu melompat senang
export function petAnimals(x, z) { const s = ZOO.species.find((q) => q.pet); if (!s) return; for (const a of s.list) { a.called = 5; a.callTo = [clamp(x, a.home[0] - 4, a.home[0] + 4) + rand(-1.2, 1.2), clamp(z, a.home[1] - 4, a.home[1] + 4) + rand(-1.2, 1.2)]; a.jumpT = 1.6; } }
// toko stiker: emotikon baru untuk dikoleksi
export const STICKERS = ['🦄', '🐶', '🐱', '🐼', '🦖', '🚀', '🌈', '⚽', '🎸', '🍕', '🍩', '🎈'];
function buildToys() {
  tower(38, 61, 10, 8, 7, '#ff8fc0', '#ffd23a');
  SPOTS.toys = { ...counter(38, 54.5, Math.PI, '#ff8fc0', '🧸 Toko Stiker · 🪙 4', { id: 'tokostiker', name: 'Kak Lili', role: 'Penjual Stiker', girl: true, shirt: '#ff8fc0', pants: '#9a62e0', pitch: 0.2 }), kind: 'toys' };
  place('stiker', 'Toko Stiker', '🧸', 38, 58, 38, 50);
}
// supermarket: kasir memberi kuis menghitung uang (gratis, dapat bintang)
const SHOP_ITEMS = [['🍎', 'apel', 2], ['🍌', 'pisang', 1], ['🥛', 'susu', 3], ['🍞', 'roti', 2], ['🍬', 'permen', 1], ['🥕', 'wortel', 2]];
function talkCashier(api) {
  const [a, b] = shuffle([...SHOP_ITEMS]).slice(0, 2);
  if (Math.random() < 0.5) { const n = a[2] + b[2], o = numChoices(n); api.ask(`Kamu beli ${a[0]} ${a[1]} (${a[2]} koin) dan ${b[0]} ${b[1]} (${b[2]} koin). Semuanya berapa koin?`, o.map(String), o.indexOf(n), `Betul! ${a[2]} tambah ${b[2]} sama dengan ${n} koin. Terima kasih sudah belanja!`, `Hampir! ${a[2]} tambah ${b[2]} itu ${n} koin.`); }
  else { const have = randi(a[2] + 1, 6), n = have - a[2], o = numChoices(n, 0); api.ask(`Kamu punya ${have} koin. Beli ${a[0]} ${a[1]} harganya ${a[2]} koin. Sisa uangmu berapa?`, o.map(String), o.indexOf(n), `Pintar! Sisanya ${n} koin.`, `Belum tepat. ${have} kurang ${a[2]} itu ${n} koin.`); }
}
// supermarket yang bisa dimasuki: rak barang, lemari es, troli, kasir di dekat pintu
function buildMarket() {
  const f = frame(...L(-62, 66), Math.PI), HX = 9, HZ = 7, wall = '#f4ecd8';
  f.solid(0, 0, HX * 2, HZ * 2, -0.5, 0.65, '#e6edf3');
  f.wallX(-HX, HX, HZ, 0.15, 3.6, wall, f.g, [[3, 2.6, 2.8]]); f.wallX(-HX, HX, -HZ, 0.15, 3.6, wall); f.wallZ(-HZ, HZ, -HX, 0.15, 3.6, wall); f.wallZ(-HZ, HZ, HX, 0.15, 3.6, wall);
  for (const x of [-6, -1]) f.winX(x, HZ, 2.6, 1.0, 1.8);
  f.deco(0, HZ + 0.25, HX * 2 + 0.4, 0.2, 3.4, 0.6, '#3fb25a');
  const goods = ['#e8434b', '#ffd23a', '#3a7cf5', '#3fb25a', '#ff8a2a', '#9a62e0', '#ff8fc0'];
  for (const x of [-6, -2.5, 1]) { f.solid(x, -1.5, 1.2, 7, 0.15, 1.8, '#c8ccd6'); for (let k = 0; k < 10; k++) for (const side of [-0.45, 0.45]) f.deco(x + side, -4.6 + k * 0.7, 0.3, 0.5, 0.5 + (k % 3) * 0.45, 0.35, goods[(k + Math.round(x)) % goods.length], f.g, false); }
  f.solid(-8.2, -1, 1.2, 9, 0.15, 2.4, '#d8f0ff'); for (let k = 0; k < 4; k++) f.deco(-7.55, -4 + k * 2, 0.05, 1.6, 0.6, 1.4, '#bfe6ff', f.g, false);
  for (const z of [4.5, 5.5]) f.deco(6.5, z, 1.2, 0.8, 0.15, 0.9, '#9aa0a6');
  f.solid(4, 3.2, 2.6, 0.9, 0.15, 1.0, '#3a7cf5'); f.deco(4, 3.2, 2.8, 1.1, 1.15, 0.06, '#ffffff', f.g, false);
  const roof = f.level(3.75); f.solid(0, 0, HX * 2 + 0.6, HZ * 2 + 0.6, 3.75, 0.3, '#3fb25a', roof); W.kit.hideable(f, HX, HZ, [roof], 3.75);
  const sp = sign('🛒 SUPERMARKET', 5, { bg: '#d8ffe2' }); putW(f, sp, 0, 5.4, HZ, CDYN);
  addNpc({ id: 'kasir', name: 'Mbak Dewi', role: 'Kasir Supermarket', x: f.W(4, 2.3), face: Math.PI, girl: true, shirt: '#3fb25a', pants: '#2c2f3a', pitch: 0.1, talk: talkCashier });
  addNpc({ id: 'pembeli', name: 'Bu Yati', role: 'Pembeli', x: f.W(-4, -1), face: 0, girl: true, shirt: '#ff8fc0', pants: '#5b3b22', pitch: 0, wander: 2, lines: ['Ibu sedang belanja sayur dan buah. Makan sayur itu sehat!', 'Bawa tas belanja sendiri supaya tidak pakai banyak plastik, ya.'] });
  place('pasar', 'Supermarket', '🛒', -62, 66, -59, 55);
}
// rumah sakit yang bisa dimasuki: resepsionis, ruang tunggu, 3 ranjang periksa, apotek; lantai atas + helipad
export const HOSPITAL = { beds: [] };
function buildHospital() {
  const f = frame(...L(-72, -26), 0), HX = 10, HZ = 8, wall = '#ffffff', b = 0.15;
  f.solid(0, 0, HX * 2, HZ * 2, -0.5, 0.65, '#e6f4ff');
  f.wallX(-HX, HX, HZ, b, 3.6, wall, f.g, [[0, 3, 2.8]]); f.wallX(-HX, HX, -HZ, b, 3.6, wall); f.wallZ(-HZ, HZ, -HX, b, 3.6, wall); f.wallZ(-HZ, HZ, HX, b, 3.6, wall);
  for (const x of [-6.5, 6.5]) f.winX(x, HZ, 3, 1.0, 1.8);
  f.deco(0, HZ + 0.25, HX * 2 + 0.4, 0.2, 3.3, 0.45, '#e8434b');
  f.deco(0, HZ + 1.3, 4.4, 2.6, 3.0, 0.2, '#ffffff'); for (const x of [-2, 2]) f.deco(x, HZ + 2.4, 0.16, 0.16, 0, 3, '#c8ccd6', f.g, false);
  // resepsionis & ruang tunggu
  f.solid(-5.5, 4.6, 3.6, 1, b, 1.0, '#7cc8f5'); f.deco(-5.5, 4.6, 3.8, 1.2, b + 1.0, 0.08, '#ffffff', f.g, false); f.deco(-6.2, 4.4, 0.6, 0.1, b + 1.08, 0.45, '#2c2f3a', f.g, false);
  f.solid(-9.2, 0.5, 0.9, 4.6, b, 0.45, '#3a7cf5'); f.deco(-9.6, 0.5, 0.15, 4.6, b + 0.45, 0.6, '#3a7cf5', f.g, false);
  // ranjang periksa dengan tirai & tiang infus
  for (const [i, bx] of [-5, -0.5, 4].entries()) {
    f.solid(bx, -5.4, 1.5, 2.8, b, 0.6, '#ffffff'); f.deco(bx, -4.8, 1.52, 1.7, b + 0.6, 0.12, ['#7cc8f5', '#ff8fc0', '#9be07f'][i], f.g, false);
    f.deco(bx, -6.3, 1.1, 0.5, b + 0.6, 0.22, '#ffffff', f.g, false); f.deco(bx, -6.9, 1.6, 0.15, b, 1.4, '#c8ccd6');
    if (i < 2) f.deco(bx + 2.25, -5.4, 0.08, 3, b, 2.4, '#bfe8d0', f.g, false);
    S('cyl', 0.06, 2.2, 0.06, '#c8ccd6', bx + 0.95, b + 1.1, -6.4, f.g, false); f.deco(bx + 0.95, -6.4, 0.3, 0.12, b + 1.8, 0.4, '#d8f0ff', f.g, false);
    const [x, z] = f.W(bx, -4.15), st = f.W(bx + 1.2, -3.2); HOSPITAL.beds.push({ x, z, y: b + 0.95, yaw: 0, stand: [st[0], st[1], b] });
  }
  // meja dokter & apotek
  f.solid(5.5, 3.2, 2.4, 1.2, b, 0.8, '#a5764a'); f.deco(5.5, 3.2, 0.5, 0.4, b + 0.8, 0.4, '#2c2f3a', f.g, false);
  f.solid(9.3, -1, 0.9, 5, b, 2.2, '#ffffff');
  const med = ['#e8434b', '#3a7cf5', '#ffd23a', '#3fb25a', '#ff8fc0'];
  for (let r = 0; r < 3; r++) for (let k = 0; k < 7; k++) f.deco(8.8, -3.2 + k * 0.62, 0.15, 0.4, b + 0.4 + r * 0.6, 0.38, med[(k + r) % 5], f.g, false);
  { const sp = sign('💊 Apotek', 2.4, { bg: '#ffffff' }); putW(f, sp, 8.6, 3.0, -1, CDYN); }
  // lantai atas (disembunyikan saat di dalam) + helipad
  const up = f.level(3.75);
  f.solid(0, 0, HX * 2 + 0.6, HZ * 2 + 0.6, 3.75, 0.3, '#ffffff', up);
  f.deco(0, -1, HX * 2, HZ * 2 - 2, 4.05, 7, '#ffffff', up);
  for (const y of [5.0, 8.0]) { f.deco(0, 6.03, HX * 2 - 1.5, 0.06, y, 1.3, windowMat, up, false); f.deco(HX + 0.03, -1, 0.06, HZ * 2 - 3.5, y, 1.3, windowMat, up, false); f.deco(-HX - 0.03, -1, 0.06, HZ * 2 - 3.5, y, 1.3, windowMat, up, false); }
  f.deco(0, 6.1, 3, 0.12, 9.6, 0.9, '#e8434b', up, false); f.deco(0, 6.1, 0.9, 0.12, 8.65, 2.8, '#e8434b', up, false);
  f.deco(0, -1, HX * 2 + 0.4, HZ * 2 - 1.6, 11.05, 0.3, '#c8ccd6', up);
  S('cyl', 8, 0.06, 8, '#3d4250', 0, 11.4, -1, up, false); f.deco(-1.1, -1, 0.5, 3, 11.43, 0.04, '#ffffff', up, false); f.deco(1.1, -1, 0.5, 3, 11.43, 0.04, '#ffffff', up, false); f.deco(0, -1, 1.8, 0.5, 11.43, 0.04, '#ffffff', up, false);
  W.kit.hideable(f, HX, HZ, [up], 3.75);
  { const sp = sign('🏥 RUMAH SAKIT', 5, { bg: '#ffffff' }); putW(f, sp, 0, 4.4, HZ + 0.5, CDYN); }
  // ambulans di depan
  { const m = makeCar('#ffffff'); const [ax, az] = f.W(7, 12); m.position.set(ax, 0, az); root.add(m); K.box(1.95, 0.2, 3.85, '#e8434b', ax, 1.0, az, root, false); K.box(0.9, 0.3, 0.4, '#3a7cf5', ax, 2.25, az, root, false); addSolid(ax, az, 1, 2, 0, 1.8); }
  const sp0 = f.W(-5.5, 5.9); SPOTS.clinic = { x: sp0[0], z: sp0[1], y: b, kind: 'clinic' };
  addNpc({ id: 'suster', name: 'Suster Ani', role: 'Perawat', x: f.W(-5.5, 3.7), y: b, face: 0, girl: true, shirt: '#ffffff', pants: '#7cc8f5', pitch: 0.15, lines: ['Selamat datang di Rumah Sakit Kota! Mau berobat? Berdiri di depan meja, lalu ketuk tombolnya.', 'Kalau sakit jangan takut ke dokter, ya. Dokter baik hati!'] });
  addNpc({ id: 'dokterkota', name: 'Dokter Sinta', role: 'Dokter', x: f.W(2.2, -2.6), y: b, face: Math.PI, girl: true, shirt: '#ffffff', pants: '#3a5f9e', pitch: 0.08, lines: ['Supaya sehat: cuci tangan pakai sabun, makan sayur dan buah, lalu tidur yang cukup.', 'Gosok gigi pagi dan sebelum tidur, ya. Gigi sehat, senyum cantik!', 'Kalau batuk atau bersin, tutup mulut dengan siku.'] });
  addNpc({ id: 'pasien', name: 'Pak Darmo', role: 'Pasien', x: f.W(-9.2, -0.6), y: b, face: Math.PI / 2, sit: true, shirt: '#9be07f', pants: '#5b6b8c', pitch: -0.3, lines: ['Bapak sedang menunggu giliran diperiksa. Sebentar lagi pasti sembuh!'] });
  place('klinik', 'Rumah Sakit', '🏥', -72, -26, -72, -12);
}
// perpustakaan yang bisa dimasuki: rak buku, meja baca, pojok karpet. Baca buku gratis (pembaca buku di game.js)
function buildLibrary() {
  const f = frame(...L(24, 76), Math.PI), HX = 11, HZ = 7, wall = '#f4e6d0', b = 0.15;
  f.solid(0, 0, HX * 2, HZ * 2, -0.5, 0.65, '#d9b98c');
  f.wallX(-HX, HX, HZ, b, 3.6, wall, f.g, [[3, 2.8, 2.8]]); f.wallX(-HX, HX, -HZ, b, 3.6, wall); f.wallZ(-HZ, HZ, -HX, b, 3.6, wall); f.wallZ(-HZ, HZ, HX, b, 3.6, wall);
  for (const x of [-7.5, -2.5, 8]) f.winX(x, HZ, 2.6, 1.0, 1.8);
  f.deco(0, HZ + 0.25, HX * 2 + 0.4, 0.2, 3.3, 0.45, '#3a5f9e');
  const bc = ['#e8434b', '#3a7cf5', '#ffd23a', '#3fb25a', '#ff8a2a', '#9a62e0', '#ff8fc0'];
  for (const x of [-8.5, -4.5, -0.5, 3.5, 7.5]) { f.solid(x, -6.4, 3.4, 0.9, b, 2.6, '#8a5a35'); for (let r = 0; r < 4; r++) for (let k = 0; k < 6; k++) f.deco(x - 1.3 + k * 0.52, -6.05, 0.4, 0.2, b + 0.2 + r * 0.6, 0.42 + (k % 2) * 0.06, bc[(((k + r * 3 + Math.round(x)) % 7) + 7) % 7], f.g, false); }
  for (const z of [-3, 1.2]) { f.solid(-10.4, z, 0.9, 3.4, b, 2.6, '#8a5a35'); for (let r = 0; r < 4; r++) for (let k = 0; k < 6; k++) f.deco(-10.05, z - 1.3 + k * 0.52, 0.2, 0.4, b + 0.2 + r * 0.6, 0.44, bc[(k + r * 2) % 7], f.g, false); }
  for (const [x, c] of [[-5.5, '#ff8fc0'], [0, '#7cc8f5']]) {
    f.solid(x, -2, 3.2, 1.6, b, 0.75, '#c98f4f');
    for (const sx of [-1, 1]) { f.deco(x + sx * 0.7, -2, 0.75, 0.55, b + 0.75, 0.05, '#ffffff', f.g, false); for (const sz of [-1.3, 1.3]) S('cyl', 0.7, 0.45, 0.7, c, x + sx * 0.8, b + 0.22, -2 + sz, f.g); }
  }
  S('cyl', 6, 0.04, 6, '#ffd23a', 6.5, b + 0.02, -2, f.g, false); S('cyl', 4.4, 0.05, 4.4, '#ff8fc0', 6.5, b + 0.03, -2, f.g, false);
  for (const [x, z, c] of [[5, -3.4, '#3a7cf5'], [8, -3.4, '#3fb25a'], [8.4, -0.6, '#e8434b']]) S('sph', 1.3, 0.8, 1.3, c, x, b + 0.4, z, f.g);
  f.solid(7.5, 4.4, 3, 1, b, 1.0, '#3a5f9e'); f.deco(7.5, 4.4, 3.2, 1.2, b + 1.0, 0.08, '#ffffff', f.g, false); for (let k = 0; k < 3; k++) f.deco(6.6 + k * 0.4, 4.4, 0.3, 0.5, b + 1.08, 0.4, bc[k], f.g, false);
  const lv = f.level(3.75); f.solid(0, 0, HX * 2 + 0.6, HZ * 2 + 0.6, 3.75, 0.3, '#ffffff', lv); S('roof', HX * 2 + 1.8, 4, HZ * 2 + 1.8, '#3a5f9e', 0, 6.05, 0, lv);
  W.kit.hideable(f, HX, HZ, [lv], 3.75);
  { const sp = sign('📚 PERPUSTAKAAN', 4.6, { bg: '#ffffff' }); putW(f, sp, 0, 5.1, HZ + 0.6, CDYN); }
  const sb = f.W(-2.5, 2.4); SPOTS.books = { x: sb[0], z: sb[1], y: b, kind: 'books' };
  { const sp = sign('📖 Baca buku · gratis', 3, { bg: '#ffd23a' }); putW(f, sp, -2.5, 2.9, 3.4, CDYN); }
  addNpc({ id: 'pustakawan', name: 'Bu Ratna', role: 'Pustakawan', x: f.W(7.5, 3.4), y: b, face: Math.PI, girl: true, shirt: '#3a5f9e', pants: '#2c2f3a', pitch: 0.05,
    talk: (api) => api.choose('Selamat datang di perpustakaan! Mau baca buku cerita atau ikut kuis?', ['📖 Baca buku', '❓ Ikut kuis'], (i) => (i ? pick(W.FLOOR_THEMES).quiz(api, randi(3, 14)) : api.books?.())) });
  addNpc({ id: 'pembaca', name: 'Dek Nisa', role: 'Suka Membaca', x: f.W(-5.5, -0.7), y: b, face: 0, girl: true, sit: true, scale: 0.8, shirt: '#ff8fc0', pants: '#9a62e0', pitch: 0.4, lines: ['Aku suka baca kisah Nabi Yunus. Ceritanya seru!', 'Membaca itu jendela dunia, kata Bu Guru.'] });
  place('pustaka', 'Perpustakaan', '📚', 24, 76, 21, 63);
}
// mall kota 2 lantai: toko topi, toko stiker, mesin capit (lantai 1); food court (lantai 2)
// MALL KOTA 5 lantai: atrium terbuka sampai kubah kaca, tangga tiap lantai, lift kaca ke semua lantai.
// L1 lobi & mainan · L2 fashion · L3 mainan & game · L4 food court · L5 bioskop & taman bermain · atap taman
export const MALL = { x: 0, z: 0, hx: 18, hz: 14.5, b: [], names: ['Lantai 1 · Lobi & Mainan', 'Lantai 2 · Fashion', 'Lantai 3 · Mainan & Game', 'Lantai 4 · Food Court', 'Lantai 5 · Bioskop'], lift: null, screen: null, cab: null };
function buildMall() {
  const CXm = 24, CZm = -25, f = frame(...L(CXm, CZm), 0), HX = MALL.hx, HZ = MALL.hz, FH = 4.5, b = (k) => 0.15 + k * FH;
  const [mx, mz] = L(CXm, CZm); MALL.x = mx; MALL.z = mz; MALL.b = [0, 1, 2, 3, 4, 5].map(b);
  const lv = [f.g, 1, 2, 3, 4].map((k) => (k === f.g ? f.g : f.level(b(k)))), roof = f.level(b(5));
  const ACC = ['#9a62e0', '#ff5f8f', '#3a7cf5', '#ff8a2a', '#3fb25a'], wall = '#f4ecd8';
  const W2 = (lx, lz) => f.W(lx, lz), put = (obj, lx, y, lz, k) => f.put(obj, lx, y, lz, lv[k]);
  const signAt = (txt, w, lx, y, lz, k, bg = '#ffffff') => put(sign(txt, w, { bg }), lx, y, lz, k);
  // lantai dasar + pelat lantai atas berlubang (atrium x±6 z±4, lubang tangga x14.4..18 z-1..8.2)
  f.solid(0, 0, HX * 2, HZ * 2, -0.5, 0.65, '#efe6da');
  const SLABS = [[0, -9.25, 36, 10.5], [0, 11.35, 36, 6.3], [-1.8, 6.1, 32.4, 4.2], [-12, 0, 12, 8], [10.2, 0, 8.4, 8], [16.2, -2.5, 3.6, 3]];
  for (let k = 1; k <= 4; k++) for (const [x, z, w, d] of SLABS) f.solid(x, z, w, d, b(k) - 0.3, 0.3, k % 2 ? '#f3ece2' : '#e9e2f2', lv[k]);
  for (const [x, z, w, d] of [...SLABS, [16.2, 3.6, 3.6, 9.2]]) f.solid(x, z, w, d, b(5) - 0.3, 0.3, '#c9b8e8', roof);
  for (let k = 0; k < 5; k++) {
    const P = lv[k], y0 = b(k);
    f.wallX(-HX, HX, HZ, y0, FH - 0.3, wall, P, k === 0 ? [[0, 4.4, 3.6]] : []); f.wallX(-HX, HX, -HZ, y0, FH - 0.3, wall, P);
    f.wallZ(-HZ, HZ, -HX, y0, FH - 0.3, wall, P); f.wallZ(-HZ, HZ, HX, y0, FH - 0.3, wall, P);
    for (const x of k === 0 ? [-13, -7, 7, 13] : k === 2 ? [-13, -8.5, 8.5, 13] : [-13, -6.5, 0, 6.5, 13]) f.winX(x, HZ, 4.2, y0 + 0.9, 2.6, P);
    if (k) for (const x of [-12, -4, 4, 12]) f.winX(x, -HZ, 3.6, y0 + 1, 2.4, P);
    for (const z of [-9, -3, 3, 9]) { f.winZ(-HX, z, 3.6, y0 + 1, 2.4, P); if (k) f.winZ(HX, z, 3.6, y0 + 1, 2.4, P); }
    f.deco(0, HZ + 0.22, HX * 2 + 0.3, 0.2, y0 + FH - 0.55, 0.5, ACC[k], P); f.deco(0, -HZ - 0.22, HX * 2 + 0.3, 0.2, y0 + FH - 0.55, 0.5, ACC[k], P);
    f.deco(-HX - 0.22, 0, 0.2, HZ * 2 + 0.3, y0 + FH - 0.55, 0.5, ACC[k], P); f.deco(HX + 0.22, 0, 0.2, HZ * 2 + 0.3, y0 + FH - 0.55, 0.5, ACC[k], P);
    if (k < 4) for (let i = 0; i < 10; i++) f.solid(15.8, 8 - 0.9 * i - 0.45, 2.4, 0.9, y0 + 0.45 * i, 0.45, i % 2 ? '#c9b48a' : '#bba57a', P); // tangga ke lantai berikutnya
    if (k) { // pagar kaca atrium & lubang tangga
      for (const [x, z, w, d] of [[0, -4, 12, 0.12], [0, 4, 12, 0.12], [-6, 0, 0.12, 8], [6, 0, 0.12, 8], [14.35, 3.6, 0.12, 9.2]]) { f.deco(x, z, w, d, y0, 1.05, glassMat, P, false); f.deco(x, z, w + 0.1, d + 0.1, y0 + 1.05, 0.08, '#c8ccd6', P, false); f.solid(x, z, w, d, y0, 1.15, null, P); }
      signAt(MALL.names[k], 5.4, 0, y0 + 3.4, 4.3, k, '#fff6df');
    }
    // lift kaca
    const s = W2(-9.5, 2.5); SPOTS['lift' + k] = { x: s[0], z: s[1], y: y0, kind: 'lift', floor: k };
    f.deco(-9.5, 0.95, 1.6, 0.1, y0, 2.6, '#c8ccd6', P, false); signAt(`🛗 Lift · ${k + 1}`, 2.2, -9.5, y0 + 3.0, 1.2, k, '#d8f0ff');
  }
  { const sh = S('cyl', 2.2, b(5) + 1.2, 2.2, glassMat, -9.5, (b(5) + 1.2) / 2, -0.1, f.g, false); sh.renderOrder = 2; addSolid(...W2(-9.5, -0.1), 1.1, 1.1, 0, b(5) + 1);
    const cab = new THREE.Group(); K.box(1.6, 2.6, 1.6, '#ffd23a', 0, 1.3, 0, cab, false); K.box(1.3, 0.2, 1.3, '#ffffff', 0, 2.7, 0, cab, false); const [x, z] = W2(-9.5, -0.1); cab.position.set(x, 0.15, z); CDYN.add(cab); MALL.cab = cab; }
  MALL.lift = { x: W2(-9.5, 2.5)[0], z: W2(-9.5, 2.5)[1] };
  // atap: kubah kaca di atas atrium, taman atap, bendera
  S('dome', 13, 4.4, 9.5, glassMat, 0, b(5) - 0.3, 0, roof, false); S('cyl', 13.2, 0.3, 9.7, '#ffffff', 0, b(5) - 0.15, 0, roof);
  for (const [x, z] of [[-14, -10], [-14, 10], [12, -10], [12, 11], [-1, -11], [-1, 11]]) { S('cyl', 1.6, 0.6, 1.6, '#a5764a', x, b(5) + 0.3, z, roof); S('sph', 2.4, 2.2, 2.4, '#3fae4f', x, b(5) + 1.6, z, roof); }
  for (let i = 0; i < 8; i++) { const x = -16 + i * 4.5; S('cyl', 0.12, 4, 0.12, '#ffffff', x, b(5) + 2, HZ, roof); K.box(0.06, 1, 1.6, ACC[i % 5], x, b(5) + 3.4, HZ - 0.8, roof); }
  f.put(sign('🏬 MALL KOTA', 9, { bg: '#ffffff' }), 0, b(5) + 3.2, HZ + 0.5, roof);
  // ---------- LANTAI 1: lobi & mainan ----------
  { const y0 = b(0);
    // air mancur atrium
    const [ax, az] = W2(0, 0); for (let i = 0; i < 20; i++) { const a = (i / 20) * TAU; f.deco(Math.cos(a) * 3.1, Math.sin(a) * 3.1, 1.1, 1.1, y0, 0.6, '#d8d2c4'); }
    const water = new THREE.Mesh(new THREE.CylinderGeometry(3, 3, 0.1, 28), new THREE.MeshLambertMaterial({ color: '#4cb4ea' })); water.position.set(ax, y0 + 0.5, az); root.add(water); addSolid(ax, az, 3.3, 3.3, 0, 0.7);
    S('cyl', 0.8, 2.6, 0.8, '#ffffff', ax, y0 + 1.6, az); S('sph', 1.4, 1.4, 1.4, '#ffd23a', ax, y0 + 3.3, az);
    const jets = []; for (let i = 0; i < 8; i++) { const a = (i / 8) * TAU; const j = new THREE.Mesh(K.BOX, new THREE.MeshLambertMaterial({ color: '#bfe8ff', transparent: true, opacity: 0.7 })); j.scale.set(0.18, 2, 0.18); j.position.set(ax + Math.cos(a) * 2, 1.6, az + Math.sin(a) * 2); CDYN.add(j); jets.push(j); }
    K.animated.push({ obj: jets[0], fn: (t) => jets.forEach((j, i) => { const h = 1.8 + Math.sin(t * 3 + i) * 0.7; j.scale.y = h; j.position.y = y0 + 0.6 + h / 2; }) });
    // deretan toko di dinding belakang
    const front = (lx, w, col, label, k = 0, P = f.g) => { const y = b(k); f.deco(lx, -HZ + 0.4, w, 0.3, y, 3.9, col, P); f.deco(lx, -HZ + 0.6, w - 0.6, 0.12, y + 0.4, 2.6, '#bfe6ff', P, false); f.deco(lx, -HZ + 0.7, w + 0.2, 0.2, y + 3.1, 0.6, '#ffffff', P, false);
      for (let i = 0; i < 6; i++) { const m = f.deco(lx - w / 2 + (i + 0.5) * (w / 6), -HZ + 1.1, w / 6, 1.0, y + 2.7, 0.06, i % 2 ? '#ffffff' : col, P, false); m.rotation.x = 0.5; }
      if (k) signAt(label, 3.6, lx, y + 3.45, -HZ + 0.9, k); else putW(f, sign(label, 3.6, { bg: '#ffffff' }), lx, y + 3.45, -HZ + 0.9, CDYN); };
    MALL.front = front;
    front(-13, 6, '#9a62e0', '🛍️ Toko Topi'); front(-6, 6, '#ff8fc0', '🧸 Toko Stiker'); front(1.5, 6, '#ff5f8f', '🍬 Toko Permen'); front(9, 5, '#3a7cf5', '📸 Foto Box');
    const c1 = W2(-13, -11.3), c2 = W2(-6, -11.3);
    SPOTS.hats = { ...counter(c1[0] - CX, c1[1] - CZ, 0, '#9a62e0', '🛍️ Toko Topi', { id: 'tokotopi', name: 'Kak Mira', role: 'Penjual Topi', girl: true, shirt: '#9a62e0', pants: '#2c2f3a', pitch: 0.15 }), kind: 'hats' };
    SPOTS.toys2 = { ...counter(c2[0] - CX, c2[1] - CZ, 0, '#ff8fc0', '🧸 Stiker · 🪙 4', { id: 'stikermall', name: 'Kak Bela', role: 'Penjual Stiker', girl: true, shirt: '#ff8fc0', pants: '#3a7cf5', pitch: 0.2 }), kind: 'toys' };
    f.solid(1.5, -11.3, 3.6, 0.8, y0, 0.95, '#ff5f8f'); f.deco(1.5, -11.3, 3.8, 1.0, y0 + 0.95, 0.06, '#ffffff', f.g, false);
    for (let i = 0; i < 5; i++) { const [x, z] = W2(0 + i * 0.75, -11.3); S('cyl', 0.5, 0.6, 0.5, glassMat, x, y0 + 1.3, z, root, false); S('sph', 0.36, 0.36, 0.36, BAL_COLS[i], x, y0 + 1.2, z, root, false); }
    vendor({ shirt: '#ff5f8f', pants: '#ffffff', girl: true }, W2(1.5, -12.6), 0, y0); { const s = W2(1.5, -9.8); shopSpot('permen', s[0], s[1], y0); }
    f.solid(9, -12.4, 2.6, 2.1, y0, 2.8, '#3a7cf5'); f.deco(9, -11.32, 1.6, 0.06, y0 + 0.6, 2.0, '#e8434b', f.g, false); { const s = W2(9, -10.4); SPOTS.photo_mall = { x: s[0], z: s[1], y: y0, kind: 'photo', where: 'Mall Kota' }; }
    // mesin capit (2), mainan goyang, mandi bola
    for (const lz of [5, 8.5]) { const [x, z] = W2(-16, lz); B(x - CX, z - CZ, 2, 2.4, 1.2, '#e8434b', 0, true); deco(x - CX, z - CZ, 1.9, 2.3, 1.6, glassMat, 1.2); deco(x - CX, z - CZ, 2, 2.4, 0.3, '#ffd23a', 2.8); for (let i = 0; i < 6; i++) deco(x - CX - 0.4 + (i % 2) * 0.8, z - CZ - 0.8 + Math.floor(i / 2) * 0.8, 0.4, 0.4, 0.4, ['#ff8fc0', '#7cc8f5', '#ffd23a'][i % 3], 1.25); }
    { const s = W2(-13.9, 6.7); SPOTS.claw = { x: s[0], z: s[1], kind: 'claw' }; putW(f, sign('🕹️ Mesin Capit · 🪙 1', 3.4, { bg: '#ffd23a' }), -16, 4.2, 6.7, CDYN); }
    kiddieRide(f, -15.8, -2.2, 'kuda'); kiddieRide(f, -15.8, -6.4, 'mobil');
    buildBallPit(f, 8.5, 10, 5, 3.4);
    // meja informasi, lengkung balon, karpet, pot, spanduk
    f.solid(-7, 10.5, 3.4, 1.1, y0, 1.05, '#3fb25a'); f.deco(-7, 10.5, 3.6, 1.3, y0 + 1.05, 0.08, '#ffffff', f.g, false); putW(f, sign('ℹ️ Informasi', 2.6, { bg: '#d8ffe2' }), -7, 2.6, 10.5, CDYN);
    vendor({ shirt: '#3fb25a', pants: '#2c2f3a', girl: true }, W2(-7, 9.6), Math.PI, y0);
    for (const lz of [HZ - 0.4, HZ + 0.6]) for (let i = 0; i <= 14; i++) { const a = (i / 14) * Math.PI, [x, z] = W2(Math.cos(a) * 2.6, lz); S('sph', 0.65, 0.75, 0.65, BAL_COLS[i % 6], x, y0 + Math.sin(a) * 3.4, z, root, false); }
    for (const lx of [-3.6, 3.6]) { const [x, z] = W2(lx, HZ + 2); S('cyl', 0.9, 0.7, 0.9, '#a5764a', x, 0.35, z); S('sph', 1.3, 1.5, 1.3, '#3fae4f', x, 1.3, z); addSolid(x, z, 0.45, 0.45, 0, 1); }
    { const [x, z] = W2(0, HZ + 3.2); K.box(3.2, 0.04, 6, '#c0392b', x, 0.06, z, root, false); K.box(7, 0.3, 3, ACC[0], ...W2(0, HZ + 1.2).flatMap((v, i) => (i ? [4.3, v] : [v])), root); }
    for (const lx of [-16.6, 16.6]) { const [x, z] = W2(lx, HZ + 0.45); K.box(1.6, 14, 0.12, lx < 0 ? '#ffd23a' : '#3fb25a', x, 9, z, root, false); K.box(1.1, 1, 0.13, '#ffffff', x, 13.5, z, root, false); }
    // bendera di rongga atrium (tiap lantai)
    for (let k = 1; k <= 4; k++) { const y = b(k) - 0.6; bunting(CXm - 6, CZm - 4, CXm + 6, CZm + 4, y, ['#e8434b', '#ffd23a', '#3a7cf5', '#3fb25a', '#ff8fc0'], false, 0.6); bunting(CXm - 6, CZm + 4, CXm + 6, CZm - 4, y, ['#ffffff', '#ff8fc0'], false, 0.6); }
    // papan LED depan
    { const tex = K.canvasTex(1024, 256, (g, w, h) => drawLed(g, w, h, 0)); const m = new THREE.Mesh(new THREE.PlaneGeometry(12, 3), new THREE.MeshBasicMaterial({ map: tex })); const [x, z] = W2(0, HZ + 0.36); m.position.set(x, b(2) + 2.2, z); CDYN.add(m); LIFE.led = tex; K.box(12.4, 3.4, 0.2, '#2c2f3a', x, b(2) + 2.2, z - 0.12, root, false); }
  }
  // ---------- LANTAI 2: fashion ----------
  { const k = 1, y0 = b(k), P = lv[k];
    [[-13, '#9a62e0', '👗 Butik Ceria'], [-6, '#ff8fc0', '👟 Toko Sepatu'], [1, '#ffd23a', '👜 Tas & Aksesoris'], [8.5, '#5bc8d6', '💇 Salon Anak']].forEach(([lx, c, t]) => MALL.front(lx, 6, c, t, k, P));
    for (const [lx, lz, c] of [[-14.5, -9, '#ff8fc0'], [-12.5, -9, '#ffd23a'], [-7, -9, '#5bc8d6'], [-5, -9, '#e8434b']]) { f.deco(lx, lz, 0.5, 0.35, y0 + 1.2, 0.9, '#f4f4f4', P); f.deco(lx, lz, 0.9, 0.6, y0 + 0.2, 1.0, c, P); f.deco(lx, lz, 0.12, 0.12, y0, 0.25, '#c8ccd6', P, false); }
    for (const [lx, lz] of [[-14, 7], [-11, 7], [-14, 10.5], [-11, 10.5]]) { f.deco(lx, lz, 2.4, 0.08, y0 + 1.6, 0.08, '#c8ccd6', P, false); for (let i = 0; i < 6; i++) f.deco(lx - 1 + i * 0.4, lz, 0.32, 0.5, y0 + 0.6, 1.0, ACC[(i + Math.round(lx)) % 5 < 0 ? 0 : (i + Math.round(lx)) % 5], P, false); f.solid(lx, lz, 2.4, 0.6, y0, 0.5, null, P); }
    for (const lx of [3, 5]) { f.deco(lx, -9.6, 1.2, 0.1, y0 + 0.3, 2.2, '#dff3ff', P, false); f.deco(lx, -9.66, 1.4, 0.1, y0 + 0.2, 2.4, '#ffd23a', P, false); }
    for (const [lx, lz] of [[7.5, 8], [10.5, 8]]) { f.solid(lx, lz, 1.2, 1.2, y0, 0.5, '#ff8fc0', P); f.deco(lx, lz - 0.6, 1.2, 0.2, y0 + 0.5, 0.8, '#ff8fc0', P); }
  }
  // ---------- LANTAI 3: toko mainan, game center, toko buku ----------
  { const k = 2, y0 = b(k), P = lv[k];
    [[-12, '#e8434b', '🧸 Toko Mainan'], [-3, '#9a62e0', '🎮 Game Center'], [6, '#3fb25a', '📚 Toko Buku']].forEach(([lx, c, t]) => MALL.front(lx, 8, c, t, k, P));
    for (const lz of [6.5, 9.5]) { f.solid(-12, lz, 7, 0.9, y0, 1.8, '#ffffff', P); for (let i = 0; i < 12; i++) f.deco(-15.2 + i * 0.58, lz + (i % 2 ? 0.25 : -0.25), 0.45, 0.4, y0 + 1.8, 0.45 + (i % 3) * 0.2, BAL_COLS[i % 6], P, false); }
    for (let i = 0; i < 6; i++) { const lx = -6.5 + (i % 3) * 3, lz = -10 + Math.floor(i / 3) * 3; f.solid(lx, lz, 1.4, 1.1, y0, 2.2, ACC[i % 5], P); f.deco(lx, lz + 0.56, 1.0, 0.06, y0 + 1.15, 0.8, new THREE.MeshBasicMaterial({ color: ['#7cf5c8', '#ffd23a', '#ff8fc0'][i % 3] }), P, false); f.deco(lx, lz + 0.62, 1.2, 0.35, y0 + 0.85, 0.12, '#2c2f3a', P, false); }
    for (const lz of [-10, -7]) { f.solid(6, lz, 7, 0.8, y0, 2.0, '#8a5a35', P); for (let i = 0; i < 14; i++) f.deco(2.8 + i * 0.46, lz + 0.42, 0.36, 0.08, y0 + 0.3 + (i % 2) * 0.9, 0.55, ACC[i % 5], P, false); }
    signAt('🏀 Lempar Bola', 3, 9, y0 + 3, 9, k, '#ffd23a'); for (const lx of [8, 10]) { f.solid(lx, 10.5, 1.4, 2.4, y0, 1.0, '#3a7cf5', P); f.deco(lx, 11.4, 1.0, 0.1, y0 + 1.0, 1.6, '#ffffff', P, false); S('cyl', 0.6, 0.1, 0.6, '#ff8a2a', ...W2(lx, 11).flatMap((v, i) => (i ? [y0 + 2.2, v] : [v])), root, false); }
  }
  // ---------- LANTAI 4: food court ----------
  { const k = 3, y0 = b(k), P = lv[k];
    [[-13.5, '#e8434b', '🍲 Bakso'], [-8, '#ff8a2a', '🍛 Nasi Goreng'], [-2.5, '#3fb25a', '🧃 Jus Buah'], [3, '#ff8fc0', '🍦 Es Krim'], [8.5, '#9a62e0', '🍢 Sate']].forEach(([lx, c, t]) => MALL.front(lx, 5, c, t, k, P));
    f.solid(-5, -11.6, 22, 1, y0, 1.1, '#ff8a2a', P); f.deco(-5, -11.6, 22.2, 1.2, y0 + 1.1, 0.08, '#ffffff', P, false);
    const fc = W2(-8, -9.8); SPOTS.foodcourt = { x: fc[0], z: fc[1], y: y0, kind: 'foodcourt' };
    addNpc({ id: 'foodcourt', name: 'Bang Ucok', role: 'Penjual Food Court', x: W2(-8, -12.6), y: y0, face: 0, shirt: '#ff8a2a', pants: '#2c2f3a', hat: 'koki', pitch: -0.2, lines: ['Selamat datang di food court lantai empat! Ketuk tombol pesan di depan meja, ya.'] });
    for (const lx of [-13.5, -2.5, 3, 8.5]) vendor({ shirt: '#ffffff', pants: '#2c2f3a' }, W2(lx, -12.6), 0, y0);
    const T4 = [[-14, -1], [-10, -1], [-14, 3.5], [-10, 3.5], [8.5, -1], [11.5, 2.5], [-3, 7], [2, 7], [-12, 9.5], [-6, 10.5], [5, 10.5], [10, 10]];
    for (const [lx, lz] of T4) { f.solid(lx, lz, 1.8, 1.1, y0, 0.8, '#ffffff', P); f.deco(lx, lz - 0.95, 1.8, 0.45, y0, 0.45, '#ff8fc0', P); f.deco(lx, lz + 0.95, 1.8, 0.45, y0, 0.45, '#7cc8f5', P);
      for (const [ox, oz, yaw] of [[-0.45, -0.95, 0], [0.45, -0.95, 0], [-0.45, 0.95, Math.PI], [0.45, 0.95, Math.PI]]) { if (Math.random() < 0.4) continue; const [x, z] = W2(lx + ox, lz + oz); person({ mode: 'sit', x, z, y: y0 + 0.25, yaw, act: pick(['eat', 'eat', 'talk']), mlv: k }); } }
    MALL.t4 = T4;
  }
  // ---------- LANTAI 5: bioskop & taman bermain ----------
  { const k = 4, y0 = b(k), P = lv[k];
    MALL.front(-11, 9, '#1d2b53', '🎬 Bioskop Kota', k, P);
    { const tex = K.canvasTex(512, 256, (g, w, h) => drawFilm(g, w, h, 0)); const m = new THREE.Mesh(new THREE.PlaneGeometry(9, 4.2), new THREE.MeshBasicMaterial({ map: tex })); m.position.set(4.5, y0 + 2.3, -HZ + 0.45); P.add(m); MALL.screen = tex; f.deco(4.5, -HZ + 0.32, 9.6, 0.15, y0 + 0.1, 4.6, '#2c2f3a', P); }
    for (let r = 0; r < 4; r++) for (let i = 0; i < 7; i++) { const lx = 0.6 + i * 1.3, lz = -9.6 + r * 1.6; f.solid(lx, lz, 1.1, 0.9, y0, 0.45, '#c0392b', P); f.deco(lx, lz + 0.42, 1.1, 0.15, y0 + 0.45, 0.6, '#c0392b', P); if (Math.random() < 0.55) { const [x, z] = W2(lx, lz); person({ mode: 'sit', x, z, y: y0 + 0.25, yaw: Math.PI, act: pick(['idle', 'eat', 'talk']), kid: Math.random() < 0.5, mlv: k }); } }
    signAt('🍿 Popcorn', 2.4, 12.5, y0 + 2.4, -6, k, '#fff3c4'); f.solid(12.5, -6, 2, 1, y0, 1.1, '#e8434b', P); for (let i = 0; i < 4; i++) f.deco(11.9 + i * 0.4, -6, 0.3, 0.3, y0 + 1.1, 0.3, '#fff3c4', P, false);
    // taman bermain dalam ruang
    f.deco(-11, 8.5, 12, 9, y0, 0.08, '#7cc8f5', P); for (let i = 0; i < 10; i++) f.solid(-16 + (i % 5) * 2.4, 5.5 + Math.floor(i / 5) * 5, 1.2, 1.2, y0, 0.5 + (i % 3) * 0.3, BAL_COLS[i % 6], P);
    f.solid(-8, 11, 2, 2, y0, 2.0, '#ffd23a', P); { const m = f.deco(-8, 8.2, 1.4, 3.6, y0 + 0.9, 0.12, '#ff8a2a', P); m.rotation.x = -0.5; }
    signAt('🧸 Taman Bermain', 3.4, -11, y0 + 3.3, 8.5, k, '#d8ffe2');
  }
  W.kit.hideable(f, HX, HZ, [lv[1], lv[2], lv[3], lv[4], roof], b(5));
  // pengunjung tiap lantai (berkeliaran di luar meja/toko/atrium/tangga)
  const okM = (k, extra = []) => (x, z) => { const lx = x - mx, lz = z - mz; if (Math.abs(lx) > 16.8 || lz < -9.6 || lz > 13.2 || lx > 13.8) return false; if (k && Math.abs(lx) < 6.6 && Math.abs(lz) < 4.6) return false; if (Math.abs(lx) < 3.8 && Math.abs(lz) < 3.8) return false; if (Math.hypot(lx + 9.5, lz) < 1.8) return false; return !extra.some(([a, b2, c, d]) => lx > a && lx < b2 && lz > c && lz < d); };
  const ex0 = [[-17, -13.6, -8, 0], [-17, -14.6, 3.4, 10], [5.7, 11.3, 8, 12], [-9, -5, 9.6, 11.4]];
  const ex3 = (MALL.t4 || []).map(([x, z]) => [x - 1.3, x + 1.3, z - 1.6, z + 1.6]);
  const ex4 = [[0, 9.6, -9.6, -4], [-17, -5, 4, 13]];
  [[0, 12, ex0], [1, 7, []], [2, 7, [[-16, -8.4, 6, 10]]], [3, 5, ex3], [4, 4, ex4]].forEach(([k, n, ex]) => wanderer(mx - 16.5, mx + 13.5, mz - 9.5, mz + 13, n, { y: b(k), mlv: k }, okM(k, ex)));
  for (let i = 0; i < 3; i++) { const [x, z] = W2(7.2 + i * 1.3, 10 + (i % 2 ? 0.5 : -0.5)); person({ mode: 'jump', x, z, y: b(0) - 0.1, act: 'cheer', hop: 0.5, kid: true }); }
  { const [x0, z0] = W2(-17, HZ + 1.2), [x1, z1] = W2(17, HZ + 9); wanderer(x0, x1, z0, z1, 8); }
  for (const [nm, c, lx] of [['Kak Gita', '#3fb25a', -4], ['Dek Riko', '#ffd23a', 4]]) addNpc({ id: 'mall' + nm, name: nm, role: 'Pengunjung Mall', x: W2(lx, 7), face: 0, girl: nm === 'Kak Gita', shirt: c, pants: '#2c2f3a', scale: nm === 'Dek Riko' ? 0.8 : 1, pitch: nm === 'Dek Riko' ? 0.4 : 0, wander: 3, lines: ['Mall ini lima lantai, lho! Naik lift kaca atau tangga.', 'Di lantai lima ada bioskop. Lantai empat food court!'] });
  place('toko', 'Mall Kota', '🏬', CXm, CZm, CXm, CZm + HZ + 4);
}
// layar bioskop: kartun sederhana berganti adegan
const FILM = [['🐢', '🐇', 'Kura-kura dan Kelinci lomba lari!'], ['🐇', '💤', 'Kelinci tertidur di bawah pohon...'], ['🐢', '🏁', 'Kura-kura terus berjalan pelan-pelan'], ['🐢', '🏆', 'Kura-kura menang! Pantang menyerah!'], ['🦌', '🐊', 'Si Kancil menghitung buaya'], ['🐜', '🕊️', 'Semut dan merpati saling menolong']];
function drawFilm(g, w, h, i) {
  const [a, b2, t] = FILM[i % FILM.length]; const grd = g.createLinearGradient(0, 0, 0, h); grd.addColorStop(0, '#7cc8f5'); grd.addColorStop(1, '#9be07f'); g.fillStyle = grd; g.fillRect(0, 0, w, h);
  g.textAlign = 'center'; g.textBaseline = 'middle'; g.font = `110px ${K.FONT}`; g.fillText(a, w * 0.32, h * 0.45); g.fillText(b2, w * 0.68, h * 0.45);
  g.fillStyle = 'rgba(0,0,0,0.55)'; g.fillRect(0, h - 52, w, 52); g.fillStyle = '#ffffff'; g.font = `700 26px ${K.FONT}`; g.fillText(t, w / 2, h - 26);
}

// teater terbuka: panggung, tirai, bangku penonton. Pertunjukan dijalankan game.js
export const THEATER = { actors: [], props: null, light: null };
function buildTheater() {
  const x = -72, z = 36; flat(x, 24, 36, 34, '#d9cba8', 0.05);
  B(x, z, 16, 6, 1.2, '#8a5a35', 0, true); deco(x, z, 16.2, 6.2, 0.1, '#a5764a', 1.2);
  deco(x, z + 3.4, 18, 0.4, 7, '#5b3b22'); for (const sx of [-1, 1]) { deco(x + sx * 8.6, z, 1.4, 6.4, 7.2, '#c0392b'); deco(x + sx * 7.4, z - 1.5, 1.2, 0.3, 5.5, '#e8434b', 1.2); }
  deco(x, z, 18.4, 7, 0.6, '#c0392b', 7.2); deco(x, z - 3.3, 18.4, 0.3, 1.2, '#ffd23a', 6.2);
  for (let r = 0; r < 4; r++) B(x, 26 - r * 3, 14, 0.7, 0.45, r % 2 ? '#3a7cf5' : '#e8434b', 0, true);
  const sp = sign('🎭 TEATER KOTA', 5.4, { bg: '#ffd23a' }); const [sx, sz] = L(x, z - 3.4); sp.position.set(sx, 8.4, sz); CDYN.add(sp);
  SPOTS.theater = { ...counter(x + 9, 12, Math.PI, '#c0392b', '🎭 Pilih cerita · 🪙 3', { id: 'teater', name: 'Kak Doni', role: 'Sutradara Teater', shirt: '#c0392b', pants: '#2c2f3a', pitch: -0.1 }), kind: 'theater' };
  const [ax, az] = L(x, z); Object.assign(THEATER, { x0: ax - 6.5, x1: ax + 6.5, z: az, y: 1.2, seat: L(x, 23), back: [ax - 8.5, az + 1.5] });
  for (let i = 0; i < 4; i++) { const ch = K.makeCharacter({ shirt: '#ffffff', pants: '#2c2f3a', skin: '#e3ac83' }); ch.skinColor = '#e3ac83'; ch.root.visible = false; ch.root.traverse((o) => { if (o.isMesh) o.castShadow = false; }); CDYN.add(ch.root); THEATER.actors.push(ch); }
  THEATER.props = new THREE.Group(); CDYN.add(THEATER.props);
  const light = new THREE.Mesh(new THREE.OctahedronGeometry(0.7), new THREE.MeshBasicMaterial({ color: '#fff3c4', transparent: true, opacity: 0.85 })); light.visible = false; CDYN.add(light); THEATER.light = light;
  place('teater', 'Teater Kota', '🎭', x, z, x + 9, 8);
}
// istana balon (gratis, memantul) & bom-bom car & kora-kora
export const BUMPER = { x: 25, z: 37.6, hx: 18.4, hz: 6, price: 2, ai: [] };
export const KORA = { x: 73, z: 40, pivotY: 7.6, len: 5.4, rest: 8, swing: 28, price: 3, seats: [-2.6, -1.3, 0, 1.3, 2.6] };
function buildMoreFun() {
  // istana balon
  { const x = 84, z = 12; const [wx, wz] = L(x, z);
    K.box(8, 0.8, 7, '#ff8fc0', wx, 0.4, wz, root); addSolid(wx, wz, 3.6, 3.1, 0, 0.8, 0, { bounce: 11 });
    for (const [ox, oz] of [[-3.8, -3.3], [3.8, -3.3], [-3.8, 3.3], [3.8, 3.3]]) { K.box(1.2, 4, 1.2, ['#ffd23a', '#7cc8f5', '#3fb25a', '#e8434b'][(ox > 0) + 2 * (oz > 0)], wx + ox, 2, wz + oz, root); K.box(1.4, 1, 1.4, '#ffffff', wx + ox, 4.5, wz + oz, root); addSolid(wx + ox, wz + oz, 0.6, 0.6, 0, 5); }
    for (const [ox, oz, w, d] of [[0, 3.4, 6.4, 0.5], [-3.9, 0, 0.5, 5.4], [3.9, 0, 0.5, 5.4]]) { K.box(w, 1.6, d, '#9a62e0', wx + ox, 1.6, wz + oz, root); addSolid(wx + ox, wz + oz, w / 2, d / 2, 0.8, 2.6); }
    const sp = sign('🏰 Istana Balon · gratis', 4, { bg: '#ff8fc0' }); sp.position.set(wx, 6.2, wz); CDYN.add(sp); }
  // bom-bom car: arena luas berpagar bantalan, tiang lampu warna-warni, 6 mobil otomatis
  { const { x, z, hx, hz } = BUMPER; const [wx, wz] = L(x, z); K.box(hx * 2 + 1, 0.06, hz * 2 + 1, '#5b6b8c', wx, 0.04, wz, root, false);
    for (let i = 0; i < 8; i++) K.box(0.3, 0.02, hz * 2, '#6d7da0', wx - hx + (i + 0.5) * (hx / 4), 0.08, wz, root, false);
    const gate = 13.5; // celah pintu di pagar selatan
    const a0 = -hx - 0.5, a1 = hx + 0.5, g0 = gate - 1.6, g1 = gate + 1.6;
    for (const [ox, oz, w, d] of [[0, hz + 0.3, hx * 2 + 1, 0.4], [(a0 + g0) / 2, -hz - 0.3, g0 - a0, 0.4], [(g1 + a1) / 2, -hz - 0.3, a1 - g1, 0.4], [hx + 0.3, 0, 0.4, hz * 2 + 1], [-hx - 0.3, 0, 0.4, hz * 2 + 1]]) {
      K.box(w, 0.8, d, '#ffd23a', wx + ox, 0.4, wz + oz, root); K.box(w + 0.05, 0.2, d + 0.05, '#e8434b', wx + ox, 0.7, wz + oz, root, false); addSolid(wx + ox, wz + oz, w / 2, d / 2, 0, 0.8);
    }
    const cols = ['#e8434b', '#ffd23a', '#3fb25a', '#3a7cf5', '#ff8fc0', '#9a62e0'];
    for (let i = 0; i <= 6; i++) for (const sz of [-1, 1]) { const px = wx - hx + i * (hx / 3), pz = wz + sz * (hz + 0.3); S('cyl', 0.25, 5, 0.25, '#ffffff', px, 2.5, pz); S('sph', 0.7, 0.7, 0.7, cols[i % 6], px, 5.2, pz); }
    for (let i = 0; i < 6; i++) { const m = makeBumper(['#3fb25a', '#3a7cf5', '#ff8a2a', '#ffd23a', '#9a62e0', '#ff8fc0'][i]); CDYN.add(m); BUMPER.ai.push({ m, x: wx + (i - 2.5) * 5, z: wz + (i % 2 ? 2.5 : -2.5), vx: (2.2 + (i % 3) * 0.5) * (i % 2 ? 1 : -1), vz: (1.6 + (i % 2) * 0.6) * (i % 3 ? 1 : -1) }); }
    BUMPER.cx = wx; BUMPER.cz = wz; BUMPER.half = hz;
    SPOTS.bumper = { x: wx + gate, z: wz - hz - 1.9, kind: 'bumper' };
    const sp = sign(`🚗 Arena Bom-bom Car · 🪙 ${BUMPER.price}`, 5, { bg: '#ffd23a' }); sp.position.set(wx, 6.4, wz - hz - 0.4); CDYN.add(sp);
    addNpc({ id: 'bombom', name: 'Kak Tia', role: 'Penjaga Bom-bom Car', x: [wx + gate + 2.2, wz - hz - 1.4], face: Math.PI, girl: true, shirt: '#ffd23a', pants: '#e8434b', pitch: 0.15, lines: ['Arenanya luas! Ayo tabrak-tabrakan main-main, ya.', 'Pegang setir erat-erat. Tiiin tiiin!'] }); }
  // kora-kora: perahu besar berayun
  { const { x, z, pivotY } = KORA; const [wx, wz] = L(x, z);
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) { const m = K.box(0.4, 8.4, 0.4, '#2c2f3a', wx + sx * 2.4, 3.8, wz + sz * 2.2, root); m.rotation.z = -sx * 0.3; }
    K.box(1, 0.5, 5, '#2c2f3a', wx, pivotY, wz, root); addSolid(wx, wz, 3.2, 2.6, 0, 0.6);
    const g = new THREE.Group(); g.position.set(wx, pivotY, wz); CDYN.add(g); KORA.g = g;
    K.box(0.3, KORA.len, 0.3, '#c8ccd6', 0, -KORA.len / 2, 1.6, g, false); K.box(0.3, KORA.len, 0.3, '#c8ccd6', 0, -KORA.len / 2, -1.6, g, false);
    K.box(8, 1.4, 3, '#8a5a35', 0, -KORA.len - 0.6, 0, g, false); K.box(8.4, 0.3, 3.2, '#ffd23a', 0, -KORA.len + 0.1, 0, g, false);
    K.box(1, 2.4, 3, '#8a5a35', -4.3, -KORA.len + 0.2, 0, g, false); K.box(1, 2.4, 3, '#8a5a35', 4.3, -KORA.len + 0.2, 0, g, false);
    for (const sx of KORA.seats) K.box(0.9, 0.4, 2.6, '#e8434b', sx, -KORA.len - 0.2, 0, g, false);
    const fl = K.box(0.06, 0.8, 1.2, '#1d1d1d', 4.6, -KORA.len + 2, 0, g, false); void fl;
    SPOTS.kora = { x: wx, z: wz - 4.2, kind: 'kora' };
    const sp = sign(`🏴‍☠️ Kora-kora · 🪙 ${KORA.price}`, 4, { bg: '#ffd23a' }); sp.position.set(wx, pivotY + 2.4, wz); CDYN.add(sp); }
}
export function makeBumper(col = '#e8434b') {
  const g = new THREE.Group();
  K.box(1.6, 0.5, 2.0, col, 0, 0.35, 0, g); K.box(1.8, 0.25, 2.2, '#1d1d1d', 0, 0.2, 0, g); K.box(0.8, 0.5, 0.6, '#2c2f3a', 0, 0.75, -0.4, g); K.box(0.06, 2.2, 0.06, '#c8ccd6', 0, 1.6, -0.8, g, false);
  return g;
}
const koraState = (t) => { const C = KORA.rest + KORA.swing, u = ((t % C) + C) % C; if (u < KORA.rest) return { rest: true, a: 0, left: KORA.rest - u }; const k = (u - KORA.rest) / KORA.swing, amp = 1.15 * Math.sin(Math.PI * k); return { rest: false, a: amp * Math.sin((u - KORA.rest) * 1.35), left: KORA.swing - (u - KORA.rest) }; };

/* =========================================================
   ROLLER COASTER: mengelilingi pulau, naik sampai 32 m, turunan & tikungan miring
   ========================================================= */
export const COASTER = { price: 5, dwell: 14, seats: 6, n: 0, cars: [], pos: [], q: [], camYaw: [], pitch: [], loopAt: [], cumT: [], lap: 0, s0: 0, gap: 0 };
const LOOP = { x: -58, z: 130, y: 3.5, r: 8 }; // putaran vertikal di atas laut, sisi utara
function buildCoaster() {
  const lp = []; for (let k = 1; k < 16; k++) { const th = (k / 16) * TAU; lp.push([LOOP.x + Math.sin(th) * LOOP.r, LOOP.z + (3 * k) / 16, LOOP.y + LOOP.r * (1 - Math.cos(th))]); }
  const P = [[-115, 40, 3], [-115, 70, 3], [-118, 95, 12], [-110, 118, 32], [-88, 129, 7], [-72, 130, LOOP.y], [LOOP.x, LOOP.z, LOOP.y], ...lp, [LOOP.x, LOOP.z + 3, LOOP.y], [-44, 133, LOOP.y], [-26, 131, 13], [0, 127, 8], [40, 130, 23], [80, 128, 10], [115, 115, 15], [130, 80, 8], [128, 40, 21], [126, 0, 6], [128, -40, 17], [120, -100, 10], [95, -128, 19], [60, -131, 12], [20, -133, 17], [-20, -130, 8], [-60, -128, 21], [-100, -122, 10], [-128, -90, 15], [-126, -40, 7], [-118, 10, 4]]
    .map(([x, z, y]) => new THREE.Vector3(CX + x, y, CZ + z));
  const curve = new THREE.CatmullRomCurve3(P, true, 'centripetal');
  const N = Math.round(curve.getLength() / 1.0); const pts = curve.getSpacedPoints(N); pts.pop();
  const C = COASTER, n = (C.n = pts.length); C.pos = pts; const ds = curve.getLength() / n; C.gap = 2.7 / ds;
  const wrap = (a) => Math.atan2(Math.sin(a), Math.cos(a)), at = (i) => ((i % n) + n) % n;
  const inLoop = (p) => Math.abs(p.x - CX - LOOP.x) < LOOP.r + 2.5 && p.z - CZ > LOOP.z - 1 && p.z - CZ < LOOP.z + 4.5;
  const T = pts.map((p, i) => pts[at(i + 1)].clone().sub(pts[at(i - 1)]).normalize());
  const yaw = T.map((t) => Math.atan2(t.x, t.z)), loopI = pts.map(inLoop);
  const nearLoop = pts.map((p, i) => { for (let k = -14; k <= 14; k++) if (loopI[at(i + k)]) return true; return false; });
  // kemiringan di tikungan (dihaluskan, nol di sekitar putaran)
  let roll = pts.map((p, i) => (nearLoop[i] ? 0 : clamp(-wrap(yaw[at(i + 5)] - yaw[at(i - 5)]) * 2.0, -0.7, 0.7)));
  for (let pass = 0; pass < 3; pass++) roll = roll.map((r, i) => { let sum = 0; for (let k = -6; k <= 6; k++) sum += roll[at(i + k)]; return sum / 13; });
  // arah "atas" rel: biasanya ke langit; di putaran diteruskan (parallel transport) sehingga gerbong terbalik di puncak
  const up = new THREE.Vector3(0, 1, 0), WU = new THREE.Vector3(0, 1, 0), X = new THREE.Vector3(), Y = new THREE.Vector3(), M = new THREE.Matrix4(), qr = new THREE.Quaternion(), Z = new THREE.Vector3(0, 0, 1);
  const loopYaw = Math.PI / 2;
  for (let i = 0; i < n; i++) {
    const t = T[i];
    if (loopI[i]) up.sub(t.clone().multiplyScalar(t.dot(up))).normalize(); else up.copy(WU).sub(t.clone().multiplyScalar(t.y)).normalize();
    X.crossVectors(up, t).normalize(); Y.crossVectors(t, X); M.makeBasis(X, Y, t);
    const q = new THREE.Quaternion().setFromRotationMatrix(M).multiply(qr.setFromAxisAngle(Z, roll[i]));
    C.q.push(q); C.pitch.push(Math.asin(clamp(t.y, -1, 1))); C.camYaw.push(nearLoop[i] && loopI.some((v, k) => v && Math.abs(k - i) < 30) ? loopYaw : yaw[i]); C.loopAt.push(loopI[i]);
  }
  // stasiun di pantai barat; mulai pelan, tanjakan rantai sampai puncak, meluncur (makin rendah makin cepat), rem halus sebelum stasiun
  let best = 1e9; const st = new THREE.Vector3(CX - 115, 3, CZ + 55); pts.forEach((p, i) => { const d = p.distanceTo(st); if (d < best) { best = d; C.s0 = i; } });
  let top = 0; pts.forEach((p, i) => { if (p.y > pts[top].y) top = i; }); const ymax = pts[top].y, liftN = at(top - C.s0);
  C.cumT = [0];
  for (let k = 0; k < n; k++) {
    const i = at(C.s0 + k); let v = k <= liftN ? Math.min(4.5, 1.2 + k * 0.12) : Math.max(6, Math.sqrt(2 * 9.8 * (ymax + 1.5 - pts[i].y)) * 0.9);
    v = Math.min(v, 2 + (n - k) * ds * 0.22); C.cumT.push(C.cumT[k] + ds / v);
  }
  C.lap = C.cumT[n]; C.T = C.lap + C.dwell;
  // rel mulus (tabung), batang tengah, bantalan, tiang
  const side = new THREE.Vector3(), down = new THREE.Vector3(), rails = [[], [], []];
  for (let i = 0; i < n; i++) {
    const p = pts[i], q = C.q[i]; side.set(1, 0, 0).applyQuaternion(q); down.set(0, -1, 0).applyQuaternion(q);
    rails[0].push(p.clone().addScaledVector(side, -0.55)); rails[1].push(p.clone().addScaledVector(side, 0.55)); rails[2].push(p.clone().addScaledVector(down, 0.42));
    if (i % 2 === 0) { const m = K.box(1.35, 0.1, 0.24, '#5b6b8c', p.x + down.x * 0.14, p.y + down.y * 0.14, p.z + down.z * 0.14, root, false); m.quaternion.copy(q); }
    if (i % 6 === 0 && p.y > 1.5 && !nearLoop[i] && down.y < -0.5) {
      const lx = p.x - CX, lz = p.z - CZ; if (lz < -108 && lx > 18 && lx < 42) continue; // jalur kapal
      const base = W.inCity(p.x, p.z) ? 0 : -1.2, h = p.y - 0.55 - base; K.box(0.35, h, 0.35, '#c8ccd6', p.x, base + h / 2, p.z, root, false);
    }
  }
  [['#e8434b', 0.09], ['#e8434b', 0.09], ['#ffd23a', 0.2]].forEach(([c, r], k) => { const m = new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(rails[k], true), n * 2, r, 6, true), K.mat(c)); m.castShadow = true; root.add(m); });
  // kaki penyangga putaran
  for (const sx of [-1, 1]) { const [lx, lz] = L(LOOP.x + sx * (LOOP.r + 0.5), LOOP.z + 1.5); const h = LOOP.y + LOOP.r + 1.2; K.box(0.6, h, 0.6, '#c8ccd6', lx, -1.2 + h / 2, lz, root); K.box(0.5, 0.5, 4, '#c8ccd6', lx, LOOP.y + LOOP.r, lz, root, false); }
  // 3 gerbong x 2 kursi = 6 penumpang; gerbong depan berhidung
  const cols = ['#e8434b', '#ffd23a', '#3a7cf5'];
  for (let k = 0; k < 3; k++) {
    const g = new THREE.Group(); CDYN.add(g);
    K.box(1.6, 0.5, 2.2, cols[k], 0, 0.42, 0, g); K.box(1.64, 0.14, 2.24, '#ffffff', 0, 0.72, 0, g, false); K.box(1.6, 0.7, 0.25, cols[k], 0, 0.95, -1.0, g);
    K.box(1.3, 0.1, 0.1, '#2c2f3a', 0, 1.15, 0.55, g, false); for (const sx of [-0.62, 0.62]) K.box(0.08, 0.5, 0.08, '#2c2f3a', sx, 0.95, 0.55, g, false);
    for (const sx of [-0.7, 0.7]) for (const sz of [-0.7, 0.7]) K.box(0.18, 0.3, 0.4, '#2c2f3a', sx, 0.08, sz, g, false);
    if (k === 0) { const nose = K.box(1.5, 0.45, 1.0, cols[k], 0, 0.5, 1.45, g); nose.rotation.x = 0.35; S('sph', 0.35, 0.35, 0.2, '#fff3a0', 0, 0.62, 1.95, g, false); }
    C.cars.push(g);
  }
  // peron stasiun + tangga + gerbang antre
  const [px, pz] = L(-111.4, 55); K.box(3, 2.5, 30, '#cfd3d8', px, 1.25, pz, root); addSolid(px, pz, 1.5, 15, 0, 2.5);
  for (let i = 0; i < 5; i++) { K.box(3, 0.5 * (i + 1), 1, '#bba57a', px, 0.25 * (i + 1), pz - 15.5 - (4 - i), root); addSolid(px, pz - 15.5 - (4 - i), 1.5, 0.5, 0, 0.5 * (i + 1)); }
  K.box(3.4, 0.2, 12, '#e8434b', px, 5.4, pz, root); for (const sz of [-5.5, 5.5]) K.box(0.2, 2.9, 0.2, '#2c2f3a', px + 1.3, 3.95, pz + sz, root);
  SPOTS.coaster = { x: px - 0.4, z: pz, y: 2.5, kind: 'coaster' };
  const sp = sign(`🎢 Roller Coaster · 🪙 ${C.price} · 6 kursi`, 5.4, { bg: '#ffd23a' }); sp.position.set(px, 7, pz); CDYN.add(sp);
  place('coaster', 'Roller Coaster', '🎢', -111, 55, -108, 36);
}
function coasterState(t) {
  const C = COASTER, u = ((t % C.T) + C.T) % C.T;
  if (u < C.dwell) return { s: C.s0, station: true, left: C.dwell - u };
  const r = u - C.dwell; let lo = 0, hi = C.n; while (hi - lo > 1) { const m = (lo + hi) >> 1; if (C.cumT[m] <= r) lo = m; else hi = m; }
  const frac = clamp((r - C.cumT[lo]) / (C.cumT[lo + 1] - C.cumT[lo]), 0, 1); return { s: C.s0 + lo + frac, station: false, left: C.T - u };
}
// pose di titik lintasan s (pecahan): posisi & arah diinterpolasi supaya gerak mulus, tidak patah-patah
const _q = new THREE.Quaternion();
function coasterPose(s) {
  const C = COASTER, n = C.n, f0 = Math.floor(s), f = s - f0, i = ((f0 % n) + n) % n, j = (i + 1) % n, a = C.pos[i], b = C.pos[j];
  let dy = C.camYaw[j] - C.camYaw[i]; dy = Math.atan2(Math.sin(dy), Math.cos(dy));
  return { x: a.x + (b.x - a.x) * f, y: a.y + (b.y - a.y) * f, z: a.z + (b.z - a.z) * f, q: _q.copy(C.q[i]).slerp(C.q[j], f).clone(), yaw: C.camYaw[i] + dy * f, pitch: C.pitch[i] + (C.pitch[j] - C.pitch[i]) * f, loop: C.loopAt[i] };
}
// posisi kursi (0..5) sekarang: untuk memeriksa kursi yang sudah terisi pemain lain
export function coasterSeat(seat) { const st = coasterState(nowS()), p = coasterPose(st.s - Math.floor(seat / 2) * COASTER.gap), o = new THREE.Vector3(seat % 2 ? 0.42 : -0.42, 0.15, -0.1).applyQuaternion(p.q); return { x: p.x + o.x, y: p.y + o.y, z: p.z + o.z }; }

// polisi & pemadam: bunyikan sirene (gratis, seru)
// polantas cilik: kuis aturan lalu lintas di perempatan tengah
function talkTraffic(api) {
  const Q = [
    ['Lampu lalu lintas warnanya merah. Mobil harus apa?', ['🛑 Berhenti', '🚗 Jalan terus', '🏃 Ngebut'], 0, 'Betul! Merah artinya berhenti.', 'Belum tepat. Merah artinya berhenti.'],
    ['Lampunya hijau. Mobil boleh apa?', ['🚗 Jalan', '🛑 Berhenti', '😴 Tidur'], 0, 'Pintar! Hijau artinya boleh jalan.', 'Hijau artinya boleh jalan, ya.'],
    ['Kalau mau menyeberang jalan, lewat mana?', ['🦓 Zebra cross', '🚗 Tengah jalan', '🌳 Lewat taman'], 0, 'Hebat! Menyeberang di zebra cross dan lihat kiri-kanan.', 'Menyeberang lewat zebra cross, ya. Itu lebih aman.'],
    ['Lampu kuning artinya apa?', ['⚠️ Hati-hati', '🏁 Lomba', '🎉 Pesta'], 0, 'Betul! Kuning artinya hati-hati, siap-siap berhenti.', 'Kuning artinya hati-hati.'],
    ['Saat naik mobil, kita harus pakai apa?', ['🔒 Sabuk pengaman', '🎩 Topi', '🧤 Sarung tangan'], 0, 'Betul! Sabuk pengaman menjaga kita tetap aman.', 'Pakai sabuk pengaman, ya!'],
    ['Sebelum menyeberang, kita lihat ke mana?', ['👀 Kiri dan kanan', '⬆️ Ke atas', '⬇️ Ke bawah'], 0, 'Pintar! Lihat kiri dan kanan dulu.', 'Lihat kiri dan kanan dulu, ya.'],
  ];
  const [q, opts, right, good, bad] = pick(Q); const o = shuffle(opts.map((t, i) => [t, i === right]));
  api.ask(q, o.map((x) => x[0]), o.findIndex((x) => x[1]), good, bad);
}
// arena balap: lewati 4 gerbang di jalan lingkar lalu kembali ke garis finis
export const RACE = { price: 3, gates: [], start: null };
function buildRace() {
  const gate = (x, z, label, col) => {
    const [wx, wz] = L(x, z);
    for (const s of [-1, 1]) { const across = Math.abs(x) > 90; const [px, pz] = across ? [wx + s * 5, wz] : [wx, wz + s * 5]; K.box(0.4, 5, 0.4, col, px, 2.5, pz, root); }
    const sp = sign(label, 4, { bg: col === '#ffffff' ? '#ffffff' : '#ffd23a' }); sp.position.set(wx, 5.4, wz); CDYN.add(sp);
    return [wx, wz];
  };
  // gerbang di tengah tikungan jalan lingkar (tiang searah jari-jari tikungan)
  const corner = (sx, sz, label) => { const E = 96 - RC, c = RC / Math.SQRT2, [wx, wz] = L(sx * (E + c), sz * (E + c)); for (const s of [-1, 1]) K.box(0.4, 5, 0.4, '#e8434b', wx + s * sx * 3.3, 2.5, wz + s * sz * 3.3, root); const sp = sign(label, 4, { bg: '#ffd23a' }); sp.position.set(wx, 5.4, wz); CDYN.add(sp); return [wx, wz]; };
  RACE.gates = [corner(1, 1, '🏁 Gerbang 1'), corner(-1, 1, '🏁 Gerbang 2'), corner(-1, -1, '🏁 Gerbang 3'), corner(1, -1, '🏁 Gerbang 4'), gate(96, -60, '🏆 FINIS', '#ffffff')];
  for (let i = -3; i <= 3; i++) for (let k = 0; k < 2; k++) flat(96 + i * 1.1, -60 + (k ? 0.55 : -0.55), 1.1, 0.55, (i + k) % 2 ? '#1d1d1d' : '#ffffff', 0.1);
  const [sx, sz] = L(96, -52); RACE.start = [sx, sz]; RACE.yaw = 0;
  SPOTS.race = { ...counter(89, -50, Math.PI / 2, '#e8434b', `🏎️ Lomba Balap · 🪙 ${RACE.price}`, { id: 'balap', name: 'Bang Rizki', role: 'Panitia Balap', shirt: '#e8434b', pants: '#1d1d1d', pitch: -0.2 }), kind: 'race' };
  place('balap', 'Arena Balap', '🏎️', 92, -56, 84, -50);
}
export function makeKart() {
  const g = new THREE.Group();
  K.box(1.5, 0.45, 2.6, '#e8434b', 0, 0.45, 0, g); K.box(1.0, 0.5, 0.9, '#1d1d1d', 0, 0.85, -0.3, g); K.box(1.6, 0.12, 0.5, '#ffd23a', 0, 0.75, -1.3, g);
  for (const sx of [-0.8, 0.8]) for (const sz of [-0.9, 0.9]) K.box(0.35, 0.5, 0.5, '#1d1d1d', sx, 0.25, sz, g, false);
  const n = sign('7', 0.6, { bg: '#ffffff', w: 128, h: 128 }); n.scale.set(0.5, 0.5, 1); n.position.set(0, 0.95, 1.1); g.add(n);
  return g;
}
// kereta keliling kota: jalur bertikungan bulat di tepi pulau, jembatan layang di barat laut, terowongan bukit di timur, 4 stasiun
const TRAIN = { r: 106, rc: 32, speed: 10, dwell: 7, price: 2, gap: 6.6, names: ['Selatan', 'Timur', 'Utara', 'Barat'], stops: [], seg: [], T: 0, cars: [], puffs: [] };
TRAIN.side = 2 * (TRAIN.r - TRAIN.rc) + (Math.PI / 2) * TRAIN.rc; TRAIN.len = 4 * TRAIN.side;
TRAIN.stopD = [0, 1, 2, 3].map((k) => k * TRAIN.side + (TRAIN.r - TRAIN.rc) - 30);
// kursi: [gerbong, x, y, z] — 3 gerbong penumpang x 4 kursi
const TRAIN_SEATS = [1, 2, 3].flatMap((k) => [[k, 0.55, 0.45, 1.4], [k, -0.55, 0.45, 1.4], [k, 0.55, 0.45, -1.4], [k, -0.55, 0.45, -1.4]]);
const sstep = (a, b, x) => { const k = clamp((x - a) / (b - a), 0, 1); return k * k * (3 - 2 * k); };
function trainH(d) { const S2 = TRAIN.side; d = ((d % TRAIN.len) + TRAIN.len) % TRAIN.len; return 6.5 * sstep(2 * S2 + 62, 2 * S2 + 88, d) * (1 - sstep(3 * S2 + 4, 3 * S2 + 30, d)); }
function trainPoint(d) { const [x, z, yaw] = rrPoint(TRAIN.r, TRAIN.rc, d), y = trainH(d), pitch = Math.atan2(trainH(d + 1) - trainH(d - 1), 2); return { x, z, y, yaw, pitch }; }
function buildTrain() {
  const R = TRAIN, P = R.len, railL = [], railR = [], off = new THREE.Vector3();
  for (let d = 0; d < P; d += 1.6) {
    const p = trainPoint(d), [wx, wz] = L(p.x, p.z), cy = Math.cos(p.yaw), sy = Math.sin(p.yaw);
    const m = K.box(2.8, 0.14, 0.4, '#7a5432', wx, p.y + 0.07, wz, root, false); m.rotation.set(0, p.yaw, 0);
    for (const [arr, s2] of [[railL, -0.7], [railR, 0.7]]) { off.set(cy * s2, 0, -sy * s2); arr.push(new THREE.Vector3(wx + off.x, p.y + 0.2, wz + off.z)); }
    if (p.y > 0.4) { // jembatan layang: lantai beton, pagar, tiang
      const dk = K.box(3.6, 0.6, 1.7, '#cfd3d8', wx, p.y - 0.3, wz, root); dk.rotation.set(-p.pitch, p.yaw, 0, 'YXZ');
      for (const s2 of [-1.75, 1.75]) { const g = K.box(0.15, 0.6, 1.7, '#e8434b', wx + cy * s2, p.y + 0.3, wz - sy * s2, root, false); g.rotation.set(-p.pitch, p.yaw, 0, 'YXZ'); }
      if (Math.round(d / 1.6) % 5 === 0 && p.y > 1.6) { const h = p.y - 0.6; K.box(1.1, h, 1.1, '#b8bec4', wx, h / 2, wz, root); K.box(3.2, 0.5, 1.3, '#b8bec4', wx, h - 0.25, wz, root, false).rotation.y = p.yaw; addSolid(wx, wz, 0.55, 0.55, 0, h); }
    }
  }
  for (const arr of [railL, railR]) { const m = new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(arr, true), arr.length * 2, 0.08, 5, true), K.mat('#9aa0a6')); root.add(m); }
  // bukit & terowongan
  { const [hx, hz] = L(HILL.x, HILL.z), hillMat = new THREE.MeshLambertMaterial({ color: '#5fb953', side: THREE.DoubleSide });
    S('dome', HILL.rx * 2, HILL.h * 2, HILL.rz * 2, hillMat, hx, 0, hz);
    for (let gx = -HILL.rx; gx <= HILL.rx; gx += 2) for (let gz = -HILL.rz; gz <= HILL.rz; gz += 2) {
      const k = (gx / HILL.rx) ** 2 + (gz / HILL.rz) ** 2; if (k > 0.8 || Math.abs(HILL.x + gx - R.r) < 2.8) continue;
      addSolid(hx + gx, hz + gz, 1, 1, 0, HILL.h * Math.sqrt(1 - k) - 0.4);
    }
    for (const sz of [-1, 1]) { // mulut terowongan dari batu
      const z = HILL.z + sz * 13.6, st = '#a8a294';
      B(R.r - 2.0, z, 0.8, 0.8, 6, st, 0, true); B(R.r + 5, z, 6.6, 0.8, 6, st, 0, true); B(R.r + 0.05, z, 3.4, 0.8, 1.6, st, 4.4);
      deco(R.r + 0.6, z, 4.8, 0.9, 0.3, '#8a8478', 6);
    }
    const sp = sign('🚇 Terowongan Bukit', 4, { bg: '#ffffff' }); const [sx, sz] = L(R.r + 0.25, HILL.z - 14.2); sp.position.set(sx, 7.2, sz); CDYN.add(sp);
    for (const [ox, oz] of [[3, -4], [4.5, 3], [2, 8]]) { const k = (ox / HILL.rx) ** 2 + (oz / HILL.rz) ** 2, y = HILL.h * Math.sqrt(1 - k); const [tx, tz] = L(HILL.x + ox, HILL.z + oz); S('cyl', 0.4, 1.6, 0.4, '#8a5a35', tx, y + 0.5, tz); S('sph', 2.4, 2.2, 2.4, '#3fae4f', tx, y + 2.2, tz); }
  }
  TRAIN.seg = TRAIN.stopD.map((d, i) => { const dist = (TRAIN.stopD[(i + 1) % 4] - d + P) % P; return { dist, dur: dist / TRAIN.speed }; });
  TRAIN.T = TRAIN.seg.reduce((t, s) => t + TRAIN.dwell + s.dur, 0);
  // stasiun: peron, atap lengkung, bangku, jam, pot bunga
  TRAIN.stopD.forEach((d, i) => {
    const [x, z] = rrPoint(R.r, R.rc, d), [nx, nz] = SIDE_N[i];
    const f = frame(...L(x + nx * 4.6, z + nz * 4.6), Math.atan2(-nx, -nz));
    f.solid(0, 0, 10, 2.6, 0, 0.45, '#cfd3d8'); f.deco(0, 1.25, 10, 0.12, 0.45, 0.04, '#ffd23a', f.g, false);
    for (const sx of [-4, 0, 4]) S('cyl', 0.2, 3.2, 0.2, '#ffffff', sx, 2.05, -0.7, f.g, false);
    { const m = S('cyl', 1.0, 10.6, 3.4, '#e8434b', 0, 3.75, -0.1, f.g); m.rotation.z = Math.PI / 2; }
    f.solid(-2, -0.75, 2.6, 0.5, 0.45, 0.45, '#a5764a'); f.solid(2, -0.75, 2.6, 0.5, 0.45, 0.45, '#a5764a');
    { const c = S('cyl', 0.9, 0.12, 0.9, '#ffffff', 0, 3.0, 0.15, f.g, false); c.rotation.x = Math.PI / 2; f.deco(0, 0.22, 0.06, 0.04, 2.95, 0.3, '#1d1d1d', f.g, false); }
    for (const sx of [-4.6, 4.6]) { S('cyl', 0.7, 0.6, 0.7, '#b5523b', sx, 0.75, -0.8, f.g); S('sph', 0.8, 0.6, 0.8, pick(['#ff8fc0', '#ffd23a', '#e8434b']), sx, 1.2, -0.8, f.g, false); }
    const sp = sign(`🚉 Stasiun ${TRAIN.names[i]}`, 3.6, { bg: '#ffffff' }); putW(f, sp, 0, 4.9, -0.1, CDYN);
    const [wx, wz] = L(x + nx * 3, z + nz * 3); TRAIN.stops.push({ i, name: `Stasiun ${TRAIN.names[i]}`, x: wx, z: wz });
    if (i === 0) place('stasiun', 'Stasiun Kereta', '🚂', x + nx * 4.6, z + nz * 4.6, x + nx * 2, z + nz * 2 - 4);
  });
  // lokomotif uap + 3 gerbong
  const cols = ['#3a7cf5', '#3fb25a', '#ff8a2a'];
  for (let k = 0; k < 4; k++) {
    const g = new THREE.Group(); CDYN.add(g); g.rotation.order = 'YXZ';
    K.box(2.4, 0.5, 5.6, '#2c2f3a', 0, 0.75, 0, g);
    for (const sz of [-1.8, 0, 1.8]) for (const sx of [-1.25, 1.25]) { if (k && !sz) continue; const w = S('cyl', 1.0, 0.22, 1.0, k ? '#1d1d1d' : '#e8434b', sx, 0.55, sz, g, false); w.rotation.z = Math.PI / 2; }
    if (k === 0) {
      const boiler = S('cyl', 1.8, 3.4, 1.8, '#e8434b', 0, 1.9, 0.9, g); boiler.rotation.x = Math.PI / 2;
      const front = S('cyl', 1.9, 0.4, 1.9, '#1d1d1d', 0, 1.9, 2.75, g, false); front.rotation.x = Math.PI / 2;
      for (const z of [0.1, 1.7]) { const band = S('cyl', 1.86, 0.15, 1.86, '#ffd23a', 0, 1.9, z, g, false); band.rotation.x = Math.PI / 2; }
      S('cyl', 0.55, 1.1, 0.55, '#1d1d1d', 0, 3.2, 2.0, g); S('cone', 0.95, 0.5, 0.95, '#1d1d1d', 0, 3.9, 2.0, g, false).rotation.x = Math.PI;
      S('sph', 0.7, 0.7, 0.7, '#ffd23a', 0, 2.85, 0.8, g, false); S('sph', 0.4, 0.4, 0.3, '#fff3a0', 0, 2.35, 2.95, g, false);
      K.box(2.3, 2.3, 1.9, '#e8434b', 0, 2.1, -1.6, g); K.box(2.0, 0.7, 1.92, '#bfe6ff', 0, 2.6, -1.6, g, false); K.box(2.7, 0.25, 2.3, '#1d1d1d', 0, 3.35, -1.6, g);
      const cc = K.box(2.2, 0.5, 0.8, '#ffd23a', 0, 0.6, 3.0, g); cc.rotation.x = -0.5;
    } else {
      K.box(2.4, 0.9, 5.4, cols[k - 1], 0, 1.4, 0, g); K.box(2.44, 0.14, 5.44, '#ffffff', 0, 1.9, 0, g, false);
      for (const z of [-2.55, 2.55]) for (const sx of [-1.12, 1.12]) S('cyl', 0.16, 1.5, 0.16, '#ffffff', sx, 2.65, z, g, false);
      const roof = S('cyl', 2.7, 5.8, 0.7, cols[k - 1], 0, 3.45, 0, g); roof.rotation.x = Math.PI / 2;
      for (const z of [1.4, -1.4]) K.box(2.0, 0.4, 0.6, '#ffd23a', 0, 2.05, z - 0.1, g, false);
    }
    TRAIN.cars.push(g);
  }
  for (let i = 0; i < 6; i++) { const m = new THREE.Mesh(geo('sph'), new THREE.MeshLambertMaterial({ color: '#ffffff', transparent: true, opacity: 0.7, depthWrite: false })); CDYN.add(m); TRAIN.puffs.push(m); }
}
function lineState(line, t) {
  let u = ((t % line.T) + line.T) % line.T; const n = line.stopD.length;
  for (let i = 0; i < n; i++) {
    const s = line.seg[i]; if (u < line.dwell) return { d: line.stopD[i], stop: i, next: i };
    u -= line.dwell; if (u < s.dur) return { d: line.stopD[i] + s.dist * ease(u / s.dur), stop: -1, next: (i + 1) % n };
    u -= s.dur;
  }
  return { d: line.stopD[0], stop: 0, next: 0 };
}
function trainCarPose(t, k) { const st = lineState(TRAIN, t), p = trainPoint(st.d - k * TRAIN.gap); const [wx, wz] = L(p.x, p.z); return { x: wx, z: wz, y: p.y, yaw: p.yaw, pitch: p.pitch, stop: st.stop, next: st.next }; }

// polisi & pemadam: bunyikan sirene (gratis, seru)
function sirenTalk(e, info) {
  return (api) => api.choose(`${info} Mau dengar sirenenya?`, ['🚨 Bunyikan sirene!', '👋 Nanti saja'], (i) => { if (i === 0) { api.siren(); api.say(`Nguing nguing! ${e} Siap bertugas!`); } });
}
function buildPeople() {
  const P = [
    ['Mas Bagus', 'Pekerja Kantor', -48, -84, '#3a7cf5', 'Selamat pagi! Aku mau naik bus ke kantor.'],
    ['Mbak Rina', 'Mahasiswi', 52, -60, '#ff8fc0', 'Aku suka ke perpustakaan. Bukunya banyak!'],
    ['Pak Tejo', 'Tukang Sapu', 0, 30, '#3fb25a', 'Jaga kebersihan kota, ya! Buang sampah di tempatnya.'],
    ['Bu Siti', 'Ibu Rumah Tangga', -60, 60, '#9a62e0', 'Mau belanja ke kota. Naik bus saja, lebih hemat!'],
    ['Andi', 'Anak Kota', 40, 40, '#ffd23a', 'Ayo naik bianglala! Dari atas kelihatan laut!'],
    ['Lala', 'Anak Kota', -36, 84, '#ff8a2a', 'Main ayunan di taman, yuk!'],
    ['Om Hendra', 'Pengemudi Taksi', 84, 0, '#ffd23a', 'Di perempatan, berhenti kalau lampunya merah.'],
    ['Kak Nisa', 'Fotografer', 6, -30, '#e8434b', 'Air mancur alun-alun bagus untuk difoto!'],
  ];
  P.forEach(([name, role, x, z, shirt, line], i) => addNpc({ id: `warga${i}`, name, role, x: L(x, z), face: 0, girl: /Mbak|Bu|Lala|Nisa/.test(name), shirt, pants: pick(['#2c2f3a', '#3b4a6b', '#5b3b22']), scale: /Anak/.test(role) ? 0.8 : 1, pitch: /Anak/.test(role) ? 0.4 : 0, wander: 7, lines: [line, 'Selamat datang di Pulau Kota!'] }));
}

/* =========================================================
   KENDARAAN UMUM & WAHANA (dipakai game.js)
   ========================================================= */
// cari wahana/kendaraan umum yang bisa dinaiki di dekat pemain
// perkiraan detik sampai kendaraan berhenti di halte/stasiun ke-i
function etaStop(stateAt, i, T) { const t = nowS(); for (let k = 0; k < T + 2; k += 0.5) if (stateAt(t + k).stop === i) return k; return T; }
export function transitNear(px, pz, py) {
  const t = nowS();
  for (const b of BUS.cars) {
    const p = busPose(b, t); if (p.stop < 0) continue;
    const s = BUS.stops[p.stop]; if (Math.hypot(px - s.x, pz - s.z) < 3.6 && py < 1) return { id: 'bus', bus: BUS.cars.indexOf(b), stop: p.stop, label: `🚌 Naik bus · 🪙 ${BUS.price}`, price: BUS.price };
  }
  for (const s of BUS.stops) if (Math.hypot(px - s.x, pz - s.z) < 3.6 && py < 1) return { id: 'bus', wait: true, label: `🚏 Halte ${s.name}`, left: Math.min(...BUS.cars.map((b) => etaStop((tt) => busPose(b, tt), s.i, BUS.T))) };
  const fs = ferryState(t);
  for (const [k, side] of FERRY.sides.entries()) {
    if (Math.hypot(px - side.wait[0], pz - side.wait[1]) > 3.8 || Math.abs(py - side.wait[2]) > 1.2) continue;
    if (fs.at === k) return { id: 'ferry', from: k, label: `⛴️ Naik kapal ke ${FERRY.sides[1 - k].name} · 🪙 ${FERRY.price}`, price: FERRY.price };
    return { id: 'ferry', wait: true, left: fs.at === -1 ? fs.left + (fs.to === k ? 0 : FERRY.dwell + FERRY.travel) : 0, label: '⛴️ Kapal' };
  }
  for (const s of TRAIN.stops) {
    if (Math.hypot(px - s.x, pz - s.z) > 3.6 || py > 1) continue;
    const ts = lineState(TRAIN, t);
    if (ts.stop === s.i) return { id: 'train', stop: s.i, label: `🚂 Naik kereta · 🪙 ${TRAIN.price}`, price: TRAIN.price };
    return { id: 'train', wait: true, label: `🚉 ${s.name}`, left: etaStop((tt) => lineState(TRAIN, tt), s.i, TRAIN.T) };
  }
  if (SPOTS.coaster && Math.hypot(px - SPOTS.coaster.x, pz - SPOTS.coaster.z) < 6 && Math.abs(py - SPOTS.coaster.y) < 1) {
    const cs = coasterState(t); return cs.station ? { id: 'coaster', label: `🎢 Naik roller coaster · 🪙 ${COASTER.price}`, price: COASTER.price } : { id: 'coaster', wait: true, label: '🎢 Roller coaster', left: cs.left };
  }
  if (SPOTS.kora && Math.hypot(px - SPOTS.kora.x, pz - SPOTS.kora.z) < 2.8) { const ks = koraState(t); return ks.rest ? { id: 'kora', label: `🏴‍☠️ Naik kora-kora · 🪙 ${KORA.price}`, price: KORA.price } : { id: 'kora', wait: true, label: '🏴‍☠️ Kora-kora', left: ks.left }; }
  if (SPOTS.wheel && Math.hypot(px - SPOTS.wheel.x, pz - SPOTS.wheel.z) < 2.6) return { id: 'wheel', label: `🎡 Naik bianglala · 🪙 ${WHEEL.price}`, price: WHEEL.price };
  if (SPOTS.carousel && Math.hypot(px - SPOTS.carousel.x, pz - SPOTS.carousel.z) < 2.6) return { id: 'carousel', label: `🎠 Naik komidi putar · 🪙 ${CAROUSEL.price}`, price: CAROUSEL.price };
  if (SPOTS.zip && Math.hypot(px - SPOTS.zip.x, pz - SPOTS.zip.z) < 2.4 && py < 1) return { id: 'zip', label: `🪂 Naik flying fox · 🪙 ${ZIP.price}`, price: ZIP.price };
  return playNear(px, pz, py);
}
// mulai menumpang: token menyimpan kursi & waktu naik
export function boardTransit(info, taken = []) {
  const t = nowS();
  if (info.id === 'bus') return { id: 'bus', bus: info.bus, seat: randi(0, BUS_SEATS.length - 1), t0: t, from: info.stop };
  if (info.id === 'coaster') { const free = [0, 1, 2, 3, 4, 5].filter((k) => !taken.includes(k)); if (!free.length) return null; const seat = pick(free); return { id: 'coaster', seat, car: Math.floor(seat / 2), side: seat % 2, t0: t }; }
  if (info.id === 'kora') return { id: 'kora', seat: randi(0, KORA.seats.length - 1), t0: t };
  if (info.id === 'train') return { id: 'train', seat: randi(0, TRAIN_SEATS.length - 1), t0: t, from: info.stop };
  if (info.id === 'ferry') return { id: 'ferry', from: info.from, seat: randi(0, FERRY_SEATS.length - 1), t0: t };
  if (info.id === 'zip') return { id: 'zip', t0: t };
  if (PLAY_IDS.includes(info.id)) return { id: info.id, seat: info.seat, ride: info.ride, a: rand(0, TAU), t0: t };
  if (info.id === 'wheel') { let best = 0, bd = 9; for (let i = 0; i < WHEEL.n; i++) { const a = ((wheelAngle(t, i) % TAU) + TAU) % TAU, d = Math.abs(a - 1.5 * Math.PI); if (d < bd) { bd = d; best = i; } } return { id: 'wheel', cab: best, t0: t }; }
  return { id: 'carousel', seat: randi(0, CAROUSEL.n - 1), t0: t };
}
const rot = (lx, lz, yaw) => [lx * Math.cos(yaw) + lz * Math.sin(yaw), -lx * Math.sin(yaw) + lz * Math.cos(yaw)];
// posisi duduk penumpang sekarang + apakah sudah boleh/harus turun
const PLAY_IDS = ['slide', 'swing', 'spin', 'kiddie'];
export function transitPose(tok) {
  const t = nowS();
  if (tok.id === 'zip') return zipPose(tok, t);
  if (PLAY_IDS.includes(tok.id)) { if (tok.id === 'swing') PLAY.swings[tok.seat].rideT = t + 0.4; return playPose(tok, t); }
  if (tok.id === 'bus') {
    const b = BUS.cars[tok.bus], p = busPose(b, t), [sx, sy, sz] = BUS_SEATS[tok.seat], [ox, oz] = rot(sx, sz, p.yaw);
    const exit = p.stop >= 0 && (p.stop !== tok.from || t - tok.t0 > BUS.dwell + 1) ? BUS.stops[p.stop] : null;
    return { x: p.x + ox, z: p.z + oz, y: sy, yaw: p.yaw, exit: exit && { x: exit.x, z: exit.z, y: 0, name: `Halte ${exit.name}` }, info: p.stop >= 0 ? `🚏 Halte ${BUS.stops[p.stop].name}` : `🚌 Berikutnya: Halte ${BUS.stops[p.next].name}` };
  }
  if (tok.id === 'coaster') {
    const st = coasterState(t), p = coasterPose(st.s - tok.car * COASTER.gap), done = st.station && t - tok.t0 > COASTER.dwell + 3;
    const o = new THREE.Vector3(tok.side ? 0.42 : -0.42, 0.15, -0.1).applyQuaternion(p.q);
    return { x: p.x + o.x, z: p.z + o.z, y: p.y + o.y, yaw: p.yaw, pitch: p.pitch, q: p.q, loop: p.loop, cam: true, auto: done, exit: done && { x: SPOTS.coaster.x, z: SPOTS.coaster.z, y: SPOTS.coaster.y, name: 'Stasiun Roller Coaster' }, info: st.station ? `🎢 Kursi ${tok.seat + 1}/6 · berangkat ${Math.ceil(st.left)} detik lagi` : p.loop ? '🔄 Putaraaan!' : `🎢 Ketinggian ${Math.round(p.y)} m` };
  }
  if (tok.id === 'kora') {
    const ks = koraState(t), [wx, wz] = L(KORA.x, KORA.z), sx = KORA.seats[tok.seat], a = ks.a, r = KORA.len + 0.2;
    const lx = sx, ly = -r; const x = wx + lx * Math.cos(a) - ly * Math.sin(a), y = KORA.pivotY + lx * Math.sin(a) + ly * Math.cos(a);
    const done = ks.rest && t - tok.t0 > KORA.rest + 2;
    return { x, z: wz, y: y - 0.55, yaw: Math.PI, pitch: 0, roll: -a, auto: done, exit: done && { x: SPOTS.kora.x, z: SPOTS.kora.z, y: 0, name: 'Kora-kora' }, info: ks.rest ? `🏴‍☠️ Mulai ${Math.ceil(ks.left)} detik lagi` : '🏴‍☠️ Wiiiii!' };
  }
  if (tok.id === 'train') {
    const [k, sx, sy, sz] = TRAIN_SEATS[tok.seat], p = trainCarPose(t, k), [ox, oz] = rot(sx, sz, p.yaw);
    const exit = p.stop >= 0 && (p.stop !== tok.from || t - tok.t0 > TRAIN.dwell + 1) ? TRAIN.stops[p.stop] : null;
    const inTunnel = inHill(p.x - CX, p.z - CZ) && p.y < 1;
    return { x: p.x + ox, z: p.z + oz, y: p.y + sy, yaw: p.yaw, moving: p.stop < 0, exit: exit && { x: exit.x, z: exit.z, y: 0, name: exit.name }, info: p.stop >= 0 ? `🚉 ${TRAIN.stops[p.stop].name}` : inTunnel ? '🚇 Masuk terowongan... gelap!' : p.y > 3 ? '🌉 Di atas jembatan layang!' : `🚂 Berikutnya: ${TRAIN.stops[p.next].name}` };
  }
  if (tok.id === 'ferry') {
    const fs = ferryState(t), [sx, sy, sz] = FERRY_SEATS[tok.seat], [ox, oz] = rot(sx, sz, fs.yaw);
    const arrived = fs.at === 1 - tok.from, side = FERRY.sides[1 - tok.from];
    return { x: fs.pos[0] + ox, z: fs.pos[1] + oz, y: sy, yaw: fs.yaw, auto: arrived, exit: arrived && { x: side.wait[0], z: side.wait[1], y: side.wait[2], name: side.name }, info: fs.at === tok.from ? `⛴️ Berangkat ${Math.ceil(fs.left)} detik lagi` : `⛴️ Menuju ${side.name}` };
  }
  if (tok.id === 'wheel') {
    const c = cabinPos(t, tok.cab), done = t - tok.t0 > WHEEL.period;
    return { x: c.x, z: c.z, y: c.y - 0.5, yaw: Math.PI / 2, auto: done, exit: done && { x: SPOTS.wheel.x, z: SPOTS.wheel.z, y: 0.5, name: 'Bianglala' }, info: `🎡 Bianglala · ${Math.max(0, Math.ceil(WHEEL.period - (t - tok.t0)))} detik` };
  }
  const a = (t / CAROUSEL.period) * TAU + (tok.seat / CAROUSEL.n) * TAU, [cx, cz] = L(CAROUSEL.x, CAROUSEL.z), done = t - tok.t0 > CAROUSEL.ride;
  return { x: cx + Math.cos(a) * CAROUSEL.R, z: cz + Math.sin(a) * CAROUSEL.R, y: 0.35 + Math.sin(t * 3 + tok.seat) * 0.3, yaw: -a + Math.PI, auto: done, exit: done && { x: SPOTS.carousel.x, z: SPOTS.carousel.z, y: 0, name: 'Komidi Putar' }, info: `🎠 Komidi putar · ${Math.max(0, Math.ceil(CAROUSEL.ride - (t - tok.t0)))} detik` };
}
// loket kegiatan terdekat (toko topi, restoran, klinik, bioskop, lift menara, es krim)
export function activityNear(px, pz, py) {
  for (const [k, s] of Object.entries(SPOTS)) { if (['wheel', 'carousel', 'kora', 'coaster'].includes(k) || s.kind === 'play') continue; if (Math.abs(py - (s.y || 0)) < 1 && Math.hypot(px - s.x, pz - s.z) < (s.kind === 'shop' ? 1.8 : 2.4)) return s.shop ? 'shop:' + s.shop : s.kind; }
  if (SKY.down && Math.abs(py - SKY.down[2]) < 0.4 && Math.hypot(px - SKY.down[0], pz - SKY.down[1]) < 1.2) return 'skydown';
  return null;
}

/* =========================================================
   GERAK SETIAP BINGKAI & MALAM
   ========================================================= */
let honkAt = 0;
export function updateCity(dt, P, onHonk, onBump) {
  const inCity = W.islandOf(P.pos.x, P.pos.z) === 'kota'; CDYN.visible = inCity;
  const t = nowS();
  // kapal selalu dihitung (terlihat dari dua pulau)
  const fs = ferryState(t); FERRY.m.position.set(fs.pos[0], -0.45 + Math.sin(t * 1.3) * 0.06, fs.pos[1]); FERRY.m.rotation.y = fs.yaw;
  if (!inCity) return;
  if (CITY_NIGHT) return; // malam: kota sepi, hanya zombie (kendaraan & wahana berhenti/disembunyikan)
  updateLife(dt, P, t); zipTick(t);
  for (const b of BUS.cars) { const p = busPose(b, t); b.m.position.set(p.x, 0, p.z); b.m.rotation.y = p.yaw; b.m.userData.roof.visible = Math.hypot(P.pos.x - p.x, P.pos.z - p.z) > 6; }
  { const [cx, cz] = L(CAROUSEL.x, CAROUSEL.z); CAROUSEL.roof.visible = Math.hypot(P.pos.x - cx, P.pos.z - cz) > 6; }
  { const st = coasterState(t); COASTER.cars.forEach((g, k) => { const p = coasterPose(st.s - k * COASTER.gap); g.position.set(p.x, p.y, p.z); g.quaternion.copy(p.q); }); }
  KORA.g.rotation.z = koraState(t).a;
  for (const b of BUMPER.ai) {
    b.x += b.vx * dt; b.z += b.vz * dt; const hx = BUMPER.hx - 1, hz = BUMPER.hz - 1;
    if (Math.abs(b.x - BUMPER.cx) > hx) { b.vx *= -1; b.x = BUMPER.cx + Math.sign(b.x - BUMPER.cx) * hx; }
    if (Math.abs(b.z - BUMPER.cz) > hz) { b.vz *= -1; b.z = BUMPER.cz + Math.sign(b.z - BUMPER.cz) * hz; }
    for (const o of BUMPER.ai) { if (o === b) continue; const ex = b.x - o.x, ez = b.z - o.z, ed = Math.hypot(ex, ez); if (ed < 1.9 && ed > 0.01) { b.x = o.x + (ex / ed) * 1.9; b.z = o.z + (ez / ed) * 1.9; const sp = Math.hypot(b.vx, b.vz); b.vx = (ex / ed) * sp; b.vz = (ez / ed) * sp; } }
    const dx = P.pos.x - b.x, dz = P.pos.z - b.z, d = Math.hypot(dx, dz);
    if (d < 1.9 && d > 0.01) { P.pos.x = b.x + (dx / d) * 1.9; P.pos.z = b.z + (dz / d) * 1.9; b.vx = -dx / d * 2.8; b.vz = -dz / d * 2.8; onBump?.(); }
    b.m.position.set(b.x, 0, b.z); b.m.rotation.y = Math.atan2(b.vx, b.vz);
  }
  TRAIN.cars.forEach((g, k) => { const p = trainCarPose(t, k); g.position.set(p.x, p.y, p.z); g.rotation.set(-p.pitch, p.yaw, 0); });
  { const p = trainCarPose(t, 0), cx = p.x + Math.sin(p.yaw) * 2, cz = p.z + Math.cos(p.yaw) * 2; // asap cerobong
    TRAIN.puffs.forEach((m, i) => { const k = (t * 0.55 + i / 6) % 1; m.position.set(cx - Math.sin(p.yaw) * k * 3, p.y + 4.1 + k * 3.2, cz - Math.cos(p.yaw) * k * 3); m.scale.setScalar(0.5 + k * 1.6); m.material.opacity = 0.75 * (1 - k); }); }
  zooTick(dt, t, P);
  WHEEL.g.rotation.x = -(t / WHEEL.period) * TAU;
  WHEEL.cabins.forEach((c, i) => { const p = cabinPos(t, i); c.position.set(p.x, p.y + 0.6, p.z); });
  CAROUSEL.g.rotation.y = -(t / CAROUSEL.period) * TAU; CAROUSEL.horses.forEach((h, i) => (h.children[1].position.y = 1.4 + Math.sin(t * 3 + i) * 0.3));
  for (const c of TRAFFIC) {
    const d = c.dir * t * c.speed + c.off, [x, z, yaw] = rrPoint(c.r, c.rc, d); const [wx, wz] = L(x, z);
    c.m.position.set(wx, 0, wz); c.m.rotation.y = c.dir > 0 ? yaw : yaw + Math.PI;
    // mobil tidak menabrak: pemain didorong ke pinggir & diklakson
    const dx = P.pos.x - wx, dz = P.pos.z - wz, dd = Math.hypot(dx, dz);
    if (dd < 2.2 && P.y < 1.5) { P.pos.x = wx + (dx / (dd || 1)) * 2.2; P.pos.z = wz + (dz / (dd || 1)) * 2.2; if (performance.now() - honkAt > 2500) { honkAt = performance.now(); onHonk?.(); } }
  }
  const ph = t % 12;
  for (const L2 of TRAFFIC.lights) { const q = (ph + L2.off * 12 + 12) % 12, on = q < 5 ? 'g' : q < 6.5 ? 'y' : 'r'; for (const l of L2.ls) l.m.material = LIGHT[l.c][l.c === on ? 0 : 1]; }
}
let CITY_NIGHT = false;
export function setCityNight(n, night) {
  if (night !== CITY_NIGHT) {
    CITY_NIGHT = night;
    for (const o of [...BUS.cars.map((b) => b.m), ...TRAFFIC.map((c) => c.m), ...BUMPER.ai.map((b) => b.m)]) o.visible = !night;
    if (night) for (const a of THEATER.actors) a.root.visible = false;
  }
  windowMat.emissiveIntensity = n * 0.9;
  for (const r of safeRings) r.visible = night;
  lampionMat.emissiveIntensity = n * 1.3; // lampion alun-alun menyala
  for (const g of [CROWD.g, BIRDS.g, LIFE.g]) if (g) g.visible = !night; // malam: warga pulang, merpati tidur
}
export const inCitySafe = (x, z) => safeSpots.some((s) => Math.hypot(x - s.x, z - s.z) < s.r - 0.6);
export const transitOpen = () => true;

/* =========================================================
   MULAI
   ========================================================= */
let DYN_ALWAYS = null;
export function initCity(ctx) {
  K = ctx; root = new THREE.Group(); K.scene.add(root);
  W.kit.DYN.add(CDYN); DYN_ALWAYS = new THREE.Group(); W.kit.DYN.add(DYN_ALWAYS);
  buildGround(); buildPlazas(); buildBlocks(); buildBus(); buildFerry(); buildFun(); buildSky(); buildTraffic(); buildPeople();
  buildZoo(); buildToys(); buildMarket(); buildRace(); buildTrain();
  buildMall(); buildTheater(); buildMoreFun(); buildCoaster(); buildBeach(); buildZip(); buildDensity(); buildLife();
}
// kota lebih padat: ruko & gedung di tempat kosong, pohon trotoar, baliho, mobil di jalan dalam, warga tambahan
function buildDensity() {
  const skip = [[-24, -24], [-24, 24], [-24, 72], [72, 72], [72, 24], [-72, 24], [24, 24], [24, -24]];
  const near = (x, z, r) => Object.values(SPOTS).some((s) => Math.hypot(s.x - x, s.z - z) < r) || Object.values(CITY_PLACES).some((p) => Math.hypot(p.go[0] - x, p.go[1] - z) < r) || BUS.stops.some((s) => Math.hypot(s.x - x, s.z - z) < r);
  for (const bx of BLOCKS) for (const bz of BLOCKS) {
    if (skip.some(([a, b]) => a === bx && b === bz)) continue;
    for (const [ox, oz] of [[-14, -14], [0, -15], [14, -14], [-15, 0], [15, 0], [-14, 14], [0, 15], [14, 14]]) {
      const [wx, wz] = L(bx + ox, bz + oz), w = 7, h = randi(6, 18);
      if (W.hitsSolid(wx, wz, w / 2, w / 2, 1.2) || near(wx, wz, 7)) continue;
      tower(bx + ox, bz + oz, w, w, h, pick(TOWER_COLS), pick(['#b5523b', '#3a5f9e', '#4a4f5c', '#3fb25a']), true);
      deco(bx + ox, bz + oz + (oz > 0 ? -w / 2 - 0.5 : w / 2 + 0.5), w, 0.9, 0.12, pick(['#e8434b', '#3a7cf5', '#ffd23a', '#3fb25a']), 2.8);
    }
  }
  // pohon trotoar
  for (const r of [-55, 55]) for (let t = -88; t <= 88; t += 16) for (const [x, z] of [[r, t], [t, r]]) {
    const [wx, wz] = L(x, z); if (W.hitsSolid(wx, wz, 0.8, 0.8, 0.6) || near(wx, wz, 4)) continue;
    S('cyl', 1.1, 0.5, 1.1, '#a8a294', wx, 0.25, wz); S('cyl', 0.28, 2.2, 0.28, '#8a5a35', wx, 1.5, wz); S('sph', 2.2, 2, 2.2, pick(['#3fae4f', '#47a84d']), wx, 3.3, wz); S('sph', 1.2, 1.1, 1.2, '#5cbf5c', wx + 0.4, 4.2, wz - 0.2); addSolid(wx, wz, 0.5, 0.5, 0, 0.5);
  }
  // baliho pesan baik
  [['Belajar itu seru! ⭐', 0, -101, 0], ['Jaga kebersihan 🗑️', 101, 0, -Math.PI / 2], ['Sayangi ayah & ibu ❤️', 0, 101, Math.PI], ['Rajin sholat & mengaji 🕌', -101, 0, Math.PI / 2]].forEach(([t, x, z, yaw]) => {
    const [wx, wz] = L(x * 0.98, z * 0.98); for (const s of [-2.5, 2.5]) K.box(0.3, 6, 0.3, '#4a4f5c', wx + Math.cos(yaw) * s, 3, wz - Math.sin(yaw) * s, root);
    const bd = W.kit.board(7, 2.4, (q, w, h) => { q.fillStyle = '#ffffff'; q.fillRect(0, 0, w, h); q.strokeStyle = '#3a7cf5'; q.lineWidth = 18; q.strokeRect(0, 0, w, h); q.fillStyle = '#1d2b53'; q.font = `800 60px ${K.FONT}`; q.textAlign = 'center'; q.textBaseline = 'middle'; q.fillText(t, w / 2, h / 2 + 4); });
    bd.position.set(wx, 7, wz); bd.rotation.y = yaw; root.add(bd);
  });
  // mobil di jalan dalam (berlawanan arah dengan bus)
  ['#e8434b', '#ffffff', '#9a62e0'].forEach((c, i) => { const m = makeCar(c); CDYN.add(m); TRAFFIC.push({ m, r: 45.5, rc: 4, dir: -1, off: i * 130 + 40, speed: 9 }); });
  // warga tambahan
  [['Pak Anton', 'Penjual Koran', -50, 30, '#5b6b8c'], ['Bu Maya', 'Guru', 30, 50, '#9a62e0'], ['Kak Fajar', 'Pesepeda', 50, -30, '#ff8a2a'], ['Dek Sasa', 'Anak Kota', -30, -50, '#ff8fc0'], ['Mas Doni', 'Kurir Paket', 0, 54, '#ffd23a'], ['Nenek Ros', 'Nenek', -54, 0, '#c9c9c9']].forEach(([name, role, x, z, shirt], i) =>
    addNpc({ id: `wargaB${i}`, name, role, x: L(x, z), face: 0, girl: /Bu|Dek|Nenek/.test(name), shirt, pants: pick(['#2c2f3a', '#3b4a6b']), hair: name === 'Nenek Ros' ? '#c9c9c9' : undefined, scale: /Dek/.test(name) ? 0.8 : 1, pitch: /Dek/.test(name) ? 0.4 : /Nenek/.test(name) ? -0.1 : 0, wander: 6,
      lines: [pick(['Kota ini ramai sekali, ya!', 'Sudah naik roller coaster? Seru banget!', 'Ayo nonton teater. Ceritanya bagus-bagus!', 'Jangan lupa jaga kebersihan kota.']), 'Hati-hati menyeberang, lewat zebra cross, ya!'] }));
}
/* =========================================================
   KOTA RAMAI: warga latar, merpati, jajanan, taman bermain, mall meriah
   ========================================================= */
// ---------- warga latar: berjalan, duduk, mengobrol, bermain (InstancedMesh: 6 draw call untuk semua) ----------
const CROWD = { list: [], parts: [], g: null, bal: null, str: null, holders: [] };
const C_SHIRT = ['#e8434b', '#3a7cf5', '#ffd23a', '#3fb25a', '#ff8fc0', '#9a62e0', '#ff8a2a', '#ffffff', '#5bc8d6', '#c0392b'];
const C_PANTS = ['#2c2f3a', '#3b4a6b', '#5b3b22', '#1d2b53', '#6b6b6b', '#c9a36b'];
const C_SKIN = ['#f6d2b4', '#e3ac83', '#b97a52', '#8d5a3b'];
const C_HAIR = ['#3b2a20', '#1d1d1d', '#5b3b22', '#3b2a20'];
// bagian tubuh (ukuran sama dengan K.makeCharacter): [mesh, sendi, sendi x, sendi y, lebar, tinggi, tebal, geser y, geser z]
const C_PARTS = [
  [0, 'legL', -0.25, 1.0, 0.48, 1.0, 0.5, -0.5, 0], [0, 'legR', 0.25, 1.0, 0.48, 1.0, 0.5, -0.5, 0],
  [1, 'body', 0, 1.0, 1.0, 1.0, 0.52, 0.5, 0], [1, 'armL', -0.74, 1.95, 0.46, 0.4, 0.48, -0.18, 0], [1, 'armR', 0.74, 1.95, 0.46, 0.4, 0.48, -0.18, 0],
  [2, 'armL', -0.74, 1.95, 0.42, 0.66, 0.44, -0.7, 0], [2, 'armR', 0.74, 1.95, 0.42, 0.66, 0.44, -0.7, 0],
  [3, 'head', 0, 2.0, 0.86, 0.86, 0.86, 0.46, 0],
  [4, 'head', 0, 2.0, 0.92, 0.22, 0.92, 0.92, 0], [4, 'head', 0, 2.0, 0.92, 0.62, 0.2, 0.62, -0.38],
  [5, 'head', 0, 2.0, 0.34, 0.9, 0.26, 0.35, -0.56],
];
const C_PER = [2, 3, 2, 1, 2, 1];
const BAL_COLS = ['#e8434b', '#ffd23a', '#3a7cf5', '#3fb25a', '#ff8fc0', '#9a62e0'];
// o: { x, z (dunia), y, yaw, mode: walk|wander|sit|stand|jump|run|ride, kid, girl, act (gerak diam), ... }
function person(o) {
  const kid = o.kid ?? Math.random() < 0.3, girl = o.girl ?? Math.random() < 0.5;
  const c = { y: 0, yaw: 0, spd: kid ? 1.7 : 1.3, ...o, kid, girl, sc: o.sc || (kid ? rand(0.68, 0.8) : rand(0.92, 1.04)), i: CROWD.list.length, ph: rand(0, 6), wait: rand(0, 3), tgt: null, greet: 0, greeted: false, skip: randi(0, 2),
    col: [o.shirt || pick(C_SHIRT), o.pants || pick(C_PANTS), o.skin || pick(C_SKIN), o.hair || pick(C_HAIR)], j: { legL: 0, legR: 0, armL: 0, armR: 0, armLz: 0, armRz: 0, head: 0, dy: 0 } };
  c.y0 = c.y; c.yaw0 = c.yaw; if (o.balloon) CROWD.holders.push(c);
  CROWD.list.push(c); return c;
}
// jalan memutari blok di trotoar (koordinat lokal kota)
const walker = (bx, bz, r, dir, d0, extra = {}) => person({ mode: 'walk', bx: CX + bx, bz: CZ + bz, r, rc: 2.5, dir, d: d0, ...extra });
// berkeliaran di dalam kotak dunia; ok(x, z) menolak tempat terlarang
function wanderer(x0, x1, z0, z1, n, extra = {}, ok = null) {
  for (let i = 0; i < n; i++) {
    const p = person({ mode: 'wander', box: [x0, x1, z0, z1], ok: ok || ((x, z) => !W.hitsSolid(x, z, 0.35, 0.35, 0)), ...extra });
    for (let k = 0; k < 20; k++) { const x = rand(x0, x1), z = rand(z0, z1); if (p.ok(x, z)) { p.x = x; p.z = z; break; } }
    p.x ??= (x0 + x1) / 2; p.z ??= (z0 + z1) / 2; p.yaw = rand(0, TAU);
  }
}
function crowdFinish() {
  const N = CROWD.list.length; if (!N) return;
  const g = new THREE.Group(); g.userData.dynamic = true; CDYN.add(g); CROWD.g = g;
  const white = new THREE.MeshLambertMaterial({ color: '#ffffff' }), face = new THREE.MeshLambertMaterial({ map: K.faceTexture('#ffffff') });
  const mats = [white, white, white, [white, white, white, white, face, white], white, white];
  CROWD.parts = C_PER.map((per, mi) => { const m = new THREE.InstancedMesh(K.BOX, mats[mi], N * per); m.frustumCulled = false; m.castShadow = false; m.receiveShadow = true; g.add(m); return m; });
  const col = new THREE.Color();
  for (const c of CROWD.list) {
    const ci = [0, 1, 2, 2, 3, 3];
    C_PER.forEach((per, mi) => { col.set(c.col[ci[mi]]); for (let k = 0; k < per; k++) CROWD.parts[mi].setColorAt(c.i * per + k, col); });
    crowdPose(c);
  }
  for (const m of CROWD.parts) { m.instanceColor.needsUpdate = true; m.instanceMatrix.needsUpdate = true; }
  const H = CROWD.holders.length;
  if (H) {
    CROWD.bal = new THREE.InstancedMesh(geo('sph'), new THREE.MeshLambertMaterial({ color: '#ffffff' }), H); CROWD.str = new THREE.InstancedMesh(K.BOX, K.mat('#f4f4f4'), H);
    for (const m of [CROWD.bal, CROWD.str]) { m.frustumCulled = false; m.castShadow = false; g.add(m); }
    CROWD.holders.forEach((c, k) => CROWD.bal.setColorAt(k, col.set(c.balloon))); CROWD.bal.instanceColor.needsUpdate = true;
  }
}
const _cq = new THREE.Quaternion(), _cqb = new THREE.Quaternion(), _ce = new THREE.Euler(), _cv = new THREE.Vector3(), _ct = new THREE.Vector3(), _cs = new THREE.Vector3(), _cm = new THREE.Matrix4(), _cb = new THREE.Matrix4(), _cup = new THREE.Vector3(0, 1, 0), CZERO = new THREE.Matrix4().makeScale(0, 0, 0);
const _csub = [0, 0, 0, 0, 0, 0];
function crowdPose(c) {
  _cqb.setFromAxisAngle(_cup, c.yaw); _cb.compose(_cv.set(c.x, c.y, c.z), _cqb, _cs.setScalar(c.sc));
  const J = c.j; _csub.fill(0);
  for (const [mi, jn, jx, jy, w, h, d, oy, oz] of C_PARTS) {
    if (jn === 'head') _ce.set(0, J.head, 0); else if (jn === 'body') _ce.set(0, 0, 0); else _ce.set(J[jn], 0, jn === 'armR' ? J.armRz : jn === 'armL' ? J.armLz : 0);
    _cq.setFromEuler(_ce); _cv.set(0, oy, oz).applyQuaternion(_cq).add(_ct.set(jx, jy + J.dy, 0));
    _cm.compose(_cv, _cq, _cs.set(w, h, d)).premultiply(_cb);
    CROWD.parts[mi].setMatrixAt(c.i * C_PER[mi] + _csub[mi]++, mi === 5 && !c.girl ? CZERO : _cm);
  }
}
const angTo = (a, b, k) => { let d = b - a; d = Math.atan2(Math.sin(d), Math.cos(d)); return a + d * Math.min(1, k); };
function crowdTick(dt, P, t) {
  if (!CROWD.g || !CROWD.g.visible) return;
  for (const c of CROWD.list) {
    const dx = P.pos.x - c.x, dz = P.pos.z - c.z, d = Math.hypot(dx, dz);
    if (d > 75) continue;
    let sdt = dt; if (d > 34) { c.skip = (c.skip + 1) % 3; if (c.skip) continue; sdt = dt * 3; }
    if (c.hidden) { if (!c.zeroed) { c.zeroed = true; _csub.fill(0); for (const [mi] of C_PARTS) CROWD.parts[mi].setMatrixAt(c.i * C_PER[mi] + _csub[mi]++, CZERO); } continue; }
    c.zeroed = false;
    const J = c.j; let moving = false;
    // sapa pemain yang mendekat
    const near = d < 2.6 && Math.abs(P.y - c.y0) < 2 && c.mode !== 'ride' && c.mode !== 'swing';
    if (near && !c.greeted) { c.greeted = true; c.greet = 1.8; } else if (d > 6) c.greeted = false;
    c.greet = Math.max(0, c.greet - sdt);
    if (c.greet > 0 && c.mode !== 'sit') c.yaw = angTo(c.yaw, Math.atan2(dx, dz), sdt * 6);
    else if (c.mode === 'walk') {
      if (d > 1.3) { c.d += c.dir * c.spd * sdt; moving = true; }
      const [lx, lz, yaw] = rrPoint(c.r, c.rc, c.d); c.x = c.bx + lx; c.z = c.bz + lz; c.yaw = angTo(c.yaw, c.dir > 0 ? yaw : yaw + Math.PI, sdt * 8);
    } else if (c.mode === 'wander') {
      if (!c.tgt) { c.wait -= sdt; if (c.wait <= 0) { for (let k = 0; k < 6; k++) { const x = rand(c.box[0], c.box[1]), z = rand(c.box[2], c.box[3]); if (c.ok(x, z)) { c.tgt = [x, z]; break; } } c.wait = rand(2, 6); c.act = pick(['look', 'talk', 'idle', 'idle', 'phone']); } }
      else {
        const tx = c.tgt[0] - c.x, tz = c.tgt[1] - c.z, td = Math.hypot(tx, tz);
        if (td < 0.3) c.tgt = null;
        else if (d > 1.3) { const st = Math.min(td, c.spd * sdt), nx = c.x + (tx / td) * st, nz = c.z + (tz / td) * st; if (c.ok(nx, nz)) { c.x = nx; c.z = nz; moving = true; c.yaw = angTo(c.yaw, Math.atan2(tx, tz), sdt * 7); } else c.tgt = null; }
      }
    } else if (c.mode === 'run') { c.a += c.spd * sdt / c.r * (c.dir || 1); c.x = c.cx + Math.cos(c.a) * c.r; c.z = c.cz + Math.sin(c.a) * c.r; c.yaw = Math.atan2(-Math.sin(c.a), Math.cos(c.a)) * (c.dir || 1) + (c.dir < 0 ? Math.PI : 0); moving = true; }
    else if (c.mode === 'ride') { const a = c.rot(t) + c.a; c.x = c.cx + Math.cos(a) * c.r; c.z = c.cz + Math.sin(a) * c.r; c.yaw = -a; }
    else if ((c.mode === 'stand' || c.mode === 'jump') && !c.greeted) c.yaw = angTo(c.yaw, c.yaw0, sdt * 3);
    // pose
    c.ph += sdt * (moving ? (c.kid ? 11 : 8.5) : 2);
    const sw = moving ? Math.sin(c.ph) * 0.6 : 0;
    J.legL = sw; J.legR = -sw; J.armL = -sw * 0.9; J.armR = sw * 0.9; J.armLz = 0; J.armRz = 0; J.dy = moving ? Math.abs(Math.sin(c.ph)) * 0.06 : 0; J.head = 0;
    if (c.mode !== 'jump') c.y = c.y0;
    if (c.mode === 'sit' || c.mode === 'ride' || c.mode === 'swing') {
      J.legL = J.legR = -1.5; J.dy = -0.8;
      if (c.act === 'eat') J.armR = -1.6 - Math.max(0, Math.sin(t * 2 + c.ph)) * 0.8;
      else if (c.act === 'talk') { J.armL = -0.5 - Math.sin(t * 3 + c.ph) * 0.3; J.head = Math.sin(t * 0.7 + c.ph) * 0.5; }
      else if (c.mode !== 'sit') { J.armL = J.armR = -2.4; }
    } else if (!moving && c.greet <= 0) {
      const a = c.act;
      if (a === 'talk') { J.armL = -0.6 - Math.sin(t * 3.4 + c.ph) * 0.35; J.armR = -0.3 - Math.max(0, Math.sin(t * 2.3 + c.ph)) * 0.6; J.head = Math.sin(t * 0.9 + c.ph) * 0.35; }
      else if (a === 'look') J.head = Math.sin(t * 0.6 + c.ph) * 0.9;
      else if (a === 'phone') { J.armR = -2.3; J.armRz = 0.5; J.head = 0.15; }
      else if (a === 'cheer') { const b = Math.abs(Math.sin(t * 4 + c.ph)); J.armL = J.armR = -2.8; J.armLz = -0.3; J.armRz = 0.3; J.dy = b * 0.12; }
      else if (a === 'photo') { J.armL = J.armR = -1.7; J.armLz = -0.35; J.armRz = 0.35; }
      else if (a === 'kite') { J.armR = -2.5; J.armL = -1.2; }
      else if (a === 'clap') { J.armL = J.armR = -1.3; J.armLz = -0.5 - Math.abs(Math.sin(t * 7)) * 0.4; J.armRz = -J.armLz; }
      else J.armR = Math.sin(t * 1.5 + c.ph) * 0.05;
      if (c.mode === 'jump') { const b = Math.abs(Math.sin(t * 3.4 + c.ph)); c.y = c.y0 + b * (c.hop || 0.8); J.armL = J.armR = b > 0.3 ? -2.7 : -0.5; J.legL = J.legR = 0; }
    }
    if (c.greet > 0) { J.armR = -2.6; J.armRz = Math.sin(t * 14) * 0.35; }
    if (c.balloon && c.greet <= 0) J.armR = Math.min(J.armR, -0.6);
    crowdPose(c);
  }
  for (const m of CROWD.parts) m.instanceMatrix.needsUpdate = true;
  // balon yang dipegang anak-anak
  CROWD.holders.forEach((c, k) => {
    _cqb.setFromAxisAngle(_cup, c.yaw); _cb.compose(_cv.set(c.x, c.y, c.z), _cqb, _cs.setScalar(c.sc));
    const hand = _ct.set(0.8, 1.35, 0.35).applyMatrix4(_cb).clone(), top = _cv.set(0.95 + Math.sin(t * 1.3 + c.ph) * 0.2, 4.1, 0.4).applyMatrix4(_cb).clone();
    CROWD.bal.setMatrixAt(k, _cm.compose(top, _cq.identity(), _cs.set(0.75, 0.9, 0.75)));
    const dir = top.clone().sub(hand), len = dir.length(); _cq.setFromUnitVectors(_cup, dir.normalize());
    CROWD.str.setMatrixAt(k, _cm.compose(hand.add(top).multiplyScalar(0.5).setY(hand.y - 0.22), _cq, _cs.set(0.03, len - 0.4, 0.03)));
  });
  if (CROWD.bal) { CROWD.bal.instanceMatrix.needsUpdate = true; CROWD.str.instanceMatrix.needsUpdate = true; }
}

// ---------- burung merpati: mematuk di tanah, terbang memutar saat dikejar, datang saat diberi makan ----------
const BIRDS = { list: [], flocks: [], mesh: null, wing: null };
function flock(x, z, r, n, r0 = 1.5) {
  const [wx, wz] = L(x, z), fl = { x: wx, z: wz, r, r0, feed: 0, fx: 0, fz: 0 }; BIRDS.flocks.push(fl);
  for (let i = 0; i < n; i++) { const a = rand(0, TAU), rr = rand(r0, r); BIRDS.list.push({ fl, x: wx + Math.cos(a) * rr, z: wz + Math.sin(a) * rr, y: 0, yaw: rand(0, TAU), st: 0, t: rand(0, 3), ph: rand(0, 6), ang: 0, rad: 0, h: 0, dur: 0, lx: 0, lz: 0, tgt: null }); }
  return fl;
}
function birdsFinish() {
  const N = BIRDS.list.length; if (!N) return;
  const g = new THREE.Group(); g.userData.dynamic = true; CDYN.add(g); BIRDS.g = g;
  BIRDS.mesh = new THREE.InstancedMesh(K.BOX, new THREE.MeshLambertMaterial({ color: '#ffffff' }), N * 3); BIRDS.wing = new THREE.InstancedMesh(K.BOX, new THREE.MeshLambertMaterial({ color: '#ffffff' }), N * 2);
  const col = new THREE.Color();
  BIRDS.list.forEach((b, i) => { const c = pick(['#8a8f99', '#a8acb4', '#9aa0aa', '#f4f4f4', '#8a6a55']); for (let k = 0; k < 3; k++) BIRDS.mesh.setColorAt(i * 3 + k, col.set(k === 2 ? '#e8a23a' : k === 1 ? '#6b7380' : c)); for (let k = 0; k < 2; k++) BIRDS.wing.setColorAt(i * 2 + k, col.set(c).multiplyScalar(0.85)); });
  for (const m of [BIRDS.mesh, BIRDS.wing]) { m.frustumCulled = false; m.castShadow = false; m.instanceColor.needsUpdate = true; g.add(m); }
}
export function feedBirds(x, z) {
  let best = null, bd = 30; for (const f of BIRDS.flocks) { const d = Math.hypot(f.x - x, f.z - z); if (d < bd) { bd = d; best = f; } }
  if (!best) return false; Object.assign(best, { feed: 14, fx: x, fz: z }); return true;
}
function birdsTick(dt, P, t) {
  if (!BIRDS.mesh) return;
  const pm = BIRDS.lp ? Math.hypot(P.pos.x - BIRDS.lp[0], P.pos.z - BIRDS.lp[1]) / Math.max(dt, 1e-3) > 0.8 : false; BIRDS.lp = [P.pos.x, P.pos.z]; // diam = burung tidak kaget
  BIRDS.flocks.forEach((f) => (f.feed = Math.max(0, f.feed - dt)));
  BIRDS.list.forEach((b, i) => {
    const f = b.fl, dx = b.x - P.pos.x, dz = b.z - P.pos.z, d = Math.hypot(dx, dz);
    let flap = 0, peck = 0;
    if (Math.hypot(f.x - P.pos.x, f.z - P.pos.z) > 70) return;
    if (b.st === 0) { // di tanah
      const scare = f.feed > 0 ? d < 0.9 : d < 3.2 && pm && P.y < 2.5;
      if (scare) { b.st = 1; b.t = 0; b.ang = Math.atan2(b.z - f.z, b.x - f.x); b.rad = f.r * rand(0.5, 1.1); b.h = rand(5, 10); b.dur = rand(5, 9); b.lx = b.x; b.lz = b.z; }
      else {
        if (f.feed > 0) { if (!b.tgt || Math.hypot(b.tgt[0] - f.fx, b.tgt[1] - f.fz) > 2.6) { const a = rand(0, TAU), r = rand(0.9, 2.3); b.tgt = [f.fx + Math.cos(a) * r, f.fz + Math.sin(a) * r]; } }
        else if (!b.tgt && (b.t -= dt) < 0) { b.t = rand(1.5, 5); if (Math.random() < 0.5) { const a = rand(0, TAU), r = rand(0.5, 2); const nx = b.x + Math.cos(a) * r, nz = b.z + Math.sin(a) * r; const rr = Math.hypot(nx - f.x, nz - f.z); if (rr < f.r && rr > f.r0) b.tgt = [nx, nz]; } }
        if (b.tgt) { const tx = b.tgt[0] - b.x, tz = b.tgt[1] - b.z, td = Math.hypot(tx, tz); if (td < 0.1) b.tgt = f.feed > 0 ? b.tgt : null; else { const st = Math.min(td, (f.feed > 0 ? 1.6 : 0.6) * dt); b.x += (tx / td) * st; b.z += (tz / td) * st; b.yaw = Math.atan2(tx, tz); b.y = Math.abs(Math.sin(t * 12 + b.ph)) * 0.06; } }
        if (!b.tgt || f.feed > 0) { peck = Math.max(0, Math.sin(t * (f.feed > 0 ? 9 : 4) + b.ph)) ** 3; b.y = 0; if (f.feed > 0 && b.tgt && Math.hypot(b.tgt[0] - b.x, b.tgt[1] - b.z) < 0.15) b.yaw = Math.atan2(f.fx - b.x, f.fz - b.z); }
      }
    } else { // terbang
      b.t += dt; flap = Math.sin(t * 26 + b.ph);
      if (b.st === 1) {
        const k = Math.min(1, b.t / 1.2); b.ang += dt * 0.8; const cx = f.x + Math.cos(b.ang) * b.rad, cz = f.z + Math.sin(b.ang) * b.rad;
        b.x += (cx - b.x) * Math.min(1, dt * 2.5 * (0.3 + k)); b.z += (cz - b.z) * Math.min(1, dt * 2.5 * (0.3 + k)); b.y += (b.h - b.y) * Math.min(1, dt * 1.6);
        b.yaw = Math.atan2(-Math.sin(b.ang), Math.cos(b.ang));
        if (b.t > b.dur) { b.st = 2; let lx = 0, lz = 0; for (let k2 = 0; k2 < 8; k2++) { const a = rand(0, TAU), r = rand(f.r0, f.r); lx = (f.feed > 0 ? f.fx : f.x) + Math.cos(a) * (f.feed > 0 ? rand(1, 2.3) : r); lz = (f.feed > 0 ? f.fz : f.z) + Math.sin(a) * (f.feed > 0 ? rand(1, 2.3) : r); if (f.feed > 0 || Math.hypot(lx - P.pos.x, lz - P.pos.z) > 5) break; } b.lx = lx; b.lz = lz; }
      } else {
        const tx = b.lx - b.x, tz = b.lz - b.z, td = Math.hypot(tx, tz), sp = Math.min(td, 5 * dt);
        if (td > 0.05) { b.x += (tx / td) * sp; b.z += (tz / td) * sp; b.yaw = Math.atan2(tx, tz); }
        b.y = Math.max(0, b.y - dt * Math.max(1.5, b.y / Math.max(0.3, td / 5)));
        if (b.y <= 0.01 && td < 0.2) { b.st = 0; b.y = 0; b.tgt = null; b.t = rand(1, 3); }
      }
    }
    _cqb.setFromAxisAngle(_cup, b.yaw); _cb.compose(_cv.set(b.x, b.y, b.z), _cqb, _cs.setScalar(1));
    BIRDS.mesh.setMatrixAt(i * 3, _cm.compose(_cv.set(0, 0.26, 0), _cq.identity(), _cs.set(0.32, 0.28, 0.5)).premultiply(_cb));
    BIRDS.mesh.setMatrixAt(i * 3 + 1, _cm.compose(_cv.set(0, 0.46 - peck * 0.3, 0.24 + peck * 0.12), _cq.identity(), _cs.set(0.2, 0.2, 0.22)).premultiply(_cb));
    BIRDS.mesh.setMatrixAt(i * 3 + 2, _cm.compose(_cv.set(0, 0.43 - peck * 0.3, 0.38 + peck * 0.12), _cq.identity(), _cs.set(0.07, 0.06, 0.1)).premultiply(_cb));
    for (const s of [-1, 1]) {
      _cq.setFromEuler(_ce.set(0, 0, s * (b.st ? flap * 0.9 : 0.05))); _cv.set(s * 0.18, 0, 0).applyQuaternion(_cq).add(_ct.set(s * 0.14, 0.34, -0.02));
      BIRDS.wing.setMatrixAt(i * 2 + (s > 0 ? 1 : 0), _cm.compose(_cv, _cq, _cs.set(b.st ? 0.42 : 0.12, 0.05, 0.34)).premultiply(_cb));
    }
  });
  BIRDS.mesh.instanceMatrix.needsUpdate = true; BIRDS.wing.instanceMatrix.needsUpdate = true;
}

// karung jagung untuk memberi makan merpati (gratis)
function birdSpot(x, z) { const [wx, wz] = L(x, z); SPOTS['birds' + BIRDS.flocks.length] = { x: wx, z: wz, kind: 'birds' }; SL('cyl', x, z, 0.8, 0.7, 0.8, '#c9a36b'); SL('sph', x, z, 0.7, 0.3, 0.7, '#ffd23a', 0.6); const sp = sign('🌾 Beri makan merpati', 3.4, { bg: '#fff6df' }); sp.position.set(wx, 2.1, wz); CDYN.add(sp); }
// ---------- jajanan: kios, gerobak, lapak buah, kafe, toko roti ----------
// menu toko (dipakai game.js): [emoji, nama, harga, jenis (eat = mengenyangkan, treat = jajan, fruit, balloon, cake), kalimat]
export const SHOPS = {
  kafe: { who: 'Kak Raka', pitch: -0.1, label: '☕ Kafe Kita · menu', q: 'Selamat datang di Kafe Kita! Kopi untuk orang dewasa, ya. Anak-anak mau minum apa?', items: [
    ['🍫', 'cokelat hangat', 2, 'treat', 'Cokelat hangatnya sudah siap. Tiup dulu, fuh fuh, supaya tidak kepanasan!'], ['🥛', 'susu stroberi', 2, 'treat', 'Susu stroberi yang segar. Susu membuat tulang kuat!'],
    ['🍊', 'jus jeruk', 2, 'treat', 'Jus jeruk penuh vitamin C. Segar sekali!'], ['🥞', 'panekuk madu', 3, 'eat', 'panekuk madu']] },
  roti: { who: 'Bu Ningsih', pitch: 0.1, label: '🍞 Toko Roti · menu', q: 'Roti hangat baru keluar dari oven! Mau yang mana?', items: [
    ['🥐', 'roti croissant', 2, 'eat', 'roti croissant'], ['🍩', 'donat cokelat', 2, 'treat', 'Donat cokelat bertabur meses. Jangan lupa sikat gigi nanti, ya!'],
    ['🧁', 'kue mangkuk', 2, 'treat', 'Kue mangkuk warna-warni. Cantik sekali!'], ['🎂', 'kue ulang tahun', 5, 'cake', 'Selamat ulang tahun! Tiup lilinnya!']] },
  buah: { who: 'Pak Darto', pitch: -0.25, label: '🍉 Lapak Buah · 🪙 1', q: 'Buah segar, buah segar! Satu koin saja. Mau buah apa?', items: [
    ['🍌', 'pisang', 1, 'fruit', 'Pisang warnanya kuning dan bentuknya panjang. Pisang memberi tenaga untuk bermain!'], ['🍎', 'apel', 1, 'fruit', 'Apel ada yang merah dan hijau. Rasanya manis dan renyah. Kriuk!'],
    ['🍉', 'semangka', 1, 'fruit', 'Semangka kulitnya hijau, dalamnya merah, dan banyak airnya. Segar!'], ['🥭', 'mangga', 1, 'fruit', 'Mangga yang matang warnanya kuning oranye dan harum sekali.'],
    ['🍊', 'jeruk', 1, 'fruit', 'Jeruk punya banyak vitamin C supaya kita tidak gampang sakit.'], ['🍇', 'anggur', 1, 'fruit', 'Anggur bulat kecil-kecil dan tumbuh bergerombol. Hitung, ada berapa?']] },
  bakso: { who: 'Mang Ujang', pitch: -0.3, label: '🍲 Bakso Mang Ujang · 🪙 3', q: 'Bakso, bakso! Mau bakso atau mie ayam?', items: [['🍲', 'bakso', 3, 'eat', 'bakso'], ['🍜', 'mie ayam', 3, 'eat', 'mie ayam']] },
  sate: { who: 'Pak Slamet', pitch: -0.35, label: '🍢 Sate Pak Slamet · 🪙 3', q: 'Sate ayam bakar, harum sekali! Mau pesan?', items: [['🍢', 'sate ayam', 3, 'eat', 'sate ayam'], ['🍙', 'lontong sayur', 3, 'eat', 'lontong sayur']] },
  martabak: { who: 'Bang Rizal', pitch: -0.15, label: '🥞 Martabak · 🪙 3', q: 'Martabak manis atau martabak telur?', items: [['🥞', 'martabak manis', 3, 'eat', 'martabak manis'], ['🥚', 'martabak telur', 3, 'eat', 'martabak telur']] },
  kelapa: { who: 'Bu Inah', pitch: 0.05, label: '🥥 Es Kelapa · 🪙 2', q: 'Haus? Es kelapa muda dan es cendol, segar!', items: [['🥥', 'es kelapa muda', 2, 'treat', 'Air kelapa muda manis dan menyegarkan. Kelapa tumbuh di pantai, lho!'], ['🍧', 'es cendol', 2, 'treat', 'Es cendol hijau dengan santan dan gula merah. Enak!']] },
  kerak: { who: 'Babe Mamat', pitch: -0.3, label: '🍳 Kerak Telor · 🪙 3', q: 'Kerak telor, makanan khas Betawi! Dimasak di atas arang. Mau coba?', items: [['🍳', 'kerak telor', 3, 'eat', 'kerak telor'], ['🌽', 'jagung bakar', 2, 'treat', 'Jagung bakar manis, dibakar di atas arang. Hati-hati panas!']] },
  gulali: { who: 'Kak Ayu', pitch: 0.2, label: '🍭 Gulali & Popcorn · menu', q: 'Gulali lembut seperti awan dan popcorn renyah! Mau yang mana?', items: [['🍭', 'gulali', 1, 'treat', 'Gulali merah muda, lembut seperti awan! Habis makan manis, kumur-kumur, ya.'], ['🍿', 'popcorn', 2, 'treat', 'Popcorn dari jagung yang meletus. Pop pop pop!']] },
  permen: { who: 'Kak Wulan', pitch: 0.2, label: '🍬 Toko Permen · menu', q: 'Selamat datang di Toko Permen! Ingat, jangan makan permen terlalu banyak, ya.', items: [['🍬', 'permen', 1, 'treat', 'Satu permen saja, ya. Nanti sikat gigi supaya gigi tidak berlubang!'], ['🍭', 'lolipop', 1, 'treat', 'Lolipop pelangi! Warnanya ada merah, kuning, hijau, dan biru.'], ['🍫', 'cokelat batang', 2, 'treat', 'Cokelat manis. Bagi juga dengan temanmu, ya!']] },
  balon: { who: 'Pak Ujo', pitch: -0.2, label: '🎈 Beli balon · 🪙 1', q: 'Balon, balon! Satu koin saja. Mau warna apa?', items: [
    ['🔴', 'balon merah', 1, 'balloon', '#e8434b'], ['🟡', 'balon kuning', 1, 'balloon', '#ffd23a'], ['🔵', 'balon biru', 1, 'balloon', '#3a7cf5'], ['🟢', 'balon hijau', 1, 'balloon', '#3fb25a'], ['🟣', 'balon ungu', 1, 'balloon', '#9a62e0']] },
};
let shopN = 0;
const shopSpot = (id, x, z, y = 0) => (SPOTS[`shop_${id}_${shopN++}`] = { x, z, y, kind: 'shop', shop: id });
// payung warna-warni
function umbrella(x, z, col, h = 2.6, r = 3) { SL('cyl', x, z, 0.12, h, 0.12, '#ffffff'); SL('cone', x, z, r, 0.8, r, col, h - 0.2); SL('sph', x, z, 0.25, 0.25, 0.25, '#ffffff', h + 0.5); }
// meja bundar + kursi
function cafeTable(x, z, col) { SL('cyl', x, z, 0.18, 0.75, 0.18, '#4a4f5c'); SL('cyl', x, z, 1.3, 0.08, 1.3, '#ffffff', 0.75); for (const a of [0, Math.PI]) SL('cyl', x + Math.cos(a) * 1.1, z + Math.sin(a) * 1.1, 0.6, 0.45, 0.6, col); addSolid(...L(x, z), 0.5, 0.5, 0, 0.8); }
// penjual: NPC lengkap hanya bila punya obrolan khusus; selebihnya warga instanced yang melambai
function vendor(npc, [x, z], face, y = 0) { if (npc.talk) return addNpc({ ...npc, x: [x, z], face, y }); person({ mode: 'stand', x, z, y, yaw: face, act: 'idle', shirt: npc.shirt, pants: npc.pants, girl: !!npc.girl, kid: false }); }
// kios beratap belang: dinding belakang, meja jual, tenda, papan nama, penjual, titik beli
function kiosk(x, z, face, w, col, label, npc, shop, goods) {
  const f = frame(...L(x, z), face), d = 3.4, h = 2.8, wall = '#fbf3e4';
  f.solid(0, -d / 2, w, 0.25, 0, h, wall); f.solid(-w / 2, 0, 0.25, d, 0, h, wall); f.solid(w / 2, 0, 0.25, d, 0, h, wall);
  f.solid(0, d / 2 - 0.5, w - 0.4, 0.8, 0, 1.0, col); f.deco(0, d / 2 - 0.5, w - 0.2, 1.0, 1.0, 0.08, '#ffffff', f.g, false);
  f.deco(0, 0, w + 0.3, d + 0.3, h, 0.25, col);
  const n = Math.round(w / 0.8); for (let i = 0; i < n; i++) { const m = f.deco(-w / 2 + (i + 0.5) * (w / n), d / 2 + 0.55, w / n, 1.3, h - 0.2, 0.07, i % 2 ? '#ffffff' : col, f.g, false); m.rotation.x = 0.5; }
  f.deco(0, -d / 2 + 0.2, w - 0.6, 0.12, 1.5, 1.0, '#ffe8b0', f.g, false); // papan menu di dinding
  goods?.(f, d / 2 - 0.5, 1.08);
  const sp = sign(label, Math.min(5.2, w + 0.6), { bg: '#ffffff' }); putW(f, sp, 0, h + 1.1, d / 2 + 0.1, CDYN);
  if (npc) vendor(npc, f.W(0, -0.55), face);
  const s = f.W(0, d / 2 + 1.25); shopSpot(shop, s[0], s[1]); return f;
}
// gerobak dorong: roda, etalase kaca, payung, penjual
function cart(x, z, face, col, label, npc, shop, goods) {
  const f = frame(...L(x, z), face);
  f.solid(0, 0, 2.6, 1.2, 0.45, 0.85, col); f.deco(0, 0.62, 2.7, 0.06, 0.6, 0.4, '#ffffff', f.g, false);
  for (const sx of [-0.9, 0.9]) { const m = f.deco(sx, 0.7, 0.75, 0.15, 0.08, 0.75, '#2c2f3a', f.g, false); m.rotation.z = Math.PI / 4; }
  f.deco(0, 0, 2.5, 1.1, 1.3, 0.75, glassMat, f.g, false); f.deco(0, 0, 2.7, 1.3, 2.05, 0.08, col, f.g, false);
  goods?.(f, 0, 1.32);
  for (const sx of [-1.2, 1.2]) f.deco(sx, -0.5, 0.08, 0.08, 0.45, 1.6, '#c8ccd6', f.g, false);
  const [ux, uz] = f.W(-0.9, -0.9); umbrella(ux - CX, uz - CZ, col, 2.9, 2.6);
  const sp = sign(label, 3.8, { bg: '#fff6df' }); putW(f, sp, 0, 3.7, 0.4, CDYN);
  if (npc) vendor(npc, f.W(0, -1.25), face);
  const s = f.W(0, 1.75); shopSpot(shop, s[0], s[1]); return f;
}
// isi etalase
const pile = (cols, nx = 4, nz = 2, r = 0.32) => (f, lz, y) => { for (let i = 0; i < nx; i++) for (let k = 0; k < nz; k++) { const [x, z] = f.W(-((nx - 1) * 0.42) / 2 + i * 0.42, lz - 0.15 + k * 0.32); S('sph', r, r, r, cols[(i + k) % cols.length], x, y + r / 2, z, root, false); } };
// untaian bendera segitiga (dan lampion yang menyala saat malam) dari (x0,z0) ke (x1,z1) koordinat lokal kota
const lampionMat = new THREE.MeshLambertMaterial({ color: '#ffcf6a', emissive: '#ffb02e', emissiveIntensity: 0 });
function bunting(x0, z0, x1, z1, y, cols = ['#e8434b', '#ffffff'], lamp = false, sagMax = 1.4) {
  const [ax, az] = L(x0, z0), [bx, bz] = L(x1, z1), len = Math.hypot(bx - ax, bz - az), n = Math.max(3, Math.round(len / 1.0)), yaw = Math.atan2(bx - ax, bz - az), sag = Math.min(sagMax, len * 0.06);
  const P = (k) => new THREE.Vector3(ax + (bx - ax) * k, y - 4 * k * (1 - k) * sag, az + (bz - az) * k);
  for (let i = 0; i < n; i++) {
    const p0 = P(i / n), p1 = P((i + 1) / n), mid = p0.clone().add(p1).multiplyScalar(0.5), dir = p1.clone().sub(p0), l = dir.length();
    const s = K.box(1, 1, 1, '#f4f4f4', mid.x, mid.y, mid.z, root, false); s.scale.set(0.035, 0.035, l); s.lookAt(p1);
    const fp = P((i + 0.5) / n);
    if (lamp && i % 2) { const m = new THREE.Mesh(geo('sph'), lampionMat); m.scale.set(0.32, 0.38, 0.32); m.position.set(fp.x, fp.y - 0.28, fp.z); root.add(m); }
    else { const m = S('tri', 0.55, 0.62, 1, cols[i % cols.length], fp.x, fp.y - 0.02, fp.z, root, false); m.rotation.y = yaw - Math.PI / 2; }
  }
}
// tiang umbul-umbul berbendera panjang
function umbul(x, z, col) { SL('cyl', x, z, 0.12, 6.5, 0.12, '#ffffff'); const [wx, wz] = L(x, z); K.box(0.05, 3.6, 0.7, col, wx, 4.4, wz + 0.36, root, false); K.box(0.05, 1.2, 0.5, '#ffffff', wx, 2.0, wz + 0.26, root, false); }
// semak bunga bulat
function flowers(x, z, n = 5, r = 1.2) { for (let i = 0; i < n; i++) { const a = (i / n) * TAU; SL('sph', x + Math.cos(a) * r * rand(0.3, 1), z + Math.sin(a) * r * rand(0.3, 1), 0.9, 0.7, 0.9, pick(['#ff6f91', '#ffd23a', '#ff8a2a', '#e8434b', '#c77dff', '#ffffff']), 0.1); } SL('sph', x, z, r * 1.6, 0.7, r * 1.6, '#3fae4f', 0); }

// ---------- taman bermain (gratis): perosotan, ayunan, putar-putar; mainan koin di mall ----------
export const PLAY = { slide: null, swings: [], spin: null, kiddie: [] };
const SWING = { L: 2.6, top: 3.5, per: 2.8 };
function swingAngle(i, t) { const s = PLAY.swings[i]; return s.amp * Math.sin((t / SWING.per) * TAU + i * 1.7); }
function swingSeat(i, t) { const s = PLAY.swings[i], a = swingAngle(i, t); return { x: s.x, y: SWING.top - Math.cos(a) * SWING.L - 0.35, z: s.z + Math.sin(a) * SWING.L, yaw: 0, a }; }
function buildPlayground(cx, cz) {
  // perosotan: tangga di selatan, papan miring ke utara
  { const x = cx - 10, z = cz - 7, top = 2.6;
    for (const sx of [-0.6, 0.6]) SL('cyl', x + sx, z - 0.4, 0.12, top + 1, 0.12, '#3a7cf5');
    for (let k = 1; k <= 5; k++) deco(x, z - 0.6, 1.3, 0.12, 0.1, '#ffd23a', (k * top) / 5.5);
    deco(x, z + 0.2, 1.6, 1.4, 0.15, '#e8434b', top); for (const sx of [-0.75, 0.75]) deco(x + sx, z + 0.2, 0.1, 1.4, 0.7, '#ffd23a', top + 0.15);
    const len = 5, m = deco(x, z + 0.9 + len / 2 * Math.cos(0.45), 1.3, len, 0.12, '#ff8a2a', 0); m.rotation.x = 0.45; m.position.y = top / 2 + 0.25;
    for (const sx of [-0.68, 0.68]) { const r = deco(x + sx, z + 0.9 + len / 2 * Math.cos(0.45), 0.08, len, 0.3, '#ffd23a', 0); r.rotation.x = 0.45; r.position.y = top / 2 + 0.4; }
    addSolid(...L(x, z), 0.8, 0.8, 0, top + 0.3);
    PLAY.slide = { foot: L(x, z - 1.6), top: [L(x, z + 0.2), top + 0.3], end: L(x, z + 0.9 + len * Math.cos(0.45) + 0.6), h: top };
    SPOTS.slide = { x: PLAY.slide.foot[0], z: PLAY.slide.foot[1], kind: 'play' };
    const sp = sign('🛝 Perosotan · gratis', 3.6, { bg: '#d8ffe2' }); const [sx, sz] = L(x, z - 0.4); sp.position.set(sx, top + 2.2, sz); CDYN.add(sp); }
  // ayunan dua kursi (berayun di sumbu z)
  { const x = cx - 9, z = cz + 6, xs = [x - 1.4, x + 1.4];
    for (const sx of [-2.8, 2.8]) for (const sz of [-0.9, 0.9]) { const m = deco(x + sx, z + sz, 0.16, 0.16, SWING.top + 0.2, '#e8434b'); m.rotation.x = -sz * 0.25; m.position.z -= sz * 0.15; }
    deco(x, z, 5.9, 0.2, 0.2, '#e8434b', SWING.top); addSolid(...L(x - 2.8, z), 0.2, 0.9, 0, 3); addSolid(...L(x + 2.8, z), 0.2, 0.9, 0, 3);
    xs.forEach((lx, i) => {
      const [wx, wz] = L(lx, z), g = new THREE.Group(); g.position.set(wx, SWING.top, wz); CDYN.add(g);
      for (const sx of [-0.4, 0.4]) K.box(0.04, SWING.L, 0.04, '#9aa0a6', sx, -SWING.L / 2, 0, g, false);
      K.box(0.95, 0.1, 0.55, i ? '#3a7cf5' : '#ffd23a', 0, -SWING.L, 0, g);
      PLAY.swings.push({ x: wx, z: wz, g, amp: 0.15, want: 0.15, foot: [wx + (i ? 1.2 : -1.2), wz - 1.8] });
    });
    SPOTS.swing = { x: wx0(x), z: L(0, z - 2.2)[1], kind: 'play' };
    const sp = sign('🎢 Ayunan · gratis', 3.2, { bg: '#d8ffe2' }); const [sx, sz] = L(x, z); sp.position.set(sx, SWING.top + 1.3, sz); CDYN.add(sp); }
  // putar-putar (komidi mini) dengan pegangan
  { const x = cx + 1, z = cz + 11, [wx, wz] = L(x, z), g = new THREE.Group(); g.position.set(wx, 0, wz); CDYN.add(g);
    const disc = new THREE.Mesh(geo('cyl'), K.mat('#ff8fc0')); disc.scale.set(4, 0.25, 4); disc.position.y = 0.3; g.add(disc);
    for (let k = 0; k < 4; k++) { const a = (k / 4) * TAU; K.box(0.08, 1, 0.08, '#ffd23a', Math.cos(a) * 1.2, 0.9, Math.sin(a) * 1.2, g); K.box(0.08, 0.08, 2.4, '#ffd23a', Math.cos(a) * 0.6, 1.4, Math.sin(a) * 0.6, g).rotation.y = -a + Math.PI / 2; }
    K.box(0.2, 1.3, 0.2, '#ffffff', 0, 0.9, 0, g); addSolid(wx, wz, 0.3, 0.3, 0, 1.6);
    PLAY.spin = { x: wx, z: wz, g, r: 1.55 }; SPOTS.spin = { x: wx, z: wz - 2.7, kind: 'play' };
    const sp = sign('🌀 Putar-putar · gratis', 3.4, { bg: '#d8ffe2' }); sp.position.set(wx, 2.8, wz); CDYN.add(sp); }
  // bak pasir
  { const x = cx - 1, z = cz - 9; flat(x, z, 5, 4, '#f2d993', 0.08); for (const [ox, oz, w, d] of [[0, -2, 5.2, 0.25], [0, 2, 5.2, 0.25], [-2.6, 0, 0.25, 4.2], [2.6, 0, 0.25, 4.2]]) deco(x + ox, z + oz, w, d, 0.35, '#a5764a');
    SL('cone', x + 1, z, 0.9, 0.6, 0.9, '#e6c26b', 0.05); deco(x - 1, z + 0.5, 0.5, 0.4, 0.35, '#e8434b', 0.1); deco(x - 1.6, z - 0.6, 0.35, 0.35, 0.3, '#3a7cf5', 0.1); }
}
const wx0 = (x) => L(x, 0)[0];
const spinAngle = (t) => t * 0.9;
// mainan koin di mall: kuda goyang & mobil goyang
function kiddieRide(f, lx, lz, kind) {
  const [wx, wz] = f.W(lx, lz), g = new THREE.Group(); g.position.set(wx, 0.15, wz); g.rotation.y = Math.PI / 2; CDYN.add(g);
  K.box(1.4, 0.3, 2.2, '#9aa0a6', 0, 0.15, 0, g);
  const body = new THREE.Group(); body.position.y = 0.4; g.add(body);
  if (kind === 'kuda') { K.box(0.7, 0.7, 1.5, '#ffffff', 0, 0.6, 0, body); K.box(0.5, 0.9, 0.5, '#ffffff', 0, 1.1, 0.75, body); K.box(0.45, 0.4, 0.7, '#ffffff', 0, 1.5, 0.95, body); K.box(0.15, 0.5, 0.5, '#ff8fc0', 0, 1.35, 0.55, body); for (const sx of [-0.25, 0.25]) for (const sz of [-0.55, 0.55]) K.box(0.18, 0.5, 0.18, '#ffffff', sx, 0.1, sz, body); K.box(0.6, 0.12, 0.6, '#e8434b', 0, 0.98, -0.05, body); }
  else { K.box(1.1, 0.7, 2, '#3a7cf5', 0, 0.45, 0, body); K.box(0.9, 0.5, 0.9, '#bfe6ff', 0, 1.05, -0.2, body); for (const sx of [-0.6, 0.6]) for (const sz of [-0.65, 0.65]) K.box(0.15, 0.45, 0.45, '#2c2f3a', sx, 0.2, sz, body); K.box(0.3, 0.3, 0.1, '#ffd23a', 0, 0.6, 1.02, body); }
  addSolid(wx, wz, 1.1, 0.7, 0, 0.6);
  const sp = sign(kind === 'kuda' ? '🐴 Kuda goyang · 🪙 1' : '🚙 Mobil goyang · 🪙 1', 3, { bg: '#ffd23a' }); sp.position.set(wx, 3.0, wz); CDYN.add(sp);
  const r = { x: wx, z: wz, g, body, kind, spot: [wx + 1.9, wz], t: 0, on: 0 }; PLAY.kiddie.push(r);
  SPOTS['kiddie' + PLAY.kiddie.length] = { x: r.spot[0], z: r.spot[1], y: 0.15, kind: 'play' };
}
// dipanggil game.js lewat transitNear/boardTransit/transitPose
function playNear(px, pz, py) {
  const near = (s, r = 2) => s && Math.hypot(px - s.x, pz - s.z) < r && Math.abs(py - (s.y || 0)) < 1;
  if (near(SPOTS.slide)) return { id: 'slide', label: '🛝 Main perosotan · gratis', price: 0 };
  if (near(SPOTS.swing, 2.6)) { const i = PLAY.swings.findIndex((s) => s.amp < 0.2); return { id: 'swing', seat: Math.max(0, i), label: '🎢 Main ayunan · gratis', price: 0 }; }
  if (near(SPOTS.spin, 2.2)) return { id: 'spin', label: '🌀 Naik putar-putar · gratis', price: 0 };
  for (const [i, k] of PLAY.kiddie.entries()) if (near(SPOTS['kiddie' + (i + 1)], 1.6)) return { id: 'kiddie', ride: i, label: `${k.kind === 'kuda' ? '🐴 Naik kuda goyang' : '🚙 Naik mobil goyang'} · 🪙 1`, price: 1 };
  return null;
}
function playPose(tok, t) {
  const dt = t - tok.t0;
  if (tok.id === 'slide') {
    const S2 = PLAY.slide, [fx, fz] = S2.foot, [[tx, tz], ty] = S2.top, [ex, ez] = S2.end;
    if (dt < 2) { const k = dt / 2; return { x: fx + (tx - fx) * k, z: fz + (tz - fz) * k, y: ty * k, yaw: 0, info: '🛝 Naik tangga... hap hap!' }; }
    if (dt < 2.6) return { x: tx, z: tz, y: ty - 0.25, yaw: 0, info: '🛝 Siap meluncur!' };
    const k = Math.min(1, (dt - 2.6) / 1.3), e = k * k, done = dt > 4.2;
    return { x: tx + (ex - tx) * e, z: tz + (ez - tz) * e, y: Math.max(0.05, (ty - 0.25) * (1 - e) + 0.05), yaw: 0, pitch: k < 1 ? -0.42 : 0, slide: k < 1, auto: done, exit: done && { x: ex, z: ez + 0.8, y: 0, name: 'Perosotan' }, info: '🛝 Wuusss!' };
  }
  if (tok.id === 'swing') { const p = swingSeat(tok.seat, t), done = dt > 16, s = PLAY.swings[tok.seat]; return { x: p.x, z: p.z, y: p.y, yaw: 0, pitch: -p.a, auto: done, exit: done && { x: s.foot[0], z: s.foot[1], y: 0, name: 'Ayunan' }, info: `🎢 Ayunan · ${Math.max(0, Math.ceil(16 - dt))} detik` }; }
  if (tok.id === 'spin') { const S2 = PLAY.spin, a = spinAngle(t) + tok.a, done = dt > 14; return { x: S2.x + Math.cos(a) * S2.r, z: S2.z + Math.sin(a) * S2.r, y: 0.45, yaw: -a + Math.PI, auto: done, exit: done && { x: SPOTS.spin.x, z: SPOTS.spin.z, y: 0, name: 'Putar-putar' }, info: `🌀 Putar-putar · ${Math.max(0, Math.ceil(14 - dt))} detik` }; }
  const r = PLAY.kiddie[tok.ride], done = dt > 15; r.on = done ? 0 : t + 0.5;
  const a = Math.sin(dt * 4) * 0.22;
  return { x: r.x, z: r.z, y: 1.3 + (r.kind === 'kuda' ? 0.25 : 0), yaw: Math.PI / 2, pitch: a, auto: done, exit: done && { x: r.spot[0], z: r.spot[1], y: 0.15, name: r.kind === 'kuda' ? 'Kuda goyang' : 'Mobil goyang' }, info: `${r.kind === 'kuda' ? '🐴' : '🚙'} Goyang goyang · ${Math.max(0, Math.ceil(15 - dt))} detik` };
}

// ---------- ondel-ondel, pemain angklung, layang-layang, bebek, mandi bola, papan LED ----------
const LIFE = { ondel: [], kites: [], ducks: [], balls: null, ballHome: [], ballOff: [], led: null, ledI: 0, ledT: 0, music: [] };
function ondel(x, z, girl) {
  const n = addNpc({ id: girl ? 'ondelP' : 'ondelL', name: 'Ondel-ondel', role: 'Boneka Raksasa Betawi', x: L(x, z), face: 0, skin: girl ? '#f4ecd8' : '#c0392b', hair: '#1d1d1d', shirt: girl ? '#ff5f8f' : '#2c2f3a', pants: girl ? '#ffd23a' : '#e8434b', scale: 1.75, pitch: girl ? 0.05 : -0.45, wander: 5,
    lines: ['Aku ondel-ondel, boneka raksasa dari Betawi, Jakarta! Aku menari diiringi musik.', 'Dulu ondel-ondel dipercaya membawa keberuntungan. Sekarang aku menghibur di pesta dan festival!'] });
  if (girl) n.ch.setGirl(true);
  const ch = n.ch, dg = new THREE.Group(); ch.body.add(dg); K.box(1.25, 1.15, 0.85, girl ? '#ffd23a' : '#e8434b', 0, 0.55, 0, dg); // sarung
  for (let k = 0; k < 3; k++) K.box(1.27, 0.08, 0.87, '#ffffff', 0, 0.2 + k * 0.35, 0, dg);
  K.box(1.1, 0.2, 0.6, '#ffd23a', 0, 1.9, 0.02, dg); // selendang
  const kc = new THREE.Group(); ch.hatSlot.add(kc); // kembang kelapa
  for (let k = 0; k < 11; k++) { const a = -1.1 + (k / 10) * 2.2; const s = K.box(0.04, 0.9, 0.04, '#3fb25a', Math.sin(a) * 0.45, 0.4, 0, kc); s.rotation.z = -a * 0.6; K.box(0.16, 0.16, 0.16, pick(['#e8434b', '#ffd23a', '#ff8fc0', '#ffffff', '#3a7cf5']), Math.sin(a) * 0.82, 0.85 - Math.abs(a) * 0.12, 0, kc); }
  ch.root.traverse((m) => { if (m.isMesh) m.castShadow = false; });
  n.extra = [dg, kc]; LIFE.ondel.push(n); LIFE.music.push({ kind: 'ondel', n });
}
function kite(ax, az, col, hx, hz) {
  const g = new THREE.Group(); life().add(g);
  const k = K.box(1.6, 1.6, 0.05, col, 0, 0, 0, g, false); k.rotation.z = Math.PI / 4; k.scale.y = 1.2;
  K.box(0.05, 2.2, 0.06, '#8a5a35', 0, 0, 0.04, g, false); K.box(1.5, 0.05, 0.06, '#8a5a35', 0, 0.2, 0.04, g, false);
  const tail = []; for (let i = 0; i < 6; i++) { const b = K.box(0.35, 0.18, 0.04, i % 2 ? '#ffffff' : '#ffd23a', 0, -1.4 - i * 0.55, 0, g, false); tail.push(b); }
  LIFE.kites.push({ g, tail, a: [ax, 1.6, az], hx, hz, ph: rand(0, 6) });
}
function ducks(x, z, rx, rz) {
  const [wx, wz] = L(x, z);
  for (let k = 0; k < 4; k++) {
    const g = new THREE.Group(), s = k ? 0.5 : 1; g.scale.setScalar(s); life().add(g);
    const c = k ? '#ffd23a' : '#ffffff'; K.box(0.7, 0.45, 0.95, c, 0, 0.12, 0, g, false); K.box(0.42, 0.42, 0.42, c, 0, 0.55, 0.38, g, false); K.box(0.22, 0.1, 0.24, '#ff8a2a', 0, 0.5, 0.66, g, false); K.box(0.3, 0.2, 0.2, c, 0, 0.35, -0.5, g, false);
    for (const sx of [-0.12, 0.12]) K.box(0.06, 0.08, 0.04, '#1d1d1d', sx, 0.62, 0.6, g, false);
    LIFE.ducks.push({ g, k, wx, wz, rx, rz });
  }
}
function buildBallPit(f, lx, lz, w, d) {
  const rim = '#ffd23a';
  for (const [ox, oz, ww, dd] of [[0, -d / 2, w, 0.3], [0, d / 2, w, 0.3], [-w / 2, 0, 0.3, d], [w / 2, 0, 0.3, d]]) f.deco(lx + ox, lz + oz, ww, dd, 0.15, 0.45, rim);
  f.deco(lx, lz, w - 0.2, d - 0.2, 0.15, 0.05, '#7cc8f5');
  const N = Math.round(w * d * 2.2), m = new THREE.InstancedMesh(geo('sph'), new THREE.MeshLambertMaterial({ color: '#ffffff' }), N), col = new THREE.Color();
  m.frustumCulled = false; m.castShadow = false;
  for (let i = 0; i < N; i++) { const [x, z] = f.W(lx + rand(-w / 2 + 0.4, w / 2 - 0.4), lz + rand(-d / 2 + 0.4, d / 2 - 0.4)); LIFE.ballHome.push([x, 0.32 + rand(0, 0.25), z]); LIFE.ballOff.push([0, 0, 0]); m.setColorAt(i, col.set(pick(['#e8434b', '#ffd23a', '#3a7cf5', '#3fb25a', '#ff8fc0', '#ff8a2a']))); }
  m.instanceColor.needsUpdate = true; CDYN.add(m); LIFE.balls = m;
  const sp = sign('🟡 Mandi Bola · gratis', 3.6, { bg: '#ffd23a' }); putW(f, sp, lx, 3.3, lz, CDYN);
}
const LED_MSG = ['🎉 SELAMAT DATANG DI MALL KOTA!', '🍲 FOOD COURT DI LANTAI 4', '🟡 MANDI BOLA GRATIS!', '🐴 KUDA GOYANG CUMA 🪙 1', '📸 FOTO BARENG TEMAN', '🎬 BIOSKOP DI LANTAI 5', '🛗 NAIK LIFT KACA KE 5 LANTAI'];
function drawLed(g, w, h, i) {
  const grd = g.createLinearGradient(0, 0, w, 0); grd.addColorStop(0, '#9a62e0'); grd.addColorStop(1, '#ff5f8f'); g.fillStyle = grd; g.fillRect(0, 0, w, h);
  g.fillStyle = 'rgba(255,255,255,0.18)'; for (let x = 0; x < w; x += 16) for (let y = 0; y < h; y += 16) g.fillRect(x + 6, y + 6, 4, 4);
  g.fillStyle = '#ffffff'; g.font = `800 52px ${K.FONT}`; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(LED_MSG[i % LED_MSG.length], w / 2, h / 2 + 3);
}

// ---------- susun semuanya ----------
const BREADS = ['#d9a05b', '#c98a45', '#f0c27a', '#8a5a35'], FRUITS = ['#e8434b', '#ffd23a', '#3fb25a', '#ff8a2a', '#9a62e0'];
function buildLife() {
  const life = new THREE.Group(); life.userData.dynamic = true; CDYN.add(life); LIFE.g = life; const cdyn0 = CDYN.children.length;
  // ===== ALUN-ALUN: kafe, toko roti, lapak buah, gerobak jajanan, angklung, merpati =====
  { const ax = -24, az = -24;
    kiosk(ax, az - 16.2, 0, 9, '#8a5a35', '☕ Kafe Kita', { id: 'barista', name: 'Kak Raka', role: 'Barista Kafe', shirt: '#2c2f3a', pants: '#8a5a35', hat: 'koki', pitch: -0.1 }, 'kafe', (f, lz, y) => {
      for (let i = 0; i < 6; i++) { const [x, z] = f.W(-3 + i * 0.5, lz); S('cyl', 0.28, 0.32, 0.28, i % 2 ? '#ffffff' : '#ff8fc0', x, y + 0.16, z, root, false); }
      const [mx, mz] = f.W(2.6, lz); K.box(1.1, 0.8, 0.6, '#c8ccd6', mx, y + 0.4, mz, root); K.box(0.9, 0.2, 0.3, '#2c2f3a', mx, y + 0.75, mz + 0.2, root, false); });
    for (const [x, z, c] of [[ax - 6.5, az - 10.5, '#e8434b'], [ax, az - 9.5, '#3a7cf5'], [ax + 6.5, az - 10.5, '#ffd23a']]) { cafeTable(x, z, '#8a5a35'); umbrella(x, z, c, 2.8, 3.2);
      for (const s of [-1, 1]) { const [wx, wz] = L(x + s * 1.1, z); person({ mode: 'sit', x: wx, z: wz, y: 0.25, yaw: s > 0 ? -Math.PI / 2 : Math.PI / 2, act: pick(['eat', 'talk']) }); } }
    kiosk(ax - 13.5, az - 16.2, 0, 6, '#ff8fc0', '🍞 Toko Roti', { id: 'tokoroti', name: 'Bu Ningsih', role: 'Pembuat Roti', girl: true, shirt: '#ffffff', pants: '#ff8fc0', hat: 'koki', pitch: 0.1 }, 'roti', pile(BREADS, 6, 2, 0.4));
    kiosk(ax + 13.5, az - 16.2, 0, 6, '#3fb25a', '🍉 Lapak Buah', { id: 'tukangbuah', name: 'Pak Darto', role: 'Pedagang Buah', shirt: '#3fb25a', pants: '#5b3b22', hat: 'caping', pitch: -0.25, talk: talkFruit }, 'buah', pile(FRUITS, 6, 2, 0.42));
    cart(ax - 12, az + 15.2, Math.PI, '#e8434b', '🍲 Bakso', { id: 'mangbakso', name: 'Mang Ujang', role: 'Penjual Bakso', shirt: '#ffffff', pants: '#2c2f3a', pitch: -0.3 }, 'bakso', pile(['#c8a27a', '#f4ecd8'], 4, 1));
    cart(ax - 6.5, az + 15.2, Math.PI, '#ff8a2a', '🍢 Sate', { id: 'pksate', name: 'Pak Slamet', role: 'Penjual Sate', shirt: '#ff8a2a', pants: '#2c2f3a', pitch: -0.35 }, 'sate', pile(['#8a5a35', '#a5764a'], 5, 1, 0.22));
    cart(ax + 6.5, az + 15.2, Math.PI, '#9a62e0', '🥞 Martabak', { id: 'martabak', name: 'Bang Rizal', role: 'Penjual Martabak', shirt: '#9a62e0', pants: '#2c2f3a', pitch: -0.15 }, 'martabak', pile(['#e6b82f', '#8a5a35'], 3, 1, 0.5));
    cart(ax + 12, az + 15.2, Math.PI, '#3fb25a', '🥥 Es Kelapa', { id: 'eskelapa', name: 'Bu Inah', role: 'Penjual Es Kelapa', girl: true, shirt: '#3fb25a', pants: '#ffd23a', pitch: 0.05 }, 'kelapa', pile(['#3f8a3a', '#5fb953'], 3, 1, 0.55));
    for (const [x, c] of [[-12, 0], [-6.5, 1], [6.5, 2], [12, 3]]) { const [wx, wz] = L(ax + x + 1.1, az + 12.9); person({ mode: 'stand', x: wx, z: wz, yaw: 0, act: pick(['idle', 'look', 'phone']), kid: c % 2 === 0 }); }
    // pemain angklung + penonton
    { const [x, z] = [ax - 15, az - 6];
      addNpc({ id: 'angklung', name: 'Kang Asep', role: 'Pemain Angklung', x: L(x, z), face: Math.PI / 2, shirt: '#1d1d1d', pants: '#1d1d1d', hat: 'caping', pitch: -0.2, talk: talkAngklung });
      for (let i = 0; i < 5; i++) { const lx = x + 1.3, lz = z - 1.2 + i * 0.6, h = 0.9 - i * 0.12; SL('cyl', lx, lz, 0.16, h, 0.16, '#e6c26b', 0.35); }
      deco(x + 1.3, z, 0.12, 3.2, 0.12, '#a5764a', 0.3); flat(x + 0.3, z, 3, 3.6, '#c0392b', 0.07); LIFE.music.push({ kind: 'angklung', x: L(x, z)[0], z: L(x, z)[1] });
      for (let i = 0; i < 4; i++) { const [wx, wz] = L(x + 4.2 + (i % 2) * 1.1, z - 1.8 + i * 1.2); person({ mode: 'stand', x: wx, z: wz, yaw: -Math.PI / 2, act: i % 2 ? 'clap' : 'cheer', kid: true }); } }
    // tenda mainan (hiasan)
    for (const [z, c] of [[az - 6, '#3a7cf5'], [az + 6, '#ff8a2a']]) { const x = ax + 16.2;
      for (const sx of [-1.4, 1.4]) for (const sz of [-1.6, 1.6]) SL('cyl', x + sx, z + sz, 0.1, 2.5, 0.1, '#c8ccd6'); SL('roof', x, z, 3.6, 1.1, 4, c, 2.5);
      deco(x, z, 2.4, 3, 0.85, '#ffffff'); for (let i = 0; i < 6; i++) deco(x - 0.6 + (i % 2) * 1.2, z - 1.1 + Math.floor(i / 2) * 1.1, 0.5, 0.5, 0.5, pick(BAL_COLS), 0.85); addSolid(...L(x, z), 1.3, 1.6, 0, 1.4); }
    // untaian bendera & lampion dari air mancur ke tepi alun-alun
    SL('cyl', ax, az, 0.15, 4.0, 0.15, '#ffffff', 3.6); SL('sph', ax, az, 0.5, 0.5, 0.5, '#ffd23a', 7.5);
    for (let k = 0; k < 8; k++) { const a = (k / 8) * TAU + Math.PI / 8, ex = ax + Math.cos(a) * 17.5, ez = az + Math.sin(a) * 17.5; SL('cyl', ex, ez, 0.12, 6.9, 0.12, '#ffffff'); bunting(ax, az, ex, ez, 7.3, k % 2 ? ['#e8434b', '#ffffff'] : ['#ffd23a', '#3a7cf5', '#3fb25a', '#ff8fc0'], k % 2 === 0, 0.8); }
    flock(ax, az, 11, 16, 6.8); birdSpot(ax + 6.6, az + 6.6);
    const [cx, cz] = L(ax, az); wanderer(cx - 17, cx + 17, cz - 13, cz + 12, 12, {}, (x, z) => Math.hypot(x - cx, z - cz) > 6.8 && !W.hitsSolid(x, z, 0.35, 0.35, 0));
  }
  // ===== TUGU: ondel-ondel, merpati, kerak telor, penjual balon, titik foto =====
  { const tx = -24, tz = 24;
    for (let k = 0; k < 8; k++) { const a = (k / 8) * TAU; flowers(tx + Math.cos(a) * 5.4, tz + Math.sin(a) * 5.4, 4, 0.9); }
    ondel(tx + 10, tz - 3, false); ondel(tx - 10, tz + 3, true);
    { const [wx, wz] = L(tx + 12.5, tz + 8); person({ mode: 'stand', x: wx, z: wz, yaw: -Math.PI / 2, act: 'clap', shirt: '#3fb25a', pants: '#1d1d1d', girl: false, kid: false }); }
    SL('cyl', tx + 11.4, tz + 8, 0.9, 0.9, 0.9, '#c0392b'); SL('cyl', tx + 11.4, tz + 8, 0.92, 0.08, 0.92, '#f4ecd8', 0.9);
    cart(tx - 13, tz - 9, Math.PI / 2, '#ff8a2a', '🍳 Kerak Telor', { id: 'keraktelor', name: 'Babe Mamat', role: 'Penjual Kerak Telor', shirt: '#e8434b', pants: '#1d1d1d', hat: 'tinggi', pitch: -0.3 }, 'kerak', pile(['#e6b82f', '#8a5a35'], 3, 1, 0.45));
    { const f = cart(tx - 13, tz + 9, Math.PI / 2, '#ff8fc0', '🎈 Balon', { id: 'balon', name: 'Pak Ujo', role: 'Penjual Balon', shirt: '#ffd23a', pants: '#3b4a6b', pitch: -0.2 }, 'balon');
      const [bx, bz] = f.W(0.6, -0.4); LIFE.balloonBunch = []; for (let i = 0; i < 9; i++) { const m = new THREE.Mesh(geo('sph'), K.mat(BAL_COLS[i % 6])); m.scale.set(0.8, 0.95, 0.8); m.userData.base = [bx + rand(-0.9, 0.9), 4.2 + rand(0, 1.2), bz + rand(-0.6, 0.6)]; m.position.set(...m.userData.base); life.add(m); LIFE.balloonBunch.push(m); } }
    { const [px, pz] = L(tx, tz - 12.5); SPOTS.photo_tugu = { x: px, z: pz, kind: 'photo', where: 'Tugu Kota' };
      for (const sx of [-1.6, 1.6]) SL('cyl', tx + sx, tz - 14.4, 0.12, 2.6, 0.12, '#ffd23a'); deco(tx, tz - 14.4, 3.4, 0.12, 0.25, '#ffd23a', 2.6);
      const sp = sign('📸 Titik Foto', 3, { bg: '#ffd23a' }); sp.position.set(px, 3.4, L(0, tz - 14.4)[1]); CDYN.add(sp); }
    for (const sx of [-1, 1]) { B(tx + sx * 12.5, tz, 0.6, 2.6, 0.45, '#a5764a', 0, true); for (const oz of [-0.6, 0.6]) { const [wx, wz] = L(tx + sx * 12.5, tz + oz); person({ mode: 'sit', x: wx, z: wz, y: 0.25, yaw: -sx * Math.PI / 2, act: 'talk' }); } }
    for (let i = 0; i < 3; i++) { const [wx, wz] = L(tx - 4 + i * 4, tz + 10.5); person({ mode: 'stand', x: wx, z: wz, yaw: Math.PI, act: 'photo' }); }
    flock(tx, tz, 10.5, 16, 4.4); birdSpot(tx + 7.5, tz - 4.5);
    const [cx, cz] = L(tx, tz); const okT = (x, z) => Math.hypot(x - cx, z - cz) > 4.2 && !W.hitsSolid(x, z, 0.35, 0.35, 0);
    wanderer(cx - 16, cx + 16, cz - 16, cz + 16, 10, {}, okT);
    for (const b of BAL_COLS.slice(0, 3)) wanderer(cx - 15, cx + 15, cz - 15, cz + 15, 1, { kid: true, balloon: b }, okT);
  }
  // ===== TAMAN KOTA: taman bermain, kolam bebek, layang-layang, piknik =====
  { const gx = -24, gz = 72;
    buildPlayground(gx, gz);
    for (const [ox, oz, w, d] of [[0, -3.7, 10.6, 0.4], [0, 3.7, 10.6, 0.4], [-5.2, 0, 0.4, 7.8], [5.2, 0, 0.4, 7.8]]) deco(gx + 4 + ox, gz - 4 + oz, w, d, 0.25, '#b9b3a6');
    for (const [ox, oz] of [[-2, -1], [1.5, 1.4], [3, -1.8]]) SL('cyl', gx + 4 + ox, gz - 4 + oz, 1, 0.04, 1, '#3fae4f', 0.09);
    ducks(gx + 4, gz - 4, 3.4, 2.1);
    for (const [x, z, c] of [[gx + 8, gz + 9, '#e8434b'], [gx - 4, gz + 2, '#3a7cf5']]) { flat(x, z, 3.4, 2.6, c, 0.08); for (let i = 0; i < 4; i++) flat(x - 1.275 + i * 0.85, z, 0.42, 2.6, '#ffffff', 0.085);
      SL('cyl', x + 1, z - 0.4, 0.6, 0.45, 0.45, '#a5764a', 0.08);
      for (const [ox, oz, yaw] of [[-0.9, 0.9, Math.PI], [0.2, 1.0, Math.PI], [-0.5, -1.0, 0]]) { const [wx, wz] = L(x + ox, z + oz); person({ mode: 'sit', x: wx, z: wz, y: -0.1, yaw, act: pick(['eat', 'talk']), kid: Math.random() < 0.5 }); } }
    for (const [x, z, c, hx, hz] of [[gx + 6, gz - 12, '#e8434b', 4, -8], [gx + 13, gz + 1, '#3a7cf5', 7, 2], [gx + 2, gz + 14, '#ffd23a', -3, 8]]) { const [wx, wz] = L(x, z); const p = person({ mode: 'stand', x: wx, z: wz, yaw: Math.atan2(hx, hz), act: 'kite', kid: true }); kite(wx + 0.5, wz, c, hx, hz); LIFE.kites.at(-1).a = [wx + Math.sin(p.yaw) * 0.6, 2.4 * p.sc, wz + Math.cos(p.yaw) * 0.6]; }
    for (let i = 0; i < 3; i++) person({ mode: 'run', cx: L(gx + 9, 0)[0], cz: L(0, gz + 3)[1], r: 2.4, a: (i / 3) * TAU, spd: 3.2, kid: true, x: 0, z: 0 });
    for (let i = 0; i < 2; i++) { const [wx, wz] = L(gx - 7 + i * 1.6, gz + 13); person({ mode: 'jump', x: wx, z: wz, act: 'cheer', hop: 0.4, kid: true }); }
    for (let i = 0; i < 2; i++) person({ mode: 'ride', cx: PLAY.spin.x, cz: PLAY.spin.z, r: PLAY.spin.r, a: i * Math.PI + 0.8, rot: spinAngle, y: 0.45, kid: true, x: 0, z: 0 });
    { const [wx, wz] = L(gx + 7, gz + 6); for (const s of [-0.7, 0.7]) person({ mode: 'sit', x: wx + s, z: wz, y: 0.25, yaw: Math.PI, act: 'talk' }); }
    cart(gx - 8, gz - 15.5, 0, '#ff8fc0', '🍭 Gulali', { id: 'gulali', name: 'Kak Ayu', role: 'Penjual Gulali', girl: true, shirt: '#ff8fc0', pants: '#3a7cf5', pitch: 0.2 }, 'gulali', pile(['#ffb3d1', '#ffd6e8'], 3, 1, 0.5));
    const [cx, cz] = L(gx, gz); wanderer(cx - 15, cx + 15, cz - 15, cz + 15, 8, {}, (x, z) => !W.hitsSolid(x, z, 0.35, 0.35, 0) && Math.hypot(x - (cx + 4), z - (cz - 4)) > 5.6);
  }
  // ===== TAMAN HIBURAN: gulali & popcorn, pengunjung =====
  cart(73, 24, Math.PI / 2, '#e8434b', '🍿 Popcorn & Gulali', { id: 'popcorn', name: 'Bang Iwan', role: 'Penjual Popcorn', shirt: '#e8434b', pants: '#2c2f3a', pitch: -0.2 }, 'gulali', pile(['#fff3c4', '#ffe08a'], 4, 1, 0.36));
  { const [x0, z0] = L(54, 6), [x1, z1] = L(92, 44); wanderer(x0, x1, z0, z1, 9); wanderer(x0, x1, z0, z1, 2, { kid: true, balloon: '#3a7cf5' }); }
  // ===== trotoar, halte, umbul-umbul =====
  for (const bx of BLOCKS) for (const bz of BLOCKS) { if (bx === 24 && bz === 24) continue; walker(bx, bz, 19.3, 1, rand(0, 150)); walker(bx, bz, 19.3, -1, rand(0, 150), { kid: Math.random() < 0.25 }); }
  for (const s of BUS.stops) { const p = rectPoint(STOP_D[s.i]), n = randi(1, 2); for (let k = 0; k < n; k++) { const u = k ? 1.8 : -1.8, [wx, wz] = L(p.x + p.nx * 5.4 - p.nz * u, p.z + p.nz * 5.4 + p.nx * u); person({ mode: 'stand', x: wx, z: wz, yaw: Math.atan2(-p.nx, -p.nz), act: pick(['phone', 'look', 'idle']) }); } }
  const UC = ['#e8434b', '#ffd23a', '#3fb25a', '#3a7cf5', '#ff8fc0'];
  for (const side of [-5.2, 5.2]) for (let t = -90; t <= 90; t += 10) { if (Math.abs(t) < 9 || Math.abs(Math.abs(t) - 48) < 8) continue;
    for (const [x, z] of [[side, t], [t, side]]) { const [wx, wz] = L(x, z); if (W.hitsSolid(wx, wz, 0.4, 0.4, 0.3) || Object.values(SPOTS).some((s) => Math.hypot(s.x - wx, s.z - wz) < 3) || BUS.stops.some((s) => Math.hypot(s.x - wx, s.z - wz) < 4)) continue; umbul(x, z, UC[(Math.round(t / 10) + 10) % 5]); } }
  crowdFinish(); birdsFinish();
  { const n = LIFE.kites.length * 2, lg = new THREE.BufferGeometry().setAttribute('position', new THREE.BufferAttribute(new Float32Array(n * 3), 3)); LIFE.kiteLine = new THREE.LineSegments(lg, new THREE.LineBasicMaterial({ color: '#ffffff' })); LIFE.kiteLine.frustumCulled = false; life.add(LIFE.kiteLine); }
  LIFE.instA = instancer([...LIFE.kites.map((k) => k.g), ...LIFE.ducks.map((d) => d.g), ...(LIFE.balloonBunch || [])], life);
  for (const n of LIFE.ondel) n.inst = instancer(n.extra, life);
  LIFE.instB = instancer([...PLAY.swings.map((s) => s.g), PLAY.spin.g, ...PLAY.kiddie.map((r) => r.g)], CDYN);
  LIFE.signs = CDYN.children.slice(cdyn0).filter((o) => o.isSprite);
}
// hiasan bergerak dari banyak balok: objek aslinya disembunyikan & hanya dipakai menghitung posisi,
// lalu digambar sekaligus sebagai InstancedMesh per bentuk (1 draw call per bentuk)
function instancer(objs, parent) {
  const by = new Map(); for (const o of objs) o.traverse((m) => { if (m.isMesh) { if (!by.has(m.geometry)) by.set(m.geometry, []); by.get(m.geometry).push(m); } });
  const col = new THREE.Color(), out = [];
  for (const [g, ms] of by) {
    const im = new THREE.InstancedMesh(g, new THREE.MeshLambertMaterial({ color: '#ffffff' }), ms.length); im.frustumCulled = false; im.castShadow = false; im.receiveShadow = true;
    ms.forEach((m, i) => { im.setColorAt(i, col.copy(m.material.color)); m.visible = false; m.updateWorldMatrix(true, false); im.setMatrixAt(i, m.matrixWorld); });
    im.instanceColor.needsUpdate = true; parent.add(im); out.push({ im, ms });
  }
  return out;
}
function syncInst(list) { for (const { im, ms } of list) { ms.forEach((m, i) => { m.updateWorldMatrix(true, false); im.setMatrixAt(i, m.matrixWorld); }); im.instanceMatrix.needsUpdate = true; } }
const life = () => LIFE.g;
// pedagang buah: kuis warna buah (bintang dari talkTo)
function talkFruit(api) {
  const Q = [['Buah apa yang kuning dan panjang?', ['🍌 Pisang', '🍇 Anggur', '🍉 Semangka'], 0, 'Betul, pisang! Kuning dan panjang.', 'Hmm, yang kuning dan panjang itu pisang.'],
    ['Buah apa yang kulitnya hijau tapi dalamnya merah?', ['🍊 Jeruk', '🍉 Semangka', '🍎 Apel'], 1, 'Pintar! Semangka hijau di luar, merah di dalam.', 'Itu semangka, kulitnya hijau, dalamnya merah.'],
    ['Buah apa yang kecil, bulat, dan bergerombol?', ['🥭 Mangga', '🍌 Pisang', '🍇 Anggur'], 2, 'Hebat! Anggur tumbuh bergerombol.', 'Jawabannya anggur, kecil-kecil bergerombol.'],
    ['Jeruk itu warnanya apa?', ['🟠 Oranye', '🔵 Biru', '🟣 Ungu'], 0, 'Betul, jeruk warnanya oranye!', 'Jeruk warnanya oranye, seperti namanya!']];
  const q = pick(Q);
  if (Math.random() < 0.5) api.ask(q[0], q[1], q[2], q[3], q[4]);
  else api.say('Buah segar membuat badan sehat! Beli di depan lapak, satu koin saja. Mau tebak-tebakan? Ngobrol lagi denganku!');
}
// pemain angklung: memainkan lagu atau mengajari nada
function talkAngklung(api) {
  api.choose('Angklung terbuat dari bambu dan berasal dari Jawa Barat. Digoyang, bunyinya klung klung! Mau dengar?', ['🎶 Mainkan lagu', '🎵 Ajari aku nada', '👋 Nanti saja'], (i) => {
    if (i === 0) { api.tune?.('lagu'); api.say('Klung klung klung! Lagu ceria untukmu. Angklung sudah diakui dunia, lho!'); }
    else if (i === 1) { api.tune?.('nada'); api.say('Do, re, mi, fa, sol, la, si, do! Satu angklung hanya punya satu nada. Kalau dimainkan bersama-sama, jadilah lagu.'); }
  });
}
// gerak tiap bingkai
let ledT = 0;
function updateLife(dt, P, t) {
  // di dalam mall: pengunjung di lantai atas (yang sedang disembunyikan) ikut tidak terlihat
  const inMall = Math.abs(P.pos.x - MALL.x) < MALL.hx + 0.3 && Math.abs(P.pos.z - MALL.z) < MALL.hz + 0.3 && P.y < MALL.b[5] - 0.5, key = inMall ? Math.floor((P.y + 1.4 - 0.15) / 4.5) : 9;
  if (key !== CROWD.mallKey) { CROWD.mallKey = key; for (const c of CROWD.list) if (c.mlv) c.hidden = c.mlv > key; }
  if (MALL.cab) { const per = 16, u = (t % per) / per, k = u < 0.5 ? u * 2 : 2 - u * 2; MALL.cab.position.y = 0.15 + sstep(0, 1, k) * MALL.b[4]; }
  if (MALL.screen && (LIFE.filmT = (LIFE.filmT || 0) - dt) <= 0) { LIFE.filmT = 3; LIFE.filmI = (LIFE.filmI || 0) + 1; const { g, canvas } = MALL.screen.userData; drawFilm(g, canvas.width, canvas.height, LIFE.filmI); MALL.screen.needsUpdate = true; }
  crowdTick(dt, P, t); birdsTick(dt, P, t);
  for (const [i, s] of PLAY.swings.entries()) { s.amp += ((s.rideT > t ? 0.75 : 0.1) - s.amp) * Math.min(1, dt * 0.6); s.g.rotation.x = -swingAngle(i, t); }
  if (PLAY.spin) PLAY.spin.g.rotation.y = -spinAngle(t);
  for (const r of PLAY.kiddie) r.body.rotation.x = r.on > t ? Math.sin(t * 4) * 0.22 : 0;
  for (const n of LIFE.ondel) { for (const q of n.inst) q.im.visible = n.ch.root.visible; if (!n.ch.root.visible) continue; syncInst(n.inst); n.ch.body.rotation.z = Math.sin(t * 2.6 + n.phase) * 0.1; n.ch.head.rotation.y = Math.sin(t * 1.3 + n.phase) * 0.3; }
  for (const k of LIFE.kites) {
    const [ax, ay, az] = k.a, x = ax + k.hx + Math.sin(t * 0.4 + k.ph) * 2.5, y = 14 + Math.sin(t * 0.7 + k.ph) * 1.8, z = az + k.hz + Math.cos(t * 0.33 + k.ph) * 2;
    k.g.position.set(x, y, z); k.g.lookAt(ax, ay, az); k.g.rotateZ(Math.sin(t * 1.1 + k.ph) * 0.25);
    k.tail.forEach((b, i) => (b.position.x = Math.sin(t * 3 + i * 0.7) * 0.12 * i));
    const a = LIFE.kiteLine.geometry.attributes.position, i = LIFE.kites.indexOf(k) * 2; a.setXYZ(i, ax, ay, az); a.setXYZ(i + 1, x, y - 0.2, z); a.needsUpdate = true;
  }
  for (const d of LIFE.ducks) { const a = t * 0.22 - d.k * 0.45, x = d.wx + Math.cos(a) * d.rx, z = d.wz + Math.sin(a) * d.rz; d.g.position.set(x, 0.08 + Math.sin(t * 2 + d.k) * 0.03, z); d.g.rotation.y = Math.atan2(-Math.sin(a) * d.rx, Math.cos(a) * d.rz); }
  for (const m of LIFE.balloonBunch || []) { const [x, y, z] = m.userData.base; m.position.set(x + Math.sin(t * 1.1 + y) * 0.15, y + Math.sin(t * 1.6 + x) * 0.12, z); }
  if (LIFE.balls && Math.hypot(P.pos.x - LIFE.ballHome[0][0], P.pos.z - LIFE.ballHome[0][2]) < 18) {
    LIFE.ballHome.forEach((h, i) => {
      const o = LIFE.ballOff[i], dx = h[0] + o[0] - P.pos.x, dz = h[2] + o[2] - P.pos.z, d = Math.hypot(dx, dz);
      if (d < 1.1 && P.y < 1.6) { const k = (1.1 - d) / (d || 1); o[0] += dx * k * 0.6; o[2] += dz * k * 0.6; o[1] = Math.min(1.2, o[1] + (1.1 - d) * 1.8); }
      o[0] *= 1 - Math.min(1, dt * 1.5); o[2] *= 1 - Math.min(1, dt * 1.5); o[1] = Math.max(0, o[1] - dt * 2.5);
      LIFE.balls.setMatrixAt(i, _cm.compose(_cv.set(h[0] + o[0], h[1] + o[1] + Math.sin(t * 2 + i) * 0.02, h[2] + o[2]), _cq.identity(), _cs.setScalar(0.42)));
    });
    LIFE.balls.instanceMatrix.needsUpdate = true;
  }
  if (LIFE.instA) { syncInst(LIFE.instA); syncInst(LIFE.instB); }
  if ((LIFE.signT = (LIFE.signT || 0) - dt) <= 0) { LIFE.signT = 0.5; for (const sp of LIFE.signs || []) sp.visible = Math.hypot(sp.position.x - P.pos.x, sp.position.z - P.pos.z) < 48; }
  if (LIFE.led && (ledT -= dt) <= 0) { ledT = 3.5; LIFE.ledI++; const { g, canvas } = LIFE.led.userData; drawLed(g, canvas.width, canvas.height, LIFE.ledI); LIFE.led.needsUpdate = true; }
}
// sumber suara suasana terdekat (musik ondel-ondel, angklung, merpati)
export function cityAmbient(P) {
  if (W.islandOf(P.pos.x, P.pos.z) !== 'kota' || !CROWD.g?.visible) return null;
  for (const n of LIFE.ondel) if (Math.hypot(n.pos.x - P.pos.x, n.pos.z - P.pos.z) < 13) return 'ondel';
  for (const b of BIRDS.list) if (b.st && Math.hypot(b.x - P.pos.x, b.z - P.pos.z) < 8) return 'birdsfly';
  for (const f of BIRDS.flocks) if (Math.hypot(f.x - P.pos.x, f.z - P.pos.z) < f.r + 2) return 'birds';
  return null;
}

/* =========================================================
   FLYING FOX: menara 30 m di pantai selatan → panggung di pantai utara, menyusuri atas jalan x = 48.
   Gerak dihitung sekali (gravitasi + hambatan udara + rem halus + ayunan bandul) lalu diinterpolasi: mulus, tidak patah-patah.
   ========================================================= */
export const ZIP = { price: 3, x: 48, z0: -102.3, z1: 102.3, y0: 32, y1: 8.2, sag: 3.2, hang: 2.35, pre: 3, tab: [], T: 0, len: 0, pts: [], showS: -1, showT: 0 };
function zipCable(u) { const Z = ZIP; return [Z.x, Z.y0 + (Z.y1 - Z.y0) * u - Z.sag * 4 * u * (1 - u), Z.z0 + (Z.z1 - Z.z0) * u]; }
function zipPrep() {
  const Z = ZIP, N = 400; let acc = 0, prev = zipCable(0); Z.pts = [{ s: 0, u: 0, p: prev }];
  for (let i = 1; i <= N; i++) { const u = i / N, p = zipCable(u); acc += Math.hypot(p[1] - prev[1], p[2] - prev[2]); Z.pts.push({ s: acc, u, p }); prev = p; }
  Z.len = acc;
  // simulasi: v' = g·sinθ − c·v² (rem halus 18 m terakhir), ayunan φ'' = −k·φ − d·φ' − a/L
  let s = 0, v = 1.2, phi = 0, w = 0, t = 0; const dt = 1 / 120, g = 9.8, c = 0.011;
  while (s < Z.len && t < 60) {
    const q = zipAt(s), sinT = -q.slope / Math.hypot(1, q.slope);
    let a = g * sinT - c * v * v; const rem = Z.len - s, vmax = Math.sqrt(2 * 1.1 * rem) + 0.35;
    if (v > vmax) a = Math.min(a, (vmax - v) / dt * 0.5);
    v = Math.max(0.35, v + a * dt); s += v * dt; t += dt;
    w += (-(g / Z.hang) * phi - 1.6 * w - a / Z.hang) * dt; phi += w * dt;
    if (Math.round(t * 120) % 6 === 0) Z.tab.push([t, Math.min(s, Z.len), v, phi]);
  }
  Z.tab.push([t + 0.05, Z.len, 0, 0]); Z.T = t + 0.05;
}
function zipAt(s) {
  const P = ZIP.pts; let lo = 0, hi = P.length - 1; s = clamp(s, 0, ZIP.len);
  while (hi - lo > 1) { const m = (lo + hi) >> 1; if (P[m].s < s) lo = m; else hi = m; }
  const A = P[lo], Bp = P[hi], k = (s - A.s) / Math.max(1e-6, Bp.s - A.s), p = A.p.map((v, i) => v + (Bp.p[i] - v) * k);
  return { p, slope: (Bp.p[1] - A.p[1]) / Math.max(1e-6, Bp.p[2] - A.p[2]) };
}
function zipState(dt) { // dt: detik sejak meluncur
  const T = ZIP.tab; if (dt <= 0) return { s: 0, v: 0, phi: 0 }; if (dt >= ZIP.T) return { s: ZIP.len, v: 0, phi: 0, done: true };
  let lo = 0, hi = T.length - 1; while (hi - lo > 1) { const m = (lo + hi) >> 1; if (T[m][0] < dt) lo = m; else hi = m; }
  const a = T[lo], b = T[hi], k = (dt - a[0]) / Math.max(1e-6, b[0] - a[0]); return { s: a[1] + (b[1] - a[1]) * k, v: a[2] + (b[2] - a[2]) * k, phi: a[3] + (b[3] - a[3]) * k };
}
function buildZip() {
  zipPrep();
  const Z = ZIP, top = Z.y0 - 1.2;
  // menara start: 4 kaki, palang silang, lantai, pagar, atap
  const sx = Z.x, sz = Z.z0 - 0.6;
  for (const ox of [-1.6, 1.6]) for (const oz of [-1.6, 1.6]) SL('cyl', sx + ox, sz + oz, 0.35, top, 0.35, '#8a5a35');
  for (let y = 4; y < top; y += 5) { deco(sx, sz - 1.6, 3.4, 0.15, 0.25, '#a5764a', y); deco(sx, sz + 1.6, 3.4, 0.15, 0.25, '#a5764a', y); deco(sx - 1.6, sz, 0.15, 3.4, 0.25, '#a5764a', y); deco(sx + 1.6, sz, 0.15, 3.4, 0.25, '#a5764a', y); }
  deco(sx, sz, 4.2, 4.2, 0.35, '#c9a36b', top); for (const [ox, oz, w, d] of [[0, -2.05, 4.2, 0.12], [-2.05, 0, 0.12, 4.2], [2.05, 0, 0.12, 4.2]]) deco(sx + ox, sz + oz, w, d, 1.0, '#e8434b', top + 0.35);
  SL('roof', sx, sz, 5, 1.6, 5, '#e8434b', top + 3.4); for (const ox of [-2, 2]) for (const oz of [-2, 2]) SL('cyl', sx + ox, sz + oz, 0.12, 3.1, 0.12, '#8a5a35', top + 0.35);
  for (let k = 0; k < 6; k++) { const m = deco(sx + 2.4, sz - 1.4 + (k % 2) * 2.8, 1.2, 1.4, 0.15, '#a5764a', 2 + k * 4.6); } // tangga (hiasan)
  addSolid(...L(sx, sz), 2, 2, 0, top + 0.4);
  { const sp = sign(`🪂 Flying Fox · 🪙 ${Z.price}`, 4.4, { bg: '#ffd23a' }); const [wx, wz] = L(sx + 3.2, sz); sp.position.set(wx, 3.6, wz); CDYN.add(sp); }
  // panggung akhir di utara: kaki, lantai empuk, tangga turun
  const ex = Z.x, ez = Z.z1 + 0.8, eh = Z.y1 - Z.hang - 0.3;
  for (const ox of [-1.8, 1.8]) for (const oz of [-1.8, 1.8]) SL('cyl', ex + ox, ez + oz, 0.3, eh, 0.3, '#8a5a35');
  deco(ex, ez, 4.4, 4.4, 0.3, '#c9a36b', eh - 0.3); deco(ex, ez + 0.6, 3.6, 2.6, 0.25, '#3a7cf5', eh); SL('cyl', ex, ez + 2.4, 0.3, Z.y1 + 1, 0.3, '#8a5a35');
  for (let k = 0; k < 5; k++) deco(ex + 2.6, ez - 1.6 + k * 0.8, 1.2, 0.8, 0.2, '#a5764a', (eh * k) / 5);
  addSolid(...L(ex, ez), 2.1, 2.1, 0, eh);
  // kabel
  const pts = []; for (let i = 0; i <= 60; i++) { const [x, y, z] = zipCable(i / 60), [wx, wz] = L(x, z); pts.push(new THREE.Vector3(wx, y, wz)); }
  const cable = new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 240, 0.06, 6), K.mat('#2c2f3a')); root.add(cable);
  // katrol + tali pengaman (mengikuti penumpang di perangkat ini)
  const tr = new THREE.Group(); CDYN.add(tr); ZIP.trolley = tr;
  K.box(0.35, 0.3, 0.7, '#ffd23a', 0, -0.12, 0, tr, false); for (const zz of [-0.22, 0.22]) K.box(0.12, 0.26, 0.26, '#2c2f3a', 0, 0.02, zz, tr, false);
  ZIP.strap = new THREE.Group(); tr.add(ZIP.strap); K.box(0.05, Z.hang - 0.5, 0.05, '#e8434b', 0, -(Z.hang - 0.5) / 2 - 0.25, 0, ZIP.strap, false); K.box(0.9, 0.08, 0.08, '#e8434b', 0, -Z.hang + 0.3, 0, ZIP.strap, false);
  const [bx, bz] = L(sx + 3.0, sz + 0.2); SPOTS.zip = { x: bx, z: bz, kind: 'play' };
  const [qx, qz] = L(ex + 3.2, ez - 1.6); ZIP.exit = { x: qx, z: qz, y: 0, name: 'Ujung Flying Fox' };
  place('zip', 'Flying Fox', '🪂', sx + 3, sz, sx + 3, sz + 3);
}
function zipPose(tok, t) {
  const dt = t - tok.t0, run = dt - ZIP.pre, st = zipState(run), q = zipAt(st.s), [lx, ly, lz] = q.p, [wx, wz] = L(lx, lz);
  ZIP.showS = st.s; ZIP.showT = t; ZIP.showPhi = st.phi;
  const sway = Math.sin(t * 1.7) * 0.06 * Math.min(1, st.v / 6), y = ly - ZIP.hang * Math.cos(st.phi), zo = ZIP.hang * Math.sin(st.phi);
  const done = run > ZIP.T + 1.2, kmh = Math.round(st.v * 3.6);
  return { x: wx + Math.sin(sway) * ZIP.hang * 0.3, z: wz + zo, y: y - 0.2, yaw: 0, pitch: st.phi, roll: sway, cam: true, v: st.v, auto: done, exit: done && ZIP.exit,
    info: run < 0 ? `🪂 Siap-siap... ${Math.ceil(-run)}` : st.done ? '🪂 Sampai! Mendarat dengan aman' : `🪂 Wuuush! ${kmh} km/jam · ketinggian ${Math.round(y)} m` };
}
function zipTick(t) {
  const Z = ZIP; if (!Z.trolley) return;
  const s = t - Z.showT < 0.4 ? Z.showS : 0, q = zipAt(s), [wx, wz] = L(q.p[0], q.p[2]);
  Z.trolley.position.set(wx, q.p[1], wz); Z.strap.rotation.x = t - Z.showT < 0.4 ? -(Z.showPhi || 0) : Math.sin(t * 1.2) * 0.05;
}

export { BUS, FERRY, WHEEL, CAROUSEL, TRAIN };
