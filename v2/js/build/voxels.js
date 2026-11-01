// Penyimpan balok bangunan seluruh pulau (kisi 1 m dunia) + penggambaran InstancedMesh per bagian bentuk.
// Menambah/menghapus satu balok hanya mengubah satu instance (swap-remove), jadi membangun tetap mulus.
import * as THREE from '/lib/three.module.min.js';
import { SHAPES, PALETTE, cellBoxes, partGeometry } from './catalog.js';
import { MAT } from '../core/geo.js';

const key = (x, y, z) => `${x}|${y}|${z}`;
// warna: nomor palet (0-15) atau warna bebas '#rrggbb'
export const colorOf = (c) => (typeof c === 'string' ? c : PALETTE[c] ?? '#ffffff');
const _m = new THREE.Matrix4(), _q = new THREE.Quaternion(), _p = new THREE.Vector3(), _s = new THREE.Vector3(1, 1, 1), _c = new THREE.Color(), _up = new THREE.Vector3(0, 1, 0);

class PartMesh {
  constructor(scene, shape, part) {
    this.scene = scene; this.shape = shape; this.part = part;
    this.cap = 0; this.mesh = null; this.items = []; // items[i] = block
    this.grow(64);
  }
  grow(n) {
    const old = this.mesh;
    this.cap = n;
    const mesh = new THREE.InstancedMesh(partGeometry(this.part), MAT[this.part.mat], n);
    mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    mesh.castShadow = this.part.mat !== 'glass'; mesh.receiveShadow = true;
    mesh.frustumCulled = false; // banyak pulau kecil: batas bola dihitung ulang sendiri
    if (this.part.mat === 'glass') mesh.renderOrder = 2;
    mesh.count = 0;
    if (old) {
      for (let i = 0; i < old.count; i++) { old.getMatrixAt(i, _m); mesh.setMatrixAt(i, _m); old.getColorAt(i, _c); mesh.setColorAt(i, _c); }
      mesh.count = old.count; this.scene.remove(old); old.dispose();
    } else mesh.setColorAt(0, _c.set('#fff'));
    this.mesh = mesh; this.scene.add(mesh);
  }
  write(i, b) {
    _p.set(b.x + 0.5, b.y + 0.5, b.z + 0.5); _q.setFromAxisAngle(_up, -(b.r & 3) * Math.PI / 2);
    this.mesh.setMatrixAt(i, _m.compose(_p, _q, _s));
    const fixed = this.part.fixed, tint = !fixed;
    this.mesh.setColorAt(i, _c.set(tint ? colorOf(b.c) : fixed));
  }
  add(b) {
    if (this.mesh.count >= this.cap) this.grow(this.cap * 2);
    const i = this.mesh.count++;
    this.items[i] = b; b.slots ||= []; b.slots.push([this, i]);
    this.write(i, b); this.dirty = true;
  }
  remove(b, i) {
    const last = this.mesh.count - 1, moved = this.items[last];
    if (i !== last) {
      this.items[i] = moved; this.mesh.getMatrixAt(last, _m); this.mesh.setMatrixAt(i, _m); this.mesh.getColorAt(last, _c); this.mesh.setColorAt(i, _c);
      for (const s of moved.slots) if (s[0] === this && s[1] === last) s[1] = i;
    }
    this.items.length = last; this.mesh.count = last; this.dirty = true;
  }
  flush() {
    if (!this.dirty) return;
    this.mesh.instanceMatrix.needsUpdate = true;
    if (this.mesh.instanceColor) this.mesh.instanceColor.needsUpdate = true;
    this.dirty = false;
  }
}

