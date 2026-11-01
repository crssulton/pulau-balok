// Pulau Balok v2 — Pulau Kebun (pembangun). Menyatukan engine (render, fisika, kontrol, kamera, karakter),
// dunia Pulau Kebun, Mode Bangun, dan jaringan rumah (server.py yang sama dengan game lama).
import * as THREE from '/lib/three.module.min.js';
import { connect, send, net } from '/js/net.js';
import { Render } from './core/render.js';
import { initMaterials, MAT } from './core/geo.js';
import { Physics } from './core/physics.js';
import { Controller, BODY } from './core/controller.js';
import { FollowCamera } from './core/camera.js';
import { Input } from './core/input.js';
import { Avatar, nameTag } from './core/avatar.js';
import { $, $$, IS_TOUCH, clamp, damp, toast, speak, SFX } from './core/util.js';
import { buildKebun, PLOTS, DOCK, CX, CZ, heightAt } from './world/kebun.js';
import { Voxels } from './build/voxels.js';
import { Builder } from './build/builder.js';
import { SHAPES, PALETTE, PALETTE_NAMES } from './build/catalog.js';
import { loadBlocks, migrateFarm, toIsland } from './build/plots.js';

if (IS_TOUCH) document.body.classList.add('touch');
const AV_SCALE = 0.74;
const todayStr = () => { const d = new Date(); return `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`; };
const DEV_KEY = 'pb2-device';
const dev = Object.assign({ follow: true, fps: false, sound: true }, (() => { try { return JSON.parse(localStorage.getItem(DEV_KEY)) || {}; } catch (e) { return {}; } })());
const saveDev = () => { try { localStorage.setItem(DEV_KEY, JSON.stringify(dev)); } catch (e) { /* tanpa storage */ } };

/* ---------------- engine ---------------- */
const canvas = $('#c');
const R = new Render(canvas);
initMaterials();
const scene = R.scene, camera = R.camera;
const physics = new Physics();
const voxels = new Voxels(scene);
physics.voxels = voxels;
const world = buildKebun(scene, R, physics);
const ctl = new Controller(physics);
const cam = new FollowCamera(camera, physics);
cam.autoFollow = dev.follow;
const input = new Input(canvas, $('#stick'));
const builder = new Builder({ scene, camera, voxels, canvas, physics });

// pemain sendiri
const me = { av: new Avatar({}), tag: null, playing: false, name: '', key: '', save: null, plot: null, paused: false };
me.av.root.scale.setScalar(AV_SCALE);
scene.add(me.av.root);
ctl.teleport(world.spawn.x, heightAt(world.spawn.x, world.spawn.z), world.spawn.z); ctl.facing = world.spawn.facing; cam.yaw = world.spawn.facing + Math.PI;
window.__pb2 = { R, ctl, cam, voxels, builder, physics, me, world, send, scene, teleport: (x, z, y) => ctl.teleport(x, y ?? Math.max(0.3, heightAt(x, z)), z) };

/* ---------------- pemain lain ---------------- */
const remotes = new Map();
function addRemote(p) {
  if (!p || p.id === net.id || remotes.has(p.id)) return;
  const av = new Avatar(p.avatar || {}); av.root.scale.setScalar(AV_SCALE);
  const tag = nameTag(p.name || 'Teman'); tag.position.y = 2.75 / AV_SCALE; tag.scale.multiplyScalar(1 / AV_SCALE); av.root.add(tag);
  const pos = p.pos || { x: 0, z: 0, y: 0, f: 0 };
  av.root.position.set(pos.x, pos.y || 0, pos.z); scene.add(av.root);
  remotes.set(p.id, { id: p.id, name: p.name, v2: !!p.v2, key: (p.name || '').toLowerCase(), av, target: { ...pos }, last: { x: pos.x, z: pos.z }, speed: 0 });
}
function dropRemote(id) { const r = remotes.get(id); if (!r) return; scene.remove(r.av.root); remotes.delete(id); }
// pemain game lama hanya terlihat bila berada di Pulau Kebun lama (lingkar 125 m di tengah pulau ini)
const OLD_R = 125, inOldKebun = (x, z) => Math.hypot(x - CX, z - CZ) < OLD_R;

