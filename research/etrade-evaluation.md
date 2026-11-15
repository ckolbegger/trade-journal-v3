# E*TRADE (Morgan Stanley) as a Mark provider

Research task, written 2026-11-15. It judges the E*TRADE Developer Platform (E*TRADE from Morgan Stanley) against `research/mark-provider-requirements.md` (R1 to R41, Q1 to Q12) for D11 (`plan/implementation-plan.md`, D11 section, decision 15).

How this was researched: documentation, plus nine unauthenticated CORS checks against E*TRADE's API hosts (section 4). Nothing was registered, no one logged in, and no request carried a key or token. E*TRADE's API reference pages on `apisb.etrade.com/docs/api/…` are public and are cited directly. The developer portal (`developer.etrade.com`) refuses automated reads (HTTP 403), so facts from it come from search-engine excerpts of those pages and from community clients that quote them; they are labelled that way. The API Developer License Agreement (version "CRC# 5569530 (10/2026)") and the Market Data disclosure were read in full.

Evidence labels: **Verified** = my own preflight test on 2026-11-15. **Documented** = an official E*TRADE or Morgan Stanley page. **Community (date)** = a third-party project, forum or package, with its date. **Inferred** = my reasoning from the evidence, not yet checked.

## 1. Verdict

**Plain answer.** E*TRADE cannot do this job. It can give tonight's prices, but never any earlier day's, and it cannot be called from the web page.

- **No history of any kind.** The E*TRADE API has four market-data calls: Get Quotes, Option Chains, Option Expire Dates and Look Up Product. All of them return the price *now*. None takes a date. There is no daily-bar or price-history call for stocks, ETFs or options (Documented: the Market API reference lists only these four; Community: pyetrade and the R package etrader wrap no history call either). So stock Daily Bars for past sessions (R9, a blocker), any backfill (R14) and expired contracts (R15) are all impossible.
- **Options: tonight's bid and ask only.** The user has settled Q1: an option's Mark is the closing bid/ask midpoint. A quote taken on the evening of session D carries each contract's `bid`, `ask`, `bidTime` and `askTime`, so the adapter can compute D's midpoint that evening (Documented fields; Inferred timing). A quote also carries `optionPreviousBidPrice` and `optionPreviousAskPrice`, which may allow a one-session catch-up the next day, but E*TRADE does not define them beyond "the previous bid price" (Documented field, meaning Unknown). Skipped days, older positions and expired legs can never be fetched.
- **The browser cannot call it.** E*TRADE's servers send no CORS headers at all: not on the preflight, not on the 401 error, not on the login endpoints (Verified, section 4). The login is OAuth 1.0a, where every request is signed with a consumer secret, and the access token dies at midnight New York time every day (Documented). There is no read-only scope: the token can read balances and place trades (Documented: same token for the Accounts and Order APIs; no scope parameter).
- **Daily login.** Even through a bridge or proxy, the trader must log in to E*TRADE (with two-factor) and approve the app **every day** they want Marks, because the token ends at midnight Eastern time and "no requests will be processed for that token until the OAuth process is repeated" (Documented). Missing one evening loses that session's option Marks for good.

**Which architecture is workable?**

| Architecture | Workable? | Why |
|---|---|---|
| Browser only (the app calls E*TRADE directly) | **No** | No `Access-Control-Allow-Origin` on any response (Verified). The OAuth 1.0a login is unusable from a page for the same reason. Fails R30 and R31. |
| C. A small local bridge on the Mac holding the consumer secret and tokens | **Technically yes, for tonight's values only; outside the spec** | Works like any pyetrade script. The spec forbids "a locally running gateway" (R30). Daily E*TRADE login. Data gaps unchanged. Safari may block an `https` page calling `http://127.0.0.1` (Inferred). |
| D. A small cloud proxy (Cloudflare Worker or Pages Function) holding them | **Technically yes, for tonight's values only; outside the spec** | Clean same-origin fit, but new server infrastructure (decision 15: stop and discuss). Puts a full-access brokerage token in the cloud for the day. Daily login. Data gaps unchanged. |

Neither C nor D fixes the real problem, which is the data: no stock bars for any past day, no option bid/ask for any past day, no expired contracts. **Recommendation (Inferred):** do not choose E*TRADE as the D11 provider. Keep Marketdata.app, as decision 13 says. E*TRADE is weaker than Schwab here: Schwab at least has stock price history; E*TRADE has none, and its login lasts one day instead of seven. The one thing E*TRADE does better is that a stolen access token is useless after midnight.

## 2. API surfaces

