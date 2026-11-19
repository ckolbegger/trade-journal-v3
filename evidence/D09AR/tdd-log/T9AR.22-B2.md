# D09AR TDD log, T9AR.22-B2

One file per task (decision 111), so parallel lanes never edit one file. Tests only; no product code is mutated, so each row is a check in place of red.

| T9AR.22-B2 | I9AR.5 should give R-DALE-U Expiration fill nothing to measure, no odds on the final session and the Plan as before the end | check | `npm run test:integration -- tests/integration/d9ar/final.test.ts` with the test's own reading of the Plan column's odds made `undefined` (both sides) | exit 1; Tests  1 failed, 1 passed (2) | Error: no Plan odds |
| T9AR.22-B2 | I9AR.5 should give R-DALE-U Expiration fill nothing to measure, no odds on the final session and the Plan as before the end | green | `npm run test:integration -- tests/integration/d9ar/final.test.ts` (reading restored) | exit 0; Tests  2 passed (2) |  |
| T9AR.22-B2 | refactor | refactor | none | no change | Assertions added: the Plan odds are present (percent defined, and equal as text) on both sides; atStop and atTarget are NotApplicable:NoRemainingPosition on the Expiration's final session. |
