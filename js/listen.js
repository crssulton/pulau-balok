// Pengenal suara untuk menjawab soal membaca (huruf, angka, iqro').
// Suara hanya dipakai di perangkat ini untuk mencocokkan jawaban, tidak dikirim ke pemain lain.
// Catatan: Chrome/Edge/Android memproses suara di server Google (butuh internet); Safari memakai milik Apple.
const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
export const srSupported = () => !!SR && !!window.isSecureContext;
let rec = null;

// dengarkan satu jawaban; hasil: { alts: [transkrip...], error }
// hold = true: mendengar selama tombol ditahan (seperti pesan suara WhatsApp); selesai saat stopListen(true)
export function listen({ lang = 'id-ID', timeout = 7000, hold = false, onInterim } = {}) {
  return new Promise((resolve) => {
    if (!srSupported()) { resolve({ alts: [], error: SR ? 'insecure' : 'unsupported' }); return; }
    try { rec?.abort(); } catch (e) { /* abaikan */ }
    const r = new SR(); rec = r;
    r.lang = lang; r.interimResults = true; r.maxAlternatives = 5; r.continuous = hold;
    let done = false, finals = [], interim = '';
    const finish = (out) => { if (done) return; done = true; clearTimeout(tm); resolve(out); };
    r.onresult = (e) => {
      interim = '';
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const res = e.results[i]; const list = [...res].map((a) => a.transcript.trim()).filter(Boolean);
        if (res.isFinal) finals.push(list); else interim = list[0] || '';
      }
      const shown = [...finals.map((l) => l[0]), interim].filter(Boolean).join(' ');
      if (shown) onInterim?.(shown);
      if (!hold && e.results[e.results.length - 1].isFinal) finish({ alts: collect() });
    };
    // gabungkan semua potongan kalimat + alternatifnya
    const collect = () => {
      const alts = new Set(); const firsts = finals.map((l) => l[0]);
      if (firsts.length) alts.add(firsts.join(' '));
      for (const l of finals) for (const a of l) alts.add(a);
      if (interim) { alts.add([...firsts, interim].join(' ')); alts.add(interim); }
      return [...alts].filter(Boolean);
    };
    r.onerror = (e) => { if (e.error === 'no-speech' || e.error === 'aborted') return; finish({ alts: collect(), error: e.error || 'error' }); };
    r.onend = () => { const alts = collect(); finish({ alts, error: alts.length ? null : 'no-speech' }); };
    const tm = setTimeout(() => { try { r.stop(); } catch (e) { /* abaikan */ } }, hold ? 20000 : timeout);
    try { r.start(); } catch (e) { finish({ alts: [], error: 'start' }); }
  });
}
// submit = true: berhenti & nilai yang sudah terdengar (lepas tombol); false: batalkan
export function stopListen(submit = false) { try { if (submit) rec?.stop(); else rec?.abort(); } catch (e) { /* abaikan */ } }

/* ---------------- pencocokan jawaban (sengaja longgar untuk suara anak) ---------------- */
export const norm = (s) => String(s).toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9 ]/g, ' ').replace(/\s+/g, ' ').trim();
export function lev(a, b) {
  const m = a.length, n = b.length; if (!m) return n; if (!n) return m;
  let prev = Array.from({ length: n + 1 }, (_, j) => j);
  for (let i = 1; i <= m; i++) {
    const cur = [i];
    for (let j = 1; j <= n; j++) cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
    prev = cur;
  }
  return prev[n];
}
// samakan bunyi yang mirip (kh/k, sy/s, ts/s, o/a, dll.) agar transliterasi iqro' & suku kata tidak terlalu ketat
export function simplify(s, arab = false) {
  let t = norm(s).replace(/ /g, '').replace(/kh/g, 'k').replace(/gh/g, 'g').replace(/sy|sh|ts/g, 's').replace(/th/g, 't').replace(/dz|zh/g, 'z').replace(/dh/g, 'd').replace(/q/g, 'k');
  if (arab) t = t.replace(/o/g, 'a').replace(/e/g, 'i'); // logat baca iqro' (kho/kha, ro/ra)
  return t.replace(/(.)\1+/g, '$1').replace(/h$/, '');
}
const NW = { nol: 0, kosong: 0, satu: 1, dua: 2, tiga: 3, empat: 4, lima: 5, enam: 6, tujuh: 7, delapan: 8, sembilan: 9 };
// "dua ratus lima belas" -> 215 ; "23" -> 23
export function toNumber(s) {
  const t = norm(s); const dg = t.replace(/ /g, '').match(/^\d+$/); if (dg) return +dg[0];
  const d2 = t.match(/\d+/); if (d2 && t.replace(/\d+/g, '').trim().length < 3) return +d2[0];
  let total = 0, small = 0, any = false;
  for (const w of t.split(' ')) {
    if (w in NW) { small = NW[w]; any = true; } else if (w === 'sepuluh') { total += 10; any = true; } else if (w === 'sebelas') { total += 11; any = true; }
    else if (w === 'seratus') { total += 100; any = true; } else if (w === 'seribu') { total += 1000; any = true; }
    else if (w === 'belas') { total += small + 10; small = 0; } else if (w === 'puluh') { total += small * 10; small = 0; }
    else if (w === 'ratus') { total += small * 100; small = 0; } else if (w === 'ribu') { total += (total + small) * 1000 - total; small = 0; }
    else if (/^\d+$/.test(w)) { small = +w; any = true; }
  }
  return any ? total + small : null;
}
const UNIT = ['nol', 'satu', 'dua', 'tiga', 'empat', 'lima', 'enam', 'tujuh', 'delapan', 'sembilan'];
export function numWords(n) {
  if (n < 10) return UNIT[n];
  if (n === 10) return 'sepuluh'; if (n === 11) return 'sebelas'; if (n < 20) return `${UNIT[n - 10]} belas`;
  if (n < 100) return `${UNIT[Math.floor(n / 10)]} puluh${n % 10 ? ' ' + UNIT[n % 10] : ''}`;
  if (n < 1000) { const h = Math.floor(n / 100), r = n % 100; return `${h === 1 ? 'seratus' : UNIT[h] + ' ratus'}${r ? ' ' + numWords(r) : ''}`; }
  return String(n);
}
// cek apakah salah satu transkrip cocok dengan soal
export function isMatch(item, alts) {
  for (const a of alts) {
    if (item.type === 'num') { if (toNumber(a) === item.value) return true; continue; }
    const words = norm(a).split(' ');
    if (item.type === 'letter') {
      const L = (item.letter || item.show).toLowerCase();
      if (words.some((w) => w === L || item.accept.some((x) => w === x || (x.length > 2 && lev(w, x) <= 1)))) return true;
      continue;
    }
    const ar = item.type === 'arab'; const got = simplify(a, ar), want = simplify(item.read, ar);
    const tol = want.length <= 2 ? 0 : want.length <= 4 ? 1 : want.length <= 8 ? 2 : 3; // jawaban pendek harus tepat
    if (lev(got, want) <= tol) return true;
    if (item.type === 'arab' && got.includes(want)) return true;
  }
  return false;
}
