# D9.5 tech debt

Style-only ocr findings and low critic defects (the user's rule, 2026-11-19). Reviewed with the user after the final gate.

| Source | Kind | Item |
|---|---|---|
| ocr T95.3 (`2f9575d9`) | test coverage | `src/coordinators/daily-review/order.test.ts:60`: the "at its Target" case marks 56.50 against a 56.00 Target; no case checks a Mark exactly at the Target. |
| ocr T95.6 (`c0c8c27a`) | style | `tests/integration/d5r/support.ts:70`: `saveMarksFrom` keeps an unused `tradeId` parameter that its callers still pass. |
