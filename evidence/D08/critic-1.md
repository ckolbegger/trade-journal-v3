# D08 critic-1 report

## 1. Header
- **When:** Sun 2026-11-15, 09:30 to 09:47 EST.
- **Commit:** built and tested at 4ed74668. During my run the main session committed c55e2933 ("docs(plan): D8 T8.22 critic-1 started"), which changes the plan only.
- **Versions:** Node v26.12.0, Playwright 1.63.0, Chromium 153.0.8010.12.
- **Servers:** `npm run build` + `npm run preview` on port 5175 for C8.1 to C8.5 and C8.10. I stopped that server to make C8.10's offline run. Then `npm run build:faults` + `npm run preview:faults` on port 5175 for C8.6, C8.7, C8.8 and the axe pass. I did not run `serve:releases` (C8.9 is withdrawn). I stopped every server I started, and nothing is listening on 5175.
- **Browsers:**
  - C8.1 to C8.5 ran in the persistent Chrome-for-Testing profile from `profileAt`.
  - C8.6 to C8.10 and the axe pass ran in Playwright's bundled Chromium headless shell, because of the browser crash described under minor observations.
- **Files:** I edited no tracked file and made no commits. Scripts, logs and screenshots are in `/Users/ckolbegger/src/trade-journal-v3/worktrees/claude-opus-5.5/test-results/critic-d08-1/`, with screenshots in `shots/`.

## 2. Results

| Flow | Result | Key observations |
|---|---|---|
| C8.1 Download and verify | PASS | Set up 3 Trades (XYZ Open, ABC and QRS Planned). Sidebar shows "Backup". After Download backup the page said "Downloaded, not verified yet. This app can't see where your browser saved the file.", gave the file name `trade-journal-2026-11-15-0936-5d7117aa.tjbackup` and offered Verify backup. After Verify backup with the saved file: "Backup complete. Checked Sun Nov 15, 09:36." Leaving the page and coming back clears the downloaded state. The saved file is gzip, schema 7, exportKind Normal, with 3 Trades. |
| C8.2 Verify the wrong file | PASS | A different backup: "This is a different backup from the one you just downloaded." A copy cut to half its bytes: "This file is incomplete or damaged, so it isn't a usable backup." The same message for a copy with one edited value. A non-backup file: "This file couldn't be read. Choose the file you just downloaded." Each case offers "Choose another file", and none shows a completed claim. |
| C8.3 Restore over existing data | PASS | Second profile: Schwab/Brokerage with LMN Open. The preview heading reads "Restoring replaces your entire current journal". Counts sit side by side ("Trades 3 (14 versions) / 1 (6 versions)", "Open Trades 1 / 1", "Journal entries 4 (4 versions) / 2 (2 versions)" and so on), followed by "No updates needed." and "No repairs needed." Replace entire journal stayed disabled in every partial state (nothing set; radio only; downloaded but not verified; verified but box unticked; box unticked again). It was enabled only with the box ticked and a verified safety backup ("Backup complete. Checked Sun Nov 15, 09:37."). Afterwards the screen showed "Restore complete. Your journal now holds the restored backup." and "Go to Trades". The Open, Planned and Accounts lists match the first profile exactly. Every store is equal apart from the write stamps (`revision`). One Workspace remains and no candidate. A variant whose journal used a different time zone showed: "The backup's time zone (America/New_York) differs from this journal's (Europe/London). The restored journal uses the backup's." |
| C8.4 Restore declined and first run | PASS, with defects 1 and 3 | Choosing "Replace without a backup" shows "If this backup is wrong or incomplete, your current journal cannot be recovered." with its own checkbox. Replace stays disabled until that box is ticked, and is disabled again when I switch back to "Back up this journal first". First run shows "Start my journal" and "Restore from a backup" side by side. The first-run preview shows only the "In the backup" column and no safety radio group (0 radios). Ticking the one checkbox enables Replace. The restore landed on Trades with 3 Trades; the root points at one Workspace and lists no candidates. |
| C8.5 Damaged backup | PASS | Edited value: "This backup can't be restored. Your current journal is unchanged. The catalog section doesn't match its checksum, so the file was changed or damaged." Cut short: "…Your current journal is unchanged. The file is incomplete." Newer schema: "…This backup was made by a newer version of the app." Each offers "Check the backup again". A full store dump before and after all three is identical, byte for byte. In the faults build with `restore:hold-prepare`, the page showed "Checking the backup. Your current journal is not changed." with "Checking the backup: 30 of 30 records" and Cancel. |
| C8.6 Failure during apply | PASS | Fault `restore:apply:journalEntries`. After a verified safety backup, Replace showed "The checked backup is no longer available. Your current journal is unchanged." and "Check the backup again". The root pointer, the Workspace list and every store dump are unchanged, and the Trades list still shows LMN. Reloading without the fault and repeating the flow gave "Restore complete" with 17 Trades and one Workspace. |
| C8.7 Recovery Only | PASS | `?faults=inventory`. The banner reads "read only: this browser can't save right now", then "The app's offline copy is missing or damaged…", then "Another browser has its own separate storage and would start an empty journal. To move this journal, download a backup here and verify it, then restore it in a browser that can save safely." The sidebar shows Trades, Review, Accounts, Backup, About. On the Backup page, download and then verify reached "Backup complete. Checked Sun Nov 15, 09:46.". The Restore section is replaced by "restore needs a browser that can save safely" plus the failed check, with no Choose backup file button. Stores are unchanged. On narrow screens the bar has no Backup link, and About's Backup link opens /backup. |
| C8.8 Blocked journal | PASS | Schema-5 journal with a broken Close Reason: "Your journal could not be converted to this release … A Trade names a close reason that does not exist." Buttons are Retry, Download a copy, Verify. Download a copy then Verify gave "Backup complete". The file has exportKind BlockedDatabase and schemaVersion 5, and stores are unchanged. A valid schema-5 journal with the capacity check failing: "This release must convert your journal before you can use it", with "This release can't confirm the copy until your journal has been updated." Buttons are Retry and Download a copy, with no Verify. The download works and stores are unchanged. |
| C8.9 Update | Not run | Withdrawn by decision 76. |
| C8.10 Offline, responsive, keyboard, About | FAIL (defect 2) | **Offline:** with the server stopped, reload showed the Trades list. Download and verify offline reached "Backup complete. Checked Sun Nov 15, 09:44.", and Restore offline completed. **Resizing:** I resized 1280 to 375 to 320 to 1280 during the preview and again during the confirm step. The heading, the ticked box, the decline radio and the warning all survived. **Keyboard:** the whole Restore worked by keyboard (Enter on Choose backup file, Space, ArrowDown, Space, Enter). Each focused control showed a 3px solid rgb(31,95,191) outline. **About:** it lists every operation through D8, including D08P's `replayTrade`, plus `Workspace.exportBackup (Normal, BlockedDatabase)`, `confirmBackup`, `prepareRestore` and `applyPreparedRestore`. **It shows no backup ranges.** At 390 px the bottom bar has Trades, Review, New Plan, Accounts and About, with no Backup, and About's "Backup" link opens /backup. axe (WCAG 2.1 AA) is clean on the Backup page, the preview, the decline confirmation, Restore complete, the first-run Restore and the first-run preview at 375 px. Narrow layout is defect 4. |

