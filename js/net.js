// Koneksi main bersama: WebSocket ke server rumah + obrolan suara WebRTC (tanpa internet).
export const net = { online: false, id: null, voiceOK: false, mic: false };
let ws = null, onMsg = () => {}, onStatus = () => {}, timer = 0, tries = 0, wantOpen = false;

export function connect(handler, status) {
  onMsg = handler; onStatus = status; wantOpen = true;
  if (location.protocol === 'file:') { status('offline'); return; }
  open();
}
function open() {
  clearTimeout(timer);
  try { ws = new WebSocket(`${location.protocol === 'https:' ? 'wss' : 'ws'}://${location.host}/ws`); } catch (e) { return retry(); }
  ws.onopen = () => { tries = 0; net.online = true; onStatus('online'); };
  ws.onmessage = (e) => { let m; try { m = JSON.parse(e.data); } catch (er) { return; } onMsg(m); };
  ws.onclose = () => { const was = net.online; net.online = false; net.id = null; closeAllPeers(); if (was) onStatus('lost'); retry(); };
  ws.onerror = () => {};
}
function retry() {
  if (!wantOpen) return;
  tries++; if (tries === 2) onStatus('offline');
  timer = setTimeout(open, Math.min(8000, 800 * tries));
}
export function stopNet() { wantOpen = false; ws?.close(); }
export function send(m) { if (ws && ws.readyState === 1) { ws.send(JSON.stringify(m)); return true; } return false; }

/* ---------------- obrolan suara (mesh WebRTC, cocok untuk beberapa perangkat di WiFi rumah) ---------------- */
// mikrofon hanya diizinkan browser di halaman https (atau localhost)
net.voiceOK = !!(window.isSecureContext && navigator.mediaDevices?.getUserMedia && window.RTCPeerConnection);
const peers = new Map();
window.__pbPeers = peers; // untuk pengujian otomatis
let micStream = null, actx = null;
const levelOf = new Map();
function audioCtx() { if (!actx) { try { actx = new (window.AudioContext || window.webkitAudioContext)(); } catch (e) { /* tanpa analisa */ } } return actx; }
function meter(id, stream) {
  const a = audioCtx(); if (!a) return;
  try {
    const src = a.createMediaStreamSource(stream); const an = a.createAnalyser(); an.fftSize = 512; src.connect(an);
    const buf = new Uint8Array(an.fftSize);
    levelOf.set(id, () => { an.getByteTimeDomainData(buf); let s = 0; for (const v of buf) s += (v - 128) * (v - 128); return Math.sqrt(s / buf.length) / 128; });
  } catch (e) { /* abaikan */ }
}
export const voiceLevel = (id) => { const f = levelOf.get(id); return f ? f() : 0; };

export function addPeer(id, theirSecure) {
  if (!net.voiceOK || !theirSecure || peers.has(id) || id === net.id) return;
  const pc = new RTCPeerConnection({ iceServers: [] });
  const tr = pc.addTransceiver('audio', { direction: 'sendrecv' });
  const audio = new Audio(); audio.autoplay = true; audio.playsInline = true; audio.style.display = 'none'; document.body.appendChild(audio);
  const p = { pc, sender: tr.sender, audio, polite: net.id > id, making: false, ignore: false };
  peers.set(id, p);
  if (micStream) tr.sender.replaceTrack(micStream.getAudioTracks()[0]);
  pc.ontrack = (e) => {
    const st = e.streams[0] || new MediaStream([e.track]);
    audio.srcObject = st; audio.play().catch(() => pendingPlay.add(audio)); meter(id, st);
  };
  pc.onicecandidate = (e) => send({ t: 'rtc', to: id, data: { cand: e.candidate } });
  pc.onnegotiationneeded = async () => {
    try { p.making = true; await pc.setLocalDescription(); send({ t: 'rtc', to: id, data: { desc: pc.localDescription } }); }
    catch (e) { /* coba lagi saat berikutnya */ } finally { p.making = false; }
  };
}
// pola "perfect negotiation" agar dua perangkat bisa memulai bersamaan tanpa bentrok
export async function onRtc(from, data, theirSecure = true) {
  if (!peers.has(from)) addPeer(from, theirSecure);
  const p = peers.get(from); if (!p) return;
  const { pc } = p;
  try {
    if (data.desc) {
      const collision = data.desc.type === 'offer' && (p.making || pc.signalingState !== 'stable');
      p.ignore = !p.polite && collision; if (p.ignore) return;
      await pc.setRemoteDescription(data.desc);
      if (data.desc.type === 'offer') { await pc.setLocalDescription(); send({ t: 'rtc', to: from, data: { desc: pc.localDescription } }); }
    } else if ('cand' in data) {
      try { await pc.addIceCandidate(data.cand || null); } catch (e) { if (!p.ignore) throw e; }
    }
  } catch (e) { /* abaikan sinyal rusak */ }
}
export function removePeer(id) {
  const p = peers.get(id); if (!p) return;
  try { p.pc.close(); } catch (e) { /* abaikan */ }
  p.audio.remove(); peers.delete(id); levelOf.delete(id);
}
function closeAllPeers() { for (const id of [...peers.keys()]) removePeer(id); }
export function setPeerVolume(id, v) { const p = peers.get(id); if (p) p.audio.volume = Math.max(0, Math.min(1, v)); }
export async function micOn() {
  if (!net.voiceOK) throw new Error('insecure');
  micStream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true } });
  const track = micStream.getAudioTracks()[0];
  for (const p of peers.values()) p.sender.replaceTrack(track);
  meter('me', micStream); net.mic = true; send({ t: 'voice', on: true });
}
export function micOff() {
  micStream?.getTracks().forEach((t) => t.stop()); micStream = null; levelOf.delete('me');
  for (const p of peers.values()) p.sender.replaceTrack(null);
  net.mic = false; send({ t: 'voice', on: false });
}
// iOS/Safari: suara baru boleh diputar setelah ketukan
const pendingPlay = new Set();
window.addEventListener('pointerdown', () => { for (const a of pendingPlay) a.play().catch(() => {}); pendingPlay.clear(); actx?.resume?.(); }, true);
