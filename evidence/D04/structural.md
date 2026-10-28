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

## T4.2 first attempt (stopped) and plan revision 10

The first T4.2 subagent stopped before changing anything: it found no NYSE-published source for 2011 (holidays and the 2011-11-25 early close) and only NASD notices for 2000–2002's regular holidays. Its source notes are in `t4.2-first-attempt-source-notes.md`. Against the sources it did find, the T4.1 table was wrong on 2002-07-03 (not an early close) and missed 2002-07-05 and 2003-12-26 (1 pm closes), which confirms the T4.1 ocr finding. Those years are now outside coverage.

The user then directed that no calendar before 2024 is needed (journaling forward only, no backtesting), and approved plan revision 10 (decision 51): coverage 2024-01-01 through 2028-12-31, T4.1 restated (19 cases), T4.2 for 2024–2028, and the benchmark clock starting on 2024-01-02.

### T4.1-R Restate T4.1 under plan revision 10

Coverage is now 2024-01-01 through 2028-12-31, `table.ts` holds the 12 rows inside it, revision stays 1. Five restated cases plus the three first-run passes are in `tdd-log.md`. Built-in digest after the change: `9da1fb0f6289665be749b70295f7106f503148cabd425af5a42adf470fb68eb4` (before: `896a31a806f08168842e529a9366ca02850244df697cc362bd94cb731421ce42`).

### T4.1-R review and notes

Implemented in `d420ebc` (coverage 2024-01-01 to 2028-12-31, 12 table rows, revision 1, digest `9da1fb0f6289665be749b70295f7106f503148cabd425af5a42adf470fb68eb4`). Three restated cases passed on their first run (Sunday observance 2027, 2027-12-31, closure 2025-01-09); each is mutation-checked and flagged in `tdd-log.md`. Left as is and listed for the user: the Saturday-New-Year `saturdayObserved=false` flag in `rules.ts` has no observable effect, because holidays are looked up year-locally; and the Juneteenth `year >= 2022` condition is unreachable inside the new coverage.

ocr review of `d420ebc`: session `7485c288-a5c9-4d5f-b29e-23fa49cd20ef`, 2 files reviewed, **No findings.** Raw output: `ocr/T4.1-R-d420ebc.json`.

### Cumulative run after T4.1-R

Run 2026-10-27 20:55 EDT on commit `d420ebc` (uncommitted: evidence only), Node v26.12.0.

| Suite | Command | Result | Output |
|---|---|---|---|
| Unit | `npx vitest run src --reporter=verbose` | `Test Files 44 passed (44)`, `Tests 496 passed (496)`, exit 0 | `suite-runs/t4.1-r-restate-unit.txt` |
| Node integration | `npx vitest run tests/integration --reporter=verbose` | `Test Files 21 passed (21)`, `Tests 49 passed (49)`, exit 0 | `suite-runs/t4.1-r-restate-integration.txt` |
| Browser (Chromium) | `npm run test:e2e` | `124 passed (3.9m)`, exit 0 | `suite-runs/t4.1-r-restate-browser.txt` |
| Static and verification checks (11 commands) | `npm run typecheck`, `npx tsc6 --noEmit`, `npm run lint`, `npm run lint:deps`, `npm run build`, `npm run verify:release`, `npm run verify:capabilities`, `npm run verify:releases`, `npm run verify:no-fault-hooks`, `npm run verify:capacity`, `npm run verify:fixtures` | 11 of 11 exit 0 | `suite-runs/t4.1-r-restate-checks.txt` |

Failures: none.

## T4.2 Session-policy verification

Sources re-fetched on 2026-10-27 (WebFetch), each transcribed into `src/domain/session-policy/nyse-published.json` for 2024 through 2028: the ICE release of 2023-11-10 (2024, 2025, 2026), the ICE release of 2025-12-23 (2026, 2027, 2028), nyse.com Holidays and Trading Hours at `/markets/hours-calendars` (2025, 2026, 2027) and `/trade/hours-calendars` (2026, 2027, 2028), and the ICE release of 2024-12-30 (closing on 2025-01-09). No year lacked a source. The `/markets/hours-calendars` page has no list of historical closings; the one-off closing's source is the ICE release.

Table corrections: none to any date or kind; the 2025 and 2024 to 2028 rows agreed with the transcription and the rules needed no change. Every row's source was replaced: all rows cited a generic nyse.com page (the closure row mislabelled it "historical market closings"), and now cite the ICE release that states the date. Because the sources are part of the digest, the digest changed from `9da1fb0f...` to `13ff3ef725e71414e2f9bed388b5b59c81964d2ffbd77db2c9a75443b859998b`, recorded as revision 1's in `src/domain/session-policy/revision-digests.json` (revision stays 1: nothing has shipped).

`.claude/scripts/full-suite.sh` already runs every `verify:*` script in `package.json`, so adding `verify:session-policy` there needed no edit to the script.

Verification run (`$ npm run verify:session-policy`):

```
--- run 1: npm run verify:session-policy
verify:session-policy OK: 5 years (2024-01-01 to 2028-12-31), 1827 dates compared, nyse revision 1 digest 13ff3ef725e71414e2f9bed388b5b59c81964d2ffbd77db2c9a75443b859998b
exit 0
--- row 2026-11-27 removed from table.ts
verify:session-policy: 2026-11-27: published early close at 13:00, policy has no early close
verify:session-policy: digest of nyse revision 1 is 16d2c42f...8101, recorded 13ff3ef7...998b: bump the revision and record the new digest
exit 1
--- recorded digest changed (13ff3ef7 -> 00000000), revision unchanged
verify:session-policy: digest of nyse revision 1 is 13ff3ef7...998b, recorded 0000000025e7...998b: bump the revision and record the new digest
exit 1
--- both restored
verify:session-policy OK: ... exit 0
```

`npx vitest run src/domain/session-policy`: 22 passed (22), T4.1's cases unchanged.
