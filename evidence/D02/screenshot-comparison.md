# Screenshot comparison: built D1/D2 app against `specs/reference/ui-screenshots/`

A read-only subagent made this comparison on 2026-10-24 at commit `404fda1`, at the user's request. The report is saved here in substance. It is the source for [plan/D02-ui-alignment.md](../../plan/D02-ui-alignment.md).

**How it was made:**
- The built screens were captured at 390×844 and 1280×900, full page, in a fresh Chromium profile, using data from the `e2e/d2/support.ts` helpers.
- The captures are in `test-results/screenshot-compare/shots/` (git-ignored): 01-first-launch through 17-about, each as `-narrow.png` and `-wide.png`.

**Full-page capture artifacts, not defects:**
- The fixed bottom bar appears mid-page in the narrow captures.
- The sidebar background stops at 900 px.

## Summary

**What already matches:**
- cream ground `#f7f3ea`;
- white cards (14 px radius, `#d9d3c5` border);
- near-black pill primaries and outlined pill secondaries;
- small-caps section labels (12.8 px, `#55524b`);
- tabular right-aligned numbers;
- bottom bar at narrow widths and sidebar at wide.

**What differs:** composition and hierarchy. The app reads as a correct but plain form-and-table app, not a quiet, card-led dashboard. The five biggest differences:

1. **Shell:** no identity and no current state. Four plain text links with no wordmark, no icons and no active item (`aria-current` is null everywhere). The reference has a wordmark, icon-and-label items, an ink-filled active pill, and a dashed "+ New plan".
2. **Trades list:** no page header, no primary action, and a wide table.
   - There is no `h1` on `/`.
   - At narrow widths the table is 863 px wide inside a 358 px region, so only four columns are visible.
   - Headers are bold 16 px and wrap.
   - The reference has a title with a count line, a full-width "+ New plan" button, and one card per Trade.
3. **Trade Detail:** no summary card, and very long.
   - Open Detail is 3,316 px tall at wide and 4,234 px at narrow, across nine cards.
   - Each Position Change repeats a six-column Executions table.
   - The reference opens with a hero card of three figures, then the plan text, then one "Legs & fills" card of compact tinted rows.
4. **Record entry:** browser-default fieldsets (2 px groove `rgb(239,239,239)`, square corners) and full-width single-column fields (about 900 px for a quantity at wide). The reference puts Quantity and Price side by side in a sheet or drawer.
5. **Layout:** ragged alignment, and the durability warning dominates.
   - The banner spans x 236–1264 at wide, while headings and tabs start at x 286 and cards at x 302.
   - At narrow widths the warning is about 190 px tall, roughly 22% of the viewport.

## Per screen (condensed)

### Trades list

**Sidebar (high):** add a wordmark ("Trade Journal", the name About shows) and icons. Mark the current item with `aria-current="page"` plus an ink pill. The bottom bar gets an icon over a small label, with the current item bold.

**Header and actions:**
- *High:* add an `h1` "Trades". Skip the greeting.
- *Medium:* add a primary New Plan action under the header.

**List:**
- *High at narrow:* one card per Trade. Line 1 holds the symbol and badge; line 2 holds Strategy · Account · entry status; the figures sit on the right, tabular.
- *Medium at wide:* keep the table, with small-caps 12.8 px headers, `nowrap` on dates and badges, and a bold symbol.

**Badges (medium):** semantic tints instead of black outlines. Use a neutral tint for "Records agree" and an amber tint for disagreement and Deviations. Never use green or red.

**Alignment (medium):** put the banner inside the content column, and drop the extra 16 px indent on cards.

### New Plan

**Grouping (high):** cards with small-caps labels. The Trade card holds Account, Strategy, Symbol and Plan time. The Risk card holds Quantity, Intended entry, Stop and Target in a two-column grid. The Plan Reflection card holds the prompts and chips. Today it is a stack of 12 inputs, about 928 px wide each.

**Live preview (medium, optional):** a live preview of 1R, reward and Reward : risk from the same derivation the Plan Baseline uses. It must never copy the prototype figures, whose arithmetic is known-invalid.

**Chips:**
- *Medium:* the checked chip gets an ink fill and white text, with the native radio dot hidden but focusable.
- *Low:* fieldsets become borderless, with the legend styled as the small-caps label.

**Low:**
- an optional Back link at the top;
- lighter field labels (keep the label text);
- strategy cards when D7 adds strategies.

**Observation:** after a failed Confirm, the field issues and the summary stay on screen once every field is filled, until Confirm is pressed again.

