// Gerak pemain ala game platform modern: percepatan/perlambatan halus, lompat dengan buffer dan coyote time,
// lompat lebih tinggi bila tombol ditahan, naik anak tangga otomatis, dan tabrakan per sumbu (tidak tembus dinding).
import { clamp, dampAngle } from './util.js';

const R = 0.38, H = 1.9;          // setengah lebar dan tinggi badan
const STEP = 0.6;                 // tinggi pijakan yang langsung dinaiki tanpa melompat
const GRAV = -32, JUMP_V = 11.2, MAX_FALL = -42;

export class Controller {
  constructor(physics) {
    this.ph = physics;
    this.pos = { x: 0, y: 0, z: 0 };
    this.vel = { x: 0, y: 0, z: 0 };
    this.facing = 0;
    this.onGround = true; this.coyote = 0; this.jumpBuf = 0; this.jumpHeld = false;
    this.speed = 0; this.landed = 0; this.airTime = 0;
    this.walk = 6.2; this.run = 9.4;
    this.fly = false; this.flyUp = 0; // terbang (Mode Bangun): flyUp -1..1
    this._b = [];
  }
  teleport(x, y, z) { Object.assign(this.pos, { x, y, z }); this.vel.x = this.vel.y = this.vel.z = 0; this.unstick(); }
  jump() { this.jumpBuf = 0.16; }

  // ix, iz: arah masukan di ruang dunia (panjang 0..1); running: lari
  update(dt, ix, iz, running = false) {
    dt = Math.min(dt, 0.05);
    const want = running ? this.run : this.walk;
    const len = Math.hypot(ix, iz), tx = ix * want, tz = iz * want;
    const accel = this.onGround ? (len > 0.05 ? 46 : 38) : 16;
    // mendekati kecepatan tujuan dengan batas percepatan (terasa berat tapi responsif)
    const dvx = tx - this.vel.x, dvz = tz - this.vel.z, dl = Math.hypot(dvx, dvz), maxDv = accel * dt;
    if (dl > maxDv) { this.vel.x += (dvx / dl) * maxDv; this.vel.z += (dvz / dl) * maxDv; } else { this.vel.x = tx; this.vel.z = tz; }
    this.speed = Math.hypot(this.vel.x, this.vel.z);
    if (len > 0.05) this.facing = dampAngle(this.facing, Math.atan2(ix, iz), 14, dt);

    let jumped = false;
    if (this.fly) {
      // terbang: tanpa gravitasi, naik/turun sesuai tombol, tetap menabrak balok
      this.vel.y += ((this.flyUp * 9) - this.vel.y) * Math.min(1, dt * 8);
      this.jumpBuf = 0;
    } else {
    // lompat
    this.coyote = this.onGround ? 0.12 : Math.max(0, this.coyote - dt);
    this.jumpBuf = Math.max(0, this.jumpBuf - dt);
    if (this.jumpBuf > 0 && this.coyote > 0) { this.vel.y = JUMP_V; this.jumpBuf = 0; this.coyote = 0; this.onGround = false; jumped = true; }
    // tombol dilepas di awal lompatan: lompatan lebih pendek (anak bisa mengatur tinggi)
    const g = this.vel.y > 0 && !this.jumpHeld ? GRAV * 1.9 : this.vel.y < 0 ? GRAV * 1.25 : GRAV;
    this.vel.y = Math.max(MAX_FALL, this.vel.y + g * dt);
    }

    // gerak per sumbu dengan langkah kecil supaya tidak menembus balok tipis
    const steps = Math.ceil(Math.max(Math.abs(this.vel.x), Math.abs(this.vel.z), Math.abs(this.vel.y)) * dt / 0.3) || 1;
    const sdt = dt / steps;
    const wasGround = this.onGround, fallV = this.vel.y, x0 = this.pos.x, z0 = this.pos.z;
    this.onGround = false;
    for (let i = 0; i < steps; i++) {
      this.moveAxis('x', this.vel.x * sdt, wasGround);
      this.moveAxis('z', this.vel.z * sdt, wasGround);
      this.moveY(this.vel.y * sdt);
    }
    if (this.ph.bound) this.ph.bound(this.pos, this.vel);
    // air dalam / tepi dunia: kembali ke posisi sebelumnya (meluncur di sepanjang tepi)
    if (this.ph.walkable && !this.ph.walkable(this.pos.x, this.pos.z, this.pos.y, this.fly)) {
      if (this.ph.walkable(this.pos.x, z0, this.pos.y, this.fly)) this.pos.z = z0;
      else if (this.ph.walkable(x0, this.pos.z, this.pos.y, this.fly)) this.pos.x = x0;
      else { this.pos.x = x0; this.pos.z = z0; }
    }
    if (this.fly && this.pos.y > 125) { this.pos.y = 125; this.vel.y = Math.min(0, this.vel.y); }
    // menempel ke tanah saat menuruni anak tangga (tidak "melayang" sebentar)
    if (!this.fly && !this.onGround && wasGround && !jumped && this.vel.y <= 0) {
      const drop = this.groundBelow(STEP + 0.05);
      if (drop !== null) { this.pos.y = drop; this.onGround = true; this.vel.y = 0; }
    }
    this.landed = 0;
    if (this.onGround && !wasGround) { this.landed = -fallV; }
    this.airTime = this.onGround ? 0 : this.airTime + dt;
    return { jumped };
  }

