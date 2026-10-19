# Handoff — implement D2 · branch `deepseek-v41-flash`

**Purpose of the next session:** implement **D2, "Confirm my first plan (long stock)"** — 20 tasks —
against the frozen plan, on top of the delivered D1. No planning work is needed: the plan is frozen, D1
is complete and tagged, and the change-control procedure is recorded. **Do not start D3–D7, do not plan
D8–D22, and do not touch `specs/`.**

This session runs the project's implementation kickoff prompt
([specs/evaluation/kickoff-prompt.md](specs/evaluation/kickoff-prompt.md)) instantiated for wave 2 at
[plan/kickoff-prompt-d2-2026-10-19.md](plan/kickoff-prompt-d2-2026-10-19.md).

This file is an operational briefing, not authority. Where it and the kickoff prompt disagree, **the
kickoff prompt wins**; where it and the freeze record disagree, **the freeze record wins**; where either
and `specs/` disagree, `specs/` wins.

| | |
|---|---|
| Branch | `deepseek-v41-flash` |
| Worktree | `/Users/ckolbegger/src/trade-journal-v3/worktrees/deepseek-v41-flash` |
| Tip at handoff | `fdc5d9c`, identical to `origin/deepseek-v41-flash` |
| D1 milestones | tag `deepseek-v41-flash-D1` → `ea4fd85` (D1 complete); tag `deepseek-v41-flash-D1-refactor` → `fdc5d9c` (after the test-suite consolidation) |
| Frozen plan | [plan/freeze-2026-10-17.md](plan/freeze-2026-10-17.md) at the digest set in [plan/freeze-manifest-2026-10-17.sha256](plan/freeze-manifest-2026-10-17.sha256) |
| Product baseline | `specs/` unedited since the `main` baseline |
| Date | 2026-10-19 |

---

## 0. Confirm you are in the right place — before anything else

```sh
cd /Users/ckolbegger/src/trade-journal-v3/worktrees/deepseek-v41-flash
git rev-parse --abbrev-ref HEAD                       # must print exactly: deepseek-v41-flash
git status --porcelain --untracked-files=all          # must print nothing
git rev-parse HEAD origin/deepseek-v41-flash          # must print the same SHA twice (fdc5d9c…)
git rev-parse --short deepseek-v41-flash-D1           # must print ea4fd85
```

Then verify the frozen revision and the delivered baseline:

```sh
shasum -a 256 -c plan/freeze-manifest-2026-10-17.sha256     # 11 lines, each ending ": OK"
node scripts/check-deliverable-breakdown.mjs plan/deliverable-breakdowns/*.md   # 0 failures, 0 warnings
node scripts/audit-breakdown-coverage.mjs                                       # 0 failures, 0 warnings
node scripts/derive-acceptance-ownership.mjs                                    # 67 scenarios; 32 claimed
node --version && npm --version                           # v26.12.0 and 11.20.0
npx vitest run                                            # 29 files, 190 tests pass
npx playwright test                                       # 132 tests pass (4 projects)
```

If the branch name is wrong, the tree is dirty with files you did not create, a digest fails, or the
baseline is not green, **stop and report it** rather than proceeding.

**Why the path matters.** The repository root `/Users/ckolbegger/src/trade-journal-v3` is a separate
checkout on `main`. The other worktrees under `worktrees/` belong to other implementations and are
off-limits. This worktree must stay exactly two levels below the repo root for the `.claude/skills/`
symlinks to resolve.

**There is one stash in the shared repository:** `stash@{0}`, "On zcode-glm-5.3: in-flight T2.11 work at
rollback (bookmarked)". It belongs to another worktree. **Never apply, pop, drop or restore it.**

---

## 1. Read these first, in this order

1. `AGENTS.md` (worktree root) — behavioural rules. Short, and they bind.
2. [specs/evaluation/kickoff-prompt.md](specs/evaluation/kickoff-prompt.md), then its wave-2
   instantiation at [plan/kickoff-prompt-d2-2026-10-19.md](plan/kickoff-prompt-d2-2026-10-19.md). The
   instance is a verbatim copy of the protocol plus a D2 goal line and nine branch-local notes; where they
   conflict, the protocol governs.
3. [plan/freeze-2026-10-17.md](plan/freeze-2026-10-17.md) — **the approved plan revision.** §2 is the
   version profile, §7 the fifteen D1 interface seams D2–D7 depend on, §8 change control, §12 the wave-2
   confirmation procedure.
