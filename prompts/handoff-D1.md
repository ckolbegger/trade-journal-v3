# D1 implementation handoff

Prepared 2026-10-18 for a fresh session in the same local repository.

## Start here: user authorization and scope

The user requested: “I would like to start D1 in a fresh session. Please prepare a file handoff-D1.md that I can give to a new session to have it start working on the app.” Treat this as authorization to implement **D1 only** against the baseline identified below. This document is the D1-only kickoff and records that authorization. Begin implementation after reading the baseline; another routine plan-approval round is unnecessary.

The user approved per-deliverable planning instead of detailing all 28 deliverables before coding. D1 received a focused review, and the subsequently discovered TypeScript/ESLint gap has exact pins and implementation instructions. Historical “planning draft,” “not implementation authorization,” and whole-product-freeze notices in the baseline record the earlier planning state. This later user instruction supersedes those notices for D1 implementation only. Product requirements and D1 verification gates remain authoritative. D2–D6 are provisional; D7–D28 remain the roadmap. Finish and evaluate D1 before preparing D2.

This session creates only this handoff. The receiving session may scaffold the app, create actual package/config/runtime-pin files, install dependencies and browser tooling, and implement/test D1. Cloudflare deployment still requires separate authorization under the plan. Earlier commit/push requests applied to the completed documentation changes; they are not standing permission to push future implementation work.

## Workspace and immutable baseline

- **Worktree:** `/Users/ckolbegger/src/trade-journal-v3/worktrees/codex-gpt-6.1-sol`
- **Branch:** `codex-gpt-6.1-sol`; tracking `origin/codex-gpt-6.1-sol`.
- **Baseline commit:** `db3580cdc1ee95b5056a4de6dc36430cdd71a421` (`docs: finalize lint pins and TypeScript compatibility instructions`), already pushed to origin.
- **Frozen specs tree at that commit:** `7ca277bffbe19d0ca3c24fc703817a95af54639d`.
- **State at handoff:** clean working tree, no application `package.json`, lockfile, runtime pin files, scaffold, application tests or collected application evidence.

Use that worktree as the explicit working directory for every repository command/edit. The parent checkout and sibling worktrees contain other work and different skill revisions. Reuse the existing branch/worktree. Inspect current status before editing; preserve intervening user changes and `.codex/config.toml`. A later HEAD is not a reason to reset the checkout.

Baseline files (SHA-256 of committed file contents):

| File relative to the worktree | SHA-256 |
| --- | --- |
| `implementation/plan/d01-long-stock-plan.md` | `8924a313da61e89fa580144db1a150cb79cba4b0cc1afbb14278090fb8ff0afc` |
| `implementation/technology-stack.md` | `c078489445a6cefdec797d295e3ad4e27a889468ade8c9b09d6840abdc9b6980` |
| `implementation/delivery-plan.md` | `811b49b60200ba43fca01cce9b1cc79bf36d11a41918f83fe5ab14d58cd55b33` |
| `implementation/research/typescript-eslint-compatibility-2026-10-18.md` | `95ef91ecc32b685833440d50453820a20609d41851ee5f97850cc4e335fc9d71` |

Verify hashes before treating working copies as the approved baseline. For an intervening difference, inspect the pinned contents with `git show db3580cdc1ee95b5056a4de6dc36430cdd71a421:<relative-path>` and resolve the discrepancy without overwriting user work. Treat the approved plan and `specs/` as read-only implementation inputs. For a material deviation, pause before implementing it, identify the affected specification passages, acceptance scenarios and durable compatibility, and obtain approval before revising the baseline.

## Read before implementing

