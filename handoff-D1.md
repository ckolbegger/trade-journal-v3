# Handoff — implement D1 · branch `deepseek-v41-flash`

**Purpose of the next session:** implement **D1, "Install, trust, and set up"** — 34 tasks — against the
frozen plan. No planning work is needed: the plan is frozen, the version profile is pinned, and the
change-control procedure is recorded. **Do not plan D8–D22, do not start D2–D7, and do not touch
`specs/`.**

This session runs the project's implementation kickoff prompt
([specs/evaluation/kickoff-prompt.md](specs/evaluation/kickoff-prompt.md)) instantiated for wave 1 at
[plan/kickoff-prompt-d1-2026-10-17.md](plan/kickoff-prompt-d1-2026-10-17.md).

This file is an operational briefing, not authority. Where it and the kickoff prompt disagree, **the
kickoff prompt wins**; where it and the freeze record disagree, **the freeze record wins**; where either
and `specs/` disagree, `specs/` wins.

| | |
|---|---|
| Branch | `deepseek-v41-flash` |
| Worktree | `/Users/ckolbegger/src/trade-journal-v3/worktrees/deepseek-v41-flash` |
| Tip at handoff | `fef7257`, identical to `origin/deepseek-v41-flash` |
| Frozen plan | [plan/freeze-2026-10-17.md](plan/freeze-2026-10-17.md) at the digest set in [plan/freeze-manifest-2026-10-17.sha256](plan/freeze-manifest-2026-10-17.sha256) |
| Product baseline | `specs/` at tree `7ca277bf…`, unedited since `main` baseline `700a953` |
| Date | 2026-10-18 |

---

## 0. Confirm you are in the right place — before anything else

```sh
cd /Users/ckolbegger/src/trade-journal-v3/worktrees/deepseek-v41-flash
git rev-parse --abbrev-ref HEAD                       # must print exactly: deepseek-v41-flash
git status --porcelain --untracked-files=all          # must print nothing
git rev-parse HEAD origin/deepseek-v41-flash          # must print the same SHA twice
```

Then verify the frozen revision is intact:

```sh
shasum -a 256 -c plan/freeze-manifest-2026-10-17.sha256     # 11 lines, each ending ": OK"
node scripts/check-deliverable-breakdown.mjs plan/deliverable-breakdowns/*.md   # 0 failures, 0 warnings
node scripts/audit-breakdown-coverage.mjs                                       # 0 failures, 0 warnings
node scripts/derive-acceptance-ownership.mjs                                    # 67 scenarios; 32 claimed
```

If the branch name is wrong, the tree is dirty with files you did not create, or a digest fails,
**stop and report it** rather than proceeding. If `git status` shows untracked files, they are not
yours — do not delete them.

**Why the path matters.** The repository root `/Users/ckolbegger/src/trade-journal-v3` is a separate
checkout on `main`. The seven *other* worktrees under `worktrees/` belong to other implementations and
are off-limits; this one is the eighth. This worktree must stay exactly two levels below the repo root for the `.claude/skills/`
symlinks to resolve.

**There is one stash in the shared repository:** `stash@{0}`, "On zcode-glm-5.3: in-flight T2.11 work at
rollback (bookmarked)". It belongs to another worktree. **Never apply, pop, drop or restore it.**

---

## 1. Read these first, in this order

1. `AGENTS.md` (worktree root) — behavioural rules. Short, and they bind.
2. [specs/evaluation/kickoff-prompt.md](specs/evaluation/kickoff-prompt.md) — the kickoff prompt itself,
   and then its instantiation at
   [plan/kickoff-prompt-d1-2026-10-17.md](plan/kickoff-prompt-d1-2026-10-17.md). The instance's prompt
   text is a **verbatim** copy of the `specs/` file with only the plan placeholder filled in and four
   branch notes appended, so read the `specs/` file as the authority and the instance as the filled-in
   copy. It carries scope, TDD discipline, the integration and critic gates, and the deviation rule.
3. [plan/freeze-2026-10-17.md](plan/freeze-2026-10-17.md) — **the approved plan revision.** §2 is the
   version profile, §7 the 15 interface seams D2–D7 depend on, §8 the change control, §12 the wave-2
   confirmation procedure, §13 what the next freeze needs.
4. [plan/deliverable-breakdowns/D1-install-trust-and-set-up.md](plan/deliverable-breakdowns/D1-install-trust-and-set-up.md)
   — **the work.** §0 scope and boundary, §2 the task graph, §3 all 34 task bodies, §4 the critic flow
   list, §5 acceptance coverage, §6 what counts as valid red evidence, §8 open items and risks.
