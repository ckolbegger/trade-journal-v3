# Slice 4 — Automated pricing (Marks only)

Daily Review's typing disappears where a provider can supply prices: a PricingSource adapter fetches end-of-day Marks for stocks and option contracts, the review's one bulk fetch fills the gap since the last review, and the trader only types what the source couldn't deliver. Manual entry remains a complete, permanent workflow (ADR 0008).

**Out of scope (JIT):** Daily Bars / OHLC persistence (Slice 17 — `SourceObservation.ohlc` stays unused and is *not* added to the type until then), IV from feed (`SourceObservation.iv` likewise), multiple simultaneous providers beyond the priority-order mechanism the design requires, secrets exclusion from export (Slice 6 owns `exportAll`; whichever of Slice 4/6 lands second adds the API-key-exclusion test).

Design references: [pricebook.md](../design/pricebook.md) (fetch semantics, FetchReport, gap recovery), [review.md](../design/review.md) (one collection path), [workspace.md](../design/workspace.md) (settings), ADR 0008.

---

## ☐ Story S4.1 — First pricing source

> As a trader, I want to enable a market-data provider with my API key, so that the app can fetch closing prices for my tickers and contracts instead of me typing them.

**Deep interfaces**: `PricingSource` (adapter — `id`, `supports`, `fetch` returning `SourceObservation[]` with `close` only), adapter registration in the composition root in priority order from `Settings.pricingSources`, Settings UI (enable + API key + **test this source**).

**Provider selection is this story's first task, with acceptance criteria** (ADR 0008 defers the choice to here): must serve end-of-day closes for US stocks *and individual option contracts*; callable from a static-hosted browser app (CORS-permissive or key-in-query); free or cheap tier adequate for tens of instruments/day. Evaluate against the trader's actual holdings before wiring.

### Tasks

- [ ] **S4.1.T1 — Choose the provider.** Document the choice and the runner-up in this file (edit it) with the criteria above checked off for real (curl the endpoints for a stock close and an option-contract close from a browser context).
- [ ] **S4.1.T2 — Adapter + registration.**

  ```
  describe "<Provider>Adapter"
  - it supports stock instruments and the provider's covered option contracts
  - it declines instruments it cannot serve (supports() false)
  - it maps provider responses to SourceObservations (instrument, date, close)
  - it returns observations only for dates the provider returned (closed days absent, never zero-filled)
  - it surfaces provider errors as thrown typed errors (bad key, rate limit, unknown symbol)
  describe "composition root"
  - it registers enabled adapters in Settings priority order
  - it registers nothing when no source is enabled (Slice 1 no-op path unchanged)
  ```

- [ ] **S4.1.T3 — Settings UI.** Pricing-sources section: enable/disable, API-key entry, and **Test this source** — runs a one-instrument `PriceBook.fetch` and renders the `FetchReport` (success, or the error with its reason).

  ```
  describe "PricingSettings"
  - it persists enablement and key via Workspace.settings
  - it shows test success with the fetched close
  - it shows a bad key's error message verbatim
  ```

- [ ] **S4.1.T4 — Integration tests**: adapter against recorded fixtures (no live calls in CI) — fetch a 3-day range → observations mapped; error fixture → typed error.
- [ ] **S4.1.T5 — Playwright e2e** (`e2e/s4-1-source.spec.ts`): enable source with a fake key against a mocked endpoint → test-source shows a close.
- [ ] **S4.1.T6 — Browser verification.** With a real API key in a real browser: test-source returns a real close for a held ticker and a held contract; a wrong key shows its reason. All suites green.

---

## ☐ Story S4.2 — The review fetch

> As a trader, I want my Daily Review to fetch everything since my last review in one step — including the days I missed — so that I only type the prices my source couldn't provide.

**Deep interfaces**: `PriceBook.fetch` full orchestration (routing via `supports()` in priority order, manual-sticky, re-fetch replaces fetched, `FetchReport` populated), the agenda's existing one-bulk-fetch call now does real work — **UI changes by zero lines** ([review.md](../design/review.md): the sources-vs-manual branch lives inside PriceBook).

### Tasks

- [ ] **S4.2.T1 — Fetch orchestration.**

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

- [ ] **S4.2.T2 — Collection screen.** The agenda's post-fetch state renders the `FetchReport`: stored Marks as pre-filled rows for an eyeball check, `skippedManual` as already-done, errors with their reasons ("API key expired" — not five contracts mysteriously needing typing); unsupported + errored instruments flow to the per-Trade manual prompts in the walk, exactly as before.

  ```
  describe "ReviewCollection (fetched)"
  - it shows fetched closes as pre-filled rows per Trade
  - it shows error reasons attached to their instruments
  - it sends unsupported instruments to the manual walk prompts
  - it recovers a two-day gap silently when the source covers it
  describe "walk (fetched marks)"
  - it prompts only for instruments the fetch did not satisfy
  ```

- [ ] **S4.2.T3 — Integration tests**: two Trades (stock + option), adapter fixture covering the stock only, three-day gap → fetch stores 3 stock Marks; agenda's manual rows = option contract only; a manual Mark recorded earlier survives re-fetch (`skippedManual`).
- [ ] **S4.2.T4 — Playwright e2e** (`e2e/s4-2-review-fetch.spec.ts`): mocked source → review session where the stock rows arrive pre-filled and only the contract is typed.
- [ ] **S4.2.T5 — Browser verification.** A real review session against the live source: gap since last review backfills; the walk prompts only for what the source missed; diff this session's typing against a Slice 1-era session to confirm the deletion of work. Verify no UI code change was needed for the collection path (git diff shows PriceBook/adapters only for the flow itself). All suites green.

---

## ☐ Story S4.3 — Ad-hoc refresh

> As a trader, I want to refresh a Trade's prices from its detail page mid-day or before a decision, so that a judgment call can use a current mark without waiting for tonight's review.

**Deep interfaces**: `PriceBook.fetch` reused for one Trade's instruments, today only ([pricebook.md](../design/pricebook.md) names this the secondary FetchReport consumer). No new operations.

### Tasks

- [ ] **S4.3.T1 — Refresh action.** "Refresh prices" on Trade detail: fetch(instrumentsOf(trade), today..today) → re-render the dashboard; failures surface the report's reasons inline; manual Marks stay sticky (a deliberate mid-price the trader typed is not clobbered by a refresh).

  ```
  describe "TradeDetail refresh"
  - it fetches only this Trade's instruments for today
  - it re-renders valuation and R/R from the new Marks
  - it leaves a manual Mark for today un-replaced and says so
  - it shows the error reason when the source fails
  ```

- [ ] **S4.3.T2 — Integration test**: refresh over Dexie with fixture adapter updates the Mark and the derived numbers; manual-sticky case included.
- [ ] **S4.3.T3 — Playwright e2e** (`e2e/s4-3-refresh.spec.ts`): mocked source; refresh updates the dashboard numbers.
- [ ] **S4.3.T4 — Browser verification.** Live refresh on a real Trade: numbers move to today's close; a manually typed mid survives a second refresh. All suites green.
