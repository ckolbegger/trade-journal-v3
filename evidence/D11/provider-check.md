# D11 provider check (decision 15)

Run 2026-11-26 (evening, ET) by the main session at the user's request, before D11's breakdown. Headless Chromium (Playwright 1.63.0) on a page served at `http://localhost:5175`; the token was read from `.env.local` (`MARKETDATA_TOKEN`, git-ignored) and never printed or stored elsewhere. The script is under "Script" below (run from a scratch folder; it reads the repository's `.env.local`).

**Result: pass, on the Starter plan.** Marketdata.app is callable straight from the browser with its token in the `Authorization: Bearer` header, and it gives end-of-day option closes for the session just ended and stock Daily Bars.

| Check | Result |
|---|---|
| CORS preflight (`Origin: http://localhost:5175`, header `authorization`) | 200; `Access-Control-Allow-Origin: *`; allowed headers include `authorization` |
| Stock quote from the browser, token in the header | 203, `s: ok` |
| Stock quote, token in the query string | 203, `s: ok` (not needed) |
| Stock Daily Bars, AAPL, 2026-11-18 to 2026-11-25 (`/v1/stocks/candles/D/`) | 203, six sessions with open, high, low, close; Nov 25 close 355.58 |
| Option chain (`/v1/options/chain/`) | 203, `s: ok` |
| Option end of day, AAPL Dec 24 2026 $355 call, 2026-11-25 (`/v1/options/quotes/…?date=`) | 203: bid 10.25, ask 11.65, mid 10.95, last 11.15; `updated` 2026-11-25 16:00 ET |

**Plan matters.** On the Free plan the same option request for 2026-11-25 was refused (402, "Your plan can only access fully-closed sessions; the latest available is 2026-11-24."): Free's option data rolls to a session only at 9:30 ET the next trading day, and it allows 100 requests a day. The user bought the Starter plan on 2026-11-26 (options 15 minutes delayed, 10,000 requests a day), and the request then succeeded.

**For D11's breakdown:**
- Treat status 203 (cached or delayed) as success.
- With Starter's 15-minute delay, the session's option close should be available from about 16:15 ET (an inference from the plan's wording, not stated by the provider).
- Which option figure becomes the Mark (mid or last) is a D11 decision; a thinly traded contract's last trade can be stale.
- Real-time data is for non-professional subscribers only; the plan's terms for professionals were not checked.

## Script

```js
import http from 'node:http';
import fs from 'node:fs';
import { chromium } from '../../node_modules/playwright/index.mjs';
const env = fs.readFileSync('./.env.local','utf8');
const token = (env.match(/^MARKETDATA_TOKEN=(.*)$/m)||[])[1]?.trim().replace(/^['"]|['"]$/g,'');
if (!token) { console.log(JSON.stringify({error:'no MARKETDATA_TOKEN in .env.local'})); process.exit(0); }
const mask = s => String(s).split(token).join('<token>');
const srv = http.createServer((q,r)=>{r.writeHead(200,{'content-type':'text/html'});r.end('<!doctype html><title>cors</title>');}).listen(5175,'127.0.0.1');
const out = {};
// Raw preflight (no token), as the browser would send it
try {
  const pf = await fetch('https://api.marketdata.app/v1/stocks/quotes/AAPL/', {method:'OPTIONS', headers:{Origin:'http://localhost:5175','Access-Control-Request-Method':'GET','Access-Control-Request-Headers':'authorization'}});
  out.preflight = {status: pf.status, allowOrigin: pf.headers.get('access-control-allow-origin'), allowHeaders: pf.headers.get('access-control-allow-headers'), allowMethods: pf.headers.get('access-control-allow-methods')};
} catch(e) { out.preflight = {error: String(e)}; }
const browser = await chromium.launch();
const page = await browser.newPage();
await page.goto('http://localhost:5175/');
const res = await page.evaluate(async (token) => {
  const B = 'https://api.marketdata.app/v1';
  const call = async (path, mode) => {
    const url = B + path + (mode==='query' ? (path.includes('?')?'&':'?') + 'token=' + encodeURIComponent(token) : '');
    try {
      const r = await fetch(url, mode==='header' ? {headers:{Authorization:'Bearer '+token}} : {});
      const body = await r.json().catch(()=>null);
      return {ok:true, status:r.status, body};
    } catch(e) { return {ok:false, error:String(e)}; }
  };
  const o = {};
  o.quoteHeader = await call('/stocks/quotes/AAPL/', 'header');
  o.quoteQuery = await call('/stocks/quotes/AAPL/', 'query');
  const mode = o.quoteHeader.ok && o.quoteHeader.status < 300 ? 'header' : 'query';
  o.mode = mode;
  o.candles = await call('/stocks/candles/D/AAPL/?from=2026-11-18&to=2026-11-25', mode);
  o.chain = await call('/options/chain/AAPL/?dte=30&strikeLimit=2&side=call', mode);
  const sym = o.chain.body?.optionSymbol?.[0];
  o.optionSymbol = sym;
  if (sym) o.optionEod = await call('/options/quotes/' + sym + '/?date=2026-11-25', mode);
  return o;
}, token);
await browser.close(); srv.close();
const brief = r => !r ? null : r.ok ? {status:r.status, s:r.body?.s, errmsg:r.body?.errmsg, keys: r.body? Object.keys(r.body):null} : {blocked:r.error};
out.quoteWithHeader = brief(res.quoteHeader);
out.quoteWithQueryToken = brief(res.quoteQuery);
out.modeUsed = res.mode;
out.candles = {...brief(res.candles), days: res.candles.body?.t?.map(t=>new Date(t*1000).toISOString().slice(0,10)), close: res.candles.body?.c, high: res.candles.body?.h, low: res.candles.body?.l};
out.chain = {...brief(res.chain), count: res.chain.body?.optionSymbol?.length};
out.optionSymbol = res.optionSymbol;
out.optionEod = res.optionEod && {...brief(res.optionEod), last: res.optionEod.body?.last, bid: res.optionEod.body?.bid, ask: res.optionEod.body?.ask, mid: res.optionEod.body?.mid, updated: res.optionEod.body?.updated?.map(t=>new Date(t*1000).toISOString())};
out.stockQuote = res.quoteHeader.body && {last: res.quoteHeader.body.last, updated: res.quoteHeader.body.updated?.map(t=>new Date(t*1000).toISOString())};
console.log(mask(JSON.stringify(out, null, 1)));
```
