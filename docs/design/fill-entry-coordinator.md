# FillEntryCoordinator — initial interface design

The coordinator that owns everything that happens *because a fill landed or was
fixed*. Three workflows: the **fill-driven lifecycle** (first fill → Open; the
flat-detecting fill → Closed + snapshot + post-close bookend; the optional
fill-reflection offer), the **correction workflow** (snapshot regeneration,
re-open, close-by-correction — the OQ 12/13 space), and the **snapshot
regeneration sweep** (ADR 0007's calc-bug-fix migration and OQ 14's
mark-correction response). It joins TradingRecordStore + ReflectionStore +
PriceMarkStore + calc — the widest write-side join in the partition (overview
rule 8).

It deliberately owns **no facts, no figure math, no placeholder concept**: it
stores nothing (rule 1), computes nothing itself (`calc.isFlat` /
`calc.evaluate` do), and creates placeholders only by calling ReflectionStore.
Every op is plain request/response (rule 6). Its return types are thin — the
facts stay in the stores, and the UI re-queries.

Three operations over constructor-injected dependencies:

```ts
/** Record one fill and own every consequence it triggers: first-fill → Open,
 *  flat → Closed (+ snapshot + post-close bookend), and the optional
 *  fill-reflection offer. The trader's single entry point for "a fill happened." */
recordFill(tradeId: TradeId, fill: FillInput): FillEntryResult

/** Fix a recorded fill and own the invalidation consequences: snapshot
 *  regeneration (still Closed), re-open (un-flatted the book), or
 *  close-by-correction (flatted an Open trade). OQ 12/13 resolution. */
correctFill(tradeId: TradeId, fillId: FillId, correction: FillInput): CorrectionResult

/** Recompute + write back snapshots for Closed trades in scope. Idempotent.
 *  Serves ADR 0007's calc-bug-fix migration (no scope) and OQ 14's
 *  mark-correction response (instrument + closedAt-window scope). */
regenerateSnapshots(scope?: RegenScope): { regenerated: TradeId[] }
```

---

## Interface

### Operations

```ts
recordFill(tradeId: TradeId, fill: FillInput): FillEntryResult

correctFill(tradeId: TradeId, fillId: FillId, correction: FillInput): CorrectionResult

regenerateSnapshots(scope?: RegenScope): { regenerated: TradeId[] }
```

### Dependencies (constructor-injected)

```ts
tradingRecord: TradingRecordStore   // fills, corrections, transitions, snapshots
reflection:    ReflectionStore      // bookend placeholders
priceMarks:    PriceMarkStore       // buildMarksFromFills at close/regen
calc:          CalculationModule    // isFlat, evaluate
storage:       StorageBinding       // transaction(...) for the two multi-store writes
```

### Types

```ts
/** Types consumed are canonical elsewhere: TradeId, FillId, FillInput
 *  (trading-record-store.md); FigureSet, Lifecycle, InstrumentId
 *  (calculation-module.md). Only the coordinator's own returns are defined here. */

type FillEntryResult = {
  statusAfter:    Lifecycle
  fillId:         FillId       // the just-recorded fill — anchors the fill-reflection offer
  closedFigures?: FigureSet    // present iff this fill closed the trade (the ADR 0007 snapshot)
}

type CorrectionResult = {
  statusAfter:         Lifecycle
  reopened:            boolean  // Closed → Open (correction un-flatted the book)
  closedByCorrection:  boolean  // Open → Closed (correction flatted the book)
  snapshotRegenerated: boolean  // still-Closed path: replaceSnapshot written
}

type RegenScope = {
  instrument?: InstrumentId  // matches any FILL instrument (not record.underlying — multi-leg)
  closedFrom?:  Date         // window on closedAt; mark-correction passes the mark's date
  closedTo?:    Date
}
```

---

## Decided semantics

Each ruling cites the principle or ADR it derives from. Veto any during review.

