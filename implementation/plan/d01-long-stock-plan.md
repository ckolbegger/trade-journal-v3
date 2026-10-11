# D1 — Long Stock Plan: detailed task breakdown

Status: planning draft for interactive review; not an approved/frozen implementation baseline. No application scaffold, implementation, package installation, tests, deployment, commit or push is authorized by these files.

Authority: [D1 delivery boundary](../delivery-plan.md#1-confirm-and-retain-a-long-stock-plan), [approved stack](../technology-stack.md), [frozen specification index](../../specs/README.md), and [planning protocol Phases 3–5](../../specs/evaluation/planning-protocol.md). Reviewed source HEAD: `cb4c228f91543be3034a04cdff3c85fda34088f5`. Use only `/Users/ckolbegger/src/trade-journal-v3/worktrees/codex-gpt-6.1-sol` on branch `codex-gpt-6.1-sol`; every future command/edit must target it. Preserve user-owned `.codex/config.toml`. The six files supply task details under the existing overview, without editing frozen specs.

## Outcome, story and boundaries

- As a trader, I would like to confirm a Long Stock plan with my intended entry, Stop, Target, thesis, and invalidation, so that I can preserve my decision and 1R before entering the position.

Production flow: startup/readiness → first-run rules-based time-zone choice → real Institution and Account creation → Long Stock Plan form → fixed underlying-price Stop/Target and completed Plan Reflection → explicit Confirm → returned frozen Planned Trade/Entry → Planned list/detail/history → stopped-app offline restart. Thesis/Invalidation are answered once and frozen into both Plan semantics and exact Journal snapshot.

No Executions/current valuation/general Journal composer/Review/exit/report/Restore or future Strategy selector. D2 opens a complete initial Stock entry, D3 Manual Marks, D4 Review/voluntary writing, D5 whole closure, D6 complete export/verification. Scaling/legging D10–D13, management D16, Restore D17, corrections D18 and Journal Edit/Addendum/Void D19 stay separate. D1 never advertises future calculation as an Unavailable placeholder. Accepted backup timing exception: before D6 readable Recovery Only provides installed reads/history/safe retry but no export; protection/recovery UI explains that temporary absence. No first-save recovery/transfer or completed-backup claim. Preserve prior compatible/readable data through migrations.

## Decisions, assumptions and review state

| Choice | State and concrete tradeoff |
|---|---|
| React/strict TypeScript/Vite/Dexie/decimal.js stack and ten module interfaces | Previously accepted; not reopened |
| Exact nonterminating derived quotients | Trader accepted 2026-10-11: numerator/denominator decimal strings, decimal.js arithmetic, display-only rounding. Extra internal value type preserves fee conservation/signs; no Fraction.js |
| Same-database staged generations and atomic active-root switch | Trader accepted 2026-10-11: larger temporary storage for preserved prior data, explicit stale-tab generation rejection |
| Calendar coverage 2021–2028 | Trader accepted 2026-10-11: bundled verified NYSE regular sessions, early closes and exceptional closures; explicit coverage-limit results until reviewed extension; Trade fact times remain unrestricted |
| Exact dependency profile | Selected for these D1–D6 breakdowns from verified primary metadata, within the approved stack; exact pins in research appendix. Declared engines/peers align; actual lockfile/build/browser bundles remain implementation gates. Overall implementation-baseline approval is still separate |
| Resource budget/readiness recipe | Trader accepted 2026-10-11: measured mature-Workspace growth, one complete migration candidate and release-cache headroom, plus 25%; backup memory measured separately in D6. Actual byte thresholds are implementation evidence, not invented planning measurements |
| Incremental backup hashing | Trader accepted 2026-10-11: `@noble/hashes 2.4.0` in D6, preserving SHA-256 while avoiding whole-buffer hashing. Export memory remains a separate measured gate; no package installed |
| Local/browser evidence | Built production assets on secure loopback `http://localhost:5174`, strict port. Actual `isSecureContext`/worker/control/storage evidence required. Chromium/Firefox/WebKit Playwright bundles; actual install-capable and ordinary-tab host sessions with exact OS/browser provenance; not support allowlists |
| Production delivery | Approved Cloudflare Pages static HTTPS; eventual preview deployment evidence is a release gate, not deployment authorization now |

Proposed seams listed in tasks are for review. No test is written at an unconfirmed seam. Existing canonical public interfaces provide the agreed architectural boundaries; task seam selection/fixtures are part of approval of these breakdowns. These files do not freeze the entire 28-deliverable plan or start Phase 6/kickoff.

## Shared architectural and persistence mechanisms for D1–D6

### Implementation boundaries and complete operation placement

These are proposed source locations, not files created by planning. Presentation calls public application boundaries only, never Persistence or pure financial formulas. Facts stay in their owning modules; pure Analysis receives explicit values. Future operations remain absent from installed code/navigation until their consuming slice.

| Boundary / proposed location | Operations and first consuming slice |
|---|---|
| `src/domain/trade-analysis/` | assessPlan D1; derive/assessChange opening D2, evaluate D3; pure replay for Stop episodes D3–D4, visible lifetime replay D14; expirationPayoff D7 (Stock-only result not advertised in D1–D6) |
| `src/application/trade-workflows/` | confirmPlan D1, recordPositionChange opening D2/full disposal D5; abandonPlan D9; reviseManagement D16; previewCorrection/commitCorrection D18 |
| `src/domain/trade-record/` | prepareChange/applyPreparedChange/getRecord/queryRecords/history D1; resolveAnchors Trade D1/Execution D2; exportSnapshot D6; prepareRestore/applyPreparedRestore D17 (internal migration validation restricted to introduced types occurs earlier) |
| `src/domain/journal/` | getDefinitions/prepareEffects/applyPreparedEffects/seedDefaults/query D1; save Journal-only Debt D2/direct CreateEntry D4/Edit/Addendum/Void D19; exportSnapshot D6; prepareRestore/applyPreparedRestore D17; reviseDefinition D23 |
| `src/domain/market-data/` | save initial Manual/acknowledgment and query D3, unconfigured recover path D3–D4; getProviderConfiguration/configureProvider/provider recovery D7; exportSnapshot D6; prepareRestore/applyPreparedRestore D17; correction/withdrawal save variants D18 |
| `src/application/daily-review/` | open/getTrade/getDebt/save D4, extended by later installed evidence/fact types |
| `src/domain/performance-analysis/` | exposure D21; outcomes D22; scorecard D24; journalField D25; no stub reports D1–D6 |
| `src/domain/reference-catalog/` | save real Institution/Account creation, query/resolve/seedDefaults D1; first reasons D5; exportSnapshot D6; prepareRestore/applyPreparedRestore D17; broader maintenance D20/typed shape creation D28 |
| `src/application/trade-views-and-reporting/` | browseTrades/getTradeDetail D1 and scope extensions; replayTrade D14; previewMarkChange D18; runReport Exposure D21/Outcomes D22/Scorecard D24/Journal Field D25 |
| `src/application/workspace/` | initialize/getStatus/requestDurability D1; exportBackup/confirmBackup D6; prepareRestore/applyPreparedRestore D17; saveSettings D22 (first-run choice is initialize input) |
| `src/infrastructure/` | internal Transaction/IndexedDB D1; PWA/release/storage host D1; ordinary download/selected File D6; PricingProvider.fetchClosingObservations D7, adapter not selected here |
| `src/presentation/` | React routes/forms/timelines from installed capabilities; accessible semantic HTML/CSS Modules/design tokens; no domain calculation or multi-module writes |

Use one IndexedDB database with a minimal physical representation: root/generation metadata; append-only owned fact/version envelopes keyed by generation, owner, kind, stable identity and version; authoritative lifecycle/agreement records keyed by generation/Trade; reconstructable private lookup/projection rows. Only concrete kinds needed by the current slice exist. The small internal envelope permits staged generations; it is not a generic public repository, rule engine or future entity schema. Market is empty until D3; no provider/Bar/option payload kinds exist early. No domain module exposes child CRUD to React.

Each successful semantic command assigns a monotonic internal commit ordinal/Recorded Sequence as applicable and new opaque public bindings in the same transaction. Append versions and snapshot effective-head/lifecycle provenance so D6 can read a coherent historical Workspace binding S even after later commits. Stable domain IDs distinguish fact IDs from version IDs, sequence from time, and Save Time from Economic Time. No prepared command reserves identities. Sequences never derive from lexical IDs/array arrival/wall clock.

Command reads validate one active generation, all affected fact/definition/catalog/observation/obligation revisions and readiness epoch; transaction rechecks them and increments Workspace content revision once. Dexie success resolves after commit; return bounded staged projections and required analysis under those exact revisions, never an unconditional post-write query. No subscriptions/domain events/live-query bus. Other views perform normal reads only on independent navigation/refresh. Cross-tab writes serialize through overlapping readwrite scopes; no browser lock API is a correctness prerequisite.

Read coordinators obtain one read transaction snapshot where feasible, or bounded revision recheck/retry (maximum 2 retries, then ChangedDuringAssembly). They never combine unrelated child reads into a torn view. Open selection uses authoritative lifecycle/index plus complete bounded AnalysisInput batches (page size 50; exhaust pages for complete UI selection); one storage batch per page, no one-load-per-Trade or ordinary all-history replay. Fact/observation history indexes support identity, generation, economic order and commit ordinal; private projection keys include source revisions and policy versions. Changed facts invalidate affected projections in the same commit. Reads do not repair authoritative lifecycle/lot/deviation disagreements.

Migration builds a generation-qualified candidate from one bound source, validates every introduced module/history/foreign reference plus applicable analysis agreement, applies only needed stable-key seeds, and seals its digest/counts/version set. Preparation uses chunks and yields outside live write transactions. Candidate writes are internal lifecycle staging, never publicly Ready or installed workflow data. Atomic activation rechecks source binding/readiness/release/schema/seal and updates active root with migration/seed/private-rebuild receipt in one transaction. Stale tabs re-resolve root and reject generation mismatch; they cannot write into retired data. Crash before activation leaves old root active; crash after activation leaves complete new root. Failed candidates may be cleaned up only when known unreferenced; old compatible generation remains until successful open and declared recovery retention is safe. Physical schema changes are explicit rollback-capable upgrade transactions with blocked/versionchange handling and compatible old-data recovery, not domain migration by itself. Unknown newer/lossy versions are rejected, never initialized over.

### Decimal, ordering and calendar policy

All Money/Price/Quantity/fee inputs are finite decimal strings; normalize sign/zero without native-number conversion. USD fees nonnegative, Stock price nonnegative, quantities positive magnitudes with explicit action. Do not impose arbitrary trader-facing digit/quantity limits merely to fit a hard-coded precision. Use a dedicated decimal.js constructor: finite additions/products choose sufficient precision from operand digit lengths plus result carry/aggregation bounds; exact quotient operations cross-multiply/reduce without rounded division, using the same sufficient-precision rule. A fixed 80-digit context may be a fast path only when proved sufficient, never a fallback that changes sign. Normalize a finite decimal to integer coefficient and decimal scale when building a quotient; components remain decimal strings. A quotient has positive denominator, common-factor reduction and canonical zero. Exact reduction/comparison uses sufficient-precision integer operations rather than rounded division; if resource/library limits prevent exact work, fail the command/calculation explicitly and preserve prior facts. Divide by zero returns typed reason, not Infinity. Decimal ratios, weighted averages and fee portions remain exact quotient values as needed. Rounding (ROUND_HALF_EVEN, money 2 display decimals; price/quantity retain meaningful digits; ratios ordinarily 2 display decimals) occurs only when rendering, with exact value accessible and never re-entering calculation. Negative display zero must not classify a loss as breakeven. Tests use literal worked values and adversarial repeating/tiny-sign cases.

Fixed Plan fixture P: exact Long Stock Instrument, 100 shares intended at 50, Stop 45, Target 60, no actual fees at planning. Original risk/1R 500, original reward 1,000, ratio 2. Intended Stop must produce positive numeric risk; intended Target must provide calculable coherent forward reward. Retain independent per-condition basis for later OR variants rather than storing one ambiguous stop/target number. Actual fill fees first apply in D2; no future closing fee is projected.

Use Temporal imported polyfill with explicit clock/as-of instants and rules-based Workspace time zone. Store UTC instants; preserve distinct exchange/session dates. The accepted calendar manifest will contain independently checked explicit NYSE regular sessions 2021–2028, UTC close instants, early/full closures, source URLs/access dates/hashes/supersession and policy revision. Capture 2025-01-09 exceptional closure; later Juneteenth announcement overrides older schedule. No calendar network call at runtime. Session resolution begins in D3; outside verified coverage return an appropriate typed Rejected/evidence reason with safe guidance, not Missing price for a fabricated session and not a new Runtime Readiness criterion. Facts at older instants remain stored/readable. Calendar updates bind revised frames and require re-evaluation without silently rewriting stored fact times. Host display-zone tz data is not frozen by the polyfill pin; record environment provenance and test DST/ambiguous user-time input with explicit disambiguation.

### Readiness, release inventory and resource recipe

Every launch and update activation reruns four checks before initialization/write: isolated diagnostic transaction against the authoritative database mechanism; mature-workspace plus temporary-headroom capacity; intended worker control; complete digest-valid Offline Release Inventory. A probe uses isolated diagnostic records/transaction and deletes or aborts them, leaving no authoritative fact/history/Workspace initialization. Report every known failure, including simultaneous failures. Later storage/cache/control failure immediately invalidates readiness and the persistence gate rechecks it before the next write. `RuntimeNotWritable` includes RecoveryOnly/Unsupported, all failed checks, readable/IntegrityBlocked Workspace status and safe actions. Ambiguous unreadable root is Integrity Blocked, never proved empty. Host protection Protected/BestEffort/Unavailable is advisory; denied durability keeps writable controls usable with visible warning.

Production build defines stable Web App Manifest identity/icons/start URL/scope/standalone, immutable release/capability identity and emitted-file SHA-256 Offline Release Inventory. Enumerate all runtime assets, worker imports, fonts/icons/chunks and fallback navigation. Fail build for precache omissions/size warnings; Workbox revisions alone are not digest evidence. Application-owned injectManifest worker stages complete verified cache before announcing update. No automatic skipWaiting/claim takeover of an active form. Safe reload activation waits for explicit safe point; unsaved input is preserved or activation deferred with reason. Old compatible release cache remains for failed migration/recovery and offline restart; do not promote a failed new release as Ready.

The trader accepted the measurement-derived capacity gate and 25% margin on 2026-10-11; planning does not fabricate observed byte thresholds. Define a deterministic mature envelope model with 25,000 Trades, 200,000 economic facts, 200 simultaneously Open, 600,000 Journal Entry/obligation/history records, 250,000 Stock observation history records and representative reference/definition/audit history over 2021–2026. D1 uses installed Plan/Catalog/Journal facts via commands plus disclosed byte-budget reserves for not-yet-installed economic/Market kinds; later slices replace those reserves with real command-created records. No future domain feature or fabricated historical coverage is advertised by a budget fixture.

Before D1 release, measure serialized source bytes, actual IndexedDB/index usage and release-cache bytes in a disclosed isolated browser workload. Reserve model input budgets: 4 KiB/Trade Plan/history, 2 KiB/economic fact, 4 KiB/Journal record, 1 KiB/observation, 64 MiB other metadata/reference/definition history, plus 100% modeled index/private overhead. These are conservative **planning budgets**, not observed data sizes or limits on user text. If real fixture exceeds them, use larger actual sizes. Do not claim these counts cover unbounded arbitrary history. Record model/table counts, observed overhead and assumptions.

Let M be max(measured mature IndexedDB+indexes, budget-derived mature footprint), L the current active authoritative+private storage footprint, C required extra new-release/cache bytes, and Q the conservative reported quota minus total current origin usage. Required incremental origin headroom H = max(0, M−L) + max(M,L) for one complete migration candidate + C, with 25% margin on that sum. Existing retained generation/failed candidate/cache usage is already in current usage, never subtracted twice or called free. Backup construction uses read-only snapshot/Blob rather than another origin-staged data copy; measure its peak heap/Blob/download backing separately in D6 and fail export safely if unavailable. If later implementation needs origin staging, add its measured peak to H before release. `estimate()` missing/nonfinite/insufficient or diagnostic quota failure fails the capacity check; quota is no reservation, so actual errors still rollback and invalidate Writable. Track raw observed M/L/C/Q/H and material changes for every evidence launch. Startup must use stored measurement/size receipts and bounded inspection rather than populate/replay mature data every launch. The measurement task computes final numeric floor; planning does not call an unexecuted estimate a benchmark.

## Shared evidence procedure and future commands

The future implementation will provide package scripts `typecheck`, `build`, `test:unit`, `test:integration`, `test:browser`, `test:benchmark`, and `preview`. None exists or runs as application evidence during planning. Exact package pins are researched below; npm lockfile is created only when implementation is authorized.

For **every planned it should case**: add only that test at its approved seam; run `npm run test:unit -- <test-file> -t '<case>'` and retain a meaningful failing Red (not syntax/config/fixture failure); make minimal production change; rerun same case plus already-green task cases for Green; repeat next case. Retain case ID/text, actual command, output/exit, source revision, inputs and returned bindings. Separate refactor review only after green, rerun affected cases. No bulk-test-first/bulk-implementation shortcut. Structural task records its exact commands/procedure and expected output; no invented unit case for a file existing.

Cumulative gate: `npm run typecheck`, `npm run build`, `npm run test:unit`, `npm run test:integration`, then `npm run test:browser -- --grep D<n>` and applicable benchmark. Planned integration files `tests/integration/d01…d06.*.test.ts`; browser files `tests/browser/d01…d06.*.spec.ts`; names must retain I/B IDs from these files. Runtime uses worktree-local DEV_PORT=5174 for dev, preview and Playwright baseURL/webServer with strictPort. Never print or load credentials/other-worktree environment. Capture actual installed browser/OS/Node/npm/lockfile/release/inventory/manifest identities and exact clock/calendar/time-zone inputs. Production HTTPS/install-capable host evidence supplements secure-loopback tests; an automatic browser bundle's version is provenance, not a support policy.

Unit tests use public canonical seams; boundary clock/host fault controls may isolate a behavior, disclosed per case. Integration uses real application/domain/persistence code, no application mocks/stubs/canned responses. Fast tests may use fake-indexeddb as disclosed infrastructure and explicit clock/identity inputs; they cannot certify host readiness/offline/quota/disk durability. Browser-owned IndexedDB plus real worker/cache/host APIs supply that evidence. Infrastructure abort/failure injection is allowed at the host/storage boundary, with normal production application paths intact; never supply a fabricated accepted application result. Fixtures originate from installed authoritative commands (or validated Restore once D17 exists). Controlled integrity/reconstruction fixtures disclose exactly which private/agreement bytes changed; never use direct storage injection to fake normal capability facts.

No-write/failure proof compares normalized authoritative histories, effective heads/lifecycle/index membership and participant/Workspace bindings before, after and after reopened storage. A read-back in an integration assertion is an independent durability observation, not a caller read required to present Save. Trace the initiating UI request/response separately to demonstrate it renders returned exact state. Durable success must survive stop/reopen; interrupted write must be wholly before or after, never mixed. Candidate migration: valid/invalid/unknown-newer, abort after participant staging, interruption before/after root switch, stale source/tab and successful retry; preserve prior history and distinguish private rebuild from authoritative repair.

Benchmark/equivalence at each consuming slice: deterministic command-created installed workload plus disclosed future byte reserves only for capacity. Installed Stock correctness workload reaches 25,000 Trades, 200 Open and, once scope permits, 200,000 grouped Execution facts, representative actual Journal/Marks/history; full mixed corrected/provider/report fixture remains D28. Delete only documented private projections, reconstruct under identical facts/clock/evidence, compare stable IDs, exact values/order/classifications/coverage/navigation/agreement and installed Review outcomes (opaque cache tokens excluded). No all-history replay on ordinary startup/Open list, no one-query-per-Trade, and no omitted rows to meet latency. Run at least 50 cold and 50 warm trials offline on a disclosed common local device; cold is stopped-browser/app fresh launch with installed caches/DB retained, warm is complete Open-list navigation in a running app, measured to interactive required screen/all rows in requested page. p95 is nearest-rank sorted sample at ceil(0.95×n). Preserve every raw timing, query trace, hardware/OS/browser/build/power conditions and before/after correctness; target cold ≤2,500 ms, warm ≤1,500 ms. Slow/failing evidence blocks the current release, not deferred hardening.

Every deliverable ends with the mandatory **fresh independent browser critic**, after cumulative unit/integration success. It receives complete specs, six plans/current scope/future boundaries; starts the built runtime itself, exercises every B flow, makes no edits and reports actions/observed/expected/pass-fail plus screenshots/console/server evidence. Any implementation defect first becomes a failing regression, then minimal fix and cumulative rerun; a different fresh critic repeats all current flows. Repeat until fresh all-pass. Genuine ambiguity pauses for manual clarification, not invented tests. No fresh agent/runtime/browser means blocked execution and no self-certification. These are future gates; no critic or implementation agents are launched by planning.

## Explicit task completion edges

These are blocking edges for task completion. UI work may start after the contract-fixing task, as described under parallelism, but cannot finish before its real domain/persistence prerequisites. Review/freeze prerequisites remain external to this implementation graph.

| Task | Required predecessor tasks |
|---|---|
| D1-T01 | None inside this graph; approved stack and task-contract review required |
| D1-T02 | D1-T01 |
| D1-T03 | D1-T01 |
| D1-T04 | D1-T03 |
| D1-T05 | D1-T04 |
| D1-T06 | D1-T02, D1-T04, D1-T05 |
| D1-T07 | D1-T06 |
| D1-T08 | D1-T03, D1-T07 |
| D1-T09 | D1-T01, D1-T03, D1-T08 |
| D1-T10 | D1-T01, D1-T02, D1-T03, D1-T04, D1-T05, D1-T06, D1-T07, D1-T08, D1-T09 |

## Ordered D1 tasks and concrete cases

### D1-T01 — Pin tools and production/test build contracts (structural)

Prerequisites: approved stack and review of these task contracts. Single tooling/release owner. Future verification: `node --version`/`npm --version` equal selected pins; clean `npm ci` from exact lockfile without peer overrides; typecheck/build; built-worker/inventory asset completeness/digest checks, strict DEV_PORT and secure loopback observation. Configure the named scripts/test separation and real browser environment, not application mocks. Verify error if port occupied. This enables all D1 behavior; no foundation-only release.

### D1-T02 — Validate Long Stock Plan and exact numeric semantics

Blocked by D1-T01's tool contract; independent of persistence. Owner: Trade Analysis; seam `assessPlan`.

`describe("frozen Long Stock Plan assessment")`

- it should accept fixture P with one exact long Stock role, numeric intended entry/Stop/Target and completed semantic Thesis/Invalidation, returning normalized Plan, risk/1R 500, reward 1,000 and ratio 2.
- it should report all incoherent/missing Stock leg, positive quantity, required semantic answer and zero/nonpositive risk issues without an accepted baseline.
- it should treat Stock-only expiration method as Not Applicable internally without advertising an undelivered payoff operation/UI.
- it should retain risk 0.000000000000000001 for 100 shares intended at 50 with Stop 49.99999999999999999999; separately, 1 share intended at 50, Stop 47 and Target 51 retains its 1/3 reward/risk ratio exactly. A displayed 0.00 risk cannot reject the positive exact baseline or change sign.

### D1-T03 — Establish browser-neutral readiness and storage gate

Blocked by D1-T01. Owner: Workspace/Transaction/host storage and initial worker-install boundary. This task includes the initial digest-valid cache installation, first safe service-worker control and release-bound asset checks required to obtain Writable; it cannot assume a worker supplied by a later task. D1-T09 extends that installed path with update staging/activation and cumulative browser evidence. Public seams `getStatus/initialize/requestDurability` and installed mutation results.

`describe("functional Runtime Readiness")`

- it should return Writable when transaction, measured capacity, worker control and complete asset digests pass, even if protection is Best Effort/Unavailable, with visible advisory status.
- it should report every failure in separate transaction/capacity/control/digest cases and the simultaneous two-failure case, return Unsupported for proved fresh store and write no Workspace/default/fact.
- it should return Recovery Only for readable existing data, reject installed mutations at application and persistence boundaries with RuntimeNotWritable, and preserve read/history availability under the accepted pre-D6 export exception.
- it should classify an unreadable known/possible root as Integrity Blocked with Unsupported readiness, never Initialization Required, and preserve root bytes without overwrite.
- it should re-establish readiness each launch/activation, invalidate a formerly Writable session after later storage/cache failure and reject the next mutation before staging.
- it should return Improved/AlreadyProtected/NotImproved from explicit requestDurability honestly without changing authoritative data or gating writes on protection.

### D1-T04 — Initialize metadata, seeds and generation lifecycle

Blocked by D1-T03. Owner: Workspace/Transaction plus seed owners; seams `initialize/getStatus`, Catalog/Journal `seedDefaults` via Workspace only.

`describe("atomic initialized Workspace")`

- it should create Workspace metadata/time zone, only Long Stock Strategy plus exact Plan Reflection/Source Plan Confirmation, no Institution/Account or unsupported default, and return Needs Institution and Account from the same committed result.
- it should require a valid rules-based first-run time zone when host choice is unavailable/invalid, preserve instants and use the accepted zone for display without changing exchange dates.
- it should reopen the same initialized Workspace idempotently with stable seed keys, complete original form rules/roles and no rename/customization overwrite.
- it should roll back all metadata/Catalog/Journal additions on induced seed/storage failure and return SeedConflict for incompatible known stable keys.
- it should reject unknown-newer/lossy/integrity-invalid roots unchanged; candidate failure/crash never promotes partially initialized/migrated data as Ready.
- it should publish only a sealed candidate by atomic generation switch, reject stale-tab writes to retired generation and return a bound initialization/migration receipt; D2 supplies the first actual source-version transition.

### D1-T05 — Create real Institution and Account

Blocked by D1-T04. Owner: Reference Catalog; seams `save/query/resolve` creation-only variants.

`describe("real brokerage onboarding references")`

- it should create a real Institution then Account with one immutable Institution parent, stable identity/label/version, return complete records and make onboarding Ready for Trade Planning.
- it should reject duplicate labels after Unicode NFC, trimmed/collapsed whitespace and locale-independent lowercase comparison within the relevant namespace, invalid/wrong-kind parent, inactive new-selection reference or stale expected Catalog binding with no partial administrative history; preserve saved display spelling and stable identity.
- it should resolve active Account/Long Stock selection under one snapshot, distinguish display/historical labels from stable identity and reject concurrent selection change before Plan commit.

### D1-T06 — Confirm frozen Plan and Plan Reflection atomically

Blocked by D1-T02/D1-T04/D1-T05. Owner: Trade Workflows/Transaction; seam `confirmPlan`, using inert Trade Record and Journal prepared effects.

`describe("durable Plan confirmation")`

- it should commit fixture P as one Trade with frozen Plan/leg/original management/baseline, authoritative Planned lifecycle and one completed Plan Reflection using entered-once Thesis/Invalidation, exact rendered definition and Trade Anchor/Plan Confirmation Source.
- it should return generated IDs/new revisions, complete saved Plan/Entry and required assessment only after all participants commit, sufficient to render success without getTradeDetail/query.
- it should reject missing/invalid reflection, incoherent baseline/leg or stale definition/Catalog/generation binding with all issues and no Trade/Entry/Debt/index/candidate identity.
- it should rollback Plan/lifecycle/index/Journal/sequence/Workspace revision on injected Journal apply or storage abort, and return RuntimeNotWritable for a late gate failure.

### D1-T07 — Browse retained Plans and transparent history

Blocked by D1-T06. Owner: Trade Record/Trade Views and Reporting; seams `browseTrades/getTradeDetail/history` and Journal query.

`describe("coherent Planned Trade reads")`

- it should expose saved Plan baseline/readiness and exact Reflection once in list/detail/history with source binding, no current valuation/holdings inferred before entry.
- it should return Empty only after a successful no-match query, Loading/Error distinctly through presentation, and preserve safe retry context.
- it should page stable factual sorts from authoritative Planned index and return coherent multi-module binding, or ChangedDuringAssembly after bounded races.
- it should surface controlled stored lifecycle disagreement against supplied facts without repairing it on read; lot/deviation agreement extends in D2.

### D1-T08 — Deliver onboarding, Plan/list/detail and responsive shell

Blocked by D1-T01 for fixed request/results; joined acceptance requires T03–T07. Owner: UI/shell.

`describe("Long Stock Plan production UI")`

- it should complete onboarding/fixture P via accessible named controls and render exact post-confirmation response without a required read-back; show full canonical terms/help and display-only rounded figures.
- it should preserve route/record/fields/validation across live 767/768 px narrow-bottom-nav/wide-sidebar transition, conflict and 200% zoom/reflow; Cancel/navigation without Confirm records nothing.
- it should show safe Loading/Ready/Empty/Error, unsupported/integrity/recovery views and all failed checks without false empty initialization; only installed navigation exists.
- it should keep Best Effort warning visible and offer explicit durability request/install guidance where exposed, without disabling valid writable controls or claiming backup before D6.

### D1-T09 — Verify PWA offline restart and safe release update

Blocked by D1-T01/D1-T03; integrated UI proof requires T08. Owner: PWA/release/Workspace integration; seam browser-host delivery behavior and initialize/getStatus, not a new domain API.

`describe("verified offline release and safe activation")`

- it should withhold Writable until intended worker controls the page and every inventory asset passes digest verification; missing/oversized/incorrect asset cannot silently be omitted.
- it should reopen installed manual Plan/onboarding/list/history paths offline after fully stopped browser and rerun readiness without network.
- it should stage all new assets before update notice and keep old worker/control/active form safe; activation is deferred when unsaved values would be lost.
- it should activate only at safe reload, rerun readiness/migration before writes, preserve old compatible release/data on staging/readiness/migration failure and never imply cross-device sync.

### D1-T10 — Cumulative real-stack, browser and release proof (structural)

Blocked by D1-T01–D1-T09. Verify all I/B cases below, target-scale installed correctness/latency and every complete declared variant. Exact lockfile/release inventory/HTTPS/host provenance and passing fresh critic are required. No production deployment is performed without separately authorized execution; planning records its gate. One owner integrates schema/seeds/manifests, no layer track is independently released.

## D1 integration fixtures and planned browser flows

| Real-stack case | Reproducible procedure / authoritative proof |
|---|---|
| D1-I01 | Real initialize → Catalog Institution/Account → confirm fixture P → list/detail/history. Reopen same database and compare every receipt identity/revision/value/Entry snapshot/lifecycle membership; no operation-required read in caller trace. |
| D1-I02 | Missing reflection/zero risk/missing exact Stock; simultaneous Catalog/definition conflict; abort after Trade staging before Journal. Compare full normalized before/after/restart participant state. No partial facts/sequences/Workspace content binding. |
| D1-I03 | Native browser readiness pass/fail matrix: four independent failures, two together, BestEffort accepted write, readable RecoveryOnly, unreadable known root, late invalidation/next-write rejection. Probe leaves no authoritative fact. Repeat launches, explicit durability denial and safe retry. |
| D1-I04 | Stopped-browser offline restart, install-capable host vs ordinary Writable tab, digest-invalid/omitted asset, active-form safe update/failed staging. Observe actual worker/asset IDs and production HTTPS separately; no browser/OS allowlist. |
| D1-I05 | 25,000 command-created installed Plans/Journal/reference history with stated capacity reserves; rebuild documented private projections and compare stable lists/detail/history/coverage under fixed clock. Run disclosed p95 startup/bounded list trials and inspect batch/index traces. D2–D5 add actual Open/Execution/closure workloads; D28 completes mixed future fixtures. |

- **D1-B01:** First secure load/readiness, explicit time zone and real Institution/Account, fixture P confirm, returned Planned Detail/list/history; stop browser, disconnect network, reopen and find retained Plan.
- **D1-B02:** Invalid Plan/reflection, corrected input, Cancel typed form, stale Catalog/revision and aborted save; compare no-write and preserved input. No execution/valuation/report/backup controls.
- **D1-B03:** Each readiness failure, simultaneous failures, BestEffort warning/durability request, readable recovery and unreadable-root block; repeated launch and runtime-failure gate; another-browser storage explanation with temporary backup absence.
- **D1-B04:** Install where host exposes it, ordinary Writable tab otherwise; inspect stable manifest, complete asset inventory, production HTTPS and secure-loopback behavior. Stage update during unsaved form, verify old control/state and safe later activation/offline retention/failure recovery.
- **D1-B05:** Keyboard-only B01/B02 at 390 and 1440 px, live 767/768 resize, 200% zoom/reflow, radio/input labels/logical focus/AA contrast with axe/manual tree checks; Loading/Ready/Empty/Error/conflict states. No narrow/wide capability differences.

Fresh critic procedure is the shared gate above; full earlier regression belongs to cumulative automated suites, future uninstalled behavior is not a critic defect.

## D1 local acceptance matrix

All rows status **planned**. Later full assignments follow the approved delivery-plan ledger, without claiming wider completion from a Stock fixture.

| Scenario | Scope / later full assignment | Tasks; concrete evidence |
|---|---|---|
| AC-PLAN-001–002 | Partial exact Long Stock/fixed management; option/criteria/typed shape full D28 | T02/T06; I01/I02; B01/B02 |
| AC-LIFE-003 | Partial Planned lifecycle/no read repair; lot/deviation full D2 | T07; I02/I05; B02 |
| AC-JOUR-007, AC-REF-001 | Partial only needed stable seeds; fixed Journal D15/customized reseed full D23, complete Catalog D27 | T04/T05; I01/I02; B01 |
| AC-RESP-001 | Partial globally; complete for every installed mutation, bounded multi-Trade full D15 | T04–T08; I01/I02; B01 one-call trace |
| AC-DEL-001–004, AC-CAP-001, AC-UI-001 | Full for installed release under accepted D6/D17 timing exception | T01/T03/T08–T10; I01–I05; B01–B05 |
| AC-DEL-005–006 | Partial every launch/update/runtime failure/read-only recovery now; D6 export/verify, Restore/full D17 | T03/T09; I03/I04; B03/B04 |
| AC-UI-002 | Partial globally; all installed screens accessible; replay D14/destructive Restore/full D17 | T08/T10; B05 |
| AC-REBUILD-001, AC-PERF-001 | Partial installed facts/rebuild/bounded latency now; full mature mixed fixture D28 | T07/T10; I05 benchmark and normalized public result proof |

## Complete canonical disposition ledger for the six-file set

This provides one row per canonical acceptance ID. Local matrices above/in D2–D6 link detailed tasks, unit cases, I/B procedures, restart/no-write proof and shared exact commands. A row here never replaces those local evidence requirements. `Partial` means narrower installed subset; `intentionally not advertised` names its later consuming release. Nothing is “covered” yet. Previously approved overview assigns the future 28-deliverable completion points; those releases still need their own later task breakdowns.

| Scenario ID | D1–D6 disposition / full completion |
|---|---|
| AC-RESP-001 | Partial D1–D6, every installed receipt complete; bounded multi-Trade full D15 |
| AC-PLAN-001 | Partial D1 exact Stock; full supported Plan/shape/criteria D28 |
| AC-PLAN-002 | Partial D1 exact Stock rejection; full Plan variants D28 |
| AC-LIFE-001 | Partial D2/D5 Planned→Open→Closed; full scaled lifecycle D11 |
| AC-LIFE-002 | Intentionally not advertised; factual Abandon D9, correction/void eligibility D18 |
| AC-LIFE-003 | Partial D1, Full installed agreement D2 and inherited thereafter |
| AC-POS-001 | Partial D2 opening/D5 whole FIFO exit; full scaling fixture D11 |
| AC-POS-002 | Intentionally not advertised; grouped multi-leg D8 |
| AC-POS-003 | Intentionally not advertised; linked Roll D27 |
| AC-SET-001 | Intentionally not advertised; physical allocation/basis D15 |
| AC-SET-002 | Intentionally not advertised; allocation NeedsResolution D15 |
| AC-SET-003 | Intentionally not advertised; explicit single-option outcome D7, physical routing D15 |
| AC-POS-004 | Partial D5 trader agency; non-agency terminal full D7 |
| AC-POS-005 | Partial D2 exact Stock; multi-leg D8, selective/unplanned D12–D13, objective full D26 |
| AC-SET-004 | Intentionally not advertised; settlement intent/management D15 |
| AC-CORR-001 | Intentionally not advertised; Replace D18, linked Roll full D27 |
| AC-CORR-002 | Intentionally not advertised; Void D18, linked Roll full D27 |
| AC-CORR-003 | Intentionally not advertised; Rebuild D18, linked Roll full D27 |
| AC-CORR-004 | Intentionally not advertised; linked settlement D18/Roll full D27 |
| AC-CORR-005 | Intentionally not advertised; nonmutating correction/Mark impact D18, linked full D27 |
| AC-JOUR-001 | Full D4 all installed forms, inherited earlier Confirm/cancel behavior |
| AC-JOUR-002 | Intentionally not advertised; Edit/Addendum/Void D19 |
| AC-JOUR-003 | Partial Debt D2, Full due-Review behavior D4 |
| AC-JOUR-004 | Intentionally not advertised; prospective runtime customization D23; snapshots retained from first use |
| AC-JOUR-005 | Partial D2/D4/D5 uniqueness; sole-answer Void/reopen full D19 |
| AC-JOUR-006 | D4 guard/no-prose contract only, management resolution intentionally not advertised; full D16 |
| AC-JOUR-007 | Partial incremental exact seeds D1/D2/D4/D5; fixed set D15, customization/reseed full D23 |
| AC-REV-001 | Partial exact Stock cutoff D4/later closure D5; corrected full D18 |
| AC-REV-002 | Partial D4 Mark/Debt/walk/resume; settlement ordering full D15 |
| AC-REV-003 | Full D4 all four saveable intents, no execution |
| AC-REV-004 | Full installed Stock Action/Stop atomicity D4 |
| AC-REV-005 | Partial D4 Mark/acknowledgment/Action/absence conflicts; Bar D7, corrections full D18 |
| AC-REV-006 | Partial D4 three completion states; settlement D15, corrections D18, Action Void/full D19 |
| AC-MARK-001 | Full D3 completed-session exact/Stale semantics |
| AC-MARK-002 | Partial Manual identity/history D3; provider/Bar precedence full D7, correction UI D18 |
| AC-MARK-003 | Full D3 explicit acknowledgment and later exact Manual Mark |
| AC-MARK-004 | Intentionally not advertised; series/gap/candle Replay D14 |
| AC-MARK-005 | Intentionally not advertised; provider partial recovery D7; NotConfigured manual path D3–D4 |
| AC-MARK-006 | Intentionally not advertised; Bar/trailing/multi-Instrument evidence D8 and complete visible replay D14 |
| AC-CALC-001 | Partial baseline/entry/current/closure D1–D5; scaling D10–D11, management/full D16 |
| AC-CALC-002 | Partial single Stock availability D3; multi-Instrument D8, partial realization/full D11 |
| AC-CALC-003 | Partial Stock fixed conditions D3; fixed multi/OR full D8, management extensions D16 |
| AC-CALC-004 | Intentionally not advertised; options/payoff D7, mixed-expiry full D8 |
| AC-RPT-001 | Intentionally not advertised; Report Periods D22 |
| AC-RPT-002 | Intentionally not advertised; complete Outcomes D22 |
| AC-RPT-003 | Intentionally not advertised; complete Current Exposure D21 |
| AC-RPT-004 | Intentionally not advertised; Scorecard D24, full objective/linked Roll fixture D27 |
| AC-RPT-005 | Intentionally not advertised; categorical Journal Field D25 |
| AC-RPT-006 | Intentionally not advertised; complete filter/group population families D21–D25 |
| AC-REF-001 | Partial D1 Long Stock/D5 four reasons; incremental seeds D7/D8/D15/D20, full Rolled D27 |
| AC-REF-002 | Intentionally not advertised broader maintenance; full D20, typed shapes D28 |
| AC-BACK-001 | Not advertised D1–D5 by accepted exception; Partial complete installed export/verify D6; provider D7, Restore D17, economic/Journal histories D18–D19, customization/full D23 |
| AC-REST-001 | Intentionally not advertised by accepted exception; nonmutating Restore prepare D17 |
| AC-REST-002 | Intentionally not advertised; replacement confirmation/exact-target safety receipt D17 |
| AC-REST-003 | Intentionally not advertised; full replacement atomicity/landing state D17 |
| AC-REST-004 | Partial first actual migration D2 and later transitions; export recovery D6; artifact/Restore full D17 |
| AC-REBUILD-001 | Partial installed facts/projections from D1; complete mixed target-scale fixture D28 |
| AC-DEL-001 | Full every installed release from D1, repeating manual offline paths; backup D6/Restore D17 under exception |
| AC-DEL-002 | Full every installed release from D1, safe staged update |
| AC-DEL-003 | Full D1 and inherited, PWA/tab/HTTPS/browser-neutral readiness |
| AC-DEL-004 | Full D1 and every later installed mutator, four failures/multi-failure/advisory protection |
| AC-DEL-005 | Partial D1 recovery/unreadable/gates, D6 backup, Restore/full D17 |
| AC-DEL-006 | Partial D1 launch/update/runtime invalidation; post-Restore/full D17 |
| AC-UI-001 | Full each installed release, live responsive parity |
| AC-UI-002 | Partial all installed states accessible; Replay D14/destructive Restore full D17 |
| AC-PERF-001 | Partial installed target-scale bounded/complete latency every slice; mixed full D28 |
| AC-CAP-001 | Full each installed release's honest dependency-closed capability boundaries |

## D1–D6 planning completion audit — 2026-10-11

The six task breakdowns are complete as reviewable planning documents. This records documentation evidence, not passing application tests, a frozen implementation baseline, or permission to implement.

| Required planning obligation | Current authoritative evidence |
|---|---|
| Six correctly named deliverable files in this worktree | D01–D06 files in this directory, linked through the existing delivery overview references in each file |
| Existing stories, production flows and future boundaries | Outcome/stories/boundaries in every file; D5 whole closure, D6 all populated categories, no scaling/Restore/correction pulled forward |
| Stable bounded tasks, public seams, ownership, observable results and blocking edges | 44 task sections plus explicit completion-edge tables; all prerequisites resolve and graph is acyclic |
| Operation variants, transaction participants, revisions and directly usable receipts | Representation/bindings/effects sections in D1–D6 and module/operation placement table in D1 |
| Durable histories, indexes, default additions, migration and private reconstruction | Per-slice representation sections, exact consuming seeds, candidate failure/restart/rebuild cases, shared same-database generation policy |
| Concrete per-behavior TDD cases and structural checks | Every behavior-bearing task has describe/it should cases; structural tasks have reproducible verification; shared one-case Red→Green procedure and future commands |
| Real-stack mock-free integration, failures, conflicts and durable restart | Per-file I cases, independent no-write state comparisons and native browser IndexedDB proof; fake-indexeddb scope explicitly disclosed |
| Production browser flows, accessibility/responsive parity and independent critic | Per-file B flows plus cumulative-suite/fresh-critic/test-first-repair/new-critic gates; execution remains future |
| Complete acceptance disposition and honest Full/Partial labels | Exactly 67 unique canonical IDs in D1 ledger, with local task/I/B mappings and named later completion releases |
| Safe parallelism with single shared-resource owners | Per-file ownership/parallel sections and explicit completion edges; no blanket cross-deliverable parallel authority |
| Stack/version, decimal/fee, calendar, migration and capacity choices | Approved stack; verified exact dependency profile; trader-accepted exact quotients, generations, 2021–2028 calendar, measured headroom+25%, and D6 incremental SHA-256 |
| Primary technical provenance and limitations | Research appendix with official release/registry/API/exchange sources; measured runtime/browser/byte results are future evidence gates |
| Preserve repository/user scope | Frozen specs, approved stack and delivery overview unchanged; only these six new files are authored; user-owned config left alone; no implementation/install/tickets/deployment/commit/push |

All consequential choices raised for this D1–D6 breakdown session have been answered and recorded. Actual dependency installation/build, calendar row extraction, browser/OS provenance, capacity byte measurements, application TDD/integration/browser evidence and release gates belong to later authorized execution. Their absence is not described as passing evidence. Overall implementation-baseline approval/freeze remains separate.

## Safe parallelism, review and completion boundary

After fixed contracts in T01, T02 pure Plan assessment can run alongside T03 readiness. T04 waits for readiness, T05 for initialized defaults, T06 joins T02/T04/T05, T07 follows real commit. UI T08 can prepare from fixed types but cannot finish against canned results. T09 PWA may overlap under exclusive release/worker ownership; T10 waits for all. Single owners serialize durable schema/root migration, seed/capability/release manifests, shell/shared selectors, numeric/Analysis policy and transactions. No blanket cross-deliverable parallel work. Planning's research delegation is read-only research; it does not authorize background implementation.

Before these six breakdowns are complete for review: all six files exist; task IDs/edges and seams/evidence are explicit; all 67 scenarios have an honest disposition with future completion points; source links resolve; no spec/stack/overview/user configuration changes; consequential open choices are recorded and reviewed one at a time. Before any implementation, the remaining D7–D28 task planning, full approval and Phase 6 immutable baseline/kickoff are still required. Do not confuse complete D1–D6 planning with an approved whole-product implementation baseline.


## Research appendix — verified platform and library facts

Research date: **2026-10-11**. This appendix supplies planning evidence, not approval to implement or install. The selected stack is approved in [technology-stack.md](../technology-stack.md); the exact pins below are selected for these task breakdowns within that stack; final implementation-baseline approval and execution remain separate. Recommendations explicitly labelled proposed remain proposals, except the trader-accepted exact derived quotient representation, same-database staged-generation activation, 2021–2028 calendar coverage/horizon policy, measured capacity/headroom with a 25% margin, and incremental SHA-256 dependency reported during this planning session. No provider is selected.

### Selected exact pins and provenance

The table records stable releases actually present in official Node release metadata or the npm registry on the research date. Published dates precede or equal 2026-10-11; scheduled future releases are not treated as available. npm package metadata was fetched read-only from the primary registry, including `time`, `engines`, `peerDependencies`, and optional-peer metadata. Sources link to the full registry metadata so the publication date remains inspectable; exact version entries supply package manifests and distribution integrity.

| Role / package | Selected exact pin | Published | Primary evidence |
| --- | --- | --- | --- |
| Node.js runtime | `24.21.0` | 2026-09-07 | [Node release index](https://nodejs.org/dist/index.json), entry marked LTS `Krypton`; [release support policy](https://nodejs.org/en/about/previous-releases) |
| npm | `11.19.0` | bundled with above Node release | [Node release index](https://nodejs.org/dist/index.json) |
| `react` | `19.3.0` | 2026-09-09 | [registry](https://registry.npmjs.org/react) |
| `react-dom` | `19.3.0` | 2026-09-09 | [registry](https://registry.npmjs.org/react-dom) |
| `@types/react` | `19.3.0` | 2026-09-09 | [registry](https://registry.npmjs.org/@types/react) |
| `@types/react-dom` | `19.3.0` | 2026-09-09 | [registry](https://registry.npmjs.org/@types/react-dom) |
| `@types/node` | `24.19.2` | 2026-10-09 | [registry](https://registry.npmjs.org/@types/node), latest stable 24.x type package observed |
| `typescript` | `7.0.2` | 2026-07-08 | [registry](https://registry.npmjs.org/typescript) |
| `vite` | `8.3.4` | 2026-10-08 | [registry](https://registry.npmjs.org/vite) |
| `@vitejs/plugin-react` | `6.1.2` | 2026-10-05 | [registry](https://registry.npmjs.org/@vitejs/plugin-react) |
| `dexie` | `4.4.6` | 2026-09-10 | [registry](https://registry.npmjs.org/dexie) |
| `decimal.js` | `10.6.0` | 2025-07-06 | [registry](https://registry.npmjs.org/decimal.js) |
| `@js-temporal/polyfill` | `0.5.1` | 2025-03-31 | [registry](https://registry.npmjs.org/@js-temporal/polyfill) |
| `vite-plugin-pwa` | `2.0.0` | 2026-10-03 | [registry](https://registry.npmjs.org/vite-plugin-pwa) |
| `workbox-build` | `7.4.1` | 2026-05-04 | [registry](https://registry.npmjs.org/workbox-build) |
| `workbox-window` | `7.4.1` | 2026-05-04 | [registry](https://registry.npmjs.org/workbox-window) |
| `workbox-precaching` | `7.4.1` | 2026-05-04 | [registry](https://registry.npmjs.org/workbox-precaching) |
| `workbox-core` | `7.4.1` | 2026-05-04 | [registry](https://registry.npmjs.org/workbox-core) |
| `vitest` | `5.0.3` | 2026-09-30 | [registry](https://registry.npmjs.org/vitest) |
| `@testing-library/react` | `16.3.3` | 2026-08-27 | [registry](https://registry.npmjs.org/@testing-library/react) |
| `@testing-library/dom` | `10.4.2` | 2026-09-13 | [registry](https://registry.npmjs.org/@testing-library/dom) |
| `@testing-library/user-event` | `14.6.7` | 2026-09-02 | [registry](https://registry.npmjs.org/@testing-library/user-event) |
| `@testing-library/jest-dom` | `7.0.1` | 2026-08-09 | [registry](https://registry.npmjs.org/@testing-library/jest-dom) |
| `fake-indexeddb` | `6.2.5` | 2025-11-07 | [registry](https://registry.npmjs.org/fake-indexeddb) |
| `jsdom` | `30.1.2` | 2026-10-04 | [registry](https://registry.npmjs.org/jsdom) |
| `@playwright/test` | `1.64.0` | 2026-10-07 | [registry](https://registry.npmjs.org/@playwright/test) |
| `@axe-core/playwright` | `4.13.0` | 2026-08-11 | [registry](https://registry.npmjs.org/@axe-core/playwright) |
| `axe-core` | `4.13.0` | 2026-08-05 | [registry](https://registry.npmjs.org/axe-core) |

Compatibility observations, not installation evidence:

- Node 24.21.0 satisfies Vite/plugin React (`^20.19.0 || >=22.12.0`), PWA (`>=20.19.0`), Workbox (`>=20.0.0`), Vitest (`^22.12.0 || ^24.0.0 || >=26.0.0`), jsdom (`^22.22.2 || ^24.15.0 || >=26.0.0`), Playwright (`>=20`), and the other declared minimum engines.
- React DOM requires React `^19.3.0`; its proposed exact pin matches. React DOM types require React types `^19.3.0`; those also match. Testing Library React accepts React/DOM/types 18 or 19 and DOM Testing Library `^10.0.0`.
- Plugin React accepts Vite `^8.0.0`; PWA accepts Vite 3–8 and Workbox `^7.4.1`; Vitest accepts Vite 6.4, 7, or 8. Plugin React's compiler/Babel/OXC peers are optional; do not introduce them without a concrete requirement.
- The axe Playwright adapter depends on `axe-core ~4.13.0`. Although core 4.14.0 exists, pinning the adapter and core to 4.13.0 avoids two incompatible rule inventories. Playwright's exact package brings matching `playwright`/`playwright-core`; the adapter accepts that core.
- Use exact direct versions and a committed npm lockfile when implementation is authorized. D1 must then verify clean dependency resolution without peer overrides, strict typecheck, production build including the custom worker, and actual installed browser bundles. Research does not claim that resolution, bundling, native TypeScript binaries, browser installation, or execution has happened.

### Dexie transaction and migration constraints

Dexie's transaction promise resolves **after commit**, and rejects on failure/abort. All participating tables must belong to the transaction scope. IndexedDB auto-commits when no requests keep it active; awaiting fetch, file reads, hashing, timers, or other asynchronous APIs inside that scope can produce inactive/premature-commit failures. Dexie documents `waitFor` as a cautious workaround, not a substitute for preparing external work first. [Dexie transaction documentation](https://dexie.org/docs/Dexie/Dexie.transaction()).

IndexedDB transactions attach to one database connection and fixed object-store scope. Schema upgrade is exclusive, waits for other connections to close, and rolls back an aborted upgrade. There is no transaction spanning two independent IndexedDB databases or an atomic database-renaming primitive. Handle `versionchange`, blocked upgrade, abnormal close, quota failure, and abort explicitly. [IndexedDB transaction construct](https://www.w3.org/TR/IndexedDB-3/#transaction-construct), [upgrade transactions](https://www.w3.org/TR/IndexedDB-3/#upgrade-transaction), [opening a connection](https://www.w3.org/TR/IndexedDB-3/#opening-a-database-connection).

`Version.upgrade` receives an upgrade transaction; using it alone does not establish the product's isolated semantic candidate and complete cross-module validation. [Dexie upgrade API](https://dexie.org/docs/Version/Version.upgrade()). The product requires candidate validation, preserved prior facts on failure, and an atomic successful replacement, using the Restore-equivalent checks. [Workspace contract](../../specs/design/workspace.md#initialization-and-update-migration).

**Trader-accepted mechanism:** create isolated staged generations in the same database and activate through an atomic active-root/pointer transaction. Build and validate the candidate outside the live write transaction from one revision-bound snapshot, then recheck readiness, live binding, release/capability versions, complete candidate seal, and candidate binding inside the same-database all-participant activation transaction. Every reader and writer must resolve its generation through the root within its transaction; old tabs cannot retain a root and write into retired generations. Candidate immutability, generation-qualified keys/indexes, crash cleanup, and old-root recovery must be demonstrated. Do not switch between separate databases and call that atomic. Physical schema additions must preserve old authoritative records and a compatible export/recovery path until semantic activation succeeds. Measured mature-scale storage/memory headroom remains an execution gate.

D1/D6 execution gates must prove 200,000-fact candidate preparation/apply, controlled validation failure, apply failure after each participant, interruption/reopen, concurrent stale binding, blocked old tab, cleanup, unknown newer version rejection, seed additions preserving customization, and lossless history/count/binding agreement. No throughput or memory feasibility is inferred solely from the library documentation.

### Offline inventory and update implications

`injectManifest` injects a precache URL/revision manifest into an application-owned worker; Vite PWA compiles that worker. It does not implement application digest validation or safe Workspace migration. Workbox's default maximum precached asset size is 2,097,152 bytes. Explicit patterns and a size policy must include every required built asset, and omissions/warnings must fail the release inventory check. [Vite PWA custom worker guide](https://vite-pwa-org.netlify.app/guide/inject-manifest), [Workbox build reference](https://developer.chrome.com/docs/workbox/modules/workbox-build).

**Selected mechanism within the approved PWA stack:** build the canonical Offline Release Inventory from emitted production files, record application SHA-256 digests rather than equating Workbox revision identifiers with digest verification, stage and verify every required asset, and retain the compatible old inventory until safe activation. Do not copy the guide's unconditional auto-update `skipWaiting` behavior into an app with active unsaved forms. The initial launch must wait for verified service-worker control before Writable, and failed staging must preserve the old release. These obligations come from [delivery acceptance](../../specs/acceptance/acceptance-contract.md#offline-responsive-accessibility-and-performance), not from plugin selection.

### Capacity, hashing, and file verification APIs

`navigator.storage.estimate()` returns implementation-defined rough usage and conservative quota for origin storage, not measured free disk space or a reservation. IndexedDB and Cache Storage share the storage architecture. Persistent storage is permission-dependent; unavailable or denied protection does not itself decide Runtime Readiness. [WHATWG Storage Standard](https://storage.spec.whatwg.org/#usage-and-quota), [storage-management API](https://storage.spec.whatwg.org/#api).

**Trader-accepted measurement/headroom policy, 2026-10-11:** measure installed indexes/facts/history/private state for a 25,000-Trade/200,000-fact representative mature Workspace, maximum concurrent candidate/live replacement storage, old/new release caches, backup/export byte size, and peak export/hash/parse memory separately. Derive the required incremental headroom from those observations plus a disclosed conservative margin; compare it to quota minus observed usage on every required readiness boundary. Do not publish an arbitrary fixed MiB threshold as measured capacity, count already-stored bytes twice, or mistake an origin quota estimate for permission to skip actual abort/quota handling. The download file's disk footprint and in-memory digest buffers are different resources from origin quota. D1 must freeze the measurement recipe and evidence gate; implementation records the numeric constants before its release gate.

Ordinary `<input type="file">` exposes files selected by the user; File API supports asynchronous byte reads. Selection cancellation or a read failure is an unsuccessful verification, and the filename/MIME alone establishes no trust. Ordinary file download cannot attest that the host saved the file. [HTML file-upload state](https://html.spec.whatwg.org/multipage/input.html#file-upload-state-(type=file)), [File API array-buffer read](https://w3c.github.io/FileAPI/#readAsArrayBuffer), [backup ADR](../../specs/adr/0010-backup-download-verified-by-read-back.md).

Web Crypto exposes asynchronous `subtle.digest` for SHA-256 over bytes, yielding an ArrayBuffer; canonical UTF-8 serialization must be defined before hashing. The whole-buffer API implies real memory headroom for large artifacts. Hash outside IndexedDB transactions, then compare the expected source binding and full artifact digest during `confirmBackup`; no completed receipt follows download alone. [Web Cryptography digest algorithm](https://www.w3.org/TR/webcrypto/#SubtleCrypto-method-digest), [SHA algorithms](https://www.w3.org/TR/webcrypto/#sha).

#### Incremental SHA-256 for D6 — trader accepted 2026-10-11

**Trader-accepted additional package, 2026-10-11:** `@noble/hashes` **2.4.0**, published **2026-08-27T13:02:42.588Z**, verified from primary registry metadata on **2026-10-11**. It is ESM-only, declares Node `>=20.19.0` (satisfied by selected Node 24.21.0), has no runtime dependencies, and exports `./sha2.js`. [Exact package manifest](https://registry.npmjs.org/@noble/hashes/2.4.0), [publication metadata](https://registry.npmjs.org/@noble/hashes).

Exact-version package source was read from its registry tarball in memory, without saving, installing, or executing it. Public API: import `sha256` from `@noble/hashes/sha2.js`; construct `sha256.create()`; call `update(chunk: Uint8Array)` for each ordered byte chunk; call `digest()` once for the 32-byte result. `clone()` produces an independent state suitable for a prefix digest; finalizing the clone does not finalize the original. `digest()` finalizes/destroys its own state, so reuse after finalization is invalid. The input is bytes, not a string. [Tagged SHA-256 implementation](https://github.com/paulmillr/noble-hashes/blob/2.4.0/src/sha2.ts), [tagged incremental state and clone implementation](https://github.com/paulmillr/noble-hashes/blob/2.4.0/src/_md.ts), [project API guidance](https://github.com/paulmillr/noble-hashes#implementations).

**Planning implication:** native Web Crypto SHA-256 is a whole-buffer API. This accepted incremental implementation retains SHA-256 semantics while hashing canonical JSON bytes as the serializer emits them and hashing a trader-selected File/Blob through `stream().getReader()` until successful end-of-stream. Blob streams expose bytes without first requiring `arrayBuffer()` for the complete file. [File API stream method](https://w3c.github.io/FileAPI/#dom-blob-stream). Canonical ordering/escaping/UTF-8 encoding and self-digest exclusions must stay identical; splitting output into chunks must never change bytes or the artifact/manifest/section digest definitions. Read failure, cancellation, truncation, a byte-count mismatch, or expected digest/source-binding mismatch yields no completed receipt.

Incremental hashing alone proves neither a coherent database snapshot nor bounded-memory export/download/JSON validation. The plan must bound the serializer's chunks, retain coherent source bindings while assembling them outside a live IndexedDB transaction, and separately account for Blob backing/chunk retention, parsing, candidate staging, and download buffering. Actual browser memory/latency evidence remains required. Implementation verification must cross-check whole and arbitrarily chunked hashes against native SHA-256 for fixed vectors, empty input, Unicode, hash-block boundaries, cloned prefixes, streamed file completion and injected failures. The package choice is recorded only in planning; no installation, build, or benchmark was performed by this research.

Local loopback origins can be potentially trustworthy under Secure Contexts, but automation must actually observe `isSecureContext`, storage/crypto, service-worker control, and the installed inventory on the worktree's strict `DEV_PORT`. Loopback evidence supplements production HTTPS evidence. [Secure Contexts trustworthy-origin algorithm](https://w3c.github.io/webappsec-secure-contexts/#is-origin-trustworthy).

### Calendar provenance, DST, and finite horizon

The current NYSE primary calendar supplies 2026–2028 holidays and early closes; its equity core session is 09:30–16:00 Eastern Time. Examples to retain in fixtures: 2026-11-27 and 2026-12-24 close at 13:00 ET; 2028-07-03 closes early; 2028-01-01 being Saturday causes no observed New Year's holiday. The eligible-option 13:15 exception must not shift the product's regular equity-session cutoff. [NYSE hours and calendars](https://www.nyse.com/trade/hours-calendars).

For historical provenance, official annual PDFs exist for [2024](https://www.nyse.com/publicdocs/ICE_NYSE_2024_Yearly_Trading_Calendar.pdf) and [2025](https://www.nyse.com/publicdocs/ICE_NYSE_2025_Yearly_Trading_Calendar.pdf), supplemented by the exchange parent's announced [2024–2026 holiday and early-close schedule](https://s2.q4cdn.com/154085107/files/doc_news/NYSE-Group-Announces-2024-2025-and-2026-Holiday-and-Early-Closings-Calendar-2023.pdf). Scheduled holiday formulas are insufficient: NYSE explicitly closed all equity/options markets on **2025-01-09** for President Carter's National Day of Mourning. [ICE/NYSE special-closure notice](https://ir.theice.com/press/news-details/2024/The-New-York-Stock-Exchange-Will-Close-Markets-on-January-9-to-Honor-the-Passing-of-Former-President-Jimmy-Carter-on-National-Day-of-Mourning/default.aspx).

Temporal distinguishes calendar/wall time from exact instants; IANA zones supply offset/DST rules and ambiguous or skipped local-time handling. A fixed UTC−05 offset is wrong during daylight time. The approved polyfill is an explicit import rather than a guarantee of global native Temporal. [TC39 time-zone guide](https://tc39.es/proposal-temporal/docs/timezone.html), [polyfill project](https://github.com/js-temporal/temporal-polyfill). Its version pin alone does not freeze the host's time-zone data. Bundle explicit UTC close instants for each market-session row with `America/New_York` provenance; test Workspace-zone period conversion separately against fixed clocks and record browser/tz provenance.

Additional primary historical sources now support the requested roughly five-year historical interval:

| Years | Primary calendar input verified 2026-10-11 | Source precedence / fixture implications |
| --- | --- | --- |
| 2021 | [ICE/NYSE 2021–2023 announcement, 2020-12-28](https://ir.theice.com/press/news-details/2020/NYSE-Group-Announces-2021-2022-and-2023-Holiday-and-Early-Closings-Calendar/default.aspx) | 2021-12-24 is a full Christmas closure; 2021-11-26 closes at 13:00 ET. |
| 2022 | [ICE/NYSE 2022–2024 announcement, 2021-12-27](https://ir.theice.com/press/news-details/2021/NYSE-Group-Announces-2022-2023-and-2024-Holiday-and-Early-Closings-Calendar/default.aspx), [official 2022 annual PDF](https://www.nyse.com/publicdocs/ICE_NYSE_2022_Yearly_Trading_Calendar.pdf) | The later announcement adds Juneteenth closure 2022-06-20, absent from the older 2020 notice. No observed New Year's closure on 2021-12-31. |
| 2023 | [ICE/NYSE 2023–2025 announcement, 2022-12-21](https://ir.theice.com/press/news-details/2022/NYSE-Group-Announces-2023-2024-and-2025-Holiday-and-Early-Closings-Calendar/default.aspx), [official 2023 annual PDF](https://www.nyse.com/publicdocs/ICE_NYSE_2023_Yearly_Trading_Calendar.pdf) | Includes Juneteenth 2023-06-19 and early close 2023-07-03. |
| 2024–2025 | Official PDFs and newer 2023 schedule linked above, plus Carter closure notice | Special closure overrides previously announced ordinary schedule. |
| 2026–2028 | [ICE/NYSE published 2026–2028 schedule](https://ir.theice.com/press/news-details/2025/NYSE-Group-Announces-2026-2027-and-2028-Holiday-and-Early-Closings-Calendar/default.aspx), current NYSE page | Future schedules are published, finite policy inputs. |

**Trader-accepted coverage, 2026-10-11:** bundle independently checked explicit sessions for 2021-01-01 through 2028-12-31, including closures, early closes, source URLs/access dates/source hashes, supersession records, revision, and UTC close instants. Calendar source discovery is complete for that interval; extracted complete session rows, independent exception/closure audit, expected yearly counts, and cross-source comparisons remain implementation evidence gates. This is not approval to reject older trade facts or a claim that a mature historical review has been implemented. D1 discloses the accepted finite interval; a reviewed calendar extension needs additional primary inputs if valuation/Review history extends earlier; do not silently redefine the specification's historical reads. No runtime network request is needed for the bundled interval.

**Trader-accepted horizon handling, 2026-10-11:** dates outside verified coverage must never be fabricated from weekday rules or resolve to the last bundled session indefinitely. Expose an explicit safe calendar-coverage reason for affected operations, keep readable facts and backup accessible, and require a versioned calendar extension. Represent that reason in the existing typed rejection/evidence results and record the supported interval in the Installed Capability Manifest before implementation; it must not masquerade as a provider Missing Mark, corrupt stored Economic Dates, or create a new readiness rule without review.

Calendar execution evidence must cover normal active-session Monday-to-Tuesday behavior (AC-MARK-001), weekends, observed holidays, Good Friday, special closures, exactly-before/at/after a normal and early close, spring/autumn DST transitions, Workspace zone differing from New York, first/last supported dates, and both sides of the horizon. Published future schedules are policy inputs, not evidence that an exceptional future closure cannot occur; subsequent revisions require version/binding compatibility treatment.

### Arithmetic and test-evidence limitations

Decimal.js rounds arithmetic to configured significant-digit precision and rounding mode; constructor input can already lose information if passed as a JavaScript number. Configure a dedicated decimal constructor and parse domain values from strings. No finite precision makes every repeating division exact. The trader accepted retaining nonterminating derived values as exact numerator/denominator quotients, each component a decimal string, alongside decimal.js; conversion to rounded decimal values is only a presentation boundary. Required fee conservation, comparisons/sign classification, quotient normalization, and proportional allocation therefore need exact rules and adversarial tests rather than a high-precision approximation. [Decimal.js precision and rounding reference](https://mikemcl.github.io/decimal.js/#precision).

Fake IndexedDB is an in-memory JavaScript implementation suitable for disclosed fast test infrastructure, not evidence of actual browser disk/quota/upgrade/offline behavior. Playwright installs its own version-bound browser bundles. axe supplements keyboard, focus, zoom, contrast, and accessible-result inspection; automated rules do not prove complete accessibility. [fake-indexeddb project](https://github.com/dumbmatter/fakeIndexedDB), [Playwright installation](https://playwright.dev/docs/intro), [axe-core project](https://github.com/dequelabs/axe-core).
