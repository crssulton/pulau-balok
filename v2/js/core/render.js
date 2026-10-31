// Renderer, langit, cahaya, laut, dan pengatur kualitas otomatis.
// Prinsip performa: sedikit draw call (StaticBatch + InstancedMesh), bayangan hanya di sekitar pemain,
// resolusi turun/naik sesuai frame rate, kotak dunia yang jauh tidak digambar.
import * as THREE from '/lib/three.module.min.js';
import { clamp, damp } from './util.js';

const QKEY = 'pb2-quality';
export const QUALITY = [
  { name: 'Hemat', pr: 0.75, shadow: 0, far: 140, fog: [50, 135] },
  { name: 'Seimbang', pr: 1, shadow: 1024, far: 220, fog: [80, 210] },
  { name: 'Bagus', pr: 1.5, shadow: 2048, far: 320, fog: [110, 300] },
];

export class Render {
  constructor(canvas) {
    this.canvas = canvas;
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance', stencil: false });
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.05;
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(60, 1, 0.1, 320);
    this.chunks = [];
    this.night = 0; this.nightTarget = 0;
    this.clock = 0;
    this.buildSky();
    this.buildLights();
    this.buildWater();
    // kualitas: tersimpan per perangkat; tanpa simpanan tebak dari jumlah RAM dan jenis perangkat
    let q = null;
    try { q = localStorage.getItem(QKEY); } catch (e) { /* tanpa storage */ }
    const touch = matchMedia('(pointer: coarse)').matches;
    this.auto = q == null || q === 'auto';
    this.level = this.auto ? ((navigator.deviceMemory || 8) <= 3 ? 0 : touch ? 1 : 2) : clamp(+q, 0, 2);
    this.prScale = 1;
    this.perf = { acc: 0, n: 0, slow: 0, fast: 0, t0: performance.now() };
    this.applyQuality();
    addEventListener('resize', () => this.resize());
    this.resize();
  }

  buildSky() {
    // kubah langit gradasi (satu draw call, tanpa tekstur)
    this.skyUni = {
      top: { value: new THREE.Color('#3f9df3') }, mid: { value: new THREE.Color('#9fd8ff') }, bottom: { value: new THREE.Color('#e9f6ff') },
      sunDir: { value: new THREE.Vector3(0.45, 0.7, 0.35).normalize() }, sunCol: { value: new THREE.Color('#fff4d0') },
    };
    const sky = new THREE.Mesh(new THREE.SphereGeometry(300, 32, 16), new THREE.ShaderMaterial({
      uniforms: this.skyUni, side: THREE.BackSide, depthWrite: false, fog: false,
      vertexShader: 'varying vec3 vDir; void main(){ vDir = normalize(position); vec4 p = modelViewMatrix * vec4(position,1.); gl_Position = projectionMatrix * p; gl_Position.z = gl_Position.w; }',
      fragmentShader: `uniform vec3 top, mid, bottom, sunDir, sunCol; varying vec3 vDir;
        void main(){ float h = vDir.y; vec3 c = h > 0. ? mix(mid, top, pow(clamp(h,0.,1.), .6)) : mix(mid, bottom, clamp(-h*4.,0.,1.));
          float s = max(dot(normalize(vDir), sunDir), 0.); c += sunCol * (pow(s, 900.) * 1.6 + pow(s, 12.) * .18);
          gl_FragColor = vec4(c, 1.);
          #include <colorspace_fragment>
        }`,
    }));
    sky.frustumCulled = false; sky.renderOrder = -10;
    this.sky = sky; this.scene.add(sky);
    this.scene.fog = new THREE.Fog('#bfe4ff', 80, 210);
    // awan: gumpalan bulat dalam satu InstancedMesh
    const cloudGeo = new THREE.IcosahedronGeometry(1, 1);
    const n = 70, cloud = new THREE.InstancedMesh(cloudGeo, new THREE.MeshStandardMaterial({ color: '#ffffff', roughness: 1, emissive: '#ffffff', emissiveIntensity: 0.35, flatShading: true }), n);
    const m = new THREE.Matrix4(), q = new THREE.Quaternion(), s = new THREE.Vector3(), p = new THREE.Vector3();
    let k = 0;
    for (let c = 0; c < 14 && k < n; c++) {
      const a = (c / 14) * Math.PI * 2 + Math.sin(c * 7.1), r = 120 + (c % 4) * 30, cx = Math.cos(a) * r, cz = Math.sin(a) * r - 300, cy = 55 + (c % 3) * 9;
      for (let j = 0; j < 5 && k < n; j++, k++) {
        const sz = 6 + ((c * 5 + j * 3) % 6);
        p.set(cx + (j - 2) * 6.5, cy + (j % 2) * 2.2, cz + Math.sin(j * 3 + c) * 4); s.set(sz, sz * 0.62, sz);
        m.compose(p, q, s); cloud.setMatrixAt(k, m);
      }
    }
    cloud.count = k; cloud.frustumCulled = false;
    this.clouds = cloud; this.scene.add(cloud);
  }

