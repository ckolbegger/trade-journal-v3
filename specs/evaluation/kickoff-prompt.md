# Implementation kickoff prompt

Use only after the user has approved and frozen a separate implementation plan. Replace the placeholder with its exact repository path and revision/digest.

```text
Work in the Trade Journal V3 repository and obey its AGENTS.md.

Read the frozen product baseline at specs/README.md, all documents it indexes, and the complete implementation-stack-neutral acceptance contract at specs/acceptance/acceptance-contract.md.

Read the separately approved frozen implementation plan at:
<APPROVED_IMPLEMENTATION_PLAN_PATH_AND_REVISION>

Implement the approved vertical deliverables in dependency order. Treat specs/ and the approved plan as read-only baselines. Standards-based PWA delivery and browser-neutral Runtime Readiness are frozen product requirements, not stack choices. Do not reopen settled product semantics, broaden scope, advertise incomplete capabilities, or promote a layer-specific task into a release boundary. Perform a layer-only checkpoint only when the frozen plan records its specific manual approval.

Before the first vertical deliverable can mutate authoritative data, implement its Web App Manifest, complete versioned Offline Release Inventory, every-launch and post-update/Restore Runtime Readiness gate, and persistence-level `RuntimeNotWritable` rejection outside `Writable`. Decide support only from the specified functional checks; do not use browser, browser-family, operating-system, or user-agent allowlists. Exercise all passing and failing readiness states, including simultaneous failures, an unreadable existing store, and `Recovery Only`, and record exact browser/operating-system versions only as evidence provenance. Preserve separate production HTTPS evidence; local browser automation may use only the plan-approved loopback origin that the tested browser recognizes as a secure context.

Implement every non-structural task with TDD, one planned behavior at a time. Before writing production behavior, add the next planned `it should ...` test through its identified public seam, run it, and confirm that it fails because the behavior is absent or incorrect. A test that passes immediately or fails for a syntax, configuration, fixture, or unrelated reason is not valid red evidence. Make only the smallest production change needed for that test, rerun it to green, and confirm the task's earlier tests remain green. Record the red and green commands and outcomes, then repeat for the next behavior; do not write all tests first and then all implementation. Unit tests may use mocks as permitted by the plan. After the task is green, perform any refactoring as a separate review step and rerun the affected tests. No non-structural task is complete without this evidence.

For each structural task, run its planned verification. Before presenting a deliverable for independent review, run the complete cumulative unit suite and every planned integration test. Integration tests must use no mocks and must traverse the real application stack and persistence/infrastructure. They may use only the disclosed isolated instances or behaviorally compatible test infrastructure recorded in the plan.

After those suites pass, spawn a fresh critic agent with access to the complete frozen specs and implementation plan. Have that critic start the application server/runtime and use a browser against the production UI to verify every planned flow for the current deliverable. A browser-recognized secure loopback origin may be used for local critic execution only as approved in the plan; it does not replace the delivery's production HTTPS evidence. The critic must not edit implementation and must return the structured actions, observations, status, and failure evidence required by the plan. It need not repeat full regression of prior deliverables; the cumulative automated suites own that responsibility. It must not treat planned future capabilities as defects.

For every implementation defect the critic finds, first add or strengthen an automated test that reproduces the defect and confirm that the test fails. Then implement the fix, rerun the complete cumulative unit and integration suites, and spawn another fresh critic to repeat the current-deliverable verification. Do not mark the deliverable complete until a fresh critic passes it. If a critic finding exposes a specification or plan ambiguity, or if a fresh critic/server/browser cannot be provided, stop and request direction rather than self-certifying.

For every deliverable, preserve atomic/audit/offline/Restore guarantees, run all mapped evidence, and report exact verification results. If implementation requires a material deviation, stop before making it, identify affected specification passages and acceptance scenarios, and request approval to revise the plan.
```
