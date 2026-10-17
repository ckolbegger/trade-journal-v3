# Handoff — Trade Journal V3 · branch `deepseek-v41-flash`

**Purpose of the next session:** write the detailed task-level breakdowns for **D1 through D7** —
**all seven**. The directory `plan/deliverable-breakdowns/` is currently **empty**; an earlier draft
set for D1–D3 was deliberately deleted so the whole set can be produced consistently (see §3).

| | |
|---|---|
| Branch | `deepseek-v41-flash` — in sync with `origin/deepseek-v41-flash` at `c4848b4` |
| Worktree | `/Users/ckolbegger/src/trade-journal-v3/worktrees/deepseek-v41-flash` |
| Baseline | `main` at `700a953` (moved during the prior session; see §6) |
| Repo | https://github.com/ckolbegger/trade-journal-v3 |
| Date | 2026-10-11 |

This file lives in `plan/` so it travels with the branch. It supersedes the previous session's
handoff, which lived in the OS temp directory and has been deleted.

> **Update, 2026-10-11 — this handoff is superseded.** The work it commissions is done: all seven
> breakdowns exist and both validators report zero failures and zero warnings. The session that wrote
> them also settled four alignment items and recorded them as decisions PD8–PD10.
>
> **For a new session, start at
> [handoff-finalize-plan-2026-10-11.md](handoff-finalize-plan-2026-10-11.md)**, which states the
> worktree, asks the agent to confirm it is there before doing anything, and lists what remains. The
> item-by-item worklist is
> [alignment-agenda-2026-10-11.md](alignment-agenda-2026-10-11.md). The sections below remain accurate
> as a description of the frozen inputs and the constraints that still bind.

---

## 0. Work in this directory — nowhere else

```
/Users/ckolbegger/src/trade-journal-v3/worktrees/deepseek-v41-flash
```

**Confirm you are there before doing anything:**

```sh
cd /Users/ckolbegger/src/trade-journal-v3/worktrees/deepseek-v41-flash
git rev-parse --abbrev-ref HEAD    # must print: deepseek-v41-flash
git status --short --branch        # must show: in sync with origin/deepseek-v41-flash
```

All work — reading specs, editing `plan/`, and every commit — happens **inside this directory**.

**Why this matters.** The repository root `/Users/ckolbegger/src/trade-journal-v3` is a
**separate checkout on `main`** that holds the shared frozen baseline every competing
implementation reads. Editing, committing, or running builds from the repo root would land work
on the wrong branch. The worktree must stay exactly two levels below the repo root, because the
harness symlinks under `.claude/skills/` only resolve at that depth.

Seven sibling worktrees under `worktrees/` belong to **other implementations** and are
off-limits: `claude`, `claude-opus-5.5`, `codex`, `codex-gpt-6.1-sol`, `glm`, `qwen3.8-27B`,
`zcode-glm-5.3`. The repository is shared; only `worktrees/deepseek-v41-flash` is yours.

---

## 1. Where the work stands

| Phase | State |
|---|---|
| 1 — comprehension check | complete |
| 2 — stack | complete; recorded as decision **PD3** in `plan/planning-decisions-2026-10-10.md` |
| 3 — vertical deliverables + task breakdowns | **complete for D1–D7** — the ordered list is agreed and settled, and all seven breakdowns are written and validated. The remaining alignment items are tracked in [alignment-agenda-2026-10-11.md](alignment-agenda-2026-10-11.md) |
| 4 — acceptance-to-evidence matrix | not started; 43 of 67 acceptance scenarios are owned by no deliverable |
| 5 — interactive review | started in practice (the user has reviewed and amended the deliverable list several times) |
| 6 — freeze | not started |

**No application code exists on this branch.** There is no `package.json`, `src/`, or
`vite.config.ts`. Implementation is not authorized until the plan is frozen (Phase 6) with user
approval. This session writes breakdowns, not code.

---

## 2. Read these first, in this order

1. `AGENTS.md` (worktree root) — behavioural guidelines.
2. `specs/README.md` — specification index, authority order, conformance rules.
3. `specs/glossary.md` — normative domain language; use these terms exactly.
4. `specs/design/overview.md` — module partition, dependency rules, shared value/result conventions.
5. `specs/evaluation/planning-protocol.md` — **the process to follow.** §3 "produce a vertical-deliverable
   plan and task graph" (`:61`) and its "Required task and deliverable evidence" (`:100`) are the
   operative parts; the completion checklist is at `:205`.
