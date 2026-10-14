// Dunia tambahan Pulau Balok: fisika pijakan, Menara Langit (panjat ala obby), bangunan untuk dijelajahi,
// gunung, kapal yang berlayar, dan warga (NPC) yang bisa diajak ngobrol.
import * as THREE from '../lib/three.module.min.js';

let K = null; // alat dari game.js: scene, box, makeCharacter, dll.
const DYN = new THREE.Group(); DYN.userData.dynamic = true; // benda bergerak/berkedip: tidak ikut digabung
const TD = new THREE.Group(); DYN.add(TD); // bagian bergerak menara: disembunyikan bila jauh (hemat untuk tablet)
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const rand = (a, b) => a + Math.random() * (b - a);
const randi = (a, b) => Math.floor(rand(a, b + 1));
const pick = (a) => a[Math.floor(Math.random() * a.length)];
const shuffle = (a) => { for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
const ease = (k) => k * k * (3 - 2 * k);
const TAU = Math.PI * 2;

/* =========================================================
   FISIKA PIJAKAN: balok (bisa diputar) yang bisa dipijak & ditabrak
   ========================================================= */
export const STEP = 0.55, PR = 0.38, PH = 1.75, GRAV = 24;
export const solids = [];
const movers = [];
// indeks posisi: tiap balok diam dicatat di kotak-kotak 16 m, balok bergerak (kapal, lift) diperiksa terpisah
const GRID = 16, grid = new Map(), movingSolids = [], EMPTY = [];
const cellKey = (i, j) => i * 4099 + j;
function gridAdd(s) {
  const p = s.br + 1.3;
  for (let i = Math.floor((s.cx - p) / GRID); i <= Math.floor((s.cx + p) / GRID); i++) for (let j = Math.floor((s.cz - p) / GRID); j <= Math.floor((s.cz + p) / GRID); j++) {
    const k = cellKey(i, j); if (!grid.has(k)) grid.set(k, []); grid.get(k).push(s);
  }
}
const Q = [EMPTY, movingSolids];
function nearby(x, z) { Q[0] = grid.get(cellKey(Math.floor(x / GRID), Math.floor(z / GRID))) || EMPTY; return Q; }
function addSolid(cx, cz, hx, hz, y0, y1, a = 0, extra = null) {
  const s = { cx, cz, hx, hz, y0, y1, a, ca: Math.cos(a), sa: Math.sin(a), br: Math.hypot(hx, hz), on: true };
  if (extra) Object.assign(s, extra);
  solids.push(s); if (s.moving) movingSolids.push(s); else gridAdd(s);
  return s;
}
function setRot(s, a) { s.a = a; s.ca = Math.cos(a); s.sa = Math.sin(a); }
// koordinat lokal balok (sama dengan rotation.y milik three.js)
function local(s, x, z) { const dx = x - s.cx, dz = z - s.cz; return [dx * s.ca - dz * s.sa, dx * s.sa + dz * s.ca]; }
function world(s, lx, lz) { return [s.cx + lx * s.ca + lz * s.sa, s.cz - lx * s.sa + lz * s.ca]; }
const near = (s, x, z, pad) => Math.abs(x - s.cx) <= s.br + pad && Math.abs(z - s.cz) <= s.br + pad;
function inside(s, x, z, pad = 0) { const [lx, lz] = local(s, x, z); return Math.abs(lx) <= s.hx + pad && Math.abs(lz) <= s.hz + pad; }

// pijakan tertinggi di bawah kaki yang tidak lebih tinggi dari y + STEP (bisa dinaiki tanpa lompat)
export function groundAt(x, z, y, pad = 0.22) {
  let best = -Infinity, bs = null;
  for (const list of nearby(x, z)) for (const s of list) {
    if (!s.on || s.y1 > y + STEP || s.y1 <= best || !near(s, x, z, pad + 0.1)) continue;
    if (inside(s, x, z, pad)) { best = s.y1; bs = s; }
  }
  return { y: best, s: bs };
}
export const WATER_Y = -0.5; // tinggi kaki saat berenang (badan tenggelam sampai dada)
export const SWIM = { x: -86, z: 30, r: 26 }; // laut tempat berenang: sekitar dermaga
export const inSwim = (x, z) => Math.hypot(x - SWIM.x, z - SWIM.z) < SWIM.r;
export const onIsland = (x, z) => Math.hypot(x, z) < K.edgeR(x, z) - 0.6;
const baseGround = (x, z) => (onIsland(x, z) ? 0 : inSwim(x, z) ? WATER_Y : -4);
// apakah ada balok yang menopang (untuk dermaga & kapal di luar batas pulau)
export function supported(x, z, y) { const g = groundAt(x, z, y); return g.s !== null && y - g.y < 2.5; }
// bantu lompat: ada tepian di depan yang lebih tinggi dari langkah kaki tapi masih bisa dilompati
export function ledgeAhead(x, z, y, dx, dz) {
  for (const k of [0.5, 0.8]) {
    const g = groundAt(x + dx * k, z + dz * k, y + 0.75, 0);
    if (g.s && g.y > y + STEP - 0.02 && g.y <= y + 1.25) return g.y;
  }
  return null;
}
// dinding: dorong tubuh (lingkaran) keluar dari balok yang lebih tinggi dari langkah kaki
export function pushOut(p, y, r = PR, h = PH) {
  let hit = false; const [cell, mov] = nearby(p.x, p.z);
  for (const list of [cell, mov]) for (const s of list) {
    if (!s.on || s.y1 <= y + STEP || s.y0 >= y + h || !near(s, p.x, p.z, r + 0.1)) continue;
    let [lx, lz] = local(s, p.x, p.z);
    const qx = clamp(lx, -s.hx, s.hx), qz = clamp(lz, -s.hz, s.hz);
    const nx = lx - qx, nz = lz - qz, d = Math.hypot(nx, nz);
    if (d >= r) continue;
    if (d > 1e-5) { lx = qx + (nx / d) * r; lz = qz + (nz / d) * r; }
    else if (s.hx - Math.abs(lx) < s.hz - Math.abs(lz)) lx = Math.sign(lx || 1) * (s.hx + r);
    else lz = Math.sign(lz || 1) * (s.hz + r);
    [p.x, p.z] = world(s, lx, lz); hit = true;
  }
  return hit;
}
function ceilingAt(x, z, from, to) {
  let c = null;
  for (const list of nearby(x, z)) for (const s of list) {
    if (!s.on || s.y0 < from - 0.05 || s.y0 > to || !near(s, x, z, PR)) continue;
    if (inside(s, x, z, PR * 0.4) && (c === null || s.y0 < c)) c = s.y0;
  }
  return c;
}
// gerak naik-turun tubuh {pos, y, vy, onGround, standOn, peak}; hasil {fall, s} saat mendarat
export function stepVertical(b, dt) {
  const base = baseGround(b.pos.x, b.pos.z);
  const g = groundAt(b.pos.x, b.pos.z, b.y);
  const gy = Math.max(g.y, base), gs = g.y >= base ? g.s : null;
  if (b.vy <= 0 && b.y - gy <= (b.onGround ? STEP + 0.05 : 0.001)) {
    // berdiri: menempel ke tanah/tangga (naik & turun anak tangga tanpa melayang)
    const ev = b.onGround ? null : { fall: b.peak - gy, s: gs };
    b.y = gy; b.vy = 0; b.onGround = true; b.standOn = gs; b.coyote = 0.12; b.peak = gy;
    return ev;
  }
  if (b.onGround) { b.onGround = false; b.peak = b.y; }
  b.coyote = Math.max(0, (b.coyote || 0) - dt); b.standOn = null;
  const oy = b.y; b.vy = Math.max(b.vy - GRAV * dt, -32); b.y += b.vy * dt;
  if (b.vy > 0) { const c = ceilingAt(b.pos.x, b.pos.z, oy + PH, b.y + PH); if (c !== null) { b.y = c - PH; b.vy = 0; } }
  b.peak = Math.max(b.peak, b.y);
  if (b.vy <= 0) {
    const g2 = groundAt(b.pos.x, b.pos.z, oy); const gy2 = Math.max(g2.y, base);
    if (b.y <= gy2) {
      const ev = { fall: b.peak - gy2, s: g2.y >= base ? g2.s : null };
      b.y = gy2; b.vy = 0; b.onGround = true; b.standOn = ev.s; b.coyote = 0.12; b.peak = gy2;
      return ev;
    }
  }
  return null;
}
// pijakan bergerak (lift, pijakan naik-turun, kapal): ikut membawa pemain yang berdiri di atasnya
let clockT = 0;
export function updateMovers(dt, b, speed = 1) {
  clockT += dt * speed;
  for (const m of movers) { for (const s of m.parts) { s.pcx = s.cx; s.pcz = s.cz; s.pa = s.a; s.py1 = s.y1; } m.fn(clockT, dt); }
  const s = b.onGround ? b.standOn : null;
  if (s && s.moving) {
    const dx = b.pos.x - s.pcx, dz = b.pos.z - s.pcz, c = Math.cos(s.pa), sn = Math.sin(s.pa);
    [b.pos.x, b.pos.z] = world(s, dx * c - dz * sn, dx * sn + dz * c);
    b.y += s.y1 - s.py1; b.facing += s.a - s.pa;
  }
  // pijakan naik dari bawah: angkat tubuh ke atasnya (tidak terjepit)
  for (const m of movers) for (const q of m.parts) {
    if (q.on && q.lift && b.y < q.y1 && b.y + PH > q.y0 && q.y1 - b.y < 1.2 && inside(q, b.pos.x, b.pos.z)) { b.y = q.y1; b.vy = Math.max(0, b.vy); }
  }
}

/* =========================================================
   ALAT MEMBANGUN
   ========================================================= */
// gabungkan balok dalam satu grup menjadi InstancedMesh (grup tetap bisa disembunyikan)
function batchGroup(root) {
  root.updateMatrixWorld(true);
  const inv = root.matrixWorld.clone().invert(); const groups = new Map(); const rm = [];
  root.traverse((o) => {
    if (!o.isMesh || o.isInstancedMesh || o.geometry !== K.BOX || Array.isArray(o.material) || o.material.map || o.material.transparent) return;
    const key = o.material.uuid + (o.castShadow ? ':s' : '');
    if (!groups.has(key)) groups.set(key, { mat: o.material, cast: o.castShadow, list: [] });
    groups.get(key).list.push(new THREE.Matrix4().multiplyMatrices(inv, o.matrixWorld)); rm.push(o);
  });
  for (const o of rm) o.parent.remove(o);
  for (const g of groups.values()) {
    const im = new THREE.InstancedMesh(K.BOX, g.mat, g.list.length);
    g.list.forEach((m, i) => im.setMatrixAt(i, m));
    im.castShadow = g.cast; im.receiveShadow = true; im.computeBoundingSphere(); root.add(im);
  }
}
function textTex(text, { bg = '#fff6df', fg = '#1d2b53', w = 512, h = 128, border = true } = {}) {
  return K.canvasTex(w, h, (q) => {
    if (bg) { q.fillStyle = bg; K.rrect(q, 6, 6, w - 12, h - 12, h * 0.3); q.fill(); if (border) { q.lineWidth = 8; q.strokeStyle = fg; q.stroke(); } }
    let fs = Math.round(h * 0.52); q.font = `800 ${fs}px ${K.FONT}`;
    while (q.measureText(text).width > w - 44 && fs > 12) { fs -= 2; q.font = `800 ${fs}px ${K.FONT}`; }
    q.fillStyle = fg; q.textAlign = 'center'; q.textBaseline = 'middle'; q.fillText(text, w / 2, h / 2 + 4);
  });
}
function sign(text, width = 4, opt = {}) {
  const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: textTex(text, opt), transparent: true }));
  sp.scale.set(width, width / 4, 1); return sp;
}
// papan datar (menempel di dinding), mis. papan tulis & menu
function board(w, h, draw, pw = 512, ph = 256) {
  const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshLambertMaterial({ map: K.canvasTex(pw, ph, draw) }));
  return m;
}
// bingkai bangunan: koordinat lokal (depan = +z menghadap tengah pulau) diubah ke dunia
function frame(x, z, yaw = 0) {
  const g = new THREE.Group(); g.position.set(x, 0, z); g.rotation.y = yaw; K.scene.add(g);
  const f = { g, cx: x, cz: z, a: yaw, ca: Math.cos(yaw), sa: Math.sin(yaw) };
  f.W = (lx, lz) => world(f, lx, lz);
  // balok padat: terlihat (bila diberi warna) + bisa dipijak/ditabrak
  f.solid = (lx, lz, w, d, y0, h, color, parent = g, extra = null) => {
    const m = color ? K.box(w, h, d, color, lx, y0 + h / 2, lz, parent) : null;
    const [wx, wz] = f.W(lx, lz); const s = addSolid(wx, wz, w / 2, d / 2, y0, y0 + h, yaw, extra); s.mesh = m; return s;
  };
  f.deco = (lx, lz, w, d, y0, h, color, parent = g, shadow = true) => K.box(w, h, d, color, lx, y0 + h / 2, lz, parent, shadow);
  f.level = (base) => { const lv = new THREE.Group(); lv.userData.base = base; lv.userData.dynamic = true; g.add(lv); return lv; };
  // dinding sepanjang sumbu x (di z tetap) dengan lubang pintu [tengah, lebar, tinggi]
  f.wallX = (x0, x1, lz, y0, h, color, parent = g, doors = [], t = 0.3) => {
    let cur = x0;
    for (const [c, w, dh] of [...doors].sort((p, q) => p[0] - q[0])) {
      const a = c - w / 2, b = c + w / 2;
      if (a > cur + 0.01) f.solid((cur + a) / 2, lz, a - cur, t, y0, h, color, parent);
      if (dh < h) f.solid(c, lz, w, t, y0 + dh, h - dh, color, parent);
      cur = b;
    }
    if (x1 > cur + 0.01) f.solid((cur + x1) / 2, lz, x1 - cur, t, y0, h, color, parent);
  };
  f.wallZ = (z0, z1, lx, y0, h, color, parent = g, doors = [], t = 0.3) => {
    let cur = z0;
    for (const [c, w, dh] of [...doors].sort((p, q) => p[0] - q[0])) {
      const a = c - w / 2, b = c + w / 2;
      if (a > cur + 0.01) f.solid(lx, (cur + a) / 2, t, a - cur, y0, h, color, parent);
      if (dh < h) f.solid(lx, c, t, w, y0 + dh, h - dh, color, parent);
      cur = b;
    }
    if (z1 > cur + 0.01) f.solid(lx, (cur + z1) / 2, t, z1 - cur, y0, h, color, parent);
  };
  // jendela: kaca sedikit lebih tebal dari dinding supaya terlihat dari dua sisi
  f.winX = (lx, lz, w, y0, h, parent = g) => { f.deco(lx, lz, w, 0.38, y0, h, '#bfe6ff', parent, false); f.deco(lx, lz, w + 0.16, 0.4, y0 - 0.08, 0.08, '#ffffff', parent, false); f.deco(lx, lz, 0.08, 0.4, y0, h, '#ffffff', parent, false); };
  f.winZ = (lx, lz, w, y0, h, parent = g) => { f.deco(lx, lz, 0.38, w, y0, h, '#bfe6ff', parent, false); f.deco(lx, lz, 0.4, w + 0.16, y0 - 0.08, 0.08, '#ffffff', parent, false); f.deco(lx, lz, 0.4, 0.08, y0, h, '#ffffff', parent, false); };
  f.put = (obj, lx, y, lz, parent = g) => { obj.position.set(lx, y, lz); parent.add(obj); return obj; };
  return f;
}
// bangunan yang atap/lantai atasnya disembunyikan saat pemain di dalam (supaya kamera bisa melihat)
const hideables = [];
function hideable(f, hx, hz, levels, top) { hideables.push({ cx: f.cx, cz: f.cz, a: f.a, ca: f.ca, sa: f.sa, hx, hz, levels, top, inn: false, py: 0 }); for (const lv of levels) batchGroup(lv); }
export function updateHide(px, py, pz) {
  for (const h of hideables) {
    const [lx, lz] = local(h, px, pz);
    const inn = Math.abs(lx) < h.hx + 0.3 && Math.abs(lz) < h.hz + 0.3 && py < h.top - 0.5;
    if (inn === h.inn && (!inn || Math.abs(py - h.py) < 0.4)) continue;
    h.inn = inn; h.py = py;
    for (const lv of h.levels) lv.visible = !inn || lv.userData.base <= py + 1.4;
  }
}
// tangga tipis (anak tangga 0.45) supaya bisa ditumpuk antarlantai tanpa membentur kepala
function stairs(f, lx, z0, dir, n, base, parent, w = 1.6, rise = 0.45, run = 0.9, color = '#c9b48a') {
  for (let i = 0; i < n; i++) f.solid(lx, z0 + dir * (run * i + run / 2), w, run, base + rise * i, rise, i % 2 ? color : '#bba57a', parent);
}

