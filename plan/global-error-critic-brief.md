# Global error surface — focused critic brief

Independent critic for the app-wide last-resort error surface. Do NOT modify any file. Start the app yourself, drive the production UI, return a structured report.

## Frozen baseline
`plan/freeze.md` rev `c5d28a8a`, DEV-001 (loopback only, never production HTTPS). Prior fix history: `plan/d8-execution-record.md` "Post-release defect — silent Confirm failure".

## What to verify
A React error boundary plus `window` `error`/`unhandledrejection` listeners now surface any uncaught failure in a visible banner (`data-testid="global-error"`, with a **Dismiss error** button). Local catches in `onConfirmPlan`, `onRecordPosition` and `onRecordClose` keep expected command failures in their own form alerts; the global net is the fallback for everything else.

## Start
From worktree root run `npm run dev` (port 5182). Use `playwright-cli` at `http://localhost:5182`. Close browser and stop server when done.

## Flows
1. **Unguarded async command.** On a fresh context, replace `IDBFactory.prototype.open` with a function that throws (via `page.evaluate`), then click **Add institution** after entering a name. The global banner must appear with the thrown message (`storage blocked`). This command has no local catch — it used to be silent.
2. **Unguarded rejection from another screen.** Create an Institution and Account normally, open **Review**, break IndexedDB open again, and click a Review action that would normally write. The banner must appear rather than the screen silently doing nothing.
3. **Resource errors ignored, dismiss works.** The favicon 404 must not raise the banner on a healthy load. Dispatch a synthetic `unhandledrejection` with `promise: Promise.resolve()` and `reason: new Error('synthetic failure')`; the banner shows that message and **Dismiss error** removes it.
4. **Local catches still local.** With healthy IndexedDB but `crypto.randomUUID` removed, confirm a complete Long Call plan: it must succeed and create a planned Trade with **no** global banner. With an empty Strike, the form must show its own `role=alert` containing `Strike` and **no** global banner.

For each flow: actions, observed result, PASS/FAIL. Any FAIL needs repro, expected vs actual and a screenshot. Report exact browser/OS versions. Edit nothing.
