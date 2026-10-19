# D1 — recorded evidence

This file is the retained execution record for D1's task-level evidence, in the format required by
`plan/deliverable-breakdowns/D1-install-trust-and-set-up.md` §6 and `plan/kickoff-prompt-d1-2026-10-17.md`.

## Provenance

| | |
|---|---|
| Branch | `deepseek-v41-flash` |
| Worktree | `/Users/ckolbegger/src/trade-journal-v3/worktrees/deepseek-v41-flash` |
| Node | `v26.12.0` (`process.versions.node` = `26.12.0`, inside `^26.12.0`) |
| npm | `11.20.0`, npx `11.20.0` (both from the Homebrew Node keg) |
| OS | macOS 26.6.2, build 25G83, arm64 |
| Browsers | Chromium 156.0.8078.4 / Playwright build 1248; WebKit 27.2 / Playwright build 2370 |
| Loopback origin | `http://127.0.0.1:5177` from `DEV_PORT` in `.env.local` |

`DEV_PORT` provenance: the npm cache lives outside the worktree
(`npm_config_cache=/tmp/tj-npm-cache`) because the harness sandbox does not permit writes to `~/.npm`.
That is an execution-environment accommodation only; no recorded command depends on it.

---

## T1 — `S` Application shell and pinned toolchain profile

Structural task: exact verification instead of invented unit tests. All commands run from the worktree root.

| # | Command | Observed | Result |
|---|---|---|---|
| V1.1 | `npm ci` | exit 0; `package-lock.json` sha256 `226e0954…503da` before and after | pass |
| V1.2 | `npx tsc --noEmit` | exit 0; `strict`, `noUncheckedIndexedAccess`, explicit `rootDir`/`types`/`moduleResolution: bundler`/`target: es2022` in `tsconfig.json`; program includes `src/`, `tests/`, `scripts/` | pass |
| V1.3 | `npm run build` | exit 0; `dist/index.html`, `dist/manifest.webmanifest`, `dist/sw.js` present; stdout contains exactly one `release-id: <64 hex>` line (`grep -c` = 1) | pass |
| V1.4 | `npm run dev` with `DEV_PORT` in `.env.local`; `grep -n "DEV_PORT" vite.config.ts playwright.config.ts` | serves `http://127.0.0.1:5177/` (HTTP 200); grep prints exactly two matches, one per file | pass |
| V1.5 | `npx vitest run --reporter=dot` | exit 0; 1 file, 1 test (`tests/smoke/shell.test.tsx`) | pass |
| V1.6 | `npx playwright test tests/browser/shell.spec.ts --project=chromium --project=webkit` | exit 0; 2 passed; every recorded request origin equals the loopback origin | pass |
| V1.7 | `grep -rn "console.log" src --include=*.ts` | no output | pass |
| V1.8 | `npx tsc -v && npx tsc6 -v && npx eslint --version` | `Version 7.0.2`, `Version 6.0.3`, `v10.13.0` | pass |
| V1.9 | seeded `src/lint-probe.ts`, `npm run lint`, remove probe, exit with lint's status | exit 1; names `src/lint-probe.ts` at `1:14`, rule `@typescript-eslint/no-explicit-any`; clean tree `npm run lint` exits 0 | pass |

**Interpretation recorded (not a plan change).** V1.3 asserts *existence* of `dist/manifest.webmanifest`
and the service-worker entry after a build. T16 owns the manifest's asserted content and the Offline
Release Inventory, and T18 owns the versioned worker with cache and control. T1 therefore ships the
static manifest (`public/manifest.webmanifest`) and an inert, non-registered worker entry (`public/sw.js`)
that Vite copies into `dist`; nothing in T1 registers a worker or advertises a capability. No seam shape,
durable format, or scenario status changes.

**Toolchain note.** The new `npm run lint` gate surfaced three pre-existing dead locals in
`scripts/check-deliverable-breakdown.mjs` and `scripts/audit-breakdown-coverage.mjs`. They were removed
(the smallest change that makes the declared gate exit 0); both plan validators still report
`0 failure(s), 0 warning(s)` and no plan file changed.

---

## T2 — `S` Layer-boundary lint

Structural task: exact verification instead of invented unit tests. The rule set is data in
`scripts/layers.config.mjs`; the checker is `scripts/check-layers.mjs`.

| # | Command | Observed | Result |
|---|---|---|---|
| V2.1 | `npm run lint:layers` | exit 0; `6 files, 0 violations` over the current tree | pass |
| V2.2 | `npm run lint:layers --fixtures tests/lint-fixtures` | exit 0; one line per fixture naming its rule; `11 fixtures, 11 violations, 0 missed` | pass |
| V2.3 | `grep -rn "from \"decimal.js\"" src --include=*.ts \| grep -v "^src/values/"` | no output (grep exit 1) | pass |
| V2.4 | `grep -rn "indexedDB" src --include=*.ts \| grep -v "^src/persistence/indexeddb/"` | no output (grep exit 1) | pass |
| V2.5 | `grep -rn "navigator\.\|serviceWorker\|showSaveFilePicker\|showOpenFilePicker" src --include=*.ts \| grep -v "^src/platform/host/"` | no output (grep exit 1) | pass |
| V2.6 | `npm run build`; then an injected `src/ui/__violation.ts` importing `../persistence/index`, `npm run build`, remove the file | clean build exit 0 with `lint:layers` first; injected build exit 1 at `lint:layers`, printing `presentation-imports-persistence — ui (presentation) imports persistence (persistence)`, before Vite runs | pass |

The fixture set carries one forbidden import or protected global per enforced rule: fact→coordinator,
analysis→storage, analysis→clock, analysis→calendar, analysis→another module, analysis→raw `Execution`,
presentation→persistence, `decimal.js` outside values, `indexedDB` outside `src/persistence/indexeddb`,
a host identifier outside `src/platform/host`, and an undeclared module path. `tests/lint-fixtures` is
excluded from `tsconfig.json` because the fixtures are deliberately invalid inputs parsed as text.

---

## T3 — `S` Unit and integration test harness with disclosed substitutions

| # | Command | Observed | Result |
|---|---|---|---|
| V3.1 | `npx vitest run --reporter=dot` | exit 0; prints `harness bootstrap: tests/harness/bootstrap.ts`, `substitution registry: tests/substitutions.md`, `vitest: 5.0.5 (resolved from package-lock.json)`; 3 files / 4 tests pass | pass |
| V3.2 | `npx vitest run tests/harness/substitution-registry.test.ts` | exit 0. Negative check: blanking `realEngineCounterpart` on the `fake-indexeddb` row fails with `"fake-indexeddb: realEngineCounterpart"`, then the file is restored | pass |
| V3.3 | `npx playwright test tests/browser/harness.spec.ts --project=chromium --project=webkit` | exit 0; both pass; `artifacts/browser/provenance-chromium.json` records `156.0.8078.4` and `provenance-webkit.json` records `27.2`, each `"decisionInput": false`; no `src` file reads `userAgent`/`platform` | pass |
| V3.4 | `grep -rn "fake-indexeddb" tests --include=*.ts \| grep -v "^tests/harness/bootstrap"` | no output (grep exit 1): only the bootstrap installs the substitute, through Vitest `setupFiles` | pass |
| V3.5 | `npx vitest run tests/harness/mock-free.test.ts` | exit 0 on the current tree. Negative check: an injected `tests/integration/__probe.test.ts` with `vi.mock` fails the guard with `tests/integration/__probe.test.ts:2 uses vi.mock`, then the probe is removed | pass |
| V3.6 | `npx playwright test tests/browser/a11y-smoke.spec.ts` | exit 0; axe-core reports no violations on the shell in all four projects | pass |

Playwright projects are `chromium`, `webkit`, `narrow` (375×812) and `wide` (1440×900); the browser
specs run against the loopback secure origin from `DEV_PORT`. The substitution registry discloses
`fake-indexeddb`, the loopback origin, and the controlled host-capability implementation.

---

## T4 — `S` Injected `Clock` port

| # | Command | Observed | Result |
|---|---|---|---|
| V4.1 | `npx tsc --noEmit` | exit 0; `Clock`, `FixedClock`, `SystemClock` are re-exported from `src/composition/root.ts`, and every consumer obtains time through the context | pass |
| V4.2 | `grep -rn "Date.now()\|new Date(" src --include=*.ts \| grep -v "^src/platform/clock/"` | no output (grep exit 1): the clock implementation is the only time reader | pass |
| V4.3 | `npx vitest run tests/platform/clock-injection.test.ts` | exit 0; 2 tests: the fixed clock returns the injected instant, and two modules composed from one root observe the identical instant | pass |
| V4.4 | `npx playwright test tests/browser/clock.spec.ts --project=chromium` | exit 0; the shell renders `<time>2026-10-19T13:30:00.000Z</time>` from the harness `addInitScript`, not wall-clock time | pass |
| V4.5 | `npm run build`; `grep -n "platform/clock" dist/assets/*.js` | build exit 0; grep prints the `src/platform/clock` provenance constant carried by the production clock instance, so the port is wired in the built bundle | pass |

The browser harness injects its fixed instant through `window.__TRADE_JOURNAL_CLOCK__` in an
`addInitScript`. That is the documented harness seam, validated as an ISO instant; it is not a stored
setting and it cannot change a stored Economic Date. The port also exposes its `source` so evidence can
name the seam, which is what puts `src/platform/clock` in the production bundle.

---

## T5 — `B` Versioned U.S. session calendar

Cases were added one at a time, run red for the stated reason, then made green with the smallest
production change. All runs used `HEAD c732fdf` with the T5 working tree uncommitted; the green state
was then committed. `./src/calendar` did not exist before this task.

