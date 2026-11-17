# D08R pending decisions

Questions the specs and the frozen plan leave to the user (decision 113, as amended by decision 115). One is asked at a time; any other is queued here. Each entry gives the task, the question, the options with their tradeoffs, the recommendation, and whether it is asked, queued or answered.

## P1. A Closed Trade's Exit column when it was sold before today's close (T8R.7, ocr finding)

**Status:** answered 2026-11-17: **option 1, date the column by the exit session.** It becomes bug task T8R.7-B1, which touches lane TD's and lane BV's files and runs in lane TD. A235 is read as amended by this answer.

**Question.** A235 dates a Closed Trade's second Today column "by the replay's last session". The replay ends at the first completed session closing at or after the final Position Change (`replay-trade.ts` `replaySessions`). For a Trade sold out during a session that has not closed yet, no such session exists. The column then reads "Exit <the previous session>": today's sale price under yesterday's date, beside yesterday's Underlying Mark. A same-day round trip with no completed session shows only "Exit". ocr raised this on T8R.7 (medium, Valid). The code follows A235, so the gap is in the plan.

**Options.**
1. *Date the column by the exit session.* Trade Views gives the Closed Detail the trading date of the session that holds the final exit (session policy), and the adapter heads the column with it. The Underlying's cell is its Mark at that session once that session's Marks exist, and "—" before. This amends A235 and adds one Trade Views field (additive, A245). It needs one more bug task across lanes BV and TD.
2. *Keep A235 as written.* Record the pre-close sale as a known edge: the column shows the last completed session until the exit session closes, then corrects itself. No code change. It goes to the final report and tech debt.
3. *Hide the second column until the exit session closes.* Show only Yesterday and Today until the replay reaches the exit session. This is smaller than option 1, but it is still an A235 amendment, and the exit price is missing for the rest of that day.

**Recommendation:** option 1. The date is a label the trader reads as fact, and option 1 never shows a wrong one.

## P2: a third ocr round on the names spec left two narrow findings

T8R.27-B2 (`b10ea3de`, lane BR) is the third ocr round on `e2e/d8r/names.spec.ts`. ocr found two more hand-built accessible-name gaps:
- a child `aria-label` that overrides a button's content;
- a labelled element whose role is outside the content-named list.

Both DOM shapes are made up; no screen in the app has them, and the spec passes on the real app.

The options:
1. Merge lane BR as it stands, and record both findings as tech debt in the final report.
2. One more bug task, T8R.27-B3, closing the two gaps in the hand-built name.
3. One more bug task, T8R.27-B3, replacing the hand-built name with the browser's own computed name, read through Chromium's accessibility tree.
