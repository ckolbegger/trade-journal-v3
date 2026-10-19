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
