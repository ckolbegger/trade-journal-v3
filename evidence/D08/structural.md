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
- **T8.7-B4** `c40cd9d7`: red ("expected [ { …(3) }, { …(3) } ] to have a length of 1 but got 2") then green. The public `createRestoreCandidate()` chains its body on a per-instance promise, so overlapping calls run in turn, and a failed creation doesn't block the next one. Lane tier: unit 168 / 1779, integration 106 / 229, checks 14 of 14. ocr (session `68de6d2e-ebe0-4fd1-8f7e-729fe1b0ba0e`, 2 files): **No findings.** Raw: `ocr/T8.7-B4-c40cd9d7.json`.
- **T8.7-B5** `d4ccee93`: red ("expected { kind: 'Created', …(1) } to match object { kind: 'RuntimeNotWritable', …(1) }") then green. A superseded session is the persistence's own `superseded` flag, not the write gate. `createRestoreCandidate` now returns `RuntimeNotWritable`, with the gate's rechecked failures plus `{check: 'control', reason: 'SessionSuperseded'}`, the same refusal `commit` gives. It is shared through a `supersededRefusal()` helper (refactor row). Lane tier: unit 168 / 1780, integration 106 / 229, checks 14 of 14. ocr (session `701ac262-c485-4422-9c1b-bf944d5dc7ad`, 2 files): **No findings.** Raw: `ocr/T8.7-B5-d4ccee93.json`.

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

## T8.6 Fact modules: prepareRestore and applyPreparedRestore

Lane FM, commit `fa01ba22`: the 3 planned cases in each of the four modules, each red against a stub, then green. Lane tier `T8.6`: unit 175 / 1788, integration 106 / 229, checks 14 of 14. A7's records are built in the tests from W7 through T8.2's `exportSnapshot`; the committed A7 fixture is T8.17's.

**First-run pass, flagged:** "should accept a Trade whose facts hold any number of Planned Legs, Executions and Expirations, each with its own option Instrument". It is an extra case for the multi-leg direction, an 8-leg Trade. Mutation: `facts: z.array(facts).max(6)` failed with "expected { kind: 'Rejected', … } to deeply equal { kind: 'Parsed', … }".

**Implementation-level choices (recorded, not stops).**
1. `prepareRestore(context)` returns `{ parse(store, lines), validate(source) }`, because parsing streams (A132 step 5) and validation runs after (step 8).
2. `measureCandidateSection` records per-store digests as well as counts and the section digest, so `applyPreparedRestore` names the changed store. T8.8 records the whole result in the candidate's meta.
3. The shared types and digest folding are duplicated per module, because modules can't import each other.
4. Catalog's recheck covers the `catalog` store only; the `workspace` record lives in candidate `meta`.

