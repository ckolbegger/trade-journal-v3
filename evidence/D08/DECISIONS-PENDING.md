# D08 decisions pending

This file lists every question asked of the user during D8, open and answered (decision 113): the task, the question, the options with their tradeoffs, the recommendation, and the answer with its date.

## Q1. The Backup page's words that no approved row covers (T8.12) — answered 2026-11-14

**Task:** T8.12 (lane UB); paused with T8.13, the later task in its lane.

**Question.** A141 and B8.5 give the Backup page's key texts ("Downloaded, not verified yet. This app can't see where your browser saved the file.", "Backup complete", "Choose another file", "The backup could not be made", "Restore needs a browser that can save safely"). The handoff makes any other screen text a pending decision. T8.12 also needs:

| # | Where | Proposed text |
|---|---|---|
| 1 | Page heading; the two section headings | "Backup"; "Download a backup"; "Restore from a backup" |
| 2 | Progress while the backup is made | "Making the backup: 1,200 of 5,000 records" |
| 3 | A141's note that saves wait (P29) | "While a backup is being made, saving waits until it finishes." |
| 4 | Not Completed, stage Read | "The backup could not be made. Your journal couldn't be read. Nothing was changed." with **Retry** |
| 5 | Not Completed, stage Offer | "The backup could not be made. Your browser didn't accept the download. Nothing was changed." with **Retry** |
| 6 | Progress while verifying | "Checking the file: 1,200 of 5,000 records" |
| 7 | Completed (time in the Workspace zone, convention C4) | "Backup complete. Checked Sat Nov 14, 16:05." |
| 8 | Not Verified, Unreadable | "This file couldn't be read. Choose the file you just downloaded." |
| 9 | Not Verified, IncompleteOrCorrupt | "This file is incomplete or damaged, so it isn't a usable backup." |
| 10 | Not Verified, DifferentArtifact | "This is a different backup from the one you just downloaded." |
| 11 | Recovery Only, under "Restore needs a browser that can save safely" | the shell's existing failed-check sentences, unchanged |

