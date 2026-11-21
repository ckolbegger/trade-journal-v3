# D09R2 pending decisions

## Q1 (asked 2026-11-20): Should an open but empty Correct form stop the trader choosing another cell?

- From: ocr's Doubtful finding on T9R2.12 (`7bc99e1a`, `CardMarks.tsx:210`).
- Today: after Correct is pressed with nothing typed (or both fields cleared), choosing another cell closes the empty form. Nothing typed is lost. This matches the card hold, which also ignores an empty Correct (`MarkEntry` is dirty only when Price or Reason holds text).
- Recommendation: keep it (no refusal for an empty form); dismiss the finding by this decision.
- Blocks: only this finding's bug task. Everything else carries on.
- Answer (2026-11-21): keep. No refusal for an empty Correct form; the T9R2.12 ocr finding is dismissed by this decision.

## Q2 (queued): With an owed-reflections card open, which Trade does Save Marks report?

- From: ocr's finding on T9R2.13 (`ReviewView.tsx:571`), fixed as T9R2.13-B2 (`5159ff2a`).
- P157 says the save goes under "the open card's Trade, or, with no card open, the Trade the newest draft was typed in". An owed card's Trade can't take a Marks save (the save returns "changed during assembly" and the Review never refreshes), so B2 uses the newest draft's Trade when the open card is an owed card.
- Recommendation: keep B2; amend P157 to read "the open walked card's Trade, or else the Trade the newest draft was typed in" (a revision at the gate).
- Blocks: nothing (B2 is in).
- Answer: (waiting; asked after Q1)

## Q3 (answered 2026-11-21: fix the script, task T9R2.17-D1, then one more benchmark run): the benchmark's Save Marks step uses the old Marks list

`npm run bench:run` failed: `tools/bench-run.ts:458` still looks for the "Today's Marks" list, which D9R2 replaced with the grid. Every capacity check passed, and the timings measured before the failure look normal. The rule says a benchmark failure is the user's choice: (a) a bug task to move `bench-run.ts`'s Save Marks timing to the grid (the cell "ADBE Mark, <date>" and the header's Save Marks), then one more benchmark run, then the tag; or (b) a tech debt item, and tag now. Recommendation: (a). The fix is small, and without it AC-PERF-001's Save Marks timing goes unmeasured.
