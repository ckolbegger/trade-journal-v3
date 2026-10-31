# D5R — Review redesign: one card per position: task breakdown

Status: **agreed by the user, 2026-10-31 (P36–P41, A150–A163); awaiting plan revision 20.** Not yet part of the frozen plan. Revised on 2026-10-31 at the user's direction: a card's Marks are saved through a Daily Review command whose result carries the refreshed Review (P37, P38), replacing the earlier draft's Market Data batch command and refresh through `open`. Agreeing it means plan revision 20, with plan decision 61 recording the reopened passages listed in P36 and P37, and an entry in the implementation plan's deliverable summary between D5 and D6. Until then the frozen plan (revision 19) and D6's breakdown stand unchanged.

D5R revises the Daily Review screen that D4 built (A57, A48, A60) and D5 extended (A71). The layout and visuals are taken from **layout B** of the Review prototype (`prototypes/review-workflow/index.html`, the "B · Choose next" tab, as of commit `e4bbc4b`). The prototype is a picture of the workflow, not a specification: where it differs from the specs or the plan, this breakdown says which wins (section 1.3, A159 and A160).

It builds on D4's Review coordinator (T4.14–T4.16), Mark entry (T4.21), and Action form (A58); D5's reflections in the Review (P17, A68, A71), Debt form (T5.15), and post-commit Review result (A67); and D2's evaluation figures and Journal prepare/apply pattern ([D4](D04-daily-review.md), [D5](D05-deferred-reflection-and-journal-debt.md) breakdowns).

---

## 1. Stories and decisions

### 1.1 User stories

1. As a trader, I would like the Review to list my positions as cards and open the one I pick **in place**, with all of that position's Review work inside it, so I never have to scroll to find where a form opened.
2. As a trader, I would like a position's Marks for every session it needs **grouped together** and saved with one **Save Marks**, so entering four legs of a condor or a few missed days is one step, and a typo in one price saves nothing until I fix it.
3. As a trader, I would like a position's owed reflections **grouped by the day** they belong to, inside its card, so I can clear them while I am looking at that position.
4. As a trader, I would like to see at a glance **where each position sits between its Stop and its Target**, before I open it, so I can decide which position to look at first.
5. As a trader, I would like the open card to show **risk to stop, worst-case risk, reward to target, and planned versus current reward : risk**, so I review each position with its risk in front of me.
6. As a trader, I would like the Review to **take me to the next position** that still needs work when I finish one, and to work the same with a keyboard and on a phone.

### 1.2 What changes and what stays

| Today (D4 A57, A48; D5 A71) | After D5R |
|---|---|
| The Marks family is a list of every Instrument, then **Continue to Trades** reloads the Review and shows the Trade walk below it. | One list of **position cards** in attention order. There is no Continue to Trades. Each card holds its own Marks, reflections, and Action. |
| Pressing "Review XYZ" opens the Trade's card **below the whole list**. | Pressing a card's header opens it **where it is**, closes the card that was open, and brings its top into view. |
| Each Mark is entered and saved on its own through `MarketData.save`. | A card's Marks are typed as drafts and saved together with **Save Marks**, through `DailyReview.save` (P37). Correct and Withdraw stay one row at a time. |
| Trade figures update when the trader presses Continue to Trades. | Save Marks returns the refreshed card and overview in its result, as an Action save already does (P38). |
| The walk shows a band and reasons per Trade. | Each collapsed card shows its band, what it still owes, and a **Stop-to-Target slider** (P39). |
| The Trade card shows P&L, risk to stop, worst case, reward to target, and at-entry figures. | The same figures, plus **Reward : risk now and planned** (P40). |

**Preserved unchanged:**
- **Saving and binding:** the Action save and the Debt resolution save, the Debt form, and the Action form with Hold preselected and one Save.
- **Ordering and completion:** attention ordering, completion and blockers.
- **Mark rules:** historical gaps stay optional, a shared Instrument's Mark is entered once for every Trade that holds it, and each Mark keeps its exact Instrument and date.
- **Storage:** no schema change.

### 1.3 Decisions for this breakdown

Numbering continues from D8's P29–P35.

