// Pulau Kebun ala Roblox: tiap pemain punya kavling, membangun bebas di grid, tombol aksi muncul saat mendekat.
// Aturan (tanah, bibit, panen, katalog bangun, harga) ada di farm-state.js; di sini dunia 3D, HUD, NPC, perahu, dan sinkron kavling.
import * as THREE from '../lib/three.module.min.js';
import * as W from './world.js';
import {
  CROPS, ITEMS, KAV, SECTOR, DAY_SEC, normalizeFarm, size, center, canPlace, placeItem, pickUp, refundOf, sellBack, ripe, stage, growFarm, promptFor, workItem,
  buySeed, sellHarvest, buyProduce, buyLand, landPrice, canSellLand, takeLand, putLand, landItems,
} from './farm-state.js';

export const HOME = [-28, -88], LANDING = [0, -282]; // dermaga perahu di Pulau Balok dan di Pulau Kebun
const CX = W.FARM.x, CZ = W.FARM.z; // alun-alun desa di tengah pulau
// 12 kavling mengelilingi alun-alun; celah di utara untuk jalan dermaga
export const KAVS = Array.from({ length: 12 }, (_, i) => {
  const a = ((15 + i * 30) * Math.PI) / 180, cx = CX + Math.sin(a) * 66, cz = CZ + Math.cos(a) * 66, d = Math.hypot(cx - CX, cz - CZ);
  return { cx, cz, ox: cx - KAV / 2, oz: cz - KAV / 2, front: [cx + ((CX - cx) / d) * 14.5, cz + ((CZ - cz) / d) * 14.5] };
});
// zona aman tetap (tidak ikut rotasi zona aman tempat belajar)
export const SAFE_SPOTS = [{ x: 0, z: -302, r: 12, name: 'Dermaga Aman' }, { x: CX, z: CZ, r: 18, name: 'Alun-alun Aman' }];
export const ZSPAWN = [60, 120, 180, 240, 300].map((deg) => [CX + Math.sin((deg * Math.PI) / 180) * 100, CZ + Math.cos((deg * Math.PI) / 180) * 100]);
const myKav = () => { const k = farm().kav; return Number.isInteger(k) ? KAVS[k] : null; };
export const SPOTS = {
  alun: { x: CX, z: CZ, emoji: '⛲', name: 'Alun-alun Desa', go: [CX, CZ + 12] },
  toko: { x: -13, z: -391, emoji: '🧺', name: 'Toko Bibit Bu Tini', go: [-13, -386] },
  pasar: { x: 13, z: -391, emoji: '🏪', name: 'Pasar Bu Mira', go: [13, -386] },
  balai: { x: -13, z: -414, emoji: '📜', name: 'Balai Desa Pak Lurah', go: [-13, -406] },
  kavling: { emoji: '🏡', name: 'Kavling Milikmu', get x() { return myKav()?.cx ?? CX; }, get z() { return myKav()?.cz ?? CZ; }, get go() { return myKav()?.front ?? [CX, CZ + 12]; } },
  perahu: { x: 0, z: -282, emoji: '🚣', name: 'Perahu ke Pulau Balok', go: LANDING },
};
export const inSafe = (x, z) => SAFE_SPOTS.some((s) => Math.hypot(x - s.x, z - s.z) < s.r);
export const sailing = () => !!trip;
export const onFarm = (x, z) => W.islandOf(x, z) === 'kebun';
export const near = (x, z) => onFarm(x, z) || Math.hypot(x - LANDING[0], z - LANDING[1]) < 220; // pulau perlu digambar
// scenery = bagian diam pulau, digabung staticBatch() di game.js; root = kavling, perahu, bayangan bangun
export let scenery = null;
let K, api, root, dockRoot, boat, trip = null, lastSave = null, tickSave = 0, viewT = 0, wasHere = false, marketListings = [], hello = false;
let seed = 'wortel', prompt = null;
const others = new Map(); // kav -> { name, lands, items } milik pemain lain (dari server)
const views = [];
const esc = (t) => String(t).replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);
const dist = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1]);
const playerAt = () => [api.player.pos.x, api.player.pos.z];
const boatAt = (farmSide) => (farmSide ? [LANDING[0] + 4.5, LANDING[1] + 17] : [HOME[0] + 4.5, HOME[1] - 13]);
function farm() {
  const s = api.save();
  if (!s.farm || s.farm.version !== 3) s.farm = normalizeFarm(s.farm);
  return s.farm;
}

/* ---------------- HUD (DOM) ---------------- */
// tombol aksi: muncul sendiri saat dekat petak/rumah, di kolom kanan bersama tombol Bicara (F/Enter juga bisa)
const actBtn = document.createElement('button'); actBtn.id = 'farmAct'; actBtn.className = 'chunky leaf'; actBtn.hidden = true;
actBtn.innerHTML = '<span class="e"></span><span class="t"><b></b><small></small></span>';
// hotbar: bibit + Bangun + Tas; saat Mode Bangun berganti jadi katalog
const bar = document.createElement('div'); bar.id = 'farmBar'; bar.hidden = true;
const boatButton = document.createElement('button'); boatButton.id = 'farmBoat'; boatButton.className = 'chunky sun'; boatButton.hidden = true;
const tripLabel = document.createElement('div'); tripLabel.id = 'farmTrip'; tripLabel.hidden = true;
const market = document.createElement('section'); market.id = 'farmMarket'; market.hidden = true;
market.innerHTML = `<div class="market-card"><header><div><small>PASAR PULAU</small><h2>Jual beli bersama</h2></div><button class="chunky" data-close>✕</button></header><p id="marketStatus"></p>
<div class="market-create"><select id="marketKind"><option value="produce">Hasil panen</option><option value="land">Tanah beserta isinya</option><option value="item">Barang di tas</option></select><select id="marketItem" aria-label="Barang"></select>
<input id="marketQty" type="number" min="1" max="99" value="1" aria-label="Jumlah"><input id="marketPrice" type="number" min="1" max="9999" value="8" aria-label="Harga total"><button class="chunky leaf" id="marketSell">Pasang jual</button></div>
<div id="marketList" class="market-list"></div></div>`;
document.body.append(bar, boatButton, tripLabel, market);
const $m = (s) => market.querySelector(s);
function setAct(p) {
  prompt = p; actBtn.hidden = !p; if (!p) return;
  actBtn.querySelector('.e').textContent = p.emoji; actBtn.querySelector('b').textContent = p.label; actBtn.querySelector('small').textContent = p.sub || '';
  actBtn.classList.toggle('sun', p.act === 'tunggu' || p.act === 'beli' || p.act === 'tolak'); actBtn.classList.toggle('leaf', !actBtn.classList.contains('sun'));
}
actBtn.onclick = () => act();
let barKey = '';
function renderBar(force = false) {
  const f = farm(), key = JSON.stringify([build.on, build.kind, build.del, seed, f.seeds, f.inv, f.day, api.save().coins]);
  if (!force && key === barKey) return; barKey = key;
  if (build.on) {
    const ids = Object.keys(ITEMS);
    bar.innerHTML = ids.map((id) => `<button class="chunky slot${build.kind === id && !build.del ? ' selected' : ''}" data-item="${id}"><span>${ITEMS[id].emoji}</span><small>${f.inv[id] ? `tas ×${f.inv[id]}` : `${ITEMS[id].price}🪙`}</small></button>`).join('')
      + `<button class="chunky slot tool" data-rot><span>🔄</span><small>Putar</small></button><button class="chunky slot tool${build.del ? ' selected' : ''}" data-del><span>📦</span><small>Simpan</small></button><button class="chunky slot tool sun" data-done><span>✔️</span><small>Selesai</small></button>`;
  } else {
    const have = Object.keys(CROPS).filter((id) => f.seeds[id] > 0);
    bar.innerHTML = `<span class="day">☀️ Hari ${f.day}</span><button class="chunky slot sun" data-build><span>🔨</span><small>Bangun</small></button>`
      + (have.length ? have.map((id) => `<button class="chunky slot${id === seed ? ' selected' : ''}" data-seed="${id}"><span>${CROPS[id].emoji}</span><small>×${f.seeds[id]}</small></button>`).join('') : '<span class="hint">Bibit di Bu Tini 🧺</span>')
      + '<button class="chunky slot" data-bag><span>🎒</span><small>Tas</small></button>';
  }
}
bar.addEventListener('click', (e) => {
  const b = e.target.closest('button'); if (!b) return; api.tap();
  if (b.dataset.seed) seed = b.dataset.seed;
  else if (b.dataset.item) { build.kind = b.dataset.item; build.del = false; makeGhost(); }
  else if ('rot' in b.dataset) { build.rot = (build.rot + 1) & 3; makeGhost(); }
  else if ('del' in b.dataset) { build.del = !build.del; if (build.del) api.say('Ketuk barang di kavlingmu untuk menyimpannya ke tas.'); }
  else if ('done' in b.dataset) endBuild();
  else if ('build' in b.dataset) startBuild();
  else if ('bag' in b.dataset) bag();
  renderBar(true);
});

