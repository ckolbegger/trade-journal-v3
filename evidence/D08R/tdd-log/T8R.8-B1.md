# D08R TDD log, T8R.8-B1

One file per task (decision 111), so parallel lanes never edit one file. Each row is one single-case run; see `../tdd-log.md` for the rules.

| T8R.8-B1 | should expose each open lot tick by its name | red | `npx vitest run src/ui/cockpit/track.test.tsx -t "should expose each open lot tick by its name"` | exit 0; Tests  1 skipped (1) |  |
| T8R.8-B1 | should expose each open lot tick by its name | red | `npx vitest run src/ui/cockpit/track.test.tsx -t "should expose each open lot tick by its name"` | exit 1; Tests  1 failed, 1 skipped (2) | AssertionError: expected <div class="track" role="img" …(1)>…(2)</div> to be null  |
| T8R.8-B1 | should expose each open lot tick by its name | green | `npx vitest run src/ui/cockpit/track.test.tsx -t "should expose each open lot tick by its name"` | exit 0; Tests  1 passed, 1 skipped (2) |  |
| T8R.8-B1 | refactor | refactor | none beyond the fix | Nothing to refactor. today.props.test.ts helper optionTrack now returns the .track around the named image; z-index added so ticks stay under markers. |  |