| # | Question | Decision | Alternatives and tradeoff |
|---|---|---|---|
| P36 | **Marks inside each card, not first.** The spec's task-family order is normative: "1. unresolved current-date Missing Marks; 2. due Journal Debt; 3. settlement facts still due; 4. the attention-ranked eligible Trade walk" (Daily Review, "Date, eligibility, and ordering"). AC-REV-002 requires "task families appear in Mark, Debt, settlement, Trade order". D5 P17 already removed the Debt family at the user's direction (plan decision 29). Layout B puts each Trade's Marks inside its card. | **Agreed with the user, 2026-10-31: reopen the order for presentation, keep it for the work.** Cards follow attention order. Inside a card the work keeps the spec's order: Marks first, then reflections (and from D7 settlement), then the Action. The overview's blockers list Missing Marks first. The next step after any save prefers a card with a Missing current Mark. `open` still returns the Marks family as data; only the screen regroups it. A shared Instrument's Mark appears in each card that holds it and resolves once for all of them (AC-REV-002's "shared Mark resolves once" still holds). **Reopened passages, recorded in plan decision 61:** Daily Review "Date, eligibility, and ordering" (the family order as a screen order) and AC-REV-002's "task families appear in Mark, Debt, settlement, Trade order". The frozen `specs/` files are not edited, as with decision 29. | (a) Keep a short "Marks needed" strip above the cards that links into them: closer to the spec's wording, but it shows Marks twice, which is what the user asked to remove. (b) Sort cards with Missing Marks first: honours the order literally, but breaks attention order. |
| P37 | **Save Marks saves several Marks in one commit.** Market Data's `save` carries one key and commits on its own (Market Data, "Manual writes and precedence"). Daily Review's `save` "is either `SaveTradeAction` or `ResolveReviewDebt`" (Daily Review, `save`). | **Agreed with the user, 2026-10-31: a Daily Review command, `SaveReviewMarks`, staged through a Market Data prepare/apply pair.** This is the same pattern as the Action save, which stages Journal's prepared Entry in Daily Review's own commit (Daily Review, `save` sequence; D5 A64). Market Data's `save` is split into **`prepareEffects`** and **`applyPreparedEffects`**:<br>• `prepareEffects` validates every entry, reads each key's current record in one read-only snapshot, checks each expected resolution revision, and builds each new record. It writes nothing.<br>• `applyPreparedEffects` stages, in the caller's transaction, one revision check and one `observations` write per key.<br>`MarketData.save` becomes prepare, apply, and commit, with unchanged behaviour. `SaveReviewMarks` prepares 1–100 entries (record an initial Manual Mark, or assert unavailable with its reason), stages them, and commits once: every Mark or none. Correct, Withdraw, and (from D11) Override keep the single-key `MarketData.save`. For multi-leg structures (D10), every leg's Mark lands in one commit, so a structure is never left half-marked. **Reopened passages, recorded in plan decision 61:** Daily Review `save` (a third command), and the Market Data interface (the prepare/apply pair, an internal module seam the UI never calls). | (a) A Market Data batch command, with figures refreshed by calling `open` again (the earlier draft): smaller change to Daily Review, but a refresh that takes about 2.2 s on the mature dataset (tech debt item 3). (b) No contract change: one `MarketData.save` per Mark in sequence. A failure halfway leaves some Marks saved and some not. |
| P38 | **Figures after Save Marks.** D4 A48: Mark rows render from the save result, and Trade figures update when the trader presses Continue to Trades, which calls `open`. Layout B has no Continue to Trades. | **Agreed with the user, 2026-10-31: the save result carries the refreshed Review.** As after an Action save (D5 A67), `SaveReviewMarks` assembles the revised Review under the committed facts. The result includes each saved key's resolution, the revised progress and completion, every walked Trade's revised summary and range position (so a shared Mark updates every card holding it), and the card it was saved from, evaluated with the new Marks. The screen renders all of it from the result, with no `open` or `getTrade` call (AC-RESP-001). The assembly reads only the Review-date frames, like the Action save's (`withGaps = false`). It skips Market Data recovery and the historical-gap scan, which is the part of `open` that grows with history. Saved gap rows render as saved from the result; the gap groups are recomputed at the next `open`. | (a) Refresh by calling `open` and `getTrade` after the save: no coordinator change, but about 2.2 s on the mature dataset. (b) A **Refresh figures** button: no wait, but one more press after every Save Marks. |
| P39 | **The Stop-to-Target slider on each collapsed card.** The overview returns each Trade's pressure basis for **one** side only (risk *or* reward, at entry and now). The UI contract reserves red and green for "Stop/Target meaning", requires that "color never carries meaning alone", and that "every graphed number has a readable textual equivalent or accessible description". | **Agreed with the user, 2026-10-31: the overview returns both sides, and the slider shows no numbers.** Each walked Trade gains a **range position**: the share of its Stop-to-Target range at the Review-date Mark, `risk now ÷ (risk now + reward now)`, and the same share at entry. It uses the same risk and reward the pressure basis selects (Daily Review, "Date, eligibility, and ordering"), so it is exact and agrees with the band. The track runs red at the Stop to green at the Target, with a dot at the Mark and a tick at entry. When risk to stop is zero (past the Stop) or reward to target is zero (past the Target), the dot pins to that end and changes shape. When inputs are missing the track is grey with no dot. **Non-colour cues:** one "Stop ◂ ▸ Target" legend above the card list (not on every card); the slider's accessible description gives the position in words plus Risk to stop, P&L, and Reward : risk. | (a) "Stop" and "Target" captions under every slider: clearer on its own, but the user asked for a slider without text. (b) Compute the share in the UI from `getTrade`'s figures: needs a `getTrade` per collapsed card, so 20 positions mean 20 reads. |
| P40 | **Reward : risk in the open card.** The Review card has no reward : risk today. Trade Detail and the Trades list show the Plan's ratio (`baseline.rewardRiskRatio`). There is no current ratio anywhere in the app. | **Agreed with the user, 2026-10-31: show both.** *Planned* is the Plan's ratio, returned by `getTrade` with the Plan baseline (1R, original planned reward, ratio). *Now* is a new derived figure, Incremental Reward to Target ÷ Ongoing Risk to Stop. It is a `Value` when both are Values and risk is above zero, `NotApplicable` when risk is zero, and otherwise `Unavailable` with the missing input's reason. It is computed in Trade Analysis's `evaluate` (ADR 0001), so Trade Detail can use it later. It is derived from the Plan and the Marks, not entered by the trader (plan decision 31). | (a) Planned only: no new figure, but the user asked for both. (b) Compute "now" in the screen: quicker, but puts a calculation in presentation code. |
| P41 | **Where D5R sits.** D5 is complete and tagged (`claude-opus-5.5-d5`). D6's breakdown already adds Review cards for Trades outside the walk (P20, A90), an Exit link in the card (A94), and its UI task T6.20. | **Agreed with the user, 2026-10-31: D5R runs before D6, as its own deliverable with its own tag (`claude-opus-5.5-d5r`).** D5's tag is not moved. D6's breakdown is then amended (section 9) so that its owed-reflection group renders as the same cards after the walk, and its Exit link sits in the card's Action panel. | Run D5R after D6: D6 would build T6.20 on the old layout, and D5R would then have to redo it. |

### 1.4 Working assumptions

Numbering continues from D8's A123–A149. These are implementation-level choices that do not reopen product semantics. Agreed with the user, 2026-10-31.

| # | Assumption |
|---|---|
| A150 | **Card list:** one card per walked Trade, in the overview's attention order, which is stable within a Review view (Daily Review, "Date, eligibility, and ordering"). A collapsed card is one heading button: Underlying; what remains ("2 Marks · 1 reflection due · Action", from the overview's Mark rows, reflection counts, and completion reasons); the band as a badge; and the slider (P39). A card is **Done** when its Review-date Marks are resolved, it has no due reflection, and its Action is saved. A Done card shows "Done · Action saved" and keeps its place. |
| A151 | **One card open at a time, opened in place.** Pressing a collapsed header calls `getTrade` (as today), closes the card that was open, opens the pressed card in place, scrolls its top just under the page header, and moves focus to its header button (`aria-expanded`). Pressing an open card's header collapses it. On load the first card that is not Done opens. If every card is Done, none opens. |
| A152 | **Panels:** inside the open card, after its figures (A158), three panels in the spec's work order (P36): **Marks**, **Reflections**, **Action**. One panel is open at a time. Each panel header is a button with a one-line summary ("1 of 4 for Mon Oct 12 · 2 earlier optional"; "2 owed, 1 due now"; "Hold, Exit, Roll or Adjust") and a status badge as text ("3 needed", "1 due", "Saved"). The card opens on its first panel that is not done. Finishing a panel's work opens the next panel that is not done. |
| A153 | **Marks panel:** the Review-date rows for the card's Instruments come first, then the card's earlier sessions without Marks under "Earlier sessions without Marks — optional", grouped by date, newest first, 20 sessions per page (D4 A57). A shared Instrument's row says "also held by" with the other Trades' Underlyings. A typed price, or "Can't get a price" with its reason, is a **draft**: the row is marked "Unsaved" and nothing is written. **Save Marks (n)** and **Discard** sit at the panel's foot. A row with an exact Mark or an acknowledgment keeps D4's per-row **Correct** and **Withdraw**, which save at once through `MarketData.save` as today. Enter moves to the next price; from the last price it moves to Save Marks. |
| A154 | **Market Data prepare/apply (P37):** `prepareEffects({ entries })` takes 1–100 entries with distinct keys, each `{ key, expectedRevision, intention }`. It validates them all at once and returns issues keyed by entry index and field. The codes are D4's key, session, price, and reason codes, plus `DuplicateKey` and `TooManyEntries`. It then reads every key's current record in one read-only snapshot. If any expected revision is stale, or an acknowledgment meets an exact Mark (`MarkExists`), it returns `Conflict` naming every such key with its current resolution. Otherwise it returns a prepared effect: each new record (the appended revision with its id and save time, and the bumped `resolutionRevision`) and the resolution, revision, and classification each key will report. It writes nothing. `applyPreparedEffects(tx, prepared)` adds, per key, a check that the record's `resolutionRevision` is still the one prepared against, and a `put` of the new record. A key that moved between prepare and commit therefore fails the whole commit with nothing written. `save` keeps its command and result types and becomes prepare, apply, and commit for its one key. Market Data has no shared counter to guard (decision 53). |
| A155 | **`SaveReviewMarks` (P37, P38):** `{ kind: 'SaveReviewMarks', reviewDate, tradeId, binding, entries }`, where `tradeId` is the card the Marks were saved from and `binding` is the overview's binding. Daily Review calls `marketData.prepareEffects` (passing its `Rejected` or `Conflict` straight back, writing nothing), opens a semantic transaction, applies the prepared effect, and commits. It adds no other check: Market Data accepts any well-formed key on a completed session (D4 P10), and the screen offers only the Review's keys. After the commit, it assembles the revised Review as an Action save does (D5 A67, Review-date frames only) and `getTrade` for `tradeId` under the new binding. The result is `MarksSaved` with each key's resolution, revision, and classification; the revised progress, completion, binding, and walked Trade items (summary, band, reasons, range position); the refreshed card; and the next step. If the assembly fails after the commit, the result still reports the saved Marks, with the Review part as `ChangedDuringAssembly`, as for an Action save. |
| A156 | **Leaving with unsaved work:** while the open card holds a draft Mark, or a Debt or Action form holds an entered value, its header cannot collapse it and no other card opens. The card says "Save or discard what you entered for XYZ to leave it." The screen reports unsaved state through `onDirtyChange` as today, so route changes and the update notice wait (D1 A5). |
| A157 | **After Save Marks (P38):** every row, the card's figures, and every collapsed card's summary and slider render from the `MarksSaved` result. The open card stays open and moves to its next panel that is not done. When the result's Review part is `ChangedDuringAssembly`, the saved rows render, and the card says its figures are out of date and offers **Refresh**, which calls `open` and `getTrade`. |
| A158 | **Open-card figures:** the card's figure grid shows Current P&L, Risk to stop, Worst case, and Reward to target, each in dollars and R; then Reward : risk, now and planned (P40); then At entry; then the dated last close when present (D4 P12, P13). Every figure that is not a `Value` reads in words from `src/ui/figures.ts` (for example "Mark missing: DEF, Oct 12"), never as 0 (UI contract, "Numbers, availability, and graphs"). |
| A159 | **Action form keeps Hold preselected.** The prototype's Action panel starts with no choice. The spec wins: Hold is preselected only in returned view state and one visible Save records it (UI contract, "Forms and evidence capture"; AC-REV-003). As in D4, saving an Action is not gated on the card's Marks. A missing Mark keeps the Review Incomplete and the card not Done. |
| A160 | **Other prototype differences:** the prototype's Save Marks blocked an invalid price on the screen. In the app, the screen sends the command and shows the returned issues (A154). The prototype's mode switches (Manual or Automatic pricing, 4 or 20 positions) are prototype controls only. |
| A161 | **Links into the Review (replaces D4 A60):** `/review?instrument=XYZ` opens the first card, in attention order, that holds XYZ, on its Marks panel, with focus on XYZ's row. `/review?trade=T` opens T's card on its first panel that is not done. The header's blockers link to the card and panel that resolve them. The Open list's and Trade Detail's Missing-Mark disclosures keep linking with `?instrument=`. |
| A162 | **Responsive and read only:** at narrow widths the card header puts the slider on its own full-width row under the Underlying. Panels, figures, and forms stack in one column. Resizing keeps the open card, the open panel, and every draft and form value (UI contract, "Responsive behavior"). In Recovery Only every card still opens and shows its figures, Marks, reflections, and saved Action. Inputs and Save Marks, Answer, Decline, and Save are not offered, as in D4 and D5. |
| A163 | **No storage change:** D5R adds no store, index, or schema version. No migration, fixture freeze, or capacity basis change is needed. The overview's new fields (P39, the gap groups' Trades) are computed from data `open` already reads. A Mark saved through `SaveReviewMarks` is the same `observations` record `MarketData.save` writes. |