// hasil aksi dibacakan (anak belum lancar membaca); yang bicara = NPC terakhir, atau Kak Rara
function notify(r, who = null) {
  api.say(r.message, who);
  if (r.ok) { api.persist(); api.vitals(); api.good(); refreshMine(); renderBar(true); }
  return r;
}

/* ---------------- bentuk 3D ---------------- */
// bentuk membulat seperti Pulau Kota: geometri bersama (userData.batch) sehingga yang diam ikut digabung staticBatch()
const GEO = {};
function geo(k) {
  if (k === 'box') return K.BOX;
  if (GEO[k]) return GEO[k];
  const g = {
    cyl: () => new THREE.CylinderGeometry(0.5, 0.5, 1, 14), cone: () => new THREE.ConeGeometry(0.5, 1, 14), down: () => new THREE.ConeGeometry(0.5, 1, 14).rotateX(Math.PI), sph: () => new THREE.SphereGeometry(0.5, 10, 8),
    // atap pelana: prisma segitiga, bubungan searah x, tinggi 1 (alas -0.5, puncak 0.5)
    gable: () => new THREE.CylinderGeometry(0.5, 0.5, 1, 3).rotateX(-Math.PI / 2).scale(1 / 0.866, 1 / 0.75, 1).translate(0, -1 / 6, 0).rotateY(Math.PI / 2).toNonIndexed(),
  }[k]();
  g.computeVertexNormals(); g.userData.batch = true; return (GEO[k] = g);
}
// S(): alas benda di y0 (sama dengan SL() di city.js)
function S(k, sx, sy, sz, color, x, y0, z, parent = scenery) {
  const m = new THREE.Mesh(geo(k), typeof color === 'string' ? K.mat(color) : color); m.scale.set(sx, sy, sz); m.position.set(x, y0 + sy / 2, z);
  m.castShadow = true; m.receiveShadow = true; parent.add(m); return m;
}
function label(t, x, y, z, w = 7, parent = scenery) { const s = W.kit.sign(t, w); s.position.set(x, y, z); parent.add(s); return s; }
function block(w, h, d, c, x, y, z, parent = scenery) { return K.box(w, h, d, c, x, y, z, parent); }
function clickable(o, cb) { o.userData.tap = cb; K.tapRoots.push(o); }
function treeR(x, z, s = 1, col = '#4c9750') {
  S('cyl', 0.5 * s, 2.2 * s, 0.5 * s, '#976d44', x, 0, z); S('sph', 3 * s, 2.6 * s, 3 * s, col, x, 1.8 * s, z); S('sph', 1.7 * s, 1.5 * s, 1.7 * s, '#68b85d', x + 0.6 * s, 3.5 * s, z - 0.3 * s);
  W.kit.addSolid(x, z, 0.35 * s, 0.35 * s, 0, 2);
}
const parasol = (x, z, col) => { S('cyl', 0.16, 3.4, 0.16, '#eee4c4', x, 0, z); S('cone', 4.2, 1.1, 4.2, col, x, 3.2, z); };