6. `plan/vertical-deliverables.md` — the agreed 22-deliverable sequence with user stories, plus the
   cross-cutting threads. **This is the authority for deliverable numbering.**
7. `plan/planning-decisions-2026-10-10.md` — decisions **PD1–PD6**. All binding on this branch.
8. Per deliverable as needed: the owning module contract under `specs/design/`, plus
   `specs/design/ui-contract.md`, `specs/design/delivery-contract.md`, and the relevant scenarios in
   `specs/acceptance/acceptance-contract.md`.

**Not authority** (they predate ADRs 0009/0010): `trade-journal-v3-spec-consolidation-handoff-2026-08-26.md`
and `spec-handoff-2026-09-11.md`, both in the worktree root and both tracked on the shared baseline.

**Naming caution:** "D1–D6" in item 7 means the *planning decisions* in that file. "D1–D7" everywhere
else means *deliverables*. They are unrelated numbering schemes; do not conflate them.

---

## 3. The breakdown format, and the two validators

Each deliverable gets **its own file** in `plan/deliverable-breakdowns/`, named `D<n>-<slug>.md`.
Write **all seven**, one at a time, aligning with the user before moving to the next.

### Why the directory is empty

An earlier set covered D1–D3 only (`7bd9e45`, `8b605ce`, `b84b34b`). It was deleted in `c4848b4` so
that all seven can be produced as one consistent set, rather than extending a partial set written
before the deliverable list was resequenced twice. Those revisions remain recoverable from history
(`git checkout f6cd8ae -- plan/deliverable-breakdowns/`) but **should not be reused**: parts of them
cite deliverable numbers that changed after they were written. Treat the new set as authoritative.

Because the worked example is gone, this section carries the format.

### Required sections, in order

1. **Scope** — advertised outcome; an in-scope table; an explicit out-of-scope list *with reasons*;
   and what the deliverable deliberately does **not** demonstrate.
2. **Task graph** — a mermaid flowchart, plus prose declaring per task its `Blocking edges:` and
   `Consumed by:`. Cross-deliverable dependencies are written `D<n>:T<m>`.
3. **Task detail** — one `#### T<n> — S|B Title` heading per task.
4. **Browser-critic flow list** — a numbered flow table, each flow run in **both narrow and wide**
   viewports, with steps and expected observable result, plus the intentional non-defects a critic
   must not report.
5. **Acceptance coverage** — one row per claimed scenario, honestly marked full or partial.
6. **Valid red evidence** — what counts and what does *not* count as red, restated per deliverable.
7. **Open items and risks.**
8. Where applicable, a `planning-decisions` PD3 verification-item mapping table.

### Structural vs behaviour-bearing tasks

- **`S` = structural** (build config, test-environment setup, a mechanical migration step): no
  invented unit tests. State the **exact automated or reproducible verification, the expected
  result, and the deliverable behaviour that depends on it** (`planning-protocol.md:113`).
- **`B` = behaviour-bearing**: TDD is mandatory (`:102`). Each carries concrete
  `describe("<behaviour>")` groups with `it should …` statements that name the seam under test, its
  conditions, and the **observable outcome** — not a test name and not an implementation detail.

### Red → green, per `planning-protocol.md:104-109`

1. **Red** — before writing production behaviour, add one test through the identified seam, run it,
   confirm it fails because the planned behaviour is absent or incorrect. A test that passes
   immediately, or fails for syntax/configuration/fixture/unrelated reasons, is **not** valid red.
2. **Green** — smallest production change that satisfies it; rerun; confirm it passes without
   breaking the task's already-green tests.
3. One case at a time. Do not write all tests then all implementation.
4. Refactoring after green is a separate review step; affected tests stay green.

No non-structural task is complete without recorded red **and** green commands and outcomes for every
planned `it should` case (`:111`).

### Integration tests and the critic gate

- Every deliverable defines **mock-free** integration tests through the real stack: no mocks, stubs,
  or canned responses for application dependencies; production code paths and every layer traversed;
  real persistence; durable state proven, not only the visible result (`:115-122`).
  Behaviourally-compatible substitutes are allowed (`fakeIndexedDB` rather than browser IndexedDB)
  but **every replacement must be disclosed** and must not bypass a layer.
- Each deliverable ends with the **independent browser-critic gate** (`:124-135`): a fresh critic
  starts the runtime itself and exercises every planned flow. Every defect it finds is **also a
  testing failure** — add or strengthen a test, confirm it fails for the reported defect, then fix.
  A deliverable is not complete without a passing fresh-critic report.