/* ---------------- bangunan semua pemain (bebas di seluruh pulau) ---------------- */
// p: {key, name, kav, v, blocks, items}. blocks null = belum pernah membuka v2: kebun lamanya ditampilkan sebagai balok
function showBuild(p) {
  if (!p || !p.key) return;
  if (p.key === me.key && builder.undoStack.length) return; // bangunan sendiri yang sedang diubah tidak ditimpa
  const plot = Number.isInteger(p.kav) ? PLOTS[p.kav] : null;
  if (Array.isArray(p.blocks)) loadBlocks(voxels, p.key, p.blocks, p.v || 1, plot);
  else if (plot) loadBlocks(voxels, p.key, migrateFarm(p.items || []), 1, plot);
  voxels.flush();
}

/* ---------------- simpanan ---------------- */
let saveTimer = 0, saveDirty = false;
function persist(now = false) {
  if (!me.save) return;
  if (builder.owner) me.save.build2 = { v: 2, blocks: builder.serialize() };
  me.save.updated = Date.now();
  saveDirty = true;
  clearTimeout(saveTimer);
  const go = () => { if (send({ t: 'save', data: me.save })) saveDirty = false; };
  if (now) go(); else saveTimer = setTimeout(go, 1200);
}
builder.onChange = () => { persist(); updateCount(); };
function updateCount() { $('#countChip').textContent = `🧱 ${builder.count()}`; }
builder.blocked = (bx) => {
  const hit = (x, y, z) => bx.maxx > x - BODY.R && bx.minx < x + BODY.R && bx.maxz > z - BODY.R && bx.minz < z + BODY.R && bx.maxy > y + 0.05 && bx.miny < y + BODY.H;
  if (hit(ctl.pos.x, ctl.pos.y, ctl.pos.z)) return true;
  for (const r of remotes.values()) { const p = r.av.root.position; if (r.av.root.visible && hit(p.x, p.y, p.z)) return true; }
  return false;
};

/* ---------------- jaringan ---------------- */
const screens = { loading: $('#loading'), login: $('#login'), hud: $('#hud') };
function show(name) { for (const [k, el] of Object.entries(screens)) el.classList.toggle('hidden', k !== name); }
let welcomed = false;
connect(onMessage, (st) => {
  const el = $('#netStatus');
  if (st === 'online') { el.textContent = ''; send({ t: 'names' }); if (me.name && welcomed) send({ t: 'login', name: me.name, v2: true, data: me.save }); }
  else if (st === 'offline') el.textContent = '📡 Server rumah belum tersambung. Pastikan launcher Pulau Balok sudah dibuka.';
  else if (st === 'lost') toast('📡 Sambungan terputus, mencoba lagi…');
});
show('login');

function onMessage(m) {
  switch (m.t) {
    case 'names': renderNames(m.list || []); break;
    case 'need_new': $('#newName').value = m.name; toast(`Nama ${m.name} belum ada. Tekan Mulai untuk membuat pemain baru.`); break;
    case 'welcome': onWelcome(m); break;
    case 'kicked': toast('Nama ini dipakai di perangkat lain.', 5000); me.playing = false; show('login'); break;
    case 'join': if (welcomed) addRemote(m.p); break;
    case 'leave': dropRemote(m.id); break;
    case 'move': { const r = remotes.get(m.id); if (r) Object.assign(r.target, m); break; }
    case 'pinfo': { const r = remotes.get(m.id); if (r && m.avatar) r.av.setLook(m.avatar); break; }
    case 'world': R.setNight(m.phase === 'night'); break;
    case 'buildWorld': onBuildWorld(m); break;
    case 'buildPlot': if (m.plot?.key !== me.key) { builtV2.add(m.plot.key); showBuild(m.plot); } break;
    case 'farmPlot': // pemain di game lama mengubah kebunnya: tampilkan bila dia belum punya bangunan v2
      if (m.plot && m.plot.key !== me.key && !Array.isArray(m.plot.blocks) && !builtV2.has(m.plot.key)) showBuild({ ...m.plot, blocks: null });
      break;
    case 'gift': if (me.save) { me.save.coins = (me.save.coins || 0) + (m.coins || 0); toast(`🎁 Hadiah ${m.coins} koin dari orang tua!`); persist(); } break;
    case 'error': toast(m.msg || 'Ada kesalahan.'); break;
    default:
  }
}
const builtV2 = new Set();