| Surface | Auth | How it is reached | What it offers for our needs | Limits and gaps | Evidence |
|---|---|---|---|---|---|
| Get Quotes | OAuth 1.0a signed header (consumer key + secret, access token + token secret) | `GET https://api.etrade.com/v1/market/quote/{symbols}` (`.json` suffix or `Accept: application/json` for JSON; XML by default). Sandbox: `apisb.etrade.com`. | Current quote for stocks, ETFs, indexes and option contracts. `detailFlag`: `ALL` (default), `FUNDAMENTAL`, `INTRADAY`, `OPTIONS`, `WEEK_52`, `MF_DETAIL`. Fields include `bid`, `ask`, `bidTime`, `askTime`, `lastTrade`, `timeOfLastTrade`, `open`, `high`, `low`, `previousClose` ("Official price at the close of the previous trading day"), `totalVolume`, and per quote `dateTime`, `dateTimeUTC`, `quoteStatus`, `ahFlag`. With `OPTIONS`: `bid`, `ask`, `lastTrade`, `optionPreviousBidPrice`, `optionPreviousAskPrice`, `osiKey`, `daysToExpiration`, greeks. | **Now only, no date parameter.** "up to a maximum of 25" symbols, or 50 with `overrideSymbolCount=true`. Real-time only with the market data agreement signed, "Otherwise, you will receive delayed market data." | [Quote API reference](https://apisb.etrade.com/docs/api/market/api-quote-v1.html) (Documented) |
| Get Option Chains | Same | `GET …/v1/market/optionchains?symbol=IBM&expiryYear=2018&expiryMonth=08&expiryDay=…&strikePriceNear=200&noOfStrikes=2` (plus `includeWeekly`, `skipAdjusted` default true, `optionCategory`, `chainType`, `priceType`) | Every contract of one expiration with `bid`, `ask`, `lastPrice`, `volume`, `openInterest`, `osiKey`, `timeStamp`, and a `quoteDetail` link in quote-symbol form. | Listed (current) expirations only (Inferred: errors include 10039 "Please provide valid expiration date", 10031 "There are no options for the given month"). In the official example an unpriced contract shows `lastPrice` 0.0 and `bid` 0.0. | [Market API reference](https://apisb.etrade.com/docs/api/market/api-market-v1.html) (Documented) |
| Get Option Expire Dates | Same | `GET …/v1/market/optionexpiredate?symbol=GOOG&expiryType=ALL` | Upcoming expiration dates with type: `DAILY`, `WEEKLY`, `MONTHLY`, `QUARTERLY`, `VIX`, `MONTHEND` | Not needed: the adapter builds contract symbols by rule (R3). Future dates only (Inferred from the example). | Market API reference (Documented) |
| Look Up Product | Same | `GET …/v1/market/lookup/{search}` | Symbol search by name | Not needed for D11. | Market API reference (Documented) |
| OAuth 1.0a endpoints | Consumer key + **consumer secret** (HMAC-SHA1 signature) | `GET https://api.etrade.com/oauth/request_token`, browser to `https://us.etrade.com/e/t/etws/authorize?key=…&token=…`, `GET /oauth/access_token`, `GET /oauth/renew_access_token`, `GET /oauth/revoke_access_token` | Three steps: request token (valid 5 minutes), the trader logs in and approves, then exchanges the verifier code for an access token. | `oauth_callback` "Must always be set to 'oob'". The verifier is shown on screen to copy, or, if E*TRADE has tied a callback URL to the key, appended to it as `oauth_verifier`. Token expires at midnight US Eastern; inactive after 2 hours unused (renewable the same day). No PKCE, no scopes, no CORS (Verified). | [request_token](https://apisb.etrade.com/docs/api/authorization/request_token.html), [authorize](https://apisb.etrade.com/docs/api/authorization/authorize.html), [get_access_token](https://apisb.etrade.com/docs/api/authorization/get_access_token.html), [renew_access_token](https://apisb.etrade.com/docs/api/authorization/renew_access_token.html) (Documented) |
| Accounts, Orders, Alerts APIs | Same token | `…/v1/accounts/…`, `…/v1/accounts/{key}/orders/…` | Balances, positions, transactions, order preview and placement. | Not needed. They matter because **the same token reaches them**, so no data-only credential exists (R32). | API reference navigation (Documented) |
| Price history, daily bars, historical option quotes | — | **None exists** | — | — | Absent from the Market API reference (Documented by omission); not in pyetrade ([GitHub](https://github.com/jessecooper/pyetrade), Community, active) or etrader ([README](https://rdrr.io/cran/etrader/f/README.md), Community, built 2023-01-06). TradersPost lists no history for E*TRADE either. |

**Option symbol format (Documented).** Requests use "six elements separated by colons … underlier:year:month:day:optionType:strikePrice", for example `IBM:2018:8:17:CALL:200.000000` (the chain example's `quoteDetail`). Responses carry `osiKey`, the OCC symbol with the root padded by dashes to 6 characters, for example `IBM---180817C00200000`. The app's key is that OCC symbol without padding, so both directions are a pure rule (R3). Whether a dotted root (`BRK.B`) is sent as `BRK.B` or `BRKB` is not documented (Unknown).

**Sandbox (Documented, via search excerpts of developer.etrade.com and the etrader docs).** Sandbox keys are separate from production keys. Sandbox responses are stored canned data that "may not exactly match your requests", so the sandbox tests signing and request shape, not prices.

## 3. Requirements table

Columns: **Browser only** = the app calls E*TRADE directly. **Via bridge or proxy** = architectures C or D calling the same API. Where the two agree, the entry is written once.

| # | Requirement | Browser only | Via bridge or proxy | Evidence (label, source) |
|---|---|---|---|---|
| R1 | US stocks and ETFs; `BRK.B` spelling | Not met (no access) | **Met for the current session**; class-share spelling Unknown | Quotes cover equities and ETFs (Documented: Quote API). E*TRADE's spelling of `BRK.B` is not documented (Unknown). Test it. |
| R2 | Monthly, weekly, 0DTE and decimal-strike contracts | Not met | **Met for live contracts** | Expiry types `DAILY`, `WEEKLY`, `MONTHLY`, `QUARTERLY`; the strike is a decimal in the symbol (`200.000000`) (Documented: Market API). |
| R3 | OCC key to provider symbol by rule | Met (rule) | **Met** | Build `ROOT:YYYY:M:D:CALL|PUT:STRIKE`; map back from `osiKey` by removing the dash padding (Documented format; Inferred mapping). Dotted roots Unknown. |
| R4 (Nice) | Index options and index levels | Not met | **Partly** | Quotes cover "equity, option, or index" (Documented field text); `VIX` expiry type exists. Current only, like everything else. SPXW root handling Unknown. |
| R5 | Stock closing price per session | Not met | **Partly: tonight's session, or yesterday's via `previousClose`** | `lastTrade` in the evening, and next day `previousClose`, "Official price at the close of the previous trading day" (Documented). No earlier sessions. |
| R6 (blocker) | Option Mark per session, judged as the **closing bid/ask midpoint** (Q1) | Not met | **Partly: only the session that just ended** | Evening quote: `bid`, `ask`, `bidTime`, `askTime` give D's closing midpoint (Documented fields; Inferred timing). Next day: `optionPreviousBidPrice` / `optionPreviousAskPrice` might give D's closing bid and ask, but their meaning is not defined (Documented field, meaning Unknown). **No endpoint returns bid/ask for any earlier session, and none for expired contracts.** |
| R7 | Exact-day values only | Not met | **Met with an adapter rule** | `bidTime`/`askTime` ("15:15:43 PDT 03-21-2018"), `timeOfLastTrade` and `dateTimeUTC` let the adapter keep a value only when its time falls in session D (Documented fields). |
| R8 | Zero vs missing | Not met | **Partly** | The official chain example shows an unpriced contract with `bid` 0.0, `ask` 0.05, `lastPrice` 0.0 (Documented), so 0 is used for "nothing". With a midpoint Mark: `bid` 0 with `ask` > 0 is a real far out-of-the-money quote; both 0 means missing (Inferred). |
| R9 (blocker) | Stock Daily Bars | Not met | **Not met** (today's open, high, low and last only) | No bar or history call (Documented by omission). The evening quote's `open`, `high`, `low`, `lastTrade` could make one bar for tonight only (Inferred). |
| R10 (Nice) | Option Daily Bars | Not met | **Not met** (tonight only, same as R9) | As R9; only when `totalVolume` > 0 (Inferred). |
| R11 | Valid Bars | Not met | **Unknown** | Only a same-evening bar from quote fields; validity untested. |
| R12 | Exact decimals | Not met | **Partly** | Prices are JSON numbers ("number (double)"), up to 4 decimals in examples (`1186.2856`) (Documented). The adapter converts to decimal strings and computes (bid + ask) ÷ 2 itself. |
| R13 | Bid and ask needed; greeks and so on not needed | Not met | **Met for the current session only** | `detailFlag=OPTIONS` returns bid/ask plus greeks, which the adapter discards (Documented). |
| R14 | History back to 2024-01-01 | Not met | **Not met** | No history (Documented by omission). |
| R15 | Expired option contracts | Not met | **Not met** | No history; chains list live expirations only (Documented by omission; Inferred). |
| R16 (Nice) | Delisted and renamed stocks | Not met | **Not met** | No history. |
| R17 | As-traded (unadjusted) prices | Not met | **Met, trivially** | A live quote is as traded; there is no history to adjust (Inferred). Chains skip adjusted contracts by default (`skipAdjusted` true) and quotes flag them (`adjustedFlag`) (Documented). |
| R18 | Same-evening availability | Not met | **Met** (Inferred) | The quote is live, real-time once the market data agreement is signed, otherwise delayed at least 15 minutes (Documented: Quote API; Market Data disclosure). Delay barely matters by 16:30. |
| R19 | Final or flagged provisional values | Not met | **Unknown** | `quoteStatus` has values `REALTIME`, `DELAYED`, `CLOSING`, `EH_CLOSED` … but no definitions (Documented list, meanings undocumented). Whether bid/ask stay at their closing values all evening, or change or go to 0, is not documented. |
| R20 | US exchange dates | Not met | **Met with conversion** | `dateTime` "15:17:00 EDT 06-20-2018" and `dateTimeUTC` in epoch seconds (Documented example). Convert to an America/New_York date. |
| R21 | NYSE calendar | Not met | **Partly** (the app's own calendar does the work) | No calendar call. On a holiday a quote still shows the last session's values; the adapter must date them by `timeOfLastTrade`/`bidTime` and the app's session table (Inferred). |
| R22 | Option closing-time basis documented | Not met | **Not met** (undocumented) | No source says when E*TRADE's option quote stops changing. A quote read after 16:15 includes SPY, QQQ and IWM options' late trading (Inferred; Q9). |
| R23 | Date-range requests | Not met | **Not met** | No date parameter anywhere (Documented by omission). |
| R24 | Same-date legs; several symbols per request | Not met | **Met** for the current session | 25 symbols per call, 50 with `overrideSymbolCount=true` (Documented): all legs and the underlying in one request. |
| R25 | Quota fits | Not met | **Met for a normal Review; backfill impossible** | (a) 40 Instruments: 1 call (2 at 25 per call). (b) 150: 3 calls (6 at 25). (c) 40 × 230 backfill: impossible, no history. E*TRADE publishes no rate limit today; an older guide describes per-module, per-second limits that drop excess requests with "Rate limit exceeded, please wait" (Community: [E*TRADE API reference on Scribd](https://www.scribd.com/document/43038591/ETradeFinancial-API-Technical-Documentation), undated, older API version; [TradersPost](https://docs.traderspost.io/docs/learn/platform-concepts/rate-limits): "Not publicly documented"). |
| R26 | Rate-limit signals readable in the browser | **Not met** | **Partly** | The 401 error has no CORS headers, so a page cannot even read it (Verified). The over-limit status code and any retry hint are undocumented. Through a proxy the page reads whatever the proxy returns. |
| R27 | Per-Instrument partial results | Not met | **Partly** (Inferred) | A response holds a `quoteData` array plus `messages`, and each `QuoteData` has an `errorMessage` field (Documented schema), which suggests per-symbol errors. Whether one bad symbol fails the batch with 400/1019 "Invalid symbol" is not documented. Test it. |
| R28 | Errors the adapter can tell apart | Not met | **Partly** | 401 `{"Error":{"message":"Unauthorized request - invalid Consumer key and/or session token"}}` (Verified); 400 with codes 1019 invalid symbol, 1023/1025 too many symbols, 1020 bad detail flag; 500 code 163 "Quote service is not available" (Documented). Rate-limit and "no data" codes undocumented. |
| R29 | No mandatory handshake or keep-alive | Not met | **Not met** | A full E*TRADE login is needed every day, and a token unused for 2 hours must be renewed before use (Documented). |
| R30 (blocker) | Direct browser calls (CORS) | **Not met** (Verified) | Not met by definition (a gateway or proxy) | No `Access-Control-Allow-*` header on any of nine responses, from either origin, on production or sandbox, for market data and OAuth paths (section 4). |
| R31 | Auth a browser app can do alone | **Not met** | Met by the bridge or proxy, not by the app | OAuth 1.0a with HMAC-SHA1 over the consumer secret; no PKCE; the OAuth endpoints have no CORS (Verified); the token lasts until midnight Eastern (Documented). |
| R32 | Least privilege | **Not met** | **Not met** | The access token is the trader's E*TRADE login and reaches accounts and order placement; the OAuth calls have no scope parameter (Documented). An "individual" key works only with the owner's own accounts (Documented, via search excerpt). Mitigation: the token dies at midnight. |
| R33 | Credential handling | Not met | **Partly** | Credentials travel in a signed `Authorization` header (Documented). But they are four values: consumer key and secret (long-lived; the agreement requires keeping the key "confidential"), and a daily access token and token secret. Re-entry after Restore is just the key and secret; the daily login happens anyway (Inferred). |
| R34 | Stable provenance | Met (adapter) | **Met** | Proposed `ProviderId`: `etrade`. Data sources: "consolidated Options Price Reporting Authority data" for options; CTA/UTP SIP or Nasdaq Basic for equities (Documented: Market Data disclosure). |
| R35 (Nice) | Observation time | Not met | **Met** for quotes | `bidTime`, `askTime`, `timeOfLastTrade`, `dateTimeUTC` (Documented). |
| R36 | Adapter descriptor fields | Partly | **Partly** | Label "E*TRADE"; credentials: consumer key (secret per agreement), consumer secret (secret), plus a daily login; kinds: `Stock`, `Option` (current session only); bounds: 25 or 50 symbols per call (Documented), rate limits (Unknown), date span (not applicable). |
| R37 | Testable without the real service | Partly | **Partly** | Full request and response schemas with XML examples (Documented); enough for an emulator. A sandbox exists but returns stored canned data (Documented, via search excerpt). A live smoke test needs a real brokerage login each day. |
| R38 | Terms allow keeping data | **Partly** | **Partly** | Individual Use Developer licence is for "personal, non-commercial use"; dissemination "TO THIRD PARTIES IS STRICTLY PROHIBITED"; Market Data may not be "stored for subsequent use for any such purpose" (redistribution) (Documented: agreement 10/2026; Market Data disclosure). Keeping Marks for one's own journal is not forbidden in words (Inferred). Clause 2.3 also bars "display data electronically, unless agreed by the Company", which is vague (Documented; meaning Unknown). |
| R39 (Nice) | Cost | n/a | **Met**: free | The licence is "royalty free" (Documented). Real-time quotes are subject to "certain eligibility requirements and fees" (Documented); evening Marks need no real-time data. A cloud proxy may add cost (section 5). |
| R40 (Nice) | Account prerequisites | Heavy | **Heavy** | An E*TRADE brokerage account; the User Intent Survey; the API Developer License Agreement; the Market Data Agreement; an annual attestation, without which the licence "terminate[s] automatically"; the licence also ends if "the Developer Key is not actively utilized" (Documented: agreement 9.1; search excerpts of developer.etrade.com). Lead time "a few business days" (Documented, via search excerpt). |
| R41 (Nice) | Stable, versioned API | Partly | **Partly** | `/v1/` paths. "New versions may not be compatible"; E*TRADE gives notice "as soon as commercially practicable" and may "change, suspend or discontinue the API … at any time" (Documented: agreement 4.6 and 9.1). No public changelog found. |

**Open questions this provider helps answer.**

- **Q1 (settled: the closing bid/ask midpoint).** E*TRADE has no "mark" field. The adapter would compute (`bid` + `ask`) ÷ 2 from an evening quote, checking `bidTime` and `askTime` fall on session D (Inferred). History: none.
- **Q2 (stock auction price or last trade).** `previousClose` is "Official price at the close of the previous trading day" (Documented), which suggests the official closing price, but only one day back.
- **Q9 (16:15 options).** Not documented.
- **Q10 (index options).** Index quotes and a `VIX` expiry type exist; current values only.
- **Q12 (minimum credential scope).** E*TRADE cannot issue a data-only credential.

## 4. Preflight test log

All requests sent 2026-11-15 between 07:06 and 07:07 UTC with `User-Agent: Mozilla/5.0 (compatible; cors-check/1.0)`, no cookies, no key, no token. Preflights sent `Access-Control-Request-Method: GET` and `Access-Control-Request-Headers: authorization`. Every response also set an Akamai cookie `hg_psets` (value not recorded), and carried `server: Apache`, `alt-svc` and `akamai-grn` headers.

| # | Request | Origin | Status | CORS headers returned | Other notes |
|---|---|---|---|---|---|
| 1 | `OPTIONS https://api.etrade.com/v1/market/quote/AAPL.json` | `https://example.pages.dev` | 200 | **None** | `content-length: 0` |
| 2 | Same as 1 | `http://localhost:5175` | 200 | **None** | |
| 3 | `OPTIONS https://apisb.etrade.com/v1/market/quote/AAPL.json` | `https://example.pages.dev` | 200 | **None** | |
| 4 | Same as 3 | `http://localhost:5175` | 200 | **None** | |
| 5 | `GET https://api.etrade.com/v1/market/quote/AAPL.json` | `https://example.pages.dev` | 401 | **None** | Body `{"Error":{"message":"Unauthorized request - invalid Consumer key and\/or session token"}}`; `cache-control: no-cache, no-store` |
| 6 | `GET https://apisb.etrade.com/v1/market/quote/AAPL.json` | `http://localhost:5175` | 401 | **None** | Same body as 5 |
| 7 | `OPTIONS https://api.etrade.com/oauth/request_token` | `https://example.pages.dev` | 401 | **None** | `www-authenticate: OAuth realm=https://etws.etrade.com/,oauth_problem=parameter_absent`; HTML error page |
| 8 | `GET https://api.etrade.com/oauth/request_token` | `https://example.pages.dev` | 401 | **None** | Same as 7 |
| 9 | `OPTIONS https://apisb.etrade.com/oauth/request_token` | `http://localhost:5175` | 401 | **None** | Same as 7 |

**Reading (Verified).** A browser needs `Access-Control-Allow-Origin` on both the preflight and the real response. E*TRADE sends it on neither, for either origin, on production or sandbox. The quote preflights answer 200 with an empty body but no CORS headers, so the browser still blocks the request. The OAuth endpoint fails its preflight with 401. So no page on `*.pages.dev` or `localhost` can call any E*TRADE endpoint or read any E*TRADE error. This settles R30 and R26 for the browser-only architecture.

## 5. The local bridge and cloud proxy options

Both talk to the same E*TRADE API, so both share the data limits in section 3: current-session stock quotes and option bid/ask only, no history, no expired contracts. Both also share the daily login.

**The daily login, step by step (Documented flow; Inferred timing).** Each day the trader wants Marks: (1) the bridge or proxy signs a request-token call; (2) the trader opens `us.etrade.com/e/t/etws/authorize?key=…&token=…`, logs in with password and two-factor, and clicks Accept; (3) E*TRADE shows a verification code to paste back, or, if a callback URL has been tied to the key by asking E*TRADE Customer Service through a secure message, redirects there with `oauth_verifier`; (4) the bridge or proxy exchanges it for the access token. All of it within 5 minutes of step 1. Roughly a minute of the trader's time, every evening. The token then works until midnight Eastern; if Daily Review is reopened more than 2 hours after the last call, the bridge or proxy calls `renew_access_token` first, with no new login. Community packages confirm the routine: "the user will need to manually log into their ETRADE account at least once a day" (etrader README, Community, 2023-01-06). Attempts to automate the login with headless browsers hit bot detection and signature errors ([pyetrade #71](https://github.com/jessecooper/pyetrade/issues/71), Community, 2022-10). Automating it would mean storing the brokerage password and two-factor secret; do not.

### C. A small local bridge on the Mac

**What it is.** A small program (for example 50–100 lines of Python with pyetrade, or Node) runs on the Mac. It holds the consumer key and secret in a file or the macOS Keychain, runs the daily login (with a tiny local page to paste the verifier into), and serves `http://127.0.0.1:<port>/quotes?symbols=…` with CORS headers for the app's origin. The adapter calls the bridge instead of E*TRADE.

| Aspect | Assessment |
|---|---|
| Feasibility | High for the data that exists. This is how pyetrade and etrader are meant to be used (Community). |
| What the user installs or runs | Python 3 (or Node), the bridge script, and a `launchd` login item to keep it running. Optionally a callback URL tied to the key, requested from E*TRADE Customer Service (Documented, via search excerpt). |
| Daily friction | One E*TRADE login with two-factor every evening the trader wants Marks, before opening Daily Review (or when it fails). A missed evening means that session's option Marks stay Manual forever. |
| Browser reachability | Chrome and Firefox treat `http://127.0.0.1` as trustworthy from an `https` page, but recent Chrome versions ask the user for local-network permission, and Safari has blocked `https`-to-`http://localhost` calls as mixed content (Inferred, not tested here). Serving the bridge over `https` with a locally trusted certificate avoids that, at the cost of more setup. |
| Security | The consumer secret and the day's token stay on the Mac, outside the browser and outside backups (good for R33). Any local program can call 127.0.0.1; the bridge should expose only the quote call and bind to 127.0.0.1. The token can trade, but only until midnight. |
| Cost | Free. |
| Fit with decision 14 and the credential rules | The adapter is an ordinary HTTP adapter against the bridge. The app's credential field shrinks to "bridge address". It breaks R30 ("no … locally running gateway"), and part of the provider code lives outside the one adapter folder, where the conformance suite cannot reach it. |

### D. A small cloud proxy (Cloudflare Worker or Pages Function)

**What it is.** A Pages Function on the app's own origin (for example `/api/etrade/*`) keeps the consumer key and secret as Worker secrets and the day's access token in Workers KV or a Durable Object. The app's "Connect E*TRADE" button calls the Function for a request token and opens E*TRADE's authorize page; the verifier comes back by callback (to `https://<app>.pages.dev/api/etrade/callback`, if E*TRADE agrees to tie that URL to the key) or by paste. The Function signs every call with HMAC-SHA1 (WebCrypto supports it) and forwards only quote calls. Same origin, so no CORS question.

| Aspect | Assessment |
|---|---|
| Feasibility | High technically (Inferred). Unknown: whether E*TRADE's Akamai edge treats calls from Cloudflare's data-centre addresses differently from home addresses. |
| What the user installs or runs | Nothing on the Mac. The project gains a Function, KV or a Durable Object, two secrets, and its own tests and deployment, outside the current "static app, no server" stack (`plan/technology-stack.md`). |
| Daily friction | The same daily E*TRADE login, through the app. No machine to keep running. |
| Security | A token that can read the account and place trades sits on an internet-facing server for the rest of the day, and the consumer secret sits there permanently. The Function needs its own access control (for example Cloudflare Access), which is another credential. The midnight expiry limits the damage window; revoke on disconnect with `revoke_access_token`. |
| Cost | Cloudflare's free Workers and KV tiers cover a few calls a day (Inferred from Cloudflare's published plans, not re-checked here); a Durable Object or the paid plan is about US$5 a month. |
| Terms | The data goes from E*TRADE to a server the trader controls and back to the trader, not to a third party. That seems within "personal, non-commercial use" (Inferred). The agreement makes the developer "solely responsible for the security of its Application, systems, and credentials" (Documented: agreement). |
| Fit with decision 14 and the credential rules | The adapter fits the port cleanly (HTTP to the Function). But the secret leaves the device: the spec keeps the credential "device-local … outside every backup section" (D11 mechanisms; `specs/design/market-data.md:153`). Decision 15 says to stop and discuss before any proxy. |

## 6. Registration, costs and terms

**Registration (Documented via search excerpts of developer.etrade.com, which refuses automated reads; Community: etrader README 2023-01-06).**

1. Have an E*TRADE brokerage account, and log in to it.
2. On developer.etrade.com "Getting started": complete the **User Intent Survey** (individual or vendor use) and sign the **API Developer License Agreement**. The agreement must be signed before a production key is issued.
3. Sign the **Market Data Agreement**; real-time quotes need it, otherwise quotes are delayed.
4. Request a **sandbox key**, then a **production key**. Keys arrive as a message in the E*TRADE account. Sandbox and production keys differ. E*TRADE says a sandbox key takes "a few business days" and production not much longer.
5. Optional: ask Customer Service (secure message, subject "Technical Issues", topic "E*TRADE API") to tie a callback URL to the key.
6. Every year: return to complete the **annual attestation**, or the licence ends automatically (agreement 9.1).

An **individual** key works only with the developer's own E*TRADE accounts. Developer support: 1-800-387-2331 (Documented, via search excerpt).

**Costs.** The API licence is "royalty free" (Documented: agreement 1.13). Real-time data depends on "certain eligibility requirements and fees"; non-professional status is defined in the Market Data disclosure (a natural person using data "solely for his/her personal, non-business use") (Documented). The developer "shall be liable for payment of any fees levied by exchanges" for data accessed (Documented: agreement 3.1). No separate API fee was found. A cloud proxy adds about US$0–5 a month (Inferred).

**Terms (Documented: API Developer License Agreement, CRC# 5569530, 10/2026; Market Data disclosure).**

- Licence for "an Individual Use Developer's personal, non-commercial use"; "Non-Commercial Use" includes to "access market data, perform analytics … in connection with Developer's individual, personal accounts with E*TRADE and not for any other purpose."
- "USE OF API AS A MEANS OF DISSEMINATING INFORMATION INCLUDING MARKET DATA … TO THIRD PARTIES IS STRICTLY PROHIBITED."
- Market Data "may not be copied … redistributed or resold, or stored for subsequent use for any such purpose". Storing for personal use is not named (Inferred: allowed).
- Clause 2.3: the developer will not "display data electronically, unless agreed by the Company". Its scope is unclear for a personal tool (Unknown; ask E*TRADE if pursued).
- "Developer agrees to keep the Consumer Key confidential." A key kept in the trader's own browser or bridge is still confidential; a key shipped in the public static bundle would not be (Inferred).
- E*TRADE may change the agreement "from time to time without notice" and may "change, suspend or discontinue the API … at any time … for any reason or no reason."
- Unrelated to D11 but notable: clause 4.9 prohibits algorithmic or automated order generation.

## 7. Risks and open questions

**Risks.**

1. **No history at all (decisive).** No stock Daily Bars for past sessions (R9, a blocker), no option bid/ask for past sessions (R6, a blocker), no expired contracts (R15), no backfill (R14). Story 1 fails for anyone who does not open Daily Review on every session's evening.
2. **Daily login.** Every session the trader wants Marks, they must log in to E*TRADE with two-factor first. Missed evenings look like silent provider failures and lose option Marks permanently.
3. **No browser access (Verified).** Every workable design adds a bridge or proxy that the spec rules out (R30, decision 15).
4. **Brokerage credential exposure (R32, Q11, Q12).** No data-only key; whatever holds the day's token can trade until midnight.
5. **Undocumented evening behaviour.** What `bid`, `ask`, `quoteStatus` (`CLOSING`, `EH_CLOSED`) and `optionPreviousBidPrice`/`optionPreviousAskPrice` show after the close, and when they roll over, is not documented.
6. **Zero used as "missing" (R8).** The adapter must not treat 0 bid and 0 ask as a real midpoint.
7. **Licence fragility.** It ends if the annual attestation is missed or the key goes unused, and E*TRADE may change terms without notice.

**Open questions (to settle only if E*TRADE is pursued).**

| # | Question | How to settle it |
|---|---|---|
| E1 | After 16:15 New York time, do an option's `bid`/`ask` stay at their closing values all evening, or go to 0? What does `quoteStatus` show? | With a production key, quote one SPY and one illiquid contract at 16:30, 20:00 and 08:00 the next day. |
| E2 | Is `optionPreviousBidPrice`/`optionPreviousAskPrice` the previous session's closing bid/ask? When does it roll over? | Compare the evening quote of D with the next morning's previous-bid/ask. |
| E3 | Does a batch with one invalid symbol fail entirely (400/1019) or return per-symbol messages? | Quote `AAPL,ZZZZZZ,SPY:…` in one call. |
| E4 | E*TRADE's spelling of `BRK.B` and its option root. | Quote both. |
| E5 | What does a quote return for a contract that expired yesterday? | Quote it the day after expiration. |
| E6 | The market rate limit and its error status. | Ask E*TRADE developer support; no public figure exists. |
| E7 | Does clause 2.3 ("display data electronically, unless agreed") cover a personal journal? | Ask E*TRADE through the developer account. |
| E8 | Would E*TRADE tie a `pages.dev` or `127.0.0.1` callback URL to an individual key? | Secure message to Customer Service. |

**Sources** (accessed 2026-11-15 unless dated otherwise):

- E*TRADE API reference (Documented): [Quote API](https://apisb.etrade.com/docs/api/market/api-quote-v1.html), [Market API (lookup, option chains, expire dates)](https://apisb.etrade.com/docs/api/market/api-market-v1.html), [request token](https://apisb.etrade.com/docs/api/authorization/request_token.html), [authorize](https://apisb.etrade.com/docs/api/authorization/authorize.html), [get access token](https://apisb.etrade.com/docs/api/authorization/get_access_token.html), [renew access token](https://apisb.etrade.com/docs/api/authorization/renew_access_token.html)
- E*TRADE legal (Documented): [API Developer License Agreement](https://us.etrade.com/l/f/agreement-library/api-developer-licensing-agreement) (CRC# 5569530, 10/2026), [Market Data disclosure](https://us.etrade.com/l/f/disclosure-library/market-data)
- E*TRADE developer portal (Documented, read only through search-engine excerpts; direct reads returned HTTP 403): [Getting started](https://developer.etrade.com/getting-started), [Developer guides](https://developer.etrade.com/getting-started/developer-guides), [FAQ](https://developer.etrade.com/support/frequently-asked-questions)
- Community: [pyetrade](https://github.com/jessecooper/pyetrade) (repository active; no history methods), [pyetrade issue #71](https://github.com/jessecooper/pyetrade/issues/71) (2022-10-01 to 2022-10-13), [etrader R package README](https://rdrr.io/cran/etrader/f/README.md) (built 2023-01-06), [TradersPost rate limits](https://docs.traderspost.io/docs/learn/platform-concepts/rate-limits) (undated), [older E*TRADE API reference on Scribd](https://www.scribd.com/document/43038591/ETradeFinancial-API-Technical-Documentation) (undated, older API version)
- Preflight checks: section 4 (Verified)
