# D8aR R6 — error meaning seam: focused critic brief

Independent critic for the sixth D8aR deepening. Read-only: modify nothing. Start the app yourself, drive the production UI, return a structured report. Frozen `specs/` and plan files read-only. DEV-001: loopback `http://localhost:5182` only, never production HTTPS.

## What changed
`src/ui/error-meaning.ts` now owns typed failure → canonical prose and the field/global surface decision. `issue-copy.ts` was deleted and its test migrated. `App.tsx` no longer switches error kinds into prose in each handler; `plan-controller.ts` and `review-controller.ts` no longer collapse typed failures into ad-hoc strings; `global-errors.ts` uses the same wording module. Runtime Readiness semantics are unchanged: a later failure does not invalidate held writable state.

## Start
From worktree root run `npm run dev` (port 5182). Use `playwright-cli` at `http://localhost:5182`. Close the browser and stop the server when done.

## Flows
1. **Validation failures stay local with the same prose.** Onboard; confirm a Long Call with an empty Strike → local `role=alert` must contain `Strike`; a Long Stock plan with empty Thesis/Invalidation must show `Invalidation` prose; no global banner and no Trade written.
2. **Unguarded async command still reaches the global banner.** Break `IDBFactory.prototype.open` via `page.evaluate`, click **Add institution** after entering a name → global banner with `storage blocked`, with a Dismiss button. Dismiss removes it.
3. **Unhandled rejection and resource errors.** Dispatch a synthetic `unhandledrejection` with `promise: Promise.resolve()` and `reason: new Error('synthetic failure')` → banner shows that exact message. A healthy load's favicon 404 must not raise the banner.
4. **Long Call without crypto.randomUUID still confirms** with no banner, and a Close Review `Conflict` retry shows the canonical conflict prose locally rather than the global banner. If a Conflict cannot be produced in the UI, report not-covered.

For each flow: actions, observed result, PASS/FAIL. Any FAIL needs repro, expected vs actual and a screenshot. Report exact browser/OS versions. Edit nothing.
