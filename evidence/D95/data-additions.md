# D9.5 data additions

Coordinator data added so the screens can show what the approved prototype shows (standing approval, decision 131). Fields only; no new figure or computation.

| Task | Field | Built from | For |
|---|---|---|---|
| T95.4-D1 | `day` on every save result; `day.lines` Marks to go and Close Review flag; `meter.previous.zone`; expires on the Review Date | the same pass as the save | the day card, T95.10, T95.11 (decision 129) |
| T95.16-D1 | `DailyTradeReview.plan: { thesis, invalidation }` | the Trade Analysis record `getTrade` reads | the Plan box (decision 130) |
| T95.16-D2 | `WalkedTrade.pnl: { dollars, planR, change }` | the evaluation `open` reads | the collapsed header (decision 131) |