**Omitted from the first brief (main session's error):** D2 follow-up F12, which the breakdown's status paragraph assigns to T8.6's validation cases. It covers three validator gaps and B2.12's new trigger. T8.6 continues in lane FM to add them before it counts as done.

**ocr review of `fa01ba22`** (session `262064c8-68d1-4722-a437-561aac662060`, gpt-6.1-sol, 12 files, 10 findings; raw: `ocr/T8.6-fa01ba22.json`). Seven were judged Valid and three Doubtful.
- Two findings fall inside F12, so the F12 continuation covers them:
  - Trade Record `restore.ts:49`: `versions: []` makes `analysisInputOf` throw. It was added to F12 as the case "should report a Trade whose version history is empty".
  - Trade Record `restore.ts:189`: a Position Change names a missing member. This is F12's first gap.

  If the F12 commit doesn't close either one, that finding becomes a bug task.
- **F12 continuation** `3a2b6b4e`, committed after Q6 (a).
  - Cases, each red then green:
    - a missing Position Change member: "Error: Position Change fx-0123 names missing member no-such-execution", now reported and not derived;
    - a duplicate tradeId: "expected [] to deeply equal [ { code: 'DuplicateTradeId', …(1) } ]";
    - a duplicate Entry id: the same, with `DuplicateEntryId`;
    - a continuity break: "TypeError: Cannot read properties of undefined (reading 'value')".
  - **First-run pass, flagged:** "should report a Trade whose version history is empty". Mutation: dropping `versions.length === 0 ||` from `versionChainIssuesOf` gave "TypeError: Cannot read properties of undefined (reading 'value')".
  - New codes `DuplicateTradeId`, `DuplicateEntryId`, `MissingPositionChangeMember` and `VersionChainBroken`, with Q6's sentences in `readiness-copy.ts`. That is lane US's file this wave: only the four entries were added, and they are reconciled at the FM/US merges.
  - B2.12 needed no new trigger.
  - `verify:wording` and `verify:fixtures` pass.
  - Lane tier: unit 175 / 1793, integration 106 / 229, checks 14 of 14.
  - ocr (session `c833bf72-155e-4522-894c-3aceee65857a`, 5 files): **No findings.** Raw: `ocr/T8.6-F12-3a2b6b4e.json`. The two ocr findings from `fa01ba22` that F12 covers are closed. T8.6-B1 has started.
- The other eight become bug tasks, run one at a time in lane FM after F12:

| Bug task | Finding | Defect | `it should` case |
|---|---|---|---|
| T8.6-B1 | trade-record `restore.ts:29` instants and decimals are plain strings | `derive()` throws on a bad price or time instead of returning an issue | it should report a malformed record for a Trade fact with an unreadable price or time |
| T8.6-B2 | journal `restore.ts:92` Entry and Debt `versions: []` parse | the debt projection and index rebuild crash | it should report an Entry or Debt whose version history is empty |
| T8.6-B3 | market-data `restore.ts:38` instants are plain strings | `Temporal.Instant.compare` throws in section validation | it should report a malformed record for a Mark or acknowledgment with an unreadable time |
| T8.6-B4 | trade-record `restore.ts:99` a Superseded Deviation's quantities aren't tied to its form | a Superseded version with no quantity is accepted | it should reject a Deviation version whose quantity doesn't match its form |
| T8.6-B5 | journal `restore.ts:46` `obligationKey` accepts any string list | a malformed key is restored but can't be found | it should reject an obligation key that isn't a Daily Trade Review key |
| T8.6-B6 (Doubtful) | journal `restore.ts:143` a union field's MalformedRecord path names only `origin` | a coarse path | it should name the nested field in a malformed record's path |
| T8.6-B7 (Doubtful) | market-data `restore.ts:129` the recheck doesn't compare the section digest | an inconsistent recorded meta passes | it should report CandidateChanged when the recorded section digest differs |
| T8.6-B8 (Doubtful) | reference-catalog `restore.ts:138` the same for the Catalog | the same | it should report CandidateChanged when the recorded section digest differs |

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

**ocr review of `61fb47bb`** (session `883d0a2b-31d1-40e9-ae76-c7bfb94662de`, gpt-6.1-sol, 7 files, 6 findings; raw: `ocr/T8.13-61fb47bb.json`). Five were judged Valid and one Doubtful. Each becomes a bug task, run one at a time in lane UB. B2 and B3 wait for Q5 items 8 and 7, which hold their on-screen text.

| Bug task | Finding | Defect | `it should` case |
|---|---|---|---|
| T8.13-B1 | `RestoreFlow.tsx:93` a completed Restore clears only RestoreFlow's own state | BackupView keeps its old download, "Backup complete" and pending verification (A142 discards every pre-Restore view) | it should discard the Backup page's download and verification when a Restore completes |
| T8.13-B2 | `RestoreFlow.tsx:90` a rejected `applyPreparedRestore` leaves Replace disabled and the rejection unhandled | a stuck screen | it should show the unfinished-Restore message when the Restore fails unexpectedly |
| T8.13-B3 | `RestoreFlow.tsx:85` `prepareRestore` returning `RuntimeNotWritable` silently returns to Choose | no reason shown | it should show the readiness sentence when the backup can't be checked because the journal isn't writable |
| T8.13-B4 | `RestoreFlow.tsx:79` preparation isn't aborted when RestoreFlow unmounts | a preparation keeps running after the page is left | it should cancel the preparation when the Restore flow is left |
| T8.13-B5 | `RestoreConfirm.tsx:69` an unmounted SafetyBackup's pending verification can still set the parent's receipt | a stale receipt after switching choices | it should ignore a safety backup's verification that finishes after the choice was changed |
| T8.13-B6 (Doubtful) | `RestoreConfirm.tsx:132` nested ternary computing `safety` | hard to audit | a refactor under the existing cases (no new behavior) |

- **T8.13-B1** `683c16c2`.
  - Red: "expected <p class="backup-file-name"></p> to be null". Two earlier red rows came from an incomplete preview fixture and are noted in the log.
  - Fix: BackupView hands RestoreFlow a wrapped facade whose `applyPreparedRestore` clears the page's download, outcome, checking and not-made state on `Restored`. It also bumps `downloadCount`, so an in-flight verification is dropped. Frozen props are unchanged, and no screen text was added.
  - Lane tier: unit 165 / 1770, integration 106 / 229, checks 14 of 14.
  - ocr (session `a5249ae2-e892-42d0-b569-2c71fed516cd`, 2 files, 1 finding, Valid; raw: `ocr/T8.13-B1-683c16c2.json`). It becomes bug task **T8.13-B7**, queued in lane UB:
    - Finding: `BackupView.tsx:55` the Restored handler drops an in-flight verification but not an in-flight Download.
    - Defect: an export resolving after the Restore shows the old file name, or a failure, and `making` stays set.
    - Case: "it should discard a backup download that finishes after a Restore completes".
    - **T8.13-B4** `4481f8c1`: red ("expected false to be true") then green; a cleanup effect aborts the preparation on unmount. Lane tier: unit 165 / 1771, integration 106 / 229, checks 14 of 14. ocr (session `241c8c10-3750-4b00-aeb7-9819cfbcd158`, 2 files): **No findings.** Raw: `ocr/T8.13-B4-4481f8c1.json`.
    - **T8.13-B5** `f80bb5e5`: red ("expected false to be true": a late receipt enabled Replace) then green. A cleanup effect in `SafetyBackup` bumps `downloadCount` on unmount, so the existing guards drop the late result. T8.13-B1's three leftover suite-run files are in this commit. The log has no refactor row; the agent's append didn't land. Lane tier: unit 165 / 1772, integration 106 / 229, checks 14 of 14. ocr (session `9cf372c0-4cd6-4979-a292-eb6a69e0c3e1`, 2 files): **No findings.** Raw: `ocr/T8.13-B5-f80bb5e5.json`.
    - **T8.13-B7** `7af2b4bb`: red ("expected <p class="backup-file-name"></p> to be null") then green. `download()` records its download number and ignores a result or progress from before a Restore. The Restored handler also clears `making`, and the line-114 space is fixed. A `completeRestore` test helper is extracted. Lane tier: unit 165 / 1773, integration 106 / 229, checks 14 of 14. ocr (session `78b74485-8787-4ea2-bc8d-34b626d4d7ba`, 2 files): **No findings.** Raw: `ocr/T8.13-B7-7af2b4bb.json`.
    - **T8.13-B6** `cbbd20d5`: a structural refactor.
      - The nested ternary becomes `completedSafetyChoice(choice, receipt, declineAcknowledged)`.
      - Branch check: one gap, a receipt kept in memory while Replace without a backup is chosen. A characterization case covers it: "should not reuse a safety receipt for Replace without a backup after switching choices". It is a first-run pass, flagged. Mutation: dropping the `choice === 'BackUpFirst'` check gave "expected false to be true".
      - `src/ui/backup` tests: 26 passed before and after.
      - Lane tier: unit 165 / 1774, integration 106 / 229, checks 14 of 14.
      - ocr (session `ee81076e-a451-42d6-af53-ec2080e8c9a1`, 2 files): **No findings.** Raw: `ocr/T8.13-B6-cbbd20d5.json`.
    - Reviewer note: line 114 reads `facade={restoreFacade}selectFile={selectFile}` with no space. It is formatting only, and B7 may fix it in passing.

Reviewer notes, not ocr findings, so they are put to the user as Q5 items 9 and 10: "an ${kind}" reads "an Trade", and "(N versions)" repeats a kind's total on each row.

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

**ocr review of `321f4e62`** (session `c7a7574a-2cd8-4006-b8f0-2e340014f1ee`, gpt-6.1-sol, 3 files, 3 findings; raw: `ocr/T8.4-321f4e62.json`). Two were judged Valid and one Doubtful. Each becomes a bug task, run one at a time in lane WB:

| Bug task | Finding | Defect | `it should` case |
|---|---|---|---|
| T8.4-B1 | `backup.ts:59` export calls `inspectRoot`, which deletes listed candidates and other Workspace databases | an export destroys a prepared Restore candidate and writes to the root (against A128 and A129) | it should leave a listed Restore candidate in place when a backup is made |
| T8.4-B2 | `backup-export.ts:129` artifact building (projection, `writeRecord`, `finish`) is outside the error boundary | an unserializable record or a missing `settings` record rejects instead of returning `NotCompleted(Read, ReadFailed)` | it should report ReadFailed when a record can't be written into the backup |
| T8.4-B3 (Doubtful) | `backup.ts:85` a rejected offer, inspection or run escapes | a thrown error instead of a structured `NotCompleted` | it should report NotCompleted when the download offer rejects |

- **T8.4-B1** `2c3a170a`: two cases, both red then green.
  - Red 1: "expected [ 'tj-root', 'tj-ws-fx-0013' ] to include 'tj-ws-id-0001'", a listed candidate.
  - Red 2: a stray unlisted `tj-ws-stray` database was deleted.
  - The fix adds `lookupRoot(): Promise<RootInspection>` to `Persistence`. It classifies the root only, with no deletions, no root writes and no `current`. `inspectRoot` becomes `lookupRoot` plus the existing cleanup, and `exportBackup` calls `lookupRoot`. D2 and D3's persistence tests are unchanged.
  - Lane tier: unit 172 / 1785, integration 106 / 229, checks 14 of 14.
  - The tdd log has two extra green rows: an accidental whole-file prettier run was reverted and the edits redone. A refactor row notes it.
  - ocr (session `cc3a5917-5a67-46e4-92e6-966f06ec62e0`, 3 files, 1 finding, Valid; raw: `ocr/T8.4-B1-2c3a170a.json`). It becomes bug task **T8.4-B4**, queued after B3 in lane WB:
    - Finding: `persistence.ts:611` `lookupRoot` opens the root with `ROOT_VERSION` and `upgradeRoot`.
    - Defect: on a fresh browser with no `tj-root`, an export creates the root database and its stores before returning `NotCompleted`.
    - Case: "it should create no database when a backup is attempted before any journal exists".
- **T8.4-B2** `18b214ed`: two cases, both red then green.
  - Red 1: `CanonicalJsonUnsupported … at $.r.unsafe`, an unsafe integer.
  - Red 2: `CanonicalJsonUnsupported: … undefined at $.r.settingsRevision`, a missing `settings` record.
  - Fix: `runExport` moves artifact building into `buildArtifact` inside a try/catch that returns `Failed(ReadFailed)`. The time zone cast becomes a check.
  - A thrown `exporter.run` is left to B3.
  - The test name says "can not", because the apostrophe breaks `-t`.
  - Lane tier: unit 172 / 1787, integration 106 / 229, checks 14 of 14.
  - ocr (session `4c8e3310-ecf5-44c8-9dd4-7465690aabc0`, 2 files): **No findings.** Raw: `ocr/T8.4-B2-18b214ed.json`.
- **T8.4-B3** `068d5964`: three cases, each red then green.
  - Reds: `Error: offer blew up`, `Error: run blew up`, `Error: lookup blew up`.
  - Fix: a `.catch` on each port call routes it to the existing structured path. A rejected offer gives `OfferFailed` with the source binding. A rejected run gives `ReadFailed` with the described binding. A rejected lookup gives `ReadFailed` with a null binding.
  - Lane tier: unit 172 / 1790, integration 106 / 229, checks 14 of 14.
  - ocr (session `5290c016-0d70-48c0-9497-a1557112e6dd`, 2 files): **No findings.** Raw: `ocr/T8.4-B3-068d5964.json`.
- **T8.4-B4** `87f92560`: red ("expected [ { name: 'tj-root', version: 1 } ] to deeply equal []") then green.
  - Fix: `inspectRoot` and `lookupRoot` share a nested `classifyRoot(createRoot)`. A lookup aborts the root's first-creation upgrade and returns `NoWorkspace`. Startup still creates the root, and the VersionError handling is unchanged.
  - Lane tier: unit 172 / 1791, integration 106 / 229, checks 14 of 14.
  - ocr (session `c9fd1ef0-17cc-4dde-8164-a77433c3582a`, 2 files): **No findings.** Raw: `ocr/T8.4-B4-87f92560.json`.

## T8.5 confirmBackup and the receipt registry

Lane WB, commit `80999756`: the 3 planned cases, each red (`Error: not built`, the T8.23 stub throwing) then green. There were no first-run passes. Lane tier `T8.5`: unit 172 / 1794, integration 106 / 229, checks 14 of 14.

**Implementation-level choices (recorded, not stops).**
1. The registry is a `Set` in the `createBackupOperations` closure, so "this instance" is that closure. Receipt ids come from `deps.ids.next()`, `completedAt` from `deps.clock.now()`, and `lineCount` is the manifest's line number.
2. A private `verifyArtifact(file)` checks:
   - the header is line 1;
   - section digests and per-store counts against each section-end line;
   - the manifest's full and section digests against the recomputed values;
   - manifest counts against header counts;
   - the number of section-end lines.

   Record lines are counted from a regex on their trailing `,"s":…,"t":…}`, because the reader never parses them.
3. A failed read of the file's stream is flagged and gives `Unreadable`. Every other reader error gives `IncompleteOrCorrupt`.
4. `DifferentArtifact` means a self-consistent file whose full digest or source binding differs from the expected one.

**For T8.9:** `Workspace` doesn't expose `recognizesReceipt`; the registry case calls `createBackupOperations` directly. T8.9 surfaces it.

**Gap against A130, fixed by follow-up T8.5-F1 in lane WB:** a file that isn't UTF-8 comes out as `IncompleteOrCorrupt`, because T8.1's reader reports a decode failure as Corrupt. A130 says `Unreadable`. The fix brings the code to the plan, so it is not a deviation and not a question.

**ocr review of `80999756`** (session `f4410d6d-eeef-4f02-96ca-f1b80cc5cbd4`, gpt-6.1-sol, 2 files, 5 findings, all Valid; raw: `ocr/T8.5-80999756.json`).
- One finding (`backup.ts:136`, a file that isn't UTF-8) is T8.5-F1 itself.
- The other four become bug tasks, run one at a time in lane WB after F1:

| Bug task | Finding | Defect | `it should` case |
|---|---|---|---|
| T8.5-B1 | `backup.ts:115` only the number of section-end lines is compared with the header's sections | two endings for one section pass under a two-section header | it should return IncompleteOrCorrupt when a section ends twice and another never ends |
| T8.5-B2 | `backup.ts:57` the manifest's `formatVersion`, `schemaVersion`, footprint and exclusions aren't checked | a malformed manifest gives Completed (A123, A130) | it should return IncompleteOrCorrupt for a manifest missing a required field |
| T8.5-B3 | `backup.test.ts:359` the DifferentArtifact case changes the binding and the digest together | dropping either comparison stays green | it should return DifferentArtifact when only the full digest differs, and when only the source binding differs |
| T8.5-B4 | `backup.test.ts:349` R-cut and R-flip corrupt the gzip bytes, so they may never reach the count and digest checks | the checks inside `verifyArtifact` are untested | it should return IncompleteOrCorrupt for a well-compressed file whose section digest, counts or manifest digest don't match |

- **T8.5-F1** `1c0f8b40`: red ("expected { kind: 'NotVerified', …(1) } to deeply equal { kind: 'NotVerified', …(1) }", which was IncompleteOrCorrupt) then green.
  - The fix: `ArtifactReadError` gains an optional `reason: 'NotUtf8'`. The reader tags a failed UTF-8 decode, and `verifyArtifact` maps it to `Unreadable`. T8.1's reader tests are unchanged.
  - A non-gzip file is read as plain text (A130, "sniffing gzip"), which is unchanged.
  - A UTF-8 failure after the manifest stays plain `Corrupt`.
  - Lane tier: unit 172 / 1795, integration 106 / 229, checks 14 of 14.
  - ocr (session `573c9e26-39cf-4f72-bdaf-c2d9d4e984a2`, 4 files, 1 finding, Valid; raw: `ocr/T8.5-F1-1c0f8b40.json`). It becomes bug task **T8.5-B5**, queued after B4 in lane WB:
    - Finding: `reader.ts:101` the end-of-stream decode in `drain()` isn't tagged `NotUtf8`.
    - Defect: a valid artifact followed by a lone `0xC2` gives IncompleteOrCorrupt, not Unreadable.
    - Case: "it should return Unreadable when bytes after the manifest aren't UTF-8".
- **T8.5-B1** `25751806`: red (the duplicated section ending gave Completed) then green.
  - The fix is one check: the n-th section-end line must name `header.sections[n]`. That enforces membership, uniqueness and A123's section order, and the existing count check covers a missing ending.
  - The test reverses the header's sections to assert order too.
  - New test helpers: `canonical`, `EditableArtifact` and `editedArtifact(bytes, edit)`. The last one re-seals with the full digest recomputed, for B2–B5.
  - Lane tier: unit 172 / 1796, integration 106 / 229, checks 14 of 14.
  - ocr (session `69079bb9-d4e6-4b22-88cf-fd40cf332ae0`, 2 files, 2 findings; raw: `ocr/T8.5-B1-25751806.json`).
    - **Valid:** `backup.ts:110` the header may repeat a section name, so a forged file with a repeated name and a matching extra ending still verifies. It becomes bug task **T8.5-B6**, queued after B5, with the case "it should return IncompleteOrCorrupt for a header that names a section twice".
    - **Wrong, dismissed:** `backup.test.ts:36` "nested ternary prohibited". There is no such rule in CLAUDE.md, the repo docs or the ESLint config, and D7 dismissed the same claim.
- **T8.5-B2** `722be1a4`: red ("missing formatVersion: expected { Object (kind, receipt) } to deeply equal { kind: 'NotVerified', …(1) }") then green.
  - The fix: `manifestShape` now requires A123's fields: `formatVersion`, `schemaVersion`, `footprint`, `counts`, `exclusions`, `sectionDigests` and `fullDigest`.
  - T8.1 has no manifest schema, so the one in `backup.ts` was extended.
  - Not enforced, since A123 doesn't require it: the manifest's versions equal to the header's. `exportKind` stays optional.
  - Lane tier: unit 172 / 1797, integration 106 / 229, checks 14 of 14.
  - ocr (session `621d185b-0919-41b8-9fa2-d0fc1f7a61aa`, 2 files): **No findings.** Raw: `ocr/T8.5-B2-722be1a4.json`.
- **T8.5-B3** `03942ffd` (a test gap): **first-run pass, flagged**.
  - The case confirms one file against expectations that differ in one respect each: the full digest, the `databaseName`, then the `contentRevision`. A control first confirms the genuine expectations give Completed.
  - Mutations: removing each comparison in `confirmBackup` failed the case with "expected { Object (kind, receipt) } to deeply equal { kind: 'NotVerified', …(1) }". The `databaseName` mutation failed at `backup.test.ts:413` and the `contentRevision` one at `:416`; the digest assertion's line wasn't captured. After each restore, `git diff` on `backup.ts` was empty.
  - Lane tier: unit 172 / 1798, integration 106 / 229, checks 14 of 14.
  - ocr (session `716ff0b2-7cfa-445d-a556-55d90b8ebf62`, 1 file): **No findings.** Raw: `ocr/T8.5-B3-03942ffd.json`.
- **T8.5-B4** `ef7c907a` (a test gap): **first-run pass, flagged**.
  - The case has six re-sealed sub-files, each checked to still decompress and each isolated to one comparison, plus a control that gives Completed. The changes:
    - a record changed;
    - a section-end count changed;
    - a manifest section digest changed;
    - an extra manifest section digest;
    - manifest counts differing from the header's;
    - a record removed.
  - Mutations: removing each of the six comparisons in `verifyArtifact` failed its labelled assertion ("<label>: expected { Object (kind, receipt) } to deeply equal { kind: 'NotVerified', … }"). After each restore, `git diff` on `backup.ts` was empty.
  - One invalid red row (a fixture broke the `{"r":` prefix) is noted.
  - Lane tier: unit 172 / 1799, integration 106 / 229, checks 14 of 14.
  - ocr (session `38d5cc40-941c-4e48-b071-a114f06e87ed`, 1 file): **No findings.** Raw: `ocr/T8.5-B4-ef7c907a.json`.
- **T8.5-B5** `d13f7ba3`: red (IncompleteOrCorrupt where Unreadable was expected) then green.
  - The fix tags the end-of-stream decode in `drain()` with `NotUtf8`. T8.1's reader tests are unchanged.
  - Lane tier: unit 172 / 1800, integration 106 / 229, checks 14 of 14.
  - ocr (session `52a91c6e-dc8b-403a-9a45-9594b7b2d572`, 2 files): **No findings.** Raw: `ocr/T8.5-B5-d13f7ba3.json`.
- **T8.5-B6** `49a835a7`: red (the forged file gave Completed) then green.
  - The fix: `verifyArtifact` rejects a header whose sections repeat. A123 doesn't fix the set of section names, since it is built per schema from the export layout, so only uniqueness is enforced.
  - One invalid red row (the first fixture was caught by another check) is noted.
  - Lane tier: unit 172 / 1801, integration 106 / 229, checks 14 of 14.
  - ocr (session `b5db4865-eeda-4510-a783-b5cf2d12abbc`, 2 files): **No findings.** Raw: `ocr/T8.5-B6-49a835a7.json`.

**T8.5 is complete in lane WB** (F1 and B1–B6 done, every ocr clean).

## T8.10 Backup safe actions in status

Lane WB, commit `dd04561b`: the planned case, red ("expected { …(8) } to deeply equal ObjectContaining{…}", with no `backupActions`) then green. There were no first-run passes. Lane tier `T8.10`: unit 172 / 1802, integration 106 / 229, checks 14 of 14.

**Implementation-level choices.**
- No type changes. `getStatus` sets the frozen optional `backupActions`:

  | Status | `backupActions` |
  |---|---|
  | Recovery Only | `DownloadBackup`, `VerifyBackup` |
  | Migration Blocked | `DownloadCopy`, `VerifyBackup` |
  | IntegrityBlocked(AwaitingMigration) | `DownloadCopy` |
  | InitializationRequired | `RestoreFromBackup` |

- Every other status is untouched, including an unreadable root and Ready.
- `initialize` is unchanged: its results carry no status field, and the test reads the actions through `getStatus`.
- The states are built from the schema-5 fixture. Migration Blocked uses an unknown account, AwaitingMigration a failed `inventory` check, and the unreadable root a `tj-root` at version 99.

ocr (session `56a80a25-10d7-43e3-8868-39d5822315d7`, 2 files): **No findings.** Raw: `ocr/T8.10-dd04561b.json`.
  - **For T8.8:** `prepareRestore`'s reader path maps `reason === 'NotUtf8'` to its own unreadable outcome.

**T8.4 is complete in lane WB** (B1–B4 done, every ocr clean). It merges after merge-5 finishes. T8.5 started in lane WB from `87f92560` meanwhile; it is merged with T8.4 only if it's done by then, and otherwise T8.4 merges by fast-forward to `87f92560`.

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

- **merge-8** (T8.10 merged; at `d9792d0a`): unit 173 / 1810, integration 106 / 229, browser task tier (no changed path since `cd0eef57` is on the full-tier list) 5 passed, checks 14 of 14. Complete. Outputs `suite-runs/merge-8-*.txt`.

- **T8.10 merged** 2026-11-14: lane WB rebased onto `8963f210`; git dropped the already-merged commits, and T8.10 was fast-forwarded as `88640137`. Lane WB removed; it is recreated only if Q4 is answered (a) and T8.4-F1 is added.

- **merge-7** (T8.5 merged; at `cd0eef57`): unit 173 / 1809, integration 106 / 229, browser task tier (no changed path since `fe8b0e1a` is on the full-tier list) 5 passed, checks 14 of 14. Complete. Outputs `suite-runs/merge-7-*.txt`.

- **T8.5 merged** 2026-11-14: its eight commits (through `49a835a7`) were rebased in a temporary worktree onto `c849176e` and fast-forwarded (`663faaaa` … `07089243`). Git skipped T8.4's already-applied commits. The temporary worktree was removed. Lane WB continues with T8.10.

- **merge-6** (T8.4 merged; at `fe8b0e1a`): unit 173 / 1799, integration 106 / 229, browser full tier (first matching path since `16e72bf5`: `src/persistence/persistence.ts`) browser-1 126 passed, browser-2 98 passed, checks 14 of 14. Complete. Outputs `suite-runs/merge-6-*.txt`.

- **T8.4 merged** 2026-11-14, after merge-5. Lane WB stays busy with T8.5, so T8.4's five commits (through `87f92560`) were rebased in a temporary worktree onto `80adffb4` and fast-forwarded (`92301ec3` … `0fa1b021`). The temporary worktree and branch were removed. Lane WB rebases later, and git drops the already-applied commits.

- **merge-5** (T8.7 merged; source at `16e72bf5`): the stage headers show later HEADs, but `git diff 16e72bf5 8773b371 -- src tests e2e tools package.json` is empty, since only plan and evidence commits landed.
  - unit 172 / 1786;
  - integration 106 / 229;
  - browser full tier (first matching path since `ac58669b`: `src/persistence/persistence.ts`): browser-1 126 passed, browser-2 98 passed;
  - checks 14 of 14.

  Complete. Outputs `suite-runs/merge-5-*.txt`.
- **T8.7 merged** 2026-11-14: lane PS rebased onto `9c569bfa` and fast-forwarded (`8f98613d` … `6bbb2ffc`). Lane removed.

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

## Results after the user's answers to Q4–Q7 (2026-11-14)

- **T8.6-B1** `9d6d78b4`: red ("expected { kind: 'Parsed', … } to deeply equal { kind: 'Rejected', … }") then green.
  - Fix: Trade Record's `decimal` and `instant` schema constants are refined with the domain's `parseDecimal` and `Temporal.Instant.from` (try/catch). The Option `expiration`, a date, stays a string.
  - Lane tier: unit 175 / 1794, integration 106 / 229, checks 14 of 14.
  - ocr (session `810f728d-4cdf-4c61-99fe-f84b2f3b6d31`): **No findings.** Raw: `ocr/T8.6-B1-9d6d78b4.json`.
- **T8.6-B2** `1e664274`: red ("expected [] to deeply equal [ { …(2) }, { …(2) } ]") then green.
  - Fix: the Journal section validator reports an Entry or Debt with empty `versions` (declines too, through the same loop). The Journal design states no numbering rule, so only the empty case is covered.
  - It reused `VersionChainBroken`, whose sentence names a Trade fact. That was put to the user as Q7, answered (a): T8.6-F2 adds a Journal-only code.
  - Lane tier: unit 175 / 1795, integration 106 / 229, checks 14 of 14.
  - ocr (session `e642d7c8-d4c1-4f5c-9dad-6fe785b01462`): **No findings.** Raw: `ocr/T8.6-B2-1e664274.json`.
- **T8.6-B3** `f4669531`: red ("expected 'Parsed' to be 'Rejected'") then green.
  - Fix: Market Data's `instant` constant is refined, covering four time fields.
  - Mark `price` stays a string (choice): section validation already reports `InvalidPrice` and `PriceNegative` without throwing (A37).
  - Agent note, not a bug task under the review rule: `journal/restore.ts`'s `instant` is still a plain string.
  - Lane tier: unit 175 / 1796, integration 106 / 229, checks 14 of 14.
  - ocr (session `3d16b0ee-3395-4a19-9631-1f181b762f56`): **No findings.** Raw: `ocr/T8.6-B3-f4669531.json`.
- **T8.3-F1** `c780cffb` (lane PS, recreated at `2139a827`; Q4 (a)): red ("expected [ 'batch:catalog', …(1) ] to deeply equal [ 'start', 'batch:catalog', …(1) ]") then green.
  - `readExportSnapshot(..., onBatch, onStart?)` calls `onStart({ binding, meta, counts })` synchronously, once, inside the snapshot, before the first batch. `ExportStart` is exported, and the final result is unchanged.
  - Lane tier: unit 173 / 1811, integration 106 / 229, checks 14 of 14.
  - ocr pending.
- **T8.4-F2** `c4ca7f23` (lane WB, recreated at `2139a827`; Q5 logging): three cases, each red then green.
  - New `FailureDetail { stage, name, message, stack?, context? }` in `backup-types.ts`, and an optional `detail` on the export's `NotCompleted`. `describeError(stage, error, context?)` lives in `backup-export.ts`, and `runExport`'s `Failed` carries `detail`.
  - Eight existing NotCompleted assertions gained a `detail` expectation, with no behavior change.
  - Lane tier: unit 173 / 1813, integration 106 / 229, checks 14 of 14.
  - ocr pending.
- **T8.13-B2** `51a27154`: two cases, each red then green.
  - Red 1: the unfinished-Restore sentence wasn't found.
  - Red 2: "expected "error" to be called 1 times, but got 0 times".
  - The apply rejection is caught, `applying` is reset, and the approved sentence shows with Reload (`window.location.reload()`, since there's no prop to reach the shell's helper).
  - `dev-log.ts` `logFailure(detail)` writes `console.error('[Trade Journal]', detail)`. Its local `FailureDetail` is swapped for the shared one at merge.
  - Lane tier: unit 165 / 1776, integration 106 / 229, checks 14 of 14.
  - ocr (session `7bef964e-1aa4-4350-b1d6-d3643d1763a1`): **No findings.** Raw: `ocr/T8.13-B2-51a27154.json`.
- **T8.3-F1 ocr** (session `e0f64d40-eb2f-4297-be33-9bc59fcd548e`, 4 files, 1 finding, Valid; raw: `ocr/T8.3-F1-c780cffb.json`). It becomes bug task **T8.3-B6** in lane PS:
  - Finding: `export-snapshot.ts:164` `onStart` has no thenable guard like `onBatch`'s.
  - Defect: an async `onStart` is accepted, so batches run before its work finishes and a rejection goes unhandled.
  - Case: "it should end the snapshot with EarlyAutoCommitGuard when onStart returns a promise".
- **T8.4-F2 ocr** (session `2a04ad6c-189a-4fee-af02-2b71657e605f`, 4 files, 2 findings, both Valid; raw: `ocr/T8.4-F2-c4ca7f23.json`). They become bug tasks in lane WB, after T8.5-F2:

| Bug task | Finding | Defect | `it should` case |
|---|---|---|---|
| T8.4-B5 | `backup-export.ts:47` `describeError` copies the raw message and stack, and `CanonicalJsonUnsupported` embeds the rejected value | a stored value, such as a price, reaches the developer log, against Q5's "no journal contents" | it should leave record values out of the failure detail when a record can't be written |
| T8.4-B6 | `backup-export.ts:47` `String(x)` in `describeError` can throw for a non-Error rejection | `exportBackup` rejects instead of returning NotCompleted | it should return NotCompleted when the rejection value can't be converted to text |
- **T8.6-F2** `98bc98ac` (Q7 (a)): red (the case still got `VersionChainBroken`) then green.
  - The Journal issue is now `JournalVersionsMissing { code, id }`, with Q7's sentence in `readiness-copy.ts`. `VersionChainBroken` is Trade Record's only.
  - Declines are stored without `versions`, so they aren't reported in normal use.
  - Lane tier: unit 175 / 1796, integration 106 / 229, checks 14 of 14.
  - ocr pending. T8.6-B4 has started.
- **T8.13-B3** `f8852957`: two cases, each red then green.
  - Red 1: the readiness sentence wasn't found.
  - Red 2: "expected "error" to be called 1 times, but got 0 times".
  - `RuntimeNotWritable` from `prepareRestore` gets its own `CannotCheck` phase: the failed checks' readiness sentences (`explainFailure`, as on the apply side) and Choose backup file. It logs stage `'Prepare'`, with the failed checks as one `check:reason` string in `context`. Only `Cancelled` returns to Choose.
  - Lane tier: unit 165 / 1778, integration 106 / 229, checks 14 of 14.
  - ocr pending.
- **Split of the UI logging:** T8.13-F1 (started) covers Q5 items 3, 4, 6, 9 and 10, plus logging for Restore prepare failures, with the local `FailureDetail`. The Backup page's logging (T8.12-F1) waits for lane WB's merge of the shared `FailureDetail` and the `detail` fields.
- **ocr of T8.6-F2** `98bc98ac`: no findings (3 files reviewed). Raw: `ocr/T8.6-F2-98bc98ac.json`.
- **ocr of T8.13-B3** `f8852957`: no findings (2 files reviewed). Raw: `ocr/T8.13-B3-f8852957.json`.
- **T8.3-B6** `2a41fdab` (lane PS): one case, red then green.
  - Red: "expected { kind: 'Read', …(4) } to deeply equal { kind: 'EarlyAutoCommitGuard' }".
  - A shared `guardAsync` helper now covers both `onBatch` and `onStart`. It does the thenable check, absorbs a later rejection, and fails with `EarlyAutoCommitGuard`. A tripped `onStart` returns before the first read.
  - Lane tier: unit 173 / 1812, integration 106 / 229, checks 14 of 14.
  - ocr pending.
- **ocr of T8.3-B6** `2a41fdab`: no findings (2 files reviewed). Raw: `ocr/T8.3-B6-2a41fdab.json`. T8.3-F1 and B6 are ready to merge.
- **T8.5-F2** `951ef5be` (lane WB): three cases, each red then green.
  - All three reds read "expected { kind: 'NotVerified', …(1) } to deeply equal { kind: 'NotVerified', …(2) }", because `detail` was missing.
  - `NotVerified` now carries a `detail` with stage `'Verify'`. Its `context` names the check, section and line, never values. `DifferentArtifact` names only the comparison that differs.
  - A new `thrownCheck` helper gives a fixed message plus the error's name. It doesn't use `describeError`, and no raw message or stack is copied.
  - Added assertions: an edited record line and the stream error's message must not appear in the detail.
  - Deviations:
    - Eleven existing `NotVerified` cases now expect `detail: detailLike({ stage: 'Verify' })`.
    - `confirmBackup`'s `NotVerified` type gained the optional `detail`.
    - Two test names were reworded because their apostrophes broke `-t` filtering.
  - Lane tier: unit 173 / 1816, integration 106 / 229, checks 14 of 14.
  - ocr pending.
- **T8.6-B4** `80e0e9b8` (lane FM): one case, red then green.
  - Red: "expected { kind: 'Parsed', …(1) } to deeply equal { kind: 'Rejected', …(1) }".
  - The first green run failed because the test expected the quantity leaf path, while the union reports the version path `deviations.0.versions.0`. The test was corrected and the second green passed.
  - A Superseded Deviation version is now two strict variants: Excess with `quantityAbovePlan`, and Shortfall with `quantityBelowPlan`.
  - Lane tier: unit 1796 of 1797. The one failure is `tools/wording-rules.test.ts`, which timed out at 5s under load; it passes alone (37 of 37) and is unrelated. Integration 229 / 229, checks 14 of 14.
  - The lane tier is not fully green. FM's next task run (T8.6-B5) has to show the unit tier green.
  - ocr pending.
- **ocr of T8.6-B4** `80e0e9b8`: no findings (2 files reviewed). Raw: `ocr/T8.6-B4-80e0e9b8.json`.
- **ocr of T8.5-F2** `951ef5be`: three findings, all assessed Valid. Raw: `ocr/T8.5-F2-951ef5be.json`. The run had no background file; the reviewer read A123 and the T8.5 rows directly. Bug tasks for lane WB, queued after T8.4-B6:

| Task | Location | Defect | Case |
|---|---|---|---|
| T8.5-B7 | `backup.ts:132` | `context.section` copies a section name from the file's own header, which is untrusted, so a tampered file can put any text in the developer log | it should name only a known section in the failure detail |
| T8.5-B8 | `backup.ts:157` | a read failure after the first chunk arrives wrapped as `ArtifactReadError('Corrupt')`, so the original error's name is lost | it should keep the original read error's name in the failure detail |
| T8.5-B9 | `backup.ts:242` | the nested ternary for `differing` is hard to read; a structural change with no visible effect | refactor; the DifferentArtifact cases stay green |

- **T8.13-F1** `2af18650` (lane UB): six cases, each red then green, plus one refactor row for item 6.
  - Red lines:
    - item 3: "Unable to find an element with the text: A record in the trades section didn't pass a check (PriceNegative)."
    - Rejected logging: "expected "error" to be called 1 times, but got 0 times"
    - item 4 message: "Unable to find … The backup couldn't be checked. Your current journal is unchanged."
    - item 4 log: "Unable to find … /couldn't be checked/"
    - item 9: "Unable to find … A record refers to a Trade that isn't in the backup (t-1)."
    - item 10: "Unable to find an accessible element with the role "rowheader" and name "Trades""
  - Item 6 exports `ACKNOWLEDGED_UNAVAILABLE_COUNT_LABEL` from `calculation-words.ts`. `verify:wording` passes.
  - A `Rejected` prepare result logs "The backup was rejected." Its `context` holds the issue count and the first issue's code, section, line and path. An unexpected throw logs the error's name, message and stack.
  - Deviation, item 10: A5 has no Trades total line and no single Journal entries row. Two summing rows were added, "Trades" and "Journal entries", each carrying "(N versions)". The per-type rows no longer show versions, so `debts` versions show nowhere. This went to the user as Q8.
  - Lane tier: unit 165 / 1784, integration 106 / 229, checks 14 of 14.
  - ocr pending.
- **T8.4-B5** `b40875a5` (lane WB): one case, red then green, plus a refactor row.
  - Red: "expected '{"stage":"Build","name":"CanonicalJso…' not to contain '7654321'".
  - The fix is at the source. The unsafe-number message in `canonical-json.ts` now reads "a number that is not a safe integer", with no value. That covers the message and the stack's first line, and it matches the other `CanonicalJsonUnsupported` messages, which give only a type or path.
  - `describeError` is unchanged, because other errors keep their message and stack. Paths can hold field names, but never values.
  - Lane tier: unit 173 / 1817, integration 106 / 229, checks 14 of 14.
  - ocr pending.
- **T8.6-B5** `4e6d7450` (lane FM): one case, red then green.
  - Red: "expected { kind: 'Parsed', records: [ …(32) ] } to deeply equal { kind: 'Rejected', …(1) }".
  - The first green run failed because the test's own fixture precondition was wrong. The precondition was removed, and the second green passed.
  - An array `obligationKey` must be `['DailyTradeReview', reviewDate, tradeId]` (D4 A38; built by `keyOf` in `journal.ts`). String keys for the other obligation kinds are still accepted as any string.
  - Lane tier: unit 175 / 1798, all green, so B4's wording-rules timeout did not recur. Integration 106 / 229, checks 14 of 14.
  - ocr pending.
- **ocr of T8.13-F1** `2af18650`: one finding, assessed Doubtful. Raw: `ocr/T8.13-F1-2af18650.json`.

| Task | Location | Defect | Case |
|---|---|---|---|
| T8.13-B8 (Doubtful) | `RestoreFlow.tsx:91-92` | the unexpected-prepare-failure log copies the raw error message and stack; a message that quotes backup text would put journal contents in the developer log | it should keep backup text out of the log when checking the backup throws |

  - The reviewer found no current throw site that builds a message from record values. The finding conflicts with Q5's approved log contents, which include "the message" and "the stack". The fix therefore waits for the user (Q9).
  - Reviewer note, not a bug task: the Apply-failure log from T8.13-B2 copies the message and stack the same way. It is included in Q9.
- **ocr of T8.4-B5** `b40875a5`: no findings (2 files reviewed). Raw: `ocr/T8.4-B5-b40875a5.json`.
  - Reviewer note, not a bug task: the message's `at $.<key>` path is built from object keys. Any record keyed by user-entered text would leak that text. This is added to Q9.
- **ocr of T8.6-B5** `4e6d7450`: no findings (2 files reviewed). Raw: `ocr/T8.6-B5-4e6d7450.json`.
- **T8.6-B6** `12818ce4` (lane FM; amended from `44f864b2` to rename the test): one case, red then green.
  - Red: "expected { kind: 'Rejected', …(1) } to deeply equal { kind: 'Rejected', …(1) }". The path was `origin` instead of `origin.reviewDate`.
  - The fix is `pathsOf` in journal `restore.ts`. For a union issue, when exactly one branch has the matching `kind`, the path follows into that branch. Otherwise it stays at the union field, so B5's `obligationKey` path is unchanged.
  - Not covered: an extra key inside the matched branch is reported at `origin`.
  - The test was renamed after green, to "should name the nested field in the path of a malformed record". The renamed case passed with `-t`. The red was not rerun.
  - Lane tier: unit 175 / 1799, integration 106 / 229, checks 14 of 14.
  - ocr pending.
- **T8.6-B7 and T8.6-B8: dismissed as Wrong.** The B7 task stopped before red, with no commit and the worktree unchanged.
  - A candidate's section `digest` is `sha256Hex(STORE + ' ' + storeDigest + '\n')` (`measureCandidateSection`), a pure function of the store digests.
  - All four recheck steps compare counts and `storeDigests`: market-data `restore.ts:129`, trade-record `:177`, journal `:206` and reference-catalog `:138`. Journal records the reason in a comment: "The section digest is the store digests' digest, so comparing the stores covers it."
  - Workspace records the meta straight from `measureCandidateSection`. A134 and A135 step 4 ask only for a counts-and-digest recheck, and the store digests cover that.
  - Lane FM has no tasks left after B6's ocr, so T8.6 is ready to merge once that review is clean.
- **ocr of T8.6-B6** `12818ce4`: no findings (2 files reviewed). Raw: `ocr/T8.6-B6-12818ce4.json`. T8.6, with F12, F2 and B1–B6, is ready to merge. The merge waits for merge-9 to finish, so the running suite's tree stays fixed.
- **merge-9** (T8.3-F1 and B6 merged; source `53f7ed98`): all green, run complete.
  - Unit 173 / 1812, integration 106 / 229, checks 14 of 14.
  - Browser: the full tier ran, because `src/persistence/export-snapshot.ts` changed since `d9792d0a`. 126 + 98 passed.
  - HEAD moved to `3192f6c8`, an evidence-only commit, before the checks stage.
  - Outputs: `suite-runs/merge-9-*.txt`.
- **T8.4-B6** `b69261ad` (lane WB): one case, red then green.
  - Red: "TypeError: Cannot convert object to primitive value". `exportBackup` itself rejected.
  - The fix is a private `textOf` that guards `String(value)`, falling back to the fixed message "The failure value could not be shown". The test also asserts that a throwing `toString`'s text never appears.
  - Deviation: lint forbids `Promise.reject(nonError)`. The test casts with `as Error` and explains the cast in a comment, recorded as a refactor-row note.
  - Lane tier: unit 173 / 1818, integration 106 / 229, checks 14 of 14.
  - ocr pending.
- **ocr of T8.4-B6** `b69261ad`: no findings (2 files reviewed). Raw: `ocr/T8.4-B6-b69261ad.json`.
  - Brief error: the main session's briefs for T8.4-B5 and B6 cited "A121" for `exportBackup`. The D8 plan has no such anchor; A121 is D7's. The right anchors are A129, A145 and A147. Neither review depended on the anchor.
- **Early merge of lane WB planned:** T8.4-F2, T8.5-F2, T8.4-B5 and T8.4-B6 bring the shared `FailureDetail` that T8.8 needs. The merge waits for merge-10 to finish and uses a temporary rebase worktree while T8.5-B7 runs in the lane.
- **T8.5-B7** `c12ec3ab` (lane WB): one case, red then green.
  - Red: "expected '{"stage":"Verify","name":"SectionEndM…' not to contain 'DISTINCTIVE'".
  - `backup-export.ts` exports `KNOWN_SECTIONS`, built from `'workspace'` plus `SECTION_OF_STORE`'s values. `context.section` is the header's name only when it is a known section; otherwise it is the word `'unknown'`. This covers SectionEndMismatch, SectionDigestMismatch and CountsMismatch.
  - Lane tier: unit 173 / 1819, integration 106 / 229, checks 14 of 14.
  - ocr pending.
- **ocr of T8.5-B7** `c12ec3ab`: no findings (3 files reviewed). Raw: `ocr/T8.5-B7-c12ec3ab.json`. The early WB merge now includes T8.5-B7 as well.
- **T8.5-B8** `e9300795` (lane WB): one case, red then green.
  - Red: "expected { kind: 'NotVerified', …(2) } to deeply equal { kind: 'NotVerified', …(2) }". The name was `ArtifactReadError` instead of `NotReadableError`.
  - `ArtifactReadError` now takes an optional `{ cause }`. The reader's two read-failure wraps pass it, and `verifyArtifact` gives the cause to `thrownCheck`. The original name lands in `detail.name`. The message is never recorded, and the test asserts that.
  - Lane tier: unit 173 / 1820, integration 106 / 229, checks 14 of 14.
  - ocr pending.
- **Q8 answered (a+).** T8.13-F2 (lane UB, started) adds the "Reflections owed" total row with "(N versions)".
- **Q9 answered (a).** T8.13-B8 is closed with no change: the message and stack are kept as the user decided. The Apply-log reviewer note and the export path-key note are covered by the same answer.
- **ocr of T8.5-B8** `e9300795`: no findings (4 files reviewed). Raw: `ocr/T8.5-B8-e9300795.json`.
  - Reviewer note: the `ArtifactReadError` message still embeds the original message. Q9's answer (a) covers it.
- **T8.13-F2** `5801662e` (lane UB), carrying out Q8 (a+): one case, red then green.
  - Red: "Unable to find an accessible element with the role "rowheader" and name "Reflections owed"".
  - The first green run failed on the test's own expectation for the current column. The expectation was fixed with no code change, and the next green passed.
  - A "Reflections owed" total row now sits above the status rows, with "(N versions)" from `versions.debts`. The Restore complete summary shows it too.
  - T8.13-F1's item 10 case now counts 3 "versions" mentions.
  - Lane tier: unit 165 / 1785, integration 106 / 229, checks 14 of 14.
  - ocr pending.
- **ocr of T8.13-F2** `5801662e`: no findings (2 files reviewed). Raw: `ocr/T8.13-F2-5801662e.json`. Lane UB's next task is T8.12-F1, the Backup page's logging, once lane WB merges.
- **T8.5-B9** `bb0c65d9` (lane WB): a refactor with no red case.
  - `differing` is now chosen with `find` over an ordered `comparisons` list. The DifferentArtifact cases ran with `-t`: 2 passed before and 2 passed after, and they cover all three comparisons.
  - Lane tier: unit 173 / 1820, integration 106 / 229, checks 14 of 14.
  - ocr pending.
  - T8.4-F1 needs T8.3-F1's `onStart`, which is on main but not in lane WB (recreated at `2139a827`). So T8.4-F1 starts after the WB merge rebases the lane onto main.
- **ocr of T8.5-B9** `bb0c65d9`: no findings (1 file reviewed). Raw: `ocr/T8.5-B9-bb0c65d9.json`. Lane WB is now idle and ready to merge: T8.4-F2, B5 and B6, plus T8.5-F2 and B7 to B9. The merge waits for merge-10.
- **merge-10** (T8.6 merged; source `f087b459`): all green, run complete.
  - Unit 177 / 1833, integration 106 / 229, checks 14 of 14.
  - Browser: the full tier ran, because `src/ui/readiness-copy.ts` changed since `53f7ed98`. 126 + 98 passed.
  - Outputs: `suite-runs/merge-10-*.txt`.
- **Lane WB merged early** (fast-forward after rebase): T8.4-F2 `07aec112`, B5 `74b4787f`, B6 `a596b38a`; T8.5-F2 `9021f4b2`, B7 `e719dea7`, B8 `c1ff6657`, B9 `a15cb91c`. Progress updated (`89b64a80`). Lane UB was rebased onto main (head `bf0b5f73`) so T8.12-F1 can use the shared `FailureDetail`.
- **T8.8 dispatched:** lane WR is the worktree `.claude/worktrees/d08-wr` on branch `d08/wr` from `89b64a80`. T8.4-F1 (lane WB) and T8.12-F1 (lane UB) dispatched as well.
- **Lanes FM and PS removed** after their merges (worktrees and branches `d08/fm`, `d08/ps`).
- **merge-11** (lane WB's follow-ups merged; source `a2ccf117`): all green, run complete.
  - Unit 177 / 1843, integration 106 / 229, checks 14 of 14.
  - Browser: the task tier ran, since no changed path since `f087b459` is on the full-tier list. 5 passed.
  - Outputs: `suite-runs/merge-11-*.txt`.
- **T8.4-F1** `c15f7404` (lane WB; Q4 (a)): one case, red then green.
  - Red: "expected 0 to be greater than 0". A `writeRecord` spy saw nothing written when the first batch arrived.
  - `onStart` writes the header, the Workspace records and the Workspace section end. Each `onBatch` projects and writes straight into `ArtifactWriter`, which was already incremental; `src/backup/format` is untouched. Both callbacks are synchronous.
  - A throw in a callback is remembered, stops the read, and is reported at stage Build.
  - Memory held: the gzip output chunks, one batch at a time, plus counts, footprint ids and meta records. No projected batch is kept.
  - Notes, not deviations:
    - The Conflict check still runs after the whole read, so a conflicting export does the full work before it is discarded.
    - Three test wrappers now forward `onStart`.
  - Lane tier: unit 177 / 1844, integration 106 / 229, checks 14 of 14.
  - ocr pending.
- **T8.12-F1** `64091bbc` (lane UB, Q5 logging): four cases, each red then green, plus one refactor row.
  - All reds read "expected "error" to be called 1 times, but got 0 times".
  - Refactor row: `dev-log.ts` uses the shared `FailureDetail`, imported through `src/app/types.ts`, because `lint:deps` forbids importing `backup-types.ts` directly. The four RestoreFlow log cases stayed green before and after.
  - Cases:
    - `NotCompleted` and `NotVerified` with a `detail` log one line.
    - A rejecting `exportBackup` or `confirmBackup` logs stage Build or Verify, with the name, message and stack.
    - Extra case: a failed result without a `detail` logs the stage and reason, with "The result carried no detail.". Conflict is not a failure and writes no line.
  - Deviation: one-line type re-exports added outside `src/ui/backup/`, in `src/app/types.ts` and `src/coordinators/workspace/index.ts`. T8.8 (lane WR) also edits `src/app/types.ts`; reconcile at merge.
  - Early green rows for cases 4 and 5 exited 1 because of the test's own bugs: the button label after a failure, and spies not restored. Production code was unchanged between those rows.
  - Lane tier: unit 179 / 1882, integration 106 / 229, checks 14 of 14.
  - ocr pending.
- **ocr of T8.12-F1** `64091bbc`: one finding, assessed Valid. Raw: `ocr/T8.12-F1-64091bbc.json`.

| Task | Location | Defect | Case |
|---|---|---|---|
| T8.12-B6 (first briefed as B1 in error; that ID belongs to `5e11ab01`'s task) | `BackupView.tsx:62` | the stale-result guards in `download` and `verify` return before `logFailure`, so a failure that arrives after a Restore or a newer download is never logged | it should log a failure that arrives after a newer download has started |

  - Brief error: the brief cited A140 for the Backup page; A141 is the right row.
- **ocr of T8.4-F1** `c15f7404`: three findings: one Valid, two Doubtful. Raw: `ocr/T8.4-F1-c15f7404.json`. Bug tasks for lane WB, one at a time:

| Task | Location | Defect | Case |
|---|---|---|---|
| T8.4-B7 | `backup-export.ts:168` | `expectedBinding` is compared only after the whole read. A stale binding still builds and compresses everything, and a build error on the way returns Failed instead of Conflict | it should return Conflict before writing any record when the binding differs |
| T8.4-B8 (Doubtful) | `backup.test.ts:342` | the test wrapper discards `onBatch`'s return value, which would hide an async callback from `EarlyAutoCommitGuard` | test-only change: the wrapper forwards the return value |
| T8.4-B9 (Doubtful) | `backup.test.ts:354` | the streaming assertion only checks that the write count rises between deliveries | test-only change: assert the full interleaving of reads and writes |

  - Reviewer note, not a bug task: `guarded` in `runExport` discards its step's return value, so a future async step would slip past the guard. Today's steps are synchronous.
- **T8.4-B7** `1cf3e645` (lane WB): one case, red then green.
  - Red: "expected "writeRecord" to not be called at all, but actually been called 103 times".
  - The binding is now compared first in the guarded `onStart`. On a mismatch it remembers the binding and throws, which stops the read before the header. `Conflict` is returned ahead of the failure checks, and the old after-read comparison is removed.
  - Lane tier: unit 177 / 1845, integration 106 / 229, checks 14 of 14.
  - ocr pending.
- **T8.12-B6** `d71709b7` (lane UB; amended from `e25ebf8b`, first committed as "T8.12-B1"): two cases, each red then green.
  - Both reds read "expected "error" to be called 1 times, but got 0 times".
  - `logFailure` now runs before the stale guards in `download` and `verify`. The state updates stay behind them.
  - Download is disabled while a backup is being made, so a stale download comes only from a Restore. The case was therefore split into download-after-Restore and verify-after-newer-download.
  - The amend restored `T8.12-B1`'s tdd log and suite runs to their `64091bbc` content, and moved this task's rows to `tdd-log/T8.12-B6.md`. Its suite-run files were copied from the same run, not rerun.
  - Lane tier: unit 179 / 1884, integration 106 / 229, checks 14 of 14.
  - ocr pending.
- **ocr of T8.4-B7** `1cf3e645`: no findings (2 files reviewed). Raw: `ocr/T8.4-B7-1cf3e645.json`.
- **ocr of T8.12-B6** `d71709b7`: no findings (2 files reviewed). Raw: `ocr/T8.12-B6-d71709b7.json`. The reviewer confirmed the amended commit holds only the B6 evidence; the B1 files equal `64091bbc`.
- **Lane UB ready to merge:** T8.12 and T8.13, with all their follow-ups and bug tasks, have clean reviews. They merge now, because the plan lets a UI lane merge before the backend. Item 2's repair sentences wait for T8.8's `tradeSummary`, as follow-up T8.13-F3 in lane UB.
- **T8.4-B8** `94e4132b` (lane WB): a test-only refactor. The streaming test's wrapper now returns `onBatch(batch)`; the other wrappers already did. `backup.test.ts` passed 35 of 35 before and after.
  - Lane tier: unit 177 / 1845, integration 106 / 229, checks 14 of 14.
  - ocr pending.
- **ocr of T8.4-B8** `94e4132b`: no findings (1 file reviewed). Raw: `ocr/T8.4-B8-94e4132b.json`.
- **T8.4-B9** `1337ecfd` (lane WB): a test-only change, flagged as a first-run pass with a mutation check.
  - The streaming test now records the cumulative write count when each batch arrives and right after it is handled. The count at batch N+1's arrival must equal the count after batch N, and the final count must equal the count after the last batch.
  - The mutation wrote only the first record of each batch and buffered the rest until the section closed. It failed with "expected 103 to be 43", while the old assertion still passed under it. The mutation was reverted.
  - Lane tier: unit 177 / 1845, integration 106 / 229, checks 14 of 14.
  - ocr pending.
- **T8.8** `e0d1b5ea` (lane WR): ten cases, eight planned and two added (NotUtf8, failure detail), each red then green with no first-run passes. The tdd log has each red line.
  - The InsufficientCapacity case's first green failed because the test left too much free space. The test was fixed with no production change.
  - Choices made:
    - `RestoreRepair.tradeSummary` is `{ underlying, summary: TradeSummary }`, from the domain's `plannedTradeSummary`. T8.13-F3 renders it with the UI's `tradeName`, because coordinators may not import UI.
    - Repair kinds are `Lifecycle` and `EntrySizeDeviation`. A missing Entry Size deviation has stored `None`.
    - NotUtf8 maps to `UnsupportedFormat`. Other reader errors (Truncated, Corrupt) map to `IncompleteArtifact`.
    - `Rejected` and `Cancelled` gain `detail?` (stage Prepare). A Rejected detail carries the first issue's code, section, line and path, plus the total.
    - An unexpected failure becomes `Rejected` with no issues and a `detail` from `describeError`, and its candidate is deleted. The frozen union has no other failure kind. T8.13-F3 must show Q5 item 4's sentence for "no issues and a detail".
    - The candidate meta holds `restorePrepared` with each section's whole `measureCandidateSection` result.
    - `RestoreDeps` gained `sessionPolicy`, which `WorkspaceDeps` already has; `workspace.ts` is unchanged.
  - Deviation: the type additions went into `src/coordinators/workspace/backup-types.ts`, where the frozen types live, not into `src/app/types.ts`, which only re-exports them.
  - Lane tier: unit 178 / 1853, integration 106 / 229, checks 14 of 14.
  - Agent notes, not bug tasks. Each goes to the user after T8.8's ocr unless ocr raises it:
    1. `prepareJournalSeed` compares prompts with `JSON.stringify`, which depends on key order. A7 was reported as a seed conflict, and `restore.ts` works around it. The same mismatch probably hits `journal.seedDefaults` at the next `initialize` of a restored Workspace. The root fix is in `journal.ts`.
    2. `Cancelled` and the abort signal are not built; the plan has no case.
    3. `UnsupportedDataCapability` (A3's sentence) is never produced; the footprint check reports `ManifestMismatch`.
    4. Artifacts of schemas 1 and 2 would be rejected, because T8.6's strict parser requires `workspace.sessionPolicy`.
    5. A Trade naming an unknown Strategy is not reported.
    6. The `restorePrepared` meta record survives into the live database after activation. T8.9 may delete it.
  - ocr pending.
- **ocr of T8.4-B9** `1337ecfd`: one finding, assessed Valid. Raw: `ocr/T8.4-B9-1337ecfd.json`.

| Task | Location | Defect | Case |
|---|---|---|---|
| T8.4-B10 | `backup.test.ts:360-361` | the new equalities only show that nothing is written outside the delivery callbacks. Writing nothing at all, or buffering every batch until the last callback, still passes, because B9 dropped the strict-increase check | test-only change: each `onBatch` raises the write count by exactly that batch's record count |
- **ocr of T8.8** `e0d1b5ea`: **did not run**. The ChatGPT provider rejected all 4 file reviews with `subscription_sharing_usage_limit_exceeded`. Raw: `ocr/T8.8-e0d1b5ea-failed.json`. T8.8's merge waits for a review once the limit resets, or for an API key; this is with the user.
- **T8.4-B10** `1b7f2800` (lane WB): a test-only change, flagged as a first-run pass with a mutation check.
  - The streaming test now asserts that each `onBatch` raises the write count by exactly `batch.records.length`; B9's two equalities stay.
  - The mutation buffered every batch until the last store's batch. It failed with "expected +0 to be 13" at line 363, eight times, while B9's lines still passed. The mutation was reverted.
  - Lane tier: unit 177 / 1845, integration 106 / 229, checks 14 of 14.
  - ocr not run: it waits for the user's choice about the ocr usage limit.
- **ocr usage limit:** the user chose to wait (2026-11-14, 19:47) for 1 hour 55 minutes, until the limit resets, then retry. The reviews to retry are T8.8 `e0d1b5ea` and T8.4-B10 `1b7f2800`.
- **merge-12** (lane UB merged T8.12 and T8.13; source `ade94fde`): all green, run complete.
  - Unit 179 / 1884, integration 106 / 229, checks 14 of 14.
  - Browser: the full tier ran, because `src/app/types.ts` changed since `a2ccf117`. 126 + 98 passed.
  - Outputs: `suite-runs/merge-12-*.txt`.
- **ocr T8.4-B10 `1b7f2800`** (lane WB, retried after the usage limit reset): 0 findings. Raw: `ocr/T8.4-B10-1b7f2800.json`.
- **ocr T8.8 `e0d1b5ea`** (lane WR, retried after the usage limit reset): 8 findings, all Valid. Raw: `ocr/T8.8-e0d1b5ea.json`. They become bug tasks, one at a time on lane WR:
  - **T8.8-B1:** staging `put` overwrites two artifact records with the same primary key; counts and digests still agree, so a self-consistent artifact prepares with records lost.
  - **T8.8-B2:** `danglingOrigins` checks only that the origin's factId exists somewhere, not that it belongs to the anchor Trade and has the declared kind.
  - **T8.8-B3:** the footprint projectors run on raw records before strict parsing; a malformed `facts` throws and gives Rejected with no issues instead of MalformedRecord.
  - **T8.8-B4:** the record envelope's `s` and `t` are cast, not validated; a bad line gives an untyped Rejected, and a store in an unrelated section is not caught.
  - **T8.8-B5:** `request.signal` is never read; an aborted preparation still returns Prepared and keeps the candidate (A138, A142, A148).
  - **T8.8-B6:** the section digest check covers only sections with a sectionEnd line; a section missing its sectionEnd skips its digest check.
  - **T8.8-B7:** the early returns after the header (UnsupportedFormat, UnsupportedNewerSchema, InsufficientCapacity) leave the line generator open, so the reader is never cancelled.
  - **T8.8-B8:** `request.onProgress` is never called (A148: preparation reports progress).
  - Findings B5 and B8 have no T8.8 plan case, but T8.8 owns `prepareRestore`, and the Restore flow task (plan line 431) needs both; so they are T8.8 bug tasks.
- **merge-13** (lane WB merged T8.4 F1 and B7 to B10; source `3de14dcf`): all green, run complete.
  - Unit 179 / 1886, integration 106 / 229, checks 14 of 14.
  - Browser: task tier (no changed path since `ade94fde` is on the full-tier list); 5 passed.
  - The runner issued the integration and browser calls in parallel, against its sequential rule; both passed with separate outputs.
  - Lane WB's worktree and branch are removed.
- **T8.8-B1** `c94497a9` (lane WR): staging keeps a per-store set of staged primary keys (via `keyOf` from `src/persistence/schema.ts`) and rejects a repeat with `DuplicateIdentity`, naming the store in `kind`, the key in `identity`, and the `line`; the candidate is deleted. No first-run pass; lane tier green (unit 1854, integration 229, checks 14 of 14).
  - Deviations: `kind` and `identity`, documented for CrossSectionReference, are reused for the duplicate's store and key; restore.ts imports `keyOf` directly from `schema.ts`, since the persistence index does not export it (lint:deps passes).
- **ocr T8.8-B1 `c94497a9`:** 0 findings. Raw: `ocr/T8.8-B1-c94497a9.json`.
- **T8.8-B2** `dae60957` (lane WR): `danglingOrigins` maps each Trade's fact ids to their kinds (close-reason facts included); a non-DailyReview origin on an Entry, decline or Debt is dangling unless its anchor Trade holds that fact with the declared kind. Issue: CrossSectionReference (kind = declared kind, identity = factId), as R-anchor. No first-run pass; lane tier green (unit 1855, integration 229, checks 14 of 14).
  - The tdd-log keeps two failed green rows: one run sent in parallel with the edit, and one assertion that fixed the issue order (now `toHaveLength(2)` plus `toContainEqual`).
- **ocr T8.8-B2 `dae60957`:** 0 findings. Raw: `ocr/T8.8-B2-dae60957.json`.
- **T8.8-B3** `52edd0c8` (lane WR): the footprint projectors in `flush` now run on the parsed records, after the parse check, so a malformed Trade (`facts: {}` or `facts: [null]`) gives a MalformedRecord issue with its line instead of an untyped Rejected. Projectors unchanged. No first-run pass; lane tier green (unit 1856, integration 229, checks 14 of 14).
  - Deviation: the footprint is computed from migrated, parsed records instead of raw ones; same result for a valid artifact (the ManifestMismatch and older-artifact cases pass), and the footprint comparison is already skipped once any record is malformed.
- **ocr T8.8-B3 `52edd0c8`:** 0 findings. Raw: `ocr/T8.8-B3-52edd0c8.json`.
- **T8.8-B4** `03eac086` (lane WR): each record envelope must be an object with text `s` and `t`, and its `t` must belong to its `s` (a local `SECTION_OF_STORE`, `meta` under `workspace`); each failure is a MalformedRecord with its line (path `s`, `t`, or none). Lane tier green (unit 1857, integration 229, checks 14 of 14).
  - **Flagged (TDD order):** the first two red rows were not a valid red (the fixture helper threw on a bare `null` line); the recorded red was taken by removing the already-written fix, so the fix was written ahead of a valid red. The red was a genuine assertion failure (Rejected with no issues).
  - Deviations: a bare `null` line never reaches the envelope check (the reader rejects a non-record line as Corrupt, giving IncompleteArtifact), so the test uses `"t": null`; the non-object guard stays. `SECTION_OF_STORE` now exists in both restore.ts and backup-export.ts (the export's has no `meta`); sharing one table is left for later.
- **ocr T8.8-B4 `03eac086`:** 0 findings. Raw: `ocr/T8.8-B4-03eac086.json`. Reviewer note (not a bug task): the two `SECTION_OF_STORE` maps (restore.ts, backup-export.ts) could drift; one shared map would avoid it. For the user.
- **T8.8-B5** `0616adef` (lane WR): `prepareRestore` reads `request.signal`. An aborted signal returns `Cancelled` (already declared) before the file opens, before the candidate is created (closing the reader), and at each line-loop iteration; after the loop an abort discards the candidate and wins over any issues. Two cases, both with genuine reds; lane tier green (unit 1859, integration 229, checks 14 of 14).
  - Abort is not checked during the seed and rebuild stages after staging.
- **ocr T8.8-B5 `0616adef`:** 2 findings, both Valid. Raw: `ocr/T8.8-B5-0616adef.json`. They become bug tasks on lane WR, after B6 to B8:
  - **T8.8-B9:** the post-loop abort check is the last one, so a Cancel during seeding, validation, repair, `rebuildCandidate` or preview building still returns Prepared and keeps the candidate (A138).
  - **T8.8-B10:** an abort during the header read or `host.estimate()` can still return Rejected (read or format failure, InsufficientCapacity), since those returns come before the next abort check; wrong result kind, nothing left behind. (The unclosed reader on those returns is B7.)
- **T8.8-B6** `b8f86dd7` (lane WR): the manifest digest comparison runs over every section in either the computed or the stored digests; a missing counterpart on either side is `DigestMismatch(section)` (A134; IncompleteArtifact stays for a truncated file). Genuine red; lane tier green (unit 1860, integration 229, checks 14 of 14).
- **ocr T8.8-B6 `b8f86dd7`:** 0 findings. Raw: `ocr/T8.8-B6-b8f86dd7.json`.
- **T8.8-B7** `b911160a` (lane WR): `prepare` now runs the work after `readArtifact` inside `try { ... } finally { await lines.return(undefined) }` (the body moved to an inner `prepareFrom`), so every return after the header closes the generator and cancels the stream. Three cases (formatVersion 2, newer schema, quota too small); lane tier green (unit 1863, integration 229, checks 14 of 14).
  - **Flagged (TDD order):** the first fixture was flaky (the small artifact's stream had ended before the early return), so the first red and green rows are unreliable and the fix existed before the valid reds; the final reds were taken by removing the fix with the corrected never-ending fixture, then the greens rerun. The final reds were genuine assertion failures.
  - B5's explicit `lines.return` on the cancel path is now redundant and left in place.
- **ocr T8.8-B7 `b911160a`:** 0 findings. Raw: `ocr/T8.8-B7-b911160a.json`.
- **T8.8-B8** `022ca218` (lane WR): `flush` adds each staged batch to `stagedCount` and calls `request.onProgress?.({ done: stagedCount, total })`, total from the header counts (A148). Genuine red (`expected 0 to be greater than or equal to 2`); lane tier green on the second run (unit 1864, integration 229, checks 14 of 14).
  - The tdd-log keeps an invalid red row (a filter that matched no test) and an invalid green row (a redeclared `const`).
  - **Flake:** the first lane run failed one unrelated unit case, `TradeList.test.tsx` "Open list … Loading, Ready, Empty … Error with Retry states"; it passes alone and on the rerun. Watch for it in later runs.
- **ocr T8.8-B8 `022ca218`:** 0 findings. Raw: `ocr/T8.8-B8-022ca218.json`. Reviewer note (not a bug task; for the user): `flush` reports progress only on the staging path; it returns without a report for the `workspace` section, a rejected batch and an unparsable batch, so `done` can fall short of the header total in those cases (read from the code, not run).
- **T8.8-B9** `eaa99739` (lane WR): a `cancelIfAborted` helper discards the candidate and returns Cancelled after seed, validation (before the rejection branch, so Cancel wins), repair, `rebuildCandidate`, and the preview and meta work. Two cases (abort at the seed step, abort after the rebuild), genuine reds; lane tier green (unit 1866, integration 229, checks 14 of 14).
  - The validation, repair and preview checks share the helper but have no case of their own.
- **ocr T8.8-B9 `eaa99739`:** 0 findings. Raw: `ocr/T8.8-B9-eaa99739.json`.
- **T8.8-B10** `2d1b84b9` (lane WR): `prepareFrom` returns through `rejectUnlessCancelled(issues)` on the read-failure, UnsupportedFormat, UnsupportedNewerSchema and InsufficientCapacity returns, so an abort during the header read or estimate gives Cancelled. One case (abort inside `host.estimate()` with too little space); lane tier green (unit 1867, integration 229, checks 14 of 14).
  - **Flagged (TDD order):** the first fixture never aborted (it waited for a second `estimate` call that does not happen), so the first red and green rows are invalid and the fix existed before a valid red; the valid red was taken by reverting the capacity return, then the fix restored for the green. The final red was a genuine assertion failure.
  - The header-read, format and schema returns share the helper but have no case of their own.
- **ocr T8.8-B10 `2d1b84b9`:** 0 findings. Raw: `ocr/T8.8-B10-2d1b84b9.json`. T8.8 and B1 to B10 are clean; lane WR merges.
- **merge-14** (lane WR merged T8.8 and B1 to B10; source `5fad9859`; the browser and checks stages ran on `055d9d67`, a plan-only commit): **failed**, run complete.
  - Unit 180 / 1910, integration 106 / 229, browser task tier 5 passed.
  - Checks 12 of 14: `typecheck` and `tsc6` fail at `src/ui/backup/RestoreFlow.test.tsx(52,15)`, TS2741, `tradeSummary` missing from a `RestoreRepair` fixture.
  - Cause: T8.8's `RestoreRepair` change (Q5 item 2) met lane UB's older fixture. Lane WR's last lane tier ran before its rebase onto a branch holding UB's merge, and the rebase brought in files WR doesn't own, so the lane tier should have been rerun before the merge (my process miss).
  - Fix: added to T8.13-F3 (lane UB), which edits that test file anyway. The next merge run must show checks 14 of 14.
- **T8.13-F3** `67dbda6c` (lane UB): repair lines name the Trade with `tradeName(repair.tradeSummary)` and use A7's approved sentence for the kind (`EntrySizeDeviation`: "Entry Size deviation missing. It will be added."; otherwise the Lifecycle sentence). A Rejected with no issues and a `detail` shows Q5 item 4's sentence with Choose backup file and logs the detail once through `logFailure`. Three cases, genuine reds; lane tier green (unit 1913, integration 229, checks 14 of 14).
  - Fixes merge-14's TS2741: the `RestoreFlow.test.tsx` preview fixture now carries `tradeSummary`, one Lifecycle and one EntrySizeDeviation repair; the older trade-9 assertion is removed (the new case covers it).
  - Refactor: the could-not-be-checked sentence is `COULD_NOT_CHECK` in `backup-text.ts`, shared by the thrown and reported failure paths.
- **ocr T8.13-F3 `67dbda6c`:** 0 findings. Raw: `ocr/T8.13-F3-67dbda6c.json`. Lane UB merges; T8.13 is complete.
- **T8.9** `14ecf482` (lane WR): `applyPreparedRestore`, 7 cases in `restore-apply.test.ts`. Lane tier rerun after fast-forwarding the lane to `ca839e70` (the first commit attempt was refused by the pre-commit typecheck on merge-14's fixture error): unit 181 / 1920, integration 106 / 229, checks 14 of 14.
  - Reds: five `Error: not built`, one assertion (CandidateChanged).
  - **Flagged:** case 6's recheck loop was written ahead with case 4; it was reverted for a genuine assertion red, then restored.
  - **First-run passes, each with a mutation check:** case 5's decline half (mutation: treat `DeclinedAfterWarning` as missing; failed `expected SafetyBackupRequired to match Restored`) and case 7 (mutation: report `session.current()` instead of the rerun; failed `expected Writable to match RecoveryOnly`). Both mutations reverted.
  - Pending decision Q10: the session's recheck runs `inspectRoot()`, whose cleanup deletes the prepared candidate. Lane workaround: `lookupSession` in `restore-test-support.ts`.
  - Deviations and notes: no `detail` on apply failures (the frozen union has none); an aborted root transaction throws; `AlreadyInitialized` mapping built but untested; `restorePrepared` also holds counts, migrations and repairs, and is deleted by a normal commit after activation; PreparationNotFound checks that the candidate database exists and is not live; `recognizesReceipt` reached through the backup operations with no `workspace.ts` edit; the `WorkspaceReplaced` broadcast uses `kind`, so T8.14's listener must filter on it.
- **ocr T8.9 `14ecf482`:** 8 findings (3 Valid, 5 Doubtful). Raw: `ocr/T8.9-14ecf482.json`. Each becomes a bug task on lane WR:
  - **T8.9-B1** (Valid): the composition root's recheck runs `inspectRoot()`, deleting the prepared candidate, so apply returns PreparationNotFound. Waits on Q10 (the fix is in `compose.ts`, outside lane WR).
  - **T8.9-B2** (Valid): `lookupSession` in the tests hides B1; no test applies through the real composition. Waits on Q10 with B1.
  - **T8.9-B3** (Doubtful): nothing guards the steps after activation (meta delete, broadcast, readiness rerun, `describeDatabase`, status); a throw there loses the Restored result after the Workspace was replaced.
  - **T8.9-B4** (Doubtful): SafetyBackupNotRecognized and SafetyBackupStale keep the candidate, while A135 says failures in steps 2 to 5 delete it unless only the confirmation or safety choice is missing; the T8.9 case says "writing nothing". Waits on Q11.
  - **T8.9-B5** (Doubtful): the Stale and NotRecognized test locks in that retention. Waits on Q11 with B4.
  - **T8.9-B6** (Doubtful): the `restorePrepared` meta is cast without a check; a missing or damaged record throws and leaves the candidate.
  - **T8.9-B7** (Doubtful): the rechecks cover only the four fact sections; `meta.settings` and `meta.sessionPolicy` edited in the candidate after the preview pass.
  - **T8.9-B8** (Valid): the test wrapper session's `reportStorageFailure` does not change its own `current()` state.
  - B3, B6, B7 and B8 run now, one at a time.
- **T8.9-B4 and B5:** closed with no change by Q11 (a).
- **Q10 answered (a):** T8.9-B1 moves to T8.11 (it owns `compose.ts`); T8.9-B2 runs in lane WR after T8.11 merges. Handoff note added for both.
- **T8.9-B3** `81d028b1` (lane WR), partial: after activation, a failed `restorePrepared` delete (`.catch`) and a failed broadcast (try/catch) no longer stop the Restored result. Genuine red (runtime exception "the preparation record could not be removed"); lane tier green (unit 1921, integration 229, checks 14 of 14).
  - **Deviation, for the user (Q12):** a throw in the readiness rerun, `describeDatabase` or `deps.status()` is still unguarded, since `restore.ts` cannot build a Recovery Only status from its generic `S` or a new binding without a content revision; a fallback needs a status-from-failure builder from `workspace.ts`, outside lane WR. A rerun that reports failure (rather than throwing) already gives Recovery Only, and the Restore screen shows Q5 item 8's "The Restore didn't finish. Reload the app to see which journal is in use." for any thrown apply failure.
- **ocr T8.9-B3 `81d028b1`:** 0 findings. Raw: `ocr/T8.9-B3-81d028b1.json`.
- **Q12 answered (a):** T8.9-B3 stands as committed; the unguarded post-activation throw goes in the final report's known limits.
- **merge-15** (lane UB merged T8.13-F3; source `ca839e70`): all green, run complete. Fixes merge-14.
  - Unit 180 / 1913, integration 106 / 229, checks 14 of 14 (typecheck and tsc6 pass again).
  - Browser: full tier (first matching path since `5fad9859`: `src/ui/backup/RestoreFlow.tsx`); browser-1 126 passed (5.3m), browser-2 98 passed (6.6m).
  - Docs-only commits landed on the branch during the run (`b36a5e9e`, `4649543c`, `878b496d`), so the later stages printed newer HEADs; no code changed between them.
  - Lane UB's worktree and branch are removed.
- **T8.9-B6** `aeb09c17` (lane WR): apply checks the `restorePrepared` record with `isPreparedRecord` (the four fact sections with counts and digest, plus counts, migrations and repairs); a missing or invalid record deletes the candidate and returns `CandidateChanged(meta)`. Genuine red (TypeError at `sections`); lane tier green (unit 1922, integration 229, checks 14 of 14). Only the missing-record case is tested; the damaged-record path shares the guard.
- **ocr T8.9-B6 `aeb09c17`:** 2 findings, both Valid. Raw: `ocr/T8.9-B6-aeb09c17.json`. Bug tasks on lane WR, after B7 and B8:
  - **T8.9-B9:** `isPreparedRecord` does not require each section's `storeDigests`, which the module rechecks read when counts match; a record missing them throws in the recheck and leaves the candidate.
  - **T8.9-B10:** `isPreparedRecord` accepts empty `counts` and `migrations` and malformed repair elements; a damaged record can be activated with a wrong receipt, and a missing `counts.accounts` picks the onboarding landing.
- **T8.9-B7** `34590ebe` (lane WR): preparation stores `workspaceDigest` (the canonical JSON of every `meta` record except `restorePrepared`, sorted by key) in `restorePrepared`; apply recomputes it after the four fact rechecks and returns CandidateChanged(meta) on a difference, deleting the candidate. Genuine red; lane tier green (unit 1923, integration 229, checks 14 of 14).
  - Deviation: `workspaceDigest` holds the canonical text, not a hash (the records are small; no hash helper added).
- **ocr T8.9-B7 `34590ebe`:** 1 finding, Valid. Raw: `ocr/T8.9-B7-34590ebe.json`.
  - **T8.9-B11:** `workspaceDigestOf` uses the strict `canonicalJson`, which throws on values it does not support (undefined, non-safe-integer numbers); a candidate `meta` record changed to such a value makes apply throw and leave the candidate, instead of CandidateChanged.
- **T8.9-B8** `3502c7b9` (lane WR): `lookupSession`'s `reportStorageFailure` forwards to the stack session and applies the same downgrade to its own state (Writable with a readable Workspace becomes RecoveryOnly, failure `{check: 'diagnostic', reason: 'StorageFailure'}`), mirrored since `createReadinessSession` does not export it. Genuine red; lane tier green (unit 1924, integration 229, checks 14 of 14).
- **T8.9-B9 and B11 run as one task:** both are a throw during apply's rechecks on a damaged candidate record; one guard around the recheck phase, with a case for each finding.
- **ocr T8.9-B8 `3502c7b9`:** 0 findings. Raw: `ocr/T8.9-B8-3502c7b9.json`.
- **T8.9-B9 and B11** `d153f3ba` (lane WR): `isSectionMeta` requires `storeDigests`; the four module rechecks and `workspaceDigestOf` run in one try/catch, so a throw there discards the candidate and returns CandidateChanged(meta). Two cases, each a genuine runtime-exception red (TypeError at `journalTypes`; CanonicalJsonUnsupported at `$[5].timeZone`); lane tier green (181 unit files, 106 integration files, checks 14 of 14).
- **ocr T8.9-B9 and B11 `d153f3ba`:** 0 findings. Raw: `ocr/T8.9-B9-d153f3ba.json`. Reviewer note (not a bug task; for the user): a throw in any recheck, including a trades or journal one, is reported as store `meta`, which is imprecise if a caller ever relies on the store name.
- **T8.9-B10** `039b3f68` (lane WR): `isPreparedRecord` checks every `RestoreCounts` field (non-negative integer counts, the lifecycle, entry, debt and version maps), `migrations` (`steps` with numeric `from` and `to`, string `seedAdditions`) and each repair's fields and `tradeSummary`; a failing record goes down B6's CandidateChanged(meta) path. Three cases (empty counts, repair without kind, migrations without steps), each a genuine assertion red; lane tier green (unit 1929, integration 229, checks 14 of 14).
  - Deviations: two extra cases; `summary` is checked only as an object.
- **ocr T8.9-B10 `039b3f68`:** 2 findings, both Valid. Raw: `ocr/T8.9-B10-039b3f68.json`. Run as one task on lane WR:
  - **T8.9-B12:** the repair guard accepts any object as `tradeSummary.summary` (for example `{}`), so a malformed summary reaches the UI's Trade-name formatter.
  - **T8.9-B13:** the migration guard accepts any number for `from` and `to` (NaN, Infinity, negative, fractional), looser than the file's own `isCount`.
- **T8.9-B12 and B13** `060a3fb0` (lane WR): a local `isTradeSummary` checks each repair's summary (string `tradeId`, `accountId`, `strategyId`, `underlying`, `planTime`; `lifecycle` Planned, Open or Closed; optional string `lastActivity`); migration steps need integer `from` of at least 1 and a larger integer `to`. Two cases, genuine assertion reds; lane tier green (unit 1931, integration 229, checks 14 of 14).
  - Deviation: trade-record exports no `TradeSummary` guard, so it is local and lists the lifecycle values inline.
- **Proposed to the user (guideline 6):** drop the persisted `restorePrepared` record and hold the preparation results in memory keyed by the candidate, since a candidate never survives a restart (launch cleanup); this removes the shape guards from B6 and B9 to B13. Awaiting the answer.
- **ocr T8.9-B12 and B13 `060a3fb0`:** 1 finding, Valid. Raw: `ocr/T8.9-B12-060a3fb0.json`.
  - **T8.9-B14:** `isTradeSummary` checks the Trade Record's summary fields, but `RestoreRepair.tradeSummary.summary` is the domain `TradeSummary` from `domain/trade-summary.ts` (Stock or Option variant, filled by `plannedTradeSummary`), so every real candidate with repairs would be rejected as CandidateChanged at apply. Cause: my B12 brief pointed at the wrong `TradeSummary` (`src/modules/trade-record/trade-record.ts`). No test applied a candidate with real repairs.
- **T8.9-B14** `3cff8b9d` (lane WR): `isTradeSummary` now checks the domain `TradeSummary` (Stock: `direction` Long, stored-Rational `quantity` and `price`; Option: `direction` Long or Short, stored-Rational `contracts`, string `expiration` and `strike`, `right` Call or Put), with a local `isStoredRational` (bigint numerator and denominator). New case applies a candidate with R-lc and R-dev repairs end to end: genuine red (`CandidateChanged` instead of Restored), then green. Lane tier green (unit 1932, integration 229, checks 14 of 14).
- **ocr T8.9-B14 `3cff8b9d`:** 0 findings. Raw: `ocr/T8.9-B14-3cff8b9d.json`. T8.9 and its open bug tasks that can run now are clean; lane WR merges. T8.9-B1 moved to T8.11 (Q10); T8.9-B2 runs after T8.11 merges.
- **merge-16** (lane WR merged T8.9 and its bug tasks; source `6ae0bea6`): all green, run complete.
  - Unit 181 / 1932, integration 106 / 229, checks 14 of 14.
  - Browser: task tier (no changed path since `ca839e70` is on the full-tier list); 5 passed.
  - A plan-only commit (`66663cb7`) landed during the run.
  - Lane WR stays for T8.9-B2 (after T8.11) and the proposed preparation-record cleanup, if the user approves it.
- **Wave 2 started:** T8.11 runs in lane US on top of T8.14 (handoff note), rebased onto `66663cb7`; the rebase moved files T8.14 doesn't own, so T8.11's lane tier covers the rerun.
- **Q13 answered (a):** follow-up T8.9-F1 (lane WR, after T8.11 merges) replaces the persisted `restorePrepared` record with in-memory preparation results, removing B6 and B9 to B14's shape guards.
- **Q14 answered (b):** Restore covers schemas 3 to 7 only. T8.11's agent told to set the manifest's Restore range to 3 through 7; T8.17 freezes no v1 or v2 backup fixture; revision 103 amends A145 and A147.
- **Q15 answered (a):** follow-up T8.8-F1 (lane WR, after T8.11) fixes the journal seed comparison by value and removes the restore workaround.
- **T8.11** `bb23f7bc` (lane US): manifest v7 (24 operations, 10 routes; `backupSchemaRange` `{ formatVersion, export: {from, to}, restore: {from, to} }`, Restore 3 to 7 per Q14), the export worker (`backup-export` chunk in the Offline Release Inventory), the browser export, download and file-selection ports, and the Q10 session change in `compose.ts` and `tests/support/stack.ts`. `verify:capabilities` and `verify:release` exit 0. Lane tier: integration 229, checks 14 of 14, unit 1943 of 1945.
  - Q10 case "should keep a prepared Restore candidate through a readiness recheck after launch": the first red row passed (invalid: no Workspace, where no recheck deletes the candidate); the fixture was fixed before any production code, then a genuine red (`expected [ 'tj-root', 'tj-ws-id-0013' ] to include 'tj-ws-id-0014'`), then green.
  - Deviations: (1) Q14's Restore range. (2) Q10 refined: the session inspects the root with cleanup until this instance knows a Workspace, then only reads it; pure launch-only broke I1.9 (concurrent first run). (3) the manifest range shape. (4) `src/main.tsx` (not in T8.11's list) ignores this tab's own WorkspaceReplaced broadcast while its own apply runs or after it succeeds, and filters on `kind`. (5) after a Restored result `main.tsx` rebuilds the shell on the trader's next click, leaving the summary on screen. (6) a temporary browser smoke (removed) downloaded, verified and restored through the real worker.
  - The update-notice controller does not misread the broadcast (no `tabId`, so nothing is marked unsaved).
  - **Unit failures, fixed in the batch:** two T8.14 cases in `src/ui/AppShell.test.tsx` use the real manifest through `facadeDouble`, which now installs backup: the aria-current navigation case now sees a Backup link, and the not-protected warning's "without Backup" case now sees the backup sentence. Not a user decision: T8.14 merges with T8.11 by plan, and its tests must follow the installed manifest. Follow-up **T8.14-F1** (lane US) adds a `withoutBackup` helper for the "without" case and expects Backup in the wide sidebar only (A144 as amended by P106).
- **Q16 answered (b)** (UnsupportedDataCapability left for later) and **Q17 answered (a)**: follow-up T8.8-F2 (lane WR, after T8.11) reports a dangling Strategy as CrossSectionReference.
- **ocr T8.11 `bb23f7bc`:** 2 findings, both Valid. Raw: `ocr/T8.11-bb23f7bc.json`. Bug tasks on lane US, after T8.14-F1:
  - **T8.11-B1:** `applyingHere` in `src/main.tsx` is never reset after a Restored result, so every later WorkspaceReplaced message from another tab is ignored, and this tab stays writable against a retired database after a second cross-tab Restore (A136).
  - **T8.11-B2:** the shell rebuilds on the next document-wide click after a Restore; a first click on Download backup (or anywhere) remounts the Backup page and loses its state mid-export.
- **T8.14-F1** `03fc7419` (lane US): test-only. A `withoutBackup(facade)` helper strips the four backup operations for the warning case's "without" variant; the aria-current case expects Backup between Accounts and About at 1280 wide and the same five bottom-bar links at 390 (no A144 defect). AppShell.test.tsx 50 of 50; lane tier unit 1945, integration 229, checks 14 of 14. The before state is recorded from T8.11's report (the guard blocked restoring the old file to rerun it).
  - Deviations: `withoutBackup` leaves the backup range in place (a required field the shell never reads); the now-redundant `withBackup` helper is left as is.
- **T8.11-B1 and B2 run as one task** (both in `src/main.tsx`'s post-Restore handling).
- **ocr T8.14-F1** `03fc7419`: no findings (`ocr/T8.14-F1-03fc7419.json`).
- **T8.11-B1 and B2** `2a3cde98` (lane US): the post-Restore handling moves from `src/main.tsx` into `createPostRestore()` (`src/app/post-restore.ts`). `apply` wraps this tab's own apply and remembers the produced database name; `hearsReplacement(databaseName)` ignores only this tab's own broadcast (during its apply or for that database name); `observePath` rebuilds the shell once, on the first route change after a Restored result. The document-wide click listener is gone. Three cases red then green (one added by the agent: ignore this tab's broadcast while its apply is still running). Lane tier unit 1948, integration 229, checks 14 of 14.
  - Deviation: the Download-backup case is tested as "the rebuild waits for a route change" at unit level; the `useLocation` effect in `Shell` is covered by typecheck only (no React test reaches `main.tsx`). No first-run passes.
- **ocr T8.11-B1/B2** `2a3cde98` (`ocr/T8.11-B1-2a3cde98.json`): two Valid findings, both narrow races in `src/app/post-restore.ts`, fixed together as T8.11-B3 and B4.
  - B3 (line 38): every broadcast is dropped while this tab's apply is pending, so another tab's Restore landing then is never shown.
  - B4 (lines 30-31): the summary route is read after the await, so navigating away mid-apply records the destination as the summary route and the shell is not rebuilt until another navigation.
- **T8.11-B3 and B4** `b10f24dc` (lane US): broadcasts heard while this tab's apply is pending are held and, once the result is known, shown through a new `showLater` callback unless they name the database this apply produced (all shown if the apply did not end Restored or threw); `apply` records its starting route and rebuilds at once if the route changed before a Restored result. `hearsReplacement(databaseName, showLater)` is the new shape. Lane tier unit 1951, integration 229, checks 14 of 14.
  - First-run pass, flagged: "should drop this tab own broadcast heard while applying once the result names its database" passed against the old code (which dropped every broadcast while applying). Mutation check: comparing against a constant instead of this apply's database name fails with an assertion; code restored.
- **ocr T8.11-B3/B4** `b10f24dc` (`ocr/T8.11-B3-b10f24dc.json`): three Valid findings, fixed together as T8.11-B5, B6 and B7.
  - B5 (high, `post-restore.ts:41`): a held foreign notice is delivered right after `rebuildShell()` only queues the remount, so it reaches the old shell and the new shell never shows it.
  - B6 (`post-restore.ts:39`): comparing only the final route with the starting route misses leaving and returning to /backup during the apply; the summary is lost and the shell is not rebuilt.
  - B7 (`main.tsx:98`): the held callback keeps the listener captured when the broadcast arrived, ignoring unsubscribe and resubscription; a stale /backup listener can mark an open entry form unavailable.
- **T8.11-B5, B6 and B7** `764eb9bc` (lane US): `hearsReplacement(db, showLater)` becomes `hearReplacement(databaseName)` plus `subscribeReplaced(listener) => unsubscribe`. Another tab's Restore is remembered and told to every current subscriber and to any later one (the rebuilt shell); no listener is captured when a broadcast arrives (B5, B7). `observePath` records that the starting route was left during the apply, and a Restored result rebuilds if so (B6). `main.tsx` has one channel listener; `onWorkspaceReplaced` returns `subscribeReplaced`. Lane tier unit 1954, integration 229, checks 14 of 14.
  - Flagged: two of the three reds are `TypeError: postRestore.subscribeReplaced is not a function` (a runtime exception from the missing method, not an assertion); the third is an assertion. Accepted as runtime-exception reds; noted for the final report.
  - Deviation: a rebuilt AppShell told on subscribe marks the form open on its current route unavailable, which is correct once the journal was replaced. The four older cases were rewritten to the new API (refactor row in the tdd-log).
- **ocr T8.11-B5/B6/B7** `764eb9bc` (`ocr/T8.11-B5-764eb9bc.json`): one Valid finding, T8.11-B8.
  - B8 (`post-restore.ts:74`): the remembered foreign Restore is replayed to every new subscriber, and the AppShell resubscribes on every route change, so a record-entry route visited after the replacement is treated as the form open at the time and shows the entry form instead of RecordEntryUnavailable.
  - Fixed inside `post-restore.ts` (lane US) rather than parked: parking T8.11 would hold every wave 2 task. The fourth round of narrow post-Restore races is raised with the user as Q21.
- **T8.11-B8** `3ec3bf79` (lane US): `post-restore.ts` tracks whether the shell on screen has been told; a re-subscription of a told shell gets no replay. A rebuild (after a Restore or on leaving the summary route, through one `requestRebuild` helper) resets it, and a notice delivered to the old shell during the rebuild does not count, so the rebuilt shell is told once. Red was an assertion failure. All 10 post-restore cases pass; lane tier unit 1955, integration 229, checks 14 of 14. No first-run passes; the route-change replay is covered at the post-restore level only (the AppShell is out of scope).
- **ocr T8.11-B8** `3ec3bf79`: no findings (`ocr/T8.11-B8-3ec3bf79.json`). Reviewer note (not an ocr finding, for the user): `subscribeReplaced` clears `rebuilding` on any subscribe, so if the dying shell resubscribed between the rebuild request and the new shell's first subscribe, a notice arriving in that gap could count as told for the dying shell. Not confirmed as reachable.
- **merge-17** (lane US: T8.14 and T8.11 with fixes, at `6941a98c`, full tier since `6ae0bea6`): unit 1955, integration 229, browser-2 98 passed, checks 14 of 14; **browser-1 1 failed** of 126: `e2e/d2/migration.spec.ts:87` (B2.4 Migration Blocked) expects the screen's buttons to be `["Retry"]` (line 108) but gets `["Retry", "Download a copy", "Verify"]`. The new buttons are planned (P32, A143); the plan's list of tests that A143/A144 change (Notes, line 106) misses this D2 assertion. Fixed as T8.14-F2 (test-only), then merge-18.
- **Wave 2 lanes FT, FX, BG** created at `de83f139` (`.claude/worktrees/d08-ft` on `d08/ft`, `d08-fx` on `d08/fx`, `d08-bg` on `d08/bg`) for T8.15, T8.17 and T8.18. T8.14-F2 (lane US) and T8.9-B2 (lane WR) run beside them: five tdd-task agents.
- **T8.14-F2** `4a7d2b4b` (lane US, test-only): `e2e/d2/migration.spec.ts:108` now expects `['Retry', 'Download a copy', 'Verify']` (P32, A143); nothing else changed. The case passes alone (`1 passed (4.3s)`) after `build:faults` and `build:releases`. Lane tier unit 1955, integration 229, checks 14 of 14. The test name ("…and Retry, …") is kept. `e2e/d1/integrity-blocked.spec.ts:30` and `:56` still expect `['Retry']` and passed in merge-17: an unreadable root offers neither action (P32), so they are not stale.
- **ocr T8.14-F2** `4a7d2b4b`: no findings (`ocr/T8.14-F2-4a7d2b4b.json`). Merges with T8.9-B2 in merge-18.
- **T8.9-B2** `58da70d9` (lane WR, tests only): `lookupSession` is removed from `restore-test-support.ts`; `workspaceOf` and the three apply cases use the stack's real readiness session (`tests/support/stack.ts`, which mirrors `compose.ts`'s `lookupRoot` switch after launch). The helper-only "test support lookup session" case is removed with it. New case "should return Restored when a prepared Restore is applied through the stack readiness session". Lane tier unit 1955, integration 229, checks 14 of 14.
  - First-run pass, flagged (expected: T8.11 fixed the behaviour). Mutation: the stack session always calls `inspectRoot()`; the case fails with `AssertionError: expected 'PreparationNotFound' to be 'Restored'`; restored exactly.
- **ocr T8.9-B2** `58da70d9`: no findings (`ocr/T8.9-B2-58da70d9.json`).
- **merge-18 batch:** T8.14-F2 `c1e69079` and T8.9-B2 `d85e5c57` merged; lane US removed. T8.9-F1 (Q13, Q20) starts in lane WR from `86d6792d`.
- **T8.17** `5ecdc6b3` (lane FX): froze `backup-v7/` and `backup-v3-blocked/` to `backup-v6-blocked/` (Q14: none for v1 or v2) with `tools/fixtures-freeze-backup.ts` (refuses to overwrite an existing folder) and `fixtures:freeze-backup`; `verify:fixtures` restores each into an empty factory and compares the views with the committed `expected-views.json` and with the matching migrated `workspace-v<n>` views. Zero repairs for all five. Mutations (an expected view value; one artifact byte) each fail verify and were restored byte for byte. Lane tier unit 1955, integration 229, checks 14 of 14. The lane's own details are in its section "T8.17 Backup fixtures (lane FX)".
  - Notes: no unit-tested helpers (tool scripts only), so no tdd-log rows; the freeze tool imports `workspaceOf` from `restore-test-support.ts` (lint:deps accepts it); artifact bytes are not compared with a fresh export, since `releaseId` and `createdAt` change by release.
- **ocr T8.17** `5ecdc6b3`: no findings (`ocr/T8.17-5ecdc6b3.json`). Merges after merge-18.
- **T8.15** `65026afb` (lane FT): `?faults=` gains `backup:read`, `restore:apply:<store>` (catalog, observations, trades, journalTypes, journalDefinitions, journalEntries, journalDeclines, journalDebts), `restore:activate`, `restore:hold-prepare` and `restore:hold-activated`; holds share the existing `release()`. Restore takes optional `RestoreStageHooks` (`staged`, `recheck`, `activating`, `activated`); `Persistence.activateFirstCandidate` gains the optional `inFlip` hook `activateCandidate` already had. `verify:no-fault-hooks` exits 0 on `dist/` and 1 on `dist-faults` naming the four literal stages (`restore:apply:<store>` is assembled at run time; the others cover it). 11 cases red then green, no first-run passes. Lane tier unit 1966, integration 229, checks 14 of 14. No browser run.
  - Deviation 1 (files outside lane FT, section 3.2): optional-field wiring in `src/coordinators/workspace/workspace.ts` (`WorkspaceDeps.restoreHooks`), `src/coordinators/workspace/index.ts` (re-export), `src/app/compose.ts` (`ApplicationDeps.restoreHooks`) and `src/main.tsx` (passes `faults?.restoreFaults()` and wraps the export port with `faultyExportPort` in the faults build). The brief said to stop; the agent made them. Raised as Q22; T8.15's merge waits for the answer.
  - Deviation 2: `backup:read` runs the real export in the page in the faults build (the worker can't see `?faults=`), failing at the first batch with stage Read. The worker file is unchanged.
  - Agent observation (not an ocr finding, for the user): in the first-run path a real activation failure throws without discarding the candidate; pre-existing, left as is.
- **ocr T8.15** `65026afb` (`ocr/T8.15-65026afb.json`): three Valid findings.
  - **T8.15-B1** (`restore.ts:858`): a first-run Restore whose activation throws leaves the prepared candidate; the existing-Workspace branch discards it. Same as the T8.15 agent's observation. The fix is in Restore's apply (lane WR's T8.9 code, which T8.9-F1 is editing now), so it runs in lane WR after T8.9-F1.
  - **T8.15-B2** (`faults.ts:150`): `backup:read` never fails when every exported store is empty (`onBatch` runs only for non-empty batches), so the export can complete. Lane FT.
  - **T8.15-B3** (`restore-faults.test.ts:26`): the two hold tests wait a fixed 50 ms for the hook; an "entered" signal removes the timing dependence. Lane FT, with B2.
- **T8.9-F1** `159a34a6` (lane WR; Q13 and Q20): preparation results are held in memory in a `Map` on the Workspace instance, set only on `Prepared` and dropped when apply discards the candidate or succeeds; nothing is persisted. Apply returns PreparationNotFound when this instance holds nothing for the candidate, and still runs the four section rechecks and the settings comparison. A thrown section recheck names its section (`catalog`, `marketData`, `trades`, `journal`); only the settings comparison reports `meta`. Shape guards and the post-activation record delete are removed. Three cases, each a genuine red; no first-run passes. Lane tier unit 1951, integration 229, checks 14 of 14.
  - Removed cases (they guarded the dropped record): "a section of the preparation record lacks its store digests", "the preparation record holds empty counts or a malformed repair", "the preparation record holds a repair without its kind", "the preparation record holds migrations without their steps", "a repair holds an empty Trade summary", "a migration step names a version that is not a whole number", "the preparation record in the candidate is missing or damaged".
  - Changed setups, expected values unchanged: the "step after activation throws" case now forces the throw through the BroadcastChannel announcement; two `restore.test.ts` cases measure the candidate's sections afresh.
  - Q20 reading: `CandidateChanged.store` holds a section name for a thrown recheck and a store name when a module itself returns CandidateChanged. Accepted as Q20's wording ("names the section").
- **ocr T8.9-F1** `159a34a6` (`ocr/T8.9-F1-159a34a6.json`): two findings, run in lane WR together with T8.15-B1 (same first-run activation code):
  - **T8.9-F1-B1** (Valid, low, `restore.ts:743`): the `AlreadyInitialized` exit of the first-run activation returns before `held.delete`, so the preparation stays held for the instance's life.
  - **T8.9-F1-B2** (Doubtful, `restore.test.ts:576`): the repairs case now compares a fresh measurement with itself, so it no longer proves preparation kept its post-repair baseline (the apply case in `restore-apply.test.ts:149-170` still covers the path).
- **T8.15-B2 and B3** `0d548909` (lane FT): `faultyExportPort`'s start callback now throws `injected fault: backup:read` after the real `onStart`, so the fault fires on an all-empty snapshot (the per-batch throw stays). Red: `kind: 'Downloaded'` where NotCompleted was expected. The two hold cases await an `entered` promise instead of a fixed 50 ms; a mutation (hook resolves at once) fails each. Lane tier unit 1967, integration 229, checks 14 of 14.
  - Notes: a 500 ms `finishedAfter` race remains to show the operation is still pending (it can only pass wrongly, never fail wrongly; 20 ms let the prepare mutation pass). The tdd-log's first red row came from an uninitialized fixture and is marked invalid; the valid red follows it.
- **ocr T8.15-B2/B3** `0d548909` (`ocr/T8.15-B2-0d548909.json`): one Valid finding, **T8.15-B4** (`faults.ts:154`): the start-time throw is unconditional, so a populated journal fails before its first batch and the batch-time throw is dead code; the row says the read fails at its first batch. Lane FT.
- **T8.9-F1-B1, T8.9-F1-B2 and T8.15-B1** `6df2130f` (lane WR): `AlreadyInitialized` now drops the held preparation; a throw from first-run `activateFirstCandidate` drops the candidate (ignoring its own errors) and rethrows the original error, outcome unchanged. The repairs case in `restore.test.ts` now applies and expects Restored; a mutation measuring trades before the repairs gives CandidateChanged. Both new cases use a persistence double. Lane tier unit 1953, integration 229, checks 14 of 14.
  - TDD order slip, flagged: both fixes were written before the second case's red; that red was then taken by temporarily removing the cleanup call (`Error: activation failed` on the second apply), and the tdd-log says so.
- **ocr T8.9-F1-B1** `6df2130f`: not run. ocr's usage ran out (`subscription_sharing_usage_limit_exceeded`; sessions b031305c and 95e40b64, 0 files reviewed). Per the user's instruction, work pauses until 03:00 EST: no new tasks, reviews or merges; agents already running finish. Resume by rerunning this review.
- **merge-18** (T8.14-F2 and T8.9-B2, at `86d6792d`, full tier since `6941a98c`): green. Unit 1955, integration 229, browser-1 126 passed, browser-2 98 passed, checks 14 of 14; run complete. T8.17 (reviewed, clean) waits for the 03:00 EST resume to merge.
- **T8.15-B4** `61029112` (lane FT): `backup:read`'s start callback throws only when every count in `start.counts` is 0; otherwise the read fails at its first batch. Red: `expected [ 'start' ] to deeply equal [ 'start', 'batch' ]` (the test records the real onStart and the first batch hand-over). 8 of 8 restore-faults cases pass; lane tier unit 1968, integration 229, checks 14 of 14. No first-run passes. Its ocr review waits for the 03:00 EST resume.
- **T8.18** `a4823ffa` (lane BG): the generator builds the D7 mix in Node (no browser, no domain commands) and writes it through the production `runExport`/`ArtifactWriter` from a synthetic snapshot; legs, fills and settlements counted from each Trade's facts; no `revision` stamps. Counts equal the old generator-7 dataset (25,000 Trades; 187,435 Executions; 106,985 Marks; 130,234 Actions; 24,365 Debts). Artifact `.cache/bench/benchmark.tjbackup` (git-ignored, not committed): 20,869,681 bytes compressed, 453,413,121 uncompressed, file SHA-256 `48b58c6e…`; generation 19 to 21 s; two regenerations give the same file digest (gzip header mtime zeroed). `bench/dataset.json` (120 KB) committed. The 40-session smoke artifact prepares with zero issues and zero repairs in the unit suite; the full artifact prepared (kind Prepared) in Node in 772 s in a throwaway test, repairs count not captured. Cases red then green; one first-run pass (Restore, zero repairs) with a mutation check (`deviationActions: []` gives repairs). Lane tier unit 1963, integration 229, checks 14 of 14. Its ocr review waits for the 03:00 EST resume.
  - Deviations: the calendar is injected (lint:deps forbids the session policy import); the artifact's `releaseId` is `tj-bench-generator-v7`; `dataset.json` drops `generatedAt`, `origin`, `benchRelease`, `buildDir`, `profileDir` and gains an `artifact` block; the Action walk is approximate (counts match). Raised as Q23 (generator version) and Q24 (expected Open rows and Review order), which hold T8.19 only.
- **Q21 to Q24 answered (2026-11-15): all (a).** T8.15 may merge after its reviews (Q22); T8.18-F1 (version 8) and T8.18-F2 (expected Open rows and Review order computed in Node) run in lane BG after T8.18 merges. Work stays paused until 03:00 EST (ocr usage).
- **Resumed at 03:00 EST.** **ocr T8.9-F1-B1** `6df2130f` (retry): no findings (`ocr/T8.9-F1-B1-6df2130f.json`). Lane WR (T8.9-F1 and its fixes) is ready to merge.
- **T8.17 rebased** onto `769f6434` as `f8e14370`; `structural.md` conflict resolved by keeping the main branch's text and appending the lane's T8.17 section. The rebase brings in T8.9-B2's `restore-test-support.ts`, which the freeze tool imports, so the lane tier reruns before the merge.
- **ocr T8.15-B4** `61029112`: no findings (`ocr/T8.15-B4-61029112.json`). T8.15 and its fixes are clean; Q22 accepted its four extra files, so lane FT merges.

## T8.17 Backup fixtures (lane FX)

- `npm run fixtures:freeze-backup`: exit 0. Froze `tests/fixtures/backup-v7/` (`exportBackup` of workspace-v7 at Friday 2026-11-20 18:00 New York) and `backup-v3-blocked/` to `backup-v6-blocked/` (blocked-database exports of workspace-v3 to workspace-v6, read as stored, no migration run). Per Q14 (A147 amended) none for v1 or v2. Each holds `backup.tjbackup`, `downloaded.json` (the Downloaded result plus file name and as-of) and `expected-views.json` (views after Restore into an empty factory and a restart). Sizes of the artifacts: v3 5603, v4 6272, v5 7881, v6 9451, v7 9538 bytes.
- `npm run verify:fixtures`: exit 0. Each backup fixture restores into an empty factory with zero repairs; its views equal its committed expected views and the matching workspace-v<n> expected views (v3 to v6 after migration per A121). Decision 112's check still reads only `workspace-v<n>` names.
- Mutation 1: changed `planned[0].underlying` in `backup-v6-blocked/expected-views.json` (JKL to JKX): exit 1, `FAIL backup-v6-blocked: restored views differ from expected-views.json at planned[0].underlying`. Restored byte for byte (cmp), verify exit 0.
- Mutation 2: overwrote byte 100 of `backup-v6-blocked/backup.tjbackup` with 0: exit 1, `FAIL backup-v6-blocked: prepareRestore is {"kind":"Rejected","issues":[{"code":"IncompleteArtifact"}]...`. Restored (cmp), verify exit 0.
- No behavior with its own unit tests was added (tool scripts only), so there are no tdd-log rows.
- **Merged:** lane WR (T8.9-F1 `8de26d7d`; T8.9-F1-B1, F1-B2 and T8.15-B1 `a656ccc5`) and lane FX's T8.17 (`b486bf83`, rebased twice; `structural.md` conflicts resolved by keeping the main branch's text and appending the lane's T8.17 section). T8.17's lane tier after the first rebase: unit 1955, integration 229, checks 14 of 14, `verify:fixtures` OK. The second rebase brought in only lane WR's `restore.ts` change; merge-19's full tier covers it.
- **Lane FT rebased** onto lane WR's merge: a conflict in `src/coordinators/workspace/restore.ts` resolved by hand (T8.9-F1's in-memory `prepared` with `{section, run}` rechecks, each wrapped by T8.15's `checked` hook; first-run activation keeps F1-B1's try/catch and passes the `activating` hook; the Aborted branch keeps `dropCandidate`). Typecheck passes; the lane tier reruns before merging.
- **T8.20** starts in lane FX from `4390d956`.
- **ocr T8.18** `a4823ffa` (`ocr/T8.18-a4823ffa.json`): two Doubtful findings.
  - **T8.18-B1** (`tools/bench-generate.ts:97`): `tools/bench-run.ts` still calls `bench:generate` and then copies `BENCH_PROFILE_DIR` and compares with the expected rows, which the new generator no longer makes. The fix is in `bench-run.ts` (lane BN), so it is folded into T8.19's brief, which reworks `bench:setup` and `bench:run` anyway.
  - **T8.18-B2** (`src/app/bench-generator.ts:856`): nested ternaries (resolution status, option-leg selection, settlement comparator). Lane BG, with T8.18-F1 (Q23: generator version 8).
- **Lane FT tier after rebase** (`6bd65504`): unit 1966, integration 229, checks 14 of 14; `build:faults` then `verify:no-fault-hooks` exit 0. Lane FT merges.
- **T8.21** starts in lane BR (`.claude/worktrees/d08-br` on `d08/br`) from `a922332e`, beside merge-19.
- **T8.8-F1** `ce416009` (lane WR; Q15): `prepareJournalSeed` compares prompts with `canonicalJson`; `seedDefaults` calls the same function, so one fix covers both. The `restore.ts` workaround is removed. Case 1 red (`SeedConflict` where Additions expected) then green. Case 2 (restore A7, restart, `initialize` cleanly) was a first-run pass because the workaround hid the bug; flagged. The workaround was removed first to take a genuine red (`expected Prepared, got Rejected`), and a mutation back to `JSON.stringify` fails it again. Lane tier unit 1955, integration 229, checks 14 of 14.
- **T8.18-B2 and T8.18-F1** `6a05ed14` (lane BG): the nested ternaries T8.18 added become if/else or named helpers (`underlyingStopOffset`, `underlyingTargetOffset`, `declineWording`, `bySettlementOrder`); the smoke artifact digest is unchanged (`835a3ac3…`). Generator version 8 (`BENCH_GENERATOR_VERSION`, marker `tj-bench-generator-v8`, artifact `releaseId` follows); red `expected 7 to be 8`, then green. The full artifact regenerated twice: file SHA-256 `6d819703…` both times; `bench/dataset.json` differs between runs only in `generationMs`. Lane tier unit 1964, integration 229, checks 14 of 14.
  - Notes: the tdd-log has a stray green rerun row ("should name the current generator version") and a blank line splitting its table; left as logged. Compare the artifact `fileDigest`, not the whole `dataset.json`.
- **ocr T8.8-F1** `ce416009` (`ocr/T8.8-F1-ce416009.json`): one Doubtful finding, **T8.8-F1-B1** (`journal.test.ts:78`): the `reversed` test helper uses a nested ternary. Lane WR, after T8.8-F2.
- **ocr T8.18-B2/F1** `6a05ed14`: no findings (`ocr/T8.18-B2-6a05ed14.json`).
- **T8.18-F2 stopped before any code** (lane BG, still at `6a05ed14`): the Open list's headers and rows are built inline in the non-exported `OpenList` JSX in `src/ui/screens/TradeList.tsx`, and `browseTrades` and the Daily Review read through `Persistence` on IndexedDB, so the only Node path to them is loading the records the way Restore does (fake-indexeddb, the private rebuild). Both are outside lane BG and the brief said to stop. Raised as Q25; it holds T8.18-F2 and T8.19 only. T8.18 with B2 and F1 merges without it.
- **T8.8-F2** `16144af5` (lane WR; Q17): `danglingStrategies` in `restore.ts`, beside `danglingOrigins`, checks every staged Trade's `strategyId` against the catalog's Strategy shapes and reports `{code: 'CrossSectionReference', kind: 'Strategy', identity}` (the dangling-Account issue's shape, which names no Trade either). Red `expected Rejected, got Prepared`, then green; live journal unchanged and no candidate. Lane tier unit 1956, integration 229, checks 14 of 14. The Restore screen's existing generic sentence words it as "A record refers to a Strategy that isn't in the backup (<id>)."
- **ocr T8.8-F2** `16144af5`: no findings (`ocr/T8.8-F2-16144af5.json`).
- **T8.8-F3 and T8.8-F1-B1** `afcf596c` (lane WR; Q18): one shared `SECTION_OF_STORE` in `src/backup/format/sections.ts` read by `backup-export.ts` and `restore.ts`. The two old tables agreed on every exported store; Restore's alone listed `meta: 'workspace'`, which the shared table keeps (no behaviour change). New case "should map every store to the same section for export and Restore" checks every store in the schema 1–7 export layouts plus `meta`. First-run pass, flagged (a pure refactor; the case was written with the shared table already in place). Mutation (`trades` mapped to `journal`) fails it and the export cases; restored exactly. F1-B1: the `reversed` test helper uses early returns. Lane tier unit 1957, integration 229, checks 14 of 14.
- **ocr T8.8-F3/F1-B1** `afcf596c`: no findings (`ocr/T8.8-F3-afcf596c.json`).
- **merge-19** (lanes WR, FX T8.17 and FT, code at `a922332e`; the HEAD moved during the run only by evidence and plan commits `667bafd5` and `5c331467`): green. Unit 1966, integration 229, browser-1 126 passed, browser-2 98 passed, checks 14 of 14; full tier since `86d6792d`; run complete.

## T8.8-F4 progress counts every record (lane WR) — 2026-11-15

`81790855` on d08/wr. Every record line read counts toward `done`, including rejected and unparsable ones; Workspace-section lines are left out (they aren't in the header total). Case 1 first-run pass (T8.8-B8 already built it), flagged, mutation check failed with `{ done: 103, total: 102 }`; case 2 red `{ done: 84, total: 102 }` then green. Lane tier: unit 1958 passed with 1 failure (the known flaky `TradeList.test.tsx` Open list states case, `expected 2 to be 3`; 35 of 35 on two reruns), integration 229, checks 14 of 14. Deviation from Q19 recorded as Q26 (not blocking). ocr running.

ocr T8.8-F4 `81790855`: no findings.

## T8.18 Benchmark generator writes the artifact

Verification (the row): `npm run build:bench && npm run bench:generate`. Run in lane BG on 2026-11-15.
- `npm run build:bench`: exit 0. `npm run bench:generate`: exit 0. The generator ran in Node (no browser) and wrote `.cache/bench/benchmark.tjbackup` (git-ignored) and `bench/dataset.json`.
- Counts: 25,000 Trades (200 Open, 100 Planned, 24,700 Closed), 97,127 Position Changes, 187,435 Executions, 7,500 option Trades (3,000 Long Call, 2,000 Long Put, 2,500 Cash-Secured Put), 2,964 Expirations, 106,985 Marks (1,069 corrected), 130,234 Actions, 24,365 Debts (487 Outstanding). These equal the generator-7 browser dataset's counts.
- Artifact: 20,869,681 bytes compressed, 453,413,121 uncompressed, 432,962 lines; full digest `14fadb92184fe981f9e4e29701af5dd0fc22dfd6e11e35be70c8a60692f0d846`; file SHA-256 `48b58c6eb41a0cd03ed7a8ea1af98b38110ba9c7e99bf177f05f096ab6f78af1`. Generation 19 to 21 s.
- Determinism: the artifact file was deleted and regenerated twice; identical file SHA-256 and `bench/dataset.json` identical apart from `generationMs` and `host`.
- Restore in Node: the whole artifact prepared through `Workspace.prepareRestore` (Prepared, not Rejected) on fake-indexeddb in 772 s (throwaway test, not committed). The unit case asserts zero issues and zero repairs on the 40-session artifact.

## Lane BG merged — 2026-11-15

Lane BG rebased onto `fd6c80f2` (structural.md conflict resolved by appending T8.18's section to main's file) and fast-forwarded: T8.18 `268bd353`, B2 and F1 `f9b0fa1c`, lane tier after rebase `48085f90`. Lane tier on the rebased code: unit 1975, integration 229, checks 14 of 14, all exit 0. Smoke artifact (20 sessions, generator 8, schema 7): SHA-256 `e421ba59c2f53f670124131a638ca65fecfe9f3c7cfb97a7180dd076cefc52d2`, 576517 bytes. Lane BG kept for T8.18-F2 (waits on Q25). The merge run comes with the next batch (lane WR).

## Lane WR merged — 2026-11-15

Lane WR (T8.8-F1 to F4) rebased from `ec56950e` onto `fd6c80f2`, which brought in T8.15's Restore fault stages, so the lane tier was rerun: unit 1972, integration 229, checks 14 of 14, all exit 0. Rebased again onto `6d5eeada` (lane BG's bench files only, no overlap) and fast-forwarded: F1 `4ef8fd97`, F2 `c21b06f8`, F3 and F1-B1 `fe81938f`, F4 `6f8aaa91`, lane tier `22d4a9f4`. Merge-20 covers lanes BG and WR.
