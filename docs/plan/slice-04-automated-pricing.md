# Slice 4 — Automated pricing (Marks only)

Daily Review's typing disappears where a provider can supply prices: a PricingSource adapter fetches end-of-day Marks for stocks and option contracts, the review's one bulk fetch fills the gap since the last review, and the trader only types what the source couldn't deliver. Manual entry remains a complete, permanent workflow (ADR 0008).

**Out of scope (JIT):** Daily Bars / OHLC persistence (Slice 17 — `SourceObservation.ohlc` stays unused and is *not* added to the type until then), IV from feed (`SourceObservation.iv` likewise), multiple simultaneous providers beyond the priority-order mechanism the design requires, secrets exclusion from export (Slice 6 owns `exportAll`; whichever of Slice 4/6 lands second adds the API-key-exclusion test).

Design references: [pricebook.md](../design/pricebook.md) (fetch semantics, FetchReport, gap recovery), [review.md](../design/review.md) (one collection path), [workspace.md](../design/workspace.md) (settings), ADR 0008.

---

## ☑ Story S4.1 — First pricing source

> As a trader, I want to enable a market-data provider with my API key, so that the app can fetch closing prices for my tickers and contracts instead of me typing them.

**Deep interfaces**: `PricingSource` (adapter — `id`, `supports`, `fetch` returning `SourceObservation[]` with `close` only), adapter registration in the composition root in priority order from `Settings.pricingSources`, Settings UI (enable + API key + **test this source**).

**Provider selection is this story's first task, with acceptance criteria** (ADR 0008 defers the choice to here): must serve end-of-day closes for US stocks *and individual option contracts*; callable from a static-hosted browser app (CORS-permissive or key-in-query); free or cheap tier adequate for tens of instruments/day. Evaluate against the trader's actual holdings before wiring.

**Provider decision (2026-07-17): marketdata.app** — criteria verified live by curl with a browser `Origin` header (no API key needed; their keyless trial serves real data):

- ✓ **EOD stock closes**: `GET https://api.marketdata.app/v1/stocks/candles/D/AAPL/?from=2026-07-13&to=2026-07-16` → `{"s":"ok","t":[...4 days...],"c":[317.31,314.86,327.5,333.26],...}`
- ✓ **Individual option contracts, LEAPs included**: `GET https://api.marketdata.app/v1/options/quotes/AAPL271217C00300000/?from=2026-07-13&to=2026-07-16` → per-day `last`/`mid`/`updated` for a Dec-2027 call (522 DTE) — the trader's actual instrument shape
- ✓ **Browser-callable from static hosting**: `access-control-allow-origin: *` on both endpoints; auth is `?token=` in the query string — no custom headers, no preflight
- ✓ **Free tier adequate**: Free Forever plan = 100 requests/day; `from`/`to` range queries mean gap recovery costs **one request per instrument regardless of gap length**, so tens of instruments per review fits comfortably
- **Mapping**: stock close = candle `c` per day (`t` is a unix timestamp per element); option close = quote `last` per day (`updated` is the day), falling back to `mid` when `last` is null, omitting the date when both are null. `s:"no_data"` or an absent date = no observation (the feed is the calendar). Adapter converts our option InstrumentKey (`AAPL 2027-12-17 C 300`) to the OCC symbol (`AAPL271217C00300000`).
- **Live findings from T6 (2026-07-18), all curl-verified**: (1) an entirely-empty range returns **HTTP 404 with body `{"s":"no_data","prevTime":null,"nextTime":null}`** — `no_data` must be recognized *before* any non-2xx status is treated as an error; (2) an **unknown symbol is indistinguishable from a closed-market range** (same 404/`no_data`) — the provider offers no distinct unknown-symbol error, so unknown symbols simply produce zero observations and stay in `missingMarks`; (3) **AAPL is the keyless trial symbol** (real data for any token, HTTP 203) — never use it to validate a key; a bad key on any other symbol returns 401 `{"s":"error","errmsg":"Invalid token."}`; (4) HTTP/2 responses carry an empty `statusText`, so provider errors without `errmsg` need an explicit `HTTP <status>` fallback message.

**Runner-up: Polygon.io** — CORS-permissive (reflects `Origin`, verified), `?apiKey=` in query, free Basic tiers cover stock *and* option EOD via `/v2/aggs/ticker/{T}/range/1/day/{from}/{to}` (options use `O:` + OCC ticker). Passed over because the 5 req/min free-tier throttle would force adapter-side pacing, and the data path could not be verified without creating an account — marketdata.app was verified end-to-end keyless. Switch here if marketdata's 100/day ever becomes the constraint.

