/* eslint-disable */
/* Round 1, early: a standalone copy of the model from before the page existed. Superseded by the model block inside index.html and round-2.html; kept for check.js. */
/* ---------- The model: sessions, pricing, the six trades, and the per-session figures ---------- */
/* Everything in this block is a demonstration model. In the app, Marks are observed and nothing is generated. */

const SESSIONS = ['2026-11-02', '2026-11-03', '2026-11-04', '2026-11-05', '2026-11-06', '2026-11-09', '2026-11-10', '2026-11-11', '2026-11-12', '2026-11-13', '2026-11-16', '2026-11-17', '2026-11-18', '2026-11-19', '2026-11-20'];
const EXPIRATION = '2026-11-20';
const RATE = 0.04; // short-term rate; every option here expires in 18 days
const dayNumber = (iso) => Date.UTC(+iso.slice(0, 4), +iso.slice(5, 7) - 1, +iso.slice(8, 10)) / 86400000;
const daysLeft = (i) => dayNumber(EXPIRATION) - dayNumber(SESSIONS[i]);
const cents = (x) => Math.round((x + 1e-9) * 100) / 100;

// Standard normal distribution (Abramowitz and Stegun 26.2.17, error below 7.5e-8).
function normCdf(x) {
  const t = 1 / (1 + 0.2316419 * Math.abs(x));
  const d = 0.3989422804014327 * Math.exp((-x * x) / 2);
  const p = d * t * (0.31938153 + t * (-0.356563782 + t * (1.781477937 + t * (-1.821255978 + t * 1.330274429))));
  return x >= 0 ? 1 - p : p;
}

// Black-Scholes price of a European option with no dividends. type 'C' or 'P'; days to expiration; vol as a fraction.
function blackScholes(type, S, K, days, vol, r = RATE) {
  if (days <= 0) return Math.max(type === 'C' ? S - K : K - S, 0);
  const T = days / 365;
  const sd = vol * Math.sqrt(T);
  const d1 = (Math.log(S / K) + (r + (vol * vol) / 2) * T) / sd;
  const d2 = d1 - sd;
  const df = Math.exp(-r * T);
  return type === 'C' ? S * normCdf(d1) - K * df * normCdf(d2) : K * df * normCdf(-d2) - S * normCdf(-d1);
}

// Implied volatility: the volatility at which Black-Scholes returns the observed Mark. Explains a price; predicts nothing.
function impliedVol(type, mark, S, K, days, r = RATE) {
  if (mark == null || S == null) return { na: 'A Mark is missing' };
  if (days <= 0) return { na: 'On the expiration session the price no longer depends on volatility' };
  const floor = blackScholes(type, S, K, days, 0.0001, r);
  if (mark <= floor + 0.005) return { na: 'The Mark is at or below the option’s exercise value, so no volatility fits' };
  let lo = 0.0001;
  let hi = 5;
  if (blackScholes(type, S, K, days, hi, r) < mark) return { na: 'No volatility fits this Mark' };
  for (let n = 0; n < 60; n += 1) {
    const mid = (lo + hi) / 2;
    if (blackScholes(type, S, K, days, mid, r) < mark) lo = mid; else hi = mid;
  }
  const vol = (lo + hi) / 2;
  // How much the price moves for one volatility point; under half a cent, a one-cent Mark step swings the answer.
  const perPoint = blackScholes(type, S, K, days, vol + 0.01, r) - blackScholes(type, S, K, days, vol, r);
  if (perPoint < 0.005) return { na: 'This far from the strike, or this close to expiration, the price barely depends on volatility' };
  return { vol };
}

/* The six trades. u: the Underlying's Marks, written by hand. vol: the volatility the generator prices with, per session,
   in percent, written by hand. Option Marks are then Black-Scholes at that session's Underlying Mark, days left and vol.
   An Execution's price is given for stock, or priced the same way at the Underlying price it happened at (at). */
