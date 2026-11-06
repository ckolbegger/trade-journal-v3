# D7 prefactor: one Calculation Result throughout, task breakdown

Status: **design approved by the user, 2026-11-04 (P63–P76, A181–A188).** The user raised tech debt item 5 before D7, as D7's opening note requires (decision 69). In one design session the user then settled the choices in section 1. Plan revision 42 (decision 77) adds this breakdown and its amendment notes (section 8) to the frozen plan.

The prefactor runs **after D6 and before D7's first task**. It starts from the commit tagged `claude-opus-5.5-d6`, plus plan revisions 41 and 42. It changes product code, tests and one verify check. No stored data, schema, index or facade *operation* changes, but the *shapes* of results do change, and so does some on-screen wording, as section 1.4 lists.

**Why.** When a figure has no number, the reason starts in Trade Analysis as a Calculation Result, `Unavailable(reason, detail)` or `NotApplicable(reason)`. Daily Review then converts it into three home-made copies: `PressureBasis` `NotComparable`, `RangePosition` `NotPlaced` and `AttentionReason`, with a private `RiskReward` `Missing` in between. Each copy drops or renames something:
- `PressureBasis` merges an acknowledged Mark with a missing one.
- `attentionOf` reports any reason that isn't `MarkMissing` as `AcknowledgedUnavailable`.
- `riskRewardOf` reports any reason that names an Instrument as `MissingInput`.

So a date outside session-policy coverage reads "Mark missing" on the slider, "Mark acknowledged unavailable" in the attention reason, and "Not available" in the Trades list. The reason is then worded separately in about eight places, in differing words, some with a catch-all for codes they don't know. The Review shapes name an Instrument only by its symbol string. D5R's T5R.16-B3 (the slider reading an acknowledged Mark as missing) was this kind of defect. D7 adds `SettlementDue` and option contracts, and D10 and D11 add further reasons.

**Goal.** Every reason a figure has no number is represented once, in the domain, as a typed case of the Calculation Result, and is carried unchanged to every screen. It is worded once, in one UI module, at the length each screen needs. Adding a reason is one type change and one wording change, and TypeScript fails the build at every switch that doesn't handle it.

---

## 1. Decisions and assumptions

### 1.1 What changes and what stays

| Today | After the prefactor |
|---|---|
| `CalculationResult<T, Reason extends string = string>` in `derive.ts`; `Unavailable` has a reason string and a loose `detail`; `NotApplicable` has a reason string only. | `src/domain/calculation-result/` owns `CalculationResult<T, U, N>`. `Unavailable(U)` and `NotApplicable(N)` hold one case each of two typed unions, a reason with its own details (P63–P65). |
| Daily Review's `PressureBasis`, `RangePosition` and private `RiskReward` copy the reasons. | Pressure, range position and risk and reward are Calculation Results. The reasons pass through unchanged (P66, P67). |
| Reason details name an Instrument as `{ kind: 'Stock', symbol }` in Trade Analysis and as `instrumentKey: string` in the Review. | Every reason's details carry the tagged `Instrument`. `src/domain/instrument/` owns `instrumentKey` and `instrumentOf` (P68). |
| A finding for facts that can't be replayed has the fact's id and a reason, plus `available` for `ExceedsOpenQuantity`. | Each finding describes itself: the fact's kind, Instrument, Economic Time and side, with quantities where its reason involves one (P69). |
| Wording in `figures.ts`, `StopTargetSlider`, `review-attention.ts`, `ReviewView`, `ReviewCard`, `TradeList`, `TradeDetail` and `PositionChangeReceipt`. | One module, `src/ui/calculation-words.ts`, words every reason and finding at three lengths, returned in parts (P70, P71). A new check, `verify:wording`, keeps it the only one (P74). |
| "Records disagree" labels both an integrity disagreement and facts that can't be replayed. | "Records disagree" labels only an integrity disagreement. Facts that can't be replayed read "Facts can't be replayed" (P72). |

**Stays unchanged:**
- **Stored data:** every store, index, record, fixture, backup and the schema version (5). `npm run verify:fixtures` passes unchanged. **Amended by plan revision 43 (decision 78):** every `dump.json` stays byte-identical; the derived-view snapshots `expected-views.json` change only the result shapes the prefactor changes, with every value kept, and `verify:fixtures` passes against them.
- **Facade operations:** their names, requests and result branches. Only the shapes inside results change.
- **Market Data's Expected-Mark Status** (`Available`, `Missing`, `AcknowledgedUnavailable`) and the Mark row's text. It is the evidence itself, not a figure's reason.
- **`specs/` and the glossary.** "Calculation Result" keeps its four kinds as the glossary defines them. Nothing is added to the glossary.
- **Ranking:** the Review's bands and order keep their meaning (P67).
- **Acceptance:** no row changes status (section 7).

### 1.2 Decisions

Numbering continues from the D6 prefactor's P55–P62.

