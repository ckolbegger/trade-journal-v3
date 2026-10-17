# Handoff — Phase 4, the acceptance-to-evidence matrix · branch `deepseek-v41-flash`

**Purpose of the next session:** draft the Phase 4 acceptance-to-evidence matrix required by
[planning-protocol.md:137-167](../specs/evaluation/planning-protocol.md), covering all 67 acceptance
scenarios, and fix the one coverage-honesty defect that was deferred to this phase. **No application
code is written. No new breakdowns are written.** Phase 6 (the freeze) is the session after this one.

This file supersedes `handoff-finalize-plan-2026-10-11.md` as the entry point, because the interactive
review that file describes is complete.

| | |
|---|---|
| Branch | `deepseek-v41-flash`, ahead of `origin/deepseek-v41-flash`. This handoff is itself a commit, so do not expect an exact count — the ahead-count is not a check |
| Working tree | clean, nothing uncommitted |
| Worktree | `/Users/ckolbegger/src/trade-journal-v3/worktrees/deepseek-v41-flash` |
| Baseline | `main` at `700a953` |
| Repo | https://github.com/ckolbegger/trade-journal-v3 |
| Date | 2026-10-11 |

---

## 0. Confirm you are in the right place — before you do anything else

**All work happens in exactly this directory:**

```
/Users/ckolbegger/src/trade-journal-v3/worktrees/deepseek-v41-flash
```

Run these and check the output **first**, before reading anything else, before any edit, and before
any commit:

```sh
cd /Users/ckolbegger/src/trade-journal-v3/worktrees/deepseek-v41-flash
git rev-parse --abbrev-ref HEAD    # must print exactly: deepseek-v41-flash
git status --short --branch        # must print: deepseek-v41-flash...origin/deepseek-v41-flash [ahead N]
                                   # with no modified or untracked files listed
```

The ahead-count `N` grows as work is committed and is **not** a check — only the branch name and a
clean working tree are. If the branch name is wrong, or if there are modified or untracked files you
did not create, **stop and report it** rather than continuing.

**Why it matters.** The repository root `/Users/ckolbegger/src/trade-journal-v3` is a separate checkout
on `main` holding the shared frozen baseline every competing implementation reads. The seven sibling
worktrees under `worktrees/` belong to other implementations and are off-limits. Only
`worktrees/deepseek-v41-flash` is yours, and it must stay exactly two levels below the repo root for
the `.claude/skills/` symlinks to resolve. The local commits are **not pushed**; do not push.

---

## 1. State at handoff

| | |
|---|---|
| Interactive review (Phase 5) | **Complete.** Items 5–13, §4 and §5 of the alignment agenda are all settled |
| Planning decisions | **PD1–PD17** recorded in `plan/planning-decisions-2026-10-10.md` (PD7 unassigned) |
| Breakdowns | `plan/deliverable-breakdowns/D1…D7` — 155 tasks, 382 declared edges, unchanged this session |
| `check-deliverable-breakdown.mjs` | 0 failure(s), 0 warning(s) across 7 files |
| `audit-breakdown-coverage.mjs` | 0 failure(s), 0 warning(s) |
| Acceptance scenarios | **67 canonical; 32 claimed by D1–D7; 35 unclaimed** |
| Phase 4 matrix | **not drafted — this session's work** |
| Phase 6 freeze | not started |

The ten commits of the session that preceded this handoff, oldest first (the current tip is newer,
since this handoff is itself a commit):

```
8ed5dba  settle the Terminal Disposition shape (decision D11)
3757a2a  settle the Rolled Close Reason (decision D12)
83e131e  settle the reopened Debt (decision D13)
09bd4e0  order attention by boundary proximity (decision D14)
25d152d  prefix planning decisions with PD
bb14c34  make seed scope need-driven (decision PD15)
cf669f9  decline promotion of PD1 and PD2 (items 8 and 9)
8f90f45  confirm the architecture batch (PD16)
64b70cb  answer the D7 artifact-format questions (PD17)
755397c  record forward obligations and confirm the standing deferrals
```

