// Kamera orang ketiga ala Roblox: mengorbit pemain, mengikuti dengan halus, zoom, dan TIDAK menembus
// dinding/pohon/bangunan (maju mendekati pemain bila terhalang, mundur pelan saat jalan bebas).
import * as THREE from '/lib/three.module.min.js';
import { clamp, damp } from './util.js';

export class FollowCamera {
  constructor(camera, physics) {
    this.cam = camera; this.ph = physics;
    this.yaw = Math.PI; this.pitch = 0.32;     // yaw = arah kamera mengelilingi pemain
    this.dist = 9; this.wantDist = 9; this.minDist = 2.2; this.maxDist = 28;
    this.cur = 9;                               // jarak sebenarnya setelah dihalangi
    this.target = new THREE.Vector3();
    this.autoFollow = true; this.idle = 0;
    this.shake = 0;
  }
  orbit(dx, dy) { this.yaw -= dx; this.pitch = clamp(this.pitch + dy, -0.35, 1.35); this.idle = 0; }
  zoom(f) { this.wantDist = clamp(this.wantDist * f, this.minDist, this.maxDist); this.idle = 0; }
  // arah maju di bidang tanah (untuk mengubah masukan joystick menjadi arah dunia)
  forward() { return { x: -Math.sin(this.yaw), z: -Math.cos(this.yaw) }; }

  update(dt, focus, moving, facing, buildMode) {
    // pusat pandang di kepala pemain, sedikit tertinggal supaya terasa halus
    const fy = focus.y + (buildMode ? 1.2 : 1.7);
    this.target.x = damp(this.target.x, focus.x, 18, dt);
    this.target.z = damp(this.target.z, focus.z, 18, dt);
    this.target.y = damp(this.target.y, fy, Math.abs(this.target.y - fy) > 3 ? 20 : 10, dt);
    // berjalan lama tanpa memutar kamera: kamera pelan-pelan berputar ke belakang pemain (bisa dimatikan)
    this.idle += dt;
    if (this.autoFollow && moving && this.idle > 1.6 && !buildMode) {
      const behind = facing + Math.PI;
      const d = Math.atan2(Math.sin(behind - this.yaw), Math.cos(behind - this.yaw));
      if (Math.abs(d) < 2.4) this.yaw += d * (1 - Math.exp(-0.9 * dt));
    }
    this.dist = damp(this.dist, this.wantDist, 10, dt);
    const cp = Math.cos(this.pitch), dir = new THREE.Vector3(Math.sin(this.yaw) * cp, Math.sin(this.pitch), Math.cos(this.yaw) * cp);
    // terhalang? dekatkan langsung; bebas lagi? mundur pelan
    const hit = this.ph.ray(this.target.x, this.target.y, this.target.z, dir.x, dir.y, dir.z, this.dist + 0.4);
    const allowed = Math.max(0.6, hit - 0.4);
    this.cur = allowed < this.cur ? allowed : damp(this.cur, allowed, 4, dt);
    this.cur = Math.min(this.cur, this.dist);
    this.cam.position.copy(this.target).addScaledVector(dir, this.cur);
    if (this.shake > 0) {
      this.shake = Math.max(0, this.shake - dt * 3);
      this.cam.position.y += (Math.random() - 0.5) * this.shake * 0.25;
    }
    this.cam.lookAt(this.target);
    return this.cur;
  }
}
