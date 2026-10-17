# Acceptance-to-evidence matrix

Phase 4 artifact required by `specs/evaluation/planning-protocol.md:137-167`: one row per acceptance
scenario, carrying the evidence the plan commits to produce for it. This matrix is an input to the
Phase 6 freeze (`planning-protocol.md:198`), so it is written to be read without opening any
breakdown.

| | |
|---|---|
| Branch | `deepseek-v41-flash` |
| Written | 2026-10-11, Phase 4 |
| Scenarios | 67 canonical, one row each (`specs/acceptance/acceptance-contract.md`) |
| Breakdowns behind it | D1–D7 only. D8–D22 have no task graph, so rows owned there cite no task, no integration case and no critic flow |
| Derived data | `node scripts/derive-acceptance-ownership.mjs` — 32 claimed by D1–D7, 35 unclaimed, 3 with no owning deliverable at derivation time (2 after the `AC-LIFE-003` ownership fix recorded in §7) |
| Not authority over | `specs/` (frozen) and the breakdowns (they are the task-level source). Where this matrix and a breakdown disagree, §7 records it and the matrix governs the status |

**No application code, no new breakdowns.** This session writes this file, corrects the three stale
`Covered` references to `AC-POS-004` in D6, adds one ownership line to `vertical-deliverables.md`, and
marks one forward obligation discharged. Nothing else changes.

---

## 1. Status vocabulary

The protocol fixes three values (`planning-protocol.md:151`). This matrix uses exactly those three.

| Status | Means here | Rows |
|---|---|---|
| `covered` | One named deliverable's own planned evidence establishes the **whole** scenario: every Given, When and Then, through its production UI, its mock-free integration suite and its critic gate | 16 |
| `planned` | Real evidence is planned, but the scenario is not yet satisfied end to end. The row names the slice that is evidenced, the deliverable that will produce the remaining evidence, and — where a clause is evidenced by nobody — says so | 51 |
| `intentionally not advertised` | The capability is deliberately absent from the Installed Capability Manifest and the scenario is not a commitment of this plan | 0 |

Three rules produce those counts, and each one is a deliberate reading of the sources.

1. **A breakdown `Partial` claim is recorded here as `planned`.** The breakdowns use `Covered` and
   `Partial`; the protocol does not have a `partial` value, and a `Partial` written as `covered` would
   be exactly the misreading the acceptance contract forbids
   (`acceptance-contract.md:518`; every breakdown's §5 states "a Partial row is not a pass"). Each such
   row therefore carries the partial evidence it does have and the completing owner it does not.
2. **A breakdown `Covered` claim is recorded as `covered` only when the scenario's own fixture is
   constructible at that deliverable.** Two claims fail that test and are recorded as `planned`:
   `AC-REV-002` (its Given requires Settlement Due members, which no fact can produce before D10) and
   `AC-REV-006` ("correcting facts … can make a past date Incomplete again", which arrives at D15, as
   D5's own row says). §7 records both. This is the same defect class as the `AC-POS-004` stale prose
   corrected in the same session.
3. **No row is `intentionally not advertised`.** The value is defined here so its absence is visible.
   The two places where this branch declines capability — fee application and allocation (PD10) and
   mature-scale measurement (§4, `AC-PERF-001`) — are recorded as unclaimed sub-clauses and an unowned
   gap, **not** as scope waivers, because a waiver requires a recorded scope change to the canonical
   specification (`acceptance-contract.md:518`) and that decision has not been taken (PD10 says so
   explicitly).

A row marked `planned` is not a failure and not a pass: it is a commitment with a named owner and a
named gap. A `covered` row is the only kind the plan will defend as satisfied at freeze.

## 2. How to read a row

Each row has the ten fields of the protocol's template (`planning-protocol.md:141-152`), in order.

- **Vertical deliverable** — the ordered deliverable (`plan/vertical-deliverables.md`) that owns the
  scenario, and whether it has a breakdown.
- **Planned tasks** — always `D<n>:T<m>`. Task ids restart at `T1` in every breakdown, so a bare `T5`
  is ambiguous and is never used here. A deliverable with no breakdown contributes no task id.
- **TDD / structural verification** — the task-level red/green specification, named by the public seam
  the case runs through. `S` (structural) tasks carry an exact verification instead of invented unit
  tests (`planning-protocol.md:113`).
- **Mock-free integration case and fixture** — the real-stack case, its fixture, and the disclosed
  substitution. Every Node case substitutes `fake-indexeddb` for the browser engine and says so; no
  application layer is bypassed (`planning-protocol.md:120-121`).
- **Browser-critic flow** — the independent critic's flow ids in that deliverable's §4 table, run at
  both viewports. `—` where the scenario is not browser-observable.
- **Command** — the exact recorded command, or the reproducible procedure where a command does not
  exist yet. Command spellings are fixed in §5.
- **Expected result and durable-state proof** — what must be observable, and which durable rows prove
  it (revision bindings, index membership, version chains, manifest digests, artifact bytes).
- **Failure / nonmutation / restart evidence** — the negative case and the restart leg, where the
  scenario's own text makes them material.
- **Status** — `covered` or `planned`, with the completing owner or the gap.

## 3. Branch-local deviations a reader must know before trusting a row

None of these edits `specs/`. All are recorded in
`plan/planning-decisions-2026-10-10.md` and disclosed in the rows they touch. **This branch's results
are not comparable with the other seven implementations on the affected scenarios**, and no row here
claims comparability it does not have.

| Deviation | What it changes | Rows affected |
|---|---|---|
| **PD10** — fees are captured and excluded | Every Execution records its actual fee as a required fact defaulting to explicit zero, and **no fee enters any calculation**. Lot-aware allocation, the consumed/unconsumed opening-fee split, fee-adjusted P&L, Entry Quality's allocated-fee component and settlement cost adjustments are not installed | `AC-POS-001` (allocated-exactly-once clause unclaimed by any deliverable), `AC-CALC-001` ("including allocated fees" unclaimed), `AC-RPT-002` (fee-inclusive outcomes unclaimed). No deliverable may claim `AC-POS-001` complete |
| **PD14** — attention ordering by boundary proximity | Within a band, Trades sort by distance to the nearest boundary ascending, not by pressure descending (`daily-review.md:32`) | `AC-REV-002` is **unaffected**: it pins only the task-family order (Mark, Debt, settlement, Trade) at `acceptance-contract.md:235`, never the within-family Trade order. The Trade walk itself is not comparable |
| **PD12** — `Rolled` is selectable before any Roll workflow exists | `Rolled` may be recorded on a stock close at D6 with no Roll lineage. Inert by construction: no derived value reads a Close Reason | `AC-POS-004`, `AC-POS-003`, `AC-CALC-004` rows state it. `AC-REF-001` requires the fifth Close Reason to exist and stay selectable |
| **PD11** — Terminal Disposition is a derived shape | The result union, four members, positive magnitudes, `FactOrder` and the shared five-kind `MechanismKind` are fixed; no disposition summary is stored | `AC-LIFE-001`'s disposition proof, `AC-POS-004`'s mechanism-agnostic derivation and `AC-POS-003`'s Roll leg are all read against this shape; D6's breakdown carries it and later deliverables extend rather than reshape it |
| **PD13** — a reopened Debt keeps its identity and its original due time | Reopening restores the frozen due semantics instead of assigning a new due time, so a reopened Debt is due at the next cutoff | `AC-JOUR-005`, `AC-REV-006` rows state the immediate next-cutoff consequence |
| **PD15** — seed scope is need-driven | Manifest v1 Long Stock; the five reasons at D6; the remaining ten Strategies at D8/D9/D11/D12; **D12 owns the empty IdeaSource Tag Type** | `AC-REF-001` completes at D12; `AC-JOUR-007` completes at D17 |
| **PD17** — the backup artifact format | The exclusion proof fails closed at a named stage; the manifest records per-section totals and per-kind counts; the failure-stage vocabulary is a fixed four-stage enumeration | `AC-BACK-001` row |

Two deviations that are *not* behaviour changes but change what the evidence looks like:
`PD16` fixes the module and operation mapping the tasks are cited against, and `PD3` fixes the stack
set while deferring exact versions to Phase 6, which is why §5 prints script names rather than version
numbers.

## 4. Evidence categories, and where each one is actually carried

`planning-protocol.md:156-167` requires the matrix to distinguish these categories rather than blend
them. This table is the map; each row cites its own members.

| Category | Carried by (planned) | Rows |
|---|---|---|
| Pure calculation examples | D3:T4–T8 (`derive`: positions, FIFO links, fee capture and exclusion, realized P&L), D4:T10–T12 (`derive`/`evaluate`/`replay`), D6:T4–T5 (disposition, `Closed` lifecycle) at the pure seam, value-for-value against an independent `decimal.js` computation | `AC-POS-001`, `AC-CALC-002`, `AC-REV-004`, `AC-LIFE-001` |
| Module contract tests | Every non-structural task's `describe`/`it should` cases through the named public seam, with recorded red and green per case | All rows; the seam is named in each row's TDD field |
| Multi-module transaction and evidence-race tests | D1:T11 (atomic multi-store seam), D1:T12 (persistence write gate), D1:T14 (snapshot-consistent reads), D2:T14 (Trade + Journal rollback), D3:T16 (Trade facts + Journal outcome), D4:T16–T17 (five bindings, `ReviewChanged`), D4:T19 (atomic Stop-Discipline reconciliation), D5:T7 (one outcome per obligation key), D6:T13 (closing facts + disposition + lifecycle + Journal), D7:T8 (export vs concurrent mutation) | `AC-PLAN-002`, `AC-RESP-001`, `AC-REV-005`, `AC-BACK-001` |
| Browser / responsive / accessibility | D1:T32, D2:T18, D3:T21, D4:T24, D5:T16, D6:T18, D7:T12 (live resize, keyboard-only, axe-core), and the paired Playwright specs | `AC-UI-001`, `AC-UI-002`, and every flow-bearing row's critic field |
| PWA installation, browser-tab operation, production HTTPS, loopback automation, browser-neutral readiness, exact browser/OS provenance | D1:T16–T20, T29, T33 (Chromium and WebKit; version strings recorded as provenance only, never read by the decision logic), browser-tab `Writable` at D1. Loopback automation runs on the secure loopback origin from `DEV_PORT`. **Production HTTPS origin evidence has no owning task**: PD4 assumes a deployed URL and `AC-DEL-003` requires it, but no deliverable publishes one. Recorded as an open gap at `AC-DEL-003`, not invented here | `AC-DEL-001`, `AC-DEL-003`, `AC-DEL-004`, `AC-DEL-006`, `AC-CAP-001` |
| Repeated-launch, runtime-failure, `Recovery Only`, restart / offline / update / migration / Restore | D1:T20–T21, T25–T26, T29, T33 (cold restart, injected runtime failure, unavailable root); D22 (update, migration-on-activation) and D21 (Restore) have no breakdown yet | `AC-DEL-001`, `AC-DEL-002`, `AC-DEL-004`, `AC-DEL-005`, `AC-DEL-006`, `AC-REST-004` |
| Verified / unverified / failed-verification backup results, plus exact-target `CompletedBackupReceipt` before Restore | D7 produces `Downloaded` (no receipt) and `Not Completed` with a named stage; D20 owns `Verified`/`Not Verified` and the receipt; D21 owns receipt enforcement before Restore. No breakdown exists for D20 or D21 | `AC-BACK-001`, `AC-DEL-005`, `AC-REST-002` |
| Deterministic target-scale correctness and percentile benchmarks | **Nothing.** No deliverable owns measurement. `AC-PERF-001` is an unowned gap; the boundedness shapes (index membership, asserted query counts, no all-history replay) are asserted but no percentile is computed and **no millisecond figure appears anywhere in this plan** | `AC-PERF-001` |

**How secrets exclusion is verified.** D7:T6 traverses the packaged value, applies the exclusion
categories, and fails closed: a match makes the export return `Not Completed` at the exclusion stage
with no artifact offered (PD17 item 1). The proof is asserted from the produced artifact bytes — the
excluded values are absent — and from the manifest's explicit exclusion list, not from a code comment.
D7 discloses that it cannot exercise a real excluded credential, because no provider is configured
before D8; the credential slot is empty rather than faked. Whether the proof should be strengthened
beyond "no key present" is forward obligation 12 and D20's (PD17's remaining question).

**How no-write and rollback claims compare authoritative before/after state.** A no-write row asserts
per-store revisions unchanged, plus a raw cursor walk in which no store gained or lost a record and no
index entry appeared (for example D2:T2 and D3:T3). A rollback row injects an abort at a *named
participant boundary* — Trade staging, link staging, index movement, or Journal staging — and compares
each store's revision against the pre-command value (D3:T16, D4:T19, D6:T13). A durability row reopens
the store in a **new runtime instance** rather than reading an in-memory cache; that restart leg is
what makes a "committed" claim meaningful, and the `fake-indexeddb` fidelity gaps are disclosed with
their real-engine counterparts named (D1 T33, D4 T25, D6 T19, D7 T13).

## 5. Command forms

Every command in this plan is written against a declared script name, never a version. Phase 6 pins the
versions (`planning-protocol.md:193`); until then the lockfile created by D1:T1 is the version record.

| Purpose | Recorded form |
|---|---|
| Unit case, one at a time | `pnpm exec vitest run --project unit <test-file> -t "<case phrase>"` |
| Integration case | `pnpm exec vitest run --project integration <test-file> -t "<case phrase>"` |
| Browser case | `pnpm exec playwright test <spec-file> -g "<case phrase>"` with `--project=chromium` (add `--project=webkit` where the task states both engines), or `--project=narrow\|wide` for the responsive flows |
| Whole-task / whole-suite gates | `pnpm test:unit`, `pnpm test:integration`, `pnpm test:browser`, `pnpm typecheck`, `pnpm lint:layers`, `pnpm build` — each must exit 0 |
| Artifact and manifest checks | `node -e "<script>"` over the built bytes, as D1:T16 and D1:T34 do |
| Plan validators | `node scripts/check-deliverable-breakdown.mjs plan/deliverable-breakdowns/*.md` and `node scripts/audit-breakdown-coverage.mjs` — both must report 0 failure(s), 0 warning(s) |
| This matrix's own data | `node scripts/derive-acceptance-ownership.mjs` |

Two spellings appear in the breakdowns and are equivalent under pnpm: D1 writes `pnpm vitest run …`
and D2–D7 write `pnpm exec vitest run …`. The recorded evidence names whichever spelling its breakdown
states. Browser automation runs on the browser-recognised secure loopback origin from `DEV_PORT`
(gitignored `.env.local`, currently `5177`); that origin is permitted *in addition to* production HTTPS
evidence and never substitutes for it (`delivery-contract.md:132`).

## 6. The rows

Rows follow the acceptance contract's own grouping and order.

### 6.1 Request/response, plan, and lifecycle

#### AC-RESP-001 — accepted mutations return directly usable post-commit state

- **Vertical deliverable:** D6 completes; D2 installs the creation member, D3 the bounded
  multi-subject member, D4 the update member, D5 the Journal-outcome members.
- **Planned tasks:** D2:T15, D2:T19; D3:T16, D3:T17, D3:T22; D4:T16, D4:T17, D4:T25; D5:T3, D5:T8,
  D5:T11, D5:T17; D6:T13, D6:T14, D6:T19.
- **TDD / structural verification:** module contract tests at each coordinator seam — `confirmPlan`
  (D2:T15), `recordPositionChange` (D3:T17, D6:T14), `DailyReview.save` (D4:T16), `Journal.save` and
  `ResolveReviewDebt` (D5:T3, D5:T8, D5:T11) — each asserting the result binds the committed revisions,
  carries generated identities, the post-commit representation of every directly changed subject, and
  its related outcomes. D6:T14 adds a seam-level instrument asserting **zero** operation-required
  follow-up reads.
- **Mock-free integration case and fixture:** each deliverable's integration suite (D2:T19, D3:T22,
  D4:T25, D5:T17, D6:T19) invoked through the assembled runtime against a real `fake-indexeddb` store
  with the D2-confirmed Plan and D3 fills as the fixture; D3:T22 counts `getRecord`, `queryRecords` and
  Journal query calls at the seam. Disclosed substitution: `fake-indexeddb` only.
