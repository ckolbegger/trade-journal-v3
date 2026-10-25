# D2 follow-up: align the UI with the reference screenshots: task breakdown

Status: **approved by the user on 2026-10-24 as plan revision 7 (decision 47)**, tagged `claude-opus-5.5-plan-r7`. All of U1–U7 were answered by the user on 2026-10-24. Implementation decisions I1 and I2 are settled with the user during T2.40 and T2.50.

**Plan revision 8 (decision 48), proposed 2026-10-25 at the user's direction during T2.40:** I1 is answered by a new design, the **Trade column**: one short description of what the Trade holds, built from a structured Trade Summary in the read model, beside a separate Underlying column, with a Net cost figure. Section 2a holds the design, from Long Stock now through single-leg (D7) and multi-leg (D10) options. It adds tasks T2.56–T2.59, rewrites T2.40, and amends T2.41, T2.49 and T2.55. It lifts this batch's "no view-model shape change" rule for exactly two derived fields, `summary` and `netCost` (section 1).

**Source.** The screenshot comparison made on 2026-10-24 against commit `404fda1`. It compared the 24 references in `specs/reference/ui-screenshots/` with screenshots of the built app at 390 and 1280 px (`test-results/screenshot-compare/shots/`, git-ignored). The report is saved in [evidence/D02/screenshot-comparison.md](../evidence/D02/screenshot-comparison.md).

