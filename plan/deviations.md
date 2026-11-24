# Approved deviations from the frozen plan

This file records approved deviations that govern execution without revising the frozen files in `plan/freeze.md`. Frozen file digests remain unchanged.

## DEV-001 — defer production HTTPS evidence until deployment

- **Status:** APPROVED by the user on 2026-11-24.
- **Frozen decision affected:** Phase 5-1 in `plan/vertical-deliverable-plan.md` treats production HTTPS evidence as an execution blocker alongside the fresh-critic and startable-server gates.
- **Deviation:** Production HTTPS evidence is deferred until the application is actually deployed to a hosting origin. Implementation and all local verification may proceed using `http://localhost:$DEV_PORT` where the tested browser recognises loopback as a secure context for service-worker and storage behaviour.
- **Affected acceptance scenario:** `AC-DEL-003` — the production HTTPS-origin configuration evidence row remains `planned`/deferred until deployment. All other rows and all other scenarios are unaffected.
- **Durable compatibility:** none. This changes evidence timing only; no data semantics, schema, capability declaration or atomicity guarantee changes.
- **Safeguards:**
  1. Loopback evidence is never relabelled as production HTTPS evidence.
  2. Production HTTPS evidence remains mandatory before any release is declared production-ready.
  3. Browser-neutral Runtime Readiness and all functional checks stay fully required; no browser, OS or user-agent allowlist is introduced.
  4. Deployment evidence must be recorded in a later acceptance-evidence update before the affected capability is called deployed.

## Gate status after DEV-001

| Gate | Status |
|---|---|
| Startable application server | Available — Node 26.12.0, npm 11.20.0 |
| Fresh critic agent with browser control | Confirmed — Playwright CLI 0.1.25 installed and verified by the main session and a fresh subagent |
| Production HTTPS evidence | Deferred by DEV-001 until deployment; local loopback evidence used in the interim |
