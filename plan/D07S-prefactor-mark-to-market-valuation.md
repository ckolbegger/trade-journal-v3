# D7S prefactor: one Mark-to-Market Valuation, task breakdown

Status: **breakdown agreed by the user on 2026-11-10 (P77–P89, A189–A194).** The design came from the architecture review of D7's commits on 2026-11-08 to 2026-11-10 (candidate 1, with candidate 6 folded in). Its answers are recorded in section 9. The three questions left open at drafting were answered on 2026-11-10 (section 1.6), and the user added a cleanup of tech debt item 4 (T7SP.13). Plan revision 72 (decisions 101 and 102) adds this breakdown and its amendment notes (section 8) to the frozen plan.

The prefactor runs **after D7 and before D7S's breakdown is drafted**. D7S (Option-price Stops and Targets, decision 89) is the next deliverable in the summary table, and its structure-value conditions are measured from the contract's Mark, so D7S's breakdown is written against this module. D8's breakdown was agreed on 2026-10-17 and does not touch valuation (section 8 lists the one check it needs). The prefactor starts from the commit tagged `claude-opus-5.5-pre-d7sp` (the current D7 retro head plus the plan revision that adds this breakdown). It changes product code, tests, one lint config and one spec. No stored data, schema or index changes. One screen gains a line: the Review card shows an option Trade's dated line, as Trade Views already does (P83).

**Why.** Trade Views and Daily Review each turn a Trade plus its Marks into an evaluation by hand. They disagree in three ways:
- **Where the Instruments come from.** Daily Review takes them from `derive`'s `observationRequirements` (`daily-review.ts:94`). Trade Views works them out again from the Planned Leg (`instrumentsOf`, `trade-views.ts:459`) and copies `derive`'s expiration rule (`afterExpiration`, `:465`). D7's fix T7.32-B6 changed only that copy.
- **Which date.** Daily Review resolves its session first, then derives at that date, then reads frames for it. Trade Views reads frames first and learns the date from them, with `derive` given no valuation date (`:840`, `:946`).
- **The option dated line.** Trade Views shows it (decision 97, T7.30-B3). Daily Review skips it for options (`daily-review.ts:251`) for a mechanical reason only. D7's T7.6 intended it everywhere ("reuses D4's mechanism unchanged").

Under those two coordinators, the expiration rule is written as a raw date comparison at nine places in four modules (section 1.5).

**Goal.** One module, **Mark-to-Market Valuation**, values one Trade on one date. It reads its Marks through a Market Data read session that the coordinator opens once per operation and that never reads per Trade. The date is settled once, by the session. `derive` records each option position's contract status at that date, and `evaluate` reads it. The two expiration rules live only in the Instrument module.

---

## 1. Decisions and assumptions

### 1.1 What changes and what stays

| Today | After the prefactor |
|---|---|
| `coordinators/valuation.ts` holds `observationFrame` and the dated line; each coordinator does the rest. | `src/coordinators/valuation/` values one Trade per call: Instruments, frames, the Underlying's pairing, the post-expiration case, a date outside coverage, a Closed Trade, the dated line, Settlement Due items and their times, and gaps (P77). |
| Coordinators call `MarketData.query(ResolveFrames)` and `recover` with all Trades' Instruments at once. | Coordinators open a Market Data read session per operation, and the valuation module reads through it per Trade. The session reads each date once and each Instrument's Stale context or gaps once (P79). |
| Trade Views derives without a valuation date and takes the date from the frames. | The session resolves the date when it opens; every caller derives at it (P78). |
| `evaluate` compares the frame's date with the expiration (`evaluate.ts:229`, `:427`). | `derive` records `Live`, `DueToday` or `PastExpiration` for each option position, and `evaluate` reads it (P81). |
| Nine raw expiration comparisons. | `expiredOn` and `settlementDueOn` in `src/domain/instrument/`, enforced by an ESLint rule (P82). |
| The Review card has no dated line for an option Trade. | It has one, as the Trades list and Detail do (P83). |

