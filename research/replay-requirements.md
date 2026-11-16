# Replay: what it must do in the daily review

A running record of the replay interview (started 2026-11-15, from `plan/D09-replay-prototype-handoff.md`). It is research: it changes no product code, tests or plan. The page it leads to is `prototypes/replay/index.html` (round 1). After the user's review a second set was built at `prototypes/replay/round-2.html`; see "Round 2" near the end, which also holds the current recommendation.

## Settled before the interview (handoff section 2)

- Six trades, each on its own Underlying, appear in every visualization: long stock, long call, long put, short put, bullish vertical call spread, bearish vertical put spread.
- Each trade has a bullish and a bearish Mark series, and every visualization has a control that flips between them.
- Every visualization has a slider that reveals the sessions one at a time, left to right.
- Each series runs through expiration: 15 sessions, Mon Nov 2 to Fri Nov 20, 2026, with no gaps.
- Option Marks in the prototype come from a pricing model (Black-Scholes), labelled as a model on the page.
- Every trade has a Plan with a Stop and a Target.
- Eight or more concepts are proposed; the user picks five.

## The goal, in the user's words (handoff section 3)

The trader uses replay every day, in the daily review, to learn: how an option's price responds to moves in its Underlying and to time passing, and how each move changes the position's risk and reward, above all the total dollars at risk and the incremental reward still remaining. A replay that only redraws a price chart has failed.

## Decisions from the interview

Each row: the decision in the user's words, and what it rules out.

