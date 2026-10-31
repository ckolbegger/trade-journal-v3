# D5R benchmark run (AC-PERF-001)

Written by `npm run bench:run` (T2.21, extended by T4.31, T5.22 and T5R.13) on 2026-10-31T23:51:03.430Z, at commit b29bd204442b7f83546d20d18a25ce02d9d28b56 plus uncommitted changes to src, tools, bench or package.json.

## Result

| Measure | Runs | Nearest-rank p95 (29th of 30) | Budget | Result |
|---|---|---|---|---|
| Cold start to `tj:interactive` | 30 | 101.8 ms | 2,500 ms | pass |
| Warm Planned-to-Open switch to `tj:open-list-ready` | 30 | 44.3 ms | 1,500 ms | pass |

Open list compared with `bench/expected-open-rows.json`: before the runs 200 rows equal, after the runs 200 rows equal, and each of the 30 cold starts rendered the same 200 rows (figures included). The 10 Missing Instruments on the as-of date (ABBV, AVGO, CAT, QAM, QBB, QBQ, QCF, QCU, QDJ, QDY) have rows in that list, each showing `Mark missing` in P&L (and no other row does).

## As-of Review's due reflections (T5.22)

The harness opens the Review from the primary navigation and reads its blockers: each "Reflection due for X" or "N reflections due for X" is a reflection due at the as-of Review (Review Date 2028-12-29). The expected values are `asOfDueReflections` and the Trades of `outstandingDebts` in `bench/dataset.json` (the Outstanding Debts are from 2028-12-27 and 2028-12-28, both due at the as-of Review, decision 58). A difference fails the run.

| When | Due reflections listed (by Trade) | Expected | Result | Time from the click on Review to its status (disclosed, not gated) |
|---|---|---|---|---|
| before the runs | 2 (QAJ 2) | 2 (QAJ 2) | equal | 2276 ms |
| after the runs | 2 (QAJ 2) | 2 (QAJ 2) | equal | 2223 ms |

## Card timings (T5R.13, disclosed, not gated)

Each is the time from the pointer press to the rendered result, on the mature dataset above. The thresholds in the first table are the only gates.

| Measure | Runs | Median | Nearest-rank p95 | Min | Max |
|---|---|---|---|---|---|
| Open the first card (press on Review to the first card's content: `open` plus one `getTrade`) | 10 | 1854.8 ms | 1895.4 ms | 1786.7 ms | 1895.4 ms |
| Save Marks of one card's Marks (press on Save Marks to the card's drafts cleared) | 5 | 79.8 ms | 81.3 ms | 78.4 ms | 81.3 ms |
| Trade Action save (press on Save in the Action form to the form replaced by the result) | 5 | 90.0 ms | 90.5 ms | 86.2 ms | 90.5 ms |

- **Against D5:** D5 measured the cold start at 104.8 ms and the warm switch at 43.6 ms (p95); this run's are 101.8 ms and 44.3 ms. D5 timed the press on Review to the Review's status at 2342 ms before its runs and 2225 ms after (single measurements); opening the first card here, which adds the first Trade's `getTrade`, takes a median of 1854.8 ms.
- **Tech debt item 3** (the Review's open cost grows with history) is measured here, not fixed: D5R takes the save path off it (P38) but not the first `open` of each Review, and the open-the-first-card timing is its baseline.
- **The saves** are timed on cards of the cached profile's copy: Save Marks on ABBV, Save Marks on AVGO, Save Marks on CAT, Save Marks on QAM, Save Marks on QBB; and a Hold Action on QAI, QAH, QAG, QAF, QAE. A Marks save fills the Instrument's Missing Review-date Mark with 51.00. The dataset holds an Action for every Trade on the Review Date, so each Action save is an edit of the saved Action (Change, Hold, an Intent of "bench edit", Save): a `SaveTradeAction` with the entry's expected revision, with the same post-save rebuild as a first save. The Review is opened afresh before each, which is not timed.
- **Raw timings (ms, in run order):** open the first card 1786.7, 1806.9, 1825.6, 1837.8, 1849.0, 1860.6, 1870.7, 1882.0, 1885.9, 1895.4; Save Marks 79.8, 78.4, 79.9, 81.3, 79.1; Trade Action save 90.2, 86.2, 90.0, 89.2, 90.5.
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
| 1 | 98.4 | 170.3 | 36.9 |
| 2 | 100.4 | 172.2 | 36.1 |
| 3 | 100.4 | 172.8 | 45.1 |
| 4 | 98.8 | 172.9 | 42.9 |
| 5 | 99.4 | 170.9 | 43.9 |
| 6 | 101.8 | 176.9 | 44.3 |
| 7 | 97.4 | 168.6 | 42.7 |
| 8 | 98.3 | 169.3 | 40.9 |
| 9 | 101.3 | 173.7 | 42.6 |
| 10 | 100.9 | 173.5 | 44.2 |
| 11 | 100.0 | 171.9 | 42.8 |
| 12 | 100.8 | 173.0 | 42.9 |
| 13 | 100.7 | 173.3 | 42.9 |
| 14 | 100.3 | 172.0 | 41.9 |
| 15 | 99.6 | 173.0 | 41.9 |
| 16 | 101.2 | 174.2 | 41.7 |
| 17 | 100.5 | 172.5 | 41.3 |
| 18 | 101.0 | 173.1 | 43.1 |
| 19 | 99.4 | 172.7 | 43.3 |
| 20 | 98.8 | 171.6 | 43.5 |
| 21 | 101.9 | 174.2 | 41.4 |
| 22 | 87.7 | 158.8 | 40.9 |
| 23 | 99.9 | 171.4 | 42.5 |
| 24 | 100.8 | 172.1 | 42.7 |
| 25 | 98.9 | 171.2 | 42.2 |
| 26 | 99.7 | 170.3 | 42.0 |
| 27 | 99.0 | 170.8 | 41.8 |
| 28 | 100.7 | 172.0 | 42.2 |
| 29 | 101.6 | 173.0 | 31.4 |
| 30 | 101.7 | 172.2 | 43.2 |

Sorted cold: 87.7, 97.4, 98.3, 98.4, 98.8, 98.8, 98.9, 99.0, 99.4, 99.4, 99.6, 99.7, 99.9, 100.0, 100.3, 100.4, 100.4, 100.5, 100.7, 100.7, 100.8, 100.8, 100.9, 101.0, 101.2, 101.3, 101.6, 101.7, 101.8, 101.9

Process launch to mark (not gated): p95 174.2 ms.

Sorted warm: 31.4, 36.1, 36.9, 40.9, 40.9, 41.3, 41.4, 41.7, 41.8, 41.9, 41.9, 42.0, 42.2, 42.2, 42.5, 42.6, 42.7, 42.7, 42.8, 42.9, 42.9, 42.9, 43.1, 43.2, 43.3, 43.5, 43.9, 44.2, 44.3, 45.1

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
