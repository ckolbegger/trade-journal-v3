# Open alignment agenda — branch `deepseek-v41-flash`

Status: written 2026-10-11, at the end of the session that produced all seven task-level breakdowns
(D1–D7) and settled the first four alignment items. This file exists so the remaining alignment work
survives between sessions. **Neither validator reads it**; it is a worklist, not a plan artifact.

Worktree: `/Users/ckolbegger/src/trade-journal-v3/worktrees/deepseek-v41-flash`

---

## 1. Verified state at the time of writing

| | |
|---|---|
| Breakdowns | `plan/deliverable-breakdowns/D1…D7` — 155 tasks, 382 declared edges |
| `check-deliverable-breakdown.mjs` | 0 failure(s), 0 warning(s) across 7 files |
| `audit-breakdown-coverage.mjs` | 0 failure(s), 0 warning(s) |
| Spec citations | 1,174 checked, none out of range |
| Acceptance scenarios | 32 of 67 claimed by D1–D7; 35 belong to D8–D22 |
| PD3 verification items | D1 owns 3, 4, 6, 9; D2 owns 5; item 8 owned and re-verified by all seven; items 1 and 7 deferred (D21, D20); item 2 deferred, no scale owner |

Commands, run from the worktree root:

```sh
node scripts/check-deliverable-breakdown.mjs plan/deliverable-breakdowns/*.md
node scripts/audit-breakdown-coverage.mjs
```

Both must report zero failures **and zero warnings**. Warnings do not fail the exit code, so read them.

---

## 2. Already settled

| # | Item | Outcome | Recorded in |
|---|---|---|---|
| 1 | Lot-Match / Deviation records, and whether `AC-LIFE-003`'s controlled integrity fixture is legal under `acceptance-contract.md:7` | Records are durable but non-authoritative; `Given`-setup mutation is permitted at three tiers under six conditions; `AC-LIFE-003` is Partial at D2/D3 with **D21** as the completing owner | decision **PD8** |
| 2 | `assessPlan`'s input shape | Condition model fixed: discriminated union on `kind`, `conditionId`, `role`, `monetaryBoundary` on every underlying-price condition, view-only `comment`; plural OR set from D2; `StructureValueCondition` reserved, not installed before D8 | decision **PD9**; applied to D2 and D4 |
| 3 | Fee handling | **Superseded.** Fees are captured as a fact and excluded from every calculation; the cent-apportionment rule is **withdrawn, not solved** | decision **PD10** |
| 4 | `RecordedSequence` | One per-Workspace monotonic counter, assigned at commit in the candidate's **declared member order**; the candidate carries that order and `derive` tie-breaks with it because no sequence exists during preparation | D3 §1 decision 3, T2 |
| 5 | A reopened Debt: same identity and due time, or a new one | Same identity **and** original due time. Reopen is a state transition of the obligation key, not a second `Defer`, so it restores the trigger-time due semantics that `journal.md:137` freezes; a reopened Debt is therefore immediately due and keeps Review completion Incomplete until answered again. (c) would need unnamed retirement evidence; (b) a second due source or a mutation of a frozen fact. | decision **PD13**; PD5 §1 decision 2, T7, T10, §8 |
| 6 | Terminal Disposition's exact structured shape | Result union `Applicable(members) \| NotApplicable(stableReason, structuredDetails)`; members `{ mechanism, sourceFactIdentity, instrument, disposedQuantity }`; exact positive magnitude; `FactOrder` member order; `Mixed` derived rather than carried; one shared five-kind `MechanismKind` | decision **PD11**; PD6 §1 decision 2, T4/T16, §8 item 9 |
| 7 | Attention-band thresholds and the pressure/reward edges | **Reverses the spec's within-band sort.** Band 4 = comparable and within `nearBoundaryFraction` (default 0.25) of the `Target − Stop` span from either selected boundary; band 5 = mid-span; within a band, nearest boundary first, then Last Activity, then identity. `daily-review.md:32`'s pressure-descending sort is one-sided — risk plus reward is the constant span, so it is nearest-Target-first and sorts a near-Stop Trade last — so this is a **branch-local deviation**, disclosed; AC-REV-002 is unaffected. **This reverses the recommendation in §3.7.** | decision **PD14**; PD4 §1 decision 2, T13, §8 item 2 |
| 11 | The `Rolled` Close Reason exists before any Roll workflow | Selectable at D6. `reference-catalog.md:29` makes an inactive reason a Retired one, `:39` forbids retiring seeded taxonomy values, and AC-REF-001:390 files `Rolled` under that policy, so "while Roll is supported" scopes selectability in time rather than conditioning it. A `Rolled` close with no lineage is inert: the relation is one-directional and no derived value reads the reason. **This reverses the recommendation in §3.11.** | decision **PD12**; PD6 T3, §8 item 6 |