export class Voxels {
  constructor(scene) {
    this.scene = scene;
    this.map = new Map();
    this.cols = new Map(); // "x|z" kolom -> jumlah balok (cepat untuk tabrakan)
    this.parts = SHAPES.map((s) => s.parts.map((p) => new PartMesh(scene, s, p)));
    this.lights = new Set();
    this._b = [];
    this.version = 0;
  }
  get(x, y, z) { return this.map.get(key(x, y, z)); }
  has(x, y, z) { return this.map.has(key(x, y, z)); }
  // tambah balok; owner = kunci pemain pemilik kavling
  add(x, y, z, t, c, r, owner) {
    const k = key(x, y, z);
    if (this.map.has(k)) this.remove(x, y, z);
    const shape = SHAPES[t]; if (!shape) return null;
    const b = { x, y, z, t, c, r: r & 3, owner, slots: [] };
    this.map.set(k, b);
    const ck = `${x}|${z}`; this.cols.set(ck, (this.cols.get(ck) || 0) + 1);
    for (const pm of this.parts[t]) pm.add(b);
    if (shape.light) this.lights.add(b);
    this.version++;
    return b;
  }
  remove(x, y, z) {
    const k = key(x, y, z), b = this.map.get(k); if (!b) return null;
    this.map.delete(k);
    const ck = `${x}|${z}`, n = (this.cols.get(ck) || 1) - 1; if (n) this.cols.set(ck, n); else this.cols.delete(ck);
    for (const [pm, i] of [...b.slots].sort((p, q) => q[1] - p[1])) pm.remove(b, i);
    b.slots.length = 0; this.lights.delete(b);
    this.version++;
    return b;
  }
  paint(x, y, z, c) {
    const b = this.get(x, y, z); if (!b) return null;
    b.c = c; for (const [pm, i] of b.slots) { pm.write(i, b); pm.dirty = true; }
    this.version++;
    return b;
  }
  rotate(x, y, z, r) {
    const b = this.get(x, y, z); if (!b) return null;
    b.r = r & 3; for (const [pm, i] of b.slots) { pm.write(i, b); pm.dirty = true; }
    this.version++;
    return b;
  }
  clearOwner(owner) { for (const b of [...this.map.values()]) if (b.owner === owner) this.remove(b.x, b.y, b.z); }
  ofOwner(owner) { const out = []; for (const b of this.map.values()) if (b.owner === owner) out.push(b); return out; }
  flush() { for (const list of this.parts) for (const pm of list) pm.flush(); }

  // sumber tabrakan untuk Physics
  boxesIn(minx, miny, minz, maxx, maxy, maxz, out) {
    if (!this.map.size) return out;
    for (let x = Math.floor(minx); x <= Math.floor(maxx); x++)
      for (let z = Math.floor(minz); z <= Math.floor(maxz); z++) {
        if (!this.cols.has(`${x}|${z}`)) continue;
        for (let y = Math.floor(miny); y <= Math.floor(maxy); y++) {
          const b = this.map.get(key(x, y, z)); if (!b) continue;
          for (const k of cellBoxes(SHAPES[b.t], x, y, z, b.r, [])) if (k.maxx > minx && k.minx < maxx && k.maxy > miny && k.miny < maxy && k.maxz > minz && k.minz < maxz) out.push(k);
        }
      }
    return out;
  }

  // sinar 3D (DDA) melewati sel kisi; kembali ke sel pertama yang berisi balok + normal sisi yang terkena
  raycast(o, d, maxDist = 80) {
    let x = Math.floor(o.x), y = Math.floor(o.y), z = Math.floor(o.z);
    const sx = Math.sign(d.x), sy = Math.sign(d.y), sz = Math.sign(d.z);
    const tdx = sx ? Math.abs(1 / d.x) : Infinity, tdy = sy ? Math.abs(1 / d.y) : Infinity, tdz = sz ? Math.abs(1 / d.z) : Infinity;
    let tmx = sx ? ((sx > 0 ? x + 1 - o.x : o.x - x) * tdx) : Infinity;
    let tmy = sy ? ((sy > 0 ? y + 1 - o.y : o.y - y) * tdy) : Infinity;
    let tmz = sz ? ((sz > 0 ? z + 1 - o.z : o.z - z) * tdz) : Infinity;
    let t = 0, nx = 0, ny = 0, nz = 0;
    for (let i = 0; i < 400 && t <= maxDist; i++) {
      const b = this.map.get(key(x, y, z));
      if (b) return { b, x, y, z, nx, ny, nz, t };
      if (tmx < tmy && tmx < tmz) { x += sx; t = tmx; tmx += tdx; nx = -sx; ny = 0; nz = 0; }
      else if (tmy < tmz) { y += sy; t = tmy; tmy += tdy; nx = 0; ny = -sy; nz = 0; }
      else { z += sz; t = tmz; tmz += tdz; nx = 0; ny = 0; nz = -sz; }
      if (y < -8 && sy < 0) break;
    }
    return null;
  }
}
