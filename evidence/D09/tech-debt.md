# D09 tech debt

Stage B's items, reviewed with the user after the gate (the user's rule, 2026-11-19: style-only ocr findings and low critic defects come here, not to tasks).

## Stage B

| # | Source | Kind | Item |
|---|---|---|---|
| 1 | The user, 2026-11-19 | Maintainability | Clear the 76 nested ternaries in 45 files that `eslint-suppressions.json` records (added by the D9A-R retrospective, so lint fails only on new ones): `src/ui/screens` 18, `src/modules/trade-record` 8, `tools/capacity/measure-page.ts` 7, the six `e2e/*/no-save.spec.ts` 1 each, `src/domain/trade-analysis` 6, `src/coordinators/workspace` 5, `src/ui/cockpit` 5, 21 more across 18 files. Rewrite each as if/else or a lookup and drop its entry. |
| 2 | ocr on T9.22 (`7291900a`), style only | Style | `src/domain/trade-analysis/replay-estimates.test.ts:22`: the test helper's `== null` could be an explicit null and undefined check (no `eqeqeq` rule in the lint configs). |
| 3 | Complete run `t9.24` | Flaky test | `e2e/d8/responsive-a11y.spec.ts:299` "B8.16 … should complete a Restore with the keyboard only, every focused control showing a focus ring" timed out waiting for the file chooser once in the full `browser-3` stage; passed alone and in a full rerun of the stage. Not on P138's known list. |
| 4 | critic-b1, defect 2 (low) | Words | The not-split sentence reads "The put's move is not split: a Mark is missing for Tue Nov 10." where W48 reads "… no implied volatility for Tue Nov 10." T9.25-B1 made the cause follow the reason, after ocr found every reason worded as a missing implied volatility; the new phrase is in `new-words.md` (T9.25-B1) for approval. Decide: keep the cause phrase (and approve it), or go back to W48's single wording. **Decided by the user, 2026-11-20:** shorten the sentence (T9.28-D2). |
| 5 | The user, 2026-11-20, from critic-b2's minor observation 1 | Readability | The implied volatility chip's small chart (`src/ui/cockpit/replay/chips.tsx`) has no scale, dates, values or "estimate" tag of its own: a bare dashed line stretched to fill its box, so BREN's drift from 32.0% to 29.5% looks as steep as CORV's rise from 39.9% to 53.0%. The values reach only a screen reader, through the hidden list. The prototype's pop-up (`prototypes/replay/round-2.html`, `ivChart`) has a heading with the tag, percent labels on an axis, a cursor and a caption. |

## Stage C

| # | Source | Kind | Item |
|---|---|---|---|
| 6 | ocr `52b83cb5` (T9.29), finding 3 | Style only | `MeterNow.pastBy` (`src/ui/cockpit/meter/meter.types.ts:20`) is optional, but the meter's name interpolates it for the PastStop and PastTarget zones; a union requiring `pastBy` for those zones would make the type say so. No valid reading omits it. |
| 7 | Complete run `t9.29` | Flaky test | `src/ui/screens/ReviewCards.test.tsx:671` "links (A161) > should open the first card holding XYZ in attention order on its Marks panel, with focus on XYZ row" failed once in the full unit stage (`expected false to be true` on the focus check of the "XYZ Mark, Mon Oct 12" region, 33 ms). Passed 3 of 3 alone and 3 of 3 with its file in the main session. Not on P138's known list; T9.29 touched no file it reads. Treated like item 3. If it fails again, it is a failure. **The user, 2026-11-20: fix it now, as T9.29-D1.** |
| 8 | critic-c1, minor observation 1 (low) | Words | The meter's name with no Mark runs the reason into the rails with no full stop: "Mark missing: NOMK, Fri Nov 13 Stop −$200.00, Target +$600.00. …", so a screen reader reads "Fri Nov 13 Stop −$200.00" together. W51: "the reason, then the rails". |
| 9 | critic-c1, minor observation 5 (low) | Readability | The meter's faint mark for the session before is barely visible when it falls inside a hatched part of the track (DALE at 13.82%, BREN at 86.29%). Its figure is still in the name. |
| 10 | critic-c1, minor observation 3 (earlier work, not stage C) | Layout | At 1280 px the Open list's table (1,303 px in a 928 px region) scrolls sideways and cuts off the P&L figure: a no-Mark row's text ("Mark missing: NOMK, Fri Nov 13 Thu Nov 12 close +$100.00 · +0.50R") does not wrap and makes the P&L column 544 px wide; without that row it is still 3 px over. In that wide column the meter sits far left of its figure. |
| 11 | critic-c1, minor observation 4 (earlier work, not stage C) | Words | The Open list's P&L cell says "Thu Nov 12 close +$100.00" where Trade Detail says "+$100.00 at the Thu Nov 12 Mark": a price called a "close". |