let knownNames = [];
function renderNames(list) {
  knownNames = list.map((p) => p.name || String(p));
  const box = $('#names'); box.innerHTML = '';
  if (!list.length) { box.innerHTML = '<span class="small">Belum ada pemain. Tulis nama baru di bawah.</span>'; return; }
  for (const p of list) {
    const b = document.createElement('button'); b.className = 'btn sun'; b.textContent = `${p.gender === 'P' ? '👧' : '👦'} ${p.name || p}`;
    b.onclick = () => login(p.name || p, false); box.appendChild(b);
  }
}
function login(name, create) {
  name = String(name).trim().slice(0, 16); if (!name) { toast('Tulis namamu dulu ya.'); return; }
  me.name = name; SFX.click();
  const g = $('#genderBtn').dataset.g;
  // nama yang sudah ada: masuk biasa (TIDAK pernah mengirim data baru, supaya kemajuan anak tidak tertimpa)
  const k = name.split(/\s+/).join(' ').toLowerCase();
  if (create && knownNames.some((n) => n.split(/\s+/).join(' ').toLowerCase() === k)) create = false;
  // updated: 0 -> server tidak akan memakai data ini untuk menimpa simpanan yang sudah ada
  const data = create ? { avatar: { shirt: g === 'P' ? 'merah muda' : 'biru', pants: 'hitam', skin: 1, hat: 'none', gender: g }, hats: ['none'], coins: 0, stars: 0, updated: 0 } : undefined;
  if (!send({ t: 'login', name, create, v2: true, data })) toast('Server rumah belum tersambung.');
}
$('#createBtn').onclick = () => login($('#newName').value, true);
$('#newName').addEventListener('keydown', (e) => { if (e.key === 'Enter') login($('#newName').value, true); });
$('#genderBtn').onclick = (e) => { const b = e.currentTarget, g = b.dataset.g === 'L' ? 'P' : 'L'; b.dataset.g = g; b.textContent = g === 'L' ? '👦' : '👧'; };

function onWelcome(m) {
  net.id = m.id;
  const d = m.data || {};
  d.avatar ||= { shirt: 'biru', pants: 'hitam', skin: 1, hat: 'none', gender: 'L' };
  if (!d.time || d.time.date !== todayStr()) d.time = { date: todayStr(), sec: 0, bonus: 0 };
  d.settings ||= { limit: 20, level: 0 };
  me.save = d; me.name = m.name; me.key = m.name.split(/\s+/).filter(Boolean).join(' ').toLowerCase().slice(0, 20);
  me.av.setLook(d.avatar);
  if (!me.tag) { me.tag = nameTag(m.name, '#ffe9a8'); me.tag.position.y = 2.75 / AV_SCALE; me.tag.scale.multiplyScalar(1 / AV_SCALE); me.av.root.add(me.tag); }
  for (const id of [...remotes.keys()]) dropRemote(id);
  for (const p of m.players || []) addRemote(p);
  R.setNight(false);
  $('#whoChip').textContent = `${d.avatar.gender === 'P' ? '👧' : '👦'} ${m.name} · 🪙 ${d.coins || 0}`;
  welcomed = true; me.playing = true;
  show('hud');
  send({ t: 'buildHello' });
  checkRest(true);
  canvas.focus();
}

function onBuildWorld(m) {
  for (const p of m.plots || []) if (Array.isArray(p.blocks)) builtV2.add(p.key);
  // kavling lama dari server hanya dipakai sebagai "rumah" (titik pulang) dan untuk mengubah kebun lama
  if (Number.isInteger(m.kav)) { me.save.farm ||= {}; me.save.farm.kav = m.kav; me.plot = PLOTS[m.kav]; }
  builder.setOwner(me.key);
  let migrated = false;
  const b2 = me.save.build2;
  let mine;
  if (Array.isArray(b2?.blocks)) mine = (b2.v || 1) >= 2 ? b2.blocks : me.plot ? toIsland(b2.blocks, me.plot) : [];
  else if (me.plot) { mine = toIsland(migrateFarm(me.save.farm?.items || []), me.plot); migrated = mine.length > 0; }
  else mine = [];
  for (const p of m.plots || []) if (p.key !== me.key) showBuild(p);
  showBuild({ key: me.key, name: me.name, v: 2, blocks: mine });
  builder._count = null; updateCount();
  if (migrated) toast('🌱 Kebunmu dari versi lama sudah diubah menjadi balok!', 4500);
  if (!b2 || (b2.v || 1) < 2) persist();
  toast('🔨 Bangun apa saja, di mana saja di pulau ini! Tekan Bangun.', 4500);
}

