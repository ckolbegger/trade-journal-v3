# D5 benchmark run (AC-PERF-001)

Written by `npm run bench:run` (T2.21, extended by T4.31 and T5.22) on 2026-10-30T16:24:27.141Z, at commit 7ea33847b1326705227354f3abdcfc6b427ea63f plus uncommitted changes to src, tools, bench or package.json.

## Result

| Measure | Runs | Nearest-rank p95 (29th of 30) | Budget | Result |
|---|---|---|---|---|
| Cold start to `tj:interactive` | 30 | 104.8 ms | 2,500 ms | pass |
| Warm Planned-to-Open switch to `tj:open-list-ready` | 30 | 43.6 ms | 1,500 ms | pass |

Open list compared with `bench/expected-open-rows.json`: before the runs 200 rows equal, after the runs 200 rows equal, and each of the 30 cold starts rendered the same 200 rows (figures included). The 10 Missing Instruments on the as-of date (ABBV, AVGO, CAT, QAM, QBB, QBQ, QCF, QCU, QDJ, QDY) have rows in that list, each showing `Mark missing` in P&L (and no other row does).

## As-of Review's due reflections (T5.22)

The harness opens the Review from the primary navigation and reads its blockers: each "Reflection due for X" or "N reflections due for X" is a reflection due at the as-of Review (Review Date 2028-12-29). The expected values are `asOfDueReflections` and the Trades of `outstandingDebts` in `bench/dataset.json` (the Outstanding Debts are from 2028-12-27 and 2028-12-28, both due at the as-of Review, decision 58). A difference fails the run.

| When | Due reflections listed (by Trade) | Expected | Result | Time from the click on Review to its status (disclosed, not gated) |
|---|---|---|---|---|
| before the runs | 2 (QAJ 2) | 2 (QAJ 2) | equal | 2342 ms |
| after the runs | 2 (QAJ 2) | 2 (QAJ 2) | equal | 2225 ms |

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
| 1 | 101.2 | 182.3 | 45.3 |
| 2 | 102.1 | 175.1 | 36.3 |
| 3 | 102.1 | 181.8 | 35.1 |
| 4 | 87.6 | 168.7 | 43.3 |
| 5 | 103.4 | 179.7 | 42.7 |
| 6 | 102.7 | 183.0 | 43.6 |
| 7 | 94.5 | 168.4 | 42.4 |
| 8 | 103.8 | 182.4 | 43.2 |
| 9 | 101.9 | 182.0 | 42.7 |
| 10 | 101.8 | 176.1 | 42.0 |
| 11 | 102.0 | 177.6 | 41.5 |
| 12 | 103.9 | 179.0 | 42.2 |
| 13 | 103.3 | 187.5 | 42.3 |
| 14 | 102.5 | 178.0 | 41.8 |
| 15 | 102.7 | 181.0 | 42.0 |
| 16 | 103.7 | 184.3 | 42.2 |
| 17 | 103.7 | 180.2 | 41.6 |
| 18 | 92.0 | 172.9 | 42.7 |
| 19 | 104.2 | 183.4 | 41.6 |
| 20 | 104.7 | 186.8 | 43.1 |
| 21 | 103.6 | 185.3 | 41.6 |
| 22 | 104.8 | 182.0 | 41.5 |
| 23 | 102.9 | 179.3 | 43.3 |
| 24 | 100.1 | 173.1 | 40.8 |
| 25 | 108.6 | 182.4 | 39.8 |
| 26 | 93.7 | 169.1 | 41.8 |
| 27 | 103.7 | 183.2 | 41.3 |
| 28 | 102.1 | 180.8 | 41.7 |
| 29 | 91.5 | 167.0 | 42.2 |
| 30 | 103.2 | 181.4 | 42.2 |

Sorted cold: 87.6, 91.5, 92.0, 93.7, 94.5, 100.1, 101.2, 101.8, 101.9, 102.0, 102.1, 102.1, 102.1, 102.5, 102.7, 102.7, 102.9, 103.2, 103.3, 103.4, 103.6, 103.7, 103.7, 103.7, 103.8, 103.9, 104.2, 104.7, 104.8, 108.6

Process launch to mark (not gated): p95 186.8 ms.

Sorted warm: 35.1, 36.3, 39.8, 40.8, 41.3, 41.5, 41.5, 41.6, 41.6, 41.6, 41.7, 41.8, 41.8, 42.0, 42.0, 42.2, 42.2, 42.2, 42.2, 42.3, 42.4, 42.7, 42.7, 42.7, 43.1, 43.2, 43.3, 43.3, 43.6, 45.3

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