- **Browser-critic flow:** D2 flows 4 and 8; D3 flows 2, 5 and 7; D4 F8; D5 flow 7; D6 flow 1.
- **Command:** `pnpm exec vitest run --project integration <suite> -t "<case phrase>"`, plus the critic's
  own UI walk. See §5.
- **Expected result and durable-state proof:** the returned projection equals a fresh real read field by
  field, exact decimals included, at the returned `FactRevision`; a seam counter proves no read-back was
  required to render the change.
- **Failure / nonmutation / restart evidence:** the participant-abort cases (D2:T14, D3:T16, D6:T13)
  leave no effect; the restart leg re-reads the committed projection from a new runtime instance.
- **Status:** `covered` — D6's claim covers every mutation family installed through D6. §9 records that
  each later deliverable must re-verify it for the family it adds.

#### AC-PLAN-001 — confirmation freezes one complete Plan

- **Vertical deliverable:** D2.
- **Planned tasks:** D2:T3, T4, T6, T9, T10, T13, T14, T15, T19, T20.
- **TDD / structural verification:** `prepareChange`/`applyPreparedChange` (T2–T3), `assessPlan` shape
  and positive baseline (T5, T6), Journal `prepareEffects`/`applyPreparedEffects` for the completed
  reflection (T9, T10), orchestration and result (T13, T15), lifecycle agreement (T4, T7). Each is one
  `describe`/`it should` case per behaviour through the named seam.
- **Mock-free integration case and fixture:** D2:T19 — Node run over `fake-indexeddb` with the
  production coordinators, a real-engine browser leg, and a restart leg. Fixture: a real Account and the
  seeded Long Stock shape read from the real catalog, never a hand-written literal.
- **Browser-critic flow:** D2 flows 1, 2, 4, 8, 9, 10, 11.
- **Command:** `pnpm exec vitest run --project integration <suite> -t "<case>"`; `pnpm exec playwright
  test <spec> -g "<case>"`.
- **Expected result and durable-state proof:** one atomic commit creating the Trade, the frozen Plan and
  Planned Legs, frozen original management, stored `Planned` lifecycle, positive 1R equal to the Plan
  Baseline, and one immutable completed Plan Reflection; the Entry snapshots the exact definition shown
  and shares the semantic Thesis/Invalidation values without a second entry. Proof is the revision
  binding plus each store read back at that revision.
- **Failure / nonmutation / restart evidence:** D2:T14 aborts at the Journal participant and proves no
  Trade, Plan, lifecycle row, index entry or Entry survives; flow 9 restarts and re-reads every frozen
  value unchanged; flow 10 attempts every edit affordance and confirms nothing can rewrite them.
- **Status:** `covered` — D2.

#### AC-PLAN-002 — incomplete confirmation writes nothing

- **Vertical deliverable:** D2.
- **Planned tasks:** D2:T5, T13, T14, T19.
- **TDD / structural verification:** `assessPlan` returns typed rejections for no numeric baseline, an
  incoherent shape, missing exact/objective leg evidence and a missing required reflection answer (T5);
  orchestration returns them without staging (T13); rollback (T14).
- **Mock-free integration case and fixture:** D2:T19 — each rejection path driven through the assembled
  runtime, with Trade Record, Journal and Catalog revisions captured before and after.
- **Browser-critic flow:** D2 flows 3, 5, 6, 7, 12.
- **Command:** `pnpm exec vitest run --project integration <suite> -t "<case>"`.
- **Expected result and durable-state proof:** all issues returned as typed rejections; no Trade, no
  candidate identity, no Entry, no Debt and no index membership; unchanged revisions across all three
  modules.
- **Failure / nonmutation / restart evidence:** the assertion *is* the no-write case — before/after
  revisions plus a raw cursor walk showing no store gained or lost a record.
- **Status:** `covered` — D2.

#### AC-LIFE-001 — complete lifecycle and agreement

- **Vertical deliverable:** D6 completes; D2 owns `Planned`, D3 owns `Open`.
- **Planned tasks:** D2:T3, T4, T7, T19; D3:T9, T11, T18, T22; D6:T2, T5, T6, T13, T19, T20.
- **TDD / structural verification:** stored-versus-expected lifecycle agreement at each step (D2:T7,
  D3:T8–T11, D6:T5), index membership moving in the same commit (D3:T11, D6:T6), Terminal Disposition
  derived only from effective disposing facts and never merged with Close Reason (D6:T4, T16).
- **Mock-free integration case and fixture:** D6:T19 drives one Trade through `confirmPlan`, the
  stock-open variant, a scaling add and the terminal variant, deriving after each with the persisted
  snapshot; the D3 suite adds the open step in isolation.
- **Browser-critic flow:** D2 flow 8; D3 flows 1, 2, 4; D6 flow 5.
- **Command:** `pnpm exec vitest run --project integration <suite> -t "<case>"`.
- **Expected result and durable-state proof:** stored lifecycle `Planned`, `Open`, `Open`, `Closed` at
  the four revisions with agreement holding each time; index membership changing in the same commit;
  disposition present only after effective disposing facts.
- **Failure / nonmutation / restart evidence:** D6:T13 injects a Journal-participant failure and proves
  the lifecycle is still `Open`, the Open index still contains the Trade, and the `FactRevision` is
  unchanged; the `Closed` binding is re-read after restart.
- **Status:** `covered` — D6, which is the only deliverable where the full progression is exercisable.

#### AC-LIFE-002 — Abandonment eligibility is factual

- **Vertical deliverable:** D6 (Partial); the void-restores-eligibility clause completes at D15.
- **Planned tasks:** D6:T9, T10, T13, T14, T17, T19.
- **TDD / structural verification:** eligibility derived from effective facts on every attempt (T10),
  not from prior existence — including the case where a fully offset Execution still does not restore
  eligibility; `abandonPlan` effects and rejection (T9); atomic commit (T13); presentation (T17).
- **Mock-free integration case and fixture:** D6:T19 opens a real Trade, attempts `abandonPlan`, then
  closes the position fully and retries, asserting durable state at each step.
- **Browser-critic flow:** D6 flows 10, 11, 12, 13.
- **Command:** `pnpm exec vitest run --project integration <suite> -t "<case>"`.
- **Expected result and durable-state proof:** a never-filled Plan becomes `Abandoned` with an active
  reason and its applicable Plan Debt retired, with no Close Reason and no Terminal Disposition; a Plan
  with an effective Execution is rejected with unchanged state.
- **Failure / nonmutation / restart evidence:** the rejection leaves the `FactRevision` unchanged with no
  lifecycle row and no index movement.
- **Status:** `planned` — D6's Partial claim is real evidence for everything except "If its Execution is
  visibly Voided first, eligibility is rederived"; Trade-fact Void arrives at **D15**.

#### AC-LIFE-003 — disagreement cannot pass as Ready

- **Vertical deliverable:** D2 (stored-lifecycle half), D3 (Lot Match / Deviation half), D21 (the
  authorized-preparation half). Ownership line added to D21 in §7.
- **Planned tasks:** D2:T3, T7, T17, T19; D3:T9, T10, T19, T22. D21 has no breakdown.
- **TDD / structural verification:** a controlled integrity fixture mutates stored authoritative derived
  state under PD8 tier 2 (D2) and recorded links under PD8 tier 1 (D3), written through the real
  persistence seam and recorded alongside the correct derivation; the read surfaces or blocks on the
  structured disagreement and no read repairs it.
- **Mock-free integration case and fixture:** D2:T19 and D3:T22 — the disagreement is introduced by a
  disclosed test-only private write and asserted against a fresh derivation; the fixture records the
  expected derivation, so a tolerated disagreement would be visible.
- **Browser-critic flow:** D2 flow 8 and D6 flow 5 show stored and derived lifecycle as separate
  concepts; the disagreement state itself is not a driven critic flow.
- **Command:** `pnpm exec vitest run --project integration <suite> -t "<case>"`.
- **Expected result and durable-state proof:** before-disagreement snapshot, read result naming the
  disagreement, preparation result, and no write caused by the read.
- **Failure / nonmutation / restart evidence:** the absence of a read-time write is asserted by unchanged
  revisions across the read.
- **Status:** `planned` — the read-side halves are evidenced at D2 and D3; "the authorized preparation
  either derives a disclosed repair for coherent facts or rejects incoherent facts" is Restore's and
  completes at **D21**, which has no breakdown. D6 §8 item 2 records the unsettled ownership question
  (which module returns the blocking result, and whether the block is per-Trade or per-page).

### 6.2 Position Changes, settlement, and Rolls

#### AC-POS-001 — stock scaling and FIFO fee allocation

- **Vertical deliverable:** D3 (opening path and the whole derivation) and D6 (disposing path and
  closure). **No deliverable completes it**, by decision PD10.
- **Planned tasks:** D3:T4, T5, T6, T7, T9, T10, T11, T16, T17, T19, T22, T23; D6:T2, T5, T6, T13,
  T19, T20.
- **TDD / structural verification:** `derive` at the pure seam for positions, open Lots, FIFO links and
  realized P&L (D3:T4–T8), fee capture-and-exclusion (D3:T6), lifecycle movement (D3:T11, D6:T6),
  terminal variation (D6:T2).
- **Mock-free integration case and fixture:** D3:T22 runs the same fixture at three levels — pure
  `derive`, the Node stack, and the real browser engine — with two opening Executions at different
  prices and fees, then partial and final disposals; D6:T19 repeats the closing leg.
- **Browser-critic flow:** D3 flows 2, 3, 4; D6 flow 1.
- **Command:** `pnpm exec vitest run --project integration <suite> -t "<case>"`.
- **Expected result and durable-state proof:** each fill owned by exactly one Trade; Position and open
  Lots exact; FIFO links `{(EX-1, EX-3, 60.00, FIFO), (EX-2, EX-3, 10.00, FIFO)}` carrying no monetary
  field; partial realization leaves `Open`; final flat exposure reaches `Closed`.
- **Failure / nonmutation / restart evidence:** aborts injected at fact staging, link staging, index
  movement and Journal staging leave nothing behind (D3:T16); every value is re-derived from the re-read
  `AnalysisInput` after restart.
- **Status:** `planned` — the only clause no deliverable demonstrates is "opening/disposal fees are
  allocated exactly once": PD10 records the fee as a fact and excludes it from every calculation, so
  allocation is not installed. D3 and D6 are both Partial and **no deliverable may claim this complete**.
  Not comparable with the other seven branches on this clause.

#### AC-POS-002 — multi-leg option decision remains one Position Change

- **Vertical deliverable:** D11 — **no breakdown yet**.
- **Planned tasks:** none. No task graph exists for D11, so no `D11:T<n>` is cited.
- **TDD / structural verification:** not yet specified. D11's plan must state a multi-leg
  `recordPositionChange` case asserting one shared decision identity with stable member order and one
  Position Change Reflection outcome per decision.
- **Mock-free integration case and fixture:** not yet specified. It will need an option Strategy with
  several Planned Legs filled as one decision, driven through the production command surface.
- **Browser-critic flow:** not yet specified.
- **Command:** not yet available.
- **Expected result and durable-state proof:** all submitted members share one decision identity and
  stable order; each Execution keeps its own identity and Trade ownership; conformance is assessed
  against the Planned Legs; exactly one Reflection outcome. Proof is the Position Change membership
  record, the Execution identity rows, the derivation output and the Journal obligation key.
- **Failure / nonmutation / restart evidence:** not yet specified; the scenario's own evidence list does
  not require a no-write case.
- **Status:** `planned` — D11 owns it (`vertical-deliverables.md:245-261`), no evidence exists yet.

#### AC-POS-003 — partial Roll preserves ownership and lineage

- **Vertical deliverable:** D13 — **no breakdown yet**.
- **Planned tasks:** none.
- **TDD / structural verification:** not yet specified. D13 must carry the Roll variant of
  `recordPositionChange`, the successor Plan confirmed in the same transaction, and typed
  predecessor/successor lineage.
- **Mock-free integration case and fixture:** not yet specified; needs an Open predecessor with more
  quantity than is rolled plus a complete successor Plan.
- **Browser-critic flow:** not yet specified.
- **Command:** not yet available.
- **Expected result and durable-state proof:** untouched predecessor holdings remain in the predecessor;
  new Executions belong only to the successor; lineage, successor frozen baseline, required Plan
  Reflection and one originating-Trade Reflection commit atomically; one receipt.
- **Failure / nonmutation / restart evidence:** the atomicity clause implies a rollback case; not yet
  specified.
