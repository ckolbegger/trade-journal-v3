# D1 execution record

Implementation baseline: `db3580cdc1ee95b5056a4de6dc36430cdd71a421`.
Frozen specs tree: `7ca277bffbe19d0ca3c24fc703817a95af54639d`.
Worktree: `/Users/ckolbegger/src/trade-journal-v3/worktrees/codex-gpt-6.1-sol`.
Branch: `codex-gpt-6.1-sol`.
Authorization: explicit user kickoff, 2026-10-18, instantiating `/private/tmp/handoff-D1.md`.
No deployment or push is authorized or performed. Baseline specifications/plans and user configuration are read-only inputs.

Historical checkpoint after Account creation clarity, before requested Institution button copy: all six cumulative gates pass under source `d5d4ba6b0e4771699f7e625aea663a1c7e03a6973ad6177b7b6ae21b7c567c3f`: 63 unit, three integration, all 57 browser cases and the 25,000-Plan benchmark. Fresh critic07 passes its documented local B01–B05 checks (29 named checks, six clean axe audits), including two Accounts at one Institution and unchanged original Plan bindings; no implementation defect was found. Root verified the new form in the user’s existing tab using normal safe update activation with no typed draft present. Native install/zoom and production HTTPS limits remain; see the critic report for its additional evidence limits. No commit, push or deployment occurred.

Historical checkpoint after the Create Workspace repair, before Account creation clarity: 61 unit, three integration, all 54 native browser cases and the 25,000-Plan benchmark pass under exact source `7be7f33a14de48ba7acf0ac889ae1cebda833f3483e8ce659025fdcb822a5775`. Different fresh critic06 passes available local B01–B05, explicitly including rejected time zones and correction, with 29 clean axe audits and no implementation finding. Root verified the original failure and repair in the user’s existing tab. The repaired local preview is running at `http://localhost:5174`; no user Workspace was created or site data cleared. Native OS installation/browser-chrome zoom remain unverified; production HTTPS remains user-deferred. No commit, push or deployment occurred.

Historical checkpoint after the user-authorized capacity revision, before the time-zone feedback repair: all six cumulative gates pass under source `564da40305d97f30220c30934108df6f446c8148b81aec8cb937389a1b0996f6`; 58 unit, three integration and all 51 native browser checks pass with zero quota-based skips. Fresh independent critic05 passes available local B01–B05 in installed Google Chrome 155.0.8059.85, with 24 clean axe states. The 25,000-Plan benchmark passes. Native OS installation/browser-chrome zoom remain unverified and production HTTPS remains user-deferred. The local preview serves the verified final build at `http://localhost:5174`. No commit, push or deployment occurred.

Historical checkpoint before the user-authorized capacity revision: D1 implementation passes all final local cumulative checks and the fourth fresh independent critic found no implementation defect in available local B01–B05 checks. Twenty installed UI states have zero axe violations. Exact final source is `b026eee2a66928fbbb8ceebee3fa47d94d0fb01f756b065edd0587149ae36dfc`. Actual OS installation and native browser-chrome 200% zoom remain unverified host evidence; production HTTPS is explicitly deferred by the user. These limits prevent a blanket full-release acceptance claim, while the local implementation and applicable verification are complete. No deployment, commit or push occurred.

## Baseline and tooling

The initial worktree was clean and HEAD matched the baseline exactly. All four SHA-256 hashes in the handoff matched. `/opt/homebrew/bin/node` reported `v26.12.0`; npm reported `11.20.0`.

T01 installation used the exact approved direct pins. The first sandboxed registry attempt failed DNS resolution; the network-enabled retry succeeded with `npm install --strict-peer-deps`. A clean `npm ci --strict-peer-deps` then passed. No peer bypass, overrides, dependency patching, or direct `@typescript/old` dependency was used. See install/ci logs and the complete dependency tree.

Compiler routing observed: root `tsc` 7.0.2; `tsc6` 6.0.3; wrapper package 6.0.2; underlying API 6.0.3; typed ESLint 8.71.2 with ESLint 10.13.0. The handoff API-routing assertion exited zero. The native compiler path is explicit in the typecheck script.

The temporary lint probe failed with `@typescript-eslint/no-floating-promises`; the temporary compiler probe failed with TS2322. Both were removed. Representative effective lint configurations are retained for TS, TSX, worker, test, and tooling files. Initial worker-project emit configuration and generated declaration-file lint coverage were repaired before clean lint/typecheck/build. No typed rule was disabled.

A later emitted JSON capability manifest exposed a precache omission. The strengthened structural build check now compares every emitted runtime file and SHA-256 against the embedded worker inventory, excluding the necessarily separately digested worker itself. `t01-inventory-omission-red.txt` records the rejected build inventory; the corrected glob and complete build are recorded in its Green log. Workbox revision hashes are not substituted for SHA-256.

## Execution method and initial task checkpoint

Behavior tests were introduced and exercised incrementally. Each retained `tNN-XX-red.txt` is followed by its cumulative task Green log. Syntax/configuration/fixture failures are not claimed as application Red. Early cycles identify the fixed source baseline plus uncommitted implementation; subsequent `tools/evidence.mjs` runs retain exact command, exit, baseline, source digest, and source snapshot.

