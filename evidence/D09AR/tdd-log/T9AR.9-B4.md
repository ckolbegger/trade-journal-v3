# D09AR TDD log, T9AR.9-B4

One file per task (decision 111), so parallel lanes never edit one file. Each row is one single-case run; see `../tdd-log.md` for the rules.

| T9AR.9-B4 | should open the card the address names when a history move changes both the card and the overlay | red | `npx vitest run src/ui/screens/ReviewCard.test.tsx -t "should open the card the address names when a history move changes both the card and the overlay"` | exit 1; Tests  1 failed, 68 skipped (69) | TestingLibraryElementError: Unable to find role="region" and name "ABC review"  |
| T9AR.9-B4 | should open the card the address names when a history move changes both the card and the overlay | green | `npx vitest run src/ui/screens/ReviewCard.test.tsx -t "should open the card the address names when a history move changes both the card and the overlay"` | exit 0; Tests  1 passed, 68 skipped (69) |  |
| T9AR.9-B4 | should open the card the address names when a history move changes both the card and the overlay | green | `npx vitest run src/ui/screens/ReviewCard.test.tsx -t "should open the card the address names when a history move changes both the card and the overlay"` | exit 0; Tests  1 passed, 68 skipped (69) |  |
| refactor | none beyond the fix; test helper `here.push` added in ReviewCard.test.tsx; Replay opening replaces the entry only when it names something else than this card, so existing cases that start at a bare /review keep their expected addresses |