- **Status:** `planned` — D13 owns it. PD12's guard applies here: **a Roll is never inferred from the
  `Rolled` Close Reason**; Roll semantics come from typed lineage (forward obligation 8). PD11 applies
  too: a Roll's closing leg derives mechanism `Execution` while its Close Reason is `Rolled`, which is
  the case D13 must carry (forward obligation 7).

#### AC-SET-001 — Assignment/Exercise allocation and basis

- **Vertical deliverable:** D10 — **no breakdown yet**.
- **Planned tasks:** none.
- **TDD / structural verification:** not yet specified. D10 must cover explicit Assignment/Exercise with
  a Settlement Price kept separate from adjusted basis and proceeds, option premium applied exactly once,
  and settlement recorded as something other than a zero-price Execution.
- **Mock-free integration case and fixture:** not yet specified; needs physical settlement producing
  Stock exposure, one compatible existing Stock Trade, and a quantity that differs from the allocation.
- **Browser-critic flow:** not yet specified.
- **Command:** not yet available.
- **Expected result and durable-state proof:** the specified quantity updates the existing Stock Trade;
  only residual exposure creates a successor; all linked Trades update atomically; basis and proceeds
  reconcile with the premium once. Proof is the settlement/allocation facts, linked Trade identities and
  the atomic receipt.
- **Failure / nonmutation / restart evidence:** the linked-Trade atomicity implies a rollback case at
  D10 (and `AC-CORR-004` at D15/D16 is the correction-side counterpart).
- **Status:** `planned` — D10 owns it. PD10's exclusion applies: no fee-adjusted basis or proceeds.

#### AC-SET-002 — allocation is never guessed

- **Vertical deliverable:** D10 — **no breakdown yet**.
- **Planned tasks:** none.
- **TDD / structural verification:** not yet specified; the case must assert a bounded eligible set
  returned as `Needs Resolution` rather than a chosen destination.
- **Mock-free integration case and fixture:** not yet specified; needs a settlement that could apply to
  several eligible Stock Trades with no destination supplied.
- **Browser-critic flow:** not yet specified.
- **Command:** not yet available.
- **Expected result and durable-state proof:** the bounded list of eligible stable identities is returned
  as Needs Resolution, and **no** Trade, settlement, Entry, Debt, lifecycle or lineage write occurs.
- **Failure / nonmutation / restart evidence:** this row *is* a no-write claim: unchanged revisions
  across every affected module, compared before and after.
- **Status:** `planned` — D10 owns it; no evidence exists yet.

#### AC-SET-003 — Expiration is explicit

- **Vertical deliverable:** D10 — **no breakdown yet**.
- **Planned tasks:** none.
- **TDD / structural verification:** not yet specified. The case must prove that a passed expiration
  date with no recorded outcome derives no Expiration fact and no `Closed` lifecycle, and that Review
  stays incomplete.
- **Mock-free integration case and fixture:** not yet specified; needs an option contract past its
  expiration with no settlement outcome.
- **Browser-critic flow:** not yet specified. D4's Settlement Due blocker (`DailyReview.open`) is the
  read-side half that exists today.
- **Command:** not yet available.
- **Expected result and durable-state proof:** no inferred fact and no inferred closure; Settlement Due
  is shown and Review remains incomplete until an explicit Expiration/Assignment/Exercise/cash-settlement
  Position Change is recorded.
- **Failure / nonmutation / restart evidence:** before/after facts around the read, plus the explicit
  settlement receipt on the positive path.
- **Status:** `planned` — D10 owns it. The reporting half is real at D4 (`AC-REV-006`); the recording half
  does not exist.

#### AC-POS-004 — terminal agency requires one Close Reason

- **Vertical deliverable:** D6 (trader-directed half, Partial); D10 (non-agency half — named only in D6
  §8, and **not** on D10's `AC:` line); D13 (the Roll close that must carry `Rolled`, per the map's
  `AC:` line, with no breakdown). See §7 item 6.
- **Planned tasks:** D6:T3, T4, T6, T7, T8, T13, T19, T20. D10 and D13 have no breakdowns.
- **TDD / structural verification:** exactly one active Close Reason required when trader agency is
  present, and none manufactured otherwise (D6:T3); Terminal Disposition derived from actual mechanisms
  (D6:T4); Close Review never blocking closure (D6:T8).
- **Mock-free integration case and fixture:** D6:T19 submits three terminal commands — no reason, two
  reasons, exactly one — against otherwise identical open Trades and asserts unchanged state for the two
  rejections; D6:T4's case already mixes a trader-directed and an explicit settlement member.
- **Browser-critic flow:** D6 flows 1, 2, 3, 5, 6.
- **Command:** `pnpm exec vitest run --project integration <suite> -t "<case>"`.
- **Expected result and durable-state proof:** one reason required on the trader-directed exit, none on
  non-agency settlement; disposition derived from mechanisms on both; completion, decline or deferral of
  the Close Review never blocks the close.
- **Failure / nonmutation / restart evidence:** the two rejection cases leave the durable state unchanged
  at the same `FactRevision`, with no lifecycle row and no index membership.
- **Status:** `planned` — the row is **Partial at D6** (this is the stale-prose defect corrected in §7
  item 1, not a status change) and the non-agency settlement half needs explicit settlement facts at
  **D10**; D13 exercises the trader-directed clause again on a Roll close but does not complete it.
  PD12 applies: `Rolled` is selectable at D6 with no Roll lineage, which is inert because no derived
  value reads a Close Reason.

#### AC-POS-005 — Planned-Leg fulfillment is evidence-bound

- **Vertical deliverable:** D12 — **no breakdown yet**.
- **Planned tasks:** none.
- **TDD / structural verification:** not yet specified. The cases must distinguish Partially Filled,
  Filled With Deviation, Unplanned Exposure, Not Entered and Not Verifiable, and must assert one
  Planned-Leg Terms occurrence per served leg and no inferred intent from mismatched terms alone.
- **Mock-free integration case and fixture:** not yet specified; needs partial fills serving one leg, a
  mismatched exact contract, an explicitly Unplanned hedge, an untouched leg at close, and one objective
  selector with absent observation evidence.
- **Browser-critic flow:** not yet specified.
- **Command:** not yet available.
- **Expected result and durable-state proof:** frozen selectors and provenance, intent associations,
  per-leg results and occurrence fingerprints.
- **Failure / nonmutation / restart evidence:** the Not Verifiable case is itself the negative case:
  missing evidence creates neither assumed conformance nor a Deviation.
- **Status:** `planned` — D12 owns it; no evidence exists yet.

#### AC-SET-004 — settlement planning and later management are distinct

- **Vertical deliverable:** D10 — **no breakdown yet**.
- **Planned tasks:** none.
- **TDD / structural verification:** not yet specified. Cases must separate short-option planned
  settlement from voluntary Exercise Intent, and must create Management Debt for settlement-created
  Stock exposure.
- **Mock-free integration case and fixture:** not yet specified; needs a physically settled short-option
  Plan, long-option Plans with and without Exercise Intent, and settlement-created unmanaged Stock.
- **Browser-critic flow:** not yet specified.
- **Command:** not yet available.
- **Expected result and durable-state proof:** planned-settlement intent for the short obligation, advance
  authorization only where Exercise Intent exists, unplanned automatic exercise still recorded with
  Exercise lineage, Management Debt created atomically with the new Stock exposure, and no Stock
  successor for a cash settlement.
- **Failure / nonmutation / restart evidence:** the atomic receipt covers the Debt creation; no separate
  no-write case is required by the scenario.
- **Status:** `planned` — D10 owns it. Forward obligations 2–5 constrain the shape it must use.

### 6.3 Corrections and audit

#### AC-CORR-001 — Replace preserves fact identity

- **Vertical deliverable:** D15 — **no breakdown yet**.
- **Planned tasks:** none.
- **TDD / structural verification:** not yet specified. D15 owns `previewCorrection`/`commitCorrection`,
  `assessChange`, the Correction Footprint and anchor survival; the cases must prove a version under the
  same identity rather than a new fact.
- **Mock-free integration case and fixture:** not yet specified; needs an effective Execution with
  anchored Journal evidence, corrected through preview and commit.
- **Browser-critic flow:** not yet specified.
- **Command:** not yet available.
- **Expected result and durable-state proof:** the same Execution identity gains an immutable version;
  corrected economics apply at corrected Economic Time; prior value, reason and save time remain in View
  history; the Anchor remains attached; lifecycle, Lot Matches, fees, P&L, Deviations and reports
  reconcile atomically.
- **Failure / nonmutation / restart evidence:** the preview footprint must show no write before commit;
  the version chain is re-read after restart.
- **Status:** `planned` — D15 owns it. PD10 applies: a correction recomputes no fee allocation.

#### AC-CORR-002 — Void is visible and economically effective

- **Vertical deliverable:** D15 — **no breakdown yet**.
- **Planned tasks:** none.
- **TDD / structural verification:** not yet specified; the Void variant of `commitCorrection` must keep
  identity and history visible while removing economic effect, in one commit.
- **Mock-free integration case and fixture:** not yet specified; needs an effective fact whose removal
  changes exposure or lifecycle.
- **Browser-critic flow:** not yet specified. D5's obligation-resolution Void is the journal-side
  precedent already installed.
- **Command:** not yet available.
- **Expected result and durable-state proof:** audit/history keeps the fact addressable with its reason;
  corrected replay, lifecycle/index, Journal narrative and correction footprint agree; no record is
  physically deleted.
- **Failure / nonmutation / restart evidence:** "no record is physically hidden or deleted" is asserted
  from the durable store, not from the UI.
- **Status:** `planned` — D15 owns it; no evidence exists yet.

#### AC-CORR-003 — Rebuild keeps Trade identity and historical Anchors

- **Vertical deliverable:** D16 — **no breakdown yet**.
- **Planned tasks:** none.
- **TDD / structural verification:** not yet specified; the Rebuild variant of `commitCorrection` must
  preserve Trade identity while reconstructed facts receive new identities, with old Anchors resolving as
  historical and never silently redirected.
- **Mock-free integration case and fixture:** not yet specified; needs a Trade needing reconstruction with
  Journal Entries anchored to old Executions.
- **Browser-critic flow:** not yet specified.
- **Command:** not yet available.
- **Expected result and durable-state proof:** identity comparison, old and new fact sets, anchor
  resolution, narrative and replay; one corrected economic history plus visible audit.
- **Failure / nonmutation / restart evidence:** superseded facts must remain addressable after restart.
- **Status:** `planned` — D16 owns it. Forward obligation 9 asks whether `prepareChange` validates the
  base state or the candidate, which decides whether a fact written wrongly by a buggy release can ever
  be repaired.

#### AC-CORR-004 — linked correction is all-or-nothing

- **Vertical deliverable:** D15 and D16 — **no breakdowns yet**.
- **Planned tasks:** none.
- **TDD / structural verification:** not yet specified. The failing case must inject a stale linked
  revision and a Journal participant rejection; the successful case must commit every linked fact.
- **Mock-free integration case and fixture:** not yet specified; needs an Assignment/Exercise/Roll
  correction affecting multiple Trades and capable of reopening one.
- **Browser-critic flow:** not yet specified.
- **Command:** not yet available.
- **Expected result and durable-state proof:** failing and successful executions recorded with all
  participant revisions; every effect rolls back on either fault; with valid bindings all linked facts,
  lifecycle/index changes, lot/deviation reconciliation and Journal consequences commit together.
- **Failure / nonmutation / restart evidence:** the failure leg compares every participant's revision
  against its pre-command value.
- **Status:** `planned` — D15 and D16 own it; no evidence exists yet.

#### AC-CORR-005 — preview is nonmutating and evidence-bound

- **Vertical deliverable:** D15 — **no breakdown yet**.
- **Planned tasks:** none.
- **TDD / structural verification:** not yet specified; preview must report affected
  identities/intervals/calculations/coverage and write nothing, and a stale commit must be rejected.
- **Mock-free integration case and fixture:** not yet specified; needs a material fact or Mark correction
  with evidence changing between preview and commit.
- **Browser-critic flow:** not yet specified. D18's `previewMarkChange` is the read-side sibling.
- **Command:** not yet available.
- **Expected result and durable-state proof:** preview digest and footprint over unchanged state; changed
  evidence produces a conflict; a new preview is required before commit.
- **Failure / nonmutation / restart evidence:** unchanged state after preview and after the rejected
  stale commit, compared by revision.
- **Status:** `planned` — D15 owns it; no evidence exists yet.

### 6.4 Journal and behavioral evidence

#### AC-JOUR-001 — only Save captures evidence

- **Vertical deliverable:** D5 completes; D2 installs the confirmation-form half.
- **Planned tasks:** D2:T16, T19; D5:T3, T4, T5, T6, T14, T15, T17.
- **TDD / structural verification:** form components and the save seam assert that open, type, select,
  resize and navigate-away store nothing — no Entry, version, Action, Debt, decline, draft or keystroke
  evidence (D2:T16, D5:T14–T15); the save path is the only writer.
- **Mock-free integration case and fixture:** D5:T17 drives open/type/leave through the production stack
  and asserts an unchanged Journal query; D2:T19 does the same for the confirmation form.
- **Browser-critic flow:** D2 flow 12; D5 flow 9; D4 F9.
- **Command:** `pnpm exec vitest run --project integration <suite> -t "<case>"`; `pnpm exec playwright
  test <spec> -g "<case>"`.
- **Expected result and durable-state proof:** entered view state may survive the active workflow, but
  the Journal query before and after (across a restart) is identical.
- **Failure / nonmutation / restart evidence:** the restart is the evidence: the unchanged query is
  repeated after a full stop and reopen.
- **Status:** `covered` — D5. D17 later adds standalone journal forms, which must re-verify the same
  property for their own surfaces (§9).

#### AC-JOUR-002 — Edit, Addendum, and Void retain distinct meanings

- **Vertical deliverable:** D17 — **no breakdown yet**.
- **Planned tasks:** none. D5 installs Edit, Addendum and Void for the Entry Types it owns (D5:T4, T5,
  T6, T13), but D17 owns the standalone journal and the full history/timeline surface.
- **TDD / structural verification:** not yet specified at D17. The property is already proved for
  review-side Entries by D5:T4 (version under the same identity, original definition snapshot), D5:T5
  (new identity, preserved Anchor and parent link, actual Source/time/form) and D5:T6 (visible reasoned
  Void, nothing deleted).