Earlier corrections in the same session, worth knowing before re-deriving anything: the
`vertical-deliverables.md` Open-items paragraph and its "decision D7" reference — the content is
PD6 — were stale and are fixed; the D2/D3/D4/D6 dependency-layer counts were wrong and are now the
graph's true height; two of 1,084 spec citations were out of range and are fixed.

One defect found while settling item 6 is deliberately **not** fixed yet: D6 §8 item 1 and its §5
closing note still say `AC-POS-004` is "marked Covered", while the row itself is `Partial` with D10
named as the completing owner. Item 6 left both sentences for the Phase 4 matrix, where that row is
the subject.

---

## 3. Open items

Each item states the question, what the frozen text already fixes, the options, and a recommendation.
Nothing here should be settled silently: the four settled items above all turned out to need a real
decision plus a disclosed reading.

### 5. A reopened Debt: same identity and due time, or a new one?

> **Settled 2026-10-11 — decision PD13: same identity and original due time.** The text is kept for the
> reasoning, not as an instruction.

**Question.** When Voiding the sole Entry that settled a Debt reopens it, does the reopened Debt keep
its original identity **and** its original due time, get a new due time, or become a new Debt?

**Fixed by the spec.** `journal.md:129` says Voiding the only such Entry "atomically reopens **that
same Debt**", which reads identity-preserving. `glossary.md:197` requires one obligation key to have
exactly one current outcome, and `journal.md:137` fixes that `Defer` creates the Debt with its
trigger-time due semantics and that later changes do not alter what is owed. The spec never says
whether a new due time is assigned.

**Options.**
- **(a) Same identity, original due time** — what D5 currently decides.
- **(b) Same identity, due time reset to the reopening moment or the next Review cutoff.**
- **(c) New Debt identity.**

**Recommendation: (a).** (c) is representable only by retiring the old Debt, and the retirement
evidence named at `journal.md:137` and `:139` concerns the Debt's origin or underlying facts rather than
its answer being Voided, so (c) would churn identity for an unchanged obligation. Between (a) and (b),
(a) follows both "that same Debt" and the frozen trigger-time due semantics. **Consequence to disclose
either way:** a Debt reopened today with yesterday's due time is immediately overdue, which is
defensible — it was never answered — but it changes what the daily review shows the next morning, so it
should be a stated choice rather than an accident. Lands in D5 §1 decision 2, T7, T10 and §8; the
due-ordering tests are D5:T10, which D4 only consumes.

### 6. Terminal Disposition's exact structured shape

**Question.** What is the structured value of a derived Terminal Disposition?

**Fixed by the spec.** `glossary.md:65` calls it "the derived **complete set of mechanisms and
quantities** by which a Closed Trade's exposure ended"; `trade-analysis.md:108` says it is derived
separately and "may contain mixed mechanisms"; `glossary.md:80` makes it `NotApplicable` for an
Abandoned Trade; `ui-contract.md:86` and AC-LIFE-001 require it never merged with Close Reason.

