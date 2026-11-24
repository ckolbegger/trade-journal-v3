# D1 execution record

## Status
Deliverable 1 complete. Fresh browser-critic gate passed 5/5 flows. Frozen baseline `plan/freeze.md` revision `c5d28a8a`; DEV-001 applies.

## Red/green evidence
Every behaviour-bearing task in `plan/d1-task-breakdown.md` was written test-first. RED was confirmed (module missing or assertion failing for the absent behaviour) before implementation; GREEN followed with the smallest change. Notable defects caught by the red/green loop:
- Seed defaults matched by mutable label → duplicates after rename; fixed to match by stable product key.
- Write-gate simultaneous-failure fixture used a readable workspace; corrected to a fresh environment.
- Institution rename expected-revision fixture used the new revision; corrected to the current revision.
- Workspace settings Unchanged case used the wrong function; aligned to `saveSettingsWithCurrent`.

## Verification commands and outcomes
- `npm run lint` — exit 0
- `npm run typecheck` (`tsc --noEmit`, TS 7.0.2) — exit 0
- `npm run typecheck:6` (`tsc6 --noEmit`, TS 6.0.3) — exit 0
- `npm run test:all` — 12 files, 43 tests passed
- `npm run test:integration` — 1 file, 2 tests passed (mock-free, real persistence via fake-indexeddb)
- `npx playwright test` — 5 browser tests passed
- `npm run build` — passed; Offline Release Inventory `sha256-09ce827f1b871847f8c0b5389e61616636eea4a1cdb70d310cbcbbcf3990981a`, 6 assets

## Browser-critic gate
- First critic: 4 FAIL / 1 PASS. Defects: static scaffold (readiness never resolved), Workspace capability absent from navigation, view states unreachable without hidden hooks, no responsive layout.
- Test-first repair: added 5 `e2e/d1-ui.spec.ts` tests that reproduced the four defects; confirmed RED (4 failed / 1 passed), then wired `App`/`controller`, added Workspace nav, real view-state transitions, and responsive CSS.
- Fresh critic repeat: **5/5 PASS** — readiness resolves with working controls; capability honesty; Loading/Empty/Ready/Error reachable through real logic with durable create flows; responsive wide/narrow resize with no reload and preserved state; manifest stable identity.
- Non-blocking observations: favicon 404 (dev noise), Workspace nav button has no dedicated handler (status shown inline). These are not D1 acceptance defects but are candidates for later polish.

## Acceptance scenario status for D1
- AC-DEL-001 (offline cold restart): **planned** — requires stopping the app and disabling network; not yet exercised.
- AC-DEL-003 (PWA identity + HTTPS): **partial** — Manifest, inventory and browser-tab identity verified locally; production HTTPS row deferred per DEV-001.
- AC-DEL-004 (readiness gate): **partial** — unit, integration and local UI readiness states verified; controlled browser-level failure injection still to be automated.
- AC-REF-001 (seed defaults): **covered** — exact manifests, idempotence, stable keys verified by unit and integration tests.
- AC-RESP-001 (post-commit results): **covered** for Institution/Account by unit and integration tests.
- AC-CAP-001 (capability honesty): **covered** — manifest and navigation verified by unit, integration and browser-critic flows.
- AC-JOUR-007: **partial** — definitions seeded; trader revision is D12b.
- AC-DEL-005 (Recovery Only): **partial** — no backup capability until D11.

Rows in `plan/acceptance-evidence-matrix.md` remain `planned` where the full cross-deliverable evidence (offline restart, failure injection, HTTPS) has not yet been captured; this record is the honest per-deliverable evidence.
