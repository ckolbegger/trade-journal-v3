# D1 structural verifications

Each entry records a structural task's exact verification, as D1's breakdown, section 5, specifies.

## T1.1 Toolchain and repository scaffold

Run 2026-10-18 on the machine and versions in [provenance.md](provenance.md).

**Verification (breakdown, section 5):**

```bash
npm ci && npm run typecheck && npx tsc6 --noEmit && npm run lint && npm run test:unit && npm run build && npm run preview -- --strictPort
npx tsc --version
npx tsc6 --version
```

| Step | Result |
|---|---|
| `npm ci` | exit 0, from the committed `package-lock.json`, without `--legacy-peer-deps`; no peer-dependency errors |
| `npm run typecheck` (`tsc`) | exit 0 |
| `npx tsc6 --noEmit` | exit 0 |
| `npm run lint` (`eslint .`, typed linting) | exit 0 |
| `npm run test:unit` (`vitest run`) | exit 0; "No test files found" (`passWithNoTests` until T1.5 adds the first tests) |
| `npm run build` (`vite build`) | exit 0; `dist/index.html` and one JS asset |
| `npm run preview -- --strictPort` | listens on `http://localhost:5175/`; `GET /` returned 200 |
| `npx tsc --version` | `Version 7.0.2` |
| `npx tsc6 --version` | `Version 6.0.3` |

**Supporting checks**

- **The checkers are not vacuous.** A temporary `src/zz-probe.ts` containing `const x: number = 'a'` made `npx tsc` exit 1 and `npx tsc6 --noEmit` exit 2. The file was deleted afterwards.
- **Strict port.** With one preview running on 5175, a second `vite preview --strictPort` exited 1 with `Error: Port 5175 is already in use` rather than choosing another port. `vite.config.ts` also sets `strictPort: true` for both `server` and `preview`, and fails if `DEV_PORT` is missing from `.env.local`.
- **TypeScript resolution (decision 44).** `node_modules/.bin/tsc` links to `@typescript/native/bin/tsc` (7.0.2); `node_modules/.bin/tsc6` links to the wrapper's `bin/tsc6`; `require("typescript").version` is `6.0.3`, so typed linting runs on 6.0.3. `npm ls` shows every `typescript-eslint` package deduped onto `typescript@npm:@typescript/typescript6@6.0.2`, whose `@typescript/old` dependency the `overrides` entry pins to `typescript@6.0.3`.
- **`tsconfig.json`** sets 6.0/7.0's changed defaults explicitly (`target`, `module`, `moduleResolution`, `types`, `rootDir`, `strict`, `esModuleInterop`, `noUncheckedSideEffectImports`, `libReplacement`) and uses none of the options 7.0 removed (no `baseUrl`, no `moduleResolution: node10`, no `target: es5`, no `outFile`, no `downlevelIteration`).
- **Node enforcement.** `package.json` declares `"engines": { "node": ">=26.12.0 <27" }` and `.npmrc` sets `engine-strict=true` (`npm config get engine-strict` prints `true`). The refusal of another Node major was **not exercised**: npm 11.20.0 no longer accepts the `--node-version` setting that could simulate one, and the handoff forbids installing another Node.

**Editor TypeScript server (open detail from the handoff).** The wrapper package ships `lib/typescript.js`, `lib/tsserverlibrary.js`, and `lib/tsc.js`, but **no `lib/tsserver.js`**, so an editor that looks for `node_modules/typescript/lib/tsserver.js` will not find a workspace server. `node_modules/@typescript/old/lib/tsserver.js` (6.0.3) exists; pointing the editor there (for VS Code, `"typescript.tsdk": "node_modules/@typescript/old/lib"`) fixes it. This affects editor feedback only, not the build or tests. `.vscode/` is gitignored, so no editor setting is committed.

**Notes**

- npm 11.20.0 withheld three install scripts not covered by `allowScripts`: `esbuild@0.28.1`, `fsevents@2.3.3`, and `workerd@1.20261001.1`. None is needed by any T1.1 step (the build, preview, lint, and type checks all pass without them). `workerd` belongs to `wrangler`, which is not used until a Cloudflare publish.
- `npm audit` reports 3 high-severity findings, all in `sharp` (CVE-2026-96889, via `miniflare`) pulled in by the pinned `wrangler@4.147.0`, a deploy-only development tool. The suggested fix is `wrangler@4.151.1`, which would change a pin and so needs a plan revision. Raised with the user; not changed here.