| Task | Cases / current evidence |
|---|---|
| T01 | Runtime pins, strict installation/ci, compiler/API routing, typed-lint/compiler probes, project coverage, production build and emitted-file inventory checks. Final cumulative gates remain required. |
| T02 | Seven cases: fixture P; aggregated invalid evidence; internal Stock-only expiration classification; tiny positive risk and exact 1/3; exact-candidate Planned reconciliation; malformed/blank decimal rejection; decimal normalization. |
| T03 | Six unit cases and native browser matrix: each functional failure, simultaneous failures, advisory protection, unreadable-root classification, Recovery Only, later failure, and durability outcomes. Native unreadable-root reopening is an additional pending browser case. |
| T04 | Six cases: exact D1-only seeds; rules-based time zone; idempotent reopen; seed rollback/conflict; unsupported/integrity-invalid root; complete initial generation publication and stale-generation rejection. D2 introduces the first actual source-version migration; no future schema transition is fabricated here. |
| T05 | Three cases: real reference creation; approved Unicode/whitespace/case duplicate normalization and conflict/parent rejection; snapshot-bound identity resolution. |
| T06 | Seven cases: atomic Plan/reflection; complete commit receipt; invalid/stale no-write; abort/late gate; altered reconciliation; separate times/identities/sequence after reopen; optional answers/Unanswered snapshots. |
| T07 | Four cases: coherent list/detail/history; Empty versus failure; snapshot-bound 50-row pagination; lifecycle disagreement without repair. |
| T08 | Four unit cases: first-run UI; validation/navigation/conflict/Cancel preservation; recovery reads with disabled mutation; protection and installation guidance. Full native keyboard/resize/zoom evidence remains pending. |
| T09 | Native verified installation and fully stopped offline reopening passed in WebKit. Verified update staging, unsaved-form deferral, explicit activation, and offline retention passed against two built releases. Failed-staging and complete current-release reruns remain required. |
| T10 | Not complete. Scale, cumulative final suites, fresh independent critic, actual install-capable-host evidence, and separate production HTTPS evidence remain gates. |

The initial T03 launch/recheck case passed immediately because earlier behavior already covered it. That attempt is explicitly retained as an invalid Red attempt. The missing immediate-invalidation assertion was then added, failed, and was implemented. Initial native fault-injection attempts also included harness failures; they are retained as attempts, not credited as passing native evidence. The diagnostic harness was narrowed after targeted observation showed it was aborting Dexie's open-validation transaction as well as the isolated diagnostic scope. Temporary debug logging was removed.

## Integration infrastructure

`tests/integration/d01-workflow.test.ts` uses real production coordinators, domain modules, and Dexie transactions. The only replacements are disclosed fake-indexeddb, explicit clocks, and host capability evidence. No application module is mocked. The storage-abort case hooks the real persistence boundary and aborts its actual transaction after Plan staging. Before/after/reopened root, version, lifecycle, and sequence state are compared.

I01, I02 and I06 currently pass. I03/I04 use actual browser storage/service workers/caches in the browser suite. I05 uses an injected test-only actor bundle calling the same production commands with the real BrowserHost and native persistence; it adds no product route and supplies no fabricated accepted application result.

## Native host provenance and limitations

All preview/browser commands use strict `http://localhost:5174`. The sandbox initially denied the local server bind; network-enabled browser execution was approved. Actual `isSecureContext` was observed true.

Chromium private and isolated persistent profiles, and Firefox persistent profiles, reported approximately 10 GiB origin quota on this machine. The approved D1 budget yields a pre-cache fresh-origin incremental requirement of 16,463,544,320 bytes; these environments correctly remain Unsupported. No browser/OS identity selects support, no host quota was raised, and no capacity condition was weakened.

WebKit's isolated persistent profile reported 20,615,843,021 bytes of quota and passed native readiness. Full writable/offline local flows use that host. Different-host negative results are retained rather than treated as writable evidence. Browser versions/OS and detailed storage/latency observations are recorded by execution, not inferred from the plan.

`D1-B01` closes the browser process, relaunches the same profile with networking disabled, checks the initial retained list, then compares the saved Plan fact identity and reflection/history through the production UI. An initial list-loading gap was reproduced before fixing it.

`D1-B04` uses two real local production builds. It checks complete staged assets before the notice, unchanged old controller while form values remain, disabled activation while dirty, explicit safe reload, new controller identity, retained Workspace, and subsequent offline reload. Static artifacts are restored after each test. This is local build verification, not deployment.

## Resource recipe

Approved budget inputs are unchanged: 25,000 Plans × 4 KiB; 200,000 later economic facts × 2 KiB; 600,000 Journal/history records × 4 KiB; 250,000 later observations × 1 KiB; 64 MiB other metadata, plus 100% index/private overhead. Modeled mature footprint M is 6,585,417,728 bytes before comparison with actual measurements. Later-kind counts are capacity reserves, never fabricated domain facts.