---

## 2. Implementation boundaries extended in D5R

| Canonical boundary | Code location | D5R operations |
|---|---|---|
| Market Data | `src/modules/market-data/` | `prepareEffects` and `applyPreparedEffects` (P37, A154); `save` rebuilt on them |
| Trade Analysis | `src/domain/trade-analysis/` | `evaluate`: current Reward : risk (P40) |
| Daily Review | `src/coordinators/daily-review/` | `open`: range position per walked Trade (P39), Trades per historical gap group; `getTrade`: the Plan baseline (P40); `save` (`SaveReviewMarks`, P37, P38, A155) |
| UI | `src/ui/` | card list, slider, Marks panel with Save Marks, Reflections and Action panels, figure grid, links; retires the Marks family view and Continue to Trades |

---

## 3. Task graph

Kind: **B** = behavioral (TDD, red→green per case), **S** = structural (exact verification).

| Task | Title | Layer | Kind | Blocked by | Public seam under test |
|---|---|---|---|---|---|
| T5R.1 | Market Data: `prepareEffects` and `applyPreparedEffects` | domain/persistence | B | D4 T4.7 | `MarketData.prepareEffects`, `applyPreparedEffects`, `save` |
| T5R.2 | Trade Analysis: current Reward : risk | domain | B | D4 T4.10 | `TradeAnalysis.evaluate` |
| T5R.3 | Daily Review: `open` with range positions and gap Trades | application | B | T5R.2 | `DailyReview.open` |
| T5R.4 | Daily Review: `getTrade` with the Plan baseline | application | B | T5R.2 | `DailyReview.getTrade` |
| T5R.5 | Daily Review: `save` (`SaveReviewMarks`) | application | B | T5R.1, T5R.3, T5R.4 | `DailyReview.save` |
| T5R.6 | Installed Capability Manifest and composition root for D5R | application | S | T5R.1–T5R.5 | `verify:capabilities` |
| T5R.7 | UI: Stop-to-Target slider | UI | B | T5R.6 | `StopTargetSlider` |
| T5R.8 | UI: position cards, opened in place | UI | B | T5R.7 | `ReviewView`, `ReviewCard` |
| T5R.9 | UI: Marks panel and Save Marks | UI | B | T5R.8 | `CardMarks` |
| T5R.10 | UI: Reflections and Action panels | UI | B | T5R.8 | `ReviewCard` |
| T5R.11 | UI: open-card figures | UI | B | T5R.8 | `CardFigures` |
| T5R.12 | UI: links, blockers, and next step | UI | B | T5R.9, T5R.10 | `ReviewView` |
| T5R.13 | Query-count proof and latency run | test | S | T5R.6 | `test:integration -- d5r/query-count`, `bench:run` |
| T5R.14 | Node mock-free integration suite | test | S | T5R.6 | `test:integration` |
| T5R.15 | Browser suite: D4 and D5 cases moved onto cards, and D5R cases | test | S | T5R.7–T5R.12 | `test:e2e` |
| T5R.16 | Independent browser-critic gate | test | S | all | fresh critic report |

