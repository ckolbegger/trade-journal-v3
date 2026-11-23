# D9.5 pending decisions

## Q1 (T95.3): the saved Review views in four frozen fixtures name the old attention bands — asked 2026-11-22

**Plain words.** The Review now sorts Trades into the spec's new bands (Exit not carried out, Settlement due, Stop reached, Target reached, …). Four frozen test fixtures (`workspace-v6`, `workspace-v7`, `backup-v6-blocked`, `backup-v7`) keep a snapshot of what the Review returned when they were frozen. Those snapshots say "BoundaryReached" or "Blocker" (12 places), and with the new order two cards change places. Ten integration tests that compare against them fail (`d7/migration`, `d7s/migration` ×2, `d8/blocked`, `d8/round-trip` ×3, `d8r/restore` ×3). The stored data (`dump.json`, `backup.tjbackup`) is untouched. The plan (P174) lets a task change these snapshots only where a form's latest revision is named, so this needs your answer.

**Options.**
- (a) Regenerate the four `expected-views.json` files in a follow-on task (T95.3-D1), changing only the band values and the order they cause, with the diff recorded. Precedent: decision 117 removed `rangePosition` from eight fixtures' views the same way. Cost: a plan revision (decision 127, r116) amending P174.
- (b) Keep the old snapshots and translate new bands back to old names in the test tool. Rejected before (decision 78): the check would stop testing what the app returns.

**Recommendation:** (a).

**Answer (2026-11-22):** (a). Recorded as decision 127, plan revision 116; follow-on T95.3-D1. **Status:** answered 2026-11-22; T95.3 resumed.

**Previous status:** asked. Paused: T95.3 and the tasks blocked by it (T95.4, T95.10, T95.11, T95.16 onward through T95.3/T95.4/T95.10 chains, T95.22, T95.23). Other tasks continue; until the answer, complete runs carry these 10 known failures.

## Q2 (T95.3-D1): decision 127's scope, as measured — asked 2026-11-22

**Plain words.** Regenerating the saved Review views found (1) six fixtures fail, not four: `workspace-v5` and `backup-v5-blocked` too; (2) the KO Trade (`fx-0075`), which has an Exit saved at an earlier Review and is still open, becomes "Exit not carried out" (from Evidence limited) and moves to the front of the walk; its attention reason changes from "Mark missing for KO on <date>" (`code: Unavailable`, `reason: MarkMissing`, `instrument`, `date`) to `code: ExitNotCarriedOut`. Nothing else differs; `dump.json` and backups untouched.

**Options.** (a) Widen decision 127 to the six fixtures and KO's band and reason (an amendment note within revision 116). (b) Something narrower; none is sound, since KO is an Exit not carried out under the new rules.

**Answer (2026-11-22):** (a), plus a standing direction: anywhere the Review redesign requires updating a snapshot, as long as the numbers and computations haven't changed, the update is authorized. Recorded as an amendment to decision 127 within revision 116 (tag moved). **Status:** answered 2026-11-22; T95.3-D1 resumes.

**Previous status:** asked. Paused: T95.3-D1 and T95.3's suite run, and the tasks blocked by T95.3.

## Q3 (T95.4): how the day summary counts "sessions left" before an expiration — asked 2026-11-22

**Plain words.** T95.4's case 8 lists each contract's expiration "with the sessions left" (W-row: "DALE, CORV, BREN expire Fri Nov 20: 4 sessions left."). Counting future trading sessions needs the session calendar, and Daily Review is deliberately kept away from it (decision 62); Market Data's read session gives only the next and previous session, and the breakdown keeps Market Data unchanged. No figure exists today that counts sessions to expiration (`daysToExpiration` counts calendar days).

**Options.**
- (a) Add one calendar-only call to Market Data's read session, `sessionDatesBetween(from, to)`, built on the existing session policy; no store read, so no request-count pin moves. Needs a sentence in `specs/design/market-data.md` and a plan revision (precedent: `nextSessionDate`, revision 92).
- (b) Give Daily Review the session policy directly. Reverses decision 62.
- (c) Drop the count: list the expiration dates only ("expire Fri Nov 20").

**Recommendation:** (a).

