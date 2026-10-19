# Handoff: `claude-opus-5.5`, implement D1

> **Read [plan/kickoff.md](kickoff.md) first.** The text in its code block is your governing instruction: treat it as if the user had given it to you as your prompt, and follow all of it. This note adds the location checks, D1 specifics and working rules. If this note and the kickoff ever disagree, the kickoff wins.

Written 2026-10-18. It replaces `handoff-claude-opus-5.5-2026-10-11.md` as the starting point for implementation.

This session **implements D1, "Start a Workspace and confirm a Long Stock Plan"**, under the frozen plan at revision 4. Planning is finished for now:
- D1, D2 and D4–D8 have approved task breakdowns.
- D9–D28 get theirs one at a time, as plan revisions (decision 40).

No application code exists yet. T1.1 is the first task.

## 1. Confirm the location before anything else

The repository hosts several independent implementations of the same spec, each in its own git worktree under `worktrees/`. This work belongs **only** to:

| | |
|---|---|
| Worktree path | `/Users/ckolbegger/src/trade-journal-v3/worktrees/claude-opus-5.5` |
| Branch | `claude-opus-5.5` |
| Dev server port | `5175`, from the gitignored `.env.local` |
| Frozen plan | tag `claude-opus-5.5-plan-r4` (revision 4) |

Run these checks. Each one must match:

| Command | Expected |
|---|---|
| `git rev-parse --show-toplevel` | `/Users/ckolbegger/src/trade-journal-v3/worktrees/claude-opus-5.5` |
| `git branch --show-current` | `claude-opus-5.5` |
| `git status -sb` | `## claude-opus-5.5...origin/claude-opus-5.5`, with nothing ahead. The only untracked files are this note and the older handoff. |
| `git log --oneline -1` | `452f35b docs(plan): revision 4, TypeScript 7.0 checking with 6.0 API (decision 44)` |
| `git tag --points-at HEAD` | includes `claude-opus-5.5-plan-r4` |
| `grep DEV_PORT .env.local` | `DEV_PORT=5175` |
| `node --version` | `v26.x`, at or above `v26.12.0` (decision 43) |

About Node: it comes from Homebrew and isn't pinned there, so a later 26.x is fine. Record the exact version in `evidence/D01/provenance.md`.

If any check fails, **stop and ask the user**. In particular:
- Do not edit files, create branches, or `cd` into another worktree to fix things.
- Do not change the machine's Node installation, and do not proceed on another Node version.
- Leave the global TypeScript (7.0.2) alone. The project gets its versions from `package.json`.

**Never look at any other worktree** or another implementation's branch, such as `backup/codex-*`. The implementations are being compared, and reading another one contaminates the comparison.

