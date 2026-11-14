# T8P.26-B4 tdd log (browser spec, rows logged by hand)

| Task | Case | Result | Command | Outcome | Failure |
|---|---|---|---|---|---|
| T8P.26-B4 | both cases of e2e/d8p/today-narrow.spec.ts (row labels not cut at the scroll box's left edge at 375 and 320 px) | red | `.claude/scripts/with-browser-lock.sh npx playwright test e2e/d8p/today-narrow.spec.ts` | 2 failed | row labels cut at the scroll box's left edge at 320 px: "XYZ Mark 32 < 37" |
| T8P.26-B4 | same | green | same, after cell padding 0.15rem to 0.08rem in today.css | 2 passed | |
| T8P.26-B4 | refactor | refactor | n/a | none | |
