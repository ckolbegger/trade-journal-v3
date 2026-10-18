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
| E-004 | 2026-10-18 | adjustment (user-directed) | user, in session | `freeze-2026-10-17.md` §2 only | **Applied.** Records that TypeScript 7.0.x ships no programmatic API, which is why `typescript-eslint@8.71.2` (peer `typescript >=4.8.4 <6.1.0`) aborts on it; adds the binding rule that no dependency or repo script may import `typescript` as an API under this pin; and reserves Microsoft's sanctioned side-by-side layout verbatim (`@typescript/native` → `typescript@7.0.2`, `typescript` → `@typescript/typescript6@6.0.2`, verified: alias name 404s in the registry, `tsc6`-only bin, `tsc` stays 7). No dependency is added and the plan keeps its no-linter stance; adopting the layout is an adjustment, not errata. Also records the tsconfig obligations from the 7.0 removal list for D1:T1. |

| E-005 | 2026-10-18 | errata | user, in session | `freeze-2026-10-17.md` §2 | **Applied.** Records the user's decision on the TypeScript 7 / ESLint question: **no linter is added.** The repo-local boundary check stays, and Microsoft's side-by-side layout stays as a recorded, verified recipe rather than an installed dependency set. Written into §2 so a later session treats "no ESLint" as decided rather than as something to fix. No manifested file changes. |

| E-006 | 2026-10-18 | adjustment (user-directed) | user, in session | `freeze-2026-10-17.md` §2, §7, §12; `D1-install-trust-and-set-up.md` T1 and §6; manifest re-stamped | **Applied. Supersedes E-005, which mis-recorded the decision.** The user did not forgo a linter; the linter is deferred to D1:T1, the build-scaffold task. Added to the profile: `eslint@10.13.0`, `typescript-eslint@8.71.2`, `@eslint/js@10.0.1`, `globals@17.13.0`, installed through Microsoft's side-by-side layout (`@typescript/native` → `typescript@7.0.2` for the `tsc` CLI; `typescript` → `@typescript/typescript6@6.0.2` for the API that typescript-eslint's peer range requires). T1 now declares `pnpm lint`, a flat config composing `@eslint/js` recommended with typescript-eslint's syntactic recommended and **no** `projectService`/`project`, and two structural verifications: V1.8 proves the version triple (`tsc` 7.0.2, `tsc6` 6.0.x, `eslint` 10.13.0) and V1.9 proves a seeded violation is actually caught. `pnpm lint` joins §6's recorded command forms and §12's gate list. E-005 is left in place as history and must be read as withdrawn. |

| E-007 | 2026-10-18 | adjustment (user-directed) | user, in session | `planning-decisions-2026-10-10.md` (PD18, Still open); `freeze-2026-10-17.md` §2 cross-reference; manifest re-stamped | **Applied.** Writes the E-006 linter decision into the durable decisions log as **PD18** — a linter is part of the toolchain and is produced by D1:T1, installed through Microsoft's side-by-side layout, with a syntactic-only config, and `pnpm lint` off the build path — so the profile is no longer ahead of the log. Also corrects two stale sentences in the log's "Still open" section: the acceptance-to-evidence matrix is drafted, and D1–D7 are frozen in wave 1. No new semantics beyond E-006; the manifest is re-stamped because the decisions file is manifested. |

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
