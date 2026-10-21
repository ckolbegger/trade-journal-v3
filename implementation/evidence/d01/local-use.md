# Run the D1 app locally

From `/Users/ckolbegger/src/trade-journal-v3/worktrees/codex-gpt-6.1-sol`, using the recorded Node 26.12.0 and npm 11.20.0:

```sh
npm run build
npm run preview
```

Open **http://localhost:5174**. The port is strict. Use this same origin for retained browser data and offline verification. The production build supplies the verified service worker and complete offline inventory.

D1 provides time-zone onboarding, real Institutions/Accounts, exact Long Stock Plans with fixed Stop/Target and Plan Reflection, and saved Planned list/detail/history. Execution entry and later deliverables are absent.

Writable support depends on actual functional checks and capacity. The user-authorized D1 capacity policy reserves approximately 680 MB fresh, including 25% headroom, for the installed Plan/reflection workload. Native Chrome, Firefox and WebKit can now run the writable acceptance flows at their unchanged quotas. Genuinely insufficient space or a failed functional check still blocks writes. Storage and protection are specific to the chosen browser/profile.

An existing browser profile may still serve the previous cached release. Keep the local preview running, leave the old app open online for about 15 seconds so its automatic update check can stage the new release, then explicitly close every Trade Journal tab/window and reopen the same origin. Do not clear site data or delete the database. New-release activation occurs after old clients close; no data migration or deletion is needed for this policy change. The critic observed that abruptly stopping the old Chrome process before closing its app pages could briefly reopen a blank old page; closing all old app clients allowed the staged release to activate.

All work remains local by user instruction. Production deployment is deferred. See the execution record and independent critic reports for measured evidence and remaining host-only verification limits.
