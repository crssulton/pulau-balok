#!/usr/bin/env python3
"""Server Pulau Balok untuk WiFi rumah.

Hanya memakai pustaka bawaan Python (tanpa pip install):
- melayani file game (HTTP, dan HTTPS bila sertifikat bisa dibuat, supaya mikrofon boleh dipakai)
- WebSocket /ws untuk main bersama: posisi pemain, emotikon, ronde bersama per lokasi, sinyal suara
- SQLite (data/pulau-balok.db) sebagai sumber data tunggal: simpanan tiap pemain, skor tiap lokasi
"""
import asyncio, base64, hashlib, json, mimetypes, os, random, socket, sqlite3, ssl, struct, subprocess, sys, time

ROOT = os.path.dirname(os.path.abspath(__file__))
DATA_DIR = os.environ.get('PB_DATA_DIR') or os.path.join(ROOT, 'data')  # PB_DATA_DIR: folder data lain (mis. untuk uji), data pemain asli tetap aman
DB_PATH = os.path.join(DATA_DIR, 'pulau-balok.db')
HTTP_PORT = int(os.environ.get('PB_PORT', sys.argv[1] if len(sys.argv) > 1 else 8080))
HTTPS_PORT = int(os.environ.get('PB_HTTPS_PORT', HTTP_PORT + 363))  # 8080 -> 8443
WS_GUID = '258EAFA5-E914-47DA-95CA-C5AB0DC85B11'
MAX_MSG = 3 * 1024 * 1024
BLOCKED = ('data/', '.backup/', 'server.py', '.pem')
ROUND_TIME = {'quiz': 60, 'race': 180, 'gallery': 300}
REVEAL_TIME = 9
mimetypes.add_type('text/javascript', '.js')
mimetypes.add_type('application/manifest+json', '.json')
mimetypes.add_type('font/woff2', '.woff2')


def now_ms():
    return int(time.time() * 1000)


def name_key(name):
    return ' '.join(str(name).split()).lower()[:20]


FARM_CROPS = ('wortel', 'kentang', 'tomat', 'cabai', 'jagung', 'stroberi', 'labu', 'semangka')
# katalog Mode Bangun, sama dengan ITEMS di js/farm-state.js
FARM_ITEMS = ('petak', 'jalan', 'pagar', 'bunga', 'pohon', 'bangku', 'lampu', 'ayunan', 'kolam', 'sumur', 'gudang', 'rumah')
FARM_KAVS, SECTOR = 12, 8  # 12 kavling 24x24 m di Pulau Kebun, tiap kavling 3x3 tanah @ 8 m
LAND_ORDER = (4, 1, 3, 5, 7, 0, 2, 6, 8)  # tanah tengah dibuka dulu (LAND_ORDER di farm-state.js)
sector_of = lambda it: int(it['x']) // SECTOR + 3 * (int(it['z']) // SECTOR)


def farm_data(data):
    """Lengkapi bagian data kebun (versi 3) tanpa menghapus kemajuan pemain; versi 2 diubah seperti normalizeFarm()."""
    f = data.setdefault('farm', {})
    f.setdefault('day', 1); f.setdefault('clock', 0); f.setdefault('kav', None)
    seeds, harvest = f.setdefault('seeds', {}), f.setdefault('harvest', {})
    for crop in FARM_CROPS:
        seeds[crop] = max(0, int(seeds.get(crop) or 0)); harvest[crop] = max(0, int(harvest.get(crop) or 0))
    f['lands'] = ([bool(v) for v in f.get('lands') or []] + [False] * 9)[:9]
    inv = f.setdefault('inv', {})
    if not isinstance(f.get('items'), list):
        f['items'] = []
        for i, p in enumerate(f.get('plots') or []):
            land = i // 9
            if isinstance(p, dict) and f['lands'][land] and (p.get('tilled') or p.get('crop')):
                f['items'].append({'k': 'petak', 'x': land % 3 * SECTOR + 1 + i % 3 * 2, 'z': land // 3 * SECTOR + 1 + i % 9 // 3 * 2, 'r': 0,
                                   'crop': p.get('crop') if p.get('crop') in FARM_CROPS else None, 'watered': bool(p.get('watered')), 'growth': p.get('growth') or 0})
        for k, n in (f.get('buildings') or {}).items():
            if k in FARM_ITEMS and n:
                inv[k] = inv.get(k, 0) + 1
    f.pop('plots', None); f.pop('buildings', None); f['version'] = 3
    return f


