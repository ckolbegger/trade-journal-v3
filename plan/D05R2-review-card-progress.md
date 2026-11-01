# D5R2 — Review card progress: task breakdown

Status: **agreed by the user, 2026-11-01 (P42–P54, A164–A176); part of the frozen plan from revision 28 (decision 69).** The design was agreed with the user on 2026-11-01 while exploring candidate 1 of the architecture review (questions Q1 to Q15). This breakdown records those answers as P42–P48 and A164–A170. P49 was raised while drafting and agreed with the user on 2026-11-01: option (a). The same day, the user added candidate 2 of the review, one module for the Review the screen holds, on the answers to Q16–Q19 (P50, P51, A171–A173). The user then added candidate 5, returning storage knowledge to Market Data and Journal (P52–P54, A174–A176). Plan revision 28 adds this deliverable, and plan decision 69 records it, together with the additive glossary rule (section 1.3, P48).

D5R2 is a refactor in three parts: card progress and the due rule (candidates 1 and 3), the held Review (candidate 2), and bindings staged by the modules that own them (candidate 5). Candidate 5 also fixes a defect: Trade Workflows commits Journal's counter without binding it (P52). A trader sees one change: a Reflections panel with nothing left owed reads "None", where today it reads "Resolved" until the Review is reloaded (P46). The goal is that D6 is only about new behaviour. D6's owed-reflection cards (P20, A90) and its Close Review due status (A86) then build on one progress record and one due rule, instead of adding a fourth copy of each.

It builds on D5R's cards and panels (A150–A152, A157), D5's due classification (P16, A63, A69, A75), and decision 56, which says there is no due status without a frame ([D5R](D05R-review-redesign.md), [D5](D05-deferred-reflection-and-journal-debt.md) breakdowns).

---

## 1. Stories and decisions

### 1.1 Stories

D5R2 adds no trader story. It has four developer stories:

1. As the developer of D6 and later deliverables, I would like **a card's progress to come from the Daily Review coordinator**: what each panel still owes, and whether the card is done. Then a new card kind (D6's `ReflectionsOwed`) or a new panel (D7's Settlement Due) changes one module, and the screen renders what it is given.
2. As the developer, I would like **one due rule**: whether an Outstanding reflection is due now, in the next Review, or in the Review after next. Today it is written out three times, in two coordinators. With one rule, D6's Close Review and every later Debt are classified the same way everywhere.
3. As the developer, I would like **every result folded into the screen's Review in one pure module**: `open`, an Action save, a Debt resolution, Save Marks, and a per-row Mark save. Then D6's new results are added once, the Mark standing is patched in one place, and that logic is tested with plain tables instead of a mounted Review.
4. As the developer, I would like **each module to stage its own bindings**. Journal binds the counter it advances, and Market Data binds the evidence a frame was read from. Then no coordinator reads another module's stores or copies its counter rule, and every commit that advances Journal's counter binds it (ADR 0011).

### 1.2 What changes and what stays

| Today (D5R) | After D5R2 |
|---|---|
| The screen works out each card's progress. `remainingOf` reads the Review's completion reasons, `isOwing` decides Done, `marksOf` and `panelHeaders` count rows and owed reflections, and `remainsText` builds the header line from those counts. | `open`'s walked items, `getTrade`, and every save result carry a **card progress** record (P42, A164). The screen turns it into words and decides nothing. |
| `WalkedTrade.reflections` (`ReflectionCounts`) carries due and later counts. Nothing on the screen reads it; the bench generator and one coordinator case do. | Removed. The same counts are in the Reflections panel's progress (A167). |
| A reflection answered or declined in the card is counted out by a second set of resolved Debts kept in `CardBody`. The panel then reads "Resolved" until the Review is reloaded. | The Debt resolution's result carries the card's new progress. A panel with nothing owed reads "None", as it does after a reload (P46). |
| Three due classifications: `daily-review.ts` around line 305 (two-way, for the completion reasons), `daily-review.ts` around line 403 (three-way, for the reflections), and `trade-views.ts` `withDueStatus` (three-way, with no status without a frame). | One domain module, `src/domain/journal-debt/`, with `classifyDue` (P44, A166). Both coordinators call it. |
| Journal declares `dueRule: 'OneSessionGrace'` as a literal type in four places. | The `DueRule` type moves into the domain module and Journal imports it. Stored records are byte-identical (A166). |
| `DUE_TEXT` lives in `ReviewReflections.tsx`, and `OwedDebtItem.tsx` imports it from there. | One formatter, `src/ui/due-text.ts`, beside `figures.ts`, words the classification for the Review and for Trade Detail (P45). |
| `ReviewView` folds each kind of result into its state with its own handler: `saved`, `reflectionResolved`, `marksSaved` with `withSavedMarks`, and the `open` reads in `refreshTrade`. `saved` also picks the card to open next. | One pure module, `src/ui/screens/held-review.ts`, takes the Review the screen holds and any result, and returns the next Review and the card to open next (P50, A171). `ReviewView` keeps the effects: requests, the guards that drop late results, scrolling, focus and `flushSync` (A173). |
| Journal's `applyPreparedEffects` writes its counter as the value read plus one, but binds it only in Journal's own `save`. Daily Review adds the `journal@` check itself, twice (the Action save and the Debt resolution). Trade Workflows (`recordPositionChange`, Plan confirmation) adds none, so a Journal write landing between its prepare and its commit loses one counter advance. | `applyPreparedEffects` stages the counter check itself. Trade Workflows retries a counter-only conflict, as ADR 0011 requires, and Daily Review drops its copies (P52, P53, A174, A175). |
| Daily Review's `checkBinding` reads the `observations` store directly, with its own key range, and repeats Market Data's private choice of the Stale-context Mark. | The Review frames carry an opaque evidence binding, and Market Data stages its checks in the caller's transaction (P54, A176). No coordinator reads a Market Data store. |
| `CardMarks` keeps its own copy of each key's resolution and revision (`standings`), patched from its saves and conflicts, beside the Review's copy patched by `withSavedMarks`. | One copy, in the held Review. A per-row save and a Save Marks conflict are folded in like any other result, and a key's revision never moves backward (P51, A172). |

**Preserved unchanged:**
- **Behaviour on the screen:** what a result does to the cards (re-sorting, the next card, the held card, the Marks a save leaves) is unchanged; only where it is computed moves.
- **Visible text:** every visible string except P46's.
- **Browser cases:** all 179 cases, and every file under `e2e/`, are unchanged (P47).
- **Contract:** no operation, route, store, index, or schema change. `verify:capabilities` stays at 19 operations and schema version 4 (A168).
- **Storage requests:** no new storage request. T5R.13's query counts are unchanged (A168).

### 1.3 Decisions for this breakdown

Numbering continues from D5R's P36–P41. All were agreed with the user on 2026-11-01.

| # | Question | Decision | Alternatives and tradeoff |
|---|---|---|---|
| P42 | **Where is a card's progress computed?** The spec already gives progress to the coordinator: Daily Review "derives eligibility and progress" (Daily Review, "Contract"). `open` returns "progress, and next step" (`open` sequence), and an accepted save returns "the revised progress/completion result" (`save`). D5R left the per-card counts to the screen. | **The Daily Review coordinator computes it (Q2), as data only (Q3).** The record holds counts and flags, never words. The UI keeps every string. | (a) Keep it in the UI and add a shared helper: no locality, because D6's second card kind would branch in the helper and in each panel. (b) Return words from the coordinator: puts presentation in an application module, against "UI layout does not shape these interfaces" (Trade Views, "Invariants"). |
| P43 | **When, and under what name?** | **A deliverable of its own, before D6 (Q1), named D5R2 (Q14),** tagged `claude-opus-5.5-d5r2`. D5R's tag does not move. | Fold it into D6: D6 would mix a refactor with new behaviour, and its critic would judge both at once. |
| P44 | **Where does the due rule live?** Due classification is used by Daily Review and by Trade Views. Journal stores the rule's name, and D5 A63 says the coordinators classify, so that Journal never needs a session date. | **A domain module, `src/domain/journal-debt/` (Q10 C), with `classifyDue` and decision 56's no-status-without-a-frame rule.** All three sites call it, Trade Detail included, with visible text unchanged (Q5 a). Journal's `OneSessionGrace` type moves there and Journal imports it (Q10 b). The move is type-only. D6 adds the owed-group order to the same module. | (a) Put it in `src/coordinators/` beside `valuation.ts`: it would be shared, but a rule two modules depend on, that holds no I/O, is domain. (b) Put it in Journal: Journal would then need session closes, against A63. |
| P45 | **Who words the classification?** | **One UI formatter beside `figures.ts` (Q11),** used by the Review's reflection groups and by Trade Detail's owed Debt. | Leave `DUE_TEXT` in `ReviewReflections.tsx`: Trade Detail keeps importing a Review screen file for a string table. |
| P46 | **"Resolved" in the Reflections panel.** Today a panel whose reflections were all answered in this view reads "Resolved"; after a reload, the same panel reads "None". The second wording exists only because the screen counts resolutions itself. | **Drop "Resolved" (Q7 c).** A panel with nothing owed reads "None" (summary "None owed"), as after a reload. This is the deliverable's one sanctioned visible change (Q13). Its one unit expectation, in `ReviewCard.test.tsx` (the D5R T5R.16-B4 case), changes from "Resolved" to "None". | (a) Carry a "resolved in this view" count in the progress record: puts view history in a read result. (b) Keep the UI's set alongside the record: keeps the second count P42 removes. |
| P47 | **What happens to the tests?** About ten mounted unit cases in `ReviewCards.test.tsx` and `ReviewCard.test.tsx` check the screen's counting. | **The counting moves into plain-data coordinator and domain cases, keeping each expected value, plus one rendering case per panel and one for the collapsed header (Q4).** Mounted cases about opening, focus, moving on, holding, and links stay mounted, fed progress by the facade double. **The same rule covers the held Review (Q18):** the mounted cases that check how a result is folded into it move to plain table cases of `held-review.ts` with the same expected values, the timing and focus cases stay mounted, and no browser case changes (section 6.1). The browser cases are unchanged: all 179 stay, and `git diff claude-opus-5.5-d5r -- e2e` is empty. | Keep every mounted case as it is and add the coordinator cases: the same expected values in two places, which is why the count drifted in D5R (T5R.16-B4). |
| P48 | **The gate, and the glossary.** | **The full gate (Q9 a):** a cumulative suite run after each task, an ocr review of each commit, the migration diff checks, and a fresh critic with a lighter brief on C5R.2, C5R.3, C5R.4 and C5R.9, plus C5R.1 and C5R.8 for the held card and the choice of the next card (Q19; section 7). **The glossary:** this branch may add domain terms to `specs/glossary.md`, but may not change or remove an existing entry. Each new entry cites the decision that added it. Card progress is not a domain term, so it is defined here and refers to the spec's "progress". "Due Classification" is a domain term and is added (decision 69). | Keep new terms in the plan only: the glossary drifts from the code's names, and the frozen spec on `main` can no longer be compared against this branch to show what was added. |
| P49 | **The "earlier optional" count after a save.** Raised while drafting this breakdown. Q15 put three counts in the Marks progress: done, needed, and earlier optional. But every save's assembly skips the historical-gap scan (D5R P38, A155: Review-date frames only, `withGaps = false`), and T5R.13 proves it makes no gap-scan request. After a save, the coordinator therefore doesn't know the card's earlier sessions. Today the screen patches its copy of the gap list from the saved keys (`withSavedMarks`) and counts that list. | **Agreed with the user, 2026-11-01: (a) leave earlier optional out of the record.** Earlier sessions never block (AC-MARK-004) and are not part of done, so they are not progress. The Marks panel's "n earlier optional" stays the length of the earlier rows it lists, which the screen already holds and patches. The record keeps done and needed. | (b) Run the gap scan for the changed cards after each save: the count is exact everywhere, but it adds storage requests to every save, against A168 and T5R.13. (c) Carry the pre-save gap counts in the opaque `ReviewBinding` and subtract the saved keys: no new request, but it puts display state in a change-detection token. |
| P50 | **Candidate 2: one module for the Review the screen holds (Q16 b).** Each result kind is folded into `ReviewView`'s state by its own handler, and A165's newest progress per card would add a fourth concern to three of them. D6 adds a Close Review result and the owed group to every path. | **Agreed with the user, 2026-11-01: add it to D5R2, before the UI task that words the progress (T5R2.18).** The module folds every result into the held Review and also picks the card to open next after an Action save: the first card holding a Missing Mark, the next step's Trade, or none. The guards that drop a late or out-of-order result stay in the view, because they depend on request timing, not on the data. `linkedCard` and `holderOf` stay where they are. | (a) Fold results only, and leave the choice of the next card in the view: smaller, but the choice is pure logic and stays untested without a mount. (c) Move the guards in too: they are counters of requests in flight, so the module would no longer be pure. |
| P51 | **`CardMarks`' copy of the Mark standings (Q17).** `CardMarks.tsx` keeps `standings`, which it patches from its own saves and conflicts. `ReviewView.withSavedMarks` patches the Review's copy. The report flagged these two copies. | **Agreed with the user, 2026-11-01: remove `CardMarks`' copy as part of candidate 2.** The held Review is the only copy. A per-row Correct or Withdraw, and a Save Marks `Conflict`'s moved keys, are folded into it like a save. `CardMarks` reads each row's standing from the rows it is given. | Leave it for later: D10's multi-leg rows would then extend both copies. |
| P52 | **Candidate 5: bindings staged by their owners, in D5R2.** ADR 0011: "Every write that advances a shared counter binds that counter. A commit with no checks that writes a counter read before the transaction is a defect." Journal's `applyPreparedEffects` writes `journalRevision` as the value read plus one (`journal.ts`, around line 871) but leaves the check to its caller. Daily Review adds it; Trade Workflows does not (`record-position-change.ts` around line 263, `trade-workflows.ts` around line 118). Separately, Daily Review's `checkBinding` reads Market Data's `observations` store and repeats its Stale-context choice. | **Agreed with the user, 2026-11-01: both halves in D5R2, not D6.** D6 adds two commits on these paths, the exit through `recordPositionChange` and the Close Review resolution through Daily Review, and both build on the corrected pattern. The Market Data half shares `daily-review.ts` with D5R2's coordinator tasks. Keeping it out of D6 keeps D6 to new behaviour (Q1). | (a) In D6: the counter fix sits on D6's paths, but the Market Data half has nothing to do with D6, and D6's critic would judge new behaviour over invisible save-path changes. (b) Only the counter fix now: leaves the coupling D6 extends. |
| P53 | **Who retries a counter-only conflict?** ADR 0011: "the owning module re-reads, re-validates the command against the fresh state, and commits again, up to 3 attempts in all", and "Retries are bounded and local to the owning module". With prepared effects, the command belongs to the coordinator that prepares and commits it. | **The coordinator that owns the command retries.** Journal stages the counter check and names it, as `journal@<revision>`. Trade Workflows' `recordPositionChange` and Plan confirmation retry when the commit fails on that binding alone, repeating the whole read, validation, preparation and commit, up to 3 attempts in all. Then they return their typed `Conflict` and write nothing. Daily Review already retries its saves this way and keeps doing so. A conflict on any other binding is returned at once, as today. | (a) Journal retries: it cannot, because the Trade facts in the same commit belong to the coordinator. (b) A shared retry helper: ADR 0011 rejects a general retry utility. |
| P54 | **How Market Data hands over the evidence binding.** `checkBinding` reads each Review-date record and its Stale-context source in a snapshot of its own, before the frames, so that a Mark saved in between fails the commit's recheck. | **The Review frames carry the binding they were read under.** `ResolveFrames` already reads, in its one read transaction, every Review-date record and each Stale-context source it selects (A45's digest covers them). Its result gains an opaque `evidenceBinding`. A new internal seam, `MarketData.bindEvidence(tx, evidenceBinding)`, stages one check per bound key in the caller's transaction, as `applyPreparedEffects` does (D5R P37). Because the frames and the binding come from one read, the ordering comment becomes unnecessary. | (a) A separate `prepareEvidenceBinding` read: one more request, and the frames and the binding could disagree. (b) Leave the store read in Daily Review and export `staleContextOf`: still couples Daily Review to the store layout. |