Two of those decisions change behaviour relative to the frozen text and are **disclosed as
non-comparable with the other seven branches**: PD10 (fees captured and excluded) and PD14 (attention
ordering by boundary proximity instead of pressure descending). PD12 reverses the agenda's own
recommendation. None of them edits `specs/`.

---

## 2. Read these first, in this order

1. `AGENTS.md` (worktree root) — behavioural guidelines.
2. `plan/forward-obligations-2026-10-11.md` — **row 13 is the deferred defect this session must fix.**
   The rest of the file is obligations on deliverables you are about to assign rows to.
3. `specs/evaluation/planning-protocol.md:137-167` — **the matrix requirements.** §4 gives the exact
   row template and the distinctions; come back to it constantly.
4. `specs/acceptance/acceptance-contract.md` — the 67 scenarios, one `### AC-… — title` each.
5. `plan/vertical-deliverables.md` — the `AC:` line inside each `## D<n>` section is the **ownership
   source** for scenarios no breakdown claims.
6. `plan/planning-decisions-2026-10-10.md` — PD1–PD17. Read **PD10** (fees), **PD11** (Terminal
   Disposition), **PD12** (Rolled), **PD13** (reopened Debt), **PD14** (attention ordering), **PD15**
   (IdeaSource), **PD16** (architecture), **PD17** (D7 format) before writing rows they touch.
7. The breakdowns' `## 5. Acceptance coverage` sections — the claims, statuses and task ids for the 32
   claimed rows.

**Not authority** (they predate ADRs 0009/0010): `trade-journal-v3-spec-consolidation-handoff-2026-08-26.md`
and `spec-handoff-2026-09-11.md`, both in the worktree root.

**Naming:** `PD<n>` is a planning decision; `D<n>` is a deliverable. The two series collided before the
rename and no longer do — keep the prefix on every decision reference.

---

## 3. What Phase 4 requires

`planning-protocol.md:139` requires a **traceable matrix with one row per acceptance scenario**. The
row template at `:141-152` is:

```text
Scenario ID
vertical deliverable
planned implementation task(s)
task-level TDD red/green or structural-verification specification
mock-free real-stack integration case and fixture
independent browser-critic flow where applicable
exact command or reproducible procedure once available
expected observable result and durable-state proof
failure/nonmutation or restart evidence where applicable
status: planned | covered | intentionally not advertised
```

Two rules make the matrix more than a table:

- `:154` — "Every advertised capability must cover all applicable scenarios. Foundational atomicity,
  audit, backup/Restore, offline, and reconstruction scenarios cannot be omitted merely because a later
  UI/report capability is deferred."
- `:156-167` — the matrix must **distinguish** evidence categories, not blend them: pure calculation
  examples; module contract tests; multi-module transaction and evidence-race tests; browser/responsive/
  accessibility behaviour; PWA installation, browser-tab operation, production HTTPS, loopback
  automation, browser-neutral readiness, and **exact browser/OS provenance**; repeated-launch,
  runtime-failure, `Recovery Only`, restart/offline/update/migration/Restore tests; verified, unverified
  and failed-verification backup results plus exact-target `CompletedBackupReceipt` enforcement before
  Restore; and deterministic target-scale correctness and percentile benchmarks.

It must also state **how secrets exclusion is verified** and **how no-write/rollback claims compare
authoritative before/after state** (`:167`).

The matrix is then an input to the freeze (`:198`), so it should be written to survive being read by
someone who will not open the breakdowns.

---

## 4. Row data — already derived, do not re-derive by hand

`node scripts/derive-acceptance-ownership.mjs` prints a 67-row table with, per scenario: the claiming
deliverable(s) and status, the owning deliverable per the `AC:` lines, and a flag for scenarios with
no owner. **Re-run it rather than trusting this page**, but as of this handoff its result is:

- **32 claimed** by D1–D7, with their §5 statuses.
- **35 unclaimed**, of which **33 have a named owning deliverable** and **2 have none**: `AC-MARK-003`
  and `AC-PERF-001`.
