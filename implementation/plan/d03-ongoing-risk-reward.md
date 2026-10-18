# D3 — Ongoing Stock risk/reward: detailed task breakdown

Status: planning draft; no implementation authorization or completed evidence. Provisional under the [trader-approved per-deliverable planning approach, 2026-10-17](../delivery-plan.md#accepted-planning-approach--2026-10-17); review before this deliverable is implemented.
Authority: [D3 in the delivery plan](../delivery-plan.md#3-value-the-open-position-and-see-ongoing-riskreward), [Market Data](../../specs/design/market-data.md), [Trade Analysis](../../specs/design/trade-analysis.md), and [D1 shared mechanisms/evidence](d01-long-stock-plan.md). Prerequisite: completed D2 release. Proposed test seams require plan review before execution.

## Outcome, stories and boundaries

Production flow: Open list/Trade Detail → Missing Mark task → save initial Manual Mark for exact Stock/session, or acknowledge unavailable with reason → show dated valuation, independently available risk/reward and coverage. A later initial exact Mark resolves acknowledgment while retaining its history.

- As a trader, I would like to enter a dated price and see ongoing risk and reward, so that I can judge my remaining exposure against the frozen plan.
- As a trader, I would like to acknowledge a price I cannot obtain, so that I can distinguish missing evidence from an actual value without fabricating a number.

Fixed original underlying-price Stop/Target on one-Instrument Long Stock. No provider selection/configuration/retrieval, Bar storage, new management conditions, Mark override/correction/withdrawal, replay UI, Daily Review or reports. Existing effective Mark keys cannot be edited; D18 adds correction/withdrawal with bound impact preview. Store continuous Stop observation evidence now; reads do not save Deviation occurrences. D4 owns their narrow reconciliation. Preserve the accepted D6 backup/D17 Restore timing exception.

## Time, observations and durable changes

Market Data owns the versioned exchange-session policy; Trade Analysis receives resolved dates/evidence and never asks a clock/calendar. Inputs distinguish UTC Economic Time/Save Time, exchange session date/close in America/New_York, and Workspace rules-based display time zone. Resolve LatestCompleted by exact close instant, including early close and DST. Calendar weekends, holidays, future/uncompleted sessions and out-of-coverage dates cannot be guessed into exact evidence. Calendar coverage 2021–2028 and explicit limit handling were accepted by the trader on 2026-10-11 and are recorded with primary provenance in D1; D3 introduces the actual session resolver and records its policy revision in each frame binding. Outside verified coverage return a typed date/evidence problem and actionable explanation, never a made-up session. Do not restrict off-session Economic Time for Trade facts merely because valuation uses completed sessions.

Version D3 adds immutable Manual Mark and acknowledgment histories with stable identities, exact Instrument/session key, source, observation instant, save instant, intention classification, effective head/revision and session-policy metadata. It adds no provider/Bar facts. Initial Mark price is finite and nonnegative; zero is valid supplied evidence, never a fallback. Reject unknown/incoherent Instrument, invalid session, missing acknowledgment reason, or stale resolution revision. Missing is an observed absence bound in `MarketDataSnapshotId`, not a durable placeholder. Acknowledgment cannot be asserted over an existing exact Mark. A new Mark wins effective status but leaves acknowledgment history reachable.

Index exact Instrument+date/effective head and nearest earlier date, not a scan of all Trades. Shared exact Stock Marks apply across Trades. Candidate migration uses the D1 generation policy; validate all D1/D2 histories and the introduced source/kind policy before activation. Private coverage/valuation projections bind Trade FactRevision, Market snapshot and analysis/session policy; any Mark/head change invalidates dependent results. Rebuild from facts; no valuation number becomes authority.

For each observation save, transaction participants are observation versions/effective resolution, private invalidation and Workspace content revision. Check active generation, readiness epoch, exact resolution including absence, session policy and expected revisions at commit. Return complete accepted resolution/intention/identities/revision. No mandatory query follows success. A user opening affected Trade Detail is an independent read.

## Explicit task completion edges

These are blocking edges for task completion. UI work may start after the contract-fixing task, as described under parallelism, but cannot finish before its real domain/persistence prerequisites. Review/freeze prerequisites remain external to this implementation graph.

| Task | Required predecessor tasks |
|---|---|
| D3-T01 | D2-T07 |
| D3-T02 | D3-T01 |
| D3-T03 | D3-T01, D3-T02 |
| D3-T04 | D3-T01 |
| D3-T05 | D3-T02, D3-T03, D3-T04 |
| D3-T06 | D3-T03, D3-T05 |
| D3-T07 | D3-T01, D3-T02, D3-T03, D3-T04, D3-T05, D3-T06 |

## Ordered tasks and concrete cases

Every behavior case requires one valid Red → minimal Green → next-case execution record under D1; no case is implemented during this planning work.

### D3-T01 — Bind session/evidence contracts and migrate installed state (structural)

Blocked by D2-T07. Owner: schema/calendar/release coordinator. Specify supported dates and provenance manifest, initial-Mark/acknowledgment command variants, frame absences and shared Market snapshot bindings; migration D2→D3 adds only installed kinds/indexes.

Verification: eventual typecheck/build, validate bundled calendar rows/digests against primary session sources, migrate command-populated D2 Workspace and compare unchanged histories, run D3-I03 migration failure/rebuild procedure. Do not advertise a provider or future Mark edit. Inputs/typed errors and exact release inventory are fixed before parallel tasks.

### D3-T02 — Resolve exact completed-session evidence

Blocked by D3-T01. Owner: Market Data; seams `query(ResolveFrames/InspectObservations)` and unconfigured `recover` used later by D4.

`describe("completed-session Mark frames")`

- it should resolve noon Tuesday 2026-10-06 in New York to completed Monday 2026-10-05, with Monday exact Mark Available rather than Stale.
- it should return Monday Missing plus Friday 2026-10-02 price as explicitly Stale context when Monday has no Mark, binding that material absence.
- it should resolve the Friday after Thanksgiving 2026-11-27 only after its 13:00 New York close, and skip weekend/holiday sessions without relying on the Workspace display zone.
- it should resolve normal close correctly on dates either side of DST, preserving New York 16:00 with the correct UTC instant.
- it should reject an ExactCompleted future/uncompleted or non-session date, and identify a calendar coverage limit instead of treating it as Missing price for an invented session.
- it should return unchanged/changed evidence using the same normalized ExpectedSnapshot request when a Mark or acknowledgment appears after an absence-bound frame.
- it should return NotConfigured context and Missing Manual tasks from unconfigured recovery with no observation or Journal write.

### D3-T03 — Save initial Manual Mark and acknowledgment history

Blocked by D3-T01/D3-T02. Owner: Market Data/Transaction; seam `save` with complete resolution response.

`describe("initial exact Stock observations")`

- it should save price 55 for an empty Stock/date key, retain Manual source/time/intention and return the exact Available resolution later retrievable after restart.
- it should save an explicit unavailable reason for a Missing key without inventing a price, keep older Stale context distinct, and reject a blank reason.
- it should accept a later initial Manual Mark over acknowledged absence, resolve Available and retain acknowledgment history.
- it should reject an acknowledgment over an exact Mark, repeat initial Mark on an occupied key, stale resolution/absence revision or invalid finite-price/date input without modifying history.
- it should accept an explicitly supplied zero price and distinguish it from acknowledgment/Missing.
- it should return RuntimeNotWritable or rollback on storage abort with no observation/head/Workspace revision change and no Journal evidence.

### D3-T04 — Evaluate remaining Long Stock without fallback values

Blocked by D3-T01; consumes explicit typed frames from D3-T02. Owner: Trade Analysis; seam `evaluate` (and pure replay only for internal episode evidence, no replay UI).

Use D2 fixture: 100 shares, gross basis 5,020, opening fee 3, frozen intended entry 50, Stop 45, Target 60, 1R 500.

`describe("exact dated Long Stock valuation and risk")`

- it should return remaining-open net P&L 477 at Mark 55, realized-to-date zero, incurred fees 3 and current total 477, without subtracting fees again.
- it should return risk to Stop 1,000, incremental reward 500, Plan-R distances 2R/1R, worst-case ongoing risk 5,500 at nonnegative underlying zero, and maximum incremental reward Unbounded Above, independent of entry basis.
- it should return risk-to-stop zero and Stop Overrun 100/0.2R at Mark 44 while retaining the Open Position and a first-observed breach; no sell Execution is inferred.
- it should return reward-to-target zero and Target Overrun 100/0.2R at Mark 61, without treating Target Reached as Deviation.
- it should make marked totals and dependent risk/reward Unavailable with exact Instrument/date when Missing or Acknowledged Unavailable, preserve valid realized/fee/Plan values and never substitute Friday, fill cost or zero.
- it should preserve one continuous Stop episode across breached exact observations and an intervening gap; an exact unbreached observation ends it, and a later breach starts another fingerprint. A gap is no proof of recovery or a fabricated crossing date.
- it should retain per-condition basis/availability and never change frozen Plan Baseline or Entry Quality when Marks change.

### D3-T05 — Assemble bounded Open list/detail and observation tasks

Blocked by D3-T02/D3-T04; saved-history integration blocked by D3-T03. Owner: Trade Views and Reporting; seams `browseTrades/getTradeDetail`.

`describe("coherent marked Open Stock views")`

- it should derive/evaluate only a bounded AnalysisInput page selected through authoritative Open lifecycle, reuse shared exact Stock frames, and return date/source/coverage with each independently available figure.
- it should preserve Ready with missing calculations and Stale context rather than Error/Empty or a fake current price.
- it should return ChangedDuringAssembly after bounded retries when Market evidence or Trade revisions change, never a hybrid view.
- it should never write a deterministic Deviation, repair lifecycle or persist a calculation while reading a breached Stop; private rebuild remains a separate authorized startup operation.

### D3-T06 — Deliver Mark/acknowledgment and risk UI

Blocked by D3-T01 for contracts; joins T03/T05 before acceptance. Owner: UI/shell integration.

`describe("dated Mark and independent calculation UI")`

- it should show exact expected date, Stock, source and optional Stale context, then retain entered reason/price and focus errors for stale/invalid saves.
- it should render saved resolution from the Save response directly, while independently opening a Trade view performs its normal read.
- it should render Value, Unbounded, Unavailable and Not Applicable distinctly, with signed units and text explaining gaps; no future provider/correction selector appears.
- it should preserve route, record, filters, fields and validation across live narrow/wide resize; keyboard names, focus and non-color status are complete.

### D3-T07 — Cumulative integration and fresh browser gate (structural)

Blocked by D3-T01–D3-T06. Release owner extends capability and asset inventory only for complete installed observation/evaluation variants. Run cumulative suites, the cases/flows below, D1 shared readiness/update/recovery matrix for Market.save and D3 compatible migration. Fresh critic starts its own strict-port built runtime and reports B01–B04. Each defect gets failing regression first, minimal fix, cumulative rerun and a new critic repeating every flow. Ambiguity pauses; unavailable critic/runtime/browser blocks completion.

## Mock-free integration and durable evidence

Only disclosed fake-indexeddb may replace storage in fast integration; real application modules, decimal.js, session-policy data and transactions remain. Deterministic clock inputs are contractual inputs. A browser-owned IndexedDB run with real service worker/cache/capacity checks is mandatory; never use fake infrastructure to certify readiness.

| Case | Reproducible planned procedure / expected proof |
|---|---|
| D3-I01 | Create D1/D2 fixtures with real commands; resolve Missing, acknowledge, reopen, save later initial Mark, reopen again. Compare resolution/history identities to returned revisions; inspect independent valuation/fee/risk values and unchanged Journal facts. |
| D3-I02 | Two browser tabs save the same previously absent Instrument/date. One succeeds, other conflicts; expected-absence recheck prevents duplicate effective heads. Induce storage abort and runtime failure before save; no changed authoritative histories/binding. |
| D3-I03 | D2→D3 candidate success/failure/crash/retry, preserving prior facts on failure. Delete only private coverage/evaluation projections; reconstruct and compare list/detail/frames under fixed clock. Index traces show no per-Trade storage load or all-history replay. |
| D3-I04 | Command-create two Trades sharing Stock/date and a second Stock with Missing evidence. Exact Mark is shared once; missing Trade shows no made-up result. Breach/read/reopen produces no stored Deviation; D4 later saves it through the authorized reconciliation route. |

## Planned production browser flows

- **D3-B01:** Missing Mark task → initial Manual Mark → exact dated Open-list/detail risk figures; stop browser and reopen offline with all installed manual paths usable.
- **D3-B02:** Older price only → Stale context and Unavailable results → explicit acknowledgment → later exact Mark, with acknowledgment history retained. Cancel entered price and confirm nonmutation after restart.
- **D3-B03:** Breach Stop and exceed Target using separate dates/fixtures; show zero distances/positive overruns without economic fact change. Race another tab's initial Mark; recovery/unsupported write gate preserves input and old facts.
- **D3-B04:** B01/B02 keyboard-only at 390/1440 px, live resize around 768 px and 200% zoom; verify labels/date/unit help, warning, Loading/Empty/Error and all calculation states. axe plus manual contrast/focus/screen-reader tree checks; uninstalled payoff/replay/provider controls absent.

## Acceptance mapping

Status of every row: **planned**, with D1 common commands/provenance/no-write comparison applied. Scope labels follow the authoritative delivery plan.

| Scenario | Scope / later full assignment | Tasks; evidence |
|---|---|---|
| AC-MARK-001 | Full: latest completed session, exact/Stale distinction | T02/T05/T06; I01; B01/B02 |
| AC-MARK-003 | Full: explicit acknowledgment is not price; later exact Mark retains history (Manual path installed) | T02/T03/T04; I01; B02 |
| AC-MARK-002 | Partial: initial Manual identity/history retained. Provider/Bar precedence full D7; deliberate edit UI D18 | T03; I01/I02; B01 |
| AC-CALC-001 | Partial: frozen 1R/Entry Quality while current Marks change. Full management fixture D16 | T04/T05; I01; B03 |
| AC-CALC-002 | Partial: single-Instrument independent availability; D8 multi-Instrument, D11 partial realization/full | T04/T05; I01/I04; B02 |
| AC-CALC-003 | Partial: fixed Stock underlying conditions/overruns; D8 fixed OR variants, D16 management | T04/T06; I01; B03 |
| AC-RESP-001 | Partial globally; complete for every installed Market mutator; bounded multi-Trade full D15 | T03/T06; I01/I02; B01/B02 traces |
| AC-DEL-001–004, AC-CAP-001, AC-UI-001 | Full for installed release under accepted backup/Restore timing | T01/T03/T06/T07; I01–I04; B01–B04; D1 repeated readiness/update evidence |
| AC-DEL-005–006 | Partial: readonly Market/history and gated writes; D6 backup, Restore/full D17 | T03/T07; I02/I03; B03 |
| AC-REST-004 | Partial: installed candidate migration/rollback; full artifact/Restore D17 | T01/T07; I03; B03 |
| AC-UI-002 | Partial globally, complete installed numeric/evidence screens; D14 graph gaps, full Restore D17 | T06/T07; B04 |
| AC-REBUILD-001, AC-PERF-001 | Partial: installed projections and target-sized Stock Mark workload; full mixed fixture D28 | T01/T05/T07; I03/I04; D1 timing procedure and semantic comparisons |

Remaining canonical scenarios are intentionally unadvertised as listed in D1. Stock-only Expiration Payoff, if requested as an already-installed calculation in a later release, is Not Applicable; D3 does not advertise the operation simply to show a placeholder.

## Ownership and parallel edges

T02 session/frame logic and T04 pure evaluation may proceed after T01 fixes values; T03 waits for T02, T05 joins T02/T04/T03. T06 can develop semantic forms once types are fixed, but requires real-stack integration to finish. T07 waits for all. Single owners serialize market schema/indexes/evidence revisions, shared evaluate/replay episode semantics, numeric policy, readiness/transactions and shell/release manifests. No cross-deliverable concurrency authorization.