## T1.2 Engine capability smoke (Chromium; Firefox and WebKit in RC)

Run 2026-10-18; versions in [provenance.md](provenance.md).

**Verification:** `npx playwright test e2e/smoke/engine-capabilities.spec.ts --project=chromium`, which exited 0 (`1 passed`, 3.7 s).

The spec serves a probe page and a caching service worker from an in-process server on `http://localhost:5175` (strict: it fails if the port is busy), drives a persistent Chromium profile, and writes its results to [engine-capabilities-chromium.json](engine-capabilities-chromium.json).

| Capability | Result | How it was checked |
|---|---|---|
| `isSecureContext` | true | `window.isSecureContext` on the loopback origin |
| Service-worker registration and control | true | active registration at `/` and a non-null `navigator.serviceWorker.controller` |
| `CacheStorage` | true | put, match, and delete a cache entry |
| IndexedDB | true | `durability: "strict"` write read back |
| `storage.estimate` | true | quota 10,737,419,884 bytes and usage reported |
| `storage.persisted` | true | resolves to a boolean (`false`: Best Effort in this profile) |
| `BroadcastChannel` | true | a message delivered between two channels |
| `crypto.subtle` | true | SHA-256 of `abc` equals the standard digest |
| Persistent-context stop and restart | true | data and service-worker control intact after closing and relaunching the profile |
| Offline relaunch | true | server stopped and the context launched offline; the page loaded from the worker's cache with its data |
| SIGKILL of the browser process | true | a committed strict write survived `SIGKILL` of the browser process (1 process matched the profile) and a relaunch |

**Gate:** no capability is false, so work continues to T1.8 without a stop.

## T1.3 Release build: Web App Manifest, Offline Release Inventory, release identity

Run 2026-10-18. **Verification:** `npm run build && npm run verify:release`, which printed `OK …/dist: release d70e3d6d…530d, 5 assets` and exited 0.

- `dist/manifest.webmanifest` has `id` `/`, `name`, `short_name`, 192×192 and 512×512 PNG icons (both built), `start_url` `/`, `scope` `/`, and `display: "browser"` (decision 9).
- `dist/inventory.json` lists every file in `dist/` except `sw.js` and `inventory.json` itself (it cannot hold its own digest): the app bundle, both icons, `index.html`, and the manifest. `verify:release` recomputes every digest and size and checks that nothing is missing or extra.
- The release identity equals the SHA-256 of the sorted `path digest` list, and the same value is embedded in `sw.js` and in the app's entry bundle; no unreplaced token remains anywhere in `dist/`.
- **Negative check:** appending one byte to `dist/icons/icon-192.png` made `verify:release` fail with `digest mismatch` and `size mismatch` for that file. A clean rebuild passed again.
- `npm run typecheck`, `npx tsc6 --noEmit`, and `npm run lint` exit 0.

**Disclosed detail: the self-reference.** The breakdown asks for an identity that is the hash of every asset's digest and is also embedded in the app bundle, which is itself an asset. A literal reading is circular, so an asset's digest is taken with every occurrence of the release identity masked by 64 `0` characters (`assetDigest` in `src/delivery/inventory.ts`). The build places the placeholder `@@TJ_RELEASE_ID@@` where the identity goes, digests each file with that placeholder masked the same way, derives the identity from the sorted digest list, and then substitutes it. `verify:release`, the service worker (T1.8), and the readiness inventory check (T1.9) all use `assetDigest`. Any other byte change still changes the digest. No specification passage, acceptance scenario, or durable data is affected.

**Correction made during T1.8 (2026-10-18).** The first version masked with the placeholder string itself, built at run time from character codes. Inspecting the built `sw.js` showed that the minifier folded that expression into the literal placeholder, which the build then rewrote into the release identity, so the built worker's digest would have masked nothing and rejected every asset that embeds the identity. Node's `verify:release` could not see this. The mask is now 64 zeros, which the build never rewrites, and `verify:release` gained a guard: the identity must appear exactly once in `sw.js`. On a copy of `dist/` with the old defect reintroduced, the guard failed with `sw.js embeds the release identity 2 times, not once`; the real build passes.