**Options.** (a) Approve the table as written. (b) Edit any row. (c) Leave the words to the implementing subagent (rejected by the handoff's rule).

**Recommendation:** (a); the texts follow A141's tone and the existing readiness copy.

**Answer (2026-11-14):** (a), the table approved as written ("a, approve the table as written"). T8.12 and T8.13 resumed. The approved words are to be carried into the plan's next revision (r103) with any later word approvals. T8.12 then showed three states the table doesn't word; they are put to the user in Q2, part B.

## Q2. The Restore flow's words (T8.13), and three Backup-page states (T8.12) — open, asked 2026-11-14

**Task:** T8.13 (lane UB), not started until answered; T8.12's three mapped states (part B) stay as built until answered.

**Already approved (A142, kept as written):** "Choose backup file"; "Checking the backup. Your current journal is not changed."; Cancel; "Restoring replaces your entire current journal"; "I understand this replaces my entire current journal"; "Back up this journal first (recommended)"; "Replace without a backup"; "If this backup is wrong or incomplete, your current journal cannot be recovered."; "Replace entire journal"; "Your current journal is unchanged"; "Check the backup again"; "Restore complete". The inline safety backup reuses Q1's texts.

**Part A, proposed for T8.13:**

| # | Where | Proposed text |
|---|---|---|
| A1 | Progress while checking | "Checking the backup: 1,200 of 5,000 records" |
| A2 | Rejected: heading, then the issue list | "This backup can't be restored." then "Your current journal is unchanged." Over 200 issues: "Showing the first 200 of 1,234 problems." |
| A3 | Issue sentences (A134) | UnsupportedFormat "This file uses a backup format this app doesn't read."; UnsupportedNewerSchema "This backup was made by a newer version of the app."; InsufficientCapacity "There isn't enough storage space: 120 MB needed, 80 MB available."; MalformedRecord "Line 1,042 isn't a valid record (r.facts[2].price)."; DigestMismatch "The trades section doesn't match its checksum, so the file was changed or damaged."; IncompleteArtifact "The file is incomplete."; ManifestMismatch "The backup's summary doesn't match its contents."; UnsupportedDataCapability "The backup holds data this version can't restore: instrument.structure."; CrossSectionReference "A record refers to an Account that isn't in the backup (fx-0016)." The module validators' codes reuse their existing startup-check sentences (`readiness-copy.ts`). |
| A4 | Preview: source | "From a backup made Fri Nov 20, 18:00 (release 2026.11.14, schema 7)"; for a blocked-database copy add "a copy of a journal that couldn't be updated" |
| A5 | Preview: counts table | columns "In the backup" and "In your current journal"; rows "Planned Trades", "Open Trades", "Closed Trades", "Position Changes", "Executions", "Expirations", "Deviations", "Journal entries: <Entry Type>", "Declined reflections", "Reflections owed: <status>", "Marks", "Marks acknowledged unavailable", "Institutions", "Accounts", "Strategies", "Close Reasons", "Journal question revisions"; a kind with history adds "(N versions)" |
| A6 | Preview: migrations | "Updated from schema 5 to 6", "Added default: Long Call"; none: "No updates needed." |
| A7 | Preview: repairs | "<Trade summary>: lifecycle recorded Open, facts say Closed. It will be corrected." and "<Trade summary>: Entry Size deviation missing. It will be added."; none: "No repairs needed." |
| A8 | Warnings | TimeZoneDiffers "The backup's time zone (America/New_York) differs from this journal's (America/Chicago). The restored journal uses the backup's."; OlderSchema "This backup was made by an earlier version and will be updated as it's restored."; AnotherTabHasUnsavedWork "Another tab has unsaved changes. They will be lost when the journal is replaced." |
| A9 | Safety choice radio group's label | "Safety backup" |
| A10 | Inline backup Conflict (A142) | "Your journal changed after the backup was checked." with "Check the backup again" |
| A11 | Apply rejected, before "Your current journal is unchanged." | SafetyBackupStale "Your safety backup is out of date: the journal changed after it was made."; SafetyBackupNotRecognized "That safety backup wasn't made in this session. Back up again."; Conflict "Your journal changed after the backup was checked."; CandidateChanged or PreparationNotFound "The checked backup is no longer available."; AlreadyInitialized "A journal was started in another tab meanwhile."; RuntimeNotWritable: the shell's existing readiness sentence |
| A12 | Restore complete summary | "Your journal now holds the restored backup." with its counts, and a button "Go to Trades" or "Add an institution and account" (the landing's next destination) |

**Part B, T8.12's states with no approved row (built as described, pending ratification):**

| # | State | As built |
|---|---|---|
| B1 | Before the first progress report arrives | "Making the backup" / "Checking the file" (row 2 and 6 without the count) |
| B2 | `exportBackup` rejects unexpectedly, or returns Conflict (the page passes no expected binding, so Conflict shouldn't occur) | Q1 row 4 (the Read failure) with Retry |
| B3 | `confirmBackup` rejects unexpectedly | Q1 row 8 (Unreadable) |
| B4 | Not Completed by reason (ocr finding T8.12-B2: the page shows the stage only) | ReadFailed: Q1 row 4; OfferFailed: Q1 row 5; IntegrityBlocked: "The backup could not be made. Your journal has a problem that blocks a normal backup. Nothing was changed."; Conflict: "The backup could not be made. Your journal changed while the backup was being made. Nothing was changed." Each with Retry. B4 replaces B2's Conflict mapping. |

**Part C, T8.14's blocked views and shell (built with placeholder text where noted):**

| # | State | Proposed |
|---|---|---|
| C1 | Blocked view, after Download a copy / Verify | The Backup page's texts: A141's Downloaded line with the file name, "Backup complete", Q1 rows 8–10 and part B4. Replaces the placeholder raw codes ("Not completed: Read, ReadFailed"). |
| C2 | AwaitingMigration explanation | P32's sentence with a closing period added |
| C3 | Another tab's Restore | A136's sentence and a "Reload" button, no heading |
| C4 | Links | About's narrow link "Backup"; in A143's not-protected sentence, the link text "Download a backup" |

**Options.** (a) Approve parts A, B and C as written. (b) Edit any rows.

**Recommendation:** (a).

**Answer (2026-11-14):** (a), parts A, B and C approved as written ("Q2 a"). T8.13, T8.12-B2 and T8.14-B3 resume. The approved words are carried into r103 with Q1's.

## Q3. Do backups carry each record's internal write stamp? (T8.3 report) — open, asked 2026-11-14

**Task:** T8.2 and T8.4 (their briefs), and Restore's T8.6–T8.9. Nothing is paused yet: T8.2 starts only after T8.1 merges.

**Question.** Every stored record carries `revision`, the Workspace content revision at which it was last written. It is storage bookkeeping, not journal content. A125 excludes "the Workspace content revision" but doesn't say whether these per-record stamps count. The migration copy (`copySnapshot`) deletes them, and a new database stamps its records `revision: 1`.

**Options.**
- (a) Leave them out. The export projection removes `revision` from every record, the manifest's `exclusions` names it, and Restore stamps records at the new database's revision 1, as the migration copy does. This keeps the file the same when nothing in the journal changed. It also avoids restored records carrying stamps from another database.
- (b) Export as stored. Restore would then have to overwrite or ignore the stamps.

**Recommendation:** (a).

**Not a question:** journal entries' and declines' top-level `anchorTradeId` is stored data and A125 doesn't exclude it, so it is exported as stored.

**Answer (2026-11-14):** (a), leave the stamps out ("Q3 a"). The export projection removes `revision` from every record, the manifest's `exclusions` names it, and Restore stamps records at the new database's revision 1. T8.2 starts. This refines A125 and is carried into r103.

## Q4. Stream the export instead of holding it in memory (T8.4 report) — open, asked 2026-11-14

**Task:** T8.4 (lane WB, committed `321f4e62`), and through it T8.11's worker and T8.19's benchmark. Nothing is paused: T8.4 is correct as built, and its review continues.

**Question.** A128 says the export reads `meta` and every store's `count()` first, then streams batches through projection, hashing and gzip. T8.3's `readExportSnapshot` returns the binding, `meta` and counts only after the last batch. The artifact header needs the counts first. So T8.4 holds every projected batch in memory until the read ends, then writes the file. That's correct, but at the mature size (about 400 MB) it keeps the whole journal in memory, which P29 and A128 were written to avoid. Neither T8.3's nor T8.4's planned cases test this, and ocr didn't raise it, so it isn't a bug task under the review rule.

**Options.**
- (a) Add a follow-up task, T8.3-F1: `readExportSnapshot` calls an `onStart({ binding, meta, counts })` callback before the first batch, as A128 orders. Then T8.4-F1 has `runExport` write the header at start and stream each batch straight into the artifact writer. Both are small and run in lanes PS and WB before T8.11. Recorded as deviations from the frozen task list, with red/green cases ("it should report the binding, meta and counts before the first batch"; "it should write each batch into the artifact before the next is read").
- (b) Keep the buffering, and let T8.19's benchmark show whether memory is a real problem at the mature size.

**Recommendation:** (a). It's what A128 already specifies. It's cheap now and expensive after T8.11 builds the worker around it.

**Also recorded, not questions (T8.4's implementation-level choices):**
- An unknown layout returns `NotCompleted(Read, IntegrityBlocked)`, because the frozen reason type has no `UnknownLayout`.
- The seed-manifest versions for schemas 1–4, used only by a blocked export of an old database, are inferred from the manifest files. Only schema 5 is tested.

**Answer (2026-11-14):** (a), stream it now.
- T8.3-F1 (lane PS, recreated) adds the `onStart({ binding, meta, counts })` callback before the first batch.
- After it merges, T8.4-F1 (lane WB, recreated) writes the header at start and streams each batch into the artifact writer.
- Both come before T8.11, and both are recorded as deviations from the frozen task list, carried into r103.

## Q5. Restore flow gaps found while building T8.13 — open, asked 2026-11-14

**Task:** T8.13 (lane UB, committed `61fb47bb`, under review). Nothing else is paused; T8.12 and T8.13 merge together once this is settled and the review is clean.

| # | Gap | As built | Proposed |
|---|---|---|---|
| 1 | Label for the "Replace without a backup" acknowledgment checkbox (no approved row) | labelled by A142's warning sentence itself | keep: the checkbox reads "If this backup is wrong or incomplete, your current journal cannot be recovered." |
| 2 | Repair lines (Q2 A7 approved "<Trade summary>: …") | the preview type `RestoreRepair { tradeId, kind, stored, expected }` carries no summary, so lines show the Trade id; the Entry Size line can't be told apart | T8.8 (which builds the preview) adds `tradeSummary` to `RestoreRepair` (a change to T8.23's frozen type) and uses `kind` values `Lifecycle` and `EntrySizeDeviation`; T8.13 then renders A7's two sentences exactly |
| 3 | Module validator codes with no existing sentence (for example `PriceNegative`) | the bare code | one fallback sentence: "A record in the {section} section didn't pass a check ({code})." |
| 4 | `prepareRestore` itself fails unexpectedly | stays on "Checking…" | "The backup couldn't be checked. Your current journal is unchanged." with **Choose backup file** |
| 5 | Apply returns `ConfirmationRequired` or `SafetyBackupRequired` (the screen prevents both) | "Your current journal is unchanged." alone, with Check the backup again | keep |
| 6 | Counts row "Marks acknowledged unavailable" (approved in Q2 A5) uses a phrase the wording check reserves for `calculation-words.ts` | assembled with `join(' ')` to pass the check, which defeats the check's purpose | export the label from `calculation-words.ts`, where the rule wants it, and import it |

**Added after T8.13's ocr review (2026-11-14).** Two of its Valid findings, T8.13-B2 and T8.13-B3, need on-screen text that no approved row covers:

| # | Gap | As built | Proposed |
|---|---|---|---|
| 7 | `prepareRestore` returns `RuntimeNotWritable` (T8.13-B3) | silently goes back to the file chooser | the shell's existing readiness sentence, as A11 uses on the apply side, with **Choose backup file** |
| 8 | `applyPreparedRestore` fails unexpectedly (T8.13-B2) | Replace stays disabled, with no message | "The Restore didn't finish. Reload the app to see which journal is in use." with **Reload**. It doesn't say "unchanged", because activation is one pointer write and the screen can't tell which side of it the failure fell on |

The reviewer also noted two defects that ocr didn't raise. Reviewer notes don't become bug tasks on their own, so they are listed here for your call:

| # | Gap | As built | Proposed |
|---|---|---|---|
| 9 | CrossSectionReference sentence | "an ${kind}" reads "an Trade" or "an Journal entry" | choose "a" or "an" from the kind |
| 10 | "(N versions)" in the counts | each row shows its whole kind's total, so the Planned, Open and Closed rows all repeat the Trades total | show the version count once per kind: on a Trades total line and on the Journal entries row |

**Options.** (a) Approve the proposals as written. I add one follow-up task in lane UB for items 3, 4, 6, 9 and 10 (and 2's rendering once T8.8 supplies the fields), note item 2 for T8.8, and use items 7 and 8's texts in bug tasks T8.13-B3 and T8.13-B2. (b) Edit any row.

**Recommendation:** (a).

**Recorded, not questions:** the preview's source time uses the backup's time zone, since `RestoreFlow`'s frozen props carry no Workspace zone (the restored journal uses that zone; A8's warning says so). `RestoreCounts.versions` is keyed `trades`, `entries`, `debts`; T8.8 uses those keys. The Restore complete links go to `/` and `/accounts`, so `RestoreFlow` sits inside the router (T8.11).

**Answer (2026-11-14), asked in three parts:**
- **Items 3, 4, 7 and 8:** the texts are approved as written. The user added: "Can you write something to the console log that could be captured and forwarded to the dev team to help them understand what the problem was?"
  - Asked how wide the logging should go, the user chose **all backup and Restore failures**.
  - Every backup and Restore failure writes one `console.error` starting with `[Trade Journal]`. It is followed by an object holding:
    - the stage;
    - the result kind or error name;
    - the message;
    - the stack, when an error was thrown;
    - record ids, section names, line numbers and check codes, but never journal contents.
  - The coordinators' failure results carry that detail, through an optional `detail` field added to the frozen result types for this purpose. The UI logs it.
- **Item 2:** the type change is approved. T8.8 adds `tradeSummary` and the kinds `Lifecycle` and `EntrySizeDeviation` to `RestoreRepair`.
- **Items 1, 5, 6, 9 and 10:** approved as written.

New work (recorded as deviations from the frozen task list, carried into r103):
- T8.13-B2 and B3 use the texts of items 8 and 7, plus the log line.
- T8.13-F1 (lane UB) covers items 3, 4, 6, 9 and 10, the shared log helper, and the Backup page's logging.
- T8.4-F2 and T8.5-F2 carry the failure detail out of export and verification.
- T8.8 and T8.9 carry it from preparation and apply, and render item 2's sentences.

## Q6. Sentences for four new journal-check problems (T8.6, D2 follow-up F12) — answered (a), 2026-11-14

**Task:** T8.6's F12 continuation (lane FM). The work is done and staged but not committed. The type check requires every check code to have a sentence in the startup table (`src/ui/readiness-copy.ts`, `MIGRATION_ISSUES`), and the Restore screen reuses those sentences (Q2 A3). Nothing else is paused; T8.6's ocr bug tasks wait behind this in lane FM.

| Code | When it's reported | Proposed sentence |
|---|---|---|
| `DuplicateTradeId` | two Trades share one id | "Two Trades share one identity." |
| `DuplicateEntryId` | two Journal Entries share one id | "Two Journal Entries share one identity." |
| `MissingPositionChangeMember` | a position change names an execution or expiration the Trade doesn't hold | "A position change names an execution or expiration that the Trade does not record." |
| `VersionChainBroken` | a Trade fact has no versions, or its version numbers aren't 1, 2, 3 … in order | "A Trade fact has no versions, or its versions are out of order." |

The sentences follow the table's existing style (for example, "A Trade records the same fact identity twice.").

**Options.** (a) Approve as written; F12 adds them and commits. (b) Edit any sentence.

**Recommendation:** (a).

**Recorded, not questions:** D2's B2.12 Open-list Error state still has a working trigger. The app's read path still throws on a missing member, and the fault fixtures bypass the Restore validator, so the test passes unchanged ("the Open list in every state", `e2e/d2/responsive-a11y.spec.ts`). The continuity rule comes from the Trade Record design's "version continuity". Every fact in `facts` and `closeReasonFacts` has at least one version, numbered 1, 2, 3 … in array order. A broken Trade is reported and not derived.

**Answer (2026-11-14):** (a), the four sentences approved as written. T8.6's F12 continuation adds them to `MIGRATION_ISSUES` and commits. `readiness-copy.ts` is lane US's file in this wave, so the four new entries are reconciled when lanes FM and US merge.

## Q7. Sentence for an empty Journal Entry or debt history (T8.6-B2) — answered (a), 2026-11-14

T8.6-B2 reported an empty Journal Entry or Debt history with Trade Record's `VersionChainBroken`. That code's approved sentence names a Trade fact, and the startup screen picks its sentence by code alone. The options were:
- (a) a separate Journal code with "A Journal Entry or reflection debt has no versions.";
- (b) one code with a broader sentence.

**Answer:** (a), as recommended. T8.6-F2 (lane FM) adds the Journal-only code and its sentence to `MIGRATION_ISSUES`.

## Q8. Where "(N versions)" goes on the Restore counts (T8.13-F1, Q5 item 10) — open, asked 2026-11-14

Q5 item 10 approved "(N versions)" once on a Trades total line and once on the Journal entries row. A5's approved counts layout has neither line. It has Planned, Open and Closed rows, one "Journal entries: <type>" row per form, and "Reflections owed".

T8.13-F1 added two summing rows to the counts table:
- "Trades", the sum of Planned, Open and Closed, with "(N versions)";
- "Journal entries", the sum over forms, with "(N versions)".

The per-form rows no longer show versions, so reflection-debt versions appear nowhere. The same table also shows on the Restore complete summary.

The options are:
- (a) keep the two summing rows as built;
- (b) no new rows: put "(N versions)" after the existing "Planned" row and the first "Journal entries" row;
- (c) something else.

The interim choice is (a), as built, until the user answers.

## Q9. Should the developer log keep an unexpected error's message? (T8.13-F1 ocr) — open, asked 2026-11-14

Q5's approved log line holds the stage, the error's name, **its message**, **the stack** and safe context. The user's rule is no journal contents in the log.

ocr flagged (Doubtful) that an unexpected error's message can quote whatever text caused it. If Restore's checking or applying code ever threw an error quoting backup text, that text would reach the log.
- Today, no throw site was found that does this. T8.4-B5 already fixed the one known case on the export side, an unsafe number's value.
- The risk is from future code or third-party errors.

The options are:
- (a) Keep the message and stack (Q5 as approved). Each known leaking source is fixed where it is found, as T8.4-B5 did.
- (b) For unexpected errors, log the name and the stack's location lines, but not the message, and not the stack's first line, which repeats the message. Apply this to Restore's check and apply logs and to the export's `describeError`. Expected failures already log fixed messages and codes.
- (c) something else.

Recommended: (b). The stack's file and line locations are what developers need to find a bug, and dropping the message closes the leak for good. T8.13-B8 waits for the answer.

Added from the T8.4-B5 review, as a reviewer note: an export error's message ends with the record path, such as `at $.someKey`, built from object keys. A record keyed by user-entered text would leak it through the message. Under (b) the message is not logged, which closes this too.

**Q8 revised (2026-11-14), after the user asked for more detail:**
- Option (b) is withdrawn. A count on the Planned row would still read as that row's own version count, which was the original confusion.
- A gap the first wording missed: as built, reflection-debt versions show nowhere. Before T8.13-F1 they repeated on each "Reflections owed: <status>" row.

The options are now:
- (a) as built;
- (a+) as built, plus a "Reflections owed" total row with "(N versions)", so all three kinds with history show their count once, as A5 says;
- (c) no version counts in the table.

Recommended: (a+).

**Q8 answer (2026-11-14): (a+), as recommended.** Keep the Trades and Journal entries total rows, and add a "Reflections owed" total row with "(N versions)" above the status rows. T8.13-F2 (lane UB) adds it. The Restore complete summary shares the table.

**Q9 answer (2026-11-14): (a).** Keep the message and stack for unexpected errors, as approved in Q5. The user: "I am not particularly worried about anything being exposed in the logs."
- T8.13-B8 is closed with no change, because the user's decision makes the flagged behavior intended.
- The fixes already made stay: T8.4-B5 (no value in the unsafe-number message), T8.5-B7 (only known section names) and T8.5-B8 (only the cause's name).
- Expected failures keep their fixed wording and codes.