5. `specs/README.md` and every document it indexes, plus
   `specs/acceptance/acceptance-contract.md`. D1's 10 scenarios are quoted from there.
6. [plan/acceptance-evidence-matrix-2026-10-11.md](plan/acceptance-evidence-matrix-2026-10-11.md) —
   read D1's ten rows: the five `DEL-*` rows, `CAP-001`, `REF-002`, and both `UI-*` rows. Five are
   `covered`, five are `planned` with a later completing
   owner; do not try to make a `planned` row pass.
7. [plan/planning-decisions-2026-10-10.md](plan/planning-decisions-2026-10-10.md) — **PD3** (stack),
   **PD4** (offline delivery and the declared scope), **PD8** (integrity-fixture rules), **PD18** (the
   linter), **PD19** (npm, hand-authored worker) — and read **PD10** before you write
   anything that touches fees.
8. [plan/freeze-errata-2026-10-17.md](plan/freeze-errata-2026-10-17.md) — E-001 is open and deferred to
   wave 2; E-002–E-009 are history. Read it so you can add an entry correctly.

**Not authority:** `trade-journal-v3-spec-consolidation-handoff-2026-08-26.md` and
`spec-handoff-2026-09-11.md` in the worktree root. They predate ADRs 0009/0010.

**Naming:** `PD<n>` is a planning decision, `D<n>` a deliverable, `T<n>` a task inside its own
breakdown. Task ids restart at `T1` in every file, so a cross-deliverable citation is always
`D<n>:T<m>`.

---

## 2. The job

Implement D1's **34 tasks in order**, starting with T1. The graph is validated: no cycles, every edge
declared, 16 dependency layers. T33 is the mock-free integration suite; T34 is the independent
browser-critic gate, and **D1 is not done until a fresh critic passes it**.

**Per non-structural (`B`) task:** one planned case at a time. Add exactly one `it should …` test through
the seam the task names, run it, confirm it fails *because the behaviour is absent*, then make the
smallest production change that passes it, then repeat. Record, per case: the task id and case phrase,
the exact command, the red observation with its failure reason, the green observation, and the commit or
working-tree digest. A test that passes immediately, or fails for a harness reason, is not red evidence.

**Per structural (`S`) task:** run its listed exact verification and keep the output. No invented unit
tests — `planning-protocol.md:113` exempts them.

**Before presenting D1:** `npm run test:unit`, `npm run test:integration`, `npm run typecheck`,
`npm run lint`, `npm run lint:layers`, `npm run build`, each exiting 0. D1 is the first deliverable, so
these are the entire cumulative set — there is nothing earlier to regress. Then the T34 critic.

**Definition of done for D1:**

- All 34 tasks have their evidence; the five `covered` scenarios have it end to end, and the five
  `planned` rows still name their later completing owner.
- T33's integration suite is green through the real stack with the `fake-indexeddb` substitution
  disclosed in `tests/substitutions.md`.
- A fresh critic, given the frozen specs and plan, starts the runtime itself and passes every §4 flow at
  **both** viewports, with the report kept.
- Every defect the critic found was first reproduced by an automated test, then fixed, then re-run with a
  fresh critic.
- The freeze manifest still verifies, or every change to a manifested file is recorded as an erratum.
- You report the fifteen §7 seams as landed-or-moved — that report is the input to wave 2.

### Kickoff rules the task list does not restate

These come from the kickoff prompt and are easy to lose between 34 task bodies:

- **The four delivery mechanisms are D1 work, not later hardening.** The Web App Manifest, the complete
  versioned Offline Release Inventory, the every-launch and post-update/Restore Runtime Readiness gate,
  and the persistence-level `RuntimeNotWritable` rejection belong to D1 (T12, T16–T21, T25, T29, T33).
  The prompt forbids deferring them as a later layer-only step.
- **Exercise every readiness state,** not the happy path: all checks passing; each check failing
  independently; at least two failing at once; unconfirmed storage protection with an accepted write and
  the warning kept visible; an unreadable existing store; and `Recovery Only`. Support is decided by
  those functional checks alone — never by a browser name, family, OS or user-agent allowlist.
- **Advertise only complete capability.** The Installed Capability Manifest (T28) declares what this
  release can do end to end, and capability owned by a later deliverable is *absent*, never a fabricated
  `Unavailable`.
