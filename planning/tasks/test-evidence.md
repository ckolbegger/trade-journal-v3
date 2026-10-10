# D1–D3 test fixtures and evidence procedures

Status: planning only, 2026-10-10. The test titles, commands and paths below are proposed implementation requirements. No package scripts, application, test results, screenshots or benchmark measurements have been created by this planning task.

[Planning index](../task-breakdown-d1-d3.md) · [D1](d1-stock-open.md) · [D2](d2-stock-review-close.md) · [D3](d3-single-option-provider.md) · [Acceptance map](../acceptance-map-d1-d3.md)

## Test layers and execution rules

Unit cases target the named canonical operation or its confirmed internal Persistence/Transaction, delivery-host, adapter or UI seam. Pure Trade Analysis receives explicit facts/evidence/time inputs and performs no storage, provider, calendar or clock I/O. Unit dependencies may be mocked for isolation; a public command is tested for its result, participant intent and no-write failure rather than asserted private implementation layout. UI unit cases exercise accessible DOM behavior through public-port dependencies.

Each behavior-bearing task records one `describe("<Task-ID> <behavior>")` group and its concrete `it should ...` cases. Implementation proceeds one case at a time:

1. Add the next case before its production behavior; run the exact case selector. Record a behavioral failure, not a syntax/setup/fixture failure.
2. Make the smallest production change, run that case plus the task's already-green cases, and record passing results.
3. Repeat for the next case. Do not write all tests and then all production behavior.
4. Any refactor is a separate review step with affected tests rerun.
5. Run cumulative unit/integration suites at task completion; retain the commands, test IDs and red/green outcomes.

Structural tasks state reproducible checks instead of artificial unit cases. A schema migration with validation/rollback behavior is behavior-bearing and has unit cases.

Automated integration uses production application/domain modules, semantic coordinators and **actual browser-owned IndexedDB** through Dexie. No application dependency mocks, stub domain ports, fake provider responses, fake readiness success or fake transaction receipts are permitted in acceptance/integration. We choose actual browser storage even though the canonical protocol permits disclosed compatible infrastructure replacements. Browser acceptance runs the built production UI, not a story/demo screen. Each D#-A flow is an integration specification and a production-browser/fresh-critic checklist; shared B flows are parameterized by the installed deliverable.

Fault injection changes actual infrastructure behavior: transaction abort/denied operations, real network loss, worker control, served asset bytes, available storage and process interruption. Disclose controls and timing. Never replace a module with a canned outcome or flip a gate to passing. For capacity failure use a genuinely constrained/filled isolated profile so its actual estimate falls below the derived bound; unit tests may isolate estimate inputs. Test-only telemetry records operation/query counts but cannot mutate authority or bypass write gating.

Ordinary fixtures use public commands or a supported validated Restore assembled from legal semantic histories. Direct authoritative store mutation is permitted only for the explicitly isolated integrity-corruption specimen, with its injection recorded. Private-store deletion is permitted only for reconstruction evidence. Neither procedure is an ordinary data-seeding shortcut.

## Proposed commands and evidence records

D1-T01 establishes these scripts after the complete implementation plan is approved. They are proposed command interfaces, not currently runnable scripts. Pin compatible package/runtime/Playwright browser versions and commit the lockfile during implementation; record exact versions before plan freeze. Development and built preview use the configured worktree `DEV_PORT=5174` and `strictPort`; automated tests must not silently move to another port.

```sh
npm ci
npm run typecheck
npm run lint
npm run build
npm run test:unit -- tests/unit/D1-T09.test.ts -t D1-T09-U01
npm run test:unit
npm run test:integration -- --project=chromium
npm run test:acceptance -- --project=chromium --grep 'D1-A|D1 B-'
npm run test:provider -- --project=chromium --grep 'D3-A0[789]'
npm run benchmark -- --deliverable D2 --profile installed-scale
```

For another case substitute the literal task/case IDs. For a current acceptance flow select its exact D#-A ID. The acceptance suite also creates titles `D1 B-01`, `D2 B-01`, etc., through `B-12`. Browser integration cases live under `tests/integration/<Flow-ID>.spec.ts`; production UI cases under `tests/acceptance/<Flow-ID>.spec.ts`; unit files under `tests/unit/<Task-ID>.test.ts`. Shared browser cases live under `tests/acceptance/shared/`. The live-provider suite selects the same D3 flow IDs and cannot pass using saved JSON or mocked network. The complete integration/acceptance scripts run all previously installed flows, not just the grep used while debugging.

