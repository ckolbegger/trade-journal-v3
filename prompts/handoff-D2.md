# D2 implementation handoff

Prepared 2026-10-21 for a fresh session in the same local repository.

## Start here: user authorization and scope

The user requested implementation of **D2 in a new session**, using the exact same process as D1, and asked for this kickoff. Treat this as D2-only implementation authorization. This session prepares the handoff; the receiving session performs the work. Do not implement D3 or later deliverables.

Use the accepted per-deliverable approach: read the product baseline, review the current deliverable against the actual preceding implementation, fix its contracts and durable compatibility, then execute one behavior at a time through cumulative verification and a fresh independent browser critic. Do not stop after proposing a plan, creating types/scaffolding, or completing only the domain layer.

The existing D2 breakdown is explicitly **provisional**, unlike the reviewed D1 plan used at the previous kickoff. First perform its focused review against the implemented D1. Record the reviewed request/results, schema/migration, numeric, capacity and evidence decisions, with exact input revision/digests, in a separate D2 implementation-baseline/addendum before behavior coding. Preserve the historical draft. This authorization permits proceeding after that review when it stays within the recorded D2 semantics; another routine permission round is unnecessary. A material product/contract deviation or genuine unresolved ambiguity still requires user resolution before encoding it. Do not relabel an unreviewed draft as an already approved frozen plan.

**Everything remains local.** The user explicitly deferred Cloudflare deployment until a sufficiently useful MVP and a later instruction. Do not deploy, provision hosting, or ask for deployment approval during D2. D1 commit/push authorization does not authorize D2 commits or pushes; obtain separate authorization for those actions.

## Workspace and exact starting baseline

- **Worktree:** `/Users/ckolbegger/src/trade-journal-v3/worktrees/codex-gpt-6.1-sol`
- **Branch:** `codex-gpt-6.1-sol`; tracking `origin/codex-gpt-6.1-sol`.
- **Starting HEAD:** `f36c52df0fdc101498067aaed1f5ffdc46185438` — `docs: preserve original D1 kickoff handoff in prompts`.
- **D1 implementation commit:** `a4a32475c168fba89b1bc4f525b73300b4da5d23` — `feat: implement local D1 Long Stock planning`; pushed to origin.
- **Frozen specs tree:** `7ca277bffbe19d0ca3c24fc703817a95af54639d`.
- At preparation, the branch is one commit ahead of origin: the original D1 handoff copy is committed locally but not pushed. This D2 handoff is being supplied separately; inspect actual status rather than assuming it is committed.

Use this worktree as the explicit working directory for every repository command/edit. Reuse the branch and checkout. Do not reset to a historical commit, switch to a sibling implementation, copy sibling secrets, or overwrite intervening user work. Preserve `.codex/config.toml`, `.env.local` and existing browser data. A later HEAD or dirty tree requires inspection, not a reset.

Verify these SHA-256 hashes against working copies before treating them as the recorded inputs:

| File relative to worktree | SHA-256 |
| --- | --- |
| `implementation/plan/d02-initial-stock-entry.md` | `f178999f16b99c3e961f4d2f63e55a5be6e86961d2b3c772e3f2614ccf3e62ec` |
| `implementation/technology-stack.md` | `c078489445a6cefdec797d295e3ad4e27a889468ade8c9b09d6840abdc9b6980` |
| `implementation/delivery-plan.md` | `811b49b60200ba43fca01cce9b1cc79bf36d11a41918f83fe5ab14d58cd55b33` |
| `implementation/plan/d01-capacity-policy-revision.md` | `ba560d7d8eb724fb6f74cdc0f5990cccb650b733302836a120393256f273ed64` |
| `package-lock.json` | `4a834319bc9f7a93451a5fadc18ad2bd107993735ca2a577faefe250d33acc55` |
| `specs/evaluation/kickoff-prompt.md` | `03c97d607bfd55e086b626a710a6475372320233c2e67ef8b5427016f85bc795` |

