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
