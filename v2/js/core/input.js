// Masukan: keyboard (WASD/panah, spasi, shift), mouse (seret kanan/kiri = putar kamera, roda = zoom),
// sentuh (joystick kiri bawah, seret di tempat lain = putar kamera, cubit = zoom, ketuk = aksi).
import { IS_TOUCH } from './util.js';

export class Input {
  constructor(canvas, stickEl) {
    this.canvas = canvas; this.stickEl = stickEl; this.knob = stickEl?.querySelector('.knob');
    this.keys = new Set();
    this.move = { x: 0, y: 0 };            // -1..1, y negatif = maju
    this.look = { dx: 0, dy: 0 };          // dikumpulkan per frame
    this.zoom = 1;
    this.jumpHeld = false; this.jumpPressed = false; this.run = false;
    this.onTap = null; this.onHover = null; this.onKey = null;
    this.pointers = new Map();
    this.stick = { id: null, ox: 0, oy: 0 };
    this.pinch = 0;
    this.enabled = true;
    this.bind();
  }
  bind() {
    addEventListener('keydown', (e) => {
      if (e.target.closest?.('input, textarea')) return;
      const k = e.key.toLowerCase();
      if (!this.keys.has(k)) {
        if (k === ' ') { this.jumpPressed = true; }
        this.onKey?.(k, e);
      }
      this.keys.add(k);
      if (k === ' ') { this.jumpHeld = true; e.preventDefault(); }
    });
    addEventListener('keyup', (e) => { const k = e.key.toLowerCase(); this.keys.delete(k); if (k === ' ') this.jumpHeld = false; });
    addEventListener('blur', () => { this.keys.clear(); this.jumpHeld = false; this.resetStick(); });
    const c = this.canvas;
    c.addEventListener('contextmenu', (e) => e.preventDefault());
    c.addEventListener('wheel', (e) => { e.preventDefault(); this.zoom *= Math.exp(e.deltaY * 0.0012); }, { passive: false });
    c.addEventListener('pointerdown', (e) => this.down(e));
    addEventListener('pointermove', (e) => this.moveP(e));
    addEventListener('pointerup', (e) => this.up(e));
    addEventListener('pointercancel', (e) => this.up(e, true));
    // joystick: area kiri bawah (lingkaran) — bisa disentuh bersamaan dengan memutar kamera
    if (this.stickEl) {
      this.stickEl.addEventListener('pointerdown', (e) => {
        e.preventDefault(); e.stopPropagation();
        const r = this.stickEl.getBoundingClientRect();
        this.stick = { id: e.pointerId, ox: r.left + r.width / 2, oy: r.top + r.height / 2, rad: r.width / 2 };
        try { this.stickEl.setPointerCapture?.(e.pointerId); } catch (er) { /* pointer sintetis */ }
        this.stickMove(e);
      });
      this.stickEl.addEventListener('pointermove', (e) => { if (e.pointerId === this.stick.id) this.stickMove(e); });
      const end = (e) => { if (e.pointerId === this.stick.id) this.resetStick(); };
      this.stickEl.addEventListener('pointerup', end); this.stickEl.addEventListener('pointercancel', end);
    }
  }
  stickMove(e) {
    const s = this.stick; let dx = e.clientX - s.ox, dy = e.clientY - s.oy;
    const d = Math.hypot(dx, dy), max = s.rad * 0.75;
    if (d > max) { dx = (dx / d) * max; dy = (dy / d) * max; }
    this.move.x = dx / max; this.move.y = dy / max;
    if (this.knob) this.knob.style.transform = `translate(${dx}px, ${dy}px)`;
  }
  resetStick() { this.stick.id = null; this.move.x = 0; this.move.y = 0; if (this.knob) this.knob.style.transform = ''; }

  down(e) {
    if (!this.enabled) return;
    try { this.canvas.setPointerCapture?.(e.pointerId); } catch (er) { /* pointer sintetis */ }
    this.pointers.set(e.pointerId, { x: e.clientX, y: e.clientY, sx: e.clientX, sy: e.clientY, t: performance.now(), btn: e.button, moved: 0, type: e.pointerType });
    if (this.pointers.size === 2) { const [a, b] = [...this.pointers.values()]; this.pinch = Math.hypot(a.x - b.x, a.y - b.y); }
  }
  moveP(e) {
    const p = this.pointers.get(e.pointerId);
    if (!p) { if (e.target === this.canvas && e.pointerType === 'mouse') this.onHover?.(e.clientX, e.clientY); return; }
    const dx = e.clientX - p.x, dy = e.clientY - p.y;
    p.x = e.clientX; p.y = e.clientY; p.moved += Math.abs(dx) + Math.abs(dy);
    if (this.pointers.size === 2) {
      const [a, b] = [...this.pointers.values()]; const d = Math.hypot(a.x - b.x, a.y - b.y);
      if (this.pinch) this.zoom *= this.pinch / d; this.pinch = d; return;
    }
    // mouse: seret tombol mana saja memutar kamera; sentuh: satu jari memutar kamera
    if (p.moved > 6 || p.btn === 2) {
      const k = p.type === 'mouse' ? 0.0052 : 0.0075;
      this.look.dx += dx * k; this.look.dy += dy * k * 0.8;
    }
    if (p.type === 'mouse') this.onHover?.(e.clientX, e.clientY);
  }
  up(e, cancel) {
    const p = this.pointers.get(e.pointerId); if (!p) return;
    this.pointers.delete(e.pointerId);
    if (this.pointers.size < 2) this.pinch = 0;
    const quick = performance.now() - p.t < 450 && p.moved < 12;
    if (!cancel && quick && p.btn !== 2) this.onTap?.(e.clientX, e.clientY, p.type);
  }
  // dibaca sekali per frame
  frame() {
    let x = this.move.x, y = this.move.y;
    const k = this.keys;
    if (k.has('w') || k.has('arrowup')) y -= 1;
    if (k.has('s') || k.has('arrowdown')) y += 1;
    if (k.has('a') || k.has('arrowleft')) x -= 1;
    if (k.has('d') || k.has('arrowright')) x += 1;
    const l = Math.hypot(x, y); if (l > 1) { x /= l; y /= l; }
    this.run = k.has('shift') || (IS_TOUCH && Math.hypot(this.move.x, this.move.y) > 0.92);
    const out = { x, y, look: { ...this.look }, zoom: this.zoom, jump: this.jumpPressed };
    this.look.dx = 0; this.look.dy = 0; this.zoom = 1; this.jumpPressed = false;
    return out;
  }
}
