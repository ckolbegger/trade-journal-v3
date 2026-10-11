# Handoff — Trade Journal V3 · branch `deepseek-v41-flash`

**Purpose of the next session:** write the detailed task-level breakdowns for **D1 through D7**,
following the evidence rules in the evaluation planning protocol. D1, D2, and D3 are already
drafted; D4, D5, D6, and D7 are not.

| | |
|---|---|
| Branch | `deepseek-v41-flash` — **in sync with `origin/deepseek-v41-flash` at `73c83d3`** |
| Worktree | `/Users/ckolbegger/src/trade-journal-v3/worktrees/deepseek-v41-flash` |
| Baseline | `main` at `700a953` (moved during this session; see §6) |
| Repo | https://github.com/ckolbegger/trade-journal-v3 |
| Date | 2026-10-11 |

This file lives in `plan/` so it travels with the branch. It supersedes the previous session's
handoff, which lived in the OS temp directory and has been deleted.

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
| 2 — stack | complete; recorded as decision **D3** in `plan/planning-decisions-2026-10-10.md` |
| 3 — vertical deliverables + task breakdowns | **in progress** — the ordered list is agreed and frozen-ish; D1–D3 breakdowns drafted; **D4–D7 outstanding** |
| 4 — acceptance-to-evidence matrix | not started; 43 of 67 acceptance scenarios are currently owned by no deliverable |
| 5 — interactive review | started in practice (user has reviewed and amended the deliverable list) |
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
5. `specs/evaluation/planning-protocol.md` — **the process to follow**; Phase 3's "Required task and
   deliverable evidence" is the operative part.
6. `plan/vertical-deliverables.md` — the agreed 22-deliverable sequence with user stories, plus the
   cross-cutting threads.
7. `plan/planning-decisions-2026-10-10.md` — decisions **D1–D6**. All binding on this branch.
8. `plan/deliverable-breakdowns/D1-install-trust-set-up.md` — **read this as the worked example.**
   D2 and D3 follow the same structure.
9. Per deliverable as needed: the owning module contract under `specs/design/`, plus
   `specs/design/ui-contract.md`, `specs/design/delivery-contract.md`, and the relevant scenarios in
   `specs/acceptance/acceptance-contract.md`.

**Not authority** (they predate ADRs 0009/0010): `trade-journal-v3-spec-consolidation-handoff-2026-08-26.md`
and `spec-handoff-2026-09-11.md`, both in the worktree root and both tracked on the shared baseline.

---

## 3. The breakdown format, and the two validators

Each deliverable gets **its own file** in `plan/deliverable-breakdowns/`, named
`D<n>-<slug>.md`. D1–D3 exist; D4–D7 are to be written.

A breakdown contains, in this order:

1. **Scope** — advertised outcome, in-scope table, explicit out-of-scope list with reasons, and what
   the deliverable does *not* demonstrate.
2. **Task graph** — a mermaid flowchart plus prose declaring, per task, its `Blocking edges:` and
   `Consumed by:`. Cross-deliverable edges are written `D<n>:T<m>`.
3. **Task detail** — one `#### T<n> — `S`|`B` title` heading per task, where `S` = structural (exact
   verification, no invented unit tests) and `B` = behaviour-bearing (TDD required). Each behaviour
   task carries `describe`/`it should` cases naming the seam, conditions, and observable outcome,
   plus a red→green procedure and explicit **valid vs. invalid red evidence**.
4. **Browser-critic flow list** — a numbered flow table run in both narrow and wide viewports.
5. **Acceptance coverage** — one row per claimed scenario, honestly marked full or partial.
6. **Valid red evidence** — D1's §6 rules apply verbatim to every later deliverable.
7. **Open items and risks.**
8. For deliverables that resolve one: a `planning-decisions` D3 verification-item mapping table.

**Run both validators before committing.** They are the reason the graphs can be trusted:

```sh
node scripts/check-deliverable-breakdown.mjs plan/deliverable-breakdowns/*.md
node scripts/audit-breakdown-coverage.mjs
```

- `check-deliverable-breakdown.mjs` validates each graph: declared types and blocking edges, no
  cycles, prose/diagram agreement compared as transitive reductions, structural-task verifications,
  and `D<n>:T<m>` cross-references resolved against the sibling files.
- `audit-breakdown-coverage.mjs` validates the cross-document claims: every claimed scenario exists
  in the acceptance contract, every claim names tasks that exist, no row calls partial coverage
  complete, no row both disowns and claims coverage, and each of the nine D3 verification items has
  an owner or an explicit deferral.

Both were negative-tested against injected faults. Both must report `0 failure(s), 0 warning(s)`.
**Task numbering is continuous across deliverables** — D1 uses T1–T35, D2 T36–T53, D3 T54–T79, so
D4 starts at **T80**.

---

## 4. What the next session must produce

Breakdowns for the four deliverables below. D1–D3 already exist and should be treated as done
unless the user asks for changes.

| # | Deliverable | Stories | Notes that matter |
|---|---|---|---|
| D1 | Install, trust, and set up | 3 | ✅ drafted (T1–T35) |
| D2 | Confirm my first plan (long stock) | 3 | ✅ drafted (T36–T53) |
| D3 | Record my entry (long stock) | 3 | ✅ drafted (T54–T79) |
| **D4** | **Do my daily review** | **4** | **to write.** The signature ritual. Introduces Manual Mark entry, Expected Mark Date/Status, attention ordering, Stop-Discipline reconciliation, `Hold` as unsaved view state, and `CompleteWithUnavailableMarks` |
| **D5** | **Complete what my review owes** | **3** | **to write.** `DailyReview.getDebt`/`save`, Journal writing from the review, debt answer vs. explicit decline, one outcome per obligation key |
| **D6** | **End a long stock trade** | **4** | **to write.** `recordPositionChange` closing variant, exactly one Close Reason when trader agency exists, derived Terminal Disposition, Close Review, `abandonPlan`, 5 Close + 5 Abandonment Reasons |
| **D7** | **Back up my journal** | **2** | **to write.** `Workspace.exportBackup`, `exportSnapshot` for all four sections from one read snapshot, Workspace Backup Manifest, secrets exclusion, `Downloaded` produces **no** receipt |

