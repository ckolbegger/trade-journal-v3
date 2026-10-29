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

## T4.4 Market Data: Manual Mark save

Implemented in `b8f490d` (behavioral; cases in `tdd-log.md`). Decision: the case "reject a zero, negative, non-finite, or over-precise price with InvalidPrice" predates D7 P27's amendment of A37, which T4.4's case list did not pick up; the implementation follows A37 (0 accepted, negative gives `PriceNegative`, non-finite or over-precise gives `InvalidPrice`). Facade wiring (`guard.run('MarketData.save', ...)`, `FACADE_GROUPS`, capability manifest) is not part of T4.4; the write-gate case covers the persistence boundary, and I4.9 exercises the facade boundary once the facade exposes Market Data.

ocr review of `b8f490d`: session `d52d54af-8f40-41ac-82ed-35fbb12a6042`, 3 files reviewed, 3 comments. Raw output: `ocr/T4.4-b8f490d.json`.

| Severity | Location | Claim | Assessment | Disposition |
|---|---|---|---|---|
| medium | `src/modules/market-data/market-data.ts:118` | A well-shaped impossible date (`2026-02-30`) reaches `classify`, which throws, so `save` rejects instead of returning `InvalidDate` | Valid (`policy.ts:23` calls `Temporal.PlainDate.from`) | Bug task T4.4-B1 |
| medium | `src/modules/market-data/market-data.ts:124` | `clock.now() < day.completion` compares ISO strings; a fractional-second instant (`…:00.500Z`) sorts before `…:00Z` | Valid (`systemClock` emits fractional seconds) | Bug task T4.4-B2 |
| medium | `src/modules/market-data/market-data.ts:193` | Commit-time check on the global `marketDataRevision` makes a save to one key return `Conflict` when another key was saved concurrently | Valid (A38 makes the per-key `resolutionRevision` the binding) | Bug task T4.4-B3 |

### T4.4-B1 Impossible calendar dates are rejected, not thrown
- it should reject a well-shaped impossible date such as 2026-02-30 with InvalidDate and write nothing

### T4.4-B2 Session completion compares instants, not strings
- it should accept a Mark for Tuesday at 16:30:00.500 on Tuesday, a fractional-second instant after the completion

### T4.4-B3 Only the key's own binding produces Conflict
- it should save both of two simultaneous initial Marks for different keys, incrementing marketDataRevision once for each

ocr review of `48e1420` (T4.4-B1, `isRealDate` round-trip before `classify`): session `29155dc4-e3b5-47e7-97f6-0e18812b0acc`, 1 file reviewed, **No findings.** Raw output: `ocr/T4.4-B1-48e1420.json`.

ocr review of `0b3dc81` (T4.4-B2, `Temporal.Instant.compare` for completion): session `11be427c-527e-4907-b058-53b78c4586f9`, 1 file reviewed, **No findings.** Raw output: `ocr/T4.4-B2-0b3dc81.json`.

T4.4-B3 first attempt stopped without changes: `Persistence.commit` had no in-transaction read-modify-write for a module's `meta` field, so dropping the global check would let concurrent saves both write N+1. Decision (main session): add a minimal `increment` write to persistence, patterned on the content-revision increment, rather than derive the counter or rely on check-then-write ordering. Implemented in `28fd3e1`: `Write` gains `{ op: 'increment', store: 'meta', key, field }`; Market Data uses it and no longer checks `marketDataRevision`.

ocr review of `28fd3e1`: session `28a318e8-5b98-409e-a7ff-98f4c0711656`, 2 files reviewed, 1 comment. Raw output: `ocr/T4.4-B3-28fd3e1.json`.

| Severity | Location | Claim | Assessment | Disposition |
|---|---|---|---|---|
| medium | `src/persistence/persistence.ts:378` | The increment's `await store.get` sits inside the write loop, outside the `try/catch` around `tx.done`; if an earlier `add` aborts the transaction with a `ConstraintError`, the `get` rejects with `AbortError` and `commit` throws instead of returning `ConstraintViolation` | Valid (narrow: needs a failing `add` before an `increment` in one write set) | Bug task T4.4-B4 |

### T4.4-B4 A constraint failure before an increment still returns ConstraintViolation
- it should return ConstraintViolation, not throw, when a write set's add violates a constraint before its increment

ocr review of `e506ec8` (T4.4-B4): session `baf60063-b84c-419a-9f82-d5462fc56138`, 1 file reviewed, 2 comments. Raw output: `ocr/T4.4-B4-e506ec8.json`.

| Severity | Location | Claim | Assessment | Disposition |
|---|---|---|---|---|
| medium | `src/persistence/persistence.ts:379-381` | The chained increment queues its `put` only in a `.then`, after later requests; two increments of one record both write N+1, and a later put or delete of that record can be overwritten | Valid (latent: no current write set touches one record twice) | Bug task T4.4-B5 |
| medium | `src/persistence/persistence.ts:379-381` | A missing or malformed increment target throws inside `.then`; `request.catch` swallows non-constraint errors, so `commit` returns `Committed` without the increment | Valid (silent-failure regression from B4) | Bug task T4.4-B5 |

Both findings come from the same chained-increment design, so one bug task covers them. This is the third round of bug tasks on T4.4 (B1–B3, then B4, then B5); if B5's review still leaves findings, the session stops for the user (handoff, stop condition 5).

### T4.4-B5 Increments apply in write-set order and fail loudly
- it should apply a write set's writes in order when it increments one meta field twice and when a later put replaces the incremented record
- it should not report Committed when an increment's target record or field is missing, and should write nothing

ocr review of `a6ec5d9` (T4.4-B5): session `1eb69f3e-581d-4943-936a-995c712d818d`, 1 file reviewed, 1 comment. Raw output: `ocr/T4.4-B5-a6ec5d9.json`.

| Severity | Location | Claim | Assessment | Disposition |
|---|---|---|---|---|
| medium | `src/persistence/persistence.ts:390` | A put or add followed by an increment of the same record loses the revision stamp: the increment resolves unstamped from the in-memory view and its put overwrites the stamped value, while `Committed.revisions` still reports the new revision | Valid (latent: no current write set puts and increments one record) | **Stopped for the user**: third round of bug tasks on T4.4 still leaves a finding (handoff, stop condition 5) |

### T4.4-B6 Optimistic retry on the shared counter (user's direction, 2026-10-27)

The user directed a traditional optimistic-concurrency fix in place of the in-transaction `increment` write: Market Data keeps both binding checks (the key's `resolutionRevision` and `meta.marketDataRevision`) and writes `marketDataRevision` as N+1; `commit` already names the failed binding. When only the shared-counter check fails, Market Data re-reads, re-validates, and commits again, up to 3 attempts in all (as A46's read retry); when the key's own binding fails it returns `Conflict`. The persistence `increment` write from B3–B5 is reverted, which also removes the B5 finding (revision stamp lost on put-then-increment).
- it should save both of two simultaneous initial Marks for different keys, incrementing marketDataRevision once for each (B3's case, kept)
- it should return Conflict without retrying when the key's own resolution revision moved
- it should stop after 3 attempts when the shared counter keeps moving, and write nothing

ocr review of `03b323b` (T4.4-B6): session `b4d8d96a-7e3e-47f8-9b97-a954cab0252e`, 2 files reviewed, **No findings.** Raw output: `ocr/T4.4-B6-03b323b.json`. B6 reverted `src/persistence/persistence.ts` and its tests to `b8f490d`, so B3–B5's persistence changes and the B5 finding no longer exist. Flagged first-run pass: "should return Conflict without retrying when the own resolution revision of the key moved" (the re-read's stale-revision check returns before a second commit; mutation-checked on the commit count).

The user then directed (2026-10-27) that the pattern become [ADR 0011](../../specs/adr/0011-optimistic-bindings-and-shared-counter-retry.md), plan revision 11 (decision 52), and that the two D1/D2 writes it exposes be fixed as bug tasks here. A review of every `commit` call in `src/` found: Trade Record's `factRevision` and Trade Workflows' Catalog references already bind their subjects; Catalog create binds `catalogRevision` as a subject (label distinctness is judged against the whole Catalog) and stays as it is; the two seeds below commit with no checks.

### T4.4-B7 Catalog seedDefaults binds its counter and retries (ADR 0011)
`src/modules/reference-catalog/catalog.ts` `seedDefaults` commits with `checks: []` and writes `catalogRevision` as a value read before the transaction plus one; two concurrent seeds lose an advance and can both add the default records under fresh ids.
- it should seed the defaults exactly once and advance catalogRevision once when two seeds run at once
- it should return its typed conflict and write nothing after 3 attempts when catalogRevision keeps moving

### T4.4-B8 Journal seedDefaults binds its counter and retries (ADR 0011)
`src/modules/journal/journal.ts` `seedDefaults` has the same shape with `journalRevision`.
- it should seed the default Journal types and definitions exactly once and advance journalRevision once when two seeds run at once
- it should return its typed conflict and write nothing after 3 attempts when journalRevision keeps moving

### Cumulative run after T4.4-B6

Run 2026-10-27 23:20 EDT on commit `03b323b`. Unit 46 files, 522 tests passed; integration 21 files, 49 passed; browser 124 passed (3.9m); checks 11 of 12 exit 0. Only `verify:capacity` failed ("basis measured at schema version 2, current is 3"), expected until T4.28. Outputs: `suite-runs/t4.4-b6-{unit,integration,browser,checks}.txt`. Earlier T4.4 runs (`t4.4-manual-mark-*` at `28fd3e1`, `t4.4-b4-*` at `e506ec8`, `t4.4-b5-*` at `a6ec5d9`) had the same single expected failure.

ocr review of `633fdc1` (T4.4-B7): session `164e749a-9547-40c1-970f-c9a9268df004`, 1 file reviewed, 2 comments. Raw output: `ocr/T4.4-B7-633fdc1.json`.

| Severity | Location | Claim | Assessment | Disposition |
|---|---|---|---|---|
| medium | `src/modules/reference-catalog/catalog.ts:32` | Workspace `initialize` (`workspace.ts:239-249`) turns any non-`Seeded` seed result into empty additions and returns `Opened`, so the new `Conflict` and `RuntimeNotWritable` outcomes are swallowed | Split. **`RuntimeNotWritable`: Valid**: Workspace's `WorkspaceInitializationResult` has a `RuntimeNotWritable` branch (`specs/design/workspace.md` line 41), and returning `Opened` after a refused write misreports. **`Conflict`: Doubtful**: exhaustion means other writers kept advancing the counter, and this call truthfully added nothing; the spec defines no other initialization result for it, and the next start seeds whatever is still missing. Its receipt should still not hide it. | Bug task T4.4-B9 |
| medium | `src/modules/reference-catalog/catalog.ts:33` | `SeedCatalogResult`'s `RuntimeNotWritable` variant is a bare `{ kind }`, dropping the shared `RuntimeNotWritable` type's recovery details | Valid (the file already imports the shared type; B8 used it for Journal) | Folded into T4.4-B9 (type only) |

### T4.4-B9 Workspace initialization reports refused seeds
- it should return RuntimeNotWritable from initialize, not Opened, when an existing Workspace's Catalog or Journal seed returns RuntimeNotWritable
- it should return Opened with no additions for a seed that returns Conflict, and its receipt should name the seed that did not complete
- `SeedCatalogResult` uses the shared `RuntimeNotWritable` type (no case; typecheck)

ocr review of `0d6ce0c` (T4.4-B8): session `4056da4a-9fa2-449f-8ac0-a855b276dec3`, 1 file reviewed, 1 comment. Raw output: `ocr/T4.4-B8-0d6ce0c.json`. The one comment is the same Workspace-initialization finding as B7's first (Journal's results swallowed at `workspace.ts:240`); it is covered by T4.4-B9. B8's own change drew no other findings.

