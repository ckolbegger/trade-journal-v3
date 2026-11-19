# D09AR TDD log, T9AR.10-B2

One file per task (decision 111), so parallel lanes never edit one file. Each row is one single-case run; see `../tdd-log.md` for the rules.

| T9AR.10-B2 | should give each key entry the swatch of what it names | red | `npx vitest run src/ui/cockpit/replay/corridor.test.tsx -t "should give each key entry the swatch of what it names"` | exit 1; Tests  1 failed, 37 skipped (38) | AssertionError: expected { 'Open profit': null, …(3) } to deeply equal { 'Open profit': 'area-profit', …(3) }  |
| T9AR.10-B2 | should give each key entry the swatch of what it names | green | `npx vitest run src/ui/cockpit/replay/corridor.test.tsx -t "should give each key entry the swatch of what it names"` | exit 1; Tests  1 failed, 37 skipped (38) | TypeError: The URL must be of scheme file  |
| T9AR.10-B2 | should give each key entry the swatch of what it names | green | `npx vitest run src/ui/cockpit/replay/corridor.test.tsx -t "should give each key entry the swatch of what it names"` | exit 0; Tests  1 passed, 37 skipped (38) |  |
| refactor | T9AR.10-B2 | none | No change; the swatch variant comes from the entry's kind and label (PlotKeyEntry is in a file this lane does not own). |
