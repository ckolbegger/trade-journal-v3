# T6.25 residual growth after T6.25-B2

Investigation by a subagent on 2026-11-03, against copies of the 300-session smoke profile (`.cache/bench/smoke-300`, built on the fixed bench build). The main session wrote up its report, because the subagent couldn't write this file. The probes are in the session scratchpad: `residual-probe.mjs`, `linear-probe.mjs`, `outstanding-hist.mjs` and `app-probe/`.

## Smoke run with the fix (300 sessions)

| Sessions | Review save per save | `getTrade` per 25 sessions |
|---|---|---|
| 1–25 | 29 ms | 4 s |
| 251–275 | 63 ms | 12–13 s |

## Cause 1: stale entries in the sparse index `journalDebts.byOutstandingDue` (high confidence)

**Mechanism**
- The index (`src/persistence/schema.ts`, `['outstandingDue', 'debtId']`) is sparse: `outstandingDue` exists only while a Debt is Outstanding.
- On resolution, `src/modules/journal/journal.ts`, in the debt-resolution branch of `applyPreparedEffects` (about lines 854–873), drops the field and does a plain `put` on the record. Its index key goes from present to absent, and nothing stages a `vacateIndexKey`. T6.25-B2 covered only the two `trades` indexes.
- Chromium keeps the old entry.

**Effect**
- `journal.query({ scope: 'OutstandingDebt' })` (journal.ts, about line 653) reads the whole range.
- At 300 sessions, the range holds 119 live entries and about 5,804 stale ones, one for each settled or declined Debt. The stale count grows by about 19 per session.

**Callers** in `daily-review.ts`:
- `assemble` (open and `readAfterSave`);
- `boundDebts` (`assembleTrade`, `assembleOwedCard`).

That's 1 call per `getTrade`, and 2 per save when the next step is a Trade.

**Raw request, median of 9:**

| Profile copy | `byOutstandingDue` getAll |
|---|---|
| Churned | 13.2 ms |
| Fresh copy | 1.2 ms |
| After one read-write cursor sweep | 1.9 ms |

Every other request in the Review paths matches the fresh copy, at 0.0–0.6 ms:
- `trades`: get by id, and the three lifecycle indexes;
- `byAnchorTrade` on debts, entries and declines;
- `journalObligations` by Review date;
- `journalDefinitions`, `journalTypes`, `catalog`;
- `observations`.

B2's fix for the `trades` indexes holds.

**Scaling (synthetic):**

| Stale entries | 0 | 1k | 2k | 4k | 8k | 16k |
|---|---|---|---|---|---|---|
| Read time | 0.4 ms | 1.4 ms | 2.7 ms | 6.1 ms | 12.8 ms | 28.2 ms |

That is linear, about 1.7–2.2 µs per stale entry. At full bench scale, about 25,000 Debts, a call would take about 50–55 ms.

**End to end:** `createApplication` bundled from `src/`, 240 getTrade and save pairs on the 2025-03-13 Review:

| Profile copy | `getTrade` | save | open |
|---|---|---|---|
| Churned | 19.1 ms | 26.4 ms | 67.8 ms |
| Swept | 6.6 ms | 13.7 ms | 42.2 ms |
| Every store rebuilt into a new database | 6.6 ms | 15.4 ms | 26.9 ms |

- The only request that differs between the churned and swept copies is `byOutstandingDue`.
- Times stay flat across all 5 passes.
- The swept copy matches the rebuilt one.

**Share of the growth:**
- It accounts for nearly all of `getTrade`'s growth. The churned-to-swept ratio is 2.9×; the log shows 3.1×.
- It accounts for about 75–90% of the save growth. The prediction is about 22–24 ms added per save, against 24–26 ms observed.

## Cause 2: nothing else in the stored data

- Every read of the accumulating data is a bounded key or index range: 60k entries, 66k obligations, 45k observations and 6k Trades.
- No growing record is rewritten on each save.
- The remaining 10–25% of the save growth didn't reproduce on a reopened profile and didn't drift over 240 saves. It is likely in-run (a LevelDB compaction backlog, or heap and garbage collection in a generator page running for 27 minutes) or estimate noise. Medium confidence.

**Index audit:**
- Only `byOutstandingDue` moves a key that nothing vacates.
- Latent: `trades.byLifecycleTerminal` would go stale if a Closed Trade's Terminal Time ever changed, or if a Trade reopened.

## Fix options

1. **Vacate at the source** (mirrors B2): in the debt-resolution branch, stage `vacateIndexKey` for `journalDebts.byOutstandingDue` with key `[current.outstandingDue, current.debtId]`, plus a Chromium regression test.
2. **Generalize in Persistence:** for each `put` on an indexed store, read the current record, compare its old and new keys for each index key path, and vacate any key that changed or disappeared. This closes the whole class of bug, including `byLifecycleTerminal`. It costs one extra get per put, and Persistence has to understand key paths, including sparse and array ones.
3. **One-off sweep of existing data:** at open, in a migration, or in `rebuild.ts`. It takes 71–90 ms at 5.8k stale entries. It only makes sense paired with 1 or 2.
4. **Fewer calls (optional):** `boundDebts` reads `journalDebts.byAnchorTrade` for the one Trade and filters to Outstanding, while keeping A63's due ordering.

Not recommended: turning the hot read into a read-write cleaning cursor.
