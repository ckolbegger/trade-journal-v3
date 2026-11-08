# D7 retrospective (2026-11-08)

Covers the session from T7.29-B12 to the D7 push. Findings are ordered by severity. None is applied yet; each waits for the user's choice.

## 1. The critic gate has no stopping point for minor defects

- **What happened:** critics 1, 2 and 3 each reported PASS with one or two new minor or low defects. `plan/D07-handoff.md` (the browser-critic gate, step 4) says to fix them, rerun the suites and spawn another fresh critic, so the cycle ended only when the user said "Don't do a fourth critic run. It's time to move on."
- **Cost:** 640,000 critic tokens (189,339 + 232,137 + 218,395) and about 41 minutes of critic time, plus a fix, an ocr review and a 9-minute full-tier run per round.
- **Proposed change:** in `.claude/docs/critic-brief.md` ("After each critic") and the handoff template's gate steps: a PASS whose defects are all minor or low has them fixed, followed by a full-tier run, and the gate closes. A new critic runs only after a failed flow or a moderate (or worse) defect. The wording is the user's to set.

## 2. Notes for later tasks are buried in one 19,500-character table cell

- **What happened:** critic 1's main defect (option Trade Terminal Disposition in "shares", T7.32-B1) was noted after T7.5: "For the UI tasks: `closedViaSale` and the list's 'Closed via sale' are stock-only." The note sat inside the handoff's "Tasks done" cell, which mixes commit history with warnings meant for later tasks. It never reached the briefs for the exit receipt or the owed card.
- **Cost:** a known gap reached the gate. Reading the cell also costs about 5,000 tokens each time.
- **Proposed change:** split the handoff's progress section into a short "Tasks done" list and a "Notes for later tasks" list, one bullet per target task. In `.claude/docs/implementing.md`, add a step: before each brief, copy the notes addressed to that task into the brief, then strike them from the list.

## 3. Nobody checked the acceptance-row commands until the end

- **What happened:** AC-POS-004's `npm run test:integration -- d7/close-review` and AC-RESP-001's `d7/responses` match no test file. That only came out when each row's command was run after the tag, so both rows stay `planned`.
- **Proposed change:** add a script, `.claude/scripts/acceptance-commands.sh <breakdown>`. It extracts the backticked commands from the breakdown's acceptance table and runs each in list mode (`vitest list`, `playwright test --list`), failing on any command that matches zero tests. Call it from `.claude/docs/drafting-breakdowns.md` when a breakdown is written, and from the gate before the first critic.

## 4. Critic reports are copied into the evidence by retyping them

- **What happened:** each critic report arrives only as a message, so the main session saved `critic-1.md` to `critic-3.md` by writing their full text out again, about 6,000 to 8,000 output tokens each. A script to extract a report from the transcript was rightly blocked by `guard-shell-writes.sh`.
- **Proposed change:** in `.claude/docs/critic-brief.md`, the critic also writes its report to `test-results/critic-d<nn>-<n>/report.md`. The main session then copies it into `evidence/` with `cp`, which the hook already allows.

## 5. The plan's revision history sits in one 19,600-character table cell

- **What happened:** the "Immutable revision" cell in `plan/implementation-plan.md` (line 122) holds every revision from 5 to 68. Every session reads it at the start, and each revision makes it longer.
- **Proposed change:** move revisions 5 to 67 into `plan/revisions.md`, leave the current revision and a pointer to that file in the cell, and add each later revision to that file.

## 6. The chart-layout fixes were checked only on the charts that failed

- **What happened:** B2's browser spec (`e2e/d7/payoff-chart-layout.spec.ts`) checked label overlap on two Planned charts only. ocr then found three more problems (B3 to B5) on the Current chart's latest-close label and on crowded tick rows, and critic 3 still saw labels touching the curve. The layout depends on estimated text widths (7.5 px per character).
- **Proposed change:** add an `expectNoTextOverlap(chart)` helper in `e2e/d7/support.ts`, using real rendered text boxes. Apply it to every payoff state the suite already builds (Planned, Current with a latest close, the short Put, Settlement Due), not only the states that failed.

## 7. No commit hook or CI job

- **What happened:** the repository has no `.github/workflows` and no git hooks. Typecheck and lint run only when a subagent remembers to, or in the cumulative run. Nothing went wrong in this session because of it.
- **Proposed change:** a pre-commit hook that runs `npm run typecheck && npm run lint` when staged files include `src/`.
- **Applied 2026-11-08, at the user's direction** ("Not running a typecheck and lint is a serious violation of code hygiene"). `.githooks/pre-commit` runs `npm run typecheck` (about 0.6 s), then `npm run lint` (about 12 s), whenever the commit stages a `.ts`, `.tsx`, `.js`, `.mjs` or `.cjs` file, `package.json`, `package-lock.json` or a `tsconfig*.json`; it refuses the commit if either fails. It is enabled for this worktree only (`extensions.worktreeConfig` on, `git config --worktree core.hooksPath .githooks`), because `.git/hooks` is shared by every worktree. Verified on a scratch index: a docs-only commit skips the checks, a code commit runs both and passes, and a failing typecheck or lint (simulated with a fake `npm`) refuses with exit 1. The next handoff's location checks confirm `git rev-parse --git-path hooks` prints `.githooks` (`implementing.md`).
- **Bypass blocked, at the user's direction:** `.claude/hooks/guard-shell-writes.sh` (the PreToolUse Bash guard, which also covers subagents) refuses, in the project's own repository, `git commit --no-verify` and its unambiguous prefixes, `-n` alone or in a short-option cluster (quoted words such as a `-m` message are not read as options), `git -c core.hooksPath=...`, and `git config` writes to `core.hooksPath` (a value, `set`, `unset`, `--unset`, `--replace-all`, `--add`, or removing or renaming the `core` section). Reads (`git config --get`, `git config get`) and commits in scratch clones outside the project stay allowed. The first version read each line of a multi-line commit message as a command and refused its own commit, whose message has a line starting "git config writes to core.hooksPath"; the guard now reads lines that start inside a quote or a heredoc body as text (a character scanner tracks `"` and `'` across lines, so an apostrophe inside a double-quoted message is handled), which also removes the same false positive from the older HEAD rule. Verified by a 43-case table (deny and allow cases, including messages that mention `-n` and `--no-verify`, that multi-line message, heredoc bodies, a bypass chained after a closed multi-line message or after "it's" in a message, `-uno`, `-mnothing` and the guard's earlier HEAD and `sed -i` rules): 43 of 43. The live guard also refused the first attempt to run that table inline, since one case line chains `&& git commit --no-verify`. Known limits, as for the guard's other rules: env prefixes (`GIT_CONFIG_KEY_0=core.hooksPath`), `--config-env` and aliases are not looked into.

## Not findings

- **`CLAUDE.md`** is small (about 3,000 characters).
- **Earlier problems already have fixes:** the ocr-only rule (`implementing.md`, 2026-11-08) and the two-stage full browser tier (decision 98) address this session's bug-task inflation and the 10-minute Bash limit.
- **The guard hook's two refusals** (an inline Python write and an in-place `sed`) were the hook working as intended.
