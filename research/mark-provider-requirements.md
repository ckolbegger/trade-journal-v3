# Mark provider requirements

Research task 1 of 4, written 2026-11-15. It lists what an automated provider of Marks (session closing prices) and Daily Bars must do for this trade journal. Three later reports judge Marketdata.app, Interactive Brokers and thinkorswim (Schwab) against it.

Sources read: `plan/implementation-plan.md` (decisions 12–15, 24, 25, 32, 37, 38, 51, 77; D9, D10, D11, D12; the review queue; tech debt item 3), `plan/technology-stack.md`, `plan/acceptance-matrix.md`, `plan/D04-daily-review.md`, `plan/D07-single-leg-options-happy-path.md`, `plan/D07S-option-price-stops-and-targets.md`, `plan/D08-backup-and-restore.md`, and `specs/` (Market Data, Daily Review, Workspace, delivery contract, glossary, acceptance contract, README, ADR 0007). Where the code already fixes a format (the Instrument key, the session table), the code is cited too.

## 1. Summary

**What the app needs, in plain words.** Every evening after the market shuts, the trader opens Daily Review. At that moment the app should fetch, by itself, the closing price of every stock, ETF and option contract the trader holds, so the trader no longer types Marks by hand. It should also fetch each day's open, high, low and closing price (a Daily Bar), which Stop Discipline (D12) uses to see whether a price went through a Stop during the day. If the trader skipped some days, or turns the provider on for the first time, the app fills in the missing days back to when each position was opened. That can mean reaching back months, and it includes option contracts that have since expired.

**Why these constraints.** The app is a static web page on Cloudflare Pages with no server. The trader's data lives only in the browser on one device. So the provider must:

- answer requests made straight from the browser;
- accept a credential the trader pastes in once;
- never need a server, proxy or local gateway.

Prices must be honest:

- the exact day's price, never yesterday's carried forward;
- a real zero only when the instrument really closed at zero;
- prices as they actually traded, not rewritten after a stock split.

Failures must be harmless. With no network, a bad key or a partial answer, the trader simply types the missing Marks, as today. The provider sits behind one replaceable adapter (decision 14), so a provider can be swapped later without changing anything else. Each Mark records which provider it came from.

**What is not needed:** intraday or streaming prices, volume, open interest, greeks or implied volatility (theoretical option pricing is outside the product), prices before 2024-01-01 (decision 51), non-US instruments, and adjusted or non-standard option contracts (D7 A99). Index options are a later need (D20 or later), not a D11 need.

### Facts the requirements rest on

| Fact | Value | Source |
|---|---|---|
| Instrument kinds today | `Stock` (any US-listed symbol, ETFs included) and `Option` (equity or ETF option, multiplier fixed at 100) | `src/domain/instrument/index.ts:7-18`; `plan/D07-single-leg-options-happy-path.md` A99 (line 49) |
| Stock key | the bare symbol, matching `^[A-Z][A-Z0-9.]{0,9}$`, so `BRK.B` is a valid key | `src/domain/instrument/index.ts:86-87` |
| Option key | the unpadded OCC symbol: root (at most 6 characters, "." removed), expiration as YYMMDD, `C` or `P`, then the strike × 1000 as 8 digits. Example: `XYZ261120C00055000`; `BRK.B` gives the root `BRKB`. Strikes have at most 3 decimal places. | `src/domain/instrument/index.ts:25-35`; D7 A99 as amended by decision 77 |
| Marks per option Trade per session | two: the contract's and the Underlying's | D7 P24 (line 30), A110 (line 60); D7S P93 (line 20) |
| Multi-leg Trades (D10) | one Mark per leg on the same date (verticals, iron condors, PMCCs, covered calls) | `plan/implementation-plan.md:767`; `specs/design/market-data.md:146` |
| Mark price format | a decimal of 0 or more with at most 6 fractional digits; 0 is a real price (decision 32) | `plan/D04-daily-review.md:34` (A37); D7 P27 (line 33); `plan/implementation-plan.md:43` |
| When a session is complete | 30 minutes after its closing time: 16:30 New York time, or 13:30 on early-close days. From then on it is the Expected Mark Date. | `plan/D04-daily-review.md:18` (P9); `plan/implementation-plan.md:36` (decision 25) |
| Calendar coverage | NYSE sessions from 2024-01-01 to 2028-12-31. Dates outside it never get Marks. | `plan/implementation-plan.md:63` (decision 51) |
| Scale | The benchmark profile is 200 Open Trades across 150 Instruments, with 1,255 sessions. A real trader will usually hold fewer. | `plan/implementation-plan.md:1486` (tech debt item 3) |
| How far back recovery reaches | from the first session at or after each Instrument's earliest exposure among Open Trades, through the Review Date | `plan/D04-daily-review.md:53` (A56); `specs/design/daily-review.md:36` |
| Who calls the provider | only `MarketData.recover`, run by Daily Review's `open` | `specs/design/daily-review.md:36-38`; `plan/implementation-plan.md:804` |

