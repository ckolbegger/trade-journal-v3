# Handoff — finalize the plan · branch `deepseek-v41-flash`

**Purpose of the next session:** finish the interactive review (`planning-protocol.md` Phase 5) by
settling the alignment items that are still open, and then move on to the acceptance-to-evidence
matrix (Phase 4) and the freeze (Phase 6). **No application code is written in this session.** No new
breakdowns are written either, unless a settled item requires editing one that exists.

| | |
|---|---|
| Branch | `deepseek-v41-flash`, ahead of `origin/deepseek-v41-flash` (`418b825`). This handoff is itself one of those commits, so do not expect an exact count — the table below lists the substantive ones |
| Working tree | clean, nothing uncommitted |
| Worktree | `/Users/ckolbegger/src/trade-journal-v3/worktrees/deepseek-v41-flash` |
| Baseline | `main` at `700a953` |
| Repo | https://github.com/ckolbegger/trade-journal-v3 |
| Date | 2026-10-11 |

This file lives in `plan/` so it travels with the branch. It supersedes
`plan/handoff-deepseek-v41-flash-2026-10-11.md`, whose commissioned work — writing all seven
breakdowns — is complete. The item-by-item worklist for this session is
[alignment-agenda-2026-10-11.md](alignment-agenda-2026-10-11.md); read it early.

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
did not create, **stop and report it** rather than continuing. A wrong directory here is the single
most expensive mistake available in this session.

**Why this matters.**

- The repository root `/Users/ckolbegger/src/trade-journal-v3` is a **separate checkout on `main`**
  holding the shared frozen baseline that every competing implementation reads. Editing, committing
  or running builds from the root would land work on the wrong branch.
- The worktree must stay exactly two levels below the repo root, because the harness symlinks under
  `.claude/skills/` only resolve at that depth.
- Seven sibling worktrees under `worktrees/` belong to **other implementations** and are off-limits:
  `claude`, `claude-opus-5.5`, `codex`, `codex-gpt-6.1-sol`, `glm`, `qwen3.8-27B`, `zcode-glm-5.3`.
  The repository is shared; only `worktrees/deepseek-v41-flash` is yours.
- The local commits are **not pushed**. Do not push unless the user asks.

---

## 1. State at handoff

| | |
|---|---|
| Breakdowns | `plan/deliverable-breakdowns/D1…D7` — 155 tasks, 382 declared edges, ≈928 KB total |
| `check-deliverable-breakdown.mjs` | **0 failure(s), 0 warning(s)** across 7 files |
| `audit-breakdown-coverage.mjs` | **0 failure(s), 0 warning(s)** |
| Spec citations | 1,174 checked against real line counts; none out of range |
| Acceptance scenarios | 32 of 67 claimed by D1–D7; 35 belong to D8–D22 |
| Planning decisions | D1–D6, **D8, D9, D10** recorded (D7 is unassigned; the reason is in D8) |
| Phase 4 matrix | not drafted — 35 scenarios unowned by any deliverable yet |
| Phase 6 freeze | not started |

The substantive commits of the session that preceded this handoff, oldest first (the current tip is
newer than this list, since the handoff itself is a commit):

```
6269085  draft the task-level breakdowns for D1-D7
1c0a666  record decision D8 and claim AC-LIFE-003
986376d  record decision D9, the stop and target condition model
fa10ac6  add the per-condition view-only comment to D9
8c2bac1  apply the D9 condition model to D2 and D4
08a0d34  settle D3 fee apportionment by largest-remainder   (later withdrawn by D10)
5a059a1  exclude fees from calculations (decision D10)
df0e3fb  settle RecordedSequence and record the remaining agenda
2c704d9  add the handoff for finalizing the plan
```

---

## 2. Read these first, in this order

1. `AGENTS.md` (worktree root) — behavioural guidelines.
2. `plan/alignment-agenda-2026-10-11.md` — **the worklist.** Items 5–13 each state the question, what
   the frozen text fixes, the options and a recommendation. Sections 4 and 5 hold the two questions
   decision PD8 raised and the five standing deferrals.