- `AC-LIFE-003` is claimed (D2 and D3, both Partial) but has **no owning deliverable in the `AC:` lines**;
  its completing owner, D21, is named only in D2's and D3's §5 tables. That is why the script reports
  three "no owning deliverable" rows rather than two.

The unclaimed set and its owners, for orientation only — re-derive:

| Scenario | Title | Owner |
|---|---|---|
| AC-POS-002 | multi-leg option decision remains one Position Change | D11 |
| AC-POS-003 | partial Roll preserves ownership and lineage | D13 |
| AC-POS-005 | Planned-Leg fulfillment is evidence-bound | D12 |
| AC-SET-001 | Assignment/Exercise allocation and basis | D10 |
| AC-SET-002 | allocation is never guessed | D10 |
| AC-SET-003 | Expiration is explicit | D10 |
| AC-SET-004 | settlement planning and later management are distinct | D10 |
| AC-CORR-001 | Replace preserves fact identity | D15 |
| AC-CORR-002 | Void is visible and economically effective | D15 |
| AC-CORR-003 | Rebuild keeps Trade identity and historical Anchors | D16 |
| AC-CORR-004 | linked correction is all-or-nothing | D15, D16 |
| AC-CORR-005 | preview is nonmutating and evidence-bound | D15 |
| AC-JOUR-002 | Edit, Addendum, and Void retain distinct meanings | D17 |
| AC-JOUR-004 | definition changes are prospective | D17 |
| AC-JOUR-006 | workflow-routed Debt cannot be settled with prose | D17 |
| AC-MARK-002 | Manual Mark is sticky | D8 |
| AC-MARK-003 | acknowledgment never becomes a price | **none named** |
| AC-MARK-004 | series preserve gaps | D18 |
| AC-MARK-005 | provider recovery is partial and nonbehavioral | D8 |
| AC-MARK-006 | Daily Bar range evidence is honest | D18 |
| AC-CALC-001 | frozen baseline and Entry Quality | D14 |
| AC-CALC-003 | Stops, Targets, risk, reward, and Overrun | D11, D14 |
| AC-CALC-004 | Expiration Payoff is not valuation | D9, D11, D12 |
| AC-RPT-001 | Report Period resolution | D19 |
| AC-RPT-002 | Outcomes populations and arithmetic | D19 |
| AC-RPT-003 | Current Exposure preserves coverage | D11, D19 |
| AC-RPT-004 | Process Scorecard uses metric-specific opportunities | D19 |
| AC-RPT-005 | categorical Journal Field uses current identity once | D19 |
| AC-RPT-006 | filters, grouping, labels, and completeness | D19 |
| AC-REST-001 | preparation validates without mutation | D21 |
| AC-REST-002 | replace-only confirmation and safety offer | D20, D21 |
| AC-REST-003 | all-section atomicity | D21 |
| AC-REST-004 | migration failure preserves recoverability | D21, D22 |
| AC-REBUILD-001 | reconstruction is observationally equivalent | D16, D18, D21 |
| AC-PERF-001 | mature-scale latency and correctness | **none named** |

---

## 5. Open questions this session must settle with the user

Do not pick these silently. Each is a real choice that changes the matrix.

1. **Status vocabulary.** The protocol fixes `planned | covered | intentionally not advertised`
   (`:151`). The breakdowns use `Covered` and `Partial`. The matrix must not let a Partial claim read as
   a pass. **Recommendation:** use the protocol's three statuses, and record a Partial claim as
   `planned` while naming the partial evidence and the completing owner in the row. Never write
   `covered` for a row whose own evidence is partial.
2. **`AC-MARK-003` has no owning deliverable.** "Acknowledgment never becomes a price" is nearest to
   D4's T4 (assert and withdraw an unavailable acknowledgment) and D4's T21/T22 presentation, but no
   `AC:` line names it. **Recommendation:** ask the user whether D4 owns it and should claim
   `AC-MARK-003` in its §5 (a real coverage change, needing a breakdown edit and both validators), or
   whether it is recorded in the matrix as an unowned gap. Do not assign it on your own.
