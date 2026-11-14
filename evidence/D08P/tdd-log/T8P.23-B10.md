# D08P TDD log, T8P.23-B10

One file per task (decision 111), so parallel lanes never edit one file. Each row is one single-case run; see `../tdd-log.md` for the rules.

| Task | Case | Phase | Command | Outcome | Failure excerpt |
|---|---|---|---|---|---|
| T8P.23-B10 | should move focus into the opened form and scroll it into view when Reflect now is chosen in Needs you | red | `npx vitest run src/ui/screens/trade-detail/Cockpit.test.tsx -t "should move focus into the opened form and scroll it into view when Reflect now is chosen in Needs you"` | exit 1; Tests  1 failed, 12 skipped (13) | AssertionError: expected false to be true // Object.is equality  |
| T8P.23-B10 | should move focus into the opened form and scroll it into view when Reflect now is chosen in Needs you | green | `npx vitest run src/ui/screens/trade-detail/Cockpit.test.tsx -t "should move focus into the opened form and scroll it into view when Reflect now is chosen in Needs you"` | exit 0; Tests  1 passed, 12 skipped (13) |  |
| T8P.23-B10 | should move focus into the opened form and scroll it into view when Reflect now is chosen in Needs you | green | `npx vitest run src/ui/screens/trade-detail/Cockpit.test.tsx -t "should move focus into the opened form and scroll it into view when Reflect now is chosen in Needs you"` | exit 0; Tests  1 passed, 12 skipped (13) |  |
| T8P.23-B10 | browser, 1280 and 375 px: form in view and focus inside it after Reflect now in Needs you | note | `npx playwright test e2e/d5/detail-debt.spec.ts -g B10`, hand-logged | red with the focus line removed from OwedDebtItem (2 failed) | 1280: expect(received).toBe(expected) Expected: true Received: false (focus); 375: toBeInViewport failed, viewport ratio 0. Green with the fix (2 passed). |
| T8P.23-B10 | refactor | refactor | | none | The first version held the flag in a ref and set state in an effect, both refused by lint; the flag is now state set in open(fromRequest), no behavior change. Unit and browser cases rerun green. |
