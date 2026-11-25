# D8a execution record

## Status
Deliverable 8a (complete Trade Detail + mark-only replay + advisory IV) complete. Task breakdown written before production code; all cumulative suites green. First fresh browser-critic pass found one defect, repaired with RED tests first; the fresh repeat critic passed 4/4 flows with no remaining defects. Frozen baseline `plan/freeze.md` rev `c5d28a8a`; DEV-001 applies (loopback only, never relabelled production HTTPS). Frozen `specs/` and frozen plan files unchanged — the P3 reopening (`AC-IV-001` and the advisory exception in `specs/README.md`) was already landed before D8a, so no spec edit was needed.

## Task breakdown first
`plan/d8a-task-breakdown.md` was written before any D8a production code, and not before D8 was released. It fixes S1–S4 (capability manifest, durable representation, detail vocabulary, public contract) and T1–T6 (mark-only session series, advisory IV, share equivalent/decomposition, complete detail assembly, production UI, no-write read boundary), each with named seams, concrete `it should` cases, red/green commands and critic flows.

## Red/green evidence
Every case was added through its named seam, run to RED with the behaviour absent (module missing or assertion failing), then made GREEN with the smallest production change; earlier tests stayed green.

| Task | RED | GREEN |
|---|---|---|
| D8A-S1 manifest | `npx vitest run tests/structural/d8a-capability-manifest.test.ts` — module `capabilities-d8a` absent | 2 passed |
| D8A-T1 session series | `npx vitest run tests/unit/session-series.test.ts` — module `session-series` absent; then unsorted gap array | 4 passed |
| D8A-T2 advisory IV | `npx vitest run tests/unit/advisory-iv.test.ts` — module absent; then the negligible-sensitivity fixture did not trigger the branch | 4 passed |
| D8A-T3 advisory outputs | `npx vitest run tests/unit/advisory-decomposition.test.ts` — module absent | 4 passed |
| D8A-T4 complete detail | `npx vitest run tests/unit/complete-detail.test.ts` — module absent; then fixture put an outstanding Debt in the narrative rather than Needs you | 3 passed |
| D8A-S2/S3/S4 structural | `npx vitest run tests/structural/d8a-*.test.ts` — modules absent; then an invalid option fixture for advisory | 6 passed |
| D8A-T6 read boundary | `npx vitest run tests/integration/d8a-read-boundary.test.ts` — module absent; then a Planned Trade had no `executions` and `oneR`/`underlying` live only on the frozen Plan | 3 passed |
| D8A-T5 UI | `npx playwright test e2e/d8a-detail-replay.spec.ts` — 4 failed waiting for an absent `Complete detail` button | 4 passed |

Two further defects were caught by the browser loop and fixed with failing tests first: deviation category labels rendered camelCase rather than the closed vocabulary, and a replay assertion hardcoded a session date that the explicit noon-Tuesday policy does not produce. No mocks are used in integration tests; `fake-indexeddb` (from `tests/setup.ts`) is the disclosed substitute for browser-owned IndexedDB. Browser tests use real IndexedDB in disposable Chromium contexts; the two option/underlying Mark sessions are seeded directly because D8a is read-only and does not record Marks.

## Verification commands and outcomes
- `npm run test:all` — 83 files, 304 tests passed (D8 baseline: 74/277).
- `npm run test:integration` — 15 files, 54 tests passed (D8 baseline: 50).
- `npx playwright test` — 50 browser tests passed (D8 baseline: 46; 4 new D8a).
- `npx playwright test -c playwright.prod.config.ts` — 1 offline cold-restart test passed.
- `npm run lint` — exit 0 (unused destructured fixture vars removed).
- `npm run typecheck` (`tsc --noEmit`, TS 7) and `npm run typecheck:6` (`tsc6 --noEmit`, TS 6) — exit 0.
- `npm run build` — passed; Offline Release Inventory `sha256-4791c7fee7eccd9de7ec0a9b0c52b237278007c2c29c06207d29949649cd4333` with 6 assets.

