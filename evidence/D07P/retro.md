# D7 prefactor retrospective

Source: the user's retrospective of the D7 prefactor, 2026-11-06. It reviewed the implementation session `174d22d2-9e6a-48f5-873b-26bef5246c56` (2026-11-05 02:40 to 2026-11-06 08:39), its 114 subagent transcripts, and [structural.md](structural.md). Findings are ordered by severity. Each one gets its own section here, with its bug tasks, once the user chooses a fix. **The user chose fixes for findings 1, 2 and 3 (2026-11-06) and judged findings 4 to 7 not significant enough to act on**; see "Chosen fixes" at the end.

The prefactor finished and its gate passed, but it took about 30 hours of wall time. Most of that was not implementation:
- **Two waits for the user's answers:** 06:50 to 18:16 (decision 79) and 18:32 to 01:07 (decision 80). Both questions came from gaps in the breakdown (finding 2).
- **About 2 hours** at T7P.1, waiting for an expired `ocr` sign-in (finding 3).
- **T7P.9** ran to twelve bug tasks across four ocr rounds (finding 1).

## 1. `verify:wording` was built as a hand-written scanner, not a lint rule (automated checks)

**What happened.** P74 specified a new script under `tools/`. Its first version scanned line by line with regexes, and each ocr round found another syntax edge it got wrong:
- comparisons split across lines (B1);
- `//` inside strings (B2);
- template `${}` blocks (B5);
- apostrophes in JSX text (B6);
- `as const` wrappers (B10);
- escapes (B11).

B4 switched it to the TypeScript parser, and two more rounds followed. The result is 356 lines (`tools/wording-scan.ts`, `tools/wording-scan.test.ts`, `tools/verify-wording.ts`) with one known bug still open (tech debt item 12). The third round also stopped the session for the user (stop condition 6).

**Sources:** structural.md, "T7P.9 verify:wording" through "T7P.9-B12".

**Why it was avoidable.** The rule is mechanical: certain literals and certain `case` or `===` branches are banned outside one file. The repo already enforces rules of that shape with ESLint's `no-restricted-syntax` and AST selectors, in `eslint.deps.config.js` (`noIdentityRules`, `domainPurityRules`). ESLint's parser already handles strings, templates, JSX text, comments and line numbers, which is where every bug task came from.

**Proposed fix.**
- **(a)** Replace the scanner with a `wordingRules` block in `eslint.deps.config.js`. It applies to `src/ui/**`, ignores `calculation-words.ts` and test files, and uses selectors such as:
  - `Literal[value=/…/i]`, `TemplateElement[value.cooked=/…/i]` and `JSXText[value=/…/i]` for the words;
  - `SwitchCase > Literal[value=/^(…)$/]` for `case` branches;
  - a `BinaryExpression[operator=/^[!=]==?$/]` selector, with `:not()` to exempt `.kind` comparisons, for comparisons.

  `npm run lint` already runs in the checks stage. This changes how P74 is built, so it needs a plan revision. It would resolve tech debt item 12.
- **(b)** Add to `.claude/docs/drafting-breakdowns.md`: a planned check on source code is a `no-restricted-syntax` rule in `eslint.deps.config.js`, not a new script under `tools/`.

## 2. Breakdown gaps caused all three stops for the user's decisions (drafting process)

**What happened.** Decisions 78, 79 and 80 each came from something the breakdown's drafter could have found by looking:
- **Decision 78:** the breakdown assumed `verify:fixtures` checks stored data only. It also compares derived views with `expected-views.json`.
- **Decision 79:** section 6.2's list of changing browser texts was compiled from memory, and missed `e2e/d4/responsive-a11y.spec.ts:175`.
- **Decision 80:** the planned check flagged five lines the plan keeps outside the wording module (`MarkEntry.tsx:160`, `position-change-issues.ts:30, 31, 61`).

**Sources:** `plan/implementation-plan.md`, decisions 78–80; the session's questions at 2026-11-05 02:44, 06:50 and 18:32.

**Proposed fix.** Add to the drafting guide:
- For every text the deliverable changes, grep `e2e/`, `tests/` and `src/**/*.test.*` for the old string. The list of changing expectations is that grep's output.
- For every derived shape that changes, grep `tests/fixtures/` and the `verify:*` tools for its fields.
- For every new check, run a throwaway version on the current tree, and list each hit in the breakdown with what happens to it.