**Options.**
- **(a) An ordered set of typed members** `{ mechanism, signed quantity, instrument }` plus a
  mechanism summary.
- **(b) A discriminated union** `Single(mechanism, quantity) | Mixed(member[])`.
- **(c) A derived display label** with no structured members.

**Recommendation: (a).** "Quantities" and "mixed mechanisms" both have to be expressible, so a bare
label (c) under-delivers and a union (b) adds a case that carries no information the set does not.
`NotApplicable` remains distinct for Abandoned and Open. This is D6's to fix, but D8–D13 extend it, D18
renders it and D19 reports on it, so fixing it in D6 avoids reshaping it later. Land in D6 §1
decision 2 and T4/T16.

### 7. Attention-band thresholds and the pressure/reward edges

> **Settled 2026-10-11 — decision PD14: order by boundary proximity, symmetrically.** The
> recommendation below is superseded; it assumed a one-sided threshold on the spec's pressure
> quantity. The text is kept for the reasoning, not as an instruction.

**Question.** What separates "quantified pressure" from "routine", and "evidence limited" from the
others?

**Fixed by the spec.** `daily-review.md:30` fixes the **order** of the five bands and requires reasons
and inputs rather than a stored score. `daily-review.md:32` fixes the comparison: Monetary Ongoing Risk
to Stop when it is a Value, else evaluable Worst-Case Ongoing Risk; Incremental Reward to Target when a
Value, else Maximum Incremental Reward; positive or Unbounded risk with zero/non-positive reward ranks
Highest; finite risk against Unbounded reward ranks Zero; missing inputs are Not Comparable; within a
band, pressure descending, then Last Activity descending, then stable Trade identity.

**Options.**
- **(a) Named, disclosed inputs of the band function**, with a documented default set, never stored.
- **(b) Hard-coded thresholds** inside the band function.
- **(c) No thresholds** — derive order purely from the ranking rules.

**Recommendation: (a).** The spec fixes ordering and comparison but not cut points, so they are
implementation inputs; naming and disclosing them keeps them inspectable and testable without
inventing product semantics. (c) would drop two of the five bands the spec names. Land in D4 §1
decision 2 and T13.

### 8. `ReviewChanged` vs `Conflict`: keep branch-local, or promote to `specs/adr/`?

**Question.** Decision PD2 in `planning-decisions-2026-10-10.md` reads `daily-review.md:110`'s five
trigger kinds and two result names into a review-scope / subject-scope mapping. Should that reading
stay branch-local or bind every branch?

**Options.**
- **(a) Keep it branch-local and disclosed** — the status quo.
- **(b) Promote it to `specs/adr/`** so all eight branches share one mapping.
- **(c) Reopen the sentence itself.**

**Recommendation: (a) for now, with (b) named as the cost of comparability.** The reading is sound and
already recorded, but promoting it changes the shared baseline and what every other branch reads — the
handoff is explicit that this needs asking, not assuming. The reason to prefer (b) is that this is
exactly the kind of ambiguity that will diverge silently between implementations. **Same question and
same recommendation for item 9.**

### 9. Anchor resolution at `save` (decision PD1) — the same promote-or-not question

**Fixed by the spec.** `journal.md:173-179` shows `save` receiving a four-valued anchor status and
appending unconditionally; `journal.md:163` requires "one committed Anchor" without saying which
statuses qualify. Decision PD1 resolves it: `Effective`, `Superseded` and `Voided` all attach and carry
their status; only `Unknown` is a typed no-write rejection.

**Recommendation: identical to item 8.** The reading is behaviourally committed in D5 and blocks
nothing; the open question is only whether it binds other branches. Note that D5's reopen-on-Void
inherits this dependence, so promoting it would cover both.

### 10. Seed scope vs selector scope, including whether IdeaSource belongs in manifest v1

**Question.** Should D1's seed manifest v1 create only what D1's stories need, or the full canonical
set?