const TRADES = [
  {
    id: 'stock', symbol: 'AXIO', strategy: 'Long stock', legs: [], mult: 1, unit: 'share',
    plan: { qty: 200, entry: 50.0, stop: { on: 'held', dir: 'below', price: 47.0 }, target: { on: 'held', dir: 'above', price: 56.0 } },
    series: {
      bull: {
        story: 'Scaling in. Half the planned shares are bought on Nov 2 and half on Nov 6, higher. The stock climbs to its Target.',
        u: [50.4, 50.9, 50.7, 51.3, 51.8, 52.6, 52.3, 53.4, 54.1, 53.8, 55.2, 56.3, 57.1, 56.7, 57.4],
        execs: [{ i: 0, qty: 100, price: 50.0 }, { i: 4, qty: 100, price: 51.4 }],
      },
      bear: {
        story: 'A gap below the Stop. The stock drifts down, then opens far below $47.00 on Nov 9. Half is sold in the gap, below the Stop; the rest is held.',
        u: [49.7, 49.9, 49.2, 48.6, 48.1, 45.2, 45.8, 44.9, 44.3, 45.1, 44.0, 43.2, 43.6, 42.8, 42.1],
        execs: [{ i: 0, qty: 200, price: 50.0 }, { i: 5, qty: -100, price: 45.6 }],
      },
    },
  },
  {
    id: 'call', symbol: 'BREN', strategy: 'Long call', legs: [{ type: 'C', strike: 100, side: 1 }], mult: 100, unit: 'contract',
    plan: { qty: 4, entryAt: 97.0, entryVol: 32, stop: { on: 'held', dir: 'below', price: 0.8 }, target: { on: 'held', dir: 'above', price: 4.0 } },
    series: {
      bull: {
        story: 'A flat first week, where only time and easing volatility move the call. Then BREN rallies through the $100 strike. Half is sold at the Target.',
        u: [97.2, 97.0, 97.3, 97.1, 97.2, 98.5, 100.2, 101.8, 103.6, 104.6, 104.0, 105.2, 104.8, 106.0, 106.5],
        vol: [32, 31.5, 31, 30.5, 30, 29.5, 29, 28.5, 28, 28, 27.5, 27.5, 27, 27, 27],
        execs: [{ i: 0, qty: 4, entry: true }, { i: 8, qty: -2, price: 4.0 }],
      },
      bear: {
        story: 'BREN slides away from the strike. Rising volatility cushions the call for a while; time does the rest and it expires worthless.',
        u: [96.4, 95.8, 96.1, 95.0, 94.2, 93.5, 94.0, 92.8, 92.1, 91.5, 92.0, 91.2, 90.6, 90.9, 90.2],
        vol: [33, 34, 34, 36, 38, 40, 40, 42, 44, 45, 45, 46, 47, 47, 47],
        execs: [{ i: 0, qty: 4, entry: true }],
      },
    },
  },
  {
    id: 'put', symbol: 'CORV', strategy: 'Long put', legs: [{ type: 'P', strike: 80, side: 1 }], mult: 100, unit: 'contract',
    plan: { qty: 3, entryAt: 81.5, entryVol: 40, stop: { on: 'held', dir: 'below', price: 1.05 }, target: { on: 'held', dir: 'above', price: 5.0 } },
    series: {
      bull: {
        story: 'CORV rises and volatility eases. The put loses on both counts, breaches its Stop and expires worthless.',
        u: [81.9, 82.4, 82.1, 83.0, 83.6, 84.2, 83.8, 84.9, 85.5, 85.1, 86.0, 86.4, 85.9, 86.8, 87.2],
        vol: [40, 39, 38.5, 38, 37, 36.5, 36, 35.5, 35, 35, 34.5, 34, 34, 34, 34],
        execs: [{ i: 0, qty: 3, entry: true }],
      },
      bear: {
        story: 'CORV drops through the $80 strike as volatility jumps. On Nov 9 the stock barely moves but volatility falls back, and the put gives up value. Nov 10 has no Mark for the put.',
        u: [81.2, 80.6, 79.4, 77.8, 76.5, 76.8, 76.2, 75.4, 74.6, 75.0, 74.2, 73.8, 74.4, 73.9, 73.5],
        vol: [40, 41, 43, 48, 53, 44, 44, 44, 45, 44, 44, 43, 43, 42, 42],
        execs: [{ i: 0, qty: 3, entry: true }],
        missing: [6],
      },
    },
  },
  {
    id: 'shortput', symbol: 'DALE', strategy: 'Short put', legs: [{ type: 'P', strike: 57.5, side: 1 }], mult: 100, unit: 'contract',
    plan: { qty: -6, entryAt: 60.0, entryVol: 38, stop: { on: 'underlying', dir: 'below', price: 54.0 }, target: { on: 'held', dir: 'below', price: 0.2 } },
    series: {
      bull: {
        story: 'DALE goes nowhere for two weeks. The put melts with time alone, and the Trade closes in on the most it can ever make.',
        u: [60.1, 59.9, 60.2, 60.0, 59.8, 60.1, 60.3, 60.0, 60.2, 60.4, 60.9, 61.4, 61.2, 61.8, 62.3],
        vol: [38, 38, 37.5, 37, 37, 36.5, 36, 36, 35.5, 35, 35, 34.5, 34, 34, 34],
        execs: [{ i: 0, qty: -6, entry: true }],
      },
      bear: {
        story: 'DALE falls toward and through the $57.50 strike. Each dollar down costs more than the last. Half the puts are bought back on Nov 10; the rest are assigned.',
        u: [59.6, 59.0, 58.4, 58.8, 57.6, 56.9, 55.8, 55.1, 54.6, 53.7, 53.2, 53.9, 52.8, 52.4, 52.0],
        vol: [39, 40, 42, 41, 44, 47, 51, 52, 53, 56, 56, 54, 55, 55, 55],
        execs: [{ i: 0, qty: -6, entry: true }, { i: 6, qty: 3, at: 56.2 }],
      },
    },
  },
  {
    id: 'callspread', symbol: 'ELIX', strategy: 'Bull call spread', legs: [{ type: 'C', strike: 120, side: 1 }, { type: 'C', strike: 125, side: -1, skew: -1 }], mult: 100, unit: 'spread',
    plan: { qty: 4, entryAt: 119.5, entryVol: 30, stop: { on: 'held', dir: 'below', price: 1.0 }, target: { on: 'held', dir: 'above', price: 4.0 } },
    series: {
      bull: {
        story: 'ELIX rises through both strikes early, yet the spread is slow to reach its $5.00 cap: it needs time to run out as well.',
        u: [120.2, 121.5, 122.8, 124.0, 125.6, 126.4, 127.1, 126.5, 127.8, 128.6, 128.0, 129.1, 128.7, 129.5, 130.2],
        vol: [30, 30, 29.5, 29, 29, 28.5, 28, 28, 28, 27.5, 27.5, 27, 27, 27, 27],
        execs: [{ i: 0, qty: 4, entry: true }],
      },
      bear: {
        story: 'ELIX falls below both strikes. The spread breaches its Stop and expires worthless, but the loss stops at what was paid.',
        u: [118.8, 118.0, 118.6, 117.2, 116.0, 115.1, 115.8, 114.6, 113.9, 114.4, 113.2, 112.8, 113.5, 112.6, 112.0],
        vol: [31, 32, 32, 33, 35, 36, 36, 37, 38, 38, 39, 39, 39, 40, 40],
        execs: [{ i: 0, qty: 4, entry: true }],
      },
    },
  },
  {
    id: 'putspread', symbol: 'FENN', strategy: 'Bear put spread', legs: [{ type: 'P', strike: 40, side: 1 }, { type: 'P', strike: 37.5, side: -1, skew: 2 }], mult: 100, unit: 'spread',
    plan: { qty: 10, entryAt: 40.6, entryVol: 45, stop: { on: 'held', dir: 'below', price: 0.4 }, target: { on: 'held', dir: 'above', price: 1.9 } },
    series: {
      bull: {
        story: 'FENN rises away from both strikes. The spread decays, breaches its Stop and expires worthless.',
        u: [40.9, 41.3, 41.0, 41.8, 42.2, 42.6, 42.3, 43.0, 43.4, 43.1, 43.8, 44.0, 43.7, 44.3, 44.6],
        vol: [45, 44, 44, 43, 42, 42, 41, 41, 40, 40, 40, 39, 39, 39, 39],
        execs: [{ i: 0, qty: 10, entry: true }],
      },
      bear: {
        story: 'FENN falls through both strikes. The spread climbs toward its $2.50 cap and settles on it.',
        u: [40.2, 39.6, 39.0, 38.2, 37.6, 37.0, 37.4, 36.6, 36.0, 36.3, 35.6, 35.2, 35.7, 35.1, 34.8],
        vol: [45, 46, 47, 49, 51, 52, 51, 52, 53, 52, 53, 53, 52, 53, 53],
        execs: [{ i: 0, qty: 10, entry: true }],
      },
    },
  },
];