### 1.4 Working assumptions

Numbering continues from D5R's A150–A163.

| # | Assumption |
|---|---|
| A164 | **The progress record (Q6, Q15, P49 a).** In `src/coordinators/daily-review/types.ts`, re-exported through `src/app/types.ts`:<br>`CardProgress = { kind: 'Walked'; panels: readonly PanelProgress[]; done: boolean }`<br>`PanelProgress` is one of:<br>• `{ panel: 'Marks'; done: boolean; resolved: number; needed: number }`<br>• `{ panel: 'Reflections'; done: boolean; dueNow: number; later: number }`<br>• `{ panel: 'Action'; done: boolean; owed: boolean }`<br>`panels` lists the card's panels in work order (D5R P36). A `Walked` card has all three. `kind` has only `'Walked'` for now; D6 adds `'ReflectionsOwed'` with the Reflections panel alone (section 9).<br>**Marks:** `resolved` and `needed` count the card's Review-date rows: a row naming the Trade with an exact Mark or an acknowledgment is resolved, and a Missing one is needed. A shared Instrument counts on every card that holds it. The panel is done when `needed` is 0.<br>**Reflections:** `dueNow` and `later` count the Trade's Outstanding reflections by `classifyDue`: `Due` is due now, and the other two are later. The panel is done when `dueNow` is 0.<br>**Action:** `owed` is true while the Trade has no saved Action for the Review Date. The panel is done when it is false.<br>**The card** is done when every panel is done. This is A150's rule, unchanged.<br>The count "Marks done" in Q15 is named `resolved`, so it does not collide with the panel's `done` flag. ReviewProgress (`tradesWithAction`, `tradesEligible`) keeps its name and meaning. |
| A165 | **Where it is carried (Q8, Q12).** One `CardProgress` type, in four places:<br>• `progress` on each `WalkedTrade` that `open` returns;<br>• `progress` on `DailyTradeReview` (`getTrade`, and the next step's Trade in every save result);<br>• on each walked Trade in `PostMarksReview.trades`, which covers every card holding a saved Instrument;<br>• a new `cards: readonly { tradeId: string; progress: CardProgress }[]` on `PostSaveReview`. It holds the saved Trade after `SaveTradeAction`, and the Debt's Trade after `ResolveReviewDebt` when that Trade is walked.<br>A `ChangedDuringAssembly` review carries none, as today. The screen shows, for each card, the newest progress it holds for that Trade. |
| A166 | **The domain module (P44).** `src/domain/journal-debt/index.ts` exports:<br>• `type DueRule = 'OneSessionGrace'`;<br>• `type DueClassification = 'Due' \| 'DueInNextReview' \| 'DueInReviewAfterNext'`;<br>• `classifyDue(dueAnchor: Instant, closes: SessionCloses): DueClassification`, with `SessionCloses = { previousClose: Instant; close: Instant }`, and an overload that takes `SessionCloses \| undefined` and returns `DueClassification \| undefined`.<br>The rule is A63's: `Due` when the anchor is at or before `previousClose`, `DueInNextReview` when it is at or before `close`, otherwise `DueInReviewAfterNext`. Both comparisons are inclusive. Without closes there is no classification (decision 56).<br>It imports only `src/domain` and `temporal-polyfill`, as `src/domain/trade-analysis` does.<br>`ReflectionClassification` (Daily Review) and `DebtDueStatus` (Trade Views) are removed. Their fields, `classification` and `dueStatus`, keep their names and take `DueClassification`.<br>Journal's four `dueRule: 'OneSessionGrace'` declarations (`journal.ts`, `effects.ts`) become `dueRule: DueRule`. The stored value, the fixtures, and the backup format are unchanged. |
| A167 | **Removed from the UI:**<br>• `remainingOf`, `isOwing` and the `Remaining` type;<br>• `marksOf`'s counting (it still selects the rows a card lists);<br>• `panelHeaders`' counting and `remainsText`'s derivation (both now word the record);<br>• `CardBody`'s `resolvedDebts` set and the `onDebtResolved` prop it feeds. `ReviewReflections` keeps its own record of which rows it shows resolved, because that is rendering, not counting.<br>`WalkedTrade.reflections` and `ReflectionCounts` are removed from the coordinator. The bench generator (`src/app/bench-generator.ts`, two reads) and the D5 coordinator case in `resolve-debt.test.ts` read the Reflections panel's `dueNow` instead. Their expected values are unchanged. The generator produces the same dataset, so its version is not bumped and the cached dataset stays valid. |
| A168 | **No contract or storage change.** (Candidate 5 adds one internal Market Data seam, A176; it is not a facade operation.) The progress is computed from data `open`, `getTrade` and the save assemblies already read: Mark rows, completion reasons, Outstanding Debt, and saved Actions. No request is added. T5R.13's query-count case passes unchanged. No operation is added, so the Installed Capability Manifest is unchanged and `verify:capabilities` reports 19 operations. No store, index, or schema version changes, so no migration, fixture freeze, or capacity basis change is needed. |
| A169 | **The collapsed header and panel headers keep D5R's words.** From the record:<br>• the header reads "2 Marks · 1 reflection due · Action" (Marks `needed`, Reflections `dueNow`, Action `owed`), or "Done · Action saved" when the card is done;<br>• the Marks panel reads "`resolved` of `resolved + needed` for Mon Oct 12", or "No Marks for Mon Oct 12" when both are 0, with status "n needed", "Saved", "Optional" or "None" as today;<br>• the Reflections panel reads "`dueNow + later` owed, `dueNow` due now", or "None owed", with status "n due", "Not due" or "None";<br>• the Action panel reads "Needed" while `owed`, otherwise "Saved" with the saved Action's name from the form.<br>The panel a card opens on is its first panel whose progress is not done, and the card that opens on load is the first one not done (A151, A152). |
| A171 | **The held-Review module (P50).** `src/ui/screens/held-review.ts` is pure: no React, no facade, no timers. The held state is `Held = { review: Ready; standings: Readonly<Record<string, Standing>> }`: the Review, and each key's resolution and revision learned from results since it was read (A172). It exports:<br>• `fold(held: Held, result: HeldResult): Held`, where `HeldResult` is one of `Opened` (an `open` result), `ActionSaved` and `DebtResolved` (their `PostSaveReview`), `MarksSaved` (the saved keys and the `PostMarksReview`), `MarkSaved` (one key's resolution and revision from a per-row `MarketData.save`), and `MarksConflict` (the moved keys of a Save Marks `Conflict`);<br>• `standing(held, key)`, a key's current resolution and revision (A172);<br>• `nextCard(held: Held, next: ReviewNextStep): NextCard`, which is a Mark card (the first card in the held order whose Trade is in the row, with the row's Instrument), the next step's Trade, Done, or a Mark no held card holds;<br>• `marksOf(held, tradeId)`, the rows a card lists, moved from `ReviewView.tsx`.<br>A `Ready` post-save Review replaces the completion and binding. `MarksSaved` also replaces the walked Trades (decision 64's re-sort). After T5R2.18, `ActionSaved` and `DebtResolved` replace the progress of each Trade in their `cards` (A165). A `ChangedDuringAssembly` Review changes only what its saved keys report. The words, such as the after-save messages, stay in the view. |
| A172 | **A key's standing (P51).** `MarksSaved`, `MarkSaved` and `MarksConflict` record each key's resolution and revision in `standings`. `MarksSaved` also patches the rows as `withSavedMarks` does today: a saved earlier session leaves its gap list, and an acknowledged one stays, listed as acknowledged. A gap group holds no exact Mark's resolution, so a saved earlier session's "$9.00" lives only in `standings`. **A key's revision never moves backward:** `standing(held, key)` returns the learned standing unless the Review lists the key at a revision at least as new. This is the comparison `CardMarks`' `standing` makes today, moved into the module. `CardMarks` keeps its list of the earlier sessions as the card opened, so a session filled meanwhile stays listed while the card is open. That list is rendering, not standing. |
| A173 | **What stays in `ReviewView`:** the requests (`open`, `getTrade`, `save`), the shared in-flight `open`, the opening counter that drops a result for an earlier opening, the held card's unsaved state (A156), the after-save messages, and the effects (`scrollIntoView`, focus, `flushSync`). Each handler becomes: send the request, `fold` the result, then act on `nextCard`. |
| A174 | **Journal binds its counter (P52).** `Journal.applyPreparedEffects(tx, prepared, mapping)` stages `tx.require` for `meta.journal` at the prepared snapshot's `journalRevision`, named `journal@<revision>`, beside the counter write it already stages. `Journal.save` stops adding its own `journalUnchanged` check, since the applied effect now carries it. Journal exports `isJournalCounterBinding(name: string): boolean`, so a coordinator can tell a counter-only conflict from a subject conflict without knowing the naming. |
| A175 | **Trade Workflows retries (P53).** `recordPositionChange` and Plan confirmation loop up to 3 attempts in all when `commit` returns `Conflict` on a binding for which `isJournalCounterBinding` is true. Each attempt repeats the reads, Trade Record's and Journal's preparation, and the commit; no prepared candidate is reused. On any other binding, or after the third attempt, they return `Conflict` as today. Daily Review's two `tx.require` copies of the counter check (the Action save and the Debt resolution) are removed. Its retry loops are unchanged. |
| A176 | **Market Data's evidence binding (P54).** The Review-context `ResolveFrames` result gains `evidenceBinding`, opaque to callers: for each requested Instrument, its Review-date key at the resolution revision read, or `None` when no record exists, and the Stale-context source key at its resolution revision when the frame selected one. `bindEvidence(tx, evidenceBinding)` stages one check per key, named `mark:<instrument>@<date>` as today. It is internal: absent from the facade, like `prepareEffects` (`verify:capabilities` still reports 19 operations). Daily Review's `checkBinding` takes the binding from the frames it already reads and drops its `observations` snapshot, so the Action save issues one read-only transaction fewer before its commit. No request is added. Tech debt item 1 (a Mark that newly becomes the Stale-context source between read and commit) is unchanged: the binding covers the same keys as today. |
| A170 | **Reading.** The drafting guide's full `specs/` reading was scoped, as decision 68's was. Read in full: `specs/glossary.md`, `specs/design/daily-review.md`, `specs/design/journal.md`, `specs/design/trade-views-and-reporting.md` and `specs/design/ui-contract.md` (924 lines). Every section D5R2 relies on is already tagged for D5 or core. The only spec-map change is the glossary's line ranges and character counts after the new entry (section 10). |

