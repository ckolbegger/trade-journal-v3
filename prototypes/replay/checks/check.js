/* eslint-disable */
// Round 1, early: prints model.js's figures for every trade, series and session as a text table. Run: node prototypes/replay/checks/check.js
const m = require('./model.js');
const f = (x, w = 9) => (x == null ? '—' : x === Infinity ? 'nocap' : typeof x === 'string' ? x.slice(0, 8) : x.toFixed(2)).padStart(w);
for (const t of m.TRADES) {
  for (const key of ['bull', 'bear']) {
    const s = m.buildSeries(t, key);
    const p = s.plan;
    console.log(`\n== ${t.symbol} ${t.strategy} / ${key}  entry ${p.entry} stopV ${p.stopValue} tgtV ${p.targetValue} 1R ${p.oneR} reward ${p.reward} ratio ${p.ratio.toFixed(2)}`);
    console.log('date   days      u     held    iv%   qty      pnl  realzd   toStop  overrun toTarget  tOver    worst      max   ratio flags');
    for (const r of s.rows) {
      const iv = r.iv ? r.iv.map((v) => (v.vol != null ? (v.vol * 100).toFixed(1) : 'na')).join('/') : '';
      const fl = [r.stopHit ? 'STOP' : '', r.targetHit ? 'TGT' : '', r.pastStopAmount ? `past${r.pastStopAmount}` : '', ...r.execs.map((e) => `exec ${e.qty}@${e.price}${e.banked != null ? ` banked ${e.banked}` : ''}`)].filter(Boolean).join(' ');
      console.log(r.date.slice(5), String(r.days).padStart(3), f(r.u, 8), f(r.held, 8), iv.padStart(10), String(r.qty).padStart(4), f(r.pnl), f(r.realized, 7), f(r.riskToStop), f(r.stopOverrun, 7), f(r.rewardToTarget), f(r.targetOverrun, 6), f(r.worstCase), f(r.maxReward), f(typeof r.ratio === 'number' ? r.ratio : r.ratio, 8), fl);
    }
  }
}
