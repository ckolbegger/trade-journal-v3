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

### ocr review of `b09ba64` (T4.2)

Session `f78e3534-cc39-47ab-869c-ced091850a5f`, 5 files reviewed, 1 comment. Raw output: `ocr/T4.2-b09ba64.json`.

| Severity | Location | Claim | Assessment | Disposition |
|---|---|---|---|---|
| medium | `package.json:34` | `verify:session-policy` is opt-in; nothing in the build runs it, so a table or buffer change without a revision bump could still build (A39) | Wrong | Dismissed. The plan's exact verification for T4.2 is `npm run verify:session-policy`; `.claude/scripts/full-suite.sh` line 38 runs every `verify:*` script in `package.json`, so every cumulative run and the gate check it, the same way decision 18's capacity "build check" is `verify:capacity`. |

### Cumulative run after T4.2

Run 2026-10-27 21:06 EDT on commit `b09ba64` (uncommitted: evidence only), Node v26.12.0.

| Suite | Command | Result | Output |
|---|---|---|---|
| Unit | `npx vitest run src --reporter=verbose` | `Test Files 44 passed (44)`, `Tests 496 passed (496)`, exit 0 | `suite-runs/t4.2-session-policy-verification-unit.txt` |
| Node integration | `npx vitest run tests/integration --reporter=verbose` | `Test Files 21 passed (21)`, `Tests 49 passed (49)`, exit 0 | `suite-runs/t4.2-session-policy-verification-integration.txt` |
| Browser (Chromium) | `npm run test:e2e` | `124 passed (3.9m)`, exit 0 | `suite-runs/t4.2-session-policy-verification-browser.txt` |
| Static and verification checks (12 commands) | the 11 earlier commands plus `npm run verify:session-policy` | 12 of 12 exit 0 | `suite-runs/t4.2-session-policy-verification-checks.txt` |

Failures: none.

## T4.3 Persistence: schema v3

Implementation commit `1ef5e75`. Two cases passed on their first run (the v1→v2→v3 chain, built by T2.8's `migrationChain` and case 2; the `byInstrumentDate` rebuild, built by `rebuildPrivateState` and case 1); each is mutation-checked and flagged in `tdd-log.md`. Decisions recorded by the implementer: `exposureStart` is a private Trade field (derived; dropped by the transform, recomputed by the rebuild; D8's A149 schema-3 private list must include it with `activityDesc`); `meta.sessionPolicy` is stored nested as `{ key, policy }` to avoid the top-level `revision` stamp; persistence takes the policy identity as a `PersistenceDeps.sessionPolicy` parameter, wired from `src/app/compose.ts`, so T4.19's A39 rule must allow the composition root. **Expected failure until T4.28:** `verify:capacity` reports `FAIL basis measured at schema version 2, current is 3: run measure:capacity`, as D2's runs did between T2.8 and T2.18.

### ocr review of `1ef5e75`

Session `c6f27e1f-87d6-4ff7-aea0-d1922b0fbb8c`, 10 files reviewed, 1 comment. Raw output: `ocr/T4.3-1ef5e75.json`.

| Severity | Location | Claim | Assessment | Disposition |
|---|---|---|---|---|
| medium | `src/persistence/migrations/v2-to-v3.ts:10` | The transform drops `exposureStart` but copies the private `activityDesc`, so a direct v2 migration's transform output carries a private field (A139) | Doubtful (the rebuild recomputes `activityDesc`, so no stale value survives, but the transform output itself breaks A139, which D8's Restore reuses) | Bug task T4.3-B1 |

### T4.3-B1 The v2→v3 transform carries only authoritative fields

Defect: the transform's output includes the private `activityDesc`, contrary to A139 (transforms read and emit only authoritative fields; private fields come only from the rebuild).
- it should drop every private Trade field, activityDesc and exposureStart, in the v2 to v3 transform

Implemented in `8900f28`: `PRIVATE_TRADE_FIELDS` and `withoutPrivateFields` in `src/persistence/migrations/private-fields.ts`, used by both transforms. (`recomputePrivateTradeFields` in `rebuild.ts` still names the fields by literal.)

ocr review of `8900f28`: session `ea9dfd2a-c776-4155-a1cb-3287493fa895`, 3 files reviewed, **No findings.** Raw output: `ocr/T4.3-B1-8900f28.json`.

### Cumulative run after T4.3

Run 2026-10-27 21:20 EDT on commit `8900f28` (uncommitted: evidence only), Node v26.12.0.

