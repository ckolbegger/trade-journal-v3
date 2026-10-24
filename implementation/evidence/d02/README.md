# D2 local implementation evidence

D2 extends the retained D1 Long Stock Plan into one complete initial Position Change with one or more broker buys, exact holdings and opening analysis, Complete/Defer/Decline reflection, and reachable Journal-only Debt settlement. Later trading operations remain outside the installed slice. All work is local and uncommitted, based on `f36c52df0fdc101498067aaed1f5ffdc46185438` in the `codex-gpt-6.1-sol` worktree. Historical specs, the D2 draft, D1 evidence, lockfile and user secrets are preserved.

## Inputs and implementation decisions

The reviewed contract and original input digests are in `../../plan/d02-implementation-baseline.md`. Capacity arithmetic, measured per-opening bytes and the separate migration preflight are in `../../plan/d02-capacity-evidence.md`. The draft is historical input rather than a retroactively approved implementation baseline.

Each `D2-*.json` command record captures exact argv, exit, stdout/stderr, baseline HEAD, input hashes and a content digest pointing to `source-snapshots/<digest>.json`. Snapshots include actual source, tests, tools, manifests and configuration; they exclude secrets and browser profiles. Repeated stages now retain numbered attempts. Native records and screenshots live in `native/`. Fake IndexedDB results certify domain/transaction behavior only; native browser results certify the browser-owned persistence, readiness, update and offline paths.

## Coverage map

| Task / fixture | Production behavior and evidence |
| --- | --- |
| T01 | Historical D1 production-command fixture; staged validated generation copy, retained identities/domain versions, two seeds, atomic activation, blocked physical upgrade, source corruption, failed candidate seed/validation/activation and safe retry. `d02-migration.test.ts`, `d02-migration.spec.ts`, `D2-blocked-upgrade-*`, T01 records. |
| T02 | Exact multi-Execution opening, ownership/terms/chronology/quantity, analytical mismatch versus command coverage rejection, lot order and rational arithmetic. `d02-analysis.test.ts`, T02 records. |
| T03 | Inert Journal preparation, original trigger snapshots, Complete/Defer/Decline, stable obligation identity and Debt answer/decline/stale guards. `d02-journal.test.ts`, T03 records. |
| T04 / I01–I02 | One shared transaction binds all authority, root/index/sequence updates and returns after commit. Shared-store contender, abort/restart and stale/readiness rejection. `d02-opening.test.ts`, `d02-workflow.test.ts`, native B01/B03 trace and race. |
| T05 / I03 | Batched indexed Open reads/detail/history, identity anchors and exact reconstruction after deleting private receipts. `d02-reads.test.ts`, integration and scale checks. |
| T06 / I04 | Real opening and Debt forms, original definitions, validation, retained drafts, explicit conflict review, direct post-commit outcomes and lifecycle-specific list summaries. `d02-ui.test.tsx`, native UI/update/readiness checks. |
| T07 / B01 | Complete opening, exact 40@49 + 60@51 example, authoritative transaction trace, stopped offline restart. `d02-opening.spec.ts`. |
| T07 / B02 | Complete/Deferred/Declined, Cancel, Debt answer/decline and original snapshots. Unit/integration and native opening suite. |
| T07 / B03 | Same persistent browser-store race; migration, native abort and current readiness matrices for both opening and Debt. `d02-readiness.spec.ts`, `d02-migration.spec.ts`, integration. |
| T07 / B04 | Keyboard/reflow/AA, preserved drafts through safe updates, desktop/mobile and live breakpoint changes. `d02-opening.spec.ts`, `d02-update.spec.ts`; independent critic remains separately recorded. |

## Attempt classification and process limits

Behavior-caused Reds are retained as such, including missing opening command, exact arithmetic/Journal semantics, stale lifecycle revision, corrupted migration source and native blocked upgrade. The blocked-upgrade fix closes Dexie's pending open with its default cancellation semantics; a safe retry explicitly reopens. Source copy and activation are separate, validated operations.

