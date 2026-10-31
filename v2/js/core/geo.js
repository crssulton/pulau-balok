// Geometri dan bahan bersama: kotak bersudut bulat (gaya plastik ala Roblox), tekstur tepi balok,
// dan StaticBatch yang menggabungkan semua benda diam menjadi sedikit mesh per kotak 32 m (sedikit draw call).
import * as THREE from '/lib/three.module.min.js';

const cache = new Map();

// Kotak dengan tepi membulat. Pita lengkung selebar r di tiap tepi, bagian tengah sisi tetap datar.
export function roundedBox(w = 1, h = 1, d = 1, r = 0.08) {
  const key = `rb${w},${h},${d},${r}`;
  if (cache.has(key)) return cache.get(key);
  const g = new THREE.BoxGeometry(w, h, d, 3, 3, 3);
  const hx = w / 2, hy = h / 2, hz = d / 2;
  const rr = Math.min(r, hx * 0.9, hy * 0.9, hz * 0.9);
  const pos = g.attributes.position, nor = g.attributes.normal;
  const v = new THREE.Vector3(), inner = new THREE.Vector3(), n = new THREE.Vector3();
  const snap = (u, half) => (Math.abs(Math.abs(u) - half) < 1e-5 ? u : Math.sign(u) * (half - rr));
  for (let i = 0; i < pos.count; i++) {
    v.set(snap(pos.getX(i), hx), snap(pos.getY(i), hy), snap(pos.getZ(i), hz));
    inner.set(
      Math.max(-hx + rr, Math.min(hx - rr, v.x)),
      Math.max(-hy + rr, Math.min(hy - rr, v.y)),
      Math.max(-hz + rr, Math.min(hz - rr, v.z)),
    );
    n.subVectors(v, inner);
    if (n.lengthSq() > 1e-10) { n.normalize(); v.copy(inner).addScaledVector(n, rr); nor.setXYZ(i, n.x, n.y, n.z); }
    pos.setXYZ(i, v.x, v.y, v.z);
  }
  g.userData.shared = true;
  cache.set(key, g);
  return g;
}

export function boxGeo(w = 1, h = 1, d = 1) {
  const key = `b${w},${h},${d}`;
  if (!cache.has(key)) { const g = new THREE.BoxGeometry(w, h, d); g.userData.shared = true; cache.set(key, g); }
  return cache.get(key);
}
export function cylGeo(rt = 0.5, rb = 0.5, h = 1, seg = 12) {
  const key = `c${rt},${rb},${h},${seg}`;
  if (!cache.has(key)) { const g = new THREE.CylinderGeometry(rt, rb, h, seg); g.userData.shared = true; cache.set(key, g); }
  return cache.get(key);
}
export function sphereGeo(r = 0.5, w = 12, h = 8) {
  const key = `s${r},${w},${h}`;
  if (!cache.has(key)) { const g = new THREE.SphereGeometry(r, w, h); g.userData.shared = true; cache.set(key, g); }
  return cache.get(key);
}
export function coneGeo(r = 0.5, h = 1, seg = 4) {
  const key = `k${r},${h},${seg}`;
  if (!cache.has(key)) { const g = new THREE.ConeGeometry(r, h, seg); g.userData.shared = true; cache.set(key, g); }
  return cache.get(key);
}

// Tekstur tepi balok: putih dengan garis tepi lembut dan sedikit kilau, dikalikan warna balok.
let blockTexture = null;
export function getBlockTexture() {
  if (blockTexture) return blockTexture;
  const S = 128, c = document.createElement('canvas'); c.width = c.height = S;
  const g = c.getContext('2d');
  g.fillStyle = '#ffffff'; g.fillRect(0, 0, S, S);
  // bintik halus supaya permukaan tidak terlalu datar
  const img = g.getImageData(0, 0, S, S);
  for (let i = 0; i < img.data.length; i += 4) {
    const n = 246 + ((Math.sin(i * 12.9898) * 43758.5453) % 1) * 9;
    img.data[i] = img.data[i + 1] = img.data[i + 2] = n;
  }
  g.putImageData(img, 0, 0);
  const grad = (x0, y0, x1, y1, a) => { const gr = g.createLinearGradient(x0, y0, x1, y1); gr.addColorStop(0, `rgba(0,0,0,${a})`); gr.addColorStop(1, 'rgba(0,0,0,0)'); return gr; };
  const b = 14;
  g.fillStyle = grad(0, 0, b, 0, 0.22); g.fillRect(0, 0, b, S);
  g.fillStyle = grad(S, 0, S - b, 0, 0.26); g.fillRect(S - b, 0, b, S);
  g.fillStyle = grad(0, S, 0, S - b, 0.28); g.fillRect(0, S - b, S, b);
  g.fillStyle = grad(0, 0, 0, b, 0.14); g.fillRect(0, 0, S, b);
  g.strokeStyle = 'rgba(0,0,0,0.22)'; g.lineWidth = 3; g.strokeRect(1.5, 1.5, S - 3, S - 3);
  g.strokeStyle = 'rgba(255,255,255,0.55)'; g.lineWidth = 2; g.beginPath(); g.moveTo(5, S - 6); g.lineTo(5, 5); g.lineTo(S - 6, 5); g.stroke();
  blockTexture = new THREE.CanvasTexture(c);
  blockTexture.colorSpace = THREE.SRGBColorSpace;
  blockTexture.anisotropy = 4;
  return blockTexture;
}