## 3. An expired `ocr` sign-in stalled T7P.1 for about 2 hours (information access)

**What happened.** The first review of `536616d6` failed with `ChatGPT OAuth request failed: status=400 code=invalid_grant`, and the session waited from about 02:58 until the user signed in again at 05:11.

**Source:** structural.md, "ocr review of `536616d6`".

**Proposed fix.** Add `ocr auth status` to the handoff's location checks and to `implementing.md`'s start-of-deliverable steps. Expired refresh tokens may still show as signed in locally. If so, the check is a tiny review run instead: `ocr` on a one-line commit in a scratch clone. Test that once before relying on it.

## 4. Many first-run passes, and two reds gained by weakening a fix (TDD integrity)

**What happened.**
- **First-run passes:** T7P.6 cases 8 and 9; T7P.7 cases 1 and 3; T7P.8 cases 1, 3 and 5; and about 15 across T7P.9's bug tasks. Each needed a mutation check and a flag.
- **The cause:** most were cases for behavior that already existed and was only moving into the module.
- **Weakened fixes:** in T7P.9-B1 and B10, the subagents got a red only by temporarily weakening their own fix, because an earlier case's fix already covered the later case.

**Sources:** D07P-handoff.md, section 7, open questions 1, 4, 7 and 11; structural.md, T7P.9-B1 and T7P.9-B10.

**Proposed fix.** Two drafting rules:
- A case whose behavior already exists and only moves is a structural verification with a mutation check, not a red/green case.
- Where several bug-task cases share one fix, the brief names which case drives the fix; the others are verified after it, not red-first.

## 5. Scratch commits conflict with the guard hook, and the guard missed a `cp` (automated checks)

**Scratch commits.** T7P.6's compile-time check was planned as a scratch commit, then a drop. The guard refuses `git reset`, so the scratch commit `87891c13` and its revert `48f682f7` stay in history. T7P.9's planted check did the same job with uncommitted Edit-tool edits, and that worked cleanly.

**The `cp`.** In T7P.9-B4 to B7, a subagent restored a tracked file with a shell `cp` from a scratchpad copy, and `.claude/hooks/guard-shell-writes.sh` allowed it.

**Sources:** D07P-handoff.md, section 7, open question 2; structural.md, "T7P.9-B4 to B7".

**Proposed fix.**
- Drafting rule: mutation and compile checks are uncommitted Edit-tool edits, restored with Edit. A breakdown never plans a scratch commit.
- Extend the guard to refuse `cp`, `mv` and `install` when the destination is a tracked path outside `evidence/`.

## 6. Flaky tests cost reruns (automated checks)

**What happened.**
- `src/ui/screens/TradeList.test.tsx:125` failed the first gate run (`t7p-12-full`) and needed a full rerun. It is now tech debt item 11.
- `e2e/d4/card-helpers.spec.ts:111` hit a load timeout during T7P.10's 13.4-minute browser stage, then passed alone in 2.8 s. It is not recorded anywhere else.

A 13.4-minute stage is also well past the 10-minute mark that tech debt item 6 is about, and D7 adds more browser tests.

**Sources:** structural.md, "Cumulative run after T7P.10" and "T7P.12 Gate runs".

**Proposed fix.** Record the card-helpers timeout beside tech debt item 11, and revisit item 6 before D7's browser suite grows.

## 7. Minor

- **A finished task showed as still running.** The agents panel showed the completed T7P.9-B12 subagent as running, which prompted the user's question at 2026-11-06 08:39. `.claude/agents/tdd-task.md` has no progress-reporting instruction, unlike `.claude/agents/ocr-review.md:10`, so its bar never completes. Proposed fix: copy that instruction into `tdd-task.md`.
- **No commit-time guardrail.** There are no git hooks and no CI. Today the `suite-runner` run after every task covers this, so it is low priority. Proposed fix: a `pre-commit` hook running `npm run lint && npm run typecheck`, which would catch mistakes at the commit rather than at the next run.

---

## Chosen fixes (drafted 2026-11-06, awaiting the user's approval)

### Fix 1: `verify:wording` becomes an ESLint rule (finding 1), as bug task Retro-B1

**The decision.** The check keeps its name, `npm run verify:wording`, and its behavior: P74's rule, decision 80's no-exemption rule, and the phrase, reason-word and code lists in `tools/wording-scan.ts` today. Only how it is built changes, from a hand-written TypeScript-parser scan to ESLint `no-restricted-syntax` selectors, the pattern `eslint.deps.config.js` already uses. P74 doesn't specify the mechanism, so **no plan revision is needed for the change itself**. A plan edit marks tech debt item 12 resolved once Retro-B1 lands.

