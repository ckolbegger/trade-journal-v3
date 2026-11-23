# D9.5 tech debt

Style-only ocr findings and low critic defects (the user's rule, 2026-11-19). Reviewed with the user after the final gate.

| Source | Kind | Item |
|---|---|---|
| ocr T95.3 (`2f9575d9`) | test coverage | `src/coordinators/daily-review/order.test.ts:60`: the "at its Target" case marks 56.50 against a 56.00 Target; no case checks a Mark exactly at the Target. |
| ocr T95.6 (`c0c8c27a`) | style | `tests/integration/d5r/support.ts:70`: `saveMarksFrom` keeps an unused `tradeId` parameter that its callers still pass. |
| run `t95.3-t95.5` | tooling | browser-2 (9.4 min) and browser-4 (13.7 min) passed the 8-minute mark the runner flags; add a browser-5 stage (partly load from the overlap trial). |
| runs `t95.3-t95.5`, `t95.6-t95.7` | flaky test | `tools/estimate-rules.test.ts:122` "should pass every file of the current tree" times out at 5 s under load (both runs, each beside a task); passes alone. |
| the user, 2026-11-22 | test tooling | About 25 post-save heading waits in e2e support helpers (Exit, Expiration, Restore recorded; `READY`, 20 s) would burn 20 s on a refused save; candidates for T95.7-F2's `savedUnlessRefused`. |

- T95.17 ocr (style): `src/ui/screens/ReviewCard.tsx` 332 and 334 use `atEntry != null`; the codebase uses strict checks.