Work **one deliverable at a time and align with the user before starting the next.** The user has
been reviewing and amending as we go; do not batch all four without checking in.

---

## 5. Constraints that are not obvious

These are the traps this session found. Re-deriving them costs time.

- **`specs/` is frozen and read-only.** Product decisions reopen only on explicit user instruction.
  Report a contradiction rather than picking an interpretation.
- **`plan/planning-decisions-2026-10-10.md` D1–D6 are binding, and are not `specs/`.** Do not promote
  them into `specs/adr/` without asking — the other seven branches read the same `specs/`.
- **Branch-local decisions stay branch-local.**
- **1–4 user stories per deliverable.** Verified for all 22; keep it that way.
- **No layer-only deliverables** without a specifically recorded, user-approved exception.
- **The first mutating deliverable must carry PWA identity, the complete Offline Release Inventory,
  Runtime Readiness, and the persistence-level write gate.** `planning-protocol.md:83` and
  `specs/README.md` forbid deferring them; decision **D4** records why. D1 already carries them.
- **Migration is cross-cutting** — a task inside each deliverable that changes a durable
  representation, never a deliverable of its own.
- **Honest Installed Capability Manifest:** absent capabilities are absent from navigation and
  ordinary calls, never disguised as domain `Unavailable`.
- **A partial coverage claim must never be counted as passing.** Every breakdown says so explicitly;
  keep doing that.

### Ordering constraints discovered this session

- **D6 precedes D7, and the backup deliverable's own deferral note now holds by construction.**
  The user asked for backup to follow long stock closure. D4 brings marks and Daily Trade Review on
  board, D5 the in-review journal writing, D6 closure — so D7's "deferred until plan, trade entry,
  mark entry, and journal entry all exist" is satisfied when it runs.
- **Later numbers changed this session.** Management revision moved from D7 to **D14** (after the
  multi-leg option work); Roll is **D13**; correction is **D15** and now names **which leg** of a
  multi-leg structure is being corrected. If you cite a deliverable number above D7, take it from
  `plan/vertical-deliverables.md`, not from memory or from the previous handoff.
- **A real ordering constraint binds the option arc:** physical settlement (D10) can atomically
  create **workflow-routed Management Debt**, and `trade-workflows.md:150` says that Debt is resolved
  *only* by a Management Revision. D14 is therefore the latest position that keeps that Debt
  resolvable. Do not move it later without addressing this.
- **Deferred, by user decision:** whether a Management Revision targets per-leg or structure-level
  stops/targets. `glossary.md:159` reads structure-level; `glossary.md:60` mentions "structure" but
  is silent on per-leg. **This is a question for the D14 task breakdown, not D4–D7.**

### Scale is deliberately deferred

The user has decided to write D1–D7 breakdowns **before** addressing scale. This is sound, but it
carries one condition: the breakdowns must assert **boundedness** explicitly, because D1 designs the
IndexedDB schema and indexes and a wrong index set is a migration-costly change.

- `overview.md:273` / `delivery-contract.md:122`: normal startup and Open selection **must not replay
  every historical Trade or issue one storage query per Trade**.
- **`AC-PERF-001` is currently owned by no deliverable**, and no deliverable's `AC:` line names it.
  D3's coverage table marks it partial with "no timing evidence". Do not claim a latency figure in
  any breakdown. `AC-PERF-001` was already marked Partial before this session; the gap is disclosed,
  not hidden.
- **D4 is where boundedness genuinely bites** — Daily Review's "Open at cutoff" query must be
  index-bounded, not a replay. D1's breakdown already models this (lifecycle index, bounded queries
  at T13/T15, capacity derivation at T19). Follow that example.
- D1's T19 computes a minimum from a "mature-Workspace estimate"; if the scale answer ever changes
  that estimate, T19 is the one D1 task whose numbers move.

---

## 6. Environment facts

- `DEV_PORT=5177` in the gitignored `.env.local`. Nothing consumes it yet; when an app exists, both
  `vite.config.ts` and Playwright must read it rather than hardcoding `5173`.
- Approved stack (**decision D3**): TypeScript strict + Vite + React, **IndexedDB** behind the
  Persistence/Transaction seam, `decimal.js` for Money/Price/Quantity, an injected `Clock` plus a
  versioned US session calendar, Workbox-assisted service worker, Vitest + `fake-indexeddb` (Node)
  and Playwright (browser). **Exact versions are pinned at freeze, not yet.**
- **`main` moved during this session**, from `92c2565` to `700a953`. The change was purely additive:
  a reusable planning prompt at `key-prompts/vertical-deliverable-plan.prompt`. `specs/` is untouched
  and the frozen baseline is unchanged in substance.
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

- **D4–D7 breakdowns** — the next session's work.
- **Scale ownership** — deliberately deferred by user decision. `AC-PERF-001` has no owning
  deliverable. See §5.
- **D14's per-leg vs. structure-level management question** — deferred to D14's breakdown.
- **D2 and D3 open questions** — each breakdown's own section. The substantive ones: D2 §7.1
  (`assessPlan`'s input shape), D3 §7.1 (recorded *and* derived Lot Matches) and §7.3 (the
  `AC-LIFE-003` disagreement fixture).
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
