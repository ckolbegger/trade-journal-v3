# Handoff to Claude Code — `claude-opus-5.5`

Written 2026-10-10 at the end of the planning session. Read this first, then the files it points to.

## Where things stand

- **Worktree:** `~/src/trade-journal-v3/worktrees/claude-opus-5.5`, branch `claude-opus-5.5`, dev port 5175 (`.env.local`).
- **Specification:** `specs/` is the frozen product baseline. It was amended on `main` (commit `968bc2b`) by ADR 0009 (storage protection is a warning, not a write gate) and ADR 0010 (backup is a download verified by reading the saved file back). Treat `specs/` as read-only.
- **Plan:** `plan/implementation-plan.md` (Draft 2) plus `plan/deliverables/D1`–`D4`. Planning-protocol Phases 1–2 are done; Phase 3 is drafted for D1–D4; D5–D12 are an outline only, detailed just before each starts (decision PD-005).
- **Nothing is implemented.** There is no `package.json` yet.

## Rules that apply to all work

- Follow `CLAUDE.md` and `specs/evaluation/planning-protocol.md`.
- Test-driven development for every behavior task: one `it should …` case at a time, red then green, recorded in `plan/evidence/D<n>.md` (plan §5).
- Never commit without the user's explicit approval. Stage, show what changed, and ask.
- Do not look at any other worktree (`claude`, `codex`, `codex-gpt-6.1-sol`, `glm`, `qwen3.8-27B`); this is an independent implementation.
- Data safety (PD-002): tests run only in temporary browser profiles; never open a real browser profile; dev servers never hold real data.
- The user's preferred languages are strongly typed; the plan uses TypeScript 6.0.3 (TypeScript 7 is blocked by `typescript-eslint`).

## Before implementation can start

Resolve plan §7 with the user, one question at a time, recording each answer in the plan:

1. Approve the market calendar proposal (PD-006).
2. Choose hosting: Cloudflare Pages or Netlify (recommended; per-branch HTTPS addresses), a separate repository, or GitHub Pages for this branch only.
3. Decide whether to add a non-mutating Plan preview operation to the spec (would be a `main` spec change, like ADR 0009/0010, merged to `main` and picked up by other branches themselves).
4. Confirm or correct the four interpretations (Entry Quality comparison, Debt due time, Addendum type, Void scope).
5. Confirm React Router 8.

Then re-check pinned versions (they were current on 2026-10-10), mark the plan approved with its commit as the frozen revision (protocol Phase 6), and begin D1 at task T1.1.

## Notes from the planning session

- Verify early (T1.1) that Playwright's Chromium installs and runs on this machine, and that Vitest browser mode works with `@vitest/browser-playwright` 5.0.3.
- E1.4 relies on Chrome DevTools Protocol `Storage.overrideQuotaForOrigin` for the capacity case; confirm it works before relying on it, and disclose any fault-injection script.
- The critic gate needs a fresh subagent that can build, start, and drive the app in a browser; if that is not possible, stop and tell the user rather than self-certifying.