3. `plan/planning-decisions-2026-10-10.md` — decisions PD1–PD6 and **PD8–PD10**. All binding on this
   branch. Read **PD8** (given-setup mutation), **PD9** (stop and target conditions) and **PD10** (fees)
   before touching anything they cover.
4. `plan/vertical-deliverables.md` — the authority for deliverable numbering, the `AC:` line per
   deliverable, and the cross-cutting threads (see the new **Fees** and **Stop and target
   conditions** threads).
5. `specs/README.md` (authority order), `specs/glossary.md`, `specs/design/overview.md`, and
   `specs/evaluation/planning-protocol.md` — §3 for what a breakdown must contain, §5 for the
   interactive-review checklist, §6 for what the freeze requires.
6. The breakdowns themselves, as each item requires. They are large; read the §1 decision and §8 open
   items of the one you are working on rather than the whole file.

**Not authority** (they predate ADRs 0009/0010): `trade-journal-v3-spec-consolidation-handoff-2026-08-26.md`
and `spec-handoff-2026-09-11.md`, both in the worktree root.

**Naming:** planning decisions carry a `PD` prefix (PD1–PD14) and deliverables are `D1–D22`. The
planning decisions were renumbered from a bare `D` on 2026-10-11, because the two series had begun to
collide: planning decision D11 and deliverable D11 both existed. The commit subjects quoted in §1 keep
their original wording, so `D8`, `D9` and `D10` inside that code block are the pre-rename names of
PD8, PD9 and PD10.

---

## 3. What this session is for

Work through the open alignment items **one at a time**, in conversation with the user, then close out
the phases that depend on them.

Each row's item number is the numbering used in
[alignment-agenda-2026-10-11.md](alignment-agenda-2026-10-11.md) §3, where the question, the fixed
text, the options and a recommendation are written out.

| Item | One line | Lands in |
|---|---|---|
| 5 | A reopened Debt: same identity and due time, or a new one? | D5 §1 decision 2, D4 due-ordering |
| 6 | Terminal Disposition's exact structured shape | D6 §1 decision 2, T4/T16; extended by D8–D13, rendered by D18, reported by D19 |
| 7 | Attention-band thresholds and the pressure/reward edges | D4 §1 decision 2, T13 |
| 8 | `ReviewChanged` vs `Conflict`: keep branch-local, or promote to `specs/adr/`? | decision PD2 in `planning-decisions`; affects D4 |
| 9 | Anchor resolution at `save`: the same promote-or-not question | decision PD1 in `planning-decisions`; affects D5 |
| 10 | Seed scope vs selector scope, including IdeaSource in manifest v1 | D1 §1 and T23; D2 §1 decision 7 |
| 11 | The `Rolled` Close Reason existing before any Roll workflow | D6 §1 decision 6, T11/T15; D13 flips it on |
| 12 | Architecture batch — five internal choices worth one sign-off | D1 capacity, D3 read path, D4 cutoff index, D5 `Journal.query`, the D4:T8 edge |
| 13 | D7 artifact format — three open questions | D7 §1 and T1/T5/T9/T11 |
| — | The two questions D8 raised: correction against an incoherent base, and whether a Workspace holding an incoherent fact can produce a usable backup | agenda §4; D15 and D7/D20 respectively |
| — | Five standing deferrals to confirm, not decide | agenda §5 |

After those: draft the **acceptance-to-evidence matrix** (Phase 4) covering at least the scenarios the
breakdowns already claim, and prepare the Phase 6 freeze package — selected stack/version profile,
browser and OS versions as provenance, the complete task graph, approved layer-only exceptions if any,
the matrix, and the user's recorded approval.

### The pattern that worked for items 1–4

For each item: state the question plainly, say what the frozen text already fixes versus what is
genuinely open, give two to four concrete options with their costs, give a recommendation with the
reason, then **let the user decide before you edit anything**. Do not batch items; do not pick an
interpretation silently. `planning-protocol.md:187` is explicit that an unresolved choice which could
change data semantics, public behaviour or the task graph prevents freezing.

