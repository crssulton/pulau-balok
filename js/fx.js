// Perayaan "berhasil!": kembang api, balon pecah, konfeti, spanduk, dan bunyi terompet.
// Digambar di kanvas 2D di atas dunia 3D, tidak menghalangi ketukan.
let cv = null, g = null, W = 0, H = 0, dpr = 1;
let parts = [], rockets = [], balloons = [], banners = [];
let raf = 0, getAC = () => null, sfxOn = () => true, lite = () => false;
const COLS = ['#ff5a5f', '#ffd23a', '#3fd16a', '#2ec4f0', '#b36bf2', '#ff8fc0', '#ff9f1c', '#ffffff'];
const WORDS = ['HEBAT!', 'BERHASIL!', 'KEREN!', 'HORE!', 'MANTAP!', 'LUAR BIASA!'];
const R = (a, b) => a + Math.random() * (b - a);
const P = (a) => a[Math.floor(Math.random() * a.length)];

export function initFx({ ac, sfx, isLite }) {
  getAC = ac; sfxOn = sfx; lite = isLite;
  cv = document.createElement('canvas'); cv.id = 'fx';
  Object.assign(cv.style, { position: 'fixed', inset: '0', width: '100%', height: '100%', pointerEvents: 'none', zIndex: '40' });
  document.body.appendChild(cv); g = cv.getContext('2d');
  const size = () => { dpr = Math.min(window.devicePixelRatio || 1, 2); W = window.innerWidth; H = window.innerHeight; cv.width = W * dpr; cv.height = H * dpr; };
  size(); window.addEventListener('resize', size);
}

/* ---------- bunyi ---------- */
function noiseBurst(dur, vol, freq, q = 1, delay = 0) {
  const a = getAC(); if (!a || !sfxOn()) return;
  const t = a.currentTime + delay; const n = Math.floor(a.sampleRate * dur);
  const buf = a.createBuffer(1, n, a.sampleRate); const d = buf.getChannelData(0);
  for (let i = 0; i < n; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / n, 2);
  const s = a.createBufferSource(); s.buffer = buf;
  const f = a.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = freq; f.Q.value = q;
  const gn = a.createGain(); gn.gain.value = vol;
  s.connect(f).connect(gn).connect(a.destination); s.start(t);
}
function brass(freq, t0, dur, vol = 0.09) {
  const a = getAC(); if (!a || !sfxOn()) return;
  const t = a.currentTime + t0;
  const o = a.createOscillator(); o.type = 'sawtooth'; o.frequency.setValueAtTime(freq * 0.97, t); o.frequency.linearRampToValueAtTime(freq, t + 0.04);
  const vib = a.createOscillator(); vib.frequency.value = 6; const vg = a.createGain(); vg.gain.value = freq * 0.012; vib.connect(vg).connect(o.frequency);
  const lp = a.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.setValueAtTime(900, t); lp.frequency.linearRampToValueAtTime(2600, t + 0.06);
  const gn = a.createGain(); gn.gain.setValueAtTime(0.0001, t); gn.gain.exponentialRampToValueAtTime(vol, t + 0.03);
  gn.gain.setValueAtTime(vol, t + dur - 0.05); gn.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(lp).connect(gn).connect(a.destination); o.start(t); vib.start(t); o.stop(t + dur + 0.05); vib.stop(t + dur + 0.05);
}
// "te-re-re-reeet!"
export function trumpet() {
  const seq = P([
    [[523, 0.12], [523, 0.12], [523, 0.12], [698, 0.5]],
    [[392, 0.14], [523, 0.14], [659, 0.14], [784, 0.55]],
    [[523, 0.1], [659, 0.1], [784, 0.1], [1047, 0.2], [784, 0.1], [1047, 0.5]],
  ]);
  let t = 0; for (const [f, d] of seq) { brass(f, t, d); brass(f * 1.5, t, d, 0.025); t += d + 0.02; }
}
const popSound = (delay = 0) => { noiseBurst(0.12, 0.5, 1800, 0.7, delay); noiseBurst(0.05, 0.3, 4000, 1, delay); };
const boomSound = (delay = 0) => { noiseBurst(0.6, 0.45, 300, 0.6, delay); noiseBurst(0.35, 0.18, 2500, 0.5, delay + 0.05); };

