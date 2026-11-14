# D08P retrospective

Source: the user's retrospective of the Trade Detail refactor (D08P), 2026-11-14. It reviewed the implementation session `080f089b-4413-4842-ac2b-aec7f7178d04` (2026-11-12 23:44 to 2026-11-14 11:05), [structural.md](structural.md), [final-report.md](final-report.md), the critic reports, and the agent environment: `.claude/agents/`, `.claude/docs/`, `.claude/settings.json` and ocr's file selection.

D08P passed its gate after about 25 hours of working time, against a swarm estimate of 9 to 10.5. The findings below are about the environment, not the product. They are ordered by severity. Findings 1, 2 and 5 are fixed; finding 6 is partly resolved; the rest are open.

## 1. **FIXED** ~~`build:releases` was blocked for agents, though it is on the allow list (permissions)~~

~~**What happened.** The auto-mode classifier refused `npm run build:releases` to T8P.23-B14's agent twice. The user had to decide ("Main session builds for it"), and from then on every brief and bug-task message carried a workaround, with the suite runner doing the release build. Earlier, a stale `dist-releases` made T8P.23-B4's agent report it "can't make red", which cost a round. A gate bug-task agent also hit B6.6 against stale release builds.~~

~~**Sources:** structural.md, "T8P.23-B14", "T8P.23-B4" and "T8P.26-B2".~~

~~**Likely cause.** `.claude/settings.json` allows exactly `Bash(npm run build:releases)`. Agents run it chained as `npm run build && npm run build:faults && npm run build:releases`, and plain `npm run build` is not on the list, so the whole command falls to the classifier.~~

~~**Proposed fix.** Add a `build:all` script and allow `Bash(npm run build:all)`, or allow `Bash(npm run build)` beside the other two. Then remove the workaround from the bug-task rules and `tdd-task.md`'s rebuild line. Verify with one agent run before relying on it.~~

~~**Applied** (`7d7d8f32`).~~
- ~~`package.json` gains `build:all` (`npm run build && npm run build:faults && npm run build:releases`).~~
- ~~`.claude/settings.json` allows `Bash(npm run build:all)` and `Bash(npm run build)`, so the chained form is allowed in every part too.~~
- ~~`tdd-task.md`'s rebuild line names `build:releases` and `build:all`.~~
- ~~The bug-task rules lived only in the session's scratchpad; future briefs drop the workaround.~~

~~**Verified.** A fresh `general-purpose` subagent ran `npm run build:all` and the chained form. Both ran without a refusal and exited 0. One run is not proof against a classifier that refused only some of the time before: if a refusal comes back, report it to the user rather than working around it.~~

## 2. **FIXED** ~~The critic-report step in `critic-brief.md` never works (stale guidance)~~

~~**What happened.** The brief tells the critic to write `test-results/critic-d<nn>-<n>/report.md`, and "After each critic" says to `cp` it, or SendMessage the critic if it is missing. The harness refuses report files from subagents, so the write failed for all 6 D08P critics and all 3 in D7S. Each time, the main session extracted the report from the session transcript with a script written to the scratchpad, which disappears with the session.~~

~~**Sources:** critic-1.md to critic-6.md (each opens with the refusal); D7S final report, "Critics".~~

~~**Proposed fix.**~~
- ~~Commit the extractor as `.claude/scripts/agent-report.mjs <transcript> <heading>`. It scans the transcript's JSON lines for the agent message containing the heading and prints the report, unindented.~~
- ~~In the brief, the critic sends its report only as its final message, under a fixed heading such as `# D<nn> critic-<n> report`.~~
- ~~"After each critic" runs the script, in place of the `cp`-or-SendMessage line.~~

~~**Applied** (`8cb6a970`).~~
- ~~The extractor is `tools/agent-report.ts`, not `.claude/scripts/`, because the pre-commit lint covers every file and the TypeScript project includes `tools/` but not `.claude/scripts/`.~~
- ~~Its transcript argument is optional. Without it, it reads the newest `.jsonl` in this project's `~/.claude/projects/` folder, which is the current session.~~
- ~~`critic-brief.md`: the critic sends its report only as its final message, starting with `# D<nn> critic-<n> report`. "After each critic" saves it with `node tools/agent-report.ts "# D<nn> critic-<n> report" > evidence/D<nn>/critic-<n>.md`.~~

~~**Verified.** Run on this session's transcript, it reproduced `critic-5.md` and `critic-6.md` byte for byte. It exits 1 for a heading no agent message holds, and it passes lint and typecheck.~~

## 3. No automated check for content hidden inside a scroll box (automated checks)

