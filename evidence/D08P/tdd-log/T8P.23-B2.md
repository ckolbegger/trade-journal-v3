# D08P TDD log, T8P.23-B2

Playwright rows, logged by hand. Output of the red run: `../browser/T8P.23-B2-red.txt`; later specs: `../browser/T8P.23-B2-specs.txt`.

| Task | Case | Phase | Command | Outcome | Failure excerpt |
|---|---|---|---|---|---|
| T8P.23-B2 | should show every term and value of the Settlement Due panel in the rail at 1280 px without a word broken across lines | red | `npx playwright test e2e/d7/responsive-a11y.spec.ts -g "without a word broken"` | exit 1; 1 failed | expect(broken).toEqual([]): received ["Long 1 contract", "Fri Nov 20, 16:00"] |
| T8P.23-B2 | should show every term and value of the Settlement Due panel in the rail at 1280 px without a word broken across lines | green | `npx playwright test e2e/d7/responsive-a11y.spec.ts -g "without a word broken"` | exit 0; 1 passed | |
