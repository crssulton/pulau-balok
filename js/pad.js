// Papan aktivitas 2D (layar penuh) untuk kegiatan yang butuh jari: menulis, menggambar, puzzle.
const $ = (s) => document.querySelector(s);
const EMOJI = '"Apple Color Emoji","Segoe UI Emoji","Noto Color Emoji",sans-serif';
const FONT = '"Baloo 2","Nunito","Arial Rounded MT Bold",sans-serif';
const R = (a, b) => a + Math.random() * (b - a);
let cv, g, dpr = 1, CW = 0, CH = 0, act = null, raf = 0, hooks = {};

export function initPad(h) {
  hooks = h; cv = $('#padCanvas'); g = cv.getContext('2d');
  const ro = new ResizeObserver(() => resize()); ro.observe($('#padStage'));
  cv.addEventListener('pointerdown', (e) => { if (!act) return; e.preventDefault(); hooks.onActivity?.(); try { cv.setPointerCapture(e.pointerId); } catch (er) { /* abaikan */ } act.down?.(...pt(e), e); });
  cv.addEventListener('pointermove', (e) => { if (act) { act.move?.(...pt(e), e); if (e.buttons) hooks.onActivity?.(); } });
  const up = (e) => { if (act) act.up?.(...pt(e), e); };
  cv.addEventListener('pointerup', up); cv.addEventListener('pointercancel', up);
  $('#padBack').onclick = () => hooks.onBack?.();
  $('#padSay').onclick = () => hooks.onSay?.();
}
const pt = (e) => { const r = cv.getBoundingClientRect(); return [e.clientX - r.left, e.clientY - r.top]; };
function resize() {
  const st = $('#padStage'); dpr = Math.min(window.devicePixelRatio || 1, 2);
  CW = st.clientWidth; CH = st.clientHeight; cv.width = Math.max(1, CW * dpr); cv.height = Math.max(1, CH * dpr);
  act?.layout?.();
}
function open(a, toolsHTML = '', footHTML = '') {
  act?.stop?.(); act = a;
  $('#padTools').innerHTML = toolsHTML; $('#padTools').hidden = !toolsHTML;
  $('#padFoot').innerHTML = footHTML; $('#padFoot').hidden = !footHTML;
  $('#pad').hidden = false; resize();
  if (!raf) raf = requestAnimationFrame(loop);
}
export function closePad() { act?.stop?.(); act = null; $('#pad').hidden = true; }
export const padOpen = () => !!act;
// untuk pengujian otomatis: posisi jalur/potongan dalam koordinat layar
window.__pbPad = () => act?.debug?.();
let lastT = 0;
function loop(t) {
  raf = 0; if (!act) return;
  const dt = Math.min(0.05, (t - (lastT || t)) / 1000); lastT = t;
  g.setTransform(dpr, 0, 0, dpr, 0, 0); g.clearRect(0, 0, CW, CH);
  act.render(dt, t / 1000);
  raf = requestAnimationFrame(loop);
}

/* =========================================================
   MENULIS: tebalkan garis, angka, dan huruf mengikuti jalur
   ========================================================= */
