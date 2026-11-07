# D7 approved words (decision 87)

Every user-visible phrase D7's remaining tasks need, approved by the user in one batch on 2026-11-07 (plan revision 54, decision 87), so the UI and validator tasks take their words from here and don't stop to ask. A subagent surveyed T7.11 to T7.24 and T7.26 to T7.32 against the D7 breakdown, decisions 77 to 86, D02-ui-alignment section 2a, the D7 spec reading and the code at revision 53. The user then reviewed every row, chose alternatives or edits where they disagreed, and discussed 22 rows to a resolution.

**How to use this file.**
- A task brief names the rows its task uses. The words here are exact; quotation marks are not part of the text.
- Example values are the breakdown's section 4 fixtures (O-C, O-P, O-S); a task substitutes its own values in the same pattern.
- Where a conflict's resolution and a row cover the same point, they agree; the conflict also names the plan text it amends.
- `verify:wording` still applies: reason and finding words live only in `src/ui/calculation-words.ts`, and a task that changes `PHRASES` or `CODES` grows `tools/wording-rules.test.ts` and plants a word to prove the rule fails on it.
- Words a row doesn't cover still need the user's approval (handoff section 5, condition 2).

**Changes to words that already exist** (task T7.36, before the UI tasks): decision 81's "Settlement due" becomes "Settlement Due" at every length (conflict K4); decisions 82 and 83's quantity findings take the singular at 1 and "in the position" (K9, row 20.6); the stock forms' "Only 2 shares are open." family takes "in the position" (row 20.6, 20.7); stock Execution lines on the receipts drop the fee (C5). `PriceNegative` keeps "A price cannot be negative." (K5).