/* ---------- efek ---------- */
function confetti(x, y, n, speed = 8, up = true) {
  for (let i = 0; i < n; i++) {
    const a = up ? R(-Math.PI * 0.95, -Math.PI * 0.05) : R(0, Math.PI * 2); const v = R(speed * 0.4, speed);
    parts.push({ x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, c: P(COLS), w: R(6, 12), h: R(3, 7), r: R(0, 6), vr: R(-0.3, 0.3), life: R(1.8, 3), kind: 'paper', g: 0.25 });
  }
}
function sparks(x, y, n, col) {
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2 + R(-0.1, 0.1); const v = R(3, 7.5);
    parts.push({ x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, c: Math.random() < 0.7 ? col : '#ffffff', life: R(1, 1.6), kind: 'spark', g: 0.09, trail: [] });
  }
}
function fireworks(n) {
  for (let i = 0; i < n; i++) {
    const delay = i * R(0.25, 0.45);
    rockets.push({ x: R(W * 0.15, W * 0.85), y: H + 10, vy: -R(H * 0.017, H * 0.022), delay, c: P(COLS.slice(0, 7)), boomY: R(H * 0.15, H * 0.45) });
  }
}
function balloonsUp(n) {
  for (let i = 0; i < n; i++) {
    balloons.push({ x: R(W * 0.08, W * 0.92), y: H + R(40, 220), vy: -R(2.6, 4.2), sway: R(0, 6), c: P(COLS.slice(0, 7)), r: R(26, 40), popY: R(H * 0.12, H * 0.55) });
  }
}
function showBanner(text, sub = '') { banners.push({ text, sub, t: 0, life: 2.4 }); }

export function celebrate(kind = 'big', text = null) {
  if (!cv) return;
  const L = lite(); const k = L ? 0.5 : 1;
  if (kind === 'small') { confetti(W / 2, H * 0.55, Math.round(50 * k), 9); popSound(); return start(); }
  const type = kind === 'mega' ? 'all' : P(['fireworks', 'balloons', 'confetti']);
  if (type === 'fireworks' || type === 'all') fireworks(kind === 'mega' ? 9 : 5);
  if (type === 'balloons' || type === 'all') balloonsUp(Math.round((kind === 'mega' ? 14 : 9) * k));
  if (type === 'confetti' || type === 'all') {
    confetti(0, H, Math.round(90 * k), 16); confetti(W, H, Math.round(90 * k), 16);
    for (let i = 0; i < 70 * k; i++) parts.push({ x: R(0, W), y: R(-H * 0.4, 0), vx: R(-1, 1), vy: R(1, 3), c: P(COLS), w: R(6, 12), h: R(3, 7), r: R(0, 6), vr: R(-0.3, 0.3), life: R(3, 4.5), kind: 'paper', g: 0.05 });
    popSound(); popSound(0.08);
  }
  showBanner(text || P(WORDS), kind === 'mega' ? '🏆' : P(['🎉', '🎺', '⭐', '🎈', '🥳']));
  trumpet();
  start();
}

