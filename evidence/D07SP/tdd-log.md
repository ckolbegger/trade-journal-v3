# D7S prefactor TDD log

Each row is one `it should` case run alone (`-t` filter), so counts read "1 passed, N skipped". Complete cumulative suite runs are recorded in `structural.md` with full outputs in `suite-runs/`.

Every `it should` case from the D7S prefactor breakdown, section 3, run red and then green, one at a time (kickoff prompt; breakdown, section 3). Each row is one run: the task, the case, the phase, the exact command, the exit code with the test summary, and an excerpt of the failure for red runs. A red row is valid only when it fails because the planned behavior is absent or incorrect; a red run that passes or fails for another reason is fixed and rerun, never skipped. A first-run pass carries its mutation check (an assertion failure or runtime exception, never a compile error) and is listed in the handoff's open questions. `tdd.sh` runs Vitest only, so Playwright reds and greens are logged by hand.

| Task | Case | Phase | Command | Outcome | Failure excerpt |
|---|---|---|---|---|---|
| T7SP.1 | should say the contract has not expired on Thu 11-19 or Fri 11-20, and has expired on Sat 11-21 and Mon 11-23 | red | `npx vitest run src/domain/instrument/instrument.test.ts -t "should say the contract has not expired on Thu 11-19 or Fri 11-20, and has expired on Sat 11-21 and Mon 11-23"` | exit 1; Tests  1 failed, 9 skipped (10) | TypeError: expiredOn is not a function  |
| T7SP.1 | should say the contract has not expired on Thu 11-19 or Fri 11-20, and has expired on Sat 11-21 and Mon 11-23 | green | `npx vitest run src/domain/instrument/instrument.test.ts -t "should say the contract has not expired on Thu 11-19 or Fri 11-20, and has expired on Sat 11-21 and Mon 11-23"` | exit 0; Tests  1 passed, 9 skipped (10) |  |
| T7SP.1 | should say Settlement is not due on Thu 11-19, and is due on Fri 11-20, Sat 11-21 and Mon 11-23 | red | `npx vitest run src/domain/instrument/instrument.test.ts -t "should say Settlement is not due on Thu 11-19, and is due on Fri 11-20, Sat 11-21 and Mon 11-23"` | exit 1; Tests  1 failed, 10 skipped (11) | TypeError: settlementDueOn is not a function  |
| T7SP.1 | should say Settlement is not due on Thu 11-19, and is due on Fri 11-20, Sat 11-21 and Mon 11-23 | green | `npx vitest run src/domain/instrument/instrument.test.ts -t "should say Settlement is not due on Thu 11-19, and is due on Fri 11-20, Sat 11-21 and Mon 11-23"` | exit 0; Tests  1 passed, 10 skipped (11) |  |
| T7SP.1 | both cases | refactor | n/a | n/a | Reviewed: two one-line comparisons with comments; nothing to change. No test renamed, no assertion added beyond the planned wording except an instrumentKey check pinning the contract to XYZ261120C00055000. |
| T7SP.3 | should give O-C contract position the status Live at Thu 11-19 | red | `npx vitest run src/domain/trade-analysis/contract-status.test.ts -t "should give O-C contract position the status Live at Thu 11-19"` | exit 1; Tests  1 failed, 5 skipped (6) | AssertionError: expected undefined to be '2026-11-19' // Object.is equality  |
| T7SP.3 | should give O-C contract position the status Live at Thu 11-19 | green | `npx vitest run src/domain/trade-analysis/contract-status.test.ts -t "should give O-C contract position the status Live at Thu 11-19"` | exit 0; Tests  1 passed, 5 skipped (6) |  |
| T7SP.3 | should give it DueToday at Fri 11-20, still requiring the contract Mark and XYZ Mark | red | `npx vitest run src/domain/trade-analysis/contract-status.test.ts -t "should give it DueToday at Fri 11-20, still requiring the contract Mark and XYZ Mark"` | exit 1; Tests  1 failed, 5 skipped (6) | AssertionError: expected [ { instrument: { …(7) }, …(1) } ] to deeply equal [ { instrument: { …(7) }, …(1) } ]  |
| T7SP.3 | should give it DueToday at Fri 11-20, still requiring the contract Mark and XYZ Mark | green | `npx vitest run src/domain/trade-analysis/contract-status.test.ts -t "should give it DueToday at Fri 11-20, still requiring the contract Mark and XYZ Mark"` | exit 0; Tests  1 passed, 5 skipped (6) |  |
| T7SP.3 | should give it PastExpiration at Mon 11-23, requiring neither Mark | red | `npx vitest run src/domain/trade-analysis/contract-status.test.ts -t "should give it PastExpiration at Mon 11-23, requiring neither Mark"` | exit 1; Tests  1 failed, 5 skipped (6) | AssertionError: expected [ { instrument: { …(7) }, …(1) } ] to deeply equal [ { instrument: { …(7) }, …(1) } ]  |
| T7SP.3 | should give it PastExpiration at Mon 11-23, requiring neither Mark | green | `npx vitest run src/domain/trade-analysis/contract-status.test.ts -t "should give it PastExpiration at Mon 11-23, requiring neither Mark"` | exit 0; Tests  1 passed, 5 skipped (6) |  |
| T7SP.3 | should give O-S short contract the same three statuses on the same dates | green | `npx vitest run src/domain/trade-analysis/contract-status.test.ts -t "should give O-S short contract the same three statuses on the same dates"` | exit 0; Tests  1 passed, 5 skipped (6) |  |
| T7SP.3 | should give no status to a stock position, or to a contract once its quantity is closed | green | `npx vitest run src/domain/trade-analysis/contract-status.test.ts -t "should give no status to a stock position, or to a contract once its quantity is closed"` | exit 0; Tests  1 passed, 5 skipped (6) |  |
| T7SP.3 | should give no status and no requirements when derive has no valuation date | green | `npx vitest run src/domain/trade-analysis/contract-status.test.ts -t "should give no status and no requirements when derive has no valuation date"` | exit 0; Tests  1 passed, 5 skipped (6) |  |
| T7SP.3 | should give O-S short contract the same three statuses on the same dates | green | `npx vitest run src/domain/trade-analysis/contract-status.test.ts -t "should give O-S short contract the same three statuses on the same dates"` | exit 0; Tests  1 passed, 5 skipped (6) |  |
| T7SP.3 | should give no status to a stock position, or to a contract once its quantity is closed | green | `npx vitest run src/domain/trade-analysis/contract-status.test.ts -t "should give no status to a stock position, or to a contract once its quantity is closed"` | exit 0; Tests  1 passed, 5 skipped (6) |  |
| T7SP.3 | should give no status and no requirements when derive has no valuation date | green | `npx vitest run src/domain/trade-analysis/contract-status.test.ts -t "should give no status and no requirements when derive has no valuation date"` | exit 0; Tests  1 passed, 5 skipped (6) |  |
| T7SP.3 | should give it PastExpiration at Mon 11-23, requiring neither Mark | green | `npx vitest run src/domain/trade-analysis/contract-status.test.ts -t "should give it PastExpiration at Mon 11-23, requiring neither Mark"` | exit 0; Tests  1 passed, 5 skipped (6) |  |
| T7SP.3 | O-S short contract same three statuses | note | `npx vitest run src/domain/trade-analysis/contract-status.test.ts -t "should give O-S short contract the same three statuses on the same dates"` | First-run pass, flagged for the user. Built by the first three cases (the status code is not sign-specific). Mutation: short positions (negative quantity) always Live. | AssertionError: expected [ 'Live' ] to deeply equal [ 'DueToday' ] |
| T7SP.3 | no status for stock or closed contract | note | `npx vitest run src/domain/trade-analysis/contract-status.test.ts -t "should give no status to a stock position"` | First-run pass, flagged for the user. Built by the first case (the stock and zero-quantity guard). Mutation: dropped the zero-quantity guard. | AssertionError: expected [ { instrument: ... } ] to deeply equal [] |
| T7SP.3 | no status and no requirements without valuation date | note | `npx vitest run src/domain/trade-analysis/contract-status.test.ts -t "should give no status and no requirements"` | First-run pass, flagged for the user. Built by the first case (statuses empty without a date; requirements already empty). Mutation: statuses computed with a fallback date 2026-11-20. | AssertionError: expected [ { instrument: ... } ] to deeply equal [] |
| T7SP.3 | requirement halves of DueToday and PastExpiration cases | note | `npx vitest run src/domain/trade-analysis/contract-status.test.ts -t "should give it DueToday at Fri"` and `-t "should give it PastExpiration at Mon"` | Requirement rule now follows the status (replacing the raw comparison); not a separate first-run pass. Mutation A (requirements from Live alone: filter out every non-Live status) fails the DueToday case; mutation B (requirements ignoring status) fails the PastExpiration case. | AssertionError: expected [ { instrument: ... } ] to deeply equal [] (both) |
| T7SP.3 | all cases | refactor | n/a | n/a | Reviewed: contractStatusesOf is a single pass, requirements read the statuses; nothing to change. Test names rephrased to drop apostrophes (contract Mark and XYZ Mark; O-C contract position; O-S short contract). Extra assertions: O-S instruments and requirements at 11-20 and 11-23. |
| T7SP.4 | should throw when the frame trading date differs from the state valuation date | red | `npx vitest run src/domain/trade-analysis/evaluate-status.test.ts -t "should throw when the frame trading date differs from the state valuation date"` | exit 1; Tests  1 failed, 2 skipped (3) | AssertionError: expected [Function] to throw an error  |
| T7SP.4 | should throw when the frame trading date differs from the state valuation date | green | `npx vitest run src/domain/trade-analysis/evaluate-status.test.ts -t "should throw when the frame trading date differs from the state valuation date"` | exit 1; Tests  no tests | Error: Transform failed with 1 error:  |
| T7SP.4 | should throw when the frame trading date differs from the state valuation date | green | `npx vitest run src/domain/trade-analysis/evaluate-status.test.ts -t "should throw when the frame trading date differs from the state valuation date"` | exit 0; Tests  1 passed, 2 skipped (3) |  |
| T7SP.4 | should return the Mark-dependent figures Unavailable | green | `npx vitest run src/domain/trade-analysis/evaluate-status.test.ts -t "should return the Mark-dependent figures Unavailable"` | exit 0; Tests  1 passed, 2 skipped (3) |  |
| T7SP.4 | should return a settlement item Due for a DueToday | green | `npx vitest run src/domain/trade-analysis/evaluate-status.test.ts -t "should return a settlement item Due for a DueToday"` | exit 0; Tests  1 passed, 2 skipped (3) |  |
| T7SP.4 | PastExpiration figures SettlementDue and item Due | note | `npx vitest run src/domain/trade-analysis/evaluate-status.test.ts -t "should return the Mark-dependent figures Unavailable"` | First-run pass, flagged for the user. Built by D7 T7.6 (date comparison), kept green through the switch to the status. Mutation: derive's contractStatusesOf gives PastExpiration as Live. | AssertionError: expected [ 'NotYetDue' ] to deeply equal [ 'Due' ] |
| T7SP.4 | DueToday item Due, figures from the Mark | note | `npx vitest run src/domain/trade-analysis/evaluate-status.test.ts -t "should return a settlement item Due for a DueToday"` | First-run pass, flagged for the user. Built by D7 T7.6; kept green through the switch to the status. Mutation: derive's contractStatusesOf gives DueToday as Live. | AssertionError: expected [ 'NotYetDue' ] to deeply equal [ 'Due' ] |
| T7SP.4 | all cases | refactor | n/a | n/a | Reviewed: one local contractStatusOf lookup serves both reads; contractStatusesOf exported from derive.ts for the temporary fallback (state without valuationDate, removed by T7SP.8). Test names rephrased to drop apostrophes (frame trading date, state valuation date). |
| T7SP.5 | should resolve the trading date and close once at open for a Current, a Review and a Historical context | red | `npx vitest run src/modules/market-data/read-session.test.ts -t "should resolve the trading date and close once at open for a Current, a Review and a Historical context"` | exit 1; Tests  1 failed (1) | TypeError: marketData.openReadSession is not a function  |
| T7SP.5 | should resolve the trading date and close once at open for a Current, a Review and a Historical context | green | `npx vitest run src/modules/market-data/read-session.test.ts -t "should resolve the trading date and close once at open for a Current, a Review and a Historical context"` | exit 0; Tests  1 passed (1) |  |
| T7SP.5 | should open outside coverage with the as-of exchange date, covered false, and answer every frame with no Mark, as ResolveFrames does today | red | `npx vitest run src/modules/market-data/read-session.test.ts -t "should open outside coverage with the as-of exchange date, covered false, and answer every frame with no Mark, as ResolveFrames does today"` | exit 1; Tests  1 failed, 1 skipped (2) | Error: no read session for {"kind":"Current","asOf":"2023-12-29T21:00:00Z"}  |
| T7SP.5 | should open outside coverage with the as-of exchange date, covered false, and answer every frame with no Mark, as ResolveFrames does today | green | `npx vitest run src/modules/market-data/read-session.test.ts -t "should open outside coverage with the as-of exchange date, covered false, and answer every frame with no Mark, as ResolveFrames does today"` | exit 0; Tests  1 passed, 1 skipped (2) |  |
| T7SP.5 | should return each Instrument's frame equal to ResolveFrames' frame for it alone | red | `npx vitest run src/modules/market-data/read-session.test.ts -t "should return each Instrument's frame equal to ResolveFrames' frame for it alone"` | exit 1; Tests  1 failed, 2 skipped (3) | AssertionError: expected [] to deeply equal [ 'XYZ', 'OLD', 'ACK', 'NONE' ]  |
| T7SP.5 | should return each Instrument's frame equal to ResolveFrames' frame for it alone | green | `npx vitest run src/modules/market-data/read-session.test.ts -t "should return each Instrument's frame equal to ResolveFrames' frame for it alone"` | exit 0; Tests  1 passed, 2 skipped (3) |  |
| T7SP.5 | should read a date's observations once when three calls ask for frames on it, for different Instruments | red | `npx vitest run src/modules/market-data/read-session.test.ts -t "should read a date's observations once when three calls ask for frames on it, for different Instruments"` | exit 1; Tests  1 failed, 3 skipped (4) | AssertionError: expected [ { on: 'store', …(2) }, …(5) ] to deeply equal [ { on: 'store', …(2) } ]  |
| T7SP.5 | should read a date's observations once when three calls ask for frames on it, for different Instruments | green | `npx vitest run src/modules/market-data/read-session.test.ts -t "should read a date's observations once when three calls ask for frames on it, for different Instruments"` | exit 1; Tests  1 failed, 3 skipped (4) | AssertionError: expected [ { on: 'store', …(2) }, …(4) ] to deeply equal [ { on: 'store', …(2) } ]  |
| T7SP.5 | should read a date's observations once when three calls ask for frames on it, for different Instruments | green | `npx vitest run src/modules/market-data/read-session.test.ts -t "should read a date's observations once when three calls ask for frames on it, for different Instruments"` | exit 0; Tests  1 passed, 3 skipped (4) |  |
| T7SP.5 | should look up an Instrument's Stale context once when two calls ask for its frame | red | `npx vitest run src/modules/market-data/read-session.test.ts -t "should look up an Instrument's Stale context once when two calls ask for its frame"` | exit 1; Tests  1 failed, 4 skipped (5) | AssertionError: expected 'Missing' to be 'Stale' // Object.is equality Expected: "Stale"  |
| T7SP.5 | should look up an Instrument's Stale context once when two calls ask for its frame | red | `npx vitest run src/modules/market-data/read-session.test.ts -t "should look up an Instrument's Stale context once when two calls ask for its frame"` | exit 1; Tests  1 failed, 4 skipped (5) | AssertionError: expected [ { on: 'store', …(2) }, …(2) ] to deeply equal [ { on: 'store', …(2) }, …(1) ]  |
| T7SP.5 | should look up an Instrument's Stale context once when two calls ask for its frame | green | `npx vitest run src/modules/market-data/read-session.test.ts -t "should look up an Instrument's Stale context once when two calls ask for its frame"` | exit 0; Tests  1 passed, 4 skipped (5) |  |
| T7SP.5 | should look up an Instrument's Stale context once when two calls ask for its frame | green | `npx vitest run src/modules/market-data/read-session.test.ts -t "should look up an Instrument's Stale context once when two calls ask for its frame"` | exit 0; Tests  1 passed, 4 skipped (5) |  |
| T7SP.5 | should read an earlier date's observations once for every historicalFrames call on that date, and once more for a second date | red | `npx vitest run src/modules/market-data/read-session.test.ts -t "should read an earlier date's observations once for every historicalFrames call on that date, and once more for a second date"` | exit 1; Tests  1 failed, 5 skipped (6) | TypeError: session.historicalFrames is not a function  |
| T7SP.5 | should read an earlier date's observations once for every historicalFrames call on that date, and once more for a second date | green | `npx vitest run src/modules/market-data/read-session.test.ts -t "should read an earlier date's observations once for every historicalFrames call on that date, and once more for a second date"` | exit 0; Tests  1 passed, 5 skipped (6) |  |
| T7SP.5 | should return each Instrument's gaps as recover does, scanning each Instrument once however many calls ask | red | `npx vitest run src/modules/market-data/read-session.test.ts -t "should return each Instrument's gaps as recover does, scanning each Instrument once however many calls ask"` | exit 1; Tests  1 failed, 6 skipped (7) | TypeError: session.gaps is not a function  |
| T7SP.5 | should return each Instrument's gaps as recover does, scanning each Instrument once however many calls ask | green | `npx vitest run src/modules/market-data/read-session.test.ts -t "should return each Instrument's gaps as recover does, scanning each Instrument once however many calls ask"` | exit 1; Tests  1 failed, 6 skipped (7) | AssertionError: expected [ { on: 'index', …(3) } ] to deeply equal [ { on: 'index', …(3) }, …(2) ]  |
| T7SP.5 | should return each Instrument's gaps as recover does, scanning each Instrument once however many calls ask | green | `npx vitest run src/modules/market-data/read-session.test.ts -t "should return each Instrument's gaps as recover does, scanning each Instrument once however many calls ask"` | exit 0; Tests  1 passed, 6 skipped (7) |  |
| T7SP.5 | should give a settlement time for an expiration date from the calendar with no stored read, and the latest session's close for a date that isn't one | red | `npx vitest run src/modules/market-data/read-session.test.ts -t "should give a settlement time for an expiration date from the calendar with no stored read, and the latest session's close for a date that isn't one"` | exit 1; Tests  1 failed, 7 skipped (8) | TypeError: session.settlementTime is not a function  |
| T7SP.5 | should give a settlement time for an expiration date from the calendar with no stored read, and the latest session's close for a date that isn't one | green | `npx vitest run src/modules/market-data/read-session.test.ts -t "should give a settlement time for an expiration date from the calendar with no stored read, and the latest session's close for a date that isn't one"` | exit 1; Tests  1 failed, 7 skipped (8) | AssertionError: expected { kind: 'Value', …(1) } to deeply equal { kind: 'Value', value: undefined }  |
| T7SP.5 | should give a settlement time for an expiration date from the calendar with no stored read, and the latest session's close for a date that isn't one | green | `npx vitest run src/modules/market-data/read-session.test.ts -t "should give a settlement time for an expiration date from the calendar with no stored read, and the latest session's close for a date that isn't one"` | exit 0; Tests  1 passed, 7 skipped (8) |  |
| T7SP.5 | should give a binding covering every key read, with one snapshot id per date that ResolveFrames with that ExpectedSnapshot answers SnapshotUnchanged | red | `npx vitest run src/modules/market-data/read-session.test.ts -t "should give a binding covering every key read, with one snapshot id per date that ResolveFrames with that ExpectedSnapshot answers SnapshotUnchanged"` | exit 1; Tests  1 failed, 8 skipped (9) | TypeError: session.binding is not a function  |
| T7SP.5 | should give a binding covering every key read, with one snapshot id per date that ResolveFrames with that ExpectedSnapshot answers SnapshotUnchanged | green | `npx vitest run src/modules/market-data/read-session.test.ts -t "should give a binding covering every key read, with one snapshot id per date that ResolveFrames with that ExpectedSnapshot answers SnapshotUnchanged"` | exit 0; Tests  1 passed, 8 skipped (9) |  |
| T7SP.5 | should read a Mark saved after the session closed only in a new session | green | `npx vitest run src/modules/market-data/read-session.test.ts -t "should read a Mark saved after the session closed only in a new session"` | exit 0; Tests  1 passed, 9 skipped (10) |  |
| T7SP.5 | should read a Mark saved after the session closed only in a new session | green | `npx vitest run src/modules/market-data/read-session.test.ts -t "should read a Mark saved after the session closed only in a new session"` | exit 0; Tests  1 passed, 9 skipped (10) |  |
| T7SP.5 | should read a Mark saved after the session closed only in a new session | note | `npx vitest run src/modules/market-data/read-session.test.ts -t "should read a Mark saved after the session closed only in a new session"` | First-run pass, flagged for the user. Built by cases 4 and 5 of this task (the per-date observations cache and the per-Instrument evidence cache). Mutation: drop both cache stores (observations.set and evidence.set in the session) so a repeat call re-reads. | AssertionError: expected { instrumentKey: 'AAA', …(4) } to deeply equal { instrumentKey: 'AAA', …(4) } |
| T7SP.5 | all cases | refactor | n/a | n/a | frameEvidence split into observationsOn, instrumentEvidence, recordOf and evidenceOf so the session builds on the same pieces; no behavior change (market-data suite 99 passed). Test names rephrased only where apostrophes were escaped in source. |
| T7SP.5-B1 | should scan an Instrument's gaps once when a later call asks from an earlier exposure, answering each call as recover does | red | `npx vitest run src/modules/market-data/read-session.test.ts -t "should scan an Instrument's gaps once when a later call asks from an earlier exposure, answering each call as recover does"` | exit 1; Tests  1 failed, 10 skipped (11) | AssertionError: expected [ { on: 'index', …(3) }, …(1) ] to have a length of 1 but got 2  |
| T7SP.5-B1 | should scan an Instrument's gaps once when a later call asks from an earlier exposure, answering each call as recover does | green | `npx vitest run src/modules/market-data/read-session.test.ts -t "should scan an Instrument's gaps once when a later call asks from an earlier exposure, answering each call as recover does"` | exit 0; Tests  1 passed, 10 skipped (11) |  |
| T7SP.5-B1 | all cases | refactor | n/a | n/a | relevantSessions extracted from historicalGaps so the session can tell an exposure with no relevant session (no read, as recover) from one that needs the single wide scan; no behavior change (market-data 100 passed, integration 191 passed). |
| T7SP.5-B2 | should reject historicalFrames for a date after the session | red | `npx vitest run src/modules/market-data/read-session.test.ts -t "should reject historicalFrames for a date after the session"` | exit 1; Tests  1 failed, 11 skipped (12) | AssertionError: expected 'resolved' to be 'rejected' // Object.is equality Expected: "rejected"  |
| T7SP.5-B2 | should reject historicalFrames for a date after the session | green | `npx vitest run src/modules/market-data/read-session.test.ts -t "should reject historicalFrames for a date after the session"` | exit 0; Tests  1 passed, 11 skipped (12) |  |
| T7SP.5-B3 | should include every key its gaps scans read in the binding, as the result of recover binds them | red | `npx vitest run src/modules/market-data/read-session.test.ts -t "should include every key its gaps scans read in the binding, as the result of recover binds them"` | exit 1; Tests  1 failed, 12 skipped (13) | AssertionError: expected [] to have a length of 2 but got +0  |
| T7SP.5-B3 | should include every key its gaps scans read in the binding, as the result of recover binds them | green | `npx vitest run src/modules/market-data/read-session.test.ts -t "should include every key its gaps scans read in the binding, as the result of recover binds them"` | exit 0; Tests  1 passed, 12 skipped (13) |  |
| T7SP.5-B3 | refactor | no refactor needed; test name rephrased (the apostrophe in recover's removed for -t filtering) | | | |
| T7SP.5-B4 | should reject historicalFrames for a later date beyond the market calendar | red | `npx vitest run src/modules/market-data/read-session.test.ts -t "should reject historicalFrames for a later date beyond the market calendar"` | exit 1; Tests  1 failed, 13 skipped (14) | AssertionError: expected { frames: [] } to be 'rejected' // Object.is equality  |
| T7SP.5-B4 | should reject historicalFrames for a later date beyond the market calendar | green | `npx vitest run src/modules/market-data/read-session.test.ts -t "should reject historicalFrames for a later date beyond the market calendar"` | exit 0; Tests  1 passed, 13 skipped (14) |  |
| T7SP.6 | should value a Long Stock Trade at the session's date from its Underlying's frame, with D4's figures for XYZ | red | `npx vitest run src/coordinators/valuation/value-trade.test.ts -t "should value a Long Stock Trade at the session's date from its Underlying's frame, with D4's figures for XYZ"` | exit 1; Tests  1 failed (1) | Error: not implemented  |
| T7SP.6 | should value a Long Stock Trade at the session's date from its Underlying's frame, with D4's figures for XYZ | green | `npx vitest run src/coordinators/valuation/value-trade.test.ts -t "should value a Long Stock Trade at the session's date from its Underlying's frame, with D4's figures for XYZ"` | exit 0; Tests  1 passed (1) |  |
| T7SP.6 | should value DEF with its Mark missing as Unavailable | red | `npx vitest run src/coordinators/valuation/value-trade.test.ts -t "should value DEF with its Mark missing as Unavailable"` | exit 0; Tests  1 passed, 1 skipped (2) |  |
| T7SP.6 | should value DEF with its Mark missing as Unavailable | green | `npx vitest run src/coordinators/valuation/value-trade.test.ts -t "should value DEF with its Mark missing as Unavailable"` | exit 0; Tests  1 passed, 1 skipped (2) |  |
| T7SP.6 | should value DEF with its Mark missing as Unavailable(MarkMissing, DEF, Mon Oct 12), with realized-to-date still a Value | note | `npx vitest run src/coordinators/valuation/value-trade.test.ts -t "should value DEF with its Mark missing as Unavailable"` | First-run pass, flagged for the user. Built by case 1 (valueTrade reads the session frame for derive's requirement and evaluates it; evaluate itself words a Missing frame). Mutation: evaluate with an uncovered observation (the instrument and the session date) instead of the session's frame. | AssertionError: expected { kind: 'Evaluated', …(29) } to deeply equal ObjectContaining{…} |
| T7SP.6 | should value O-C from its contract's frame, with XYZ's frame paired for condition status and risk to the Stop | red | `npx vitest run src/coordinators/valuation/value-trade.test.ts -t "should value O-C from its contract's frame, with XYZ's frame paired for condition status and risk to the Stop"` | exit 1; Tests  1 failed, 2 skipped (3) | AssertionError: expected undefined to match object { instrumentKey: 'XYZ', …(1) }  |
| T7SP.6 | should value O-C from its contract's frame, with XYZ's frame paired for condition status and risk to the Stop | green | `npx vitest run src/coordinators/valuation/value-trade.test.ts -t "should value O-C from its contract's frame, with XYZ's frame paired for condition status and risk to the Stop"` | exit 0; Tests  1 passed, 2 skipped (3) |  |
| T7SP.6 | should value O-C at Mon 11-23 with no read for its contract or XYZ, its figures Unavailable | red | `npx vitest run src/coordinators/valuation/value-trade.test.ts -t "should value O-C at Mon 11-23 with no read for its contract or XYZ, its figures Unavailable"` | exit 1; Tests  1 failed, 3 skipped (4) | TypeError: Cannot read properties of undefined (reading 'kind')  |
| T7SP.6 | should value O-C at Mon 11-23 with no read for its contract or XYZ, its figures Unavailable | green | `npx vitest run src/coordinators/valuation/value-trade.test.ts -t "should value O-C at Mon 11-23 with no read for its contract or XYZ, its figures Unavailable"` | exit 0; Tests  1 passed, 3 skipped (4) |  |
| T7SP.6 | should value O-C at Fri 11-20 from its contract's Mark, with a Due settlement item | red | `npx vitest run src/coordinators/valuation/value-trade.test.ts -t "should value O-C at Fri 11-20 from its contract's Mark, with a Due settlement item"` | exit 0; Tests  1 passed, 4 skipped (5) |  |
| T7SP.6 | should value O-C at Fri 11-20 from its contract's Mark, with a Due settlement item | green | `npx vitest run src/coordinators/valuation/value-trade.test.ts -t "should value O-C at Fri 11-20 from its contract's Mark, with a Due settlement item"` | exit 0; Tests  1 passed, 4 skipped (5) |  |
| T7SP.6 | should value O-C at Fri 11-20 from its contract's Mark, with a Due settlement item | note | `npx vitest run src/coordinators/valuation/value-trade.test.ts -t "should value O-C at Fri 11-20 from its contract's Mark, with a Due settlement item"` | First-run pass, flagged for the user. Built by cases 3 and 4 (the frame path for derive's DueToday requirements, and the settlement items from the session's calendar). Mutation: treat a DueToday contract like a PastExpiration one (status !== 'Live', no requirement count), so no frame is read. | AssertionError: expected undefined to deeply equal { kind: 'Available', mark: ObjectContaining{…} } |
| T7SP.6 | should value a session outside coverage with coverage NotCovered | red | `npx vitest run src/coordinators/valuation/value-trade.test.ts -t "should value a session outside coverage with coverage NotCovered"` | exit 1; Tests  1 failed, 5 skipped (6) | TypeError: Cannot read properties of undefined (reading 'instrumentKey')  |
| T7SP.6 | should value a session outside coverage with coverage NotCovered | green | `npx vitest run src/coordinators/valuation/value-trade.test.ts -t "should value a session outside coverage with coverage NotCovered"` | exit 0; Tests  1 passed, 5 skipped (6) |  |
| T7SP.6 | should value a Closed Trade at its terminal date with no read | red | `npx vitest run src/coordinators/valuation/value-trade.test.ts -t "should value a Closed Trade at its terminal date with no read"` | exit 1; Tests  1 failed, 6 skipped (7) | TypeError: Cannot read properties of undefined (reading 'kind')  |
| T7SP.6 | should value a Closed Trade at its terminal date with no read | green | `npx vitest run src/coordinators/valuation/value-trade.test.ts -t "should value a Closed Trade at its terminal date with no read"` | exit 0; Tests  1 passed, 6 skipped (7) |  |
| T7SP.6 | should return a Trade whose facts can't be replayed as Unavailable | red | `npx vitest run src/coordinators/valuation/value-trade.test.ts -t "should return a Trade whose facts can't be replayed as Unavailable"` | exit 1; Tests  1 failed, 7 skipped (8) | AssertionError: expected { kind: 'Unavailable' } to deeply equal { kind: 'Unavailable', …(2) }  |
| T7SP.6 | should return a Trade whose facts can't be replayed as Unavailable | green | `npx vitest run src/coordinators/valuation/value-trade.test.ts -t "should return a Trade whose facts can't be replayed as Unavailable"` | exit 0; Tests  1 passed, 7 skipped (8) |  |
| T7SP.6 | should add the dated line for XYZ at its Stale context | red | `npx vitest run src/coordinators/valuation/value-trade.test.ts -t "should add the dated line for XYZ at its Stale context"` | exit 1; Tests  1 failed, 8 skipped (9) | AssertionError: expected undefined to deeply equal { tradingDate: '2026-10-09', …(1) }  |
| T7SP.6 | should add the dated line for XYZ at its Stale context | green | `npx vitest run src/coordinators/valuation/value-trade.test.ts -t "should add the dated line for XYZ at its Stale context"` | exit 0; Tests  1 passed, 8 skipped (9) |  |
| T7SP.6 | should add the dated line for O-C at Monday's close | red | `npx vitest run src/coordinators/valuation/value-trade.test.ts -t "should add the dated line for O-C at Monday's close"` | exit 1; Tests  1 failed, 9 skipped (10) | Error: an option's dated line needs the Underlying's frame at the dated close  |
| T7SP.6 | should add the dated line for O-C at Monday's close | green | `npx vitest run src/coordinators/valuation/value-trade.test.ts -t "should add the dated line for O-C at Monday's close"` | exit 0; Tests  1 passed, 9 skipped (10) |  |
| T7SP.6 | should return O-C's and XYZ's gaps when the session recovers | red | `npx vitest run src/coordinators/valuation/value-trade.test.ts -t "should return O-C's and XYZ's gaps when the session recovers"` | exit 1; Tests  1 failed, 10 skipped (11) | TypeError: Cannot read properties of undefined (reading 'map')  |
| T7SP.6 | should return O-C's and XYZ's gaps when the session recovers | green | `npx vitest run src/coordinators/valuation/value-trade.test.ts -t "should return O-C's and XYZ's gaps when the session recovers"` | exit 0; Tests  1 passed, 10 skipped (11) |  |
| T7SP.6 | should value a Planned Trade holding no Position with no read | red | `npx vitest run src/coordinators/valuation/value-trade.test.ts -t "should value a Planned Trade holding no Position with no read"` | exit 1; Tests  1 failed, 11 skipped (12) | TypeError: Cannot read properties of undefined (reading 'kind')  |
| T7SP.6 | should value a Planned Trade holding no Position with no read | green | `npx vitest run src/coordinators/valuation/value-trade.test.ts -t "should value a Planned Trade holding no Position with no read"` | exit 1; Tests  1 failed, 11 skipped (12) | ReferenceError: analysis is not defined  |
| T7SP.6 | should value a Planned Trade holding no Position with no read | green | `npx vitest run src/coordinators/valuation/value-trade.test.ts -t "should value a Planned Trade holding no Position with no read"` | exit 0; Tests  1 passed, 11 skipped (12) |  |
| T7SP.6 | all cases | refactor | n/a | n/a | Moved valuation.ts to valuation/dated-line.ts and settlementTimeOf, SettlementItem and SettlementTime to valuation/settlement.ts (SettlementTime is now an alias of Market Data's); callers' imports updated, payoffOf stays in coordinators/settlement.ts. Case 6 grew observationsOf into one place that names what each branch reads (frames, a Missing frame after expiration, an uncovered date, none for a Closed or empty Trade); unreadObservations serves outside coverage, Closed and no-Position alike. Extra case beyond the plan: "should value a Planned Trade holding no Position with no read ..." (red TypeError on the missing guard, green after). Test types the facade through onboardedAt because lint:deps forbids src/coordinators importing src/app. Test names rephrased only where the apostrophes in "can't" and "Mark's" are escaped in source. |
| T7SP.6-B1 | should reject a valuation at the session's close when the session has no close | red | `npx vitest run src/coordinators/valuation/value-trade.test.ts -t "should reject a valuation at the session's close when the session has no close"` | exit 1; Tests  1 failed, 12 skipped (13) | AssertionError: promise resolved "{ kind: 'Valued', …(4) }" instead of rejecting  |
| T7SP.6-B1 | should reject a valuation at the session's close when the session has no close | green | `npx vitest run src/coordinators/valuation/value-trade.test.ts -t "should reject a valuation at the session's close when the session has no close"` | exit 0; Tests  1 passed, 12 skipped (13) |  |

## T7SP.7 Trade Views value through the module (structural; decision 103)

Structural task: no red/green rows. Second attempt, from the saved first-attempt-2 patch; Trade Views now opens one `openReadSession` per `browseTrades` (Open page only) and per `getTradeDetail` call, values each Trade with `valueTrade` (no `factsAtClose`), and takes the derived state from the valuation (no second derive). The Planned and Closed pages derive once per Trade and open no session.

### Verification
| Command | Result |
|---|---|
| `npm run typecheck` | exit 0 |
| `npx tsc6 --noEmit` | exit 0 |
| `npm run lint` | exit 0 |
| `npm run lint:deps` | exit 0 |
| `npx vitest run src/coordinators/trade-views` | exit 0; 7 files, 62 tests passed (the 63 before is 62 after trimming one case) |
| `npx vitest run src/coordinators/valuation` | exit 0; 1 file, 13 tests passed |
| `npm run test:integration` | exit 0; 94 files, 191 tests passed (d7/open-list-query-count unchanged and green) |
| `npx vitest run --project unit` | exit 0; 1539 passed (every `derive`-count case in current-evaluation.test.ts and open-views.test.ts passes unchanged) |
| `grep -n 'instrumentsOf\|afterExpiration\|primaryFrameOf\|evaluateCurrent\|closedCurrent\|currentFrames' src/coordinators/trade-views/trade-views.ts` | prints nothing (grep exit 1) |

### Due Detail request list (`tests/integration/d7/query-count.test.ts`, the due Detail case)
Measured on a fresh launch, tally per store and method.
- Old (24 requests): `meta.get` 12, `trades.get` 2, `catalog.getAll` 1, `journalEntries.getAll` 1, `journalDeclines.getAll` 1, `journalDebts.getAll` 1, `journalDefinitions.getAll` 1, `journalTypes.getAll` 1, `observations.getAll` 2, `observations.openCursor` 2.
- New (18 requests): `meta.get` 10, `trades.get` 2, `catalog.getAll` 1, `journalEntries.getAll` 1, `journalDeclines.getAll` 1, `journalDebts.getAll` 1, `journalDefinitions.getAll` 1, `journalTypes.getAll` 1.
- Dropped: both `observations.getAll` (the date-wide frame read and the A111 Historical read), the two `openCursor` of the Stale Mark lookup, and 2 `meta.get` (the Stale lookup's snapshot, and the snapshot of the date-wide read; the live Detail's 11 `meta.get` includes the latter). FLAGGED: decision 103's text names "the `observations.getAll`" and "`meta.get` +1"; the actual frame reads were 2 `getAll` and 2 `meta.get`. All four removed requests are frame-read requests, so the list drops exactly what its frame reads made. The live Detail's `PINNED` list and every other request are unchanged. The case's name changed from "bar one observations read" to "bar the frame reads"; its comment was rewritten (the old comment's 24-request arithmetic was false).

### Stub cases (decision 103 text counted 8; a 9th, the retry case in current-evaluation.test.ts, also stubbed `query` and is included here per the coordinator's direction)
| # | Case (file) | Fate | Old stub | New stub / covering case | Mutation and failing output |
|---|---|---|---|---|---|
| 1 | closed-views: should return the Closed Detail with its Closed fields when Market Data rejects the frames for a reason other than coverage | Trimmed | `marketData.query` rejects | Covered by T7SP.6 "should value a Closed Trade at its terminal date with no read..."; the wiring case "should show no saved Mark, no Expected Mark Date, and no Market Data snapshot in the Closed Detail" stays. FLAGGED: Detail now opens a session for every form, so a Market Data whose `openReadSession` rejects (an invalid as-of, unreachable with the real clock) would reject a Closed Detail; the removed case pinned the old no-dependence. | n/a |
| 2 | closed-views: should classify the Outstanding Debt of a Closed Trade when Market Data answers and leave it without a due status when it does not | Rewritten | `{ query: rejecting }` as the whole Market Data | `{ ...stack.marketData, query: rejecting }`; the coordinator's `sessionCloses` still uses `query` for a Debt's closes | `sessionCloses` throws when the result is not Frames: `AssertionError`-free run gave `Error: Market Data returned no frames` (runtime exception) |
| 3 | current-evaluation: should bind the Trade, Journal, and Catalog revisions ... after 3 retries (9th) | Rewritten | race at `marketData.query` | race at `marketData.openReadSession` (first call writes); `queries` is 2 and `raced` is 3, counted at the session | retry loop limited to one attempt (`attempt < 1`): `AssertionError: expected false to deeply equal { databaseName: 'tj-ws-id-0013', ... }` |
| 4 | option-views: should look up the Open page settlement times concurrently | Rewritten | `query` counts in-flight `ResolveSession` | `session.settlementTime` wrapped to count in-flight lookups (peak 2) | Open page values Trades in a sequential loop: `AssertionError: expected 1 to be 2` (the mutation also left 2 type errors; vitest ran it and failed at runtime) |
| 5 | option-views: should give an unavailable settlement time for an expiration date outside calendar coverage and still list every Open Trade | Rewritten | `query` rejects `ResolveSession` with coverage | `session.settlementTime` returns the Unavailable(SessionPolicyNotCovered) value | Open item given `[]` instead of `valuation.settlement`: `AssertionError: expected [ { tradeId: 'id-0016', ... } ] to deeply equal [ ObjectContaining{...} ]` |
| 6 | option-views: should return Open, Planned, and Closed rows ... reading Market Data only for Open rows | Rewritten | `query` counter | `openReadSession` counter (0 after Planned and Closed pages, more than 0 after Open) | A session opened for every lifecycle: `AssertionError: expected 2 to be +0 // Object.is equality` |
| 7 | option-views: should keep the Open page Ready and give the affected option Trade no dated line when Market Data rejects the Historical request | Rewritten | `query` rejects Historical with `SessionPolicyCoverage` | `session.historicalFrames` returns `[]` (a date with no frames); no T7SP.6 case covers an absent Underlying frame, so it was not trimmed | Open page throws when an option's valuation has no dated line: `Error: no dated line` |
| 8 | option-views: should throw when Market Data rejects the Historical request for any reason but session-policy coverage | Rewritten | `query` rejects Historical with `NotASession` | `session.historicalFrames` rejects with an Error naming the Historical request (the `/Historical\|Market Data/` regex alone is satisfied by the stub's message, so the `rejects` assertion is what catches an absorbing coordinator) | `valueTrade(...)` rejection swallowed into an Unavailable valuation on the Open page: `AssertionError: promise resolved "{ kind: 'Ready', ...(2) }" instead of rejecting` |
| 9 | option-views: should throw from Trade Detail when Market Data rejects the Historical request for any reason but session-policy coverage | Rewritten | as 8, on Detail | as 8, on Detail | Detail's `valueTrade(...)` rejection swallowed likewise: `AssertionError: promise resolved "{ kind: 'Ready', view: { ...(9) }, ...(1) }" instead of rejecting` |

Each mutation was restored by Edit and the coordinator diff was confirmed equal to the pre-mutation state.

Rows 1 and 2 are the closed-views.test.ts cases and 3 is the 9th (retry) case; the other six are the option-views.test.ts cases, so rows 1 and 2 plus 4 to 9 are decision 103's 8.

### Flagged: Detail with an Open lifecycle and no open Position
- Detail no longer carries `markResolution` for it (no frame is read for a Trade holding nothing). Decision 103 sanctions this for the Open page only.
- Reachable only on a lifecycle disagreement (stored Open, facts Closed, as in the T6.14-B2 case), since a stored Open Trade with all contracts disposed replays Closed. Not past expiration is then immaterial.
- `specs/design/trade-views-and-reporting.md` `getTradeDetail` requires no Mark resolution there: it says "The coordinator derives once and reuses state. Closed/Abandoned detail does not require current Marks." No existing case failed on it.
- Also: an Open item or Detail past expiration carries `expectedMarkDate` (from the session) but no `markResolution`, unchanged for Detail and sanctioned for the Open page.
| T7SP.7-B1 | should classify a Debt against the closes of the session the Detail was opened at when the clock crosses that session close during the read | red | `npx vitest run src/coordinators/trade-views/option-views.test.ts -t "should classify a Debt against the closes of the session the Detail was opened at when the clock crosses that session close during the read"` | exit 1; Tests  1 failed, 18 skipped (19) | AssertionError: expected { Object (expectedMarkDate, markResolution, ...) } to not have property "markResolution"  |
| T7SP.7-B1 | should classify a Debt against the closes of the session the Detail was opened at when the clock crosses that session close during the read | red | `npx vitest run src/coordinators/trade-views/option-views.test.ts -t "should classify a Debt against the closes of the session the Detail was opened at when the clock crosses that session close during the read"` | exit 1; Tests  1 failed, 18 skipped (19) | Error: expected Recorded, got {"kind":"Rejected","issues":[{"source":"TradeAnalysis","member":0,"field":"economicTime","code":"AfterExpiration"}],"binding":{"databaseName":"tj-ws-id-0013","contentRevision":4}}  |
| T7SP.7-B1 | should classify a Debt against the closes of the session the Detail was opened at when the clock crosses that session close during the read | red | `npx vitest run src/coordinators/trade-views/option-views.test.ts -t "should classify a Debt against the closes of the session the Detail was opened at when the clock crosses that session close during the read"` | exit 1; Tests  1 failed, 18 skipped (19) | Error: expected Recorded, got {"kind":"Rejected","issues":[{"source":"TradeAnalysis","member":0,"field":"economicTime","code":"SettlementTimeInvalid"}],"binding":{"databaseName":"tj-ws-id-0013","contentRevision":5}}  |
| T7SP.7-B1 | should classify a Debt against the closes of the session the Detail was opened at when the clock crosses that session close during the read | red | `npx vitest run src/coordinators/trade-views/option-views.test.ts -t "should classify a Debt against the closes of the session the Detail was opened at when the clock crosses that session close during the read"` | exit 1; Tests  1 failed, 18 skipped (19) | AssertionError: expected [ 'Due' ] to deeply equal [ 'DueInNextReview' ]  |
| T7SP.7-B1 | should classify a Debt against the closes of the session the Detail was opened at when the clock crosses that session close during the read | green | `npx vitest run src/coordinators/trade-views/option-views.test.ts -t "should classify a Debt against the closes of the session the Detail was opened at when the clock crosses that session close during the read"` | exit 0; Tests  1 passed, 18 skipped (19) |  |

### T7SP.7-B1 (the rows above this heading, from the first T7SP.7-B1 red onward, belong to it)
- note: the first three T7SP.7-B1 red rows are not valid reds: each failed on the fixture (the session was not past expiration; a fill after expiration and a partial Expiration were rejected by Trade Analysis), before the behavior ran. The fourth red row is the genuine one (`expected [ 'Due' ] to deeply equal [ 'DueInNextReview' ]`).
- refactor: none beyond the fix. `getTradeDetail` samples `clock.now()` once and passes it to `openSession` and `sessionCloses`; `sessionCloses` still issues the ResolveFrames read, because ResolveSession and the read session give the close of the session's own date but not the previous close that `classifyDue` needs, so Market Data's interface would have to change to avoid the read. Closed Detail passes the same as-of.

### T7SP.8 (second attempt; the first attempt's rows are not evidence)
| T7SP.8 | should cost one meta.get per date read with the Stale-context lookups and gaps scans of that date inside it as recover does | red | `npx vitest run src/modules/market-data/read-session.test.ts -t "should cost one meta.get per date read with the Stale-context lookups and gaps scans of that date inside it as recover does"` | exit 1; Tests  1 failed, 14 skipped (15) | AssertionError: expected [ { on: 'store', …(2) }, …(4) ] to deeply equal [ Array(1) ]  |
| T7SP.8 | should cost one meta.get per date read with the Stale-context lookups and gaps scans of that date inside it as recover does | green | `npx vitest run src/modules/market-data/read-session.test.ts -t "should cost one meta.get per date read with the Stale-context lookups and gaps scans of that date inside it as recover does"` | exit 0; Tests  1 passed, 14 skipped (15) |  |
| T7SP.8 | should value O-C with no dated line and no read for it when asked to skip the dated line | red | `npx vitest run src/coordinators/valuation/value-trade.test.ts -t "should value O-C with no dated line and no read for it when asked to skip the dated line"` | exit 1; Tests  1 failed, 14 skipped (15) | AssertionError: expected { tradingDate: '2026-10-12', …(1) } to be undefined  |
| T7SP.8 | should read the frames and gaps of a Trade in one snapshot when the session recovers | red | `npx vitest run src/coordinators/valuation/value-trade.test.ts -t "should read the frames and gaps of a Trade in one snapshot when the session recovers"` | exit 1; Tests  1 failed, 14 skipped (15) | AssertionError: expected [ { on: 'store', …(2) }, …(1) ] to have a length of 1 but got 2  |
| T7SP.8 | should value O-C with no dated line and no read for it when asked to skip the dated line | green | `npx vitest run src/coordinators/valuation/value-trade.test.ts -t "should value O-C with no dated line and no read for it when asked to skip the dated line"` | exit 0; Tests  1 passed, 14 skipped (15) |  |
| T7SP.8 | should read the frames and gaps of a Trade in one snapshot when the session recovers | green | `npx vitest run src/coordinators/valuation/value-trade.test.ts -t "should read the frames and gaps of a Trade in one snapshot when the session recovers"` | exit 0; Tests  1 passed, 14 skipped (15) |  |
| T7SP.8 | should give O-C a getTrade card dated line at Monday close valued with the call and XYZ Monday Marks | red | `npx vitest run tests/integration/d7sp/review-valuation.test.ts -t "should give O-C a getTrade card dated line at Monday close valued with the call and XYZ Monday Marks"` | exit 1; Tests  1 failed, 1 skipped (2) | AssertionError: expected undefined to be '2026-10-12' // Object.is equality  |
| T7SP.8 | should give O-C a getTrade card dated line at Monday close valued with the call and XYZ Monday Marks | green | `npx vitest run tests/integration/d7sp/review-valuation.test.ts -t "should give O-C a getTrade card dated line at Monday close valued with the call and XYZ Monday Marks"` | exit 0; Tests  1 passed, 1 skipped (2) |  |
| T7SP.8 | should give O-C a card the same dated line as the Trade Views Detail for the same Trade and date | green | `npx vitest run tests/integration/d7sp/review-valuation.test.ts -t "should give O-C a card the same dated line as the Trade Views Detail for the same Trade and date"` | exit 0; Tests  1 passed, 1 skipped (2) |  |
| T7SP.8 | should give an option card the dated last close of its Stale context valued at that close, flipping the T7.24 absence | green | `npx vitest run src/coordinators/daily-review/settlement.test.ts -t "should give an option card the dated last close of its Stale context valued at that close, flipping the T7.24 absence"` | exit 0; Tests  1 passed, 9 skipped (10) |  |
- note: First-run pass, flagged for the user: "should give O-C a card the same dated line as the Trade Views Detail for the same Trade and date". The behaviour was built by the first T7SP.8 case's green (the Review card takes `datedLine` from the module) and T7SP.6's module. Mutation: `figuresOf` sets the card's `datedLastClose` tradingDate to 1999-01-01. Command: `npx vitest run tests/integration/d7sp/review-valuation.test.ts -t "same dated line"`. First failure line: `AssertionError: expected { tradingDate: '1999-01-01', …(1) } to deeply equal { tradingDate: '2026-10-12', …(1) }`. Restored (`git diff` shows no 1999).
- note: settlement.test.ts:236 flipped in the first case's green commit. Old expectation: `expect(card.datedLastClose).toBeUndefined()` (T7.24 known defect). New: `datedLastClose.tradingDate` is `2026-11-19` (Thursday), its `evaluation.observation` is ABC's put with Thursday's Mark price `1.3`, and `currentMarkedPnl.kind` is `Value`; ABC has no Thursday Mark, so the Underlying's frame at that close is Missing. The case's name changed with its expectation, from "should give an option card no dated last close when its contract has only a Stale context, since the Underlying frame is not the contract" to "should give an option card the dated last close of its Stale context valued at that close, flipping the T7.24 absence".
| T7SP.8 | should give an unavailable settlement time to an item whose expiration date is outside calendar coverage, and the close to the covered one, listing both Trades | green | `npx vitest run src/coordinators/daily-review/settlement.test.ts -t "should give an unavailable settlement time to an item whose expiration date is outside calendar coverage, and the close to the covered one, listing both Trades"` | exit 0; Tests  1 passed, 9 skipped (10) |  |
- note: `settlement.test.ts:253` rewritten at the read session (decision 104, part 2), name and assertion unchanged. Before the rewrite it was red on the new code: its `marketData.query` stub (reject `ResolveSession` Historical for 2026-11-13) has no effect, since the settlement time now comes from `session.settlementTime` (`AssertionError: expected [ { tradeId: 'id-0071', …(1) }, …(2) ] to deeply equal [ { tradeId: 'id-0071', …(1) }, …(2) ]`). Now it wraps `openReadSession` and answers `settlementTime` for the 11-13 contract as `Unavailable(SessionPolicyNotCovered)`. Mutation of the coordinator: `settlementItems` replaces every item's `settlementTime` with Friday's close. Command: `npx vitest run src/coordinators/daily-review/settlement.test.ts -t "outside and inside calendar coverage"`. First failure line: `AssertionError: expected [ { tradeId: 'id-0071', …(1) }, …(2) ] to deeply equal [ { tradeId: 'id-0071', …(1) }, …(2) ]`. Restored (`git diff` shows no 21:00 literal).
| T7SP.8 | should make no request for option Trades dated lines in the Review open | green | `npx vitest run tests/integration/d7sp/review-query-count.test.ts -t "should make no request for option Trades dated lines in the Review open"` | exit 0; Tests  1 passed, 2 skipped (3) |  |
| T7SP.8 | should add at most one observations read for the Trade dated line in getTrade | green | `npx vitest run tests/integration/d7sp/review-query-count.test.ts -t "should add at most one observations read for the Trade dated line in getTrade"` | exit 0; Tests  1 passed, 2 skipped (3) |  |
| T7SP.8 | should keep D6 requests exactly for a Review with no option dated line | green | `npx vitest run tests/integration/d7sp/review-query-count.test.ts -t "should keep D6 requests exactly for a Review with no option dated line"` | exit 0; Tests  1 passed, 2 skipped (3) |  |
- note: First-run pass, flagged for the user: the three cases in `tests/integration/d7sp/review-query-count.test.ts`. Each passed on its first run, because the first T7SP.8 case's green (Review through the module) and the session fix (red/green rows above) had built the behaviour. A new case file cannot go red on an absent file's behaviour once that is built, so each got a mutation of the coordinator, run on its own with `npx vitest run tests/integration/d7sp/review-query-count.test.ts -t "<name>"`, then restored (`git diff` shows the original `eligibleTrades`/`getTrade` calls):
  - "should make no request for option Trades dated lines in the Review open": `eligibleTrades` drops `skipDatedLine: true`. First failure line: `AssertionError: expected [ { on: 'store', …(2) }, …(5) ] to deeply equal [ { on: 'store', …(2) }, …(4) ]`.
  - "should add at most one observations read for the Trade dated line in getTrade": `getTrade` passes `skipDatedLine: true`. First failure line: `AssertionError: expected undefined to be '2026-10-12' // Object.is equality`.
  - "should keep D6 requests exactly for a Review with no option dated line": `eligibleTrades` passes `withGaps: false`. First failure line: `AssertionError: expected [ { on: 'store', …(2) } ] to deeply equal [ { on: 'store', …(2) }, …(1) ]`.
- note: first case "should give O-C a getTrade card dated line ..." and the Market Data, value-trade cases above have genuine red rows. The third `describe` case of the Daily Review group ("should keep every existing Daily Review case's expected values") is recorded as the suite run: unit `src/coordinators/daily-review` 147 cases and `npx vitest run --project integration` (95 files, 193 cases) pass, with `settlement.test.ts:236` flipped and `:253` rewritten and no other test changed.
- note: stub-case table (decision 104, part 2): every Daily Review unit case that stubs `marketData.query` was checked. Rewritten at the read session: `settlement.test.ts:253` "should give an unavailable settlement time to an item whose expiration date is outside calendar coverage, ..." (mutation above). Unchanged and still effective, since they intercept `ResolveSession`, which the coordinator still queries, or fail the first query after a commit: `save.test.ts:89` and `:489`, `save-marks.test.ts:158` and `:184`. None trimmed.
- note: the fallback in `evaluate.ts` is NOT removed. Removing it (statuses from `state.contractStatuses` only) fails one existing domain case, `src/domain/trade-analysis/evaluate-option.test.ts:166` "should return O-S as Due (2 contracts short, 2026-11-20) for frames 2026-11-20 and 2026-11-23 ...", because it derives its state without a valuation date and evaluates it at three dates; that is outside decision 104's allowance, so it is reported for the main session. Everything else (full unit and integration suites) passed with the fallback removed.
- refactor: `eligibleTrades` takes `{ session, withGaps }` instead of a bare session; `framesOnly` is replaced by `reviewFrames` over the session; `gapsOf` merges the per-Trade gaps by Instrument. No test names rephrased beyond the characters noted; the :236 case was renamed with its flipped expectation.

## T7SP.8 (fallback removal, structural)

- Removed the temporary dateless fallback and its comment from `src/domain/trade-analysis/evaluate.ts`; `evaluate` now reads `state.contractStatuses` (empty for a dateless state, as derive makes it). The unused `contractStatusesOf` import went with it.
- Test setup, `src/domain/trade-analysis/evaluate-option.test.ts`, case "should return O-S as Due (2 contracts short, 2026-11-20) for frames 2026-11-20 and 2026-11-23 ...":
  - before: `const state = derivedState(record);` (dateless) used for all three evaluations; last line `derivedState(osRecord([OS_S1, OS_ES]))` (dateless).
  - after: `const stateOn = (date) => derivedState(record, date);` each evaluation uses `stateOn(<its frame date>)` (11-19, 11-20, 11-23); last line `derivedState(osRecord([OS_S1, OS_ES]), '2026-11-23')`. The helper `derivedState` gained an optional `valuationDate` that goes to `derive`. Name and every expected value and assertion unchanged.
- Commands and results:
  - `npm run typecheck`: exit 0
  - `npx vitest run src/domain src/coordinators`: 50 files, 544 tests passed
  - `npm run test:integration`: 96 files, 196 tests passed
  - `grep -n "T7SP.8" src/domain/trade-analysis/evaluate.ts`: no output (grep exit 1)

## T7SP.8 (cumulative-run fix)

- Cause: test setup only. `tests/support/option-detail-fixtures.ts` built its Trade Details (`optionOpenDetail`, `optionClosedDetail`) from a dateless `derive({ record })` and passed that state to `evaluate`. Before `bc47a037` (removal of evaluate's dateless fallback, A192) `evaluate` filled in contract statuses itself; after it, a dateless state has empty `contractStatuses`, so the contract was never PastExpiration/Expiring and the expiration line and "value at expiration at ... latest close" wording were missing. No production path evaluates a dateless state (value-trade and dated-line derive at their date). The three `TradeDetailOptions.test.tsx` failures were the only symptom.
- Change: `plannedPart` takes an optional `valuationDate`; `optionOpenDetail` derives at `frames.tradingDate`; `optionClosedDetail` derives at the terminal date (taken from a first dateless derive, as before) and keeps `terminalTime` from that first state. No test name, expected value or assertion changed.
- Before: `plannedPart(which, record)` -> `derive({ record })`. After: `plannedPart(which, record, valuationDate)` -> `derive({ record, valuationDate })` for both builders.
- Verification: `npx vitest run src/ui/screens/TradeDetailOptions.test.tsx` 18 passed; `npx vitest run src/ui src/domain src/coordinators` 86 files / 1124 passed; `npm run typecheck` exit 0; `npm run test:integration` 96 files / 196 passed.

## T7SP.9 The expiration-comparison lint rule (structural)

Selector (`expirationComparisonSelectors` in `eslint.deps.config.js`; relational is `BinaryExpression[operator=/^(<|<=|>|>=)$/]`), two entries so that a comparison of two expirations (a sort) passes:

- `<relational>[left.property.name='expiration']:not([right.property.name='expiration'])`
- `<relational>[right.property.name='expiration']:not([left.property.name='expiration'])`

Message: "expiration-comparison: ask the instrument module (expiredOn, settlementDueOn in src/domain/instrument/), never compare a date with .expiration."

Wiring: `noIdentityRules` (all of src) and `domainPurityRules` (src/domain) repeat `noIdentitySelector`, then the expiration selectors (and the purity selectors for domain). `expirationExemptRules` (new, also added to `eslint.config.js` after `domainPurityRules`, since `npm run lint` merges these entries) exempts non-domain `src/**/*.test.{ts,tsx}` (identity only) and `src/domain/instrument/**` plus domain tests (identity, purity selectors and globals, no expiration rule).

| Command | Result |
|---|---|
| `npm run lint:deps` | exit 0, "lint:deps OK (src)": the rule passes on today's tree (no product hit, so no code change) |
| planted `if (date > leg.instrument.expiration) {}` in `trade-views.ts` (a typed `plantedP82(date, leg)` function), `npm run lint:deps` | exit 1: `src/coordinators/trade-views/trade-views.ts:53:7 expiration-comparison: ask the instrument module (expiredOn, settlementDueOn in src/domain/instrument/), never compare a date with .expiration.` |
| plant reverted | `git status --short` clean |
| `daily-review.ts` sort of two expirations (`a.expiration < b.expiration`, line 360 in `src/coordinators/daily-review/daily-review.ts`) | passes in the first `lint:deps` run (no message) |
| `npm run lint` | exit 0 (also ran as the pre-commit hook) |
| `npm run verify:wording` | exit 0 |
| `npm run typecheck`; `npx tsc6 --noEmit` | exit 0; exit 0 |
| `full-suite.sh` checks count (5 fixed + verify:* scripts) | 14, unchanged |

Deviation: the plant was not committed. The pre-commit hook (lint) would reject it and `git commit --no-verify` is blocked, so it was applied to the working tree, linted, and reverted with Edit. No scratch commit exists and no reset was needed.

## T7SP.9-B1 (expiration selectors missing from non-test src/ui under npm run lint)

Fix: `eslint.config.js` builds `wordingWithExpirationRules` (wordingRules with its identity and wording selectors kept, then `expirationComparisonSelectors` appended) and uses it in place of `wordingRules`. `eslint.wording.config.js` is untouched (verify:wording standalone is unchanged).

Correction to the finding: `lint:deps` (`eslint.deps.config.js`, which has no wording entry) already rejects the plant in src/ui; only the merged `npm run lint` config lost the selectors. Checked: planted line linted with `-c eslint.deps.config.js` as src/ui/AppShell.tsx exits 1 with the rule message.

Planted line (stdin, `--stdin-filename src/ui/AppShell.tsx`): `export function f(date: string, leg: { instrument: { expiration: string } }) { return date > leg.instrument.expiration; }`

### Red (before)
```
--- planted in src/ui/AppShell.tsx (stdin)
exit 0
```
`npm run lint` exit 0, `npm run lint:deps` "lint:deps OK (src)" on the real tree.

### Green (after)
```
  1:87  error  expiration-comparison: ask the instrument module (expiredOn, settlementDueOn in src/domain/instrument/), never compare a date with .expiration  no-restricted-syntax
exit 1
```
Real tree: `npm run lint` exit 0, `npm run lint:deps` OK, `npm run verify:wording` exit 0, `npm run typecheck` exit 0 (the rule fires on no real src/ui code).

### no-restricted-syntax selector counts (`npx eslint --print-config`; total / expiration)
| File | Before | After |
|---|---|---|
| src/ui/AppShell.tsx (non-test ui) | 31 / 0 | 33 / 2 |
| src/ui/calculation-words.ts | 3 / 2 | 3 / 2 |
| src/ui/format.test.ts (ui test) | 1 / 0 | 1 / 0 |
| src/coordinators/trade-views/trade-views.ts | 3 / 2 | 3 / 2 |
| src/domain/trade-analysis/evaluate.ts | 8 / 2 | 8 / 2 |
| src/domain/instrument/index.ts | 6 / 0 | 6 / 0 |
| src/domain/instrument/instrument.test.ts (domain test) | 6 / 0 | 6 / 0 |

## T7SP.9-B2 (expiration-comparison selectors see only the direct operand)

Fix: `eslint.deps.config.js` builds each selector with `isExpiration(side)`, a `:matches(...)` over `[<side>(.expression){0..3}.property.name='expiration']`, so as, !, satisfies, <T> and ?. wrappers (all hold the operand in `.expression`, as `wrapperPaths` in eslint.wording.config.js) are looked through, up to three deep. Still two selectors, still exported as `expirationComparisonSelectors`. Computed access (B3) untouched.

Snippets linted via stdin as src/coordinators/trade-views/trade-views.ts. Cell = whether the expiration-comparison message appears (the `npx eslint` main config also exits 1 on unrelated undeclared-name noise, so the message is the signal).

| Snippet | Want | main before | deps before | main after | deps after |
|---|---|---|---|---|---|
| (a) `date > (leg.instrument.expiration as string)` | reject | pass (WRONG) | pass (WRONG) | rejected | rejected |
| (b) `date > leg?.instrument?.expiration` | reject | pass (WRONG) | pass (WRONG) | rejected | rejected |
| (c) `date > leg.instrument.expiration!` | reject | pass (WRONG) | pass (WRONG) | rejected | rejected |
| (d) `(a.expiration as string) < b.expiration` | pass | rejected (WRONG) | rejected (WRONG) | pass | pass |
| `date > leg.instrument.expiration` | reject | rejected | rejected | rejected | rejected |
| `a.expiration < b.expiration` | pass | pass | pass | pass | pass |
| `b.expiration < (i.expiration as string)` | pass | rejected (WRONG) | rejected (WRONG) | pass | pass |
| `a?.expiration < b!.expiration` | pass | rejected (WRONG) | rejected (WRONG) | pass | pass |
| `date > (x.expiration satisfies string)` | reject | pass (WRONG) | pass (WRONG) | rejected | rejected |
| `date > (<string>x.expiration)` | reject | pass (WRONG) | pass (WRONG) | rejected | rejected |
| `date > leg?.instrument.expiration` | reject | pass (WRONG) | pass (WRONG) | rejected | rejected |
| `(x.expiration as string) > date` | reject | pass (WRONG) | pass (WRONG) | rejected | rejected |

Real tree after: `npm run lint` 0, `npm run lint:deps` 0, `npm run verify:wording` 0, `npm run typecheck` 0 (rule fires on no real code).

### no-restricted-syntax selector counts (total / expiration), unchanged from B1 After
| File | Count |
|---|---|
| src/ui/AppShell.tsx | 33 / 2 |
| src/ui/calculation-words.ts | 3 / 2 |
| src/ui/format.test.ts | 1 / 0 |
| src/coordinators/trade-views/trade-views.ts | 3 / 2 |
| src/domain/trade-analysis/evaluate.ts | 8 / 2 |
| src/domain/instrument/index.ts | 6 / 0 |
| src/domain/instrument/instrument.test.ts | 6 / 0 |

## T7SP.9-B3 (expiration-comparison selectors miss computed access)

Fix: `isExpiration(side)` in `eslint.deps.config.js` now matches, at each wrapper depth 0..3, two member shapes: `[M.computed=false][M.property.name='expiration']` (x.expiration) and `[M.computed=true][M.property.value='expiration']` (x['expiration']), where M is `<side>` plus `.expression` repeated per depth. A computed key that is a variable named expiration matches neither. Still two selectors in `expirationComparisonSelectors`; B2's wrapper look-through is kept.

New selector text (left-operand form; the right form swaps left and right, and the first :matches is negated against the other side):
`BinaryExpression[operator=/^(<|<=|>|>=)$/]:matches([left.computed=false][left.property.name='expiration'], [left.computed=true][left.property.value='expiration'], [left.expression.computed=false][left.expression.property.name='expiration'], [left.expression.computed=true][left.expression.property.value='expiration'], ...same two for left.expression.expression and left.expression.expression.expression):not(:matches(<the same eight tests on right>))`

Snippets linted via stdin as src/coordinators/trade-views/trade-views.ts; cell = whether the expiration-comparison message appears.

| Snippet | Want | main before | deps before | main after | deps after |
|---|---|---|---|---|---|
| (a) `date > leg.instrument['expiration']` | reject | pass (WRONG) | pass (WRONG) | rejected | rejected |
| (b) `date > (leg.instrument['expiration'] as string)` | reject | pass (WRONG) | pass (WRONG) | rejected | rejected |
| (c) `date > dates[expiration]` | pass | rejected (WRONG) | rejected (WRONG) | pass | pass |
| (d) `a['expiration'] < b.expiration` | pass | rejected (WRONG) | rejected (WRONG) | pass | pass |

B2 snippets re-run after the fix (all as recorded in the B2 After columns):

| Snippet | Want | main | deps |
|---|---|---|---|
| `date > (leg.instrument.expiration as string)` | reject | rejected | rejected |
| `date > leg?.instrument?.expiration` | reject | rejected | rejected |
| `date > leg.instrument.expiration!` | reject | rejected | rejected |
| `(a.expiration as string) < b.expiration` | pass | pass | pass |
| `date > leg.instrument.expiration` | reject | rejected | rejected |
| `a.expiration < b.expiration` | pass | pass | pass |
| `b.expiration < (i.expiration as string)` | pass | pass | pass |
| `a?.expiration < b!.expiration` | pass | pass | pass |
| `date > (x.expiration satisfies string)` | reject | rejected | rejected |
| `date > (<string>x.expiration)` | reject | rejected | rejected |
| `date > leg?.instrument.expiration` | reject | rejected | rejected |
| `(x.expiration as string) > date` | reject | rejected | rejected |

Extra: `date > (leg.instrument['expiration']!)` rejected under both.

Real tree after: `npm run lint` 0, `npm run lint:deps` 0, `npm run verify:wording` 0, `npm run typecheck` 0 (rule fires on no real code).

`npx eslint --print-config` per-file no-restricted-syntax counts (total / expiration) unchanged from B2: AppShell.tsx 33 / 2, calculation-words.ts 3 / 2, format.test.ts 1 / 0, trade-views.ts 3 / 2, evaluate.ts 8 / 2, instrument/index.ts 6 / 0, instrument.test.ts 6 / 0.

## T7SP.10 Fixture views

Structural task. Commands and results:

- `npm run verify:fixtures` -> exit 0; all six fixtures (workspace-v1 to v6) open Ready with views equal to their snapshots (full output as printed by the command).
- `git diff claude-opus-5.5-pre-d7sp -- tests/fixtures` -> empty (0 bytes); `git diff --stat claude-opus-5.5-pre-d7sp -- tests/fixtures` -> empty. Every `dump.json` is byte-identical.

What `verify:fixtures` compares: `compareSnapshot` (tools/fixtures/snapshot-compare.ts) checks the current views against the snapshot field by field over the fields the snapshot holds. A field the current release adds is allowed. So passing does not settle whether a card gained a field; a new `datedLastClose` on a card would pass silently. I therefore computed the current views directly (a scratch probe outside the repository that reuses `viewsOf`, which opens Review, then calls `getTrade` per Trade, as the tool does) and compared each card with the snapshot.

Option Trades in each fixture's Review view (the `reviewTrades` cards, from `getTrade`):

- workspace-v5: the Review holds 5 Open Trades (fx-0046, fx-0114, fx-0129, fx-0072, fx-0089), all stock Trades. No option Trades (options arrive at schema 6). Actual `datedLastClose` on fx-0046, fx-0072, fx-0089, matching the snapshot; none on fx-0114, fx-0129, matching it.
- workspace-v6: 6 Open Trades (fx-0174, fx-0049, fx-0117, fx-0132, fx-0075, fx-0092). One is an option Trade: fx-0174 (XYZ call 55, expiring 2026-11-20, the review date). The others are stock Trades; the 3 existing `datedLastClose` lines are on fx-0049, fx-0075, fx-0092, unchanged.
- Why fx-0174 does not gain a line: its contract's Mark resolution on the review date is `Missing` with no Stale context (Marks family item XYZ261120C00055000, `resolution: {kind: Missing}`, no `stale`), and no Lot has an exact close before it, so no Lot opened after an exact close. Its card's evaluation is `MarkMissing`. The computed card has no `datedLastClose`, same as the snapshot.
- The option Trades in v6's Planned and Closed lists (fx-0217, fx-0189, fx-0203) are not in the Review view and have no card.

Conclusion: no fixture Trade gains a dated line; nothing changed in `tests/fixtures`.

## T7SP.11 Browser: the option dated line in the Review

Playwright case, logged by hand. Spec: `e2e/d7sp/review-dated-line.spec.ts`; served build `dist-faults` (rebuilt with `npm run build:faults` before each run).

| Task | Case | Phase | Command | Outcome | Failure excerpt |
|---|---|---|---|---|---|
| T7SP.11 | O-C bought Monday, Review Tuesday 17:00 with the call's Monday Mark only: a "Mon Oct 12 close" group with its figures at 320 and 1280 px, no sideways scroll | first run (pass) | `npx playwright test e2e/d7sp/review-dated-line.spec.ts` | 1 passed. First-run pass, flagged for the user: T7SP.8 built the behavior (option cards fill `datedLastClose`). At 320 and 1280 px the group's figures read `+$98.70 · +0.25R`, `Mark missing: XYZ, Mon Oct 12`, `$500.00 · 1.25R`, `Mark missing: XYZ, Mon Oct 12`. | |
| T7SP.11 | same | mutation | `npm run build:faults` then `npx playwright test e2e/d7sp/review-dated-line.spec.ts` | 1 failed. Mutation: `getTrade` in `src/coordinators/daily-review/daily-review.ts` (line 644) passes `skipDatedLine: true` to `valueTrade`, so no Trade gets a dated line. | `Error: 320 px  expect(locator).toBeVisible() failed ... getByRole('group', { name: 'Mon Oct 12 close' })  Expected: visible ... element(s) not found` |
| T7SP.11 | same | green (restored) | `npm run build:faults` then `npx playwright test e2e/d7sp/review-dated-line.spec.ts` | 1 passed; `git diff -- src` empty after the restore. The figures assertion was then tightened from a count of 4 to the four texts above and rerun: 1 passed. | |

## T7SP.12 Trim the coordinator cases that moved

Structural task (tests only, P85). Line numbers are before the trim.

### Removed cases

| File:line (before) | Case name | Behaviour | Covering T7SP.6 case | Wiring case kept in that coordinator |
|---|---|---|---|---|
| `src/coordinators/trade-views/option-views.test.ts:300` | should carry the Settlement Due item on an Open option row on the expiration date after the settlement time, as Detail does, and none the day before | the Due item on the expiration date | value-trade.test.ts:144 "should value O-C at Fri 11-20 from its contract's Mark, with a Due settlement item" (and :125 for the item after expiration) | option-views.test.ts:339 (rewritten at the read session: the Open page and Detail carry the module's settlement items through `settlementTime`) and :133 (Detail on Friday carries the item; its Thursday half keeps the NotYetDue evaluation and an empty item list) |
| `src/coordinators/trade-views/option-views.test.ts:456` | should still report a missing contract Mark on the expiration date itself | MarkMissing, on the expiration date the Mark is still read | value-trade.test.ts:79 "should value DEF with its Mark missing as Unavailable(MarkMissing, ...)" and :144 (the Mark is read on the expiration date) | current-evaluation.test.ts:77 (the Open item carries `markResolution` Missing with its Stale context and every figure Unavailable MarkMissing) and option-views.test.ts:251 (an option's dated line carries Unavailable MarkMissing) |

### Kept as ambiguous (partly module-owned, partly coordinator-owned), or the single wiring case

Every file below keeps its cases: each module-owned behaviour already has exactly one wiring case in its coordinator, or the case is not covered by a T7SP.6 case.

- option-views.test.ts:133 (O-S Friday and Thursday): also asserts lifecycle, positionChanges and both payoff views (ADR 0007), which are coordinator-owned; the Friday Due item is the Detail wiring case.
- option-views.test.ts:157 (Closed O-C): Terminal Disposition, Option Disposition Timing and `payoffOf` are coordinator-owned; the NotApplicable(NoRemainingPosition) is one assertion among them.
- option-views.test.ts:184 (Underlying Mark on the option Detail): the wiring case for figures from the Underlying's frame; no module case asserts the view field.
- option-views.test.ts:196 (dated line on Detail and the Open list item): the wiring case for the option dated line.
- option-views.test.ts:222 (Monday dated line with XYZ marked on both days): the same behaviour as value-trade.test.ts:269, but the module case has no Tuesday Mark for XYZ, so only this one distinguishes XYZ's Monday frame from its current one. Kept.
- option-views.test.ts:240, :251, :267 (no dated line when XYZ is Missing; Underlying-dependent figures MarkMissing on the dated line; the at-entry dated line at Tuesday's close): no T7SP.6 case builds these scenarios. Kept.
- option-views.test.ts:285 (Planned option Trade): the Planned payoff is coordinator-owned.
- option-views.test.ts:315, :339, :354, :403, :421, :432 (rewritten at the read session, T7SP.7): wiring cases and query-count proofs.
- option-views.test.ts:445: the single wiring case for SettlementDue after expiration with no Mark resolution; :467 and the rest are Debt cases, coordinator-owned.
- current-evaluation.test.ts:36 (item figures), :229 (Detail figures with Mark provenance and per-Instrument coverage), :77 (MarkMissing, dated line and at-entry line), :341 (NotCovered on the item and on Detail): each is the only case in the file for its behaviour, so each is the wiring case. :114 (AwaitingClose) has no T7SP.6 case. :145, :170, :287, :306 are derive-count, coherence-retry, journal and no-read cases.
- settlement.test.ts:110, :133, :147 (Settlement family, completion blockers, ordering, walk bands), :179 and :206 (the card: Settlement panel and progress, `payoffOf` views, a card's Settlement Due item after the expiration session), :219, :290, :315: ordering, bands, labels, payoff and progress panels are coordinator-owned, and the module-owned figures in :110, :179 and :206 are the single wiring cases for the Review. :237 and :253 are protected (T7SP.8).

### Commands and counts

| Command | Before | After |
|---|---|---|
| `npx vitest run src/coordinators` | 27 files, 325 cases | 27 files, 323 cases |
| `npm run test:integration` | not run before the change (tests only, nothing under `tests/` or `src` non-test touched) | 96 files, 196 cases pass |

Also run on the edited file: `npx eslint src/coordinators/trade-views/option-views.test.ts` and `npm run typecheck`, both exit 0. No import or constant became unused.

## T7SP.13 Trim D5R2's due-classification cases

Structural task (tests only, P89, tech debt item 4). Line numbers are before the trim.

### Mapping: coordinator due-classification assertions against `classifyDue` cases

| Assertion | `classifyDue` case that covers it | Disposition |
|---|---|---|
| debt-status.test.ts:44 D-1 Due (with its field shape) | "should return Due for an anchor before the previous close..." | Kept: the Due case |
| debt-status.test.ts:45 D-2 Due | same Due case | Removed (repeats D-1) |
| debt-status.test.ts:46 D-7 DueInNextReview at Tuesday 17:00 | "should return DueInNextReview..." | Kept: the next-Review case |
| debt-status.test.ts:47 T-H D-6 DueInNextReview | same | Removed (repeats D-7) |
| debt-status.test.ts:50 midday D-1 DueInNextReview | same | Removed (repeats D-7) |
| debt-status.test.ts:51 midday D-7 DueInReviewAfterNext | "should return DueInReviewAfterNext..." | Kept: the after-next case |
| debt-status.test.ts:82 no dueStatus outside session-policy coverage | "should return no classification when there are no closes (decision 56)" | Kept: decision 56's no-frame case, which proves the coordinator passes the closes |
| reflections.test.ts:96 anchor with a New York offset, counted later | none: no `classifyDue` case used an offset (the offset case in the owed-group suite goes through `compareOwed`, not `classifyDue`) | Removed here, moved to classify-due.test.ts |
| reflections.test.ts:24-30 and :50 (due and later counts, D-1/D-2/D-7 classification) | each classification is covered by the Due, next-Review and after-next cases | Kept untouched: the Debt-fixture wiring cases, not boundary cases |
| reflections.test.ts:122 (walked Trade with no frame reports Due) | Due case | Kept: it tests that a Trade with no recoverable frame still gets a due reflection, not a boundary |

### Removed cases

- reflections.test.ts "due classification (A75): should classify a Debt as later when its anchor, written with a New York offset, is after the previous session close" (whole case, moved below).
- debt-status.test.ts "Debt status (A69)" first case: the assertions for D-2 Due, T-H D-6 DueInNextReview and midday D-1 DueInNextReview; the case's name was shortened to match. Its remaining expected values are unchanged.

### Moved case

classify-due.test.ts "should compare an anchor written with a New York offset as an instant, not as text" (four offset anchors: Monday 16:30-04:00 is DueInReviewAfterNext, Monday 16:00-04:00 and Friday 16:30-04:00 are DueInNextReview, Friday 16:00-04:00 is Due).

- Red under mutation: `atOrBefore` in `src/domain/journal-debt/index.ts` changed to `return a <= b;` (a string comparison). Command: `npx vitest run src/domain/journal-debt/classify-due.test.ts -t "should compare an anchor written with a New York offset as an instant, not as text"`. Result: 1 failed, 7 skipped. `AssertionError: expected 'DueInNextReview' to be 'DueInReviewAfterNext'`.
- Restored; `git diff -- src/domain/journal-debt/index.ts` is empty.
- Green: same command after the restore (and the full run below): passes.

### Commands and counts

| Command | Before | After |
|---|---|---|
| `npx vitest run src/domain/journal-debt src/coordinators/daily-review src/coordinators/trade-views` | 19 files, 215 cases | 19 files, 215 cases (one case removed from reflections.test.ts, one added to classify-due.test.ts) |
| `npm run test:integration` | 96 files, 196 cases | 96 files, 196 cases |

`git diff --stat` touches only the three test files and this log. Lint on `src/coordinators` and `src/domain/journal-debt`, and `npm run typecheck`, exit 0.

## T7SP.16 Trade Analysis: the at-entry figures in Plan R

Rows are single-case runs. The first red row for the risk case was a fixture error (`state` out of scope in the new describe), fixed and rerun; the second is the valid red. Both cases were genuine reds, so there is no first-run pass.

| Task | Case | Phase | Command | Outcome | Failure excerpt |
|---|---|---|---|---|---|
| T7SP.16 | should give the at-entry risk from entry in Plan R, the risk from entry divided by the Plan 1R | red | `npx vitest run src/domain/trade-analysis/evaluate.test.ts -t "should give the at-entry risk from entry in Plan R, the risk from entry divided by the Plan 1R"` | exit 1; Tests  1 failed, 35 skipped (36) | ReferenceError: state is not defined  |
| T7SP.16 | should give the at-entry risk from entry in Plan R, the risk from entry divided by the Plan 1R | red | `npx vitest run src/domain/trade-analysis/evaluate.test.ts -t "should give the at-entry risk from entry in Plan R, the risk from entry divided by the Plan 1R"` | exit 1; Tests  1 failed, 35 skipped (36) | TypeError: Cannot read properties of undefined (reading 'numerator')  |
| T7SP.16 | should give the at-entry risk from entry in Plan R, the risk from entry divided by the Plan 1R | green | `npx vitest run src/domain/trade-analysis/evaluate.test.ts -t "should give the at-entry risk from entry in Plan R, the risk from entry divided by the Plan 1R"` | exit 0; Tests  1 passed, 35 skipped (36) |  |
| T7SP.16 | should give the at-entry reward from entry in Plan R the same way, for an option Trade with the multiplier in the dollars | red | `npx vitest run src/domain/trade-analysis/evaluate-option.test.ts -t "should give the at-entry reward from entry in Plan R the same way, for an option Trade with the multiplier in the dollars"` | exit 1; Tests  1 failed, 12 skipped (13) | TypeError: Cannot read properties of undefined (reading 'numerator')  |
| T7SP.16 | should give the at-entry reward from entry in Plan R the same way, for an option Trade with the multiplier in the dollars | green | `npx vitest run src/domain/trade-analysis/evaluate-option.test.ts -t "should give the at-entry reward from entry in Plan R the same way, for an option Trade with the multiplier in the dollars"` | exit 0; Tests  1 passed, 12 skipped (13) |  |
| T7SP.16 | refactor | refactor | none | `atEntryOf` takes `oneR` and names `riskFromEntry` and `rewardFromEntry` as locals so each dollar figure is computed once and divided once. The planned name "the Plan's 1R" was rephrased "the Plan 1R" (apostrophe breaks `-t`). The option case reads the 1R from `evaluation.oneR` instead of a literal. Domain tests (23 files, 222 cases) green. | |

### Existing expectation extended (authorized by the coordinator)

`tests/integration/d4/intraday.test.ts:30`, whole-object `toEqual` on the at-entry figures (case I4.18), failed because `evaluate` now returns two more fields. No existing value changed; the new fields were added with their exact values (1R is $250: 112/250 = 56/125, 228/250 = 114/125), and the assertion stays `toEqual`.

Before: `{ label: 'AtEntry', quantity: dec('40'), averageEntry: dec('50.30'), riskFromEntry: dec('112'), rewardFromEntry: dec('228') }`

After: the same plus `riskFromEntryInPlanR: dec('0.448'), rewardFromEntryInPlanR: dec('0.912')`.
| T7SP.17 | should give an Open stock Trade Detail its held quantity, the sum of its Positions signed quantities | red | `npx vitest run tests/integration/d7sp/trade-detail-finished.test.ts -t "should give an Open stock Trade Detail its held quantity, the sum of its Positions signed quantities"` | exit 1; Tests  1 failed (1) | AssertionError: expected undefined to deeply equal Rational{ numerator: 100n, …(1) }  |
| T7SP.17 | should give an Open stock Trade Detail its held quantity, the sum of its Positions signed quantities | green | `npx vitest run tests/integration/d7sp/trade-detail-finished.test.ts -t "should give an Open stock Trade Detail its held quantity, the sum of its Positions signed quantities"` | exit 0; Tests  1 passed (1) |  |
| T7SP.17 | should give an Open option Trade Detail the expiration line Expires with its contract expiration date | red | `npx vitest run tests/integration/d7sp/trade-detail-finished.test.ts -t "should give an Open option Trade Detail the expiration line Expires with its contract expiration date"` | exit 1; Tests  1 failed, 1 skipped (2) | AssertionError: expected undefined to deeply equal { status: 'Expires', …(1) }  |
| T7SP.17 | should give an Open option Trade Detail the expiration line Expires with its contract expiration date | green | `npx vitest run tests/integration/d7sp/trade-detail-finished.test.ts -t "should give an Open option Trade Detail the expiration line Expires with its contract expiration date"` | exit 0; Tests  1 passed, 1 skipped (2) |  |
| T7SP.17 | should give a Planned option Trade Detail the expiration line Expires | red | `npx vitest run tests/integration/d7sp/trade-detail-finished.test.ts -t "should give a Planned option Trade Detail the expiration line Expires"` | exit 1; Tests  1 failed, 2 skipped (3) | AssertionError: expected false to deeply equal { status: 'Expires', …(1) }  |
| T7SP.17 | should give a Planned option Trade Detail the expiration line Expires | green | `npx vitest run tests/integration/d7sp/trade-detail-finished.test.ts -t "should give a Planned option Trade Detail the expiration line Expires"` | exit 0; Tests  1 passed, 2 skipped (3) |  |
| T7SP.17 | should give no expiration line to an Open option Trade whose contract is Settlement Due, since its panel says so | red | `npx vitest run tests/integration/d7sp/trade-detail-finished.test.ts -t "should give no expiration line to an Open option Trade whose contract is Settlement Due, since its panel says so"` | exit 0; Tests  1 passed, 3 skipped (4) |  |
| T7SP.17 | should give no expiration line to an Open option Trade whose contract is Settlement Due, since its panel says so | green | `npx vitest run tests/integration/d7sp/trade-detail-finished.test.ts -t "should give no expiration line to an Open option Trade whose contract is Settlement Due, since its panel says so"` | exit 0; Tests  1 passed, 3 skipped (4) |  |
| T7SP.17 | should give a Closed option Trade whose Terminal Disposition includes an Expiration the line Expired with the date | red | `npx vitest run tests/integration/d7sp/trade-detail-finished.test.ts -t "should give a Closed option Trade whose Terminal Disposition includes an Expiration the line Expired with the date"` | exit 1; Tests  1 failed, 4 skipped (5) | AssertionError: expected { status: 'Expires', …(1) } to deeply equal { status: 'Expired', …(1) }  |
| T7SP.17 | should give a Closed option Trade whose Terminal Disposition includes an Expiration the line Expired with the date | green | `npx vitest run tests/integration/d7sp/trade-detail-finished.test.ts -t "should give a Closed option Trade whose Terminal Disposition includes an Expiration the line Expired with the date"` | exit 0; Tests  1 passed, 4 skipped (5) |  |
| T7SP.17 | should give no expiration line to a Closed option Trade that only Executions disposed of | red | `npx vitest run tests/integration/d7sp/trade-detail-finished.test.ts -t "should give no expiration line to a Closed option Trade that only Executions disposed of"` | exit 0; Tests  1 passed, 5 skipped (6) |  |
| T7SP.17 | should give no expiration line to a Closed option Trade that only Executions disposed of | green | `npx vitest run tests/integration/d7sp/trade-detail-finished.test.ts -t "should give no expiration line to a Closed option Trade that only Executions disposed of"` | exit 0; Tests  1 passed, 5 skipped (6) |  |

## T7SP.17 Trade Views: Detail carries the held quantity and the expiration line

The T7SP.17 rows above sit at the end of the T7SP.16 section because tdd.sh appends; they are single-case runs. Names rephrased for -t: "Position's signed quantities" became "Positions signed quantities", "Terminal Disposition's" and "contract's" lost their apostrophes ("its contract expiration date"). The case "...that only Executions disposed of (decision 94)" was run with the name cut before the parenthesis.

| Task | Case | Phase | Command | Outcome | Failure excerpt |
|---|---|---|---|---|---|
| T7SP.17 | Settlement Due Open option Trade has no expiration line | note | none | First-run pass, flagged for the user. The case-2 code (the line is set only when the settlement list is empty) built the behavior. Mutation: replaced `settlement.length === 0` with `true` so the line shows with the panel. Command: `npx vitest run tests/integration/d7sp/trade-detail-finished.test.ts -t "Settlement Due, since its panel"`. Restored and green. | AssertionError: expected true to be false // Object.is equality |
| T7SP.17 | Closed option Trade only Executions disposed of has no line | note | none | First-run pass, flagged for the user. The case-5 code (Expired only when the mechanisms include an Expiration) built the behavior. Mutation: changed `mechanism === 'Expiration'` to `!==` in `closedByExpiration`. Command: `npx vitest run tests/integration/d7sp/trade-detail-finished.test.ts -t "should give no expiration line to a Closed option Trade that only Executions disposed of"`. Restored and green. | AssertionError: expected true to be false // Object.is equality |

### Existing expectation extended (authorized by the coordinator)

`src/coordinators/trade-views/trade-summary.test.ts:154`, the sorted key list of the Open stock Detail (case "should keep every other field of every item and Detail unchanged"), failed because the Detail gained `heldQuantity`. Before: the list ran `'fees', 'findings', 'journal', ...`. After: `'fees', 'findings', 'heldQuantity', 'journal', ...`. Nothing else changed; `toEqual` stays. (A stock Detail has no `contractExpiration`.)
| T7SP.17 | refactor | refactor | none | The line is built in three places (Planned branch, Open view, closedDetail) through one helper `expirationLineOf`, with `closedByExpiration` local to the coordinator (no src/ui import). No further change; src and integration suites green. | |

### Typed fixture builders extended (additive)

`tests/support/open-detail-fixtures.ts` and `tests/support/option-detail-fixtures.ts` (three builders of `OpenTradeDetail` and `ClosedTradeDetail`) failed `npm run typecheck` for the missing required `heldQuantity`. Each gained `heldQuantity`, the sum of `derived.positions` quantities. No existing value changed.

## T7SP.18 Trade Detail reads the finished fields (decision 105)

Structural task; no cases, so no red or green rows. Verification:

- `grep -n '\.reduce(\|\.div(\|\.add(\|closedByExpiration' src/ui/screens/TradeDetail.tsx`: before, lines 32, 314, 316, 446 and 1112; after, no output (exit 1).
- `npm run typecheck`: exit 0.
- `npx vitest run src/ui`: 36 files, 580 tests passed (before the builder extension below, 2 failed for the missing `contractExpiration`).
- `npx vitest run src`: 125 files, 1479 tests passed.
- `npx tsc6 --noEmit`, `npm run lint`, `npm run lint:deps`, `npm run verify:wording`: each exit 0.

Typed fixture builder extended (additive): `tests/support/option-detail-fixtures.ts`, `optionOpenDetail` gained `contractExpiration` (Expires, the contract's stored date, when no settlement item is Due) and `optionClosedDetail` gained it (Expired, when the Terminal Disposition includes an Expiration). No test file or expectation changed.

## T7SP.19 Market Data: the read session scans gaps from the earliest exposure (decision 106)

Rows are single-case runs.

| Task | Case | Phase | Command | Outcome | Failure excerpt |
|---|---|---|---|---|---|
| T7SP.19 | should scan an Instrument from the earliest exposure asked, reading no stored observation before it | red | `npx vitest run src/modules/market-data/read-session.test.ts -t "should scan an Instrument from the earliest exposure asked, reading no stored observation before it"` | exit 1; Tests  1 failed, 16 skipped (17) | AssertionError: expected [ [ 'MNO', '2024-01-02' ] ] to deeply equal [ [ 'MNO', '2026-10-09' ] ]  |
| T7SP.19 | should scan an Instrument from the earliest exposure asked, reading no stored observation before it | green | `npx vitest run src/modules/market-data/read-session.test.ts -t "should scan an Instrument from the earliest exposure asked, reading no stored observation before it"` | exit 0; Tests  1 passed, 16 skipped (17) |  |
| T7SP.19 | should scan an Instrument once from the earlier exposure when two calls in the same run ask from different exposures | red | `npx vitest run src/modules/market-data/read-session.test.ts -t "should scan an Instrument once from the earlier exposure when two calls in the same run ask from different exposures"` | exit 1; Tests  1 failed, 16 skipped (17) | AssertionError: expected [ [ 'MNO', '2026-10-09' ] ] to deeply equal [ [ 'MNO', '2026-10-07' ] ]  |
| T7SP.19 | should scan an Instrument once from the earlier exposure when two calls in the same run ask from different exposures | green | `npx vitest run src/modules/market-data/read-session.test.ts -t "should scan an Instrument once from the earlier exposure when two calls in the same run ask from different exposures"` | exit 0; Tests  1 passed, 16 skipped (17) |  |
| T7SP.19 | should scan an Instrument from the earliest exposure asked | green | `npx vitest run src/modules/market-data/read-session.test.ts -t "should scan an Instrument from the earliest exposure asked"` | exit 0; Tests  1 passed, 16 skipped (17) |  |
| T7SP.19 | should scan an Instrument once from the earlier exposure when two calls in the same run ask from different exposures | green | `npx vitest run src/modules/market-data/read-session.test.ts -t "should scan an Instrument once from the earlier exposure when two calls in the same run ask from different exposures"` | exit 0; Tests  1 passed, 16 skipped (17) |  |
| T7SP.19 | should scan an Instrument's gaps again from an earlier exposure that a later call asks for, answering each call as recover does | green | `npx vitest run src/modules/market-data/read-session.test.ts -t "should scan an Instrument's gaps again from an earlier exposure that a later call asks for, answering each call as recover does"` | exit 0; Tests  1 passed, 16 skipped (17) |  |
| T7SP.19 | T7SP.5-B1 case changed (sanctioned by decision 106) | note | none | Before: "should scan an Instrument's gaps once when a later call asks from an earlier exposure, answering each call as recover does", expecting 1 `getAll`. After: "should scan an Instrument's gaps again from an earlier exposure that a later call asks for, answering each call as recover does", expecting 2. Its answer assertions are unchanged. Before the edit, the old case failed with `expected [...] to have a length of 1 but got 2` under the new code; after the edit it is green (row above). The first green row for case 1 with the shortened name was a substring filter run of the same case, and the second case's green appears twice (one run was chained and its summary swallowed). | |
| T7SP.19 | refactor | refactor | none | None beyond the case-2 code: `scanOf` takes the exposure, a `Scan` record holds the batch's lowest exposure, a cached scan is lowered in place while its batch still collects and replaced by a new scan otherwise. No further change. | |
