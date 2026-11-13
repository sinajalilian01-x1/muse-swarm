/* eslint-disable */
// Muse Swarm studio scene — "Indoor-Outdoor Balcony" (low-poly room v3), wired to a Director that feeds it real chain events.
// Bigger open floor, a living plant wall, sliding glass doors onto a balcony deck with a hammock, a small coffee bar.
import { THREE } from './engine.js';
import { runStudio2 } from './engine2.js';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';

const C = { teal: '#16A39C', tealD: '#0E7F7A', tang: '#F47A38', lemon: '#F6C53E', pink: '#F48AA6', navy: '#13243F', wall: '#F7F5F1', floor: '#EEECE8', wood: '#E9B880', woodD: '#D9A26A', coral: '#F49A7C', coralL: '#F8B9A2', leaf: ['#3FAE77', '#2E9463', '#6CC36B', '#9BD46A'] };
const W = 4.4; // interior half-size (was 3.7)
const gems = [];
function gem(k, color, r, kind = 'ico') {
  const g = kind === 'oct' ? new THREE.OctahedronGeometry(r, 0) : kind === 'dod' ? new THREE.DodecahedronGeometry(r, 0) : new THREE.IcosahedronGeometry(r, 0);
  return k.mesh(g, k.mat(color, { rough: 0.55 }));
}
function rand(seed) { let s = seed >>> 0; return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296); }

