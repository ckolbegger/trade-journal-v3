# D09AR TDD log, T9AR.24-B1

One file per task (decision 111), so parallel lanes never edit one file. Each row is one single-case run; see `../tdd-log.md` for the rules.

| T9AR.24-B1 | should split a card text into words and figures | red | `npx vitest run src/ui/cockpit/replay/cards.props.test.ts -t "should split a card text into words and figures"` | exit 1; Tests  1 failed, 2 skipped (3) | TypeError: figureParts is not a function  |
| T9AR.24-B1 | should split a card text into words and figures | red | `npx vitest run src/ui/cockpit/replay/cards.props.test.ts -t "should split a card text into words and figures"` | exit 1; Tests  1 failed, 2 skipped (3) | AssertionError: expected [ Array(1) ] to deeply equal [ { text: 'Past the Stop by ' }, …(5) ]  |
| T9AR.24-B1 | should split a card text into words and figures | green | `npx vitest run src/ui/cockpit/replay/cards.props.test.ts -t "should split a card text into words and figures"` | exit 0; Tests  1 passed, 2 skipped (3) |  |
| e2e red | e2e/d9ar/cards.spec.ts "should keep every figure on a session card on one line ... DALE-hold, AXIO, BREN" | 3 failed: AssertionError "DALE-hold at 1280, cards page 1" received ["Mon Nov 16: \"−$33,936.00\"", ...] (figures broken across lines); run with `with-browser-lock.sh npx playwright test e2e/d9ar/cards.spec.ts -g T9AR.24-B1` |
| e2e red (rows) | same, with the added row-width assertion on the build before the `dl` fix | 1 failed: "DALE-hold at 1280, cards page 1: rows in a narrow column" |
| e2e green | same three cases | 3 passed at 1280, 1440, 375, 320 after nowrap figure spans and `dl { display: block }` |
| refactor | session-cards.tsx, cards.props.ts | `Words` component renders `figureParts`; class named `card-figure` (the readout already owns `replay-figure`); the existing Past line unit test reads the line's textContent, not a single text node (the line is now several nodes). No other change. |
