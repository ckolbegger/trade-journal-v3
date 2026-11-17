# T8R.27-B2 tdd-log

Rows are written by hand (a Playwright spec, not a single vitest case). Each mutation was planted with `page.evaluate` inside `expectNamed` (screens that show the contract), in a copy of the B1 spec and in the new spec, then removed. Command: `B2_MUTATE=<a|b> .claude/scripts/with-browser-lock.sh npx playwright test <spec>`.

| Task | Case | Result | Detail |
|---|---|---|---|
| T8R.27-B2 | (a) `<button aria-label="Open"><span>XYZ Dec 18 $55 Call</span></button>`, B1 spec | red (old passes) | `1 passed (2.4s)`: the span has no quoted name in the snapshot and the button's label has no XYZ, so nothing was compared. |
| T8R.27-B2 | (a), new spec | red | `1 failed`. First line: `Error: Detail: the accessible name "Open" against the visible "XYZ Dec 18 $55 Call"`. |
| T8R.27-B2 | (b) hidden `<section aria-labelledby>` whose target text is "XYZ 2026-12-18 55 Call", B1 spec | red (old passes) | `1 passed (2.6s)`: ariaSnapshot leaves out hidden elements and the attribute scan skips aria-labelledby. |
| T8R.27-B2 | (b), new spec | red | `1 failed`. First line: `Error: Detail: the accessible name "XYZ 2026-12-18 55 Call"` (`Expected: true`, `Received: false`). |
| T8R.27-B2 | no mutation, new spec | green | `.claude/scripts/with-browser-lock.sh npx playwright test e2e/d8r/names.spec.ts`: `1 passed (2.6s)`; then `e2e/d8r` as a whole (see structural.md). |

Change: the per-element tagging step (data-b8r5 attributes, one `ariaSnapshot` per tagged element) is replaced by one in-page pass over every element in the body. An element's name is the text of its aria-labelledby targets (read hidden or not), else aria-label, alt or title, else, for buttons, links, summaries, headings and the matching roles, its content. The name must carry the W28 contract wherever its content (or a labelled-by target) names one. With no tags, repeated `expectNamed` calls cannot collide, so the "clear earlier tags" step has nothing left to clear. The B1 Review card position-label form is kept.
