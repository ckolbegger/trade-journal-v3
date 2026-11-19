# D09AR TDD log, T9AR.3

One file per task (decision 111), so parallel lanes never edit one file. Each row is one single-case run; see `../tdd-log.md` for the rules.

| T9AR.3 | should give R-DALE-D on Wed 11-11 a chance | red | `npx vitest run src/domain/trade-analysis/odds.test.ts -t "should give R-DALE-D on Wed 11-11 a chance"` | exit 1; Tests  1 failed (1) | AssertionError: expected undefined to be 'Value' // Object.is equality  |
| T9AR.3 | should give R-DALE-D on Wed 11-11 a chance | green | `npx vitest run src/domain/trade-analysis/odds.test.ts -t "should give R-DALE-D on Wed 11-11 a chance"` | exit 0; Tests  1 passed (1) |  |
| T9AR.3 | should give the pair as whole percents | red | `npx vitest run src/domain/trade-analysis/odds.test.ts -t "should give the pair as whole percents"` | exit 1; Tests  1 failed, 1 skipped (2) | AssertionError: expected [ '0/1', '0/1' ] to deeply equal [ '8/1', '92/1' ]  |
| T9AR.3 | should give the pair as whole percents | green | `npx vitest run src/domain/trade-analysis/odds.test.ts -t "should give the pair as whole percents"` | exit 0; Tests  1 passed, 1 skipped (2) |  |
| T9AR.3 | should give the ratio's own result | red | `npx vitest run src/domain/trade-analysis/odds.test.ts -t "should give the ratio's own result"` | exit 1; Tests  1 failed, 2 skipped (3) | AssertionError: expected { kind: 'Value', value: { …(3) } } to deeply equal { kind: 'NotApplicable', …(1) }  |
| T9AR.3 | should give the ratio's own result | green | `npx vitest run src/domain/trade-analysis/odds.test.ts -t "should give the ratio's own result"` | exit 0; Tests  1 passed, 2 skipped (3) |  |
| T9AR.3 | should give the Plan's own odds | red | `npx vitest run src/domain/trade-analysis/odds.test.ts -t "should give the Plan's own odds"` | exit 1; Tests  1 failed, 3 skipped (4) | Error: expected a Value  |
| T9AR.3 | should give the Plan's own odds | green | `npx vitest run src/domain/trade-analysis/odds.test.ts -t "should give the Plan's own odds"` | exit 0; Tests  1 passed, 3 skipped (4) |  |
| T9AR.3 | should call the extremes Remote | red | `npx vitest run src/domain/trade-analysis/odds.test.ts -t "should call the extremes Remote"` | exit 1; Tests  1 failed, 5 skipped (6) | AssertionError: expected undefined to be 'Remote' // Object.is equality  |
| T9AR.3 | should call the extremes Remote | green | `npx vitest run src/domain/trade-analysis/odds.test.ts -t "should call the extremes Remote"` | exit 0; Tests  1 passed, 5 skipped (6) |  |
| T9AR.3 | should call them Main | red | `npx vitest run src/domain/trade-analysis/odds.test.ts -t "should call them Main"` | exit 1; Tests  1 failed, 5 skipped (6) | AssertionError: expected 'Remote' to be 'Main' // Object.is equality Expected: "Main"  |
| T9AR.3 | should call them Main | green | `npx vitest run src/domain/trade-analysis/odds.test.ts -t "should call them Main"` | exit 0; Tests  1 passed, 5 skipped (6) |  |
| refactor | T9AR.3 | no change | Reviewed oddsOf and the extremes rule; nothing earned a change. Test names unchanged. | 