# ---------------------------------------------------------------- SQLite
class Store:
    def __init__(self, path):
        os.makedirs(os.path.dirname(path), exist_ok=True)
        self.db = sqlite3.connect(path)
        self.db.execute('PRAGMA journal_mode=WAL')
        self.db.executescript('''
          CREATE TABLE IF NOT EXISTS players (key TEXT PRIMARY KEY, name TEXT NOT NULL, data TEXT NOT NULL, updated INTEGER NOT NULL);
          CREATE TABLE IF NOT EXISTS scores (zone TEXT NOT NULL, key TEXT NOT NULL, name TEXT NOT NULL, points INTEGER NOT NULL DEFAULT 0,
                                             PRIMARY KEY (zone, key));
          CREATE TABLE IF NOT EXISTS recent (zone TEXT PRIMARY KEY, keys TEXT NOT NULL);
          CREATE TABLE IF NOT EXISTS config (key TEXT PRIMARY KEY, value TEXT NOT NULL);
          CREATE TABLE IF NOT EXISTS farm_listings (
            id INTEGER PRIMARY KEY AUTOINCREMENT, seller_key TEXT NOT NULL, seller_name TEXT NOT NULL,
            kind TEXT NOT NULL, item TEXT NOT NULL, qty INTEGER NOT NULL, price INTEGER NOT NULL, created INTEGER NOT NULL
          );
        ''')
        if 'extra' not in [r[1] for r in self.db.execute('PRAGMA table_info(farm_listings)')]:
            self.db.execute("ALTER TABLE farm_listings ADD COLUMN extra TEXT NOT NULL DEFAULT ''")  # isi 9 petak lahan yang dijual
        self.db.commit()

    def player(self, key):
        row = self.db.execute('SELECT name, data, updated FROM players WHERE key=?', (key,)).fetchone()
        if not row:
            return None
        return {'name': row[0], 'data': json.loads(row[1]), 'updated': row[2]}

    def save_player(self, key, name, data):
        upd = int(data.get('updated') or now_ms())
        self.db.execute('INSERT INTO players(key,name,data,updated) VALUES(?,?,?,?) '
                        'ON CONFLICT(key) DO UPDATE SET name=excluded.name, data=excluded.data, updated=excluded.updated',
                        (key, name, json.dumps(data, separators=(',', ':')), upd))
        self.db.commit()

    def roster(self, limit=40):
        out = []
        for name, data, upd in self.db.execute('SELECT name, data, updated FROM players ORDER BY updated DESC LIMIT ?', (limit,)):
            try:
                d = json.loads(data)
            except ValueError:
                d = {}
            av = d.get('avatar') or {}
            out.append({'name': name, 'gender': av.get('gender', 'L'), 'shirt': av.get('shirt', 'biru'), 'role': av.get('role', ''),
                        'stars': d.get('stars', 0), 'crystals': len(d.get('crystals') or [])})
        return out

    def add_score(self, zone, key, name, pts):
        self.db.execute('INSERT INTO scores(zone,key,name,points) VALUES(?,?,?,?) '
                        'ON CONFLICT(zone,key) DO UPDATE SET points=points+excluded.points, name=excluded.name',
                        (zone, key, name, int(pts)))
        self.db.commit()

    def top(self, zone, n=3):
        return [{'name': r[0], 'points': r[1]} for r in
                self.db.execute('SELECT name, points FROM scores WHERE zone=? AND points>0 ORDER BY points DESC, name LIMIT ?', (zone, n))]

    def my_scores(self, key):
        return {z: p for z, p in self.db.execute('SELECT zone, points FROM scores WHERE key=?', (key,))}

    def all_tops(self):
        zones = [r[0] for r in self.db.execute('SELECT DISTINCT zone FROM scores')]
        return {z: self.top(z) for z in zones}

    def config(self):
        cfg = {'maxPlayers': 6, 'dayMin': 15, 'nightMin': 5, 'cycle': True, 'zombies': True, 'safeCount': 3, 'safeSec': 60, 'restSec': 30}
        for k, v in self.db.execute('SELECT key, value FROM config'):
            cfg[k] = json.loads(v)
        return cfg

    def set_config(self, key, value):
        self.db.execute('INSERT INTO config(key,value) VALUES(?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value', (key, json.dumps(value)))
        self.db.commit()

    def family(self):
        out = []
        today = time.localtime()
        today_s = f'{today.tm_year}-{today.tm_mon}-{today.tm_mday}'
        for key, name, data, upd in self.db.execute('SELECT key, name, data, updated FROM players ORDER BY updated DESC'):
            try:
                d = json.loads(data)
            except ValueError:
                continue
            t = d.get('time') or {}
            out.append({'key': key, 'name': name, 'role': (d.get('avatar') or {}).get('role', ''), 'settings': d.get('settings') or {},
                        'today': round((t.get('sec', 0) if t.get('date') == today_s else 0) / 60), 'stars': d.get('stars', 0), 'coins': d.get('coins', 0),
                        'crystals': len(d.get('crystals') or []),
                        'zones': {z: {'level': v.get('level', 1), 'rounds': v.get('rounds', 0), 'first': v.get('first', 0)} for z, v in (d.get('zones') or {}).items()}})
        return out

    def delete_player(self, key):
        self.db.execute('DELETE FROM players WHERE key=?', (key,))
        self.db.execute('DELETE FROM scores WHERE key=?', (key,))
        self.db.execute('DELETE FROM farm_listings WHERE seller_key=?', (key,))
        self.db.commit()

    def recent(self, zone):
        row = self.db.execute('SELECT keys FROM recent WHERE zone=?', (zone,)).fetchone()
        return json.loads(row[0]) if row else []

    def push_recent(self, zone, qkey, keep=12):
        keys = [k for k in self.recent(zone) if k != qkey] + [qkey]
        self.db.execute('INSERT INTO recent(zone,keys) VALUES(?,?) ON CONFLICT(zone) DO UPDATE SET keys=excluded.keys',
                        (zone, json.dumps(keys[-keep:])))
        self.db.commit()

    def farm_market(self):
        out = []
        for r in self.db.execute('SELECT id,seller_key,seller_name,kind,item,qty,price,extra FROM farm_listings ORDER BY created DESC LIMIT 80'):
            moved = json.loads(r[7]) if r[3] == 'land' and r[7] else []  # barang di atas tanah yang dijual
            out.append({'id': r[0], 'sellerKey': r[1], 'seller': r[2], 'kind': r[3], 'item': r[4], 'qty': r[5], 'price': r[6],
                        'things': len(moved), 'plants': sum(1 for it in moved if it.get('crop'))})
        return out

    def farm_players(self):
        out = []
        for key, name, data in self.db.execute('SELECT key, name, data FROM players'):
            try:
                d = json.loads(data)
            except ValueError:
                continue
            if isinstance(d.get('farm'), dict) and isinstance(d['farm'].get('kav'), int):
                out.append({'key': key, 'name': name, 'farm': farm_data(d)})
        return out

    def farm_listing(self, listing_id):
        r = self.db.execute('SELECT seller_key,seller_name,kind,item,qty,price,extra FROM farm_listings WHERE id=?', (listing_id,)).fetchone()
        return r and {'seller_key': r[0], 'seller_name': r[1], 'kind': r[2], 'item': r[3], 'qty': r[4], 'price': r[5], 'plots': json.loads(r[6]) if r[6] else None}

    def add_farm_listing(self, seller_key, seller_name, kind, item, qty, price, plots=None):
        self.db.execute('INSERT INTO farm_listings(seller_key,seller_name,kind,item,qty,price,created,extra) VALUES(?,?,?,?,?,?,?,?)',
                        (seller_key, seller_name, kind, item, qty, price, now_ms(), json.dumps(plots) if plots else ''))
        self.db.commit()

    def remove_farm_listing(self, listing_id):
        self.db.execute('DELETE FROM farm_listings WHERE id=?', (listing_id,))
        self.db.commit()


store = None

# ---------------------------------------------------------------- dunia & ruang permainan
clients = {}   # id -> Client
rooms = {}     # zone -> Room
next_id = 1


class Client:
    def __init__(self, writer, secure):
        global next_id
        self.id = next_id
        next_id += 1
        self.writer = writer
        self.secure = secure
        self.lock = asyncio.Lock()
        self.key = None
        self.name = None
        self.avatar = {}
        self.stars = 0
        self.pos = {'x': 0, 'z': 7, 'y': 0, 'f': 3.14, 'm': 0}
        self.zone = None
        self.level = 1
        self.voice = False
        self.closed = False
        self.down = False  # kehabisan nyawa (menonton)

    def pub(self):
        return {'id': self.id, 'name': self.name, 'avatar': self.avatar, 'stars': self.stars, 'pos': self.pos,
                'zone': self.zone, 'voice': self.voice, 'secure': self.secure, 'down': self.down}

    async def send(self, msg):
        if self.closed:
            return
        try:
            async with self.lock:
                self.writer.write(ws_frame(json.dumps(msg, separators=(',', ':')).encode()))
                await self.writer.drain()
        except (ConnectionError, RuntimeError, OSError):
            self.closed = True


def players():
    return [c for c in clients.values() if c.name and not c.closed]


async def broadcast(msg, skip=None, only=None):
    targets = only if only is not None else players()
    await asyncio.gather(*(c.send(msg) for c in targets if c is not skip), return_exceptions=True)


