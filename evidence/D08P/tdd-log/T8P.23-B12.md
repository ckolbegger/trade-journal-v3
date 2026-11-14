# D08P TDD log, T8P.23-B12

One file per task (decision 111), so parallel lanes never edit one file. Each row is one single-case run; see `../tdd-log.md` for the rules.

| Task | Case | Phase | Command | Outcome | Failure excerpt |
|---|---|---|---|---|---|
| T8P.23-B12 | should give a stock Trade's Mark a dollar sign and an option Trade's Underlying Mark none | red | `npx vitest run src/ui/cockpit/drawers/price-history.props.test.tsx -t "should give a stock Trade's Mark a dollar sign and an option Trade's Underlying Mark none"` | exit 1; Tests  1 failed, 9 skipped (10) | AssertionError: expected [ 'XYZ Mark', '51.50', '51.00' ] to deeply equal [ 'XYZ Mark', '$51.50', '$51.00' ]  |
| T8P.23-B12 | should give a stock Trade's Mark a dollar sign and an option Trade's Underlying Mark none | green | `npx vitest run src/ui/cockpit/drawers/price-history.props.test.tsx -t "should give a stock Trade's Mark a dollar sign and an option Trade's Underlying Mark none"` | exit 0; Tests  1 passed, 9 skipped (10) |  |
