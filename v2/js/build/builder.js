// Mode Bangun bebas ala game builder 3D: bangun di mana saja di pulau. Bayangan balok mengikuti kursor/ketukan,
// menempel di tanah, bukit, atap rumah, atau sisi balok lain. Kuas 1×1 / 2×2 / 3×3, putar, hapus, cat,
// pipet, urungkan/ulangi. Balok milik teman tidak bisa dihapus/dicat, tapi boleh dibangun di sebelah/atasnya.
import * as THREE from '/lib/three.module.min.js';
import { SHAPES, partGeometry, cellBoxes } from './catalog.js';
import { colorOf } from './voxels.js';
import { BUILD_H, BUILD_MIN, onIsland, heightAt, CX, CZ } from '../world/kebun.js';
import { SFX, toast } from '../core/util.js';

const MAX_BLOCKS = 6000; // per pemain (jaga perangkat lama tetap lancar)

export class Builder {
  constructor({ scene, camera, voxels, canvas, physics }) {
    Object.assign(this, { scene, camera, voxels, canvas, physics });
    this.on = false; this.owner = null;
    this.shape = 0; this.color = 6; this.rot = 0; this.tool = 'place'; this.brush = 1;
    this.undoStack = []; this.redoStack = [];
    this.onChange = null; this.blocked = null; this.onPick = null;
    this.target = null;
    this.ray = new THREE.Raycaster(); this.ndc = new THREE.Vector2();
    this.ghost = new THREE.Group(); this.ghost.visible = false; scene.add(this.ghost);
    this.ghostMat = new THREE.MeshStandardMaterial({ color: '#ffffff', transparent: true, opacity: 0.55, depthWrite: false, emissive: '#ffffff', emissiveIntensity: 0.25 });
    this.outline = new THREE.LineSegments(new THREE.EdgesGeometry(new THREE.BoxGeometry(1, 1, 1)), new THREE.LineBasicMaterial({ color: '#ffffff', transparent: true, opacity: 0.95, depthTest: false }));
    this.outline.renderOrder = 20; this.outline.visible = false; scene.add(this.outline);
    // kisi kecil yang mengikuti kursor (bukan kavling kaku)
    this.grid = new THREE.GridHelper(13, 13, '#ffffff', '#ffffff');
    this.grid.material.transparent = true; this.grid.material.opacity = 0.35; this.grid.material.depthWrite = false; this.grid.visible = false;
    scene.add(this.grid);
    this._sb = [];
    this.setShape(0);
  }

  setOwner(owner) { this.owner = owner; this._count = null; }
  setOn(on) { this.on = on; this.ghost.visible = false; this.outline.visible = false; this.grid.visible = false; this.target = null; }
  setShape(i) {
    this.shape = i;
    while (this.ghost.children.length) this.ghost.remove(this.ghost.children[0]);
    this.ghostMeshes = [];
    for (let k = 0; k < 9; k++) { const g = new THREE.Group(); for (const p of SHAPES[i].parts) g.add(new THREE.Mesh(partGeometry(p), this.ghostMat)); this.ghost.add(g); this.ghostMeshes.push(g); }
    this.refreshGhost();
  }
  setColor(c) { this.color = c; this.refreshGhost(); }
  setTool(t) { this.tool = t; this.refreshGhost(); if (this.target) this.placeGhost(this.target); }
  setBrush(n) { this.brush = n; if (this.target) this.placeGhost(this.target); }
  rotate() { this.rot = (this.rot + 1) & 3; SFX.click(); if (this.target) this.placeGhost(this.target); }
  refreshGhost() {
    const c = this.tool === 'erase' ? '#ff5a5f' : colorOf(this.color);
    this.ghostMat.color.set(c); this.ghostMat.emissive.set(c);
  }

  // sel-sel yang terkena kuas, di bidang yang sejajar sisi yang diketuk
  brushCells(x, y, z, nx, ny, nz) {
    const n = this.brush, out = [], o = -Math.floor((n - 1) / 2);
    for (let a = 0; a < n; a++) for (let b = 0; b < n; b++) {
      const u = o + a, v = o + b;
      if (ny || (!nx && !nz)) out.push([x + u, y, z + v]); // lantai/atap
      else if (nx) out.push([x, y + a, z + u]);           // dinding menghadap x: tumbuh ke atas
      else out.push([x + u, y + a, z]);                    // dinding menghadap z
    }
    return out;
  }