## 2. Requirements

Priority: **Must** means the provider fails the evaluation without it. **Must (blocker)** marks the conditions that decision 15 makes a stop-and-discuss point. **Nice** means it is useful but there is a fallback. "Adapter" means the one module of provider-specific code (decision 14). Some rows say what the adapter must do. The provider is then checked for whether it makes that possible.

### A. Instruments and symbols

| # | Requirement | Where it comes from | Priority | How to check a provider |
|---|---|---|---|---|
| R1 | **US stocks and ETFs by ticker.** End-of-day data for any US-listed stock or ETF, including class shares written with a dot (`BRK.B`). | `specs/README.md:5` (U.S.-listed securities and options in USD); `src/domain/instrument/index.ts:86-87`; `plan/implementation-plan.md:797` (D11 story 1) | Must | Fetch one session for `AAPL`, `SPY` and `BRK.B`. Record how the provider spells class shares (`BRK.B`, `BRK/B` or `BRK-B`). The adapter must map the spelling both ways without a lookup call. |
| R2 | **US equity and ETF options by exact contract.** Any standard 100-share contract, chosen by underlying, expiration date, strike and call or put. This includes monthly, weekly and daily (0DTE) ETF expirations and strikes with decimals (for example 2.5 or 127.5). | D7 A99 (line 49); `plan/implementation-plan.md:759-767` (D10 shapes) | Must | Fetch a monthly contract, a weekly contract, a SPY daily-expiration contract and a contract with a 2.5 strike, each for one session. |
| R3 | **Contract symbol mapping.** The adapter turns the app's unpadded OCC key into the provider's contract identifier, and turns the provider's answer back into the exact key. It does this by rule, with no search or chain lookup per contract. Accepting OCC symbols directly is best. | `plan/implementation-plan.md:813` (adapter "maps Instrument keys … including option contract symbols"); `plan/implementation-plan.md:1445` (review queue, D7 item 3); `src/domain/instrument/index.ts:25-56` | Must (a rule-based mapping); Nice (accepts OCC as-is) | Read the docs for the option symbol format. Request `SPY` plus a YYMMDD expiration, `C`, and an 8-digit strike in the provider's format. Check that the answer names the contract so it maps back to one key, including a dotted root (`BRKB`). If the provider needs a chain lookup or an internal contract ID first (for example a numeric contract ID), record how many extra calls each contract costs and whether the IDs stay stable after expiration. |
| R4 | **Index options and index levels.** SPX, SPXW, NDX, NDXP, RUT, RUTW, VIX and VIXW options, plus the index level as the underlying's Mark. | `plan/implementation-plan.md:1462` (D20 or later; decision 77); D7 A99 scope note | Nice (future) | Record whether they are available, what the root symbols are (`SPXW` is not `SPX`), the cost, and whether the index level comes as a daily value. |

### B. Data kinds

