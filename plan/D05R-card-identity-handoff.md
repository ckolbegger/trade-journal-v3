# D5R card identity: handoff for a planning session

Written 2026-10-31 at the user's request, when the implementing session's context was nearly full. This file holds everything the user decided that isn't yet in the plan or the evidence.

## 1. Your goal, and where you stop

Plan two changes to D5R's Review cards, as **plan revision 27 (decision 68)** with a task breakdown. Commit it and tag it `claude-opus-5.5-plan-r27`. **Then stop and report to the user.** The user will review the plan before any code changes. Don't start implementing, and don't dispatch `tdd-task` subagents.

The two changes:

1. **The Trade id in the HTML.** Each Review card's list item carries its Trade's id, so tests (and anything else) can locate a card by Trade, even when two Trades share an Underlying and have identical summary lines.
2. **A card header a trader can tell apart.** The header shows the Trade's summary line after the Underlying, so two cards in the same Instrument no longer both read just "XYZ". The longer header must not crowd the Stop-to-Target slider: the slider moves below the description, **but only when the header is narrow enough that the slider would be cramped.**

## 2. Read first

Read in this order:

1. `CLAUDE.md`. It loads automatically. Follow its pointer: **drafting a breakdown means reading `.claude/docs/drafting-breakdowns.md` first.**
2. `plan/D05R-handoff.md`:
   - every standing rule and process note;
   - section 7, the state table and its open questions;
   - the paragraph on plan revisions. With this revision, the next revision becomes r28 and the next decision 69.
