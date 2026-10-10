# Detailed task breakdown — D1, D2 and D3

Status: draft for review, 2026-10-10. This is the detailed task/test plan for the first three accepted vertical deliverables, not implementation approval or the complete 20-deliverable plan. No production code or tests were added or executed.

Baseline: frozen [canonical specification](../specs/README.md) at `968bc2b`. Selected stack: [Profile A](stack-selection.md) — React, strict TypeScript, Vite, Dexie/IndexedDB, exact rational arithmetic, Vitest and Playwright. Work only in `worktrees/codex-gpt-6.1-sol`, branch `codex-gpt-6.1-sol`, configured development port 5174.

## Deliverables and task/test counts

| Deliverable | Complete user journey | Tasks | Unit cases | Acceptance flows |
| --- | --- | ---: | ---: | ---: |
| [D1 — Stock Plan/opening](tasks/d1-stock-open.md) | First launch, real Account, confirmed Stock Plan and completed Plan Reflection, grouped opening, Journal outcome and durable detail |16|93|8|
| [D2 — Manual Stock review/closure](tasks/d2-stock-review-close.md) | Manual closing Marks, management, dated Daily Review Save, full exit, Close Review and Closed detail |12|73|11|
| [D3 — Single option and provider](tasks/d3-single-option-provider.md) | Option Plan/open/review/full exit or explicit settlement, optional recovery and resulting Stock allocation/management |15|89|11|
| **Total** | Ordered D1 → D2 → D3 |**43**|**255**|**30**|

Five tasks are structural checks; 38 are behavior-bearing tasks with per-case TDD specifications. Another 12 shared acceptance flows cover result contracts, write gating, failure/restart/offline, backup/read-back/Restore, safe updates, accessibility, reconstruction, performance and capability honesty. They run against every applicable installed scope rather than count as separate releases.

Each task contains a named test seam, concrete work, blocking edges, literal unit-case IDs and linked acceptance flows. Each acceptance flow contains fixture, Given/When/Then, durable/failure proof and critic procedure. Read the [shared test/evidence guide](tasks/test-evidence.md) for commands, fixtures, fault controls, benchmark datasets and required red/green evidence.

The [canonical acceptance map](acceptance-map-d1-d3.md) has one row for each of the 67 specification scenarios. Every scenario remains planned or intentionally not advertised; none is currently covered. Rows distinguish early installed variants from later scaling, multi-leg, correction, form-edit and report cases.

## Scope decisions retained

D1's enabling persistence/PWA/readiness/backup work belongs inside the first real Stock journey. It is not an earlier foundation-only deliverable. Multiple broker fills inside one opening/closing decision are supported when that decision is installed; later independent entries and deliberate partial exits remain their separate scaling deliverables.

D2 uses Manual evidence only, as requested. Its recovery result gives NotConfigured/Manual tasks and performs no provider request. Exit/Roll/Adjust Daily Review Actions record intent and do not execute those changes. Narrow reasoned Daily Review Action Void is included for reversible completion; general Journal amendments remain D16.

D3 introduces one selected provider for Stock/Underlying and exact option observations plus available Bars, while retaining fully offline Manual use. Provider choice is a prerequisite task, with live coverage/credentials/date/CORS evidence required before advertising recovery. Real partial option settlement is admitted as factual evidence; deliberate independent option scaling remains D9. Physical delivery may change existing Stock and create only residual successor exposure; basis/proceeds, lineage and required management are tested in the same slice.

Every new durable format extends lossless migration, Restore validation, reconstruction, capacity and indexes in its own deliverable. Frozen Plan/Journal/decision/contract evidence is recorded when the facts occur so later reports do not invent past data.

## Remaining work before the complete plan can be frozen

- Detail D4–D20 and consolidate the full task graph and all module/operation implementation mappings.
- Pin exact compatible package/runtime versions and record production HTTPS, secure-loopback and browser/OS evidence environments.
- Finalize and measure the numerical mature-data/headroom model; preserve disclosed D1 prefix and D2/D3 installed-history benchmark limits.
- Select and verify the provider, option-session policy and direct-browser versus stateless-relay boundary in D3-T01.
- Review consequential draft scope details and record user approval of the complete implementation plan and its immutable revision/digest.

The canonical [planning protocol](../specs/evaluation/planning-protocol.md#phase-6--freeze-before-implementation) requires that complete-plan approval before implementation. This task creates the requested breakdown and tests only.