1. **Three operations: `recordFill`, `correctFill`, `regenerateSnapshots`.** The
   overview estimated one; the correction + regeneration space that OQs 12–14
   parked on this session forced the other two (the same honest growth as
   TradingRecordStore 6→7 and ReflectionStore 8→12). `regenerateSnapshots` is
   the depth move: one op serves three callers — mark-correction response
   (scoped), calc-bug-fix migration (unscoped, ADR 0007's "regeneration
   migration"), and any future snapshot-computing fix — instead of each caller
   re-implementing the marks → evaluate → write-back dance. *(Depth; deletion
   test — three callers share one composition.)*

2. **OQ 7 → close stays folded into `recordFill`.** Close is a *consequence* of
   a fill, not a separate user action — CONTEXT's close rule is "computable
   from fills… no trader-declared close event." A trader-facing `closeTrade`
   workflow would re-introduce the declared close the domain explicitly
   rejects. The store op `closeTrade` (decided semantics 7 below) exists only
   inside the correction workflow, where the flat-making event is a correction
   instead of a fill. *(CONTEXT: close rule; OQ 7 closed.)*

3. **The fill-reflection offer is return-context, not input.** `recordFill`
   returns `fillId`; the UI resolves the trader's 3-way choice (now / later /
   none) via **direct ReflectionStore calls**: 'now' → `createEntry` (complete,
   no placeholder), 'later' → `createPlaceholder` (optional, persists), 'none'
   → nothing. Each resolution path touches exactly one store → rule 8 (direct
   call, no coordinator op); nothing blocks inside `recordFill` waiting for the
   trader to compose reflection content → rule 6; and the trader is never
   forced to write while trading → CONTEXT's decoupling asymmetry. This
   confirms ReflectionStore's open item: "none" = the placeholder is never
   created (offer precedes creation — no delete op needed). Ripple:
   reflection-store.md's audit diagram B is amended to show the UI, not the
   coordinator, making the resolution calls. *(Rules 6 + 8; CONTEXT: Journal
   Entry decoupling, Journal Placeholder.)*

4. **A late fill on a Closed trade rejects — resolution is explicit.** The
   store throws (TradingRecordStore semantic 14); the coordinator passes the
   rejection through with guidance ("this trade is closed — if the fill is
   real, reopen it first; if the closing fill was wrong, correct it instead").
   Re-opening on a late fill is genuinely ambiguous (double-entry vs a
   forgotten fill), so it demands the trader's explicit confirmation: the UI
   calls `tradingRecord.reopenTrade(tradeId)` directly — single store, rule 8 —
   then re-calls `recordFill`. The coordinator never silently re-opens.
   *(TradingRecordStore semantic 14; rule 8.)*

5. **`correctFill`'s branch map is the OQ 12 core:**

   | Store signal | `calc.isFlat(corrected fills)` | Coordinator action | Result |
   |---|---|---|---|
   | `statusPossiblyInvalid` | flat, record Open | marks at `correction.at` → `evaluate` → transaction: `closeTrade(tradeId, correction.at, figures)` + post-close placeholder | `closedByCorrection` |
   | `statusPossiblyInvalid` | not flat, record Closed | `reopenTrade(tradeId)` (clears `closedAt`, nulls `finalFigures`) | `reopened` |
   | `statusPossiblyInvalid` | agrees with status | no transition — fall through to the regen check | — |
   | `invalidatedSnapshot`, still Closed, still flat | flat | marks at `record.closedAt` → `evaluate` → `replaceSnapshot` | `snapshotRegenerated` |
   | neither (open-trade price correction) | — | nothing — live figures recompute on next read | — |

   The closed-by-correction branch exists because a correction can flat an
   *Open* trade (fills +100/−60; correct −60 → −100; net 0) — an edge no prior
   session had written down. ADR 0006 requires stored status to agree with
   derived status, so the transition must fire; `closedAt = correction.at` (the
   corrected fill's own execution time — the close *happened* then, the record
   just said otherwise). *(ADR 0006; OQ 12 closed.)*

6. **OQ 13 → `replaceSnapshot(tradeId, figures)` on TradingRecordStore,
   standalone — not a widened `correctFill`.** Decisive reason: the OQ 14
   mark-correction path needs snapshot write-back with *no fill being
   corrected*; a `correctFill`-shaped write-back could never serve it. Guarded:
   Closed-only (throws otherwise) — the op is meaningless on a live trade whose
   figures compute on read. *(ADR 0007; OQ 13 closed.)*

7. **OQ 12 → the guarded-transition family on TradingRecordStore:
   `reopenTrade`, `closeTrade`.** *(Adopted from the session's recommended
   option; veto here reopens OQ 12.)* Both carry the same guard class
   `recordFill`'s close branch already uses — internal net-position
   arithmetic: `closeTrade` asserts the fills sum to zero (and takes the
   snapshot + `closedAt`), `reopenTrade` asserts they sum non-zero (and clears
   `closedAt`, nulls `finalFigures`). TradingRecordStore semantic 2's wording
   ("`recordFill` is the only op that changes lifecycle status") weakens to the
   invariant it was actually protecting: **every status mutation is a
   fill-arithmetic-guarded op; there is no raw `setStatus`.** The mirror
   symmetry makes the family legible: `recordFill`-close and `closeTrade`
   assert net-zero; `reopenTrade` asserts net-nonzero; a guard failure throws
   rather than letting stored status drift from derived. Rejecting flat-changing
   corrections instead was rejected — it leaves ADR 0006 violated or forces a
   re-import under a new id, orphaning the journal entries and placeholders
   linked to the old one. *(ADR 0006; rule 1 — the guards are the same
   arithmetic class as the existing net-zero assertion, not a calc dependency.)*

8. **Exactly two transactional sequences, both via
   `StorageBinding.transaction(...)`:** `recordFill`'s close branch
   (`tradingRecord.recordFill(…, closeFigures)` + `reflection.createPlaceholder`
   post-close) and `correctFill`'s closed-by-correction branch (`closeTrade` +
   post-close placeholder). These are the only cross-store writes; a torn write
   would break the bookend invariant (a Closed trade missing its *required*
   post-close placeholder — the trader is never prompted — the exact
   accept-torn-write cost OQ 9 rejected). Every other path is sequential
   single-store writes whose torn windows ADR 0007 already tolerates: a Closed
   trade with a null snapshot lazy-populates on read, and a re-open leaves no
   dangling invariant (Open trades compute figures live). *(OQ 9's decided
   pattern; ADR 0007.)*