- **No layer-only release boundary.** Every D1 task sits inside the vertical deliverable. A checkpoint
  that advertises no capability requires the plan's specific recorded approval, and freeze §5 records
  **none** — so there is nothing to invoke.
- **Stop rather than self-certify.** If a fresh critic, the runtime, or a browser cannot be provided, or
  a finding exposes a genuine ambiguity, stop and request direction. Do not mark the deliverable complete
  on your own evidence, and do not encode an ambiguity as expected behaviour and then test it.

---

## 3. The environment is decided; do not re-litigate it

**Runtime (PD19 and freeze §2):**

| | |
|---|---|
| Node | **26.12.0**, Homebrew: `/opt/homebrew/bin/node` → `Cellar/node/26.12.0/bin/node`. Range pin `^26.12.0` |
| npm | **11.20.0**, ships with that Node. **Nothing to install** — no pnpm, no shim, no corepack |
| Browsers | Playwright **1.64.1** wants Chromium build **1248** (`156.0.8078.4`) and WebKit build **2370** (`27.2`); both are already in `~/Library/Caches/ms-playwright` |
| OS | macOS 26.6.2, build 25G83, arm64 |
| Port | `DEV_PORT=5177` in the gitignored `.env.local`; `vite.config.ts` and `playwright.config.ts` must both read it |

**The dependency pin — write these exact versions into `package.json`.** Do not run
`npm install <pkg>` before that: it would resolve `latest` and silently break the pin.

```json
{
  "packageManager": "npm@11.20.0",
  "engines": { "node": "^26.12.0" },
  "devDependencies": {
    "@typescript/native": "npm:typescript@7.0.2",
    "typescript": "npm:@typescript/typescript6@6.0.2",
    "@types/node": "^26.6.5",
    "@types/react": "19.3.0",
    "@types/react-dom": "19.3.0",
    "@vitejs/plugin-react": "6.1.2",
    "vite": "8.3.4",
    "react": "19.3.1",
    "react-dom": "19.3.1",
    "vitest": "5.0.5",
    "jsdom": "30.1.3",
    "@testing-library/react": "16.3.3",
    "@testing-library/dom": "10.4.2",
    "fake-indexeddb": "6.2.6",
    "@playwright/test": "1.64.1",
    "axe-core": "4.14.0",
    "@axe-core/playwright": "4.14.0",
    "decimal.js": "10.6.0",
    "date-fns": "4.4.0",
    "workbox-build": "7.4.1",
    "workbox-window": "7.4.1",
    "eslint": "10.13.0",
    "typescript-eslint": "8.71.2",
    "@eslint/js": "10.0.1",
    "globals": "17.13.0"
  }
}
```

**Do not add `@vitejs/plugin-react-swc`.** The pinned React plugin is `@vitejs/plugin-react@6.1.2`,
which is Babel-based; SWC is not in the profile. Anything else you think you need is a missing pin,
which is an **erratum**, not a free choice (§6).

**TypeScript 7 needs TypeScript 6 installed beside it.** TS 7.0.x is the Go port and ships no
programmatic API, so `typescript-eslint@8.71.2` — whose peer range is `typescript >=4.8.4 <6.1.0` —
cannot run against it. That is why the two aliases above exist:

- `@typescript/native` aliases `typescript@7.0.2` and is the **only** source of the `tsc` binary.
- `typescript` resolves to `@typescript/typescript6@6.0.2`, which ships **only** `tsc6` and re-exports
  the 6.0 API, which is what satisfies the linter's peer range.

Consequences you must honour:

- `npm run typecheck` runs `tsc` **7.0.2**. `tsc6` exists for comparison and **must never gate
  anything**.
- **Application code, `scripts/`, and T2's boundary checker must not import `typescript` as an API.**
  The linter and its parser are the only permitted API consumers.
- T1's V1.8 asserts the triple: `npx tsc -v` → 7.0.2, `npx tsc6 -v` → 6.0.x, `npx eslint --version` →
  v10.13.0.

**`tsconfig.json` must state, explicitly rather than inherit:** `"types": ["node"]` (`types` now
defaults to `[]`, so `process` stops resolving), an explicit `rootDir`, `moduleResolution: "bundler"`
(`node10` is removed), `target` at `es2015` or later, `strict: true` written out, and no `baseUrl`,
`ignoreDeprecations`, `esModuleInterop: false` or `allowSyntheticDefaultImports: false`.

