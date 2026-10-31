// Pulau Kebun v2: pulau besar untuk membangun bebas. Desa di tengah, padang landai di sekitarnya,
// gunung bersalju di selatan, hutan berbukit di timur, gurun di barat daya, danau dan sungai di barat,
// padang bunga di timur laut, pantai berkeliling, dermaga di utara (kembali ke Pulau Balok).
// Benda diam digabung StaticBatch (sedikit draw call); tabrakan di Physics; tinggi tanah dari terrain.js.
import * as THREE from '/lib/three.module.min.js';
import { StaticBatch, roundedBox, cylGeo, sphereGeo, coneGeo } from '../core/geo.js';
import { Avatar, nameTag } from '../core/avatar.js';
import { rng } from '../core/util.js';
import { CX, CZ, REGIONS, buildHeights, buildTerrainMesh, heightAt, slopeAt, biomeAt, onLand as landAt, onPath, coastR, SEA } from './terrain.js';

export { CX, CZ };
export const PLOT = 24;        // kavling lama (titik pulang & mengubah kebun versi lama menjadi balok)
export const BUILD_H = 110;    // batas atas bangunan (y dunia)
export const BUILD_MIN = -4;   // boleh membangun sampai dasar danau
// 12 kavling lama di lingkaran r=66 (tanah di sana dibuat landai di terrain.js)
export const PLOTS = Array.from({ length: 12 }, (_, i) => {
  const a = ((15 + i * 30) * Math.PI) / 180, cx = CX + Math.sin(a) * 66, cz = CZ + Math.cos(a) * 66;
  const ox = Math.round(cx - PLOT / 2), oz = Math.round(cz - PLOT / 2), d = Math.hypot(cx - CX, cz - CZ);
  return { i, a, ox, oz, cx: ox + PLOT / 2, cz: oz + PLOT / 2, front: [ox + PLOT / 2 + ((CX - cx) / d) * 15.5, oz + PLOT / 2 + ((CZ - cz) / d) * 15.5] };
});
export const plotAt = (x, z) => PLOTS.find((p) => x >= p.ox && x < p.ox + PLOT && z >= p.oz && z < p.oz + PLOT) || null;
export const onIsland = (x, z, pad = 0) => landAt(x, z, pad + 2);
export { heightAt };
const DOCK_V = coastR(0, 1);
export const DOCK = { x: CX, z: CZ + DOCK_V - 30 };