// bagian tiap barang dalam koordinat barang (pusat 0,0; lebar w searah x, d searah z; alas y = 0): [geo, sx, sy, sz, warna, x, y0, z]
const FRUIT = {
  wortel: ['down', 0.42, 0.8, 0.42, 0.05], kentang: ['sph', 0.6, 0.42, 0.5, 0.05], tomat: ['sph', 0.5, 0.46, 0.5, 0.75], cabai: ['down', 0.22, 0.65, 0.22, 0.7],
  jagung: ['cyl', 0.32, 0.9, 0.32, 0.9], stroberi: ['down', 0.42, 0.5, 0.42, 0.45], labu: ['sph', 0.95, 0.62, 0.95, 0.05], semangka: ['sph', 1.05, 0.85, 1.05, 0.05],
};
const FLOWERS = ['#ff8fab', '#ffd23a', '#ffffff', '#b27cf0'];
function partsOf(it) {
  const [w, d] = [ITEMS[it.k].w, ITEMS[it.k].d], P = [];
  const p = (...a) => P.push(a);
  switch (it.k) {
    case 'petak': {
      p('box', w - 0.1, 0.2, d - 0.1, it.watered ? '#715036' : '#b88150', 0, 0, 0);
      const st = stage(it), c = CROPS[it.crop]; if (!st) break;
      const g = st === 1 ? 0.5 : st === 2 ? 0.8 : 1;
      p('cyl', 0.14, 0.9 * g * (['jagung', 'cabai', 'tomat'].includes(it.crop) ? 1.8 : 1), 0.14, '#3f923f', 0, 0.2, 0);
      p('sph', 1.1 * g, 0.45 * g, 1.1 * g, '#4ba54b', 0, 0.2, 0);
      if (st >= 3) { const [k, sx, sy, sz, y0] = FRUIT[it.crop], q = st === 4 ? 1 : 0.6; p(k, sx * q, sy * q, sz * q, c.color, 0.25, 0.2 + y0, 0.2); }
      if (st === 4) p('sph', 0.35, 0.35, 0.35, '#fff27a', 0, 2.2, 0); // bintang kecil: siap panen
      break;
    }
    case 'jalan': p('box', w - 0.05, 0.06, d - 0.05, '#d8c49a', 0, 0, 0); p('cyl', 0.9, 0.08, 0.8, '#c9ad82', -0.4, 0, -0.35); p('cyl', 0.8, 0.08, 0.7, '#b9a07a', 0.45, 0, 0.4); break;
    case 'pagar': for (const x of [-0.9, 0.9]) p('cyl', 0.2, 1.1, 0.2, '#eee4c4', x, 0, 0); for (const y of [0.4, 0.8]) p('box', 2, 0.1, 0.08, '#eee4c4', 0, y, 0); break;
    case 'bunga': p('cyl', 0.08, 0.5, 0.08, '#3f923f', 0, 0, 0); p('sph', 0.45, 0.35, 0.45, FLOWERS[(it.x + it.z) % 4], 0, 0.45, 0); p('sph', 0.5, 0.2, 0.5, '#4ba54b', 0, 0, 0); break;
    case 'pohon': p('cyl', 0.45, 2, 0.45, '#976d44', 0, 0, 0); p('sph', 2.4, 2.1, 2.4, '#4c9750', 0, 1.6, 0); p('sph', 1.4, 1.2, 1.4, '#68b85d', 0.4, 3.1, -0.2); break;
    case 'bangku': p('box', 1.8, 0.12, 0.55, '#c98a4b', 0, 0.42, 0); p('box', 1.8, 0.45, 0.1, '#c98a4b', 0, 0.55, -0.25); for (const x of [-0.75, 0.75]) p('box', 0.12, 0.42, 0.45, '#8a5a35', x, 0, 0); break;
    case 'lampu': p('cyl', 0.16, 2.4, 0.16, '#594b3b', 0, 0, 0); p('sph', 0.6, 0.6, 0.6, '#ffd96a', 0, 2.3, 0); p('cone', 0.85, 0.4, 0.85, '#594b3b', 0, 2.85, 0); break;
    case 'ayunan':
      for (const x of [-1.35, 1.35]) p('cyl', 0.18, 2.4, 0.18, '#d77c54', x, 0, 0);
      p('box', 2.9, 0.14, 0.14, '#d77c54', 0, 2.35, 0); for (const x of [-0.35, 0.35]) p('box', 0.04, 1.7, 0.04, '#eee4c4', x, 0.65, 0); p('box', 0.9, 0.08, 0.45, '#5cc2c7', 0, 0.6, 0); break;
    case 'kolam':
      p('cyl', 3.4, 0.1, 3.4, '#61b6c8', 0, 0, 0); p('sph', 0.6, 0.15, 0.6, '#4ba54b', 0.6, 0.06, 0.4); p('sph', 0.4, 0.12, 0.25, '#ff912b', -0.5, 0.06, -0.3);
      for (let i = 0; i < 10; i++) { const a = (i / 10) * Math.PI * 2; p('sph', 0.8, 0.4, 0.7, i % 2 ? '#b6b3a8' : '#a2aaa4', Math.cos(a) * 1.75, -0.05, Math.sin(a) * 1.75); }
      break;
    case 'sumur': p('cyl', 1.8, 0.9, 1.8, '#a2aaa4', 0, 0, 0); p('cyl', 1.4, 0.06, 1.4, '#5cb7d7', 0, 0.86, 0); for (const x of [-0.8, 0.8]) p('cyl', 0.14, 2.3, 0.14, '#8a5a35', x, 0.8, 0); p('gable', 2.2, 0.7, 1.6, '#d77c54', 0, 3, 0); break;
    case 'gudang': p('box', 3.8, 3, 3.8, '#c0504d', 0, 0, 0); p('gable', 4.2, 1.6, 4.3, '#80563f', 0, 3, 0); p('box', 1.6, 2.2, 0.1, '#ffffff', 0, 0, 1.92); break;
    case 'rumah':
      p('box', 5.6, 3.2, 5.6, '#fff0ce', 0, 0, 0); p('gable', 6.2, 2.2, 6.4, '#d97a53', 0, 3.2, 0); p('box', 0.9, 1.6, 0.9, '#b9644a', 1.6, 4, -0.8);
      p('box', 1.2, 2.2, 0.1, '#8a5a35', 0, 0, 2.82); for (const x of [-1.7, 1.7]) { p('box', 1.1, 1, 0.1, '#9fd3f0', x, 1.4, 2.82); p('box', 1.1, 0.3, 0.4, '#8a5a35', x, 0.9, 3); p('sph', 0.4, 0.3, 0.4, '#ff8fab', x, 1.15, 3); }
      break;
  }
  return P;
}
// tabrakan: rumah, gudang, sumur, pohon, pagar, bangku dan kolam tidak bisa ditembus
const SOLID = { rumah: 2.8, gudang: 1.9, sumur: 0.9, pohon: 0.3, pagar: 0, bangku: 0, kolam: 0 };

/* ---------------- kavling: digambar sebagai beberapa InstancedMesh saja ---------------- */
const tmpM = new THREE.Matrix4(), tmpQ = new THREE.Quaternion(), tmpP = new THREE.Vector3(), tmpS = new THREE.Vector3(), tmpC = new THREE.Color(), UP = new THREE.Vector3(0, 1, 0);
const signs = new Map(); // teks -> sprite contoh (kanvas dibuat sekali)
function signAt(text, x, y, z, w, parent) { if (!signs.has(text)) signs.set(text, W.kit.sign(text, w)); const s = signs.get(text).clone(); s.position.set(x, y, z); parent.add(s); return s; }
class KavView {
  constructor(i) { this.i = i; this.k = KAVS[i]; this.group = new THREE.Group(); root.add(this.group); this.meshes = []; this.sprites = []; this.solids = new Map(); this.sig = null; }
  set(plot, mine) {
    const sig = JSON.stringify([mine, plot?.name, plot?.lands, (plot?.items || []).map((it) => [it.k, it.x, it.z, it.r, it.crop, it.watered, stage(it)])]);
    if (sig === this.sig) return; this.sig = sig; this.plot = plot; this.mine = mine; this.rebuild();
  }
  rebuild() {
    const { ox, oz, front } = this.k, plot = this.plot, lands = plot?.lands || [], items = plot?.items || [], mine = this.mine;
    for (const m of this.meshes) { this.group.remove(m); m.dispose(); const t = K.tapRoots.indexOf(m); if (t >= 0) K.tapRoots.splice(t, 1); }
    for (const s of this.sprites) this.group.remove(s);
    this.meshes = []; this.sprites = [];
    const parts = []; // [geo, matrix, warna, indeks barang]
    for (let s = 0; s < 9; s++) {
      const x = ox + (s % 3) * SECTOR + SECTOR / 2, z = oz + Math.floor(s / 3) * SECTOR + SECTOR / 2;
      const col = lands[s] ? (mine ? '#9bd77f' : '#8ccc72') : plot ? (mine ? '#d9c08f' : '#a8c98c') : '#a3c487';
      parts.push(['box', tmpM.compose(tmpP.set(x, 0.02, z), tmpQ.identity(), tmpS.set(SECTOR - 0.25, 0.08, SECTOR - 0.25)).clone(), col, -1]);
    }
    const want = new Set();
    items.forEach((it, idx) => {
      const [cx, cz] = center(it), wx = ox + cx, wz = oz + cz, rot = (-(it.r & 3) * Math.PI) / 2; tmpQ.setFromAxisAngle(UP, rot);
      for (const [g, sx, sy, sz, col, lx, y0, lz] of partsOf(it)) {
        tmpP.set(lx, y0 + sy / 2, lz).applyQuaternion(tmpQ).add(new THREE.Vector3(wx, 0.06, wz));
        parts.push([g, new THREE.Matrix4().compose(tmpP, tmpQ, tmpS.set(sx, sy, sz)), col, idx]);
      }
      if (it.k in SOLID) { const [w, d] = size(it), key = `${it.k}@${it.x},${it.z},${it.r}`; want.add(key); this.solidFor(key, wx, wz, w, d, it.k); }
    });
    for (const [key, s] of this.solids) s.on = want.has(key);
    const byGeo = new Map(); for (const p of parts) { if (!byGeo.has(p[0])) byGeo.set(p[0], []); byGeo.get(p[0]).push(p); }
    for (const [g, list] of byGeo) {
      const im = new THREE.InstancedMesh(geo(g), K.INST_MAT, list.length), owner = list.map((p) => p[3]);
      list.forEach((p, n) => { im.setMatrixAt(n, p[1]); im.setColorAt(n, tmpC.set(p[2])); });
      im.castShadow = g !== 'box'; im.receiveShadow = true; im.computeBoundingSphere(); im.userData.dynamic = true;
      im.userData.tap = (_t, hit) => onKavTap(this, owner[hit?.instanceId] ?? -1, hit?.point);
      this.group.add(im); this.meshes.push(im); K.tapRoots.push(im);
    }
    // tanah coklat = belum dibeli; cukup satu keterangan di papan nama supaya layar tidak penuh papan
    const name = plot ? (mine ? (lands.every(Boolean) ? '🏡 Kavlingmu' : '🏡 Kavlingmu · tanah coklat dijual di Pak Lurah') : `🏡 Kebun ${plot.name}`) : '🌱 Kavling kosong';
    this.sprites.push(signAt(name, front[0], 2.6, front[1], mine && !lands.every(Boolean) ? 11 : 7, this.group));
  }
  solidFor(key, wx, wz, w, d, k) {
    if (this.solids.has(key)) return;
    const pad = SOLID[k], hx = pad ? Math.min(w / 2, pad) : w / 2 - 0.1, hz = pad ? Math.min(d / 2, pad) : d / 2 - 0.1;
    this.solids.set(key, W.kit.addSolid(wx, wz, hx, hz, 0, k === 'kolam' ? 0.05 : k === 'rumah' || k === 'gudang' ? 4 : 1.1));
  }
}
function myPlot() { const f = farm(); return { name: api.name(), lands: f.lands, items: f.items }; }
export const kavPlot = (i) => (i === farm().kav ? myPlot() : others.get(i) || null); // isi kavling yang sedang digambar (untuk peta/uji)
function refreshViews() {
  const mine = farm().kav;
  views.forEach((v, i) => v.set(i === mine ? myPlot() : others.get(i) || null, i === mine));
}
const refreshMine = () => { const k = farm().kav; if (Number.isInteger(k)) views[k]?.set(myPlot(), true); };
function onKavTap(view, idx, point) {
  const f = farm(), it = view.mine ? f.items[idx] : null;
  if (build.on && view.mine) { if (build.del) { if (it) notify(pickUp(f, idx)); } else if (point) groundTap(point.x, point.z); return; }
  if (!it) { // alas tanah: berjalan ke sana (seperti mengetuk tanah biasa)
    if (point && !api.mobile()) api.walkTo(point.x, point.z);
    if (!view.mine) api.toast(view.plot ? `🏡 Kebun ${view.plot.name}` : '🌱 Kavling ini belum ada pemiliknya');
    return;
  }
  const [cx, cz] = center(it), wx = view.k.ox + cx, wz = view.k.oz + cz, p = promptFor(f, it, seed);
  if (!p) return api.toast(`${ITEMS[it.k].emoji} ${ITEMS[it.k].name}`);
  approach(wx, wz, () => doAct(it, p), 2.5 + Math.max(...size(it)) / 2);
}

