# D9.5 data additions

Coordinator data added so the screens can show what the approved prototype shows (standing approval, decision 131). Fields only; no new figure or computation.

| Task | Field | Built from | For |
|---|---|---|---|
| T95.4-D1 | `day` on every save result; `day.lines` Marks to go and Close Review flag; `meter.previous.zone`; expires on the Review Date | the same pass as the save | the day card, T95.10, T95.11 (decision 129) |
| T95.16-D1 | `DailyTradeReview.plan: { thesis, invalidation }` | the Trade Analysis record `getTrade` reads | the Plan box (decision 130) |
| T95.16-D2 | `WalkedTrade.pnl: { dollars, planR, change }` | the evaluation `open` reads | the collapsed header (decision 131) |
| T95.16-D3 | `day.lines[].action` (the Action saved for the Review Date) | the Actions `open` already reads | "Done · Hold" in the card header and day card |
| T95.17-D1 | `DailyTradeReview.expiration { date, sessionsLeft? }`; `datedLastClose.meter` | the open Lots and calendar `getTrade` reads | the Now box's Expiration row; the dated close's drawing |


- T95.42: `OwedReflection.requires` (from the DebtProjection `reflectionsOf` already holds); `TradeDetailDebt.requires` and `NarrativeDebt.requires` (from the stored Debt the narrative read already loads; spread only when present); `day.lines[].needs` may be `'SayWhy'`. No added read.
- T95.37: `DailyTradeReview.planExit` and `OpenTradeDetail.planExit` (one `PlanExitFacts`: per open Position its signed quantity and headline conditions with their status; the Holds saved past a line; the most recent Action when an Exit, with its reason). `JournalPage.actions` (the Trade's saved Actions with reasons, from the entries the narrative read already loads) and `ReviewDateActions.onDate` (the Review Date's own Action with its reason, from the byAnchorTrade read a card already makes). Trade Detail reads the replay only when a saved Hold counts (decision 133): one more observations read for a stock Trade, one per Instrument for an option.
- T95.41: `ReviewTradeItem.exitCarry { direction, held, sold? }` (on the page's walked items and the card's `attention`; present only when the most recent Action before the Review Date is an Exit and a Position is open). `held` is the first open Position unsigned; `sold` is the closing-side Executions dated after the Exit's Review Date (exchange-local, America/New_York as the sale measure reads it), absent when none. Built from the Trade's facts `open` and `getTrade` already derive; no added read.