/* ---------------- Mode Bangun: UI ---------------- */
const shapesEl = $('#shapes'), colorsEl = $('#colors');
SHAPES.forEach((s, i) => {
  const b = document.createElement('button'); b.className = 'shape' + (i === 0 ? ' on' : ''); b.innerHTML = `${s.icon}<span>${s.name}</span>`; b.title = s.name;
  b.onclick = () => { selectShape(i); SFX.click(); }; shapesEl.appendChild(b);
});
PALETTE.forEach((c, i) => {
  const b = document.createElement('button'); b.className = 'swatch' + (i === builder.color ? ' on' : ''); b.style.background = c; b.title = PALETTE_NAMES[i]; b.setAttribute('aria-label', PALETTE_NAMES[i]);
  b.onclick = () => { selectColor(i); SFX.click(); }; colorsEl.insertBefore(b, colorsEl.lastElementChild);
});
function selectShape(i) {
  builder.setShape(i);
  if (SHAPES[i].defColor != null && !selectShape.touchedColor) selectColor(SHAPES[i].defColor, true);
  $$('.shape').forEach((b, k) => b.classList.toggle('on', k === i));
  setToolUI('place');
}
function selectColor(i, auto) {
  if (!auto) selectShape.touchedColor = true;
  builder.setColor(i); $$('.swatch:not(.custom)').forEach((b, k) => b.classList.toggle('on', k === i)); $('.swatch.custom').classList.remove('on');
  if (builder.tool === 'erase' || builder.tool === 'pick') setTool('place');
}
function setTool(t) { builder.setTool(t); setToolUI(t); }
function setToolUI(t) { $$('[data-tool]').forEach((b) => b.classList.toggle('on', b.dataset.tool === t)); }
$$('[data-tool]').forEach((b) => (b.onclick = () => { setTool(b.dataset.tool); SFX.click(); }));
builder.onPick = (b) => { $$('.shape').forEach((el, k) => el.classList.toggle('on', k === b.t)); $$('.swatch:not(.custom)').forEach((el, k) => el.classList.toggle('on', k === b.c)); setTool('place'); toast(`Pipet: ${SHAPES[b.t].name}${typeof b.c === 'number' ? ' ' + PALETTE_NAMES[b.c] : ''}`); };
$('#rotBtn').onclick = () => builder.rotate();
function cycleBrush() { const n = builder.brush % 3 + 1; builder.setBrush(n); $('#brushBtn').textContent = `🖌️ ${n}×${n}`; $('#brushBtn').classList.toggle('on', n > 1); SFX.click(); }
$('#brushBtn').onclick = cycleBrush;
function setFly(on) {
  ctl.fly = on; document.body.classList.toggle('flying', on);
  $('#flyBtn').classList.toggle('on', on); $('#downBtn').classList.toggle('hidden', !on);
  if (on) { ctl.vel.y = 4; toast(IS_TOUCH ? '🕊️ Terbang! Tahan ⬆️ untuk naik, ⬇️ untuk turun.' : '🕊️ Terbang! Spasi naik, Shift turun.'); }
}
$('#flyBtn').onclick = () => { setFly(!ctl.fly); SFX.click(); };
const db = $('#downBtn');
db.addEventListener('pointerdown', (e) => { e.preventDefault(); input.downHeld = true; });
for (const ev of ['pointerup', 'pointercancel', 'pointerleave']) db.addEventListener(ev, () => (input.downHeld = false));
$('#colorPick').addEventListener('input', (e) => { builder.setColor(e.target.value); $$('.swatch').forEach((b) => b.classList.toggle('on', b.classList.contains('custom'))); e.target.parentElement.style.background = e.target.value; if (builder.tool === 'erase' || builder.tool === 'pick') setTool('place'); });
$('#undoBtn').onclick = () => builder.undo();
$('#redoBtn').onclick = () => builder.redo();
$('#doneBtn').onclick = () => setBuild(false);
$('#buildBtn').onclick = () => setBuild(true);
function setBuild(on) {
  if (on && !builder.owner) { toast('Tunggu sebentar, sedang tersambung…'); return; }
  builder.setOn(on);
  document.body.classList.toggle('building', on);
  $('#buildBar').classList.toggle('hidden', !on);
  if (on) {
    cam.wantDist = Math.max(cam.wantDist, 14); cam.pitch = Math.max(cam.pitch, 0.62);
    speak('Pilih bentuk dan warna, lalu ketuk tempatnya.');
  } else { persist(true); cam.wantDist = 9; cam.pitch = 0.32; setFly(false); }
  SFX.click();
}
// pulang: ke dekat bangunanku; belum membangun: ke kavling lama (bila ada) atau alun-alun
function goHome() {
  const c = builder.center();
  let x, z;
  if (c) { x = c[0]; z = c[1] + 6; } else if (me.plot) { [x, z] = me.plot.front; } else { x = world.spawn.x; z = world.spawn.z; }
  ctl.teleport(x, Math.max(0.3, heightAt(x, z)), z); ctl.unstick();
  ctl.facing = c ? Math.atan2(c[0] - x, c[1] - z) : world.spawn.facing; cam.yaw = ctl.facing + Math.PI;
  cam.target.set(x, ctl.pos.y + 1.7, z);
}
$('#homeBtn').onclick = () => { goHome(); SFX.click(); };
// peta: pindah cepat ke wilayah pulau
for (const s of world.SPOTS) {
  const b = document.createElement('button'); b.className = 'tool'; b.style.height = '64px'; b.style.fontSize = '19px'; b.style.justifyContent = 'center';
  b.textContent = `${s.emoji} ${s.name}`;
  b.onclick = () => { travel(s.x, s.z); $('#map').classList.add('hidden'); toast(`${s.emoji} ${s.name}`); SFX.click(); };
  $('#spots').appendChild(b);
}
function travel(x, z) {
  ctl.teleport(x, Math.max(0.3, heightAt(x, z)), z); ctl.unstick();
  cam.target.set(x, ctl.pos.y + 1.7, z); cam.cur = 2;
}
$('#mapBtn').onclick = () => { $('#map').classList.remove('hidden'); SFX.click(); };
$('#mapClose').onclick = () => $('#map').classList.add('hidden');
$('#camBtn').onclick = () => { cam.yaw = ctl.facing + Math.PI; cam.pitch = builder.on ? 0.62 : 0.32; SFX.click(); };
$('#backBtn').onclick = () => leave();
function leave() { persist(true); setTimeout(() => (location.href = '/'), 250); }