/* ---------------- tombol aksi & Mode Bangun ---------------- */
const build = { on: false, kind: 'petak', rot: 0, del: false, pin: null, pinAt: null, cell: null, ok: false, why: '', ghost: null, prevCam: null };
const ghostOk = new THREE.MeshBasicMaterial({ color: '#59d36b', transparent: true, opacity: 0.55, depthWrite: false });
const ghostBad = new THREE.MeshBasicMaterial({ color: '#ef5350', transparent: true, opacity: 0.55, depthWrite: false });
function makeGhost() {
  if (build.ghost) { K.scene.remove(build.ghost); build.ghost = null; }
  if (!build.on || build.del) return;
  const g = new THREE.Group(); g.userData.dynamic = true; const it = { k: build.kind, x: 0, z: 0, r: build.rot }, [w, d] = size(it);
  const plate = new THREE.Mesh(K.BOX, ghostOk); plate.scale.set(w, 0.06, d); plate.position.y = 0.08; g.add(plate);
  const inner = new THREE.Group(); inner.rotation.y = (-build.rot * Math.PI) / 2; g.add(inner);
  for (const [k, sx, sy, sz, , lx, y0, lz] of partsOf({ ...it, crop: null })) { const m = new THREE.Mesh(geo(k), ghostOk); m.scale.set(sx, sy, sz); m.position.set(lx, y0 + sy / 2 + 0.06, lz); inner.add(m); }
  g.userData.plate = plate; g.userData.parts = inner; build.ghost = g; K.scene.add(g);
}
function startBuild() {
  const f = farm(), kv = myKav();
  if (!kv) return api.say('Kavlingmu belum siap. Pastikan tersambung ke WiFi rumah, ya.');
  if (!f.lands.some(Boolean)) return api.say('Beli tanah dulu di Pak Lurah, baru bisa membangun.');
  if (dist(playerAt(), [kv.cx, kv.cz]) > 26) { api.say('Ayo ke kavlingmu dulu, ikuti jalannya!'); api.walkTo(...kv.front); return; }
  build.on = true; build.del = false; build.pin = null; build.prevCam = api.cam('jauh'); makeGhost(); renderBar(true);
  api.say('Mode Bangun! Pilih barang di bawah, jalan atau ketuk tanah untuk memilih tempat, lalu tekan Taruh.');
}
function endBuild() { build.on = false; build.del = false; makeGhost(); if (build.prevCam) api.cam(build.prevCam); setAct(null); renderBar(true); }
// ketuk tanah saat Mode Bangun: bayangan pindah ke sana (dipakai game.js sebelum berjalan ke titik ketukan)
export function groundTap(x, z) {
  const kv = myKav(); if (!build.on || build.del || !kv) return false;
  if (x < kv.ox - 1 || z < kv.oz - 1 || x > kv.ox + KAV + 1 || z > kv.oz + KAV + 1) return false;
  build.pin = [x, z]; build.pinAt = playerAt(); return true;
}
function buildTick() {
  const kv = myKav(), g = build.ghost; if (!kv) return endBuild();
  if (build.del) return setAct({ act: 'tunggu', emoji: '📦', label: 'Ketuk barang', sub: 'untuk disimpan ke tas' });
  if (build.pin && dist(playerAt(), build.pinAt) > 0.6) build.pin = null; // berjalan lagi: bayangan ikut ke depan pemain
  const it = { k: build.kind, x: 0, z: 0, r: build.rot }, [w, d] = size(it), fa = api.player.facing;
  const [px, pz] = build.pin || [api.player.pos.x + Math.sin(fa) * (2 + Math.max(w, d) / 2), api.player.pos.z + Math.cos(fa) * (2 + Math.max(w, d) / 2)];
  const gx = Math.round(px - kv.ox - w / 2), gz = Math.round(pz - kv.oz - d / 2), f = farm(), check = canPlace(f, build.kind, gx, gz, build.rot);
  build.cell = [gx, gz]; build.ok = check.ok; build.why = check.message;
  g.position.set(kv.ox + gx + w / 2, 0.02, kv.oz + gz + d / 2);
  const m = check.ok ? ghostOk : ghostBad; g.userData.plate.material = m; for (const c of g.userData.parts.children) c.material = m;
  const fromBag = f.inv[build.kind] > 0, c = ITEMS[build.kind];
  setAct(check.ok ? { act: 'taruh', emoji: c.emoji, label: `Taruh ${c.name}`, sub: fromBag ? 'dari tas' : `${c.price} koin` } : { act: 'tolak', emoji: '🚫', label: 'Tidak bisa di sini', sub: check.message.replace(/\.$/, '') });
}
function nearestPrompt() {
  const kv = myKav(); if (!kv) return null;
  const f = farm(), [px, pz] = playerAt(); let best = null, bd = 1.4;
  for (const it of f.items) {
    const [w, d] = size(it), x0 = kv.ox + it.x, z0 = kv.oz + it.z;
    const dd = Math.hypot(Math.max(x0 - px, 0, px - x0 - w), Math.max(z0 - pz, 0, pz - z0 - d)); if (dd >= bd) continue;
    const p = promptFor(f, it, seed); if (p) { best = { ...p, it }; bd = dd; }
  }
  return best;
}
function doAct(it, p) {
  const f = farm();
  if (p.act === 'tidur') return sleep();
  if (p.act === 'tanam') seed = p.seed;
  notify(workItem(f, it, p.act, p.seed));
}
// tombol aksi atau F/Enter (dipanggil game.js); true = sudah dipakai
export function act() {
  if (!prompt || !api || !api.active() || api.busy()) return false;
  if (build.on) {
    if (prompt.act === 'taruh') { const r = notify(placeItem(api.save(), build.kind, ...build.cell, build.rot)); if (r.ok && build.kind === 'rumah' && !farm().items.some((i) => i.k === 'rumah' && i !== r.item)) api.say('Rumahmu jadi! Dekati rumah lalu tekan Tidur untuk berganti hari.'); }
    else if (prompt.act === 'tolak') api.say(build.why);
    return true;
  }
  const p = prompt; doAct(p.it, p); return true;
}