| # | Question | Decision | Alternatives and tradeoff |
|---|---|---|---|
| P63 | **What is the one value?** | **The Calculation Result itself.** What the Review's shapes express is "why this calculation has no number", which is more than missing evidence. The spec already names that value: `Value`, `Unbounded`, `Unavailable(reason, details)` or `NotApplicable(reason, details)` (Trade Analysis, "Shared values"; ADR 0007: `Unavailable` when the evidence can't support a number, `NotApplicable` when the method can't). | A new "missing evidence" value beside the Calculation Result: rejected by the user, because the Review's other reasons (facts that can't be replayed, risk at entry that isn't positive) are calculation failures too, and two values would carry one meaning. |
| P64 | **How are the reasons typed?** | **Two unions, each case a reason with its own details:** `UnavailableReason` and `NotApplicableReason` (section 1.3). `CalculationResult<T, U extends UnavailableReason = UnavailableReason, N extends NotApplicableReason = NotApplicableReason>`. A figure narrows `U` and `N` to the reasons it can return; Terminal Disposition, for example, returns only `NotClosed`. The unions live in `src/domain/calculation-result/`, beside `CalculationResult`, and `domain/trade-analysis` re-exports all three. | A reason string with a separate details union: today's shape. Nothing ties a reason to its details, so the wording code checks `'date' in detail` and falls back to "Not available". |
| P65 | **Facts that can't be replayed** | **`Unavailable(FactsIncoherent, { findings })`.** The facts are the evidence, and the figure becomes calculable once the trader corrects them. `NotApplicable` means the method has no meaning for the Trade, whatever its facts. | `NotApplicable(FactsIncoherent)`: implies nothing can be done. |
| P66 | **Risk and reward** | **The calculation stays and becomes a Calculation Result.** `riskRewardOf(state, evaluation): CalculationResult<RiskRewardFigures, UnavailableReason>`, where `RiskRewardFigures` is `{ riskNow, rewardNow, riskAtEntry, rewardAtEntry, mark, averageCost }` as today. When "now" is unavailable, the result is the evaluation's own `Unavailable`, passed through unchanged. It stays private to Daily Review. Only its `Missing` branch and that branch's conversion are removed. | Keep `Missing { acknowledged, detail }`: it is where the reasons are renamed. |
| P67 | **Pressure and range position** | **Both become Calculation Results**, computed from `riskRewardOf`. `pressure: CalculationResult<Pressure, UnavailableReason, NonPositiveAtEntry>`, where `Pressure` is today's `Comparable` (`side`, `share`, `atEntry`, `now`; or `side: 'None'` with share 0). `rangePosition: CalculationResult<RangePlacement, UnavailableReason, never>`, where `RangePlacement` is today's `Placed`. A missing input is the same `Unavailable` in both. `NonPositiveAtEntry` (with its side) is pressure's `NotApplicable`. The Daily Review design's "Not Comparable" is any pressure that isn't a `Value`, so ranking keeps its rule: Value results sort ahead of the rest, as Comparable sorted ahead of NotComparable. `ReviewTradeItem` keeps the field names `basis` and `rangePosition`, now Calculation Results. | Keep `PressureBasis` and `RangePosition` and wrap only their evidence cases: rejected by the user in favour of P63. |
| P68 | **Naming an Instrument** | **Reason details carry the domain's tagged `Instrument`**, never a key or a label. `src/domain/instrument/` owns the type (`Stock { symbol }` only, for now), `instrumentKey(instrument)` and `instrumentOf(key)`. A stock's key is its bare symbol, as Market Data stores it today. Review rows built from Market Data (the `MarkMissing` incomplete reason, grouped by key and date, and the Unavailable Marks family) convert the key with `instrumentOf` in the coordinator. The wording module's `instrumentLabel(instrument)` is the only way any text names an Instrument. **D7's option key becomes the unpadded OCC option symbol** (section 8): the root, the expiration as YYMMDD, `C` or `P`, then the strike × 1000 as 8 digits, for example `XYZ261120C00055000`. The Option Instrument stores its OCC root as a field of its own, and the key is built from it. D7 fills it in as the symbol with any "." removed, at most 6 characters, so a later deliverable can store a root that differs from the symbol (`SPXW` for SPX weeklies) without changing the key format or stored keys. Option strikes have at most 3 decimal places. Index options are out of scope until cash settlement exists (D20). The prefactor builds none of this; it shapes the module so D7 adds the Option variant in three places: the type, the key functions and the label. | Keep `instrumentKey: string` in the Review: every wording site would have to parse D7's option key or print it raw. D7's `OPT:<symbol>:<expiration>:<C|P>:<strike>`: replaced at the user's direction, so stored keys match data from an exchange or a data vendor (Marketdata.app uses the unpadded OCC symbol). |
| P69 | **Findings for facts that can't be replayed** | **Each finding describes itself.** It carries the fact's id, its kind (`Execution` or `PositionChange`), the Economic Time, and, for an Execution, the Instrument, the side and the recorded quantity. `ExceedsOpenQuantity` also carries the quantity open at that point. `derive` fills these in from the facts it already holds; no screen looks a fact up by id. | Look the fact up on each screen: what Trade Detail does today; the Review and the list cannot, because they don't hold the facts. |
| P70 | **Lengths** | **Three, for every reason:** a **label** (a badge), a **figure** (in place of a number, in a figure cell or the slider) and a **sentence** (attention reasons, Review blockers, Detail's findings table). Each screen picks one and writes no text of its own. | One length per screen: the screens' texts then drift apart again. |
| P71 | **The wording module** | **`src/ui/calculation-words.ts`** words any `UnavailableReason`, `NotApplicableReason`, `Unbounded` result and finding, at a length, and **returns the words in parts**, ordered runs of plain text, an Instrument and a date, so a screen can wrap the Instrument in a link without re-assembling the text. A `text(parts)` helper joins them for screens that need a string. It takes the trader's time zone for finding times. Every switch is exhaustive (`never` in the default), with no catch-all. `calculation(result, format)` and `dollarsAndR` in `figures.ts` call it for every non-Value result. | Return plain strings: the Review blocker's card link would have to find the Instrument inside the string. |
| P72 | **The texts** | **Section 1.4, as approved.** Existing text may change where it makes the wording consistent; the browser tests change with it (section 6.2). Three changes the user approved specifically: (1) `SessionPolicyNotCovered` reads "Outside the market calendar" in place of decision 54's "Not available", and the shell's calendar icon stays; (2) `NoOpenQuantity` merges into `NoRemainingPosition`; (3) "Records disagree" labels only an integrity disagreement. | Keep every existing text: rejected by the user, who preferred consistency. |
| P73 | **The Review's session-policy wording** | **Settled by a test first.** T7P.5's first case opens the Review with its as-of instant outside session-policy coverage, and the breakdown's evidence records whether `SessionPolicyNotCovered` can reach a walked Trade's pressure, range position or attention reason. If it can, the case is the regression test of a live defect; if it can't, the defect was latent, and P67's pass-through still covers it in `attentionOf`'s unit cases. | Assume it is live, or assume it is unreachable: either way the record would be a guess. |
| P74 | **Keeping the module the only one** | **A new check, `npm run verify:wording`**, joins the static and verify checks in `full-suite.sh`. It fails if a file under `src/ui/` other than `calculation-words.ts` and its test contains a reason's words (the phrases in section 1.4's tables, matched case-insensitively) or a `case` or comparison on a reason code (`'MarkMissing'`, `'AcknowledgedUnavailable'`, `'AwaitingClose'`, `'SessionPolicyNotCovered'`, `'FactsIncoherent'`, and every `NotApplicableReason` and finding code). It prints each file, line and match. Test files are exempt, since they assert the words. **Amended by plan revision 45 (decision 80):** the check stays as stated, with no other exemption. Two texts it hits that aren't a Calculation Result's reason move into `calculation-words.ts` unchanged: the Mark row's Expected-Mark Status words ("Acknowledged Unavailable", section 1.1 keeps them) as a status label, and the Position Change form's comparisons on the validation issue codes `ExceedsOpenQuantity` and `FlatBeforeLaterFacts` as predicates. No visible text changes. | Rely on review: the tests prove the module and today's screens, not a screen written later. |
| P75 | **Gate** | **No browser critic**, at the user's direction. Unit tests of the module, component tests of each screen, `verify:wording` and a new browser layout spec (T7P.11) stand in for it. The gate is a complete cumulative run on the full browser tier (section 5). Starting and finishing tags: `claude-opus-5.5-pre-d7p` and `claude-opus-5.5-d7p`. D7 starts from `claude-opus-5.5-d7p`. | A short critic on wording consistency: the user judged the tests sufficient once layout is covered in the browser. |
| P76 | **IDs and evidence** | Tasks `T7P.1` to `T7P.12`; `tdd.sh` maps them to `evidence/D07P/`, which holds `tdd-log.md`, `structural.md` and `suite-runs/`. Browser specs live in `e2e/d7p/`, which `full-suite.sh` derives from the evidence folder as the current deliverable's folder. | Put them under D7: D7's evidence would open with work that isn't D7's. |

