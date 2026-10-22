// Aturan ekonomi Pulau Kebun (tanpa three.js). Waktu tumbuh hanya maju saat pemain aktif.
// Setiap pemain punya satu kavling 24x24 m (grid 1 m) yang dibagi 3x3 tanah @ 8 m. Barang ditaruh bebas di grid tanah milik sendiri.
export const CROPS = {
  wortel: { name: 'Wortel', emoji: '🥕', color: '#ff912b', seed: 2, buy: 7, sell: 5, seconds: 60 },
  kentang: { name: 'Kentang', emoji: '🥔', color: '#c99a62', seed: 3, buy: 9, sell: 6, seconds: 80 },
  tomat: { name: 'Tomat', emoji: '🍅', color: '#ed5550', seed: 3, buy: 11, sell: 8, seconds: 120 },
  cabai: { name: 'Cabai', emoji: '🌶️', color: '#d83b36', seed: 4, buy: 14, sell: 10, seconds: 145 },
  jagung: { name: 'Jagung', emoji: '🌽', color: '#ffd343', seed: 4, buy: 16, sell: 12, seconds: 180 },
  stroberi: { name: 'Stroberi', emoji: '🍓', color: '#f04c64', seed: 5, buy: 20, sell: 15, seconds: 220 },
  labu: { name: 'Labu', emoji: '🎃', color: '#f28c28', seed: 6, buy: 25, sell: 19, seconds: 260 },
  semangka: { name: 'Semangka', emoji: '🍉', color: '#50a95a', seed: 7, buy: 30, sell: 23, seconds: 300 },
};
// katalog Mode Bangun: w x d dalam meter (grid 1 m), diputar 90° menukar w dan d. Daftar id sama dengan FARM_ITEMS di server.py.
export const ITEMS = {
  petak: { name: 'Petak Tanam', emoji: '🟫', w: 2, d: 2, price: 3 },
  jalan: { name: 'Jalan Batu', emoji: '🪨', w: 2, d: 2, price: 1 },
  pagar: { name: 'Pagar', emoji: '🪵', w: 2, d: 1, price: 2 },
  bunga: { name: 'Bunga', emoji: '🌷', w: 1, d: 1, price: 2 },
  pohon: { name: 'Pohon', emoji: '🌳', w: 2, d: 2, price: 6 },
  bangku: { name: 'Bangku', emoji: '🪑', w: 2, d: 1, price: 5 },
  lampu: { name: 'Lampu', emoji: '🏮', w: 1, d: 1, price: 8 },
  ayunan: { name: 'Ayunan', emoji: '🎠', w: 3, d: 2, price: 12 },
  kolam: { name: 'Kolam Ikan', emoji: '🐟', w: 4, d: 4, price: 15 },
  sumur: { name: 'Sumur', emoji: '💧', w: 2, d: 2, price: 20 },
  gudang: { name: 'Gudang', emoji: '🏚️', w: 4, d: 4, price: 30 },
  rumah: { name: 'Rumah', emoji: '🏡', w: 6, d: 6, price: 50 },
};
export const KAV = 24, SECTOR = 8, LAND_COUNT = 9, MAX_ITEMS = 160;
export const DAY_SEC = 180; // satu hari kebun = 3 menit bermain (atau sekali tidur)
export const LAND_ORDER = [4, 1, 3, 5, 7, 0, 2, 6, 8]; // tanah tengah dibuka dulu
const cropMap = (value = 0) => Object.fromEntries(Object.keys(CROPS).map((id) => [id, value]));