/* ---------------- warga kebun ---------------- */
const PEOPLE = {
  tini: { name: 'Bu Tini', role: 'Toko Bibit', x: [-13, -393.6], shirt: '#e88d6b', pants: '#6c5947', girl: true, hat: 'caping', pitch: 0.15 },
  mira: { name: 'Bu Mira', role: 'Pedagang Pasar', x: [13, -393.6], shirt: '#c6698f', pants: '#6c5947', girl: true, pitch: 0.1 },
  lurah: { name: 'Pak Lurah', role: 'Balai Desa', x: [-13, -408], shirt: '#668ebd', pants: '#2c2f3a', pitch: -0.3 },
  tukang: { name: 'Pak Darto', role: 'Tukang Bangunan', x: [13, -408], shirt: '#9b7653', pants: '#3b4a6b', hat: 'caping', pitch: -0.2 },
};
const WANDERERS = [
  { id: 'kebun_nelayan', name: 'Pak Usman', role: 'Penjaga Dermaga', x: [6, -300], wander: 5, shirt: '#4f86c6', hat: 'nelayan', lines: ['Selamat datang! Perahu ini bisa membawamu pulang kapan saja.', 'Kalau malam, berdiri di lingkaran hijau dermaga ini. Zombie tidak bisa masuk!', 'Ikuti jalan lurus ke alun-alun. Kavling para petani ada di sekelilingnya.'] },
  { id: 'kebun_dewi', name: 'Dewi', role: 'Anak Petani', x: [-5, -398], wander: 5, girl: true, scale: 0.8, shirt: '#ff8fc0', lines: ['Tanaman harus disiram supaya tumbuh!', 'Wortel paling cepat panen. Semangka paling lama, tapi paling mahal!', 'Aku suka main ayunan di kavling temanku.'] },
  { id: 'kebun_tono', name: 'Pak Tono', role: 'Petani', x: [0, -428], wander: 6, shirt: '#8cad62', hat: 'caping', lines: ['Mulai dari beli tanah di Pak Lurah, lalu beli bibit di Bu Tini.', 'Tekan Bangun, pilih Petak Tanam, lalu taruh di tanahmu. Gampang!', 'Kalau dekat petak, tombol Tanam, Siram, dan Panen muncul sendiri.'] },
  { id: 'kebun_rina', name: 'Kak Rina', role: 'Pembeli', x: [20, -400], wander: 4, girl: true, shirt: '#e2b952', lines: ['Aku suka beli tomat di Bu Mira.', 'Coba lihat kebun teman-temanmu. Ada yang punya kolam ikan!', 'Di pasar pemain, kamu bisa jual tanah lengkap dengan isinya.'] },
];
// malam: warga pulang (disembunyikan world.js) dan kios ikut tutup
const whenOpen = (who, fn) => () => { if (api.night()) api.say('Tokonya sudah tutup. Buka lagi besok pagi, ya!', who); else fn(); };
const ask = (who, text, opts, cb) => api.ask(who, text, opts, cb); // who = warga yang bicara, null = Kak Rara
function bag() {
  const f = farm(), crops = Object.entries(CROPS).filter(([id]) => f.harvest[id]).map(([id, c]) => `${c.emoji}${f.harvest[id]}`).join(' ') || 'kosong';
  const stuff = Object.entries(f.inv).map(([id, n]) => `${ITEMS[id].emoji}${n}`).join(' ') || 'kosong';
  ask(null, `Koin ${api.save().coins || 0}. Tanah ${f.lands.filter(Boolean).length}/9. Panen: ${crops}. Barang: ${stuff}.`, ['📖 Ide membangun', 'Tutup'], (i) => {
    if (i === 0) ask(null, 'Coba: beli tanah, taruh Petak Tanam dan tanam wortel. Lalu bangun rumah, sumur, dan jalan batu. Tambah pagar, bunga, kolam, dan ayunan supaya kebunmu cantik!', ['Siap!'], () => {});
  });
}
function seedShop() {
  const ids = Object.keys(CROPS), who = PEOPLE.tini;
  ask(who, `Mau bibit apa? Koinmu ${api.save().coins || 0}.`, [...ids.map((id) => `${CROPS[id].emoji} ${CROPS[id].name} · ${CROPS[id].seed} koin`), 'Selesai'], (i) => {
    if (i < ids.length) { const r = notify(buySeed(api.save(), ids[i]), who); if (r.ok) seed = ids[i]; }
  });
}
function npcMarket() {
  const ids = Object.keys(CROPS), f = farm(), value = ids.reduce((n, id) => n + f.harvest[id] * CROPS[id].sell, 0), who = PEOPLE.mira;
  ask(who, `Nilai seluruh panenmu ${value} koin. Mau apa hari ini?`, ['🧺 Jual semua panen', '🛒 Beli hasil panen', '🤝 Pasar antar-pemain', 'Nanti'], (i) => {
    if (i === 0) notify(sellHarvest(api.save()), who);
    if (i === 1) buyProduceMenu();
    if (i === 2) openMarket();
  });
}
function buyProduceMenu() {
  const ids = Object.keys(CROPS), who = PEOPLE.mira;
  ask(who, `Koinmu ${api.save().coins || 0}. Hasil beli masuk ke tas panen.`, ids.map((id) => `${CROPS[id].emoji} ${CROPS[id].name} · ${CROPS[id].buy} koin`), (i) => {
    if (i < ids.length) notify(buyProduce(api.save(), ids[i]), who);
  });
}
function landOffice() {
  const price = landPrice(farm()), who = PEOPLE.lurah;
  ask(who, `Tanah berikutnya di kavlingmu ${price} koin. Koinmu ${api.save().coins || 0}.`, [`📜 Beli tanah · ${price} koin`, '📍 Antar ke kavlingku', '🤝 Jual tanah ke pemain', 'Nanti'], (i) => {
    if (i === 0) notify(buyLand(api.save()), who);
    if (i === 1) { const kv = myKav(); if (kv) { api.teleport(...kv.front); api.say('Ini kavlingmu! Tanah hijau sudah milikmu.'); } else api.say('Kavlingmu belum siap. Sambungkan ke WiFi rumah dulu, ya.', who); }
    if (i === 2) openMarket('land');
  });
}
function builder() {
  const who = PEOPLE.tukang, ids = Object.keys(farm().inv);
  ask(who, 'Membangun itu gampang! Tekan 🔨 Bangun di bawah layar saat berada di kavlingmu. Barang yang disimpan ke tas bisa ditaruh lagi.', ['🔨 Mulai membangun', '💰 Jual barang di tas', '🤝 Jual barang ke pemain', 'Nanti'], (i) => {
    if (i === 0) startBuild();
    if (i === 1) {
      if (!ids.length) return api.say('Tasmu masih kosong. Simpan barang dulu lewat Mode Bangun.', who);
      ask(who, 'Barang mana yang mau dijual? Kamu dapat setengah harga.', [...ids.map((id) => `${ITEMS[id].emoji} ${ITEMS[id].name} ×${farm().inv[id]} · +${refundOf(id)} koin`), 'Tidak jadi'], (j) => { if (j < ids.length) notify(sellBack(api.save(), ids[j]), who); });
    }
    if (i === 2) openMarket('item');
  });
}
function sleep() {
  ask(null, 'Tidur sampai besok? Tanaman yang sudah disiram tumbuh satu hari.', ['🌙 Tidur', 'Nanti'], (i) => {
    if (i !== 0) return;
    growFarm(farm(), DAY_SEC); api.persist(); refreshMine(); renderBar(true); api.say(`☀️ Selamat pagi! Hari ${farm().day} di kebun.`);
  });
}

