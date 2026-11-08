# Briefing a browser critic

Every critic run is a fresh `general-purpose` agent, spawned by the main session at a deliverable's gate. Write its brief from the sections below. Replace `<nn>`, `<n>` and the flow IDs.

## Why the brief offers setup helpers (decided 2026-10-24)

Before this rule, each critic wrote its own Playwright plumbing from scratch, which made the setup cost the same on every run. D2's critic-1 used 141,559 tokens, 44 tool calls and 9 min 18 s, and most of that went on launching, onboarding, confirming Plans and reading IndexedDB.

The brief now points the critic at the browser suite's support modules **for setup and stored-state reads only**. The critic still drives and judges each flow's own steps by hand. Committed critic scripts are never replayed, because a replayed script checks only what it checked last time. That is the browser suite's job, and the critic exists to look again.

## Brief template

> You are a **fresh browser critic** for deliverable D<nn>, "<title>". The repository is `<worktree path>`, a git worktree. Work only inside it, and never look at other worktrees or branches.
>
> **Do not edit code, tests, plan, specs or evidence, and make no commits.** Put scratch scripts and screenshots under `test-results/critic-d<nn>-<n>/`, which is git-ignored.
>
> **Inputs**
>
> - The frozen `specs/` are the source of truth for behavior; search them as needed.
> - Read the plan index, `plan/implementation-plan.md`, and the breakdowns of every delivered deliverable.
> - **Section 7 of the D<nn> breakdown, "Browser-critic flows", is your test script.** Run every flow and judge it against its pass condition and the specs. Also check the narrow layout (375 px and 320 px) of every screen this deliverable adds or changes.
> - **Future capabilities are not defects:** <list from the breakdown's section 7>.
>
> **How to run**
>
> - Build and start the servers yourself. Use the commands named in the breakdown's section 7 and in `package.json`: production preview, release harness, faults build. Stop every server you started.
> - Drive the real UI in Chromium with Playwright.
>
> **Setup helpers.** Use the browser suite's support modules for setup and stored-state reads so your effort goes into the flows:
> - `e2e/d<nn>/support.ts` re-exports `e2e/d1/support.ts`.
> - They import cleanly from a plain Node script run at the repo root, for example `const s = await import('<worktree>/e2e/d<nn>/support.ts')`.
> - Useful exports: <list the current ones, e.g. `profileAt(dir).launch({ width, offline })` (a persistent Chromium on `localhost:5175` in America/New_York), `firstPage`, `onboard`, `onboardedPage`, `fillPlan`/`confirmPlan`, `confirmReference`, `openEntryForm`, `fillRows`, `completeReflection`, `declineReflection`, `recordEntry`, `openTradeFromOpenList`, `probe`/`tradesOf`/`factsOf`/`reflectionEntriesOf`/`rootOf`/`workspaceNames`, `onboardedD1Page`, `confirmD1Plan`, `checkForUpdate`, `reloadFromNotice`, `writeIntegrityFixture`, `expectAccessible`>.
>
> Rules for the helpers:
> - Use them only to reach a flow's starting state, or to read stored state as evidence.
> - **Perform and observe every action a flow's "Actions" column names yourself,** by role and label, the way a user would.
> - Judge the screen yourself, never from a helper's return value.
> - A helper that fails is itself an observation: report it.
>
> **Report.** Write the full report to `test-results/critic-d<nn>-<n>/report.md`, then send the same text as your final message. It has these four parts:
> 1. **Header:** date and time, commit, Node and Chromium versions, servers used, and confirmation that no tracked file was edited.
> 2. **Results table:** Flow | PASS/FAIL | key observations, with exact on-screen text and figures.
> 3. **Overall** PASS or FAIL, with numbered **Defects**. Each defect gives steps, expected (cite the spec or plan line), actual, and severity (high, moderate or low, defined below).
> 4. **Minor observations.**
>
> A defect is a failed pass condition or a clear contradiction of `specs/`. Be rigorous and skeptical, and report only what you observed in the browser.
>
> Give each defect exactly one **severity**:
> - **High:** a flow fails its pass condition. Data is lost or wrong, a figure is wrong, or the trader can't finish the task.
> - **Moderate:** the flow passes, but something misleads or hides information. For example: wording that misstates what happened, a layout that makes a figure misreadable, or an accessibility failure.
> - **Low:** cosmetic or polish. Nothing is misread and nothing is lost.

## After each critic

- Copy the critic's `test-results/critic-d<nn>-<n>/report.md` to `evidence/D<nn>/critic-<n>.md` with `cp`, never by retyping it (D7 retro, finding 4). If the file is missing, SendMessage the critic to write it.
- Add a row to the deliverable's critic-cost table in `evidence/D<nn>/structural.md`. Take the token, tool-call and duration figures from the completion notice, and give the brief version and whether the critic found defects.
- **Fix every defect, whatever its severity, before the gate closes** (D7 retro, finding 1; the user's rule, 2026-11-08). Each defect is its own bug task, `<gate task>-B<n>`, run one at a time:
  1. A fresh `tdd-task` subagent writes the failing test first, then the fix. Its brief names the browser spec files that cover the screens the defect touches, and the subagent runs them after its green.
  2. `ocr-review` runs on the fix's commit, as for any bug task.
  3. `suite-runner` makes the quick run with the browser stage `browser-task`: unit, integration, the static and verify checks, and the task tier.
- **After the last fix**, one full run (`browser-full`), then by the worst severity the critic reported:
  - **PASS with only low defects:** the full run closes the gate. No new critic.
  - **FAIL, or any high or moderate defect:** spawn a fresh critic after the full run.
  - **PASS with no defects:** the gate closes on that critic, since the full run before it stands. No fixes are needed.
- **Cap:** if the third critic still reports a high or moderate defect, stop and ask the user.