### 1.3 The reason unions

```ts
// src/domain/calculation-result/
type UnavailableReason =
  | { reason: 'MarkMissing'; instrument: Instrument; date: TradingDate }
  | { reason: 'AcknowledgedUnavailable'; instrument: Instrument; date: TradingDate }
  | { reason: 'SessionPolicyNotCovered'; instrument: Instrument; date: TradingDate }
  | { reason: 'AwaitingClose'; after: TradingDate }
  | { reason: 'FactsIncoherent'; findings: readonly IncoherentFact[] };
  // D7 adds SettlementDue.

type NotApplicableReason =
  | { reason: 'NoRemainingPosition' }            // absorbs NoOpenQuantity (P72)
  | { reason: 'NotClosed' }
  | { reason: 'EntryNotResolved' }
  | { reason: 'NoOngoingRisk' }
  | { reason: 'EntryAtOrBeyondStop' }
  | { reason: 'EntryAtOrBeyondTarget' }
  | { reason: 'NonPositiveAtEntry'; side: 'Losing' | 'Winning' };

type IncoherentFact =
  | { factId; kind: 'Execution'; instrument; economicTime; side: 'Buy' | 'Sell'; quantity;
      reason: 'UnknownPlannedLeg' | 'NonpositiveQuantity' | 'DuplicateFactId' | 'FlatBeforeLaterFacts' }
  | { factId; kind: 'Execution'; instrument; economicTime; side: 'Sell'; quantity; reason: 'ExceedsOpenQuantity'; available }
  | { factId; kind: 'PositionChange'; economicTime; reason: 'DuplicateFactId' };
```

The field names are indicative; T7P.1 and T7P.3 fix them. `Unbounded(direction, explanation)` is unchanged.

### 1.4 The texts (approved 2026-11-04)

Dates use the existing short date format ("Mon Oct 12"); the tables abbreviate it. A finding's time is shown in the trader's time zone. "XYZ" stands for `instrumentLabel(instrument)`.