**Position in the plan.** This batch follows the D2 follow-ups F1–F11 in [D2, section 11](D02-open-a-long-stock-position.md#11-deferred-follow-ups-plan-revision-6-decision-46) and runs **before D4's first task**. Two follow-ups merge into it:
- **F8** (Migration Blocked gutter) becomes part of T2.38.
- **F9** (narrow Open list) is implemented by T2.40, the narrow scrolling table chosen under U1.

The task IDs continue D2's numbering, T2.36–T2.55, so `tdd.sh` and the evidence files stay in `evidence/D02/`.

---

## 1. Authority and boundaries

**What the screenshots decide.** Following `specs/design/ui-contract.md` (Status and authority; Screenshot limitations) and `specs/reference/ui-screenshots/index.md`, the references set layout, density, hierarchy, cards, controls and responsive composition. They do **not** set labels, numbers, calculations, inferred state, navigation labels or fields. Those come from the domain documents, the glossary and the Entry Definitions.

**Durable compatibility.** This is a presentation batch:
- no schema change;
- no change to any committed fixture (`tests/fixtures/workspace-v1`, `workspace-v2`), the bench dataset or a backup content version. The bench's expected rendered rows and items (`bench/expected-open-rows.json`) are regenerated for the new columns and fields (T2.58, T2.40); the dataset itself is unchanged.

**View-model shape: two additive derived fields only (revision 8).** Every new presentation uses only values already in the view models, except two fields added by T2.58: `summary` (a structured Trade Summary on Planned and Open list items and Details) and `netCost` (on Open list items and the Open Detail). Both are derived on read, never stored. No existing field changes. Because the committed v2 snapshot does not contain them, T2.56 first brings forward D4's A51 rule: `verify:fixtures` requires every field a snapshot contains to be equal, and every later field to have its defined value. The defined values of `summary` and `netCost` for the v1 and v2 fixtures are asserted exactly by T2.58's integration case.

**Accessible names stay stable.** Tests find controls by name. Any task that has to change a name or role says so and updates its tests in the same commit:

| Item | Names that stay |
|---|---|
| Form labels | "Quantity", "Price", "Fee", "Economic Time", "Execution N", "Remove Execution N", "Add Execution" |
| Buttons and choices | "Save entry", "Cancel", "Decline to reflect" |
| Prompt legends | as they are |
| Navigation | "Primary" with its link names |
| Detail | the `h1` is the Trade's symbol |
| Region names | as they are |

**Do not change** (the specs override the screenshot):
- **Wording:** "Trade", not "Position"; "Record entry", not "Add trade" or "Add fill"; "Execution", not "fill". The canonical Plan Reflection prompts and the runtime emotion options stay.
- **Not shown in D2:** no adherence, no P&L, no current price, no "away" or "cushion" figures, because there are no Marks in D2.
- **No extra controls:** no "Close position", no "Done", no Insights or coach surface.
- **Prototype figures:** no prototype figures or arithmetic. Only derived values are shown.
- **Prototype-only fields:** none (Entry range, "Exit in (days)", Catalyst).
- **Contrast:** dark control borders stay, for 3:1 non-text contrast.
- **Buttons:** fully pill-shaped primary buttons stay, as the contract says.
- **About:** keeps its "Installed capabilities" list (C1.11, C2.11). It may be restyled, but not removed.
- **Trades list:** surfaces an integrity disagreement on its row (AC-LIFE-003). Revision 8: as a "Records disagree" badge in the Trade cell, not as a column.
- **New Plan:** stays one page while the catalog has one Strategy. Step-1 Strategy cards wait for D7.

---

## 2. Decisions

| ID | Question | Recommendation | Alternative and cost |
|---|---|---|---|
| U1 | **Narrow Trades list:** cards, or the current table restyled with a scroll cue? | **Decided by the user 2026-10-24: the restyled scrolling table** (T2.40), after reviewing a phone mockup. One table at every width. On narrow: Underlying pinned on the left, the most useful columns first, and scroll shadows at the edges. The column set and order are settled during T2.40 (implementation decision I1). **Revision 8:** the pinned column stays Underlying, and the Trade column sits beside it (section 2a). | Cards on narrow (rejected): closer to the reference, but a second rendering to keep equivalent, and churn in `narrow.spec.ts`. |
| U2 | **New Plan live preview** of 1R, original reward and Reward : risk while typing? | **Decided by the user 2026-10-24: skip it.** The figures still appear after Confirm. T2.46 is withdrawn; its ID is kept so later IDs do not move. | Include it through a new read-only facade operation running the Plan Baseline derivation (rejected: a new operation and manifest entry for a convenience). |
| U3 | **Detail Executions:** compact list rows instead of a table per Position Change? | **Decided by the user 2026-10-24: one compact row per Execution, each with a disclosure button that expands its details** (T2.50). The Trade reads as its plan and then its Executions; a Position Change is not a primary heading. The expanded row names the Execution's Position Change and shows that Position Change's reflection. Open Lots stays a table. | A row per Position Change that expands to its Executions (rejected: the Position Change is not what the trader thinks in); restyled tables (rejected: the Detail stays long). |
| U4 | **Stale validation issues:** clear a field's issue as soon as it is corrected? | **Decided by the user 2026-10-24: yes, in both New Plan and Record entry** (T2.47). The summary stays while any issue remains. Today the issues stay until the next submit. | Keep issues until resubmit, which is the current D1/D2 behavior. |
| U5 | **Contextual forms:** sheets and drawers, or routes? | **Decided by the user 2026-10-24: keep dedicated routes**, which the contract allows, and add Trade context to Record entry (T2.52). | A sheet or drawer: a larger change to routing and focus management for no contract gain. |
| U6 | **Icons:** how are navigation icons supplied? | **Decided by the user 2026-10-24: draw our own inline SVGs**, thin outline strokes in the reference's style, in one source module, marked `aria-hidden` beside a visible label. No new dependency. Covers the navigation icons (T2.36), the back arrow (T2.48) and the disclosure chevron (T2.50). | Copy an open-source set such as Lucide (more consistent as the set grows; carries a licence notice); an icon package (needs a plan revision for the pin, decision 42). Either can replace the drawn icons later without changing any test. |
| U7 | **Trades header content** | **Decided 2026-10-24: `h1` "Trades" only.** No page-level New Plan button: the primary navigation already offers New Plan on every screen, at every width, and the Empty states offer it as their next action (ui-contract View states). No greeting and no count line: a total needs a count the paged read model does not provide. | A header New Plan button as in the reference (rejected as a duplicate of the navigation entry); a count for the current page only, which could mislead with Planned paging. |

**Implementation decisions** (settled with the user during the named task, before it is committed):

| ID | Question | Task | Starting proposal |
|---|---|---|---|
| I1 | **The column set and order of the Trades tables** on narrow, and whether wide uses the same order. **Answered by the user on 2026-10-25 with the Trade column (revision 8, section 2a)**; the proposal below is kept as history. | T2.40 | **Open:** Underlying (pinned), Quantity, Integrity, Entry, Average cost, Strategy, Account, Fees, Deviations, Last activity. **Planned:** Underlying (pinned), 1R, Reward : risk, Entry readiness (with any disagreement badge), Plan time, Strategy, Account, Original reward. The T2.40 subagent stops with a rendered 320 px and 390 px capture of the proposal for the user, and implements the answer. Constraints: every column the table shows today stays available at every width (ui-contract Responsive, equivalent information); column names stay unchanged; at 320 px at least Underlying and one figure are visible without scrolling. |
| I2 | **The fields of a collapsed Execution row** and their order | T2.50 | Action, quantity, symbol, price, fee, Economic Time ("Buy 30 XYZ @ $50.00 · fee $0.50 · 2026-10-12 10:00"). The T2.50 subagent stops with a rendered 320 px and 1280 px capture of the proposal for the user, and implements the answer. Constraints: everything left out of the collapsed row appears in the expanded row, so no Execution value is lost; the collapsed row fits on one line at 390 px or wraps without clipping at 320 px. |

---

## 2a. The Trade column and Net cost (plan revision 8, decision 48)

Settled with the user on 2026-10-25, replacing the I1 proposal. A column per figure cannot describe a four-leg structure, but one short text can, from one Long Stock position to an Iron Condor. The design is fixed now, through D10, so that every later deliverable extends it rather than reshaping the Trades tables again.

### The Trade Summary (read model)

Trade Views attaches a structured `summary: TradeSummary` to every list item and Detail of a coherent Trade. It is assembled from values Trade Analysis already derives (the open Position, or for a Planned Trade the Plan's Planned Legs) and the current Catalog Strategy label (trade-views, "Labels and navigation"). It is never stored. An incoherent Trade has no summary; its Trade cell reads "Not available", like its other derived cells.

The type is a discriminated union that later deliverables extend without changing earlier variants:

| Variant | Deliverable | Fields | Text, as the UI formats it |
|---|---|---|---|
| `Stock` | D2 (T2.58) | `direction: 'Long'` (D2 has no short stock), `quantity` (shares), `price` | "Long 60 shares @ $50.10" |
| `Option` (one contract) | D7 | `direction: 'Long' \| 'Short'`, `contracts`, `expiration`, `strike`, `right: 'Call' \| 'Put'` | "Long 1 Nov 20 $300 Call", "Short 2 Dec 18 $45 Put" |
| `Structure` (a multi-leg shape that matches its Strategy) | D10 | `direction`, `quantity` (contracts per leg), `expirations`, `strikes` (ascending), `strategyLabel` | "Short 1 Nov 20 $240/$250/$320/$330 Iron Condor" |
| `Legs` (a Position that no longer matches its Strategy's shape, after legging out or Unplanned Exposure) | D10 | one `Stock` or `Option` per open leg | "Long 1 Jan 21 $250 Call, Short 1 Nov 20 $300 Call" |

Rules that hold for every variant:
- **Which quantity and price.**
  - Planned: the Plan's planned quantity and intended entry.
  - Open: the remaining open quantity and the quantity-weighted Open Lot price (fees excluded, the existing Average cost).
  - Closed (D6): the entered quantity and its average entry price, so the row says what was traded.
- **Price in the text.** Only `Stock` shows "@ price", per share. An option's premium is carried by Net cost, so the option variants do not repeat it.
- **Direction of a structure.** It comes from the Strategy's shape: a credit-collecting shape (Iron Condor, credit verticals, Cash-Secured Put) is Short, and a debit shape is Long. D10's breakdown confirms the mapping for each seeded multi-leg Strategy.
- **Expiration text.** "Nov 20", plus a two-digit year ("Jan 21 '28") when the expiration is not in the current year of the Workspace time zone.
- **Left to D10's breakdown** (starting proposals): a structure with two expirations (PMCC: "Long 1 Jan 21 '28 $250 / Short 1 Nov 20 $300 PMCC") and a stock-and-option combination (Covered Call: "Long 100 shares + Short 1 Nov 20 $55 Covered Call").

Exact values stay unrounded in the read model. The UI formats the summary with one function, `tradeSummary(summary)` in `src/ui/format.ts` (T2.59), used by every list and by the Detail summary card.

### Net cost

`netCost` is the signed cost of the remaining open exposure: the sum of quantity × price × multiplier over the Open Lots (positive for long Lots, negative for short), plus their unconsumed opening fees. It is the `C + F` of D4's A41 and D7's A109, so D4's marked P&L is Net cost subtracted from the market value. Trade Analysis's `derive` returns it as its own Calculation Result (T2.57), unavailable as `NoOpenQuantity` with no open Lots. It is a factual figure, not a valuation, so it is shown from D2 on, with no Mark.

The UI shows a debit as "$3,007.00" and a credit as "$212.00 credit" (ui-contract: show sign where ambiguity is possible). Only debits occur before D7.

### The Trades tables

Underlying stays its own first column, the pinned one on narrow, and keeps the link to the Detail: its accessible name stays the symbol, so `openTradeFromOpenList` and every row lookup keep working. Strategy, Quantity and Average cost leave the Open table, because the Trade column carries them. The planned quantity moves into the Entry cell ("Entering · 60 of 100", "Resolved · 120 of 100").

**Only the columns a trader scans by stay in the list** (the user's direction, 2026-10-25). Fees, Integrity, Deviations and Last activity leave the Open table, and each value stays reachable elsewhere:
- **Fees** are inside Net cost and itemised on the Detail.
- **Last activity** still orders the Open list (A32, the cursor order), and the Detail shows it.
- **Deviations** are listed on the Detail. A count is spec-optional on a list (trade-views: lists "may show" Deviation indicators), and the spec's `browseTrades` filters have no Deviation dimension. A "has an active Deviation" filter would therefore be a product addition beyond the spec, and it is not planned.
- **Integrity** cannot become a filter only. AC-LIFE-003 requires normal reads to surface a disagreement, so a trader must see it without looking for it. It becomes a "Records disagree" text badge in the Trade cell, at every width, shown only on a disagreeing row. An agreeing row shows nothing, where today every row says "Records agree".

The cell order in the markup is the visual order. The I1 proposal's CSS-only reordering is dropped, since the columns change anyway.

| Table | Wide (≥ 960 px), in order | Narrow (< 960 px) |
|---|---|---|
| Open (D2) | Underlying · Trade · Net cost · Entry · Account | Underlying (pinned) · Trade, two lines (below) · then Entry and Account, scrolling |
| Planned (D2) | Underlying · Trade · 1R · Reward : risk · Planned reward · Entry · Plan time · Account | Underlying (pinned) · Trade, two lines · then Entry, Plan time, Account, Planned reward, scrolling |
| Open from D4 | adds **P&L** (Current Marked Trade P&L) after Net cost. D4's risk and reward figures stay on the Detail and in the Review, not as list columns. | adds P&L to the Trade cell's second line |
| Closed (D6) | Underlying · Trade · Realized P&L · Realized R · then D6 A95's other columns | Underlying (pinned) · Trade, two lines (Realized P&L and R) |

**Attention badges in the Trade cell, at every width.** After the summary text, the Trade cell shows text badges only when they apply: "Records disagree" in D2, and from D4 "Stop breached", "Target reached" and "Mark missing".

**Two-line Trade cell on narrow.** The first line is the summary text with its badges. The second line holds the row's key figures: Open "Net cost $3,007.00" (from D4 "· P&L +$84.00", or "Mark missing" in its place), and Planned "1R $250.00 · Reward : risk 2.4". At 320 px the row's identity, its money figures and its attention status are therefore all visible without scrolling.

The columns whose values that second line carries (Net cost, P&L, 1R, Reward : risk) are hidden on narrow, and the second line is hidden on wide, both with `display: none`. Each value is therefore in the accessibility tree exactly once at each width, and the same information is present at both widths (ui-contract Responsive). It is one table row per Trade, with two lines inside one cell, not two table rows, so row semantics and `getByRole('row')` lookups stay as they are.

### Sorting

The Underlying and Trade columns are what the trader will sort by: the Trade column sorts by Strategy, then Underlying. Sorting is a `browseTrades` request option (spec: "fixed factual sorts"), not a client-side reorder of one page. It needs an index per sort, so it is **not** built in this batch. It is added to D22 (Trade filters), which already owns the Strategy and Underlying filters; decision 48 records it there.

### What later deliverables inherit (amendments recorded by revision 8)

- **D4:** T4.23 places P&L after Net cost on wide, and puts P&L and the Mark and condition badges on the Trade cell's second line on narrow. T4.18 adds nothing for the summary.
- **D6:** A95 and T6.16/T6.18 use Underlying · Trade (the entered summary) in place of symbol and Strategy.
- **D7:** A119 and T7.16/T7.23 add the `Option` variant and use the Trade column in place of "the contract label and Strategy" on rows. The Detail header shows the same text.
- **D10:** adds the `Structure` and `Legs` variants, the shape-to-direction mapping, and the PMCC and Covered Call texts.
- **D22:** adds the Underlying and Strategy sorts to `browseTrades`.

---

## 3. Task graph

Kinds:
- **B** = behavioral, TDD red then green per case, at the seam named.
- **S** = structural, with an exact verification. Each S task first adds failing measurements to `e2e/d2/ui-alignment.spec.ts` (computed styles and bounding boxes), then makes them pass.

| Task | Title | Batch | Kind | Blocked by | Seam or verification |
|---|---|---|---|---|---|
| T2.36 | Primary navigation: current page, wordmark, icons | A Shell | B | F1–F11 done | `AppShell` |
| T2.37 | Navigation and durability-banner styling | A | S | T2.36 | `ui-alignment.spec.ts` (shell) |
| T2.38 | One content column and side gutters (absorbs F8) | A | S | T2.37 | `ui-alignment.spec.ts` (layout) |
| T2.39 | Trades page heading | B Trades | B | T2.38 | `TradeList` |
| T2.56 | `verify:fixtures` compares the fields each snapshot holds (D4 A51 brought forward; revision 8) | B | S | T2.39 | `verify:fixtures` |
| T2.57 | Net cost from `derive` (revision 8) | B | B | T2.56 | `TradeAnalysis.derive` |
| T2.58 | Trade Summary and Net cost on list items and Details (revision 8) | B | B | T2.57 | `TradeViewsAndReporting` |
| T2.59 | `tradeSummary` text format (revision 8) | B | B | T2.58 | `format.ts` |
| T2.40 | Trades tables: Underlying and Trade columns, two-line narrow cell, pinned Underlying, scroll shadows (U1, I1 by revision 8; implements F9) | B | B then S | T2.59 | `TradeList`, then `ui-alignment.spec.ts` (narrow list) |
| T2.41 | Wide Trades table styling | B | S | T2.40 | `ui-alignment.spec.ts` (list) |
| T2.42 | Semantic badge tones | B | B | T2.38 | `Badge` component |
| T2.43 | Prompt chip groups | C Forms | S | T2.38 | `ui-alignment.spec.ts` (chips) |
| T2.44 | Execution rows as panels in a grid | C | S | T2.43 | `ui-alignment.spec.ts` (entry form) |
| T2.45 | New Plan grouped into cards | C | S | T2.43 | `ui-alignment.spec.ts` (plan form) |
| T2.46 | *Withdrawn (U2 = skip)* | — | — | — | — |
| T2.47 | Clear corrected issues (U4) | C | B | T2.45 | `PlanForm`, `PositionChangeForm` |
| T2.48 | Detail back link | D Detail | B | T2.38 | `TradeDetail` |
| T2.49 | Detail summary card | D | B | T2.42, T2.48, T2.59 | `TradeDetail` |
| T2.50 | Executions as expandable rows (U3) | D | B | T2.49 | `TradeDetail` |
| T2.51 | Journal Entries with Entry Type, Anchor and Source | D | B | T2.42 | `TradeDetail` |
| T2.52 | Record entry Trade context | D | B | T2.48 | `PositionChangeForm` |
| T2.53 | Detail, receipt and Accounts styling | D | S | T2.49–T2.52 | `ui-alignment.spec.ts` (detail) |
| T2.54 | Reference-pair screenshots | close | S | all above | `npm run ui:screenshots` |
| T2.55 | Critic gate for the batch | close | gate | T2.54 | fresh critic (section 7) |

**Ordering:**
- Batches run A → B → C → D.
- Within a batch, tasks run in the listed order. In batch B that is T2.39, T2.56, T2.57, T2.58, T2.59, T2.40, T2.41 (revision 8).
- T2.42 and T2.51 have no dependence on batch B or C beyond T2.38, and may move earlier if convenient.
- Each task ends with a complete cumulative run through `suite-runner`, recorded in `evidence/D02/structural.md`.

---

## 4. Behavioral tasks

Cases are listed so each one adds behavior the earlier ones do not already require.

### T2.36 Primary navigation: current page, wordmark, icons

**Seam:** `AppShell` with the facade double (`src/ui/AppShell.test.tsx`).

**Basis:** ui-contract Accessibility ("programmatic names/roles/states"), Navigation ("canonical domain language").

```text
describe("primary navigation")
  it should mark the link of the current route, and only that link, with aria-current="page" in both the sidebar and the bottom bar
  it should mark Trades as current on a Trade Detail and on Record entry
  it should show the product name "Trade Journal" at the top of the wide sidebar, outside the link list
  it should render an icon beside every label with aria-hidden, leaving every link's accessible name unchanged
```

**Implementation note:** use the router's `NavLink`, or equivalent, for `aria-current`.

**Test impact:**
- `e2e/d1/responsive-a11y.spec.ts` (focus outline on links) must stay green.
- The Onboarding and Recovery Only navigation tests keep their link sets.

### T2.39 Trades page heading

**Seam:** `TradeList` (`src/ui/screens/TradeList.test.tsx`).

**Basis:** ui-contract Accessibility (a heading to land on after navigation, which T2.29/F5 relies on); decision U7.

```text
describe("Trades heading")
  it should show an h1 "Trades" above the tabs in the Loading, Ready, Empty, and Error states of both tabs
```

**Not added:** a page-level New Plan button (U7). New Plan stays in the primary navigation and in the Empty states.

**Test impact:** check every `getByRole('heading', { name: ... })` lookup for a partial match on "Trades".

### T2.56 `verify:fixtures` compares the fields each snapshot holds (structural, revision 8)

**Change:** bring D4's A51 rule forward. `verify:fixtures` compares each committed snapshot with the current views field by field over the fields the snapshot contains, recursively, with arrays compared item by item and their lengths equal. A field the current release adds is allowed, and its defined value is asserted elsewhere: T2.58's integration case does it for `summary` and `netCost`. D4's T4.29 then reuses the rule instead of writing it.

**Verification:**
- A unit test of the comparison (`tools/fixtures/`):
  - an added field passes;
  - a changed, removed or reordered snapshot field fails, naming its path;
  - an extra or missing array item fails.
- `npm run verify:fixtures` still passes on `workspace-v1` and `workspace-v2` before T2.58.

### T2.57 Net cost from `derive` (revision 8)

**Seam:** `TradeAnalysis.derive` (`src/domain/trade-analysis/`).

**Basis:** section 2a "Net cost"; D4 A41's `C + F`; trade-analysis (fees allocated lot-aware, the unconsumed opening fee stays with the Open Lot).

```text
describe("Net cost")
  it should return Net cost as the sum of quantity × price over the Open Lots plus their opening fees, exactly (60 @ 50.10 with fee 1.00 is 3007.00)
  it should sum across the Lots of several Position Changes, including an earlier-dated one (60 @ 50.10, 40 @ 50.30, fees 1.00 each: 5034.00)
  it should return Net cost Unavailable(NoOpenQuantity) for a Planned Trade with no Lots
```

### T2.58 Trade Summary and Net cost on list items and Details (revision 8)

**Seam:** `TradeViewsAndReporting.browseTrades` and `getTradeDetail`, then the integration suite.

**Basis:** section 2a "The Trade Summary"; trade-views "Labels and navigation" (current labels); AC-RESP-001 (the receipt's post-commit views carry the same fields).

```text
describe("Trade Summary")
  it should give each Planned item and Planned Detail summary Stock, Long, the planned quantity, and the intended entry
  it should give each Open item and Open Detail summary Stock, Long, the open quantity, and the average open cost, with netCost from derive
  it should give an incoherent Planned or Open item and Detail no summary and no netCost
  it should keep every other field of every item and Detail unchanged
```

**Integration:** a case in `tests/integration/d2/` opens the `workspace-v2` fixture and asserts the exact `summary` and `netCost` of CSCO, KO and PFE and of each Planned Trade. That case is the "defined value" T2.56's rule relies on. `verify:fixtures` stays green.

**Bench:** regenerate the `items` of `bench/expected-open-rows.json` with `npm run bench:generate`. The dataset is unchanged, so `generatorVersion` stays 1. Record the diff's summary in the evidence.

### T2.59 `tradeSummary` text format (revision 8)

**Seam:** `src/ui/format.ts` (`format.test.ts`).

```text
describe("Trade Summary text")
  it should format a Stock summary as "Long 60 shares @ $50.10", using the money format for the price
  it should keep a fractional share quantity exact ("Long 12.5 shares @ $40.00")
  it should format a Net cost debit as "$3,007.00" and a credit as "$212.00 credit"
```

The option and structure texts are tested where their variants arrive (D7, D10).

### T2.40 Trades tables: Underlying and Trade columns (behavioral part; revision 8)

**Seam:** `TradeList` (`TradeList.test.tsx`). The structural part (pinned column, scroll shadows, measurements) is in section 5.

**Basis:** section 2a "The Trades tables"; ui-contract Responsive (equivalent information), Accessibility.

```text
describe("Trades table columns")
  it should show the Open columns in order Underlying, Trade, Net cost, Entry, Account, with Underlying a link named by the symbol, and no Fees, Integrity, Deviations or Last activity column
  it should show the Planned columns in order Underlying, Trade, 1R, Reward : risk, Planned reward, Entry, Plan time, Account
  it should show the Trade cell's summary text and, on a second line, "Net cost $3,007.00" (Open) or "1R $250.00 · Reward : risk 2.4" (Planned)
  it should show "Entering · 60 of 100" or "Resolved · 120 of 100" in the Open Entry cell
  it should show a "Records disagree" badge in the Trade cell of a disagreeing row (coherent with findings, or incoherent with "Not available" as its Trade text), and no integrity badge on an agreeing row
```

The narrow/wide hiding (`display: none`) is CSS, measured in section 5.

**Test impact:**
- Every lookup of the "Strategy", "Quantity" or "Average cost" column, or of cell text such as "60 of 100" in the Open list, changes in this commit. That covers `TradeList.test.tsx` and e2e checks such as `open-position.spec.ts` and the C2.1 browser case. List each one in the evidence.
- `narrow.spec.ts` keeps its assertions. If one names a removed column, it changes here, with the reason.
- `bench/expected-open-rows.json`: regenerate `headers` and `rows` for the new cells.
- The uncommitted T2.40 work from before revision 8 (CSS reordering by `order`) is discarded. Its grid and sticky-column technique may be reused.

### T2.42 Semantic badge tones

**Seam:** a `Badge` component (new `src/ui/Badge.tsx` with its test), then its uses.

**Basis:** ui-contract Visual language ("compact semantic badges whose color reinforces text meaning"; green and red are reserved for signed results and for Stop/Target).

```text
describe("Badge")
  it should render its text with a data-tone of neutral, info, or warning
describe("badge meanings")
  it should give "Records disagree", an Active Deviation, and "Reflection declined" the warning tone
  it should give lifecycle badges the info tone and "Records agree" the neutral tone
```

**Structural check:** add to `ui-alignment.spec.ts` that each tone's text and background reach 4.5:1 contrast, and that no tone uses the green or red tokens.

### T2.46 Withdrawn

Decision U2 (2026-10-24): no live Plan Baseline preview. No task.

### T2.47 Clear corrected issues (U4)

**Seams:** `PlanForm` and `PositionChangeForm`.

**Basis:** ui-contract Forms ("understandable validation"), Accessibility ("logical focus after … validation").

```text
describe("New Plan issues")
  it should remove a field's issue and its summary line once that field is edited to a valid value, without submitting
  it should keep the summary, with the remaining issues, while any issue remains, and remove it when none remain
  it should not move focus when an issue clears
describe("Record entry issues")
  it should remove an Execution field's issue and its summary line once that field is edited to a valid value
  it should keep a Journal prompt's issue until that prompt is answered
```

**Rule:** issues returned by the server, such as Conflict or `EconomicTimeBeforePlan` (which needs the Plan time), clear only on the next submit. The UI does not re-validate them. Write that as part of the first case for each form.

### T2.48 Detail back link

**Seam:** `TradeDetail`.

**Basis:** ui-contract Navigation ("preserves the surrounding task").

```text
describe("back to the list")
  it should show a "Back to Trades" link above the h1 that opens the Trades tab of the Trade's stored lifecycle (Open → /, Planned → /?lifecycle=Planned)
  it should show the link on Loading, Not Found, and Error states as well
```

### T2.49 Detail summary card

**Seam:** `TradeDetail`, fixtures in `tests/support/open-detail-fixtures.ts`.

**Basis:** ui-contract Visual language (Stop/Target colour; tabular numerals; "Color never carries meaning alone"), Trade presentation (concepts stay distinct). Use only values already in the Detail view, including T2.58's `summary` and `netCost`.

```text
describe("summary card")
  it should lead the summary card with the Trade Summary text ("Long 100 shares @ $50.00" Planned, "Long 60 shares @ $50.10" Open), and on an Open Detail with Net cost (revision 8)
  it should open a Planned Detail with a summary of Intended entry, Stop, and Target, each with its text label, plus 1R and Reward : risk
  it should open an Open Detail with the Position quantity against plan ("120 of 100 shares"), the entry status, opening fees, Stop, and Target
  it should add the Average entry and Actual initial risk to the Open summary once the entry is resolved, and say "Entry not yet resolved" before
  it should show an active-Deviation badge in the Open summary when a recorded Deviation is Active
  it should show no summary figures on an incoherent Detail, leaving the Records disagree panel first
```

**Test impact:**
- The existing Plan, Plan Baseline, Position and Entry Quality regions keep their names and values. The summary repeats key values, so any `getByText` that would now match twice must be scoped to its region. List those lookups in the evidence.

### T2.50 Executions as expandable rows (U3)

**Seam:** `TradeDetail`.

**Basis:**
- Decision U3: the Trade reads as its plan and then its Executions. A Position Change is not a primary heading.
- ui-contract Trade presentation: Position Change and Execution must stay distinguishable, and canonical labels use Execution. So each Execution's Position Change is named in its expanded details, and Executions that share one Position Change are marked as a group.
- ui-contract Navigation: inline expansion is an allowed container.

**Shape:**
- One "Executions (n)" card in Fact Order.
- Collapsed row: "Buy 30 XYZ @ $50.00 · fee $0.50 · 2026-10-12 10:00".
- Each row has a disclosure button (`aria-expanded`, `aria-controls`, a chevron icon from U6). Its accessible name names the Execution, for example "Details for Buy 30 XYZ at 10:00".
- Expanded: the Instrument, the Economic Time, the Position Change it belongs to (its time and how many Executions it has), and that Position Change's reflection (the answers, or "Reflection declined" with its reason) or "No reflection".
- The collapsed row's fields and order are implementation decision I2; the example above is the starting proposal.
- Rows start collapsed. Expansion is view state only: it is not stored and is not put in the URL.
- Only values already in the Detail view model are used. If the link from an Execution to its Position Change's reflection is not in the view model, the subagent stops and reports instead of changing the view shape.

```text
describe("Executions")
  it should label the region "Executions (4)" with the count of Executions and list them in Fact Order
  it should show each Execution collapsed as one row with action, quantity, symbol, price, fee, and Economic Time, with no Executions table and no Position Change headings
  it should give each row a disclosure button named for its Execution, collapsed by default (aria-expanded false)
  it should show the Instrument, Economic Time, and the Position Change with its Execution count when the row is expanded, and hide them again when it is collapsed
  it should show the Position Change Reflection's answers in the expanded row of an Execution whose Position Change has one
  it should show "Reflection declined" with the reason, or "No reflection", when the Position Change has a decline or no reflection
  it should mark the Executions of a Position Change with several Executions as one group and show the shared reflection in each one's expanded row
  it should toggle with Enter and Space and keep focus on the button
```

**Test impact:**
- The `Executions` table lookups in `e2e/d2/open-position.spec.ts`, `e2e/d2/durability.spec.ts` and `src/ui/screens/TradeDetail.test.tsx` move to the rows. Lookups of "Position Change at …" headings move to the expanded details.
- Entry Quality's "Resolved at Position Change at …" and the Deviation text "caused by the Position Change at …" are unchanged.
- The Journal region (T2.51) still lists every reflection Entry. The expanded row is a second, contextual view of the same Entry.
- The "every table scrolls" check in `narrow.spec.ts` covers fewer tables.
- Open Lots stays a table; fix its clipped header with `nowrap` and its scroll region.

### T2.51 Journal Entries with Entry Type, Anchor and Source

**Seam:** `TradeDetail` (`JournalSection`).

**Basis:** ui-contract Trade and Journal presentation: "Journal timelines display Entry Type, exactly one Anchor, Source, moment/authored time where relevant … and Debt/decline status". Today Source is shown unlabelled ("Plan Confirmation at 09:30") and the Anchor is implied. This closes that gap.

```text
describe("Journal entries")
  it should show each Entry as its own item with the Entry Type as a badge, the Anchor ("Trade XYZ"), the Source labelled as Source, and the moment time
  it should show the authored time as well when it differs from the moment time
  it should show a decline with the warning badge "Reflection declined", its reason or "No reason given", its Anchor and Source
  it should label the region with the number of items, "Journal (4)"
```

### T2.52 Record entry Trade context

**Seam:** `PositionChangeForm`.

**Basis:** ui-contract Navigation ("Opening a contextual form preserves the surrounding task"); decision U5.

```text
describe("entry context")
  it should show the Trade's symbol, Strategy, stored lifecycle, and "60 of 100 shares entered" (or "Not entered yet") above the form
  it should offer "Back to the Trade" at the top that leaves without saving or calling the facade
```

---

## 5. Structural tasks

All measurements go in `e2e/d2/ui-alignment.spec.ts`, against `dist-faults` as the other e2e specs do, at 390×844 and 1280×900 unless stated. Each S task writes its measurements first, shows them failing on the current build, then makes them pass. "Ink" is `--ink`, "tint" is a new `--tint` token near `#f3efe6`, and colours are compared through `getComputedStyle`.

| Task | Change | Exact verification |
|---|---|---|
| T2.37 Navigation and banner styling | Current link as an ink-filled pill with white text in the sidebar. Bottom bar shows each icon over a small label, with the current item bold or ink. The durability banner uses the warning ground and line (`.banner.warning` exists unused), with its text and button on one row at wide and compact at narrow. | Current link background is ink and text white. In the bottom bar each icon's box sits above its label's box. Banner background equals `--warning-ground`. Banner height ≤ 120 px at 390, and at 1280 the button's vertical centre lies within the text block. axe clean on Trades at both widths. `e2e/d1/responsive-a11y.spec.ts` focus checks pass. |
| T2.38 One content column and side gutters (absorbs F8) | Banner, heading, tabs and cards share one left edge inside the content column. Every top-level card keeps a 16 px side gutter at narrow, including first run, onboarding and Migration Blocked. | At 1280 on Trades and on Open Detail, the left x of the banner, `h1`, tablist and first card are equal within 1 px. At 390 and 320, every `.card` on first run, onboarding, Migration Blocked, Trades and Detail has left ≥ 16 and right ≤ width − 16. No page overflow anywhere (`narrow.spec.ts` stays green). |
| T2.40 Trades tables, structural part (U1, I1 by revision 8; implements F9) | One table at every width, in the column order of section 2a. On narrow (below the 960 px layout switch): the Underlying column is pinned on the left (`position: sticky`) with its own background, a hairline, and a focus outline that is not clipped. The Trade cell shows its second line, and the Net cost (Open) or 1R and Reward : risk (Planned) columns are hidden; on wide the reverse. Scroll shadows appear on the edges while columns lie off-screen. The region stays a named, focusable scroll area. | At 390 and 320, for both "Open Trades" and "Planned Trades": the Underlying and Trade cells, including the second line and any badge, lie fully inside the viewport before any scrolling. After scrolling the region fully right, the Underlying cell's left edge is unchanged and the other cells have moved. The hidden columns' headers and cells are `display: none` on narrow, and the second line is `display: none` at 1280. Each figure appears exactly once in the accessibility tree at each width. No page overflow. A focused Underlying link shows its full outline. axe is clean at 320, 390 and 1280. `narrow.spec.ts` stays green. |
| T2.41 Wide Trades table styling | Small-caps 12.8 px muted headers that do not wrap. The symbol link is bold. Dates and badges do not wrap. Net cost and the other figures are right-aligned in tabular numerals. | Every `th` in "Open Trades" and "Planned Trades" at 1280 is one line high (height ≤ 1.6 × line-height) and has uppercase or small-caps text. Badges in rows are one line high. The symbol link's font-weight is ≥ 600. |
| T2.43 Prompt chip groups | Borderless fieldsets, with the legend as the small-caps label. Chips: the checked one ink-filled with white text, the native radio visually hidden but focusable, a visible focus ring on the chip (`:focus-within`). Applies to Plan Reflection and Position Change Reflection. | Checked chip's label background is ink, text white. The radio input is clipped (1 px or `clip-path`) yet focusable. A focused chip shows an outline of ≥ 2 px with ≥ 3:1 contrast. Fieldset border-style is none. `tabTo` (every-focus-visible) and axe pass. |
| T2.44 Execution rows as panels | Each Execution fieldset is a tinted rounded panel (radius ≥ 10, no groove border) with a small-caps legend. Quantity, Price and Fee sit in three columns at wide and two at narrow; Economic Time has its own row. "Remove Execution N" becomes a text-style button with the same name. "Add Execution" is an outlined pill. | Fieldset border-style is not `groove` and border-radius ≥ 10 px. At 1280 the Quantity, Price and Fee inputs share a top y. At 390 Quantity and Price share a top y. Economic Time sits below them. All names are unchanged (the existing `fillRows` helper passes). |
| T2.45 New Plan grouped into cards | Three cards with small-caps headings: **Trade** (Account, Strategy, Symbol, Plan time), **Risk** (Quantity, Intended entry, Stop, Target, as a two-column grid) and **Plan Reflection** (its prompts and chips). Labels are unchanged. | Three regions named Trade, Risk and Plan Reflection hold exactly those controls. At 1280, Stop and Target share a top y, as do Quantity and Intended entry. At 390 the Risk inputs are two per row. `fillPlan`, `confirmPlan` and the D1 Plan specs pass. |
| T2.53 Detail, receipt and Accounts styling | Summary card figures at ≥ 18 px bold tabular. Stop in red and Target in green, each with its label, both at ≥ 4.5:1. Plan Baseline and Entry Quality in a two-column figure grid at wide, with label and value rows capped at 480 px. Plan Reflection answers as prose sections with hairline dividers. Execution rows on the tint with right-aligned money. Receipt reuses the Execution row style, with "Back to the Trade" styled as a primary pill (still a link). Accounts lists Accounts as rows, not bullets. | Summary figure font-size ≥ 18 px, weight ≥ 600, `font-variant-numeric` tabular. Stop and Target colours meet 4.5:1 on white and their label text is present. At 1280 no label/value row is wider than 480 px. The receipt link has role link and an ink background. No page overflow at 320/390, and axe clean on the Detail, receipt and Accounts. |
| T2.54 Reference-pair screenshots | A script `npm run ui:screenshots` (`tools/ui-screenshots.ts`, using the `e2e/d2/support.ts` helpers) captures the 17 built screens from the comparison at 390 and 1280 into `evidence/D02/ui-alignment/`. Its README pairs each with its reference. | The command exits 0 and writes 34 PNGs plus the README. Committed for the critic and the user. |

---

## 6. Browser suite

- **New spec:** `e2e/d2/ui-alignment.spec.ts`, holding the S-task measurements.
- **Changed specs:** `open-position.spec.ts` and `durability.spec.ts` (T2.50), any heading or text lookups that the summary card makes ambiguous (T2.49), and Open-list column and cell lookups (T2.40, revision 8). Each change goes in the commit of the task that causes it, with the reason in the evidence.
- **Kept passing:**
  - every D1 and D2 browser case;
  - axe on every screen it already covers;
  - the keyboard-only entry;
  - `tabTo`'s visible-focus check;
  - every acceptance-matrix command in D2 section 8, as written. `npm run test:e2e` stays the one command.

---

## 7. Critic gate (T2.55)

**Setup:** a fresh critic, briefed from `.claude/docs/critic-brief.md` (setup helpers allowed). Its inputs are:
- `specs/design/ui-contract.md`;
- the screenshot index and the 24 references;
- this document;
- `evidence/D02/ui-alignment/` from T2.54.

It re-runs C2.1, C2.5, C2.7, C2.10 and C2.11 from D2 section 7, then these flows:

| Flow | Actions | Pass condition |
|---|---|---|
| CU.1 Shell | Visit Trades, New Plan, a Detail, Accounts and About at 390 and 1280. | The current page is marked visually and by `aria-current`. Wordmark at wide. Icons beside labels. The banner is compact, tinted and always present until protection. One left edge. 16 px gutters. |
| CU.2 Trades | Empty and populated, both tabs, both widths; resize live; scroll the narrow table. | `h1` "Trades". New Plan is reachable from the navigation and from the Empty states, with no duplicate in the header. On narrow, Underlying stays pinned while the rest scrolls, and Underlying and the two-line Trade cell are fully visible at 320 without scrolling. Every column's information is reachable. The Trade text reads as section 2a's format, and Net cost matches the Detail. Tab and URL are kept across resize. |
| CU.3 Forms | New Plan and Record entry: fill, cause issues, correct one field, decline, keyboard only. | Grouped cards. Chips read as selected without the radio dot, with visible focus. Execution panels in a grid. Corrected issues clear (U4). |
| CU.4 Detail | Planned, Open while entering, Open resolved, Open with an active Deviation, incoherent. | The summary card leads, with Stop and Target labelled and coloured. Executions are compact rows that expand, by mouse and keyboard, to show their Position Change and its reflection; Executions sharing a Position Change read as one group. Journal Entries show Entry Type, Anchor, labelled Source and time. The back link returns to the right tab. |
| CU.5 Reference comparison | Compare each built screen with its reference pair. | No high-priority difference from the comparison remains. Every remaining difference is listed as screenshot-only, future, or specs-override. |

**Defects:** each defect is handled as at the D2 gate: a failing test first, a fresh fix subagent, a rerun, then a new critic. Each report is saved as `evidence/D02/critic-<n>.md`, with a row in the critic-cost table.

---

## 8. Evidence and completion

- **Logs:**
  - red and green rows in `evidence/D02/tdd-log.md` (T2.36–T2.53);
  - S-task verifications and cumulative runs in `evidence/D02/structural.md`;
  - screenshots in `evidence/D02/ui-alignment/`.
- **Done when:**
  - every task is complete;
  - the cumulative run is fully green (unit, integration, browser, 11 checks);
  - `verify:fixtures` is still equal;
  - a fresh critic passes T2.55.

  The `claude-opus-5.5-d2` tag is not moved. D4's harness keeps building from it.
- **Acceptance rows:** no status change. AC-UI-001 and AC-UI-002 stay `covered`, and their command, `e2e/d2/responsive-a11y.spec.ts`, keeps passing.