/* =========================================================
   TEMPAT-TEMPAT (dipakai juga oleh peta & game.js)
   ========================================================= */
const polar = (deg, r) => [Math.cos((deg * Math.PI) / 180) * r, Math.sin((deg * Math.PI) / 180) * r];
export const TOWER = { x: -79.5, z: 0, ring: 11, half: 6, H: 8, N: 20, fence: 14.5 };
export const PLACES = {
  menara: { name: 'Menara Langit', emoji: '🗼', x: TOWER.x, z: TOWER.z, r: 15.5, go: [TOWER.x + 17.5, TOWER.z] },
  sekolah: { name: 'Sekolah', emoji: '🏫', pos: polar(30, 49.5), r: 9 },
  kantin: { name: 'Kantin', emoji: '🍜', pos: polar(150, 49.5), r: 8.5 },
  gedung: { name: 'Gedung Tinggi', emoji: '🏢', pos: polar(210, 49.5), r: 8.5 },
  rumah: { name: 'Rumah Nenek', emoji: '🏡', pos: polar(330, 49.5), r: 12 },
  gunung: { name: 'Gunung', emoji: '⛰️', x: 38, z: -68, r: 16 },
  trampolin: { name: 'Trampolin Raksasa', emoji: '🤸', pos: polar(270, 49.5), r: 12 },
  kapal: { name: 'Kapal', emoji: '⛵', x: -86, z: 30, r: 5 },
};
for (const p of Object.values(PLACES)) if (p.pos) { p.x = p.pos[0]; p.z = p.pos[1]; }
// titik datang (di depan pintu, menghadap bangunan)
for (const [id, p] of Object.entries(PLACES)) {
  if (p.go) continue;
  const d = Math.hypot(p.x, p.z) || 1; const k = id === 'gunung' ? 15 : id === 'kapal' ? -1 : p.r + 1.5;
  p.go = id === 'kapal' ? [p.x * 0.985, p.z * 0.985] : [p.x - (p.x / d) * k, p.z - (p.z / d) * k];
}
const faceCenter = (x, z) => Math.atan2(-x, -z);

/* =========================================================
   MENARA LANGIT: panjat seperti obby Roblox
   ========================================================= */
// s = rangkaian anak tangga (cukup berjalan, tanpa lompat)
// b:jenis:level = jembatan dengan rintangan yang baru muncul mulai level itu (b:none = jembatan biasa, tanpa rintangan)
const HAZ_A = ['none:1', 'worm:2', 'none:1', 'spin:3'];
const HAZ_B = ['spin:3', 'none:1', 'piston:4', 'worm:2', 'none:1'];
const SECTIONS = Array.from({ length: TOWER.N }, (_, k) => ['s', `b:${k < 2 ? 'none:1' : HAZ_A[k % 4]}`, 's', `b:${k < 1 ? 'none:1' : HAZ_B[k % 5]}`, 's']);
// warna pelangi per lantai (merah, jingga, kuning, hijau, biru, nila, ungu), diulang sampai puncak
const SEC_COL = ['#ff6b6b', '#ffa94d', '#ffe066', '#69db7c', '#4dabf7', '#748ffc', '#b197fc'];
const secCol = (k) => SEC_COL[k % SEC_COL.length];
const STEPS = 13, BR_LEN = 5.2, PW = 3.0, BW = 3.2; // anak tangga per bagian, panjang & lebar jembatan
export const hazards = [];
export const tower = { gate: null, floors: [], down: null, level: 0 };
let blinkStill = null; const floorDecor = [];
// tema kuis tiap lantai (berulang); makin tinggi lantainya, angkanya makin besar
const FLOOR_THEMES = [
  { name: 'Berhitung', e: '🔢', items: ['🍎', '🍌', '🍊'], quiz(api, L) { const [e, nm] = pick([['🍎', 'apel'], ['⭐', 'bintang'], ['🐥', 'anak ayam'], ['🎈', 'balon']]); const n = randi(2, Math.min(10, 3 + Math.floor(L / 2))), o = numChoices(n); api.ask(`Ada berapa ${nm}? ${e.repeat(n)}`, o.map(String), o.indexOf(n), `Betul! Ada ${n} ${nm}.`, `Hampir! Coba hitung lagi pelan-pelan. Ada ${n} ${nm}.`); } },
  { name: 'Huruf', e: '🔤', items: ['🅰️', '🅱️', '🔤'], quiz(api) { const [w, Lt, e] = pick(QUIZ_WORDS); const o = shuffle([Lt, ...shuffle(QUIZ_WORDS.map((q) => q[1]).filter((x) => x !== Lt)).slice(0, 2)]); api.ask(`${e} ${w}. Huruf depannya apa?`, o, o.indexOf(Lt), `Hebat! ${w} dimulai dengan huruf ${Lt}.`, `Belum tepat. ${w} dimulai dengan huruf ${Lt}.`); } },
  { name: 'Warna', e: '🎨', items: ['🖍️', '🎨', '🌈'], quiz(api) { const C = [['🍌', 'kuning'], ['🍓', 'merah'], ['🥦', 'hijau'], ['🍇', 'ungu'], ['🍊', 'oranye'], ['🐳', 'biru']]; const [e, c] = pick(C); const o = shuffle([c, ...shuffle(C.map((q) => q[1]).filter((x) => x !== c)).slice(0, 2)]); api.ask(`${e} Ini warnanya apa?`, o, o.indexOf(c), `Pintar! Warnanya ${c}.`, `Belum tepat. Warnanya ${c}.`); } },
  { name: 'Bentuk', e: '🔺', items: ['🔺', '⚪', '🟦'], quiz(api) { const S = [['bulat', '⚽'], ['segitiga', '🔺'], ['kotak', '🟦'], ['bintang', '⭐'], ['hati', '❤️']]; const [nm, e] = pick(S); const o = shuffle([e, ...shuffle(S.map((q) => q[1]).filter((x) => x !== e)).slice(0, 2)]); api.ask(`Mana yang bentuknya ${nm}?`, o, o.indexOf(e), `Betul! Itu bentuk ${nm}.`, `Belum tepat. Yang ${nm} itu ${e}.`); } },
  { name: 'Hewan', e: '🐘', items: ['🐘', '🐄', '🐔'], quiz(api) { const A = [['Kukuruyuk!', '🐓'], ['Meong!', '🐱'], ['Guk guk!', '🐶'], ['Mooo!', '🐄'], ['Mbeek!', '🐐'], ['Kwek kwek!', '🦆']]; const [v, e] = pick(A); const o = shuffle([e, ...shuffle(A.map((q) => q[1]).filter((x) => x !== e)).slice(0, 2)]); api.ask(`Siapa yang bersuara "${v}"?`, o, o.indexOf(e), 'Betul sekali! Kamu kenal suara hewan.', `Belum tepat. Yang bersuara ${v} itu ${e}.`); } },
  { name: 'Buah', e: '🍉', items: ['🍉', '🍍', '🍇'], quiz(api) { const F = [['🍉', 'semangka'], ['🍌', 'pisang'], ['🍎', 'apel'], ['🍇', 'anggur'], ['🍍', 'nanas'], ['🍓', 'stroberi']]; const [e, nm] = pick(F); const o = shuffle([nm, ...shuffle(F.map((q) => q[1]).filter((x) => x !== nm)).slice(0, 2)]); api.ask(`${e} Ini buah apa?`, o, o.indexOf(nm), `Betul! Itu buah ${nm}.`, `Belum tepat. Itu buah ${nm}.`); } },
  { name: 'Tambah', e: '➕', items: ['➕', '🍬', '🍬'], quiz(api, L) { const mx = Math.min(10, 4 + Math.floor(L / 2)); const a = randi(1, mx - 1), b = randi(1, mx - a), n = a + b, o = numChoices(n); api.ask(`${a} tambah ${b}, berapa hayo?`, o.map(String), o.indexOf(n), `Pintar! ${a} tambah ${b} sama dengan ${n}.`, `Hampir! ${a} tambah ${b} itu ${n}. Coba pakai jari, ya.`); } },
  { name: 'Kurang', e: '➖', items: ['➖', '🍪', '🍪'], quiz(api, L) { const a = randi(2, Math.min(10, 4 + Math.floor(L / 2))), b = randi(1, a - 1), n = a - b, o = numChoices(n, 0); api.ask(`Ada ${a} kue, dimakan ${b}. Sisa berapa? ${'🍪'.repeat(a)}`, o.map(String), o.indexOf(n), `Betul! Sisanya ${n} kue.`, `Hampir! ${a} kurang ${b} itu ${n}.`); } },
  { name: 'Besar-Kecil', e: '📏', items: ['🐘', '🐭', '📏'], quiz(api) { const Z = [['🐘', 6], ['🦒', 5], ['🐄', 4], ['🐕', 3], ['🐈', 2], ['🐭', 1]]; const o = shuffle(shuffle([...Z]).slice(0, 3)); const big = Math.random() < 0.5; const ans = o.reduce((p, q) => ((big ? q[1] > p[1] : q[1] < p[1]) ? q : p)); api.ask(`Mana yang paling ${big ? 'besar' : 'kecil'}?`, o.map((q) => q[0]), o.indexOf(ans), `Betul! ${ans[0]} paling ${big ? 'besar' : 'kecil'}.`, `Belum tepat. Yang paling ${big ? 'besar' : 'kecil'} itu ${ans[0]}.`); } },
  { name: 'Urutan Angka', e: '🔟', items: ['1️⃣', '2️⃣', '3️⃣'], quiz(api, L) { const a = randi(1, Math.min(19, 3 + L)), n = a + 1, o = numChoices(n); api.ask(`Setelah angka ${a}, angka berapa?`, o.map(String), o.indexOf(n), `Hebat! Setelah ${a} adalah ${n}.`, `Belum tepat. Setelah ${a} adalah ${n}.`); } },
];
const rails = { inner: [], outer: [], gIn: null, gOut: null };

