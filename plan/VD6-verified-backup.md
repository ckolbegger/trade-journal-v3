# VD6 — Verified backup

Working file for VD6 of `plan/implementation-plan.md` @ `477c8cd` (branch `zcode-glm-5.3`). Scope, sequence, and acceptance markings are the plan's; this file owns the detailed breakdown and living progress. Environment facts: see VD1 working file.

## Scope recap (authoritative source: plan §VD6)

- **User-visible outcome:** two-step backup — full-snapshot export as an ordinary file download (artifact + Workspace Backup Manifest with section/full digests, canonical JSON, SHA-256), then read-back verification of the trader-selected file producing a `CompletedBackupReceipt`, or honest Not Verified / Not Completed results. Works in Recovery Only. The UI never presents an unverified download as completed. Lands after Closing so the first representative export contains every core data entity — plans, executions, journal entries and Debt, marks, closed trades with Lot Matches and Close Reviews — and, with the provider installed (VD4), credentials are present and provably excluded.
- **Operations exercised:** `Workspace.exportBackup/confirmBackup`; `exportSnapshot` for Trade Record, Journal, Market Data, and Reference Catalog bound to one snapshot.
- **Mechanisms:** concurrent-mutation exclusion (a later mutation is wholly outside the artifact, never torn across sections); secrets exclusion by construction; expected digest/binding held in view state only (no pending verification stored).
- **Seeds:** none.
- **Durable representation:** backup artifact schema (versioned); receipt as non-authoritative result evidence.
- **Acceptance (plan markings):** Full: AC-DEL-005 (completes — Recovery-Only reads + export + verification), AC-BACK-001 (completes — concurrent mutation, digest validation, Not Verified paths, provider credentials provably excluded).

## Interface-freeze gate and parallel split

- **T1 pins the backup command/result types** (export/confirm requests and results, manifest shape, receipt shape, section snapshot shapes). After T1:
  - **Track D (domain/persistence):** T2–T6.
  - **Track U (UI):** T7.
- Serialize at T8 (integration gate) and T9 (critic gate).

## Tasks

### T1 — Backup interface freeze
**Type:** structural. **Depends:** VD5 complete.

**Verification:** `npm run typecheck` clean; artifact/manifest/receipt fixtures compile against the Workspace contract vocabulary.

### T2 — Canonical JSON serialization and SHA-256 digesting
**Type:** behavior-bearing. **Depends:** T1.

Deterministic canonical form (stable key ordering, no insignificant whitespace, exact decimal/number representation); section digests and full-artifact digest over the canonical bytes; versioned artifact schema v1.

**Seam:** canonicalization/digest module (pure).

```
describe("canonical JSON and digests")
- it should serialize two objects with identical content but different key insertion order to byte-identical canonical JSON and therefore identical SHA-256 digests
- it should round-trip Money/date/identity values without precision loss or representation drift
- it should compute the full-artifact digest over exactly the canonical bytes recorded in the Workspace Backup Manifest
```

### T3 — Module exportSnapshots bound to one snapshot
**Type:** behavior-bearing. **Depends:** T2.

`exportSnapshot` for Trade Record, Journal, Market Data, and Reference Catalog, each bound to Workspace's one full read snapshot: every identity, fact/audit revision, form definition, nonsecret configuration, and seed state for round-trip equivalence; exclusions — credentials, unsaved forms, raw provider payloads, transient diagnostics, reports, replay projections, cursors, rebuildable indexes/caches/projections.

**Seam:** the four modules' export operations over the real store.

```
describe("section export completeness and exclusions"
- it should include every authoritative identity and revision present in the section (verified by count and revision enumeration against the live store) bound to the common snapshot
- it should exclude credentials, raw provider payloads, diagnostics, reports, and rebuildable private projections from every section
- it should fail the section read (surfacing to Not Completed) rather than emit a partial section silently
```

### T4 — Workspace.exportBackup
**Type:** behavior-bearing. **Depends:** T3.

One full read snapshot; sections + Workspace metadata assembled into the versioned artifact with the Workspace Backup Manifest (versions, capability footprint, counts, exclusions, section digests, full digest); host file download; result `Downloaded` carrying source `WorkspaceSnapshotBinding`, full artifact digest, manifest digest, and suggested file name — and **no** `CompletedBackupReceipt`; `Conflict` on a stale expected binding; `Not Completed` with failed stage/reason and unchanged-Workspace evidence on read failure. Export remains available in Recovery Only for readable data.