### The two validators — run both before committing

```sh
node scripts/check-deliverable-breakdown.mjs plan/deliverable-breakdowns/*.md
node scripts/audit-breakdown-coverage.mjs
```

- `check-deliverable-breakdown.mjs` validates each graph: declared types and blocking edges, no
  cycles, prose/diagram agreement compared as transitive reductions, structural-task verifications,
  and `D<n>:T<m>` cross-references resolved against the sibling files.
- `audit-breakdown-coverage.mjs` validates the cross-document claims: every claimed scenario exists
  in the acceptance contract, every claim names tasks that exist, no row calls partial coverage
  complete, no row both disowns and claims coverage, and each of the nine PD3 verification items has
  an owner or an explicit deferral.

Both were negative-tested against injected faults: a cycle, an undefined edge endpoint, a missing
verification, an invented scenario ID, a row stripped of its tasks, a bare cross-deliverable
citation, a wrong task count, and a row both claiming and disowning coverage.

Both must report `0 failure(s), 0 warning(s)`. With no breakdown files present they exit `2` with a
"no breakdown files found" message — that is expected until the first file exists, not a fault to fix.

**Task numbering:** within one deliverable, number from `T1`. The validator only requires IDs unique
*within a file* and cross-references to resolve, so a fresh per-file `T1…` sequence is fine; if a
cross-deliverable `D<n>:T<m>` citation is used, the target must exist in that file.

### Skeleton

```markdown
# D<n> — <title>: task-level breakdown

Status: draft for user review. Not frozen. Phase 3 artifact for `planning-protocol.md:61-135`.

## 0. Scope, boundary, and what this deliverable deliberately does not do
## 1. Decisions this breakdown introduces (needing alignment)
## 2. Task graph            (mermaid + declared Blocking edges / Consumed by)
## 3. Task detail            (#### T<n> — `S`|`B` Title, with cases or exact verification)
## 4. Browser-critic flow list   (narrow and wide, plus intentional non-defects)
## 5. Acceptance coverage    (one row per claimed scenario, full or partial)
## 6. What counts as valid red evidence
## 7. Open items and risks
```

---

## 4. What the next session must produce

**All seven.** Work one at a time; align with the user before starting the next. Do not batch.

| # | Deliverable | Stories | Notes that matter |
|---|---|---|---|
| D1 | Install, trust, and set up | 3 | The foundation, deliberately minimal. Carries the Web App Manifest, a complete digest-valid Offline Release Inventory, the four-check Runtime Readiness gate, the persistence-level write gate, the IndexedDB schema + migration runner + transaction seam + lifecycle index, `Workspace.initialize`/`getStatus`, and `ReferenceCatalog`/`Journal` seeding. Seed manifest v1: Long Stock, Plan Reflection Entry Type, Plan Confirmation Source |
| D2 | Confirm my first plan (long stock) | 3 | `TradeWorkflows.confirmPlan`; `TradeAnalysis.assessPlan` for the Long Stock shape, Plan Baseline and positive 1R; `TradeRecord.prepareChange`/`applyPreparedChange`; `Journal.getDefinitions`, `prepareEffects`/`applyPreparedEffects`. Strategy selector offers Long Stock only |
| D3 | Record my entry (long stock) | 3 | `recordPositionChange` stock-open variant; `TradeAnalysis.derive` — positions, FIFO Lot Matches, fees allocated exactly once, realized P&L; stored lifecycle `Planned`→`Open` with its index; Position Change Reflection with `Defer` creating Journal Debt. Seed: Position Change Reflection Entry Type, Position Change Source |
| D4 | Do my daily review | 4 | The signature ritual, and the spine the rest hangs from. `DailyReview.open`/`getTrade`/`save`; Manual Mark entry and Expected Mark Date/Status; attention bands returning reasons not scores; `Hold` preselected as **unsaved** view state with an explicit Save; Intent required for Exit/Roll/Adjust and never executing a trade; atomic Stop-Discipline reconciliation; `CompleteWithUnavailableMarks`; `recover` honestly returning `NotConfigured`. Seed: Daily Trade Review Entry Type, Daily Review Source |
| D5 | Complete what my review owes | 3 | `DailyReview.getDebt`/`save` (`ResolveReviewDebt`); `Journal.save` from the review; debt answer vs. explicit decline; one outcome per obligation key; Journal query for outcomes and Debt. Seed: Review Note and Trader Reflection Entry Types |
| D6 | End a long stock trade | 4 | `recordPositionChange` closing variant; **exactly one Close Reason** when trader agency is present; derived Terminal Disposition; Close Review with its distinct obligation key; `abandonPlan`; `Planned`→`Closed`/`Abandoned`. Seed: 5 Close Reasons, 5 Abandonment Reasons, Close Review Entry Type, Trade Close Source |
| D7 | Back up my journal | 2 | `Workspace.exportBackup`; `exportSnapshot` for all four authoritative sections from one coherent read snapshot; Workspace Backup Manifest (versions, capability footprint, counts, exclusions, section digests, full digest); secrets exclusion; `Downloaded` produces **no** `CompletedBackupReceipt`; available in `Recovery Only`. The artifact format must be designed for all four sections now, even where a section is thin, because it is durable |

