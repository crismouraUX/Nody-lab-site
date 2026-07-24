/* ==========================================================================
   NODY/LAB — 3D node-network hero engine
   Concept: scattered chaos particles ASSEMBLE into an ordered node-system
   as the user scrolls — chaos → sistema. One engine, per-page shapes.
   ========================================================================== */
import * as THREE from 'three';

const VOLT = new THREE.Color('#CCFF00');
const WHITE = new THREE.Color('#F2F2EC');
const DEEP = new THREE.Color('#9EC800');

const REDUCED = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const IS_MOBILE = window.matchMedia('(max-width: 768px)').matches;

/* ---------- shape generators (unit-ish scale, centered) ---------- */

function fibonacciSphere(n, r) {
  const pts = new Float32Array(n * 3);
  const phi = Math.PI * (3 - Math.sqrt(5));
  for (let i = 0; i < n; i++) {
    const y = 1 - (i / (n - 1)) * 2;
    const rad = Math.sqrt(1 - y * y);
    const t = phi * i;
    pts[i * 3] = Math.cos(t) * rad * r;
    pts[i * 3 + 1] = y * r;
    pts[i * 3 + 2] = Math.sin(t) * rad * r;
  }
  return pts;
}

/* home — neural core: sphere shell + inner cluster */
function shapeCore(n) {
  const pts = new Float32Array(n * 3);
  const shell = fibonacciSphere(Math.floor(n * 0.72), 1.55);
  pts.set(shell, 0);
  let o = shell.length;
  const inner = fibonacciSphere(n - Math.floor(n * 0.72), 0.85);
  for (let i = 0; i < inner.length; i += 3) {
    pts[o + i] = inner[i] * (0.4 + Math.random() * 0.6);
    pts[o + i + 1] = inner[i + 1] * (0.4 + Math.random() * 0.6);
    pts[o + i + 2] = inner[i + 2] * (0.4 + Math.random() * 0.6);
  }
  return pts;
}

/* solutions — orbital system: 3 tilted rings + nucleus */
function shapeOrbits(n) {
  const pts = new Float32Array(n * 3);
  const rings = [
    { r: 1.7, tilt: 0.45, roll: 0.0 },
    { r: 1.35, tilt: -0.9, roll: 0.9 },
    { r: 1.0, tilt: 1.5, roll: -0.5 },
  ];
  const perRing = Math.floor((n * 0.82) / rings.length);
  let idx = 0;
  for (const { r, tilt, roll } of rings) {
    for (let i = 0; i < perRing; i++, idx++) {
      const a = (i / perRing) * Math.PI * 2;
      const v = new THREE.Vector3(Math.cos(a) * r, Math.sin(a) * r * 0.28, Math.sin(a) * r);
      v.applyAxisAngle(new THREE.Vector3(1, 0, 0), tilt);
      v.applyAxisAngle(new THREE.Vector3(0, 0, 1), roll);
      pts[idx * 3] = v.x; pts[idx * 3 + 1] = v.y; pts[idx * 3 + 2] = v.z;
    }
  }
  const rest = fibonacciSphere(n - idx, 0.55);
  pts.set(rest, idx * 3);
  return pts;
}

/* medical — pulse: concentric horizontal rings, like a vital signal radiating */
function shapePulse(n) {
  const pts = new Float32Array(n * 3);
  const rings = 6;
  let idx = 0;
  for (let ri = 0; ri < rings; ri++) {
    const r = 0.35 + (ri / (rings - 1)) * 1.65;
    const count = Math.floor(n * (r / 7.2));
    for (let i = 0; i < count && idx < n; i++, idx++) {
      const a = (i / count) * Math.PI * 2;
      const wob = Math.sin(a * 6 + ri) * 0.06;
      pts[idx * 3] = Math.cos(a) * r;
      pts[idx * 3 + 1] = (ri - rings / 2) * 0.13 + wob;
      pts[idx * 3 + 2] = Math.sin(a) * r;
    }
  }
  while (idx < n) {
    const s = fibonacciSphere(1, 0.25);
    pts[idx * 3] = s[0]; pts[idx * 3 + 1] = s[1] + (Math.random() - 0.5); pts[idx * 3 + 2] = s[2];
    idx++;
  }
  return pts;
}

