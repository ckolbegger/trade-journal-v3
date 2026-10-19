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