**`Unavailable`:**

| Reason | Label | Figure | Sentence |
|---|---|---|---|
| `MarkMissing` | Mark missing | Mark missing: XYZ, Oct 12 | Mark missing for XYZ on Oct 12 |
| `AcknowledgedUnavailable` | Acknowledged unavailable | Acknowledged unavailable: XYZ, Oct 12 | Mark acknowledged unavailable for XYZ on Oct 12 |
| `AwaitingClose` | Awaiting close | Awaiting the close after Oct 12 | Awaiting the next close after Oct 12 |
| `SessionPolicyNotCovered` | Outside calendar | Outside the market calendar: Oct 12 | Oct 12 is outside the market calendar |
| `FactsIncoherent` | Facts can't be replayed | Not available | the first finding's sentence, plus "and 2 more" when there are more |

`AcknowledgedUnavailable` keeps "acknowledged" at every length, because the UI contract requires an acknowledgment to read visibly as the trader's, not as a price (UI contract, calculation rendering). `FactsIncoherent`'s figure is "Not available" because the cause belongs to the whole Trade, which its badge, Detail's panel or the Review's sentence states once, with the finding. It is a defined text for one reason, not a catch-all.

**Findings** (the sentence length; Detail's table lists every finding in this form):

| Finding | Sentence |
|---|---|
| `ExceedsOpenQuantity` | Sell of 120 XYZ on Oct 14, 10:30 is more than the 100 shares open |
| `FlatBeforeLaterFacts` | Sell of 100 XYZ on Oct 14, 10:30 leaves the Position flat before later records |
| `UnknownPlannedLeg` | Buy of 100 XYZ on Oct 14, 10:30 names a Planned Leg that isn't in the Plan |
| `NonpositiveQuantity` | Buy of 0 XYZ on Oct 14, 10:30 has a quantity that isn't positive |
| `DuplicateFactId` | Buy of 100 XYZ on Oct 14, 10:30 shares its identity with another record; for a Position Change, "Position Change on Oct 14, 10:30 shares its identity with another record" |

**`NotApplicable`:** the label is "Not applicable" for every reason; the figure and the sentence are "Not applicable: " followed by:

| Reason | Words |
|---|---|
| `NoRemainingPosition` | no open position |
| `NotClosed` | not closed yet |
| `EntryNotResolved` | entry not resolved yet |
| `NoOngoingRisk` | no risk to the Stop |
| `EntryAtOrBeyondStop` / `EntryAtOrBeyondTarget` | entry at or beyond the Stop / Target |
| `NonPositiveAtEntry` | no risk at entry (Losing) / no reward at entry (Winning) |

`Unbounded` keeps "Unbounded above" and "Unbounded below".

**Where each screen uses which length:**

| Screen | Length |
|---|---|
| Trades list: a figure cell; the badge after the Trade text | figure; label ("Mark missing", "Facts can't be replayed"; "Records disagree" stays the integrity badge) |
| Open and Closed Detail: figure cells; the condition status cells | figure |
| Trade Detail: the panel for facts that can't be replayed | heading "Facts can't be replayed"; each finding's sentence in its table |
| Position Change receipt | figure |
| Review slider: the figure text and the accessible name | figure |
| Review attention reason; Review blockers | sentence; a `FactsIncoherent` blocker names the Trade, then the first finding's sentence and "and N more", and links to Trade Detail |

### 1.5 Working assumptions

| # | Assumption |
|---|---|
| A181 | **Reading** (decision 45): the drafting guide's full `specs/` reading was scoped, as decisions 68 and 69 scoped theirs, to `specs/glossary.md` (Calculation Result, Expected-Mark Status, Unavailable Mark Acknowledgment), ADR 0007, and the Trade Analysis ("Shared values"), Daily Review ("Date, eligibility, and ordering"), Trade Views and Reporting, UI contract ("Calculation rendering", Trade Detail) and overview ("Calculation availability") design documents. |
| A182 | No result shape that changes is stored, exported or part of a backup. Daily Review results and Trade view results are derived on every read (Daily Review, "Completion and resumption"; Trade Views and Reporting). `verify:fixtures` passing unchanged confirms it. **Amended by plan revision 43 (decision 78):** `verify:fixtures` also compares the derived views with each fixture's `expected-views.json`, which holds these shapes. Those snapshots change shape only, in the task that changes the producer; every `dump.json` stays byte-identical, which is what confirms that nothing stored changes. |
| A183 | `CalculationResult`'s reason type parameter has three users that narrow it today: Terminal Disposition (`NotClosed`), Entry Quality (`EntryNotResolved`) and actual reward/risk (`EntryAtOrBeyondStop` or `…Target`). Every other figure uses the full unions. |
| A184 | The Review's `ReviewCard` falls back to "Not available" for the slider figures when the Trade has no evaluation (facts that can't be replayed); under P72 that is `FactsIncoherent`'s figure text, from the module. |
| A185 | Integration tests that assert reason shapes (for example the Unavailable details in D4's expected-Mark cases and D6's missing-Mark case) change only their expected shapes, in the task that changes the producer, and keep every expected value. |
| A186 | A list's Trade cell for a Trade whose facts can't be replayed shows "Not available" as its Trade text today (D2 ui-alignment, T2.40); it stays, as `FactsIncoherent`'s figure text, with the label badge after it. |
| A187 | The browser layout spec builds Trades whose facts can't be replayed the way D2's integrity spec does, by editing stored records before launch (`writeIntegrityFixture`, D2 section 6.0), never during a run. |
| A188 | D7 starts from `claude-opus-5.5-d7p`. Its tasks that word `SettlementDue` or an option Instrument add one union case, one key-function branch and one label branch, and `verify:wording` applies to them. |

