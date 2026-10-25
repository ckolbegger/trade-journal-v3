# D6 — Close a Long Stock position: task breakdown

Definition: [implementation plan, D6](implementation-plan.md#d6--close-a-long-stock-position). The definition (stories, capability set, introductions, acceptance claims) stays there and is not repeated here. D6 builds on D2's opening facts, Lots, Entry window, Entry Size, and Deviation reconciliation (D2 A18–A28, T2.1–T2.6); D4's schema-3 layout (A38), `evaluate` (A41), eligibility query (A55), Action form (A58), and Review (T4.14–T4.16); and D5's schema-4 Debt record (A61), due rule (P16, plan decision 28), in-card reflections (P17, plan decision 29), and resolution paths (A64, A65) ([D5](D05-deferred-reflection-and-journal-debt.md), [D4](D04-daily-review.md), [D2](D02-open-a-long-stock-position.md), and [D1](D01-start-a-workspace-and-confirm-a-long-stock-plan.md) breakdowns).

Status: **breakdown agreed by the user on 2026-10-17.** Decisions P19 and P20 were agreed on 2026-10-11 and P21–P23 on 2026-10-17. P23 reopens part of the spec at the user's explicit direction (plan decision 30). The amendments in section 1.2 were agreed on 2026-10-17 and applied to the plan index. The breakdown was agreed on 2026-10-17 (the plan as a whole is still a draft). Everything else is written against those decisions and the working assumptions listed below.

---

## 1. Decisions and clarifications

### 1.1 Decisions for this breakdown

Numbering continues from D5's P16–P18.

| # | Question | Decision | Alternatives and tradeoff |
|---|---|---|---|
| P19 | **Positions closed during the session, in the Review.** The user's direction (D5, P17) is that the Review is "a daily ritual where the trader looks at every open position as well as any positions closed today." The spec makes only Trades Open at the session's close eligible: "Eligible Trades are those whose corrected effective facts place stored/verified Lifecycle State at `Open` at that cutoff—not those open today" (Daily Review, "Date, eligibility, and ordering"). The overview's "Open and save Daily Review" queries "Trades that were Open at its cutoff", and AC-REV-001 requires "Open-at-cutoff corrected facts, not current Open membership". A Trade closed at 14:00 is therefore not eligible for that day's Review, and a Daily Trade Review Action (Hold, Exit, Roll, Adjust) has no meaning for a flat Trade. | **Agreed 2026-10-11, without reopening the spec.** The user's direction: "A closed trade should always require a closing reflection. It should be enterable in the trade execution step, or deferable to the daily review. Any trade with a deferred reflection should be included in the daily review." So eligibility stays as the spec defines it, and a closed Trade appears in the Review **through its owed reflections**, not as a walked Trade: after the walk, every Trade outside it with an Outstanding reflection gets a card (P20). A close whose Close Review and exit reflection were completed or declined in the exit form has nothing left to review and does not appear; it is on the Closed list. "Always require" means the Close Review obligation always gets an explicit outcome, as the spec already requires. **Decline stays available** (user's choice, 2026-10-11): the spec allows completion, deferral, or decline (Journal, Close Review and `prepareEffects`; AC-POS-004), and a reflection the trader will never write can be cleared instead of blocking every later Review. | (a) A "Closed this session" group showing every close of the session, owed or not (offered; the user chose owed ones only). (b) Reopen the eligibility rule so closed Trades are walked and need an Action: needs an Action meaning for a flat Trade and changes AC-REV-001. (c) Remove Decline from the Close Review (offered; rejected by the user): reopens the Journal passages and AC-POS-004. |
| P20 | **Where does an owed reflection appear when its Trade is not in the walk?** Under plan decision 29 owed reflections live in Trade cards, and `getDebt` is not installed. From D6 a Debt can belong to a Trade that is not walked: a Trade closed during or before the session, or one opened after the close. | **Agreed 2026-10-11, as part of P19's answer: one "Trades with owed reflections" group after the walk.** Every Trade outside the walk with at least one Outstanding reflection, **due or not yet due**, gets a card (A89). Cards with a due reflection come first, then by oldest owed anchor, then Trade identity. Each card has the Trade's summary for its lifecycle and the same Reflections section as walked cards (D5 A71). Due reflections block completion; later ones are optional and can be answered now. So a Close Review deferred at a Tuesday 14:00 close appears in Tuesday's Review, where it can be answered, and becomes due, and blocking, in Wednesday's (P16). `getDebt` stays uninstalled, because every Outstanding Debt has a Trade card, as decision 29 requires. | (a) Show only Trades with a **due** reflection, leaving not-yet-due ones to Trade Detail: smaller group, but the trader could not defer a Close Review "to the daily review" the same evening. (b) Install `getDebt` and show one flat list of due reflections: brings back the separate family that decision 29 removed. |
| P21 | **Close Review default, and two reflections in one exit form.** A terminal exit carries two Journal obligations with different keys: the Position Change Reflection on the exit decision, and the Close Review on the whole Trade (Trade Workflows, `recordPositionChange`). The spec permits preselecting Defer for both, provided the command carries each disposition explicitly. P18 preselected Reflect now for the Position Change Reflection "to encourage traders to do it right away". | **Agreed 2026-10-17: Reflect now for both, each with its own disposition group.** The exit form shows the Executions, then **Reflection on this exit** (the Position Change Reflection, as in D5 A70), then, once the entered quantities close the Trade, a **Closing the Trade** section with the Close Reason radio group and **Close Review** with its own Reflect now / Reflect later / Decline to reflect group, Reflect now selected. One Save submits both dispositions; issues from both forms return at once. Choosing Reflect later on either submits `Defer` for that obligation only. | (a) Close Review defaults to Reflect later: keeps the closing form short when the trader is busy, but the Trade-level lesson is the reflection most worth capturing while fresh. (b) Ask for the Close Review only, and default the exit's Position Change Reflection to Reflect later on a terminal exit: one fewer form, but the exit decision's own reflection (mode, emotion, confidence) is then usually deferred. |
| P22 | **Oversell and other impossible position paths.** Long Stock has no short role. A Sell above the open quantity would reverse into a short position no Planned Leg covers. Out-of-order recording (plan decision 21) adds two more impossible paths: an earlier-dated Sell can exceed what was open *at its own time*, or leave the Position flat at a point that later fills reopen. | **Agreed 2026-10-17: reject all three with typed no-write issues, and reject any Position Change on a Closed Trade.** Replaying the candidate in Fact Order, the open quantity must never go below zero (`ExceedsOpenQuantity`, naming the quantity available at that point) and may reach zero only at the last fact (`FlatBeforeLaterFacts`). A Position Change on a Trade whose stored lifecycle is Closed returns `TradeClosed`, explaining that new exposure needs a new Plan; a missed fill on a Closed Trade waits for correction (D15) or Rebuild (D18). Together these make every terminal change the Trade's last fact, so a Close Reason and Close Review can never be stranded on a change that later stops being terminal. | (a) Allow a Sell to reach zero and reject only the excess: the same as recommended for in-order entry, but leaves the two out-of-order paths open. (b) Accept a Closed Trade's earlier-dated entry and reopen the Trade: needs retiring the Close Reason and Close Review, which only correction semantics (D15) define. |
| P23 | **Earlier-dated exits re-run FIFO (plan decision 21).** An exit recorded after a later-dated one, or before a later opening fill, changes which Lots each Sell consumed, and therefore the Lot Matches, fee allocation, and realized P&L of existing exits. The spec stores active Lot-Match links as agreed records that every commit keeps in agreement with analysis (Trade Record, "Contract": "It persists only facts plus the agreed records … stored Lifecycle State, active Lot-Match links, and recorded Deviation occurrences"). | **Agreed 2026-10-17, reopening the spec at the user's explicit direction: Lot Matches are derived, never stored.** Matching order does not change any Closed Trade's total realized P&L, Realized R, or fees; it only splits a partly closed Trade's P&L between realized-to-date and open marked P&L, and times the realization increments of D24's cumulative curve. Those still follow FIFO, as the glossary requires, but stored links can hold nothing the Executions do not already determine. So Trade Analysis derives the FIFO matches, fee allocation, and realized P&L from the effective Executions every time they are needed (A78), for Open and Closed Trades alike, and Trade Record stores no Lot-Match record. A match is identified by (opening Execution, disposing Execution, FIFO), which is stable while the facts are unchanged. An earlier-dated exit simply changes the derived result; the receipt shows the changed matches and the realized P&L before and after, alongside D2's Entry Resolution Point and Entry Quality disclosures. **Reopened passages:** Trade Record's "Contract" (persisted agreed records), "Record content" ("active recorded Lot Matches"), "Change protocol" (`applyPreparedChange` staging Lot Match effects), and "Backup and Restore" ("Lot-Match/Deviation history"); the overview's authority map row "Lot matching" and load-bearing rule 5's list of atomically persisted effects; ADR 0002's "Lot Match set"; Workspace and Trade Analysis rederiving Lot Matches for agreement during Restore; the delivery contract's rebuild-equivalence item "active FIFO Lot Matches" (now a derived result, not a rebuilt record); and AC-LIFE-003's Lot-Match agreement case. Recorded as plan decision 30. The `specs/` files are not edited. FIFO usually agrees with a broker's default cost basis, but can differ when the broker pools one symbol across Trades in an Account, applies wash-sale adjustments, or uses specific-lot identification. | (a) Keep the spec: store the links and reconcile them by fingerprint on every commit (create, retain, new version, supersede), the earlier recommendation. Most faithful, but adds a schema field, reconciliation, three agreement findings, and a fixture case for no visible benefit. (b) Drop matching entirely (average cost or totals only): reopens far more (glossary FIFO and Open Lot, lot-aware fees, AC-POS-001, the Outcomes curve), and a partly closed Trade still needs some method. (c) Reject earlier-dated exits until D15. |

### 1.2 Amendments to other plan sections (agreed 2026-10-17 and applied to the plan index)

