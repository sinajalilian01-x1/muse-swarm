 
// The Director turns real chain events into the studio's story.
//   live:   this visitor pressed "Run a real cycle"; each beat waits for that robot's on-chain tx
//   watch:  another visitor's job is active on-chain; we poll the contract and follow it
//   replay: nothing is running; we replay recent real jobs from the contract (real trend, art, score, price, buyer)
const YOCTO = 10n ** 24n;
export const toNear = (y, d = 3) => { const v = BigInt(String(y || '0')); const w = v / YOCTO; const f = (v % YOCTO).toString().padStart(24, '0').slice(0, d); return `${w}.${f}`.replace(/\.?0+$/, '') || '0'; };
export const PALETTES = {
  'Coral Dusk': { sky: ['#FF9E7A', '#FFE3B3'], sun: '#FFF6DA', layers: ['#4C7FB5', '#35659A', '#22497A', '#173560'] },
  'Mint Lagoon': { sky: ['#9FE3CF', '#F1FFF8'], sun: '#FFFDF0', layers: ['#4DC2B4', '#2F9F95', '#1C7772', '#13524F'] },
  'Lemon Grove': { sky: ['#FFE07A', '#FFF9E0'], sun: '#FFFFFF', layers: ['#A6D277', '#7CB653', '#56913B', '#3A6A2A'] },
  'Alpine Dawn': { sky: ['#FFB8A0', '#FFF0E0'], sun: '#FFFFFF', layers: ['#A9C2E0', '#7C9DC8', '#4E73A6', '#2E4F7E'] },
  'Desert Gold': { sky: ['#7EC8E3', '#E9F6F2'], sun: '#FFF9E8', layers: ['#F6CF95', '#EBAA68', '#D9844C', '#B9653A'] },
  'Night Market': { sky: ['#13243F', '#3B4F7A'], sun: '#F6C53E', layers: ['#F47A38', '#E86A8C', '#16A39C', '#0E2A47'] },
  'Berry Pop': { sky: ['#F48AA6', '#FFE3EC'], sun: '#FFF4D2', layers: ['#E0567F', '#B53D66', '#7E2A52', '#4F1D3A'] },
  'Teal Tide': { sky: ['#BFFFF6', '#FFFFFF'], sun: '#F6C53E', layers: ['#16A39C', '#0E7F7A', '#0F4A4A', '#13243F'] },
};
const paletteOf = (brief = '') => { const n = Object.keys(PALETTES).find((k) => brief.includes(k)); return n ? PALETTES[n] : null; };
const SCENES = [['sea', /surf|sea|ocean|beach|wave|rain|storm|river|lake|boat|island|tide/i], ['peaks', /mountain|snow|ski|winter|glacier|cold/i], ['cosmos', /space|rocket|moon|star|comet|eclipse|aurora|planet|night/i]];
const sceneOf = (t) => (SCENES.find(([, re]) => re.test(t)) || ['hills'])[0];
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
async function post(url, body) { const r = await fetch(url, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body || {}) }); let d = {}; try { d = await r.json(); } catch {} return { ok: r.ok, status: r.status, data: d }; }

function shares(priceY, split) {
  const p = BigInt(priceY); const r = ['curator', 'painter', 'critic', 'seller'].map((k) => (p * BigInt(split[k])) / 10000n);
  const owner = p - r.reduce((a, b) => a + b, 0n);
  return { curator: toNear(r[0], 4), painter: toNear(r[1], 4), critic: toNear(r[2], 4), seller: toNear(r[3], 4), owner: toNear(owner, 4) };
}
function sharesFromEvent(ev) { const d = ev.data; const r = d.robot_shares.map((x) => toNear(x, 4)); return { curator: r[0], painter: r[1], critic: r[2], seller: r[3], owner: toNear(d.owner_amount, 4) }; }

