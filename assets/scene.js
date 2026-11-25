import * as THREE from 'three';

/* A living agent graph: one core (the model), tool nodes around it, pulses
   travelling the edges. Amber pulses = human-approval gate. */
const canvas = document.getElementById('scene');
const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
let renderer;
try {
  renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, powerPreference: 'high-performance' });
} catch (e) { canvas.remove(); throw e; }

renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(48, 1, .1, 100);
camera.position.set(0, 0, 11);

const css = n => getComputedStyle(document.documentElement).getPropertyValue(n).trim();
const colors = { accent: new THREE.Color(), warm: new THREE.Color(), dim: new THREE.Color(), light: false };
const mats = [];
function readTheme() {
  colors.accent.set(css('--accent') || '#6df0c2');
  colors.warm.set(css('--warm') || '#ffb86b');
  colors.dim.set(css('--dim') || '#5d646d');
  colors.light = document.documentElement.dataset.theme === 'light';
  const blend = colors.light ? THREE.NormalBlending : THREE.AdditiveBlending;
  mats.forEach(m => { m.mat.blending = blend; m.mat.opacity = colors.light ? m.base * 1.6 : m.base; m.mat.needsUpdate = true; });
  if (typeof recolor === 'function') recolor();
}
const reg = (mat, base) => { mat.transparent = true; mat.depthWrite = false; mat.opacity = base; mats.push({ mat, base }); return mat; };

/* soft glow sprite texture */
const glowTex = (() => {
  const c = document.createElement('canvas'); c.width = c.height = 128;
  const g = c.getContext('2d'), r = g.createRadialGradient(64, 64, 0, 64, 64, 64);
  r.addColorStop(0, 'rgba(255,255,255,1)'); r.addColorStop(.25, 'rgba(255,255,255,.35)'); r.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = r; g.fillRect(0, 0, 128, 128);
  return new THREE.CanvasTexture(c);
})();

const world = new THREE.Group();
scene.add(world);

/* --- core --- */
const core = new THREE.Group(); world.add(core);
const coreWire = new THREE.Mesh(new THREE.IcosahedronGeometry(1.25, 2), reg(new THREE.MeshBasicMaterial({ wireframe: true }), .55));
const coreInner = new THREE.Mesh(new THREE.IcosahedronGeometry(.62, 1), reg(new THREE.MeshBasicMaterial({ wireframe: true }), .9));
const coreGlow = new THREE.Sprite(reg(new THREE.SpriteMaterial({ map: glowTex }), .85)); coreGlow.scale.setScalar(5.2);
core.add(coreWire, coreInner, coreGlow);

/* orbit rings */
const rings = [];
[[2.1, 1.1, .2], [2.9, .45, 1.0], [3.7, 1.4, .6]].forEach(([r, rx, ry], i) => {
  const m = new THREE.Mesh(new THREE.TorusGeometry(r, .006, 8, 160), reg(new THREE.MeshBasicMaterial(), .35 - i * .06));
  m.rotation.set(rx, ry, 0); m.userData.spin = (i % 2 ? -1 : 1) * (.05 + i * .02); world.add(m); rings.push(m);
});

/* --- tool nodes on a fibonacci shell --- */
const N = 16, nodes = [];
const nodeGeo = [new THREE.OctahedronGeometry(.17), new THREE.IcosahedronGeometry(.15, 0), new THREE.BoxGeometry(.22, .22, .22)];
for (let i = 0; i < N; i++) {
  const y = 1 - (i / (N - 1)) * 2, rad = Math.sqrt(1 - y * y), th = i * 2.399963;
  const R = 3.3 + (i % 3) * .55;
  const pos = new THREE.Vector3(Math.cos(th) * rad, y, Math.sin(th) * rad).multiplyScalar(R);
  const mesh = new THREE.Mesh(nodeGeo[i % 3], reg(new THREE.MeshBasicMaterial({ wireframe: true }), .95));
  mesh.position.copy(pos);
  const halo = new THREE.Sprite(reg(new THREE.SpriteMaterial({ map: glowTex }), .35)); halo.scale.setScalar(.9); mesh.add(halo);
  world.add(mesh);
  nodes.push({ mesh, pos, gate: i % 5 === 2, phase: Math.random() * 6 });
}