---

## 2. Task graph

| Task | Title | Kind | Size | Depends on | Seams or verification |
|---|---|---|---|---|---|
| T7P.1 | Domain: the Calculation Result module and the reason unions | structural | M | — | `typecheck`, existing domain cases |
| T7P.2 | Domain: the Instrument module | domain | S | — | `instrumentKey`, `instrumentOf` |
| T7P.3 | Domain: self-describing findings | domain | S | T7P.1, T7P.2 | `derive` |
| T7P.4 | Trade Analysis and Trade Views return the typed reasons | structural | M | T7P.1–T7P.3 | `typecheck`, existing domain, Trade Views and integration cases |
| T7P.5 | Daily Review: risk and reward, pressure, range position and reasons as Calculation Results | application | M | T7P.4 | `DailyReview.open`, `attentionOf` |
| T7P.6 | UI: the wording module | UI | M | T7P.1–T7P.3 | `calculation-words.ts` |
| T7P.7 | UI: lists, Detail and the receipt word through the module | UI | M | T7P.4, T7P.6 | `TradeList`, `TradeDetail`, `PositionChangeForm` cases |
| T7P.8 | UI: the Review words through the module | UI | M | T7P.5, T7P.6 | `ReviewView`, `ReviewCard`, `StopTargetSlider`, `review-attention` cases |
| T7P.9 | `verify:wording` | structural | S | T7P.7, T7P.8 | the check, with a planted violation |
| T7P.10 | Existing browser cases follow the approved texts | test | S | T7P.7, T7P.8 | the cases in section 6.2 |
| T7P.11 | Browser layout spec | test | S | T7P.10 | `e2e/d7p/layout.spec.ts` |
| T7P.12 | Gate runs | verification | S | all | `suite-runner`, full tier |

The tasks run in this order, one at a time, each delegated to `tdd-task` with an ocr review of its commit, as `implementing.md` describes. T7P.1, T7P.4, T7P.7 and T7P.8 touch `src/ui/` or shapes the UI reads, so their cumulative run is the full tier; `browser-auto` picks it from the paths.

---

## 3. Behavioral tasks

Every case runs **red → green** individually. A case that passes on its first run, or fails for a syntax, configuration, fixture or unrelated reason, is not valid red evidence. It must be fixed and rerun to a genuine red, or flagged as a first-run pass with a mutation check (an assertion or runtime failure, not a compile error). Cases are ordered so each one needs behavior the earlier cases don't.

### T7P.2 Domain: the Instrument module

Seam: `instrumentKey` and `instrumentOf` in `src/domain/instrument/`.

```text
describe("Instrument keys (P68)")
  it should give a stock's key as its symbol: XYZ gives "XYZ", BRK.B gives "BRK.B"
  it should read a stock's key back as the same Instrument, so instrumentOf(instrumentKey(i)) equals i for XYZ and BRK.B
```

The first case goes red on the missing module.

### T7P.3 Domain: self-describing findings

Seam: `derive`, with D6's reference Trade facts edited per case (`src/domain/trade-analysis/reference-trade.ts`).

```text
describe("findings for facts that cannot be replayed (P69)")
  it should name a Sell above the open quantity with its Instrument, Economic Time, side Sell, quantity 120 and 100 open
  it should name a Sell that leaves the Position flat before a later fact with its Instrument, Economic Time, side and quantity
  it should name an Execution with an unknown Planned Leg, and one with a quantity that isn't positive, each with its Instrument, Economic Time, side and quantity
  it should name a duplicated Position Change identity with kind PositionChange and its Economic Time, and a duplicated Execution identity with kind Execution and its details
```

Each case goes red on the missing fields. `available` keeps its meaning (D6 P22).

### T7P.5 Daily Review: risk and reward, pressure, range position and reasons as Calculation Results

Seam: `DailyReview.open` with D5R's card fixture (Review Monday 2026-10-12 at 17:00; XYZ, ABC and JKL marked, DEF Missing), and `attentionOf` with constructed evaluations for the reasons `open` can't reach.

```text
describe("the Review's session-policy reach (P73)")
  it should open the Review with its as-of instant outside session-policy coverage and return what it returns today, recorded as the evidence of whether SessionPolicyNotCovered reaches a walked Trade

describe("pressure and range position (P66, P67)")
  it should return pressure and range position as Values with today's figures for XYZ, ABC and JKL
  it should return DEF's pressure and range position as the same Unavailable(MarkMissing, DEF, Mon Oct 12) its evaluation returns
  it should return an acknowledged DEF Mark as Unavailable(AcknowledgedUnavailable) in both, no longer merged with a missing Mark in the pressure
  it should return the close not yet in as Unavailable(AwaitingClose) in both
  it should return pressure NotApplicable(NonPositiveAtEntry, Losing) with range position still a Value, for a Trade whose risk at entry is not positive
  it should return a Trade whose facts can't be replayed with both as Unavailable(FactsIncoherent) carrying its findings

describe("attention reasons carry the reason unchanged (P67)")
  it should give an evidence-limited Trade the reason of its evaluation's Unavailable figure, for MarkMissing and AcknowledgedUnavailable
  it should give SessionPolicyNotCovered as SessionPolicyNotCovered, never as AcknowledgedUnavailable, in attentionOf
  it should give the blocker for facts that can't be replayed the same FactsIncoherent reason, with its findings
  it should rank a Value pressure ahead of a pressure without one in the same band, as today
  it should name the Instrument of a MarkMissing incomplete reason as an Instrument, converted from its key
```

