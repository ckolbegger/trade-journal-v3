# D4 structural verifications

Each entry records a structural task's exact verification (D4 breakdown, section 5), and each task ends with a complete cumulative suite run delegated to the `suite-runner` subagent, with full outputs in `suite-runs/`. Versions are in [provenance.md](provenance.md). Each task's `ocr-review` findings and bug tasks are recorded under the task's heading, with the raw outputs in `ocr/`.

## T4.1 Session policy

Implementation commit `fd100c5`. Nine of the 20 cases passed on their first run because earlier cases had built the behavior; each has a mutation check in `tdd-log.md` and is flagged for the user.

### ocr review of `fd100c5`

Session `7973f261-b334-48a7-9e4a-e4dbd193d3bf`, model gpt-6.1-sol, 6 files reviewed, 4 comments. Raw output: `ocr/T4.1-fd100c5.json`.

| Severity | Location | Claim | Assessment | Disposition |
|---|---|---|---|---|
| medium | `src/domain/session-policy/table.ts:31` | Early-close table omits 2002-07-05 and 2003-12-26; 2002-07-03 and 2003-07-03 rows may be wrong | Doubtful (from memory, unchecked) | Folded into T4.2, whose purpose is to transcribe NYSE's published calendars and correct the table against them; guessing from memory now would be replaced there anyway |
| medium | `src/domain/session-policy/policy.ts:31` | `previousSession`/`nextSession` don't check the input date's coverage (`nextSession('1999-12-31')` returns 2000-01-03) | Valid | Bug task T4.1-B1 |
| medium | `src/domain/session-policy/policy.ts:15` | Duplicate table dates are not rejected; the row map is last-wins while the digest sort ignores input order, so reordering changes classification without changing the digest | Valid | Bug task T4.1-B2 |
| low | `src/domain/session-policy/digest.ts:10` | Nested ternaries in the sort comparator | Valid, cosmetic | Folded into T4.1-B2 (same comparator) |

### T4.1-B1 Neighbours respect coverage

Defect: a date outside coverage gets a guessed neighbour session, contrary to P8 ("for any date outside coverage, the policy returns a `SessionPolicyCoverage` diagnostic and never a guessed session").
- it should return a SessionPolicyCoverage diagnostic from previousSession and nextSession when the input date is outside coverage
- it should return a SessionPolicyCoverage diagnostic when the neighbour would fall outside coverage

### T4.1-B2 Reject duplicate table dates

Defect: a table with two rows for one date classifies by row order, which the digest does not capture.
- it should reject a policy definition whose table has two rows for one date

Implemented in `b3e55b5`. Case 2 passed on its first run (the T4.1 neighbour walk already classified the stepped day); mutation-checked and flagged in `tdd-log.md`. A stray green row marked exit 1 for case 2 was produced while the mutation was applied; the real green row follows it.

ocr review of `b3e55b5`: session `6249a934-c762-4398-adf0-478f2a85a883`, 1 file reviewed, **No findings.** Raw output: `ocr/T4.1-B1-b3e55b5.json`.

Implemented in `b1c7ad2`: `createSessionPolicy` throws on a duplicate table date, and the digest comparator sorts by date alone. The built-in policy's digest was checked unchanged before and after (`896a31a806f08168842e529a9366ca02850244df697cc362bd94cb731421ce42`).

ocr review of `b1c7ad2`: session `6a410aff-1239-462f-83a7-512379f74e13`, 2 files reviewed, **No findings.** Raw output: `ocr/T4.1-B2-b1c7ad2.json`.

### Cumulative run after T4.1

Run 2026-10-27 20:15 EDT on commit `b1c7ad2` (the only uncommitted files were evidence and this run's outputs), Node v26.12.0.

| Suite | Command | Result | Output |
|---|---|---|---|
| Unit | `npx vitest run src --reporter=verbose` | `Test Files 44 passed (44)`, `Tests 497 passed (497)`, exit 0 | `suite-runs/t4.1-session-policy-unit.txt` |
| Node integration | `npx vitest run tests/integration --reporter=verbose` | `Test Files 21 passed (21)`, `Tests 49 passed (49)`, exit 0 | `suite-runs/t4.1-session-policy-integration.txt` |
| Browser (Chromium) | `npm run test:e2e` | `124 passed (3.9m)`, exit 0 | `suite-runs/t4.1-session-policy-browser.txt` |
| Static and verification checks (11 commands) | `npm run typecheck`, `npx tsc6 --noEmit`, `npm run lint`, `npm run lint:deps`, `npm run build`, `npm run verify:release`, `npm run verify:capabilities`, `npm run verify:releases`, `npm run verify:no-fault-hooks`, `npm run verify:capacity`, `npm run verify:fixtures` | 11 of 11 exit 0 | `suite-runs/t4.1-session-policy-checks.txt` |

Failures: none.