function buildTower() {
  const { x: TX, z: TZ, ring: RR, half, H, N } = TOWER;
  const root = new THREE.Group(); K.scene.add(root);
  const P = (a, r = RR) => [TX + Math.cos(a) * r, TZ + Math.sin(a) * r];
  // pijakan searah lingkaran (sumbu x lokal = arah garis singgung)
  const plat = (a, len, wid, top, th, color, parent = root, r = RR) => {
    const [x, z] = P(a, r); const yaw = -a - Math.PI / 2;
    const m = K.box(len, th, wid, color, x, top - th / 2, z, parent); m.rotation.y = yaw;
    const s = addSolid(x, z, len / 2, wid / 2, top - th, top, yaw); s.mesh = m; return s;
  };
  // pijakan searah jari-jari (penghubung lantai aman ke jalur)
  const radial = (a, r0, r1, wid, top, th, color) => {
    const [x, z] = P(a, (r0 + r1) / 2); const yaw = -a;
    const m = K.box(r1 - r0, th, wid, color, x, top - th / 2, z, root); m.rotation.y = yaw;
    return addSolid(x, z, (r1 - r0) / 2, wid / 2, top - th, top, yaw);
  };
  // lantai (diam-diam jadi titik simpan) + penghubung; tiap lantai ada stan dengan penjaga & kuis
  for (let L = 0; L <= N; L++) {
    const y = L === 0 ? 0.25 : L * H, hf = L === N ? 7 : half, top = L === N;
    const col = top ? '#ffd23a' : L === 0 ? '#d9cba8' : '#eef8ef';
    K.box(hf * 2, 0.6, hf * 2, col, TX, y - 0.3, TZ, root); addSolid(TX, TZ, hf, hf, y - 0.6, y);
    const ca = L % 2 === 0 ? 0 : Math.PI;
    const conn = radial(ca, hf - 0.5, RR + 1.8, 3.2, y, 0.6, top ? '#ffd23a' : '#d9cba8');
    if (L > 0) {
      // pagar supaya tidak jatuh dari lantai
      const rail = (x0, z0, x1, z1) => {
        const cx = (x0 + x1) / 2, cz = (z0 + z1) / 2, horiz = Math.abs(z1 - z0) < 1e-6, len = horiz ? Math.abs(x1 - x0) : Math.abs(z1 - z0);
        const w = horiz ? len : 0.22, d = horiz ? 0.22 : len;
        K.box(w, 0.12, d, '#ffffff', TX + cx, y + 0.95, TZ + cz, root); addSolid(TX + cx, TZ + cz, w / 2, d / 2, y, y + 2.3);
        for (let k = 0; k <= Math.round(len / 2); k++) { const t = k / Math.max(1, Math.round(len / 2)); K.box(0.16, 0.95, 0.16, '#ffffff', TX + x0 + (x1 - x0) * t, y + 0.47, TZ + z0 + (z1 - z0) * t, root, false); }
      };
      if (top) { rail(-hf, -hf, -1.3, -hf); rail(1.3, -hf, hf, -hf); } else rail(-hf, -hf, hf, -hf);
      rail(-hf, hf, hf, hf);
      const gx = ca === 0 ? hf : -hf, ox = -gx;
      if (top) { rail(ox, -hf, ox, -1.3); rail(ox, 1.3, ox, hf); } else rail(ox, -hf, ox, hf);
      rail(gx, -hf, gx, -1.7); rail(gx, 1.7, gx, hf);
      if (top) { // papan terjun payung: berjalan sampai ujung, lalu lompat!
        const pa = ca + Math.PI, [px, pz] = P(pa, hf + 4.5); const yaw = -pa;
        for (let i = 0; i < 9; i++) { const [bx, bz] = P(pa, hf + 0.5 + i); const m = K.box(1, 0.4, 2.4, i % 2 ? '#ffffff' : '#e8434b', bx, y - 0.2, bz, root); m.rotation.y = yaw; }
        addSolid(px, pz, 4.5, 1.2, y - 0.4, y, yaw);
        const sp2 = sign('🪂 Terjun Payung', 3.4, { bg: '#d8f0ff' }); const [qx, qz] = P(pa, hf + 2); sp2.position.set(qx, y + 3, qz); TD.add(sp2);
        tower.jumpOff = { x: px, z: pz, y };
      }
      if (top) { const sp = sign('🏆 PUNCAK MENARA', 4.4, { bg: '#ffd23a' }); sp.position.set(TX - (ca === 0 ? 2 : -2), y + 3.4, TZ); TD.add(sp); }
      else floorStall(L, y);
    }
    tower.floors.push({ L, y, half: hf, conn });
  }
  function floorStall(L, y) {
    const th = FLOOR_THEMES[(L - 1) % FLOOR_THEMES.length], col = secCol(L - 1);
    const fg = new THREE.Group(); TD.add(fg); floorDecor.push({ g: fg, y });
    // stan: meja, tiang & atap bergaris
    K.box(5, 1.0, 0.8, col, TX, y + 0.5, TZ - 3.6, root); addSolid(TX, TZ - 3.6, 2.5, 0.4, y, y + 1.0);
    K.box(5.2, 0.08, 1.0, '#ffffff', TX, y + 1.04, TZ - 3.6, root, false);
    for (const sx of [-2.6, 2.6]) K.box(0.16, 2.8, 0.16, '#8a5a35', TX + sx, y + 1.4, TZ - 5.4, root, false);
    for (let i = 0; i < 6; i++) K.box(0.95, 0.18, 2.2, i % 2 ? '#ffffff' : col, TX - 2.4 + i * 0.95, y + 2.85, TZ - 4.4, root, false);
    const sp = sign(`🏢 Lantai ${L} · ${th.e} ${th.name}`, 5, { bg: '#ffffff' }); sp.position.set(TX, y + 3.6, TZ - 4.2); fg.add(sp);
    th.items.forEach((e, i) => { const it = K.emojiSprite(e, 0.6); it.position.set(TX - 1.6 + i * 1.6, y + 1.45, TZ - 3.6); fg.add(it); });
    // bangku, tanaman, karpet supaya lantai tidak kosong
    K.box(2.4, 0.45, 0.7, '#a5764a', TX - 2, y + 0.22, TZ + 4.5, root); addSolid(TX - 2, TZ + 4.5, 1.2, 0.35, y, y + 0.45);
    K.box(3.4, 0.03, 2.4, pick(['#ffd9a0', '#c9e8ff', '#ffd1e0', '#d7f5c9']), TX + 1.5, y + 0.02, TZ + 1.5, root, false);
    for (const [px, pz] of [[4.2, 4.2], [-4.2, -2.6], [4.2, -2.6]]) {
      K.box(0.7, 0.6, 0.7, '#b5523b', TX + px, y + 0.3, TZ + pz, root); K.box(0.95, 0.9, 0.95, '#3fae4f', TX + px, y + 1.05, TZ + pz, root);
      addSolid(TX + px, TZ + pz, 0.35, 0.35, y, y + 1.5);
    }
    const names = ['Kak Ani', 'Kak Beni', 'Kak Caca', 'Kak Doni', 'Kak Eka', 'Kak Fani', 'Kak Gita', 'Kak Hadi', 'Kak Ira', 'Kak Joni', 'Kak Kiki', 'Kak Lala', 'Kak Miko', 'Kak Nina', 'Kak Oki', 'Kak Putri', 'Kak Rio', 'Kak Salsa', 'Kak Tara'];
    const name = names[(L - 1) % names.length], girl = (L % 2) === 1;
    addNpc({ id: `lantai${L}`, name, role: `Penjaga Lantai ${L}`, x: [TX, TZ - 4.7], y, face: 0, girl, shirt: col, pants: pick(['#2c2f3a', '#3b4a6b', '#5b3b22']), pitch: girl ? 0.15 : -0.15,
      talk: (api) => th.quiz(api, L) });
  }
  // tiang-tiang menara + puncak bercahaya
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
    const x = TX + sx * (half - 0.6), z = TZ + sz * (half - 0.6);
    for (let k = 0; k < N; k++) K.box(0.9, H - 0.6, 0.9, secCol(k), x, k * H + H / 2, z, root);
    addSolid(x, z, 0.45, 0.45, 0, N * H);
  }
  {
    const y = N * H; // piala & bendera di puncak
    K.box(1.6, 0.5, 1.6, '#b98a1e', TX - 3, y + 0.25, TZ - 3, root); K.box(0.5, 1.0, 0.5, '#ffd23a', TX - 3, y + 1.0, TZ - 3, root);
    K.box(1.4, 1.2, 1.4, '#ffd23a', TX - 3, y + 2.1, TZ - 3, root); K.box(0.3, 0.6, 0.3, '#ffd23a', TX - 3.85, y + 2.2, TZ - 3, root); K.box(0.3, 0.6, 0.3, '#ffd23a', TX - 2.15, y + 2.2, TZ - 3, root);
    addSolid(TX - 3, TZ - 3, 0.8, 0.8, y, y + 2.7);
    K.box(0.2, 6, 0.2, '#8a5a35', TX + 4.5, y + 3, TZ - 4.5, root);
    const flag = K.box(2.2, 1.3, 0.1, '#e8434b', TX + 5.6, y + 5.3, TZ - 4.5, TD); K.animated.push({ obj: flag, fn: (t) => (flag.scale.x = 2.2 * (1 + Math.sin(t * 5) * 0.06)) });
    const lightM = new THREE.MeshBasicMaterial({ color: '#fff3a0' }); const light = new THREE.Mesh(K.BOX, lightM); light.scale.setScalar(0.9); light.position.set(TX + 4.5, y + 6.4, TZ - 4.5); TD.add(light);
    K.animated.push({ obj: light, fn: (t) => light.material.color.setHSL((t * 0.1) % 1, 0.9, 0.7) });
    // bantalan turun: kembali ke bawah dengan cepat
    const pad = new THREE.Mesh(new THREE.TorusGeometry(1.0, 0.18, 8, 28), new THREE.MeshBasicMaterial({ color: '#7cc8f5' }));
    pad.rotation.x = -Math.PI / 2; pad.position.set(TX - 3.5, y + 0.12, TZ + 3.5); TD.add(pad);
    K.animated.push({ obj: pad, fn: (t) => { pad.scale.setScalar(1 + Math.sin(t * 4) * 0.08); } });
    const sp = sign('⬇️ Turun', 2.6, { bg: '#d8f0ff' }); sp.position.set(TX - 3.5, y + 2.2, TZ + 3.5); TD.add(sp);
    tower.down = { x: TX - 3.5, z: TZ + 3.5, y };
  }
  // jalur memutar antar-lantai: anak tangga (naik 0.5 m, bisa dijalani) diselingi jembatan berintangan
  rails.gIn = new THREE.Group(); rails.gOut = new THREE.Group(); TD.add(rails.gIn, rails.gOut);
  blinkStill = new THREE.Group(); blinkStill.userData.dynamic = true; K.scene.add(blinkStill);
  const rail = (a, len, w, y, side) => {
    const r = RR + side * (w / 2 - 0.08), [x, z] = P(a, r), yaw = -a - Math.PI / 2, g = side < 0 ? rails.gIn : rails.gOut;
    for (const h of [0.45, 0.9]) { const m = K.box(len, 0.1, 0.12, '#ffffff', x, y + h, z, g, false); m.rotation.y = yaw; }
    (side < 0 ? rails.inner : rails.outer).push(addSolid(x, z, len / 2, 0.08, y, y + 2.0, yaw));
  };
  SECTIONS.forEach((items, k) => {
    const a0 = k * Math.PI, base = k === 0 ? 0.25 : k * H, topY = (k + 1) * H, col = secCol(k);
    const nBr = items.filter((it) => it[0] === 'b').length, runs = items.filter((it) => it === 's').length;
    const avail = Math.PI * RR - 3.2, stepLen = (avail - nBr * BR_LEN) / STEPS;
    const rise = (topY - base) / (STEPS + nBr + 1);
    const per = Array.from({ length: runs }, (_, i) => Math.floor(STEPS / runs) + (i < STEPS % runs ? 1 : 0));
    let y = base, s = 1.6, run = 0, j = 0;
    for (const it of items) {
      if (it === 's') {
        for (let q = 0; q < per[run]; q++, j++) {
          y += rise; const a = a0 + (s + stepLen / 2) / RR; s += stepLen;
          // sebagian anak tangga berkedip (hilang-timbul) di level 3 & 4
          const blinkLv = k % 2 === 0 ? 0 : j % 6 === 3 ? 3 : j % 6 === 5 ? 4 : 0;
          stepEl(a, stepLen + 0.06, y, col, blinkLv, k * 1.7 + j * 1.3);
          rail(a, stepLen + 0.06, PW, y, -1); rail(a, stepLen + 0.06, PW, y, 1);
        }
        run++;
      } else {
        y += rise; const a = a0 + (s + BR_LEN / 2) / RR; s += BR_LEN;
        const [, kind, lv] = it.split(':');
        element(kind, +lv, a, y, col, k, j);
        rail(a, BR_LEN, BW, y, -1); rail(a, BR_LEN, BW, y, 1);
      }
    }
  });
  batchGroup(rails.gIn); batchGroup(rails.gOut); batchGroup(blinkStill);
  function stepEl(a, len, y, col, blinkLv, off) {
    if (!blinkLv) { plat(a, len, PW, y, 0.5, col); return; }
    // anak tangga berkedip: saat level rendah tampil sebagai anak tangga biasa (digabung, hemat)
    const [x, z] = P(a); const still = K.box(len, 0.5, PW, col, x, y - 0.25, z, blinkStill, false); still.rotation.y = -a - Math.PI / 2;
    const s = plat(a, len, PW, y, 0.5, K.mat(col), TD);
    hazards.push({ lv: blinkLv, y, vis: s.mesh, update(t) {
      const p = (t + off) % 6; s.on = p < 4.6;
      s.mesh.visible = p < 3.6 || (p < 4.6 && Math.floor(p * 6) % 2 === 0);
      s.mesh.material = p < 3.6 ? K.mat(col) : K.mat('#ff5a5f');
    }, reset() { s.on = true; s.mesh.material = K.mat(col); } });
  }
  function element(kind, lv, a, y, col, k, i) {
    const [cx, cz] = P(a); const tx = -Math.sin(a), tz = Math.cos(a), rx = Math.cos(a), rz = Math.sin(a);
    const off = k * 1.7 + i * 1.1;
    const nh = hazards.length;
    plat(a, BR_LEN, BW, y, 0.6, col);
    if (kind === 'spin') {
      const piv = new THREE.Group(); piv.position.set(cx, y, cz); TD.add(piv); piv.userData.vis = true;
      K.box(0.5, 1.1, 0.5, '#2c2f3a', 0, 0.55, 0, piv); const post = addSolid(cx, cz, 0.25, 0.25, y, y + 1.1);
      const bar = new THREE.Group(); piv.add(bar);
      for (let j = -2; j <= 2; j++) if (j) K.box(0.62, 0.32, 0.32, j % 2 ? '#e8434b' : '#ffffff', j * 0.62, 0.45, 0, bar);
      batchGroup(bar);
      hazards.push({ x: cx, z: cz, y, vis: piv, post, update(t) { bar.rotation.y = t * 1.6 + off; }, hit(px, py, pz) {
        if (py > y + 0.62 || py < y - 0.8) return null;
        const r = bar.rotation.y, ux = Math.cos(r), uz = -Math.sin(r), dx = px - cx, dz = pz - cz;
        const al = dx * ux + dz * uz, pe = dx * uz - dz * ux;
        if (Math.abs(al) > 1.95 || Math.abs(al) < 0.2 || Math.abs(pe) > 0.55) return null;
        const sg = Math.sign(al) || 1; return [uz * sg, -ux * sg];
      } });
    } else if (kind === 'worm') {
      // cacing raksasa muncul dari bawah jembatan, melintas, lalu menyelam lagi
      const segs = []; const wg = new THREE.Group(); TD.add(wg);
      for (let j = 0; j < 9; j++) {
        const s = 1.6 - j * 0.08; const gq = new THREE.Group(); wg.add(gq);
        K.box(s, s, s, j % 2 ? '#ff9ec4' : '#ff7fb0', 0, 0, 0, gq);
        if (j === 0) {
          for (const e of [-1, 1]) { K.box(0.36, 0.42, 0.1, '#ffffff', e * 0.38, 0.25, s / 2 + 0.03, gq, false); K.box(0.18, 0.22, 0.1, '#1d2b53', e * 0.38, 0.2, s / 2 + 0.07, gq, false); }
          K.box(0.7, 0.16, 0.1, '#7a1d3a', 0, -0.35, s / 2 + 0.03, gq, false);
          K.box(0.12, 0.5, 0.12, '#ff7fb0', -0.3, s / 2 + 0.2, 0, gq); K.box(0.12, 0.5, 0.12, '#ff7fb0', 0.3, s / 2 + 0.2, 0, gq);
        } else K.box(s + 0.04, 0.14, s + 0.04, '#e86a9a', 0, 0, 0, gq, false);
        gq.rotation.y = Math.atan2(tx, tz); segs.push({ g: gq, s, y: 0, u: 0 });
      }
      let dust = 0;
      hazards.push({ x: cx, z: cz, y, worm: true, vis: wg, update(t, dt) {
        const p = (t + off) % 6.2, act = p < 3.6;
        const uh = -4.8 + (p / 3.6) * 16.4;
        segs.forEach((sg, j) => {
          const u = uh - j * 0.85; const k2 = clamp((u + 4.8) / 9.6, 0, 1);
          sg.u = u; sg.y = y - 1.6 + 2.9 * Math.sin(Math.PI * k2);
          sg.g.visible = act && u > -4.8 && u < 4.8 && sg.y > y - 0.9;
          sg.g.position.set(cx + tx * u, sg.y + sg.s / 2 - 0.3, cz + tz * u);
          sg.g.rotation.x = j === 0 ? -Math.cos(Math.PI * k2) * 0.7 : 0;
        });
        // peringatan: tanah bergetar & debu sebelum cacing muncul
        if (p > 5.2) { dust -= dt; if (dust <= 0) { dust = 0.25; K.burst(new THREE.Vector3(cx - tx * 3, y + 0.3, cz - tz * 3), ['#c9a36b', '#a8844f', '#e9d3a0']); K.rumble?.(cx, y, cz); } }
      }, hit(px, py, pz) {
        for (const sg of segs) {
          if (!sg.g.visible) continue;
          const sx = sg.g.position.x, sz = sg.g.position.z, sy = sg.g.position.y;
          if (Math.hypot(px - sx, pz - sz) < sg.s / 2 + PR && py < sy + sg.s / 2 && py + PH > sy - sg.s / 2) return [tx, tz];
        }
        return null;
      } });
    } else if (kind === 'piston') {
      // pendorong dari sisi dalam: tunggu sampai mundur, lalu lewat!
      const ps = []; const pg = new THREE.Group(); TD.add(pg);
      for (const u of [-1.3, 1.3]) {
        const hg = new THREE.Group(); pg.add(hg); hg.rotation.y = -a;
        K.box(1.0, 1.3, 1.0, '#7a7f8c', 0, 0.65, 0, hg); K.box(0.12, 1.1, 0.9, '#e8434b', 0.52, 0.65, 0, hg, false);
        const rod = K.box(3, 0.3, 0.3, '#c8ccd6', -1.5, 0.65, 0, hg, false); batchGroup(hg);
        const hx = cx + tx * u, hz = cz + tz * u;
        K.box(0.9, 1.6, 1.2, '#4a4f5c', hx - rx * 2.9, y + 0.8, hz - rz * 2.9, pg);
        ps.push({ hg, rod, u, hx, hz, e: 0, ph: u > 0 ? 1.5 : 0 });
      }
      hazards.push({ x: cx, z: cz, y, vis: pg, update(t) {
        for (const q of ps) {
          const p = (t + off + q.ph) % 3.0; q.e = p < 1.3 ? 0 : p < 1.55 ? (p - 1.3) / 0.25 : p < 2.1 ? 1 : Math.max(0, 1 - (p - 2.1) / 0.9);
          const w = -2.0 + q.e * 3.1; q.w = w; q.push = p >= 1.3 && p < 2.1;
          q.hg.position.set(q.hx + rx * w, y, q.hz + rz * w);
        }
      }, hit(px, py, pz) {
        if (py > y + 1.3) return null;
        for (const q of ps) {
          if (q.e < 0.05) continue;
          const dx = px - cx, dz = pz - cz, du = dx * tx + dz * tz, dw = dx * rx + dz * rz;
          if (Math.abs(du - q.u) < 0.5 + PR && Math.abs(dw - q.w) < 0.5 + PR) return [rx * 1.6, rz * 1.6];
        }
        return null;
      } });
    }
    for (let q = nh; q < hazards.length; q++) hazards[q].lv = lv;
  }
  buildTowerLift(root);
  // pagar keliling menara: gerbang terbuka hanya untuk yang punya nyawa
  const FR = TOWER.fence, NSEG = 24, segLen = (TAU * FR) / NSEG + 0.1;
  for (let i = 0; i < NSEG; i++) {
    const a = (i / NSEG) * TAU, [x, z] = P(a, FR), yaw = -a - Math.PI / 2;
    if (i === 0) {
      const m = K.box(segLen - 0.6, 1.8, 0.3, '#e8434b', x, 0.9, z, TD); m.rotation.y = yaw;
      const s = addSolid(x, z, segLen / 2, 0.2, 0, 2.6, yaw); s.mesh = m; s.on = false; m.visible = false; tower.gate = s;
      for (const e of [-1, 1]) { const [px, pz] = [x + -Math.sin(a) * e * (segLen / 2), z + Math.cos(a) * e * (segLen / 2)]; K.box(0.5, 4.4, 0.5, '#ffd23a', px, 2.2, pz, root); addSolid(px, pz, 0.25, 0.25, 0, 4.4); }
      const sp = sign('🗼 MENARA LANGIT', 5.5, { bg: '#ffd23a' }); sp.position.set(x, 5.1, z); TD.add(sp);
      continue;
    }
    const m = K.box(segLen, 1.3, 0.25, i % 2 ? '#a5764a' : '#8a5a35', x, 0.65, z, root); m.rotation.y = yaw;
    addSolid(x, z, segLen / 2, 0.2, 0, 2.6, yaw);
  }
}
// lift kaca di samping menara: bayar koin, naik langsung ke puncak; kembali turun sendiri (turun gratis)
export const LIFT = { price: 10, state: 'idle', y: 0.25, wait: 0, x: 0, z: 0, top: 0, half: 1.3 };
function buildTowerLift(root) {
  const { x: TX, z: TZ, N, H } = TOWER, top = N * H, LX = TX, LZ = TZ - 16.5, hw = LIFT.half;
  Object.assign(LIFT, { x: LX, z: LZ, top, y: 0.25 });
  const shaft = new THREE.Group(); K.scene.add(shaft);
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) { K.box(0.3, top + 3, 0.3, '#c8ccd6', LX + sx * (hw + 0.3), (top + 3) / 2, LZ + sz * (hw + 0.3), shaft); addSolid(LX + sx * (hw + 0.3), LZ + sz * (hw + 0.3), 0.15, 0.15, 0, top + 3); }
  for (let y = 8; y < top; y += 8) for (const sx of [-1, 1]) K.box(0.16, 0.16, hw * 2 + 0.6, '#c8ccd6', LX + sx * (hw + 0.3), y, LZ, shaft, false);
  K.box(hw * 2 + 1.2, 0.4, hw * 2 + 1.2, '#4a4f5c', LX, top + 3.2, LZ, shaft);
  // jembatan dari lift ke lantai puncak
  const bl = 16.5 - 7 - hw - 0.1; K.box(2.4, 0.6, bl, '#ffd23a', LX, top - 0.3, TZ - 7 - bl / 2, root); addSolid(LX, TZ - 7 - bl / 2, 1.2, bl / 2, top - 0.6, top);
  for (const sx of [-1, 1]) { K.box(0.12, 0.12, bl, '#ffffff', LX + sx * 1.15, top + 0.9, TZ - 7 - bl / 2, root, false); addSolid(LX + sx * 1.2, TZ - 7 - bl / 2, 0.06, bl / 2, top, top + 2.2); }
  const sp = sign(`🛗 Lift ke Puncak · 🪙 ${LIFT.price}`, 4.6, { bg: '#ffd23a' }); sp.position.set(LX, 4.2, LZ - hw - 0.6); DYN.add(sp);
  // kabin: lantai + pagar (pintu bawah menghadap luar, pintu atas menghadap jembatan)
  const cab = new THREE.Group(); DYN.add(cab);
  K.box(hw * 2, 0.4, hw * 2, '#ffd23a', 0, -0.2, 0, cab); K.box(hw * 2 + 0.1, 0.1, hw * 2 + 0.1, '#e6a91f', 0, 2.3, 0, cab, false);
  for (const sx of [-1, 1]) K.box(0.08, 2.2, hw * 2, '#bfe6ff', sx * hw, 1.1, 0, cab, false);
  const doorDn = K.box(hw * 2, 2.2, 0.08, '#bfe6ff', 0, 1.1, -hw, cab, false), doorUp = K.box(hw * 2, 2.2, 0.08, '#bfe6ff', 0, 1.1, hw, cab, false);
  const parts = [
    { lx: 0, lz: 0, hx: hw, hz: hw, dy0: -0.4, dy1: 0, lift: true },
    { lx: -hw, lz: 0, hx: 0.06, hz: hw, dy0: 0, dy1: 2.2 }, { lx: hw, lz: 0, hx: 0.06, hz: hw, dy0: 0, dy1: 2.2 },
    { lx: 0, lz: -hw, hx: hw, hz: 0.06, dy0: 0, dy1: 2.2, door: 'dn' }, { lx: 0, lz: hw, hx: hw, hz: 0.06, dy0: 0, dy1: 2.2, door: 'up' },
  ].map((q) => Object.assign(addSolid(LX + q.lx, LZ + q.lz, q.hx, q.hz, 0, 0, 0, { moving: true, lift: !!q.lift }), { dy0: q.dy0, dy1: q.dy1, door: q.door }));
  LIFT.floor = parts[0];
  movers.push({ parts, fn: (t, dt) => {
    const L = LIFT, sp = 11;
    if (L.state === 'up') { L.y = Math.min(top, L.y + sp * dt * Math.min(1, 0.3 + (top - L.y) / 6)); if (L.y >= top) { L.state = 'top'; L.wait = 7; } }
    else if (L.state === 'top') { L.wait -= dt; if (L.wait <= 0) L.state = 'down'; }
    else if (L.state === 'down') { L.y = Math.max(0.25, L.y - sp * dt * Math.min(1, 0.3 + (L.y - 0.25) / 6)); if (L.y <= 0.25) L.state = 'idle'; }
    const openDn = L.state === 'idle', openUp = L.state === 'top';
    for (const q of parts) { q.y0 = L.y + q.dy0; q.y1 = L.y + q.dy1; if (q.door) q.on = q.door === 'dn' ? !openDn : !openUp; }
    cab.position.set(LX, L.y, LZ); doorDn.visible = !openDn; doorUp.visible = !openUp;
  } });
}
export function liftGo() { if (LIFT.state !== 'idle') return false; LIFT.state = 'up'; return true; }
export const onLift = (b) => b.standOn === LIFT.floor;
export const inTower = (x, z) => Math.hypot(x - TOWER.x, z - TOWER.z) < TOWER.fence + 0.3;
// rintangan menara: perbarui & periksa apakah pemain tertabrak (hasil: arah dorongan)
let hazT = 0;
// tingkat kesulitan menara: rintangan & anak tangga berkedip muncul sesuai level, pagar hilang di level tinggi
export function setTowerLevel(L) {
  L = clamp(L || 1, 1, 4); if (L === tower.level) return; tower.level = L;
  for (const h of hazards) {
    h.active = L >= (h.lv || 1);
    if (!h.active) { h.reset?.(); if (h.vis) h.vis.visible = false; }
    if (h.post) h.post.on = h.active;
  }
  blinkStill.visible = L < 3;
  for (const r of rails.inner) r.on = L <= 2;
  for (const r of rails.outer) r.on = L <= 3;
  rails.gIn.visible = L <= 2; rails.gOut.visible = L <= 3;
}
export function updateHazards(dt, speed, px, pz, py = 0) {
  hazT += dt * speed;
  const near = Math.hypot(px - TOWER.x, pz - TOWER.z) < 85; TD.visible = near;
  if (!near) return;
  for (const f of floorDecor) f.g.visible = Math.abs(f.y - py) < 20;
  for (const h of hazards) {
    if (h.active === false) continue;
    const show = !h.vis || Math.abs(h.y - py) < 18;
    if (h.vis) h.vis.visible = show;
    if (show) h.update(hazT, dt);
  }
}
export function hazardHit(px, py, pz) {
  if (!inTower(px, pz)) return null;
  for (const h of hazards) { if (!h.hit || h.active === false || Math.abs(py - h.y) > 3 || Math.hypot(px - h.x, pz - h.z) > 5) continue; const r = h.hit(px, py, pz); if (r) return r; }
  return null;
}

