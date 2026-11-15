# Marketdata.app evaluation

Research task 2 of 4, written 2026-11-15. It judges Marketdata.app against `research/mark-provider-requirements.md` (R1 to R41, Q1 to Q12) and answers the D11 accepted conditions (decision 15, `plan/implementation-plan.md:840-843`).

Evidence labels: **Verified** means a live request on 2026-11-15 (Sunday, about 01:40 New York time) with the user's token, which is a Free Forever account (daily limit 100 credits). **Documented** means the official docs say so (URL given). **Inferred** means reasoned from the two, not tested or stated.

## 1. Verdict in plain words

**Yes, with conditions.** The app can call Marketdata.app straight from the browser. A real Chromium page on `https://example.pages.dev` and on `http://localhost:5175` fetched prices with the token in the `Authorization` header and read the status and body of successes and errors alike. No server or proxy is needed.

It gives what D11 needs: a daily bar (open, high, low, closing price) for each stock and ETF, and one end-of-day record per option contract per session, including expired contracts. Option symbols are the same OCC symbols the app already uses as Instrument keys, so no lookup calls are needed.

The conditions:

1. **A paid plan is needed. The free plan is not enough.** It reaches back only one year (the app may need 2024-01-01), allows 100 credits a day, and serves a day's option prices only after 09:30 the next trading day. Starter ($30 a month, or $12 a month billed yearly) reaches back five years and has 10,000 credits a day. Trader ($75, or $30 yearly) has unlimited history.
2. **Options have no daily bars.** Marketdata.app has no option candles. An option's record holds the 16:00 bid, ask, midpoint, last trade and volume. R10 (a Nice) is not met, so D12 option-price Stops fall back to the exact Mark, as the spec allows.
3. **The option Mark rule fits the provider well.** The user has settled Q1: an option's Mark is the closing bid/ask midpoint. Marketdata.app returns each contract's bid and ask for every past session, including on days with no trade and for expired contracts. The snapshot is taken at 16:00 New York time, or 13:00 on early-close days. One request covers many dates for one contract. One request can also cover many contracts of one underlying and expiration for one date. The adapter should work out the midpoint itself from `bid` and `ask`, because the provider's own `mid` field is rounded differently by different endpoints. Its `last` field (the last trade) is not used. On days with no trade, `last` even repeats an older trade under the new date.
4. **The adapter must ask for unadjusted stock prices.** By default, daily stock bars are adjusted for splits *and dividends*. That rewrites history after every dividend. Sending `adjustsplits=false&adjustdividends=false` returns prices as they traded.
5. **The terms affect stored data and backups.** If a paid plan ends, the terms say the trader must delete the data downloaded on it, "wherever you stored it, including backups". That conflicts with Marks living forever in the journal and its backup files. Only the user can decide whether to accept this.
6. **Same-evening option prices are untested.** On a paid plan, the docs suggest a current quote fetched after the close would give the day's value that evening. This could not be tested on a free account on a Sunday. Without it, option Marks arrive the next morning.

## 2. Decision 15 answer

| Condition | Answer | Label | Evidence |
|---|---|---|---|
| Direct browser calls (CORS) with token authentication | **Yes.** The `OPTIONS` preflight returns 200 with `Access-Control-Allow-Origin: *`, and `Access-Control-Allow-Headers` includes `authorization`. Every GET answer (200/203, 400, 401, 402 and 404) carries `Access-Control-Allow-Origin: *`. A real Chromium `fetch` with `Authorization: Bearer …` from both origins read status 203 and the JSON body, and also read the 401 and 404 bodies. The credentials flag is not needed, because the token goes in a header, not a cookie. | Verified | Live tests L1, L2, L3 and B1 to B6 (section 5); https://www.marketdata.app/docs/api/authentication |
| End-of-day option closing prices (the Mark is the closing bid/ask midpoint, Q1) | **Yes.** `GET /v1/options/quotes/{OCC}/?from=&to=` returns one record per session. Each record is stamped 16:00 New York time (13:00 on early-close days) and holds that moment's `bid` and `ask`, plus `mid`, `last`, `volume` and `underlyingPrice`. Bid and ask are present on every session, including sessions with no trade (L12, 7 of 22 sessions with volume 0). Expired contracts work through their expiration day. There is no option OHLC. | Verified; Documented | L11, L12, L13, L16; https://www.marketdata.app/docs/api/options/quotes |
| Stock Daily Bars | **Yes.** `GET /v1/stocks/candles/D/{symbol}/?from=&to=` returns `o/h/l/c/v/t` arrays, one per NYSE session. Unadjusted prices need both adjustment flags set to false. | Verified; Documented | L4 to L8; https://www.marketdata.app/docs/api/stocks/candles |
| Condition 2: a local emulator is possible | **Yes.** The API is plain GET with JSON of parallel arrays, a status field `s` (`ok`, `no_data`, `error`) and documented status codes, so an emulator is simple. AAPL stock and AAPL options cost no credits, so a live smoke test is cheap. AAPL is exempt from credit counting, so a smoke test that uses only AAPL never exercises quota behaviour. | Verified; Documented | L1 (`x-api-ratelimit-consumed: 0` for AAPL); https://www.marketdata.app/docs/api/rate-limiting |