// alat bantu membuat jalur dalam kotak 0..1 (y ke bawah)
const Ln = (x1, y1, x2, y2) => [[x1, y1], [x2, y2]];
function Ar(cx, cy, rx, ry, a0, a1) { const out = []; const n = Math.max(8, Math.round(Math.abs(a1 - a0) / 8)); for (let i = 0; i <= n; i++) { const a = ((a0 + ((a1 - a0) * i) / n) * Math.PI) / 180; out.push([cx + Math.cos(a) * rx, cy + Math.sin(a) * ry]); } return out; }
const Pa = (...parts) => parts.flat();
function wave() { const o = []; for (let i = 0; i <= 40; i++) { const x = 0.1 + (i / 40) * 0.8; o.push([x, 0.5 + Math.sin((i / 40) * Math.PI * 3) * 0.16]); } return o; }
export const TRACE = {
  garis: [
    { k: 'garis tegak', s: [Ln(0.5, 0.12, 0.5, 0.88)], e: '🌲', w: 'seperti pohon berdiri' },
    { k: 'garis mendatar', s: [Ln(0.12, 0.5, 0.88, 0.5)], e: '🛣️', w: 'seperti jalan' },
    { k: 'garis miring', s: [Ln(0.2, 0.15, 0.8, 0.85)], e: '🛝', w: 'seperti perosotan' },
    { k: 'zig-zag', s: [Pa(Ln(0.1, 0.66, 0.3, 0.34), Ln(0.3, 0.34, 0.5, 0.66), Ln(0.5, 0.66, 0.7, 0.34), Ln(0.7, 0.34, 0.9, 0.66))], e: '⚡', w: 'seperti petir' },
    { k: 'gelombang', s: [wave()], e: '🌊', w: 'seperti ombak' },
    { k: 'lingkaran', s: [Ar(0.5, 0.5, 0.32, 0.32, 270, -90)], e: '⚽', w: 'seperti bola' },
  ],
  angka: [
    { k: '1', s: [Pa(Ln(0.36, 0.25, 0.5, 0.1), Ln(0.5, 0.1, 0.5, 0.9))] },
    { k: '2', s: [Pa(Ar(0.5, 0.3, 0.2, 0.2, 200, 390), Ln(0.68, 0.4, 0.3, 0.9), Ln(0.3, 0.9, 0.72, 0.9))] },
    { k: '3', s: [Pa(Ar(0.5, 0.29, 0.18, 0.19, 200, 450), Ar(0.5, 0.69, 0.2, 0.21, 270, 520))] },
    { k: '4', s: [Pa(Ln(0.58, 0.1, 0.25, 0.65), Ln(0.25, 0.65, 0.78, 0.65)), Ln(0.6, 0.35, 0.6, 0.9)] },
    { k: '5', s: [Pa(Ln(0.35, 0.1, 0.33, 0.47), Ar(0.5, 0.66, 0.22, 0.23, 218, 505)), Ln(0.35, 0.1, 0.7, 0.1)] },
    { k: '6', s: [Pa(Ln(0.64, 0.1, 0.33, 0.56), Ar(0.51, 0.67, 0.2, 0.22, 190, 550))] },
    { k: '7', s: [Pa(Ln(0.28, 0.1, 0.72, 0.1), Ln(0.72, 0.1, 0.42, 0.9))] },
    { k: '8', s: [Ar(0.5, 0.29, 0.17, 0.18, 270, 630), Ar(0.5, 0.69, 0.21, 0.21, 270, 630)] },
    { k: '9', s: [Pa(Ar(0.5, 0.33, 0.19, 0.21, 0, -360), Ln(0.69, 0.33, 0.66, 0.9))] },
    { k: '0', s: [Ar(0.5, 0.5, 0.24, 0.38, 270, -90)] },
  ],
  vokal: [
    { k: 'A', s: [Ln(0.5, 0.1, 0.22, 0.9), Ln(0.5, 0.1, 0.78, 0.9), Ln(0.33, 0.6, 0.67, 0.6)], e: '🍎', w: 'apel' },
    { k: 'I', s: [Ln(0.5, 0.1, 0.5, 0.9), Ln(0.34, 0.1, 0.66, 0.1), Ln(0.34, 0.9, 0.66, 0.9)], e: '🐟', w: 'ikan' },
    { k: 'U', s: [Pa(Ln(0.27, 0.1, 0.27, 0.6), Ar(0.5, 0.6, 0.23, 0.3, 180, 0), Ln(0.73, 0.6, 0.73, 0.1))], e: '🐍', w: 'ular' },
    { k: 'E', s: [Ln(0.32, 0.1, 0.32, 0.9), Ln(0.32, 0.1, 0.7, 0.1), Ln(0.32, 0.5, 0.64, 0.5), Ln(0.32, 0.9, 0.7, 0.9)], e: '🦅', w: 'elang' },
    { k: 'O', s: [Ar(0.5, 0.5, 0.27, 0.38, 270, -90)], e: '🍊', w: 'oranye' },
  ],
  huruf: [
    { k: 'B', s: [Ln(0.3, 0.1, 0.3, 0.9), Pa(Ln(0.3, 0.1, 0.5, 0.1), Ar(0.5, 0.3, 0.18, 0.2, 270, 450), Ln(0.5, 0.5, 0.3, 0.5)), Pa(Ln(0.3, 0.5, 0.53, 0.5), Ar(0.53, 0.7, 0.2, 0.2, 270, 450), Ln(0.53, 0.9, 0.3, 0.9))], e: '⚽', w: 'bola' },
    { k: 'C', s: [Ar(0.52, 0.5, 0.26, 0.38, -40, -320)], e: '🐛', w: 'cacing' },
    { k: 'D', s: [Ln(0.3, 0.1, 0.3, 0.9), Pa(Ln(0.3, 0.1, 0.45, 0.1), Ar(0.45, 0.5, 0.27, 0.4, 270, 450), Ln(0.45, 0.9, 0.3, 0.9))], e: '🐑', w: 'domba' },
    { k: 'G', s: [Pa(Ar(0.52, 0.5, 0.26, 0.38, -40, -320), Ln(0.72, 0.74, 0.72, 0.56), Ln(0.72, 0.56, 0.55, 0.56))], e: '🐘', w: 'gajah' },
    { k: 'H', s: [Ln(0.28, 0.1, 0.28, 0.9), Ln(0.72, 0.1, 0.72, 0.9), Ln(0.28, 0.5, 0.72, 0.5)], e: '🐯', w: 'harimau' },
    { k: 'J', s: [Pa(Ln(0.62, 0.1, 0.62, 0.65), Ar(0.45, 0.65, 0.17, 0.25, 0, 180))], e: '🍊', w: 'jeruk' },
    { k: 'K', s: [Ln(0.3, 0.1, 0.3, 0.9), Ln(0.72, 0.1, 0.3, 0.55), Ln(0.42, 0.45, 0.74, 0.9)], e: '🐱', w: 'kucing' },
    { k: 'L', s: [Pa(Ln(0.32, 0.1, 0.32, 0.9), Ln(0.32, 0.9, 0.7, 0.9))], e: '🐝', w: 'lebah' },
    { k: 'M', s: [Pa(Ln(0.22, 0.9, 0.22, 0.1), Ln(0.22, 0.1, 0.5, 0.6), Ln(0.5, 0.6, 0.78, 0.1), Ln(0.78, 0.1, 0.78, 0.9))], e: '🚗', w: 'mobil' },
    { k: 'N', s: [Pa(Ln(0.27, 0.9, 0.27, 0.1), Ln(0.27, 0.1, 0.73, 0.9), Ln(0.73, 0.9, 0.73, 0.1))], e: '🍍', w: 'nanas' },
    { k: 'P', s: [Ln(0.3, 0.1, 0.3, 0.9), Pa(Ln(0.3, 0.1, 0.5, 0.1), Ar(0.5, 0.3, 0.2, 0.2, 270, 450), Ln(0.5, 0.5, 0.3, 0.5))], e: '🍌', w: 'pisang' },
    { k: 'R', s: [Ln(0.3, 0.1, 0.3, 0.9), Pa(Ln(0.3, 0.1, 0.5, 0.1), Ar(0.5, 0.3, 0.2, 0.2, 270, 450), Ln(0.5, 0.5, 0.3, 0.5)), Ln(0.46, 0.5, 0.74, 0.9)], e: '🏠', w: 'rumah' },
    { k: 'S', s: [Pa(Ar(0.5, 0.3, 0.2, 0.2, -30, -270), Ar(0.5, 0.7, 0.2, 0.2, -90, 160))], e: '🐄', w: 'sapi' },
    { k: 'T', s: [Ln(0.22, 0.1, 0.78, 0.1), Ln(0.5, 0.1, 0.5, 0.9)], e: '🍅', w: 'tomat' },
    { k: 'V', s: [Pa(Ln(0.22, 0.1, 0.5, 0.9), Ln(0.5, 0.9, 0.78, 0.1))], e: '🎻', w: 'viola' },
    { k: 'W', s: [Pa(Ln(0.15, 0.1, 0.32, 0.9), Ln(0.32, 0.9, 0.5, 0.35), Ln(0.5, 0.35, 0.68, 0.9), Ln(0.68, 0.9, 0.85, 0.1))], e: '🥕', w: 'wortel' },
    { k: 'Z', s: [Pa(Ln(0.25, 0.1, 0.75, 0.1), Ln(0.75, 0.1, 0.25, 0.9), Ln(0.25, 0.9, 0.75, 0.9))], e: '🦓', w: 'zebra' },
  ],
};
function resample(pts, step = 0.014) {
  const out = [pts[0]];
  for (let i = 1; i < pts.length; i++) {
    const [ax, ay] = out[out.length - 1]; const [bx, by] = pts[i]; let d = Math.hypot(bx - ax, by - ay);
    let cx = ax, cy = ay;
    while (d >= step) { const k = step / d; cx += (bx - cx) * k; cy += (by - cy) * k; out.push([cx, cy]); d = Math.hypot(bx - cx, by - cy); }
  }
  const last = pts[pts.length - 1]; if (Math.hypot(last[0] - out.at(-1)[0], last[1] - out.at(-1)[1]) > 0.004) out.push(last);
  return out;
}
const INK = ['#ff5a5f', '#ff9f1c', '#ffd23a', '#3fd16a', '#2ec4f0', '#5b7cfa', '#b36bf2'];
export function tracePad(item, { onStroke, onDone, onOff }) {
  const strokes = item.s.map((s) => resample(s));
  let si = 0, pi = 0, tracking = false, done = false, ink = [], cur = null, box = { x: 0, y: 0, s: 1 }, demoT = 0, offWarned = 0;
  const tol = 0.085;
  const A = {
    layout() { const s = Math.min(CW * 0.92, CH * 0.92); box = { s, x: (CW - s) / 2, y: (CH - s) / 2 }; },
    toU: (x, y) => [(x - box.x) / box.s, (y - box.y) / box.s],
    debug: () => { const r = cv.getBoundingClientRect(); return { strokes: strokes.map((st) => st.map(([u, v]) => [r.left + box.x + u * box.s, r.top + box.y + v * box.s])), si, done }; },
    down(x, y) {
      if (done) return; const [u, v] = A.toU(x, y); cur = [[x, y]]; ink.push(cur);
      const p = strokes[si][pi]; tracking = Math.hypot(u - p[0], v - p[1]) < tol * 1.8;
      if (!tracking && Date.now() - offWarned > 4000) { offWarned = Date.now(); onOff?.('start'); }
      A.advance(u, v);
    },
    move(x, y) {
      if (!cur || done) return; cur.push([x, y]);
      const [u, v] = A.toU(x, y); const p = strokes[si][pi];
      if (!tracking && Math.hypot(u - p[0], v - p[1]) < tol * 1.5) tracking = true;
      if (tracking) A.advance(u, v);
    },
    up() { cur = null; tracking = false; demoT = -1.5; },
    advance(u, v) {
      const st = strokes[si];
      for (let k = Math.min(st.length - 1, pi + 9); k > pi; k--) if (Math.hypot(u - st[k][0], v - st[k][1]) < tol) { pi = k; break; }
      if (pi >= st.length - 2) {
        onStroke?.(si); si++; pi = 0; tracking = false; cur = null;
        if (si >= strokes.length) { done = true; setTimeout(() => onDone?.(), 650); }
      }
    },
    render(dt, t) {
      const { x, y, s } = box; const P = (q) => [x + q[0] * s, y + q[1] * s];
      // kertas bergaris
      g.fillStyle = '#ffffff'; g.beginPath(); g.roundRect(x, y, s, s, 24); g.fill();
      g.strokeStyle = '#d7e6f7'; g.lineWidth = 2;
      for (const yy of [0.1, 0.5, 0.9]) { g.beginPath(); g.moveTo(x + 10, y + yy * s); g.lineTo(x + s - 10, y + yy * s); g.stroke(); }
      const path = (pts, a = 0, b = pts.length - 1) => { g.beginPath(); const p0 = P(pts[a]); g.moveTo(...p0); for (let i = a + 1; i <= b; i++) g.lineTo(...P(pts[i])); };
      g.lineCap = 'round'; g.lineJoin = 'round';
      // jalur bayangan
      for (const st of strokes) { path(st); g.strokeStyle = '#e6ebf5'; g.lineWidth = s * 0.11; g.stroke(); }
      g.setLineDash([2, s * 0.03]);
      for (const st of strokes) { path(st); g.strokeStyle = '#9aa6c0'; g.lineWidth = s * 0.018; g.stroke(); }
      g.setLineDash([]);
      // yang sudah ditebalkan
      strokes.forEach((st, i) => {
        if (i < si) { path(st); g.strokeStyle = INK[i % INK.length]; g.lineWidth = s * 0.1; g.stroke(); }
        else if (i === si && pi > 0) { path(st, 0, pi); g.strokeStyle = INK[i % INK.length]; g.lineWidth = s * 0.1; g.stroke(); }
      });
      // goresan jari
      g.strokeStyle = 'rgba(29,43,83,.28)'; g.lineWidth = s * 0.03;
      for (const l of ink) { if (l.length < 2) continue; g.beginPath(); g.moveTo(...l[0]); for (const q of l) g.lineTo(...q); g.stroke(); }
      if (done) return;
      // nomor urutan goresan berikutnya
      strokes.forEach((st, i) => {
        if (i <= si) return; const [px, py] = P(st[0]);
        g.fillStyle = '#c9d3e6'; g.beginPath(); g.arc(px, py, s * 0.035, 0, 7); g.fill();
        g.fillStyle = '#fff'; g.font = `800 ${s * 0.04}px ${FONT}`; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(String(i + 1), px, py + 1);
      });
      // titik mulai + panah arah
      const st = strokes[si]; const [px, py] = P(st[pi]); const nx = st[Math.min(st.length - 1, pi + 6)];
      const [qx, qy] = P(nx); const ang = Math.atan2(qy - py, qx - px);
      const pulse = 1 + Math.sin(t * 6) * 0.12;
      g.fillStyle = '#3fd16a'; g.beginPath(); g.arc(px, py, s * 0.05 * pulse, 0, 7); g.fill();
      g.strokeStyle = '#fff'; g.lineWidth = 4; g.stroke();
      g.fillStyle = '#fff'; g.font = `800 ${s * 0.05}px ${FONT}`; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(String(si + 1), px, py + 2);
      g.save(); g.translate(px + Math.cos(ang) * s * 0.1, py + Math.sin(ang) * s * 0.1); g.rotate(ang);
      g.fillStyle = '#ff9f1c'; g.beginPath(); g.moveTo(s * 0.03, 0); g.lineTo(-s * 0.02, -s * 0.025); g.lineTo(-s * 0.02, s * 0.025); g.closePath(); g.fill(); g.restore();
      // bintang peraga bergerak sepanjang jalur saat anak belum menyentuh
      if (!cur) {
        demoT += dt; if (demoT > 0) {
          const k = (demoT % 2.6) / 2; if (k <= 1) {
            const idx = Math.min(st.length - 1, pi + Math.floor(k * (st.length - 1 - pi)));
            const [sx, sy] = P(st[idx]); g.font = `${s * 0.08}px ${EMOJI}`; g.globalAlpha = 0.9; g.fillText('⭐', sx, sy); g.globalAlpha = 1;
          }
        }
      }
    },
  };
  const side = item.e ? `<div class="padHint"><span class="e">${item.e}</span><b>${item.k.length === 1 ? item.k + item.k.toLowerCase() : ''}</b><span>${item.w}</span></div>` : `<div class="padHint"><b class="big">${item.k}</b></div>`;
  open(A, side);
  return { restart() { si = 0; pi = 0; ink = []; done = false; } };
}

