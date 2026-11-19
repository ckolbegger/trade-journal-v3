# D09AR TDD log, T9AR.17-B4

One file per task (decision 111), so parallel lanes never edit one file. Each row is one single-case run; see `../tdd-log.md` for the rules.
| T9AR.17-B4 | should find a newer card after an older one when the cards span pages | red | `playwright test e2e/d9/session-cards.spec.ts` | exit 1; 1 failed | expect(locator).toBeVisible() failed: the Wed Nov 11 card, element(s) not found (the helper only presses Earlier sessions) |
| T9AR.17-B4 | should find a newer card after an older one when the cards span pages | green | `playwright test e2e/d9/session-cards.spec.ts` | exit 0; 1 passed | |