Nothing here triggers decision 15's stop-and-discuss: no proxy is needed. The terms point (condition 5 in section 1) is a user decision, not a blocker. Q1 is settled as the midpoint, which this provider supports.

## 3. Requirements table

Tier evaluated: Free Forever (live), with Starter and Trader from the docs. Status reflects a paid plan unless a row says otherwise.

| # | Status | Evidence | Label | Source |
|---|---|---|---|---|
| R1 US stocks and ETFs | Met | AAPL, SPY, NVDA and `BRK.B` all returned bars. The provider spells class shares with a dot (`BRK.B`), the same as the app's key, so no mapping is needed. Bulk candles echo `"symbol":["AAPL","SPY","BRK.B"]`. | Verified | L2, L4, L14, L19 |
| R2 Exact option contracts | Met | Monthly (AAPL 2024-07-19), a SPY 0DTE (2026-11-13), a 227.5 strike and a BRKB contract all returned data. Weeklies appear in the expiration list (2024-07-05, 07-12, 07-26) but no weekly contract was fetched. | Verified (weekly: Inferred) | L11, L15, L17, L18, L20 |
| R3 Symbol mapping by rule | Met, including the Nice | The quote endpoint takes the OCC symbol in the path and echoes `optionSymbol`. The app's unpadded OCC key (`AAPL240719C00230000`) is exactly the provider's format. The chain for `BRK.B` returned root `BRKB` (`BRKB261120C00590000`), and that symbol fetched directly. No lookup call is needed. Lookup also works for expired contracts if ever wanted (`AAPL 7/19/2024 227.5 Call` returned `AAPL240719C00227500`, 1 credit). | Verified | L11, L16, L20, L21; https://www.marketdata.app/docs/api/options/lookup |
| R4 Index options and levels (Nice) | Partly (untested) | The chain endpoint has `am` and `pm` parameters "for index settlement type", so index options are served. An indices candles path is listed in Marketdata.app's OpenAPI. Roots and cost were not tested. | Documented | https://www.marketdata.app/docs/api/options/chain; https://apis.io/apis/marketdata-app/marketdata-app-indices-api/ |
| R5 Stock closing price per session | Met | Candle `c`. Raw AAPL 2024-07-01 = 216.75 and 2020-08-28 = 499.23 match the published closes. SPY 2026-11-13 `c` = 754.37 equals the option records' `underlyingPrice`. Whether `c` is the closing auction print or the last consolidated trade is not documented (Q2). | Verified; Inferred (match with public closes) | L4, L7, L15 |
| R6 Option closing price per session (blocker), as the closing bid/ask midpoint | Met | One record per session per contract from `options/quotes` with `from`/`to`. `updated` = 16:00 New York time, or 13:00 on 2024-07-03, so bid and ask are taken at the session's end. Bid and ask are present for every session, including the 7 volume-0 sessions in L12, the expiration day of expired contracts (L11, L18) and SPY 0DTE contracts (L15). Several dates per request: yes (22 sessions in L12). Several contracts per request: only through `options/chain`, for one underlying, one expiration and one date (11 contracts in L15). `options/quotes` rejects a list of contracts (L17). Recommended Mark = (`bid` + `ask`) / 2, worked out by the adapter (see R12). A one-sided market, such as bid 0 and ask 0.01, gives 0.005. A record with both sides 0 or null was not seen; the adapter should treat it as Missing unless the user decides otherwise. | Verified; Documented | L11, L12, L15, L17, L18; https://www.marketdata.app/docs/api/options/quotes |
| R7 Exact-day values only | Met for the midpoint rule | Stocks: no bar on non-sessions (verified). Options: a record exists for every session, and its `bid`/`ask` change from day to day (each session's own 16:00 snapshot), so a midpoint Mark is exact-date. The `last` field is carried forward from an earlier trade under the new date (AAPL260116P00100000, 2024-07-26 to 07-31: `last` 0.53 every day with `volume` 0). With the midpoint rule, the adapter ignores `last`. | Verified | L12 |
| R8 Zero is not missing | Met | Missing data is an absent record or a 404 `no_data`, never 0. Real zeros come through (`bid: 0` on SPY 0DTE far out of the money and on AAPL at expiration). No contract with `last` = 0 was seen. | Verified | L11, L15, L13 |
| R9 Stock Daily Bars (blocker) | Met | See R5. | Verified | L4, L6 |
| R10 Option Daily Bars (Nice) | Not met | No options candles endpoint exists. The options section lists only chain, expirations, strikes, lookup and quotes. Quote records have no open, high or low. | Documented; Verified (fields) | https://www.marketdata.app/docs/api/ ; L11 |
| R11 Valid bars dated by session | Met | All 43 raw bars fetched satisfy low ≤ open, closing price ≤ high, with no negatives. `t` is midnight New York time of the session date. | Verified | L4 to L8, L14 |
| R12 Exact decimals | Met (adapter care) | Prices are JSON numbers with at most 4 decimals in bars and 3 in `mid` (0.005, 2.735). No float tails were seen. The adapter should convert with the shortest round-trip form (`String(n)`) and then check for at most 6 fractional digits. Rounding varies between endpoints: the same BRKB contract on 2026-11-13 had `mid` 6.875 from `options/chain` and 6.88 from `options/quotes`, and the quotes endpoint gives `mid` 0.01 for bid 0 / ask 0.01 where the chain gives 0.005. Because the Mark is the midpoint (Q1), the adapter should work it out from `bid` and `ask` with decimal arithmetic. Bid and ask have at most 2 decimals in every sample, so the midpoint has at most 3, well within 6. | Verified | L15, L16, L18, L20 |
| R13 Not needed, except bid and ask | Met | With Q1 settled as the midpoint, bid and ask are now needed. Every option record includes them. Responses also carry volume, open interest and sizes, which the adapter discards, and greeks are null historically. Leaving out fields does not lower cost for single-contract quotes. | Verified; Documented | L11, L12; https://www.marketdata.app/docs/api/rate-limiting |
| R14 History back to 2024-01-01 | Met on Starter or higher; Not met on Free | Free is limited to 1 year: NVDA 2024-06 returned **402** `"Free/Trial users can only access up to 1 year of data."` Starter has 5 years (reaching 2024-01-01 until about 2029, past the calendar's 2028 end). Trader and up are unlimited. Data goes back to 2010. AAPL 2024 data worked live because AAPL is exempt. | Verified (402); Documented | L9; https://www.marketdata.app/docs/account/plan-limits/ ; https://www.marketdata.app/data/index.md |
| R15 Expired contracts | Met | AAPL240719C00230000 (expired 2024-07-19) returned all 14 sessions 2024-07-01 to 07-19, including the expiration day (`dte` 0), and nothing for 07-22. SPY261113C00750000 (expired 2 days ago) and AAPL240719C00227500 on expiration day also returned. A contract that expired about 6 months ago was not fetched. | Verified | L11, L15, L18 |
| R16 Delisted or renamed stocks (Nice) | Unknown | Not documented; not tested. | — | https://www.marketdata.app/data/index.md (silent) |
| R17 As-traded prices | Met (adapter must set both flags) | Daily candles default to split- **and dividend**-adjusted (AAPL 2024-07-01 default `c` 214.5404 against raw 216.75). Raw needs `adjustsplits=false&adjustdividends=false`. `adjustsplits=false` alone is rejected with 400. Across AAPL's 2020-08-31 4-for-1 split, raw 2020-08-28 = 499.23 and split-only = 124.8075. The NVDA 2024-06-07 check was blocked by the free plan (402). Option records' `underlyingPrice` is raw. | Verified; Documented | L1, L4, L7, L8, L10; https://www.marketdata.app/docs/api/stocks/candles |
| R18 Same-evening availability | Not met on Free; Unknown on paid | Stocks become "Historical" at 16:15:01 New York time. Options become Historical only at **09:30:01 the next trading day**, and Free serves only Historical data ("24-hour delayed"). On Starter (15-minute delayed) and Trader (real-time), a quote request with no date returns "the last trading day's quote" when the market is closed. `mode=eod` gives "the most recent session past the 4:15 PM ET cutoff" on paid plans. So a paid plan probably gives option values around 16:15 to 16:30. Not tested (free account, Sunday). Non-professional stock candles are 15-minute delayed only after signing the UTP agreement; otherwise they are "Historical (1 day old)". | Documented; Inferred | https://www.marketdata.app/docs/account/data-freshness/ ; https://www.marketdata.app/docs/api/universal-parameters/mode ; https://www.marketdata.app/docs/api/stocks/candles |
| R19 Final or flagged provisional | Unknown | Not documented. Risk (Inferred): an evening value from a live or delayed quote may differ from the Historical record fixed the next morning. Re-fetching would then append a refresh revision. | Inferred | https://www.marketdata.app/docs/account/data-freshness/ (silent) |
| R20 US exchange dates | Met | Candle `t` = midnight New York time of the session (1719806400 = 2024-07-01 00:00). Option `updated` = 16:00 (or 13:00) on the session date. `expiration` = 16:00 on expiration day. Docs: "all dates use US Eastern Time". | Verified; Documented | L4, L11 |
| R21 NYSE calendar | Met | 2024-07-01 to 07-10: no 07-04, and 07-03 present. 2025-01-08 to 01-10: no 01-09. 2024-11-29 and 2024-12-24 present. Option quote on 2025-01-09: 404 `{"s":"no_data","errmsg":"Market closed on this date."}`. | Verified | L4, L5, L6, L13 |
| R22 Option closing time documented | Met | Historical option quotes are documented as 16:00 ET, and live records show 16:00, or 13:00 on early-close days. This means SPY/QQQ/IWM trading from 16:00 to 16:15 is **not** in the value. One oddity: SPY 0DTE 750 call on 2026-11-13 had mid 2.735 while the underlying closed at 754.37 (intrinsic value 4.37). The option snapshot seems to reflect an earlier underlying price (about 752.7). Cause unknown. | Verified; Documented | L15; https://www.marketdata.app/docs/api/options/quotes |
| R23 Date-range requests | Met | Stock candles: `from`/`to`, with "no maximum date range" for daily. Option quotes: `from`/`to` (22 sessions in one request, verified). The longest span for options is not documented. | Verified; Documented | L4, L12; https://www.marketdata.app/docs/api/stocks/candles |
| R24 Same-date legs; many per request | Met | All option records for a date share one 16:00 snapshot. Batching: `stocks/bulkcandles` gives many stocks for one date (verified, 3 symbols). `options/chain` with `date`, `expiration`, `strike` (list or range) and `side` gives many contracts of one underlying and expiry (verified, 11 contracts). `options/quotes` takes only one contract (two symbols gave 400 `Invalid option symbol`). | Verified | L15, L17, L19 |
| R25 Quota fits | Met on Starter; tight or failing on Free | Costs: daily candles 1 credit per 1,000 candles; historical option quotes 1 credit per 1,000 quotes; historical chain 1 credit per 1,000 symbols; bulk candles 1 credit per symbol; live or delayed quotes 1 credit per contract. Minimum 1 credit per successful response; errors and no-data cost nothing. (a) A 40-Instrument Review, one request each: about 40 credits. (b) 150 Instruments: about 150. (c) A 40 × 230-session backfill: about 40 credits (each range is under 1,000 rows). Free (100 a day) fits (a) only, and has no 2024 history. Starter (10,000 a day) fits all with wide room. There is no per-minute limit on Free, Starter or Trader, at most 50 concurrent requests, and the daily window resets at **09:30 New York time**, not midnight. | Documented; Verified (consumed counts) | https://www.marketdata.app/docs/api/rate-limiting ; L2, L16, L19 |
| R26 Readable rate-limit signals | Partly | Over the limit: 429, documented with no body format and no `Retry-After`. Not triggered live. Error responses carry `Access-Control-Allow-Origin: *`, so the browser reads status and body (verified for 401 and 404). **No `Access-Control-Expose-Headers`**: browser code reads `x-api-ratelimit-remaining` as `null`, so the adapter cannot see remaining credits. It can compute the reset (09:30 New York time). | Verified; Documented | B1 to B6; https://www.marketdata.app/docs/api/rate-limiting |
| R27 Per-Instrument partial results | Partly | Each stock range or contract is its own request, so one failure never sinks others. Options can tell the cases apart: an unknown contract gives 404 `{"s":"error","errmsg":"No option found…"}`, while a closure gives 404 `{"s":"no_data","errmsg":"Market closed on this date."}`. Stocks cannot: an unknown symbol (`ZZZQX`) and a known symbol over a weekend both return 404 `{"s":"no_data","prevTime":null,"nextTime":null}`. Bulk candles with an unknown symbol were not tested. | Verified | L13, L14, L22, L23 |
| R28 Distinguishable errors | Met | 401 `Invalid token.` (also `x-api-ratelimit-limit: 0`); 402 plan limit; 400 bad parameters or malformed OCC; 404 `no_data` or unknown contract; 429 quota or concurrency (documented). Outage (5xx) behaviour is not documented. No response echoed the token. Responses include `x-api-detected-ip` (the caller's IP), which the adapter must never store in diagnostics. | Verified; Documented | L8, L9, L13, L22, L23 |
| R29 No handshake | Met | Plain stateless GETs. One rule matters here: "Each account may only connect from one IP address at a time." The plan-limits page says simultaneous connections are not permitted, so two devices on different networks opening Review at once may be refused. | Verified; Documented | https://www.marketdata.app/docs/api/authentication ; https://www.marketdata.app/docs/account/plan-limits/ |
| R30 Direct browser calls (blocker) | Met | See section 2. | Verified | L1 to L3, B1 to B6 |
| R31 Browser-only auth | Met | A pasted token in `Authorization: Bearer <token>` (the documented scheme). `Token <token>` also worked, since the 401 says `www-authenticate: Token`. No OAuth and no client secret. Token lifetime and rotation are not documented, so they are Unknown. The token is issued from the dashboard and emailed. | Verified; Documented | L1, L20; https://www.marketdata.app/docs/api/authentication |
| R32 Least privilege | Met | Marketdata.app is a data vendor, not a broker, so the token cannot trade or move money. It can spend the account's credits. | Inferred | https://www.marketdata.app/docs/api/authentication |
| R33 Credential handling | Met | Header auth works. A `token=` query parameter also exists, but the docs warn that header auth keeps the token from being "stored or cached", so the adapter should never use the query form. No response, error included, echoed the token. | Verified; Documented | L22; https://www.marketdata.app/docs/api/authentication |
| R34 Provenance | Met (adapter) | Proposed `ProviderId`: `marketdata-app`. Label "Marketdata.app". The source for options is OPRA; for stocks, the docs mention SIP and IEX-derived prices. | Documented | https://www.marketdata.app/data/index.md |
| R35 Observation time (Nice) | Partly | Options: per-record `updated` (16:00 or 13:00 New York time). Stocks: only the session date (`t`), so the adapter uses the session closing time. | Verified | L4, L11 |
| R36 Descriptor | Met | See section 4, "Descriptor". | Mixed | — |
| R37 Testable without the service | Met | Docs give examples for success, no-data and error. Swagger UI is at the API root. The Free tier gives 100 credits a day, and AAPL is free of credits. | Documented; Verified | https://www.marketdata.app/docs/api/ |
| R38 Terms allow keeping data | Partly | Personal non-professional use is allowed, as is storage "on devices you own or control, including cloud storage". But "Storage is not indefinite": when a paid plan ends (including a move to Free), "you must delete the data that you downloaded on it, wherever you stored it, including backups". Free-plan data may be kept "while your account is open". There is no redistribution, and "Only you may have access to the data". Terms dated 2026-11-06. | Documented | https://www.marketdata.app/terms/ |
| R39 Cost (Nice) | Met | Cheapest compliant tier: Starter, $30 a month or $12 a month billed yearly. Free ($0) fails R14 and R18. No tier offers option bars. | Documented | https://www.marketdata.app/pricing/ |
| R40 Prerequisites (Nice) | Met | An email sign-up with no card and no brokerage account. The user must attest non-professional status. Signing the UTP agreement unlocks 15-minute delayed stock candles; without it they are "1 day old". | Documented | https://www.marketdata.app/pricing/ ; https://www.marketdata.app/docs/api/stocks/candles |
| R41 Stable versioned API (Nice) | Partly | The URL is versioned (`/v1/`) and responses carry `x-api-version: 2.0.0-…`. No changelog or deprecation policy was found. | Verified; Unknown (policy) | L2 |

## 4. Endpoint map

All requests are `GET https://api.marketdata.app…` with the header `Authorization: Bearer <token>` and no cookies. Treat 200 and 203 as success (203 means "served from the caching tier"). Parse `s`: `ok`, `no_data` or `error`.

| Use | Request | Returns | Batching and cost | Port mapping |
|---|---|---|---|---|
| Stock Daily Bars and Marks over a span | `/v1/stocks/candles/D/{SYMBOL}/?from=YYYY-MM-DD&to=YYYY-MM-DD&adjustsplits=false&adjustdividends=false` | Parallel arrays `t,o,h,l,c,v`; `t` = midnight New York time of the session | One symbol per request; no maximum span for daily; 1 credit per 1,000 bars (minimum 1) | Each index becomes a Daily Bar for (key, date). Its `c` is the Mark observation for that date. Observed-at = the session's closing time. |
| Many stocks, one date (the usual evening Review) | `/v1/stocks/bulkcandles/D/?symbols=A,B,BRK.B&date=YYYY-MM-DD&adjustsplits=false&adjustdividends=false` | Same arrays plus `symbol` | At most about 500 symbols, URL ≤ 4,094 bytes; 1 credit per symbol. `adjustdividends` is not documented on this page but was accepted. | Same as above. Fewer requests than per-symbol calls, at a similar credit cost. |
| One option contract over a span | `/v1/options/quotes/{OCC}/?from=YYYY-MM-DD&to=YYYY-MM-DD` | One record per session: `updated`, `bid`, `ask`, `mid`, `last`, `volume`, `underlyingPrice`, `optionSymbol` | One contract per request; 1 credit per 1,000 quotes (historical) | One Mark observation per session: (`bid` + `ask`) / 2, worked out by the adapter. Ignore `last` and `mid`. Observed-at = `updated` (16:00, or 13:00 on early-close days). No Bar. |
| Several contracts of one underlying and expiration on one date (multi-leg, same date) | `/v1/options/chain/{UNDERLYING}/?date=YYYY-MM-DD&expiration=YYYY-MM-DD&strike=K1,K2&side=call` (omit `side` for both sides, then filter) | Same fields as quotes, one row per contract | 1 credit per 1,000 symbols (historical) | Optional optimization for structures. The plain per-contract quotes path is enough. |
| Same-evening option values (paid plans only, untested) | `/v1/options/quotes/{OCC}/` with no date (or `mode=eod`) | The current or last session's quote with `updated` | 1 credit per contract | Accept only if `updated` falls on the requested session date at or after its closing time. Otherwise leave the key Missing. |
| Not needed | `options/lookup`, `options/expirations`, `options/strikes`, `markets/status` | — | — | OCC symbols map by rule, and the app has its own session calendar. `markets/status` is also 402 beyond one year on Free. |

**Instrument key mapping.** A Stock key goes through unchanged (`BRK.B` → `BRK.B`). An Option key is the OCC symbol unchanged (`BRKB261120C00590000`). The adapter matches answers by the requested key, or by `optionSymbol` on chain answers.

**Status mapping.**

| Response | Meaning for the adapter |
|---|---|
| 401 | Bad credential |
| 402 | Plan limit (history depth or mode) |
| 429 | Quota or concurrency limit |
| 400 | Adapter bug or malformed key |
| 404 + `s:"error"` on options | Unknown contract |
| 404 + `s:"no_data"` | No data for that span. For stocks, this may also be an unknown symbol. |
| `fetch` rejection | Network failure |

**Descriptor.**

| Field | Value | Label |
|---|---|---|
| ProviderId | `marketdata-app` | Proposed |
| Label | Marketdata.app | Documented |
| Credential fields | one secret field, "API token" | Documented |
| Instrument kinds | `Stock`, `Option` | Verified |
| Instruments per request | stocks: 1 (candles) or about 500 (bulk, one date); options: 1 (quotes) or one chain slice | Documented |
| Longest span | stocks: unlimited (daily); options: undocumented, 22 sessions verified | Documented; Unknown |
| Concurrency | 50 | Documented |
| Per minute | no limit (Free, Starter, Trader) | Documented |
| Per day | 100, 10,000 or 100,000 credits, resetting at 09:30 New York time | Documented |

## 5. Live test log

All requests sent `User-Agent: generic-client/1.0` and `Origin: https://example.pages.dev` unless noted. Auth was `Authorization: Bearer <token>` unless noted, with the token read from the file inside the command and never printed. In total: 30 GETs, 3 preflights and 6 browser fetches. Credits went from 100 to 88. Every response header list below omits Cloudflare and date headers.

Headers common to every data response: `access-control-allow-origin: *`, `x-api-ratelimit-limit: 100`, `x-api-ratelimit-reset: 1794753000` (2026-11-15 09:30 New York time), `x-options-data-permissions: historical_quotes_permission`, `allow: GET, HEAD, OPTIONS`. No `access-control-expose-headers`, `-allow-credentials` or `-allow-methods` appeared on GET answers.

| # | Request | Status | Key result |
|---|---|---|---|
| L1 | GET stock candles AAPL 2024-07-01..07-10, default adjustment, `Authorization: Token …` | 203 | 7 bars; `c[0]` 214.5404 (dividend-adjusted); `x-api-ratelimit-consumed: 0` (AAPL is free) |
| L2 | GET stock candles SPY 2026-11-02..11-13, Bearer | 203 | 10 bars, no gaps; consumed 1, remaining 99; `x-api-version: 2.0.0-654-g03111c7` |
| L3a | OPTIONS stock candles AAPL, `Origin: https://example.pages.dev`, `Access-Control-Request-Method: GET`, `Access-Control-Request-Headers: authorization` | 200 | `access-control-allow-origin: *`; `access-control-allow-headers: accept, accept-encoding, authorization, content-type, dnt, origin, user-agent, x-csrftoken, x-requested-with`; `access-control-allow-methods: DELETE, GET, OPTIONS, PATCH, POST, PUT`; `access-control-max-age: 86400`; `vary: Origin`; no `-allow-credentials`, no `-expose-headers` |
| L3b | Same with `Origin: http://localhost:5175` | 200 | Identical headers |
| L3c | Same preflight on `/v1/options/quotes/AAPL240719C00230000/` from localhost | 200 | Identical headers |
| L4 | GET candles AAPL 2024-07-01..07-10 raw (`adjustsplits=false&adjustdividends=false`) | 203 | Dates 07-01, 02, 03, 05, 08, 09, 10 (no 07-04); `c` = 216.75, 220.27, 221.55, 226.34, 227.82, 228.68, 232.98 |
| L5 | GET candles AAPL 2025-01-08..01-10 raw | 203 | Two bars: 2025-01-08 (c 242.7) and 2025-01-10 (c 236.85); no 01-09 |
| L6 | GET candles AAPL 2024-11-27..12-26 raw | 203 | 20 bars, including 2024-11-29 (c 237.33) and 2024-12-24 (c 258.2); no 11-28 or 12-25 |
| L7 | GET candles AAPL 2020-08-27..09-01 raw | 203 | `c` 500.04, 499.23, 129.04, 134.18 (as traded across the 2020-08-31 split) |
| L8 | GET candles AAPL 2020-08-27..09-01 `adjustdividends=false` (split-only) | 203 | `c` 125.01, 124.8075, 129.04, 134.18 |
| L8b | GET candles AAPL 2024-07-01..07-10 `adjustsplits=false` only | 400 | `{"s":"error","errmsg":"Unsupported parameter combination: adjustsplits=false with adjustdividends=true. …"}` |
| L9 | GET candles NVDA 2024-06-06..06-11 raw | **402** | `{"s":"error","errmsg":"Free/Trial users can only access up to 1 year of data."}`; consumed 0 |
| L10 | GET candles NVDA 2025-11-17..11-19 (default) | 203 | 3 bars, 4-decimal adjusted values (`c` 186.154); consumed 1 |
| L11 | GET option quotes AAPL240719C00230000 2024-07-01..07-22 | 203 | 14 records 07-01..07-19 (`dte` 18..0), none for 07-22; `updated` 16:00 New York time, except 07-03 at **13:00**; last row: bid 0, ask 0.01, mid 0.01, last 0.01, volume 44991; `underlyingPrice` equals raw AAPL closes; greeks null |
| L12 | GET option quotes AAPL260116P00100000 2024-07-01..07-31 | 203 | 22 records, one per session. Volume-0 days still have a record: 07-26, 29, 30, 31 all show `last` 0.53 with `volume` 0, and bid/ask change daily (0.46/0.66, 0.48/0.63, 0.50/0.67, 0.45/0.60) |
| L13 | GET option quote AAPL250117C00250000 `date=2025-01-09` | 404 | `{"s":"no_data","errmsg":"Market closed on this date."}` |
| L14 | GET candles BRK.B 2026-11-12..11-13 raw | 203 | 2 bars, `c` 589.83, 592.94; consumed 1 |
| L15 | GET chain SPY `date=2026-11-13&expiration=2026-11-13&strike=750-760&side=call` | 203 | 11 contracts SPY261113C00750000…00760000, all `updated` 16:00; 750 call bid 2.71, ask 2.76, mid 2.735, last 2.79; 756 to 760 calls bid 0, ask 0.01, mid 0.005; `underlyingPrice` 754.37; consumed 1 |
| L16 | GET option quotes AAPL271217C00250000 2026-11-09..11-13 (listed contract) | 203 | 5 records; 11-09 `volume` 0 with `last` 113.28 against mid 119.28 (stale last) |
| L17 | GET option quotes `AAPL240719C00230000,AAPL240719P00230000` `date=2024-07-03` | 400 | `{"s":"error","errmsg":"Invalid option symbol. Use valid OCC symbology for the option symbol."}` |
| L18 | GET option quote AAPL240719C00227500 `date=2024-07-19` | 203 | bid 0, ask 0.01, mid 0.01, last 0.01 (decimal strike works) |
| L19 | GET bulk candles `symbols=AAPL,SPY,BRK.B&date=2026-11-13` raw | 203 | `symbol` ["AAPL","SPY","BRK.B"], `c` [356.27, 754.37, 592.94]; consumed 3 (AAPL counted in bulk) |
| L20 | GET chain BRK.B `date=2026-11-13&expiration=2026-11-20&strike=590&side=call`; then GET option quotes BRKB261120C00590000 2026-11-12..11-13 with `Authorization: Token …` | 203, 203 | Root `BRKB`; chain mid 6.875 against quotes mid 6.88 for the same contract and date; each consumed 1 |
| L21 | GET lookup `AAPL 7/19/2024 227.5 Call` (URL-encoded) | 200 | `{"s":"ok","optionSymbol":"AAPL240719C00227500"}`; consumed 1 |
| L21b | GET expirations AAPL `date=2024-07-03` | 203 | 20 expirations as of that day, including weeklies 2024-07-05 and 07-12 |
| L22 | GET candles SPY with `Authorization: Bearer invalidtoken0000` | 401 | `www-authenticate: Token`; `x-api-ratelimit-limit: 0`; `{"s":"error","errmsg":"Invalid token."}`; CORS header present; token not echoed |
| L23a | GET option quotes AAPL240719C00231250 (no such strike) | 404 | `{"s":"error","errmsg":"No option found. No option was found for this strike and expiration."}` |
| L23b | GET candles ZZZQX (unknown) 2026-11-12..13 | 404 | `{"s":"no_data","prevTime":null,"nextTime":null}` |
| L23c | GET candles SPY 2026-11-14..11-15 (weekend) | 404 | `{"s":"no_data","prevTime":null,"nextTime":null}`, identical to L23b |
| L24 | GET markets status 2024-11-27..12-02 and 2025-01-08..01-10 | 402, 402 | `Free/Trial users can only access up to 1 year of data.` |
| L25 | GET candles AAPL, no dates (Sunday 01:40 New York time) | 203 | Latest bar is 2026-11-13 (Friday). Friday's option records were also served (L15, L16, L20), although the docs say Friday options become Historical only at Monday 09:30. |
| B1 to B6 | Headless Chromium (Playwright) pages with origin `https://example.pages.dev` and `http://localhost:5175`. Each page was served by request interception, so no port was opened. Each ran `fetch` with an `Authorization` header: SPY candles with the good token, SPY candles with a bad token, and the AAPL option on 2025-01-09. | 203, 401, 404 (both origins) | JSON bodies readable in page code in all cases; `response.headers.get('x-api-ratelimit-remaining')` = `null` (not exposed) |

## 6. Cost, plan limits and terms

| Plan | Price | Credits | History | Option data | Fit |
|---|---|---|---|---|---|
| Free Forever | $0 | 100 a day | 1 year | Historical only; day D after 09:30 on D+1 | Fails R14 and R18; fits a small Review |
| Starter | $30 a month, or $12 a month billed yearly | 10,000 a day | 5 years | 15-minute delayed | **Cheapest compliant tier** (same-evening options Inferred) |
| Trader | $75 a month, or $30 a month billed yearly | 100,000 a day | Unlimited | Real-time (OPRA) | More than needed |
| Quant, Prime | $125, $250 | Per minute | Unlimited | Real-time | Not needed |

Source: https://www.marketdata.app/pricing/ and https://www.marketdata.app/docs/account/plan-limits/. The 30-day trial of a paid plan gives delayed data and the Free plan's 1-year history limit (L9 says "Free/Trial users").

**Terms (https://www.marketdata.app/terms/, updated 2026-11-06), in plain words:**

- **Personal use only.** The licence is for "your own personal non-professional use" on devices you own or control, including cloud storage. One account per person, with no sharing ("Only you may have access to the data") and no redistribution.
- **Data must be deleted when a paid plan ends.** "Storage is not indefinite." When a paid plan ends, including a move to Free, the trader "must delete the data that you downloaded on it, wherever you stored it, including backups". Old backups may expire through normal rotation if they are never restored. Data from the Free plan may be kept while the account is open, and a Free account unused for 36 months may be closed.
- **No copying the database.** Downloading nearly all symbols to build a copy is forbidden. Number of years is not limited.
- **One IP at a time.** The auth docs say "each account may only connect from one IP address at a time".

For this journal, the deletion clause means that dropping a paid plan would oblige the trader to remove provider Marks and Bars from the journal and its backups. The app keeps them permanently (decision 37; `specs/design/market-data.md:157`), and replacing a provider keeps them on purpose. This is a user decision.

## 7. Risks and open questions

**Risks**

1. **Plan-ending deletion clause (R38).** See section 6. Options: accept it as a personal-licence matter, or keep the Starter plan for as long as the journal holds the data.
2. **Option Marks the same evening are untested (R18).** If the paid-plan evening quote does not carry the day's 16:00 values, option keys stay Missing until the next morning and become Manual tasks the evening before. Test on a paid trial, which still gives "delayed" data, during a weekday evening before the D11 breakdown fixes the recovery timing.
2b. **Evening and next-morning values may differ (R19).** If the evening path uses a delayed or live quote and a later recovery reads the Historical record, a different value appends a refresh revision. The adapter should not re-fetch provider days it already has (Q5), or should use one path consistently.
3. **Option Marks and option bars are different kinds of price.** Marketdata.app has no option bars, so no conflict arises today. But a Daily Bar's closing price is a last trade, while the option Mark is a midpoint. If a future provider supplies option bars, the rule "on an empty key, a Bar's closing price seeds the Mark" (`specs/design/market-data.md:123`) would seed a last trade where the user wants a midpoint. The D11 breakdown should state that option Marks come only from the midpoint, and that option Bars, if any, are evidence for D12 only. Wide spreads on illiquid contracts make the midpoint a rough value, but it is always present and exact-date.
4. **Default adjustment (R17).** Forgetting either flag gives dividend-adjusted history, and every later dividend would rewrite past values. The conformance suite should pin both flags.
5. **No option bars (R10).** D12 option-price Stops get no intraday high or low. They fall back to the exact Mark (spec-sanctioned).
6. **The browser cannot read rate-limit headers (R26).** The adapter learns about quota only from a 429. It should cap requests per Review (the descriptor bounds) and treat 429 as a transient diagnostic until 09:30 New York time.
7. **Unknown stock vs no data (R27).** Both look the same for stocks. An Instrument with a typo'd symbol just stays Missing (a Manual task). That is safe but undiagnosed.
8. **One IP at a time (R29).** Using the app on two devices on different networks at the same moment may be refused. Likely rare for one trader.
9. **0DTE snapshot timing (R22).** In L15 the 16:00 option snapshot for SPY 0DTE disagreed with the 754.37 underlying close (an in-the-money call priced below intrinsic value). Same-date structures still use one snapshot, but option and underlying Marks may not be from the same instant.
10. **Free-credit AAPL masks quota in tests (R37).** Smoke tests should include one non-AAPL symbol.

**Answers to the requirements file's open questions**

| Q | What Marketdata.app settles |
|---|---|
| Q1 Option Mark price | **Settled by the user: the closing bid/ask midpoint.** Marketdata.app supports this. Every past session, expired contracts included, has a 16:00 (13:00 on early-close days) `bid` and `ask`, even with no trade. The adapter should compute the midpoint itself rather than use `mid`, which is rounded differently by different endpoints (6.875 against 6.88). The provider has no option bars. Its only trade-based field is `last`, which is not used and is stale on volume-0 days. So the "Bar close seeds Mark" conflict does not arise with this provider (see risk 3). |
| Q2 Auction vs last trade | Not documented. The values match published closes. |
| Q3 Corporate actions | Raw prices are available, and the default is fully adjusted. Adjusted option contracts (`AAPL1`-style roots) were not tested and stay out of scope. |
| Q4 Request bounds | Concurrency 50; no per-minute limit on Free, Starter or Trader; daily credits by plan; 1 instrument per request (bulk: about 500 stocks on one date); no span limit for daily stock bars. |
| Q8 Review opened early | Stocks become Historical at 16:15:01. Options become Historical at 09:30 the next trading day, and on paid plans probably around 16:15 via a quote. A message such as "option prices usually arrive by 16:30" depends on the untested evening check. |
| Q9 16:15 options | Settled by the provider: values are a 16:00 snapshot (13:00 on early-close days), so post-16:00 SPY/QQQ/IWM trading is excluded. This matches the app's 16:00 session close. |
| Q10 Index options | Probably available: the chain endpoint has AM/PM settlement filters, and an indices candles endpoint exists. Untested. |
| Q12 Credential scope | Settled for this provider: the token is market-data only and cannot trade. |
| Q5, Q6, Q7, Q11 | Not settled by the provider. They remain for the D11 breakdown. |

**Still to test before or during the D11 breakdown:** an evening quote (about 16:35 New York time) on a paid trial, for one option and one stock; a 429 response body; bulk candles with an unknown symbol; the NVDA 2024-06-07 raw close on a paid plan (expect above $1,000); a weekly contract; a delisted stock.

## Sources

- https://www.marketdata.app/docs/api/
- https://www.marketdata.app/docs/api/authentication
- https://www.marketdata.app/docs/api/stocks/candles
- https://www.marketdata.app/docs/api/stocks/bulkcandles
- https://www.marketdata.app/docs/api/stocks/quotes
- https://www.marketdata.app/docs/api/options/quotes
- https://www.marketdata.app/docs/api/options/chain
- https://www.marketdata.app/docs/api/options/lookup
- https://www.marketdata.app/docs/api/options/expirations
- https://www.marketdata.app/docs/api/options/strikes
- https://www.marketdata.app/docs/api/markets/status
- https://www.marketdata.app/docs/api/rate-limiting
- https://www.marketdata.app/docs/api/universal-parameters/mode
- https://www.marketdata.app/docs/account/data-freshness/
- https://www.marketdata.app/docs/account/plan-limits/
- https://www.marketdata.app/data/index.md
- https://www.marketdata.app/pricing/
- https://www.marketdata.app/terms/
- https://apis.io/apis/marketdata-app/marketdata-app-indices-api/ (third-party OpenAPI listing, indices candles)
