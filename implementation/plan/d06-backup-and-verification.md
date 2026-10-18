# D6 — Backup and verification: detailed task breakdown

Status: planning draft; no implementation, download, verification or passing tests have occurred. Provisional under the [trader-approved per-deliverable planning approach, 2026-10-17](../delivery-plan.md#accepted-planning-approach--2026-10-17); review before this deliverable is implemented.
Authority: [D6 in the delivery plan](../delivery-plan.md#6-back-up-and-verify-the-populated-trading-workspace), [Workspace](../../specs/design/workspace.md#full-backup), [backup ADR](../../specs/adr/0010-backup-download-verified-by-read-back.md) and [D1 shared policies](d01-long-stock-plan.md). Prerequisite: completed D5, including its full closing/Close Review facts. Proposed public test seams require review before execution.

## Outcome, story and explicit boundaries

- As a trader, I would like to download and verify my complete trading workspace, so that I can keep a usable copy of my plans, executions, reflections and prices.

Production flow: Settings/local-data protection or Recovery Only → Download backup → Downloaded, not verified → Verify backup → trader selects saved file → Completed with exact-source receipt, or Not Verified with reason. Leaving this view loses pending verification state; export again to verify. Verification is optional for keeping the downloaded copy. A verified copy does not claim that this installed release can Restore it.

D6 ends the pre-D6 export exception. Both export and confirmBackup are nonmutating and work in readable Recovery Only. Readable internally bound histories remain exportable even when analytical lifecycle/lot/deviation agreement needs diagnosis; export does not repair them or certify that a later Restore will accept them. Unreadable/Integrity Blocked root cannot yield a backup or Completed claim. Restore prepare/apply/replace UI remain absent until D17. No provider setup/credential facts (D7), economic corrections (D18), Journal Edit/Addendum/Void (D19), form customization (D23), or report data are invented to make a richer fixture.

## Artifact, coherent source and receipt design

First portable artifact version is `tjv3-backup/1`, with four independently owned authoritative sections plus Workspace metadata/settings. Keep this D6 version and its seed/capability/schema provenance as a supported earlier input for D17. Later slices extend exports and declare compatible artifact ranges immediately; they do not relabel old files as a newer representation. No Restore implementation is created here.

Include exactly every installed authoritative category: Workspace/time zone/schema/seed provenance; Catalog identities/versions/parents/shape/reason policies; confirmed Plans/Planned Legs/baselines/reflections; Position Changes, all opening and disposal Executions and Recorded Sequences, lifecycle bindings, active Lot-Match and recorded Deviation reconciliation histories/evidence; every Journal definition revision, Entry snapshot/Action/voluntary/Close Review, Anchor/Source/origin/time, obligation/Debt/decline/settlement/retirement chain; Manual Mark and acknowledgment histories/effective resolution/session-policy compatibility metadata. Empty owned categories remain explicit sections with zero counts. Exclude secrets, transient form state, diagnostics, request logs/raw payloads, report/replay results, cursors and private projections/indexes. Current code capability identity is artifact compatibility metadata, never restored code authority.

Canonical encoding is UTF-8 JSON with fixed envelope/section order; object keys sorted by Unicode code-point order, canonical strings/escaping, arrays ordered by owning module's explicit identity/history/order policy, decimal values as normalized strings, instants as canonical UTC ISO strings, session dates YYYY-MM-DD. Preserve authored text verbatim. Reject duplicate keys/nonfinite/native financial numbers during construction. A canonical section digest is SHA-256 over that section's exact canonical UTF-8 bytes. The Backup Manifest contains format/schema versions, source binding, capture instant, capability footprint, per-category counts, exclusions, section digests and a full-data digest over the canonical `{sections, workspace}` payload. Manifest digest hashes its canonical bytes, including that full-data digest. The envelope contains the manifest, its digest, Workspace metadata/settings and all sections. The **full artifact digest** in Downloaded/Completed hashes the exact final envelope bytes, including declared internal digests; this outer digest is returned out of band rather than embedded in itself. Thus no circular self-hash; manifest/full-data/full-artifact digests are distinct named fields. Field names and exact byte fixtures are fixed in T01 before parallel work.

Use each `exportSnapshot` under one logical snapshot S. In D1's append-versioned stores every published authoritative row/version is tagged with its commit ordinal and generation; public revisions remain opaque. Module exports page identities/history at or before S, select effective state at S (not mutable current heads from a later commit), and retain historical rows required to prove that state. A later mutation has ordinal >S and is wholly outside the artifact. The snapshot source generation must remain readable throughout; if it disappears/changes incompatibly, abort export as Not Completed/Conflict, never mix generations. This uses read-only immutable-history queries, including Recovery Only; it does not stage a writable export or hold an IndexedDB transaction open while hashing/downloading. Fixed read transaction scopes/revision rechecks are specified by the single transaction owner; root metadata and any non-versioned input are captured atomically with S. D6-I02 proves this mechanism against real concurrent commits/migration, not just a serializer fixture. Generation cleanup must never invalidate an active read silently; missing retired data causes safe export failure.

Build canonical output in bounded chunks outside storage transactions and incrementally hash with trader-accepted `@noble/hashes 2.4.0` (accepted 2026-10-11; recorded in D1). Retaining Blob parts/download backing still costs memory; this is not a claim of constant-memory export. Measure peak target-scale memory and safe failure before release. Use a module Worker only if measurements show UI responsiveness requires it, keeping canonical bytes identical. Ordinary download uses Blob URL/download affordance; retain/revoke its lifetime safely, distinguish host invocation failure from Downloaded, and never attest saved location. Filename/date is a suggestion, never identity proof.

Downloaded returns S, full artifact/manifest digests, byte length, format version and suggested filename. `confirmBackup` reads trader-selected File bytes to successful EOF, hashes all bytes, checks expected byte length/full-artifact digest and bounded envelope metadata/source binding/manifest digest. Matching full bytes proves equality to the complete artifact constructed and validated by export; no general whole-file JSON parser or Restore candidate is needed just to verify equality. Bound/validate the metadata prefix framing during T01, handle multibyte UTF-8 across chunks, and reject unsupported/malformed header or failed read. Verification returns non-authoritative CompletedBackupReceipt containing exact S, digests, byte/read-back evidence and completion time. It does not write last-backup status, a pending-export row or a Workspace revision. A later Workspace mutation does not invalidate verification of the saved S artifact; D17 separately requires a receipt matching its then-current target for Restore safety.

## Explicit task completion edges

These are blocking edges for task completion. UI work may start after the contract-fixing task, as described under parallelism, but cannot finish before its real domain/persistence prerequisites. Review/freeze prerequisites remain external to this implementation graph.

| Task | Required predecessor tasks |
|---|---|
| D6-T01 | D5-T07 |
| D6-T02 | D6-T01 |
| D6-T03 | D6-T02 |
| D6-T04 | D6-T01, D6-T03 |
| D6-T05 | D6-T03, D6-T04 |
| D6-T06 | D6-T01, D6-T02, D6-T03, D6-T04, D6-T05 |

## Ordered tasks and concrete cases

Every behavior case requires D1's one-test Red → minimal Green → next-case record; exact byte literals/independent SHA vectors are the oracle, not the implementation under test. Structural verification is reproducible. No tasks execute during planning.

### D6-T01 — Fix format, source/receipt contracts and resource policy (structural)

Blocked by D5-T07. Single artifact/schema/transaction owner fixes named digest byte domains, stable ordering, header framing, per-category count semantics, exact four module exports and nonmutating result unions. Extend logical schema metadata to D6 only if needed for artifact compatibility; original content histories remain unchanged. Snapshot ordinal tagging must already exist from D1, not retroactively invent provenance here.

Verification: review a hand-worked small canonical JSON artifact/byte vector and round-trip representational inventory against D1–D5 durable kinds, including Close Review and deviations. Eventually typecheck/build and inspect manifest dependency closure; actual version transition tests if metadata changes. Backup/memory capacity procedure is reviewed in D1; install the accepted hash dependency only after separate implementation approval.

### D6-T02 — Export every owned section from exact snapshot S

Blocked by D6-T01. Owners: Trade Record, Journal, Market Data and Reference Catalog; public seams their `exportSnapshot` operations, called only by Workspace.

`describe("complete authoritative snapshot sections")`

- it should export both Planned/Open and fully Closed Stock records with every Execution/sequence/lifecycle/Lot/deviation history and exact Plan baseline, retaining quantity-only links rather than duplicating derived P&L.
- it should export all installed form definitions/Sources and Plan/Position/Close/Daily/voluntary Entries, Debt, declines and settlements with exact prompt/option/Anchor/time snapshots.
- it should export all Catalog history/shape/reason policies and Manual Mark/acknowledgment chains/session compatibility at S, including acknowledgment retained after exact Mark arrives.
- it should include empty sections and counts honestly and omit all private caches/cursors/transient input and secret-bearing fields by explicit owned allowlists.
- it should omit every new row/version committed after S and use S's effective heads even if a later command changes an obligation/Action/Mark.
- it should include readable, internally bound records with an analytical agreement disagreement without deleting/repairing them; a source-read failure or inability to establish complete section identity/history binding instead fails safely, with no partial successful artifact or authoritative write.

### D6-T03 — Construct digest-valid canonical artifact and Downloaded result

Blocked by D6-T02. Owner: Workspace/host file boundary; seam `exportBackup`.

`describe("coherent full backup download")`

- it should construct one complete four-section artifact from S with exact counts/exclusions/compatibility, return Downloaded with full-artifact/manifest digests and suggested filename, and issue no CompletedBackupReceipt.
- it should produce identical canonical bytes/digests for logically identical sections regardless of storage enumeration order, and match independently fixed UTF-8/SHA-256 vectors across chunk/hash-block boundaries.
- it should exclude later concurrent command wholly while preserving S's coherent settings/Trade/Journal/Market/Catalog state; a stale requested expected Workspace binding instead returns Conflict.
- it should return Not Completed naming failed stage on read/encoding/hash/Blob/download-invocation/resource failure, with no receipt, partial success or Workspace revision change.
- it should export readable Recovery Only data without bypassing the write gate or requiring a Writable initialization; Integrity Blocked source returns safe failure with no completion claim.

### D6-T04 — Verify selected saved artifact and return exact-source receipt

Blocked by D6-T01/D6-T03. Owner: Workspace/file boundary; seam `confirmBackup`.

`describe("selected file backup verification")`

- it should read the complete matching downloaded file to EOF and return Completed with exact S/full-artifact/manifest digests, read-back evidence and completion time, without authoritative mutation.
- it should return Not Verified for unreadable, malformed/incomplete/truncated/corrupt bytes, mismatched length, different valid artifact or source binding, with no CompletedBackupReceipt.
- it should refuse matching filename/MIME or matching header alone as proof and detect a changed byte in the final chunk.
- it should still verify the original S file after a later valid Workspace command, clearly retaining S rather than claiming a backup of newer data.
- it should operate in readable Recovery Only, require expected Downloaded view-state evidence, and leave no pending verification after cancellation/restart/navigation.

### D6-T05 — Deliver download/verify and Recovery Only UI

Blocked by D6-T01 for contract-fixed work; acceptance joins T03/T04. Owner: UI/shell.

`describe("honest backup production UI")`

- it should label Downloaded as not verified, explain ordinary browser download uncertainty, then invoke ordinary user file selection for Verify.
- it should display Backup Complete only from CompletedBackupReceipt and retain reason/retry guidance after Not Completed/Not Verified; selection cancellation makes no claim.
- it should offer export/verification in readable Recovery Only while keeping every authoritative mutator disabled and preserving unreadable-store protection.
- it should discard pending expected digest/binding on leaving/restart, offer another export and make no claim that Restore/transfer is installed before D17.
- it should keep keyboard/focus/accessible file-selection/status flow and preserve current form/view state during responsive changes or background update notification.

### D6-T06 — Cumulative proof, target-scale resource evidence and fresh critic (structural)

Blocked by D6-T01–D6-T05. Extend manifests with complete export/confirm variants and new hash/file assets. Run cumulative suites and I01–I05. Capture target-scale backup byte size, actual origin/Blob/heap peaks, readiness headroom and complete artifact counts. Fresh critic independently starts strict DEV_PORT=5174 production runtime and runs B01–B04. Every defect first gets failed regression, minimal fix, cumulative rerun and another fresh critic for all D6 flows. Specification ambiguity pauses; missing browser/agent/runtime blocks completion.

## Mock-free integration and durable/no-write proof

Fast integration may use disclosed fake-indexeddb only; it invokes actual Workspace, four fact modules, canonical encoder and SHA-256 implementation. Native browser runs use real IndexedDB and host download/file selection. File fixtures are actual exported bytes, never canned export responses. Test physical read faults are disclosed infrastructure fault injection; a stubbed application Downloaded result is forbidden.

| Case | Reproducible planned procedure / expected evidence |
|---|---|
| D6-I01 | Command-populate D1–D5: Planned/Open/Closed Trades, all reflection dispositions, answered Debt, dated Actions including Stop occurrence, voluntary Standalone/Trade/Execution writing, Manual Marks and retained acknowledgment. Export, inspect canonical bytes/counts/digests through independent reader, select actual saved file and verify. Record response/source-binding/receipt; before/after authoritative state identical. |
| D6-I02 | Hold S export between module pages while another tab changes Action, adds Entry/Mark or closes an Open Trade. Artifact contains all pre-change effective content and no later revision; compare to saved public-boundary snapshot at S. Race migration/generation cleanup separately; either coherent S artifact or explicit safe failure, never torn sections. |
| D6-I03 | Test source-read abort, truncated file, final-byte corruption, unreadable File, different valid artifact, Downloaded-without-verification and cancelled selector. Every run has no receipt/completion label; compare unchanged authoritative binding/histories and preserved source bytes. |
| D6-I04 | Enter each readable readiness failure and export/verify normally; attempt installed mutations and observe RuntimeNotWritable. Separate unreadable root must not initialize/overwrite/export successfully. No write is used to stage/persist pending backup. Separately export a controlled readable analytical-disagreement fixture; preserve its recorded agreement/evidence exactly, disclose that verification proves file equality rather than analytical validity, and never run a repair. |
| D6-I05 | Reconstruct all installed private state, export again under same semantic inputs and compare normalized authoritative content, counts and public lists/detail/Review results. Run measured mature Stock fixture and failed candidate migration; Recovery Only export remains usable. D17 will add actual Restore equivalence rather than a fabricated import here. |

## Planned browser flows

- **D6-B01:** Populate through production D1–D5 forms, including complete Stock exit and separate Close Review, download file, select it in Verify and inspect Completed receipt/source/counts. Stop browser, reopen offline and export/verify again.
- **D6-B02:** Leave download unverified, navigate/restart, then export again; select truncated/different file, cancel selector and encounter safe read/download failure. Never show Backup Complete; real good file then succeeds.
- **D6-B03:** Readable Recovery Only retains list/detail/history and download/verify, every installed Save is rejected. Unreadable known root has Integrity Blocked guidance and no initialized/overwritten data or completed-backup claim. Another browser explanation never implies automatic transfer.
- **D6-B04:** Keyboard-only B01/B02 at 390/1440 px, live 767/768 resize, 200% zoom, accessible status/error/focus and ordinary file input, axe/manual AA checks. Update notice cannot interrupt export/verification or discard active Trade form; no Restore UI appears.

## Acceptance mapping

All status values **planned**; Full/Partial mean assignment scope, not implemented evidence. D1 shared procedures/provenance apply.

| Scenario | Scope now / later completion | Tasks; evidence |
|---|---|---|
| AC-BACK-001 | Partial: complete coherent installed D1–D5 export/read-back including closure/Close Review, all failures and nonsecret allowlists. Provider/credentials D7, restored setup D17, corrections D18/Journal histories D19, customized definitions/full D23 | T01–T05; I01–I04; B01–B03 |
| AC-DEL-005–006 | Partial: D6 Recovery Only export/verify fully installed; Restore apply/post-Restore boundary completes D17 | T03–T06; I04/I05; B03 |
| AC-DEL-001–004, AC-CAP-001, AC-UI-001 | Full installed release with deferred Restore exception | T01/T05/T06; I01–I05; B01–B04; repeated D1 readiness/update/offline matrix |
| AC-REST-004 | Partial safe representation migration/readable prior data now adds backup recovery; Restore/artifact migration full D17 | T01/T06; I05; B03 |
| AC-LIFE-003 | Full inherited agreement/no read-repair guard for installed facts; diagnostic export preserves disagreement, no Restore validation claim | T02/T03; I04; B03 |
| AC-RESP-001 | Partial global mutator scenario inherited; export/confirm themselves are nonmutating bound results, not fake mutation receipts. Multi-Trade full D15 | T03/T04/T05; I01; B01 traces |
| AC-UI-002 | Partial globally, complete installed download/verification/recovery screens; destructive Restore/full D17 | T05/T06; B04 |
| AC-REBUILD-001, AC-PERF-001 | Partial all installed facts/projections and Stock target-scale resource/latency proof; full mixed workload D28 | T01/T02/T06; I05; D1 benchmark/equivalence procedure |

AC-REST-001–003 remain intentionally unadvertised until D17, not partially implemented in D6. Other canonical scenarios retain D1 ledger assignments.

## Ownership and safe task parallelism

T01 fixes format/exports/snapshot contracts first. T02's four owned section implementations may proceed concurrently only with frozen common S/order/count rules and disjoint ownership; one owner integrates all export streams. T04 can implement selected-file equality rules once format/Downloaded contract is fixed but acceptance waits for real T03 artifacts. T05 can prepare semantic UI after T01; T06 waits for all. Single owners serialize artifact/schema version, root/snapshot ordinal mechanics, hash/canonical bytes, shell and release manifests. No cross-deliverable concurrency authorization.
