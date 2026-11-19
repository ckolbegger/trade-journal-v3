# D09AR TDD log, T9AR.23-S4

One file per task (decision 111), so parallel lanes never edit one file. Each row is one single-case run; see `../tdd-log.md` for the rules.

| T9AR.23-S4 | should draw the From here sentence in the status line’s colour | red | `playwright test e2e/d9ar/readout.spec.ts -g "From here sentence"` (test.fail line removed) | exit 1; 1 failed | the stake sentence's colour (muted rgb(85, 82, 75)) differs from the status line's rgb(28, 27, 25) |
| T9AR.23-S4 | should draw the From here sentence in the status line’s colour | green | same, after removing the `.replay-stake` muted colour rule and rebuilding dist-faults | exit 0; 1 passed | |