const isOption = (t) => t.legs.length > 0;
const width = (t) => (t.legs.length === 2 ? Math.abs(t.legs[0].strike - t.legs[1].strike) : null);

// The price of the thing held (stock price, option price, or a spread's net value) at one Underlying price, days left and vol.
function legPrices(t, S, days, volPct) {
  return t.legs.map((l) => cents(blackScholes(l.type, S, l.strike, days, (volPct + (l.skew || 0)) / 100)));
}
const heldFromLegs = (t, prices) => cents(prices.reduce((sum, p, k) => sum + t.legs[k].side * p, 0));
// What the thing held is worth at expiration with the Underlying at S (used only for an Underlying-price Stop or Target, and the payoff line).
const heldAtExpiration = (t, S) => (isOption(t) ? cents(t.legs.reduce((sum, l) => sum + l.side * Math.max(l.type === 'C' ? S - l.strike : l.strike - S, 0), 0)) : S);

// The lowest and highest value the thing held can ever have.
function heldBounds(t) {
  if (!isOption(t)) return { min: 0, max: Infinity };
  if (t.legs.length === 2) return { min: 0, max: width(t) };
  const l = t.legs[0];
  return { min: 0, max: l.type === 'C' ? Infinity : l.strike };
}

function buildPlan(t) {
  const p = t.plan;
  const entry = isOption(t) ? heldFromLegs(t, legPrices(t, p.entryAt, daysLeft(0), p.entryVol)) : p.entry;
  const boundary = (c) => (c.on === 'underlying' ? heldAtExpiration(t, c.price) : c.price);
  const stopValue = boundary(p.stop);
  const targetValue = boundary(p.target);
  const size = Math.abs(p.qty) * t.mult;
  const sign = Math.sign(p.qty);
  const oneR = cents(sign * size * (entry - stopValue));
  const reward = cents(sign * size * (targetValue - entry));
  return { qty: p.qty, entry, stop: p.stop, target: p.target, stopValue, targetValue, oneR, reward, ratio: reward / oneR };
}