For each, take the exact scope from `plan/vertical-deliverables.md`, which also records the `AC:`
line per deliverable. **A partial coverage claim must never be counted as passing** — every coverage
table must say so explicitly.

---

## 5. Constraints that are not obvious

These are the traps earlier sessions found. Re-deriving them costs time.

- **`specs/` is frozen and read-only.** Product decisions reopen only on explicit user instruction.
  Report a contradiction rather than picking an interpretation.
- **`plan/planning-decisions-2026-10-10.md` D1–D6 are binding, and are not `specs/`.** Do not promote
  them into `specs/adr/` without asking — the other seven branches read the same `specs/`.
- **Branch-local decisions stay branch-local.**
- **1–4 user stories per deliverable.** Verified for all 22; keep it that way.
- **No layer-only deliverables** without a specifically recorded, user-approved exception
  (`planning-protocol.md:87`).
- **The first mutating deliverable must carry PWA identity, the complete Offline Release Inventory,
  Runtime Readiness, and the persistence-level write gate.** `planning-protocol.md:83` and
  `specs/README.md` forbid deferring them; decision **PD4** records why. D1 carries them.
- **Migration is cross-cutting** — a task inside each deliverable that changes a durable
  representation, never a deliverable of its own.
- **Honest Installed Capability Manifest:** absent capabilities are absent from navigation and
  ordinary calls, never disguised as domain `Unavailable`.
- **Do not write application code.** No scaffolding, no `package.json`, no `src/`.

### Ordering constraints discovered in earlier sessions

- **D6 precedes D7, and D7's own deferral note holds by construction.** The user asked for backup to
  follow long stock closure. D4 brings marks and Daily Trade Review on board, D5 the in-review journal
  writing, D6 closure — so D7's "deferred until plan, trade entry, mark entry, and journal entry all
  exist" is satisfied when it runs.
- **Deliverable numbers above D7 changed recently.** Management revision moved from D7 to **D14**
  (after the multi-leg option work); Roll is **D13**; correction is **D15** and now names **which leg**
  of a multi-leg structure is being corrected. **Always take deliverable numbers from
  `plan/vertical-deliverables.md`**, never from memory or from an older handoff.
- **A real ordering constraint binds the option arc:** physical settlement (D10) can atomically create
  **workflow-routed Management Debt**, and `trade-workflows.md:150` says that Debt is resolved *only*
  by a Management Revision. D14 is therefore the latest position that keeps that Debt resolvable. Do
  not move it later without addressing this.
- **Deferred, by user decision:** whether a Management Revision targets per-leg or structure-level
  stops/targets. `glossary.md:159` reads structure-level; `glossary.md:60` mentions "structure" but is
  silent on per-leg. **This is a question for the D14 task breakdown, not D1–D7.**

### Scale is deliberately deferred — but boundedness is not

The user has decided to write the D1–D7 breakdowns **before** addressing scale. That is sound,
because these breakdowns need to *not preclude* scale rather than to *measure* it. It carries one
condition: they must assert **boundedness** explicitly. D1 designs the IndexedDB schema and indexes,
and a wrong index set is a migration-costly change.

- `overview.md:273` / `delivery-contract.md:122`: normal startup and Open selection **must not replay
  every historical Trade or issue one storage query per Trade**.
- **`AC-PERF-001` is owned by no deliverable**, and no deliverable's `AC:` line names it. **Do not
  claim a latency figure in any breakdown.** The gap is disclosed, not hidden.
- **D4 is where boundedness genuinely bites** — Daily Review's "Open at cutoff" query must be
  index-bounded, not a replay. Model it the way D1's schema/index work is described in §3 of this
  handoff: index membership, bounded queries, and a capacity/headroom derivation whose minimum is
  disclosed rather than a magic constant.