**Parallel tracks.** Once the prepared Mark effect, `SaveReviewMarks` and its result, the range position, and the Plan baseline are fixed in T5R.6's type module, two tracks proceed in parallel:
- **Domain and coordinators** (T5R.1–T5R.5). T5R.1 and T5R.2 can run in parallel.
- **UI** (T5R.7–T5R.12), against the facade test double. T5R.9, T5R.10, and T5R.11 run in parallel once T5R.8 lands.

---

## 4. Behavioral tasks

Every case runs **red → green** individually. A case that passes on its first run, or fails for a syntax, configuration, fixture, or unrelated reason, is not valid red evidence; it must be fixed and rerun to a genuine red. Cases are ordered so that each one targets behavior the previous cases did not need.

**Card fixture:** D4's five-Trade Review fixture without T-D (Monday 2026-10-12, Review at 17:00, cutoff 16:00), with these changes:
- **T-F**, a second XYZ Trade (Plan 50 shares at 50.00, Stop 48.00, Target 55.00; 50 @ 50.00 at Monday 10:30). It shares XYZ's Mark with T-A.
- **T-A's PC1** moved to **Friday 2026-10-09** 10:00 (same quantity and price), with no Friday XYZ Mark. Friday is then an earlier session without a Mark for XYZ, relevant to T-A from Friday and to T-F only from Monday.
- **D-1**: T-A's PC1 recorded with Defer, so it is due in Monday's Review (D5 P16). **D-2**: T-A's PC2 (Monday 11:00) recorded with Defer, so it is due in the next Review.

Attention order at the Monday Marks: T-B (boundary reached), T-C (evidence limited), T-F (winning share 2/5), T-A (91/291), T-E (1/10).

**Expected range positions at the Monday Marks** (risk and reward without fees, as the pressure basis uses):

| Trade | Mark | Risk now | Reward now | Share now | Risk at entry | Reward at entry | Share at entry | Reward : risk now | Planned |
|---|---|---|---|---|---|---|---|---|---|
| T-A | XYZ 52.00 | 450.00 | 400.00 | 9/17 | 268.00 | 582.00 | 134/425 | 8/9 | 12/5 |
| T-B | ABC 27.50 | 0 (past the Stop) | 850.00 | 0, pinned | 200.00 | 600.00 | 1/4 | Not applicable | 3 |
| T-C | none | — | — | not placed: Mark missing DEF Oct 12 | — | — | — | Mark missing | 3 |
| T-E | JKL 21.00 | 200.00 | 900.00 | 2/11 | 100.00 | 1,000.00 | 1/11 | 9/2 | 10 |
| T-F | XYZ 52.00 | 200.00 | 150.00 | 4/7 | 100.00 | 250.00 | 2/7 | 3/4 | 5/2 |

### T5R.1 Market Data: `prepareEffects` and `applyPreparedEffects`

Seam: `MarketData.prepareEffects`, `applyPreparedEffects` (with a semantic transaction committed through `Persistence.commit`), and `save`, against `fake-indexeddb`, with Monday 2026-10-12 completed and no Monday Marks.