class Room:
    """Satu lokasi = satu ruang. Sesi berjalan selama masih ada pemain; kosong = sesi selesai."""
    def __init__(self, zone):
        self.zone = zone
        self.members = []  # urutan masuk
        self.seq = 0
        self.session = 0
        self.state = 'idle'  # idle (kosong) | lobby (menunggu tuan rumah menekan Mulai) | play | reveal
        self.kind = 'quiz'
        self.style = 'solo'  # solo: 1 pemain (umpan balik langsung) | shared: dibuka bersama
        self.players = []
        self.answers = {}
        self.seed = 0
        self.level = 1
        self.avoid = []
        self.timer = None
        self.started = 0

    def present(self):
        return [clients[i] for i in self.members if i in clients and not clients[i].closed]

    def round_msg(self):
        return {'t': 'round', 'zone': self.zone, 'seq': self.seq, 'session': self.session, 'seed': self.seed, 'level': self.level,
                'players': self.players, 'avoid': self.avoid, 'style': self.style, 'kind': self.kind,
                'elapsed': round(time.time() - self.started, 1)}


def task(coro):
    """Jalankan di latar; error dicatat (tidak hilang diam-diam)."""
    async def run():
        try:
            await coro
        except asyncio.CancelledError:
            pass
        except Exception:
            import traceback
            traceback.print_exc()
    return asyncio.ensure_future(run())


def cancel_timer(r):
    # jangan membatalkan diri sendiri (timer yang sedang memanggil reveal/start_round)
    if r.timer and r.timer is not asyncio.current_task():
        r.timer.cancel()
    r.timer = None


def arm_timeout(r):
    cancel_timer(r)
    seq = r.seq

    async def timeout():
        await asyncio.sleep(ROUND_TIME.get(r.kind, 60))
        if r.state == 'play' and r.seq == seq:
            await reveal(r)
    r.timer = task(timeout())


async def room_announce(r):
    await broadcast({'t': 'room', 'zone': r.zone, 'members': r.members, 'host': r.members[0] if r.members else None,
                     'state': r.state, 'seq': r.seq, 'style': r.style, 'level': r.level}, only=r.present())


async def zone_enter(c, zone, level, kind):
    await zone_leave(c)
    if not zone:
        return
    r = rooms.setdefault(zone, Room(zone))
    c.zone, c.level = zone, max(1, int(level or 1))
    r.kind = kind if kind in ROUND_TIME else r.kind
    if c.id not in r.members:
        mx = int(store.config().get('maxPlayers', 6))
        if len(r.present()) >= mx:
            c.zone = None
            return await c.send({'t': 'full', 'zone': zone, 'max': mx})
        r.members.append(c.id)
    await broadcast({'t': 'pzone', 'id': c.id, 'zone': zone}, skip=c)
    if r.state == 'idle':
        # ruang kosong sebelumnya: sesi baru, pemain pertama jadi tuan rumah dan memilih tingkat
        r.session += 1
        r.state = 'lobby'
        r.level = c.level
    await room_announce(r)
    if r.state == 'lobby':
        return
    elif r.state == 'play':
        await join_round(r, c)  # datang terlambat: ikut ronde yang sedang berjalan
    else:
        await c.send({'t': 'wait', 'zone': zone})


async def join_round(r, c):
    if c.id not in r.players:
        r.players.append(c.id)
    if r.style == 'solo' and len(r.players) >= 2:
        r.style = 'shared'
        await broadcast({'t': 'style', 'zone': r.zone, 'seq': r.seq, 'style': 'shared', 'players': r.players}, only=r.present())
        arm_timeout(r)
    await c.send(r.round_msg())
    await broadcast({'t': 'rplayers', 'zone': r.zone, 'seq': r.seq, 'players': r.players}, only=r.present(), skip=c)


async def zone_leave(c):
    if not c.zone:
        return
    r = rooms.get(c.zone)
    c.zone = None
    await broadcast({'t': 'pzone', 'id': c.id, 'zone': None}, skip=c)
    if not r:
        return
    if c.id in r.members:
        r.members.remove(c.id)
    if c.id in r.players and c.id not in r.answers:
        r.players.remove(c.id)
    if not r.present():
        # semua sudah pindah: sesi selesai (skor tiap ronde sudah tersimpan di SQLite)
        cancel_timer(r)
        r.state, r.players, r.answers = 'idle', [], {}
        return
    await room_announce(r)
    if r.state == 'play':
        await check_complete(r)


async def start_round(r):
    pres = r.present()
    cancel_timer(r)
    if not pres:
        r.state = 'idle'
        return
    r.seq += 1
    r.state = 'play'
    r.players = [c.id for c in pres]
    r.answers = {}
    r.started = time.time()
    r.seed = random.getrandbits(31)
    r.style = 'shared' if len(pres) >= 2 else 'solo'
    r.avoid = store.recent(r.zone)
    await broadcast(r.round_msg(), only=pres)
    if r.style == 'shared':
        arm_timeout(r)


async def check_complete(r):
    waiting = [i for i in r.players if i in r.members and i in clients and i not in r.answers]
    if not waiting and r.answers:
        await reveal(r)
    elif not waiting:
        await start_round(r)


async def reveal(r):
    if r.state != 'play':
        return
    r.state = 'reveal'
    cancel_timer(r)
    results = []
    for pid in r.players:
        c = clients.get(pid)
        a = r.answers.get(pid)
        name = c.name if c else '?'
        if a is None:
            results.append({'id': pid, 'name': name, 'ok': False, 'done': False, 'ms': None, 'pts': 0})
            continue
        results.append({'id': pid, 'name': name, 'ok': bool(a.get('ok')), 'done': True, 'ms': int(a.get('ms') or 0),
                        'errors': int(a.get('errors') or 0), 'img': a.get('img'), 'pts': 0})
    if r.style == 'solo':
        for x in results:
            if x['ok']:
                x['pts'] = 2 if x.get('errors', 0) == 0 else 1
    else:
        oks = sorted([x for x in results if x['ok']], key=lambda x: x['ms'])
        for x in results:
            if x['ok']:
                x['pts'] = 2 + (1 if r.kind == 'race' and x.get('errors', 0) == 0 else 0)
        if oks and r.kind != 'gallery':
            oks[0]['pts'] += 1
            oks[0]['fastest'] = True
    for x in results:
        c = clients.get(x['id'])
        if x['pts'] and c and c.key:
            store.add_score(r.zone, c.key, c.name, x['pts'])
            await c.send({'t': 'myscores', 's': store.my_scores(c.key)})
    top = store.top(r.zone)
    await broadcast({'t': 'reveal', 'zone': r.zone, 'seq': r.seq, 'kind': r.kind, 'style': r.style, 'results': results, 'top': top},
                    only=r.present())
    await broadcast({'t': 'top', 'zone': r.zone, 'top': top})
    seq = r.seq

    async def nxt():
        # ronde bersama: beri waktu melihat hasil; sendiri: pemain meminta "next" setelah pujian selesai
        await asyncio.sleep(REVEAL_TIME if r.style == 'shared' else 25)
        if r.state == 'reveal' and r.seq == seq:
            await start_round(r)
    r.timer = task(nxt())