**Seam:** `Workspace.exportBackup` over the real store (host download replaced by the test runner's file capture — disclosed platform shim).

```
describe("exportBackup"
- it should return Downloaded with the manifest counts/digests matching the exported content and one consistent snapshot binding across all sections, producing no receipt
- it should return Conflict with the current binding when the expected Workspace binding is stale, downloading nothing
- it should return Not Completed with the failed stage and unchanged-Workspace evidence on a controlled section-read failure, issuing no artifact and no receipt
- it should succeed from a Recovery Only session whose existing Workspace remains readable, while a mutation in the same session still returns RuntimeNotWritable (AC-DEL-005 export half)
```

### T5 — Workspace.confirmBackup and the CompletedBackupReceipt
**Type:** behavior-bearing. **Depends:** T4.

Reads the trader-selected file through the host's ordinary file selection; verifies completeness, digest validity, and equality of full artifact digest and source binding with the expected values from the Downloaded result (held in view state only); `Completed` with a receipt binding source snapshot, artifact digest, manifest digest, read-back verification evidence, and completion time; `Not Verified` (unreadable / incomplete or corrupt / a different artifact); writes nothing; no pending verification is stored — leaving before verifying requires exporting again.

**Seam:** `Workspace.confirmBackup` over the real store (file selection replaced by the test runner's file provider — disclosed platform shim).

```
describe("confirmBackup"
- it should return Completed with a CompletedBackupReceipt binding the exact source WorkspaceSnapshotBinding, full artifact digest, manifest digest, and read-back evidence when the selected file is complete and matches
- it should return Not Verified with the reason when the file is unreadable, truncated or corrupted, or a different artifact (digest mismatch), never issuing a receipt
- it should write nothing in every outcome (Workspace revisions unchanged)
- it should leave no stored pending verification, so a later session cannot verify against stale expectations
```

### T6 — Concurrent-mutation exclusion and secrets exclusion by construction
**Type:** behavior-bearing. **Depends:** T4, T5.

A mutation committed after the export snapshot is wholly outside the artifact (no torn sections); the provider credential present in the live Workspace (stub-enabled provider from VD4) is absent from the artifact bytes and from every section buffer by construction — exclusion verified by content scan, not by manifest assertion alone.

**Seam:** export/confirm interplay over the real store.

```
describe("snapshot isolation and secrets exclusion"
- it should keep the exported artifact byte-identical and internally consistent when a later mutation commits after the export snapshot, with the artifact's binding revision strictly earlier than the mutation's
- it should produce artifact bytes in which the configured credential string appears nowhere (full-byte scan), while nonsecret provider settings appear, and the manifest's exclusions list names credentials explicitly (AC-BACK-001 secrets aspect)
```

### T7 — UI: the two-step backup flow
**Type:** behavior-bearing. **Depends:** T4, T5.

Backup surface (from settings and from the Recovery Only view): Download backup → explicit "downloaded, not verified" state with the explanation that the application cannot see where the browser saved the file; Verify backup → trader selects the saved file → Completed with receipt, or Not Verified with reason; completion language only ever tied to a receipt; navigation away stores no pending verification.

**Seam:** backup surface against real modules (Playwright download handling for the real browser path).

```
describe("two-step backup UI"  — seam: backup surface
- it should present a download as "downloaded, not verified" — never as completed — until verification succeeds
- it should show Completed with receipt details only after the selected file verifies, and Not Verified with the specific reason otherwise
- it should require a fresh export after navigating away, offering no stale verification state
- it should remain reachable in the Recovery Only view while mutations there stay disabled
```

### T8 — VD6 integration suite additions + cumulative gate
**Type:** structural. **Depends:** T2–T7. **Verification:** cumulative suite (VD1–VD6) green. Backup-artifact schema v1 has no prior versions; the migration framework records it as the initial artifact schema (no data migration this VD).

### T9 — Fresh browser-critic gate
**Type:** structural gate. **Depends:** T8.

## Progress table

| Task | Status | Evidence |
|---|---|---|
| T1 interface freeze | planned | |
| T2 canonical JSON + digests | planned | |
| T3 section exports | planned | |
| T4 exportBackup | planned | |
| T5 confirmBackup + receipt | planned | |
| T6 isolation + secrets exclusion | planned | |
| T7 two-step UI | planned | |
| T8 integration gate | planned | |
| T9 critic gate | planned | |

## Mock-free real-stack integration cases (cumulative suite)

Disclosed infrastructure: `fake-indexeddb`; test-runner file capture/selection shims for the host download and file-selection capabilities (platform seams, not application modules); the VD4 provider stub with a configured test credential present in the live Workspace.

**Populated-workspace fixture (built through authoritative VD1–VD5 commands):** ≥2 confirmed plans (stock + option), opening and closing decisions with Lot Matches, one deferred-then-resolved Debt, one decline, Manual marks + one acknowledgment, provider enabled with credential, one closed trade with Close Review.

| ID | Case | Real-stack path and durable-state proof |
|---|---|---|
| INT-VD6-01 | Coherent full export + verified read-back (AC-BACK-001 happy path) | Export over the populated fixture → all four sections + metadata share one snapshot; manifest counts/digests match enumeration; trader-selected saved file verifies → Completed with receipt bound to source binding + full digest; Workspace revisions unchanged throughout |
| INT-VD6-02 | Concurrent later mutation wholly outside | Commit a trade mutation after export → artifact bytes and binding unchanged; verification still Completes against the pre-mutation expected values; the mutation's revision is outside the artifact |
| INT-VD6-03 | Secrets provably excluded | With the stub credential configured: full-byte scan of artifact = zero occurrences; manifest exclusions explicit; provider settings (nonsecret) present (AC-BACK-001) |
| INT-VD6-04 | Not Verified paths | Truncated file; single-byte corruption; different artifact (verify file A against B's expectations); unreadable file → each Not Verified with its reason, no receipt, no write (AC-BACK-001) |
| INT-VD6-05 | Not Completed + Downloaded-no-receipt | Controlled section-read failure → Not Completed with stage + unchanged-Workspace evidence; successful export alone yields Downloaded with no receipt and no completion claim (AC-BACK-001 / AC-DEL-005) |
| INT-VD6-06 | Recovery Only export (AC-DEL-005 completes) | Readable workspace + induced readiness failure → reads/history/export/verification available; representative mutation and Restore-application attempts return RuntimeNotWritable unchanged |

## Browser-critic flows

| ID | Flow | Pass condition |
|---|---|---|
| CRIT-VD6-01 | Happy two-step backup | Download → file lands in the browser's download flow → Verify selects the saved file → Completed with receipt displayed; backup marked complete only now |
| CRIT-VD6-02 | Unverified honesty | Download, then leave the flow → backup shown as downloaded-not-verified with the cannot-see-where-it-saved explanation; no completion claim |
| CRIT-VD6-03 | Tampered / wrong file | Corrupt or different saved file selected → Not Verified with specific reason; no receipt; prior state unchanged |
| CRIT-VD6-04 | Recovery Only backup | Induced readiness failure with readable workspace → backup export + verify reachable from the restricted view; mutations disabled with RuntimeNotWritable surfaced |
| CRIT-VD6-05 | Resize/keyboard over the backup surface | Equivalent at both widths, keyboard-completable |

## Acceptance-scenario coverage

| Scenario | Plan marking @VD6 | VD6 owns | Tasks | Integration | Critic |
|---|---|---|---|---|---|
| AC-DEL-005 | Completes | Recovery-Only reads + export + verification; unreadable-root/Integrity-Blocked half already owned by VD1 | T4, T5, T7 | INT-VD6-05/06 | CRIT-VD6-04 |
| AC-BACK-001 | Completes | concurrent mutation, digest validation, every Not Verified/Not Completed path, credentials provably excluded, manifest explicitness (artifact-fact coverage note F14) | T2–T6 | INT-VD6-01–05 | CRIT-VD6-01–03 |

## Flagged for review (cited passages; no silent choice made)

- **F14 — AC-BACK-001's artifact-fact coverage grows after VD6.** The scenario's Given names "corrections, Voids, … Marks/Bars/acknowledgments" — Bars arrive VD7 and corrections/Voids at VD13/VD17, so the first representative artifact contains every fact *creatable through VD5* (plans, executions, journal/Debt, marks/acknowledgments, closed trades/Lot Matches/Close Reviews, provider settings). This matches the plan's own decision-13 scoping ("the first representative export now also contains closed trades, FIFO Lot Matches, and Close Reviews, and — with the provider already installed — AC-BACK-001's credentials-excluded evidence completes at backup itself"). Proposed reading: the backup *machinery* is fully proven at VD6; artifact coverage of later-born fact types accrues at VD7/VD13/VD17 naturally. Confirm.
- **F4 (from the VD1 file) resolves here:** AC-DEL-005's Recovery-Only export half completes at VD6, not VD5 as the VD1 partial line's declared scope suggests (exportBackup is a VD6 operation).