**Fixed by the spec.** `vertical-deliverables.md:62` gives manifest v1 as Long Stock, Plan Reflection
Entry Type and Plan Confirmation Source. `reference-catalog.md:118` says there is one IdeaSource Tag
Type and no seeded IdeaSource Values. AC-REF-001 requires exactly eleven strategies, five Close
Reasons, five Abandonment Reasons and one empty IdeaSource Tag Type — and **completes at D12**.

**Options.**
- **(a) Seed only what each deliverable needs** — the current approach; reasons arrive at D6, the
  remaining strategies at D12, IdeaSource when a Tag Select prompt is configured.
- **(b) Seed the full canonical set at D1** so AC-REF-001 passes immediately.
- **(c) Seed the IdeaSource Tag Type at D1** on the grounds that it is taxonomy-only and needs no
  values.

**Recommendation: (a).** Absent is the correct state for an uninstalled capability
(`overview.md:19`), and (b) would front-load capability no D1 story reaches. The related open point is
D2 §1 decision 7: manifest v2 carries the full canonical seed state while the **selector** offers Long
Stock only. That is a presentation scoping choice and should be confirmed as such, because it must not
be read as an AC-REF-001 cardinality claim. Neither variant may claim AC-REF-001 before D12.

### 11. The `Rolled` Close Reason exists before any Roll workflow

> **Settled 2026-10-11 — decision PD12: `Rolled` stays selectable.** The recommendation below was
> reversed after reading the policy chain at `reference-catalog.md:29`, `:39` and
> `acceptance-contract.md:390`. The text is kept for the reasoning, not as an instruction.

**Question.** D6 seeds all five Close Reasons, including `Rolled`, but no Roll workflow exists until
D13. Should `Rolled` be selectable on a D6 close?

**Fixed by the spec.** `reference-catalog.md:102-108` fixes the five reasons; `reference-catalog.md:26`
makes `Rolled` "the unique workflow-semantic Close Reason role"; and `reference-catalog.md:39` says
`Rolled` "additionally remains selectable **while Roll is supported**". `trade-workflows.md:146` says
a Roll's required Close Reason is that role value.

**Options.**
- **(a) Seed all five and keep `Rolled` selectable** — the current state; a trader could record
  `Rolled` on an exit that was not a Roll.
- **(b) Seed all five but make `Rolled` non-selectable until Roll is installed.**
- **(c) Defer the `Rolled` seed to D13.**

**Recommendation: (b).** Seeding is required to keep the taxonomy exactly five, so (c) is out. But
"remains selectable while Roll is supported" reads as *conditional* on Roll being supported, and (a)
permits recording a Roll that never happened, which the audit and correction machinery would then treat
as a close reason with no lineage. D13 flips selectability on when it installs Roll. Land in D6 §1
decision 6 and T11/T15.

### 12. Architecture batch — internal, but worth one sign-off

These are implementation-shaping rather than product decisions. Each is currently chosen in a
breakdown; the ask is to confirm or redirect, not to re-derive.

| Item | Current choice | Note |
|---|---|---|
| D3 Trade view read path | A narrow `TradeViewsAndReporting.getTradeDetail` subset, not the UI calling Trade Record plus `derive` | Required by `overview.md:14` — the UI must not become a domain coordinator. D18 extends the same operation. **Recommend keeping.** |
| D4 cutoff-eligibility index | Half-open interval keyed on `(storedLifecycle, effectiveFrom)` with `effectiveTo`, bound asserted as a query count | Migration-costly, so it is the highest-consequence index choice in D4. The alternative is an append-only lifecycle-membership log. **Recommend confirming the interval**, because the log grows with every lifecycle change at 25,000 Trades. |
| D1 capacity/headroom minimum | A disclosed plan-derived formula over the mature workload plus migration and backup headroom | The formula shape is D1's; the number itself is Phase 6. **Recommend confirming the formula shape** and that the minimum is disclosed rather than magic. |
| `Journal.query` scope | Implemented narrower than `journal.md:213`, with unsupported dimensions as typed no-read results | D17 and D19 need the remainder. **Recommend confirming** the subset and the typed-refusal behaviour. |
| `D4:T8` blocking edge | D4's `recover`-with-no-provider task blocks on `D1:T7` (browser-host capability port), restated as the typed capability-absence convention | The id resolves and the graph is valid, but no Pricing Provider port exists before D8. **Recommend keeping the edge** and relying on D4 §8 item 11's disclosure; the alternative is to drop the edge, which would leave T8 as a root. |

