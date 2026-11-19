# D09AR TDD log, T9AR.15-B1

One file per task (decision 111), so parallel lanes never edit one file. Each row is one single-case run; see `../tdd-log.md` for the rules.

| T9AR.15-B1 | should speak the current ratio and the odds in full to a screen reader in the Reward to risk row | red | `npx vitest run src/ui/cockpit/replay/readout.test.tsx -t "should speak the current ratio and the odds in full to a screen reader in the Reward to risk row"` | exit 1; Tests  1 failed, 10 skipped (11) | AssertionError: expected <span role="img" …(1)></span> to be null  |
| T9AR.15-B1 | should speak the current ratio and the odds in full to a screen reader in the Reward to risk row | green | `npx vitest run src/ui/cockpit/replay/readout.test.tsx -t "should speak the current ratio and the odds in full to a screen reader in the Reward to risk row"` | exit 0; Tests  1 passed, 10 skipped (11) |  |
| T9AR.15-B1 | readout.tsx | refactor | none beyond the fix | Existing odds case: the labelled image now holds only the odds part ("about 8% : 92%"), so its textContent assertion changed from the whole value to that part; the whole-row text assertion is unchanged. | |