/* floating tool-name labels so the graph reads as an agent at a glance */
const labelNames = ['get_options', 'validate', 'request_approval', 'commit', 'verify_saved', 'run_evals', 'route_intent', 'summarize'];
function makeLabel(text) {
  const c = document.createElement('canvas'); c.width = 320; c.height = 64;
  const g = c.getContext('2d');
  g.font = '500 26px ui-monospace, Consolas, monospace'; g.fillStyle = '#fff'; g.textAlign = 'center'; g.textBaseline = 'middle';
  g.fillText(text, 160, 32);
  const sp = new THREE.Sprite(reg(new THREE.SpriteMaterial({ map: new THREE.CanvasTexture(c) }), .8));
  sp.scale.set(2, .4, 1); world.add(sp); return sp;
}
nodes.slice(0, labelNames.length).forEach((n, i) => { n.label = makeLabel(labelNames[i]); });

/* edges: core→node, plus neighbour links */
const edges = [];
nodes.forEach((n, i) => edges.push([new THREE.Vector3(), n.pos, n]));
for (let i = 0; i < N; i++) for (let j = i + 1; j < N; j++)
  if (nodes[i].pos.distanceTo(nodes[j].pos) < 2.7) edges.push([nodes[i].pos, nodes[j].pos, null]);
const lp = []; edges.forEach(([a, b]) => lp.push(a.x, a.y, a.z, b.x, b.y, b.z));
const lineGeo = new THREE.BufferGeometry(); lineGeo.setAttribute('position', new THREE.Float32BufferAttribute(lp, 3));
const lines = new THREE.LineSegments(lineGeo, reg(new THREE.LineBasicMaterial(), .16)); world.add(lines);

/* --- pulses --- */
const P = 34, pulses = [];
const pGeo = new THREE.BufferGeometry();
pGeo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(P * 3), 3));
pGeo.setAttribute('color', new THREE.BufferAttribute(new Float32Array(P * 3), 3));
const pMat = reg(new THREE.PointsMaterial({ size: .2, map: glowTex, vertexColors: true, sizeAttenuation: true }), 1);
const pts = new THREE.Points(pGeo, pMat); pts.frustumCulled = false; world.add(pts);
for (let i = 0; i < P; i++) pulses.push(newPulse(Math.random()));
function newPulse(t = 0) {
  const e = edges[(Math.random() * edges.length) | 0];
  const toCore = Math.random() < .35 && e[2];
  return { e, t, speed: .22 + Math.random() * .35, dir: toCore ? -1 : 1, gate: !!(e[2] && e[2].gate) && Math.random() < .7 };
}

/* --- star dust --- */
const S = 700, sp = new Float32Array(S * 3);
for (let i = 0; i < S; i++) {
  const r = 9 + Math.random() * 22, a = Math.random() * 6.283, b = Math.acos(2 * Math.random() - 1);
  sp.set([r * Math.sin(b) * Math.cos(a), r * Math.cos(b) * .7, r * Math.sin(b) * Math.sin(a)], i * 3);
}
const sg = new THREE.BufferGeometry(); sg.setAttribute('position', new THREE.BufferAttribute(sp, 3));
const stars = new THREE.Points(sg, reg(new THREE.PointsMaterial({ size: .045, sizeAttenuation: true }), .5)); scene.add(stars);

/* recolor everything from CSS variables */
function recolor() {
  const A = colors.accent;
  [coreWire, coreInner, ...rings, lines].forEach(o => o.material.color.copy(A));
  coreGlow.material.color.copy(A);
  nodes.forEach(n => {
    const c = n.gate ? colors.warm : A;
    n.mesh.material.color.copy(c); n.mesh.children[0].material.color.copy(c);
    if (n.label) n.label.material.color.copy(c);
  });
  stars.material.color.copy(colors.light ? colors.dim : new THREE.Color('#ffffff'));
  pMat.color.set('#ffffff');
}
readTheme();
new MutationObserver(readTheme).observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });

