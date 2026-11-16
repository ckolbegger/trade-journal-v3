# Replay prototype: handoff for an interview and prototyping session

Written 2026-11-15 at the user's request. There is no picture of D9's replay chart: the UI contract describes it only in words. This session interviews the user about what replay must do in the daily review, then builds one page with five alternative replay visualizations. It is research, not a deliverable: it changes no product code, tests or plan, and it is not a plan revision. The D8R breakdown (`plan/D08R-trade-detail-refactor.md`) is drafted, with all its questions answered, but not yet agreed; this work does not wait for it.

**Starting the session.** Start it on **Fable, at High effort**, with one prompt: *"Read plan/D09-replay-prototype-handoff.md and follow it."* Run the location checks in section 1, then follow the prompt in section 3.

## 1. Confirm the location before anything else

| Check | Expected |
|---|---|
| `git rev-parse --show-toplevel` | `/Users/ckolbegger/src/trade-journal-v3/worktrees/claude-opus-5.5` |
| `git branch --show-current` | `claude-opus-5.5` |
| `git status -sb` | No uncommitted changes. The branch is level with or ahead of `origin/claude-opus-5.5`. |
| `grep DEV_PORT .env.local` | `DEV_PORT=5175` |

If any check fails, stop and ask the user.

## 2. Already settled with the user (2026-11-15)

Don't ask these again.
- All six trades below appear in every visualization.
- Each Mark series runs through expiration: 15 sessions, Mon Nov 2 to Fri Nov 20, 2026, with no gaps.
- Option Marks come from a pricing model (Black-Scholes), not hand-written numbers.
- The interview uses the `grilling` skill.
- Every trade has a Plan with a Stop and a Target.
- You propose eight or more concepts; the user picks five.
- The page is `prototypes/replay/index.html`; the interview's findings go in `research/replay-requirements.md`.

## 3. The prompt

**Replay: interview, then five prototypes.**

You are working in the trade journal repository. Your job has two parts: first build a deep, shared understanding with me of what the Trade replay must do for a trader during the daily review, then design and build five genuinely different replay visualizations on one HTML page. You do not change product code, and you do not write a D9 breakdown.

**Why this matters.** Replay is the deliverable after D8R (D9, "Trade replay"). The spec describes its chart only in words (`specs/design/ui-contract.md`, line 96). I want the trader to use replay every day, as part of the daily review, to *learn*: how an option's price responds to moves in its Underlying (and to time passing), and how each move changes the position's risk and reward, above all **the total dollars at risk** and **the incremental reward still remaining**. A replay that only redraws a price chart has failed.

**Read first.** `CLAUDE.md`; your memory index; `specs/glossary.md` (use its terms exactly: Mark, Underlying, Stop, Target, R, Risk to stop, Reward to target, Worst case, Max reward, Stop Overrun); `specs/design/ui-contract.md` (Trade Detail, the replay line, accessibility); `specs/design/trade-analysis.md` (`evaluate`, `replay` and the normative analytical rules); `specs/design/daily-review.md`; `specs/adr/0007-observed-valuation-and-expiration-payoff.md` (why replay and the Expiration Payoff stay separate); the D9 definition in `plan/implementation-plan.md`; `plan/D08R-trade-detail-refactor.md` (what Today, the rail and Plan and Risk will show); `prototypes/trade-detail/index.html` (the "C. Cockpit" tab) and `prototypes/review-workflow/index.html` (the daily review); `research/trade-detail-audit.html`. Words: a price is a **Mark**, never a "close"; the end of a session is "the close".

