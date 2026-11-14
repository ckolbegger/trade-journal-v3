# D08 structural verifications

Each entry records a structural task's exact verification (D08 breakdown, section 5), each lane tier, each merge run, and each task's `ocr-review` findings and bug tasks under the task's heading (raw outputs in `ocr/`). D8 runs as a swarm under decision 111: each lane task ends with its lane tier (unit, integration, checks, in its lane worktree); the complete cumulative run runs once per merge batch on `claude-opus-5.5`, with the full tier before every critic. Full outputs are in `suite-runs/`. Versions are in [provenance.md](provenance.md).

## Start of D8

Session lock `.claude/session.lock` taken (none existed). Location checks (D8 handoff, section 1) on 2026-11-14:
- worktree `/Users/ckolbegger/src/trade-journal-v3/worktrees/claude-opus-5.5`, branch `claude-opus-5.5`: matched.
- `git status -sb`: `## claude-opus-5.5...origin/claude-opus-5.5`, clean.
- `git log --oneline claude-opus-5.5-pre-d08..HEAD`: one commit, `8374b793` "docs(plan): D8 handoff".
- `claude-opus-5.5-plan-r102^{commit}` and `claude-opus-5.5-pre-d08^{commit}`: both `3de5f838f5e397e55119fba282f05d5f1d68e239`.
- `claude-opus-5.5-d08p^{commit}`: `05b914afeec35ebdaa84c25f65a20ade5c3d0323`.
- `git diff --stat 4028908d claude-opus-5.5-pre-d08 -- src e2e tests tools package.json package-lock.json 'eslint*'`: empty.
- `ls .claude/worktrees`: absent.
- `git rev-parse --git-path hooks`: `.githooks`.
- `ocr llm test`: `✓ Connection test successful` (and `✓ Tool-call round trip verified`).
- `DEV_PORT=5175`; Node v26.12.0.
- `npm ci`: exit 0. `npx vitest run --project unit`: `Test Files 162 passed (162)`, `Tests 1748 passed (1748)`. `npx vitest run tests/integration`: `Test Files 106 passed (106)`, `Tests 229 passed (229)`.

**Reading.** The D8 breakdown in full; `plan/implementation-plan.md` except the D9–D28 definitions (decisions 1–113, freeze record, rules and cumulative obligations, the D08P and D8 definitions, parallelism, coverage index, review queue, tech debt); `plan/technology-stack.md`; the acceptance matrix's opening sections; D08P sections 9 and 4.2; approved-words conventions C1–C8. From `plan/spec-reading/D08.md`: `specs/README.md` 1–100, the acceptance contract's ranges (AC-BACK-001 through AC-CAP-001), every ADR, `specs/design/workspace.md` and `delivery-contract.md`. The remaining ranges (UI contract, glossary, the module design files and the overview ranges) are read before the briefs that build on them, and noted here.

**Lane creation.** Lanes are created by the main session with `git worktree add .claude/worktrees/d08-<lane> -b d08/<lane> <head>` inside this worktree, and each `tdd-task` is dispatched without the isolation flag, told to work only in that lane's absolute path. This follows the user's decision of 2026-11-13 in D08P (`evidence/D08P/structural.md`, "Lane creation"): the Agent tool's `isolation: "worktree"` creates its worktrees under the main checkout from a commit without `plan/` or `.claude/scripts/`. The path and branch are section 3.2's.

## T8.1 Artifact format

