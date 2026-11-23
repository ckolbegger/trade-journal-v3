# Timings, run st.11-setup-snapshot (2026-11-23, commit 3017a0cf + uncommitted changes)

| Stage | Start | End | Wall | Tests | Playwright duration |
|---|---|---|---|---|---|
| Unit | 12:18:25 | 12:19:19 | 0:54 | 2832 passed (237 files) | n/a |
| Integration | 12:19:21 | 12:20:18 | 0:57 | 300 passed (141 files) | n/a |
| browser-1 | 12:20:21 | 12:25:37 | 5:16 | 127 passed | 5.3m |
| browser-2 | 12:25:42 | 12:29:56 | 4:14 | 79 passed | 4.2m |
| browser-3 | 12:29:58 | 12:33:02 | 3:04 | 55 passed | 3.0m |
| browser-4 | 12:33:05 | 12:36:14 | 3:09 | 114 passed, 4 skipped | 3.1m |
| Checks (14 commands, together) | 12:36:19 | 12:36:57 | 0:38 | 14 of 14 exit 0 | n/a |

Per-check times: the script records no per-command times, so only the 0:38 total for all 14 is known.

Total wall time: 12:18:25 to 12:36:57 = 18:32.

## Before and after (tests / Playwright time)

| Stage | td.11 (before) | st.11 (after) |
|---|---|---|
| Unit | 2832 | 2832 |
| Integration | 300 | 300 |
| browser-1 | 127, 5.5m | 127, 5.3m |
| browser-2 | 79, 5.2m | 79, 4.2m |
| browser-3 | 55, 4.4m | 55, 3.0m |
| browser-4 | 114 + 4 skipped, 6.3m | 114 + 4 skipped, 3.1m |
| Browser total | 375 tests, 21.4m | 375 tests, 15.6m |
| Total wall | 24:31 | 18:32 |