**`eslint.config.js` must be flat and syntactic:** `@eslint/js` recommended plus `typescript-eslint`'s
syntactic `recommended`, and **no `projectService` and no `project`**. A type-aware rule would analyse
through the 6.0 API while `npm run typecheck` gates on 7.0; the two could disagree behind a green gate
(PD18 item 4). `npm run lint` is declared and is **not** on the `npm run build` path — `npm run
lint:layers` keeps that role.

**Pre-flight, before T1:**

```sh
node --version            # v26.12.0
npm --version             # 11.20.0
npx --version             # 11.20.0
node -p "process.versions.node"
node -e "const [a,b]=process.versions.node.split('.').map(Number); if(a!==26||b<12){console.error('outside ^26.12.0');process.exit(1)}"
```

Then T1 creates `package.json` with the pin above, runs `npm install` once to generate
`package-lock.json`, and never resolves a version again.

---

## 4. What D1 must not silently break

Fifteen D1 tasks are the interface contract D2–D7 are written against (freeze §7). Implement them as
described; if one must change shape, that is a **wave-2 trigger**, not a local decision.

| Task | What it exports | What the frozen text assumes |
|---|---|---|
| T1 | toolchain, script names, `DEV_PORT`, the TS alias pair, syntactic ESLint | every recorded command; `tsc` is 7, `import "typescript"` is 6 |
| T3 | Vitest `unit`/`integration`, Playwright `narrow`/`wide`/`chromium`/`webkit`, substitution registry | every test path in D2–D7 |
| T5 | session calendar over the injected `Clock` | Expected Mark Date = latest completed regular session |
| T6 | Money/Price/Quantity over `decimal.js`, no fee-apportionment helper | exact decimals in every stored fact |
| T7 | browser-host port with typed absence | `recover` returns honest `NotConfigured` |
| T9 | store and index names, schema-version baseline, `FactRevision` fields | every later migration; D3:T11's index binding |
| T10 | migration runner: isolated candidate + atomic pointer flip | D2:T1 … D7:T1 |
| T11 | multi-store transaction seam: commit, abort, counted requests | the rollback proofs and query counts |
| T12 | persistence-level `RuntimeNotWritable` rejection | D2, D3, D6, D7 rely on it — **still uncited** (E-001) |
| T14 | snapshot-consistent multi-module read | D7's export snapshot |
| T15 | lifecycle index bound to `TradeId` + `FactRevision` | D2:T4, D3:T11, D4:T9, D6:T6 |
| T22 | `Journal.seedDefaults`: stable-keyed, idempotent, atomic, manifest-driven | D2–D6 grow the manifest |
| T25 | `Workspace.initialize`: seed in one transaction, return onboarding state | D2's first flow |
| T26 | `getStatus` vocabulary incl. `Recovery Only` and Integrity Blocked | D7 flow 7 |
| T28 | Installed Capability Manifest: installed-only, navigation-equal, release-bound | every deliverable's honesty |

**Two D1 choices carry migration cost and deserve care:** the lifecycle index entry must carry the
committed `FactRevision` (T15), because adding it later is a migration; and the seed manifest must be
driven by data rather than a hardcoded list (T22), because D2–D6 extend it.

---

## 5. Scope discipline

- **Only D1.** D2–D7 are frozen *provisionally* and must not be started until the wave-2 confirmation in
  freeze §12. Implement nothing that belongs to them, even if it looks cheap.
- **`specs/` is read-only.** If you believe a spec sentence is wrong, stop and cite both normative
  passages; do not choose an interpretation and do not edit `specs/`.
- **No latency figures anywhere** — not in code comments, not in evidence, not in a report. `AC-PERF-001`
  has no owner; D1 asserts boundedness only (index membership, a bounded batch, an asserted query count).
- **Fees are captured and excluded (PD10).** Record the fee fact, default it to explicit zero, and never
  let it enter a calculation.
- **No new dependency.** The pin is the set. If something is missing, record an erratum (§6) — that is a
  one-line register entry, not a negotiation.
- **Do not touch the stash, the root checkout, or any sibling worktree.**
- **Commit locally as you go**, one coherent unit per commit. **Do not push unless the user asks.** The
  branch is currently in sync; leaving it ahead is fine.

---

## 6. When something does not fit — change control (freeze §8)