| # | Requirement | Where it comes from | Priority | How to check a provider |
|---|---|---|---|---|
| R5 | **One closing price per stock or ETF per completed session.** | Glossary, Mark and Expected Mark Date (`specs/glossary.md:125,128`); `specs/design/market-data.md:5`; D11 story 1 (`plan/implementation-plan.md:797`) | Must | Fetch the closing price for 5 recent sessions. Compare it with a public reference (the exchange's or the issuer's closing price). Record whether it is the official closing auction price or the last trade. |
| R6 | **One closing price per option contract per completed session.** The underlying's closing price is fetched alongside it, because every option Trade needs both Marks. | Decision 15, condition 1 (`plan/implementation-plan.md:842`: "end-of-day option closes"); D7 P24 (line 30), A110 (line 60); `plan/implementation-plan.md:1445` | Must (blocker) | Fetch one contract's closing price for 5 sessions. Record what the value is: the last trade, the closing bid/ask midpoint, or a provider "mark". Record the time it was taken (see R22 and open question Q1). |
| R7 | **Exact-day values only.** A value for date D must come from session D. It must never be the last trade from an earlier day, a bar from another date or a carried-forward value. The provider must give each value's date, or its trade or quote time, so the adapter can reject carried values. | `specs/design/market-data.md:50` (a carried Mark "never fills an exact-date slot"); `specs/design/market-data.md:97` (no carry-forward) | Must | Pick an illiquid contract that did not trade on some date. Does the provider return nothing for that date (good), a value with the earlier trade's timestamp (workable), or the earlier price stamped with date D (fails unless it is clearly flagged)? |
| R8 | **Zero is different from missing.** A real closing price of 0 (a worthless option, or a stock after bankruptcy) passes through as 0. Missing data must never be sent as 0. | Decision 32 (`plan/implementation-plan.md:43`); D7 P27 (line 33); `plan/implementation-plan.md:1445` ("pass a 0 close through as 0"); `specs/design/market-data.md:50` (zero as a placeholder never fills a slot) | Must | Look at the raw JSON for a far out-of-the-money contract near its expiration, and for a contract with no data. Missing data must be `null`, an absent field or an explicit status, never `0`. |
| R9 | **Daily Bars (open, high, low, closing price) for stocks and ETFs.** | Decision 13 (`plan/implementation-plan.md:24`); decision 15, condition 1 ("stock Daily Bars"); D11 Daily Bars (line 806); D12 (line 855); AC-MARK-004 and AC-MARK-006 (`specs/acceptance/acceptance-contract.md:289-308`) | Must (blocker) | Fetch daily OHLC for one stock over one month. |
| R10 | **Daily Bars for option contracts.** Single-Instrument option-price conditions (D7S) use the same day's high or low in D12. Without a Bar the app falls back to the exact Mark. | D11 story 1 ("closing prices and daily ranges for my open stocks and options"); `specs/design/market-data.md:142-149`; D7S A198 (line 40) | Nice (strongly wanted) | Fetch daily OHLC for one contract over one month. Record what happens on days with no trades: no bar (good) or a flat bar made from a quote (must be flagged, because the app never fabricates a candle, `specs/design/market-data.md:97`). |
| R11 | **Valid Bars.** Each bar has finite, non-negative values with low ≤ open, closing price ≤ high, and is dated by the exchange session. On an empty key, a valid Bar's closing price also becomes the first provider Mark. | `specs/design/market-data.md:123,159` | Must | Check 50 sample bars for the ordering and for the date convention. |
| R12 | **Exact decimal prices.** Every price must fit a decimal with at most 6 fractional digits. The adapter converts the provider's numbers to decimal strings with no binary floating-point artifacts (`1.2300000001`). | `plan/D04-daily-review.md:34` (A37) | Must | Look at the raw JSON. Are prices strings or numbers, how many decimals do they have, and are there long float tails? |
| R13 | **Not needed:** volume, open interest, greeks, implied volatility, intraday or streaming quotes, and raw payload storage. If the response includes them, the adapter discards them. Bid and ask matter only if Q1 settles option Marks as a midpoint. | `specs/README.md:36` (no streaming, intraday replay or theoretical pricing); ADR 0007 (`specs/adr/0007-observed-valuation-and-expiration-payoff.md:7`); glossary Daily Bar (OHLC only, `specs/glossary.md:127`); `specs/design/market-data.md:23` | Not required | Do not count these as advantages. Do note whether leaving them out lowers the cost or the request count. |

### C. History depth, expired contracts and adjustments

| # | Requirement | Where it comes from | Priority | How to check a provider |
|---|---|---|---|---|
| R14 | **Daily history back to 2024-01-01.** Recovery reaches back to each Open Instrument's first exposure. That can be the day the provider is first turned on for an old position, or an acknowledged day recovered later. The calendar starts on 2024-01-01, so nothing earlier is needed. | `plan/D04-daily-review.md:53` (A56); decision 51 (`plan/implementation-plan.md:63`); D9 lifetime (`plan/implementation-plan.md:729`); `specs/design/market-data.md:121` ("Acknowledged keys remain eligible for later factual recovery") | Must | Fetch stock closing prices and bars for 2024-01-02 to 2024-01-31. Record the documented history depth for stocks and options at the price tier being evaluated. |
| R15 | **Expired option contracts.** The provider must serve closing prices (and Nice: bars) for a contract after it has expired, for every session up to and including its expiration date. The app needs this in four cases: Settlement Due Trades still open after expiration, expired legs of a still-open spread (D10), turning the provider on after a contract expired, and acknowledged days recovered later. | D7 P25 (line 31: the expiration date itself has a real closing price); `specs/design/market-data.md:121`; D10 (`plan/implementation-plan.md:755-789`) | Must | Fetch a contract that expired about 1 month ago, one about 6 months ago and one that expired in 2024. Check that each returns values for its final week, including the expiration date. |
| R16 | **Delisted and renamed stocks.** History for a symbol under the name it traded under on those dates, even after it was delisted or renamed. | D7 P27 (line 33: a stock that became worthless after a bankruptcy or delisting) | Nice | Fetch a stock delisted since 2024 and a ticker that changed since 2024, for dates before the change. |
| R17 | **As-traded (unadjusted) prices.** Fills and Lots are recorded at the prices actually paid. The app has no split or corporate-action handling. So a Mark for a date before a split must be the price that day, not a split-adjusted one. The provider must also never rewrite history: a later re-fetch that returns a changed value appends a refresh revision with correction relevance. | `specs/design/market-data.md:70` (changed provider price appends a refresh revision); D7 A99 (adjusted contracts out of scope); the specs are silent on corporate actions (see Q3) | Must (unadjusted history is available, or adjustment can be turned off) | Use NVIDIA's 10-for-1 split, effective 2024-06-10. A request for 2024-06-07 should return the as-traded price (above $1,000), not about $120. Record the default and the parameter that controls adjustment, for both closing prices and bars. |

