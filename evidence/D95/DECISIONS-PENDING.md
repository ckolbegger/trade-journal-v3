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

**Answer (2026-11-23):** (a). Follow-on T95.13-D1. **Status:** answered.

## Q7 (T95.14 case 8): "keep the Price History link on the folded line" — asked 2026-11-23

**Plain words.** Each Trade's card links to its Price History from inside its Replay (unchanged by the redesign). Case 8 and removal row X14 say "the link stays, on the folded Marks line". But the Marks are now one grid for the whole page, and its folded line ("Marks for Mon Nov 16 · 7 of 7 saved · 1 no price · Edit") belongs to no single Trade, so a link there has no Trade or Instrument to open. Neither the mockup's folded line nor the old Marks panel had one. The wording looks left over from when each card had its own Marks panel.

**Options.**
- (a) Read case 8 as "the card's Price History link stays" (it does, in each card's Replay) and add no link to the folded line; record the case as met by that, with a test.
- (b) Put a Price History link on each Instrument's row of the grid (when open), to that Instrument's Trade; an Instrument held by two Trades would need two links or a choice.
- (c) Something else you have in mind for the folded line.

**Recommendation:** (a): it keeps the folded line short, matches the mockup, and every Trade keeps its link.

**Answer (2026-11-23):** (a). Follow-on T95.14-D1: a test that each card keeps its Price History link (in its Replay) once the Marks are saved and folded; no link on the folded line. **Status:** answered.

## Other answers recorded 2026-11-23 (asked one at a time; not pending decisions)

- Labels for a Blocker and an Exit not carried out (T95.11 ocr, `review-attention.ts:25`): **leave unlabelled.** No bug task.
- The "Unsaved" tag on a typed, unsaved Review Date cell (gone since T95.12): **bring it back.** Follow-on T95.12-D1.
- The refusal wording when "Add the skipped sessions" is pressed during a Correct: **keep** "Save or cancel the correction to choose another cell."
- ocr reviews always use gpt-6.1-sol (`--provider chatgpt --model gpt-6.1-sol`); the agent checks ChatGPT with `.claude/scripts/ocr-usage-wait.sh`, not `ocr llm test`.
- The ChatGPT check loop is not restarted unless the user says so; the user said usage had reset at 2026-11-23 ~05:10 EST.

## Q8 (T95.16): the open card has no Thesis or "No longer valid if" to show — asked 2026-11-23

**Plain words.** T95.16's case 3 (W93, U7) puts the Plan's Thesis and "No longer valid if" in the card's Plan box. The Review's data for a card (`DailyTradeReview`, `src/coordinators/daily-review/types.ts`) doesn't carry either; only Trade Detail reads them (`PlannedTradeDetail.plan`). No D9.5 task adds them, and the UI may not fetch or work them out itself (ADR 0001). The task stopped before writing code.

**Options.**
- (a) A follow-on T95.16-D1 before T95.16: add `plan: { thesis, invalidation }` to `DailyTradeReview`, built in the Daily Review's `getTrade` from the Trade Analysis record it already reads (no new store read; the request-count checks hold). Cases: the field is there, it equals Trade Detail's, no read is added. T95.16 then shows it. Precedent: T95.4-D1 (decision 129) added `day` the same way.
- (b) Drop Thesis and "No longer valid if" from the Plan box (changes W93 and U7).

**Recommendation:** (a).

**Parked meanwhile:** T95.16 and the tasks that wait on it (T95.17, T95.18, T95.19, T95.20, T95.25). T95.21, T95.22, T95.23 and T95.24 carry on.

**Answer (2026-11-23):** (a). Recorded as decision 130, plan revision 120 (P177); follow-on T95.16-D1 before T95.16. **Status:** answered.


## Q9 — T95.16 case 1: Trade P&L in R and the day's change in the collapsed header (2026-11-23)

T95.16 stopped before writing. The collapsed card header (U3, breakdown line 85) shows Trade P&L in dollars and R with the day's change, but `WalkedTrade` carries only dollars (`figures.pnl`); R and each Trade's change since the session before are on no field, and the UI may not divide or subtract (ADR 0001). **Recommendation (a):** follow-on T95.16-D2 before T95.16 adds `pnl: { dollars, planR, change }` to `WalkedTrade`, built in `open` from the evaluation it already reads (`currentMarkedPnlInPlanR`; now and session-before P&L, as the day total already does); no new store read. Cases: each walked Trade carries P&L in dollars and R; its change since the session before; both Unavailable as the evaluation's are; request counts hold. **(b):** drop R and the change from the header (changes U3 and case 1). **Parked:** T95.16, T95.17, T95.18, T95.19, T95.20, T95.25. **Status:** asked.

**Answer (2026-11-23):** (a), plus standing approval for prototype data (listed in `data-additions.md`). Decision 131, plan revision 121 (P178); follow-on T95.16-D2 before T95.16. **Status:** answered.


## Q10 (T95.56): the strip on a closed or reflection-only card needs that card's replay, an added read — asked 2026-11-26

**Plain words.** T95.56 puts a Replay strip (a small Trade P&L chart, one line of words, the Replay button) on every card. Cases 6 and 7 put it on a closed Trade's card ("with the sessions and the low", W146) and on a card that owes only a reflection. Those cards are built by `assembleOwedCard` (`daily-review.ts` ~841), which reads the stored summary, the analysis, the Debts and the frames but never the Trade's Marks, so it has no replay. Only walked cards (`assembleTrade`) assemble one. Decision 131's standing approval covers fields built from data already read, not a new read. No task names a source; A318, W146 and T95.59 case 1 (the walk opens the Replay from the closed card) all assume one. The task stopped before writing code.

**Options.**
- (1) The owed card reads its replay: `assembleReplay` with `withJournal: false` from the read session it already holds (and its saved Actions, for T95.57 and T95.59). Cost: one replay read per owed card, the same read an open card makes; the owed card's request-count pins change by that read, recorded. Recorded as a decision like 133.
- (2) The strip on an owed card has words only, no chart and no Replay button (cases 5 and 6 not met; the walk in T95.59 would have no Replay to open).
- (3) T95.56 builds the strip on walked cards only; cases 6 and 7 move to a later task once a read is approved.

**Recommendation:** (1). The walk (T95.59) needs this replay anyway, and the read is the one an open card already makes.

**Parked meanwhile:** T95.56. T95.57 and T95.58 carry on; T95.59 waits on this answer if it needs the owed card's replay.

**Answer (2026-11-26):** (1), "Please load the replay". Decision 136, plan revision 125; T95.56 gains cases 9 and 10. **Status:** answered; T95.56 resumes, then T95.59.

## Q11 (T95.57): the Key moments drop-down lists moments after the slider's session — asked 2026-11-26 (queued earlier, asked after Q10)

**Plain words.** T95.57 case 6 lists the key moments in a drop-down (W148, as the mockup draws it). The list shows every moment with its date, including ones after the session the slider is on (e.g. "4. High · Fri Nov 13" while on Thu Nov 12). D9's reveal rule (A276) says the Replay shows nothing of a later session. To keep `e2e/d9/replay.spec.ts` passing, T95.57 narrowed its "nothing of a later session" check to ignore the drop-down (committed in `26626d39`).

**Options.**
- (1) Keep the full list (built). The reveal rule gains one exception: the key moments' names and dates. T95.59's walk counts every moment and lets the trader jump to any.
- (2) List only the moments up to the slider's session; the old check returns unchanged. Choosing a later moment is then not possible from the list; "Next moment" in T95.59 would step forward instead.

**Recommendation:** (1): the walk is for a closed Trade, where the whole path is known, and the list names only dates and kinds, no figures.

**Blocks:** nothing now (built as option 1); T95.59 follows whichever is chosen.

**Answer (2026-11-26):** (1), "Keep the full list". Decision 137, plan revision 126. **Status:** answered.

## Q12 (asked 2026-11-26): which Review operation names the expired contract's standing?

From ocr of T95.62 (Doubtful, `capabilities.ts:105`). The plan's T95.62 bullet puts the `ExpirationStanding` variant under `DailyReview.open`, but the expired contract's standing is built only on the Trade's card that `getTrade` returns; `open` reads no replay. T95.62 named it under `getTrade`.
1. *Recommend:* keep it under `getTrade` and correct the plan's wording (a slip in the list; the manifest then says what each operation returns). No read added.
2. Give `open` the standing too: one replay read per Settlement Due Trade when the Review opens, then name it under `open`.
Not parked: T95.62 is built as option 1, which needs no approval; option 2 would be a follow-on.