## T1.4 Dependency-direction, purity, and no-identity rules

Run 2026-10-18. **Verification:** `npm run lint:deps`, then `npm run lint:deps -- tools/dep-fixtures/<fixture>` for each committed violation fixture.

| Target | Exit | Output |
|---|---|---|
| project (`src/`) | 0 | `no dependency violations found`; `lint:deps OK (src)` |
| `ui-imports-module` | 1 | `error ui-only-through-facade: …/src/ui/view.ts → …/src/modules/journal/journal.ts` |
| `domain-uses-date-now` | 1 | `…/src/domain/time/now.ts:2:34 domain-purity: read time from an injected clock, never Date.now.` |
| `reads-user-agent` | 1 | `…/src/delivery/sniff.ts:2:40 no-identity: support is decided by functional checks, never browser or OS identity.` |

- `.dependency-cruiser.js` mirrors the overview's "who may call whom" table: the UI reaches only the facade; fact modules never call coordinators; Reference Catalog and Trade Record call no other fact module; Market Data knows no Trades; `src/domain/` imports nothing outside itself; persistence and the service worker stay internal; plus `no-circular` and `not-to-unresolvable`.
- `eslint.deps.config.js` holds `domain-purity` (no `Date.now`, argument-less `new Date()`, `Math.random`, `Temporal.Now`, `randomUUID`, `indexedDB`, `localStorage`, `sessionStorage`, `caches`, `fetch`, or `navigator` in `src/domain/`) and `no-identity` (no `userAgent`, `userAgentData`, `platform`, or `vendor` member access anywhere in `src/`). The main `npm run lint` applies the same rules.

## T1.18 Composition root and capability registry

Run 2026-10-18. **Verification:** `npm run verify:capabilities`, which printed `verify:capabilities OK: 11 operations, 6 routes, release 8539…9b29` and exited 0.

- `src/app/compose.ts` exports `createApplication({ indexedDB, host, clock, ids, releaseId, capacityRequirement })`, the single facade used by the UI and the Node integration suite. Its operation groups are named exactly as in the Installed Capability Manifest (`Workspace`, `ReferenceCatalog`, `Journal`, `TradeWorkflows`, `TradeViewsAndReporting`), and every authoritative mutation runs through the readiness guard (`ReferenceCatalog.save` is wrapped here; `TradeWorkflows.confirmPlan` and `Workspace.initialize` recheck readiness themselves; `Workspace.requestDurability` is exempt).
- `src/app/routes.ts` lists every destination with the capabilities it requires.
- `verify:capabilities` builds the real application on fake-indexeddb and NodeTestHost and checks that the manifest's operations equal the facade's, that no route requires an absent capability, and that every installed operation is reachable from a route.
- **Negative check:** adding `DailyReview.open` to the Trades route made it fail with `FAIL route trades requires absent capability DailyReview.open` (exit 1); restoring the route passed again.
- `tsconfig.json` gained `erasableSyntaxOnly`, because Node runs the tools by stripping types and rejects constructor parameter properties (found when the verifier first ran).

## T1.26 Release harness

`npm run build:releases && npm run verify:releases` (2026-10-19):

```
build:releases OK: v1, v2, v2-corrupt in dist-releases; v2-corrupt alters /assets/index-daqKebuB.css
verify:releases OK: v1 4ce03a7d2df623d499c0a5dabba23a5078e3225d162bda1b7ac5438ac724c981, v2 7beba257e8b19b4f28e104d2ff2b815fb264a061e3467630fe32c282a96a9e29, v2-corrupt fails only on /assets/index-daqKebuB.css
```

v2 differs from v1 only by `<meta name="tj-build-label" content="v2">` in `index.html`; production `dist/index.html` has no label. The harness server (`tools/release-server.ts`, port 5175) answered: `/` and SPA paths `text/html`, `public, max-age=0, must-revalidate`; `/sw.js` and `/inventory.json` `no-cache`; `/assets/*` `public, max-age=31536000, immutable`; and serves ETags with 304 revalidation. In Chromium, the v1 worker controlled the page after first load.

## T1.27 Fault-injection build

`npm run build:faults && npm run verify:no-fault-hooks` (2026-10-19): `verify:no-fault-hooks OK: dist has no fault hooks`. Negative control: the same check over `dist-faults` fails on `assets/faults-*.js` (marker `tj-fault-hooks-v1` and `__tjFaults`), so the detector finds hooks where they exist. `dist-faults` passes `verify:release`.