### D. Timeliness and the session calendar

| # | Requirement | Where it comes from | Priority | How to check a provider |
|---|---|---|---|---|
| R18 | **Same-evening availability.** A session's closing prices for stocks and options should be available soon after the app treats the session as complete (16:30 New York time, or 13:30 on early-close days), and certainly the same evening. If they are not ready yet, the key stays Missing, becomes a Manual task, and a later Review open tries again. | `plan/D04-daily-review.md:18` (P9); decision 25 (`plan/implementation-plan.md:36`); `specs/design/market-data.md:121`; `specs/design/daily-review.md:64` | Must (stocks and options by 18:00 New York time); Nice (by 16:30) | Read the documented end-of-day publication times for stocks and for options. Live test: request today's values at about 16:35, 17:30 and 19:00 New York time. |
| R19 | **Final values, or provisional ones clearly marked.** The first value served for a date should be final. If the provider first serves a provisional value (a snapshot later corrected), it must say so, so the adapter can hold it back. Otherwise each correction becomes a visible refresh revision. | `specs/design/market-data.md:70` | Must (the behaviour is known and documented) | Docs: do end-of-day values change after publication? Live test: fetch the same date at 16:35, then the next morning, and compare. |
| R20 | **US exchange dates.** Each value maps to one US trading date (America/New_York), whatever the trader's time zone. Unix or UTC timestamps must convert to that date without ambiguity. | `specs/design/workspace.md:31` ("Market session dates stay exchange-defined"); glossary Expected Mark Date (`specs/glossary.md:128`) | Must | Record the date format in responses. If it is a timestamp, check what time of day it marks (midnight New York time, 16:00, or UTC midnight) and convert 5 samples. |
| R21 | **Same calendar as NYSE.** There must be data for every NYSE session and none for holidays or one-off closures. Early-close days must carry their own date. The adapter discards any value for a date the session policy does not call a session, and Market Data rejects it (`NotASession`). | Decisions 25 and 51; `src/domain/session-policy/table.ts:20-31`; `specs/design/market-data.md:97`; `src/modules/market-data/market-data.ts:436` | Must | Request 2025-01-08 to 2025-01-10: there should be no value for 2025-01-09 (the national day of mourning closure). Request 2024-07-03, 2024-11-29 and 2024-12-24 (early closes): each should have a value dated that day. |
| R22 | **Documented closing time for options.** The provider states the time its option closing price is taken. Some ETF options (for example SPY, QQQ and IWM) trade until 16:15, after the app's 16:00 session closing time. | Implied by R6 and `specs/design/market-data.md:146` (synchronized same-date Marks for structures); see Q9 | Must (documented) | Read the docs. Compare a SPY contract's provider value with its 16:00 and 16:15 quotes on one date if a reference is available. |

### E. Requests, limits, partial answers and errors

