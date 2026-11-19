# D09AR TDD log, T9AR.24-B9

One file per task (decision 111). The case is a browser case (the e2e tier), so its rows are written by hand from the Playwright runs.

| T9AR.24-B9 | should make the Review overlay's Price History link at least 44 pixels high at 375 and at 320 | red | `npx playwright test e2e/d9ar/responsive-a11y.spec.ts -g "Price History link at least 44"` | exit 1; 2 failed | Expected: >= 44, Received: 23.1875 |
| T9AR.24-B9 | should make the Review overlay's Price History link at least 44 pixels high at 375 and at 320 | green | same command | exit 0; 2 passed | |
| refactor | none; the link takes the app's `pill secondary` classes in a `replay-links` paragraph, as Trade Detail's button does |
