# Timings, run td.11-dedup (2026-11-23, commit f7ff17c5 + uncommitted changes)

| Stage | Start | End | Wall | Tests | Playwright duration |
|---|---|---|---|---|---|
| Unit | 07:44:35 | 07:45:29 | 0:54 | 2832 passed (237 files) | n/a |
| Integration | 07:45:31 | 07:46:34 | 1:03 | 300 passed (141 files) | n/a |
| browser-1 | 07:46:37 | 07:52:07 | 5:30 | 127 passed | 5.5m |
| browser-2 | 07:52:13 | 07:57:29 | 5:16 | 79 passed | 5.2m |
| browser-3 | 07:57:33 | 08:02:00 | 4:27 | 55 passed | 4.4m |
| browser-4 | 08:02:04 | 08:08:26 | 6:22 | 114 passed, 4 skipped | 6.3m |
| Checks (14 commands, together) | 08:08:30 | 08:09:06 | 0:36 | 14 of 14 exit 0 | n/a |

Per-check times: the script records no per-command times, so only the 0:36 total for all 14 is known.

Total wall time: 07:44:35 to 08:09:06 = 24:31.

## Before and after (tests / time)

| Stage | t95.15 (before) | t95.14 (before) | td.11 (after) |
|---|---|---|---|
| Unit | 2832 | 2827 | 2832 |
| Integration | 300 | 300 | 300 |
| browser-1 | 127, 5.6m | 127, 5.6m | 127, 5.5m |
| browser-2 | 80, 5.3m | 80, 5.3m | 79, 5.2m |
| browser-3 | 57, 4.5m | 57, 4.6m | 55, 4.4m |
| browser-4 | 138 + 4 skipped, 7.5m | 137 + 4 skipped, 7.6m | 114 + 4 skipped, 6.3m |
| Browser total | 402 tests, 22.9m | 401 tests, 23.1m | 375 tests, 21.4m |
| Total wall | not in baseline copy read | 26:13 | 24:31 |
