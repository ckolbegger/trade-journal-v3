# D09AR TDD log, T9AR.24-B3-F1

Structural task. The clear of the set-aside drafts moved out of render: `ReviewView` now clears them in a mount effect, and the form reads them only when its address has replay=open (so the effect's later timing cannot matter). Verification: the Review unit specs stay green and unchanged (see the lane run `T9AR.24-B3-fixes`); the B3 cases in `ReviewCard.test.tsx` and `e2e/d9ar/review.spec.ts` keep their expected values.

| T9AR.24-B3-F1 | refactor | `npx vitest run src/ui/screens/ReviewCard.test.tsx` | 72 passed |