## 3. Overall: **FAIL**

### Defects

**1. The preview's "From a backup made" time is wrong whenever the browser's time zone differs from the backup's journal zone. Severity: high (a figure is wrong).**
- **Steps:** Make a backup in a New York journal at 14:36Z. The file header has `createdAt` 2026-11-15T14:36:58Z. Restore it from first run in browsers set to different zones:
  - New York browser: "Sun Nov 15, 09:36" (correct).
  - UTC browser: "Sun Nov 15, 04:36".
  - Tokyo browser: "Sat Nov 14, 19:36".
  - Europe/London browser: "04:36".
  - Over an existing New York journal in a Tokyo browser (Backup page): "Sat Nov 14, 19:36".
- **Expected:** the created instant in the Workspace zone (plan A133). That is 09:36 (New York) or the local equivalent, never a time 5 to 19 hours off and sometimes on a different date.
- **Actual:** the time shown is consistently off by the difference between the backup's zone and the browser's zone. Note that "Backup complete. Checked …" was correct in the Tokyo-browser, New-York-journal case (09:39).

**2. About does not show the backup ranges. Severity: high (C8.10 pass condition not met).**
- **Steps:** Open About, wide or at 390 px.
- **Expected:** "About lists only the capabilities through D8 … with the backup ranges for schema 7" (section 7, C8.10). A145 gives the ranges as "export schema 7 in format 1; Restore from schemas 1 through 7 in format 1". The specs require the manifest to cover "backup/schema ranges" (delivery contract line 71; workspace.md line 27).
- **Actual:** About shows "Schema version 7" and the four backup operations. No export range, Restore range or format version appears anywhere on the page.