// lompat (sentuh)
const jb = $('#jumpBtn');
jb.addEventListener('pointerdown', (e) => { e.preventDefault(); input.jumpHeld = true; input.jumpPressed = true; });
for (const ev of ['pointerup', 'pointercancel', 'pointerleave']) jb.addEventListener(ev, () => (input.jumpHeld = false));

// klik/ketuk di dunia
input.onTap = (x, y) => { if (!me.playing) return; if (builder.on) { builder.tap(x, y); updateCount(); } };
input.onHover = (x, y) => builder.hover(x, y);
input.onKey = (k, e) => {
  if (!me.playing) return;
  if (k === 'b') setBuild(!builder.on);
  else if (k === 'escape') { if (!$('#settings').classList.contains('hidden')) closeSettings(); else if (builder.on) setBuild(false); }
  else if (k === 'h') goHome();
  else if (k === 'm') $('#map').classList.toggle('hidden');
  else if (k === 'f' || k === 'enter') $('#prompt').click();
  if (!builder.on) return;
  if (k >= '1' && k <= '9') selectShape(Math.min(SHAPES.length - 1, +k - 1));
  else if (k === '0') selectShape(9);
  else if (k === 'r') builder.rotate();
  else if (k === 'x') setTool(builder.tool === 'erase' ? 'place' : 'erase');
  else if (k === 'c') setTool('paint');
  else if (k === 'p') setTool('pick');
  else if (k === 'z' || (k === 'z' && (e.ctrlKey || e.metaKey))) builder.undo();
  else if (k === 'y') builder.redo();
  else if (k === 'k') cycleBrush();
  else if (k === 't') setFly(!ctl.fly);
};