/* =========================================================
   BANGUNAN
   ========================================================= */
const FH = 3.6; // tinggi satu lantai
function buildSchool() {
  const p = PLACES.sekolah; const f = frame(p.x, p.z, faceCenter(p.x, p.z));
  const HX = 7, HZ = 5, wall = '#fff1d6', trim = '#e8434b';
  f.solid(0, 0, HX * 2, HZ * 2, -0.5, 0.65, '#d9cba8');
  // lantai dasar: kelas (kiri) + aula & tangga (kanan)
  f.wallX(-HX, HX, HZ, 0.15, 3.45, wall, f.g, [[0, 2.0, 2.6]]); f.wallX(-HX, HX, -HZ, 0.15, 3.45, wall);
  f.wallZ(-HZ, HZ, -HX, 0.15, 3.45, wall); f.wallZ(-HZ, HZ, HX, 0.15, 3.45, wall);
  f.wallZ(-HZ, HZ, 2, 0.15, 3.45, '#ffe7b8', f.g, [[2.6, 1.6, 2.5]]);
  for (const x of [-4.5, -2, 4.5]) { f.winX(x, HZ, 1.4, 1.2, 1.2); f.winX(x, -HZ, 1.4, 1.2, 1.2); }
  f.deco(0, HZ + 0.25, HX * 2 + 0.4, 0.2, 3.3, 0.3, trim);
  // papan tulis
  const bb = board(4, 1.8, (q, w, h) => { q.fillStyle = '#2f5d3a'; q.fillRect(0, 0, w, h); q.strokeStyle = '#a5764a'; q.lineWidth = 18; q.strokeRect(0, 0, w, h); q.fillStyle = '#ffffff'; q.font = `800 64px ${K.FONT}`; q.textAlign = 'center'; q.fillText('A B C   1 2 3', w / 2, 100); q.font = `700 44px ${K.FONT}`; q.fillText('Ayo belajar! ⭐', w / 2, 180); });
  bb.rotation.y = Math.PI / 2; f.put(bb, -HX + 0.17, 1.9, 0);
  f.solid(-5.2, 0, 1.0, 2.2, 0.15, 0.85, '#8a5a35'); // meja guru
  for (const x of [-2.6, -0.6]) for (const z of [-2.8, -0.8, 1.2, 3.2]) {
    if (z > 3) continue;
    f.solid(x, z, 1.2, 0.8, 0.15, 0.8, '#c98f4f'); f.deco(x + 0.9, z, 0.5, 0.5, 0.15, 0.45, '#3a7cf5');
  }
  // tangga ke lantai 2 (kanan belakang)
  stairs(f, 6.1, 3.8, -1, 7, 0.15, f.g);
  const L1 = f.level(3.75);
  f.solid(-0.9, 0, 12.2, HZ * 2, 3.45, 0.3, '#e9dcbc', L1); f.solid(6.1, -3.75, 1.8, 2.5, 3.45, 0.3, '#e9dcbc', L1);
  f.solid(5.15, 1.25, 0.15, 7.5, 3.75, 1.0, '#ffffff', L1); f.solid(5.15, 1.25, 0.1, 7.5, 4.75, 1.2, null, L1);
  f.wallX(-HX, HX, HZ, 3.75, 3.45, wall, L1); f.wallX(-HX, HX, -HZ, 3.75, 3.45, wall, L1);
  f.wallZ(-HZ, HZ, -HX, 3.75, 3.45, wall, L1); f.wallZ(-HZ, HZ, HX, 3.75, 3.45, wall, L1);
  for (const x of [-4.5, -2, 0.5, 3]) { f.winX(x, HZ, 1.4, 4.9, 1.2, L1); f.winX(x, -HZ, 1.4, 4.9, 1.2, L1); }
  for (const x of [-5.5, -3.5]) { f.solid(x, -4.4, 1.6, 0.6, 3.75, 2.2, '#8a5a35', L1); for (let k = 0; k < 3; k++) f.deco(x, -4.05, 1.4, 0.1, 4.2 + k * 0.6, 0.4, ['#e8434b', '#3a7cf5', '#ffd23a'][k], L1, false); }
  for (const x of [-1.5, 0.8, 3.1]) f.solid(x, 0.5, 1.4, 1.4, 3.75, 0.75, '#c98f4f', L1);
  const roof = f.level(7.2);
  f.solid(0, 0, HX * 2 + 0.6, HZ * 2 + 0.6, 7.2, 0.3, '#e9dcbc', roof);
  for (let k = 0; k < 4; k++) f.deco(0, 0, HX * 2 + 0.8 - k * 1.6, HZ * 2 + 0.8 - k * 1.6, 7.5 + k * 0.5, 0.5, k % 2 ? '#c94a3a' : trim, roof);
  hideable(f, HX, HZ, [L1, roof], 7.2);
  const sp = sign('🏫 SEKOLAH CERIA', 5, { bg: '#ffffff' }); f.put(sp, 0, 9.9, HZ, DYN_AT(f));
  // tiang bendera merah putih
  f.solid(-4.5, HZ + 3.2, 0.2, 0.2, 0, 6.5, '#d0d0d0');
  const flag = new THREE.Group(); f.put(flag, -3.8, 5.6, HZ + 3.2, DYN_AT(f)); K.box(1.4, 0.45, 0.06, '#e8434b', 0, 0.22, 0, flag); K.box(1.4, 0.45, 0.06, '#ffffff', 0, -0.23, 0, flag);
  K.animated.push({ obj: flag, fn: (t) => (flag.rotation.y = Math.sin(t * 2) * 0.15) });
  addNpc({ id: 'guru', name: 'Pak Budi', role: 'Guru', x: f.W(-5.6, 2.2), face: f.a + Math.PI / 2, y: 0.15, shirt: '#ffffff', pants: '#3b4a6b', hat: null, pitch: -0.25, talk: talkTeacher });
  addNpc({ id: 'murid', name: 'Sinta', role: 'Murid', x: f.W(-0.6, 3.6), face: f.a + Math.PI, y: 0.15, shirt: '#ffffff', pants: '#e8434b', girl: true, scale: 0.8, pitch: 0.3, lines: ['Aku suka belajar membaca di sini!', 'Di lantai dua ada perpustakaan. Bukunya banyak!', 'Pak Budi baik sekali. Coba tanya Pak Budi, nanti dapat bintang!'] });
}
// grup bergerak/transparan yang mengikuti bingkai bangunan
function DYN_AT(f) { if (!f.dyn) { f.dyn = new THREE.Group(); f.dyn.userData.dynamic = true; f.g.add(f.dyn); } return f.dyn; }

