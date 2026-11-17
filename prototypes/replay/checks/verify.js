/* eslint-disable */
// Loads the model block straight out of the page and checks every session of every series against the definitions.
// Run: node prototypes/replay/checks/verify.js (round 1's page; verify2.js runs the same checks on round 2's).
const fs = require('fs');
const html = fs.readFileSync(require('path').resolve(__dirname, '../../..') + '/prototypes/replay/index.html', 'utf8');
const src = html.split('<script>')[1].split('</script>')[0];
const module_ = { exports: {} };
new Function('module', src)(module_);
const m = module_.exports;
const near = (a, b, tol = 0.011) => Math.abs(a - b) <= tol;
let checks = 0;
const bad = [];
const want = (ok, msg) => { checks += 1; if (!ok) bad.push(msg); };

for (const t of m.TRADES) {
  for (const key of ['bull', 'bear']) {
    const { plan, rows } = m.buildSeries(t, key);
    const sign = Math.sign(plan.qty);
    const id = `${t.symbol} ${key}`;
    want(plan.oneR > 0 && plan.reward > 0, `${id}: 1R and planned reward must be positive`);
    want(near(plan.oneR, sign * Math.abs(plan.qty) * t.mult * (plan.entry - plan.stopValue)), `${id}: 1R`);
    for (const r of rows) {
      const at = `${id} ${r.date}`;
      // Position: the lots on hand add up to the quantity, and never exceed the Plan.
      want(r.lots.reduce((s, l) => s + l.qty, 0) === r.qty && Math.abs(r.qty) <= Math.abs(plan.qty), `${at}: quantity`);
      if (r.held == null) { want(r.riskToStop === undefined && r.pnl === undefined, `${at}: a missing Mark must leave the figures unset`); continue; }
      // Trade P&L, from scratch: every Execution's cash flow plus the open Position at the Mark.
      const size = Math.abs(r.qty) * t.mult;
      const cash = rows.slice(0, r.i + 1).flatMap((x) => x.execs).reduce((s, e) => s - e.qty * t.mult * e.price, 0);
      want(near(r.pnl, cash + r.qty * t.mult * r.held, 0.02), `${at}: Trade P&L ${r.pnl} against cash flows ${cash + r.qty * t.mult * r.held}`);
      if (m.isOption(t)) {
        // Each option Mark is the model at that session; on the last session it is the exercise value.
        if (r.days === 0) want(near(r.held, m.cents(m.heldAtExpiration(t, r.u))), `${at}: settles at exercise value`);
        r.iv.forEach((v, k) => { if (v.vol != null) want(near(m.blackScholes(t.legs[k].type, r.u, t.legs[k].strike, r.days, v.vol), r.legs[k], 0.006), `${at}: implied volatility reproduces the Mark`); });
      }
      if (r.settled) { want(r.riskToStop === 0 && r.rewardToTarget === 0 && r.worstCase === 0, `${at}: settled`); continue; }
      // Risk to stop and Reward to target: the remaining Position's distance, in dollars, to each boundary.
      const toStop = sign * size * (r.held - plan.stopValue);
      const toTarget = sign * size * (plan.targetValue - r.held);
      want(near(r.riskToStop - r.stopOverrun - r.pastStopAmount, toStop, 0.02), `${at}: Risk to stop / Stop Overrun`);
      want(near(r.rewardToTarget - r.targetOverrun, toTarget, 0.02), `${at}: Reward to target / Target Overrun`);
      want(!(r.riskToStop > 0 && r.stopOverrun > 0) && !(r.rewardToTarget > 0 && r.targetOverrun > 0), `${at}: a distance and its overrun never both show`);
      // The corridor's lines: the Trade P&L is the result at each boundary plus the distance to it.
      want(near(r.pnl - toStop, r.at.stop, 0.03) && near(r.pnl + toTarget, r.at.target, 0.03), `${at}: results at the Stop and the Target`);
      want(near(r.pnl - r.worstCase, r.at.worst, 0.03), `${at}: result at the Worst case`);
      if (Number.isFinite(r.maxReward)) want(near(r.pnl + r.maxReward, r.at.max, 0.03), `${at}: result at the Max reward`);
      want(r.worstCase >= r.riskToStop - 0.01 || r.pastStopAmount > 0 || r.stopHit, `${at}: Worst case is never less than Risk to stop`);
      want(r.giveBack >= 0 && r.giveBack <= r.riskToStop + 0.001, `${at}: open profit within the Risk to stop`);
      // The dollar split always adds up to the Mark's real change.
      const sp = r.split;
      if (sp && !sp.na) {
        const sum = sp.separable ? sp.fromUnderlying + sp.fromTime + sp.fromVol + sp.unexplained : sp.fromUnderlying + sp.together;
        want(near(sum, sp.total, 1e-6), `${at}: the split adds up`);
        if (sp.separable && !sp.exact) want(Math.abs(sp.unexplained) < 0.02, `${at}: unexplained part ${sp.unexplained.toFixed(4)} is more than rounding`);
      }
      if (m.isOption(t)) want(Math.abs(r.shares) <= size + 0.5, `${at}: share equivalent within contracts x 100`);
    }
  }
}
console.log(`${checks} checks, ${bad.length} failed`);
bad.slice(0, 30).forEach((b) => console.log('  ' + b));

// Worked examples, printed for the record.
const row = (sym, key, date) => { const t = m.TRADES.find((x) => x.symbol === sym); const s = m.buildSeries(t, key); return { t, plan: s.plan, r: s.rows.find((x) => x.date === date), rows: s.rows }; };
const show = (label, o) => console.log(label, JSON.stringify(o));
let x = row('BREN', 'bull', '2026-11-12');
show('BREN bull Nov 12:', { held: x.r.held, qty: x.r.qty, realized: x.r.realized, pnl: x.r.pnl, riskToStop: x.r.riskToStop, targetOverrun: x.r.targetOverrun, worst: x.r.worstCase });
x = row('AXIO', 'bear', '2026-11-09');
show('AXIO bear Nov 9:', { mark: x.r.u, exec: x.r.execs[0].price, banked: x.r.execs[0].banked, plannedRiskOnSold: 100 * (50 - 47), pnl: x.r.pnl, stopOverrun: x.r.stopOverrun });
x = row('CORV', 'bear', '2026-11-09');
show('CORV bear Nov 9 split:', Object.fromEntries(Object.entries(x.r.split).map(([k, v]) => [k, typeof v === 'number' ? +v.toFixed(3) : v])));
x = row('DALE', 'bear', '2026-11-12');
show('DALE bear Nov 12:', { u: x.r.u, put: x.r.held, stopHit: x.r.stopHit, pastStopAmount: x.r.pastStopAmount, riskToStop: x.r.riskToStop });
