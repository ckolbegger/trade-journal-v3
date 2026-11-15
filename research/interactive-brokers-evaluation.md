# Interactive Brokers (IBKR) as the Mark provider

Research task 3 of 4, written 2026-11-15. It judges every Interactive Brokers API surface against `research/mark-provider-requirements.md` (requirements R1 to R41, questions Q1 to Q12) for D11 (Automatic closing prices). It also assesses two ways to work around the browser limit: a proxy server (option A) and a gateway on the trader's Mac (option B).

This is documentation research only. No IBKR service was signed up for, logged in to or called. Every "Met" below therefore rests on documentation or community reports, not on a live test.

**User decision applied (2026-11-15):** open question Q1 is settled. An option's Mark is the **closing bid/ask midpoint**, not the last trade. R6 and R13 are judged on that basis.

**Evidence labels.** **Documented** means official IBKR documentation (`interactivebrokers.com/docs`, `ibkrguides.com`, `interactivebrokers.com/en/pricing`). **Community** means forums, GitHub projects or third-party articles; the date checked is given. **Inferred** means my reasoning from the documented behaviour, which a live test must confirm.

Main sources (all read on 2026-11-15):

- TWS API: [Historical Bars](https://www.interactivebrokers.com/docs/tws-api/doc/md/historical-bars), [Market Data Limitations](https://www.interactivebrokers.com/docs/tws-api/doc/md/market-data-limitations), [Pacing Limitations](https://www.interactivebrokers.com/docs/tws-api/doc/pacing-limitations), [Contract object reference](https://www.interactivebrokers.com/docs/tws-api/ref/contract), [Contract Details](https://www.interactivebrokers.com/docs/tws-api/doc/contracts/details), [Delayed Market Data](https://www.interactivebrokers.com/docs/tws-api/doc/md/delayed-data), [Historical Date Format](https://www.interactivebrokers.com/docs/tws-api/doc/tws-settings/historical-date-format), [Daily & Weekly Reauthentication](https://www.interactivebrokers.com/docs/tws-api/doc/tws-settings/daily-weekly-reauthentication), [Requirements](https://www.interactivebrokers.com/docs/tws-api/doc/notes-limitations/requirements), [2FA](https://www.interactivebrokers.com/docs/tws-api/doc/notes-limitations/supported-two-factor-authentication-2-fa), [Remote connections](https://www.interactivebrokers.com/docs/tws-api/doc/connectivity/remote-tws-api-connections-with-trader-workstation), [Error Codes](https://www.interactivebrokers.com/docs/tws-api/doc/error/codes).
- Web API: [Authentication introduction](https://www.interactivebrokers.com/docs/web-api/authentication/introduction), [Getting Started](https://www.interactivebrokers.com/docs/web-api/getting-started), [OAuth 2.0 registration](https://www.interactivebrokers.com/docs/web-api/authentication/oauth-2/register), [First-party OAuth 1.0a registration](https://www.interactivebrokers.com/docs/web-api/authentication/oauth-1a/first-party-oauth/registration-process), [Third-party access](https://www.interactivebrokers.com/docs/web-api/trading/getting-started/trading-access-for-third-parties), [Client Portal Gateway installation](https://www.interactivebrokers.com/docs/web-api/authentication/cpgw/installation-authentication), [Gateway limitations](https://www.interactivebrokers.com/docs/web-api/authentication/cpgw/limitations-of-the-client-portal-gateway), [Gateway FAQ](https://www.interactivebrokers.com/docs/web-api/authentication/cpgw/client-portal-gateway-faq), [Authentication FAQ](https://www.interactivebrokers.com/docs/web-api/authentication/faq), [Trading sessions](https://www.interactivebrokers.com/docs/web-api/authentication/trading), [Multiple sessions](https://www.interactivebrokers.com/docs/web-api/authentication/multiple-sessions), [Pacing](https://www.interactivebrokers.com/docs/web-api/trading/usage-and-availability/pacing-limitations), [Server maintenance](https://www.interactivebrokers.com/docs/web-api/trading/usage-and-availability/scheduled-server-maintenance), [Historical OHLC reference](https://www.interactivebrokers.com/docs/web-api/api-reference/trading/trading-market-data/get-md-history), [Historical Market Data](https://www.interactivebrokers.com/docs/web-api/v1/endpoints/market-data/historical-market-data), [Unavailable Historical Data](https://www.interactivebrokers.com/docs/web-api/v1/endpoints/market-data/unavailable-historical-data), [Websocket historical data](https://www.interactivebrokers.com/docs/web-api/ws/historical-data), [Snapshots](https://www.interactivebrokers.com/docs/web-api/trading/market-data/top-of-book-snapshots), [Finding option chains](https://www.interactivebrokers.com/docs/web-api/trading/instrument-discovery/finding-options-chains), [Validate the contract](https://www.interactivebrokers.com/docs/web-api/v1/endpoints/option-chains/step-three-validate-the-contract), [OpenAPI spec](https://www.interactivebrokers.com/docs/openapi/api-reference.json).
- Flex Web Service: [Introduction](https://www.interactivebrokers.com/docs/web-api/flex-web-service/introduction), [Access token](https://www.interactivebrokers.com/docs/web-api/flex-web-service/client-portal-configuration/enable-and-create-access-token), [Generate a report](https://www.interactivebrokers.com/docs/web-api/flex-web-service/using-flex-web-service/generate-the-report), [Error codes](https://www.interactivebrokers.com/docs/web-api/flex-web-service/error-codes), [Open Positions fields](https://ibkrguides.com/reportingreference/reportguide/open%20positionsfq.htm), [Prior Period Positions fields](https://ibkrguides.com/reportingreference/reportguide/prior%20period%20positions.htm).
- Market data: [Market Data Requirements](https://www.interactivebrokers.com/docs/general/market-data-subscriptions/market-data-requirements), [Minimum equity](https://www.interactivebrokers.com/docs/general/market-data-subscriptions/market-data-subscription-minimum-equity-balance-requirements), [API Acknowledgement](https://www.interactivebrokers.com/docs/general/market-data-subscriptions/compliance-requirements-for-api-market-data/market-data-api-acknowledgement), [Professional vs Non-Professional](https://www.interactivebrokers.com/docs/general/market-data-subscriptions/professional-vs-non-professional), [Popular subscriptions](https://www.interactivebrokers.com/docs/general/market-data-subscriptions/popular-market-data-subscriptions/introduction), [Understanding subscriptions](https://www.interactivebrokers.com/docs/general/market-data-subscriptions/understanding-market-data-subscriptions), [TWS data vs API data](https://www.interactivebrokers.com/docs/general/market-data-subscriptions/tws-data-vs-api-data), [Data sharing with paper](https://www.interactivebrokers.com/docs/general/market-data-subscriptions/market-data-users/market-data-sharing), [Market data pricing](https://www.interactivebrokers.com/en/pricing/market-data-pricing.php).
- Community: [IBeam](https://github.com/Voyz/ibeam) (headless Client Portal Gateway login; repo active 2026-11-08), [IBC user guide](https://github.com/IbcAlpha/IBC/blob/master/userguide.md) (TWS and IB Gateway login automation; release 3.24.2, 2026-08-21), [ib-gateway-docker](https://github.com/gnzsnz/ib-gateway-docker) (active 2026-11-13), [IBind](https://github.com/Voyz/ibind) (Web API client; active 2026-11-08), IBKR Campus contributor articles on expired options ([part I](https://www.interactivebrokers.com/campus/ibkr-quant-news/historical-options-futures-data-using-tws-api/), 2021-12-23; [part II](https://www.interactivebrokers.com/campus/ibkr-quant-news/historical-options-futures-data-using-tws-api-part-ii/), 2022-01-03), and Chrome's Local Network Access change (Chrome 142, October 2025; for example [Dynamsoft's note](https://www.dynamsoft.com/web-twain/docs/faq/chromium-142-local-network-access-issue.html)).

---

## 1. Verdict

**Recommendation: not suitable as the D11 provider.** I do not recommend option A or option B either. If the user still wants IBKR, option B (the trader's own TWS or IB Gateway plus a tiny local bridge) is clearly better than option A.

**In plain words.** IBKR has good data for stocks and for options that are still trading, and it does provide the closing bid/ask midpoint the user chose for option Marks. It fails the journal on four points that no setup can fix:

1. **No direct browser access.** An individual account cannot call IBKR from a web page with a pasted key. The only way in for individuals is a program the trader runs (the Java Client Portal Gateway, TWS or IB Gateway) and logs in to with their full brokerage username, password and phone approval. Token-based access (OAuth) is limited to institutions and approved software vendors. This fails blocker R30 and requirement R31. Options A and B both get around it by adding exactly what decision 15 calls "new infrastructure outside the spec".
2. **No data at all for expired options.** IBKR states that historical data for expired option contracts is unavailable; its error code 166 is "HMDS Expired Contract Violation". The app needs closing prices up to and including the expiration date: for Settlement Due Trades, for expired legs of an open spread, after turning the provider on late, and when catching up on skipped days. If the trader skips the Review on an expiration evening, that day's option Mark can never be fetched. This fails Must requirement R15.
3. **Stock prices are rewritten after splits.** IBKR's daily trade bars are adjusted for splits, and there is no unadjusted choice. A first-time backfill across a split (NVIDIA on 2024-06-07) would return about $120, not the price actually traded that day (over $1,000). IBKR also says its historical data "may differ" when requested at different times. This fails R17 for backfills and R19.
4. **The credential is the trader's brokerage login.** It can place trades and move money (R32). IBKR also allows only one brokerage session per username across TWS, mobile and the API. A data connection can therefore knock the trader's own trading session off, or be knocked off by it.

There is daily friction too. The Client Portal Gateway needs a browser login with 2FA **every day**, and IBKR "does not support an automated authentication process" for it. TWS and IB Gateway need a 2FA approval **once a week**, and they restart themselves daily. The account must also be a funded IBKR Pro account with at least USD 500 in equity, plus paid data subscriptions (about USD 1.50 to 14.50 a month for a non-professional).

**What IBKR does well, so the comparison is fair.** For live contracts it covers all US stocks, ETFs and options (OPRA), including weeklies, 0DTE contracts and decimal strikes. The TWS API takes a rule-built contract with no lookup call. Daily bars are dated by exchange date. MIDPOINT daily bars give the last bid/ask midpoint of the session, which is exactly the Mark the user chose. There is no per-day request quota beyond rate pacing, and the data is cheap if the trader already pays IBKR commissions.

**If the user still wants IBKR**, choose option B with TWS or IB Gateway. It is the better choice if the trader already runs TWS on this Mac for trading:

- the brokerage credential never leaves the Mac;
- there is one 2FA approval a week;
- hosting costs nothing.

Option A puts the brokerage password on an internet-reachable server, depends on login automation IBKR does not support, and adds hosting cost. Either way, R15, R16, R17 and R19 stay unmet, so the trader would still type expired-contract and split-crossing Marks by hand.

---

## 2. API surfaces

| Surface | Auth | How it is reached | Data for our needs | Limits | Label |
|---|---|---|---|---|---|
| **TWS API** (socket API of Trader Workstation or IB Gateway) | Full IBKR username, password and 2FA, entered in TWS or IB Gateway. The API client then connects to the local socket with no credential. | A raw TCP socket (protobuf messages since 2025) to `127.0.0.1:7496/7497` (TWS) or `4001/4002` (IB Gateway). A browser cannot open it, so it needs a local or remote bridge. | `reqHistoricalData` with `barSizeSetting="1 day"` and `whatToShow` set to TRADES, MIDPOINT, BID, ASK, BID_ASK or ADJUSTED_LAST, for stocks, ETFs and **live** options. `reqContractDetails` (no expired options). `reqHeadTimestamp` gives the earliest available date. SCHEDULE bars give the trading calendar. | 50 messages per second with the default 100 market data lines. Historical pacing: no identical request within 15 s; no six or more requests for the same contract and tick type within 2 s; no more than 60 requests in 10 minutes, a rule the docs file under small bars of 30 s or less. BID_ASK counts twice. Daily bars can span years per request. Expired options: none. Unadjusted stock history: none. | Documented |
| **Web API through the Client Portal Gateway** (the only Web API route for individual accounts) | A browser login on the same machine, with 2FA, at least **daily**; "not support[ed]" to automate. Then `POST /iserver/auth/ssodh/init`, wait 2 s, `GET /iserver/accounts`, and keep alive with `/tickle` (the session times out after about 6 minutes idle). | HTTPS to the Java gateway on `https://localhost:5000` (self-signed certificate). The gateway holds the session, so callers send no cookie or token. Its default `conf.yaml` ships `cors: origin.allowed: "*"` (Community: IBeam copy, 2026-11). | `GET /iserver/marketdata/history` with `source` Last, Midpoint or Bid_Ask and bar `1d`, at most 1000 points. Contract IDs come from `/iserver/secdef/search`, then `/iserver/secdef/strikes`, then `/iserver/secdef/info` (several calls per option, though the ID is stable for the option's life). `/iserver/marketdata/snapshot` is live only and needs a "pre-flight" call. | 10 requests per second overall. History: 10/s or 50/min. 429 on excess, then a penalty box of 10 to 15 minutes. 5 concurrent history requests on the websocket. `/iserver` is unavailable around 01:00 ET nightly. Same expired-option and adjustment limits. | Documented |
| **Web API through OAuth 1.0a / 2.0** (`https://api.ibkr.com`) | Signed RSA or Diffie-Hellman assertions with private keys. "**OAuth 2.0 is not available to Individual account structures**." First-party OAuth 1.0a is for "institutions". Third-party OAuth needs a business entity and a Compliance review taking weeks. | Server-to-server. Private keys cannot be held safely in a browser, and there is no PKCE public-client flow. CORS on `api.ibkr.com` is undocumented. | Same endpoints as above. | Same as above. | Documented |
| **`/hmds/history`** (old "beta" history endpoint) | Same as the gateway. | Gateway. | Daily bars, `barType` Last, Bid, Ask or Midpoint. | Missing from the current official API reference. Its first call returns 404. | Community (IBind, 2026-11) |
| **Flex Web Service** (Flex Queries) | A read-only reporting token, created in Client Portal, valid from 6 hours to 1 year, with optional IP restriction. Sent in the **query string**. | `GET https://ndcdyn.interactivebrokers.com/AccountManagement/FlexWebService/SendRequest`, then `/GetStatement`. Returns XML. CORS is undocumented (likely absent, Inferred; not tested, by instruction). | **Only positions held in the trader's IBKR account.** Open Positions gives "Mark Price: the closing price of the position as of the report date". Prior Period Positions gives the previous day's price per date. Date ranges use `fd`/`td`. No OHLC, and nothing for trades held at another broker. | 1 request per second and 10 per minute per token. Reports are produced by IBKR's statement process, so timing is not real-time. IBKR's price method for option marks is undocumented. | Documented (fields); Inferred (CORS, timing) |
| Excel (DDE, RTD, ActiveX) and FIX | Not relevant: built on TWS, or institutional only. | | | | Documented |

**Option daily bars and the midpoint Mark (Q1 settled as the midpoint).** All Documented, from the Historical Bars page and the Web API reference:

- **MIDPOINT** (TWS) and **Midpoint** (Web API): open is the starting midpoint, high and low are the highest and lowest midpoints, and **close is the "last midpoint price"** of the bar. Options are a supported product. For a 1-day bar with `useRTH=1`, the closing value is the bid/ask midpoint at the end of the regular session. That is the user's chosen Mark.
- **BID_ASK** / **Bid_Ask**: open is the **time-average bid**, close is the **time-average ask**, high is the max ask and low is the min bid. These are **not** end-of-session quotes, so they must **not** be used for the Mark. They also break the R11 ordering rule.
- **BID** and **ASK** (TWS; the Web API only on the websocket): close is the last bid or last ask of the bar. (BID close + ASK close) / 2 also gives the session-end midpoint, at the cost of two requests per contract. This is a cross-check only.
- **TRADES** / **Last**: close is the last trade. It is no longer the Mark, but it gives the trade range if D12 should use traded highs and lows.
- **Time the value represents (Inferred).** With regular trading hours only, the bar ends at the contract's liquid-hours close from `reqContractDetails`: 16:00 New York time for most equity options, and **16:15 for SPY, QQQ, IWM and similar ETF options**. The app's session is complete at 16:30, so both are ready in time. Legs of one structure on different products could still be stamped 16:00 and 16:15 (Q9).
- **Conflicting doc line.** The same pages list "End of Day (EOD) data for options" under unavailable historical data. This most likely refers to IBKR's separate EOD dataset, not to 1-day bars, but **a live test must confirm that 1-day MIDPOINT bars return for a live option** (Inferred).
- **Expired contracts:** no MIDPOINT, BID, ASK or TRADES bars at all once a contract has expired (Documented; error 166). `includeExpired` works for futures only: "Expired options or other instrument types are not available" (Documented, Contract reference).

---

## 3. Requirements

Columns: **TWS/B** means the TWS API through option B (local TWS or IB Gateway plus a local bridge). **A** means option A (a proxy server running IB Gateway, or the Client Portal Gateway, plus a bridge). **CPGW** means the browser calling the Client Portal Gateway on localhost directly. Where all three agree, one value is given. Labels: D = Documented, C = Community, I = Inferred.

| # | Requirement | Status | Evidence | Label |
|---|---|---|---|---|
| R1 | US stocks and ETFs, including `BRK.B` | **Met** | A Level 1 subscription covers NYSE, AMEX/ARCA and NASDAQ listings. IBKR spells class shares with a space (`BRK B`), so the adapter maps `.` to a space by rule. | D (coverage); C/I (spelling) |
| R2 | Monthly, weekly, 0DTE and decimal-strike options | **Met for live contracts** | "The OPRA market data subscription will provide options data for all options in the United States." Contracts take an exact `YYYYMMDD` expiry and a decimal strike. | D |
| R3 | Rule-based contract mapping | **TWS/B and A: Met. CPGW: Partly** | TWS: a contract built from symbol, `OPT`, expiry, strike, right, `SMART`, `USD` and multiplier 100 needs no lookup. The returned `localSymbol` is "the OCC symbol" (padded), so it maps back by rule. A dotted root uses symbol `BRK B` with trading class `BRKB` (I). The Web API needs a `conid` per contract: search, strikes and info, about 3 calls the first time. The conid "will remain constant" for the option's life, so it can be cached, but it cannot be looked up after expiry. | D, I |
| R4 | Index options and index levels (Nice) | **Partly** | SPX, SPXW (trading class), NDX, RUT and VIX are available. Index levels need separate index subscriptions: "the underlying Index will not be included" in OPRA. The expired-contract limit applies here too. | D |
| R5 | Stock closing price per session | **Met** | The 1-day TRADES bar close is the last regular-session trade. IBKR "filters" historical trades (Q2: not necessarily the official auction price). | D, I |
| R6 | Option closing price per session (blocker), judged as the **closing bid/ask midpoint** | **Met for live contracts; Not met once expired** | The MIDPOINT 1-day bar close is the "last midpoint price" of the regular session. BID_ASK must not be used (its close is the time-average ask). The underlying's Mark comes from the stock TRADES bar. The "EOD data for options" line needs a live test. Expired contracts return nothing (see R15). | D; I (session-end timing) |
| R7 | Exact-day values only | **Met (Inferred)** | Daily bars are built only from that session's quotes or trades. A day with no quotes gives no bar; nothing is carried forward. Do not use snapshot field 31 (last), which can be stale. | I |
| R8 | Zero vs missing | **Met (Inferred)** | Missing data means no bar or an error message. A midpoint can be very small but is 0 only with a zero bid and zero ask. Snapshots use −1 or empty for missing quotes. | D (snapshot −1); I |
| R9 | Stock Daily Bars (blocker) | **Met** | 1-day TRADES bars give OHLC. | D |
| R10 | Option Daily Bars (Nice) | **Partly** | MIDPOINT or TRADES 1-day bars for live options. Live test needed (the "EOD" line). Nothing once expired. With the midpoint Mark, MIDPOINT bars keep the Bar's closing price equal to the Mark (a good fit for the "Bar seeds an empty key" rule), but their high and low are midpoint extremes, not traded extremes (a D12 choice). | D, I |
| R11 | Valid Bars | **Met for TRADES and MIDPOINT; Not met for BID_ASK** | TRADES and MIDPOINT are true OHLC. BID_ASK mixes bid and ask averages, so the low ≤ open, closing price ≤ high ordering is not guaranteed. | D |
| R12 | Exact decimals | **Partly (adapter fixes it)** | TWS returns `double`; the Web API returns JSON numbers. Float tails are possible. The adapter must round to the contract's `minTick` (from contract details), and keep up to 6 decimals for midpoints such as 1.025. | D, I |
| R13 | Unneeded data; **bid and ask are now needed** | **Met** | Bid and ask are available as BID, ASK and MIDPOINT bars for each live session. Volume and similar fields are discarded. No cost saving from leaving them out. | D |
| R14 | History back to 2024-01-01 | **Stocks: Met. Options: Partly** | 1-day bars allow durations of years (TWS table up to 68 Y; Web API up to 15 y and 1000 points). Live options: back to listing (I). Expired: none. | D, I |
| R15 | Expired option contracts | **Not met** | "Expired options, FOPs, warrants and structured products" are listed as unavailable. Error 166 is "HMDS Expired Contract Violation". `includeExpired` covers futures only. IBKR Campus contributor articles (2021-12-23 and 2022-01-03) say IB "does not provide historical data for expired options contracts". The only window is the evening of the expiration day itself, before IBKR's nightly reset; whether the contract still resolves then is **Unknown** (C/I). | D, C |
| R16 | Delisted and renamed stocks (Nice) | **Not met** | "Data for securities which are no longer trading" is unavailable. Renames keep the same `conid` (I). | D |
| R17 | As-traded (unadjusted) prices | **Not met for backfills; Met for same-evening fetches** | "TRADES data is adjusted for splits, but not dividends." ADJUSTED_LAST is adjusted for both. There is no unadjusted option. MIDPOINT adjustment is undocumented (Unknown). A value fetched on the evening of its own session is as-traded, because the split has not happened yet. A backfill or re-fetch across a split is rewritten. The API offers no split calendar to detect this. | D |
| R18 | Same-evening availability | **Met (Inferred)** | Today's 1-day bar is built from the live feed and is complete when the session ends (`keepUpToDate` updates daily bars during the day). Delayed-frozen data for the current day "is not available until 15 minutes after market close". | D (delayed); I |
| R19 | Final values, or provisional ones flagged | **Not met** | "As historical data at IB gets adjusted, compressed and filtered by default, there may be historical data differences if you request historical data at different time points." There is no provisional flag. Mitigation: never re-fetch provider days (Q5). | D |
| R20 | US exchange dates | **TWS/B and A: Met. CPGW: Partly** | TWS: "for day bars, only yyyyMMdd format is available", that is the trading date. The Web API returns an epoch `t` described as the start of the bar in the "Operator Timezone". It needs a conversion rule, checked against samples. | D; I |
| R21 | Same calendar as NYSE | **Met (Inferred)** | Bars exist only for sessions. Early-close days carry their own date. Holidays and 2025-01-09 have no bar. Cross-check with `whatToShow=SCHEDULE`. The adapter still discards non-sessions. | D (SCHEDULE); I |
| R22 | Documented option closing time | **Partly** | No page says "the option closing price is taken at …". The time follows the contract's `liquidHours` (16:00, or 16:15 for SPY, QQQ, IWM and similar) with `useRTH=1`. | D (liquid hours); I |
| R23 | Date-range requests | **Met** | `durationStr` with `endDateTime` (TWS), or `period` with `startTime` (Web API). | D |
| R24 | Same-date legs; several symbols per request | **Partly** | One contract per history request (both APIs). Every leg is fetchable for the same date by separate requests, so the Must part is met. Multi-symbol history (Nice) is not available. The multi-conid snapshot is live only. | D |
| R25 | Quota fits the workload | **Met with pacing** | No daily cap and no per-request cost. (a) 40 Instruments: TWS takes about 40 requests (plus 25 more if BID and ASK are cross-checked), seconds of work. The Web API takes 40 history calls plus about 75 one-time conid lookups at 50/min, about 2 to 3 minutes the first time. (b) 150 Instruments: TWS takes about 150 requests. If IBKR applied the 60-per-10-minutes rule to daily bars, that would be 25 minutes. The docs scope that rule to small bars, so a live test is needed. The Web API takes about 3 to 5 minutes. (c) Backfill of 40 × 230 sessions: 40 requests, one per Instrument. | D, I |
| R26 | Readable rate-limit signals | **TWS/B and A: Met by bridge design. CPGW: Partly** | The Web API returns 429 (D). Whether the gateway adds CORS headers to error responses is Unknown. TWS gives error 100 or 162 messages; the bridge maps them to HTTP 429 with CORS. | D, I |
| R27 | Per-Instrument partial results | **Met** | Each request fails alone with a distinct code: 200 (no security definition, an unknown contract), 162 or 165 (no data), 166 (expired), 354 or 10089 (not subscribed). | D |
| R28 | Distinguishable errors | **Met (through the adapter or bridge)** | Auth or session: 504 "Not connected", 1100 connectivity lost, Web API 401, `/iserver/auth/status`. Quota: 100 or 429. No data: 162 or 165. Unknown contract: 200. Outage: 2105, 1100, 503. No token is ever echoed (TWS has none; the Flex token sits in the URL and must be scrubbed). | D |
| R29 | No mandatory handshake | **Not met (provider); adapter can still degrade safely** | TWS needs a running, logged-in TWS or IB Gateway plus a socket handshake. CPGW needs a daily browser login, `ssodh/init`, a 2 s wait, `/iserver/accounts`, and `/tickle` every few minutes. When these are absent, the adapter reports "provider not reachable" and every Manual path still works. | D |
| R30 | Direct browser calls (blocker) | **Not met** | Individuals can use only the gateway route; OAuth is closed to them. A works only through a new server. B works only through a local gateway or bridge, which the requirement excludes by name. | D |
| R31 | Browser-only auth | **Not met** | CPGW: a daily browser login with 2FA, automation unsupported. TWS: a weekly 2FA, auto-restart daily. No pasted token or PKCE flow exists for market data. | D |
| R32 | Least privilege | **Not met (risk); partly mitigable** | The only credential is the brokerage login (trading and money movement). Mitigations: (1) a **paper-trading username**, which can share the live user's market data ("Each Live user can share data with one (1) Paper account") and cannot trade real money, but loses live data during a competing live session (error 10197); (2) a second username, which IBKR charges a separate data fee for ("any username subscribed will be assessed a separate market data subscription fee"). Whether a data-only user without trading rights is possible is Unknown. In B, the browser never holds the IBKR credential. | D; Unknown |
| R33 | Credential handling in the app | **Met by design (A and B)** | The app stores only a bridge or proxy URL plus a bearer token, sent in a header, write-only and outside backups. The IBKR password lives in TWS, IB Gateway or the server, never in the app. Restore gives Needs Setup. | I |
| R34 | Stable provenance | **Met** | Proposed `ProviderId`: `ibkr-tws-bridge` (or `ibkr-cpgw`). Data source: IBKR historical data service (consolidated CTA/UTP; OPRA for options). | I |
| R35 | Observation time (Nice) | **Partly** | Daily bars carry only a date, so the adapter uses the session's closing time. | D |
| R36 | Descriptor fields | **Partly** | Label "Interactive Brokers (TWS)". Credential fields: bridge URL (not secret) and bridge token (secret). Kinds: Stock and Option (later Index). Bounds: 1 Instrument per request (D); span up to years per request (D); concurrency 5 on the Web API (D), about 50 on TWS (C); rate 50/min for Web API history (D), 50 msgs/s and historical pacing on TWS (D). | D, C |
| R37 | Testable without the real service | **Partly** | The Web API publishes an OpenAPI spec (`/docs/openapi/api-reference.json`), so an emulator can be built from it. For TWS, the app would test against an emulator of **our own bridge's** HTTP contract. The bridge itself needs a paper account and TWS for its own tests. There is no free tier or sandbox without a funded account. | D |
| R38 | Personal-use terms that allow keeping data | **Partly / Unknown** | Non-professional data is "licensed only for personal use" (IBKR GFIS subscriber agreement, C). No clause found on keeping EOD prices on the user's device. Users are **classified Professional by default** until they change their status (D). A Market Data API Acknowledgement is required, and the availability table calls it "annual" (D). | D, C |
| R39 | Cost (Nice) | **Partly** | Non-professional: OPRA Top of Book USD 1.50/month (waived at USD 20 commissions), plus stock Level 1. The cheapest documented bundle is US Securities Snapshot and Futures Value Bundle USD 10 (waived at USD 30 commissions) plus US Equity and Options Add-On Streaming Bundle USD 4.50, which includes the three stock networks and OPRA: about **USD 14.50 a month before waivers**. Option A adds hosting (about USD 5 to 20 a month, I). | D |
| R40 | Prerequisites (Nice) | **Heavy** | A funded, open **IBKR Pro** account (Lite is not supported), USD 500 equity plus subscription costs, data active the next business day after funding, the API acknowledgement, a non-professional status change, a supported 2FA method (IB Key, SMS or similar), and Java (CPGW) or the TWS / IB Gateway install. | D |
| R41 | Stable, versioned API (Nice) | **Partly** | TWS API has Stable and Latest releases and a changelog. The Web API has a changelog, but endpoints move (`/hmds/history` dropped from the reference; `/iserver/reauthenticate` deprecated). | D, C |

**Checklist summary.** Blockers: R6 met for live contracts; R9 met; **R30 not met**. Other Musts not met: **R15, R17 (backfill), R19, R29, R31, R32**. Open questions this answers: Q1 (settled as the midpoint; IBKR serves it as the MIDPOINT bar's closing price), Q9 (SPY-type options end at 16:15 in IBKR bars), Q10 (index options are possible but cost extra and also lose expired data), Q12 (IBKR offers no data-only token).

---

## 4. Options A and B in detail

Both options give up decision 15's "no server, proxy or local gateway" condition, so either one needs the user's explicit approval as a spec change.

### Option A: a proxy server

**What it is, in plain words.** An always-on computer somewhere runs IBKR's software logged in as the trader. A small program on it answers the app with prices over HTTPS.

**Pieces needed.**

- **A Cloudflare Worker alone cannot do it.** The TWS API talks to a running TWS or IB Gateway, and the Web API for individuals needs a running Client Portal Gateway. Both are Java desktop programs that need an always-on host (I). A Worker could only sit in front of that host, adding authentication and CORS (for example through Cloudflare Tunnel).
- **Host:** a small VPS (about USD 5 to 20 a month, I) or a home machine.
- **Best variant (C):** IB Gateway with IBC in Docker (`gnzsnz/ib-gateway-docker`). IBC types the username and password, IB Gateway auto-restarts daily without logging in again, and the trader approves **one IBKR Mobile push per week** (Documented weekly reauthentication; IBC guide: "authentication is only required the first time during the week that TWS or Gateway run after 01:00 ET on Sunday"). A bridge built on `ib_async` or similar exposes `GET /observations?…` with a bearer token and CORS for the `*.pages.dev` origin.
- **Client Portal Gateway variant:** IBKR documents "Users must log in through the browser on the same machine as Client Portal Gateway" and "does not support an automated authentication process". IBeam (C) automates the login with headless Chrome, but 2FA is needed **daily**, and IBeam's own README calls itself "Not so secure". It is worse than IB Gateway.

**Daily friction.** One push approval per week. A missed push, an IBKR outage or a Saturday maintenance leaves the server logged out until the trader notices. IBKR resets its servers nightly between about 00:00 and 01:00 ET (D). The trader's Review usually runs earlier, so this is mostly harmless.

**Security.**

- The brokerage username and password sit on an internet-connected server in plain environment variables or Docker secrets. IBeam notes they "are still accessible in plaintext via the running container".
- A compromise exposes trading and money movement.
- The bridge must not be reachable without its token. Use Cloudflare Access or Tunnel rather than an open port.
- Using the paper username (with shared data) removes real-money trading risk. It loses live data during competing live sessions (error 10197, D); whether historical data is affected is Unknown.

**Terms.** Data for one non-professional's personal use, served only to themselves, is not obviously redistribution (I). An unauthenticated endpoint would be.

**Cost.** Hosting about USD 5 to 20 a month, plus IBKR data (section 5), plus engineering and maintenance of a server, a container and a bridge.

**Fit with the adapter boundary (decision 14).** Good on the app side. The adapter calls one HTTPS endpoint with a header token, the credential stays write-only and out of backups, and the descriptor holds the URL and token. But the real provider logic moves into a second, server-side codebase outside the app's tests and conformance suite. That is "new infrastructure outside the spec".

**Feasibility:** technically feasible, operationally fragile. **Not recommended.**

### Option B: IBKR software on the trader's Mac

**What it is, in plain words.** The trader runs TWS or IB Gateway (or the Client Portal Gateway) on the same Mac, and the browser app asks it for prices through localhost.

**B1: the browser calls the Client Portal Gateway directly (`https://localhost:5000`).**

- *Reachability.* The gateway holds the session itself, so the page needs no cookies (IBKR's own JavaScript example calls `fetch("https://localhost:5000/v1/api/iserver/marketdata/snapshot…")` with no credentials). The default `conf.yaml` ships `cors: origin.allowed: "*"` with `allowCredentials: false` (C, IBeam copy, 2026-11). A simple GET then needs no preflight.
- *Blocking points (I/C):*
  1. The **self-signed certificate.** `fetch` fails until the browser trusts it. The fix is a locally trusted certificate (for example mkcert) loaded through `sslCert` in `conf.yaml`. Clicking through Chrome's warning on the login page may or may not carry over to cross-origin fetches.
  2. **Chrome 142+ "Local Network Access"** (October 2025, C). A public `*.pages.dev` page that calls `localhost` triggers a one-time permission prompt. If the trader denies it, calls fail. Development on `http://localhost:5175` is loopback-to-loopback and is not prompted.
  3. Port 5000 is often taken on macOS (AirPlay Receiver). IBKR recommends changing the port (D).
- *Friction (D):* a browser login with 2FA **every day**. `ssodh/init` with `compete=true` **ends any TWS or mobile brokerage session** of the same username. The session dies after about 6 minutes without `/tickle`. The app must also do the init, wait and `/iserver/accounts` ritual, plus conid lookups.
- *Verdict:* the most "static-app-like", but the worst daily experience. Not recommended.

**B2: TWS or IB Gateway plus a tiny local bridge (the better choice).**

- *What runs:* TWS (if the trader already uses it to trade) or IB Gateway, with API sockets enabled and "allow connections from localhost only" set (D). Beside it runs a **bridge**: a small Node or Python process (for example `ib_async` or `@stoqey/ib`) started by a macOS `launchd` agent. It listens on `127.0.0.1:<port>` and serves one JSON endpoint, for example `GET /v1/observations?keys=AAPL,SPY261120C00550000&from=…&to=…`. It turns the app's keys into TWS contracts by rule, asks for TRADES bars for stocks and MIDPOINT bars for options, paces requests, and maps TWS errors to HTTP status codes. It answers only the app's origins via CORS (plus `localhost:5175`), requires a bearer token, and serves HTTPS with an mkcert certificate (or plain HTTP on 127.0.0.1, which Chrome and Firefox treat as secure; Safari's handling must be tested, I).
- *How the app finds it:* the adapter descriptor's configuration fields hold the bridge URL (`https://127.0.0.1:<port>`, not secret) and the bridge token (secret, write-only, device-local, outside backups). There is no discovery. The trader pastes both once, from the bridge's first-run output.
- *When TWS or the bridge isn't running:* `fetch` fails (network error), or the bridge returns 503 "TWS not connected" (TWS error 502/504). The adapter turns either into a safe transient diagnostic, Review stays usable and the trader types Marks as today (R29 adapter behaviour; AC-MARK-003). Nothing about start-up, backup or Restore depends on it.
- *Friction (D/C):* if the trader already runs TWS daily, **none beyond today's routine**. TWS auto-restarts nightly (choose "Auto restart" under Lock and Exit) and needs one 2FA login per week. IB Gateway alone adds keeping another app running. The bridge must stay installed and updated. Data lines are shared with the trader's TWS use. The same username serves both trading and data, so there is no competing session with TWS itself.
- *Security:* the IBKR credential never leaves TWS or IB Gateway. The bridge exposes read-only data on loopback only, behind a token. The local API socket can place orders, so the bridge must issue only data calls. TWS's "Read-Only API" setting should be turned on (I).
- *Cost:* IBKR data only (section 5). No hosting.
- *Fit with decision 14 and the credential rules:* the app side fits fully (one adapter, a descriptor-driven configuration, a write-only header token). But the bridge is a second program with its own install, update and tests. It is outside the static-app delivery contract, and it still does not fix R15, R16, R17 or R19.

**Feasibility:** feasible, with low friction for a trader who already runs TWS on this Mac. It is the better of A and B, but not enough to make IBKR suitable.

| | A: proxy server | B1: browser to Client Portal Gateway | B2: TWS / IB Gateway + local bridge |
|---|---|---|---|
| Feasible | Yes (fragile) | Yes, if the certificate and Chrome prompt are handled | Yes |
| Install or run | VPS or home server, Docker, IB Gateway + IBC, bridge, tunnel | Java + gateway, trusted certificate | TWS or IB Gateway, bridge as a launchd agent |
| Daily friction | 1 push a week; outages unnoticed | **Daily login + 2FA**; kicks TWS or mobile sessions | None if TWS already runs; 1 2FA a week |
| Credential exposure | Brokerage password on a server | None in the app | None in the app |
| Cost beyond data | ~USD 5–20/month | 0 | 0 |
| Fixes R15/R16/R17/R19 | No | No | No |

---

## 5. Market data subscriptions, costs and terms

- **A subscription is required for API data.** "Most securities require a Level 1 … market data subscription … This is required for all users … retrieving market data through the API." Level 1 provides "historical bar data". Free on-platform data (for example the free Cboe One and IEX streaming every IBKR client gets in TWS) "does not provide data via API" when it is an on-platform bundle (TWS data vs API data). Whether the free Cboe One feed returns API historical bars is **Unknown**. (D)
- **Delayed data is not enough for history** (I). Delayed data is a streaming or snapshot mode (types 3 and 4). "Delayed Frozen" can return the prior session's last quote, but only as a snapshot of the latest values, not past sessions. Without a subscription, history requests fail with 354 or 10089 (D). Snapshot quotes (USD 0.01 for stocks and ETFs, USD 0.03 for others) are live point-in-time only, so they cannot backfill.
- **Non-professional prices (USD per month)** (D, pricing page):
  - OPRA Top of Book (L1): USD 1.50, waived at USD 20 commissions;
  - US Securities Snapshot and Futures Value Bundle: USD 10.00, waived at USD 30 commissions;
  - US Equity and Options Add-On Streaming Bundle: USD 4.50 (the three US stock networks and OPRA; it requires the Snapshot bundle);
  - charged per calendar month, not pro-rated;
  - charged per username (a second or data-only username pays again).
  - Index levels (for D20) need a separate index feed, such as CBOE Streaming Market Indexes.
- **Status:** "By default, all users are classified as Professional", and the trader must switch to non-professional in Client Portal (D). Professional fees are much higher (for example the Equity and Options Add-On bundle is USD 125).
- **Account prerequisites:** an open, funded IBKR Pro account; USD 500 equity plus subscription costs; subscriptions active the business day after funding; the Market Data API Acknowledgement signed (the availability field calls it "annual"). Without it, data comes back as "not subscribed" (code O). (D)
- **Terms:** non-professional data is licensed "only for personal use" and may not be furnished to others (exchange agreements passed through by IBKR; C). Nothing found forbids keeping EOD values on the user's own device or in the user's own backups. This remains a reading of the terms, not a confirmation (I). A proxy (option A) must stay private to the trader.

---

## 6. Risks and open questions

**Risks (if IBKR were chosen anyway).**

1. **Expired options never come back (R15).** A missed Review on an expiration evening, turning the provider on late, a Restore onto a fresh device, or an expired leg in a still-open spread all leave permanent Manual tasks.
2. **Split rewriting (R17) and changing history (R19).** Backfills across splits get adjusted prices, and re-fetches may differ. The adapter must never re-fetch provider days and has no split data to guard backfills.
3. **Session conflicts.** One brokerage session per username across TWS, mobile and API (D). The Client Portal Gateway route ends the trader's other sessions. The paper-user workaround loses live data during a competing live session (10197).
4. **Brokerage credential risk (R32)**, worst in option A.
5. **Unsupported automation.** IBKR says the Client Portal Gateway login cannot be automated. IBeam and IBC are community tools that can break with IBKR login-page changes.
6. **Browser changes.** Chrome's Local Network Access prompt (2025), and possibly similar Safari or Firefox rules, can block localhost calls from `*.pages.dev`.
7. **Endpoint churn.** `/hmds/history` was dropped from the reference, and the docs moved from `interactivebrokers.github.io` to `interactivebrokers.com/docs` (the old TWS pages are marked "deprecated").
8. **Scope creep.** A bridge or server is a second deliverable with its own install, update, security and test burden, outside the spec's static-app model.

**Open questions (each needs a live test or a user decision).**

| # | Question | Why it matters |
|---|---|---|
| I1 | Do 1-day **MIDPOINT** bars return for a live US option through the API, given the "EOD data for options" line? What is the closing price's exact timestamp (16:00 vs 16:15) for SPY versus a single-stock option? | R6 (midpoint Mark), R10, R22, Q9 |
| I2 | On the **evening of an expiration day** (before the nightly reset), does the contract still resolve, and does its final MIDPOINT bar return? From what time does error 166 appear? | The only window for R15 |
| I3 | Is the MIDPOINT history split-adjusted like TRADES? | R17 for stocks and for options across splits |
| I4 | Does IBKR apply the 60-requests-per-10-minutes rule to 1-day bars? | R25 worst case (150 Instruments) |
| I5 | Does the free Cboe One / IEX feed return API historical bars, and is the "Add-On" bundle enough without the USD 10 Snapshot bundle? | R39 cost |
| I6 | Does the Client Portal Gateway send CORS headers on error responses, and does a `*.pages.dev` fetch to a mkcert-secured `localhost` pass Chrome's LNA prompt and Safari? | B1 feasibility |
| I7 | Can a paper username with shared data fetch **historical** bars while the live user is logged in (10197 is documented only for live data)? | R32 mitigation in A and B |
| I8 | Does the trader actually hold their positions at IBKR, and run TWS on this Mac? If the positions are at IBKR, **Flex Queries** could supply IBKR's own statement closing prices for held positions, including expired ones, from IBKR's statement history. Flex has no CORS (I), a query-string token, no OHLC, and covers only IBKR-held positions. | Whether any IBKR route is worth a follow-up; Flex as a reconciliation source |
| I9 | User decision: is any local bridge or server acceptable at all (decision 15 says stop and discuss)? | Gates options A and B |