/* dental — arch: a dome / dental-arch lattice */
function shapeArch(n) {
  const pts = new Float32Array(n * 3);
  let idx = 0;
  const rows = 9;
  for (let ri = 0; ri < rows && idx < n; ri++) {
    const t = ri / (rows - 1);            // 0 top → 1 rim
    const y = Math.cos(t * Math.PI * 0.5) * 1.15 - 0.35;
    const r = Math.sin(t * Math.PI * 0.5) * 1.75;
    const count = Math.max(6, Math.floor((n / rows) * (0.35 + t)));
    for (let i = 0; i < count && idx < n; i++, idx++) {
      const a = (i / count) * Math.PI * 2;
      pts[idx * 3] = Math.cos(a) * r;
      pts[idx * 3 + 1] = y;
      pts[idx * 3 + 2] = Math.sin(a) * r;
    }
  }
  return pts;
}

/* legal — equilibrium: two balanced node clusters + connecting beam */
function shapeScales(n) {
  const pts = new Float32Array(n * 3);
  const clusterN = Math.floor(n * 0.38);
  const beamN = n - clusterN * 2;
  let idx = 0;
  for (const sx of [-1.15, 1.15]) {
    const c = fibonacciSphere(clusterN, 0.72);
    for (let i = 0; i < clusterN; i++, idx++) {
      pts[idx * 3] = c[i * 3] + sx;
      pts[idx * 3 + 1] = c[i * 3 + 1] - 0.42;
      pts[idx * 3 + 2] = c[i * 3 + 2];
    }
  }
  for (let i = 0; i < beamN; i++, idx++) {
    const t = i / (beamN - 1);
    const x = (t - 0.5) * 3.2;
    pts[idx * 3] = x;
    pts[idx * 3 + 1] = 1.05 - Math.abs(x) * 0.12 + (Math.random() - 0.5) * 0.05;
    pts[idx * 3 + 2] = (Math.random() - 0.5) * 0.14;
  }
  return pts;
}

/* automation — circuit: cubic lattice grid */
function shapeGrid(n) {
  const pts = new Float32Array(n * 3);
  const side = Math.ceil(Math.cbrt(n));
  const step = 2.5 / (side - 1);
  let idx = 0;
  for (let x = 0; x < side && idx < n; x++)
    for (let y = 0; y < side && idx < n; y++)
      for (let z = 0; z < side && idx < n; z++, idx++) {
        pts[idx * 3] = x * step - 1.25;
        pts[idx * 3 + 1] = y * step - 1.25;
        pts[idx * 3 + 2] = z * step - 1.25;
      }
  return pts;
}

/* second brain — organic dense noisy blob, two lobes */
function shapeBrain(n) {
  const pts = new Float32Array(n * 3);
  const base = fibonacciSphere(n, 1.35);
  for (let i = 0; i < n; i++) {
    let x = base[i * 3], y = base[i * 3 + 1], z = base[i * 3 + 2];
    const noise =
      Math.sin(x * 4.1 + y * 2.3) * 0.11 +
      Math.sin(y * 5.7 + z * 3.1) * 0.09 +
      Math.sin(z * 4.9 + x * 2.7) * 0.1;
    const s = 1 + noise;
    x *= s * 1.18; y *= s * 0.92; z *= s;
    x += Math.sign(x) * 0.16; // split into two lobes
    pts[i * 3] = x; pts[i * 3 + 1] = y; pts[i * 3 + 2] = z;
  }
  return pts;
}

const SHAPES = {
  core: shapeCore,
  orbits: shapeOrbits,
  pulse: shapePulse,
  arch: shapeArch,
  scales: shapeScales,
  grid: shapeGrid,
  brain: shapeBrain,
};

