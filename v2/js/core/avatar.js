// Karakter ala Roblox: kepala besar membulat dengan wajah, badan, lengan, dan kaki bersendi.
// Animasi prosedural yang dibaurkan halus: diam (bernapas), jalan, lari, lompat, jatuh, mendarat (memantul).
import * as THREE from '/lib/three.module.min.js';
import { roundedBox, cylGeo, coneGeo, sphereGeo } from './geo.js';
import { damp, clamp } from './util.js';

// warna sama dengan game lama (simpanan pemain memakai nama warna)
export const COLORS = {
  merah: '#e8434b', oranye: '#ff8a2a', kuning: '#ffd23a', hijau: '#3fb25a', biru: '#3a7cf5', ungu: '#9a62e0',
  'merah muda': '#ff8fc0', hitam: '#2c2f3a', putih: '#f4f4f4', cokelat: '#8a5a35',
};
export const SKINS = ['#f6d2b4', '#e3ac83', '#b97a52', '#7e4e2f'];

const mat = (c, rough = 0.55) => new THREE.MeshStandardMaterial({ color: c, roughness: rough, metalness: 0.02 });

function faceTexture(girl) {
  const c = document.createElement('canvas'); c.width = c.height = 128;
  const g = c.getContext('2d');
  g.fillStyle = '#20232e';
  // mata besar berkilau
  for (const x of [42, 86]) {
    g.beginPath(); g.ellipse(x, 62, 9, 12, 0, 0, Math.PI * 2); g.fill();
    g.fillStyle = '#fff'; g.beginPath(); g.arc(x + 3, 57, 3.5, 0, Math.PI * 2); g.fill(); g.fillStyle = '#20232e';
    if (girl) { g.lineWidth = 3; g.strokeStyle = '#20232e'; g.beginPath(); g.moveTo(x - 9, 50); g.lineTo(x - 14, 45); g.stroke(); }
  }
  // senyum
  g.lineWidth = 6; g.lineCap = 'round'; g.strokeStyle = '#20232e';
  g.beginPath(); g.arc(64, 78, 16, 0.2 * Math.PI, 0.8 * Math.PI); g.stroke();
  // pipi merah
  g.fillStyle = 'rgba(255,110,120,.45)';
  for (const x of [28, 100]) { g.beginPath(); g.ellipse(x, 84, 9, 6, 0, 0, Math.PI * 2); g.fill(); }
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

function hatMesh(kind) {
  const g = new THREE.Group();
  const add = (geo, color, x, y, z, sx = 1, sy = 1, sz = 1, rx = 0) => { const m = new THREE.Mesh(geo, mat(color)); m.position.set(x, y, z); m.scale.set(sx, sy, sz); m.rotation.x = rx; m.castShadow = true; g.add(m); return m; };
  switch (kind) {
    case 'caping': add(coneGeo(0.95, 0.42, 16), '#e6c47a', 0, 0.62, 0); break;
    case 'mahkota': case 'emas': case 'pelangi2':
      add(cylGeo(0.42, 0.42, 0.22, 10), kind === 'pelangi2' ? '#b36bf2' : '#ffcf33', 0, 0.62, 0);
      for (let i = 0; i < 5; i++) { const a = (i / 5) * Math.PI * 2; add(coneGeo(0.09, 0.22, 4), '#ffd84a', Math.sin(a) * 0.38, 0.82, Math.cos(a) * 0.38); }
      break;
    case 'kerucut': add(coneGeo(0.32, 0.8, 12), '#ff5aa0', 0, 0.92, 0); add(sphereGeo(0.09), '#ffd23a', 0, 1.34, 0); break;
    case 'peci': add(cylGeo(0.47, 0.47, 0.28, 16), '#1d1f29', 0, 0.64, 0, 1, 1, 0.82); break;
    case 'koboi': add(cylGeo(0.85, 0.85, 0.05, 18), '#8a5a35', 0, 0.52, 0); add(cylGeo(0.36, 0.42, 0.42, 14), '#8a5a35', 0, 0.74, 0); break;
    case 'bajak': add(cylGeo(0.5, 0.55, 0.32, 3), '#20232e', 0, 0.68, 0, 1.4, 1, 0.8); break;
    case 'astronot': { const m = add(sphereGeo(0.78, 18, 12), '#eef3ff', 0, 0.02, 0); m.material.transparent = true; m.material.opacity = 0.35; break; }
    case 'tinggi': add(cylGeo(0.36, 0.36, 0.7, 14), '#20232e', 0, 0.9, 0); add(cylGeo(0.62, 0.62, 0.05, 16), '#20232e', 0, 0.56, 0); break;
    case 'polisi': case 'pemadam': add(cylGeo(0.48, 0.5, 0.3, 14), kind === 'polisi' ? '#1f3f8f' : '#e8434b', 0, 0.64, 0); add(roundedBox(0.7, 0.06, 0.32, 0.02), '#20232e', 0, 0.52, 0.44); break;
    case 'koki': add(cylGeo(0.46, 0.4, 0.5, 14), '#ffffff', 0, 0.8, 0); add(sphereGeo(0.5, 14, 8), '#ffffff', 0, 1.08, 0, 1, 0.55, 1); break;
    case 'none': default: return null;
  }
  return g;
}

export class Avatar {
  constructor(look = {}) {
    this.root = new THREE.Group();
    this.body = new THREE.Group(); this.root.add(this.body); // untuk memantul/condong tanpa mengubah posisi
    this.parts = {};
    this.t = 0; this.walkPhase = 0; this.blend = 0; this.air = 0; this.squash = 0; this.lean = 0;
    this.build(look);
  }
  build(look) {
    while (this.body.children.length) this.body.remove(this.body.children[0]);
    const shirt = COLORS[look.shirt] || look.shirt || COLORS.biru, pants = COLORS[look.pants] || look.pants || COLORS.hitam;
    const skin = SKINS[look.skin ?? 1] || SKINS[1], girl = look.gender === 'P';
    this.mats = { shirt: mat(shirt), pants: mat(pants), skin: mat(skin), hair: mat(girl ? '#3b2416' : '#2a1d14', 0.7) };
    const part = (geo, m, parent, x, y, z) => { const me = new THREE.Mesh(geo, m); me.position.set(x, y, z); me.castShadow = true; me.receiveShadow = false; parent.add(me); return me; };
    const pivot = (parent, x, y, z) => { const g = new THREE.Group(); g.position.set(x, y, z); parent.add(g); return g; };
    // ukuran mengikuti proporsi khas Roblox (badan 2x2x1, kepala besar), skala 0.48
    const hips = pivot(this.body, 0, 0.95, 0);
    const torso = part(roundedBox(0.92, 0.9, 0.5, 0.12), this.mats.shirt, hips, 0, 0.45, 0);
    const neck = pivot(hips, 0, 0.92, 0);
    const head = pivot(neck, 0, 0, 0);
    part(roundedBox(0.78, 0.74, 0.74, 0.22), this.mats.skin, head, 0, 0.4, 0);
    const face = new THREE.Mesh(new THREE.PlaneGeometry(0.62, 0.62), new THREE.MeshBasicMaterial({ map: faceTexture(girl), transparent: true }));
    face.position.set(0, 0.38, 0.375); head.add(face);
    part(roundedBox(0.82, 0.24, 0.8, 0.12), this.mats.hair, head, 0, 0.71, -0.02);
    part(roundedBox(0.82, 0.42, 0.22, 0.1), this.mats.hair, head, 0, 0.52, -0.3);
    if (girl) { part(roundedBox(0.2, 0.62, 0.3, 0.09), this.mats.hair, head, -0.42, 0.3, -0.12); part(roundedBox(0.2, 0.62, 0.3, 0.09), this.mats.hair, head, 0.42, 0.3, -0.12); }
    const hat = hatMesh(look.hat); if (hat) { hat.position.y = 0.1; head.add(hat); }
    const armL = pivot(hips, -0.62, 0.82, 0), armR = pivot(hips, 0.62, 0.82, 0);
    for (const a of [armL, armR]) { part(roundedBox(0.34, 0.5, 0.42, 0.1), this.mats.shirt, a, 0, -0.18, 0); part(roundedBox(0.3, 0.42, 0.38, 0.1), this.mats.skin, a, 0, -0.6, 0); }
    const legL = pivot(hips, -0.24, 0, 0), legR = pivot(hips, 0.24, 0, 0);
    for (const l of [legL, legR]) { part(roundedBox(0.42, 0.78, 0.46, 0.1), this.mats.pants, l, 0, -0.4, 0); part(roundedBox(0.44, 0.18, 0.54, 0.07), mat('#2b2b34'), l, 0, -0.86, 0.04); }
    Object.assign(this.parts, { hips, torso, neck, head, armL, armR, legL, legR });
  }
  setLook(look) { this.build(look); }

  // speed: m/s datar, onGround, vy, landed: kecepatan saat mendarat (0 bila tidak)
  update(dt, { speed = 0, onGround = true, vy = 0, landed = 0, accel = 0 } = {}) {
    const P = this.parts; this.t += dt;
    const move = clamp(speed / 9.4, 0, 1);
    this.blend = damp(this.blend, onGround ? move : 0, 10, dt);
    this.air = damp(this.air, onGround ? 0 : 1, 14, dt);
    this.walkPhase += dt * (4 + speed * 1.15) * (onGround ? 1 : 0.2);
    if (landed > 6) this.squash = Math.min(1, landed / 26);
    this.squash = damp(this.squash, 0, 9, dt);
    this.lean = damp(this.lean, clamp(accel * 0.012, -0.12, 0.12) + move * 0.1, 6, dt);
    const s = Math.sin(this.walkPhase), b = this.blend, a = this.air;
    const swing = (0.25 + 0.75 * b) * b;
    // kaki & lengan berayun berlawanan
    P.legL.rotation.x = s * 0.95 * swing - a * 0.55;
    P.legR.rotation.x = -s * 0.95 * swing + a * 0.25;
    P.armL.rotation.x = -s * 0.85 * swing + a * (vy > 0 ? -2.6 : -1.9);
    P.armR.rotation.x = s * 0.85 * swing + a * (vy > 0 ? -2.6 : -1.9);
    P.armL.rotation.z = -0.06 - a * 0.25; P.armR.rotation.z = 0.06 + a * 0.25;
    // napas saat diam, memantul saat berjalan, gepeng sebentar saat mendarat
    const breathe = Math.sin(this.t * 2.2) * 0.015 * (1 - b);
    const bob = Math.abs(Math.cos(this.walkPhase)) * 0.09 * b;
    P.hips.position.y = 0.95 + bob + breathe - this.squash * 0.22;
    this.body.scale.set(1 + this.squash * 0.12, 1 - this.squash * 0.14, 1 + this.squash * 0.12);
    P.hips.rotation.x = this.lean;
    P.hips.rotation.y = s * 0.08 * b;
    P.neck.rotation.x = -this.lean * 0.6 + Math.sin(this.t * 1.1) * 0.02 * (1 - b);
    P.neck.rotation.y = Math.sin(this.t * 0.5) * 0.12 * (1 - b);
  }
}

// papan nama di atas kepala
export function nameTag(text, color = '#ffffff') {
  const c = document.createElement('canvas'); c.width = 320; c.height = 80;
  const g = c.getContext('2d');
  g.font = '800 40px "Baloo 2", system-ui, sans-serif';
  const w = Math.min(310, g.measureText(text).width + 44);
  g.fillStyle = 'rgba(29,43,83,.72)';
  const x = (320 - w) / 2; g.beginPath(); g.roundRect(x, 8, w, 62, 31); g.fill();
  g.fillStyle = color; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(text, 160, 41);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: t, depthTest: false, transparent: true }));
  s.scale.set(2.4, 0.6, 1); s.renderOrder = 10;
  return s;
}