- **Mock-free integration case and fixture:** D5:T17 exercises create → edit → addendum → void through
  the real save seam and re-reads the version chain after restart.
- **Browser-critic flow:** D5 flows 5 and 10; D17's flows do not exist.
- **Command:** `pnpm exec vitest run --project integration <suite> -t "<case>"` for the D5 half.
- **Expected result and durable-state proof:** identities, version chains, definition snapshots,
  parent/Anchor links, Sources and the Timeline projection exposing each transition.
- **Failure / nonmutation / restart evidence:** the version chain and the Void reason are re-read after
  restart in D5:T17; the "nothing deleted" assertion is on the store.
- **Status:** `planned` — D17 owns the scenario, which also requires the standalone journal surface; D5's
  evidence covers only review-side Entries.

#### AC-JOUR-003 — Debt is not an incomplete Entry

- **Vertical deliverable:** D5 completes; D3 installs Defer, D4 the due blocker.
- **Planned tasks:** D3:T12, T13, T14, T20, T22; D4:T20; D5:T2, T7, T8, T10, T11, T12, T17.
- **TDD / structural verification:** `Defer` creates exactly one Outstanding Debt with the trigger-time
  form snapshot (D3:T14); no blank Entry exists (D3:T12); due Debt blocks Review completion (D4:T20,
  D5:T12) and never blocks later factual recording (D5).
- **Mock-free integration case and fixture:** D3:T22 records a Position Change with `Defer` in one
  semantic transaction and re-reads after restart; D5:T17 resolves, declines and reopens the same Debt.
- **Browser-critic flow:** D3 flow 7; D4 F1; D5 flows 1, 7.
- **Command:** `pnpm exec vitest run --project integration <suite> -t "<case>"`.
- **Expected result and durable-state proof:** the factual Position Change stands; exactly one
  Outstanding Debt carries the snapshotted definition revision and origin; no placeholder Entry exists;
  a later factual record still succeeds while the Debt is due.
- **Failure / nonmutation / restart evidence:** restart re-reads the Debt and the absence of an Entry.
- **Status:** `covered` — D5, which is the completing owner because D3's Defer and D4's due-banking
  precede it.

#### AC-JOUR-004 — definition changes are prospective

- **Vertical deliverable:** D17 — **no breakdown yet**.
- **Planned tasks:** none. D5 proves the prospective property for one Entry Type through its snapshot
  validation (D5:T8, T13), but the definition-revision surface is D17's `reviseDefinition`.
- **TDD / structural verification:** not yet specified at D17. D5:T8's case already answers an old form
  against its original revision and asserts the stored snapshot keeps the old labels and order.
- **Mock-free integration case and fixture:** D5:T17 seeds, revises, re-seeds and re-reads snapshots.
- **Browser-critic flow:** D5 flow 3, which opens the exact stored form of a Debt and answers it against
  its original snapshot.
- **Command:** `pnpm exec vitest run --project integration <suite> -t "<case>"` for the D5 half.
- **Expected result and durable-state proof:** new forms use the new definition; existing Entries and
  Debts retain their labels, order and options; a Debt answer is validated and stored against its own
  revision; the fixed Entry Type identity never changes.
- **Failure / nonmutation / restart evidence:** both definitions and the resulting Entry/Debt snapshots
  are re-read after restart.
- **Status:** `planned` — D17 owns it; D5 evidences only prospective effect for one Entry Type.

#### AC-JOUR-005 — one obligation has one explicit outcome

- **Vertical deliverable:** D5.
- **Planned tasks:** D5:T6, T7, T8, T9, T11, T17.
- **TDD / structural verification:** one current outcome per obligation key across completion, decline,
  outstanding Debt and valid retirement (T7); retries and concurrent submissions conflict rather than
  duplicating (T7, T11); Voiding the sole settlement Entry reopens the original Debt atomically (T6, T7).
- **Mock-free integration case and fixture:** D5:T17 drives defer → resolve → void → re-read through the
  real stack, calling `Journal.query` by obligation key before, between and after.
- **Browser-critic flow:** D5 flows 3, 4, 10.
- **Command:** `pnpm exec vitest run --project integration <suite> -t "<case>"`.
- **Expected result and durable-state proof:** obligation-key query returns exactly one of the four
  outcomes at every step; the reopened Debt is the **same identity** with its **original due time**
  (PD13), so it is due at the next cutoff.
- **Failure / nonmutation / restart evidence:** retries are asserted to conflict with unchanged history;
  the sequence is re-read after restart.
- **Status:** `covered` — D5.

#### AC-JOUR-006 — workflow-routed Debt cannot be settled with prose

- **Vertical deliverable:** D17 — **no breakdown yet**. D5 installs the refusal, D14 the workflow.
- **Planned tasks:** none — D17 has no breakdown. D5:T10 and T11 return `NeedsTradeWorkflow` for a
  workflow-routed Management Debt and write nothing; the Management Revision workflow that completes it
  is D14's.
- **TDD / structural verification:** not yet specified at D17/D14. The refusal half is a D5 contract
  case: direct resolution returns the exact required Trade Workflow and writes nothing.
- **Mock-free integration case and fixture:** D5:T17 includes the refusal case; the completing workflow
  case needs D14's Management Revision.
- **Browser-critic flow:** D5 flow 6 attempts direct resolution of a workflow-routed Debt.
- **Command:** `pnpm exec vitest run --project integration <suite> -t "<case>"` for the refusal half.
- **Expected result and durable-state proof:** the no-write result names the required workflow; completing
  that workflow commits management facts, the completed Entry and the Debt settlement/retirement
  atomically.
- **Failure / nonmutation / restart evidence:** the refusal case asserts unchanged revisions; the atomic
  commit needs D14.
- **Status:** `planned` — D17 owns it; the refusal is real at D5, the workflow and atomic settlement are
  not installed.

#### AC-JOUR-007 — fixed types, runtime forms, and defaults

- **Vertical deliverable:** D17 completes; D2 installs the first two definitions and D3–D6 grow the set.
- **Planned tasks:** D2:T8, T11, T19; D3:T13, T22; D4:T21, T25; D5:T13, T17; D6:T11, T12, T19.
- **TDD / structural verification:** idempotent, stable-keyed, atomic seeding with the exact initial
  definition and workflow-critical roles (D2:T11, D3:T13, D4:T21, D5:T13, D6:T12); definition reads
  normalized by stable identity and order, never by label (D2:T8).
- **Mock-free integration case and fixture:** each seed task runs `seedDefaults` twice through the real
  `Workspace.initialize` path against a migrated store and compares the normalized identity/definition
  manifest before and after.
- **Browser-critic flow:** D2 flow 2 shows the selector scope; D6 flow 4 shows the reason selector
  contents.
- **Command:** `pnpm exec vitest run --project integration <suite> -t "<case>"`.
- **Expected result and durable-state proof:** the seven fixed Entry Types and seven Sources exist under
  stable product identities with their exact Prompts, options, order, requiredness/conditional rules,
  scale bounds and workflow roles; repeat seeding is idempotent and never overwrites a revision.
- **Failure / nonmutation / restart evidence:** the second seed's no-write assertion is the evidence; the
  manifest is re-read after restart.
- **Status:** `planned` — D17 completes it. Real evidence today covers the Plan Reflection, Position
  Change Reflection, Daily Trade Review, Review Note, Trader Reflection and Close Review types and the
  four Sources seeded through D6; the remaining types and Sources, and the complete manifest, are D17's.

### 6.5 Daily Review

#### AC-REV-001 — exact-date corrected eligibility

- **Vertical deliverable:** D4 (Partial); the later-closed fixture is D6's and the corrected-membership
  clause is D15's.
- **Planned tasks:** D4:T9, T13, T14, T22, T25, T26.
- **TDD / structural verification:** `StateAtEconomicCutoff(Open)` derives eligibility from corrected
  effective facts at an earlier completed-session cutoff rather than from current Open membership or a
  saved Review list (T9); the walk and the shared-Mark resolution read that batch (T13, T14).
- **Mock-free integration case and fixture:** D4:T25 opens an exact earlier cutoff with a seeded
  correction already in the store and captures the returned `AnalysisInput` batch plus counted storage
  requests; a Trade opened after the cutoff must not appear.
- **Browser-critic flow:** D4 F2.
- **Command:** `pnpm exec vitest run --project integration <suite> -t "<case>"`.
- **Expected result and durable-state proof:** cutoff queries before and after a correction restate
  membership and progress; the Review list and its bindings reflect the corrected facts.
- **Failure / nonmutation / restart evidence:** the read performs no write; the corrected-membership
  assertion is repeated after a process restart.
- **Status:** `planned` — D4's slice is real (cutoff-based, not saved-list-based eligibility); the
  later-closed Trade fixture is **D6**'s and "correction may restate membership" is **D15**'s.

#### AC-REV-002 — task ordering and bounded resumption

- **Vertical deliverable:** D4 owns the family order and the walk; D10 owns settlement members.
- **Planned tasks:** D4:T13, T14, T15, T22, T25; D5:T2, T10, T12, T17.
- **TDD / structural verification:** the normative family order Mark, Debt, settlement, Trade (T13); the
  shared-Mark resolution once for all affected Trades (T14); bound view state and Hold preselection
  (T15); no Review Session, finish flag or placeholder (T22).
- **Mock-free integration case and fixture:** D4:T25 seeds a shared Missing Mark, one due Debt, one
  settlement-due Trade and four eligible Trades; D4:T14's case resolves the shared requirement and
  reopens the same exact date after a process restart.
- **Browser-critic flow:** D4 F1, F3, F13.
- **Command:** `pnpm exec vitest run --project integration <suite> -t "<case>"`.
- **Expected result and durable-state proof:** the four families appear in order; one shared Mark
  resolution updates every affected Trade; saved outcomes resume from facts after a stop and reopen; no
  Review Session, finish flag or placeholder exists in storage.
- **Failure / nonmutation / restart evidence:** the restart leg is the evidence, and a storage/audit
  inspection confirms the absence of a session record.
- **Status:** `planned` — D4 claims this `Covered` and the claim is not withdrawn here, but the
  scenario's Given requires **Settlement Due** members, and no fact can produce one before `AC-SET-003`
  exists at **D10**; the family order is therefore exercised with an empty settlement family. §7 records
  the divergence. PD14 does not affect this row: the scenario pins the family order only, never the
  within-family Trade order.

#### AC-REV-003 — one-click Hold still requires Save

- **Vertical deliverable:** D4.
- **Planned tasks:** D4:T15, T16, T18, T20, T23, T25.
- **TDD / structural verification:** Hold preselected only as unsaved view state (T15); one Save creates
  exactly one dated Entry (T16); Exit/Roll/Adjust require Intent and save intent only (T18).
- **Mock-free integration case and fixture:** D4:T25 opens a new Action form, leaves it, then presses Save
  unchanged, and records the Entry and the unchanged Trade facts.
- **Browser-critic flow:** D4 F8, F9, F10.
- **Command:** `pnpm exec vitest run --project integration <suite> -t "<case>"`.
- **Expected result and durable-state proof:** leaving writes no Action and the Review stays incomplete;
  one Save creates exactly one Hold Entry; Exit/Roll/Adjust without Intent reject and with Intent save
  intent only, creating no Trade fact.
- **Failure / nonmutation / restart evidence:** before/after Action query, validation result, and
  unchanged Trade facts; the saved Entry and its snapshot are re-read after restart.
- **Status:** `covered` — D4.

#### AC-REV-004 — Action and Stop Deviation reconcile atomically

- **Vertical deliverable:** D4.
- **Planned tasks:** D4:T12, T16, T19, T25.
- **TDD / structural verification:** `replay` produces stable Stop-Discipline episode fingerprints (T12);
  the atomic reconciliation creates, retains, supersedes or Voids occurrences with the Action (T19).
- **Mock-free integration case and fixture:** D4:T25 saves an Action for a Trade with one newly observed
  breach and asserts both the Entry and the Deviation occurrence are durable after a reopen; a
  fault-injection variant fails the Journal participant and asserts neither survives.
- **Browser-critic flow:** D4 F11.
- **Command:** `pnpm exec vitest run --project integration <suite> -t "<case>"`.
- **Expected result and durable-state proof:** one continuous episode only, with occurrence
  fingerprint/history, the dated Action, and no separate explanation Debt or Entry Type.
- **Failure / nonmutation / restart evidence:** the injected Journal-participant failure leaves neither
  effect; the occurrence is re-read after restart.
- **Status:** `covered` — D4. This is the only Deviation category installed here; the other three arrive
  at D11/D12/D13.

#### AC-REV-005 — changed evidence prevents stale Save

- **Vertical deliverable:** D4.
- **Planned tasks:** D4:T7, T17, T20, T25.
- **TDD / structural verification:** the five required bindings are captured at prepare time (T16) and
  re-checked at Save, returning `ReviewChanged`/`Conflict` with refreshed evidence (T17).
- **Mock-free integration case and fixture:** D4:T25 prepares an Action, then mutates the store between
  preparation and Save in three separate runs — a Mark, a Trade fact correction, a competing Action — and
  asserts the conflict and the unchanged histories.
- **Browser-critic flow:** D4 F11 (Save path) and the conflict view in F12's family; the stale case itself
  is not a driven critic flow.
- **Command:** `pnpm exec vitest run --project integration <suite> -t "<case>"`.
- **Expected result and durable-state proof:** every stale binding is reported with refreshed evidence and
  both the Journal and Trade Record histories are byte-identical afterwards.
- **Failure / nonmutation / restart evidence:** the byte-identical assertion is the evidence; the binding
  is re-accepted only after a new read.
- **Status:** `covered` — D4.

#### AC-REV-006 — completion states are honest and reversible

- **Vertical deliverable:** D5 completes the reversal; D4 derives the states.
- **Planned tasks:** D4:T4, T6, T14, T16, T17, T19, T20, T25; D5:T6, T7, T8, T9, T11, T12, T17.
- **TDD / structural verification:** `Complete`, `CompleteWithUnavailableMarks` and `Incomplete` derived
  each time from facts (D4:T20); a Missing current Mark keeps the date Incomplete; Voiding the Action
  Entry reopens the obligation (D5:T6, T7); completion re-derived from durable facts (D5:T12).
- **Mock-free integration case and fixture:** D4:T25 derives completion in four states; D5:T17 observes
  `Incomplete` with the Debt named, resolves it, observes the honest completed state, then Voids the
  settlement Entry, restarts, and observes the date return to `Incomplete` with the reopened Debt.
