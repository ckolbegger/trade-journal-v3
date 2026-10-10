# VD1 — Project scaffolding (layer-only checkpoint)

**Status:** Not started
**Depends on:** — (first deliverable)
**Frozen scope:** `implementation-plan.md` §4 VD1 (layer-only exception record in §5)

This is a living working document: progress, red/green evidence, and critic results are recorded here. Scope changes require plan-deviation approval per `KICKOFF.md`.

## Progress

| Task | Description | Status | Evidence |
|---|---|---|---|
| T1.1 | Toolchain scaffold | ☐ pending | — |
| T1.2 | Static app shell | ☐ pending | — |
| Gate | Cumulative suites + browser critic | ☐ pending | — |

---

## T1.1 Toolchain scaffold *(structural)*
Verification (all must pass before T1.2):
- `npm run build` produces a production bundle; `npm run dev` serves it at `http://127.0.0.1:5176` (DEV_PORT from `.env.local`, `strictPort` fails on a taken port — verified by starting a second instance and observing the error).
- `npm run lint` fails on a fixture file where `src/domain/**` imports `src/modules/**`, where `src/modules/referenceCatalog` imports a coordinator, and where `src/ui/**` imports `src/modules/tradeRecord`; passes with the fixture removed.
- `npm run test` (Vitest, fake-indexeddb wired) and `npm run test:e2e` (Playwright, three engines) run and report zero tests without errors.

Deliverable behavior depending on it: everything.

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
