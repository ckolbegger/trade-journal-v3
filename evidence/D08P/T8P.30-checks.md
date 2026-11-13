# T8P.30 absence checks prove absence (plan revision 90)

Scope: the unit tests under `src/ui/screens/trade-detail/` and `src/ui/cockpit/`, and every browser spec that reads Trade Detail. `TradeDetail.test.tsx` does not exist in this tree (the Detail's tests are the files under `src/ui/screens/trade-detail/`), and no other unit file renders a Trade Detail with an absence check (`PlanForm.test.tsx` renders it once, with none).

Titles: `.claude/scripts/it-titles.sh` before and after, `diff` empty (1635 lines each).

## What a role query sees

A Testing Library role query and a Playwright `getByRole` leave out what sits in a hidden panel. The cockpit keeps every drawer mounted and hides the unselected ones (T8P.5-B1), so a role query without `hidden: true` / `includeHidden: true` proves only "not shown". A text query (`queryByText`), a DOM query (`querySelector`) and a Playwright `getByText` or CSS locator see hidden content, so they already prove gone. One more fact found while mutating: dom-accessibility-api gives an element that itself carries `hidden` an empty accessible name, so a named query finds a thing inside a hidden panel but not a named element that is itself `hidden`. Ghost elements in the mutations are therefore children of a hidden container, as a real drawer's content is.

## Grep (run in the lane at base 479923c3)

Unit scope (30 files):

- `queryBy*(` / `queryAllBy*(`: 104 lines; `queryBy*Role` / `queryAllByRole`: 50 of them.
- All patterns (`queryBy*`, `queryAllBy*`, `not.toBeInTheDocument`, `toBeNull()`, `toHaveLength(0)`, `toBeFalsy`, `not.toBe(`): 140 lines in 23 files; 44 of them are absence or hidden checks that needed a change (below). The rest are `querySelector` / `queryByText` / presence (`not.toBeNull`) / value checks, listed by line under "Already proving".
- `not.toBeVisible`, `toBeHidden`, `not.toContainText` in unit tests: 0 hits (Playwright only).

Browser scope (52 specs that mention Detail, plus `e2e/support/detail/*.ts` and the `support.ts` files): `toHaveCount(0)` 96, `not.toContainText` 11, `toBeHidden` 1, `not.toBeVisible` 0, `toHaveLength(0)` 6 (workspace data, not DOM). 114 matching lines in all with the `.not.toBe`, `not.toHaveAttribute` and `not.toHaveClass` forms. 35 of them are gone checks on Trade Detail content and changed; the rest are listed under "Not Trade Detail" or "Already proving".

## Helper change (e2e/support/detail)

`scope.ts` gains `anywhere(build)` and `roleOf(scope, role, options)`. While `anywhere` builds a locator, every role query the Detail helpers make adds `includeHidden`, so a gone check looks inside hidden panels. `regionOf`, `recordEntryLink`, `recordExitLink`, `resultHeading`, `lotMatchesHeading`, `settlementDueHeading`, `recordExpirationLink`, `closeReviewOwed`, `reflectNowButton`, `declineButton`, `answerButton`, `debtForm`, `savedReflection` and `owedItem` use `roleOf`. A presence read, built outside `anywhere`, is unchanged. `detail.anywhere` is exported from `index.ts`.

## Unit checks changed (gone, 42) and hidden (1 block of 2 queries)

Every gone check gained `hidden: true` on its role query. Mutation key: the temporary ghost is an element rendered inside a `<div hidden>` in the component the test renders; each run is the file or files named, and the failure is the check's own assertion (`expected <...> to be null`). All product edits were reverted (`git checkout --`), and `git diff --name-only` shows no product file.

| File:line | Kind | Changed | Mutation (temporary, reverted) | Failure |
| --- | --- | --- | --- | --- |
| cockpit/drawers/payoff.test.tsx:42 | gone | yes | `cockpit/drawers/payoff.tsx`: render `<section aria-label="Current Expiration Payoff">` in a hidden div when there is no current line | `payoff.test.tsx:42` expected section to be null |
| payoff.test.tsx:51 | gone | yes | same file: hidden `<svg role="img">` in the stock-note branch | `:51` expected svg to be null |
| payoff.test.tsx:52 | gone | yes | same: hidden `<table>` in the stock-note branch (svg ghost removed) | `:52` expected table to be null |
| cockpit/drawers/plan-risk.test.tsx:29 | gone | yes | `plan-risk.tsx`: hidden `<section aria-label="Summary">` | `:29` expected section to be null |
| cockpit/drawers/price-history.props.test.tsx:121 | gone | yes | `price-history.tsx`: hidden link when no session lacks a Mark | `:121` expected link to be null |
| cockpit/drawers/today.props.test.ts:142 | gone | yes | `today.tsx`: hidden `<table>` | `:142` expected table to be null |
| today.props.test.ts:143 | gone | yes | same: hidden `At the … Marks` region (table ghost removed) | `:143` |
| today.props.test.ts:161 | gone | yes | same: hidden `At Mon Oct 12 close` region | `:161` |
| today.props.test.ts:195 | gone | yes | `track.tsx`: hidden `<ul>` when the track has no condition lines | `:195` expected ul to be null |
| cockpit/journal-cards.props.test.tsx:90 | gone | yes | `journal-cards.tsx`: hidden `<ul><li>` on a card with no items | `:90` expected li to be null |
| journal-cards.props.test.tsx:284 | gone | yes | `screens/OwedDebtItem.tsx`: hidden `<form aria-label="Reflection">` while no definition is loaded | `:284` expected form to be null |
| cockpit/rail/conditions.props.test.ts:157-158 | gone | yes | `conditions.tsx`: hidden `Worst case and Max reward` list when there are no summary lines | `:175` (the `notes()` helper now returns `['MUT']`) |
| cockpit/rail/identity.props.test.tsx:88 | gone | yes | `identity-card.tsx`: hidden Record entry and Record exit links | `:91` links list not empty |
| cockpit/track.test.tsx:30 | gone | yes | `track.tsx`: hidden `<ul>` | `:30` expected ul to be null |
| screens/trade-detail/Banner.test.tsx:20 | gone | yes | `Cockpit.tsx`: ghost hidden div holding regions named for every checked name | `:20` expected section to be null |
| Banner.test.tsx:96 | gone | yes | same | `:96` |
| Banner.test.tsx:131 | gone | yes | same (`Position Change Reflection`) | `:131` |
| Banner.test.tsx:133 | gone | yes | same, without that ghost (derived names: Plan Baseline, Position, Entry Quality, Planned-Leg Fulfillment, Deviations) | `:133` |
| screens/trade-detail/Identity.test.tsx:18 | gone | yes | `screens/TradeDetail.tsx`: hidden Retry button in the NotFound state | `:18` expected button to be null |
| Identity.test.tsx:42 | gone | yes | `Cockpit.tsx` ghost: hidden Record entry link | `:42` |
| Identity.test.tsx:54 | gone | yes | same | `:54` |
| Journal.test.tsx:195 | gone | yes | `screens/trade-detail/Journal.tsx`: hidden button in the Journal section | `:195` expected button to be null |
| Journal.test.tsx:355 | gone | yes | same | `:355` |
| Journal.test.tsx:382 | gone | yes | `OwedDebtItem.tsx` hidden form | `:382` expected form to be null |
| Journal.test.tsx:412 | gone | yes | same | `:412` |
| Payoff.test.tsx:128 | gone | yes | `payoff.tsx`: hidden `<svg role="img">` | `:128` |
| Payoff.test.tsx:129 | gone | yes | `Cockpit.tsx` ghost: hidden `Planned Expiration Payoff` region | `:129` |
| Position.test.tsx:52 | gone | yes | `Cockpit.tsx` ghost: hidden `Position Changes` region | `:52` |
| Position.test.tsx:86 | gone | yes | ghost: hidden `Plan Reflection` region | `:86` |
| Position.test.tsx:123 | gone | yes | ghost: hidden `<table aria-label="Executions">` | `:123` |
| Position.test.tsx:124 | gone | yes | ghost: hidden `<h3>Position Change at …` | `:124` |
| Position.test.tsx:125 | gone | yes | ghost: hidden `Position Changes` region only | `:125` |
| Position.test.tsx:279 | gone | yes | `identity-card.tsx`: hidden Record exit link | `:279` |
| Position.test.tsx:285 | gone | yes | `Cockpit.tsx` ghost: hidden Record exit link on a Planned Detail only | `:285` |
| Result.test.tsx:51 | gone | yes | ghost: hidden `Valuation`, `Risk and reward`, `Position` regions | `:51` |
| Result.test.tsx:53 | gone | yes | ghost: hidden Record entry link on a Closed Detail only | `:53` |
| Result.test.tsx:54 | gone | yes | `identity-card.tsx` hidden Record exit link | `:54` |
| SettlementDue.test.tsx:33 | gone | yes | `cockpit/rail/needs-you.tsx`: hidden Record expiration link when the panel has none | `:33` |
| SettlementDue.test.tsx:42 | gone | yes | same | `:42` |
| Summary.test.tsx:96 | gone | yes | ghost: hidden `Summary` region | `:96` |
| Valuation.test.tsx:118 | gone | yes | `screens/trade-detail/Valuation.tsx`: hidden link in the Valuation section | `:118` |
| Cockpit.test.tsx:38-47 (was 41-42) | **hidden** | yes | `Cockpit.tsx`: `hidden={name !== current}` replaced by `hidden={false}` | `:43` `expect(position.hidden).toBe(true)` received false |

The Cockpit hidden check now asserts the Position panel is mounted and has `hidden`, that its Open Lots and Position regions are present in it (`hidden: true` queries), and that a plain role query still does not see them. Its comment is corrected: unselected drawers are mounted and hidden (T8P.5-B1). The two plain-query lines after the `hidden` assertion are not reached by that mutation, because the `hidden` assertion fails first; they assert the same property.

The orphan `screens/trade-detail/SettlementDue.tsx` and `Identity.tsx` render nothing in the cockpit; the first mutation attempt against them left their tests green, which is how the real sites (`needs-you.tsx`, `identity-card.tsx`) were found. T8P.27 removes those two files.

## Browser checks changed (gone, 35)

Each is wrapped in `detail.anywhere(...)` (or has `includeHidden: true` on a page-wide role query). The mutation is one ghost block of hidden elements in `Cockpit.tsx`, reduced round by round so each check is the first to fail: `evidence/D08P/browser/T8P.30-mutation-specs.txt` (all ghosts) and `T8P.30-mutation-r2.txt` to `-r7.txt`. Build for each: `npm run build:faults && npm run build:releases`; run: `with-browser-lock.sh npx playwright test <specs>`.

| File:line | Check | Failure (first line of the failing statement) |
| --- | --- | --- |
| e2e/d2/after-save.spec.ts:10 | no Record entry heading | round 1, `after-save.spec.ts:10` toHaveCount |
| after-save.spec.ts:11 | no Save entry button | round 2, `:11` |
| e2e/d2/integrity.spec.ts:114 | no Record entry link | round 1, `:114` |
| e2e/d2/runtime-failure.spec.ts:41 | no Record entry link | round 1, `:41` |
| runtime-failure.spec.ts:64 | no "Record entry isn't available" heading | round 1, `:64` |
| e2e/d4/expected-mark.spec.ts:36 | no Mark figure in the Valuation | round 1, `:36` |
| e2e/d5/detail-debt.spec.ts:27 | no "Reflection owed" | round 2, `:27` |
| detail-debt.spec.ts:28 | no due note | round 3, `:28` |
| e2e/d5/faults.spec.ts:47 | no Reflect now (Needs you) | round 1, `:47` |
| faults.spec.ts:48 | no Reflect now (Journal panel) | round 2, `:48` |
| faults.spec.ts:49 | no Decline | round 3, `:49` |
| faults.spec.ts:50 | no Reflection form | round 4, `:50` |
| faults.spec.ts:51 | no Answer | round 5, `:51` |
| e2e/d5/kill-offline.spec.ts:83 | no "Reflection owed" | round 2, `:83` |
| e2e/d5/review-debt.spec.ts:102 | no "Reflection owed" | round 1, `:102` |
| e2e/d5/support.ts:59 (`expectSavedReflection`) | no Reflection form on Detail | round 1, `support.ts:59` |
| e2e/d6/exit-requirements.spec.ts:94 | no Lot Matches heading | round 1, `:94` |
| e2e/d6/exit.spec.ts:38 | no Result heading | round 1, `:38` |
| exit.spec.ts:39 | no Close Reason value | round 2, `:39` |
| e2e/d6/kill.spec.ts:48 | no "Reflection owed" | round 1, `:48` |
| kill.spec.ts:49 | no Close Review owed heading | round 4b, `:49` |
| e2e/d6/runtime-failure.spec.ts:53 | no Reflect now (Needs you) | round 1, `:53` |
| runtime-failure.spec.ts:54 | no Reflect now (Journal panel) | round 2, `:54` |
| runtime-failure.spec.ts:55 | no Decline | round 3, `:55` |
| runtime-failure.spec.ts:56 | no Record exit (Closed Detail) | round 5, `:56` |
| runtime-failure.spec.ts:68 | no Record exit (Open Detail) | round 6, `:68` |
| runtime-failure.spec.ts:69 | no Record entry (Open Detail) | round 7, `:69` |
| e2e/d7/kill.spec.ts:35 | no "Reflection owed" | round 1, `:35` |
| d7/kill.spec.ts:36 | no Close Review owed heading | round 4b, `:36` |
| e2e/d7/responsive-a11y.spec.ts:75 | no Settlement Due heading | round 2, `:75` |
| e2e/d7/runtime-failure.spec.ts:34 | no Record expiration link | round 1, `:34` |
| d7/runtime-failure.spec.ts:34 | no Record entry link | round 7, `:35` (the loop line) |
| d7/runtime-failure.spec.ts:34 | no Record exit link | round 6, `:35` |
| e2e/d7/settlement-due.spec.ts:61 | no Settlement Due heading | round 1, `:61` |
| e2e/d7/support.ts:172 | no payoff region for an inapplicable line | round 1, `support.ts:172` |

## Already proving (listed, unchanged)

- Unit, `querySelector` / `queryByText` / presence / value lines (DOM or text queries see hidden content, or the line is a presence check): payoff.test 23, 38, 39, 65; plan-risk.test 10; position.props.test 42; price-history.props 68, 103; today.props 151, 214, 225 (already `hidden: true`), 238; journal-cards.props 116, 163, 169, 179, 189, 190 (already `hidden: true`), 213, 241, 243; conditions.props 36, 53, 74, 94 to 97, 121, 197; identity.props 71, 72, 83; needs-you.props 34 (presence helper, left without `hidden` so a presence read stays strict), 42, 51, 65, 71, 84, 90, 98, 103 (already `hidden: true`), 118, 124, 131; pnl.props 65, 66, 84, 85, 119, 127, 136, 143; Cockpit.test 164 (already `hidden: true`), 169, 187 to 199, 225; Footer.test 59, 66; Journal.test 56, 63, 110, 141, 217, 220, 329, 330, 345, 346, 482, 549, 551; Payoff.test 94; Plan.test 52; Position.test 122, 153, 163, 197, 200, 210, 308; Result.test 52, 66; RiskReward.test 91; SettlementDue.test 25; Summary.test 33, 61, 73, 79, 80, 90, 152; Today.test 21; Valuation.test 28, 103, 107, 119.
- Browser, text of a visible region: d4/expected-mark.spec.ts:47, 48 (`valuation` not.toContainText).
- The `journalReflectNowButton` helper already passed `includeHidden`; its two call sites (faults.spec.ts:48, d6/runtime-failure.spec.ts:54) are in the changed list only for the `anywhere` wrapper that keeps the call uniform; the mutation round that ghosts `#drawer-panel-journal` made both fail.

## Not Trade Detail (left unchanged)

Review, forms, list pages, nav and the app shell, so no hidden drawer applies: d1/recovery-only 22, 29; d2/integrity 81, 119; d2/no-save 135; d2/offline 30; d2/ui-alignment 148, 149, 175, 298, 1428; d4/responsive-a11y 157; d4/runtime-failure 33 to 50; d5/detail-debt 42 to 45; d5/faults 37 to 41; d5/kill-offline 37, 38, 65, 80; d5/review-debt 29, 64; d5/support 55; d5r/sliders 76 to 91; d6/close-review 75; d6/exit-action 21 to 24, 41; d6/exit-requirements 24; d6/exit 23, 46; d6/offline 22, 49 (and 56, a presence check); d6/responsive-a11y 80, 152; d6/runtime-failure 106; d7/offline 21, 32; d7/plan-open 71, 72; d7/runtime-failure 37, 38, 45, 46, 82; d7/short-put 37; d7/support 148.

## Hidden checks in the browser suites

None found: no Playwright spec asserts a Trade Detail element is mounted and hidden (`toBeHidden` appears once, in `d5/support.ts:55`, on a Review card's form).

## Totals

Gone 77 changed (42 unit, 35 browser); hidden 1 (Cockpit, two queries and one `hidden` assertion); already proving: the listed lines above. No stop: every gone check still passes once it looks inside hidden panels, so no thing is rendered where it should not be.