Use isolated browser profiles/test Workspaces. Disclose exact browser/OS, hardware, dependency/runtime, application/lockfile/inventory hashes, origin, schema, time zone/calendar version, fault controls and any unavailable evidence environment. Chromium is the automation baseline, not a product allowlist. Capture production HTTPS plus installation where exposed and ordinary-tab evidence in a separate actual environment if the automation environment does not expose installation. Select and record that environment before the full plan is frozen; no unsupported browser identity rule is allowed.

Implementation evidence lives at the proposed `planning/evidence/D#/run-<id>/`, with:

- `unit-red-green.md`: case ID, behavioral failure, red command/result, minimal green command/result and task regression result.
- `integration.json`: case/fixture IDs, source release, authoritative before/after manifests, return receipts, query traces, failure/restart observations.
- `browser.md`: actual actions, expected/observed results, state/focus/accessibility evidence, screenshots and sanitized console/server logs.
- `delivery.json`: HTTPS/origin, manifests/inventory hashes, functional gate outcomes, capacity calculation, worker identity and update/offline/readiness boundaries.
- `benchmark.json`: dataset generation/provenance/counts, expected complete results, all raw timings, percentile method, environment and bounded-query traces.
- `critic.md`: fresh agent identity, its own runtime start, flow-by-flow actions/result/pass or defect reproduction and supporting artifacts.

These paths describe required future evidence and are not passing evidence themselves.

## Authoritative before/after and durable proof

For every rejection, preview, read-only operation, stale command and abort, compare a consistent authoritative manifest: Workspace binding and settings, installed sections' stable IDs, immutable versions, recorded/economic ordering, exact values, effective heads, lifecycle/agreement records, Journal obligations/outcomes and revision counters. A returned validation error or unchanged screen alone proves no rollback. Exclude private projections and the isolated diagnostic store from authority comparison; do not ignore durable participant revisions.

For accepted commands compare the returned post-commit state against the committed authoritative facts, then terminate the runtime and reopen. Check IDs, saved definitions/labels, Lots/fees/lineage, Debt and public results. Interruptions have exactly before or after state, never a hybrid. For selected-file backup verification inspect the actual downloaded/read file bytes and digest, not an in-memory serialization. For secret exclusion scan actual exported content and sanitized logs/views with disposable known secret markers; do not print real credentials in evidence.

Prepare operations reserve no durable IDs or placeholders. Reads do not repair disagreement. The only legitimate writes during Review open are valid optional provider observations introduced in D3; D2 open is nonmutating. Mark correction saves do not silently rewrite saved writing.

## Deterministic fixtures

Prices below are synthetic arithmetic examples, not claims about actual market prices. Use normalized U.S.-listed SPY Stock/Underlying identities in USD and explicit brokerage Accounts. Unit option fixtures use exact Call/Put terms, strike 100, multiplier 100 and expiration 2026-10-16. For expired-settlement browser cases use the same synthetic arithmetic with an already-completed expiration such as 2026-10-02 and matching earlier economic history; do not change an Instrument's expiration after confirmation. Live-provider keys/prices are separate, verified actual listed contracts selected in D3-T01. Never expect the synthetic premium to match a provider quote.

| Fixture | Inputs | Exact expected results |
| --- | --- | --- |
| F-S1 | Plan 100 Stock shares at intended 100; original Stop95/Target110; opening one decision:60@100 fee0.60,40@101 fee0.40 | Frozen risk500=1R; planned reward1000. Gross opening cost10040, opening fee1. Mark104: open P&L359=0.718R; ongoing risk900=1.8R; reward600=1.2R. Full100@110 closing fee2: net realized957=1.914R; total fees3. |
| F-S2 | Same Plan100; initial opening only60; later one full exit60 | Entry shortfall40 resolves at first exposure reduction, once; baseline stays original, final exposure0. |
| F-C1 | Long Call strike100, premium2,1contract, multiplier100, opening fee1; frozen monetary Stop loss100 and reward boundary200 | Remaining cost201, original1R100. Mark3: open P&L99=0.99R. Full exit3 with fee1: realized98=0.98R. Current payoff minimum -201 on[0,100], zero102.01, maximum Unbounded Above. Analogous long Put: minimum -201 for S≥100, maximum 9799 at S0, zero97.99. |
| F-C2 | Two long Calls strike100/premium2, total opening fee2; factual cash settlement of1contract paying5 per unit with fee1 | Realized298;1contract remains with cost201; Current payoff minimum97 with no zero. At remaining option Mark3, total current P&L397. |
| F-SET | One contract, strike/Settlement Price100, premium2,100delivered shares; four direction variants; optional opening fee1 and settlement fee2 | Zero-fee basis/proceeds: short Put98; long Call102; short Call102 proceeds; long Put98 proceeds. With fees:98.03,102.03,101.97,97.97. Short Put40/60 allocation: existing basis3920 plus residual5880 totals9800 in zero-fee variant. |