  // titik layar -> sel tujuan (taruh) dan balok yang ditunjuk (hapus/cat/pipet)
  pick(cx, cy) {
    const r = this.canvas.getBoundingClientRect();
    this.ndc.set(((cx - r.left) / r.width) * 2 - 1, -((cy - r.top) / r.height) * 2 + 1);
    this.ray.setFromCamera(this.ndc, this.camera);
    const o = this.ray.ray.origin, d = this.ray.ray.direction;
    const hit = this.voxels.raycast(o, d, 160);
    // tanah, bukit, rumah, pohon (kotak diam)
    const st = this.physics.ray(o.x, o.y, o.z, d.x, d.y, d.z, 160, true);
    if (hit && hit.t <= st + 1e-3) return { cell: [hit.x + hit.nx, hit.y + hit.ny, hit.z + hit.nz], n: [hit.nx, hit.ny, hit.nz], block: [hit.x, hit.y, hit.z], b: hit.b };
    if (st < 160) {
      const px = o.x + d.x * (st - 0.02), py = o.y + d.y * (st - 0.02), pz = o.z + d.z * (st - 0.02);
      const cell = [Math.floor(px), Math.max(BUILD_MIN, Math.floor(py)), Math.floor(pz)];
      // sisi yang terkena = arah dari sel benda ke sel kosong (dipakai untuk arah kuas)
      const hx = o.x + d.x * (st + 0.02), hy = o.y + d.y * (st + 0.02), hz = o.z + d.z * (st + 0.02);
      const dx = cell[0] - Math.floor(hx), dy = cell[1] - Math.floor(hy), dz = cell[2] - Math.floor(hz);
      const n = Math.abs(dy) >= Math.abs(dx) && Math.abs(dy) >= Math.abs(dz) ? [0, 1, 0] : Math.abs(dx) >= Math.abs(dz) ? [Math.sign(dx), 0, 0] : [0, 0, Math.sign(dz)];
      return { cell, n, block: null, b: null };
    }
    return null;
  }

  hover(cx, cy) { if (!this.on) return; this.target = this.pick(cx, cy); this.placeGhost(this.target); }

  placeGhost(t) {
    this.ghost.visible = false; this.outline.visible = false;
    if (!t) { this.grid.visible = false; return; }
    const [x, y, z] = t.cell;
    this.grid.visible = true; this.grid.position.set(x + 0.5, y + 0.02, z + 0.5);
    if (this.tool === 'place') {
      const cells = this.brushCells(x, y, z, ...t.n);
      const okAll = cells.map((c) => this.canPlace(...c));
      const any = okAll.some(Boolean);
      this.ghost.visible = true;
      this.ghostMeshes.forEach((g, i) => {
        const c = cells[i]; g.visible = !!c && okAll[i];
        if (c) { g.position.set(c[0] + 0.5, c[1] + 0.5, c[2] + 0.5); g.rotation.y = -this.rot * Math.PI / 2; }
      });
      this.ghostMat.opacity = 0.55;
      this.outline.visible = true; this.outline.position.set(x + 0.5, y + 0.5, z + 0.5);
      this.outline.scale.setScalar(1.02);
      this.outline.material.color.set(any ? '#ffffff' : '#ff5a5f');
      if (!any) { this.ghostMeshes[0].visible = true; this.ghostMat.opacity = 0.2; }
    } else if (t.block) {
      const mine = t.b?.owner === this.owner;
      this.outline.visible = true; this.outline.position.set(t.block[0] + 0.5, t.block[1] + 0.5, t.block[2] + 0.5); this.outline.scale.setScalar(1.04);
      this.outline.material.color.set(this.tool === 'pick' ? '#ffffff' : mine ? (this.tool === 'erase' ? '#ff5a5f' : '#7cf0ff') : '#ff9f1c');
    }
  }

  // boleh menaruh di sel ini? (quiet=false: beri tahu alasannya)
  canPlace(x, y, z, quiet = true) {
    const why = (msg) => { if (!quiet) { toast(msg); SFX.bad(); } return false; };
    if (!this.owner) return why('Tunggu sebentar, sedang tersambung…');
    if (y < BUILD_MIN) return false;
    if (y >= BUILD_H) return why('Wah, terlalu tinggi! Sampai sini saja ya.');
    if (!onIsland(x + 0.5, z + 0.5)) return why('Bangun di daratan pulau ya, jangan di laut.');
    // tertimbun tanah seluruhnya? (sedikit masuk ke tanah boleh, supaya menempel di lereng)
    if (Math.min(heightAt(x + 0.5, z + 0.5), heightAt(x + 0.1, z + 0.1), heightAt(x + 0.9, z + 0.9), heightAt(x + 0.1, z + 0.9), heightAt(x + 0.9, z + 0.1)) > y + 0.98) return why('Itu di dalam tanah. Coba lebih ke atas.');
    if (this.voxels.has(x, y, z)) return why('Sudah ada balok di situ.');
    for (let k = 1; k <= 2; k++) { const b = this.voxels.get(x, y - k, z); if (b && (SHAPES[b.t].tall || 0) > k) return why('Ada pohon di situ.'); }
    const tall = SHAPES[this.shape].tall || 1;
    for (let k = 1; k < tall; k++) if (this.voxels.has(x, y + k, z)) return why('Pohon butuh ruang di atasnya.');
    if (this.count() >= MAX_BLOCKS) return why(`Balokmu sudah ${MAX_BLOCKS}. Hapus beberapa dulu ya.`);
    // menabrak rumah, pohon, air mancur, warga desa?
    if (this.physics.query(x + 0.05, y + 0.05, z + 0.05, x + 0.95, y + 0.95, z + 0.95, this._sb, false, true).some((b) => b.tag !== 'hill' || b.maxy > y + 0.05))
      return why('Ada benda di situ. Coba di sebelahnya.');
    if (this.blocked) for (const bx of cellBoxes(SHAPES[this.shape], x, y, z, this.rot, [])) if (this.blocked(bx)) return why('Minggir dulu, ada pemain di situ!');
    return true;
  }
  count() { return this._count ?? (this._count = this.voxels.ofOwner(this.owner).length); }

