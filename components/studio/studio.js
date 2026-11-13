/* eslint-disable */
// Muse Swarm studio scene (final design "B v2 Low-Poly Room"), wired to a Director that feeds it real chain events.
import { THREE } from './engine.js';
import { runStudio2 } from './engine2.js';

const C = { teal: '#16A39C', tealD: '#0E7F7A', tang: '#F47A38', lemon: '#F6C53E', pink: '#F48AA6', navy: '#13243F', wall: '#F7F7F5', floor: '#ECECEA' };
const gems = [];
function gem(k, color, r, detail = 0, kind = 'ico') {
  const g = kind === 'oct' ? new THREE.OctahedronGeometry(r, detail) : kind === 'dod' ? new THREE.DodecahedronGeometry(r, detail) : new THREE.IcosahedronGeometry(r, detail);
  return k.mesh(g, k.mat(color, { rough: 0.55 }));
}
function buildRoom(k, scene) {
  const { mat, rbox, box, cyl, at, plant, group } = k;
  scene.add(at(rbox(7.6, 0.5, 7.6, 0.12, mat('#E2E3E1')), 0, -0.27, 0));
  scene.add(at(rbox(7.4, 0.1, 7.4, 0.04, mat(C.floor)), 0, 0, 0));
  // stepped walls (faceted silhouette)
  const W = mat(C.wall);
  scene.add(at(rbox(0.36, 3.0, 7.6, 0.08, W), -3.62, 1.5, 0));
  scene.add(at(rbox(7.6, 3.0, 0.36, 0.08, W), 0, 1.5, -3.62));
  scene.add(at(rbox(0.36, 0.7, 3.0, 0.08, W), -3.62, 3.3, -2.0));
  scene.add(at(rbox(3.4, 0.7, 0.36, 0.08, W), 1.6, 3.3, -3.62));
  // embedded faceted shapes on walls
  [[-3.45, 2.3, 1.6, C.teal, 0.85, 'oct'], [-3.45, 0.9, 2.9, C.tang, 0.7, 'ico'], [-3.45, 2.8, -1.4, C.lemon, 0.6, 'ico'], [-1.2, 2.4, -3.45, C.pink, 0.75, 'oct'], [0.9, 2.8, -3.45, C.lemon, 0.55, 'dod'], [3.0, 1.2, -3.45, C.lemon, 0.8, 'ico'], [2.2, 3.4, -3.45, C.teal, 0.45, 'oct']]
    .forEach(([x, y, z, c, r, kd], i) => { const m = gem(k, c, r, 0, kd); m.position.set(x, y, z); m.rotation.set(i * 0.7, i * 1.3, i * 0.4); m.scale.set(1, 1.15, 1); scene.add(m); });
  // picture board on left wall
  const board = group(at(rbox(0.08, 1.3, 1.9, 0.02, mat('#FFFFFF')), 0, 0, 0), at(rbox(0.06, 1.42, 2.02, 0.02, mat(C.tang)), -0.03, 0, 0));
  [[0.3, -0.5, C.tang], [-0.25, 0.1, C.teal], [0.2, 0.55, C.lemon], [-0.3, -0.45, C.pink]].forEach(([y, z, c]) => { const t = mesh3(k, new THREE.TetrahedronGeometry(0.17), mat(c)); t.position.set(0.08, y, z); t.rotation.set(0.4, 0.9, 0.2); board.add(t); });
  board.position.set(-3.4, 1.85, -0.2); scene.add(board);
  // wall shelf with gems
  const sh = at(rbox(1.5, 0.07, 0.36, 0.02, mat(C.tang)), 2.0, 2.05, -3.3); scene.add(sh);
  [[1.5, C.teal], [2.0, C.lemon], [2.45, C.pink]].forEach(([x, c], i) => { const m = gem(k, c, 0.15 + (i % 2) * 0.03, 0, i === 1 ? 'oct' : 'ico'); m.position.set(x, 2.27, -3.3); scene.add(m); });
  // floor accents
  const rug = box(1.5, 0.03, 1.1, mat(C.pink, { rough: 0.9 })); rug.position.set(-0.6, 0.065, 1.9); rug.rotation.y = 0.25; rug.castShadow = false; scene.add(rug);
  const hex = cyl(0.75, 0.75, 0.03, mat(C.lemon, { rough: 0.9 }), 6); hex.position.set(2.2, 0.065, 2.2); hex.castShadow = false; scene.add(hex);
  // plants
  scene.add(at(plant(C.lemon, C.teal, 1.1, 21, 'spiky'), -3.0, 0.05, 2.95));
  scene.add(at(plant('#FFFFFF', C.pink, 0.95, 4, 'spiky'), 3.0, 0.05, 3.0));
  scene.add(at(plant(C.teal, '#3FAE77', 0.8, 8, 'spiky'), 3.0, 0.05, -2.2));
  // floating gems
  for (let i = 0; i < 6; i++) { const m = gem(k, [C.teal, C.tang, C.lemon, C.pink][i % 4], 0.12 + (i % 3) * 0.05, 0, i % 2 ? 'oct' : 'ico'); m.castShadow = true; m.position.set(-2.5 + i * 1.0, 3.4 + (i % 3) * 0.35, -1.5 + ((i * 7) % 5) * 0.7); scene.add(m); gems.push([m, m.position.y, i]); }
  (function spin(t) { gems.forEach(([m, y, i]) => { m.rotation.y = t / 1600 + i; m.rotation.x = t / 2300 + i; m.position.y = y + Math.sin(t / 800 + i) * 0.12; }); requestAnimationFrame(spin); })(0);
}
function mesh3(k, g, m) { return k.mesh(g, m); }

