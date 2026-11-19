# T9AR.24-B3-B3 (test fix, no red/green cycle)

The case "should keep a started Action when the browser goes Forward to Price History and Back again after a round trip" now takes: start Action; round trip by the overlay's links; browser Back (Price History); browser Back (first Review entry); browser Forward (Price History); browser Back (Review); close the overlay; assert choice and Intent.

- pass (fixed case): `.claude/scripts/with-browser-lock.sh npx playwright test e2e/d9ar/review.spec.ts -g "Forward to Price History"` -> 1 passed
- bite: `'review'` -> `'reviewX'` in `setDraftAsideOnTrip` (src/ui/screens/action-draft.ts), `npm run build:faults`, same command -> 1 failed, "after the round trip: Exit ... toBeChecked() failed" (the shared code path fails at the first assertion, already after the link round trip). Restored; `git diff -- src` empty; rebuilt.