4. [plan/deliverable-breakdowns/D2-confirm-first-plan.md](plan/deliverable-breakdowns/D2-confirm-first-plan.md)
   — **the work.** §0 scope and boundary, §1 the eight branch-local decisions, §2 the task graph, §3 all
   20 task bodies, §4 the critic flow list, §5 acceptance coverage, §6 valid red evidence, §8 open items.
5. `specs/README.md` and every document it indexes, plus
   `specs/acceptance/acceptance-contract.md`. D2's eight scenario rows quote from there.
6. [plan/acceptance-evidence-matrix-2026-10-11.md](plan/acceptance-evidence-matrix-2026-10-11.md) —
   read the `PLAN-*`, `LIFE-001`, `LIFE-003`, `RESP-001`, `JOUR-001`, `JOUR-007` and `UI-002` rows. Two are
   `covered` at D2; six are `Partial` with a named later owner. Do not try to make a `Partial` pass.
7. [plan/planning-decisions-2026-10-10.md](plan/planning-decisions-2026-10-10.md) — **PD9** (the plan
   condition union), **PD8** (integrity-fixture rules), **PD10** (fees), **PD18/PD19** (linter, npm).
8. [plan/freeze-errata-2026-10-17.md](plan/freeze-errata-2026-10-17.md) — **E-001 is open and must be
   applied at wave-2 confirmation**; E-002–E-009 are history.

**Not authority:** `trade-journal-v3-spec-consolidation-handoff-2026-08-26.md`,
`spec-handoff-2026-09-11.md` and `handoff-D1.md`. They describe earlier states.

**Naming:** `PD<n>` is a planning decision, `D<n>` a deliverable, `T<n>` a task inside its own
breakdown. Task ids restart at `T1` in every file, so a cross-deliverable citation is always `D<n>:T<m>`.

---

## 2. The job

Implement D2's **20 tasks in dependency order**, starting with T1. The graph is validated: 11 dependency
levels, 7 implementation phases, every edge declared. T19 is the mock-free integration suite; T20 is the
independent browser-critic gate, and **D2 is not done until a fresh critic passes all 12 flows at both
viewports** (24 report entries).

**Per non-structural (`B`) task:** one planned case at a time. Add exactly one `it should …` test through
the seam the task names, run it, confirm it fails *because the behaviour is absent*, then make the
smallest production change that passes it, then repeat. Record, per case: the task id and case phrase,
the exact command, the red observation with its failure reason, the green observation, and the commit.
A test that passes immediately, or fails for a harness reason, is not red evidence.

**Per structural (`S`) task:** run its listed exact verification and keep the output. T20 is the only
`S` task in D2.

**Standing rule from the user — a full run per commit.** After every commit that changes source or tests,
run `npx vitest run` **and** `npx playwright test` and append the commit, commands and totals to
`artifacts/evidence/D2-red-green.md`. A docs-only commit may cite the most recent run for the same code
state. A commit without a recorded full run is not a finished step.

**Definition of done for D2:**

- All 20 tasks have their evidence; `AC-PLAN-001` and `AC-PLAN-002` have it end to end; the six
  `Partial` rows still name their later completing owner.
- T19's integration suite is green through the real stack, with the `fake-indexeddb` substitution
  disclosed in `tests/substitutions.md` and the real-engine leg repeated on both engines.
- A fresh critic, given the frozen specs and plan, starts the runtime itself and passes every §4 flow at
  both viewports, with the report at `artifacts/critic/D2-report.json` (24 entries, `spawnedAfterFix`).
- Every defect the critic found was first reproduced by an automated test, then fixed, then re-run with a
  fresh critic.
- The Installed Capability Manifest advertises D2's confirmation capability and its reachable
  destinations, and still declares nothing it cannot do.
- The freeze manifest still verifies, or every manifested change is recorded as an erratum.

**Wave-2 confirmation, before T1.** D2–D7 are frozen *provisionally*. The breakdown's own header still
says "draft for user review. Not frozen" — that is stale text; the freeze record's "Provisional" status
governs. Before T1:

1. Verify the fifteen D1 seams in freeze §7 exist with the shapes D2–D7 assume (they do at this tag; check
   the exports, not the task titles).
2. Apply **E-001**: add `D1:T12` beside the existing `D1:T9`/`D1:T11` citations where D2, D3, D6 and D7
   describe the persistence-level `RuntimeNotWritable` rejection. Those are manifested files: re-stamp
   `plan/freeze-manifest-2026-10-17.sha256`, rerun both validators and `shasum -a 256 -c`.
3. Record the confirmation (commands and results) at the top of `artifacts/evidence/D2-red-green.md`.

If a seam's shape differs in a way that changes meaning, **stop and ask** — that is an adjustment or a
deviation under freeze §8, not a local edit.