export function createDirector(h = {}) {
  let state = null, current = null, live = null, replayIdx = 0, watching = null;
  const listeners = new Set();
  const emit = () => listeners.forEach((f) => f(snapshot()));
  const snapshot = () => ({ mode: current?.mode || 'idle', jobId: current?.jobId || null, running: !!(live && !live.done), state });

  function mk(mode, jobId) {
    const v = {}; let shownResolve; const shown = new Promise((r) => (shownResolve = r));
    return { mode, jobId, v, get: (k) => v[k], set(k, x) { if (v[k] === undefined) v[k] = x; }, failed: null, interrupted: false, done: false,
      threshold: state?.swarm?.rules?.score_threshold ?? 70, shown, markShown: () => shownResolve(), artLoading: false };
  }
  async function loadArt(job) {
    const url = `/api/media/${job.media}`; const img = new Image(); img.decoding = 'async'; img.src = url;
    try { await img.decode(); return { url, title: job.title, img }; } catch { return { url, title: job.title, img: null }; }
  }
  function fill(cyc, job, withSale) {
    if (!job) return;
    if (job.trend) cyc.set('trend', { name: job.trend, line: `"${job.trend.length > 22 ? job.trend.slice(0, 21) + '\u2026' : job.trend}" is trending!`, palette: paletteOf(job.brief), scene: sceneOf(`${job.trend} ${job.brief}`), source: job.source });
    if (job.media && !cyc.artLoading) { cyc.artLoading = true; loadArt(job).then((a) => cyc.set('art', a)); }
    if (['minted', 'listed', 'sold', 'rejected'].includes(job.status)) cyc.set('review', { score: job.score, note: job.note, line: job.status === 'rejected' ? 'Not this one' : (job.note || '').split('.')[0], approved: job.status !== 'rejected' });
    if (['listed', 'sold'].includes(job.status)) cyc.set('listing', { price: toNear(job.price, 3), priceY: job.price, tokenId: job.token_id });
    if (withSale && job.status === 'sold') cyc.set('sale', { buyer: job.buyer, shares: shares(job.price, state.swarm.rules.split) });
  }
  async function refresh() {
    try { const r = await fetch('/api/state', { cache: 'no-store' }); const d = await r.json(); if (!d.error) { state = d; h.onState?.(d); emit(); } } catch {}
    return state;
  }

  // ---------------------------------------------------------------- watch another visitor's job
  async function watch(cyc) {
    watching = cyc; let listedAt = 0;
    while (!cyc.done) {
      await sleep(2500); await refresh();
      const j = state?.swarm?.active_job?.id === cyc.jobId ? state.swarm.active_job : state?.jobs?.find((x) => x.id === cyc.jobId);
      if (!j) continue;
      fill(cyc, j, true);
      if (j.status === 'rejected' || j.status === 'expired') { if (j.status === 'expired') cyc.failed = { line: 'That job timed out' }; break; }
      if (j.status === 'sold') break;
      if (j.status === 'listed') { if (!listedAt) { await cyc.shown; listedAt = Date.now(); } if (Date.now() - listedAt > 15000) { cyc.set('sale', { none: true }); break; } }
      if (!state.swarm.live) { cyc.failed = { line: 'Paused by the kill switch' }; break; }
    }
    cyc.done = true; watching = null;
  }

  // ---------------------------------------------------------------- live run (this visitor drives)
  async function run(opts = {}) {
    if (live && !live.done) return;
    const cyc = mk('live', null); live = cyc; emit();
    if (current && current.mode === 'replay') current.interrupted = true;
    let driver;
    try {
      for (let i = 0; i < 6; i++) {
        h.onStatus?.(['Curator is reading live trends\u2026', 'Painter is painting\u2026', 'Critic is reviewing\u2026', 'Seller is pricing\u2026'][Math.min(i, 3)]);
        const r = await post('/api/swarm/step', { driver });
        const d = r.data || {};
        (d.txs || []).forEach((t) => h.onTx?.(t));
        if (d.txs?.length) refresh();
        if (d.driver) driver = d.driver;
        if (d.stage === 'briefed') { cyc.jobId = d.job.id; emit(); const e = d.extra || {}; cyc.set('trend', { name: d.job.trend, line: d.say, palette: PALETTES[e.palette] || paletteOf(d.job.brief), scene: e.scene, source: d.job.source, from: e.trend?.source }); h.onInfo?.({ kind: 'trend', ...e, job: d.job }); }
        else if (d.stage === 'painted') { h.onStatus?.('Painted and pinned to IPFS. Critic is reviewing\u2026'); const a = await loadArt(d.job); cyc.set('art', a); h.onInfo?.({ kind: 'art', ...d.extra, job: d.job }); }
        else if (d.stage === 'minted' || d.stage === 'rejected') { cyc.set('review', { score: d.job.score, note: d.job.note, line: d.say, approved: d.stage === 'minted' }); h.onInfo?.({ kind: 'review', ...d.extra, job: d.job }); if (d.stage === 'rejected') break; }
        else if (d.stage === 'listed') { cyc.set('listing', { price: toNear(d.job.price, 3), priceY: d.job.price, tokenId: d.job.token_id }); h.onInfo?.({ kind: 'listing', ...d.extra, job: d.job }); break; }
        else if (d.stage === 'busy') { h.onStatus?.(d.say || 'Another cycle is running'); cyc.mode = 'watch'; cyc.jobId = d.job?.id; emit(); if (cyc.jobId) { fill(cyc, d.job, true); await watch(cyc); } else cyc.failed = { line: 'Busy, try again' }; return; }
        else if (d.stage === 'paused') { cyc.failed = { line: d.extra?.kill ? 'The owner stopped us' : 'Paused. Back in a moment!' }; h.onStatus?.(d.extra?.kill ? 'Kill switch engaged by the owner: the contract refuses every robot action.' : `Swarm paused on-chain until ${new Date(d.extra?.until).toLocaleTimeString()}. It releases itself.`); break; }
        else { cyc.failed = { line: 'Hit a snag, retrying soon' }; h.onStatus?.(d.error || `Step failed (${r.status})`); break; }
      }
      const li = cyc.get('listing');
      if (li && !cyc.failed) {
        h.onStatus?.(`Listed on-chain for ${li.price} NEAR. The robots are carrying it to the shop\u2026`);
        await cyc.shown;
        const wait = opts.autoSell ? 12000 : 60000; const t0 = Date.now();
        h.onStatus?.(opts.autoSell ? 'Listed! Collect it with your wallet, or the demo collector buys it in 12 s.' : 'Listed! Collect it with your wallet.');
        while (Date.now() - t0 < wait && cyc.get('sale') === undefined) {
          await sleep(2500); await refresh();
          const j = state?.jobs?.find((x) => x.id === cyc.jobId);
          if (j?.status === 'sold') cyc.set('sale', { buyer: j.buyer, shares: shares(j.price, state.swarm.rules.split) });
        }
        if (cyc.get('sale') === undefined && opts.autoSell) {
          h.onStatus?.('The demo collector is buying it on-chain\u2026');
          const r = await post('/api/swarm/collect', { tokenId: li.tokenId });
          if (r.data?.tx) h.onTx?.(r.data.tx);
          const ev = r.data?.tx?.events?.find((e) => e.event === 'split_paid');
          if (r.ok && ev) cyc.set('sale', { buyer: r.data.tx.signerId, shares: sharesFromEvent(ev), hash: r.data.tx.hash });
          else { await refresh(); const j = state?.jobs?.find((x) => x.id === cyc.jobId); if (j?.status === 'sold') cyc.set('sale', { buyer: j.buyer, shares: shares(j.price, state.swarm.rules.split) }); }
        }
        cyc.set('sale', { none: true });
        h.onStatus?.(cyc.get('sale').none ? 'Unsold for now: it waits in the Gallery.' : 'Sold! The contract split the money on-chain.');
      }
    } catch (e) { cyc.failed = { line: 'Hit a snag' }; h.onStatus?.(String(e?.message || e)); }
    finally { cyc.done = true; emit(); refresh(); }
  }

  /** Called by the studio at the start of every cycle. */
  function next() {
    if (live && !live.taken) { live.taken = true; current = live; emit(); return current; }
    if (!state) return null;
    const a = state.swarm?.active_job;
    if (a && (!watching || watching.jobId !== a.id) && (!live || live.jobId !== a.id) && Date.now() - Number(a.updated_at_ms) < 5 * 60_000) {
      const c = mk('watch', a.id); fill(c, a, true); current = c; emit(); watch(c); return c;
    }
    const done = (state.jobs || []).filter((j) => ['listed', 'sold', 'rejected'].includes(j.status) && j.media);
    if (!done.length) return null;
    const j = done[replayIdx++ % Math.min(done.length, 8)];
    const c = mk('replay', j.id); fill(c, j, true); if (j.status !== 'sold') c.set('sale', { none: true }); c.done = true; current = c; emit(); return c;
  }
  /** A wallet buy from the latest-artwork card resolves the sale beat immediately. */
  function walletSold(tokenId, buyer, ev, hash) {
    for (const c of [live, current]) if (c && c.get('listing')?.tokenId === tokenId && c.get('sale') === undefined) c.set('sale', { buyer, shares: ev ? sharesFromEvent(ev) : shares(c.get('listing').priceY, state.swarm.rules.split), hash });
  }
  setInterval(() => { if (!(live && !live.done) && !watching) refresh(); }, 15000);
  return { next, run, refresh, walletSold, subscribe: (f) => (listeners.add(f), () => listeners.delete(f)), get state() { return state; }, get current() { return current; }, onBeat(b, cyc) { if (b === 'listed') cyc.markShown(); } };
}
