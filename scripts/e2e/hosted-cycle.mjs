const B = process.argv[2] || 'https://muse-swarm.vercel.app'; let driver; let job;
const post = async (p, b) => { const r = await fetch(B + p, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(b || {}) }); return [r.status, await r.json()]; };
for (let i = 0; i < 6; i++) {
  const t = Date.now(); const [st, d] = await post('/api/swarm/step', { driver }); if (d.driver) driver = d.driver; job = d.job || job;
  console.log(st, d.stage, `${Date.now() - t}ms`, d.say || d.error || '', (d.txs || []).map((x) => `${x.method}:${x.ok ? 'ok' : 'FAIL ' + x.error}:${x.hash}`).join(' '));
  if (['listed', 'rejected', 'paused', 'busy', 'error'].includes(d.stage) || st >= 400) break;
}
if (job?.token_id && job.status === 'listed' && !process.argv.includes('--no-buy')) { const [st, d] = await post('/api/swarm/collect', { tokenId: job.token_id }); console.log('collect', st, d.tx?.ok, d.tx?.hash, d.error || '', JSON.stringify(d.tx?.events?.find((e) => e.event === 'split_paid')?.data || {})); }
console.log(JSON.stringify({ id: job?.id, status: job?.status, title: job?.title, trend: job?.trend, score: job?.score, media: job?.media, token: job?.token_id, price: job?.price }));
