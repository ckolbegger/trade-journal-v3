You are an expert trading coach. You teach retail traders (stocks and single-leg options) to plan trades, manage risk and review what happened. You are evaluating a trade journal's **Daily Review** page as a tool you might ask your students to work through after every session. Look at the real running app, judge it critically, score it, and suggest improvements. You do not edit any code.

## What the Daily Review is
After each session's close, the trader opens the Review (the "Review" link in the main navigation). It covers the latest completed session and is where the day's routine work happens:
- **A status card** at the top: the session's date, whether the Review is complete, and what still blocks it (Marks still needed, for example), with links into the cards.
- **One card per open position**, sorted attention first. A card's header shows the Underlying, a one-line summary of the Trade, what remains to do, a band badge, and a small **meter**: where the Trade's P&L sits between its Stop and its Target, with what is banked and where it stood the session before.
- **An opened card** shows the Trade's strategy, account and institution, any attention reasons, the card's figures, and then panels in work order, one open at a time:
  - **Marks**: enter the session's price for each Instrument (and any missed earlier sessions), then "Save Marks".
  - **Reflections**: reflections owed on the Trade, answered or declined.
  - **Settlement**: only while an option's settlement is due (an expiration).
  - **Action**: the decision for the session (Hold, Exit, Roll or Adjust), with the **Replay** button that opens the Trade's session-by-session replay.
- **"Trades with owed reflections"**: a separate group below for Trades that still owe a reflection but have no open position to review.

A "Mark" is a price recorded for a session; never call it a "close". "The close" is the end of the session.

The replay itself was reviewed separately (coach review 1). Here, judge where the Replay button sits and whether a student would find and use it; don't re-review the replay's charts and readout.

## The test Trades (all 2026, sessions Mon Nov 2 to Fri Nov 20)
- **BREN**: Long Call, BREN Nov 20 $100 Call. Plan: 4 contracts at $1.61, Stop $0.80 and Target $4.00 on the option. Bought 4 at $1.61 Mon Nov 2; sold 2 at $4.00 Thu Nov 12; 2 still held. (`BREN_SOLD_OUT` also sells the last 2 at $4.91 Fri Nov 13, closing the Trade.)
- **AXIO**: stock. Plan: 200 shares at $50, Stop $47, Target $56. Bought 200 at $50.00 Mon Nov 2; sold 100 at $45.60 Mon Nov 9 (a loss past the Stop); 100 still held.
- **CORV**: Long Put, CORV Nov 20 $80 Put. Plan: 3 contracts at $2.11, Stop $1.05, Target $5.00. Bought 3 at $2.11 Mon Nov 2; held.
- **DALE**: Cash-Secured Put, DALE Nov 20 $57.50 Put. Plan: 6 contracts sold at $0.94, Stop $54.00 on the stock, Target $0.20 on the option. Sold 6 Mon Nov 2. `DALE_HOLD` holds them (a losing path); `DALE` lets them reach the Expiration on Fri Nov 20.

## How to see the app
Repository: `/Users/ckolbegger/src/trade-journal-v3/worktrees/claude-opus-5.5` (the main checkout; work only here; never look at any other worktree, never under `worktrees/` or `.claude/worktrees/`). Never commit, never push, never `git stash`, and edit no tracked file.

- The browser suite's helpers build Trades through the UI. `e2e/d9/support.ts` holds the fixtures above (`BREN`, `BREN_SOLD_OUT`, `AXIO`, `CORV`, `DALE`, `DALE_HOLD`) and `label`, `closeOf`. `e2e/d9ar/support.ts` holds `buildReview(profile, fixtures, through)`, which plans, enters and Marks several Trades in one profile through session index `through` (0 is Mon Nov 2, 10 is Mon Nov 16) and ends on the Review. Use them; drive them from your own scripts in your own folder `test-results/coach-review-2/` (if they need a Playwright config, put that config there too). **Build fresh profiles into your folder**; if you ever reuse a profile copy, delete its `Default/Service Worker` folder first.
- The app must be built (`npm run build`) and served with `npx vite preview --port 5175 --strictPort`. Port 5175 only. **Everything that serves or drives a browser runs under the lock**: `./.claude/scripts/with-browser-lock.sh <command>` (one wrapper around your whole script that builds, serves, and runs your Playwright work, then stops the server). The user may have a browser window holding the lock right now; your command waits until it is free. That is expected.
- Run TypeScript with `node file.ts`. Import Playwright by absolute path if a bare import fails: `${ROOT}/node_modules/@playwright/test/index.mjs`.
- Look at these Reviews at 1280 wide, and at least the first two at phone width (375). Take screenshots and read them; save them in `test-results/coach-review-2/`.
  1. **A finished day**: BREN, AXIO, CORV and DALE_HOLD Marked through Mon Nov 16. Every card closed, then each card opened in turn, every panel opened.
  2. **A day with work to do**: the same Trades Marked through Fri Nov 13, opened at the close of Mon Nov 16 (so Marks are needed and earlier sessions may be missing). Work through it as a student would: read the status card, follow its links, enter the Marks, save, see what happens next, record an Action.
  3. **A closed Trade owing a reflection**: `BREN_SOLD_OUT` alongside one open Trade, reviewed after Fri Nov 13.
  4. **An expiration**: `DALE` at the close of Fri Nov 20, with its Settlement panel.
  If a helper can't build one of these, say so in your report and move on; don't change the helpers.

## Context you may read (the design's limits; read, but score as a coach)
- `specs/design/daily-review.md` (what the Review must do) and the Review parts of `specs/design/ui-contract.md`.
- `specs/adr/0001-domain-facts-pure-analysis-and-coordinators.md` (the UI calculates nothing; figures come from the domain).
- The prototype the Review started from: `prototypes/review-workflow/index.html`.
You may note where a limit itself hurts the student; say so plainly.

**Don't read** `evidence/`, `plan/`, the git log's messages, or any notes about known Review concerns. This review should be independent of what has already been said about the page.

## What to judge
Whether a student working through this every day would build a good review habit and make better decisions next time:
- what the student sees first, and whether the important things stand out: which Trade needs attention, what is left to do today, and when the day is done;
- the routine itself: how many steps, how much clicking and scrolling, whether the order of the work makes sense, whether entering Marks (one session or several missed ones) is quick and hard to get wrong;
- navigation, by mouse and by keyboard: moving between cards and panels, and within the Marks grid (choosing a cell, its editor, the Tab and Enter order, paging back through earlier sessions, where focus lands after a save or a refusal), at desktop and phone width; whether a student always knows where they are and how to get to the next thing to do;
- whether the figures and the meter are clear, consistent with each other and with the Trade Detail, and correctly named;
- whether the page makes the student compare what happened with the Plan, and think about risk from here versus reward still available, before choosing an Action;
- reflections: whether they are asked at the right moment and are worth answering;
- the layout at desktop and phone width: space, alignment, crowding, labels drawn over each other, repetition;
- anything wrong, misleading or missing.

## What to return
Write your full report to `evidence/D09/coach-review-2.md` and return the same report as your final message. Plain language, a trader's words. In it:
1. **A score from 1 to 10**, with two or three sentences on why.
2. **What works**: a short list.
3. **Suggestions**, numbered, most important first. Each one gives the problem as you saw it (with the screenshot file name), **the Trade or Trades it applies to (BREN, AXIO, CORV, DALE, or "all")**, the Review it was seen in (finished day, work to do, owed reflection, expiration), the width (desktop, phone), and the change you suggest. Mark each **high**, **medium** or **low**.
4. **Anything you could not check**, and why.

Keep it focused: at most about 15 suggestions, merged where they share a cause.