- The working scale targets are **25,000 Trades / ~200,000 facts**, with both latency targets at
  `overview.md:266-271`.
- A future scale-owning deliverable will need a deterministic generator for that dataset; worth
  sizing even though it is built later.

---

## 6. Environment facts

- `DEV_PORT=5177` in the gitignored `.env.local`. Nothing consumes it yet; when an app exists, both
  `vite.config.ts` and Playwright must read it rather than hardcoding `5173`.
- Approved stack (**decision PD3**): TypeScript strict + Vite + React, **IndexedDB** behind the
  Persistence/Transaction seam, `decimal.js` for Money/Price/Quantity, an injected `Clock` plus a
  versioned US session calendar, Workbox-assisted service worker, Vitest + `fake-indexeddb` (Node)
  and Playwright (browser). **Exact versions are pinned at freeze, not yet.**
- **`main` moved** from `92c2565` to `700a953`. The change was purely additive: a reusable planning
  prompt at `key-prompts/vertical-deliverable-plan.prompt`. `specs/` is untouched and the frozen
  baseline is unchanged in substance.
- The acceptance contract holds **67 scenarios**; the acceptance-to-evidence matrix (Phase 4) is not
  drafted.

---

## 7. Traps carried forward — do not re-raise as defects

**Documented false positives:**
- "The Vertical Put Debit/Credit Spread seeds are swapped." False; both are correct.
- `StateAtEconomicCutoff(Open)` vs `queryRecords(Open at cutoff)` — the same read; the former is a
  `queryRecords` mode (`trade-record.md:101`).
- "Workspace never enumerates the readiness checks" — they are in `delivery-contract.md:23-28` and
  `overview.md` rule 11.
- "Trade Workflows' contract omits Market Data" — granted by the call matrix (`overview.md:105`).
- "Result unions are never structurally defined" — by design; `acceptance-contract.md:5` says
  internal types are not prescribed.
- Diagram arguments or call order differing from interface signatures — `trade-analysis.md:126`
  states sequences are data dependencies, not required call order.

**Stale text — read through its amendments:**
- `specs/adr/0008-...md` body still lists host-confirmed persistent storage as a readiness check
  (line 11) and confirmed artifact transfer for a completed backup (line 19). **ADR 0009** makes
  storage protection advisory; **ADR 0010** replaces transfer confirmation with read-back
  verification of the trader-selected file.
- Workspace has **8** operations (ADR 0010 added `confirmBackup`), not the 7 older files state.

**Phased acceptance coverage, by design:** AC-REF-001 (exactly eleven Strategy seeds) completes at
**D12**; AC-JOUR-007 (seven Entry Types and seven Sources) completes at **D17**. Earlier deliverables
advertise partial scope honestly rather than shipping the whole seed set up front.

---

## 8. Open items

- **All seven breakdowns (D1–D7)** — done, and superseded as the leading open item by the alignment
  agenda in [alignment-agenda-2026-10-11.md](alignment-agenda-2026-10-11.md), which lists items 4–13,
  the two questions decision PD8 raised, and the five standing deferrals to confirm.
- **Scale ownership** — deliberately deferred by user decision; `AC-PERF-001` has no owning
  deliverable. See §5 for the boundedness condition this places on the breakdowns.
- **D14's per-leg vs. structure-level management question** — deferred to D14's breakdown.
- **Genuine under-specifications worth surfacing when reached:** `assessPlan`'s input shape for a
  long stock Plan (the contract fixes the baseline *policy* but not the inputs); whether Lot Matches
  are recorded *and* derived or derived only; and whether inducing a stored-lifecycle disagreement
  for `AC-LIFE-003` qualifies under `acceptance-contract.md:7`. These were raised against the deleted
  drafts and remain open — re-raise them in D2/D3's own §7 rather than assuming an answer.
- **Phase 4 matrix** — not drafted; 43 of 67 scenarios unowned.

---

## 9. Suggested skills

- **`tdd`** — primary. The breakdown is largely `describe`/`it should` cases plus the red→green
  evidence procedure the protocol mandates.
- **`research`** — only if a claim needs demonstrating rather than assuming.
- **`prototype`** — only on explicit user request.
- **`codebase-design`** — optional, for implementation-structure vocabulary.

Do not invoke skills that would reopen frozen product semantics, and do not begin implementation
before the Phase 6 freeze.
