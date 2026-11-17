# D08R TDD log, T8R.27-B1

Test-only change to `e2e/d8r/names.spec.ts` (decision 111: one file per task). The mutation is a temporary `page.evaluate` inside `expectNamed` that sets `aria-label="XYZ 2026-12-18 55 Call"` on the first leaf element whose text is the contract name. It was added and removed with the Edit tool.

| Task | Case | Phase | Result |
|---|---|---|---|
| T8R.27-B1 | B8R.5 Contract names, old check with the mutation | red (trivial pass) | `.claude/scripts/with-browser-lock.sh npx playwright test e2e/d8r/names.spec.ts`: `1 passed (2.4s)`. The old `namesOn` kept only `label.match(pattern)`, so the misspelled label was never compared. |
| T8R.27-B1 | B8R.5 Contract names, new check with the same mutation | red | Same command: `1 failed`. First failure line: `Error: Detail: an accessible name's contract` with `Expected: "XYZ Dec 18 $55 Call"` and `Received: "XYZ 2026-12-18 55 Call"`. |
| T8R.27-B1 | B8R.5 Contract names, mutation removed | green | Same command: `1 passed (2.4s)`; `npx playwright test e2e/d8r` under the lock: `13 passed (1.2m)`. |

Writing notes: the first loose pattern (symbol to Call or Put) flagged "XYZ · Long Call" and spans across two XYZ; it now needs a digit and stops at the next XYZ. The Review card names a position "XYZ (Long 2 Dec 18 $55 Call)" (heading button "Review XYZ Long 2 Dec 18 $55 Call ..."); the check removes the side and quantity and requires the rest to be the W28 name. Flagged in the report as a possible W28 question.
