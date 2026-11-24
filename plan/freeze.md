# Trade Journal V3 — frozen implementation plan manifest

## Freeze identity

- **Status:** FROZEN — approved by the user on 2026-11-23 after Phase 5 review.
- **Plan path:** `plan/vertical-deliverable-plan.md`
- **Evidence matrix path:** `plan/acceptance-evidence-matrix.md`
- **Freeze commit:** `c5d28a8a758a13645f8af257a53964c9a8429763` (Phase 5 decisions and prerequisite edges); preceding commits `3f5f01d2` (Phase 4 matrix), `89b04f6d` (deliverables and P3 scope change).
- **Immutable review revision:** the SHA-256 digests below. Any change to a frozen file invalidates this manifest and requires the deviation/approval process in the kickoff prompt.

| Frozen file | SHA-256 |
|---|---|
| `plan/vertical-deliverable-plan.md` | `8d5c63591fb34aec82213c4c3480c564c5a98026da08d5733b565e6bc97fe80e` |
| `plan/acceptance-evidence-matrix.md` | `93153f150be35847d6f4f1335f5f15b67f6246406dfad49618a83fa74dfc3548` |
| `specs/README.md` | `aa7d5a10b418c04704660b890cbdaaf7a4e0da8541b673348384f7a2217830b8` |
| `specs/acceptance/acceptance-contract.md` | `369880c5bde3988889eec6245584045fe3d453141030f263b1e956bb689ead06` |

## Approved stack profile

- TypeScript 7.0.2 via `@typescript/native` (`npx tsc`); `@typescript/typescript6` alias for `typescript-eslint` (`npx tsc6`) because TypeScript 7 has no compiler API.
- React + Vite, IndexedDB through a thin transaction adapter, `decimal.js`, injected clock and explicit U.S. trading calendar.
- Custom versioned service worker with build-generated digest manifest for the Offline Release Inventory.
- Vitest (unit), fake-indexeddb + Playwright (mock-free integration), Playwright (browser-critic gate).
- Local automation origin `http://localhost:$DEV_PORT` (worktree port 5182) only where the browser recognises loopback as a secure context; production HTTPS evidence is a separate obligation.

## Delivery evidence provenance

Recorded as provenance only, never as a support allowlist:

- Host at freeze: macOS 26.6.2 (25G83), Google Chrome 158.0.8127.37. Firefox was not installed at freeze time.
- Exact browser and operating-system versions actually used for each deliverable's evidence must be captured in that deliverable's execution record (Phase 5-5). Support is decided only by the specified functional checks; no browser, family, OS or user-agent identity gates readiness.

## Ordered deliverables and capability boundaries

1. Record institutions and accounts (foundation: PWA identity, Offline Release Inventory, Runtime Readiness, write gate, schema v1, seeds, capability manifest).
2. Plan only — Long Stock.
3. Open a Long Stock position.
4. Daily Review Phase I — current pricing, Marks, Risk/Reward.
5. Daily Review Phase II — journaling and Actions.
6. Close a Long Stock position.
7. Close Review.
8. Single option legs — open and close.
8a. Complete Trade Detail + mark-only replay (confirmed vertical slice; advisory IV and canonical descriptive figures).
9. Automated EOD mark retrieval.
10. Vertical option spreads — open and close.
11. Backup / Restore / migration.
11a. Corrections and visible audit.
12. Multi-leg option strategies — Butterflies, Iron Condors.
12b. Reference taxonomy and form-definition config.
13. Aggregate Trade performance metrics.
14. Filters for trade list and metrics.
15. Aggregate Account metrics.
15a. Management Revision and Rolls.
16. Options expiration and assignment.
17. Covered Call and Poor Man's Covered Call.

Twenty-one vertical deliverables; no layer-only exceptions. Sixteen prerequisite edges and single-owner resources are recorded in the plan.

## Evidence obligations

- Acceptance-to-evidence matrix: 69 scenarios, one row each, status `planned` until executed.
- Every non-structural task: detailed `describe`/`it should` cases and per-case red/green commands and outcomes produced immediately before that deliverable's implementation (Phase 5-2).
- Every deliverable: cumulative unit and mock-free real-stack integration suites pass, then a fresh browser-critic agent verifies every planned browser flow against the production UI; defects require a failing test first, a fix, and a fresh repeating critic.
- Mandatory execution gates: fresh critic with browser control, startable application server and production HTTPS evidence. If any is unavailable, implementation stops and reports the blocker (Phase 5-1).
- Target-scale correctness and latency evidence, secrets-exclusion checks, no-write/rollback comparisons, offline/update/migration/Restore and responsive/accessibility evidence are obligations inside their owning deliverables.

## Assumptions and remaining non-product risks

- TypeScript 7 has no compiler API; typescript-eslint therefore runs on the 6.x alias. `npx tsc --version` and `npx tsc6 --version` must be verified after any dependency change.
- Browser automation critic availability and a production HTTPS origin are execution preconditions, not yet demonstrated.
- Digit versions above are freeze-time provenance; exact evidence versions are captured per deliverable.
- Advisory implied volatility is a scoped spec reopening recorded in `specs/`; any broader theoretical-pricing use requires a new product decision.
- Task-level breakdowns, per-case red/green evidence and the critic's structured reports do not exist until execution.

## Approval

The user approved the final plan after the Phase 5 review and explicitly instructed the freeze to proceed. This manifest is the immutable reference for `specs/evaluation/kickoff-prompt.md`, whose placeholder must be replaced with:

`plan/freeze.md` — revision `c5d28a8a758a13645f8af257a53964c9a8429763`, with the file digests above.
