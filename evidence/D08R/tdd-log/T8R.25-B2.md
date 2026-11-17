# D08R TDD log, T8R.25-B2

One file per task (decision 111), so parallel lanes never edit one file. Each row is one single-case run; see `../tdd-log.md` for the rules.

| T8R.25-B2 | should show the Settlement Due reason in every Conditions cell on the expiration evening, as the note and the rail do | red | `npx vitest run src/ui/cockpit/drawers/plan-risk.test.tsx -t "should show the Settlement Due reason in every Conditions cell on the expiration evening, as the note and the rail do"` | exit 1; Tests  1 failed, 20 skipped (21) | AssertionError: expected [ '$2.20 away', …(3) ] to deeply equal [ …(4) ]  |
| T8R.25-B2 | should show the Settlement Due reason in every Conditions cell on the expiration evening, as the note and the rail do | green | `npx vitest run src/ui/cockpit/drawers/plan-risk.test.tsx -t "should show the Settlement Due reason in every Conditions cell on the expiration evening, as the note and the rail do"` | exit 0; Tests  1 passed, 20 skipped (21) |  |
| T8R.25-B2 | - | refactor | - | none: the Unavailable-only guard in figureOf was dropped; one existing test double (B1 Settlement Due test) now carries a real settlement entry instead of a stub | |