export function buildKebun(scene, render, physics) {
  buildHeights();
  buildTerrainMesh(scene, render);
  const B = new StaticBatch(), r = rng(7);
  const solid = (x, y, z, sx, sy, sz) => physics.addBox(x, y, z, sx, sy, sz);
  physics.ground = heightAt;
  // tidak bisa berjalan masuk ke air dalam (laut, tengah danau) kecuali berdiri di atas balok/dermaga atau terbang
  physics.walkable = (x, z, y, fly) => (fly ? landAt(x, z, -40) : heightAt(x, z) > -1.3 || y > heightAt(x, z) + 0.6);
  physics.bound = null;

  /* ---------- desa: alun-alun, air mancur, rumah, kios ---------- */
  const plaza = new THREE.Mesh(new THREE.CylinderGeometry(15, 15, 0.08, 40), new THREE.MeshStandardMaterial({ color: '#e9d7a8', roughness: 0.9 }));
  plaza.position.set(CX, 0.04, CZ); plaza.receiveShadow = true; scene.add(plaza);
  B.geo(cylGeo(4.6, 4.9, 0.8, 20), CX, 0.4, CZ, '#b9c0cc');
  B.geo(cylGeo(1, 1.2, 2.4, 14), CX, 1.6, CZ, '#d7dce4');
  B.geo(cylGeo(2, 1.6, 0.35, 16), CX, 2.6, CZ, '#d7dce4');
  solid(CX, 0.4, CZ, 8.6, 0.8, 8.6);
  const fWater = new THREE.Mesh(new THREE.CylinderGeometry(4.2, 4.2, 0.1, 24), new THREE.MeshStandardMaterial({ color: '#5fd0f5', roughness: 0.1, transparent: true, opacity: 0.85 }));
  fWater.position.set(CX, 0.72, CZ); scene.add(fWater);
  const jet = new THREE.Mesh(new THREE.ConeGeometry(0.5, 1.6, 10, 1, true), new THREE.MeshStandardMaterial({ color: '#bff0ff', transparent: true, opacity: 0.7, roughness: 0.1 }));
  jet.position.set(CX, 3.5, CZ); scene.add(jet);

  const signs = [];
  function addSign(x, z, y, text) { const s = nameTag(text, '#ffe9a8'); s.position.set(x, y, z); s.scale.set(3.2, 0.8, 1); scene.add(s); signs.push(s); }
  const house = (x, z, w, d, wall, roof, yaw, sign) => {
    const h = 3.6, cs = Math.cos(yaw), sn = Math.sin(yaw), at = (lx, lz) => [x + lx * cs + lz * sn, z - lx * sn + lz * cs];
    B.box(x, h / 2, z, w, h, d, wall, { yaw, round: 0.12 });
    const pitch = 0.55, half = d / 2 + 0.5, rl = half / Math.cos(pitch);
    for (const s of [-1, 1]) { const [rx, rz] = at(0, s * half / 2); B.geo(roundedBox(w + 1, 0.3, rl, 0.08), rx, h + Math.tan(pitch) * half / 2, rz, roof, { yaw, pitch: s * pitch }); }
    const [dx, dz] = at(0, d / 2 + 0.02); B.box(dx, 1.05, dz, 1.3, 2.1, 0.12, '#8a5a35', { yaw });
    for (const s of [-1, 1]) { const [wx, wz] = at(s * (w / 2 - 1.1), d / 2 + 0.03); B.box(wx, 2.1, wz, 1.1, 0.9, 0.1, '#bfe9ff', { yaw, mat: 'glass' }); }
    physics.addBox(x, (h + 2) / 2, z, Math.abs(w * cs) + Math.abs(d * sn), h + 2, Math.abs(w * sn) + Math.abs(d * cs));
    if (sign) { const [sx, sz] = at(0, d / 2 + 0.4); addSign(sx, sz, h + 0.6, sign); }
  };
  const stall = (x, z, color, yaw, sign) => {
    const cs = Math.cos(yaw), sn = Math.sin(yaw), at = (lx, lz) => [x + lx * cs + lz * sn, z - lx * sn + lz * cs];
    B.box(x, 0.55, z, 3.4, 1.1, 1.4, '#c98a52', { yaw, round: 0.08 });
    for (const [lx, lz] of [[-1.6, -0.6], [1.6, -0.6], [-1.6, 0.6], [1.6, 0.6]]) { const [px, pz] = at(lx, lz); B.geo(cylGeo(0.07, 0.07, 2.6, 6), px, 1.3, pz, '#8a5a35'); }
    B.geo(roundedBox(4, 0.25, 2.2, 0.1), x, 2.65, z, color, { yaw, pitch: 0.15 });
    for (let k = 0; k < 4; k++) { const [px, pz] = at(-1.2 + k * 0.8, 0.1); B.geo(sphereGeo(0.22), px, 1.25, pz, ['#e8434b', '#ff8a2a', '#ffd23a', '#3fb25a'][k]); }
    physics.addBox(x, 0.55, z, Math.abs(3.4 * cs) + Math.abs(1.4 * sn), 1.1, Math.abs(3.4 * sn) + Math.abs(1.4 * cs));
    if (sign) addSign(x, z, 3.4, sign);
  };
  house(CX - 22, CZ - 6, 8, 6, '#f4e1c1', '#d9534f', Math.PI / 2, '🏛️ Balai Desa');
  house(CX + 22, CZ - 6, 7, 6, '#dbeefc', '#3a7cf5', -Math.PI / 2, '🧱 Toko Balok');
  house(CX - 14, CZ - 24, 6, 5, '#ffe6ef', '#9a62e0', 0.4, null);
  house(CX + 15, CZ - 24, 6, 5, '#e9ffe0', '#ff8a2a', -0.4, null);
  stall(CX - 9, CZ - 15, '#ff8fc0', 0, '🍉 Kios Buah');
  stall(CX + 9, CZ - 15, '#ffd23a', 0, '🌻 Kios Bunga');

  /* ---------- dermaga dan perahu (pantai utara) ---------- */
  const dz0 = CZ + DOCK_V - 38; // dermaga dari pasir pantai sampai air dalam
  const deckY = (z) => Math.max(0.3, heightAt(CX, z) + 0.15);
  for (let k = 0; k < 14; k++) { const z = dz0 + k * 2.2, y = deckY(z); B.box(CX, y, z, 4.2, 0.2, 2.0, k % 2 ? '#a8784a' : '#b78655', { mat: 'block' }); physics.addAABB(CX - 2.1, -6, z - 1.1, CX + 2.1, y + 0.1, z + 1.1); }
  for (let k = 0; k < 15; k++) for (const s of [-1, 1]) B.geo(cylGeo(0.14, 0.14, 4, 8), CX + s * 2.1, -1.4, dz0 - 1 + k * 2.2, '#8a5a35');
  const boat = new THREE.Group();
  const hull = new THREE.Mesh(roundedBox(2.6, 0.9, 5, 0.35), new THREE.MeshStandardMaterial({ color: '#e8434b', roughness: 0.5 })); hull.castShadow = true; boat.add(hull);
  const deck = new THREE.Mesh(roundedBox(2.2, 0.15, 4.4, 0.06), new THREE.MeshStandardMaterial({ color: '#c98a52' })); deck.position.y = 0.4; boat.add(deck);
  const mast = new THREE.Mesh(cylGeo(0.08, 0.08, 4, 8), new THREE.MeshStandardMaterial({ color: '#8a5a35' })); mast.position.y = 2.4; boat.add(mast);
  const sail = new THREE.Mesh(new THREE.PlaneGeometry(2, 2.6), new THREE.MeshStandardMaterial({ color: '#fff7e0', side: THREE.DoubleSide })); sail.position.set(0, 2.6, 0.1); sail.rotation.y = Math.PI / 2; boat.add(sail);
  boat.position.set(CX + 4.4, SEA + 0.4, dz0 + 25); scene.add(boat);
  addSign(CX, dz0 + 10, 2.8, '⛵ Perahu ke Pulau Balok');

  /* ---------- tumbuhan & batu per wilayah ---------- */
  const clear = (x, z, pad = 0) => {
    const u = x - CX, v = z - CZ, d = Math.hypot(u, v);
    if (d < 36 + pad || !landAt(x, z, 6)) return false;
    if (onPath(x, z) || (Math.abs(u) < 6 + Math.max(0, pad) && v > 14)) return false;
    return true;
  };
  const LEAF = ['#3fa34d', '#4fb859', '#5cc463', '#2f9447'];
  const roundTree = (x, y, z, s, k) => {
    B.geo(cylGeo(0.22 * s, 0.3 * s, 2.4 * s, 8), x, y + 1.2 * s, z, '#8a5a35');
    B.geo(roundedBox(2.6 * s, 2 * s, 2.6 * s, 0.6 * s), x, y + 3.2 * s, z, LEAF[k % 4], { yaw: k });
    B.geo(roundedBox(1.7 * s, 1.3 * s, 1.7 * s, 0.45 * s), x + 0.3 * s, y + 4.6 * s, z - 0.2 * s, LEAF[(k + 1) % 4], { yaw: k * 2 });
    physics.addBox(x, y + 1.2 * s, z, 0.6 * s, 2.4 * s, 0.6 * s);
  };
  const pine = (x, y, z, s, snowy) => {
    B.geo(cylGeo(0.18 * s, 0.26 * s, 1.6 * s, 7), x, y + 0.8 * s, z, '#7a4f2e');
    for (let j = 0; j < 3; j++) {
      B.geo(coneGeo((1.9 - j * 0.5) * s, 1.8 * s, 8), x, y + (2.1 + j * 1.15) * s, z, snowy ? '#e9f3f7' : j % 2 ? '#2f8a4a' : '#2a7a43');
      if (snowy) B.geo(coneGeo((1.0 - j * 0.25) * s, 0.7 * s, 8), x, y + (2.7 + j * 1.15) * s, z, '#ffffff');
    }
    physics.addBox(x, y + 0.8 * s, z, 0.5 * s, 1.6 * s, 0.5 * s);
  };
  const palm = (x, y, z, s, k) => {
    let px = x, py = y, pz = z; const lean = r() * Math.PI * 2;
    for (let j = 0; j < 6; j++) { B.geo(cylGeo(0.2 * s, 0.24 * s, 0.9 * s, 7), px, py + 0.45 * s, pz, j % 2 ? '#b98a55' : '#a87a48'); py += 0.85 * s; px += Math.sin(lean) * 0.07 * s * j; pz += Math.cos(lean) * 0.07 * s * j; }
    for (let j = 0; j < 7; j++) { const a = (j / 7) * Math.PI * 2 + k; B.geo(roundedBox(0.5 * s, 0.08 * s, 2.6 * s, 0.03), px + Math.sin(a) * 1.1 * s, py - 0.2 * s, pz + Math.cos(a) * 1.1 * s, '#4fb859', { yaw: a, pitch: 0.45 }); }
    for (let j = 0; j < 3; j++) B.geo(sphereGeo(0.2 * s, 8, 6), px + (j - 1) * 0.25 * s, py - 0.4 * s, pz, '#7a5230');
    physics.addBox(x, y + 2.5 * s, z, 0.5 * s, 5 * s, 0.5 * s);
  };
  const cactus = (x, y, z, s) => {
    B.geo(roundedBox(0.6 * s, 3 * s, 0.6 * s, 0.25 * s), x, y + 1.5 * s, z, '#4f9e5c');
    for (const sd of [-1, 1]) if (r() < 0.8) {
      const hgt = (1 + r() * 0.8) * s;
      B.geo(roundedBox(0.8 * s, 0.4 * s, 0.4 * s, 0.15 * s), x + sd * 0.6 * s, y + hgt, z, '#4f9e5c');
      B.geo(roundedBox(0.4 * s, 1.1 * s, 0.4 * s, 0.15 * s), x + sd * 0.95 * s, y + hgt + 0.5 * s, z, '#58aa64');
    }
    if (r() < 0.4) B.geo(sphereGeo(0.16 * s, 8, 6), x, y + 3.05 * s, z, '#ff8fc0');
    physics.addBox(x, y + 1.5 * s, z, 0.6 * s, 3 * s, 0.6 * s);
  };
  const rock = (x, y, z, s, col) => {
    B.geo(roundedBox(s * 1.5, s, s * 1.2, s * 0.32), x, y + s * 0.35, z, col, { yaw: r() * 3, pitch: (r() - 0.5) * 0.3 });
    if (s > 0.9) physics.addAABB(x - s * 0.6, y - 1, z - s * 0.5, x + s * 0.6, y + s * 0.8, z + s * 0.5);
  };
  const counts = {};
  for (let k = 0; k < 45000; k++) {
    const x = CX + (r() * 2 - 1) * 370, z = CZ + (r() * 2 - 1) * 370;
    if (!clear(x, z)) continue;
    const y = heightAt(x, z); if (y < 0.3) continue;
    const sl = slopeAt(x, z), b = biomeAt(x, z, y), p = r();
    const add = (name, max, fn) => { if ((counts[name] || 0) >= max) return; counts[name] = (counts[name] || 0) + 1; fn(); };
    if (b === 'hutan' && sl < 0.9) { if (p < 0.13) add('hutan', 420, () => (r() < 0.6 ? roundTree(x, y, z, 0.8 + r() * 0.7, k) : pine(x, y, z, 1 + r() * 0.6, false))); else if (p < 0.15) add('batu', 260, () => rock(x, y, z, 0.6 + r(), '#8f97a5')); }
    else if (b === 'gunung' && sl < 1.5) { if (p < 0.09 && y < 30) add('cemara', 260, () => pine(x, y, z, 0.9 + r() * 0.6, y > 24)); else if (p < 0.07) add('batu', 260, () => rock(x, y, z, 0.8 + r() * 1.8, '#8a919d')); }
    else if (b === 'salju' && sl < 1.0) { if (p < 0.02) add('cemaraSalju', 90, () => pine(x, y, z, 0.8 + r() * 0.5, true)); else if (p < 0.03) add('batuSalju', 60, () => rock(x, y, z, 1 + r() * 1.5, '#dfe7ee')); }
    else if (b === 'gurun' && sl < 0.8) { if (p < 0.02) add('kaktus', 90, () => cactus(x, y, z, 0.8 + r() * 0.6)); else if (p < 0.03) add('batuGurun', 70, () => rock(x, y, z, 0.7 + r() * 1.5, '#d9a066')); }
    else if (b === 'pantai' && y > 0.5 && sl < 0.5) { if (p < 0.025) add('kelapa', 120, () => palm(x, y, z, 0.9 + r() * 0.4, k)); }
    else if (b === 'padang' && sl < 0.6) { if (p < 0.006) add('pohon', 90, () => roundTree(x, y, z, 0.8 + r() * 0.6, k)); else if (p < 0.012) add('batu', 260, () => rock(x, y, z, 0.5 + r() * 0.8, '#a9b0bd')); }
    else if (b === 'bunga' && sl < 0.6) { if (p < 0.004) add('pohonBunga', 25, () => roundTree(x, y, z, 0.9, k)); }
  }
  window.__pbTrees = counts;

  // bunga dan rumput (InstancedMesh: satu draw call masing-masing)
  const c = new THREE.Color(), m = new THREE.Matrix4(), sc = new THREE.Vector3();
  const flowers = new THREE.InstancedMesh(new THREE.SphereGeometry(0.13, 6, 4), new THREE.MeshStandardMaterial({ roughness: 0.6 }), 4000);
  const tuftGeo = new THREE.ConeGeometry(0.08, 0.5, 3); tuftGeo.translate(0, 0.25, 0);
  const tufts = new THREE.InstancedMesh(tuftGeo, new THREE.MeshStandardMaterial({ color: '#5aa83f', roughness: 0.9 }), 7000);
  const FC = ['#ff8fc0', '#ffd23a', '#ffffff', '#e8434b', '#9a62e0', '#ff8a2a'];
  let fc = 0, tc = 0;
  for (let k = 0; k < 60000 && (fc < 4000 || tc < 7000); k++) {
    const x = CX + (r() * 2 - 1) * 360, z = CZ + (r() * 2 - 1) * 360;
    if (!clear(x, z, -16) || Math.hypot(x - CX, z - CZ) < 17) continue;
    const y = heightAt(x, z); if (y < 0.6) continue;
    const b = biomeAt(x, z, y);
    if (b !== 'padang' && b !== 'bunga' && b !== 'hutan') continue;
    if (slopeAt(x, z) > 0.7) continue;
    const want = b === 'bunga' ? 0.75 : b === 'padang' ? 0.25 : 0.1;
    if (r() < want && fc < 4000) { m.makeTranslation(x, y + 0.14, z); flowers.setMatrixAt(fc, m); flowers.setColorAt(fc, c.set(FC[fc % FC.length])); fc++; }
    else if (tc < 7000) { m.makeRotationY(r() * 3).setPosition(x, y, z); m.scale(sc.set(1, 0.6 + r() * 0.8, 1)); tufts.setMatrixAt(tc++, m); }
  }
  flowers.count = fc; tufts.count = tc; scene.add(flowers, tufts);

  // lampu di lingkar jalan desa (menyala saat malam)
  const glowMat = new THREE.MeshStandardMaterial({ color: '#fff4c2', emissive: '#ffdf80', emissiveIntensity: 0 });
  for (let k = 0; k < 12; k++) {
    const a = ((k * 30) * Math.PI) / 180, x = CX + Math.sin(a) * 49.5, z = CZ + Math.cos(a) * 49.5, y = heightAt(x, z);
    B.geo(cylGeo(0.09, 0.12, 3.2, 8), x, y + 1.6, z, '#3d4250');
    const g = new THREE.Mesh(roundedBox(0.5, 0.5, 0.5, 0.15), glowMat); g.position.set(x, y + 3.35, z); scene.add(g);
    physics.addBox(x, y + 1.6, z, 0.3, 3.2, 0.3);
  }
  // papan penunjuk wilayah di lingkar jalan
  for (const [id, label] of [['hutan', '🌲 Hutan Timur'], ['gurun', '🏜️ Gurun Pasir'], ['danau', '🏞️ Danau Biru'], ['bunga', '🌼 Padang Bunga'], ['gunung', '🏔️ Gunung Salju']]) {
    const R = REGIONS[id], a = Math.atan2(R.u, R.v), x = CX + Math.sin(a) * 52.5, z = CZ + Math.cos(a) * 52.5, y = heightAt(x, z);
    B.geo(cylGeo(0.1, 0.1, 2.4, 6), x, y + 1.2, z, '#8a5a35');
    addSign(x, z, y + 2.8, label);
  }

  B.build(scene, render);

  /* ---------- salju turun (hanya di sekitar kamera saat pemain tinggi di gunung) ---------- */
  const snowN = 1400, snowPos = new Float32Array(snowN * 3);
  for (let i = 0; i < snowN; i++) { snowPos[i * 3] = (r() - 0.5) * 60; snowPos[i * 3 + 1] = r() * 30; snowPos[i * 3 + 2] = (r() - 0.5) * 60; }
  const snowGeo = new THREE.BufferGeometry(); snowGeo.setAttribute('position', new THREE.BufferAttribute(snowPos, 3));
  const flake = document.createElement('canvas'); flake.width = flake.height = 32;
  { const g = flake.getContext('2d'), gr = g.createRadialGradient(16, 16, 0, 16, 16, 16); gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = gr; g.fillRect(0, 0, 32, 32); }
  const snow = new THREE.Points(snowGeo, new THREE.PointsMaterial({ color: '#ffffff', size: 0.18, map: new THREE.CanvasTexture(flake), transparent: true, opacity: 0.95, depthWrite: false }));
  snow.visible = false; snow.frustumCulled = false; scene.add(snow);

  /* ---------- warga desa ---------- */
  const npcs = [
    { name: 'Pak Lurah', x: CX - 16, z: CZ - 4, look: { shirt: 'cokelat', pants: 'hitam', skin: 2, hat: 'peci' }, lines: ['Selamat datang di Pulau Kebun!', 'Pulau ini luas sekali. Ada gunung salju, hutan, gurun, dan danau!', 'Kamu boleh membangun di mana saja. Bangunlah sekreatif mungkin!'] },
    { name: 'Bu Tukang', x: CX + 16, z: CZ - 4, look: { shirt: 'oranye', pants: 'biru', skin: 1, gender: 'P', hat: 'pemadam' }, lines: ['Tekan tombol Bangun di bawah untuk mulai membangun.', 'Pilih bentuk, pilih warna, lalu ketuk tempatnya!', 'Pakai kuas 3×3 supaya cepat membuat lantai dan dinding.', 'Mau membangun tinggi? Tekan tombol Terbang!'] },
    { name: 'Dewi', x: CX - 6, z: CZ + 10, look: { shirt: 'merah muda', pants: 'ungu', skin: 0, gender: 'P' }, lines: ['Aku sudah naik ke puncak gunung salju! Dingin sekali!', 'Coba buat istana di tepi danau.', 'Tekan tombol peta untuk pergi ke tempat-tempat seru.'] },
    { name: 'Pak Nelayan', x: CX - 2.6, z: dz0 + 10, look: { shirt: 'biru', pants: 'cokelat', skin: 2, hat: 'koboi' }, lines: ['Perahuku bisa membawamu kembali ke Pulau Balok.', 'Di barat ada sungai yang mengalir dari danau ke laut.'] },
  ];
  for (const n of npcs) {
    n.y = n.z > dz0 - 2 ? deckY(n.z) + 0.1 : Math.max(0, heightAt(n.x, n.z));
    n.av = new Avatar(n.look); n.av.root.scale.setScalar(0.74);
    n.av.root.position.set(n.x, n.y, n.z); n.av.root.rotation.y = Math.atan2(CX - n.x, CZ + 10 - n.z);
    const t = nameTag(n.name); t.position.y = 2.75 / 0.74; t.scale.multiplyScalar(1 / 0.74); n.av.root.add(t);
    scene.add(n.av.root); physics.addBox(n.x, n.y + 1, n.z, 0.9, 2, 0.9);
    n.line = 0;
  }

  // tempat-tempat di peta (tujuan pindah cepat)
  let summit = [REGIONS.gunung.u, REGIONS.gunung.v, -9];
  for (let k = 0; k < 1200; k++) { const u = REGIONS.gunung.u + (r() - 0.5) * 170, v = REGIONS.gunung.v + (r() - 0.5) * 170, h = heightAt(CX + u, CZ + v); if (h > summit[2] && slopeAt(CX + u, CZ + v) < 0.8) summit = [u, v, h]; }
  const spot = (id, name, emoji, u, v) => ({ id, name, emoji, x: CX + u, z: CZ + v });
  const SPOTS = [
    spot('desa', 'Desa', '⛲', 0, 22),
    spot('dermaga', 'Dermaga', '⛵', 3, DOCK_V - 44),
    spot('hutan', 'Hutan Timur', '🌲', REGIONS.hutan.u - 40, REGIONS.hutan.v + 8),
    spot('bunga', 'Padang Bunga', '🌼', REGIONS.bunga.u, REGIONS.bunga.v),
    spot('danau', 'Danau Biru', '🏞️', REGIONS.danau.u + 34, REGIONS.danau.v + 26),
    spot('gurun', 'Gurun Pasir', '🏜️', REGIONS.gurun.u, REGIONS.gurun.v),
    spot('gunung', 'Puncak Gunung Salju', '🏔️', summit[0], summit[1]),
  ];

  return {
    spawn: { x: CX, z: CZ + 22, facing: Math.PI },
    npcs, signs, boat, SPOTS, summit: summit[2],
    update(dt, t, night, playerPos, camPos) {
      jet.scale.y = 1 + Math.sin(t * 6) * 0.12; jet.rotation.y += dt * 2;
      boat.position.y = SEA + 0.35 + Math.sin(t * 1.2) * 0.08; boat.rotation.z = Math.sin(t * 0.9) * 0.04;
      glowMat.emissiveIntensity = night * 2.2;
      const snowy = playerPos.y > 22 && biomeAt(playerPos.x, playerPos.z) !== 'gurun';
      snow.visible = snowy;
      if (snowy) {
        snow.position.set(camPos.x, camPos.y - 12, camPos.z);
        const a = snowGeo.attributes.position.array;
        for (let i = 0; i < snowN; i++) { a[i * 3 + 1] -= dt * (2 + (i % 5) * 0.4); a[i * 3] += Math.sin(t + i) * dt * 0.3; if (a[i * 3 + 1] < 0) a[i * 3 + 1] += 30; }
        snowGeo.attributes.position.needsUpdate = true;
      }
      for (const n of npcs) {
        const d = Math.hypot(playerPos.x - n.x, playerPos.z - n.z);
        if (d > 80) continue;
        n.av.update(dt, { speed: 0, onGround: true });
        if (d < 6) { const want = Math.atan2(playerPos.x - n.x, playerPos.z - n.z); n.av.root.rotation.y += Math.atan2(Math.sin(want - n.av.root.rotation.y), Math.cos(want - n.av.root.rotation.y)) * Math.min(1, dt * 4); }
      }
    },
  };
}
