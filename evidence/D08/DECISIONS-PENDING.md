# D08 decisions pending

This file lists every question asked of the user during D8, open and answered (decision 113): the task, the question, the options with their tradeoffs, the recommendation, and the answer with its date.

## Q1. The Backup page's words that no approved row covers (T8.12) — open, asked 2026-11-14

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

**Answer:** pending.