/* ---------------- pasar pemain ---------------- */
export function openMarket(kind = 'produce') {
  market.hidden = false; api.pause(true);
  $m('#marketKind').value = kind; fillMarketItems();
  if (api.online()) api.send({ t: 'farmMarket' });
  renderMarket();
}
function closeMarket() { market.hidden = true; api.pause(false); }
// pilihan barang sesuai jenis: panen, tanah milik sendiri (dengan jumlah barang di atasnya), atau barang di tas
function fillMarketItems() {
  const kind = $m('#marketKind').value, f = farm();
  const items = kind === 'produce' ? Object.entries(CROPS).map(([id, c]) => [id, `${c.emoji} ${c.name} · punya ${f.harvest[id]}`])
    : kind === 'land' ? f.lands.map((own, i) => own && [i, `📜 Tanah ${i + 1} · ${landItems(f, i)} barang`]).filter(Boolean)
      : Object.keys(f.inv).map((id) => [id, `${ITEMS[id].emoji} ${ITEMS[id].name} ×${f.inv[id]}`]);
  $m('#marketItem').innerHTML = items.length ? items.map(([v, t]) => `<option value="${v}">${t}</option>`).join('') : '<option value="">(belum punya)</option>';
  $m('#marketQty').hidden = kind !== 'produce';
}
function renderMarket() {
  const list = $m('#marketList');
  $m('#marketStatus').textContent = api.online() ? 'Barang dari pemain lain. Harga adalah harga total.' : 'Pasar pemain perlu server/WiFi rumah. Pasar Bu Mira tetap dapat dipakai.';
  list.innerHTML = marketListings.length ? marketListings.map((x) => {
    const it = ITEMS[x.item], what = x.kind === 'land' ? `📜 Tanah · ${x.things || 0} barang, ${x.plants || 0} tanaman` : x.kind === 'item' || x.kind === 'building' ? `${it?.emoji || '📦'} ${it?.name || esc(x.item)}`
      : `${CROPS[x.item]?.emoji || '🧺'} ${x.qty} ${CROPS[x.item]?.name || esc(x.item)}`;
    return `<article><span>${what}<small> oleh ${esc(x.seller)}</small></span><button class="chunky ${x.mine ? '' : 'sun'}" data-${x.mine ? 'cancel' : 'buy'}="${x.id}">${x.mine ? 'Batalkan' : `${x.price} 🪙`}</button></article>`;
  }).join('') : '<p>Belum ada barang dijual pemain.</p>';
  for (const b of list.querySelectorAll('[data-buy]')) b.onclick = () => api.send({ t: 'farmBuy', id: +b.dataset.buy });
  for (const b of list.querySelectorAll('[data-cancel]')) b.onclick = () => api.send({ t: 'farmCancel', id: +b.dataset.cancel });
}
$m('[data-close]').onclick = closeMarket;
$m('#marketKind').onchange = fillMarketItems;
$m('#marketSell').onclick = () => {
  if (!api.online()) return api.toast('Pasar pemain perlu koneksi server.');
  const kind = $m('#marketKind').value, item = $m('#marketItem').value, qty = Math.max(1, +$m('#marketQty').value || 1), price = Math.max(1, +$m('#marketPrice').value || 1);
  if (!item) return api.toast('Belum ada barang untuk dijual.');
  if (kind === 'land') { const c = canSellLand(farm(), +item); if (!c.ok) return api.toast(c.message); }
  api.send({ t: 'farmList', kind, item, qty, price, data: api.save() });
};
export function onMarket(list, msg) { marketListings = Array.isArray(list) ? list : []; if (msg) api.toast(msg); renderMarket(); fillMarketItems(); }
// Server mengirim perubahan (delta), bukan salinan penuh, supaya kebun yang belum tersimpan tidak tertimpa.
export function onSync(d, msg) {
  if (d) {
    const s = api.save(), f = farm();
    if (d.coins) s.coins = Math.max(0, (s.coins || 0) + d.coins);
    for (const [id, n] of Object.entries(d.harvest || {})) if (CROPS[id]) f.harvest[id] = Math.max(0, (f.harvest[id] || 0) + n);
    if (d.landOut != null && f.lands[d.landOut]) takeLand(f, d.landOut);
    if (d.landIn) putLand(f, d.landIn); // barang & tanaman di tanah itu ikut pindah
    for (const [id, n] of Object.entries(d.inv || {})) if (ITEMS[id]) { f.inv[id] = Math.max(0, (f.inv[id] || 0) + n); if (!f.inv[id]) delete f.inv[id]; }
    api.persist(); api.vitals(); refreshMine(); renderBar(true); if (!market.hidden) fillMarketItems();
  }
  if (msg) api.toast(msg);
}
// server: kavling milikku + kebun semua pemain
export function onWorld(m) {
  const f = farm(); if (Number.isInteger(m.kav)) f.kav = m.kav;
  others.clear(); for (const p of m.plots || []) if (Number.isInteger(p.kav) && p.kav !== f.kav) others.set(p.kav, p);
  if (m.msg) api.say(m.msg); api.persist(); refreshViews();
}
export function onPlot(p) {
  if (!p || !Number.isInteger(p.kav) || p.kav === farm().kav) return;
  for (const [k, q] of others) if (q.key === p.key && k !== p.kav) others.delete(k);
  others.set(p.kav, p); views[p.kav]?.set(p, false);
}