The native workload collects command-created installed counts, serialized payload bytes, origin estimates, cache assets, and actual browser evidence. The final resource receipt and required H = (max(0,M−L)+max(M,L)+C) × 1.25 derivation must be reviewed against those observations. Backup memory measurement remains D6. Quota estimates are not reservations; actual failures still abort and invalidate readiness.

## Release gates

D1 acceptance is not claimed by this work-in-progress record. In particular, local secure-loopback evidence cannot replace production HTTPS or actual installation evidence. Deployment and pushing implementation commits require separate authorization. Independent browser verification starts only after final cumulative unit/integration checks and must cover B01–B05 without implementation edits. Any defect requires a failing regression, repair, cumulative rerun, and a different fresh critic.

## Continuation: native scale diagnosis and independent code review

The original native I05 attempt timed out at 30 minutes after more than 14,000 production confirmations. `D1-I05-benchmark.json` retains that failure, not a passing scale result. A diagnostic on the preserved native profile recorded ten real confirmations in 2,214 ms, with cursor reads dominating and 25 storage estimates totaling 44 ms. Replacing the Catalog's compound `anyOf` cursor traversal with exact family-index reads reduced ten confirmations on the same profile to 83 ms. `i05-growth-probe*.txt` retain both measurements. The diagnostic only observes native calls and never supplies application results. Its optional test now requires an explicit `D1_PROBE_PROFILE`; ordinary benchmark execution must not depend on a machine-local profile path.

The code-review skill's separate read-only reviewers initially failed to start due to account usage, then succeeded on retry. The standards reviewer found no hard documented-standard violation and suggested consolidating duplicated worker-verification transport code; that optional refactor has not been made. The specification reviewer identified four defects: unrelated reference saves clearing retained Plan dirtiness, global worker activation over another tab, reference readiness failures leaving mutation controls enabled, and a false empty presentation during pending list reads. Each defect received a failing regression before its repair. The subsequent native WebKit suite passed all 15 then-current cases, including failed staging and the two-tab guard (`t10-native-cumulative.txt`). These code reviews do not replace the mandatory fresh browser critic.

Additional regressions rejected a candidate assessment whose baseline disagreed with independent derivation, and rejected incomplete authoritative data on reopen without repair. Startup validation uses fixed seed reads and indexed counts rather than materializing/replaying history. Catalog queries now select one requested family; application coordinators assemble the three installed planning families within one read snapshot.

WebKit on macOS follows the host's text-only Tab preference. Keyboard evidence uses native Option-Tab traversal to reach every control, without changing system preferences or focusing controls programmatically. Both narrow/wide keyboard, live resize, 200% zoom/reflow and axe checks passed. The initial ordinary-Tab failure is a disclosed host-keyboard harness attempt, not an application accessibility defect.

Strict typechecking of the new axe tests exposed distinct `playwright-core` 1.64.0/1.64.1 peer types. An exact direct `playwright-core` 1.64.0 pin aligns axe with the already selected Playwright version; strict peer installation passed without overrides or disabled checks. Both dev/preview occupied-port checks now pass (`t01-occupied-port.txt`).

The current scale rerun is in progress against frozen runtime inputs. Further source changes and the remaining acceptance gates must be followed by cumulative checks and final-build performance confirmation. No implementation commit, push or deployment has occurred.

## Final implementation checks

The final cumulative commands are retained as `D1-T10-final-{lint,unit,integration,build,browser}.json`, all exit zero under one exact source snapshot. `D1-I05-final-benchmark.json` records the corresponding scale run when finished. A clean final `npm ci --strict-peer-deps` passed, and `final-toolchain-provenance.json` records actual Node/npm/compiler/API versions, branch/baseline and approved input hashes.

New completion checks cover atomically committed size receipts, conservative missing-receipt behavior, typed family Catalog queries, Trade Anchor batch resolution, baseline/reconciliation agreement, complete existing initialization counts, and instant ordering across equivalent UTC offsets and nanosecond differences. The lifecycle index stores a sortable instant key while retaining the original Economic Time string and independent Recorded Sequence. This is the initial unreleased D1 physical schema, not an invented D2 migration.

The application now distinguishes same-named Accounts by Institution, displays frozen SingleSelect labels, formats saved instants in the Workspace time zone, explains validation/readiness failures, associates field errors, and preserves drafts while requiring safe retry after storage abort. Recovery validates retained contents before rendering. Header/schema checks also run at the persistence mutation gate, so an unknown-newer root cannot be written through a direct installed command.

Size receipts credit measured serialized active rows, metadata and the receipt once. They are conservative lower bounds: unmeasured physical/index overhead is not mislabeled as observed active storage or free space. A missing/deleted/stale private receipt credits zero without replaying history at startup. Cache sizing retains observed installation growth and a complete inventory-byte floor. The approved M/L/C/Q/H formula and 25% margin are unchanged; all-origin usage remains in Q, and retained releases are never credited as active data. The scale fixture records both serialized and actual native origin bytes; actual measured D1 storage is below the disclosed mature budget, whose later-kind reserves remain budgets only.