| # | Requirement | Where it comes from | Priority | How to check a provider |
|---|---|---|---|---|
| R23 | **Date-range requests.** One request returns a span of sessions for one Instrument, so the number of requests grows with Instruments, not with days. | `specs/design/market-data.md:119` ("compresses them into bounded provider requests"); `plan/D04-daily-review.md:44` (A47); `plan/implementation-plan.md:804` | Must | Docs: a from/to (or count) parameter on the daily endpoint for stocks and for a single option contract. Record the maximum span per request. |
| R24 | **Many Instruments per request, and all legs on one date.** Fetching several symbols in one request is helpful. Every leg of a structure must be fetchable for the same date, because a multi-leg structure is valued only from same-date Marks for all its legs. | D10 "synchronized multi-Instrument Marks" (`plan/implementation-plan.md:767`); `specs/design/market-data.md:146`; `specs/design/daily-review.md:36` ("bounded batches") | Must (same-date legs); Nice (several symbols per request) | Docs: does a bulk endpoint exist for many symbols or contracts on one date? Fetch the four legs of one iron condor and its underlying for one date. |
| R25 | **Quota fits the workload.** A normal Review covers about 10–40 Instruments (the benchmark worst case is 150). A first-time backfill covers each Open Instrument back to its first exposure, up to about 230 sessions per Instrument (2024-01-01 onward). | `plan/implementation-plan.md:1486` (benchmark profile); A56 | Must (a normal Review fits the daily quota with room to spare at the chosen tier) | From the pricing page, compute the requests or credits used by (a) one Review with 40 Instruments, 25 of them option contracts; (b) the same with 150 Instruments; (c) a backfill of 40 Instruments × 230 sessions. Record per-minute and per-day limits, and how option rows are counted (per request, per contract or per row). |
| R26 | **Rate-limit signals the browser can read.** HTTP 429 (or a documented equivalent) with a retry hint. CORS headers must be present on error responses too, otherwise the browser hides the status from the app. | Derived from R28 and R30 | Must | Send an invalid-token request and, if safe, a burst over the limit from a browser page. Can the page's code read the status and body? |
| R27 | **Per-Instrument partial results.** One unknown or unsupported symbol must not fail the whole batch. "Unknown instrument" must be distinguishable from "no data for that date". | `specs/design/market-data.md:121` (unsupported Instruments and partial responses are transient diagnostics); AC-MARK-005 (`specs/acceptance/acceptance-contract.md:296-301`) | Must | Send a batch (or a sequence) with one valid symbol, one nonexistent contract and one valid contract on a date with no data. Record the response shape for each. |
| R28 | **Errors the adapter can tell apart.** Bad or expired credential, quota exceeded, unknown instrument, no data, provider outage and network failure. Each becomes a safe diagnostic with no credential in it. No failure ever creates a Mark, an acknowledgment or a Journal fact. | `specs/design/market-data.md:121,153`; `specs/design/delivery-contract.md:42`; AC-MARK-003 (`specs/acceptance/acceptance-contract.md:282-287`: a provider error never creates an acknowledgment) | Must | Docs: the list of error codes and the error body format. Check that error bodies do not echo the token. |
| R29 | **Offline and failure tolerance.** With no network, recovery reports a safe operational diagnostic and every Manual path still works. The provider must not be needed for start-up, reads, backup or Restore, and Restore preparation contacts no provider. | D11 offline (`plan/implementation-plan.md:807`); AC-DEL-001 (`specs/acceptance/acceptance-contract.md:450`); AC-REST-001 (`specs/acceptance/acceptance-contract.md:409-414`); `plan/implementation-plan.md:1476` | Must (adapter behaviour) | The only provider-side point: no session handshake, keep-alive or login ritual that has to succeed before ordinary requests. Record any such step. |

### F. Browser access, authentication and credentials

