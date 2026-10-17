# Freeze errata register — wave 1

Append-only amendment log for the plan revision in
[freeze-manifest-2026-10-17.sha256](freeze-manifest-2026-10-17.sha256). The classes are defined in
[freeze-2026-10-17.md §8](freeze-2026-10-17.md). Nothing is edited in place here: an entry is appended,
then the manifest is re-stamped.

Every entry records: id, date, class (`errata` | `adjustment` | `deviation`), approver, the files it
touches, what changed, and the verification tail. An entry that cannot name a class is treated as a
deviation until classified.

## Entries

| Id | Date | Class | Approver | Files | Change |
|---|---|---|---|---|---|
| E-001 | 2026-10-17 | errata | freeze record §8 (pre-declared mechanical: missing task citation) | `D2-confirm-first-plan.md`, `D3-record-entry.md`, `D6-end-long-stock-trade.md`, `D7-back-up-journal.md` | **Open — apply at wave-2 confirmation.** Those files rely on the persistence-level `RuntimeNotWritable` rejection but never cite the task that implements it. Add `D1:T12` beside the existing `D1:T9` / `D1:T11` citations where the persistence-boundary rejection is described. |

No other entries.

## Verification tail (required for every entry)

```sh
node scripts/check-deliverable-breakdown.mjs plan/deliverable-breakdowns/*.md   # 0 failure(s), 0 warning(s)
node scripts/audit-breakdown-coverage.mjs                                       # 0 failure(s), 0 warning(s)
node scripts/derive-acceptance-ownership.mjs                                    # 67 scenarios, counts unchanged
shasum -a 256 -c plan/freeze-manifest-2026-10-17.sha256                          # all OK after re-stamp
```

## Confirmation log

| Date | Event | Result |
|---|---|---|
| 2026-10-17 | Wave-1 freeze recorded (D1 frozen, D2–D7 provisional) | Awaiting D1's 15 interface tasks |