Lane F, commit `fdd92d08` (6 cases red then green; one first-run pass flagged: "should accept records pushed one at a time", mutation-checked, see `tdd-log/T8.1.md`). Lane tier `T8.1`: unit 165 files / 1754 tests, integration 106 / 229, checks pass. `@noble/hashes` 2.4.0 and `fflate` 0.8.3 were already exact pins in `package.json` and `package-lock.json` at the base commit, so T8.1 changed neither (A226's `npm install` is expected to change nothing).

**ocr review of `fdd92d08`** (session `a59b69e2-a670-42ad-8601-ce119ce9875d`, gpt-6.1-sol, 8 files, 7 findings; raw: `ocr/T8.1-fdd92d08.json`). All 7 judged Valid, so each becomes a bug task, run one at a time in lane F:

| Bug task | Finding | Defect | `it should` case |
|---|---|---|---|
| T8.1-B1 | `reader.ts:88` returns at the manifest line without reading the rest of the stream | a damaged gzip trailer, or content after the manifest, goes undetected | it should report Corrupt when the gzip trailer is damaged or content follows the manifest line |
| T8.1-B2 | `reader.ts:19` never cancels or releases the source on early return, error or an abandoned iteration | the source stream stays locked and its cancel never runs | it should cancel the source stream when the consumer stops early or the read fails |
| T8.1-B3 | `reader.ts:110` sniffs the gzip magic only in the first two chunks | an empty leading or middle chunk makes valid gzip read as plain text | it should detect gzip when the magic bytes arrive after or across empty chunks |
| T8.1-B4 | `writer.ts:43` `writeSectionEnd` for a section other than the open one writes an empty digest | a caller slip yields an artifact that fails verification | it should throw when writeSectionEnd names a section other than the open one |
| T8.1-B5 | `writer.ts:52` `finish()` accepts an open section | a forgotten section end yields a quietly incomplete artifact | it should throw when finish is called while a section is open |
| T8.1-B6 | `canonical-json.ts:38` sparse-array holes become empty text | invalid JSON or a silently dropped element | it should reject a sparse array hole with CanonicalJsonUnsupported naming its path |
| T8.1-B7 | `writer.ts:21` a section named `__proto__` is lost from the plain-object digest map | the section is missing from the manifest and returned digests | it should record a section named __proto__ in the manifest and returned digests |

- **T8.1-B1** `cf7c5795`: red (assertion: no `ArtifactReadError`) then green; the manifest line is yielded only after the stream drains clean. Lane tier: unit 1755, integration 229, checks 14 of 14. ocr (session `e924278e-371e-4427-b9d8-ee7b463a13a5`, 2 files): **No findings.** Raw: `ocr/T8.1-B1-cf7c5795.json`.
- **T8.1-B2** `3a48d696`: red ("expected +0 to be 1": no cancel after `break`) then green; `try/finally` cancels the source reader. Lane tier: unit 1756, integration 229, checks 14 of 14. ocr (session `00b8f02e-3356-4259-8c9d-8420f1c8b628`, 2 files): **No findings.** Raw: `ocr/T8.1-B2-3a48d696.json`.
- **T8.1-B3** `9e731c68`: red (gzip read as plain text: "not valid for encoding utf-8") then green; the sniff skips empty chunks. Lane tier: unit 1757, integration 229, checks 14 of 14. ocr (session `e5093f15-9809-497f-b71a-5c95ff35c8d6`, 2 files): **No findings.** Raw: `ocr/T8.1-B3-9e731c68.json`.
- **T8.1-B4** `b137b550`: red ("expected [Function] to throw") then green; `writeSectionEnd` throws "Section trades is still open; cannot end section journal". Implementation-level choice accepted: ending a section with nothing open stays legal (an empty section, digest = SHA-256 of nothing), since an empty store must export; the brief's extra "no section open" throw was the main session's addition, not ocr's finding. Lane tier: unit 1758, integration 229, checks 14 of 14. ocr (session `fdfe7bee-5793-4eb5-bd9f-e90524ef6657`, 2 files): **No findings.** Raw: `ocr/T8.1-B4-b137b550.json`.
- **T8.1-B5** `1c12878c`: red ("expected [Function] to throw an error") then green; `finish()` throws naming the open section. Lane tier: unit 165 / 1759, integration 106 / 229. ocr (session `ebb2a4cc-8750-4956-8b9c-1c2bd3ea1663`, 2 files): **No findings.** Raw: `ocr/T8.1-B5-1c12878c.json`.
- **T8.1-B6** `7eac25c3`: red ("expected undefined to be an instance of CanonicalJsonUnsupported": holes skipped) then green; `writeArray` is an index loop that throws on a hole, naming its path. The test builds holes with `new Array(n)`, because lint forbids sparse literals. Lane tier: unit 1760, integration 229, checks 14 of 14. ocr (session `869e3332-9cf1-46ba-b23b-3e7d71846a7a`, 2 files): **No findings.** Raw: `ocr/T8.1-B6-7eac25c3.json`.
- **T8.1-B7** `73e937fb`: red ("expected [] to deeply equal [ '__proto__' ]") then green; `sectionDigests` is `Object.create(null)`, and the test asserts the exact manifest line. Lane tier: unit 165 / 1761, integration 106 / 229, checks 14 of 14. ocr (session `0e4a6132-cf7d-4469-a480-45c481330283`, 2 files): **No findings.** Raw: `ocr/T8.1-B7-73e937fb.json`.

## T8.2 Fact modules: exportSnapshot

Lane FM, commit `cd98fc4b` (5 planned cases, each red from a stub then green). One extra case, "should find an option Instrument on any leg or fact of a Trade, not only the first" (multi-leg direction), ran only green; a note row explains it couldn't have passed before the footprint code. Lane tier `T8.2`: unit 171 / 1778, integration 106 / 229, checks 14 of 14.

**Signatures.**
- Each module (`src/modules/{trade-record,journal,market-data,reference-catalog}/export.ts`) has `exportSnapshot(batch: ExportBatch): <Section>Batch | undefined`. It is synchronous and per batch, and returns `undefined` for a store that isn't the module's.
- The batch shape is `{ section, store, records, footprint }`, where `footprint` is the sorted A126 identifiers present.
- Every record drops `revision` (Q3). Trade Record also drops A125's four private fields, harmlessly again.
- The Catalog module adds `exportWorkspaceSection(meta, { catalog, journal })`, which returns one `workspace` record: time zone, settings revision, seed-manifest versions and session policy.

**Implementation-level choices (recorded, not stops).**
1. `meta` stores no seed-manifest versions, so the caller passes them in: the `D7_CATALOG_MANIFEST` and `D5_JOURNAL_MANIFEST` versions that `workspace.ts` seeds with. T8.4 must pass the versions that belong to the exported schema.
2. "Neither content revision counter" is read as excluding every `meta` counter. `catalogRevision` and `journalRevision` are view-staleness counters, set to 1 at initialization (`workspace.ts:374`), and bindings name the database (A127), so a restored database restarting them is safe.
3. "W7's Marks of 0" is read as W7's observation with an empty Mark chain (PFE 2026-10-16, `effectiveMarkId: null`, one acknowledgment). W7 has no Mark priced 0.
4. A one-line field filter is duplicated in the four modules, because modules can't import each other.
5. `ExportBatch` is imported by path, because the persistence `index.ts` doesn't export it.

**ocr review of `cd98fc4b`** (session `70a01c83-8826-4add-b6a0-517a62901d6d`, 12 files): **No findings.** Raw: `ocr/T8.2-cd98fc4b.json`. The reviewer confirmed the multi-leg and Q3 directions in all four modules.

**Merge timing (main session's choice).** Lane FM was rebased onto `4b3cad5f`; T8.2 is now `1b12c298`. It merges by fast-forward once merge-3 finishes, so the running suite doesn't see new source mid-run. Meanwhile T8.6 continues on lane FM, and lane WB (T8.4) starts from `1b12c298`, which holds every task T8.4 needs.

## T8.3 Export snapshot read and layouts

Lane PS, commit `596b02bb` (4 cases). Lane tier `T8.3`: unit 164 / 1754, integration 106 / 229, checks 14 of 14. First-run pass flagged: "a concurrent readwrite commit waits for the read" (the single readonly transaction from case 1 already gave it). Mutation: each batch read through its own transaction; first failure "expected [] to have a length of 1200 but got +0". Code written ahead of red for cases 3 and 4 was reverted, and each case was then shown red on its own (tdd-log note rows).

**Implementation-level choices (recorded, not stops).**
1. `readExportSnapshot(database, layout, onBatch)` returns `UnknownLayout` when the stored schema version isn't the layout's. The coordinator (T8.4) looks the layout up with `exportLayoutFor(storedVersion)` and reports `UnknownLayout` itself when that returns nothing.
2. The read opens its own connection by database name, so the session is never marked superseded.
3. All `meta` records are returned; T8.2 and T8.4 pick the Workspace-section fields.
4. A missing store or a failed open returns `ReadFailed`.
5. The layout drops A125's four private Trade fields for every version.
6. Journal entries' and declines' `anchorTradeId` is exported as stored, since A125 doesn't exclude it.

**Raised as Q3:** whether the per-record `revision` write stamp is exported.

**ocr review of `596b02bb`** (session `ae6dedc5-ed8c-4530-a082-f92c5d2d5878`, gpt-6.1-sol, 5 files, 4 findings; raw: `ocr/T8.3-596b02bb.json`). Three judged Valid, one Doubtful, so each becomes a bug task, run one at a time in lane PS:

| Bug task | Finding | Defect | `it should` case |
|---|---|---|---|
| T8.3-B1 | `export-snapshot.ts:108` a promise from `onBatch` gets no handler | a later rejection of that promise is unhandled | it should not leave an unhandled rejection when onBatch returns a promise that rejects |
| T8.3-B2 | `export-snapshot.ts:52` opening a missing database name creates an empty database | a read-only export leaves a new database behind | it should report ReadFailed for a missing database without creating it |
| T8.3-B3 | `export-snapshot.ts:61` the missing-store check runs before the schema check | an older database read with a newer layout gives ReadFailed, not UnknownLayout | it should report UnknownLayout when a schema-1 database is read with the schema-7 layout |
| T8.3-B4 (Doubtful) | `export-snapshot.ts:114` the next-page key is read after `onBatch` | a callback that changes a record's key breaks paging | it should page by the key read before onBatch sees the batch |

- **T8.3-B1** `8ac2ff6a`: red ("expected [ Error: late failure ] to deeply equal []": an unhandled rejection) then green. The guard attaches a no-op rejection handler before returning `EarlyAutoCommitGuard`. Lane tier: unit 164 / 1755, integration 106 / 229, checks 14 of 14. ocr (session `24039bc2-5d37-4d63-84be-224f2bebcc7d`, 2 files): **No findings.** Raw: `ocr/T8.3-B1-8ac2ff6a.json`.
- **T8.3-B2** `ea739d7a`: red ("expected [ 'no-such-workspace' ] to not include 'no-such-workspace'") then green. `onupgradeneeded` aborts the open, so the read returns `ReadFailed('meta')` and no database is created. Lane tier: unit 1755 of 1756 (`TradeList.test.tsx` "should render distinct Loading, Ready, Empty…" failed under load and passed alone, see Flakes), integration 229, checks 14 of 14. ocr (session `94883f97-9c0c-4f1e-ad5c-04719bb1df6b`, 2 files): **No findings.** Raw: `ocr/T8.3-B2-ea739d7a.json`.
- **T8.3-B3** `78b3c622`: red ("expected { kind, store } to deeply equal { kind: 'UnknownLayout', … }") then green. When a layout store is missing, the stored schema version is read from `meta` first; a different version returns `UnknownLayout`. Lane tier: unit 164 / 1757, integration 106 / 229, checks 14 of 14. ocr (session `41e277dc-3d41-4928-83d2-91bb938a23fa`, 2 files, 1 finding, Valid; raw: `ocr/T8.3-B3-78b3c622.json`):

| Bug task | Finding | Defect | `it should` case |
|---|---|---|---|
| T8.3-B5 | `export-snapshot.ts:70` the schema probe's `onerror` falls back to the layout's version | a failed `meta` probe reports ReadFailed naming the missing layout store, not `meta` | it should report ReadFailed naming meta when the schema probe fails |

- **T8.3-B4** `975b9525`: red (only 500 of 1200 ids delivered: the second page started after the changed key) then green; the next-page key is read before `onBatch`, and only for a full batch. Lane tier: unit 164 / 1758, integration 106 / 229, checks 14 of 14. ocr (session `01426942-6177-4544-b714-a0c6f5e62fdb`, 2 files): **No findings.** Raw: `ocr/T8.3-B4-975b9525.json`.
- **T8.3-B5** `6ac5728c`: red ("expected { kind, store } to deeply equal { kind: 'ReadFailed', store: 'meta' }") then green; a failed schema probe returns `ReadFailed('meta')` before the version comparison. Lane tier: unit 164 / 1759, integration 106 / 229, checks 14 of 14. ocr (session `619c4063-2d49-4d44-9232-6097917550c3`, 2 files): **No findings.** Raw: `ocr/T8.3-B5-6ac5728c.json`.

## T8.7 Restore candidates and activation

Lane PS (recreated at `a0240277`), commit `094bb7ba` (3 cases, red then green; no first-run passes). Code written ahead of red for cases 2 and 3 (the gate and the activation body) was removed before their red runs, so each red is genuine. Lane tier `T8.7`: unit 168 / 1775, integration 106 / 229, checks 14 of 14.

**Implementation-level choices (recorded, not stops).**
1. Restore entries live in a separate optional `restoreCandidates: { databaseName, purpose: 'Restore', session }[]` beside `databaseNames` in the root `candidates` record. A138 calls this a record field. Keeping `databaseNames` unchanged leaves D2's exact assertions green.
2. A `putNames` helper keeps the entries when `discardCandidate`, `activateCandidate` or `deleteListed` rewrite the list.
3. The session identity is a `crypto.randomUUID()` per `createPersistence` instance.

**New internal methods:**
- `createRestoreCandidate(): Promise<RuntimeNotWritable | { kind: 'Created'; databaseName }>`. It is gated on the write gate, deletes this session's earlier Restore candidate, then lists the new one before creating it.
- `activateFirstCandidate(candidate): Promise<{ kind: 'Activated' } | { kind: 'AlreadyInitialized'; databaseName }>`.

T8.8 discards a rejected candidate with the existing `discardCandidate`.

**ocr review of `094bb7ba`** (session `c5c7b65b-3c05-4450-af6c-309bcfb13552`, gpt-6.1-sol, 2 files, 5 findings; raw: `ocr/T8.7-094bb7ba.json`). Three judged Valid, two Doubtful. Each becomes a bug task, run one at a time in lane PS:

| Bug task | Finding | Defect | `it should` case |
|---|---|---|---|
| T8.7-B1 | `persistence.ts:522` `activateFirstCandidate` never checks whether the existing pointer names this candidate | a repeated call deletes the live database | it should not delete the candidate when the pointer already names it |
| T8.7-B2 | `restore-candidate.test.ts:78` the replace-earlier case covers only a candidate whose database was never created | dropping the earlier database's deletion would go unnoticed | it should delete this session's earlier Restore candidate database when a new one is listed |
| T8.7-B3 | `persistence.ts:503` `createCandidate` rewrites the record with only `databaseNames` | Restore entries are erased, and an earlier Restore database is left behind | it should keep the Restore entries when a migration candidate is created |
| T8.7-B4 (Doubtful) | `persistence.ts:490` overlapping `createRestoreCandidate` calls aren't serialized | two Restore candidates for one session | it should leave one Restore candidate per session when two creations overlap |
| T8.7-B5 (Doubtful) | `persistence.ts:485` `createRestoreCandidate` doesn't refuse a superseded session | a superseded tab creates a candidate | it should refuse to create a Restore candidate in a superseded session |

- **T8.7-B1** `0d7fd672`: red ("expected { kind: 'AlreadyInitialized', … } to deeply equal { kind: 'Activated' }") then green. A repeat activation of the candidate the pointer already names returns `Activated` (idempotent; A135's AlreadyInitialized is for a pointer naming another database). Lane tier: unit 168 / 1776, integration 106 / 229, checks 14 of 14. ocr (session `1033f50b-d368-438d-9854-99310e50c11e`, 2 files): **No findings.** Raw: `ocr/T8.7-B1-0d7fd672.json`.
- **T8.7-B2** `0d31af59` (a test gap): a first-run pass, flagged. The behavior was built in T8.7. Mutation: removed the earlier database's deletion in `createRestoreCandidate`. Failure: "expected [ 'tj-root', 'tj-ws-r-0001', … ] to deeply equal [ 'tj-root', 'tj-ws-r-0002' ]". The code was restored, and its diff was empty. Lane tier: unit 168 / 1777, integration 106 / 229, checks 14 of 14. ocr (session `c85ea3eb-df51-4090-99de-f3290265b481`, 1 file): **No findings.** Raw: `ocr/T8.7-B2-0d31af59.json`.
- **T8.7-B3** `4d62a6c0`: red ("expected [] to deeply equal [ 'tj-ws-r-0001' ]") then green; `createCandidate` writes through `putNames`. Lane tier: unit 168 / 1778, integration 106 / 229, checks 14 of 14. ocr (session `4e6e7f4c-e9a4-448a-9965-ee910487e7b9`, 2 files): **No findings.** Raw: `ocr/T8.7-B3-4d62a6c0.json`.

## T8.12 Backup page

Lane UB, commit `54c7bd84` (6 cases). Lane tier `T8.12`: integration 229, checks 14 of 14. Unit had 1 failure: `tools/wording-rules.test.ts` hit its 5 s timeout under load and passed when rerun alone (see Flakes). First-run pass flagged: "should forget the Downloaded result when the page is left". Mutation: the result held in a module-level variable that new page instances start from; see `tdd-log/T8.12.md`. Props: `BackupViewProps { facade; selectFile; readiness; timeZone }`. The three states Q1 didn't word are put to the user in Q2, part B.

**ocr review of `54c7bd84`** (session `e80e5fc8-8e7b-4577-80e7-cad6a3f5ac71`, gpt-6.1-sol, 3 files, 3 findings; raw: `ocr/T8.12-54c7bd84.json`). All 3 judged Valid:

| Bug task | Finding | Defect | `it should` case |
|---|---|---|---|
| T8.12-B1 | `BackupView.tsx:50` a new download clears `downloaded` but not `outcome` | backup B shows backup A's "Backup complete"; a late verification of A writes B's status | it should not carry an earlier verification result over to a new download, nor apply a verification that finishes after a new download |
| T8.12-B2 | `BackupView.tsx:55` only the stage is kept | IntegrityBlocked, ReadFailed and Conflict all read "couldn't be read" | it should show each Not Completed reason in its own words (paused: Q2, part B4) |
| T8.12-B3 | `BackupView.tsx:88` the Downloaded line stays after Completed | "Downloaded, not verified yet" shows next to "Backup complete" | it should replace the Downloaded line with Backup complete once verification completes |

- **T8.12-B3** `74c85b3e` (run before B2, which waits on Q2): red ("expected <p></p> to be null") then green; the Downloaded line shows only while the outcome isn't Completed. Lane tier: unit 164 / 1758, integration 106 / 229, checks 14 of 14. ocr (session `36b59840-87e6-4071-b82e-58696e752996`, 2 files): **No findings.** Raw: `ocr/T8.12-B3-74c85b3e.json`.
- **T8.12-B2** `9f17252a` (resumed after Q2): red ("Unable to find an element with the text: The backup could not be made. Your journal has a problem that blocks a normal backup. Nothing was changed.") then green. The page keeps the reason, not the stage; a `NOT_MADE` table holds Q2 B4's four sentences, each with Retry. Lane tier: unit 164 / 1761, integration 106 / 229, checks 14 of 14. ocr (session `2e340a36-28c7-48b8-ab04-f0a05671172c`, 2 files): **No findings**; the reviewer checked every text against Q1 and Q2 character for character. Raw: `ocr/T8.12-B2-9f17252a.json`.

**T8.12 merges with T8.13 (main session's choice).** All of T8.12's bug tasks are clean. T8.13 is the next task in lane UB and starts on top of it at once. Merging T8.12 alone would mean rebasing the lane under a running task, so the two merge as one batch when T8.13 is clean. Nothing else waits on T8.12's merge.
- **T8.12-B5** `5a4b631a`: red ("expected [ { file: File{}, … } ] to have a length of +0 but got 1": confirmBackup called for the stale file) then green; the count is read before the picker opens. Lane tier: unit 164 / 1760, integration 106 / 229, checks 14 of 14. ocr (session `2c2a806a-211c-4dbf-9bc5-6134d26d25e7`, 2 files): **No findings.** Raw: `ocr/T8.12-B5-5a4b631a.json`.
- **T8.12-B4** `eb7ddd3e`: red ("expected <p role="status"></p> to be null": the old check's progress re-set `checking`) then green; `onProgress` applies only while the download count is unchanged. Lane tier: unit 164 / 1759, integration 106 / 229, checks 14 of 14. ocr (session `bb870ce6-19ca-4367-802e-cd2de64a708f`, 2 files): **No findings.** Raw: `ocr/T8.12-B4-eb7ddd3e.json`.
- **T8.12-B1** `5e11ab01`: red ("expected <p role="status"></p> to be null": A's Backup complete still shown under B) then green. A new download clears the outcome, and a download counter drops a verification that finishes after a newer download. Lane tier: unit 164 / 1757, integration 106 / 229, checks 14 of 14. ocr (session `39b4cf87-84e0-4763-957e-ff71b37f37f1`, 2 files, 2 findings, both Valid; raw: `ocr/T8.12-B1-5e11ab01.json`):

| Bug task | Finding | Defect | `it should` case |
|---|---|---|---|
| T8.12-B4 | `BackupView.tsx:74` a stale check's `onProgress` still sets `checking` | after a newer download the old check's progress shows and Verify stays disabled | it should ignore progress from a verification started before a newer download |
| T8.12-B5 | `BackupView.tsx:67` the download count is read after the file picker resolves | a download made while the picker is open gets the old backup's Backup complete | it should drop a verification whose file was chosen for an earlier download |

## T8.13 Restore flow

Lane UB, commit `61fb47bb` (7 planned cases and one extra). New `RestorePreview.tsx`, `RestoreConfirm.tsx` and `backup-text.ts`; `BackupView.tsx` now imports its texts from `backup-text.ts`. Lane tier `T8.13`: unit 165 / 1769, integration 106 / 229, checks 14 of 14.

**First-run passes, flagged and mutation-checked (`tdd-log/T8.13.md`):**
- "should require the separate warning acknowledgment for Replace without a backup…": the mutation (Replace no longer waits for the acknowledgment) failed with "expected false to be true".
- "should show a rejected or conflicting apply…": the mutation (the Conflict sentence mapped to undefined) failed with "Unable to find … Your journal changed after the backup was checked."
- The extra inline-backup Conflict case: same mutation pattern, same failure.

**Raised as Q5:** the acknowledgment label, repair lines, validator-code fallback, a failed prepare, and the "Marks acknowledged unavailable" label's `join`.

**For T8.11:**
- `RestoreFlow` renders router `Link`s (`/`, `/accounts`) in the Restore complete result.
- The shell refreshes status and discards pre-Restore views after a Restore.
- The facade passes `expectedBinding` through `exportBackup` and honors `signal` in `prepareRestore`.
- First run reuses `RestoreFlow` with target `NoWorkspace`.

**For T8.8:** `RestoreCounts.versions` keys are `trades`, `entries`, `debts`.

## T8.4 Workspace exportBackup

Lane WB, commit `321f4e62` (5 cases, red then green; no first-run passes; two invalid red rows, where the `-t` filter matched nothing, are noted). Lane tier `T8.4`: unit 172 / 1783, integration 106 / 229, checks 14 of 14.

**New file `backup-export.ts`:**
- `ExportJob`: plain data, so a worker can receive it.
- `ExportRun`: `Built`, `Conflict` or `Failed`.
- `ExportPort.run`.
- `runExport(read, job)`.
- `createInProcessExportPort(persistence)`.

`BackupPorts.export?` defaults to the in-process port. `BackupDeps` and `workspace.ts` are unchanged.

**Root outcomes:**

| Root | Result |
|---|---|
| NoWorkspace | `NotCompleted(Read, ReadFailed)` |
| Unreadable, Invalid, or an unknown layout | `NotCompleted(Read, IntegrityBlocked)` |
| OlderSchema | export kind `BlockedDatabase` |
| KnownWorkspace | export kind `Normal` |

**Other details:**
- The manifest `exclusions` list has 16 identifiers, including `record.revision` (Q3).
- A schema-to-seed-manifest table lives in `backup.ts`. Rows for schemas 1–4 are inferred from the manifest files; only schema 5 is tested.

**Raised as Q4:** the pipeline holds every projected batch until the read ends, because `readExportSnapshot` reports counts only after the last batch (A128 orders them first).

**Untested branches:** `OfferFailed` and progress.

## T8.14 Shell, warnings, first run

Lane US, commit `9cf16630` (5 cases, each red then green; no first-run passes). Lane tier `T8.14`: integration 229. Unit had 1 failure: `PositionChangeForm.test.tsx` "focus after navigation" failed under load and passed twice when rerun alone (see Flakes). Checks: 13 of 14; `verify:capabilities` fails: "route backup requires absent capability Workspace.exportBackup", and the same for the other three operations.

**Merge held until T8.11 (main session's choice).** The Backup route (P105, P106) needs the four operations that only T8.11's manifest installs. Merging T8.14 alone would turn every merge run red until then. T8.11 depends on T8.14 anyway (P105), so its lane will be created from `d08/us` rebased onto the main branch, and both merge in one batch. T8.14 stays in its lane meanwhile, and nothing in wave 1 needs it.

**Recorded for T8.11:**
- the route `{ id: 'backup', path: '/backup', wideNavigationOnly: true }`;
- `Screens.backup?`;
- new `AppShellProps`: `backup?`, `selectFile?`, and `onWorkspaceReplaced?` (a subscribe function that T8.11 implements over the BroadcastChannel);
- `FirstRun`'s `restore?` prop;
- `StorageProtectionCard`'s `backupTo?`;
- `useWide` is now exported from `AppShell.tsx`.

The download icon is drawn inside `AppShell.tsx`, because `icons.tsx` is outside the lane. After a first-run Restore, `RestoreFlow` has no completion callback, so T8.11 or T8.13 refreshes the shell. A tab still on first run gets no notice when another tab restores. The blocked views' result texts are placeholders until Q2, part C.

**ocr review of `9cf16630`** (session `e0d0d9fa-501e-424d-8f21-23f0782316f0`, gpt-6.1-sol, 6 files, 5 findings; raw: `ocr/T8.14-9cf16630.json`). Three judged Valid, two Doubtful. Each becomes a bug task, run one at a time in lane US. B3 runs last, since its on-screen text waits on Q2, part C.

| Bug task | Finding | Defect | `it should` case |
|---|---|---|---|
| T8.14-B1 | `AppShell.tsx:234` `WorkspaceReplaced` doesn't record the open path in `refusedAt` | an open record-entry form is swapped for Record Entry Unavailable and its values are lost (A136) | it should keep an open record-entry form's values when another tab's Restore replaces the journal |
| T8.14-B2 | `AppShell.tsx:140` `downloaded` stays set after Completed | the blocked view shows "Downloaded, not verified yet" next to "Backup complete" | it should replace the Downloaded line with Backup complete once verification completes on a blocked view |
| T8.14-B3 | `AppShell.tsx:115` the backup handlers have no rejection handler | a rejected export, file selection or confirm is unhandled and shows nothing | it should show the failure text when a blocked view's download or verification rejects (paused: Q2, part C) |
| T8.14-B4 (Doubtful) | `AboutView.tsx:57` About's link checks the operations but not `screens.backup` | the link could open a blank page | it should hide About's Backup link and the warning's link when no Backup screen is composed |
| T8.14-B5 (Doubtful) | `AppShell.tsx:76` A143's Recovery Only copy names Backup even when it isn't installed | the copy points at a page that doesn't exist | it should keep the earlier Recovery Only copy when Backup isn't installed |

- **T8.14-B1** `8e71f075`: red ("Unable to find a label with the text of: Quantity": the form was swapped for Record Entry Unavailable) then green. The `WorkspaceReplaced` handler records the open path in `refusedAt`, as `report` does. Lane tier: unit 163 / 1756, integration 106 / 229, checks 13 of 14 (`verify:capabilities`, known until T8.11). ocr (session `2ac57042-65c3-4da9-ae24-7b9d81c9a027`, 2 files): **No findings.** Raw: `ocr/T8.14-B1-8e71f075.json`.
- **T8.14-B2** `cd96d625`: red ("expected <p role="status"><span></span></p> to be null") then green; the blocked view's Downloaded line hides once the message is Backup complete. Lane tier: unit 163 / 1757, integration 106 / 229, checks 13 of 14 (`verify:capabilities`, known). ocr (session `e7ebf14d-9003-4c10-8ff5-9e089b71fa65`, 2 files): **No findings.** Raw: `ocr/T8.14-B2-cd96d625.json`.
- **T8.14-B4** `6e3bd46e`: red ("expected <a href="/backup" …></a> to be null") then green. The shell publishes `backupTo` in the runtime context only when the Backup route is offered, and About reads it for both links. Prop change: `RuntimeState.backupTo?` (`src/ui/runtime.tsx`). Lane tier: unit 163 / 1758, integration 106 / 229, checks 13 of 14 (`verify:capabilities`, known). ocr (session `b632632f-cd63-4879-8792-c7116d9d05a4`, 4 files): **No findings.** Raw: `ocr/T8.14-B4-6e3bd46e.json`.
- **T8.14-B3** `5f2e853f` (resumed after Q2): two cases, each red on the missing ReadFailed text, then green.
  - The handlers catch rejections: a rejected download shows ReadFailed; a rejected file selection or verification shows Unreadable.
  - The raw codes are replaced by the `NOT_COMPLETED` and `NOT_VERIFIED` tables of Q1 and Q2 texts.
  - The Downloaded line depends on a `verified` state, not on the text.
  - Lane tier: unit 163 / 1761, integration 106 / 229, checks 13 of 14 (`verify:capabilities`, known).
  - For T8.11: the strings are duplicated in `AppShell.tsx`, since lane US lacks T8.12's code. Unify them with the Backup page's after both merge.
  - ocr (session `05fc1f59-721b-4617-a81b-f2b875d80cd6`, 2 files, 1 finding, Valid; raw: `ocr/T8.14-B3-5f2e853f.json`). It becomes **T8.14-B6**. At `AppShell.tsx:155` the verify `.catch` doesn't reset `verified`, so after a Completed check a rejected re-verify hides the Downloaded line. Case: "it should show the Downloaded line again when a verification after Backup complete rejects".
  - **T8.14-B6** `87ec33c6`: red ("Unable to find an element with the text: /Downloaded, not verified yet/") then green; the verify `.catch` resets `verified`. Lane tier: unit 163 / 1762, integration 106 / 229, checks 13 of 14 (`verify:capabilities`, known). ocr (session `8b16af42-5110-42a6-ad51-8ef396301093`, 2 files): **No findings.** Raw: `ocr/T8.14-B6-87ec33c6.json`. T8.14 has no open bug tasks; it waits in lane US for T8.11.
  - Reviewer's notes, not ocr findings: the blocked views show bare "Backup complete" (no "Checked <time>") and no "Choose another file". Both are as Q2 C1 approved, so no change.
- **T8.14-B5** `ea096718`: red ("Unable to find an element with the text: Another browser has its own separate storage…": the pre-T8.14 copy, from `fdc5e858`) then green; A143's copy shows only when the Backup route is offered (the rule that sets `backupTo`), otherwise the earlier copy. Lane tier: unit 163 / 1759, integration 106 / 229, checks 13 of 14 (`verify:capabilities`, known). ocr (session `d96d5e7e-a3c8-46ed-8585-c16ea2a7cab7`, 2 files): **No findings.** Raw: `ocr/T8.14-B5-ea096718.json`.
  - Reviewer's note, not an ocr finding: the condition compares against the literal text "Backup complete". T8.14-B3 reworks these texts after Q2, so its brief will have it keep the Completed state, not the text.

## Merge runs

- **T8.3 merged** 2026-11-14: lane PS rebased onto `fb6df610` and fast-forwarded (`bd46514a` … `a379a2ca`). Lane removed; it is recreated from the new head for T8.7.
- **merge-3** (T8.3 merged; source at `a0240277`; stage headers show later HEADs, but `git diff a0240277 4b3cad5f -- src tests e2e tools package.json` is empty, since only plan and evidence commits landed): unit 167 / 1772, integration 106 / 229, browser full tier (first matching path since `683f10b2`: `src/persistence/export-layout.ts`) browser-1 126 passed, browser-2 98 passed, checks 14 of 14. Complete. Outputs `suite-runs/merge-3-*.txt`.
- **merge-4** (T8.2 merged; at `ac58669b`): unit 171 / 1778, integration 106 / 229, browser task tier (no changed path since `a0240277` on the full-tier list) 5 passed, checks 14 of 14. Complete. Outputs `suite-runs/merge-4-*.txt`.
- **T8.2 merged** 2026-11-14: `1b12c298` fast-forwarded onto `4b3cad5f` after merge-3. T8.6 continues on lane FM above it.
- **merge-2** (T8.1 merged; at `683f10b2`): unit 166 / 1763, integration 106 / 229, browser task tier (no changed path since `fdc5e858` is on the full-tier list) 5 passed, checks 14 of 14. Complete. Outputs `suite-runs/merge-2-*.txt`.
- **T8.1 merged** 2026-11-14: lane F rebased onto `f087f274` and fast-forwarded (`b96da61c` … `daa1b0d4`). Lane removed. `npm install` in the main worktree (A226) changed neither `package.json` nor `package-lock.json`.
- **merge-1** (T8.23 merged; started at `fdc5e858`; plan-only commits landed during the run): unit 163 / 1750, integration 106 / 229, browser full tier (first matching path since `a6c88cdd`: `src/app/types.ts`) browser-1 126 passed, browser-2 98 passed, checks 14 of 14. Complete. Outputs `suite-runs/merge-1-*.txt`.

## T8.23 Types, skeletons and ports

Lane T, commit `f6bce21e`. Verification (section 5) in the lane's `T8.23-verification.md`, copied here at merge: typecheck, `tsc6 --noEmit`, lint, lint:deps exit 0; `npx vitest run --project unit` 162 files / 1748 tests (unchanged). Lane tier `T8.23`: unit 162 / 1748, integration 106 / 229, checks 14 of 14.

**Implementation-level choices (recorded, not stops).** (1) NodeTestHost lives in `tests/support/node-test-host.ts`; section 3.2's "`tests/integration/d1/support.ts`'s NodeTestHost" names the wrong file, so the task edited the real one, which no other lane owns. (2) A new `src/coordinators/workspace/backup-types.ts` holds the shared shapes, because coordinators can't import `src/app`; `src/app/types.ts` re-exports them. (3) `backup.ts` and `restore.ts` take their own deps interfaces that `WorkspaceDeps` satisfies structurally, to avoid import cycles. A WB or WR task that needs a dependency `WorkspaceDeps` lacks would edit `workspace.ts`, which is a pending decision (section 3.2). (4) A127: `WorkspaceSnapshotBinding` already holds `databaseName` and `contentRevision`; unchanged. (5) `StatusBase.backupActions?` is optional and unset until T8.10.

**ocr review of `f6bce21e`** (session `8d6da0c5-7fa6-42cd-8c51-2e0ac2e51776`, gpt-6.1-sol, 12 files, 1 finding; raw: `ocr/T8.23-f6bce21e.json`):

| Bug task | Finding | Defect | `it should` case |
|---|---|---|---|
| T8.23-B1 | `src/ui/backup/test-support.ts:29` a throwing responder escapes synchronously | a UI test asserting a rejected operation sees a synchronous throw instead | it should return a rejected promise when a configured responder throws |

## Critic cost

| Critic | Report | Flows | Result | Tokens | Tool calls | Duration | Brief |
|---|---|---|---|---|---|---|---|

## Lane worktrees

| Task | Lane | Worktree | Branch | Base |
|---|---|---|---|---|
| T8.1 | F (wave 0) | `.claude/worktrees/d08-f` | `d08/f` | `a6c88cdd` |
| T8.23 | T (wave 0) | `.claude/worktrees/d08-t` | `d08/t` | `a6c88cdd` |
| T8.3 | PS (wave 1) | `.claude/worktrees/d08-ps` | `d08/ps` | `fdc5e858` |
| T8.14 | US (wave 1) | `.claude/worktrees/d08-us` | `d08/us` | `fdc5e858` |
| T8.12 | UB (wave 1) | `.claude/worktrees/d08-ub` | `d08/ub` | `9312835b` |
| T8.7 | PS (wave 1, recreated) | `.claude/worktrees/d08-ps` | `d08/ps` | `a0240277` |
| T8.2 | FM (wave 1) | `.claude/worktrees/d08-fm` | `d08/fm` | `fbef268c` (rebased to `4b3cad5f`) |
| T8.4 | WB (wave 1) | `.claude/worktrees/d08-wb` | `d08/wb` | `1b12c298` |

## Flakes

| Run | Test | Targeted rerun |
|---|---|---|
| T8.12 lane tier | `tools/wording-rules.test.ts` "reports navigator.userAgent…" (5 s timeout under load) | passed alone |
| T8.14 lane tier | `src/ui/screens/PositionChangeForm.test.tsx` "focus after navigation" | passed twice alone |
| T8.3-B2 lane tier | `src/ui/screens/TradeList.test.tsx` "Open list › should render distinct Loading, Ready, Empty…" | file passed alone (35 of 35) |