Some T04 safety checks passed immediately because earlier shared guards and transaction implementation already handled them. In particular `D2-T04-case02-red.json` exited zero and is **not a valid Red**; cases 03/04/05 first checks also passed. These are regression proofs, not compliance with a separate Red for every planned behavior. We did not remove working guards to manufacture a Red.

An initial T03 missing-dispatch TypeError was not a behavior-caused Red; the later assertion Red superseded it. Early versions of the evidence runner overwrote repeated same-stage T03 attempt logs, although content snapshots remain; those missing attempt outputs cannot be reconstructed or claimed as retained proof. T02 retains its initial fixture ReferenceError attempt. Type/import/driver failures are attempts, not product findings.

The first native trace driver asserted an incorrect participant order; the corrected test asserts the actual complete set and a nonempty transaction trace. A WebKit failure-matrix driver deadline was shorter than the actual readiness timeout; its corrected deadline is explicit. The first cumulative browser run passed 91/93; Firefox keyboard traversal entered browser chrome from the last page control. The helper now traverses toward the target with Tab/Shift+Tab and preserves real keyboard actions; both isolated regressions passed without changing production code.

The first target-scale run completed historical population, migration and 50 Planned timing trials, then correctly rejected opening with `EntryBeforePlan`: its actor used a fixed 20:00 UTC instant earlier than the UI-created Plan. This was a fixture clock defect; the actor now binds one actual opening instant after population. The failed command and raw timings remain in `D2-final-d2-scale.json`. Subsequent scale runs also save migration/heap and per-phase raw trials before later phases, so a later failure cannot hide an earlier measurement.

The next scale attempt preserved migration and 50 Planned trials, then its opening actor was rejected with real control/inventory failures. The actor had been rebuilt after verification-tool edits; release identity includes those tools, so it no longer matched the already-built application. This was a harness/build provenance failure, not permission to bypass readiness. The corrected test checks actor versus target release identity before population. Application, actor, legacy actor and update release are rebuilt together after freezing release inputs; cumulative browser checks are repeated on that build. `D2-final-d2-scale-retry.json` retains the failed attempt.

Actual OS installation and installed launch, native browser-chrome 200% zoom, and production HTTPS remain unverified. CSS zoom is supplemental reflow evidence only. HTTPS/deployment is user-deferred. No test resets or injects faults into the user's existing browser Workspace. No D2 commit, push or deployment is authorized or performed.

## Current verification

The identity-frozen build passes lint, strict typecheck/production build/inventory, 107 unit, seven integration and all 93 native browser cases. The D2 target-scale benchmark passes with 25,000 retained Plans, 200 Open Trades, equal migration digests and 50 cold/50 warm trials per phase. `d02-benchmark.json` contains raw timings, migration and sampled JS heap; `d02-scale-population.json` contains exact Open reconstruction results. The inherited WebKit benchmark also passes (25,000 Plans, 50 cold/50 warm trials; p95 275.61 ms / 75.58 ms). The fresh independent critic passed available local B01–B04, including seven axe AA scans with zero violations; see [critic-01/report.md](critic-01/report.md). The critic never changed distribution files and handed back a free port after closing its profiles. The parent restored the production preview at http://localhost:5174/. All ten final emitted-file hashes match both the pre-critic and critic records. [final-local-verification.json](final-local-verification.json) records exact gates, release/source identity, measurements and delivery state. [pending-verification.md](pending-verification.md) records actual external/procedural limits and the unfixed partial Note overlap observation.

## Independent source reviews

| Standards | Specification |
| --- | --- |
| No actionable findings; reviewed standards/source-state limits are in [standards-review.md](standards-review.md). | One stale lifecycle FactRevision finding; inspected fix and genuine Red/Green regression are in [spec-review.md](spec-review.md). |

The browser critic is a separate fresh production-UI review, not either source-review agent. No D2 commit, push or deployment occurred. Existing user data remains untouched by test setup and faults. Existing tabs should activate the release using the normal verified update flow after saving or cancelling drafts.