### Tasks

- [x] **S4.1.T1 — Choose the provider.** Document the choice and the runner-up in this file (edit it) with the criteria above checked off for real (curl the endpoints for a stock close and an option-contract close from a browser context).
- [x] **S4.1.T2 — Adapter + registration.**

  ```
  describe "<Provider>Adapter"
  - it supports stock instruments and the provider's covered option contracts
  - it declines instruments it cannot serve (supports() false)
  - it maps provider responses to SourceObservations (instrument, date, close)
  - it returns observations only for dates the provider returned (closed days absent, never zero-filled)
  - it surfaces provider errors as thrown typed errors (bad key, rate limit)
  - it maps an unknown symbol to zero observations (the provider answers no_data, not an error — see Live findings)
  describe "composition root"
  - it registers enabled adapters in Settings priority order
  - it registers nothing when no source is enabled (Slice 1 no-op path unchanged)
  ```

- [x] **S4.1.T3 — Settings UI.** Pricing-sources section: enable/disable, API-key entry, and **Test this source** — runs a one-instrument `PriceBook.fetch` and renders the `FetchReport` (success, or the error with its reason).

  ```
  describe "PricingSettings"
  - it persists enablement and key via Workspace.settings
  - it shows test success with the fetched close
  - it shows a bad key's error message verbatim
  ```

- [x] **S4.1.T4 — Integration tests**: adapter against recorded fixtures (no live calls in CI) — fetch a 3-day range → observations mapped; error fixture → typed error.
- [x] **S4.1.T5 — Playwright e2e** (`e2e/s4-1-source.spec.ts`): enable source with a fake key against a mocked endpoint → test-source shows a close.
- [x] **S4.1.T6 — Browser verification.** With a real API key in a real browser: test-source returns a real close for a held ticker and a held contract; a wrong key shows its reason. All suites green.

---

## ☑ Story S4.2 — The review fetch

> As a trader, I want my Daily Review to fetch everything since my last review in one step — including the days I missed — so that I only type the prices my source couldn't provide.

**Deep interfaces**: `PriceBook.fetch` full orchestration (routing via `supports()` in priority order, manual-sticky, re-fetch replaces fetched, `FetchReport` populated), the agenda's existing one-bulk-fetch call now does real work — **UI changes by zero lines** ([review.md](../design/review.md): the sources-vs-manual branch lives inside PriceBook).

### Tasks

- [x] **S4.2.T1 — Fetch orchestration.**

  ```
  describe "PriceBook.fetch (with adapters)"
  - it stores fetched Marks with origin 'fetched'
  - it never overwrites a manual Mark (skippedManual reports it)
  - it replaces a previously fetched Mark on re-fetch
  - it routes each instrument to the first adapter that supports it
  - it reports unsupported instruments (no adapter accepts them)
  - it reports per-instrument errors with source id and message, storing the rest
  - it stores nothing for dates the source returned no observation (market closed)
  describe "missingMarks after fetch"
  - it is the authoritative remainder: fetched dates gone, error/unsupported dates still listed
  ```

- [x] **S4.2.T2 — Collection screen.** The agenda's post-fetch state renders the `FetchReport`: stored Marks as pre-filled rows for an eyeball check, `skippedManual` as already-done, errors with their reasons ("API key expired" — not five contracts mysteriously needing typing); unsupported + errored instruments flow to the per-Trade manual prompts in the walk, exactly as before.

  ```
  describe "ReviewCollection (fetched)"
  - it shows fetched closes as pre-filled rows per Trade
  - it shows error reasons attached to their instruments
  - it sends unsupported instruments to the manual walk prompts
  - it recovers a two-day gap silently when the source covers it
  describe "walk (fetched marks)"
  - it prompts only for instruments the fetch did not satisfy
  ```

- [x] **S4.2.T3 — Integration tests**: two Trades (stock + option), adapter fixture covering the stock only, three-day gap → fetch stores 3 stock Marks; agenda's manual rows = option contract only; a manual Mark recorded earlier survives re-fetch (`skippedManual`).
- [x] **S4.2.T4 — Playwright e2e** (`e2e/s4-2-review-fetch.spec.ts`): mocked source → review session where the stock rows arrive pre-filled and only the contract is typed.
- [x] **S4.2.T5 — Browser verification.** A real review session against the live source: gap since last review backfills; the walk prompts only for what the source missed; diff this session's typing against a Slice 1-era session to confirm the deletion of work. Verify no UI code change was needed for the collection path (git diff shows PriceBook/adapters only for the flow itself). All suites green.

---

## ☑ Story S4.3 — Ad-hoc refresh

