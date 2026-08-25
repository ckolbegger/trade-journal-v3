# PlanCommitCoordinator — initial interface design

The coordinator that owns the **start of every Trade and its pre-fill exit**:
validate the committed Plan's R:R geometry, write Trade+Plan to
TradingRecordStore, and owe the required pre-entry reflection placeholder in
ReflectionStore — one call, one cross-store transaction — and, symmetrically,
retire a never-entered plan and void its owed placeholder. It is OQ 9's
recorded home for the transaction pattern (`commit` + `createPlaceholder`,
`discardTrade` + `voidPlaceholder` — each pair in one
`StorageBinding.transaction`).
It also owns the **validation charter** ADR 0010 assigned it: the block/teach
lines over calc's planned figures, including the in-tent stop teaching (whose
computation basis for option structures is deferred to the options release —
decided semantics 6, OQ 18).

It deliberately owns **no facts, no figure math, no placeholder concept**: it
stores nothing (rule 1), computes nothing itself (`calc.evaluate` derives the
figures the charter reads), and creates placeholders only by calling
ReflectionStore. The narrowest join of the four coordinators — two stores +
calc + the storage seam, **no PriceMarkStore** (planned figures are mark-free,
calc semantic 13, and there are no fills whose marks to build).

Two operations over constructor-injected dependencies:

```ts
/** Commit a Trade's Plan: validate the plan's R:R geometry, write Trade+Plan,
 *  owe the required pre-entry reflection — one call, one transaction. The
 *  trader's single entry point for "I commit to this plan." */
commitPlan(input: TradeInput): CommitPlanResult

/** Retire a committed-but-never-filled Plan and void its owed pre-entry
 *  placeholder — one transaction. The pre-fill exit: the honest escape from
 *  a doomed plan (a typo'd commit, a setup that never came) besides a
 *  revision that would freeze the wrong R baseline (audit finding F1). */
discardPlan(tradeId: TradeId, at: Date): void
```

---

## Interface

### Operations

```ts
commitPlan(input: TradeInput): CommitPlanResult

discardPlan(tradeId: TradeId, at: Date): void
```

### Dependencies (constructor-injected)

```ts
tradingRecord: TradingRecordStore   // commit (Trade + Plan, mints tradeId)
reflection:    ReflectionStore      // createPlaceholder (pre-entry bookend);
                                    //   listEntries + voidPlaceholder (discard)
calc:          CalculationModule    // evaluate (planned figures → the validation charter)
storage:       StorageBinding       // transaction(...) — the cross-store write (OQ 9)
```

### Types

```ts
/** Types consumed are canonical elsewhere: TradeInput
 *  (trading-record-store.md); FigureSet, Dual (calculation-module.md). Only
 *  the coordinator's own returns are defined here. */

type CommitPlanResult = {
  tradeId:  TradeId          // store-assigned; anchors everything downstream
  figures:  FigureSet        // the plan-time figure-set — planned risk/reward/R:R for
                             //   the plan-time payoff visualization (CONTEXT.md),
                             //   computed in hand for validation; no re-read needed
  warnings: PlanWarning[]    // teaching moments — well-formed but pedagogically
                             //   notable. MVP: always [] (a stock plan cannot fire
                             //   one); the shape is full-target (releases implement
                             //   operation subsets)
}

type PlanWarning = {
  code:    'stop-reads-profit'        // a declared non-worst side reading as a PROFIT —
                                       //   ADR 0010's "inside the profit tent" teaching
  side:    'downside' | 'upside'      // which declared side fired it
  reading: Dual                       // the honest signed reading (ratio + dollars)
}
```

---

## Decided semantics

Each ruling cites the principle or ADR it derives from. Veto any during review.

1. **Two operations: `commitPlan(input: TradeInput)` + `discardPlan(tradeId,
   at)`.** The overview estimated one; the audit forced the second (finding
   F1, the doomed-plan exit — decided semantics 13) — the same honest growth
   as FillEntry 1→3 and TradingRecordStore 6→7. Still the fewest ops of the
   four coordinators. `commitPlan`'s input is `TradeInput` **verbatim** (the
   canonical type from trading-record-store.md); the overview's `PlanInput`
   sketch collapses into it — one canonical type, no coordinator-added
   fields. *(Data-contract principle; depth.)*