/* ---------- neighbor edges on the target shape ---------- */
function buildEdges(target, count, maxDist, maxEdges) {
  const pairs = [];
  const stride = Math.max(1, Math.floor(count / 700));
  const maxDistSq = maxDist * maxDist;
  outer:
  for (let i = 0; i < count; i += stride) {
    let added = 0;
    for (let j = i + 1; j < count && added < 2; j += stride) {
      const dx = target[i * 3] - target[j * 3];
      const dy = target[i * 3 + 1] - target[j * 3 + 1];
      const dz = target[i * 3 + 2] - target[j * 3 + 2];
      if (dx * dx + dy * dy + dz * dz < maxDistSq) {
        pairs.push(i, j);
        added++;
        if (pairs.length / 2 >= maxEdges) break outer;
      }
    }
  }
  return pairs;
}

/* ---------- easing ---------- */
const easeOutCubic = (t) => 1 - Math.pow(1 - t, 3);
const clamp01 = (v) => Math.min(1, Math.max(0, v));

/* ---------- engine ---------- */
function mount(canvas) {
  const shapeName = canvas.dataset.shape || 'core';
  const runway = canvas.closest('[data-hero]') || document.body;
  const COUNT = IS_MOBILE ? 850 : 1500;

  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));

  const scene = new THREE.Scene();
  scene.fog = new THREE.FogExp2(0x0a0a0a, 0.075);

  const camera = new THREE.PerspectiveCamera(50, 1, 0.1, 60);
  camera.position.set(0, 0.1, 7.4);

  const group = new THREE.Group();
  scene.add(group);

  /* target + chaos position sets */
  const target = SHAPES[shapeName](COUNT);
  const chaos = new Float32Array(COUNT * 3);
  const delays = new Float32Array(COUNT);
  for (let i = 0; i < COUNT; i++) {
    const r = 5.5 + Math.random() * 6;
    const th = Math.random() * Math.PI * 2;
    const ph = Math.acos(2 * Math.random() - 1);
    chaos[i * 3] = r * Math.sin(ph) * Math.cos(th);
    chaos[i * 3 + 1] = r * Math.sin(ph) * Math.sin(th) * 0.7;
    chaos[i * 3 + 2] = r * Math.cos(ph) - 2;
    delays[i] = Math.random() * 0.55;
  }

  /* points */
  const posAttr = new THREE.BufferAttribute(new Float32Array(chaos), 3);
  const colors = new Float32Array(COUNT * 3);
  const tmpC = new THREE.Color();
  for (let i = 0; i < COUNT; i++) {
    const roll = Math.random();
    tmpC.copy(roll < 0.8 ? VOLT : roll < 0.94 ? WHITE : DEEP);
    colors[i * 3] = tmpC.r; colors[i * 3 + 1] = tmpC.g; colors[i * 3 + 2] = tmpC.b;
  }
  const pGeo = new THREE.BufferGeometry();
  pGeo.setAttribute('position', posAttr);
  pGeo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  const pMat = new THREE.PointsMaterial({
    size: IS_MOBILE ? 0.045 : 0.036,
    vertexColors: true,
    transparent: true,
    opacity: 0.95,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    sizeAttenuation: true,
  });
  group.add(new THREE.Points(pGeo, pMat));

  /* edges (assemble with progress) */
  const pairs = buildEdges(target, COUNT, shapeName === 'grid' ? 0.62 : 0.55, 620);
  const lPos = new Float32Array(pairs.length * 3);
  const lGeo = new THREE.BufferGeometry();
  const lAttr = new THREE.BufferAttribute(lPos, 3);
  lGeo.setAttribute('position', lAttr);
  const lMat = new THREE.LineBasicMaterial({
    color: VOLT, transparent: true, opacity: 0,
    blending: THREE.AdditiveBlending, depthWrite: false,
  });
  group.add(new THREE.LineSegments(lGeo, lMat));

  /* inner wireframe core */
  const coreMesh = new THREE.Mesh(
    new THREE.IcosahedronGeometry(0.42, 1),
    new THREE.MeshBasicMaterial({ color: VOLT, wireframe: true, transparent: true, opacity: 0 })
  );
  group.add(coreMesh);

  /* scan ring — sweeps the object into existence */
  const ring = new THREE.Mesh(
    new THREE.TorusGeometry(2.05, 0.006, 8, 90),
    new THREE.MeshBasicMaterial({ color: VOLT, transparent: true, opacity: 0 })
  );
  ring.rotation.x = Math.PI / 2;
  scene.add(ring);

  /* state */
  let u = REDUCED ? 1 : 0;          // assembly progress
  let uSmooth = u;
  let mouseX = 0, mouseY = 0;
  let visible = true;
  const clock = new THREE.Clock();

  window.addEventListener('pointermove', (e) => {
    mouseX = (e.clientX / window.innerWidth) * 2 - 1;
    mouseY = (e.clientY / window.innerHeight) * 2 - 1;
  }, { passive: true });

  /* progress from the hero runway (works natively with Lenis) */
  function readProgress() {
    if (REDUCED) { u = 1; return; }
    const rect = runway.getBoundingClientRect();
    const total = rect.height - window.innerHeight;
    u = total > 4 ? clamp01(-rect.top / total) : 1;
  }

  function resize() {
    const w = canvas.clientWidth || canvas.parentElement.clientWidth;
    const h = canvas.clientHeight || canvas.parentElement.clientHeight;
    if (!w || !h) return;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
  }
  resize();
  new ResizeObserver(resize).observe(canvas.parentElement);

  document.addEventListener('visibilitychange', () => { visible = !document.hidden; });
  const io = new IntersectionObserver(([e]) => { visible = e.isIntersecting && !document.hidden; }, { rootMargin: '80px' });
  io.observe(canvas);

  const arr = posAttr.array;

  renderer.setAnimationLoop(() => {
    if (!visible) return;
    const t = clock.getElapsedTime();
    readProgress();
    uSmooth += (u - uSmooth) * 0.07;
    const ue = easeOutCubic(uSmooth);

    /* per-point staggered assembly + organic breathing */
    for (let i = 0; i < COUNT; i++) {
      const local = clamp01((ue - delays[i] * 0.5) / (1 - delays[i] * 0.5 + 1e-5));
      const k = easeOutCubic(local);
      const i3 = i * 3;
      const breathe = 1 + Math.sin(t * 0.7 + i * 0.37) * 0.012 * k;
      arr[i3]     = (chaos[i3]     + (target[i3]     - chaos[i3])     * k) * breathe;
      arr[i3 + 1] = (chaos[i3 + 1] + (target[i3 + 1] - chaos[i3 + 1]) * k) * breathe;
      arr[i3 + 2] = (chaos[i3 + 2] + (target[i3 + 2] - chaos[i3 + 2]) * k) * breathe;
    }
    posAttr.needsUpdate = true;

    /* edges follow their endpoints */
    for (let e = 0; e < pairs.length; e += 2) {
      const a = pairs[e] * 3, b = pairs[e + 1] * 3, o = (e / 2) * 6;
      lPos[o] = arr[a]; lPos[o + 1] = arr[a + 1]; lPos[o + 2] = arr[a + 2];
      lPos[o + 3] = arr[b]; lPos[o + 4] = arr[b + 1]; lPos[o + 5] = arr[b + 2];
    }
    lAttr.needsUpdate = true;
    lMat.opacity = 0.16 * Math.pow(ue, 2);

    /* core + scan ring */
    coreMesh.rotation.x = t * 0.4; coreMesh.rotation.y = t * 0.55;
    coreMesh.material.opacity = 0.34 * ue;
    const sweep = clamp01((uSmooth - 0.08) / 0.84);
    ring.position.y = 1.9 - sweep * 3.8;
    ring.material.opacity = sweep > 0 && sweep < 1 ? 0.5 * Math.sin(sweep * Math.PI) : 0;
    const rs = 1 + Math.sin(sweep * Math.PI) * 0.06;
    ring.scale.set(rs, rs, rs);

    /* camera + rotation */
    group.rotation.y = t * (REDUCED ? 0.02 : 0.06) + ue * 1.15;
    group.rotation.x = Math.sin(t * 0.1) * 0.04;
    camera.position.z = 7.4 - ue * 2.7;
    camera.position.x += (mouseX * 0.45 - camera.position.x) * 0.04;
    camera.position.y += (-mouseY * 0.35 + 0.1 - camera.position.y) * 0.04;
    camera.lookAt(0, 0, 0);

    renderer.render(scene, camera);
  });
}

document.querySelectorAll('canvas[data-nody]').forEach(mount);