For differences, inspect `git show f36c52df0fdc101498067aaed1f5ffdc46185438:<relative-path>` and preserve any newer authorized changes. Frozen `specs/`, the original D1 plan and historical evidence are read-only inputs. The D2 draft's review/freeze is a current task, not permission to rewrite settled semantics.

## Read before coding

1. Read the worktree's `AGENTS.md` and applicable repository instructions.
2. Read [specs/README.md](../specs/README.md), its glossary and indexed ADRs, design overview, **all ten module contracts**, UI/delivery contracts, and the full [acceptance contract](../specs/acceptance/acceptance-contract.md). Follow the index's authority order. Later contracts constrain durable compatibility; they do not authorize later features.
3. Read the complete [D2 breakdown](../implementation/plan/d02-initial-stock-entry.md), the accepted planning approach and D2 boundary in the [delivery roadmap](../implementation/delivery-plan.md), and the [technology stack](../implementation/technology-stack.md).
4. Read the complete [D1 plan](../implementation/plan/d01-long-stock-plan.md) for inherited transaction, numerical, readiness, reconstruction, measurement and evidence procedures, together with the later authorized [capacity-policy revision](../implementation/plan/d01-capacity-policy-revision.md). The addendum supersedes the original capacity formula; do not resurrect the old floor.
5. Read [specs/evaluation/kickoff-prompt.md](../specs/evaluation/kickoff-prompt.md) in full. Instantiate its plan placeholder with the reviewed D2 baseline/addendum and exact input revision/digests. Restrict its generic deliverable wording to D2. Preserve the accepted backup/Restore timing exception and local-only delivery instruction.
6. Read the current [D1 evidence record](../implementation/evidence/d01/README.md), [final verification](../implementation/evidence/d01/final-local-verification.json), [remaining evidence](../implementation/evidence/d01/pending-verification.md), [critic07 report](../implementation/evidence/d01/critic-07/report.md), and [last label-change verification](../implementation/evidence/d01/add-institution-label-verification.json). These contain historical snapshots; attribute each result to its actual source/build. Later commits supersede old statements that nothing had yet been committed.
7. Inspect the actual production code, tests, scripts and capability manifest before proposing changes. D1 is implemented; this is not a new scaffold. The original [D1 kickoff](handoff-D1.md) is historical process context, not current scope or capacity authority.

## D1 inherited state and honest limits

D1 provides explicit rules-based Workspace time-zone selection, real Institutions and multiple Accounts per Institution, exact Long Stock Plans with fixed underlying-price Stop/Target and Plan Reflection, saved Planned list/detail/history, native readiness/recovery, and verified offline/update delivery. Preserve historical labels, identities, snapshots, economic/save times and Recorded Sequence.

Preserve the user-tested corrections:

- Blank, invalid and fixed-offset time zones show focused accessible feedback, retain input and write nothing; an explicit valid zone permits creation. Example placeholder text is not a selected default.
- Multiple differently named Accounts under one Institution work and remain selectable. Creation actions explicitly say **Add Institution** and **Add Account**, with **New Account name** and separate-Account guidance. Successful creation clears the field; unsaved drafts survive ordinary navigation. Do not make creation look like updating an existing record.
- Digest-verified fixed release assets are served despite server negotiation headers (`ignoreVary` in worker cache matching). Preserve the native Chrome offline/update regression.
- Browser identity never selects support. Best Effort storage protection is advisory; functional failures still reject authoritative writes.

The preceding full D1 run passed 63 unit, three integration and 57 native browser cases, the command-created 25,000-Plan benchmark with 50 stopped offline cold/50 warm trials, and critic07's documented local B01–B05 checks. The final **Add Institution** text change subsequently passed 63 unit tests, lint, strict typecheck/build/inventory, and direct verification in the user's IAB. Full browser/benchmark/critic checks were not repeated for that last one-button text change; do not claim otherwise. D2 must run current cumulative suites.

