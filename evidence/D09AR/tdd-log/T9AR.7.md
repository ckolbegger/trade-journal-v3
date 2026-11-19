# D09AR TDD log, T9AR.7

One file per task (decision 111), so parallel lanes never edit one file. Each row is one single-case run; see `../tdd-log.md` for the rules.

| T9AR.7 | should show its content in a modal dialog named | red | `npx vitest run src/ui/cockpit/replay/overlay.test.tsx -t "should show its content in a modal dialog named"` | exit 1; Tests  1 failed, 8 skipped (9) | TestingLibraryElementError: Unable to find an accessible element with the role "dialog" and name "Replay, BREN"  |
| T9AR.7 | should show its content in a modal dialog named | green | `npx vitest run src/ui/cockpit/replay/overlay.test.tsx -t "should show its content in a modal dialog named"` | exit 0; Tests  1 passed, 8 skipped (9) |  |
| T9AR.7 | should head it BREN | red | `npx vitest run src/ui/cockpit/replay/overlay.test.tsx -t "should head it BREN"` | exit 0; Tests  9 skipped (9) |  |
| T9AR.7 | should head it BREN | red | `npx vitest run src/ui/cockpit/replay/overlay.test.tsx -t "should head it BREN"` | exit 0; Tests  9 skipped (9) |  |
| T9AR.7 | should head it | red | `npx vitest run src/ui/cockpit/replay/overlay.test.tsx -t "should head it"` | exit 1; Tests  1 failed, 8 skipped (9) | TestingLibraryElementError: Unable to find an accessible element with the role "heading"  |
| T9AR.7 | should head it | green | `npx vitest run src/ui/cockpit/replay/overlay.test.tsx -t "should head it"` | exit 0; Tests  1 passed, 8 skipped (9) |  |
| T9AR.7 | should move focus into | red | `npx vitest run src/ui/cockpit/replay/overlay.test.tsx -t "should move focus into"` | exit 1; Tests  1 failed, 8 skipped (9) | AssertionError: expected false to be true // Object.is equality  |
| T9AR.7 | should move focus into | green | `npx vitest run src/ui/cockpit/replay/overlay.test.tsx -t "should move focus into"` | exit 0; Tests  1 passed, 8 skipped (9) |  |
| T9AR.7 | should keep Tab | red | `npx vitest run src/ui/cockpit/replay/overlay.test.tsx -t "should keep Tab"` | exit 1; Tests  1 failed, 8 skipped (9) | AssertionError: expected false to be true // Object.is equality  |
| T9AR.7 | should keep Tab | green | `npx vitest run src/ui/cockpit/replay/overlay.test.tsx -t "should keep Tab"` | exit 0; Tests  1 passed, 8 skipped (9) |  |
| T9AR.7 | should call onClose from | red | `npx vitest run src/ui/cockpit/replay/overlay.test.tsx -t "should call onClose from"` | exit 1; Tests  1 failed, 8 skipped (9) | AssertionError: expected "vi.fn()" to be called 2 times, but got 1 times  |
| T9AR.7 | should call onClose from | green | `npx vitest run src/ui/cockpit/replay/overlay.test.tsx -t "should call onClose from"` | exit 0; Tests  1 passed, 8 skipped (9) |  |
| T9AR.7 | should leave Escape to a control | red | `npx vitest run src/ui/cockpit/replay/overlay.test.tsx -t "should leave Escape to a control"` | exit 1; Tests  1 failed, 8 skipped (9) | AssertionError: expected "vi.fn()" to not be called at all, but actually been called 1 times Received:  |
| T9AR.7 | should leave Escape to a control | green | `npx vitest run src/ui/cockpit/replay/overlay.test.tsx -t "should leave Escape to a control"` | exit 0; Tests  1 passed, 8 skipped (9) |  |
| T9AR.7 | should return focus | red | `npx vitest run src/ui/cockpit/replay/overlay.test.tsx -t "should return focus"` | exit 1; Tests  1 failed, 8 skipped (9) | AssertionError: expected <body><div><div>…(1)</div></div></body> to be <button type="button"></button> // Object.is equality  |
| T9AR.7 | should return focus | green | `npx vitest run src/ui/cockpit/replay/overlay.test.tsx -t "should return focus"` | exit 0; Tests  1 passed, 8 skipped (9) |  |
| T9AR.7 | should head a finished | green | `npx vitest run src/ui/cockpit/replay/overlay.test.tsx -t "should head a finished"` | exit 0; Tests  1 passed, 8 skipped (9) |  |
| T9AR.7 | should leave a shell banner | green | `npx vitest run src/ui/cockpit/replay/overlay.test.tsx -t "should leave a shell banner"` | exit 0; Tests  1 passed, 8 skipped (9) |  |

| note | First-run pass, flagged for the user: "should head a finished Trade ... and show the symbol alone". The heading shows the `header` prop as given (built by the header case). Mutation: the heading renders `header.slice(0, 4)`. Command: `npx vitest run src/ui/cockpit/replay/overlay.test.tsx -t "should head a finished"`. Failed with an assertion failure on the heading text (1 failed). |
| note | First-run pass, flagged for the user: "should leave a shell banner present ...". Inert on open and its removal on close were built by the first case and the focus-return case. Mutation: the cleanup sets `aria-hidden` instead of removing `inert`. Command: `npx vitest run src/ui/cockpit/replay/overlay.test.tsx -t "should leave a shell banner"`. Failed with an assertion failure (banner still inside `[inert]` after close; 1 failed). |
| refactor | No change to the code after review: one component, one effect, one key handler. Added the overlay chrome rules to replay-overlay.css (no unit case, A275). Tests ran in the order written; the header case was first coded ahead of its red, so the header and Close were taken out and its red re-run. No test renamed; the case wording is as planned. |
