# D2 follow-up: align the UI with the reference screenshots: task breakdown

Status: **draft, awaiting the user's approval** (written 2026-10-24). Once approved it becomes plan revision 7 (decision 47), tagged `claude-opus-5.5-plan-r7`. The decisions in section 2 must be answered first.

**Source.** The screenshot comparison made on 2026-10-24 against commit `404fda1`. It compared the 24 references in `specs/reference/ui-screenshots/` with screenshots of the built app at 390 and 1280 px (`test-results/screenshot-compare/shots/`, git-ignored). The report is saved in [evidence/D02/screenshot-comparison.md](../evidence/D02/screenshot-comparison.md).

**Position in the plan.** This batch follows the D2 follow-ups F1–F11 in [D2, section 11](D02-open-a-long-stock-position.md#11-deferred-follow-ups-plan-revision-6-decision-46) and runs **before D4's first task**. Two follow-ups merge into it:
- **F8** (Migration Blocked gutter) becomes part of T2.38.
- **F9** (narrow Open list) is replaced by T2.40 or T2.41, depending on decision U1.

The task IDs continue D2's numbering, T2.36–T2.55, so `tdd.sh` and the evidence files stay in `evidence/D02/`.

---

## 1. Authority and boundaries

**What the screenshots decide.** Following `specs/design/ui-contract.md` (Status and authority; Screenshot limitations) and `specs/reference/ui-screenshots/index.md`, the references set layout, density, hierarchy, cards, controls and responsive composition. They do **not** set labels, numbers, calculations, inferred state, navigation labels or fields. Those come from the domain documents, the glossary and the Entry Definitions.

**Durable compatibility.** This is a presentation batch:
- no schema change;
- no change to any committed fixture (`tests/fixtures/workspace-v1`, `workspace-v2`), the bench dataset or a backup content version.

**No view-model shape changes for coherent Trades.** The v2 fixture snapshot compares every Planned and Open Detail and both lists, so `verify:fixtures` would fail. Every new presentation uses only values already in the view models. The one exception is T2.46 (decision U2), which adds a read-only operation instead of changing an existing view.

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
- **Trades list:** keeps per-row integrity status.
- **New Plan:** stays one page while the catalog has one Strategy. Step-1 Strategy cards wait for D7.

---

## 2. Decisions for approval

| ID | Question | Recommendation | Alternative and cost |
|---|---|---|---|
| U1 | **Narrow Trades list:** cards, or the current table restyled with a scroll cue (F9 as written)? | **Cards on narrow, table on wide** (T2.40). Each card shows the same information as its row: symbol, badges, Strategy · Account · entry status, and the figures. Wide keeps the table, which is dense, sortable later, and what 21 browser row lookups use. | Restyled table plus cue (T2.41 only): less work and no test churn, but narrow stays a sideways-scrolling table, unlike the reference. |
| U2 | **New Plan live preview** of 1R, original reward and Reward : risk while typing? | **Include** (T2.46) through a new read-only facade operation that runs the same Trade Analysis derivation the Plan Baseline uses. The UI computes nothing (decision 31). | Skip it. The figures still appear after Confirm. Saves a facade operation and a capability-manifest entry. |
| U3 | **Detail Executions:** compact list rows instead of a table per Position Change? | **List rows** (T2.50). One row per Execution, "Buy 30 XYZ @ $50.00 · fee $0.50 · 10:00", grouped under each Position Change. Open Lots stays a table. | Restyled tables: no test churn, but the Detail stays long. |
| U4 | **Stale validation issues:** clear a field's issue as soon as it is corrected? | **Yes, in both New Plan and Record entry** (T2.47). The summary stays while any issue remains. Today the issues stay until the next submit. | Keep issues until resubmit, which is the current D1/D2 behavior. |
| U5 | **Contextual forms:** sheets and drawers, or routes? | **Keep dedicated routes**, which the contract allows, and add Trade context to Record entry (T2.52). | A sheet or drawer: a larger change to routing and focus management for no contract gain. |
| U6 | **Icons:** how are navigation icons supplied? | **Inline SVG** in the source, marked `aria-hidden`. No new dependency (decision 42 pins packages). | An icon package needs a plan revision for the pin. |
| U7 | **Trades header content** | `h1` "Trades" plus the primary New Plan action. **No greeting and no count line**: a total needs a count the paged read model does not provide. | A count for the current page only, which could mislead with Planned paging. |

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
| T2.39 | Trades page header and primary action | B Trades | B | T2.38 | `TradeList` |
| T2.40 | Narrow Trades list as cards (U1 = cards) | B | B | T2.39 | `TradeList` with a width context |
| T2.41 | Wide Trades table styling | B | S | T2.39 | `ui-alignment.spec.ts` (list) |
| T2.42 | Semantic badge tones | B | B | T2.38 | `Badge` component |
| T2.43 | Prompt chip groups | C Forms | S | T2.38 | `ui-alignment.spec.ts` (chips) |
| T2.44 | Execution rows as panels in a grid | C | S | T2.43 | `ui-alignment.spec.ts` (entry form) |
| T2.45 | New Plan grouped into cards | C | S | T2.43 | `ui-alignment.spec.ts` (plan form) |
| T2.46 | Live Plan Baseline preview (U2) | C | B | T2.45 | facade operation and `PlanForm` |
| T2.47 | Clear corrected issues (U4) | C | B | T2.45 | `PlanForm`, `PositionChangeForm` |
| T2.48 | Detail back link | D Detail | B | T2.38 | `TradeDetail` |
| T2.49 | Detail summary card | D | B | T2.42, T2.48 | `TradeDetail` |
| T2.50 | Position Changes as Execution rows (U3) | D | B | T2.49 | `TradeDetail` |
| T2.51 | Journal Entries with Entry Type, Anchor and Source | D | B | T2.42 | `TradeDetail` |
| T2.52 | Record entry Trade context | D | B | T2.48 | `PositionChangeForm` |
| T2.53 | Detail, receipt and Accounts styling | D | S | T2.49–T2.52 | `ui-alignment.spec.ts` (detail) |
| T2.54 | Reference-pair screenshots | close | S | all above | `npm run ui:screenshots` |
| T2.55 | Critic gate for the batch | close | gate | T2.54 | fresh critic (section 7) |

**Ordering:**
- Batches run A → B → C → D.
- Within a batch, tasks run in the listed order.
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

### T2.39 Trades page header and primary action

**Seam:** `TradeList` (`src/ui/screens/TradeList.test.tsx`).

**Basis:** ui-contract Visual language (primary actions), Accessibility (a heading to land on after navigation, which T2.29/F5 relies on); decision U7.

```text
describe("Trades header")
  it should show an h1 "Trades" above the tabs in the Loading, Ready, Empty, and Error states of both tabs
  it should offer a primary "New Plan" link to /plans/new under the heading while the runtime is Writable
  it should not offer the New Plan action while Recovery Only
```

**Test impact:**
- `TradeList.test.tsx:217` uses an unscoped `getByRole('link', { name: 'New Plan' })` and must scope to the Empty state.
- Browser tests already scope New Plan to `navigation "Primary"`.
- Check every `getByRole('heading', { name: ... })` lookup for a partial match on "Trades".

### T2.40 Narrow Trades list as cards (only if U1 = cards)

**Seam:** `TradeList` with a width context. Expose the shell's existing `wide` value through `RuntimeContext` or a `useWide()` hook, so jsdom renders one layout at a time.

**Basis:** ui-contract Responsive ("equivalent information, fields, actions"), Visual language (cards).

```text
describe("narrow Open list")
  it should render each Open Trade as a list item whose link is named by the underlying, with Strategy · Account · entry status, the quantity "60 of 100", the average cost, the Deviation count, the integrity badge, and Last Activity
  it should show exactly the values the wide table row shows for the same Trade
describe("narrow Planned list")
  it should render each Planned Trade as a list item with 1R, original reward, Reward : risk, entry readiness, and the disagreement badge when present
describe("live switch")
  it should switch between table and cards on resize while keeping the selected tab and the page
```

**Test impact:**
- `e2e/d2/narrow.spec.ts`: the Open and Planned cases assert a scrolling table at 375/320. Change them to assert the card list and no page overflow.
- The table name lookups at wide width are unchanged. That covers `support.ts` `openTradeFromOpenList` and the `runtime-failure` and `responsive-a11y` specs at 1280.
- `responsive-a11y.spec.ts` runs axe on the Open list at narrow width as well. It must stay clean.
- F9's check is superseded and recorded as such.

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

### T2.46 Live Plan Baseline preview (only if U2 = include)

**Seams:**
1. A new read-only facade operation, for example `TradeViewsAndReporting.previewPlanBaseline(draft)`. It returns the Plan Baseline's `CalculationResult`s, or `Unavailable` with reasons, through the same Trade Analysis derivation `confirmPlan` uses. It does no storage I/O.
2. `PlanForm`.

**Basis:** screenshot index ("Live result hierarchy only…"); decision 31 (derive, never estimate).

```text
describe("previewPlanBaseline")
  it should return Unavailable naming the missing inputs while quantity, intended entry, Stop, or Target is incomplete
  it should return 1R, original reward, and Reward : risk equal to the Plan Baseline confirmPlan stores for the same values
  it should return Unavailable when the Stop is not below the intended entry for a Long Stock leg
  it should read and write nothing (store dump and content revisions unchanged)
describe("New Plan preview")
  it should show the preview as Unavailable with what is missing until the risk fields are complete
  it should show $250.00, $600.00, and 2.4 for the reference values and update when a value changes
  it should make no mutating facade call while the preview updates
```

**Manifest and tests:**
- Add the operation to the capability manifest. `verify:capabilities` must pass, and About will list it.
- `tests/support/facade-double.ts` gains the operation.

### T2.47 Clear corrected issues (only if U4 = yes)

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

**Basis:** ui-contract Visual language (Stop/Target colour; tabular numerals; "Color never carries meaning alone"), Trade presentation (concepts stay distinct). Use only values already in the Detail view.

```text
describe("summary card")
  it should open a Planned Detail with a summary of Intended entry, Stop, and Target, each with its text label, plus 1R and Reward : risk
  it should open an Open Detail with the Position quantity against plan ("120 of 100 shares"), the entry status, opening fees, Stop, and Target
  it should add the Average entry and Actual initial risk to the Open summary once the entry is resolved, and say "Entry not yet resolved" before
  it should show an active-Deviation badge in the Open summary when a recorded Deviation is Active
  it should show no summary figures on an incoherent Detail, leaving the Records disagree panel first
```

**Test impact:**
- The existing Plan, Plan Baseline, Position and Entry Quality regions keep their names and values. The summary repeats key values, so any `getByText` that would now match twice must be scoped to its region. List those lookups in the evidence.

### T2.50 Position Changes as Execution rows (only if U3 = list rows)

**Seam:** `TradeDetail`.

**Basis:** ui-contract Trade presentation ("canonical headings and audit labels use Execution"; Position Change and Execution kept distinct).

```text
describe("Position Changes")
  it should label the region "Position Changes (3)" with the count of Position Changes
  it should head each Position Change with its Economic Time and its Execution count, in Fact Order
  it should list each Execution as one row with its action, quantity, symbol, price, fee, and Economic Time, and no Executions table
```

**Test impact:**
- The `Executions` table lookups in `e2e/d2/open-position.spec.ts`, `e2e/d2/durability.spec.ts` and `src/ui/screens/TradeDetail.test.tsx` move to the list.
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
| T2.41 Wide Trades table styling | Small-caps 12.8 px muted headers that do not wrap. The symbol link is bold. Dates and badges do not wrap. | Every `th` in "Open Trades" and "Planned Trades" at 1280 is one line high (height ≤ 1.6 × line-height) and has uppercase or small-caps text. Badges in rows are one line high. The symbol link's font-weight is ≥ 600. |
| T2.43 Prompt chip groups | Borderless fieldsets, with the legend as the small-caps label. Chips: the checked one ink-filled with white text, the native radio visually hidden but focusable, a visible focus ring on the chip (`:focus-within`). Applies to Plan Reflection and Position Change Reflection. | Checked chip's label background is ink, text white. The radio input is clipped (1 px or `clip-path`) yet focusable. A focused chip shows an outline of ≥ 2 px with ≥ 3:1 contrast. Fieldset border-style is none. `tabTo` (every-focus-visible) and axe pass. |
| T2.44 Execution rows as panels | Each Execution fieldset is a tinted rounded panel (radius ≥ 10, no groove border) with a small-caps legend. Quantity, Price and Fee sit in three columns at wide and two at narrow; Economic Time has its own row. "Remove Execution N" becomes a text-style button with the same name. "Add Execution" is an outlined pill. | Fieldset border-style is not `groove` and border-radius ≥ 10 px. At 1280 the Quantity, Price and Fee inputs share a top y. At 390 Quantity and Price share a top y. Economic Time sits below them. All names are unchanged (the existing `fillRows` helper passes). |
| T2.45 New Plan grouped into cards | Three cards with small-caps headings: **Trade** (Account, Strategy, Symbol, Plan time), **Risk** (Quantity, Intended entry, Stop, Target, as a two-column grid) and **Plan Reflection** (its prompts and chips). Labels are unchanged. | Three regions named Trade, Risk and Plan Reflection hold exactly those controls. At 1280, Stop and Target share a top y, as do Quantity and Intended entry. At 390 the Risk inputs are two per row. `fillPlan`, `confirmPlan` and the D1 Plan specs pass. |
| T2.53 Detail, receipt and Accounts styling | Summary card figures at ≥ 18 px bold tabular. Stop in red and Target in green, each with its label, both at ≥ 4.5:1. Plan Baseline and Entry Quality in a two-column figure grid at wide, with label and value rows capped at 480 px. Plan Reflection answers as prose sections with hairline dividers. Execution rows on the tint with right-aligned money. Receipt reuses the Execution row style, with "Back to the Trade" styled as a primary pill (still a link). Accounts lists Accounts as rows, not bullets. | Summary figure font-size ≥ 18 px, weight ≥ 600, `font-variant-numeric` tabular. Stop and Target colours meet 4.5:1 on white and their label text is present. At 1280 no label/value row is wider than 480 px. The receipt link has role link and an ink background. No page overflow at 320/390, and axe clean on the Detail, receipt and Accounts. |
| T2.54 Reference-pair screenshots | A script `npm run ui:screenshots` (`tools/ui-screenshots.ts`, using the `e2e/d2/support.ts` helpers) captures the 17 built screens from the comparison at 390 and 1280 into `evidence/D02/ui-alignment/`. Its README pairs each with its reference. | The command exits 0 and writes 34 PNGs plus the README. Committed for the critic and the user. |

---

## 6. Browser suite

- **New spec:** `e2e/d2/ui-alignment.spec.ts`, holding the S-task measurements.
- **Changed specs:** `narrow.spec.ts` (T2.40), `open-position.spec.ts` and `durability.spec.ts` (T2.50), and any heading or text lookups that the summary card makes ambiguous (T2.49). Each change goes in the commit of the task that causes it, with the reason in the evidence.
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
| CU.2 Trades | Empty and populated, both tabs, both widths; resize live. | `h1` "Trades" and a New Plan action. U1's narrow layout shows every value the wide row shows. Tab and URL are kept across resize. |
| CU.3 Forms | New Plan and Record entry: fill, cause issues, correct one field, decline, keyboard only. | Grouped cards. Chips read as selected without the radio dot, with visible focus. Execution panels in a grid. Corrected issues clear (U4). Preview figures match the confirmed Plan Baseline (U2). |
| CU.4 Detail | Planned, Open while entering, Open resolved, Open with an active Deviation, incoherent. | The summary card leads, with Stop and Target labelled and coloured. Execution rows are under Position Changes. Journal Entries show Entry Type, Anchor, labelled Source and time. The back link returns to the right tab. |
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