```text
describe("prepareEffects (P37, A154)")
  it should return a prepared effect for initial Manual Marks on XYZ, ABC, and JKL for 2026-10-12, holding each new record and the resolution, revision, and classification each key will report, and write nothing
  it should prepare an acknowledgment for DEF with its reason alongside the Marks
  it should return every entry's issues at once, keyed by entry index and field, and write nothing, for an invalid price, a negative price, and an acknowledgment without a reason
  it should reject two entries for the same key with DuplicateKey and more than 100 entries with TooManyEntries
  it should return Conflict naming each key whose resolution revision differs from the expected one, with its current resolution, and MarkExists for an acknowledgment whose key already has an exact Mark

describe("applyPreparedEffects")
  it should stage one revision check and one observations write per key in the caller's transaction, so one commit writes every record, each equal to the resolution the prepared effect reported (AC-RESP-001)
  it should fail the caller's commit with Conflict, writing no record for any key, when one key's resolution revision moved after preparation

describe("save, rebuilt on prepare and apply")
  it should record, correct, acknowledge, and withdraw a single key with the results D4 defined, through the prepared path
```

Red notes: the first case is red because `prepareEffects` does not exist. The last case is a regression guard for the refactor: D4's existing `save` cases must pass unchanged. It is red only if `save` stops using the prepared path, so its red is shown with a mutation that bypasses `applyPreparedEffects`, and that is flagged in the task's evidence. The write gate is inherited from `Persistence.commit` and proven by integration (I5R.6).

### T5R.2 Trade Analysis: current Reward : risk

Seam: `TradeAnalysis.evaluate`, with the card fixture's derived states and Monday frames.

```text
describe("Reward : risk now (P40)")
  it should return Incremental Reward to Target divided by Ongoing Risk to Stop as an exact Value: T-A 8/9 at XYZ 52.00, T-E 9/2 at JKL 21.00
  it should return NotApplicable when Ongoing Risk to Stop is zero (T-B past its Stop)
  it should return Unavailable with the missing Mark's Instrument and date when either figure is Unavailable (T-C, DEF on 2026-10-12)
```

### T5R.3 Daily Review: `open` with range positions and gap Trades

Seam: `DailyReview.open`, against `fake-indexeddb`, with the card fixture at Monday 17:00 and Monday Marks for XYZ, ABC, and JKL.

```text
describe("range position per walked Trade (P39)")
  it should return each walked Trade's share of its Stop-to-Target range now and at entry, from the same risk and reward its pressure basis selects: T-A 9/17 and 134/425, T-E 2/11 and 1/11
  it should return T-B's share now as 0 with its StopBreached reason, and T-C as not placed with the missing Instrument and date
  it should return the share from Worst-Case Ongoing Risk when Ongoing Risk to Stop is not a Value, as the pressure basis does

describe("historical gap groups name their Trades (A153)")
  it should list with XYZ's gap group each eligible Trade that holds XYZ and the first session it is relevant from: T-A from Friday 2026-10-09, T-F from Monday 2026-10-12, so Friday's gap belongs to T-A's card only
```

Red notes: T-B's share assumes D4's Ongoing Risk to Stop is zero past the Stop, as the spec's "even if risk distance has become zero" implies. If it is negative instead, the share is clamped to 0 and the task's evidence records the value found. The third case needs a fixture Trade whose Ongoing Risk to Stop is Unavailable while Worst-Case is a Value. If D4's figures never produce that for Long Stock, the case is dropped, the basis selection is proven through the shared function's existing pressure tests, and the evidence says so.

### T5R.4 Daily Review: `getTrade` with the Plan baseline

Seam: `DailyReview.getTrade`, with the card fixture at Monday 17:00.

```text
describe("Plan baseline (P40)")
  it should return T-A's Plan baseline: 1R $250.00, original planned reward $600.00, and planned Reward : risk 12/5, with Reward : risk now 8/9 in its evaluation
```

### T5R.5 Daily Review: `save` (`SaveReviewMarks`)

Seam: `DailyReview.save`, against `fake-indexeddb`, with the card fixture at Monday 17:00, no Monday Marks, and the overview's binding from `open`.

```text
describe("SaveReviewMarks (P37, P38, A155)")
  it should save XYZ for Monday and for Friday from T-A's card in one commit, and return MarksSaved with each key's resolution, revision, and classification, equal to the stored records (AC-RESP-001)
  it should return, in the same result, the revised completion and progress, T-A's card evaluated with XYZ 52.00 (range position 9/17, Reward : risk now 8/9), and T-F's revised walked item, which shares XYZ, without the caller calling open or getTrade
  it should return the next step, preferring a card with a Missing Review-date Mark (P36): T-C, for DEF
  it should pass Market Data's Rejected issues and Conflict back unchanged and write nothing
  it should report the saved Marks with the Review part as ChangedDuringAssembly when another write lands between the commit and the assembly

describe("write gate")
  it should return RuntimeNotWritable and write nothing when the mutation-boundary readiness recheck fails
```

Red notes: that the revised Review reads only the Review-date frames, with no recovery or gap scan, is proven by request counts in T5R.13.

### T5R.7 UI: Stop-to-Target slider

Seam: `StopTargetSlider`, rendered with the range position, reasons, and figures it is given.

```text
describe("placement (P39)")
  it should place the dot at the share now and the entry tick at the share at entry, on a track running from the Stop's colour to the Target's, with no number in its visible text
  it should give the slider an image role and an accessible description stating the position in words and the Risk to stop, P&L, and Reward : risk ("53% of the way from the Stop to the Target, entry at 32%. Risk to stop $450.00, P&L …")

describe("ends and missing inputs")
  it should pin the dot at the Stop end with the pinned shape, and say "past the Stop" in its description, for a share of 0 with StopBreached; and at the Target end with "past the Target" for TargetReached
  it should show a grey track with no dot, and "Mark missing: DEF, Oct 12" as its description, when the Trade is not placed
```

### T5R.8 UI: position cards, opened in place

Seam: `ReviewView` and `ReviewCard`, with a facade test double returning the card fixture.

