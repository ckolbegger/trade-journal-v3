# VD1 — Project scaffolding (layer-only checkpoint)

**Status:** Not started
**Depends on:** — (first deliverable)
**Frozen scope:** `implementation-plan.md` §4 VD1 (layer-only exception record in §5)

This is a living working document: progress, red/green evidence, and critic results are recorded here. Scope changes require plan-deviation approval per `KICKOFF.md`.

## Progress

| Task | Description | Status | Evidence |
|---|---|---|---|
| T1.1 | Toolchain scaffold | ☑ done 2026-10-10 | Verifications below |
| T1.2 | Static app shell | ☐ pending | — |
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

## Deliverable gate
- [ ] Cumulative unit suite green
- [ ] Structural verifications T1.1/T1.2 recorded above with commands + outcomes
- [ ] Fresh browser-critic pass (critic starts the dev server itself):
  - [ ] Flow: shell renders in narrow and wide; live resize switches layout without reload/loss
  - [ ] Flow: axe scan clean
- [ ] Results log (date, critic run, flows, verdicts):
