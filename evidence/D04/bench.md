# D4 benchmark run (AC-PERF-001)

Written by `npm run bench:run` (T2.21, extended by T4.31) on 2026-10-29T09:52:54.228Z.

## Result

| Measure | Runs | Nearest-rank p95 (29th of 30) | Budget | Result |
|---|---|---|---|---|
| Cold start to `tj:interactive` | 30 | 98.9 ms | 2,500 ms | pass |
| Warm Planned-to-Open switch to `tj:open-list-ready` | 30 | 44.4 ms | 1,500 ms | pass |

Open list compared with `bench/expected-open-rows.json`: before the runs 200 rows equal, after the runs 200 rows equal, and each of the 30 cold starts rendered the same 200 rows (figures included). The 10 Missing Instruments on the as-of date (ABBV, AVGO, CAT, QAM, QBB, QBQ, QCF, QCU, QDJ, QDY) have rows in that list.

## Method

- Playwright's clock also swaps `window.performance` for a fake that records no marks, so the harness keeps the real object before the pin and points the fake's `mark` at it; `performance.now` and timers are the real ones.
- `Date` is pinned to the dataset's as-of instant (2028-12-29T21:35:00.000Z, A52) with Playwright `context.clock.setFixedTime`; timers and `performance.now` are real, and the build is production.
- A copy of the cached profile (`.cache/bench/profile`, generator 2, schema 3) per run of the harness; the cached profile itself is never opened.
- The production build (`dist/`) served by the release harness server at http://localhost:5181, the origin the profile's IndexedDB belongs to.
- One warm-up launch, online, installs the service worker and is excluded. The server is then stopped and every later launch is offline (Playwright `offline: true`), so the app loads from the service worker and IndexedDB only.
- Cold start: the Chromium process is launched on the profile, navigates to the origin, and the time is the `tj:interactive` mark's `startTime` (from navigation start; readiness Writable and the Open list fully rendered with every row's figures, each run's rendered list compared with the expected rows afterwards); the process is then closed. The time from the call that launches the browser process to the same mark is recorded beside it for disclosure and is not gated.
- Warm switch: in one launched page, the Planned tab is opened and its first page rendered, then the Open tab is clicked; the time runs from the pointer press on the Open tab to the next `tj:open-list-ready` mark.

## Raw timings (ms, in run order)

| Run | Cold (navigation start to mark) | Cold, disclosed: process launch to mark | Warm |
|---|---|---|---|
| 1 | 98.9 | 169.7 | 41.4 |
| 2 | 95.8 | 166.1 | 40.4 |
| 3 | 95.5 | 164.2 | 35.5 |
| 4 | 80.8 | 150.6 | 37.1 |
| 5 | 94.1 | 164.2 | 43.7 |
| 6 | 91.9 | 161.6 | 34.7 |
| 7 | 91.9 | 160.4 | 36.0 |
| 8 | 90.2 | 160.1 | 38.6 |
| 9 | 93.0 | 161.2 | 42.6 |
| 10 | 94.9 | 172.0 | 36.4 |
| 11 | 99.3 | 171.4 | 41.0 |
| 12 | 92.2 | 162.4 | 44.0 |
| 13 | 93.0 | 160.5 | 38.6 |
| 14 | 91.9 | 158.4 | 44.4 |
| 15 | 93.7 | 161.8 | 43.9 |
| 16 | 91.6 | 160.0 | 45.4 |
| 17 | 88.9 | 156.4 | 43.5 |
| 18 | 93.6 | 161.0 | 35.1 |
| 19 | 95.8 | 163.4 | 35.4 |
| 20 | 91.0 | 157.3 | 41.2 |
| 21 | 93.5 | 160.7 | 40.2 |
| 22 | 94.2 | 162.2 | 36.3 |
| 23 | 90.6 | 158.8 | 43.1 |
| 24 | 91.9 | 159.5 | 43.3 |
| 25 | 94.0 | 161.7 | 42.3 |
| 26 | 92.0 | 159.6 | 40.7 |
| 27 | 89.9 | 156.5 | 41.3 |
| 28 | 93.4 | 161.0 | 42.4 |
| 29 | 91.3 | 158.6 | 36.2 |
| 30 | 93.1 | 160.9 | 41.3 |

Sorted cold: 80.8, 88.9, 89.9, 90.2, 90.6, 91.0, 91.3, 91.6, 91.9, 91.9, 91.9, 91.9, 92.0, 92.2, 93.0, 93.0, 93.1, 93.4, 93.5, 93.6, 93.7, 94.0, 94.1, 94.2, 94.9, 95.5, 95.8, 95.8, 98.9, 99.3

Process launch to mark (not gated): p95 171.4 ms.

Sorted warm: 34.7, 35.1, 35.4, 35.5, 36.0, 36.2, 36.3, 36.4, 37.1, 38.6, 38.6, 40.2, 40.4, 40.7, 41.0, 41.2, 41.3, 41.3, 41.4, 42.3, 42.4, 42.6, 43.1, 43.3, 43.5, 43.7, 43.9, 44.0, 44.4, 45.4

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
