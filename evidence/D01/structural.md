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
