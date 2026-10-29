# D4 benchmark run (AC-PERF-001)

Written by `npm run bench:run` (T2.21, extended by T4.31) on 2026-10-29T11:00:07.274Z.

## Result

| Measure | Runs | Nearest-rank p95 (29th of 30) | Budget | Result |
|---|---|---|---|---|
| Cold start to `tj:interactive` | 30 | 107.3 ms | 2,500 ms | pass |
| Warm Planned-to-Open switch to `tj:open-list-ready` | 30 | 46.1 ms | 1,500 ms | pass |

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
| 1 | 93.1 | 164.5 | 46.1 |
| 2 | 92.9 | 164.2 | 46.5 |
| 3 | 106.2 | 178.9 | 44.3 |
| 4 | 94.5 | 165.4 | 44.1 |
| 5 | 95.7 | 166.2 | 44.1 |
| 6 | 92.8 | 164.3 | 43.7 |
| 7 | 96.3 | 167.6 | 44.7 |
| 8 | 105.9 | 177.0 | 42.9 |
| 9 | 95.6 | 167.1 | 41.0 |
| 10 | 107.3 | 178.6 | 43.0 |
| 11 | 93.2 | 163.5 | 42.0 |
| 12 | 95.1 | 165.6 | 41.6 |
| 13 | 109.8 | 181.0 | 42.2 |
| 14 | 98.9 | 169.4 | 42.4 |
| 15 | 96.7 | 167.2 | 44.0 |
| 16 | 96.6 | 167.2 | 42.0 |
| 17 | 94.3 | 166.3 | 42.8 |
| 18 | 95.6 | 167.1 | 41.8 |
| 19 | 95.7 | 166.3 | 42.4 |
| 20 | 98.0 | 168.8 | 42.4 |
| 21 | 96.2 | 167.6 | 40.4 |
| 22 | 97.2 | 169.3 | 42.3 |
| 23 | 93.1 | 163.9 | 41.9 |
| 24 | 93.0 | 163.9 | 42.6 |
| 25 | 93.9 | 165.1 | 40.9 |
| 26 | 96.7 | 167.7 | 42.4 |
| 27 | 95.6 | 167.6 | 42.8 |
| 28 | 93.6 | 164.9 | 42.5 |
| 29 | 95.6 | 166.6 | 41.9 |
| 30 | 96.5 | 168.6 | 40.9 |

Sorted cold: 92.8, 92.9, 93.0, 93.1, 93.1, 93.2, 93.6, 93.9, 94.3, 94.5, 95.1, 95.6, 95.6, 95.6, 95.6, 95.7, 95.7, 96.2, 96.3, 96.5, 96.6, 96.7, 96.7, 97.2, 98.0, 98.9, 105.9, 106.2, 107.3, 109.8

Process launch to mark (not gated): p95 178.9 ms.

Sorted warm: 40.4, 40.9, 40.9, 41.0, 41.6, 41.8, 41.9, 41.9, 42.0, 42.0, 42.2, 42.3, 42.4, 42.4, 42.4, 42.4, 42.5, 42.6, 42.8, 42.8, 42.9, 43.0, 43.7, 44.0, 44.1, 44.1, 44.3, 44.7, 46.1, 46.5

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
