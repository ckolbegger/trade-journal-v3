# D5R2 benchmark run (T5R2.16, AC-PERF-001)

Written by `npm run bench:run` (T2.21, extended by T4.31, T5.22 and T5R.13) on 2026-11-01T16:14:56.137Z, at commit a2170494862efbd2e9c42757e0f9868f83d15477 plus uncommitted changes to tools/bench-run.ts (the two harness fixes below). The tool writes `evidence/D05R/bench.md`; that file was restored with `git checkout` and this copy is the D5R2 record.

## How it was run (T5R2.16)

- Commands, with no browser suite running: `npm run test:integration -- d5r/query-count` (3 tests passed unchanged: progress adds no request, A168; output `suite-runs/T5R2.16-query-count.txt`), then `npm run build:bench && npm run bench:run > evidence/D05R2/suite-runs/T5R2.16-bench.txt 2>&1` (exit 0, "bench:run OK").
- Cache: reused. `.cache/bench/profile` (generator 3, schema 4, `bench/dataset.json` unchanged) was copied per run; nothing was regenerated.
- All timings below are ungated apart from the two budgets in the first table (cold 96.2 ms against 2,500 ms, warm 47.3 ms against 1,500 ms: pass). Every before-and-after comparison held: Open list before and after (200 rows equal to `bench/expected-open-rows.json`, and for each of the 30 cold starts), Missing Instruments showing `Mark missing`, and the as-of Review's 2 due reflections (QAJ 2) before and after.
- Against D5R (`evidence/D05R/bench.md`, 2026-10-31): cold p95 101.8 ms (now 96.2); warm p95 44.3 ms (now 47.3); open the first card median 1854.8 ms, p95 1895.4 (now 1828.6 and 1869.0); Save Marks median 79.8 ms, p95 81.3 (now 82.8 and 85.5); Trade Action save median 90.0 ms, p95 90.5 (now 85.0 and 85.2); Review status render before the runs 2276 ms and after 2223 ms (now 1723 and 2193). D5R2 adds no request to the Review's open or saves, and these timings are within the run-to-run spread of D5R's.
- **Harness fixes (stale since D5R's T5R.15-I4, 095e3259, which made the Review name a Trade in full, A150; D5R2 changed no label).** (1) `compareDueReflections` keyed its per-Trade count on the whole blocker text ("QAJ (Long 120 shares @ $300.97)") against the bare underlying in `bench/dataset.json`; it now keys on the name up to the first " (". (2) The card region is named "SYMBOL (Trade) review": `cardOf` (Playwright, now a regex on the underlying) and the in-page `section[aria-label="SYMBOL review"]` condition of `pressToRendered` (now `^="SYMBOL "` and `$=" review"`) no longer matched. The expected values are unchanged. The first run (`suite-runs/T5R2.16-bench-first.txt`) failed on fix 1 before any timing, the second (`-second.txt`) on `cardOf` after the open-the-first-card timings, the third (`-third.txt`) on the in-page condition for Save Marks; the fourth is the record here.

## Result

| Measure | Runs | Nearest-rank p95 (29th of 30) | Budget | Result |
|---|---|---|---|---|
| Cold start to `tj:interactive` | 30 | 96.2 ms | 2,500 ms | pass |
| Warm Planned-to-Open switch to `tj:open-list-ready` | 30 | 47.3 ms | 1,500 ms | pass |

Open list compared with `bench/expected-open-rows.json`: before the runs 200 rows equal, after the runs 200 rows equal, and each of the 30 cold starts rendered the same 200 rows (figures included). The 10 Missing Instruments on the as-of date (ABBV, AVGO, CAT, QAM, QBB, QBQ, QCF, QCU, QDJ, QDY) have rows in that list, each showing `Mark missing` in P&L (and no other row does).

## As-of Review's due reflections (T5.22)

The harness opens the Review from the primary navigation and reads its blockers: each "Reflection due for X" or "N reflections due for X" is a reflection due at the as-of Review (X names the Trade in full; the harness compares its underlying symbol) (Review Date 2028-12-29). The expected values are `asOfDueReflections` and the Trades of `outstandingDebts` in `bench/dataset.json` (the Outstanding Debts are from 2028-12-27 and 2028-12-28, both due at the as-of Review, decision 58). A difference fails the run.

| When | Due reflections listed (by Trade) | Expected | Result | Time from the click on Review to its status (disclosed, not gated) |
|---|---|---|---|---|
| before the runs | 2 (QAJ 2) | 2 (QAJ 2) | equal | 1723 ms |
| after the runs | 2 (QAJ 2) | 2 (QAJ 2) | equal | 2193 ms |

## Card timings (T5R.13, disclosed, not gated)

Each is the time from the pointer press to the rendered result, on the mature dataset above. The thresholds in the first table are the only gates.

| Measure | Runs | Median | Nearest-rank p95 | Min | Max |
|---|---|---|---|---|---|
| Open the first card (press on Review to the first card's content: `open` plus one `getTrade`) | 10 | 1828.6 ms | 1869.0 ms | 1751.1 ms | 1869.0 ms |
| Save Marks of one card's Marks (press on Save Marks to the card's drafts cleared) | 5 | 82.8 ms | 85.5 ms | 80.1 ms | 85.5 ms |
| Trade Action save (press on Save in the Action form to the form replaced by the result) | 5 | 85.0 ms | 85.2 ms | 80.3 ms | 85.2 ms |

- **Against D5:** D5 measured the cold start at 104.8 ms and the warm switch at 43.6 ms (p95); this run's are 96.2 ms and 47.3 ms. D5 timed the press on Review to the Review's status at 2342 ms before its runs and 2225 ms after (single measurements); opening the first card here, which adds the first Trade's `getTrade`, takes a median of 1828.6 ms.
- **Tech debt item 3** (the Review's open cost grows with history) is measured here, not fixed: D5R takes the save path off it (P38) but not the first `open` of each Review, and the open-the-first-card timing is its baseline.
- **The saves** are timed on cards of the cached profile's copy: Save Marks on ABBV, Save Marks on AVGO, Save Marks on CAT, Save Marks on QAM, Save Marks on QBB; and a Hold Action on QAI, QAH, QAG, QAF, QAE. A Marks save fills the Instrument's Missing Review-date Mark with 51.00. The dataset holds an Action for every Trade on the Review Date, so each Action save is an edit of the saved Action (Change, Hold, an Intent of "bench edit", Save): a `SaveTradeAction` with the entry's expected revision, with the same post-save rebuild as a first save. The Review is opened afresh before each, which is not timed.
- **Raw timings (ms, in run order):** open the first card 1751.1, 1781.8, 1789.7, 1801.9, 1819.8, 1837.4, 1849.8, 1851.6, 1852.7, 1869.0; Save Marks 85.5, 82.5, 84.5, 82.8, 80.1; Trade Action save 82.8, 85.1, 85.2, 80.3, 85.0.
- **Method:** a MutationObserver in the page reads the real clock on the first DOM change after which the result holds (the card's content shown with no card still loading; the card's Save Marks counting no drafts; the card's Action form gone with no card still loading), and a capture-phase pointer press records the start on the same clock.

## Method

- Playwright's clock also swaps `window.performance` for a fake that records no marks, so the harness keeps the real object before the pin and points the fake's `mark` at it; `performance.now` and timers are the real ones.
- `Date` is pinned to the dataset's as-of instant (2028-12-29T21:35:00.000Z, A52) with Playwright `context.clock.setFixedTime`, and native `Temporal.Now.instant` (the application's clock) is pointed at it (T4.31-B1); every comparison first checks both read the as-of instant and that exactly the Missing Instruments' rows show `Mark missing`. Timers and `performance.now` are real, and the build is production.
- A copy of the cached profile (`.cache/bench/profile`, generator 3, schema 4) per run of the harness; the cached profile itself is never opened.
- The production build (`dist/`) served by the release harness server at http://localhost:5181, the origin the profile's IndexedDB belongs to.
- One warm-up launch, online, installs the service worker and is excluded. The server is then stopped and every later launch is offline (Playwright `offline: true`), so the app loads from the service worker and IndexedDB only.
- Cold start: the Chromium process is launched on the profile, navigates to the origin, and the time is the `tj:interactive` mark's `startTime` (from navigation start; readiness Writable and the Open list fully rendered with every row's figures, each run's rendered list compared with the expected rows afterwards); the process is then closed. The time from the call that launches the browser process to the same mark is recorded beside it for disclosure and is not gated.
- Warm switch: in one launched page, the Planned tab is opened and its first page rendered, then the Open tab is clicked; the time runs from the pointer press on the Open tab to the next `tj:open-list-ready` mark.

## Raw timings (ms, in run order)

| Run | Cold (navigation start to mark) | Cold, disclosed: process launch to mark | Warm |
|---|---|---|---|
| 1 | 94.6 | 163.4 | 43.8 |
| 2 | 95.5 | 164.7 | 43.6 |
| 3 | 93.7 | 163.1 | 41.0 |
| 4 | 94.1 | 164.0 | 41.0 |
| 5 | 91.9 | 161.4 | 41.1 |
| 6 | 95.5 | 164.5 | 39.1 |
| 7 | 94.4 | 163.6 | 38.4 |
| 8 | 94.6 | 164.9 | 40.9 |
| 9 | 94.9 | 164.5 | 39.4 |
| 10 | 93.8 | 165.3 | 38.1 |
| 11 | 94.8 | 163.8 | 39.9 |
| 12 | 96.2 | 165.8 | 38.3 |
| 13 | 94.9 | 163.9 | 38.3 |
| 14 | 94.9 | 163.9 | 39.9 |
| 15 | 93.9 | 164.6 | 40.0 |
| 16 | 92.9 | 162.5 | 38.1 |
| 17 | 95.6 | 164.9 | 37.9 |
| 18 | 95.4 | 165.0 | 39.1 |
| 19 | 95.5 | 165.8 | 47.3 |
| 20 | 95.0 | 165.5 | 47.6 |
| 21 | 94.9 | 163.6 | 40.2 |
| 22 | 95.8 | 165.7 | 38.9 |
| 23 | 95.9 | 165.9 | 38.8 |
| 24 | 95.0 | 164.6 | 38.7 |
| 25 | 95.7 | 164.7 | 39.4 |
| 26 | 95.0 | 164.1 | 39.3 |
| 27 | 95.0 | 165.4 | 38.5 |
| 28 | 94.6 | 164.7 | 39.1 |
| 29 | 96.8 | 166.7 | 39.9 |
| 30 | 95.6 | 164.3 | 39.8 |

Sorted cold: 91.9, 92.9, 93.7, 93.8, 93.9, 94.1, 94.4, 94.6, 94.6, 94.6, 94.8, 94.9, 94.9, 94.9, 94.9, 95.0, 95.0, 95.0, 95.0, 95.4, 95.5, 95.5, 95.5, 95.6, 95.6, 95.7, 95.8, 95.9, 96.2, 96.8

Process launch to mark (not gated): p95 165.9 ms.

Sorted warm: 37.9, 38.1, 38.1, 38.3, 38.3, 38.4, 38.5, 38.7, 38.8, 38.9, 39.1, 39.1, 39.1, 39.3, 39.4, 39.4, 39.8, 39.9, 39.9, 39.9, 40.0, 40.2, 40.9, 41.0, 41.0, 41.1, 43.6, 43.8, 47.3, 47.6

## Environment

| Item | Value |
|---|---|
| Hardware | Apple M4 Max, 16 cores, 64 GiB memory, arm64 |
| OS | Darwin 25.6.0 (darwin) |
| Browser engine | Chromium 153.0.8010.12, headless, via Playwright 1.63.0 |
| Node | v26.12.0 |

## Dataset provenance (`bench/dataset.json`)

```json
{
  "generatorVersion": 3,
  "schemaVersion": 4,
  "seed": 20211011,
  "clockStart": "2024-01-02T13:00:00Z",
  "timeZone": "America/New_York",
  "origin": "http://localhost:5181",
  "buildDir": "dist-bench",
  "benchRelease": "e7f6c6328dfbada449cfca715d6f95629d513fb81db5a7d2ce03ba542866a73b",
  "asOf": "2028-12-29T21:35:00Z",
  "reviewDate": "2028-12-29",
  "missingInstruments": [
    "ABBV",
    "AVGO",
    "CAT",
    "QAM",
    "QBB",
    "QBQ",
    "QCF",
    "QCU",
    "QDJ",
    "QDY"
  ],
  "counts": {
    "trades": 25000,
    "openTrades": 200,
    "plannedTrades": 24800,
    "positionChanges": 400,
    "executions": 800,
    "planReflectionEntries": 25000,
    "positionChangeReflectionEntries": 332,
    "positionChangeReflectionDeclines": 66,
    "institutions": 3,
    "accounts": 6,
    "strategies": 1,
    "sessions": 1255,
    "openInstruments": 150,
    "sharedInstruments": 50,
    "marks": 188240,
    "markCorrections": 1882,
    "acknowledgments": 0,
    "actions": 125404,
    "editedActions": 2509,
    "debts": 80,
    "debtsSettled": 72,
    "debtsDeclined": 6,
    "debtsOutstanding": 2
  },
  "actionsByChoice": {
    "Exit": 6271,
    "Roll": 6271,
    "Adjust": 6271,
    "Hold": 106591
  },
  "dispositions": {
    "complete": 260,
    "declined": 60,
    "answered": 72,
    "declinedLater": 6,
    "outstanding": 2
  },
  "asOfDueReflections": 2,
  "outstandingDebts": [
    {
      "debtId": "aff4aed7-10a4-4ec1-9cbb-4a6b3de81d0c",
      "tradeId": "ef17880b-a237-41d9-9a39-70e330564820",
      "underlying": "QAJ",
      "positionChange": 398,
      "momentDate": "2028-12-27"
    },
    {
      "debtId": "6df73331-56a1-4d8f-867b-ca5796e75d9d",
      "tradeId": "ef17880b-a237-41d9-9a39-70e330564820",
      "underlying": "QAJ",
      "positionChange": 399,
      "momentDate": "2028-12-28"
    }
  ],
  "generationMs": 5980286,
  "generatedAt": "2026-10-30T05:53:29.317Z",
  "engine": "chromium 153.0.8010.12",
  "host": {
    "platform": "darwin",
    "release": "25.6.0",
    "arch": "arm64",
    "cpu": "Apple M4 Max",
    "cores": 16
  },
  "profileDir": ".cache/bench/profile",
  "expectedOpenRows": "bench/expected-open-rows.json"
}
```