- **Browser-critic flow:** D4 F12; D5 flows 7 and 10.
- **Command:** `pnpm exec vitest run --project integration <suite> -t "<case>"`.
- **Expected result and durable-state proof:** the completion structure and its named affected
  Instruments/Trades/calculations at each step; history is never erased by the reversal.
- **Failure / nonmutation / restart evidence:** the restart between Void and final derivation proves the
  state is derived from durable facts, not cached.
- **Status:** `planned` — D5 claims this `Covered` and the Void-of-an-Action clause is genuinely proved
  there, but the scenario's own clause "**or correcting facts** can make a past date Incomplete again"
  arrives at **D15**, as D5's row states. §7 records the divergence.

#### AC-MARK-001 — prior completed session is normal evidence

- **Vertical deliverable:** D4.
- **Planned tasks:** D4:T5, T6, T22, T25.
- **TDD / structural verification:** Expected Mark Date is the latest completed regular session from the
  versioned calendar and the injected Clock (T5); Expected-Mark Status resolves Available versus Stale
  context (T6).
- **Mock-free integration case and fixture:** D4:T25 seeds a normal Monday session with a Monday exact
  Mark and reads the frame at Tuesday noon; the calendar and clock are injected, never the host clock.
- **Browser-critic flow:** D4 F4 (Manual Mark for an expected date) and F7.
- **Command:** `pnpm exec vitest run --project integration <suite> -t "<case>"`.
- **Expected result and durable-state proof:** Expected Mark Date is Monday and the status is Available,
  not Stale; a Friday Mark is Stale context only when Monday evidence is absent.
- **Failure / nonmutation / restart evidence:** no write occurs on this read path; the frame is re-read
  after restart.
- **Status:** `covered` — D4.

### 6.6 Market evidence

#### AC-MARK-002 — Manual Mark is sticky

- **Vertical deliverable:** D8 — **no breakdown yet**.
- **Planned tasks:** none. Manual precedence is installed and asserted at D4 (T2, T3, T6); the provider
  recovery that must not replace it is D8's.
- **TDD / structural verification:** not yet specified at D8. D4:T3 already classifies valuation override
  versus correction-with-reason, and D4:T2 asserts the durable effective head and revision chain.
- **Mock-free integration case and fixture:** D4:T25 asserts the override's durable head; a D8 case must
  add a provider close arriving afterwards for the same key.
- **Browser-critic flow:** D4 F4; the provider-recovery surface does not exist.
- **Command:** `pnpm exec vitest run --project integration <suite> -t "<case>"` for the D4 half.
- **Expected result and durable-state proof:** Manual remains the effective Mark and no provider revision
  replaces it; the independent Daily Bar may refresh; Mark and Bar revision chains identify the
  override/correction meaning.
- **Failure / nonmutation / restart evidence:** the revision chain is the evidence; it is re-read after
  restart.
- **Status:** `planned` — D8 owns the recovery half; the Manual-precedence half is installed at D4.

#### AC-MARK-003 — acknowledgment never becomes a price

- **Vertical deliverable:** **none named.** The nearest candidates are D4 (assert and withdraw an
  acknowledgment, and its presentation) and D8 (provider recovery and a later exact Mark). No `AC:` line
  in `vertical-deliverables.md` names this scenario, and no breakdown claims it.
- **Planned tasks:** none. D4:T4 installs assert/withdraw with history, and D4:T21/T22 present the status;
  no task anywhere in D1–D7 is written against this scenario.
- **TDD / structural verification:** the installed part is a D4 contract case: an acknowledgment is
  distinguishable from a price, dependent figures read Unavailable with the exact Instrument and date,
  withdrawing returns the key to Missing, and the acknowledgment remains visible in history.
- **Mock-free integration case and fixture:** D4:T25 seeds one acknowledged key; the required
  "an exact Mark later arrives" leg cannot be exercised until a provider or a later Mark path exists.
- **Browser-critic flow:** D4 F5 covers assert-withdraw and the not-a-price presentation.
- **Command:** `pnpm exec vitest run --project integration <suite> -t "<case>"` for the D4 half only.
- **Expected result and durable-state proof:** status changes from Acknowledged Unavailable (with optional
  Stale context) to Available when an exact Mark arrives; calculations remain unavailable before it;
  acknowledgment history remains; a provider error alone never creates an acknowledgment.
- **Failure / nonmutation / restart evidence:** history and the unavailable calculation are re-read after
  restart; the recovery leg does not exist.
- **Status:** `planned` — **unowned gap.** Recorded deliberately rather than assigned: assigning it would
  be a coverage change to a reviewed breakdown (a new §5 row plus task evidence), and the recovery leg it
  needs is D8's in any case. §7 records the candidate owners and what Phase 6 must decide.

#### AC-MARK-004 — series preserve gaps

- **Vertical deliverable:** D18 — **no breakdown yet**.
- **Planned tasks:** none.
- **TDD / structural verification:** not yet specified. D18 owns `ReadSeries`/`InspectObservations` and
  the rule that a gap is rendered as a gap, never interpolated or carried forward.
- **Mock-free integration case and fixture:** not yet specified; needs a completed-session range with an
  interior missing date, a close-only Mark date and a Daily Bar date.
- **Browser-critic flow:** not yet specified. This is one of the two chart-gap states D1–D7 defer
  `AC-UI-002` to.
- **Command:** not yet available.
- **Expected result and durable-state proof:** the range returns an explicit gap, a point and a candle
  respectively; no fabricated candle exists; historical gaps do not block today's Review.
- **Failure / nonmutation / restart evidence:** the returned coverage is the evidence; the rendered chart
  must expose a textual equivalent.
- **Status:** `planned` — D18 owns it; no evidence exists yet.

#### AC-MARK-005 — provider recovery is partial and nonbehavioral

- **Vertical deliverable:** D8 — **no breakdown yet**.
- **Planned tasks:** none. D4:T8 installs `recover` honestly returning `NotConfigured` with Manual tasks
  while no provider exists.
- **TDD / structural verification:** not yet specified. D8 owns the `PricingProvider` adapter and
  `MarketData.recover`/`configureProvider`; the absent-provider behavior is already proved at D4:T8.
- **Mock-free integration case and fixture:** not yet specified; needs bounded relevance requirements with
  Manual keys, acknowledgments, unsupported contracts and a partial provider response.
- **Browser-critic flow:** not yet specified; D4 lists "no provider recovery" as an intentional
  non-defect.
- **Command:** not yet available.
- **Expected result and durable-state proof:** only valid eligible provider observations are appended;
  Manual keys are skipped; acknowledgments remain recoverable gaps; current Missing keys become Manual
  tasks; failures are transient diagnostics that create no Journal or provider-performance facts.
- **Failure / nonmutation / restart evidence:** Journal invariance across a failed recovery is the
  evidence.
- **Status:** `planned` — D8 owns it. Forward obligation 4 records that D4's `D4:T8` edge is declared
  against D1:T7 and restated until D8 supplies the port.

#### AC-MARK-006 — Daily Bar range evidence is honest

- **Vertical deliverable:** D18 — **no breakdown yet**.
- **Planned tasks:** none.
- **TDD / structural verification:** not yet specified. D18 owns Daily Bar use rules and the
  synchronized-same-date-Mark rule for multi-Instrument structures.
- **Mock-free integration case and fixture:** not yet specified; needs a long condition, a short condition
  and a multi-Instrument structure whose Bars have intraday extrema at different times.
- **Browser-critic flow:** not yet specified.
- **Command:** not yet available.
- **Expected result and durable-state proof:** the long uses each same-date high, the short each same-date
  low, and the structure uses synchronized same-date exact Marks rather than combining independent
  extrema; exact Mark is the close-only fallback; a gap proves no breach, recovery or new extreme.
- **Failure / nonmutation / restart evidence:** the chosen evidence per date and the episode set are the
  proof; a gap must not be read as evidence.
- **Status:** `planned` — D18 owns it; no evidence exists yet.

### 6.7 Risk, valuation, and payoff

#### AC-CALC-001 — frozen baseline and Entry Quality

- **Vertical deliverable:** D14 — **no breakdown yet**. The frozen baseline half is D2's and the
  Entry-Resolution-Point half is D3's.
- **Planned tasks:** none at D14. D2:T6 freezes the baseline and positive 1R; D3:T8 records the Entry
  Resolution Point; D4:T11 evaluates current risk against effective management.
- **TDD / structural verification:** not yet specified at D14. Installed and proved today: the baseline
  is immutable across restart (D2:T6, flow 9), and the Entry Resolution Point is the exact instant before
  the first disposal (D3:T8).
- **Mock-free integration case and fixture:** D2:T19 and D3:T22 for the installed halves; D14's scaling
  and revision sequence has no case.
- **Browser-critic flow:** D2 flow 9; the management-revision surface does not exist.
- **Command:** `pnpm exec vitest run --project integration <suite> -t "<case>"` for the installed halves.
- **Expected result and durable-state proof:** 1R remains the frozen baseline after scaling and after
  revisions; Entry Quality resolves once at its Entry Resolution Point against the frozen intended entry
  and is never rewritten; current risk uses the remaining Position and effective management.
- **Failure / nonmutation / restart evidence:** the frozen baseline is re-read unchanged after restart.
- **Status:** `planned` — D14 owns it and has no breakdown. PD10 applies: the scenario's "including
  allocated fees" component of Entry Quality is **unclaimed by any deliverable**, because fees are
  captured and excluded. Not comparable with the other seven branches on that component.

#### AC-CALC-002 — independent calculation availability

- **Vertical deliverable:** D4 (single-Instrument, Partial); the multi-Instrument structure coverage
  completes at D11.
- **Planned tasks:** D4:T4, T10, T11, T20, T23, T25.
- **TDD / structural verification:** `derive` declares exact observation requirements (T10) and
  `evaluate` returns per-result availability with the exact Instrument and date (T11); completion names
  the affected figures (T20).
- **Mock-free integration case and fixture:** D4:T25 derives one eligible Trade, resolves one exact Mark
  and one Missing expected slot, evaluates, and asserts the result tree: realized-to-date `Value`, marked
  total `Unavailable` naming the Instrument and date, unaffected results still visible.
- **Browser-critic flow:** D4 F7.
- **Command:** `pnpm exec vitest run --project integration <suite> -t "<case>"`.
- **Expected result and durable-state proof:** an unavailable figure never suppresses a valid one; no
  fill-cost, zero or Stale substitution occurs anywhere in the tree or the view.
- **Failure / nonmutation / restart evidence:** the result tree is re-derived after restart from the same
  facts and must be identical.
- **Status:** `planned` — the single-Instrument slice is real at D4; the scenario's **Open
  multi-Instrument Trade** is D11's (and the short-option valuation shape is D9's).

#### AC-CALC-003 — Stops, Targets, risk, reward, and Overrun

- **Vertical deliverable:** D11 and D14 — **no breakdowns yet**. The condition model is D2's and the
  per-condition evaluation over one Instrument is D4's.
- **Planned tasks:** none at D11/D14. D2:T5/T6 fix the ordered condition set; D4:T11 evaluates per
  condition with the nearest-boundary headline and Overrun.
- **TDD / structural verification:** not yet specified at D11/D14. Installed: the `kind` discriminator,
  the ordered OR set, per-condition basis and the nearest-nonnegative-boundary headline.
- **Mock-free integration case and fixture:** D4:T25 exercises the OR set over one Instrument; the
  structure-value conditions and the multi-leg directions have no case.
- **Browser-critic flow:** D4 F6 and F7.
- **Command:** `pnpm exec vitest run --project integration <suite> -t "<case>"` for the installed half.
- **Expected result and durable-state proof:** each condition keeps independent OR status and detail;
  Ongoing Risk, Worst-Case Ongoing Risk, Incremental Reward and the Plan-R conversion follow the
  remaining Position; a crossed Stop produces a disclosed Overrun; a Target revision is never classified
  as a Deviation.
- **Failure / nonmutation / restart evidence:** crossing a Stop never changes Position or Lifecycle State
  — asserted as unchanged state, not merely as a rendering.
- **Status:** `planned` — D11 owns the structure-value and multi-leg half, D14 the revision half; neither
  has a breakdown. PD9 fixes the model; `StructureValueCondition` is not installed before D8.

#### AC-CALC-004 — Expiration Payoff is not valuation

- **Vertical deliverable:** D9, D11 and D12 — **no breakdowns yet**.
- **Planned tasks:** none.
- **TDD / structural verification:** not yet specified. D11/D12 own four-leg payoff extrema and
  attainment sets; D9 owns the short-option shape.
- **Mock-free integration case and fixture:** not yet specified; needs a planned option Trade and then
  remaining current option exposure with a realized-to-date offset.
- **Browser-critic flow:** not yet specified.
- **Command:** not yet available.
- **Expected result and durable-state proof:** Planned and Current curves are independent and contain all
  zero crossings/touches/ranges, signed extrema and attainment sets; Current includes the realized offset
  while open; no theoretical option price is produced; flat current exposure is Not Applicable, multiple
  expirations are Unavailable, stock-only without an option anchor is Not Applicable.
- **Failure / nonmutation / restart evidence:** the curve results are the evidence; the "no theoretical
  price" clause is a negative assertion on the result shape.
- **Status:** `planned` — D9/D11/D12 own it; no evidence exists yet. PD10 applies: the
  unconsumed-opening-fee term the frozen `trade-analysis.md:87` puts in the payoff's Current view is not
  installed. PD12's guard applies to any Roll leg inside the payoff's lineage.

### 6.8 Deterministic reports

#### AC-RPT-001 — Report Period resolution

- **Vertical deliverable:** D19 — **no breakdown yet**.
- **Planned tasks:** none.
- **TDD / structural verification:** not yet specified. D19 owns `runReport` and the Report Period
  presets over the injected Clock and Workspace time zone.
- **Mock-free integration case and fixture:** not yet specified; needs a View Moment on a Wednesday in a
  known time zone.
- **Browser-critic flow:** not yet specified.
- **Command:** not yet available.
- **Expected result and durable-state proof:** This Week is Monday–Wednesday and Last Week the preceding
  Monday–Sunday, inclusive calendar dates, with holidays and weekends never clipped; the exact dates are
  displayed; no user-defined range is offered; Current Exposure rejects or omits Report Period.
- **Failure / nonmutation / restart evidence:** the normalized request and the scope echo are the proof;
  dates are re-derived after restart from the injected Clock.