1. Read the worktree's [AGENTS.md](/Users/ckolbegger/src/trade-journal-v3/worktrees/codex-gpt-6.1-sol/AGENTS.md).
2. Read [specs/README.md](/Users/ckolbegger/src/trade-journal-v3/worktrees/codex-gpt-6.1-sol/specs/README.md), then the glossary, indexed ADRs, design overview and all ten module contracts, UI/delivery contracts, and full acceptance contract. Use the index's authority order. The specs are the product baseline; understanding later contracts is a compatibility check, not permission to build later features. Consult relevant screenshot references when implementing the UI.
3. Read the complete [D1 plan](/Users/ckolbegger/src/trade-journal-v3/worktrees/codex-gpt-6.1-sol/implementation/plan/d01-long-stock-plan.md), [stack selection](/Users/ckolbegger/src/trade-journal-v3/worktrees/codex-gpt-6.1-sol/implementation/technology-stack.md), and the accepted planning approach plus D1 boundary in the [delivery roadmap](/Users/ckolbegger/src/trade-journal-v3/worktrees/codex-gpt-6.1-sol/implementation/delivery-plan.md).
4. For T01, read the plan's “TypeScript 7 and ESLint compatibility — pins finalized 2026-10-18” section and its [supporting research](/Users/ckolbegger/src/trade-journal-v3/worktrees/codex-gpt-6.1-sol/implementation/research/typescript-eslint-compatibility-2026-10-18.md). The exact package fragment, aliases, scripts and verification probe are there; use them directly.

5. Read [specs/evaluation/kickoff-prompt.md](/Users/ckolbegger/src/trade-journal-v3/worktrees/codex-gpt-6.1-sol/specs/evaluation/kickoff-prompt.md) in full and apply its execution requirements. Its approved-plan placeholder is instantiated by the D1 plan path and immutable revision above. This handoff restricts its generic deliverable wording to D1 under the user-approved per-deliverable process; the recorded backup/Restore timing exception remains in force.

## D1 outcome and implementation boundary

Deliver the production flow: first secure launch/readiness → Workspace time zone → real Institution and Account → confirm a Long Stock Plan with fixed underlying-price Stop/Target and completed Plan Reflection → returned Planned Trade → saved list/detail/history → fully stopped-app offline reopening.

D1's focused review made Planned-only analysis/reconciliation, economic/save-time and Journal provenance retention, and Planned-list performance evidence explicit. The plan has ten tasks with blocking edges, six integration fixtures and five browser flows. Its local acceptance matrix is the D1 execution map; the 67-ID ledger also declares later completion points rather than claiming full-product coverage now.

Keep the slice dependency-closed. Implement current consumers of the canonical modules, retaining stable identities, immutable snapshots/history, precise values, economic ordering and generation/version safety for future compatibility. Future operations and navigation remain absent. Stock executions/fees belong to D2, session-calendar execution to D3, Daily Review to D4, closure to D5, backup to D6, and Restore to D17. In particular, the accepted pre-D6 Recovery Only exception offers reads/history/safe retry with an honest explanation of unavailable backup; it does not promise transfer/recovery from a verified file.

D1 scale evidence uses command-created **25,000 Planned Trades** and Planned-list browsing. Future Open/Execution/Market counts in shared research are capacity reserves or later evidence obligations, not facts to fabricate in D1. Preserve the accepted storage measurement recipe and 25% headroom margin; measurements remain to be collected.

## Begin with D1-T01, then follow the graph

1. Verify branch/worktree, working-copy baseline and actual runtime. Homebrew was read-only checked at `/opt/homebrew/bin/node` **26.12.0** and `/opt/homebrew/bin/npm` **11.20.0**. Use **npm**, exact direct dependencies and a committed `package-lock.json`. Confirm the versions again in the new session.
2. Execute **D1-T01** using the plan's exact tooling instructions. This is where actual `package.json`, `.node-version`, TSConfig/ESLint/build/test configuration and lockfile are created. The Microsoft workaround is essential: `typescript` resolves to the TypeScript 6 compatibility API while `@typescript/native` supplies the selected TypeScript 7 compiler. Check both the wrapper and underlying API versions and the explicit native compiler path. `npm ci --strict-peer-deps`, real typed lint, strict TypeScript 7 checking and build must pass without bypassing peers or disabling typed rules.
3. Record T01's reproducible structural checks, then implement **T02–T10** according to their explicit blocking edges. T01 is an enabling task inside D1, not a separately completed application release. Continue through the usable D1 outcome.
4. Use the worktree's strict **DEV_PORT=5174** for dev/preview/browser automation. Production-built assets, actual secure-context observation, browser-owned IndexedDB and real service-worker/cache control are required for browser evidence. Keep all environment/configuration local to this worktree; load no sibling secrets.