---

## 3. The environment is decided; do not re-litigate it

| | |
|---|---|
| Node | **26.12.0** (Homebrew), range pin `^26.12.0` |
| npm | **11.20.0**, ships with that Node. **No pnpm, no corepack, no shim** |
| Playwright | 1.64.1; Chromium `156.0.8078.4`, WebKit `27.2`, already installed |
| Port | `DEV_PORT=5177` in the gitignored `.env.local` |
| TypeScript | 7.0.2 via `@typescript/native` for `tsc`; `typescript` → `@typescript/typescript6` 6.0.2 for the linter's peer range |
| Other pins | Vite 8.3.4, React 19.3.1, Vitest 5.0.5, `fake-indexeddb` 6.2.6, `decimal.js` 10.6.0, `date-fns` 4.4.0 |

Read `package.json` and `package-lock.json` rather than trusting this table; the lockfile is the version
record. **Do not run `npm install <pkg>`.** A new dependency is an erratum and needs the user's yes.
`npm run build` runs `lint:layers` then `vite build`; `npm run lint` is declared and deliberately off the
build path.

**Commands:** `dev`, `build`, `preview`, `typecheck`, `lint`, `lint:layers`, `test:unit` (Vitest, both
projects), `test:integration` (`vitest --project integration && playwright test`), `test:browser`.

**Delivered test layout — follow it.** D1's suite is consolidated one file per seam: 29 Vitest files
(`tests/<area>/<seam>.test.ts`) and 8 Playwright specs (`tests/browser/<family>.spec.ts`), with shared
fixtures in `tests/support/` (`store`, `domains`, `readiness`, `release`, `workspace`, `browser`) and the
integration adapter at `tests/integration/support.ts`. The Playwright projects are `chromium`, `webkit`,
`narrow` (375×812) and `wide` (1440×900); Vitest projects are `unit` and `integration`. For D2, add one
file per seam, one `it` per planned case with the exact phrase, and shared setup in `tests/support/` —
never one file per case.

**Serving the production UI.** D2 §4 and V20.1 say `npm run dev`; D1's frozen readiness gate needs the
built, versioned service worker (`/sw.js` exists only after `vite build`), so a dev server shows
`Unsupported`. Use `npm run build && npx vite preview --port $DEV_PORT` for the critic and any browser
proof that depends on readiness, exactly as D1:T34 did. Never bypass the gate to make dev mode pass.

**D2 path spellings.** D2:T19 and V20.4 cite `src/integration/…` and `e2e/d2-*.spec.ts`. The delivered
paths are `tests/integration/**` and `tests/browser/**`; read the frozen spellings as illustrative and
use the delivered harness.

---

## 4. What D2 must not silently break

### 4.1 The D1 contract it consumes

The fifteen freeze §7 seams all landed at `deepseek-v41-flash-D1`; their exports are:

| D1 task | Where it lives now | D2's use |
|---|---|---|
| T1 | `package.json`, `tsconfig.json`, `vite.config.ts`, `playwright.config.ts`, `eslint.config.js`, `scripts/` | every command |
| T3 | `vitest.config.ts`, `playwright.config.ts`, `tests/support/`, `tests/substitutions.md` | every test path |
| T5 | `src/calendar/index.ts` | `Expected Mark Date` (later deliverable) |
| T6 | `src/values/index.ts`, `src/values/codec.ts` | exact `Price`/`Money`/`Quantity` in every Plan fact |
| T7 | `src/platform/host/index.ts` | typed absence; no readiness decision |
| T9 | `src/persistence/indexeddb/schema.ts` (`SCHEMA_VERSION = 1`, `SCHEMA_MANIFEST`) | T1's migration baseline |
| T10 | `src/persistence/indexeddb/migration.ts` | T1's isolated candidate and pointer flip |
| T11 | `src/persistence/indexeddb/transaction.ts` | T14's rollback, counted requests |
| T12 | `src/persistence/indexeddb/writeGate.ts` | `RuntimeNotWritable` at the seam |
| T14 | `src/persistence/indexeddb/snapshotRead.ts` | T15's post-commit read |
| T15 | `src/persistence/indexeddb/lifecycleIndex.ts`, `lifecycleQuery.ts` | T4's `Planned` membership |
| T22 | `src/journal/index.ts`, `seedManifest.ts` | T11's manifest v2 |
| T25 | `src/workspace/index.ts` | D2's first flow (Ready for Trade Planning) |
| T26 | `src/workspace/status.ts` | the status vocabulary D2's UI extends |
| T28 | `src/capability/manifest.ts` | D2 must grow it, not fork it |