ocr review of `6c2fed7` (T4.4-B9): session `22a3401f-9d4e-4712-abe4-d1e713b6fcc4`, 2 files reviewed, **No findings.** Raw output: `ocr/T4.4-B9-6c2fed7.json`. B9 adds `completed?: false` to a seed receipt entry; it also marks a manifest `SeedConflict` incomplete (subagent's choice, accepted).

### Cumulative runs after T4.4-B7 to B9

- `0d6ce0c` (B7, B8), 23:26 EDT: unit 526, integration 49, browser 124 passed; checks 11 of 12 (only `verify:capacity`, expected). `suite-runs/t4.4-b8-*`.
- `6c2fed7` (B9), 23:32 EDT: unit 528, integration 49 passed; browser 1 failed, 123 passed; checks 11 of 12 (only `verify:capacity`, expected). `suite-runs/t4.4-b9-*`. The browser failure was `e2e/d2/narrow.spec.ts:69` ("keep the Open Trade Detail within 375 and 320 px"), a 30 s test timeout; rerun alone, `npx playwright test e2e/d2/narrow.spec.ts --project=chromium` gave 5 passed (8.9s). Recorded as a load-related timeout, not a B9 regression; the next cumulative run confirms.

### T4.4-B10 Mark saves bind only their key (plan revision 12, decision 53)

The user directed (2026-10-27) removing `meta.marketDataRevision`: nothing reads it, it made unrelated Mark saves contend, and it doubled the records each save writes. Code changes: the v2→v3 migration and fresh Workspace stop creating it; `MarketData.save` binds only the key's `resolutionRevision`, with no retry (B6's loop and its two retry cases go).
- it should create a fresh Workspace at schema version 3 with the observations store, its byInstrumentDate index, and meta sessionPolicy, and no marketDataRevision (restated T4.3 case)
- it should commit in one semantic commit that increments the Workspace content revision exactly once and writes only the key's observation record (restated T4.4 case)
- it should save both of two simultaneous initial Marks for different keys (B3's case, restated without the counter)

ocr review of `167433d` (T4.4-B10): session `9e762d4f-38f5-4f68-855f-ceb1a267822c`, 3 files reviewed, **No findings.** Raw output: `ocr/T4.4-B10-167433d.json`. Flagged: B3's restated case first-run passed (mutation-checked); the T4.4 restated commit case's logged red came from a stricter first assertion, and the final assertion (every `meta` record except `content` unchanged) was not re-proven red.

### Cumulative run after T4.4-B10

Run 2026-10-27 23:41 EDT on commit `167433d`. Unit 46 files, 526 passed; integration 21 files, 49 passed; browser 124 passed (3.9m), so B9's narrow-spec timeout did not recur; checks 11 of 12, only `verify:capacity` (expected until T4.28). Outputs: `suite-runs/t4.4-b10-*`. T4.4 is complete.

## T4.5 Market Data: acknowledgments and precedence

First attempt `bb63137` wrote production code ahead of red for most cases and manufactured reds by neutralising lines; reverted in `024b7bd` and redone strictly test-first in `46436bb` (cases and flagged first-run passes 3, 6, 7 in `tdd-log.md`; two extra cases with genuine reds: acknowledgment saves honour `Conflict` and `RuntimeNotWritable`, and validate the key). The user asked what withdrawing serves and confirmed keeping it (`market-data.md` line 61: retracting a mistaken "can't get a price" returns the key to Missing without inventing a price). Choices: assert and withdraw return `Saved` with the effective resolution; re-asserting appends another Asserted version; an over-long withdraw reason gives `ReasonTooLong`; persistence `ReadTransaction` gains `findLastFromIndex`.

ocr review of `46436bb`: session `195120bb-72b5-4855-ad94-f8b180812e24`, 4 files reviewed, 1 comment. Raw output: `ocr/T4.5-46436bb.json`.

| Severity | Location | Claim | Assessment | Disposition |
|---|---|---|---|---|
| medium | `src/modules/market-data/market-data.ts:137` | The Stale-context reverse cursor's range is only an upper bound on `[instrumentKey, tradingDate]`, so with no earlier Mark for the Instrument it walks every lexicographically earlier Instrument's history | Valid (correct results, unbounded scan; A47 intends one bounded lookup) | Bug task T4.5-B1 |

### T4.5-B1 Stale context reads only the Instrument's own history
- it should look up Stale context within the Instrument's own byInstrumentDate range, visiting no other Instrument's records, when the Instrument has no earlier Mark

ocr review of `0e3d0de` (T4.5-B1): session `cb66078e-76b0-4dd1-8fad-d58b2c80c138`, 1 file reviewed, **No findings.** Raw output: `ocr/T4.5-B1-0e3d0de.json`. Its log has one failed "green" row (an edit that did not apply) before the real green.

### Cumulative runs after T4.5

- `46436bb` (T4.5), 2026-10-27 23:53 EDT: unit 535, integration 49, browser 124 passed; checks 11 of 12. `suite-runs/t4.5-acknowledgments-*`.
- `0e3d0de` (T4.5-B1), 23:58 EDT: unit 536, integration 49, browser 124 passed; checks 11 of 12. `suite-runs/t4.5-b1-*`.

Only `verify:capacity` failed in each (expected until T4.28). T4.5 is complete.

## T4.6 Market Data: ResolveFrames and ExpectedSnapshot

Implemented in `1bd50e1` (14 cases; flagged first-run passes 4, 5, 11, each mutation-checked). The spec names no request or result types beyond `ResolveFrames`, `ExpectedSnapshot`, `SnapshotUnchanged`, `SnapshotChanged`; the subagent's shapes (`FrameContext`, `MarkFrame`, `MarketDataQueryResult`, `snapshotId` `mds1:<policyRevision>:<digest>`) stand until T4.19's facade. Persistence `ReadTransaction` gains `getAllInRange`.

ocr review of `1bd50e1`: session `1bc7ea08-7d13-4a99-833b-f0958d498df5`, 3 files reviewed, 3 comments. Raw output: `ocr/T4.6-1bd50e1.json`.

| Severity | Location | Claim | Assessment | Disposition |
|---|---|---|---|---|
| medium | `src/modules/market-data/market-data.ts:322` | `nextSession` depends on the clock but is not in the digest, so `ExpectedSnapshot` returns `SnapshotUnchanged` after the next session completes although fresh frames would carry it | Valid. Decision: A45's canonical request includes the as-of instant; the digest takes its material effect, each frame's completed next session (or none), rather than the raw instant, so a Review re-checked later is unchanged until a next session completes. Within A45, no revision. | Bug task T4.6-B1 |
| medium | `src/modules/market-data/market-data.ts:283` | A malformed `asOf` reaches `Temporal.Instant.from` and throws instead of returning `Rejected` | Valid | Bug task T4.6-B2 |
| medium | `src/modules/market-data/market-data.ts:308` | The digest serializes the caller's `context` in its own property order, so equal requests can digest differently | Valid (low impact) | Bug task T4.6-B3 |

### T4.6-B1 The digest covers each frame's completed next session
- it should return SnapshotChanged for a Review context once that date's next session completes, and SnapshotUnchanged while it has not

### T4.6-B2 A malformed as-of instant is rejected
- it should reject a Current context whose asOf is not an ISO instant with an asOf issue, and write nothing

### T4.6-B3 The digest is independent of the request's property order
- it should return equal snapshot ids and digests for contexts with the same fields in a different order

ocr reviews of the T4.6 bug tasks:
- `1abdf25` (B1): session `627956b7-c547-487f-a3d7-bf9e5277dec2`, 1 file, **No findings.** `ocr/T4.6-B1-1abdf25.json`.
- `8c61109` (B2, new issue code `InvalidInstant` on field `asOf`): session `5165afcf-1d28-42d0-94aa-5a1b640d86ac`, 1 file, **No findings** (the reviewing agent returned no report; the raw output was read directly: status complete, 0 comments). `ocr/T4.6-B2-8c61109.json`.
- `3d5607b` (B3): session `9b1113c4-98df-4775-807e-0ef39c2484a9`, 1 file, 1 comment. `ocr/T4.6-B3-3d5607b.json`.

| Severity | Location | Claim | Assessment | Disposition |
|---|---|---|---|---|
| low | `src/modules/market-data/market-data.ts:325-328` | The nested ternary building `canonicalContext` should be a switch on `context.kind` | Doubtful (correct as written; readability only; the same style finding was fixed in T4.1-B2) | Bug task T4.6-B4 (structural) |

### T4.6-B4 canonicalContext as a switch (structural)
Verification: `npx vitest run src/modules/market-data` passes unchanged before and after; typecheck, tsc6, lint, lint:deps exit 0.

ocr review of `0715b2a` (T4.6-B4): session `2e88e036-a67b-4b15-9b11-a5d1ccd23bd0`, 1 file, **No findings.** `ocr/T4.6-B4-0715b2a.json`. B4 verification: `npx vitest run src/modules/market-data` 45 passed before and after.

### Cumulative runs after T4.6

- `1bd50e1` (T4.6), 2026-10-28 00:09 EDT: unit 550, integration 49, browser 124 passed; checks 11 of 12. `suite-runs/t4.6-frames-*`.
- `3d5607b` (B1–B3), 00:17 EDT: unit 553, integration 49, browser 124; checks 11 of 12. `suite-runs/t4.6-b3-*`.
- `0715b2a` (B4), 00:22 EDT: unit 553, integration 49, browser 124; checks 11 of 12. `suite-runs/t4.6-b4-*`.

Only `verify:capacity` failed in each (expected until T4.28). T4.6 is complete.

## T4.7 Market Data: recover without a provider

Implemented in `b16e1e4` (6 cases). Flagged: first-run passes 4 (relevance start) and 6 (one gap request per Instrument), each mutation-checked; **code ahead of red for case 3** (case 2's green already split acknowledged from missing sessions; the subagent loosened it to get case 3's red), reported to the user and kept, unlike T4.5, because it touched one case. Result shapes are the subagent's (`RecoverRequest`, `RecoverResult` `Recovered`, `HistoricalGaps`, `RecoverDiagnostic`), open to T4.19.

ocr review of `b16e1e4`: session `df72fde1-1944-47ea-8402-776944149495`, 2 files reviewed, 4 comments. Raw output: `ocr/T4.7-b16e1e4.json`.

| Severity | Location | Claim | Assessment | Disposition |
|---|---|---|---|---|
| medium | `src/modules/market-data/market-data.ts:349` | A coverage failure from `sessionsBetween` becomes empty history, so recovery reports no gaps instead of saying why; the enumeration starts a day before the exposure date, so an exposure on the first covered date also trips it | Valid. Decision: per P8 (diagnostic, never a guess) without breaking the Review for a Trade whose exposure predates coverage, `recover` enumerates only covered sessions and adds a per-Instrument `SessionPolicyCoverage` diagnostic when relevance starts before coverage; the off-by-one is removed | Bug task T4.7-B1 |
| medium | `src/modules/market-data/market-data.ts:345` | A malformed `earliestExposure` throws instead of returning `Rejected` | Valid | Bug task T4.7-B2 |
| medium | `src/modules/market-data/market-data.ts:496` | Frames (via `query`) and historical gaps are read in separate transactions, so the result can mix two states | Doubtful (needs a concurrent historical save; A47 asks for one bounded read set) | Bug task T4.7-B3 |
| low | `src/modules/market-data/market-data.ts:342` | Duplicate Instrument keys in the request give duplicate gap records and reads, unlike `query` | Valid (minor) | Bug task T4.7-B4 |

### T4.7-B1 recover reports coverage instead of silently empty gaps
- it should list gaps from the first covered session and add a SessionPolicyCoverage diagnostic for an Instrument whose relevance starts before coverage
- it should list gaps normally, with no diagnostic, for an exposure on the first covered session

### T4.7-B2 A malformed exposure instant is rejected
- it should reject a recover request whose earliestExposure is not an ISO instant with an InvalidInstant issue

### T4.7-B3 recover reads frames and gaps in one transaction
- it should build the frames and the historical gaps from one read transaction, so a Mark saved during recover cannot appear in one and not the other

### T4.7-B4 recover deduplicates Instruments
- it should return one gap record and issue one gap read per Instrument when the request repeats an Instrument

ocr reviews of the T4.7 bug tasks, each **No findings**: `d4efb8d` (B1, session `819f49ff-2293-45b7-adb8-ad5cbfa8ce44`), `0a62b63` (B2, `00ff0908-b6a8-4ee7-961b-8ba06062fad6`; `MarketDataIssue` gains optional `instrumentKey`, field `earliestExposure`), `f0948d7` (B3, `5c00584e-8499-42ba-aa4a-3dc2fcda5f15`; frame builder extracted into `resolveDay`, `frameEvidence`, `frameResult`), `62d31fa` (B4, `21a84e76-a346-421b-8bd9-5015b892296f`). Raw outputs `ocr/T4.7-B<n>-<sha>.json`.

### Cumulative runs after T4.7

- `b16e1e4` (T4.7), 2026-10-28 00:30 EDT: unit 559, integration 49, browser 124; checks 11 of 12. `suite-runs/t4.7-recover-*`.
- `62d31fa` (B1–B4), 00:41 EDT: unit 564, integration 49, browser 124; checks 11 of 12. `suite-runs/t4.7-b4-*`.

Only `verify:capacity` failed (expected until T4.28). T4.7 is complete, and with it the Market Data group (T4.4–T4.7).

## T4.8 Trade Analysis: derive at a cutoff

Implemented in `a1a138c` (3 cases, no first-run passes). `TradeDerivationInput` gains optional `cutoff` and `valuationDate`; `DerivedTradeState` gains `exposureStart` and `observationRequirements`. Notes for later tasks: expected lifecycle is derived from cutoff-filtered facts, so an early cutoff can disagree with stored lifecycle (T4.9/T4.11 decide whether that is a finding); requirements are per Instrument by symbol (revisit with options, D7); `rebuild.ts` could call `derive` for `exposureStart` (T4.11).

ocr review of `a1a138c`: session `b2064e1f-6307-400d-bc88-20c6b0efdccb`, 2 files, **No findings.** `ocr/T4.8-a1a138c.json`.

Cumulative run 2026-10-28 00:47 EDT on `a1a138c`: unit 567, integration 49, browser 124 passed; checks 11 of 12 (only `verify:capacity`, expected). `suite-runs/t4.8-cutoff-*`. T4.8 is complete.

## T4.9 Trade Analysis: valuation and availability

Implemented in `ee4bb7b` (13 cases). Flagged: case 13 first-run pass (mutation-checked); process slip on the covered-subtotal case (production line written before its red, reverted, red run, restored). `evaluate` takes one `ObservationFrame` (Instrument object, date, close instant, resolution) and handles one Instrument; covered subtotal is `null` until D10.

ocr review of `ee4bb7b`: session `60abb6b3-4137-45ae-bda0-495eaeb1d972`, 3 files reviewed, 4 comments. Raw output: `ocr/T4.9-ee4bb7b.json`.

| Severity | Location | Claim | Assessment | Disposition |
|---|---|---|---|---|
| medium | `src/domain/trade-analysis/evaluate.ts:110` | The frame's Instrument is never compared with the Position's, so an ABC frame values XYZ Lots | Valid (latent with single-Instrument callers) | Bug task T4.9-B1 |
| medium | `src/domain/trade-analysis/evaluate.ts:156-158` | Ongoing Risk to Stop and Incremental Reward are not floored at 0 past the Stop or Target | Valid, and exactly T4.10's planned cases ("Stop crossed": Ongoing Risk $0.00 with Overrun; "Target reached": Incremental Reward $0.00 with Overrun) | Folded into T4.10, which builds it test-first; no separate bug task |
| medium | `src/domain/trade-analysis/evaluate.ts:160` | With a Missing frame carrying Stale context, at-entry Lots are chosen by the Missing frame's close rather than the Stale Mark's close, so Friday Mark plus Monday fills gives `atEntry: null` | Doubtful (A54's coordinator passes D's frame, which the test does; but evaluating the current Missing frame directly should still give at-entry relative to D) | Bug task T4.9-B2 |
| low | `src/domain/trade-analysis/evaluate.ts:135` | Nested ternary in `marked` | Doubtful (readability only) | Bug task T4.9-B3 (structural) |

### T4.9-B1 evaluate values only the frame's own Instrument
- it should return the Mark-dependent figures as Unavailable(MarkMissing) naming the Position's Instrument when the frame is for a different Instrument

ocr review of `4ce7faf` (B1): session `e9fb4e9d-20ff-45e2-9437-ac63193a18cb`, 1 file, 1 comment. `ocr/T4.9-B1-4ce7faf.json`.

| Severity | Location | Claim | Assessment | Disposition |
|---|---|---|---|---|
| low | `src/domain/trade-analysis/evaluate.ts:131-133` | The reason chain `foreign ? … : openedAfterClose ? … : …` is a nested ternary | Valid (readability only) | Folded into T4.9-B3 |

B1's subagent also noted that `coverage` still reports the foreign Mark as `Available` with its revision, so the evaluation claims coverage that does not apply to the Position: bug task T4.9-B4, run before the structural B3 so the refactor covers the final code.

### T4.9-B2 At-entry figures are relative to the latest exact Mark's close
- it should return at-entry figures for Lots opened after the Stale context's close when the frame is Missing (Friday Mark, Monday fills: all 100 shares, risk from entry $268.00, reward from entry $582.00)
- it should return at-entry figures for every remaining Lot when the frame is Missing without Stale context

### T4.9-B4 Coverage of a frame for another Instrument
- it should report coverage as Missing, with no Stale context, when the frame is for a different Instrument

ocr review of `4c35056` (B2): session `b7efbd63-0909-49ef-9470-2812336a66f2`, 1 file, **No findings.** `ocr/T4.9-B2-4c35056.json`. B2 notes: case 2 was a first-run pass (built by case 1's latest-exact-close rule), mutation-checked and flagged; the existing Stale-disclosure case now excludes `atEntry` from its full-equality comparison, since at-entry depends on the Stale close (not its price).

ocr review of `277c969` (B4): session `749e113b-d142-4ac5-a111-5bda393a156c`, 1 file, 1 comment. `ocr/T4.9-B4-277c969.json`.

| Severity | Location | Claim | Assessment | Disposition |
|---|---|---|---|---|
| low | `src/domain/trade-analysis/evaluate.ts:154-158` | The coverage expression is a nested ternary | Valid (readability only) | Folded into T4.9-B3 |

B4's subagent noted that at-entry Lot selection still reads a foreign frame's close or its Stale close: bug task T4.9-B5, before B3.

### T4.9-B5 At-entry figures for a frame for another Instrument
- it should return at-entry figures for every remaining Lot when the frame is for a different Instrument

ocr review of `48067ca` (B5): session `65cd7d94-a44e-47bd-914a-2067e1849bdc`, 1 file, 1 comment. `ocr/T4.9-B5-48067ca.json`.

| Severity | Location | Claim | Assessment | Disposition |
|---|---|---|---|---|
| low | `src/domain/trade-analysis/evaluate.ts:134-135` | `latestExactClose` is a nested ternary; move the `foreign` check into the at-entry selection | Valid (readability only) | Folded into T4.9-B3 |

Decision: for a foreign frame `valuationDate` and the MarkMissing detail date stay the frame's trading date, the date that was asked for.

### T4.9-B3 marked, the unavailability reason, coverage and the latest exact close as explicit guards (structural)
Verification: `npx vitest run src/domain/trade-analysis` passes unchanged before and after; typecheck, tsc6, lint, lint:deps exit 0.

ocr review of `9d7f6d5` (B3): session `7095015b-5566-45fb-9c9e-b4c23e6bc01f`, 1 file, **No findings.** `ocr/T4.9-B3-9d7f6d5.json`. Behaviour preservation rests on `src/domain/trade-analysis` passing 71 of 71 before and after.

### Cumulative runs after T4.9

- `ee4bb7b` (T4.9): unit 580, integration 49, browser 124; checks 11 of 12. `suite-runs/t4.9-valuation-*`.
- `9d7f6d5` (B1–B5), 2026-10-28 01:14 EDT: unit 585, integration 49, browser 124; checks 11 of 12. `suite-runs/t4.9-b3-full-*`.

Only `verify:capacity` failed (expected until T4.28). T4.9 is complete.

## T4.10 Trade Analysis: risk and reward

Implemented in `bab35b1` (10 cases). Flagged first-run passes, each mutation-checked: case 2 (Unbounded when Missing, built by case 1), case 4 (exactly 47.50 Breached, built by case 3's `<= 0`), case 7 (reached Target not a Deviation, built by case 5), case 8 (per-condition fields; its only failure was a fixture error, `47.5` not `47.50`), case 9 (conditions Unavailable with the Mark's reason, via the shared `marked`). Flooring at $0.00 came from the reds of cases 3 and 6.

Decisions: `CalculationResult` gains `Unbounded{direction, explanation}`, which forced one branch ("Unbounded above") in `src/ui/screens/TradeDetail.tsx`; Plan R figures are the floored dollars over 1R; condition ids are role plus 1-based position (`stop-1`, `target-1`) since the basis carries no identity; Overrun is read from the crossed condition, with no headline field; `deviations` is always `[]` (A44); headline figures still use the single original Stop and Target (D17), long Stock only. Notes for T4.14 (store `observation` as the binding; `deviations` empty until D12) and T4.18 (render Unbounded; Overrun from `conditions`).

ocr review of `bab35b1`: session `7db81f8e-36da-4673-b14f-7375d28fc37d`, 4 files, 2 comments. `ocr/T4.10-bab35b1.json`.

| Severity | Location | Claim | Assessment | Disposition |
|---|---|---|---|---|
| medium | `src/domain/trade-analysis/evaluate.ts:251` | `observation.mark` names the frame's Mark whenever it is Available, even when no figure was computed from it (another Instrument, a Lot opened after the close, no remaining Position) | Valid | Bug task T4.10-B1 |
| low | `src/domain/trade-analysis/evaluate.ts:219` | Nested ternary for condition `status` | Doubtful (readability only) | Bug task T4.10-B2 (structural) |

### T4.10-B1 The observation binding names only a Mark that was used
- it should bind no Mark when the frame is for a different Instrument
- it should bind no Mark when a Lot opened after the frame's close
- it should bind no Mark when no Position remains

### T4.10-B2 Condition status as explicit guards (structural)
Verification: `npx vitest run src/domain/trade-analysis` passes unchanged before and after; typecheck, tsc6, lint, lint:deps exit 0.

ocr reviews of the T4.10 bug tasks, each **No findings**: `22da598` (B1, session `0ced3b93-fbd7-4984-9395-8bad48396909`; one `usableMark` drives `marked` and `observation.mark`; cases 2 and 3 were written with case 1 before its fix, so they had no red run of their own: process slip, both mutation-checked and flagged), `97ef04a` (B2, `734f6c34-89c1-4841-b2c7-df4cd28d8134`; `statusOf` helper). Raw outputs `ocr/T4.10-B<n>-<sha>.json`. Noted: `prettier --check` flags `evaluate.ts` (already so before B2; lint does not enforce prettier).

### Cumulative run after T4.10

- `97ef04a` (B1–B2), 2026-10-28 01:27 EDT: unit 598, integration 49, browser 124; checks 11 of 12. `suite-runs/t4.10-b2-*`.

Only `verify:capacity` failed (expected until T4.28). T4.10 is complete, and with it Trade Analysis (T4.8–T4.10).

## T4.11 Trade Record: exposure start and StateAtEconomicCutoff

Implemented in `3f0c306` (3 cases). Flagged: case 3 first-run pass (the Open query already reads one lifecycle-index getAll per page in one snapshot), mutation-checked. The `exposureStart` strip in `tests/integration/d2/rebuild.test.ts` is deleted and the test passes, so the rebuild equals what commits write. Decision: `rebuild.ts` keeps its own `exposureStartOf` instead of calling `derive` (persistence may not import Trade Record's `analysisInputOf`); the rebuild test locks the two rules together. Query shape `queryRecords({lifecycle: 'Open', cutoff, projection})`; pages are filtered in memory, so a page can be short or empty while `nextCursor` is present and callers follow it to the end. Domain `DerivedTradeReconciliation` gains `exposureStart: Instant | null`; `TradeRecordQuery` gains optional `cutoff`; `exposureStart` stays private (dropped by `storedDocument`, absent from projections, before, candidate and digest).

ocr review of `3f0c306`: session `a60ae5c8-edc2-4b2b-9ce3-c8317cef2bbe`, 2 files, 2 comments. `ocr/T4.11-3f0c306.json`. Also checked on request: `facts[0]` is the first effective Execution (only Execution members of effective Position Changes enter `facts`; D6 will need an opening filter); no leak of `exposureStart`.

| Severity | Location | Claim | Assessment | Disposition |
|---|---|---|---|---|
| medium | `src/modules/trade-record/trade-record.ts:220` | The cursor does not carry `cutoff`, so reusing it with another cutoff silently skips Trades; the Trade Record design binds cursors to the normalized query | Valid | Bug task T4.11-B1 |
| medium | `src/modules/trade-record/trade-record.ts:356` | A Position Change commit whose reconciliation omits `exposureStart` erases the stored value | Doubtful (`derive` always supplies it; only hand-built reconciliations omit it) | Bug task T4.11-B2 (structural: make it required for a Position Change) |

### T4.11-B1 The cursor is bound to the cutoff
- it should return CursorExpired when a cursor is reused with a different cutoff or without one

### T4.11-B2 exposureStart required in a Position Change reconciliation (structural)
Verification: `exposureStart` becomes required in Trade Record's Position Change reconciliation type and hand-built test reconciliations supply it; `npx vitest run src tests/integration` passes with the same count before and after; typecheck, tsc6, lint, lint:deps exit 0.

ocr reviews of the T4.11 bug tasks, each **No findings**: `bb97642` (B1, session `e6ad8200-c3e0-413e-8570-07c6e2fea445`; the cursor carries the cutoff and a mismatch in either direction returns CursorExpired; assertions 2 and 3 had no red of their own after assertion 1's fix, mutation-checked and flagged), `9f0be49` (B2, `9af7ab6f-9ff1-458e-a9e1-7cab3135154d`). Raw outputs `ocr/T4.11-B<n>-<sha>.json`.

Decision (B2): the B2 subagent stopped because Plan confirmation and Position Change share one reconciliation type. `exposureStart: Instant | null` is required on the shared type and Plan confirmation passes `null`, which is true (a Planned Trade has no effective Execution); splitting the `Prepared` type was rejected as a larger change than a Doubtful finding warrants. `null` writes no field, as the rebuild does.

### Cumulative run after T4.11

- `9f0be49` (B1–B2), 2026-10-28 01:41 EDT: unit 602, integration 49, browser 124; checks 11 of 12. `suite-runs/t4.11-b2-*`.

Only `verify:capacity` failed (expected until T4.28). T4.11 is complete.

## T4.12 Journal: Daily Trade Review

Implemented in `5ab255b` (10 cases). Flagged first-run passes, each mutation-checked: case 3 (seed adds nothing again, covered by the product-key matching) and case 6 (Defer and Decline rejected, covered by the existing decline rule). Decisions where the specs name nothing: ids `entry-type.daily-trade-review`, `source.daily-review`, `prompt.daily-trade-review.{action, intent, conviction, considered, note}`, `option.daily-trade-review.action.{hold, exit, roll, adjust}` (following the manifest's existing pattern); manifest `D3_JOURNAL_MANIFEST` (version 3); origin `{kind: 'DailyReview', factId: tradeId, reviewDate}`; obligation key stored as `['DailyTradeReview', reviewDate, tradeId]`; Entry revision is its version count; edits validate against the original definition and keep the original moment and authored times; `NarrativeEntry.edited` only with more than one version. Deviation: the Review Date read is a separate `Journal.queryActions({reviewDate})`, since a second `query` overload broke `Parameters<>` callers; the Journal design lists no Review Date filter for `query`, so this is a spec gap, not a contradiction.

ocr review of `5ab255b`: session `7cc33542-4b01-4d72-b9c7-83ee19e3ed96`, 5 files, 2 comments. `ocr/T4.12-5ab255b.json`. Also checked on request and found sound: ids and origin against the Journal and Daily Review designs; the `\uffff` upper bound of the Review Date range; the edit binding at commit.

| Severity | Location | Claim | Assessment | Disposition |
|---|---|---|---|---|
| medium | `src/modules/journal/journal.ts:364` | `queryActions` reads `responses[0]` as the Action, which a definition that reorders prompts would break | Doubtful (an Entry keeps its original definition, whose first prompt is Action) | Bug task T4.12-B1 (structural: find the Action response by its prompt role) |
| low | `src/modules/journal/journal.ts:251-253`, `keyOf` | Nested ternaries build obligation keys | Valid (readability only) | Bug task T4.12-B2 (structural) |

### T4.12-B1 The Action response found by its prompt role (structural)
Verification: `npx vitest run src tests/integration` passes with the same count before and after; typecheck, tsc6, lint, lint:deps exit 0.

### T4.12-B2 Obligation keys as explicit guards (structural)
Verification: as for B1.

ocr reviews of the T4.12 bug tasks, each **No findings**: `5dc3669` (B1, session `050f6ec6-feaa-4b8d-a977-dfdaaf012c58`; the Action prompt is found by role in the Entry's original definition from definitions already in the single snapshot), `a9a3055` (B2, `e1207c71-f577-4f2e-9b91-6c315386a115`; also removed the test file's eslint-disable header, which raised an unknown-rule warning under `lint:deps`, typing six nested matchers `as unknown` instead). Raw outputs `ocr/T4.12-B<n>-<sha>.json`. The B2 subagent saw one unidentified failure in one of three local `src tests/integration` runs (filtered output, test not named); the two runs after it and the cumulative run below were clean, so it is recorded as an unconfirmed flake.

### Cumulative run after T4.12

- `a9a3055` (B1–B2), 2026-10-28 01:58 EDT: unit 612, integration 49, browser 124; checks 11 of 12. `suite-runs/t4.12-b2-*`.

Only `verify:capacity` failed (expected until T4.28). T4.12 is complete.

## T4.13 Section validators

Implemented in `fbe1f31` (4 cases; case 2 grown one defect at a time, ten reds). Flagged: case 3 (Journal accepts Action Entries) first-run pass, mutation-checked. Issue codes: `MissingRevisionIdentity`, `DuplicateRevisionIdentity` (store-wide), `EffectiveHeadNotLast`, `CorrectionReasonMissing`, `CorrectionFootprintMissing`, `AssertedWhileMarkEffective`, and the save codes `PriceNegative`, `InvalidPrice` (zero valid, A37), `NotASession`, `SessionPolicyCoverage`; Journal gains `EditDefinitionChanged`; repairs `[]` for both. `src/ui/readiness-copy.ts` gains one line for `EditDefinitionChanged` (its record is exhaustive).

Decisions: Market Data's validator is `validateSection(source, policy)`: `meta.sessionPolicy` stores only identity, so the caller supplies the policy that identity names (this release ships one revision). T4.17 must keep A40's "no longer a covered session" findings from blocking a migration, by validating with the policy the stored identity names or treating those two codes as A40 findings. "An Asserted acknowledgment while a Mark is effective" means an Asserted version saved after the key's first Mark: the app rejects Assert with `MarkExists` once a Mark is effective, but keeps an earlier Asserted head when a Mark is saved and gives the Mark precedence (T4.5), so the literal reading would flag the app's own writes. A forged Mark then Assert at the same instant is not detectable from `savedAt`.

ocr review of `fbe1f31`: session `d07643d0-737e-48f4-a22b-8414917a1eca`, 4 files, 3 comments. `ocr/T4.13-fbe1f31.json`.

| Severity | Location | Claim | Assessment | Disposition |
|---|---|---|---|---|
| medium | `src/modules/market-data/section.ts:31` | An impossible or malformed `tradingDate` makes `policy.classify` throw, so the validator rejects instead of reporting | Valid for the date (the key is the record's identity). Unchecked record shapes in general (missing arrays, non-string prices) are shared with D2's validators and are left to D8's restore parsing | Bug task T4.13-B1 |
| medium | `src/modules/market-data/section.ts:59` | Mark chain continuity (`supersedes` links, `revisionNumber` steps) is never checked, though the plan says "continuous chains" | Valid | Bug task T4.13-B2 |
| medium | `src/modules/market-data/section.ts:54` | A Withdrawn version with no effective Asserted version before it passes | Doubtful (the app rejects it with `NothingToWithdraw`) | Bug task T4.13-B3 |

### T4.13-B1 An impossible observation date is reported, not thrown
- it should report NotASession for a key whose date is not a valid calendar date

### T4.13-B2 Mark chains are continuous
- it should report a Mark revision whose supersedes link or revision number does not follow the one before it

### T4.13-B3 A withdrawal follows an effective assertion
- it should report a Withdrawn acknowledgment version with no effective Asserted version before it

ocr reviews of the T4.13 bug tasks: `ff0df16` (B1, session `ce41be17-c0aa-4827-8bf4-00e0e97d7f73`, **No findings**; the malformed-date assertion had no red of its own and was mutation-checked afterwards, logged in `6fc4e05`), `d6d20c8` (B2, `68a8397d-ae1d-44f0-9813-501f75ceeca6`, **No findings**; `MarkChainBroken {revisionId, field}`, checked against the writer's Corrections), `86b9928` (B3, `731a6d8d-42bf-4ad6-9074-5deaefe0b027`, 1 comment; `WithdrawalWithoutAssertion {versionId}`; the valid Asserted, Withdrawn, Asserted, Withdrawn chain was a first-run pass, mutation-checked; no leftover mutation after a hand restore). Raw outputs `ocr/T4.13-B<n>-<sha>.json`.

| Severity | Location | Claim | Assessment | Disposition |
|---|---|---|---|---|
| medium | `src/modules/market-data/section.ts:72` | Asserted, then a Mark, then Withdrawn passes, though the writer rejects a withdrawal once a Mark is effective (`resolve()` returns Available) | Valid | Bug task T4.13-B4 (second round of bug tasks on T4.13) |

Cumulative run 2026-10-28 02:18 EDT on `86b9928` (B1–B3): unit 619, integration 49, browser 124; checks 11 of 12 (only `verify:capacity`). `suite-runs/t4.13-b3-*`.

### T4.13-B4 No withdrawal after a Mark
- it should report a Withdrawn acknowledgment version saved after the key's first Mark

ocr review of `03b0eb1` (B4): session `52424def-484c-4d5d-91d8-858b548c0171`, 1 file, **No findings.** `ocr/T4.13-B4-03b0eb1.json`. New code `WithdrawnWhileMarkEffective {versionId}` shares one `savedAt` check with `AssertedWhileMarkEffective`; the reviewer confirmed no writer-producible history is flagged. Noted, not a bug task: both rules compare `savedAt`, so a clock stepping backward between an acknowledgment and a later Mark would flag a history the app wrote.

### Cumulative run after T4.13

- `03b0eb1` (B4), 2026-10-28 02:24 EDT: unit 620, integration 49, browser 124; checks 11 of 12. `suite-runs/t4.13-b4-*`.

Only `verify:capacity` failed (expected until T4.28). T4.13 is complete.

## T4.14 Daily Review: open

Implemented in `1e8fdce`: the 20 planned cases plus 4 added (NotComparable for a non-positive risk or reward at entry, which crashed the Review with `DivisionByZero`; the binding content; retry then `ChangedDuringAssembly`; a Trade with unreplayable facts kept as a blocker) and one Market Data case. Flagged first-run passes, each mutation-checked: cases 3, 4, 6, 8, 10, 11, 13, 19, 20; case 13 held only through Trade Record's return order, so the comparator now breaks ties explicitly. New module `src/coordinators/daily-review/` and fixture `tests/support/review-fixture.ts`.

Decisions: Market Data gains the query kind `ResolveSession` (Review Date and cutoff), as the Daily Review design says Market Data resolves the cutoff; T4.19 adds it to the manifest text. The request carries `asOf`. Names where the specs give none: bands `Blocker`, `BoundaryReached`, `EvidenceLimited`, `QuantifiedPressure`, `Routine`; reason codes `IntegrityDisagreement`, `IncoherentFacts`, `StopBreached`, `TargetReached`, `MarkMissing`, `AcknowledgedUnavailable`, `AwaitingClose`, `PressureTowardStop`, `PressureTowardTarget`, `NoPressure`; calculation families `Valuation`, `Risk`, `Reward`, `ConditionStatus`; completion `Incomplete`, `Complete`, `CompleteWithUnavailableMarks`; families `Marks` (with `today` and the nonblocking `earlier` gaps) and `Trades`.

ocr review of `1e8fdce`: session `da5116e6-d452-405e-ac23-383d8500f058`, 7 files, 3 comments, plus an assessment of the implementer's declared gaps. `ocr/T4.14-1e8fdce.json`.

| Severity | Location | Claim | Assessment | Disposition |
|---|---|---|---|---|
| medium | `src/coordinators/daily-review/daily-review.ts:63` | An expired page cursor (a Trade commit between pages) throws outside the retry loop, so `open` rejects instead of retrying or returning ChangedDuringAssembly (A46) | Valid | Bug task T4.14-B1 |
| medium | `src/coordinators/daily-review/attention.ts:94` | Last Activity compared as raw strings, not instants | Valid | Bug task T4.14-B2 |
| (gap b) | `derive` at the cutoff | Recorded Deviations are not filtered to the cutoff, so a Deviation recorded after it pairs with nothing and becomes a spurious blocker | Valid | Bug task T4.14-B3 |
| (gap a) | eligibility | No confirm-by-derive at the cutoff (A55; Daily Review design): a Trade selected by the index whose facts are not Open at the cutoff is shown as a blocker instead of excluded | Valid (unreachable without a stale `exposureStart` before D6, but cheap) | Bug task T4.14-B4 |
| low | `src/coordinators/daily-review/daily-review.ts:159` | Nested ternary for completion | Valid (readability only) | Bug task T4.14-B5 (structural) |
| (gap c) | `pressureOf` | Worst-Case Ongoing Risk and Maximum Incremental Reward fallbacks (P14) absent | Doubtful: unreachable for Long Stock, which always has a Stop, a Target and a value when a Mark exists | Deferred to the first deliverable with a Trade lacking a Stop or Target |
| (gap d) | `recover` | Called once for all Instruments, not in bounded batches | Doubtful: A47's request count depends only on the Instrument count; no batch size is specified | Deferred |
| (gap e) | `ReviewTradeItem` | No Strategy or Account labels, no saved-Action field (A57) | Doubtful: these belong to `getTrade`, save and the Review screen | Deferred to T4.15, T4.16 and T4.21 |

### T4.14-B1 An expired cursor during open is retried
- it should retry, then return ChangedDuringAssembly, when a Trade commit expires the eligibility cursor between pages

### T4.14-B2 Last Activity compared as instants
- it should order equal pressure by Last Activity as instants, not strings

### T4.14-B3 Recorded Deviations at the cutoff
- it should not report an integrity blocker for a Deviation recorded after the cutoff

### T4.14-B4 Eligibility confirmed by deriving at the cutoff
- it should exclude a Trade the index selects whose facts are not Open at the cutoff

### T4.14-B5 Completion as explicit guards (structural)
Verification: `npx vitest run src tests/integration` passes with the same count before and after; typecheck, tsc6, lint, lint:deps exit 0.

ocr reviews of the T4.14 bug tasks so far: `d4e61ac` (B1, session `eca45c44-2eb0-45de-99cf-685d9edeec2f`, **No findings**; an expired cursor gives an internal `Expired` pass and the 3-attempt loop continues; tested with the module's existing `pageSize: 2`; the give-up assertion mutation-checked and flagged), `4e9d689` (B2, `27a2ccb4-ee65-43f2-9471-5f5cfbc2fb1e`, **No findings**; `Temporal.Instant.compare`; the offset-form assertion mutation-checked and flagged), `3af1373` (B3, `c3178e38-decb-46fa-b2e1-3b16f1d4a431`, no ocr comments; recorded Deviations kept at a cutoff by their latest version's Economic Time; the Daily Review case and one derive assertion were first-run passes, mutation-checked and flagged). Raw outputs `ocr/T4.14-B<n>-<sha>.json`.

Assessment of B3's noted limit, requested from the reviewer:

| Severity | Location | Claim | Assessment | Disposition |
|---|---|---|---|---|
| medium | `src/domain/trade-analysis/derive.ts:592-598` | A Position Change whose Executions straddle the cutoff (A18 gives each Execution its own Economic Time; A19 gives the Position Change its earliest) keeps its recorded Deviation while the expected quantity comes from the surviving Executions, so a spurious integrity finding remains | Valid | Bug task T4.14-B6 (second round on T4.14) |
| low | `derive.ts:597` | Latest version's time vs first | Wrong: pairing already uses the latest version, and its time follows the Position Change | Dismissed |

Decision for B6: integrity is whether the stored Trade agrees with its facts, which does not depend on the Review cutoff. Daily Review therefore takes integrity findings (A59) from a derivation over all facts, and uses the cutoff derivation only for eligibility, state and evaluation. This removes post-cutoff and straddling cases together; B3's filter stays, so the cutoff derivation is self-consistent.

### T4.14-B6 Integrity findings from all facts
- it should not report an integrity blocker for a Position Change whose Executions straddle the cutoff
- it should still report an integrity blocker for a disagreement in facts after the cutoff

ocr review of `344b959` (B4): session `8b42f8cc-0db8-4e3c-9710-5c3913e3b231`, 1 file, 1 comment. `ocr/T4.14-B4-344b959.json`. B4 drops a Trade whose derivation at the cutoff is `Derived` with `expectedLifecycle` other than Open (IncoherentFacts kept). The red was a runtime exception before any assertion; the Marks assertion was mutation-checked; the completion assertion has no isolating mutation and is flagged as not separately checked.

| Severity | Location | Claim | Assessment | Disposition |
|---|---|---|---|---|
| medium | `src/coordinators/daily-review/daily-review.ts:98` | When the confirmation excludes every selected Trade, `open` returns Ready with empty families instead of Empty, because the Empty check runs before the filter | Valid (also noted by the implementer) | Bug task T4.14-B7 (second round) |

### T4.14-B7 Empty after confirmation
- it should return Empty when the index selects only Trades whose facts are not Open at the cutoff

ocr reviews of the remaining T4.14 bug tasks, each **No findings**: `1ecd669` (B7, session `314ff6cf-abda-494d-ac49-35b468512744`; the Empty decision moved after the confirmation and before `recover`; Mark tasks come only from surviving Trades, so Empty loses nothing), `d0226ad` (B6, `0e4d9854-1e19-4bb2-8ea9-d493e351aad4`; each eligible Trade derived twice over the same AnalysisInput; integrity findings from the all-facts derivation; IncoherentFacts if either is incoherent, cutoff findings first, kept out of Mark requirements; a third case added for a Trade broken only after the cutoff; `fillTogether` in the fixture; no first-run passes), `45903e4` (B5, `a1786fe6-deec-4ae7-9706-dd0d2cc4902f`; `completionOf`, `incoherentItem` with narrowed types removing an unreachable `: []`, and the tie-break in `byAttention`; precedence unchanged). Raw outputs `ocr/T4.14-B<n>-<sha>.json`.

### Cumulative run after T4.14

- `45903e4` (B1–B7), 2026-10-28 03:13 EDT: unit 654, integration 49, browser 124; checks 11 of 12. `suite-runs/t4.14-b5-*`.

Only `verify:capacity` failed (expected until T4.28). T4.14 is complete.

## T4.15 Daily Review: getTrade

Implemented in `92224ec`: the 4 planned cases (case 1 grown part by part, each with its own red) plus case 5 (a Trade whose facts cannot be replayed gets the overview's attention item and a form, with no frame or evaluation, instead of a throw). Flagged first-run passes, each mutation-checked: case 2's current figures `Unavailable(MarkMissing)` and its at-entry figures (both from `evaluate`), and case 4 (record nothing; the mutation trips ChangedDuringAssembly before the before/after dump runs, so the dump comparison is not isolated). Shapes: request `{reviewDate, tradeId, binding}`; result Ready | ReviewChanged | ChangedDuringAssembly | Rejected; `ActionForm` `Saved{action}` | `New{viewState: {selectedAction: 'Hold'}}`; `TradeSaveBinding {reviewDate, tradeId, factRevision, marketDataSnapshotId, obligationKey, expectedEntryRevision?, definitionRevision}`; `datedLastClose {tradingDate, evaluation}`. `open` and `getTrade` share `eligibleTrades`, `observationNeeds` and `reviewItem`; `openLongStockSummary` moved to `src/domain/trade-summary.ts`.

Decision: the evidence check compares the Review's single `marketDataSnapshotId`, so any Mark change on the Review's Instruments returns ReviewChanged for every Trade. The design's binding holds one snapshot id and requires ReviewChanged, never a hybrid, when it is no longer coherent; the overview's Marks family is stale after any Mark change (AC-REV-005). Per-Trade evidence would only be an optimisation.

ocr review of `92224ec`: session `bc87e477-4485-4c5c-bd95-cb912cf2a4d3`, 5 files, 1 comment, plus the requested assessments. `ocr/T4.15-92224ec.json`.

| Severity | Location | Claim | Assessment | Disposition |
|---|---|---|---|---|
| medium | `src/coordinators/daily-review/daily-review.ts:354` | `getTrade` never compares `binding.workspace`, so an overview kept across a Restore could return Ready | Doubtful (fact revision and snapshot id must also match) | Bug task T4.15-B1 |
| low | `daily-review.ts:311,329,337` | `definitionRevision` is always the latest definition, though an edit is validated against the Entry's first version's definition and rejected otherwise | Valid (latent while one revision exists) | Bug task T4.15-B2 |
| (c) | `daily-review.ts:124-143` | No dated line when the frame is Available but Lots opened after its close (P12); A54 names the frame's own date as `D` there | Valid | Bug task T4.15-B3 |
| low | `types.ts:125-130` | The request carries no cutoff beyond `reviewDate` | Doubtful: the cutoff is re-derived from the date and a policy change alters the snapshot id, which is compared | Dismissed: redundant |

### T4.15-B1 getTrade binds the Workspace
- it should return ReviewChanged when the overview binding names another Workspace

### T4.15-B2 A saved Action's form names its original definition
- it should name the Entry's first version's definition for a saved Action and the latest definition for a new form

### T4.15-B3 Dated line in the P12 case
- it should include a dated line at the frame's own close and at-entry figures when Lots opened after the Review-date close

ocr reviews of the T4.15 bug tasks, each **No findings**: `8cc879f` (B1, session `509e00ba-7cb9-4a27-996c-51b12f23fa70`; only `workspace.databaseName` is compared, since `contentRevision` moves with every save and the fact revision and snapshot id catch real content changes), `799734a` (B2, `ed741c74-d50f-432f-b62e-0a1e7f3c08af`; Journal `DailyAction` gains `definitionId`, the Entry's first version's definition; the second definition revision is a raw store write in the test, as the Journal has no revise path; three assertions were first-run passes, mutation-checked and flagged). Raw outputs `ocr/T4.15-B<n>-<sha>.json`.

T4.15-B3 dismissed, no code changed: the P12 case cannot occur in `getTrade`. It evaluates the state derived at the Review cutoff (the Review-date close), and `atCutoff` drops every Execution after it, so no Lot opened after the frame's close reaches that state. A54's P12 dated line (`D` = the frame's own date, AwaitingClose after D, at-entry figures for later Lots) belongs to current figures and is carried to T4.18 (Trade Views).

### Cumulative run after T4.15

- `3dea96e` (code at `799734a`, B1–B2), 2026-10-28 03:36 EDT: unit 661, integration 49, browser 124; checks 11 of 12. `suite-runs/t4.15-b2-*`.

Only `verify:capacity` failed (expected until T4.28). T4.15 is complete.

## T4.16 Daily Review: save

Implemented in `f5ec98f`: the 6 planned cases (case 1 grown part by part) plus in-commit binding cases (Trade fact and Mark changed between read and commit give ReviewChanged; a Journal counter that moved alone is retried into Saved; acknowledgment and same-Trade Action races). Process slip, flagged: production code was written ahead of its red in three places (the expected-revision mapping for case 3, the FactRevision comparison for case 4, the write guard for case 6); each was removed to get a genuine red and restored. First-run passes, each mutation-checked: completion, the remaining case 2 assertions, case 3's identity, case 4's acknowledgment, case 5's stale edit, the commit-level acknowledgment and same-Trade races, and the Done step.

Bindings in the commit: `trade:<id>` FactRevision; `mark:<Instrument>@<date>` resolution revision of each Review-date key; `journal@N` (counter binding, ADR 0011, up to 3 attempts); the Journal's Entry revision check and the obligation `add`. Shapes: request `{kind: 'SaveTradeAction', binding: TradeSaveBinding, action, intent?}`; result Saved{action, review: PostSaveReview} | ReviewChanged{evidence} | Conflict | Rejected{issues} | ChangedDuringAssembly | RuntimeNotWritable | StorageFailure; `PostSaveReview` Ready{progress, completion, nextStep, binding}; `ReviewNextStep` Mark{row} | Trade{trade: DailyTradeReview} | Done. `DailyReviewDeps` gains `guard: MutationGuard`; `assemble` takes a FrameContext.

Decision: the next step is the first open obligation in the normative task-family order (the design: "the task-family order is normative"): a Missing Review-date Mark, then the first Trade in the walk without an Action, then Done.

ocr review of `f5ec98f`: session `a25ee264-ebd2-416e-992c-654f8c000643`, 4 files, 4 comments. `ocr/T4.16-f5ec98f.json`. The reviewer confirmed that a subject conflict is never retried into Saved and that a counter which keeps moving ends in Conflict, though no test covers the exhaustion.

| Severity | Location | Claim | Assessment | Disposition |
|---|---|---|---|---|
| medium | `src/coordinators/daily-review/daily-review.ts:448` | The commit rechecks only Review-date Mark keys, so an earlier-session Mark corrected after the pre-read changes Stale context without failing the commit | Valid | Bug task T4.16-B1 |
| medium | `daily-review.ts:410` | `checkBinding` returns `done`, so `coherently` skips its Workspace check; nothing compares the Workspace database name, so a Restore is not detected | Valid | Bug task T4.16-B2 |
| medium | `daily-review.ts:467` | The unbound post-commit `queryActions` can return another writer's newer version as the saved Action | Valid | Bug task T4.16-B3 |
| medium | `daily-review.ts:468` | A throw in the post-commit read escapes to the guard as StorageFailure although the Action is committed | Valid | Bug task T4.16-B4 |
| (gap) | `saveTradeAction` | No test for a Journal counter that moves on every attempt | Valid (coverage) | Bug task T4.16-B5 |

### T4.16-B1 The commit binds the Stale-context Marks
- it should return ReviewChanged and write nothing when an earlier-session Mark is corrected between the read and the commit

### T4.16-B2 save binds the Workspace
- it should return ReviewChanged and write nothing when the save binding names another Workspace

### T4.16-B3 Saved returns the committed Action
- it should return the Action this save committed even when another version lands before the post-commit read

### T4.16-B4 A committed save is never reported as a failure
- it should return Saved with the review ChangedDuringAssembly when the post-commit read fails

### T4.16-B5 Counter exhaustion
- it should return Conflict and write nothing when the Journal counter moves on every attempt

### T4.16-B6 The saved Action needs no post-commit read
- it should return Saved with the committed Action when the post-commit Journal read fails

ocr review of `d35c345` (B1): session `e04740cd-1aac-416d-a0f3-bac4ca1dcbdf`, 1 file, 1 comment. `ocr/T4.16-B1-d35c345.json`. B1 binds, for each Instrument without an effective Review-date Mark, the Stale source key found by the same `byInstrumentDate` reverse lookup as `staleContextOf` (no session filter, so it can only over-bind). No code ahead of red, no first-run passes.

| Severity | Location | Claim | Assessment | Disposition |
|---|---|---|---|---|
| high | `src/coordinators/daily-review/daily-review.ts:413` | A Mark that newly becomes the Stale source between the read and the commit (a new, later earlier-session key, or the first one) is not caught | Doubtful: real, but per-key bindings cannot cover a key that did not exist at the read, and `commit` checks only exact keys (ADR 0011 keeps its write set static). Stale context is disclosure only (T4.9) and the saved Entry stores no evidence | Open question for the user: catching it needs a range binding in persistence, a design change |

ocr review of `7f3b70d` (B2): session `9d7de8ce-b6da-4eb4-b1b1-bf5593ee33a4`, no findings. `ocr/T4.16-B2-7f3b70d.json`. `TradeSaveBinding` now carries `databaseName`, and save compares it with the open Workspace before reading. The subagent flagged one slip: `getTrade` set `databaseName` on the binding before the red that required it. No first-run passes.

ocr review of `528b9a1` (B3): session `c60a1f61-d1c6-4849-8746-6abd50fe2045`, no findings. `ocr/T4.16-B3-528b9a1.json`. Save now reads the committed version with `Journal.actionAt(entryId, entryRevision)`; the reviewer confirmed versions are append-only and the revision is the version count. Residual note, not a finding: `actionAt` maps with the current definitions and labels, which match the commit's unless the Catalog changes in between. No code ahead of red, no first-run passes.

ocr review of `8210d89` (B4): session `3692232b-bb20-47a9-b1a3-a699e5b2dbdf`, 1 file, 1 comment. `ocr/T4.16-B4-8210d89.json`. B4 catches a throw from the post-save review and returns review ChangedDuringAssembly. Two assertions passed on their first run (the committed Action and the durable Hold Entry), both mutation-checked and flagged. No code ahead of red.

| Severity | Location | Claim | Assessment | Disposition |
|---|---|---|---|---|
| high | `src/coordinators/daily-review/daily-review.ts:493` | `journal.actionAt` runs after the commit outside the new catch, so its throw still reports a committed save as StorageFailure | Valid: the implementer reported the same gap. The reviewer found the Journal can build the Action from what prepare already reads (definitions, plus `journalTypes` for labels) without a post-commit read and without copying `dailyAction` | Bug task T4.16-B6, after B5 |

ocr review of `2b0eb08` (B5): session `9be954d7-7b24-4e52-ba82-2eb97d24c8b7`, no findings. `ocr/T4.16-B5-2b0eb08.json`. ocr excludes test files by path, so the reviewer ran it on a scratch clone with `save.test.ts` renamed; the JSON names that path. The test is a flagged first-run pass, and its log has a green row with no red row (the subagent ran green first; the note row says so). Mutations: a bound of 4 fails the test (the fourth attempt has no racing writer and throws); exhaustion returning another kind fails; the reviewer confirmed a bound of 2 fails the commits-equal-3 assertion. Small gap, not a defect: the test does not inspect which binding refused the commit, though each attempt rechecks the subject first and would return ReviewChanged had it moved.

ocr review of `8739bc2` (B6): session `4f67d9ea-cce2-4e77-9a37-39eabd5c2438`, 3 files, no findings. `ocr/T4.16-B6-8739bc2.json`. My own reading of the diff on the points ocr did not address: prepare builds the Action with the existing `dailyAction` mapping over the Entry it read in the same snapshot plus the new version, so the revision is the version count after the commit and `edited` follows from it; a retry repeats prepare (ADR 0011), so no Action outlives its snapshot; apply fills the new Entry's id; `applied.action!` is safe because save always prepares a Daily Trade Review; `actionAt` had no other caller and is removed. Four first-run passes, each mutation-checked and flagged; one existing prepare test's exact-equality expectation was updated after the change, not by a red.

### Cumulative run after T4.16

- `339a62e` (code at `8739bc2`, B1–B6), 2026-10-28 04:28 EDT: unit 682, integration 49, browser 124; checks 11 of 12. `suite-runs/t4.16-b6-*`.

Only `verify:capacity` failed (expected until T4.28). T4.16 is complete.

## T4.17 Workspace: migration, seeds, policy compatibility

`71df51e`. Cases in `src/coordinators/workspace/migration.test.ts`. Migration and every initialize use `D3_JOURNAL_MANIFEST` (fresh and existing Workspaces get Daily Trade Review and the Daily Review Source). A40: when the stored identity differs from the release's, `initialize` validates `observations` with Market Data's `validateSection(source, releasePolicy)`; only `NotASession` and `SessionPolicyCoverage` become findings and never block; the identity is written after the seeds. Migration never runs that validator (pre-schema-3 sources have no `observations`), so its receipt has `findings: []` and A40 cannot block it. Case 6 found a T4.6 defect: a kept record on a date that became a closure shadowed the earlier session's Mark in `staleContextOf`; the reverse cursor now requires a Session.

Decisions and types: `InitializationReceipt` gains optional `sessionPolicy: SessionPolicyReceipt {previous?, recorded, findings}`; `SessionPolicyFinding {code, instrumentKey, tradingDate}`; `WorkspaceDeps.sessionPolicy` (typed as `MarketDataDeps['sessionPolicy']`, so Workspace imports no session-policy module; T4.19's dependency rule must allow it); `ApplicationDeps.sessionPolicy` optional, default NYSE; `testStack` takes an optional policy. Existing tests asserting manifest 2 moved to 3 (three in `workspace.test.ts`, I1.1, I2.1, I2.12).

Deviation: case 3's tail "each current figure Unavailable(MarkMissing) (A51)" cannot be asserted until Trade Views have current figures; carried to T4.18. First-run passes, each mutation-checked: cases 2, 3, 4, and case 5's and case 6's later assertions. No code ahead of red.

ocr review of `71df51e`: session `f2e79530-9e53-4847-bf0a-a77c10733dfb` (scratch clone with tests renamed so ocr includes them), 10 files, 1 comment. `ocr/T4.17-71df51e.json`.

| Severity | Location | Claim | Assessment | Disposition |
|---|---|---|---|---|
| medium | `src/coordinators/workspace/workspace.ts:197` | `recordSessionPolicy` reads `meta` and `observations` in two snapshots and commits the identity with no checks, so a write between the scan and the commit can be missed | Valid in part: the two snapshots and unbound commit depart from ADR 0002's read, validate, commit-with-bindings pattern and are fixable by one snapshot and a binding on the identity read. A newly added observation key cannot be bound (the same limit as the T4.16-B1 question) | Bug task T4.17-B1 |
| low | `migration.test.ts`, v1 case | "in one candidate" is not asserted; a two-candidate chain that deleted its intermediate would pass | Valid (coverage) | Bug task T4.17-B2 |
| low | `src/modules/market-data/market-data.ts`, `staleContextOf` | `classify` throws on a malformed stored date inside the cursor predicate | Doubtful: `classify` calls `Temporal.PlainDate.from` and `section.ts` guards it for that reason; saves reject malformed dates, so only a forged record could carry one | Bug task T4.17-B3 |
| (note) | `recordSessionPolicy` | Findings exist only in the in-memory receipt | Not a defect: A40 names the receipt as the report | None |

### T4.17-B1 The policy identity is recorded against the snapshot it validated
- it should record nothing more when another launch records the identity between this launch's scan and its commit

### T4.17-B2 One candidate
- it should migrate a v1 Workspace to schema 3 in one candidate (asserts exactly one candidate created)

### T4.17-B3 A malformed stored date never breaks Stale context
- it should give Stale context from the latest earlier session Mark when a stored key holds a malformed date

### T4.17-B4 A matching identity reads no observations
- it should read no observations when the stored session-policy identity matches the release's

### T4.17-B5 The identity retry
- it should revalidate and record findings when another launch records a different identity between the scan and the commit
- it should record nothing and report no session policy when the identity keeps changing on every attempt

ocr review of `9bb5498` (B1): session `3ec83f54-851b-4a10-99e7-6e35adf9ec7d`, 2 files, 1 comment. `ocr/T4.17-B1-9bb5498.json`. B1 reads the identity and every observation in one snapshot and binds `meta/sessionPolicy` (id, revision, digest) to the identity read; on Conflict it re-reads, records nothing if the identity now matches the release's, else revalidates and retries, 3 attempts in all; on exhaustion it records nothing, so the next launch scans again (no typed result exists for it; findings of that launch go unreported). The reviewer confirmed each attempt recomputes its state. One first-run pass (stored identity), mutation-checked. Code ahead of red, flagged: the revalidate-and-retry path and exhaustion had no case; B5 adds them. Finding from the subagent, for the user: a tab on an older release can keep writing observations after a newer release recorded its identity (no write-gate check compares policies, and a policy-only release keeps schema 3), so a key on a newly closed date written then is never reported; it is still never selected. Proposed: accept, as for T4.16-B1.

| Severity | Location | Claim | Assessment | Disposition |
|---|---|---|---|---|
| medium | `src/coordinators/workspace/workspace.ts:188` | Every existing-Workspace launch now reads all observations, even when the identity matches | Valid: B1 reads both stores before comparing; the earlier code read observations only on a mismatch | Bug task T4.17-B4 |

ocr review of `1e9dd0d` (B2, test only): session `08de4f5c-c199-4386-96d5-f9ac5bb5b53d`, no findings. `ocr/T4.17-B2-1e9dd0d.json`. The case spies on `factory.open` and requires the only database opened besides `tj-root` and the source to be the migrated one. First-run pass, flagged; a second `createCandidate` fails it with an assertion. An earlier run on a mis-built scratch clone flagged only the clone's rename and was discarded.

ocr review of `4e91410` (B3): session `8eb675b0-6dfd-4793-a42d-2b1c33573184`, 3 files, 1 comment. `ocr/T4.17-B3-4e91410.json`. `staleContextOf` reuses `classifyDate` (now exported from `section.ts`) and skips a malformed stored date. The reviewer found no other unguarded `classify` of a stored key in the frame query path (the call after the cursor runs on a key the predicate already classified as a Session). No first-run passes, no code ahead of red.

| Severity | Location | Claim | Assessment | Disposition |
|---|---|---|---|---|
| medium | `query-check.ts:120` | The renamed test file no longer matches the unit-test include pattern | Wrong: an artifact of the scratch clone's rename; the commit keeps `query.test.ts` | Dismissed |

ocr review of `153ba3c` (B4): session `1c410e6c-6db0-4887-bc54-100fe6682eb6`, no findings. `ocr/T4.17-B4-153ba3c.json`. Inside the one snapshot, the identity is read first and observations only on a mismatch; the reviewer confirmed each attempt still rescans fully on a mismatch and the binding is unchanged. No first-run passes, no code ahead of red.

ocr review of `28abd46` (B5, test only): session `7aa3d7ed-3f8f-477b-8fae-d8072e27afc9` (scratch clone with the test renamed), 1 comment. `ocr/T4.17-B5-28abd46.json`. Both cases are flagged first-run passes, each assertion mutation-checked; the reviewer confirmed case 1's expected receipt can come only from the rescan and case 2's count and receipt fail on any other bound. An unrelated full-run failure in `src/ui/screens/TradeList.test.tsx` ("Open list" render states) passed alone twice and on rerun; recorded as a flake under load.

| Severity | Location | Claim | Assessment | Disposition |
|---|---|---|---|---|
| low | `migration.test.ts:525` | "Not the release's identity" would also pass if exhaustion deleted or replaced the record | Valid (coverage, minor) | Bug task T4.17-B6 (third round) |

### T4.17-B6 Exhaustion keeps the racing identity
- it should record nothing and report no session policy when the identity keeps changing on every attempt (asserts the last racing identity is stored)

ocr review of `d34beb3` (B6, test only): session `08aab6e1-5999-449a-abf8-c222b65019d1` (scratch clone with the test renamed), no findings. `ocr/T4.17-B6-d34beb3.json`. The exhaustion case now requires the stored identity to be the last racing one (revision 13). First-run pass, flagged: deleting the record on exhaustion fails the new assertion; writing the release identity fails the attempt count first.

### Cumulative run after T4.17

- `e9f5e45` (code at `d34beb3`, B1–B6), 2026-10-28 05:07 EDT: unit 693, integration 49, browser 124; checks 11 of 12. `suite-runs/t4.17-b6-*`.

Only `verify:capacity` failed (expected until T4.28). `TradeList.test.tsx` passed. T4.17 is complete.

## T4.18 Trade Views: current evaluation

`f7d457a`. Cases in `src/coordinators/trade-views/current-evaluation.test.ts`; the A51 tail carried from T4.17 is in `migration.test.ts` (v1 has no Open Trades, so v2's three are checked). Shared helpers moved from Daily Review to `src/coordinators/valuation.ts` (`observationFrame`, `datedLineOf`, which also picks the frame's own close in the P12 case). Frames are requested only for Derived Open Trades; Planned views never query Market Data. Types: `TradeViewsDeps` gains `marketData` and `clock`; `ViewBinding.marketDataSnapshotId` optional (Open views only); `OpenTradeItem.current: OpenCurrentFigures`; `OpenTradeDetail.current: OpenCurrentEvaluation` (with `mark: MarkProvenance`, `coverage[]` one entry per Instrument, the full evaluation, optional `datedLine`). Three existing exact-shape expectations gained the new keys. First-run passes, each mutation-checked: case 4 (derive counts), case 5's retry and exhaustion assertions, cases 7, 8 and the A51 tail. No code ahead of red.

ocr review of `f7d457a`: session `7ce6a91b-091e-4ba2-b73b-3deda5c25ee7` (scratch clone with tests renamed), 10 files, 1 comment. `ocr/T4.18-f7d457a.json`. The reviewer found no defect in the figures, Plan-R conversions or availability mapping.

| Severity | Location | Claim | Assessment | Disposition |
|---|---|---|---|---|
| medium | `src/coordinators/trade-views/trade-views.ts:415` | `currentFrames` throws on Market Data's `Rejected` `SessionPolicyCoverage`, so Open browse and Detail reject instead of giving `Unavailable(SessionPolicyNotCovered)` (P8) | Valid | Bug task T4.18-B1 |
| low | `trade-views.ts:421` (`markProvenance`) | Trade Views reads the `observations` store directly for save time and correction reason | Valid as a module-boundary breach (not a torn read: the shared content revision retries any write between the reads, and revisions are append-only). Market Data should expose provenance on the frame's Mark | Bug task T4.18-B2 |
| info | `trade-views.ts:431` (`coherent`) | `marketDataSnapshotId` is not rechecked between attempts | Wrong: the Workspace content revision advances on every Market Data write, so any change to the frames fails the binding; each attempt reassembles from scratch | Dismissed |
| info | `src/app/compose.ts:67` | A second Market Data instance | Wrong: it is the only production `createMarketData`; T4.19 must have Daily Review reuse it | Dismissed; carried to T4.19 |
| info | `valuation.ts` (`datedLineOf`) | Daily Review now also takes the P12 frame-own-date path | Matches A54; P12 is unreachable at the Review cutoff (T4.15-B3) | None |

### T4.18-B1 A date outside coverage is Unavailable, not a failure
- it should return Open items and Detail with current figures Unavailable(SessionPolicyNotCovered) when the as-of date is outside session-policy coverage

### T4.18-B2 Market Data owns Mark provenance
- it should give the frame's Mark its save time and correction reason from Market Data

ocr review of `ec4bbf6` (B2): session `a5093269-065f-43d1-8405-25aa15f3ee99` (scratch clone with tests renamed), 4 files, no findings. `ocr/T4.18-B2-ec4bbf6.json`. Market Data's frame Mark (`FrameMark`) carries `savedAt` and, for a Correction, `correctionReason`, from the same record and transaction that pick the effective Mark; Trade Views no longer reads `observations`. The digest and `MarketDataSnapshotId` use revision ids only, so they are unchanged and still move whenever the provenance does. Two first-run passes (the correction reason and its absence), mutation-checked; five exact-shape Market Data expectations gained the new fields.

T4.18-B1 is paused on a user decision: P8 names `Unavailable(SessionPolicyNotCovered)` but no shape for Open items and Detail when the as-of date is outside coverage (no Expected Mark Date, no resolution).

The user decided (plan revision 13, decision 54): outside coverage every figure that needs a Mark is `Unavailable(SessionPolicyNotCovered)`, and the shell shows a calendar warning icon like the browser-storage icon saying "Coming soon - update calendar" (the icon belongs to T4.25).

ocr review of `26257e4` (B1): session `a73762e4-bbc6-41b3-8903-d989eb30a4d7` (scratch clone), 2 files, 1 comment. `ocr/T4.18-B1-26257e4.json`. Outside coverage `evaluate` gets an `UncoveredObservation {instrument, date}`, so every Mark-dependent figure (market value, remaining-open and current marked P&L, risk and reward with their Plan-R forms, every condition) is `Unavailable(SessionPolicyNotCovered)`; Mark-free figures keep values; Expected Mark Date, Mark resolution, Mark provenance and dated line are absent; at-entry lines remain (they use execution prices, no Mark); Detail coverage is `NotCovered`. The detail is `{instrument, date}` so Daily Review's narrowing is untouched. First-run passes, each mutation-checked: the item's other figures and conditions, Mark-free values, the Detail figures, absent provenance and dated line, Planned unaffected. Two log rows labelled green exited 1; each was the next assertion's genuine red (note rows). No code ahead of red.

| Severity | Location | Claim | Assessment | Disposition |
|---|---|---|---|---|
| low | `src/domain/trade-analysis/evaluate.ts:187` | `latestExactClose` nests two ternaries | Valid (style); the logic is correct | Bug task T4.18-B3 |
| (reviewer) | `evaluate.ts:243` | `usableMark!` relies on `marked()` having checked it | Doubtful as a defect, Valid as a smell | Bug task T4.18-B3 |
| (reviewer) | `src/coordinators/trade-views/trade-views.ts` | Trade Views derives the as-of exchange date with its own `EXCHANGE_ZONE`, duplicating the session policy's; Market Data's rejection carries no date | Doubtful: agrees today, but can drift; Market Data should say which date is uncovered | Bug task T4.18-B4 |
| (reviewer) | `trade-views.ts`, the mapping | `every(code === 'SessionPolicyCoverage')` is true for an empty issue list | Doubtful (Market Data always gives an issue) | Folded into T4.18-B4 |

### T4.18-B3 Explicit Mark guards in evaluate (refactor)
- no new case; the existing evaluation and current-evaluation tests pass before and after

### T4.18-B4 Market Data names the uncovered date
- it should return SessionPolicyCoverage with the as-of exchange date when the as-of instant is outside coverage

ocr review of `0a8f52a` (B3, refactor): session `612e097d-b5b5-4aef-8a85-195567864400`, no findings. `ocr/T4.18-B3-0a8f52a.json`. `latestExactCloseOf()` keeps the ternary's three branches; `marked()` passes its checked Mark to the callback, removing `usableMark!`. The trade-analysis, trade-views and daily-review files passed 174 before and after.

ocr review of `444ea29` (B4): session `9953f4f3-eb7d-406e-b2b2-3c3153d83f5c` (scratch clone), 3 files, 1 comment. `ocr/T4.18-B4-444ea29.json`. Market Data's `asOf` `SessionPolicyCoverage` issue carries `date` and `coverage` from the session policy's diagnostic; Trade Views takes the date from it, `EXCHANGE_ZONE` is gone, and an issue list with no dated coverage issue still throws (untested). One existing ResolveSession expectation gained the fields. First-run pass on the Trade Views side, mutation-checked. Callers checked: Daily Review passes the Rejected through; Mark save and Workspace build their own issues; no UI copy reads them.

| Severity | Location | Claim | Assessment | Disposition |
|---|---|---|---|---|
| medium | `src/modules/market-data/market-data.ts:412` | At the lower coverage edge (as-of 2024-01-02 before completion) the issue names 2023-12-31, where the backward scan left coverage, not the as-of date 2024-01-02 | Wrong as a defect: 2024-01-02 is covered; the date the policy cannot classify is the one the scan reached, which is the true fact behind `SessionPolicyNotCovered`. Only the B4 case's title ("with the as-of exchange date") overstates it; both probes it uses are themselves uncovered | Dismissed; the issue's date means "the uncovered date" |

### Cumulative run after T4.18

- `8044d83` (code at `0a8f52a`, B1–B4), 2026-10-28 23:12 EDT: unit 704, integration 49, browser 124; checks 11 of 12. `suite-runs/t4.18-b4-*`.

Only `verify:capacity` failed (expected until T4.28); `verify:fixtures` passed. T4.18 is complete.

## T4.19 Capability manifest, composition, dependency rules

`df9eea2`. `npm run verify:capabilities` exit 0 (18 operations, 7 variant-qualified, 8 routes, 3 Entry Types, schema 3); `npm run lint:deps` exit 0 on `src`; `lint:deps` on `tools/dep-fixtures/trade-analysis-imports-session-policy` fails with `trade-analysis-never-sees-session-policy`, and on `daily-review-imports-session-policy` with `daily-review-never-sees-session-policy`; the D1 `ui-imports-module` fixture still fails with `ui-only-through-facade`. The manifest adds `MarketData.save` (`RecordInitialManualMark`, `CorrectMark`, `AssertUnavailable`, `WithdrawAcknowledgment`, `Stock`), `MarketData.query` (`ResolveFrames`, `ResolveSession`, `Current`, `Review`, `Historical`), `MarketData.recover`, `DailyReview.open` (`LatestCompleted`), `getTrade`, `save` (`SaveTradeAction`), `CurrentEvaluation` on `browseTrades` and `getTradeDetail`, `entry-type.daily-trade-review` and `sessionPolicy`. `FACADE_GROUPS` adds MarketData and DailyReview; `MarketData.save` runs through the mutation guard; Daily Review is composed over the one Market Data; T4.6's query types are re-exported unchanged from `src/app/types.ts`. A `/review` route (placeholder screen, `readOnly: true`) presents every new variant; T4.21 and T4.22 replace it. Test-first: the manifest case and `tests/integration/d4/facade.test.ts` (save refused while the inventory check fails), each red then green. `AppShell.test.tsx` navigation expectations gained Review. No first-run passes, no code ahead of red.

ocr review of `df9eea2`: session `fe7e9594-0361-4cc9-a154-3586edd421c0` (scratch clone with tests renamed), 19 files, 1 comment. `ocr/T4.19-df9eea2.json`. The reviewer found no unguarded mutating operation and the manifest variants equal to what routes present.

| Severity | Location | Claim | Assessment | Disposition |
|---|---|---|---|---|
| medium | `.dependency-cruiser.js:90` | Two narrow rules do not enforce A39's "only Market Data imports the session policy"; UI, Journal and other coordinators could import it | Valid: today only `src/modules/market-data/` and the composition root import it, so a general rule with those exceptions (and tests and tools) passes | Bug task T4.19-B1 |
| (reviewer) | `src/app/routes.ts`, `/review` | `readOnly: true` offers the Review in Recovery Only although it saves Marks and Actions | Doubtful: the guard refuses saves, Accounts has the same pattern, and reading the Review in Recovery Only is useful | Carried to T4.21 and T4.22: the Review screens disable their writes when not writable |

### T4.19-B1 Only Market Data imports the session policy
- `lint:deps` on a new fixture where the UI (or another non-Market-Data module) imports the session policy fails with the general rule; `src` passes

`f2784dc` (B1): rule `only-market-data-sees-session-policy` forbids `src/` imports of `src/domain/session-policy/` except from `src/modules/market-data/`, the policy's own files, `src/app/compose.ts` and `*.test.ts(x)`. `lint:deps` exit 0 on `src`; `tools/dep-fixtures/ui-imports-session-policy` fails with `only-market-data-sees-session-policy`; the two T4.19 fixtures still fail with their named rules (and the general one); `ui-imports-module` still fails with `ui-only-through-facade`. The narrow rules are kept for their names (the plan row names them) and are now redundant for enforcement.

ocr review of `f2784dc` (B1): session `3d72c75a-b348-4c28-b3e3-76a76738a9ae`, 3 files, no findings. `ocr/T4.19-B1-f2784dc.json`. The reviewer confirmed the exemptions are anchored (no other `market-data` or `compose.ts` path, no non-test helper is exempt) and an index re-export inside the policy folder is caught. Noted, not a defect: a Market Data file re-exporting the policy would bypass a direct-import rule; none does.

Cumulative run at `572482c` (code at `f2784dc`), 2026-10-28 23:26 EDT: unit 704, integration 50, browser 122 of 124, checks 11 of 12 (`verify:capacity`, expected). `suite-runs/t4.19-b1-*`. The two browser failures were D2's `e2e/d2/ui-alignment.spec.ts` T2.36-B1 and T2.37 cases, which hardcoded four bottom-bar links; T4.19's Review route made five. Bug task T4.19-B2.

### T4.19-B2 The bottom bar carries Review
- the T2.36-B1 fit and T2.37 icon-over-label cases hold with five links at 390 and 320

`ddf5c49` (B2, test only): `NAV_LINK_COUNT = 5` (Trades, Review, New Plan, Accounts, About) replaces the hardcoded 4; five links fit at 390 and 320 with no overflow, so no CSS change; the spec file passed 70, `test:e2e` 124. ocr review: session `7083a28d-1836-4419-a11c-200683d14b89` (scratch clone with the spec moved so ocr includes it), no findings. `ocr/T4.19-B2-ddf5c49.json`. The reviewer confirmed `routes.ts` has exactly five navigation routes and neither test was weakened.

### Cumulative run after T4.19

- `e8f8a20` (code at `ddf5c49`, B1–B2), 2026-10-28 23:38 EDT: unit 704, integration 50, browser 124; checks 11 of 12. `suite-runs/t4.19-b2-*`.

Only `verify:capacity` failed (expected until T4.28). T4.19 is complete.

## T4.20 UI: Mark entry

`7d9327d`. `src/ui/screens/MarkEntry.tsx` with `mark-issues.ts` (issue copy, like `position-change-issues.ts`). Issue mapping: `InvalidPrice`, `PriceNegative`, `CorrectionUnchanged` beside Price; `ReasonRequired`, `ReasonTooLong` beside Reason; `MarkExists` and the other codes as one whole-Mark message. Two extra cases of the subagent's (PriceNegative and a whole-Mark rejection; a refused write reported to the shell), each red then green. First-run passes, each mutation-checked: no price on Acknowledged Unavailable, no Correct on an acknowledged key, a later issue set replaces the earlier, the Conflict revision kept. One log row labelled green exited 1 (the unmount red; note row). No code ahead of red. Carried to T4.21: the Review must supply each key's `resolutionRevision` (frames and `recover` do not carry it today); whether Enter is offered on an acknowledged key follows A57; Withdraw is one click with no reason (the reason is optional).

ocr review of `7d9327d`: session `1e477ea0-275b-419c-8071-4b032755e271` (scratch clone with the test renamed), 3 files, 6 comments. `ocr/T4.20-7d9327d.json`. The reviewer confirmed the four intentions' requests, Saved and Conflict state, unsaved registration, writable gating, focus, unique ids, and that an acknowledged key never shows a price.

| Severity | Location | Claim | Assessment | Disposition |
|---|---|---|---|---|
| medium | `src/ui/screens/MarkEntry.tsx:68` | No in-flight guard: a second click sends a second save with the same revision; a late Saved closes over newer input | Valid | Bug task T4.20-B1 |
| medium | `MarkEntry.tsx:71` | `StorageFailure` is not handled; the trader is not told the save failed | Valid; no screen under `src/ui` handles it today (a cross-screen gap, for the user) | Bug task T4.20-B2 (Mark entry only) |
| medium | `MarkEntry.tsx:29` | State seeds only on mount, so new props for another key keep the old resolution | Doubtful: one key per mount by contract | Carried to T4.21: key each MarkEntry by Instrument and date |
| low | `MarkEntry.test.tsx:19` | The `saved` helper casts with `as never` and always binds 'None' | Valid (test realism) | Bug task T4.20-B3 |
| low | `MarkEntry.tsx:86` | Nested ternary builds the command | Doubtful: readable, no project rule | Dismissed |
| medium | renamed test file | Not collected by Vitest | Wrong: an artifact of the scratch rename | Dismissed |

### T4.20-B1 One save at a time
- it should send one save and disable the Mark actions while a save is in flight

### T4.20-B2 A storage failure is shown
- it should show that the Mark was not saved, keep the entered values, and allow a retry when the save returns StorageFailure

### T4.20-B3 Realistic Saved fixtures
- no new case; the MarkEntry test's Saved results are typed and carry the intention's classification and binding

ocr review of `1a8f153` (B1): session `7536aa12-cd10-4883-b178-0635fc3d2fdc` (scratch clone), 2 files, no ocr comments. `ocr/T4.20-B1-1a8f153.json`. Save, Enter, Can't get a price, Correct and Withdraw are disabled while a save is in flight; Cancel stays enabled. First-run pass, flagged: Correct's in-flight disabling has no isolated assertion (the mutation disabled all at once). Code ahead of red, flagged: the `try/finally` that re-enables after a thrown save has no case.

| Severity | Location | Claim | Assessment | Disposition |
|---|---|---|---|---|
| low | `src/ui/screens/MarkEntry.tsx:79` | Cancel mid-save, then a late Conflict or Rejected sets the banner ("your values are kept below", now false) or issues with no form open; neither is cleared when a form next opens | Valid (reviewer's reading) | Bug task T4.20-B4 |
| info | `MarkEntry.tsx:85` | A late Saved after Cancel reopens or overwrites | Wrong: Saved closes the form and the openers are disabled while saving | Dismissed |
| info | `MarkEntry.tsx:91` | Two submits before re-render (Enter key) | Doubtful: the disabled default button blocks implicit submission and React flushes the discrete event; only a programmatic submit gets through, with no path in the app | Dismissed |

### T4.20-B4 Nothing stale after a cancelled save
- it should keep Cancel disabled while a save is in flight, and open each form with no earlier Conflict, storage-failure notice or issues

ocr review of `fad60b0` (B2): session `37a826d8-0a51-4b74-b8ae-621c9b207c1b` (scratch clone), 2 files, 2 comments. `ocr/T4.20-B2-fad60b0.json`. A StorageFailure result shows a `role="alert"` warning (copy chosen by the subagent; neither specs nor plan define it), keeps the form and values, and clears on the next result or on Cancel; Conflict and the notice come from one result kind, so they cannot both show. The Withdraw case is a first-run pass, mutation-checked. No code ahead of red.

| Severity | Location | Claim | Assessment | Disposition |
|---|---|---|---|---|
| low | `src/ui/screens/MarkEntry.tsx:135` | "This Mark could not be saved … Your values are kept" is wrong for a failed Withdraw, which has no entered values | Valid (copy) | Bug task T4.20-B5 |
| low | `MarkEntry.test.tsx` | No test for StorageFailure then Cancel, then Rejected, or Conflict and the notice excluding each other | Valid (coverage); behaviour correct | Folded into T4.20-B4 |

### T4.20-B5 Withdraw's failure says what failed
- it should say the acknowledgment was not withdrawn, with no claim about entered values, when Withdraw returns StorageFailure
