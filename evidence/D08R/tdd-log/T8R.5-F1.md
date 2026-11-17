# D08R TDD log, T8R.5-F1

One file per task (decision 111), so parallel lanes never edit one file. Browser cases are recorded by hand: the command and its output lines.

| Task | Case | Result | Command | Output |
| --- | --- | --- | --- | --- |
| T8R.5-F1 | B7.13 at fc58e8ca^ (7ac6f180), pin | pass | `npx playwright test e2e/d7/responsive-a11y.spec.ts -g "Lot Matches named once"` | 1 passed |
| T8R.5-F1 | B7.13 at fc58e8ca, pin | red | same | `columns: 5`, `cut: ["Unconsumed opening fee", "$0.65"]`, `scrolls: true` (expected columns 4, cut [], scrolls false) |
| T8R.5-F1 | B7.13 at base e5c91f2a | red | same | same lines; region 550 px, table 566 px |
| T8R.5-F1 | B7.13 after the fix (columns 5) | green | same | 1 passed; region 550, table 550, cells Instrument 118, Opened 148, Quantity 90, Price 63, Unconsumed opening fee 131 |
| T8R.5-F1 | lot-matches-fit.spec.ts, after Open Lots fix only | red | `npx playwright test e2e/d8p/lot-matches-fit.spec.ts` | 2 failed: "Lot Matches overflows its box at 1280 px" |
| T8R.5-F1 | lot-matches-fit.spec.ts, after Lot Matches fix | green | same | 2 passed |
