# Backup is a file download verified by read-back

Status: accepted, 2026-10-10. Amends [ADR 0008](0008-pwa-delivery-and-runtime-readiness.md).

ADR 0008 counted a backup as completed only when an external destination positively confirmed the transfer. A browser page cannot observe an ordinary download after handing it to the browser, and the browser API that lets a page write a chosen file and then read it back is a save dialog that Safari and Firefox do not provide. Under that rule, many browsers could never produce a completed backup.

Backup is now two steps that work in every browser that passes Runtime Readiness. Export builds one digest-valid artifact from one full snapshot and offers it as an ordinary file download. Its result is Downloaded, never completed, because the application cannot see whether or where the file was saved. Verification then asks the trader to select the saved file through ordinary file selection, reads it back, and checks that it is complete and that its full artifact digest and source Workspace binding match the export. Only a successful verification produces a `CompletedBackupReceipt`.

Consequences:

- Workspace gains one non-mutating operation, `confirmBackup`, for eight in total.
- Verification is optional for keeping a copy, but an unverified download is never presented as a completed backup and cannot satisfy the Restore safety-backup choice.
- Nothing about a pending verification is stored. The expected digest and binding come from the Downloaded result held in view state; a trader who leaves before verifying exports again.
- Export and verification remain available in `Recovery Only`.
- Artifact content, digests, Restore validation, and replace-only Restore are unchanged.