Actual OS installation/installed launch and native browser-chrome 200% zoom remain unverified. Production HTTPS is explicitly user-deferred. Critic07 also disclosed no separate frozen Loading accessibility capture and an empty attempted native transaction-entry trace; that trace is not proof. Keep these limits visible and collect available D2 evidence honestly. The user has now authorized local D2 work after this local D1 outcome; carry external release obligations forward without claiming they passed or treating them as permission to deploy.

The existing user browser profile contains real records. Do not delete its database, clear site data, seed test facts into it, or use it for fault injection. Build migration/failure evidence in isolated profiles and command-created D1 fixtures. Apply a completed release through normal verified updates with safe draft handling. Do not replace a user Workspace to make a test pass.

## D2 outcome and strict boundary

Deliver the complete production flow:

**retained Planned Trade → Trade Detail → record one complete initial Position Change → enter all broker buy Executions for that decision → Complete / Defer / Decline its reflection → commit → inspect returned Open Trade, Lots, opening fees, fulfillment, Entry Quality and Journal outcome → fully stopped offline reopening.**

Provide the reachable global Journal Debt queue and Trade Detail route, answering or declining Journal-only Debt against its original trigger-time definition. Defer creates Debt, not a blank Entry. Decline is an explicit outcome. Factual capture never waits for unrelated reflection Debt; due-Debt Daily Review blocking is D4.

One Long Stock Trade, exact planned Stock Instrument, one complete initial decision, one or several buy Executions whose total equals the frozen planned quantity. Preserve the plan's distinction between pure analytical mismatch findings and candidates the installed command must reject for missing management. Do not relabel mismatches as Explicitly Unplanned or invent coverage.

Do not expose partial initial entry, later adds, sells/exits, scaling, selective/unplanned legs, Marks/valuation, session-calendar operations, Daily Review, management revision, corrections, Journal Edit/Addendum/Void, reporting, backup or Restore. Those belong to later deliverables as recorded in the roadmap. No placeholder controls or incomplete variants in navigation/manifest. Preserve the accepted pre-D6 readable Recovery Only exception: reads/history/safe retry with an honest explanation that backup is not installed; Restore remains D17.

## Begin with D2-T01, then follow the task graph

1. Inspect branch/status, verify the inputs above and runtime, and perform the focused D2 review. Confirm the named public seams, exact request/result failure unions, post-commit receipt, durable representation, participant set and evidence fixtures. Record and freeze the resulting D2 implementation baseline before behavior coding; clarify only genuinely material unresolved choices.
2. Execute **D2-T01**: extend the actual D1 representation through validated staged-generation migration. The current `Store` has Dexie version 1; `rootHeaderFailure` and Workspace integrity validation assume D1 schema/seeds and Planned-only counts. Read and update those assumptions coherently rather than letting D2 invalidate itself or weakening validation. Inspect actual code instead of assuming the D1 planning document describes machinery already implemented. Physical schema/index additions require explicit Dexie versioning and blocked/old-tab handling. Preserve all prior authoritative data and usable compatible state on failure.
3. Follow completion edges exactly: T02 and T03 follow T01; T04 follows both; T05 follows T04; T06 integrates T04/T05; T07 waits for T01–T06. UI may prepare after contracts are fixed but cannot finish against canned results. No enabling task is a separate release.
4. Retain stable Position Change/Execution membership, ownership and intent, exact fees/instants/sequences, authoritative lifecycle/lot/deviation agreement, Journal obligation outcomes and trigger-time form history. Preparation is inert. Recheck all revision/generation/readiness bindings and atomically commit every participant. Return directly usable authoritative results only after commit; React neither coordinates participant writes nor performs an operation-required read-back.
5. Extend pure analysis through the plan's public seams. Keep decimal.js and the accepted lossless numerator/denominator representation for repeating averages, ratios and proportional fees. Preserve exact conservation/comparison; never feed displayed/rounded/native-number results back into financial derivation. Use the exact D2 fixtures and all planned invalid cases, not rounded approximations.
6. Build coherent Open reads/history/Anchor resolution and the opening/reflection/Debt UI. Keep current valuation absent. Preserve several entered Executions and reflection selections through validation, conflict and responsive navigation; Cancel writes nothing. Make creation/submission intent explicit rather than repeating D1's ambiguous form labels.
7. Complete T07 only after cumulative D1+D2 checks, migration/reconstruction, all D2 integration/browser flows, applicable scale evidence and a different fresh independent critic pass. Continue through the usable D2 outcome; do not end at a proposal or scaffold.