- **Not Entered moves from D6 to D10.** Trade Analysis defines Not Entered as applying "to an untouched leg when a partially executed Trade ends", and Entry Size calls it "the untouched-leg zero form". A Long Stock Plan has exactly one Planned Leg, so if that leg is untouched the Trade was never entered and cannot close. The same holds for D7's single-leg options. Not Entered first becomes reachable with multi-leg Strategies. D6 therefore claims AC-POS-005 for **Entry Size shortfall** only. Edits: the D6 definition's acceptance line and Trade Analysis line, and D2's AC-POS-005 line ("Not Entered is completed in D6" becomes D10). AC-POS-005 is already marked full in D10.
- **AC-REV-001's "one later closed" is covered in D6, for the latest session.** D4's acceptance line says "Trades closed after the cutoff … are completed in D15", while D4 A55 and the review queue say D6 must extend `StateAtEconomicCutoff`. D6 does the extension (A88) and adds AC-REV-001 (partial) to its acceptance list. D4's line is edited so that D15 keeps only exact-date open and restatement after correction.
- **AC-CALC-002 gains a partial claim in D6.** Its "known realized-to-date P&L" first exists here; D6 proves it stays a Value beside a Missing Mark for one Instrument (I6.16). The multi-Instrument case stays in D10.

### 1.3 Working assumptions

Numbering continues from D5's A61–A75. These are implementation-level choices that do not reopen product semantics. They stand unless you object.