/* ---------------- pengaturan ---------------- */
function syncSettings() {
  $$('#qualSeg [data-q]').forEach((b) => b.classList.toggle('on', R.auto ? b.dataset.q === 'auto' : b.dataset.q === String(R.level)));
  $('#followTgl').classList.toggle('on', dev.follow); $('#fpsTgl').classList.toggle('on', dev.fps); $('#soundTgl').classList.toggle('on', dev.sound);
  $('#fps').classList.toggle('hidden', !dev.fps);
}
function closeSettings() { $('#settings').classList.add('hidden'); }
$('#setBtn').onclick = () => { syncSettings(); $('#settings').classList.remove('hidden'); };
$('#setClose').onclick = closeSettings;
$$('#qualSeg [data-q]').forEach((b) => (b.onclick = () => { R.setQuality(b.dataset.q === 'auto' ? 'auto' : +b.dataset.q); syncSettings(); }));
$('#followTgl').onclick = () => { dev.follow = !dev.follow; cam.autoFollow = dev.follow; saveDev(); syncSettings(); };
$('#fpsTgl').onclick = () => { dev.fps = !dev.fps; saveDev(); syncSettings(); };
$('#soundTgl').onclick = () => { dev.sound = !dev.sound; saveDev(); syncSettings(); window.__pbMute = !dev.sound; };
window.__pbMute = !dev.sound;
syncSettings();

/* ---------------- batas waktu bermain (diatur orang tua di game lama) ---------------- */
function limitSec() { const s = me.save; return s?.settings?.limit ? s.settings.limit * 60 + (s.time?.bonus || 0) : Infinity; }
function checkRest(first) {
  if (!me.save) return;
  const lim = limitSec(), used = me.save.time.sec;
  if (used >= lim) {
    me.playing = false; setBuild(false);
    $('#restText').textContent = `${me.name} sudah bermain ${Math.round(used / 60)} menit hari ini. Lanjut besok ya!`;
    $('#rest').classList.remove('hidden'); persist(true);
  } else if (!first && lim - used < 120 && !checkRest.warned) { checkRest.warned = true; toast('⏰ Sebentar lagi waktunya istirahat.', 4000); speak('Sebentar lagi waktunya istirahat ya.'); }
}

/* ---------------- interaksi: warga, perahu ---------------- */
const promptEl = $('#prompt'), bubble = $('#bubble');
let promptAct = null, bubbleT = 0;
promptEl.onclick = () => { promptAct?.(); SFX.click(); };
function setPrompt(text, act) {
  if (!text) { if (!promptEl.classList.contains('hidden')) promptEl.classList.add('hidden'); promptAct = null; return; }
  if (promptEl.textContent !== text) promptEl.textContent = text;
  promptEl.classList.remove('hidden'); promptAct = act;
}
function say(who, text) { bubble.innerHTML = `<b>${who}</b>${text}`; bubble.classList.remove('hidden'); bubbleT = 5 + text.length * 0.04; speak(text); }
function interactions(dt) {
  bubbleT -= dt; if (bubbleT <= 0) bubble.classList.add('hidden');
  if (builder.on) return setPrompt(null);
  const p = ctl.pos;
  if (Math.hypot(p.x - DOCK.x, p.z - (DOCK.z + 4)) < 5) return setPrompt('⛵ Naik perahu ke Pulau Balok', leave);
  for (const n of world.npcs) if (Math.hypot(p.x - n.x, p.z - n.z) < 4) return setPrompt(`💬 Bicara dengan ${n.name}`, () => { say(n.name, n.lines[n.line % n.lines.length]); n.line++; });
  setPrompt(null);
}