// Every session of one series, each figure as of that session only.
function buildSeries(t, key) {
  const s = t.series[key];
  const plan = buildPlan(t);
  const sign = Math.sign(plan.qty);
  const bounds = heldBounds(t);
  const execs = s.execs.map((e) => {
    const price = e.entry ? plan.entry : e.price != null ? e.price : heldFromLegs(t, legPrices(t, e.at, daysLeft(e.i), s.vol[e.i]));
    return { ...e, price };
  });
  const lots = []; // FIFO open lots: { qty (signed), price }
  let realized = 0;
  let prev = null;
  const out = [];
  for (let i = 0; i < SESSIONS.length; i += 1) {
    const todays = execs.filter((e) => e.i === i).map((e) => {
      const opening = Math.sign(e.qty) === sign;
      let banked = 0;
      if (opening) lots.push({ qty: e.qty, price: e.price });
      else {
        let left = Math.abs(e.qty);
        while (left > 0) {
          const lot = lots[0];
          const take = Math.min(left, Math.abs(lot.qty));
          banked += sign * take * t.mult * (e.price - lot.price);
          lot.qty -= sign * take;
          left -= take;
          if (lot.qty === 0) lots.shift();
        }
        realized = cents(realized + banked);
      }
      return { ...e, opening, banked: opening ? null : cents(banked) };
    });
    const qty = lots.reduce((sum, l) => sum + l.qty, 0);
    const size = Math.abs(qty) * t.mult;
    const u = s.u[i];
    const days = daysLeft(i);
    const missing = (s.missing || []).includes(i);
    const legs = isOption(t) && !missing ? legPrices(t, u, days, s.vol[i]) : null;
    const held = !isOption(t) ? u : missing ? null : heldFromLegs(t, legs);
    const row = { i, date: SESSIONS[i], days, u, qty, execs: todays, realized, missing, legs, held, settled: isOption(t) && days === 0 };
    row.iv = isOption(t) ? t.legs.map((l, k) => impliedVol(l.type, legs ? legs[k] : null, u, l.strike, days)) : null;
    if (held != null) {
      const open = cents(lots.reduce((sum, l) => sum + l.qty * t.mult * (held - l.price), 0));
      row.openPnl = open;
      row.pnl = cents(realized + open);
      const stopHit = plan.stop.on === 'underlying' ? u <= plan.stop.price : sign * (held - plan.stopValue) <= 0;
      const targetHit = plan.target.on === 'underlying' ? u >= plan.target.price : sign * (held - plan.targetValue) >= 0;
      const toStop = cents(sign * size * (held - plan.stopValue));
      const toTarget = cents(sign * size * (plan.targetValue - held));
      row.stopHit = stopHit;
      row.targetHit = targetHit;
      row.riskToStop = stopHit ? 0 : Math.max(toStop, 0);
      row.stopOverrun = stopHit ? Math.max(-toStop, 0) : 0;
      // An Underlying-price Stop not yet breached, with the Marks already past the Plan's dollar amount for it.
      row.pastStopAmount = !stopHit && toStop < 0 ? cents(-toStop) : 0;
      row.rewardToTarget = targetHit ? 0 : Math.max(toTarget, 0);
      row.targetOverrun = targetHit ? Math.max(-toTarget, 0) : 0;
      const worstValue = sign > 0 ? bounds.min : bounds.max;
      const bestValue = sign > 0 ? bounds.max : bounds.min;
      row.worstCase = cents(sign * size * (held - worstValue));
      row.maxReward = Number.isFinite(bestValue) ? cents(sign * size * (bestValue - held)) : Infinity;
      row.ratio = stopHit ? 'Stop breached' : targetHit ? 'Target reached' : row.riskToStop > 0 ? row.rewardToTarget / row.riskToStop : 'Past the Stop’s amount';
      if (prev) {
        row.change = { since: prev.date, u: cents(u - prev.u), held: cents(held - prev.held), pnl: cents(row.pnl - prev.pnl), riskToStop: cents(row.riskToStop - prev.riskToStop), rewardToTarget: cents(row.rewardToTarget - prev.rewardToTarget) };
      }
      prev = row;
    }
    out.push(row);
  }
  return { plan, execs, rows: out, story: s.story, inputVol: s.vol || null };
}