function buildCanteen() {
  const p = PLACES.kantin; const f = frame(p.x, p.z, faceCenter(p.x, p.z));
  const HX = 6, HZ = 4.5;
  f.solid(0, 0, HX * 2, HZ * 2, -0.5, 0.65, '#f3e7c6');
  for (let i = -5; i <= 5; i += 2) for (let j = -4; j <= 4; j += 2) f.deco(i + 0.5, j + 0.5, 1, 1, 0.15, 0.02, '#ffd9a0', f.g, false);
  for (const x of [-HX + 0.25, 0, HX - 0.25]) for (const z of [-HZ + 0.25, HZ - 0.25]) f.solid(x, z, 0.5, 0.5, 0.15, 3.25, '#a5764a');
  // dinding rendah di samping, depan & belakang terbuka
  f.wallZ(-HZ, HZ, -HX, 0.15, 1.0, '#ffb347', f.g, [[0, 2, 9]]); f.wallZ(-HZ, HZ, HX, 0.15, 1.0, '#ffb347', f.g, [[0, 2, 9]]);
  f.wallX(-HX, HX, -HZ, 0.15, 1.0, '#ffb347');
  // konter makanan
  f.solid(0, -2.9, 7, 0.9, 0.15, 1.0, '#e8434b'); f.deco(0, -2.9, 7.2, 1.0, 1.15, 0.08, '#ffffff');
  ['🍜', '🍚', '🍗', '🥤', '🍌', '🍉'].forEach((e, i) => { const s = K.emojiSprite(e, 0.7); f.put(s, -2.9 + i * 1.15, 1.6, -2.9, DYN_AT(f)); });
  const menu = board(4.6, 1.3, (q, w, h) => { q.fillStyle = '#fff6df'; q.fillRect(0, 0, w, h); q.strokeStyle = '#e8434b'; q.lineWidth = 16; q.strokeRect(0, 0, w, h); q.fillStyle = '#1d2b53'; q.font = `800 92px ${K.FONT}`; q.textAlign = 'center'; q.textBaseline = 'middle'; q.fillText('KANTIN SEHAT', w / 2, h / 2 + 6); });
  f.deco(0, -HZ + 0.2, 5, 0.12, 1.15, 2.3, '#a5764a'); f.put(menu, 0, 2.6, -HZ + 0.3);
  // meja & bangku (bangku bisa dinaiki)
  for (const x of [-3.5, 0, 3.5]) {
    f.solid(x, 1.4, 1.8, 1.1, 0.15, 0.8, '#c98f4f'); f.solid(x, 0.45, 1.8, 0.45, 0.15, 0.4, '#8a5a35'); f.solid(x, 2.35, 1.8, 0.45, 0.15, 0.4, '#8a5a35');
    const s = K.emojiSprite(pick(['🍱', '🍙', '🥗', '🍎']), 0.55); f.put(s, x, 1.25, 1.4, DYN_AT(f));
  }
  // tempat cuci tangan
  f.solid(HX - 0.8, 3.4, 1.0, 0.7, 0.15, 1.0, '#7cc8f5'); f.deco(HX - 0.8, 3.65, 0.1, 0.1, 1.15, 0.4, '#c8ccd6');
  const wash = sign('🧼 Cuci tangan', 2.2, { bg: '#d8f0ff' }); f.put(wash, HX - 0.8, 2.2, 3.4, DYN_AT(f));
  const roof = f.level(3.4);
  f.solid(0, 0, HX * 2 + 1, HZ * 2 + 1, 3.4, 0.3, '#ffffff', roof);
  for (let i = 0; i < 13; i++) f.deco(-HX - 0.5 + i + 0.5, 0, 1, HZ * 2 + 1.4, 3.7, 0.25, i % 2 ? '#e8434b' : '#ffffff', roof);
  hideable(f, HX, HZ, [roof], 3.4);
  const sp = sign('🍜 KANTIN', 3, { bg: '#ffb347' }); f.put(sp, 0, 5.6, HZ + 0.5, DYN_AT(f));
  addNpc({ id: 'kantin', name: 'Bu Sari', role: 'Penjual', x: f.W(1.4, -3.85), face: f.a, y: 0.15, shirt: '#ff8fc0', pants: '#5b3b22', girl: true, hat: null, pitch: 0.12, talk: talkCanteen });
  addNpc({ id: 'makan', name: 'Dodi', role: 'Teman', x: f.W(3.5, 2.4), face: f.a + Math.PI, y: 0.55, shirt: '#3fb25a', pants: '#2c2f3a', scale: 0.8, pitch: 0.35, sit: true, lines: ['Nyam nyam! Bakso Bu Sari enak sekali!', 'Sebelum makan, kita berdoa dulu, ya.', 'Habis main, aku lapar. Kamu mau makan juga?'] });
}

const lift = { stops: [], y: 0.15, at: 0, moving: false };
function buildOffice() {
  const p = PLACES.gedung; const f = frame(p.x, p.z, faceCenter(p.x, p.z));
  const HX = 5, HZ = 5, NF = 4, wall = '#cfe3f2';
  const tops = []; for (let n = 0; n <= NF; n++) tops.push(0.15 + FH * n);
  f.solid(0, 0, HX * 2, HZ * 2, -0.5, 0.65, '#b9c6d3');
  const levels = [];
  for (let n = 0; n < NF; n++) {
    const b = tops[n], lv = n === 0 ? f.g : f.level(b); if (n) levels.push(lv);
    if (n > 0) {
      // lantai dengan lubang tangga & lift
      f.solid(-1.75, 1.35, 6.5, 7.3, b - 0.3, 0.3, '#e6edf3', lv);
      f.solid(-0.4, -3.65, 3.8, 2.7, b - 0.3, 0.3, '#e6edf3', lv);
      f.solid(3.1, 2.75, 3.2, 4.5, b - 0.3, 0.3, '#e6edf3', lv);
      f.solid(3.9, 0.05, 1.6, 0.9, b - 0.3, 0.3, '#e6edf3', lv);
    }
    const h = FH - 0.3;
    f.wallX(-HX, HX, HZ, b, h, wall, lv, n === 0 ? [[-1, 1.8, 2.6]] : []);
    f.wallX(-HX, HX, -HZ, b, h, wall, lv); f.wallZ(-HZ, HZ, -HX, b, h, wall, lv); f.wallZ(-HZ, HZ, HX, b, h, wall, lv);
    for (const x of [-3.3, 1.2, 3.4]) { if (n === 0 && x < 0) continue; f.winX(x, HZ, 1.5, b + 1.0, 1.6, lv); f.winX(x, -HZ, 1.5, b + 1.0, 1.6, lv); }
    for (const z of [-0.5, 2.8]) { f.winZ(-HX, z, 1.5, b + 1.0, 1.6, lv); f.winZ(HX, z, 1.5, b + 1.0, 1.6, lv); }
    // tangga berbalik (naik di jalur A, bordes, naik di jalur B)
    stairs(f, 2.3, 0.5, -1, 4, b, lv);
    f.solid(3.1, -3.9, 3.2, 1.6, b + 1.8, 0.45, '#bba57a', lv);
    stairs(f, 3.9, -3.1, 1, 3, b + 2.25, lv);
    // isi ruangan
    if (n === 0) { f.solid(-1.5, 2.4, 2.4, 0.8, b, 1.0, '#8a5a35', lv); f.solid(-3.8, 3.5, 1.6, 0.8, b, 0.6, '#3a7cf5', lv); }
    else for (const [x, z] of [[-1.2, 0.5], [-1.2, 3.0], [0.9, 3.4]]) { f.solid(x, z, 1.4, 0.8, b, 0.8, '#ffffff', lv); f.deco(x, z - 0.15, 0.6, 0.08, b + 0.8, 0.45, '#2c2f3a', lv, false); }
    f.deco(-4.3, 4.3, 0.6, 0.6, b, 0.6, '#8a5a35', lv); f.deco(-4.3, 4.3, 0.8, 0.8, b + 0.6, 0.8, '#3fae4f', lv);
  }
  // atap
  const roof = f.level(tops[NF]); levels.push(roof);
  const rb = tops[NF];
  f.solid(-1.75, 1.35, 6.5, 7.3, rb - 0.3, 0.3, '#9aa7b4', roof); f.solid(-0.4, -3.65, 3.8, 2.7, rb - 0.3, 0.3, '#9aa7b4', roof);
  f.solid(3.1, 2.75, 3.2, 4.5, rb - 0.3, 0.3, '#9aa7b4', roof); f.solid(3.9, 0.05, 1.6, 0.9, rb - 0.3, 0.3, '#9aa7b4', roof);
  for (const [x0, z0, x1, z1] of [[-HX, HZ, HX, HZ], [-HX, -HZ, HX, -HZ]]) { f.solid((x0 + x1) / 2, z0, x1 - x0, 0.3, rb, 1.0, '#ffffff', roof); f.solid((x0 + x1) / 2, z0, x1 - x0, 0.3, rb + 1.0, 1.2, null, roof); }
  for (const x of [-HX, HX]) { f.solid(x, 0, 0.3, HZ * 2, rb, 1.0, '#ffffff', roof); f.solid(x, 0, 0.3, HZ * 2, rb + 1.0, 1.2, null, roof); }
  f.deco(-1.5, 2.2, 3, 3, rb, 0.04, '#ffd23a', roof, false); f.deco(-1.5, 2.2, 2.4, 2.4, rb + 0.02, 0.04, '#2c2f3a', roof, false);
  f.deco(-2.1, 2.2, 0.3, 1.6, rb + 0.05, 0.03, '#ffffff', roof, false); f.deco(-0.9, 2.2, 0.3, 1.6, rb + 0.05, 0.03, '#ffffff', roof, false); f.deco(-1.5, 2.2, 0.9, 0.3, rb + 0.05, 0.03, '#ffffff', roof, false);
  f.solid(3.5, 4.0, 0.3, 0.3, rb, 4.5, '#8c96a3', roof);
  const blink = new THREE.Mesh(K.BOX, new THREE.MeshBasicMaterial({ color: '#ff3b3b' })); blink.scale.setScalar(0.4); f.put(blink, 3.5, rb + 4.7, 4.0, DYN_AT(f));
  K.animated.push({ obj: blink, fn: (t) => (blink.visible = Math.sin(t * 4) > 0) });
  const sp = sign('🏢 GEDUNG PELANGI', 5, { bg: '#d8f0ff' }); f.put(sp, 0, rb + 2.4, HZ, DYN_AT(f));
  // lift: berhenti di tiap lantai, pintu terbuka hanya saat lift ada
  const LX = -3.5, LZ = -3.5;
  const gates = [];
  for (let n = 0; n <= NF; n++) {
    const b = tops[n], lv = n === 0 ? f.g : levels[n - 1];
    f.wallX(-HX, -2.0, -2.15, b, n === NF ? 2.6 : FH - 0.3, '#9aa7b4', lv, [[LX, 1.6, 2.4]]);
    f.wallZ(-HZ, -2.0, -2.15, b, n === NF ? 2.6 : FH - 0.3, '#9aa7b4', lv);
    const gm = K.box(1.6, 2.4, 0.12, '#ffd23a', 0, 0, 0, DYN_AT(f)); gm.position.set(LX, b + 1.2, -2.15);
    const [gx, gz] = f.W(LX, -2.15); const gs = addSolid(gx, gz, 0.8, 0.2, b, b + 2.4, f.a); gs.mesh = gm;
    gates.push({ s: gs, y: b });
  }
  f.solid(LX, LZ - 1.4, 2.4, 0.3, rb, 2.6, '#9aa7b4', roof); f.solid(LX - 1.4, LZ, 0.3, 2.4, rb, 2.6, '#9aa7b4', roof); f.deco(LX, LZ, 3, 3, rb + 2.6, 0.3, '#9aa7b4', roof);
  const [lx, lz] = f.W(LX, LZ);
  const plat = new THREE.Group(); DYN.add(plat); plat.position.set(lx, 0, lz); plat.rotation.y = f.a;
  K.box(2.2, 0.3, 2.2, '#ffd23a', 0, -0.15, 0, plat); K.box(0.12, 2.2, 2.2, '#c8ccd6', -1.05, 1.1, 0, plat, false);
  const ls = addSolid(lx, lz, 1.1, 1.1, -0.15, 0.15, f.a, { moving: true, lift: true });
  const seq = [0, 1, 2, 3, 4, 3, 2, 1], WAIT = 2.6, MOVE = 1.8;
  lift.stops = tops;
  movers.push({ parts: [ls], fn: () => {
    const T = (performance.now() / 1000) % (seq.length * (WAIT + MOVE)); const i = Math.floor(T / (WAIT + MOVE)), p = T - i * (WAIT + MOVE);
    const a = tops[seq[i]], b = tops[seq[(i + 1) % seq.length]];
    const y = p < WAIT ? a : a + (b - a) * ease((p - WAIT) / MOVE);
    ls.y1 = y; ls.y0 = y - 0.3; plat.position.y = y; lift.moving = p >= WAIT;
    for (const g of gates) { const open = !lift.moving && Math.abs(y - g.y) < 0.05; g.s.on = !open; g.s.mesh.visible = !open; }
  } });
  hideable(f, HX, HZ, levels, rb + 0.2);
  addNpc({ id: 'satpam', name: 'Pak Joko', role: 'Satpam', x: f.W(1.6, HZ + 1.3), face: f.a, y: 0, shirt: '#2c4f8a', pants: '#1d2b53', hat: 'nelayan', pitch: -0.3, talk: talkGuard });
}