export function newFarm() {
  return { version: 3, day: 1, clock: 0, kav: null, seeds: cropMap(), harvest: cropMap(), lands: Array(LAND_COUNT).fill(false), items: [], inv: {} };
}
// simpanan lama dibawa ke versi 3 tanpa membuang kemajuan: petak lama jadi Petak Tanam di tanah yang sama, bangunan masuk tas
export function normalizeFarm(old) {
  const f = newFarm(); if (!old || typeof old !== 'object') return f;
  f.day = Math.max(1, Number(old.day) || 1); f.clock = Math.max(0, Number(old.clock) || 0);
  f.kav = Number.isInteger(old.kav) ? old.kav : null;
  for (const id of Object.keys(CROPS)) { f.seeds[id] = Math.max(0, Number(old.seeds?.[id]) || 0); f.harvest[id] = Math.max(0, Number(old.harvest?.[id]) || 0); }
  if (Array.isArray(old.lands)) for (let i = 0; i < LAND_COUNT; i++) f.lands[i] = !!old.lands[i];
  for (const [id, n] of Object.entries(old.inv || {})) if (ITEMS[id] && n > 0) f.inv[id] = Math.floor(n);
  if (Array.isArray(old.items)) f.items = old.items.filter((it) => ITEMS[it?.k] && Number.isInteger(it.x) && Number.isInteger(it.z)).slice(0, MAX_ITEMS).map((it) => ({ ...it, r: (it.r | 0) & 3 }));
  else if (Array.isArray(old.plots)) { // versi 2: 9 petak per tanah
    if (!Array.isArray(old.lands) && old.plots.some((p) => p?.tilled || p?.crop)) f.lands[0] = true;
    old.plots.forEach((p, i) => {
      const land = Math.floor(i / 9), pr = Math.floor((i % 9) / 3), pc = i % 3;
      if (!f.lands[land] || !(p?.tilled || p?.crop)) return;
      f.items.push({ k: 'petak', x: (land % 3) * SECTOR + 1 + pc * 2, z: Math.floor(land / 3) * SECTOR + 1 + pr * 2, r: 0, crop: CROPS[p.crop] ? p.crop : null, watered: !!p.watered, growth: Math.max(0, Number(p.growth) || 0) });
    });
    for (const [id, n] of Object.entries(old.buildings || {})) if (ITEMS[id] && n) f.inv[id] = (f.inv[id] || 0) + 1;
  }
  return f;
}

/* ---------------- grid kavling ---------------- */
export const size = (it) => { const c = ITEMS[it.k]; return it.r & 1 ? [c.d, c.w] : [c.w, c.d]; };
export const sectorAt = (x, z) => Math.floor(x / SECTOR) + 3 * Math.floor(z / SECTOR);
export const sectorOf = (it) => sectorAt(it.x, it.z); // barang selalu utuh di satu tanah, jadi sudut kiri-atas menentukan tanahnya
export const center = (it) => { const [w, d] = size(it); return [it.x + w / 2, it.z + d / 2]; };
export function canPlace(f, k, x, z, r = 0, skip = -1) {
  const c = ITEMS[k]; if (!c) return { ok: false, message: 'Barang tidak dikenal.' };
  const it = { k, x, z, r }, [w, d] = size(it);
  if (x < 0 || z < 0 || x + w > KAV || z + d > KAV) return { ok: false, message: 'Di luar kavlingmu.' };
  const s = sectorAt(x, z);
  if (sectorAt(x + w - 1, z + d - 1) !== s) return { ok: false, message: 'Barang harus utuh di satu tanah. Geser sedikit, ya.' };
  if (!f.lands[s]) return { ok: false, message: 'Tanah ini belum milikmu. Beli di Pak Lurah.' };
  for (let i = 0; i < f.items.length; i++) {
    if (i === skip) continue; const o = f.items[i], [ow, od] = size(o);
    if (x < o.x + ow && o.x < x + w && z < o.z + od && o.z < z + d) return { ok: false, message: `Sudah ada ${ITEMS[o.k].name} di situ.` };
  }
  if (f.items.length >= MAX_ITEMS) return { ok: false, message: 'Kavlingmu sudah penuh barang.' };
  return { ok: true };
}
// taruh dari tas (gratis) atau beli baru
export function placeItem(save, k, x, z, r = 0) {
  const f = save.farm, c = ITEMS[k], check = canPlace(f, k, x, z, r); if (!check.ok) return check;
  const fromBag = (f.inv[k] || 0) > 0;
  if (!fromBag && (save.coins || 0) < c.price) return { ok: false, message: `Perlu ${c.price} koin untuk ${c.name}.` };
  if (fromBag) { if (!--f.inv[k]) delete f.inv[k]; } else save.coins -= c.price;
  const it = { k, x, z, r: r & 3 }; if (k === 'petak') Object.assign(it, { crop: null, watered: false, growth: 0 });
  f.items.push(it);
  return { ok: true, item: it, message: `${c.emoji} ${c.name} ditaruh!` };
}
// simpan ke tas: barang tidak hilang dan bisa ditaruh lagi di tempat lain
export function pickUp(f, index) {
  const it = f.items[index]; if (!it) return { ok: false, message: 'Barang tidak ditemukan.' };
  if (it.crop) return { ok: false, message: 'Panen dulu tanamannya, baru petaknya dipindah.' };
  f.items.splice(index, 1); f.inv[it.k] = (f.inv[it.k] || 0) + 1;
  return { ok: true, message: `${ITEMS[it.k].emoji} ${ITEMS[it.k].name} masuk tas.` };
}
export const refundOf = (k) => Math.floor((ITEMS[k]?.price || 0) / 2);
export function sellBack(save, k) {
  const f = save.farm; if (!(f.inv[k] > 0)) return { ok: false, message: 'Barang itu tidak ada di tas.' };
  if (!--f.inv[k]) delete f.inv[k]; save.coins = (save.coins || 0) + refundOf(k);
  return { ok: true, message: `${ITEMS[k].name} dijual. ${refundOf(k)} koin kembali.` };
}