**Main-session readings recorded with this question (not asked):** case 6's "sessions since the crossing" counts the current run past the line, inclusive of the Review Date, as the mockup's "(6 sessions)" does (A318's `first` governs only where the Replay opens). Case 8 lists each contract, as the breakdown says, grouped by date as in the mockup's words.

**Answer (2026-11-22):** (a). Recorded as decision 128, plan revision 117, the breakdown's P175. **Status:** answered 2026-11-22; T95.4 resumes after T95.6-B2.

**Previous status:** asked. Parked: T95.4 (and the tasks that need it, starting with T95.10).

## Q4 (T95.7-B1): two Price History specs whose Tuesday gap can no longer exist as built — asked 2026-11-22

**Plain words.** `e2e/d8p/history.spec.ts:17` and `:151` check how a session with no Marks shows (a gap: "—" in the Marks row, "No Mark" images, "Tue Oct 13 without Marks", "1 session without Marks"). Their setup (`buildOc3`) saves a Hold at Wed 08:00, which is the Review of Tuesday. Since T95.7 (A304), that Hold is refused until Tuesday's Marks are saved or acknowledged Unavailable, so as built Tuesday cannot stay a gap. T95.7-B1 (partial, `0a14caae`) acknowledges Tuesday's Marks in `buildOc3`, which fixes 15 of the 17 specs, but these two then read "Acknowledged Unavailable" where they expect "—", and "Tue Oct 13" where they expect "Tue Oct 13 without Marks".

**Options.**
- (a) Update the two specs to the acknowledged reading (as integration test I8P.1 changed in T95.7). They would then no longer test the gap display.
- (b) Keep Tuesday a true gap for these two specs: give them a setup without a Review of Tuesday (no Hold saved for Tuesday; the next Review is Wednesday's), so the gap display stays tested; their other expectations change only where that Hold appeared.

**Recommendation:** (b) — a session with no Review and no Marks is still a real state the app must show; (a) would leave the gap display untested in the browser.

**Answer (2026-11-22):** (b). A test-setup choice within T95.7-B1 (no plan revision). **Status:** answered 2026-11-22; T95.7-B1 resumes.

**Previous status:** asked. Parked: T95.7-B1's two specs (T95.7's run waits on them).

## Q5 (T95.10): the day card after a save — asked 2026-11-22

**Plain words.** The day summary (`day`, T95.4) comes only with `open`. A Save Marks, an Action save or an answered reflection returns the refreshed Review without it, so the day card (counts to go, the one "next" button, the steps done, "Day so far") would go stale after every save. The spec says the screen continues from each save's response without calling `open` again (and the request-count pins hold that). Nothing later in the breakdown fills the gap, though T95.14, T95.21 and I95.2 assume it.

**Options.**
- (a) A small coordinator follow-on before T95.10 (T95.4-D1): every save result carries `day`, built in the same pass as the refreshed Review (no new store read; the finished-day lists, which need each crossed Trade's replay, come with the save that finishes the day, or through `open` only then). In the same task, `day` gains what T95.10's words need and it lacks: each Trade's count of Marks to go ("To do: 2 Marks, Action") and whether an owed reflection is a Close Review. Plan revision r118.
- (b) The screen calls `open` again after each save and takes only `day` from it. Quick, but it breaks the spec sentence and the request-count pins; needs a spec amendment.
- (c) Refresh only when the day finishes; counts stale in between. Not recommended.

**Added the same evening (T95.11 found the same kind of gap):** T95.11's labels need two figures the coordinator holds but doesn't return: the session before's zone, for "Marks needed" beside "Past Stop Fri" (it has `before.evaluation`, but `meter.previous` carries only date, P&L and direction), and whether a contract expires on the Review Date, for "Expires today · Marks needed". Under (a), T95.4-D1 also returns these two (fields only; no figure or computation changes; any snapshot that gains a field is updated under decision 127 as amended). Parked with T95.10: T95.11.

**Recommendation:** (a).

**Main-session readings recorded with this question (not asked):** the "Review status" block also holds the completion word, the Unavailable Marks disclosure, the integrity-disagreement and incoherent-facts lines, and the unsaved-Marks notice; T95.10 removes only the Blockers list and the block's heading and keeps those lines in the day card (the unsaved-Marks notice stays until T95.14). Case 4's "focus the Marks step" focuses the existing Marks section until T95.12 builds the grid. Case 10 is checked in the browser at 375 wide, not in jsdom.

**Answer (2026-11-22):** (a). Recorded as decision 129, plan revision 118, the breakdown's P176; follow-on T95.4-D1 before T95.10. **Status:** answered 2026-11-22; T95.10 and T95.11 resume after T95.4-D1.

**Previous status:** asked. Parked: T95.10 and the screen tasks after it.

## Q6 (T95.13): "Worth nothing?" on the day an option expires — asked 2026-11-23

**Plain words.** The slip check asks "Worth nothing?" for any $0.00 option Mark (T95.13 case 4). On the day a contract expires, the grid already tells you "Expired worth nothing: enter 0." (W111), so entering 0 as told then asks "Worth nothing?" straight after. The mockup skips the question on the expiration day; the spec and the plan are silent. As built, the question is asked (case 4 as planned).

**Options.**
- (a) Skip "Worth nothing?" for a $0.00 Mark on the contract's expiration day (the Review Date the card says it expires, from the returned `expiresOnReviewDate`); a small follow-on, T95.13-D1.
- (b) Keep asking it every time, as built.

**Recommendation:** (a): the screen has just asked for 0, so asking again is noise, and the mockup agrees.

**Status:** asked. Parks nothing (T95.13 continues; the follow-on would come after).