3. **`AC-LIFE-003`'s owner is only in the breakdowns.** D2/D3 §5 name D21 as the completing owner;
   `vertical-deliverables.md` does not name `AC-LIFE-003` on D21's `AC:` line. **Recommendation:** cite
   the breakdowns in the matrix, and ask whether to add it to D21's `AC:` line so ownership is
   discoverable from the deliverable map.
4. **The 35 unclaimed rows have no breakdown, hence no tasks, no integration case and no critic flow.**
   **Recommendation:** record them as `planned`, name the owning deliverable, and mark explicitly that
   no breakdown exists yet. Do not invent task ids (`D<n>:T<m>`) for deliverables D8–D22: they have no
   task graphs, and a fabricated citation would fail the audit's cross-deliverable checks if copied
   back into a breakdown.
5. **`AC-PERF-001` is unowned by design.** No deliverable claims it, no `AC:` line names it. **Never
   state a millisecond figure.** Record it as an explicit unowned gap, naming the benchmark work as PD3
   verification item 2, and keep the boundedness argument in the shape it already has: index membership
   plus an asserted query count.
6. **The deferred defect (forward-obligations row 13).** D6 §8 item 1 and its §5 closing note still say
   `AC-POS-004` is "marked Covered" while the §5 row says `Partial`. Fix both sentences in the same
   session as the matrix row for `AC-POS-004`, because the matrix is where that row's status is
   settled. Run both validators after the D6 edit.
7. **Branch-local deviations must be visible in the matrix, not hidden by it.** PD10 (fees) means
   `AC-POS-001`'s fee-allocation clause, `AC-CALC-001`'s "including allocated fees" component and
   `AC-RPT-002`'s fee-inclusive outcomes are **unclaimed**. PD14 means the attention walk's within-band
   order differs from `daily-review.md:32` while `AC-REV-002` (which pins only the task-family order) is
   unaffected. PD12 means `Rolled` is selectable before the Roll workflow exists. Say so in the rows
   concerned or in a preface, and do not claim comparability the branch does not have.

---

## 6. Mechanics

- **Suggested artifact:** one new file, `plan/acceptance-evidence-matrix-2026-10-11.md`. Neither
  validator reads it; they read the breakdowns and the acceptance contract.
- **Reproduce the row data:** `node scripts/derive-acceptance-ownership.mjs`.
- **After any breakdown edit (e.g. the `AC-POS-004` fix, or a new claim):**

  ```sh
  node scripts/check-deliverable-breakdown.mjs plan/deliverable-breakdowns/*.md
  node scripts/audit-breakdown-coverage.mjs
  ```

  Both must report **0 failure(s), 0 warning(s)**. Warnings do not affect the exit code, so read them.
- **Commit discipline:** one commit for the matrix, one for the `AC-POS-004` correction (they have
  different review value), or a single commit if the correction is only two sentences. Do not push.
- **Do not touch `specs/`.** If the matrix needs a fact the spec does not state, record it as a gap or
  a decision, not as an interpretation.

---

## 7. Traps carried forward

**Validator traps if you edit a breakdown:**

- `-->` may appear only inside the single mermaid block — the checker parses from the first
  ` ```mermaid ` fence to the next line beginning `# `, which on these files is end of document. Use
  `to`, `then` or `→` in prose.
- `## 2. Task graph`, `## 3. Task detail` and `## 5. Acceptance coverage for D<n>` are matched
  literally. A `## ` heading inside §3 closes the section and hides every later task; use `### `.
- Task ids restart at `T1` in every file. A cross-deliverable citation is always `D<n>:T<m>`.
- Every `S` task body needs the literal `Exact verification`; every task body needs
  `**Blocking edges:**` (`none (root).` is the documented no-dependency form).
- The status vocabulary is constrained: never write "not covered"; a status must not combine an
  incompleteness word with a completeness word.
- **At most one deliverable may carry a bare `Covered` status for any one scenario.**
- The §2 task-count claim must match the `#### T` header count exactly.

**Content traps:**