**3. After a first-run Restore, the first-run form stays on screen. Severity: moderate (misleading).**
- **Steps:** Fresh profile, Restore from a backup, Replace entire journal.
- **Expected:** "On success the flow discards every pre-Restore view and form and renders the Restore complete summary from the result alone" (A142).
- **Actual:** "Restore complete. Your journal now holds the restored backup." appears underneath a still-active "Start your journal" heading, the Time zone select (showing the browser's zone, e.g. Europe/London, while the restored journal is New York) and enabled "Start my journal" and "Restore from a backup" buttons. Clicking Start my journal only opened Trades. The zone stayed America/New_York, there was one Workspace and 3 Trades, so no data changed. But the screen invites the trader to "start" a journal they just restored. The same leftover form also sits above the preview and confirm step during a first-run Restore.

**4. The Restore preview scrolls sideways at 375 and 320 px. Severity: moderate (layout).**
- **Steps:** Open the Restore preview on the Backup page or on first run, then narrow to 375 or 320 px.
- **Expected:** no horizontal page scroll at narrow widths (UI contract on responsive layout, AC-UI-001).
- **Actual:** `scrollWidth` is 633 at both 375 and 320. The 64-character release hash in "From a backup made … (release 853915999821e451…a9b29, schema 7)" doesn't wrap. Screenshot: `shots/c810-preview-320.png`. The other narrow screens fit: the Backup page, Restore complete, Recovery Only shell and Backup page, Migration Blocked, AwaitingMigration and About.

**5. The preview shows internal Entry Type keys. Severity: moderate (wording; contradicts "Labels use canonical domain language … must not expose module names", ui-contract line 41).**
- **Steps:** Open any Restore preview or Restore complete summary.
- **Actual:** rows read "Journal entries: entry-type.plan-reflection", "…entry-type.position-change-reflection", "…entry-type.daily-trade-review" and "…entry-type.close-review". At 320 px these wrap into four-line labels.

**6. On the confirm step, checkboxes and radio buttons are cut off from their labels. Severity: moderate (misleading layout on a destructive step).**
- **Steps:** Open the Restore confirm step at any width (see `shots/c83-confirm.png` and `shots/c84-firstrun-preview.png`).
- **Actual:** the "I understand…" checkbox control stretches the full width of the card; its focus ring spans the whole row. Each radio circle is centered on its own line above its label. As a result, the "Back up this journal first" circle sits midway between the "I understand…" label and its own label. On first run the checkbox is a large empty square centered above its label. The labels are correctly tied to the controls (axe is clean, and the controls can be reached by label), but on screen it isn't clear which control belongs to which text.

## 4. Minor observations
- **Browser crash on download (environment, not judged a defect):** Chrome-for-Testing 153 (the `channel: 'chromium'` build that `profileAt` uses) crashed its browser process with SIGSEGV right after a backup download began. This happened intermittently with the server up, and in 4 of 4 runs of my offline script. Playwright's bundled headless shell never crashed in 4 of 4 runs, so I ran C8.6 to C8.10 in it. The crash comes from the browser, not the page; the app's page was not shown to be the cause.
- **Focus after Restore:** once Replace entire journal succeeds, keyboard focus drops to `<body>` instead of moving to the "Restore complete" heading or "Go to Trades".
- **Cancel under a held preparation:** with `restore:hold-prepare`, Cancel gave no visible response; the screen stayed on "Checking the backup: 30 of 30 records". The leftover candidate was removed at the next launch (root `candidates: []`, one Workspace). This is likely an artifact of the endless fault hold.
- **No way back from the preview:** the preview and confirm step have no Cancel or Back button. The trader can only leave by navigating away.
- **Apply-failure wording:** a failure in the journalEntries check after preparation reads "The checked backup is no longer available." That only loosely describes what happened.
- **Preview omissions:** the preview doesn't show export kind (A133). It shows time zones only when they differ, through the warning.
- **"Backup complete" without a time:** in Migration Blocked a verified copy reads "Backup complete" with no "Checked …" time, unlike the Backup page (A141 asks for the completion time).
- **"Not verified yet" with nothing to verify:** in AwaitingMigration the download says "Downloaded, not verified yet…" although Verify is deliberately not offered there.
- **Wrong reason for a non-backup file:** a plain JSON file is reported as "This file couldn't be read." rather than as incomplete or not a backup.
- **Leftover wording on first run:** the first-run preview heading says "replaces your entire current journal" when no journal exists. That is the specified A142 wording, so it isn't a defect.
- **Section headings:** they are lower-case in the DOM and shown upper-case by CSS ("download a backup", "restore needs a browser that can save safely"). Purely visual.