**What happened.** Three of critic-4's four defects were this kind: the Payoff chart's "Now" legend (T8P.26-B1), Lot Matches' Realized column at 1280 px (B2), and row labels clipped at 320 px (B4). So was critic-3's defect 2 (T8P.23-B14). B8P.5 checks only that the page itself doesn't scroll sideways. Each fix added its own spec: `payoff-fit`, `lot-matches-fit`, `today-narrow`.

**Cost.** Each critic round took about 10 minutes and 200k tokens, plus a bug-fix cycle per defect.

**Proposed fix.** One generic sweep in `e2e/d8p/responsive-a11y.spec.ts` over every drawer of every state:
- at 1280 px, every scroll box has scrollWidth no larger than clientWidth;
- at 375 and 320 px, every scroll box can scroll, and its first and last columns can be reached.

The rule is mechanical, so it belongs in a test, not a coding standard. A `tdd-task` agent writes it.

## 4. No automated check for focus after a keyboard action (automated checks)

**What happened.** Critic-6's defect: Journal paging disables the pressed button at either end, and focus falls to the page body. axe can't see it, because it checks a static page. It is now tech debt item 24 (revision 100).

**Proposed fix.** In B8P.5's keyboard case, press every enabled button in each drawer by keyboard and assert focus never lands on `BODY`. This also guards item 24's fix when it comes.

## 5. **FIXED** ~~ocr skipped `*.spec.ts`, so every test review needed a relocated copy (tool economy)~~

~~**What happened.** ocr's default rule excludes test paths (`default_path`). Every test-bearing commit (T8P.25, T8P.26-B1, B2, B2-B1, B3, B4 and B5) needed the clone-and-relocate procedure in `ocr-review.md`, 10 to 17 tool calls each. Most returned the same dismissed "not discovered by Playwright" row.~~

~~**Applied in `1b876348`.** `.claude/ocr-rule.json` includes `e2e/**/*.spec.ts`, `**/*.test.ts` and `**/*.test.tsx` and excludes `evidence/**`, and `ocr-review.md` passes it on every review, in place. The relocation procedure is gone.~~

~~**Verified.**~~
- ~~A preview of T8P.25's commit selects all four specs and `support.ts` (before: only `support.ts`).~~
- ~~A preview of B3's range reviews the source, unit test and spec, with evidence files marked `user_exclude`.~~
- ~~A real in-place review of `c4319845` reviewed `lot-matches-fit.spec.ts` in 13 s with 0 findings, the same as its relocated review. `git status` was unchanged.~~

## 6. Briefs repeated what the agent definitions say (duplication). Partly resolved by 5.

**What happened.**
- **ocr briefs** repeated the relocation steps and a scratch-clone rule: work only in scratch clones, give git an explicit `-C`, check status by path name. That rule came from one incident: T8P.29's reviewer had a relocation command blocked, and its `git add -A; git commit` landed in the main worktree (structural.md, "Stray commits on `claude-opus-5.5`"). An in-place review only reads, so with relocation retired the rule has no purpose and is dropped.
- **Suite-runner briefs** repeated "one stage at a time", the port checks and the browser lock, all of which `suite-runner.md` holds.

**Remaining fix.** Keep briefs to the task's specifics: inputs, scope and stop rules.

## 7. `critic-brief.md`'s bug-fix cadence differs from the gate's practice (stale guidance)

**What happened.** The doc asks for a quick run after each critic bug fix, then a full run after the last. At the gate, B1 to B4 were batched: each had its own ocr review, then one full tier served both as their run and as the full tier before the next critic. This was recorded as an implementation-level decision.

**Proposed fix.** If batching is the norm, write it into "After each critic". Otherwise the doc stands.

## 8. A test that always fails sits in the suite (automated checks)

**What happened.** B6.6 (`e2e/d6/update.spec.ts:9`) expects About's schema "5" and reads "7". It can't pass without a `d6` release build, which decision 76 rules out. It is excluded from the normal runs by its `@release-history` tag, but a bug-task agent and the main session's extra run each spent a cycle on it.

**Proposed fix.** Mark it `test.fixme` with the reason (decision 76, tech debt item 10), so the reason sits next to the test.

## 9. A pointer to a spec-reading list that doesn't exist (navigation)

**What happened.** T8P.25's brief pointed to `plan/spec-reading/D08P.md`, which was never written. D08P's reading list is `plan/spec-reading/D07.md` plus D9's entries (A218). The agent noticed and read the plan sections directly.

**Proposed fix.** `implementing.md` says to use the breakdown's own spec-reading row when no `Dnn.md` exists, or each breakdown names its list.
