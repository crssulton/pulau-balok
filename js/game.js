// Pulau Balok — dunia 3D bergaya balok dengan 4 zona belajar untuk anak 4–5 tahun.
import * as THREE from '../lib/three.module.min.js';
import { initFx, celebrate } from './fx.js';
import { listen, stopListen, srSupported, isMatch, numWords } from './listen.js';
import { connect, send, stopNet, net, addPeer, removePeer, onRtc, micOn, micOff, voiceLevel, setPeerVolume } from './net.js';
import { initPad, closePad, padOpen, tracePad, TRACE, drawPad, EXAMPLES, EXAMPLE_NAMES, puzzlePad, SCENE_COUNT } from './pad.js';
import * as W from './world.js';

/* =========================================================
   UTIL
   ========================================================= */
const $ = (s) => document.querySelector(s);
const rand = (a, b) => a + Math.random() * (b - a);
const randi = (a, b) => Math.floor(rand(a, b + 1));
const pick = (a) => a[Math.floor(Math.random() * a.length)];
const shuffle = (a) => { for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const cap = (s) => s.charAt(0).toUpperCase() + s.slice(1);
const NUM = ['nol', 'satu', 'dua', 'tiga', 'empat', 'lima', 'enam', 'tujuh', 'delapan', 'sembilan', 'sepuluh', 'sebelas', 'dua belas'];
const todayStr = () => { const d = new Date(); return `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`; };

const COLORS = {
  merah: '#e8434b', oranye: '#ff8a2a', kuning: '#ffd23a', hijau: '#3fb25a',
  biru: '#3a7cf5', ungu: '#9a62e0', 'merah muda': '#ff8fc0', hitam: '#2c2f3a',
  putih: '#f4f4f4', cokelat: '#8a5a35',
};
const WEAR = ['merah', 'oranye', 'kuning', 'hijau', 'biru', 'ungu', 'merah muda', 'hitam'];
const SKINS = ['#f6d2b4', '#e3ac83', '#b97a52', '#7e4e2f'];
const HATS = {
  none: { name: 'Tanpa topi' },
  caping: { name: 'Caping', zone: 'kebun' },
  pelangi: { name: 'Topi Pelangi', zone: 'warna' },
  kucing: { name: 'Telinga Kucing', zone: 'hewan' },
  mahkota: { name: 'Mahkota', zone: 'pola' },
  kerucut: { name: 'Topi Pesta', zone: 'bentuk' },
  nelayan: { name: 'Topi Nelayan', zone: 'ikan' },
  headphone: { name: 'Headphone', zone: 'musik' },
  penyihir: { name: 'Topi Penyihir', zone: 'kembar' },
  tinggi: { name: 'Topi Tinggi', zone: 'ukuran' },
  bunga: { name: 'Bando Bunga', zone: 'rasa' },
  pensil: { name: 'Topi Pensil', zone: 'tulis' },
  wisuda: { name: 'Topi Wisuda', zone: 'mtk' },
  baret: { name: 'Baret Pelukis', zone: 'gambar' },
  baling: { name: 'Topi Baling-baling', zone: 'puzzle' },
  bajak: { name: 'Topi Bajak Laut', zone: null },
  astronot: { name: 'Helm Astronot', zone: null },
  pelangi2: { name: 'Mahkota Pelangi', zone: null },
  abc: { name: 'Topi Huruf', zone: 'huruf' },
  angka123: { name: 'Topi Angka', zone: 'angka' },
  peci: { name: 'Peci', zone: 'iqro' },
  pesulap: { name: 'Topi Pesulap', zone: null },
  pendaki: { name: 'Helm Pendaki', zone: null, tower: true },
};
const ZONE_IDS = ['kebun', 'warna', 'hewan', 'pola', 'bentuk', 'ikan', 'musik', 'kembar', 'ukuran', 'rasa', 'tulis', 'mtk', 'gambar', 'puzzle', 'huruf', 'angka', 'iqro'];
// petualangan: kumpulkan Kristal Pelangi di setiap tempat, bab demi bab
const CHAPTERS = [
  { name: 'Bab 1: Tengah Pulau', zones: ['kebun', 'warna', 'hewan', 'pola'], prize: 'bajak', prizeName: 'Topi Bajak Laut' },
  { name: 'Bab 2: Lingkar Pelangi', zones: ['bentuk', 'ikan', 'musik', 'kembar', 'ukuran', 'rasa'], prize: 'astronot', prizeName: 'Helm Astronot' },
  { name: 'Bab 3: Pantai Ajaib', zones: ['tulis', 'mtk', 'gambar', 'puzzle'], prize: 'pesulap', prizeName: 'Topi Pesulap' },
  { name: 'Bab 4: Ujung Pulau', zones: ['huruf', 'angka', 'iqro'], prize: 'pelangi2', prizeName: 'Mahkota Pelangi' },
];
const CRYSTAL_COLORS = ['#ff5a5f', '#ff9f1c', '#ffd23a', '#3fd16a', '#2ec4f0', '#5b7cfa', '#b36bf2', '#ff7ac8', '#ff5a5f', '#ff9f1c', '#ffd23a', '#3fd16a', '#2ec4f0', '#b36bf2', '#ff7ac8', '#5b7cfa', '#3fd16a'];

/* =========================================================
   SIMPANAN (per perangkat)
   ========================================================= */
const zoneBlank = () => ({ level: 1, rounds: 0, first: 0, last: null });
const DEFAULT = {
  avatar: { shirt: 'biru', pants: 'hitam', skin: 1, hat: 'none', gender: 'L' },
  hats: ['none'], stars: 0, greeted: false, story: false, crystals: [], chapterDone: [],
  coins: 0, ammo: 0, hp: 3, maxHp: 5, weapons: ['tangan'], melee: 'tangan', gun: null, zkills: 0, summits: 0,
  zones: Object.fromEntries(ZONE_IDS.map((id) => [id, zoneBlank()])),
  // per pemain (diatur orang tua): level 0 = otomatis menyesuaikan, 1–4 = tetap; limit = menit per hari
  settings: { limit: 20, level: 0 },
  time: { date: todayStr(), sec: 0, bonus: 0 },
};
function merge(base, extra) {
  for (const k in extra) {
    if (extra[k] && typeof extra[k] === 'object' && !Array.isArray(extra[k]) && base[k] && typeof base[k] === 'object') merge(base[k], extra[k]);
    else base[k] = extra[k];
  }
  return base;
}
// simpanan per pemain: SQLite di server adalah sumber utama; localStorage hanya cadangan saat server mati
let save = structuredClone(DEFAULT);
// pengaturan perangkat ini (suara, efek bunyi, grafis, kamera): tidak ikut pemain
const DEV_KEY = 'pulau-balok-device';
const dev = Object.assign({ rate: 0.95, sfx: true, lite: false, voice: '', chat: true, cam: 'sedang' }, (() => { try { return JSON.parse(localStorage.getItem(DEV_KEY)) || {}; } catch (e) { return {}; } })());
function persistDev() { try { localStorage.setItem(DEV_KEY, JSON.stringify(dev)); } catch (e) { /* abaikan */ } }
function persist() {
  if (!playerKey) return;
  save.updated = Date.now();
  try { localStorage.setItem(localKey(playerKey), JSON.stringify(save)); } catch (e) { /* abaikan */ }
  pushSave();
}

/* =========================================================
   BUNYI (dibuat langsung, tanpa file)
   ========================================================= */
let AC = null;
function ac() {
  if (!AC) { try { AC = new (window.AudioContext || window.webkitAudioContext)(); } catch (e) { return null; } }
  if (AC.state === 'suspended') AC.resume();
  return AC;
}
function tone(freq, dur, { type = 'sine', vol = 0.16, delay = 0, slide = 0, force = false } = {}) {
  if (!dev.sfx && !force) return;
  const a = ac(); if (!a) return;
  const t = a.currentTime + delay;
  const o = a.createOscillator(); const g = a.createGain();
  o.type = type; o.frequency.setValueAtTime(freq, t);
  if (slide) o.frequency.exponentialRampToValueAtTime(freq * slide, t + dur);
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(vol, t + 0.015);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(g).connect(a.destination); o.start(t); o.stop(t + dur + 0.05);
}
const SFX = {
  pop() { tone(520, 0.12, { slide: 1.6, vol: 0.14 }); },
  tap() { tone(760, 0.07, { type: 'triangle', vol: 0.09 }); },
  good() { [523, 659, 784].forEach((f, i) => tone(f, 0.26, { type: 'triangle', delay: i * 0.09, vol: 0.15 })); },
  soft() { tone(330, 0.22, { slide: 0.85, vol: 0.09 }); },
  jump() { tone(380, 0.18, { type: 'square', slide: 1.8, vol: 0.04 }); },
  punch() { tone(130, 0.14, { type: 'square', slide: 0.6, vol: 0.09 }); tone(620, 0.1, { type: 'triangle', slide: 1.6, vol: 0.08, delay: 0.04 }); },
  swing() { tone(700, 0.12, { type: 'triangle', slide: 0.4, vol: 0.05 }); },
  splash() { tone(900, 0.25, { type: 'sine', slide: 0.3, vol: 0.06 }); tone(300, 0.3, { type: 'triangle', slide: 0.5, vol: 0.05, delay: 0.05 }); },
  fanfare() { [523, 659, 784, 1047, 784, 1047].forEach((f, i) => tone(f, 0.3, { type: 'triangle', delay: i * 0.12, vol: 0.15 })); },
  whoosh() { tone(900, 0.25, { slide: 0.4, vol: 0.05 }); },
  warp() { tone(300, 0.5, { slide: 3, vol: 0.06 }); tone(600, 0.4, { type: 'triangle', slide: 2, vol: 0.05, delay: 0.1 }); },
  // nada alat musik: tetap berbunyi walau efek bunyi dimatikan, karena inti permainan
  note(f) { tone(f, 0.55, { type: 'triangle', vol: 0.2, force: true }); tone(f * 2, 0.3, { vol: 0.04, force: true }); },
};

/* =========================================================
   SUARA BAHASA INDONESIA + GELEMBUNG TEKS
   ========================================================= */
// Agar Kak Rara terdengar seperti orang sungguhan:
// 1. Pilih suara terbaik di perangkat (suara "Natural"/"Enhanced"/Google jauh lebih manusiawi).
// 2. Pitch tidak dinaikkan: menaikkan pitch suara sintetis justru membuatnya terdengar seperti robot.
// 3. Kalimat dipecah dan diberi intonasi sendiri-sendiri (tanya naik, seru lebih bersemangat),
//    dengan sedikit variasi acak supaya tidak monoton.
const hasTTS = 'speechSynthesis' in window;
let voiceId = null; let idVoices = []; let lastLine = ''; let bubbleTimer = 0; let speakGen = 0; let bubbleAt = 0, bubbleStay = false;
const badVoices = new Set();
const isIndo = (v) => /^id([-_]|$)/i.test(v.lang) || /indones/i.test(v.name);
function voiceScore(v) {
  let s = 0;
  if (/natural|neural|premium|enhanced|plus|wavenet|studio/i.test(v.name)) s += 50;
  if (/google/i.test(v.name)) s += 30;
  if (/online/i.test(v.name)) s += 15;
  if (/gadis|damayanti|female|wanita|perempuan/i.test(v.name)) s += 8; // Kak Rara perempuan
  if (badVoices.has(v.voiceURI)) s -= 1000;
  return s;
}
function loadVoices() {
  if (!hasTTS) return;
  idVoices = speechSynthesis.getVoices().filter(isIndo).sort((a, b) => voiceScore(b) - voiceScore(a));
  const chosen = dev.voice && idVoices.find((v) => v.voiceURI === dev.voice && !badVoices.has(v.voiceURI));
  voiceId = chosen || idVoices.find((v) => !badVoices.has(v.voiceURI)) || null;
}
if (hasTTS) { loadVoices(); speechSynthesis.onvoiceschanged = loadVoices; }
// ucapan untuk mesin suara (teks di layar tetap apa adanya)
function spoken(t) {
  return t.replace(/\bHmm+\b/g, 'Hemm').replace(/\bmm+\b/gi, 'hem').replace(/"/g, '').replace(/\s+/g, ' ').trim();
}
function sentences(text) {
  const parts = text.match(/[^.!?…]+[.!?…]*/g) || [text];
  return parts.map((s) => s.trim()).filter(Boolean);
}
function speak(text, { calm = false, pitch: pOff = 0 } = {}) {
  if (!hasTTS || !text) return;
  try {
    speechSynthesis.cancel(); lastSpeakAt = performance.now();
    const gen = ++speakGen;
    const parts = sentences(text);
    const base = dev.rate;
    parts.forEach((p, i) => {
      const u = new SpeechSynthesisUtterance(spoken(p));
      u.lang = voiceId?.lang || 'id-ID'; if (voiceId) u.voice = voiceId;
      const ask = /\?$/.test(p), cheer = /!$/.test(p), single = parts.length === 1 && p.split(' ').length <= 2;
      const soft = /^(hemm|hmm|hmm,|nah|pelan|tarik napas|kalau)/i.test(p) || calm;
      let pitch = 1 + jit(-0.03, 0.03), rate = base * jit(0.97, 1.03);
      if (ask) { pitch += 0.06; rate *= 0.97; }
      if (cheer && !single) { pitch += 0.05; rate *= 1.04; }
      if (soft) { pitch -= 0.03; rate *= 0.92; }
      if (i === parts.length - 1 && parts.length > 1) rate *= 0.97; // melambat di akhir, seperti orang bercerita
      u.pitch = clamp(clamp(pitch, 0.85, 1.15) + pOff, 0.4, 1.9); u.rate = clamp(rate, 0.6, 1.3);
      u.onerror = (e) => {
        // suara online (mis. Google) gagal saat tanpa internet: tandai, pakai suara lain, ulangi sekali
        if (gen !== speakGen || !voiceId || voiceId.localService || badVoices.has(voiceId.voiceURI) || /interrupt|cancel/.test(e.error || '')) return;
        badVoices.add(voiceId.voiceURI); loadVoices(); speak(text, { calm });
      };
      speechSynthesis.speak(u);
    });
  } catch (e) { /* tanpa suara */ }
}
// dianggap masih bicara paling lama 12 detik setelah kalimat terakhir (beberapa perangkat tidak pernah melapor selesai)
let lastSpeakAt = 0;
const isSpeaking = () => hasTTS && speechSynthesis.speaking && performance.now() - lastSpeakAt < 12000;
// acak terpisah untuk intonasi, supaya tidak mengganggu acak ronde bersama
let jitSeed = 12345; const jit = (a, b) => { jitSeed = (jitSeed * 16807) % 2147483647; return a + ((jitSeed % 10000) / 10000) * (b - a); };
let sayBuffer = null; // saat membuat soal, ucapan ditahan dulu (soal bisa diulang bila pernah keluar)
function say(text, { who = 'Kak Rara', stay = false, force = false, pitch = 0 } = {}) {
  if (sayBuffer) { sayBuffer.push([text, { who, stay, force, pitch }]); return; }
  if (activeZone?.hush && !force) return;
  lastLine = text;
  $('#bubbleWho').textContent = who;
  $('#bubbleText').textContent = text; $('#padText').textContent = text; $('#spText').textContent = text;
  $('#bubble').hidden = false; bubbleAt = performance.now(); bubbleStay = stay;
  clearTimeout(bubbleTimer);
  if (!stay) bubbleTimer = setTimeout(() => { if (!activeZone) $('#bubble').hidden = true; }, 8000);
  speak(text, { pitch });
}
function toast(t) { const el = $('#toast'); el.textContent = t; el.hidden = false; clearTimeout(el._t); el._t = setTimeout(() => (el.hidden = true), 1800); }

const ROLES_ADULT = new Set(['ayah', 'ibu', 'kakek', 'nenek', 'paman', 'bibi']);
const PRAISE = [
  'Kamu teliti sekali!', 'Kerja bagus, kamu fokus!', 'Kamu memperhatikan baik-baik, ya!',
  'Kamu berpikir dulu sebelum memilih. Keren!', 'Bagus, kamu mencoba sendiri!',
  'Kak Rara senang lihat kamu serius begitu.', 'Wah, kamu sabar sekali tadi.', 'Pelan-pelan tapi pasti. Mantap!',
];
const PRAISE_RETRY = [
  'Kamu tidak menyerah. Hebat!', 'Kamu terus mencoba sampai bisa!', 'Tadi sulit, tapi kamu coba lagi. Keren!',
  'Salah itu tidak apa-apa, yang penting kamu mencoba lagi.', 'Nah, akhirnya bisa juga! Kak Rara bangga.',
];
// pembuka acak supaya Kak Rara tidak selalu mengucapkan kalimat yang sama
const YAY = ['Yeay!', 'Hore!', 'Wah, betul!', 'Iya, betul sekali!', 'Asyik!', 'Nah, itu dia!'];
const OOPS = ['Hmm, belum tepat.', 'Eh, hampir!', 'Oh, bukan yang itu.', 'Hmm, coba lagi, ya.'];
function greeting() {
  const h = new Date().getHours();
  return h < 11 ? 'Selamat pagi!' : h < 15 ? 'Selamat siang!' : h < 18 ? 'Selamat sore!' : 'Selamat malam!';
}

/* =========================================================
   RENDERER & SCENE
   ========================================================= */
const canvas = $('#c');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
window.__pbRenderer = renderer;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
const scene = new THREE.Scene();
const SKY = new THREE.Color('#8fd3ff');
scene.background = SKY;
scene.fog = new THREE.Fog(SKY, 90, 250);
const camera = new THREE.PerspectiveCamera(50, 1, 0.1, 520);
camera.position.set(0, 24, 36);
scene.add(camera); // agar tangan orang pertama ikut tergambar
const hemi = new THREE.HemisphereLight('#ffffff', '#86b76a', 1.35);
scene.add(hemi);
const sun = new THREE.DirectionalLight('#fff3d6', 1.7);
sun.position.set(16, 30, 14);
sun.castShadow = true;
sun.shadow.mapSize.set(2048, 2048);
Object.assign(sun.shadow.camera, { left: -30, right: 30, top: 30, bottom: -30, near: 1, far: 90 });
sun.shadow.bias = -0.0008;
scene.add(sun, sun.target);
const SUN_OFS = new THREE.Vector3(16, 30, 14);

function applyGraphics() {
  const lite = dev.lite;
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, lite ? 1 : 2));
  sun.castShadow = !lite;
  resize();
}
function resize() {
  const w = window.innerWidth, h = window.innerHeight;
  renderer.setSize(w, h, false);
  camera.aspect = w / h; camera.updateProjectionMatrix();
}
window.addEventListener('resize', resize);

const BOX = new THREE.BoxGeometry(1, 1, 1);
const matCache = new Map();
function mat(color) {
  if (!matCache.has(color)) matCache.set(color, new THREE.MeshLambertMaterial({ color }));
  return matCache.get(color);
}
function box(w, h, d, color, x = 0, y = 0, z = 0, parent = null, shadow = true) {
  const m = new THREE.Mesh(BOX, typeof color === 'string' ? mat(color) : color);
  m.scale.set(w, h, d); m.position.set(x, y, z);
  m.castShadow = shadow; m.receiveShadow = true;
  if (parent) parent.add(m);
  return m;
}
const HIT_MAT = new THREE.MeshBasicMaterial({ transparent: true, opacity: 0, depthWrite: false, colorWrite: false });
function hitBox(w, h, d, x, y, z, parent) {
  // tidak digambar (hemat), tapi tetap terkena raycast ketukan
  const m = new THREE.Mesh(BOX, HIT_MAT); m.scale.set(w, h, d); m.position.set(x, y, z); m.visible = false; parent.add(m); return m;
}

/* ---------- tekstur teks ---------- */
const FONT = '"Baloo 2","Nunito","Arial Rounded MT Bold",sans-serif';
function canvasTex(w, h, draw) {
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  const g = c.getContext('2d'); draw(g, w, h);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4;
  t.userData = { canvas: c, g };
  return t;
}
function rrect(g, x, y, w, h, r) {
  g.beginPath(); g.moveTo(x + r, y); g.arcTo(x + w, y, x + w, y + h, r); g.arcTo(x + w, y + h, x, y + h, r);
  g.arcTo(x, y + h, x, y, r); g.arcTo(x, y, x + w, y, r); g.closePath();
}
function glyphTex(text, bg, fg, size = 170) {
  return canvasTex(256, 256, (g) => {
    g.fillStyle = bg; g.fillRect(0, 0, 256, 256);
    g.fillStyle = 'rgba(255,255,255,.9)'; rrect(g, 22, 22, 212, 212, 40); g.fill();
    g.fillStyle = fg; g.textAlign = 'center'; g.textBaseline = 'middle';
    g.font = `800 ${size}px ${FONT}`; g.fillText(text, 128, 140);
  });
}
function glyphBlock(text, color, size = 0.9) {
  const tex = glyphTex(text, color, '#1d2b53');
  const side = mat(color); const face = new THREE.MeshLambertMaterial({ map: tex });
  const m = new THREE.Mesh(BOX, [side, side, face, side, face, side]);
  m.scale.setScalar(size); m.castShadow = true; m.receiveShadow = true;
  return m;
}
const EMOJI_FONT = '"Apple Color Emoji","Segoe UI Emoji","Noto Color Emoji","Twemoji Mozilla",sans-serif';
function emojiTex(ch, bg = '#ffffff') {
  return canvasTex(256, 256, (g) => {
    g.fillStyle = bg; rrect(g, 0, 0, 256, 256, 44); g.fill();
    g.textAlign = 'center'; g.textBaseline = 'middle'; g.font = `170px ${EMOJI_FONT}`; g.fillText(ch, 128, 142);
  });
}
// papan kayu bertiang dengan kanvas yang bisa digambar ulang
function makeBoard(parent, x, z, w = 2.0, h = 1.5, y = 2.9) {
  box(0.2, y - h / 2 + 0.1, 0.2, '#8a5a35', x, (y - h / 2 + 0.1) / 2, z - 0.1, parent);
  const tex = canvasTex(Math.round(160 * w), Math.round(160 * h), () => {});
  const wood = mat('#c98f52'); const face = new THREE.MeshLambertMaterial({ map: tex });
  const b = new THREE.Mesh(BOX, [wood, wood, wood, wood, face, wood]); b.scale.set(w, h, 0.14); b.position.set(x, y, z); b.castShadow = true; parent.add(b);
  return tex;
}
// lukis bentuk geometri di kanvas (dipakai Taman Bentuk)
function tracePath(g, shape, cx, cy, r) {
  g.beginPath();
  if (shape === 'lingkaran') g.arc(cx, cy, r, 0, Math.PI * 2);
  else if (shape === 'segitiga') { g.moveTo(cx, cy - r); g.lineTo(cx + r * 1.0, cy + r * 0.8); g.lineTo(cx - r * 1.0, cy + r * 0.8); g.closePath(); }
  else if (shape === 'persegi') g.rect(cx - r * 0.85, cy - r * 0.85, r * 1.7, r * 1.7);
  else if (shape === 'persegi panjang') g.rect(cx - r * 1.05, cy - r * 0.6, r * 2.1, r * 1.2);
  else if (shape === 'bintang') { for (let i = 0; i < 10; i++) { const a = -Math.PI / 2 + (i * Math.PI) / 5; const rr = i % 2 ? r * 0.45 : r * 1.05; g.lineTo(cx + Math.cos(a) * rr, cy + Math.sin(a) * rr); } g.closePath(); }
  else if (shape === 'hati') { g.moveTo(cx, cy + r * 0.9); g.bezierCurveTo(cx - r * 1.5, cy - r * 0.1, cx - r * 0.7, cy - r * 1.2, cx, cy - r * 0.45); g.bezierCurveTo(cx + r * 0.7, cy - r * 1.2, cx + r * 1.5, cy - r * 0.1, cx, cy + r * 0.9); g.closePath(); }
  else if (shape === 'oval') g.ellipse(cx, cy, r * 1.05, r * 0.68, 0, 0, Math.PI * 2);
}
function shapeTex(shape, color, silhouette = false) {
  return canvasTex(256, 256, (g) => {
    g.fillStyle = '#fffaf0'; g.fillRect(0, 0, 256, 256);
    tracePath(g, shape, 128, 132, 86);
    g.fillStyle = silhouette ? '#3b3f55' : color; g.fill();
    g.lineWidth = 8; g.lineJoin = 'round'; g.strokeStyle = silhouette ? '#3b3f55' : '#1d2b53'; g.stroke();
  });
}

/* =========================================================
   TWEEN & PARTIKEL
   ========================================================= */
const tweens = [];
const easeOut = (k) => 1 - Math.pow(1 - k, 3);
const easeInOut = (k) => (k < 0.5 ? 4 * k * k * k : 1 - Math.pow(-2 * k + 2, 3) / 2);
function tween(dur, fn, ease = easeOut) {
  return new Promise((res) => tweens.push({ t: 0, dur, fn, ease, res }));
}
function flyTo(obj, to, { height = 1.2, dur = 0.55, scaleTo = null } = {}) {
  const from = obj.position.clone(); const s0 = obj.scale.clone();
  return tween(dur, (k) => {
    obj.position.lerpVectors(from, to, k);
    obj.position.y += Math.sin(k * Math.PI) * height;
    if (scaleTo !== null) obj.scale.copy(s0).multiplyScalar(1 + (scaleTo - 1) * k);
  }, easeInOut);
}
function hop(obj, h = 0.45, dur = 0.35) {
  const y0 = obj.userData.baseY ?? obj.position.y; obj.userData.baseY = y0;
  return tween(dur, (k) => { obj.position.y = y0 + Math.sin(k * Math.PI) * h; }, (k) => k);
}
function wiggle(obj) {
  const r0 = obj.rotation.y;
  return tween(0.45, (k) => { obj.rotation.y = r0 + Math.sin(k * Math.PI * 4) * 0.35 * (1 - k); }, (k) => k);
}
const particles = [];
const PART_GEO = new THREE.BoxGeometry(0.18, 0.18, 0.18);
function burst(pos, colors = ['#ffd23a', '#ffffff', '#ff8fc0', '#7cc8f5']) {
  for (let i = 0; i < 16; i++) {
    const m = new THREE.Mesh(PART_GEO, mat(pick(colors)));
    m.position.copy(pos);
    m.userData.v = new THREE.Vector3(rand(-2.5, 2.5), rand(3.5, 6.5), rand(-2.5, 2.5));
    m.userData.life = 1;
    scene.add(m); particles.push(m);
  }
}

/* =========================================================
   PULAU
   ========================================================= */
const R = 99;
// 4 tempat di lingkar dalam, 6 tempat di lingkar luar
const ZONES_POS = {
  // jarak antarlokasi dibuat lebar supaya terasa berpetualang
  kebun: [-18, -18], warna: [18, -18], hewan: [-18, 18], pola: [18, 18],
  bentuk: [50, 0], ikan: [25, 43], musik: [-25, 43], kembar: [-50, 0], ukuran: [-25, -43], rasa: [25, -43],
  puzzle: [62, 36], gambar: [-62, 36], tulis: [-62, -36], mtk: [62, -36],
  huruf: [0, 85], angka: [0, -85], iqro: [85, 0],
};
const MIDDLE = ['bentuk', 'ikan', 'musik', 'kembar', 'ukuran', 'rasa'];
const RING2 = 61.5; // jalan melingkar luar
const INNER = ['kebun', 'warna', 'hewan', 'pola'];
const RING = 37.5; // jalan melingkar
const PATHS = [[0, 0, 0, RING2], [0, 0, 0, -RING2], [0, 0, RING, 0], [0, 0, -RING, 0]];
for (const id of ZONE_IDS) {
  const [x, z] = ZONES_POS[id]; const d = Math.hypot(x, z);
  if (INNER.includes(id)) PATHS.push([0, 0, x * 0.62, z * 0.62]);
  else if (MIDDLE.includes(id)) PATHS.push([(x * RING) / d, (z * RING) / d, (x * (d - 6)) / d, (z * (d - 6)) / d]);
  else PATHS.push([(x * RING2) / d, (z * RING2) / d, (x * (d - 6)) / d, (z * (d - 6)) / d]);
}
// landmark hiasan: {x,z,r} supaya pohon tidak tumbuh di atasnya
const LANDMARKS = {
  mercusuar: { x: -88, z: -30, r: 4 }, dermaga: { x: -86, z: 30, r: 5 }, desa: { x: -45, z: 78, r: 6 },
  kolam: { x: -45, z: -78, r: 6 }, kincir: { x: 45, z: 78, r: 5 },
};
// bangunan, menara, gunung & kapal (world.js): pohon tidak tumbuh di sana, ada jalan setapak ke pintunya
for (const [id, p] of Object.entries(W.PLACES)) LANDMARKS[id] = { x: p.x, z: p.z, r: p.r };
// jalur pandang kamera di depan pintu (titik datang dari peta) dibiarkan bebas pohon
for (const [id, p] of Object.entries(W.PLACES)) { if (id === 'kapal') continue; const [gx, gz] = p.go, dx = gx - p.x, dz = gz - p.z, d = Math.hypot(dx, dz) || 1; for (const k of [3.5, 9]) LANDMARKS[`${id}_cam${k}`] = { x: gx + (dx / d) * k, z: gz + (dz / d) * k, r: 4 }; }
for (const id of ['sekolah', 'kantin', 'gedung', 'rumah']) { const { x, z } = W.PLACES[id]; const d = Math.hypot(x, z); PATHS.push([(x * RING) / d, (z * RING) / d, (x * (d - 5.5)) / d, (z * (d - 5.5)) / d]); }
PATHS.push([-RING2, 0, W.TOWER.x + W.TOWER.fence, 0]);
const colliders = []; // {x,z,r}
function distToSeg(px, pz, ax, az, bx, bz) {
  const vx = bx - ax, vz = bz - az; const t = clamp(((px - ax) * vx + (pz - az) * vz) / (vx * vx + vz * vz), 0, 1);
  return Math.hypot(px - (ax + vx * t), pz - (az + vz * t));
}
const edgeR = (x, z) => R + Math.sin(x * 0.3) * 1.3 + Math.cos(z * 0.27) * 1.3;
function onPath(x, z) {
  const d = Math.hypot(x, z);
  if (Math.abs(d - RING) < 1.1 || Math.abs(d - RING2) < 1.1) return true;
  for (const [ax, az, bx, bz] of PATHS) if (distToSeg(x, z, ax, az, bx, bz) < 1.15) return true;
  return false;
}
// apakah titik ini mengganggu tempat bermain / pandangan kamera / landmark
function blockedSpot(x, z, pad = 9.5) {
  for (const [zx, zz] of Object.values(ZONES_POS)) {
    if (Math.hypot(x - zx, z - zz) < pad) return true;
    if (Math.abs(x - zx) < 8 && z > zz && z < zz + 17) return true; // jalur pandang kamera zona
  }
  for (const l of Object.values(LANDMARKS)) if (Math.hypot(x - l.x, z - l.z) < l.r + 1.5) return true;
  return false;
}
function tree(x, z, s = 1) {
  const g = new THREE.Group(); g.position.set(x, 0, z); g.rotation.y = rand(0, 3); g.scale.setScalar(s);
  box(0.6, 2.2, 0.6, '#8a5a35', 0, 1.1, 0, g);
  box(2.4, 1.6, 2.4, pick(['#3f9b45', '#47a84d', '#3a8f40']), 0, 2.8, 0, g);
  box(1.6, 1.0, 1.6, '#5cbf5c', 0, 4.0, 0, g);
  if (Math.random() < 0.25) for (let i = 0; i < 3; i++) box(0.28, 0.28, 0.28, pick(['#e8434b', '#ff9a1f']), rand(-1, 1), rand(2.2, 3.2), 1.22 * pick([-1, 1]), g, false);
  scene.add(g); colliders.push({ x, z, r: 0.9 * s });
}
function palm(x, z) {
  const g = new THREE.Group(); g.position.set(x, 0, z); g.rotation.y = rand(0, 6); const s = rand(0.9, 1.2); g.scale.setScalar(s);
  const lean = rand(-0.25, 0.25);
  for (let i = 0; i < 6; i++) box(0.42, 0.62, 0.42, i % 2 ? '#a77a4a' : '#956a3d', lean * i * 0.6, 0.31 + i * 0.6, 0, g);
  const top = new THREE.Group(); top.position.set(lean * 3.6, 3.7, 0); g.add(top);
  for (let i = 0; i < 5; i++) {
    const leaf = new THREE.Group(); leaf.rotation.y = (i / 5) * Math.PI * 2; top.add(leaf);
    const l = box(2.2, 0.14, 0.6, '#3fae4f', 1.0, -0.2, 0, leaf); l.rotation.z = -0.35;
  }
  box(0.36, 0.36, 0.36, '#7a5a2a', 0.2, -0.3, 0.2, top); box(0.36, 0.36, 0.36, '#7a5a2a', -0.25, -0.35, -0.1, top);
  scene.add(g); colliders.push({ x, z, r: 0.5 * s });
}
const animated = []; // objek hiasan yang bergerak: {obj, fn(t,dt)}
function buildLandmarks() {
  // mercusuar
  { const { x, z } = LANDMARKS.mercusuar; const g = new THREE.Group(); g.position.set(x, 0, z); scene.add(g);
    box(3.4, 0.6, 3.4, '#b9b3a6', 0, 0.3, 0, g);
    for (let i = 0; i < 6; i++) box(2.2 - i * 0.12, 1.2, 2.2 - i * 0.12, i % 2 ? '#ffffff' : '#e8434b', 0, 1.2 + i * 1.2, 0, g);
    box(1.9, 1.1, 1.9, '#ffe9a0', 0, 8.3, 0, g); box(2.3, 0.3, 2.3, '#1d2b53', 0, 7.7, 0, g); box(2.1, 0.5, 2.1, '#e8434b', 0, 9.1, 0, g); box(1.0, 0.5, 1.0, '#e8434b', 0, 9.6, 0, g);
    const beam = box(0.6, 0.3, 5, '#fff3b0', 0, 8.3, 0, g, false); beam.material = new THREE.MeshBasicMaterial({ color: '#fff3b0', transparent: true, opacity: 0.55 });
    animated.push({ obj: beam, fn: (t) => (beam.rotation.y = t * 0.8) });
    colliders.push({ x, z, r: 1.8 }); }
  // desa kecil
  { const { x, z } = LANDMARKS.desa;
    [[-2.6, -1.5, '#ffb3a7', 1.1], [2.4, -2.2, '#a7d8ff', 1.0], [0, 2.6, '#ffe39a', 0.9]].forEach(([dx, dz, c, s]) => {
      const h = new THREE.Group(); h.position.set(x + dx, 0, z + dz); h.scale.setScalar(s * 1.6); h.rotation.y = Math.atan2(-(x + dx), -(z + dz)); scene.add(h);
      box(1.4, 1.1, 1.2, c, 0, 0.55, 0, h); box(1.62, 0.3, 1.4, '#b5523b', 0, 1.25, 0, h); box(1.1, 0.3, 1.0, '#b5523b', 0, 1.55, 0, h); box(0.55, 0.26, 0.6, '#b5523b', 0, 1.82, 0, h);
      box(0.3, 0.52, 0.07, '#5b3b22', 0, 0.3, 0.61, h); box(0.28, 0.28, 0.06, '#e8f6ff', -0.46, 0.75, 0.61, h, false); box(0.28, 0.28, 0.06, '#e8f6ff', 0.46, 0.75, 0.61, h, false);
      colliders.push({ x: x + dx, z: z + dz, r: 1.5 * s * 1.3 });
    }); }
  // kolam teratai
  { const { x, z } = LANDMARKS.kolam; const g = new THREE.Group(); g.position.set(x, 0, z); scene.add(g);
    for (let i = -4; i <= 4; i++) for (let j = -3; j <= 3; j++) { if (Math.hypot(i / 4.4, j / 3.4) > 1) continue; box(1, 0.1, 1, '#4cb4ea', i, 0.02, j, g, false).receiveShadow = true; }
    for (let i = -5; i <= 5; i++) for (let j = -4; j <= 4; j++) { const e = Math.hypot(i / 5.2, j / 4.2); if (e > 1 || e < 0.86) continue; box(1, 0.3, 1, pick(['#b9b3a6', '#a8a294']), i, 0.15, j, g); }
    [[-2, -1], [1.5, 1], [2.5, -1.4], [-1, 1.6]].forEach(([dx, dz]) => { box(0.9, 0.06, 0.9, '#3fae4f', dx, 0.1, dz, g, false); box(0.24, 0.2, 0.24, '#ff8fc0', dx + 0.2, 0.2, dz, g, false); });
    const frog = new THREE.Group(); frog.position.set(-2, 0.13, -1); g.add(frog);
    box(0.5, 0.3, 0.5, '#57c24a', 0, 0.15, 0, frog); box(0.12, 0.12, 0.12, '#ffffff', -0.14, 0.34, 0.16, frog, false); box(0.12, 0.12, 0.12, '#ffffff', 0.14, 0.34, 0.16, frog, false);
    animated.push({ obj: frog, fn: (t) => { const k = (t * 0.5) % 1; frog.position.y = 0.13 + (k > 0.85 ? Math.sin(((k - 0.85) / 0.15) * Math.PI) * 0.6 : 0); } });
    colliders.push({ x, z, r: 4.2 }); }
  // kincir angin di kebun bunga
  { const { x, z } = LANDMARKS.kincir; const g = new THREE.Group(); g.position.set(x, 0, z); g.rotation.y = Math.atan2(-x, -z) + Math.PI; scene.add(g);
    for (let i = 0; i < 5; i++) box(2.0 - i * 0.2, 1.0, 2.0 - i * 0.2, '#f4ecd8', 0, 0.5 + i, 0, g);
    box(1.6, 0.6, 1.6, '#b5523b', 0, 5.3, 0, g);
    const hub = new THREE.Group(); hub.position.set(0, 4.4, 1.1); g.add(hub);
    for (let i = 0; i < 4; i++) { const arm = new THREE.Group(); arm.rotation.z = (i * Math.PI) / 2; hub.add(arm); box(0.2, 2.6, 0.1, '#8a5a35', 0, 1.4, 0, arm); box(0.7, 2.0, 0.06, '#ffffff', 0.4, 1.6, 0, arm); }
    animated.push({ obj: hub, fn: (t) => (hub.rotation.z = t * 1.2) });
    for (let i = 0; i < 40; i++) { const a = rand(0, 6.28), r = rand(2.5, 5); box(0.26, 0.26, 0.26, pick(['#ff8fc0', '#ffd23a', '#e8434b', '#9a62e0', '#ffffff']), x + Math.cos(a) * r, 0.3, z + Math.sin(a) * r, scene, false); }
    colliders.push({ x, z, r: 1.4 }); }
}
// gabungkan balok hiasan yang diam menjadi InstancedMesh per bahan: ribuan draw call jadi puluhan saja
function staticBatch(roots, skip = new Set()) {
  scene.updateMatrixWorld(true);
  const groups = new Map(); const remove = [];
  for (const root of roots) root.traverse((o) => {
    if (!o.isMesh || o.isInstancedMesh || o.geometry !== BOX || Array.isArray(o.material) || o.material.map || o.material.transparent || o.material === HIT_MAT) return;
    for (let q = o; q; q = q.parent) if (skip.has(q) || q.userData?.tap || q.userData?.dynamic) return;
    const key = o.material.uuid + (o.castShadow ? ':s' : '');
    if (!groups.has(key)) groups.set(key, { mat: o.material, cast: o.castShadow, list: [] });
    groups.get(key).list.push(o.matrixWorld.clone()); remove.push(o);
  });
  for (const o of remove) o.parent.remove(o);
  for (const g of groups.values()) {
    const im = new THREE.InstancedMesh(BOX, g.mat, g.list.length);
    g.list.forEach((m, i) => im.setMatrixAt(i, m));
    im.castShadow = g.cast; im.receiveShadow = true; im.frustumCulled = false; scene.add(im);
  }
  return remove.length;
}
const waterMat = new THREE.MeshLambertMaterial({ color: '#4cb4ea' });
function buildIsland() {
  const cells = [];
  for (let x = -R - 3; x <= R + 3; x++) for (let z = -R - 3; z <= R + 3; z++) {
    const d = Math.hypot(x, z); const e = edgeR(x, z);
    if (d < e) cells.push({ x, z, d, e });
  }
  const top = new THREE.InstancedMesh(BOX, new THREE.MeshLambertMaterial({ color: '#ffffff' }), cells.length);
  // tanah bawah hanya di tepi pantai (bagian dalam tidak pernah terlihat) supaya ringan
  const shore = cells.filter((cl) => cl.d > cl.e - 4);
  const under = new THREE.InstancedMesh(BOX, new THREE.MeshLambertMaterial({ color: '#ffffff' }), shore.length * 2);
  top.receiveShadow = true; under.receiveShadow = true;
  const m4 = new THREE.Matrix4(); const c = new THREE.Color();
  cells.forEach((cl, i) => {
    m4.makeTranslation(cl.x, -0.5, cl.z); top.setMatrixAt(i, m4);
    let col; const beach = cl.d > cl.e - 2.8;
    if (beach) col = cl.d > cl.e - 1.2 ? '#f2d993' : '#f5e2a6';
    else if (cl.d < 5) col = (cl.x + cl.z) % 2 === 0 ? '#f3e7c6' : '#eadbb4';
    else if (onPath(cl.x, cl.z)) col = '#e9d3a0';
    else col = (Math.random() < 0.5) ? '#67c25a' : '#5fb953';
    c.set(col); if (col.startsWith('#6') || col.startsWith('#5')) c.offsetHSL(0, 0, rand(-0.025, 0.025));
    top.setColorAt(i, c);
  });
  shore.forEach((cl, i) => {
    m4.makeTranslation(cl.x, -1.5, cl.z); under.setMatrixAt(i * 2, m4);
    under.setColorAt(i * 2, c.set(cl.d > cl.e - 2.8 ? '#e0c27a' : '#9b6b43'));
    m4.makeTranslation(cl.x, -2.5, cl.z); under.setMatrixAt(i * 2 + 1, m4);
    under.setColorAt(i * 2 + 1, c.set('#8b6a4b'));
  });
  scene.add(top, under);
  const water = new THREE.Mesh(new THREE.PlaneGeometry(900, 900), waterMat);
  water.rotation.x = -Math.PI / 2; water.position.y = -0.85; water.receiveShadow = true; scene.add(water);
  buildLandmarks();
  // pohon
  const trees = [];
  let tries = 0;
  while (trees.length < 330 && tries++ < 30000) {
    const a = rand(0, Math.PI * 2), r = rand(6, R - 3);
    const x = Math.cos(a) * r, z = Math.sin(a) * r;
    if (r > edgeR(x, z) - 3.4) continue;
    let ok = !blockedSpot(x, z) && !onPath(x, z) && Math.hypot(x, z) > 6.5;
    for (const [ax, az, bx, bz] of PATHS) if (distToSeg(x, z, ax, az, bx, bz) < 2.2) ok = false;
    if (Math.abs(Math.hypot(x, z) - RING) < 2.4 || Math.abs(Math.hypot(x, z) - RING2) < 2.4) ok = false;
    for (const t of trees) if (Math.hypot(t.x - x, t.z - z) < 3.2) ok = false;
    if (ok) trees.push({ x, z });
  }
  for (const t of trees) tree(t.x, t.z, rand(0.85, 1.2));
  // pohon kelapa di pantai
  let palms = 0; tries = 0;
  while (palms < 55 && tries++ < 6000) {
    const a = rand(0, Math.PI * 2); const x0 = Math.cos(a), z0 = Math.sin(a); const r = edgeR(x0 * R, z0 * R) - rand(2.2, 3.2);
    const x = x0 * r, z = z0 * r;
    if (blockedSpot(x, z, 8.5) || onPath(x, z) || colliders.some((cc) => Math.hypot(cc.x - x, cc.z - z) < 4)) continue;
    palm(x, z); palms++;
  }
  // batu pantai
  for (let i = 0; i < 30; i++) {
    const a = rand(0, Math.PI * 2); const x0 = Math.cos(a), z0 = Math.sin(a); const r = edgeR(x0 * R, z0 * R) - rand(0.2, 1.2);
    const x = x0 * r, z = z0 * r; if (blockedSpot(x, z, 7.5)) continue;
    const s = rand(0.6, 1.3); box(s * 1.3, s, s, pick(['#a8a294', '#b9b3a6', '#9a9486']), x, s / 2 - 0.2, z, scene).rotation.y = rand(0, 3);
  }
  // bunga & semak kecil
  for (let i = 0; i < 900; i++) {
    const a = rand(0, Math.PI * 2), r = rand(5.5, R - 3);
    const x = Math.cos(a) * r, z = Math.sin(a) * r;
    if (r > edgeR(x, z) - 3 || onPath(x, z) || blockedSpot(x, z, 7.6)) continue;
    if (Math.random() < 0.3) box(0.9, 0.6, 0.9, '#4fae4a', x, 0.3, z, scene);
    else { box(0.08, 0.35, 0.08, '#3a8f40', x, 0.17, z, scene, false); box(0.24, 0.24, 0.24, pick(['#ff8fc0', '#ffd23a', '#ffffff', '#ff8a2a']), x, 0.42, z, scene, false); }
  }
  // kupu-kupu
  for (let i = 0; i < 10; i++) {
    const b = new THREE.Group(); const col = pick(['#ff8fc0', '#ffd23a', '#7cc8f5', '#ffffff', '#ff8a2a']);
    const wl = box(0.3, 0.04, 0.26, col, -0.15, 0, 0, b, false), wr = box(0.3, 0.04, 0.26, col, 0.15, 0, 0, b, false);
    box(0.06, 0.06, 0.3, '#1d2b53', 0, 0, 0, b, false);
    const a0 = rand(0, 6.28), r0 = rand(8, 88), cx = Math.cos(a0) * r0, cz = Math.sin(a0) * r0, sp = rand(0.3, 0.6), ph = rand(0, 6);
    scene.add(b);
    animated.push({ obj: b, fn: (t) => {
      const k = t * sp + ph; b.position.set(cx + Math.sin(k) * 3, 1.2 + Math.sin(k * 3) * 0.4, cz + Math.sin(k * 0.7) * 3);
      b.rotation.y = Math.atan2(Math.cos(k) * 3, Math.cos(k * 0.7) * 2.1);
      const f = Math.sin(t * 18 + ph) * 0.9; wl.rotation.z = f; wr.rotation.z = -f;
    } });
  }
  // awan
  for (let i = 0; i < 24; i++) {
    const g = new THREE.Group();
    const n = randi(3, 5);
    for (let k = 0; k < n; k++) box(rand(2, 4), rand(1, 1.6), rand(2, 3), '#ffffff', k * 1.8 - n, rand(-0.3, 0.3), rand(-0.6, 0.6), g, false);
    g.position.set(rand(-150, 150), rand(18, 30), rand(-130, 100));
    g.userData.speed = rand(0.4, 0.9);
    scene.add(g); clouds.push(g);
  }
}
const clouds = [];

/* =========================================================
   KARAKTER BALOK
   ========================================================= */
function faceTexture(skin, girl = false, zombie = false) {
  if (zombie) return canvasTex(128, 128, (g) => {
    g.fillStyle = skin; g.fillRect(0, 0, 128, 128);
    g.fillStyle = '#ffffff'; g.beginPath(); g.arc(42, 52, 16, 0, 7); g.fill(); g.beginPath(); g.arc(88, 56, 11, 0, 7); g.fill();
    g.fillStyle = '#1d2238'; g.beginPath(); g.arc(45, 55, 6, 0, 7); g.fill(); g.beginPath(); g.arc(86, 58, 5, 0, 7); g.fill();
    g.strokeStyle = '#2c4a20'; g.lineWidth = 5; g.lineCap = 'round'; g.beginPath(); g.moveTo(40, 92); for (let i = 1; i <= 6; i++) g.lineTo(40 + i * 8, 92 + (i % 2 ? -7 : 0)); g.stroke();
    g.lineWidth = 3; g.beginPath(); g.moveTo(100, 22); g.lineTo(112, 34); g.moveTo(104, 20); g.lineTo(100, 28); g.moveTo(110, 26); g.lineTo(106, 34); g.stroke();
  });
  return canvasTex(128, 128, (g) => {
    g.fillStyle = skin; g.fillRect(0, 0, 128, 128);
    g.globalAlpha = 0.45; g.fillStyle = '#ff8a9a';
    g.beginPath(); g.arc(28, 84, 11, 0, 7); g.fill(); g.beginPath(); g.arc(100, 84, 11, 0, 7); g.fill();
    g.globalAlpha = 1; g.fillStyle = '#1d2238';
    rrect(g, 34, 42, 16, 24, 8); g.fill(); rrect(g, 78, 42, 16, 24, 8); g.fill();
    g.fillStyle = '#fff'; g.beginPath(); g.arc(44, 49, 3.5, 0, 7); g.fill(); g.beginPath(); g.arc(88, 49, 3.5, 0, 7); g.fill();
    g.strokeStyle = '#1d2238'; g.lineWidth = 6; g.lineCap = 'round';
    g.beginPath(); g.arc(64, 78, 16, 0.18 * Math.PI, 0.82 * Math.PI); g.stroke();
    if (girl) { g.lineWidth = 4; for (const x of [34, 78]) { g.beginPath(); g.moveTo(x - 2, 44); g.lineTo(x - 8, 38); g.stroke(); } for (const x of [50, 94]) { g.beginPath(); g.moveTo(x + 2, 44); g.lineTo(x + 8, 38); g.stroke(); } }
  });
}
function makeCharacter({ shirt, pants, skin, hair = '#3b2a20', longHair = false, zombie = false }) {
  const root = new THREE.Group();
  const m = {
    shirt: new THREE.MeshLambertMaterial({ color: shirt }), pants: new THREE.MeshLambertMaterial({ color: pants }),
    skin: new THREE.MeshLambertMaterial({ color: skin }), hair: new THREE.MeshLambertMaterial({ color: hair }),
    face: new THREE.MeshLambertMaterial({ map: faceTexture(skin, false, zombie) }),
  };
  const part = (w, h, d, material, x, y, z, parent) => { const me = new THREE.Mesh(BOX, material); me.scale.set(w, h, d); me.position.set(x, y, z); me.castShadow = true; me.receiveShadow = true; parent.add(me); return me; };
  const body = new THREE.Group(); root.add(body);
  const hipL = new THREE.Group(); hipL.position.set(-0.25, 1.0, 0); body.add(hipL); part(0.48, 1.0, 0.5, m.pants, 0, -0.5, 0, hipL);
  const hipR = new THREE.Group(); hipR.position.set(0.25, 1.0, 0); body.add(hipR); part(0.48, 1.0, 0.5, m.pants, 0, -0.5, 0, hipR);
  part(1.0, 1.0, 0.52, m.shirt, 0, 1.5, 0, body);
  const arm = (x) => {
    const sh = new THREE.Group(); sh.position.set(x, 1.95, 0); body.add(sh);
    part(0.46, 0.4, 0.48, m.shirt, 0, -0.18, 0, sh); part(0.42, 0.66, 0.44, m.skin, 0, -0.7, 0, sh);
    return sh;
  };
  const shL = arm(-0.74), shR = arm(0.74);
  const head = new THREE.Group(); head.position.set(0, 2.0, 0); body.add(head);
  const hm = new THREE.Mesh(BOX, [m.skin, m.skin, m.skin, m.skin, m.face, m.skin]);
  hm.scale.setScalar(0.86); hm.position.y = 0.46; hm.castShadow = true; head.add(hm);
  part(0.92, 0.22, 0.92, m.hair, 0, 0.92, 0, head);
  part(0.92, 0.62, 0.2, m.hair, 0, 0.62, -0.38, head);
  // rambut panjang + pita (karakter perempuan); bisa dinyalakan/dimatikan
  const girlHair = new THREE.Group(); head.add(girlHair);
  part(0.34, 0.9, 0.26, m.hair, 0, 0.35, -0.56, girlHair); part(0.42, 0.18, 0.2, new THREE.MeshLambertMaterial({ color: '#ff5f8f' }), 0, 0.82, -0.5, girlHair);
  part(0.16, 0.7, 0.5, m.hair, -0.47, 0.4, -0.12, girlHair); part(0.16, 0.7, 0.5, m.hair, 0.47, 0.4, -0.12, girlHair);
  girlHair.visible = longHair; let girl = longHair;
  const hatSlot = new THREE.Group(); hatSlot.position.y = 1.02; head.add(hatSlot);
  return {
    root, body, hipL, hipR, shL, shR, head, hatSlot, m,
    setSkin(c) { this.skinColor = c; m.skin.color.set(c); m.face.map?.dispose(); m.face.map = faceTexture(c, girl); m.face.needsUpdate = true; },
    setGirl(v) { if (girl === !!v) return; girl = !!v; girlHair.visible = girl; this.setSkin(this.skinColor || skin); },
  };
}
function makeHat(id) {
  const g = new THREE.Group();
  if (id === 'caping') {
    box(1.5, 0.1, 1.5, '#e6c26b', 0, 0.02, 0, g); box(1.05, 0.14, 1.05, '#ddb658', 0, 0.14, 0, g);
    box(0.62, 0.14, 0.62, '#e6c26b', 0, 0.28, 0, g); box(0.26, 0.12, 0.26, '#d1a548', 0, 0.4, 0, g);
  } else if (id === 'pelangi') {
    ['#e8434b', '#ffd23a', '#3fb25a', '#3a7cf5'].forEach((c, i) => box(0.96 - i * 0.08, 0.1, 0.96 - i * 0.08, c, 0, 0.04 + i * 0.1, 0, g));
    box(0.8, 0.07, 0.45, '#e8434b', 0, 0.02, 0.62, g); box(0.18, 0.12, 0.18, '#ffffff', 0, 0.45, 0, g);
  } else if (id === 'kucing') {
    for (const s of [-1, 1]) {
      const e = new THREE.Group(); e.position.set(s * 0.3, 0.05, 0); e.rotation.z = -s * 0.2; g.add(e);
      box(0.3, 0.34, 0.12, '#ff9a3c', 0, 0.17, 0, e); box(0.16, 0.2, 0.04, '#ffc2d4', 0, 0.15, 0.07, e);
    }
    box(0.96, 0.08, 0.2, '#ff9a3c', 0, 0, 0, g);
  } else if (id === 'mahkota') {
    box(0.98, 0.26, 0.98, '#ffd23a', 0, 0.1, 0, g); box(0.8, 0.27, 0.8, '#3b2a20', 0, 0.12, 0, g);
    for (const [x, z] of [[-0.4, 0.4], [0, 0.4], [0.4, 0.4], [-0.4, -0.4], [0.4, -0.4], [-0.4, 0], [0.4, 0]]) box(0.16, 0.22, 0.16, '#ffd23a', x, 0.33, z, g);
    box(0.16, 0.16, 0.06, '#e8434b', 0, 0.12, 0.5, g);
  } else if (id === 'kerucut') {
    [['#ff8fc0', 0.7], ['#ffd23a', 0.56], ['#7cc8f5', 0.42], ['#ff8fc0', 0.28], ['#ffd23a', 0.14]].forEach(([c, s], i) => box(s, 0.16, s, c, 0, 0.08 + i * 0.16, 0, g));
    box(0.2, 0.2, 0.2, '#ffffff', 0, 0.9, 0, g);
  } else if (id === 'nelayan') {
    box(1.3, 0.08, 1.3, '#3a8fa8', 0, 0.02, 0, g); box(0.96, 0.32, 0.96, '#4fb0c6', 0, 0.2, 0, g); box(0.98, 0.08, 0.98, '#ffd23a', 0, 0.12, 0, g);
  } else if (id === 'headphone') {
    box(1.02, 0.12, 0.2, '#2c2f3a', 0, 0.02, 0, g);
    for (const s of [-1, 1]) { box(0.12, 0.5, 0.2, '#2c2f3a', s * 0.52, -0.22, 0, g); box(0.2, 0.42, 0.42, '#e8434b', s * 0.56, -0.56, 0, g); }
  } else if (id === 'penyihir') {
    box(1.4, 0.08, 1.4, '#5b3fa0', 0, 0.02, 0, g);
    [0.8, 0.62, 0.46, 0.3, 0.18].forEach((s, i) => box(s, 0.24, s, '#6c4bc0', i * 0.04, 0.18 + i * 0.24, -i * 0.03, g));
    box(0.82, 0.1, 0.82, '#ffd23a', 0, 0.12, 0, g);
  } else if (id === 'tinggi') {
    box(1.3, 0.08, 1.3, '#2c2f3a', 0, 0.02, 0, g); box(0.86, 0.9, 0.86, '#2c2f3a', 0, 0.5, 0, g); box(0.88, 0.14, 0.88, '#e8434b', 0, 0.16, 0, g);
  } else if (id === 'pensil') {
    box(0.5, 0.9, 0.5, '#ffd23a', 0, 0.45, 0, g); box(0.52, 0.2, 0.52, '#ff8fc0', 0, 0.02, 0, g); box(0.34, 0.3, 0.34, '#f2d1a0', 0, 1.05, 0, g); box(0.14, 0.18, 0.14, '#2c2f3a', 0, 1.28, 0, g);
  } else if (id === 'wisuda') {
    box(0.9, 0.3, 0.9, '#2c2f3a', 0, 0.12, 0, g); box(1.4, 0.08, 1.4, '#2c2f3a', 0, 0.3, 0, g); box(0.1, 0.1, 0.1, '#ffd23a', 0, 0.36, 0, g); box(0.06, 0.5, 0.06, '#ffd23a', 0.6, 0.08, 0.6, g);
  } else if (id === 'baret') {
    box(1.0, 0.2, 1.0, '#e8434b', 0.08, 0.06, 0, g); box(0.86, 0.14, 0.86, '#e8434b', 0.14, 0.2, 0, g); box(0.1, 0.12, 0.1, '#e8434b', 0.14, 0.32, 0, g);
  } else if (id === 'baling') {
    ['#e8434b', '#ffd23a', '#3a7cf5', '#3fb25a'].forEach((c, i) => box(0.48, 0.3, 0.48, c, (i % 2 ? 0.24 : -0.24), 0.14, (i < 2 ? 0.24 : -0.24), g));
    box(0.1, 0.25, 0.1, '#2c2f3a', 0, 0.42, 0, g); const prop = new THREE.Group(); prop.position.y = 0.56; g.add(prop);
    box(1.1, 0.04, 0.16, '#e8434b', 0, 0, 0, prop); box(0.16, 0.04, 1.1, '#3a7cf5', 0, 0, 0, prop);
    animated.push({ obj: prop, fn: (t) => (prop.rotation.y = t * 8) });
  } else if (id === 'abc') {
    [['#e8434b', -0.32], ['#ffd23a', 0], ['#3a7cf5', 0.32]].forEach(([c, x], i) => box(0.3, 0.3, 0.3, c, x, 0.16 + (i === 1 ? 0.12 : 0), 0, g));
    box(0.96, 0.08, 0.96, '#ffffff', 0, 0.02, 0, g);
  } else if (id === 'angka123') {
    box(0.96, 0.1, 0.96, '#3fb25a', 0, 0.03, 0, g); [0, 1, 2].forEach((i) => box(0.24, 0.24 + i * 0.12, 0.24, ['#ff8a2a', '#9a62e0', '#2ec4f0'][i], -0.3 + i * 0.3, 0.18 + i * 0.06, 0, g));
  } else if (id === 'peci') {
    box(0.98, 0.34, 0.98, '#1d1d1d', 0, 0.12, 0, g); box(0.86, 0.06, 0.86, '#2c2c2c', 0, 0.3, 0, g);
  } else if (id === 'pesulap') {
    box(1.4, 0.08, 1.4, '#1d2b53', 0, 0.02, 0, g); box(0.8, 0.9, 0.8, '#1d2b53', 0, 0.5, 0, g); box(0.82, 0.14, 0.82, '#ffd23a', 0, 0.16, 0, g);
    [[0.2, 0.7], [-0.25, 0.45]].forEach(([x, y]) => box(0.12, 0.12, 0.06, '#ffd23a', x, y, 0.42, g, false));
  } else if (id === 'bajak') {
    box(1.2, 0.36, 0.7, '#2c2f3a', 0, 0.16, 0, g); box(1.5, 0.12, 0.4, '#2c2f3a', 0, 0.38, 0, g); box(0.34, 0.3, 0.06, '#ffffff', 0, 0.2, 0.36, g, false);
  } else if (id === 'astronot') {
    box(1.12, 1.1, 1.12, '#f4f4f4', 0, -0.48, -0.02, g); box(0.86, 0.5, 0.06, '#7cc8f5', 0, -0.5, 0.56, g, false); box(0.2, 0.3, 0.2, '#e8434b', 0, 0.2, 0, g);
  } else if (id === 'pelangi2') {
    ['#e8434b', '#ff8a2a', '#ffd23a', '#3fb25a', '#3a7cf5', '#9a62e0'].forEach((c, i) => box(1.0 - i * 0.02, 0.07, 1.0 - i * 0.02, c, 0, 0.04 + i * 0.07, 0, g));
    for (const [x, z] of [[-0.4, 0.4], [0, 0.4], [0.4, 0.4], [-0.4, -0.4], [0.4, -0.4], [-0.4, 0], [0.4, 0]]) box(0.14, 0.26, 0.14, '#ffd23a', x, 0.55, z, g);
    const gem = new THREE.Mesh(CRYSTAL_GEO, new THREE.MeshLambertMaterial({ color: '#ff7ac8', emissive: '#ff7ac8', emissiveIntensity: 0.4 })); gem.scale.setScalar(0.5); gem.position.set(0, 0.5, 0.5); g.add(gem);
  } else if (id === 'pendaki') {
    box(1.02, 0.34, 1.02, '#ffc93c', 0, 0.12, 0, g); box(0.78, 0.18, 0.78, '#ffc93c', 0, 0.36, 0, g); box(1.24, 0.06, 1.3, '#e6a91f', 0, -0.03, 0.06, g);
    box(0.12, 0.08, 1.04, '#e6a91f', 0, 0.46, 0, g); box(0.3, 0.22, 0.1, '#ffffff', 0, 0.12, 0.55, g, false); box(0.2, 0.14, 0.04, '#fff3a0', 0, 0.12, 0.61, g, false);
  } else if (id === 'bunga') {
    box(0.96, 0.08, 0.14, '#3fb25a', 0, 0.02, 0.2, g);
    [-0.36, 0, 0.36].forEach((x, i) => { const c = ['#ff8fc0', '#ffd23a', '#ffffff'][i]; box(0.26, 0.26, 0.1, c, x, 0.14, 0.32, g); box(0.1, 0.1, 0.06, '#ff8a2a', x, 0.14, 0.38, g, false); });
  }
  return g;
}

/* =========================================================
   PEMAIN
   ========================================================= */
const player = {
  ch: null, pos: new THREE.Vector3(0, 0, 7), target: null, vy: 0, y: 0, facing: Math.PI, phase: 0,
  speed: 6, onArrive: null, stuck: 0,
  // fisika pijakan (world.js): berdiri di atas balok, jatuh, didorong rintangan
  onGround: true, standOn: null, peak: 0, coyote: 0, jumpBuf: 0, knock: null, jumpHeld: false,
};
function applyAvatarTo(ch, a = {}) {
  ch.m.shirt.color.set(COLORS[a.shirt] || COLORS.biru); ch.m.pants.color.set(COLORS[a.pants] || COLORS.hitam);
  // orang dewasa sedikit lebih tinggi; kakek & nenek berambut abu-abu
  ch.root.scale.setScalar(ROLES_ADULT.has(a.role) ? 1.22 : 1);
  ch.m.hair.color.set(a.role === 'kakek' || a.role === 'nenek' ? '#c9c9c9' : '#3b2a20');
  ch.skinColor = SKINS[a.skin ?? 1] || SKINS[1]; ch.setGirl(a.gender === 'P'); ch.setSkin(ch.skinColor);
  ch.hatSlot.clear();
  if (a.hat && a.hat !== 'none' && HATS[a.hat]) ch.hatSlot.add(makeHat(a.hat));
}
function applyAvatar() { applyAvatarTo(player.ch, save.avatar); updateHand(); }
const marker = new THREE.Mesh(new THREE.RingGeometry(0.35, 0.55, 24), new THREE.MeshBasicMaterial({ color: '#ffffff', transparent: true, opacity: 0.9 }));
marker.rotation.x = -Math.PI / 2; marker.visible = false;
function walkTo(x, z, onArrive = null) {
  const d = Math.hypot(x, z); const lim = edgeR(x, z) - 2.4;
  if (d > lim) { x *= lim / d; z *= lim / d; }
  player.target = new THREE.Vector3(x, 0, z); player.onArrive = onArrive; player.stuck = 0;
  marker.position.set(x, player.y + 0.05, z); marker.visible = true; marker.scale.setScalar(1); marker.material.opacity = 0.9;
}
// lompat: boleh sesaat setelah meninggalkan pijakan, dan tombol yang ditekan sedikit terlalu cepat tetap dihitung
function jump() { if (para.phase === 1) { openChute(); return; } if (veh.kind === 'jetski' || veh.kind === 'plane' || ride) return; player.jumpBuf = 0.2; tryJump(); }
function tryJump() {
  if (player.jumpBuf <= 0 || player.vy > 0 || !(player.onGround || player.coyote > 0)) return;
  player.vy = 8; player.onGround = false; player.coyote = 0; player.jumpBuf = 0; SFX.jump();
}
// pindah cepat lewat peta
function teleport(x, z, y = 0) {
  SFX.warp(); burst(player.pos.clone().add(new THREE.Vector3(0, 1.5 + player.y, 0)), ['#ffffff', '#7cc8f5', '#ffd23a']);
  player.pos.set(x, 0, z); player.target = null; marker.visible = false; player.knock = null;
  player.y = y; player.vy = 0; player.peak = y; player.onGround = false; para.phase = 0;
  if (veh.kind && !veh.ending) endRide('map');
  if (ride && !veh.ending) leaveRide(true, true);
  burst(new THREE.Vector3(x, 1.5 + y, z), ['#ffffff', '#7cc8f5', '#ffd23a']);
}

/* ---------- kamera orang ketiga (seperti Minecraft) + joystick ---------- */
// camYaw: arah kamera mengelilingi pemain. 0 = kamera di belakang (+z), memandang ke -z.
// mode kamera seperti game pada umumnya: dari mata (tangan saja) sampai dari langit
const CAM_MODES = {
  mata: { name: 'Mata (tangan saja)', dist: 0, pitch: 0, fp: true },
  dekat: { name: 'Dekat', dist: 6, pitch: 0.32 },
  sedang: { name: 'Seluruh badan', dist: 10.5, pitch: 0.42 },
  jauh: { name: 'Jauh', dist: 17, pitch: 0.55 },
  atas: { name: 'Dari atas', dist: 27, pitch: 1.08 },
};
const CAM_ORDER = ['sedang', 'jauh', 'atas', 'mata', 'dekat'];
const view = { yaw: 0, pitch: 0.42, dist: 10.5, dragging: false, mode: 'sedang', fpPitch: 0 };
function setCamMode(mode, announce = false) {
  const m = CAM_MODES[mode] || CAM_MODES.sedang; view.mode = CAM_MODES[mode] ? mode : 'sedang';
  view.dist = m.dist; if (!m.fp) view.pitch = m.pitch; view.fpPitch = 0; view.cur = 0;
  if (announce) toast(`Kamera: ${m.name}`);
}
// tangan orang pertama (seperti Minecraft), menempel di kamera
const hand = new THREE.Group(); camera.add(hand); hand.visible = false;
const handSleeve = new THREE.MeshLambertMaterial({ color: '#3a7cf5' }), handSkin = new THREE.MeshLambertMaterial({ color: '#e3ac83' });
{ const sl = new THREE.Mesh(BOX, handSleeve); sl.scale.set(0.16, 0.16, 0.34); sl.position.set(0, 0, 0.12); hand.add(sl);
  const sk = new THREE.Mesh(BOX, handSkin); sk.scale.set(0.14, 0.14, 0.3); sk.position.set(0, 0, -0.18); hand.add(sk); }
hand.position.set(0.32, -0.3, -0.55); hand.rotation.set(0.25, -0.25, 0.1);
function updateHand() { const a = save.avatar; handSleeve.color.set(COLORS[a.shirt] || COLORS.biru); handSkin.color.set(SKINS[a.skin ?? 1]); }
const stick = { x: 0, y: 0, active: false };

/* =========================================================
   NPC: KAK RARA
   ========================================================= */
const RARA_TIPS = [
  'Sentuh dan geser di layar kiri untuk berjalan. Geser layar kanan untuk melihat sekeliling!',
  'Kalau sudah dekat tempat bermain, ketuk tombol Masuk di kanan.',
  'Mau cepat? Ketuk tombol peta, lalu pilih tempat bermain.',
  'Kumpulkan poin di tempat yang kamu suka. Siapa yang poinnya paling banyak, jadi juara di papan JUARA!',
  'Di Kebun Hitung kita memetik buah sambil berhitung.',
  'Di Rumah Warna, balok-balok ingin pulang ke rumah yang warnanya sama.',
  'Di Kandang Hewan ada ayam, bebek, kucing, sapi, dan domba!',
  'Di Menara Pola kita menebak balok selanjutnya.',
  'Di Taman Bentuk ada lingkaran, segitiga, bintang, dan hati.',
  'Di Kolam Ikan kita membandingkan, mana yang lebih banyak.',
  'Di Panggung Musik, dengarkan nadanya, lalu tirukan!',
  'Kartu Kembar melatih ingatan. Cari gambar yang sama!',
  'Di Tangga Ukuran kita menyusun dari yang pendek ke yang tinggi.',
  'Di Rumah Perasaan kita belajar tentang senang, sedih, dan marah.',
  'Di Rumah Huruf, Pondok Angka, dan Surau Iqro, kamu menjawab dengan suaramu!',
  'Coba jalan ke mercusuar di tepi pantai. Lampunya berputar, lho!',
  'Kamu bisa ganti baju dengan tombol baju di atas.',
];

/* =========================================================
   RAYCAST / KETUKAN
   ========================================================= */
const tapRoots = [];
const raycaster = new THREE.Raycaster();
const ndc = new THREE.Vector2();
const groundPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
function findTap(obj) { while (obj) { if (obj.userData && obj.userData.tap) return obj; obj = obj.parent; } return null; }
function onTap(cx, cy) {
  if (!playing || paused()) return;
  ac(); activeZone?.touch();
  ndc.set((cx / window.innerWidth) * 2 - 1, -(cy / window.innerHeight) * 2 + 1);
  raycaster.setFromCamera(ndc, camera);
  const hits = raycaster.intersectObjects(tapRoots, true);
  for (const h of hits) {
    const t = findTap(h.object);
    if (t && (t.visible !== false)) { t.userData.tap(t); return; }
  }
  const p = new THREE.Vector3();
  groundPlane.constant = -player.y; // di atas bangunan/menara: ketuk = jalan di ketinggian yang sama
  if (!raycaster.ray.intersectPlane(groundPlane, p)) return;
  if (activeZone) {
    if (Math.hypot(p.x - activeZone.cx, p.z - activeZone.cz) < 8.2) return; // tetap di permainan
    leaveZone();
  }
  walkTo(p.x, p.z);
}
// ketuk = pilih/jalan; geser = putar kamera (hanya saat menjelajah, bukan saat bermain di zona)
let down = null;
canvas.addEventListener('pointerdown', (e) => {
  if (down) return; // satu jari untuk kamera; jari lain dipakai joystick
  down = { id: e.pointerId, x: e.clientX, y: e.clientY, lx: e.clientX, ly: e.clientY, t: performance.now(), moved: 0 };
  try { canvas.setPointerCapture(e.pointerId); } catch (er) { /* abaikan */ }
});
canvas.addEventListener('pointermove', (e) => {
  if (!down || e.pointerId !== down.id) return;
  const dx = e.clientX - down.lx, dy = e.clientY - down.ly; down.lx = e.clientX; down.ly = e.clientY;
  down.moved = Math.max(down.moved, Math.hypot(e.clientX - down.x, e.clientY - down.y));
  if (down.moved < 12 || !playing || paused() || activeZone || camMode !== 'follow') return;
  view.dragging = true;
  const k = 5 / Math.max(window.innerWidth, 500);
  view.yaw -= dx * k;
  if (CAM_MODES[view.mode].fp) view.fpPitch = clamp(view.fpPitch - dy * k * 0.7, -0.9, 1.35);
  else view.pitch = clamp(view.pitch + dy * k * 0.7, -1.1, 1.25);
});
const endDrag = (e) => {
  if (!down || e.pointerId !== down.id) return;
  if (down.moved < 18 && performance.now() - down.t < 900 && e.type === 'pointerup') onTap(e.clientX, e.clientY);
  down = null; view.dragging = false;
};
canvas.addEventListener('pointerup', endDrag);
canvas.addEventListener('pointercancel', endDrag);
canvas.addEventListener('wheel', (e) => { if (camMode === 'follow' && !CAM_MODES[view.mode].fp) view.dist = clamp(view.dist + e.deltaY * 0.02, 4, 34); }, { passive: true });
// cubit dua jari untuk zoom
const pinch = new Map(); let pinchD = 0;
canvas.addEventListener('pointerdown', (e) => { pinch.set(e.pointerId, [e.clientX, e.clientY]); if (pinch.size === 2) { const [a, b] = [...pinch.values()]; pinchD = Math.hypot(a[0] - b[0], a[1] - b[1]); } });
canvas.addEventListener('pointermove', (e) => {
  if (!pinch.has(e.pointerId)) return; pinch.set(e.pointerId, [e.clientX, e.clientY]);
  if (pinch.size === 2 && !CAM_MODES[view.mode].fp) { const [a, b] = [...pinch.values()]; const d = Math.hypot(a[0] - b[0], a[1] - b[1]); if (pinchD) view.dist = clamp(view.dist * (pinchD / d), 4, 34); pinchD = d; }
});
const pinchEnd = (e) => { pinch.delete(e.pointerId); pinchD = 0; };
canvas.addEventListener('pointerup', pinchEnd); canvas.addEventListener('pointercancel', pinchEnd);

// joystick virtual (seperti game mobile): jari di lingkaran kiri bawah
const joy = $('#joy'), knob = $('#joyKnob');
let joyId = null;
function joyMove(e) {
  const r = joy.getBoundingClientRect(); const max = r.width * 0.36;
  let dx = e.clientX - (r.left + r.width / 2), dy = e.clientY - (r.top + r.height / 2);
  const l = Math.hypot(dx, dy); if (l > max) { dx *= max / l; dy *= max / l; }
  knob.style.transform = `translate(${dx}px,${dy}px)`;
  stick.x = dx / max; stick.y = dy / max;
  const mag = Math.hypot(stick.x, stick.y); stick.active = mag > 0.18;
}
function joyEnd() { joyId = null; stick.x = stick.y = 0; stick.active = false; knob.style.transform = ''; joy.classList.remove('on'); }
joy.addEventListener('pointerdown', (e) => {
  e.preventDefault(); ac(); joyId = e.pointerId; joy.classList.add('on');
  try { joy.setPointerCapture(e.pointerId); } catch (er) { /* abaikan */ }
  joyMove(e);
});
joy.addEventListener('pointermove', (e) => { if (e.pointerId === joyId) joyMove(e); });
joy.addEventListener('pointerup', (e) => { if (e.pointerId === joyId) joyEnd(); });
joy.addEventListener('pointercancel', joyEnd);
// joystick mengambang (seperti PUBG): sentuh di mana saja di setengah kiri layar
const joyZone = $('#joyZone'); let zoneTap = null;
function joyHome() { joy.classList.remove('floating'); joy.style.left = joy.style.top = ''; }
joyZone.addEventListener('pointerdown', (e) => {
  if (!playing || paused() || joy.hidden) return;
  e.preventDefault(); ac(); joyId = e.pointerId; zoneTap = { x: e.clientX, y: e.clientY, t: performance.now() };
  joy.classList.add('floating', 'on'); joy.style.left = `${e.clientX}px`; joy.style.top = `${e.clientY}px`;
  try { joyZone.setPointerCapture(e.pointerId); } catch (er) { /* abaikan */ }
  joyMove(e);
});
joyZone.addEventListener('pointermove', (e) => { if (e.pointerId === joyId) joyMove(e); });
const zoneUp = (e) => {
  if (e.pointerId !== joyId) return;
  // ketukan singkat tanpa geser = ketuk dunia (misalnya ikon tempat bermain)
  if (zoneTap && e.type === 'pointerup' && performance.now() - zoneTap.t < 260 && Math.hypot(e.clientX - zoneTap.x, e.clientY - zoneTap.y) < 12) onTap(e.clientX, e.clientY);
  zoneTap = null; joyEnd(); joyHome();
};
joyZone.addEventListener('pointerup', zoneUp); joyZone.addEventListener('pointercancel', zoneUp);
// joystick kanan: putar pandangan. Makin jauh digeser, makin cepat kamera berputar (seperti game HP)
const lookPad = $('#look'), lookKnob = $('#lookKnob'), lookZone = $('#lookZone');
const look = { id: null, x: 0, y: 0, tap: null };
function lookMove(e) {
  const r = lookPad.getBoundingClientRect(), max = r.width * 0.36;
  let dx = e.clientX - (r.left + r.width / 2), dy = e.clientY - (r.top + r.height / 2);
  const l = Math.hypot(dx, dy); if (l > max) { dx *= max / l; dy *= max / l; }
  lookKnob.style.transform = `translate(${dx}px,${dy}px)`; look.x = dx / max; look.y = dy / max;
}
function lookStart(e, el, floating) {
  if (!playing || paused() || joy.hidden || activeZone || look.id !== null) return;
  e.preventDefault(); ac(); look.id = e.pointerId; look.tap = floating ? { x: e.clientX, y: e.clientY, t: performance.now() } : null;
  lookPad.classList.add('on');
  if (floating) { lookPad.classList.add('floating'); lookPad.style.left = `${e.clientX}px`; lookPad.style.top = `${e.clientY}px`; }
  try { el.setPointerCapture(e.pointerId); } catch (er) { /* abaikan */ }
  lookMove(e);
}
// sentuh bulatan 👁️ di pojok kanan bawah, atau di mana saja di setengah kanan layar
lookPad.addEventListener('pointerdown', (e) => lookStart(e, lookPad, false));
lookZone.addEventListener('pointerdown', (e) => lookStart(e, lookZone, true));
for (const el of [lookPad, lookZone]) el.addEventListener('pointermove', (e) => { if (e.pointerId === look.id) lookMove(e); });
const lookUp = (e) => {
  if (e.pointerId !== look.id) return;
  if (look.tap && e.type === 'pointerup' && performance.now() - look.tap.t < 260 && Math.hypot(e.clientX - look.tap.x, e.clientY - look.tap.y) < 12) onTap(e.clientX, e.clientY);
  look.id = null; look.tap = null; look.x = look.y = 0; lookKnob.style.transform = '';
  lookPad.classList.remove('floating', 'on'); lookPad.style.left = lookPad.style.top = '';
};
for (const el of [lookPad, lookZone]) { el.addEventListener('pointerup', lookUp); el.addEventListener('pointercancel', lookUp); }
function lookTick(dt) {
  const hide = joy.hidden || !playing; if (lookPad.hidden !== hide) { lookPad.hidden = hide; lookZone.hidden = hide; }
  if (look.id === null || camMode !== 'follow' || activeZone || paused()) return;
  const ax = Math.abs(look.x) > 0.12 ? look.x : 0, ay = Math.abs(look.y) > 0.12 ? look.y : 0;
  view.yaw -= ax * Math.abs(ax) * 2.8 * dt; // halus di dekat tengah, cepat di pinggir
  if (CAM_MODES[view.mode].fp) view.fpPitch = clamp(view.fpPitch - ay * 1.4 * dt, -0.9, 1.35);
  else view.pitch = clamp(view.pitch + ay * 1.1 * dt, -1.1, 1.25);
}

const keys = new Set();
window.addEventListener('keydown', (e) => {
  if (e.target.tagName === 'SELECT') return;
  keys.add(e.key.toLowerCase());
  if (e.key === ' ' && playing && !paused()) { e.preventDefault(); player.jumpHeld = true; jump(); }
  if ((e.key === 'Enter' || e.key === 'f' || e.key === 'F') && nearZone && !activeZone) enterNear();
  if ((e.key === 'j' || e.key === 'J') && playing) punch();
  if ((e.key === 'k' || e.key === 'K') && playing) shoot();
});
window.addEventListener('blur', () => { keys.clear(); joyEnd(); });
window.addEventListener('keyup', (e) => { keys.delete(e.key.toLowerCase()); if (e.key === ' ') player.jumpHeld = false; });

/* =========================================================
   ZONA (dasar)
   ========================================================= */
let activeZone = null;
const zones = {};
// tunggu Kak Rara selesai bicara (agar kalimat tidak terpotong)
async function afterSpeech(max = 6000) { const t0 = performance.now(); await wait(250); while (isSpeaking() && performance.now() - t0 < max) await wait(150); }
// acak ber-seed: di ronde bersama semua perangkat membuat soal yang persis sama
function mulberry32(a) { return () => { a |= 0; a = (a + 0x6d2b79f5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
// gaya ronde bersama: kuis = satu jawaban lalu dikunci; balapan = siapa selesai duluan; galeri = pamer gambar
const ZONE_KIND = { huruf: 'race', angka: 'race', iqro: 'race', kebun: 'quiz', hewan: 'quiz', pola: 'quiz', bentuk: 'quiz', ikan: 'quiz', rasa: 'quiz', mtk: 'quiz', warna: 'race', musik: 'race', kembar: 'race', ukuran: 'race', tulis: 'race', puzzle: 'race', gambar: 'gallery' };
const STAND = [[0, 0], [-1.4, 1.1], [1.3, 1.5], [-2.6, 0.2], [0.1, 2.7], [-1.5, 2.6]];
const tops = {}; // skor Top 3 per lokasi (dari server)
class Zone {
  constructor(id, name, color, hat) {
    this.id = id; this.name = name; this.color = color; this.hat = hat; this.kind = ZONE_KIND[id] || 'quiz';
    [this.cx, this.cz] = ZONES_POS[id];
    this.group = new THREE.Group(); this.group.position.set(this.cx, 0, this.cz); scene.add(this.group);
    this.temp = new THREE.Group(); this.group.add(this.temp);
    tapRoots.push(this.group);
    this.token = 0; this.active = false; this.streak = 0; this.missStreak = 0; this.visitRounds = 0;
    this.members = []; this.shared = false; this.sharedRound = null; this.pending = null;
    this.ringMat = new THREE.MeshLambertMaterial({ color, emissive: '#000000' });
    const ring = new THREE.Mesh(new THREE.RingGeometry(6.6, 7.1, 48), this.ringMat);
    ring.rotation.x = -Math.PI / 2; ring.position.y = 0.03; ring.receiveShadow = true; this.group.add(ring);
    // zona aman malam: cincin cahaya hijau berdenyut + sorot cahaya
    this.safeGlow = new THREE.Mesh(new THREE.RingGeometry(6.3, 7.6, 48), new THREE.MeshBasicMaterial({ color: '#3dff7a', transparent: true, opacity: 0.7, depthWrite: false, blending: THREE.AdditiveBlending }));
    this.safeGlow.rotation.x = -Math.PI / 2; this.safeGlow.position.y = 0.06; this.safeGlow.visible = false; this.group.add(this.safeGlow);
    this.safeBeam = new THREE.Mesh(new THREE.CylinderGeometry(6.8, 6.8, 9, 32, 1, true), new THREE.MeshBasicMaterial({ color: '#3dff7a', transparent: true, opacity: 0.12, depthWrite: false, side: THREE.DoubleSide, blending: THREE.AdditiveBlending }));
    this.safeBeam.position.y = 4.5; this.safeBeam.visible = false; this.group.add(this.safeBeam);
    const pad = new THREE.Mesh(new THREE.CircleGeometry(6.6, 48), new THREE.MeshLambertMaterial({ color: '#7ccd6a' }));
    pad.rotation.x = -Math.PI / 2; pad.position.y = 0.02; pad.receiveShadow = true; this.group.add(pad);
    this.buildSign(); this.buildTop();
    this.build();
  }
  get prog() { return save.zones[this.id]; }
  // tingkat dari menu orang tua (0 = otomatis menyesuaikan kemampuan anak)
  myLevel() { const L = save.settings.level || 0; return L ? clamp(L, 1, this.maxLevel) : this.prog.level; }
  get level() { return this.sharedRound ? clamp(this.sharedLevel, 1, this.maxLevel) : this.myLevel(); }
  buildSign() {
    const g = new THREE.Group(); g.position.set(-5.6, 0, 3.4); g.rotation.y = 0.5; this.group.add(g);
    box(0.18, 1.9, 0.18, '#8a5a35', -0.8, 0.95, 0, g); box(0.18, 1.9, 0.18, '#8a5a35', 0.8, 0.95, 0, g);
    const tex = canvasTex(512, 160, (c) => {
      c.fillStyle = '#fff6df'; rrect(c, 0, 0, 512, 160, 30); c.fill();
      c.fillStyle = this.color; rrect(c, 16, 16, 480, 128, 22); c.fill();
      c.fillStyle = '#1d2b53'; c.font = `800 ${this.name.length > 13 ? 62 : 74}px ${FONT}`; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText(this.name, 256, 88);
    });
    const face = new THREE.MeshLambertMaterial({ map: tex }); const wood = mat('#c98f52');
    const b = new THREE.Mesh(BOX, [wood, wood, wood, wood, face, wood]); b.scale.set(2.3, 0.72, 0.12); b.position.y = 1.65; b.castShadow = true; g.add(b);
  }
  // papan juara: Top 3 lokasi ini
  buildTop() {
    const g = new THREE.Group(); g.position.set(5.7, 0, 3.2); g.rotation.y = -0.5; this.group.add(g);
    box(0.18, 1.6, 0.18, '#8a5a35', -0.9, 0.8, 0, g); box(0.18, 1.6, 0.18, '#8a5a35', 0.9, 0.8, 0, g);
    this.topTex = canvasTex(400, 350, () => {});
    const face = new THREE.MeshLambertMaterial({ map: this.topTex }); const gold = mat('#e0a400');
    const b = new THREE.Mesh(BOX, [gold, gold, gold, gold, face, gold]); b.scale.set(2.2, 1.92, 0.12); b.position.y = 2.35; b.castShadow = true; g.add(b);
    this.drawTop();
  }
  drawTop(status = this.status || '') {
    this.status = status;
    const { g } = this.topTex.userData; const list = tops[this.id] || [];
    g.fillStyle = '#fff6df'; g.fillRect(0, 0, 400, 350);
    // status zona aman (malam) dengan hitung mundur
    if (status) { const safe = status.startsWith('🛡'); g.fillStyle = safe ? '#3fd16a' : '#e8434b'; g.fillRect(0, 296, 400, 54); g.fillStyle = '#ffffff'; g.font = `800 34px ${FONT}`; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(status, 200, 324); } g.fillStyle = '#ffc93c'; g.fillRect(0, 0, 400, 70);
    g.fillStyle = '#1d2b53'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.font = `800 46px ${FONT}`; g.fillText('🏆 JUARA', 200, 38);
    const medal = ['🥇', '🥈', '🥉'];
    for (let i = 0; i < 3; i++) {
      const y = 112 + i * 64; const e = list[i];
      g.textAlign = 'left'; g.font = `44px ${EMOJI_FONT}`; g.fillText(medal[i], 18, y);
      g.font = `800 40px ${FONT}`; g.fillStyle = e ? '#1d2b53' : '#b9c3d8';
      const nm = e ? (e.name.length > 9 ? e.name.slice(0, 9) + '…' : e.name) : '—'; g.fillText(nm, 80, y);
      if (e) { g.textAlign = 'right'; g.fillStyle = '#e0a400'; g.fillText(`${e.points}`, 382, y); }
      g.fillStyle = '#1d2b53';
    }
    this.topTex.needsUpdate = true;
  }
  // ikon melayang yang bisa diketuk dari jauh
  makeIcon(builder) {
    const g = new THREE.Group(); g.position.set(this.cx, 6.2, this.cz); builder(g);
    hitBox(2.4, 2.4, 2.4, 0, 0, 0, g);
    g.userData.tap = () => { if (activeZone) return; SFX.tap(); const [x, z] = this.approach(); walkTo(x, z); say(`Ayo ke ${this.name}! Nanti ketuk tombol Masuk, ya.`); };
    scene.add(g); tapRoots.push(g); this.icon = g;
  }
  // titik di tepi zona, di sisi yang menghadap tengah pulau
  approach(dist = 5.4) { const d = Math.hypot(this.cx, this.cz) || 1; return [this.cx - (this.cx / d) * dist, this.cz - (this.cz / d) * dist + 0.01]; }
  standSpot(id = net.id) { const i = Math.max(0, this.members.indexOf(id)); const [ox, oz] = STAND[i % STAND.length]; return [this.cx - 4.9 + ox, this.cz + 1.9 + oz]; }
  enter() {
    activeZone = this; this.active = true; this.token++; this.visitRounds = 0; this.arrived = false;
    $('#exitBtn').hidden = false; $('#joy').hidden = true; $('#joyZone').hidden = true; joyEnd();
    send({ t: 'zone', zone: this.id, level: this.myLevel(), kind: this.kind });
    const t = this.token; const [sx, sz] = this.standSpot();
    walkTo(sx, sz, () => {
      if (this.token !== t) return;
      this.arrived = true; player.facing = Math.atan2(4.9, -2.9); // menghadap ke tengah permainan
      this.begin();
    });
    this.icon.visible = false;
  }
  // tiba di tempat: ikut ronde dari server (sesi ruang ini), atau main sendiri bila tanpa server
  begin() {
    if (this.pending) { const m = this.pending; this.pending = null; this.playRound(m); }
    else if (!net.online || !net.id || this.roomState === 'lobby') this.showLobby();
    else { this.waitTurn(); send({ t: 'next', zone: this.id }); }
  }
  // lobi: pemain pertama (tuan rumah) memilih tingkat lalu menekan Mulai; boleh menunggu teman dulu
  get isHost() { return !net.online || !net.id || this.host === net.id; }
  showLobby() {
    this.token++; this.clearTemp(); hideAction(); this.round = { errors: 0, solved: true }; this.inLobby = true;
    renderLobby(this);
    if (!this.lobbyGreeted) {
      this.lobbyGreeted = true;
      say(this.isHost ? `Kamu yang pertama di ${this.name}! Ketuk Mulai kalau sudah siap. Mau menunggu teman dulu juga boleh.`
        : `Kita tunggu ${remotes.get(this.host)?.name || 'teman'} memulai, ya.`, { stay: true, force: true });
    }
  }
  startFromLobby() {
    const lv = this.myLevel();
    this.inLobby = false; renderLobby(null); SFX.good();
    if (net.online && net.id) { send({ t: 'start', zone: this.id, level: lv }); this.waitTurn(); }
    else this.newRound();
  }
  onRoom(m) {
    this.members = m.members; this.host = m.host; this.roomState = m.state;
    if (!this.active || !this.arrived) return;
    if (m.state === 'lobby') { if (this.inLobby) renderLobby(this); else if (!this.pending) { this.lobbyGreeted = false; this.showLobby(); } }
    renderRoundBar();
  }
  waitTurn() {
    this.token++; this.clearTemp(); hideAction(); this.round = { errors: 0, solved: true };
    say('Sebentar, ya. Ronde berikutnya segera dimulai!', { stay: true, force: true });
  }
  exit() {
    this.active = false; this.token++; this.clearTemp(); hideAction(); this.onExit?.();
    this.sharedRound = null; this.pending = null; this.hush = false; this.arrived = false; closeResults();
    this.inLobby = false; this.lobbyGreeted = false; this.roomState = null; renderLobby(null);
    send({ t: 'zone', zone: null });
    if (activeZone === this) activeZone = null;
    renderRoundBar();
    $('#exitBtn').hidden = true; $('#joy').hidden = false; $('#joyZone').hidden = false; this.icon.visible = true;
    $('#bubble').hidden = true; if (hasTTS) speechSynthesis.cancel();
  }
  clearTemp() { this.temp.clear(); }
  alive(t) { return this.active && t === this.token; }
  recentList() { return save.recent?.[this.id] || []; }
  remember(k) {
    if (!k) return; save.recent ||= {}; const r = (save.recent[this.id] ||= []);
    const i = r.indexOf(k); if (i >= 0) r.splice(i, 1); r.push(k); if (r.length > 10) r.shift();
    send({ t: 'qkey', zone: this.id, key: k });
  }
  // buat ronde baru; ulangi bila soalnya baru saja keluar (supaya kembali ke sini soalnya beda)
  generate(rng, avoid) {
    const orig = Math.random; Math.random = rng; let said = [];
    try {
      for (let tries = 0; tries < 14; tries++) {
        this.token++; this.clearTemp(); hideAction();
        this.round = { errors: 0, solved: false, t0: performance.now() }; this.lastAct = performance.now(); this.hints = 0;
        this.qkey = null; sayBuffer = [];
        this.startRound(this.token);
        said = sayBuffer; sayBuffer = null;
        if (!this.qkey || !avoid.includes(this.qkey)) break;
      }
    } finally { Math.random = orig; sayBuffer = null; }
    for (const [tx, o] of said) say(tx, o);
    this.remember(this.qkey);
  }
  // ronde lokal (tanpa server)
  newRound() { this.sharedRound = null; this.hush = false; renderRoundBar(); this.generate(Math.random, [...this.recentList()]); }
  // ronde dari server: sama persis di semua perangkat di lokasi ini
  playRound(m) {
    closeResults(); this.hush = false; this.inLobby = false; renderLobby(null);
    for (const k of ['lastShape', 'lastTarget', 'lastEmo', 'lastScene']) this[k] = undefined;
    this.sharedLevel = m.level;
    this.sharedRound = { seq: m.seq, style: m.style, players: m.players, done: new Set(), sent: false };
    if (m.style === 'shared') {
      const others = m.players.filter((i) => i !== net.id).map((i) => remotes.get(i)?.name).filter(Boolean);
      if (others.length) toast(`Main bersama ${others.join(', ')}!`);
    }
    // gabungan soal yang baru keluar di lokasi ini (server) dan milik pemain ini, supaya tidak berulang
    this.generate(mulberry32(m.seed), m.style === 'shared' ? m.avoid || [] : [...new Set([...(m.avoid || []), ...this.recentList()])]);
    this.sharedRound.t0 = performance.now();
    renderRoundBar();
  }
  get together() { return this.sharedRound?.style === 'shared'; }
  // kembalikan true bila jawaban sudah dikunci (ronde kuis bersama), agar zona tidak memberi petunjuk
  // kuis bersama: benar/salah dirahasiakan sampai semua menjawab
  get secret() { return this.together && this.kind === 'quiz'; }
  error() {
    this.round.errors++;
    if (this.secret) { this.submit(false); return true; }
    SFX.soft();
    return !!this.round.locked;
  }
  submit(ok) {
    const r = this.sharedRound; if (!r || r.sent) return; r.sent = true;
    const msg = { t: 'answer', zone: this.id, seq: r.seq, ok, ms: Math.round(performance.now() - (r.t0 || 0)), errors: this.round.errors };
    if (this.kind === 'gallery' && this.lastImg) msg.img = this.lastImg;
    send(msg); r.done.add(net.id);
    if (!this.together) return;
    this.round.solved = true; this.round.locked = true; this.token++; hideAction(); this.hush = true;
    if (ok && this.kind !== 'quiz') celebrate('small');
    say(this.kind === 'quiz' ? 'Jawabanmu sudah dikirim! Kita tunggu teman-teman, ya.' : 'Selesai! Kita tunggu teman-teman, ya.', { stay: true, force: true });
    renderRoundBar();
  }
  // bantuan otomatis bila anak diam lama: jawaban yang benar melompat-lompat + petunjuk Kak Rara
  touch() { this.lastAct = performance.now(); }
  hintTargets() { return this.temp.children.filter((o) => o.userData?.correct && o.visible !== false); }
  hintText() { return null; }
  giveHint() {
    this.lastAct = performance.now(); if (this.noHint) return;
    this.hints = (this.hints || 0) + 1; this.round.hinted = true;
    const ts = this.hintTargets() || [];
    for (const o of ts) { hop(o, 0.7, 0.5); setTimeout(() => o.parent && hop(o, 0.5, 0.4), 600); const wp = new THREE.Vector3(); o.getWorldPosition(wp); wp.y += 1.2; burst(wp, ['#ffd23a', '#ffffff']); }
    const txt = this.hintText();
    say(txt || (ts.length ? pick(['Butuh bantuan? Lihat yang melompat-lompat itu!', 'Psst, Kak Rara kasih petunjuk: lihat yang melompat!', 'Coba perhatikan yang bergerak-gerak, ya!']) : 'Ayo, kamu pasti bisa! Coba saja dulu.'), { stay: true });
  }
  async success(line) {
    if (this.round.solved) return;
    if (this.together) { this.submit(true); return; }
    this.round.solved = true;
    const t = this.token; hideAction();
    const p = this.prog; p.rounds++; p.last = Date.now();
    if (this.round.errors === 0) { p.first++; this.streak++; this.missStreak = 0; } else { this.streak = 0; this.missStreak++; }
    let levelMsg = '';
    if (save.settings.level) { /* tingkat tetap dari orang tua */ }
    else if (this.streak >= 3 && p.level < this.maxLevel) { p.level++; this.streak = 0; levelMsg = ' Kamu siap tantangan baru!'; }
    else if (this.missStreak >= 2 && p.level > 1) { p.level--; this.missStreak = 0; }
    save.stars++;
    // combo: benar berturut-turut tanpa salah & tanpa bantuan; tiap kelipatan 3 dapat bonus bintang
    if (this.round.errors === 0 && !this.round.hinted) this.combo = (this.combo || 0) + 1; else this.combo = 0;
    let bonus = '';
    if (this.combo >= 2) { floatText(`🔥 ×${this.combo}`); tone(988, 0.12, { type: 'triangle', vol: 0.1, delay: 0.25 }); }
    if (this.combo > 0 && this.combo % 3 === 0) { save.stars++; bonus = ` Wah, ${this.combo} kali benar berturut-turut! Bonus satu bintang!`; }
    if (this.sharedRound) this.submit(true); // server mencatat skor
    else addLocalScore(this.id, this.round.errors === 0 ? 2 : 1);
    persist(); updateStars();
    SFX.good(); burst(new THREE.Vector3(this.cx, 2.2, this.cz - 1)); celebrate('big');
    const heart = learnHeart() ? ' Karena kamu sudah belajar, Kak Rara kasih satu nyawa. Sekarang kamu siap kalau malam tiba!' : '';
    say(`${line} ${pick(this.round.errors ? PRAISE_RETRY : PRAISE)}${bonus}${levelMsg}${heart}`, { stay: true });
    await wait(2200); await afterSpeech(6000); await wait(400);
    if (!this.alive(t)) return;
    this.visitRounds++;
    if (p.rounds >= 3 && !save.crystals.includes(this.id)) await unlockReward(this);
    else if (this.visitRounds % 5 === 0) await sessionDone(this);
    else if (this.visitRounds % 7 === 0) await showTogether(this.id);
    if (!this.alive(t)) return;
    if (this.together) return; // teman datang di tengah ronde: tunggu hasil bersama
    if (this.sharedRound && net.online) { this.waitTurn(); send({ t: 'next', zone: this.id }); } else this.newRound();
  }
  // teman datang di tengah ronde: ronde ini menjadi ronde bersama
  onStyle(m) { const r = this.sharedRound; if (!r || r.seq !== m.seq) return; r.style = 'shared'; r.players = m.players; r.t0 ||= performance.now(); renderRoundBar(); }
  async onReveal(m) {
    const r = this.sharedRound; if (!r || r.seq !== m.seq) return;
    tops[this.id] = m.top; this.drawTop();
    if (m.style !== 'shared') return; // main sendiri: pujian sudah diberikan langsung
    const me = m.results.find((x) => x.id === net.id); const p = this.prog;
    if (me) {
      p.rounds++; p.last = Date.now();
      if (me.ok) { if (!me.errors) p.first++; save.stars += me.pts; }
      persist(); updateStars();
    }
    showResults(this, m, me);
    const okNames = m.results.filter((x) => x.ok).map((x) => (x.id === net.id ? 'kamu' : x.name));
    let line;
    if (this.kind === 'gallery') line = 'Lihat gambar teman-teman! Semuanya keren sekali.';
    else if (this.kind === 'quiz') line = `Jawabannya ${this.answerText?.() || ''}. ${okNames.length ? `Yang benar: ${okNames.join(', ')}. Hebat!` : 'Belum ada yang benar. Ayo coba lagi!'}`;
    else { const f = m.results.find((x) => x.fastest); line = f ? `Juara ronde ini: ${f.id === net.id ? 'kamu' : f.name}! Semuanya hebat.` : 'Ronde selesai!'; }
    if (me?.ok) celebrate('big', me.fastest ? 'JUARA!' : null); else if (me) SFX.soft();
    if (me?.done && learnHeart()) line += ' Kamu juga dapat satu nyawa karena sudah belajar!';
    say(line, { stay: true, force: true });
    this.hush = true;
    if (p.rounds >= 3 && !save.crystals.includes(this.id)) { await wait(4500); if (this.active) { closeResults(); await unlockReward(this); } }
  }
}

/* =========================================================
   ZONA 1 — KEBUN HITUNG (berhitung & lambang bilangan)
   ========================================================= */
const FRUITS = [
  { name: 'jeruk', color: '#ff9a1f' }, { name: 'mangga', color: '#a8d63a' }, { name: 'apel', color: '#e8434b' },
];
class Kebun extends Zone {
  constructor() { super('kebun', 'Kebun Hitung', '#ffb347', 'caping'); this.maxLevel = 4; }
  answerText() { return `${NUM[this.N]} ${this.fruit.name}`; }
  hintText() { return this.mode === 'ambil' ? `Kita perlu ${NUM[this.N]} ${this.fruit.name}. Sekarang di keranjang ada ${NUM[this.inBasket.length]}. Ketuk buah di pohon untuk memetik!` : null; }
  get range() { return [[1, 3], [1, 5], [3, 7], [5, 10]][this.level - 1]; }
  build() {
    const g = this.group;
    this.slots = [];
    for (const tx of [-3.3, 3.3]) {
      box(0.6, 2.2, 0.6, '#8a5a35', tx, 1.1, -3, g);
      box(3.0, 1.8, 2.0, '#3f9b45', tx, 3.0, -3, g);
      box(2.0, 0.9, 1.4, '#5cbf5c', tx, 4.3, -3, g);
      for (const dy of [2.55, 3.45]) for (const dx of [-1.0, 0, 1.0]) this.slots.push(new THREE.Vector3(tx + dx, dy, -1.82));
    }
    // keranjang
    box(1.8, 0.7, 1.3, '#b07a3a', 0, 0.35, -0.6, g); box(1.95, 0.14, 1.45, '#8a5a2b', 0, 0.74, -0.6, g);
    for (let i = -2; i <= 2; i++) box(0.06, 0.66, 1.32, '#9a672e', i * 0.36, 0.35, -0.6, g, false);
    // papan angka
    box(0.2, 2.2, 0.2, '#8a5a35', 0, 1.1, -3.7, g);
    this.boardTex = canvasTex(320, 240, () => {});
    const wood = mat('#c98f52'); const face = new THREE.MeshLambertMaterial({ map: this.boardTex });
    const b = new THREE.Mesh(BOX, [wood, wood, wood, wood, face, wood]); b.scale.set(2.0, 1.5, 0.14); b.position.set(0, 2.9, -3.6); b.castShadow = true; g.add(b);
    this.drawBoard('?', 0, '#ff9a1f');
    this.makeIcon((ic) => { box(1.1, 1.1, 1.1, '#ff9a1f', 0, 0, 0, ic); box(0.18, 0.35, 0.18, '#6b4423', 0, 0.7, 0, ic); box(0.45, 0.12, 0.3, '#3fb25a', 0.25, 0.68, 0, ic); });
  }
  drawBoard(text, dots, color) {
    const { g } = this.boardTex.userData;
    g.fillStyle = '#fff6df'; g.fillRect(0, 0, 320, 240);
    g.fillStyle = '#1d2b53'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.font = `800 150px ${FONT}`;
    g.fillText(text, 160, dots ? 100 : 128);
    if (dots) {
      const per = Math.min(dots, 5); const rows = Math.ceil(dots / 5);
      for (let i = 0; i < dots; i++) {
        const r = Math.floor(i / 5), cnum = i % 5; const n = r === rows - 1 ? dots - r * 5 : per;
        const x = 160 + (cnum - (n - 1) / 2) * 34; const y = 186 + r * 32 - (rows - 1) * 12;
        g.fillStyle = color; g.beginPath(); g.arc(x, y, 12, 0, 7); g.fill();
      }
    }
    this.boardTex.needsUpdate = true;
  }
  basketPos(i) { return new THREE.Vector3(-0.6 + (i % 4) * 0.4, 0.92 + Math.floor(i / 12) * 0.42, -0.95 + (Math.floor(i / 4) % 3) * 0.35); }
  makeFruit(fr) {
    const f = new THREE.Group();
    box(0.46, 0.46, 0.46, fr.color, 0, 0, 0, f); box(0.08, 0.16, 0.08, '#6b4423', 0, 0.3, 0, f); box(0.2, 0.06, 0.14, '#3fb25a', 0.1, 0.3, 0, f, false);
    hitBox(0.85, 0.85, 0.85, 0, 0, 0, f);
    this.temp.add(f); return f;
  }
  startRound(t) {
    const [a, b] = this.range; this.fruit = pick(FRUITS);
    const r = Math.random(); // variasi: petik, hitung, atau hitung kilat (buah ditutup kain)
    this.mode = this.level >= 2 && r < 0.3 ? 'berapa' : this.level >= 2 && r < 0.55 ? 'kilat' : 'ambil';
    this.N = randi(a, b); this.inBasket = [];
    const fr = this.fruit; this.qkey = `${this.mode}:${fr.name}:${this.N}`;
    if (this.mode === 'ambil') {
      this.drawBoard(String(this.N), this.N, fr.color);
      const total = Math.min(12, this.N + randi(1, 3));
      const slots = shuffle(this.slots.slice()).slice(0, total);
      slots.forEach((s) => {
        const f = this.makeFruit(fr); f.position.copy(s); f.userData.home = s.clone(); f.userData.inBasket = false;
        f.userData.tap = () => this.tapFruit(f);
      });
      say(this.visitRounds ? pick([`Sekarang petik ${NUM[this.N]} ${fr.name}!`, `Ayo petik ${NUM[this.N]} ${fr.name}, lalu ketuk Sudah.`, `Pohon ${fr.name} sudah berbuah! Petik ${NUM[this.N]}, ya.`]) : `Petik ${NUM[this.N]} ${fr.name}, masukkan ke keranjang. Kalau sudah, ketuk Sudah!`, { stay: true });
      showAction('Sudah!', () => this.check());
    } else {
      this.drawBoard('?', 0, fr.color);
      for (let i = 0; i < this.N; i++) {
        const f = this.makeFruit(fr); f.position.copy(this.basketPos(i)); this.inBasket.push(f);
        f.userData.tap = () => this.countAid(f);
      }
      this.counted = new Set();
      const opts = new Set([this.N]);
      while (opts.size < 3) { const v = clamp(this.N + pick([-2, -1, 1, 2]), 1, 10); opts.add(v); }
      shuffle([...opts]).forEach((v, i) => {
        const bl = glyphBlock(String(v), pick(['#ffd23a', '#7cc8f5', '#ff8fc0', '#9be07f'].filter(Boolean)), 0.95);
        const g = new THREE.Group(); g.add(bl); hitBox(1.3, 1.3, 1.3, 0, 0, 0, g);
        g.position.set(-1.9 + i * 1.9, 0.5, 1.25); g.userData.baseY = 0.5;
        g.userData.tap = () => this.answer(v, g); g.userData.correct = v === this.N;
        this.temp.add(g);
      });
      this.cloth = null;
      if (this.mode === 'kilat') {
        // hitung kilat: lihat sebentar, lalu ditutup kain
        say(`Hitung kilat! Lihat baik-baik ${fr.name} di keranjang. Cepat, nanti ditutup!`, { stay: true });
        const cloth = box(2.2, 0.9, 1.7, '#e8434b', 0, 1.2, -0.6, this.temp); cloth.visible = false; this.cloth = cloth;
        setTimeout(() => { if (!this.alive(t)) return; cloth.visible = true; this.inBasket.forEach((f) => (f.visible = false)); SFX.whoosh(); say(`Tadi ada berapa ${fr.name}? Ketuk angkanya!`, { stay: true }); this.touch(); }, 4200);
      } else say(pick([`Ada berapa ${fr.name} di keranjang? Hitung dulu, lalu ketuk angkanya.`, `Yuk hitung ${fr.name} di keranjang. Ada berapa?`]), { stay: true });
    }
  }
  relayout() { this.inBasket.forEach((f, i) => flyTo(f, this.basketPos(i), { height: 0.2, dur: 0.25 })); }
  tapFruit(f) {
    if (this.round.solved || f.userData.busy) return;
    f.userData.busy = true;
    if (!f.userData.inBasket) {
      if (this.inBasket.length >= 12) { f.userData.busy = false; return; }
      f.userData.inBasket = true; this.inBasket.push(f); SFX.pop();
      speak(NUM[this.inBasket.length]);
      flyTo(f, this.basketPos(this.inBasket.length - 1), { height: 1.4 }).then(() => (f.userData.busy = false));
    } else {
      f.userData.inBasket = false; this.inBasket.splice(this.inBasket.indexOf(f), 1); SFX.whoosh();
      speak(this.inBasket.length ? `Sekarang ${NUM[this.inBasket.length]}` : 'Keranjang kosong');
      this.relayout();
      flyTo(f, f.userData.home, { height: 1.2 }).then(() => (f.userData.busy = false));
    }
  }
  check() {
    if (this.round.solved) return;
    const n = this.inBasket.length, N = this.N, nm = this.fruit.name;
    if (n === 0) { say(`Keranjangnya masih kosong. Ayo petik ${NUM[N]} ${nm}!`, { stay: true }); return; }
    if (n === N) { this.success(`${pick(YAY)} Ada ${NUM[N]} ${nm} di keranjang.`); return; }
    this.error();
    if (n < N) say(`Hmm, baru ${NUM[n]}, ya. Kita perlu ${NUM[N]}. Yuk, petik lagi!`, { stay: true });
    else say(`Wah, ada ${NUM[n]}. Kebanyakan, nih! Ketuk ${nm} di keranjang, nanti dia kembali ke pohon.`, { stay: true });
  }
  countAid(f) {
    if (this.round.solved) return;
    if (this.counted.size >= this.inBasket.length) this.counted.clear();
    if (this.counted.has(f)) { hop(f, 0.25, 0.25); return; }
    this.counted.add(f); hop(f); SFX.tap(); speak(NUM[this.counted.size]);
  }
  async answer(v, g) {
    if (this.round.solved || this.busy) return;
    hop(g); SFX.tap();
    if (v === this.N) { if (!this.secret) this.drawBoard(String(this.N), this.N, this.fruit.color); this.success(`${cap(NUM[v])}! Ada ${NUM[v]} ${this.fruit.name}.`); return; }
    if (this.error()) return; this.busy = true; const t = this.token;
    if (this.cloth) { this.cloth.visible = false; this.inBasket.forEach((f) => (f.visible = true)); }
    say(`${pick(OOPS)} Yuk, kita hitung sama-sama.`, { stay: true });
    await wait(1700);
    for (let i = 0; i < this.inBasket.length; i++) {
      if (!this.alive(t)) { this.busy = false; return; }
      hop(this.inBasket[i]); speak(NUM[i + 1]); await wait(800);
    }
    this.busy = false; this.counted.clear();
    if (this.alive(t)) say(`Jadi ada berapa ${this.fruit.name}? Ketuk angkanya.`, { stay: true });
  }
}

/* =========================================================
   ZONA 2 — RUMAH WARNA (mengelompokkan warna & ukuran)
   ========================================================= */
function makeHouse(color, s = 1) {
  const g = new THREE.Group(); g.scale.setScalar(s);
  const c = new THREE.Color(color); const dark = '#' + c.clone().offsetHSL(0, 0, -0.15).getHexString();
  box(1.4, 1.1, 1.2, color, 0, 0.55, 0, g);
  box(1.62, 0.3, 1.4, dark, 0, 1.25, 0, g); box(1.1, 0.3, 1.0, dark, 0, 1.55, 0, g); box(0.55, 0.26, 0.6, dark, 0, 1.82, 0, g);
  box(0.46, 0.72, 0.06, '#ffffff', 0, 0.36, 0.61, g); box(0.3, 0.52, 0.07, '#5b3b22', 0, 0.3, 0.62, g);
  box(0.28, 0.28, 0.06, '#e8f6ff', -0.46, 0.75, 0.61, g, false); box(0.28, 0.28, 0.06, '#e8f6ff', 0.46, 0.75, 0.61, g, false);
  hitBox(1.8, 2.4, 1.6, 0, 1.0, 0.1, g);
  return g;
}
class Warna extends Zone {
  constructor() { super('warna', 'Rumah Warna', '#7fb2ff', 'pelangi'); this.maxLevel = 4; }
  build() {
    this.makeIcon((ic) => { box(0.8, 0.8, 0.8, '#e8434b', -0.7, -0.3, 0, ic); box(0.8, 0.8, 0.8, '#ffd23a', 0.7, -0.3, 0, ic); box(0.8, 0.8, 0.8, '#3a7cf5', 0, 0.5, 0, ic); });
  }
  hintTargets() {
    if (this.findMode) return this.blocks.filter((b) => !b.userData.done && b.userData.key === this.findKey);
    if (this.sel) return this.houses.filter((h) => h.userData.key === this.sel.userData.key);
    return this.blocks.filter((b) => !b.userData.done).slice(0, 1);
  }
  hintText() { return this.findMode ? `Cari balok yang warnanya ${this.findKey}!` : this.sel ? `Balok ini warnanya ${this.sel.userData.key}. Rumahnya yang melompat itu!` : 'Ketuk satu balok dulu, ya.'; }
  startRound(t) {
    this.sel = null; this.blocks = []; this.houses = []; this.firstTalk = true; this.findMode = false;
    const L = this.level; this.qkey = null;
    // variasi: cari semua balok dengan warna tertentu
    if (Math.random() < (L === 4 ? 0.35 : 0.3)) {
      this.findMode = true; this.sizeMode = false;
      const pool = shuffle(['merah', 'biru', 'kuning', 'hijau', 'ungu', 'oranye'].slice()).slice(0, Math.min(5, L + 2));
      const key = pool[0]; this.findKey = key; this.qkey = `cari:${key}:${pool.join(',')}`;
      const h = makeHouse(COLORS[key], 1.2); h.position.set(0, 0, -3.3); h.userData.key = key; this.temp.add(h); this.houses.push(h);
      const want = randi(2, 2 + L), defs = [];
      for (let i = 0; i < want; i++) defs.push({ key, color: COLORS[key], size: 0.68 });
      for (let i = 0; i < 4 + L; i++) { const k = pick(pool.slice(1)); defs.push({ key: k, color: COLORS[k], size: 0.68 }); }
      this.spawnBlocks(shuffle(defs));
      say(pick([`Cari warna! Ketuk semua balok ${key}, biar pulang ke rumahnya.`, `Ayo kumpulkan semua balok ${key}!`, `Mana saja balok yang warnanya ${key}? Ketuk semuanya!`]), { stay: true });
      return;
    }
    if (L === 4) {
      this.sizeMode = true;
      const col = pick(['#e8434b', '#3a7cf5', '#3fb25a', '#9a62e0']);
      [['besar', 1.35, -2.6], ['kecil', 0.75, 2.6]].forEach(([nm, s, x]) => {
        const h = makeHouse(col, s); h.position.set(x, 0, -3.1); h.userData.key = nm; h.userData.tap = () => this.tapHouse(h); this.temp.add(h); this.houses.push(h);
      });
      const sizes = shuffle(['besar', 'besar', 'kecil', 'kecil', pick(['besar', 'kecil'])]);
      this.spawnBlocks(sizes.map((s) => ({ key: s, color: col, size: s === 'besar' ? 0.95 : 0.45 })));
      say('Balok besar pulang ke rumah besar. Balok kecil ke rumah kecil. Ketuk balok, lalu ketuk rumahnya!', { stay: true });
      return;
    }
    this.sizeMode = false;
    const names = ['merah', 'biru', 'kuning', 'hijau', 'ungu'].slice(0, L + 2);
    const order = shuffle(names.slice()); this.qkey = order.join(',');
    order.forEach((nm, i) => {
      const h = makeHouse(COLORS[nm]); const n = order.length;
      h.position.set(-4 + i * (8 / (n - 1)), 0, -3.2); h.userData.key = nm; h.userData.tap = () => this.tapHouse(h);
      this.temp.add(h); this.houses.push(h);
    });
    const list = shuffle([...names, pick(names)]);
    this.spawnBlocks(list.map((nm) => ({ key: nm, color: COLORS[nm], size: 0.68 })));
    say(L === 1 ? 'Balok-balok ingin pulang! Ketuk balok, lalu ketuk rumah yang warnanya sama.' : 'Bantu balok pulang ke rumah yang warnanya sama!', { stay: true });
  }
  spawnBlocks(defs) {
    const spots = [];
    for (const d of defs) {
      let p, k = 0;
      do { p = new THREE.Vector3(rand(-3.4, 3.8), 0, rand(-1.2, 1.0)); k++; } while (k < 60 && spots.some((s) => s.distanceTo(p) < 1.25));
      spots.push(p);
      const g = new THREE.Group(); box(1, 1, 1, d.color, 0, 0, 0, g); g.children[0].scale.setScalar(d.size);
      hitBox(Math.max(0.95, d.size + 0.3), 1.1, Math.max(0.95, d.size + 0.3), 0, 0, 0, g);
      g.position.set(p.x, d.size / 2, p.z); g.userData = { key: d.key, baseY: d.size / 2, size: d.size, home: new THREE.Vector3(p.x, d.size / 2, p.z) };
      g.rotation.y = rand(-0.4, 0.4);
      g.userData.tap = () => this.tapBlock(g);
      this.temp.add(g); this.blocks.push(g);
    }
  }
  select(b) {
    if (this.sel && this.sel !== b) { const o = this.sel; tween(0.2, (k) => { o.position.y = o.userData.baseY + 0.7 * (1 - k); }); }
    this.sel = b;
    tween(0.2, (k) => { b.position.y = b.userData.baseY + 0.7 * k; });
  }
  async tapBlock(b) {
    if (b.userData.done || this.round.solved) return;
    if (this.findMode) {
      const key = b.userData.key;
      if (key !== this.findKey) { if (this.error()) return; wiggle(b); say(`Itu warna ${key}. Cari yang ${this.findKey}, ya.`, { stay: true }); return; }
      b.userData.done = true; SFX.pop(); const h = this.houses[0];
      await flyTo(b, h.position.clone().add(new THREE.Vector3(0, 0.5, 0.8)), { height: 1.6, scaleTo: 0.2 }); b.visible = false; hop(h, 0.25);
      const left = this.blocks.filter((x) => !x.userData.done && x.userData.key === this.findKey).length;
      if (!left) this.success(`${pick(YAY)} Semua balok ${this.findKey} sudah ketemu!`); else speak(pick(['Satu lagi!', 'Bagus!', `Masih ada ${NUM[left]} lagi!`]));
      return;
    }
    SFX.tap(); this.select(b);
    const key = b.userData.key;
    // tingkat awal: rumah yang cocok ikut melompat sebagai bantuan
    if (this.level === 1 || this.sizeMode) this.houses.filter((h) => h.userData.key === key).forEach((h) => hop(h, 0.35, 0.4));
    if (this.sizeMode) say(`Balok ${key}! Ke rumah ${key}.`, { stay: true });
    else if (this.level === 1) say(`Balok ${key}. Cari rumah ${key}!`, { stay: true });
    else if (this.firstTalk) { say('Balok ini warnanya apa? Bawa ke rumahnya!', { stay: true }); this.firstTalk = false; }
  }
  async tapHouse(h) {
    if (this.round.solved) return;
    const b = this.sel; const hk = h.userData.key;
    if (!b) { say('Pilih balok dulu ya, lalu ketuk rumahnya.', { stay: true }); this.blocks.filter((x) => !x.userData.done).forEach((x) => hop(x, 0.3)); return; }
    const bk = b.userData.key;
    const door = h.position.clone().add(new THREE.Vector3(0, 0.4 * h.scale.x, 0.7 * h.scale.x));
    if (bk === hk) {
      this.sel = null; b.userData.done = true; SFX.pop();
      speak(this.sizeMode ? `${cap(bk)}!` : `${cap(bk)}!`);
      await flyTo(b, door, { height: 1.6, scaleTo: 0.2 });
      b.visible = false; hop(h, 0.25);
      if (this.blocks.every((x) => x.userData.done)) this.success(`${pick(YAY)} Semua balok sudah pulang ke rumahnya.`);
    } else {
      this.error(); this.sel = null;
      const t = this.token;
      if (this.sizeMode) say(`Ini rumah ${hk}. Baloknya ${bk}. Coba rumah ${bk}.`, { stay: true });
      else say(`Eh, ini rumah ${hk}. Balokmu warnanya ${bk}. Cari rumah ${bk}, ya.`, { stay: true });
      wiggle(h);
      await flyTo(b, door.clone().lerp(b.userData.home, 0.5), { height: 1, dur: 0.35 });
      if (this.alive(t)) await flyTo(b, b.userData.home, { height: 0.6, dur: 0.35 });
    }
  }
}

/* =========================================================
   ZONA 3 — KANDANG HEWAN (kosakata, bunyi, huruf awal)
   ========================================================= */
function eyes(g, y, z, sep = 0.12, s = 0.08) { box(s, s, 0.04, '#1d2238', -sep, y, z, g, false); box(s, s, 0.04, '#1d2238', sep, y, z, g, false); }
const ANIMALS = [
  { id: 'ayam', name: 'ayam', sound: 'Kukuruyuk!', letter: 'A', build(g) {
    box(0.8, 0.7, 0.9, '#f7f3ea', 0, 0.75, 0, g); box(0.5, 0.5, 0.5, '#f7f3ea', 0, 1.3, 0.32, g);
    box(0.14, 0.26, 0.34, '#e8434b', 0, 1.66, 0.32, g); box(0.2, 0.14, 0.22, '#ffb21e', 0, 1.25, 0.66, g); box(0.12, 0.18, 0.08, '#e8434b', 0, 1.08, 0.6, g);
    box(0.3, 0.5, 0.22, '#e9e2d0', 0, 1.1, -0.52, g); eyes(g, 1.4, 0.58, 0.14);
    box(0.08, 0.42, 0.08, '#ffb21e', -0.18, 0.21, 0, g); box(0.08, 0.42, 0.08, '#ffb21e', 0.18, 0.21, 0, g); return 1.9; } },
  { id: 'bebek', name: 'bebek', sound: 'Kwek kwek!', letter: 'B', build(g) {
    box(0.8, 0.62, 1.0, '#ffd23a', 0, 0.62, 0, g); box(0.5, 0.5, 0.5, '#ffd23a', 0, 1.12, 0.32, g);
    box(0.36, 0.12, 0.34, '#ff8a2a', 0, 1.02, 0.7, g); box(0.26, 0.3, 0.2, '#f0c22a', 0, 0.9, -0.55, g); eyes(g, 1.22, 0.58, 0.14);
    box(0.1, 0.3, 0.1, '#ff8a2a', -0.18, 0.15, 0, g); box(0.1, 0.3, 0.1, '#ff8a2a', 0.18, 0.15, 0, g); return 1.6; } },
  { id: 'kucing', name: 'kucing', sound: 'Meong!', letter: 'K', build(g) {
    box(0.55, 0.55, 1.1, '#ff9a3c', 0, 0.68, 0, g);
    for (const [x, z] of [[-0.18, 0.38], [0.18, 0.38], [-0.18, -0.38], [0.18, -0.38]]) box(0.18, 0.42, 0.18, '#ff9a3c', x, 0.21, z, g);
    box(0.66, 0.6, 0.56, '#ff9a3c', 0, 1.08, 0.58, g); box(0.18, 0.24, 0.12, '#ff9a3c', -0.2, 1.48, 0.58, g); box(0.18, 0.24, 0.12, '#ff9a3c', 0.2, 1.48, 0.58, g);
    box(0.4, 0.06, 0.04, '#ffffff', 0, 0.9, 0.87, g, false); box(0.1, 0.07, 0.04, '#ff8fc0', 0, 1.0, 0.88, g, false); eyes(g, 1.15, 0.87, 0.15, 0.1);
    const tl = box(0.12, 0.7, 0.12, '#e8862c', 0, 1.0, -0.6, g); tl.rotation.x = -0.4; return 1.7; } },
  { id: 'sapi', name: 'sapi', sound: 'Mooo!', letter: 'S', build(g) {
    box(0.95, 0.8, 1.5, '#f7f7f2', 0, 1.05, 0, g);
    box(0.97, 0.4, 0.5, '#2c2f3a', 0, 1.2, -0.2, g, false); box(0.5, 0.3, 0.4, '#2c2f3a', 0.24, 0.9, 0.45, g, false);
    for (const [x, z] of [[-0.3, 0.5], [0.3, 0.5], [-0.3, -0.5], [0.3, -0.5]]) box(0.24, 0.7, 0.24, '#f7f7f2', x, 0.35, z, g);
    box(0.7, 0.6, 0.6, '#f7f7f2', 0, 1.45, 0.95, g); box(0.62, 0.3, 0.2, '#ffb3c1', 0, 1.28, 1.3, g); eyes(g, 1.58, 1.26, 0.18, 0.1);
    box(0.12, 0.2, 0.12, '#efe2c0', -0.28, 1.84, 0.95, g); box(0.12, 0.2, 0.12, '#efe2c0', 0.28, 1.84, 0.95, g);
    box(0.24, 0.12, 0.18, '#2c2f3a', -0.47, 1.6, 0.9, g); box(0.24, 0.12, 0.18, '#2c2f3a', 0.47, 1.6, 0.9, g); return 2.1; } },
  { id: 'domba', name: 'domba', sound: 'Mbeeek!', letter: 'D', build(g) {
    box(1.0, 0.8, 1.2, '#fbfaf4', 0, 0.9, 0, g);
    for (const [x, y, z] of [[-0.35, 1.32, 0.3], [0.35, 1.32, -0.3], [0, 1.36, 0], [-0.4, 1.0, -0.45], [0.42, 1.0, 0.45]]) box(0.45, 0.4, 0.45, '#ffffff', x, y, z, g);
    for (const [x, z] of [[-0.28, 0.4], [0.28, 0.4], [-0.28, -0.4], [0.28, -0.4]]) box(0.18, 0.55, 0.18, '#4a4550', x, 0.28, z, g);
    box(0.5, 0.52, 0.5, '#4a4550', 0, 1.15, 0.78, g); box(0.24, 0.12, 0.14, '#4a4550', -0.34, 1.25, 0.72, g); box(0.24, 0.12, 0.14, '#4a4550', 0.34, 1.25, 0.72, g);
    box(0.09, 0.09, 0.04, '#ffffff', -0.12, 1.24, 1.04, g, false); box(0.09, 0.09, 0.04, '#ffffff', 0.12, 1.24, 1.04, g, false); return 1.8; } },
];
const ANIMAL_EMOJI = { ayam: '🐔', bebek: '🦆', kucing: '🐱', sapi: '🐮', domba: '🐑' };
class Hewan extends Zone {
  constructor() { super('hewan', 'Kandang Hewan', '#9be07f', 'kucing'); this.maxLevel = 3; }
  answerText() { return this.target.userData.A.name; }
  build() {
    const g = this.group;
    for (let x = -5.2; x <= 5.21; x += 1.3) box(0.2, 1.0, 0.2, '#c98f52', x, 0.5, -3.9, g);
    for (let z = -3.9; z <= -0.9; z += 1.0) { box(0.2, 1.0, 0.2, '#c98f52', -5.2, 0.5, z, g); box(0.2, 1.0, 0.2, '#c98f52', 5.2, 0.5, z, g); }
    box(10.6, 0.14, 0.12, '#b07a3a', 0, 0.75, -3.9, g); box(10.6, 0.14, 0.12, '#b07a3a', 0, 0.4, -3.9, g);
    box(0.12, 0.14, 3.1, '#b07a3a', -5.2, 0.75, -2.4, g); box(0.12, 0.14, 3.1, '#b07a3a', 5.2, 0.75, -2.4, g);
    box(0.2, 2.2, 0.2, '#8a5a35', 0, 1.1, -4.5, g);
    this.boardTex = canvasTex(320, 240, () => {});
    const wood = mat('#c98f52'); const face = new THREE.MeshLambertMaterial({ map: this.boardTex });
    const b = new THREE.Mesh(BOX, [wood, wood, wood, wood, face, wood]); b.scale.set(2.0, 1.5, 0.14); b.position.set(0, 3.0, -4.4); b.castShadow = true; g.add(b);
    this.animals = ANIMALS.map((A, i) => {
      const a = new THREE.Group(); const h = A.build(a);
      hitBox(1.5, h + 0.3, 1.8, 0, h / 2, 0, a);
      a.position.set(-4 + i * 2, 0, -2); a.userData = { A, baseY: 0 };
      a.userData.tap = () => this.tapAnimal(a);
      g.add(a); return a;
    });
    this.drawBoard('?');
    this.makeIcon((ic) => { box(0.9, 0.9, 0.9, '#f7f3ea', 0, 0, 0, ic); box(0.24, 0.4, 0.5, '#e8434b', 0, 0.6, 0, ic); box(0.36, 0.24, 0.36, '#ffb21e', 0, -0.05, 0.6, ic); eyes(ic, 0.15, 0.46, 0.22, 0.14); });
  }
  drawBoard(main, sub = '') {
    const { g } = this.boardTex.userData;
    g.fillStyle = '#fff6df'; g.fillRect(0, 0, 320, 240);
    g.fillStyle = '#1d2b53'; g.textAlign = 'center'; g.textBaseline = 'middle';
    g.font = `800 ${main.length > 3 ? 92 : 150}px ${FONT}`; g.fillText(main, 160, sub ? 100 : 124);
    if (sub) { g.font = `600 44px ${FONT}`; g.fillStyle = '#4a5680'; g.fillText(sub, 160, 196); }
    this.boardTex.needsUpdate = true;
  }
  startRound(t) {
    // posisi hewan diacak supaya anak mengenali hewan, bukan tempatnya
    const xs = shuffle([-4, -2, 0, 2, 4]);
    this.animals.forEach((a, i) => { const to = new THREE.Vector3(xs[i], 0, -2); flyTo(a, to, { height: 0.6, dur: 0.5 }); });
    let tgt; do { tgt = pick(this.animals); } while (tgt === this.lastTarget && Math.random() < 0.9);
    this.lastTarget = tgt; this.target = tgt; const A = tgt.userData.A; this.qkey = `${this.level}:${A.id}`;
    const t0 = this.token;
    this.animals.forEach((a) => (a.visible = true));
    // variasi daya ingat: satu hewan bersembunyi, siapa yang hilang?
    this.hideMode = Math.random() < (this.level === 1 ? 0.2 : 0.3);
    if (this.hideMode) {
      this.qkey = `hilang:${A.id}`; this.drawBoard('?', 'siapa hilang');
      setTimeout(() => { if (this.alive(t0)) say('Ingat-ingat hewannya, ya! Ada ayam, bebek, kucing, sapi, dan domba. Nanti ada yang bersembunyi!', { stay: true }); }, 600);
      setTimeout(async () => {
        if (!this.alive(t0)) return; await afterSpeech(8000); if (!this.alive(t0)) return;
        tgt.visible = false; SFX.whoosh();
        const others = shuffle(this.animals.filter((x) => x !== tgt).slice()).slice(0, 2);
        shuffle([tgt, ...others]).forEach((an, i) => {
          const card = new THREE.Group(); card.position.set(-2.4 + i * 2.4, 0, 1.4);
          box(1.3, 0.12, 1.3, '#fff6df', 0, 0.06, 0, card); const sp = emojiSprite(ANIMAL_EMOJI[an.userData.A.id], 1.3); sp.position.y = 0.9; card.add(sp);
          hitBox(1.5, 1.8, 1.5, 0, 0.8, 0, card); card.userData = { baseY: 0, correct: an === tgt };
          card.userData.tap = () => this.pickHidden(an, card); this.temp.add(card);
        });
        say('Siapa yang bersembunyi? Ketuk gambarnya!', { stay: true }); this.touch();
      }, 900);
      return;
    }
    setTimeout(() => {
      if (!this.alive(t0)) return;
      if (this.level === 1) { this.drawBoard(A.name); say(`Mana ${A.name}? ${A.sound}`, { stay: true }); }
      else if (this.level === 2) { this.drawBoard('?', 'dengar baik-baik'); say(`Siapa yang bunyinya ${A.sound}`, { stay: true }); }
      else { this.drawBoard(`${A.letter} ${A.letter.toLowerCase()}`, 'huruf awal'); say(`Mana hewan yang namanya dimulai huruf ${A.letter}?`, { stay: true }); }
    }, 600);
  }
  hintTargets() { return this.hideMode ? super.hintTargets() : [this.target]; }
  pickHidden(an, card) {
    if (!this.active || this.round.solved) return;
    hop(card, 0.4); SFX.tap(); const A = an.userData.A;
    if (an === this.target) { this.target.visible = true; hop(this.target, 0.8, 0.5); this.success(`${pick(YAY)} ${cap(A.name)} yang bersembunyi! ${A.sound}`); return; }
    if (this.error()) return; wiggle(card); say(`${cap(A.name)} masih ada di kandang. Lihat lagi, siapa yang tidak ada?`, { stay: true });
  }
  tapAnimal(a) {
    const A = a.userData.A; hop(a, 0.5, 0.4); SFX.tap();
    if (!this.active || !this.round || this.round.solved || this.hideMode) { speak(`${cap(A.name)}! ${A.sound}`); return; }
    const T = this.target.userData.A;
    if (a === this.target) {
      if (!this.secret) this.drawBoard(T.name);
      this.success(this.level === 3 ? `${cap(T.name)}! ${T.name} dimulai huruf ${T.letter}.` : `${cap(T.name)}! ${T.sound}`);
      return;
    }
    this.error();
    if (this.level === 1) say(`Itu ${A.name}, ${A.sound} Cari ${T.name} ya.`, { stay: true });
    else if (this.level === 2) say(`Itu ${A.name}, bunyinya ${A.sound} Siapa yang ${T.sound}`, { stay: true });
    else say(`Itu ${A.name}, dimulai huruf ${A.letter}. Cari yang dimulai huruf ${T.letter}.`, { stay: true });
  }
}

/* =========================================================
   ZONA 4 — MENARA POLA (pola & logika awal)
   ========================================================= */
const POLA_COLORS = ['merah', 'biru', 'kuning', 'hijau', 'ungu', 'oranye'];
class Pola extends Zone {
  constructor() { super('pola', 'Menara Pola', '#c9a6ff', 'mahkota'); this.maxLevel = 4; }
  answerText() { return this.answerName; }
  build() {
    const g = this.group;
    ['merah', 'biru', 'merah', 'biru', 'merah', 'biru', 'merah'].forEach((c, i) => box(1.1, 0.75, 1.1, COLORS[c], 0, 0.38 + i * 0.75, -5.2, g));
    box(0.5, 0.5, 0.5, '#ffd23a', 0, 5.65, -5.2, g);
    this.qTex = glyphTex('?', '#ffffff', '#1d2b53');
    this.makeIcon((ic) => { ['merah', 'biru', 'merah', 'biru'].forEach((c, i) => box(0.8, 0.5, 0.8, COLORS[c], 0, -0.75 + i * 0.5, 0, ic)); });
  }
  startRound(t) {
    const L = this.level;
    const type = [null, 'AB', pick(['AAB', 'ABB']), 'ABC', pick(['AABB', 'ABAC'])][L];
    const u = type.length;
    const names = shuffle(POLA_COLORS.slice());
    const map = { A: names[0], B: names[1], C: names[2] };
    const showLen = clamp(randi(2 * u, 2 * u + u - 1), 4, 6);
    const seq = []; for (let i = 0; i <= showLen; i++) seq.push(map[type[i % u]]);
    const n = showLen + 1;
    // variasi: balok yang hilang bisa di tengah pola, bukan selalu di ujung
    this.miss = L >= 2 && Math.random() < 0.35 ? randi(1, n - 2) : n - 1;
    this.seq = seq; this.answerName = seq[this.miss]; this.n = n; this.qkey = `${seq.join(',')}@${this.miss}`; this.placed = null;
    const sp = 1.15; const x0 = -((n - 1) * sp) / 2;
    this.slotPos = []; this.blockAt = [];
    for (let i = 0; i < n; i++) {
      const x = x0 + i * sp;
      box(0.95, 0.4, 0.95, '#d9dee8', x, 0.2, -2.5, this.temp);
      this.slotPos.push(new THREE.Vector3(x, 0.8, -2.5));
    }
    const t0 = this.token;
    seq.forEach((nm, i) => {
      if (i === this.miss) return;
      const b = box(0.8, 0.8, 0.8, COLORS[nm], this.slotPos[i].x, 3, -2.5, this.temp);
      b.visible = false; this.blockAt[i] = b;
      setTimeout(() => { if (!this.alive(t0)) return; b.visible = true; SFX.tap(); flyTo(b, this.slotPos[i], { height: 0, dur: 0.3 }); }, 150 * i);
    });
    const qside = mat('#ffffff'); const qface = new THREE.MeshLambertMaterial({ map: this.qTex });
    this.q = new THREE.Mesh(BOX, [qside, qside, qface, qside, qface, qside]); this.q.scale.setScalar(0.8);
    this.q.position.copy(this.slotPos[this.miss]); this.q.userData.baseY = 0.8; this.q.castShadow = true; this.temp.add(this.q);
    // pilihan
    const others = names.filter((x) => x !== this.answerName);
    const inUnit = [...new Set(seq)].filter((x) => x !== this.answerName);
    const opts = new Set([this.answerName]);
    for (const x of shuffle(inUnit)) if (opts.size < 3) opts.add(x);
    for (const x of others) if (opts.size < 3) opts.add(x);
    shuffle([...opts]).forEach((nm, i) => {
      const g = new THREE.Group(); box(0.8, 0.8, 0.8, COLORS[nm], 0, 0, 0, g); hitBox(1.3, 1.3, 1.3, 0, 0, 0, g);
      box(1.0, 0.16, 1.0, '#58b04e', 0, -0.48, 0, g);
      g.position.set(-2 + i * 2, 0.56, 1.0); g.userData = { name: nm, baseY: 0.56, home: new THREE.Vector3(-2 + i * 2, 0.56, 1.0), correct: nm === this.answerName };
      g.userData.tap = () => this.choose(g); this.temp.add(g);
    });
    const middle = this.miss < n - 1;
    setTimeout(() => {
      if (!this.alive(t0)) return;
      const read = seq.map((c, i) => (i === this.miss ? 'apa' : c)).slice(0, middle ? n : n - 1).join(', ');
      say(middle ? `Ada balok yang hilang di tengah! ${L <= 2 ? `Dengar: ${read}. ` : ''}Balok apa yang cocok?`
        : L === 1 ? `Lihat polanya: ${read}. Apa selanjutnya?` : pick(['Apa balok selanjutnya? Ketuk balok yang cocok!', 'Lanjutkan polanya, yuk!', 'Balok apa yang datang berikutnya?']), { stay: true });
    }, 150 * n + 300);
  }
  async readPattern(t) {
    for (let i = 0; i < this.n; i++) {
      if (!this.alive(t)) return;
      const b = i === this.miss ? this.placed || this.q : this.blockAt[i];
      if (b) hop(b, 0.35, 0.3);
      speak(i === this.miss && !this.placed ? 'apa?' : this.seq[i]); await wait(750);
    }
  }
  async choose(g) {
    if (this.round.solved || this.busy) return;
    this.busy = true; const t = this.token; SFX.tap();
    if (this.secret) { this.busy = false; if (g.userData.name === this.answerName) this.success(''); else this.error(); return; }
    await flyTo(g, this.slotPos[this.miss], { height: 1.4 });
    if (!this.alive(t)) return;
    if (g.userData.name === this.answerName) {
      this.q.visible = false; this.placed = g; g.children[2].visible = false; SFX.pop();
      await this.readPattern(t);
      this.busy = false;
      if (this.alive(t)) this.success(`${pick(YAY)} ${cap(this.answerName)}!`);
    } else {
      this.error();
      say(`Hmm, ${g.userData.name} belum cocok. Yuk, kita baca polanya sama-sama.`, { stay: true });
      await flyTo(g, g.userData.home, { height: 0.8 });
      await wait(1500);
      await this.readPattern(t);
      this.busy = false;
      if (this.alive(t)) say('Nah, yang cocok apa, ya?', { stay: true });
    }
  }
}

/* =========================================================
   ZONA 5 — TAMAN BENTUK (mengenal bentuk geometri)
   ========================================================= */
const SHAPES = ['lingkaran', 'segitiga', 'persegi', 'bintang', 'hati', 'persegi panjang'];
const SHAPE_HINT = {
  lingkaran: 'bulat seperti bola', segitiga: 'punya tiga sudut', persegi: 'punya empat sisi yang sama panjang',
  'persegi panjang': 'panjang seperti pintu', bintang: 'punya lima ujung lancip', hati: 'seperti tanda sayang',
};
const SHAPE_COLORS = ['merah', 'biru', 'kuning', 'hijau', 'ungu', 'oranye'];
const OBJ_SHAPES = [['🍕', 'segitiga', 'potongan pizza'], ['🧀', 'segitiga', 'keju'], ['⚽', 'lingkaran', 'bola'], ['🍪', 'lingkaran', 'kue'], ['🕐', 'lingkaran', 'jam'], ['🍩', 'lingkaran', 'donat'],
  ['📦', 'persegi', 'kotak'], ['🎲', 'persegi', 'dadu'], ['🖼️', 'persegi', 'bingkai foto'], ['🚪', 'persegi panjang', 'pintu'], ['📱', 'persegi panjang', 'HP'], ['📕', 'persegi panjang', 'buku'],
  ['⭐', 'bintang', 'bintang di langit'], ['🌟', 'bintang', 'bintang bersinar'], ['❤️', 'hati', 'tanda sayang'], ['💝', 'hati', 'hadiah hati']];
class Bentuk extends Zone {
  constructor() { super('bentuk', 'Taman Bentuk', '#ff9f80', 'kerucut'); this.maxLevel = 4; }
  answerText() { return this.target.color ? `${this.target.shape} ${this.target.color}` : this.target.shape; }
  build() {
    const g = this.group;
    // tiang-tiang hias dengan bentuk di puncaknya
    [[-4.8, '#e8434b', 'lingkaran'], [4.8, '#3a7cf5', 'segitiga']].forEach(([x, c, sh]) => {
      box(0.5, 2.6, 0.5, c, x, 1.3, -3.6, g);
      const face = new THREE.MeshLambertMaterial({ map: shapeTex(sh, COLORS[pick(SHAPE_COLORS)]) }); const side = mat('#fffaf0');
      const t = new THREE.Mesh(BOX, [side, side, side, side, face, side]); t.scale.set(1.3, 1.3, 0.16); t.position.set(x, 3.3, -3.6); g.add(t);
    });
    for (let i = 0; i < 5; i++) box(1.6 - i * 0.3, 0.4, 1.6 - i * 0.3, ['#ffd23a', '#ff8fc0', '#7cc8f5', '#9be07f', '#ffffff'][i], 4.6, 0.2 + i * 0.4, -1.4, g);
    this.boardTex = makeBoard(g, 0, -3.8, 2.4, 1.7, 3.0);
    this.drawBoard('?');
    this.makeIcon((ic) => {
      box(0.9, 0.9, 0.9, '#e8434b', -0.6, -0.3, 0, ic); [0.9, 0.6, 0.3].forEach((s, i) => box(s, 0.3, 0.9, '#ffd23a', 0.6, -0.6 + i * 0.3, 0, ic));
      box(0.5, 0.5, 0.5, '#3a7cf5', 0, 0.55, 0, ic);
    });
  }
  drawBoard(text, shape = null, silhouette = false) {
    const { g, canvas } = this.boardTex.userData; const W = canvas.width, H = canvas.height;
    g.fillStyle = '#fff6df'; g.fillRect(0, 0, W, H);
    if (shape) { tracePath(g, shape, W / 2, H / 2 + 8, H * 0.34); g.fillStyle = silhouette ? '#3b3f55' : '#ff9f80'; g.fill(); }
    else { g.fillStyle = '#1d2b53'; g.textAlign = 'center'; g.textBaseline = 'middle'; const emo = !/[a-z]/i.test(text); g.font = emo ? `150px ${EMOJI_FONT}` : `800 ${text.length > 9 ? 56 : text.length > 4 ? 76 : 150}px ${FONT}`; g.fillText(text, W / 2, H / 2 + 6); }
    this.boardTex.needsUpdate = true;
  }
  makeCard(shape, colorName, x) {
    const g = new THREE.Group(); g.position.set(x, 0, 0.4);
    box(0.24, 0.9, 0.24, '#8a5a35', 0, 0.45, -0.05, g);
    const face = new THREE.MeshLambertMaterial({ map: shapeTex(shape, COLORS[colorName]) }); const side = mat(COLORS[colorName]);
    const card = new THREE.Mesh(BOX, [side, side, side, side, face, side]); card.scale.set(1.5, 1.5, 0.18); card.position.y = 1.55; card.castShadow = true; g.add(card);
    hitBox(1.7, 2.6, 0.8, 0, 1.3, 0, g);
    g.userData = { shape, color: colorName, baseY: 0 };
    g.userData.tap = () => this.choose(g);
    this.temp.add(g); return g;
  }
  startRound() {
    const L = this.level;
    let shape; do { shape = pick(L === 1 ? SHAPES.slice(0, 3) : SHAPES); } while (shape === this.lastShape && Math.random() < 0.9);
    this.lastShape = shape;
    const color = pick(SHAPE_COLORS);
    this.target = { shape, color: L === 3 ? color : null }; this.qkey = `${L}:${shape}:${L === 3 ? color : ''}`;
    let opts;
    if (L === 1) opts = shuffle(SHAPES.slice(0, 3)).map((s) => ({ shape: s }));
    else if (L === 3) {
      const other = pick(SHAPES.filter((s) => s !== shape)); const oc = pick(SHAPE_COLORS.filter((c) => c !== color));
      opts = [{ shape, color }, { shape, color: oc }, { shape: other, color }, { shape: pick(SHAPES.filter((s) => s !== shape && s !== other)), color: pick(SHAPE_COLORS.filter((c) => c !== color && c !== oc)) }];
    } else opts = [{ shape }, ...shuffle(SHAPES.filter((s) => s !== shape)).slice(0, 3).map((s) => ({ shape: s }))];
    // variasi: benda sehari-hari (🍕 bentuknya apa?) untuk menghubungkan bentuk dengan dunia nyata
    this.obj = null;
    if (L <= 3 && Math.random() < 0.35) {
      const pool = OBJ_SHAPES.filter(([, sh]) => (L === 1 ? SHAPES.slice(0, 3) : SHAPES).includes(sh));
      const [e, sh, nm] = pick(pool); this.obj = { e, nm };
      this.target = { shape: sh, color: null }; this.qkey = `benda:${nm}`;
      const others = shuffle(SHAPES.filter((x) => x !== sh && (L > 1 || SHAPES.slice(0, 3).includes(x)))).slice(0, L === 1 ? 2 : 3);
      opts = [{ shape: sh }, ...others.map((x) => ({ shape: x }))];
    }
    const cols = shuffle(SHAPE_COLORS.slice());
    opts = shuffle(opts); const n = opts.length; const sp = n === 3 ? 2.4 : 2.0;
    opts.forEach((o, i) => { const c = this.makeCard(o.shape, o.color || cols[i], (i - (n - 1) / 2) * sp); c.userData.correct = o.shape === this.target.shape && (!this.target.color || o.color === this.target.color); });
    if (this.obj) { this.drawBoard(this.obj.e); say(pick([`Lihat papan, ada ${this.obj.nm}. Bentuknya apa?`, `${cap(this.obj.nm)} ini bentuknya seperti apa, ya?`]), { stay: true }); }
    else if (L === 4) { this.drawBoard('', shape, true); say('Lihat bayangan di papan. Bentuk mana yang cocok?', { stay: true }); }
    else if (L === 3) { this.drawBoard(`${shape} ${color}`); say(`Mana ${shape} yang warnanya ${color}?`, { stay: true }); }
    else { this.drawBoard(shape); say(pick([`Mana ${shape}?`, `Coba cari ${shape}, yuk!`, `Bentuk ${shape} ada di mana, ya?`]), { stay: true }); }
  }
  choose(g) {
    if (!this.active || this.round.solved) { hop(g, 0.3); return; }
    const { shape, color } = g.userData; const T = this.target; hop(g, 0.4); SFX.tap();
    if (shape === T.shape && (!T.color || color === T.color)) {
      if (!this.secret) this.drawBoard('', shape, false);
      this.success(this.obj ? `${pick(YAY)} ${cap(this.obj.nm)} bentuknya ${shape}!` : `${pick(YAY)} Itu ${shape}. ${cap(SHAPE_HINT[shape])}.`);
      return;
    }
    this.error(); wiggle(g);
    const want = T.color ? `${T.shape} ${T.color}` : T.shape;
    if (this.level === 3 && shape === T.shape) say(`Bentuknya sudah betul, ${shape}! Tapi warnanya ${color}. Cari yang ${T.color}, ya.`, { stay: true });
    else if (this.level === 4) say(`Itu ${shape}, ${SHAPE_HINT[shape]}. Lihat lagi bayangannya, ya.`, { stay: true });
    else say(`Itu ${shape}, ${SHAPE_HINT[shape]}. Kita cari ${want}. ${cap(T.shape)} itu ${SHAPE_HINT[T.shape]}.`, { stay: true });
  }
}

/* =========================================================
   ZONA 6 — KOLAM IKAN (membandingkan banyak/sedikit)
   ========================================================= */
const FISH_COLORS = ['#ff8a2a', '#ffd23a', '#ff8fc0', '#7cc8f5', '#e8434b'];
function makeFish(color, s = 1) {
  const f = new THREE.Group(); f.scale.setScalar(s);
  box(0.5, 0.24, 0.3, color, 0, 0, 0, f); box(0.16, 0.08, 0.34, color, -0.33, 0, 0, f);
  box(0.07, 0.07, 0.07, '#1d2238', 0.16, 0.1, 0.1, f, false); box(0.07, 0.07, 0.07, '#1d2238', 0.16, 0.1, -0.1, f, false);
  return f;
}
class Ikan extends Zone {
  constructor() { super('ikan', 'Kolam Ikan', '#6cc7f0', 'nelayan'); this.maxLevel = 4; }
  answerText() { return this.fishing ? `${NUM[this.N]} ikan` : `ember yang berisi ${NUM[this.answerCount]} ikan`; }
  build() {
    const g = this.group;
    for (let i = -4; i <= 4; i++) for (let j = 0; j < 3; j++) box(1, 0.12, 1, '#4cb4ea', i, 0.06, -3.6 + j, g, false).receiveShadow = true;
    for (let i = -5; i <= 5; i++) { box(1, 0.4, 1, '#b9b3a6', i, 0.2, -5.1, g); box(1, 0.4, 1, '#b9b3a6', i, 0.2, -0.6, g); }
    for (let j = 0; j < 3; j++) { box(1, 0.4, 1, '#b9b3a6', -5, 0.2, -3.6 + j, g); box(1, 0.4, 1, '#b9b3a6', 5, 0.2, -3.6 + j, g); }
    this.swim = [];
    for (let i = 0; i < 6; i++) {
      const f = makeFish(pick(FISH_COLORS), 1.1); f.position.y = 0.16; g.add(f);
      const ph = rand(0, 6.28), sp = rand(0.5, 0.9) * pick([-1, 1]);
      f.userData = { ph, sp, tap: () => { hop(f, 0.6, 0.4); SFX.pop(); } };
      hitBox(0.9, 0.6, 0.6, 0, 0, 0, f); this.swim.push(f);
    }
    // pancing di tepi
    box(0.12, 3.2, 0.12, '#8a5a35', 4.4, 1.6, -0.5, g).rotation.z = 0.5;
    this.boardTex = makeBoard(g, -3.6, -5.8, 2.2, 1.5, 3.2);
    this.drawBoard('?');
    this.makeIcon((ic) => { const f = makeFish('#ff8a2a', 2.6); ic.add(f); });
  }
  tick(t) {
    for (const f of this.swim) {
      const k = t * f.userData.sp + f.userData.ph;
      f.position.x = Math.sin(k) * 3.6; f.position.z = -2.6 + Math.sin(k * 2) * 0.7;
      f.rotation.y = Math.atan2(-Math.cos(k * 2) * 1.4 * f.userData.sp, Math.cos(k) * 3.6 * f.userData.sp);
    }
  }
  drawBoard(text, dots = 0) {
    const { g, canvas } = this.boardTex.userData; const W = canvas.width, H = canvas.height;
    g.fillStyle = '#fff6df'; g.fillRect(0, 0, W, H);
    g.fillStyle = '#1d2b53'; g.textAlign = 'center'; g.textBaseline = 'middle';
    g.font = `800 ${text.length > 4 ? 60 : 140}px ${FONT}`; g.fillText(text, W / 2, dots ? H * 0.4 : H / 2 + 6);
    for (let i = 0; i < dots; i++) { g.fillStyle = '#ff8a2a'; g.beginPath(); g.arc(W / 2 + (i - (dots - 1) / 2) * 40, H * 0.8, 14, 0, 7); g.fill(); }
    this.boardTex.needsUpdate = true;
  }
  makeTray(count, x) {
    const g = new THREE.Group(); g.position.set(x, 0, 1.0);
    box(2.2, 0.5, 1.6, '#3a7cf5', 0, 0.25, 0, g); box(2.0, 0.06, 1.4, '#9fd8f5', 0, 0.52, 0, g, false);
    const color = pick(FISH_COLORS); g.userData = { count, fish: [], baseY: 0 };
    for (let i = 0; i < count; i++) {
      const f = makeFish(color, 1.05); f.position.set(-0.62 + (i % 3) * 0.62, 0.68, -0.34 + Math.floor(i / 3) * 0.68); f.rotation.y = rand(-0.2, 0.2);
      g.add(f); g.userData.fish.push(f);
    }
    hitBox(2.4, 1.3, 1.9, 0, 0.6, 0, g);
    g.userData.tap = () => this.choose(g);
    this.temp.add(g); this.trays.push(g); return g;
  }
  startRound() {
    const L = this.level; this.trays = []; this.fishing = false;
    // variasi: pancing tepat N ikan dari kolam ke ember
    if (Math.random() < 0.35) return this.startFishing(L);
    const distinct = (n, lo, hi, gap) => { let a; do { a = Array.from({ length: n }, () => randi(lo, hi)); } while (new Set(a).size < n || Math.min(...a.flatMap((x, i) => a.slice(i + 1).map((y) => Math.abs(x - y)))) < gap); return a; };
    if (L <= 2) {
      this.ask = L === 1 ? 'banyak' : 'sedikit';
      distinct(2, 1, 5, 2).forEach((c, i) => this.makeTray(c, i ? 1.7 : -1.7));
      this.drawBoard(L === 1 ? 'lebih banyak' : 'lebih sedikit');
      say(L === 1 ? 'Ember mana yang ikannya lebih banyak?' : 'Sekarang, ember mana yang ikannya lebih sedikit?', { stay: true });
    } else if (L === 3) {
      this.ask = pick(['banyak', 'sedikit']);
      distinct(3, 1, 6, 1).forEach((c, i) => this.makeTray(c, (i - 1) * 2.7));
      this.drawBoard(this.ask === 'banyak' ? 'paling banyak' : 'paling sedikit');
      say(`Ada tiga ember. Mana yang ikannya paling ${this.ask}?`, { stay: true });
    } else {
      this.ask = 'sama';
      const c = distinct(3, 1, 6, 1); this.N = c[0];
      shuffle(c).forEach((v, i) => this.makeTray(v, (i - 1) * 2.7));
      this.drawBoard(String(this.N), this.N);
      say(`Lihat papan. Ember mana yang ikannya sama banyak, ada ${NUM[this.N]}?`, { stay: true });
    }
    const counts = this.trays.map((t) => t.userData.count); this.qkey = `${this.ask}:${counts.join('-')}`;
    this.answerCount = this.ask === 'banyak' ? Math.max(...counts) : this.ask === 'sedikit' ? Math.min(...counts) : this.N;
    this.trays.forEach((tr) => (tr.userData.correct = tr.userData.count === this.answerCount));
  }
  startFishing(L) {
    this.fishing = true; this.ask = 'pancing';
    const [a, b] = [[1, 3], [2, 5], [3, 6], [3, 6]][L - 1]; const N = randi(a, b); this.N = this.answerCount = N; this.qkey = `pancing:${N}`;
    const bucket = this.makeTray(0, 0); bucket.userData.tap = () => {}; this.bucket = bucket; this.caught = [];
    const color = pick(FISH_COLORS);
    for (let i = 0; i < N + randi(2, 3); i++) {
      const f = makeFish(color, 1.1); const home = new THREE.Vector3(rand(-3.8, 3.8), 0.28, rand(-3.4, -1.8));
      f.position.copy(home); f.rotation.y = rand(0, 6); hitBox(0.9, 0.7, 0.7, 0, 0, 0, f);
      f.userData = { home, baseY: 0.28, inB: false }; f.userData.tap = () => this.tapCatch(f); this.temp.add(f);
    }
    this.drawBoard(String(N), N);
    say(this.visitRounds ? pick([`Pancing ${NUM[N]} ikan!`, `Sekarang tangkap ${NUM[N]} ikan, ya.`]) : `Ayo memancing! Ketuk ikan di kolam, tangkap ${NUM[N]} ikan ke ember. Kalau sudah, ketuk Sudah!`, { stay: true });
    showAction('Sudah!', () => this.checkFishing());
  }
  slotInBucket(i) { return this.bucket.position.clone().add(new THREE.Vector3(-0.62 + (i % 3) * 0.62, 0.68, -0.34 + Math.floor(i / 3) * 0.68)); }
  tapCatch(f) {
    if (!this.active || this.round.solved || f.userData.busy) return;
    f.userData.busy = true; const u = f.userData;
    if (!u.inB) {
      if (this.caught.length >= 6) { u.busy = false; say('Embernya sudah penuh!', { stay: true }); return; }
      u.inB = true; this.caught.push(f); SFX.pop(); speak(NUM[this.caught.length]);
      flyTo(f, this.slotInBucket(this.caught.length - 1), { height: 1.6 }).then(() => { u.busy = false; f.rotation.y = 0; });
    } else {
      u.inB = false; this.caught.splice(this.caught.indexOf(f), 1); SFX.whoosh();
      speak(this.caught.length ? `Sekarang ${NUM[this.caught.length]}` : 'Embernya kosong');
      this.caught.forEach((c, i) => flyTo(c, this.slotInBucket(i), { height: 0.2, dur: 0.25 }));
      flyTo(f, u.home, { height: 1.2 }).then(() => (u.busy = false));
    }
  }
  checkFishing() {
    if (this.round.solved) return;
    const n = this.caught.length, N = this.N;
    if (n === N) { this.caught.forEach((f, i) => setTimeout(() => hop(f, 0.6, 0.4), i * 90)); this.success(`${pick(YAY)} Ada ${NUM[N]} ikan di ember.`); return; }
    if (n === 0) { say(`Embernya masih kosong. Ketuk ikan di kolam, ya!`, { stay: true }); return; }
    if (this.error()) return;
    say(n < N ? `Baru ${NUM[n]} ikan. Kita perlu ${NUM[N]}. Pancing lagi!` : `Ada ${NUM[n]}, kebanyakan! Ketuk ikan di ember untuk melepasnya ke kolam.`, { stay: true });
  }
  hintText() { return this.fishing ? `Kita perlu ${NUM[this.N]} ikan. Di ember ada ${NUM[this.caught.length]}.` : null; }
  async choose(tray) {
    if (!this.active || this.round.solved || this.busy) return;
    hop(tray, 0.3); SFX.tap();
    const c = tray.userData.count;
    if (c === this.answerCount) {
      if (!this.secret) tray.userData.fish.forEach((f, i) => setTimeout(() => hop(f, 0.6, 0.4), i * 80));
      const msg = this.ask === 'sama' ? `Ember ini ada ${NUM[c]} ikan, sama banyak!` : `Ember ini ada ${NUM[c]} ikan. ${this.trays.length > 2 ? 'Paling' : 'Lebih'} ${this.ask}!`;
      this.success(`${pick(YAY)} ${msg}`);
      return;
    }
    if (this.error()) return; this.busy = true; const t = this.token;
    say(`${pick(OOPS)} Yuk, kita hitung ikannya.`, { stay: true });
    await afterSpeech(3000);
    for (const tr of this.trays) {
      for (let i = 0; i < tr.userData.fish.length; i++) {
        if (!this.alive(t)) { this.busy = false; return; }
        hop(tr.userData.fish[i], 0.4, 0.3); speak(NUM[i + 1]); await wait(620);
      }
      await wait(450);
    }
    this.busy = false;
    if (!this.alive(t)) return;
    const q = this.ask === 'sama' ? `Jadi, ember mana yang ada ${NUM[this.N]} ikan?` : `Jadi, mana yang ${this.trays.length > 2 ? 'paling' : 'lebih'} ${this.ask}?`;
    say(q, { stay: true });
  }
}

/* =========================================================
   ZONA 7 — PANGGUNG MUSIK (mengingat urutan nada)
   ========================================================= */
const PADS = [['merah', 262], ['kuning', 330], ['hijau', 392], ['biru', 523]];
class Musik extends Zone {
  constructor() { super('musik', 'Panggung Musik', '#ffd166', 'headphone'); this.maxLevel = 4; }
  build() {
    const g = this.group;
    box(10, 0.4, 4.2, '#b5733b', 0, 0.2, -2.4, g);
    for (let i = -5; i <= 5; i++) box(0.9, 4.2, 0.3, i % 2 ? '#c8323a' : '#e8434b', i * 0.92, 2.1, -4.6, g);
    box(10.6, 0.6, 0.5, '#ffd23a', 0, 4.4, -4.5, g);
    for (const x of [-5.2, 5.2]) { box(0.8, 1.6, 0.8, '#2c2f3a', x, 0.8, -3.2, g); box(0.5, 0.5, 0.06, '#555b70', x, 1.2, -2.78, g, false); }
    this.pads = PADS.map(([nm, f], i) => {
      const p = new THREE.Group(); p.position.set(-3.3 + i * 2.2, 0.4, -2.0); g.add(p);
      const c = new THREE.Color(COLORS[nm]);
      box(1.6, 0.7, 1.6, '#' + c.clone().offsetHSL(0, 0, -0.18).getHexString(), 0, 0.35, 0, p);
      const topM = new THREE.MeshLambertMaterial({ color: COLORS[nm], emissive: '#ffffff', emissiveIntensity: 0 });
      const top = new THREE.Mesh(BOX, topM); top.scale.set(1.45, 0.22, 1.45); top.position.y = 0.8; top.castShadow = true; p.add(top);
      hitBox(1.9, 1.6, 1.9, 0, 0.6, 0, p);
      const masc = emojiSprite(['🐱', '🐥', '🐸', '🐳'][i], 1.0); masc.position.y = 1.7; p.add(masc);
      p.userData = { i, f, topM, baseY: 0.4, masc }; p.userData.tap = () => this.tapPad(p);
      return p;
    });
    this.makeIcon((ic) => { box(1.2, 0.6, 1.2, '#e8434b', 0, -0.3, 0, ic); box(1.0, 0.2, 1.0, '#ffffff', 0, 0.1, 0, ic); box(0.12, 1.0, 0.12, '#ffd23a', 0.4, 0.6, 0, ic).rotation.z = -0.5; });
  }
  flash(p) {
    SFX.note(p.userData.f); hop(p, 0.25, 0.28);
    const m = p.userData.topM; tween(0.45, (k) => (m.emissiveIntensity = 0.75 * (1 - k)));
    const ms = p.userData.masc; tween(0.4, (k) => { ms.scale.setScalar(1 + Math.sin(k * Math.PI) * 0.5); ms.material.rotation = Math.sin(k * Math.PI * 2) * 0.3; }); // maskot ikut menari
  }
  async play(t) {
    this.state = 'listen';
    for (const i of this.seq) { if (!this.alive(t)) return; this.flash(this.pads[i]); await wait(this.level >= 3 ? 620 : 750); }
    if (!this.alive(t)) return;
    this.state = 'play'; this.pos = 0;
    say(pick(['Sekarang giliranmu!', 'Ayo, giliranmu!', 'Nah, sekarang kamu yang main!']), { stay: true });
  }
  async startRound(t) {
    const n = this.level + 1; this.seq = [];
    while (this.seq.length < n) { const i = randi(0, 3); if (this.seq.length >= 2 && this.seq.at(-1) === i && this.seq.at(-2) === i) continue; this.seq.push(i); }
    this.state = 'listen'; this.qkey = this.seq.join('');
    say(n === 2 ? 'Dengarkan dan lihat baik-baik, ya. Ada dua nada!' : `Dengarkan baik-baik. Ada ${NUM[n]} nada!`, { stay: true });
    await afterSpeech(4000); await wait(300);
    if (this.alive(t)) this.play(t);
  }
  giveHint() { this.lastAct = performance.now(); if (this.state !== 'play') return; this.round.hinted = true; say('Dengarkan sekali lagi, ya!', { stay: true }); const t = this.token; afterSpeech(3000).then(() => this.alive(t) && this.play(t)); }
  async tapPad(p) {
    if (!this.active || !this.round) { this.flash(p); return; }
    if (this.round.solved || this.state !== 'play') return;
    this.flash(p);
    if (p.userData.i === this.seq[this.pos]) {
      this.pos++;
      if (this.pos === this.seq.length) { this.state = 'done'; await wait(400); this.success(`${pick(YAY)} Nadanya sama persis. Telingamu hebat!`); }
      return;
    }
    this.error(); this.state = 'listen'; const t = this.token;
    say(pick(['Hmm, hampir! Dengarkan sekali lagi, ya.', 'Eh, nadanya beda. Yuk, dengar lagi.']), { stay: true });
    await afterSpeech(3500); await wait(300);
    if (this.alive(t)) this.play(t);
  }
}

/* =========================================================
   ZONA 8 — KARTU KEMBAR (daya ingat, mencari pasangan)
   ========================================================= */
const PICS = [['🍎', 'apel'], ['🍌', 'pisang'], ['🐟', 'ikan'], ['🐱', 'kucing'], ['🐶', 'anjing'], ['🚗', 'mobil'], ['⚽', 'bola'], ['🌸', 'bunga'], ['🌙', 'bulan'], ['⭐', 'bintang'], ['🐘', 'gajah'], ['🦋', 'kupu-kupu']];
const picTex = new Map();
const CARD_PLANE = new THREE.PlaneGeometry(0.9, 0.9);
let cardBackTex = null;
class Kembar extends Zone {
  constructor() { super('kembar', 'Kartu Kembar', '#8fd3c9', 'penyihir'); this.maxLevel = 4; }
  build() {
    const g = this.group;
    box(8.4, 0.2, 4.6, '#c98f52', 0, 0.8, -1.7, g);
    for (const [x, z] of [[-3.9, -3.7], [3.9, -3.7], [-3.9, 0.3], [3.9, 0.3]]) box(0.3, 0.8, 0.3, '#8a5a35', x, 0.4, z, g);
    for (let i = 0; i < 4; i++) box(1.1, 0.1, 1.1, ['#7c5cd6', '#5aa0e0', '#7c5cd6', '#5aa0e0'][i], 4.9 + (i % 2) * 0.05, 0.05 + i * 0.1, -4.2, g).rotation.y = i * 0.2;
    cardBackTex = cardBackTex || canvasTex(128, 128, (c) => {
      c.fillStyle = '#7c5cd6'; c.fillRect(0, 0, 128, 128); c.fillStyle = '#9a7ef0';
      for (let i = 0; i < 4; i++) for (let j = 0; j < 4; j++) if ((i + j) % 2) c.fillRect(i * 32, j * 32, 32, 32);
      c.fillStyle = '#fff'; c.font = `800 80px ${FONT}`; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText('?', 64, 70);
    });
    this.makeIcon((ic) => { box(0.9, 1.2, 0.12, '#7c5cd6', -0.35, 0, 0, ic).rotation.z = 0.2; box(0.9, 1.2, 0.12, '#ffffff', 0.35, 0, 0.1, ic).rotation.z = -0.2; });
  }
  // face: emoji, angka/huruf, atau titik-titik; key: kunci pasangan
  makeCard([emoji, name, key = emoji], x, z) {
    if (!picTex.has(emoji)) picTex.set(emoji, /^[\p{Extended_Pictographic}]/u.test(emoji) ? emojiTex(emoji, '#ffffff') : canvasTex(256, 256, (g) => {
      g.fillStyle = '#fff6df'; rrect(g, 0, 0, 256, 256, 44); g.fill(); g.fillStyle = '#1d2b53'; g.textAlign = 'center'; g.textBaseline = 'middle';
      if (emoji.startsWith('•')) { const n = emoji.length; for (let i = 0; i < n; i++) { const r = Math.floor(i / 3), c = i % 3, cols = Math.min(3, n - r * 3); g.fillStyle = '#ff8a2a'; g.beginPath(); g.arc(128 + (c - (cols - 1) / 2) * 62, 128 + (r - (Math.ceil(n / 3) - 1) / 2) * 62, 24, 0, 7); g.fill(); } }
      else { g.font = `800 170px ${FONT}`; g.fillText(emoji, 128, 140); }
    }));
    const g = new THREE.Group(); g.position.set(x, 0.95, z);
    box(1.0, 0.1, 1.0, '#ffffff', 0, 0, 0, g);
    const back = new THREE.Mesh(CARD_PLANE, new THREE.MeshLambertMaterial({ map: cardBackTex })); back.rotation.x = -Math.PI / 2; back.position.y = 0.056; g.add(back);
    const front = new THREE.Mesh(CARD_PLANE, new THREE.MeshLambertMaterial({ map: picTex.get(emoji) })); front.rotation.x = -Math.PI / 2; front.position.y = 0.056; front.visible = false; g.add(front);
    hitBox(1.15, 0.5, 1.15, 0, 0.1, 0, g);
    g.userData = { name, emoji, key, back, front, up: false, done: false, baseY: 0.95 };
    g.userData.tap = () => this.tapCard(g);
    this.temp.add(g); return g;
  }
  async flip(c, up) {
    c.userData.up = up;
    await tween(0.12, (k) => (c.scale.x = 1 - k));
    c.userData.front.visible = up; c.userData.back.visible = !up;
    hop(c, 0.25, 0.24);
    await tween(0.12, (k) => (c.scale.x = k));
  }
  async startRound(t) {
    const P = [2, 3, 4, 6][this.level - 1];
    const cols = P === 2 ? 4 : P === 3 ? 3 : 4; const rows = Math.ceil((P * 2) / cols);
    // variasi tingkat 3+: pasangkan angka dengan titik, atau huruf besar dengan huruf kecil
    const mode = this.level >= 3 && Math.random() < 0.4 ? pick(['angka', 'huruf']) : 'gambar'; this.pairMode = mode;
    let deck, items;
    if (mode === 'angka') { items = shuffle([1, 2, 3, 4, 5, 6]).slice(0, P); deck = shuffle(items.flatMap((n) => [[String(n), `angka ${NUM[n]}`, `n${n}`], ['•'.repeat(n), `${NUM[n]} titik`, `n${n}`]])); }
    else if (mode === 'huruf') { items = shuffle([...'ABDEIKMOSU']).slice(0, P); deck = shuffle(items.flatMap((L) => [[L, `huruf ${L} besar`, L], [L.toLowerCase(), `huruf ${L} kecil`, L]])); }
    else { items = shuffle(PICS.slice()).slice(0, P); deck = shuffle([...items, ...items]); }
    this.qkey = `${mode}:${items.map((x) => (Array.isArray(x) ? x[1] : x)).sort().join(',')}`;
    this.cards = []; this.open = []; this.misses = 0; this.busy = true;
    deck.forEach((it, i) => {
      const r = Math.floor(i / cols), c = i % cols;
      this.cards.push(this.makeCard(it, (c - (cols - 1) / 2) * 1.3, -1.7 + (r - (rows - 1) / 2) * 1.3));
    });
    const peek = [2600, 2600, 1800, 0][this.level - 1];
    if (peek) {
      say('Lihat gambarnya dulu, ya. Ingat-ingat tempatnya!', { stay: true });
      this.cards.forEach((c) => this.flip(c, true));
      await wait(peek + 600);
      if (!this.alive(t)) return;
      this.cards.forEach((c) => this.flip(c, false));
      await wait(300);
    }
    this.busy = false;
    if (this.alive(t)) say(mode === 'angka' ? `Pasangkan angka dengan titik yang jumlahnya sama! Ada ${NUM[P]} pasang.` : mode === 'huruf' ? `Pasangkan huruf besar dengan huruf kecilnya! Ada ${NUM[P]} pasang.`
      : P === 2 ? 'Cari dua gambar yang sama. Ketuk kartu untuk membukanya!' : `Cari pasangan gambar yang sama. Ada ${NUM[P]} pasang!`, { stay: true });
  }
  // bantuan: intip satu pasangan sebentar
  giveHint() {
    this.lastAct = performance.now(); if (this.busy || this.open.length) return;
    const left = this.cards.filter((c) => !c.userData.done); const a = left[0]; if (!a) return;
    const b = left.find((c) => c !== a && c.userData.key === a.userData.key); if (!b) return;
    this.round.hinted = true; this.busy = true; const t = this.token;
    say('Kak Rara intip sebentar, ya. Ingat dua kartu ini!', { stay: true });
    Promise.all([this.flip(a, true), this.flip(b, true)]).then(() => wait(1600)).then(() => { if (!this.alive(t)) return; return Promise.all([this.flip(a, false), this.flip(b, false)]); }).then(() => { this.busy = false; });
  }
  async tapCard(c) {
    const u = c.userData;
    if (!this.active || this.round.solved || this.busy || u.done || u.up) return;
    SFX.tap(); await this.flip(c, true); speak(u.name);
    this.open.push(c);
    if (this.open.length < 2) return;
    const [a, b] = this.open; this.open = [];
    if (a.userData.key === b.userData.key) {
      a.userData.done = b.userData.done = true; SFX.pop();
      burst(this.group.position.clone().add(a.position).add(new THREE.Vector3(0, 0.5, 0)));
      if (this.cards.every((x) => x.userData.done)) {
        this.round.errors = this.misses > this.cards.length / 2 + 1 ? 1 : 0;
        this.success(`${pick(YAY)} Semua pasangan ketemu. Ingatanmu kuat!`);
      } else say(this.pairMode !== 'gambar' ? `Cocok! ${cap(a.userData.name)} dan ${b.userData.name}.` : pick([`Sama! Dua ${a.userData.name}.`, `Ketemu! ${cap(a.userData.name)} dan ${a.userData.name}.`, `Nah, pasangan ${a.userData.name}!`]), { stay: true });
      return;
    }
    this.busy = true; this.misses++; SFX.soft(); const t = this.token;
    if (this.misses % 3 === 1) say(`${cap(a.userData.name)} dan ${b.userData.name}. Belum sama. Ingat tempatnya, ya!`, { stay: true });
    await wait(1300);
    if (!this.alive(t)) return;
    await Promise.all([this.flip(a, false), this.flip(b, false)]);
    this.busy = false;
  }
}

/* =========================================================
   ZONA 9 — TANGGA UKURAN (mengurutkan pendek-tinggi)
   ========================================================= */
const ORDINAL = ['Pertama', 'Kedua', 'Ketiga', 'Keempat', 'Kelima', 'Keenam'];
const TOWER_COLORS = ['#e8434b', '#ff8a2a', '#ffd23a', '#3fb25a', '#3a7cf5', '#9a62e0'];
class Ukuran extends Zone {
  constructor() { super('ukuran', 'Tangga Ukuran', '#e0b080', 'tinggi'); this.maxLevel = 4; }
  build() {
    const g = this.group;
    for (let i = 0; i < 6; i++) box(1.1, 0.5 * (i + 1), 1.1, ['#f4a261', '#e9c46a', '#f4a261', '#e9c46a', '#f4a261', '#e9c46a'][i], -3.3 + i * 1.3, 0.25 * (i + 1), -4.6, g);
    // jerapah balok sebagai lambang "tinggi"
    const j = new THREE.Group(); j.position.set(4.6, 0, -2.6); g.add(j);
    for (const [x, z] of [[-0.25, 0.3], [0.25, 0.3], [-0.25, -0.3], [0.25, -0.3]]) box(0.2, 1.2, 0.2, '#f2c14e', x, 0.6, z, j);
    box(0.8, 0.7, 1.0, '#f2c14e', 0, 1.5, 0, j); box(0.3, 1.8, 0.3, '#f2c14e', 0, 2.6, 0.35, j); box(0.4, 0.4, 0.7, '#f2c14e', 0, 3.6, 0.5, j);
    box(0.2, 0.2, 0.2, '#b5733b', -0.2, 1.6, 0.42, j, false); box(0.2, 0.2, 0.2, '#b5733b', 0.25, 1.3, 0.3, j, false); eyes(j, 3.7, 0.86, 0.12, 0.08);
    this.makeIcon((ic) => [0.4, 0.8, 1.2].forEach((h, i) => box(0.5, h, 0.5, ['#e8434b', '#ffd23a', '#3a7cf5'][i], -0.6 + i * 0.6, -0.6 + h / 2, 0, ic)));
  }
  startRound() {
    const L = this.level;
    // variasi cepat: mana yang paling tinggi / paling pendek?
    this.most = Math.random() < (L <= 2 ? 0.4 : 0.2) ? pick(['tinggi', 'pendek']) : null;
    if (this.most) {
      const hs = shuffle([1, 2, 3, 4, 5, 6]).slice(0, L <= 2 ? 3 : 4); const want = this.most === 'tinggi' ? Math.max(...hs) : Math.min(...hs);
      this.qkey = `${this.most}:${hs.join('')}`; const cols = shuffle(TOWER_COLORS.slice());
      hs.forEach((h, i) => {
        const g = new THREE.Group(); g.position.set((i - (hs.length - 1) / 2) * 2.2, 0, -1.6);
        for (let k = 0; k < h; k++) box(0.8, 0.5, 0.8, cols[i], 0, 0.25 + k * 0.52, 0, g);
        eyes(g, h * 0.52 - 0.18, 0.42, 0.14, 0.1); hitBox(1.3, h * 0.52 + 0.4, 1.3, 0, (h * 0.52) / 2, 0, g);
        g.userData = { h, baseY: 0, correct: h === want }; g.userData.tap = () => this.pickMost(g, want); this.temp.add(g);
      });
      say(pick([`Mana menara yang paling ${this.most}?`, `Cepat! Ketuk menara yang paling ${this.most}!`]), { stay: true });
      return;
    }
    const n = [3, 4, 5, 5][L - 1]; this.desc = L === 4;
    const hs = shuffle([1, 2, 3, 4, 5, 6]).slice(0, n);
    this.order = hs.slice().sort((a, b) => (this.desc ? b - a : a - b)); this.pos = 0; this.qkey = hs.join('');
    const cols = shuffle(TOWER_COLORS.slice());
    const sp = 1.45; this.slots = [];
    for (let i = 0; i < n; i++) { const x = (i - (n - 1) / 2) * sp; box(1.1, 0.12, 1.1, '#fff6df', x, 0.06, 1.2, this.temp, false); this.slots.push(new THREE.Vector3(x, 0, 1.2)); }
    hs.forEach((h, i) => {
      const g = new THREE.Group(); const x = (i - (n - 1) / 2) * 1.6; g.position.set(x, 0, -2.0);
      for (let k = 0; k < h; k++) box(0.8, 0.5, 0.8, cols[i], 0, 0.25 + k * 0.52, 0, g);
      eyes(g, h * 0.52 - 0.18, 0.42, 0.14, 0.1);
      hitBox(1.2, h * 0.52 + 0.4, 1.2, 0, (h * 0.52) / 2, 0, g);
      g.userData = { h, baseY: 0, done: false }; g.userData.tap = () => this.tapTower(g);
      this.temp.add(g);
    });
    say(this.desc ? 'Sekarang kebalikannya! Susun dari yang paling tinggi sampai yang paling pendek.'
      : L === 1 ? 'Susun menaranya dari yang paling pendek sampai yang paling tinggi. Ketuk yang paling pendek dulu!'
        : 'Ketuk dari yang paling pendek, lalu yang lebih tinggi, terus sampai yang paling tinggi!', { stay: true });
  }
  pickMost(g, want) {
    if (!this.active || this.round.solved) return;
    hop(g, 0.4); SFX.tap();
    if (g.userData.h === want) { this.success(`${pick(YAY)} Itu yang paling ${this.most}!`); return; }
    if (this.error()) return; wiggle(g); say(`Hmm, masih ada yang lebih ${this.most} dari itu. Bandingkan, ya!`, { stay: true });
  }
  hintTargets() { return this.most ? super.hintTargets() : this.temp.children.filter((g) => g.userData?.h === this.order?.[this.pos] && !g.userData.done); }
  async tapTower(g) {
    if (!this.active || this.round.solved || g.userData.done || this.busy) { hop(g, 0.2); return; }
    SFX.tap();
    if (g.userData.h === this.order[this.pos]) {
      g.userData.done = true; this.busy = true; const i = this.pos++;
      speak(`${ORDINAL[i]}!`);
      await flyTo(g, this.slots[i], { height: 1.2 }); this.busy = false;
      if (this.pos === this.order.length) this.success(`${pick(YAY)} Dari yang paling ${this.desc ? 'tinggi' : 'pendek'} sampai paling ${this.desc ? 'pendek' : 'tinggi'}. Rapi sekali!`);
      return;
    }
    this.error(); wiggle(g);
    say(this.desc ? 'Hmm, masih ada yang lebih tinggi dari itu. Cari yang paling tinggi, ya.' : 'Hmm, masih ada yang lebih pendek dari itu. Cari yang paling pendek, ya.', { stay: true });
  }
}

/* =========================================================
   ZONA 10 — RUMAH PERASAAN (mengenal emosi)
   ========================================================= */
const EMO = ['senang', 'sedih', 'marah', 'takut', 'kaget'];
const EMO_HINT = {
  senang: 'Lihat, dia tersenyum lebar', sedih: 'Mulutnya melengkung ke bawah dan ada air mata',
  marah: 'Alisnya turun dan mukanya merah', takut: 'Matanya melotot dan mulutnya gemetar', kaget: 'Matanya bulat dan mulutnya terbuka, O',
};
const EMO_COPE = {
  senang: 'Kalau senang, kita bisa tersenyum dan berbagi cerita.', sedih: 'Kalau sedih, boleh menangis dan minta dipeluk Ayah atau Bunda.',
  marah: 'Kalau marah, tarik napas pelan-pelan. Satu, dua, tiga.', takut: 'Kalau takut, dekati orang yang kita sayang, ya.',
  kaget: 'Kalau kaget, tarik napas dulu, lalu lihat ada apa.',
};
const SCENES = [
  ['🎈', 'Balon Dodo terbang tinggi dan hilang.', 'sedih'], ['🎂', 'Hari ini Sasa ulang tahun, dapat kue besar!', 'senang'],
  ['🧱', 'Menara balok Bimo ditendang temannya.', 'marah'], ['⚡', 'Ada petir yang keras sekali. Duar!', 'takut'],
  ['🎁', 'Kotak dibuka, tiba-tiba ada badut melompat keluar!', 'kaget'], ['🧸', 'Ayah pulang membawa boneka baru.', 'senang'],
  ['🍦', 'Es krim Lala jatuh ke tanah.', 'sedih'], ['🌙', 'Kamar gelap, ada suara aneh.', 'takut'],
  ['🖍️', 'Adik mencoret-coret gambar Kiki.', 'marah'], ['🐶', 'Anak anjing datang dan menjilat pipi Tono.', 'senang'],
];
function emoFaceTex(emo, skin) {
  return canvasTex(256, 256, (g) => {
    g.fillStyle = skin; g.fillRect(0, 0, 256, 256);
    const ink = '#1d2238'; g.strokeStyle = ink; g.fillStyle = ink; g.lineCap = 'round'; g.lineWidth = 12;
    const cheek = (a) => { g.globalAlpha = a; g.fillStyle = '#ff6b7a'; g.beginPath(); g.arc(58, 160, 22, 0, 7); g.fill(); g.beginPath(); g.arc(198, 160, 22, 0, 7); g.fill(); g.globalAlpha = 1; g.fillStyle = ink; };
    const eye = (x, y, w, h) => { g.beginPath(); g.ellipse(x, y, w, h, 0, 0, 7); g.fill(); };
    const line = (x1, y1, x2, y2) => { g.beginPath(); g.moveTo(x1, y1); g.lineTo(x2, y2); g.stroke(); };
    if (emo === 'senang') {
      cheek(0.45); eye(88, 104, 13, 20); eye(168, 104, 13, 20);
      g.beginPath(); g.arc(128, 150, 46, 0.1 * Math.PI, 0.9 * Math.PI); g.stroke();
    } else if (emo === 'sedih') {
      eye(88, 112, 12, 16); eye(168, 112, 12, 16); line(64, 82, 104, 72); line(192, 82, 152, 72);
      g.beginPath(); g.arc(128, 200, 36, 1.15 * Math.PI, 1.85 * Math.PI); g.stroke();
      g.fillStyle = '#58b7ff'; g.beginPath(); g.moveTo(170, 132); g.quadraticCurveTo(186, 160, 170, 166); g.quadraticCurveTo(154, 160, 170, 132); g.fill();
    } else if (emo === 'marah') {
      cheek(0.8); eye(88, 116, 13, 14); eye(168, 116, 13, 14); g.lineWidth = 14; line(60, 76, 108, 98); line(196, 76, 148, 98); g.lineWidth = 12;
      g.beginPath(); g.arc(128, 196, 30, 1.2 * Math.PI, 1.8 * Math.PI); g.stroke();
    } else if (emo === 'takut') {
      g.fillStyle = '#fff'; eye(88, 108, 24, 26); eye(168, 108, 24, 26); g.fillStyle = ink; eye(88, 112, 8, 9); eye(168, 112, 8, 9);
      line(64, 68, 104, 62); line(192, 68, 152, 62);
      g.beginPath(); g.moveTo(90, 178); for (let i = 1; i <= 6; i++) g.lineTo(90 + i * 13, 178 + (i % 2 ? -10 : 0)); g.stroke();
    } else {
      g.fillStyle = '#fff'; eye(88, 108, 22, 24); eye(168, 108, 22, 24); g.fillStyle = ink; eye(88, 108, 10, 11); eye(168, 108, 10, 11);
      g.beginPath(); g.arc(88, 62, 22, 1.15 * Math.PI, 1.85 * Math.PI); g.stroke(); g.beginPath(); g.arc(168, 62, 22, 1.15 * Math.PI, 1.85 * Math.PI); g.stroke();
      g.beginPath(); g.ellipse(128, 180, 20, 26, 0, 0, 7); g.fill();
    }
  });
}
class Rasa extends Zone {
  constructor() { super('rasa', 'Rumah Perasaan', '#f49ac1', 'bunga'); this.maxLevel = 3; }
  answerText() { return this.target; }
  build() {
    const g = this.group;
    box(9, 3.2, 0.6, '#ffd6e7', 0, 1.6, -4.8, g); box(9.6, 0.5, 1.2, '#e86a9a', 0, 3.4, -4.7, g); box(7.6, 0.5, 1.0, '#e86a9a', 0, 3.9, -4.7, g);
    for (const x of [-3.2, 3.2]) { box(1.2, 1.0, 0.1, '#e8f6ff', x, 2.0, -4.45, g, false); box(1.4, 0.12, 0.2, '#ffffff', x, 1.45, -4.4, g, false); }
    box(0.4, 0.4, 0.1, '#e8434b', -0.9, 2.9, -4.45, g, false); box(0.4, 0.4, 0.1, '#e8434b', 0.9, 2.9, -4.45, g, false);
    this.boardTex = makeBoard(g, 0, -4.0, 1.8, 1.5, 2.2);
    this.drawBoard('😊');
    this.makeIcon((ic) => { box(1.0, 1.0, 1.0, '#ffd23a', 0, 0, 0, ic); box(0.16, 0.24, 0.06, '#1d2238', -0.22, 0.12, 0.51, ic, false); box(0.16, 0.24, 0.06, '#1d2238', 0.22, 0.12, 0.51, ic, false); box(0.5, 0.1, 0.06, '#1d2238', 0, -0.22, 0.51, ic, false); });
  }
  drawBoard(emoji) {
    const { g, canvas } = this.boardTex.userData; const W = canvas.width, H = canvas.height;
    g.fillStyle = '#fff6df'; g.fillRect(0, 0, W, H);
    g.textAlign = 'center'; g.textBaseline = 'middle'; g.font = `150px ${EMOJI_FONT}`; g.fillText(emoji, W / 2, H / 2 + 10);
    this.boardTex.needsUpdate = true;
  }
  makeFriend(emo, x, i) {
    const g = new THREE.Group(); g.position.set(x, 0, -0.4);
    const skin = SKINS[(i + this.token) % SKINS.length]; const shirt = pick(['#3a7cf5', '#3fb25a', '#ff8a2a', '#9a62e0', '#e8434b']);
    box(0.36, 0.7, 0.4, '#2c2f3a', -0.2, 0.35, 0, g); box(0.36, 0.7, 0.4, '#2c2f3a', 0.2, 0.35, 0, g);
    box(0.95, 0.85, 0.55, shirt, 0, 1.12, 0, g);
    const sk = mat(skin); const face = new THREE.MeshLambertMaterial({ map: emoFaceTex(emo, skin) });
    const head = new THREE.Mesh(BOX, [sk, sk, sk, sk, face, sk]); head.scale.setScalar(1.15); head.position.y = 2.1; head.castShadow = true; g.add(head);
    box(1.2, 0.25, 1.2, pick(['#3b2a20', '#2a1d16', '#6b4423', '#1d1d1d']), 0, 2.75, -0.02, g);
    hitBox(1.4, 3.0, 1.0, 0, 1.5, 0, g);
    g.userData = { emo, baseY: 0, correct: emo === this.target }; g.userData.tap = () => this.choose(g);
    this.temp.add(g); return g;
  }
  // variasi kebalikan: kejadian mana yang membuat orang merasa ...?
  startReverse() {
    const target = pick(['senang', 'sedih', 'marah', 'takut']); this.target = target; this.scene = null; this.reverse = true;
    const right = pick(SCENES.filter((x) => x[2] === target)); const wrong = shuffle(SCENES.filter((x) => x[2] !== target)).slice(0, 2);
    this.qkey = `balik:${right[1]}`; this.drawBoard(target === 'senang' ? '😊' : target === 'sedih' ? '😢' : target === 'marah' ? '😠' : '😨');
    shuffle([right, ...wrong]).forEach((sc, i) => {
      const card = new THREE.Group(); card.position.set((i - 1) * 2.6, 0, -0.4);
      box(1.6, 0.14, 1.6, '#fff6df', 0, 0.07, 0, card); const sp = emojiSprite(sc[0], 1.6); sp.position.y = 1.1; card.add(sp);
      hitBox(1.8, 2.2, 1.6, 0, 1.0, 0, card); card.userData = { baseY: 0, sc, correct: sc === right }; card.userData.tap = () => this.chooseScene(card); this.temp.add(card);
    });
    say(`Kejadian mana yang membuat orang merasa ${target}? Ketuk gambarnya. Mau tahu ceritanya? Ketuk saja!`, { stay: true });
  }
  chooseScene(card) {
    if (!this.active || this.round.solved) return;
    hop(card, 0.4); SFX.tap(); const sc = card.userData.sc;
    if (card.userData.correct) { this.success(`${pick(YAY)} ${sc[1]} Pasti merasa ${this.target}. ${EMO_COPE[this.target]}`); return; }
    if (this.error()) return; wiggle(card); say(`${sc[1]} Itu membuat merasa ${sc[2]}. Kita cari yang membuat ${this.target}.`, { stay: true });
  }
  startRound() {
    const L = this.level; this.reverse = false;
    if (L >= 2 && Math.random() < 0.3) return this.startReverse();
    let target, opts, scene = null;
    if (L === 3) {
      do { scene = pick(SCENES); } while (scene === this.lastScene && Math.random() < 0.9);
      this.lastScene = scene; target = scene[2];
      opts = [target, ...shuffle(EMO.filter((e) => e !== target)).slice(0, 2)];
    } else {
      const pool = L === 1 ? EMO.slice(0, 3) : EMO;
      do { target = pick(pool); } while (target === this.lastEmo && Math.random() < 0.9);
      opts = [target, ...shuffle(pool.filter((e) => e !== target)).slice(0, L === 1 ? 2 : 3)];
    }
    this.lastEmo = target; this.target = target; this.scene = scene; this.qkey = scene ? scene[1] : `${L}:${target}`;
    if (!scene) this.drawBoard('❓');
    opts = shuffle(opts); const n = opts.length; const sp = n === 3 ? 2.6 : 2.1;
    opts.forEach((e, i) => this.makeFriend(e, (i - (n - 1) / 2) * sp, i));
    if (scene) { this.drawBoard(scene[0]); say(`${scene[1]} Kira-kira, dia merasa apa? Ketuk wajahnya.`, { stay: true }); }
    else { this.drawBoard('❓'); say(pick([`Mana teman yang ${target}?`, `Coba cari wajah yang ${target}.`]), { stay: true }); }
  }
  choose(g) {
    if (!this.active || this.round.solved) { hop(g, 0.3); return; }
    const emo = g.userData.emo; hop(g, 0.4); SFX.tap();
    if (emo === this.target) { this.success(`${pick(YAY)} Dia merasa ${emo}. ${EMO_COPE[emo]}`); return; }
    this.error(); wiggle(g);
    if (this.scene) say(`Itu wajah ${emo}. Hmm, kalau itu terjadi padamu, kamu merasa apa, ya?`, { stay: true });
    else say(`Itu wajah ${emo}. ${EMO_HINT[emo]}. Kita cari yang ${this.target}.`, { stay: true });
  }
}

/* =========================================================
   ZONA 11 — RUMAH MENULIS (menebalkan garis, angka, huruf)
   ========================================================= */
const TRACE_SETS = ['garis', 'angka', 'vokal', 'huruf'];
class Tulis extends Zone {
  constructor() { super('tulis', 'Rumah Menulis', '#7ec4ff', 'pensil'); this.maxLevel = 4; this.kind = 'race'; }
  hintText() { return 'Lihat bintang yang bergerak. Taruh jarimu di titik hijau, lalu ikuti bintangnya pelan-pelan!'; }
  build() {
    const g = this.group;
    box(8.4, 3.4, 0.5, '#dff1ff', 0, 1.7, -5, g); box(9, 0.5, 1.4, '#3a7cf5', 0, 3.6, -4.8, g);
    box(5.2, 2.4, 0.2, '#8a5a35', 0, 1.9, -4.62, g);
    this.chalk = canvasTex(512, 236, () => {});
    const face = new THREE.MeshLambertMaterial({ map: this.chalk }); const wood = mat('#8a5a35');
    const b = new THREE.Mesh(BOX, [wood, wood, wood, wood, face, wood]); b.scale.set(4.9, 2.15, 0.1); b.position.set(0, 1.9, -4.48); g.add(b);
    // pensil raksasa
    const pen = new THREE.Group(); pen.position.set(4.6, 0, -2.4); pen.rotation.z = 0.15; g.add(pen);
    box(0.7, 3.2, 0.7, '#ffd23a', 0, 1.6, 0, pen); box(0.72, 0.4, 0.72, '#ff8fc0', 0, 3.4, 0, pen); box(0.5, 0.4, 0.5, '#f2d1a0', 0, -0.1, 0, pen); box(0.2, 0.3, 0.2, '#2c2f3a', 0, -0.4, 0, pen);
    for (const x of [-3.6, -2.2]) { box(1.2, 0.12, 0.8, '#c98f52', x, 0.8, -1.8, g); box(0.12, 0.8, 0.12, '#8a5a35', x - 0.5, 0.4, -1.8, g); box(0.12, 0.8, 0.12, '#8a5a35', x + 0.5, 0.4, -1.8, g); }
    this.drawChalk('Aa 12');
    this.makeIcon((ic) => { box(0.4, 1.8, 0.4, '#ffd23a', 0, 0, 0, ic).rotation.z = 0.6; box(0.42, 0.3, 0.42, '#ff8fc0', -0.68, 0.48, 0, ic).rotation.z = 0.6; });
  }
  drawChalk(text) {
    const { g } = this.chalk.userData;
    g.fillStyle = '#2f6b4f'; g.fillRect(0, 0, 512, 236);
    g.fillStyle = '#f4f4ea'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.font = `800 ${text.length > 3 ? 110 : 170}px ${FONT}`; g.fillText(text, 256, 128);
    this.chalk.needsUpdate = true;
  }
  startRound() {
    const set = TRACE_SETS[this.level - 1]; const item = pick(TRACE[set]); this.item = item; this.qkey = `${set}:${item.k}`;
    this.drawChalk(item.k.length <= 2 ? `${item.k}` : item.e || item.k);
    let line;
    if (set === 'garis') line = `Yuk, tebalkan ${item.k}, ${item.w}. Mulai dari titik hijau, ikuti panahnya!`;
    else if (set === 'angka') line = `Ini angka ${NUM[+item.k]}. Tebalkan angka ${NUM[+item.k]}, mulai dari titik hijau, ya!`;
    else line = `Ini huruf ${item.k}. ${item.k} untuk ${item.w}. Tebalkan hurufnya, mulai dari titik hijau!`;
    say(line, { stay: true });
    tracePad(item, {
      onStroke: (i) => { if (i < item.s.length - 1) { tone(880, 0.12, { type: 'triangle', vol: 0.12 }); speak(pick(['Bagus!', 'Rapi!', 'Terus!', 'Nah, begitu!'])); } },
      onOff: () => say('Mulai dari titik hijau, ya. Ikuti panah oranye.', { stay: true }),
      onDone: () => {
        closePad();
        const what = set === 'garis' ? item.k : set === 'angka' ? `angka ${NUM[+item.k]}` : `huruf ${item.k}`;
        this.success(`${pick(YAY)} Kamu sudah menulis ${what}.`);
      },
    });
  }
  onExit() { closePad(); }
}

/* =========================================================
   ZONA 12 — WARUNG HITUNG (tambah & kurang sederhana)
   ========================================================= */
const MTK_ITEMS = [['🍎', 'apel', 'diambil'], ['🍬', 'permen', 'dimakan'], ['🎈', 'balon', 'terbang'], ['🐥', 'anak ayam', 'pergi'], ['🍪', 'kue', 'dimakan'], ['🐟', 'ikan', 'berenang pergi'], ['⭐', 'bintang', 'hilang']];
const spriteMats = new Map();
function emojiSprite(e, s = 0.75) {
  if (!spriteMats.has(e)) {
    const t = canvasTex(128, 128, (g) => { g.textAlign = 'center'; g.textBaseline = 'middle'; g.font = `104px ${EMOJI_FONT}`; g.fillText(e, 64, 72); });
    spriteMats.set(e, new THREE.SpriteMaterial({ map: t, transparent: true }));
  }
  const sp = new THREE.Sprite(spriteMats.get(e).clone()); sp.scale.setScalar(s); return sp;
}
class Mtk extends Zone {
  constructor() { super('mtk', 'Warung Hitung', '#ffb4a2', 'wisuda'); this.maxLevel = 4; this.kind = 'quiz'; }
  build() {
    const g = this.group;
    box(7.6, 1.1, 1.4, '#c98f52', 0, 0.55, -1.4, g); box(7.8, 0.14, 1.6, '#e6b07a', 0, 1.15, -1.4, g);
    box(7.6, 0.6, 0.1, '#ff8fab', 0, 0.55, -0.66, g, false);
    for (const x of [-3.8, 3.8]) box(0.25, 3.3, 0.25, '#8a5a35', x, 1.65, -1.0, g);
    for (let i = 0; i < 9; i++) { const b = box(0.9, 0.18, 1.8, i % 2 ? '#ffffff' : '#e8434b', -3.6 + i * 0.9, 3.35, -0.9, g); b.rotation.x = -0.3; }
    box(7, 0.14, 0.8, '#b07a3a', 0, 2.0, -4.6, g); box(7, 0.14, 0.8, '#b07a3a', 0, 0.9, -4.6, g);
    ['🍎', '🍬', '🍪', '🍌', '🧃', '🍞'].forEach((e, i) => { const sp = emojiSprite(e, 0.7); sp.position.set(-3 + i * 1.2, 2.45, -4.6); g.add(sp); });
    this.boardTex = makeBoard(g, 4.9, -3.4, 2.4, 1.4, 3.0);
    this.drawBoard('1 + 1 = ?');
    this.makeIcon((ic) => { box(1.4, 0.35, 0.35, '#e8434b', 0, 0, 0, ic); box(0.35, 1.4, 0.35, '#e8434b', 0, 0, 0, ic); });
  }
  drawBoard(text) {
    const { g, canvas } = this.boardTex.userData; const W = canvas.width, H = canvas.height;
    g.fillStyle = '#fff6df'; g.fillRect(0, 0, W, H); g.fillStyle = '#1d2b53'; g.textAlign = 'center'; g.textBaseline = 'middle';
    g.font = `800 ${text.length > 9 ? 84 : 100}px ${FONT}`; g.fillText(text, W / 2, H / 2 + 6); this.boardTex.needsUpdate = true;
  }
  spot(i, n, cx) { const cols = Math.min(5, n); const r = Math.floor(i / cols), c = i % cols; return new THREE.Vector3(cx + (c - (cols - 1) / 2) * 0.62, 1.62 + r * 0.6, -1.4); }
  // variasi: ayo bayar! ambil koin sesuai harga
  startPay(L) {
    this.paying = true; const [lo, hi] = [[1, 4], [1, 5], [2, 7], [3, 10]][L - 1]; const N = randi(lo, hi);
    const [emo, nm] = pick([['🍭', 'permen'], ['🧃', 'jus'], ['🍦', 'es krim'], ['🍞', 'roti'], ['🍌', 'pisang'], ['🧸', 'boneka'], ['🎈', 'balon']]);
    Object.assign(this, { N, nm, a: N, b: 0, op: '', res: N, busy: false, paid: [] }); this.qkey = `bayar:${nm}:${N}`;
    this.drawBoard(`${N} koin`);
    const item = emojiSprite(emo, 1.3); item.position.set(0, 2.1, -1.4); this.temp.add(item);
    box(1.6, 0.08, 1.2, '#ffffff', 0, 1.24, -1.0, this.temp); this.plate = new THREE.Vector3(0, 1.45, -1.0);
    for (let i = 0; i < N + randi(2, 3); i++) {
      const g = new THREE.Group(); const home = new THREE.Vector3(-3.3 + (i % 4) * 0.62, 1.5, -1.65 + Math.floor(i / 4) * 0.6);
      g.position.copy(home); g.add(emojiSprite('🪙', 0.62)); hitBox(0.6, 0.6, 0.6, 0, 0, 0, g);
      g.userData = { home, baseY: home.y, inP: false }; g.userData.tap = () => this.tapCoin(g); this.temp.add(g);
    }
    say(this.visitRounds ? `${cap(nm)} harganya ${NUM[N]} koin. Ayo bayar!` : `Ayo belanja! ${cap(nm)} harganya ${NUM[N]} koin. Ketuk koin, taruh di piring, lalu ketuk Bayar!`, { stay: true });
    showAction('Bayar!', () => this.checkPay());
  }
  tapCoin(g) {
    if (!this.active || this.round.solved || g.userData.busy) return; const u = g.userData; u.busy = true;
    const slot = (i) => this.plate.clone().add(new THREE.Vector3(-0.5 + (i % 4) * 0.33, Math.floor(i / 4) * 0.12, 0.2 - Math.floor(i / 4) * 0.25));
    if (!u.inP) { u.inP = true; this.paid.push(g); SFX.pop(); speak(NUM[this.paid.length]); flyTo(g, slot(this.paid.length - 1), { height: 1.0 }).then(() => (u.busy = false)); }
    else { u.inP = false; this.paid.splice(this.paid.indexOf(g), 1); SFX.whoosh(); this.paid.forEach((c, i) => flyTo(c, slot(i), { height: 0.2, dur: 0.25 })); flyTo(g, u.home, { height: 0.8 }).then(() => (u.busy = false)); }
  }
  checkPay() {
    if (this.round.solved) return; const n = this.paid.length, N = this.N;
    if (n === N) { this.success(`${pick(YAY)} Kamu membayar ${NUM[N]} koin. ${cap(this.nm)} jadi milikmu!`); return; }
    if (n === 0) { say('Piringnya masih kosong. Ketuk koinnya dulu, ya!', { stay: true }); return; }
    if (this.error()) return;
    say(n < N ? `Baru ${NUM[n]} koin. Harganya ${NUM[N]}. Tambah lagi!` : `Ada ${NUM[n]} koin, kebanyakan! Ketuk koin di piring untuk mengambilnya kembali.`, { stay: true });
  }
  hintText() { return this.paying ? `Harganya ${NUM[this.N]} koin. Di piring ada ${NUM[this.paid.length]}.` : null; }
  startRound(t) {
    const L = this.level; let op, a, b; this.paying = false;
    if (L >= 2 && Math.random() < 0.3) return this.startPay(L);
    if (L === 1) { op = '+'; a = randi(1, 4); b = 1; }
    else if (L === 2) { op = '+'; a = randi(1, 4); b = randi(1, 5 - a); }
    else if (L === 3) { op = '-'; a = randi(2, 5); b = randi(1, a - 1); }
    else if (Math.random() < 0.5) { op = '+'; a = randi(1, 9); b = randi(1, 10 - a); }
    else { op = '-'; a = randi(3, 10); b = randi(1, a - 1); }
    const res = op === '+' ? a + b : a - b; const [emo, nm, verb] = pick(MTK_ITEMS);
    Object.assign(this, { op, a, b, res, nm, busy: false }); this.qkey = `${a}${op}${b}`;
    this.drawBoard(`${a} ${op} ${b} = ?`);
    const items = [];
    if (op === '+') {
      for (let i = 0; i < a; i++) { const s = emojiSprite(emo); s.position.copy(this.spot(i, a, -1.9)); this.temp.add(s); items.push(s); }
      const extra = []; for (let i = 0; i < b; i++) { const s = emojiSprite(emo); s.position.copy(this.spot(i, b, 2.3)); s.visible = false; this.temp.add(s); extra.push(s); }
      setTimeout(() => { if (!this.alive(t)) return; extra.forEach((s, i) => setTimeout(() => { if (!this.alive(t)) return; s.visible = true; SFX.pop(); }, i * 250)); }, 1600);
      setTimeout(() => { if (!this.alive(t)) return; [...items, ...extra].forEach((s, i) => flyTo(s, this.spot(i, a + b, 0), { height: 0.6, dur: 0.6 })); }, 1900 + b * 250 + 600);
      this.final = [...items, ...extra];
      say(`Ada ${NUM[a]} ${nm}. Datang lagi ${NUM[b]} ${nm}. Sekarang ada berapa ${nm}?`, { stay: true });
    } else {
      for (let i = 0; i < a; i++) { const s = emojiSprite(emo); s.position.copy(this.spot(i, a, 0)); this.temp.add(s); items.push(s); }
      const gone = items.slice(a - b); this.final = items.slice(0, a - b);
      setTimeout(() => { if (!this.alive(t)) return; gone.forEach((s, i) => setTimeout(() => { if (!this.alive(t)) return; SFX.whoosh(); const to = s.position.clone().add(new THREE.Vector3(rand(-1, 1) + 3, 3, -1)); flyTo(s, to, { height: 1, dur: 0.9, scaleTo: 0.2 }).then(() => (s.visible = false)); }, i * 300)); }, 1800);
      say(`Ada ${NUM[a]} ${nm}. Lalu ${NUM[b]} ${nm} ${verb}. Tinggal berapa ${nm}?`, { stay: true });
    }
    const opts = new Set([res]); while (opts.size < 3) opts.add(clamp(res + pick([-2, -1, 1, 2]), 0, 10));
    shuffle([...opts]).forEach((v, i) => {
      const bl = glyphBlock(String(v), pick(['#ffd23a', '#7cc8f5', '#ff8fc0', '#9be07f']), 0.95);
      const gg = new THREE.Group(); gg.add(bl); hitBox(1.3, 1.3, 1.3, 0, 0, 0, gg);
      gg.position.set(-2 + i * 2, 0.5, 1.3); gg.userData.baseY = 0.5; gg.userData.correct = v === res; gg.userData.tap = () => this.answer(v, gg);
      this.temp.add(gg);
    });
  }
  answerText() { return this.paying ? `${NUM[this.N]} koin` : `${this.a} ${this.op} ${this.b} = ${this.res}`; }
  async answer(v, gg) {
    if (!this.active || this.round.solved || this.busy) return;
    hop(gg); SFX.tap();
    if (v === this.res) { if (!this.secret) this.drawBoard(this.answerText()); this.success(`${pick(YAY)} ${cap(NUM[this.a])} ${this.op === '+' ? 'tambah' : 'kurang'} ${NUM[this.b]} sama dengan ${NUM[this.res]}.`); return; }
    if (this.error()) return; // ronde bersama: jawaban sudah dikunci
    this.busy = true; const t = this.token;
    say(`${pick(OOPS)} Yuk, kita hitung ${this.nm} yang ada sekarang.`, { stay: true });
    await afterSpeech(3000);
    for (let i = 0; i < this.final.length; i++) { if (!this.alive(t)) { this.busy = false; return; } hop(this.final[i], 0.35, 0.3); speak(NUM[i + 1]); await wait(700); }
    this.busy = false;
    if (this.alive(t)) say(`Jadi, ada berapa ${this.nm}? Ketuk angkanya.`, { stay: true });
  }
}

/* =========================================================
   ZONA 13 — STUDIO GAMBAR (bebas atau dengan contoh)
   ========================================================= */
const galleryKey = () => `pulau-balok-galeri:${playerKey || 'tamu'}`;
function loadGallery() { try { return JSON.parse(localStorage.getItem(galleryKey())) || []; } catch (e) { return []; } }
function pushGallery(url) { const g = loadGallery(); g.unshift(url); try { localStorage.setItem(galleryKey(), JSON.stringify(g.slice(0, 4))); } catch (e) { /* penuh */ } }
class Gambar extends Zone {
  constructor() { super('gambar', 'Studio Gambar', '#c3a6ff', 'baret'); this.maxLevel = 1; this.kind = 'gallery'; this.n = 0; this.noHint = true; }
  build() {
    const g = this.group;
    box(9, 3.2, 0.4, '#fff3e6', 0, 1.6, -5.1, g);
    this.frames = [-3.3, -1.1, 1.1, 3.3].map((x) => {
      box(1.9, 1.5, 0.12, '#8a5a35', x, 1.9, -4.85, g);
      const m = new THREE.MeshLambertMaterial({ color: '#ffffff' }); const p = new THREE.Mesh(new THREE.PlaneGeometry(1.7, 1.28), m); p.position.set(x, 1.9, -4.78); g.add(p); return m;
    });
    // kuda-kuda lukis
    const e = new THREE.Group(); e.position.set(3.6, 0, -1.8); e.rotation.y = -0.4; g.add(e);
    box(0.12, 2.6, 0.12, '#8a5a35', -0.6, 1.3, 0, e); box(0.12, 2.6, 0.12, '#8a5a35', 0.6, 1.3, 0, e); box(0.12, 2.4, 0.12, '#8a5a35', 0, 1.2, -0.6, e).rotation.x = 0.3;
    this.easel = new THREE.MeshLambertMaterial({ color: '#ffffff' }); const cnv = new THREE.Mesh(new THREE.PlaneGeometry(1.5, 1.12), this.easel); cnv.position.set(0, 1.9, 0.08); e.add(cnv);
    box(1.6, 0.1, 0.25, '#8a5a35', 0, 1.3, 0.08, e);
    [['#e8434b', -2.2], ['#ffd23a', -1.4], ['#3a7cf5', -0.6]].forEach(([c, x]) => { box(0.5, 0.6, 0.5, '#ffffff', x, 0.3, -2.6, g); box(0.42, 0.12, 0.42, c, x, 0.6, -2.6, g, false); });
    this.refresh();
    this.makeIcon((ic) => { box(1.2, 0.12, 0.9, '#f2d1a0', 0, 0, 0, ic); [['#e8434b', -0.35], ['#ffd23a', 0], ['#3a7cf5', 0.35]].forEach(([c, x]) => box(0.22, 0.14, 0.22, c, x, 0.08, -0.1, ic)); box(0.12, 1.2, 0.12, '#8a5a35', 0.3, 0.5, 0.3, ic).rotation.z = -0.5; });
  }
  setTex(m, url) { const img = new Image(); img.onload = () => { const t = new THREE.Texture(img); t.colorSpace = THREE.SRGBColorSpace; t.needsUpdate = true; m.map?.dispose(); m.map = t; m.needsUpdate = true; }; img.src = url; }
  refresh() { const gl = loadGallery(); this.frames.forEach((m, i) => { if (gl[i]) this.setTex(m, gl[i]); }); if (gl[0]) this.setTex(this.easel, gl[0]); }
  startRound() {
    const keys = Object.keys(EXAMPLES);
    const ex = this.shared || this.n++ % 2 === 1 ? pick(keys) : null; this.qkey = ex || 'bebas';
    say(ex ? `Yuk, kita gambar ${EXAMPLE_NAMES[ex]}! Ikuti garis titik-titiknya, lalu warnai sesukamu.` : 'Gambar apa saja yang kamu suka! Kalau mau contoh, ketuk tombol Contoh.', { stay: true });
    drawPad({
      example: ex,
      onEmpty: () => say('Ayo gambar dulu, ya. Coret-coret juga boleh!', { stay: true }),
      onExample: (e) => say(e ? `Contohnya ${EXAMPLE_NAMES[e]}. Ikuti titik-titiknya, ya.` : 'Kertas kosong. Bebas menggambar!', { stay: true }),
      onDone: (c) => {
        closePad();
        const url = c.toDataURL('image/jpeg', 0.78); pushGallery(url); this.refresh();
        const small = document.createElement('canvas'); small.width = 240; small.height = 180; small.getContext('2d').drawImage(c, 0, 0, 240, 180);
        this.lastImg = small.toDataURL('image/jpeg', 0.7);
        this.success('Wah, gambarmu indah sekali! Kak Rara pajang di dinding, ya.');
      },
    });
  }
  onExit() { closePad(); }
}

/* =========================================================
   ZONA 14 — TAMAN PUZZLE (menyusun potongan gambar)
   ========================================================= */
const PUZ = [[2, 2, 0.3], [3, 2, 0.25], [3, 3, 0.12], [4, 3, 0]];
class Puzzle extends Zone {
  constructor() { super('puzzle', 'Taman Puzzle', '#9ee6a8', 'baling'); this.maxLevel = 4; this.kind = 'race'; }
  hintText() { return 'Lihat gambar samar di papan. Cari potongan yang warnanya cocok, lalu seret ke sana!'; }
  build() {
    const g = this.group;
    const piece = (x, z, c, ry) => { const p = new THREE.Group(); p.position.set(x, 0, z); p.rotation.y = ry; g.add(p); box(1.6, 0.4, 1.6, c, 0, 0.2, 0, p); box(0.5, 0.4, 0.5, c, 1.05, 0.2, 0, p); box(0.5, 0.42, 0.5, '#7ccd6a', 0, 0.2, 0.62, p, false); };
    piece(-4.2, -3.6, '#ff8fab', 0.2); piece(-2.0, -4.4, '#ffd23a', -0.3); piece(2.4, -4.2, '#7cc8f5', 0.5); piece(4.4, -2.6, '#c3a6ff', -0.1);
    box(4.6, 0.14, 2.6, '#c98f52', 0, 0.85, -1.6, g); for (const [x, z] of [[-2.1, -2.7], [2.1, -2.7], [-2.1, -0.5], [2.1, -0.5]]) box(0.2, 0.85, 0.2, '#8a5a35', x, 0.42, z, g);
    for (let i = 0; i < 6; i++) box(0.6, 0.06, 0.6, ['#ff8fab', '#ffd23a', '#7cc8f5', '#9be07f', '#c3a6ff', '#ff9f1c'][i], -1.5 + (i % 3) * 0.75, 0.95, -2.0 + Math.floor(i / 3) * 0.75, g, false);
    this.makeIcon((ic) => { box(1.1, 0.3, 1.1, '#9ee6a8', 0, 0, 0, ic); box(0.4, 0.3, 0.4, '#9ee6a8', 0.72, 0, 0, ic); box(0.4, 0.32, 0.4, '#5fb953', 0, 0, 0.42, ic); });
  }
  startRound() {
    const [cols, rows, ghost] = PUZ[this.level - 1];
    const scene = randi(0, SCENE_COUNT - 1); this.qkey = `p${scene}`;
    const name = puzzlePad({
      scene, cols, rows, ghost,
      onDrop: (ok) => { if (ok) SFX.pop(); else this.error(); },
      onDone: () => { closePad(); this.success(`${pick(YAY)} Puzzle ${this.picName} sudah lengkap!`); },
    });
    this.picName = name;
    say(`Ayo susun puzzle ${name}! Seret potongannya ke tempat yang cocok.`, { stay: true });
  }
  onExit() { closePad(); }
}

/* =========================================================
   ZONA 15–17 — MEMBACA DENGAN SUARA (huruf, angka, iqro')
   Anak membaca keras; pengenal suara mencocokkan jawabannya. Suara tidak dikirim ke pemain lain.
   ========================================================= */
const LETTER_NAME = { A: 'a', B: 'be', C: 'ce', D: 'de', E: 'e', F: 'ef', G: 'ge', H: 'ha', I: 'i', J: 'je', K: 'ka', L: 'el', M: 'em', N: 'en', O: 'o', P: 'pe', Q: 'ki', R: 'er', S: 'es', T: 'te', U: 'u', V: 've', W: 'we', X: 'eks', Y: 'ye', Z: 'zet' };
const LETTER_ALT = { B: ['beh', 'bee'], C: ['che', 'see', 'cek'], D: ['deh', 'dee'], E: ['eh'], F: ['ep', 'eff'], G: ['geh', 'gue'], H: ['hah'], J: ['jeh', 'jay'], K: ['kah', 'kak'], L: ['ell', 'al'], M: ['emm', 'am'], N: ['enn', 'an'], P: ['peh', 'pee'], Q: ['kiu', 'qi'], R: ['err', 'ar'], S: ['ess', 'as'], T: ['teh', 'tee'], V: ['fe', 'vee', 'pe'], W: ['weh', 'wee'], X: ['eks', 'ex', 'iks'], Y: ['yeh', 'ye'], Z: ['zed', 'set'] };
const SYL_C = 'BCDGHJKLMNPRSTWY', SYL_V = 'AIUEO';
const WORDS = ['BOLA', 'BUKU', 'MAMA', 'PAPA', 'SAPI', 'KUDA', 'MATA', 'KAKI', 'ROTI', 'SUSU', 'MEJA', 'TOPI', 'BAJU', 'IKAN', 'BEBEK', 'NASI', 'MADU', 'DADU', 'LAMPU', 'PINTU', 'GIGI', 'HIDUNG', 'BULAN', 'BUNGA', 'RUMAH', 'KUCING', 'PISANG', 'SEPATU'];
const PHRASES = ['IBU MASAK', 'AYAH PERGI', 'ADIK TIDUR', 'BOLA MERAH', 'SAYA SUKA SUSU', 'KAKAK MAKAN ROTI', 'KUCING MINUM SUSU', 'BUNGA ITU WANGI', 'AYO MAIN BOLA', 'IBU BACA BUKU'];
// huruf hijaiyah: [huruf, bacaan berfathah]
const HIJAIYAH = [['ا', 'a'], ['ب', 'ba'], ['ت', 'ta'], ['ث', 'tsa'], ['ج', 'ja'], ['ح', 'ha'], ['خ', 'kho'], ['د', 'da'], ['ذ', 'dza'], ['ر', 'ro'], ['ز', 'za'], ['س', 'sa'], ['ش', 'sya'], ['ص', 'sho'], ['ض', 'dho'], ['ط', 'tho'], ['ظ', 'zho'], ['ع', "'a"], ['غ', 'gho'], ['ف', 'fa'], ['ق', 'qo'], ['ك', 'ka'], ['ل', 'la'], ['م', 'ma'], ['ن', 'na'], ['و', 'wa'], ['ه', 'ha'], ['ي', 'ya']];
const HARAKAT = [['َ', 'a'], ['ِ', 'i'], ['ُ', 'u']]; // fathah, kasrah, dhammah
const ARAB_FONT = '"Geeza Pro","Noto Naskh Arabic","Noto Sans Arabic","Amiri","Scheherazade New","Traditional Arabic","Arial",serif';
// satu huruf hijaiyah + harakat -> [tulisan, bacaan]
function hijaiyah(idx, vowel) {
  const [ch, readA] = HIJAIYAH[idx];
  const base = readA.replace(/[ao]$/, '');
  if (idx === 0) return [vowel === 'a' ? 'أَ' : vowel === 'i' ? 'إِ' : 'أُ', vowel]; // alif berharakat
  const mark = HARAKAT.find((h) => h[1] === vowel)[0];
  return [ch + mark, vowel === 'a' ? readA : base + vowel];
}
const AWAL = [['🐱', 'KUCING'], ['⚽', 'BOLA'], ['🐟', 'IKAN'], ['🍌', 'PISANG'], ['🚗', 'MOBIL'], ['🐄', 'SAPI'], ['🍎', 'APEL'], ['🐘', 'GAJAH'], ['🦆', 'BEBEK'], ['🌙', 'BULAN'],
  ['🍅', 'TOMAT'], ['🐍', 'ULAR'], ['🥕', 'WORTEL'], ['🦓', 'ZEBRA'], ['🍊', 'JERUK'], ['🐯', 'HARIMAU'], ['🏠', 'RUMAH'], ['🍯', 'MADU'], ['🍍', 'NANAS'], ['🦅', 'ELANG']];
const COUNT_EMO = [['🍎', 'apel'], ['⭐', 'bintang'], ['🐥', 'anak ayam'], ['🎈', 'balon'], ['🍪', 'kue'], ['🐟', 'ikan']];
const BACA_GEN = {
  huruf(L) {
    // variasi: huruf awal dari gambar (🐱 ?UCING -> "ka")
    if (L >= 2 && Math.random() < 0.3) {
      const [e, w] = pick(AWAL); const c = w[0];
      return { key: `awal:${w}`, type: 'letter', letter: c, show: `${e} ?${w.slice(1)}`, read: LETTER_NAME[c], accept: [LETTER_NAME[c], ...(LETTER_ALT[c] || [])], ask: `Ini ${w.toLowerCase()}. Huruf awalnya apa? Sebutkan hurufnya!`, ans: `huruf ${LETTER_NAME[c]}, ${w.toLowerCase()}` };
    }
    if (L === 1) { const c = pick(Object.keys(LETTER_NAME)); return { key: c, type: 'letter', show: c, read: LETTER_NAME[c], accept: [LETTER_NAME[c], ...(LETTER_ALT[c] || [])], ask: 'Ini huruf apa? Sebutkan dengan suara keras!', ans: `huruf ${LETTER_NAME[c]}` }; }
    if (L === 2) { const w = pick([...SYL_C]) + pick([...SYL_V]); return { key: w, type: 'syll', show: w, read: w.toLowerCase(), ask: 'Ayo baca suku kata ini keras-keras!', ans: w.toLowerCase() }; }
    const w = pick(L === 3 ? WORDS : PHRASES); return { key: w, type: L === 3 ? 'word' : 'phrase', show: w, read: w.toLowerCase(), ask: L === 3 ? 'Ayo baca kata ini dengan suara keras!' : 'Ayo baca kalimat ini dengan suara keras dan jelas!', ans: w.toLowerCase() };
  },
  angka(L) {
    // variasi: hitung gambarnya lalu sebutkan jumlahnya
    if (L <= 2 && Math.random() < 0.3) {
      const n = randi(L === 1 ? 1 : 4, L === 1 ? 6 : 9); const [e, nm] = pick(COUNT_EMO);
      return { key: `hitung:${nm}:${n}`, type: 'num', show: e.repeat(n), value: n, read: numWords(n), ask: `Ada berapa ${nm}? Hitung, lalu sebutkan angkanya!`, ans: `${numWords(n)} ${nm}` };
    }
    const [a, b] = [[1, 10], [11, 20], [21, 99], [100, 999]][L - 1]; const n = randi(a, b);
    return { key: String(n), type: 'num', show: String(n), value: n, read: numWords(n), ask: 'Ini angka berapa? Sebutkan dengan suara keras!', ans: numWords(n) };
  },
  iqro(L) {
    const v = () => (L >= 3 ? pick(['a', 'i', 'u']) : 'a');
    const one = (first) => { const i = first ? randi(0, HIJAIYAH.length - 1) : randi(1, HIJAIYAH.length - 1); return hijaiyah(i, v()); };
    const n = L === 1 || L === 3 ? 1 : L === 2 ? 2 : randi(2, 3);
    const parts = Array.from({ length: n }, (_, i) => one(i === 0));
    const show = parts.map((p) => p[0]).join(''), read = parts.map((p) => p[1].replace("'", '')).join('');
    return { key: show, type: 'arab', show, read, ask: n === 1 ? 'Ini dibaca apa? Bacakan dengan suara keras!' : 'Ayo baca bersambung dengan suara keras!', ans: parts.map((p) => p[1]).join(' ') };
  },
};
const SR_FATAL = ['not-allowed', 'service-not-allowed', 'network', 'audio-capture', 'unsupported', 'insecure', 'language-not-supported', 'start'];
let srMode = srSupported() ? 'auto' : 'manual';
class Baca extends Zone {
  constructor(id, name, color, hat) { super(id, name, color, hat); this.maxLevel = 4; this.kind = 'race'; }
  build() {
    const g = this.group, id = this.id;
    if (id === 'iqro') {
      box(8, 3.2, 0.5, '#e9f7ec', 0, 1.6, -5, g); box(8.6, 0.4, 1.2, '#2a8a43', 0, 3.4, -4.8, g);
      [3.2, 2.4, 1.6, 0.9].forEach((w, i) => box(w, 0.5, w, i % 2 ? '#ffffff' : '#f4f4ea', 0, 3.85 + i * 0.5, -4.8, g));
      box(0.14, 0.9, 0.14, '#ffd23a', 0, 6.2, -4.8, g); box(0.5, 0.12, 0.12, '#ffd23a', 0.1, 6.75, -4.8, g);
      for (const x of [-3, 3]) { box(0.7, 3.4, 0.7, '#ffffff', x * 1.35, 1.7, -4.6, g); box(0.9, 0.5, 0.9, '#2a8a43', x * 1.35, 3.65, -4.6, g); }
      [[-2.2, -1.2], [0, -1.6], [2.2, -1.2]].forEach(([x, z], i) => { box(1.3, 0.06, 2.0, ['#c8323a', '#2a8a43', '#3a7cf5'][i], x, 0.05, z, g, false); box(0.7, 0.3, 0.12, '#8a5a35', x, 0.3, z - 0.6, g); });
    } else {
      const wall = id === 'huruf' ? '#ffe6f0' : '#e6f0ff', roof = id === 'huruf' ? '#e86a9a' : '#3a7cf5';
      box(8.4, 3.2, 0.5, wall, 0, 1.6, -5, g); box(9, 0.5, 1.4, roof, 0, 3.6, -4.8, g); box(7, 0.5, 1.2, roof, 0, 4.1, -4.8, g);
      const set = id === 'huruf' ? ['A', 'B', 'C'] : ['1', '2', '3'];
      set.forEach((t, i) => { const b = glyphBlock(t, ['#ff8fab', '#ffd23a', '#7cc8f5'][i], 0.9); b.position.set(-4.2 + i * 0.25, 0.45 + i * 0.9, -2.8 + i * 0.1); b.rotation.y = 0.3 - i * 0.2; g.add(b); });
    }
    this.boardTex = makeBoard(g, 2.6, -3.6, 2.6, 1.6, 3.0);
    this.drawBoard(id === 'huruf' ? 'Aa' : id === 'angka' ? '123' : 'أَ بَ');
    this.makeIcon((ic) => {
      if (id === 'iqro') { box(1.2, 0.9, 0.9, '#ffffff', 0, -0.2, 0, ic); box(0.8, 0.5, 0.6, '#2a8a43', 0, 0.45, 0, ic); box(0.12, 0.5, 0.12, '#ffd23a', 0, 0.9, 0, ic); }
      else { const b = glyphBlock(id === 'huruf' ? 'A' : '1', id === 'huruf' ? '#ff8fab' : '#7cc8f5', 1.3); ic.add(b); }
    });
  }
  drawBoard(text) {
    const { g, canvas } = this.boardTex.userData; const W = canvas.width, H = canvas.height; const arab = /[؀-ۿ]/.test(text);
    g.fillStyle = '#fff6df'; g.fillRect(0, 0, W, H); g.fillStyle = '#1d2b53'; g.textAlign = 'center'; g.textBaseline = 'middle';
    const size = arab ? 130 : text.length > 8 ? 52 : text.length > 4 ? 80 : 130;
    g.font = arab ? `${size}px ${ARAB_FONT}` : `800 ${size}px ${FONT}`; g.direction = arab ? 'rtl' : 'ltr';
    g.fillText(text, W / 2, H / 2 + (arab ? 0 : 6)); g.direction = 'ltr'; this.boardTex.needsUpdate = true;
  }
  enter() { super.enter(); if (net.mic) { micOff(); $('#micBtn').classList.remove('on'); this.restoreMic = true; } } // jawaban suara tidak dikirim ke teman
  onExit() { clearInterval(this.recTimer); this.recP = null; stopListen(); closeSpeak(); if (this.restoreMic) { this.restoreMic = false; micOn().then(() => $('#micBtn').classList.add('on')).catch(() => {}); } }
  startRound(t) {
    const items = [], keys = new Set();
    for (let k = 0; items.length < 3 && k < 30; k++) { const it = BACA_GEN[this.id](this.level); if (!keys.has(it.key)) { keys.add(it.key); items.push(it); } }
    this.items = items; this.idx = 0; this.qkey = items.map((i) => i.key).join('|');
    openSpeak(this); this.runItem(t);
  }
  async runItem(t) {
    const it = this.items[this.idx]; this.tries = 0; this.helped = false; this.manualNo = 0;
    this.drawBoard(it.show); renderSpeak(this, it); speakState('wait');
    say(this.idx === 0 ? `${it.ask} Tahan tombol mikrofon sambil bicara, lalu lepas.` : pick(['Sekarang yang ini!', 'Lanjut, yang ini apa?', 'Bagus! Coba yang ini.']), { stay: true });
    await afterSpeech(6000); if (!this.alive(t)) return;
    speakState(srMode === 'manual' ? 'manual' : 'hold');
  }
  // tahan tombol = merekam (seperti pesan suara WhatsApp); lepas = kirim jawaban
  startRec() {
    if (srMode === 'manual' || this.recP || !this.items?.[this.idx]) return;
    if (hasTTS) speechSynthesis.cancel();
    this.recStart = performance.now(); this.recText = ''; this.touch();
    speakState('rec');
    this.recTimer = setInterval(() => speakState('rec', this.recText), 250);
    this.recP = listen({ hold: true, onInterim: (txt) => { this.recText = txt; speakState('rec', txt); } });
    tone(880, 0.08, { type: 'triangle', vol: 0.08 });
  }
  async stopRec() {
    if (!this.recP) return; const p = this.recP; this.recP = null; clearInterval(this.recTimer);
    const t = this.token, it = this.items[this.idx];
    if (performance.now() - this.recStart < 400) {
      stopListen(false); await p; if (!this.alive(t)) return;
      speakState('hold'); say('Tahan tombolnya sambil bicara, jangan langsung dilepas, ya!', { stay: true }); return;
    }
    tone(660, 0.08, { type: 'triangle', vol: 0.08 });
    stopListen(true); speakState('check');
    const r = await p;
    if (!this.alive(t) || this.items[this.idx] !== it) return;
    this.judge(t, it, r);
  }
  async judge(t, it, r) {
    if (r.error && SR_FATAL.includes(r.error)) {
      srMode = 'manual';
      say(r.error === 'network' ? 'Pengenal suara butuh internet. Tidak apa-apa: bacakan dengan keras, lalu ketuk Dengar jawaban untuk mencocokkan.' : 'Pengenal suara belum bisa dipakai di perangkat ini. Bacakan dengan keras, lalu ketuk Dengar jawaban.', { stay: true, force: true });
      speakState('manual'); return;
    }
    const heard = r.alts[0] || '';
    if (r.alts.length && isMatch(it, r.alts)) return this.itemDone(t, !this.helped, heard);
    if (this.helped && r.alts.length) return this.itemDone(t, false, heard); // sudah dicontohkan: usaha menirukan diterima
    if (!r.alts.length) { speakState('hold'); say('Kak Rara belum dengar suaramu. Tahan tombolnya, lalu bicara yang keras, ya!', { stay: true }); return; }
    this.tries++; this.error();
    speakState('wrong', heard);
    if (this.tries === 1) say(`Hmm, Kak Rara dengar "${heard}". Coba sekali lagi, yang keras dan jelas!`, { stay: true });
    else { this.helped = true; say(`Dengarkan Kak Rara: ${it.ans}. Sekarang kamu tirukan!`, { stay: true }); }
    await afterSpeech(6000); if (!this.alive(t)) return;
    speakState('hold', heard);
  }
  async itemDone(t, clean, heard = '') {
    const it = this.items[this.idx];
    speakState('right', heard || it.ans); SFX.good(); celebrate('small');
    speak(clean ? pick([`Betul! ${it.ans}.`, `Hebat! ${it.ans}.`, `Iya! ${it.ans}.`]) : `Nah, betul! ${it.ans}.`);
    await wait(1400); await afterSpeech(3000); if (!this.alive(t)) return;
    this.idx++;
    if (this.idx < this.items.length) { this.runItem(t); return; }
    closeSpeak();
    this.success(`${pick(YAY)} Kamu sudah membaca semuanya dengan suara keras.`);
  }
  manualHear() { const it = this.items[this.idx]; speak(it.ans); speakState('manualAns', it.ans); }
  giveHint() {
    this.lastAct = performance.now(); const it = this.items?.[this.idx]; if (!it || this.recP) return;
    this.round.hinted = true; this.helped = srMode !== 'manual';
    say(srMode === 'manual' ? 'Ayo bacakan dengan suara keras, lalu ketuk Dengar jawaban!' : `Kak Rara bantu, ya: ${it.ans}. Tahan tombol mikrofon, lalu tirukan!`, { stay: true });
  }
  manualYes() { const t = this.token; this.itemDone(t, this.manualNo === 0); }
  manualNo_() { this.manualNo++; this.error(); speakState('manual'); say('Tidak apa-apa. Coba bacakan sekali lagi, lalu dengar jawabannya.', { stay: true }); }
}
let speakZone = null;
function openSpeak(z) { speakZone = z; $('#speak').hidden = false; }
function closeSpeak() { speakZone = null; $('#speak').hidden = true; stopListen(); }
function renderSpeak(z, it) {
  const show = $('#spShow'); const arab = it.type === 'arab';
  show.textContent = it.show; show.classList.toggle('arab', arab); show.dir = arab ? 'rtl' : 'ltr';
  show.style.fontSize = arab ? '' : it.show.length > 10 ? 'clamp(40px,9vw,90px)' : it.show.length > 4 ? 'clamp(56px,13vw,130px)' : '';
  $('#spDots').innerHTML = z.items.map((_, i) => `<i class="${i < z.idx ? 'done' : i === z.idx ? 'cur' : ''}"></i>`).join('');
  $('#spTitle').textContent = `${ZONE_EMOJI[z.id]} ${z.name}`;
}
function speakState(st, txt = '') {
  const s = $('#spStatus'); s.className = `spStatus ${st}`;
  const secs = speakZone?.recStart ? ((performance.now() - speakZone.recStart) / 1000).toFixed(1) : '0';
  s.textContent = { wait: 'Dengarkan Kak Rara dulu…', hold: '👇 Tahan tombol 🎤 sambil bicara, lalu lepas', rec: `🔴 ${secs} dtk ${txt ? `· "${txt}"` : '· bicara sekarang…'}`, check: 'Kak Rara memeriksa jawabanmu…', wrong: `Kak Rara dengar: "${txt}"`, right: `✅ ${txt}`, manual: '🗣️ Bacakan dengan suara keras, lalu ketuk 🔊 Dengar jawaban', manualAns: `Jawabannya: ${txt}. Kamu benar?` }[st] || '';
  const manual = srMode === 'manual';
  $('#spMic').hidden = manual; $('#spHear').hidden = !manual; $('#spYes').hidden = $('#spNo').hidden = !(manual && st === 'manualAns');
  const rec = st === 'rec'; $('#spMic').classList.toggle('on', rec); $('#spMic').disabled = st === 'wait' || st === 'check' || st === 'right';
  $('#spMic').innerHTML = rec ? '🔴 Lepas untuk kirim' : '🎤 Tahan untuk bicara';
}

/* =========================================================
   ALUR: MASUK/KELUAR ZONA, HADIAH, MAIN BERSAMA
   ========================================================= */
function leaveZone() { if (activeZone) activeZone.exit(); }
// dekat tempat bermain: tampilkan tombol "Masuk" (tidak otomatis masuk, seperti di PUBG)
const family = { maxPlayers: 6 };
let nearZone = null, enterKey = '';
const zoneCount = (z) => [...remotes.values()].filter((r) => r.zone === z.id).length;
function checkZones() {
  let near = null;
  if (!activeZone && playing && !paused() && !me.down && !veh.kind && !ride) {
    let best = 7.2;
    for (const z of Object.values(zones)) { const d = Math.hypot(player.pos.x - z.cx, player.pos.z - z.cz); if (d < best) { best = d; near = z; } }
  }
  const b = $('#enterBtn');
  if (!near) { if (nearZone) { b.hidden = true; nearZone = null; enterKey = ''; } return; }
  const n = zoneCount(near), unsafe = !isSafeZone(near), full = unsafe || (net.online && n >= family.maxPlayers);
  const key = `${near.id}:${n}:${full}:${unsafe}`;
  if (key === enterKey) return;
  if (!nearZone || nearZone !== near) { SFX.pop(); }
  nearZone = near; enterKey = key; b.hidden = false; b.disabled = full;
  b.innerHTML = `<span class="e">${unsafe ? '⚠️' : ZONE_EMOJI[near.id]}</span><span class="t"><b>${unsafe ? 'Tidak aman' : full ? 'Penuh' : 'Masuk'}</b><small></small></span>${n ? `<span class="n">👥 ${n}</span>` : ''}`;
  b.querySelector('small').textContent = near.name;
}
function enterNear() {
  const z = nearZone; if (!z || activeZone || $('#enterBtn').disabled) return;
  SFX.good(); $('#enterBtn').hidden = true; nearZone = null; enterKey = ''; z.enter();
}
let actionCb = null;
function showAction(label, cb) { const b = $('#actionBtn'); b.textContent = label; b.hidden = false; actionCb = cb; }
function hideAction() { $('#actionBtn').hidden = true; actionCb = null; }
$('#actionBtn').addEventListener('click', () => { SFX.tap(); actionCb?.(); });

const TOGETHER = {
  kebun: ['Ambil 5 sendok di dapur bersama Ayah atau Bunda. Hitung bersama-sama!', 'Hitung ada berapa kursi di rumahmu.', 'Hitung jari tanganmu bersama Bunda: satu sampai sepuluh!'],
  warna: ['Cari 3 benda berwarna merah di rumah, lalu tunjukkan ke Ayah atau Bunda!', 'Apa warna bajumu hari ini? Beri tahu Ayah atau Bunda.', 'Rapikan mainan, lalu kelompokkan menurut warnanya.'],
  hewan: ['Tirukan suara ayam bersama Ayah atau Bunda! Kukuruyuk!', 'Ceritakan hewan apa yang pernah kamu lihat di dekat rumah.', 'Cari benda yang namanya dimulai huruf B. Bola? Buku?'],
  pola: ['Tepuk tangan dengan pola: tepuk, tepuk, hentak! Ulangi bersama Ayah atau Bunda.', 'Susun sendok dan garpu berselang-seling: sendok, garpu, sendok, garpu.', 'Buat pola dengan mainan atau kancing, lalu minta Ayah atau Bunda menebak lanjutannya.'],
  bentuk: ['Cari benda berbentuk lingkaran di rumah. Piring? Jam dinding?', 'Gambar segitiga dan persegi di kertas bersama Ayah atau Bunda.', 'Buat bentuk hati dengan kedua tanganmu, lalu tunjukkan ke Ayah atau Bunda!'],
  ikan: ['Ambil kacang atau kancing dengan dua tangan. Tangan mana yang lebih banyak? Hitung bersama!', 'Bagi enam kue ke dua piring sama banyak bersama Ayah atau Bunda.', 'Siapa yang punya lebih banyak mainan mobil, kamu atau boneka? Hitung bersama!'],
  musik: ['Ayah atau Bunda tepuk tangan dua kali, kamu tirukan! Lalu gantian.', 'Bernyanyi lagu Balonku bersama Ayah atau Bunda.', 'Pukul panci pelan-pelan dengan sendok kayu: dung, dung, ting!'],
  kembar: ['Cari dua kaus kaki yang sama di lemari, lalu pasangkan.', 'Ayah atau Bunda menyembunyikan mainan, kamu yang mencari!', 'Lihat tiga benda di meja, tutup mata, lalu sebutkan lagi.'],
  ukuran: ['Berdiri berjajar dengan Ayah atau Bunda. Siapa yang paling tinggi?', 'Susun tiga buku dari yang paling kecil sampai paling besar.', 'Cari sendok yang paling panjang dan paling pendek di dapur.'],
  tulis: ['Tulis namamu bersama Ayah atau Bunda di kertas, pelan-pelan saja.', 'Cari huruf A di buku atau kemasan makanan!', 'Tulis angka 1 sampai 5 di udara dengan jarimu bersama Ayah atau Bunda.'],
  mtk: ['Ambil 3 sendok, lalu tambah 1. Jadi berapa? Hitung bersama!', 'Main warung-warungan: beli 2 kue, makan 1. Sisa berapa?', 'Bagi 4 kue untuk kamu dan Ayah atau Bunda sama banyak.'],
  gambar: ['Gambar keluargamu bersama Ayah atau Bunda!', 'Gambar hewan kesukaanmu, lalu ceritakan.', 'Warnai gambar bersama dengan krayon.'],
  puzzle: ['Susun puzzle sungguhan bersama Ayah atau Bunda.', 'Gunting gambar dari majalah jadi 4 bagian, lalu susun lagi.', 'Susun balok jadi menara bersama!'],
  huruf: ['Cari huruf pertama namamu di buku, lalu bacakan keras-keras!', 'Baca nama makanan di kemasan bersama Ayah atau Bunda.', 'Main tebak huruf: Ayah atau Bunda menulis, kamu membaca.'],
  angka: ['Baca angka di jam dinding atau kalender bersama Ayah atau Bunda.', 'Cari angka di nomor rumah atau pelat mobil, lalu sebutkan!', 'Hitung anak tangga di rumah keras-keras.'],
  iqro: ["Baca Iqro' bersama Ayah atau Bunda sebelum tidur.", 'Sebutkan huruf hijaiyah dari alif sampai ya bersama.', 'Ucapkan bismillah sebelum makan bersama keluarga.'],
  rasa: ['Ceritakan pada Ayah atau Bunda: hari ini kamu merasa apa?', 'Buat wajah senang, sedih, dan kaget di depan cermin bersama!', 'Peluk Ayah atau Bunda, lalu bilang: aku sayang kamu.'],
};
let modal = null;
function paused() { return !!modal; }
function openModal(id) { modal = id; $('#' + id).hidden = false; }
function closeModal(id) { $('#' + id).hidden = true; if (modal === id) modal = null; }
// setiap 5 ronde dalam satu kunjungan: sesi selesai, bonus bintang
async function sessionDone(z) {
  save.stars += 2; persist(); updateStars();
  celebrate('mega', 'SESI SELESAI!'); floatText('+2 ⭐');
  say(`Hore! Lima ronde di ${z.name} selesai! Kamu dapat bonus dua bintang. Mau lanjut lagi? Ayo!`, { stay: true, force: true });
  await wait(2500); await afterSpeech(6000);
}
function showTogether(zid) {
  return new Promise((res) => {
    const text = pick(TOGETHER[zid]);
    $('#togetherText').textContent = text; openModal('together');
    say(`Main bersama Ayah atau Bunda! ${text}`, { stay: true });
    const done = (stars) => { closeModal('together'); if (stars) { save.stars += stars; persist(); updateStars(); SFX.fanfare(); toast('+3 bintang'); } res(); };
    $('#togetherDone').onclick = () => done(3);
    $('#togetherLater').onclick = () => done(0);
  });
}
function updateStars() { $('#starCount').textContent = save.stars; }

/* =========================================================
   PETUALANGAN: Kristal Pelangi, peti harta, misi, panah penunjuk, hewan peliharaan
   ========================================================= */
const ZONE_EMOJI = { kebun: '🍊', warna: '🏠', hewan: '🐔', pola: '🧱', bentuk: '🔺', ikan: '🐟', musik: '🥁', kembar: '🃏', ukuran: '📏', rasa: '😊', tulis: '✏️', mtk: '➕', gambar: '🎨', puzzle: '🧩', huruf: '🔤', angka: '🔢', iqro: '🕌' };
const crystalMeshes = []; const chests = []; let rainbow = null, guide = null, beacon = null;
const CRYSTAL_GEO = new THREE.OctahedronGeometry(0.34);
function buildMonument() {
  const g = new THREE.Group(); scene.add(g);
  box(3.4, 0.4, 3.4, '#d9cba8', 0, 0.2, 0, g); box(2.4, 0.5, 2.4, '#e9dcbc', 0, 0.65, 0, g);
  box(0.9, 3.2, 0.9, '#f3e7c6', 0, 2.2, 0, g); box(1.3, 0.4, 1.3, '#d9cba8', 0, 3.9, 0, g);
  const big = new THREE.Mesh(new THREE.OctahedronGeometry(0.7), new THREE.MeshLambertMaterial({ color: '#ffffff', emissive: '#ffffff', emissiveIntensity: 0.15 }));
  big.position.y = 4.9; g.add(big); animated.push({ obj: big, fn: (t) => { big.rotation.y = t; big.position.y = 4.9 + Math.sin(t * 2) * 0.15; } });
  ZONE_IDS.forEach((id, i) => {
    const a = (i / ZONE_IDS.length) * Math.PI * 2; const x = Math.cos(a) * 2.6, z = Math.sin(a) * 2.6;
    box(0.36, 0.9, 0.36, '#cbbd99', x, 0.45, z, g);
    const m = new THREE.Mesh(CRYSTAL_GEO, new THREE.MeshLambertMaterial({ color: '#9a9486', emissive: CRYSTAL_COLORS[i], emissiveIntensity: 0 }));
    m.position.set(x, 1.35, z); m.castShadow = true; g.add(m); crystalMeshes.push({ id, m, i });
  });
  colliders.push({ x: 0, z: 0, r: 3.0 });
  animated.push({ obj: g, fn: (t) => { for (const c of crystalMeshes) { if (!c.on) continue; c.m.rotation.y = t * 1.5 + c.i; c.m.position.y = 1.35 + Math.sin(t * 2 + c.i) * 0.08; } } });
  // peti harta per bab
  [[-6.6, -4.3], [0, -7.8], [6.6, -4.3]].forEach(([x, z], i) => {
    const c = new THREE.Group(); c.position.set(x, 0, z); c.rotation.y = Math.atan2(-x, -z) + Math.PI; scene.add(c);
    box(1.4, 0.8, 0.95, '#a8642c', 0, 0.4, 0, c); box(1.46, 0.1, 1.0, '#ffd23a', 0, 0.78, 0, c); box(0.2, 0.3, 0.06, '#ffd23a', 0, 0.55, 0.5, c);
    const lid = new THREE.Group(); lid.position.set(0, 0.82, -0.47); c.add(lid);
    box(1.4, 0.32, 0.95, '#b9733a', 0, 0.16, 0.47, lid); box(1.46, 0.08, 1.0, '#ffd23a', 0, 0.3, 0.47, lid);
    const glow = box(1.2, 0.08, 0.8, '#fff3a0', 0, 0.8, 0, c, false); glow.material = new THREE.MeshBasicMaterial({ color: '#fff3a0' }); glow.visible = false;
    const tag = new THREE.Sprite(new THREE.SpriteMaterial({ map: canvasTex(256, 96, (q) => { q.fillStyle = '#fff6df'; rrect(q, 4, 4, 248, 88, 30); q.fill(); q.fillStyle = '#1d2b53'; q.font = `800 50px ${FONT}`; q.textAlign = 'center'; q.textBaseline = 'middle'; q.fillText(`Bab ${i + 1}`, 128, 52); }) }));
    tag.scale.set(1.3, 0.5, 1); tag.position.y = 1.9; c.add(tag);
    colliders.push({ x, z, r: 0.8 }); chests.push({ c, lid, glow, open: false });
  });
  // pelangi hadiah bab terakhir
  rainbow = new THREE.Group(); rainbow.position.set(0, -6, -70); scene.add(rainbow); rainbow.visible = false;
  ['#e8434b', '#ff8a2a', '#ffd23a', '#3fb25a', '#3a7cf5', '#9a62e0'].forEach((c, i) => { const t = new THREE.Mesh(new THREE.TorusGeometry(70 - i * 2.2, 1.1, 6, 80, Math.PI), new THREE.MeshBasicMaterial({ color: c, transparent: true, opacity: 0.8, fog: false })); rainbow.add(t); });
  // panah penunjuk misi + sorot cahaya di lokasi tujuan
  guide = new THREE.Group(); scene.add(guide);
  const ar = new THREE.Group(); ar.position.set(0, 0, 0); guide.add(ar);
  box(0.28, 0.12, 1.0, '#ffd23a', 0, 0, 0.15, ar, false); const h1 = box(0.28, 0.12, 0.6, '#ffd23a', 0.2, 0, -0.45, ar, false); h1.rotation.y = 0.75; const h2 = box(0.28, 0.12, 0.6, '#ffd23a', -0.2, 0, -0.45, ar, false); h2.rotation.y = -0.75;
  beacon = new THREE.Mesh(new THREE.CylinderGeometry(0.9, 0.9, 60, 12, 1, true), new THREE.MeshBasicMaterial({ color: '#fff3a0', transparent: true, opacity: 0.22, depthWrite: false, side: THREE.DoubleSide }));
  beacon.position.y = 30; scene.add(beacon);
}
function refreshCrystals() {
  for (const c of crystalMeshes) { const on = save.crystals.includes(c.id); c.on = on; c.m.material.color.set(on ? CRYSTAL_COLORS[c.i] : '#9a9486'); c.m.material.emissiveIntensity = on ? 0.45 : 0; c.m.scale.setScalar(on ? 1.15 : 0.7); }
  chests.forEach((ch, i) => { const open = save.chapterDone.includes(i); if (open !== ch.open) { ch.open = open; ch.lid.rotation.x = open ? -1.9 : 0; ch.glow.visible = open; } });
  if (rainbow) rainbow.visible = save.chapterDone.includes(CHAPTERS.length - 1);
}
// misi: kumpulkan poin sebanyak-banyaknya dan jadi juara di tempat bermain favoritmu
let myScores = {};
const totalPoints = () => Object.values(net.online ? myScores : save.myScore || {}).reduce((a, b) => a + b, 0);
const championOf = () => Object.keys(zones).filter((id) => tops[id]?.[0]?.name === playerName);
function missionZone() { return null; } // tidak ada lagi lokasi wajib
function updateMission() {
  const el = $('#mission'); const champ = championOf();
  el.innerHTML = '<span class="e">🏆</span>';
  el.setAttribute('aria-label', `Misi: ${totalPoints()} poin, ${champ.length ? `juara di ${champ.length} tempat` : 'ayo jadi juara'}`);
}
function tellMission() {
  const champ = championOf().map((id) => zones[id].name);
  const fav = Object.entries(net.online ? myScores : save.myScore || {}).sort((a, b) => b[1] - a[1])[0];
  let line = `Misi kita: kumpulkan poin sebanyak-banyaknya, dan jadilah juara satu di tempat bermain kesukaanmu! Poinmu sekarang ${totalPoints()}.`;
  if (champ.length) line += ` Kamu juara satu di ${champ.join(', ')}. Hebat!`;
  else if (fav) line += ` Poinmu paling banyak di ${zones[fav[0]]?.name}. Sedikit lagi bisa jadi juara!`;
  if (worldSt.phase === 'night') line += ' Hati-hati, ini malam. Cari zona aman yang hijau!';
  say(line);
}
async function unlockReward(z) {
  if (save.crystals.includes(z.id)) return;
  save.crystals.push(z.id);
  if (!save.hats.includes(z.hat)) save.hats.push(z.hat);
  save.avatar.hat = z.hat; persist(); applyAvatar(); refreshCrystals(); updateMission();
  celebrate('big', 'KRISTAL!'); burst(player.pos.clone().add(new THREE.Vector3(0, 3, 0)), CRYSTAL_COLORS);
  camMode = 'wardrobe'; player.facing = 0;
  const n = save.crystals.length;
  $('#rewardTitle').textContent = 'Kristal Pelangi!';
  $('#rewardText').textContent = `Kristal ke-${n} dari ${ZONE_IDS.length}, dan ${HATS[z.hat].name}!`;
  openModal('reward');
  say(`Hore! Kamu menemukan Kristal Pelangi ke-${n}! Kamu juga dapat ${HATS[z.hat].name}. Lihat, sudah dipakai!`, { stay: true, force: true });
  await new Promise((res) => { $('#rewardOk').onclick = () => { closeModal('reward'); res(); }; });
  for (const [i, ch] of CHAPTERS.entries()) if (!save.chapterDone.includes(i) && ch.zones.every((id) => save.crystals.includes(id))) await chapterReward(i);
  camMode = 'follow'; player.facing = Math.PI;
}
async function chapterReward(i) {
  const ch = CHAPTERS[i]; save.chapterDone.push(i);
  if (!save.hats.includes(ch.prize)) save.hats.push(ch.prize);
  save.avatar.hat = ch.prize; applyAvatar();
  persist(); refreshCrystals();
  celebrate('mega', i === CHAPTERS.length - 1 ? 'JUARA PULAU!' : 'BAB SELESAI!');
  $('#rewardTitle').textContent = `${ch.name} selesai!`;
  $('#rewardText').textContent = `Peti harta terbuka. Kamu dapat ${ch.prizeName}!`;
  openModal('reward');
  say(i === CHAPTERS.length - 1 ? `Luar biasa! Semua Kristal Pelangi sudah kembali. Lihat, ada pelangi di langit! Kamu dapat ${ch.prizeName}. Kamu juara Pulau Balok!`
    : `Hore! ${ch.name} selesai! Peti harta di tengah pulau terbuka. Kamu dapat ${ch.prizeName}. Lihat, sudah dipakai!`, { stay: true, force: true });
  await new Promise((res) => { $('#rewardOk').onclick = () => { closeModal('reward'); res(); }; });
}
/* =========================================================
   SKOR LOKAL (tanpa server)
   ========================================================= */
function addLocalScore(zone, pts) {
  save.myScore ||= {}; save.myScore[zone] = (save.myScore[zone] || 0) + pts; setTimeout(updateMission, 0);
  if (!net.online) { tops[zone] = [{ name: playerName || 'Kamu', points: save.myScore[zone] }]; zones[zone]?.drawTop(); }
}

/* =========================================================
   PEMAIN LAIN (main bersama)
   ========================================================= */
const remotes = new Map();
let playerKey = null, playerName = '';
function nameTagTex(name, color = '#ffffff') {
  return canvasTex(320, 80, (g) => {
    g.font = `800 44px ${FONT}`; const w = Math.min(310, g.measureText(name).width + 44);
    g.fillStyle = 'rgba(29,43,83,.78)'; rrect(g, (320 - w) / 2, 6, w, 66, 32); g.fill();
    g.fillStyle = color; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(name, 160, 42);
  });
}
function addRemote(p) {
  if (!p || p.id === net.id || remotes.has(p.id)) return;
  const ch = makeCharacter({ shirt: '#3a7cf5', pants: '#2c2f3a', skin: SKINS[1] });
  applyAvatarTo(ch, p.avatar || {});
  const tag = new THREE.Sprite(new THREE.SpriteMaterial({ map: nameTagTex(p.name), depthTest: false, transparent: true }));
  tag.scale.set(2.4, 0.6, 1); tag.position.y = 3.6; tag.renderOrder = 5; ch.root.add(tag);
  const mic = emojiSprite('🎤', 0.6); mic.position.set(1.4, 3.6, 0); mic.visible = false; mic.material.depthTest = false; ch.root.add(mic);
  const pos = p.pos || { x: 0, z: 7, y: 0, f: 0, m: 0 };
  ch.root.position.set(pos.x, 0, pos.z); scene.add(ch.root);
  hitBox(1.4, 3.2, 1.2, 0, 1.6, 0, ch.root);
  const r = { id: p.id, name: p.name, ch, tag, mic, target: { ...pos }, phase: 0, avatar: p.avatar, zone: p.zone, voice: p.voice, secure: p.secure, emote: null, down: !!p.down };
  ch.root.visible = !r.down;
  ch.root.userData.tap = () => greet(r);
  tapRoots.push(ch.root); remotes.set(p.id, r);
  addPeer(p.id, p.secure);
}
function removeRemote(id) {
  const r = remotes.get(id); if (!r) return;
  scene.remove(r.ch.root); const i = tapRoots.indexOf(r.ch.root); if (i >= 0) tapRoots.splice(i, 1);
  remotes.delete(id); removePeer(id);
  if (spec.on) renderSpect();
}
function greet(r) {
  SFX.tap(); send({ t: 'greet', to: r.id }); doEmote('👋');
  say(`Halo, ${r.name}!`);
}
let moveTick = 0, lastMove = '';
function sendMove(dt) {
  if (!net.online || !net.id) return;
  moveTick += dt; if (moveTick < 0.1) return; moveTick = 0;
  const m = { x: +player.pos.x.toFixed(2), z: +player.pos.z.toFixed(2), y: +player.y.toFixed(2), f: +player.facing.toFixed(2), m: player.moving ? 1 : 0, p: para.phase || vehCode() || (swimming() ? 3 : 0), pc: veh.pass.size };
  const k = JSON.stringify(m); if (k === lastMove) return; lastMove = k; send({ t: 'move', ...m });
}
function updateRemotes(dt) {
  for (const r of remotes.values()) {
    const root = r.ch.root, t = r.target;
    const dx = t.x - root.position.x, dz = t.z - root.position.z, d = Math.hypot(dx, dz);
    if (d > 20) root.position.set(t.x, 0, t.z); else { const k = 1 - Math.exp(-dt * 10); root.position.x += dx * k; root.position.z += dz * k; }
    root.position.y = (t.y || 0) + (t.p === 3 ? -SWIM_DROP : VEH_OFF[t.p] || 0);
    let rd = (t.f || 0) - root.rotation.y; rd = Math.atan2(Math.sin(rd), Math.cos(rd)); root.rotation.y += rd * Math.min(1, dt * 10);
    const moving = t.m || d > 0.05; r.phase = moving ? r.phase + dt * 11 : r.phase * Math.pow(0.001, dt);
    const sw = moving ? Math.sin(r.phase) * 0.7 : 0;
    r.ch.hipL.rotation.x = sw; r.ch.hipR.rotation.x = -sw; r.ch.shL.rotation.x = -sw; r.ch.shR.rotation.x = sw; r.ch.shR.rotation.z = 0;
    r.ch.body.position.y = moving ? Math.abs(Math.sin(r.phase)) * 0.08 : Math.sin(elapsed * 2 + r.id) * 0.02;
    poseSpecial(r.ch, t.p || 0, r.phase, r);
    if (r.punchT > 0) { r.punchT -= dt; r.ch.shR.rotation.x = -1.6 - Math.sin((r.punchT / 0.25) * Math.PI) * 0.8; }
    const lv = voiceLevel(r.id); r.mic.visible = !!r.voice; r.mic.scale.setScalar(0.5 + Math.min(0.5, lv * 4));
    // suara teman makin pelan bila jauh (seperti di game)
    setPeerVolume(r.id, clamp(1.15 - Math.hypot(player.pos.x - root.position.x, player.pos.z - root.position.z) / 35, 0.12, 1));
    animateEmote(r.ch, r, dt);
  }
}

/* ---------- emotikon beranimasi ---------- */
const EMOTES = ['👋', '😀', '😂', '😍', '👍', '🎉', '😮', '😢', '❤️', '⭐'];
const myEmote = { emote: null };
function startEmote(ch, holder, e) {
  if (holder.emote?.sprite) ch.root.remove(holder.emote.sprite);
  holder.emote?.bits?.forEach((b) => ch.root.remove(b));
  const sp = emojiSprite(e, 0.01); sp.position.y = 4.3; sp.material.depthTest = false; sp.renderOrder = 6; ch.root.add(sp);
  const bits = [];
  for (let i = 0; i < 7; i++) { const b = emojiSprite(e === '😂' ? '💧' : e === '😍' || e === '❤️' ? '💖' : e === '🎉' ? '🎊' : e === '😢' ? '💧' : '✨', 0.01); b.position.y = 3.6; b.material.depthTest = false; ch.root.add(b); bits.push(b); }
  holder.emote = { e, t: 0, sprite: sp, bits };
}
function animateEmote(ch, holder, dt) {
  const em = holder.emote; if (!em) return;
  em.t += dt; const t = em.t;
  const pop = t < 0.45 ? 1 + Math.sin((t / 0.45) * Math.PI * 2.5) * (1 - t / 0.45) * 0.5 : 1; // pegas
  const grow = Math.min(1, t / 0.18); const fade = t > 2.4 ? Math.max(0, 1 - (t - 2.4) / 0.6) : 1;
  em.sprite.scale.setScalar(1.5 * grow * pop * (0.6 + fade * 0.4)); em.sprite.material.opacity = fade;
  em.sprite.position.y = 4.3 + Math.sin(t * 5) * 0.12 + (t > 2.4 ? (t - 2.4) * 1.5 : 0);
  em.sprite.material.rotation = Math.sin(t * 7) * 0.15;
  em.bits.forEach((b, i) => {
    const a = (i / em.bits.length) * Math.PI * 2 + t; const k = Math.min(1, t / 1.6);
    b.position.set(Math.cos(a) * (0.4 + k * 1.4), 3.4 + k * 2.4 + Math.sin(t * 6 + i) * 0.1, Math.sin(a) * (0.4 + k * 1.4));
    b.scale.setScalar(0.45 * Math.sin(Math.min(1, t / 1.8) * Math.PI)); b.material.opacity = 1 - k;
  });
  // gerakan tubuh sesuai emotikon
  const e = em.e, k = t < 2.2;
  if (k && (e === '👋')) { ch.shR.rotation.z = 2.6 + Math.sin(t * 14) * 0.35; }
  else if (k && (e === '🎉' || e === '⭐')) { ch.body.position.y = Math.abs(Math.sin(t * 9)) * 0.5; ch.shL.rotation.z = -2.5; ch.shR.rotation.z = 2.5; if (e === '⭐') ch.body.rotation.y = t * 6; }
  else if (k && e === '😂') { ch.body.rotation.z = Math.sin(t * 20) * 0.12; ch.head.rotation.x = -0.3; }
  else if (k && (e === '😍' || e === '❤️')) { ch.body.position.y = Math.abs(Math.sin(t * 6)) * 0.25; ch.shL.rotation.x = -1.2; ch.shR.rotation.x = -1.2; }
  else if (k && e === '👍') { ch.shR.rotation.x = -2.4; }
  else if (k && e === '😢') { ch.head.rotation.x = 0.35; }
  else if (k && e === '😮') { ch.body.rotation.x = -0.12; ch.shL.rotation.z = -0.6; ch.shR.rotation.z = 0.6; }
  if (t > 3) {
    ch.root.remove(em.sprite); em.bits.forEach((b) => ch.root.remove(b)); holder.emote = null;
    ch.body.rotation.set(0, 0, 0); ch.head.rotation.set(0, 0, 0); ch.shL.rotation.z = 0; ch.shR.rotation.z = 0;
  }
}
function doEmote(e) {
  startEmote(player.ch, myEmote, e); send({ t: 'emote', e });
  tone(660, 0.12, { type: 'triangle', vol: 0.1 }); tone(990, 0.14, { type: 'triangle', vol: 0.08, delay: 0.08 });
}

/* =========================================================
   LOBI, PAPAN RONDE, HASIL RONDE
   ========================================================= */
function playerLabel(id) { return id === net.id ? `${playerName} (kamu)` : remotes.get(id)?.name || 'Teman'; }
function avatarDot(av = {}) { return `<i class="dot" style="background:${COLORS[av.shirt] || COLORS.biru}">${av.gender === 'P' ? '👧' : '👦'}</i>`; }
function avatarOf(id) { return id === net.id ? save.avatar : remotes.get(id)?.avatar || {}; }
function renderLobby(z) {
  const el = $('#lobby');
  if (!z) { el.hidden = true; return; }
  el.hidden = false;
  const members = net.online && z.members.length ? z.members : [net.id];
  const names = members.map((id) => `<span class="chip">${avatarDot(avatarOf(id))}${escapeHTML(playerLabel(id))}${id === z.host || (!net.online) ? ' 👑' : ''}</span>`).join('');
  const lvName = (LEVEL_NAMES[z.id] || [])[z.myLevel() - 1] || '';
  let html = `<div class="lh"><span class="e">${ZONE_EMOJI[z.id]}</span><b>${escapeHTML(z.name)}</b><span class="lvl">${'⭐'.repeat(z.myLevel())} ${escapeHTML(lvName)}</span></div><div class="chips">${names}</div>`;
  if (z.isHost) html += `<button class="chunky leaf go" id="lobbyGo">Mulai!</button><p class="note">Mau menunggu teman? Ketuk Mulai setelah teman datang.</p>`;
  else html += `<p class="wait">Menunggu ${escapeHTML(playerLabel(z.host))} menekan Mulai…</p>`;
  el.innerHTML = html;
  const go = el.querySelector('#lobbyGo'); if (go) go.onclick = () => z.startFromLobby();
}
function renderRoundBar() {
  const el = $('#roundBar'); const z = activeZone; const r = z?.sharedRound;
  if (!z || !r || r.style !== 'shared') { el.hidden = true; return; }
  el.hidden = false;
  el.innerHTML = r.players.map((id) => `<span class="chip${r.done.has(id) ? ' done' : ''}">${avatarDot(avatarOf(id))}${escapeHTML(id === net.id ? 'Kamu' : remotes.get(id)?.name || 'Teman')}<b>${r.done.has(id) ? '✅' : '⏳'}</b></span>`).join('');
}
function closeResults() { $('#results').hidden = true; clearTimeout(closeResults.t); }
function showResults(z, m, me) {
  const el = $('#results'); const card = el.querySelector('.card');
  const sorted = m.results.slice().sort((a, b) => (b.ok - a.ok) || ((a.ms ?? 1e9) - (b.ms ?? 1e9)));
  const medal = ['🥇', '🥈', '🥉'];
  let html = `<div class="rh">${me?.ok ? '🎉' : '⭐'} Hasil ${escapeHTML(z.name)}</div>`;
  if (z.kind === 'quiz' && z.answerText) html += `<div class="ans">Jawaban: <b>${escapeHTML(z.answerText())}</b></div>`;
  if (z.kind === 'gallery') {
    html += `<div class="gal">${sorted.map((x) => `<figure>${x.img ? `<img src="${x.img}" alt="">` : '<div class="noimg">…</div>'}<figcaption>${escapeHTML(x.id === net.id ? 'Kamu' : x.name)}${x.pts ? ` <b>+${x.pts}</b>` : ''}</figcaption></figure>`).join('')}</div>`;
  } else {
    html += `<ol class="res">${sorted.map((x, i) => `<li class="${x.ok ? 'ok' : 'no'}"><span class="m">${x.ok ? (i < 3 ? medal[i] : '✅') : x.done ? '❌' : '⌛'}</span>${avatarDot(avatarOf(x.id))}<span class="n">${escapeHTML(x.id === net.id ? 'Kamu' : x.name)}</span>${x.ok && x.ms != null ? `<span class="tm">${(x.ms / 1000).toFixed(1)} dtk</span>` : ''}<b class="p">${x.pts ? `+${x.pts}` : ''}</b></li>`).join('')}</ol>`;
  }
  html += `<div class="top"><span>🏆 Juara ${escapeHTML(z.name)}:</span>${(m.top || []).map((t, i) => `<span>${medal[i]} ${escapeHTML(t.name)} <b>${t.points}</b></span>`).join('') || '<span>—</span>'}</div>`;
  card.innerHTML = html; el.hidden = false;
  clearTimeout(closeResults.t); closeResults.t = setTimeout(closeResults, 8500);
}
const escapeHTML = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);

/* =========================================================
   MASUK (nama pemain) & SINKRON DATA
   ========================================================= */
// orang tua & keluarga dewasa: diverifikasi dengan soal hitung setiap kali masuk
const ROLES = { ayah: ['Ayah', '👨', 'L'], ibu: ['Ibu', '👩', 'P'], kakek: ['Kakek', '👴', 'L'], nenek: ['Nenek', '👵', 'P'], paman: ['Paman', '🧔', 'L'], bibi: ['Bibi', '👱‍♀️', 'P'] };
let newRole = '';
const PROFILES_KEY = 'pulau-balok-profiles';
const localKey = (k) => `pulau-balok-v2:${k}`;
function localProfiles() { try { return JSON.parse(localStorage.getItem(PROFILES_KEY)) || []; } catch (e) { return []; } }
function rememberProfile(name) { const l = localProfiles().filter((n) => n.toLowerCase() !== name.toLowerCase()); l.unshift(name); try { localStorage.setItem(PROFILES_KEY, JSON.stringify(l.slice(0, 12))); } catch (e) { /* abaikan */ } }
function localSave(key) { try { const s = JSON.parse(localStorage.getItem(localKey(key))); if (s) return s; } catch (e) { /* kosong */ } return null; }
let roster = [];
let newGender = 'L';
function renderProfiles() {
  const box = $('#profiles'); box.innerHTML = '';
  const list = net.online ? roster : localProfiles().map((n) => { const s = localSave(n.toLowerCase()); return { name: n, gender: s?.avatar?.gender || 'L', shirt: s?.avatar?.shirt || 'biru', role: s?.avatar?.role || '', stars: s?.stars || 0, crystals: s?.crystals?.length || 0 }; });
  for (const p of list) {
    const b = document.createElement('button'); b.className = 'prof';
    const R = ROLES[p.role];
    b.innerHTML = `<span class="av" style="background:${COLORS[p.shirt] || COLORS.biru}">${R ? R[1] : p.gender === 'P' ? '👧' : '👦'}</span><span class="nm"></span><span class="st">${R ? '🔒 Orang tua' : `⭐ ${p.stars} · 💎 ${p.crystals}`}</span>`;
    b.querySelector('.nm').textContent = p.name; if (R) b.classList.add('adult');
    b.onclick = () => { ac(); SFX.tap(); if (R) parentGate(() => doLogin(p.name, false)); else doLogin(p.name, false); };
    box.appendChild(b);
  }
  $('#profEmpty').hidden = list.length > 0;
}
function showLogin() {
  $('#loading').hidden = true; $('#start').hidden = true; $('#hud').hidden = true;
  $('#login').hidden = false; renderProfiles();
  $('#netNote').textContent = net.online ? 'Tersambung ke server rumah. Bisa main bersama!' : location.protocol === 'file:' ? 'Mode sendiri (dibuka dari file).' : 'Belum tersambung ke server. Main sendiri dulu, nanti otomatis tersambung.';
}
function doLogin(name, create) {
  name = name.replace(/\s+/g, ' ').trim().slice(0, 16); if (!name) return;
  const key = name.toLowerCase();
  const fresh = () => {
    const d = structuredClone(DEFAULT); const R = ROLES[newRole];
    d.avatar.gender = R ? R[2] : newGender; d.avatar.role = R ? newRole : '';
    d.avatar.shirt = R ? (R[2] === 'P' ? 'ungu' : 'hijau') : newGender === 'P' ? 'merah muda' : 'biru'; d.updated = Date.now(); return d;
  };
  const local = localSave(key);
  if (net.online) { send({ t: 'login', name, create, data: create ? fresh() : local }); playerName = name; playerKey = key; return; }
  if (!local && !create) { openNewForm(name); return; }
  enterGame(name, local || fresh());
}
function openNewForm(name = '', adult = false) {
  newRole = adult ? newRole || 'ayah' : '';
  $('#newForm').hidden = false; $('#nameInput').value = name; $('#newPlayer').hidden = true; $('#newParent').hidden = true;
  $('#kidGender').hidden = adult; $('#roleBox').hidden = !adult;
  $('#nameInput').placeholder = adult ? 'Nama, misalnya Ali' : 'Tulis nama';
  renderRoles(); setTimeout(() => $('#nameInput').focus(), 50);
}
function renderRoles() {
  const box = $('#roleBox'); box.innerHTML = Object.entries(ROLES).map(([k, [l, e]]) => `<button class="gbtn role${k === newRole ? ' on' : ''}" data-r="${k}" aria-pressed="${k === newRole}"><span class="e">${e}</span>${l}</button>`).join('');
  box.querySelectorAll('.gbtn').forEach((b) => (b.onclick = () => { newRole = b.dataset.r; SFX.tap(); renderRoles(); updateNamePreview(); }));
  updateNamePreview();
}
function updateNamePreview() { const n = $('#nameInput').value.trim(); $('#namePreview').textContent = newRole && n ? `Akan tampil sebagai: ${ROLES[newRole][0]} ${n}` : ''; }
function enterGame(name, data) {
  playerName = name; playerKey = name.toLowerCase();
  save = merge(structuredClone(DEFAULT), data || {}); save.name = name;
  if (save.time.date !== todayStr()) save.time = { date: todayStr(), sec: 0, bonus: 0 };
  rememberProfile(name); persist(true);
  applyAvatar(); updateStars(); refreshCrystals(); updateMission(); setCamMode(dev.cam || 'sedang'); updateVitals();
  $('#worldBtn').hidden = !isAdult();
  for (const z of Object.values(zones)) { z.drawTop(); z.refresh?.(); }
  applyGraphics();
  $('#login').hidden = true; $('#start').hidden = false; $('#hello').textContent = `Halo, ${name}!`;
}
// pesan dari server
function onNet(m) {
  switch (m.t) {
    case 'hello': net.id = m.id; send({ t: 'names' }); if (playerName) send({ t: 'login', name: playerName, create: false, data: save }); break;
    case 'names': roster = m.list; if (!$('#login').hidden) renderProfiles(); break;
    case 'need_new': playerName = ''; playerKey = null; openNewForm(m.name); break;
    case 'error': toast(m.msg); break;
    case 'welcome': {
      net.id = m.id; const first = !playing && $('#start').hidden;
      Object.assign(tops, m.tops || {});
      if (first || !save.name) enterGame(m.name, m.data);
      else { for (const z of Object.values(zones)) z.drawTop(); if (activeZone) { const z = activeZone; leaveZone(); toast('Tersambung lagi'); void z; } }
      for (const id of [...remotes.keys()]) removeRemote(id);
      for (const p of m.players) addRemote(p);
      Object.assign(family, m.config || {}); net.https = m.https; myScores = m.myscores || {}; updateMission(); break;
    }
    case 'kicked': $('#kicked').hidden = false; modal = 'kicked'; stopNet(); break;
    case 'join': addRemote(m.p); if (playing) toast(`${m.p.name} datang! 👋`); break;
    case 'leave': { veh.pass.delete(m.id); const r = remotes.get(m.id); if (r && playing) toast(`${r.name} pulang`); removeRemote(m.id); break; }
    case 'move': { const r = remotes.get(m.id); if (r) r.target = m; break; }
    case 'pinfo': { const r = remotes.get(m.id); if (r) { r.avatar = m.avatar; applyAvatarTo(r.ch, m.avatar); } break; }
    case 'pzone': { const r = remotes.get(m.id); if (r) r.zone = m.zone; break; }
    case 'emote': { const r = remotes.get(m.id); if (r) startEmote(r.ch, r, m.e); break; }
    case 'poke': {
      const fr = remotes.get(m.from); if (fr) fr.punchT = 0.25;
      if (m.to === net.id) gotPoked(m, fr); else { const t = remotes.get(m.to); if (t) pokeFx(t.ch); }
      break;
    }
    case 'ride': onRideReq(m); break;
    case 'rideOk': startRide(m); break;
    case 'rideNo': toast(`🙏 Kursinya sudah penuh (maksimal ${(SEATS[m.kind] || 1) + 1} orang).`); break;
    case 'rideOff': if (veh.pass.delete(m.from)) { const r = remotes.get(m.from); toast(`${r ? r.name : 'Teman'} sudah turun`); } break;
    case 'rideEnd': if (ride && ride.driver === m.from) leaveRide(false); break;
    case 'summit': { const r = remotes.get(m.id); const nm = r?.name || m.name; if (nm) { toast(`🏆 ${nm} sampai di puncak Menara Langit!`); if (r) startEmote(r.ch, r, '🎉'); } break; }
    case 'greet': { const r = remotes.get(m.from); if (r) { say(`${r.name} menyapamu! 👋 Sapa balik, yuk. Ketuk ${r.name}.`, { force: true }); startEmote(r.ch, r, '👋'); } break; }
    case 'voice': { const r = remotes.get(m.id); if (r) r.voice = m.on; break; }
    case 'rtc': onRtc(m.from, m.data, remotes.get(m.from)?.secure ?? true); break;
    case 'top': tops[m.zone] = m.top; zones[m.zone]?.drawTop(); updateMission(); break;
    case 'myscores': myScores = m.s || {}; updateMission(); break;
    case 'full': { const z = zones[m.zone]; if (z?.active) { z.exit(); toast(`${z.name} penuh (${m.max} pemain). Coba tempat lain, ya!`); } break; }
    case 'config': Object.assign(family, m.config || {}); Object.assign(wcfg, m.config || {}); enterKey = ''; break;
    case 'world': onWorld(m); break;
    case 'zhost': zHostId = m.id; if (!amZHost()) zPending = 0; break;
    case 'zstate': onZState(m); break;
    case 'zdead': onZDead(m); break;
    case 'zhit': if (amZHost()) applyHit(m.id, m.dmg, m.by); break;
    case 'zhurt': hurtMe(zombies.get(m.zid) || { x: player.pos.x + 1, z: player.pos.z }); break;
    case 'zspawn': if (amZHost()) zPending += m.n; break;
    case 'shot': spawnShot(m.x + m.dx * 0.8, m.z + m.dz * 0.8, m.dx, m.dz, m.c || '#ffffff', false, null, m.tg ?? null); break;
    case 'notice': toast(m.msg); break;
    case 'pdown': { const r = remotes.get(m.id); if (r) { r.down = m.down; r.ch.root.visible = !m.down; if (spec.on) renderSpect(); if (m.down && playing) toast(`${r.name} kehabisan nyawa 👻`); } break; }
    case 'psettings': Object.assign(save.settings, m.settings || {}); persist(); toast('Pengaturan dari orang tua diperbarui'); break;
    case 'family': renderFamily(m); break;
    case 'room': zones[m.zone]?.onRoom(m); break;
    case 'round': { const z = zones[m.zone]; if (!z || !z.active) break; if (!z.arrived) z.pending = m; else z.playRound(m); break; }
    case 'style': zones[m.zone]?.onStyle(m); break;
    case 'rplayers': { const z = zones[m.zone]; if (z?.sharedRound?.seq === m.seq) { z.sharedRound.players = m.players; renderRoundBar(); } break; }
    case 'answered': { const z = zones[m.zone]; if (z?.sharedRound) { z.sharedRound.done.add(m.id); renderRoundBar(); } break; }
    case 'reveal': zones[m.zone]?.onReveal(m); break;
    case 'wait': { const z = zones[m.zone]; if (z?.active && z.arrived) z.waitTurn(); break; }
    default: break;
  }
}
function onNetStatus(st) {
  $('#netDot').dataset.st = st;
  // peringatan jelas bila perangkat main sendiri (server tidak berjalan / dibuka dari file)
  $('#offline').hidden = st === 'online'; $('#offWarn').hidden = st === 'online';
  if (st === 'online') { /* hello akan datang */ }
  if (st === 'lost') { for (const id of [...remotes.keys()]) removeRemote(id); if (activeZone) leaveZone(); if (playing) toast('Koneksi terputus, mencoba lagi…'); }
  if (!$('#login').hidden) showLogin();
}
let saveTimer = 0;
function pushSave() { clearTimeout(saveTimer); saveTimer = setTimeout(() => send({ t: 'save', data: save }), 1200); }

/* =========================================================
   SIANG & MALAM (jam dunia dari server; sama di semua perangkat)
   ========================================================= */
const worldSt = { phase: 'day', start: Date.now(), ends: Date.now() + 15 * 60000, offset: 0, safe: null, safeEnds: 0, rest: 0 };
const wcfg = { dayMin: 15, nightMin: 5, cycle: true, zombies: true, safeCount: 3, safeSec: 60, restSec: 30 };
const wnow = () => Date.now() + worldSt.offset;
let lastPhase = 'day';
function onWorld(m) {
  worldSt.offset = m.now - Date.now();
  const oldSafe = (worldSt.safe || []).join();
  Object.assign(worldSt, { phase: m.phase, start: m.start, ends: m.ends, safe: m.safe, safeEnds: m.safeEnds, rest: m.rest });
  Object.assign(wcfg, m.cfg || {}); Object.assign(family, m.cfg || {});
  phaseChanged();
  if ((m.safe || []).join() !== oldSafe) safeChanged();
}
function setPhaseLocal(phase) {
  const mins = phase === 'night' ? wcfg.nightMin : wcfg.dayMin;
  Object.assign(worldSt, { phase, start: wnow(), ends: wnow() + mins * 60000, rest: 0, safe: null, safeEnds: 0 });
  if (phase === 'night') rotateSafeLocal();
  phaseChanged(); safeChanged();
}
function rotateSafeLocal() {
  const n = clamp(Math.round(wcfg.safeCount || 3), 1, ZONE_IDS.length); const old = new Set(worldSt.safe || []);
  const pool = ZONE_IDS.length - old.size >= n ? ZONE_IDS.filter((z) => !old.has(z)) : ZONE_IDS.slice();
  worldSt.safe = shuffle(pool.slice()).slice(0, n); worldSt.safeEnds = wnow() + (wcfg.safeSec || 60) * 1000;
}
// zona aman: siang = semua aman; malam = hanya yang terpilih (bergantian)
const nightDanger = () => worldSt.phase === 'night' && wcfg.zombies !== false;
const isSafeZone = (z) => !nightDanger() || (worldSt.safe || []).includes(z.id);
let kickT = 0;
function safeChanged() {
  enterKey = '';
  if (!nightDanger() || !playing) return;
  const names = (worldSt.safe || []).map((id) => zones[id]?.name).filter(Boolean);
  if (activeZone && !isSafeZone(activeZone)) {
    kickT = 8;
    say(`Awas! ${activeZone.name} tidak aman lagi. Delapan detik lagi kita keluar. Lari ke zona hijau: ${names.join(', ')}!`, { force: true, stay: true });
  } else if (!activeZone && !me.down) toast(`🛡️ Zona aman sekarang: ${names.join(', ')}`);
}
function phaseChanged() {
  if (worldSt.phase === lastPhase) return;
  lastPhase = worldSt.phase;
  if (!playing) return;
  if (worldSt.phase === 'night') {
    tone(330, 0.6, { type: 'triangle', vol: 0.08 }); tone(247, 0.9, { type: 'triangle', vol: 0.08, delay: 0.3 });
    if ((save.hp ?? 3) <= 0) setTimeout(goDown, 1500);
    say(wcfg.zombies ? 'Malam tiba! Lampu-lampu menyala. Hati-hati, zombie keluar dari air mancur! Tempat bermain aman untuk berlindung.' : 'Malam tiba! Lihat, lampu-lampu menyala dan ada bintang di langit.', { force: true });
  } else {
    tone(523, 0.3, { type: 'triangle', vol: 0.1 }); tone(784, 0.4, { type: 'triangle', vol: 0.1, delay: 0.15 });
    say((save.hp ?? 3) <= 0 ? 'Pagi tiba! Zombie hilang. Nyawamu habis, tapi tenang: belajar di satu tempat bermain, nanti Kak Rara kasih satu nyawa!' : 'Pagi tiba! Matahari bersinar, zombie-zombie hilang.', { force: true });
    if (amZHost()) for (const z of [...zombies.values()]) killZombie(z.id, null, true);
    if (me.down) stopSpectate();
  }
}
// 0 = siang penuh, 1 = malam penuh (berganti pelan selama 15 detik)
function nightFactor() {
  const k = clamp((wnow() - worldSt.start) / 15000, 0, 1);
  return worldSt.phase === 'night' ? k : 1 - k;
}
const nightProgress = () => clamp((wnow() - worldSt.start) / Math.max(1, worldSt.ends - worldSt.start), 0, 1);
let warnedFor = 0, chipT = 0;
function worldTick(dt) {
  // tanpa server: jam, giliran zona aman, dan istirahat berjalan di perangkat ini
  if (!net.online) {
    if (wcfg.cycle && wnow() >= worldSt.ends) setPhaseLocal(worldSt.phase === 'day' ? 'night' : 'day');
    else if (worldSt.phase === 'night') {
      if (wnow() >= worldSt.safeEnds) { rotateSafeLocal(); safeChanged(); }
      if (me.down && !worldSt.rest) worldSt.rest = wnow() + (wcfg.restSec || 30) * 1000;
      else if (!me.down) worldSt.rest = 0;
      if (worldSt.rest && wnow() >= worldSt.rest) setPhaseLocal('day');
    }
  }
  // peringatan 1 menit sebelum malam
  const left = worldSt.ends - wnow();
  if (playing && worldSt.phase === 'day' && wcfg.cycle && wcfg.zombies !== false && left <= 60000 && left > 0 && warnedFor !== worldSt.start) {
    warnedFor = worldSt.start;
    [0, 0.45, 0.9].forEach((d) => { tone(880, 0.3, { type: 'square', vol: 0.05, delay: d }); tone(660, 0.3, { type: 'square', vol: 0.05, delay: d + 0.22 }); });
    say((save.hp ?? 3) <= 0 ? 'Satu menit lagi malam tiba! Nyawamu masih habis. Cepat belajar di satu tempat bermain supaya dapat satu nyawa!' : 'Satu menit lagi malam tiba! Siapkan nyawa dan senjata di toko. Nanti cari zona aman yang bersinar hijau, ya!', { force: true });
    toast('🌙 Satu menit lagi malam!');
  }
  // keluar otomatis bila tempat bermain berubah tidak aman
  if (kickT > 0) { kickT -= dt; if (kickT <= 0 && activeZone && !isSafeZone(activeZone)) { const z = activeZone; leaveZone(); const [x, y] = z.approach(9); walkTo(x, y); toast('Cari zona hijau yang aman!'); } }
  // jam sungguhan (bukan waktu game) supaya hitung mundur selalu tepat
  const nowR = performance.now(); if (nowR - chipT > 450) { chipT = nowR; updatePhaseChip(); }
}
const mmss = (ms) => { const t = Math.max(0, Math.ceil(ms / 1000)); return `${Math.floor(t / 60)}:${String(t % 60).padStart(2, '0')}`; };
function updatePhaseChip() {
  const el = $('#phaseChip'); let txt = '';
  const left = worldSt.ends - wnow();
  if (worldSt.phase === 'day' && wcfg.cycle && wcfg.zombies !== false && left <= 60000) txt = `🌙 Malam dalam ${mmss(left)}`;
  else if (nightDanger() && worldSt.rest) txt = `😴 Semua kehabisan nyawa · istirahat ${mmss(worldSt.rest - wnow())}, lalu pagi`;
  else if (nightDanger()) txt = `🛡️ Zona aman berganti ${mmss(worldSt.safeEnds - wnow())}`;
  el.hidden = !txt || !playing; el.textContent = txt; el.classList.toggle('warn', txt.startsWith('🌙'));
  // papan skor tiap tempat: AMAN + hitung mundur / TIDAK AMAN
  for (const z of Object.values(zones)) {
    const st = nightDanger() ? (isSafeZone(z) ? `🛡️ AMAN ${mmss(worldSt.safeEnds - wnow())}` : '⚠️ TIDAK AMAN') : '';
    if (st !== z.status) z.drawTop(st);
  }
}
function updateSafeVisuals() {
  const night = nightDanger(); const pulse = 0.55 + Math.sin(elapsed * 4) * 0.25;
  for (const z of Object.values(zones)) {
    const safe = night && isSafeZone(z);
    z.safeGlow.visible = safe; z.safeBeam.visible = safe;
    if (safe) { z.safeGlow.material.opacity = pulse; z.safeGlow.scale.setScalar(1 + Math.sin(elapsed * 4) * 0.03); }
    z.ringMat.color.set(!night ? z.color : safe ? '#3dff7a' : '#6b3b3b');
    z.ringMat.emissive.set(safe ? '#1f8a3d' : '#000000');
  }
}
const C = (h) => new THREE.Color(h);
const SKY_DAY = C('#8fd3ff'), SKY_NIGHT = C('#0b1433');
const HEMI_DAY = C('#ffffff'), HEMI_NIGHT = C('#8aa0ff'), GROUND_DAY = C('#86b76a'), GROUND_NIGHT = C('#1d2b40');
const SUN_DAY = C('#fff3d6'), SUN_NIGHT = C('#9fb4ff'), WATER_DAY = C('#4cb4ea'), WATER_NIGHT = C('#17406b');
const BULB_OFF = C('#6b6b6b'), BULB_ON = C('#fff3b0');
let starPts = null, glowPts = null, poolMesh = null, portal = null, lastN = -1;
function applyLighting() {
  const n = nightFactor(); if (Math.abs(n - lastN) < 0.002) return; lastN = n;
  scene.background.copy(SKY_DAY).lerp(SKY_NIGHT, n); scene.fog.color.copy(scene.background);
  hemi.intensity = 1.35 - n * 0.95; hemi.color.copy(HEMI_DAY).lerp(HEMI_NIGHT, n); hemi.groundColor.copy(GROUND_DAY).lerp(GROUND_NIGHT, n);
  sun.intensity = 1.7 - n * 1.35; sun.color.copy(SUN_DAY).lerp(SUN_NIGHT, n);
  waterMat.color.copy(WATER_DAY).lerp(WATER_NIGHT, n);
  bulbMat.color.copy(BULB_OFF).lerp(BULB_ON, clamp(n * 1.5, 0, 1));
  if (starPts) starPts.material.opacity = n;
  if (glowPts) glowPts.material.opacity = n * 0.9;
  if (poolMesh) poolMesh.material.opacity = n * 0.55;
  if (portal) portal.visible = n > 0.3 && wcfg.zombies;
  for (const c of crystalMeshes) if (c.on) c.m.material.emissiveIntensity = 0.45 + n * 0.6;
}
function radialTex(inner = 'rgba(255,240,170,1)', outer = 'rgba(255,240,170,0)') {
  return canvasTex(128, 128, (g) => { const gr = g.createRadialGradient(64, 64, 0, 64, 64, 64); gr.addColorStop(0, inner); gr.addColorStop(1, outer); g.fillStyle = gr; g.fillRect(0, 0, 128, 128); });
}
const bulbMat = new THREE.MeshBasicMaterial({ color: '#6b6b6b' });
// lampu taman: tiang ikut digabung (hemat), cahaya malam memakai titik bercahaya + genangan cahaya di tanah
function buildLamps() {
  const spots = [];
  for (const z of ZONE_IDS) { const [cx, cz] = ZONES_POS[z]; spots.push([cx - 3.6, cz + 6.3], [cx + 3.6, cz + 6.3]); }
  for (let i = 0; i < 18; i++) { const a = (i / 18) * Math.PI * 2 + 0.26; spots.push([Math.cos(a) * (RING + 1.6), Math.sin(a) * (RING + 1.6)]); }
  for (let i = 0; i < 26; i++) { const a = (i / 26) * Math.PI * 2; spots.push([Math.cos(a) * (RING2 + 1.6), Math.sin(a) * (RING2 + 1.6)]); }
  const ok = spots.filter(([x, z], i) => i < ZONE_IDS.length * 2 || !Object.values(ZONES_POS).some(([zx, zz]) => Math.hypot(x - zx, z - zz) < 8.5));
  const glow = [];
  for (const [x, z] of ok) {
    box(0.22, 3.0, 0.22, '#2c2f3a', x, 1.5, z, scene); box(0.6, 0.12, 0.6, '#2c2f3a', x, 3.05, z, scene);
    const b = box(0.42, 0.42, 0.42, bulbMat, x, 3.3, z, scene, false); b.castShadow = false; box(0.62, 0.12, 0.62, '#2c2f3a', x, 3.56, z, scene);
    glow.push(x, 3.3, z); colliders.push({ x, z, r: 0.3 });
  }
  const gg = new THREE.BufferGeometry(); gg.setAttribute('position', new THREE.Float32BufferAttribute(glow, 3));
  glowPts = new THREE.Points(gg, new THREE.PointsMaterial({ size: 3.4, map: radialTex(), transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending }));
  scene.add(glowPts);
  poolMesh = new THREE.InstancedMesh(new THREE.PlaneGeometry(7, 7), new THREE.MeshBasicMaterial({ map: radialTex('rgba(255,230,150,.9)', 'rgba(255,230,150,0)'), transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending }), ok.length);
  const m4 = new THREE.Matrix4(), q = new THREE.Quaternion().setFromEuler(new THREE.Euler(-Math.PI / 2, 0, 0));
  ok.forEach(([x, z], i) => poolMesh.setMatrixAt(i, m4.compose(new THREE.Vector3(x, 0.04, z), q, new THREE.Vector3(1, 1, 1))));
  poolMesh.frustumCulled = false; scene.add(poolMesh);
  // bintang
  const sp = []; for (let i = 0; i < 700; i++) { const a = rand(0, Math.PI * 2), e = rand(0.08, 1.4); sp.push(Math.cos(a) * Math.cos(e) * 260, Math.sin(e) * 260, Math.sin(a) * Math.cos(e) * 260); }
  const sg = new THREE.BufferGeometry(); sg.setAttribute('position', new THREE.Float32BufferAttribute(sp, 3));
  starPts = new THREE.Points(sg, new THREE.PointsMaterial({ size: 2, sizeAttenuation: false, color: '#ffffff', transparent: true, opacity: 0, fog: false, depthWrite: false }));
  scene.add(starPts);
}
// air mancur di pusat pulau (tempat zombie muncul saat malam)
function buildFountain() {
  const g = new THREE.Group(); scene.add(g);
  for (let i = 0; i < 28; i++) { const a = (i / 28) * Math.PI * 2; const b = box(1.25, 0.6, 0.6, pick(['#b9b3a6', '#a8a294']), Math.cos(a) * 4.6, 0.3, Math.sin(a) * 4.6, g); b.rotation.y = -a; }
  const water = new THREE.Mesh(new THREE.RingGeometry(3.05, 4.35, 40), waterMat); water.rotation.x = -Math.PI / 2; water.position.y = 0.35; g.add(water);
  const jetMat = new THREE.MeshLambertMaterial({ color: '#bfe8ff', transparent: true, opacity: 0.7 });
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2; const j = new THREE.Mesh(BOX, jetMat); j.scale.set(0.18, 1, 0.18); j.position.set(Math.cos(a) * 3.7, 0.9, Math.sin(a) * 3.7); g.add(j); j.userData.dynamic = true;
    animated.push({ obj: j, fn: (t) => { const h = 1.1 + Math.sin(t * 3 + i) * 0.35; j.scale.y = h; j.position.y = 0.35 + h / 2; } });
  }
  portal = new THREE.Mesh(new THREE.TorusGeometry(3.7, 0.18, 8, 48), new THREE.MeshBasicMaterial({ color: '#b36bf2' }));
  portal.rotation.x = -Math.PI / 2; portal.position.y = 0.5; portal.visible = false; scene.add(portal);
  animated.push({ obj: portal, fn: (t) => { portal.scale.setScalar(1 + Math.sin(t * 4) * 0.04); portal.material.color.setHSL(0.78 + Math.sin(t) * 0.05, 0.8, 0.6); } });
  const ci = colliders.findIndex((c) => c.x === 0 && c.z === 0); if (ci >= 0) colliders[ci].r = 4.9;
}

/* =========================================================
   ZOMBIE (gaya kartun: kalah = pecah jadi bintang)
   ========================================================= */
const ZK = [
  { id: 'biasa', hp: 6, speed: 2.3, scale: 1 },
  { id: 'cepat', hp: 4, speed: 3.6, scale: 0.82 },
  { id: 'besar', hp: 14, speed: 1.6, scale: 1.35 },
];
const zombies = new Map();
let zHostId = null, zSeqId = 1, zSpawnT = 0, zSendT = 0, zPending = 0;
const amZHost = () => !net.online || (net.id != null && zHostId === net.id);
// tingkat bertarung pemain ini (dari menu orang tua; otomatis = rata-rata tingkat belajarnya)
function combatLevel() {
  const L = save.settings.level || 0; if (L) return L;
  const ls = Object.values(save.zones).map((z) => z.level || 1); return clamp(Math.round(ls.reduce((a, b) => a + b, 0) / ls.length), 1, 4);
}
const DMG_MULT = [1, 3, 2, 1.5, 1]; // makin mudah, zombie makin cepat kalah
const HURT_BY = [1, 0.5, 0.5, 1, 1]; // nyawa yang hilang per pukulan zombie
function makeZombie(id, kindIdx, x, z) {
  const k = ZK[kindIdx] || ZK[0];
  const ch = makeCharacter({ shirt: '#4f7a43', pants: '#4a3b6b', skin: '#9bd77a', hair: '#3e5a2a', zombie: true });
  ch.root.scale.setScalar(k.scale); ch.shL.rotation.x = -1.45; ch.shR.rotation.x = -1.35;
  const bar = new THREE.Group(); bar.position.y = 3.25; ch.root.add(bar);
  const bg = new THREE.Mesh(BOX, mat('#1d2b53')); bg.scale.set(1.1, 0.14, 0.05); bar.add(bg);
  const fg = new THREE.Mesh(BOX, mat('#ff5a5f')); fg.scale.set(1.04, 0.1, 0.06); fg.position.z = 0.01; bar.add(fg);
  ch.root.traverse((o) => { if (o.isMesh) o.castShadow = false; }); // hemat untuk tablet
  ch.root.position.set(x, -2.4, z); scene.add(ch.root);
  const zz = { id, kind: kindIdx, x, z, tx: x, tz: z, f: 0, hp: k.hp, max: k.hp, ch, bar, fg, phase: rand(0, 6), cd: 1, rise: 0, flash: 0, speed: k.speed };
  zombies.set(id, zz); return zz;
}
function spawnZombie() {
  const night = nightProgress();
  const r = Math.random(); const kind = night > 0.55 && r < 0.18 ? 2 : night > 0.25 && r < 0.45 ? 1 : 0;
  const a = rand(0, Math.PI * 2);
  makeZombie(`${net.id || 0}-${zSeqId++}`, kind, Math.cos(a) * 3.7, Math.sin(a) * 3.7);
  tone(140, 0.5, { type: 'sawtooth', slide: 0.7, vol: 0.03 });
}
const inSafe = (x, z) => Object.values(zones).some((q) => isSafeZone(q) && Math.hypot(x - q.cx, z - q.cz) < 6.6);
function zTargets() {
  const t = [];
  if (worldSt.rest) return t; // istirahat: zombie hanya berkeliaran
  if (playing && !me.down && player.y < 1.2 && !(activeZone && isSafeZone(activeZone)) && !inSafe(player.pos.x, player.pos.z)) t.push({ id: net.id, x: player.pos.x, z: player.pos.z, me: true });
  for (const r of remotes.values()) { const p = r.ch.root.position; const rz = r.zone && zones[r.zone]; if (!r.down && p.y < 1.2 && !(rz && isSafeZone(rz)) && !inSafe(p.x, p.z)) t.push({ id: r.id, x: p.x, z: p.z }); }
  return t;
}
function zombieHostTick(dt) {
  // muncul makin sering menjelang akhir malam
  if (worldSt.phase === 'night' && wcfg.zombies && playing && !worldSt.rest) {
    const p = nightProgress(); const n = 1 + Math.max(0, remotes.size) * 0.4;
    const cap = Math.min(dev.lite ? 12 : 24, Math.round((4 + 14 * p) * Math.min(n, 2)));
    zSpawnT += dt * (0.12 + 0.55 * p) * n;
    if (zSpawnT >= 1) { zSpawnT = 0; if (zombies.size < cap) spawnZombie(); }
  }
  if (zPending > 0) { zSpawnT2 += dt; if (zSpawnT2 > 0.35) { zSpawnT2 = 0; zPending--; spawnZombie(); } }
  const targets = zTargets();
  for (const z of zombies.values()) {
    if (z.rise < 1) { z.rise = Math.min(1, z.rise + dt / 1.3); continue; }
    z.cd -= dt;
    let best = null, bd = 1e9; // peta luas: zombie mencari pemain terdekat di mana pun
    for (const t of targets) { const d = Math.hypot(t.x - z.x, t.z - z.z); if (d < bd) { bd = d; best = t; } }
    let gx, gz;
    if (best) { gx = best.x; gz = best.z; z.wx = null; }
    else {
      // semua pemain di zona aman: zombie tetap berkeliaran di sekitar tempatnya, tidak kembali ke air mancur
      if (z.wx == null || Math.hypot(z.wx - z.x, z.wz - z.z) < 1.2 || (z.wt = (z.wt || 0) - dt) <= 0) {
        const a = Math.random() * Math.PI * 2, r = 4 + Math.random() * 10; let wx = z.x + Math.cos(a) * r, wz = z.z + Math.sin(a) * r;
        const d = Math.hypot(wx, wz), lim = edgeR(wx, wz) - 4; if (d > lim) { wx *= lim / d; wz *= lim / d; }
        z.wx = wx; z.wz = wz; z.wt = 5 + Math.random() * 4;
      }
      gx = z.wx; gz = z.wz;
    }
    const dx = gx - z.x, dz = gz - z.z, d = Math.hypot(dx, dz);
    if (d > 0.9) { const st = z.speed * dt; z.x += (dx / d) * st; z.z += (dz / d) * st; z.f = Math.atan2(dx, dz); }
    // jangan saling menumpuk, tidak masuk tempat bermain, tidak menembus pohon
    for (const o of zombies.values()) { if (o === z) continue; const ox = z.x - o.x, oz = z.z - o.z, od = Math.hypot(ox, oz); if (od < 0.9 && od > 0.001) { z.x += (ox / od) * (0.9 - od) * 0.5; z.z += (oz / od) * (0.9 - od) * 0.5; } }
    for (const q of Object.values(zones)) { if (!isSafeZone(q)) continue; const ox = z.x - q.cx, oz = z.z - q.cz, od = Math.hypot(ox, oz); if (od < 7.3) { z.x = q.cx + (ox / (od || 1)) * 7.3; z.z = q.cz + (oz / (od || 1)) * 7.3; } }
    for (const c of colliders) { if (c.r > 4) continue; const ox = z.x - c.x, oz = z.z - c.z, od = Math.hypot(ox, oz), rr = c.r + 0.4; if (od < rr && od > 0.001) { z.x = c.x + (ox / od) * rr; z.z = c.z + (oz / od) * rr; } }
    W.pushOut(z, 0, 0.4);
    const pd = Math.hypot(z.x, z.z), lim = edgeR(z.x, z.z) - 2.2; if (pd > lim) { z.x *= lim / pd; z.z *= lim / pd; }
    z.tx = z.x; z.tz = z.z;
    if (best && bd < 1.2 * (ZK[z.kind].scale) + 0.2 && z.cd <= 0) {
      z.cd = 1.5; z.attackT = 0.4;
      if (best.me) hurtMe(z); else send({ t: 'zhurt', to: best.id, zid: z.id });
    }
  }
  zSendT += dt;
  if (net.online && zSendT > 0.12) { zSendT = 0; send({ t: 'zstate', list: [...zombies.values()].map((z) => [z.id, z.kind, +z.x.toFixed(2), +z.z.toFixed(2), +z.f.toFixed(2), +z.hp.toFixed(1), z.max, +z.rise.toFixed(2)]) }); }
}
let zSpawnT2 = 0;
function onZState(m) {
  if (amZHost()) return;
  const seen = new Set();
  for (const [id, kind, x, z, f, hp, max, rise] of m.list) {
    seen.add(id); const zz = zombies.get(id) || makeZombie(id, kind, x, z);
    zz.tx = x; zz.tz = z; zz.f = f; zz.hp = hp; zz.max = max; zz.rise = rise;
  }
  for (const id of [...zombies.keys()]) if (!seen.has(id)) removeZombie(id);
}
function removeZombie(id) { const z = zombies.get(id); if (!z) return; scene.remove(z.ch.root); z.ch.m.face.map?.dispose(); zombies.delete(id); }
function poof(x, z, big = true) {
  burst(new THREE.Vector3(x, 1.5, z), ['#ffd23a', '#ffffff', '#9bd77a', '#ff8fc0']);
  if (big) { tone(660, 0.12, { type: 'triangle', vol: 0.1 }); tone(990, 0.18, { type: 'triangle', vol: 0.08, delay: 0.07 }); }
}
function killZombie(id, by, sun = false) {
  const z = zombies.get(id); if (!z) return;
  poof(z.x, z.z, !sun); removeZombie(id);
  if (net.online) send({ t: 'zdead', id, by, sun });
  if (by === net.id || (!net.online && by)) rewardKill();
}
function onZDead(m) { const z = zombies.get(m.id); if (z) { poof(z.ch.root.position.x, z.ch.root.position.z, !m.sun); removeZombie(m.id); } if (m.by === net.id) rewardKill(); }
function rewardKill() { save.coins = (save.coins || 0) + 1; save.zkills = (save.zkills || 0) + 1; persist(); updateVitals(); floatText('+1 🪙'); }
// pukulan/tembakan pemain ini (kerusakan sudah dihitung sesuai tingkat pemain)
function hitZombie(id, dmg) {
  const z = zombies.get(id); if (!z) return;
  z.flash = 0.2; SFX.pop();
  if (amZHost()) applyHit(id, dmg, net.id || 'me'); else send({ t: 'zhit', id, dmg });
}
function applyHit(id, dmg, by) {
  const z = zombies.get(id); if (!z) return;
  z.hp -= dmg; z.flash = 0.2;
  const p = by === net.id || by === 'me' ? player.pos : remotes.get(by)?.ch.root.position;
  if (p) { const dx = z.x - p.x, dz = z.z - p.z, d = Math.hypot(dx, dz) || 1; z.x += (dx / d) * 0.8; z.z += (dz / d) * 0.8; }
  if (z.hp <= 0) killZombie(id, by === 'me' ? net.id || 'me' : by);
}
function updateZombies(dt) {
  if (amZHost()) zombieHostTick(dt);
  for (const z of zombies.values()) {
    const root = z.ch.root;
    if (!amZHost()) { const k = 1 - Math.exp(-dt * 10); root.position.x += (z.tx - root.position.x) * k; root.position.z += (z.tz - root.position.z) * k; z.x = root.position.x; z.z = root.position.z; }
    else root.position.set(z.x, 0, z.z);
    root.position.y = -2.4 * (1 - z.rise);
    root.rotation.y = z.f;
    z.phase += dt * 6; const sw = Math.sin(z.phase) * 0.5;
    z.ch.hipL.rotation.x = sw; z.ch.hipR.rotation.x = -sw; z.ch.body.rotation.z = Math.sin(z.phase * 0.5) * 0.08;
    z.attackT = Math.max(0, (z.attackT || 0) - dt);
    z.ch.shL.rotation.x = -1.45 + (z.attackT ? -0.6 : Math.sin(z.phase) * 0.12); z.ch.shR.rotation.x = -1.35 + (z.attackT ? -0.6 : -Math.sin(z.phase) * 0.12);
    z.fg.scale.x = 1.04 * clamp(z.hp / z.max, 0, 1); z.fg.position.x = -0.52 * (1 - clamp(z.hp / z.max, 0, 1));
    z.bar.quaternion.copy(camera.quaternion); z.bar.visible = z.hp < z.max;
    z.flash = Math.max(0, z.flash - dt); z.ch.m.skin.color.set(z.flash > 0 ? '#ffffff' : '#9bd77a');
  }
}

/* =========================================================
   NYAWA, PINGSAN, PUKUL & TEMBAK
   ========================================================= */
const me = { inv: 0, down: false, punchCd: 0, shootCd: 0, punchT: 0 };
function hurtMe(z) {
  if (me.inv > 0 || me.down || (activeZone && isSafeZone(activeZone)) || inSafe(player.pos.x, player.pos.z)) return;
  save.hp = Math.max(0, (save.hp ?? 3) - HURT_BY[combatLevel()]); me.inv = 1.2;
  const dx = player.pos.x - z.x, dz = player.pos.z - z.z, d = Math.hypot(dx, dz) || 1; player.pos.x += (dx / d) * 1.4; player.pos.z += (dz / d) * 1.4; player.vy = 4;
  const v = $('#hurt'); v.classList.remove('on'); void v.offsetWidth; v.classList.add('on');
  tone(180, 0.25, { type: 'square', slide: 0.6, vol: 0.06 });
  updateVitals(); persist();
  if (save.hp <= 0) goDown();
}
// nyawa habis: tidak bangun otomatis. Malam = menonton pemain lain (seperti CS:GO); siang = boleh jalan & belajar.
const spec = { on: false, idx: 0, id: null };
function goDown() {
  if ((save.hp ?? 3) > 0) return;
  if (activeZone) leaveZone();
  player.target = null; joyEnd();
  if (!nightDanger()) { say('Nyawamu habis. Tenang, belajar di satu tempat bermain, nanti Kak Rara kasih satu nyawa!', { force: true }); return; }
  me.down = true; send({ t: 'alive', down: true });
  say('Nyawamu habis! Sekarang kamu menonton teman. Beli nyawa di toko untuk main lagi, atau tunggu pagi.', { force: true });
  startSpectate();
}
function revive() {
  if (!me.down || (save.hp ?? 0) <= 0) return;
  me.down = false; send({ t: 'alive', down: false }); stopSpectate();
  let best = null, bd = 1e9;
  for (const q of Object.values(zones)) { if (!isSafeZone(q)) continue; const d = Math.hypot(player.pos.x - q.cx, player.pos.z - q.cz); if (d < bd) { bd = d; best = q; } }
  if (best) { const [x, z] = best.approach(3.6); teleport(x, z); }
  me.inv = 3; say('Hore, kamu main lagi! Kamu muncul di zona aman.', { force: true });
}
// siang hari: selesai belajar 1 ronde saat nyawa habis = otomatis dapat 1 nyawa (hanya bila nyawa 0)
function learnHeart() {
  if ((save.hp ?? 3) > 0 || worldSt.phase === 'night') return false;
  save.hp = 1; persist(); updateVitals(); floatText('+1 ❤️');
  tone(784, 0.15, { type: 'triangle', vol: 0.1 }); tone(1047, 0.25, { type: 'triangle', vol: 0.1, delay: 0.12 });
  return true;
}
const specTargets = () => [...remotes.values()].filter((r) => !r.down);
function startSpectate() { spec.on = true; spec.idx = 0; camMode = 'spectate'; $('#enterBtn').hidden = true; nearZone = null; enterKey = ''; $('#emotes').hidden = true; $('#spect').hidden = false; $('#fightBox').hidden = true; $('#joy').hidden = true; $('#joyZone').hidden = true; renderSpect(); }
function stopSpectate() { if (!spec.on) { me.down = false; return; } spec.on = false; me.down = false; camMode = 'follow'; $('#spect').hidden = true; $('#joy').hidden = false; $('#joyZone').hidden = false; }
function renderSpect() {
  const ts = specTargets(); if (spec.idx >= ts.length) spec.idx = 0;
  const t = ts[spec.idx]; spec.id = t?.id ?? null;
  $('#specName').textContent = t ? t.name : 'Air mancur';
  $('#specPrev').disabled = $('#specNext').disabled = ts.length < 2;
}
function spectCamera(dt) {
  const r = remotes.get(spec.id);
  if (!r || r.down) { renderSpect(); }
  const rr = remotes.get(spec.id);
  let look, target;
  if (rr) {
    const p = rr.ch.root.position, f = rr.ch.root.rotation.y;
    look = new THREE.Vector3(p.x, 1.7, p.z);
    target = new THREE.Vector3(p.x - Math.sin(f) * 10, 6, p.z - Math.cos(f) * 10);
  } else {
    look = new THREE.Vector3(0, 1, 0); const a = elapsed * 0.15; target = new THREE.Vector3(Math.sin(a) * 22, 15, Math.cos(a) * 22);
  }
  const k = 1 - Math.exp(-dt * 8); camPos.lerp(target, k); camLook.lerp(look, k);
}
const WEAPONS = {
  tangan: { name: 'Tangan', e: '👊', kind: 'melee', dmg: 1, range: 1.9 },
  pedang: { name: 'Pedang Kayu', e: '🗡️', kind: 'melee', dmg: 2, range: 2.3, price: 30 },
  palu: { name: 'Palu Mainan', e: '🔨', kind: 'melee', dmg: 3, range: 2.6, area: true, price: 60 },
  ketapel: { name: 'Ketapel', e: '🎯', kind: 'gun', dmg: 1, rate: 0.55, cost: 1, color: '#c98f52', price: 20 },
  pistolair: { name: 'Pistol Air', e: '🔫', kind: 'gun', dmg: 1, rate: 0.22, cost: 1, color: '#2ec4f0', price: 40 },
  gelembung: { name: 'Blaster Gelembung', e: '🫧', kind: 'gun', dmg: 2, rate: 0.35, cost: 1, color: '#ff8fc0', price: 80 },
  konfeti: { name: 'Meriam Konfeti', e: '🎉', kind: 'gun', dmg: 3, rate: 0.8, cost: 2, splash: 2.6, color: '#ffd23a', price: 150 },
};
function facingDir() { return CAM_MODES[view.mode].fp ? [-Math.sin(view.yaw), -Math.cos(view.yaw)] : [Math.sin(player.facing), Math.cos(player.facing)]; }
function punch() {
  if (me.down || activeZone || me.punchCd > 0 || !playing || paused()) return;
  const w = WEAPONS[save.melee] || WEAPONS.tangan; me.punchCd = 0.35; me.punchT = 0.25;
  const mult = DMG_MULT[combatLevel()];
  // bantu bidik: hadap ke zombie terdekat dalam jangkauan
  let near = null, nd = w.range + 1.2;
  for (const z of zombies.values()) { const d = Math.hypot(z.x - player.pos.x, z.z - player.pos.z); if (d < nd && z.rise >= 1) { nd = d; near = z; } }
  if (near) player.facing = Math.atan2(near.x - player.pos.x, near.z - player.pos.z);
  const [fx, fz] = [Math.sin(player.facing), Math.cos(player.facing)];
  let hit = false;
  for (const z of [...zombies.values()]) {
    const dx = z.x - player.pos.x, dz = z.z - player.pos.z, d = Math.hypot(dx, dz);
    if (z.rise < 1 || d > w.range + 0.3 * ZK[z.kind].scale) continue;
    if (d > 1.1 && (dx * fx + dz * fz) / d < 0.25) continue;
    hitZombie(z.id, w.dmg * mult); hit = true; if (!w.area) break;
  }
  // pukul teman: main-main saja, nyawa tidak berkurang (teman terdorong sedikit)
  if (!hit) {
    let tgt = null, td = 2.2;
    for (const r of remotes.values()) {
      if (r.down || r.zone) continue; const p = r.ch.root.position, d = Math.hypot(p.x - player.pos.x, p.z - player.pos.z);
      if (d < td && Math.abs((r.target.y || 0) - player.y) < 1.5) { td = d; tgt = r; }
    }
    if (tgt) {
      const p = tgt.ch.root.position, dx = (p.x - player.pos.x) / (td || 1), dz = (p.z - player.pos.z) / (td || 1);
      player.facing = Math.atan2(dx, dz); send({ t: 'poke', to: tgt.id, dx: +dx.toFixed(2), dz: +dz.toFixed(2) });
      pokeFx(tgt.ch, false); hit = true;
    }
  }
  if (hit) SFX.punch(); else SFX.swing();
}
function pokeFx(ch, sound = true) {
  const p = ch.root.position; burst(new THREE.Vector3(p.x, p.y + 1.8, p.z), ['#ffd23a', '#ffffff', '#ff8a2a']);
  if (sound && Math.hypot(p.x - player.pos.x, p.z - player.pos.z) < 25) SFX.punch();
}
// dipukul teman: terdorong sedikit + bunyi, nyawa tetap
function gotPoked(m, fr) {
  SFX.punch(); floatText('💥 Duk!'); burst(player.pos.clone().add(new THREE.Vector3(0, 1.8 + player.y, 0)), ['#ffd23a', '#ffffff', '#ff8a2a']);
  if (activeZone || modal || eatSt.on || (player.y > 1 && W.inTower(player.pos.x, player.pos.z))) return;
  player.knock = { x: (m.dx || 0) * 4, z: (m.dz || 0) * 4, t: 0.2 }; player.vy = 3.5; player.onGround = false;
  if (fr) toast(`${fr.name} memukulmu (main-main) 😄`);
}
const shots = [];
const SHOT_GEO = new THREE.BoxGeometry(0.32, 0.32, 0.32);
function spawnShot(x, z, dx, dz, color, real, w, target = null) {
  const m = new THREE.Mesh(SHOT_GEO, new THREE.MeshBasicMaterial({ color })); m.position.set(x, 1.6 + (real ? player.y : 0), z); scene.add(m);
  shots.push({ m, dx, dz, life: 1.4, real, w, target });
}
function shoot() {
  if (me.down || activeZone || me.shootCd > 0 || !playing || paused()) return;
  const w = WEAPONS[save.gun];
  if (!w) { toast('Belum punya senjata tembak. Beli di Toko 🛒'); return; }
  if ((save.ammo || 0) < w.cost) { toast('Amunisi habis! Beli di Toko 🛒'); SFX.soft(); return; }
  save.ammo -= w.cost; me.shootCd = w.rate; updateVitals();
  let [dx, dz] = facingDir();
  if (!CAM_MODES[view.mode].fp) { dx = -Math.sin(view.yaw); dz = -Math.cos(view.yaw); }
  // bidik otomatis ke zombie terdekat di depan (supaya mudah untuk anak)
  let best = null, bs = 1e9;
  for (const z of zombies.values()) {
    if (z.rise < 1) continue; const ox = z.x - player.pos.x, oz = z.z - player.pos.z, d = Math.hypot(ox, oz);
    if (d > 26) continue; const dot = (ox * dx + oz * dz) / (d || 1);
    const sc = d * (1.8 - dot); if (sc < bs) { bs = sc; best = z; } // utamakan yang di depan & dekat, tapi semua arah bisa
  }
  if (best) { const ox = best.x - player.pos.x, oz = best.z - player.pos.z, d = Math.hypot(ox, oz); dx = ox / d; dz = oz / d; }
  player.facing = Math.atan2(dx, dz); me.punchT = 0.18;
  spawnShot(player.pos.x + dx * 0.8, player.pos.z + dz * 0.8, dx, dz, w.color, true, w, best?.id);
  send({ t: 'shot', x: +player.pos.x.toFixed(2), z: +player.pos.z.toFixed(2), dx: +dx.toFixed(3), dz: +dz.toFixed(3), c: w.color, tg: best?.id ?? null });
  tone(save.gun === 'konfeti' ? 200 : 700, 0.12, { type: 'square', slide: 0.5, vol: 0.05 });
  if (save.ammo === 0) toast('Amunisi habis');
  persist();
}
function updateShots(dt) {
  for (let i = shots.length - 1; i >= 0; i--) {
    const s = shots[i]; s.life -= dt; const st = 24 * dt;
    // peluru mengejar zombie sasaran (bidik otomatis untuk anak)
    const tz = s.target != null && zombies.get(s.target);
    if (tz) { const ox = tz.x - s.m.position.x, oz = tz.z - s.m.position.z, od = Math.hypot(ox, oz) || 1; s.dx = ox / od; s.dz = oz / od; s.m.position.y += (1.4 - s.m.position.y) * Math.min(1, dt * 6); }
    s.m.position.x += s.dx * st; s.m.position.z += s.dz * st; s.m.rotation.y += dt * 10;
    let hitZ = null;
    if (s.real) for (const z of zombies.values()) { if (z.rise < 1) continue; if (Math.hypot(z.x - s.m.position.x, z.z - s.m.position.z) < 0.75 + 0.4 * ZK[z.kind].scale) { hitZ = z; break; } }
    if (hitZ) {
      const mult = DMG_MULT[combatLevel()];
      if (s.w.splash) { burst(s.m.position.clone(), ['#ffd23a', '#ff8fc0', '#7cc8f5', '#ffffff']); for (const z of [...zombies.values()]) if (Math.hypot(z.x - hitZ.x, z.z - hitZ.z) < s.w.splash) hitZombie(z.id, s.w.dmg * mult); }
      else hitZombie(hitZ.id, s.w.dmg * mult);
    }
    if (hitZ || s.life <= 0) { scene.remove(s.m); s.m.material.dispose(); shots.splice(i, 1); }
  }
}
function updateCombat(dt) {
  me.inv = Math.max(0, me.inv - dt); me.punchCd = Math.max(0, me.punchCd - dt); me.shootCd = Math.max(0, me.shootCd - dt);
  if (me.punchT > 0) { me.punchT -= dt; player.ch.shR.rotation.x = -1.6 - Math.sin((me.punchT / 0.25) * Math.PI) * 0.8; }
  if (me.inv > 0 && !me.down) player.ch.root.visible = player.ch.root.visible && Math.floor(elapsed * 12) % 2 === 0;
  // tombol pukul selalu ada (siang juga); tombol tembak hanya saat malam/ada zombie
  const show = playing && !activeZone && !me.down, night = worldSt.phase === 'night' || zombies.size > 0;
  $('#fightBox').hidden = !show; $('#shootBtn').hidden = !night;
}
function floatText(t) { const el = document.createElement('div'); el.className = 'floatTxt'; el.textContent = t; document.body.appendChild(el); setTimeout(() => el.remove(), 1200); }
function updateVitals() {
  const hp = save.hp ?? 3, mx = save.maxHp || 5; let h = '';
  for (let i = 1; i <= mx; i++) h += hp >= i ? '❤️' : hp >= i - 0.5 ? '💔' : '🤍';
  $('#hearts').textContent = h; $('#coinCount').textContent = save.coins || 0;
  const w = WEAPONS[save.gun]; $('#shootBtn').innerHTML = `${w ? w.e : '🔫'}<small>${save.ammo || 0}</small>`;
  $('#punchBtn').textContent = (WEAPONS[save.melee] || WEAPONS.tangan).e;
}

/* =========================================================
   TOKO: tukar bintang belajar jadi koin, beli senjata, amunisi, nyawa
   ========================================================= */
const STAR_RATE = 5;
const SHOP_ITEMS = [
  { id: 'nyawa', name: 'Nyawa +1', e: '❤️', price: 15, kind: 'heart' },
  { id: 'nyawapenuh', name: 'Nyawa penuh', e: '💖', price: 40, kind: 'heartfull' },
  { id: 'wadah', name: 'Tambah wadah nyawa', e: '💗', price: 100, kind: 'maxheart' },
  { id: 'ammo20', name: 'Amunisi ×20', e: '📦', price: 10, kind: 'ammo', qty: 20 },
  { id: 'ammo60', name: 'Amunisi ×60', e: '🧰', price: 25, kind: 'ammo', qty: 60 },
  ...['pedang', 'palu', 'ketapel', 'pistolair', 'gelembung', 'konfeti'].map((id) => ({ id, name: WEAPONS[id].name, e: WEAPONS[id].e, price: WEAPONS[id].price, kind: 'weapon' })),
];
function openShop() {
  if (activeZone) leaveZone();
  openModal('shop'); renderShop();
  say(`Selamat datang di toko! Satu bintang belajar bisa ditukar jadi ${STAR_RATE} koin.`);
}
function renderShop() {
  const owned = save.weapons || ['tangan'];
  $('#shopBal').innerHTML = `<span>⭐ <b>${save.stars}</b></span><span>🪙 <b>${save.coins || 0}</b></span><span>${$('#hearts').textContent}</span><span>📦 <b>${save.ammo || 0}</b></span>`;
  $('#shopSwap').innerHTML = [1, 5].map((n) => `<button class="chunky sun" data-n="${n}" ${save.stars < n ? 'disabled' : ''}>⭐${n} → 🪙${n * STAR_RATE}</button>`).join('') + `<button class="chunky sun" data-n="all" ${save.stars < 1 ? 'disabled' : ''}>Tukar semua ⭐</button>`;
  $('#shopSwap').querySelectorAll('button').forEach((b) => (b.onclick = () => {
    const n = b.dataset.n === 'all' ? save.stars : +b.dataset.n; if (save.stars < n || n < 1) return;
    save.stars -= n; save.coins = (save.coins || 0) + n * STAR_RATE; persist(); updateStars(); updateVitals(); SFX.good(); celebrate('small'); renderShop();
  }));
  const grid = $('#shopGrid'); grid.innerHTML = '';
  for (const it of SHOP_ITEMS) {
    const isW = it.kind === 'weapon'; const has = isW && owned.includes(it.id); const w = WEAPONS[it.id];
    const equipped = isW && (save.melee === it.id || save.gun === it.id);
    const maxed = (it.kind === 'maxheart' && (save.maxHp || 5) >= 8) || ((it.kind === 'heart' || it.kind === 'heartfull') && (save.hp ?? 3) >= (save.maxHp || 5));
    const card = document.createElement('div'); card.className = 'item' + (equipped ? ' eq' : '');
    card.innerHTML = `<span class="e">${it.e}</span><b></b><small>${isW ? (w.kind === 'gun' ? `Tembak · kuat ${w.dmg}` : `Pukul · kuat ${w.dmg}`) : ''}</small><button class="chunky ${has ? '' : 'leaf'}"></button>`;
    card.querySelector('b').textContent = it.name;
    const btn = card.querySelector('button');
    if (has) { btn.textContent = equipped ? 'Dipakai' : 'Pakai'; btn.disabled = equipped; btn.onclick = () => { if (w.kind === 'gun') save.gun = it.id; else save.melee = it.id; persist(); updateVitals(); SFX.tap(); speak(`${it.name} dipakai!`); renderShop(); }; }
    else {
      btn.textContent = maxed ? 'Penuh' : `🪙 ${it.price}`; btn.disabled = maxed || (save.coins || 0) < it.price;
      btn.onclick = () => buy(it);
    }
    grid.appendChild(card);
  }
}
function buy(it) {
  if ((save.coins || 0) < it.price) { toast('Koin belum cukup. Belajar dulu, yuk, untuk dapat bintang!'); return; }
  save.coins -= it.price;
  if (it.kind === 'heart') save.hp = Math.min(save.maxHp || 5, (save.hp ?? 3) + 1);
  else if (it.kind === 'heartfull') save.hp = save.maxHp || 5;
  else if (it.kind === 'maxheart') { save.maxHp = Math.min(8, (save.maxHp || 5) + 1); save.hp = (save.hp ?? 3) + 1; }
  else if (it.kind === 'ammo') save.ammo = (save.ammo || 0) + it.qty;
  else if (it.kind === 'weapon') { save.weapons = [...new Set([...(save.weapons || ['tangan']), it.id])]; if (WEAPONS[it.id].kind === 'gun') { save.gun = it.id; if (!save.ammo) save.ammo = 10; } else save.melee = it.id; }
  persist(); updateVitals(); SFX.good(); celebrate('small'); speak(`Hore, kamu membeli ${it.name}!`); renderShop();
  if (me.down && save.hp > 0) { closeModal('shop'); revive(); }
}

/* =========================================================
   PANEL DUNIA UNTUK ORANG TUA (siang/malam & zombie, diverifikasi soal)
   ========================================================= */
const isAdult = () => ROLES_ADULT.has(save.avatar.role);
function openWorldPanel() {
  openModal('worldPanel');
  const left = Math.max(0, Math.round((worldSt.ends - wnow()) / 1000));
  $('#worldNow').textContent = `Sekarang ${worldSt.phase === 'night' ? 'malam 🌙' : 'siang ☀️'} · ${wcfg.cycle ? `berganti dalam ${Math.floor(left / 60)}:${String(left % 60).padStart(2, '0')}` : 'siklus otomatis mati'}`;
}
function worldAction(a) {
  closeModal('worldPanel'); SFX.tap();
  if (a === 'night' || a === 'day') { if (!send({ t: 'setPhase', phase: a })) setPhaseLocal(a); }
  else { const n = +a; if (net.online) send({ t: 'zspawn', n }); else zPending += n; if (worldSt.phase === 'day') toast('Zombie siang hari hilang saat pagi berikutnya… atau kalahkan mereka!'); }
}

/* =========================================================
   LEMARI BAJU
   ========================================================= */
let wardTab = 'shirt';
let camMode = 'intro';
let prevCam = 'follow';
function openWardrobe() {
  prevCam = camMode === 'intro' ? 'intro' : camMode;
  if (activeZone) leaveZone();
  player.target = null;
  camMode = 'wardrobe'; player.facing = 0;
  $('#wardrobe').hidden = false; modal = 'wardrobe';
  $('#start').hidden = true; $('#hud').hidden = true;
  renderSwatches();
}
function closeWardrobe() {
  $('#wardrobe').hidden = true; modal = null;
  if (!playing) { camMode = 'intro'; $('#start').hidden = false; }
  else { camMode = 'follow'; $('#hud').hidden = false; player.facing = Math.PI; }
}
function renderSwatches() {
  document.querySelectorAll('.tabs button').forEach((b) => b.setAttribute('aria-selected', String(b.dataset.tab === wardTab)));
  const box = $('#swatches'); box.innerHTML = '';
  const a = save.avatar;
  if (wardTab === 'shirt' || wardTab === 'pants') {
    for (const nm of WEAR) {
      const b = document.createElement('button'); b.className = 'sw'; b.style.background = COLORS[nm];
      b.setAttribute('aria-label', nm); b.setAttribute('aria-pressed', String(a[wardTab] === nm));
      b.onclick = () => { a[wardTab] = nm; persist(); applyAvatar(); SFX.tap(); speak(`${wardTab === 'shirt' ? 'Baju' : 'Celana'} ${nm}!`); renderSwatches(); };
      box.appendChild(b);
    }
  } else if (wardTab === 'skin') {
    SKINS.forEach((c, i) => {
      const b = document.createElement('button'); b.className = 'sw'; b.style.background = c;
      b.setAttribute('aria-label', `Warna kulit ${i + 1}`); b.setAttribute('aria-pressed', String(a.skin === i));
      b.onclick = () => { a.skin = i; persist(); applyAvatar(); SFX.tap(); renderSwatches(); };
      box.appendChild(b);
    });
  } else {
    for (const [id, h] of Object.entries(HATS)) {
      const owned = save.hats.includes(id);
      const b = document.createElement('button'); b.className = 'hat';
      b.innerHTML = owned ? h.name : `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round"><rect x="5" y="11" width="14" height="10" rx="2"/><path d="M8 11V8a4 4 0 0 1 8 0v3"/></svg>${h.name}`;
      b.disabled = !owned; b.setAttribute('aria-pressed', String(a.hat === id));
      if (!owned) b.title = h.tower ? 'Capai puncak Menara Langit untuk membuka' : h.zone ? `Main di ${zones[h.zone].name} untuk membuka` : 'Selesaikan semua petualangan';
      b.onclick = () => { a.hat = id; persist(); applyAvatar(); SFX.tap(); renderSwatches(); };
      box.appendChild(b);
    }
    const p = document.createElement('p'); p.className = 'note'; p.style.margin = '8px 0 0'; p.style.width = '100%';
    p.textContent = 'Topi terkunci terbuka bersama Kristal Pelangi: main 3 ronde di tiap tempat bermain.'; box.appendChild(p);
  }
}
document.querySelectorAll('.tabs button').forEach((b) => (b.onclick = () => { wardTab = b.dataset.tab; SFX.tap(); renderSwatches(); }));
$('#wardrobeDone').onclick = () => { SFX.tap(); closeWardrobe(); };

/* =========================================================
   ORANG TUA: GERBANG, PANEL, BATAS WAKTU
   ========================================================= */
function parentGate(onOk) {
  const a = randi(5, 9), b = randi(4, 9), ans = a + b;
  $('#gateQ').textContent = `${a} + ${b} = ?`;
  const opts = new Set([ans]); while (opts.size < 4) opts.add(ans + pick([-3, -2, -1, 1, 2, 3]));
  const wrap = $('#gateAns'); wrap.innerHTML = '';
  shuffle([...opts]).forEach((v) => {
    const btn = document.createElement('button'); btn.className = 'chunky'; btn.textContent = v;
    btn.onclick = () => { $('#gate').hidden = true; if (v === ans) onOk(); };
    wrap.appendChild(btn);
  });
  $('#gate').hidden = false;
}
$('#gateCancel').onclick = () => ($('#gate').hidden = true);
const DIFFICULTY = ['Otomatis (menyesuaikan)', 'Mudah', 'Sedang', 'Sulit', 'Sangat sulit'];
const LEVEL_NAMES = {
  kebun: ['Berhitung 1–3', 'Berhitung 1–5', 'Berhitung 3–7', 'Berhitung 5–10'],
  warna: ['3 warna', '4 warna', '5 warna', 'Besar & kecil'],
  hewan: ['Nama hewan', 'Bunyi hewan', 'Huruf awal'],
  pola: ['Pola AB', 'Pola AAB / ABB', 'Pola ABC', 'Pola AABB / ABAC'],
  bentuk: ['3 bentuk', '6 bentuk', 'Bentuk & warna', 'Cocokkan bayangan'],
  ikan: ['Lebih banyak', 'Lebih sedikit', 'Bandingkan 3 ember', 'Sama banyak'],
  musik: ['Ingat 2 nada', 'Ingat 3 nada', 'Ingat 4 nada', 'Ingat 5 nada'],
  kembar: ['2 pasang', '3 pasang', '4 pasang', '6 pasang'],
  ukuran: ['3 menara', '4 menara', '5 menara', 'Tinggi ke pendek'],
  rasa: ['3 perasaan', '5 perasaan', 'Cerita perasaan'],
  tulis: ['Garis', 'Angka', 'Huruf vokal', 'Huruf lain'],
  mtk: ['Tambah satu', 'Tambah sampai 5', 'Kurang sampai 5', 'Tambah & kurang sampai 10'],
  gambar: ['Bebas & contoh'],
  puzzle: ['4 potong', '6 potong', '9 potong', '12 potong'],
  huruf: ['Huruf', 'Suku kata', 'Kata', 'Kalimat pendek'],
  angka: ['Angka 1–10', 'Angka 11–20', 'Angka 21–99', 'Angka 100–999'],
  iqro: ["Iqro' 1: huruf berfathah", "Iqro' 2: huruf bersambung", "Iqro' 3: fathah, kasrah, dhammah", "Iqro' 4: bacaan campuran"],
};
function fmtMin(s) { return Math.floor(s / 60); }
function openParent() {
  const prevModal = modal; modal = 'parent';
  const s = save.settings;
  const used = fmtMin(save.time.sec);
  $('#timeLine').textContent = !playerName ? '' : s.limit
    ? `${playerName}: hari ini sudah main ${used} menit dari batas ${s.limit + Math.round(save.time.bonus / 60)} menit.`
    : `${playerName}: hari ini sudah main ${used} menit. Batas harian tidak aktif.`;
  // data semua pemain dari server (atau pemain ini saja bila tanpa server)
  if (!send({ t: 'family' })) renderFamily({ players: playerName ? [{ name: playerName, role: save.avatar.role || '', settings: save.settings, today: used, stars: save.stars, crystals: save.crystals.length, zones: save.zones }] : [], config: family });
  $('#setRate').value = String(dev.rate);
  setToggle($('#setSfx'), dev.sfx); setToggle($('#setLite'), dev.lite); setToggle($('#setChat'), dev.chat !== false);
  renderVoices();
  const url = location.href.split('#')[0];
  $('#urlText').textContent = url;
  const local = /^(localhost|127\.|\[?::1)/.test(location.hostname);
  $('#urlWarn').textContent = local ? 'Alamat ini hanya bisa dibuka di komputer ini. Pakai alamat yang tampil di jendela Terminal (diawali 192.168…) agar perangkat lain bisa masuk.' : '';
  if (net.https && location.protocol === 'http:') $('#urlWarn').textContent += ` Untuk obrolan suara (mikrofon), buka https://${location.hostname}:${net.https} lalu pilih "Lanjutkan" pada peringatan keamanan.`;
  try {
    const qr = window.qrcode(0, 'M'); qr.addData(url); qr.make();
    $('#qrBox').innerHTML = qr.createSvgTag({ cellSize: 4, margin: 2, scalable: true });
  } catch (e) { $('#qrBox').textContent = ''; }
  $('#parent').hidden = false;
  $('#parent')._prev = prevModal;
}
const LIMITS = [[15, '15 menit'], [20, '20 menit'], [30, '30 menit'], [45, '45 menit'], [60, '60 menit'], [90, '90 menit'], [0, 'Tanpa batas']];
let famData = [];
function renderFamily(m) {
  famData = m.players || []; Object.assign(family, m.config || {});
  $('#setMax').value = String(family.maxPlayers);
  Object.assign(wcfg, m.config || {});
  $('#setDay').value = String(wcfg.dayMin); $('#setNight').value = String(wcfg.nightMin);
  setToggle($('#setCycle'), wcfg.cycle !== false); setToggle($('#setZombie'), wcfg.zombies !== false);
  $('#setSafeN').value = String(wcfg.safeCount); $('#setSafeSec').value = String(wcfg.safeSec); $('#setRest').value = String(wcfg.restSec);
  const body = $('#famBody'); body.innerHTML = '';
  if (!famData.length) body.innerHTML = '<tr><td colspan="6">Belum ada pemain.</td></tr>';
  for (const p of famData) {
    const st = p.settings || {}; const online = [...remotes.values()].some((r) => r.name === p.name) || p.name === playerName;
    const tr = document.createElement('tr');
    tr.innerHTML = `<td><b></b>${p.role ? '<span class="role">dewasa</span>' : ''}</td>
      <td><select class="lvSel">${DIFFICULTY.map((d, i) => `<option value="${i}">${d}</option>`).join('')}</select></td>
      <td><select class="limSel">${LIMITS.map(([v, l]) => `<option value="${v}">${l}</option>`).join('')}</select></td>
      <td>${p.today} mnt</td><td>${p.stars} · ${p.crystals}</td>
      <td><button class="del" title="Hapus pemain" ${online ? 'disabled' : ''}>🗑️</button></td>`;
    tr.querySelector('b').textContent = p.name;
    const lv = tr.querySelector('.lvSel'), lim = tr.querySelector('.limSel');
    lv.value = String(st.level || 0); lim.value = String(st.limit ?? 20);
    const apply = () => {
      const set = { level: +lv.value, limit: +lim.value };
      if (p.name === playerName) { Object.assign(save.settings, set); persist(); }
      send({ t: 'setPlayer', name: p.name, settings: set });
    };
    lv.onchange = apply; lim.onchange = apply;
    tr.querySelector('.del').onclick = (e) => {
      const b = e.currentTarget;
      if (!b.dataset.armed) { b.dataset.armed = '1'; b.textContent = 'Yakin?'; setTimeout(() => { delete b.dataset.armed; b.textContent = '🗑️'; }, 3500); return; }
      send({ t: 'deletePlayer', name: p.name });
    };
    body.appendChild(tr);
  }
  const who = $('#progWho'); const cur = who.value || playerName;
  who.innerHTML = famData.map((p) => `<option></option>`).join('');
  [...who.options].forEach((o, i) => { o.value = o.textContent = famData[i].name; });
  if (famData.some((p) => p.name === cur)) who.value = cur;
  renderProgress();
}
function renderProgress() {
  const p = famData.find((x) => x.name === $('#progWho').value) || famData[0];
  const body = $('#progBody'); body.innerHTML = '';
  if (!p) return;
  const fixed = p.settings?.level || 0;
  for (const z of Object.values(zones)) {
    const q = (p.name === playerName ? save.zones : p.zones || {})[z.id] || { level: 1, rounds: 0, first: 0 };
    const lv = fixed ? clamp(fixed, 1, z.maxLevel) : q.level;
    const acc = q.rounds ? Math.round((q.first / q.rounds) * 100) + '%' : '–';
    const tr = document.createElement('tr');
    tr.innerHTML = `<td></td><td></td><td>${q.rounds}</td><td>${acc}</td>`;
    tr.children[0].textContent = z.name; tr.children[1].textContent = LEVEL_NAMES[z.id][lv - 1];
    body.appendChild(tr);
  }
}
$('#progWho').onchange = renderProgress;
$('#setMax').onchange = (e) => { family.maxPlayers = +e.target.value; send({ t: 'setConfig', config: { maxPlayers: family.maxPlayers } }); };
// pengaturan dunia (siang/malam & zombie); tanpa server berlaku di perangkat ini saja
function setWorldCfg(c) { Object.assign(wcfg, c); if (!send({ t: 'setConfig', config: c })) { const mins = worldSt.phase === 'night' ? wcfg.nightMin : wcfg.dayMin; worldSt.ends = worldSt.start + mins * 60000; } }
$('#setDay').onchange = (e) => setWorldCfg({ dayMin: +e.target.value });
$('#setSafeN').onchange = (e) => setWorldCfg({ safeCount: +e.target.value });
$('#setSafeSec').onchange = (e) => setWorldCfg({ safeSec: +e.target.value });
$('#setRest').onchange = (e) => setWorldCfg({ restSec: +e.target.value });
$('#setNight').onchange = (e) => setWorldCfg({ nightMin: +e.target.value });
$('#setCycle').onclick = (e) => { setWorldCfg({ cycle: !(wcfg.cycle !== false) }); setToggle(e.currentTarget, wcfg.cycle); };
$('#setZombie').onclick = (e) => { setWorldCfg({ zombies: !(wcfg.zombies !== false) }); setToggle(e.currentTarget, wcfg.zombies); };
function renderVoices() {
  loadVoices();
  const sel = $('#setVoice'); sel.innerHTML = '';
  const add = (value, label) => { const o = document.createElement('option'); o.value = value; o.textContent = label; sel.appendChild(o); };
  add('', 'Otomatis (pilih yang terbaik)');
  for (const v of idVoices) add(v.voiceURI, `${v.name}${v.localService ? '' : ' · butuh internet'}`);
  sel.value = idVoices.some((v) => v.voiceURI === dev.voice) ? dev.voice : '';
  const natural = idVoices.some((v) => voiceScore(v) >= 30);
  $('#voiceNote').textContent = !hasTTS ? 'Browser ini tidak mendukung suara. Teks tetap tampil di layar.'
    : !idVoices.length ? 'Suara bahasa Indonesia belum ada di perangkat ini. Lihat petunjuk di bawah untuk memasangnya.'
      : `Sedang dipakai: ${voiceId ? voiceId.name : 'suara bawaan'}.` + (natural ? '' : ' Suara ini masih kaku. Pasang suara yang lebih alami dengan petunjuk di bawah.');
}
function setToggle(el, on) { el.setAttribute('aria-pressed', String(on)); el.textContent = on ? 'Nyala' : 'Mati'; }
$('#parentClose').onclick = () => { $('#parent').hidden = true; modal = $('#parent')._prev || null; if (modal === 'rest') checkTime(true); };
$('#setVoice').onchange = (e) => { dev.voice = e.target.value; persistDev(); loadVoices(); renderVoices(); speak('Halo! Aku Kak Rara. Apa kabar? Yuk, kita main bersama!'); };
$('#voiceTest').onclick = () => speak('Halo! Aku Kak Rara. Wah, kamu sudah datang! Hari ini kita mau main apa, ya?');
$('#setRate').onchange = (e) => { dev.rate = +e.target.value; persistDev(); speak('Halo! Ini kecepatan suaraku.'); };
$('#setSfx').onclick = (e) => { dev.sfx = !dev.sfx; setToggle(e.currentTarget, dev.sfx); persistDev(); };
$('#setChat').onclick = (e) => { dev.chat = dev.chat === false; setToggle(e.currentTarget, dev.chat); if (!dev.chat && net.mic) { micOff(); $('#micBtn').classList.remove('on'); } persistDev(); };
$('#setLite').onclick = (e) => { dev.lite = !dev.lite; setToggle(e.currentTarget, dev.lite); persistDev(); applyGraphics(); };
$('#resetBtn').onclick = (e) => {
  const b = e.currentTarget;
  if (!b.dataset.armed) { b.dataset.armed = '1'; b.textContent = 'Yakin? Ketuk sekali lagi'; setTimeout(() => { delete b.dataset.armed; b.textContent = 'Hapus semua kemajuan'; }, 4000); return; }
  const keep = save.settings, nm = save.name, gd = save.avatar.gender; save = structuredClone(DEFAULT); save.settings = keep; save.name = nm; save.avatar.gender = gd; persist();
  applyAvatar(); updateStars(); refreshCrystals(); updateMission(); b.textContent = 'Kemajuan dihapus'; delete b.dataset.armed;
  openParent();
};
$('#parentBtn').onclick = () => parentGate(openParent);
$('#startParent').onclick = () => parentGate(openParent);

let warned = false;
function limitSec() { return save.settings.limit ? save.settings.limit * 60 + save.time.bonus : Infinity; }
function checkTime(recheck = false) {
  if (save.time.date !== todayStr()) { save.time = { date: todayStr(), sec: 0, bonus: 0 }; warned = false; persist(); }
  const lim = limitSec();
  if (recheck && modal === 'rest' && save.time.sec < lim) { closeModal('rest'); return; }
  if (!playing || modal) return;
  if (!warned && lim - save.time.sec < 120 && lim - save.time.sec > 0) { warned = true; say('Sebentar lagi waktunya istirahat ya. Selesaikan permainanmu.'); }
  if (save.time.sec >= lim) {
    leaveZone(); player.target = null;
    openModal('rest'); say('Waktunya istirahat. Yuk main di luar atau baca buku bersama Ayah dan Bunda!');
  }
}
$('#restMore').onclick = () => parentGate(() => { save.time.bonus += 600; warned = false; persist(); closeModal('rest'); });

/* =========================================================
   TOMBOL HUD
   ========================================================= */
$('#homeBtn').onclick = () => { SFX.tap(); leaveZone(); walkTo(0, 7); };
$('#enterBtn').onclick = () => enterNear();
$('#punchBtn').onclick = () => punch();
$('#spBack').onclick = () => { SFX.tap(); const z = activeZone; leaveZone(); if (z) { const [x, y] = z.approach(9); walkTo(x, y); } };
$('#spSay').onclick = () => { if (lastLine) speak(lastLine); };
// tombol tahan-untuk-bicara (sentuh & mouse)
const spMic = $('#spMic');
spMic.addEventListener('pointerdown', (e) => { e.preventDefault(); try { spMic.setPointerCapture(e.pointerId); } catch (er) { /* abaikan */ } speakZone?.startRec(); });
for (const ev of ['pointerup', 'pointercancel', 'lostpointercapture']) spMic.addEventListener(ev, () => speakZone?.stopRec());
spMic.addEventListener('contextmenu', (e) => e.preventDefault());
$('#spHear').onclick = () => { SFX.tap(); speakZone?.manualHear(); };
$('#spYes').onclick = () => { SFX.tap(); speakZone?.manualYes(); };
$('#spNo').onclick = () => { SFX.tap(); speakZone?.manualNo_(); };
$('#specPrev').onclick = () => { SFX.tap(); spec.idx = (spec.idx - 1 + specTargets().length) % Math.max(1, specTargets().length); renderSpect(); };
$('#specNext').onclick = () => { SFX.tap(); spec.idx = (spec.idx + 1) % Math.max(1, specTargets().length); renderSpect(); };
$('#specShop').onclick = () => { SFX.tap(); openShop(); };
$('#shootBtn').onclick = () => shoot();
$('#shopBtn').onclick = () => { SFX.tap(); openShop(); };
$('#shopClose').onclick = () => { SFX.tap(); closeModal('shop'); };
$('#worldBtn').onclick = () => { SFX.tap(); parentGate(openWorldPanel); };
$('#worldClose').onclick = () => { SFX.tap(); closeModal('worldPanel'); };
document.querySelectorAll('#worldPanel [data-a]').forEach((b) => (b.onclick = () => worldAction(b.dataset.a)));
function openMap() {
  leaveZone(); player.target = null; marker.visible = false; joyEnd();
  const wrap = $('#mapPins'); wrap.innerHTML = '';
  const S = R + 4; const pct = (v) => `${50 + (v / S) * 50}%`;
  const target = missionZone();
  const pin = (x, z, emoji, label, color, go, badge = '', hot = false) => {
    const b = document.createElement('button'); b.className = 'pin'; b.style.left = pct(x); b.style.top = pct(z); b.style.setProperty('--c', color);
    b.innerHTML = `<span class="e">${emoji}</span><span class="l"></span>`; b.querySelector('.l').textContent = label;
    if (badge) { const s2 = document.createElement('span'); s2.className = 'bd'; s2.textContent = badge; b.appendChild(s2); }
    if (hot) b.classList.add('hot');
    b.setAttribute('aria-label', label);
    b.onclick = () => { SFX.tap(); closeModal('map'); go(); };
    wrap.appendChild(b);
  };
  for (const z of Object.values(zones)) pin(z.cx, z.cz, ZONE_EMOJI[z.id], z.name, z.color, () => {
    const [x, y] = z.approach(); teleport(x, y); view.yaw = Math.atan2(-(z.cx - x), -(z.cz - y));
    say(`Wuss! Kita sampai di ${z.name}! Ketuk tombol Masuk kalau mau bermain.`);
  }, [nightDanger() && isSafeZone(z) ? '🛡️' : '', tops[z.id]?.[0]?.name === playerName ? '🥇' : '', save.crystals.includes(z.id) ? '💎' : '', ...[...remotes.values()].filter((r) => r.zone === z.id).map((r) => (r.avatar?.gender === 'P' ? '👧' : '👦'))].join(''), z === target);
  pin(0, 0, '⛲', 'Tengah', '#f3e7c6', () => { teleport(0, 7); view.yaw = 0; say('Wuss! Kita kembali ke tengah pulau.'); });
  for (const p of Object.values(W.PLACES)) pin(p.x, p.z, p.emoji, p.name, '#ffffff', () => {
    const [x, z] = p.go, [lx, lz] = p.look || [p.x, p.z]; teleport(x, z); view.yaw = Math.atan2(-(lx - x), -(lz - z));
    say(`Wuss! Kita sampai di ${p.name}!${p === W.PLACES.menara ? ' Ayo panjat sampai puncak!' : ' Ayo jalan-jalan!'}`);
  });
  const me = $('#mapMe'); me.style.left = pct(player.pos.x); me.style.top = pct(player.pos.z);
  for (const r of remotes.values()) { if (r.zone) continue; const d = document.createElement('span'); d.className = 'friend'; d.style.left = pct(r.ch.root.position.x); d.style.top = pct(r.ch.root.position.z); d.textContent = r.name; wrap.appendChild(d); }
  openModal('map');
  say('Mau main di mana? Ketuk gambarnya!');
}
$('#mapBtn').onclick = () => { SFX.tap(); openMap(); };
$('#mapClose').onclick = () => { SFX.tap(); closeModal('map'); };
$('#exitBtn').onclick = () => { SFX.tap(); const z = activeZone; leaveZone(); if (z) { const [x, y] = z.approach(9); walkTo(x, y); view.yaw = Math.atan2(z.cx, z.cz); } };
{ // tombol lompat: bereaksi saat disentuh (bukan saat dilepas), jadi bisa sambil menahan joystick; ditahan = terus melompat
  const jb = $('#jumpBtn');
  jb.addEventListener('pointerdown', (e) => { e.preventDefault(); try { jb.setPointerCapture(e.pointerId); } catch (er) { /* abaikan */ } player.jumpHeld = true; jump(); });
  const up = () => { player.jumpHeld = false; };
  jb.addEventListener('pointerup', up); jb.addEventListener('pointercancel', up); jb.addEventListener('lostpointercapture', up);
  jb.addEventListener('click', (e) => { if (e.detail === 0) jump(); }); // keyboard / pembaca layar
}
$('#repeatBtn').onclick = () => { if (lastLine) speak(lastLine); };
$('#wardrobeBtn').onclick = () => { SFX.tap(); openWardrobe(); };
$('#startWardrobe').onclick = () => { ac(); SFX.tap(); openWardrobe(); };
$('#camBtn').onclick = () => { SFX.tap(); const i = CAM_ORDER.indexOf(view.mode); setCamMode(CAM_ORDER[(i + 1) % CAM_ORDER.length], true); dev.cam = view.mode; persistDev(); };
$('#mission').onclick = () => { SFX.tap(); tellMission(); };
// putar layar: Otomatis -> Miring -> Tegak (kunci orientasi butuh layar penuh; iPhone/iPad tidak mengizinkan)
const ROT = { auto: 'Putar otomatis', landscape: 'Layar miring', portrait: 'Layar tegak' };
$('#rotBtn').onclick = async () => {
  SFX.tap(); const order = ['auto', 'landscape', 'portrait'];
  dev.rot = order[(order.indexOf(dev.rot || 'auto') + 1) % order.length]; persistDev();
  const o = screen.orientation;
  if (!o || !o.lock) { toast('Perangkat ini tidak bisa diputar dari game. Putar perangkat langsung, dan matikan kunci rotasi di Pusat Kontrol.'); return; }
  try {
    if (dev.rot === 'auto') { o.unlock(); if (document.fullscreenElement) await document.exitFullscreen(); }
    else { if (!document.fullscreenElement) await document.documentElement.requestFullscreen({ navigationUI: 'hide' }); await o.lock(dev.rot); }
    toast(`🔄 ${ROT[dev.rot]}`);
  } catch (e) { toast('Putar layar tidak diizinkan browser ini. Putar perangkat langsung, ya.'); }
};
$('#emoteBtn').onclick = () => { SFX.tap(); const w = $('#emotes'); w.hidden = !w.hidden; };
$('#emotes').innerHTML = EMOTES.map((e) => `<button class="em" data-e="${e}">${e}</button>`).join('');
$('#emotes').querySelectorAll('.em').forEach((b) => (b.onclick = () => { $('#emotes').hidden = true; doEmote(b.dataset.e); }));
$('#micBtn').onclick = async () => {
  SFX.tap(); const b = $('#micBtn');
  if (!dev.chat) { toast('Obrolan suara dimatikan di menu Orang Tua'); return; }
  if (net.mic) { micOff(); b.classList.remove('on'); toast('Mikrofon mati'); return; }
  if (!net.voiceOK) { toast(net.https ? `Untuk bicara, buka alamat https (port ${net.https})` : 'Mikrofon butuh alamat https'); return; }
  try { await micOn(); b.classList.add('on'); toast('Mikrofon nyala. Teman bisa mendengarmu!'); } catch (e) { toast('Mikrofon tidak diizinkan'); }
};
$('#kickedOk').onclick = () => location.reload();
$('#switchPlayer').onclick = () => { SFX.tap(); persist(); send({ t: 'zone', zone: null }); location.reload(); };
$('#newPlayer').onclick = () => { SFX.tap(); openNewForm(''); };
document.querySelectorAll('#kidGender .gbtn').forEach((b) => (b.onclick = () => { newGender = b.dataset.g; SFX.tap(); document.querySelectorAll('#kidGender .gbtn').forEach((x) => x.setAttribute('aria-pressed', String(x === b))); }));
$('#createBtn').onclick = () => {
  ac(); SFX.tap(); let n = $('#nameInput').value.replace(/\s+/g, ' ').trim(); if (!n) { $('#nameInput').focus(); return; }
  if (newRole) n = `${ROLES[newRole][0]} ${n}`.slice(0, 20);
  doLogin(n, true);
};
$('#newParent').onclick = () => { SFX.tap(); parentGate(() => openNewForm('', true)); };
$('#nameInput').addEventListener('input', updateNamePreview);
$('#nameInput').addEventListener('keydown', (e) => { if (e.key === 'Enter') $('#createBtn').click(); });

let playing = false;
let hinted = false;
function portraitHint() {
  if (hinted || !playing) return;
  if (window.innerWidth < window.innerHeight && window.innerWidth < 600) { hinted = true; toast('Putar HP ke samping agar layar lebih luas'); }
}
$('#playBtn').onclick = () => {
  ac(); SFX.good();
  playing = true; $('#start').hidden = true; $('#hud').hidden = false; camMode = 'follow';
  checkTime(); setTimeout(portraitHint, 4000);
  if (modal === 'rest') return;
  if (!save.greeted) {
    say(`${greeting()} Halo, ${playerName}! Aku Kak Rara. Misi kita: kumpulkan poin sebanyak-banyaknya di tempat bermain mana pun yang kamu suka, dan jadilah juara satu! Sentuh dan geser di layar kiri untuk berjalan. Sampai di tempat bermain, ketuk tombol Masuk. Malam hari ada zombie, jadi kumpulkan koin untuk senjata dan nyawa, ya!`);
    save.greeted = true; persist();
  } else say(`${greeting()} Senang ketemu kamu lagi, ${playerName}! ${pick(RARA_TIPS)}`);
  updateMission();
};

/* =========================================================
   MENARA LANGIT, GUNUNG, KAPAL & WARGA (lihat world.js)
   ========================================================= */
const HAZ_SPEED = [1, 0.55, 0.7, 0.85, 1]; // rintangan menara mengikuti tingkat pemain (mudah = lebih pelan)
function pushTrees(p, r = 0.45) {
  for (const c of colliders) {
    const ox = p.x - c.x, oz = p.z - c.z; const dd = Math.hypot(ox, oz); const rr = c.r + r;
    if (dd < rr && dd > 0.0001) { p.x = c.x + (ox / dd) * rr; p.z = c.z + (oz / dd) * rr; }
  }
}
const SAFE_BELOW = 3; // jatuh sebelum mencapai lantai 3 tidak mengurangi nyawa
const climb = { cp: 0, ready: false, warnT: 0, peakDone: false, shipSt: '', chip: '' };
function onLand(ev) {
  if (para.phase) { landPara(); return; }
  if (player.y <= W.WATER_Y + 0.01 && !ev.s) { SFX.splash(); burst(new THREE.Vector3(player.pos.x, -0.6, player.pos.z), ['#ffffff', '#bfe8ff', '#7cc8f5']); return; }
  if (ev.s?.bounce) { // trampolin: melontarkan pemain dan mendaratkannya tepat di pijakan berikutnya
    const v = ev.s.bounce * (player.jumpHeld || player.jumpBuf > 0 ? 1.3 : 1), to = ev.s.launchTo;
    player.vy = v; player.onGround = false; player.peak = player.y;
    if (to) {
      const dh = to.y - player.y, disc = v * v - 2 * W.GRAV * dh;
      const t = disc > 0 ? (v + Math.sqrt(disc)) / W.GRAV : 0.8;
      const dx = to.x - player.pos.x, dz = to.z - player.pos.z;
      player.knock = { x: dx / t, z: dz / t, t, lock: true }; player.target = null; marker.visible = false;
    }
    tone(220, 0.35, { slide: 2.6, vol: 0.12 }); tone(330, 0.2, { type: 'triangle', slide: 1.8, vol: 0.06, delay: 0.05 }); return;
  }
  if (ev.fall > 3.2 && playing && !me.down && W.inTower(player.pos.x, player.pos.z)) towerFall();
  else if (ev.fall > 1.4) tone(150, 0.1, { type: 'triangle', vol: 0.07 });
}
function fellInSea() {
  const [x, z] = W.ship.pierStart; teleport(x, z, 0.21);
  say('Byur! Kamu tercebur ke laut. Untung bisa berenang ke dermaga. Hati-hati, ya!', { force: true });
}
// jatuh dari menara: nyawa berkurang satu, mulai lagi dari lantai aman terakhir
function towerFall() {
  const T = W.TOWER;
  if (climb.cp < SAFE_BELOW) { // belum terlalu tinggi: nyawa aman
    const f = W.tower.floors[climb.cp] || W.tower.floors[0];
    if (climb.cp > 0 || player.y > 1) teleport(T.x + (f.L % 2 ? -2.6 : 2.6), T.z, f.y);
    tone(300, 0.2, { type: 'triangle', slide: 0.7, vol: 0.06 });
    say(`Uups, jatuh! Tidak apa-apa, nyawamu aman. ${f.L ? `Coba lagi dari Lantai ${f.L}` : 'Coba lagi'}, ya!`, { force: true });
    return;
  }
  save.hp = Math.max(0, (save.hp ?? 3) - 1); persist(); updateVitals();
  const v = $('#hurt'); v.classList.remove('on'); void v.offsetWidth; v.classList.add('on');
  tone(200, 0.35, { type: 'square', slide: 0.5, vol: 0.06 });
  if (save.hp <= 0) { climb.cp = 0; climb.ready = false; teleport(T.x + T.fence + 3, T.z + 2, 0); goDown(); return; }
  const f = W.tower.floors[climb.cp] || W.tower.floors[0];
  teleport(T.x + (f.L % 2 ? -2.6 : 2.6), T.z, f.y);
  say(`Aduh, jatuh! Nyawa berkurang satu. ${f.L ? `Coba lagi dari Lantai ${f.L}` : 'Coba lagi dari bawah'}, ya. Kamu pasti bisa!`, { force: true });
}
function knockBack([hx, hz]) {
  const T = W.TOWER; let ox = player.pos.x - T.x, oz = player.pos.z - T.z; const od = Math.hypot(ox, oz) || 1; ox /= od; oz /= od;
  const kx = hx * 0.7 + ox * 0.8, kz = hz * 0.7 + oz * 0.8, kl = Math.hypot(kx, kz) || 1;
  const pw = [5, 3.5, 4.2, 5, 6][combatLevel()] || 5;
  player.knock = { x: (kx / kl) * pw, z: (kz / kl) * pw, t: 0.3 }; player.vy = 4.5; player.onGround = false; player.coyote = 0;
  me.knockCd = 1.2; player.target = null; marker.visible = false;
  tone(240, 0.2, { type: 'square', slide: 0.5, vol: 0.06 }); floatText('Uups! 💥');
}
async function summit() {
  climb.ready = false; save.summits = (save.summits || 0) + 1;
  const got = [];
  if (!save.hats.includes('pendaki')) { save.hats.push('pendaki'); got.push('⛑️ Helm Pendaki (topi baru!)'); }
  const pool = shuffle([
    () => { const n = randi(3, 6); save.stars += n; return `⭐ ${n} bintang`; },
    () => { const n = randi(5, 12); save.coins = (save.coins || 0) + n; return `🪙 ${n} koin`; },
    () => { const n = randi(6, 12); save.ammo = (save.ammo || 0) + n; return `📦 ${n} amunisi`; },
    ...((save.hp ?? 3) < (save.maxHp || 5) ? [() => { save.hp = Math.min(save.maxHp || 5, (save.hp ?? 3) + 1); return '❤️ 1 nyawa'; }] : []),
  ]);
  for (const f of pool.slice(0, got.length ? 2 : 3)) got.push(f());
  persist(); updateStars(); updateVitals();
  celebrate('mega', 'PUNCAK!'); SFX.fanfare(); burst(player.pos.clone().add(new THREE.Vector3(0, 3 + player.y, 0)), CRYSTAL_COLORS);
  send({ t: 'summit' });
  $('#rewardTitle').textContent = 'Selamat! Kamu sampai di puncak!';
  const rt = $('#rewardText'); rt.textContent = 'Kamu hebat dan pantang menyerah! Hadiahmu:';
  for (const g of got) { const b = document.createElement('b'); b.style.display = 'block'; b.style.fontSize = '22px'; b.textContent = g; rt.appendChild(b); }
  openModal('reward');
  say(`Selamat! Kamu sampai di puncak Menara Langit! Kamu hebat dan pantang menyerah. Hadiahmu: ${got.map((g) => g.replace(/^\S+\s/, '')).join(', ')}! Untuk turun, injak lingkaran biru.`, { stay: true, force: true });
  await new Promise((res) => { $('#rewardOk').onclick = () => { closeModal('reward'); res(); }; });
}
function towerChip(dT) {
  const T = W.TOWER; let t = '';
  if (dT < T.fence && player.y > 0.6) t = `🗼 ${Math.round(player.y)} m · 🏢 Lantai ${climb.cp}/${T.N}`;
  if (t === climb.chip) return; climb.chip = t;
  const el = $('#towerChip'); el.hidden = !t; el.textContent = t;
}
// malam: bangunan, menara, gunung, laut & bandara ditutup. Satu-satunya tempat aman = lingkaran zona aman.
function nightRules(dt, night) {
  if (!night || me.down) return;
  if (veh.kind === 'jetski' || veh.kind === 'plane') { endRide('night'); return; }
  if (ride && ride.kind !== 'atv') { leaveRide(true, true); return; }
  if (ride || performance.now() - (climb.kickAt || 0) < 1200) return;
  const T = W.TOWER, x = player.pos.x, z = player.pos.z;
  const inside = Math.hypot(x - T.x, z - T.z) < T.fence + 0.5 || W.inBuilding(x, z) || (player.onGround && player.y > 1.0) || swimming() || W.onShip(player);
  if (!inside) return;
  climb.kickAt = performance.now(); climb.cp = 0;
  const sea = swimming() || W.onShip(player);
  let best = null, bd = 1e9;
  for (const p of Object.values(W.PLACES)) { if (sea && p !== W.PLACES.kapal) continue; const d = Math.hypot(p.x - x, p.z - z); if (d < bd) { bd = d; best = p; } }
  if (best) teleport(best.go[0], best.go[1], 0);
  if (!climb.nightSaid || performance.now() - climb.nightSaid > 20000) { climb.nightSaid = performance.now(); say('Malam tiba! Bangunan, menara, dan laut ditutup. Tempat aman hanya di lingkaran zona aman yang hijau. Ayo ke sana!', { force: true }); }
}
function rideLift() {
  const price = W.LIFT.price;
  if ((save.coins || 0) < price) { SFX.soft(); say(`Koinmu belum cukup. Perlu ${price} koin. Tukar bintang jadi koin di Toko, ya! Atau mendaki tangga, gratis!`, { force: true }); return; }
  if (!W.liftGo()) return;
  save.coins -= price; persist(); updateVitals(); floatText(`-${price} 🪙`); hideAction(); climb.liftBtn = false;
  climb.ready = false; // hadiah puncak hanya untuk yang mendaki
  tone(523, 0.15, { type: 'triangle', vol: 0.08 }); tone(784, 0.2, { type: 'triangle', vol: 0.08, delay: 0.15 });
  say('Pintu ditutup. Lift naik ke puncak! Pegangan, ya!', { force: true });
}
function horn() { tone(196, 0.7, { type: 'sawtooth', vol: 0.04 }); tone(147, 0.9, { type: 'sawtooth', vol: 0.04, delay: 0.75 }); }
function worldPlay(dt) {
  const T = W.TOWER, hp = save.hp ?? 3;
  W.setTowerLevel(combatLevel()); // jumlah rintangan & pagar menara mengikuti level dari orang tua
  const fogK = Math.round(Math.max(0, player.y) / 4) * 4; // kabut menjauh saat pemain tinggi (pulau tetap terlihat dari puncak)
  if (fogK !== climb.fogK) { climb.fogK = fogK; scene.fog.near = 90 + fogK; scene.fog.far = 250 + fogK * 1.6; }
  // gerbang menara terbuka hanya bila nyawa minimal 1
  const nightD = nightDanger(); W.setNight(worldSt.phase === 'night');
  const shut = hp < 1 || me.down || nightD, g = W.tower.gate;
  if (g.on !== shut) { g.on = shut; g.mesh.visible = shut; }
  const dT = Math.hypot(player.pos.x - T.x, player.pos.z - T.z);
  climb.warnT -= dt;
  if (shut && dT > T.fence - 0.5 && dT < T.fence + 3 && Math.abs(Math.atan2(player.pos.z - T.z, player.pos.x - T.x)) < 0.35 && climb.warnT <= 0) {
    climb.warnT = 9; if (nightD) say('Menara ditutup saat malam. Cari lingkaran zona aman yang hijau, ya!', { force: true }); else say('Gerbang menara tertutup karena nyawamu habis. Belajar dulu di tempat bermain supaya dapat nyawa, lalu kembali ke sini, ya!', { force: true });
  }
  if (dT < T.fence + 0.5) {
    if (player.onGround) for (const f of W.tower.floors) {
      const onSlab = Math.abs(player.pos.x - T.x) <= f.half + 0.1 && Math.abs(player.pos.z - T.z) <= f.half + 0.1;
      if (Math.abs(player.y - f.y) > 0.05 || !(onSlab || player.standOn === f.conn)) continue;
      if (f.L === 0) { climb.ready = true; climb.cp = 0; }
      else if (f.L > climb.cp) {
        climb.cp = f.L;
        if (f.L < T.N) { SFX.good(); floatText(`🏢 Lantai ${f.L}`); }
      }
      if (f.L === T.N && climb.ready && !modal) summit();
    }
    const d = W.tower.down;
    if (d && !modal && Math.abs(player.y - d.y) < 0.3 && Math.hypot(player.pos.x - d.x, player.pos.z - d.z) < 1.1) {
      climb.cp = 0; teleport(T.x + T.fence + 3, T.z + 2, 0); say('Wuss! Kamu sudah turun. Mau naik lagi? Masuk lewat gerbang, ya!');
    }
  } else if (player.y < 1) climb.cp = 0;
  towerChip(dT);
  nightRules(dt, nightD);
  // tempat sewa ATV / jetski
  const rk = modal ? null : nearRental();
  if (rk !== (climb.rentBtn ?? null)) {
    climb.rentBtn = rk;
    if (rk) { const r = W.RENT[rk]; showAction(`${r.emoji} Sewa ${r.name} · 🪙 ${r.price} · ${r.min} menit`, () => rent(rk)); }
    else if (!activeZone && !veh.kind && !ride && !climb.liftBtn && !climb.joinBtn) hideAction();
  }
  // ikut naik kendaraan teman
  const dr = modal ? null : nearDriver(), jid = dr ? dr.id : null;
  if (jid !== (climb.joinBtn ?? null)) {
    climb.joinBtn = jid;
    if (dr) showAction(`🙋 Ikut naik bersama ${dr.name}`, () => askRide(dr));
    else if (!activeZone && !veh.kind && !ride && !climb.rentBtn && !climb.liftBtn) hideAction();
  }
  // lift ke puncak: bayar koin
  const wantLift = W.onLift(player) && W.LIFT.state === 'idle' && !modal && !nightD;
  if (wantLift !== !!climb.liftBtn) { climb.liftBtn = wantLift; if (wantLift) { showAction(`🛗 Naik ke puncak · 🪙 ${W.LIFT.price}`, rideLift); say(`Mau naik lift ke puncak? Harganya ${W.LIFT.price} koin. Ketuk tombolnya!`); } else if (!activeZone) hideAction(); }
  // rintangan menara mendorong pemain (bisa membuat jatuh)
  me.knockCd = Math.max(0, (me.knockCd || 0) - dt);
  if (me.knockCd <= 0 && !me.down && !modal) { const hit = W.hazardHit(player.pos.x, player.y, player.pos.z); if (hit) knockBack(hit); }
  // puncak gunung
  const M = W.MOUNT;
  if (!climb.peakDone && player.onGround && player.y > M.top - 0.1 && Math.hypot(player.pos.x - M.x, player.pos.z - M.z) < M.half + 1) {
    climb.peakDone = true; celebrate('small', 'PUNCAK!'); SFX.good();
    say('Hore! Kamu sampai di puncak gunung! Lihat, seluruh pulau kelihatan dari sini. Dingin, ada salju!');
  } else if (climb.peakDone && player.y < 2) climb.peakDone = false;
  // pengumuman kapal untuk yang ada di dekat dermaga / di atas kapal
  const S = W.ship, K2 = W.PLACES.kapal;
  const nearShip = Math.hypot(player.pos.x - K2.x, player.pos.z - K2.z) < 26 || player.standOn === S.deck;
  const st = S.docked ? (S.left < 6 ? 'soon' : 'dock') : 'sail';
  if (st !== climb.shipSt) {
    const prev = climb.shipSt; climb.shipSt = st;
    if (nearShip && prev) {
      if (st === 'soon') toast('⛵ Kapal berangkat sebentar lagi! Ayo naik!');
      else if (st === 'sail') { toast('⛵ Kapal berangkat! Tuuut!'); horn(); }
      else if (st === 'dock') toast('⚓ Kapal sudah sampai di dermaga.');
    }
  }
}
/* ---------- kendaraan sewaan: ATV (darat) & jetski (laut) ---------- */
const veh = { kind: null, until: 0, v: 0, yaw: 0, mesh: null, warned: false, spray: 0, ending: false, pass: new Map(), fl: null, climb: 0, bank: 0 };
// kode pose/kendaraan yang dikirim ke teman: 4 ATV, 5 jetski, 8 pesawat (pengemudi); 6/7/9 = penumpangnya
const VEH_P = { atv: 4, jetski: 5, plane: 8 }, PASS_P = { atv: 6, jetski: 7, plane: 9 }, P_KIND = { 4: 'atv', 5: 'jetski', 8: 'plane', 6: 'atv', 7: 'jetski', 9: 'plane' };
const VEH_OFF = { 4: 0.18, 5: -1.0, 8: 0, 6: 0.3, 7: -0.9, 9: 0 }, VEH_MESH_Y = { 4: -0.18, 5: 0.4, 8: 0 }, VEH_MESH_Z = { 4: 0, 5: 0, 8: -1.2 };
const SEAT_BACK = { atv: 0.75, jetski: 0.8, plane: 1.0 };
const SEATS = { atv: 1, jetski: 1, plane: 3 }; // jumlah penumpang (selain pengemudi): ATV & jetski 2 orang, pesawat 4 orang
const makeVehMesh = (code) => (code === 4 ? W.makeATV() : code === 5 ? W.makeJetski() : W.makePlane());
const vehCode = () => (veh.kind ? VEH_P[veh.kind] : ride ? PASS_P[ride.kind] : 0);
let ride = null; // menumpang kendaraan teman: { driver, kind }
function nearRental() {
  if (veh.kind || ride) return null;
  for (const [k, r] of Object.entries(W.RENT)) if (r.x != null && Math.abs(player.y - (r.y ?? 0.12)) < 1 && Math.hypot(player.pos.x - r.x, player.pos.z - r.z) < 2.6) return k;
  return null;
}
function rent(kind) {
  const r = W.RENT[kind];
  if (kind !== 'atv' && nightDanger()) { SFX.soft(); say(`Penyewaan ${r.name} tutup saat malam. Buka lagi besok pagi, ya!`, { force: true }); return; }
  if ((save.coins || 0) < r.price) { SFX.soft(); say(`Koinmu belum cukup. Sewa ${r.name} perlu ${r.price} koin. Tukar bintang jadi koin di Toko, ya!`, { force: true }); return; }
  save.coins -= r.price; persist(); updateVitals(); floatText(`-${r.price} 🪙`); hideAction(); climb.rentBtn = null;
  if (kind === 'jetski') { const [x, z] = r.water; teleport(x, z, -0.35); }
  if (kind === 'plane') { const [x, z] = r.start; teleport(x, z, r.top); }
  veh.pass.clear();
  Object.assign(veh, { kind, until: Date.now() + r.min * 60000, v: 0, yaw: kind === 'jetski' ? r.yaw + Math.PI / 2 : r.yaw, warned: false, climb: 0, bank: 0, fl: kind === 'plane' ? { phase: 'ready' } : null });
  const code = VEH_P[kind]; veh.mesh = makeVehMesh(code); veh.mesh.position.set(0, VEH_MESH_Y[code], VEH_MESH_Z[code]); player.ch.root.add(veh.mesh);
  player.facing = veh.yaw; view.yaw = veh.yaw + Math.PI;
  tone(110, 0.4, { type: 'sawtooth', slide: 1.8, vol: 0.05 });
  if (kind === 'plane') { showAction('🛫 Terbang!', takeoff); say('Selamat datang di pesawat! Teman boleh ikut naik dulu. Kalau sudah siap, ketuk tombol Terbang!', { force: true }); }
  else { showAction('⏹️ Selesai', () => endRide('done')); say(kind === 'atv' ? 'Brum brum! Joystick ke depan untuk jalan, ke kiri dan kanan untuk belok. Teman bisa ikut naik di belakang!' : 'Wuuush! Jetski siap! Kelilingi pulau lewat laut. Jangan masuk area berenang, ya!', { force: true }); }
}
function takeoff() {
  if (veh.kind !== 'plane' || veh.fl.phase !== 'ready') return;
  veh.fl.phase = 'roll'; showAction('🛬 Mendarat', () => endRide('done'));
  tone(90, 1.2, { type: 'sawtooth', slide: 2.5, vol: 0.05 }); say('Lepas landas! Joystick kiri dan kanan untuk belok, ke atas untuk naik, ke bawah untuk turun.', { force: true });
}
function endRide(reason) {
  if (!veh.kind) return; const r = W.RENT[veh.kind], k = veh.kind;
  for (const id of veh.pass.keys()) send({ t: 'rideEnd', to: id }); veh.pass.clear();
  veh.kind = null; veh.v = 0; veh.fl = null; if (veh.mesh) player.ch.root.remove(veh.mesh); veh.mesh = null; hideAction(); $('#vehChip').hidden = true;
  if ((k === 'jetski' || k === 'plane') && reason !== 'map') { veh.ending = true; const [x, z] = r.back; teleport(x, z, k === 'plane' ? r.top : 0.12); veh.ending = false; }
  if (reason === 'night') say(`Malam tiba! ${r.name} harus kembali. Cari lingkaran zona aman, ya!`, { force: true });
  else if (reason === 'time') say(k === 'plane' ? 'Waktu terbang habis. Pesawat sudah mendarat dengan selamat di bandara!' : `Waktu sewa ${r.name} habis. Terima kasih sudah menyewa! Mau lagi? Sewa lagi di tempat penyewaan, ya.`, { force: true });
  else if (reason === 'done') say(k === 'plane' ? 'Pesawat mendarat dengan selamat. Terima kasih sudah terbang!' : `Terima kasih sudah naik ${r.name}!`, { force: true });
}
function steerCam(dt) { if (look.id === null && !view.dragging) { let d = veh.yaw + Math.PI - view.yaw; d = Math.atan2(Math.sin(d), Math.cos(d)); view.yaw += d * Math.min(1, dt * 2.5); } }
// pesawat: siap -> melaju di landasan -> terbang (tidak bisa jatuh atau menabrak)
function planeTick(dt, sx, sy) {
  const fl = veh.fl, steer = clamp(sx, -1, 1), up = clamp(-sy, -1, 1);
  if (fl.phase === 'ready') { veh.v = 0; return; }
  if (fl.phase === 'roll') {
    veh.v = Math.min(22, veh.v + 9 * dt); if (veh.v > 14) player.y += (veh.v - 14) * 0.9 * dt;
    if (player.y > W.RENT.plane.top + 10) fl.phase = 'fly';
  } else {
    veh.yaw -= steer * 1.1 * dt; veh.bank += (steer * 0.6 - veh.bank) * Math.min(1, dt * 4);
    veh.climb += (up * 9 - veh.climb) * Math.min(1, dt * 3); veh.v += (20 - veh.v) * Math.min(1, dt);
    // tinggi aman: di atas pohon, gunung, dan menara
    const M = W.MOUNT, T = W.TOWER;
    let minY = 12; if (Math.hypot(player.pos.x - M.x, player.pos.z - M.z) < 16) minY = M.top + 8;
    player.y = clamp(player.y + veh.climb * dt, minY, 150); if (player.y <= minY + 0.01 && veh.climb < 0) veh.climb = 0;
    const td = Math.hypot(player.pos.x - T.x, player.pos.z - T.z);
    if (td < 20 && player.y < T.N * T.H + 8) { const k = 20 / (td || 1); player.pos.x = T.x + (player.pos.x - T.x) * k; player.pos.z = T.z + (player.pos.z - T.z) * k; }
    // jangan terlalu jauh: belok pelan kembali ke pulau
    const pd = Math.hypot(player.pos.x, player.pos.z);
    if (pd > 165) { const toC = Math.atan2(-player.pos.x, -player.pos.z); let d = toC - veh.yaw; d = Math.atan2(Math.sin(d), Math.cos(d)); veh.yaw += d * Math.min(1, dt * 1.2); }
  }
  player.pos.x += Math.sin(veh.yaw) * veh.v * dt; player.pos.z += Math.cos(veh.yaw) * veh.v * dt;
  if (veh.mesh) { veh.mesh.rotation.z = -veh.bank; veh.mesh.rotation.x = -veh.climb * 0.03; veh.mesh.userData.prop.rotation.z += dt * 30; }
}
function vehicleTick(dt, sx, sy) {
  player.facing = veh.yaw; player.target = null; marker.visible = false;
  if (veh.kind === 'plane') { planeTick(dt, sx, sy); player.facing = veh.yaw; steerCam(dt); return; }
  const jet = veh.kind === 'jetski', throttle = clamp(-sy, -1, 1), steer = clamp(sx, -1, 1), max = jet ? 15 : 12;
  const want = throttle >= 0 ? throttle * max : throttle * 5;
  veh.v += (want - veh.v) * Math.min(1, dt * (throttle ? 1.5 : 0.9));
  veh.yaw -= steer * 1.9 * dt * clamp(veh.v / 4, -1, 1);
  player.pos.x += Math.sin(veh.yaw) * veh.v * dt; player.pos.z += Math.cos(veh.yaw) * veh.v * dt;
  player.facing = veh.yaw;
  W.pushOut(player.pos, player.y, 0.9);
  const pd = Math.hypot(player.pos.x, player.pos.z), e = edgeR(player.pos.x, player.pos.z);
  if (jet) {
    // jetski hanya di laut: tidak naik ke pantai, tidak terlalu jauh, tidak masuk area berenang
    const lo = e + 1.5, hi = e + 22; if (pd < lo || pd > hi) { const k = clamp(pd, lo, hi) / pd; player.pos.x *= k; player.pos.z *= k; veh.v *= 0.6; }
    const sx2 = player.pos.x - W.SWIM.x, sz2 = player.pos.z - W.SWIM.z, sd = Math.hypot(sx2, sz2), sr = W.SWIM.r + 1.5;
    if (sd < sr) { player.pos.x = W.SWIM.x + (sx2 / sd) * sr; player.pos.z = W.SWIM.z + (sz2 / sd) * sr; veh.v *= 0.6; if (!climb.swimWarn || performance.now() - climb.swimWarn > 6000) { climb.swimWarn = performance.now(); toast('🏊 Ini area berenang. Jetski dilarang masuk!'); } }
    if (Math.abs(veh.v) > 3 && (veh.spray -= dt) <= 0) { veh.spray = 0.15; burst(new THREE.Vector3(player.pos.x - Math.sin(veh.yaw) * 1.4, -0.6, player.pos.z - Math.cos(veh.yaw) * 1.4), ['#ffffff', '#bfe8ff']); }
  } else {
    pushTrees(player.pos, 1.0);
    const lim = e - 2.2; if (pd > lim && !W.supported(player.pos.x, player.pos.z, player.y)) { player.pos.x *= lim / pd; player.pos.z *= lim / pd; veh.v *= 0.5; }
    // ATV tidak boleh masuk menara
    const T = W.TOWER, tx = player.pos.x - T.x, tz = player.pos.z - T.z, td = Math.hypot(tx, tz);
    if (td < T.fence + 1.2) { player.pos.x = T.x + (tx / td) * (T.fence + 1.2); player.pos.z = T.z + (tz / td) * (T.fence + 1.2); veh.v *= 0.4; }
    if (player.onGround && Math.abs(veh.v) > 1 && W.ledgeAhead(player.pos.x, player.pos.z, player.y, Math.sin(veh.yaw) * Math.sign(veh.v), Math.cos(veh.yaw) * Math.sign(veh.v)) !== null) player.jumpBuf = 0.05;
  }
  if (Math.abs(veh.v) > 1) steerCam(dt);
}
function vehicleClock() {
  if (!veh.kind) return;
  const left = Math.max(0, veh.until - Date.now()), r = W.RENT[veh.kind];
  const el = $('#vehChip'); el.hidden = false; el.textContent = `${r.emoji} ${r.name}${veh.pass.size ? ` · 👥 ${veh.pass.size + 1}` : ''} · ⏱️ ${mmss(left)}`;
  if (left < 30000 && !veh.warned) { veh.warned = true; toast(`⏱️ Waktu sewa ${r.name} tinggal 30 detik`); }
  if (left <= 0 || me.down) endRide('time');
}
/* ---------- ikut naik kendaraan teman (maks. 2 orang: pengemudi + 1 penumpang) ---------- */
function nearDriver() {
  if (veh.kind || ride || me.down || activeZone) return null;
  for (const r of remotes.values()) {
    const t = r.target, c = t.p; if (!(c === 4 || c === 5 || c === 8) || (t.pc || 0) >= SEATS[P_KIND[c]]) continue;
    const p = r.ch.root.position, d = Math.hypot(p.x - player.pos.x, p.z - player.pos.z);
    // jetski: boleh naik dari pantai tempat sewa (jetski menunggu di dekatnya); pesawat: hanya saat masih di landasan
    const range = c === 5 ? 14 : 3.6; if (d > range || (c !== 5 && Math.abs((t.y || 0) - player.y) > 1.6)) continue;
    if (c === 8 && (t.y || 0) > W.RENT.plane.top + 0.5) continue;
    return r;
  }
  return null;
}
function askRide(r) { send({ t: 'ride', to: r.id }); toast(`🙋 Minta ikut ${r.name}…`); }
function onRideReq(m) {
  const fr = remotes.get(m.from);
  if (!veh.kind || veh.pass.size >= SEATS[veh.kind] || veh.pass.has(m.from)) { send({ t: 'rideNo', to: m.from, kind: veh.kind }); return; }
  let seat = 0; while ([...veh.pass.values()].includes(seat)) seat++;
  veh.pass.set(m.from, seat); send({ t: 'rideOk', to: m.from, kind: veh.kind, seat }); toast(`👥 ${fr ? fr.name : 'Teman'} ikut naik!`); SFX.good();
}
function startRide(m) {
  const r = remotes.get(m.from); if (!r || veh.kind) return;
  ride = { driver: m.from, kind: m.kind, seat: m.seat || 0 }; climb.joinBtn = null; hideAction(); showAction('⏹️ Turun', () => leaveRide(true));
  SFX.good(); say(`Kamu ikut naik ${W.RENT[m.kind].name} bersama ${r.name}. Pegangan, ya!`, { force: true });
}
function leaveRide(tell, quiet = false) {
  if (!ride) return; const k = ride.kind, d = ride.driver; ride = null; hideAction();
  if (tell) send({ t: 'rideOff', to: d });
  if (k === 'jetski' || k === 'plane') { const r = W.RENT[k]; veh.ending = true; teleport(r.back[0], r.back[1], k === 'plane' ? r.top : 0.12); veh.ending = false; }
  else { player.vy = 0; player.onGround = false; player.peak = player.y; }
  if (!quiet) say('Kamu sudah turun. Terima kasih sudah ikut!', { force: true });
}
// penumpang duduk di belakang pengemudi, mengikuti posisinya
function rideTick() {
  if (!ride) return; const r = remotes.get(ride.driver);
  if (!r || ![4, 5, 8].includes(r.target.p)) { leaveRide(false); return; }
  const p = r.ch.root.position, f = r.ch.root.rotation.y, back = SEAT_BACK[ride.kind] + (ride.seat || 0) * 0.8;
  player.pos.x = p.x - Math.sin(f) * back; player.pos.z = p.z - Math.cos(f) * back; player.y = r.target.y || 0;
  player.vy = 0; player.onGround = ride.kind !== 'plane'; player.standOn = null; player.peak = player.y; player.facing = f; player.target = null;
}

/* ---------- berenang di laut sekitar dermaga ---------- */
const SWIM_DROP = 1.55; // badan tenggelam sampai dada
const swimming = () => player.onGround && !player.standOn && player.y <= W.WATER_Y + 0.01 && !W.onIsland(player.pos.x, player.pos.z);
let wasSwim = false, swimFx = 0;
function swimTick(dt) {
  const sw = swimming();
  if (sw && !wasSwim) { SFX.splash(); burst(new THREE.Vector3(player.pos.x, -0.6, player.pos.z), ['#ffffff', '#bfe8ff', '#7cc8f5']); toast('🏊 Berenang! Jalan ke pantai atau dermaga untuk naik.'); }
  wasSwim = sw;
  if (sw && player.moving && (swimFx -= dt) <= 0) { swimFx = 0.45; burst(new THREE.Vector3(player.pos.x, -0.7, player.pos.z), ['#ffffff', '#bfe8ff']); }
}
// pose khusus: 1 terjun bebas, 2 bergantung di parasut, 3 berenang (dipakai juga untuk teman)
function poseSpecial(ch, p, phase, holder) {
  ch.body.rotation.x = p === 1 ? 1.2 : 0;
  ch.shL.rotation.z = p === 1 ? 1.3 : 0; ch.shR.rotation.z = p === 1 ? -1.3 : 0;
  ch.body.rotation.z = p === 2 && holder === player ? -para.bank : 0; // badan miring saat berbelok
  if (p === 2) { ch.body.rotation.x = 0.7; ch.shL.rotation.x = -0.3; ch.shR.rotation.x = -0.3; ch.shL.rotation.z = 1.0; ch.shR.rotation.z = -1.0; ch.hipL.rotation.x = 0.25 + Math.sin(elapsed * 2) * 0.12; ch.hipR.rotation.x = 0.25 - Math.sin(elapsed * 2) * 0.12; }
  if (p === 3) { ch.shL.rotation.x = -Math.PI / 2 + Math.sin(phase) * 1.4; ch.shR.rotation.x = -Math.PI / 2 - Math.sin(phase) * 1.4; ch.hipL.rotation.x = Math.sin(phase * 2) * 0.3; ch.hipR.rotation.x = -Math.sin(phase * 2) * 0.3; }
  if (p >= 4 && p <= 9) { ch.hipL.rotation.x = ch.hipR.rotation.x = -1.45; ch.shL.rotation.x = ch.shR.rotation.x = p === 6 || p === 7 || p === 9 ? -0.6 : -1.2; ch.body.position.y = 0; }
  // kendaraan teman (pemain sendiri memakai veh.mesh; penumpang tidak membawa kendaraan)
  if (holder !== player) {
    const want = p === 4 || p === 5 || p === 8 ? p : 0;
    if (holder.vkind !== want) { if (holder.vmesh) ch.root.remove(holder.vmesh); holder.vmesh = null; holder.vkind = want; if (want) { holder.vmesh = makeVehMesh(want); holder.vmesh.position.set(0, VEH_MESH_Y[want], VEH_MESH_Z[want]); ch.root.add(holder.vmesh); } }
    if (want === 8 && holder.vmesh) holder.vmesh.userData.prop.rotation.z += 0.6;
  }
  if (p === 2 && !holder.wings) holder.wings = makeWings(ch);
  if (holder.wings) {
    holder.wings.visible = p === 2;
    if (p === 2) { const f = Math.sin(elapsed * (holder === player ? 2.4 + para.sink : 3.2)) * 0.35; holder.wings.children[0].rotation.y = 0.35 + f; holder.wings.children[1].rotation.y = -0.35 - f; }
  }
}
// sayap malaikat: bulu putih bertingkat dengan ujung keemasan, menempel di punggung
function makeWings(ch) {
  const g = new THREE.Group(); g.position.set(0, 1.75, -0.32); ch.body.add(g);
  for (const sd of [-1, 1]) {
    const w = new THREE.Group(); g.add(w);
    // bulu bertingkat (putih & biru muda) dengan garis tepi emas supaya tetap terlihat di depan langit
    [[1.1, 0.55, 0.0], [1.9, 0.46, -0.35], [2.6, 0.38, -0.7], [3.1, 0.3, -1.0]].forEach(([len, hgt, y], i) => {
      const yy = 0.35 + y * 0.6 + i * 0.05;
      box(len, hgt, 0.1, i % 2 ? '#e3eeff' : '#ffffff', sd * (len / 2 + 0.1), yy, -0.05 - i * 0.02, w, false);
      box(len, 0.07, 0.12, '#f2c94c', sd * (len / 2 + 0.1), yy + hgt / 2, -0.05 - i * 0.02, w, false);
    });
    box(0.5, 0.9, 0.1, '#ffffff', sd * 0.3, 0.1, -0.05, w, false);
    box(0.18, 0.18, 0.12, '#ffd23a', sd * 3.2, 0.55, -0.1, w, false);
  }
  const glow = emojiSprite('✨', 0.7); glow.position.set(0, 1.3, -0.3); g.add(glow);
  return g;
}
/* ---------- terjun payung dari puncak menara (seperti turun dari pesawat) ---------- */
const para = { phase: 0, t: 0, yaw: 0, bank: 0, sink: 1.1 };
function paraTick(dt) {
  const top = W.TOWER.N * W.TOWER.H;
  if (!para.phase) {
    if (!player.onGround && player.vy < -1 && player.peak >= top - 0.5 && player.y < player.peak - 1.2) {
      para.phase = 1; para.t = 0; tone(220, 0.9, { type: 'sawtooth', slide: 0.6, vol: 0.03 });
      say('Wuuush! Kamu terjun! Tekan tombol lompat untuk membuka sayap.', { force: true });
    }
    return;
  }
  if (para.phase === 1) { para.t += dt; player.vy = Math.max(player.vy, -14); if (para.t > 1.4 || player.y < 30) openChute(); }
  else if (!player.onGround) { // sayap menahan gravitasi: melayang turun perlahan sesuai kecepatan yang dipilih
    const tv = -Math.max(0.3, para.sink); player.vy += (tv - player.vy) * Math.min(1, dt * 3);
  }
}
function openChute() {
  if (para.phase !== 1) return;
  para.phase = 2; para.yaw = player.facing; para.bank = 0; para.sink = 1.1; [784, 988, 1175].forEach((f, i) => tone(f, 0.35, { type: 'triangle', vol: 0.07, delay: i * 0.08 })); toast('🪽 Sayap malaikat terbuka! Terbang ke mana saja dengan joystick.');
}
function landPara() {
  para.phase = 0; SFX.good(); climb.cp = 0;
  say('Hore, mendarat dengan lembut! Kamu terbang seperti malaikat!', { force: true });
}
/* ---------- makan di kantin: nyawa bertambah sedikit ---------- */
const eatSt = { on: false };
const EAT_SEC = 5, FULL_MS = 2 * 60000;
function eatFood(n, e, nm) {
  const now = Date.now();
  if (save.fullUntil && now < save.fullUntil) { say(`Kamu masih kenyang, lho! Main dulu, nanti makan lagi, ya.`, { who: n.name, pitch: n.pitch, force: true }); return; }
  say(`Ini ${nm}nya! Berdoa dulu, lalu makan pelan-pelan, ya.`, { who: n.name, pitch: n.pitch, force: true });
  Object.assign(eatSt, { on: true, t: 0, e, nm, n, bite: 0 });
  $('#eatE').textContent = e; $('#eatLbl').textContent = `Makan ${nm}…`; $('#eatFill').style.width = '0%'; $('#eatBar').hidden = false;
}
function cancelEat() { if (!eatSt.on) return; eatSt.on = false; $('#eatBar').hidden = true; toast('🍽️ Makannya belum habis. Ayo makan lagi nanti.'); }
function eatTick(dt) {
  if (!eatSt.on) return;
  eatSt.t += dt; const k = Math.min(1, eatSt.t / EAT_SEC);
  $('#eatFill').style.width = `${Math.round(k * 100)}%`; $('#eatLbl').textContent = k < 1 ? `Makan ${eatSt.nm}… ${Math.round(k * 100)}%` : 'Kenyang!';
  if ((eatSt.bite -= dt) <= 0) { eatSt.bite = 1; tone(500, 0.08, { type: 'triangle', vol: 0.06 }); tone(420, 0.08, { type: 'triangle', vol: 0.06, delay: 0.12 }); burst(player.pos.clone().add(new THREE.Vector3(0, 2.2 + player.y, 0)), ['#f5e2a6', '#ffd23a']); }
  if (k < 1) return;
  eatSt.on = false; setTimeout(() => ($('#eatBar').hidden = true), 900);
  save.fullUntil = Date.now() + FULL_MS;
  const mx = save.maxHp || 5, before = save.hp ?? 3;
  if (before < mx) { save.hp = Math.min(mx, before + 0.5); floatText('+½ ❤️'); SFX.good(); say('Nyam, kenyang! Nyawamu bertambah sedikit. Terima kasih, Bu Sari!', { force: true }); }
  else { SFX.good(); say('Nyam, kenyang! Nyawamu sudah penuh. Terima kasih, Bu Sari!', { force: true }); }
  persist(); updateVitals(); doEmote('😋');
}

// warga (NPC): dekati lalu ketuk "Ngobrol", atau ketuk orangnya
let nearNpc = null;
function checkNpcs() {
  let near = null;
  if (playing && !activeZone && !paused() && !me.down && !veh.kind && !ride) {
    let best = 3.6;
    for (const n of W.npcs) { if (!n.ch.root.visible) continue; const d = Math.hypot(n.pos.x - player.pos.x, n.pos.z - player.pos.z); if (d < best && Math.abs(n.y - player.y) < 1.6) { best = d; near = n; } }
  }
  if (near === nearNpc) return;
  nearNpc = near; const b = $('#talkBtn'); b.hidden = !near;
  if (near) { b.innerHTML = '<span class="e">💬</span><span class="t"><b>Ngobrol</b><small></small></span>'; b.querySelector('small').textContent = near.name; SFX.pop(); }
}
function npcTap(n) {
  if (Math.hypot(n.pos.x - player.pos.x, n.pos.z - player.pos.z) < 6) { talkTo(n); return; }
  const a = Math.atan2(player.pos.x - n.pos.x, player.pos.z - n.pos.z); walkTo(n.pos.x + Math.sin(a) * 2, n.pos.z + Math.cos(a) * 2, () => talkTo(n));
}
const npcStarAt = new Map();
function talkTo(n) {
  if (!playing || paused() || activeZone) return;
  SFX.tap(); W.npcTalked(n); player.target = null; marker.visible = false;
  player.facing = Math.atan2(n.pos.x - player.pos.x, n.pos.z - player.pos.z);
  const api = {
    say: (t) => say(t, { who: n.name, pitch: n.pitch, force: true }),
    ask: (q, opts, right, good, bad) => npcAsk(n, q, opts, (i) => {
      if (i === right) {
        let t = good; const last = npcStarAt.get(n.id) || -1e9;
        if (performance.now() - last > 60000) { npcStarAt.set(n.id, performance.now()); save.stars += 1; persist(); updateStars(); floatText('+1 ⭐'); t += ' Ini satu bintang untukmu!'; }
        SFX.good(); celebrate('small'); api.say(t); doEmote('😀');
      } else { SFX.soft(); api.say(bad); }
    }),
    choose: (q, opts, cb) => npcAsk(n, q, opts, cb),
    food: (e) => { floatText(e); doEmote('😍'); },
    eat: (e, nm) => eatFood(n, e, nm),
    hp: () => save.hp ?? 3,
    ship: () => ({ docked: W.ship.docked, left: W.ship.left }),
  };
  if (n.talk) n.talk(api); else { n.li = ((n.li ?? -1) + 1) % n.lines.length; api.say(n.lines[n.li]); }
}
function npcAsk(n, q, opts, cb) {
  say(q, { who: n.name, pitch: n.pitch, force: true, stay: true });
  $('#npcWho').textContent = n.name; $('#npcQ').textContent = q;
  const box = $('#npcOpts'); box.innerHTML = '';
  opts.forEach((o, i) => { const b = document.createElement('button'); b.className = 'chunky'; b.textContent = o; b.onclick = () => { closeModal('npcAsk'); cb(i); }; box.appendChild(b); });
  openModal('npcAsk');
}
$('#talkBtn').onclick = () => { if (nearNpc) talkTo(nearNpc); };
$('#npcLater').onclick = () => { SFX.tap(); closeModal('npcAsk'); $('#bubble').hidden = true; };

/* =========================================================
   LOOP
   ========================================================= */
const clock = new THREE.Clock();
const camPos = new THREE.Vector3(0, 24, 36), camLook = new THREE.Vector3();
const tmpV = new THREE.Vector3();
let introA = 0, saveTick = 0, elapsed = 0;
function update(dt) {
  elapsed += dt;
  // tween
  for (let i = tweens.length - 1; i >= 0; i--) {
    const tw = tweens[i]; tw.t += dt; const k = Math.min(1, tw.t / tw.dur);
    tw.fn(tw.ease(k)); if (k >= 1) { tweens.splice(i, 1); tw.res(); }
  }
  // partikel
  for (let i = particles.length - 1; i >= 0; i--) {
    const p = particles[i]; p.userData.life -= dt * 1.1;
    p.userData.v.y -= 12 * dt; p.position.addScaledVector(p.userData.v, dt);
    p.scale.setScalar(Math.max(0.01, p.userData.life));
    p.rotation.x += dt * 5; p.rotation.y += dt * 4;
    if (p.userData.life <= 0) { scene.remove(p); particles.splice(i, 1); }
  }
  for (const c of clouds) { c.position.x += c.userData.speed * dt; if (c.position.x > 100) c.position.x = -100; }
  for (const z of Object.values(zones)) { const ic = z.icon; ic.rotation.y += dt * 0.8; ic.position.y = 6.2 + Math.sin(elapsed * 2 + z.cx) * 0.3; z.tick?.(elapsed, dt); }
  for (const a of animated) a.fn(elapsed, dt);
  if (zones.pola?.q?.visible) zones.pola.q.position.y = 0.8 + Math.sin(elapsed * 4) * 0.12;
  for (const a of zones.hewan?.animals || []) a.children[0].rotation.z = Math.sin(elapsed * 3 + a.position.x) * 0.02;
  // gerak pemain: joystick / tombol panah relatif terhadap arah kamera
  const ch = player.ch;
  let moving = false;
  // pijakan bergerak (lift, kapal) & rintangan menara bergerak dulu, membawa pemain yang berdiri di atasnya
  W.updateMovers(dt, player, HAZ_SPEED[combatLevel()]);
  W.updateHazards(dt, HAZ_SPEED[combatLevel()], player.pos.x, player.pos.z, player.y);
  if (player.knock) {
    const k = player.knock; player.pos.x += k.x * dt; player.pos.z += k.z * dt; k.t -= dt; if (k.t <= 0) player.knock = null;
    W.pushOut(player.pos, player.y);
  }
  if (playing && !modal && !me.down && !player.knock?.lock) {
    let sx = stick.active ? stick.x : 0, sy = stick.active ? stick.y : 0;
    if (keys.has('w') || keys.has('arrowup')) sy -= 1; if (keys.has('s') || keys.has('arrowdown')) sy += 1;
    if (keys.has('a') || keys.has('arrowleft')) sx -= 1; if (keys.has('d') || keys.has('arrowright')) sx += 1;
    if (keys.has('q')) view.yaw += dt * 2; if (keys.has('e')) view.yaw -= dt * 2;
    let dx = 0, dz = 0, power = 1;
    if (ride) { moving = false; } // penumpang: ikut pengemudi
    else if (veh.kind) { vehicleTick(dt, sx, sy); moving = Math.abs(veh.v) > 0.4; }
    else if (para.phase === 2) {
      // terbang dengan sayap: selalu melaju ke depan; kiri/kanan = berbelok, depan = lebih cepat, belakang = melayang pelan
      player.target = null; marker.visible = false;
      const turn = clamp(sx, -1, 1), fwd = clamp(-sy, -1, 1);
      para.yaw -= turn * 1.7 * dt; para.bank += (turn * 0.55 - para.bank) * Math.min(1, dt * 5);
      para.sink = 1.1 + fwd * 0.8; // 0.3 (melayang) .. 1.9 (menukik)
      dx = Math.sin(para.yaw); dz = Math.cos(para.yaw); player.speed = 7 + fwd * 3.5;
      // kamera ikut dari belakang (kecuali anak sedang memutar pandangan sendiri)
      if (look.id === null && !view.dragging) { let d = para.yaw + Math.PI - view.yaw; d = Math.atan2(Math.sin(d), Math.cos(d)); view.yaw += d * Math.min(1, dt * 2.5); }
    } else if (sx || sy) {
      if (activeZone) leaveZone(); player.target = null; marker.visible = false;
      const fx = -Math.sin(view.yaw), fz = -Math.cos(view.yaw); // depan
      const rx = Math.cos(view.yaw), rz = -Math.sin(view.yaw); // kanan
      dx = rx * sx - fx * sy; dz = rz * sx - fz * sy;
      const l = Math.hypot(dx, dz); power = Math.min(1, l); dx /= l; dz /= l;
      player.speed = 8.5 * Math.max(0.45, power); // peta luas: lari sedikit lebih cepat
      if (player.y > 0.5 && W.inTower(player.pos.x, player.pos.z)) player.speed *= 0.78; // di menara lebih pelan & mudah dikendalikan
      if (para.phase === 1) player.speed = 11; else if (swimming()) player.speed *= 0.55;
      if (eatSt.on) cancelEat();
    } else if (player.target) {
      tmpV.subVectors(player.target, player.pos); tmpV.y = 0; const d = tmpV.length();
      if (d < 0.15) { player.target = null; marker.visible = false; const cb = player.onArrive; player.onArrive = null; cb?.(); }
      else { dx = tmpV.x / d; dz = tmpV.z / d; player.speed = clamp(d * 0.6, 6, 13); }
    }
    if (dx || dz) {
      moving = true;
      const step = Math.min(player.speed * dt, player.target ? player.pos.distanceTo(player.target) : 99);
      const before = player.pos.clone();
      player.pos.x += dx * step; player.pos.z += dz * step;
      if (player.y < 3.5) pushTrees(player.pos, 0.45); // pohon, lampu, tugu (lingkaran)
      W.pushOut(player.pos, player.y); // dinding bangunan, pagar, pijakan yang lebih tinggi
      // batas pantai, kecuali sedang berdiri di dermaga/kapal
      const pd = Math.hypot(player.pos.x, player.pos.z); const lim = edgeR(player.pos.x, player.pos.z) - 2.2;
      const swimOk = W.inSwim(player.pos.x, player.pos.z);
      if (pd > lim && !swimOk && !W.supported(player.pos.x, player.pos.z, player.y)) { player.pos.x *= lim / pd; player.pos.z *= lim / pd; }
      if (!swimOk && pd > lim && Math.hypot(player.pos.x - W.SWIM.x, player.pos.z - W.SWIM.z) < W.SWIM.r + 3 && player.y < 0.1 && !W.supported(player.pos.x, player.pos.z, player.y)) {
        const sx = player.pos.x - W.SWIM.x, sz = player.pos.z - W.SWIM.z, sd = Math.hypot(sx, sz); player.pos.x = W.SWIM.x + (sx / sd) * (W.SWIM.r - 0.1); player.pos.z = W.SWIM.z + (sz / sd) * (W.SWIM.r - 0.1);
      }
      if (player.target && before.distanceTo(player.pos) < step * 0.3) { if ((player.stuck += dt) > 0.6) { player.target = null; marker.visible = false; player.onArrive = null; } }
      player.facing = Math.atan2(dx, dz);
      // lompat otomatis saat berjalan ke pijakan yang lebih tinggi (seperti lompat otomatis Minecraft)
      if (player.onGround && !player.knock && W.ledgeAhead(player.pos.x, player.pos.z, player.y, dx, dz) !== null) player.jumpBuf = Math.max(player.jumpBuf, 0.05);
    }
    checkZones();
  }
  // lompat, jatuh, mendarat (balok bisa dipijak)
  if (player.jumpHeld && playing && !modal) player.jumpBuf = Math.max(player.jumpBuf, 0.05);
  tryJump(); player.jumpBuf = Math.max(0, player.jumpBuf - dt);
  if (para.phase === 2 && !player.onGround) player.vy += W.GRAV * dt; // sayap menahan gravitasi sebelum posisi dihitung
  rideTick();
  if (veh.kind === 'jetski') { player.y = -0.35; player.vy = 0; player.onGround = true; player.standOn = null; player.peak = player.y; }
  else if (veh.kind === 'plane') { player.vy = 0; player.onGround = veh.fl.phase === 'ready'; player.standOn = null; player.peak = player.y; }
  else if (!ride) { const landed = W.stepVertical(player, dt); if (landed) onLand(landed); }
  vehicleClock();
  paraTick(dt); swimTick(dt); eatTick(dt);
  if (player.y < -0.6 && !veh.kind && !ride) fellInSea();
  if (playing) { worldPlay(dt); W.updateHide(player.pos.x, player.y, player.pos.z); }
  W.updateNpcs(dt, player); checkNpcs();
  lookTick(dt);
  // animasi
  ch.root.position.set(player.pos.x, vehCode() ? player.y + VEH_OFF[vehCode()] : swimming() ? player.y - SWIM_DROP : player.y, player.pos.z);
  let rd = player.facing - ch.root.rotation.y; rd = Math.atan2(Math.sin(rd), Math.cos(rd));
  ch.root.rotation.y += rd * Math.min(1, dt * 12);
  if (moving) player.phase += dt * 11; else player.phase *= Math.pow(0.001, dt);
  const sw = moving ? Math.sin(player.phase) * 0.7 : 0;
  const air = player.onGround ? 0 : -0.9;
  ch.hipL.rotation.x = sw; ch.hipR.rotation.x = -sw;
  ch.shL.rotation.x = air || -sw; ch.shR.rotation.x = air || sw;
  ch.body.position.y = moving ? Math.abs(Math.sin(player.phase)) * 0.08 : Math.sin(elapsed * 2) * 0.02;
  poseSpecial(ch, para.phase || vehCode() || (swimming() ? 3 : 0), player.phase, player);
  if (eatSt.on) { ch.shR.rotation.x = -2.0 + Math.sin(elapsed * 9) * 0.35; ch.shL.rotation.x = -0.4; }
  if (moving && !activeZone && !bubbleStay && !$('#bubble').hidden && performance.now() - bubbleAt > 3000) $('#bubble').hidden = true; // dialog tidak menghalangi saat berjalan
  if (marker.visible) { marker.material.opacity = 0.5 + Math.sin(elapsed * 8) * 0.3; }
  updateRemotes(dt); animateEmote(player.ch, myEmote, dt);
  player.moving = moving; if (playing) sendMove(dt);
  // panah misi di kaki pemain + sorot cahaya di tujuan
  let mz = playing ? missionZone() : null;
  if (playing && nightDanger()) { let bd = 1e9; for (const q of Object.values(zones)) { if (!isSafeZone(q)) continue; const d = Math.hypot(q.cx - player.pos.x, q.cz - player.pos.z); if (d < bd) { bd = d; mz = q; } } }
  if (guide && beacon) {
    const show = !!mz && !activeZone && camMode === 'follow';
    beacon.visible = !!mz && !activeZone; if (mz) beacon.position.set(mz.cx, 30, mz.cz);
    const far = mz ? Math.hypot(mz.cx - player.pos.x, mz.cz - player.pos.z) > 8 : false;
    guide.visible = show && far;
    if (guide.visible) { const a = Math.atan2(mz.cx - player.pos.x, mz.cz - player.pos.z); guide.position.set(player.pos.x + Math.sin(a) * 1.7, player.y + 0.25 + Math.sin(elapsed * 5) * 0.08, player.pos.z + Math.cos(a) * 1.7); guide.rotation.y = a + Math.PI; }
  }
  const fp = !!CAM_MODES[view.mode].fp && camMode === 'follow' && !activeZone;
  ch.root.visible = !fp; hand.visible = fp;
  { const z = activeZone; // diam 12 detik = bantuan (tidak saat kuis bersama, lobi, atau menunggu)
    if (z && z.arrived && z.round && !z.round.solved && !z.round.locked && !z.secret && !z.inLobby && !paused() && !isSpeaking() && performance.now() - (z.lastAct || 0) > 12000) z.giveHint(); }
  worldTick(dt); applyLighting(); updateSafeVisuals(); updateZombies(dt); updateShots(dt); updateCombat(dt);
  if (me.down) ch.root.visible = false;
  if (fp) { if (moving) player.facing = view.yaw + Math.PI; hand.position.y = -0.3 + (moving ? Math.abs(Math.sin(player.phase)) * 0.04 : Math.sin(elapsed * 2) * 0.008); hand.rotation.x = 0.25 + (moving ? Math.sin(player.phase) * 0.12 : 0); }
  // kamera
  const aspect = camera.aspect; const far = clamp(0.8 / aspect, 1, 1.9);
  if (camMode === 'intro') {
    introA += dt * 0.08;
    tmpV.set(Math.sin(introA) * 105, 58, Math.cos(introA) * 105); camLook.set(0, 0, 0);
    camPos.lerp(tmpV, 1 - Math.exp(-dt * 2));
  } else if (camMode === 'spectate') {
    spectCamera(dt);
  } else {
    let target, look, rate = 4;
    if (camMode === 'wardrobe') {
      target = tmpV.set(player.pos.x, 2.2 + player.y, player.pos.z + 5.6 * clamp(far, 1, 1.4));
      look = new THREE.Vector3(player.pos.x, 1.6 + player.y, player.pos.z);
      // avatar tidak tertutup menu: HP miring -> avatar di kiri (menu di kanan); HP tegak -> avatar di atas (menu di bawah)
      if (aspect < 1) { look.y -= 1.7; target.y -= 1.5; }
      else if (window.innerHeight <= 520) { look.x += 2.4; target.x += 2.4; }
    } else if (activeZone) {
      const z = activeZone;
      // kamera menyesuaikan lebar layar: area main ±6.2 selalu muat
      const tanH = Math.tan(THREE.MathUtils.degToRad(camera.fov / 2)) * aspect;
      const short = window.innerHeight < 520;
      const d = Math.max(13.3, 6.4 / tanH) * (short ? 1.3 : 1);
      look = new THREE.Vector3(z.cx - 0.5, 0.5, z.cz - (aspect < 1 ? 1.6 : 1.1) + (short ? 1.4 : 0));
      const dy = aspect < 1 ? 0.87 : 0.72, dz = aspect < 1 ? 0.49 : 0.69;
      target = tmpV.set(look.x, look.y + dy * d, look.z + dz * d);
    } else if (CAM_MODES[view.mode].fp) {
      // orang pertama: kamera di mata, hanya tangan yang terlihat
      const fx = -Math.sin(view.yaw), fz = -Math.cos(view.yaw);
      target = tmpV.set(player.pos.x + fx * 0.2, 2.45 + player.y, player.pos.z + fz * 0.2);
      look = new THREE.Vector3(target.x + fx * 4 * Math.cos(view.fpPitch), target.y + Math.sin(view.fpPitch) * 4, target.z + fz * 4 * Math.cos(view.fpPitch));
      rate = 30;
    } else {
      // orang ketiga: kamera di belakang & sedikit di atas, seluruh tubuh karakter terlihat
      const flying = veh.kind === 'plane' || ride?.kind === 'plane';
      let dist = view.dist * (aspect < 1 ? 1.3 : 1) * (flying ? 1.7 : 1);
      // kamera ikut naik setinggi pemain (menara, gedung, gunung); dihaluskan supaya tidak ikut terguncang saat melompat
      const cy0 = view.camY ?? player.y, gy = flying || player.onGround || player.y - cy0 > 3 ? player.y : Math.min(player.y, cy0); // lompatan kecil tidak menggoyang kamera
      view.camY = view.camY == null || Math.abs(gy - view.camY) > 12 ? gy : view.camY + (gy - view.camY) * Math.min(1, dt * 5);
      look = new THREE.Vector3(player.pos.x, 1.7 + view.camY + (player.y - view.camY) * 0.35, player.pos.z);
      // jarak kamera tetap (tidak ada zoom otomatis); berubah hanya saat pemain mengganti mode/zoom sendiri
      view.cur = view.cur ? view.cur + (dist - view.cur) * Math.min(1, dt * 6) : dist;
      dist = view.cur;
      // pandangan ke atas (pitch < 0.1): kamera tetap di belakang pemain, lalu mendongak sampai ±80° (bisa melihat langit/puncak menara)
      const camP = Math.max(view.pitch, 0.1), upA = clamp((0.1 - view.pitch) * 1.15, 0, 1.4);
      const hz = Math.cos(camP) * dist;
      // sedikit ke kanan bahu (seperti PUBG), kecuali dari atas
      const side = view.mode === 'atas' ? 0 : Math.min(1.1, dist * 0.09);
      const rx = Math.cos(view.yaw), rz = -Math.sin(view.yaw);
      look.x += rx * side; look.z += rz * side;
      target = tmpV.set(look.x + Math.sin(view.yaw) * hz, look.y + Math.sin(camP) * dist, look.z + Math.cos(view.yaw) * hz);
      target.y = Math.max(target.y, 0.9);
      if (upA > 0) { const back = Math.hypot(target.x - look.x, target.z - look.z); look.y += Math.tan(upA) * back + (target.y - look.y) * (upA / 1.4); }
      rate = 16; // mengikuti rapat, tidak melayang
    }
    const k = window.__pbSnap ? 1 : 1 - Math.exp(-dt * rate);
    camPos.lerp(target, k); camLook.lerp(look, k);
  }
  camera.position.copy(camPos); camera.lookAt(camLook);
  sun.target.position.copy(camLook); sun.target.position.y = Math.min(camLook.y, player.y + 2); sun.position.copy(sun.target.position).add(SUN_OFS); // bayangan tetap di sekitar pemain walau mendongak
  // waktu main
  if (playing && document.visibilityState === 'visible' && modal !== 'rest') {
    save.time.sec += dt; saveTick += dt;
    if (saveTick > 5) { saveTick = 0; persist(); checkTime(); }
  }
}
function loop() {
  const dt = Math.min(clock.getDelta(), 0.05);
  update(dt);
  renderer.render(scene, camera);
  requestAnimationFrame(loop);
}

/* =========================================================
   MULAI
   ========================================================= */
async function boot() {
  try { await Promise.all([document.fonts.load(`800 100px "Baloo 2"`), document.fonts.load(`600 40px "Baloo 2"`)]); } catch (e) { /* fallback font */ }
  applyGraphics();
  const before = new Set(scene.children);
  buildIsland();
  buildLamps();
  W.initWorld({ scene, box, mat, BOX, canvasTex, rrect, FONT, makeCharacter, makeHat, emojiSprite, animated, burst, edgeR, tapRoots, onNpc: (n) => npcTap(n), pushTrees: (p) => pushTrees(p, 0.4) });
  const decor = scene.children.filter((o) => !before.has(o) && !o.isInstancedMesh && !clouds.includes(o));
  buildMonument(); // Menara Kristal di tengah pulau
  buildFountain();
  zones.kebun = new Kebun(); zones.warna = new Warna(); zones.hewan = new Hewan(); zones.pola = new Pola();
  zones.bentuk = new Bentuk(); zones.ikan = new Ikan(); zones.musik = new Musik(); zones.kembar = new Kembar(); zones.ukuran = new Ukuran(); zones.rasa = new Rasa();
  zones.tulis = new Tulis(); zones.mtk = new Mtk(); zones.gambar = new Gambar(); zones.puzzle = new Puzzle();
  zones.huruf = new Baca('huruf', 'Rumah Huruf', '#ff8fab', 'abc'); zones.angka = new Baca('angka', 'Pondok Angka', '#7cc8f5', 'angka123'); zones.iqro = new Baca('iqro', "Surau Iqro'", '#5fcf86', 'peci');
  // hiasan pulau + bagian lokasi yang diam digabung (objek yang bisa diketuk/bergerak tidak ikut)
  const moving = new Set(animated.map((a) => a.obj));
  for (const z of Object.values(zones)) moving.add(z.temp);
  staticBatch([...decor, ...Object.values(zones).map((z) => z.group)], moving);
  player.ch = makeCharacter({ shirt: COLORS[save.avatar.shirt], pants: COLORS[save.avatar.pants], skin: SKINS[save.avatar.skin] });
  player.ch.root.rotation.y = Math.PI;
  scene.add(player.ch.root, marker); applyAvatar();
  updateStars(); refreshCrystals();
  initFx({ ac, sfx: () => dev.sfx, isLite: () => dev.lite });
  initPad({
    onBack: () => { SFX.tap(); const z = activeZone; leaveZone(); if (z) { const [x, y] = z.approach(9); walkTo(x, y); } },
    onSay: () => { if (lastLine) speak(lastLine); }, tap: () => SFX.tap(), onActivity: () => activeZone?.touch(),
  });
  window.addEventListener('resize', portraitHint);
  showLogin();
  connect(onNet, onNetStatus);
  if (location.protocol === 'file:') onNetStatus('offline');
  else setTimeout(() => { if (!net.online) onNetStatus('offline'); }, 2500);
  loop();
}
document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'hidden') { persist(); if (hasTTS) speechSynthesis.cancel(); } });
// untuk pengujian otomatis
window.__pbSend = send;
window.__pbSpeak = () => { const z = speakZone; const it = z?.items?.[z.idx]; return it ? { read: it.read, value: it.value, show: it.show, type: it.type, idx: z.idx, mode: srMode } : null; };
window.__pbZ = () => zombies; window.__pbSpawn = () => spawnZombie(); window.__pbW = () => ({ phase: worldSt.phase, host: amZHost(), safe: worldSt.safe, rest: worldSt.rest, down: me.down, spec: spec.on, specName: $('#specName').textContent, chip: $('#phaseChip').textContent }); window.__pbHurt = () => { me.inv = 0; return hurtMe({ x: window.__pb.player.pos.x + 1, z: window.__pb.player.pos.z }); };
window.__pbWorld = W; window.__pbClimb = climb; window.__pbEat = eatSt; window.__pbPara = para; window.__pbVeh = veh; window.__pbTalk = (i) => talkTo(W.npcs[i]);
window.__pb = { zones, player, save: () => save, walkTo, onTap, camera, view, stick, teleport, openMap: () => openMap(), speak, voices: () => idVoices, net, remotes, doLogin, doEmote, setCamMode, celebrate };
boot();