/* ---------------- dunia 3D ---------------- */
function approach(x, z, cb, reach = 6) {
  if (!api.active() || trip || api.busy()) return;
  if (W.islandOf(...playerAt()) !== W.islandOf(x, z)) return;
  if (dist(playerAt(), [x, z]) <= reach) cb();
  else { api.walkTo(x, z, () => dist(playerAt(), [x, z]) <= reach + 0.5 && cb()); api.toast('Jalan mendekat dahulu…'); }
}
function safeRing(s) {
  const m = new THREE.Mesh(new THREE.RingGeometry(s.r - 0.45, s.r, 48), new THREE.MeshBasicMaterial({ color: '#73e58a', transparent: true, opacity: 0.8, side: THREE.DoubleSide }));
  m.rotation.x = -Math.PI / 2; m.position.set(s.x, 0.08, s.z); scenery.add(m);
}
function makeBoat() {
  boat = new THREE.Group(); boat.userData.dynamic = true; K.scene.add(boat);
  block(3.2, 0.6, 6.3, '#a9683d', 0, -0.15, 0, boat); block(2.6, 0.2, 5.5, '#f4d79f', 0, 0.22, 0, boat);
  S('cone', 3.2, 1.6, 0.6, '#a9683d', 0, -0.95, 3.9, boat).rotation.x = Math.PI / 2; // haluan runcing
  S('cyl', 0.14, 4, 0.14, '#8a5a35', 0, 0.3, 0.6, boat); S('gable', 0.06, 3, 2.6, '#fff5dc', 0, 1, -0.2, boat);
  clickable(boat, () => { const d = onFarm(...playerAt()) ? LANDING : HOME; approach(...d, boardBoat); });
}
// alun-alun desa: toko bibit, pasar, balai desa, bengkel tukang, air mancur
function buildTown() {
  const plaza = new THREE.Mesh(new THREE.CylinderGeometry(30, 30, 0.08, 48), K.mat('#e8d5a3')); plaza.position.set(CX, 0.01, CZ); scenery.add(plaza);
  const ring = new THREE.Mesh(new THREE.RingGeometry(40, 43, 64), K.mat('#e8cf96')); ring.rotation.x = -Math.PI / 2; ring.position.set(CX, 0.03, CZ); scenery.add(ring);
  block(6, 0.08, 92, '#e8cf96', 0, 0.04, -326); // jalan dari dermaga
  for (const kv of KAVS) { // jalan setapak dari jalan lingkar ke tiap kavling
    const a = Math.atan2(kv.cx - CX, kv.cz - CZ), r0 = 42, r1 = 53, m = block(3, 0.07, r1 - r0, '#e8cf96', CX + Math.sin(a) * (r0 + r1) / 2, 0.035, CZ + Math.cos(a) * (r0 + r1) / 2); m.rotation.y = a;
  }
  S('cyl', 6, 0.7, 6, '#b6b3a8', CX, 0, CZ); S('cyl', 5, 0.1, 5, '#61b6c8', CX, 0.62, CZ); S('cyl', 0.7, 2, 0.7, '#b6b3a8', CX, 0, CZ); S('sph', 1.4, 0.8, 1.4, '#7fd0e0', CX, 1.9, CZ);
  W.kit.addSolid(CX, CZ, 3, 3, 0, 0.7);
  // toko bibit: meja kayu, tiang bulat, atap pelana hijau, karung bibit
  const stall = block(7, 1.2, 2.6, '#cb8e55', -13, 0.6, -391);
  for (const [dx, dz] of [[-3.4, -1.6], [3.4, -1.6], [-3.4, 1.6], [3.4, 1.6]]) S('cyl', 0.2, 3, 0.2, '#8a5a35', -13 + dx, 0, -391 + dz);
  S('gable', 8.4, 1.4, 4.6, '#7cbf5a', -13, 3, -391);
  for (const [i, c] of ['#d9b47a', '#c99a62', '#e6c98f'].entries()) S('sph', 0.9, 1.1, 0.9, c, -15.5 + i * 1.1, 1.2, -391);
  clickable(stall, () => approach(-13, -387, whenOpen(PEOPLE.tini, seedShop)));
  // pasar: meja panjang di bawah payung warna-warni, tumpukan sayur dan peti
  const marketStall = block(10, 1.2, 3, '#cfa36d', 13, 0.6, -391);
  for (const [i, c] of ['#ef6f6c', '#f6c34a', '#5cc2c7'].entries()) parasol(9.5 + i * 3.5, -391, c);
  for (const [i, id] of ['tomat', 'wortel', 'jagung', 'labu', 'semangka'].entries()) S('sph', 1.2, 0.7, 1.2, CROPS[id].color, 9.4 + i * 1.8, 1.2, -391);
  for (const [dx, dz] of [[-6.5, 1], [6.5, 1.4]]) block(1.5, 0.9, 1.3, '#b88758', 13 + dx, 0.45, -391 + dz);
  clickable(marketStall, () => approach(13, -387, whenOpen(PEOPLE.mira, npcMarket)));
  // balai desa: dinding krem, atap pelana, pintu, jendela, tiang bendera
  const office = block(11, 3.6, 7, '#ffe4ad', -13, 1.8, -415); S('gable', 12, 2.6, 8, '#d77c54', -13, 3.6, -415);
  block(1.8, 2.6, 0.2, '#8a5a35', -13, 1.3, -411.4); for (const dx of [-3.4, 3.4]) block(1.8, 1.4, 0.2, '#9fd3f0', -13 + dx, 2, -411.4);
  S('cyl', 0.15, 7, 0.15, '#eee4c4', -20, 0, -410); block(2, 1.2, 0.08, '#e8434b', -19, 6.4, -410); block(2, 0.6, 0.08, '#ffffff', -19, 5.5, -410);
  W.kit.addSolid(-13, -415, 5.5, 3.5, 0, 3.6); clickable(office, () => approach(-13, -407, whenOpen(PEOPLE.lurah, landOffice)));
  // bengkel Pak Darto: atap terbuka, meja kerja, tumpukan papan
  for (const [dx, dz] of [[-4, -3], [4, -3], [-4, 2], [4, 2]]) S('cyl', 0.25, 3.2, 0.25, '#8a5a35', 13 + dx, 0, -415 + dz);
  S('gable', 9.6, 1.8, 6.6, '#5b86c4', 13, 3.2, -415.5); block(5, 1, 1.4, '#c98a4b', 13, 0.5, -414);
  for (let i = 0; i < 4; i++) block(3.2, 0.18, 0.5, '#e0b47a', 16.2, 0.1 + i * 0.2, -417 + (i % 2) * 0.4);
  for (const [id, p] of Object.entries(PEOPLE)) W.addNpc({ ...p, id: `kebun_${id}`, face: 0, talk: () => ({ tini: seedShop, mira: npcMarket, lurah: landOffice, tukang: builder })[id]() });
  // warga yang berjalan-jalan dan bisa diajak bicara; rumahnya di luar kavling supaya tidak menghalangi
  for (const w of WANDERERS) W.addNpc({ ...w, face: 0, pitch: w.girl ? 0.2 : -0.2, pants: '#6c5947' });
  // warga latar di tepi alun-alun membuat desa terasa ramai
  const shirts = ['#e98b62', '#65a8b5', '#c98bb8', '#8cad62', '#e2b952'];
  for (let i = 0; i < 8; i++) {
    const a = ((i + 0.5) / 8) * Math.PI * 2 + 0.3, ch = K.makeCharacter({ shirt: shirts[i % shirts.length], pants: '#6c5947', skin: ['#e3ac83', '#f6d2b4', '#b97a52'][i % 3], hair: '#3b2a20' });
    if (Math.abs(Math.sin(a)) < 0.25 && Math.cos(a) > 0) continue; // jalan dermaga dibiarkan kosong
    ch.root.position.set(CX + Math.sin(a) * 25, 0, CZ + Math.cos(a) * 25); ch.root.rotation.y = a + Math.PI; scenery.add(ch.root);
  }
  for (let i = 0; i < 12; i++) { const a = (i / 12) * Math.PI * 2 + 0.26; S('sph', 2, 1.2, 2, '#5aa955', CX + Math.sin(a) * 31.5, 0, CZ + Math.cos(a) * 31.5); S('sph', 0.5, 0.5, 0.5, FLOWERS[i % 4], CX + Math.sin(a) * 31.5 + 0.5, 0.9, CZ + Math.cos(a) * 31.5); }
}
function buildIsland() {
  root = new THREE.Group(); root.userData.dynamic = true; K.scene.add(root);
  scenery = new THREE.Group(); K.scene.add(scenery);
  const ground = new THREE.Mesh(new THREE.CylinderGeometry(W.FARM.r, W.FARM.r - 3, 2, 80), K.mat('#efd39a')); ground.position.set(CX, -1.08, CZ); scenery.add(ground);
  const grass = new THREE.Mesh(new THREE.CylinderGeometry(W.FARM.r - 4, W.FARM.r - 4, 0.08, 80), K.mat('#83c96d')); grass.position.set(CX, -0.04, CZ); scenery.add(grass);
  label('🌱 PULAU KEBUN', 0, 4, -292, 13);
  for (const s of SAFE_SPOTS) { safeRing(s); label(`🛡️ ${s.name}`, s.x, 2.8, s.z + s.r - 2, 9); }
  buildTown();
  for (let i = 0; i < 44; i++) { // pohon di tepi pulau, jalan dermaga dibiarkan kosong
    const a = i * 2.399, r = 96 + (i % 4) * 4, x = CX + Math.sin(a) * r, z = CZ + Math.cos(a) * r;
    if (z > -310 && Math.abs(x) < 14) continue;
    treeR(x, z, 0.85 + (i % 3) * 0.15, i % 2 ? '#61aa59' : '#4c9750');
  }
  for (let i = 0; i < KAVS.length; i++) views.push(new KavView(i));
}
export function initFarm(ctx, callbacks) {
  K = ctx; api = callbacks; buildIsland();
  document.getElementById('talkBtn')?.before(actBtn);
  dockRoot = new THREE.Group(); dockRoot.userData.dynamic = true; K.scene.add(dockRoot);
  block(5, 0.3, 22, '#c78e58', HOME[0], 0.15, HOME[1] - 6, dockRoot); W.kit.addSolid(HOME[0], HOME[1] - 6, 2.5, 11, 0, 0.3);
  clickable(label('🚣 Perahu ke Pulau Kebun', HOME[0], 3.5, HOME[1], 11, dockRoot), boardBoat);
  block(5, 0.3, 26, '#c78e58', 0, 0.15, LANDING[1] + 7, root); W.kit.addSolid(0, LANDING[1] + 7, 2.5, 13, 0, 0.3);
  clickable(label('🚣 Pulang ke Pulau Balok', 0, 3, LANDING[1], 10), boardBoat);
  makeBoat(); boatButton.onclick = boardBoat;
}