  tap(cx, cy) {
    const t = this.pick(cx, cy); this.target = t;
    if (!t) return;
    if (this.tool === 'place') {
      const cells = this.brushCells(...t.cell, ...t.n);
      const batch = [];
      for (const [x, y, z] of cells) {
        if (!this.canPlace(x, y, z, cells.length > 1)) continue;
        this.voxels.add(x, y, z, this.shape, this.color, this.rot, this.owner);
        batch.push({ k: 'add', x, y, z, t: this.shape, c: this.color, r: this.rot });
      }
      if (!batch.length) { if (cells.length > 1) { toast('Tidak ada tempat kosong di situ.'); SFX.bad(); } }
      else { this._count = (this._count ?? 0) + batch.length; this.push(batch.length === 1 ? batch[0] : { k: 'many', list: batch }); SFX.place(); }
    } else if (t.block) {
      const [x, y, z] = t.block, b = this.voxels.get(x, y, z);
      if (this.tool === 'pick') { this.rot = b.r; this.setShape(b.t); this.setColor(b.c); this.tool = 'place'; SFX.click(); this.onPick?.(b); return; }
      if (b.owner !== this.owner) { toast('Itu bangunan teman 🙂 Bangun di sebelahnya saja ya.'); SFX.bad(); return; }
      const cells = this.brushCells(x, y, z, ...t.n).filter(([a, bb, c]) => this.voxels.get(a, bb, c)?.owner === this.owner);
      const batch = [];
      for (const [a, bb, c] of cells) {
        const blk = this.voxels.get(a, bb, c);
        if (this.tool === 'erase') { this.voxels.remove(a, bb, c); batch.push({ k: 'del', x: a, y: bb, z: c, t: blk.t, c: blk.c, r: blk.r }); }
        else if (this.tool === 'paint' && blk.c !== this.color) { batch.push({ k: 'paint', x: a, y: bb, z: c, from: blk.c, to: this.color }); this.voxels.paint(a, bb, c, this.color); }
      }
      if (batch.length) {
        if (this.tool === 'erase') { this._count = Math.max(0, (this._count ?? batch.length) - batch.length); SFX.remove(); } else SFX.paint();
        this.push(batch.length === 1 ? batch[0] : { k: 'many', list: batch });
      }
    }
    this.placeGhost(this.pick(cx, cy));
  }
  push(a) { this.undoStack.push(a); if (this.undoStack.length > 300) this.undoStack.shift(); this.redoStack.length = 0; this.onChange?.(); }
  apply(a, back) {
    const V = this.voxels;
    if (a.k === 'many') { for (const x of back ? [...a.list].reverse() : a.list) this.apply(x, back); return; }
    if (a.k === 'add') { if (back) V.remove(a.x, a.y, a.z); else V.add(a.x, a.y, a.z, a.t, a.c, a.r, this.owner); }
    else if (a.k === 'del') { if (back) V.add(a.x, a.y, a.z, a.t, a.c, a.r, this.owner); else V.remove(a.x, a.y, a.z); }
    else if (a.k === 'paint') V.paint(a.x, a.y, a.z, back ? a.from : a.to);
    this._count = null;
  }
  undo() { const a = this.undoStack.pop(); if (!a) { toast('Tidak ada yang bisa diurungkan.'); return; } this.apply(a, true); this.redoStack.push(a); SFX.click(); this.onChange?.(); }
  redo() { const a = this.redoStack.pop(); if (!a) return; this.apply(a, false); this.undoStack.push(a); SFX.click(); this.onChange?.(); }

  // simpanan v2: [x, y, z, 'bentuk', warna, putar], x/z relatif pusat pulau
  serialize() {
    return this.voxels.ofOwner(this.owner).map((b) => [b.x - CX, b.y, b.z - CZ, SHAPES[b.t].id, b.c, b.r]);
  }
  // pusat bangunanku (untuk tombol pulang)
  center() {
    const list = this.voxels.ofOwner(this.owner); if (!list.length) return null;
    let x = 0, z = 0; for (const b of list) { x += b.x; z += b.z; }
    return [x / list.length, z / list.length];
  }
}