The first case is a probe, not a red case. Its result goes in `evidence/D07P/structural.md`, and its expectation is whatever `open` returns today. The pressure cases go red on the new shape. The `attentionOf` session-policy case goes red on today's `AcknowledgedUnavailable`.

### T7P.6 UI: the wording module

Seam: `src/ui/calculation-words.ts`, pure functions, with the fixed time zone `America/New_York`.

```text
describe("calculation words (P70, P71, section 1.4)")
  it should word MarkMissing at the label, figure and sentence lengths as section 1.4 gives
  it should word AcknowledgedUnavailable with "acknowledged" at every length
  it should word AwaitingClose and SessionPolicyNotCovered at each length
  it should word each finding as a sentence, with its quantities, and a Position Change's duplicate identity in its own form
  it should word FactsIncoherent as "Facts can't be replayed", "Not available", and the first finding's sentence with "and 2 more"
  it should word every NotApplicable reason as "Not applicable" and "Not applicable: " plus its words, and NonPositiveAtEntry by its side
  it should word Unbounded above and below
  it should return the words in parts, with the Instrument and the date as their own parts, and join them with text()
  it should name an Instrument only through instrumentLabel: a stock by its symbol
```

**Compile-time check (recorded, not committed):** in a scratch commit, add a dummy case to `UnavailableReason` and run `npm run typecheck`. It must fail at the module's switch, and at no catch-all. Record the error lines in `evidence/D07P/structural.md`, then drop the commit.

### T7P.7 UI: lists, Detail and the receipt word through the module

Seams: the `TradeList`, `TradeDetail`, `PositionChangeForm` and `PositionChangeFormExit` mounted cases.

```text
describe("lists, Detail and receipt words (P72)")
  it should show a missing Mark's figure text in the Open list's P&L cell and the "Mark missing" badge, from the module
  it should show "Facts can't be replayed" as the badge of a Trade whose facts can't be replayed, and "Records disagree" only on a Trade with an integrity disagreement
  it should show "Outside the market calendar: Mon Oct 12" for an Open Trade's Mark-dependent figures outside coverage
  it should show each NotApplicable figure on Detail as "Not applicable: " plus its words, never a raw code
  it should list every finding as its sentence in Detail's table, under the heading "Facts can't be replayed"
  it should show the receipt's figure without a number in its own words, not a blanket "Not applicable"
```

### T7P.8 UI: the Review words through the module

Seams: the `ReviewView`, `ReviewCard`, `ReviewCards`, `StopTargetSlider` and `review-attention` mounted cases.

```text
describe("Review words (P72)")
  it should give the slider's figure text and accessible name the figure length for a missing, an acknowledged and an awaited Mark
  it should give the attention reason the sentence length for each Unavailable reason
  it should wrap the Instrument of a Mark-missing blocker in its card link, keeping the sentence's words
  it should give the blocker for facts that can't be replayed the Trade's name, the first finding's sentence and "and 1 more", linking to Trade Detail
  it should show the slider figures of a Trade whose facts can't be replayed as "Not available", from the module
```

---

## 4. Structural tasks

| Task | Verification (exact) | Expected result |
|---|---|---|
| T7P.1 The Calculation Result module and the reason unions | `npm run typecheck`, `npx tsc6 --noEmit`, `npm run lint:deps`, `npx vitest run src/domain` | `src/domain/calculation-result/` exports `CalculationResult`, `UnavailableReason` and `NotApplicableReason`; `derive.ts` imports them and `trade-analysis` re-exports them. `NoOpenQuantity` is gone, its two producers return `NoRemainingPosition`, and their cases change only that code. `lint:deps` allows `domain/trade-analysis → domain/calculation-result` and nothing new from it. Every other domain case passes unchanged. |
| T7P.4 Trade Analysis and Trade Views return the typed reasons | `npm run typecheck`, `npx vitest run src/domain src/coordinators/trade-views`, `npm run test:integration` | `evaluate` returns `{ reason, instrument, date }` and `{ reason: 'AwaitingClose', after }` in place of `reason` plus `detail`. Trade Views pass them through unchanged, and an incoherent Detail's findings are P69's. Every case keeps its expected values and changes only the shape it asserts (A185). |
| T7P.9 `verify:wording` | `npm run verify:wording`; then, in a scratch commit, add "Mark missing" to a string in `src/ui/screens/AboutView.tsx` and a `case 'NotClosed':` to a function in `src/ui/format.ts`, run it again, and drop the commit | The first run passes. The planted run fails, naming both files and lines. `full-suite.sh`'s checks stage runs it, and its count of checks goes from 12 to 13. |
| T7P.10 Existing browser cases | the cases in section 6.2, each run alone; then `npm run test:e2e` | Each listed case changes only its expected text, to the row of section 1.4 named against it, and passes. No other case changes: `git diff claude-opus-5.5-pre-d7p -- e2e` shows only the listed lines and the new `e2e/d7p/`. |
| T7P.11 Browser layout spec | `npx playwright test e2e/d7p/layout.spec.ts` | Section 6.3's cases pass. A mutation check on one case (a `white-space: nowrap` on the finding sentence) makes it fail at 320 px, then is restored. |
| T7P.12 Gate runs | `full-suite.sh evidence/D07P t7p-12-full` (full tier), by `suite-runner` | Unit, integration and browser suites pass, and 13 of 13 checks. Counts and wall times recorded in `evidence/D07P/structural.md`. |