---

## 2. Implementation boundaries extended in D5R2

| Canonical boundary | Code location | D5R2 change |
|---|---|---|
| Domain | `src/domain/journal-debt/` (new) | `DueRule`, `DueClassification`, `classifyDue` (A166) |
| Journal | `src/modules/journal/` | imports `DueRule`; `applyPreparedEffects` binds the counter; `isJournalCounterBinding` (A174) |
| Market Data | `src/modules/market-data/` | Review frames carry `evidenceBinding`; `bindEvidence` (internal, A176) |
| Trade Workflows | `src/coordinators/trade-workflows/` | retries a counter-only conflict (A175) |
| Daily Review | `src/coordinators/daily-review/` | `CardProgress` on `open`, `getTrade` and `save` results (A164, A165); classifies through `classifyDue`; `WalkedTrade.reflections` removed; no counter copies and no `observations` reads (A175, A176) |
| Trade Views | `src/coordinators/trade-views/` | `withDueStatus` classifies through `classifyDue` |
| UI | `src/ui/` | `due-text.ts`; `screens/held-review.ts`, the held Review and the next card (A171–A173); cards and panels word the progress record and count nothing (A167, A169); `CardMarks` reads standings from the held Review (P51) |

---

## 3. Task graph

Kind: **B** = behavioral (TDD, red→green per case), **S** = structural (exact verification).

