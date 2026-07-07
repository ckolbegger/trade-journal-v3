# Slice 17 — Daily Bars

Fetched observations grow up from single closes to OHLC: Daily Bars persist as the observation record (ADR 0008), Marks default from a bar's close while remaining the trader's valuation decision, candlestick charts render the instrument's story, and trailing stops upgrade from closes to intraday highs where a single instrument is the scope.

**Decided in this slice:** trailing high-water uses bar **highs only when the scoped structure is a single instrument** (plain stock, one option leg). Multi-instrument scopes stay on same-day closes: combining different legs' intraday extremes would trail a value the structure may never have had at any moment — the same trap ADR 0012 bans across days.

**Out of scope (JIT):** pattern detection (the roadmap says bars *enable* it; nothing schedules it — no story, no code), `SourceObservation.iv` (still consumed by nothing).

Design references: ADR 0008, ADR 0012 (trailing), [pricebook.md](../design/pricebook.md) (storage notes), [trademath.md](../design/trademath.md) (open item: closes until Daily Bars).

---

## ☐ Story S17.1 — Bars as the observation record

> As a trader, I want fetches to keep the whole day's range, not just the close, so that the record shows what prices actually did while my Mark stays my valuation call.

**Deep interfaces**: `SourceObservation` gains `ohlc` (the Slice 4 deferral lands); adapter maps provider OHLC; PriceBook stores bars in an additive `bars` table keyed (instrument, date); Mark defaults from the bar's close **iff no Mark exists** for that key; manual Marks stay sticky over everything.

### Tasks

- [ ] **S17.1.T1 — Bar storage + Mark defaulting.**

  ```
  describe "PriceBook (bars)"
  - it stores a bar per (instrument, date) from fetch
  - it defaults the Mark to the bar's close when no Mark exists
  - it leaves an existing manual Mark untouched when its bar arrives (Mark ≠ close, deliberately)
  - it replaces a fetched bar on re-fetch
  - it serves bars by instrument and range
  describe "<Provider>Adapter (ohlc)"
  - it maps the provider's OHLC into SourceObservation.ohlc
  - it still yields close-only observations from endpoints without OHLC
  ```

- [ ] **S17.1.T2 — Review unchanged.** No collection UI changes: the fetch stores bars alongside Marks; a manual override in the walk still wins and survives re-fetch (Slice 1's one-collection-path holds).

  ```
  describe "review with bars (integration)"
  - it backfills a gap with bars and their defaulted Marks in one fetch
  - it keeps a walk-typed manual mid as the Mark while the bar records the day
  ```

- [ ] **S17.1.T3 — Integration tests**: fixture adapter with OHLC over Dexie → bars + Marks stored; manual-override case; Dexie schema migration adds the table without touching existing stores.
- [ ] **S17.1.T4 — Playwright e2e** (`e2e/s17-1-bars.spec.ts`): mocked OHLC source → review fetch → Mark equals the close; override it manually → re-fetch keeps the override.
- [ ] **S17.1.T5 — Browser verification.** Live source in a real browser: fetch a real day, inspect the stored bar vs the Mark; override with a mid and re-fetch to prove stickiness. All suites green.

---

## ☐ Story S17.2 — Candlesticks

> As a trader, I want a candlestick chart of the underlying across my Trade's life, so that I see the price story my Marks sampled — as it happened, nothing projected.

**Deep interfaces**: bars feed a candlestick chart on the Trade detail (underlying, Trade's date range); execution dates and Exit Levels overlay as reference lines; reflective only (ADR 0009).

### Tasks

- [ ] **S17.2.T1 — Chart.**

  ```
  describe "CandlestickView"
  - it renders the underlying's bars across the Trade's life
  - it renders close-only history (pre-bars dates) as marks, not fake candles
  - it overlays execution dates and current Exit Levels
  - it shows gaps as gaps
  - it contains no forward-looking element
  ```

- [ ] **S17.2.T2 — Integration + e2e** (`e2e/s17-2-candles.spec.ts`): seeded bars + a Trade → chart shows the range with the entry marker at its date.
- [ ] **S17.2.T3 — Browser verification.** Real browser over live-fetched bars: candles match the provider's chart for spot-checked days; pre-bars history renders honestly; overlays sit on the right dates. All suites green.

---

## ☐ Story S17.3 — Trailing on intraday highs

> As a trader, I want my trailing stop to track the day's high, not just the close, so that "don't give back $5 from the top" means the actual top once the data exists.

**Deep interfaces**: trailing high-water (Slice 10) reads bar highs for single-instrument scopes, closes otherwise (decided semantics above). Requires Slice 10.

### Tasks

- [ ] **S17.3.T1 — High-water upgrade.**

  ```
  describe "TradeMath trailing (bars)"
  - it uses bar highs for a single-instrument scope: closes 150,155,160 with highs 152,157,162 → trail 157 (162−5)
  - it uses bar lows symmetrically for a short single-instrument scope
  - it keeps same-day closes for multi-instrument scopes even when bars exist
  - it mixes history: close-only dates contribute closes, bar dates contribute highs
  - it detects the crossing against the upgraded trail
  ```

- [ ] **S17.3.T2 — Integration + e2e** (`e2e/s17-3-trailing-highs.spec.ts`): seeded bars where the high (not the close) sets the trail → displayed trail and crossing flag match hand-computed values.
- [ ] **S17.3.T3 — Browser verification.** Real browser: a stock Trade with a trailing stop over fetched bars; verify the displayed trail derives from a day's high that exceeded its close, and the dashboard explains the source ("high 162.00"). All suites green.
