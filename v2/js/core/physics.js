// Dunia tabrakan: kotak diam (bangunan, pohon) di kisi hash 8 m + sumber balok (bangunan pemain, kisi 1 m).
// Semua tabrakan memakai kotak sejajar sumbu (AABB) supaya cepat dan stabil di tablet.
const HC = 8;

export class Physics {
  constructor() {
    this.cells = new Map();   // "cx,cz" -> [box]
    this.voxels = null;       // { boxesIn(minx,miny,minz,maxx,maxy,maxz, out) , solidAt(x,y,z) }
    this.ground = () => 0;    // tinggi tanah di (x,z); -Infinity = laut
    this.bound = null;        // (pos) => batasi posisi (pantai)
    this._q = []; this._seen = 0;
  }
  // kotak dari titik tengah + ukuran
  addBox(x, y, z, sx, sy, sz, tag = 0) {
    return this.addAABB(x - sx / 2, y - sy / 2, z - sz / 2, x + sx / 2, y + sy / 2, z + sz / 2, tag);
  }
  addAABB(minx, miny, minz, maxx, maxy, maxz, tag = 0) {
    const b = { minx, miny, minz, maxx, maxy, maxz, tag, mark: 0 };
    for (let cx = Math.floor(minx / HC); cx <= Math.floor(maxx / HC); cx++)
      for (let cz = Math.floor(minz / HC); cz <= Math.floor(maxz / HC); cz++) {
        const k = `${cx},${cz}`; let l = this.cells.get(k);
        if (!l) this.cells.set(k, (l = []));
        l.push(b);
      }
    return b;
  }
  // semua kotak yang bersinggungan dengan AABB (kotak diam + balok bangunan)
  // forRay: ikutkan kotak khusus kamera (tag 'cam', mis. daun pohon yang tidak dipijak)
  query(minx, miny, minz, maxx, maxy, maxz, out = [], forRay = false, noVox = false) {
    out.length = 0;
    const mark = ++this._seen;
    for (let cx = Math.floor(minx / HC); cx <= Math.floor(maxx / HC); cx++)
      for (let cz = Math.floor(minz / HC); cz <= Math.floor(maxz / HC); cz++) {
        const l = this.cells.get(`${cx},${cz}`); if (!l) continue;
        for (const b of l) {
          if (b.mark === mark) continue; b.mark = mark;
          if (b.tag === 'cam' && !forRay) continue;
          if (b.maxx > minx && b.minx < maxx && b.maxy > miny && b.miny < maxy && b.maxz > minz && b.minz < maxz) out.push(b);
        }
      }
    if (!noVox) this.voxels?.boxesIn(minx, miny, minz, maxx, maxy, maxz, out);
    return out;
  }
  // sinar: jarak ke benda pertama (kotak), atau maxDist. Dipakai kamera supaya tidak menembus dinding/pohon.
  ray(ox, oy, oz, dx, dy, dz, maxDist, noVox = false) {
    const ex = ox + dx * maxDist, ey = oy + dy * maxDist, ez = oz + dz * maxDist;
    const boxes = this.query(Math.min(ox, ex) - 0.3, Math.min(oy, ey) - 0.3, Math.min(oz, ez) - 0.3, Math.max(ox, ex) + 0.3, Math.max(oy, ey) + 0.3, Math.max(oz, ez) + 0.3, this._q, true, noVox);
    let best = maxDist;
    const ix = 1 / (dx || 1e-9), iy = 1 / (dy || 1e-9), iz = 1 / (dz || 1e-9);
    for (const b of boxes) {
      if (b.tag === 'soft') continue; // daun tipis, bunga: tidak menghalangi kamera
      let t1 = (b.minx - ox) * ix, t2 = (b.maxx - ox) * ix;
      let tmin = Math.min(t1, t2), tmax = Math.max(t1, t2);
      t1 = (b.miny - oy) * iy; t2 = (b.maxy - oy) * iy; tmin = Math.max(tmin, Math.min(t1, t2)); tmax = Math.min(tmax, Math.max(t1, t2));
      t1 = (b.minz - oz) * iz; t2 = (b.maxz - oz) * iz; tmin = Math.max(tmin, Math.min(t1, t2)); tmax = Math.min(tmax, Math.max(t1, t2));
      if (tmax >= Math.max(0, tmin) && tmin > 0 && tmin < best) best = tmin;
    }
    // tanah berbukit: maju selangkah demi selangkah lalu persempit (bisection)
    const above = (t) => oy + dy * t - this.ground(ox + dx * t, oz + dz * t) - 0.05;
    if (above(0) < 0) return 0;
    const step = 0.8;
    for (let t = step; t < best + step; t += step) {
      const tt = Math.min(t, best);
      if (above(tt) < 0) {
        let lo = tt - step, hi = tt;
        for (let i = 0; i < 6; i++) { const mid = (lo + hi) / 2; if (above(mid) < 0) hi = mid; else lo = mid; }
        if (lo < best) best = lo;
        break;
      }
      if (tt >= best) break;
    }
    return best;
  }
}