When an item is settled: record it as a new decision `D11`, `D12`, … in
`plan/planning-decisions-2026-10-10.md` if it resolves under-specification, and/or edit the affected
breakdown. **Run both validators after any edit and commit before moving to the next item.** One
commit per settled item keeps the review diffable; that is how items 1–4 were handled.

---

## 4. Constraints that still bind

- **`specs/` is frozen and read-only.** Report a contradiction rather than picking an interpretation.
  Product decisions reopen only on explicit user instruction.
- **`plan/planning-decisions-*` D1–D6 and D8–D10 are binding and are not `specs/`.** Do not promote
  them into `specs/adr/` without asking; the other seven branches read the same `specs/`, and promoting
  changes what every branch may do. Items 8 and 9 in the agenda are exactly this question.
- **Branch-local decisions stay branch-local.** Say so when you record one.
- **No application code.** No scaffolding, no `package.json`, no `src/`, no `vite.config.ts`.
- **1–4 user stories per deliverable.** Verified for all 22; keep it that way.
- **No layer-only deliverables** without a specifically recorded, user-approved exception
  (`planning-protocol.md:87`).
- **The first mutating deliverable carries PWA identity, the complete Offline Release Inventory,
  Runtime Readiness and the persistence-level write gate.** `planning-protocol.md:83` and
  `specs/README.md` forbid deferring them. D1 carries them.
- **Migration is cross-cutting** — a task inside each deliverable that changes a durable
  representation, never a deliverable of its own. D7 deliberately has no migration task, with the
  reason recorded in its §0 and §8.
- **Never claim `AC-PERF-001`, and never state a millisecond latency figure.** It is owned by no
  deliverable and named by no `AC:` line. Boundedness is asserted as index membership plus an asserted
  query count. The gap is disclosed, not hidden.
- **A Partial coverage row is never a pass.** Partial rows are the mechanism for honesty here; do not
  let one be read as satisfying its scenario.
- **Fees are captured and excluded** (decision PD10). Do not reintroduce allocation, a consumed-fee
  split, or fee-adjusted P&L without reopening the decision.

### Known coverage facts, so they are not re-derived as defects

- **`AC-REF-001`** (exactly eleven Strategy seeds) completes at **D12**. D6 seeds the five Close
  Reasons and five Abandonment Reasons and correctly claims Partial.
- **`AC-JOUR-007`** (seven Entry Types and seven Sources) completes at **D17**.
- **`AC-LIFE-003`** (disagreement cannot pass as Ready) is Partial at D2 and D3 and is completed at
  **D21**, which owns the authorized-preparation half.
- **`AC-POS-001`** is claimed complete by **no deliverable**: D3 and D6 are both Partial, because the
  fixture's "fees are allocated exactly once" clause cannot be demonstrated once fees are excluded.
- **`AC-PERF-001`** is unowned; `AC-CALC-001` and `AC-RPT-002` need Partial claims with their
  fee-inclusive clauses unclaimed when D14 and D19 are planned.

---

## 5. Validator mechanics, and the traps that cost time

```sh
node scripts/check-deliverable-breakdown.mjs plan/deliverable-breakdowns/*.md
node scripts/audit-breakdown-coverage.mjs
```

Both must report **0 failure(s), 0 warning(s)**. Warnings do not affect the exit code, so read the
warning lines rather than trusting the exit status. With no breakdown files present the audit exits `2`
with "no breakdown files found" — expected, not a fault.

Traps that will bite if you edit a breakdown:

- **`-->` may appear only inside the single mermaid block.** The checker reads from the first
  ` ```mermaid ` fence to the next line beginning `# `, which on these files is the end of the
  document. A stray arrow in prose or in a second mermaid block is silently parsed as a diagram edge
  and fails prose/diagram agreement. Use `to`, `then` or `→` in prose.
- **Heading text is load-bearing.** `## 2. Task graph`, `## 3. Task detail` and
  `## 5. Acceptance coverage for D<n>` are matched literally. A `## ` heading inside §3 closes the
  section and hides every task after it from the validator; use `### ` inside §3.