  buildLights() {
    this.hemi = new THREE.HemisphereLight('#dff1ff', '#7fae5c', 1.25);
    this.sun = new THREE.DirectionalLight('#fff2d6', 2.3);
    this.sunOffset = new THREE.Vector3(30, 52, 24);
    this.sun.castShadow = true;
    const sc = this.sun.shadow.camera;
    Object.assign(sc, { left: -34, right: 34, top: 34, bottom: -34, near: 1, far: 140 });
    this.sun.shadow.bias = -0.0004; this.sun.shadow.normalBias = 0.03;
    this.scene.add(this.hemi, this.sun, this.sun.target);
  }

  buildWater() {
    // laut: satu bidang besar dengan ombak di shader (murah, tanpa tekstur)
    this.waterUni = { time: { value: 0 }, deep: { value: new THREE.Color('#1f8fd6') }, shallow: { value: new THREE.Color('#5fd3f0') }, center: { value: new THREE.Vector2(0, -400) }, radius: { value: 322 } };
    const geo = new THREE.PlaneGeometry(1800, 1800, 180, 180); geo.rotateX(-Math.PI / 2);
    const mat = new THREE.ShaderMaterial({
      uniforms: THREE.UniformsUtils.merge([THREE.UniformsLib.fog, this.waterUni]), fog: true, transparent: false,
      vertexShader: `uniform float time; varying vec3 vW; varying float vH;
        #include <fog_pars_vertex>
        void main(){ vec3 p = position; vec4 w = modelMatrix * vec4(p,1.);
          float h = sin(w.x*.18+time*1.3)*.12 + sin(w.z*.23+time*1.7)*.1 + sin((w.x+w.z)*.5+time*2.3)*.04;
          w.y += h; vH = h; vW = w.xyz; vec4 mvPosition = viewMatrix * w; gl_Position = projectionMatrix * mvPosition;
          #include <fog_vertex>
        }`,
      fragmentShader: `uniform vec3 deep, shallow; uniform vec2 center; uniform float radius, time; varying vec3 vW; varying float vH;
        #include <fog_pars_fragment>
        void main(){ float d = length(vW.xz - center) - radius; float sh = 1. - clamp(abs(d)/30., 0., 1.);
          vec3 c = mix(deep, shallow, sh*.85 + vH*.6);
          float foam = smoothstep(.7, 1., sh) * (.5 + .5*sin(d*1.4 - time*2.));
          c = mix(c, vec3(1.), foam*.55 + smoothstep(.13,.24,vH)*.25);
          gl_FragColor = vec4(c, 1.);
          #include <tonemapping_fragment>
          #include <colorspace_fragment>
          #include <fog_fragment>
        }`,
    });
    this.water = new THREE.Mesh(geo, mat);
    this.water.position.set(0, -0.55, -400);
    this.scene.add(this.water);
  }

  addChunk(mesh) { this.chunks.push(mesh); }