Faults act only in `src/delivery/faults.ts`, which wraps the real host port and is imported only when `import.meta.env.MODE === 'faults'`: `diagnostic` (every root open fails), `capacity` (quota equals usage), `control` (no controller), `inventory` (no release cache). Chromium smoke via `npm run preview:faults`: `?faults=diagnostic,capacity` showed Unsupported naming both checks; `?faults=control` and `?faults=inventory` each named their check; with no faults the app reached first run and `window.__tjFaults.set` was a function.

## T1.19 Capacity basis

`npm run measure:capacity` then `npm run verify:capacity` (2026-10-19, Chromium 153.0.8010.12):

```
chromium 153.0.8010.12: {"plans":500,"usageBefore":147456,"usageAfter":1613824,"bytesPerTradeWithReflection":2932.736,"jsonBytesPerTradeWithReflection":2344.634,"overheadRatio":1.2508289140224018,"jsonBytesPerCatalogRecord":237.33333333333334}
measure:capacity OK: M 548701233 bytes, required quota 1646103699 bytes
verify:capacity OK: required quota 1646103699 = 3 × 548701233, schema 1
```

The 500 deterministic Plans run through `createApplication` on the engine's real IndexedDB (`tools/capacity/measure-page.ts`, served by Vite); readiness inputs come from NodeTestHost because no service worker controls that page. M = 25,000 measured Trades with Plan Reflections + 60 Catalog records + the section 1.3 allowances (estimated JSON bytes per planned shape, `tools/capacity/profile.ts`) × the measured overhead ratio. M (0.55 GB) is below the plan's expected 0.6–0.8 GB because Chromium's measured overhead is 1.25 on-disk bytes per JSON byte; the allowances are disclosed estimates until their deliverables measure them. Guard check: setting the basis `schemaVersion` to 2 made `verify:capacity` fail ("basis measured at schema version 2, current is 1"). The production bundle embeds 1646103699.

## T1.28 Node integration suite

`npm run test:integration` (2026-10-19): `Test Files 6 passed (6)`, `Tests 19 passed (19)`, covering I1.1–I1.11 (I1.7 runs six fault sets). Each case builds `createApplication` on fake-indexeddb and NodeTestHost and calls facade operations only; restart closes the Workspace connection (`Persistence.close`) and builds a new application on the same factory. I1.11 uses `rebuildPrivateState`, which drops every index and recreates it through the migration's `createWorkspaceIndexes` in one version-change transaction. `npm run test:unit` is now `vitest run src`; `npx vitest run` runs both.

## T1.29 Browser suite (Chromium)

`npm run test:e2e` (2026-10-19): builds the faults build and the harness releases, then `playwright test e2e/d1`: `25 passed (35.3s)`. Routine cases serve `dist-faults` through the release harness server on localhost:5175 (Cloudflare-like headers); update cases serve `dist-releases/v1`, `v2`, and `v2-corrupt`. Durable state is proven with the read-only probe (`e2e/d1/support.ts`), which opens only existing databases.

- B1.1 identity (with and without an unknown user agent), B1.2 relaunch, B1.3 SIGKILL after the confirmation renders, B1.4 offline cold restart (server stopped and offline emulation), B1.5 six fault sets, B1.6 Recovery Only for all six sets with the probe unchanged, B1.7 (this run: `persisted()` false; the browser declined `persist()` and the page said so), B1.8 version-99 root created before launch and a deleted Workspace database, B1.9 inventory and diagnostic, B1.10–B1.13 update deferral, corrupt update, offline update check (server stopped), two tabs, B1.14 no draft or Web Storage trace, B1.15 960 px switch, axe (WCAG 2.1 A and AA tags) on first run, onboarding with errors, Trades empty and listed, Plan form with and without rejection, Trade Detail, Accounts, About (wide and narrow), Recovery Only, Unsupported, Integrity Blocked, and a keyboard-only onboarding and Plan with a focus ring checked at every Tab.
- Defects found and fixed test-first (TDD log): the Plan form did not report `RuntimeNotWritable` to the shell (B1.9; `PlanForm` unit case added), and Plan time had no visible focus indicator (B1.15).
- Offline emulation alone does not cover service-worker fetches in Chromium, so the offline cases also stop the origin's server.

