# D8 — Backup and Restore: task breakdown

Definition: [implementation plan, D8](implementation-plan.md#d8--backup-and-restore). The definition (stories, capability set, introductions, acceptance claims) stays there and is not repeated here. D8 builds on D1's root and Workspace databases, readiness gate, write gate, and shell (A4, A10, A12, A13, T1.7–T1.10, T1.15, T1.20); D2's candidate database, pointer flip, lifecycle lock, section validators, and repair rule (P6, P7, A30, T2.8–T2.10); and the section validators extended by D4, D5, D6, and D7 (T4.13, T5.5, T6.9, T7.11) ([D7](D07-single-leg-options-happy-path.md), [D6](D06-close-a-long-stock-position.md), [D5](D05-deferred-reflection-and-journal-debt.md), [D4](D04-daily-review.md), [D2](D02-open-a-long-stock-position.md), and [D1](D01-start-a-workspace-and-confirm-a-long-stock-plan.md) breakdowns).

Status: **breakdown agreed by the user on 2026-10-17** (the plan as a whole is still a draft). Decisions P29–P35 were agreed on 2026-10-17 and are recorded as plan decisions 33–39. The amendments in section 1.2 were agreed on 2026-10-17 and applied to the plan index, the technology stack, and the D1, D2, D4, D5, D6, and D7 breakdowns. Everything else is written against those decisions and the working assumptions listed below. **Plan revision 6 (decision 46, 2026-10-24)** carries D2 follow-up F12 into this deliverable ([D2, section 11](D02-open-a-long-stock-position.md#11-deferred-follow-ups-plan-revision-6-decision-46)): T8.6's validation cases add a failing-test-first case for each T2.9 section-validator gap (a Position Change naming a missing Execution, duplicate tradeId or Entry id, fact-version continuity), and D2's B2.12 Open-list Error state gets another trigger once the first gap is fixed.

---

## 1. Decisions and clarifications

### 1.1 Decisions for this breakdown

Numbering continues from D7's P24–P28.

| # | Question | Recommendation | Alternatives and tradeoff |
|---|---|---|---|
| P29 | **How is a mature-size artifact built, digested, and read without exhausting memory?** The mature profile (D1 section 1.3) serializes to roughly 330–400 MB of JSON before compression: about 200,000 Executions, 100,000 Position Changes, 25,000 Plans, 280,000 Journal outcomes, and 190,000 Marks. A browser string of that size is close to the engine limit, and a phone may not hold it at all. The spec requires one coherent snapshot, section and full digests, and a file download (Workspace, "Full backup"); the file representation is unspecified (delivery contract, "Workspace portability"). | **Agreed 2026-10-17: stream everything.** The artifact is gzip-compressed text with **one canonical JSON value per line**: a header line, record lines grouped by section, a closing line per section, and a final manifest line (A123). **Export** runs in a dedicated worker: one IndexedDB `readonly` transaction over every authoritative store, read in batches of 500 with chained `getAll` requests. Each record goes synchronously through its module's export projection, canonical serialization, an incremental SHA-256 (`@noble/hashes`), and a streaming gzip (`fflate`). Because nothing in the transaction awaits anything else, it never auto-commits early. IndexedDB queues every overlapping `readwrite` transaction until it finishes, so a concurrent mutation commits after the snapshot and is wholly outside it (A128). Only the compressed output, about 40 MB at the mature profile, is held as Blob parts. **Verification and Restore** read the selected file as a stream through the native `DecompressionStream`, recomputing digests line by line, so neither holds the artifact in memory. **Two small dependencies are added:** `@noble/hashes` (SubtleCrypto has no incremental digest) and `fflate` (`CompressionStream` is asynchronous, which would end the snapshot transaction). Both are pure JavaScript and MIT-licensed; versions are pinned at plan freeze. This refines the technology stack's "canonical JSON … compressed with `CompressionStream`" (section 1.2). **Tradeoff:** saves on the exported stores wait while a backup runs, which takes an estimated 15 s on a laptop and up to a minute on a phone at the mature profile; the backup screen shows progress and says so. | (a) Build one in-memory JSON document with a disclosed size limit: simplest, but the trader with the most data, who most needs a backup, could not make one. (b) Stream as recommended, but digest with SubtleCrypto over fixed batches of lines and then digest the list of batch digests: no hashing dependency, but a custom digest construction that no standard tool can check. (c) Use `CompressionStream` and re-check a content revision at the end of a multi-transaction read, retrying on change: no compression dependency, but a concurrent mutation would end up inside the retried artifact rather than outside it, as AC-BACK-001 requires. |
| P30 | **Where does preparation build the restored data, and may it write anything?** `prepareRestore` must not change live data. It verifies, migrates, validates, repairs "in the candidate", and returns a nondurable token. `applyPreparedRestore` then replaces every section atomically (Workspace, "Restore"). The overview requires "isolated migration/Restore candidates" and "one atomic all-section replacement" (overview, "Internal Persistence/Transaction obligations"). | **Agreed 2026-10-17: preparation builds the complete candidate database; apply only rechecks and flips the pointer.** `prepareRestore` streams the artifact into a new candidate database (`tj-ws-<uuid>`, listed in the root `candidates` record before it is created, as for migration; D2 A30). It applies any migration transforms and seed additions, validates every section with the existing section validators and Trade Analysis `derive`, applies disclosed repairs, and rebuilds private state, all inside the candidate. No pointer names the candidate, so live data is untouched. `applyPreparedRestore` rechecks readiness, the token, the live target, the safety choice, and each module's candidate section, then activates the candidate with one root transaction (A135). Apply is therefore fast and atomic, and a failure leaves the pointer and the live database exactly as they were. **Consequence:** because preparation writes a database, it needs `Writable` readiness: outside `Writable` it returns `RuntimeNotWritable` and creates nothing. The spec forbids only Restore *application* outside `Writable` (glossary, Recovery Only; UI contract, "Installation and Runtime Readiness"), and an `Unsupported` environment "writes no Workspace or imported data" (ADR 0008), so this is compliant. In `Recovery Only` the Restore section explains that Restore needs a browser that can save safely. | (a) Validate in a streaming pass that writes nothing, then stream the file a second time into the candidate during apply: preview works in `Recovery Only` and preparation writes nothing, but the file is read and validated twice, apply takes as long as preparation, and D12's Mark-evidence checks would need an in-memory observation index. (b) Build the candidate in memory: does not fit at mature scale (P29). |
| P31 | **How does an artifact's version relate to the schema version, and how does Restore migrate an older artifact?** The plan's rule for later deliverables says: "From D8 onward it also bumps the backup artifact version and the Restore migration that goes with it." "Supported older input may migrate forward" (ADR 0006). | **Agreed 2026-10-17: an artifact's content version is the Workspace schema version it was read from, with no separate counter.** The header carries `formatVersion` 1 (the line layout, which changes rarely) and `schemaVersion` (the record shapes). D8 exports schema 6. Restore accepts every schema version this release can migrate from, which is 1 through 6, because the migration chain from schema 1 is kept anyway for update migration. It composes the same per-record transforms that startup migration uses (D2 A30) while streaming the records into the candidate, then validates the result against the current schema with `zod`. Only the current schema needs `zod` record schemas; an exception from a transform on malformed input is reported as `MalformedRecord` with its line number. **Two constraints follow (section 1.2):** (1) a transform may read only authoritative fields, and every private field is computed by the private rebuild after the chain, because artifacts omit private fields. D4's `v2→v3` step, which computes `exposureStart`, therefore moves that computation into the private rebuild that the migrator already runs. (2) The plan rule becomes: "a schema change also freezes a backup fixture at the new version and proves Restore from every earlier backup fixture". | (a) A separate artifact version with a mapping table to schema versions: an extra counter and table, each needing tests, for no behavior the schema version does not already identify. (b) Restore only artifacts at the current schema: every schema change would orphan every earlier backup, contradicting "supported older input may migrate forward". |
| P32 | **Exporting a blocked older database (decision 22).** Decision 22 leaves a failed or not-yet-possible migration intact but unreadable by the new release, and says D8 adds export of a blocked older database, completing AC-REST-004's "exportable". There are two blocked states. **Migration Blocked** (readiness `Writable`, validation failed) is its own result. **`AwaitingMigration`** (readiness failed on the first launch of a schema-changing release) is reported as Integrity Blocked. But the glossary says Integrity Blocked "forbids treating the root as empty, initializing over it, Restore application, or claiming a backup", and the UI contract says an unreadable root never shows "a completed-backup claim". | **Agreed 2026-10-17: export the old database's authoritative records at their own schema version, in both blocked states; offer verification only in Migration Blocked.** The release keeps a layout description for every schema version it can migrate from: authoritative stores and private fields (A149). Export reads the old database raw with that layout and writes an ordinary artifact with `schemaVersion` set to the old version and `exportKind` set to `BlockedDatabase`. Restore of that artifact later migrates it forward like any older artifact (P31). **Migration Blocked** offers Download a copy and Verify, and a verified copy shows Backup complete, because Migration Blocked is not Integrity Blocked. **`AwaitingMigration`** offers Download a copy only, with the explanation "This release can't confirm the copy until your journal has been updated", so it never claims a backup. An unreadable root (true Integrity Blocked) offers neither. Restore stays unavailable in both blocked states, because the target cannot be read by this release. | (a) Transform the old records to the current schema in memory and export at the current schema: one artifact version, but a defect in the transform, which may be why migration failed, would be baked into the trader's only copy. (b) Also verify in `AwaitingMigration`: more reassuring, but it makes the completed-backup claim that the glossary forbids for Integrity Blocked. (c) Reclassify `AwaitingMigration` as `Recovery Only` without reads: `Recovery Only` must preserve ordinary reading (UI contract), which this release cannot do for an older schema (D2 P6). |
| P33 | **Where is Restore offered, when is a safety backup required, and how is it made?** "When user data exists", apply requires "a `CompletedBackupReceipt` bound to the exact live target Workspace or an explicit decline after warning" (Workspace, `applyPreparedRestore`). The UI "offers a safety backup when data exists … declining the backup requires separate acknowledgment" (UI contract, "Corrections and destructive actions"). A different browser receives a Workspace only through a completed backup and Restore "on a `Writable` installation" (delivery contract). | **Agreed 2026-10-17: offer Restore in two places: the new Backup page, and the first-run screen beside Start a new journal.** First run restores into an origin with no Workspace (the candidate is activated by adding the pointer, A135), so moving to a new browser never requires creating and then replacing an empty journal. **User data exists** when the target has any Trade, Journal Entry, decline, or Debt, any Mark or acknowledgment, or any Institution or Account; seeds and the time-zone setting alone are not user data (A137). When user data exists, the confirmation step has a required safety choice: **Back up this journal first (recommended)** runs Download backup bound to the preview's target, then asks for the saved file and verifies it in place. **Replace without a backup** shows a warning with its own acknowledgment checkbox. Replace entire journal stays disabled until the replacement checkbox is ticked and the safety choice is complete (A142). Apply rechecks that the receipt was issued in this session and is bound to the live binding (A131, A135). | (a) Backup page only: a new browser must initialize an empty journal and then replace it, which is harmless (no user data, so no safety choice) but is an extra, confusing step. (b) A safety backup required even with no user data: blocks first-run Restore for no protective benefit. (c) Accept a receipt from an earlier session: the spec requires the exact live target, and a receipt from an earlier session would need durable storage of pending verification, which ADR 0010 rules out. |
| P34 | **AC-BACK-001, AC-REST-001, and AC-LIFE-003 presume data kinds that arrive after D8** (review queue, "Deferred to task breakdown", items 3 and 4). AC-BACK-001's Given includes corrections and Voids (D13, D15), Daily Bars and the provider credential (D11), revised definitions (D26), and renamed or retired references (D23). AC-REST-001's "no provider is contacted" is meaningful only once a provider exists (D11). AC-LIFE-003's agreed records gain Planned-Leg Terms and Unplanned Exposure in D10 and Stop Discipline in D12. | **Agreed 2026-10-17: make backup round trip a cumulative obligation, and move the full points.** Add a row to the plan's cumulative obligations: every deliverable that adds or changes stored data extends the round-trip integration case (export, verify, Restore into an empty origin, equal views and identities) to its new record kinds; when it changes the schema, it freezes a backup fixture and restores every earlier one (P31). AC-BACK-001 and AC-REST-001 become cumulative, partial until D28 like the other cumulative scenarios. D8 establishes every clause it can, D11 adds credential exclusion and provider non-contact, and the others add their kinds. AC-REST-002, AC-REST-003, AC-REST-004, and AC-DEL-005 stay full in D8. AC-LIFE-003 becomes full in **D12**, the last deliverable to add an agreed record kind. D10 and D12 each prove a disagreement fixture for their new kinds through normal reads, mutation preparation, and Restore preparation. | (a) Keep the coverage index as it is (AC-BACK-001 full in D11, AC-REST-001 and AC-LIFE-003 full in D8): those claims would be false, because their Givens include data that does not exist yet. (b) Defer AC-BACK-001 and AC-REST-001 entirely until D26: their mechanisms would go unclaimed for eighteen deliverables. |
| P35 | **How is the benchmark dataset "loaded through a real Restore" (D2 section 1.3; decision 18)?** The acceptance contract allows Givens built from "authoritative domain commands or a validated restored Workspace". | **Agreed 2026-10-17: from D8, the generator writes the dataset directly as a backup artifact, and the benchmark loads it through the production Restore flow.** The generator emits deterministic schema-6 records with the same mature mix (D7 section 1.4) and its own expected values, using the production artifact writer (T8.1). `bench:setup` then restores the artifact into a fresh profile through the first-run Restore screen of the production build. It requires zero repairs and zero issues, and caches the restored profile. Generation no longer drives 200,000 domain commands through the browser. **Capacity (decision 18):** after that Restore, `measure:capacity` records the real usage and `verify:capacity` fails if it exceeds the projection for the same counts by more than 10%. The same artifact is then restored once over the restored Workspace, and peak usage during that second Restore (live plus candidate) must stay within the `3 × M` requirement. | (a) Keep generating through domain commands, then export and restore the result: proves the same things but keeps the slow generation, which takes over an hour at the mature profile. (b) Measure capacity only from the D1-style 500-Plan sample: the spec-level check that the projection matches a real mature Workspace would never happen. |

**Clarification agreed 2026-10-17 (credentials).** The user asked whether backups should include Pricing Provider API keys or login credentials. The spec excludes them (Workspace, "Full backup" and Restore; Market Data, "Provider configuration"; delivery contract, "Workspace portability"; AC-BACK-001), and a backup is an unencrypted ordinary download. The user chose to keep them out rather than reopen the spec for a password-encrypted credential section. D11 keeps the nonsecret provider settings in the backup, lists "needs its API key again" in the Restore preview, and shows the restored provider as Needs Setup with an "Enter your API key" action (review queue, "Raised by the D8 breakdown").

### 1.2 Amendments to other plan sections (agreed 2026-10-17 and applied)

- **Plan rules, "Durable-representation changes carry their migration" (P31).** Replace "From D8 onward it also bumps the backup artifact version and the Restore migration that goes with it" with: "From D8 onward, the new schema version is also the backup content version: the deliverable freezes a backup fixture at that version (produced by its own `exportBackup`) and proves Restore from every earlier backup fixture through the same per-record transforms."
- **Cumulative obligations (P34).** Add the row "Backup round trip (AC-BACK-001, AC-REST-001): each deliverable that adds or changes stored data extends the round-trip case to its new record kinds; each schema change freezes a backup fixture and restores every earlier one." Move AC-BACK-001 and AC-REST-001 to "D28 (cumulative)" in the coverage index, and AC-LIFE-003 to D12. The D10, D11, and D12 definitions are not edited here (they are outside this breakdown's reading scope); their changes are listed under "Raised by the D8 breakdown" in the review queue.
- **D2 (P31, A139, A140).** A30: transforms read only authoritative fields, and private fields come only from the private rebuild after the chain. T2.9's seam `validateSection(snapshot)` takes a batched record source and keeps only identity sets between batches, so migration and Restore validate a mature Workspace in bounded memory; its cases are unchanged. The same seam change applies to T4.13, T5.5, T6.9, and T7.11. A31's "(and, from D8, backup export)" becomes Download a copy and Verify (P32).
- **D4 (A139).** T4.3's `v2→v3` case "add exposureStart to each Trade document from its first opening Execution" moves to the private rebuild run after copying; the transform case keeps the other effects.
- **D1.** A13's copy is replaced by A143's. T1.20's "Updated in another tab" case gains a second reason, "replaced by a Restore in another tab" (A136).
- **Decision 2** gains: "Ended by D8: `Recovery Only` offers backup export and verification, and the not-protected warning recommends a backup."
- **Technology stack, "Backup, verification, and migration" (P29).** The artifact is gzip-compressed canonical JSON lines; export compresses with `fflate` and digests with `@noble/hashes` inside one read-only transaction in a worker; verification and Restore decompress with `DecompressionStream`.
- **RC.** RC repeats B8.1, B8.3, B8.8, and B8.10 in Firefox and WebKit with real browser state, including each engine's handling of the `.tjbackup` download and file selection.
- **D8 definition.** Add: Restore is also offered on the first-run screen (P33); preparation needs `Writable` readiness (P30); the blocked-database copy (P32); acceptance list changes per P34.
- **Review queue.** Strike "Deferred to task breakdown" items 3 and 4 (P34), D6 item 2 (A132, I8.7), and D7 item 1 (T8.2, I8.1). Add "Raised by the D8 breakdown" for D10, D11, D12, D13, D15, and every data-adding deliverable.
- **Recorded decisions.** P29–P35 become plan decisions 33–39; decision 2 is marked ended by D8, and decision 22 points to decision 36.

### 1.3 Working assumptions

Numbering continues from D7's A99–A122. These are implementation-level choices that do not reopen product semantics. They stand unless you object.

| # | Assumption |
|---|---|
| A123 | **Artifact lines (format version 1).** UTF-8 text, one canonical JSON value per line, each ending in LF. Canonical JSON: object keys sorted by UTF-16 code units, no insignificant whitespace, the shortest JSON string escapes, and numbers only as safe integers; every decimal is already a string (D1 A9), so a fractional or non-finite number is rejected. Line kinds: `header` (format and schema versions, export kind `Normal` or `BlockedDatabase`, created instant, source binding, release identity, section order, and per-store record counts read in the snapshot transaction); `record` (`{"s":section,"t":store,"r":record}`); `sectionEnd` (section, per-store counts, section digest = SHA-256 over that section's record lines); and the final `manifest` (the Workspace Backup Manifest: format and schema versions, capability footprint, counts, exclusions, section digests, and the full digest = SHA-256 over every line before it). The manifest digest is SHA-256 over the manifest line without its LF. |
| A124 | **File name and type.** `trade-journal-<YYYY-MM-DD>-<HHmm>-<first 8 hex digits of the full digest>.tjbackup`, with the date and time in the Workspace zone, offered as `application/octet-stream`. The extension is not `.gz`, so no browser decompresses the file on save. Readers sniff the gzip magic bytes and also accept the same content uncompressed, because digests are over the uncompressed lines. |
| A125 | **Sections and stores at schema 6,** in this order: `workspace` (time zone and settings revision, Journal and Catalog seed-manifest versions, session-policy identity), `catalog`, `marketData` (`observations`), `trades`, `journal` (`journalTypes`, `journalDefinitions`, `journalEntries`, `journalDeclines`, `journalDebts`). Records are in primary-key order. **Excluded:** the root database (pointer, candidates, diagnostics), `journalObligations`, every IndexedDB index, the Trade fields `exposureStart`, `terminalTime`, `activityDesc`, and `terminalDesc`, the Workspace content revision, and `marketDataRevision`. The manifest's `exclusions` list names these, plus the categories that never exist in storage (credentials, unsaved forms, raw provider payloads, diagnostics, reports, replay projections, cursors). Per-key `resolutionRevision` counters stay in their observation records. |
| A126 | **Capability footprint:** the set of data-kind identifiers present in the records, at schema 6: `instrument.stock`, `instrument.option`, `positionChange.execution`, `positionChange.expiration`, `plan.exerciseIntent`, `trade.closeReason`, `trade.deviation.entrySize`, `journal.entry`, `journal.decline`, `journal.debt`, `marketData.mark`, `marketData.acknowledgment`, `catalog.institution`, `catalog.account`, `catalog.strategy`, `catalog.closeReason`. Restore recomputes it from the records; a manifest footprint that differs is `ManifestMismatch`, and an identifier the release does not support is `UnsupportedDataCapability`. |
| A127 | **`WorkspaceSnapshotBinding` names the Workspace database as well as its content revision** (refines D1 T1.7). A restored Workspace lives in a new database, so no binding, receipt, or token from before a Restore can ever match one taken after it, even when content revisions coincide. |
| A128 | **Export pipeline.** A dedicated module worker (`src/workers/backup-export.ts`, in the Offline Release Inventory) opens the database, starts one `readonly` transaction over the layout's authoritative stores, reads the `meta` record and every store's `count()` first, then chains `getAll(lowerBound(lastKey, open), 500)` requests in their success callbacks. Projection, canonical serialization, hashing, and gzip are synchronous inside those callbacks; a callback that returns a promise trips D1's early-auto-commit guard. The worker posts progress (records done of the counted total) and finally the Blob and digests. The main thread offers the Blob with an object URL and a `download` anchor, revoking the URL after 60 s. In Node the same pipeline runs in process (section 6.0). |
| A129 | **`exportBackup` results.** `Downloaded { sourceBinding, fullDigest, manifestDigest, fileName, counts, byteSize }`. `Conflict { currentBinding }` when an expected binding was supplied and differs (checked from `meta` inside the snapshot transaction). `NotCompleted { stage: Read \| Offer, reason, workspaceBinding }`, where the binding shows the Workspace unchanged. Export never passes the write gate; it is available in `Writable`, `Recovery Only`, Migration Blocked, and `AwaitingMigration`, and returns `NotCompleted(IntegrityBlocked)` without reading for an unreadable root. |
| A130 | **`confirmBackup` checks.** It streams the selected `File` (sniffing gzip), decodes UTF-8 with `fatal: true`, splits lines, and recomputes every section digest and the full digest. It parses only the header, section-end, and manifest lines with `zod`, and checks per-store line counts against them. Results: `Completed { receipt }`; `NotVerified(Unreadable)` when the file cannot be read or is not UTF-8; `NotVerified(IncompleteOrCorrupt)` for a gzip error, a missing or malformed header or manifest, a count mismatch, or a digest that does not match the file's own manifest; `NotVerified(DifferentArtifact)` for a complete, self-consistent artifact whose full digest or source binding differs from the expected values. The receipt holds a receipt identity, the source binding, full and manifest digests, verification evidence (file name, byte size, compressed or not, line count), and the completion instant. Nothing is written. |
| A131 | **Receipt registry.** Workspace keeps the identities of receipts it issued in this application instance in memory. `applyPreparedRestore` accepts only those. Nothing is stored, so after a reload the trader verifies again (ADR 0010). |
| A132 | **Restore preparation pipeline,** under the exclusive `tj-lifecycle` lock, on the main thread with a yield between batches: (1) recheck readiness, which must be `Writable`; (2) read and validate the header, rejecting `UnsupportedFormat` or `UnsupportedNewerSchema` before anything is written; (3) capacity pre-check (A138); (4) delete this session's earlier Restore candidate, then list and create a new candidate at the current layout; (5) stream records in batches of 500: parse JSON, check the line envelope, apply the composed transforms from the artifact's schema to 6, parse with the current strict `zod` record schema, and write; recompute digests and counts as lines pass; (6) at the end, check every section digest, the full digest, the counts, and the footprint; (7) add seed-manifest additions, and revalidate observation keys if the session-policy identity differs (D4 A40); (8) validate each section with its module's validator and close cross-section references (Accounts, Strategies, Close Reasons, Trade and Execution Anchors, Journal origins, Debt links); (9) derive every Trade and apply repairs for coherent lifecycle and Deviation disagreement (decision 23; Lot Matches are derived, decision 30); (10) rebuild private state; (11) record per-store counts and per-section digests of the finished candidate in its own `meta`. Any rejection deletes the candidate. The token holds the candidate identity, the artifact's full digest, the live target binding (or `NoWorkspace`), and the release identity. |
| A133 | **Preview contents:** the source (created instant in the Workspace zone, release identity, schema version, export kind); exact counts per record kind, with the number of versions for kinds with history: Trades by lifecycle, Position Changes, Executions, Expirations, Deviation occurrences, Entries by Entry Type, declines, Debts by status, Marks, acknowledgments, Institutions, Accounts, Strategies, Close Reasons, and Entry Definition revisions; migrations (each schema step and every seed addition); repairs (Trade, kind, stored and expected values); provider Needs Setup (empty until D11, and then the section is omitted); the target impact (whether user data exists, the current counts of the same kinds, and the current and restored time zones); warnings (`TimeZoneDiffers`, `OlderSchema`, `AnotherTabHasUnsavedWork`); and whether a safety choice is required. |
| A134 | **Rejection issues** are typed with stable codes: `UnsupportedFormat`, `UnsupportedNewerSchema`, `InsufficientCapacity`, `MalformedRecord(line, path)`, `DigestMismatch(section)`, `IncompleteArtifact`, `ManifestMismatch`, `UnsupportedDataCapability`, the module validators' codes (for example `DuplicateIdentity`, `MissingReference`, `IncoherentFacts`, `PriceNegative`), and `CrossSectionReference(kind, identity)`. The result lists the first 200 issues in artifact order, with the total count. Every rejection also carries the unchanged live binding. |
| A135 | **`applyPreparedRestore` order.** (1) The mutation guard reruns readiness and returns `RuntimeNotWritable` outside `Writable` (D1 A4). (2) Under the lifecycle lock: `ConfirmationRequired` without `ReplaceEntireWorkspace`; `PreparationNotFound` when the candidate is no longer listed; `Conflict(TargetChanged)` when the live binding differs from the token's. (3) Safety choice, when the target has user data: `SafetyBackupRequired` without a receipt or an acknowledged decline; `SafetyBackupNotRecognized` for a receipt not issued by this instance; `SafetyBackupStale` for a receipt bound to another binding. (4) Each fact module's `applyPreparedRestore` rechecks its candidate section's counts and digest against the candidate's `meta`, returning `CandidateChanged(store)` on a difference. (5) One root transaction switches the pointer to the candidate, removes the candidate entry, and lists the old database as retired. With no Workspace, it adds the pointer instead, failing with `AlreadyInitialized` if one appeared (D1 A12). Any failure in (2)–(5) deletes the candidate unless it is only a missing confirmation or safety choice, and leaves the pointer and live database unchanged. |
| A136 | **After activation:** the session switches its connection to the new database and broadcasts `WorkspaceReplaced` over the `BroadcastChannel` that D1 A5 uses. It deletes the retired database, which also sends `versionchange` to any other tab as a fallback, and reruns all four readiness checks. The result is `Restored { receipt, status, landing }`. The receipt holds the artifact digest, the replaced binding or `NoWorkspace`, the new binding, counts, migrations, repairs, and readiness evidence. `status` is the fresh `WorkspaceStatus`, which is `Recovery Only` if the rerun fails, and `landing` is `RestoreComplete` with the next destination (Trades, or Institution and Account onboarding when no selectable Account exists). Another tab shows "This journal was replaced by a Restore in another tab. Reload to continue.", keeping any entered values on screen, and its next commit returns `RuntimeNotWritable`. |
| A137 | **User data exists** when the target holds any Trade, Journal Entry, decline, or Debt, any observation record, or any Institution or Account. Seeded Catalog and Journal records and the time-zone setting alone are not user data. |
| A138 | **Restore candidate bookkeeping and capacity.** A root `candidates` entry gains `purpose` (`Migration` or `Restore`) and the application instance's session identity; it is a record field, not a root schema change. A new preparation deletes the same session's earlier Restore candidate first; Cancel and leaving the Restore flow delete it; root inspection at every launch still deletes every listed candidate the pointer does not name (D2 T2.8). Before creating the candidate, preparation projects its on-disk size from the header's counts and the capacity basis's per-record bytes, and rejects with `InsufficientCapacity` (available and required bytes) when `quota − usage` is smaller, writing nothing. |
| A139 | **Per-record transforms read only authoritative fields** (P31). Private fields and stores are produced only by the private rebuild after the whole chain, in migration and in Restore. A Restore test from every backup fixture (I8.12) enforces this. This amends D2 A30 and D4 T4.3 (section 1.2). |
| A140 | **Section validators take a batched record source** and keep only identity sets between batches; their cases are unchanged (section 1.2). Restore and migration validate a mature Workspace with memory bounded by identity sets: about 600,000 identities, roughly 50 MB. |
| A141 | **Backup page.** Download backup shows progress, then "Downloaded, not verified yet. This app can't see where your browser saved the file." with the file name and a Verify backup action. Verify backup opens ordinary file selection and shows "Backup complete" with the completion time only for `Completed`; each Not Verified reason has its own plain-language message and "Choose another file". The Downloaded result lives only in this page's view state; leaving the page forgets it. A note says saves wait while a backup is being made (P29). |
| A142 | **Restore flow,** on the Backup page and on the first-run screen: (1) **Choose backup file**, then "Checking the backup. Your current journal is not changed.", with progress and Cancel; (2) **Preview** headed "Restoring replaces your entire current journal", with A133's contents and the restored counts beside the current counts; (3) **Confirm**: the checkbox "I understand this replaces my entire current journal", the safety choice when user data exists (P33) as a radio group, and **Replace entire journal**. Back up first runs the backup page's download and verify steps inline, with the token's target as the expected binding; a `Conflict` there says the journal changed and offers Check the backup again. Replace without a backup reveals the warning "If this backup is wrong or incomplete, your current journal cannot be recovered." and its acknowledgment checkbox. On success the flow discards every pre-Restore view and form and renders the Restore complete summary from the result alone. A rejected or conflicting apply says "Your current journal is unchanged" and offers Check the backup again. |
| A143 | **Shell copy.** `Recovery Only` (replacing D1 A13): "Another browser has its own separate storage and would start an empty journal. To move this journal, download a backup here and verify it, then restore it in a browser that can save safely." The not-protected warning gains "Download a backup and verify it to keep a safe copy." with a link to the Backup page. Migration Blocked gains Download a copy and Verify; `AwaitingMigration` gains Download a copy with P32's explanation. First run offers **Restore from a backup** beside **Start a new journal**, only while `Writable`. |
| A144 | **Navigation:** a Backup destination in both the narrow bottom bar and the wide sidebar, also listed in `Recovery Only` (with Trades, Accounts, Review, and About). Its Restore section is replaced in `Recovery Only` by "Restore needs a browser that can save safely" and the failed checks. |
| A145 | **Installed Capability Manifest v7** adds `exportBackup` (Normal and BlockedDatabase), `confirmBackup`, `prepareRestore`, `applyPreparedRestore`, and the backup ranges: export schema 6 in format 1; Restore from schemas 1 through 6 in format 1. The fact modules' Restore operations are internal and do not appear. |
| A146 | **Previous release:** the harness builds the D7 release from the tag `claude-opus-5.5-d7`, exported with `git archive` and never as a worktree (D2 A34). |
| A147 | **Backup fixtures** are committed and never regenerated: `tests/fixtures/backup-v6/` is `exportBackup` of the `workspace-v6/` fixture at Friday 2026-11-20 18:00; `tests/fixtures/backup-v1-blocked/` through `backup-v5-blocked/` are the blocked-database exports of `workspace-v1/` through `workspace-v5/`. Each is stored with its Downloaded result and the expected normalized views after Restore. |
| A148 | **Where the work runs.** Export runs in a worker (P29). Verification and preparation run on the main thread as streams, yielding between batches, so the page stays responsive without moving the modules into a worker. Export, verification, and preparation all report progress; Cancel is offered for preparation. |
| A149 | **Layouts per schema version** sit beside the migration chain: for each version 1 through 6, the authoritative stores and the private fields to omit. The blocked-database export uses the stored version's layout; a database whose version has no layout returns `NotCompleted(UnknownLayout)`. |

### 1.4 Benchmark dataset at D8

The mature mix and as-of instant are unchanged from D7 section 1.4. What changes is how the dataset is made and loaded (P35): `bench:generate` writes it as a schema-6 backup artifact (about 40 MB compressed), and `bench:setup` restores that artifact through the production first-run Restore. `bench/dataset.json` adds the artifact's full digest, byte size, uncompressed size, per-store counts, and the Restore timings.

---

## 2. Implementation boundaries added or extended in D8

| Canonical boundary | Code location | D8 operations |
|---|---|---|
| Backup format (pure) | `src/backup/format/` (new) | canonical JSON; line kinds; artifact writer (gzip and incremental SHA-256); artifact reader (decompression, lines, digests) |
| Workers | `src/workers/backup-export.ts` (new) | the export pipeline in one read-only transaction |
| Trade Record | `src/modules/trade-record/` | `exportSnapshot`, `prepareRestore` (record schema, section validation, Trades for derivation), `applyPreparedRestore` (candidate recheck) |
| Journal | `src/modules/journal/` | the same three |
| Market Data | `src/modules/market-data/` | the same three |
| Reference Catalog | `src/modules/reference-catalog/` | the same three |
| Workspace | `src/coordinators/workspace/` | `exportBackup` (Normal and BlockedDatabase), `confirmBackup`, receipt registry, `prepareRestore`, `applyPreparedRestore`, backup safe actions in status, Installed Capability Manifest v7 |
| Persistence/Transaction (internal) | `src/persistence/` | export snapshot read; layouts per schema; Restore candidates and activation by add or switch |
| Delivery (browser-host seams) | `src/delivery/` | file download port; file selection port |
| UI | `src/ui/` | Backup page, Restore flow, shell and first-run changes, blocked views |

---

## 3. Task graph

Kind: **B** = behavioral (TDD, red→green per case), **S** = structural (exact verification).

| Task | Title | Layer | Kind | Blocked by | Public seam under test |
|---|---|---|---|---|---|
| T8.1 | Artifact format: canonical JSON, writer, reader | domain/infrastructure | B | D1 T1.1 | `src/backup/format` exports |
| T8.2 | Fact modules: `exportSnapshot` | domain | B | T8.1, D7 T7.8–T7.10 | each module's `exportSnapshot` |
| T8.3 | Persistence: export snapshot read and layouts per schema | persistence | B | D7 T7.7 | internal `Persistence` interface |
| T8.4 | Workspace: `exportBackup` | application | B | T8.1–T8.3 | `Workspace.exportBackup` |
| T8.5 | Workspace: `confirmBackup` and the receipt registry | application | B | T8.4 | `Workspace.confirmBackup` |
| T8.6 | Fact modules: `prepareRestore` and `applyPreparedRestore` | domain | B | T8.1, D7 T7.11 | each module's `prepareRestore`, `applyPreparedRestore` |
| T8.7 | Persistence: Restore candidates and activation | persistence | B | D2 T2.8 | internal `Persistence` interface |
| T8.8 | Workspace: `prepareRestore` | application | B | T8.4, T8.6, T8.7 | `Workspace.prepareRestore` |
| T8.9 | Workspace: `applyPreparedRestore` | application | B | T8.5, T8.8 | `Workspace.applyPreparedRestore` |
| T8.10 | Workspace: backup safe actions in status | application | B | T8.4 | `Workspace.getStatus`, `initialize` |
| T8.11 | Composition root, worker, host ports, Installed Capability Manifest v7 | application | S | T8.4–T8.10 | `verify:capabilities` |
| T8.12 | UI: Backup page (download and verify) | UI | B | T8.11 | `BackupView` |
| T8.13 | UI: Restore flow | UI | B | T8.11 | `RestoreFlow` |
| T8.14 | UI: shell, warnings, blocked views, first run | UI | B | T8.11 | `AppShell`, `FirstRun`, `MigrationBlockedView`, `IntegrityBlockedView` |
| T8.15 | Faults build: backup and Restore stages | test | S | D1 T1.27 | `build:faults`, `verify:no-fault-hooks` |
| T8.16 | Release harness: previous release from the `claude-opus-5.5-d7` tag | test | S | D7 T7.25 | `build:releases`, `verify:releases` |
| T8.17 | Freeze the backup fixtures | test | S | T8.11 | `fixtures:freeze-backup`, `verify:fixtures` |
| T8.18 | Benchmark generator writes the artifact | test | S | T8.1, T8.11, D7 T7.28 | `build:bench`, `bench:generate` |
| T8.19 | Benchmark through Restore; capacity check; backup timings | test/infrastructure | S | T8.18 | `bench:setup`, `bench:run`, `measure:capacity`, `verify:capacity` |
| T8.20 | Node mock-free integration suite | test | S | T8.11 | `test:integration` |
| T8.21 | Browser integration suite (Chromium) | test | S | T8.12–T8.17 | `test:e2e` |
| T8.22 | Independent browser-critic gate | test | S | all | fresh critic report |

**Parallel tracks.** Once the line kinds (A123), the preview and result shapes, and the token are fixed in T8.11's type module, four tracks proceed in parallel:
- **Format and export** (T8.1–T8.5).
- **Restore** (T8.6–T8.9), joining the format track at T8.8.
- **UI** (T8.12–T8.14), against the facade test double.
- **Test infrastructure** (T8.15–T8.19).

---

## 4. Behavioral tasks

Every case runs **red → green** individually, as the kickoff prompt requires. A case that passes on its first run, or fails for a syntax, configuration, fixture, or unrelated reason, is not valid red evidence; it must be fixed and rerun to a genuine red, never logged and skipped. Cases are ordered so that each one targets behavior the previous cases did not need. Properties that would pass for free are folded into the case that creates them or proven only by an integration case, and each such fold is named below.

**W6** is the frozen `workspace-v6/` fixture (D7 T7.27): D6's content plus O-C through X1 with Settlement Due, O-S expired with a deferred Close Review, O-P closed by Q1, and a Planned Long Call with Exercise Intent Authorized. Its per-store counts are those of the committed dump. Exports run at **Friday 2026-11-20 18:00** New York time unless stated. **A6** is `backup-v6/`, W6's artifact.

**Artifact fixtures.** The artifact fixture writer (section 6.0) edits decompressed lines and, unless stated, recomputes every digest, so that only semantic validation can catch the edit:
- **R-lc**: D6's Closed T-A with stored lifecycle Open (a coherent disagreement).
- **R-dev**: an Open Trade's recorded Entry Size occurrence removed (coherent).
- **R-inc**: an Execution naming an unknown Planned Leg (incoherent).
- **R-ref**: a Trade naming an unknown Account.
- **R-anchor**: a Position Change Reflection Entry anchored to an unknown Execution.
- **R-dup**: one fact identity used by two Executions.
- **R-flip**: one character of a `trades` record changed, digests **not** recomputed.
- **R-cut**: the compressed file cut at half its length.
- **R-new**: header `schemaVersion` 7.
- **R-bad**: one line that is not JSON, and one record missing its `economicTime`.
- **A5b**: `backup-v5-blocked/`, a schema-5 artifact.

### T8.1 Artifact format

Seam: `src/backup/format` exports `canonicalJson`, `ArtifactWriter`, and `readArtifact` (pure apart from the stream API).

```text
describe("canonical JSON (A123)")
  it should serialize {"b":1,"a":"xé"} and {"a":"xé","b":1} to the identical text {"a":"xé","b":1}, with keys sorted by UTF-16 code units and no whitespace
  it should reject 1.5, NaN, undefined, and a Date with CanonicalJsonUnsupported naming the path

describe("ArtifactWriter")
  it should write header, record, section-end, and manifest lines whose section digests and full digest equal SHA-256 computed over the same lines concatenated by the test
  it should accept records pushed one at a time with no await between pushes and produce gzip output that decompresses to exactly the lines written

describe("readArtifact")
  it should yield the same lines and digests from the gzip file and from its uncompressed text
  it should report Truncated when the stream ends before the manifest line, and Corrupt for invalid gzip data or text that is not UTF-8
```

### T8.2 Fact modules: `exportSnapshot`

Seam: each module's `exportSnapshot`, a synchronous section exporter fed W6's stores in key-ordered batches.

```text
describe("Trade Record section (A125, D7 review-queue item 1)")
  it should emit every Trade document in key order with each fact identity and its version list, Recorded Sequence, stored lifecycle record, recorded Deviation occurrence, Close Reason, Exercise Intent, option Instrument, and Expiration member, and without exposureStart, terminalTime, activityDesc, or terminalDesc
  it should report the footprint instrument.stock, instrument.option, positionChange.execution, positionChange.expiration, plan.exerciseIntent, trade.closeReason, and trade.deviation.entrySize for W6

describe("Journal section")
  it should emit Entry Types, Sources, every definition revision, every Entry with its version list, declines, and Debts with their version history, and nothing from journalObligations

describe("Market Data section")
  it should emit every observation record with its Mark and acknowledgment chains, effective heads, and resolutionRevision, including W6's Marks of 0

describe("Catalog and Workspace sections")
  it should emit every Institution, Account, Strategy, and Close Reason with origin, label and availability revisions, immutable shape, and seed key, and a workspace record with the time zone, settings revision, seed-manifest versions, and session-policy identity, but neither content revision counter
```

Proven only by integration: the absence of every excluded category from a whole artifact (I8.3), which these cases establish store by store.

### T8.3 Persistence: export snapshot read and layouts

Seam: the internal `Persistence.readExportSnapshot(database, layout, onBatch)` and the layout table, against `fake-indexeddb`.

```text
describe("one read snapshot (P29, A128)")
  it should read every store of the schema-6 layout in one readonly transaction, in key order and batches of 500, calling onBatch synchronously, and return the meta record and per-store counts read first in that transaction
  it should leave a readwrite commit started after the snapshot began waiting until the read finishes, so no batch contains its record and the commit then succeeds with a later content revision
  it should fail with EarlyAutoCommitGuard when onBatch returns a promise, and with ReadFailed naming the store when a request errors, returning no batches after the failure

describe("layouts per schema (A149)")
  it should read a schema-5 database with the schema-5 layout, and return UnknownLayout for a database whose meta names schema 9
```

### T8.4 Workspace: `exportBackup`

Seam: `Workspace.exportBackup`, with the in-process export port and `NodeTestHost`'s download port.

```text
describe("Downloaded (AC-BACK-001)")
  it should return Downloaded for W6 with the source binding, full and manifest digests, file name trade-journal-2026-11-20-1800-<8 hex>.tjbackup, per-store counts, and byte size, hand exactly that file to the host once, and leave the content revision unchanged
  it should write a manifest with formatVersion 1, schemaVersion 6, export kind Normal, the footprint, counts, section digests, full digest, and the exclusions of A125

describe("failures")
  it should return Conflict with the current binding and offer no file when the expected binding differs
  it should return NotCompleted(Read) with the unchanged binding and offer no file when the snapshot read fails

describe("blocked databases (P32)")
  it should export a Migration Blocked schema-5 database as export kind BlockedDatabase with schemaVersion 5 and the schema-5 layout, and return NotCompleted(IntegrityBlocked) for an unreadable root without opening it
```

Proven only by integration, because they pass for free once these cases are green: export in `Recovery Only` (I8.5), which takes the same path because export never passes the write gate; identical section digests from two exports with no change between them (I8.1); and the `AwaitingMigration` export (I8.10), which differs from Migration Blocked only in status.

### T8.5 Workspace: `confirmBackup` and the receipt registry

Seam: `Workspace.confirmBackup`, with files built from A6's bytes.

```text
describe("Completed (A130)")
  it should return Completed for A6 with the expected binding and digest, with a receipt holding the source binding, full and manifest digests, file name, byte size, compressed true, line count, and completion instant, writing nothing

describe("Not Verified")
  it should return IncompleteOrCorrupt for R-cut and for R-flip, DifferentArtifact for a second export of W6 made after one Mark save, and Unreadable when the file read fails, each with no receipt

describe("receipt registry (A131)")
  it should recognize a receipt issued by this instance, and not one issued before a restart on the same storage
```

Proven only by integration: verifying the uncompressed form of the same artifact (I8.1), which T8.1's reader case already guarantees.

### T8.6 Fact modules: `prepareRestore` and `applyPreparedRestore`

Seam: each module's `prepareRestore` (record parsing at the current schema and section validation over a batched candidate source) and `applyPreparedRestore` (candidate recheck).

```text
describe("record parsing at schema 6 (P31)")
  it should accept every A6 record of its module and reject an extra field, a missing field, and a price that is a number rather than a decimal string as MalformedRecord naming the line and path

describe("section validation in a Restore candidate")
  it should return Trade Record's repairs for R-lc (Lifecycle, stored Open, expected Closed) and R-dev (Deviation create), and Trade Record's issues for R-inc and R-dup, with the restored Trades supplied for derivation

describe("applyPreparedRestore recheck (A135)")
  it should accept a candidate section whose counts and digest equal those recorded in the candidate's meta, and return CandidateChanged naming journalEntries when one Entry was removed from the candidate after preparation
```

Folded: the Journal, Market Data, and Catalog validators' issue codes are already proven by D2–D7; they are exercised through Restore by T8.8 and I8.7.

### T8.7 Persistence: Restore candidates and activation

Seam: the internal `Persistence` interface (`createCandidate`, `activateCandidate`, `discardCandidate`), against `fake-indexeddb`.

```text
describe("Restore candidates (A138)")
  it should list a Restore candidate with purpose Restore and this instance's session identity before creating it, and delete this session's earlier Restore candidate when a new one is listed
  it should refuse to create a candidate outside Writable with RuntimeNotWritable, creating no database

describe("activation without a Workspace (A135)")
  it should activate a candidate by adding the pointer when none exists, and fail with AlreadyInitialized, deleting the candidate, when a pointer was added meanwhile
```

Folded: switching the pointer, retiring the old database, and discarding a candidate are D2 T2.8's cases, reused unchanged.

### T8.8 Workspace: `prepareRestore`

Seam: `Workspace.prepareRestore`, against `fake-indexeddb`. Unless stated, the target is a second Workspace **W-t** holding one Institution, one Account, and one Planned Trade, with time zone America/Chicago.

```text
describe("valid artifact (AC-REST-001, A133)")
  it should prepare A6 and return a preview with the source (created Fri 20 Nov 2026 18:00, release, schema 6, Normal), A6's exact counts per kind with version counts, no migrations, no repairs, the target impact (user data present, W-t's counts, time zones America/Chicago and America/New_York), the warning TimeZoneDiffers, and safety choice required, leaving W-t's binding and every live store unchanged

describe("rejections before anything is written")
  it should reject R-new with UnsupportedNewerSchema and a header with formatVersion 2 with UnsupportedFormat, creating no candidate
  it should reject with InsufficientCapacity, naming available and required bytes, when the projected candidate exceeds quota minus usage, creating no candidate

describe("rejections after staging (A134)")
  it should reject R-flip with DigestMismatch(trades), R-cut with IncompleteArtifact, R-bad with two MalformedRecord issues naming their lines, and a manifest footprint missing instrument.option with ManifestMismatch, deleting the candidate each time
  it should reject one artifact holding R-ref, R-anchor, R-dup, and R-inc with all four issues, cross-section ones as CrossSectionReference, and delete the candidate

describe("repairs (AC-LIFE-003, decision 23, D6 review-queue item 2)")
  it should prepare an artifact holding R-lc and R-dev with both repairs listed with stored and expected values, and leave the candidate holding T-A as Closed and the restored occurrence

describe("older artifact (P31, P32)")
  it should prepare A5b through the 5→6 transforms, list the migration step and the seed additions Long Call, Long Put, and Cash-Secured Put, and warn OlderSchema

describe("availability (P30)")
  it should return RuntimeNotWritable and create no candidate in Recovery Only, and prepare A6 with target NoWorkspace and no safety choice when no Workspace exists
```

Proven only by integration: no provider contact (I8.6), because no provider is installed until D11; and the absence of any candidate after each rejection across a restart (I8.6).

### T8.9 Workspace: `applyPreparedRestore`

Seam: `Workspace.applyPreparedRestore`, with A6 prepared over W-t.

```text
describe("preconditions (AC-REST-002, A135)")
  it should return ConfirmationRequired without ReplaceEntireWorkspace and SafetyBackupRequired with neither a receipt nor an acknowledged decline, writing nothing and keeping the candidate
  it should return SafetyBackupStale for a receipt of W-t taken before one more Account was added, and SafetyBackupNotRecognized for a receipt from another instance, writing nothing
  it should return Conflict(TargetChanged) when W-t changed after preparation, deleting the candidate

describe("replacement (AC-REST-003)")
  it should replace W-t with the candidate given a receipt bound to W-t's live binding, returning Restored with the receipt (artifact digest, replaced and new bindings, counts), fresh status Ready with readiness evidence from a rerun after activation, and landing RestoreComplete with next destination Trades
  it should accept an acknowledged decline instead of a receipt, and apply to an origin with no Workspace with no safety choice
  it should leave the pointer and W-t unchanged and delete the candidate when one module's recheck returns CandidateChanged

describe("readiness after Restore (AC-DEL-006)")
  it should return Restored with status RecoveryOnly when the readiness rerun after activation fails, so the next mutation returns RuntimeNotWritable
```

Proven only by integration: `RuntimeNotWritable` from apply in `Recovery Only` (I8.14), which passes for free through D1's mutation guard; and another instance becoming superseded (I8.15).

### T8.10 Workspace: backup safe actions in status

Seam: `Workspace.getStatus` and `initialize`.

```text
describe("safe actions (P32, P33)")
  it should list DownloadBackup and VerifyBackup in Recovery Only, DownloadCopy and VerifyBackup in Migration Blocked, DownloadCopy alone in IntegrityBlocked(AwaitingMigration), none for an unreadable root, and RestoreFromBackup with InitializationRequired
```

### T8.12 UI: Backup page

Seam: `BackupView` with a facade test double.

```text
describe("download (A141)")
  it should call exportBackup once on Download backup, show progress, then "Downloaded, not verified yet" with the file name, the explanation that the app can't see where the file was saved, and Verify backup, never "Backup complete"
  it should show NotCompleted's stage and reason with Retry

describe("verify")
  it should open file selection and call confirmBackup with the binding and digest from the Downloaded result in view state, showing "Backup complete" with the completion time only for Completed
  it should show each Not Verified reason in plain language with Choose another file and no completed state
  it should forget the Downloaded result when the page is left, so Verify backup is offered again only after a new download

describe("Recovery Only (A144)")
  it should offer Download backup and Verify backup, and show "Restore needs a browser that can save safely" with the failed checks instead of the Restore section
```

### T8.13 UI: Restore flow

Seam: `RestoreFlow` with a facade test double.

```text
describe("choose and check (A142)")
  it should call prepareRestore with the chosen file and show "Checking the backup. Your current journal is not changed." with progress and Cancel, and on rejection list the issues (at most 200, with the total) and "Your current journal is unchanged"

describe("preview")
  it should show "Restoring replaces your entire current journal", the source, the restored counts beside the current counts, migrations, repairs with stored and expected values, and warnings, all as text

describe("confirmation and safety choice (AC-REST-002, P33)")
  it should keep Replace entire journal disabled until the replacement checkbox is ticked and, when user data exists, a safety choice is complete
  it should run Back up this journal first as an inline download bound to the preview's target followed by verification, and enable Replace only with the resulting receipt
  it should require the separate warning acknowledgment for Replace without a backup, and show no safety choice when the target has no user data

describe("result (AC-REST-003)")
  it should render the Restore complete summary from the result alone, discard every pre-Restore view and form, make no read call, and offer the next destination
  it should show a rejected or conflicting apply with "Your current journal is unchanged" and Check the backup again
```

### T8.14 UI: shell, warnings, blocked views, first run

Seam: `AppShell`, `FirstRun`, `MigrationBlockedView`, and `IntegrityBlockedView` with a facade test double.

```text
describe("readiness and protection (A143, A144)")
  it should show Backup in the Recovery Only navigation with the new separate-storage explanation, and in both layouts while Writable
  it should add "Download a backup and verify it to keep a safe copy" with a link to Backup to the not-protected warning

describe("blocked views (P32)")
  it should offer Download a copy and Verify in Migration Blocked, Download a copy with the explanation in AwaitingMigration, and neither for an unreadable root

describe("first run (P33)")
  it should offer Restore from a backup beside Start a new journal only while Writable, opening the Restore flow with target NoWorkspace

describe("another tab's Restore (A136)")
  it should show "This journal was replaced by a Restore in another tab. Reload to continue." on WorkspaceReplaced, keeping an open form's values on screen
```

---

## 5. Structural tasks

| Task | Verification (exact) | Expected result | Behavior that depends on it |
|---|---|---|---|
| T8.11 Capability manifest and composition | `npm run verify:capabilities`; `npm run verify:release` | The manifest adds A145's operations and ranges and nothing else; every new operation is reachable from the Backup page, the Restore flow, first run, or a blocked view. `createApplication` gains the export port (worker in the browser, in-process in Node), the download port, and the file selection port. `verify:release` shows `backup-export` worker chunks in the Offline Release Inventory. `@noble/hashes` and `fflate` appear in `package.json` and the technology stack (section 1.2). | AC-CAP-001; offline export (AC-DEL-001). |
| T8.15 Faults build stages | `npm run build:faults && npm run verify:no-fault-hooks` | `?faults=` accepts `backup:read` (the snapshot read fails at its first batch), `restore:apply:<store>` (that module's recheck returns `CandidateChanged`), `restore:activate` (the root activation transaction aborts), `restore:hold-prepare` (preparation waits after staging the records), and `restore:hold-activated` (apply waits after the pointer switch, before the readiness rerun); each hold lasts until `window.__tjFaults.release()`. The production `dist/` contains none of these. | B8.4, B8.7, B8.13, C8.6. |
| T8.16 Previous-release harness | `npm run build:releases && npm run verify:releases` | `dist-releases/d7` is built from tag `claude-opus-5.5-d7` (A146) alongside the existing folders and a current `d8`; `verify:releases` confirms `d7` reports schema 6 and no backup capability. | B8.12, C8.9. |
| T8.17 Backup fixtures | `npm run fixtures:freeze-backup`, then `npm run verify:fixtures` | Writes A147's six artifacts with their Downloaded results. `verify:fixtures` additionally restores each into an empty factory and checks that the views equal its committed expected views (the v1–v5 ones after migration per D7 A121). | P31's Restore from every earlier backup; every later schema change. |
| T8.18 Benchmark generator | `npm run build:bench && npm run bench:generate` | The generator writes the D7 section 1.4 mix as a schema-6 artifact with the production `ArtifactWriter`, deterministic for its generator version, and records counts, digests, sizes, and expected values in `bench/dataset.json` (P35). | T8.19. |
| T8.19 Benchmark through Restore, capacity, timings | `npm run bench:setup`, `npm run measure:capacity`, `npm run verify:capacity`, `npm run bench:run` | `bench:setup` restores the artifact through the production first-run Restore in a fresh Chromium profile, requires zero issues and zero repairs, records the prepare and apply timings, and caches the profile. `measure:capacity` records `estimate().usage` of the restored Workspace; `verify:capacity` fails if it exceeds the projection for the same counts by more than 10%. A second Restore of the same artifact over the restored Workspace records peak usage, which must stay below `3 × M`. `bench:run` runs D7's latency and correctness harness unchanged on the restored profile, then records the timings of one export and one verification of the mature dataset. Results go to `evidence/D08/bench.md`. | AC-PERF-001; decision 18; AC-REBUILD-001 at target scale. |
| T8.20 Node integration suite | `npm run test:integration` | Every case in sections 6.1 of D1, D2, D4, D5, D6, D7, and D8 passes. | Cumulative regression. |
| T8.21 Browser integration suite | `npm run test:e2e` (Chromium) | Every case in sections 6.2 of D1, D2, D4, D5, D6, D7, and D8 passes. | Cumulative regression. |
| T8.22 Browser critic | Fresh critic agent per section 7 | A structured report with every flow passing. | Deliverable gate. |

---

## 6. Mock-free integration tests

### 6.0 Disclosed test substitutes

D1's, D2's, D4's, D5's, D6's, and D7's substitutes still apply (`fake-indexeddb`, `NodeTestHost`, fixed clock and identities, release harness, faults build with the clock pin, Chromium as the routine engine, read-only probe, in-process lifecycle lock, integrity fixture writer, migration fault stages, request-counting wrapper, bench build, Playwright clock, definition-revision fixture writer, test session policy). D8 adds:

| Substitute | Used in | Replaces | Why it does not weaken the contract |
|---|---|---|---|
| In-process export port | Node suite | the export worker | Node has no browser worker with IndexedDB. The same pipeline module runs in process against `fake-indexeddb`, in one read-only transaction; the browser suite runs the real worker. |
| `NodeTestHost` download and file ports | Node suite | the browser download and file selection | The download port captures the offered bytes; the file port supplies a `File` built from bytes. The browser suite uses real downloads and `setInputFiles`. |
| Artifact fixture writer | I8.6–I8.8, B8.6 | a damaged or edited backup file | Test code edits decompressed lines and recomputes digests (or deliberately not, for R-flip). Every check that rejects or repairs it is production code. |
| Storage read fault wrapper | I8.4 | a real read failure during export | Wraps `fake-indexeddb` so one `getAll` fails with `UnknownError`; it changes nothing else. The browser suite uses the faults build's `backup:read`. |
| Pipeline notifications | I8.2, I8.13 | — | Test-only callbacks fire when the export's read-only transaction has started and when a Restore's activation has committed, so the test acts at a deterministic point. They observe and change nothing. |
| Candidate editor | I8.9 | a real change to a candidate | The integrity fixture writer, pointed at a Restore candidate between preparation and apply. |

### 6.1 Node application-stack suite (`tests/integration/d8/`)

Conventions are as in earlier deliverables: "unchanged" compares full dumps of every store in `tj-root` and every Workspace database.

| Case | Given / When | Then (visible result and durable-state proof) |
|---|---|---|
| I8.1 Round trip (AC-BACK-001, AC-REBUILD-001) | Load W6; capture lists, Details, payoff views, the Friday Review, Debts, and Marks; `exportBackup`; `confirmBackup` with the captured file and with its decompressed form; in a second, empty factory `prepareRestore` and `applyPreparedRestore`; restart; capture again. Export W6 twice more with no change. | Both verifications Completed with receipts bound to W6's binding. Restored: normalized views equal; every stable identity, version list, and Recorded Sequence equal; authoritative store dumps equal apart from private fields and revision counters; private indexes and `journalObligations` rebuilt with identical contents. The two later exports have identical section digests. |
| I8.2 Concurrent mutation (AC-BACK-001) | W6; start `exportBackup`; on the snapshot-opened notification call `recordPositionChange` for a Sell 1 on O-C. | Downloaded; the artifact's binding precedes the mutation's revision; no line contains the new Position Change; the mutation succeeds with the next content revision; a second export contains it. |
| I8.3 Exclusions (AC-BACK-001, partial) | Decompress A6 and scan every line. | No `journalObligations` store, no `exposureStart`, `terminalTime`, `activityDesc`, or `terminalDesc` field, no root, pointer, candidate, or diagnostics record, no content revision or `marketDataRevision`, and no key named `credential`, `token`, `apiKey`, `cursor`, or `report`; the manifest's exclusions name each category of A125. The provider credential canary is added in D11 (P34). |
| I8.4 Backup failures (AC-BACK-001, AC-DEL-005) | W6 with the read fault wrapper; `exportBackup`. Without it: `exportBackup`, never verified. Then `confirmBackup` with R-cut, R-flip, a file whose read fails, and another export's file. | `NotCompleted(Read)`, no file. The unverified download returns Downloaded and no receipt exists anywhere. The verifications return `IncompleteOrCorrupt`, `IncompleteOrCorrupt`, `Unreadable`, and `DifferentArtifact`. Dumps unchanged throughout. |
| I8.5 Recovery Only (AC-DEL-005) | W6; host fails each readiness check singly, then two together; `exportBackup`, `confirmBackup`, `prepareRestore` A6, `applyPreparedRestore` with an old token. | Recovery Only each time. Export Downloaded and verification Completed with a receipt; preparation and apply return `RuntimeNotWritable` naming the failed checks; no candidate; dumps unchanged. |
| I8.6 Preparation is nonmutating (AC-REST-001) | W-t; prepare A6, R-bad, R-flip, R-cut, R-new, and A5b in turn, with the request-counting host; restart; inspect the root. | Previews for A6 and A5b (migration listed for A5b); typed aggregated issues for the rest. W-t's binding and dumps are unchanged after every call; after restart, no candidate database exists; zero network requests. |
| I8.7 Repairs and rejections (AC-LIFE-003) | Prepare and apply an artifact holding R-lc and R-dev; restart; `getTradeDetail` for T-A and the Open Trade. Prepare the R-ref, R-anchor, R-dup, R-inc artifact. | Two repairs disclosed; after apply, T-A is Closed with lifecycle agreement and no integrity finding, and the occurrence is present with its fingerprint. The second artifact is rejected with four issues and W-t's dumps are unchanged. |
| I8.8 Safety choice (AC-REST-002) | W-t, plus one Trade **X** only in W-t; prepare A6; apply without confirmation; without a safety choice; with a Downloaded result passed as if it were a receipt; with W-t's receipt taken before X was confirmed; then with W-t's current receipt. Repeat the last step on a fresh copy with an acknowledged decline. | The first four write nothing (`ConfirmationRequired`, `SafetyBackupRequired`, `SafetyBackupRequired`, `SafetyBackupStale`). Then Restored: record counts equal A6's per kind and X is absent (replaced, never merged). The decline path gives the same result. |
| I8.9 Atomicity (AC-REST-003) | W-t; prepare A6; the candidate editor removes one Journal Entry from the candidate; apply with a valid receipt. Prepare again; apply; build a second application on the same factory and call `browseTrades`. | First apply: `CandidateChanged(journalEntries)`; pointer, W-t's dumps unchanged; the candidate is gone. Second: Restored with status and landing in the one result; the second application reads only the new binding; the old database is deleted. |
| I8.10 Blocked databases are exportable (AC-REST-004) | `workspace-v5/` with one Close Reason naming an unknown Catalog identity: `initialize` gives Migration Blocked; `exportBackup`; `confirmBackup`. Valid `workspace-v5/` with a failing readiness check at first launch: AwaitingMigration; `exportBackup`. Restore the second copy into an empty factory. | Migration Blocked: schema-5 BlockedDatabase artifact, Completed with a receipt, old stores unchanged, never Ready. AwaitingMigration: Downloaded, with no verification offered in the status's safe actions (T8.10). The second copy restores through the 5→6 transforms and its views equal I7.1's migrated views. |
| I8.11 First-run Restore | Empty factory; `getStatus`; prepare and apply A6; restart. | InitializationRequired with RestoreFromBackup; preview with target NoWorkspace and no safety choice; Restored with landing Trades; after restart Ready with A6's time zone and every view equal to I8.1's. |
| I8.12 Every backup fixture | Each of A147's artifacts restored into an empty factory; restart. | Each Restored and Ready at schema 6; views equal the fixture's expected views; this also shows that no transform reads a private field (A139). |
| I8.13 Readiness after Restore (AC-DEL-006) | W-t; prepare A6; apply, and on the activation-committed notification tell the host to fail the capacity check; then `confirmPlan`. | Restored with status RecoveryOnly and the failed check; the restored data is readable; `confirmPlan` returns `RuntimeNotWritable`; dumps unchanged by it. |
| I8.14 Write gate | Host fails the inventory check; call `applyPreparedRestore` through the facade and `Persistence.activateCandidate` directly. | `RuntimeNotWritable` at both boundaries; pointer and dumps unchanged (AC-DEL-004). |
| I8.15 Another instance is superseded | Two applications on one factory; A restores A6; B calls `recordPositionChange`; B restarts. | B's commit returns `RuntimeNotWritable` (superseded) with nothing written; after restart B opens the restored Workspace. |

### 6.2 Browser suite (`e2e/d8/`, Playwright against the built app on `localhost:5175`)

Chromium only (decision 19). Downloads use `page.waitForEvent('download')` and `download.saveAs`; file selection uses `setInputFiles`. Durable state is proven by reload or full browser restart plus D1's read-only probe. RC later repeats B8.1, B8.3, B8.8, and B8.10 in all three engines (section 1.2).

| Case | Procedure | Expected observable result and durable-state proof |
|---|---|---|
| B8.1 Download and verify | Create W6's content through the UI; Backup; Download backup; save; Verify backup with the saved file. | "Downloaded, not verified yet", then "Backup complete" with the time; the file name matches A124; the test's own gunzip and SHA-256 of the saved file match the manifest; the probe shows no store changed. |
| B8.2 Unverified and failed verification | Download; leave the Backup page and return. Download again; verify a truncated copy, then a different backup. | After returning, no Verify offered for the earlier download; the truncated and different files show their messages; "Backup complete" never appears. |
| B8.3 Restore with a safety backup | Profile A with W6's content: download and verify. Profile B with other data: Restore A's file; Back up this journal first; save and verify; tick the checkbox; Replace entire journal; relaunch. | Preview shows counts and "replaces your entire current journal"; Replace enabled only after both steps; the summary renders; after relaunch B's lists and Details equal A's; the probe shows a new pointer target and B's old database gone. |
| B8.4 Decline and first run | Profile B again: Restore with Replace without a backup and its acknowledgment. Fresh profile C: first run, Restore from a backup. | B: the warning and acknowledgment are required; the Restore completes. C: no safety choice; lands on the summary, then Trades. |
| B8.5 Read failure (*faults build*) | `?faults=backup:read`; Download backup. | "The backup could not be made" with the stage; no download event; probe unchanged. |
| B8.6 Rejected artifact | Restore R-flip, then R-new. | Issues listed with "Your current journal is unchanged"; the probe shows no store changed and no candidate database; the network log shows no request leaving `localhost:5175`. |
| B8.7 Apply failure (*faults build*) | `?faults=restore:apply:journalEntries`; complete a Restore with a verified safety backup; then without the fault. | "Your current journal is unchanged"; the probe shows the old pointer and no candidate; the second attempt completes. |
| B8.8 Recovery Only backup (*faults build*) | Existing data; relaunch with `?faults=control`, then `?faults=diagnostic,capacity`; download and verify; open Restore. | Recovery Only with Backup in the navigation and the A143 copy; download and verification complete; Restore shows "needs a browser that can save safely"; probe unchanged. |
| B8.9 Blocked database copy (*faults build*) | Fixture loader writes `workspace-v5/` with a broken Close Reason into a fresh profile; launch; Download a copy; verify. Then a valid `workspace-v5/` launched with `?faults=capacity`; Download a copy. | Migration Blocked offers Download a copy and Verify, and the copy verifies; AwaitingMigration offers Download a copy with the explanation and no Verify; both probes show the old stores unchanged. |
| B8.10 Readiness after Restore (*faults build*) | Apply a Restore with `restore:hold-activated`; while it holds, `__tjFaults.set(["inventory"])`; release. | The summary shows the Restore completed and the shell is in Recovery Only naming the inventory check; Plan and Record controls are absent (AC-DEL-006). |
| B8.11 Other tab | Two tabs, tab 2 with an unsaved Plan form; Restore in tab 1. | Tab 1's preview warns that another tab has unsaved work; tab 2 shows "replaced by a Restore in another tab" with its values on screen; Confirm there returns `RuntimeNotWritable`. |
| B8.12 Update from D7 with data | Harness serves `d7`; create Trades; switch to `d8`; Reload from the notice; Download and verify a backup. | No migration message (no schema change); data intact; Backup available; About shows schema 6 and the backup ranges. |
| B8.13 Kill during Restore (*faults build*) | SIGKILL during preparation held by `restore:hold-prepare`; relaunch. SIGKILL right after the summary renders; relaunch. | First: the live journal is unchanged and no candidate remains. Second: the restored journal opens Ready and the old database is gone. |
| B8.14 Offline | Close; relaunch offline; Download and verify a backup; Restore a local file into a second offline profile. | Everything works with no network (AC-DEL-001). |
| B8.15 Not-protected warning | Fresh profile where `persisted()` is false. | The warning recommends a backup and links to Backup; every control stays enabled. |
| B8.16 Responsive and accessible | Run the Restore flow to the confirmation step at 1280 px; resize to 390 px and back; axe on the Backup page in every state, every Restore step, first run, and the blocked views; complete a Restore with the keyboard only. | Flow state and ticked checkboxes survive; layout switches at 960 px; no WCAG 2.1 AA violations; the safety choice is a labelled radio group; warnings are text, not colour alone (AC-UI-001, AC-UI-002). |

---

## 7. Browser-critic flows

The critic receives the frozen `specs/`, the plan index, the D1, D2, D4, D5, D6, D7, and D8 breakdowns, and the list of future capabilities that must not be treated as defects. Those are everything after D8, including:
- trade replay;
- multi-leg Strategies;
- the Pricing Provider and its settings, so the preview has no provider section;
- Stop Discipline;
- correcting or Voiding facts;
- reference management;
- reports.

It runs `npm run build && npm run preview` (port 5175) itself, plus `npm run serve:releases` for C8.9 and `npm run preview:faults` for C8.5, C8.6, and C8.8. It does not edit code.

| Flow | Actions | Pass condition |
|---|---|---|
| C8.1 Download and verify | Make a few Trades; Backup; Download backup; Verify backup with the saved file. | "Downloaded, not verified yet" first, explaining that the app can't see where the file went; "Backup complete" only after verification. |
| C8.2 Verify the wrong file | Verify a different backup, then a cut-short copy. | Each shows a clear reason; no completed claim. |
| C8.3 Restore over existing data | In a second browser profile with other data, restore the first backup, backing up first. | Preview shows exact counts and says the whole journal is replaced; Replace stays disabled until the checkbox and the verified safety backup; afterwards the data equals the first profile's. |
| C8.4 Restore declined and first run | Restore without a backup; then restore into a fresh profile from the first-run screen. | The decline needs its own acknowledgment; first run needs no safety choice. |
| C8.5 Damaged backup | Restore an edited or truncated file. | Issues listed; "Your current journal is unchanged"; nothing changed. |
| C8.6 Failure during apply | Faults build with `restore:apply:journalEntries`. | Current journal unchanged; retry without the fault succeeds. |
| C8.7 Recovery Only | Faults build with `?faults=inventory`: back up and verify; open Restore. | Backup works; Restore explains it needs a browser that can save safely; the separate-storage copy mentions backup and Restore. |
| C8.8 Blocked journal | Faults build: a schema-5 journal with a broken reference, then a valid one with a failing check at first launch. | Download a copy is offered in both; Verify only in the first, with the explanation in the second. |
| C8.9 Update | Harness serves `d7`; create data; switch to `d8`; reload. | Data intact; Backup available. |
| C8.10 Offline, responsive, keyboard, About | Stop the server and reload; back up offline; resize mid-Restore; restore by keyboard; open About. | Offline works; flow state survives resizing; visible focus; About lists only D1, D2, D4, D5, D6, D7, and D8 capabilities with the backup ranges. |

---

## 8. Acceptance matrix rows

Status values: `planned`, `covered`, `intentionally not advertised`. All rows are `planned`. AC-DEL rows cite Chromium and faults-build evidence; Firefox, WebKit, and real-state evidence are **pending RC** (decision 19).

**How secrets exclusion is verified:** I8.3 scans every decompressed line of a real artifact for excluded stores, private fields, and secret-shaped keys, and checks the manifest's exclusions; from D11, the same case adds a credential canary saved through `configureProvider` and asserts its absence. **How no-write and rollback claims are compared:** every "unchanged" claim compares full dumps of every store in `tj-root` and every Workspace database before and after, plus the root's `candidates` record and the list of databases; Restore rollback additionally checks that the pointer still names the old database and that no candidate database remains after a restart.

| Scenario | Deliverable | Tasks | TDD / structural | Integration case and fixture | Critic flow | Command or procedure | Expected result and durable-state proof | Failure / nonmutation / restart evidence | Status |
|---|---|---|---|---|---|---|---|---|---|
| AC-BACK-001 (cumulative per P34; partial: corrections, Voids, Bars, provider settings and credential, revised definitions and references arrive later) | D8 | T8.1–T8.5, T8.12 | T8.3 snapshot group; T8.4; T8.5 | I8.1–I8.4; B8.1, B8.2, B8.5; W6, A6 | C8.1, C8.2 | `npm run test:integration -- d8/backup` | One snapshot for all sections; full identities and histories; mutation wholly outside; exclusions explicit; Downloaded without receipt; receipt only from verification | Each controlled failure: no receipt; dumps unchanged | planned |
| AC-REST-001 (cumulative per P34; provider non-contact re-proven in D11) | D8 | T8.6–T8.8, T8.13 | T8.8 groups | I8.6, I8.7, I8.12; B8.6; R-fixtures, A5b | C8.5 | `npm run test:integration -- d8/prepare` | Previews for valid and older; aggregated typed issues; repairs disclosed; incoherent rejected | Binding and dumps unchanged; no candidate after restart; zero requests | planned |
| AC-REST-002 (full) | D8 | T8.9, T8.13 | T8.9 preconditions; T8.13 confirmation group | I8.8; B8.3, B8.4 | C8.3, C8.4 | `npm run test:integration -- d8/safety` | Only an exact-target receipt or acknowledged decline; replacement with exact counts; target-only Trade absent | Incomplete, stale, and unverified attempts write nothing | planned |
| AC-REST-003 (full) | D8 | T8.7, T8.9, T8.13 | T8.9 replacement group; T8.13 result group | I8.9; B8.7, B8.13 | C8.6 | `npm run test:integration -- d8/atomic` | One-call result with status and landing; a second application reads only the new binding | Injected failure: old pointer, dumps unchanged, no candidate; SIGKILL cases | planned |
| AC-REST-004 (full) | D8 | T8.3, T8.4, T8.10, T8.14 | T8.4 blocked group; T8.10 | I8.10; B8.9 | C8.8 | `npm run test:integration -- d8/blocked` | Blocked older data exportable at its own schema; verified in Migration Blocked; restorable forward | Old stores unchanged; never Ready (D2) | planned |
| AC-DEL-005 (full) | D8 | T8.4, T8.5, T8.10, T8.12, T8.14 | T8.12 Recovery Only group; T8.14 | I8.4, I8.5; B8.8 | C8.7 | `npx playwright test e2e/d8/recovery-only.spec.ts` | Reads, history, export, and verification in Recovery Only; separate-storage copy | Mutations, preparation, and apply return `RuntimeNotWritable`; dumps unchanged | planned; real-state **pending RC** |
| AC-LIFE-003 (partial per P34: Restore branch for lifecycle and Entry Size; full in D12) | D8 | T8.6, T8.8 | T8.6 validation case; T8.8 repairs group | I8.7 | — | `npm run test:integration -- d8/repairs` | Coherent disagreement repaired in the candidate and disclosed; incoherent rejected | Live dumps unchanged by preparation | planned |
| AC-DEL-006 (cumulative: after-Restore boundary) | D8 | T8.9 | T8.9 readiness group | I8.13, I8.15; B8.10, B8.11 | C8.7 | `npx playwright test e2e/d8/after-restore.spec.ts` | Readiness rerun after activation before any mutation | Next mutation rejected; dumps unchanged | planned; real-state **pending RC** |
| AC-REBUILD-001 (cumulative: Restore as reconstruction) | D8 | T8.9, T8.19 | structural | I8.1, I8.12; benchmark | — | `npm run test:integration -- d8/round-trip`; `npm run bench:setup` | Equal normalized views and identities after Restore, at fixture and target scale | — | planned |
| AC-RESP-001 (cumulative) | D8 | T8.9, T8.13 | "from the result alone" | I8.9 | C8.3 | `npm run test:integration -- d8/responses` | Restore result carries status and landing; no read follows | — | planned |
| AC-CAP-001 (cumulative) | D8 | T8.11 | `verify:capabilities` | — | C8.10 | `npm run verify:capabilities` | Manifest equals reachable operations and ranges | — | planned |
| AC-DEL-001 (cumulative) | D8 | T8.11–T8.13 | — | B8.14 | C8.10 | `npx playwright test e2e/d8/offline.spec.ts` | Backup, verification, and local Restore offline | Second offline restart | planned; other engines **pending RC** |
| AC-DEL-004 (cumulative) | D8 | T8.7, T8.9 | T8.7 gate case | I8.14 | C8.7 | `npm run test:integration -- d8/write-gate` | Restore apply and candidate creation gated at both boundaries | Pointer and dumps unchanged | planned; real-state **pending RC** |
| AC-DEL-003 (cumulative) | D8 | T8.16 | `verify:releases` | B8.12 | C8.9 | as B8.12 | Tab launch Writable after the update | — | planned; Firefox and WebKit **pending RC**; production HTTPS **pending** |
| AC-UI-001, AC-UI-002 (cumulative) | D8 | T8.12–T8.14 | view-state groups | B8.16 | C8.10 | `npx playwright test e2e/d8/responsive-a11y.spec.ts` | State kept across resize; axe clean; destructive Restore states distinguishable | — | planned |
| AC-PERF-001 (cumulative) | D8 | T8.18, T8.19 | structural | Benchmark dataset through Restore | — | `npm run bench:run` | Budgets met on the restored profile | Rows equal expected before and after | planned |

---

## 9. Clause-level acceptance check

| Scenario | Clause | Covered by | Finding |
|---|---|---|---|
| AC-BACK-001 | populated Workspace with corrections, Voids, definitions, Marks, Bars, acknowledgments, references, provider settings and credential, projections | W6 | **Finding (P34):** Marks, acknowledgments, definitions, references, and projections exist now; corrections and Voids (D13, D15), Bars and the provider (D11), revised definitions (D26), and reference renames (D23) arrive later, so the scenario is cumulative |
| | exported while a concurrent later mutation occurs | T8.3, I8.2 | covered; the read-only transaction makes the mutation commit after the snapshot |
| | the downloaded file is selected for verification | T8.5, I8.1, B8.1 | covered |
| | controlled source-read failure; download left unverified; unreadable, truncated, or different-artifact file | I8.4, B8.2, B8.5 | covered |
| | four sections and metadata share one snapshot | T8.3, I8.2 | covered |
| | every identity, revision, history, and nonsecret setting | I8.1 dumps | covered for D8's data |
| | credentials, raw payloads, diagnostics, reports, cursors, private projections absent | I8.3 | covered; credential canary in D11 |
| | manifest counts, digests, exclusions explicit | T8.4 | covered |
| | export alone is Downloaded with no receipt; only verification gives Completed and a bound receipt | T8.4, T8.5, T8.12 | covered |
| | every controlled failure gives Not Completed or Not Verified with no receipt | I8.4 | covered |
| AC-REST-001 | valid, malformed, digest-corrupt, unsupported-newer, supported-older artifacts | I8.6 (A6, R-bad, R-flip, R-new, A5b) | covered; supported-older is the blocked-database export of the v5 fixture (P32) |
| | no live data changes | I8.6 dumps | covered |
| | aggregated safe issues | T8.8 | covered (A134) |
| | older data migrates in an isolated candidate | T8.8, I8.10, I8.12 | covered (P30, P31) |
| | coherent disagreement repaired and disclosed; incoherent rejected | T8.8, I8.7 | covered |
| | no provider contacted | I8.6 (zero requests) | trivially true before D11; re-proven with a provider in D11 (P34) |
| AC-REST-002 | nonempty target; without confirmation; without safety; older receipt; unverified download | T8.9, I8.8 | covered |
| | valid with an exact-target receipt or explicit decline | T8.9, I8.8, B8.3, B8.4 | covered |
| | the UI identifies replacement and exact impact | T8.13, B8.3 | covered (A133, A142) |
| | replaces entirely, never merges or duplicates | I8.8 (X absent, counts equal) | covered |
| | decline requires a warning acknowledgment | T8.13, B8.4 | covered |
| AC-REST-003 | controlled failure in one section during apply rolls back every section | I8.9, B8.7 | covered; Node uses a real candidate change, the browser the faults stage |
| | success commits all sections under one new binding | I8.9 | covered (pointer flip, A127) |
| | the response supplies status and landing; old views invalidated without an automatic read | T8.9, T8.13 | covered |
| | an independently opened surface reads only the new binding | I8.9 (second application), I8.15 | covered |
| AC-REST-004 | controlled migration validation failure at startup | D2 I2.2, I8.10 | covered |
| | partial state never Ready | D2 T2.10 | covered |
| | prior data uncorrupted and readable by the compatible path or exportable | I8.10, B8.9 | covered: exportable in both blocked states (P32); this completes the scenario |
| | successful retry activates atomically with a receipt | D2 I2.2 | covered |
| AC-DEL-005 | each readiness condition failing independently, readable Workspace | I8.5, B8.8 | covered |
| | reads, history, backup export, and verification available | I8.5, T8.12 | covered; this completes the scenario |
| | mutations and Restore application return `RuntimeNotWritable` | I8.5 | covered; preparation also returns it (P30) |
| | unreadable store: no reads, initialization, overwrite, mutation, Restore, or completed-backup claim | D1 I1.8, T8.4, T8.10 | covered |
| | failed export, unverified download, failed verification give no receipt | I8.4 | covered |
| | the UI explains that another browser needs a completed backup and Restore | T8.14 (A143) | covered |
| AC-LIFE-003 | Restore preparation derives a disclosed repair for coherent facts or rejects incoherent ones | T8.8, I8.7 | covered for lifecycle (including the first repair of a Closed Trade, D6 A96) and Entry Size; Planned-Leg Terms, Unplanned Exposure (D10), and Stop Discipline (D12) add kinds (P34) |
| AC-DEL-006 | readiness re-established after Restore before mutations are enabled | T8.9, I8.13, B8.10 | covered |
| AC-REBUILD-001 | Restore as the reconstruction path, at target scale | I8.1, I8.12, T8.19 | covered |

**Review-queue items for D8, and where they are resolved:**

- *Restore verifies lifecycle and Deviation agreement only and can repair a Closed Trade's lifecycle (D6 item 2):* A132, T8.6, T8.8, I8.7.
- *Backup and Restore cover option Plan facts, Exercise Intent, option Executions, Expiration facts, and schema 6 (D7 item 1):* T8.2, I8.1.
- *Export of a blocked older database (decision 22):* P32, T8.3, T8.4, I8.10.
- *Recovery Only backup and the backup recommendation (decision 2, D1 A13):* A141, A143, T8.12, T8.14.
- *Capacity checked through a real Restore (decision 18):* P35, T8.19.
- *RC cases (backup in Recovery Only, after-Restore readiness):* section 1.2.
- *AC-BACK-001 and AC-REST-001 presume later data (deferred item 3):* P34.
- *AC-LIFE-003's later Deviation kinds (deferred item 4):* P34.
- *Artifact version and Restore migration (plan rule):* P31.

---

## 10. Evidence recording

As in earlier deliverables, under `evidence/D08/`: `tdd-log.md` (red and green per case), `structural.md`, `provenance.md` (engine and OS versions, never an allowlist), `bench.md` (latency, the Restore, export, and verification timings, capacity measurement, dataset provenance including the artifact digest), and `critic-<n>.md`, with each critic defect first reproduced by a failing test.
