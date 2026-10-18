# Handoff — D1 session: freeze the plan, then implement VD1

Date: 2026-10-18 · Branch: `zcode-glm-5.3` · Expected HEAD: this handoff's commit or later (must contain plan decision 14).

## 0. Before anything else: switch to the correct worktree

All work happens in the zcode-glm-5.3 worktree — NOT the main checkout and NOT a sibling worktree:

```sh
cd /Users/ckolbegger/src/trade-journal-v3/worktrees/zcode-glm-5.3
git branch --show-current   # must print: zcode-glm-5.3
git log --oneline -5        # must include: decision-14 plan commit and the stack re-pin e23bfa9
```

Several sibling agents run in parallel worktrees under `worktrees/` (`claude`, `claude-opus-5.5`, `codex`, `codex-gpt-6.1-sol`, `deepseek-v41-flash`, `glm`, `qwen3.8-27B`), each on its own branch. Running commands in the wrong checkout writes to another agent's branch. If branch or HEAD does not match, stop and reconcile with the user before doing anything else.

## 1. What this session does, in order (user-set, 2026-10-18)

1. **Read-first** (§4 below), then:
2. **Phase 4 — build the acceptance-to-evidence matrix.** One row per acceptance scenario in `specs/acceptance/acceptance-contract.md` (all ~40: AC-RESP, AC-PLAN, AC-LIFE, AC-POS, AC-SET, AC-CORR, AC-JOUR, AC-REV, AC-MARK, AC-CALC, AC-RPT, AC-REF, AC-BACK, AC-REST, AC-REBUILD, AC-DEL, AC-UI, AC-PERF, AC-CAP), with the fields from `specs/evaluation/planning-protocol.md` §Phase 4: scenario ID · completing/owning VD · planned task(s) · TDD/structural evidence spec · mock-free integration case · critic flow where applicable · exact command/procedure · expected observable result and durable-state proof · failure/nonmutation evidence · status. Create it as `plan/acceptance-evidence-matrix.md` and link it from the plan's Basis; pull task/integration/critic mappings from the six VD working files' coverage tables (they are already per-scenario mapped for VD1–VD6; VD7–VD18 rows are populated at the `planned` status level from the plan's own markings).
3. **Final review with the user — one consequential decision at a time.** Present the matrix, then adjudicate the remaining open flags (§2). Record accepted resolutions in place.
4. **Freeze the plan** (Phase 6): record the stable path + immutable revision/digest, stack profile, task-graph/capability boundaries, matrix link, explicit assumptions/risks, and the user's approval line in the plan header. From freeze onward the plan is a read-only baseline; a required deviation stops work and asks the user first.
5. **Kickoff: implement VD1** per `plan/VD1-workspace-and-first-plan.md` — that file is the work order. Follow `specs/evaluation/kickoff-prompt.md` verbatim as the implementation rules (TDD one-behavior-at-a-time with recorded red/green evidence; structural tasks run their planned verification; cumulative mock-free integration suite; fresh browser-critic gate with the mandatory test-first repair loop; honest Installed Capability Manifest; no scope broadening; no layer-only checkpoints).

## 2. Settled decisions — do not re-litigate

- **Sequencing decisions 1–13** (plan header, chronological): 18 deliverables, VD1 Workspace+Plan → VD6 Verified Backup → … → VD18 Restore & at-scale evidence.
- **Decision 14 (2026-10-18, user-approved):** **(a)** original Targets are required alongside Stops — missing target is a typed rejection, Original Planned Reward always finite at confirmation; **(b)** planned-trade browsing and plan detail moved from VD1 to VD2 (VD1 presents the confirmed plan from the post-commit result only); **(c)** no Cloudflare deployment yet — everything runs locally on the `127.0.0.1` loopback secure context until a useful MVP exists; AC-DEL-003's production-HTTPS half completes at the first deployment deliverable; **(d)** this session freezes the plan before implementing.
- **Stack (re-pinned 2026-10-18, user-approved):** TypeScript 7.0.2 (fallback 6.0.3 only for an evidenced scaffold-time toolchain gap), React 19.3.1 + @types 19.3.0, React Router 8.4.0, Vite 8.3.4, Tailwind 4.3.3, Zustand 5.0.15, decimal.js 10.6.0, Luxon 3.7.2, Vitest 5.0.5, fake-indexeddb 6.2.6, Playwright 1.64.1. Host Node 26.12.0 satisfies all engines.
- **Open flags for the final-review step** (cited in the per-VD files' flag sections; recommendations included there): F4 AC-DEL-005 Recovery-Only-export completion point (recommend VD6); F6 AC-MARK-002 (machinery at VD3, provider-interaction evidence at VD4); F7 AC-REV-006 void sub-case (accrues VD13); F8 Settlement-Due routing (machinery VD3, first exercise VD4); F9 short-call Unbounded worst case (exercise VD9); F10 provider stub as standing integration fixture; F11 AC-POS-004 non-agency half (rule at VD5, evidence VD16); F12 AC-CALC-001 management aspect (accrues VD11); F13 Not-Entered unreachable single-leg (VD9); F14 AC-BACK-001 artifact coverage grows VD7/13/17. F1/F2/F3 are resolved by decision 14.

## 3. Process conventions the user has set

- Per-VD working files are the living work orders; the frozen plan file is not edited during implementation. Progress tables (task → status → evidence) are maintained as tasks complete; red and green commands + outcomes are recorded per `it should ...` case.
- VD7+ breakdowns are drafted just-in-time on request — do not draft them in this session.
- Cumulative unit + mock-free integration suites protect previously accepted deliverables; the fresh browser-critic gate (new critic agent per attempt, never self-certified) closes each VD.
- Commit at least per completed task with the task ID in the message (e.g. `feat(vd1): T9 assessPlan green`); push when the user asks or at session milestones. The user has an established preference for direct add/commit/push without preliminary status inspection once they've asked for it.
- Persistent memory (auto-loaded) carries session state; keep it current as milestones complete (the user clears context between phases).

## 4. Read-first list

1. `AGENTS.md` (Karpathy guidelines — loaded automatically).
2. `plan/implementation-plan.md` — header decisions 1–14, §VD1, scope-discipline and parallelism sections.
3. `plan/VD1-workspace-and-first-plan.md` — the VD1 work order (note: T12/T18 removed by decision 14b; T9 target rule per 14a; T21 is loopback-only per 14c).
4. `specs/README.md`, `glossary.md`, `design/overview.md`, then the contracts VD1 touches: `workspace`, `reference-catalog`, `journal`, `trade-record`, `trade-workflows`, `trade-analysis`, `ui-contract`, `delivery-contract`; then `acceptance/acceptance-contract.md` and `evaluation/planning-protocol.md` + `evaluation/kickoff-prompt.md`.
5. Memory index (auto-loaded) — `zcode-glm-5.3-worktree` holds full session state.

## 5. Environment facts

- Dev port **5176** via gitignored `.env.local` (`DEV_PORT=5176`); Vite `strictPort`, host `127.0.0.1` (never 5173 — that is the main checkout's); Playwright `baseURL`/`webServer.url` read the same `DEV_PORT`. `localhost` resolves to IPv6 `::1` only on this host — always bind `127.0.0.1`.
- Host quirks from prior work, to **re-verify against Vite 8 in VD1 T1** rather than assume: `vite-preview` sends `Vary: Origin` (use `ignoreVary` on digest-verified caches); never put glob-like class patterns inside CSS comments; Playwright `context.route` intercepts SW-initiated fetches but not the SW script fetch itself; an installing SW's `clients.matchAll()` is empty, so update notices are page-side; RTL auto-cleanup needs Vitest `globals: true`.
- Node-side tests use `fake-indexeddb` (disclosed test infrastructure); browser evidence runs in the Playwright-managed Chromium (`127.0.0.1` is a recognized secure context there).

## 6. Definition of done for this session

1. `plan/acceptance-evidence-matrix.md` exists, linked from the plan, one row per acceptance scenario, reviewed with the user.
2. Open flags adjudicated and recorded in the per-VD files; plan header carries the freeze record (revision/digest, stack, approval line) and its Status line says FROZEN.
3. VD1 complete per its working file: every task's evidence recorded in the progress table, cumulative unit + integration suites green, fresh browser-critic pass (with repair loop if needed), Installed Capability Manifest honest.
4. All work committed on `zcode-glm-5.3` (pushed if the user asks), memory updated, and VD2's working file presented for review before VD2 begins (JIT convention).