## Tooling and local runtime

- Rechecked at preparation: Node **26.12.0**, npm **11.20.0**. Use npm and the committed exact pins/lockfile. Do not perform opportunistic dependency upgrades or replace the scaffold.
- Preserve Microsoft's TypeScript compatibility workaround: `@typescript/native` is `npm:typescript@7.0.2` for compilation; `typescript` is `npm:@typescript/typescript6@6.0.2` for the lint API (underlying API 6.0.3 in D1). The typecheck script explicitly uses `node node_modules/@typescript/native/bin/tsc -b`. Preserve strict typed ESLint and the recorded compiler/API routing; no peer bypass, overrides or disabled typed rules. Read the supporting [compatibility research](../implementation/research/typescript-eslint-compatibility-2026-10-18.md).
- If reinstalling, use `npm ci --strict-peer-deps`. Verify actual package/API versions rather than assuming the aliases are interchangeable.
- Use strict **DEV_PORT=5174**, `http://localhost:5174`, production-built assets and actual secure-context/IndexedDB/worker/cache observations. Preserve `.env.local`; no sibling secrets. Existing scripts are `lint`, `typecheck`, `build`, `test:unit`, `test:integration`, `test:browser`, `test:benchmark`.
- A user preview may already own 5174. Identify the worktree-owned process and coordinate exclusive ownership; do not kill unrelated processes or silently move ports. The critic must start its own runtime after handback. Restore the exact settled base distribution and user preview after update tests/critic cleanup.

## Capacity and migration safety: carry the authorized revision forward

The original mature-floor formula locked Chrome out. The authorized addendum replaced it with an installed D1 envelope M=543,817,728 and incremental headroom `H=(max(0,M−L)+C)×1.25`, compared with actual `quota−usage`. It preserves conservative measured serialized lower bounds, complete cache estimates, functional diagnostics, failure invalidation and atomic rollback. Missing estimates/insufficient space remain failures. Never fabricate quota or skip writable Chrome/Firefox flows at an obsolete threshold.

D2 introduces both additional installed records and a real migration/candidate copy. Measure the added facts/indexes/history and actual concurrent live/candidate requirements; extend the disclosed installed-workload envelope and preflight migration resources at that operation. Do not blindly keep D1's M for the expanded workload, reintroduce reserves for uninstalled later capabilities, or charge a full speculative mature migration to every first save. Retain the 25% margin and distinguish origin quota, serialized lower bounds, physical allocation and peak memory. If measurements force a material policy/product change, surface it before implementing the change.

## Evidence, failure repair and independent acceptance

Keep a separate execution record under `implementation/evidence/d02/`, keyed to T01–T07, each planned behavior, I01–I04 and B01–B04. Use exact command/output/exit, source revision or content snapshot, actual environment, identities/revisions and durable-state proofs. Extend tooling where necessary without overwriting D1 evidence. Retain failed attempts with their true classification.

For each behavior: confirmed public seam → one failing test → run and verify a behavior-caused Red → smallest Green → earlier cases still Green → next case. Immediate passes or driver/configuration/type failures are not valid Red. Structural tasks use their reproducible checks. Refactoring is a separate Green review step, followed by affected checks.

Integration traverses actual production modules and transactions. Only disclosed compatible infrastructure/explicit clocks or identity inputs may replace host infrastructure; no application calculation, coordinator or accepted-result mocks. Fake-indexeddb cannot certify browser readiness, durability or offline delivery. Native failure injection stays in isolated test profiles.