# ---------------------------------------------------------------- siang/malam & zombie
# Jam dunia dipegang server supaya semua perangkat siang/malam bersamaan.
world = {'phase': 'day', 'start': 0, 'ends': 0, 'safe': None, 'safeEnds': 0, 'rest': 0, 'hold': False}
boss = {'isl': set(), 't': 0}  # pulau tempat Raja Zombie hidup (dari laporan tuan rumah zombie)
island_of = lambda z: 'kebun' if float(z or 0) < -200 else 'kota' if float(z or 0) > 165 else 'balok'  # sama dengan islandOf() di world.js
ZONE_IDS = ['kebun', 'warna', 'hewan', 'pola', 'bentuk', 'ikan', 'musik', 'kembar', 'ukuran', 'rasa', 'tulis', 'mtk', 'gambar', 'puzzle', 'huruf', 'angka', 'iqro']
zhost = {'id': None}


def world_msg():
    return {'t': 'world', 'phase': world['phase'], 'start': world['start'], 'ends': world['ends'], 'now': now_ms(),
            'safe': world['safe'], 'safeEnds': world['safeEnds'], 'rest': world['rest'], 'hold': world['hold'], 'cfg': store.config()}


def rotate_safe():
    """Malam: hanya beberapa tempat bermain yang aman, dipilih acak dan bergantian."""
    cfg = store.config()
    n = max(1, min(len(ZONE_IDS), int(cfg.get('safeCount', 3))))
    old = set(world['safe'] or [])
    pool = [z for z in ZONE_IDS if z not in old] if len(ZONE_IDS) - len(old) >= n else ZONE_IDS[:]
    world['safe'] = random.sample(pool, n)
    world['safeEnds'] = now_ms() + int(float(cfg.get('safeSec', 60)) * 1000)


def set_phase(phase):
    cfg = store.config()
    mins = cfg['nightMin'] if phase == 'night' else cfg['dayMin']
    world.update(phase=phase, start=now_ms(), ends=now_ms() + int(float(mins) * 60000), rest=0, hold=False)
    boss.update(isl=set(), t=0)
    if phase == 'night':
        world['safe'] = None
        rotate_safe()
    else:
        world.update(safe=None, safeEnds=0)


async def world_loop():
    set_phase('day')
    while True:
        await asyncio.sleep(1)
        cfg = store.config()
        if cfg.get('cycle', True) and now_ms() >= world['ends']:
            # pagi otomatis ditahan selama Raja Zombie masih hidup, kecuali semua pemain sudah kehabisan nyawa
            # hanya bila Raja berada di pulau yang sama dengan pemain yang masih hidup & tidak jeda
            ps = players()
            alive_isl = {island_of((c.pos or {}).get('z')) for c in ps if not c.down and (c.pos or {}).get('p') != 99}
            boss_on = bool(boss['isl'] & alive_isl) and now_ms() - boss['t'] < 6000  # laporan basi (tuan rumah hilang) tidak menahan
            if world['phase'] == 'night' and boss_on and now_ms() - world['ends'] < 300000:  # pengaman: paling lama 5 menit tambahan
                if not world['hold']:
                    world['hold'] = True
                    await broadcast(world_msg())
                continue
            set_phase('night' if world['phase'] == 'day' else 'day')
            await broadcast(world_msg())
            continue
        if world['phase'] != 'night':
            continue
        if now_ms() >= world['safeEnds']:
            rotate_safe()
            await broadcast(world_msg())
        # semua pemain kehabisan nyawa: zombie hanya berkeliaran sebentar (istirahat), lalu pagi
        ps = players()
        all_down = bool(ps) and all(c.down for c in ps)
        if all_down and not world['rest']:
            world['rest'] = now_ms() + int(float(cfg.get('restSec', 30)) * 1000)
            await broadcast(world_msg())
        elif not all_down and world['rest']:
            world['rest'] = 0
            await broadcast(world_msg())
        elif world['rest'] and now_ms() >= world['rest']:
            set_phase('day')
            await broadcast(world_msg())


async def elect_zhost():
    """Satu perangkat menjalankan simulasi zombie untuk semua (yang paling lama tersambung)."""
    # utamakan perangkat yang sedang aktif bermain (bukan jeda / layar mati, kode pose 99)
    act = sorted(c.id for c in players() if (c.pos or {}).get('p') != 99)
    ps = act or sorted(c.id for c in players())
    new = ps[0] if ps else None
    if new != zhost['id']:
        zhost['id'] = new
        await broadcast({'t': 'zhost', 'id': new})


async def send_farm_market(c, msg=None):
    listings = store.farm_market()
    await c.send({'t': 'farmMarket', 'list': [{**x, 'mine': x['sellerKey'] == c.key} for x in listings], 'msg': msg})


async def broadcast_farm_market(msg=None):
    for p in players():
        await send_farm_market(p, msg)


async def sync_farm_player(key, delta, msg=None):
    """Kirim perubahan saja (bukan salinan penuh): kemajuan kebun yang belum sempat disimpan perangkat tidak tertimpa."""
    for p in players():
        if p.key == key:
            await p.send({'t': 'farmSync', 'delta': delta, 'msg': msg})


def as_int(v, lo, hi, default):
    try:
        return max(lo, min(hi, int(v)))
    except (TypeError, ValueError, OverflowError):
        return default


# Pasar pemain: hasil panen, tanah (beserta barang & tanaman di atasnya), dan barang dari tas. Aturan sama dengan js/farm-state.js.
def farm_take(f, kind, item, qty):
    """Keluarkan barang dari kebun penjual. Hasil (delta, isi tanah) atau pesan galat."""
    if kind == 'produce':
        if item not in FARM_CROPS or f['harvest'][item] < qty:
            return 'Hasil panenmu belum cukup.'
        f['harvest'][item] -= qty
        return {'harvest': {item: -qty}}, None
    if kind == 'land':
        i = as_int(item, 0, 8, -1)
        if i < 0 or not f['lands'][i]:
            return 'Tanah itu bukan milikmu.'
        ox, oz = i % 3 * SECTOR, i // 3 * SECTOR
        moved = [{**it, 'x': int(it['x']) - ox, 'z': int(it['z']) - oz} for it in f['items'] if sector_of(it) == i]
        f['items'] = [it for it in f['items'] if sector_of(it) != i]; f['lands'][i] = False
        return {'landOut': i}, moved
    if kind in ('item', 'building'):
        if item not in FARM_ITEMS or not f['inv'].get(item):
            return 'Barang itu tidak ada di tasmu. Simpan dulu barangnya ke tas.'
        f['inv'][item] -= 1
        if not f['inv'][item]:
            del f['inv'][item]
        return {'inv': {item: -1}}, None
    return 'Barang tidak dikenal.'