**Stays unchanged:**
- **Stored data:** every store, index, record and the schema version (6). Every `dump.json` stays byte-identical.
- **Facade operations:** names, requests, result branches and shapes, except the one optional Review field P83 fills for options.
- **Request counts:** every existing query-count proof passes unchanged (D2, D4, D5, D5R, D6, D7, and D7's Open-list proof). The only new reads are P83's and are added as a new proof (P84).
- **Expiration Payoff** stays outside the module (ADR 0007): `payoffOf` remains in `coordinators/settlement.ts`.
- **Glossary:** no change. The module's name is the existing term.

### 1.2 Decisions

Numbering continues from D7's handoff: P77, A189, decision 101.

| # | Question | Decision | Alternatives and tradeoff |
|---|---|---|---|
| P77 | **What is the module, and how wide is its interface?** | **Mark-to-Market Valuation, `src/coordinators/valuation/`, one Trade per call.** It is an internal module shared by two coordinators (ADR 0001: implementation composition is a choice behind the public interfaces), not a facade interface. A call takes a read session and one Trade's `TradeAnalysisRecord`, and returns the evaluation, the dated line, the Settlement Due items with their times, and the Instruments' gaps when the session recovers. It absorbs `valuation.ts` and `settlementTimeOf`. The names are indicative; T7SP.6 fixes them. | Many Trades per call: rejected by the user (Q4); batching belongs to I/O, which the session owns. Callers read Market Data and pass frames in: rejected by the user (Q2); every caller would keep the sequencing. |
| P78 | **Who owns the valuation date?** | **The read session.** Opening a session for a context (`Current`, `Review`, `Historical`) resolves the trading date once. The module derives at that date and reads frames through the session, so every frame's date equals the state's valuation date by construction. Callers never pass a date. A Closed Trade is valued at its terminal date with no session read (P80). | Callers pass a date beside the session and the module checks they agree: two dates that can disagree, which is the defect this removes. |
| P79 | **How are Marks read without a read per Trade?** | **A Market Data read session per coordinator operation** (`open`, `getTrade`, `save`'s binding check, `browseTrades`, `getTradeDetail`). It is real Market Data in production and in tests, with no cache adapter. Within one session it reads each date's observations once (the date-wide read `ResolveFrames` makes today, `market-data.ts:527`), each Instrument's Stale context and gaps once, and each expiration date's session from the calendar. It gives the evidence binding and one snapshot id per date to the caller at the end. A new session reads fresh. `specs/design/market-data.md` gains the operation (O1, agreed). | Accept per-Trade reads and relax the proofs: rejected by the user (Q5); the overview forbids "one storage query per Trade" (Performance design constraint). A cache only production uses: rejected by the user; tests would run another read path. |
| P80 | **Cases that read nothing** | **The module handles them.** A date outside session-policy coverage returns coverage `NotCovered` and its figures `Unavailable(SessionPolicyNotCovered)`, as Trade Views does today. A Closed Trade returns every Mark-dependent figure `NotApplicable(NoRemainingPosition)` at its terminal date (A92). A Trade whose facts can't be replayed returns `Unavailable(FactsIncoherent)` with no read. | Callers check first: the knowledge leaks back into each coordinator. |
| P81 | **Contract status** | **`derive` records each option position's status at its valuation date: `Live` (before the expiration date), `DueToday` (on it) or `PastExpiration` (after it).** A stock position and a contract with no open quantity have none. `observationRequirements` keeps a contract's Mark and its Underlying's for `Live` and `DueToday`. `evaluate` reads the status for `SettlementDue` figures and the settlement items' `Due` status, and rejects a frame whose trading date differs from the state's valuation date. | Two flags, `needsMark` and `settlementDue`: rejected by the user (Q9); on the expiration day both hold, and one status makes callers handle that day on purpose. |
| P82 | **The two expiration rules** | **`expiredOn(contract, date)`, true when the date is after the expiration date, and `settlementDueOn(contract, date)`, true on or after it, in `src/domain/instrument/`.** The five entry checks call them (`derive.ts:438`, `:455`, `plan.ts:187`, `market-data.ts:408`, `section.ts:50`), as does `derive` when it records the status, and the benchmark generator (`bench-generator.ts:662`). A `no-restricted-syntax` rule fails a relational comparison with an `.expiration` member outside the Instrument module, except a comparison of two expirations (a sort). | Leave the comparisons inline: the rule stays written nine times. |
| P83 | **The option dated line in the Review** | **Shown, as in the Trades list and Detail** (Q3). `ReviewTradeItem.datedLastClose` is filled for an option Trade when its contract has a Stale context or Lots opened after the last exact close, with the Underlying's frame at that close. `CardFigures` renders it unchanged (it renders any evaluation). **Amended by decision 104 (revision 74):** the field is on `getTrade`'s card (`DailyTradeReview`), and only `getTrade` computes the line; the Review open computes none. | Keep the Review without it: then it should be a written rule, and none exists (D7's T7.6 says the mechanism is reused unchanged). |
| P84 | **The Review's request count** | **One `observations` read per distinct earlier close date that an option Trade's dated line needs, and none per Trade**, the rule decision 97 set for the Open page. A new proof, `tests/integration/d7sp/review-query-count.test.ts`, pins it. The existing Review proofs don't change, because none of their Trades has an option dated line (D7's proof uses expired or not-yet-due contracts). Recorded as plan decision 102. **Amended by decision 104 (revision 74):** the Review open computes no dated line and makes no read for one. `getTrade` makes at most one `observations` read for its Trade's line. The proof pins both. | Keep the Review at D6's counts: then P83 can't be done. |
| P85 | **Coordinator tests that move** | **Kept unchanged through the refactor as proof that it changed nothing, then trimmed in T7SP.12** to one wiring case per coordinator for each behaviour the module now owns. | Keep them all: D5R2 did, and it became tech debt item 4. Delete them at once: no proof of no change. |
| P86 | **Gate** | **No browser critic** (O2, agreed). One new browser spec covers the only visible change (P83), and the cumulative run on the full tier covers the rest. Starting and finishing tags `claude-opus-5.5-pre-d7sp` and `claude-opus-5.5-d7sp`. | A short critic on the Review card: the change is one existing figure group appearing for options. |
| P87 | **IDs and evidence** | Tasks `T7SP.1` to `T7SP.15`; `tdd.sh` maps them to `evidence/D07SP/` (`tdd-log.md`, `structural.md`, `suite-runs/`). Browser specs in `e2e/d7sp/`, integration cases in `tests/integration/d7sp/`. | Under D7S: its evidence would open with work that isn't D7S's. |
| P88 | **Order** | **After D7, before D7S's breakdown** (Q14, as amended by the finding that D7S, not D8, is next). Once the tag is made, check D8's breakdown for stale references (section 8). | D7S first: its breakdown would be rewritten after the refactor, which the user wants to avoid. |
| P89 | **Tech debt item 4 is cleared here** (at the user's direction, 2026-11-10) | **T7SP.13 trims the due-classification cases that D5R2 kept in `src/coordinators/daily-review/reflections.test.ts` and `src/coordinators/trade-views/debt-status.test.ts`**, as item 4's fix describes. Each suite keeps one case per classification (Due, Due in the next Review, Due in the Review after next) and Trade Views keeps decision 56's no-frame case, which proves the coordinator passes the right closes. Every boundary case then lives only in `classifyDue`'s suite (`src/domain/journal-debt/classify-due.test.ts`). A coordinator assertion with no matching `classifyDue` case (for example `reflections.test.ts:96`'s anchor written with a New York offset, if `classifyDue`'s cases don't cover an offset) moves to `classify-due.test.ts` rather than being dropped. Tests only: no code, and no visible change. It runs after T7SP.12 and before the latency harness. | Leave item 4 for later: it is the same kind of trim as T7SP.12, in neighbouring suites, and the user asked for it now. |

### 1.3 The read session (indicative; added to the spec by O1)

```ts
// src/modules/market-data/ (P79). Names are indicative; T7SP.5 fixes them.
openReadSession(context: FrameContext): Promise<MarketDataReadSession>

interface MarketDataReadSession {
  // Resolved once at open (P78). Outside coverage: the as-of exchange date, with `covered: false`.
  readonly tradingDate: string; readonly closeInstant?: string; readonly covered: boolean;
  frames(instruments: readonly string[]): Promise<readonly MarkFrame[]>;          // the session's date
  historicalFrames(date: string, instruments: readonly string[]): Promise<readonly MarkFrame[]>;  // decision 97
  gaps(instruments: readonly { instrumentKey: string; earliestExposure: string }[]): Promise<HistoricalGaps[]>;
  settlementTime(contract: OptionInstrument): Promise<SettlementTime>;           // calendar only (decision 99)
  binding(): { readonly evidenceBinding: EvidenceBinding; readonly snapshotIds: Readonly<Record<string, string>> };
}
```

A frame from a session equals the frame `ResolveFrames` returns for the same context and Instrument; T7SP.5 proves it case by case. `recover`'s provider fetch is out of scope until D11, when it moves behind `gaps` unchanged.

### 1.4 Coherence

Each date-wide read and each Stale-context or gap lookup is its own read transaction, as decision 97's Historical reads already are on the Open page. Coherence across them rests on the evidence binding, as today: a Review save presents every key its session read, and Market Data rechecks each one at commit (ADR 0011). A read view assembled while another tab saves a Mark can show that Mark on one Trade and not another, exactly as the Open page can today across its Historical reads. This prefactor does not narrow or widen that.

### 1.5 Lookups (drafting guide)

**Checks.** The throwaway rule (`no-restricted-syntax`, a relational operator with an `.expiration` member on either side, outside `src/domain/instrument/` and test files), run on the current tree, gave 10 hits:

| Hit | What it is | What happens |
|---|---|---|
| `derive.ts:438` | Execution after expiration (`AfterExpiration`) | `expiredOn` (T7SP.2) |
| `derive.ts:455` | Settlement time after expiration | `expiredOn` (T7SP.2) |
| `derive.ts:660` | Observation requirements | the status (T7SP.3) |
| `evaluate.ts:229` | Figures `SettlementDue` | reads the status (T7SP.4) |
| `evaluate.ts:427` | Settlement item `Due` | reads the status (T7SP.4) |
| `plan.ts:187` | `ContractAlreadyExpired` | `expiredOn` (T7SP.2) |
| `trade-views.ts:467` | `afterExpiration` | deleted (T7SP.7) |
| `market-data.ts:408` | Mark save after expiration | `expiredOn` (T7SP.2) |
| `section.ts:50` | Restore check, Mark after expiration | `expiredOn` (T7SP.2) |
| `daily-review.ts:351` | Sorting settlement items by expiration | not a rule; the selector exempts a comparison of two expirations |

`bench-generator.ts:662` compares a bare `expiration` variable, so the rule doesn't see it; T7SP.2 switches it to `expiredOn` anyway.

**Texts.** No existing text changes. P83 adds the existing "<date> close" group to an option card. No browser case asserts its absence: `e2e/d7/review-expiration.spec.ts`, the only D7 Review spec, mentions "close" only for contexts and the Close Review. **One unit case pins the absence:** `src/coordinators/daily-review/settlement.test.ts:236`, "the dated last close of an option card (T7.24 known defect)", expects `datedLastClose` undefined for ABC's put with only a Stale context. D7's evidence calls this "Stock-only, by design: T7.15 builds an option card's dated last close from the Underlying frame as a Stock Instrument (C6, K18). Not a defect" (`evidence/D07/structural.md:1272`, the T7.30-B3 note). P83 reverses that note at the user's direction (Q3), and T7SP.8 flips the case's expectation.

**Shapes.** `ReviewTradeItem.datedLastClose` is optional and already exists; only options newly fill it. (**Corrected by decision 104, revision 74:** the field is `DailyTradeReview.datedLastClose`, on `getTrade`'s card, `src/coordinators/daily-review/types.ts:281`. `ReviewTradeItem` has none.) `DerivedTradeState` gains the status and the valuation date. Lookups:
- `grep -rln 'datedLastClose' tests/fixtures` → `workspace-v5/expected-views.json`, `workspace-v6/expected-views.json` (3 occurrences each, stock Trades). T7SP.10 checks whether v6's Review view holds an option Trade that gains a line.
- `grep -rln 'observationRequirements' tests/fixtures tools` → none. `DerivedTradeState` is not in any snapshot.

### 1.6 Questions left open at drafting (answered 2026-11-10)

| # | Question | Answer |
|---|---|---|
| O1 | **The read session changes Market Data's specified interface.** `specs/design/market-data.md` lists eight operations, and `query` is "a closed family". Amend the spec, or keep it and build the session in the coordinators over today's `query`? The second can't remember a date-wide read across calls with different Instruments, so it would need every Trade's Instruments up front: the batching the user rejected in Q4. | **Amend the spec.** `market-data.md` gains `openReadSession(context)` in its Contract, and a paragraph in "Query contract": a session returns the frames `ResolveFrames` would, reads each date and Instrument once, and binds as `ResolveFrames` does. |
| O2 | **A browser critic?** | **None** (P86). The only visible change is an existing figure group appearing on option cards, and T7SP.11 covers it. |
| O3 | **Run the latency harness?** The query-count proofs fix the request counts, but not the time per request or the in-memory work. | **Yes**, one `bench:run` (T7SP.14), compared with D7's `evidence/D07/bench.md`. Any measured step that regresses by more than 10% stops the gate for the user's decision. |

### 1.7 Working assumptions

| # | Assumption |
|---|---|
| A189 | **Reading** (decision 45): the drafting guide's full `specs/` reading was scoped, as A181 scoped the D7 prefactor's, to: the glossary (Mark-to-Market Valuation, Calculation Result, Settlement Due); ADRs 0001, 0007 and 0011; the overview's approved modules, dependency shape, who may call whom, calculation availability, snapshot binding and performance constraint; Market Data's Contract, Query contract and Automatic recovery; Trade Analysis's `derive`, `evaluate` and Staged evaluation; Daily Review's date and ordering, `open`, `getTrade` and Settlement Due; Trade Views and Reporting's `browseTrades`, `getTradeDetail`, `previewMarkChange` and Invariants. |
| A190 | `previewMarkChange` and `replayTrade` aren't built yet (no source file names them). D9 and D11 build them on the module. |
| A191 | Trade Views' Open page and Detail derive at the session's date (P78) where they derive with no date today. Every existing figure is unchanged, because `evaluate` already takes its date from the frame and the frame's date is the session's. T7SP.7's existing cases prove it. |
| A192 | `derive` without a valuation date (Daily Review's integrity derivation, `daily-review.ts:296`) records no status and no requirements, as today. `evaluate` is never called on such a state after T7SP.7 and T7SP.8. |
| A193 | The session's frame for an Instrument at a date equals `ResolveFrames`' frame for that Instrument alone, field for field, including `previousCloseInstant` and `nextSession`; so do the snapshot ids for a one-Instrument request. Where a session reads several Instruments on one date, its per-date snapshot id covers them all, as one `ResolveFrames` call over them does today. |
| A194 | The new ESLint rule joins `eslint.deps.config.js`, as the domain-purity rules do, so `lint:deps` runs it and `full-suite.sh`'s count of checks doesn't change. |

---

## 2. Task graph

| Task | Title | Kind | Size | Depends on | Seams or verification |
|---|---|---|---|---|---|
| T7SP.1 | Domain: the expiration rules | domain | S | — | `expiredOn`, `settlementDueOn` |
| T7SP.2 | The entry checks call the rules | structural | S | T7SP.1 | existing cases |
| T7SP.3 | Trade Analysis: contract status in `derive` | domain | S | T7SP.1 | `TradeAnalysis.derive` |
| T7SP.4 | Trade Analysis: `evaluate` reads the status | domain | S | T7SP.3 | `TradeAnalysis.evaluate` |
| T7SP.5 | Market Data: the read session | domain/persistence | M | — | `MarketData.openReadSession` |
| T7SP.6 | Mark-to-Market Valuation | application | M | T7SP.4, T7SP.5 | the module's call |
| T7SP.7 | Trade Views value through the module | structural | M | T7SP.6 | existing cases, query-count proofs |
| T7SP.8 | Daily Review values through the module | application | M | T7SP.6 | `DailyReview.open`, `getTrade` |
| T7SP.9 | The expiration-comparison lint rule | structural | S | T7SP.2, T7SP.4, T7SP.7, T7SP.8 | the rule, with a planted violation |
| T7SP.10 | Fixture views | structural | S | T7SP.8 | `verify:fixtures` |
| T7SP.11 | Browser: the option dated line in the Review | test | S | T7SP.8 | `e2e/d7sp/review-dated-line.spec.ts` |
| T7SP.12 | Trim the coordinator cases that moved | structural | S | T7SP.7, T7SP.8 | the trimmed suites |
| T7SP.13 | Trim D5R2's due-classification cases (tech debt item 4) | structural | S | T7SP.12 | the trimmed suites, `classify-due.test.ts` |
| T7SP.14 | Latency harness (O3) | test | S | T7SP.13 | `bench:run` |
| T7SP.15 | Gate run | verification | S | all | `suite-runner`, full tier |

**15 tasks.** The tasks run in this order, one at a time, each delegated to `tdd-task` with an ocr review of its commit, as `implementing.md` describes. T7SP.5 and T7SP.6 can't run in parallel with anything that touches their seams. Only T7SP.8 and T7SP.11 touch what the UI reads, so `browser-auto` picks the full tier for them.

**Size check** (drafting guide): 15 tasks (not over 25); no schema change; three open questions at drafting, all since answered (fewer than five). No split is proposed.

---

## 3. Behavioral tasks

Every case runs **red → green** individually. A case that passes on its first run, or fails for a syntax, configuration, fixture or unrelated reason, is not valid red evidence. It must be fixed and rerun to a genuine red, or flagged as a first-run pass with a mutation check (an assertion or runtime failure, not a compile error). Cases are ordered so each one needs behavior the earlier cases don't.

### T7SP.1 Domain: the expiration rules

Seam: `expiredOn` and `settlementDueOn` in `src/domain/instrument/`, with D7's `XYZ261120C00055000` (expiring Friday 2026-11-20).

```text
describe("expiration rules (P82)")
  it should say the contract has not expired on Thu 11-19 or Fri 11-20, and has expired on Sat 11-21 and Mon 11-23
  it should say Settlement is not due on Thu 11-19, and is due on Fri 11-20, Sat 11-21 and Mon 11-23
```

The first case goes red on the missing export.

### T7SP.3 Trade Analysis: contract status in `derive`

Seam: `TradeAnalysis.derive` with a `valuationDate`, on D7's reference Trades O-C (Long Call, one contract held) and O-S (Cash-Secured Put), and D2's Long Stock reference Trade.

```text
describe("contract status at the valuation date (P81)")
  it should give O-C's contract position the status Live at Thu 11-19
  it should give it DueToday at Fri 11-20, still requiring the contract's Mark and XYZ's
  it should give it PastExpiration at Mon 11-23, requiring neither Mark
  it should give O-S's short contract the same three statuses on the same dates
  it should give no status to a stock position, or to a contract once its quantity is closed
  it should give no status and no requirements when derive has no valuation date
```

The first case goes red on the missing field. The requirement halves of the second and third cases pass today; they stay in the cases as the evidence that requirements now follow the status, with a mutation check (requirements computed from `Live` alone) recorded for the third.

### T7SP.4 Trade Analysis: `evaluate` reads the status

Seam: `TradeAnalysis.evaluate` on states from T7SP.3's cases.

```text
describe("evaluate reads the contract status (P81)")
  it should throw when the frame's trading date differs from the state's valuation date
  it should return the Mark-dependent figures Unavailable(SettlementDue) for a PastExpiration contract and a settlement item Due
  it should return a settlement item Due for a DueToday contract with its Mark-dependent figures valued from its Mark
```

The first case goes red: `evaluate` takes the date from the frame today. The second and third cases pass today (D7's T7.6 cases) and stay green through the switch from the date comparison to the status. Their mutation check flips the status in the state and records the failure.

### T7SP.5 Market Data: the read session

Seam: `MarketData.openReadSession` on `fake-indexeddb` with the request counter (`tests/support/request-counter.ts`), Marks saved through `MarketData.save`. Each case's expected frames are those `ResolveFrames` returns for the same context and Instruments in the same test (A193).

```text
describe("the read session (P78, P79)")
  it should resolve the trading date and close once at open for a Current, a Review and a Historical context
  it should open outside coverage with the as-of exchange date, covered false, and answer every frame with no Mark, as ResolveFrames does today
  it should return each Instrument's frame equal to ResolveFrames' frame for it alone
  it should read a date's observations once when three calls ask for frames on it, for different Instruments
  it should look up an Instrument's Stale context once when two calls ask for its frame
  it should read an earlier date's observations once for every historicalFrames call on that date, and once more for a second date
  it should return each Instrument's gaps as recover does, scanning each Instrument once however many calls ask
  it should give a settlement time for an expiration date from the calendar with no stored read, and the latest session's close for a date that isn't one
  it should give a binding covering every key read, with one snapshot id per date that ResolveFrames with that ExpectedSnapshot answers SnapshotUnchanged
  it should read a Mark saved after the session closed only in a new session
```

The first case goes red on the missing operation.

### T7SP.6 Mark-to-Market Valuation

Seam: the module's call (P77) with a real read session on `fake-indexeddb`, D4's Long Stock fixture (Review Monday 2026-10-12, XYZ marked, DEF Missing) and D7's option fixtures (`tests/integration/d7/support.ts`).

```text
describe("Mark-to-Market Valuation (P77, P78, P80)")
  it should value a Long Stock Trade at the session's date from its Underlying's frame, with D4's figures for XYZ
  it should value DEF with its Mark missing as Unavailable(MarkMissing, DEF, Mon Oct 12), with realized-to-date still a Value
  it should value O-C from its contract's frame, with XYZ's frame paired for condition status and risk to the Stop
  it should value O-C at Mon 11-23 with no read for its contract or XYZ, its figures Unavailable(SettlementDue), and one Due settlement item with Fri 11-20's close
  it should value O-C at Fri 11-20 from its contract's Mark, with a Due settlement item
  it should value a session outside coverage with coverage NotCovered and its figures Unavailable(SessionPolicyNotCovered)
  it should value a Closed Trade at its terminal date with no read, its Mark-dependent figures NotApplicable(NoRemainingPosition)
  it should return a Trade whose facts can't be replayed as Unavailable(FactsIncoherent) with its findings and no read
  it should add the dated line for XYZ at its Stale context's close, as Trade Views does today
  it should add the dated line for O-C at Monday's close, with XYZ's frame at that close (decision 97)
  it should return O-C's and XYZ's gaps when the session recovers
```

The first case goes red on the missing module. Each later case adds a branch the module doesn't have yet. Expected values are those Trade Views' and Daily Review's existing cases assert for the same fixtures.

### T7SP.8 Daily Review values through the module

Seams: `DailyReview.open` and `getTrade` with D7's option fixtures (O-C bought Monday 10-12, clock Tuesday 10-13 17:00 with the call's Monday Mark only), and the new integration proof.

```text
describe("Daily Review through Mark-to-Market Valuation (P83, P84)")
  it should give O-C's Review item a dated line at Monday's close, valued with the call's and XYZ's Monday Marks
  it should give O-C the same dated line in getTrade
  it should keep every existing Daily Review case's expected values
```

`tests/integration/d7sp/review-query-count.test.ts` (P84):

```text
describe("the Review open's requests with option dated lines (P84)")
  it should add one observations read for two option Trades whose dated lines need the same earlier date, and none per Trade
  it should add a second read only for a second distinct earlier date
  it should keep D6's requests exactly for a Review with no option dated line
```

**Amended by decision 104 (revision 74).** The breakdown's draft above assumed that the Review open's items carry the dated line. They don't: only `getTrade`'s card (`DailyTradeReview.datedLastClose`) has it. So the cases are:

```text
describe("Daily Review through Mark-to-Market Valuation (P83, P84)")
  it should give O-C's getTrade card a dated line at Monday's close, valued with the call's and XYZ's Monday Marks
  it should give O-C's card the same dated line as Trade Views' Detail for the same Trade and date
  it should keep every existing Daily Review case's expected values

describe("the Review's requests with option dated lines (P84, decision 104)")
  it should make no request for option Trades' dated lines in the Review open
  it should add at most one observations read for the Trade's dated line in getTrade
  it should keep D6's requests exactly for a Review with no option dated line

describe("the read session shares a date's snapshot (decision 104)")
  it should cost one meta.get per date read, with that date's Stale-context lookups and gaps scans inside it, as recover does
```

The last case goes red on T7SP.5's session and is fixed in this task, so every existing proof keeps its `meta.get` counts. A Daily Review unit case that stubs `marketData.query` is either rewritten at the read session, with a mutation check, or trimmed where a T7SP.6 case covers it. The save's binding check opens its own session and reads only the Review date's frames, without `valueTrade`, so what a save rechecks is unchanged.

The first case goes red on today's missing line. In the same commit, `settlement.test.ts:236` (the T7.24 case that pins the absence, section 1.5) flips: its `datedLastClose` becomes ABC's put at Thursday's close with ABC's Thursday frame, and the task's evidence records the old and new expectation. The structural part (`reviewItem` and `figuresOf` calling the module, `settlementItems` taking times from it, `save`'s binding check opening its own session) keeps every other case green, which the third `describe` case records as the suite run.

---

## 4. Structural tasks

| Task | Verification (exact) | Expected result |
|---|---|---|
| T7SP.2 The entry checks call the rules | `npm run typecheck`, `npx vitest run src/domain src/modules/market-data`, `npm run test:integration -- d7` | `derive.ts:438` and `:455`, `plan.ts:187`, `market-data.ts:408`, `section.ts:50` and `bench-generator.ts:662` call `expiredOn` or its negation. Every case passes unchanged, including D7's `AfterExpiration`, `SettlementTimeInvalid` and `ContractAlreadyExpired` cases. |
| T7SP.7 Trade Views value through the module | `npm run typecheck`, `npx vitest run src/coordinators/trade-views`, `npm run test:integration`; `grep -n 'instrumentsOf\|afterExpiration\|primaryFrameOf\|evaluateCurrent\|closedCurrent\|currentFrames' src/coordinators/trade-views/trade-views.ts` | `browseTrades` and `getTradeDetail` open one read session per call and value each Trade through the module. Every case passes unchanged, including `d7/query-count` and `d7/open-list-query-count` with their exact request lists. The grep prints nothing. **Amended by decision 103 (revision 73):** the due Detail's list in `d7/query-count.test.ts:97` drops exactly its frame reads. Each Trade Views unit case that stubs `marketData.query` is either removed, where a T7SP.6 case covers it, or rewritten at the read session and checked with a mutation. The evidence lists every changed or removed case, with its old and new form or its covering case. |
| T7SP.9 The expiration-comparison lint rule | `npm run lint:deps`; then, in a scratch commit, add `if (date > leg.instrument.expiration) {}` to `src/coordinators/trade-views/trade-views.ts`, run it again, and drop the commit | The first run passes. The planted run fails at that file and line with the rule's message. `daily-review.ts:351`'s sort of two expirations passes. |
| T7SP.10 Fixture views | `npm run verify:fixtures`; `git diff claude-opus-5.5-pre-d7sp -- tests/fixtures` | If v6's Review view holds an option Trade that gains a dated line, `expected-views.json` gains exactly that field, its values from the module, and the task's evidence lists it. Every `dump.json` is byte-identical. If no fixture Trade gains one, nothing changes and the evidence records why. |
| T7SP.11 Browser: the option dated line in the Review | `npx playwright test e2e/d7sp/review-dated-line.spec.ts` | One case: O-C bought Monday, Review Tuesday 17:00 with the call's Monday Mark only. The card shows a "Mon Oct 12 close" group with its figures at 320 and 1280 px, with no sideways scroll. A mutation (the coordinator omits the line for options) makes it fail, then is restored. |
| T7SP.12 Trim the coordinator cases that moved | `npx vitest run src/coordinators`, `npm run test:integration`; the evidence lists each removed case and the T7SP.6 case that covers it | Valuation cases in `option-views.test.ts`, `current-evaluation.test.ts` and `daily-review/settlement.test.ts` that T7SP.6 covers are removed, keeping one case per coordinator for each behaviour (it calls the module and passes its result through). Query-count proofs and integration suites are not trimmed. |
| T7SP.13 Trim D5R2's due-classification cases (P89) | First list every due-classification assertion in `reflections.test.ts` and `debt-status.test.ts` against the `classifyDue` case that covers it, in the evidence. Then `npx vitest run src/domain/journal-debt src/coordinators/daily-review src/coordinators/trade-views`, `npm run test:integration` | Each coordinator suite keeps one case per classification, and Trade Views keeps decision 56's no-frame case. An assertion with no covering `classifyDue` case moves to `classify-due.test.ts` as a new case, which goes red under a mutation of `classifyDue` before it counts. `git diff --stat` touches only test files. Tech debt item 4 is marked resolved by this task. |
| T7SP.14 Latency harness | `npm run bench:run`, results to `evidence/D07SP/bench.md` beside D7's | Every measured step within 10% of `evidence/D07/bench.md`, or the gate stops for the user's decision (O3). The harness's row comparisons pass. |
| T7SP.15 Gate run | `full-suite.sh evidence/D07SP t7sp-15-full` (full tier), by `suite-runner` | Unit, integration and browser suites pass, with every static and verify check. Counts and wall times recorded in `evidence/D07SP/structural.md`. |

---

## 5. Gate

The prefactor is complete when all of the following hold. Then the Progress section is updated and everything is committed locally.
- T7SP.1 to T7SP.14 are committed, with each commit's ocr findings resolved.
- T7SP.15's full-tier run passes.
- `git diff claude-opus-5.5-pre-d7sp -- src/persistence` is empty, and every `dump.json` is unchanged.
- `npx eslint` with the new rule reports nothing outside `src/domain/instrument/`.
- The tag `claude-opus-5.5-d7sp` is made on the final commit.

**Then:** check D8's breakdown for references to code this prefactor removed or moved (`coordinators/valuation.ts`, `settlementTimeOf`, the deleted Trade Views functions), and draft D7S's breakdown from `claude-opus-5.5-d7sp`.

---

## 6. Tests

### 6.1 Unit and integration cases that stay unchanged

Through T7SP.2 to T7SP.8, every existing case keeps its expected values and shapes. A case that fails is a defect to investigate, not an expectation to change. The exceptions are `settlement.test.ts:236`'s flipped expectation (T7SP.8, P83), T7SP.10's fixture field (P83), T7SP.12's removals (P85) and T7SP.13's (P89), each listed in its task's evidence. Decision 103 (revision 73) adds T7SP.7's: the due Detail's request list in `d7/query-count.test.ts:97`, and the Trade Views unit cases that stub `marketData.query`, each removed or rewritten at the read session. Decision 104 (revision 74) extends that to Daily Review's unit cases that stub `marketData.query`, starting with `settlement.test.ts:253`.

### 6.2 New integration and browser files

| File | Task | Holds |
|---|---|---|
| `tests/integration/d7sp/review-query-count.test.ts` | T7SP.8 | P84's proof, retargeted by decision 104 |
| `e2e/d7sp/review-dated-line.spec.ts` | T7SP.11 | P83 in the browser |

### 6.3 Disclosed test substitutes

The D1–D7 substitutes still apply (`fake-indexeddb`, `NodeTestHost`, the request counter, fixed clock and identities, Chromium as the routine engine).

---

## 7. Acceptance

No new row, and no row changes status. These are re-proven by the cumulative run:
- **AC-PERF-001:** every query-count proof passes unchanged, and P84's proof adds the Review's dated-line rule.
- **AC-CALC-002:** valid figures stay Values beside a missing Mark (T7SP.6's second case, I7.15).
- **AC-REV-002 and AC-REV-006:** the Review's order and completion are unchanged.

---

## 8. Amendments to other plan documents (decisions 101 and 102, revision 72)

Applied by plan revision 72, before T7SP.1, except the two rows marked as later. Each is a dated note at the place it changes.

| Document | Where | Amendment |
|---|---|---|
| `implementation-plan.md` | Tech debt, item 4 | Now: to be cleared by the D7S prefactor's T7SP.13 (P89). Later: marked resolved when that task commits. |
| `implementation-plan.md` | Decisions table | Decision 101: this breakdown, P77–P89, run after D7 and before D7S's breakdown. Decision 102: the Review open may make one read per distinct earlier close date that its option Trades' dated lines need, none per Trade (P84). |
| `implementation-plan.md` | Plan record | Revision 72, tag `claude-opus-5.5-plan-r72`; 33 ordered deliverables (the count was 31 after revision 54 added D7S, and is corrected here). |
| `implementation-plan.md` | Deliverable summary and definitions | A row "D7S prefactor — One Mark-to-Market Valuation (decision 101), 0 (refactor)" before D7S, and a short definition section. |
| `revisions.md` | Top | The revision entry. |
| `specs/design/market-data.md` | Contract and Query contract | `openReadSession(context)` and its paragraph (section 1.3, O1). |
| `specs/design/trade-analysis.md` | `derive` | One sentence: at a valuation date, `derive` gives each option position's contract status, and its observation requirements follow it. |
| `D07-single-leg-options-happy-path.md` | T7.6's note on the dated last-close line | The Review shows it for options from the D7S prefactor (P83), reversing the T7.30-B3 note in `evidence/D07/structural.md` that kept it Stock-only. |
| `D08-backup-and-restore.md` | Later, after the gate | Only if the check in section 5 finds a stale reference. |

---

## 9. Answers recorded from the user, 2026-11-08 to 2026-11-10

From the architecture review of D7's commits:
1. **Scope:** candidate 1 (one valuation for both coordinators) with candidate 6 (the expiration rules) folded in; candidate 2 (Trade Detail as a finished read) is not in this prefactor.
2. **Q1:** settle the date before reading Marks, everywhere.
3. **Q2:** the valuation module reads Market Data itself.
4. **Q3:** the option dated line is shown the same way in both screens.
5. **Q4:** one Trade per call.
6. **Q5:** a Market Data read session per operation, the same in tests and production. The user's point: IndexedDB is already the Mark cache in front of the Pricing Provider, so no second cache belongs in production only.
7. **Q6:** the session hands over the binding; the module never touches it.
8. **Q7:** the session serves gap lookups.
9. **Q8:** the module handles the cases that read nothing.
10. **Q9:** one status with three values.
11. **Q10:** the session owns the valuation date.
12. **Q11:** dated-line reads go through the session.
13. **Q12:** the Review proof follows decision 97's rule.
14. **Q13:** moved cases stay through the refactor, then are trimmed in its last task.
15. **Q14:** the refactor runs next, as its own deliverable, so later breakdowns are written against it.
16. **Q15:** the name is Mark-to-Market Valuation.

On the draft, 2026-11-10:

17. **O1:** amend `market-data.md` to add the read session.
18. **O2:** no browser critic.
19. **O3:** run the latency harness once.
20. **Added task:** clear tech debt item 4 (D5R2's due-classification cases) after T7SP.12 and before the latency harness (P89, T7SP.13).

During T7SP.7, 2026-11-10 (decision 103, revision 73):

21. **The due Detail makes fewer reads:** an expired contract's Detail reads no frame, and `d7/query-count.test.ts:97`'s list drops those reads.
22. **Stub cases:** rewrite each case that stubs `marketData.query` at the read session, with a mutation check, and trim now the ones the module's suite already covers.

During T7SP.8, 2026-11-10 (decision 104, revision 74):

23. **`meta.get`:** fix the session, so Stale-context lookups and gaps scans share their date's snapshot and the proofs keep their counts.
24. **Daily Review stub cases:** rewrite them at the read session, as decision 103 did for Trade Views.
25. **The dated line:** compute it on `getTrade`'s card only. The Review open makes no dated-line read, and P84's proof is retargeted to match.

---

## 10. Progress

| Task | Status | Commits |
|---|---|---|
| T7SP.1 | Done | `0cc181aa` |
| T7SP.2 | Done | `e6ac2f5f` |
| T7SP.3 | Done | `e14f0cc8` |
| T7SP.4 | Done | `07449b9d` |
| T7SP.5 | Done | `5438bfb7`; B1 `40442940`; B2 `f0316f62`; B3 `5921ea19`; B4 `3998e749` |
| T7SP.6 | Done | `23edc84b`; B1 `b5398b91` |
| T7SP.7 | Done | `4f95ab6c` (under decision 103, revision 73 `5c836aee`); B1 `f9fea5ef` |
| T7SP.8 | In progress from `f9fea5ef` | |
| T7SP.9 | Not started | |
| T7SP.10 | Not started | |
| T7SP.11 | Not started | |
| T7SP.12 | Not started | |
| T7SP.13 | Not started | |
| T7SP.14 | Not started | |
| T7SP.15 | Not started | |