| # | Assumption |
|---|---|
| A76 | **Sell Executions in D6:** on the Plan's Stock Instrument, serving its single Planned Leg, in one Trade. Quantity, price, fee, and Economic Time follow D2 A18 and A19. All members of one Position Change share one action, Buy or Sell; a mix returns `VariantNotInstalled`. A Position Change's Economic Time is still its earliest member's (A19). |
| A77 | **Trader agency and the Close Reason:** every Execution, Buy or Sell, carries trader agency. A terminal Position Change made of Executions therefore requires exactly one Close Reason resolved as `NewSelection` (`CloseReasonRequired` when absent; Catalog's `NotFound`, `WrongKind`, or `InactiveForRequestedUse` otherwise). A Close Reason on a non-terminal change returns `CloseReasonNotApplicable`. Non-agency settlement arrives in D7 and needs no reason. |
| A78 | **Derived Lot Match (P23):** `derive` returns each match as `{ openingExecutionId, disposingExecutionId, quantity, policy: FIFO }`, identified by its first three fields' identities and the policy. Its allocated fees and realized amount are separate Calculation Results keyed to it, so no price or P&L is copied onto the link (AC-POS-001). Nothing about matching is stored, versioned, reconciled, or backed up; every read, commit, migration, and later Restore derives it from the effective Executions. |
| A79 | **FIFO:** opening Lots are consumed in Fact Order (Economic Time, then Recorded Sequence). A Position Change's Sell Executions dispose in Fact Order, and one Execution consumes as many Lots as it needs, oldest first. Each Lot is still one opening Execution (A22). |
| A80 | **Lot-aware fees, exact:** a Lot's opening fee is allocated to each Lot Match in proportion to matched quantity over the Lot's original quantity; the unconsumed remainder stays with the Lot and reduces marked P&L (A41). A Sell Execution's fee is allocated across its Lot Matches in proportion to matched quantity. Realized P&L of a Lot Match is `q × (sell price − buy price) − allocated opening fee − allocated disposal fee`. Everything stays a BigInt rational; presentation rounds to cents only for display, and Trade Detail notes that displayed per-match amounts are rounded. Incurred fees remain the plain sum of Execution fees, never subtracted again. |
| A81 | **Realized results from `derive`:** each expected Lot Match with its matched quantity, allocated fees, realized amount, and the disposing Execution's Economic Time; realized-to-date at the cutoff; remaining Lots with unconsumed opening fees. **Realized R** is net realized P&L ÷ 1R for a Closed Trade (a Value, since every D6 Trade has a positive 1R) and `NotApplicable(NotClosed)` while Open. |
| A82 | **Entry window cutoff (extends A23):** the window ends at the Position Change after which the leg's entered quantity first reaches its planned quantity, or immediately before the first Sell, whichever comes first. A window cut by a Sell resolves with the quantity entered so far. Entry Quality uses A24's formulas over that window. Fulfillment is FilledWithDeviation whenever an Entry Size occurrence is active (A25). |
| A83 | **Entry Size shortfall:** one occurrence per leg, fingerprint (Trade, leg, Shortfall), holding the planned quantity minus the entered quantity at resolution, the cutting Sell's Position Change as its cause, and that change's Economic Time. It is reconciled like Excess occurrences (A26): an earlier-dated Buy that completes the plan before the cutoff supersedes it; one that narrows it appends a new version. |
| A84 | **Terminal Disposition:** derived only for a Closed Trade, as a list of mechanisms with quantities. In D6 the only mechanism is `Executions` (shown as "Closed via sale of 100 shares"). Open Trades get `NotApplicable(NotClosed)`. It is never stored and is never the Close Reason (ADR 0003). |
| A85 | **Close Reason fact:** a Trade fact identity with a single-version list (decision 11), holding the Catalog identity and the terminal Position Change's identity. It takes the next Recorded Sequence after the terminal change's members. |
| A86 | **Close Review obligation:** key `['CloseReview', tradeId]`, separate from the exit's `['PositionChangeReflection', positionChangeId]` (Journal, "Debt and obligation semantics"). Its Entry, decline, or Debt has a Trade Anchor, Source Trade Close, origin the terminal Position Change, and moment time that change's Economic Time. A Debt's due anchor is the same instant under `OneSessionGrace` (P16), so a Close Review deferred at a Monday close is due in Tuesday's Review. Resolution reuses D5's core (A64, A65), recording Source Daily Review or Trade Detail. |
| A87 | **Storage (schema version 5), extending A62:** Trade documents gain Close Reason facts and `terminalTime` (the terminal Position Change's Economic Time, present only while Closed, maintained by every commit like `exposureStart` and recomputed by migration and private rebuild). No Lot-Match record is stored (P23). A new sparse `trades` index `byLifecycleTerminal` on `[lifecycle, terminalDesc, tradeId]`, where `terminalDesc` is a descending sort key present only on Closed Trades, serves the Closed list (Terminal Time descending, Trade Record's fixed sort) and the Review's closed-after-cutoff read (A88). Close Review outcomes use the existing Journal stores and `journalObligations`. Every index stays private and rebuildable. |
| A88 | **`StateAtEconomicCutoff(Open, cutoff)`, extended (resolves D4 A55):** Open Trades whose `exposureStart` is at or before the cutoff, plus Closed Trades whose `exposureStart` is at or before the cutoff and whose `terminalTime` is after it. The second set is one `getAll` on `byLifecycleTerminal` over terminal times after the cutoff, which for the latest Review is only the closes since that session's close. Daily Review still confirms each by deriving at the cutoff. |
| A89 | **Trades with owed reflections (P19, P20):** `open` already reads every Outstanding Debt once (D5 A63). The Trades those Debts are anchored to, minus the walked Trades, form the group. Daily Review reads them with `getRecord` by identity in its one read transaction: one request per Trade, bounded by the number of Trades with Outstanding Debt, not by Trade count or history. Cards with a due reflection come first, then by oldest owed anchor, then Trade identity. No new Trade Record query is needed. |
| A90 | **Review cards (extends D5 A68):** `open` returns the walk, then the owed-reflection group. `getTrade` returns a card of kind `Walked` (D4 and D5 content) or `ReflectionsOwed`. A `ReflectionsOwed` card carries the Trade summary for its lifecycle (Closed: realized P&L, Realized R, Terminal Disposition, Close Reason, Close Review outcome; Open: Position and entry status) and its Outstanding reflections with forms and save bindings, and no Action form or evaluation. It is done when it has no due reflection. The next step after a save is the first card not done, in walk order and then group order. When no Trade is eligible and no reflection is due, `open` returns Empty, as the spec defines it, with the owed group attached so not-yet-due reflections can still be answered. |
| A91 | **Walked Trade closed after the cutoff:** its card shows "Closed after this session's close" with its current lifecycle, keeps the Action form (it is eligible), and evaluates at the cutoff as before. A Trade's exits after the cutoff are excluded from that evaluation, so its Review-date figures still describe the Position held at the close. |
| A92 | **`evaluate` with realized-to-date (extends A41):** realized-to-date is the sum of the Lot Matches realized at or before the cutoff, as a Value, independent of the Mark. Current Marked Trade P&L is realized-to-date plus remaining-open marked P&L. Risk, reward, worst case, and Overrun use the remaining Position only. Exits after the frame's close never cause `AwaitingClose`: the remaining shares existed at that close, and only Lots opened after it do (A54). A Closed Trade has no current figures (`NotApplicable(NoRemainingPosition)`) and requires no Mark. |
| A93 | **Exit form:** Open Trade Detail offers **Record exit** beside Record entry. It reuses the Position Change form with action Sell fixed (A33), the exit's reflection disposition (D5 A70), and the Closing the Trade section (P21). The section appears when the entered Sell quantities total the open quantity shown on Detail, a presentation hint only. The workflow decides: a terminal submission without the section returns `CloseReasonRequired` and `CloseReviewDispositionRequired`, and the form then shows the section with those issues. The Close Reason group lists the selectable reasons from `ReferenceCatalog.query`. |
| A94 | **Exit link from the Review (resolves D4 A58):** once an Exit Action is saved for a Trade that is still Open, its card offers **Record the exit**, opening the exit form in context over the Review with nothing prefilled except the Trade. After Save, the card shows the recorded exit from the result and offers **Refresh Review**, which calls `open` (as D4 A48). Saving the Action itself still creates no Trade fact (AC-REV-003). |
| A95 | **Closed list:** a Closed tab joins Open and Planned (A32), pages of 50, Terminal Time descending. Each row shows the symbol, Strategy, Account, net realized P&L with sign, Realized R, "Closed via sale", Close Reason, close date in the Workspace zone, Deviation count, a "Reflection owed" indicator, and the integrity indicator. No Market Data is read. |
| A96 | **Agreement on Closed Trades:** with Lot Matches derived (P23), the only stored agreed record a close adds to is Lifecycle State. D2's `LifecycleDisagreement` covers a Closed Trade whose stored lifecycle is Open, or the reverse. Reads surface it (AC-LIFE-003). A Trade mutation would repair it (plan decision 23), but any Position Change on flat facts is rejected (P22), so the disagreement stays visible until a migration or Restore (D8) repairs it. `terminalTime` is a private index key and is rebuilt, never reported as a finding. |
| A97 | **Previous release:** the harness builds the D5 release from the tag `claude-opus-5.5-d5`, exported with `git archive` and never as a worktree (D2 A34). |
| A98 | **Fixture views across schemas (extends A73):** a Workspace migrated from schema 1 to 4 has no exit, Close Reason, Close Review, or Closed Trade. Its Closed list is Empty, every Trade's derived Lot Matches are empty and realized-to-date is $0.00, and every earlier field equals the fixture's snapshot. |

### 1.4 Benchmark dataset at D6

D6 is the first deliverable that can produce the mature profile's Closed Trades, so the generator grows from the D5 scale to nearly the full profile ([D1 section 1.3](D01-start-a-workspace-and-confirm-a-long-stock-plan.md#13-mature-dataset-profile-agreed-with-p1)). The generator version is bumped.

| Record kind | Count at D5 | Count at D6 | Mature profile |
|---|---|---|---|
| Trades | 25,000 (200 Open, 24,800 Planned) | 25,000: 24,700 Closed, 200 Open, 100 Planned | 24,700 Closed, 200 Open, 50 Planned, 50 Abandoned (Abandoned in D14) |
| Position Changes | 400 | about 100,000: 1–3 entries and 1–3 exits per Closed Trade, averaging 4 | 100,000 |
| Executions | about 800 | about 200,000 (1–3 per Position Change, averaging 2) | 200,000 |
| Close Reasons | — | 24,700: Target Reached 30%, Stop Triggered 35%, Thesis Invalidated 15%, Time-Based Exit 20% | 24,700 |
| Position Change Reflection outcomes | 400 | about 100,000, split as D5 section 1.4 | 100,000 |
| Close Review outcomes | — | 24,700, split with the same fractions as D5 section 1.4 | 24,700 |
| Marks, Daily Trade Review Actions | as at D5 | as at D5, now over a book that turns over: about 100 Open on an average session, rising to 200 by the as-of date | 190,000; 126,000 |

The generator still simulates session by session through the production facade (D4 section 1.3). Each session it confirms about 20 Plans, records their entries, records exits so that about 20 Trades close, saves Marks and Actions, and resolves the reflections that fall due (D5). Average holding time is about five sessions. At this scale generation takes several hours; it runs once per generator and schema version and is cached. The as-of instant, every count, and the identities of the as-of Review's walk and owed-reflection group are recorded in `bench/dataset.json`.

---

## 2. Implementation boundaries added or extended in D6

| Canonical boundary | Code location | D6 operations |
|---|---|---|
| Trade Analysis (pure) | `src/domain/trade-analysis/` | `derive` extended: Sell replay, FIFO Lot Matches, lot-aware fees, realized P&L, Realized R, expected Closed lifecycle, terminal time, Terminal Disposition, close requirement, position-path checks (P22), Entry window cutoff, Entry Size shortfall; `evaluate` with realized-to-date |
| Trade Record | `src/modules/trade-record/` | Sell members, Close Reason fact, `terminalTime`, Closed index membership; `queryRecords` (`CurrentState` Closed; `StateAtEconomicCutoff` extended); section validator extended |
| Reference Catalog | `src/modules/reference-catalog/` | seed manifest v2 (four Close Reasons); `query` and `resolve` for the Close Reason family; section validator extended |
| Journal | `src/modules/journal/` | seed manifest v5 (Close Review type and definition, Trade Close Source); Close Review Complete, Decline, Defer; resolution of Close Review Debt |
| Trade Workflows | `src/coordinators/trade-workflows/` | `recordPositionChange` (reduce and close; Close Reason; Close Review dispositions; P22 rejections; P23 disclosure) |
| Daily Review | `src/coordinators/daily-review/` | `open` with the extended eligibility and the owed-reflection group; `getTrade` card kinds; `save` next step across the walk and the group |
| Trade Views and Reporting | `src/coordinators/trade-views/` | `browseTrades` (Closed); `getTradeDetail` (Closed; Open with Lot Matches and realized-to-date) |
| Workspace | `src/coordinators/workspace/` | migration to schema 5; Catalog manifest v2 and Journal manifest v5; Installed Capability Manifest v5 |
| Persistence/Transaction (internal) | `src/persistence/` | schema v5 layout |
| Migrations | `src/persistence/migrations/` | `v4→v5` and the `v1→…→v5` chain |
| UI | `src/ui/` | exit form, Closed tab and list, Closed and Open Trade Detail additions, Review owed-reflection cards, Exit link |

---

## 3. Task graph

Kind: **B** = behavioral (TDD, red→green per case), **S** = structural (exact verification).

| Task | Title | Layer | Kind | Blocked by | Public seam under test |
|---|---|---|---|---|---|
| T6.1 | Trade Analysis: Sell replay, FIFO Lot Matches, fees, realized P&L | domain | B | D2 T2.1 | `TradeAnalysis.derive` |
| T6.2 | Trade Analysis: Closed lifecycle, Terminal Disposition, Realized R, close requirement, position paths | domain | B | T6.1 | `TradeAnalysis.derive` |
| T6.3 | Trade Analysis: Entry window cutoff and Entry Size shortfall | domain | B | T6.2, D2 T2.3 | `TradeAnalysis.derive` |
| T6.4 | Trade Analysis: `evaluate` with realized-to-date | domain | B | T6.1, D4 T4.10 | `TradeAnalysis.evaluate` |
| T6.5 | Persistence: schema v5 and the `v4→v5` transform | persistence | B | D5 T5.1 | internal `Persistence` interface, migration transform |
| T6.6 | Trade Record: close facts, Closed index, queries | domain/persistence | B | T6.3, T6.5 | `TradeRecord` |
| T6.7 | Reference Catalog: Close Reasons | domain/persistence | B | T6.5 | `ReferenceCatalog.seedDefaults`, `query`, `resolve` |
| T6.8 | Journal: Close Review | domain/persistence | B | T6.5 | `Journal.seedDefaults`, `prepareEffects`, `save` |
| T6.9 | Section validators: Trade Record and Catalog | domain | B | T6.6, T6.7 | `validateSection` |
| T6.10 | Trade Workflows: `recordPositionChange` (reduce and close) | application | B | T6.6–T6.8 | `TradeWorkflows.recordPositionChange` |
| T6.11 | Daily Review: `open` | application | B | T6.6, T6.8 | `DailyReview.open` |
| T6.12 | Daily Review: `getTrade` card kinds | application | B | T6.11 | `DailyReview.getTrade` |
| T6.13 | Daily Review: `save` across the walk and the group | application | B | T6.12 | `DailyReview.save` |
| T6.14 | Trade Views: Closed list and Detail; Open Detail with Lot Matches | application | B | T6.4, T6.6–T6.8 | `TradeViewsAndReporting` |
| T6.15 | Workspace: migration to schema 5 | application | B | T6.5, T6.7–T6.9 | `Workspace.initialize` |
| T6.16 | Installed Capability Manifest and composition root for D6 | application | S | T6.10–T6.15 | `verify:capabilities` |
| T6.17 | UI: exit form | UI | B | T6.16 | `PositionChangeForm` |
| T6.18 | UI: Closed tab and list | UI | B | T6.16 | `TradeList` |
| T6.19 | UI: Trade Detail closing additions | UI | B | T6.16 | `TradeDetail` |
| T6.20 | UI: Review owed-reflection cards, Exit link | UI | B | T6.17 | `ReviewView`, `ReviewTrade` |
| T6.21 | Release harness: previous release from the `claude-opus-5.5-d5` tag | test | S | D5 T5.18 | `build:releases`, `verify:releases` |
| T6.22 | Capacity basis recomputed for schema 5 | test/infrastructure | S | T6.16 | `measure:capacity`, `verify:capacity` |
| T6.23 | Freeze the schema-v5 fixture; migrate the v1–v4 fixtures | test | S | T6.15, T6.16 | `fixtures:freeze`, `verify:fixtures` |
| T6.24 | Benchmark generator: closing the book | test | S | T6.16, D5 T5.21 | `build:bench`, `bench:generate` |
| T6.25 | Latency harness and query-count proof, extended | test | S | T6.24 | `bench:run`, `test:integration -- d6/query-count` |
| T6.26 | Node mock-free integration suite | test | S | T6.16 | `test:integration` |
| T6.27 | Browser integration suite (Chromium) | test | S | T6.17–T6.23 | `test:e2e` |
| T6.28 | Independent browser-critic gate | test | S | all | fresh critic report |

**Parallel tracks.** Once the close command, the Closed Detail and list read models, and the Review card kinds are fixed in T6.16's type module, four tracks proceed in parallel:
- **Trade Analysis** (T6.1–T6.4).
- **Persistence, Trade Record, Catalog, and Journal** (T6.5–T6.9, T6.15).
- **Coordinators** (T6.10–T6.14), joining the first two as their tasks land.
- **UI** (T6.17–T6.20), against the facade test double.

---

## 4. Behavioral tasks

Every case runs **red → green** individually, as the kickoff prompt requires. A case that passes on its first run, or fails for a syntax, configuration, fixture, or unrelated reason, is not valid red evidence; it must be fixed and rerun to a genuine red, never logged and skipped. Cases are ordered so that each one targets behavior the previous cases did not need. Properties that would pass for free are folded into the case that creates them or proven only by an integration case, and each such fold is named below.

**Reference Trade T-A** (D2's, symbol XYZ): Long Stock, Plan for 100 shares, intended entry 50.00, Stop 47.50, Target 56.00 (1R $250), Plan Economic Time Monday 2026-10-12 09:00 America/New_York. **PC1** Monday 10:00, 60 @ 50.10, fee 1.00; **PC2** Monday 11:00, 40 @ 50.30, fee 1.00. Exits:
- **X1** Tuesday 2026-10-13 10:00, one Execution, Sell 30 @ 52.00, fee 0.60.
- **X2** Tuesday 14:00, one decision with two Executions: **X2a** Sell 50 @ 53.00, fee 1.00; **X2b** Sell 20 @ 53.00, fee 0.40.

Expected results:

| After | Position | Lot Matches (opening ← disposing, quantity: realized) | Realized to date | Remaining Lots (quantity, unconsumed fee) |
|---|---|---|---|---|
| X1 | 70 | PC1 ← X1, 30: 57.00 − 0.50 − 0.60 = **55.90** | 55.90 | PC1 30 (0.50); PC2 40 (1.00) |
| X2 | 0 | adds PC1 ← X2a, 30: 87.00 − 0.50 − 0.60 = **85.90**; PC2 ← X2a, 20: 54.00 − 0.50 − 0.40 = **53.10**; PC2 ← X2b, 20: 54.00 − 0.50 − 0.40 = **53.10** | **248.00** | none |

Check: proceeds 5,270.00 − cost 5,018.00 − fees 4.00 = 248.00. Opening fees allocated 2.00 and disposal fees allocated 2.00, each exactly once. Realized R 248/250 = 124/125. Terminal time Tuesday 14:00.

**Shortfall Trade T-S** (symbol QRS, same Plan terms): PC1 Monday 10:00, 60 @ 50.10, fee 1.00; **XS** Tuesday 10:00, Sell 30 @ 52.00, fee 0.60. The window is cut at XS with 60 entered: Entry Quality risk 60 × 2.60 + 1.00 = $157.00, reward 60 × 5.90 − 1.00 = $353.00, size ratio 3/5, risk in Plan R 157/250, slippage $6.00; Entry Size shortfall 40.

**Earlier-dated exit X0** on T-A after X1 (P23): Sell 60 dated Tuesday 09:45. FIFO becomes X0 ← PC1 60 and X1 ← PC2 30, so PC1 ← X1 is superseded and two links are created. With X0 of 40 instead, X0 ← PC1 40 and X1 ← PC1 20 and PC2 10, so PC1 ← X1 gains a new version with quantity 20.

### T6.1 Trade Analysis: Sell replay, FIFO Lot Matches, fees, realized P&L

Seam: `TradeAnalysis.derive` (pure).

```text
describe("FIFO Lot Matches")
  it should derive Position 70, one Lot Match holding only PC1's Execution, X1's Execution, quantity 30, and policy FIFO (A78), and remaining Lots PC1 30 and PC2 40 in Fact Order after X1
  it should let one disposing Execution consume two Lots oldest first and dispose a Position Change's Executions in Fact Order, deriving PC1 ← X2a 30, PC2 ← X2a 20, and PC2 ← X2b 20, and Position 0, after X2

describe("lot-aware fees (A80)")
  it should allocate a Lot's opening fee in proportion to matched quantity and keep the remainder on the Lot: 0.50 to PC1 ← X1 and 0.50 left on PC1's Lot, and exactly 1/3 allocated and 2/3 left when 20 of a 60-share Lot with fee 1.00 are sold
  it should allocate a disposing Execution's fee across its Lot Matches by matched quantity (X2a's 1.00 as 0.60 and 0.40), so opening fees 2.00 and disposal fees 2.00 are each allocated exactly once after X2

describe("realized P&L")
  it should return each Lot Match's realized amount and Economic Time, and realized-to-date 55.90 after X1 and 248.00 after X2, with incurred fees 2.60 and 4.00
```

Folded: exact rational arithmetic is asserted inside the first fee case (the 1/3 Lot), because a rational type already in place would make a separate exactness case pass for free.

### T6.2 Trade Analysis: Closed lifecycle, Terminal Disposition, Realized R, close requirement, position paths

Seam: `TradeAnalysis.derive` (pure).

```text
describe("Closed lifecycle and Terminal Disposition (AC-LIFE-001)")
  it should expect Closed with terminal time Tuesday 14:00 and Terminal Disposition [Executions: 100 shares] after X2, and Open with Terminal Disposition NotApplicable(NotClosed) after X1

describe("Realized R")
  it should report Realized R 124/125 for the Closed reference Trade, and NotApplicable(NotClosed) after X1

describe("close requirement (A77)")
  it should report for a candidate whether its new Position Change is terminal and carries trader agency: TerminalWithAgency for X2, NotTerminal for X1

describe("position paths (P22)")
  it should return ExceedsOpenQuantity naming the available quantity for a Sell of 101 after PC2 (available 100) and for a Sell of 70 dated Monday 10:30 (available 60 at that time)
  it should return FlatBeforeLaterFacts for a Sell of 60 dated Monday 10:30, which leaves the Position flat before PC2 at 11:00
```

### T6.3 Trade Analysis: Entry window cutoff and Entry Size shortfall

Seam: `TradeAnalysis.derive` (pure), given a record with its recorded Deviation occurrences.

```text
describe("Entry window cut by the first reduction (A82)")
  it should resolve T-S's entry immediately before XS with 60 entered and Entry Quality over PC1 only (risk $157.00, reward $353.00, size ratio 3/5, risk 157/250 R, slippage $6.00), while T-A, fully entered at PC2, stays resolved at PC2

describe("Entry Size shortfall (A83, AC-POS-005)")
  it should expect one Shortfall occurrence of 40 fingerprinted (T-S, leg, Shortfall) with XS as its cause and Fulfillment FilledWithDeviation

```

Proven only by integration (they pass for free once the cases above are green, because D2's replay and Deviation reconciliation are generic): an earlier-dated Sell moving the cutoff and creating a shortfall, and an earlier-dated Buy that completes the plan before the cutoff superseding it (I6.7). Likewise FIFO re-running after an earlier-dated exit (X0) needs no case of its own: T6.1's matching is a pure function of the supplied facts, so I6.8 proves it end to end.

### T6.4 Trade Analysis: `evaluate` with realized-to-date

Seam: `TradeAnalysis.evaluate` (pure), T-A after X1 with an exact Mark of 52.50 for 2026-10-13.

```text
describe("realized-to-date in current figures (A92)")
  it should return realized-to-date 55.90, remaining-open marked P&L 158.50, Current Marked Trade P&L 214.40 (536/625 R), incurred fees 2.60, and on the remaining 70 shares Ongoing Risk to Stop $350.00, Worst-Case $3,675.00, and Incremental Reward to Target $245.00
```

Proven only by integration: realized-to-date stays a Value beside a Missing Mark (I6.16, AC-CALC-002), a Closed Trade needs no Mark (I6.3), and derivation at Monday's cutoff excludes Tuesday's exits (I6.10). Each passes for free once this case and D4's cases are green.

### T6.5 Persistence: schema v5

Seam: the internal `Persistence` interface and the `v4→v5` transform, against `fake-indexeddb`.

```text
describe("schema v5 layout")
  it should create a fresh Workspace at schema version 5 with the sparse byLifecycleTerminal index on trades

describe("v4 → v5 transform")
  it should copy every v4 store, give each Trade document an empty Close Reason fact list and no terminalTime, and migrate a v1 Workspace through every step to v5 inside one candidate

describe("rebuild")
  it should rebuild byLifecycleTerminal from trades with identical contents, holding only Closed Trades
```

### T6.6 Trade Record: close facts, Closed index, queries

Seam: `TradeRecord`, against `fake-indexeddb`.

```text
describe("prepareChange: PositionChange with Sell members")
  it should build a candidate with the Sell Executions and, for a terminal change, one Close Reason fact naming the Catalog identity and the terminal Position Change, sequenced after the members (A85)

describe("applyPreparedChange")
  it should move lifecycle-index membership from Open to Closed and set terminalTime and its byLifecycleTerminal key in the same staged write when the reconciliation expects Closed, storing no Lot-Match record (P23)

describe("queryRecords: CurrentState Closed")
  it should select Closed Trades by Terminal Time descending then Trade identity, reading each page of 50 with one getAll on byLifecycleTerminal

describe("queryRecords: StateAtEconomicCutoff Open, extended (A88)")
  it should also return a Trade that is now Closed when its exposure started at or before the cutoff and its terminal time is after it, and exclude one that closed at or before the cutoff, adding one getAll on byLifecycleTerminal

describe("getRecord")
  it should return the Close Reason fact and terminalTime in AnalysisInput
```

### T6.7 Reference Catalog: Close Reasons

Seam: `ReferenceCatalog.seedDefaults`, `query`, and `resolve`, against `fake-indexeddb`.

```text
describe("seedDefaults: manifest v2")
  it should add the Close Reasons Target Reached, Stop Triggered, Thesis Invalidated, and Time-Based Exit, in that order with policy SeededValuesRemainSelectable and no Rolled role, and nothing else, to a v1-seeded Catalog, and add nothing when run again

describe("query and resolve")
  it should list the selectable Close Reasons in seed order, and resolve one as NewSelection while returning WrongKind for a Strategy identity offered as a Close Reason
```

### T6.8 Journal: Close Review

Seam: `Journal.seedDefaults`, `prepareEffects`, and `save`, against `fake-indexeddb`.

```text
describe("seedDefaults: manifest v5")
  it should add the Close Review Entry Type, its definition revision 1, and the Trade Close Source, and nothing else, to a v4-seeded Journal, and add nothing when run again
  it should match the contract exactly: "Would you take this Trade again under similar conditions?" required Single Select (Yes, as planned; Yes, with changes; No; Unsure); "What worked, and what did not?" optional Text; "What is the key lesson?" optional Text, in that order

describe("prepareEffects: Close Review (A86)")
  it should prepare a completed Entry keyed (CloseReview, Trade), with the definition snapshot, a Trade Anchor, Source Trade Close, the terminal Position Change as origin, and its Economic Time as moment time, returning RequiredAnswerMissing for a blank first prompt
  it should prepare a decline under the same key with an optional reason of at most 500 characters
  it should prepare an Outstanding Debt under the same key with due anchor the terminal Economic Time and rule OneSessionGrace

describe("save: ResolveDebt for a Close Review Debt")
  it should answer it with a Close Review Entry validated against the Debt's snapshot, Source Trade Detail, and settledDebtId
```

Red notes: the decline and Defer cases are red because D2's decline and D5's Defer accept only the Position Change Reflection (D5 A66). The resolution case is red because D5's resolution core creates only Position Change Reflection Entries (A64). Proven only by integration: one Close Review outcome per Trade under retries (I6.12), and Close Review items in the Trade narrative (I6.3).

### T6.9 Section validators: Trade Record and Catalog

Seam: `validateSection(snapshot)` exported by Trade Record and Reference Catalog, returning `{ issues, repairs }`, over a batched record source (D2 T2.9 as amended by D8 A140). D8's `prepareRestore` reuses them.

```text
describe("Trade Record section, closing")
  it should accept Closed Trades whose lifecycle and Close Reason agree with their facts, and report a Close Reason fact on a non-terminal Position Change, two Close Reason facts, a Closed Trade with Executions and no Close Reason, and a Close Reason naming an unknown Catalog identity

describe("Catalog section, Close Reasons")
  it should report a seeded Close Reason that is inactive, and a Close Reason whose label is not distinguishable from another Close Reason's
```

### T6.10 Trade Workflows: `recordPositionChange` (reduce and close)

Seam: `TradeWorkflows.recordPositionChange`.

```text
describe("partial exit")
  it should commit X1, its Sell Execution, and the exit's reflection outcome in one semantic commit, keep the Trade Open, and return the post-commit derivation (Lot Matches, realized-to-date, remaining Lots) equal to a fresh derivation of the stored Trade (AC-RESP-001)

describe("terminal exit (AC-POS-004)")
  it should commit X2 with one Close Reason fact, the Open-to-Closed lifecycle and index move, the terminal time, the exit's reflection outcome, and the Close Review outcome for each disposition (Complete, Decline, Defer) in one semantic commit, returning the lifecycle transition, Terminal Disposition, Realized R, and both Journal outcome projections
  it should reject a terminal exit without a Close Reason and without a Close Review disposition, returning CloseReasonRequired and CloseReviewDispositionRequired together with any Journal issues
  it should reject a Close Reason or Close Review disposition on a non-terminal exit with CloseReasonNotApplicable and CloseReviewNotApplicable
  it should reject an unknown Close Reason or a Strategy identity with the Catalog resolution issue

describe("position paths (P22)")
  it should return ExceedsOpenQuantity and FlatBeforeLaterFacts from the candidate's analysis as typed issues and write nothing
  it should reject any Position Change on a Trade whose stored lifecycle is Closed with TradeClosed and write nothing

describe("earlier-dated exit (P23)")
  it should commit X0 after X1 and disclose in the receipt the derived Lot Matches that changed and the realized P&L before and after
```

Proven only by integration (generic once these are green): the write gate for exits (I6.13) and a repeated terminal command returning Conflict (I6.12).

### T6.11 Daily Review: `open`

Seam: `DailyReview.open`, against `fake-indexeddb`.

**Closed-Trade Review fixture** (all Long Stock, 100 shares bought at 10:00 unless stated, exits Sell 100):

Every exit's own Position Change Reflection is completed unless stated, so only the Debts named below are owed.

| Trade | Facts | Monday Review (clock Monday 17:00) | Tuesday Review (clock Tuesday 17:00) |
|---|---|---|---|
| T-A | the reference Trade, PC1 and PC2 Monday; X1 Tuesday 10:00 | walked | walked (Open, partly closed) |
| T-K KLM | bought Monday; sold Tuesday 11:00; Close Review completed | walked | absent (nothing owed) |
| T-L LMN | bought Tuesday 10:00; sold Tuesday 15:00; Close Review deferred | absent | owed group: Close Review "Due in the next Review" |
| T-M MNP | bought Monday; sold Monday 15:00; Close Review deferred | owed group: Close Review "Due in the next Review" | owed group: Close Review Due |
| T-N NOP | bought Monday; sold Tuesday 16:30, after the close | walked | walked: Open at the cutoff, now Closed (A91) |
| T-P PQR | bought Monday; sold Monday 12:00; Close Review completed | absent (nothing owed) | absent |
| T-Q QST | bought Tuesday 16:10, after the close, reflection deferred; still Open | absent | owed group: Position Change Reflection "Due in the Review after next" |

Expected Tuesday owed group: T-M (it has a due reflection), then T-L (owed anchor Tuesday 15:00), then T-Q (Tuesday 16:10).

```text
describe("eligibility extended (A88, AC-REV-001)")
  it should walk T-N in Tuesday's Review although it is now Closed, evaluated at Tuesday's cutoff with Position 100 and realized-to-date $0.00

describe("Trades with owed reflections (P19, P20, A89)")
  it should return, after the walk, every Trade outside it with an Outstanding reflection, due or not, as T-M, T-L, T-Q in Tuesday's Review and T-M alone in Monday's, with T-K and T-P absent, and name only T-M's Close Review among Tuesday's completion blockers
  it should return Empty with the owed group attached when no Trade was eligible and no reflection is due (a Workspace holding only T-L, Tuesday Review)
```

### T6.12 Daily Review: `getTrade` card kinds

Seam: `DailyReview.getTrade`, with the Closed-Trade Review fixture at Tuesday 17:00.

```text
describe("owed-reflection cards (A90)")
  it should return T-M and T-Q as ReflectionsOwed cards: T-M with its Closed summary (realized P&L, Realized R, Terminal Disposition, Close Reason) and its owed Close Review, T-Q with its Open summary and its owed Position Change Reflection, each with its snapshot form and save binding, and neither with an Action form or evaluation

describe("walked cards (A91, A94)")
  it should return T-N's Action form and cutoff evaluation with its current lifecycle Closed and no exit route, and T-A's with an exit route naming its remaining 70 shares
```

### T6.13 Daily Review: `save` across the walk and the group

Seam: `DailyReview.save`, with the Closed-Trade Review fixture at Tuesday 17:00, every Mark and every Action saved.

```text
describe("ResolveReviewDebt on an owed-reflection card")
  it should answer T-M's Close Review with a Close Review Entry (Source Daily Review) and return revised completion Complete, and, while T-M's Close Review is still due, return T-M's card as the next step after the last walked Action is saved, skipping T-L and T-Q, whose reflections are not yet due
```

### T6.14 Trade Views: Closed list and Detail; Open Detail with Lot Matches

Seam: `TradeViewsAndReporting.browseTrades` and `getTradeDetail`.

```text
describe("browseTrades: Closed (A95)")
  it should return a Ready page with, per Trade, symbol, Strategy, Account and Institution labels, net realized P&L, Realized R, Terminal Disposition, Close Reason label, terminal time, Deviation count, owed-reflection indicator, and integrity indicator, ordered by terminal time descending, reading no Market Data, and an empty Ready page when nothing is Closed

describe("getTradeDetail: Closed")
  it should return the Plan, stored lifecycle Closed with agreement, Terminal Disposition and Close Reason as separate fields, Position Changes with their Executions, each Lot Match with its allocated opening and disposal fees and realized amount, the fee reconciliation, realized P&L, Realized R, Entry Quality, Fulfillment, Deviations, and the narrative including the Close Review, with no Mark requirement

describe("getTradeDetail: Open after a partial exit")
  it should return the Lot Matches, realized-to-date 55.90, the remaining Lots with unconsumed fees, and current figures that include realized-to-date
```

### T6.15 Workspace: migration to schema 5

Seam: `Workspace.initialize` and `getStatus`.

```text
describe("migration to schema 5")
  it should migrate v1, v2, v3, and v4 Workspaces to schema 5 and return Opened with a receipt naming the from and to versions, per-store counts, and the seed additions (four Close Reasons; the Close Review type, definition, and Trade Close Source)
```

### T6.17 UI: exit form

Seam: `PositionChangeForm` in exit mode, with a facade test double.

```text
describe("rendering (A93)")
  it should render Record exit with Sell, the symbol, and the Planned Leg read-only, Execution rows, and Reflection on this exit with Reflect now selected
  it should show Closing the Trade, with Close Reason as a radio group of the selectable reasons and Close Review with its own disposition group with Reflect now selected (P21), once the entered quantities total the open quantity, and hide it otherwise

describe("submission")
  it should submit the Close Reason identity and the Close Review disposition only while the section is shown, and on CloseReasonRequired show the section with the issue, keeping every entered value
  it should render the saved exit from the result alone: Lot Matches, realized P&L, lifecycle Closed, Terminal Disposition, Close Reason, and both reflection outcomes
```

### T6.18 UI: Closed tab and list

**Amended by plan revision 8 (decision 48):** A95's "symbol, Strategy" become the Underlying and Trade columns. The Closed row's Trade Summary describes what was traded: the entered quantity at its average entry price ("Long 100 shares @ $50.18"). T6.16 adds that summary to Closed items and Details. On narrow, the Trade cell's second line carries Realized P&L and Realized R, and those columns are hidden there. Under the same rule as the Open table, only columns a trader scans by stay: T6.18 confirms A95's other columns against it, with indicators as Trade-cell badges rather than columns (D02-ui-alignment.md, section 2a).

Seam: `TradeList` with a facade test double.

```text
describe("lifecycle tabs")
  it should show Open, Planned, and Closed tabs as a tablist, with Open selected by default

describe("Closed list (A95)")
  it should render distinct Loading, Ready, Empty (explaining that a Trade appears here once its exit is recorded), and Error (with Retry) states, and rows with signed realized P&L, Realized R, "Closed via sale", Close Reason, close date, and indicators with text, numbers right-aligned in tabular numerals
```

### T6.19 UI: Trade Detail closing additions

Seam: `TradeDetail` with a facade test double.

```text
describe("Closed Trade Detail")
  it should show lifecycle "Closed" as text, "Closed via sale of 100 shares" and the Close Reason as separately labelled fields, realized P&L and Realized R, the fee reconciliation, a Lot Matches table, and the Close Review in the narrative, with no Record entry or Record exit

describe("Open Trade Detail after a partial exit")
  it should show realized to date, the Lot Matches table with a note that per-match amounts are rounded for display, and Record exit beside Record entry only while Writable
```

### T6.20 UI: Review owed-reflection cards, Exit link

Seam: `ReviewView` and `ReviewTrade` with a facade test double.

```text
describe("owed-reflection group (P19, P20)")
  it should show "Trades with owed reflections" after the walk, each card with its lifecycle summary ("Closed via sale", Close Reason, realized P&L, and Realized R for a Closed Trade) and its Reflections section, no Action form, and the same group inside the Empty view
  it should open DebtForm for a not-yet-due reflection and, after Save, render it resolved from the result, leaving completion unchanged

describe("Exit link (A94)")
  it should offer Record the exit once an Exit Action is saved for a Trade that is still Open, open the exit form in context, and after its Save show the recorded exit from the result with Refresh Review
```

---

## 5. Structural tasks

| Task | Verification (exact) | Expected result | Behavior that depends on it |
|---|---|---|---|
| T6.16 Capability manifest and composition | `npm run verify:capabilities` | The manifest adds `recordPositionChange` (Reduce and Close; Sell; Close Reason; Close Review Complete, Decline, Defer), `browseTrades` and `getTradeDetail` for Closed, `queryRecords` (`CurrentState` Closed; `StateAtEconomicCutoff` including Trades closed after the cutoff), the Close Reason family in `ReferenceCatalog.query` and `resolve`, the Close Review Entry Type and Trade Close Source, the owed-reflection group and `ReflectionsOwed` card kind in `DailyReview.open` and `getTrade`, and schema version 5. `DailyReview.getDebt` stays absent (P20). Every new operation is reachable from the exit form, the Closed tab, Trade Detail, or the Review, and nothing beyond D6 is. | AC-CAP-001. |
| T6.21 Previous-release harness | `npm run build:releases && npm run verify:releases` | `dist-releases/d5` is built from tag `claude-opus-5.5-d5` (A97), alongside the existing folders and a current `d6`. `verify:releases` confirms `d5` reports schema 4 and its own release identity. | B6.6, C6.8. |
| T6.22 Capacity basis | `npm run measure:capacity`, then `npm run verify:capacity` | The measurement closes 2,000 Trades through the facade with 1–3 exits each, a Close Reason, and the section 1.4 Close Review split. It replaces the Close Review outcome allowance and the closing part of the Position Change and Execution allowances with measured bytes. `capacity-basis.json` carries schema version 5, and `verify:capacity` fails if it still names schema 4. | Capacity readiness check (decision 18). |
| T6.23 Schema fixtures | `npm run fixtures:freeze -- --schema 5`, then `npm run verify:fixtures` | The v5 dump adds to D5's fixture content, as of Tuesday 17:00: T-A after X1 (one derived Lot Match), a Trade closed on Monday with a completed Close Review, a Trade closed Tuesday with a deferred Close Review, and T-S with its shortfall occurrence. `verify:fixtures` migrates the v1–v4 dumps and checks their views per A98, then checks that the v5 dump opens Ready and that its lists (including Closed), Details, and Review equal its own snapshot. | Migration from every earlier version; D7 onward. |
| T6.24 Benchmark generator | `npm run build:bench && npm run bench:generate` | The generator produces the section 1.4 profile through the production facade, records its counts, generator version, and as-of instant in `bench/dataset.json`, and caches the profile. A changed generator or schema version regenerates it. | T6.25. |
| T6.25 Latency harness and query count | `npm run bench:run`; `npm run test:integration -- d6/query-count` | As D4's T4.31; results go to `evidence/D06/bench.md`. Before and after the runs, the harness compares every Open row and the first Closed page with the generator's expected values, and the as-of Review's walk and owed-reflection group with the expected identities. The Node test shows that a Closed page issues one `getAll` on `byLifecycleTerminal`; that a Review `open` adds exactly one `getAll` on `byLifecycleTerminal` to D5's counts, plus one `get` per Trade in the owed-reflection group; and that these counts are the same with 1,000 or 24,700 Closed Trades. | AC-PERF-001. |
| T6.26 Node integration suite | `npm run test:integration` | Every case in sections 6.1 of D1, D2, D4, D5, and D6 passes. | Cumulative regression. |
| T6.27 Browser integration suite | `npm run test:e2e` (Chromium) | Every case in sections 6.2 of D1, D2, D4, D5, and D6 passes. | Cumulative regression. |
| T6.28 Browser critic | Fresh critic agent per section 7 | A structured report with every flow passing. | Deliverable gate. |

---

## 6. Mock-free integration tests

### 6.0 Disclosed test substitutes

D1's, D2's, D4's, and D5's substitutes still apply (`fake-indexeddb`, `NodeTestHost`, fixed clock and identities, release harness, faults build with the clock pin, Chromium as the routine engine, read-only probe, in-process lifecycle lock, integrity fixture writer, migration fault stages, request-counting wrapper, bench build, Playwright clock in the generator and benchmark, definition-revision fixture writer). D6 adds none. The integrity fixture writer is used on a Closed Trade's stored lifecycle (I6.9); as in every other use, it edits raw records only before the application opens them.

### 6.1 Node application-stack suite (`tests/integration/d6/`)

Conventions are as in D1, D2, D4, and D5. Clocks are fixed per case.

| Case | Given / When | Then (visible result and durable-state proof) |
|---|---|---|
| I6.1 Migrate earlier fixtures | Load `workspace-v1/` through `workspace-v4/` separately; `initialize`; restart; `getStatus`. | Opened with a receipt naming the Close Reason and Close Review seed additions. After restart: Ready at schema 5; views follow A98; Closed list Empty; `byLifecycleTerminal` empty; the pointer names a new database and no candidate is listed. |
| I6.2 Migration failure and retry | `workspace-v4/` with one Debt's definition revision changed to an unknown identity; `initialize`; restore it; Retry. | MigrationBlocked naming the issue; old stores equal the fixture apart from the IndexedDB version; no candidate; never Ready. After Retry: Opened, and Ready after restart (AC-REST-004, re-proven). |
| I6.3 Complete lifecycle (AC-LIFE-001, AC-POS-001) | Confirm T-A; record PC1, PC2, X1, and X2 (Close Reason Target Reached, both reflections completed), deriving after each; restart; `getTradeDetail`; `browseTrades` Open and Closed. | Stored lifecycle Planned, Open, Open, Open, Closed, and expected lifecycle agrees at each revision; index membership moves in the same commit as each change. Each result equals the stored Trade (AC-RESP-001). Dump: every Execution owned by T-A; no Lot-Match record anywhere (P23); Close Reason fact naming X2; `terminalTime` Tuesday 14:00. Detail: the four derived Lot Matches with the section 4 quantities, realized 248.00, fees 2.00 + 2.00 allocated once, Realized R 124/125, "Closed via sale of 100 shares" separate from "Target Reached", Close Review in the narrative; no Market Data read. T-A appears only in Closed. |
| I6.4 Close Review dispositions (AC-POS-004) | Three Trades closed Tuesday 14:00 with Close Review Complete, Decline, and Defer; restart; `getTradeDetail` each; `open` at Tuesday 17:00 and Wednesday 17:00. | All three are Closed; the Close Review outcome is an Entry (Source Trade Close), a decline, or an Outstanding Debt with due anchor 14:00 and no Entry. Tuesday's Review shows the deferred one in the owed-reflection group as "Due in the next Review" and is not blocked by it; Wednesday's shows it there as Due and is Incomplete until it is answered. The completed and declined ones appear in neither Review. |
| I6.5 Close requirements write nothing | Terminal X2 without Close Reason or Close Review disposition; X1 with a Close Reason; X2 with a Strategy identity as Close Reason. | `CloseReasonRequired` with `CloseReviewDispositionRequired`; `CloseReasonNotApplicable`; `WrongKind`. Dumps unchanged. |
| I6.6 Position paths write nothing (P22) | Sell 101 after PC2; Sell 70 dated Monday 10:30; Sell 60 dated Monday 10:30; after X2, a Buy on the Closed Trade. | `ExceedsOpenQuantity` (100; 60 at 10:30), `FlatBeforeLaterFacts`, `TradeClosed`. Dumps unchanged. |
| I6.7 Shortfall and the moving cutoff (AC-POS-005, partial) | T-S: PC1, XS; restart. Then record PC-early Buy 40 dated Monday 11:00. Separately: T-A's PC1 and PC2, then a Sell 30 dated Monday 10:30. | T-S: resolved at XS with the section 4 Entry Quality; one Shortfall occurrence of 40 caused by XS; Fulfillment Filled with Deviation. After PC-early: resolution at PC-early, Entry Quality over 100 shares, the Shortfall superseded with a reason, both disclosed in the receipt. Separately: the window is cut at 10:30 with 60 entered, PC2 falls outside it, a Shortfall of 40 is created, and the receipt discloses the moved Entry Resolution Point. |
| I6.8 Earlier-dated exit (P23) | T-A through X1; record X0 Sell 60 dated Tuesday 09:45; restart. Repeat with X0 of 40. | Receipt lists the changed matches with realized P&L before and after: for 60, X0 ← PC1 60 and X1 ← PC2 30 replace X1 ← PC1 30; for 40, X0 ← PC1 40, X1 ← PC1 20 and PC2 10. After restart, Detail's Lot Matches equal that FIFO set, and the dump holds only the facts. |
| I6.9 Closed-lifecycle integrity (AC-LIFE-003) | Integrity fixture writer sets a Closed Trade's stored lifecycle to Open and moves its index entry. Read the Open list and Detail; attempt a Sell and a Buy on it. | Reads: Ready with `LifecycleDisagreement` (stored Open, expected Closed) and the integrity indicator; content revision unchanged. Both Position Changes are rejected by P22 with no write, so the disagreement stays visible until migration or Restore (D8) repairs it (A96). |
| I6.10 Review with closed Trades (P19, P20, AC-REV-001) | The Closed-Trade Review fixture. `open` at Monday 17:00 and Tuesday 17:00; save every Mark and Action; on Tuesday answer T-L's not-yet-due Close Review and then T-M's due one on their cards; restart; `open`. | Monday's and Tuesday's walk and owed group exactly as the fixture table. T-N walked on Tuesday with cutoff figures and current lifecycle Closed. Tuesday Incomplete naming only T-M's Close Review until it is answered, then Complete; answering T-L's early leaves completion unchanged and removes T-L from the group. After restart, the same, derived from facts; no Review-session record. |
| I6.11 Exit Action and its route (AC-REV-003) | Monday 17:00: save Exit with Intent for T-A in the Review; check facts; then `recordPositionChange` X1 dated Tuesday 10:00; `open` Monday's Review again at Tuesday 10:05. | The Exit save creates no Position Change. After X1, Monday's Review still walks T-A with its saved Exit Action, evaluated at Monday's cutoff (Position 100, realized $0.00). |
| I6.12 Retries (AC-JOUR-005) | (a) Submit terminal X2 twice. (b) Answer a deferred Close Review twice with the same expected revision. (c) With one binding, answer it through the Review and decline it through `Journal.save`. | (a) Second returns Conflict; one Close Reason, one Close Review outcome. (b) Second returns Conflict carrying the Entry. (c) Exactly one succeeds; one current outcome for `(CloseReview, Trade)`. |
| I6.13 Write gate | Host fails the inventory check; call `recordPositionChange` for an exit, `Journal.save` and `DailyReview.save` for a Close Review Debt, and `Persistence.commit` directly. | `RuntimeNotWritable` at every boundary; dumps unchanged; Closed list, Detail, and Review still readable (AC-DEL-004, AC-DEL-006). |
| I6.14 Rebuild equivalence | After I6.3, I6.4, and I6.10: capture Open, Planned, and Closed lists, Details, and the Review; run `rebuildPrivateState`; capture again. | Normalized views equal; `byLifecycleTerminal`, `byLifecycleActivity`, and `journalObligations` rebuilt with identical contents (AC-REBUILD-001). |
| I6.15 Fresh initialization at schema 5 | Empty factory; `initialize(zone)`. | Schema 5 created directly; Catalog manifest v2 with the four Close Reasons; Journal manifest v5 with the Close Review and Trade Close Source; no migration. |
| I6.16 Realized beside a Missing Mark (AC-CALC-002, partial) | T-A after X1; clock Tuesday 17:00 with no Tuesday Mark; `getTradeDetail`; `open`. | Realized-to-date 55.90 is a Value; remaining-open, Current Marked Trade P&L, and risk figures are `Unavailable(MarkMissing)` naming XYZ and 2026-10-13; no fill cost or zero. |

### 6.2 Browser suite (`e2e/d6/`, Playwright against the built app on `localhost:5175`)

Chromium only (decision 19). Dates are set with Playwright's clock on the production build. Durable state is proven by reload or full browser restart plus D1's read-only probe. RC later repeats B6.6–B6.8 in all three engines.

| Case | Procedure | Expected observable result and durable-state proof |
|---|---|---|
| B6.1 Partial then final exit | On T-A after PC1 and PC2 (clock Tuesday 10:05): Record exit 30 @ 52.00 fee 0.60 with the reflection; then (clock Tuesday 14:05) Record exit with two rows (50 and 20 @ 53.00), Close Reason Target Reached, both reflections answered; relaunch; open the Closed tab and the Trade. | After the first exit: Open, Position 70, one Lot Match, realized $55.90, no Closing section. After the second: the Closing section appeared once 70 was entered; Closed; realized $248.00, Realized R 0.99R; "Closed via sale of 100 shares" and "Target Reached" as separate fields. The probe shows the Sell Executions and the Close Reason fact, and no Lot-Match record. |
| B6.2 Close Review deferred to the Review | Clock Tuesday 14:05: close Trade 1 and Trade 2, each with Close Review Reflect later. Clock Tuesday 17:00: open the Review; answer Trade 1's Close Review on its card. Clock Wednesday 17:00: open the Review; answer Trade 2's; save Actions. | Tuesday: both under "Trades with owed reflections" marked "Due in the next Review"; the Review can complete; Trade 1 answered there leaves the group. Wednesday: Trade 2's card marked "Due"; Incomplete until answered, then Complete. Probe: two Close Review Entries with `settledDebtId` and Source Daily Review. |
| B6.3 Close requirements | Enter a full exit, clear the Close Reason, Save; then choose a reason and Save. | "Choose a Close Reason" beside the group, focus on it, values kept; then it saves. |
| B6.4 Oversell | Record exit 101 on a 100-share Position. | "Only 100 shares are open" beside the row; nothing saved. |
| B6.5 Exit link | Clock Monday 17:00: in the Review save Exit with Intent for T-A; press Record the exit; record 100 shares with a reason and reflections; Refresh Review. | The exit form opened over the Review; after Save the card shows the recorded exit; after refresh T-A is still walked for Monday with its Exit Action (it was Open at the close). |
| B6.6 Update from D5 with data | Harness serves `d5`; create two Open Trades with a deferred reflection; switch to `d6`; Reload from the update notice; record a full exit on one. | "Updating your journal" shows; earlier data intact; the exit closes the Trade; About shows schema 5. The probe shows the new pointer target and no old database. |
| B6.7 Kill after commit | SIGKILL right after a terminal exit's result renders; relaunch. | Closed lifecycle, the Sell Executions, Close Reason, and both reflection outcomes are all present, and Detail derives the same Lot Matches. |
| B6.8 Offline cold restart | Close; relaunch offline; record a partial and then a full exit. | Writable offline; both survive another offline restart (AC-DEL-001). |
| B6.9 Recovery Only (*faults build*) | Existing Closed Trade and partly closed Trade; relaunch with `?faults=control`. | Closed list, Closed Detail, and Open Detail with Lot Matches readable; no Record exit, Reflect now, or Decline; probe unchanged. |
| B6.10 Mid-session failure (*faults build*) | Fill a full exit form; `__tjFaults.set(["inventory"])`; Save. | `RuntimeNotWritable` explained; values kept; no Position Change (AC-DEL-006). |
| B6.11 Nothing saved without Save | Fill a full exit with Close Reason and both reflections; resize; navigate away; restart. | No Position Change, Close Reason, Entry, decline, or Debt; no entered value in Web Storage (AC-JOUR-001). |
| B6.12 Responsive and accessible | Half-fill a full exit at 1280 px; resize to 390 px and back; run axe on the exit form with and without the Closing section, the Closed list in all states, Closed Detail, Open Detail with Lot Matches, and the Review's owed-reflection cards; record a full exit using the keyboard only. | Values survive; layout switches at 960 px; no WCAG 2.1 AA violations; signed P&L and "Closed via" are text, not colour alone (AC-UI-001, AC-UI-002). |

---

## 7. Browser-critic flows

The critic receives the frozen `specs/`, the plan index, the D1, D2, D4, D5, and D6 breakdowns, and the list of future capabilities that must not be treated as defects. Those are everything after D6, including:
- options, Expiration, Settlement Due, and non-agency closes;
- backup and Restore;
- opening an exact past Review date;
- Rolls and the Rolled Close Reason;
- correcting or Voiding an exit, and Not Entered on multi-leg Plans;
- provider prices and Stop Discipline;
- reports.

It runs `npm run build && npm run preview` (port 5175) itself, plus `npm run serve:releases` for C6.8 and `npm run preview:faults` for C6.6 and C6.9. It does not edit code.

| Flow | Actions | Pass condition |
|---|---|---|
| C6.1 Partial exit | On an Open 100-share Trade bought 60 @ 50.10 (fee 1.00) and 40 @ 50.30 (fee 1.00), Record exit 30 @ 52.00, fee 0.60. | Open, Position 70; one Lot Match against the first purchase; realized $55.90; no Close Reason asked. |
| C6.2 Final exit | Record exit 50 and 20 @ 53.00 (fees 1.00 and 0.40) in one Position Change; choose a Close Reason; answer both reflections. | Closed; realized $248.00 and 0.99R; "Closed via sale of 100 shares" shown separately from the Close Reason; the Trade is in the Closed tab, not Open. |
| C6.3 Close Review choices | Close three Trades, completing, declining, and deferring the Close Review. | All three close; the narrative shows the Entry, "Close Review declined", and "Reflection owed". |
| C6.4 Close Review in the Review | Defer a Close Review during a session; open that session's Review after the close, then the next session's. | First: the Trade under "Trades with owed reflections" with "Due in the next Review"; it can be answered there, and the Review completes without it. Second (if left unanswered): the same card marked Due; Incomplete until answered. A close reflected in full in the exit form appears in neither Review. |
| C6.5 Validation | Exit more than is open; then a full exit without a Close Reason. | Clear errors beside the fields, focus on the first; nothing saved after reload. |
| C6.6 Earlier-dated exit | Faults build with a pinned clock: on a Trade with exits at 10:00 and 14:00, record another exit dated 09:45. | The receipt lists the changed matches and realized P&L before and after; Detail's Lot Matches follow FIFO in Economic Time order. |
| C6.7 Exit from the Review | Save Exit for a Trade in the Review, then use Record the exit. | The exit form opens over the Review; after Save the card shows the exit; the Action itself recorded no trade. |
| C6.8 Update with migration | Harness serves `d5`; create Open Trades; switch to `d6`; reload from the notice; close one. | Migration message; earlier data intact; the Trade closes; About shows schema 5. |
| C6.9 Recovery Only | Faults build: close a Trade; relaunch with `?faults=inventory`. | Closed list and Detail readable; no Record exit or reflection controls. |
| C6.10 Offline, responsive, keyboard, About | Stop the server and reload, then record a full exit; resize with a half-filled exit form; close a Trade by keyboard; open About. | Offline works; values survive resizing; visible focus; About lists only D1, D2, D4, D5, and D6 capabilities. |

---

## 8. Acceptance matrix rows

Status values: `planned`, `covered`, `intentionally not advertised`. All rows are `planned`. AC-DEL rows cite Chromium and faults-build evidence; Firefox, WebKit, and real-state evidence are **pending RC** (decision 19).

| Scenario | Deliverable | Tasks | TDD / structural | Integration case and fixture | Critic flow | Command or procedure | Expected result and durable-state proof | Failure / nonmutation / restart evidence | Status |
|---|---|---|---|---|---|---|---|---|---|
| AC-POS-001 (full) | D6 | T6.1, T6.6, T6.10, T6.14, T6.19 | T6.1 groups; T6.10 partial and terminal groups | I6.3; B6.1 (reference Trade) | C6.1, C6.2 | `npm run test:integration -- d6/lifecycle` | Each Execution owned by one Trade; exact Lots and FIFO links; opening and disposal fees allocated once; partial exit Open; flat Closed; no price or P&L on a link | Restart I6.3; kill after commit B6.7 | planned |
| AC-LIFE-001 (full) | D6 | T6.2, T6.6, T6.10 | T6.2 lifecycle group; T6.6 apply group | I6.3 | C6.2 | as AC-POS-001 | Planned, Open, Open, Closed with agreement at each revision; index move in the same commit; Terminal Disposition from disposing facts only, separate from Close Reason | Restart | planned |
| AC-POS-004 (partial: trader-directed exit) | D6 | T6.2, T6.10, T6.17 | T6.10 terminal group | I6.4, I6.5; B6.3 | C6.3, C6.5 | `npm run test:integration -- d6/close-review` | Exactly one active Close Reason required; Close Review Complete, Decline, or Defer never blocks closure | Rejections write nothing (I6.5) | planned (non-agency settlement in D7) |
| AC-POS-005 (partial: Entry Size shortfall) | D6 | T6.3, T6.6 | T6.3 cutoff and shortfall groups | I6.7 | — | `npm run test:integration -- d6/shortfall` | Resolution cut by the first reduction; shortfall fingerprint and quantity; superseded by an earlier-dated completing Buy | Restart | planned (Not Entered, Not Verifiable, Planned-Leg Terms, Unplanned Exposure in D10; section 1.2) |
| AC-LIFE-003 (partial: Closed lifecycle agreement; the Lot-Match case is reopened by decision 30) | D6 | T6.14 | — (D2's agreement cases) | I6.9 | — | `npm run test:integration -- d6/integrity` | Reads surface the disagreement without writing | Content revision unchanged after reads; rejected mutations write nothing | planned (Restore branch in D8) |
| AC-REV-001 (partial: a Trade closed after the cutoff stays eligible) | D6 | T6.6, T6.11 | T6.6 extended cutoff case; T6.11 eligibility case | I6.10, I6.11 | C6.7 | `npm run test:integration -- d6/review` | T-N walked although Closed now; cutoff evaluation excludes later exits | Restart I6.10 | planned (exact-date open and correction in D15) |
| AC-REV-006 (partial: due Close Review on a non-walked Trade) | D6 | T6.11, T6.13, T6.20 | T6.11 owed-group case | I6.4, I6.10; B6.2 | C6.4 | as AC-REV-001 | Incomplete while an owed card's reflection is due; Complete after it is answered; not-yet-due ones never block | Restart | planned |
| AC-REV-003 (full in D4; re-proven with the Exit link) | D6 | T6.20 | Exit link case | I6.11; B6.5 | C6.7 | `npm run test:integration -- d6/exit-action` | The Exit Action creates no Position Change; recording the exit is a separate Trade Workflow | — | planned |
| AC-CALC-002 (partial: realized-to-date stays a Value beside a Missing Mark) | D6 | T6.4, T6.14 | T6.4 case | I6.16 | — | `npm run test:integration -- d6/missing-mark` | Realized 55.90 a Value; Mark-dependent figures Unavailable naming XYZ and the date | — | planned (multi-Instrument in D10) |
| AC-JOUR-005 (partial: Close Review retries and concurrency) | D6 | T6.8, T6.10 | — | I6.12 | — | `npm run test:integration -- d6/retries` | One current outcome per `(CloseReview, Trade)` | Conflicts write nothing | planned (Void reopening in D13) |
| AC-JOUR-007 (partial: Close Review and the Trade Close Source) | D6 | T6.8, T6.15 | T6.8 seed group | I6.1, I6.15 | — | `npm run test:integration -- d6/seed` | Definition equals the contract text; Source added | Second launch adds nothing | planned |
| AC-REF-001 (partial: the four Close Reasons) | D6 | T6.7, T6.15 | T6.7 seed group | I6.1, I6.15 | — | as AC-JOUR-007 | Exactly four Close Reasons with policy; no Other, Expired, Assigned, or Exercised | Second launch adds nothing | planned (Rolled in D21; full in D22) |
| AC-JOUR-001 (full in D4; re-proven for the exit form) | D6 | T6.17 | — | B6.11 | C6.10 | `npx playwright test e2e/d6/no-save.spec.ts` | No fact, Close Reason, Entry, decline, Debt, or draft | Restart | planned |
| AC-REST-004 (partial: re-proven for schema 5) | D6 | T6.5, T6.15 | T6.15 migration case | I6.1, I6.2 | C6.8 | `npm run test:integration -- d6/migration` | Old stores unchanged on failure; never Ready; Retry activates with receipt | Restart | planned ("exportable" in D8) |
| AC-RESP-001 (cumulative) | D6 | T6.10, T6.13, T6.17 | "equal to the stored Trade"; "from the result alone" | I6.3, I6.10 | C6.2 | `npm run test:integration -- d6/responses` | Exit and terminal-exit results equal durable state; the UI continues from them | — | planned |
| AC-CAP-001 (cumulative) | D6 | T6.16, T6.18 | `verify:capabilities`; tabs case | — | C6.10 | `npm run verify:capabilities` | Manifest equals reachable operations; nothing later | — | planned |
| AC-DEL-001 (cumulative) | D6 | T6.17 | — | B6.8 | C6.10 | `npx playwright test e2e/d6/offline.spec.ts` | Exits recorded offline after full stop | Second offline restart | planned; other engines **pending RC** |
| AC-DEL-004, AC-DEL-006 (cumulative) | D6 | T6.10, T6.13 | — | I6.13; B6.9, B6.10 | C6.9 | `npx playwright test e2e/d6/runtime-failure.spec.ts` | Exit and Close Review resolution rejected at UI and persistence | Dumps unchanged | planned; real-state **pending RC** |
| AC-DEL-003 (cumulative) | D6 | T6.21 | `verify:releases` | B6.6 | C6.8 | as B6.6 | Tab launch Writable after a schema-changing update | — | planned; Firefox and WebKit **pending RC**; production HTTPS **pending** |
| AC-UI-001, AC-UI-002 (cumulative) | D6 | T6.17–T6.20 | view-state groups | B6.12 | C6.10 | `npx playwright test e2e/d6/responsive-a11y.spec.ts` | State kept across resize; axe clean; keyboard exit | — | planned |
| AC-REBUILD-001 (cumulative) | D6 | T6.5 | rebuild case | I6.14 | — | `npm run test:integration -- d6/rebuild` | Equal normalized views; rebuilt indexes identical | — | planned |
| AC-PERF-001 (cumulative) | D6 | T6.24, T6.25 | structural | Benchmark dataset (section 1.4); query-count test | — | `npm run bench:run` | Budgets met at 24,700 Closed Trades and about 200,000 Executions; bounded Closed-page and Review requests | Open rows, Closed page, and Review groups equal expected before and after the runs | planned |

---

## 9. Clause-level acceptance check

| Scenario | Clause | Covered by | Finding |
|---|---|---|---|
| AC-POS-001 | two opening Executions at different prices and fees, then partial and final closing Executions | I6.3, B6.1 | covered |
| | each fill belongs to one Trade | A18, A76, I6.3 (dump) | covered; cross-Trade arrives with D20 and D21 |
| | Position and open Lots correct | T6.1 | covered |
| | FIFO Lot Matches link exact quantities | T6.1, I6.3 | covered |
| | opening and disposal fees allocated exactly once | T6.1 fee cases, I6.3 | covered |
| | partial realization leaves the Trade Open; final flat closes it | T6.2, T6.10, I6.3 | covered |
| | no price or P&L duplicated onto a Lot Match | A78, T6.1 first case, I6.3 | covered: the derived link holds no price or P&L, and nothing about matching is stored (P23) |
| | evidence: lots/links and histories | I6.3, I6.8 | links are derived from the stored fact version chains (decision 11), so their history is the facts' history; the View history UI arrives in D15 |
| AC-LIFE-001 | Planned, Open, Open, Closed with agreement after each step | T6.2, I6.3 | covered; this completes the scenario |
| | index membership changes in the same commit | T6.6 apply case, I6.3 | covered |
| | Terminal Disposition only from effective disposing facts, separate from Close Reason | A84, T6.2, T6.19, I6.3 | covered |
| AC-POS-004 | trader-directed terminal exit requires exactly one active Close Reason | A77, T6.10, I6.5 | covered |
| | none manufactured for non-agency settlement | — | D7 |
| | Close Review completion, decline, or deferral never blocks closure | T6.10, I6.4 | covered |
| AC-POS-005 | an untouched leg when the entered Trade closes is Not Entered | — | **Finding:** unreachable with one Planned Leg (section 1.2); moves to D10 |
| | Entry Size shortfall at Entry Resolution | T6.3, I6.7 | covered (from the Trade Analysis rules; the scenario's Given lists Not Entered as the zero form) |
| AC-LIFE-003 | Lot-Match agreement differs in a controlled fixture | — | **Reopened by the user (P23, decision 30):** Lot Matches are never stored, so they cannot disagree. Lifecycle agreement on a Closed Trade is surfaced (I6.9); Restore in D8. |
| | a Closed Trade's disagreement | I6.9 (c) | **Finding:** a Closed Trade cannot be mutated (P22), so only migration or Restore (D8) can repair it. Reads surface it, as the scenario requires. |
| AC-REV-001 | one later closed | T6.6, T6.11, I6.10 | covered for the latest session |
| | exact-date Review opened before and after a correction | — | D15 |
| AC-REV-002 | Mark, Debt, settlement, Trade order | T6.11 | Reopened by decision 29. D6 places the owed-reflection group after the walk (P19, P20); settlement still arrives in D7, which marks the scenario full. |
| | global due Debt, not restricted to Open Trades | T6.11, I6.10 | covered by owed-reflection cards (P20), resolving the D5 finding without installing `getDebt` |
| AC-REV-003 | Exit with Intent saves intent only and creates no Trade fact | I6.11, B6.5 | re-proven with the Exit link (A94) |
| AC-REV-006 | due Debt resolved before Complete | T6.11, I6.4, I6.10 | covered for Close Review Debt on non-walked Trades |
| AC-JOUR-003 | (full in D5) | — | Close Review Defer reuses the same Debt (A86); I6.4 shows no blank Entry |
| AC-JOUR-005 | one current outcome per key under retries | I6.12 | covered for the Close Review key |
| AC-JOUR-007 | seven fixed types and Sources | T6.8 | Close Review and Trade Close added; Management Revision, Review Note, Trader Reflection, and the Journal Source remain |
| AC-REF-001 | five Close Reasons | T6.7 | four now; Rolled in D21 (plan definition), full in D22 |
| AC-CALC-002 | known realized-to-date P&L stays a Value | T6.4, I6.16 | covered for one Instrument; multi-Instrument in D10 |
| AC-RESP-001 | exits, terminal exits, and Review resolutions return usable post-commit state | T6.10, T6.13, I6.3, I6.10 | covered |
| AC-DEL-004, AC-DEL-006 | the new writes return `RuntimeNotWritable` at both boundaries | I6.13, B6.9, B6.10 | covered |
| AC-PERF-001 | 25,000 Trades, about 200,000 facts, network disabled | T6.24, T6.25 | covered at nearly the full profile; Abandoned Trades join in D14 |

**Review-queue items for D6, and where they are resolved:**

- *`StateAtEconomicCutoff` for Trades closed after the cutoff (D4 A55):* A88, T6.6, T6.11, I6.10.
- *Lot-Match integrity fixture for AC-LIFE-003:* reopened by P23 (decision 30), since no Lot Match is stored; I6.9 covers Closed lifecycle agreement instead.
- *Exit Action link (D4 A58):* A94, T6.20, I6.11, B6.5.
- *Home for owed reflections outside the walk (D5):* P20, A90, I6.10.
- *Positions closed today in the Review (D5):* P19, A89, I6.10.
- *Close Review Defer reusing D5's Debt, due rule, and resolution:* A86, T6.8, I6.4, B6.2.

---

## 10. Evidence recording

As in D1, D2, D4, and D5, under `evidence/D06/`: `tdd-log.md` (red and green per case), `structural.md`, `provenance.md` (engine and OS versions, never an allowlist), `bench.md` (raw timings, percentile method, dataset provenance including the pinned as-of instant, environment), and `critic-<n>.md`, with each critic defect first reproduced by a failing test.