| # | Requirement | Where it comes from | Priority | How to check a provider |
|---|---|---|---|---|
| R30 | **Direct calls from the browser.** The provider must accept `fetch` calls from a static HTTPS origin (the Cloudflare Pages `*.pages.dev` origin, and `http://localhost:5175` for development and tests) through CORS. That means `Access-Control-Allow-Origin` for those origins (or `*`) and an answer to the `OPTIONS` preflight that allows the auth header. No server, proxy, browser extension or locally running gateway is allowed. A proxy would be new infrastructure outside the spec. | Decision 15, condition 1 (`plan/implementation-plan.md:842`); risk 5 (`plan/implementation-plan.md:152`); `plan/technology-stack.md` (Hosting; Deferred decisions) | Must (blocker) | Run `curl -i -X OPTIONS <endpoint> -H "Origin: https://example.pages.dev" -H "Access-Control-Request-Method: GET" -H "Access-Control-Request-Headers: authorization"`, then the same GET with the Origin header, and read the `Access-Control-Allow-*` headers. Then make a real `fetch` from a page served on localhost. A provider that only works through a local gateway or a server-side OAuth callback fails. |
| R31 | **Authentication a browser app can do alone.** Either a token the trader pastes in once (sent in a header), or an OAuth flow for a public client (PKCE, no confidential client secret, and a redirect URI the static site can serve). Credentials should last long enough, or refresh from the browser, that the trader is not re-authenticating every few days. | D11 story 3 ("my API key kept private", `plan/implementation-plan.md:799`); `plan/D08-backup-and-restore.md:30` ("Enter your API key"); `plan/implementation-plan.md:152` ("CORS with token authentication") | Must | Docs: the auth method, whether a client secret is needed, the token and refresh-token lifetimes, and whether the token endpoint itself allows CORS. Count how often the trader would have to sign in again. |
| R32 | **Least privilege.** The credential should grant read-only market data. It must not be able to place trades or read and move account money, because it is stored in ordinary browser storage on the device. | Derived from "Credential input is protected and write-only" (`specs/design/market-data.md:153`). The spec does not name scopes (see Q12). | Must (derived) | Docs: the scopes available. Can a data-only key be issued? If the only credential is a full brokerage login or token, record that as a major risk. |
| R33 | **Credential handling the spec demands.** The credential is write-only (never shown again, only a redacted status), stored on the device outside every backup section, never put in diagnostics or raw responses, and absent after Restore (the configuration then shows Needs Setup until the key is entered again). The provider must make this possible. If the token must travel in the query string, the adapter must remove it from every diagnostic and error. | `specs/design/market-data.md:153,157,159`; `specs/design/workspace.md:116,206`; `specs/design/delivery-contract.md:85`; D11 configuration and Restore (`plan/implementation-plan.md:803,807,826-828`); decision 37 (line 48); `plan/D08-backup-and-restore.md:30,507,578` (the credential canary); AC-BACK-001 (`specs/acceptance/acceptance-contract.md:402-407`) | Must | Record whether the token goes in a header or a query parameter, and whether any response (including errors and redirects) echoes it back. |

### G. Provenance, the adapter and testing

| # | Requirement | Where it comes from | Priority | How to check a provider |
|---|---|---|---|---|
| R34 | **Stable provenance.** Every provider Mark and Bar records `Provider(ProviderId)`. That ID is a stable string chosen for the adapter, and it survives disabling or replacing the provider. Provider identity is shown but never used for grouping or ranking. | `specs/design/market-data.md:29,153`; `plan/implementation-plan.md:805,817`; `specs/design/performance-analysis.md:87` | Must (adapter) | Propose the ID (for example `marketdata-app`). Record the provider's own name for its data source (for example its exchange feed, such as OPRA for options), which is Nice for display. |
| R35 | **Observation time.** Each observation states when it was observed, separately from when it was saved. A provider timestamp for the closing value is best. Otherwise the adapter uses the session's closing time. | `specs/design/market-data.md:70` | Nice | Record whether responses carry a per-value timestamp. |
| R36 | **Adapter descriptor fields.** The provider's documentation must let us fill in all of these: a stable `ProviderId`; a display label; the credential fields (name, secret or not); the supported Instrument kinds (`Stock`, `Option`, later index options); and the request bounds (most Instruments per request, longest date span, most concurrent requests, requests per minute and per day). | `plan/implementation-plan.md:810-817` (decision 14) | Must | Fill in the descriptor as a table from the documentation. Mark each field "documented", "inferred" or "unknown". |
| R37 | **Testable without the real service.** A documented, stable HTTP API that a local emulator can copy for mock-free integration tests, plus an optional live smoke test with a real key. A free or trial tier makes the live test cheap. Every adapter must pass one shared conformance suite. | Decision 15, condition 2 (`plan/implementation-plan.md:843`); `plan/implementation-plan.md:817` | Must (documented API with example responses); Nice (free or trial tier, sandbox) | Docs: the request and response schemas, with examples for success, empty and error. Is a free tier or sandbox available, and with what limits? |

### H. Cost and licensing

| # | Requirement | Where it comes from | Priority | How to check a provider |
|---|---|---|---|---|
| R38 | **Personal-use terms that allow keeping the data.** Non-professional, single-user use. The terms must allow storing fetched end-of-day prices indefinitely on the device and in the trader's own backup files: Marks and Bars are part of the Market Data backup section. | `specs/README.md:5` (one trader); `specs/design/market-data.md:157`; `specs/design/workspace.md:108` | Must | Read the terms of service on caching, retention and redistribution. Record the non-professional status rules and any exchange fees (for example OPRA for options). |
| R39 | **Cost suited to a personal journal.** | Implied by R38; the user's context | Nice (low monthly cost) | Record the monthly price of the cheapest tier that meets R1–R3, R5, R6, R9, R14, R15, R25 and R30, and the price of the tier that adds R10. |
| R40 | **Account prerequisites.** For example a funded brokerage account, a minimum balance, separate market-data subscriptions, or an approval step for API access. | Practical constraint; the specs do not cover it | Nice (fewer is better) | List every prerequisite and its cost or lead time. |
| R41 | **A stable, versioned API.** A deprecation policy, so the adapter does not break silently. | Decision 14 (one adapter to maintain) | Nice | Docs: API versioning and changelog. |