/* ---------------- berkebun ---------------- */
export const ripe = (it) => !!CROPS[it?.crop] && it.growth >= CROPS[it.crop].seconds;
export const stage = (it) => (!it.crop ? 0 : ripe(it) ? 4 : 1 + Math.min(2, Math.floor((it.growth / CROPS[it.crop].seconds) * 3))); // 0 kosong, 1-3 tumbuh, 4 matang
export function growFarm(f, seconds) {
  if (!(seconds > 0) || !Number.isFinite(seconds)) return;
  f.clock += seconds; while (f.clock >= DAY_SEC) { f.day++; f.clock -= DAY_SEC; }
  for (const it of f.items) if (it.crop && it.watered) it.growth = Math.min(CROPS[it.crop].seconds, it.growth + seconds);
}
// satu tombol yang tepat untuk barang di dekat pemain (seperti "proximity prompt" di Roblox)
export function promptFor(f, it, seed) {
  if (it.k === 'rumah') return { act: 'tidur', emoji: '🌙', label: 'Tidur', sub: 'Tanaman tumbuh 1 hari' };
  if (it.k !== 'petak') return null;
  if (!it.crop) {
    const pick = f.seeds[seed] > 0 ? seed : Object.keys(CROPS).find((id) => f.seeds[id] > 0);
    return pick ? { act: 'tanam', seed: pick, emoji: CROPS[pick].emoji, label: `Tanam ${CROPS[pick].name}`, sub: `Bibit ${f.seeds[pick]}` } : { act: 'beli', emoji: '🧺', label: 'Bibit habis', sub: 'Beli di Bu Tini' };
  }
  const c = CROPS[it.crop];
  if (ripe(it)) return { act: 'panen', emoji: c.emoji, label: `Panen ${c.name}`, sub: 'Siap!' };
  if (!it.watered) return { act: 'siram', emoji: '💧', label: 'Siram', sub: `${c.name} haus` };
  return { act: 'tunggu', emoji: '⏳', label: `${Math.floor((it.growth / c.seconds) * 100)}%`, sub: `${c.name} tumbuh` };
}
export function workItem(f, it, act, seed) {
  if (!it || it.k !== 'petak') return { ok: false, message: 'Ini bukan petak tanam.' };
  if (act === 'tanam') {
    if (it.crop) return { ok: false, message: 'Petak ini sudah ditanami.' };
    if (!CROPS[seed] || !(f.seeds[seed] > 0)) return { ok: false, message: 'Bibit habis. Beli di Bu Tini, ya.' };
    f.seeds[seed]--; Object.assign(it, { crop: seed, watered: false, growth: 0 });
    return { ok: true, message: `${CROPS[seed].name} ditanam! Sekarang siram.` };
  }
  if (act === 'siram') {
    if (!it.crop) return { ok: false, message: 'Tanam bibit dulu.' };
    if (it.watered) return { ok: false, message: 'Tanah masih lembap.' };
    it.watered = true; return { ok: true, message: 'Segar! Tanaman mulai tumbuh.' };
  }
  if (act === 'panen') {
    if (!ripe(it)) return { ok: false, message: it.crop && !it.watered ? 'Tanamannya haus.' : 'Belum siap panen.' };
    const c = it.crop; f.harvest[c]++; Object.assign(it, { crop: null, watered: false, growth: 0 });
    return { ok: true, message: `${CROPS[c].emoji} Panen ${CROPS[c].name}!` };
  }
  if (act === 'tunggu') return { ok: false, message: 'Sabar, ya. Tanamannya sedang tumbuh.' };
  return { ok: false, message: 'Beli bibit dulu di Bu Tini, ya.' };
}

