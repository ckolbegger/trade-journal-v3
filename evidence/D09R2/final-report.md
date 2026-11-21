# D09R2 final report: the Review's Marks grid

Tag `claude-opus-5.5-d9r2` at `adaec8aa` (local; not pushed). Plan frozen at `claude-opus-5.5-plan-r112`. Evidence: `evidence/D09R2/` (`structural.md` holds every task's detail, ocr table and run).

## Tasks and commits

| Task | Level | Commits | Fix rounds |
|---|---|---|---|
| T9R2.1 | Light | `ebe553a6` | 0 |
| T9R2.2 | Standard | `8d3e8c0d` | 0 |
| T9R2.3 | Standard | `4f3d6a76` | 0 |
| T9R2.4 | Light | `7b1d9eed` | 0 |
| T9R2.5 | Full | `5212dedb` | 0 |
| T9R2.6 | Full | `460f1594`; B1 `d5e48854` | 1 |
| T9R2.7 | Full | `a5886612`; B1 `bbf1fb26` | 1 |
| T9R2.8 | Standard | `8debfb01` | 0 |
| T9R2.9 | Standard | `7363ed21`; B1 `64cc2033`; B2 `d45f5fab` | 2 |
| T9R2.10 | Light | `4051e4d1` | 0 |
| T9R2.11 | Standard | `b3fd296d` | 0 (its 3 ocr findings carried by T9R2.12, T9R2.13, T9R2.14) |
| T9R2.12 | Standard | `7bc99e1a`; B1 `451b95b0` | 1 (one finding waits on Q1) |
| T9R2.13 | Standard | `2fabe68c`; B1 `3cee0320`; B2 `5159ff2a`; B3 `8264ab91`; B4 `6580102d` | 4 |
| T9R2.14 | Standard | `50b411d1` | 0 (one ocr finding dismissed as Wrong) |
| T9R2.15 | Light | `90e3605d` | 0 |
| T9R2.16 | Light | `51ac08cd` | 0 |
| T9R2.17 (gate) | Gate | B1 `f3f3c864`; B2 `91d98afb`; B3 `0ed456f4`; B4 `51a03672`; B5 `7f121f43`; B6 `6303688a`; F1 `66c370f5`; B7 `41b348cf`; B8 `8c40e8b7`; B9 `e5da194d`; B10 `f37a9a7a`; B11 `7e1ec271`; F2 `2f911fff`; D1 `3e4b2635` | 3 critics; 14 fix tasks |

Gate fixes, by source:
- critic-1 (1 high, 4 moderate): B1 (editor by keyboard), B2 (focus after a conflict-refused save), B3 (focus when the pressed control disappears), B4 (one-leg Trade at phone widths), B5 (editor title and box; off-page editor closes).
- ocr on B1: B6 (Tab loop at saved cells); its other finding carried by B5.
- Full run T9R2.17-fixes1: F1 (B5's title made two older cases' text lookups match twice; drawn by CSS since).
- critic-2 (2 high, 1 moderate): B7 (pager by keyboard), B8 (a card failed to load after another tab saved a Mark; the cause was D5R's card read, older than D9R2), B9 (leaving the page asks with Mark drafts).
- ocr on B8: B10. ocr on B9 (Doubtful): B11 (a real page leave in the browser case).
- Full run T9R2.17-fixes3: F2 (B9's guard was app-wide and broke 9 older cases; narrowed to the Review's Mark drafts, per P156's row).
- The benchmark: D1 (the user's answer to Q3).

## Runs

Full tier before each critic: `T9R2.17` (pass), `T9R2.17-fixes1` (3 failed: F1), `T9R2.17-fixes2` (pass), `T9R2.17-fixes3` (9 failed: F2), `T9R2.17-fixes4` (pass: unit 2688, integration 300, browser 126, 80, 57, 137 plus 4 skipped, checks 14 of 14). Acceptance commands: 9 of 9 at each passing run.

**Flaky tests:** no P138 case flaked in any run. One unexplained single failure: B9.11 (`e2e/d9/meter-a11y.spec.ts:81`, "1280 px list: meter 1 width" 0) in `T9R2.17-fixes1`; it did not reproduce (two runs of its file) and passed in every later full run. Not added to P138's list.

The runner suggests a fifth browser stage: browser-4 took 8.5 min in `T9R2.17-fixes3`.

## Critics

| Critic | Tokens | Tool calls | Time | Result |
|---|---|---|---|---|
| critic-1 | 185,462 | 178 | 11 min 53 s | FAIL: 1 high, 4 moderate, 1 low |
| critic-2 | 248,540 | 258 | 22 min 26 s | FAIL: 2 high, 1 moderate, 1 low |
| critic-3 | 230,832 | 991 | 12 min 13 s | PASS: 2 low |

T9R2.16's subagent notes: the 390 px overflow was confirmed by critic-1 (defect 4) and fixed by B4. The refused-save reveal order (first-entered, where A294 says grid order) was not tested by any critic and stays open.

critic-3's minor observations worth your attention: a save refused by a conflict keeps sending the kept price as a first Mark, so Save Marks conflicts again until the Price box is cleared, and it holds every other draft (likely older than D9R2, widened by one Save Marks); on a phone the editor opens about 1,250 px below the chosen cell (P160 places it under the grid); the summary's "28 earlier optional" against the pager's "of 27". Full lists in `critic-2.md`, `critic-3.md` and `structural.md`.

## Benchmark

First run FAIL: `bench:run` stopped at `tools/bench-run.ts:458`, which still looked for the old "Today's Marks" list. You chose to fix the script (Q3); T9R2.17-D1 moved its Save Marks timing to the grid. Second run **PASS**: cold p95 199.3 ms (budget 2,500), warm p95 105.7 ms (budget 1,500), Save Marks 222 to 292 ms, every equality check equal; capacity: restored usage 0.264 × projection (limit 1.10), Restore peak 0.502 × M (limit below 3), 1.000 × baseline (limit 1.50). `bench.md`, `bench-run-report.md`.

## Decisions

- **Answered:** Q3 (fix the benchmark script, then one more run).
- **Pending:** Q1 (an empty Correct form and choosing another cell; recommendation: keep, dismiss the T9R2.12 finding); Q2 (which Trade Save Marks reports with an owed card open; recommendation: keep T9R2.13-B2, amend P157). Both in `DECISIONS-PENDING.md`.
- **Main-session decisions, recorded for your review** (`structural.md`):
  - B1's Tab route: each cell one tab stop; Tab from the chosen cell into its editor, then on to the next cell.
  - The per-fix browser-task runs were folded into one full run after each batch of gate fixes.
  - F2 narrowed B9's leave guard to the Review's Mark drafts. A reflection draft or any other form no longer asks on leaving, as before B9. Browser Back and Forward never ask.

## Tech debt (`tech-debt.md`)

1. A brief turned flash of the grid at 1280 px when the panel opens (critic-1).
2. A nested ternary at `CardMarks.tsx:268` (ocr on B2, style).
3. A Missing Review Date cell looks like an optional one; Acknowledged Unavailable has no chip (critic-2).
4. Price History's Trade P&L cell for an acknowledged session is named "No Mark" (critic-3).
5. Cell styles differ from the mockup's "Cell states" (critic-3; overlaps item 3).

## Words

- **New words awaiting approval** (`new-words.md`): "Leave without saving?" (the Review, while a Mark draft is held). Also noted by critic-3: "Save or cancel the correction to choose another cell." is not among W71 to W81.
- **Shortened under P137** (`words-changed.md`): T9R2.17-B5, the editor's title for an Available cell drops the price ("XYZ Mark, Fri Oct 9 · $9.30 · Manual" → "XYZ Mark, Fri Oct 9 · Manual"); the price stays on the status line below.

## Open questions carried from the handoff

- First-run passes, mutation-checked and flagged: T9R2.6 cases 2, 5, 6 and 8; T9R2.6-B1's case; T9R2.7 cases 2 and 4; T9R2.11 cases 5 and 8; T9R2.13 cases 4, 5, 10 and 11; T9R2.14 cases 1, 2b, 4b and 4c. T9R2.17-B7's browser case was written after its fix and not run against the old code.
- `ceefd574`: the tools-only fix to `tools/wording-rules.test.ts` you chose before T9R2.1.
- From T9R2.6's subagent: a Trade whose Review Date is the first covered session (2024-01-02) appears to crash `valueTrade` in `observationFrame`. This is existing behaviour, not fixed.
- Working-rule slips by subagents, recorded: code written before its red in T9R2.13 (genuine reds were obtained afterwards); `write()` used instead of an edit in T9R2.13-B3 and T9R2.16.

## Closed with the user (2026-11-21)

- Q1: keep (the T9R2.12 ocr finding dismissed). Q2: keep T9R2.13-B2; P157 amended.
- Tech debt items 1 to 5: all stay tech debt; items 3 and 5 merged and, with item 4, go to the coach review.
- Words approved as is: "Leave without saving?" and "Save or cancel the correction to choose another cell."
- The three main-session decisions: accepted.

Nothing in D9R2 is open with the user.
