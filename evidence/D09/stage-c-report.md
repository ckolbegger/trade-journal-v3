# D09 stage C report: the meter and the Open list's order

Stage C of D9, "Trade replay", on `claude-opus-5.5`: twelve planned tasks, T9.29, T9.30, T9.31, T9.32, T9.33, T9.34, T9.35, T9.40, T9.36, T9.37, T9.38, T9.39, run one at a time (decision 100), plus T9.29-D1 and T9.31-D1 for the user's decisions. The gate closed on 2026-11-20 with critic-c1's PASS and no defects; the benchmark passed after it. Tag `claude-opus-5.5-d9` (`10a4689e`).

## What the trader gets

One Stop-to-Target meter, the same drawing and the same name everywhere: in each Review card's header (replacing the old slider), on each Open list row (under the figures line on a phone), and at the top of Trade Detail's Conditions card. It shows break-even, the Stop and the Target lines, where the P&L is now (a square pointer past a line, round between them), what is already Realized, a hatched part past a line, and a faint mark for the session before. Its accessible name and hover say the figures in W51's words; with no Mark the track is dashed and the name gives the reason. The Open list is now in the Review's order (attention order, A262) under the line "In the Review's order"; Planned and Closed keep their orders.

## Tasks and commits

| Task | What | Commits | Fix rounds |
|---|---|---|---|
| T9.29 | The meter component | `52b83cb5`; B1 `934fd967`; B2 `d9a75703` | ocr: B1 (the hatch drawn over the Realized fill), B2 (a zero-length track drawn as a unit span) |
| T9.29-D1 | Fix the ReviewCards focus flake (the user's request) | `610fe293` | none |
| T9.30 | Attention shared through the valuation module; the meter's reading | `349ad6ec` | none |
| T9.31 | Daily Review: each walked Trade's meter reading | `7b73e835`; B1 `479c7635` | suite: B1 (two d5r Marks-save read counts gained an earlier-Mark lookup; fixed with `withoutStale`); six older request lists → SC-Q1 |
| T9.31-D1 | Six older Review-open request lists gain the one date's read (SC-Q1 (a)) | `4d7e2f2d` | none |
| T9.32 | Trade Views: the Open list in attention order | `7fe75de2` | none |
| T9.33 | Review card: the meter replaces the slider | `e2b082c8` | none |
| T9.34 | The Open list's meter column, narrow copy and the order line | `12ed0a9f`; B1 `ffa14452`; B2 `4026dfd1` | ocr: B1 (meter shown twice on phones), B2 (Settlement Due test built from a real option item) |
| T9.35 | The meter on the Conditions card (raised to Full) | `6c31fc93`; B1 `930e2f73` | ocr: B1 (meter shown while an Open Trade awaits its first Marks) |
| T9.40 | `rangePosition` removed, with its 84 fixture entries | `ae057f91` | none |
| T9.36 | The benchmark's expected Open rows in the new order (after the gate, SC-Q2 (a)) | `7b78c083` | none |
| T9.37 | Node integration suite, I9.10 and I9.11 (Light) | `17f05074` | none |
| T9.38 | Browser suite, B9.8, B9.9, B9.10 and B9.11 | `94be7273`; B1 `89b9fd44` | ocr: B1 (the "not colour alone" case read only attributes, never the drawn shapes) |
| T9.39 | The gate | — | none (critic-c1 PASS, no defects) |

Every ocr review of a fix came back clean. Commits, ocr outputs and every run are in `evidence/D09/structural.md`, "Stage C", `evidence/D09/ocr/` and `evidence/D09/suite-runs/`.

## Runs and flaky tests

Each Full or Standard task ended with its run; the full tier ran before the critic (`gate-c1`): unit 224 files, 2,592 tests; integration 137 files, 294 tests; browser-1 126 (5.5 min), browser-2 79 (5.2 min), browser-3 57 (4.6 min), browser-4 118 passed and 4 skipped (6.1 min); 14 of 14 checks; the acceptance script 9 of 9.

- **Flaky:** `ReviewCards.test.tsx:671` (focus check) failed once in run `t9.29`, then was fixed by T9.29-D1 at the user's request; P138's known `TradeList.test.tsx` Ready-state case failed once in run `t9.34` and passed alone.
- **Real failures caught by runs:** `t9.31` (T9.31-B1, and the six lists of SC-Q1); `t9.35` (only SC-Q1's six).

## Decisions

- **SC-Q1, answered (a):** the six older Review-open request lists gain exactly the meter's one date-wide read (T9.31-D1).
- **SC-Q2, answered (a):** T9.36 ran after the gate, as the benchmark's first steps.
- **The main session's choices, reported as made:** T9.35 raised to Full; T9.33's run used the full browser tier (its subagent's browser runs used a stale build); T9.32's fixture comparison re-sorts Open items before comparing, and its valuation counts rose with P133's second valuation; T9.37 kept Light; T9.36 had no ocr (one generated data file) and the benchmark stood as its run; the benchmark's `bench:generate` regenerated the dataset (T9.36's rows carry the `bench:expected` writer) and rewrote the expected rows identically in order.
- **Pending:** none.

## Critic

| Critic | Result | Tokens | Tool calls | Time |
|---|---|---|---|---|
| critic-c1 | PASS, no defects | 155,523 | 98 | 5 min 35 s |

It judged the three choices it was asked to: "In the Review's order" above the table (no objection); the "Stop ◂ ▸ Target" key above the Review (accurate, but the meter has a key in one place of three, and a screen reader reads the triangles); no meter for a Trade that can't be replayed (not built, not judged).

## The benchmark (`evidence/D09/bench.md`)

**Pass**, on port 4175, alone, after the gate. Cold p95 197.4 ms (budget 2,500), warm p95 99.7 ms (budget 1,500); the Open list equalled the expected rows at every start. Capacity: usage 0.250 × the projection (limit 1.10), second Restore peak 0.519 × M (limit below 3), usage 0.945 × the baseline (limit 1.50).

## Tech debt (`evidence/D09/tech-debt.md`), for review now

Stage C's items:
6. `MeterNow.pastBy` optional where two zones need it (ocr, style only).
7. The ReviewCards focus flake: **fixed** by T9.29-D1.
8. Critic-c1, low: the no-Mark name runs the reason into the rails with no full stop ("…Fri Nov 13 Stop −$200.00…").
9. Critic-c1, low: the faint mark for the session before is barely visible inside a hatched part.
10. Critic-c1, earlier work: at 1280 px the Open list's table scrolls sideways and cuts off P&L, because a no-Mark row's text does not wrap.
11. Critic-c1, earlier work: the Open list says "Thu Nov 12 close +$100.00" where Detail says "at the Thu Nov 12 Mark".

Stage B's items 1, 2, 3 and 5 still stand (item 4 was decided, T9.28-D2).

## New words awaiting approval (`evidence/D09/new-words.md`, "Stage C")

- T9.29: "Level with +$X on Thu Nov 12." and "Session before +$X on Thu Nov 12." (the meter's mark for the session before); "P&L +$X." with no share at break-even.
- T9.35: the no-Mark reason on the Conditions card's meter is the P&L card's own text, e.g. "No Mark for XYZ on Tue Oct 13".

## Text shortened under P137

None in stage C. `evidence/D09/words-changed.md` has no stage C entry.

## Process notes

- First-run passes, each mutation-checked and flagged in `structural.md`: T9.29 (two), T9.30 (two), T9.31 (two); T9.37 and T9.38's cases (tests over built code; T9.38's axe scans have no mutation).
- `bench:run` writes its report to the fixed path `evidence/D08/bench.md`; the main session copied it into `evidence/D09/bench.md` and restored D08's file.

## Time

The session lock was taken at 2026-11-20 10:04 UTC; the benchmark finished at 16:35 UTC: about 6 h 30 min wall-clock, including the user's questions, against the breakdown's estimate of about 9 hours serial.