  aabb(x = this.pos.x, y = this.pos.y, z = this.pos.z) { return [x - R, y, z - R, x + R, y + H, z + R]; }

  moveAxis(ax, d, canStep) {
    if (!d) return;
    const p = this.pos;
    p[ax] += d;
    const [a, b, c, e, f, h] = this.aabb();
    const hits = this.ph.query(a, b + 0.001, c, e, f, h, this._b);
    if (!hits.length) return;
    // coba naik anak tangga: rintangan rendah di depan kaki
    if (canStep || this.onGround) {
      let top = -Infinity;
      for (const k of hits) top = Math.max(top, k.maxy);
      if (top - p.y <= STEP && top - p.y > 0) {
        const [a2, b2, c2, e2, f2, h2] = this.aabb(p.x, top + 0.001, p.z);
        if (!this.ph.query(a2, b2, c2, e2, f2, h2, this._b).length) { p.y = top; this.vel.y = Math.max(0, this.vel.y); this.onGround = true; return; }
      }
    }
    // dorong keluar di sumbu ini saja
    for (const k of this.ph.query(a, b + 0.001, c, e, f, h, this._b)) {
      if (ax === 'x') p.x = d > 0 ? Math.min(p.x, k.minx - R - 1e-4) : Math.max(p.x, k.maxx + R + 1e-4);
      else p.z = d > 0 ? Math.min(p.z, k.minz - R - 1e-4) : Math.max(p.z, k.maxz + R + 1e-4);
    }
    if (ax === 'x') this.vel.x *= 0.0; else this.vel.z *= 0.0;
  }

  moveY(d) {
    const p = this.pos;
    p.y += d;
    const gy = this.ph.ground(p.x, p.z);
    if (p.y <= gy) { p.y = gy; if (this.vel.y < 0) this.vel.y = 0; this.onGround = true; }
    const [a, b, c, e, f, h] = this.aabb();
    for (const k of this.ph.query(a, b, c, e, f, h, this._b)) {
      if (d <= 0) { if (k.maxy - p.y < 0.75) { p.y = k.maxy; this.vel.y = 0; this.onGround = true; } }
      else { p.y = Math.min(p.y, k.miny - H - 1e-4); this.vel.y = Math.min(0, this.vel.y); }
    }
  }

  groundBelow(maxDrop) {
    const p = this.pos;
    let best = this.ph.ground(p.x, p.z);
    const [a, , c, e, f, h] = this.aabb();
    for (const k of this.ph.query(a, p.y - maxDrop, c, e, p.y + 0.01, h, this._b)) best = Math.max(best, k.maxy);
    void f;
    return p.y - best <= maxDrop && p.y - best >= 0 ? best : null;
  }

  // keluar dari dalam balok (mis. teman membangun di tempat kita berdiri): naik ke atasnya
  unstick() {
    for (let i = 0; i < 40; i++) {
      const [a, b, c, e, f, h] = this.aabb();
      const hits = this.ph.query(a + 0.02, b + 0.02, c + 0.02, e - 0.02, f - 0.02, h - 0.02, this._b);
      if (!hits.length) return;
      let top = this.pos.y; for (const k of hits) top = Math.max(top, k.maxy);
      this.pos.y = top + 0.001;
    }
  }
}
export const BODY = { R, H };
export { clamp };
