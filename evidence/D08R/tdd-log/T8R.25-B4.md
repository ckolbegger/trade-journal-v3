# T8R.25-B4 tdd-log

Playwright rows are written by hand (not through tdd.sh).

| Task | Case | Phase | Command | Result |
|---|---|---|---|---|
| T8R.25-B4 | should fit the Today table in its drawer at 1280 px, unscrolled, with each column heading read in full | red | `.claude/scripts/with-browser-lock.sh npx playwright test e2e/d8r/responsive-a11y.spec.ts -g "T8R.25-B4"` | failed: "O-C3 Sat 10-17 10:00: Marks table content wider than its box", Expected <= 550, Received 588 (an earlier run failed on a wrong selector, fixed, not a red) |
| T8R.25-B4 | same | green | same command, after `npm run build:faults` and `npm run build:releases` | 1 passed |
| T8R.25-B4 | refactor | refactor | none | No change: one CSS rule, nothing to refactor. |
