# T9AR.23-S3 (lane OV)

| step | result |
|---|---|
| red | the Close button is 21 px high at 375 (as reported when the case ran under test.fail) |
| green | `npx playwright test e2e/d9ar/responsive-a11y.spec.ts -g "Close button"` 1 passed (2.8s) |

Fix: on a phone the Close button has `min-height: 44px` and the header's own vertical padding is 0, so the header grows only 3 px.
