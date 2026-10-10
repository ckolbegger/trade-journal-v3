# VD1 — Project scaffolding (layer-only checkpoint)

**Status:** Not started
**Depends on:** — (first deliverable)
**Frozen scope:** `implementation-plan.md` §4 VD1 (layer-only exception record in §5)

This is a living working document: progress, red/green evidence, and critic results are recorded here. Scope changes require plan-deviation approval per `KICKOFF.md`.

## Progress

| Task | Description | Status | Evidence |
|---|---|---|---|
| T1.1 | Toolchain scaffold | ☑ done 2026-10-10 | Verifications below |
| T1.2 | Static app shell | ☑ done 2026-10-10 | Verifications below |
| Gate | Cumulative suites + browser critic | ☐ pending | — |

---

## T1.1 Toolchain scaffold *(structural)*
Verification (all must pass before T1.2):
- `npm run build` produces a production bundle; `npm run dev` serves it at `http://127.0.0.1:5176` (DEV_PORT from `.env.local`, `strictPort` fails on a taken port — verified by starting a second instance and observing the error).
- `npm run lint` fails on a fixture file where `src/domain/**` imports `src/modules/**`, where `src/modules/referenceCatalog` imports a coordinator, and where `src/ui/**` imports `src/modules/tradeRecord`; passes with the fixture removed.
- `npm run test` (Vitest, fake-indexeddb wired) and `npm run test:e2e` (Playwright, three engines) run and report zero tests without errors.

Deliverable behavior depending on it: everything.

### T1.1 verification record (2026-10-10, node v26.0.0 / npm 11.12.1, macOS darwin 25.6.0 arm64)