```text
describe("card list (A150)")
  it should render one card per walked Trade in attention order (T-B, T-C, T-F, T-A, T-E), each a heading button showing the Underlying, what remains, its band as text, and its slider, with a "Stop ◂ ▸ Target" legend above the list and no Continue to Trades
  it should show "Done · Action saved" on a card whose Marks are resolved, with no due reflection and a saved Action

describe("opening in place (A151)")
  it should open the first card that is not Done when the Review loads, calling getTrade once for it, with aria-expanded true and its figures and panels inside it
  it should, when another card's header is pressed, collapse the open card, call getTrade for the pressed one, render it inside its own list item, scroll its top into view, and move focus to its header
  it should collapse the open card, with no call, when its own header is pressed

describe("unsaved work (A156)")
  it should keep the open card open, make no call, and say "Save or discard what you entered for XYZ to leave it" when another header is pressed while a draft Mark or an entered form value is held, and report unsaved through onDirtyChange

describe("read only (A162)")
  it should open cards and show their figures, Marks, reflections, and saved Action with no input, Save Marks, Answer, Decline, or Save when the shell is not Writable
```

### T5R.9 UI: Marks panel and Save Marks

Seam: `CardMarks`, with a facade test double, inside T-A's open card unless stated.

```text
describe("rows (A153)")
  it should list the card's Review-date rows first, with "also held by T-F" on XYZ, then its earlier sessions without Marks (Friday 2026-10-09 for XYZ) under "Earlier sessions without Marks — optional", grouped by date newest first; T-F's card shows no Friday row

describe("drafts")
  it should mark a typed price and a "Can't get a price" with its reason as Unsaved, count them on Save Marks, make no call, and drop them all on Discard

describe("Save Marks (P37, A155)")
  it should send one SaveReviewMarks command with the card's Trade, the overview's binding, and every draft with its expected revision
  it should render every row, the card's figures, and every collapsed card's summary and slider from the MarksSaved result, with no open or getTrade call, and open the card's next panel that is not done (P38, A157)
  it should show each returned issue beside its row, move focus to the first, and keep every draft, when the result is Rejected
  it should show Conflict with each changed key's current resolution and keep the drafts when the result is Conflict (AC-REV-005)
  it should render the saved rows and offer Refresh, which calls open and getTrade, when the result's Review part is ChangedDuringAssembly

describe("keyboard")
  it should move focus to the next price on Enter, and from the last price to Save Marks

describe("rows with a Mark")
  it should keep D4's per-row Correct and Withdraw for a row with an exact Mark or an acknowledgment, saving through MarketData.save as today
```

Red notes: paging earlier sessions 20 at a time, with paging held while a draft exists, is D4 behavior carried over. Its existing cases move onto `CardMarks` unchanged and are not new red cases.

### T5R.10 UI: Reflections and Action panels

Seam: `ReviewCard`, with a facade test double, inside T-A's open card.

```text
describe("panels (A152)")
  it should show Marks, Reflections, and Action panels in that order, with one open at a time, each header a button with its summary and status as text ("1 due", "Needed", "Saved"), and "None" on Reflections for a card that owes none

describe("reflections")
  it should group the card's owed reflections by session date, label each group as text (Friday: D-1 "Due"; Monday: D-2 "Due in the next Review"), and resolve one with DebtForm as in D5 A71

describe("Action (A159)")
  it should open the Action panel with Hold preselected and one visible Save, which records Hold with no other input (AC-REV-003)

describe("moving on")
  it should open the next panel that is not done when a panel's work is finished, and after an Action save open the card the result names as the next step, collapsing this one
```

### T5R.11 UI: open-card figures

Seam: `CardFigures`, rendered from a `getTrade` result.

```text
describe("figures (A158)")
  it should show Current P&L, Risk to stop, Worst case, and Reward to target, each in dollars and R, then Reward : risk now 0.89 and planned 2.4, then At entry, for T-A at XYZ 52.00
  it should show each figure that is not a Value in words, never as 0: T-C's "Mark missing: DEF, Oct 12", T-B's Reward : risk "Not applicable"
  it should keep the dated last-close group (D4 P13) beside the figures when the Review-date Mark is missing
```

### T5R.12 UI: links, blockers, and next step

Seam: `ReviewView`, with a facade test double and the router.

```text
describe("links (A161)")
  it should open the first card holding XYZ in attention order on its Marks panel, with focus on XYZ's row, for /review?instrument=XYZ
  it should open T-E's card on its first panel that is not done for /review?trade=T-E

describe("header")
  it should show the Review Date, completion as text, and the blockers, with Missing Marks first, each opening the card and panel that resolve it
```

---

## 5. Structural tasks

| Task | Verification (exact) | Expected result | Behavior that depends on it |
|---|---|---|---|
| T5R.6 Capability manifest and composition | `npm run verify:capabilities` | The manifest adds `DailyReview.save` (`SaveReviewMarks`), Market Data's prepare/apply pair as an internal seam (absent from the facade), Reward : risk now in `evaluate`, the range position and gap Trades in `DailyReview.open`, and the Plan baseline in `getTrade`. Every new operation is reachable from the Review's cards, and nothing beyond D5R is. | AC-CAP-001. |
| T5R.13 Query count and latency | `npm run test:integration -- d5r/query-count`; `npm run bench:run` | A Review `open` issues exactly D5's request counts: the range position and gap Trades add no request. `SaveReviewMarks` with n entries issues one read-only snapshot with n record reads, one read-write commit with n checks and n writes, then the same post-save assembly requests as a `SaveTradeAction`, with no recovery or gap-scan request. `bench:run` adds disclosed, ungated timings on the mature dataset for "open the first card" (`open` plus one `getTrade`), a `SaveReviewMarks` of one card's Marks, and a `SaveTradeAction`, from the click to the rendered result. Results go to `evidence/D05R/bench.md`. | AC-PERF-001; P38. |
| T5R.14 Node integration suite | `npm run test:integration` | Every case in sections 6.1 of D1, D2, D4, D5, and D5R passes. | Cumulative regression. |
| T5R.15 Browser suite | `npm run test:e2e` (Chromium) | Every D4 and D5 browser case passes against the cards (section 6.3), and every case in section 6.2 passes. | Cumulative regression. |
| T5R.16 Browser critic | Fresh critic agent per section 7 | A structured report with every flow passing. | Deliverable gate. |

