# Independent D2 Spec review

Reviewed locally on 2026-10-21 by the independent Spec-axis reviewer. Scope: production D2 changes against `f36c52df0fdc101498067aaed1f5ffdc46185438`, including untracked D2 source/tests/tools. HEAD remained that fixed point; this reviewed an uncommitted working tree, not a separate implementation commit.

Authority: `prompts/handoff-D2.md`, `implementation/plan/d02-implementation-baseline.md`, unchanged `implementation/plan/d02-initial-stock-entry.md`, and frozen specs under the authority order in `specs/README.md`. Focus was missing/wrong requirements, scope creep, data integrity, atomicity, precision and compatibility. The original review excluded known parent-owned repairs (readable migration recovery, schema-1 mutation gating, late IntegrityBlocked UI handling, bounded global Debt queries) and pending T07 evidence. It did not conduct browser acceptance.

## Original finding — P2: stale lifecycle FactRevision accepted in detail

`src/application/trade-views-and-reporting/index.ts:29` loaded the lifecycle row and supplied only its lifecycle text to analysis. The original `TradeRecord.getRecord` at `src/domain/trade-record/index.ts:35–42` assembled the head without comparing its FactRevision with the lifecycle row's revision. Changing only an Open lifecycle row's revision consequently left Trade Detail `Ready`, although `browseTrades` rejected the same inconsistency as `FactRevisionDisagreement`.

The specification requires StoredLifecycle “plus effective-fact digest, causing fact/correction, and FactRevision binding” (`specs/design/trade-record.md:33`). D2-T05 requires “surface lifecycle, recorded lot-agreement or deviation mismatch from a controlled integrity fixture and never repair it on read” (`implementation/plan/d02-initial-stock-entry.md:95`). Recommendation: validate the binding in `getRecord`, so detail and workflow preparation reject stale authority consistently, with an Open-detail regression.

No additional definite numerical/atomicity defects or scope creep were identified in the inspected implementation. This was not certification of pending T07 or browser acceptance.

## Resolution — inspected after parent repair

The parent added the comparison in `TradeRecord.getRecord` (current line 43) and propagated `RecordIntegrityError` from opening workflow preparation as `IntegrityBlocked`. The regression `rejects a stale authoritative lifecycle FactRevision consistently in detail and opening preparation` in `tests/unit/d02-reads.test.ts` checks both seams and verifies the lifecycle rows remain unchanged.

The reviewer inspected this fix and the parent's retained execution records; the reviewer did not rerun these commands independently:

- [Behavior-caused Red](D2-review-fact-revision-red.json): targeted unit command exited 1; detail returned `Ready` instead of expected `IntegrityBlocked`. Source digest `9a35863a4f3e47a9fb573f2105445f3c859a4647d803317ab6e17ef864677bff`.
- [Cumulative unit Green](D2-review-fact-revision-green.json): `npm run test:unit` exited 0, 103 tests passed in 13 files.
- [Integration Green](D2-review-fact-revision-integration.json): `npm run test:integration` exited 0, seven tests passed in two files.

Both Green records bind source digest `db3c1dbd82cf0a9c44e03f656e398a720214384f13078de7bfcf4dfbf5f606f5` and record their reviewed input digests. The original finding is resolved by the inspected change and recorded regression evidence. Browser acceptance remains a separate evidence obligation.