function house(x, z, yaw, col, roofCol, npc) {
  const f = frame(x, z, yaw); const HX = 4, HZ = 4;
  f.solid(0, 0, HX * 2, HZ * 2, -0.5, 0.65, '#c98f4f');
  f.wallX(-HX, HX, HZ, 0.15, 3.0, col, f.g, [[-1.6, 1.4, 2.3]]); f.wallX(-HX, HX, -HZ, 0.15, 3.0, col);
  f.wallZ(-HZ, HZ, -HX, 0.15, 3.0, col); f.wallZ(-HZ, HZ, HX, 0.15, 3.0, col);
  f.wallZ(-HZ, HZ, 1, 0.15, 3.0, '#fff6df', f.g, [[1.8, 1.3, 2.3]]);
  f.winX(1.5, HZ, 1.2, 1.1, 1.0); f.winX(-2.5, -HZ, 1.2, 1.1, 1.0); f.winZ(-HX, 0.5, 1.2, 1.1, 1.0); f.winZ(HX, -1.5, 1.2, 1.1, 1.0);
  f.deco(-1.6, HZ + 0.6, 1.6, 1.0, 0, 0.15, '#b9b3a6');
  // ruang tamu: sofa, meja, TV, karpet
  f.deco(-1.5, 0.5, 3, 2.4, 0.15, 0.02, '#ff8fc0', f.g, false);
  f.solid(-1.5, -3.2, 2.6, 0.9, 0.15, 0.55, '#3a7cf5'); f.deco(-1.5, -3.6, 2.6, 0.3, 0.7, 0.6, '#3a7cf5');
  f.solid(-1.5, 0.5, 1.2, 0.8, 0.15, 0.6, '#8a5a35');
  f.solid(-3.6, 0.5, 0.5, 1.6, 0.15, 0.7, '#5b3b22'); f.deco(-3.55, 0.5, 0.1, 1.4, 0.9, 0.85, '#1d2b53', f.g, false);
  // kamar: kasur (bisa dilompati!), lemari
  f.solid(2.6, -2.3, 2.2, 3.0, 0.15, 0.55, '#ffffff'); f.deco(2.6, -3.4, 1.8, 0.6, 0.7, 0.2, '#ffd23a'); f.deco(2.6, -1.8, 2.2, 1.8, 0.7, 0.06, '#9a62e0', f.g, false);
  f.solid(3.5, 2.6, 0.8, 1.4, 0.15, 2.1, '#a5764a');
  const roof = f.level(3.15);
  f.solid(0, 0, HX * 2 + 0.6, HZ * 2 + 0.6, 3.15, 0.25, roofCol, roof);
  for (let k = 0; k < 4; k++) f.deco(0, 0, HX * 2 + 0.6 - k * 2, HZ * 2 + 0.6 - k * 2, 3.4 + k * 0.55, 0.55, k % 2 ? '#b5523b' : roofCol, roof);
  f.deco(2.4, -2, 0.7, 0.7, 3.6, 1.6, '#8a8a8a', roof);
  hideable(f, HX, HZ, [roof], 3.15);
  const cat = K.emojiSprite('🐱', 0.7); f.put(cat, 2.6, 1.15, -2.9, DYN_AT(f));
  for (let i = 0; i < 6; i++) { f.deco(-HX + 0.5 + i * 0.9, HZ + 2.2, 0.15, 0.15, 0, 0.8, '#ffffff'); }
  f.deco(-HX + 2.75, HZ + 2.2, 5, 0.1, 0.55, 0.12, '#ffffff', f.g, false);
  for (let i = 0; i < 8; i++) { f.deco(1.5 + (i % 4) * 0.6, HZ + 1.6 + Math.floor(i / 4) * 0.6, 0.12, 0.12, 0.15, 0.35, '#3a8f40', f.g, false); f.deco(1.5 + (i % 4) * 0.6, HZ + 1.6 + Math.floor(i / 4) * 0.6, 0.26, 0.26, 0.5, 0.26, pick(['#ff8fc0', '#ffd23a', '#e8434b']), f.g, false); }
  if (npc) addNpc({ ...npc, x: f.W(...npc.at), face: yaw + (npc.turn || 0) });
}
function buildHouses() {
  const p = PLACES.rumah;
  for (const [deg, col, roofCol, npc] of [
    [322, '#ffe39a', '#c94a3a', { id: 'nenek', name: 'Nenek Ijah', role: 'Nenek', at: [-1.5, -1.6], y: 0.15, shirt: '#9a62e0', pants: '#5b3b22', girl: true, hair: '#c9c9c9', pitch: -0.1, talk: talkGranny }],
    [338, '#a7d8ff', '#3a5f9e', { id: 'tono', name: 'Tono', role: 'Teman', at: [1.5, 6.2], y: 0, shirt: '#ff8a2a', pants: '#3a7cf5', scale: 0.8, pitch: 0.4, wander: 3.5, talk: talkKid }],
  ]) { const [x, z] = polar(deg, 49.5); house(x, z, faceCenter(x, z), col, roofCol, npc); }
  void p;
}

/* =========================================================
   GUNUNG: teras-teras bertingkat yang bisa didaki sampai puncak bersalju
   ========================================================= */
export const MOUNT = { x: PLACES.gunung.x, z: PLACES.gunung.z, top: 0 };
function buildMountain() {
  const { x: MX, z: MZ } = MOUNT; const root = new THREE.Group(); K.scene.add(root);
  // 34 teras setinggi 0.5 m (puncak ±17 m), tiap teras bisa dinaiki tanpa lompat
  const N = 34, DEC = (11.5 - 1.9) / (N - 1), HALF = (i) => 11.5 - i * DEC;
  for (let i = 0; i < N; i++) {
    const half = HALF(i), y0 = i * 0.5, yaw = i * 0.02;
    const snow = i >= N - 7, rock = i >= 17;
    const side = snow ? '#e8eef5' : rock ? '#9a9486' : i % 2 ? '#8b6a4b' : '#7d5f43';
    const cap = snow ? '#ffffff' : rock ? (i % 2 ? '#a8a294' : '#b3ad9f') : i % 3 === 0 ? '#5fb953' : '#67c25a';
    const m1 = K.box(half * 2, 0.44, half * 2, side, MX, y0 + 0.22, MZ, root); m1.rotation.y = yaw;
    const m2 = K.box(half * 2 + 0.02, 0.06, half * 2 + 0.02, cap, MX, y0 + 0.47, MZ, root); m2.rotation.y = yaw;
    addSolid(MX, MZ, half, half, y0, y0 + 0.5, yaw);
    MOUNT.top = y0 + 0.5; MOUNT.half = half;
    // pohon cemara kecil di teras bawah
    if (i < 16 && i % 3 === 0) for (let k = 0; k < 3; k++) {
      const a = rand(0, TAU), r = half - 0.15; const c = Math.cos(yaw), s = Math.sin(yaw);
      const lx = Math.cos(a) > 0 ? r : -r, lz = rand(-r, r); const sw = k % 2 ? [lz, lx] : [lx, lz];
      const tx = MX + sw[0] * c + sw[1] * s, tz = MZ - sw[0] * s + sw[1] * c;
      if (Math.hypot(tx - MX, tz - (MZ + half)) < 3) continue;
      K.box(0.2, 0.6, 0.2, '#8a5a35', tx, y0 + 0.8, tz, root); K.box(0.6, 0.6, 0.6, '#2f7d3a', tx, y0 + 1.3, tz, root); K.box(0.35, 0.4, 0.35, '#3a8f40', tx, y0 + 1.75, tz, root);
    }
  }
  // air terjun di sisi depan
  for (let i = 0; i < 24; i++) { const half = HALF(i); K.box(1.6, 0.55, 0.12, i % 2 ? '#7cc8f5' : '#a8dcf7', MX, i * 0.5 + 0.25, MZ + half + 0.07, root, false); }
  K.box(4, 0.05, 1.6, '#4cb4ea', MX, 0.03, MZ + 12.4, root, false);
  const top = MOUNT.top;
  K.box(0.18, 3.2, 0.18, '#8a5a35', MX + 0.6, top + 1.6, MZ, root);
  const flag = K.box(1.4, 0.8, 0.08, '#ffd23a', MX + 1.35, top + 2.8, MZ, DYN); K.animated.push({ obj: flag, fn: (t) => (flag.scale.x = 1.4 * (1 + Math.sin(t * 6) * 0.08)) });
  const sp = sign('⛰️ Puncak Gunung', 4, { bg: '#ffffff' }); sp.position.set(MX, top + 4.2, MZ); DYN.add(sp);
  addNpc({ id: 'pendaki', name: 'Kak Gilang', role: 'Pendaki', x: [MX + 2.5, MZ + 13.8], face: 0, y: 0, shirt: '#ff8a2a', pants: '#3b4a6b', hat: 'caping', pitch: -0.15, lines: ['Halo! Gunung ini bisa didaki. Jalan saja naik tangga batunya pelan-pelan.', 'Di puncak ada salju dan bendera kuning. Ayo ke sana!', 'Lihat air terjunnya! Airnya jernih dan segar.', 'Kalau capek, istirahat dulu, ya. Mendaki itu pelan-pelan saja.'] });
}

/* =========================================================
   DERMAGA & KAPAL: kapal berlabuh, lalu berlayar keliling laut
   ========================================================= */