/* =========================================================
   MENGGAMBAR: bebas atau mengikuti contoh
   ========================================================= */
const PAPER_W = 1200, PAPER_H = 900;
const DRAW_COLORS = ['#1d2b53', '#e8434b', '#ff8a2a', '#ffd23a', '#3fb25a', '#2ec4f0', '#3a7cf5', '#9a62e0', '#ff8fc0', '#8a5a35', 'pelangi'];
// gambar contoh berupa garis luar, dilukis di kanvas 1200x900
export const EXAMPLES = {
  rumah(c) { c.strokeRect(380, 420, 440, 340); c.beginPath(); c.moveTo(340, 430); c.lineTo(600, 190); c.lineTo(860, 430); c.closePath(); c.stroke(); c.strokeRect(550, 590, 100, 170); c.strokeRect(430, 480, 90, 80); c.strokeRect(680, 480, 90, 80); },
  matahari(c) { c.beginPath(); c.arc(600, 450, 170, 0, 7); c.stroke(); for (let i = 0; i < 12; i++) { const a = (i / 12) * Math.PI * 2; c.beginPath(); c.moveTo(600 + Math.cos(a) * 210, 450 + Math.sin(a) * 210); c.lineTo(600 + Math.cos(a) * 300, 450 + Math.sin(a) * 300); c.stroke(); } c.beginPath(); c.arc(540, 420, 18, 0, 7); c.arc(660, 420, 18, 0, 7); c.stroke(); c.beginPath(); c.arc(600, 470, 70, 0.15 * Math.PI, 0.85 * Math.PI); c.stroke(); },
  bunga(c) { for (let i = 0; i < 6; i++) { const a = (i / 6) * Math.PI * 2; c.beginPath(); c.ellipse(600 + Math.cos(a) * 110, 330 + Math.sin(a) * 110, 75, 55, a, 0, 7); c.stroke(); } c.beginPath(); c.arc(600, 330, 65, 0, 7); c.stroke(); c.beginPath(); c.moveTo(600, 440); c.lineTo(600, 820); c.stroke(); c.beginPath(); c.ellipse(680, 650, 80, 34, -0.5, 0, 7); c.stroke(); c.beginPath(); c.ellipse(520, 720, 80, 34, 0.5, 0, 7); c.stroke(); },
  ikan(c) { c.beginPath(); c.ellipse(560, 450, 260, 150, 0, 0, 7); c.stroke(); c.beginPath(); c.moveTo(810, 450); c.lineTo(980, 320); c.lineTo(980, 580); c.closePath(); c.stroke(); c.beginPath(); c.arc(420, 410, 26, 0, 7); c.stroke(); c.beginPath(); c.arc(360, 480, 40, -0.2 * Math.PI, 0.3 * Math.PI); c.stroke(); for (const x of [560, 650]) { c.beginPath(); c.arc(x, 450, 70, -0.5 * Math.PI, 0.5 * Math.PI); c.stroke(); } },
  kucing(c) { c.beginPath(); c.arc(600, 480, 230, 0, 7); c.stroke(); c.beginPath(); c.moveTo(420, 340); c.lineTo(430, 160); c.lineTo(540, 260); c.stroke(); c.beginPath(); c.moveTo(780, 340); c.lineTo(770, 160); c.lineTo(660, 260); c.stroke(); c.beginPath(); c.arc(520, 450, 28, 0, 7); c.stroke(); c.beginPath(); c.arc(680, 450, 28, 0, 7); c.stroke(); c.beginPath(); c.moveTo(580, 520); c.lineTo(620, 520); c.lineTo(600, 545); c.closePath(); c.stroke(); for (const s of [-1, 1]) for (const dy of [-15, 20]) { c.beginPath(); c.moveTo(600 + s * 80, 545); c.lineTo(600 + s * 230, 545 + dy); c.stroke(); } },
  mobil(c) { c.beginPath(); c.moveTo(250, 600); c.lineTo(250, 480); c.lineTo(400, 470); c.lineTo(480, 340); c.lineTo(760, 340); c.lineTo(850, 470); c.lineTo(960, 490); c.lineTo(960, 600); c.closePath(); c.stroke(); c.beginPath(); c.arc(420, 620, 80, 0, 7); c.stroke(); c.beginPath(); c.arc(800, 620, 80, 0, 7); c.stroke(); c.strokeRect(500, 370, 110, 90); c.strokeRect(640, 370, 110, 90); },
  pohon(c) { c.strokeRect(550, 520, 100, 300); c.beginPath(); c.arc(600, 380, 200, 0, 7); c.stroke(); for (const [x, y] of [[530, 330], [670, 400], [580, 460]]) { c.beginPath(); c.arc(x, y, 26, 0, 7); c.stroke(); } },
  bulan(c) { c.beginPath(); c.arc(600, 450, 260, 0.6 * Math.PI, 1.4 * Math.PI, false); c.arc(700, 450, 220, 1.33 * Math.PI, 0.67 * Math.PI, true); c.closePath(); c.stroke(); for (const [x, y] of [[880, 220], [950, 600], [800, 760]]) { c.beginPath(); for (let i = 0; i < 10; i++) { const a = -Math.PI / 2 + (i * Math.PI) / 5, r = i % 2 ? 18 : 45; c.lineTo(x + Math.cos(a) * r, y + Math.sin(a) * r); } c.closePath(); c.stroke(); } },
  perahu(c) { c.beginPath(); c.moveTo(300, 600); c.lineTo(900, 600); c.lineTo(800, 720); c.lineTo(400, 720); c.closePath(); c.stroke(); c.beginPath(); c.moveTo(600, 580); c.lineTo(600, 180); c.stroke(); c.beginPath(); c.moveTo(620, 200); c.lineTo(820, 540); c.lineTo(620, 540); c.closePath(); c.stroke(); c.beginPath(); c.moveTo(150, 800); for (let x = 150; x <= 1050; x += 75) c.quadraticCurveTo(x + 37, 760, x + 75, 800); c.stroke(); },
  balon(c) { for (const [x, y, r] of [[480, 360, 130], [720, 320, 140], [600, 470, 120]]) { c.beginPath(); c.ellipse(x, y, r * 0.85, r, 0, 0, 7); c.stroke(); c.beginPath(); c.moveTo(x, y + r); c.quadraticCurveTo(x + 30, y + r + 120, 600, 820); c.stroke(); } },
  kupu(c) { for (const s of [-1, 1]) { c.beginPath(); c.ellipse(600 + s * 170, 350, 160, 130, s * 0.4, 0, 7); c.stroke(); c.beginPath(); c.ellipse(600 + s * 130, 590, 110, 90, -s * 0.4, 0, 7); c.stroke(); c.beginPath(); c.moveTo(600, 300); c.quadraticCurveTo(600 + s * 40, 200, 600 + s * 90, 180); c.stroke(); } c.beginPath(); c.ellipse(600, 470, 30, 200, 0, 0, 7); c.stroke(); },
};
export const EXAMPLE_NAMES = { rumah: 'rumah', matahari: 'matahari', bunga: 'bunga', ikan: 'ikan', kucing: 'kucing', mobil: 'mobil', pohon: 'pohon', bulan: 'bulan dan bintang', perahu: 'perahu', balon: 'balon', kupu: 'kupu-kupu' };
export function drawPad({ example = null, onDone, onEmpty, onExample }) {
  const paper = document.createElement('canvas'); paper.width = PAPER_W; paper.height = PAPER_H; const pg = paper.getContext('2d');
  pg.lineCap = 'round'; pg.lineJoin = 'round';
  let color = '#e8434b', size = 26, erase = false, ex = example, strokes = 0, last = null, hue = 0, view = { x: 0, y: 0, k: 1 };
  const exList = [null, ...Object.keys(EXAMPLES)];
  const A = {
    layout() { const k = Math.min(CW / PAPER_W, CH / PAPER_H) * 0.98; view = { k, x: (CW - PAPER_W * k) / 2, y: (CH - PAPER_H * k) / 2 }; },
    toP: (x, y) => [(x - view.x) / view.k, (y - view.y) / view.k],
    down(x, y) { last = A.toP(x, y); A.dot(...last); strokes++; },
    move(x, y) { if (!last) return; const p = A.toP(x, y); A.seg(last, p); last = p; },
    up() { last = null; },
    ink() { if (color !== 'pelangi') return color; hue = (hue + 4) % 360; return `hsl(${hue},90%,55%)`; },
    dot(x, y) { pg.globalCompositeOperation = erase ? 'destination-out' : 'source-over'; pg.fillStyle = A.ink(); pg.beginPath(); pg.arc(x, y, size / 2, 0, 7); pg.fill(); },
    seg(a, b) { pg.globalCompositeOperation = erase ? 'destination-out' : 'source-over'; pg.strokeStyle = A.ink(); pg.lineWidth = size; pg.beginPath(); pg.moveTo(...a); pg.lineTo(...b); pg.stroke(); },
    render() {
      const { x, y, k } = view;
      g.fillStyle = '#fff'; g.beginPath(); g.roundRect(x, y, PAPER_W * k, PAPER_H * k, 18); g.fill();
      if (ex) { g.save(); g.translate(x, y); g.scale(k, k); g.strokeStyle = '#b9c3d8'; g.lineWidth = 10; g.setLineDash([4, 22]); g.lineCap = 'round'; EXAMPLES[ex](g); g.restore(); g.setLineDash([]); }
      g.drawImage(paper, x, y, PAPER_W * k, PAPER_H * k);
    },
    exportImage() {
      const c = document.createElement('canvas'); c.width = 480; c.height = 360; const cg = c.getContext('2d');
      cg.fillStyle = '#fff'; cg.fillRect(0, 0, 480, 360);
      if (ex) { cg.save(); cg.scale(0.4, 0.4); cg.strokeStyle = '#c8d0e0'; cg.lineWidth = 8; cg.lineCap = 'round'; EXAMPLES[ex](cg); cg.restore(); }
      cg.drawImage(paper, 0, 0, 480, 360); return c;
    },
  };
  const sw = DRAW_COLORS.map((c) => `<button class="dc" data-c="${c}" style="background:${c === 'pelangi' ? 'conic-gradient(red,orange,yellow,lime,cyan,blue,violet,red)' : c}" aria-label="warna"></button>`).join('');
  const tools = `<div class="dcols">${sw}</div><div class="dsizes"><button class="ds" data-s="12"><i style="width:10px;height:10px"></i></button><button class="ds" data-s="26"><i style="width:18px;height:18px"></i></button><button class="ds" data-s="48"><i style="width:28px;height:28px"></i></button><button class="ds er" data-s="er" aria-label="penghapus">🧽</button></div>`;
  const foot = `<button class="chunky" id="dEx">🖼️ Contoh</button><button class="chunky" id="dClear">🗑️ Hapus</button><button class="chunky leaf" id="dDone">Selesai!</button>`;
  open(A, tools, foot);
  const mark = () => {
    document.querySelectorAll('.dc').forEach((b) => b.classList.toggle('on', !erase && b.dataset.c === color));
    document.querySelectorAll('.ds').forEach((b) => b.classList.toggle('on', b.dataset.s === 'er' ? erase : !erase && +b.dataset.s === size));
  };
  document.querySelectorAll('.dc').forEach((b) => (b.onclick = () => { color = b.dataset.c; erase = false; hooks.tap?.(); mark(); }));
  document.querySelectorAll('.ds').forEach((b) => (b.onclick = () => { if (b.dataset.s === 'er') erase = true; else { size = +b.dataset.s; erase = false; } hooks.tap?.(); mark(); }));
  $('#dEx').onclick = () => { ex = exList[(exList.indexOf(ex) + 1) % exList.length]; hooks.tap?.(); onExample?.(ex); };
  $('#dClear').onclick = () => { pg.clearRect(0, 0, PAPER_W, PAPER_H); strokes = 0; hooks.tap?.(); };
  $('#dDone').onclick = () => { hooks.tap?.(); if (strokes < 1) { onEmpty?.(); return; } onDone?.(A.exportImage(), ex); };
  mark();
  return A;
}