**Feasibility, checked 2026-11-06** with ESLint's `Linter` API on snippets, in memory, writing no file. Selectors on `Literal[value=…]`, `TemplateElement[value.cooked=…]`, `JSXText[value=…]`, `SwitchCase[test.value=…]` and `BinaryExpression[operator=/^[!=]==?$/]`, with `:not([left.property.name="kind"])` and its mirror, gave the scanner's results on these cases:
- **Hit:** a comparison split across lines; a phrase after a string holding ` // `; `x === ('MarkMissing' as const)`; `case ('NotClosed'):`; a phrase written with a ` ` escape; a phrase on the second line of a multi-line template; `<p>{icon}Mark missing</p>`; a curly apostrophe.
- **No hit:** `${1 /* Mark missing */}`; `<span>Don't</span>; // Mark missing`; a code-first `.kind` comparison wrapped across lines; `s?.kind === 'AcknowledgedUnavailable'`.

Every hit is reported at its node's start line, which removes tech debt item 12's wrong-line report.

**Retro-B1 (structural; one fresh `tdd-task` subagent).**
- **Build:**
  - a new `eslint.wording.config.js` exporting `wordingRules`, built in JavaScript from the same three lists, applied to `src/ui/**/*.{ts,tsx}` and ignoring `src/ui/calculation-words.ts` and `**/*.test.{ts,tsx}`;
  - `eslint.config.js` merges it, as it merges `noIdentityRules`;
  - `verify:wording` becomes `eslint --no-config-lookup -c eslint.wording.config.js src/ui`, so the checks stage keeps 13 checks and still names this one when it fails;
  - each selector's `message` names the rule (`verify:wording: …`) and the module to use.
- **Remove:** `tools/wording-scan.ts` and `tools/verify-wording.ts`, and `--list` with them (the lists can be read in the config).
- **Port the tests:** every one of `tools/wording-scan.test.ts`'s 27 cases moves to `tools/wording-rules.test.ts`, run through ESLint's `Linter` with the exported config. Each keeps its input and its hit or no hit. A case that asserts a line number expects the node's start line.
- **Verification (exact):**
  - every ported case passes;
  - `npm run verify:wording` exits 0 on the tree;
  - the planted run fails and names both files and lines. It plants uncommitted Edit-tool edits, as T7P.9's did (`'Mark missing'` in `src/ui/screens/AboutView.tsx`, a `case 'NotClosed':` in `src/ui/format.ts`), restored with Edit afterwards;
  - `npm run lint` exits 0;
  - the checks stage reports 13 of 13;
  - a complete cumulative run passes;
  - an `ocr-review` follows, with findings handled as bug tasks.

**Order (the user's call).** Retro-B1 lands before D7 starts, so D7's new words are checked by the new rule. Two D7 documents then change:
- **The D7 handoff:** its pointer to `tools/wording-scan.ts` (section 4, the Wording row) and its location check that `git diff claude-opus-5.5-d7p claude-opus-5.5-pre-d7 -- … tools package.json` is empty.
- **The starting tag `claude-opus-5.5-pre-d7`:** it is already pushed, so moving it onto the new handoff commit needs a force push of that tag.

### Fix 2: the drafter looks things up, and the guide says how (finding 2, and finding 1's prevention)

Four rules join `.claude/docs/drafting-breakdowns.md`: the three lookups in finding 2, and finding 1's "a planned check on source code is a lint rule". Main-session edit; no code changes.

### Fix 3: a real `ocr` probe before the first task (finding 3)

**Checked 2026-11-06:**
- `ocr auth status` printed `Expires: 2026-11-06T00:58:09-05:00`, already past, so it can't tell an expired refresh token from a working one.
- `ocr llm test` sent one test conversation through the real sign-in and printed `✓ Connection test successful` and `✓ Tool-call round trip verified`, so it is the probe.

**Change:**
- `.claude/docs/implementing.md`: run `ocr llm test` before the deliverable's first task; if it fails, stop and ask the user to run `ocr auth login`.
- "Writing the next deliverable's handoff": that probe becomes a row of the location checks.
- The D7 handoff gains the row when it is next edited (with fix 1's changes).