  setQuality(level) {
    this.auto = level === 'auto';
    if (!this.auto) this.level = clamp(level, 0, 2);
    try { localStorage.setItem(QKEY, String(level)); } catch (e) { /* tanpa storage */ }
    this.prScale = 1; this.applyQuality();
  }
  applyQuality() {
    const q = QUALITY[this.level];
    this.pixelRatio = Math.min(window.devicePixelRatio || 1, q.pr) * this.prScale;
    this.renderer.setPixelRatio(this.pixelRatio);
    this.sun.castShadow = q.shadow > 0;
    if (q.shadow && this.sun.shadow.mapSize.x !== q.shadow) {
      this.sun.shadow.mapSize.set(q.shadow, q.shadow);
      this.sun.shadow.map?.dispose(); this.sun.shadow.map = null;
    }
    this.camera.far = q.far; this.camera.updateProjectionMatrix();
    this.scene.fog.near = q.fog[0]; this.scene.fog.far = q.fog[1];
    this.drawDist = q.far * 0.8;
    this.resize();
  }
  resize() {
    const w = innerWidth, h = innerHeight;
    this.renderer.setSize(w, h, false);
    this.camera.aspect = w / h;
    this.camera.fov = w < h ? 72 : 60; // layar tegak: pandangan lebih lebar
    this.camera.updateProjectionMatrix();
  }

  // pengatur kualitas otomatis: dilihat tiap ±2 detik
  watchPerf(dt) {
    if (!this.auto || document.visibilityState !== 'visible' || dt > 0.5) return;
    if (performance.now() - this.perf.t0 < 5000) return; // shader baru dimuat: jangan dinilai
    const p = this.perf; p.acc += dt; p.n++;
    if (p.acc < 2) return;
    const ms = (p.acc / p.n) * 1000; p.acc = 0; p.n = 0;
    if (ms > 24) {
      p.fast = 0;
      if (this.prScale > 0.7) { this.prScale = Math.max(0.7, this.prScale - 0.15); this.applyQuality(); }
      else if (++p.slow >= 2 && this.level > 0) { this.level--; this.prScale = 1; p.slow = 0; this.applyQuality(); }
    } else if (ms < 15) {
      p.slow = 0;
      if (++p.fast >= 6) {
        p.fast = 0;
        if (this.prScale < 1) { this.prScale = Math.min(1, this.prScale + 0.15); this.applyQuality(); }
      }
    } else { p.slow = 0; p.fast = 0; }
  }

  setNight(on) { this.nightTarget = on ? 1 : 0; }

  update(dt, focus) {
    this.clock += dt;
    this.waterUni.time.value = this.clock;
    this.water.material.uniforms.time.value = this.clock;
    // bayangan mengikuti pemain, dikunci ke kisi texel supaya tidak berkedip saat berjalan
    if (focus) {
      const step = 68 / (this.sun.shadow.mapSize.x || 1024);
      const fx = Math.round(focus.x / step) * step, fz = Math.round(focus.z / step) * step;
      this.sun.target.position.set(fx, 0, fz);
      this.sun.position.set(fx + this.sunOffset.x, this.sunOffset.y, fz + this.sunOffset.z);
      this.sky.position.copy(this.camera.position);
      this.clouds.position.x = Math.sin(this.clock * 0.01) * 20;
    }
    // siang ⇄ malam (ikut jam dunia server)
    this.night = damp(this.night, this.nightTarget, 0.8, dt);
    const n = this.night;
    this.sun.intensity = 2.3 * (1 - n) + 0.35 * n;
    this.hemi.intensity = 1.25 * (1 - n) + 0.45 * n;
    this.hemi.color.setRGB(0.87 - 0.5 * n, 0.94 - 0.5 * n, 1, THREE.SRGBColorSpace);
    this.skyUni.top.value.setRGB(0.25 * (1 - n) + 0.03 * n, 0.62 * (1 - n) + 0.05 * n, 0.95 * (1 - n) + 0.18 * n, THREE.SRGBColorSpace);
    this.skyUni.mid.value.setRGB(0.62 * (1 - n) + 0.1 * n, 0.85 * (1 - n) + 0.14 * n, 1 * (1 - n) + 0.32 * n, THREE.SRGBColorSpace);
    this.scene.fog.color.copy(this.skyUni.mid.value);
    this.clouds.material.emissiveIntensity = 0.35 * (1 - n);
    // kotak dunia di luar jarak pandang tidak digambar
    const cp = this.camera.position, d2 = this.drawDist * this.drawDist;
    for (const m of this.chunks) {
      const s = m.geometry.boundingSphere, dx = s.center.x - cp.x, dz = s.center.z - cp.z, r = s.radius + this.drawDist;
      m.visible = dx * dx + dz * dz < r * r || d2 < 0;
    }
  }

  draw() { this.renderer.render(this.scene, this.camera); }
}