// Bake every static room mesh into one mesh per material (keeps draw calls low on mobile).
function bake(scene, roots, skip) {
  scene.updateMatrixWorld(true); const buckets = new Map(), kill = [];
  roots.forEach((root) => root.traverse((o) => {
    if (!o.isMesh || o.isInstancedMesh) return; for (let p = o; p; p = p.parent) if (skip.has(p)) return;
    let g = o.geometry.clone().applyMatrix4(o.matrixWorld); if (g.index) g = g.toNonIndexed();
    for (const a of Object.keys(g.attributes)) if (!['position', 'normal', 'uv'].includes(a)) g.deleteAttribute(a);
    if (!g.attributes.uv) g.setAttribute('uv', new THREE.Float32BufferAttribute(new Float32Array(g.attributes.position.count * 2), 2));
    const key = o.material.uuid + (o.castShadow ? 'c' : 'n'); if (!buckets.has(key)) buckets.set(key, { m: o.material, cast: o.castShadow, gs: [] });
    buckets.get(key).gs.push(g); kill.push(o);
  }));
  kill.forEach((o) => o.parent.remove(o));
  for (const { m, cast, gs } of buckets.values()) { const mesh = new THREE.Mesh(mergeGeometries(gs, false), m); mesh.castShadow = cast; mesh.receiveShadow = true; scene.add(mesh); }
}
function buildRoom(k, scene, ctx) {
  const { mat, rbox, box, cyl, at, plant, group, mesh } = k;
  const before = new Set(scene.children), skip = new Set();
  // ---- shell: floor, two solid walls, glass wall with sliding door, balcony deck
  scene.add(at(rbox(9.7, 0.5, 9.7, 0.12, mat('#E2E3E1')), 0, -0.27, 0));
  scene.add(at(rbox(9.0, 0.1, 9.0, 0.04, mat(C.floor)), 0, 0, 0));
  const WM = mat(C.wall);
  scene.add(at(rbox(0.36, 3.2, 9.7, 0.08, WM), -W - 0.18, 1.6, 0.0));           // left wall (plant wall side)
  scene.add(at(rbox(5.2, 3.2, 0.36, 0.08, WM), -2.2, 1.6, -W - 0.18));           // back wall, solid part
  const wood = mat(C.wood), woodD = mat(C.woodD);
  // glass section x 0.4 .. 4.8 with a sliding door gap at 2.45 .. 3.55
  const glass = new THREE.MeshStandardMaterial({ color: '#CDEFF3', transparent: true, opacity: 0.12, roughness: 0.05, metalness: 0.1, depthWrite: false, side: THREE.DoubleSide });
  const zg = -W - 0.18;
  scene.add(at(box(4.4, 0.3, 0.3, wood), 2.6, 3.05, zg));
  [0.45, 1.45, 2.45, 3.55, 4.62].forEach((x) => scene.add(at(box(0.09, 3.0, 0.16, wood), x, 1.55, zg)));
  [[0.45, 1.45], [3.55, 4.62]].forEach(([a, b]) => { scene.add(at(box(b - a, 0.1, 0.24, woodD), (a + b) / 2, 0.1, zg)); const p = new THREE.Mesh(new THREE.PlaneGeometry(b - a - 0.08, 2.8), glass); p.position.set((a + b) / 2, 1.55, zg); scene.add(p); });
  // fixed pane + the slid-open door panel tucked in front of it
  { const p = new THREE.Mesh(new THREE.PlaneGeometry(0.92, 2.8), glass); p.position.set(1.95, 1.55, zg); scene.add(p); }
  { const d = new THREE.Group(); d.position.set(4.0, 0, zg + 0.12); d.add(at(box(0.06, 2.86, 0.06, wood), -0.5, 1.5, 0), at(box(0.06, 2.86, 0.06, wood), 0.5, 1.5, 0), at(box(1.06, 0.06, 0.06, wood), 0, 0.1, 0), at(box(1.06, 0.06, 0.06, wood), 0, 2.9, 0));
    const p = new THREE.Mesh(new THREE.PlaneGeometry(0.94, 2.76), glass); p.position.y = 1.5; d.add(p); const h = box(0.03, 0.3, 0.05, mat(C.navy)); h.position.set(-0.42, 1.25, 0.04); d.add(h); scene.add(d); }
  // balcony deck
  scene.add(at(rbox(4.45, 0.42, 2.45, 0.08, mat('#E2E3E1')), 2.58, -0.24, -5.95));
  scene.add(at(box(4.35, 0.1, 2.3, mat('#EBC291')), 2.58, 0.0, -5.95));
  for (let i = 0; i < 5; i++) { const s = box(4.35, 0.012, 0.03, woodD); s.position.set(2.58, 0.056, -5.0 - i * 0.42); s.castShadow = false; scene.add(s); }
  // railing: instanced posts + rails
  const postsAt = []; for (let x = 0.45; x <= 4.75; x += 0.86) postsAt.push([x, -7.0]); [-5.3, -6.15].forEach((z) => { postsAt.push([4.72, z]); postsAt.push([0.45, z]); });
  const pi = new THREE.InstancedMesh(new THREE.BoxGeometry(0.07, 0.95, 0.07), mat('#FFFFFF'), postsAt.length); const m4 = new THREE.Matrix4();
  postsAt.forEach(([x, z], i) => pi.setMatrixAt(i, m4.makeTranslation(x, 0.52, z))); pi.castShadow = true; pi.receiveShadow = true; scene.add(pi);
  [[2.6, -7.0, 4.36, 0.12], [4.72, -5.9, 0.12, 2.3], [0.45, -5.9, 0.12, 2.3]].forEach(([x, z, w, d]) => { scene.add(at(box(w, 0.07, d, wood), x, 1.0, z)); scene.add(at(box(Math.max(0.04, w - 0.08), 0.04, Math.max(0.04, d - 0.08), mat('#FFFFFF')), x, 0.55, z)); });
  // ---- plant wall (left wall), instanced foliage, 3 planter ledges
  const pw = new THREE.Group(); scene.add(pw);
  pw.add(at(rbox(0.12, 2.5, 4.9, 0.03, mat('#2C6E4F')), -W + 0.06, 1.55, -1.25));
  pw.add(at(box(0.16, 0.08, 5.06, wood), -W + 0.1, 2.84, -1.25), at(box(0.16, 0.08, 5.06, wood), -W + 0.1, 0.28, -1.25), at(box(0.16, 2.62, 0.08, wood), -W + 0.1, 1.55, 1.25), at(box(0.16, 2.62, 0.08, wood), -W + 0.1, 1.55, -3.75));
  [0.95, 1.75, 2.5].forEach((y) => pw.add(at(box(0.22, 0.12, 4.8, mat('#D9825A')), -W + 0.2, y - 0.18, -1.25)));
  { const r = rand(42); const n = 150; const geo = new THREE.IcosahedronGeometry(1, 0); const im = new THREE.InstancedMesh(geo, new THREE.MeshStandardMaterial({ roughness: 0.75, flatShading: true }), n); const q = new THREE.Quaternion(), e = new THREE.Euler(), s = new THREE.Vector3(), p = new THREE.Vector3(), col = new THREE.Color();
    for (let i = 0; i < n; i++) { const z = -3.6 + r() * 4.7, y = 0.45 + r() * 2.3, sz = 0.11 + r() * 0.13; p.set(-W + 0.16 + r() * 0.22, y, z); e.set(r() * 3, r() * 3, r() * 3); q.setFromEuler(e); s.set(sz * 0.7, sz * (0.9 + r() * 0.5), sz); im.setMatrixAt(i, m4.compose(p, q, s)); im.setColorAt(i, col.set(C.leaf[Math.floor(r() * 4)])); }
    im.instanceColor.needsUpdate = true; im.receiveShadow = true; pw.add(im);
    // a few trailing leaves hanging below the bottom ledge
    const cn = 18; const cm = new THREE.InstancedMesh(new THREE.ConeGeometry(0.06, 0.38, 4), new THREE.MeshStandardMaterial({ roughness: 0.75, flatShading: true }), cn);
    for (let i = 0; i < cn; i++) { p.set(-W + 0.28, 0.5 + r() * 2.0, -3.5 + r() * 4.5); e.set(Math.PI + (r() - 0.5) * 0.5, 0, (r() - 0.5) * 0.6); q.setFromEuler(e); s.set(1, 1, 1); cm.setMatrixAt(i, m4.compose(p, q, s)); cm.setColorAt(i, col.set(C.leaf[i % 4])); }
    cm.instanceColor.needsUpdate = true; pw.add(cm); }
  // ---- daybed / sofa against the back wall
  const sofa = new THREE.Group(); sofa.position.set(-2.7, 0, -3.85); scene.add(sofa);
  const co = mat(C.coral), cl = mat(C.coralL);
  sofa.add(at(rbox(2.3, 0.36, 0.95, 0.08, co), 0, 0.24, 0), at(rbox(2.3, 0.66, 0.24, 0.08, co), 0, 0.62, -0.38), at(rbox(0.24, 0.5, 0.95, 0.08, co), -1.05, 0.44, 0), at(rbox(0.24, 0.5, 0.95, 0.08, co), 1.05, 0.44, 0));
  sofa.add(at(rbox(0.9, 0.14, 0.72, 0.06, cl), -0.47, 0.48, 0.06), at(rbox(0.9, 0.14, 0.72, 0.06, cl), 0.47, 0.48, 0.06));
  { const pl = rbox(0.38, 0.34, 0.12, 0.05, mat(C.teal)); pl.position.set(-0.62, 0.72, -0.18); pl.rotation.set(-0.25, 0.2, 0.12); sofa.add(pl); const p2 = rbox(0.32, 0.3, 0.12, 0.05, mat(C.lemon)); p2.position.set(0.7, 0.7, -0.2); p2.rotation.set(-0.25, -0.25, -0.1); sofa.add(p2); }
  // side table + small plant
  scene.add(at(cyl(0.3, 0.3, 0.05, mat('#FFFFFF'), 8), -0.95, 0.58, -3.95), at(cyl(0.04, 0.06, 0.56, mat(C.lemon)), -0.95, 0.3, -3.95), at(plant(C.pink, C.teal, 0.55, 8, 'spiky'), -0.95, 0.6, -3.95));
  // picture board (back wall, above the sofa) + gem shelf
  const board = group(at(rbox(0.08, 1.2, 1.8, 0.02, mat('#FFFFFF')), 0, 0, 0), at(rbox(0.06, 1.32, 1.92, 0.02, mat(C.tang)), -0.03, 0, 0));
  [[0.3, -0.5, C.tang], [-0.25, 0.1, C.teal], [0.2, 0.55, C.lemon], [-0.3, -0.45, C.pink]].forEach(([y, z, c]) => { const t = k.mesh(new THREE.TetrahedronGeometry(0.16), mat(c)); t.position.set(0.08, y, z); t.rotation.set(0.4, 0.9, 0.2); board.add(t); });
  board.rotation.y = -Math.PI / 2; board.position.set(-2.7, 2.15, -W + 0.06); scene.add(board);
  scene.add(at(rbox(1.2, 0.07, 0.34, 0.02, mat(C.tang)), -0.55, 2.0, -W + 0.17));
  [[-0.95, C.teal], [-0.55, C.lemon], [-0.15, C.pink]].forEach(([x, c], i) => { const m = gem(k, c, 0.14 + (i % 2) * 0.03, i === 1 ? 'oct' : 'ico'); m.position.set(x, 2.2, -W + 0.17); scene.add(m); });
  // ---- coffee bar (left wall, front)
  const cb = new THREE.Group(); cb.position.set(-W, 0, 2.85); scene.add(cb);
  cb.add(at(rbox(0.66, 0.92, 1.3, 0.05, mat('#FFFFFF')), 0.33, 0.46, 0), at(rbox(0.72, 0.05, 1.36, 0.02, wood), 0.36, 0.945, 0));
  [-0.32, 0.32].forEach((z) => { const h = box(0.02, 0.04, 0.22, mat(C.navy)); h.position.set(0.67, 0.74, z); cb.add(h); });
  const mach = new THREE.Group(); mach.position.set(0.26, 0.97, -0.12); cb.add(mach);
  mach.add(at(rbox(0.36, 0.52, 0.36, 0.05, mat(C.tealD)), 0, 0.26, 0), at(rbox(0.42, 0.08, 0.42, 0.03, mat(C.navy)), 0, 0.55, 0), at(box(0.18, 0.03, 0.22, mat(C.navy)), 0.2, 0.015, 0), at(box(0.09, 0.07, 0.08, mat(C.navy)), 0.22, 0.3, 0));
  const lightM = new THREE.MeshStandardMaterial({ color: C.lemon, emissive: C.lemon, emissiveIntensity: 0.2, flatShading: true }); const btn = new THREE.Mesh(new THREE.IcosahedronGeometry(0.03, 0), lightM); btn.position.set(0.185, 0.42, -0.1); mach.add(btn);
  const cupSpot = new THREE.Object3D(); cupSpot.position.set(0.22, 0.08, 0); mach.add(cupSpot); const steam = new THREE.Object3D(); steam.position.set(0.22, 0.2, 0); mach.add(steam);
  [[0.4, 0.3, C.pink], [0.4, 0.45, C.lemon]].forEach(([x, z, c]) => cb.add(at(cyl(0.045, 0.04, 0.09, mat(c)), x, 1.015, z)));
  cb.add(at(rbox(0.3, 0.05, 1.0, 0.02, wood), 0.15, 2.05, 0)); cb.add(at(plant('#FFFFFF', C.leaf[0], 0.5, 13, 'spiky'), 0.15, 2.07, 0.25));
  ctx.coffee = { button: btn, cupSpot, steam, light: lightM }; skip.add(btn);
  // ---- hammock on the balcony (sways; robots can sit in it)
  const hx = 1.0, hz = -5.78;
  [-0.86, 0.86].forEach((dz) => { scene.add(at(cyl(0.05, 0.06, 1.75, wood), hx, 0.9, hz + dz)); scene.add(at(cyl(0.12, 0.12, 0.06, woodD), hx, 0.05, hz + dz)); });
  const ham = new THREE.Group(); ham.position.set(hx, 1.62, hz); scene.add(ham);
  { const g = new THREE.CylinderGeometry(0.42, 0.42, 1.3, 10, 1, true, Math.PI / 2, Math.PI); const bed = new THREE.Mesh(g, new THREE.MeshStandardMaterial({ color: '#FBE6B8', roughness: 0.9, flatShading: true, side: THREE.DoubleSide })); bed.rotation.x = -Math.PI / 2; bed.scale.set(1, 1, 0.55); bed.position.y = -1.05; bed.castShadow = true; bed.receiveShadow = true; ham.add(bed);
    const st = new THREE.Mesh(new THREE.CylinderGeometry(0.425, 0.425, 0.16, 10, 1, true, Math.PI / 2, Math.PI), new THREE.MeshStandardMaterial({ color: C.teal, roughness: 0.9, flatShading: true, side: THREE.DoubleSide })); st.rotation.x = -Math.PI / 2; st.scale.set(1, 1, 0.56); st.position.set(0, -1.05, 0.34); ham.add(st);
    const st2 = st.clone(); st2.position.z = -0.34; ham.add(st2);
    const pil = rbox(0.4, 0.12, 0.26, 0.05, mat(C.lemon)); pil.position.set(0, -1.2, -0.5); pil.rotation.x = 0.3; ham.add(pil);
    [-1, 1].forEach((sz) => [-1, 1].forEach((sx) => { const a = new THREE.Vector3(sx * 0.38, -1.02, sz * 0.64), b = new THREE.Vector3(0, 0.08, sz * 0.86); const len = a.distanceTo(b); const rope = cyl(0.008, 0.008, len, mat('#C9A27A'), 4); rope.position.copy(a).add(b).multiplyScalar(0.5); rope.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), b.clone().sub(a).normalize()); rope.castShadow = false; ham.add(rope); })); }
  const seat = new THREE.Object3D(); seat.position.set(0.1, -1.12, 0); ham.add(seat);
  ctx.hammock = { group: ham, seat }; skip.add(ham);
  // ---- floor accents + plants (kept sparse)
  const rug = box(2.0, 0.03, 1.35, mat(C.pink, { rough: 0.9 })); rug.position.set(-0.35, 0.065, 0.95); rug.rotation.y = 0.22; rug.castShadow = false; scene.add(rug);
  const hex = cyl(0.8, 0.8, 0.03, mat(C.lemon, { rough: 0.9 }), 6); hex.position.set(2.6, 0.065, 3.35); hex.castShadow = false; scene.add(hex);
  const pouf = cyl(0.3, 0.32, 0.34, mat(C.teal), 8); pouf.position.set(0.75, 0.2, -3.75); scene.add(pouf);
  scene.add(at(plant(C.lemon, C.teal, 1.05, 21, 'spiky'), -3.95, 0.05, 4.0));
  scene.add(at(plant('#FFFFFF', C.pink, 0.95, 4, 'spiky'), 3.95, 0.05, 3.95));
  scene.add(at(plant(C.teal, '#3FAE77', 1.0, 8, 'spiky'), 3.95, 0.05, -3.9));
  scene.add(at(plant('#FFFFFF', '#3FAE77', 0.85, 5, 'spiky'), 4.3, 0.05, -4.95));
  scene.add(at(plant(C.tang, C.leaf[2], 0.7, 9, 'spiky'), 1.6, 0.05, -6.68));
  // a couple of wall gems + a few floating ones
  [[-W + 0.2, 2.95, 2.0, C.lemon, 0.32, 'dod'], [-0.6, 2.75, -W + 0.2, C.pink, 0.3, 'oct']].forEach(([x, y, z, c, r, kd], i) => { const m = gem(k, c, r, kd); m.position.set(x, y, z); m.rotation.set(i * 0.7, i * 1.3, 0.4); scene.add(m); });
  for (let i = 0; i < 5; i++) { const m = gem(k, [C.teal, C.tang, C.lemon, C.pink][i % 4], 0.12 + (i % 3) * 0.05, i % 2 ? 'oct' : 'ico'); m.castShadow = true; m.position.set(-3.0 + i * 1.5, 3.7 + (i % 3) * 0.35, -2.4 + ((i * 7) % 5) * 0.8); scene.add(m); skip.add(m); gems.push([m, m.position.y, i]); }
  bake(scene, scene.children.filter((o) => !before.has(o)), skip);
  (function spin(t) { gems.forEach(([m, y, i]) => { m.rotation.y = t / 2400 + i; m.rotation.x = t / 3200 + i; m.position.y = y + Math.sin(t / 1200 + i) * 0.1; }); requestAnimationFrame(spin); })(0);
}