PNG fallbacks use the existing code-native SVG artwork at 192/512 pixels, following [Chrome's manifest guidance](https://web.dev/articles/add-manifest). Final release hashing and evidence snapshots preserve binary bytes. The release inventory contains all nine emitted runtime assets, including both PNGs and the worker. No installed browser/OS is selected by identity.

Harness corrections are disclosed rather than counted as product Red: an initial resource test build used an incorrectly narrowed test type; the first native abort snapshot raced Account-save completion; a UI history assertion needed to await its actual read result and failed-test cleanup. Their corrected tests use real results. Raw CLI evidence intentionally retains terminal whitespace; implementation-only `git diff --check` passes.


## Settled build verification (critic-ready)

The authoritative final local run uses `D1-T10-critic-ready-{lint,unit,integration,build,browser}.json` and `D1-I05-critic-ready-benchmark.json`, each recording the exact source snapshot. The cumulative result is 56 unit tests, three integration tests and 19 native browser checks passing, with 32 explicitly skipped writable-flow checks on the two measured low-quota hosts. These supersede earlier logs named final/ready/release; their names record historical execution stages, not acceptance claims.

The last review defects received individual Red/Green evidence: initial Recovery Only reads load immediately, initialization retains the cross-cutting RuntimeNotWritable context, and Planned rows include derived Unfilled readiness plus saved risk/reward/exact ratio. The specification reviewer inspected both final findings and reported no unresolved issue. The independent standards reviewer found no hard documented-standard violation. Neither review substitutes for the fresh browser critic.

`D1-I05-ready-benchmark.json` records an intentionally interrupted run: after its unit/integration/browser stages passed, a newly reproduced Recovery Only initial-loading defect made that build obsolete. It was stopped rather than credited. The settled-build benchmark above is the required replacement. Other failed or superseded scale attempts remain available for diagnosis.

User continuation: all implementation and verification stay local until the user judges the MVP sufficiently useful and explicitly says it is time to deploy. Cloudflare and production HTTPS verification are deferred by that instruction; no deployment request is pending. Local D1 acceptance must remain distinct from a production release claim.


Settled-build scale result: all 25,000 production confirmations completed with 25,000 Plan facts, 25,000 reflection Entries, 25,000 lifecycle memberships and 50,005 version rows. All-page identities/values and sampled detail/history remained equal after deleting private size receipts and after 50 stopped-browser offline relaunches. Missing receipts conservatively credit zero while retaining Writable on this host. Cold/warm nearest-rank p95 were 275.7754169999971 / 88.61654199997429 ms across exactly 50 trials each, below 2,500 / 1,500 ms. Cold index traces returned at most 100 rows; warm trials observed actual indexed queries.

Measured native WebKit 27.2 / Darwin 25.6.0 / Apple M4 Max / 68,719,476,736-byte RAM / Node v26.12.0: command payload 61,919,454 bytes; native origin use 146,246,422 bytes (readiness observation 146,246,480); quota 20,615,843,021. Capacity receipt: M=6,585,417,728, L=90,517,254 conservative serialized active bytes, C=582,574, Q=20,469,596,541, H=16,351,125,970 bytes. All six settled command wrappers exit zero with source digest `0985b99e60f7986eaf3693b2faf4388374534e6d060d8b385048414db5f2c6cd`; production release identity `12092e686a53550a45090f41eb805105c2335bd34c96c11abd040589bcee9421`.


## Independent attempt 01 and required repair

`critic-01/report.md` is a failed critic attempt, retained in full. It independently passed B01/B02 and all locally available B04/B05 checks, including native safety failures, stopped offline reopening, actual two-release staging/activation, keyboard operation, responsive state retention and its own scale-profile spot-check. It identified F01: the fresh Unsupported screen explained separate storage but omitted the explicit recommendation to try another browser required by UI/delivery/AC-DEL-004. That is an implementation defect, not a waived requirement.

`t08-unsupported-guidance-red.txt` fails for the missing recommendation. The smallest repair adds that recommendation only in Unsupported while retaining separate-storage and unavailable backup/Restore explanations. `t08-unsupported-guidance-green.txt` passes all 57 cumulative unit tests. No other implementation behavior changed. Full repaired-build commands use `critic02` stage names, followed by different fresh critic `critic-02`. The first critic's source remains immutable in its snapshot/report; `d01-benchmark-critic01.json` preserves its corresponding complete scale measurements.

The first critic verified rendering reflow using 200% engine CSS zoom and separately live breakpoints; it did not claim actual browser-chrome zoom, which headless WebKit did not expose. Actual OS installation was also unavailable in that host. Those host evidence limits remain explicit, separate from the user-deferred production HTTPS gate. The initial account usage interruption was resumed successfully; it is not a passing-critic substitute.

The first repaired-build lint attempt included the critic's raw multi-command REPL transcript named `session.js`, causing ordinary JavaScript lint failures on disconnected REPL fragments. Its bytes are retained unchanged as `critic-01/session.txt` and its report link updated. This is evidence classification, not a disabled rule or an application fix; the failed lint attempt is retained as `D1-T10-critic02-artifact-lint-attempt.json`.

Repaired build source snapshot: `09f1fb19d81e4ba06267dd4f81bd64fadce25e499f320cfcccdcd6d2a4ffab8a`; base release `42742c99abf6a9031cf8783bd135bc7450ec349b935c98a2f349b3cebe9f795f`. The `D1-T10-critic02-{lint,unit,integration,build,browser}.json` commands all exit zero with this same source, covering 57 unit, three integration and 19 native browser checks (32 disclosed low-quota writable skips). Scale reconfirmation and fresh attempt02 follow before final local status.


Repaired-build scale reconfirmation passed: `D1-I05-critic02-benchmark.json` exits zero under the same `09f1...ab8a` source snapshot. All 25,000 production commands and exactly 50 stopped offline cold/50 warm trials passed, with p95 277.6262090000091 / 88.22195800000918 ms. Native capacity M=6,585,417,728; conservative serialized L=90,517,254; C=582,768; Q=20,469,596,435; H=16,351,126,212.5; quota=20,615,843,021 and observed usage=146,246,586 bytes. `d01-benchmark.json` is this repaired-build raw result. `settled-build-verification.json` verifies byte equality to all six successful wrappers; its first-attempt counterpart is retained separately.


## Independent attempt 02 and semantic repair

`critic-02/report.md` preserves the second failed attempt. B01–B04 passed locally; the final state sweep found axe `landmark-unique` in a clean late-capacity-failure Recovery Only state. Recovery Only and Best Effort each exposed an unnamed complementary landmark. This is a moderate semantic best-practice finding, not a fabricated WCAG-AA contrast failure. The same existing pattern applied to the update advisory.

`t08-warning-landmarks-red.txt` fails for missing public accessible landmark names after a real application transition. The smallest repair adds distinct names to the existing Update available, Recovery Only and Storage protection asides; it changes no storage/workflow behavior. `t08-warning-landmarks-green.txt` passes all 58 cumulative unit cases. The first fixture attempt omitted the explicit update-check click; it is retained separately as a fixture failure, not valid Red. Repaired-build wrappers use `critic03` stage names, and independent attempt03 reads the complete frozen baseline and waits for exclusive runtime ownership. `d01-benchmark-critic02.json` retains the preceding exact-build measurements.

Third-attempt frozen source snapshot: `08075a01142b261888f1ad36be1d46faa424707850faad306bbc641da6dbcd3d`; base release `300a490ca6b84be520cae4fa04a13cea4bd4e1c0012897e781f91ae2f921c890`. All five `D1-T10-critic03-{lint,unit,integration,build,browser}.json` wrappers exit zero under this same snapshot (58 unit, three integration, 19 native browser checks and 32 disclosed writable skips). Scale reconfirmation remains required before critic03 runtime ownership.


Third-attempt scale reconfirmation: `D1-I05-critic03-benchmark.json` exits zero under source `08075a...cd3d`. All 25,000 production commands, full equivalence after private-receipt deletion and all 50 cold/50 warm stopped offline trials pass. p95 cold/warm = 275.47958299997845 / 84.41558400000213 ms. Capacity: M=6,585,417,728; serialized L=90,517,254; C=582,717; Q=20,469,596,340; H=16,351,126,148.75; quota=20,615,843,021 and usage=146,246,681 bytes. `d01-benchmark.json` now holds these final measurements, with earlier attempts preserved separately. All six successful `critic03` wrappers have the same source; the byte-equality verification is in `settled-build-verification.json`.


## Independent attempt 03 and reflow repair

`critic-03/report.md` preserves the third failed attempt. Native B01–B03/local B04, keyboard flows and 48 axe scans passed, but a visual check of supplemental CSS rendering zoom2 at 390 found Workspace navigation clipped outside the viewport even though document width reported no overflow. This is an observed rendering defect; it is not fabricated native browser-chrome zoom proof.

`t08-nav-reflow-native-red.txt` directly reproduces a navigation action extending beyond viewport bounds. Its smallest navigation wrapping repair passed the targeted 390 case. A supplemental onboarding check then reproduced heading text overflow under the same rendering condition (`t08-startup-reflow-red.txt`). One inherited `overflow-wrap:anywhere` declaration handles both; the navigation-specific declaration was removed as our own redundant change. Both 390 and 1440 keyboard/onboarding/Plan/reflow/history cases pass in `t08-startup-reflow-native-green.txt`, with each fixed navigation action fully in bounds and text not clipped.

The first full nav-only browser run incorrectly required the normal wide static sidebar to remain vertically on screen after scrolling the form. That test assumption was corrected: fixed narrow navigation must remain vertically in the viewport; wide navigation may scroll normally. Its failure is retained in `D1-T10-critic04-vertical-fixture-attempt.json`, not counted as a product defect. Earlier nav-only successful checks are retained with `critic04-navonly` names. The final shared wrapping source now proceeds through all cumulative checks and different fresh critic04; critic03 raw benchmark/source verification remain separately preserved.


Fourth-attempt final source `b026eee2a66928fbbb8ceebee3fa47d94d0fb01f756b065edd0587149ae36dfc`, base release `c61a00ab2f5941e47bf1b2b4436a779b74b40531b110fd4f9201adf864fef704`: all six `critic04` wrappers exit zero under one snapshot. 58 unit, three integration, 19 native browser checks pass with 32 observed low-quota writable skips. Final command-created 25,000-Plan workload and 50 cold/50 warm stopped offline trials pass, p95 270.8786670000118 / 61.87233399998513 ms. M=6,585,417,728; serialized L=90,517,254; C=582,999; Q=20,469,596,317; H=16,351,126,501.25; quota=20,615,843,021 and usage=146,246,704 bytes. The raw final measurements are `d01-benchmark.json`; exact source/gate equality is in `settled-build-verification.json`. Different fresh critic04 now owns the runtime; final local status remains pending its report.


## Final local outcome

The fourth different fresh critic completed its own B01–B05 attempt against the exact final build and found no implementation defect in the available local checks. See `critic-04/report.md` for independent actions, raw native evidence, 20 clean axe states, keyboard operation at both widths, individually visible/reachable navigation under supplemental reflow, atomic aborts, all readiness variants, fully stopped offline reopening and two-release update safety. Its runtime was stopped, port released, and exact base distribution restored. Earlier failed attempts remain explicitly failed; each finding has its own regression/repair and new cumulative run.

| Area | Final local status |
|---|---|
| T01 tooling/structure | Exact recorded Node/npm and compiler/API workaround; strict dependency resolution, lint, typecheck, build, binary inventory, occupied-port/omission/oversize probes pass. |
| T02–T07 domain/application/storage | Installed Planned-only operations, reference creation, initialization, atomic Plan/Journal publication, exact analysis and bounded reads/history pass. |
| T08–T09 UI/offline/update | Onboarding, forms, errors/recovery, responsive keyboard use, complete offline release and stopped restart, safe two-release update pass locally. |
| I01–I06 | Real-stack fixtures plus actual browser readiness/delivery and command-created target-scale evidence complete locally. |
| T10 cumulative | 58 unit + three integration + 19 native browser checks pass; 32 writable variants explicitly skip on actually insufficient-quota hosts. All six final `critic04` wrappers exit zero under one byte-verified source. |
| I05 performance | 25,000 command-created Plans; 50 cold/50 warm offline trials; p95 270.8786670000118 / 61.87233399998513 ms, under 2,500/1,500 ms. Exact/private-deletion equivalence and bounded index traces pass. |
| Fresh critic | Attempt 04 passes available local flow checks with no implementation finding. Actual installation/native browser-chrome zoom are unverified; full release acceptance is not claimed. |
| Production delivery | Explicitly deferred by the user until a sufficiently useful MVP and a later instruction. No deployment request is pending. |

Use `local-use.md` for the local production preview. `pending-verification.md` lists only the remaining host/deferred evidence gates. Frozen inputs and user configuration are preserved, with all four hashes and branch/HEAD in `final-baseline-preservation.json`. All implementation remains on the requested worktree/branch; no D2 or later capability was implemented.


## User-authorized capacity revision

The user authorized revising the mature-storage floor after native Chrome was blocked. `implementation/plan/d01-capacity-policy-revision.md` is the governing addendum; the original plan/specs remain byte-identical. The installed D1 envelope is 543,817,728 bytes with 25% incremental headroom, approximately 680 MB fresh before cache reserve. Functional storage, complete worker/inventory, real quota estimates, per-write checks and atomic rollback remain required. Chrome/Firefox acceptance no longer skips writable flows.

The native Chrome Red (`capacity-revision-chrome-suite-red.txt`) fails onboarding at its unchanged actual quota; `capacity-revision-chrome-suite-green.txt` passes after the policy change. The first newly enabled full suite (`D1-T10-capacity-revision-browser.json`) retained 47 passes and four failures. Chrome's two update/offline failures include failed network loads for cached module/style assets. The preview's `Vary: Origin` can distinguish service-worker installation fetches from resource requests: cache serving now ignores negotiation headers for fixed, same-origin, digest-verified release bytes while retaining URL/query matching. Existing real two-release browser cases are the regression seam. Initial synthetic Request probes did not reproduce the browser-generated request-header behavior and are retained as inconclusive probes.

Firefox's keyboard harness used macOS Option-Tab universally. It now uses ordinary Tab outside WebKit, and waits for a visible/enabled target before attempting traversal. A subsequent Chrome update assertion also raced reload: it now waits for the actual load event before checking the new controller. These are driver synchronization repairs, not altered application results. Initial targeted failures remain in `D1-T10-capacity-vary-targeted.json`; repeats and cumulative gates determine final status.


Revised final cumulative checks: all six `capacity-final` wrappers exit zero under one byte-verified source `564da40305d97f30220c30934108df6f446c8148b81aec8cb937389a1b0996f6`, base release `0df453b26465fd0b7da9c2cdeb6f48331b793ef8e6e285d12422f0239924c261`. Strict lint/typecheck/build, 58 unit, three integration and all 51 native Chromium/Firefox/WebKit browser variants pass, with zero quota-based skips. An additional 42 targeted Chrome/Firefox cases pass across three repetitions. Real Chrome available quota remains 10 GiB; post-onboarding H=681,965,867.5 bytes. No browser allowance or elevated quota was introduced.

The revised 25,000-command workload retains exactly 25,000 Plans, 25,000 reflection Entries, 25,000 lifecycle rows and 50,005 versions. Full result equivalence survives private receipt deletion. All 50 stopped offline cold/50 warm trials pass; p95 cold/warm = 264.33420800001477 / 69.42570799999521 ms. Observed usage=146,246,704 bytes, serialized L=90,517,254, M=543,817,728, C=582,999 and H=567,354,341.25. `d01-benchmark-before-capacity-revision.json` preserves the preceding final raw measurements; `d01-benchmark.json` holds this revision. `settled-build-verification.json` verifies exact source/gate equality. Independent critic05 passes available local B01–B05 checks with no new final-release finding; see `critic-05/report.md`. It restored the exact base distribution and stopped every owned runtime before releasing the port.


## Final revised local outcome

`critic-05/report.md` records the fresh independent pass in actual installed Google Chrome 155.0.8059.85, including full stopped-process offline reopening; invalid/stale/aborted saves; thirteen readiness/recovery and process-reopen byte comparisons; verified second-release updates; keyboard-only 390/1440 workflows; 24 clean axe scans and separate CSS2x reflow; Firefox/WebKit native startup and complete inventory spotchecks. No new final-release implementation defect was found. Actual OS installation and browser-chrome zoom remain unverified. Production HTTPS remains explicitly user-deferred.

Existing old-policy Chrome profiles upgrade without data/cache clearing after staging online and explicitly closing all old application clients. The critic also retained an old-release transient blank/MIME failure after abruptly stopping before the client lifecycle completed; close-all-client activation recovered normally. It did not recur in the final base or its next verified release. `local-use.md` gives the verified recovery route.

`final-local-verification.json` confirms no source changed after the six passing gates, links the fresh critic, and records the restored preview. `local-preview-check.json` verifies all nine served assets against exact release digests. Original baseline/specs and `.codex/config.toml` remain unchanged; the separately authorized capacity addendum is the only policy exception. All work remains local and uncommitted; no push/deployment or D2+ implementation occurred.


## User-reported Create Workspace validation defect

After critic05, the user reported that pressing Create Workspace flashed and returned to the same screen. Root reproduced the exact behavior through CUA in the user's existing IAB tab: the actual time-zone input was empty and the visible America/New_York text was only a placeholder. No Workspace was created. `timezone-empty-before.png` preserves the observed state. Blank, invalid and fixed-offset inputs all returned TimeZoneSelectionRequired without UI explanation. Prior happy-path tests and critics explicitly entered a valid zone, so their coverage missed this rejected-input path.

`D1-T08-timezone-validation-red.json` retains three valid UI Reds for missing alert/field indication/focus, with authoritative roots/versions required to remain empty before correction. The smallest UI repair provides a clear focused alert tied to the invalid field, preserves the entered value, blocks empty submission before Loading, and uses the existing Workspace contract for nonempty invalid-zone rejection. The placeholder now says e.g. rather than looking like a preselected zone. No default time zone, schema or storage-policy change is introduced. `D1-T08-timezone-validation-green.json` passes all 61 unit cases. Native browser regression exercises all rejected values, correction, focus, preserved input and axe in every engine. Cumulative timezone-final gates and a different fresh critic06 determine the repaired local outcome; critic05 remains historical rather than being claimed for this new build.


## Final time-zone repair verification

All six `timezone-final` wrappers exit zero under source `7be7f33a14de48ba7acf0ac889ae1cebda833f3483e8ce659025fdcb822a5775`, base release `4870cf845745ed4fd6668af735e76a044e459840651b6f2c5bbce7711d1d81a8`: strict lint/typecheck/build, 61 unit, three integration, all 54 native browser cases and the complete 25,000-command workload with 50 stopped offline cold/50 warm trials. p95 cold/warm is 271.1798339999805 / 75.70512500000768 ms. Exact full results survive private receipt deletion. Previous final measurements/verification remain in before-timezone-repair files; current raw measurements are `d01-benchmark.json`.

Different fresh `critic-06/report.md` passes all available local B01–B05, including the missing empty-submit path, invalid/fixed-offset rejection, retained input, focused accessible error, no initialization on rejection and valid correction. All 29 axe scans pass. Critic driver label/transaction-hook mistakes are separately disclosed as failed harness attempts, followed by new-profile corrected runs; no application result was substituted. Final source/specs/config and all ten dist files were preserved. Native OS install/browser-chrome zoom and user-deferred production HTTPS remain explicit limits.

Root directly reproduced Create Workspace in the user’s IAB tab before changing code and verified the visible focused error afterward (`timezone-empty-before.png`, `timezone-empty-after.png`). A normal staged worker activation was completed without clearing browser data. The tab remains ready for an explicit user time-zone selection; root did not choose a default or create a Workspace in that profile. `final-local-verification.json` confirms unchanged source after all gates and `local-preview-check.json` independently verifies all nine served final-release assets. No implementation commit, push, deployment or D2+ implementation occurred.


## Multiple Accounts per Institution investigation

The user reported inability to add a second Account. No product change or one-Account-limit fix is claimed: the existing Reference Catalog and production UI support distinct Account names under one Institution. The new public UI regression passes immediately (not valid Red), including adding after an existing confirmed Plan, retaining the same Institution parent, reopening and selecting either Account. `D1-T08-multiple-accounts-initial.json`, `D1-T08-multiple-accounts-after-plan.json` and final multiple-accounts unit/lint wrappers retain the attempts/results. All 62 cumulative unit cases pass; typed lint passes. Production source and served release remain exactly unchanged, independently compared to the preceding settled snapshot in `multiple-accounts-investigation.json`.

In isolated installed Chrome155.0.8059.85, native production UI created Taxable and Retirement under Account test broker. Both Account options remained available after reload (`multiple-accounts-native-initial.json`). The first native probe incorrectly requested an exact Account label even though native accessible naming included option text; allTextContents returned no matches and the probe threw Second Account missing. That was a driver error, not a valid product Red. The corrected native selector and waited control produced the retained pass.

Root read the user's actual Workspace/Plan Account options without altering labels: one saved Account and the Account form still containing that same name. Submitting the current Account form reproduced DuplicateLabel, displayed That name is already in use, and created no Account. No labels, saved facts or browser data were changed/deleted. Root returned to Workspace with its draft intact. The caller was asked whether the issue is locating the form, a save error or a missing saved Account; a different failing sequence still requires clarification rather than an invented implementation repair. Names remain distinguishable within Institution per the frozen Reference Catalog contract; no rule was relaxed.


## Clarified Account creation usability issue

The user clarified that the populated Account name and Save Account label appeared to update the first Account, obscuring that typing a different name creates another Account. The creation data path already supports multiple Accounts per Institution. The surgical presentation repair adds an Add Account heading/action, New Account name label and explicit separate-Account guidance. Existing draft preservation, account identity/parent rules, storage and success-time field clearing remain unchanged.

`D1-T08-account-creation-copy-red.json` is a valid public UI failure for missing explicit creation semantics. Green preserves first-run creation and proves the field is empty when returning after success, then adds a second Account at the same Institution. Native regression additionally reopens, selects either Account and confirms a Plan under the second. All current selectors reflect the new accessible names. An initial strict compiler attempt rejected a Playwright-only exact option in a Testing Library query; that driver typing attempt is retained separately, corrected without disabling typed checking. The full account-copy cumulative gates and different fresh critic07 govern this revised UI.


## Final Account creation clarity verification

All six account-copy wrappers exit zero under source `d5d4ba6b0e4771699f7e625aea663a1c7e03a6973ad6177b7b6ae21b7c567c3f`, base release `ab2297ad212bf6d6159b2c2471477358892b183a3d0e4706a792ca123f002e69`. Cumulative counts: 63 unit, three integration, all 57 native browser cases. The 25,000-command Plan/reflection workload, 50 stopped offline cold/50 warm trials, full result equivalence after private receipt deletion and bounded reads pass; p95 cold/warm 267.3072079999838 / 81.42662499996368 ms. Earlier measurements and final-verification records are preserved under before-account-copy names.

`critic-07/report.md` records fresh independent creation/blank-success-field/draft preservation/duplicate rejection, two Accounts at one Institution, correct new Plan bindings, unchanged original Plan, stopped offline reuse, all native readiness and safe two-release update flows as exercised. Twenty-nine named checks across seven groups pass; six axe audits pass. Driver-only attempts and the empty transaction-entry interception are disclosed and are not credited as product failures or successful transaction trace proof. A separate frozen Loading accessibility capture was not collected in this critic attempt; prior Loading evidence stays attributed to its own reports. Native OS installation/browser-chrome zoom and user-deferred production HTTPS remain explicit limits.

Root observed the user's empty draft fields before activating the new verified release using Reload to update, reopened Workspace and confirmed Add Account/New Account name/helper copy (`account-creation-after.png`). No saved Account was edited, created or deleted in the user's profile. All source remains byte-identical to the six passing gate snapshots; original specs/plans/config preserved. Own user preview is restored, with all nine served asset bytes/digests verified in `local-preview-check.json`. No commit, push, deployment or D2+ capability was introduced.


## Requested Add Institution button label

The user requested that Save Institution read Add Institution to match creation intent. Only that rendered text and existing test selectors changed; no new behavior/test, domain rule, schema or storage operation was introduced. All 63 unit tests, typed lint and strict TypeScript/build/inventory checks pass in the institution-label wrappers under one current snapshot. Root restarted the stopped local preview, used normal verified update activation in the user's empty-draft IAB tab, and directly observed Add Institution beside the already clarified Add Account form. No user record was created/edited/deleted. `add-institution-label.png` is the visible proof; `add-institution-label-verification.json` records current source and scoped gates. All nine served asset digests match.

The preceding complete D1 browser/scale/critic07 evidence remains explicitly attributed to its prior wording; those broad checks were not repeated for this requested one-button text change. Before-institution-label records preserve that prior final verification. No commit, push or deployment occurred.