Keep an execution record keyed to D1 task IDs, individual planned behavior cases, I01–I06 and B01–B05. Record commands, exit/output, source revision, durable-state proofs, failures and repairs. The plan remains the specification; execution evidence belongs in separate implementation artifacts.

## Evidence and completion

Follow the plan's per-case **Red → smallest Green → next case** procedure at confirmed public seams. A valid Red fails for missing/incorrect behavior; an immediate pass or syntax/configuration/fixture/unrelated failure is not valid Red evidence. Green preserves all earlier task cases. Refactor only after Green as a separate review step, then rerun affected tests. Retain commands and outcomes for every planned behavior. Structural tasks use reproducible checks rather than invented unit tests. Unit mocks are permitted only as the plan allows; integration uses no application mocks/stubs/canned responses and traverses the real stack. Only disclosed infrastructure replacements are permitted; fake-indexeddb fast tests cannot prove actual host readiness/offline durability.

D1 is complete only after its cumulative lint, typecheck, build, unit/integration/browser and applicable benchmark/rebuild checks pass, plus all D1 browser flows receive a **fresh independent critic** pass. Give the critic the complete frozen specs, approved plan and current/future capability boundaries. It starts the runtime itself, exercises every D1 browser flow through the production UI and makes no implementation edits. Require a per-flow report with actions, observed result and pass/fail; failures include reproducible steps, expected versus actual results and relevant screenshot/console/server evidence. Future uninstalled capabilities are not defects. Convert each implementation defect into a failing regression before fixing it, rerun complete cumulative unit/integration suites and affected checks, then use a different fresh critic for the next full D1 attempt. If a finding exposes a genuine spec/plan ambiguity, pause for clarification before encoding an invented expectation. If the environment cannot supply a fresh critic/browser/runtime, report the blocker and leave acceptance incomplete.

PWA identity, complete digest-valid offline inventory, every-launch/update readiness and the persistence-level `RuntimeNotWritable` gate are D1 requirements before authoritative mutation. Support depends on functional checks, never browser/OS/user-agent allowlists; preserve evidence of simultaneous readiness failures, unreadable existing storage and Recovery Only. The detailed plan covers recovery/integrity failures, protected-vs-best-effort reporting, update safety, accessibility/responsive parity and performance. Production HTTPS evidence remains a release gate; complete local work before seeking any required deployment approval with a concrete reviewable result. Actual browser/OS versions, byte thresholds and performance numbers must come from execution, not this handoff.

## Suggested skills

Read the applicable skill's `SKILL.md` through the new session's supported skill mechanism:

- **tdd:** before behavior implementation, use the worktree-local [.agents/skills/tdd/SKILL.md](/Users/ckolbegger/src/trade-journal-v3/worktrees/codex-gpt-6.1-sol/.agents/skills/tdd/SKILL.md). D1's already-reviewed seams and planned cases supply the confirmed scope; follow the recorded per-case execution procedure.
- **research:** when an implementation fact is genuinely unresolved, verify primary sources and preserve findings; the existing lint research already settles the selected alias/pin recipe.
- **diagnosing-bugs:** for difficult failures or performance regressions encountered during execution.
- **code-review:** when reviewing completed D1 changes against fixed baseline `db3580cdc1ee95b5056a4de6dc36430cdd71a421`; this complements the mandatory browser critic.

The checkout's task plan is the execution source. A generic skill must not expand this into whole-product implementation or require converting the reviewed tasks to a new issue tracker before starting. Main-checkout and worktree skill sets differ; resolve skill paths explicitly and follow user scope over generic defaults.