| # | Command | Outcome |
|---|---|---|
| 1 | `npm run build` | ✅ `tsc -b && vite build` — 28 modules transformed, `dist/index.html` + hashed JS asset emitted |
| 2 | `npm run dev` (background) + `curl http://127.0.0.1:5176/` | ✅ HTTP 200 (required `server.host: '127.0.0.1'` — default `localhost` bound IPv6 `::1` only, refusing the plan's IPv4 loopback origin) |
| 3 | second `npm run dev` while first serves | ✅ fails: `Error: Port 5176 is already in use`; first instance keeps serving HTTP 200 |
| 4 | `npm run lint` with three fixture files (`src/domain/fixtureBoundary.ts` importing `../modules/persistence`; `src/modules/referenceCatalog/fixtureBoundary.ts` importing `../tradeWorkflows`; `src/ui/fixtureBoundary.tsx` importing `../modules/tradeRecord`) | ✅ 3 errors, each the intended `no-restricted-imports` boundary rule; fixtures removed → `npm run lint` passes (0 problems) |
| 5 | `npm run test` | ✅ Vitest 3.2.7: `No test files found, exiting with code 0` (`passWithNoTests`; include restricted to `src/**/*.test.*`, `tests/unit/**`, `tests/integration/**` so Playwright specs stay separate; `tests/unit/setup.ts` imports `fake-indexeddb/auto`) |
| 6 | `npm run test:e2e` | ✅ exit 0 (`--pass-with-no-tests`); `playwright.config.ts` defines chromium/webkit/firefox projects and `webServer` at `http://127.0.0.1:<DEV_PORT>`; browsers installed via `npx playwright install chromium webkit firefox` (Chromium, WebKit, Firefox 157.0) |

Notes:
- **Version pins (plan §1 tracks):** TypeScript 5.9.3, React 19.3.0, React Router 7.18.4, Vite 7.3.7 (+ `@vitejs/plugin-react` 5.2.0, required for Vite 7), Tailwind 4.3.3, Vitest 3.2.7, fake-indexeddb 6.2.5, Playwright 1.64.0, axe-core/playwright 4.13.0, ESLint 10.12.0. npm's latest majors exceeded four frozen tracks (TS 6 / RR 8 / Vite 8 / Vitest 5); pinned in-track instead — moving tracks needs a plan note.
- **Open risk flagged to user:** `npm audit` reports critical advisories in the Vitest 3.x chain (`tinypool <=2.1.1` RCE gadgets GHSA-5gmw-xhrv-c9v3 / GHSA-85c8-ppgw-ccpr; `@vitest/mocker` path traversal GHSA-82fw-gwwq-j7x9). Dev/test-only exposure; the available fix requires vitest 5, outside the frozen 3.x track. Awaiting user decision (plan note to upgrade, or accept).
- **Deferred stack deps:** Zustand, decimal.js, Luxon, Testing Library are approved stack (plan §1) but unused by VD1; they install with the first consuming task (thin-slice convention).
- ESLint boundaries cover plan §2's structural direction rules: domain ← nothing; modules ← no ui; fact modules ← no coordinators; ui ← no tradeRecord/persistence/tradeAnalysis-direct. The finer "only workspace calls seedDefaults/restore" rule lands with the fact-module facades in VD2.

## T1.2 Static app shell *(structural)*
Verification:
- Shell renders navigation skeleton with placeholder content in narrow (bottom nav) and wide (left sidebar) layouts; Playwright resizes across the disclosed breakpoint live without reload, route, or scroll loss.
- `@axe-core/playwright` scan of both layouts reports zero critical/serious violations.
- Design tokens (cream ground, card, pill, tabular-numeral utilities) are defined once in Tailwind config/CSS custom properties and consumed by shell components.

### T1.2 verification record (2026-10-10)

Implementation notes:
- Breakpoint is Tailwind's `md` (768px) — an implementation choice per ui-contract "Responsive behavior". The layout switch is pure CSS (media queries hide/show the bottom nav vs. left sidebar); the DOM never remounts and `body` stays the scroll container in both layouts, so route, scroll position, and any form state survive a live resize by construction.
- Navigation labels use canonical domain language (Home, Trades, New Plan, Daily Review, Journal, Reports, Settings); the sidebar also carries the product name. A skip-to-content link, single exposed "Main menu" nav landmark per layout (the hidden nav is `display:none`, outside the a11y tree), visible `:focus-visible` outlines, `aria-current` active states (NavLink), and one `h1` per page are in place for the axe/keyboard baseline.
- Tokens live once in `src/ui/styles.css`: `@theme` custom properties (`--color-ground` cream, `--color-card`, `--color-ink`, `--color-muted`, `--color-line`, `--color-positive`/`--color-negative` reserved for signed values) plus `@utility` definitions `card`, `pill`, `label-caps` (small-caps section labels), `figure` (right-aligned tabular numerals). Shell components consume them (`bg-ground`, `card`, `pill … bg-ink`, `label-caps`, `figure`, one signed `+$42.50` placeholder using `text-positive`).

| # | Command | Outcome |
|---|---|---|
| 1 | `npm run test:e2e` (`tests/e2e/shell.spec.ts`, chromium+webkit+firefox) | ✅ **45/45 passed (7.8s)** — per engine: 7 routes × {narrow 375×667, wide 1280×720} render + axe scans with zero critical/serious violations, plus the live-resize test |
| 2 | live-resize test detail | ✅ on `/trades`: scrolled to `scrollY=400`, set a `window.__shellAlive` marker, resized narrow→wide→narrow; sidebar/bottom-nav visibility flips each time; URL stays `/trades`, heading stays visible, `scrollY` stays 400, marker survives (no reload) — green in all three engines |
| 3 | `npm run lint` / `npm run build` / `npm run test` after shell | ✅ lint 0 problems; build emits JS+CSS bundles; Vitest still 0 tests / exit 0 |

Fix during verification (test-side, not product): first run had 6 failures — `getByRole('heading', { name: 'Settings' })` substring-matched both the `Settings` h1 and the `Workspace settings` h2 (strict-mode violation). Changed the heading assertions to `exact: true`; suite fully green after.

## Deliverable gate
- [ ] Cumulative unit suite green
- [ ] Structural verifications T1.1/T1.2 recorded above with commands + outcomes
- [ ] Fresh browser-critic pass (critic starts the dev server itself):
  - [ ] Flow: shell renders in narrow and wide; live resize switches layout without reload/loss
  - [ ] Flow: axe scan clean
- [ ] Results log (date, critic run, flows, verdicts):