- **Task ids restart at `T1` in every file.** A cross-deliverable citation is always `D<n>:T<m>`;
  a bare `T<m>` is ambiguous under per-file numbering and the audit rejects it in the verification
  tables.
- **Every `S` task body must contain the literal string `Exact verification`.** Every task body needs a
  `**Blocking edges:**` line; `none (root).` is the documented no-dependency form.
- **The status vocabulary is constrained.** Never write "not covered" — the word `covered` inside it
  reads as a completeness claim and contradicts the incompleteness marker. A status must not combine
  an incompleteness word (`partial`, `not advertised`, `intentionally not`, `requires`) with a
  completeness word (`fully`, `completely`, `covered`).
- **At most one deliverable may carry a bare `Covered` status for any one scenario.** Partial claims in
  several deliverables are expected. Adding a bare `Covered` where a sibling already has one fails the
  audit.
- **The section-2 task-count claim must match the number of `#### T` headers** exactly
  (`N tasks in …`).
- **Citations are checkable.** 1,174 spec citations were verified against real file line counts and two
  were out of range when first written. If you add citations, re-run that check rather than trusting
  the numbers.

---

## 6. Traps carried forward — do not re-raise as defects

**Documented false positives:**
- "The Vertical Put Debit/Credit Spread seeds are swapped." False; both are correct.
- `StateAtEconomicCutoff(Open)` vs `queryRecords(Open at cutoff)` — the same read; the former is a
  `queryRecords` mode (`trade-record.md:101`).
- "Workspace never enumerates the readiness checks" — they are in `delivery-contract.md:23-28` and
  `overview.md` rule 11.
- "Trade Workflows' contract omits Market Data" — granted by the call matrix (`overview.md:105`).
- "Result unions are never structurally defined" — by design; `acceptance-contract.md:5` says internal
  types are not prescribed.
- Diagram arguments or call order differing from interface signatures — `trade-analysis.md:126` states
  sequences are data dependencies, not required call order.

**Stale text — read through its amendments:**
- `specs/adr/0008-...md` body still lists host-confirmed persistent storage as a readiness check (line
  11) and confirmed artifact transfer for a completed backup (line 19). **ADR 0009** makes storage
  protection advisory; **ADR 0010** replaces transfer confirmation with read-back verification.
- Workspace has **8** operations (ADR 0010 added `confirmBackup`), not the 7 older files state.

---

## 7. Environment facts

- `DEV_PORT=5177` in the gitignored `.env.local`. Nothing consumes it yet; when an app exists, both
  `vite.config.ts` and Playwright must read it rather than hardcoding `5173`.
- Approved stack (decision PD3): TypeScript strict + Vite + React, **IndexedDB** behind the
  Persistence/Transaction seam, `decimal.js` for Money/Price/Quantity, an injected `Clock` plus a
  versioned US session calendar, Workbox-assisted service worker, Vitest + `fake-indexeddb` (Node) and
  Playwright (browser), axe-core for accessibility. **Exact versions are pinned at freeze, not yet** —
  no breakdown names a version, and that is deliberate.
- The acceptance contract holds **67 scenarios**; the Phase 4 matrix is not drafted.
- Working scale targets: 25,000 Trades / ~200,000 facts, with both latency targets at
  `overview.md:266-271`. No deliverable owns scale yet, and `AC-PERF-001` is unowned by design.

---

## 8. Suggested skills

- **`grilling`** — the remaining items are exactly the kind of design decisions it is for: one at a
  time, stress-tested before building. Optional; the pattern in §3 has worked without it.
- **`domain-modeling`** — useful if an item turns out to need vocabulary rather than a shape, most
  likely item 6 (Terminal Disposition).
- **`research`** — only if a claim needs demonstrating rather than assuming.
- **`prototype`** — only on explicit user request, and only after the freeze; there is no application
  code yet and none is authorized.

Do not invoke skills that would reopen frozen product semantics, and do not begin implementation
before the Phase 6 freeze with the user's recorded approval.
