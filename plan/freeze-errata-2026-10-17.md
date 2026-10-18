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
| E-002 | 2026-10-17 | adjustment (user-directed) | user, in session | `freeze-2026-10-17.md` §2, §9 items 1 and 7, §11; `kickoff-prompt-d1-2026-10-17.md` | **Applied.** Runtime pin moves from Node 24.21.0 (DSH runtime) to **Homebrew Node 26.12.0**; `@types/node` 24.19.2 → 26.6.5; `engines.node` `>=24.21.0 <25` → `^26.12.0`; pnpm 11.7.0 is installed globally with `npm` because corepack is absent, with `pnpm --version` and `pnpm exec node --version` as the proof commands. Class note: the two defined classes describe plan-text and seam changes, not a platform pin; this is recorded as an adjustment because it touches no manifested plan file, no §7 seam and no scenario status, so no new freeze revision is required — and the digest set in §1 is unchanged. |
| E-003 | 2026-10-17 | adjustment (user-directed) | user, in session | `freeze-2026-10-17.md` §2, §3, §9 item 1, §11; `kickoff-prompt-d1-2026-10-17.md` | **Applied.** The runtime pin becomes the range `^26.12.0` (26.12.0 or any later 26.x) instead of a single patch, and `@types/node` becomes `^26.6.5` so typings track whichever 26.x runtime is installed. Resolves to the same 26.12.0 today. Consequence: a Homebrew patch/minor upgrade inside 26 needs no plan change and the exact version is recorded per evidence run as provenance (§3); crossing into 27 or dropping below 26.12.0 is out of range and is an adjustment. Proof command becomes the range assertion in §2. |

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
