# D4 benchmark run (AC-PERF-001)

Written by `npm run bench:run` (T2.21, extended by T4.31) on 2026-10-29T21:57:10.265Z.

## Result

| Measure | Runs | Nearest-rank p95 (29th of 30) | Budget | Result |
|---|---|---|---|---|
| Cold start to `tj:interactive` | 30 | 103.9 ms | 2,500 ms | pass |
| Warm Planned-to-Open switch to `tj:open-list-ready` | 30 | 44.6 ms | 1,500 ms | pass |

Open list compared with `bench/expected-open-rows.json`: before the runs 200 rows equal, after the runs 200 rows equal, and each of the 30 cold starts rendered the same 200 rows (figures included). The 10 Missing Instruments on the as-of date (ABBV, AVGO, CAT, QAM, QBB, QBQ, QCF, QCU, QDJ, QDY) have rows in that list, each showing `Mark missing` in P&L (and no other row does).

## Superseded run (T4.31, before T4.31-B1)

The earlier run pinned only `Date`, so the application's Temporal clock read the real day and the Open list (and the expected rows captured the same way) was rendered for a different Expected Mark Date: 87 rows showed `Awaiting the next close` and no row showed `Mark missing`. Its figures are not valid evidence for the as-of dataset: cold p95 98.9 ms (median 93.0 ms), warm p95 44.4 ms (median 41.1 ms), process launch to mark p95 171.4 ms.

## Method

- Playwright's clock also swaps `window.performance` for a fake that records no marks, so the harness keeps the real object before the pin and points the fake's `mark` at it; `performance.now` and timers are the real ones.
- `Date` is pinned to the dataset's as-of instant (2028-12-29T21:35:00.000Z, A52) with Playwright `context.clock.setFixedTime`, and native `Temporal.Now.instant` (the application's clock) is pointed at it (T4.31-B1); every comparison first checks both read the as-of instant and that exactly the Missing Instruments' rows show `Mark missing`. Timers and `performance.now` are real, and the build is production.
- A copy of the cached profile (`.cache/bench/profile`, generator 2, schema 3) per run of the harness; the cached profile itself is never opened.
- The production build (`dist/`) served by the release harness server at http://localhost:5181, the origin the profile's IndexedDB belongs to.
- One warm-up launch, online, installs the service worker and is excluded. The server is then stopped and every later launch is offline (Playwright `offline: true`), so the app loads from the service worker and IndexedDB only.
- Cold start: the Chromium process is launched on the profile, navigates to the origin, and the time is the `tj:interactive` mark's `startTime` (from navigation start; readiness Writable and the Open list fully rendered with every row's figures, each run's rendered list compared with the expected rows afterwards); the process is then closed. The time from the call that launches the browser process to the same mark is recorded beside it for disclosure and is not gated.
- Warm switch: in one launched page, the Planned tab is opened and its first page rendered, then the Open tab is clicked; the time runs from the pointer press on the Open tab to the next `tj:open-list-ready` mark.

## Raw timings (ms, in run order)

| Run | Cold (navigation start to mark) | Cold, disclosed: process launch to mark | Warm |
|---|---|---|---|
| 1 | 95.8 | 183.2 | 45.4 |
| 2 | 96.7 | 176.2 | 44.3 |
| 3 | 94.4 | 171.9 | 44.2 |
| 4 | 94.5 | 176.3 | 43.5 |
| 5 | 94.6 | 176.3 | 43.6 |
| 6 | 99.2 | 184.0 | 44.5 |
| 7 | 93.3 | 184.4 | 42.1 |
| 8 | 101.2 | 187.7 | 42.6 |
| 9 | 96.7 | 182.9 | 43.5 |
| 10 | 94.4 | 167.4 | 43.7 |
| 11 | 104.1 | 184.3 | 41.9 |
| 12 | 100.6 | 186.7 | 43.0 |
| 13 | 97.5 | 175.8 | 41.8 |
| 14 | 95.3 | 176.1 | 43.1 |
| 15 | 103.4 | 185.5 | 42.0 |
| 16 | 99.9 | 180.1 | 43.0 |
| 17 | 98.5 | 184.3 | 42.8 |
| 18 | 95.3 | 173.6 | 41.4 |
| 19 | 95.8 | 177.0 | 44.6 |
| 20 | 95.4 | 177.6 | 42.0 |
| 21 | 99.5 | 182.4 | 41.3 |
| 22 | 95.5 | 176.3 | 42.1 |
| 23 | 95.1 | 175.3 | 41.8 |
| 24 | 95.7 | 179.6 | 42.4 |
| 25 | 102.4 | 183.6 | 41.9 |
| 26 | 99.8 | 186.3 | 41.1 |
| 27 | 98.0 | 181.2 | 42.8 |
| 28 | 103.9 | 195.9 | 41.1 |
| 29 | 97.1 | 181.6 | 42.4 |
| 30 | 98.2 | 183.7 | 42.2 |

Sorted cold: 93.3, 94.4, 94.4, 94.5, 94.6, 95.1, 95.3, 95.3, 95.4, 95.5, 95.7, 95.8, 95.8, 96.7, 96.7, 97.1, 97.5, 98.0, 98.2, 98.5, 99.2, 99.5, 99.8, 99.9, 100.6, 101.2, 102.4, 103.4, 103.9, 104.1

Process launch to mark (not gated): p95 187.7 ms.

Sorted warm: 41.1, 41.1, 41.3, 41.4, 41.8, 41.8, 41.9, 41.9, 42.0, 42.0, 42.1, 42.1, 42.2, 42.4, 42.4, 42.6, 42.8, 42.8, 43.0, 43.0, 43.1, 43.5, 43.5, 43.6, 43.7, 44.2, 44.3, 44.5, 44.6, 45.4

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
  "generatorVersion": 2,
  "schemaVersion": 3,
  "seed": 20211011,
  "clockStart": "2024-01-02T13:00:00Z",
  "timeZone": "America/New_York",
  "origin": "http://localhost:5181",
  "buildDir": "dist-bench",
  "benchRelease": "290485a213580a468506ceb82844d7af759de4f9b907dde7db298b3c18b6ebc6",
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
    "positionChangeReflectionEntries": 320,
    "positionChangeReflectionDeclines": 80,
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
    "editedActions": 2509
  },
  "actionsByChoice": {
    "Exit": 6271,
    "Roll": 6271,
    "Adjust": 6271,
    "Hold": 106591
  },
  "generationMs": 5445378,
  "generatedAt": "2026-10-29T09:38:59.354Z",
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