## 3. Open questions the spec leaves to the provider choice

These are not settled by `specs/` or the plan. The D11 breakdown, or the user, must answer them, and some answers depend on what the chosen provider can deliver.

| # | Question | Why it matters | Where the gap is |
|---|---|---|---|
| Q1 | **Which price is an option's Mark?** The last trade on that date, the closing bid/ask midpoint, or the provider's own "mark"? | An illiquid contract often has no trade on a given day, so a last-trade rule leaves it Missing (a Manual task), while a midpoint nearly always exists. A Bar's closing price seeds the Mark on an empty key (`specs/design/market-data.md:123`). That fits a last-trade rule; a midpoint rule would make the two disagree. A midpoint also needs bid and ask (R13). | The glossary defines a Mark only as "one saved price observation" (`specs/glossary.md:125`). The plan says "option closes" (decision 15). |
| Q2 | For stocks: the official closing auction price or the consolidated last trade? | Small differences, but visible against broker statements. | Not specified. |
| Q3 | **Stock splits and other corporate actions.** Marks are as-traded (R17), but an Open Trade that spans a split has no way to change its quantity, and adjusted option contracts are out of scope (D7 A99). | It decides whether provider "adjusted" data could ever be wanted, and what the app shows across a split. | The specs have no corporate-action model. |
| Q4 | **Request bound values:** the largest span, the most Instruments per request, the concurrency, and the time budget for one Review open. | They go in the adapter descriptor (R36), and they shape how long `open` waits. | `specs/design/market-data.md:119` says "bounded" with no numbers. |
| Q5 | **When does recovery fetch a key that already has a value?** The spec says recovery fills "actual gaps" (sessions with no Mark), yet a Bar on a Manual key "may still refresh" and changed provider prices append refresh revisions. Should recovery also fetch missing Bars for days that already have a Mark (for example Manual days), and should it ever re-fetch provider days? | It changes request volume (R25) and whether provisional values (R19) are ever corrected. | `specs/design/market-data.md:64,70,119`; AC-MARK-002 (`specs/acceptance/acceptance-contract.md:275-280`). |
| Q6 | **Is the provider ever called outside Daily Review's `open`?** For example from Trade Detail, from replay of Closed Trades (D9), or from a "fetch again" action. | If only `open` calls it, Closed Trades' gaps are never filled automatically, which limits how much expired-contract history (R15) is really used. | `specs/design/daily-review.md:38` ("The only possible open-time write is provider observation recovery"); `plan/implementation-plan.md:804`. |
| Q7 | **What does a rejected credential do?** Stay Enabled with a transient diagnostic, or switch to Needs Setup? | The configuration view and the trader's next step differ. | `specs/design/market-data.md:121,153` names the three states but not this transition. |
| Q8 | **What if a Review is opened before the provider has published?** Should the app offer a retry, or say "prices usually arrive by HH:MM"? | It depends on R18's real timing. | Not specified; `specs/design/daily-review.md:64` covers failure only. |
| Q9 | **Which instant is "the closing price" for options that trade until 16:15** (SPY, QQQ, IWM and some others), given the app's 16:00 session closing time and Review Cutoff? | Leg values in a structure should be from the same moment. | Decision 25; `specs/design/market-data.md:146`. |
| Q10 | **Index options and index levels** (cash settlement, AM settlement, `SPXW`-style roots). | Whether the provider chosen now can serve D20 later without a second provider (the model allows only one enabled provider, `specs/design/market-data.md:153`). | `plan/implementation-plan.md:1462`. |
| Q11 | **What does "protected" mean for a stored credential?** Plain IndexedDB in a separate store, or encrypted with a WebCrypto key that cannot be extracted? | It sets how much a full-access broker token (R32) would put at risk. | `specs/design/market-data.md:153`; `plan/implementation-plan.md:826`. |
| Q12 | **The minimum credential scope the user accepts.** Is a token that can also trade ever acceptable? | It decides R32 for the broker options (Interactive Brokers, Schwab). | Not specified. |

Settled by the plan, not open: no data before 2024-01-01 (decision 51); zero or one enabled provider (`specs/design/market-data.md:153`); credentials never in backups (decision 37); no theoretical pricing (ADR 0007); a 0 closing price is a real price (decision 32).