Quantities and fee divisions remain exact through serialization, FIFO realization and residual disposal. No display rounding feeds back into calculations. Record opening/closing broker partial fills as one decision when they belong to that decision; do not use them to smuggle independent scaling into D1–D3.

Pure unit time inputs are explicit and deterministic. Save/authored time is independent of Economic Time and Recorded Sequence. Calendar fixtures use the chosen versioned session policy, never machine-local date arithmetic. Equity examples include noon New York time on 2026-10-06 resolving 2026-10-05; closed July3 resolving July2; weekend rollover; DST zones; and Nov27 equity early close at13:00ET with12:59/13:01 boundary tests. The official [NYSE hours/calendar](https://www.nyse.com/trade/hours-calendars) and [2026 calendar](https://www.nyse.com/publicdocs/nyse/ICE_NYSE_2026_Yearly_Trading_Calendar.pdf) supply these fixtures. D3 must separately record selected option/venue session cutoffs and provider timestamp normalization; do not assume every option shares the equity13:00/16:00 cutoff. Browser exact-date tests can use completed historical sessions without replacing the application's clock/calendar dependency.

Reference fixtures cover required defaults, renamed/inactive items, stable strategy shapes, unchanged seeding and one real selected Account. Journal fixtures use all seven canonical type definitions and their protected roles, completed/declined/deferred workflow outcomes and retained form snapshots. General form-edit/Entry-amendment browser workflows are future D16, though the storage/validation rules must preserve their prerequisites now.

Backup specimens start as actual exports and include deliberate corrupt/truncated/wrong-digest files plus legal prior released-schema files. Never claim an imaginary pre-D1 schema migration. D2/D3 add real previous-release upgrade/Restore evidence.

## Scale and capacity derivation

Before freeze record a numerical storage estimate derived from the selected encoded formats:25,000 Trades, up to 200 Open, about200,000 execution/settlement facts, realistic installed Journal/Market/reference/audit history, exact-value encoding and indexes. Include peak old+new migration/replacement data, candidate/private rebuild, full backup/read-back working space and explicit safety margin. Compute readiness's minimum capacity/headroom from that model, measure the actual browser estimate and document threshold pass/failure. Do not replace it with an unexplained constant or treat stronger durability permission as extra capacity.

D1's legal installed-prefix dataset has 25,000 Planned/Abandoned/Open Trades and 200 Open, with actual fact counts disclosed. D1 cannot certify the final canonical mature dataset while closure/corrections are uninstalled. D2 can reach exactly 200,000 legal Stock facts with 24,800 Closed Trades each having four opening broker fills and four closing broker fills in two decisions (198,400facts), plus 200 Open Trades with eight fills in one opening decision (1,600facts). D3 varies those installed histories with legal option Executions and settlement/allocation. Add representative Manual/Journal/Management/Action and, in D3, provider/Bars history without fake additional decisions. Full future correction/custom-definition history remains explicitly uncertified until those consuming slices.

For B-10 preserve browser profile/installed offline assets, terminate all app processes between cold samples, and measure first complete interactive screen from launch. Warm measurement is complete Open-list navigation, not a skeleton/first few rows. Use at least 100 cold and 200 warm samples and nearest-rank p95; retain all samples/failures, query counts and expected rows/results. Do not warm hidden all-history replay before the measured navigation or weaken correctness to hit timings.

## Shared acceptance and critic flows

The following flows apply to each installed scope. Link task-specific D#-A scenarios to these checks. Every flow has the authoritative/restart proof above, exact selector commands and fresh-critic observations; B-10 additionally has the benchmark command.

### B-01

**Directly usable mutation results**

**Reproducible procedure:** For every installed semantic mutation, record its accepted revision-bound result and transport/query trace. Render the changed scope from that result, then optionally query only for verification or later navigation; stop/restart and compare the stable identities, lifecycle, calculations, outcomes and audit.

**Expected observable/durable result:** The UI finishes the command without a mandatory read-back of directly changed state. Rejected commands leave authority unchanged; accepted result and restarted state agree.

### B-02

**Readiness and advisory protection matrix**

**Reproducible procedure:** Use fresh profiles for all-pass, all-pass with protection unconfirmed, each of the four failed checks, and at least two simultaneous failures. Induce actual probe abort, estimated capacity below the derived bound, absent worker control, and missing/digest-invalid inventory using disclosed host/storage/release fault controls. Attempt initialize and each installed domain/configuration/Restore mutation at UI and persistence boundaries; exercise an explicit durability-request gesture where supported.

**Expected observable/durable result:** Only functional all-pass is Writable. Protection remains advisory with a visible warning. Every failure is reported; no authoritative initialization/import/mutation occurs and every attempt returns RuntimeNotWritable. Probe writes are isolated diagnostic artifacts, not Workspace facts.

### B-03

**Recovery Only, unreadable root and runtime failure**

**Reproducible procedure:** With a readable existing Workspace, fail each readiness check on launch and exercise reads/history, export and selected-file verification; attempt every installed mutation and Restore apply. In a disposable specimen deny store reads while preserving the known root bytes. In a live Writable session provoke actual storage/release failure, then attempt its next mutation and retry readiness.

**Expected observable/durable result:** Readable data permits Recovery Only reads/export/verification, never mutations. Unreadable data is Unsupported plus Integrity Blocked with no empty initialization, overwrite, apply, read or completed-backup claim. Runtime failure invalidates Writable before the next write. Independent-browser transfer requires an actually completed backup/Restore.

### B-04

**Ordinary download and selected-file verification**

**Reproducible procedure:** Export an actual coherent file through the browser download path; inspect all installed sections, metadata and exact values. Observe Downloaded before verification. Select the actual saved file and confirm it against the ephemeral expected snapshot/digest. Test cancel, denied read, truncated/malformed file, wrong Workspace/old artifact, digest mismatch, failed download, and lost expected view state. Write later facts between export and verification.

**Expected observable/durable result:** Only complete matching read-back creates CompletedBackupReceipt. No persisted pending-verification job exists. Valid old snapshot verification is possible but its receipt cannot cover a newer target Restore binding. Export/verification remain available in readable Recovery Only. No secrets, private projections, raw provider payloads, transient diagnostics or unsaved inputs appear in the actual file.

### B-05

**Validated replace-only Restore**

**Reproducible procedure:** Prepare an actual exported candidate on a different populated target; compare authority before/after preparation and validate metadata, digest, versions, all references and analytical agreement. Test an exact-target Completed safety receipt, explicit warned decline, stale/unverified/wrong-target receipt and stale prepared candidate. Abort each participant in turn during replacement, including settings/reference/Journal/Trade/Market sections. Restart after successful and interrupted commits.

**Expected observable/durable result:** Preparation has no writes or provider calls. Only explicit whole Replace with valid safety choice and current bindings can apply. All sections commit together or the prior target remains entirely intact. Success returns the new landing state, discards prior target forms, rebuilds private views and freshly checks readiness. No merge or credential inheritance.

### B-06

**Stopped application works offline**

**Reproducible procedure:** Capture production HTTPS provenance, release inventory and asset digests. In the same installed browser profile stop all app processes/tabs, disable network, launch again from installed icon where exposed and from a normal tab, and perform every installed Manual journey including backup read-back and Restore. Start a second separate profile to show storage isolation.

**Expected observable/durable result:** Actual stopped restart uses the verified inventory and real durable data. Manual workflows traverse the real stack and succeed without network; optional recovery returns honest fallback. A separate profile does not share Workspace data automatically. Secure loopback automation supplements, never substitutes for, production HTTPS/install evidence.

### B-07

**Update and lossless migration safety**

**Reproducible procedure:** While a real form contains unsaved values, stage a newer actual inventory, inspect digest completeness and notification before activation, defer, then intentionally reload at a safe boundary. Repeat with missing/hash-invalid assets, insufficient capacity, readiness failure and migration failure. D1 uses two compatible builds of its first schema; D2/D3 also test actual previous-release schema upgrades.

**Expected observable/durable result:** No mid-form worker takeover or silent field loss. Prior compatible release/root remains available after failed staging/migration; no synchronization occurs. Successful activation reruns readiness and preserves authoritative exact values/identities. Unsupported/lossy migrations never initialize empty data. Schema fixtures are real released formats, not imaginary historical versions.

### B-08

**Responsive, accessible and honest states**

**Reproducible procedure:** For every current route/form, narrow and widen live around the disclosed breakpoint while preserving route, filters, selected Trade, validation, fields and actions. Operate by keyboard at supported zoom, inspect names/roles/focus, test contrast and text equivalents for charts. Drive actual empty/loading, conflict, validation, storage error, partial evidence and destructive Restore states.

**Expected observable/durable result:** Sidebar/bottom navigation adapts without changing semantics. Loading/Ready/Empty/Error and Missing/Stale/Unavailable/Not Applicable are distinguishable; color is not sole meaning, graphs have text, and contrast meets WCAG AA. Error/conflict keeps user inputs and never silently resubmits.

### B-09

**Private reconstruction and observational equivalence**

**Reproducible procedure:** Record an authoritative section/ID/version/exact-value manifest and public lists/details/Journal/Debt/Review/analysis. Delete only explicitly enumerated private acceleration stores, rebuild via the production path, and compare results; repeat after actual validated Restore and migration. Separately inject a known authoritative agreement fault only in a disposable integrity specimen.

**Expected observable/durable result:** Reconstruction preserves authoritative facts, labels, anchors and every installed result, with no hidden reauthorization of history. Ordinary reads surface disagreement and do not repair it. Permitted Restore-derived reconstruction is disclosed and cannot erase historical evidence.

### B-10

**Offline scale, bounded queries and correctness**

**Reproducible procedure:** Build the deliverable's legal deterministic dataset through public semantic operations or supported validated Restore. Save provenance, actual counts and expected results. On disclosed hardware/browser/runtime run at least 100 cold complete-process launches and 200 warm complete Open-list navigations offline. Compute nearest-rank p95 from all raw samples; capture query counts and work traces. Compare full public results before/after private rebuild, Restore and migration.

**Expected observable/durable result:** Cold interactive screen p95 ≤2500 ms and warm complete Open list p95 ≤1500 ms with all required integrity/calculations/coverage. No ordinary all-history replay, per-Trade query or dropped row. D1 measures a disclosed installed prefix and capacity forecast; D2/D3 reach about 200,000 installed facts but do not certify future correction/custom-form histories.

### B-11

**Semantic abort, interruption and stale binding matrix**

**Reproducible procedure:** At every installed semantic command, capture authority and induce an actual IndexedDB transaction abort at each participant. Stop immediately before and after commit acknowledgment. Use another real browser context against the same store to change each normalized binding independently: Trade/fact, reference/form, Market Mark/Bar/ack/absence, Journal outcome/Action and target/source Restore state. Retry only with newly rendered bindings.

**Expected observable/durable result:** Each rejection/abort preserves authority; each accepted commit includes every required participant or none. No orphan ID, Lot, lineage, outcome, Debt, revision, lifecycle/index or Action exists. Restart is entirely before or after. Stale commands return typed no-write conflicts; responses do not hide a partial commit.

### B-12

**Installed capability closure**

**Reproducible procedure:** Inspect the Installed Capability Manifest and every visible route/action; execute one real journey per advertised variant. Check required dependency directions/import boundaries, including UI calls through public seams and pure analysis without storage/clock/provider calls. Compare capability availability after update/Restore.

**Expected observable/durable result:** Every advertised capability works completely through the production stack. Uninstalled variants are absent from the manifest/controls rather than a fabricated domain Unavailable result. Canonical reference/form seeds may exist before their future workflows. No report, multi-leg, scaling, Roll execution or Trade correction is accidentally advertised in D1–D3.

## Fresh independent browser-critic gate

After a deliverable's cumulative unit/integration/browser suites pass, spawn a fresh critic for that attempt as required by the canonical [planning protocol](../../specs/evaluation/planning-protocol.md#independent-browser-critic-gate). This document calls for that delegation during later implementation verification; it does not require a planning subagent now.

The critic receives frozen specs and approved plan, current scope and future boundaries, starts the runtime itself, and performs **every** current D#-A and applicable B flow through the production UI. It records actions, expected/observed behavior, pass/fail and screenshots/sanitized console/server evidence per flow, without editing implementation. Automated cumulative suites carry earlier-deliverable regression coverage.

For the release-gate flows D1-A08, D2-A11 and D3-A11, the critic exercises the scale/capability/browser observations and verifies the recorded suite/benchmark evidence. Spawning the critic and collecting its report are main-agent gate procedures, not instructions for a critic to recursively spawn another critic.

Each defect first gains a failing unit/integration/browser regression test; then minimal production fix, cumulative suites, and another fresh critic repeating all current flows. A genuine specification/approved-plan contradiction is escalated instead of invented into a test. No deliverable completes without a passing fresh report. Missing browser/runtime/fresh-agent or required live-provider evidence is a disclosed blocker, never a self-certified pass.