// Dua bahan utama dunia: plastik halus (benda bulat) dan balok bertepi (kotak, bangunan).
export const MAT = {
  smooth: new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.58, metalness: 0.02 }),
  block: null,
  glass: new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.08, metalness: 0.1, transparent: true, opacity: 0.45, depthWrite: false }),
  glow: new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.4, emissive: '#ffffff', emissiveIntensity: 0.0 }),
};
export function initMaterials() {
  MAT.block = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.66, metalness: 0.0, map: getBlockTexture() });
  return MAT;
}

/* ------------------------------------------------------------------
   StaticBatch: benda diam dikumpulkan lalu digabung per (kotak 32 m, bahan).
   Hasil: satu mesh per kotak per bahan, frustum culling bekerja per kotak,
   dan kotak yang jauh bisa disembunyikan murah (lihat Render.cullChunks).
   ------------------------------------------------------------------ */
const CH = 32;
const _m = new THREE.Matrix4(), _n = new THREE.Matrix3(), _v = new THREE.Vector3(), _c = new THREE.Color();
export class StaticBatch {
  constructor() { this.parts = new Map(); }
  // geo: BufferGeometry (boleh dipakai bersama), matrix: Matrix4 dunia, color: warna, mat: 'smooth' | 'block' | 'glass' | 'glow'
  add(geo, matrix, color, mat = 'smooth') {
    const e = matrix.elements, cx = Math.floor(e[12] / CH), cz = Math.floor(e[14] / CH);
    const key = `${cx},${cz},${mat}`;
    if (!this.parts.has(key)) this.parts.set(key, { cx, cz, mat, list: [], verts: 0, idx: 0 });
    const p = this.parts.get(key);
    p.list.push({ geo, matrix: matrix.clone(), color: _c.set(color).getHex() });
    p.verts += geo.attributes.position.count;
    p.idx += geo.index ? geo.index.count : geo.attributes.position.count;
  }
  // bentuk umum: kotak di (x,y,z) dengan ukuran (sx,sy,sz), putar yaw
  box(x, y, z, sx, sy, sz, color, { yaw = 0, round = 0, mat } = {}) {
    const geo = round ? roundedBox(sx, sy, sz, round) : boxGeo(sx, sy, sz);
    _m.makeRotationY(yaw).setPosition(x, y, z);
    this.add(geo, _m, color, mat || (round ? 'smooth' : 'block'));
  }
  geo(geo, x, y, z, color, { yaw = 0, sx = 1, sy = 1, sz = 1, mat = 'smooth', pitch = 0 } = {}) {
    _m.makeRotationFromEuler(new THREE.Euler(pitch, yaw, 0, 'YXZ'));
    _m.scale(_v.set(sx, sy, sz)).setPosition(x, y, z);
    this.add(geo, _m, color, mat);
  }
  build(scene, render) {
    const meshes = [];
    for (const p of this.parts.values()) {
      const pos = new Float32Array(p.verts * 3), nor = new Float32Array(p.verts * 3), uv = new Float32Array(p.verts * 2), col = new Float32Array(p.verts * 3);
      const index = p.verts > 65535 ? new Uint32Array(p.idx) : new Uint16Array(p.idx);
      let vo = 0, io = 0;
      for (const it of p.list) {
        const g = it.geo, gp = g.attributes.position, gn = g.attributes.normal, gu = g.attributes.uv;
        _n.getNormalMatrix(it.matrix); _c.setHex(it.color).convertSRGBToLinear();
        for (let i = 0; i < gp.count; i++) {
          _v.fromBufferAttribute(gp, i).applyMatrix4(it.matrix); pos.set([_v.x, _v.y, _v.z], (vo + i) * 3);
          _v.fromBufferAttribute(gn, i).applyMatrix3(_n).normalize(); nor.set([_v.x, _v.y, _v.z], (vo + i) * 3);
          if (gu) uv.set([gu.getX(i), gu.getY(i)], (vo + i) * 2);
          col.set([_c.r, _c.g, _c.b], (vo + i) * 3);
        }
        if (g.index) for (let i = 0; i < g.index.count; i++) index[io++] = g.index.getX(i) + vo;
        else for (let i = 0; i < gp.count; i++) index[io++] = i + vo;
        vo += gp.count;
      }
      const geo = new THREE.BufferGeometry();
      geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
      geo.setAttribute('normal', new THREE.BufferAttribute(nor, 3));
      geo.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
      geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
      geo.setIndex(new THREE.BufferAttribute(index, 1));
      geo.computeBoundingSphere(); geo.computeBoundingBox();
      const mesh = new THREE.Mesh(geo, MAT[p.mat]);
      mesh.castShadow = p.mat !== 'glass'; mesh.receiveShadow = true;
      mesh.matrixAutoUpdate = false; mesh.updateMatrix();
      if (p.mat === 'glass') mesh.renderOrder = 2;
      scene.add(mesh); meshes.push(mesh); render?.addChunk(mesh);
    }
    this.parts.clear();
    return meshes;
  }
}