- **Status:** `planned` — D19 owns it; no evidence exists yet.

#### AC-RPT-002 — Outcomes populations and arithmetic

- **Vertical deliverable:** D19 — **no breakdown yet**.
- **Planned tasks:** none.
- **TDD / structural verification:** not yet specified. D19 owns `outcomes` and the Metric Basis
  disclosure for every headline.
- **Mock-free integration case and fixture:** not yet specified; needs closed wins/losses/breakevens, an
  Open Trade with partial realization, planned and unplanned Trades, fees and corrections.
- **Browser-critic flow:** not yet specified.
- **Command:** not yet available.
- **Expected result and durable-state proof:** Closed headlines use the terminal date and exclude Open
  zero-observations; cumulative dollars include in-period Lot-Match realization from Open and Closed
  Trades; Closed-R includes only planned Closed Trades with a valid 1R; the exact sign determines
  classification; a no-loser Profit Factor is Unavailable while losses with no gains is zero; corrected
  points appear at the original Economic Time.
- **Failure / nonmutation / restart evidence:** each Metric Basis, curve point order, contributor and
  exclusion set is disclosed; correction disclosure is part of the evidence.
- **Status:** `planned` — D19 owns it. PD10 applies: the scenario's fee-inclusive outcomes are
  **unclaimed**, and `vertical-deliverables.md:549` requires the report to contain no fee-inclusive
  figures. Not comparable with the other seven branches on that clause.

#### AC-RPT-003 — Current Exposure preserves coverage

- **Vertical deliverable:** D11 (coverage vocabulary for multi-leg structures, Partial) and D19.
- **Planned tasks:** none.
- **TDD / structural verification:** not yet specified. The unavailable/unbounded cohort vocabulary is
  installed piecemeal through D4 (`Unavailable`) and is D9's (`Unbounded`).
- **Mock-free integration case and fixture:** not yet specified; needs Open Trades with finite, Unbounded,
  Missing, Acknowledged Unavailable and Not Applicable components at one valuation lens.
- **Browser-critic flow:** not yet specified.
- **Command:** not yet available.
- **Expected result and durable-state proof:** finite covered subtotals remain; Unbounded contributors are
  named; unavailable cohorts stay separate; realized, open and combined P&L are independent; no average
  of Trade ratios is used; an optional portfolio ratio appears only for exact like-covered finite
  cohorts.
- **Failure / nonmutation / restart evidence:** the evaluation binding and observation coverage are the
  proof; a partially covered portfolio must not silently shrink its denominator.
- **Status:** `planned` — D19 owns the report and D11 the multi-leg coverage; neither has a breakdown.

#### AC-RPT-004 — Process Scorecard uses metric-specific opportunities

- **Vertical deliverable:** D19 — **no breakdown yet**.
- **Planned tasks:** none.
- **TDD / structural verification:** not yet specified. D19 owns `scorecard` with per-family natural
  dates, denominators and the four separate Deviation categories.
- **Mock-free integration case and fixture:** not yet specified; needs confirmed/entered/planned/abandoned
  Plans, Entry Quality statuses, zero-event and event Trades, Stop/Target gaps, Journal outcomes, option
  disposition and corrections.
- **Browser-critic flow:** not yet specified.
- **Command:** not yet available.
- **Expected result and durable-state proof:** each family uses its fixed natural date and denominator;
  zero-event overlapping opportunities still count; a gap cannot prove no episode; a continuous episode
  counts once; the four Deviation categories stay separate; reflection uses moment, origin date and
  current outcome; no composite grade or automated judgment appears.
- **Failure / nonmutation / restart evidence:** per-family Metric Bases and a sensitivity disclosure are
  the evidence; the "no composite grade" clause is a negative assertion on the result shape.
- **Status:** `planned` — D19 owns it; no evidence exists yet. The four Deviation categories are only
  complete once D11/D12/D13 install the remaining three.

#### AC-RPT-005 — categorical Journal Field uses current identity once

- **Vertical deliverable:** D19 — **no breakdown yet**.
- **Planned tasks:** none.
- **TDD / structural verification:** not yet specified. D19 owns `journalField`; D5 already establishes
  the outcome vocabulary (completed, declined, Voided, outstanding Debt, retired) the report must keep
  distinct.
- **Mock-free integration case and fixture:** not yet specified; needs Single Select, Scale, Tag Select,
  Text, edited, Voided, Debt, decline, retirement, Standalone and Trade-related items.
- **Browser-critic flow:** not yet specified.
- **Command:** not yet available.
- **Expected result and durable-state proof:** supported categorical fields group by stable
  identity/value; one effective Entry contributes once; prior Edit versions are disclosure only; blank,
  Due, Declined, Retired, Voided Entry and Voided origin stay distinct; Text is Not Applicable; Trade
  filters exclude Standalone without inventing dimensions; no nested breakdown or causal P&L claim.
- **Failure / nonmutation / restart evidence:** selector, definition revisions, group and item identities
  are the proof; counts are re-derived after restart.
- **Status:** `planned` — D19 owns it; no evidence exists yet.

#### AC-RPT-006 — filters, grouping, labels, and completeness

- **Vertical deliverable:** D19 — **no breakdown yet**.
- **Planned tasks:** none.
- **TDD / structural verification:** not yet specified. D19 owns the one-dimensional breakdown, the
  AND-across/OR-within rule, the report-only `Unspecified` bucket and contributor navigation.
- **Mock-free integration case and fixture:** not yet specified; needs a population spanning several
  Accounts/Institutions/Strategies/Underlyings/Tags/Idea Sources with inactive renamed references.
- **Browser-critic flow:** not yet specified.
- **Command:** not yet available.
- **Expected result and durable-state proof:** stable identities drive every filter and group; Institution
  expands through Account; Overall remains; Tag/multi-Underlying is explicitly non-additive;
  `Unspecified` is report-only and last; current labels organize presentation without changing membership;
  every page is exhausted and contributors navigate to records.
- **Failure / nonmutation / restart evidence:** the population binding and page proof are the evidence; a
  short page must fail the case rather than quietly count as complete.
- **Status:** `planned` — D19 owns it. Forward obligation 10: `Journal.query`'s dimension vocabulary is
  D5's implemented subset today and must be extended by D17/D19.

### 6.9 Reference configuration

#### AC-REF-001 — exact defaults and protection

- **Vertical deliverable:** D6 (reasons and definitions, Partial); the eleven Strategies complete at D12.
- **Planned tasks:** D6:T11, T12, T15, T19. D8, D9, D11 and D12 add the remaining Strategy seeds and have
  no breakdowns.
- **TDD / structural verification:** the two ordered taxonomies with stable identities, shapes, the
  `Rolled` workflow-semantic role and the protection policy, seeded atomically (D6:T11); the Close Review
  definition (D6:T12); the selector (D6:T15).
- **Mock-free integration case and fixture:** D6:T19 runs manifest v6 through the real
  `Workspace.initialize` path and queries the catalog with a Selectable-only view, then renames a seeded
  reason and asserts the policy holds.
- **Browser-critic flow:** D6 flow 4.
- **Command:** `pnpm exec vitest run --project integration <suite> -t "<case>"`.
- **Expected result and durable-state proof:** exactly eleven Strategies, five Close Reasons, five
  Abandonment Reasons and one empty IdeaSource Tag Type exist with stable identities/shapes/policies; no
  Account, Institution, generic Custom, Other or settlement-as-reason seed exists; Iron Condor role order
  is correct; Strategy remains retireable while protected taxonomy values/Rolled follow policy.
- **Failure / nonmutation / restart evidence:** the seed is idempotent and re-read after restart; no
  revision is overwritten.
- **Status:** `planned` — D6 seeds and proves the five Close Reasons and five Abandonment Reasons with
  their roles and policy. The exactly-eleven Strategy cardinality and the **empty IdeaSource Tag Type**
  complete at **D12** (PD15); no earlier deliverable may pre-empt them.

#### AC-REF-002 — inactive history remains valid but new use is blocked

- **Vertical deliverable:** D1 (Institution and Account, Partial); the wider rename/retire policy for
  reasons and tag values is D6's and D17's.
- **Planned tasks:** D1:T24, T30, T31.
- **TDD / structural verification:** `save`/`query` for Institution and Account with historical-versus-
  current label resolution and a `NewSelection` rejection for an archived value (T24); the onboarding
  surfaces that display it (T30, T31).
- **Mock-free integration case and fixture:** D1:T33 creates an Account through the production save path,
  archives it, and asserts retained references still resolve while a new selection is rejected.
- **Browser-critic flow:** D1 F12, F13.
- **Command:** `pnpm exec vitest run --project integration <suite> -t "<case>"`.
- **Expected result and durable-state proof:** historical and retained references stay valid with both
  labels; a new selection is rejected; no old fact or Entry is rewritten; a concurrent retirement between
  resolve and commit conflicts.
- **Failure / nonmutation / restart evidence:** the no-write conflict is asserted by unchanged revisions;
  resolution modes and display are re-read after restart.
- **Status:** `planned` — D1's slice covers archived Institutions and Accounts only. The scenario's
  "renamed and permissibly retired" value spans reasons and journal definitions, which is **D6**'s and
  **D17**'s; neither has a breakdown for that policy.

### 6.10 Backup, Restore, and reconstruction

#### AC-BACK-001 — full coherent backup, verified download, and secrets exclusion

- **Vertical deliverable:** D7 (export, manifest, digests, exclusion, `Downloaded`, `Not Completed`);
  D20 (read-back verification and the `CompletedBackupReceipt`); D21 (the Restore safety path, which
  consumes the receipt). D20 and D21 have no breakdowns.
- **Planned tasks:** D7:T2, T3, T4, T5, T6, T7, T8, T9, T10, T13, T14.
- **TDD / structural verification:** one coherent four-section snapshot (T2, T3); per-section and full
  digests (T4); the Workspace Backup Manifest with per-section totals and per-kind counts (T5, PD17
  item 2); secrets exclusion failing closed at a named stage (T6, PD17 item 1); `Downloaded` with source
  binding and no receipt (T7); concurrent-mutation isolation (T8); `Not Completed` with unchanged state
  (T9); `Recovery Only` availability (T10).
- **Mock-free integration case and fixture:** D7:T13 in two legs — a Node leg over `fake-indexeddb` and a
  real-browser leg — against a populated Workspace with corrections, Voids, definitions, Marks, Bars,
  acknowledgments, references, provider settings and rebuildable projections; the artifact bytes and the
  manifest are inspected, not a return value.
- **Browser-critic flow:** D7 flows 1, 2, 3, 4, 5, 6, 7, 8, 9.
- **Command:** `pnpm exec vitest run --project integration <suite> -t "<case>"`; `pnpm exec playwright
  test <spec> -g "<case>"`.
- **Expected result and durable-state proof:** all four authoritative sections and Workspace metadata
  share one snapshot with every identity, revision and history included; the later mutation is wholly
  outside it; credentials, raw payloads, diagnostics, reports, cursors and private projections are
  absent with their nonpresence proven; export alone returns `Downloaded` with no receipt; only
  verification of a complete selected file matching the artifact digest and source binding returns
  `Completed` and a `CompletedBackupReceipt` bound to the source Workspace and full artifact digest;
  every controlled failure returns `Not Completed` or `Not Verified` with no receipt or completed-backup
  claim.
- **Failure / nonmutation / restart evidence:** controlled source-read failure (T9), the downloaded-only
  state (T7), the concurrent mutation (T8), and the exclusion-stage failure (T6) — each with unchanged
  store revisions where nonmutation is claimed.
- **Status:** `planned` — D7 evidences the export half, `Downloaded`, `Not Completed` and secrets
  exclusion. Read-back verification and the receipt are **D20**'s; receipt enforcement before Restore is
  **D21**'s; neither has a breakdown. D7 also discloses that it cannot exercise a real excluded
  credential, because no provider exists before D8.

#### AC-REST-001 — preparation validates without mutation

- **Vertical deliverable:** D21 — **no breakdown yet**.
- **Planned tasks:** none.
- **TDD / structural verification:** not yet specified. D21 owns `prepareRestore` with untrusted-artifact
  validation, an isolated candidate migration and per-module graph validation with Trade Analysis
  rederivation.
- **Mock-free integration case and fixture:** not yet specified; needs valid, malformed, digest-corrupt,
  unsupported-newer and supported-older artifacts.
- **Browser-critic flow:** not yet specified.
- **Command:** not yet available.
- **Expected result and durable-state proof:** no live data changes; invalid candidates return aggregated
  safe issues; supported older data migrates in an isolated candidate; coherent derived disagreement
  yields a disclosed repair; incoherent authoritative facts reject; no provider is contacted.
- **Failure / nonmutation / restart evidence:** the before/after Workspace binding comparison *is* the
  claim, plus provider-call evidence.
- **Status:** `planned` — D21 owns it; no evidence exists yet.

#### AC-REST-002 — replace-only confirmation and safety offer

- **Vertical deliverable:** D20 (safety choice) and D21 — **no breakdowns yet**.
- **Planned tasks:** none.
- **TDD / structural verification:** not yet specified. The accepted-backup path must require an
  **exact-target** `CompletedBackupReceipt`; an unverified download must not satisfy it.
- **Mock-free integration case and fixture:** not yet specified; needs a valid prepared candidate and a
  nonempty current Workspace, attempted without replacement confirmation, without a safety choice, with
  an older receipt, with an unverified download, and finally with valid confirmation plus either an
  exact-target receipt or an explicit decline.
- **Browser-critic flow:** not yet specified.
- **Command:** not yet available.
- **Expected result and durable-state proof:** incomplete, stale and unverified-download attempts write
  nothing; the UI plainly identifies replacement and exact impact; a valid apply replaces the entire
  Workspace without merging or duplicating; a declined safety backup requires explicit warning
  acknowledgment.
- **Failure / nonmutation / restart evidence:** record counts after apply, plus unchanged state for each
  refused attempt.
- **Status:** `planned` — D20 and D21 own it; the receipt that this row enforces is itself unbuilt.

#### AC-REST-003 — all-section atomicity

- **Vertical deliverable:** D21 — **no breakdown yet**.
- **Planned tasks:** none.
- **TDD / structural verification:** not yet specified. D21 owns the atomic all-section replacement with
  rollback and the new Workspace binding.
- **Mock-free integration case and fixture:** not yet specified; needs a valid prepared candidate and a
  controlled failure in one section during apply, plus an injected-failure run and a successful one-call
  run.