/* The dollar split (an estimate): one session's change in a single option's Mark, per contract price, divided into the part
   from the Underlying's move, the part from one session passing, and the part from implied volatility changing, worked out
   in that order. The three parts and "unexplained" always add up to the real change in the Mark. */
function splitMove(t, legIndex, before, after) {
  const l = t.legs[legIndex];
  if (!before || !after || before.legs == null || after.legs == null) return { na: 'A Mark is missing' };
  const iv0 = before.iv[legIndex];
  if (iv0.vol == null) return { na: `No implied volatility for ${before.date}: ${iv0.na}` };
  const m0 = before.legs[legIndex];
  const m1 = after.legs[legIndex];
  const a = blackScholes(l.type, after.u, l.strike, before.days, iv0.vol);
  const b = blackScholes(l.type, after.u, l.strike, after.days, iv0.vol);
  const iv1 = after.iv[legIndex];
  const fromUnderlying = a - blackScholes(l.type, before.u, l.strike, before.days, iv0.vol);
  const fromTime = b - a;
  const fromVol = iv1.vol != null ? blackScholes(l.type, after.u, l.strike, after.days, iv1.vol) - b : 0;
  const total = m1 - m0;
  return { total, fromUnderlying, fromTime, fromVol, volKnown: iv1.vol != null, unexplained: total - fromUnderlying - fromTime - fromVol };
}

if (typeof module !== 'undefined') module.exports = { SESSIONS, RATE, daysLeft, cents, blackScholes, impliedVol, TRADES, buildPlan, buildSeries, splitMove, isOption, width, heldAtExpiration, heldBounds, legPrices, heldFromLegs };