## Browser-critic gate — first pass
A fresh independent critic (not this session) ran `plan/d8a-critic-brief.md`, starting the app itself and driving the production UI with `playwright-cli` (headless Chrome 158 / macOS 26.6.2, loopback per DEV-001). Flows 1 and 4 **PASS**; flows 2 and 3 **FAIL** from one shared root cause. It edited nothing.

Defect: the replay showed underlying prices `100.00`/`102.00` for available sessions instead of the exact option Marks `3.00`/`3.80`, and advisory IV fell into the expiration-day `Unavailable` branch with share equivalent `200` and a zero split. `confirmOptionPlan` freezes `strategyId` only inside `plan`, but `contractOf()` in `src/ui/detail-controller.ts` read a top-level `strategyId`, so the frozen contract never resolved and `resolveFrames` queried the underlying ticker. RED: two new assertions in `e2e/d8a-detail-replay.spec.ts` (exact mark values and a numeric advisory IV) plus a new `tests/integration/d8a-read-boundary.test.ts` case with a Trade whose Strategy id exists only in the Plan. Fixed by resolving `strategyId` from `strategyId ?? plan.strategyId` in both `contractOf` and the advisory shape lookup. GREEN 4/4 D8a browser cases and 4/4 integration cases.

All cumulative suites re-run green: 304 Vitest, 54 integration, 50 browser, 1 offline, lint, both typechecks, build. Offline Release Inventory `sha256-4791c7fee7eccd9de7ec0a9b0c52b237278007c2c29c06207d29949649cd4333`.

## Browser-critic gate — repeat pass
A fresh repeat critic (new session, not this session) re-ran the updated `plan/d8a-critic-brief.md`: **4 PASS / 0 FAIL — no defects** (headless Chrome 158.0.0.0 / macOS 26.6.2 build 25G83, loopback `http://localhost:5182` per DEV-001). It confirmed all ten complete-detail sections and six descriptive figure slots with no composite score; exact option Marks `3.00` and `3.80` in the mark-only replay with explicit gaps and no OHLC or interpolation; a deterministic advisory IV `1.9519` independently reproduced from Mark 3.80 / S 102 / K 190 / 25 days, share equivalent `34`, and a non-zero estimate-labelled split `60.03 / -126.32 / 226.29` summing to the 160.00 Mark move; and byte-identical store hashes across detail, slider and navigation with the five-entry navigation unchanged. It edited nothing.

## Acceptance scenario status for D8a
- **AC-CALC-004 full** — the reused `expirationPayoff` is unchanged; advisory inputs are ignored by the canonical result (unit, structural, browser).
- **AC-MARK-004 full** — one exact point per completed session from end-of-day Marks only (unit, browser).
- **AC-MARK-006 partial** — explicit gaps and no interpolation; a provider Daily Bar may render but is not required and no Bar store or manual OHLC exists (unit, browser).
- **AC-UI-002 partial** — complete detail sections and descriptive figure slots are present; no composite score/grade (unit, structural, browser).
- **AC-RESP-001 full** — read assembly writes nothing across detail, replay and navigation, including after DB reopen (integration, browser).
- **AC-IV-001 provisional** — deterministic Black-Scholes inversion with exact inputs, Share Equivalent and an estimate-labelled decomposition; the five `Unavailable` reasons are stable; absence of the capability removes outputs rather than producing a domain `Unavailable`; canonical results are byte-equivalent with advisory on/off (unit, structural, integration, browser).

## Open items / carried forward
- Provider configuration/recovery, required Daily Bars, manual OHLC, custom replay ranges, combined replay+payoff, reports, backup and restore remain uninstalled.
- Advisory IV, Share Equivalent and decomposition are explanation only: no prediction, coaching or use in valuation, P&L, risk/reward, Stop/Target, payoff, Daily Review or reports.
- Production HTTPS evidence remains deferred per DEV-001 until deployment.
- Carried non-defect: favicon 404 in the dev console.

## Release
D8a released as a follow-up commit `feat(d8a): ...` with tag `hy4-flash-d8a-complete`, pushed and verified with `git ls-remote`. This completes the frozen vertical sequence D6 → D7 → D8 → D8a, each finished and released before the next was researched.