- **Browser-critic flow:** not yet specified.
- **Command:** not yet available.
- **Expected result and durable-state proof:** every staged section rolls back and the prior Workspace
  remains intact on failure; on success all sections and settings commit under one new binding, the
  response supplies fresh Workspace status and landing state, and every old view/form is invalidated
  without an automatic read.
- **Failure / nonmutation / restart evidence:** the injected-failure run compares all section revisions;
  an independently opened surface must read only the new binding.
- **Status:** `planned` — D21 owns it; no evidence exists yet.

#### AC-REST-004 — migration failure preserves recoverability

- **Vertical deliverable:** D21 and D22 — **no breakdowns yet**.
- **Planned tasks:** none. D1 installs the migration runner with isolated candidate stores and an atomic
  pointer flip (D1:T10), which is the mechanism this scenario exercises on update.
- **TDD / structural verification:** not yet specified. The mechanism-level cases exist at D1:T10
  (isolated candidate, pointer flip, abort) and D1:T20's startup path; the failure-at-update case needs
  D22.
- **Mock-free integration case and fixture:** D1:T33 reopens a store at an older schema version through
  the production startup path; the update-with-validation-failure fixture is D22's.
- **Browser-critic flow:** not yet specified at D22; D1 F6/F7 cover the release-integrity side.
- **Command:** not yet available for the update path.
- **Expected result and durable-state proof:** partial migrated state never becomes Ready; prior data
  remains uncorrupted and readable by the compatible recovery path or exportable; a successful retry
  activates atomically with a migration/seed receipt.
- **Failure / nonmutation / restart evidence:** pre-failure and retry bindings, plus complete histories
  across the three states.
- **Status:** `planned` — D21 and D22 own it; only the migration mechanism is planned today.

#### AC-REBUILD-001 — reconstruction is observationally equivalent

- **Vertical deliverable:** D16, D18 and D21 — **no breakdowns yet**.
- **Planned tasks:** none. D3:T10 and D6:T5 install the agreement checks that reconstruction must
  preserve; D1:T9's schema is the private projection surface.
- **TDD / structural verification:** not yet specified. The reconstruction entry points are D16
  (Rebuild), D18 (rebuildable projections) and D21 (post-Restore).
- **Mock-free integration case and fixture:** not yet specified; needs a canonical target-scale
  Workspace and its expected lists/details/replays/reviews/reports, then either a Restore or a deliberate
  removal of rebuildable private indexes/projections.
- **Browser-critic flow:** not yet specified.
- **Command:** not yet available.
- **Expected result and durable-state proof:** stable domain identities, values, ordering,
  classifications, history navigation, lifecycle/lot/deviation agreement, Review completion, coverage,
  report groups and contributor sets are equivalent; newly generated opaque cache/snapshot tokens may
  differ.
- **Failure / nonmutation / restart evidence:** the normalized before/after comparison is the evidence,
  plus integrity verification.
- **Status:** `planned` — three deliverables own parts of it and none has a breakdown. The target-scale
  fixture this scenario requires is the same dataset `AC-PERF-001` needs and no deliverable builds.

### 6.11 Offline, responsive, accessibility, and performance

#### AC-DEL-001 — stopped application reopens offline

- **Vertical deliverable:** D1.
- **Planned tasks:** D1:T16, T17, T18, T20, T21, T25, T29, T33, T34.
- **TDD / structural verification:** the Web App Manifest and Offline Release Inventory artifact (T16);
  inventory runtime validation (T17); the versioned service worker with intended-release control (T18);
  the readiness gate (T20); readiness re-establishment at boundaries (T21); initialization (T25);
  startup presentation (T29); the integration suite (T33); the critic gate (T34).
- **Mock-free integration case and fixture:** D1:T17 blocks the network in a real browser after one
  successful load, stops the browser fully and reopens the URL; a second run deletes exactly one cached
  asset and asserts the gate refuses.
- **Browser-critic flow:** D1 F2, F10, F12.
- **Command:** `pnpm exec playwright test tests/browser/offline-restart.spec.ts --project=chromium`
  (and the WebKit run where the task states both engines); `pnpm test:integration`.
- **Expected result and durable-state proof:** `Writable` is re-established without a network, an
  interactive initial screen is reached, every installed Manual workflow/read/report/backup/local-Restore
  path works, provider recovery alone reports safe operational context, and stored data is intact.
- **Failure / nonmutation / restart evidence:** the cold restart trace is the evidence; the recorded
  environment names the exact browser and operating-system versions as **provenance**, not as a support
  decision, and the release-inventory identity is recorded.
- **Status:** `covered` — D1, re-verified cumulatively as later deliverables add installed paths.

#### AC-DEL-002 — update never interrupts active work

- **Vertical deliverable:** D1 (staging and inventory half, Partial); D22 (notice, deferral and
  activation) — **no breakdown yet**.
- **Planned tasks:** D1:T17, T18, T21, T33.
- **TDD / structural verification:** the new release's inventory is complete and digest-valid before any
  control change (T17); the worker installs and waits, never `skipWaiting()` on its own (T18); readiness
  re-runs after activation (T21).
- **Mock-free integration case and fixture:** D1:T33 controls two releases and a staging failure in a
  real browser.
- **Browser-critic flow:** D1 F6, F7.
- **Command:** `pnpm exec playwright test tests/browser/sw-two-releases.spec.ts --project=chromium`;
  `tests/browser/sw-staging-failure.spec.ts`.
- **Expected result and durable-state proof:** the new inventory is complete and digest-valid before
  notice; the current version stays safe and in control; activation waits for a safe reload; entered
  state is not silently lost; a code update creates no data synchronization; a failed staging leaves the
  prior compatible version available.
- **Failure / nonmutation / restart evidence:** the controlled staging failure, the kept old worker
  identity, and unchanged Workspace facts.
- **Status:** `planned` — D1 proves the inventory/staging/control properties; the notice, deferral and
  activation UX are **D22**'s, which has no breakdown.

#### AC-DEL-003 — PWA identity and support are browser-neutral

- **Vertical deliverable:** D1 (manifest identity, inventory binding, browser-tab `Writable`, Partial);
  D22 (installation where exposed, which completes it) — **no breakdown yet**.
- **Planned tasks:** D1:T16, T18, T20, T29.
- **TDD / structural verification:** stable application identity, name, icons, launch URL, scope and
  standalone request in the manifest artifact (T16); the worker binding the complete inventory (T18);
  the readiness decision reading no identity input (T20); the startup presentation (T29).
- **Mock-free integration case and fixture:** D1:T20 runs the gate on two real engines over the secure
  loopback origin, recording engine versions as provenance only; D1:T33 repeats on a real engine.
- **Browser-critic flow:** D1 F2, F3.
- **Command:** `pnpm exec playwright test tests/browser/readiness.spec.ts --project=chromium
  --project=webkit`.
- **Expected result and durable-state proof:** the manifest has stable identity, name, icons, launch URL,
  scope and standalone request; the worker binds the complete current inventory; a browser tab can become
  `Writable`; readiness depends only on functional checks; browser name, family, OS, user-agent identity
  and the absence of a vendor install prompt never decide support.
- **Failure / nonmutation / restart evidence:** the readiness-decision inputs are recorded to show no
  identity allowlist is consulted.
- **Status:** `planned` — D1's slice is real. Two gaps: installed-launch capture is **D22**'s, and
  **production HTTPS-origin evidence has no owning task anywhere in the plan.** PD4 assumes a deployed
  URL; no deliverable publishes one. Recorded as a Phase 6 decision (§9), not filled in here.

#### AC-DEL-004 — Runtime Readiness gates every write

- **Vertical deliverable:** D1.
- **Planned tasks:** D1:T12, T19, T20, T25, T29, T33, T34.
- **TDD / structural verification:** the persistence-level write gate returning `RuntimeNotWritable`
  (T12); the plan-derived capacity and headroom derivation (T19); the four functional checks with all
  failures reported (T20); initialization refusing to create a Workspace (T25); the per-check
  presentation with safe retry and the another-browser recommendation (T29).
- **Mock-free integration case and fixture:** D1:T33 drives each check to fail, including two at once,
  plus the unconfirmed-protection case with an accepted write and the durability action; D1:T20 runs the
  gate on two real engines; D1:T12 bypasses the UI to obtain `RuntimeNotWritable` from the seam itself.
- **Browser-critic flow:** D1 F1–F9.
- **Command:** `pnpm exec playwright test tests/browser/readiness.spec.ts --project=chromium`;
  `pnpm exec vitest run --project integration tests/integration/rollback-matrix.test.ts -t "<case>"`.
- **Expected result and durable-state proof:** only all-pass cases become `Writable`; unconfirmed
  protection stays `Writable` with the warning visible and the durability action offered; each failed
  check produces `Unsupported` with all known reasons; every mutation and Restore application returns
  `RuntimeNotWritable`; no Workspace is created, no data imported, and the diagnostic transaction leaves
  no authoritative fact.
- **Failure / nonmutation / restart evidence:** the per-check matrix including the simultaneous-failure
  result, unchanged authoritative revisions, absence of initialized/imported data, and the
  `RuntimeNotWritable` receipts from both the UI and the persistence boundary.
- **Status:** `covered` — D1.

#### AC-DEL-005 — failed readiness preserves read-only recovery

- **Vertical deliverable:** D1 (readable `Recovery Only` and Integrity Blocked, Partial); D7 adds the
  backup-export half and D20 the completed-receipt half.
- **Planned tasks:** D1:T12, T20, T25, T26, T29, T33; D7:T10, T11, T13. D20 has no breakdown.
- **TDD / structural verification:** `Workspace.getStatus` distinguishing `Unsupported` plus Integrity
  Blocked from `Recovery Only` (T26); the persistence gate refusing every mutation (T12); the
  presentation explaining each failure and the browser-storage isolation (T29); export usable in
  `Recovery Only` (D7:T10).
- **Mock-free integration case and fixture:** D1:T33 makes each readiness condition fail independently
  over a readable Workspace, then corrupts or locks the root; D7:T13 exports in `Recovery Only` and
  attempts a representative mutation.
- **Browser-critic flow:** D1 F10, F11; D7 flow 7.
- **Command:** `pnpm exec playwright test tests/browser/startup-recovery.spec.ts --project=chromium`;
  `tests/browser/startup-integrity.spec.ts`.
- **Expected result and durable-state proof:** each readable case becomes `Recovery Only` with reads,
  history, export and verification available and every authoritative mutation returning
  `RuntimeNotWritable` with unchanged revisions; the unreadable store has `Unsupported` plus Integrity
  Blocked with no reads, initialization, overwrite, mutation, Restore or completed-backup claim
  permitted; a failed export, unverified download or failed verification produces no receipt.
- **Failure / nonmutation / restart evidence:** preserved unreadable-store bytes and root evidence,
  absence of fresh initialization or overwrite, and the unchanged readable revisions.
- **Status:** `planned` — D1 proves the readable/read-only half and D7 the export availability; the
  completed-receipt and failed-verification evidence is **D20**'s, which has no breakdown.

#### AC-DEL-006 — readiness is re-established at every safety boundary

- **Vertical deliverable:** D1.
- **Planned tasks:** D1:T21, T25, T29, T33.
- **TDD / structural verification:** a distinct readiness receipt per launch and boundary (T21); the
  gate re-run after update activation and after Restore before mutations re-enable (T21); the
  presentation of the current status (T29).
- **Mock-free integration case and fixture:** D1:T33 runs three consecutive cold starts and compares
  receipts, then deletes one cached release asset mid-session and asserts the next mutation is refused at
  the persistence boundary.
- **Browser-critic flow:** D1 F2, F10.
- **Command:** `pnpm exec playwright test tests/browser/startup-pending.spec.ts --project=chromium`;
  `pnpm test:integration`.
- **Expected result and durable-state proof:** readiness is freshly established on every launch and after
  update activation and Restore before mutations are enabled; a later failure invalidates `Writable`
  immediately, prevents the next mutation at the persistence boundary, and enters `Recovery Only` when
  existing data remains readable; no browser identity substitutes for rerunning the checks.
- **Failure / nonmutation / restart evidence:** the injected runtime failure, the rejected next mutation
  with unchanged revisions, and the recovery status.
- **Status:** `covered` — D1.

#### AC-UI-001 — viewport-driven live adaptation

- **Vertical deliverable:** D1.
- **Planned tasks:** D1:T29, T30, T31, T32.
- **TDD / structural verification:** the responsive shell with one disclosed breakpoint (T32); the
  onboarding forms that preserve state across a live resize (T30, T31).
- **Mock-free integration case and fixture:** D1:T33 narrows and widens with a part-filled Institution
  form, asserting entered text, focus, validation state and available actions survive, with axe-core
  clean at both widths.
- **Browser-critic flow:** D1 F13; every later deliverable's resize flow repeats it for its own surfaces
  (D2 flow 11, D3 flow 9, D4 F14, D5 flow 11, D6 flow 14, D7 flow 8).
- **Command:** `pnpm exec playwright test tests/browser/onboarding-resize.spec.ts --project=narrow`;
  `--project=wide`.
- **Expected result and durable-state proof:** the layout switches between the wide sidebar and the
  narrow single-column bottom navigation; route, selected record, filters, unsaved fields, validation and
  actions remain equivalent and intact.
- **Failure / nonmutation / restart evidence:** the before/during/after state capture at boundary widths
  is the evidence; no write occurs during the resize.
- **Status:** `covered` — D1, and each later deliverable re-verifies it for its own surfaces.

#### AC-UI-002 — state, availability, and accessibility

- **Vertical deliverable:** D1 through D7 each own their own surfaces (all Partial); the chart-gap states
  complete at D18 and the destructive-Restore state at D21.
- **Planned tasks:** D1:T29, T32, T33; D2:T16, T17, T18, T19; D3:T18, T19, T20, T21, T22; D4:T22, T23,
  T24, T25; D5:T14, T15, T16, T17; D6:T15, T16, T17, T18, T19; D7:T9, T11, T12, T13.
- **TDD / structural verification:** each surface's Loading, Ready with partial availability, Empty,
  Error, validation and conflict states; keyboard and accessibility-tree coherence; Color never the sole
  meaning; the four market-evidence terms never conflated.
- **Mock-free integration case and fixture:** each deliverable's Playwright suite runs its surfaces at
  both projects with axe-core and a keyboard-only pass; the automated scan is recorded as supporting
  evidence beside the manual interaction record.