The application runtime is `src/composition/application.ts`; the UI is `src/ui/App.tsx` with
`Institutions.tsx`, `Accounts.tsx`, `ProtectionWarning.tsx`, entered at `src/main.tsx`. The manifest
currently declares eight operations (`runtime.readiness`, `release.inventoryValidation`,
`workspace.getStatus`, `workspace.initialize`, `workspace.requestDurability`, `referenceCatalog.query`,
`referenceCatalog.save`, `journal.getDefinitions`) and navigation `["startup", "onboarding"]`.

### 4.2 The D2 contract D3–D7 will consume

- **The frozen Plan facts.** The condition union is fixed by PD9: `UnderlyingPriceCondition` with an exact
  boundary and a frozen monetary boundary, and `StructureValueCondition` reserved in the type and **not
  installed** until D8. A later change to this union is migration-costly, not a local refactor.
- **The lifecycle index entry for `Planned`** must carry the committed `FactRevision` (D1:T15's shape).
- **The Journal definition revision** carrying the Plan Reflection definition and its workflow-critical
  roles, seeded idempotently through D1:T22's manifest.
- **The Catalog and Journal manifest v2 state** — Long Stock only, no new Catalog identity.
- **The creation member of the mutation-result contract** (`ConfirmPlanResult`): the committed Trade
  projection, the completed Entry projection and the derivation the command established.

### 4.3 The capability manifest

D2 adds a planning surface and a Trade view, so the manifest must gain D2's confirmation operation and its
reachable destinations, stay installed-only, dependency-closed, entry-point-reachable and release-bound,
and keep its self-check green. D2 §5 and §8.8 require it to advertise **confirmation only** — not Plan
lifecycle, not the response contract, not Journal defaults, not full UI-state coverage.

---

## 5. Scope discipline

- **Only D2.** D3–D7 remain provisional and must not be started. D2's §0 lists explicitly what is out:
  every other Strategy shape, recording positions/Executions/Lots/FIFO/fees/realized P&L, the transition
  to `Open`, Daily Review and Marks, corrections, the other six Entry Types and Sources, close reasons and
  abandonment, backup/Restore/migration of older Workspaces, and any latency claim.
- **`specs/` is read-only.** If a spec sentence looks wrong, stop and cite both normative passages; do not
  choose an interpretation silently.
- **No latency figures anywhere.** D2 asserts boundedness only (index-selected lifecycle membership, a
  bounded `AnalysisInput` batch, no per-record storage read, no all-history replay).
- **Fees are captured and excluded (PD10).** Default to explicit zero; never enter a calculation.
- **No new dependency.** The pin is the set; a missing package is an erratum.
- **Do not touch the stash, the root checkout, or any sibling worktree.**
- **Commit locally as you go**, one coherent unit per commit; **do not push unless the user asks**. Keep
  each source-changing commit with its recorded full run.

---

## 6. When something does not fit — change control (freeze §8)

| Class | Examples in D2 | What you do |
|---|---|---|
| **Errata** | a directory or test-file name; a script spelling; a missing task citation (E-001); a package the pin omitted | Append to [plan/freeze-errata-2026-10-17.md](plan/freeze-errata-2026-10-17.md), then re-stamp the manifest. No approval needed |
| **Adjustment** | a §7 seam's shape moves while every meaning and scenario status holds — a different `RuntimeNotWritable` payload field, a renamed manifest key | One message to the user, get a yes, record the entry, re-stamp |
| **Deviation** | durable format, public behaviour, capability scope, scenario status or task order changes — e.g. the condition union cannot hold both condition kinds, or Journal preparation cannot run inside the transaction | **Stop.** Name the affected scenarios from the matrix, argue durable compatibility, get explicit approval, produce a new freeze revision |

**Open erratum you must apply before T1:** **E-001** — D2, D3, D6 and D7 rely on the persistence-level
`RuntimeNotWritable` gate but none cites `D1:T12`. Add the citation, then:

```sh
node scripts/check-deliverable-breakdown.mjs plan/deliverable-breakdowns/*.md   # 0 / 0
node scripts/audit-breakdown-coverage.mjs                                       # 0 / 0
shasum -a 256 -c plan/freeze-manifest-2026-10-17.sha256                          # regenerate first
```

---

## 7. Traps

- **The D2 breakdown header is stale.** It says "draft for user review. Not frozen"; the freeze record
  marks D2–D7 **Provisional**, to be confirmed at wave 2. Do not treat the header as the status, and do
  not re-plan from it.
- **Migration, not a fresh schema.** T1 adds D2's stores on top of D1's `SCHEMA_VERSION = 1` through the
  D1 migration runner's isolated candidate and atomic pointer flip. Never hardcode a version literal;
  reference the D1 constant.
- **The lifecycle index is authoritative membership.** T4 writes `Planned` membership in the same
  transaction as the facts; derivation is only for agreement checking, never to repair a stored
  disagreement.
- **The condition set is plural from D2.** Independent-OR, nearest-nonnegative-monetary-boundary; a
  singular Stop/Target pair assumption will break `AC-CALC-001`'s "1R remains $500" guarantee later.
  Every underlying-price condition needs a monetary boundary, Target included.
- **The baseline is frozen at confirmation time, not by Strategy label.** Original Planned Risk must be
  positive and *is* 1R; zero or negative is a typed rejection, not an unavailable value.
- **`DerivedTradeReconciliation` is required** by `applyPreparedChange` for the exact candidate set; the
  coordinator must call Trade Analysis between prepare and apply, and a mismatched binding is a typed
  no-write result.
- **Journal prepare and apply share the Trade transaction.** A Journal-participant rejection must roll
  back the staged Trade effects; compare every participant revision, not only the visible result.
- **The injected failure is test infrastructure, not a production seam.** Inject it inside the real
  transaction at the participant boundary; disclose it. If it cannot be injected without mocking a
  participant or faking the transaction, redesign the rollback claim rather than weakening it.
- **`fake-indexeddb` is a disclosed substitute.** It cannot reproduce real abort timing, quota,
  eviction, multi-connection contention or process-kill durability; T19 must repeat the atomicity,
  index-membership and restart proofs on a real engine and list the gaps it covers.
- **The SW specs are serial.** Release-manipulating browser tests share the loopback server's active
  release; keep them in one serial block with one variant build, as the consolidated
  `tests/browser/service-worker.spec.ts` does.
- **A `Partial` coverage row is never a pass.** Six of D2's eight rows are Partial; the matrix keeps the
  completing owner.
- **Intentional non-defects.** The critic must not report: Long Stock as the only Strategy; absent
  positions/Executions/Lots/fees/realized P&L; absent Daily Review/Marks; absent corrections; absent
  close/abandonment; no management revision; no Terminal Disposition; no valuation/Overrun; only two of
  seven Journal types; unsaved form state surviving a resize; stored vs derived lifecycle shown separately;
  no read-back after Save; any timing statement.
- **Red evidence is per case**, not per task and not per suite.
- **Do not begin D3** in the same session unless the user explicitly confirms.

---

## 8. Where D2 stops

D2 ends at the creation member of the mutation-result contract and the `Planned` lifecycle step:

- `AC-PLAN-001` **covered** — the atomic Trade, frozen Plan and Legs, management, `Planned`, 1R and the
  completed Plan Reflection.
- `AC-PLAN-002` **covered** — every typed rejection with unchanged Trade, Journal and Catalog revisions.
- `AC-LIFE-001` **partial** — the `Planned` step and its index membership only; `Open` lands at D3 and
  `Closed` at D6.
- `AC-LIFE-003` **partial** — the read-side integrity disclosure; the authorized-preparation half lands at
  D21.
- `AC-RESP-001` **partial** — the creation member only; update and bounded multi-subject members at D4/D3.
- `AC-JOUR-007` **partial** — the Plan Reflection type and Plan Confirmation Source only; the rest at D17.
- `AC-JOUR-001` **partial** — the confirmation form stores nothing until Save; direct Journal save at D5.
- `AC-UI-002` **partial** — Loading/Ready/Empty/Error/validation/conflict on two surfaces; chart-gap and
  destructive-Restore at D18/D21.

Before closing, report **D2's seams for D3**: the shape of the frozen Plan facts, the `Planned` index
entry, the Journal definition revision, the manifest v2 state and the `ConfirmPlanResult` shape — landed
as contracted, or what moved and under which change class.

---

## 9. Suggested first actions

1. Run the §0 checks, the freeze validators and the baseline suites (`190` Vitest, `132` browser). Stop on
   anything unexpected.
2. Read §1's list in order — the freeze record and D2's §3 are the two that matter most.
3. Perform the wave-2 confirmation: verify the fifteen D1 seams by export, apply **E-001**, re-stamp,
   rerun both validators, and write the confirmation into `artifacts/evidence/D2-red-green.md`.
4. Start **T1**: the D2 durable schema and migration, with its red case first and the migration's exact
   verification. Then T2, T5, T8, T12 (the L2 producers), and straight down the graph.
5. Keep `artifacts/evidence/D2-red-green.md` current per case, and run the full suite per source-changing
   commit.