## 4. How to evaluate a provider: copyable checklist

Copy this into each provider report. Answer each line Yes / No / Partly / Unknown, with a link to the evidence (documentation URL, curl output or test result). A "No" on any line marked **blocker** means stop and discuss (decision 15).

```text
Provider: ______________   Tier evaluated: ______________   Date checked: ______

Browser and auth
[ ] R30 blocker  CORS: OPTIONS preflight and GET both return Access-Control-Allow-Origin for a
                 *.pages.dev origin and http://localhost:5175 (or *), allowing the auth header;
                 error responses carry CORS headers too (R26). No server, proxy or local gateway.
[ ] R31          Auth: pasted token in a header, or OAuth with PKCE and no client secret;
                 token lifetime ____; refresh from the browser possible? ____
[ ] R32          Credential can be limited to read-only market data (no trading or account access)
[ ] R33          Token is never echoed in responses or error bodies; header ____ / query ____

Instruments and symbols
[ ] R1           AAPL, SPY, BRK.B daily data; class-share spelling: ____
[ ] R2           Monthly, weekly and SPY 0DTE contracts, and a 2.5 strike
[ ] R3           Contract id from OCC (root+YYMMDD+C/P+8-digit strike) by rule, no lookup call;
                 answer maps back to one key; dotted root (BRKB) works
[ ] R4  (Nice)   Index options (SPXW, NDXP, RUTW, VIXW) and index levels

Data
[ ] R5           Stock closing price per session; auction price or last trade? ____
[ ] R6  blocker  Option contract closing price per session; definition: last / mid / mark ____
[ ] R7           No carried-forward values: an illiquid contract with no trade on D returns nothing
                 for D, or a timestamp showing the earlier date
[ ] R8           A real 0 comes through as 0; missing data is null, absent or flagged, never 0
[ ] R9  blocker  Stock Daily Bars (OHLC)
[ ] R10 (Nice)   Option Daily Bars (OHLC); no fabricated bar on no-trade days
[ ] R11          Bars valid: low <= open, closing price <= high; dated by session
[ ] R12          Prices fit 6 decimals; strings or numbers? float tails? ____

History and adjustments
[ ] R14          Stocks and options back to 2024-01-02
[ ] R15          Expired contracts: ~1 month, ~6 months and 2024 expiries, through expiration day
[ ] R16 (Nice)   Delisted or renamed stocks under their old symbols
[ ] R17          Unadjusted prices: NVDA on 2024-06-07 returns over $1,000 (not about $120);
                 adjustment parameter: ____

Timing and calendar
[ ] R18          Same-day values by 18:00 New York time (stocks ____ / options ____)
[ ] R19          Values final when first served, or provisional values flagged
[ ] R20          Dates map to US exchange dates; format ____
[ ] R21          No value for 2025-01-09; values for 2024-07-03, 2024-11-29, 2024-12-24
[ ] R22          Option closing-time basis documented (16:00 or 16:15) ____

Requests and errors
[ ] R23          Date-range request per Instrument; longest span ____
[ ] R24          Same-date fetch of all legs; several symbols per request (Nice) ____
[ ] R25          Quota: credits for (a) 40-Instrument Review ____ (b) 150 ____
                 (c) 40 x 230-session backfill ____; limits per minute ____ / per day ____
[ ] R26          429 (or equivalent) with a retry hint, readable from the browser
[ ] R27          Per-Instrument partial results; unknown instrument vs no data distinguishable
[ ] R28          Documented error codes: auth / quota / unknown / no data / outage
[ ] R29          No mandatory session handshake or keep-alive before ordinary requests

Adapter, testing, terms
[ ] R34          ProviderId proposal ____; data-source name ____
[ ] R35 (Nice)   Per-value observation timestamp
[ ] R36          Descriptor filled in: label, credential fields, kinds, request bounds
                 (documented / inferred / unknown for each)
[ ] R37          Documented request and response schemas with examples (emulator-ready);
                 free tier or sandbox (Nice) ____
[ ] R38          Terms allow keeping fetched end-of-day data on the device and in backups;
                 non-professional rules; exchange fees ____
[ ] R39 (Nice)   Monthly cost of the cheapest compliant tier ____; with option bars ____
[ ] R40 (Nice)   Prerequisites (brokerage account, balance, subscriptions, approval) ____
[ ] R41 (Nice)   Versioned API with a deprecation policy

Open questions this provider helps answer: Q1 ____  Q9 ____  Q10 ____  Q12 ____
Verdict: meets all Musts? ____   Blockers failed: ____   Biggest risk: ____
```