def farm_give(f, kind, item, qty, moved):
    """Masukkan barang ke kebun pembeli (atau kembali ke penjual saat batal). Hasil delta atau pesan galat."""
    if kind == 'produce':
        f['harvest'][item] += qty
        return {'harvest': {item: qty}}
    if kind == 'land':
        i = next((j for j in LAND_ORDER if not f['lands'][j]), None)
        if i is None:
            return 'Semua 9 tanah di kavlingmu sudah terisi.'
        f['lands'][i] = True
        moved = [it for it in (moved or []) if isinstance(it, dict) and it.get('k') in FARM_ITEMS]
        f['items'] += [{**it, 'x': int(it['x']) + i % 3 * SECTOR, 'z': int(it['z']) + i // 3 * SECTOR} for it in moved]
        return {'landIn': moved}
    if kind in ('item', 'building'):
        f['inv'][item] = f['inv'].get(item, 0) + 1
        return {'inv': {item: 1}}
    return 'Barang tidak dikenal.'


# Kavling: server membagi satu kavling per pemain, lalu menyiarkan barang kebun supaya kebun teman terlihat.
farm_pub = {}  # key -> json barang terakhir yang disiarkan (agar simpan berkala tanpa perubahan tidak disiarkan ulang)


def farm_plot(key, name, f):
    return {'kav': f.get('kav'), 'key': key, 'name': name, 'lands': f['lands'], 'items': f['items']}


def assign_kav(key):
    rec = store.player(key); f = farm_data(rec['data'])
    used = {p['farm'].get('kav') for p in store.farm_players() if p['key'] != key}
    if isinstance(f.get('kav'), int) and 0 <= f['kav'] < FARM_KAVS and f['kav'] not in used:
        return rec, f
    free = [k for k in range(FARM_KAVS) if k not in used]
    if free:
        f['kav'] = free[0]; rec['data']['updated'] = now_ms(); store.save_player(key, rec['name'], rec['data'])
    return rec, f


async def farm_publish(key, name, f, skip=None):
    if not isinstance(f.get('kav'), int):
        return
    # pertumbuhan dibulatkan per 15 detik: simpan berkala tidak menyiarkan ulang kalau tidak ada yang terlihat berubah
    pub = json.dumps([f['lands'], [[it.get(k) for k in ('k', 'x', 'z', 'r', 'crop', 'watered')] + [int(it.get('growth') or 0) // 15] for it in f['items']]], separators=(',', ':'))
    if farm_pub.get(key) == pub:
        return
    farm_pub[key] = pub
    await broadcast({'t': 'farmPlot', 'plot': farm_plot(key, name, f)}, skip=skip)


# ---------------------------------------------------------------- pesan dari pemain
async def on_message(c, m):
    t = m.get('t')
    if t == 'login':
        name = ' '.join(str(m.get('name', '')).split())[:16]
        key = name_key(name)
        if not key:
            return await c.send({'t': 'error', 'msg': 'Nama kosong'})
        rec = store.player(key)
        if rec is None and not m.get('create'):
            return await c.send({'t': 'need_new', 'name': name})
        # satu nama = satu perangkat aktif; perangkat lama dikeluarkan agar data tidak bentrok
        for o in players():
            if o.key == key and o is not c:
                await o.send({'t': 'kicked'})
                o.closed = True
                await drop(o)
        if rec is None:
            data = m.get('data') or {}
            data['updated'] = now_ms()
            store.save_player(key, name, data)
            rec = {'name': name, 'data': data}
        else:
            local = m.get('data')
            # simpanan lokal yang lebih baru (main saat server mati) ikut dipakai
            if isinstance(local, dict) and int(local.get('updated') or 0) > int(rec['data'].get('updated') or 0):
                store.save_player(key, rec['name'], local)
                rec['data'] = local
        c.key, c.name = key, rec['name']
        c.avatar = rec['data'].get('avatar') or {}
        c.stars = rec['data'].get('stars', 0)
        await c.send({'t': 'welcome', 'id': c.id, 'name': c.name, 'data': rec['data'],
                      'players': [o.pub() for o in players() if o is not c], 'tops': store.all_tops(), 'https': HTTPS_OK and HTTPS_PORT,
                      'config': store.config(), 'myscores': store.my_scores(key)})
        await broadcast({'t': 'join', 'p': c.pub()}, skip=c)
        await c.send(world_msg())
        await elect_zhost()
        await c.send({'t': 'zhost', 'id': zhost['id']})
        return
    if t == 'names':
        return await c.send({'t': 'names', 'list': store.roster()})
    # menu orang tua boleh dibuka dari layar pilih pemain (sudah diverifikasi soal di perangkat), sebelum memilih karakter
    if not c.name and t not in ('family', 'setPlayer', 'giveCoins', 'setConfig', 'setPhase', 'zspawn', 'deletePlayer'):
        return
    if t == 'save':
        data = m.get('data')
        if isinstance(data, dict):
            if isinstance(data.get('farm'), dict):
                old = (store.player(c.key) or {}).get('data', {}).get('farm') or {}
                data['farm']['kav'] = old.get('kav') if isinstance(old.get('kav'), int) else None  # kavling dibagi server, bukan perangkat
            store.save_player(c.key, c.name, data)
            if isinstance(data.get('farm'), dict) and isinstance(data['farm'].get('kav'), int):
                await farm_publish(c.key, c.name, farm_data(data), skip=c)
            av, st = data.get('avatar') or {}, data.get('stars', 0)
            if av != c.avatar or st != c.stars:
                c.avatar, c.stars = av, st
                await broadcast({'t': 'pinfo', 'id': c.id, 'avatar': av, 'stars': st}, skip=c)
    elif t == 'farmHello':  # tiba di Pulau Kebun: pastikan punya kavling, kirim semua kebun pemain
        rec, f = assign_kav(c.key)
        await c.send({'t': 'farmWorld', 'kav': f.get('kav'), 'plots': [farm_plot(p['key'], p['name'], p['farm']) for p in store.farm_players()],
                      'msg': None if isinstance(f.get('kav'), int) else 'Semua kavling sudah terisi. Minta orang tua menghapus pemain yang tidak dipakai.'})
        await farm_publish(c.key, c.name, f, skip=c)
    elif t == 'farmMarket':
        await send_farm_market(c)
    elif t == 'farmList':
        current = m.get('data')
        if isinstance(current, dict):
            current['updated'] = now_ms(); store.save_player(c.key, c.name, current)
        rec = store.player(c.key); data = rec['data']; f = farm_data(data)
        kind, item = str(m.get('kind') or ''), str(m.get('item') or '')
        qty, price = as_int(m.get('qty'), 1, 99, 1) if kind == 'produce' else 1, as_int(m.get('price'), 1, 9999, 1)
        out = farm_take(f, kind, item, qty)
        if isinstance(out, str):
            return await send_farm_market(c, out)
        delta, plots = out
        data['updated'] = now_ms(); store.save_player(c.key, c.name, data)
        store.add_farm_listing(c.key, c.name, kind, item, qty, price, plots)
        await sync_farm_player(c.key, delta, 'Barang sudah dipasang di pasar pemain.')
        await broadcast_farm_market()
    elif t == 'farmCancel':
        listing_id = as_int(m.get('id'), 0, 2**62, 0)
        row = store.farm_listing(listing_id)
        if not row or row['seller_key'] != c.key:
            return await send_farm_market(c, 'Iklan itu bukan milikmu.')
        rec = store.player(c.key); data = rec['data']; f = farm_data(data)
        delta = farm_give(f, row['kind'], row['item'], row['qty'], row['plots'])
        if isinstance(delta, str):
            return await send_farm_market(c, delta)
        data['updated'] = now_ms(); store.save_player(c.key, c.name, data); store.remove_farm_listing(listing_id)
        await sync_farm_player(c.key, delta, 'Iklan dibatalkan dan barang dikembalikan.')
        await broadcast_farm_market()
    elif t == 'farmBuy':
        listing_id = as_int(m.get('id'), 0, 2**62, 0)
        row = store.farm_listing(listing_id)
        if not row:
            return await send_farm_market(c, 'Barang itu baru saja terjual.')
        seller_key, price = row['seller_key'], row['price']
        if seller_key == c.key:
            return await send_farm_market(c, 'Gunakan tombol Batalkan untuk barangmu sendiri.')
        buyer, seller = store.player(c.key), store.player(seller_key)
        if not buyer or not seller or int(buyer['data'].get('coins') or 0) < price:
            return await send_farm_market(c, 'Koinmu belum cukup.')
        delta = farm_give(farm_data(buyer['data']), row['kind'], row['item'], row['qty'], row['plots'])
        if isinstance(delta, str):
            return await send_farm_market(c, delta)
        delta['coins'] = -price
        buyer['data']['coins'] = int(buyer['data'].get('coins') or 0) - price
        seller['data']['coins'] = int(seller['data'].get('coins') or 0) + price
        buyer['data']['updated'] = seller['data']['updated'] = now_ms()
        store.save_player(c.key, buyer['name'], buyer['data']); store.save_player(seller_key, seller['name'], seller['data']); store.remove_farm_listing(listing_id)
        await sync_farm_player(c.key, delta, f"Berhasil membeli dari {row['seller_name']}.")
        await sync_farm_player(seller_key, {'coins': price}, f'Barangmu terjual {price} koin!')
        await broadcast_farm_market()
    elif t == 'move':
        was_paused = (c.pos or {}).get('p') == 99
        c.pos = {k: m.get(k, 0) for k in ('x', 'z', 'y', 'f', 'm', 'p', 'pc', 'fm')}  # fm: gerakan bela diri terakhir  # p: 1 terjun, 2 sayap, 3 berenang, 4-9 kendaraan; pc: ada penumpang
        for k in ('rd', 'tk'):  # rd: menumpang pengemudi "id:kursi:jenis"; tk: token wahana kota (posisi dihitung di tiap perangkat)
            if m.get(k) is not None and len(json.dumps(m[k])) < 300:
                c.pos[k] = m[k]
        await broadcast({'t': 'move', 'id': c.id, **c.pos}, skip=c)
        if was_paused != (c.pos.get('p') == 99):  # mulai/berhenti jeda: tuan rumah zombie dipilih ulang
            await elect_zhost()
    elif t == 'poke':  # pukulan main-main antarpemain (nyawa tidak berkurang): semua melihat efeknya
        to = m.get('to')
        if to in clients:
            await broadcast({'t': 'poke', 'from': c.id, 'to': to, 'dx': m.get('dx', 0), 'dz': m.get('dz', 0)}, skip=c)
    elif t in ('ride', 'rideOk', 'rideNo', 'rideOff', 'rideEnd'):  # penumpang kendaraan (maks. 2 orang)
        o = clients.get(m.get('to'))
        if o:
            await o.send({**m, 'from': c.id})
    elif t == 'summit':  # pemain sampai di puncak Menara Langit
        await broadcast({'t': 'summit', 'id': c.id, 'name': c.name}, skip=c)
    elif t == 'emote':
        await broadcast({'t': 'emote', 'id': c.id, 'e': str(m.get('e', ''))[:8]}, skip=c)
    elif t == 'greet':
        o = clients.get(m.get('to'))
        if o:
            await o.send({'t': 'greet', 'from': c.id})
    elif t == 'zone':
        await zone_enter(c, m.get('zone'), m.get('level'), m.get('kind'))
    elif t == 'answer':
        r = rooms.get(m.get('zone'))
        if r and r.state == 'play' and m.get('seq') == r.seq and c.id in r.players and c.id not in r.answers:
            img = m.get('img')
            r.answers[c.id] = {'ok': m.get('ok'), 'ms': m.get('ms'), 'errors': m.get('errors'),
                               'img': img if isinstance(img, str) and len(img) < 400000 else None}
            await broadcast({'t': 'answered', 'zone': r.zone, 'id': c.id}, only=r.present())
            await check_complete(r)
    elif t == 'start':
        r = rooms.get(m.get('zone'))
        if r and r.state == 'lobby' and r.members and r.members[0] == c.id:
            r.level = max(1, min(6, int(m.get('level') or 1)))
            await start_round(r)
    elif t == 'next':
        r = rooms.get(m.get('zone'))
        if r and c.id in r.members:
            if r.state == 'idle' or (r.state == 'reveal' and r.style == 'solo'):
                await start_round(r)
            elif r.state == 'play' and c.id not in r.players:
                await join_round(r, c)
            elif r.state == 'play':
                await c.send(r.round_msg())
    elif t == 'qkey':
        if m.get('zone') and m.get('key'):
            store.push_recent(str(m['zone']), str(m['key'])[:60])
    elif t == 'family':
        await c.send({'t': 'family', 'players': store.family(), 'config': store.config()})
    elif t == 'setPlayer':
        key = name_key(m.get('name', ''))
        rec = store.player(key)
        if rec:
            st = rec['data'].setdefault('settings', {})
            for k in ('level', 'limit'):
                if k in (m.get('settings') or {}):
                    st[k] = int(m['settings'][k])
            rec['data']['updated'] = now_ms()
            store.save_player(key, rec['name'], rec['data'])
            for o in players():
                if o.key == key:
                    await o.send({'t': 'psettings', 'settings': st})
        await c.send({'t': 'family', 'players': store.family(), 'config': store.config()})
    elif t == 'giveCoins':  # orang tua memberi koin; online: dikirim ke perangkatnya (yang menyimpan), offline: ditambahkan di data server
        key, n = name_key(m.get('name', '')), int(m.get('n') or 0)
        rec = store.player(key)
        if rec and 0 < n <= 500:
            on = [o for o in players() if o.key == key]
            if on:
                await on[0].send({'t': 'gift', 'n': n})
            else:
                rec['data']['coins'] = int(rec['data'].get('coins') or 0) + n
                rec['data']['updated'] = now_ms()
                store.save_player(key, rec['name'], rec['data'])
        await c.send({'t': 'family', 'players': store.family(), 'config': store.config()})
    elif t == 'setConfig':
        cfg = m.get('config') or {}
        if 'maxPlayers' in cfg:
            store.set_config('maxPlayers', max(1, min(12, int(cfg['maxPlayers']))))
        for k, lo, hi in (('dayMin', 1, 120), ('nightMin', 1, 60)):
            if k in cfg:
                store.set_config(k, max(lo, min(hi, float(cfg[k]))))
        for k, lo, hi in (('safeCount', 1, 17), ('safeSec', 10, 600), ('restSec', 5, 300)):
            if k in cfg:
                store.set_config(k, max(lo, min(hi, float(cfg[k]))))
        for k in ('cycle', 'zombies'):
            if k in cfg:
                store.set_config(k, bool(cfg[k]))
        if 'dayMin' in cfg or 'nightMin' in cfg:  # durasi baru berlaku dari fase sekarang
            mins = store.config()['nightMin' if world['phase'] == 'night' else 'dayMin']
            world['ends'] = world['start'] + int(float(mins) * 60000)
        await broadcast({'t': 'config', 'config': store.config()})
        await broadcast(world_msg())
    elif t == 'deletePlayer':
        key = name_key(m.get('name', ''))
        if key and not any(o.key == key for o in players()):
            store.delete_player(key)
        await c.send({'t': 'family', 'players': store.family(), 'config': store.config()})
        await c.send({'t': 'names', 'list': store.roster()})
    elif t == 'alive':  # pemain kehabisan nyawa / hidup lagi
        c.down = bool(m.get('down'))
        await broadcast({'t': 'pdown', 'id': c.id, 'down': c.down}, skip=c)
    elif t == 'setPhase':  # orang tua (sudah diverifikasi di perangkatnya)
        if m.get('phase') in ('day', 'night'):
            set_phase(m['phase'])
            await broadcast(world_msg())
            if not c.name:  # dari layar pilih pemain: perangkat ini belum termasuk pemain, kirim langsung
                await c.send(world_msg())
            await broadcast({'t': 'notice', 'msg': f"{c.name or 'Orang tua'} mengubah waktu menjadi {'malam' if m['phase'] == 'night' else 'siang'}!"})
    elif t == 'zspawn':  # orang tua menambah zombie: diteruskan ke tuan rumah zombie
        h = clients.get(zhost['id'])
        if h and world['phase'] == 'night':  # siang tidak ada zombie
            await h.send({'t': 'zspawn', 'n': max(1, min(200, int(m.get('n') or 5)))})
            await broadcast({'t': 'notice', 'msg': f"{c.name or 'Orang tua'} menambah zombie! Siap-siap!"})
    elif t in ('zstate', 'zdead', 'zspit', 'zslam', 'zfx'):  # dari tuan rumah zombie ke semua (posisi, kalah, ludah, hentakan)
        if c.id == zhost['id'] and t == 'zstate' and world['phase'] == 'night':
            boss.update(isl={island_of(e[3]) for e in (m.get('list') or []) if isinstance(e, list) and len(e) > 3 and e[1] == 5}, t=now_ms())
        if c.id == zhost['id'] and (t != 'zstate' or world['phase'] == 'night'):  # siang: posisi zombie tidak diteruskan lagi
            await broadcast({**m, 'from': c.id}, skip=c)
    elif t == 'zhit':  # pukulan/tembakan pemain diteruskan ke tuan rumah zombie
        h = clients.get(zhost['id'])
        if h and h is not c:
            await h.send({**m, 'by': c.id})
    elif t == 'zhurt':  # tuan rumah: zombie mengenai pemain
        o = clients.get(m.get('to'))
        if o and c.id == zhost['id']:
            await o.send({'t': 'zhurt', 'zid': m.get('zid')})
    elif t == 'shot':  # tembakan (efek visual saja) untuk dilihat pemain lain
        await broadcast({**m, 'from': c.id}, skip=c)
    elif t == 'voice':
        c.voice = bool(m.get('on'))
        await broadcast({'t': 'voice', 'id': c.id, 'on': c.voice}, skip=c)
    elif t == 'rtc':
        o = clients.get(m.get('to'))
        if o:
            await o.send({'t': 'rtc', 'from': c.id, 'data': m.get('data')})


async def drop(c):
    if clients.get(c.id) is not c:
        return
    del clients[c.id]
    if c.name:
        await zone_leave(c)
        await broadcast({'t': 'leave', 'id': c.id})
        await elect_zhost()
    try:
        c.writer.close()
    except Exception:
        pass


# ---------------------------------------------------------------- WebSocket
def ws_frame(payload, opcode=1):
    n = len(payload)
    head = bytes([0x80 | opcode])
    if n < 126:
        head += bytes([n])
    elif n < 65536:
        head += bytes([126]) + struct.pack('!H', n)
    else:
        head += bytes([127]) + struct.pack('!Q', n)
    return head + payload


async def ws_read(reader):
    """Mengembalikan (opcode, data) untuk satu pesan utuh (menggabungkan potongan)."""
    buf, first_op = b'', None
    while True:
        b1, b2 = await reader.readexactly(2)
        fin, op = b1 & 0x80, b1 & 0x0F
        ln = b2 & 0x7F
        if ln == 126:
            ln = struct.unpack('!H', await reader.readexactly(2))[0]
        elif ln == 127:
            ln = struct.unpack('!Q', await reader.readexactly(8))[0]
        if ln > MAX_MSG:
            raise ValueError('pesan terlalu besar')
        mask = await reader.readexactly(4) if b2 & 0x80 else b'\0\0\0\0'
        data = bytearray(await reader.readexactly(ln))
        for i in range(ln):
            data[i] ^= mask[i % 4]
        if op >= 8:  # kontrol: close/ping/pong
            return op, bytes(data)
        if first_op is None:
            first_op = op
        buf += data
        if len(buf) > MAX_MSG:
            raise ValueError('pesan terlalu besar')
        if fin:
            return first_op, buf


async def ws_session(reader, writer, headers, secure):
    key = headers.get('sec-websocket-key', '')
    accept = base64.b64encode(hashlib.sha1((key + WS_GUID).encode()).digest()).decode()
    writer.write(('HTTP/1.1 101 Switching Protocols\r\nUpgrade: websocket\r\nConnection: Upgrade\r\n'
                  f'Sec-WebSocket-Accept: {accept}\r\n\r\n').encode())
    await writer.drain()
    c = Client(writer, secure)
    clients[c.id] = c
    await c.send({'t': 'hello', 'id': c.id})
    try:
        while not c.closed:
            op, data = await ws_read(reader)
            if op == 8:
                break
            if op == 9:
                async with c.lock:
                    writer.write(ws_frame(data, 10))
                continue
            if op != 1:
                continue
            try:
                m = json.loads(data.decode('utf-8'))
            except ValueError:
                continue
            if isinstance(m, dict):
                try:
                    await on_message(c, m)
                except Exception:
                    import traceback
                    traceback.print_exc()
    except (asyncio.IncompleteReadError, ConnectionError, ValueError, OSError):
        pass
    finally:
        c.closed = True
        await drop(c)


# ---------------------------------------------------------------- HTTP statis
async def http_handler(reader, writer, secure=False):
    try:
        head = await asyncio.wait_for(reader.readuntil(b'\r\n\r\n'), 20)
    except (asyncio.TimeoutError, asyncio.IncompleteReadError, asyncio.LimitOverrunError, ConnectionError, OSError):
        writer.close()
        return
    lines = head.decode('latin-1').split('\r\n')
    try:
        method, target, _ = lines[0].split(' ', 2)
    except ValueError:
        writer.close()
        return
    headers = {}
    for ln in lines[1:]:
        if ':' in ln:
            k, v = ln.split(':', 1)
            headers[k.strip().lower()] = v.strip()
    path = target.split('?', 1)[0]
    if path == '/ws' and headers.get('upgrade', '').lower() == 'websocket':
        await ws_session(reader, writer, headers, secure)
        return
    try:
        await serve_file(writer, method, path)
    except (ConnectionError, OSError):
        pass
    finally:
        try:
            writer.close()
        except Exception:
            pass


async def serve_file(writer, method, path):
    from urllib.parse import unquote
    if method not in ('GET', 'HEAD'):
        return await respond(writer, 405, b'Method Not Allowed', 'text/plain')
    if path == '/info':
        info = {'http': HTTP_PORT, 'https': HTTPS_PORT if HTTPS_OK else None, 'ips': local_ips()}
        return await respond(writer, 200, json.dumps(info).encode(), 'application/json')
    rel = unquote(path).lstrip('/') or 'index.html'
    full = os.path.realpath(os.path.join(ROOT, rel))
    if not full.startswith(ROOT + os.sep) or any(b in rel for b in BLOCKED) or rel.startswith('.'):
        return await respond(writer, 404, b'Not Found', 'text/plain')
    if os.path.isdir(full):
        full = os.path.join(full, 'index.html')
    if not os.path.isfile(full):
        return await respond(writer, 404, b'Not Found', 'text/plain')
    ctype = mimetypes.guess_type(full)[0] or 'application/octet-stream'
    with open(full, 'rb') as f:
        body = f.read()
    await respond(writer, 200, body if method == 'GET' else b'', ctype, len(body))


async def respond(writer, code, body, ctype, length=None):
    reason = {200: 'OK', 404: 'Not Found', 405: 'Method Not Allowed'}.get(code, 'OK')
    hdr = (f'HTTP/1.1 {code} {reason}\r\nContent-Type: {ctype}\r\nContent-Length: {length if length is not None else len(body)}\r\n'
           'Cache-Control: no-cache\r\nConnection: close\r\n\r\n')
    writer.write(hdr.encode() + body)
    await writer.drain()


# ---------------------------------------------------------------- jaringan & sertifikat
def local_ips():
    ips = set()
    try:
        s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
        s.connect(('10.255.255.255', 1))
        ips.add(s.getsockname()[0])
        s.close()
    except OSError:
        pass
    try:
        for info in socket.getaddrinfo(socket.gethostname(), None, socket.AF_INET):
            ips.add(info[4][0])
    except OSError:
        pass
    return sorted(i for i in ips if not i.startswith('127.'))


def make_cert():
    """Sertifikat buatan sendiri agar halaman bisa dibuka lewat https (wajib untuk mikrofon)."""
    cert, key = os.path.join(DATA_DIR, 'cert.pem'), os.path.join(DATA_DIR, 'key.pem')
    if os.path.exists(cert) and os.path.exists(key):
        return cert, key
    os.makedirs(DATA_DIR, exist_ok=True)
    san = ','.join(['DNS:localhost', 'IP:127.0.0.1'] + [f'IP:{i}' for i in local_ips()])
    try:
        subprocess.run(['openssl', 'req', '-x509', '-newkey', 'rsa:2048', '-nodes', '-keyout', key, '-out', cert,
                        '-days', '3650', '-subj', '/CN=Pulau Balok', '-addext', f'subjectAltName={san}'],
                       check=True, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    except (OSError, subprocess.CalledProcessError):
        try:  # LibreSSL lama tidak kenal -addext
            subprocess.run(['openssl', 'req', '-x509', '-newkey', 'rsa:2048', '-nodes', '-keyout', key, '-out', cert,
                            '-days', '3650', '-subj', '/CN=Pulau Balok'], check=True, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
        except (OSError, subprocess.CalledProcessError):
            return None
    return cert, key


HTTPS_OK = False


async def main():
    global store, HTTPS_OK
    store = Store(DB_PATH)
    servers = [await asyncio.start_server(lambda r, w: http_handler(r, w, False), '0.0.0.0', HTTP_PORT, limit=65536)]
    pair = make_cert()
    if pair:
        try:
            ctx = ssl.SSLContext(ssl.PROTOCOL_TLS_SERVER)
            ctx.load_cert_chain(*pair)
            servers.append(await asyncio.start_server(lambda r, w: http_handler(r, w, True), '0.0.0.0', HTTPS_PORT, ssl=ctx, limit=65536))
            HTTPS_OK = True
        except (OSError, ssl.SSLError) as e:
            print(f'  (HTTPS tidak aktif: {e})')
    ips = local_ips() or ['localhost']
    print('\n  ===============================================')
    print('     PULAU BALOK sudah berjalan')
    print('  ===============================================\n')
    print('  Buka di HP / tablet / laptop (WiFi yang sama):\n')
    for ip in ips:
        print(f'        http://{ip}:{HTTP_PORT}')
    if HTTPS_OK:
        print('\n  Untuk OBROLAN SUARA (mikrofon), pakai alamat https:')
        for ip in ips:
            print(f'        https://{ip}:{HTTPS_PORT}')
        print('  (Akan muncul peringatan keamanan sekali. Pilih "Lanjutkan" / "Kunjungi situs ini".)')
    print(f'\n  Data pemain tersimpan di: {DB_PATH}')
    print('  Biarkan jendela ini terbuka selama anak bermain. Tekan Control+C untuk berhenti.\n')
    sys.stdout.flush()
    asyncio.ensure_future(world_loop())
    await asyncio.gather(*(s.serve_forever() for s in servers))


if __name__ == '__main__':
    try:
        asyncio.run(main())
    except KeyboardInterrupt:
        pass