> As a trader, I want to refresh a Trade's prices from its detail page mid-day or before a decision, so that a judgment call can use a current mark without waiting for tonight's review.

**Deep interfaces**: `PriceBook.fetch` reused for one Trade's instruments, today only ([pricebook.md](../design/pricebook.md) names this the secondary FetchReport consumer). No new operations.

### Tasks

- [x] **S4.3.T1 — Refresh action.** "Refresh prices" on Trade detail: fetch(heldInstrumentsOf(trade), today..today) → re-render the dashboard; failures surface the report's reasons inline; manual Marks stay sticky (a deliberate mid-price the trader typed is not clobbered by a refresh). (Amended from the original `instrumentsOf` wording, which predated the 2026-07-16 ruling that `marksNeeded` reads held Legs only — a flat Leg never needs a fresh Mark, so refresh follows the same held-instrument filter.)

  ```
  describe "TradeDetail refresh"
  - it fetches only this Trade's instruments for today
  - it re-renders valuation and R/R from the new Marks
  - it leaves a manual Mark for today un-replaced and says so
  - it shows the error reason when the source fails
  ```

- [x] **S4.3.T2 — Integration test**: refresh over Dexie with fixture adapter updates the Mark and the derived numbers; manual-sticky case included.
- [x] **S4.3.T3 — Playwright e2e** (`e2e/s4-3-refresh.spec.ts`): mocked source; refresh updates the dashboard numbers.
- [x] **S4.3.T4 — Browser verification.** Live refresh on a real Trade: numbers move to today's close; a manually typed mid survives a second refresh. All suites green.

---

## ☐ Story S4.4 — Quiet weekends & source visibility *(added 2026-07-19 — slice re-opened after live use surfaced two collection-step gaps; the `slice-4-complete` tag remains the historical rollback point for S4.1–S4.3)*

> As a trader, I want my review to stop asking for prices on days the market was closed, and to tell me plainly when no pricing source is set up, so that the collection step only ever shows work that's real.

**Why (observed in live use, 2026-07-19):** (1) `missingMarks` enumerates every calendar date, so Saturdays and Sundays prompt as dead rows forever — even with a working source — contradicting review.md's own "a closed Tuesday simply returns no observations — the feed is the calendar, nobody is asked." (2) A workspace with no pricing source configured silently routes *everything* to manual prompts; the trader cannot distinguish "source failed" from "no source set up" (this is exactly how the trader experienced it).

**Decided in this story:** v1 gains a **weekend-only calendar** — Saturdays and Sundays are never marks-needed, at the enumeration source of truth, for fetched and manual instruments alike. Market holidays still prompt (rare, skippable); the full feed-is-the-calendar treatment (source-observed non-trading days) arrives with Slice 17's Daily Bars. pricebook.md's "there is no trading calendar" bullet is amended (dated) by this story.

**Deep interfaces**: the weekend filter in `PriceBook.missingMarks` (and its follow-through in `Valuations.marksNeeded` ranges); a no-source signal surfaced to the review collection screen (seam is the implementer's call — flag it; the FetchReport's everything-unsupported shape is currently indistinguishable from no-adapters).

### Tasks

- [ ] **S4.4.T1 — Weekend-quiet enumeration.**

  ```
  describe "PriceBook.missingMarks (weekend-quiet)"
  - it never lists a Saturday or Sunday
  - it still lists weekday gaps in the same range
  describe "Valuations.marksNeeded (weekend-quiet)"
  - it needs only Monday when a Friday Mark exists and the review runs Monday
  ```

- [ ] **S4.4.T2 — No-source notice.** The review collection screen states "no pricing source configured" with a pointer to Settings when zero sources are enabled; silent no-op is gone.

  ```
  describe "ReviewCollection (no source)"
  - it shows a set-up-a-source notice when no pricing source is enabled
  - it shows no notice when a source is enabled
  ```

- [ ] **S4.4.T3 — Integration tests**: Friday Mark → Monday review over Dexie needs Monday only (no weekend rows anywhere in the agenda or walk); a no-source workspace shows the notice, a sourced one doesn't.
- [ ] **S4.4.T4 — Playwright e2e** (`e2e/s4-4-weekend-quiet.spec.ts`): a review spanning a weekend gap prompts no Saturday/Sunday rows; the no-source notice appears on an unconfigured workspace.
- [ ] **S4.4.T5 — Browser verification.** Real browser on the live workspace: a review after this weekend prompts no Sat/Sun rows and shows no dead prompts for fetched instruments; the notice appears in a fresh keyless context and disappears once the key is saved. All suites green.