**Part 1: the interview.** Use the `grilling` skill. Ask one question at a time, plain words first, then the context, the options with their tradeoffs, and your recommendation. Don't accept a vague answer: follow it until it is concrete enough to draw. Cover at least:
- the moment of use: when in the daily review the trader opens replay, what question they arrive with, and what decision it should leave them ready to make (hold, adjust, exit);
- the learning goals, made specific: which option behaviors the trader should come to *see* (sensitivity to the Underlying, acceleration near the strike, time decay with the Underlying flat, the short put's asymmetry, a spread's capped value), and how a visualization would show each one without a formula;
- "total dollars at risk": to the Stop, to the Worst case, or both; per session or the change since the last session; in dollars, R or both;
- "incremental reward remaining": to the Target, to the Max reward, or both; how a capped reward (spreads, short put) differs from an open one;
- what the slider means: replaying the past as it looked at each session (only the Marks known then), and what stays fixed (the Plan) versus what moves;
- the planned versus actual: how the Plan's 1R and planned reward should appear beside today's figures;
- where replay lives (a Trade Detail drawer, the Review card, both) and what it must not repeat from Today, Price History or Payoff;
- stocks versus options versus two-leg spreads in one design;
- what the trader should never be misled by (for example, a model price shown as if it were a Mark).

Keep a running record in `research/replay-requirements.md`: each decision in my words, what it rules out, and the open points. When you think we share a strong understanding, show me a summary and ask me to confirm before Part 2.

**Part 2: the trades.** Six trades, each on a different Underlying (fictional symbols are fine), each with a Plan holding a planned entry, a Stop and a Target:
1. a long stock position;
2. a long call;
3. a long put;
4. a short put;
5. a bullish vertical call spread;
6. a bearish vertical put spread.

All entered on Mon Nov 2, 2026; every option expires Fri Nov 20, 2026. Each trade has two Mark series, one bullish and one bearish, for every session from Mon Nov 2 to Fri Nov 20 (15 sessions, no gaps), including the expiration session and how each option settles. Generate the Underlying's Marks by hand with intent, then price every option from its Underlying's Mark with Black-Scholes, a stated volatility and rate, and the real days to expiration, rounded to cents. Put the generator and its assumptions in the page, visibly labelled as a model. Design the series so that, across the twelve, the trader sees: a flat stretch where only time moves the option; a move toward the Target and a move toward the Stop; at least one Stop breached and one Target reached; an option going from out of the money to in the money; the short put's loss accelerating; each spread approaching its cap; and expiration settling each option. Check every figure: risk, reward and R must follow from the Marks and the Plan, and you must be able to show the arithmetic.

**Part 3: eight or more concepts, then five.** Before building, write at least eight concept sketches in words. Each must rest on a different central idea, not a restyle of another, and state: the question it answers for the trader; what it teaches about option behavior; how it shows total dollars at risk and the incremental reward remaining at each session; how it handles stock, single options and spreads; its weaknesses; and what it would cost to build in the app. Include at least one idea you think I wouldn't have thought of. Recommend five and explain why; I choose.

**Part 4: the page.** Build `prototypes/replay/index.html`: one self-contained file, no external libraries, styled like the existing prototypes. It holds the five chosen visualizations of the same six trades. Every chart has:
- a toggle between the bullish and bearish series;
- a slider that, moved left to right, reveals the sessions one by one, with every figure on the chart "as of" the slider's session (nothing from a later session leaks in);
- a readable text equivalent of every graphed number;
- keyboard operation (the slider and the toggle), WCAG 2.1 AA contrast, and no sideways scroll at 375 and 320 px.

Follow the spec's replay rules (a Mark is a point; lines never bridge a missing value), and keep replay separate from the Expiration Payoff. Each visualization carries a short note: its central idea, what to look for, and the derived figures it needs, so D9 can plan them as Trade Analysis or Trade Views fields (the app's UI calculates nothing, ADR 0001; the prototype may compute in the page).

**Check your own work.** Open the page in Playwright from the file (no server needed; if you serve it, use only port 5175), at 1280, 375 and 320 px, move each slider end to end in both series, and look at the screenshots yourself. Fix what is wrong before showing me. Then write, at the end of `research/replay-requirements.md`, a comparison of the five against the interview's goals and your recommendation.

**Rules.** Never look at any other worktree under `worktrees/` or another implementation's branch. Commit locally when the page and notes are done; never push. Don't change product code, tests or the plan. Stop after the comparison and report: what each visualization does, which you recommend and why, and the commit hash.