| Task | Title | Layer | Kind | Blocked by | Public seam under test |
|---|---|---|---|---|---|
| T5R2.1 | Domain: due classification | domain | B | — | `classifyDue` |
| T5R2.2 | Journal imports the due rule | module | S | T5R2.1 | `typecheck`, `lint:deps`, `verify:fixtures` |
| T5R2.3 | Daily Review and Trade Views classify through the domain module | application | S | T5R2.1 | existing D5 and D5R cases |
| T5R2.4 | Daily Review: card progress in `open` | application | B | T5R2.3 | `DailyReview.open` |
| T5R2.5 | Daily Review: card progress in `getTrade` and every save result | application | B | T5R2.4 | `DailyReview.getTrade`, `DailyReview.save` |
| T5R2.6 | UI: one due formatter | UI | S | T5R2.3 | existing Review and Trade Detail cases |
| T5R2.7 | UI: the held-Review module | UI | B | T5R2.6 | `fold`, `nextCard`, `marksOf` in `held-review.ts` |
| T5R2.8 | UI: `ReviewView` folds every result through the module | UI | S | T5R2.7 | existing `ReviewView`, `ReviewCards` and `ReviewCard` cases |
| T5R2.9 | UI: `CardMarks` reads standings from the held Review | UI | S | T5R2.8 | existing `CardMarks` and `ReviewView` cases |
| T5R2.10 | UI: cards and panels word the progress record | UI | B | T5R2.5, T5R2.9 | `held-review.ts`, `ReviewView`, `ReviewCard` |
| T5R2.11 | Journal: `applyPreparedEffects` binds its counter | module | B | — | `Journal.applyPreparedEffects`, `persistence.commit` |
| T5R2.12 | Trade Workflows: retry a counter-only conflict | application | B | T5R2.11 | `TradeWorkflows.recordPositionChange`, `confirmPlan` |
| T5R2.13 | Daily Review drops its counter copies | application | S | T5R2.11, T5R2.5 | existing Daily Review save cases |
| T5R2.14 | Market Data: Review frames carry an evidence binding | module | B | — | `MarketData.query` (`ResolveFrames`), `bindEvidence`, `persistence.commit` |
| T5R2.15 | Daily Review binds evidence through Market Data | application | S | T5R2.14, T5R2.13 | existing D4, D5 and D5R save cases |
| T5R2.16 | Query count and benchmark | test | S | T5R2.15 | `test:integration -- d5r/query-count`, `bench:run` |
| T5R2.17 | Node integration suite | test | S | T5R2.10, T5R2.15 | `test:integration` |
| T5R2.18 | Browser suite, unchanged | test | S | T5R2.10, T5R2.15 | `test:e2e`, the e2e diff check |
| T5R2.19 | Independent browser-critic gate | test | S | all | fresh critic report |

Three tracks can run in parallel: the coordinator (T5R2.1–T5R2.5), the UI (T5R2.6–T5R2.9), and the bindings (T5R2.11, T5R2.12 and T5R2.14). T5R2.10 joins the first two. T5R2.13 and T5R2.15 edit `daily-review.ts`, so they follow T5R2.5.

---

## 4. Behavioral tasks

Every case runs **red → green** individually. A case that passes on its first run, or fails for a syntax, configuration, fixture, or unrelated reason, is not valid red evidence; it must be fixed and rerun to a genuine red. Cases are ordered so that each one targets behavior the previous cases did not need.

