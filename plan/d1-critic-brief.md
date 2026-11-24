# D1 browser-critic brief

You are an independent critic for Deliverable 1. You do NOT modify implementation code. You start the app yourself, drive the production UI in a browser, and return a structured report.

## Frozen baseline
- `specs/README.md` and the documents it indexes
- `plan/freeze.md` revision `c5d28a8a`, `plan/vertical-deliverable-plan.md`, `plan/d1-task-breakdown.md`
- `plan/deviations.md` DEV-001: local loopback is valid for critic evidence; production HTTPS deferred

## Your allowed capabilities in D1
Institution create, Account create, typed reference browse, Workspace status/settings/durability request. Nothing else. Undelivered capabilities must be absent from navigation, not shown as Unavailable.

## Start the app
Port is in `.env.local` (DEV_PORT=5182). Start with `npm run dev` in the worktree, wait for the server, then use `playwright-cli` against `http://localhost:5182`.

## Flows to verify
1. **Startup / readiness view.** Open the app. Confirm it shows startup verification or a ready state with the Institutions & Accounts view. It must not present an empty workspace with enabled mutation before readiness.
2. **Capability honesty.** Inspect navigation. Only Institutions & Accounts and Workspace entries exist. No Plan, Trade, Journal, Mark, Report, Backup or Restore controls.
3. **View states.** Loading, Ready, Empty, Error are distinguishable in the UI.
4. **Responsive live resize.** At wide width show the sidebar arrangement; resize narrow without reload and confirm the same view and no lost state.
5. **Installation affordance / manifest.** Confirm `/manifest.webmanifest` is served with stable identity, standalone display, icons and scope.

For each flow record: browser actions performed, observed result, PASS/FAIL. For failures include reproducible steps, expected vs actual, and a screenshot via `playwright-cli screenshot`.

Do not treat missing future capabilities as defects. Do not edit files. Close the browser and stop the dev server when finished.