export const ship = { docked: true, left: 0, DOCK: 15, SAIL: 32, pierStart: [0, 0], deck: null };
function buildPierAndShip() {
  const { x, z } = PLACES.kapal; const th = Math.atan2(x, z);
  const f = frame(x, z, th);
  for (let i = 0; i < 9; i++) f.deco(0, 2 + i * 0.95, 2.4, 0.9, 0.03, 0.18, i % 2 ? '#b58552' : '#a57745');
  for (const s of [-1, 1]) for (let i = 0; i < 4; i++) { f.deco(s * 1.25, 2.4 + i * 2.4, 0.3, 0.3, -1.1, 2.3, '#7a5432'); }
  for (const s of [-1, 1]) f.deco(s * 1.25, 6.0, 0.12, 7.6, 1.0, 0.1, '#e9d3a0');
  f.solid(0, 5.8, 2.4, 8.5, -1.0, 1.21, null);
  const gate = f.solid(0, 10.15, 2.4, 0.2, 0.21, 2.2, null);
  const rope = K.box(2.4, 0.1, 0.1, '#e8434b', 0, 0, 0, DYN_AT(f)); rope.position.set(0, 0.9, 10.1); gate.mesh = rope;
  ship.pierStart = f.W(0, 2.6); PLACES.kapal.go = f.W(0, 0.6); PLACES.kapal.look = f.W(0, 12);
  // perahu kecil (hiasan)
  const boat = new THREE.Group(); f.put(boat, 3.6, -0.55, 8.5, DYN_AT(f));
  K.box(1.6, 0.7, 3.6, '#e8434b', 0, 0, 0, boat); K.box(1.3, 0.2, 3.2, '#f7f3ea', 0, 0.3, 0, boat); K.box(1.0, 0.7, 0.6, '#e8434b', 0, 0.2, 1.9, boat);
  K.animated.push({ obj: boat, fn: (t) => { boat.position.y = -0.55 + Math.sin(t * 1.6) * 0.08; boat.rotation.z = Math.sin(t * 1.2) * 0.05; } });
  // kapal
  const sg = new THREE.Group(); DYN.add(sg);
  K.box(7.4, 1.0, 3.0, '#1d4f91', 0, -0.5, 0, sg); K.box(8.0, 0.7, 3.6, '#ffffff', 0, 0.3, 0, sg); K.box(8.0, 0.12, 3.62, '#e8434b', 0, 0.05, 0, sg);
  K.box(1.2, 0.9, 2.4, '#ffffff', 4.4, 0.3, 0, sg); K.box(0.8, 0.8, 1.4, '#ffffff', 5.1, 0.35, 0, sg);
  K.box(7.6, 0.1, 3.2, '#c98f4f', 0, 0.68, 0, sg);
  K.box(2.2, 1.9, 2.4, '#fff6df', -2.4, 1.65, 0, sg); K.box(2.5, 0.25, 2.7, '#3a7cf5', -2.4, 2.72, 0, sg);
  K.box(0.5, 0.5, 2.42, '#bfe6ff', -2.4, 1.9, 0, sg, false);
  K.box(0.25, 5, 0.25, '#8a5a35', 0.8, 3.2, 0, sg);
  const sail = K.box(0.08, 3.0, 2.6, '#ffffff', 0.95, 3.3, 0, sg); K.box(0.1, 0.5, 2.6, '#e8434b', 0.97, 2.4, 0, sg, false);
  K.box(0.06, 0.5, 0.9, '#ffd23a', 0.8, 5.9, 0.45, sg, false);
  for (const s of [-1, 1]) K.box(7.6, 0.1, 0.1, '#ffffff', 0, 1.6, s * 1.75, sg, false);
  for (let i = -3; i <= 3; i++) for (const s of [-1, 1]) if (!(s < 0 && Math.abs(i) < 1)) K.box(0.1, 0.9, 0.1, '#ffffff', i * 1.2, 1.15, s * 1.75, sg, false);
  sg.traverse((m) => { if (m.isMesh) m.castShadow = false; }); batchGroup(sg);
  const nm = sign('KM Balok', 2.2, { bg: '#ffffff' }); nm.position.set(0, 2.4, 1.9); sg.add(nm);
  void sail;
  // bagian padat kapal (posisi lokal kapal)
  const parts = [
    { lx: 0, lz: 0, hx: 3.8, hz: 1.7, y0: -1.0, y1: 0.73 },
    { lx: -2.4, lz: 0, hx: 1.1, hz: 1.2, y0: 0.73, y1: 2.6 },
    { lx: 0.8, lz: 0, hx: 0.2, hz: 0.2, y0: 0.73, y1: 5 },
    { lx: 0, lz: 1.85, hx: 4.0, hz: 0.12, y0: 0.73, y1: 2.6 },
    { lx: -2.45, lz: -1.85, hx: 1.55, hz: 0.12, y0: 0.73, y1: 2.6 },
    { lx: 2.45, lz: -1.85, hx: 1.55, hz: 0.12, y0: 0.73, y1: 2.6 },
    { lx: 0, lz: -1.85, hx: 0.95, hz: 0.12, y0: 0.73, y1: 2.6, gate: true },
    { lx: 3.95, lz: 0, hx: 0.12, hz: 1.8, y0: 0.73, y1: 2.6 },
    { lx: -3.95, lz: 0, hx: 0.12, hz: 1.8, y0: 0.73, y1: 2.6 },
  ].map((q) => { const s = addSolid(0, 0, q.hx, q.hz, q.y0, q.y1, 0, { moving: true }); s.lx = q.lx; s.lz = q.lz; s.gate = !!q.gate; return s; });
  ship.deck = parts[0];
  const D = 10.05 + 0.15 + 1.85, RC = 18;
  const cyc = ship.DOCK + ship.SAIL;
  movers.push({ parts, fn: () => {
    const T = (Date.now() / 1000) % cyc; const docked = T < ship.DOCK;
    let lx = 0, lz = D, b = 0;
    if (!docked) { const k = (T - ship.DOCK) / ship.SAIL; const ph = TAU * (k - Math.sin(TAU * k) / TAU); lx = RC * Math.sin(ph); lz = D + RC - RC * Math.cos(ph); b = -ph; }
    const [wx, wz] = f.W(lx, lz), yaw = th + b;
    sg.position.set(wx, Math.sin(performance.now() / 600) * 0.05, wz); sg.rotation.y = yaw; sg.rotation.z = docked ? 0 : Math.sin(performance.now() / 900) * 0.025;
    const c = Math.cos(yaw), s = Math.sin(yaw);
    for (const q of parts) { q.cx = wx + q.lx * c + q.lz * s; q.cz = wz - q.lx * s + q.lz * c; setRot(q, yaw); if (q.gate) q.on = !docked; }
    gate.on = !docked; rope.visible = !docked;
    ship.docked = docked; ship.left = docked ? ship.DOCK - T : cyc - T;
  } });
  addNpc({ id: 'kapten', name: 'Kapten Bahar', role: 'Kapten', x: f.W(-0.6, 3.0), face: th + Math.PI, y: 0.21, shirt: '#ffffff', pants: '#1d2b53', hat: 'bajak', pitch: -0.35, talk: talkCaptain });
}

/* =========================================================
   WARGA (NPC): diam di tempatnya atau berjalan-jalan dekat rumahnya (tidak mengikuti pemain)
   ========================================================= */
export const npcs = [];
function nameTex(name, role) {
  return K.canvasTex(320, 96, (q) => {
    q.fillStyle = 'rgba(255,246,223,0.95)'; K.rrect(q, 4, 4, 312, 88, 30); q.fill();
    q.fillStyle = '#1d2b53'; q.textAlign = 'center'; q.textBaseline = 'middle';
    q.font = `800 40px ${K.FONT}`; q.fillText(name, 160, 38); q.font = `700 24px ${K.FONT}`; q.fillStyle = '#5b6b8c'; q.fillText(role || '', 160, 72);
  });
}
function addNpc(o) {
  const skin = o.skin || pick(['#f6d2b4', '#e3ac83', '#b97a52']);
  const ch = K.makeCharacter({ shirt: o.shirt, pants: o.pants, skin, hair: o.hair || '#3b2a20' });
  ch.skinColor = skin; if (o.girl) ch.setGirl(true);
  if (o.hat) ch.hatSlot.add(K.makeHat(o.hat));
  ch.root.traverse((m) => { if (m.isMesh) m.castShadow = false; }); // hemat untuk tablet
  const sc = o.scale || 1; ch.root.scale.setScalar(sc);
  const [x, z] = o.x; ch.root.position.set(x, o.y || 0, z); ch.root.rotation.y = o.face || 0; DYN.add(ch.root);
  if (o.sit) { ch.hipL.rotation.x = -1.5; ch.hipR.rotation.x = -1.5; ch.body.position.y = -0.8; }
  const tag = new THREE.Sprite(new THREE.SpriteMaterial({ map: nameTex(o.name, o.role), transparent: true, depthWrite: false }));
  tag.scale.set(2.2 / sc, 0.66 / sc, 1); tag.position.y = 3.55; ch.root.add(tag);
  const bub = K.emojiSprite('💬', 0.8 / sc); bub.position.y = 4.4; bub.visible = false; ch.root.add(bub);
  ch.root.userData.tap = () => K.onNpc(n);
  const n = { ...o, ch, tag, bub, pos: ch.root.position, home: [x, z], y: o.y || 0, tgt: null, wait: rand(1, 4), talkT: 0, waveT: 0, waved: false, face0: o.face || 0, phase: rand(0, 6), stuck: 0 };
  npcs.push(n); K.tapRoots.push(ch.root);
  return n;
}
export function npcTalked(n) { n.talkT = 6; n.waveT = 1.2; }
export function updateNpcs(dt, P) {
  const t = performance.now() / 1000;
  for (const n of npcs) {
    const dx = P.pos.x - n.pos.x, dz = P.pos.z - n.pos.z, d = Math.hypot(dx, dz);
    const vis = d < 60 && Math.abs(n.y - P.y) < 14; n.ch.root.visible = vis; if (!vis) continue;
    let moving = false;
    const toPlayer = Math.atan2(dx, dz);
    let want = null;
    if (n.talkT > 0) { n.talkT -= dt; want = toPlayer; }
    else if (n.wander) {
      if (!n.tgt) { n.wait -= dt; if (d < 4) want = toPlayer; if (n.wait <= 0) { const a = rand(0, TAU), r = rand(1, n.wander); n.tgt = [n.home[0] + Math.cos(a) * r, n.home[1] + Math.sin(a) * r]; n.stuck = 0; } }
      else {
        const tx = n.tgt[0] - n.pos.x, tz = n.tgt[1] - n.pos.z, td = Math.hypot(tx, tz);
        if (td < 0.25 || (n.stuck += dt) > 5) { n.tgt = null; n.wait = rand(2, 5); }
        else { const st = Math.min(td, 1.5 * dt); n.pos.x += (tx / td) * st; n.pos.z += (tz / td) * st; pushOut(n.pos, n.y, 0.4); K.pushTrees(n.pos); want = Math.atan2(tx, tz); moving = true; }
      }
    } else want = d < 7 ? toPlayer : n.face0;
    if (want !== null && !n.sit) { let rd = want - n.ch.root.rotation.y; rd = Math.atan2(Math.sin(rd), Math.cos(rd)); n.ch.root.rotation.y += rd * Math.min(1, dt * 6); }
    // melambai saat pemain mendekat
    if (d < 5 && !n.waved) { n.waved = true; n.waveT = 1.4; } else if (d > 10) n.waved = false;
    n.waveT = Math.max(0, n.waveT - dt);
    n.phase += dt * (moving ? 9 : 2);
    if (!n.sit) { const sw = moving ? Math.sin(n.phase) * 0.6 : 0; n.ch.hipL.rotation.x = sw; n.ch.hipR.rotation.x = -sw; n.ch.shL.rotation.x = -sw; }
    n.ch.shR.rotation.x = n.waveT > 0 ? -2.6 : moving ? Math.sin(n.phase) * 0.6 : Math.sin(t * 1.5 + n.phase) * 0.05;
    n.ch.shR.rotation.z = n.waveT > 0 ? Math.sin(t * 14) * 0.35 : 0;
    if (!n.sit) n.ch.body.position.y = moving ? Math.abs(Math.sin(n.phase)) * 0.06 : Math.sin(t * 2 + n.phase) * 0.02;
    if (n.bounce) { const b = Math.abs(Math.sin(t * 2.2 + n.phase * 0.1)); n.pos.y = n.y + b * 3.2; n.ch.shL.rotation.x = n.ch.shR.rotation.x = b > 0.3 ? -2.7 : -0.5; n.ch.hipL.rotation.x = n.ch.hipR.rotation.x = 0; }
    n.bub.visible = d < 9 && n.talkT <= 0; if (n.bub.visible) n.bub.position.y = 4.4 + Math.sin(t * 3 + n.phase) * 0.12;
  }
}

