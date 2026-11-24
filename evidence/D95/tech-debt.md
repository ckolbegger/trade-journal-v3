# D9.5 tech debt

Style-only ocr findings and low critic defects (the user's rule, 2026-11-19). Reviewed with the user after the final gate.

| Source | Kind | Item |
|---|---|---|
| ocr T95.3 (`2f9575d9`) | test coverage | `src/coordinators/daily-review/order.test.ts:60`: the "at its Target" case marks 56.50 against a 56.00 Target; no case checks a Mark exactly at the Target. |
| ocr T95.6 (`c0c8c27a`) | style | `tests/integration/d5r/support.ts:70`: `saveMarksFrom` keeps an unused `tradeId` parameter that its callers still pass. |
| run `t95.3-t95.5` | tooling | browser-2 (9.4 min) and browser-4 (13.7 min) passed the 8-minute mark the runner flags; add a browser-5 stage (partly load from the overlap trial). |
| runs `t95.3-t95.5`, `t95.6-t95.7` | flaky test | `tools/estimate-rules.test.ts:122` "should pass every file of the current tree" times out at 5 s under load (both runs, each beside a task); passes alone. |
| the user, 2026-11-22 | test tooling | About 25 post-save heading waits in e2e support helpers (Exit, Expiration, Restore recorded; `READY`, 20 s) would burn 20 s on a refused save; candidates for T95.7-F2's `savedUnlessRefused`. |

- T95.17 ocr (style): `src/ui/screens/ReviewCard.tsx` 332 and 334 use `atEntry != null`; the codebase uses strict checks.

- Critic-1 (T95.26), low: the "0 means it closed with no value" hint shows under a stocks-only grid that refuses $0.00.
- Critic-1, low: an "At entry" block repeats near-identical Risk and Reward beside the Plan box and drawing on a card whose Mark is missing or unavailable.
- Critic-1, low: at 1280, "Reward to risk Mark missing: … · Plan 2.40 to 1" wraps, leaving "1" alone.
- Critic-1, low: at 375 with two slip questions open, "Discard 2" and "Marks to check first." split across lines.

- Critic-2 (T95.26), low: at 320, "Reward to risk 2.30 to 1 · Plan" wraps, leaving "0.29 to 1" on the next line.
- Critic-2, low: at 320 the drawing's "Stop −$740.00" and "Target +$160.00" labels touch, with no gap.
- Critic-2, moderate, moved to tech debt by the user (2026-11-23): a card whose option Mark is acknowledged unavailable (DALE's Put, Tue Nov 17) does not say so; its Now box shows the session before's Marks under "At the Mon Nov 16 Marks", and today's DALE Mark is not shown. The day card and Trade Detail do disclose it.

Critic-2's minor observations (added at the user's request, 2026-11-23; two others, the "0 means…" hint and the "At entry" block, are already listed above):
- No day total with an unavailable Mark: "Day so far" and the finished day's "The day" row are left out with no explanation.
- A reload shows the grid open: reopening a Review whose Marks are all saved shows the grid open with "Save Marks (0)", not folded with "Edit".
- Enter doesn't confirm a reason: after typing a "Why no price" reason, Enter neither confirms "No price" nor moves on; "No price / Cancel" stay shown.
- Old wording: the day card's hidden reasons and the Open list's rows still say "Stop breached" and "Target reached", while the Review's labels say "Past Stop" and "At Target".
- On the standard Review, "No Review for Mon Nov 2 … Mon Nov 16. Their Marks are optional." shows although those Marks exist.
- The drawing's name with an unavailable Mark reads "Acknowledged unavailable: XYZ, Mon Oct 12 Stop −$270.00, …", with no full stop before "Stop".
- The Plan box's Entry reads "short 6 contracts at $0.94" (DALE), with a lower-case "short".
- Focus after the last Hold falls to the page body (focus after each save is Part C's T95.61; check it there).

- Critic-3 (T95.26), moderate, moved to tech debt by the user (2026-11-24, answer (a)): on a partly sold Trade the shared meter (the drawing's name and marker, the collapsed card's meter, the Open list's meter) says "86% of the way to the Stop" (money lost so far ÷ money lost at the Stop, realized included: $640 ÷ $740 for AXIO on Tue Nov 17), while the label and line say 67% (the spec's Pressure share, price-based). Decide once what the shared meter means everywhere (its figure or its words); the plan's S12 kept the shared meter unedited in D9.5.
- T95.27 ocr (style, Doubtful): `src/modules/journal/records.ts:4` `PromptRole` is shared with SingleSelect prompts, so a typed manifest could put PlanDepartureReason or ExpirationReason on a SingleSelect that restore would refuse; type-level only.
- T95.31-F1 ocr (tooling): `.claude/ocr-rule.json` doesn't include `tests/fixtures/**/expected-views.json`, so a commit changing only fixture views is skipped with 0 files; the reviewer added the pattern in a scratch copy.
- T95.36-B4 (pre-existing, outside the sale): `confirmPlan` (`src/coordinators/trade-workflows/trade-workflows.ts:71`) checks its economicTime against now with `Date.parse`; an annotated instant (`…Z[UTC]`) gives NaN, so the future-time check never fires on that path.
- T95.45 (agent note, low): the Action form's `focus` handle (`ActionForm.tsx`) uses `querySelector('input:checked, input, textarea')`, which returns the first radio, so "Back to ABC" puts focus in the form but not on the chosen Action.