The worktree's `.claude/settings.local.json` sets `"syncClaudeAiPlugins": false`, so synced claude.ai plugins such as `engineering:*` are intentionally absent. The project's skills are vendored in `.agents/skills/` (MattPocock/skills v1.3.1 plus the user's custom skills), linked from `.claude/skills/`.

## 2. How to start

The governing instruction is [plan/kickoff.md](kickoff.md). Follow it exactly. It requires reading two baselines in full.

**The `specs/` baseline:** `specs/README.md`, every document it indexes, and `specs/acceptance/acceptance-contract.md`.

**The frozen plan:**
- `plan/implementation-plan.md`: recorded decisions 1–44, the rules and cumulative obligations, the freeze record, the risks and the review queue.
- `plan/technology-stack.md`, including "Pinned versions".
- `plan/acceptance-matrix.md`.
- **`plan/D01-start-a-workspace-and-confirm-a-long-stock-plan.md`**, which is the work.

You may read D2–D8's breakdowns for context. They are part of the frozen plan, and several of them amend D1 (see section 3). Do not read the definition sections for D9–D28: the user's rule is to read only the deliverable definitions in play.

`specs/` and the frozen plan are read-only. If implementation needs a deviation:
1. Stop before making it.
2. Name the affected specification passages, acceptance scenarios and durable compatibility.
3. Ask for approval to revise the plan.

An approved revision is committed and tagged `claude-opus-5.5-plan-r<n>`; the next one is r5.

## 3. D1 specifics

### T1.1, the toolchain

Use exactly the pinned versions in `plan/technology-stack.md`, "Pinned versions". Anything else is a plan revision.

Generate and commit a `package-lock.json`, and use `npm ci`. Enforce Node through `engines` and `engine-strict`. Vite runs with `strictPort` on 5175.

TypeScript runs as two versions side by side (decision 44):

```json
"typescript": "npm:@typescript/typescript6@6.0.2",
"@typescript/native": "npm:typescript@7.0.2"
```

- `overrides` pins `@typescript/old` to `npm:typescript@6.0.3`.
- `npm run typecheck` runs `tsc`, which is 7.0.2.
- Typed linting imports `typescript`, which resolves to 6.0.3, and `tsc6` runs that same 6.0.3 compiler.
- The `tsconfig` sets TypeScript 7.0's changed defaults explicitly and uses none of the options 7.0 removed: no `baseUrl`, no `moduleResolution: node10`, no `target: es5`.
- `npm ci` must succeed without `--legacy-peer-deps`.

T1.1's verification is the structural row in D1's breakdown:

```bash
npm ci && npm run typecheck && npx tsc6 --noEmit && npm run lint && npm run test:unit && npm run build && npm run preview -- --strictPort
```

Also run `npx tsc --version` and `npx tsc6 --version`, and record both in `evidence/D01/structural.md`.

There's one open detail to check in T1.1. The wrapper package ships no `lib/tsserver.js`, so an editor TypeScript language server might not find a project server automatically. If it doesn't, the fix is to point it at `node_modules/@typescript/old`. This affects editor feedback only, not the build or the tests. Note the result in `structural.md`.

### The rest of D1

- **Order.** Follow D1's task graph. **T1.2's engine capability smoke test is a gate.** If any capability is false, stop for a discussion before T1.8.
- **Amendments that later breakdowns made to D1.** These are part of the frozen D1 and must be built now:
  - T1.7's two "versionchange" cases, added during D2's breakdown.
  - T1.20's superseded-session case, with the D2 reason "Updated in another tab: reload when ready". Its second reason, "replaced by a Restore in another tab", arrives with Restore in D8.
- **Do not build D8's copy early.** D1 uses A13's Recovery Only wording; D8's A143 replaces it only once backup exists. Likewise, D1's Installed Capability Manifest has no backup range.
- **`WorkspaceSnapshotBinding`** must name the Workspace database as well as the content revision (D8 A127 refines D1 T1.7). Build it that way from the start, so D8 doesn't need to change it.
- **TDD discipline.** Run every `it should` case red, then green, one at a time. Record the commands and outcomes in `evidence/D01/tdd-log.md`. A test that passes on its first run, or code written before its red, must be fixed and rerun to a genuine red, never logged and skipped. Structural tasks record their exact verification in `evidence/D01/structural.md`. Engine and OS versions go in `evidence/D01/provenance.md`.
- **Test cost.** Routine browser suites run in Chromium only, with the faults build. Evidence from all three engines belongs in RC, before the first Cloudflare publish.
- **The browser-critic gate (T1.30).**
  1. Run the cumulative unit and integration suites until they pass.
  2. Spawn a **fresh** critic agent. The frozen plan authorizes this spawn.
  3. The critic starts the app itself, drives the production UI in a browser, runs D1's flows C1.1–C1.11, and never edits code.
  4. Reproduce every defect it finds with a failing test first, then fix it, rerun the suites, and spawn another fresh critic.

  If a fresh agent or a browser can't be provided, stop and report. Never self-certify.
- **When the gate passes,** commit and create the local tag `claude-opus-5.5-d1` on that commit. D2's release harness builds the previous release from it (D2 A34).

D1 completes on the secure loopback origin `localhost:5175`. Production HTTPS evidence stays pending until the user sets up Cloudflare (decision 4).

## 4. Working rules

- Commit each finished task locally, with the co-author line. **Never push** unless the user asks.
- End every task with a complete cumulative suite run (unit, integration, browser once it exists, plus static and verify checks) recorded in `structural.md`, with full outputs in `evidence/<Dnn>/suite-runs/`. The TDD log's single-case rows do not prove the suites pass.
- Refer to document sections in words, never with the "§" sign.
- Lead with a recommendation and its tradeoff. Ask **one consequential decision at a time**, in prose.
- Check every user proposal against the spec. If one conflicts, quote the passages, offer the closest compliant design, and let the user choose.
- Prefer derived values over specialist estimates from the trader (decision 31). Answer "do we need this machinery?" questions directly and honestly.
- Don't plan far ahead of working code (decision 40).
- The user ends sessions when the context grows large. After each finished task, commit it, then update section 6 of this note with where D1 stands.

## 5. Out of scope

- Any deliverable other than D1, unless the user says otherwise. D2 can follow directly, since its breakdown is approved.
- D4's P14, the boundary between the "quantified pressure" and "routine" attention bands (decision 41). It must be settled before D4's first task, but not now.
- Breakdowns for D9–D28 and RC. D9's numbering will start at P36, A150 and decision 45.
- Editing `specs/`, or editing the frozen plan without an approved revision.
- Cloudflare setup, which the user will do, and verifying Marketdata.app's CORS support (due before D11's breakdown, decision 15).

## 6. D1 progress

Update this section at the end of each task.

| | |
|---|---|
| Tasks done | D1 complete: T1.1–T1.31. Gate T1.30 passed on 2026-10-19 by critic-2 (critic-1 found two C1.8 defects, fixed test-first in `bb283dd`). Tagged `claude-opus-5.5-d1`. Evidence in `evidence/D01/`. Open for the user: the T1.17 case 2 first-run pass, and critic-2's minor observations. |
| Next task | D2, when the user says so. TDD helper: `scratchpad/tdd.sh` (recreate if missing). |
| Last commit | `8dcefd3`, tagged `claude-opus-5.5-d1` (tag moved from the gate commit `0b90f10` by the user's approval, without a fresh critic run, to include the critic-2 onboarding fixes `5a61a8b`) |
| Open questions | `npm audit`: 3 high findings in `sharp` via the pinned `wrangler@4.147.0` (deploy-only); fixing needs a pin change, so a plan revision. Not blocking D1. |