---

## 6. Mock-free integration tests

### 6.0 Disclosed test substitutes

D1's, D2's, D4's, and D5's substitutes still apply. D5R adds none.

### 6.1 Node application-stack suite (`tests/integration/d5r/`)

| Case | Given / When | Then (visible result and durable-state proof) |
|---|---|---|
| I5R.1 Save Marks together | Card fixture, Monday 17:00. `open`; `SaveReviewMarks` from T-A's card for XYZ Monday and Friday; then from T-C's card for DEF unavailable with a reason; restart; `open`. | Each result's resolutions and revised items equal the stored records and a fresh `open`. After restart: the Review-date Mark rows resolved, the XYZ Friday gap gone, T-C's range position not placed (acknowledged unavailable), and completion CompleteWithUnavailableMarks once Actions and D-1 are resolved. The dump has the three observation records and one acknowledgment. |
| I5R.2 Nothing or everything | (a) `SaveReviewMarks` with one invalid price among four entries. (b) The same command with a fault injected after the first `observations` write. (c) Two commands from the same binding, the second after the first commits. | (a) Issues for that entry; dump unchanged. (b) The transaction aborts; dump unchanged; a retry succeeds. (c) The second returns Conflict naming every key; one revision per key. |
| I5R.3 Shared Mark through either card | Card fixture. `SaveReviewMarks` for XYZ from T-F's card. | The result carries T-A's and T-F's revised items, both using XYZ 52.00, and no Mark-missing blocker for XYZ; a fresh `open` agrees; one observation record (AC-REV-002, "shared Mark resolves once"). |
| I5R.4 Range position and baseline end to end | Card fixture with Monday Marks; restart; `open`; `getTrade` for T-A. | Range positions and Reward : risk as in section 4's table; T-A's baseline 1R $250.00, planned 12/5. |
| I5R.5 Gap Trades | Card fixture; `open`. | XYZ's gap group names T-A from Friday and T-F from Monday; completion is not blocked by the gap (AC-MARK-004). |
| I5R.6 Write gate | Host fails the inventory check; call `SaveReviewMarks` and `MarketData.save` through the facade. | `RuntimeNotWritable` from both; dump unchanged; the Review still opens (AC-DEL-006). |

### 6.2 Browser suite (`e2e/d5r/`, Playwright against the built app on `localhost:5175`)

Chromium only (decision 19). Dates are set with Playwright's clock on the production build. Durable state is proven by reload or full browser restart plus D1's read-only probe.

| Case | Procedure | Expected observable result and durable-state proof |
|---|---|---|
| B5R.1 Review end to end on cards | Card fixture created through the UI; clock Monday 17:00. Open Review; in the first open card, type its Marks and press Save Marks; resolve D-1 in T-A's card; press Save in each card's Action panel (Hold preselected); relaunch; open Review. | The first card that is not Done opens on load. After Save Marks the card's figures and the sliders update from the result. Finishing a card opens the next one in place. After relaunch every card reads Done and the header Complete. The probe shows the Marks, the Entry with `settledDebtId`, and five Action Entries. |
| B5R.2 Opening far down the list | Card fixture plus 16 routine Trades. Scroll to the 18th card; open it. | The card opens where it is; its header and first input are in the viewport without scrolling; the previously open card is collapsed. |
| B5R.3 Shared Mark | Enter XYZ in T-F's card and Save Marks. | T-A's collapsed card's slider moves at once; opening it shows XYZ saved with "also held by T-F"; one observation in the probe. |
| B5R.4 Invalid price saves nothing | Type three prices, one of them "abc"; Save Marks; fix it; Save Marks. | The first save shows the issue beside that row with focus on it, every draft is kept, and the probe shows no observation; the second saves all three. |
| B5R.5 Unsaved work holds the card | Type a price; press another card's header; Discard; press it again. | The card stays open with the message; after Discard the other card opens. Nothing is written (AC-JOUR-001). |
| B5R.6 Missing-Mark link | From the Open list, follow T-C's "Mark missing" link. | The Review opens with T-C's card open on its Marks panel and focus on DEF. |
| B5R.7 Slider states | Card fixture with Monday Marks except DEF. | T-A's dot right of its entry tick; T-B's dot pinned at the Stop end with the pinned shape; T-C's track grey with no dot; each slider's accessible description as T5R.7 states. |
| B5R.8 Changed evidence | Open T-A's card; in a second tab save XYZ; in the first type XYZ and Save Marks. | Conflict shown with the other tab's value; the draft kept; nothing written by the first tab (AC-REV-005). |
| B5R.9 Kill after Save Marks | SIGKILL right after the rows render from the result; relaunch. | The Marks are present; the card shows them saved. |
| B5R.10 Offline and Recovery Only (*faults build*) | Relaunch offline and Save Marks; then relaunch with `?faults=control`. | Offline: saves and survives restart (AC-DEL-001). Recovery Only: cards open read only, with no inputs or Save buttons; probe unchanged. |
| B5R.11 Responsive and accessible | Half-fill drafts at 1280 px; resize to 390 px and back; run axe on the card list, an open card with each panel open, and the slider; complete one card with the keyboard only. | Drafts and the open panel survive; the slider moves to its own row at narrow width; no WCAG 2.1 AA violations; band, status, and "Unsaved" are text; focus is visible throughout (AC-UI-001, AC-UI-002). |

### 6.3 Moving the D4 and D5 browser cases onto cards

The D4 and D5 browser cases keep their procedures and expectations, with the layout steps changed:
- "Continue to Trades" and "Review XYZ" become opening XYZ's card.
- Marks entered in the Marks family become drafts in the card's Marks panel saved with Save Marks.
- "The Marks family first" becomes "the card opens on its Marks panel".