**Fixture:** D5R's card fixture (`cardFixture` in `tests/support/review-fixture.ts`; D5R section 4): Review Monday 2026-10-12 at 17:00. With its Marks, XYZ, ABC and JKL are marked and DEF is Missing. XYZ has an earlier session without a Mark, Friday 2026-10-09, relevant to T-A only. D-1 (T-A's PC1) is due, and D-2 (T-A's PC2) falls due in the next Review. No Action is saved.

**Expected progress at the Monday Marks, before any save:**

| Trade | Marks resolved / needed | Reflections due now / later | Action owed | Done |
|---|---|---|---|---|
| T-A | 1 / 0 | 1 / 1 | yes | no |
| T-B | 1 / 0 | 0 / 0 | yes | no |
| T-C | 0 / 1 (DEF) | 0 / 0 | yes | no |
| T-E | 1 / 0 | 0 / 0 | yes | no |
| T-F | 1 / 0 | 0 / 0 | yes | no |

### T5R2.1 Domain: due classification

Seam: `classifyDue` in `src/domain/journal-debt/`, with plain instants: previous close Friday 2026-10-09 20:00Z, close Monday 2026-10-12 20:00Z.

```text
describe("classifyDue (A166, D5 A63)")
  it should return Due for an anchor before the previous close, and for an anchor exactly at it
  it should return DueInNextReview for an anchor after the previous close and at or before the close, including exactly at the close
  it should return DueInReviewAfterNext for an anchor after the close
  it should return no classification when there are no closes (decision 56)
```

The first case goes red on the missing module. Each later case goes red by a mutation of the previous case's code: for example, returning `Due` for every anchor, or making the close comparison strict.

### T5R2.4 Daily Review: card progress in `open`

Seam: `DailyReview.open`, with the card fixture.

```text
describe("card progress in open (A164)")
  it should return each walked Trade's progress with its panels Marks, Reflections, Action in that order and the counts of the expected-progress table, none of them done
  it should count a shared Instrument's Missing Mark as needed on every card that holds it: T-A and T-F each 0 resolved and 1 needed without Marks
  it should count an acknowledged Review-date Mark as resolved: T-C 1 resolved and 0 needed once DEF is acknowledged
  it should mark the Action panel done, and the card done, once an Action is saved for a Trade with nothing else owed: T-E after Hold
  it should keep T-A not done after its Action is saved while D-1 is due, with the Reflections panel 1 due now and 1 later
```

The expected values in the first case are the ones the mounted cases check today. Section 6.1 lists the cases and the values carried over.

### T5R2.5 Daily Review: card progress in `getTrade` and every save result

Seam: `DailyReview.getTrade` and `DailyReview.save`, with the card fixture.

```text
describe("card progress in getTrade (A165)")
  it should return on T-A's card the same progress as T-A's walked item in open

describe("card progress in save results (A165, Q12)")
  it should return T-E's progress, done, in the cards of the review a SaveTradeAction for T-E returns, and the next step's Trade with its own progress
  it should return T-A's progress with 0 due now and 1 later, and the Reflections panel done, after ResolveReviewDebt answers D-1
  it should return T-A's progress with 0 due now and 0 later after D-1 and D-2 are both resolved, so the panel has nothing owed (P46)
  it should return, after SaveReviewMarks saves XYZ from T-A's card without Marks, T-A and T-F each with 1 resolved and 0 needed among the review's trades, and T-A's card progress equal to its walked item
```

### T5R2.7 UI: the held-Review module

Seam: `fold`, `standing`, `nextCard` and `marksOf` in `src/ui/screens/held-review.ts`, on plain data. The Reviews are built from the facade double's card-fixture shapes (section 6.3).

```text
describe("fold (A171)")
  it should replace the held Review with an Opened one, keeping the new Trade order (decision 64)
  it should replace the completion and binding from a Ready ActionSaved or DebtResolved Review, and leave the held Review as it was for ChangedDuringAssembly
  it should put each MarksSaved key's resolution and revision on its Review-date row, clear the row's Manual task, and replace the walked Trades, completion and binding
  it should take a saved earlier session out of its Instrument's missing list, and keep an acknowledged one listed as acknowledged with its acknowledgment
  it should apply the saved keys and nothing else when the MarksSaved Review is ChangedDuringAssembly

describe("standing (A172)")
  it should return a key's resolution and revision from MarkSaved, and from each moved key of MarksConflict
  it should return a saved earlier session's exact Mark from MarksSaved after the session has left its gap list
  it should keep the learned standing when a later Opened Review lists the key at a lower revision, and take the Review's when it lists the key at the same or a newer one

describe("nextCard (P50)")
  it should name the first card in the held order whose Trade is in a Mark step's row, with the row's Instrument
  it should say no card holds a Mark step's row when none of its Trades is held
  it should name the next step's Trade, or Done

describe("marksOf (A153)")
  it should list T-A's XYZ row and Friday session, and T-F's XYZ row with no Friday session
```

Each case's expected value is the one a mounted case checks today (section 6.1). The first case of each describe goes red on the missing export. The later ones go red by a mutation of the code before them: for example, dropping the gap-list patch, or comparing revisions the wrong way round.

### T5R2.10 UI: cards and panels word the progress record

Seam: `ReviewView` and `ReviewCard`, with the facade test double. The double's walked items, Trades, and save results carry `progress`.

```text
describe("card header from progress (A169)")
  it should read "2 Marks · 1 reflection due · Action" for progress with 2 Marks needed, 1 reflection due now and the Action owed, and "Done · Action saved" for a done card, with no other input to the header
  it should open on load the first card whose progress is not done

describe("panel headers from progress (A169)")
  it should read the Marks panel as "1 of 2 for Mon Oct 12" with "1 needed", and "2 of 2" with "Saved" once its progress has none needed
  it should read the Reflections panel as "2 owed, 1 due now" with "1 due", "1 owed, 0 due now" with "Not due", and "None owed" with "None"
  it should read the Action panel as "Needed" while owed, and "Saved" with the saved Action's name otherwise
  it should open the card on its first panel whose progress is not done

describe("fold with progress (A165, A171)")
  it should replace a walked Trade's progress with the one an ActionSaved or DebtResolved Review's cards carry, and leave the other Trades' as held

describe("progress from save results (A165, P46)")
  it should show the progress the Debt resolution's result carries: "None owed" and "None" once the card's last reflection is answered, with no reload
  it should show the progress a SaveTradeAction result carries for the saved card on its collapsed header
```

The first case of each describe goes red because the screen still reads the completion reasons, not the record. Make it red by giving the double progress that disagrees with its completion reasons. The `"None"` case goes red on today's "Resolved". After T5R2.10, `rg 'remainingOf|isOwing|resolvedDebts|onDebtResolved|interface Remaining' src/ui` finds nothing.

---

### T5R2.11 Journal: `applyPreparedEffects` binds its counter

Seam: `Journal.prepareEffects`, `Journal.applyPreparedEffects` and `persistence.commit`, on the Node test host with the D5 debt fixture. The interleaving is written out in the test: prepare, then another Journal write, then apply and commit.

```text
describe("the Journal counter is bound (A174, ADR 0011)")
  it should fail the commit of a prepared Position Change Reflection, naming journal@n, when a Debt resolution through Journal.save commits between its prepare and its commit, leaving the Journal revision advanced exactly once and the reflection unwritten
  it should commit a prepared effect when no Journal write landed in between, advancing the Journal revision by one
  it should report isJournalCounterBinding true for the counter's binding name and false for a Trade, Mark or Debt binding
```

The first case is red today: the commit succeeds and the revision advances once for two writes.

### T5R2.12 Trade Workflows: retry a counter-only conflict

Seam: `TradeWorkflows.recordPositionChange` and `TradeWorkflows.confirmPlan`, on the Node test host. A persistence wrapper lands one Journal write (a Debt resolution through `Journal.save`) just before a chosen commit attempt.

```text
describe("counter-only conflict (A175, ADR 0011)")
  it should record a Position Change once, with its reflection, when one Journal write lands before its first commit, and advance the Journal revision twice
  it should confirm a Plan once, with its Plan Reflection, when one Journal write lands before its first commit
  it should return Conflict and write nothing when a Journal write lands before each of its three attempts
```

The first case is red after T5R2.11: the counter binding now fails the commit, and Trade Workflows returns `Conflict` without retrying. A conflict on a Trade binding is still returned at once; the existing D2 and D5 Conflict cases prove that.

### T5R2.14 Market Data: Review frames carry an evidence binding

Seam: `MarketData.query({ kind: 'ResolveFrames', context: Review })`, `MarketData.bindEvidence` and `persistence.commit`, with the card fixture.

```text
describe("evidence binding (A176)")
  it should fail a commit that binds the frames' evidence, naming mark:XYZ@2026-10-12, when XYZ's Review-date Mark is corrected after the frames were read
  it should fail it, naming mark:DEF@2026-10-12, when a Mark is saved for DEF's Review date, which had no record when the frames were read
  it should fail it when the Stale-context source of DEF's frame is corrected
  it should commit when nothing bound changed, including when a Mark for an Instrument outside the request is saved
```

The first case is red on the missing `evidenceBinding`. The third goes red if the binding leaves out the Stale-context source.

## 5. Structural tasks

| Task | Verification (exact) | Expected result | Behavior that depends on it |
|---|---|---|---|
| T5R2.2 Journal imports the due rule | `npm run typecheck`, `npm run lint:deps`, `npm run verify:fixtures`, `npm run test:unit -- src/modules/journal` | Every check passes. `rg "'OneSessionGrace'" src --glob '!*.test.*'` finds only `src/domain/journal-debt/` and the value Journal writes into a new Debt (`journal.ts`, `dueRule: 'OneSessionGrace'`); no type declaration remains. `git diff claude-opus-5.5-d5r -- tests/fixtures` is empty. | Stored data unchanged (A166). |
| T5R2.3 Coordinators classify through the domain module | `npm run test:unit -- src/coordinators`, `npm run test:integration -- d5 d5r` | Every existing case passes unchanged. `rg 'dueAnchor' src/coordinators --glob '!*.test.*'` shows no `Temporal.Instant.compare`. `ReflectionClassification` and `DebtDueStatus` no longer exist (`rg` finds nothing). | T5R2.4; D6 A86. |
| T5R2.6 One due formatter | `npm run test:unit -- src/ui` | Every existing case passes unchanged. `src/ui/due-text.ts` exports the wording. `DUE_TEXT` is no longer in `ReviewReflections.tsx`, and `OwedDebtItem.tsx` imports nothing from `ReviewReflections.tsx`. | T5R2.10; Trade Detail's Debt status. |
| T5R2.8 `ReviewView` folds every result through the module | `npm run test:unit -- src/ui`, `npm run typecheck` | Every remaining mounted case passes unchanged. The mounted cases that section 6.1 moves to T5R2.7 are removed, with each expected value carried by its table case. `withSavedMarks` and `marksOf` are no longer in `ReviewView.tsx`. `saved`, `reflectionResolved`, `marksSaved` and every `open` read call `fold`, and `saved` acts on `nextCard`. | T5R2.9, T5R2.10; D6 T6.20. |
| T5R2.9 `CardMarks` reads standings from the held Review | `npm run test:unit -- src/ui`, `npm run typecheck` | Every remaining mounted case passes unchanged. `rg 'standings\|setStanding' src/ui/screens/CardMarks.tsx` finds nothing. Each row's standing and each Save Marks entry's expected revision come from `standing(held, key)`. A per-row save and a Save Marks `Conflict` reach the held Review through `fold`. | T5R2.10; D10's multi-leg rows. |
| T5R2.13 Daily Review drops its counter copies | `npm run test:unit -- src/coordinators/daily-review`, `npm run test:integration -- d4 d5 d5r` | Every existing case passes unchanged. `rg 'journal@' src --glob '!*.test.*'` finds only `src/modules/journal/`. | T5R2.15; D6's Close Review resolution. |
| T5R2.15 Daily Review binds evidence through Market Data | `npm run test:unit -- src/coordinators/daily-review`, `npm run test:integration -- d4 d5 d5r` | Every existing save case passes unchanged, including the AC-REV-005 cases (a Mark or acknowledgment changed since the binding returns `ReviewChanged` and writes nothing). `rg "'observations'|IDBKeyRange" src/coordinators` finds nothing. The Action save issues one read-only transaction fewer before its commit, recorded in the evidence. | T5R2.16; D6, D11. |
| T5R2.16 Query count and benchmark | `npm run test:integration -- d5r/query-count`; then, with no browser suite running, `npm run build:bench && npm run bench:run` | The query-count case passes unchanged: progress adds no request (A168). `bench:run` reuses the cached dataset (the generator version is unchanged) and its before-and-after comparisons hold. Its timings are recorded, ungated, in `evidence/D05R2/bench.md`. | AC-PERF-001. |
| T5R2.17 Node integration suite | `npm run test:integration` | Every case in sections 6.1 of D1, D2, D4, D5 and D5R passes. | Cumulative regression. |
| T5R2.18 Browser suite | `npm run test:e2e` (Chromium); `git diff claude-opus-5.5-d5r -- e2e` | All 179 browser cases pass. The diff is empty (P47). | Cumulative regression; AC-REV-002, AC-REV-006. |
| T5R2.19 Browser critic | Fresh critic agent per section 7 | A structured report with every flow passing. | Deliverable gate. |

---

## 6. Tests

### 6.1 Mounted unit cases whose counting moves

Each case below keeps its expected values. Its counting is now proven in T5R2.4 or T5R2.5, at the coordinator, and its rendering in T5R2.10.

| Case today | What happens to it |
|---|---|
| `ReviewCards.test.tsx`, "should render one card per walked Trade in attention order … what remains …" | Stays mounted for order, band and slider. Its "what remains" text is now fed by the double's progress. The counts move to T5R2.4's first case. |
| `ReviewCards.test.tsx`, "should show Done and Action saved on a card whose Marks are resolved, with no due reflection and a saved Action" | Replaced by T5R2.10's header case. Its Done rule moves to T5R2.4's fourth case. |
| `ReviewCard.test.tsx`, "should count the Marks that are done in the Marks panel summary, reading 1 of 2 with 1 needed …" | Replaced by T5R2.10's Marks panel case, with the same strings. The counting moves to T5R2.4 and T5R2.5. |
| `ReviewCard.test.tsx`, "should show Marks, Reflections, and Action panels in that order …" | Stays mounted for order, one panel open, and buttons. Its summaries come from the double's progress. |
| `ReviewCard.test.tsx`, "should count only the reflections still owed in the Reflections panel summary, reading 1 owed, 0 due now and Not due …" (D5R T5R.16-B4) | Replaced by T5R2.10's Reflections and save-result cases. Its last expectation changes from "Resolved" to "None": the one sanctioned expectation change (P46). |
| `ReviewCard.test.tsx`, the "moving on", "moving on from Reflections" and "moving on from the panel that finished" cases | Stay mounted. The panel they move to is chosen from the progress the double returns. |

The task that changes these cases records, in its evidence, each removed case's expected values beside the new case that carries them. Apart from P46's change, no value is dropped.

### 6.1a Mounted cases whose folding moves (Q18)

These are cases about what the held Review becomes after a result. Each moves to T5R2.7's table cases with its expected values (T5R2.8, T5R2.9). Cases about drafts, focus, timing and requests stay mounted.

| Case today | What happens to it |
|---|---|
| `ReviewView.test.tsx`, "should keep an earlier-session Mark saved resolution when the Review re-renders without a newer revision" | Moves to T5R2.7's third `standing` case. |
| `CardMarks.test.tsx`, "should send an earlier-session draft with the resolution and revision of the newest Review after Refresh, not those of the first snapshot" | Its standing part moves to the same case. The mounted case stays for the entry it sends. |
| `ReviewCards.test.tsx`, "should open the first card in the Review order whose Trade is in the Mark row" and "should keep the old behaviour when none of the row Trades is in the Review" | Move to T5R2.7's `nextCard` cases. The mounted "should collapse the saving card and open the card for the Missing Mark …" stays, for focus and scrolling. |
| `ReviewView.test.tsx`, "should keep an earlier session listed with its saved Mark while the card stays open …", "should keep a value typed into a Mark entry …"; `CardMarks.test.tsx`, "should keep an earlier session saved Mark when the trader pages away and back" | Stay mounted: they check rendering continuity and drafts. They now get their standing from the held Review. |

The task that moves a case records, in its evidence, the removed case's expected values beside the table case that carries them.

### 6.2 Browser cases

No browser case is added, changed, or removed (P47). T5R2.18's diff check proves it.

### 6.3 Disclosed test substitutes

As in D5R: the facade test double for UI cases, and the Node test host for coordinator and integration cases. The double gains `progress` on its walked items, Trades and save results. It is built from the same table as section 4, so the UI cases and the coordinator cases use the same numbers.

---

## 7. Browser-critic flows

The critic receives:
- the frozen `specs/`;
- the plan index;
- the D4, D5, D5R and D5R2 breakdowns;
- plan decisions 61 and 69;
- the list of future capabilities that must not be treated as defects: everything after D5R2, including exits and Closed Trades, owed-reflection cards for Trades outside the walk, options, multi-leg structures, and automatic prices.

The brief is lighter than D5R's. D5R2 changes where progress comes from, how results reach the screen, and which module stages each binding, not what the trader sees. The bindings are proven by tests only (T5R2.11–T5R2.15), so they add no flow. So the critic checks that every card and panel still reports its work correctly as the work is done, and that the held card and the choice of the next card behave as before.

| Flow | What the critic checks |
|---|---|
| C5R.1 Cards in place | With 20 positions, open cards near the top, middle and end. Each opens where it is, the previous card collapses, and after an Action save the next card that is not Done opens, or the card holding the next Missing Mark, on its Marks row. |
| C5R.2 A card's work in order | In one card: Marks, then reflections, then Action. Each panel's summary and status match its work at every step. Finishing one opens the next. Finishing the card opens the next card that is not Done, and the finished card's header reads Done. After the last reflection is answered, the panel reads "None owed" and "None" without a reload, and the same after a reload (P46). |
| C5R.3 Save Marks | After Save Marks, the Marks panel's count and status, and the card header's remaining Marks, update from the result. |
| C5R.4 Shared Mark | A Mark saved in one card counts as resolved on the other card holding the Instrument, in its header and its Marks panel. |
| C5R.8 Leaving and links | Unsaved work holds the card, including after an Action save that names another card next. Missing-Mark links from the Open list and Trade Detail open the right card and panel. |
| C5R.9 Narrow, keyboard, Recovery Only | 375 and 320 px with no horizontal scroll; a whole card completed by keyboard with the headers updating; Recovery Only cards show the same progress, read only. |
| C5R2.1 Trade Detail due status | An owed reflection on Trade Detail reads "Due", "Due in the next Review" or "Due in the Review after next", in the same words as the Review's reflection groups for the same Debt. |

---

## 8. Acceptance

D5R2 adds no acceptance row. It re-proves:

| Row | Re-proven by |
|---|---|
| AC-REV-002 (work order inside each card; shared Mark once) | T5R2.4, T5R2.5, T5R2.10, C5R.2, C5R.4 |
| AC-REV-006 (completion honest) | T5R2.4, T5R2.5, C5R.2 |
| AC-RESP-001 (result sufficient to render) | T5R2.5, T5R2.7, T5R2.10 |
| AC-JOUR-001 (nothing saved without Save; unsaved work holds the card) | T5R2.8, C5R.8 |
| AC-UI-001, AC-UI-002 (responsive, accessible) | T5R2.18, C5R.9 |
| AC-REV-005 (changed evidence prevents stale Save) | T5R2.14, T5R2.15 |
| AC-PERF-001 (bounded requests) | T5R2.16 |

Candidate 5 also restores ADR 0011's rule that every commit advancing a shared counter binds it (T5R2.11, T5R2.12).

---

## 9. Changes to other breakdowns, once D5R2 is agreed

| Breakdown | Change |
|---|---|
| D5R | A150's "what remains" and Done, and A152's panel summaries, are now worded from the progress record (A164, A169). The rules are unchanged. A note is added to each; the text is kept. |
| D5 | A63 and A69: the classification is computed by `classifyDue` (P44). A note is added; the text is kept. |
| D6 | **A90 and T6.11–T6.13:** a `ReflectionsOwed` card carries `CardProgress` of kind `'ReflectionsOwed'`, with the Reflections panel alone; it is done when that panel is done. The next step after a save is the first card whose progress is not done. **A86:** the Close Review is classified by `classifyDue`. **A89:** the owed group's order is added to `src/domain/journal-debt/`. **T6.20:** the owed-reflection cards render from that progress, with no counting in the UI. The Close Review's resolution and the owed group reach the screen through `held-review.ts`'s `fold` and `nextCard` (A171), added there once. **T6.10 and T6.13:** the exit's commit and the Close Review resolution get Journal's counter check from `applyPreparedEffects`, and the exit retries a counter-only conflict through T5R2.12's loop (A174, A175). D6's handoff names D5R2's tag as its starting point. |
| D7 | Settlement Due, when D7 adds it, is a `PanelProgress` variant between Reflections and Action (D5R P36's work order). Also a note at the top of the breakdown: tech debt item 5 (candidate 4, missing evidence in one vocabulary) is raised with the user before D7 starts, with a refactor deliverable of its own recommended first. |
| D9 | Its decisions and assumptions are numbered from P55 and A177. |
| D10 | A multi-leg card's rows take their standing from the held Review (P51), so one copy covers every leg. |

---

## 10. Before work starts

1. ~~The user agrees or amends P42–P54 and A164–A176.~~ Done on 2026-11-01: P42–P48 (Q1–Q15), P49 (a), P50–P51 with the amendments to P47 and P48 (Q16–Q19), and P52–P54 (candidate 5 in D5R2).
2. ~~Plan revision 28.~~ Done: decision 69, D5R2 in the deliverable summary and its definition section, the amendment notes of section 9 in D5, D5R, D6 and D7, and tech debt items 4 and 5. Tagged `claude-opus-5.5-plan-r28`.
3. ~~Glossary and spec map.~~ Done: the glossary entry "Due Classification" in `specs/glossary.md`'s Journal language table (decision 69). Then update the spec map's glossary line ranges and character counts, and regenerate the reading lists (`python3 .claude/scripts/spec-reading-lists.py`). No other retag: D5R2's reading list is `plan/spec-reading/D05.md` plus the new glossary entry. The reading-list script names deliverables by number, so D5R2 has no list of its own.
   Regenerating the lists also showed earlier drift in the map, corrected under decision 45 and recorded in decision 69: `specs/README.md` S004–S008 (revision 11 added a line), ADR 0011 S259 (revision 12 added line 20), and S090's character count (decision 49). Every one of the 259 rows now matches its file.
4. Handoff: `plan/D05R2-handoff.md`, written after the tag. The D6 handoff carries a note that D5R2 runs first.

---

## 11. Evidence recording

As for D5R, under `evidence/D05R2/`:
- one structural file, with the record of carried-over expected values for sections 6.1 and 6.1a, and T5R2.15's before-and-after request counts for the Action save;
- the ocr output for each task;
- suite runs;
- `bench.md`;
- the critic report.