/* --- layout / interaction --- */
let W = 0, H = 0, wide = true;
function resize() {
  W = innerWidth; H = innerHeight; wide = W > 980;
  renderer.setSize(W, H, false); camera.aspect = W / H; camera.updateProjectionMatrix();
}
addEventListener('resize', resize); resize();
const mouse = { x: 0, y: 0, sx: 0, sy: 0 };
addEventListener('pointermove', e => { mouse.x = e.clientX / W * 2 - 1; mouse.y = e.clientY / H * 2 - 1; }, { passive: true });
let scrollY_ = 0;
addEventListener('scroll', () => { scrollY_ = scrollY; }, { passive: true });

let visible = true;
document.addEventListener('visibilitychange', () => { visible = !document.hidden; if (visible) loop(); });

const tmp = new THREE.Vector3(), cA = new THREE.Color(), cW = new THREE.Color();
let last = performance.now(), time = 0, boost = 0;
addEventListener('agent-pulse', () => { boost = 1; });
function frame(now) {
  const dt = Math.min((now - last) / 1000, .05); last = now; time += dt;
  mouse.sx += (mouse.x - mouse.sx) * .04; mouse.sy += (mouse.y - mouse.sy) * .04;

  const prog = Math.min(scrollY_ / Math.max(H, 1), 6);
  const hero = Math.max(0, 1 - scrollY_ / (H * (wide ? .9 : .25)));
  /* wide: orbit sits in the right third, clear of the hero text. narrow: orbit sits above the text. */
  world.position.x += ((wide ? 4.3 : 0) - world.position.x) * .05;
  world.position.y += ((wide ? 0 : 2.6 * hero) - world.position.y) * .05;
  world.rotation.y = time * .12 + mouse.sx * .6 + prog * .5;
  world.rotation.x = mouse.sy * .25 + Math.sin(time * .2) * .08 + prog * .1;
  const sc = wide ? 1 : .72; world.scale.setScalar(sc * (.85 + hero * .25));
  camera.position.z = 11 + prog * .35;
  canvas.style.opacity = (.28 + hero * .72).toFixed(3);

  core.rotation.y += dt * .35; core.rotation.x += dt * .12;
  boost = Math.max(0, boost - dt * .9);
  coreInner.rotation.y -= dt * (.9 + boost * 6);
  const breathe = 1 + Math.sin(time * 1.6) * .05 + boost * .18; core.scale.setScalar(breathe);
  rings.forEach(r => { r.rotation.z += r.userData.spin * dt; });
  nodes.forEach(n => { n.mesh.rotation.x += dt * .6; n.mesh.rotation.y += dt * .8; n.mesh.position.y = n.pos.y + Math.sin(time + n.phase) * .08; if (n.label) {
    n.label.position.set(n.mesh.position.x, n.mesh.position.y + .5, n.mesh.position.z);
    /* hide labels on narrow screens and whenever one would be clipped by the viewport edge */
    n.label.getWorldPosition(tmp); tmp.project(camera);
    n.label.visible = wide && Math.abs(tmp.x) < .88 && Math.abs(tmp.y) < .9;
  } });
  stars.rotation.y = time * .008 + mouse.sx * .05;

  const pos = pGeo.attributes.position.array, col = pGeo.attributes.color.array;
  cA.copy(colors.accent); cW.copy(colors.warm);
  pulses.forEach((p, i) => {
    p.t += p.speed * (1 + boost * 3.5) * dt;
    if (p.t >= 1) { Object.assign(p, newPulse(0)); }
    const [a, b] = p.e; const k = p.dir > 0 ? p.t : 1 - p.t;
    tmp.lerpVectors(a, b, k);
    pos[i * 3] = tmp.x; pos[i * 3 + 1] = tmp.y; pos[i * 3 + 2] = tmp.z;
    const c = p.gate ? cW : cA; col[i * 3] = c.r; col[i * 3 + 1] = c.g; col[i * 3 + 2] = c.b;
  });
  pGeo.attributes.position.needsUpdate = true; pGeo.attributes.color.needsUpdate = true;
  renderer.render(scene, camera);
}
function loop() {
  if (!visible) return;
  requestAnimationFrame(t => { frame(t); loop(); });
}
if (reduce) { frame(performance.now()); addEventListener('resize', () => frame(performance.now())); }
else loop();
document.body.classList.add('has-3d');