// stations (world x, z) and route graph (world x, z)
const home = { curator: [-2.3, 0.9], painter: [-1.0, -2.2], critic: [2.0, -0.2], seller: [1.0, 2.6] };
const add = (a, b) => [a[0] + b[0], a[1] + b[1]];

export function mountStudio({ container, overlay, director, hooks }) {
  const cam = { fov: 26, target: [0.0, 0.8, -1.0], azimuth: Math.PI / 4, elevation: 0.62, radius: 31, focusRadius: 20, orbitAmp: 0.08, parallax: 0.06 };
  const white = '#F7F7F4';
  const nodes = {
    hub: [0.2, 0.5], Vc: add(home.curator, [0.81, 0.81]), Vp: add(home.painter, [-0.79, 0.79]), peek: add(home.painter, [-0.07, 1.13]), Vcr: add(home.critic, [-0.81, 0.81]), Vs: add(home.seller, [-0.81, 0.81]),
    M: [1.35, -2.1], Din: [3.0, -3.75], Dout: [3.0, -5.05], Bal: [2.6, -5.6], railA: [4.05, -5.6], railB: [4.05, -6.4], railC: [2.3, -6.45], hamA: [1.7, -5.78],
    cof: [-3.45, 2.73], pw: [-3.5, -1.2], win: [1.65, -3.75], lounge: [-0.4, -1.0],
  };
  const adj = { hub: ['Vc', 'Vp', 'peek', 'Vcr', 'Vs', 'M', 'lounge'], Vc: ['hub', 'Vs', 'cof', 'pw'], Vs: ['hub', 'Vc'], Vp: ['hub', 'peek', 'pw', 'lounge'], peek: ['Vp', 'hub', 'M', 'lounge'], Vcr: ['hub', 'M'], cof: ['Vc'], pw: ['Vc', 'Vp'], lounge: ['hub', 'Vp', 'peek', 'M'],
    M: ['hub', 'peek', 'Vcr', 'Din', 'win', 'lounge'], win: ['M'], Din: ['M', 'Dout'], Dout: ['Din', 'Bal'], Bal: ['Dout', 'railA', 'railB', 'railC', 'hamA'], railA: ['Bal'], railB: ['Bal'], railC: ['Bal'], hamA: ['Bal'] };
  const spots = { cof: { node: 'cof', yaw: -Math.PI / 2 }, railA: { node: 'railA', yaw: 1.15, out: true }, railB: { node: 'railB', yaw: 1.15, out: true }, railC: { node: 'railC', yaw: Math.PI - 0.35, out: true }, ham: { node: 'hamA', yaw: Math.PI / 2, out: true }, pw: { node: 'pw', yaw: -Math.PI / 2 }, win: { node: 'win', yaw: Math.PI } };
  const studio = runStudio2({ director, nodes, adj, spots, visitOf: { curator: 'Vc', painter: 'Vp', critic: 'Vcr', seller: 'Vs' },
    container, overlay, lowpoly: true, robotScale: 1.28,
    camera: cam, buildRoom, envIntensity: 0.45, exposure: 1.0,
    lights: { sky: '#ffffff', ground: '#dfe3e6', hemi: 1.35, sun: 2.4, sunColor: '#fff6ea', sunPos: [5, 13, 9], fill: 0.55, fillPos: [-7, 5, 6], fillColor: '#e8f4ff', shadowSize: 8.5 },
    viewShift: (W, H) => (W > 900 ? { x: 0.15, y: -0.01 } : { x: 0, y: 0.06 }),
    robots: [
      { role: 'curator', name: 'Curator', x: home.curator[0], z: home.curator[1], ry: Math.PI / 4 + 0.1, body: white, head: C.teal, accent: C.teal, tag: C.teal, bubble: C.teal, bubbleText: '#ffffff', eye: '#BFFFF6' },
      { role: 'painter', name: 'Painter', x: home.painter[0], z: home.painter[1], ry: Math.PI / 4 - 0.05, body: white, head: C.tang, accent: C.tang, tag: C.tang, bubble: C.tang, bubbleText: '#ffffff', eye: '#FFE9D6' },
      { role: 'critic', name: 'Critic', x: home.critic[0], z: home.critic[1], ry: Math.PI / 4 + 0.2, body: white, head: C.lemon, accent: '#E9AE1C', tag: '#E9AE1C', bubble: C.lemon, bubbleText: C.navy, eye: '#FFF6C9' },
      { role: 'seller', name: 'Seller', x: home.seller[0], z: home.seller[1], ry: Math.PI / 4 - 0.15, body: white, head: C.pink, accent: C.pink, tag: '#E86A8C', bubble: C.pink, bubbleText: '#ffffff', eye: '#FFE3EC' },
    ],
    props: { wood: '#F1C98E', board: '#FFFFFF', cards: [C.tang, C.teal, C.lemon, C.pink, '#FFFFFF'], pin: C.navy, desk: '#FFFFFF', deskLeg: C.lemon, counter: C.pink, counterTop: '#FFFFFF', register: C.teal, signBg: '#FFFFFF', signFg: C.navy, mug: C.teal, frame: '#FFFFFF' },
    cups: { curator: C.teal, painter: C.tang, critic: C.lemon, seller: C.pink },
    ...hooks,
  });
  const fit = () => { const a = innerWidth / innerHeight; const need = 6.3 / (Math.tan((26 / 2) * Math.PI / 180) * a); cam.radius = Math.max(32.5, need); cam.focusRadius = cam.radius * 0.667; };
  fit(); addEventListener('resize', fit);
  return { studio, dispose() { removeEventListener('resize', fit); } };
}