| Class | Examples in D1 | What you do |
|---|---|---|
| **Errata** | a directory name differs from the breakdown's suggestion; a script spelling; a package the pin omitted; a missing task citation | Append an entry to [plan/freeze-errata-2026-10-17.md](plan/freeze-errata-2026-10-17.md), then re-stamp the manifest. No approval needed |
| **Adjustment** | a §7 seam's shape moves but every meaning and scenario status holds — a different `RuntimeNotWritable` payload field, a merged or split D1 task that keeps the graph valid | One message to the user, get a yes, record the entry, re-stamp |
| **Deviation** | durable format, public behaviour, capability scope, scenario status, or the graph's order changes — e.g. the lifecycle index cannot carry `FactRevision`, or Journal preparation cannot run inside the D1 transaction | **Stop.** Name the affected scenarios from the matrix, argue durable compatibility, get explicit approval, produce a new freeze revision |

An entry that cannot name a class is a deviation until it is classified. After any manifested-file change:

```sh
node scripts/check-deliverable-breakdown.mjs plan/deliverable-breakdowns/*.md   # 0 / 0
node scripts/audit-breakdown-coverage.mjs                                       # 0 / 0
shasum -a 256 -c plan/freeze-manifest-2026-10-17.sha256                          # regenerate first
```

**Open erratum you will meet:** **E-001** — D2, D3, D6 and D7 rely on the `RuntimeNotWritable` gate but
none cites `D1:T12`. It is applied at wave-2 confirmation, not during D1.

---

## 7. Traps

- **Breakdown files are parsed, not just read.** If you edit one: `-->` may appear only inside the single
  mermaid block; the parser runs from the first ` ```mermaid ` fence to the next line beginning `# `.
  `## 2. Task graph`, `## 3. Task detail` and `## 5. Acceptance coverage for D<n>` are matched literally,
  so a `## ` heading inside §3 hides every later task — use `### `. The §2 task-count claim must equal the
  `#### T` header count. Every `S` task body needs the literal `Exact verification`; every task needs
  `**Blocking edges:**`.
- **`RuntimeNotWritable` is a result branch, not an exception.** It must come from the persistence seam,
  with the UI bypassed, and the revisions must be unchanged.
- **A `Partial` coverage row is never a pass,** and the matrix's four `planned` D1 rows keep a named
  later owner.
- **Provenance is not an allowlist.** Browser and OS versions are recorded evidence; no code path may
  read them to decide support. Same for the Node version.
- **Disclose every substitution.** `fake-indexeddb` is the only one in the Node suites, and
  `tests/substitutions.md` must name it and its real-engine counterpart. Loopback automation never
  substitutes for production HTTPS evidence.
- **The critic is a fresh agent that starts the runtime itself** and returns structured actions,
  observations and status per flow. It does not edit implementation, and a defect it finds is a test
  failure first. It must **not** report planned future capability as a defect — D1 §4 carries the
  explicit "Intentional non-defects" list (installation not advertised, the update notice deferred to
  D22, no Trade/Plan/Journal/Position/Mark/report navigation, no provider recovery, no backup download,
  verification or Restore, Long Stock only, no calculations, chart or replay), and a finding against that
  list is a misreading rather than a bug.
- **Red evidence must be recorded per case**, not per task and not per suite.

---

## 8. Where D1 stops

D1 ends with the critic passing and this report ready for wave 2:

1. The fifteen §7 tasks green, each with its evidence.
2. The gate list green: `test:unit`, `test:integration`, `typecheck`, `lint`, `lint:layers`, `build`.
3. Both plan validators at 0/0 and the manifest verifying, or every manifested change recorded.
4. **For each of the fifteen seams: landed as contracted, or what moved.** That sentence is what lets
   D2–D7 be confirmed without re-reading 121 tasks. Any seam that moved is classified under §6 before
   wave 2 can open.
5. Apply **E-001** at confirmation time and re-stamp.

Do not begin D2 in the same session unless the user explicitly confirms wave 2.

---

## 9. Suggested first actions

1. Run the §0 checks and the four verification commands. Stop on anything unexpected.
2. Read §1's list in order — the freeze record and D1's §3 are the two that matter most.
3. Run the §3 pre-flight. Confirm Node 26.12.0 and npm 11.20.0.
4. Start **T1**: write `package.json` from the pin, `npm install` once, then `tsconfig.json`,
   `vite.config.ts`, `playwright.config.ts`, `eslint.config.js`, the shell, and the script names. Run
   T1's nine verifications, including V1.8 (the version triple) and V1.9 (a seeded lint violation must be
   caught).
5. Then T2, and straight down the graph.
