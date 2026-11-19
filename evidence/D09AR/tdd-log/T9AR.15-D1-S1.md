# T9AR.15-D1-S1 (suite failure: stake helper)

- fail: old helper `scope.locator('.replay-stake')` at e2e/d9/replay.spec.ts:108 -> 1 failed (text held the visible and the spoken form).
- fix: `stake` reads the aria-hidden span, else the plain paragraph.
- pass: `npx playwright test e2e/d9/replay.spec.ts e2e/d9/states.spec.ts e2e/d9/gaps.spec.ts` under the lock -> 14 passed.