2. **Validation is coordinator policy over calc's honest figures — no new
   calc op, nothing UI-side.** One `evaluate(sketch)` call returns the
   FigureSet; the charter reads its signs. Which findings block vs teach is
   *product judgment* (calc holds no product policy — the monolith bet stays
   figure-only), and it must live at the gate (a second UI, an API caller, or
   a script bypassing UI-side checks would write invalid plans — validation
   is structural only if the committing op owns it). See *Alternatives
   considered*. *(Rule 1; ADR 0010 — "the check belongs to PlanCommit
   validation, which owns planned-R:R validation anyway.")*

3. **The charter — what blocks, what teaches.** All checks derive from one
   `FigureSet` (pre-fill, the planned fields are exactly what's computable —
   calc semantic 13):

   **Blocks (throw; nothing written):**
   - **No declared stop side** (`stops: {}`) — no R baseline exists; every
     R-metric (`rMultiple`, expectancy, the R distribution) divides by
     planned risk.
   - **A misplaced stop side** — a downside stop at/above entry, an upside
     stop at/below entry. At commit (pre-entry) these are structurally
     nonsensical: the stop would trigger at or immediately after entry, or
     reads as a profit-take rather than a loss bound (a short declaring a
     downside-only stop — its real risk is upside). In-trade trailing stops
     arrive via revisions, never via the initial plan. A stop *at* the entry
     is the $0-planned-risk case (CONTEXT: Breakeven — "a stop placed at a
     breakeven yields $0 planned risk"; `rr` is undefined).
   - **A target that is not a profit exit** — with exactly one stop side
     declared, the target must sit on the opposite side of entry (the
     one-sided risk declares the trade's direction; profit is the other
     way); with both sides declared (a neutral structure), the target must
     merely differ from entry. `reward.planned` ≤ 0 otherwise.

   **Teaches (`warnings` — non-blocking):**
   - **`stop-reads-profit`** — a declared non-worst side whose honest reading
     is a *profit*: ADR 0010's "your downside stop reads +$200 — it's inside
     your profit tent." The sign test is `plannedByDirection[side]` reading
     positive while the worst side is a loss. Dormant in the MVP — a stock
     plan's linear readings cannot fire it; it activates when curve-based
     planned readings do (decided semantics 6). The code union grows as
     teachings do (the `InstrumentType`/`SchemaField.kind` precedent — shape
     stable, values grow).

   The checks are **direction-agnostic by construction**: no long/short
   input exists anywhere — the declared side (downside vs upside) plus the
   sign of the entry-relative reading carries the direction, the same way
   ADR 0009's curve shape carries bias without a strategy input. Option-
   position levels self-certify credit vs debit through the same placement
   rules (the stop-vs-target roles must sit on opposite sides of entry;
   ADR 0010's role-supplies-direction convention).

4. **The sketch record is a literal the coordinator builds from the input:**
   `{ tradeId: '', accountId, underlying, strategy, status: 'Planned', plan,
   revisions: [], fills: [] }`; `marks` = an empty `Map` (planned figures are
   mark-free — calc semantic 13); `asOf = plan.committedAt`. The empty
   `tradeId` is inert (calc ignores it; the store assigns the real one).
   Deterministic — no clock, no store reads before validation.
   *(Testability; TradingRecordStore semantic 7's no-clock pattern.)*

5. **Validate before any write.** A blocked plan persists nothing — no Trade,
   no placeholder, no orphaned id. Validation failures throw (the codebase
   convention — errors throw; returns carry outcomes, not failures);
   `warnings` describes *legitimate* teaching findings, never error states.
   *(FillEntryCoordinator semantic 13.)*

6. **The pre-fill computation basis for option structures is deferred to the
   options release (OQ 18) — the session's one owner question, adopted as
   the recommended default; veto reopens it.** The in-tent teaching needs the
   planned structure (strikes locate the tent), and the `Plan` type carries
   only exit levels + a net entry price — pre-fill, the reading is
   incomputable for multi-leg option structures, and linear arithmetic is
   not even wrong there (it would mix an underlying-quoted stop against an
   option-position entry: credit $2.30 vs underlying $150 ⇒ −$147.70/unit).
   The **charter and the warning shape are pinned now**; the MVP's validation
   is correct for everything exercisable — stock plans (linear arithmetic;
   the MVP is stock-only by charter) and option-position levels
   (entry-price arithmetic, ADR 0010 — always computable from prices). The
   options-release drill-down — which already owns the payoff-curve
   companion semantics (calc open items: multi-expiry anchoring, cost-basis
   accounting) — decides **legs on Plan** (additive `legs?: PlannedLeg[]`;
   no seam reshape) vs **teach at first fill** (baseline moves once —
   ADR 0005 freeze cost). Whichever lands, the sign-based charter is
   unchanged: only the reading the signs test becomes curve-derived.
   *(Overview — "shapes are stable; releases implement operation subsets";
   ADR 0010's charter assignment honored as shape-now/compute-later.)*

7. **The cross-store transaction — OQ 9's recorded home.**
   `storage.transaction(() => { tradingRecord.commit(input) → tradeId;
   reflection.createPlaceholder({ level:'trade', type:'pre-entry', tradeId,
   required:true, createdAt: input.plan.committedAt }) })`. Commit first (it
   mints the `tradeId` the placeholder references); placeholder second. A
   torn pair is a Planned trade missing its *required* pre-entry placeholder
   — the trader is never prompted, the exact bookend break OQ 9's
   accept-torn-write rejection named. The same primitive, same pattern, as
   FillEntryCoordinator's two transactional sequences — one mechanism
   system-wide. *(OQ 9; rule 8 — only a coordinator can own a cross-store
   write.)*

8. **`figures` + `warnings` ride the return.** The figures were computed in
   hand for validation; riding them lets the plan-time payoff visualization
   (CONTEXT.md) render without re-deriving a sketch evaluate. No snapshot is
   stored for a Planned trade (`finalFigures` is present iff Closed — ADR
   0007); the return is the only materialization, and the UI re-derives on
   demand thereafter via its own calc call (decided semantics 9). *(The
   `closedFigures` precedent — FillEntryCoordinator semantic 14: one call,
   everything the moment needs.)*

9. **No pre-commit preview op.** The trader sees the plan-time payoff *before*
   committing by the UI calling `calc.evaluate` on its own sketch directly —
   the who-calls-whom matrix already sanctions the UI→calc read edge; the
   preview is a pure read of the caller's own data, single-module (rule 8).
   A coordinator preview op would be a pass-through the deletion test
   rejects. *(Rule 8; overview who-calls-whom.)*

10. **Timestamps are event-derived; the coordinator has no clock.** The
    placeholder's `createdAt` = `plan.committedAt` — the triggering event's
    own time. `committedAt` itself is caller-provided (TradingRecordStore
    semantic 7). Deterministic and test-friendly. *(FillEntryCoordinator
    semantic 12's pattern, applied here.)*

11. **No referential validation of `accountId`/`strategy`** (convention C6 —
    provider of record, not validator). The coordinator passes them through;
    the stores accept them as given. *(ReflectionStore semantic 11; rule 1.)*

12. **Errors throw; `CommitPlanResult` carries outcomes, not failures.**
    Unknown-account/strategy are not errors (C6); validation blocks are.
    `warnings` is a legitimate-findings list, never an error channel.
    *(Codebase convention.)*

13. **`discardPlan` — the pre-fill exit (audit finding F1, designed at the
    owner's call).** For a committed-but-never-filled Plan: a typo'd commit
    or a setup that never came. Without it, every escape is worse — no amend
    op exists (the Plan freezes at commit, ADR 0005), a typo-fix *revision*
    freezes the wrong R baseline forever and pollutes `revisionCount` before
    the trade ever opened, and an abandoned idea lingers as a dead Planned
    trade with a REQUIRED placeholder owed forever. The design:

    - **Store guard:** `tradingRecord.discardTrade(tradeId)` asserts
      `status = 'Planned' ∧ fills = []` — the degenerate fill arithmetic
      (zero fills), so the guarded-family invariant survives: every status
      mutation remains fill-arithmetic-guarded, and discard is the **one
      trader-declared transition** in the system. Contrast the close rule:
      close is fill-computable (no trader-declared close exists, CONTEXT);
      a never-entered trade has no fill arithmetic to compute — its guard
      *is* the absence of fills.
    - **A status, not a delete:** `Discarded` is terminal and snapshotless
      (no `closedAt`, no `finalFigures`). The forward-only grain holds — no
      delete op exists in any store; a trader may have journaled against a
      plan they were watching (convention C6 tolerates import *ordering*,
      not permanent orphaning); and the story survives: the Plan and any
      *completed* pre-entry reflection are retained.
    - **Void the owed placeholder, not the content:**
      `reflection.voidPlaceholder(entryId, at)` transitions the owed
      pre-entry placeholder to `'void'` — no longer owed, never written.
      Completed entries are untouched (immutable, ReflectionStore semantic
      7). The coordinator finds them via
      `listEntries({tradeId, type:'pre-entry', state:'placeholder'})` (a
      read outside the transaction) and voids each — defensive over exactly
      one.
    - **One transaction, mirroring the commit pair:**
      `storage.transaction(() => { discardTrade; voidPlaceholder(…) })`. The
      torn pair is the finding's exact pain: a discarded trade whose
      placeholder still nags forever.
    - **`at: Date` is caller-provided** — the discard *is* the event, and
      the coordinator has no clock (semantic 10's pattern; the UI passes
      now, tests pass literals).
    - **Errors throw with guidance:** a filled trade rejects ("the trade
      has fills — corrections own that world"); unknown id rejects. Return
      is `void` — no legitimate branches to report; the UI re-queries
      (rule 6).

    Typo resolution is discard + re-`commitPlan` under a fresh `tradeId`:
    nothing references the old one once its placeholder is voided — no
    fills, no snapshot, no journal content (completed entries keep their
    reference; C6 tolerates it as a retained trade, not an orphan).
    Pre-fill `appendRevision` stays legal (the store rejects Closed only)
    but is the wrong tool — append-only history records the churn and the
    freeze stays at the typo; `discardPlan` is the honest exit.
    *(Audit finding F1; ADR 0005/0006's guarded family; CONTEXT: Journal
    Placeholder.)*

---

## Worked examples

### Plan-commit — AAPL long stock, entry $150, stop $147, target $156

```ts
const r = planCommit.commitPlan({
  accountId: 'ib-401', underlying: 'AAPL', strategy: 'breakout',
  plan: {
    entry: 150,
    stops:  { downside: { basis: 'underlying', at: 147 } },   // ADR 0010
    target: { basis: 'underlying', at: 156 },
    thesis:       'cup-and-handle breakout above $148 resistance',
    invalidation: 'handle fails, closes below $146',
    entryEmotion: 'confident — waited two weeks for this',
    committedAt:  new Date('2024-07-15T14:20:00Z'),
  },
})
// Charter, in order:
//   stops has a side ✓; downside 147 < entry 150 ✓; one stop side ⇒
//   target 156 > entry 150 ✓ → no block, no warning.
// → { tradeId: 'tr_001',
//     figures: { risk: { planned: {3, $0}, plannedByDirection: {downside: {3, $0}},
//                maximum: null, current: null, … },
//                reward: { planned: {6, $0}, incremental: null },
//                rr: { planned: 2.0, current: null }, … },
//     warnings: [] }
// Placeholder owed: { level:'trade', type:'pre-entry', tradeId:'tr_001',
//                     required:true, createdAt: Jul15-14:20 }
```

Planned dollars are `$0` (no size pre-fill — the *ratio* 1:2 is what
validates; calc worked example). The trade is now `Planned`; the
plan-before-fill invariant is active.

### Blocked — a short declared on the wrong side

```ts
planCommit.commitPlan({ /* underlying 'AAPL', */ plan: {
  entry: 152,                                            // intended SHORT
  stops:  { downside: { basis: 'underlying', at: 148 } }, // wrong side for a short
  target: { basis: 'underlying', at: 145 },
  committedAt: now, … } })
// Charter: stops has a side ✓; downside 148 < entry 152 ✓ (placement on its
// own side) — BUT one stop side ⇒ target must be on the OPPOSITE side of
// entry; 145 is on the same (down) side as the stop → BLOCK:
// THROW "target is not a profit exit: with only a downside stop declared,
//        the target must be above entry — declare the upside stop instead"
// Nothing written: no Trade, no placeholder.
```

The direction contradiction surfaces through the placement rules — no
long/short input was ever asked for. A short plans `stops: { upside: {…154} },
target: {…145}` and passes.

### Blocked — the $0-risk baseline

```ts
plan: { entry: 150, stops: { downside: { basis:'underlying', at: 150 } }, … }
// downside stop AT entry → THROW "stop at entry yields $0 planned risk —
// the R baseline is undefined". (Same class: a stop at a breakeven, CONTEXT.md.)
```

### Teach (full-target, dormant in MVP) — the in-tent stop

An AAPL iron condor (short 145 put / short 160 call, net credit $2.30) with
`stops: { downside: {basis:'underlying', at:150}, upside: {basis:'underlying',
at:163} }`. Once curve-based planned readings exist (OQ 18), the downside
side reads **+$0.90/unit** (inside the tent — a profit at the stop) while the
upside side reads −$1.60 (the loss side, the worst — the R baseline). Result:
`warnings: [{ code:'stop-reads-profit', side:'downside', reading:{0.90, $90} }]`,
trade committed, R baseline = the upside reading. In the MVP this warning is
unreachable (stock plans are linear; there is no tent) — the code exists, the
computation basis arrives with options.

### Discard — the typo'd commit, caught before any fill

```ts
// Jul 15: committed tr_001 with stop 147 — meant 174 (fat-fingered), no fills yet.
planCommit.discardPlan('tr_001', new Date('2024-07-15T18:00:00Z'))
// → void. Inside: transaction { discardTrade('tr_001') — asserts Planned ∧
//   fills=[] ✓, status ← 'Discarded' (terminal, snapshotless);
//   voidPlaceholder(ent_001, Jul15-18:00) — the owed pre-entry bookend,
//   placeholder → 'void', no longer owed }
// If the trader had already COMPLETED the pre-entry reflection, that entry
// stays (immutable — part of the story); only the owed placeholder voids.

// The honest retry — a fresh trade, a clean baseline:
const r2 = planCommit.commitPlan({ /* … stop 174 this time … */ })   // → tr_002
```

Had the trader "fixed" it with `appendRevision` instead, planned risk would
read the typo (147) forever — the freeze ADR 0005 guarantees would freeze the
mistake — and `revisionCount` would be 1 before the trade ever opened.

---

## Sequence: plan-commit (the happy path, with the transaction)

```mermaid
sequenceDiagram
    actor T as trader
    participant PCC as PlanCommitCoordinator
    participant Calc as CalculationModule
    participant TRS as TradingRecordStore
    participant RS as ReflectionStore

    T->>PCC: commitPlan(tradeInput)
    Note over PCC,Calc: Sketch: {status Planned, plan, revisions:[], fills:[]},<br/>empty marks, asOf = committedAt
    PCC->>Calc: evaluate(sketch, ∅, committedAt)
    Calc-->>PCC: FigureSet (planned fields populated)
    Note over PCC: Charter: ≥1 stop side, placement, profit target.<br/>Block → throw, nothing written.
    rect rgb(235, 235, 235)
        Note over PCC,RS: StorageBinding.transaction — the cross-store commit (OQ 9)
        PCC->>TRS: commit(tradeInput)
        Note over TRS: assigns tradeId, persists Trade (status Planned) + Plan,<br/>asserts ≥1 declared stop side (semantic 18)
        TRS-->>PCC: tr_001
        PCC->>RS: createPlaceholder(level 'trade', type 'pre-entry',<br/>tradeId tr_001, required true, createdAt committedAt)
    end
    PCC-->>T: { tradeId, figures, warnings }
end
```

Two writes, one transaction, one teaching channel. The trade exists; the
pre-entry bookend is owed; the plan-time payoff visualization renders from
`figures`.

## Sequence: blocked validation (nothing persists)

```
trader → PlanCommitCoordinator.commitPlan(input)
  → sketch = { status:'Planned', plan: input.plan, revisions:[], fills:[] }
  → figures = calc.evaluate(sketch, ∅, input.plan.committedAt)
  → charter check fails (e.g. stops: {} — no R baseline)
← THROW. No store was touched: no Trade, no placeholder, no orphaned id.
```

Validation precedes every write (decided semantics 5) — a rejected plan
leaves zero residue; the trader fixes the form and re-commits.

## Sequence: pre-commit preview (UI direct calc call — rule 8, no coordinator)

```
UI (plan form) → sketch = { tradeId:'', …input fields, status:'Planned',
                            revisions:[], fills:[] }
UI → calc.evaluate(sketch, ∅, input.plan.committedAt)
← FigureSet → render the plan-time payoff zones (entry / stop / target)
trader adjusts or commits → commitPlan(input)   // the coordinator's own
                                                // evaluate is the validating one
```

The preview is a pure read of the caller's own data — single-module, the
matrix's sanctioned UI→calc edge. The coordinator holds no preview op; its
`evaluate` at commit is the authoritative one (and blocks are enforced only
there — previews can't be trusted, commits can).

## Sequence: discard-plan (the pre-fill exit — audit finding F1)

```mermaid
sequenceDiagram
    actor T as trader
    participant PCC as PlanCommitCoordinator
    participant TRS as TradingRecordStore
    participant RS as ReflectionStore

    Note over TRS: tr_001 status Planned, fills empty.<br/>A typo'd stop, or the setup never came.
    T->>PCC: discardPlan(tr_001, at)
    PCC->>RS: listEntries(tradeId tr_001, type pre-entry, state placeholder)
    RS-->>PCC: [ent_001]
    rect rgb(235, 235, 235)
        Note over PCC,RS: StorageBinding.transaction — the mirror of the commit pair
        PCC->>TRS: discardTrade(tr_001)
        Note over TRS: asserts Planned AND zero fills (TRS semantic 19).<br/>status ← Discarded — terminal, snapshotless.
        PCC->>RS: voidPlaceholder(ent_001, at)
        Note over RS: placeholder → void — no longer owed.<br/>Completed entries stay (immutable — the story survives).
    end
    PCC-->>T: void
end
```

The discard is the **one trader-declared transition** — legal precisely
because a never-entered trade has no fill arithmetic to compute (its guard
*is* the zero-fills edge). Everything the trade touched unwinds in one
transaction; the Plan itself is retained (forward-only — no delete op exists
anywhere), and a typo resolves by discard + re-commit under a fresh tradeId.

---

## Audit findings (sequence-diagram audit) — applied in this session

The audit applied the yield test to correction ripples, initialization,
unowned detection, gap/late, and composite flows. Skipped with reason:
**cold start / restore** (OQ 8's backup architecture owns it — `importTrade`
+ `importEntry` restore a committed plan's trade *and* its placeholder
verbatim; no seeding role here, same ruling as the FillEntry audit);
**overdue pre-entry placeholder** (dissolved by ReflectionStore's audit — a
stored fact surfaced by `listEntries({state:'placeholder'})`; no "overdue"
notion exists by design); **transaction rollback** (the `StorageBinding`
guarantee is the already-exported seam question — three confirmed call sites
now); **warnings surfacing post-commit** (channel pinned, wiring exported to
UI-release).

| Finding | Category | Resolution |
|---|---|---|
| **F1 — no escape from a committed-but-never-filled plan.** No amend op (the Plan freezes at commit, ADR 0005); a typo-fix *revision* freezes the wrong R baseline forever and pollutes `revisionCount` pre-open; no discard path — a dead Planned trade and its REQUIRED placeholder linger forever; whether pre-fill revisions are even legal ("while the Trade is underway") was unwritten. | Missing operation + unwritten rules | **`discardPlan` designed at the owner's call** (decided semantics 13): Planned-only discard + placeholder void, one transaction. Covers the typo (discard + re-commit under a fresh tradeId) and abandonment. Pre-fill revision legality ruled: legal but the wrong tool. Ripples applied: TradingRecordStore `discardTrade` (semantic 19, 10→11 ops; rejects widened to Closed *or Discarded*; `closeTrade`/`reopenTrade` guards gain from-status), ReflectionStore `voidPlaceholder` + `EntryState 'void'` (12→13 ops), `Lifecycle` gains `'Discarded'`, CONTEXT lifecycle + placeholder notes, overview rule 3 amendment. |
| **F2 — nobody seeds the default Entry Schemas on a fresh install.** The first `getSchema('pre-entry')` on an empty registry fails; `commitPlan`'s placeholder needs no schema, but completion does. | Unwritten rule | **Convention (veto invite): the app seeds built-in defaults via live `saveSchema` at first run** — install wiring is implementation; no new mechanism (the reference-stores "live ops reproduce any backup" logic). Recorded as a reflection-store.md open item. PlanCommit's calls unchanged. |

---

## Requirements fulfilled / exported

### Closed here

| Requirement | Resolution |
|---|---|
| **OQ 9 (this pair's recorded home)** | `commitPlan` wraps `tradingRecord.commit` + `reflection.createPlaceholder` in one `StorageBinding.transaction` — decided semantics 7. The primitive's exact API remains the StorageBinding seam question (as OQ 9's resolution already records). |
| **ReflectionStore's export** — the pre-entry bookend call | Fulfilled verbatim: `createPlaceholder({level:'trade', type:'pre-entry', tradeId, required:true, createdAt: committedAt})`, inside the transaction (decided semantics 7, 10). |
| **ADR 0010's charter assignment** — PlanCommit owns planned-R:R validation + the in-tent teaching | The block/teach lines are pinned (decided semantics 3); the warning shape is pinned (`stop-reads-profit`, sign-derived from `plannedByDirection`). The option-structure computation basis is exported as OQ 18 (decided semantics 6) — shape now, computation with options. |

### Exported to downstream sessions (commitments)

- **→ TradingRecordStore (ripples, applied in this session):**
  - **"A Plan declares ≥ 1 stop side"** enforced on `commit` and
    `importTrade` — the R-baseline precondition (decided semantics 18
    there). Same class as importTrade's reject-non-flat-Closed: the store
    must not be able to write what the coordinator blocks, and no
    legitimate backup contains a stopless plan (commit blocks them, so
    none was ever committed).
  - **`discardTrade`** added (decided semantics 19 there; 10→11 ops) —
    Planned-only, zero-fills guard, terminal snapshotless `Discarded`;
    `recordFill`/`appendRevision` rejects widened to Closed *or Discarded*;
    the guarded-family invariant's wording broadened (the zero-fills edge
    joins net-zero/net-nonzero); `closeTrade`/`reopenTrade` guards gain
    their from-status (Open / Closed).
- **→ ReflectionStore (ripple, applied in this session):** `voidPlaceholder`
  + `EntryState 'void'` (12→13 ops) — placeholder → void, only ever called
  inside `discardPlan`'s transaction; completed entries stay immutable.
  Plus the finding-F2 open item (default schema seeding).
- **→ CalculationModule (ripple, applied in this session):** `Lifecycle`
  gains `'Discarded'` (echoed, never derived — a Discarded trade evaluates
  like a Planned one: fills are empty, planned fields computable, live
  fields null); semantic 20 gains the worst-side clarification (the largest-
  dollar **loss** reading — a profit-reading side is never worst) and the
  empty-stops note (structurally unreachable — the store guard).
- **→ CONTEXT.md (ripple, applied in this session):** the lifecycle gains
  the `Discarded` terminal state (the pre-fill exit, the one
  trader-declared transition); the Journal Placeholder note (voided when
  the plan is discarded before entry).
- **→ options-release drill-down (OQ 18):** the pre-fill computation basis
  for underlying-quoted levels on multi-leg option structures — legs on Plan
  (additive `legs?`, no seam reshape; opens the planned-quantity and
  entry-vs-legs-net sub-questions) vs teach-at-first-fill (ADR 0005's freeze
  moves once for option structures). Joins the payoff-curve companion
  semantics already parked in calculation-module.md's open items. Interim
  honesty: a hand-committed option plan's underlying-quoted stops pass
  linear validation unexamined — the MVP UI cannot produce such a plan
  (stock-only charter).
- **→ UI-release drill-down:** how `warnings` surface (post-commit teach vs
  acknowledged via the UI's own pre-commit preview) is UX; the channel and
  codes are pinned, the wiring is the UI's.
- **→ StorageBinding:** the transaction primitive gains its second confirmed
  cross-store call site (with FillEntry's two) — the API shape remains the
  deferred seam question.

---

## Open items

| Item | Owned by |
|---|---|
| **OQ 18 — pre-fill validation basis for option-structure plans** (decided semantics 6): legs-on-Plan vs teach-at-first-fill, decided with real requirements. | options-release drill-down |
| **UI wiring of `warnings`** — post-commit teach vs pre-commit preview acknowledgment. | UI-release drill-down |
| **`StorageBinding.transaction` shape** — three confirmed call sites now (FillEntry's two + this one). | StorageBinding drill-down / implementation |
| **Default Entry-Schema seeding on fresh install** (finding F2) — the convention is pinned (live `saveSchema` at first run); the wiring is implementation. | Implementation (recorded in reflection-store.md open items) |

---

## Alternatives considered

### Where validation lives (the one genuinely open shape question)

- **Coordinator policy over calc's figures (adopted — decided semantics 2).**
  One `evaluate(sketch)`; the charter is sign/placement checks over the
  returned FigureSet. Keeps calc figure-only (block-vs-teach is product
  judgment, not math) and makes the gate structural (only the committing op
  can be trusted to enforce it).
- **A calc op `validatePlan(plan)` (rejected).** Would move product policy
  into the pure module — the same class of drift rule 1 guards against, and
  every rule is already derivable from the FigureSet evaluate returns. Calc
  grows an op that re-derives what `evaluate` already said.
- **UI-side validation (rejected).** A second UI, an API caller, or a script
  bypasses it; invalid plans reach the store. Validation is only structural
  if the committing operation owns it.

### The pre-fill computation basis (the session's owner question)

- **Defer to the options release; pin the charter now (adopted — decided
  semantics 6).** MVP validation is correct for everything exercisable; the
  options release decides legs-on-Plan vs teach-at-first-fill beside the
  payoff-curve companion semantics it already owns. Cost: the in-tent
  teaching is shape-now/compute-later; interim option plans with
  underlying-quoted stops pass linear validation unexamined (unproducible
  through the MVP UI).
- **Plan declares legs now (`legs?: PlannedLeg[]`) (rejected for now,
  recorded as OQ 18's live option).** Delivers ADR 0010's words exactly and
  freezes the R baseline from the planned structure. Cost: the biggest
  contract ripple available (Plan/TradeInput/importTrade/CONTEXT.md + calc's
  planned-curve construction + the planned-quantity and
  entry-vs-legs-net questions) — all dormant until options ship. Additive
  later, so deferring forces no seam reshape.
- **Transient validation context — `commitPlan(input, structure?)` (rejected).**
  Teaching fires at commit using the intended structure, but the baseline
  then moves at first fill (commit-time reading from planned structure vs
  post-fill reading from actual fills) — ADR 0005's freeze violated exactly
  once, at the moment discipline measurement begins.

### The return shape

- **`{ tradeId, figures, warnings }` (adopted — decided semantics 8).** The
  `closedFigures` precedent: figures computed in hand for validation ride
  back; the plan-time payoff visualization needs no re-derivation.
- **`{ tradeId }` bare (rejected).** The UI would reconstruct the sketch and
  re-run `evaluate` for the plan-time visualization — re-deriving what the
  coordinator just computed.
- **A preview op pair (`previewPlan` + `commitPlan`) (rejected).** The
  preview is a pure read of the caller's own data — the matrix already
  sanctions UI→calc directly (rule 8); a coordinator preview op is a
  pass-through the deletion test rejects.

### The empty-stops guard location

- **Store invariant on `commit` + `importTrade` (adopted — ripple applied).**
  The R-baseline precondition is structural; import must not write what
  commit blocks; no legitimate backup contains one.
- **Coordinator-policy only (rejected).** `importTrade` could write a
  stopless plan, and calc's `evaluate` over zero declared sides is an
  unwritten behavior — a contract gap left open for no gain.

### The doomed-plan exit (audit finding F1 — the owner's call)

- **`discardPlan` — retire the never-entered plan (adopted — decided
  semantics 13).** Covers both cases with one mechanism: the typo (discard +
  re-commit under a fresh tradeId — nothing references the old one once its
  placeholder is voided) and the abandoned idea (terminal `Discarded`, owed
  placeholder voided, story retained). Cost, stated honestly: the session
  rippled across three other docs and CONTEXT (a lifecycle state is an
  ADR-grade change in size), and the system gains its one trader-declared
  transition.
- **Park as an open question (rejected by the owner).** Would have matched
  the OQ 17/18 park-with-promoted-shape pattern and let a focused session
  ask the product question ("is an abandoned plan a *why didn't I take it?*
  reflection moment?") — but MVP traders hit the dead-plan clutter on day
  one, and the owner chose to design it now.
- **Amend-before-first-fill (rejected).** The Plan editable until the first
  fill (freeze + revision clock start at first fill). Fixes the typo only —
  abandonment still unowned — and rewrites decided freeze wording across
  ADR 0001/0005/CONTEXT ("frozen at the initial Plan").
- **Accept as-is (rejected).** Dead Planned trades linger in `listTrades`;
  typo'd baselines freeze as committed; REQUIRED placeholders nag forever on
  abandoned ideas — exactly the UX noise a journaling app whose job is
  prompting reflection must not normalize.