- **Browser-critic flow:** D1 F1, F4, F8, F11; D4 F7, F12; D5 flows 9, 12; D6 flows 5, 16; D7 flow 9.
- **Command:** `pnpm exec playwright test <spec> --project=narrow` / `--project=wide`; axe-core runs
  inside those specs.
- **Expected result and durable-state proof:** states are distinguishable; focus/order/names/roles are
  coherent; contrast meets WCAG AA; color is not the sole meaning; graphs have textual equivalents;
  Missing/Stale/Unavailable/Not Applicable and covered subtotals are not conflated.
- **Failure / nonmutation / restart evidence:** the exact tested states are recorded per deliverable,
  with the manual interaction record alongside the automated checks.
- **Status:** `planned` — every installed surface is evidenced at its own deliverable, and no deliverable
  yet produces the **chart-gap** state (**D18**) or the **destructive-Restore** state (**D21**).

#### AC-PERF-001 — mature-scale latency and correctness

- **Vertical deliverable:** **none named.** No `AC:` line names it, no breakdown claims it, and no
  deliverable builds the dataset it measures.
- **Planned tasks:** none.
- **TDD / structural verification:** no percentile case exists. What the plan does assert is
  **boundedness**: D1:T15 (lifecycle index and bounded cutoff queries), D1:T19 (plan-derived capacity),
  D4:T9 (cutoff index with a bounded `AnalysisInput` batch), D4:T25 and D6:T19 (counted storage requests,
  no per-record read on the ordinary path), and D1:T20's real-engine readiness on two engines.
- **Mock-free integration case and fixture:** none at target scale. The 25,000-Trade / ~200,000-fact
  deterministic fixture is described in the acceptance contract and **built by no deliverable**.
- **Browser-critic flow:** none. Every critic list explicitly forbids a latency claim on screen.
- **Command:** not yet available. **No millisecond figure is stated anywhere in this plan**, and none is
  asserted here.
- **Expected result and durable-state proof:** none claimed. The boundedness argument is index membership
  plus an asserted query count plus no all-history replay on the ordinary path.
- **Failure / nonmutation / restart evidence:** none claimed.
- **Status:** `planned` — **unowned gap**, by design and disclosed. The benchmark work is PD3
  verification item 2, which is recorded as deferred because no scheduled deliverable owns mature-scale
  measurement (`vertical-deliverables.md:618-623`; every deliverable's §7 repeats it). §9 records what
  Phase 6 must decide: whether a scale deliverable is added, or the scenario is recorded as a declared
  scope limit.

#### AC-CAP-001 — installed capabilities are honest

- **Vertical deliverable:** D1 (Partial for later capability, complete for the release it describes); the
  obligation re-applies to every release.
- **Planned tasks:** D1:T28, T29, T31, T32, T33, T34.
- **TDD / structural verification:** the manifest declares exactly the installed, dependency-closed
  capability and omits later capability rather than marking it `Unavailable` (T28); the navigation equals
  the declared set, with a runtime self-check failing when a declared operation has no entry point
  (T28); presentation (T29).
- **Mock-free integration case and fixture:** D1:T33 reads the manifest from the running release and
  compares it with the built artifact and the production navigation.
- **Browser-critic flow:** D1 F2, F13; each later deliverable's flows exercise its own declared
  capabilities.
- **Command:** `node -e "<manifest check>"`; `pnpm test:integration`.
- **Expected result and durable-state proof:** omitted behavior is absent, not a fake `Unavailable`;
  every declared compound capability is complete, dependency-closed, reachable through the production UI
  and functional through its required application/domain behavior and persistence; later additions
  preserve earlier fact meaning and disclose historical coverage limits where prior evidence was not
  captured.
- **Failure / nonmutation / restart evidence:** the manifest is bound to the installed release identity,
  so a stale manifest cannot be read after an update activates.
- **Status:** `covered` — D1 for the release it describes. Every later deliverable inherits the
  obligation to keep the manifest honest; that is a re-verification duty, not an unbuilt capability.

## 7. Coverage-honesty reconciliations

Five items where a status in this matrix differs from, or corrects, the prose in another plan file.

1. **`AC-POS-004` stale prose — fixed in D6 this session.** D6 §8 item 1 said the row "is marked
   Covered in §5", §5's closing note said "`AC-POS-004` is marked Covered because …", and §4's
   non-defect list referred to "the word `Covered` on that row". All three now say `Partial` and name
   D10 as the completing owner for the non-agency settlement half, and the closing note's stale row
   count was removed with them. This is the deferred defect in
   `plan/forward-obligations-2026-10-11.md` row 13, now discharged.
2. **`AC-REV-002` is recorded `planned` although D4 claims `Covered`.** The scenario's Given requires
   Settlement Due members; no fact can produce one before `AC-SET-003` exists at D10, so D4 can only
   exercise the family order with an empty settlement family. The matrix names D4 for the family order,
   D5 for the Debt family's saved outcomes, and **D10** for the settlement members. D4's row is not
   edited: the claim is not withdrawn, only read more narrowly than a pass.
3. **`AC-REV-006` is recorded `planned` although D5 claims `Covered`.** The scenario requires "Voiding an
   Action **or correcting facts**"; D5 proves the Void-of-an-Action half and its own row says the
   correction alternative arrives at D15. The matrix names D5 and **D15**.
4. **`AC-MARK-003` and `AC-PERF-001` have no owning deliverable.** Both are recorded as unowned gaps
   rather than assigned. Assigning `AC-MARK-003` would be a coverage change to a reviewed breakdown (a
   new §5 row and the task evidence behind it), and its recovery leg is D8's in any case; its nearest
   candidates are D4 (assert/withdraw and presentation) and D8 (a later exact Mark). `AC-PERF-001` needs
   a deliverable that does not exist. Phase 6 must decide both (§9).
5. **`AC-LIFE-003`'s owner is now discoverable from the deliverable map.** D2's and D3's §5 rows name D21
   as the completing owner, but `vertical-deliverables.md` did not name the scenario on any `AC:` line.
   `D21`'s `AC:` line now includes it. Nothing in the breakdowns changed.
6. **`AC-POS-004`'s non-agency owner is named in two different places, and neither is the map's `AC:`
   line for D10.** The deliverable map's `AC:` lines assign the scenario to **D6 and D13**; D6's §5 and
   §8 assign its missing non-agency half to **D10**. Both readings are coherent — D13 is where a Roll
   close must record `Rolled`, which is a second trader-directed instance, while Assignment, Exercise,
   Expiration and cash settlement are D10's settlement variants — but the map does not name the scenario
   on D10 at all, so a reader working only from the map would not find the deliverable the breakdown says
   completes it. This matrix records D10 as the completing owner for the non-agency clause and D13 as a
   further trader-directed instance. **Not changed here**: D10's line is outside the two ownership edits
   this session was authorised to make, and assignment is the coordinator's call.

**Observed and deliberately not changed.** D6 §8 item 10 lists `AC-REF-001`, `AC-RESP-001` and
`AC-UI-002` as rows that "are not a pass", while §5 marks `AC-RESP-001` `Covered`. The sentence is
pre-existing, sits outside this session's two-sentence correction, and the matrix follows §5 (which
D6:T14's evidence supports). Recorded here so Phase 6 does not re-discover it as a new defect.

## 8. Summary table

| Scenario | Owner(s) | Status | Breakdown? |
|---|---|---|---|
| AC-RESP-001 | D6 (D2–D5 earlier members) | `covered` | yes |
| AC-PLAN-001 | D2 | `covered` | yes |
| AC-PLAN-002 | D2 | `covered` | yes |
| AC-LIFE-001 | D6 (D2 Planned, D3 Open) | `covered` | yes |
| AC-LIFE-002 | D6 → D15 | `planned` | yes / no |
| AC-LIFE-003 | D2, D3 → D21 | `planned` | yes / no |
| AC-POS-001 | D3, D6 — no deliverable completes it | `planned` | yes |
| AC-POS-002 | D11 | `planned` | no |
| AC-POS-003 | D13 | `planned` | no |
| AC-SET-001 | D10 | `planned` | no |
| AC-SET-002 | D10 | `planned` | no |
| AC-SET-003 | D10 | `planned` | no |
| AC-POS-004 | D6 → D10 (map also names D13) | `planned` | yes / no |
| AC-POS-005 | D12 | `planned` | no |
| AC-SET-004 | D10 | `planned` | no |
| AC-CORR-001 | D15 | `planned` | no |
| AC-CORR-002 | D15 | `planned` | no |
| AC-CORR-003 | D16 | `planned` | no |
| AC-CORR-004 | D15, D16 | `planned` | no |
| AC-CORR-005 | D15 | `planned` | no |
| AC-JOUR-001 | D5 (D2 earlier) | `covered` | yes |
| AC-JOUR-002 | D17 | `planned` | no |
| AC-JOUR-003 | D5 (D3, D4 earlier) | `covered` | yes |
| AC-JOUR-004 | D17 | `planned` | no |
| AC-JOUR-005 | D5 | `covered` | yes |
| AC-JOUR-006 | D17 (D14 workflow) | `planned` | no |
| AC-JOUR-007 | D17 (D2–D6 grow the set) | `planned` | no |
| AC-REV-001 | D4 → D6, D15 | `planned` | yes / no |
| AC-REV-002 | D4, D5 → D10 | `planned` | yes / no |
| AC-REV-003 | D4 | `covered` | yes |
| AC-REV-004 | D4 | `covered` | yes |
| AC-REV-005 | D4 | `covered` | yes |
| AC-REV-006 | D5 → D15 | `planned` | yes / no |
| AC-MARK-001 | D4 | `covered` | yes |
| AC-MARK-002 | D8 | `planned` | no |
| AC-MARK-003 | **none named** | `planned` | no |
| AC-MARK-004 | D18 | `planned` | no |
| AC-MARK-005 | D8 | `planned` | no |
| AC-MARK-006 | D18 | `planned` | no |
| AC-CALC-001 | D14 | `planned` | no |
| AC-CALC-002 | D4 → D11 | `planned` | yes / no |
| AC-CALC-003 | D11, D14 | `planned` | no |
| AC-CALC-004 | D9, D11, D12 | `planned` | no |
| AC-RPT-001 | D19 | `planned` | no |
| AC-RPT-002 | D19 | `planned` | no |
| AC-RPT-003 | D11, D19 | `planned` | no |
| AC-RPT-004 | D19 | `planned` | no |
| AC-RPT-005 | D19 | `planned` | no |
| AC-RPT-006 | D19 | `planned` | no |
| AC-REF-001 | D6 → D12 | `planned` | yes / no |
| AC-REF-002 | D1 → D6, D17 | `planned` | yes / no |
| AC-BACK-001 | D7 → D20, D21 | `planned` | yes / no |
| AC-REST-001 | D21 | `planned` | no |
| AC-REST-002 | D20, D21 | `planned` | no |
| AC-REST-003 | D21 | `planned` | no |
| AC-REST-004 | D21, D22 | `planned` | no |
| AC-REBUILD-001 | D16, D18, D21 | `planned` | no |
| AC-DEL-001 | D1 | `covered` | yes |
| AC-DEL-002 | D1 → D22 | `planned` | yes / no |
| AC-DEL-003 | D1 → D22 | `planned` | yes / no |
| AC-DEL-004 | D1 | `covered` | yes |
| AC-DEL-005 | D1, D7 → D20 | `planned` | yes / no |
| AC-DEL-006 | D1 | `covered` | yes |
| AC-UI-001 | D1 | `covered` | yes |
| AC-UI-002 | D1–D7 → D18, D21 | `planned` | yes / no |
| AC-PERF-001 | **none named** | `planned` | no |
| AC-CAP-001 | D1 | `covered` | yes |

**16 `covered`, 51 `planned`, 0 `intentionally not advertised`.** No row is claimed as a pass on partial
evidence, and the two unowned gaps are visible rather than absorbed.

## 9. What Phase 6 must check before freezing

1. **Every `planned` row still has an owner.** Any row that names a deliverable with no breakdown — the
   33 scenarios no breakdown claims, plus the completing owners named on 16 partially claimed rows — must
   still name one that exists in `vertical-deliverables.md`; no row may be dropped silently.
2. **`AC-MARK-003` and `AC-PERF-001`.** Decide whether D4 and D8 claim `AC-MARK-003`, and whether a scale
   deliverable owns `AC-PERF-001` or the scenario is recorded as a declared scope limit. Neither may be
   closed by hiding data, relaxing a denominator or changing a fixture (`acceptance-contract.md:518`).
3. **The fee disclosure.** PD10 item 3 requires the Installed Capability Manifest to declare fee
   application and allocation not installed. No task case in D1 or D3 states that declaration: D1:T28
   enumerates operations, variants, adapters and ranges, not calculation components. Either T28's schema
   carries it or D3 adds it before the manifest is frozen.
4. **Production HTTPS-origin evidence.** `AC-DEL-003` requires it and no deliverable publishes the
   application. Decide whether it is a D22 task or an environment/CI step recorded as provenance.
5. **Re-verification duties, per release.** `AC-RESP-001`, `AC-DEL-001`, `AC-DEL-004`, `AC-DEL-006`,
   `AC-UI-001`, `AC-UI-002` and `AC-CAP-001` are satisfied for the release that produced their evidence.
   Each later deliverable must re-verify them through the cumulative suites and the fresh critic gate for
   the capability it adds; the freeze must name that duty rather than assume it.
6. **The two divergences.** Decide whether D4's `AC-REV-002` and D5's `AC-REV-006` rows are corrected to
   `Partial` (with the completing owner named) or whether the narrower reading recorded here is adopted as
   the plan's position.
7. **Stack and provenance.** The version profile (`planning-protocol.md:193`) and the exact browser and
   operating-system versions used for delivery evidence, recorded as provenance rather than a support
   allowlist.
8. **`plan/forward-obligations-2026-10-11.md`.** Every row still names a deliverable in
   `vertical-deliverables.md`; rows 5–8 and 12 are the most likely to be forgotten. Row 13 is discharged
   by §7 item 1.
9. **Where `AC-POS-004`'s non-agency half lives.** The map names D6 and D13; D6's §5 and §8 say D10. §7
   item 6 records the conflict. Settle it by naming the scenario on D10's `AC:` line (or moving the split
   to D13 with a stated mechanism) before the ownership map is frozen.