**Plan text this amends** (each task's amendment note points here): A112 and T7.24 case 1 and B7.3 (K13), A113 (K14), A114's Underlying-price rounding (C3, K6), A119's Long Stock payoff sentence (K1), A100's breakeven on every option rejection (K12, task T7.35), B7.1 (K6), B7.2 and T7.20's "Only 2 contracts are open" (row 20.6: "The position has only 2 contracts."), B7.4 (K4), B7.5 (K11), B7.6 (K5), T7.22's texts (K2, K3, K7), and D7's capability set "between Marks and the Trade walk" (K13).

**Strategy-related rows.** Rows 23.10 and 24.4 key the assignment or exercise sentence by the settlement item's signed quantity, never by the Strategy (decision 88).

## Approved words

### Conventions

| # | Where, and the code or state | Approved words |
|---|---|---|
| C1 | Contract count and plural | "1 contract", "2 contracts", using the existing `plural(n, one, many)` helper |
| C2 | A holding or leg in words: direction first, then count, then label | "Long 2 contracts of XYZ 20 Nov 2026 55 Call", "Short 2 contracts of MNO 20 Nov 2026 45 Put", "Long 1 contract of XYZ 20 Nov 2026 55 Call". A multi-leg structure (D10) gets one line per leg in role order, for example "Short 1 contract of XYZ 20 Nov 2026 50 Put" and "Long 1 contract of XYZ 20 Nov 2026 55 Put"; the lists' one-line Trade column keeps D02 section 2a's format. |
| C3 | An Underlying price (trigger, breakeven, range end, latest close) | No "$"; two decimals: "48.00", "57.00", and 57.0065 shown as "57.01" (conflict K6, which amends A114's at-most-4-decimals rule). Zero is "0.00" (conflict K7). |
| C4 | Settlement time | Short date and clock in the Workspace zone: "Fri Nov 20, 16:00" |
| C5 | An option Execution named in a line (receipts, Detail rows, reflections) | The role's action name, then count and label, with no fee: "Buy to open 1 XYZ 20 Nov 2026 55 Call @ $2.10"; "Sell to open 2 MNO 20 Nov 2026 45 Put @ $1.25". Stock lines drop the fee too: "Buy 60 XYZ @ $50.10" (T7.36). The fee stays in the Execution's details on Trade Detail and inside Net cost. |
| C6 | An option is always named by `instrumentLabel`, never by its OCC key or bare symbol | "XYZ 20 Nov 2026 55 Call" wherever code now prints `instrument.symbol` or `instrumentKey` |
| C7 | A value at expiration with a sign | `signed(money)`: "+$248.70", "−$401.30", "$0.00" |
| C8 | Cash amount of option contracts (Plan form and Execution rows) | Debit: "= $400.00 for 2 contracts"; credit (a short entry or any sale): "= $240.00 credit for 2 contracts" |

### T7.11 Section validators (Trade Record, Catalog, Market Data)

| # | Where, and the code or state | Approved words |
|---|---|---|
| 11.1 | `readiness-copy.ts`, migration issue sentence; a stored Plan whose legs don't fill its Strategy's roles, under a Trade-section code of its own | "A Trade's Plan doesn't fit the roles of its strategy." (a Trade-section code of its own, conflict K17) |
| 11.2 | same; `ExerciseIntentRequired` on a stored long-option Plan | "A long option's Plan records no exercise intent." (startup check only; shown on the screen the app shows when it can't open the journal) |
| 11.3 | same; any other stored-Plan rule failure | Not needed: the startup check tests only shape match and Exercise Intent (decision 88). |

### T7.18 Installed Capability Manifest

| # | Where, and the code or state | Approved words |
|---|---|---|
| 18.1 | About, capability list (identifiers); D7's new variants | `confirmPlan`: `LongCall`, `LongPut`, `CashSecuredPut`. `recordPositionChange`: `Option`, `SellToOpen`, `BuyToClose`, `Expiration`. `getTradeDetail` and `DailyReview.getTrade`: `ExpirationPayoff`, `SettlementDue`. `DailyReview.open`: `SettlementFamily`. `browseTrades` and `MarketData.save`/`query`: `Option`. Strategies: the manifest's product keys `strategy.long-call`, `strategy.long-put`, `strategy.cash-secured-put` (already in T7.9) |

### T7.19 UI: option Plan form (`PlanForm.tsx`, `plan-issues.ts`)

| # | Where, and the code or state | Approved words |
|---|---|---|
| 19.1 | Plan form, card heading for the contract fields; option Strategy selected | "Contract" |
| 19.2 | label; Underlying symbol (option) | "Underlying" |
| 19.3 | label; expiration date input | "Expiration date" |
| 19.4 | label; strike input | "Strike" |
| 19.5 | label and read-only value; the right, fixed by the Strategy | Label "Type", value "Call" or "Put" (read-only, fixed by the Strategy). The code's field stays `right`. |
| 19.6 | label; contract count | "Contracts" |
| 19.7 | label; intended entry price per share | "Intended entry price (per share)". The screens say "price", never "premium". |
| 19.8 | hint beside the price; cash amount at 1 contract, and for the Cash-Secured Put | "= $150.00 for 1 contract"; "= $240.00 credit for 2 contracts" (C1, C8) |
| 19.9 | label; the Stop as an Underlying trigger; the direction comes from the Strategy | Long Call and Cash-Secured Put: "Stop (XYZ at or below)"; Long Put: "Stop (ABC at or above)"; with no symbol typed yet: "Stop (Underlying at or below)" |
| 19.10 | label; the Target trigger | Long Call and Cash-Secured Put: "Target (XYZ at or above)"; Long Put: "Target (ABC at or below)" |
| 19.11 | note, shown when Cash-Secured Put is chosen (A101: cash coverage isn't proven) | "The app doesn't check that you have the cash to buy the shares if you're assigned." |
| 19.12 | field error beside Target; `TargetNotBeyondEntry` with `breakeven`, Long Put | "The Target must be below the breakeven, 48.50." (Long Call and Cash-Secured Put: A100's "The Target must be above the breakeven, 57.00.") |
| 19.13 | field error beside Stop; `NoPositiveRisk` with `breakeven` | Cash-Secured Put and Long Call: "The Stop must be below the breakeven, 43.80, so the Plan has a positive risk."; Long Put: "The Stop must be above the breakeven, 48.50, so the Plan has a positive risk." |
| 19.14 | field error beside Stop; `NoPositiveRisk` on a long option | Not needed: the domain adds the breakeven to a long option's `NoPositiveRisk` (conflict K12, task T7.35), so row 19.13's sentences apply to every option Strategy. |
| 19.15 | field error beside Stop; `StopTargetOrder` | Long Call and Cash-Secured Put: "The Stop must be below the Target."; Long Put: "The Stop must be above the Target." |
| 19.16 | field error beside expiration date; `ContractAlreadyExpired` (checked against the Plan time, not today) | "The expiration date must be on or after the Plan date." |
| 19.17 | field error beside Contracts | One sentence per code: `InvalidQuantity` "Enter a number of contracts greater than zero."; `ContractQuantityNotWhole` "Enter a whole number of contracts." |
| 19.18 | field error beside Strike | One sentence per code: `InvalidStrike` "Enter the strike as a number below 100,000."; `StrikeNotPositive` "The strike must be greater than zero."; `StrikeTooPrecise` "Enter the strike with at most 3 decimal places." |
| 19.19 | field error beside expiration date; `InvalidExpiration` (not a date, or outside 2000 to 2099) | "Enter an expiration date in the years 2000 to 2099." |
| 19.20 | field error beside Underlying; `RootTooLong` (root over 6 characters) | "Options can be recorded only on symbols of up to 6 characters, not counting a “.”." |
| 19.21 | field error beside Underlying; `MissingInstrument` on an option Plan | "Enter the Underlying symbol, such as XYZ or BRK.B." |
| 19.22 | field error beside the price; `InvalidPrice` on the option entry | "Enter an intended entry price greater than zero, with at most 6 decimal places." (existing) |
| 19.23 | field error; codes this form can't produce | `InvalidRight`: "The type must be Call or Put." `ExerciseIntentRequired`: "Say whether you plan to exercise this option if it is in the money." `ExerciseIntentNotApplicable`: "Only a long option takes an exercise intent." `ConditionCountNotOne`: "An option Plan takes one Stop and one Target." No option code falls back to "Check the Plan." |

### T7.20 UI: option Execution form (`PositionChangeForm.tsx`, `position-change-issues.ts`, receipts)

| # | Where, and the code or state | Approved words |
|---|---|---|
| 20.1 | Entry card term; the contract (replaces "Symbol" for an option) | Term "Contract", value "XYZ 20 Nov 2026 55 Call" |
| 20.2 | Entry card, Planned Leg value; option leg | "Long 2 contracts of XYZ 20 Nov 2026 55 Call" (C2) |
| 20.3 | Trade card progress line; contracts entered so far | "1 of 2 contracts entered" |
| 20.4 | Execution row labels; option rows | "Contracts", "Price (per share)"; fee and Economic Time unchanged |
| 20.5 | hint per row; cash amount | "= $210.00 for 1 contract"; a sale: "= $300.00 credit for 1 contract" (C8) |
| 20.6 | row error; `ExceedsOpenQuantity`, and with no `available` | "Execution 1: The position has only 1 contract." (stock: "Execution 1: The position has only 60 shares.", T7.36); fallback "Execution 1: more contracts than the position has." (stock: "…more shares than the position has.") |
| 20.7 | form error (members); a later recorded exit left without enough | "This exit would leave a later recorded exit without enough contracts in the position." (stock: "…without enough shares in the position.", T7.36) |
| 20.8 | row error (Economic Time); `AfterExpiration` on a new Execution | "Execution 1: the Economic Time cannot be after the expiration date, Fri Nov 20." |
| 20.9 | row error (quantity) | One sentence per code: `InvalidQuantity` "Execution 1: enter a number of contracts greater than zero."; `ContractQuantityNotWhole` "Execution 1: enter a whole number of contracts." |
| 20.10 | row error (price); invalid option price | "Execution 1: enter a price greater than zero, with at most 6 decimal places." (existing) |
| 20.11 | Conflict reload banner, Position value; option position | "Long 1 contract of XYZ 20 Nov 2026 55 Call"; "Short 2 contracts of MNO 20 Nov 2026 45 Put" (C2) |
| 20.12 | Entry and Exit receipts, Execution line; option Execution | "Buy to open 1 XYZ 20 Nov 2026 55 Call @ $2.10" (C5) |
| 20.13 | Lot Matches table column headers (receipt and Detail); an option Trade | "Opened", "Closed" for every option Trade (stock keeps "Bought", "Sold") |
| 20.14 | Changed Lot Matches note; an earlier-dated option exit | "This exit is dated before a later recorded change, so the closing Executions are matched to the opening ones again in order. The matches that changed:" |
| 20.15 | Entry Size Deviation sentences (receipt and Detail); option Deviation quantity | "Entry Size Deviation: 1 contract above plan, caused by this Position Change."; Detail: "Entry Size (Excess): 1 contract above plan, caused by the Position Change at 2026-10-12 11:00." |

### T7.21 UI: expiration form (`ExpirationForm`, new)

| # | Where, and the code or state | Approved words |
|---|---|---|
| 21.1 | card heading; the read-only settlement terms | "Expiration" |
| 21.2 | read-only terms; contract, quantity, settlement time | "Contract", "Quantity", "Settlement time" |
| 21.3 | read-only values; item's quantity and time | "XYZ 20 Nov 2026 55 Call"; "Long 1 contract" or "Short 2 contracts"; "Fri Nov 20, 16:00" (C2, C4) |
| 21.4 | hint under Settlement time; P26: the time is fixed, not entered | "The close of the expiration session." |
| 21.5 | section heading; Position Change Reflection on the Expiration | "Reflection on this expiration" |
| 21.6 | submit button; save | "Save expiration" |
| 21.7 | issue summary heading; rejected save | "This expiration can’t be saved yet" |
| 21.8 | form error; `ExpirationMustSettleAllOpen` (only after the Trade changed) | "The expiration must cover all 2 contracts in the position. Load the latest Trade and try again." |
| 21.9 | form error; `SettlementTimeInvalid` | "The settlement time must be on or before the expiration date and after every Execution on the contract." |
| 21.10 | form error; `EconomicTimeInFuture` for the settlement time | "The settlement time cannot be in the future." |
| 21.11 | Conflict banner body (heading reused: "This Trade changed after you opened this form"); `Conflict` | "Nothing was saved. The Trade changed after this expiration was offered, so review the Trade before recording it. Your choices are kept below." |
| 21.12 | status and error states; loading; load failure; nothing due | "Loading the expiration form…"; "We couldn’t load this expiration form. Nothing was changed."; "This Trade has no contract due for settlement." |
| 21.13 | receipt page title; saved | "Expiration recorded" |
| 21.14 | receipt line under "Position Change at 2026-11-20 16:00"; also the Review's Reflections panel and owed card | "Expiration of 1 XYZ 20 Nov 2026 55 Call, no price or fee" |
| 21.15 | Lot Matches "Closed" cell; a Lot disposed by the Expiration | "Expired on 2026-11-20 16:00" |
| 21.16 | receipt Result list; no Close Reason for an Expiration | No Close Reason row on the expiration receipt. |
| 21.17 | receipt link when the form was opened from the Review (conflict K14) | "Back to the Review" |

### T7.22 UI: payoff view (`PayoffView`, new)

| # | Where, and the code or state | Approved words |
|---|---|---|
| 22.1 | section headings (Detail; Planned also after confirmation); Planned and Current views | "Planned Expiration Payoff", "Current Expiration Payoff" |
| 22.2 | note under each heading | No note. |
| 22.3 | table caption, which also labels the SVG; Planned; Current with its realized offset | "Planned payoff at expiration by XYZ price"; "Current payoff at expiration by XYZ price, including +$88.70 realized to date" (C7; "$0.00" after PC2) |
| 22.4 | table column headers; segments (the chart's required text equivalent, A114) | "XYZ at expiration", "Payoff at start", "Change per $1 rise in XYZ" |
| 22.5 | range cells; a closed segment; the final ray | "0.00 to 55.00"; "55.00 and above" |
| 22.6 | value cells; value at start and slope | `signed(money)`: "−$400.00", "+$200.00", "$0.00" (C7) |
| 22.7 | zero-set row and chart label; `Touch` (DEF case: at 0) | "Breakeven at 0.00, touched without crossing" |
| 22.8 | zero-set row and chart label; `ZeroRange` (X1′: [0, 55]) | "Breakeven from 0.00 to 55.00" |
| 22.9 | zero-set row; empty zero set | "No breakeven" |
| 22.10 | extremum rows; attained at a point; on a ray; on several parts | "Max profit $4,850.00 for ABC at 0.00"; "Max loss $150.00 for ABC at 50.00 and above"; parts joined with " and ": "… at 0.00 and from 55.00 to 60.00" |
| 22.11 | extremum rows; `Unbounded` Above or Below | "Max profit: unlimited", "Max loss: unlimited": a payoff-extremum wording in `calculation-words.ts`; "unlimited" joins `PHRASES` (conflict K2) |
| 22.12 | extremum rows; a Maximum of 0 or less, or a Minimum of 0 or more | "No profit: at best −$50.00 for XYZ at 55.00 and above"; "No loss: at worst $0.00 for XYZ from 0.00 to 55.00" (X1′); "Max profit" and "Max loss" when the sign fits (conflict K3) |
| 22.13 | chart text at the last ray; flat ray | "stays at −$150.00" (A114's "continues rising" for a rising ray) |
| 22.14 | chart axis labels; SVG text | x: "XYZ at expiration"; y: "Payoff" |
| 22.15 | chart marker label (Current); the latest-close point (A122) | "Latest close 52.00: −$401.30" |
| 22.16 | A122 line with a positive value; `ExpirationValueAtUnderlyingClose` is a gain | "If MNO is at 46.00 at expiration: +$248.70" (C7) |
| 22.17 | Underlying prices in every payoff text | Every Underlying price with two decimals, including zero: "0.00", "55.00" (conflict K7). T7.22's "from 0 to 55.00" reads "from 0.00 to 55.00". |

### T7.23 UI: option lists and Trade Detail (`TradeList.tsx`, `TradeDetail.tsx`, `figures.ts`, `format.ts`)

| # | Where, and the code or state | Approved words |
|---|---|---|
| 23.1 | Plan card term; the contract | Term "Contract", value "XYZ 20 Nov 2026 55 Call" |
| 23.2 | Plan card and Fulfillment terms; the option leg | "Long 2 contracts of XYZ 20 Nov 2026 55 Call" (C2) |
| 23.3 | Summary card figure; open against planned | "1 of 2 contracts" |
| 23.4 | Position figure, and the Owed card's Position; open option position | "Long 1 contract of XYZ 20 Nov 2026 55 Call"; "Short 1 contract of MNO 20 Nov 2026 45 Put" (C2) |
| 23.5 | At entry figure; lots after the last close | "1 contract" |
| 23.6 | Executions rows and their Instrument detail; option Execution | Summary "Buy to open 1 XYZ 20 Nov 2026 55 Call @ $2.10 2026-10-12 10:00" (C5); Instrument value "XYZ 20 Nov 2026 55 Call" (C6) |
| 23.7 | Detail record of the Expiration (not an Execution) | A section "Settlement (1)" after "Executions (3)", row "Expiration of 1 XYZ 20 Nov 2026 55 Call 2026-11-20 16:00", details "Instrument", "Settlement time", "Position Change", no fee row |
| 23.8 | Integrity panel cells; option Entry Size Deviation | "1 contract", "1 contract below plan" |
| 23.9 | Settlement Due panel (Detail): heading and fields; `Due` item | Heading "Settlement Due" (conflict K4); terms "Contract", "Quantity", "Expired", "Settlement time"; values "MNO 20 Nov 2026 45 Put", "Short 2 contracts", "Fri Nov 20", "Fri Nov 20, 16:00" |
| 23.10 | Settlement Due panel (Detail), explanation; the assignment or exercise limit (decision 10) | Keyed by the item's signed quantity, never the Strategy (decision 88). A short contract: "If it was assigned, this release can't record the assignment yet, so this Trade stays open until a later release can."; a long contract: "If it was exercised, this release can't record the exercise yet, so this Trade stays open until a later release can." |
| 23.11 | Value at expiration when it has no number; `Unavailable(MarkMissing)` or `Unavailable(SettlementDue)` | Term "Value at expiration at XYZ's latest close", value the module's figure: "Mark missing: XYZ, Fri Nov 20" or "Settlement Due: XYZ 20 Nov 2026 55 Call" |
| 23.12 | Terminal Disposition (Detail, receipts, Owed card) | "Closed via buyback of 1 contract"; "Closed via buyback of 1 contract and expiration of 1 contract"; sale only: "Closed via sale of 1 contract"; A108's "Closed via sale of 1 contract and expiration of 1 contract" |
| 23.13 | Option Disposition Timing (Detail), the two "Fully" cases with both quantities (A119) | "Fully held to expiration: 0 before expiration, 2 at expiration"; "Fully disposed before expiration: 1 before expiration, 0 at expiration" |
| 23.14 | Closed list Disposition cell, with Option Disposition Timing | "Closed via buyback", "Closed via buyback and expiration"; timing after a middle dot in the same cell: "Closed via sale and expiration · Mixed", "Closed via expiration · Fully held to expiration" |
| 23.15 | Closed list Close Reason cell; a Trade closed by expiration | "Not needed" |
| 23.16 | Trade Summary strike with decimals; `Option` summary, strike 52.5 | A strike with decimals shows cents in the Trade Summary: "Long 1 Nov 20 $52.50 Call"; a whole strike stays "$300". The contract label keeps "52.5". |
| 23.17 | Conditions table for options | Extra columns "Value at expiration" ("$0.00", "$5.00" per share) and "Distance on XYZ" ("4.00") |
| 23.18 | Valuation section, the Underlying's Mark | Term "Underlying Mark", value "$52.00 · Manual" |
| 23.19 | the expiration line on a Closed or expired option Trade | "Expired Fri 20 Nov 2026", where an open one shows A119's "Expires Fri 20 Nov 2026" |

### T7.24 UI: Review settlement and option Marks (`ReviewView.tsx`, `ReviewCard.tsx`, `CardMarks.tsx`, `MarkEntry.tsx`, `mark-issues.ts`)

| # | Where, and the code or state | Approved words |
|---|---|---|
| 24.1 | Settlement panel header, summary; the panel's progress | "Short 2 contracts, expired Fri Nov 20" |
| 24.2 | Settlement panel header, status badge; owed or recorded | "Needed"; after recording: "Recorded" |
| 24.3 | collapsed card, what remains; a due settlement | "Settlement", in the work order: "1 Mark · Settlement · Action" |
| 24.4 | Settlement panel, assignment or exercise explanation | Keyed by the item's signed quantity (decision 88). A long contract: "If it was exercised, this release can't record the exercise yet, so this Review stays incomplete until a later release can"; a short contract: A112's "If it was assigned, this release can't record the assignment yet, so this Review stays incomplete until a later release can". |
| 24.5 | overview blockers list; a due settlement blocker, listed after Missing Marks (decision 61) | Decision 81's sentence with K4's capital, its contract linking to the card's Settlement panel: "Settlement Due for MNO 20 Nov 2026 45 Put, which expired Fri Nov 20" |
| 24.6 | a screen-level settlement section | None (conflict K13): the card's Settlement panel and the overview's blockers list carry it. |
| 24.7 | Mark save error; Market Data `AfterExpiration` | "This contract expired on Fri Nov 20, so it has no Mark for a later date." |
| 24.8 | card payoff summary (Current) | One line: "At expiration: breakeven 43.76 · max profit $248.70 · max loss $8,751.30" |
| 24.9 | settlement item note when the expiration date isn't a session (A111's `NotASession`) | "Fri Apr 3 wasn't a trading session, so the settlement time is the close of Thu Apr 2." |

## Conflicts and their resolutions

| # | Conflict | Resolution |
|---|---|---|
| K1 | A119 has a Long Stock Detail show "Expiration payoff: not applicable, because this Trade has no option"; decision 81 approved "Not applicable: no option expiration" for `NoOptionExpirationAnchor`, and `verify:wording` fails a screen that writes "not applicable" itself. | Long Stock Detail shows both payoff headings (row 22.1), each with the module's figure "Not applicable: no option expiration". A119 is amended to match. |
| K2 | T7.22 and C7.1 say "Max profit: unlimited"; the prefactor words every `Unbounded` result "Unbounded above". | A payoff-extremum wording in `calculation-words.ts`: "Max profit: unlimited" and "Max loss: unlimited". "unlimited" joins `PHRASES`. Every other `Unbounded` result keeps "Unbounded above". |
| K3 | The glossary's Payoff Maximum and Minimum are signed; T7.22's labels are wrong when a Maximum is 0 or less (DEF Touch) or a Minimum is 0 or more (X1′). | Row 22.12. |
| K4 | The plan's prose and glossary capitalize Settlement Due; decision 81 approved "Settlement due", and `PHRASES` matches case-insensitively. | "Settlement Due" at every length: decision 81's words recapitalized in `calculation-words.ts` and `PHRASES` (task T7.36): "Settlement Due", "Settlement Due: XYZ 20 Nov 2026 55 Call", "Settlement Due for XYZ 20 Nov 2026 55 Call, which expired Fri Nov 20". B7.4 expects "Settlement Due". |
| K5 | B7.6 expects "A price can't be negative"; the built code and its tests say "A price cannot be negative." | Keep the built sentence; amend B7.6. |
| K6 | B7.1 expects the breakeven shown as "57.01"; A114 rounds Underlying prices to at most 4 decimals. | Two decimals, "57.01" (convention C3); A114's display rule becomes two decimals for Underlying prices. |
| K7 | T7.22 writes the price 0 with no decimals and 55 with two. | "0.00" everywhere; T7.22's "from 0 to 55.00" becomes "from 0.00 to 55.00" (row 22.17). |
| K8 | A119's "Expires Fri 20 Nov 2026" is a third date format. | Keep it for the expiration line only (row 23.19): a far date needs its year. |
| K9 | The approved findings always write "contracts" ("is more than the 1 contracts open"). | Convention C1 with row 20.6's "in the position": "is more than the 1 contract in the position" / "is more than the 2 contracts in the position", and "doesn't settle the 1 contract in the position" / "doesn't settle all 2 contracts in the position" (task T7.36). Stock sentences use the same plural helper ("The position has only 1 share."). |
| K10 | A108 and A119 give only sale and expiration; a Cash-Secured Put bought back is closed by a purchase. | "Buyback": rows 23.12 and 23.14. |
| K11 | B7.5's "Stop exit 2.50 above entry 2.00" describes a trader-estimated exit price for an XYZ-price Stop, which P24 rejected. | Amend B7.5 to D7's XYZ-only conditions: the form rejects the Stop at 61 with `NoPositiveRisk` and `StopTargetOrder`, worded by rows 19.13 and 19.15. Option-price Stops and Targets arrive in D7S (decision 89). |
| K12 | A100 says rejections name the breakeven; the built `assessPlan` attaches it only to a short leg's `NoPositiveRisk`. | The domain adds the breakeven to a long option's `NoPositiveRisk` (task T7.35, before T7.19), so row 19.13 applies to every option Strategy. |
| K13 | A112, T7.24 case 1 and B7.3 place a settlement family "between Marks and the walk"; after D5R (P36, decision 61) Marks live in each card. | No screen-level settlement section. The card's Settlement panel and the overview's blockers list carry it. A112, T7.24 case 1, B7.3 and D7's capability set are read that way. |
| K14 | A113 has the Review host the expiration form and offer Refresh Review, citing D6 A94, which decision 72 withdrew. | The Review hosts no expiration form. The Settlement panel's Record expiration opens the expiration form on its own page; its receipt offers "Back to the Review" (row 21.17). No Refresh Review. |
| K15 | The glossary's Option Disposition Timing names differ from the short labels. | Short labels confirmed: "Fully held to expiration", "Fully disposed before expiration", "Mixed". |
| K16 | `evaluate.ts` and `payoff.ts` write English `Unbounded` explanations. | No screen shows a domain explanation string; anything shown for an `Unbounded` result is worded in `calculation-words.ts`. |
| K17 | `MIGRATION_ISSUES` is keyed by code. | The Trade section reports codes of its own (rows 11.1, 11.2); it never reuses the Catalog's `StrategyShapeMismatch`. |
| K18 | Code shows an option by its key or bare symbol: `CardMarks.tsx` row heading and aria-label, `ReviewView.tsx` "Instruments:" list, `CardFigures.tsx` Mark line, `TradeDetail.tsx` Execution rows, the receipts' Execution lines, the Review's Mark links. | Convention C6 everywhere listed. The label is built from the Instrument, never parsed from the key (so BRK.B stays BRK.B), and the e2e helpers and the card's focus code move to the new aria-label. |

## Open questions and their answers

| # | Question | Answer |
|---|---|---|
| Q1 | An expiration date outside calendar coverage (2024 to 2028, decision 54): A111's `Historical(expirationDate)` frame is `SessionPolicyNotCovered`. | The item shows the module's "outside the market calendar" figure in place of the settlement time and offers no Record expiration. Tech debt item 18. |
| Q2 | The Action panel on an expired contract (T-1 and T-3 on Monday, T7.14). | No new text in D7: the Action panel stays as for any walked Trade, and the Settlement panel explains what is owed. |
| Q3 | Show or hide a figure that does not apply: Option Disposition Timing on a Closed stock Trade; value at expiration on a Planned option Trade. | Hidden. (The payoff views on a Long Stock Detail are shown, per K1.) |