| # | Case phrase | Red command and observation | Green command and observation |
|---|---|---|---|
| T5.1 | an identical result for the same instant and revision across two calls … pure | `npx vitest run tests/calendar/session-date.test.ts -t "identical result"` — failed to resolve `../../src/calendar`: the resolver was absent | same command — 1 passed, the two calls are deeply equal with the system clock moved between them |
| T5.2 | the completed session's U.S. Trading Date … inside the regular trading session | `npx vitest run tests/calendar/session-date.test.ts -t "inside the regular trading session"` — `tradingDate` was `2026-10-20`; the resolver returned the calendar date of the instant instead of `2026-10-19` | same command — 1 passed |
| T5.3 | the prior session's trading date … after the close and before the next open | `npx vitest run tests/calendar/after-close.test.ts -t "prior session's trading date"` — `tradingDate` was `2026-10-19`; no close time was consulted | same command — 1 passed, `2026-10-20` |
| T5.4 | skip the weekend and the observed Independence Day, Thanksgiving and Christmas closures … | `npx vitest run tests/calendar/session-date.test.ts -t "closed day"` — first `2026-10-17` (a Saturday treated as a session), then `2026-07-03` (the observed holiday treated as a session); expected `2026-10-16` and `2026-07-02` | same command — 1 passed with all four closed days resolving to their prior trading date |
| T5.5 | the same trading date and revision when the process time zone is UTC and when it is Asia/Tokyo | `TZ=UTC npx vitest run tests/calendar/timezone-invariance.test.ts` and `TZ=Asia/Tokyo …` — both returned `2026-10-20`; the resolver read the instant's UTC date instead of the exchange session | both commands — 1 passed each, `2026-10-19`, after resolving through `Intl` with the revision's explicit `America/New_York` zone |
| T5.6 | a revision-declared early-close half day as its own session boundary | `npx vitest run tests/calendar/after-close.test.ts -t "early-close half day"` — `2026-11-25`; the 13:00 half-day close was not consulted | same command — 1 passed, `2026-11-27` |
| T5.7 | expose the trading date and the revision identity as separate fields … | `npx vitest run tests/calendar/session-date.test.ts -t "separate fields"` — returned `us-session-2026.1` for a 2025 instant; the pinned revision argument was ignored | same command — 1 passed with `us-session-2025.1` and `tradingDate: 2025-10-21` |
| T5.8 | a typed CalendarOutOfRange naming the revision and its covered interval … | `npx vitest run tests/calendar/revision-range.test.ts` — outcome was `Resolved`; the resolver extrapolated a 2030 date | same command — 1 passed with `CalendarOutOfRange`, `us-session-2026.1`, and the interval `2026-01-01T00:00:00.000Z`–`2027-01-01T00:00:00.000Z` |

**Calendar shape.** Two revisions are declared (`us-session-2025.1`, `us-session-2026.1`), each with an
explicit instant interval, the exchange time zone, the regular close, the declared closures and the
declared 13:00 half days. The resolver is pure integer civil-date arithmetic plus one `Intl` exchange
reading; it reads no storage, no network and no host clock.

**Integration case deferred to its first possible owner.** T5's integration case initializes a fresh
Workspace and asserts the resolved trading date and revision in the persisted initialization receipt.
`Workspace.initialize` is T25, which depends on T11/T20/T21/T22/T23 and cannot exist at T5. The
assertion lands with T25's receipt (which already records readiness and seed evidence), and T33 repeats
it through the real stack. This is a scheduling consequence of the frozen graph, not a scope change.

---

## T6 — `B` Money, Price, and Quantity value layer over `decimal.js`

| # | Case phrase | Red command and observation | Green command and observation |
|---|---|---|---|
| T6.1 | add two Money values exactly … when the sum exceeds the range a JS number represents without loss | `npx vitest run tests/values/money-add.test.ts -t "add two Money"` — amount `9007199254740992`; the first implementation stored amounts as a `number` and lost the low-order digit (expected `…994`) | same command — 1 passed with `9007199254740994` after the layer moved to `decimal.js` |
| T6.2 | reject an operation mixing two currencies with a typed CurrencyMismatch | `npx vitest run tests/values/currency.test.ts` — `{ ok: true, value: { amount: "3", currency: "USD" } }`; both operands were coerced to the left operand's currency | same command — 1 passed with `CurrencyMismatch { left: "USD", right: "EUR" }` from both `addMoney` and `subtractMoney` |
| T6.3 | compute a position value … with no implicit rounding when the price carries more decimal places than the display scale | `npx vitest run tests/values/money-add.test.ts -t "position value"` — absent, then `30.38`; the first implementation rounded to the 2-decimal display scale | same command — 1 passed with `30.375` |
| T6.4 | classify a cancelling difference as exactly zero and never as negative zero | `npx vitest run tests/values/zero.test.ts` — no module: the value layer was absent | same command — 1 passed; `5 − 5` canonicalises to `"0"` and equals a constructed zero Money |
| T6.5 | reject a Quantity carrying more scale than the instrument class allows with a typed ScaleExceeded | `npx vitest run tests/values/scale.test.ts` — `{ ok: true, … }`; every scale was accepted | same command — 1 passed with `ScaleExceeded { instrumentClass, offending, allowedScale }` for stock scale 5 and option scale 1 |
| T6.6 | round-trip a Money, Price and Quantity through the persistence codec … no numeric coercion | `npx vitest run tests/values/codec-round-trip.test.ts` — absent, then `1234567890.1234567`; the codec serialized through `Number()` | same command — 1 passed with `1234567890.123456789012345678` and every encoded amount a JSON string |
| T6.7 | reject construction of an authoritative Money from a JS number literal with a typed NonExactInput | `npx vitest run tests/values/non-exact-input.test.ts` — `{ ok: true, … }`; a number literal was accepted | same command — 1 passed with `NonExactInput { field: "money.amount" }` |

The layer is pure, imports `decimal.js` and nothing else, and deliberately has **no** fee-apportionment
helper (PD10). Quantity carries its instrument class so the codec can revalidate scale on decode.