/* =========================================================
   PUZZLE: seret potongan gambar ke tempatnya
   ========================================================= */
const SCENES = [
  { name: 'gajah di padang rumput', sky: ['#8fd3ff', '#d9f2ff'], ground: '#7fd068', items: [['☀️', 0.85, 0.18, 0.16], ['☁️', 0.25, 0.16, 0.14], ['🌳', 0.15, 0.6, 0.3], ['🐘', 0.55, 0.62, 0.42], ['🌼', 0.88, 0.86, 0.1]] },
  { name: 'perahu di laut', sky: ['#7cc8f5', '#e0f4ff'], ground: '#2f8fd8', gy: 0.55, items: [['☀️', 0.15, 0.17, 0.15], ['⛵', 0.5, 0.45, 0.38], ['🐟', 0.25, 0.82, 0.13], ['🐠', 0.75, 0.78, 0.14], ['🕊️', 0.82, 0.2, 0.12]] },
  { name: 'kereta api', sky: ['#ffd9a0', '#fff3d6'], ground: '#9bd06a', items: [['⛰️', 0.75, 0.42, 0.34], ['🚂', 0.25, 0.7, 0.28], ['🚃', 0.52, 0.7, 0.26], ['🚃', 0.78, 0.7, 0.26], ['☁️', 0.3, 0.18, 0.14]] },
  { name: 'kebun bunga', sky: ['#bfe8ff', '#f0fbff'], ground: '#6cc45a', items: [['🌻', 0.18, 0.62, 0.3], ['🌷', 0.45, 0.7, 0.24], ['🌸', 0.72, 0.66, 0.24], ['🦋', 0.6, 0.25, 0.16], ['🐝', 0.3, 0.22, 0.12]] },
  { name: 'roket di luar angkasa', sky: ['#1d2b53', '#3b2a7a'], ground: '#3b2a7a', gy: 1, items: [['🚀', 0.4, 0.5, 0.42], ['🪐', 0.8, 0.28, 0.24], ['🌙', 0.15, 0.2, 0.18], ['⭐', 0.7, 0.75, 0.1], ['✨', 0.88, 0.62, 0.1]] },
  { name: 'istana dan pelangi', sky: ['#a8e0ff', '#ffffff'], ground: '#8fd16c', rainbow: true, items: [['🏰', 0.5, 0.65, 0.36], ['🌳', 0.12, 0.7, 0.22], ['🌳', 0.88, 0.7, 0.22]] },
  { name: 'dunia bawah laut', sky: ['#2ec4f0', '#0d6fb8'], ground: '#f2d993', gy: 0.86, items: [['🐠', 0.25, 0.3, 0.2], ['🐙', 0.7, 0.55, 0.3], ['🐢', 0.3, 0.68, 0.24], ['🫧', 0.85, 0.2, 0.12], ['🐚', 0.55, 0.9, 0.1]] },
  { name: 'peternakan', sky: ['#9fdcff', '#e8f7ff'], ground: '#a7d36a', items: [['🏡', 0.22, 0.5, 0.32], ['🐄', 0.65, 0.68, 0.3], ['🐔', 0.88, 0.82, 0.14], ['🌞', 0.85, 0.16, 0.16]] },
];
export const SCENE_COUNT = SCENES.length;
function paintScene(c, w, h, sc) {
  const gr = c.createLinearGradient(0, 0, 0, h); gr.addColorStop(0, sc.sky[0]); gr.addColorStop(1, sc.sky[1]); c.fillStyle = gr; c.fillRect(0, 0, w, h);
  const gy = sc.gy ?? 0.62; c.fillStyle = sc.ground; c.beginPath(); c.moveTo(0, h * gy);
  for (let i = 0; i <= 20; i++) c.lineTo((i / 20) * w, h * gy + Math.sin(i * 1.3) * h * 0.02); c.lineTo(w, h); c.lineTo(0, h); c.fill();
  if (sc.name.includes('angkasa')) { c.fillStyle = '#fff'; for (let i = 0; i < 60; i++) { c.globalAlpha = Math.random(); c.fillRect(Math.random() * w, Math.random() * h, 3, 3); } c.globalAlpha = 1; }
  if (sc.rainbow) ['#e8434b', '#ff8a2a', '#ffd23a', '#3fb25a', '#3a7cf5', '#9a62e0'].forEach((col, i) => { c.strokeStyle = col; c.lineWidth = h * 0.035; c.beginPath(); c.arc(w / 2, h * 0.62, h * (0.48 - i * 0.035), Math.PI, 0); c.stroke(); });
  c.textAlign = 'center'; c.textBaseline = 'middle';
  for (const [e, x, y, s] of sc.items) { c.font = `${Math.min(220, s * h * 1.1)}px ${EMOJI}`; c.fillText(e, x * w, y * h); }
}
export function puzzlePad({ scene, cols, rows, ghost = 0.25, onDrop, onDone }) {
  const sc = SCENES[scene % SCENES.length];
  const img = document.createElement('canvas'); img.width = 900; img.height = 600; paintScene(img.getContext('2d'), 900, 600, sc);
  const pieces = []; for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) pieces.push({ c, r, tx: Math.random(), ty: Math.random(), placed: false, x: 0, y: 0 });
  pieces.sort(() => Math.random() - 0.5);
  let board = { x: 0, y: 0, w: 1, h: 1 }, tray = { x: 0, y: 0, w: 1, h: 1 }, drag = null, done = false, flash = 0;
  const cell = () => ({ w: board.w / cols, h: board.h / rows });
  const A = {
    layout() {
      const wide = CW > CH * 1.15;
      if (wide) { const bw = Math.min(CW * 0.62, CH * 0.96 * 1.5); board = { w: bw, h: bw / 1.5, x: 8, y: (CH - bw / 1.5) / 2 }; tray = { x: board.x + bw + 16, y: 8, w: CW - bw - 32, h: CH - 16 }; }
      else { const bw = Math.min(CW * 0.96, CH * 0.55 * 1.5); board = { w: bw, h: bw / 1.5, x: (CW - bw) / 2, y: 8 }; tray = { x: 8, y: board.y + bw / 1.5 + 14, w: CW - 16, h: CH - bw / 1.5 - 30 }; }
      const { w, h } = cell();
      for (const p of pieces) {
        if (p.placed) { p.x = board.x + p.c * w; p.y = board.y + p.r * h; }
        else { p.x = tray.x + p.tx * Math.max(1, tray.w - w); p.y = tray.y + p.ty * Math.max(1, tray.h - h); }
      }
    },
    debug: () => { const r = cv.getBoundingClientRect(); const { w, h } = cell(); return { pieces: pieces.map((p) => ({ from: [r.left + p.x + w / 2, r.top + p.y + h / 2], to: [r.left + board.x + p.c * w + w / 2, r.top + board.y + p.r * h + h / 2], placed: p.placed })), done }; },
    hit(x, y) { const { w, h } = cell(); for (let i = pieces.length - 1; i >= 0; i--) { const p = pieces[i]; if (!p.placed && x >= p.x && x <= p.x + w && y >= p.y && y <= p.y + h) return p; } return null; },
    down(x, y) { if (done) return; const p = A.hit(x, y); if (!p) return; drag = { p, ox: x - p.x, oy: y - p.y }; pieces.splice(pieces.indexOf(p), 1); pieces.push(p); hooks.tap?.(); },
    move(x, y) { if (!drag) return; drag.p.x = x - drag.ox; drag.p.y = y - drag.oy; },
    up() {
      if (!drag) return; const p = drag.p; drag = null; const { w, h } = cell();
      const tx = board.x + p.c * w, ty = board.y + p.r * h;
      if (Math.hypot(p.x - tx, p.y - ty) < Math.min(w, h) * 0.38) {
        p.placed = true; p.x = tx; p.y = ty; flash = 0.4; onDrop?.(true);
        if (pieces.every((q) => q.placed)) { done = true; setTimeout(() => onDone?.(), 500); }
        return;
      }
      const onBoard = p.x + w / 2 > board.x && p.x + w / 2 < board.x + board.w && p.y + h / 2 > board.y && p.y + h / 2 < board.y + board.h;
      if (onBoard) { onDrop?.(false); p.tx = Math.random(); p.ty = Math.random(); p.x = tray.x + p.tx * Math.max(1, tray.w - w); p.y = tray.y + p.ty * Math.max(1, tray.h - h); }
      else { p.tx = Math.max(0, Math.min(1, (p.x - tray.x) / Math.max(1, tray.w - w))); p.ty = Math.max(0, Math.min(1, (p.y - tray.y) / Math.max(1, tray.h - h))); }
    },
    render(dt) {
      const { w, h } = cell();
      g.fillStyle = '#eef6fd'; g.beginPath(); g.roundRect(board.x - 6, board.y - 6, board.w + 12, board.h + 12, 16); g.fill();
      g.fillStyle = '#ffffff'; g.fillRect(board.x, board.y, board.w, board.h);
      if (ghost > 0) { g.globalAlpha = ghost; g.drawImage(img, board.x, board.y, board.w, board.h); g.globalAlpha = 1; }
      g.strokeStyle = '#c9d6ea'; g.lineWidth = 2; g.setLineDash([8, 6]);
      for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) g.strokeRect(board.x + c * w, board.y + r * h, w, h);
      g.setLineDash([]);
      if (ghost === 0) { const tw = Math.min(tray.w * 0.35, 150); g.globalAlpha = 0.9; g.drawImage(img, tray.x + tray.w - tw, tray.y, tw, tw / 1.5); g.globalAlpha = 1; g.strokeStyle = '#1d2b53'; g.strokeRect(tray.x + tray.w - tw, tray.y, tw, tw / 1.5); }
      for (const p of pieces) {
        const sw = img.width / cols, sh = img.height / rows;
        if (!p.placed) { g.fillStyle = 'rgba(29,43,83,.22)'; g.fillRect(p.x + 4, p.y + 6, w, h); }
        g.drawImage(img, p.c * sw, p.r * sh, sw, sh, p.x, p.y, w, h);
        g.strokeStyle = p.placed ? 'rgba(255,255,255,.6)' : '#1d2b53'; g.lineWidth = p.placed ? 1 : 3; g.strokeRect(p.x, p.y, w, h);
      }
      if (flash > 0) { flash -= dt; g.fillStyle = `rgba(255,255,255,${flash})`; g.fillRect(board.x, board.y, board.w, board.h); }
      if (done) { g.strokeStyle = '#ffd23a'; g.lineWidth = 8; g.strokeRect(board.x - 4, board.y - 4, board.w + 8, board.h + 8); }
    },
  };
  open(A);
  return sc.name;
}
