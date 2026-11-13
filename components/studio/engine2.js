// Muse Swarm v2 — choreographed studio: walking robots, hand-to-hand handoffs, per-beat micro animations.
import { THREE, makeKit, THEMES, canvasTex, paintArt, LivePainting, buildRobot, buildProps } from './engine.js';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
/* eslint-disable */

const clamp = (v, a = 0, b = 1) => Math.max(a, Math.min(b, v));
const smooth = (t) => t * t * (3 - 2 * t);
const lerp = (a, b, t) => a + (b - a) * t;
const damp = (c, t, k, dt) => c + (t - c) * (1 - Math.exp(-k * dt));
const angDiff = (a, b) => { let d = b - a; while (d > Math.PI) d -= Math.PI * 2; while (d < -Math.PI) d += Math.PI * 2; return d; };
const V2 = (x, z) => new THREE.Vector2(x, z);

export function runStudio2(cfg) {
  const kit = makeKit(true); const { mat, rbox, box, cyl, sphere, mesh } = kit; const S = cfg.robotScale ?? 1.18;
  const container = cfg.container, overlay = cfg.overlay;
  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2)); renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.NeutralToneMapping; renderer.toneMappingExposure = cfg.exposure ?? 1;
  renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap; container.appendChild(renderer.domElement);
  const scene = new THREE.Scene(); const pmrem = new THREE.PMREMGenerator(renderer);
  scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture; scene.environmentIntensity = cfg.envIntensity ?? 0.45;
  const L = cfg.lights;
  scene.add(new THREE.HemisphereLight(L.sky, L.ground, L.hemi));
  const sun = new THREE.DirectionalLight(L.sunColor, L.sun); sun.position.set(...L.sunPos); sun.castShadow = true; sun.shadow.mapSize.set(2048, 2048);
  const sc = sun.shadow.camera, SS = L.shadowSize ?? 6.5; sc.left = -SS; sc.right = SS; sc.top = SS; sc.bottom = -SS; sc.near = 1; sc.far = 50; sun.shadow.bias = -0.0004; sun.shadow.normalBias = 0.025;
  scene.add(sun, sun.target);
  if (L.fill) { const f = new THREE.DirectionalLight(L.fillColor ?? '#fff', L.fill); f.position.set(...L.fillPos); scene.add(f); }
  const C = cfg.camera; const camera = new THREE.PerspectiveCamera(C.fov, 1, 0.1, 300); const target = new THREE.Vector3(...C.target);
  const ctx = { painting: new LivePainting(320, 400) };
  cfg.buildRoom(kit, scene, ctx);

  // ------------------------------------------------------------ robots
  const roles = ['curator', 'painter', 'critic', 'seller']; const R = {};
  const idleStatus = { curator: 'Browsing trends', painter: 'Mixing colors', critic: 'Waiting for art', seller: 'Tidying the shop' };
  cfg.robots.forEach((spec, i) => {
    const station = new THREE.Group(); station.position.set(spec.x, 0, spec.z); station.rotation.y = spec.ry; station.scale.setScalar(S); scene.add(station);
    const props = buildProps(kit, spec.role, cfg.props, ctx); station.add(props.group);
    const bot = buildRobot(kit, spec); bot.root.scale.setScalar(S); scene.add(bot.root);
    const r = Object.assign(bot, { k: spec.role, spec, station, props, home: V2(spec.x, spec.z), homeYaw: spec.ry, pos: V2(spec.x, spec.z), yaw: spec.ry, yawT: spec.ry,
      path: [], endYaw: null, speed: 1.75, walkPh: 0, walkAmt: 0, pose: 'idle', poseT0: 0, look: null, lookAround: false, hY: 0, hP: 0, tilt: 0, tiltT: 0, nodT: -9, hopT: -9, hopH: 0.16, lastHop: 0,
      busy: false, status: idleStatus[spec.role], progress: null, nextIdle: 2.5 + i * 1.9, phase: i * 1.7, blinkT: 1 + i, squint: 0, squintT: 0, extraYaw: 0 });
    r.carry = new THREE.Object3D(); r.carry.position.set(0, 0.62, 0.5); r.body.add(r.carry);
    r.headTop = new THREE.Object3D(); r.headTop.position.y = 0.62; r.head.add(r.headTop);
    R[spec.role] = r;
  });
  const P = R.painter, K = R.critic, Se = R.seller, Cu = R.curator;
  // role props
  P.hands[1].add(P.props.brush); P.props.brush.rotation.x = 1.3; P.hands[-1].add(P.props.palette); P.props.palette.position.set(0, -0.02, 0.05);
  K.hands[-1].add(K.props.paddle); K.props.paddle.rotation.set(0, 0, Math.PI); K.props.paddle.position.y = -0.02;
  Cu.props.handCard.visible = false;
  const clip = new THREE.Group(); clip.add(rbox(0.22, 0.28, 0.025, 0.01, mat('#C98A4B'))); const paper = mesh(new THREE.PlaneGeometry(0.18, 0.22), mat('#FFFFFF'), false); paper.position.z = 0.014; clip.add(paper);
  [0.06, 0.02, -0.02, -0.06].forEach((y, i) => { const l = mesh(new THREE.PlaneGeometry(i ? 0.12 : 0.08, 0.012), mat(['#16A39C', '#cfd6dc', '#cfd6dc', '#F47A38'][i]), false); l.position.set(-0.02, y, 0.016); clip.add(l); });
  clip.rotation.set(-1.2, 0, 0); clip.position.set(0, -0.04, 0.06); Cu.hands[-1].add(clip);
  const magnifier = new THREE.Group(); { const ring = mesh(new THREE.TorusGeometry(0.075, 0.016, 6, 10), mat('#13243F')); magnifier.add(ring); const glass = mesh(new THREE.CircleGeometry(0.068, 10), new THREE.MeshStandardMaterial({ color: '#cdeffa', transparent: true, opacity: 0.45, roughness: 0.05 }), false); magnifier.add(glass); const h = cyl(0.014, 0.014, 0.12, mat('#F6C53E')); h.position.y = -0.13; magnifier.add(h); }
  magnifier.position.set(0, -0.06, 0.08); magnifier.rotation.x = -Math.PI / 2; magnifier.visible = false; K.hands[1].add(magnifier);
  const handMug = cyl(0.05, 0.045, 0.1, mat(cfg.props.mug)); handMug.position.set(0, -0.03, 0.05); handMug.visible = false; K.hands[1].add(handMug);
  // easel card spot
  const easel = P.props.focus; const cardSpot = new THREE.Object3D(); cardSpot.position.set(0.22, 1.42, 0.12); easel.add(cardSpot);
  // seller counter: display stand, bell, flip sign
  const ctr = Se.props.ctr; Se.props.sign.visible = true;
  const stand = new THREE.Group(); [-0.12, 0.12].forEach((x) => { const l = box(0.03, 0.42, 0.03, mat('#13243F')); l.position.set(x, 0.86, -0.06); l.rotation.x = -0.18; stand.add(l); }); const ledge = box(0.34, 0.03, 0.08, mat('#13243F')); ledge.position.set(0, 0.69, 0.02); stand.add(ledge); stand.position.x = 0.02; ctr.add(stand);
  const display = new THREE.Object3D(); display.position.set(0.02, 0.93, 0.05); ctr.add(display);
  ctr.remove(Se.props.reg);
  const bell = new THREE.Group(); const bb = cyl(0.07, 0.08, 0.02, mat('#13243F')); bell.add(bb); const dome = mesh(new THREE.SphereGeometry(0.075, 8, 4, 0, Math.PI * 2, 0, Math.PI / 2), mat('#F6C53E', { metal: 0.5, rough: 0.3 })); dome.position.y = 0.01; bell.add(dome); const knob = sphere(0.018, mat('#F6C53E', { metal: 0.5 })); knob.position.y = 0.095; bell.add(knob);
  bell.position.set(-0.36, 0.68, 0.1); ctr.add(bell);
  const signTex = (txt, bg, fg) => canvasTex(256, 140, (c, w, h) => { c.fillStyle = bg; c.beginPath(); c.roundRect(4, 4, w - 8, h - 8, 26); c.fill(); c.fillStyle = fg; c.font = '900 54px system-ui, sans-serif'; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText(txt, w / 2, h / 2 + 3); });
  const flip = new THREE.Group(); const fs = new THREE.Mesh(new THREE.PlaneGeometry(0.3, 0.16), new THREE.MeshStandardMaterial({ map: signTex('FOR SALE', '#16A39C', '#fff'), roughness: 0.6 })); const bs = new THREE.Mesh(new THREE.PlaneGeometry(0.3, 0.16), new THREE.MeshStandardMaterial({ map: signTex('SOLD!', '#F47A38', '#fff'), roughness: 0.6 })); bs.rotation.y = Math.PI; bs.position.z = -0.004;
  flip.add(fs, bs); const fpost = cyl(0.01, 0.01, 0.12, mat('#13243F')); fpost.position.y = -0.12; flip.add(fpost); flip.position.set(-0.36, 0.86, -0.12); ctr.add(flip);
  const props = cfg.propsExtra; void props;

  // ------------------------------------------------------------ route graph
  const N = {}; for (const [k, v] of Object.entries(cfg.nodes)) N[k] = V2(v[0], v[1]);
  const ADJ = { ...cfg.adj }; roles.forEach((k) => { N['home_' + k] = R[k].home; ADJ['home_' + k] = [cfg.visitOf[k]]; ADJ[cfg.visitOf[k]] = [...(ADJ[cfg.visitOf[k]] ?? []), 'home_' + k]; });
  function route(r, dest) {
    const goal = dest === 'home' ? 'home_' + r.k : dest; const ok = (n) => !n.startsWith('home_') || n === 'home_' + r.k;
    let start = null, bd = 1e9; for (const n in N) { if (!ok(n)) continue; const d = N[n].distanceTo(r.pos); if (d < bd) { bd = d; start = n; } }
    const prev = { [start]: null }; const q = [start];
    while (q.length) { const n = q.shift(); if (n === goal) break; for (const m of ADJ[n] ?? []) if (ok(m) && !(m in prev)) { prev[m] = n; q.push(m); } }
    const out = []; let n = goal; while (n) { out.unshift(N[n].clone()); n = prev[n]; }
    if (out.length > 1 && out[0].distanceTo(r.pos) < 0.15) out.shift();
    return out;
  }
  const yawTo = (r, v) => Math.atan2(v.x - r.pos.x, v.y - r.pos.y);
  const wp = (o) => { const v = new THREE.Vector3(); o.getWorldPosition(v); return v; };

  // ------------------------------------------------------------ overlay DOM
  const mk = (cls, html = '') => { const d = document.createElement('div'); d.className = cls; d.innerHTML = html; overlay.appendChild(d); return d; };
  roles.forEach((k) => { const r = R[k];
    r.chip = mk('ms-chip', `<span class="ms-dot" style="--c:${r.spec.tag}"></span><b>${r.spec.name}</b><span class="ms-t"></span><span class="ms-bar"><i></i></span>`);
    r.chipT = r.chip.querySelector('.ms-t'); r.chipBar = r.chip.querySelector('.ms-bar i'); r.chipBarWrap = r.chip.querySelector('.ms-bar'); r.lastChip = '';
    r.bubble = mk('ms-bubble', '<span class="ms-typing"><i></i><i></i><i></i></span><span class="ms-text"></span>'); r.bubble.style.setProperty('--bc', r.spec.bubble); r.bubble.style.setProperty('--bt', r.spec.bubbleText);
    r.bubbleText = r.bubble.querySelector('.ms-text'); r.bubbleHide = 0; r.typedAt = 0; });
  let time = 0, speaker = null, speakerUntil = 0;
  function say(r, text, dur, think = false) { r.bubbleText.textContent = text; r.bubble.classList.remove('show', 'typed', 'think'); void r.bubble.offsetWidth; r.bubble.classList.add('show'); if (think) r.bubble.classList.add('think');
    r.typedAt = think ? 1e9 : time + 0.45; r.bubbleHide = time + (dur ?? 1.7 + text.length * 0.045); speaker = r; speakerUntil = r.bubbleHide; }
  const pops = [];
  function pop(anchor, text, cls = '', dy = 0.95, life = 1.6) { const d = mk('ms-pop ' + cls, text); pops.push({ d, anchor, dy, born: time, life, x: (Math.random() - 0.5) * 30 }); }

  // ------------------------------------------------------------ items (hand-to-hand objects)
  const items = [];
  function item(obj, holder) { obj.scale.setScalar(S); scene.add(obj); const it = { obj, holder, from: null, t0: 0, dur: 0.4, arc: 0.2, poof: -1 }; items.push(it); wp(holder).toArray(); return it; }
  function give(it, holder, dur = 0.45, arc = 0.22) { it.from = it.obj.position.clone(); it.t0 = time; it.dur = dur; it.arc = arc; it.holder = holder; it.obj.visible = true; }
  const cardCanvas = document.createElement('canvas'); cardCanvas.width = 256; cardCanvas.height = 200; const cardTex = new THREE.CanvasTexture(cardCanvas); cardTex.colorSpace = THREE.SRGBColorSpace;
  const cardObj = new THREE.Group(); { const b = rbox(0.24, 0.19, 0.012, 0.01, mat('#ffffff')); cardObj.add(b); const f = new THREE.Mesh(new THREE.PlaneGeometry(0.23, 0.18), new THREE.MeshBasicMaterial({ map: cardTex })); f.position.z = 0.007; cardObj.add(f); }
  const card = item(cardObj, Cu.hands[1]); cardObj.visible = false;
  const frameObj = new THREE.Group(); const fm = rbox(0.42, 0.5, 0.04, 0.02, mat('#ffffff')); const fArt = new THREE.Mesh(new THREE.PlaneGeometry(0.34, 0.42), new THREE.MeshBasicMaterial({ color: '#fff' })); fArt.position.z = 0.022; frameObj.add(fm, fArt);
  const canvasIt = item(frameObj, P.props.anchor); frameObj.visible = false; let frameTex = null;

  // ------------------------------------------------------------ fx: coins, splats, droplets
  const coinGeo = new THREE.CylinderGeometry(0.07, 0.07, 0.022, 8); const coinMat = new THREE.MeshStandardMaterial({ color: '#f5c23e', metalness: 0.55, roughness: 0.28, emissive: '#7a5200', emissiveIntensity: 0.15, flatShading: true });
  const coins = Array.from({ length: 18 }, () => { const m = new THREE.Mesh(coinGeo, coinMat); m.castShadow = true; m.visible = false; m.scale.setScalar(S); scene.add(m); return { m, v: new THREE.Vector3(), life: 0, toss: null }; });
  const freeCoin = () => coins.find((c) => !c.m.visible);
  function burstCoins(o) { for (let i = 0; i < 8; i++) { const c = freeCoin(); if (!c) return; c.toss = null; c.m.position.copy(o); c.v.set((Math.random() - 0.5) * 2, 2.4 + Math.random() * 1.4, (Math.random() - 0.5) * 2); c.life = 1.4; c.m.visible = true; c.m.scale.setScalar(S); } }
  function tossCoin(from, to, onArrive) { const c = freeCoin(); if (!c) return; c.m.visible = true; c.m.scale.setScalar(S); c.toss = { p0: wp(from), to, t0: time, d: 0.85, onArrive }; c.life = 9; }
  const splatGeo = new THREE.CircleGeometry(0.04, 7); const decals = []; const drops = []; const floorSplats = [];
  const dropGeo = new THREE.IcosahedronGeometry(0.022, 0);
  for (let i = 0; i < 10; i++) { const m = new THREE.Mesh(splatGeo, new THREE.MeshBasicMaterial({ color: '#fff' })); m.visible = false; easel.add(m); decals.push({ m, t0: -9 }); }
  for (let i = 0; i < 16; i++) { const m = new THREE.Mesh(dropGeo, new THREE.MeshStandardMaterial({ color: '#fff', flatShading: true })); m.visible = false; scene.add(m); drops.push({ m, v: new THREE.Vector3(), on: false }); }
  for (let i = 0; i < 12; i++) { const m = new THREE.Mesh(new THREE.CircleGeometry(0.06, 7), new THREE.MeshBasicMaterial({ color: '#fff', transparent: true })); m.rotation.x = -Math.PI / 2; m.visible = false; scene.add(m); floorSplats.push({ m, t0: -9 }); }
  let splatI = 0, dropI = 0, floorI = 0;
  function splat(color) {
    const d = decals[splatI++ % decals.length]; d.m.material.color.set(color); d.m.position.set((Math.random() - 0.5) * 0.46, 1.03 + (Math.random() - 0.5) * 0.6, 0.095); d.m.rotation.z = Math.random() * 6; d.t0 = time; d.m.visible = true;
    for (let i = 0; i < 2; i++) { const p = drops[dropI++ % drops.length]; p.m.material.color.set(color); p.m.position.copy(wp(d.m)); const fwd = new THREE.Vector3(0, 0, 1).applyQuaternion(easel.getWorldQuaternion(new THREE.Quaternion()));
      p.v.copy(fwd).multiplyScalar(0.8 + Math.random() * 0.6).add(new THREE.Vector3((Math.random() - 0.5) * 0.8, 0.9 + Math.random() * 0.8, (Math.random() - 0.5) * 0.8)); p.on = true; p.m.visible = true; p.m.scale.setScalar(S * (0.7 + Math.random() * 0.6)); p.color = color; }
  }

  // ------------------------------------------------------------ task runner (generators)
  const tasks = []; let frameNo = 0;
  function spawn(gen) { const t = { gen, wait: null, done: false }; tasks.push(t); step(t); return t; }
  function step(t) { for (let guard = 0; guard < 50; guard++) { const { value, done } = t.gen.next(); if (done) { t.done = true; return; }
    if (value === 0) { const f = frameNo; t.wait = () => frameNo > f; } else if (typeof value === 'number') { const u = time + value; t.wait = () => time >= u; } else if (typeof value === 'function') t.wait = value; else t.wait = null;
    if (t.wait && !t.wait()) return; } }
  function runTasks() { for (const t of tasks.slice()) if (!t.done && (!t.wait || t.wait())) step(t); for (let i = tasks.length - 1; i >= 0; i--) if (tasks[i].done) tasks.splice(i, 1); }
  const later = (s, fn) => spawn((function* () { yield s; fn(); })());

  function* walk(r, dest, endYaw = null) { r.path = route(r, dest); r.endYaw = endYaw; yield () => r.path.length === 0 && Math.abs(angDiff(r.yaw, r.yawT)) < 0.25; }
  function* walkHome(r) { r.look = null; yield* walk(r, 'home', r.homeYaw); }
  function face(a, b) { a.yawT = yawTo(a, b.pos); b.yawT = yawTo(b, a.pos); a.look = b.headTop; b.look = a.headTop; }
  const setPose = (r, p) => { r.pose = p; r.poseT0 = time; };
  const hop = (r, h = 0.16) => { r.hopT = time; r.hopH = h; r.lastHop = time; };
  function claim(r) { r.busy = true; setPose(r, 'idle'); r.lookAround = false; r.squintT = 0; r.look = null; handMug.visible = false; K.props.mug.visible = true; }
  function release(r) { r.busy = false; r.look = null; setPose(r, 'idle'); r.status = idleStatus[r.k]; r.progress = null; r.nextIdle = time + 2 + Math.random() * 3; r.yawT = r.homeYaw; }

  // ------------------------------------------------------------ idle bits
  function* idleWait(r, s) { const u = time + s; yield () => r.busy || time >= u; }
  function* idle(r) {
    while (true) {
      yield () => !r.busy && time > r.nextIdle && r.path.length === 0;
      const opts = ['wave', 'yawn', 'look', 'look']; if (r === K) opts.push('sip', 'sip'); if (r === Se) opts.push('wave');
      const pick = opts[Math.floor(Math.random() * opts.length)];
      if (pick === 'wave') { r.look = 'camera'; setPose(r, 'wave'); if (!(speaker && time < speakerUntil)) say(r, ['Hi there!', 'Hello!', 'Welcome in!'][Math.floor(Math.random() * 3)], 1.4); yield* idleWait(r, 1.6); }
      if (pick === 'yawn') { setPose(r, 'yawn'); r.squintT = 1; if (!(speaker && time < speakerUntil)) say(r, '*yaaawn*', 1.5); yield* idleWait(r, 1.7); r.squintT = 0; }
      if (pick === 'look') { r.lookAround = true; yield* idleWait(r, 2.2); r.lookAround = false; }
      if (pick === 'sip') { K.props.mug.visible = false; handMug.visible = true; setPose(r, 'sip'); r.squintT = 0.6; yield* idleWait(r, 1.8); handMug.visible = false; K.props.mug.visible = true; r.squintT = 0; }
      if (!r.busy) { setPose(r, 'idle'); r.look = null; }
      r.nextIdle = time + 3.5 + Math.random() * 4;
    }
  }
  roles.forEach((k) => spawn(idle(R[k])));

  // ------------------------------------------------------------ story (every beat waits for a real chain event)
  const D = cfg.director;
  const SCENE_KIND = { sea: 'sea', peaks: 'peaks', hills: 'hills', city: 'dunes', cosmos: 'peaks', bloom: 'hills' };
  const hashStr = (s) => { let h = 7; for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0; return h % 997; };
  const short = (s, n = 22) => (s.length > n ? s.slice(0, n - 1) + '\u2026' : s);
  function themeFrom(tr) { const p = tr.palette; if (!p) return { ...THEMES[hashStr(tr.name) % THEMES.length], name: tr.name }; return { name: tr.name, sky: [p.sky[0], p.sky[1]], sun: p.sun, layers: p.layers, kind: SCENE_KIND[tr.scene] || 'hills' }; }
  function drawCard(th) { const c = cardCanvas.getContext('2d'); c.fillStyle = '#fff'; c.fillRect(0, 0, 256, 200); const g = c.createLinearGradient(0, 0, 256, 0); th.sky.forEach((s, i) => g.addColorStop(i / (th.sky.length - 1), s)); c.fillStyle = g; c.fillRect(0, 0, 256, 70);
    c.fillStyle = '#13243F'; c.font = '800 30px system-ui, sans-serif'; c.fillText('TREND', 16, 108); c.font = '600 22px system-ui, sans-serif'; c.fillText(short(th.name, 18), 16, 142); th.layers.forEach((s, i) => { c.fillStyle = s; c.beginPath(); c.arc(28 + i * 34, 176, 12, 0, 7); c.fill(); }); cardTex.needsUpdate = true; }
  let peekTask = null;
  function* allHome() {
    if (peekTask) peekTask.done = true;
    for (const r of [Cu, P, K, Se]) { r.lookAround = false; r.tiltT = 0; r.squintT = 0; if (r.pose !== 'idle') setPose(r, 'idle'); spawn((function* () { yield* walkHome(r); release(r); })()); }
    yield () => roles.every((k) => R[k].path.length === 0);
  }
  function* wrapUp(say1) {
    card.obj.visible = false; if (canvasIt.obj.visible && canvasIt.poof < 0) canvasIt.poof = time; magnifier.visible = false; K.props.paddle.visible = false; ctx.painting.blank();
    if (say1) { say(Cu, say1, 2.4); Cu.look = 'camera'; }
    yield 0.8; yield* allHome(); yield 0.6;
  }
  const stopped = (cyc) => cyc.failed || cyc.interrupted;
  function* story() {
    cycleLoop: while (true) {
      let cyc = null; yield () => !!(cyc = D.next());
      cfg.onCycle?.(cyc);
      flip.rotation.y = 0; flipT = -9;
      const cards = Cu.props.cards; cards.forEach((cd, i) => { cd.visible = i < 2; cd.scale.setScalar(1); });
      // Beat 1 — Curator reads live trends (pins cards) until the chain confirms the job
      claim(Cu); Cu.status = cyc.mode === 'replay' ? 'Replaying job #' + cyc.jobId : 'Reading live trends'; Cu.progress = 0; Cu.yawT = Cu.homeYaw + 0.55; Cu.look = Cu.props.focus;
      let pins = 0;
      while (pins < 3 || (cyc.get('trend') === undefined && !stopped(cyc))) {
        if (pins < 3) { setPose(Cu, 'pin'); yield 0.45; const nx = cards.find((x) => !x.visible); if (nx) { nx.visible = true; nx.scale.setScalar(0.01); } hop(Cu, 0.12); pins++; Cu.progress = Math.min(0.9, pins / 4); yield 0.6; }
        else { setPose(Cu, 'idle'); Cu.status = 'Picking a trend'; Cu.lookAround = true; yield 1.1; Cu.lookAround = false; Cu.tiltT = 0.25; Cu.nodT = time; yield 0.7; Cu.tiltT = 0; }
      }
      Cu.progress = null;
      if (stopped(cyc)) { setPose(Cu, 'idle'); yield* wrapUp(cyc.failed ? cyc.failed.line : null); continue cycleLoop; }
      const tr = cyc.get('trend'); const th = themeFrom(tr); ctx.painting.start(th, 17 + hashStr(tr.name)); drawCard(th);
      Cu.yawT = Cu.homeYaw; Cu.look = 'camera'; setPose(Cu, 'thumbs'); say(Cu, short(tr.line || `${tr.name} is trending!`, 34)); Cu.status = 'Trend: ' + short(tr.name.toLowerCase(), 18); yield 1.9;
      // Beat 2 — Curator walks the trend card over to the Painter
      card.obj.visible = true; card.holder = Cu.hands[1]; card.from = null; card.obj.scale.setScalar(S * 1.3); setPose(Cu, 'holdCard'); Cu.status = 'Delivering the brief';
      claim(P); P.status = 'Waiting for a brief';
      yield* walk(Cu, cfg.visitOf.painter); face(Cu, P); yield 0.3;
      say(Cu, "Here's the brief!"); setPose(Cu, 'give1'); yield 0.35; setPose(P, 'give1'); yield 0.35; give(card, P.hands[1], 0.4, 0.12); yield 0.45;
      setPose(Cu, 'idle'); hop(P, 0.12); say(P, 'On it, painting now'); yield 0.5; give(card, cardSpot, 0.5, 0.25); setPose(P, 'idle');
      // Beat 3 — Painter paints; the real artwork (from IPFS) is revealed stroke by stroke
      peekTask = spawn(curatorPeek(tr.name));
      P.yawT = P.homeYaw + 0.45; P.look = P.props.anchor; yield 0.35; setPose(P, 'paint'); P.status = 'Painting'; P.progress = 0;
      const t0 = time; let nextSplat = time, swapped = false, revealT0 = 0, revealFrom = 0, revealDur = 3.6;
      while (true) {
        if (stopped(cyc)) break;
        const art = cyc.get('art');
        if (art && !swapped) { if (art.img) ctx.painting.setFinal(art.img); swapped = true; revealT0 = time; revealFrom = ctx.painting.frac(); revealDur = Math.max(3.4, 6.4 - (time - t0)); }
        const p = swapped ? revealFrom + (1 - revealFrom) * Math.min(1, (time - revealT0) / revealDur) : Math.min(0.1, (time - t0) / 8);
        ctx.painting.progress(p); P.progress = swapped ? 0.5 + p * 0.5 : Math.min(0.45, (time - t0) / 30);
        if (time >= nextSplat) { splat(th.layers[Math.floor(Math.random() * th.layers.length)]); nextSplat = time + 0.32 + Math.random() * 0.25; }
        if (swapped && p >= 1) break;
        yield 0;
      }
      P.progress = null;
      if (stopped(cyc)) { yield* wrapUp(cyc.failed ? cyc.failed.line : null); continue cycleLoop; }
      ctx.painting.progress(1);
      setPose(P, 'yay'); P.squintT = 1; P.look = 'camera'; P.yawT = P.homeYaw; hop(P, 0.2); say(P, 'Done! Isn\u2019t it lovely?'); P.status = 'Pinned to IPFS'; pop(P.headTop, '\u2726', 'fx', 0.4); later(0.3, () => pop(P.headTop, '\u2726', 'fx', 0.5)); yield 1.4; P.squintT = 0;
      cfg.onBeat?.('painted', cyc);
      // Beat 4 — Painter carries the canvas to the Critic
      frameTex?.dispose(); frameTex = ctx.painting.snapshotTexture(); fArt.material.map = frameTex; fArt.material.needsUpdate = true;
      canvasIt.obj.visible = true; canvasIt.poof = -1; canvasIt.holder = P.props.anchor; canvasIt.from = null; canvasIt.obj.scale.setScalar(S * 1.12); updateItems(0); ctx.painting.blank();
      P.yawT = P.homeYaw + 0.45; give(canvasIt, P.carry, 0.4, 0.15); setPose(P, 'carry'); P.status = 'Delivering art'; yield 0.45;
      claim(K); K.status = 'Waiting for art'; K.look = P.headTop;
      yield* walk(P, cfg.visitOf.critic); face(P, K); setPose(K, 'carry'); yield 0.3; say(P, 'Fresh off the easel!'); give(canvasIt, K.carry, 0.45, 0.12); yield 0.55;
      setPose(P, 'idle'); spawn((function* () { yield 0.2; yield* walkHome(P); release(P); })());
      // Beat 5 — Critic inspects until the on-chain review lands
      K.yawT = K.homeYaw + 0.5; yield 0.35; give(canvasIt, K.props.anchor, 0.45, 0.15); yield 0.3; setPose(K, 'idle'); K.look = canvasIt.obj; K.status = 'Reviewing'; K.progress = 0;
      K.tiltT = 0.32; say(K, '', 1.3, true); yield 1.0; K.progress = 0.3;
      let looks = 0;
      while (looks < 1 || (cyc.get('review') === undefined && !stopped(cyc))) {
        magnifier.visible = true; setPose(K, 'magnify'); K.tiltT = -0.28; yield 0.8; K.tiltT = 0.25; yield 0.8; looks++; K.progress = Math.min(0.95, 0.3 + looks * 0.2);
        if (looks > 1) { magnifier.visible = false; setPose(K, 'idle'); say(K, '', 1.2, true); yield 1.0; }
      }
      K.progress = null; K.tiltT = 0; magnifier.visible = false;
      if (stopped(cyc)) { setPose(K, 'idle'); yield* wrapUp(cyc.failed ? cyc.failed.line : null); continue cycleLoop; }
      const rv = cyc.get('review'); const sc = (rv.score / 10).toFixed(1);
      ctxScore(sc); K.yawT = K.homeYaw; K.look = 'camera'; K.props.paddle.visible = true; setPose(K, 'score'); hop(K, 0.15); K.status = 'Scored ' + sc;
      if (rv.approved) { say(K, `${sc}/10. ${short(rv.line || 'A keeper!', 20)}`); [0, 0.25, 0.5].forEach((d, i) => later(d, () => pop(K.headTop, i === 1 ? '\u2726' : '\u2665', 'heart', 0.35))); }
      else { say(K, `${sc}/10. Not good enough`); pop(K.headTop, '\u2715 below ' + (cyc.threshold / 10).toFixed(1), 'fx', 0.35); }
      cfg.onBeat?.('reviewed', cyc);
      yield 2.0; K.props.paddle.visible = false; setPose(K, 'idle');
      if (!rv.approved) {
        // Rejected: nothing is minted. The canvas goes in the bin and the swarm moves on.
        K.yawT = K.homeYaw + 0.5; yield 0.3; canvasIt.poof = time; K.squintT = 0.6; say(K, 'Back to the drawing board', 1.8); yield 1.4; K.squintT = 0;
        yield* wrapUp('On to the next trend!'); continue cycleLoop;
      }
      // Beat 6 — Critic hands the minted work to the Seller
      K.yawT = K.homeYaw + 0.5; yield 0.25; give(canvasIt, K.carry, 0.4, 0.15); setPose(K, 'carry'); K.status = 'Minted \u00b7 delivering'; yield 0.45;
      claim(Se); Se.look = K.headTop; Se.status = 'Waiting for art';
      yield* walk(K, cfg.visitOf.seller); face(K, Se); setPose(Se, 'carry'); yield 0.3; say(K, 'Minted! Sell it!'); give(canvasIt, Se.carry, 0.45, 0.12); yield 0.55;
      setPose(K, 'idle'); spawn((function* () { yield 0.2; yield* walkHome(K); release(K); })());
      // Beat 7 — Seller hangs it, prices it inside the owner's rules, lists it on-chain
      Se.yawT = Se.homeYaw + 0.55; Se.look = display; yield 0.4; setPose(Se, 'place'); give(canvasIt, display, 0.5, 0.2); yield 0.55; setPose(Se, 'idle');
      Se.look = 'camera'; Se.yawT = Se.homeYaw; Se.status = 'Pricing'; Se.progress = 0;
      const l0 = time; while (time - l0 < 1.6 || (cyc.get('listing') === undefined && !stopped(cyc))) { Se.progress = Math.min(0.95, (time - l0) / 4); yield 0; }
      Se.progress = null;
      if (stopped(cyc)) { yield* wrapUp(cyc.failed ? cyc.failed.line : null); continue cycleLoop; }
      const li = cyc.get('listing');
      say(Se, `Listed for ${li.price} NEAR`); Se.status = 'Listed \u00b7 ' + li.price + ' NEAR';
      cfg.onArtwork?.({ img: cyc.get('art').url, title: cyc.get('art').title, price: li.price, status: 'listed', tokenId: li.tokenId, jobId: cyc.jobId, live: cyc.mode !== 'replay' });
      cfg.onBeat?.('listed', cyc);
      yield 1.2;
      // Beat 8 — Seller rings the bell until someone buys (wallet or demo collector) or the wait ends
      let rings = 0;
      while (cyc.get('sale') === undefined && !stopped(cyc)) {
        Se.yawT = Se.homeYaw + 0.55; Se.look = bell; yield 0.3; setPose(Se, 'tap'); yield 0.15; bellT = time; pop(bell, 'ding!', 'fx', 0.25); yield 0.4; setPose(Se, 'idle');
        Se.look = 'camera'; Se.yawT = Se.homeYaw; if (rings++ % 2 === 0) say(Se, rings < 2 ? 'Fresh art! Who wants it?' : 'Collect it with your wallet!', 1.8);
        const w0 = time; yield () => time - w0 > 2.6 || cyc.get('sale') !== undefined || stopped(cyc);
      }
      const sale = cyc.get('sale');
      if (!sale || sale.none) {
        say(Se, 'In the gallery now. Collect anytime!', 2.4); yield 2.6; yield* wrapUp(null); continue cycleLoop;
      }
      Se.yawT = Se.homeYaw + 0.55; Se.look = bell; yield 0.3; setPose(Se, 'tap'); yield 0.15; bellT = time; pop(bell, 'ding!', 'fx', 0.25); yield 0.25; bellT = time; yield 0.4; setPose(Se, 'idle');
      flipT = time; yield 0.5; Se.look = 'camera'; Se.yawT = Se.homeYaw; hop(Se, 0.18); say(Se, `Sold to ${short(sale.buyer, 16)}!`, 2.0); Se.status = `Sold \u00b7 ${li.price} NEAR`;
      canvasIt.poof = time; burstCoins(wp(Se.props.coinOrigin)); Se.props.jarCoins.scale.y = Math.min(1, Se.props.jarCoins.scale.y + 0.12);
      cfg.onSale?.({ price: li.price, title: cyc.get('art').title, buyer: sale.buyer, hash: sale.hash });
      yield 0.9;
      // Beat 9 — the on-chain split: Seller tosses each robot its real share
      for (const k of ['painter', 'critic', 'curator']) {
        const r = R[k]; yield () => r.path.length === 0; Se.yawT = yawTo(Se, r.pos); Se.look = r.headTop; yield 0.3;
        setPose(Se, 'toss'); if (!r.busy) { r.look = Se.headTop; setPose(r, 'catch'); } r.yawT = yawTo(r, Se.pos);
        tossCoin(Se.hands[1], r.hands[1], () => { pop(r.headTop, `+${sale.shares[k]} NEAR`, '', 0.35); hop(r, 0.14); later(0.4, () => { if (r.pose === 'catch') setPose(r, 'idle'); if (!r.busy) { r.yawT = r.homeYaw; r.look = null; } }); });
        yield 0.5; setPose(Se, 'idle');
      }
      Se.yawT = Se.homeYaw; Se.look = 'camera'; yield 0.6; pop(Se.headTop, `+${sale.shares.seller} NEAR`, '', 0.35); hop(Se, 0.12); yield 0.5;
      pop(Se.headTop, `Owner +${sale.shares.owner}`, 'fx', 0.75); yield 0.7;
      // Beat 10 — happy dance, then the Curator high-fives the Seller
      for (const k of roles) { const r = R[k]; if (r.path.length) continue; if (!r.busy) claim(r); setPose(r, 'dance'); r.squintT = 0.8; r.look = 'camera'; r.yawT = r.homeYaw; }
      yield 1.9; for (const k of roles) { const r = R[k]; if (r.pose === 'dance') { setPose(r, 'idle'); r.squintT = 0; } }
      [P, K].forEach((r) => { if (r.busy && r.path.length === 0) release(r); });
      if (peekTask) peekTask.done = true;
      claim(Cu); Cu.status = 'High five!'; yield* walk(Cu, cfg.visitOf.seller); face(Cu, Se); yield 0.25;
      setPose(Cu, 'highfive'); setPose(Se, 'highfive'); yield 0.4; pop(Se.headTop, 'high five!', 'fx', 0.2); hop(Cu, 0.2); hop(Se, 0.2); yield 0.7;
      setPose(Cu, 'idle'); setPose(Se, 'idle'); say(Cu, 'On to the next trend!'); yield 1.2; release(Se);
      card.obj.visible = false; yield* walkHome(Cu); release(Cu);
    }
  }
  function* curatorPeek(name) {
    yield 1.0; Cu.status = 'Checking in'; yield* walk(Cu, cfg.nodes.peek ? 'peek' : cfg.visitOf.painter);
    Cu.yawT = Math.atan2(wp(P.props.anchor).x - Cu.pos.x, wp(P.props.anchor).z - Cu.pos.y); Cu.look = P.props.anchor; yield 1.8;
    setPose(Cu, 'thumbs'); Cu.nodT = time; say(Cu, 'Ooh, love that palette'); yield 1.5; setPose(Cu, 'idle');
    Cu.status = 'Wandering'; yield* walk(Cu, 'hub'); Cu.lookAround = true; yield 1.3; Cu.lookAround = false;
    yield* walkHome(Cu); release(Cu); Cu.status = 'Trend: ' + short(name.toLowerCase(), 18);
  }
  function ctxScore(score) { const c = ctx.scoreCanvas?.getContext('2d'); if (!c) return; c.fillStyle = '#ffffff'; c.fillRect(0, 0, 256, 192); c.fillStyle = '#13243F'; c.textAlign = 'center'; c.font = '800 96px system-ui, sans-serif'; c.fillText(score, 128, 112); c.font = '600 28px system-ui, sans-serif'; c.fillStyle = '#8a8f98'; c.fillText('/ 10', 128, 158); ctx.scoreTex.needsUpdate = true; }
  let bellT = -9, flipT = -9;

  // ------------------------------------------------------------ per-frame updates
  function armTargets(r) {
    const t = time - r.poseT0, w = r.walkAmt, sw = Math.sin(r.walkPh) * 0.6 * w, id = Math.sin(time * 1.6 + r.phase) * 0.05 * (1 - w);
    let lx = sw + id, lz = -0.12 - 0.1 * w, rx = -sw - id, rz = 0.12 + 0.1 * w;
    switch (r.pose) {
      case 'holdCard': rx = -0.9 + Math.sin(r.walkPh * 2) * 0.05; rz = 0.15; break;
      case 'give1': rx = -1.45; rz = -0.12; break;
      case 'carry': lx = rx = -1.2 + Math.sin(r.walkPh * 2) * 0.06 * w; lz = 0.24; rz = -0.24; break;
      case 'pin': { const c = Math.sin(clamp(t / 0.9) * Math.PI); rz = 0.35 + c * 1.2; rx = -0.4 - c * 0.6; break; }
      case 'paint': rz = 0.95 + Math.sin(time * 6) * 0.15; rx = -0.7 - Math.max(0, Math.sin(time * 13)) * 0.42; lz = -0.5; lx = -0.6; break;
      case 'yay': lz = -2.5 + Math.sin(time * 16) * 0.2; rz = 2.5 - Math.sin(time * 16) * 0.2; lx = rx = -0.2; break;
      case 'thumbs': rx = -2.0 + Math.sin(time * 10) * 0.12; rz = 0.15; break;
      case 'wave': rz = 2.55 + Math.sin(time * 13) * 0.35; rx = -0.2; break;
      case 'yawn': lz = -2.85; rz = 2.85; lx = rx = 0.1; break;
      case 'sip': rx = -2.15; rz = -0.5; break;
      case 'magnify': rx = -1.35 + Math.sin(time * 3) * 0.1; rz = -0.12; lx = -0.5; lz = 0.1; break;
      case 'score': lz = -2.55 + Math.abs(Math.sin(time * 7)) * 0.14; lx = -0.25; break;
      case 'catch': rz = 2.2; rx = -0.6; break;
      case 'toss': { const u = clamp(t / 0.3); rx = lerp(0.7, -1.7, smooth(u)); rz = 0.1; break; }
      case 'place': lx = rx = -1.4; lz = 0.2; rz = -0.2; break;
      case 'tap': rx = -1.1 - Math.max(0, Math.sin(t * 16)) * 0.4; rz = 0.45; break;
      case 'highfive': rx = -2.55; rz = 0.2; break;
      case 'dance': lz = -2.2 + Math.sin(time * 9) * 0.6; rz = 2.2 + Math.sin(time * 9) * 0.6; lx = rx = -0.3; break;
    }
    return [lx, lz, rx, rz];
  }
  const tv = new THREE.Vector3();
  function updateRobot(r, dt) {
    let moving = false;
    if (r.path.length) { const p = r.path[0]; const dx = p.x - r.pos.x, dz = p.y - r.pos.y, d = Math.hypot(dx, dz);
      if (d < 0.06) { r.path.shift(); if (!r.path.length && r.endYaw != null) r.yawT = r.endYaw; }
      else { r.yawT = Math.atan2(dx, dz); const al = Math.max(0, Math.cos(angDiff(r.yaw, r.yawT))); const st = Math.min(d, r.speed * dt * al * al); r.pos.x += (dx / d) * st; r.pos.y += (dz / d) * st; moving = st > 1e-4; } }
    if (moving) for (const k of roles) { const o = R[k]; if (o === r) continue; const dx = r.pos.x - o.pos.x, dz = r.pos.y - o.pos.y, d = Math.hypot(dx, dz); if (d < 0.7 && d > 1e-4) { const push = (0.7 - d) * 0.35; r.pos.x += (dx / d) * push; r.pos.y += (dz / d) * push; } }
    r.yaw += angDiff(r.yaw, r.yawT) * (1 - Math.exp(-9 * dt));
    r.walkAmt = damp(r.walkAmt, moving ? 1 : 0, 10, dt); if (moving) r.walkPh += dt * r.speed * 7.2;
    const w = r.walkAmt, ph = r.walkPh;
    r.root.position.set(r.pos.x, 0, r.pos.y);
    r.legs[-1].rotation.x = Math.sin(ph) * 0.75 * w; r.legs[1].rotation.x = -Math.sin(ph) * 0.75 * w;
    if (r.pose === 'dance' && time - r.lastHop > 0.62) hop(r, 0.13);
    let hopY = 0, sq = 0; const ht = (time - r.hopT) / 0.55;
    if (ht >= 0 && ht < 1) { if (ht < 0.2) sq = -0.14 * Math.sin((ht / 0.2) * Math.PI); else { const u = (ht - 0.2) / 0.8; hopY = Math.sin(u * Math.PI) * r.hopH; sq = 0.1 * Math.sin(u * Math.PI); if (u > 0.85) sq -= 0.12 * Math.sin(((u - 0.85) / 0.15) * Math.PI); } }
    const squash = -Math.cos(ph * 2) * 0.06 * w + sq;
    r.body.position.y = Math.sin(time * 2.2 + r.phase) * 0.018 * (1 - w) + Math.abs(Math.sin(ph)) * 0.1 * w + hopY;
    r.body.scale.set(1 - squash * 0.5, 1 + squash, 1 - squash * 0.5);
    r.body.rotation.z = Math.sin(ph) * 0.07 * w + (r.pose === 'yay' ? Math.sin(time * 15) * 0.13 : 0) + (r.pose === 'dance' ? Math.sin(time * 4.5) * 0.12 : 0);
    r.body.rotation.x = 0.1 * w;
    r.extraYaw = damp(r.extraYaw, r.pose === 'dance' ? Math.sin(time * 4.5) * 0.7 : 0, 8, dt);
    r.root.rotation.y = r.yaw + r.extraYaw;
    const [lx, lz, rx, rz] = armTargets(r);
    r.arms[-1].rotation.x = damp(r.arms[-1].rotation.x, lx, 11, dt); r.arms[-1].rotation.z = damp(r.arms[-1].rotation.z, lz, 11, dt);
    r.arms[1].rotation.x = damp(r.arms[1].rotation.x, rx, 11, dt); r.arms[1].rotation.z = damp(r.arms[1].rotation.z, rz, 11, dt);
    // head
    let yawT = 0, pitchT = 0, tgt = null; const talking = speaker === r && time < speakerUntil;
    if (r.lookAround) { yawT = Math.sin(time * 1.9) * 0.95; pitchT = -0.1; }
    else if (r.look === 'camera') tgt = camera.position;
    else if (r.look && r.look.isObject3D) tgt = wp(r.look);
    else if (!r.busy && speaker && speaker !== r && time < speakerUntil) tgt = wp(speaker.headTop);
    else if (talking) tgt = camera.position;
    else if (w > 0.5) { yawT = 0; pitchT = 0.05; }
    else { yawT = Math.sin(time * 0.35 + r.phase) * 0.35; pitchT = Math.sin(time * 0.5 + r.phase) * 0.08; }
    const soft = !r.busy && r.look == null && !talking ? 0.6 : 1;
    if (tgt) { tv.copy(tgt); r.root.worldToLocal(tv); yawT = clamp(Math.atan2(tv.x, tv.z), -1.2, 1.2) * soft; pitchT = clamp(Math.atan2(1.1 - tv.y, Math.hypot(tv.x, tv.z)) * 0.7, -0.4, 0.45); }
    if (r.pose === 'yawn') pitchT = -0.4; if (r.pose === 'sip') pitchT = -0.3;
    const nt = time - r.nodT; if (nt >= 0 && nt < 0.8) pitchT += Math.sin(nt * 18) * 0.28;
    r.hY = damp(r.hY, yawT, 7, dt); r.hP = damp(r.hP, pitchT, 7, dt); r.tilt = damp(r.tilt, r.tiltT + (talking ? Math.sin(time * 6) * 0.07 : 0), 7, dt);
    r.head.rotation.set(r.hP, r.hY, r.tilt, 'YXZ');
    r.blinkT -= dt; const bl = r.blinkT < 0.12 && r.blinkT > 0 ? 0.15 : 1; if (r.blinkT < 0) r.blinkT = 2 + Math.random() * 3.5;
    r.squint = damp(r.squint, r.squintT, 8, dt); r.eyes.forEach((e) => (e.scale.y = 1.35 * bl * (1 - 0.72 * r.squint)));
    r.ballM.emissiveIntensity = 0.35 + (talking ? 0.9 + Math.sin(time * 12) * 0.4 : 0.15 * Math.sin(time * 2 + r.phase));
  }
  function updateItems() {
    for (const it of items) { if (!it.obj.visible) continue;
      if (it.poof >= 0) { const p = clamp((time - it.poof) / 0.7); it.obj.position.y += 0.02; it.obj.scale.setScalar(S * 1.12 * (1 - smooth(p))); it.obj.rotation.y += 0.25; if (p >= 1) { it.obj.visible = false; it.poof = -1; } continue; }
      const h = wp(it.holder);
      if (it.from) { const p = clamp((time - it.t0) / it.dur); it.obj.position.lerpVectors(it.from, h, smooth(p)); it.obj.position.y += Math.sin(p * Math.PI) * it.arc; if (p >= 1) it.from = null; } else it.obj.position.copy(h);
      it.obj.lookAt(camera.position.x, it.obj.position.y, camera.position.z);
    }
  }
  function updateFx(dt) {
    for (const c of coins) { if (!c.m.visible) continue;
      if (c.toss) { const u = clamp((time - c.toss.t0) / c.toss.d); const to = wp(c.toss.to); c.m.position.lerpVectors(c.toss.p0, to, u); c.m.position.y += Math.sin(u * Math.PI) * 1.3; c.m.rotation.x += dt * 14;
        if (u >= 1) { c.m.visible = false; const f = c.toss.onArrive; c.toss = null; f?.(); } continue; }
      c.life -= dt; c.v.y -= 7 * dt; c.m.position.addScaledVector(c.v, dt); if (c.m.position.y < 0.06) { c.m.position.y = 0.06; c.v.y *= -0.35; c.v.x *= 0.6; c.v.z *= 0.6; }
      c.m.rotation.x += dt * 9; c.m.rotation.z += dt * 5; if (c.life < 0.3) c.m.scale.setScalar(S * Math.max(0.01, c.life / 0.3)); if (c.life <= 0) c.m.visible = false; }
    for (const d of decals) { if (!d.m.visible) continue; const t = time - d.t0; const s = t < 0.12 ? t / 0.12 * 1.3 : t < 0.25 ? 1.3 - (t - 0.12) / 0.13 * 0.3 : t > 0.9 ? Math.max(0, 1 - (t - 0.9) / 0.4) : 1; d.m.scale.setScalar(Math.max(0.01, s)); if (t > 1.3) d.m.visible = false; }
    for (const p of drops) { if (!p.on) continue; p.v.y -= 6.5 * dt; p.m.position.addScaledVector(p.v, dt); if (p.m.position.y < 0.07) { p.on = false; p.m.visible = false; const f = floorSplats[floorI++ % floorSplats.length]; f.m.material.color.set(p.color); f.m.position.set(p.m.position.x, 0.062, p.m.position.z); f.t0 = time; f.m.visible = true; } }
    for (const f of floorSplats) { if (!f.m.visible) continue; const t = time - f.t0; f.m.scale.setScalar(Math.min(1, t * 8) * S * (t > 2 ? Math.max(0.01, 1 - (t - 2) / 1) : 1)); if (t > 3) f.m.visible = false; }
    const bt = time - bellT; bell.rotation.z = bt < 1.2 ? Math.sin(bt * 32) * 0.35 * Math.exp(-bt * 4) : 0;
    flip.rotation.y = flipT > 0 ? Math.PI * smooth(clamp((time - flipT) / 0.5)) : 0;
    Cu.props.cards.forEach((cd) => { if (cd.visible && cd.scale.x < 1) cd.scale.setScalar(Math.min(1, cd.scale.x + dt * 5)); });
  }
  // camera
  const mouse = { x: 0, y: 0, tx: 0, ty: 0 }; let focus = 0, focusT = 0, W = 1, H = 1;
  addEventListener('pointermove', (e) => { mouse.tx = (e.clientX / innerWidth - 0.5) * 2; mouse.ty = (e.clientY / innerHeight - 0.5) * 2; }, { passive: true });
  function resize() { W = container.clientWidth; H = container.clientHeight; renderer.setSize(W, H, false); camera.aspect = W / H; camera.updateProjectionMatrix(); }
  new ResizeObserver(resize).observe(container); resize();
  function updateCamera(dt) {
    mouse.x = damp(mouse.x, mouse.tx, 2.5, dt); mouse.y = damp(mouse.y, mouse.ty, 2.5, dt); focus = damp(focus, focusT, 2.2, dt);
    const az = C.azimuth + Math.sin(time * 0.08) * (C.orbitAmp ?? 0.1) + mouse.x * (C.parallax ?? 0.07), el = C.elevation - mouse.y * 0.035 - 0.05 * focus, rad = lerp(C.radius, C.focusRadius, focus);
    camera.position.set(target.x + rad * Math.cos(el) * Math.sin(az), target.y + rad * Math.sin(el), target.z + rad * Math.cos(el) * Math.cos(az)); camera.lookAt(target);
    const vs = cfg.viewShift(W, H); const ox = vs.x * W * (1 - focus), oy = vs.y * H * (1 - focus);
    if (Math.abs(ox) > 0.5 || Math.abs(oy) > 0.5) camera.setViewOffset(W, H, -ox, -oy, W, H); else camera.clearViewOffset(); camera.updateMatrixWorld();
  }
  const pv = new THREE.Vector3();
  function place(v, el, extra = '') { v.project(camera); el.style.transform = `translate3d(${((v.x * 0.5 + 0.5) * W).toFixed(1)}px, ${((-v.y * 0.5 + 0.5) * H).toFixed(1)}px, 0)${extra}`; }
  function updateOverlay() {
    for (const k of roles) { const r = R[k];
      pv.copy(wp(r.headTop)); pv.y += 0.42 * S; place(pv.clone(), r.chip); place(pv, r.bubble);
      const s = r.status + (r.progress != null ? ` ${Math.round(r.progress * 100)}%` : ''); if (s !== r.lastChip) { r.chipT.textContent = s; r.lastChip = s; }
      r.chipBarWrap.style.display = r.progress != null ? '' : 'none'; if (r.progress != null) r.chipBar.style.width = (r.progress * 100).toFixed(0) + '%';
      r.chip.classList.toggle('active', r.busy);
      if (r.bubble.classList.contains('show')) { if (time > r.typedAt) r.bubble.classList.add('typed'); if (time > r.bubbleHide) r.bubble.classList.remove('show'); } }
    for (let i = pops.length - 1; i >= 0; i--) { const o = pops[i]; const age = time - o.born; if (age > o.life) { o.d.remove(); pops.splice(i, 1); continue; } pv.copy(wp(o.anchor)); pv.y += o.dy + age * 0.45; place(pv, o.d, ` translateX(${o.x}px)`); }
  }
  function logic(dt) { time += dt; frameNo++; runTasks(); for (const k of roles) updateRobot(R[k], dt); scene.updateMatrixWorld(); updateItems(); updateFx(dt); updateCamera(dt); updateOverlay(); }

  // boot
  window.__ms = { R, get time() { return time; }, step(s) { for (let i = 0; i < s * 30; i++) logic(1 / 30); } }; spawn(story());
  const q = new URLSearchParams(location.search); const warp = parseFloat(q.get('warp')) || 0; const speed = parseFloat(q.get('speed')) || 1;
  for (let i = 0; i < warp * 30; i++) logic(1 / 30);
  let last = performance.now(), started = false;
  function frame(now) { const dt = Math.max(0, Math.min(0.05, (now - last) / 1000)) * speed; last = now; logic(dt); renderer.render(scene, camera); if (!started) { started = true; cfg.onReady?.(); } requestAnimationFrame(frame); }
  requestAnimationFrame(frame);
  return { setFocus(v) { focusT = v ? 1 : 0; } };
}