function start() { if (!raf) { last = performance.now(); raf = requestAnimationFrame(frame); } }
let last = 0;
function frame(now) {
  const dt = Math.min(0.05, (now - last) / 1000); last = now; const s = dt * 60;
  g.setTransform(dpr, 0, 0, dpr, 0, 0); g.clearRect(0, 0, W, H);
  // roket
  for (let i = rockets.length - 1; i >= 0; i--) {
    const r = rockets[i]; if (r.delay > 0) { r.delay -= dt; continue; }
    r.y += r.vy * s; r.vy *= 0.985;
    g.fillStyle = '#fff3b0'; g.beginPath(); g.arc(r.x, r.y, 3, 0, 7); g.fill();
    g.fillStyle = 'rgba(255,220,120,.5)'; g.fillRect(r.x - 1, r.y, 2, 18);
    if (r.y < r.boomY) { sparks(r.x, r.y, lite() ? 30 : 60, r.c); boomSound(); rockets.splice(i, 1); }
  }
  // balon
  for (let i = balloons.length - 1; i >= 0; i--) {
    const b = balloons[i]; b.y += b.vy * s; b.sway += dt * 2; const x = b.x + Math.sin(b.sway) * 10;
    g.strokeStyle = 'rgba(29,43,83,.5)'; g.lineWidth = 1.5; g.beginPath(); g.moveTo(x, b.y + b.r * 1.15);
    g.quadraticCurveTo(x + Math.sin(b.sway * 1.3) * 10, b.y + b.r * 1.8, x, b.y + b.r * 2.6); g.stroke();
    g.fillStyle = b.c; g.beginPath(); g.ellipse(x, b.y, b.r * 0.85, b.r, 0, 0, 7); g.fill();
    g.beginPath(); g.moveTo(x - 5, b.y + b.r + 6); g.lineTo(x + 5, b.y + b.r + 6); g.lineTo(x, b.y + b.r - 2); g.fill();
    g.fillStyle = 'rgba(255,255,255,.45)'; g.beginPath(); g.ellipse(x - b.r * 0.32, b.y - b.r * 0.38, b.r * 0.16, b.r * 0.26, -0.5, 0, 7); g.fill();
    if (b.y < b.popY) {
      confetti(x, b.y, lite() ? 16 : 30, 7, false);
      for (let k = 0; k < 6; k++) { const a = (k / 6) * 6.28; parts.push({ x, y: b.y, vx: Math.cos(a) * 6, vy: Math.sin(a) * 6, c: b.c, life: 0.35, kind: 'line', g: 0 }); }
      popSound(); balloons.splice(i, 1);
    }
  }
  // partikel
  for (let i = parts.length - 1; i >= 0; i--) {
    const p = parts[i]; p.life -= dt;
    if (p.life <= 0 || p.y > H + 40) { parts.splice(i, 1); continue; }
    p.vy += p.g * s; p.vx *= 0.99; p.x += p.vx * s; p.y += p.vy * s;
    g.globalAlpha = Math.min(1, p.life * 1.5);
    if (p.kind === 'paper') {
      if (p.vy > 2.2) p.vy = 2.2 + Math.sin(p.r * 3) * 0.6; // berkibar pelan saat jatuh
      p.r += p.vr * s; g.save(); g.translate(p.x, p.y); g.rotate(p.r); g.scale(1, Math.abs(Math.cos(p.r * 2)) + 0.2);
      g.fillStyle = p.c; g.fillRect(-p.w / 2, -p.h / 2, p.w, p.h); g.restore();
    } else if (p.kind === 'spark') {
      p.vy = Math.min(p.vy, 4); g.fillStyle = p.c; g.beginPath(); g.arc(p.x, p.y, 2.6, 0, 7); g.fill();
      g.globalAlpha *= 0.4; g.beginPath(); g.arc(p.x - p.vx * 2, p.y - p.vy * 2, 1.8, 0, 7); g.fill();
    } else { g.strokeStyle = p.c; g.lineWidth = 3; g.beginPath(); g.moveTo(p.x, p.y); g.lineTo(p.x - p.vx * 2, p.y - p.vy * 2); g.stroke(); }
    g.globalAlpha = 1;
  }
  // spanduk
  for (let i = banners.length - 1; i >= 0; i--) {
    const b = banners[i]; b.t += dt; if (b.t > b.life) { banners.splice(i, 1); continue; }
    const k = Math.min(1, b.t / 0.5); const el = 1 + Math.sin(k * Math.PI * 2.5) * (1 - k) * 0.35; // pegas
    const sc = (b.t < 0.5 ? k : 1) * el; const fade = b.t > b.life - 0.4 ? (b.life - b.t) / 0.4 : 1;
    const fs = Math.min(W * 0.13, 110);
    g.save(); g.globalAlpha = fade; g.translate(W / 2, H * 0.3); g.scale(sc, sc); g.rotate(Math.sin(b.t * 5) * 0.03);
    g.font = `800 ${fs}px "Baloo 2","Arial Rounded MT Bold",sans-serif`; g.textAlign = 'center'; g.textBaseline = 'middle';
    g.lineJoin = 'round'; g.lineWidth = fs * 0.14; g.strokeStyle = '#1d2b53'; g.strokeText(b.text, 0, 0);
    const gr = g.createLinearGradient(0, -fs / 2, 0, fs / 2); gr.addColorStop(0, '#fff3a0'); gr.addColorStop(1, '#ffb800');
    g.fillStyle = gr; g.fillText(b.text, 0, 0);
    g.font = `${fs * 0.7}px "Apple Color Emoji","Segoe UI Emoji","Noto Color Emoji",sans-serif`;
    g.fillText(b.sub, 0, -fs * 0.95);
    g.restore();
  }
  if (parts.length || rockets.length || balloons.length || banners.length) raf = requestAnimationFrame(frame);
  else { raf = 0; g.clearRect(0, 0, W, H); }
}