| Suite | Command | Result | Output |
|---|---|---|---|
| Unit | `npx vitest run src --reporter=verbose` | `Test Files 45 passed (45)`, `Tests 502 passed (502)`, exit 0 | `suite-runs/t4.3-schema-v3-unit.txt` |
| Node integration | `npx vitest run tests/integration --reporter=verbose` | `Test Files 21 passed (21)`, `Tests 49 passed (49)`, exit 0 | `suite-runs/t4.3-schema-v3-integration.txt` |
| Browser (Chromium) | `npm run test:e2e` | `1 failed`, `123 passed (3.9m)`, exit 1 | `suite-runs/t4.3-schema-v3-browser.txt` |
| Static and verification checks (12 commands) | as after T4.2 | 10 of 12 exit 0 | `suite-runs/t4.3-schema-v3-checks.txt` |

Failures, all consequences of `SCHEMA_VERSION` becoming 3, none a T4.3 defect:
- `verify:capacity`: "basis measured at schema version 2, current is 3" — expected until T4.28.
- `verify:releases`: "FAIL d2: reports schema 3, expected 2", and `e2e/d2/migration.spec.ts:47` (B2.3, About shows schema 3, expected 2). Reproduced with `npm run verify:releases`. The release harness builds its `d2` folder from the current source (`tools/build-releases.ts`, D2 T2.17). The planned fix is T4.27 (build `d2` from the `claude-opus-5.5-d2` tag and add a current `d4`), which depends only on D2 T2.17, so it runs next, ahead of the graph order, to restore a green suite.

## T4.27 Previous-release harness

Change: `tools/build-releases.ts` generalises the tagged-release builder (`buildTaggedRelease(name)`, scratch `tj-release-<name>-<commit>` cached by commit, `git archive` only). `d1` is built from `D1_RELEASE_TAG` (`claude-opus-5.5-d1`), `d2` from `PREVIOUS_RELEASE_TAG` (now `claude-opus-5.5-d2`, commit `de3fa27`), and `d4` is the current source with build label d4. `tools/verify-releases.ts` checks d1 schema 1, d2 schema 2, d4 `SCHEMA_VERSION` (3), and distinct identities for v1, v2, d1, d2, d4.

e2e changes: none needed. Every `d2` use (`e2e/d2/migration.spec.ts` lines 63, 73, 138) is a d1 to d2 switch that now exercises the real D2 release; no case needed current code under that name. `test:e2e` left at `e2e/d1 e2e/d2`: git does not track an empty `e2e/d4`, and Playwright fails on a path filter matching no tests, so T4.33 extends it when it adds specs.

- `npm run build:releases && npm run verify:releases`: d1 reused from cache; d2 built in `tj-release-d2-de3fa276a263` (claude-opus-5.5-d2 at de3fa276a2632b568296040fd56efd2825708a39); `verify:releases OK: v1 f424ca68..., v2 d117d6aa..., v2-corrupt fails only on /assets/index-CWnWZl9c.css, d1 9c8b5b3d... schema 1, d2 01736544... schema 2, d4 eccbd63a... schema 3`.
- `npx playwright test e2e/d2/migration.spec.ts --project=chromium`: 4 passed (B2.3 included).
- `npx playwright test e2e/d1 e2e/d2 --project=chromium`: 124 passed.

ocr review of `ab37cd0`: session `d18245e8-5a35-4d41-b709-0b0c02f3e190`, 3 files reviewed, **No findings.** Raw output: `ocr/T4.27-ab37cd0.json`.

### Cumulative run after T4.27

Run 2026-10-27 21:30 EDT on commit `ab37cd0` (uncommitted: evidence only), Node v26.12.0.

| Suite | Command | Result | Output |
|---|---|---|---|
| Unit | `npx vitest run src --reporter=verbose` | `Test Files 45 passed (45)`, `Tests 502 passed (502)`, exit 0 | `suite-runs/t4.27-d2-release-build-unit.txt` |
| Node integration | `npx vitest run tests/integration --reporter=verbose` | `Test Files 21 passed (21)`, `Tests 49 passed (49)`, exit 0 | `suite-runs/t4.27-d2-release-build-integration.txt` |
| Browser (Chromium) | `npm run test:e2e` | `124 passed (3.8m)`, exit 0 | `suite-runs/t4.27-d2-release-build-browser.txt` |
| Static and verification checks (12 commands) | as after T4.2 | 11 of 12 exit 0 | `suite-runs/t4.27-d2-release-build-checks.txt` |

Failures: `verify:capacity` only, "FAIL basis measured at schema version 2, current is 3: run measure:capacity" — expected until T4.28. `verify:releases` and B2.3 pass again.