/* ---------------- jual beli dengan NPC (koin tidak pernah negatif) ---------------- */
export function buySeed(save, crop, qty = 1) {
  const c = CROPS[crop], n = Math.max(1, Math.floor(qty)), price = c?.seed * n;
  if (!c || (save.coins || 0) < price) return { ok: false, message: 'Koin belum cukup.' };
  save.coins -= price; save.farm.seeds[crop] += n;
  return { ok: true, message: `${n} bibit ${c.name} masuk ke tas.` };
}
export function sellHarvest(save) {
  let total = 0, count = 0;
  for (const [id, c] of Object.entries(CROPS)) { const n = save.farm.harvest[id] || 0; total += n * c.sell; count += n; save.farm.harvest[id] = 0; }
  save.coins = (save.coins || 0) + total;
  return { ok: total > 0, message: total ? `${count} hasil panen laku ${total} koin.` : 'Tas panen masih kosong.', total };
}
export function buyProduce(save, crop, qty = 1) {
  const c = CROPS[crop], n = Math.max(1, Math.floor(qty)), price = c?.buy * n;
  if (!c || (save.coins || 0) < price) return { ok: false, message: 'Koin belum cukup.' };
  save.coins -= price; save.farm.harvest[crop] += n;
  return { ok: true, message: `${n} ${c.name} dibeli seharga ${price} koin.` };
}
export const landPrice = (f) => 20 + f.lands.filter(Boolean).length * 15;
export function buyLand(save) {
  const f = save.farm, index = LAND_ORDER.find((i) => !f.lands[i]), price = landPrice(f);
  if (index == null) return { ok: false, message: 'Semua 9 tanah di kavlingmu sudah milikmu.' };
  if ((save.coins || 0) < price) return { ok: false, message: `Perlu ${price} koin untuk tanah berikutnya.` };
  save.coins -= price; f.lands[index] = true;
  return { ok: true, index, message: `Surat tanah resmi! Tanah ${index + 1} di kavlingmu siap dibangun.` };
}
// tanah dijual beserta semua barang & tanaman di atasnya (sama dengan farm_take()/farm_give() di server.py)
export function canSellLand(f, index) { return f.lands[index] ? { ok: true, index } : { ok: false, message: 'Tanah itu bukan milikmu.' }; }
export function takeLand(f, index) {
  const ox = (index % 3) * SECTOR, oz = Math.floor(index / 3) * SECTOR, moved = [];
  f.items = f.items.filter((it) => { if (sectorOf(it) !== index) return true; moved.push({ ...it, x: it.x - ox, z: it.z - oz }); return false; });
  f.lands[index] = false; return moved; // posisi relatif terhadap sudut tanah
}
export function putLand(f, items = []) {
  const index = LAND_ORDER.find((i) => !f.lands[i]); if (index == null) return -1;
  const ox = (index % 3) * SECTOR, oz = Math.floor(index / 3) * SECTOR; f.lands[index] = true;
  for (const it of items) if (ITEMS[it.k] && f.items.length < MAX_ITEMS) f.items.push({ ...it, x: it.x + ox, z: it.z + oz });
  return index;
}
export const landItems = (f, index) => f.items.filter((it) => sectorOf(it) === index).length;