3. `plan/D05R-review-redesign.md`:
   - **A150** (card list and header), **A153** with its decision-67 amendment ("also held by"), **A156** (hold message), **A161** (links), **A162** (responsive: the slider's own row at narrow widths);
   - section 6.2: **B5R.2**, **B5R.3** and **B5R.11**;
   - section 6.3, and section 6.4 "Card helpers (decision 65)": the five rules and the migration rule;
   - the task graph (around line 95) and the verification table (around line 310), to see how existing rows and bug-task rows are written.
4. `plan/implementation-plan.md`: decision rows 64–67, and the "Immutable revision" freeze record (around line 89).
5. `evidence/D05R/structural.md`, from "## T5R.15 Browser suite" to the end: T5R.15, its ocr table, B1, B1-B1, T5R.9-B5 and the T5R.15-B2 heading.
6. The code below, read only. Don't change it.

| File | What to look at |
|---|---|
| `src/ui/screens/ReviewCard.tsx:98-111` | The card's `<li className="review-card">`, its header button (Underlying, remains, band), and the hold message. |
| `src/ui/screens/ReviewCard.tsx:266` | The card body: `<section aria-label="XYZ review">`. |
| `src/ui/screens/ReviewView.tsx` | `blockerText` and `Status` (lines 55–135). The `underlying` lookup, defined twice (lines 115 and 260). `tradeLine` (line 262). The after-Action-save message (line 358). Card rendering (around line 495: keyed by `trade.tradeId`, `onToggle={() => toggle(trade.tradeId)}`). |
| `src/ui/screens/CardMarks.tsx:155-170` | "also held by", linked by `tradeLine` (decision 67). |
| `src/ui/format.ts:29` | `tradeSummary(summary)`, which gives e.g. "Long 100 shares @ $50.00". |
| `src/coordinators/daily-review/types.ts`, `daily-review.ts` (`reviewItem`, around line 161) | `ReviewTradeItem.summary?` comes from `openLongStockSummary`, the same function the Trade list uses. It's absent when a Trade's facts can't be replayed. |
| `src/ui/app.css:1056-1135` | The card header grid: `minmax(0, 1fr) 9rem`, with the slider in a fixed side column. Under `@media (max-width: 639.98px)` the slider moves to its own row (A162). |
| `src/ui/screens/TradeList.tsx:166, 217` and `TradeDetail.tsx:254` | Each Trade-list row links to `/trades/<id>`. The "Mark missing" links go to `/review?instrument=…`. |
| `e2e/d4/support.ts:145-230` | `tradeCard` (an exact region name, "XYZ review"), `cardHeader` (`^Review XYZ(\s\|$)`, symbol escaped), `reachCard`, `reachPanel`. |
| `e2e/d5r/support.ts` (156 lines) | `tagCards`, `cardItem`, `isShared`, `headerOf`, `panelHeaderOf`, and nine helpers that duplicate D4's: `reachTrade`, `reachTradePanel`, `markRowOf`, `enterMarkOf`, `actionFormOfTrade`, `saveActionOf`, `reflectionsOfTrade`, `debtFormOfTrade`, `answerDebtOf`. |
| `src/ui/screens/CardMarks.test.tsx:258, 276, 637-638` | These pick the second XYZ card by position (`[, other]`, `[1]!`). |

## 3. What the user decided (not yet recorded anywhere else)

1. **The Trade id goes in the HTML.** Each card's list item gets an attribute such as `data-trade-id={trade.tradeId}` (the exact form is yours to plan). It's a test hook: nothing visible changes and no plan rule changes.
   - The tests get the ids from the Trade list's `/trades/<id>` links, or from the URL right after creating a Trade.
   - The user chose this because it works in every case, even when two Trades have identical summary lines.
2. **The card header shows the Trade's summary line** after the Underlying, for the trader. This amends A150, which is why it's revision 27 with decision 68. Use the same text as the Trade list and "also held by" (`tradeSummary`). When a Trade has no summary, the header shows the Underlying alone.
3. **The slider moves below the description only when it would be cramped.** It must not move at every width.
   - Today the move is set by the viewport (`max-width: 639.98px`, A162). A longer header can crowd the slider at wider viewports too.
   - Consider a container query on the card header, or a breakpoint chosen from the header's own width.
   - B4.13 and B5R.11 check this layout. Plan their verification, and say whether A162's wording changes.
4. **Weigh every place where two Trades in the same Instrument read the same,** with the user. Section 4 lists what I found. Decide with the user, in this revision, which of them to fix.
5. **Search for simplifications before exploring them, then launch one subagent per candidate.** The user asked for this explicitly. Section 5's list is a set of seeds, not the full set. Work in three steps:
   1. **Survey first, before reading section 5.** Think it through yourself, and send one broad `Explore` subagent across the whole codebase: app code, unit, integration and e2e tests. Its question: what could be simpler, safer or removed if every Review card carried its Trade id in the HTML, and if the header showed the summary line? Don't give it section 5's list, so it isn't anchored.
   2. **Merge** the survey's findings with section 5. Drop duplicates, and mark which candidates are new.
   3. **Launch one subagent per merged candidate.** Each one gets a single candidate. Have each one report:
      - what can go, and what replaces it;
      - the risks;
      - what verifies it.

   Use their reports to shape the tasks. Your report to the user lists every candidate, says where each came from (the survey or section 5), and says whether you planned it or dropped it, and why.
6. **T5R.15-B2 is superseded by this work.** It's recorded in `structural.md` as a test-only bug task with three findings from T5R.15's ocr review:
   - the `data-trade` tag set by `tagCards` could go stale;
   - the tagging relies on exactly one XYZ card showing "reflection due";
   - the refusal message names only "XYZ", and `answerDebtOf`'s "Saved reflection" check is page-wide.

   Its first attempt **stopped without changing anything**, because no rendered card carries its Trade id. The note recording that, and the user's choice of `data-trade-id`, was **not written**: the user stopped the session first. Record it in `structural.md` under "### T5R.15-B2" as part of your plan commit. The new tasks absorb B2's three findings.
7. **Declined by the user, for now:** an ESLint `no-nested-ternary` rule. Don't plan it.

## 4. Where two Trades in the same Instrument read the same

I found these by reading the code. Check each one yourself.

| Where | Shows now | File |
|---|---|---|
| Card header | "XYZ" | `ReviewCard.tsx:104` |
| Open card's region label (accessible name, used by tests) | "XYZ review" | `ReviewCard.tsx:266` |
| Hold message when leaving a card with unsaved work | "Save or discard what you entered for XYZ to leave it." | `ReviewCard.tsx:110` |
| After an Action save on a held card | "The Action is saved. Save or discard what you entered for XYZ to go on." | `ReviewView.tsx:358` |
| Blockers | "Action missing for XYZ", "Reflection due for XYZ", "XYZ: recorded facts disagree", "XYZ: recorded facts cannot be replayed" | `ReviewView.tsx:74-96` |
| Complete with unavailable Marks | "Trades: XYZ, XYZ" | `ReviewView.tsx:125` |
| "Mark missing" links on the Trade list and Trade Detail | `?instrument=XYZ` opens the *first* card holding XYZ, which may be another Trade's | `TradeList.tsx:217`, `TradeDetail.tsx:254` |

**Not ambiguous:**
- **"Mark missing for XYZ".** It names the Instrument, and the Mark is shared.
- **Non-UI code.** Every use of the Underlying there is keyed by Instrument, which is correct.
- **Trade list and Trade Detail.** The list shows a summary line in each row. Trade Detail shows one Trade, with the summary under its "XYZ" title.

**Remaining gap:** a Trade with no summary (facts can't be replayed) still shows only "XYZ".

**Options I put to the user (no decision yet).** For the messages and blockers:
- (a) always add the summary line;
- (b) add it only when another Trade in the Review shares the Underlying. This was my recommendation: no existing expectation changes, and the ambiguity is resolved exactly where it exists.
- (c) leave them as they are.

For the links: pass the Trade too (`?trade=<id>&instrument=<key>`). T5R.12-B1 already supports that combination.

Option (a) changes about 15 existing expectations, including the D4 browser specs `hold.spec.ts:20` and `acknowledge.spec.ts:23`. The tests asserting these texts are:
- `ReviewCards.test.tsx:471, 640, 717, 829, 849`;
- `ReviewView.test.tsx:169, 186, 252`;
- `ReviewCard.test.tsx:491, 497`;
- `e2e/d5r/marks.spec.ts:88`.

## 5. Seed simplifications (merge with the survey's; see decision 5)

Read this section only after the survey in decision 5 has reported.

1. **The D5R test helpers.** About 70 of the 156 lines in `e2e/d5r/support.ts` exist only because two cards read "XYZ": `tagCards` and its precondition, the `data-trade` tagging, `isShared`, the dual-path `cardItem`/`headerOf`/`panelHeaderOf`, and the nine duplicated helpers. The specs call `tagCards` 20 times across five files (durability 7, marks 6, review 3, sliders 2, responsive-a11y 2).
   - The question: can D4's card helpers (`cardHeader`, `tradeCard`, `reachCard`, `reachPanel`, and those built on them) accept a Trade id, or a "symbol or Trade" reference? Then the D5R family would collapse into them.
   - The constraint: section 6.4's rules, and its migration rule (no `expect` changes matcher or value).
2. **`tradeCard`'s region name.** It matches "XYZ review" exactly, so it can't tell two open-card bodies apart. Only one card is open at a time, so it works today. Should the body's label, or the helper, change?
3. **Unit tests that pick a card by position:** `CardMarks.test.tsx:258, 276, 637-638`. Check `ReviewCards.test.tsx` and `ReviewCard.test.tsx` for the same pattern.
4. **App code.** `ReviewView.tsx` defines the Underlying lookup twice, plus `tradeLine`. A single `tradeName(tradeId)` built from the Review could serve the header, blockers, status, both messages and "also held by". `ReviewCard.tsx` writes `trade.underlying` in three places.
5. **Anything else that relies on load-time state or positional picks** to tell Trades apart, in `e2e/d4`, `e2e/d5` and `e2e/d5r`.

## 6. Facts to rely on

- **Branch state.** Branch `claude-opus-5.5`, local commits only. **Never push.**
  - When this handoff was written, HEAD was `5b11b397`, plus the commit that adds this file.
  - The working tree is clean apart from `.claude/settings.json`.
- **T5R.15 so far:**
  - `0af0c64`: the eleven B5R cases.
  - `ae7590a` (B1) and `3def717` (B1-B1): an opened card is scrolled into view; a focused Mark row stays in view.
  - `372436f`: plan revision 26.
  - `61b1828` (T5R.9-B5): "also held by" uses the summary line.
  - Every one of these has passed its ocr review. B2 is still open (see decision 6).
  - The last whole browser run passed 173 cases.
  - T5R.15's cumulative run hasn't been done yet.
- **Link parameters.** The Review already accepts `?trade=<id>`, `&instrument=<key>` and `&panel=<Marks|Reflections|Action>`. It acts on them on load and when they change (T5R.12-B1, B1-B1, B2).
- **Permissions.** `.claude/settings.json` is the user's file. It's untracked and allows `npm run build:releases`, `npm run build:faults` and `npm run test:e2e`. **Never stage it.**
- **Browser mutation checks.** These only take effect after `npm run build:releases`, because most browser cases serve `dist-releases/d5`.
- **Ports.** Only 5175 for servers. Browser kill cases use 9341 and 9342. The bench uses 5181.
- **suite-runner labels.** Pass the label without a trailing hyphen.

## 7. What the plan revision must contain

- **Decision row 68** in `plan/implementation-plan.md`, in the style of rows 64–67: what changed, why, what's affected, acceptance status, durable compatibility (none). Also a new head for the freeze record: "Revision 27…".
- **Amendments** in `plan/D05R-review-redesign.md`, each marked "**Amended by decision 68 (revision 27):**": A150, A162 if the slider rule changes, and whatever the user chooses from section 4.
- **New task rows** in the task graph, and matching verification rows. Name them as the user prefers; ask. Cover:
  - the `data-trade-id` hook;
  - the header summary line;
  - the slider placement;
  - whichever ambiguity fixes the user chooses;
  - the helper and test simplifications the subagents support, absorbing T5R.15-B2.

  Order the tasks so the app's hook lands before the tests that use it. Each task needs a verification that can be checked:
  - red/green unit cases for behaviour;
  - browser cases for layout (B4.13, B5R.11);
  - the migration rule for helper moves.
- **The T5R.15-B2 note** in `evidence/D05R/structural.md` (decision 6).
- **Updates to `plan/D05R-handoff.md`:** the next revision becomes r28 and the next decision 69; section 7's next step points to the first new task.
- **Commit and tag.** Commit with the message style `plan: revision 27, decision 68: …`, ending with `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`, then tag `claude-opus-5.5-plan-r27`.
- **Report to the user, then stop.** Summarize the decision, the amended rows and the tasks. Include the full candidate list from decision 5: where each came from, and whether it was planned or dropped, and why.

## 8. After the user approves

The implementing session resumes `plan/D05R-handoff.md`:

1. The new tasks, one at a time: a `tdd-task` subagent each, an ocr review of each commit, and bug tasks for its findings.
2. T5R.15's cumulative run through `suite-runner`, recorded.
3. **T5R.16**, the critic gate, with its pre-check.
4. The local tag `claude-opus-5.5-d5r`.
5. A rewrite of the D6 handoff's starting point, then the final report. Never push.