9. **`regenerateSnapshots` scope semantics.** Only Closed trades are ever in
   scope (others are skipped, not errors). `instrument` matches any **fill**
   instrument — not `record.underlying`, because a multi-leg trade's fills
   carry instruments the underlying field doesn't name. `closedFrom`/`closedTo`
   narrow on `closedAt` via `listTrades` filters. Every in-scope trade is
   recomputed (`buildMarksFromFills(fills, closedAt)` → `evaluate(record, marks,
   closedAt)` — asOf = the original close, OQ 11's payoff) and rewritten via
   `replaceSnapshot`, unconditionally: the op is **idempotent** (same facts +
   marks → same figures), so over-calling is harmless and no deep-equal on
   FigureSet is needed. `regenerated` lists every trade processed.
   *(ADR 0007 regeneration; idempotence over diffing.)*

10. **OQ 14's detection rule and trigger convention.** A corrected mark
    `(instrument, date)` can stale the snapshot of exactly the Closed trades
    where **`date(closedAt) === mark.date` and some fill's instrument matches**
    (the snapshot's marks were built as-of the close date; day-granularity per
    PriceMarkStore's time-stripping key convention). Response: the UI calls
    `regenerateSnapshots({ instrument, closedFrom: mark.date, closedTo:
    mark.date })` **after an `upsertMark` that overwrote an existing mark**
    (history non-empty — a first-time mark entry can't have stale-d anything).
    Detection lives here rather than in PriceMarkStore because marks are shared
    and store-agnostic about consumers (ADR 0002 + rule 1 — no back-references,
    no cross-store calls); the sweep is a coordinator-side filter over
    `listTrades`, not a scan. The calc-bug-fix migration is the same op with no
    scope (ADR 0007: "a regeneration migration over all closed Trades").
    *(ADR 0002, 0007; OQ 14 closed — mechanism + trigger; the UI's wiring is an
    open item below.)*

11. **Every Open→Closed transition owes exactly one post-close placeholder.**
    The normal close and the close-by-correction both create it (inside their
    transactions); a trade that re-opens and closes again gets a second one —
    each close is a real reflection bookend. **No placeholder on re-open** (a
    bookkeeping correction, not a moment the trader reflects on) and **no
    "re-review" placeholder on regeneration** (entries are immutable once
    complete — ReflectionStore semantic 7 — and a figure refresh is not a
    reflection moment; if the post-close review is still outstanding it already
    surfaces as a placeholder). This closes ReflectionStore's OQ 14 side-note.
    *(CONTEXT: Journal Placeholder bookends; ReflectionStore semantics 7 + 18.)*

12. **Timestamps are event-derived, and the coordinator has no clock.**
    Placeholder `createdAt` is the triggering event's own time — the closing
    fill's `at` for the post-close bookend, `correction.at` for the
    closed-by-correction bookend. Snapshots use `closedAt` (= the closing
    fill's `at`, or `correction.at` on the correction path). The fill itself
    carries its caller-provided `at` (TradingRecordStore semantic 7). No
    store-stamps, no coordinator clock — deterministic and test-friendly.
    *(TradingRecordStore semantic 7, applied coordinator-side.)*

13. **Errors throw; the return types carry outcomes, not failures.** Unknown
    `tradeId` (plan-before-fill), `recordFill` on Closed (decided semantics 4),
    unknown `fillId`, guard failures inside the store — all propagate as
    exceptions; `CorrectionResult`'s booleans describe *which legitimate branch
    ran*, not error states. *(Codebase convention — the stores throw; rule 6.)*

14. **`closedFigures` rides the return** so the UI can render the close
    ("+$840 realized, 2.8R") without a second read. The snapshot is already in
    hand — it was just computed and stored. *(Depth — one call, everything the
    close moment needs.)*

15. **The EOD mark is not a prerequisite for closing** (audit finding F2).
    The closing fill typically lands intraday, before that date's end-of-day
    mark exists. The snapshot's `pnl.unrealized` is **$0 by calc semantic 4**
    (a flat position → "no unrealized P&L" → no mark needed); `pnl.realized`
    is always computable from fills. A first-time mark entered that evening
    changes nothing (only *overwrites* invalidate — decided semantics 10), so
    the snapshot stands. *(CalculationModule semantic 4; ADR 0007.)*

16. **The regen-sweep trigger when the overwriting mark write happens inside
    the Daily Review** (audit finding F1). DailyReviewCoordinator owns
    `upsertMark` in its flow, but the who-calls-whom matrix has no
    coordinator→coordinator edge — and none is added. Ruling: the **UI** calls
    `regenerateSnapshots` directly after any overwriting mark write, including
    one made from the Daily Review screen (the UI knows a mark write just
    happened; the coordinator that performed the write does not cascade).
    Exported to the DailyReviewCoordinator session: its doc must not grow a
    FillEntry call. *(Overview who-calls-whom rules; rule 6 — the UI
    re-queries/acts.)*

---

## Sequence: fill-entry — plain path (first / intermediate fill)

```
trader → FillEntryCoordinator.recordFill(tradeId, fillInput)
  → existing = tradingRecord.getTradeRecord(tradeId)          // throws if unknown (plan-before-fill)
  → [status === 'Closed' → throw: late-fill rejection, decided semantics 4]
  → simFills = [...existing.fills, fillInput]
  → calc.isFlat(simFills)                                     // cheap, every fill (ADR 0006)
      └─ false (always, for a single nonzero first/intermediate fill):
          → tradingRecord.recordFill(tradeId, fillInput)      // no closeFigures; Planned→Open internal
          ← { statusAfter, fillId }
← FillEntryResult { statusAfter, fillId }                     // offer context for the UI
```

Single store write — no transaction (decided semantics 8).

## Sequence: fill-entry — closing path (with the transaction)

```mermaid
sequenceDiagram
    actor T as trader
    participant FEC as FillEntryCoordinator
    participant TRS as TradingRecordStore
    participant PMS as PriceMarkStore
    participant Calc as CalculationModule
    participant RS as ReflectionStore

    T->>FEC: recordFill(tr_001, sell 150 @ 156)
    FEC->>TRS: getTradeRecord(tr_001)
    FEC->>Calc: isFlat([...fills, sell150])   // +150 −150 = 0 → true
    FEC->>PMS: buildMarksFromFills(simFills, fill.at)
    FEC->>Calc: evaluate(record-with-simFills, marks, fill.at)
    rect rgb(235, 235, 235)
        Note over FEC,RS: StorageBinding.transaction — the cross-store close (OQ 9)
        FEC->>TRS: recordFill(tr_001, fill, closeFigures)
        Note over TRS: append fill, assert net-zero ✓, status ← Closed,<br/>closedAt ← fill.at, finalFigures ← closeFigures (ADR 0007)
        FEC->>RS: createPlaceholder(level 'trade', type 'post-close', required true, createdAt fill.at)
    end
    FEC-->>T: statusAfter Closed, fillId, closedFigures
    Note over T: UI shows close figures, offers reflect now / later / none<br/>on fillId (resolved via direct ReflectionStore calls)
end
```

The cheap/rare split (ADR 0006/0007) intact: `isFlat` every fill, `evaluate`
only on the flat-detecting one.

## Sequence: the 3-way fill-reflection resolution (direct store calls, rule 8)

```mermaid
sequenceDiagram
    actor T as trader
    participant UI
    participant RS as ReflectionStore

    Note over UI: recordFill returned fillId. The offer:<br/>reflect now / later / none — decided AFTER the fill is recorded.
    alt now
        UI->>RS: getSchema('fill')
        UI->>RS: createEntry(level 'fill', type 'fill', tradeId, fillId, content, schemaId, at)
        Note over RS: complete entry created directly — no placeholder ever exists.
    else later
        UI->>RS: createPlaceholder(level 'fill', type 'fill', tradeId, fillId, required false, createdAt)
        Note over RS: placeholder persists — surfaces in the Daily Review.
    else none
        Note over UI: nothing. The offer preceded creation —<br/>declining means no store call at all.
    end
end
```

This amends ReflectionStore's audit diagram B: the **UI** makes the resolution
calls, not the coordinator — each path is single-store (rule 8), and the fill
workflow never blocks on journal-writing (rule 6, CONTEXT's decoupling).

## Sequence: correction — price-only typo on a Closed trade (regenerate)

```
trader → FillEntryCoordinator.correctFill('tr_001', 'fill_003', {…price: 155.50, at: originalCloseTime})
  → tradingRecord.correctFill(...)                ← { invalidatedSnapshot: true, statusPossiblyInvalid: false }
  → record = tradingRecord.getTradeRecord(...)    // post-correction
  → [statusPossiblyInvalid false → skip transition branches]
  → calc.isFlat(record.fills)                     // true (only price changed)
  → marks = priceMarks.buildMarksFromFills(record.fills, record.closedAt)   // asOf = original close (OQ 11)
  → figures = calc.evaluate(record, marks, record.closedAt)
  → tradingRecord.replaceSnapshot('tr_001', figures)
← { statusAfter:'Closed', reopened:false, closedByCorrection:false, snapshotRegenerated:true }
```

## Sequence: correction — un-flatting a Closed trade (re-open)

```
trader → FillEntryCoordinator.correctFill('tr_001', 'fill_003', {…quantity: 100 (was 150), at: originalCloseTime})
  → tradingRecord.correctFill(...)                ← { invalidatedSnapshot: true, statusPossiblyInvalid: true }
  → record = tradingRecord.getTradeRecord(...)
  → calc.isFlat(record.fills)                     // +150 −100 = +50 → NOT flat
  → tradingRecord.reopenTrade('tr_001')           // asserts non-zero ✓; clears closedAt; nulls finalFigures
← { statusAfter:'Open', reopened:true, closedByCorrection:false, snapshotRegenerated:false }
```

The trade is Open again; figures compute live on read. When the position
actually goes flat later, the ordinary closing path runs — new snapshot, new
`closedAt`, and a **second** post-close placeholder (decided semantics 11).

## Sequence: correction — flatting an Open trade (close-by-correction)

```
trader → FillEntryCoordinator.correctFill('tr_002', 'fill_005', {…quantity: 100 (was 60), at: fillTime})
  → tradingRecord.correctFill(...)                ← { invalidatedSnapshot: false, statusPossiblyInvalid: true }
  → record = tradingRecord.getTradeRecord(...)
  → calc.isFlat(record.fills)                     // +100 −100 = 0 → flat, but status 'Open'
  → marks = priceMarks.buildMarksFromFills(record.fills, correction.at)
  → figures = calc.evaluate(record, marks, correction.at)
  → storage.transaction(() => {
      tradingRecord.closeTrade('tr_002', correction.at, figures)   // asserts net-zero ✓
      reflection.createPlaceholder({level:'trade', type:'post-close', required:true, createdAt: correction.at})
    })
← { statusAfter:'Closed', reopened:false, closedByCorrection:true, snapshotRegenerated:false }
```

The edge no prior session had written: the typo *was* the close. `closedAt` is
`correction.at` — the execution time the record should always have carried.

## Sequence: late fill on a Closed trade (reject → explicit reopen → retry)

```
trader → FillEntryCoordinator.recordFill('tr_001', forgottenBuyFill)
  → getTradeRecord → status 'Closed'
  ← THROW: "trade closed — reopen it first if this fill is real, or correct the closing fill"
trader confirms → UI: tradingRecord.reopenTrade('tr_001')          // DIRECT store call — rule 8
trader → FillEntryCoordinator.recordFill('tr_001', forgottenBuyFill)   // now Open → plain path
```

## Sequence: re-open → re-close (the full correction ripple — audit diagram C)

A trade re-opened by correction continues its life and closes *again*. This is
the composite that exercises everything the correction family touched: the
discarded snapshot, the cleared `closedAt`, and the second bookend.

```mermaid
sequenceDiagram
    actor T as trader
    participant FEC as FillEntryCoordinator
    participant TRS as TradingRecordStore
    participant RS as ReflectionStore

    Note over TRS: tr_001 Closed Jul 22. Fills +150 / −150.<br/>Snapshot stored. Post-close placeholder ent_012 owed.
    T->>FEC: correctFill(tr_001, fill_003, qty 150 → 100)
    FEC->>TRS: correctFill(tr_001, fill_003, correction)
    TRS-->>FEC: invalidatedSnapshot true, statusPossiblyInvalid true
    FEC->>TRS: getTradeRecord(tr_001)
    Note over FEC: isFlat: +150 −100 = +50 → not flat<br/>→ re-open (decided semantics 5)
    FEC->>TRS: reopenTrade(tr_001)
    Note over TRS: asserts fills ≠ 0 ✓. status ← Open.<br/>closedAt cleared. finalFigures nulled (old snapshot discarded).
    FEC-->>T: (statusAfter Open, reopened true)
    Note over RS: ent_012 (post-close, owed) remains a stored fact —<br/>it surfaces until completed, immutable once complete.
    Note over T,RS: Days later — the real exit:
    T->>FEC: recordFill(tr_001, sell 50)
    FEC->>TRS: getTradeRecord(tr_001)
    Note over FEC: isFlat: +50 −50 = 0 → closing path (marks + evaluate)
    FEC->>TRS: recordFill(tr_001, fill, closeFigures)
    FEC->>RS: createPlaceholder(type post-close, required true, createdAt fill.at)
    Note over RS: ent_019 — the SECOND post-close bookend (decided semantics 11).<br/>fresh closedAt + fresh snapshot. The wheel of corrections turns no more.
    FEC-->>T: (statusAfter Closed, fillId, closedFigures)
end
```

**What drawing this exposed:** the re-opened trade's *first* post-close
placeholder (ent_012) survives as an owed fact — under Candidate B nothing
deletes it, and per decided semantics 11 each close owes its own bookend, so
the journal ends with two post-close entries for one trade (the first says
"review what you thought happened", the second "review what actually did").
Honest and useful for a journaling app; veto if you'd rather the re-open
complete-or-void the outstanding bookend — but entries are immutable
(ReflectionStore semantic 7), so voiding would need a new mechanism.

## Sequence: regenerateSnapshots — mark correction and calc-bug migration

```
// Mark correction (OQ 14): trader fixes AAPL's Jul-25 mark via upsertMark (history was non-empty).
UI → FillEntryCoordinator.regenerateSnapshots({ instrument:'AAPL', closedFrom: jul25, closedTo: jul25 })
  → candidates = tradingRecord.listTrades({ status:'Closed', closedFrom: jul25, closedTo: jul25 })
  → candidates.filter(r => r.fills.some(f => f.instrument === 'AAPL'))   // fill-instrument, not underlying
  → for each: marks = buildMarksFromFills(fills, closedAt)
              figures = calc.evaluate(record, marks, closedAt)
              tradingRecord.replaceSnapshot(tradeId, figures)
← { regenerated: ['tr_004', 'tr_009'] }

// Calc-bug-fix migration (ADR 0007): same op, no scope — every Closed trade, once, offline.
FillEntryCoordinator.regenerateSnapshots()
```

---

## Audit findings (sequence-diagram audit) — applied in this session

The audit drew one new flow (re-open → re-close, diagram C) and applied the
yield test to the correction variants, the mark-trigger, and cold start.
Skipped with reason: **cold start / restore** (owned by OQ 8's backup
architecture, not this module — the import ops exist and this coordinator has
no seeding role); **pre-entry placeholder still owed at close** (both bookends
are stored facts under Candidate B; no derivation, no coordinator action —
nothing unwritten to expose).

| Finding | Category | Resolution |
|---|---|---|
| **F1 — Who calls the regen sweep when the overwriting mark write happens inside the Daily Review?** DailyReviewCoordinator owns `upsertMark` there; coordinators may not call coordinators (who-calls-whom matrix). | Unwritten rule | **The UI calls `regenerateSnapshots` directly, including from the Daily Review screen** (decided semantics 16). No coordinator→coordinator edge added. Exported to the DailyReviewCoordinator session. |
| **F2 — Closing fill lands before the EOD mark exists.** Snapshot's `pnl.unrealized` at close: `$0` or `null`-without-mark? | Unwritten rule | **`$0` — flat → "no unrealized P&L" by calc semantic 4; no mark needed** (decided semantics 15). A first-time evening mark changes nothing (only overwrites invalidate). |
| **(diagram C) — A re-opened trade's first post-close placeholder survives into the second close.** Two post-close entries for one trade. | Unwritten rule (validated) | **Confirmed as designed** (decided semantics 11): each close owes its own bookend; entries are immutable so the first stands. Veto invite on the diagram's ruling. |

---

## Requirements fulfilled / exported

### Closed here (open questions resolved)

| OQ | Resolution |
|---|---|
| **7 — Trade-close: folded into FillEntryCoordinator or split?** | **Folded, confirmed** (decided semantics 2). Close is a fill consequence; no trader-facing close op exists. `closeTrade` (store) serves only the correction edge. |
| **12 — Status-invalidating correction.** | **The guarded-transition family** (decided semantics 5 + 7): `reopenTrade` / `closeTrade` on TradingRecordStore, orchestrated by `correctFill`'s branch map. The OQ 12 alternative ("corrections that change flat-ness are rejected") was rejected — it violates ADR 0006 or orphans journal links. |
| **13 — Snapshot write-back after regeneration.** | **`replaceSnapshot(tradeId, figures)`** — standalone op on TradingRecordStore, Closed-only guard (decided semantics 6). Standalone because the mark-correction path needs write-back with no fill corrected. |
| **14 — Mark-correction snapshot invalidation.** | **Detection rule + response op + trigger convention** (decided semantics 10): affected = Closed ∧ `date(closedAt) === mark.date` ∧ fill-instrument match; response = `regenerateSnapshots({instrument, closedFrom, closedTo})`; trigger = UI, after an overwriting `upsertMark`. |

### Exported to downstream sessions (commitments)

- **→ TradingRecordStore (ripples, applied in this session):** `recordFill`'s
  return gains `fillId`; three new guarded ops — `reopenTrade`, `closeTrade`,
  `replaceSnapshot` (decided semantics 6–7); semantic 2's invariant reworded
  ("every status mutation is fill-arithmetic-guarded; no raw setStatus"); the
  state diagram gains the two correction-driven edges; OQ 12/13 open items
  closed. **7 → 10 ops.**
- **→ ReflectionStore (ripple, applied in this session):** audit diagram B and
  the fill-entry sequence amended — the coordinator *returns* the offer
  (`fillId`); the UI resolves now/later/none via direct store calls. The
  "'none' path" open item is confirmed: never created. The OQ 14 side-note is
  closed: no re-review placeholder on regeneration (decided semantics 11).
- **→ StorageBinding:** two sequences depend on `transaction(...)` (decided
  semantics 8) — the primitive's exact shape remains the deferred seam
  question (OQ 9's recorded resolution).
- **→ DailyReviewCoordinator / PerformanceReportingCoordinator:** none new —
  they read (`listTrades`, `listEntries`, snapshots) and never write lifecycle.
- **→ OQ 8 (backup architecture):** untouched — `importTrade` /
  `importEntry` / `importMark` remain the restore path; no coordinator role
  added.

---

## Open items

| Item | Owned by |
|---|---|
| **UI wiring of the regen-sweep trigger.** The mechanism and convention exist (decided semantics 10), but whether the UI calls `regenerateSnapshots` automatically after every overwriting `upsertMark` or batches/prompts is a UX decision. Idempotence makes over-calling harmless. | UI-release drill-down |
| **Packaging of the calc-bug-fix migration.** ADR 0007's regeneration migration is `regenerateSnapshots()` unscoped; whether it ships as a CLI script, a startup hook, or an admin screen is implementation. | Implementation |
| **`StorageBinding.transaction` shape.** Confirmed load-bearing by two sequences here; exact API deferred (OQ 9's recorded resolution — joins the coordinators step or implementation). | StorageBinding drill-down / implementation |
| **Placeholder `createdAt` from event time.** The post-close bookend is stamped with the closing fill's `at` (decided semantics 12), not processing time. If the trader records fills long after execution, the placeholder appears backdated in the journal stream. Accepted for determinism; revisit if the interleaved review stream feels wrong. | later, if the need arises |

---

## Alternatives considered

### The correction-path shape (design-it-twice — the load-bearing choice)

- **Candidate A — Guarded transition ops, coordinator orchestrates** (adopted).
  The store gains `reopenTrade` / `closeTrade` / `replaceSnapshot`, each guarded
  by the same net-position arithmetic class `recordFill`'s close assertion
  already uses; the coordinator owns the branch map (decided semantics 5).
  Deepest on the depth principle: three narrow ops close the entire OQ 12/13
  space *and* serve OQ 14 + the ADR 0007 migration; the invariants stay
  structural (a guard failure throws, stored status can never drift from
  derived silently). Cost, stated honestly: TradingRecordStore grows 7 → 10
  ops, and semantic 2's clean "recordFill is the only status-mutating op"
  story weakens to the guarded-family wording.

- **Candidate B — Reject flat-changing corrections** (rejected). Keeps the
  store at 7 ops and the old invariant wording. But a rejected correction
  leaves the record wrong: either the trader declines the correction (stored
  status disagrees with derived fills — the exact thing ADR 0006 exists to
  prevent) or re-creates the trade via `importTrade` under a **new id**,
  orphaning every journal entry and placeholder linked to the old one. The
  cheapest-looking option is the most expensive one.

- **Candidate C — The store re-derives status inside `correctFill`**
  (rejected). Coherent for status (net-position arithmetic is store-internal
  already — the close assertion proves it), but the snapshot half of the path
  needs marks + calc, which the store cannot touch (rule 1: no calc in stores,
  no cross-store reads). The op splits anyway — status inside, figures outside
  — putting transition arithmetic in two places and creating a torn state the
  coordinator must repair. Moving the same logic one layer up (Candidate A)
  keeps it in one.

### The fill-reflection 3-way choice (return-offer vs input)

- **Return-context + direct store calls** (adopted — decided semantics 3).
  `recordFill` returns `fillId`; the UI resolves via direct ReflectionStore
  calls. Honors rule 8 (each resolution path is single-store), rule 6 (nothing
  blocks), and CONTEXT's asymmetry (reflection is never forced during
  execution).
- **Synchronous choice input** (`recordFill(tradeId, fill, {reflection:
  'now', content, schemaId})`) (rejected). Forces the UI to gather journal
  content *before* the fill is recorded — the trader waits to journal while
  trading. Couples the fill workflow to the journal-writing workflow and bloats
  the request type with content that belongs to a later moment.
- **A coordinator resolution op** (`resolveFillReflection(choice, …)`)
  (rejected). Every branch of the resolution touches one store — rule 8 makes
  it a direct store call. The op would be a pass-through the deletion test
  rejects.

### `regenerateSnapshots` placement

- **On FillEntryCoordinator** (adopted). The module that owns snapshot
  creation (the close path) owns snapshot regeneration — the same
  marks → evaluate → write-back composition, reused three ways (decided
  semantics 1).
- **A separate SnapshotMaintenance coordinator** (rejected). A fifth
  coordinator with one op, whose dependencies are a strict subset of this
  module's. Fails the deletion test — it would be deleted into this module.
- **Callers compose it manually** (rejected). Every caller re-implements the
  dance; the calc-bug migration (ADR 0007's explicit requirement) would have
  no home.

### The return shape (overview sketch refinement)

- **Concrete fields (`fillId`, `closedFigures`)** (adopted). Exactly one
  prompt exists (the fill-reflection offer); the overview's
  `placeholdersOffered: PlaceholderPrompt[]` list was speculative generality.
- **A `PlaceholderPrompt[]` list** (rejected). No second prompt exists to put
  in it; the required post-close bookend is auto-created, not offered. YAGNI —
  if a second offered prompt ever appears, widening the return is backward-
  compatible.