- **A Partial coverage row is never a pass.** This is the single easiest thing to misread.
- **Never claim `AC-PERF-001` and never state a latency figure**, in the matrix or anywhere.
- **Fees are captured and excluded (PD10).** Do not reintroduce allocation, a consumed-fee split or
  fee-adjusted P&L in a row's expected result.
- **Do not claim evidence the breakdowns do not have.** The 35 unclaimed rows have no tasks yet.
- `specs/` is frozen. Report a contradiction; do not choose an interpretation.

**Known coverage facts, so they are not re-derived as defects:**

- `AC-REF-001` (eleven Strategies, five Close Reasons, five Abandonment Reasons, one empty IdeaSource
  Tag Type) completes at **D12**. D6 seeds the reasons and claims Partial. **D12 also seeds the empty
  IdeaSource Tag Type** (PD15); no earlier deliverable does, and D17 only uses it.
- `AC-JOUR-007` (seven Entry Types and seven Sources) completes at **D17**.
- `AC-LIFE-003` is Partial at D2 and D3 and completed at **D21**.
- `AC-POS-001` is claimed complete by **no deliverable**: the fixture's "fees allocated exactly once"
  clause cannot be demonstrated once fees are excluded. D3 and D6 are both Partial.
- `AC-CALC-001` and `AC-RPT-002` need Partial claims with their fee-inclusive clauses unclaimed.
- `AC-MARK-003` and `AC-PERF-001` have no owning deliverable (see §5).
- `AC-POS-004` is Partial at D6 (trader-directed half); the non-agency half lands at D10.

**Documented false positives — do not re-raise:**

- "The Vertical Put Debit/Credit Spread seeds are swapped." False; both are correct.
- `StateAtEconomicCutoff(Open)` vs `queryRecords(Open at cutoff)` — the same read.
- "Workspace never enumerates the readiness checks" — `delivery-contract.md:23-28` and `overview.md`
  rule 11.
- "Trade Workflows' contract omits Market Data" — granted by the call matrix (`overview.md:105`).
- "Result unions are never structurally defined" — by design; `acceptance-contract.md:5`.
- Diagram arguments or call order differing from interface signatures — `trade-analysis.md:126`.

---

## 8. Environment facts

- `DEV_PORT=5177` in the gitignored `.env.local`; nothing consumes it yet.
- **There is one stash in the shared repository: `stash@{0}`, "On zcode-glm-5.3: in-flight T2.11 work
  at rollback (bookmarked)". It belongs to another implementation's worktree and is visible here only
  because the eight worktrees share one object store. Do not apply, pop, drop or restore it.** It
  contains `src/` and `tests/e2e/` files that do not exist on this branch, and applying it would put
  another branch's application code into this worktree.
- Approved stack (PD3): TypeScript strict + Vite + React, IndexedDB behind the Persistence/Transaction
  seam, `decimal.js`, an injected `Clock` plus a versioned US session calendar, Workbox-assisted service
  worker, Vitest + `fake-indexeddb` (Node), Playwright (browser), axe-core. **Exact versions are pinned
  at Phase 6, not now**; no breakdown names a version.
- The acceptance contract holds 67 scenarios. Working scale target: 25,000 Trades / ~200,000 facts.
- Phase 6 will need, beyond the matrix: the selected stack/version profile, exact browser and OS
  versions as provenance, the complete task graph, any approved layer-only exceptions, and the user's
  recorded approval (`planning-protocol.md:189-203`).

---

## 9. Suggested first action

1. Run the §0 checks and both validators; run `node scripts/derive-acceptance-ownership.mjs`.
2. Read `planning-protocol.md:137-167` and `plan/forward-obligations-2026-10-11.md` row 13.
3. Put the three decisions in §5 — status vocabulary, `AC-MARK-003`'s owner, and `AC-LIFE-003`'s
   ownership line — to the user as **one** ask with a recommendation for each, before drafting.
4. Draft the matrix: the 32 claimed rows with full evidence fields from the breakdowns, the 35 unclaimed
   rows as `planned` with owners, and a preface recording the branch-local deviations and the unowned
   gaps.
5. Fix the `AC-POS-004` sentences, run both validators, and commit.