---

## 5. Gate

The prefactor is complete when all of the following hold. Then the handoff's progress section is updated and everything is committed locally.
- T7P.1 to T7P.11 are committed, with each commit's ocr findings resolved.
- T7P.12's full-tier run passes, with `verify:wording` among its checks.
- `npm run verify:fixtures` passes unchanged (A182), and `git diff claude-opus-5.5-pre-d7p -- src/persistence` is empty. **Amended by plan revision 43 (decision 78):** `verify:fixtures` passes; `git diff claude-opus-5.5-pre-d7p -- tests/fixtures` touches only `expected-views.json` files, every `dump.json` unchanged; and each task's evidence lists the snapshot shapes it changed.
- The tag `claude-opus-5.5-d7p` is made on the final commit.

**Then, before D7 starts (main session, at the user's direction):** rebase the spec map for D7. Recheck every entry's line range and character count against `specs/` (all 259 matched on 2026-11-04); retag D7's sections in `plan/spec-map.md` for what D7 now needs on top of the prefactor (the amended A99 and A188); regenerate the lists with `.claude/scripts/spec-reading-lists.py`; and commit it with D7's handoff. The prefactor itself has no generated reading list: its handoff names the sections in A181, as D5R2's and the D6 prefactor's did.

---

## 6. Tests

### 6.1 Unit and integration cases whose shapes move

Cases that assert a reason's shape change only that shape, in the task that changes its producer (A185): T7P.1 for `NoOpenQuantity`, T7P.4 for Trade Analysis and Trade Views, T7P.5 for Daily Review. Each task's report lists the cases it changed, with the old and new shape. Expected values (figures, dates, Instruments, order) don't change. **Amended by plan revision 43 (decision 78):** the same rule applies to the derived-view snapshots `tests/fixtures/workspace-v*/expected-views.json`, which `verify:fixtures` and `tests/integration/d4` and `d6` compare with: each task changes the snapshot shapes its producer changes, keeps every value, and lists them, old and new.

### 6.2 Browser cases whose expected text changes (T7P.10)

| Case | Today | After (section 1.4 row) |
|---|---|---|
| `e2e/d4/breach-overrun.spec.ts`, the Valuation, Risk and reward figures and both condition status cells | "Awaiting the next close" | "Awaiting the close after Mon Oct 12" (`AwaitingClose`, figure) |
| `e2e/d4/responsive-a11y.spec.ts`, Tuesday noon: Open P&L and the Open list row | "Awaiting the next close" | the same `AwaitingClose` figure text |
| `e2e/d2/integrity.spec.ts`, the two incoherent cases: the row badge and the Detail panel's name | "Records disagree" | "Facts can't be replayed" (`FactsIncoherent`, label; the panel heading). The coherent case with findings keeps "Records disagree". |
| `e2e/d2/ui-alignment.spec.ts`, the badge cases for an incoherent Trade (T2.40's XYZ row and T2.62's scroll-region case, where their fixture is incoherent) | "Records disagree" | "Facts can't be replayed" for the incoherent Trade; a Trade with findings keeps "Records disagree". The `Not available` cell expectations are unchanged (A186). |
| `e2e/d2/narrow.spec.ts`, the Detail panel of the Trade stored as Planned | the "Records disagree" panel | the "Facts can't be replayed" panel, if that fixture is incoherent; unchanged if it has findings only |
| `e2e/d5r/sliders.spec.ts`, T-B past the Stop: the slider's accessible name | "… Reward : risk Not applicable." | "… Reward : risk Not applicable: " plus the reason's words (`NotApplicable`, figure) |
| `e2e/d4/responsive-a11y.spec.ts`, the Open Detail Valuation note for an acknowledged Mark (line 175 at `claude-opus-5.5-pre-d7p`). **Added by plan revision 44 (decision 79).** | "Acknowledged unavailable for DEF on Mon Oct 12: your acknowledgment, not a price" | "Mark acknowledged unavailable for DEF on Mon Oct 12: your acknowledgment, not a price" (`AcknowledgedUnavailable`, sentence, with the note's existing suffix) |

T7P.10 confirms each fixture's kind (incoherent or with findings) before changing a line, and records it. A case not in this table that fails is a defect to investigate, not an expectation to change.

### 6.3 Browser layout spec (T7P.11, `e2e/d7p/layout.spec.ts`)

Each case runs at 320 and 375 px and asserts that the page has no sideways scroll and that each worded reason is shown in full: its element's `scrollWidth` is at most its `clientWidth`, and its text equals the module's.

| Screen | State | What's checked |
|---|---|---|
| Trade Detail | Facts can't be replayed: two findings, one `ExceedsOpenQuantity`, built by editing stored records (A187) | Both finding sentences in full in the findings table; the table scrolls inside its own region if it must |
| Trades list | The same Trade, and an Open Trade with a Mark missing | The "Facts can't be replayed" and "Mark missing" badges inside their cells |
| Open Detail | A Mark missing, and the close not yet in | "Mark missing: XYZ, Mon Oct 12" and "Awaiting the close after Mon Oct 12" in full |
| Review | A card with a Mark missing, one acknowledged unavailable, and the Trade whose facts can't be replayed | The attention sentence, the slider's figure text, and the blockers, including the card link and "and 1 more", in full |

### 6.4 Disclosed test substitutes

The D1–D6 substitutes still apply (`fake-indexeddb`, `NodeTestHost`, fixed clock and identities, the faults build with the clock pin, Chromium as the routine engine, the read-only probe). The layout spec's incoherent Trade is written into stored records before launch (A187).

---

## 7. Acceptance

No new row, and no row changes status. These are re-proven by the cumulative run:
- **AC-CALC-002** (realized-to-date stays a Value beside a Missing Mark): T7P.4 keeps I6.16's expected values.
- **AC-LIFE-003** (reads surface a disagreement without writing): the badge and panel words change (P72); the surfacing and the no-write proof don't.
- **AC-REV-002 and AC-REV-006:** the Review's order and completion are unchanged (P67).
- **AC-UI-001 and AC-UI-002:** the layout spec adds narrow-width evidence for the reworded states.
- **AC-RESP-001:** results still equal durable state; only the shapes of derived values change.

---

## 8. Amendments to other plan documents (decision 77, revision 42)

Plan revision 42 applies these when the breakdown is agreed, before the prefactor's first task. Each is a dated note at the place it changes.

| Document | Where | Amendment |
|---|---|---|
| `implementation-plan.md` | Decisions table | Decision 77: this breakdown, P63–P76, the D7 key format, and tech debt item 5 resolved by it. |
| `implementation-plan.md` | Plan record, "Immutable revision" and "Task graph and boundaries" | Revision 42, tag `claude-opus-5.5-plan-r42`; 31 ordered deliverables. |
| `implementation-plan.md` | Deliverable summary and definitions | A row for the D7 prefactor before D7, "0 (refactor)", and a short definition section before D7's. |
| `implementation-plan.md` | Tech debt, item 5 | Resolved by the D7 prefactor (decision 77). |
| `implementation-plan.md` | Open questions raised by the D7 breakdown, item 3 (D11) | The provider maps option Instruments to the unpadded OCC symbol, which D7 now stores as the key (P68). |
| `D07-single-leg-options-happy-path.md` | The opening note | Tech debt item 5 was raised; the D7 prefactor runs first, and D7 starts from `claude-opus-5.5-d7p`. |
| `D07-single-leg-options-happy-path.md` | A99 | The Instrument key is the unpadded OCC option symbol, built from a stored `root` field; D7 fills the root as the symbol without "." and at most 6 characters, and rejects an option Plan with a longer root; strikes have at most 3 decimal places. The label is unchanged. D7's options are equity options; index options wait for cash settlement (D20). |
| `implementation-plan.md` | Open questions, a new group "Raised by the D7 prefactor, for later breakdowns" | Index options: an Index underlying variant of `Instrument`, an explicit root (`SPXW`, `NDXP`, `RUTW`, `VIXW`), cash settlement, and AM-settlement timing for Settlement Due. D20 takes them on, or they become their own deliverable. |
| `D07-single-leg-options-happy-path.md` | T7.x cases naming `OPT:XYZ:2026-11-20:C:55` | The key reads `XYZ261120C00055000`. |
| `D07-single-leg-options-happy-path.md` | `SettlementDue` and option Instruments | Added as one `UnavailableReason` case with its section 1.4 row, one `instrumentKey` and `instrumentOf` branch, and one `instrumentLabel` branch (A188). |
| `D02-ui-alignment.md` | T2.40's badge case and the incoherent Detail case | An incoherent Trade's badge and Detail panel read "Facts can't be replayed"; "Records disagree" stays for an integrity disagreement (P72). |
| `D04-daily-review.md` | P8 and T4.18-B1 (decision 54's figures) | Mark-dependent figures outside coverage read "Outside the market calendar: <date>" in place of "Not available" (P72). The calendar icon is unchanged. |

---

## 9. Answers recorded from the user, 2026-11-04

1. **P63:** the value is the Calculation Result, covering every way a calculation fails, not missing evidence alone.
2. **P65 and P69:** facts that can't be replayed are `Unavailable`, with self-describing findings, and each screen says as much as it has room for.
3. **P64:** one union per kind, each case a reason with its details.
4. **P68:** D7's option key is the unpadded OCC symbol, with strikes limited to 3 decimals. The root is stored as its own field, which D7 fills in as the symbol without ".". Index options are deferred until cash settlement (D20), with their needs recorded as an open question.
5. **P70–P72:** three lengths, returned in parts. Existing text may change for consistency. The table in section 1.4 is approved, with "acknowledged" kept at every length (option A) and "Not available" as `FactsIncoherent`'s figure text (option B), and the three listed changes.
6. **P66:** risk and reward stays as a calculation and becomes a Calculation Result.
7. **P75:** no browser critic, given unit, component and layout tests and `verify:wording`.