/* ---------------- isi obrolan warga ---------------- */
const QUIZ_WORDS = [['Apel', 'A', '🍎'], ['Bola', 'B', '⚽'], ['Cicak', 'C', '🦎'], ['Domba', 'D', '🐑'], ['Ikan', 'I', '🐟'], ['Kucing', 'K', '🐱'], ['Mobil', 'M', '🚗'], ['Sapi', 'S', '🐄']];
function numChoices(ans, lo = 1) { const s = new Set([ans]); while (s.size < 3) { const v = ans + pick([-2, -1, 1, 2]); if (v >= lo) s.add(v); } return shuffle([...s]); }
function talkTeacher(api) {
  const kind = pick(['add', 'count', 'letter', 'shape']);
  if (kind === 'add') {
    const a = randi(1, 3), b = randi(1, 3), ans = a + b, opts = numChoices(ans);
    api.ask(`${a} tambah ${b}, berapa hayo?`, opts.map(String), opts.indexOf(ans), `Pintar! ${a} tambah ${b} sama dengan ${ans}.`, `Hampir! ${a} tambah ${b} itu ${ans}. Coba hitung pakai jari, ya.`);
  } else if (kind === 'count') {
    const [e, nm] = pick([['🍎', 'apel'], ['🐥', 'anak ayam'], ['⭐', 'bintang'], ['🎈', 'balon']]); const n = randi(2, 6), opts = numChoices(n);
    api.ask(`Ada berapa ${nm}? ${e.repeat(n)}`, opts.map(String), opts.indexOf(n), `Betul! Ada ${n} ${nm}.`, `Hmm, coba hitung lagi pelan-pelan. Ada ${n} ${nm}.`);
  } else if (kind === 'letter') {
    const [w, L, e] = pick(QUIZ_WORDS); const opts = shuffle([L, ...shuffle(QUIZ_WORDS.map((q) => q[1]).filter((x) => x !== L)).slice(0, 2)]);
    api.ask(`${e} ${w}. Huruf depannya apa?`, opts, opts.indexOf(L), `Hebat! ${w} dimulai dengan huruf ${L}.`, `Belum tepat. ${w} dimulai dengan huruf ${L}.`);
  } else {
    const [q, right, opts] = pick([['Mana yang bentuknya bulat?', '⚽', ['⚽', '📦', '🔺']], ['Mana yang bisa terbang?', '🐦', ['🐦', '🐟', '🐢']], ['Mana buah yang kuning?', '🍌', ['🍌', '🍇', '🍓']], ['Mana yang hidup di air?', '🐟', ['🐟', '🐔', '🐈']]]);
    const o = shuffle([...opts]); api.ask(q, o, o.indexOf(right), 'Betul sekali! Kamu memperhatikan, ya.', `Belum tepat. Jawabannya ${right}.`);
  }
}
function talkCanteen(api) {
  api.choose('Selamat datang di kantin! Mau makan apa?', ['🍜 Bakso', '🍚 Nasi goreng', '🥤 Es jeruk', '🍌 Pisang'], (i) => {
    const e = ['🍜', '🍚', '🥤', '🍌'][i], nm = ['bakso', 'nasi goreng', 'es jeruk', 'pisang'][i];
    api.eat(e, nm);
  });
}
function talkGranny(api) {
  const [e, nm] = pick([['🐱', 'kucing'], ['🐔', 'ayam'], ['🌸', 'bunga'], ['🍪', 'kue']]); const n = randi(2, 5), opts = numChoices(n);
  api.ask(`Cucuku, bantu Nenek hitung ${nm} Nenek, ya. ${e.repeat(n)}`, opts.map(String), opts.indexOf(n), `Terima kasih, cucu pintar! ${nm} Nenek ada ${n}.`, `Hehe, coba hitung lagi, ya. Ada ${n} ${nm}.`);
}
function talkKid(api) {
  const COL = [['merah', '🔴'], ['biru', '🔵'], ['kuning', '🟡'], ['hijau', '🟢']];
  const [nm, e] = pick(COL); const o = shuffle(COL.map((c) => c[1]));
  if (Math.random() < 0.5) api.ask(`Main tebak warna, yuk! Mana yang warna ${nm}?`, o, o.indexOf(e), 'Yeay, betul! Kamu jago!', `Bukan. Yang warna ${nm} itu ${e}.`);
  else api.say(pick(['Kamu sudah naik Menara Langit? Katanya di puncak ada hadiah!', 'Ayo naik kapal! Kapalnya berlayar keliling laut.', 'Aku tinggal di rumah biru ini. Rumahmu di mana?', 'Gedung tinggi itu ada liftnya, lho!']));
}
function talkGuard(api) {
  api.say(pick(['Selamat datang di Gedung Pelangi! Mau naik? Pakai lift kuning atau tangga.', 'Liftnya berhenti di setiap lantai. Tunggu pintunya terbuka, ya.', 'Dari atap gedung, pemandangannya bagus sekali!', 'Jangan berlari di tangga, ya. Hati-hati!']));
}
function talkCaptain(api) {
  const s = api.ship(); const left = Math.max(1, Math.round(ship.left));
  if (s.docked) api.say(`Ahoi! Kapal KM Balok berangkat ${left} detik lagi. Ayo naik lewat dermaga ini!`);
  else api.say(`Kapal sedang berlayar. Kembali sekitar ${left} detik lagi. Tunggu di sini, ya!`);
}
function talkTowerGuide(api) {
  if (api.hp() < 1) { api.say('Maaf, nyawamu habis. Belajar dulu di tempat bermain supaya dapat nyawa, lalu naik menara lagi, ya!'); return; }
  api.say(pick([
    'Ini Menara Langit! Lompat dari pijakan ke pijakan sampai puncak. Di puncak ada hadiah!',
    'Menara ini punya 20 lantai! Di setiap lantai ada kakak penjaga dengan kuis. Jawab yang benar, dapat bintang!',
    'Kalau jatuh, kamu mulai lagi dari lantai terakhir yang kamu capai.',
    'Hati-hati! Kalau jatuh dari ketinggian, nyawamu berkurang satu.',
    'Awas cacing raksasa di jembatan! Tunggu sampai ia menyelam, baru lewat.',
    'Pijakan merah yang berkedip akan hilang. Cepat lewat, ya!',
  ]));
}
function buildTownNpcs() {
  addNpc({ id: 'pemandu', name: 'Kak Dimas', role: 'Pemandu Menara', x: [TOWER.x + 16.6, TOWER.z - 3.2], face: Math.PI / 2, shirt: '#e8434b', pants: '#2c2f3a', hat: 'astronot', pitch: -0.1, talk: talkTowerGuide });
  addNpc({ id: 'taman', name: 'Pak Ujang', role: 'Penjaga Taman', x: [5.5, 9.5], face: Math.PI, shirt: '#3fb25a', pants: '#5b3b22', hat: 'caping', pitch: -0.3, wander: 4, lines: ['Halo! Air mancur ini cantik, ya. Tapi kalau malam, zombie keluar dari sini!', 'Kalau malam, cari tempat bermain yang ada cincin aman, ya.', 'Jangan buang sampah sembarangan, ya. Pulau kita harus bersih!', 'Kamu sudah ke gunung? Di puncaknya ada salju!'] });
  addNpc({ id: 'mimi', name: 'Mimi', role: 'Teman', x: [-6, 30], face: 0, shirt: '#ff8fc0', pants: '#9a62e0', girl: true, scale: 0.8, pitch: 0.4, wander: 6, talk: talkKid });
  // penjual & warga tambahan supaya pulau ramai
  K.box(1.2, 0.9, 0.8, '#ffffff', -8, 0.45, -10.8, K.scene); addSolid(-8, -10.8, 0.6, 0.4, 0, 0.9);
  const bl = new THREE.Group(); bl.position.set(-7.2, 3.2, -10.8); DYN.add(bl); ['🎈', '🎈', '🎈'].forEach((e, i) => { const b = K.emojiSprite(e, 0.9); b.position.set((i - 1) * 0.5, Math.abs(i - 1) * -0.3, 0); bl.add(b); });
  K.animated.push({ obj: bl, fn: (t) => (bl.position.y = 3.2 + Math.sin(t * 1.5) * 0.15) });
  addNpc({ id: 'balon', name: 'Pak Didi', role: 'Penjual Balon', x: [-8, -9.6], face: 0, shirt: '#9a62e0', pants: '#2c2f3a', pitch: -0.2,
    talk: (api) => api.choose('Balon, balon! Mau balon warna apa?', ['🔴 Merah', '🔵 Biru', '🟡 Kuning', '🟢 Hijau'], (i) => { api.say(`Ini balon ${['merah', 'biru', 'kuning', 'hijau'][i]}mu! Pegang erat-erat, ya, jangan sampai terbang.`); api.food('🎈'); }) });
  K.box(1.6, 1.0, 0.9, '#7cc8f5', 8, 0.5, -10.8, K.scene); addSolid(8, -10.8, 0.8, 0.45, 0, 1.0); K.box(0.12, 2.4, 0.12, '#ffffff', 8, 1.6, -10.8, K.scene, false); K.box(2.4, 0.15, 2.4, '#ff8fc0', 8, 2.85, -10.8, K.scene, false);
  { const ic = K.emojiSprite('🍦', 0.9); ic.position.set(8, 1.6, -10.3); DYN.add(ic); }
  addNpc({ id: 'eskrim', name: 'Bu Ani', role: 'Penjual Es Krim', x: [8, -9.6], face: 0, girl: true, shirt: '#ffffff', pants: '#ff8fc0', pitch: 0.15,
    talk: (api) => api.choose('Es krim, es krim! Mau rasa apa?', ['🍓 Stroberi', '🍫 Cokelat', '🍌 Pisang', '🥭 Mangga'], (i) => { api.say(`Ini es krim ${['stroberi', 'cokelat', 'pisang', 'mangga'][i]}! Dingin dan manis. Habis makan, jangan lupa minum air putih, ya.`); api.food('🍦'); }) });
  K.box(2.2, 0.45, 0.7, '#a5764a', -9.5, 0.22, 5.5, K.scene); addSolid(-9.5, 5.5, 1.1, 0.35, 0, 0.45);
  addNpc({ id: 'kakek', name: 'Kakek Hasan', role: 'Kakek', x: [-9.5, 5.6], y: 0.35, face: Math.PI / 2, shirt: '#8a5a35', pants: '#2c2f3a', hair: '#c9c9c9', pitch: -0.4, sit: true,
    lines: ['Dulu waktu Kakek kecil, Kakek suka main layang-layang di pantai.', 'Rajin belajar, ya, Cu. Nanti jadi anak pintar.', 'Kakek suka duduk di sini, lihat air mancur. Adem.', 'Jangan lupa bantu Ayah dan Ibu di rumah, ya.'] });
  addNpc({ id: 'rudi', name: 'Om Rudi', role: 'Lari Pagi', x: [38, 6], face: 0, shirt: '#3fb25a', pants: '#2c2f3a', pitch: -0.25, wander: 12, lines: ['Hah, hah... Olahraga itu sehat! Ayo lari bersama!', 'Om lari keliling pulau setiap hari, lho.', 'Habis olahraga, minum air putih yang banyak, ya.'] });
  addNpc({ id: 'lia', name: 'Tante Lia', role: 'Lari Pagi', x: [-6, -38], face: 0, girl: true, shirt: '#ff8a2a', pants: '#3b4a6b', pitch: 0.1, wander: 12, lines: ['Ayo bergerak! Badan sehat, hati senang!', 'Tante suka lari pagi sambil lihat bunga-bunga.', 'Kamu sudah sarapan belum? Sarapan itu penting, lho.'] });
  addNpc({ id: 'ari', name: 'Ari', role: 'Teman', x: [-31, 4], face: 0, shirt: '#3a7cf5', pants: '#ffd23a', scale: 0.8, pitch: 0.4, wander: 5, talk: talkKid });
  addNpc({ id: 'lulu', name: 'Lulu', role: 'Teman', x: [31, 12], face: 0, girl: true, shirt: '#9a62e0', pants: '#ff8fc0', scale: 0.8, pitch: 0.45, wander: 5, talk: talkKid });
  addNpc({ id: 'karyo', name: 'Pak Karyo', role: 'Petani', x: [-31, -22], face: 0.8, shirt: '#8a5a35', pants: '#3b4a6b', hat: 'caping', pitch: -0.35, wander: 3, lines: ['Pak Karyo menanam jeruk dan wortel. Sayur dan buah bikin badan kuat!', 'Tanaman perlu air dan sinar matahari supaya tumbuh.', 'Kamu suka makan sayur? Wortel bagus untuk mata!'] });
  addNpc({ id: 'pos', name: 'Pak Pos', role: 'Tukang Pos', x: [16, 28], face: 0, shirt: '#ff8a2a', pants: '#1d2b53', hat: 'nelayan', pitch: -0.2, wander: 10, lines: ['Ada surat! Ada surat! Pak Pos mengantar surat ke seluruh pulau.', 'Kamu pernah menulis surat untuk Nenek? Coba, yuk!', 'Pak Pos naik sepeda setiap hari. Sehat!'] });
  { const g = PLACES.gedung.go; addNpc({ id: 'dokter', name: 'Dokter Hana', role: 'Dokter', x: [g[0] + 3, g[1] + 1.5], face: Math.atan2(-g[0], -g[1]) + Math.PI, girl: true, shirt: '#ffffff', pants: '#7cc8f5', pitch: 0.05,
    lines: ['Cuci tangan pakai sabun sebelum makan, ya!', 'Tidur yang cukup supaya badan sehat dan kuat.', 'Gosok gigi pagi dan malam sebelum tidur, ya!', 'Makan buah dan sayur setiap hari!'] }); }
  addNpc({ id: 'nelayan', name: 'Pak Darto', role: 'Nelayan', x: [-76, 44], face: -0.6, shirt: '#3a8fa8', pants: '#2c2f3a', hat: 'nelayan', pitch: -0.3, lines: ['Hari ini ikannya banyak! Kamu suka makan ikan?', 'Ikan itu sehat, bikin pintar.', 'Kapal besar di dermaga itu bisa kamu naiki, lho!'] });
}

/* =========================================================
   MULAI
   ========================================================= */
function buildTrampolines() {
  const p = PLACES.trampolin; const root = new THREE.Group(); K.scene.add(root);
  for (const [k, sx] of [[0, -7.5], [1, 7.5]]) {
    const x = p.x + sx, z = p.z, h = 3.4, top = 0.9;
    for (const ax of [-1, 1]) for (const az of [-1, 1]) K.box(0.3, top, 0.3, '#2c2f3a', x + ax * h, top / 2, z + az * h, root);
    const mat = K.box(h * 2 - 0.4, 0.12, h * 2 - 0.4, k ? '#3a7cf5' : '#9a62e0', x, top - 0.06, z, root);
    void mat; addSolid(x, z, h - 0.2, h - 0.2, top - 0.5, top, 0, { bounce: 15 });
    K.box(2.2, 0.02, 2.2, '#ffd23a', x, top + 0.01, z, root, false);
    // bantalan tepi (bisa dinaiki)
    for (const [ox, oz, w, d] of [[0, h, h * 2 + 0.6, 0.6], [0, -h, h * 2 + 0.6, 0.6], [h, 0, 0.6, h * 2 - 0.6], [-h, 0, 0.6, h * 2 - 0.6]]) {
      K.box(w, 0.25, d, k ? '#ff8a2a' : '#3fb25a', x + ox, top + 0.03, z + oz, root); addSolid(x + ox, z + oz, w / 2, d / 2, 0, top + 0.15);
    }
    addNpc({ id: `lompat${k}`, name: k ? 'Bima' : 'Rina', role: 'Suka melompat', x: [x + (k ? 1.2 : -1.2), z + 1], y: top, face: 0, girl: !k, shirt: k ? '#ffd23a' : '#ff8fc0', pants: '#3a7cf5', scale: 0.8, pitch: 0.4, bounce: true,
      lines: ['Hore! Lompat setinggi-tingginya! Tahan tombol lompat supaya makin tinggi!', 'Aku bisa lompat sampai ke langit! Ayo ikut!', 'Boing boing! Seru sekali!'] });
  }
  const sp = sign('🤸 Trampolin Raksasa', 5, { bg: '#ffd23a' }); sp.position.set(p.x, 6, p.z); DYN.add(sp);
}

export function initWorld(ctx) {
  K = ctx; K.scene.add(DYN);
  buildTower(); buildSchool(); buildCanteen(); buildOffice(); buildHouses(); buildMountain(); buildPierAndShip(); buildTrampolines(); buildTownNpcs();
  TD.traverse((m) => { if (m.isMesh) m.castShadow = false; });
  updateMovers(0, { pos: { x: 0, z: 0 }, y: 0, onGround: false }, 0);
}
