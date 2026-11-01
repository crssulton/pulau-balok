// Alat kecil yang dipakai di mana-mana (tanpa three.js).
export const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
export const lerp = (a, b, t) => a + (b - a) * t;
// mendekat secara halus dan tidak bergantung frame rate (rate: makin besar makin cepat)
export const damp = (a, b, rate, dt) => a + (b - a) * (1 - Math.exp(-rate * dt));
export const wrapAngle = (a) => Math.atan2(Math.sin(a), Math.cos(a));
export const dampAngle = (a, b, rate, dt) => a + wrapAngle(b - a) * (1 - Math.exp(-rate * dt));
export const $ = (s, root = document) => root.querySelector(s);
export const $$ = (s, root = document) => [...root.querySelectorAll(s)];
export const IS_TOUCH = matchMedia('(hover: none) and (pointer: coarse)').matches;

// RNG kecil dengan seed: dunia yang dibangkitkan selalu sama di semua perangkat
export function rng(seed = 1) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function toast(text, ms = 2600) {
  const el = document.getElementById('toast');
  if (!el) return;
  el.textContent = text;
  el.classList.add('show');
  clearTimeout(toast.t);
  toast.t = setTimeout(() => el.classList.remove('show'), ms);
}

// bunyi pendek tanpa file audio
let actx = null;
export function tone(freq, dur = 0.12, { type = 'sine', vol = 0.06, delay = 0, slide = 0 } = {}) {
  if (window.__pbMute) return;
  try {
    actx ||= new (window.AudioContext || window.webkitAudioContext)();
    if (actx.state === 'suspended') actx.resume();
    const t0 = actx.currentTime + delay;
    const o = actx.createOscillator(), g = actx.createGain();
    o.type = type; o.frequency.setValueAtTime(freq, t0);
    if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(40, freq + slide), t0 + dur);
    g.gain.setValueAtTime(0, t0); g.gain.linearRampToValueAtTime(vol, t0 + 0.01); g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    o.connect(g).connect(actx.destination); o.start(t0); o.stop(t0 + dur + 0.02);
  } catch (e) { /* tanpa suara */ }
}
export const SFX = {
  place: () => { tone(520, 0.07, { type: 'triangle', vol: 0.07 }); tone(780, 0.06, { type: 'triangle', vol: 0.04, delay: 0.03 }); },
  remove: () => tone(300, 0.09, { type: 'square', vol: 0.035, slide: -120 }),
  paint: () => tone(880, 0.06, { type: 'sine', vol: 0.05 }),
  bad: () => tone(160, 0.12, { type: 'square', vol: 0.03 }),
  jump: () => tone(420, 0.1, { type: 'sine', vol: 0.04, slide: 260 }),
  land: () => tone(120, 0.06, { type: 'sine', vol: 0.05 }),
  click: () => tone(660, 0.04, { type: 'triangle', vol: 0.04 }),
};

// berbicara dengan suara bahasa Indonesia bila ada (anak 4-5 tahun belum lancar membaca)
export function speak(text) {
  try {
    const s = window.speechSynthesis; if (!s) return;
    s.cancel();
    const u = new SpeechSynthesisUtterance(text.replace(/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/gu, ''));
    u.lang = 'id-ID'; u.rate = 0.95;
    const v = s.getVoices().find((x) => x.lang?.toLowerCase().startsWith('id'));
    if (v) u.voice = v;
    s.speak(u);
  } catch (e) { /* tanpa suara */ }
}