const iso = (u, v) => [(u + v) / Math.SQRT2, (v - u) / Math.SQRT2];
const pos = { curator: iso(-2.6, 0.3), painter: iso(-0.2, -2.0), critic: iso(2.0, -0.6), seller: iso(0.1, 2.2) };

export function mountStudio({ container, overlay, director, hooks }) {
const cam = { fov: 26, target: [0.1, 0.95, 0.1], azimuth: Math.PI / 4, elevation: 0.6, radius: 21.5, focusRadius: 15, orbitAmp: 0.1, parallax: 0.08 };
const white = '#F7F7F4';
const H = { c: pos.curator, p: pos.painter, k: pos.critic, s: pos.seller };
const nodes = { Vc: iso(-2.6, 1.45), W: iso(-0.9, 1.1), hub: iso(0, 0), Vp: iso(-1.32, -2.0), peek: iso(-1.05, -1.25), Vcr: iso(0.85, -0.6), Vs: iso(-1.05, 2.2) };
const adj = { Vc: ['W'], W: ['Vc', 'hub', 'Vs'], hub: ['W', 'Vp', 'Vcr', 'peek', 'Vs'], Vp: ['hub', 'peek'], peek: ['Vp', 'hub'], Vcr: ['hub'], Vs: ['W', 'hub'] };
  const studio = runStudio2({ director, nodes, adj, visitOf: { curator: 'Vc', painter: 'Vp', critic: 'Vcr', seller: 'Vs' },
  container, overlay, lowpoly: true, robotScale: 1.18,
  camera: cam, buildRoom, envIntensity: 0.45, exposure: 1.0,
  lights: { sky: '#ffffff', ground: '#dfe3e6', hemi: 1.35, sun: 2.4, sunColor: '#fff6ea', sunPos: [4, 12, 8], fill: 0.55, fillPos: [-7, 5, 6], fillColor: '#e8f4ff', shadowSize: 6.5 },
  viewShift: (W, H) => (W > 900 ? { x: 0.15, y: -0.01 } : { x: 0, y: 0.06 }),
  robots: [
    { role: 'curator', name: 'Curator', x: pos.curator[0], z: pos.curator[1], ry: Math.PI / 4 + 0.1, body: white, head: C.teal, accent: C.teal, tag: C.teal, bubble: C.teal, bubbleText: '#ffffff', eye: '#BFFFF6' },
    { role: 'painter', name: 'Painter', x: pos.painter[0], z: pos.painter[1], ry: Math.PI / 4 - 0.05, body: white, head: C.tang, accent: C.tang, tag: C.tang, bubble: C.tang, bubbleText: '#ffffff', eye: '#FFE9D6' },
    { role: 'critic', name: 'Critic', x: pos.critic[0], z: pos.critic[1], ry: Math.PI / 4 + 0.2, body: white, head: C.lemon, accent: '#E9AE1C', tag: '#E9AE1C', bubble: C.lemon, bubbleText: C.navy, eye: '#FFF6C9' },
    { role: 'seller', name: 'Seller', x: pos.seller[0], z: pos.seller[1], ry: Math.PI / 4 - 0.15, body: white, head: C.pink, accent: C.pink, tag: '#E86A8C', bubble: C.pink, bubbleText: '#ffffff', eye: '#FFE3EC' },
  ],
  props: { wood: '#F1C98E', board: '#FFFFFF', cards: [C.tang, C.teal, C.lemon, C.pink, '#FFFFFF'], pin: C.navy, desk: '#FFFFFF', deskLeg: C.lemon, counter: C.pink, counterTop: '#FFFFFF', register: C.teal, signBg: '#FFFFFF', signFg: C.navy, mug: C.teal, frame: '#FFFFFF' },
  ...hooks,
});
const fit = () => { const a = innerWidth / innerHeight; const need = 4.3 / (Math.tan((26 / 2) * Math.PI / 180) * a); cam.radius = Math.max(23, need); cam.focusRadius = cam.radius * 0.667; };
fit(); addEventListener('resize', fit);

  return { studio, dispose() { removeEventListener('resize', fit); } };
}
