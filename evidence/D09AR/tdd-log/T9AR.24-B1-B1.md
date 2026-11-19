# D09AR TDD log, T9AR.24-B1-B1

One file per task (decision 111), so parallel lanes never edit one file. Each row is one single-case run; see `../tdd-log.md` for the rules.

| T9AR.24-B1-B1 | should keep each edge odds pair, under 1% : over 99% and over 99% : under 1%, as one figure part | red | `npx vitest run src/ui/cockpit/replay/cards.props.test.ts -t "should keep each edge odds pair, under 1% : over 99% and over 99% : under 1%, as one figure part"` | exit 1; Tests  1 failed, 3 skipped (4) | AssertionError: expected [ { text: '11.69 to 1', …(1) }, …(1) ] to deeply equal [ { text: '11.69 to 1', …(1) }, …(2) ]  |
| T9AR.24-B1-B1 | should keep each edge odds pair, under 1% : over 99% and over 99% : under 1%, as one figure part | green | `npx vitest run src/ui/cockpit/replay/cards.props.test.ts -t "should keep each edge odds pair, under 1% : over 99% and over 99% : under 1%, as one figure part"` | exit 0; Tests  1 passed, 3 skipped (4) |  |