Run every D2 fixture: complete/deferred/declined opening, competing saves and abort/restart, populated D1→D2 migration failure/interruption/stale-tab/retry and private reconstruction, and Debt answer/decline/stale revision/restart. For the shared-store race, prove that contenders actually share one browser-owned database: equal URLs in isolated BrowserContexts do not establish shared storage. Use independent clients/tabs on the same persistent store or another explicitly demonstrated shared-store arrangement; do not claim a race between isolated databases.

Repeat inherited readiness/update failure matrices with opening and Debt mutators: individual/simultaneous failures, unavailable estimates, unreadable existing data, Recovery Only, native abort, and Best Effort advisory behavior. Capture a working success-response/transaction trace rather than inheriting the empty attempted trace disclosed by critic07. Compare complete before/after/reopened authority, not only row counts. No partial membership, sequence, Debt or Open index may survive failure.

Extend target-scale evidence to the installed D2 stock workload with production command-created facts, bounded indexed Open reads, correct reconstruction and raw cold/warm percentiles. Review/freeze the exact population and measurement procedure; do not fill the database with invented later market/option facts. Preserve 25,000-Trade correctness and the mapped performance thresholds from the plans/contracts.

After cumulative lint/typecheck/build/unit/integration/browser and applicable benchmark checks pass on one settled source/build, **spawn a fresh independent critic**. This handoff explicitly requires that delegation. Give it the full frozen specs, reviewed D2 baseline, current/future boundary, exact build identity and all D2-B01–B04 flows. It starts its own strict production runtime and uses the production UI, native storage and actual browser APIs, without implementation edits or merely replaying the implementation author's results. Cumulative automation owns D1 regression; the critic need not manually repeat every previous deliverable.

Require per-flow actions, expected/observed results, status, screenshots, console/server evidence and actual browser/OS provenance. Include keyboard-only 390/1440 flows, live 767/768 transitions, 200% reflow, focus/radio/form semantics, AA contrast, and Loading/Empty/Error/Ready/validation/conflict/recovery states. Label supplemental CSS zoom honestly; it is not native browser-chrome zoom. Do not operate unrelated user windows to manufacture installation/zoom evidence.

For every implementation defect, retain the finding, reproduce it with an automated failing regression, minimally fix, rerun complete cumulative unit/integration and affected checks, then use a **different fresh critic for all current D2 flows**. A driver mistake is an attempt, not an application defect or passing proof. If specs/plan are genuinely ambiguous, pause that decision for clarification while continuing independent work. If a fresh critic, server or browser cannot be supplied, report the concrete blocker and leave that acceptance incomplete; do not self-certify.

Report exact local results and unresolved evidence limits. Carry OS-install/native-zoom/HTTPS obligations honestly; never silently mark them complete. Keep deployment and pushing implementation commits outside this authorization. The final result should be a usable local D2 slice with preserved D1 data and a concrete verification record.

## Suggested skills

- **tdd:** [worktree-local skill](../.agents/skills/tdd/SKILL.md), before behavior implementation; the reviewed D2 cases/public seams supply scope.
- **diagnosing-bugs:** [worktree-local skill](../.agents/skills/diagnosing-bugs/SKILL.md), for difficult migration, readiness, atomicity, UI or performance failures.
- **research:** [worktree-local skill](../.agents/skills/research/SKILL.md), only for unresolved implementation facts; use primary sources and retain findings. Existing pins/research already settle the compiler workaround.
- **code-review:** [worktree-local skill](../.agents/skills/code-review/SKILL.md), for standards/spec review of completed D2 changes against `f36c52df0fdc101498067aaed1f5ffdc46185438`; this complements the mandatory independent browser critic.

Use the receiving session's available skills and resolve paths explicitly. Main-checkout and worktree skill revisions can differ. No generic skill expands this into whole-product implementation, a new tracker, or an extra approval round for routine choices already authorized here.