| # | Topic | Decision | Rules out |
|---|---|---|---|
| 1 | The moment of use | "A": before the Action, on every open Trade, every day. Replay opens on today's session with the earlier sessions as the lead-up, and must be readable in about ten seconds. A Closed Trade rests on its final session, so the same view serves as a study of the whole Trade. | A view opened only when something surprising happened; a view built only for study after the Trade is Closed; anything that takes minutes to read. |
| 2 | The ten-second read | The headline is the trade-off today: "holding from here risks $X more to gain $Y more", per session, with how both changed. Underneath, the picture teaches why the option moved: the Underlying's move, time passing, and implied volatility. "Learning the price/time/volatility inter-relationships is something I want the app to help traders with." | A replay whose headline is the cause of the move or the path between Stop and Target; a replay that explains option moves by price and time only. |
| 3 | How far the explanation goes | Implied volatility is shown as a figure per session, beside the Marks ("B"). It is derived from the recorded Marks and the contract's known terms, not entered by the trader and not predicted. "I don't want to use Black-Scholes to predict future price but using it to explain volatility based on current prices should be useful." One or two of the five visualizations also split each session's change in the option's Mark into dollars from the Underlying, from the day passing and from volatility ("C"), labelled as an estimate, so the user can judge whether the split earns its cost. The split sums exactly to the real Mark change, with any remainder shown as unexplained. Risk and reward figures never use an estimate. | Words only with no volatility number; any projected or theoretical option price in the app; a volatility the trader types in; a dollar split in every visualization; an estimate mixed into the dollars at risk. |
| 4 | Total dollars at risk | Both ("C"): Risk to stop is the headline and Worst case the outer bound, each in dollars with R beside it, with the session's figure and its change since the session before. "Total means from today's Marks, including profit given back", so a winning Trade has more at risk each session. For stock, the Worst case is the stock going to $0 in a single session. After a Stop is breached, Risk to stop is zero and the Stop Overrun takes its place. | Risk measured from entry; Risk to stop alone; Worst case alone; a softer Worst case for stock (a percentage drop, a multiple of the Stop). |
| 5 | Incremental reward remaining | "C": Reward to target is the headline and Max reward the outer bound, in dollars with R and the change since the session before; an open reward reads "no cap above" and is never drawn as a large number. One figure joins reward to risk each session ("Reward to target $900 for Risk to stop $1,350: 0.67 to 1") beside the Plan's original ratio. Every dollar figure is for the whole Position: "a position with 5 contracts will have the same 0.67 to 1.0 ratio, but the dollar values will be $900 vs $1350." After a Target is reached, the Target Overrun takes its place and the ratio reads "Target reached"; after a breach, "Stop breached". | Reward to target alone; per-share or per-contract risk and reward figures; a ratio shown without its dollars. |
| 6 | The slider | It shows the price action up to the slider's session: "as the trader goes from far left to far right, he is shown how the visualization changes from day to day." It reveals both the price action and the risk and reward dollar values, "either on the same chart or on stacked charts with the same time axis". The calculated values update to the slider's session ("even better"). Later sessions are blank, and each chart's price axis (the range of prices it has room for) is sized from the Plan's Stop, Target and strikes, not from the series, so empty space can't give away where the price goes later. Taken as agreed unless the user objects: the time axis runs the full width to expiration; the Plan's Stop, Target, 1R and planned ratio and the contract's terms stay still; the Marks are as they stand now, with corrected ones flagged (the spec's rule). | A scale sized to the whole series; figures that stay on the latest session while the slider moves; price and risk on charts with different time axes. |
| 7 | Time runs left to right | "I am pretty strongly anchored on time going left to right": it makes the visualization match the actual price chart. Four of the five visualizations have time left to right, and one doesn't. If there are two really good ideas without a time axis, a sixth visualization may be added so both can be seen. More than two: stop and ask. | More than two visualizations without a time axis; fewer than four with one. |
| 8 | Planned against actual | "C": the Plan is the starting column before the first session (its risk at 1.00R, its reward, its ratio), and its two amounts are carried across the risk and reward chart as fixed lines, so each session's Risk to stop is seen above or below 1R at a glance. In the prototype every Trade fills exactly at its planned price and size. | The Plan shown only as text; Entry Quality (planned against actual fill) repeated in replay. |
| 9 | Where replay lives | "B": in the Review card just before the Action, and as a Trade Detail drawer, the same chart in both, resting on the session being reviewed. The overlap rules were left to the planner ("do what you think is best"), with two wishes: a Mark's price can appear when the trader hovers over its point, and the trader can jump to the Trade (or its Price History) and "return to the same spot in the review". The daily price history need not be shown in the replay view. **The planner's design:** (1) the slider's session always has a readout beside the chart holding its Marks and every calculated figure, so nothing depends on hovering; hovering or tapping a point shows that session's Marks, and clicking it moves the slider there. (2) The full session-by-session table is folded shut beneath the chart, there for screen readers and for anyone who wants it. It holds no source or correction detail; a "Price History" link carries that. (3) From the Review card, that link opens Trade Detail on Price History with a "Back to the Review" link that returns to the same Trade's card, the same step, and the same slider session. (4) Today's four risk and reward figures are also in Plan and Risk; that repeat is accepted. (5) Replay shows no expiration payoff. | Replay only in Trade Detail; replay only in the Review; a price that can be read only by hovering; a daily table always open in the Review card. |
| 10 | Stock, single options and spreads | The top panel is always the Underlying. The second panel is the thing held: absent for stock, the option's Mark for a single option, the spread's net value for a spread (each leg's Mark and implied volatility in the readout, not as lines). The risk and reward panel sits beneath. Stops and Targets are mixed across the six trades so both kinds are drawn: stock on the stock's price; long call and long put on the option's Mark; short put on the Underlying's price; both spreads on the spread's net value. One Stop and one Target per Trade. | A separate design per instrument type; each leg of a spread as its own line; every Stop on the same kind of price. |
| 11 | The expiration payoff in replay | "I think replay DOES show expiration payoff for a closed trade." Agreed as "C" ("mostly"): replay's last session shows how each option settled and the final result; a Closed Trade held to expiration may show the payoff line with its final session marked on it; and the one visualization without a time axis may draw the payoff line on an open Trade too, labelled "value at expiration", so the user can judge it on the page. The planner's reservation, not objected to: a Trade sold before expiration gets no payoff line in replay, since that line is a what-if that never happened. | The payoff line presented as today's value; a payoff line in the time-axis visualizations of an open Trade. |
| 12 | Executions and scaling out | "For the visualization where a trader scales out of a trade, let's say starting with 2 contracts and selling 1 partway through... it would have a definite effect on total dollars at risk, vs incremental reward. I would really love to see that sale and have the visualization reflect what it did to risk-reward. Maybe we can put dots or x's on the chart where an execution happened?" Every Execution is marked on the chart at its session and price, with a shape that can't be mistaken for a Mark. After a partial sale the four risk and reward figures are for the remaining Position, so they step down at the sale, the ratio doesn't change, and the realized profit or loss is shown as banked, no longer at risk. | A prototype where every Trade is a plain hold; a sale visible only in a table. |
| 13 | Which trades scale out | "B": three scale-outs, each in one series only, so the same Trade is a plain hold when the bullish and bearish control is flipped. (1) Long call, bullish series: sells half at the Target. (2) Long stock, bearish series: sells half after the Stop is breached. (3) Short put, bearish series: buys back half as the loss accelerates. The other nine series are plain holds. Each scale-out fits its series' price action. | A scale-out that appears in both series of a Trade; a scale-out in every Trade; a full exit before expiration. |
| 14 | What the trader must never be misled by | Ten rules. (1) Implied volatility and the dollar split are labelled "estimate", drawn unlike Marks, never feed the risk and reward dollars, and read "Unavailable" with a reason when no volatility fits. (2) A Stop is not a guarantee: Worst case is always on screen beside Risk to stop, and one series gaps down below its Stop with the Execution below the Stop, so "the realized loss for one example will be > than the risk to stop". (3) An Underlying-price Stop's dollars are the Plan's fixed amount, and the readout says so. (4) A breach is shown at the session where it was first seen, never as an intraday moment. (5) An Execution has its own marker shape and a text label. (6) The payoff line is labelled "value at expiration". (7) "No cap above" is words and a line off the edge, never a number. (8) A Mark is a point; a line never crosses a session without a Mark, and one series leaves a gap "so I can see what that looks like and we can discuss it". (9) Colour is never the only signal. (10) The page says its option Marks are generated by a model for the demonstration. | An estimate styled like a Mark; Worst case folded away; a line bridging a missing Mark. |
| 15 | Scaling in | "Please show scaling in on at least one trade." The Plan needn't say anything about scaling in: it states the full size, and "just having two executions of a buy would be sufficient". The long stock's bullish series buys half on Nov 2 at the planned price and half a few sessions later at a higher price. At the second buy the risk and reward dollars step up; R stays measured against the Plan's 1R for the full size. Plan changes for scaling in are left to a later deliverable. | A Plan field for scaling in; every Trade entered in one fill. |

**Confirmed by the user on 2026-11-16: "I believe we now have a shared understanding."**

## Changes to what the handoff settled

- **"No gaps" now has one exception** (decision 14, rule 8): the long put's bearish series has one session where the option has no Mark and the Underlying has one. The option's line breaks, and that session's risk and reward figures are Unavailable.
- **"A stated volatility" is a stated volatility for each session** (decision 3), set by hand with intent and shown on the page as part of the model.
- **One series holds a scale-in** (decision 15): the long stock's bullish series, whose second fill is above the Plan's price.
- **Three series hold a scale-out** (decision 13). The long stock's bearish scale-out is also the gap below the Stop (decision 14, rule 2): the stock gaps down below its Stop and half is sold below the Stop.
- **Interest rates for the prototype's option calculations** (the user, 2026-11-16): 4% for short-term options and 5.25% for long-term ones. Every prototype option expires in 18 days, so all use 4%. "We will deal with rho properly when we write the actual implementation plan."
- **Up to six visualizations**, not five, if two ideas without a time axis are both really good (decision 7).

## Implications to carry to D9 planning

- **Leaving the Review and coming back.** The return link must restore the Review Date, the Trade, the step and the slider's session, so the address (or held Review state) has to carry them. The prototype is one page and can only show the link.

- **Implied volatility is derived, and can fail.** It needs the option's Mark, the Underlying's Mark for the same session, the strike, the option type, the time to expiration and an interest rate. All but the rate are recorded. It is a Calculation Result: Unavailable when either Mark is missing, when the option's Mark is below its exercise value (no volatility fits), and unreliable on the expiration session or far from the strike, where the price hardly depends on volatility. Stock is Not Applicable. A spread has one figure per leg, never one for the spread.
- **Moved Stops are not in the prototype.** Each prototype Trade keeps its original Stop and Target. How a Management Revision is drawn is left to D9's planning (taken as agreed unless the user objects). Partial exits are in the prototype (decision 12), which reverses the earlier limit.
- **The payoff line in replay needs a spec amendment.** `specs/design/ui-contract.md` line 96 says "Mark-to-Market replay and Expiration Payoff remain separate views". Decision 11 allows the line in replay in two cases. D9's planning decides whether to amend the sentence, after the user has seen the prototype.
- **The dollar split goes one step past explaining volatility.** It uses the pricing model to say how much each cause contributed to an observed change. It predicts nothing, but it is an estimate, and the parts depend on the order they are worked out in. Whether D9 builds it is decided after the prototype.
- **Known inaccuracies to state on screen or in help:** the rate is an assumption; dividends are ignored; the formula assumes exercise only at expiration, which U.S. equity options don't obey (the error is largest for puts deep in the money); and the two Marks may not have been observed at the same instant.

- **Implied volatility is new to the specs.** ADR 0007 says the application "does not project tomorrow's option value or require volatility, rate, or dividend assumptions". Showing volatility's part in a move needs either a volatility figure read back from the Marks or one supplied by the Mark provider. Either is an ADR 0007 amendment and a plan revision; this research only records the need.

## The six trades

All are entered Mon Nov 2, 2026 at the Plan's price; every option expires Fri Nov 20. Fees are left out. Option prices come from Black-Scholes at 4%, with a volatility written by hand for each session. "Bullish" and "bearish" name the Underlying's direction.

| Trade | Plan | Stop | Target | 1R | Planned reward | Ratio |
|---|---|---|---|---|---|---|
| AXIO long stock | 200 shares at $50.00 | AXIO at or below $47.00 | AXIO at or above $56.00 | $600 | $1,200 | 2.00 |
| BREN long call, $100 strike | 4 contracts at $1.61 | call at or below $0.80 | call at or above $4.00 | $324 | $956 | 2.95 |
| CORV long put, $80 strike | 3 contracts at $2.11 | put at or below $1.05 | put at or above $5.00 | $318 | $867 | 2.73 |
| DALE short put, $57.50 strike | short 6 contracts at $0.94 | DALE at or below $54.00 (the put worth $3.50 at expiration) | put at or below $0.20 | $1,536 | $444 | 0.29 |
| ELIX bull call spread, $120/$125 | 4 spreads at $1.86 | spread at or below $1.00 | spread at or above $4.00 | $344 | $856 | 2.49 |
| FENN bear put spread, $40/$37.50 | 10 spreads at $0.78 | spread at or below $0.40 | spread at or above $1.90 | $380 | $1,120 | 2.95 |

What each series shows:

| Trade | Bullish series | Bearish series |
|---|---|---|
| AXIO | **Scale-in:** 100 shares on Nov 2, 100 more at $51.40 on Nov 6. Target reached Nov 17. | **Gap below the Stop and a scale-out:** Mark $48.10 on Nov 6, $45.20 on Nov 9. 100 shares sold at $45.60, below the $47.00 Stop: a realized loss of $440 on shares whose planned risk was $300. The rest is held, with a growing Stop Overrun. |
| BREN | A flat first week: BREN at $97.20 on Nov 2 and Nov 6, the call $1.68 then $1.22. Then a rally through the strike (out of the money to in the money). **Scale-out:** 2 contracts sold at $4.00 on Nov 12. Settles at $6.50. | Volatility rises as BREN falls and cushions the call; Stop breached Nov 9; expires worthless. |
| CORV | Stop breached Nov 6; expires worthless. | Drops through the strike as volatility jumps; Target reached Nov 6. On Nov 9 CORV rises $0.30 but volatility falls from 53% to 44% and the put loses $0.95. **Nov 10 has no Mark for the put.** Settles at $6.50. |
| DALE | Flat for two weeks; the put melts with time; Target reached Nov 16; expires worthless at the cap ($564). | The loss accelerates ($1.10, $1.30, $1.57, $1.31, $1.88, $2.14, $2.84 …). **Scale-out:** 3 puts bought back at $2.59 on Nov 10. On Nov 12 the put ($3.53) already costs more than the Stop's planned amount ($3.50) though DALE ($54.60) is still above $54.00. Stop breached Nov 13; assigned at expiration. |
| ELIX | Above both strikes by Nov 6, yet the spread is $3.43, and reaches its $5.00 cap only at expiration. Target reached Nov 12. | Stop breached Nov 9; expires worthless; the loss stops at the $744 paid. |
| FENN | Stop breached Nov 6; expires worthless. | Climbs to the $2.50 cap; Target reached Nov 12. |

The arithmetic, on one session (BREN bullish, Thu Nov 12, after the sale): sold 2 at $4.00 against $1.61 paid, 2 × 100 × $2.39 = **$478 realized**. The 2 left are marked at $4.13: 2 × 100 × ($4.13 − $1.61) = $504 open, so Trade P&L is **$982**. Risk to stop = 2 × 100 × ($4.13 − $0.80) = **$666** (2.06R). Worst case = 2 × 100 × $4.13 = **$826**. The Mark is above the $4.00 Target, so Reward to target is zero and the Target Overrun is 2 × 100 × $0.13 = **$26**. Max reward: no cap above.

## Concept sketches

Every concept shares the frame the interview settled: the bullish and bearish control; the slider; later sessions blank; the Underlying's Marks and the Marks of the thing held as points; Execution diamonds; a readout for the slider's session with every figure and its implied volatility; the Plan as the starting column; the folded table. Stock simply has no second price panel and no volatility. What differs is the central idea: how the risk and the remaining reward are drawn and what the picture teaches. "Cost" is the cost to build in the app beyond that shared frame.

**Time runs left to right**

**1. Balance.** *Question:* what am I risking against what I can still gain, today? *Central idea:* under the price panels, each session has a red bar hanging down (Risk to stop) and a green bar standing up (Reward to target) from one zero line, like a balance tipping. The red bar is in two parts: the Plan's own risk still exposed, and open profit that would be given back. Thin outer ticks carry Worst case and Max reward; the Plan's 1R and planned reward are lines across. *Teaches:* a winner's risk grows as its reward shrinks; why risk exceeds 1R; a scale-out or scale-in as a step in both bars at once. *Risk and reward:* drawn directly, in dollars, per session. *Instruments:* identical for all six; a capped Max reward is a tick, an open one an arrow off the top. *Weaknesses:* says what changed, not why; Worst case for stock and the short put is far off the scale and needs a broken axis. *Cost:* low. Every figure already exists in `evaluate`; `replay` returns them per session.

**2. Corridor.** *Question:* where is this Trade between the worst that can happen and the best? *Central idea:* one line, the Trade P&L in dollars, drawn over time between four fixed lines: the result at the Stop, at the Target, at the Worst case and at the Max reward. The gap down to the Stop line is the Risk to stop; the gap up to the Target line is the Reward to target. Realized P&L is a solid floor beneath the line once something is sold. *Teaches:* all four figures are one number seen from four places; a spread's corridor is narrow and closed, a long call's is open above, a short put's has a low ceiling and a floor far below. A scale-out pulls the lines in around the P&L line. *Risk and reward:* as the two shaded gaps, labelled in dollars. *Instruments:* the corridor's shape is the lesson; an open side is drawn open. *Weaknesses:* an Underlying-price Stop's line is the Plan's amount, not a promise; the far Worst case needs a broken axis; the gaps are harder to compare across sessions than bars. *Cost:* low to medium: the four boundary results per session are new view fields, each a sum of figures `evaluate` already has.

**3. Why it moved.** *Question:* the option moved today; how much was the Underlying, how much was the day, how much was volatility? *Central idea:* under the price panels, each session's change in the option's Mark is a stacked bar: one part from the Underlying, one from the day passing, one from volatility, with a dot at the real change. A second strip adds the parts up since entry: "the Underlying has given $2.90, time has taken $1.10, volatility has taken $0.40". Risk and reward sit in a compact strip beneath. *Teaches:* the price, time and volatility relationship directly: time's bar is there every day and grows near expiration; volatility's bar shows on the day CORV barely moves and the put drops. *Risk and reward:* the compact strip and the readout. *Instruments:* stock has one cause; a spread shows the net of its two legs. *Weaknesses:* the split is an estimate from a formula, depends on the order of working, and is Unavailable when no volatility fits; it explains the option, not the decision. *Cost:* high: implied volatility, the split, an interest-rate assumption, and amendments to ADR 0007.

**4. Same price, another day.** *Question:* what did time and volatility do to my option, with no formula at all? *Central idea:* for the slider's session, find the earlier session whose Underlying Mark was closest to today's, and join the two option Marks with a bracket: "BREN was $97.20 on Nov 2 too. The call was $1.68 then and is $1.22 now: $0.46 less, 4 sessions later". Only observed Marks are used. *Teaches:* time decay and volatility change as something the trader's own history shows. *Risk and reward:* a bar pair as in Balance, small. *Instruments:* not applicable to stock; works for a spread's net value. *Weaknesses:* needs the Underlying to revisit a price; in a trending series it has nothing to say for days. It can't separate time from volatility. *Cost:* low: a search over the Marks replay already holds, no model.

**5. Share equivalent.** *Question:* how hard does my Position respond to the Underlying now? *Central idea:* a strip showing, for each session, how many shares of the Underlying the Position currently behaves like ("your 4 calls behave like 150 shares, up from 140"), and so the dollars gained or lost per $1 move. *Teaches:* sensitivity and acceleration near the strike (the long call's figure climbs as it goes in the money); the short put behaving like more and more stock as it falls; a spread's figure shrinking toward zero at its cap; stock's figure never changing. *Risk and reward:* a bar pair as in Balance, plus "a $1 drop from here costs about $150". *Instruments:* one scale for all six, which makes them comparable. *Weaknesses:* an estimate from the same formula as implied volatility; it says nothing on time decay. *Cost:* high, the same model and ADR change as concept 3.

**6. The table is the chart.** *Question:* what were the figures, session by session? *Central idea:* no chart panels. A grid with sessions across and figures down (Marks, Trade P&L, Risk to stop, Reward to target, the ratio, implied volatility), each cell holding its number and a small in-cell bar. The slider reveals columns. *Teaches:* the least of any, but nothing is hidden and every number is text. *Risk and reward:* two rows of numbers with bars. *Instruments:* rows are added per instrument. *Weaknesses:* it is Price History with more rows; no shape for the eye; cramped at 320 px. *Cost:* lowest: it extends the Price History grid.

**7. Stop-to-Target strip.** *Question:* how far along is this Trade? *Central idea:* the cockpit's price track, repeated once per session and stacked into a strip: each session is a bar running from Stop to Target with a dot at the Mark, so the dots trace a path between the two edges. Risk and reward are the two lengths either side of the dot, labelled in dollars. *Teaches:* progress and reversals; little about options. *Instruments:* one strip for a value-kind condition, a second for an Underlying-kind one. *Weaknesses:* close to what the rail's tracks and the Review's pressure figure already show; a scale-out changes nothing visible, because the lengths are prices, not dollars. *Cost:* low.

**Time does not run left to right**

**8. Falling to the line.** *Question:* how does my Position's value depend on the Underlying's price, and what is time doing to it? *Central idea:* the Underlying's price runs across and the Position's result in dollars runs upward. Each session is one dot, joined to the last in order, so the Trade draws a trail; the newest dot is solid and older ones fade. Behind it is the line of results at expiration, labelled "value at expiration". With time left, a long option's dots sit above that line and sink toward it; a short put's sit below and rise toward it; at the last session the dot lands on it. The Stop and Target are lines the trail approaches: level lines for an option-value condition, upright lines for an Underlying-price one. Risk to stop is the drop from the dot to the Stop line, Reward to target the climb to the Target line, the Worst case and the cap are the floor and ceiling of the line itself. *Teaches:* everything about option behavior in one picture: steepness is sensitivity, the bend near the strike is acceleration, a dot dropping straight down is time or volatility, the flat top is a spread's cap, the long slope below is the short put's asymmetry. *Instruments:* stock is a straight line and its dots lie on it, which is itself the lesson. A scale-out changes the line, drawn as a second line from that session on. *Weaknesses:* unfamiliar; no time axis, so the date is in the readout and the fading; puts the payoff line in replay, which needs the UI contract amended. *Cost:* medium: the expiration payoff exists (`expirationPayoff`); joining it to replay sessions is new.

**9. Risk and reward map.** *Question:* what did that sale or that added lot do to my trade-off? *Central idea:* Risk to stop runs across and Reward to target runs upward, both in dollars. Each session is a dot. Rays from the corner are reward-to-risk ratios, with the Plan's ratio marked. A held Position's dot slides along a straight diagonal (a dollar more risk is a dollar less reward). A scale-out jumps the dot toward the corner along its ray: the ratio is unchanged and both dollars halve. A scale-in jumps it outward. *Teaches:* exactly the point about scaling: the ratio and the dollars are different things. *Instruments:* identical for all. *Weaknesses:* for a plain hold the dot only moves back and forth on one line, so nine of the twelve series show almost nothing; nothing about option behavior; once a Stop is breached or a Target reached the dot sits on an edge. *Cost:* low.

**The planner's recommendation.** Balance (1), Corridor (2), Why it moved (3), Share equivalent (5) and Falling to the line (8).
- 1 and 2 answer the headline question two ways: bars that compare easily against a line that shows the whole shape. Seeing both is how to choose D9's main chart.
- 3 is the dollar split the user asked to see in one or two visualizations.
- 5 is the one teaching "sensitivity to the Underlying" and "the short put's asymmetry" directly, on a time axis.
- 8 is the one without a time axis, and the idea the user most likely wouldn't have thought of.
- Not recommended: 6 and 7 add little beyond Price History and the rail; 4 is honest and cheap but silent in a trending series, and would serve better as a line in another concept's readout; 9 is the second idea without a time axis, good only for the three scaling series, so it does not clear the "really good" bar for a sixth.

**The user's choice (2026-11-16):** "I agree with 1, 2, 3, 5 and 8. Let's go ahead and do 9 as well." Six visualizations. On the page they are numbered 1 to 6: Balance, Corridor, Why it moved, Share equivalent, Falling to the line, Risk and reward map.

**A rule added with the choice:** "It isn't clear to me whether an individual chart is showing just price, or cumulative risk/incremental reward. I know we are putting the numbers on screen but I would really like that to be visualized." Every visualization draws Risk to stop and Reward to target, never only as numbers, and every panel is titled so price panels and risk and reward panels can't be confused. Why it moved and Share equivalent carry a compact Balance strip for this.

## Decisions the planner made while building (2026-11-16, for the user's review)

The user asked for the work to continue unattended and for each decision to be recorded. None of these changes a decision above.

| # | Decision | Why | The alternative |
|---|---|---|---|
| B1 | **The short put's Target is on the put's own Mark** (at or below $0.20); only its Stop is on the Underlying's price. | A Target on the Underlying's price is measured to the put's value at expiration, which is $0, so Reward to target would equal Max reward on every session and one of the two would teach nothing. | Both on the Underlying's price, as first said in Q10. |
| B2 | **One trade on screen at a time**, chosen with a picker; the six visualizations are tabs; the trade, the series, the visualization and the slider's session carry across. | Six trades times six visualizations at once is 36 charts. Carrying the state across tabs lets one session be compared in all six. | Small multiples of all six trades per visualization. |
| B3 | **Each visualization has the bullish and bearish control and the slider**, in one bar that stays at the top while the page scrolls. The slider starts on the first session; the page remembers where it was left. | The handoff asks for both on every chart. A bar that stays put keeps the slider in reach on a phone, where the charts are several screens tall. | A slider under each chart. |
| B4 | **The trade-off sentence sits in its own box** under the controls and changes with the slider. It is also what a screen reader hears as the slider's value. | It is decision 2's ten-second read. | Only in the readout. |
| B5 | **Implied volatility has its own small panel** on the four time-axis visualizations, as hollow purple shapes, with a dash where it is Unavailable; a spread has one shape per leg. | Decision 3 puts the figure "beside the Marks" on every session; a strip on the shared time axis lets its rise and fall be seen against the prices. | Only in the readout and the table. |
| B6 | **On the expiration session an option Trade is settled**: Risk to stop, Reward to target, Worst case and Max reward are zero and read "Settled"; the headline gives the final result. | Nothing is held after the close, so nothing is at risk. Figures worked from the last Mark would say otherwise. | Keep the Mark-based figures on the last session. |
| B7 | **An Underlying-price Stop whose dollar amount is already passed** (DALE bearish, Nov 12: the put is $3.53, the Stop's planned amount $3.50, and DALE is still above $54.00) shows Risk to stop $0 and a line "Past the Stop's planned amount by $9.00". The Stop is not shown as breached. | The spec keeps the two conditions apart: the Stop is breached only by the Underlying's price, and its dollar distance never goes below zero. This is the case rule 3 of decision 14 warns about, and it deserves the user's eye. | Show it as breached; or show a negative Risk to stop. |
| B8 | **The dollar split is worked out in the order Underlying, then time, then volatility**, per leg, and a spread's split is its long leg's less its short leg's. Where one of the two sessions has no reliable volatility, time and volatility are shown as one part, "together". After a session with no Mark, the change is measured from the last session that had one and is not split. A second strip adds the parts up since the first Mark. | The order makes "time" mean decay at yesterday's volatility. Merging the two parts where they can't be told apart is honest; inventing a split is not. | Another order, which moves dollars between the parts; or dropping the bar where the split fails. |
| B9 | **Share equivalent uses the pricing formula's sensitivity at the session's implied volatility**, drawn hatched and labelled an estimate. For stock it is the shares held, drawn solid, and is exact. | It is the only way to state sensitivity on one session; the ratio of two days' changes is thrown off by time and volatility and is undefined on a flat day. | The observed ratio of the option's change to the Underlying's. |
| B10 | **A Worst case far off the scale is named once in words** at the foot of the panel ("Worst case $4,490, off the scale"), and an open reward is the words "no cap above". Both are always in the readout. | Stock's and the short put's Worst case are 10 to 20 times the Risk to stop; a scale that fits them flattens everything else. | A broken axis, or a scale that fits. |
| B11 | **Corridor draws the risk and reward gaps as one band per session**, not a filled area. | A Mark is a point; a filled area between sessions would claim values that were never observed. | A continuous shaded area. |
| B12 | **Hovering shows a point's figures; clicking a session's column or a dot moves the slider there.** Every figure is also in the readout and the folded table. | Decision 9. | Hover only. |
| B13 | **The series' story and the generator's inputs are folded shut and say that they describe later sessions.** | They would otherwise break "nothing later leaks in". | Leave them out; or show them open. |
| B14 | **A spread's short leg is priced at a slightly different volatility** (1 point below for the call spread, 2 above for the put spread). | So the two legs' implied volatilities differ in the readout, as they do in the market, and "one figure per leg" is visible. | One volatility for both legs. |
| B15 | **Fees are left out** of every figure. | They would add a term to each sum without teaching anything about replay. | Include opening fees. |
| B16 | **On a phone the chart labels shorten** ("Stop −$344" for "Result at the Stop −$344") and every other session is numbered. The folded table scrolls inside its own frame. | Room. The page itself never scrolls sideways. | Hide the labels. |

How the page was checked: every trade, series, visualization and slider position (1,080 states) at 1280, 375 and 320 px for script errors, sideways scroll and broken figures: none. Every session's figures against their definitions (Trade P&L from the Executions' cash flows, each distance and its overrun, the corridor's four results, the split adding up to the real change, implied volatility reproducing its Mark): 2,223 checks, none failed. The slider, the series control and the tabs work from the keyboard.

## The six visualizations against the interview's goals

| Goal | 1. Balance | 2. Corridor | 3. Why it moved | 4. Share equivalent | 5. Falling to the line | 6. Risk and reward map |
|---|---|---|---|---|---|---|
| Read in ten seconds before the Action (decisions 1, 2) | **Best.** Two bars and two dashed lines. | Good on a wide screen; crowded on a phone. | No: it explains, it doesn't decide. Its compact Balance strip carries the decision. | Partly: one figure, but it needs the strip beneath for the decision. | No. It rewards study, not a glance. | Only once the picture is learned. |
| Total dollars at risk and incremental reward, drawn (decisions 4, 5, 6) | **Yes, directly**, with the given-back profit shown as part of the risk. | Yes, as gaps; the Worst case and Max reward are lines, which Balance can only tick. | Only in its strip. | Only in its strip. | For the slider's session only, as brackets. No history of either. | They are the axes, but with no price and no time. |
| Planned against actual (decision 8) | Yes: the Plan column and the 1R and planned-reward lines. | Yes: the Plan column; less obvious than Balance's lines. | In the strip. | In the strip. | No. | Yes: the Plan's point and ratio line. |
| Scaling in and out (decisions 12, 13, 15) | Yes: both bars step. | **Best:** the lines pull in around the banked result, which is the lesson. | Not its subject. | Yes: the figure steps. | Yes, but subtle: the line changes. | **Clearest on the ratio**, when the Stop and Target are untouched (2 of the 4 scaling events; the other 2 land on an edge). |
| Price, time and volatility (decisions 2, 3) | Only through the volatility panel. | Only through the volatility panel. | **Yes, directly**, with a number for each cause. Weakest in the last few sessions, where time and volatility can't be separated, which is when time matters most. | Sensitivity, well; time and volatility, no. | **Yes, without numbers:** the dots sink to the line. | No. |
| Stock, options and spreads in one design (decision 10) | Identical for all. | **The shape differs by instrument, and that teaches** (closed for spreads, open above for calls). | Stock has one cause, so its chart is plain. | **One scale across all six.** | The line's shape is the instrument. | Identical for all. |
| Never misled (decision 14) | Nothing estimated in its own panel. | Nothing estimated. An Underlying-price Stop's line is the Plan's amount (B7). | An estimate throughout; needs its labels read. | An estimate. | Puts the expiration line in replay; relies on its label. | Nothing estimated. |
| Cost in the app | Low. | Low to medium. | High (implied volatility, the split, ADR 0007). | High (the same). | Medium (expiration payoff per frame; UI contract). | Low. |

### What the build showed that the sketches didn't

- **Balance and Corridor are the same figures drawn two ways**, and each has something the other lacks: Balance compares sessions at a glance and survives a phone; Corridor shows the banked result and the closed or open shape. Balance's hatched "profit given back" turned out to be the clearest statement of decision 4.
- **The implied volatility panel does more teaching than expected** for its size. CORV bearish on Nov 9 (the stock up $0.30, volatility down 9 points, the put down $0.95) is visible in every time-axis visualization because of it, not only in "Why it moved".
- **"Why it moved" loses its split when it matters most.** In the last three or four sessions, and for options far in or out of the money, no reliable volatility can be read, so time and volatility merge into one part. The model's limits are structural, not a detail to polish.
- **The map is as narrow as feared.** For a plain hold the dot slides on one line. It earns its place only on the scaling series, and even there two of the four events put the dot on an edge.
- **"Falling to the line" is the richest single picture**, and the hardest to read cold. The short put after its buy-back, with two lines, a level Stop line and an upright one, is at the edge of what one chart can hold.
- **The missing Mark** (CORV bearish, Nov 10) reads clearly: a shaded column marked "No Mark", a broken line, a "?" in the risk panel, and "Unavailable" in the readout. The session after it can't be split or compared with its neighbour, which is correct and visible.

### Recommendation

1. **Make Balance D9's replay chart:** the Underlying's panel, the panel for the thing held, then the risk and reward bars with the Plan column and the 1R and planned-reward lines. It answers the headline question, costs least, uses only figures `replay` already owns, and works at 320 px. It is the one to put in the Review card.
2. **Take two things from Corridor into it:** the "Banked" realized line after a scale-out, and the words for a capped or open reward. Keep Corridor itself as the alternative to revisit if Balance's ticks for Worst case and Max reward prove too quiet.
3. **Add the implied volatility panel when ADR 0007 is amended**, as its own small deliverable. It is the cheapest piece of the price, time and volatility lesson and it stands without the split.
4. **Offer "Falling to the line" in the Trade Detail drawer only**, as a second view beside the time chart, after the UI contract's sentence is amended. It is the learning view; it is not for the Review card.
5. **Defer "Why it moved" and "Share equivalent".** Both need the pricing formula for more than reading volatility back. If one is built later, build Share equivalent first: it is one figure, it fails less often, and it is the direct picture of the short put's asymmetry.
6. **Don't build the map.** Its one lesson (a scale-out keeps the ratio and halves the dollars) is already visible in Balance as both bars stepping together, and can be said in the readout in a sentence.

### For the user to look at first

- BREN bullish in Balance, sliding from Nov 2 to Nov 13: the flat week, the rally, the sale.
- AXIO bearish in Corridor at Nov 9: the gap below the Stop and the banked loss.
- CORV bearish in Why it moved at Nov 9, then Nov 10 and Nov 11: the volatility drop, the missing Mark, and what follows it.
- DALE bearish in Share equivalent, then at Nov 12 for B7.
- ELIX bullish in Falling to the line: the dots closing on the flat top.
- AXIO bullish and DALE bearish in the map, at Nov 6 and Nov 10: the two jumps along a ratio line.

## Round 2 (2026-11-16)

The user reviewed round 1 and asked for a second set. Round 1 stays at `prototypes/replay/index.html` as a record. Round 2 is `prototypes/replay/round-2.html`, on the same six trades and the same Marks (the model block is identical, checked by a diff).

### The user's feedback on round 1

"None of the visualizations has the type of impact I am looking for."

- **Ranking.** Keep and iterate: 1 Corridor ("by far my favorite"), 2 Balance, 3 Share equivalent. Discard and try again: Falling to the line, Why it moved, Risk and reward map.
- **Good.** The generated data; the slider for watching a trade evolve.
- **Information density.** Option trades had four to six charts, so the price (at the top) and the risk and reward (three or more charts down) could not be watched together.
- **Layout.** Risk and reward is the most important chart and came fourth. Every chart was the same size, which gave implied volatility more weight than it merits. Try insets, half-sized charts, and a pop-up on hover.
- **Colour.** When a trade goes against the Plan its Reward to target grows, so the short put's bearish series showed green bars growing while the trade went as badly as it could. "Think about how the risk/reward visualization makes you feel when you look at it."
- **Suggestions.** Not everything has to be a bar. A gauge for profit and loss on screen with the price; an area that grows and shrinks with the price.

### Decisions from the round 2 questions

| # | Decision | The user's words |
|---|---|---|
| R1 | **Lead with how the Trade is going**; what is at stake from here is a secondary window. | "Yes, lead with how is the trade going with what is at stake as a secondary window on the trade." |
| R2 | **Colour follows the result.** Green is money made or banked; red is money lost. Distance still to go is neutral. | "A profitable trade should 'feel green' and a losing trade should 'feel red'." |
| R3 | **The price shown beside the result is the Underlying's.** The option's own Mark is carried by the profit and loss picture, which need not be a line. | "I need to see how the price action affected P&L clearly… I'm not sure that should be a line." |
| R4 | **Two charts at most.** | "Two at most. I worry that on a phone layout we'll never be able to get two charts." |
| R5 | **Price, time and volatility stays, but not as a layout.** No visualization without a time axis; one layout tries the price as an inset. Each picture must read without touching the slider. | "I had to use the slider to gain any information at all from the chart. Just looking at it cold didn't mean anything to me." |
| R6 | **What worked in Corridor was the clear picture of profit and loss**, and that it showed what scaling out did. | "They had the clearest visualizations of P&L, particularly the corridor." "It clearly showed the impact of scaling out of the trade." |
| R7 | **Price and result must be on screen together and both move with the slider.** They need not share one chart. | "I would be fine with a price chart and an additional on-screen visualization of P&L." |
| R8 | **Only what clears the bar is presented.** A layout that fails is replaced, not shown. | "If you feel strongly that a layout failed, then don't present it." |

### The six visualizations of round 2

| # | Name | What it draws | Against round 1 |
|---|---|---|---|
| 1 | **Corridor** | A short price strip, and under it the Trade P&L as an area from break-even, green above and red below, between two rails: the Trade's result at the Stop and at the Target. | Iterated. Three charts removed, the area replaces the line, the red and green gaps became one neutral beam. |
| 2 | **Balance** | One candle per session: the body runs from break-even to the result so far; the wicks run to the result at the Stop and at the Target. The price strip is under it. | Iterated. The opposed red and green bars became a body coloured by the result with neutral wicks. |
| 3 | **Share equivalent** | The price line drawn as thick as the number of shares the Position behaves like, over the P&L area. | Iterated. The strip of bars became the thickness of the price line. |
| 4 | **Ribbon** | One chart. The price line is the spine and the result rides on it as a band: up and green for a profit, down and red for a loss. A beam at the session shown runs from the result at the Stop to the result at the Target. | New. |
| 5 | **Gauge** | A straight meter from the result at the Stop to the result at the Target, with a pointer at the result so far; under it the price and a small P&L strip. | New. |
| 6 | **Inset** | The P&L area takes the card; the price is a small inset beside the headline figure. | New. |

**In all six:** the headline is the Trade P&L in the colour of the result, with a sentence on how it is going ("Ahead: 85% of the way to the Target", "Past the Stop by $213.00") and a second, neutral sentence on what is at stake. The card's edge takes the same colour. Light colour is open profit or loss, solid colour is banked, cross-hatching is past a rail. An Execution after the entry is a dashed line down every chart. Under the charts, one line says what moved since the session before (the Underlying, time and volatility, with a small bar). Implied volatility and the share equivalent are chips that open a small chart on hover, focus or tap. Hovering a session shows its Marks, its result and what moved it.

### Decisions the planner made while building round 2 (for the user's review)

| # | Decision | Why | The alternative |
|---|---|---|---|
| C1 | **The page opens on the last session**; drag left to replay. | R5: the picture must read cold, and in the Review the trader arrives at today. | Open on the first session, as round 1 did. |
| C2 | **The option's own Mark is no longer charted.** It is in the headline's sentence when it matters, the hover, the readout and the table. A Stop or Target set on the option's Mark appears as a rail, in dollars. | R3 and R4: one price chart. | Keep a second price chart. |
| C3 | **The result is a filled area whose edge joins the sessions' Marks.** Each Mark is still a dot and the area breaks at a missing Mark. This reverses B11. | R2 and the user's suggestion of an area: the fill is what makes a winner feel green. The edge is no more than the guide line round 1 already drew between Marks. | Separate columns per session (that is visualization 2). |
| C4 | **Rails are labelled "Stop −$324" and "Target +$956"**: the Trade's result if the Stop or the Target were reached, for the Position as it stands. | Short enough for a phone; the same words in all six. | "Result at the Stop −$324". |
| C5 | **What is at stake is drawn once, at the session shown, in black**: a beam from the result down to the Stop's rail and up to the Target's, each tagged with its dollars. | R1 and R2: it is the secondary window, and it must not be green or red. | A band on every session, as round 1 did. |
| C6 | **Labels are placed in order of importance and a label with no free spot is left out** (the result and the stake tags are always shown; rail labels, "Break-even", Worst case and Max reward give way). Every figure is still in the readout and the table. | 1,080 states at three widths can't be laid out by hand, and overlapping labels are worse than a missing one. | Fixed positions. |
| C7 | **Worst case and Max reward are drawn only when they fall inside the chart's range.** Otherwise they are in the readout, and the Worst case is in the headline's second sentence once the Stop is breached. | They are the outer bound, not the daily read (decision 4). | Round 1's "off the scale" notes. |
| C8 | **Two new sentences in the headline:** how far the result is toward the Target or the Stop, as a share; and, when it is true, "Even at the Stop this Trade would end $316.00 ahead." | They are the plainest form of "how is it going" and of what a scale-out bought. | Dollars only. |
| C9 | **Share equivalent's thickness is measured against contracts × 100**, the most the Position could ever behave like. | One honest scale across the trades. The cost: a spread's line is always thin. | Scale each trade to its own largest value. |
| C10 | **The Ribbon's band has its own scale, shown by a key ("this tall = 1R")**, and the price keeps the chart's only axis. A fainter beam stands at each Execution so that a scale-in or scale-out can be compared. | One chart with two value axes invites reading the dollars off the price axis. A band's thickness can't be misread that way. | Price and dollars on two axes (see the discarded attempts). |
| C11 | **The gauge is a straight meter, not a dial.** | Lengths compare more easily than angles, it reads left (Stop) to right (Target), and it fits a phone's width. | A semicircular dial. |
| C12 | **The Inset's price chart is not lined up with the main chart**; the session's blue line is in both. | An inset can't share the main chart's width. | None; this is what an inset costs. |
| C13 | **On touch there is no hover**: a tap on a session moves the slider there, and the line under the charts carries the same facts. Chips open on tap. | Decision 9. | None. |
| C14 | **Heights are set so the sticky bar, the headline and every chart fit one screen**: 800 px at 1280 wide, 667 px at 375 and 320 wide. Measured for every state. | R4 and R7. | Let the charts be taller and scroll. |

### Attempts discarded before presenting (R8)

- **Price and dollars on one plot with two axes** (the "two axes" idea from the plan for this round): not built. The two scales are unrelated for an option, so every crossing of the two lines would be an accident of scaling. The Ribbon is the single-chart answer instead.
- **A semicircular dial**: replaced by the straight meter (C11).
- **Balance redrawn "from where you stand"** (the result as the fixed axis, the Stop and Target moving): it makes a fixed Stop look as if it moves every day.
- **A coloured heat strip under the price** in place of a P&L chart: it says green or red but not how much.
- **The corridor's rails wrapped around the Ribbon's price line**: three parallel wiggling lines; the beam at the session shown and at each Execution says the same with far less ink.
- **A waterfall of each session's change**: a good day in a losing trade would be green, against R2.
- **The corridor on a Stop-to-Target scale with level rails**: a scale-out changes nothing on it, against R6.

### How round 2 was checked

Every trade, series, visualization and slider position (1,080 states) at 1280, 375 and 320 px: no script errors, no sideways scroll, no broken figures, no chart label outside the window, and the sticky bar, headline and charts within one screen (the tallest needs 659 of 667 px). The round 1 arithmetic checks run against round 2's model block: 2,223, none failed. Twenty interaction checks pass: the slider, both radio groups and the tabs from the keyboard; a chip opening on focus, with Enter, and closing with Escape; the hover on a revealed and on an unrevealed session; a click moving the slider; nothing from a later session in the card, the readout or the table. Screenshots of each visualization were looked at, at 1280, 375 and 320 px.

### Round 2 against the goals

| Goal | 1. Corridor | 2. Balance | 3. Share equivalent | 4. Ribbon | 5. Gauge | 6. Inset |
|---|---|---|---|---|---|---|
| A winner feels green, a loser red (R2) | **Yes.** A hill or a hollow. | Yes, less strongly: separate columns. | Yes (the same area). | **Yes**, and on the price itself. | Yes, for the session shown; the strip is small. | **Yes**, the largest area. |
| Price and result seen together (R3, R7) | **Yes, lined up**, one above the other. | Yes, lined up. | Yes, lined up. | **Yes, in the same place.** | Yes, lined up, but the meter is apart. | Together, not lined up. |
| Reads cold (R5) | Yes. | Yes. | Yes. | Yes, once the key is read. | The meter yes; the history is in the small strip. | Yes. |
| What a scale-in or scale-out did (R6) | **Best:** the rails step and the banked level appears. | Good: the whole candle shortens, with a solid base. | As Corridor, and the line thins or thickens. | The banked layer is clear; the rails only as beams at each Execution. | For the session shown: the markers move in. In the strip, as Corridor in small. | As Corridor. |
| What is at stake, as a second window (R1) | The beam. | The wicks, on every session. | The beam. | The beam on the price point. | The spans under the meter. | The beam. |
| One phone screen (R4) | Yes (653 px of 667 at 320 wide). | Yes (659). | Yes (659). | **Yes, with room** (629): one chart. | Yes (659). | Yes (652). |
| Price, time and volatility (R5) | The line under the charts, the hover and the chips. The same in all six. | Same. | Same, plus exposure on the price line. | Same. | Same. | Same. |
| Cost in the app | Low to medium. | Low to medium. | High (share equivalent, ADR 0007). | Medium. | Low. | Low to medium. |

### What round 2 showed

- **The colour rule fixes the problem the user named.** DALE bearish is red in every view from the first session, and stays red while its Reward to target grows.
- **Corridor is still the clearest**, now in two charts that fit a phone. The step in the rails and the solid banked band make BREN's sale and AXIO's gap sale readable without the slider.
- **Ribbon is the one new idea that earns its place.** A flat price with a red band growing under it (BREN's first week) is time decay with no words, and CORV's put shows the price falling while the green band grows above it. Its weakness is exact dollars: thickness is read against a key, not an axis.
- **Balance and Corridor are still the same figures.** As candles the result is easier to compare session by session and harder to feel.
- **Share equivalent as thickness works for single options and for stock**, and says little for spreads, whose line is thin throughout (C9).
- **The meter is a good summary of one session and a poor history.** It would suit a row in a list of open Trades better than the replay itself.
- **Inset adds nothing over Corridor now that both of Corridor's charts fit a phone.** It is presented because the user asked to see the idea.

### Recommendation after round 2

1. **Build Corridor as D9's replay chart**, with the headline, the one-line "since the session before", the chips and the hover exactly as in round 2.
2. **Use the Gauge's meter where there is no room for a chart**: the collapsed Review card and any list of open Trades. It needs no figures beyond Corridor's.
3. **Keep Ribbon as the candidate for phones**, to be decided after the user has used both on a phone. If only one is built, build Corridor.
4. **Don't build Balance or Inset.** Each is Corridor with one thing changed and nothing gained.
5. **Share equivalent, implied volatility and the price, time and volatility line wait for ADR 0007 to be amended.** When they come, the chips and the one line are the right size for them; the thick price line can be a later option.

Round 2 has no expiration payoff line in replay, so the UI contract's sentence ("Mark-to-Market replay and Expiration Payoff remain separate views") needs no change for any of these six.

**Derived figures Corridor needs from D9** (all sums of what `evaluate` already returns): per session, Trade P&L, realized P&L to date, the Trade's result at the Stop and at the Target, Worst case and Max reward; the same for the Plan Baseline; the share of the way to the Target or the Stop; the lowest and highest result so far (for the meter).

### For the user to look at first in round 2

- DALE bearish in Corridor, last session, then drag left: the trade the round 1 colours got wrong.
- BREN bullish in Corridor at Nov 13: the sale, the banked band, the Stop's rail above break-even.
- BREN bullish in Ribbon from Nov 2 to Nov 12: the flat week, then the rally.
- CORV bearish in Ribbon: the price falls, the green band grows; the missing Mark on Nov 10.
- AXIO bearish in Balance: the gap sale below the Stop.
- DALE bullish in Gauge: a low ceiling and a far floor, on one line.
- On a phone, or a narrow window: Corridor and Ribbon side by side in two tabs.

## Open points

Round 2 adds: whether Ribbon is built as well as Corridor; whether the meter is used in the Review card.

Left to D9's planning: how a moved Stop is drawn; the interest rate used for implied volatility; whether the dollar split and the payoff line in replay are built; and the round trip between the Review and Price History.