The change is made once, in `e2e/d4/support.ts` and `e2e/d5/support.ts`, plus the specs that use the button by name: `review.spec.ts` and `responsive-a11y.spec.ts` in `e2e/d4`. No D4 or D5 expectation about saved data, completion, or durable state changes. The unit tests of the retired views (`ReviewView.test.tsx`'s Marks family and Continue to Trades cases, and `ReviewTrade.test.tsx`'s placement cases) are replaced by T5R.8–T5R.12. `MarkEntry`, `DebtForm`, and `ActionForm` keep their tests.

---

## 7. Browser-critic flows

The critic receives the frozen `specs/`, the plan index, the D1, D2, D4, D5, and D5R breakdowns, plan decision 61, and the list of future capabilities that must not be treated as defects (everything after D5R, including exits and Closed Trades, options, multi-leg structures, and automatic prices).

| Flow | What the critic checks |
|---|---|
| C5R.1 Cards in place | With 20 positions, open cards near the top, middle, and end. Each opens where it is, with no scrolling, and the previous card collapses. |
| C5R.2 A card's work in order | In one card: Marks, then reflections, then Action. Each panel shows a summary and status as text. Finishing one opens the next. Finishing the card opens the next card that is not Done. |
| C5R.3 Save Marks | Drafts are marked Unsaved. Save Marks saves all of them and the figures update at once; an invalid price saves none and is explained beside its row; Discard drops them. |
| C5R.4 Shared Mark | A Mark entered in one card shows as saved in the other card holding the same Instrument, whose slider moves with it. |
| C5R.5 Slider | Placed, pinned past the Stop, and grey for a missing Mark. The legend is present. The description, read with the accessibility tree, gives the numbers. |
| C5R.6 Figures | The open card shows Risk to stop, Worst case, Reward to target, and Reward : risk now and planned, with words, not zeros, when a figure is unavailable. |
| C5R.7 Hold | The Action panel opens with Hold preselected, and one Save records it. |
| C5R.8 Leaving and links | Unsaved work holds the card. Missing-Mark links from the Open list and Trade Detail open the right card and panel. |
| C5R.9 Narrow, keyboard, Recovery Only | 375 and 320 px with no horizontal scroll; a whole card completed by keyboard; Recovery Only cards read only. |

---

## 8. Acceptance

D5R adds no acceptance row. It re-proves, on the new screen:

| Row | Re-proven by |
|---|---|
| AC-REV-002 (amended by P36: work order inside each card; shared Mark once; resumption) | T5R.5, T5R.8, T5R.10, I5R.3, B5R.1, B5R.3, C5R.2, C5R.4 |
| AC-REV-003 (one-click Hold still requires Save) | T5R.10, B5R.1, C5R.7 |
| AC-REV-005 (changed evidence prevents stale Save) | T5R.1, T5R.5, T5R.9, I5R.2, B5R.8 |
| AC-REV-006 (completion honest) | T5R.5, I5R.1, B5R.1 |
| AC-MARK-004 (historical gaps do not block) | T5R.3, I5R.5 |
| AC-RESP-001 (result sufficient to render) | T5R.1, T5R.5, T5R.9, I5R.1 |
| AC-JOUR-001 (nothing saved without Save) | T5R.9, B5R.5 |
| AC-UI-001, AC-UI-002 (responsive, accessible) | T5R.7, B5R.11, C5R.9 |
| AC-DEL-001, AC-DEL-006 (offline; write gate) | T5R.5, I5R.6, B5R.10 |
| AC-PERF-001 (bounded requests) | T5R.13 |

The acceptance matrix's AC-REV-002 row gains a note naming plan decision 61.

---

## 9. Changes to other breakdowns, once D5R is agreed

| Breakdown | Change |
|---|---|
| D4 | A48 (figures update on Continue to Trades), A57 (the Marks family first), and A60 (links to the Marks family) are superseded by P38, A150–A153, and A161. A note is added to each; the text is kept. |
| D5 | A71 (reflections above the Action form in the Trade card) is superseded by A152's Reflections panel. A67's post-commit Review result now also serves `SaveReviewMarks`. |
| D6 | P20 and A90: the owed-reflection group renders as the same cards, after the walk, with a Reflections panel and no Action panel. A94: Record the exit sits in the card's Action panel; its **Refresh Review** after the exit stays a call to `open`, because the exit is a Trade Workflows save, not a Review save. T6.20's cases are rewritten against `ReviewCard`. D6's handoff names D5R's tag as its starting point. |
| D7 | Settlement Due, when D7 adds it, is a panel between Reflections and Action in the card (P36's work order). |
| D10 | A multi-leg card's Marks panel lists one row per leg under each date, and Save Marks saves every leg in one commit (P37). |
| D11 | Provider Marks arrive filled in each row with their Source. Override joins the per-row actions; if Override is later wanted inside Save Marks, it becomes another prepared entry intention. A card whose Marks all arrived opens on its first panel that is not done. |
| Tech debt | Item 3 (the Review's open cost grows with history) stays open. D5R takes it off the save path (P38) but not off the first `open` of each Review. T5R.13's timings give it a measured baseline. |

---

## 10. Before work starts

1. ~~The user agrees or amends P36–P41 and A150–A163.~~ Done: all agreed on 2026-10-31.
2. **Plan revision 20:**
   - plan decision 61, naming the reopened passages: Daily Review "Date, eligibility, and ordering" and AC-REV-002's family order (P36); Daily Review `save`'s two commands and the Market Data interface (P37);
   - D5R in the deliverable summary between D5 and D6;
   - tag `claude-opus-5.5-plan-r20`.
3. **Spec map:** retag the Daily Review, Market Data, and UI contract sections for D5R in `plan/spec-map.md`, then regenerate the reading lists with `.claude/scripts/spec-reading-lists.py` (decision 45).
4. **Handoff:** write `plan/D05R-handoff.md`, and point the D6 handoff at D5R's tag.

---

## 11. Evidence recording

As for D5, under `evidence/D05R/`:
- one structural file;
- ocr output per task;
- suite runs;
- `bench.md`;
- the critic report.

The first suite run records the D4 and D5 browser cases moved onto cards (section 6.3) before any D5R case is added. That run shows the move changed no expectation.