/* ---------------- loop ---------------- */
let last = performance.now(), t = 0, moveT = 0, lastMove = '', saveT = 0, fpsAcc = 0, fpsN = 0, prevSpeed = 0;
const fpsEl = $('#fps');
function frame(now) {
  requestAnimationFrame(frame);
  let raw = (now - last) / 1000; last = now;
  const dt = Math.min(raw, 0.05); t += dt;
  const inp = input.frame();
  if (me.playing && !document.hidden) {
    // kamera: seret, roda/cubit, Q/E
    cam.orbit(inp.look.dx, inp.look.dy);
    if (input.keys.has('q')) cam.orbit(-dt * 2.2, 0); if (input.keys.has('e')) cam.orbit(dt * 2.2, 0);
    if (inp.zoom !== 1) cam.zoom(inp.zoom);
    // masukan joystick/keyboard relatif arah kamera
    const f = cam.forward(), rx = -f.z, rz = f.x;
    let ix = rx * inp.x - f.x * inp.y, iz = rz * inp.x - f.z * inp.y;
    if (inp.jump) ctl.jump();
    ctl.jumpHeld = input.jumpHeld;
    if (ctl.fly) ctl.flyUp = (input.jumpHeld ? 1 : 0) - (input.downHeld || input.keys.has('shift') ? 1 : 0);
    const res = ctl.update(dt, ix, iz, input.run && !ctl.fly);
    if (res.jumped) SFX.jump();
    if (ctl.landed > 9) { SFX.land(); if (ctl.landed > 20) cam.shake = 0.6; }
    if (ctl.pos.y < -9) goHome();
    me.save.time.sec += dt; saveT += dt;
    if (saveT > 20) { saveT = 0; persist(); checkRest(); }
  }
  // karakter
  me.av.root.position.set(ctl.pos.x, ctl.pos.y, ctl.pos.z);
  me.av.root.rotation.y = ctl.facing;
  me.av.update(dt, { speed: ctl.speed, onGround: ctl.onGround, vy: ctl.vel.y, landed: ctl.landed, accel: (ctl.speed - prevSpeed) / Math.max(dt, 1e-3) });
  prevSpeed = ctl.speed;
  // pemain lain: posisi diperhalus, animasi dari kecepatan
  for (const r of remotes.values()) {
    const tg = r.target, root = r.av.root;
    const vis = r.v2 ? true : inOldKebun(tg.x, tg.z) && tg.p !== 99; root.visible = vis; if (!vis) continue;
    root.position.x = damp(root.position.x, tg.x, 10, dt); root.position.z = damp(root.position.z, tg.z, 10, dt); root.position.y = damp(root.position.y, tg.y || 0, 12, dt);
    root.rotation.y += Math.atan2(Math.sin((tg.f || 0) - root.rotation.y), Math.cos((tg.f || 0) - root.rotation.y)) * Math.min(1, dt * 10);
    const sp = Math.hypot(root.position.x - r.last.x, root.position.z - r.last.z) / Math.max(dt, 1e-3); r.last.x = root.position.x; r.last.z = root.position.z;
    r.speed = damp(r.speed, sp, 8, dt);
    r.av.update(dt, { speed: r.speed, onGround: (tg.y || 0) < 0.05 || Math.abs(root.position.y - (tg.y || 0)) < 0.2 });
  }
  cam.update(dt, ctl.pos, ctl.speed > 0.5, ctl.facing, builder.on);
  // sembunyikan badan sendiri bila kamera sangat dekat (tidak melihat bagian dalam kepala)
  me.av.root.visible = cam.cur > 1.1;
  world.update(dt, t, R.night, ctl.pos, camera.position);
  MAT.glow.emissiveIntensity = R.night * 1.6;
  if (builder.on && IS_TOUCH && builder.target) builder.placeGhost(builder.target);
  voxels.flush();
  interactions(dt);
  // kirim posisi 10x per detik (format sama dengan game lama)
  moveT += dt;
  if (me.playing && net.online && moveT > 0.1) {
    moveT = 0;
    // di luar Pulau Kebun lama: kode jeda (99) supaya pemain game lama tidak melihat kita melayang di pulau lain
    const mm = { t: 'move', x: +ctl.pos.x.toFixed(2), z: +ctl.pos.z.toFixed(2), y: +ctl.pos.y.toFixed(2), f: +ctl.facing.toFixed(2), m: ctl.speed > 0.5 ? 1 : 0, p: inOldKebun(ctl.pos.x, ctl.pos.z) ? 0 : 99, pc: 0 };
    const k = `${mm.x},${mm.z},${mm.y},${mm.f}`; if (k !== lastMove) { lastMove = k; send(mm); }
  }
  R.update(dt, ctl.pos);
  R.watchPerf(raw);
  R.draw();
  if (dev.fps) { fpsAcc += raw; fpsN++; if (fpsAcc > 0.5) { const info = R.renderer.info.render; fpsEl.textContent = `${Math.round(fpsN / fpsAcc)} fps · ${info.calls} draw · ${(info.triangles / 1000).toFixed(0)}k tri · ${['Hemat', 'Seimbang', 'Bagus'][R.level]} ${R.pixelRatio.toFixed(2)}x`; fpsAcc = 0; fpsN = 0; } }
}
document.addEventListener('visibilitychange', () => { if (document.hidden) persist(true); });
addEventListener('pagehide', () => persist(true));
requestAnimationFrame(frame);