### Planned Detail

- **Back link (medium):** add "Back to Trades".
- **Summary card (high):** a three-column grid of large tabular figures: Intended entry, Stop in red, Target in green, each with its text label, plus 1R and Reward : risk. At wide, cap the label/value rows; today the label sits at x 323 and the price at x 1177.
- **Plan Reflection (medium):** show the answers as prose sections with hairlines.
- **Empty Position Changes card (low):** an optional "Position Changes (0)" card for the Empty state.

### Open Detail

- **Summary card (high):** Position "120 shares", Average entry, Opening fees, Stop and Target in colour, Actual initial risk, and a Deviation badge. Fold Plan Baseline and Entry Quality into a two-column grid. Keep every value.
- **Position Changes (high):** label the section "Position Changes (3)". Head each Position Change with its time, and give each Execution one tinted row ("Buy 30 @ $50.00 · fee $0.50 · 10:00"). This replaces the repeated six-column tables, whose Instrument column always reads the symbol and which scroll sideways at narrow widths.
- **Open Lots (medium):** the "Unconsumed opening fee" header is clipped at narrow widths.
- **Badges (medium):** amber tint for an Active Deviation and for "Reflection declined".

### Journal region

**Entry items (medium):** one sub-card per Entry, with an Entry Type badge, the Anchor, the authored time, and the answers. A decline gets an amber badge and its reason.

**Source (medium, to verify):**
- **What the subagent saw:** no separately labelled Source.
- **What the main session found:** `JournalSection` renders the Source, unlabelled, as "Plan Confirmation at 09:30", and does not show the Anchor separately.
- **What the contract requires:** Entry Type, exactly one Anchor, Source, and time (ui-contract, Trade and Journal presentation).

**Count (low):** "Journal (4)".

### Record entry

- **Context (medium):** keep the route, and add a context line ("XYZ · Long Stock · Open, 60 of 100 shares") and a top "Back to the Trade" link.
- **Execution rows (high):** tinted rounded panels with small-caps legends. Quantity, Price and Fee in three columns at wide (two at narrow), with Economic Time on its own row. Make Remove a smaller text-style button.
- **Low:** the Action may appear as a static ink chip, and the primary button may go full width at narrow widths.

### Reflection

**Chips and Decline (medium):** chip treatment as in New Plan, with borderless fieldsets. Consider moving "Decline to reflect" below the prompts as a quieter but still explicit choice.

### Receipt

**Low:** reuse the Execution row style, and make "Back to the Trade" a primary pill that is still a link.

### First launch, onboarding, Accounts and About

- **Gutter (medium):** the narrow first-launch card runs edge to edge, the same problem as F8.
- **Banner (medium):** give the durability banner the warning tint (`.banner.warning` exists unused), compact, with the button inline at wide.
- **Accounts (low):** rows instead of bullets.

## Future-deliverable references

- **Spread Detail:**
  - *Use now:* the per-leg row pattern and the "(n) · m planned" label.
  - *Later:* the arithmetic, in D7 and after.
- **Stats:** KPI tiles and dense rows as density lessons only. The equity curve, "adherence" and the period chips are not product semantics.
- **Journal timeline:** date-group headers and Entry cards for the standalone Journal. Filter chips need toggle semantics, and the categories are not canonical.
- **Not before their deliverables:**
  - *Marks:* hero P&L, CURRENT price, "away" and "cushion".
  - *D6:* Close position.
  - *Banned in the MVP:* Insights and coach surfaces.
- **Entry composer:** as a standalone Entry, D5 and later.

## Do not change (the specs override the screenshot)

- Canonical wording: Trade, Record entry, Execution, the Plan Reflection prompts, and Strategy names from the Reference Catalog.
- No adherence, P&L, current price, "away" or "cushion".
- No Close position, Done or Insights.
- No prototype figures.
- No prototype-only fields.
- The runtime emotion options.
- The dedicated Record entry route.
- The Journal inline in the Detail.
- The darker input borders, for contrast.
- Pill primaries.
- About's capability list.
- Per-row integrity status.
- The one-page New Plan.

## Suggested sequencing (as reported)

- **A, shell and alignment:** low test risk; overlaps F8.
- **B, Trades header and list:** cards at narrow widths would change `narrow.spec.ts` and settle F9.
- **C, form styling:** keep every label and legend text; a hidden radio must stay focusable with a visible ring.
- **D, Detail hierarchy:** removing the Executions and Open Lots tables changes browser and unit lookups. Keep the `h1` as the symbol, and keep view shapes identical for `verify:fixtures`.
