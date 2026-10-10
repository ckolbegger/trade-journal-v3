# Handoff to Claude Code — `claude-opus-5.5`

Updated 2026-10-10 at the end of the plan-review session. Read this first, then the files it points to. The next session starts D1.

## Where things stand

- **Worktree:** `~/src/trade-journal-v3/worktrees/claude-opus-5.5`, branch `claude-opus-5.5` (tracks `origin/claude-opus-5.5`), dev port 5175 (`.env.local`).
- **Development machine:** Mac, macOS 26.6.2, arm64, Node 26.0.0.
- **Specification:** `specs/` is the frozen product baseline, including ADR 0009 and ADR 0010 (commit `968bc2b` on `main`). Treat `specs/` as read-only on this branch.
- **Plan:** approved and frozen at commit `b9ef959`, with amendments A1–A3 approved and committed in `8513db0`. Read `plan/implementation-plan.md` in full, then `plan/deliverables/D1-workspace.md`. The plan files are the source of truth; nothing from the review conversation is needed beyond what they record.
- **Nothing is implemented.** There is no `package.json` yet.

## Decisions made in the review session (all recorded in the plan)

- PD-006: XNYS market calendar generated from `exchange_calendars`, 2000–2028.
- PD-007: hosting on Cloudflare Pages, deployed from GitHub Actions with Wrangler.
- PD-008: add a non-mutating `previewPlan` operation (ADR 0011, a `main` spec change). Blocks D2.
- PD-009: deferred reflection Debt is due in the next session's Daily Review after deferral; at most 3 deferrals, then answer only (ADR 0012, a `main` spec change). Blocks D3, and moves the calendar data file into D3.
- PD-010: Addenda moved from D4 to a new final deliverable, D13.
- React Router 8 confirmed; Entry Quality ratio comparison and D4 Void scope confirmed.
- A1: integration, end-to-end, and production-smoke tests are written just in time, at the start of the first task in their **Green after** column, recorded red, then recorded green when the last of those tasks completes.
- A2: per-scenario acceptance evidence through `recordAcceptanceEvidence` (task T1.19) and `npm run evidence:acceptance`.
- A3: release tooling lives in `tools/release/`, because `.gitignore` excludes `build/`.

## Rules that apply to all work

- Follow `CLAUDE.md` and `specs/evaluation/planning-protocol.md`.
- Test-driven development for every behavior task: one `it should …` case at a time, red then green, recorded in `plan/evidence/D<n>.md` (the "Red/green evidence" and "Outer tests" rules in section 5 of the implementation plan).
- Never commit without the user's explicit approval. Stage, show what changed, and ask. Proposed cadence: one commit per completed task.
- Plan changes need the user's explicit approval and are logged in the amendments table in section 9 of the implementation plan. A spec or plan ambiguity pauses work for the user.
- Do not look at any other worktree (`claude`, `codex`, `codex-gpt-6.1-sol`, `glm`, `qwen3.8-27B`); this is an independent implementation.
- Data safety (PD-002): tests run only in temporary browser profiles; never open a real browser profile; dev servers never hold real data.
- When talking to the user, refer to document sections in words ("section 5 of the implementation plan"), not with the § symbol.

## How to work in the implementation session

- **Implement inline** in the main session: write each test, run that single test to see red, make the change, run it to see green. Keep these targeted runs small so their output stays short.
- **Full test runs go to a subagent.** At the end of each task (before asking to commit) and at the deliverable completion gate, launch a fresh subagent to run the full checks: `npm run check`, then `npm run test:all` (and `npm run evidence:acceptance` at the gate). Instruct it to return only a short report:
  - each command, its exit status, and pass, fail, and skip counts per test layer;
  - for each failure: the test file and name, and the first few lines of the error;
  - the Chromium and Playwright versions used (evidence provenance);
  - no full logs.
  The subagent must not edit files. Record its summary in `plan/evidence/D<n>.md`. If it reports a failure, fix it inline (failing test first if it is an implementation defect) and run the subagent again.
- **Critic gate:** a separate fresh subagent, as section 5 of the implementation plan describes. It builds and starts the app itself and drives the critic flows in a temporary browser profile. If a subagent cannot do this, stop and tell the user rather than self-certifying.
- Subagents run one at a time, never in parallel: they share this worktree.

## Start here: D1

1. **T1.1 Project scaffold.** Verify early that Playwright's Chromium installs and runs on this Mac and that Vitest browser mode works with `@vitest/browser-playwright` 5.0.3. Re-check the pinned versions in section 2 of the implementation plan if a day or more has passed since 2026-10-10.
2. **T1.19 Acceptance evidence recorder**, so every outer test can record evidence from its first run.
3. **T1.2 onward** in dependency order, writing each integration or end-to-end test at the start of the first task in its **Green after** column.

## Prerequisites still open

- **Before T1.18 (deployment):** the user creates the Cloudflare account and Pages project, an API token, and the `CLOUDFLARE_API_TOKEN` and `CLOUDFLARE_ACCOUNT_ID` repository secrets. Ask when T1.18 comes up; never handle the credentials yourself.
- **Before D2:** ADR 0011 (`previewPlan`) drafted for the user's review and merged into `main`.
- **Before D3:** ADR 0012 (Debt deferral) drafted for the user's review and merged into `main`.

## Notes

- E1.4 relies on Chrome DevTools Protocol `Storage.overrideQuotaForOrigin` for the capacity case; confirm it works before relying on it, and disclose any fault-injection script.
