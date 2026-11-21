# D09R2 pending decisions

## Q1 (asked 2026-11-20): Should an open but empty Correct form stop the trader choosing another cell?

- From: ocr's Doubtful finding on T9R2.12 (`7bc99e1a`, `CardMarks.tsx:210`).
- Today: after Correct is pressed with nothing typed (or both fields cleared), choosing another cell closes the empty form. Nothing typed is lost. This matches the card hold, which also ignores an empty Correct (`MarkEntry` is dirty only when Price or Reason holds text).
- Recommendation: keep it (no refusal for an empty form); dismiss the finding by this decision.
- Blocks: only this finding's bug task. Everything else carries on.
- Answer: (waiting)