## T1.31 Schema-v1 fixture

`npm run fixtures:freeze -- --schema 1`, then `npm run verify:fixtures` (2026-10-19):

```
fixtures:freeze OK: tests/fixtures/workspace-v1 (schema 1, 5 Plans, 3 Accounts)
verify:fixtures OK: workspace-v1 open Ready at schema 1 with views equal to their snapshots
```

Built in Node through the facade only (initialize; Fidelity and Charles Schwab; three Accounts; five confirmed Plans) with the fixed clock 2026-10-16T21:00:00Z and seeded identities `fx-NNNN`. `dump.json` records schema version 1, generator version 1, the as-of instant, and every database in `tj-root` and the Workspace with its version, object stores (key path, auto-increment), indexes (key path, unique, multi-entry), and records, so a later release rebuilds this exact structure without its own schema code. `expected-views.json` holds the normalized Planned list (5 items) and the 5 Details. Checks: a second freeze is refused ("committed fixtures are never regenerated"); altering the snapshot, or one stored Thesis in the dump, each made `verify:fixtures` fail.

## Cumulative suite run at the D1 gate

Recorded 2026-10-19 04:53 EDT at commit `0b90f10` (tag `claude-opus-5.5-d1`), clean tree; Node v26.12.0, Chromium 153.0.8010.12, macOS 26.6.2. Complete outputs are in `evidence/D01/suite-runs/`.

| Suite | Command | Result | Full output |
|---|---|---|---|
| Unit | `npx vitest run src --reporter=verbose` | `Test Files 24 passed (24)`, `Tests 205 passed (205)`, exit 0 | `suite-runs/d1-gate-unit.txt` |
| Node integration (I1.1–I1.11) | `npx vitest run tests/integration --reporter=verbose` | `Test Files 6 passed (6)`, `Tests 19 passed (19)`, exit 0 | `suite-runs/d1-gate-integration.txt` |
| Browser (B1.1–B1.15, Chromium) | `npm run test:e2e` | `26 passed (40.1s)`, exit 0 | `suite-runs/d1-gate-browser.txt` |
| Static and verification checks | typecheck, `tsc6`, lint, `lint:deps`, build, `verify:release`, `verify:capabilities`, `verify:capacity`, `verify:no-fault-hooks`, `verify:fixtures`, `verify:releases` | every command exit 0 | `suite-runs/d1-gate-checks.txt` |

Complete-suite runs were made throughout D1 but, until this record, were not written to the evidence: `tdd-log.md` holds only the single-case red and green runs. From now on each task ends by recording a complete cumulative run here.

## Cumulative suite run after the critic-2 onboarding fixes

Recorded 2026-10-19 on the working tree for the commit that follows `4dc81e3`. The fixes are two of critic-2's minor observations: the protection warning is now shown on first run and onboarding, and onboarding reuses an Institution saved without its Account. Both were reproduced red first (TDD log, "critic-2 fixes"). Full outputs are in `evidence/D01/suite-runs/critic-2-fixes-*.txt`.

| Suite | Result |
|---|---|
| Unit (`npx vitest run src --reporter=verbose`) | `Test Files 24 passed (24)`, `Tests 207 passed (207)`, exit 0 |
| Node integration (`npx vitest run tests/integration --reporter=verbose`) | `Test Files 6 passed (6)`, `Tests 19 passed (19)`, exit 0 |
| Browser (`npm run test:e2e`, Chromium) | `27 passed (41.9s)`, exit 0 (adds `e2e/d1/onboarding.spec.ts`) |
| Static and verification checks (11 commands) | 11 of 11 exit 0 |

The first full run of this change failed `lint:deps`: the new AppShell case imported a coordinator, which UI code may not do. The case was rewritten, re-proved red and green, and the whole run repeated; the table shows the repeat.

## D1 tag moved after the critic-2 fixes

On 2026-10-19 the user approved moving the local tag `claude-opus-5.5-d1` from the gate commit `0b90f10` (passed by critic-2) to the commit that records this note, which includes the critic-2 onboarding fixes (`5a61a8b`), **without a fresh critic run**. The fixes are covered by the complete cumulative run recorded above, not by a browser critic.