**Durable integration half.** The store round-trip ("written through the production persistence codec,
read back from the real store, asserted on durable bytes") needs the schema and seam, so it runs from T9
and joins the cumulative suite at T11, exactly as the task text allows. The codec itself is proven here;
the durable bytes assertion is recorded with T9/T11.

---

## T7 — `S` Browser-host capability port

| # | Command | Observed | Result |
|---|---|---|---|
| V7.1 | `npx tsc --noEmit`; `grep -rn "StorageManager\|CacheStorage\|FileSystemHandle\|\bCache\b" src --include=*.ts \| grep -v "^src/platform/host/"` | typecheck exits 0; the grep has no output, so no raw host type crosses the port boundary | pass |
| V7.2 | `grep -rn "navigator\.\|caches\.\|registration\." src --include=*.ts \| grep -v "^src/platform/host/"` | no output (grep exit 1) | pass |
| V7.3 | `npx vitest run tests/platform/host-port.test.ts` | exit 0; with a capability absent every operation returns typed `NotExposed`; with `persisted` present it reports `Protected` / `BestEffort(reason)` / `Unavailable(reason)` exactly; capacity, durability, control and cached bytes are asserted; nothing throws | pass |
| V7.4 | `npx playwright test tests/browser/host-port.spec.ts --project=chromium` | exit 0; the launch protection state is recorded to `artifacts/browser/host-protection-chromium.json` (`BestEffort`, Chromium `156.0.8078.4`); a download call yields `evidence.txt` in Playwright's download directory; a file chosen through an ordinary file input is read back as `selected.txt` / `trade journal` | pass |
| V7.5 | `npx vitest run tests/platform/host-port-no-gate.test.ts` | exit 0; the port exposes exactly the seven reported operations and its source names no readiness outcome (`Writable`, `RecoveryOnly`, `Unsupported`, `Initialization Required`) | pass |

The port reports host facts only: protection, capacity, the durability request, service-worker control,
cached asset bytes, a file download, and reading a trader-selected file. A browser harness flag
(`window.__TRADE_JOURNAL_HARNESS__`) exposes the port to `tests/browser/host-port.spec.ts`, the same
documented seam style as the fixed clock; product code never reads the flag. The file chooser needs a
user activation, so the spec clicks a harness-created button and the port's input click runs inside that
activation.

---

## T8 — `B` Shared result-union and `RuntimeNotWritable` conventions

| # | Case phrase | Red command and observation | Green command and observation |
|---|---|---|---|
| T8.1 | runtimeReadiness Unsupported, every supplied failed check, workspaceStatus None and the ordered safe actions | `npx vitest run tests/results/runtime-not-writable.test.ts -t "every supplied failed check"` — the constructor kept only the first failed check | same command — 1 passed with all three failures in input order |
| T8.2 | RecoveryOnly together with readable Workspace status and backup safe actions | `npx vitest run tests/results/runtime-not-writable.test.ts -t "RecoveryOnly"` — `workspaceStatus` was `None`; the constructor hardcoded the Unsupported default | same command — 1 passed with `RecoveryOnly` |
| T8.3 | IntegrityBlocked and never None when a known or possible existing root could not be read | `npx vitest run tests/results/integrity-blocked.test.ts` — `workspaceStatus` was `None`; the `existingRootUnreadable` signal was ignored | same command — 1 passed with `IntegrityBlocked` |
| T8.4 | reject construction with an empty failed-check list with a typed programming error | `npx vitest run tests/results/empty-failed-checks.test.ts` — no error thrown; an empty branch was representable | same command — 1 passed with `ResultConventionError { kind: "RuntimeNotWritableRequiresFailedCheck" }` |
| T8.5 | a stable documented order for identical inputs across two constructions | `npx vitest run tests/results/runtime-not-writable.test.ts -t "stable documented order"` — input order leaked through (`try-another-browser` first) | same command — 1 passed; both constructions equal `retry, request-durability, export-backup, try-another-browser, recovery-guidance` |
| T8.6 | the isRuntimeNotWritable discriminator … negatively for a typed trader rejection | `npx vitest run tests/results/discriminator.test.ts` — absent, then `true` for `{ outcome: "Rejected" }`; the first discriminator accepted any object | same command — 1 passed; safety true, trader rejection, `null` and a string false |
| T8.7 | exactly one cross-cutting RuntimeNotWritable member alongside command-specific members | `npx vitest run tests/results/mutation-union.test.ts` — `MUTATION_OUTCOMES` and `assertNever` were absent | same command — 1 passed; exactly one of the four result branches is the safety branch, and the availability union is exhaustive through `assertNever` |
| T8.8 | round-trip the payload through the persistence codec with workspaceStatus and safeActions preserved exactly | `npx vitest run tests/results/codec-round-trip.test.ts` — absent, then `safeActions` were dropped on decode | same command — 1 passed with a deep-equal payload |

**Boundary-equality row deferred to its first possible owner.** The third row of the task's red/green
table ("the seam builds its own ad-hoc rejection shape") needs the persistence seam, which is T11. T11's
write gate must construct its rejection with this one constructor, and the field-for-field comparison
against a directly built payload lands in T11's `transaction-write-gate` evidence and is repeated by
T33's integration suite. The single-constructor guarantee is already enforced structurally: `results`
exports the constructor and the codec decodes through it.

---

## T9 — `S` IndexedDB schema, object stores, and schema-version baseline

| # | Command | Observed | Result |
|---|---|---|---|
| V9.1 | `npx vitest run tests/persistence/schema.test.ts` | exit 0; `db.version` equals `SCHEMA_VERSION` (1); `objectStoreNames` equals the manifest; every keyPath and index matches; `schemaMismatches` returns `[]`; a renamed `lifecycleIndex.state` index is reported as `lifecycleIndex: the index lifecycleState is missing` | pass |
| V9.2 | `npx vitest run tests/persistence/schema-manifest.test.ts` | exit 0; the declared manifest validates; an added store with no residency, a rebuildable store with no rebuild source, and a rebuild source that is not authoritative each fail naming the store | pass |
| V9.3 | `npx vitest run tests/persistence/schema-boundedness.test.ts` | exit 0 at 25,000 lifecycle rows with 200 Open; one index cursor, 200 cursor steps, one bounded batch of 200 member records, and the counters agree with prototypes instrumented for the test (`openCursor` 1, `get` 200); no elapsed-time assertion | pass |
| V9.4 | `npx playwright test tests/browser/schema.spec.ts --project=chromium` | exit 0; a real Chromium IndexedDB database is created with `objectStoreNames` equal to the manifest, a row is written, the page is closed and a fresh page reopens the same version with the row intact | pass |
| V9.5 | `grep -rn "createObjectStore\|createIndex\|deleteObjectStore" src --include=*.ts \| grep -v "^src/persistence/indexeddb/schema"` | no output (grep exit 1) | pass |
| V9.6 | `npx vitest run tests/persistence/schema-rebuild.test.ts` | exit 0; after the rebuildable projection's contents are deliberately deleted, `rebuildProjections` reproduces identical contents from `lifecycleIndex` | pass |

**Schema shape.** Authoritative stores `tradeRecord`, `journal`, `marketData`, `referenceCatalog`,
`workspaceMeta`, `lifecycleIndex`; one rebuildable `lifecycleListProjection` rebuilt from
`lifecycleIndex`; the candidate namespace is `trade-journal-candidate-*` (`CANDIDATE_DATABASE_PREFIX`)
for T10. Indexes cover lifecycle state membership, fact Economic Time, Journal Anchor, Journal
obligation key, Market Data key-and-date and reference kind-and-parent. The manifest validator runs in
`openDatabase`, so an undeclared store or an unrebuildable projection cannot be opened.

**Bounded-batch reading.** The batch is one logical participant read whose members are the at-most-
`batchSize` Open identities the cursor collected; the physical `get` count equals the row count, and
the test asserts both the logical counters and the instrumented physical calls. No latency figure is
measured or claimed. The browser harness exposes the schema to `tests/browser/schema.spec.ts` through
`window.__TRADE_JOURNAL_SCHEMA__`, the same documented harness seam as the clock and host port.

---

## T10 — `B` Migration runner with isolated candidate and atomic pointer flip

| # | Case phrase | Red command and observation | Green command and observation |
|---|---|---|---|
| T10.1 | build the candidate, validate every section, and flip the active pointer only after validation … one supported step behind | `npx vitest run tests/persistence/migration.test.ts` — absent, then `VersionError` when reopening the source at version 1: the first implementation upgraded in place and destroyed the source-version database | same command — 1 passed; the source stays openable at version 1 with its row, the pointer names `trade-journal-candidate-m1`, and `readActiveVersion()` is 2 |
| T10.2 | leave the prior database readable and unchanged … when validation of one candidate section fails | `npx vitest run tests/persistence/migration-rollback.test.ts` — outcome was `Migrated`; the validator was ignored | same command — 1 passed with `MigrationBlocked / ValidationFailed / "journal: the journal section is incoherent"`, no pointer, source unchanged, candidate deleted |
| T10.3 | add a new manifest default to the candidate without overwriting a trader rename | `npx vitest run tests/persistence/migration-seed-additions.test.ts` — the receipt listed `strategy.long-stock` and the trader label was replaced by the manifest label | same command — 1 passed; the rename is retained, only `strategy.long-call` is added, and the receipt names only that addition |
| T10.4 | reject an unknown newer stored version with a typed UnsupportedVersion naming both versions and write nothing | `npx vitest run tests/persistence/migration-unsupported.test.ts` — with the guard removed the runner attempted a best-effort open and threw `VersionError`; the check was then re-established | same command — 1 passed with `{ outcome: "UnsupportedVersion", storedVersion: 3, targetVersion: 2 }`, no pointer |
| T10.5 | reject a conversion that cannot preserve an authoritative identity/fact/audit revision/provenance … LossyMigrationRequired | `npx vitest run tests/persistence/migration-lossy.test.ts` — outcome was `Migrated`; the refusal was skipped | same command — 1 passed with `LossyMigrationRequired`, no pointer, source unchanged, candidate absent |
| T10.6 | discard a stale candidate and leave the prior version in control when interrupted before the pointer flip | `npx vitest run tests/persistence/migration-interrupted.test.ts` — `trade-journal-candidate-stale` was still present after the run | same command — 1 passed; the stale candidate is gone, the pointer names the fresh candidate, the source is still at version 1 |
| T10.7 | rebuild the private projections inside the candidate and prove recomputed index membership equals the stored membership before the flip | `npx vitest run tests/persistence/migration-projection.test.ts` — `privateRebuilds` was empty and the projection held no rows | same command — 1 passed; the candidate's `lifecycleListProjection` equals the authoritative lifecycle membership and the receipt names the rebuild |
| T10.8 | return a migration receipt naming the schema transitions, the migrations applied, the seed versions and additions, and every private rebuild | `npx vitest run tests/persistence/migration-receipt.test.ts` — `schemaTransitions` was `[]` | same command — 1 passed with `{ from: 1, to: 3 }`, both migration ids, `seed-v3`, `["strategy.long-call"]` and `["lifecycleListProjection"]` |

**Mechanism.** The active database is named by an atomic pointer record in the `trade-journal-control`
database; the candidate is `trade-journal-candidate-<migrationId>`. A run reads the source at its stored
version (never opening it at a lower version), transforms an in-memory snapshot through the plan's
steps, applies only genuinely missing seed additions by stable key, writes and rebuilds the candidate,
validates it, verifies projection membership, and only then writes the pointer. Any refusal or failed
validation deletes the candidate and leaves the pointer and source untouched; stale candidates are
discarded at the start of the next run.

**Startup integration deferred to its first owner.** T10's integration case runs the production startup
path (`Workspace.initialize`, T25) against an older-version database. T25 is later in the graph, so the
`initialize` → `migrate` path and its restart assertion are recorded with T25 and repeated by T33.

---

## T12 — `B` Persistence-level write gate returning `RuntimeNotWritable`

For each case the behaviour under test was temporarily reverted to exactly the defect the task's
red/green table names, the case was run and observed failing for that reason, and the behaviour was then
restored for the green run. Red is therefore an observation of the defect, not of a harness problem.

| # | Case phrase | Red command and observation | Green command and observation |
|---|---|---|---|
| T12.1 | reject with RuntimeNotWritable carrying the current readiness outcome and every failed check | `npx vitest run tests/persistence/write-gate.test.ts -t "every failed check"` — gate checked in the caller and the seam still wrote: result was `Committed` | same command — 1 passed; `Rejected` with `runtimeReadiness: RecoveryOnly`, every failed check, `workspaceStatus: RecoveryOnly` and the ordered actions; the write never ran |
| T12.2 | reject before opening any readwrite transaction … zero count and identical revisions | `npx vitest run tests/persistence/write-gate-no-transaction.test.ts` — the seam opened the transaction and wrote: `Committed` with `readwriteTransactions` 1 | same command — 1 passed; 0 transactions and byte-identical revisions |
| T12.3 | runtimeReadiness Unsupported and workspaceStatus None with safe retry actions when no readable root exists | `npx vitest run tests/persistence/write-gate-no-root.test.ts` — `workspaceStatus` was `RecoveryOnly` | same command — 1 passed; `None` with `retry` before `try-another-browser` |
| T12.4 | workspaceStatus IntegrityBlocked … and must not fall through to initialization | `npx vitest run tests/persistence/write-gate-integrity.test.ts` — `workspaceStatus` fell back to `None`; the payload did not match | same command — 1 passed; `IntegrityBlocked` and no initialization callback |
| T12.5 | allow the write and return the command-specific post-commit revisions when all four checks pass | `npx vitest run tests/persistence/write-gate.test.ts -t "post-commit revisions"` — the all-pass run was refused | same command — 1 passed; `Committed` with `{ revisions: { tradeRecord: 3 } }` |
| T12.6 | reject the next mutation when Writable was invalidated after an earlier successful write | `npx vitest run tests/persistence/write-gate-recheck.test.ts` — the first `Writable` verdict was cached, so the second mutation committed | same command — 1 passed; the second mutation is rejected and its callback never runs |
| T12.7 | exempt Workspace.requestDurability while still reporting protection honestly | `npx vitest run tests/persistence/write-gate-exemption.test.ts` — `Error: the gate refused the exempt path` | same command — 1 passed; `inspect()` returns the same `RecoveryOnly` state and the exempt operation reaches the host |
| T12.8 | leave every authoritative revision unchanged for every rejection branch | `npx vitest run tests/persistence/write-gate-revisions.test.ts` — the rejection branch committed and incremented both revisions | same command — 1 passed for all three branches (`RecoveryOnly`, `Unsupported`, unreadable root) |

The gate is evaluated before any transaction is opened and re-evaluates on every mutation; the exempt
`requestDurability` path reads `inspect()` and never calls `beforeWrite()`. The rejection payload is built
by T8's single constructor, so the seam cannot drift from the UI-visible shape.

**Integration case deferred to its first owners.** The production save path with readiness forced to fail
needs the catalog module (T24) and the transaction seam (T11); the same case is driven by T11's write-gate
evidence and by T33's integration suite, with the UI bypassed.

---

## T11 — `S` Atomic multi-store transaction seam

| # | Command | Observed | Result |
|---|---|---|---|
| V11.1 | `npx vitest run tests/persistence/transaction.test.ts` | exit 0; one commit naming `tradeRecord`, `journal` and `referenceCatalog` writes all three and returns `{ tradeRecord: 1, journal: 1, referenceCatalog: 1 }`, which equals the persisted `workspaceMeta.revisions` row | pass |
| V11.2 | `npx vitest run tests/persistence/transaction-rollback.test.ts` | exit 0; when the third participant's row cannot be written, the commit rejects, `onabort` fires, and the first two stores and the revision row are byte-identical to the pre-transaction snapshot | pass |
| V11.3 | `npx vitest run tests/persistence/transaction-write-gate.test.ts` | exit 0; a non-`Writable` gate returns `RuntimeNotWritable`, the readwrite counter is 0, no rows and no revisions are written, and the payload is field-for-field equal to `runtimeNotWritable(...)` built directly (T8's boundary-equality row) | pass |
| V11.4 | `npx vitest run tests/persistence/transaction-snapshot.test.ts` | exit 0; a snapshot opened before a concurrent commit still reads the pre-commit rows, while a fresh snapshot sees both | pass |
| V11.5 | `npx vitest run tests/persistence/transaction-single.test.ts` | exit 0; exactly one `readwrite` transaction is opened and it spans the three named stores; the seam's counter is 1; no nested transaction | pass |
| V11.6 | `npx playwright test tests/browser/transaction.spec.ts --project=chromium --project=webkit` | exit 0 on both engines; after the staged write is aborted the page is fully stopped and reopened, every store holds its prior rows and the revision row is unchanged | pass |
| V11.7 | `grep -rn "IDBDatabase\|IDBTransaction" src --include=*.ts \| grep -v "^src/persistence/indexeddb/"` | no output (grep exit 1) | pass |

The seam exposes one `commit(participants)` entry, evaluates T12's gate before opening anything, groups
participants by store into one transaction, increments and persists the per-store revisions inside that
same transaction, resolves on `oncomplete` and rejects on `onabort`, and offers a separate read-only
`snapshot(stores)` path. The browser harness exposes the seam to the real-engine spec with a Writable
gate; product code never uses that bridge. The Journal-participant rollback proof is deferred to D2 by
PD3 item 5.

---

## T13 — `B` Optimistic revisions and typed conflict results

Each red was observed against the named defect (temporarily applied, then restored) or against an absent
module for a new file's first case.

| # | Case phrase | Red command and observation | Green command and observation |
|---|---|---|---|
| T13.1 | commit and return the new record revision when the expected revision equals the current one | `npx vitest run tests/persistence/revision-committed.test.ts` — a matching expectation was reported as stale: `Conflict` instead of `Committed` | same command — 1 passed; revision `trade-1@2` and the post-commit subject |
| T13.2 | a typed Conflict carrying the current revision and the changed domains, and write nothing, when the expected revision is stale | `npx vitest run tests/persistence/revision-conflict.test.ts` — the stale command overwrote the record (`Committed` with `price: "99"`) | same command — 1 passed; `Conflict { current: trade-1@2, changedDomains: ["price","quantity"] }` and the record still at `price: "11"` |
| T13.3 | reject a query snapshot token where a mutation revision is required with WrongBindingKind and no write | `npx vitest run tests/persistence/revision-kind.test.ts` — the token was accepted and produced a `Conflict` instead of a kind rejection | same command — 1 passed with `{ expected: "querySnapshot", required: "recordRevision" }` and no write |
| T13.4 | preserve fact identity while appending exactly one immutable version when a retained reference is corrected | `npx vitest run tests/persistence/revision-versions.test.ts` — the correction replaced the version chain instead of appending | same command — 1 passed; the same `trade-1` identity carries `[{revision:1,…},{revision:2,…}]` |
| T13.5 | increment the Workspace content revision exactly once per committed semantic command even when several stores participate | `npx vitest run tests/persistence/revision-content.test.ts` — the counter was incremented once per participant (3 for one command) | same command — 1 passed; the first command is content revision 1 and the second 2, with three stores participating |
| T13.6 | leave every revision unchanged for each expected no-write result — Rejected, Conflict and RuntimeNotWritable | `npx vitest run tests/persistence/revision-unchanged.test.ts` — the Conflict branch wrote before returning, so the store fingerprint changed | same command — 1 passed for `Conflict`, `WrongBindingKind`, `Rejected` and `RuntimeNotWritable`; the store and revision rows are byte-identical |
| T13.7 | return the canonical post-commit representation of every directly changed subject so the caller renders without a follow-up read | `npx vitest run tests/persistence/revision-postcommit.test.ts` — the result carried only `{ id }` | same command — 1 passed; `subject` deep-equals the persisted row and the revision and content revision are present |

The revisioned layer distinguishes binding kinds, rejects a `querySnapshot` token as a mutation binding,
reads the current revision through the seam's snapshot path, writes one version per correction under the
same identity, and requests the `workspaceContentRevision` counter once per command so the seam increments
it once inside the same transaction. The test harness's own first fingerprint was vacuous
(`JSON.stringify` dropped the snapshot's `rows` function); it was corrected to serialize the actual rows
before the red was accepted.

---

## T14 — `B` Snapshot-consistent multi-module reads

| # | Case phrase | Red command and observation | Green command and observation |
|---|---|---|---|
| T14.1 | one coherent view bound to the represented fact, observation, Journal and reference revisions when no writer commits | `npx vitest run tests/persistence/snapshot-coherent.test.ts` — a coherent read was reported as changed | same command — 1 passed; the model and `{ tradeRecord: 1, journal: 1, referenceCatalog: 1 }` in one attempt |
| T14.2 | ChangedDuringAssembly naming the changed revisions, and never a mixed result, when a writer commits between two module reads | `npx vitest run tests/persistence/snapshot-torn.test.ts` — the mid-assembly commit was not detected and an `Assembled` model was returned | same command — 1 passed; `ChangedDuringAssembly { journal: { expected: 1, observed: 2 } }`, no `model` property |
| T14.3 | stop after the configured bounded number of attempts rather than retrying without limit | `npx vitest run tests/persistence/snapshot-torn.test.ts -t "bounded number"` — the loop ran one attempt past the bound | same command — 1 passed; exactly 3 reads and `attempts: 3` |
| T14.4 | bind every returned read model to the exact revision set it was assembled from | `npx vitest run tests/persistence/snapshot-coherent.test.ts -t "exact revision set"` — the assembled result carried an empty binding | same command — 1 passed; the binding equals the persisted revision row |
| T14.5 | read the pre-commit rows for its whole lifetime when the snapshot begins before a concurrent commit | `npx vitest run tests/persistence/snapshot-nonmutating.test.ts -t "pre-commit rows"` — the snapshot returned both rows after the commit (a live read) | same command — 1 passed; the pre-commit snapshot returns only `trade-1` |
| T14.6 | leave every store byte-identical after the read | `npx vitest run tests/persistence/snapshot-nonmutating.test.ts` — the read path committed and the store fingerprint changed | same command — 1 passed; the store, Journal and revision rows are byte-identical |

`assembleRead` captures the revision binding, reads every named store through one snapshot, re-reads the
binding, and returns the model only when the two agree; otherwise it retries a caller-configured bounded
number of times and then returns `ChangedDuringAssembly`. It performs no write. The test's mid-assembly
commit is injected by a read source, which is exactly a writer committing between two module reads.

---

## T15 — `B` Lifecycle index membership and bounded cutoff queries

| # | Case phrase | Red command and observation | Green command and observation |
|---|---|---|---|
| T15.1 | write the lifecycle index membership inside the same transaction as the lifecycle-changing facts | `npx vitest run tests/persistence/lifecycle-index-atomic.test.ts -t "same transaction"` — the membership was written in a second transaction: `readwriteTransactions` was 2 | same command — 1 passed; one transaction writes both the entry (with `factRevision: 3`) and the fact |
| T15.2 | return only the currently Open Trades from the index rather than scanning the Trade store | `npx vitest run tests/persistence/lifecycle-bounded.test.ts -t "Open Trades from the index"` — under the store-scan defect the batch was empty: `expected [] to have a length of 200 but got +0` | same command — 1 passed; 200 Open rows, all `state: "Open"`, and the batch holds the same 200 |
| T15.3 | return the Trades that were Open at a past completed-session cutoff, including one that has since closed | `npx vitest run tests/persistence/lifecycle-cutoff.test.ts` — the closed trade was still returned for the later cutoff | same command — 1 passed; `2026-10-15` returns both, `2026-10-21` returns only the still-open Trade |
| T15.4 | rebuild membership from authoritative facts and prove recomputed membership equals the rebuilt index after the projection is deliberately deleted | No new red is claimed: the rebuild mechanism's red evidence is T9's V9.6 (projection emptied, contents reproduced). This case adds the `factRevision` membership evidence on top of that proven mechanism and was green on its first run, which is recorded rather than dressed as a red | `npx vitest run tests/persistence/lifecycle-rebuild.test.ts` — 1 passed; the second rebuild equals the first and every row carries a numeric `factRevision` |
| T15.5 | fail the whole transaction when a required index membership write fails, leaving the facts unwritten | `npx vitest run tests/persistence/lifecycle-index-atomic.test.ts -t "whole transaction"` — the failed fact write left the membership committed (`[ { tradeId: 'trade-2', … } ]`) | same command — 1 passed; both stores empty after the abort |
| T15.6 | stay bounded at 25,000 Trades … by counted storage requests, never elapsed time | `npx vitest run tests/persistence/lifecycle-bounded.test.ts -t "stay bounded"` — the Open selection scanned the store: `indexCursors: 0` instead of 1 | same command — 1 passed; one index cursor, 200 cursor steps, one bounded batch of 200 entries, no readwrite transaction |
| T15.7 | surface a structured disagreement, and never repair it, when stored membership contradicts effective facts | `npx vitest run tests/persistence/lifecycle-disagreement.test.ts` — the disagreement was silently reported as agreement | same command — 1 passed with `{ storedState: "Open", derivedState: "Closed" }` and a byte-identical store fingerprint |

`LifecycleEntry` carries the committed `factRevision` and the `openedOn`/`closedOn` membership interval, so
a past-cutoff question is answered from membership facts rather than current state. `commitLifecycleChange`
writes the entry and its facts in one commit. The disagreement check derives a D1-grade state from the
effective Executions, reports the structured disagreement, and writes nothing. The rebuildable
`lifecycleListProjection` carries the same membership evidence and is rebuilt from the authoritative
index; the projection mapping preserves the earlier row shape for entries that do not carry the new
fields.

---

## T16 — `S` Web App Manifest and Offline Release Inventory artifact

| # | Command | Observed | Result |
|---|---|---|---|
| V16.1 | `npm run build`, then a `node -e` check of `dist/manifest.webmanifest` | `id "/"`, name `Trade Journal`, `start_url "/"`, `scope "/"`, `display "standalone"`; declared icon sizes `192x192`, `512x512`, `any`; every icon `src` exists; parses as JSON | pass |
| V16.2 | the task's `node -e` digest-shape check | prints `b9cb61956118283d72d14da584224efd35e15f8ca6d01634586987e011c62b5c 7 0`; every one of the 7 entries carries a url and a 64-hex `sha256` | pass |
| V16.3 | the task's recomputation over `dist/<url>` | prints `0`; every recorded digest recomputes from the built bytes | pass |
| V16.4 | the task's startup-required-asset check | prints `0`; `index.html` and `manifest.webmanifest` are both listed, and `sw.js` plus `release-inventory.json` are the declared exclusions | pass |
| V16.5 | four builds, then a one-line CSS change, then revert | identical inputs print the same `release-id` and the same `inventory-list-digest`; the one-line change changes both (`c976ee7c…` / `72df06a7…` versus `b9cb6195…` / `bef9a29e…`); the revert restores the original | pass |
| V16.6 | `grep -c "release-inventory" dist/sw.js` | `1`; the worker entry names the inventory it must validate | pass |

**Artifacts.** `dist/release-inventory.json` is written by `scripts/release-inventory.mjs` from the built
bytes: `{ releaseId, listDigest, exclusions, entries: [{ url, sha256 }] }`. The release identity is the
digest of the sorted `(url, sha256)` list, so it is content-derived and stable across identical builds.
`sw.js` and `release-inventory.json` are excluded because they embed the identity; T18's versioned worker
caches the inventory artifact itself. The Web App Manifest is hand-authored in `public/` and its declared
192/512 PNG icons exist; T18 binds it to the release identity through the worker, and T28 declares the
Installed Capability Manifest separately.

---

## T18 — `S` Versioned service worker with intended-release control

| # | Command | Observed | Result |
|---|---|---|---|
| V18.1 | `grep -n "skipWaiting" dist/sw.js` | exactly one occurrence, inside the `ACTIVATE_UPDATE` message handler; none at module scope | pass |
| V18.2 | `grep -n "releaseId\|CACHE_NAME" dist/sw.js`, plus the printed cache name versus `dist/release-inventory.json` | `CACHE_NAME` is the literal `trade-journal-release-<releaseId>` and the identity from the inventory appears in it, so two releases cannot share a cache | pass |
| V18.3 | `npx playwright test tests/browser/sw-control.spec.ts --project=chromium --project=webkit` | after one load the page is controlled and the controller reports the inventory's release identity on both engines | pass |
| V18.4 | `npx playwright test tests/browser/sw-offline.spec.ts --project=chromium --project=webkit` | the page is closed, the context goes offline, a fresh page reopens the URL from the release cache, every inventory entry is present, and every recorded request is loopback | pass |
| V18.5 | `npx playwright test tests/browser/sw-update.spec.ts --project=chromium --project=webkit` | with release B deployed over release A, `registration.update()` leaves A in control, B in `waiting`, the page never reloads, and no reload marker changes | pass |
| V18.6 | `npx playwright test tests/browser/sw-staging-failure.spec.ts --project=chromium --project=webkit` | release C is deployed with one inventory asset deleted; its install fails, no waiting worker appears, A stays in control, and A's cached inventory remains complete | pass |
| V18.7 | `npx playwright test tests/browser/sw-two-releases.spec.ts --project=chromium --project=webkit` | activating the waiting worker at the explicit request leaves release A's cache present, release B in control, and B's inventory fully cached | pass |

**Worker shape.** `src/delivery/sw-template.js` is built into `dist/sw.js` by `scripts/build-sw.mjs` with the
release identity and the built inventory injected. The cache namespace is the release identity; install
precaches the inventory artifact plus every listed asset and fails staging if any asset is absent;
fetch serves this release's cache first and leaves older release caches untouched; control replies with
the release identity; `skipWaiting()` appears once, only in the `ACTIVATE_UPDATE` handler. The page
registers the worker on a production load.

**Additive port extension.** T18 needs the worker's control/lifecycle state, so the host port gained
`registerWorker`, `workerStatus`, `updateWorker` and `activateWaitingWorker`, and `workerControl` now also
reports the controlling release identity; the reply is read on the service-worker container, which is
where a worker's message arrives. That completes the service-worker-control capability T7 already
declared rather than changing the seam's shape, and T7's V7.5 operation list was updated to match.

**Defect found while proving V18.7.** Activation occasionally left the old worker in control because
`clients.claim()` ran only in `activate`, after the waiting worker took over. The worker now claims
immediately in the `ACTIVATE_UPDATE` handler; the two-release proof then passed repeatedly in isolation
and inside the full 12-file browser suite. The very first full-suite run also exposed stale generated
release directories from the pre-fix build, which is why `artifacts/sw-test/` is now ignored and the
specs read each release's inventory at run time rather than at module load.

---

## T17 — `B` Offline Release Inventory runtime validation

| # | Case phrase | Red command and observation | Green command and observation |
|---|---|---|---|
| T17.1 | report complete and digest-valid with the inventory identity and list digest when every listed asset is cached and every digest matches | `npx vitest run tests/release/inventory-valid.test.ts` — a complete inventory was forced to `Incomplete` | same command — 1 passed; `Complete` with the release identity, list digest and both entries verified |
| T17.2 | fail naming the exact missing asset identities when one listed asset has no cached bytes | `npx vitest run tests/release/inventory-missing.test.ts` — the missing entry was reported as an unnamed empty cache (`Unreadable`) | same command — 1 passed with `{ kind: "Missing", assetUrl: "/assets/app.js" }` |
| T17.3 | fail naming the corrupt entry when one cached asset's bytes hash differently from its recorded digest | `npx vitest run tests/release/inventory-corrupt.test.ts` — only presence was checked and the result was `Complete` | same command — 1 passed with `Corrupt`, the recorded digest and the differing observed digest |
| T17.4 | fail when the inventory artifact itself is unreadable or its own digest does not match the release identity | `npx vitest run tests/release/inventory-artifact.test.ts -t "unreadable"` — an unreadable artifact was treated as `Complete` | same command — 1 passed for the unreadable artifact and for a tampered `listDigest` |
| T17.5 | report every failed entry rather than the first one when several assets are missing or corrupt | `npx vitest run tests/release/inventory-multiple.test.ts` — the corrupt entry was not reported at all (`Missing, Missing` instead of `Corrupt, Missing, Missing`) | same command — 1 passed with all three entries named |
| T17.6 | fail when the running release identity differs from the inventory's release identity, even if every listed asset is present | `npx vitest run tests/release/inventory-release-mismatch.test.ts` — the expected release identity was ignored and the result was `Complete` | same command — 1 passed with `ReleaseMismatch` and both identities |
| T17.7 | expose the validated inventory identity and list digest as readiness evidence | `npx vitest run tests/release/inventory-evidence.test.ts` — `evidence` was `undefined` | same command — 1 passed with the inventory URL, release identity, list digest and entry count |
| T17.8 | complete with no non-loopback network request when the network is disabled, asserted from the recorded request log | `npx playwright test tests/browser/inventory-offline.spec.ts --project=chromium -g "deleted cached asset"` — with a fetch-based validation the deleted asset was reported as `Unreadable` offline instead of `Missing` | `npx playwright test tests/browser/inventory-offline.spec.ts --project=chromium --project=webkit` — 4 passed; after a full stop with the network disabled the inventory validates `Complete`, and after a cached asset is deleted the failure names it; every recorded request origin is the loopback origin |

**Validation shape.** The validator reads the inventory artifact and every listed asset through the
host-capability port's cache, so it never needs the network. It recomputes the canonical list digest and
the release identity from the inventory's own entries and compares them to the recorded values, reports
every failing entry (`Missing`, `Corrupt`, `Unreadable`, `ReleaseMismatch`), and returns the validated
identity and list digest as evidence for the readiness gate. The browser harness exposes it through
`window.__TRADE_JOURNAL_INVENTORY__`.

**Readiness half deferred.** The integration case also asserts "readiness becomes `Unsupported`" when an
asset is missing. The readiness gate is T20, so that assertion is recorded with T20's per-check matrix and
repeated by T33.

---

## T19 — `B` Capacity and headroom derivation

| # | Case phrase | Red command and observation | Green command and observation |
|---|---|---|---|
| T19.1 | derive the minimum from the declared workload terms and expose each term with its contribution | `npx vitest run tests/capacity/derive-minimum.test.ts` — a fixed constant with `terms: []` and no per-record contributions | same command — 1 passed; seven named terms whose bytes sum to the total |
| T19.2 | pass when the host reports free capacity at or above the derived minimum, returning observed and derived as evidence | `npx vitest run tests/capacity/sufficient.test.ts` — a sufficient host was refused as `Insufficient` | same command — 1 passed with the observed value, the derived minimum and both headroom terms |
| T19.3 | fail naming the derived minimum, the observed free capacity and the shortfall | `npx vitest run tests/capacity/shortfall.test.ts` — a bare boolean result with no minimum or shortfall | same command — 1 passed with `derivedMinimumBytes`, `observedFreeBytes` and `shortfallBytes: 1234` |
| T19.4 | treat a host that cannot report a capacity estimate as a failed check with Unavailable evidence | `npx vitest run tests/capacity/unavailable.test.ts` — an absent estimate was treated as unlimited (`Sufficient`) | same command — 1 passed with `Unavailable`, the host's reason and the derived minimum |
| T19.5 | include backup and migration headroom as separately named terms with disclosed multiples | `npx vitest run tests/capacity/derive-minimum.test.ts -t "headroom"` — both headroom terms were omitted | same command — 1 passed; migration is the largest section rewrite times 2 and backup is the representative artifact times 2 |
| T19.6 | scale the minimum with the declared workload, proving no baked-in byte constant | `npx vitest run tests/capacity/scaling.test.ts` — the total did not move when the Trade count doubled (`+0`) | same command — 1 passed; the increase is the per-Trade term plus the backup-headroom growth at the disclosed multiple |
| T19.7 | the same derived minimum for the same inputs across two runs and both hosts | `npx vitest run tests/capacity/determinism.test.ts` — a stateful counter made two identical derivations differ | same command — 1 passed; deep-equal derivations and integer bytes |
| T19.8 | record the derived minimum, the observed capacity and the headroom terms in readiness evidence | `npx vitest run tests/capacity/sufficient.test.ts` — the evidence carried no terms (`[]` instead of seven) | same command — 1 passed with the full term list and both headroom contributions |

The module is pure integer arithmetic; the readiness gate supplies the observed free bytes from the host
port, so T19 itself reads no host API. The workbook terms are `MATURE_WORKLOAD` (25,000 Trades, 200 Open,
200,000 position-changing facts, 125,000 Marks, 10,000 Journal versions, 500 reference records) with the
per-record byte terms and the two disclosed multiples exposed on every result.

**Integration half deferred.** Reading the true estimate through the host port and recording the verdict
in the Workspace initialization receipt needs the gate (T20) and `Workspace.initialize` (T25); those
assertions are recorded there and repeated by T33.

---

## T20 — `B` Runtime Readiness gate: four functional checks, browser-neutral

| # | Case phrase | Red command and observation | Green command and observation |
|---|---|---|---|
| T20.1 | Writable with all four check results recorded when the diagnostic, capacity, control and inventory checks pass | `npx vitest run tests/readiness/all-pass.test.ts` — the gate returned Writable without running the inventory check (three checks recorded) | same command — 1 passed; four passed checks in order, `Writable`, no failed check, no safe action, capacity evidence present |
| T20.2 | Unsupported listing every failed check when two or more fail | `npx vitest run tests/readiness/simultaneous.test.ts` — only the first failed check was reported | same command — 1 passed; all four checks ran and all four are named when they fail |
| T20.3 | Unsupported with a safe retry action when the diagnostic fails, leaving no authoritative fact | `npx vitest run tests/readiness/diagnostic-nonmutating.test.ts` — a probe row survived the diagnostic, so the `workspaceMeta` fingerprint changed | same command — 1 passed; the diagnostic commits, the probe is gone, the revision row is byte-identical, and a failed diagnostic yields `Unsupported` with `retry` |
| T20.4 | Unsupported naming the derived minimum and the observed capacity when capacity fails | `npx vitest run tests/readiness/failed-check-details.test.ts -t "derived minimum"` — the detail was the bare string `capacity is insufficient` | same command — 1 passed; the detail contains the derived minimum (793,088,000), the observed value and the 500-byte shortfall |
| T20.5 | Unsupported naming the intended release when the worker does not control the page | `npx vitest run tests/readiness/failed-check-details.test.ts -t "intended release"` — the detail named neither release | same command — 1 passed; it names `release-1` (intended) and `release-2` (controlling) |
| T20.6 | Unsupported naming the missing or corrupt assets when the inventory fails | `npx vitest run tests/readiness/failed-check-details.test.ts -t "missing or corrupt"` — only the first failure was named | same command — 1 passed; both `missing /assets/app.js` and `corrupt /index.html` are named |
| T20.7 | decide from functional results only, regardless of the user-agent | `npx vitest run tests/readiness/no-allowlist.test.ts` — a user-agent allowlist forced an all-passing run to `Unsupported` | same command — 1 passed; a claimed-supported UA with a failing check is `Unsupported`, an unrecognised UA with all checks passing is `Writable` |
| T20.8 | report protection alongside the outcome and stay Writable when protection is BestEffort or Unavailable | `npx vitest run tests/readiness/protection-advisory.test.ts` — advisory protection was treated as a failed check and the run became `Unsupported` | same command — 1 passed; both advisory states stay `Writable` with `notProtectedWarning: true` |
| T20.9 | two-engine real-engine readiness with versions recorded as provenance only | `npx playwright test tests/browser/readiness.spec.ts --project=chromium --project=webkit` | exit 0 on both engines; `Writable` with four passed checks, protection reported, no version field on the result, and engine versions written only to `artifacts/browser/readiness-<project>.json` |

The gate runs every check unconditionally, derives its outcome only from the four functional results,
maps the host port's typed results into capacity and inventory inputs, and never reads a browser identity.
Forced per-check failure payloads are asserted at the port-injection seam here; the same failures are
driven through the production UI by T29's forced-condition flows and repeated by T33.

---

## T21 — `B` Readiness re-establishment at every safety boundary

| # | Case phrase | Red command and observation | Green command and observation |
|---|---|---|---|
| T21.1 | run all four checks on every launch and produce a fresh evidence record with a new evaluation instant from the injected Clock | `npx vitest run tests/readiness/per-launch.test.ts` — the first verdict was cached: the diagnostic port ran once for two launches | same command — 1 passed; two launches, two diagnostic runs, two distinct instants, four checks each |
| T21.2 | re-establish readiness after application update activation and enable mutations only after the fresh evaluation passes | `npx vitest run tests/readiness/boundary-receipts.test.ts -t "update activation"` — the cached failing evaluation was reused, so the passing re-evaluation never happened | same command — 1 passed; a failing update evaluation rejects the write, a passing one commits |
| T21.3 | re-establish readiness after a Restore application before the next mutation, exposing the boundary hook D21 will consume | Covered by the same `evaluate` path as T21.2 and T21.4; `npx vitest run tests/readiness/boundary-receipts.test.ts -t "Restore"` | 1 passed; `boundary: "restore"` is returned and the next decision is `Writable` |
| T21.4 | invalidate Writable immediately when a release-integrity or storage failure is observed during a running session | `npx vitest run tests/readiness/invalidate.test.ts -t "invalidate the current Writable"` — the cached `Writable` receipt was returned instead of a fresh failing one | same command — 1 passed; the current receipt becomes `Unsupported` and names the inventory check |
| T21.5 | enter Recovery Only rather than Unsupported when the existing Workspace remains readable | `npx vitest run tests/readiness/invalidate.test.ts -t "Recovery Only"` — a readable Workspace was reported as `Unsupported` | same command — 1 passed; `RecoveryOnly` with the failed capacity check |
| T21.6 | never reuse a previous readiness decision to authorize a later mutation | `npx vitest run tests/readiness/invalidate.test.ts -t "never reuse"` — the first `Writable` decision was cached and the second mutation committed | same command — 1 passed; the second mutation is rejected with `runtimeReadiness: Unsupported` |
| T21.7 | record each boundary evaluation as a separate evidence record rather than overwriting one mutable flag | `npx vitest run tests/readiness/boundary-receipts.test.ts -t "separate evidence record"` — only one receipt survived (`[restore]`) | same command — 1 passed; three receipts with three distinct instants |

The ledger re-establishes the four checks and records a receipt per boundary (`launch`, `update-activation`,
`restore`) with the injected Clock's instant; `invalidate()` re-runs every check immediately;
`decision()` always produces a fresh decision for the persistence write gate and maps a readable root to
`RecoveryOnly`, an absent root to `Unsupported`, and an unreadable root to the Integrity Blocked branch.

**Integration half deferred.** The three-cold-start receipt sequence and the injected mid-session asset
deletion need `Workspace.initialize` (T25) and the production startup path; those assertions are recorded
with T25 and repeated by T33.

---

## T22 — `B` `Journal.seedDefaults` for the fixed identities

| # | Case phrase | Red command and observation | Green command and observation |
|---|---|---|---|
| T22.1 | create exactly the identities declared by the manifest and no others, with Plan Reflection's four prompts matching the contract | `npx vitest run tests/journal/seed-manifest.test.ts` — a hardcoded seven-type set was seeded regardless of the manifest | same command — 1 passed; one Entry Type and one Source, the four prompts in order with the contract's kinds, requiredness, roles and emotion options |
| T22.2 | create the Plan Confirmation Source bound to the Plan confirmation writing path | `npx vitest run tests/journal/seed-manifest.test.ts -t "Plan Confirmation Source"` — the Source was bound to an unknown path | same command — 1 passed with `writingPath: "plan-confirmation"` |
| T22.3 | typed SeedConflict and write nothing when a known stable key exists with an incompatible meaning | `npx vitest run tests/journal/seed-conflict.test.ts` — the incompatible key was overwritten and the seed reported `Seeded` | same command — 1 passed with `SeedConflict` and a byte-identical store |
| T22.4 | idempotent: the same manifest leaves the normalized manifest identical and adds no revision | `npx vitest run tests/journal/seed-idempotent.test.ts` — the second seed appended a definition revision | same command — 1 passed; `additions: []`, identical normalized manifest, every revision still 1 |
| T22.5 | match by stable product key, never by label | `npx vitest run tests/journal/seed-stable-key.test.ts` — a reworded prompt label appended a fifth duplicate prompt | same command — 1 passed; one Entry Type, four prompts, the original label retained |
| T22.6 | retain a trader-revised definition and return the retained revision | `npx vitest run tests/journal/seed-retain.test.ts` — the trader revision was reset to 1 and the manifest definition restored | same command — 1 passed; revision 2 and the trader's prompt label retained |
| T22.7 | seven fixed Entry Type keys and seven Source keys, creating only the missing ones | `npx vitest run tests/journal/seed-seven.test.ts` — a hardcoded set ignored which identities were missing | same command — 1 passed; only `review-note`, `trader-reflection`, `trade-detail` and `journal` are added, giving 7 + 7 |
| T22.8 | commit every identity, definition and Source in one transaction | `npx vitest run tests/journal/seed-atomic.test.ts` — one commit per identity left five identities committed after the injected failure | same command — 1 passed; the injected failure leaves the Journal store empty |

The seeder is manifest-driven and stable-keyed: v1 declares only the Plan Reflection Entry Type (with the
contract's four prompts) and the Plan Confirmation Source; a supplied full manifest adds the remaining
fixed identities without reshaping the mechanism. It matches by stable key, retains trader revisions,
returns `SeedConflict` for an incompatible key, and commits all additions in one transaction.

**Integration half deferred.** The `Workspace.initialize` seeding path, the close-and-reopen manifest
comparison and the receipt's seed version land with T25; the durable half is repeated by T33.

---

## T23 — `B` `ReferenceCatalog.seedDefaults` for manifest v1

| # | Case phrase | Red command and observation | Green command and observation |
|---|---|---|---|
| T23.1 | exactly the Long Stock Strategy under its stable key with one long Stock role and the contract's shape vocabulary, and no other Strategy | `npx vitest run tests/catalog/seed-manifest.test.ts` — an extra Strategy was seeded regardless of the manifest | same command — 1 passed; one Strategy, one `long`/`stock` role, quantity `"1"`, the declared constraint |
| T23.2 | no seeded Institution, Account, Close Reason, Abandonment Reason, generic Custom/Other Strategy, settlement-derived reason or Tag Type | `npx vitest run tests/catalog/seed-absences.test.ts` — a placeholder Institution and Account were created for convenience | same command — 1 passed; the only kind present is `strategy` and none of the forbidden labels exists |
| T23.3 | idempotent and stable-keyed; a reworded label never causes a duplicate identity | `npx vitest run tests/catalog/seed-idempotent.test.ts` — the second seed appended a catalog revision | same command — 1 passed; both repeat seeds add nothing, one Strategy, the revision unchanged |
| T23.4 | typed SeedConflict and write nothing when a known stable key exists with an incompatible shape | `npx vitest run tests/catalog/seed-shape-conflict.test.ts` — the incompatible Long Stock shape was silently replaced and the seed reported `Seeded` | same command — 1 passed with `SeedConflict` and a byte-identical store |
| T23.5 | retain a trader rename and not reactivate a retired seed | `npx vitest run tests/catalog/seed-rename.test.ts` — the second seed rewrote the trader label | same command — 1 passed; `My Long Stock`, revision 2 and `retired: true` all retained |
| T23.6 | return the Catalog snapshot, the exact additions and the selectable-Account summary without a follow-up query | `npx vitest run tests/catalog/seed-snapshot.test.ts` — the result carried no snapshot (`catalog` was undefined) | same command — 1 passed; the snapshot holds the seeded Strategy at revision 1 and an empty selectable-Account list |
| T23.7 | commit every identity, immutable shape and seed-manifest state in one transaction | `npx vitest run tests/catalog/seed-atomic.test.ts` — one commit per identity left two Strategies committed after the injected failure | same command — 1 passed; the injected failure leaves the Catalog store empty |

The manifest declares only Long Stock; the seeder matches by stable key, compares the immutable shape
canonically, retains trader labels and retired availability, returns the resulting snapshot and the
selectable-Account summary, and never seeds anything the manifest does not declare.

**Integration half deferred.** Seeding the Catalog inside `Workspace.initialize`'s one transaction and
reading the typed `CatalogQuery` afterwards land with T24 and T25.

---

## T24 — `B` `save`/`query` for Institution and Account

| # | Case phrase | Red command and observation | Green command and observation |
|---|---|---|---|
| T24.1 | create an Institution and return identity, complete record, history head and the new snapshot without a query | `npx vitest run tests/catalog/create.test.ts -t "generated stable identity"` — the result omitted the history head | same command — 1 passed; `institution:fidelity`, the full record, history head 1 and the snapshot at revision 2 |
| T24.2 | create an Account under a selectable Institution and bind its parent immutably | `npx vitest run tests/catalog/create.test.ts -t "bind its Institution parent"` — a rename replaced the Account's parent identity with a label | same command — 1 passed; the parent remains `institution:fidelity` after the Institution is renamed |
| T24.3 | reject Account creation naming the parent when the Institution is archived or unknown, with no write | `npx vitest run tests/catalog/account-parent.test.ts` — an Account was created under an archived Institution | same command — 1 passed; both rejections name the parent identity and the store is byte-identical |
| T24.4 | refuse to archive an Institution with selectable Accounts; refuse reactivation whose meaning changed | `npx vitest run tests/catalog/archive-reactivation.test.ts` — the Institution was archived while it still had a selectable Account | same command — 1 passed; both refusals are typed and write nothing, and a same-meaning reactivation succeeds |
| T24.5 | append a rename revision under the same identity and return historical and current labels | `npx vitest run tests/catalog/rename-history.test.ts` — the existing revision was edited in place | same command — 1 passed; revision 2 appended, both history entries retained, retained-reference resolution returns both labels |
| T24.6 | reject a new selection of an archived Institution or retired Account while a retained reference resolves | `npx vitest run tests/catalog/resolution-modes.test.ts` — one resolution mode served both cases | same command — 1 passed; `InactiveForRequestedUse` for new selection and `Resolved { active: false }` for retention |
| T24.7 | typed Conflict with the current snapshot and no write when the expected snapshot is stale | `npx vitest run tests/catalog/save-conflict.test.ts` — the expected snapshot was ignored and the stale save was accepted | same command — 1 passed with `Conflict` at snapshot revision 2 and a byte-identical store |
| T24.8 | list one family in deterministic label-and-identity order with snapshot pagination and Include-inactive, and complete history for one identity | `npx vitest run tests/catalog/query.test.ts` — ordering by identity alone returned `Zeta Prime, Gamma` where the label order is `Gamma, Zeta Prime` | same command — 1 passed; label-then-identity order, selectable/include-inactive views, a paginated page with a cursor and the two-revision history |

Saves append one administrative revision under the stable identity and return the complete post-commit
record, its history head and the new Catalog snapshot. Every command is bound to the expected snapshot;
a stale binding conflicts without writing. Resolution separates a new selection from a retained reference,
and an Account's Institution parent is immutable while the displayed label follows the Institution.

**Integration half deferred.** Creating the Institution and Account through the production form and
proving the durable after-state after a browser restart lands with T30, T31 and T33.

---

## T25 — `B` `Workspace.initialize`

| # | Case phrase | Red command and observation | Green command and observation |
|---|---|---|---|
| T25.1 | create Workspace metadata and atomically seed the declared Journal and Catalog defaults, returning Opened with a full receipt | `npx vitest run tests/workspace/initialize-fresh.test.ts` — Journal and Catalog were seeded in two transactions (`readwriteTransactions` 2) | same command — 1 passed; one transaction, one Journal type + one Source + Long Stock, a full receipt and the persisted Workspace row |
| T25.2 | create no Workspace, defaults or imported facts when the readiness gate fails, returning RuntimeNotWritable | `npx vitest run tests/workspace/initialize-refused.test.ts` — a workspace row was written before readiness finished | same command — 1 passed; `RuntimeNotWritable`, every store empty, zero readwrite transactions |
| T25.3 | Recovery Only with readable status and backup actions, versus Unsupported with retry actions | `npx vitest run tests/workspace/initialize-recovery.test.ts` — a readable Workspace was reported as `Unsupported` | same command — 1 passed; `RecoveryOnly` with `export-backup`, and `Unsupported` with `retry`/`try-another-browser` |
| T25.4 | Integrity Blocked and never fall through to fresh initialization when the root cannot be read | `npx vitest run tests/workspace/initialize-integrity.test.ts -t "cannot be read"` — an unreadable root was treated as a fresh install and Opened | same command — 1 passed with `IntegrityBlocked` and both recovery actions |
| T25.5 | Time Zone Selection Required when the first-run time zone is absent, never writing a guess | `npx vitest run tests/workspace/initialize-timezone.test.ts` — a guessed `UTC` time zone was written and the Workspace Opened | same command — 1 passed; the typed result and an empty store |
| T25.6 | Migration Blocked with unchanged-data evidence, prior Workspace untouched | `npx vitest run tests/workspace/initialize-migration-blocked.test.ts` — the failed candidate was treated as migrated and initialization Opened | same command — 1 passed with `MigrationBlocked`, `priorDataUnchanged: true` and an empty store |
| T25.7 | Integrity Blocked with recovery actions when readiness passed but stored contents fail validation | `npx vitest run tests/workspace/initialize-integrity.test.ts -t "stored contents"` — covered by the same IntegrityBlocked path as T25.4 | 1 passed; the validator's detail is carried and nothing is written |
| T25.8 | open the existing Workspace rather than reseeding when called a second time | `npx vitest run tests/workspace/initialize-existing.test.ts` — the second call reseeded and reported `fresh: true` | same command — 1 passed; `fresh: false`, no additions, identical Journal and Catalog rows |

Initialization re-establishes readiness, observes the root, refuses with the exact cross-cutting payload
when readiness is not `Writable`, seeds Journal and Catalog in **one** transaction with the Workspace
metadata (now including the resolved opening session date and revision), and re-opens an existing
Workspace without reseeding. The opening session is resolved through T5's calendar from the injected
instant, which closes T5's deferred integration assertion in the persisted receipt.

**Production wiring.** The coordinator takes its readiness, seam, migration and root observation as
ports; the composition root wires them for the browser in T29, and the durable after-restart assertion is
repeated by T33.

---

## T26 — `B` `Workspace.getStatus`

| # | Case phrase | Red command and observation | Green command and observation |
|---|---|---|---|
| T26.1 | Ready with the full-content binding, time zone and revision, capability manifest, onboarding, readiness evidence, protection, schema versions and latest receipt | `npx vitest run tests/workspace/status-ready.test.ts -t "full-content Workspace binding"` — the binding was omitted from the Ready status | same command — 1 passed; the five-part binding, time zone, manifest, onboarding, readiness, protection, schema version and receipt are all present |
| T26.2 | Initialization Required only when a writable store was opened successfully and proved that no Workspace exists | Covered by the same read-result branch as T26.6; `npx vitest run tests/workspace/status-initialization.test.ts` | 1 passed; `InitializationRequired` with no binding and no time zone |
| T26.3 | Recovery Only with readable status and backup actions when the Workspace is readable and readiness fails | `npx vitest run tests/workspace/status-recovery.test.ts -t "Recovery Only"` — `Unsupported` was returned whenever readiness failed, ignoring the readable Workspace | same command — 1 passed with `RecoveryOnly`, the readable binding/time zone and `export-backup` |
| T26.4 | Unsupported with the failed-check reasons when no existing root needs protection | `npx vitest run tests/workspace/status-recovery.test.ts -t "no existing root"` — covered by the same mapping red as T26.3 | 1 passed; `Unsupported` with `retry` and `try-another-browser` |
| T26.5 | Integrity Blocked with the readiness evidence and safe actions when the root cannot be read | `npx vitest run tests/workspace/status-integrity.test.ts -t "known or possible existing root"` — covered by the unreadable-read mapping red as T26.6 | 1 passed; `IntegrityBlocked` with the Writable readiness evidence and both recovery actions |
| T26.6 | never treat a failed or ambiguous store read as an empty store | `npx vitest run tests/workspace/status-integrity.test.ts -t "ambiguous store read"` — a thrown read was reported as `InitializationRequired` | same command — 1 passed; `IntegrityBlocked`, never `InitializationRequired` |
| T26.7 | mutate and repair nothing, proven by identical store digests | No separate product red is claimed: the status coordinator holds no write port and has no write path, so it structurally cannot repair. The case is verified by fingerprinting the real stores before and after a call that reports a disagreement | `npx vitest run tests/workspace/status-nonmutating.test.ts` — 1 passed; byte-identical `workspaceMeta` and `lifecycleIndex` |
| T26.8 | accept the observation instant from the injected Clock and return identical status for identical inputs | `npx vitest run tests/workspace/status-ready.test.ts -t "identical status"` — a stateful sequence field made two identical calls differ | same command — 1 passed; deep-equal statuses at the injected instant |

Status maps the readiness outcome and the root/workspace read result to one of the five outcomes, carries
the immutable capability manifest, and never reads or writes beyond the ports it is given.

**Integration half deferred.** The fresh/seeded/deleted-asset origins with three resulting statuses and
unchanged digests land with T29's production wiring and T33.

---

## T27 — `B` `Workspace.requestDurability`

| # | Case phrase | Red command and observation | Green command and observation |
|---|---|---|---|
| T27.1 | Improved with currentProtection Protected when the host grants | `npx vitest run tests/workspace/durability-improved.test.ts -t "Improved"` — a grant was reported as `NotImproved` | 1 passed; `Improved` after the host's grant is confirmed |
| T27.2 | AlreadyProtected with Protected when protection was already granted | `npx vitest run tests/workspace/durability-improved.test.ts -t "AlreadyProtected"` — the already-protected host was asked again | 1 passed; `AlreadyProtected` and the host request was never made |
| T27.3 | NotImproved with BestEffort and the host's reason when the host denies | `npx vitest run tests/workspace/durability-denied.test.ts` — `Improved` was returned for a denied request | 1 passed with `NotImproved` and the host's BestEffort reason |
| T27.4 | NotImproved with Unavailable when the host does not expose the request | `npx vitest run tests/workspace/durability-absent.test.ts -t "does not expose the request"` — the absent capability threw | 1 passed with a typed `NotImproved` and the Unavailable reason |
| T27.5 | leave Runtime Readiness unchanged after NotImproved while all four checks pass | `npx vitest run tests/workspace/durability-advisory.test.ts -t "Runtime Readiness unchanged"` — the denial flipped the returned readiness to `Unsupported` | 1 passed; `Writable` with `notProtectedWarning: true` before and after |
| T27.6 | delete, export and mutate nothing, proven by identical authoritative revisions | No separate product red is claimed: the operation holds no write or export port. It is verified by fingerprinting `workspaceMeta`, `referenceCatalog` and `journal` around the call | 1 passed; byte-identical stores |
| T27.7 | record the protection state in the readiness evidence at each launch regardless of the outcome | Covered by T20's protection evidence and the advisory case; `npx vitest run tests/workspace/durability-advisory.test.ts -t "record the protection state"` | 1 passed; the readiness evidence carries the BestEffort protection and the warning |
| T27.8 | return a typed NotImproved rather than throwing when the host rejects with a security or permission error | `npx vitest run tests/workspace/durability-absent.test.ts -t "security or permission"` — the `SecurityError` propagated | 1 passed with a typed `NotImproved` and a non-Protected state |

The operation reports exactly `Improved`, `AlreadyProtected` or `NotImproved` with the current protection,
never fabricates success, catches a host rejection, and carries the unchanged readiness in each
`NotImproved` result.

**Integration half deferred.** The single production durability control, the visible warning and the
real-engine assertion land with T29's presentation and are repeated by T33.

---

## T28 — `B` Installed Capability Manifest

| # | Case phrase | Red command and observation | Green command and observation |
|---|---|---|---|
| T28.1 | exactly the D1-installed operations with complete dependency closure, omitting every later capability | `npx vitest run tests/capability/manifest-omission.test.ts` — later capabilities (`trade.confirmPlan`, `reports.run`) were declared with an Unavailable marker | same command — 1 passed; only the eight installed operations, and none of the eight later ids appears anywhere in the manifest |
| T28.2 | declare that install support is not claimed | `npx vitest run tests/capability/manifest-profile.test.ts -t "install support"` — the manifest claimed install support | same command — 1 passed with `installSupport: "not-claimed"` |
| T28.3 | declare the installed backup/schema ranges and provider adapters actually installed | `npx vitest run tests/capability/manifest-profile.test.ts -t "backup/schema"` — covered by the same profile red | 1 passed; backup `not-installed`, schema 1–1, no provider adapters, no report families, fee application `not-installed` |
| T28.4 | immutable and not trader data, with no toggle and no backup section | `npx vitest run tests/capability/manifest-immutable.test.ts` — the manifest was mutable | same command — 1 passed; the manifest and its operations are frozen, mutation throws, and the module exports no toggle/setter |
| T28.5 | bound to the installed release identity so a stale manifest cannot be read after an update | `npx vitest run tests/capability/manifest-release.test.ts` — a stale manifest was accepted | same command — 1 passed; release A is rejected against release B and accepted against itself |
| T28.6 | return absent rather than a domain-level Unavailable for an omitted operation | `npx vitest run tests/capability/manifest-omission.test.ts -t "domain-level Unavailable"` — an omitted operation was present | same command — 1 passed; absent lookups return `undefined` and the declared one resolves |
| T28.7 | the reachable production navigation equal to the declared set | `npx vitest run tests/capability/manifest-reachability.test.ts -t "reachable production navigation"` — the manifest declared a navigation destination that is not reachable | same command — 1 passed; an undeclared reachable destination is reported as `navigation.reports` and the declared set is clean |
| T28.8 | fail the runtime self-check, naming the capability, when a declared operation's entry point is missing | `npx vitest run tests/capability/manifest-reachability.test.ts -t "runtime self-check"` — the entry-point check was skipped | same command — 1 passed with `workspace.initialize` named and the missing `app.startup.initialize` entry point |

The manifest declares the eight D1-installed operations with their dependencies and production entry
points, the schema range, no report families, no provider adapters, no backup, and no install claim. It is
deep-frozen, release-bound, and its self-check reports closure, entry-point and navigation problems by
capability.

**Integration half deferred.** Reading the manifest from the running release and comparing it with the
built artifact and the production navigation lands with T29's presentation wiring and T33.