/* ---------------- perahu ---------------- */
export function boardBoat() {
  if (!api.active() || api.busy() || trip) return;
  const fromFarm = onFarm(...playerAt()), start = fromFarm ? LANDING : HOME;
  if (dist(playerAt(), start) > 9) return api.toast('Dekati dermaga Perahu Kebun.');
  ask(null, fromFarm ? 'Pulang ke Pulau Balok?' : 'Berlayar gratis ke Pulau Kebun yang luas?', ['🚣 Berlayar', 'Nanti'], (i) => {
    if (i !== 0) return;
    if (build.on) endBuild();
    api.leave(); api.stop(); api.persist();
    trip = { t: 0, from: boatAt(fromFarm), to: boatAt(!fromFarm), landing: fromFarm ? HOME : LANDING, fromFarm };
    bar.hidden = true; tripLabel.hidden = false;
  });
}
function sailTick(dt) {
  trip.t = Math.min(1, trip.t + dt / 12); // 12 detik, melengkung supaya tidak menabrak Pulau Balok
  const t = trip.t, k = t * t * (3 - 2 * t), x = trip.from[0] + (trip.to[0] - trip.from[0]) * k + Math.sin(t * Math.PI) * 24, z = trip.from[1] + (trip.to[1] - trip.from[1]) * k;
  boat.position.set(x, -0.1 + Math.sin(t * 45) * 0.07, z);
  boat.rotation.y = Math.atan2(trip.to[0] - trip.from[0] + Math.cos(t * Math.PI) * 15, trip.to[1] - trip.from[1]);
  api.player.pos.set(x, 0, z); api.player.y = 0.65; api.player.vy = 0;
  tripLabel.textContent = `🚣 ${trip.fromFarm ? 'Menuju Pulau Balok' : 'Menuju Pulau Kebun'} · ${Math.round(t * 100)}%`;
  if (t < 1) return;
  const end = trip.landing, arrived = !trip.fromFarm; trip = null;
  api.teleport(end[0], end[1], 0.3); api.checkpoint(); api.persist(); tripLabel.hidden = true;
  api.say(arrived ? '🌱 Selamat datang di Pulau Kebun! Temui Pak Lurah di alun-alun untuk mendapat tanah di kavlingmu.' : '⚓ Sampai di Pulau Balok.');
}
export function updateFarm(dt, active) {
  if (!api) return;
  const pos = playerAt(), here = onFarm(...pos), f = farm();
  if (here && !wasHere) { if (!api.busy()) api.quiet(); hello = false; }
  if (!here && build.on) endBuild();
  wasHere = here;
  if (api.save() !== lastSave) { lastSave = api.save(); tickSave = 0; hello = false; others.clear(); refreshViews(); } // pemain lain masuk di perangkat ini
  if (here && !hello && api.online()) { hello = true; api.send({ t: 'farmHello' }); }
  if (here && !api.online() && !Number.isInteger(f.kav)) { f.kav = 0; refreshViews(); } // tanpa server: kavling pertama
  root.visible = near(...pos); dockRoot.visible = !here || !!trip;
  bar.hidden = !active || !here || !!trip || !market.hidden; if (!bar.hidden) renderBar();
  if (active && !api.busy() && !trip) {
    growFarm(f, dt); tickSave += dt; viewT += dt;
    if (viewT >= 0.5) { viewT = 0; if (root.visible) refreshMine(); }
    if (tickSave > (here ? 5 : 30)) { tickSave = 0; api.persist(); }
  }
  if (build.on && active && !api.busy()) buildTick();
  else if (!build.on) setAct(active && here && !trip && !api.busy() ? nearestPrompt() : null);
  boatButton.hidden = !active || api.busy() || !!trip || dist(pos, here ? LANDING : HOME) > 9 || api.player.y > 2;
  boatButton.textContent = here ? '🚣 Pulang ke Pulau Balok' : '🚣 Berlayar ke Pulau Kebun';
  if (trip) { if (active && !api.busy()) sailTick(dt); }
  else { const parked = boatAt(here); boat.position.set(parked[0], -0.1 + Math.sin(performance.now() / 750) * 0.06, parked[1]); }
}
