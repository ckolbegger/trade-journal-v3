# Karpathy Guidelines

Behavioral guidelines to reduce common LLM coding mistakes, derived from [Andrej Karpathy's observations](https://x.com/karpathy/status/2015883857489522876) on LLM coding pitfalls.

**Tradeoff:** These guidelines bias toward caution over speed. For trivial tasks, use judgment.

## 1. Think Before Coding

**Don't assume. Don't hide confusion. Surface tradeoffs.**

Before implementing:
- State your assumptions explicitly. If uncertain, ask.
- If multiple interpretations exist, present them - don't pick silently.
- If a simpler approach exists, say so. Push back when warranted.
- If something is unclear, stop. Name what's confusing. Ask.

## 2. Simplicity First

**Minimum code that solves the problem. Nothing speculative.**

- No features beyond what was asked.
- No abstractions for single-use code.
- No "flexibility" or "configurability" that wasn't requested.
- No error handling for impossible scenarios.
- If you write 200 lines and it could be 50, rewrite it.

Ask yourself: "Would a senior engineer say this is overcomplicated?" If yes, simplify.

## 3. Surgical Changes

**Touch only what you must. Clean up only your own mess.**

When editing existing code:
- Don't "improve" adjacent code, comments, or formatting.
- Don't refactor things that aren't broken.
- Match existing style, even if you'd do it differently.
- If you notice unrelated dead code, mention it - don't delete it.

When your changes create orphans:
- Remove imports/variables/functions that YOUR changes made unused.
- Don't remove pre-existing dead code unless asked.

The test: Every changed line should trace directly to the user's request.

## 4. Goal-Driven Execution

**Define success criteria. Loop until verified.**

Transform tasks into verifiable goals:
- "Add validation" → "Write tests for invalid inputs, then make them pass"
- "Fix the bug" → "Write a test that reproduces it, then make it pass"
- "Refactor X" → "Ensure tests pass before and after"

For multi-step tasks, state a brief plan:
```
1. [Step] → verify: [check]
2. [Step] → verify: [check]
3. [Step] → verify: [check]
```

Strong success criteria let you loop independently. Weak criteria ("make it work") require constant clarification.

## 5. Surface Better Alternatives

I'm always open to ideas on better ways to do things. Please don't hesitate to suggest a better way, or one that has long lasting impact over a tactical change.

# Project tooling

- **Complete cumulative suite runs go to the `suite-runner` subagent** (`.claude/agents/suite-runner.md`), never the main session. Give it the evidence directory and a run label, then record its returned table in `structural.md`. Do not rerun the suites to check its work. A failing run comes back as named failures; reproduce and fix them in the main session.
- **Start-of-deliverable reading is scoped, to keep the context small** (plan decision 45).
  - For `specs/`, read the ranges listed in `plan/spec-reading/D<nn>.md`. Don't read the whole `plan/spec-map.md`: search it for any other section the work touches, and read that section before building on it.
  - Read the current deliverable's breakdown in full.

  From the rest of the frozen plan, read only what the deliverable uses:
  - `implementation-plan.md` without the definition sections of deliverables later than the current one
  - the acceptance matrix's opening sections only, looking up other rows by scenario ID when needed
  - only the sections of earlier breakdowns that the current one builds on (decisions, boundaries, task graph, structural tasks, harnesses), never their behavioral task text

  When writing the next deliverable's handoff, give its reading list in this form, naming the sections to read. Drafting a breakdown still reads `specs/` in full, and retags its deliverable in the map before regenerating the lists with `.claude/scripts/spec-reading-lists.py`.
- **Run every TDD red and green with `.claude/scripts/tdd.sh red|green <task> <test file> "<test name>"`**, never with a hand-written `vitest` command. It runs the one case, prints one summary line, and appends the row to `evidence/D<nn>/tdd-log.md`, taking `<nn>` from the task ID (T2.2 → D02).
  - Run it as a command on its own. When it is chained with another `vitest` command, the output-filter hook replaces its summary line.
  - Start a new deliverable's `tdd-log.md` first, with a note that its rows are single-case runs. The helper refuses to run without it.
  - Avoid parentheses and quotes in test names, which break `-t` filtering.
  - It writes only red and green rows. Append first-run-pass notes, user decisions, and the refactor row to the log yourself.
- Single-case TDD runs stay in the main session. A PreToolUse hook (`.claude/hooks/filter-test-output.sh`) cuts their output to failures and the summary and saves the full log; put `CLAUDE_FULL_OUTPUT=1` in a command to see everything.
