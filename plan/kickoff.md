# Implementation kickoff

Work in the Trade Journal V3 repository (`/Users/ckolbegger/src/trade-journal-v3/worktrees/Hy4-Flash`) and obey its `AGENTS.md`.

Read the frozen product baseline at `specs/README.md`, all documents it indexes, and the complete implementation-stack-neutral acceptance contract at `specs/acceptance/acceptance-contract.md`.

Read the separately approved frozen implementation plan at:

**`plan/freeze.md`** — revision `c5d28a8a758a13645f8af257a53964c9a8429763`, with the file digests recorded there.

Frozen plan files: `plan/vertical-deliverable-plan.md`, `plan/acceptance-evidence-matrix.md`. Treat `specs/` and these plan files as read-only baselines.

Implement the approved vertical deliverables in dependency order (Deliverable 1 first, then the prerequisite edges in the plan). Do not reopen settled product semantics, broaden scope, advertise incomplete capabilities, or promote a layer-specific task into a release boundary. No layer-only checkpoints are approved.

Before the first vertical deliverable can mutate authoritative data, its Web App Manifest, complete versioned Offline Release Inventory, every-launch and post-update/Restore Runtime Readiness gate, and persistence-level `RuntimeNotWritable` rejection outside `Writable` must be implemented. Decide support only from the specified functional checks; no browser, family, operating-system or user-agent allowlist.

Implement every non-structural task with TDD, one planned behaviour at a time, recording red and green commands for each case. For each structural task, run its exact planned verification. The detailed per-deliverable task breakdown with `describe`/`it should` cases is produced immediately before that deliverable's implementation (Phase 5-2 decision in the frozen plan).

Before presenting a deliverable for independent review, run the complete cumulative unit suite and every planned mock-free integration test. Then spawn a fresh critic agent with access to the complete frozen specs and plan, have it start the application and use a browser against the production UI to verify every planned flow for the current deliverable, and require a passing fresh-critic report. For every defect, add or strengthen a failing automated test first, fix it, rerun the cumulative suites, and spawn another fresh critic. If a fresh critic, a startable server, browser control or production HTTPS evidence cannot be provided, stop and report the blocker rather than self-certifying.

For every deliverable, preserve atomic/audit/offline/Restore guarantees, run all mapped evidence from `plan/acceptance-evidence-matrix.md`, and report exact verification results. If implementation requires a material deviation, stop before making it, identify affected specification passages and acceptance scenarios, and request approval to revise the frozen plan.
