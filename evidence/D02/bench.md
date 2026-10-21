# D2 benchmark run (AC-PERF-001)

Written by `npm run bench:run` (T2.21) on 2026-10-21T22:27:48.128Z.

## Result

| Measure | Runs | Nearest-rank p95 (29th of 30) | Budget | Result |
|---|---|---|---|---|
| Cold start to `tj:interactive` | 30 | 88.8 ms | 2,500 ms | pass |
| Warm Planned-to-Open switch to `tj:open-list-ready` | 30 | 43.5 ms | 1,500 ms | pass |

Open list compared with `bench/expected-open-rows.json`: before the runs 200 rows equal, after the runs 200 rows equal.

## Method

- A copy of the cached profile (`.cache/bench/profile`, generator 1, schema 2) per run of the harness; the cached profile itself is never opened.
- The production build (`dist/`) served by the release harness server at http://localhost:5181, the origin the profile's IndexedDB belongs to.
- One warm-up launch, online, installs the service worker and is excluded. The server is then stopped and every later launch is offline (Playwright `offline: true`), so the app loads from the service worker and IndexedDB only.
- Cold start: the Chromium process is launched on the profile, navigates to the origin, and the time is the `tj:interactive` mark's `startTime` (from navigation start; readiness Writable and the Open list fully rendered, checked at 200 rows after each run); the process is then closed. The time from the call that launches the browser process to the same mark is recorded beside it for disclosure and is not gated.
- Warm switch: in one launched page, the Planned tab is opened and its first page rendered, then the Open tab is clicked; the time runs from the pointer press on the Open tab to the next `tj:open-list-ready` mark.

## Raw timings (ms, in run order)

| Run | Cold (navigation start to mark) | Cold, disclosed: process launch to mark | Warm |
|---|---|---|---|
| 1 | 86.2 | 159.8 | 43.5 |
| 2 | 74.8 | 140.8 | 27.5 |
| 3 | 86.9 | 158.4 | 44.5 |
| 4 | 73.2 | 142.6 | 29.1 |
| 5 | 86.4 | 153.7 | 28.0 |
| 6 | 87.3 | 156.0 | 30.2 |
| 7 | 74.6 | 144.3 | 29.9 |
| 8 | 75.1 | 140.9 | 30.7 |
| 9 | 87.6 | 157.3 | 28.8 |
| 10 | 75.0 | 141.9 | 28.9 |
| 11 | 85.9 | 155.7 | 29.6 |
| 12 | 84.1 | 153.7 | 29.0 |
| 13 | 85.2 | 150.9 | 30.8 |
| 14 | 76.4 | 147.2 | 29.5 |
| 15 | 74.8 | 144.2 | 30.1 |
| 16 | 86.6 | 153.9 | 28.6 |
| 17 | 88.8 | 159.9 | 30.0 |
| 18 | 74.2 | 144.9 | 28.4 |
| 19 | 74.3 | 141.2 | 29.2 |
| 20 | 76.7 | 150.3 | 30.4 |
| 21 | 86.2 | 155.9 | 28.4 |
| 22 | 75.0 | 141.3 | 28.5 |
| 23 | 89.4 | 159.4 | 28.1 |
| 24 | 75.3 | 147.1 | 29.4 |
| 25 | 86.8 | 152.9 | 29.1 |
| 26 | 88.4 | 157.0 | 31.0 |
| 27 | 88.4 | 157.5 | 28.2 |
| 28 | 72.8 | 139.6 | 29.5 |
| 29 | 87.4 | 155.9 | 26.4 |
| 30 | 74.3 | 143.2 | 28.9 |

Sorted cold: 72.8, 73.2, 74.2, 74.3, 74.3, 74.6, 74.8, 74.8, 75.0, 75.0, 75.1, 75.3, 76.4, 76.7, 84.1, 85.2, 85.9, 86.2, 86.2, 86.4, 86.6, 86.8, 86.9, 87.3, 87.4, 87.6, 88.4, 88.4, 88.8, 89.4

Process launch to mark (not gated): p95 159.8 ms.

Sorted warm: 26.4, 27.5, 28.0, 28.1, 28.2, 28.4, 28.4, 28.5, 28.6, 28.8, 28.9, 28.9, 29.0, 29.1, 29.1, 29.2, 29.4, 29.5, 29.5, 29.6, 29.9, 30.0, 30.1, 30.2, 30.4, 30.7, 30.8, 31.0, 43.5, 44.5

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
  "generatorVersion": 1,
  "schemaVersion": 2,
  "seed": 20211011,
  "clockStart": "2021-10-11T13:00:00Z",
  "timeZone": "America/New_York",
  "origin": "http://localhost:5181",
  "buildDir": "dist-bench",
  "benchRelease": "91101607b8f6f4b60b0939fb52811a1f02f746cc103eaf3556f08da0e6e04bfc",
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
    "strategies": 1
  },
  "generationMs": 34707,
  "generatedAt": "2026-10-21T19:01:35.395Z",
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