### 13. D7 artifact format — three open questions

| Question | Options | Recommendation |
|---|---|---|
| The exclusion proof's fail-closed boundary | Fail the export on a suspected secret, or warn and continue | **Fail closed.** Exporting a credential is unrecoverable; a false positive costs one retry. |
| Manifest counts | Per-section totals only, or per-section **and** per-kind | **Both**, so an empty section is distinguishable from a section that was skipped. |
| Failure-stage vocabulary | A fixed enumeration, or free text per stage | **A fixed four-stage enumeration** — snapshot, section, digest, exclusion — declared once in D7 T1 and reused by T9/T11, so `Not Completed` is comparable across failures. |

---

## 4. Questions raised by D8

These fell out of the buggy-release case and are recorded rather than guessed. Both need an answer
when the owning deliverable is planned.

1. **Can a correction be committed against a Trade whose base state is already incoherent?**
   `trade-record.md:62` says `prepareChange` "validates structural coherence" without saying whether it
   validates the **base** state or the **candidate**. If the base, a fact written wrongly by a buggy
   release can never be repaired through the corrections workflow and the trader has no route out; if
   the candidate as a whole (`trade-analysis.md:99`), the recovery path is open. **This decides whether
   D8's tier-3 class has any recovery route at all.** Settle when D15 is planned.
2. **Can a Workspace holding an incoherent authoritative fact produce a usable backup?** Its export
   fails Restore validation on the way back in (`trade-record.md:145`), so the product must disclose
   that the copy will not restore rather than presenting it as a completed backup. Affects D7's
   presentation and D20's verification wording.

---

## 5. Standing deferrals — confirm, not decide

| Deferral | Where it stands |
|---|---|
| Pinned version profile | The *set* is fixed by decision PD3; exact versions are pinned at Phase 6. No breakdown names a version. |
| `fake-indexeddb` fidelity gap | Disclosed in every relevant breakdown; item 9 requires durability-critical proofs repeated against a real engine. D4 and D7 defer item 9 to D1's mapping table. |
| `AC-PERF-001` | Owned by no deliverable, named by no `AC:` line, and **no latency figure appears anywhere**. Boundedness is asserted as index membership plus an asserted query count. |
| Workbox precache as the digest-valid inventory check | Decision PD3 records this as unverified and assumes custom instrumentation; that is verification item 3, owned by D1. |
| Temporal API | Not depended on; an explicit date library plus the versioned session calendar is used (decision PD3). |

---

## 6. Conventions to keep when resuming

- Task ids restart at `T1` in every file. A cross-deliverable citation is always `D<n>:T<m>`, never a
  bare `T<m>` — with per-file numbering a bare id is ambiguous, and the audit rejects it in the
  verification tables.
- `-->` may appear **only** inside the single mermaid block: the checker parses everything from the
  first ` ```mermaid ` fence to the next `# ` line, so a stray arrow becomes a diagram edge.
- A coverage status must never combine an incompleteness word with a completeness word, and the phrase
  "not covered" is unusable because it reads as both. Use `Partial — …`.
- Never claim `AC-PERF-001`, and never state a millisecond figure.
- A Partial row is never a pass, and at most one deliverable may carry a bare `Covered` status for a
  given scenario.
- Read decisions **PD8, PD9 and PD10** before touching anything to do with integrity fixtures, stop and
  target conditions, or fees.
