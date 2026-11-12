# Bug tasks found outside a deliverable's gate

This file holds bugs the user finds by hand between deliverables. Each one is written so that a fresh `tdd-task` subagent can take it, failing test first, as a critic defect is handled (`.claude/docs/critic-brief.md`, "After each critic"). Each fix gets an `ocr-review` and a quick `suite-runner` run with the touched browser specs.

| ID | Title | Found | Severity | Status |
|---|---|---|---|---|
| BUG-1 | The exercise checkbox is drawn as a full-width text box | 2026-11-12, user, after the D7S tag | Low (cosmetic) | Open |
| BUG-2 | The option Plan's Expiration date is a plain text box: no date picker, US dates rejected, and a corrected date still shows the error | 2026-11-12, user, after the D7S tag | Moderate (misleads; the trader can finish only by guessing the format) | Open |

---

## BUG-1: the exercise checkbox is drawn as a full-width text box

**Found:** 2026-11-12. The user saw it while testing the production build of `claude-opus-5.5-d7s` (`795159cd`) on the option Plan form. Critic-2 had also noted it at the D7S checkpoint, minor observation 5 in `evidence/D07S/critic-2.md`: "the checkbox sits centred above its label rather than beside it".

**Introduced by:** D7 T7.19 (`551ca046`), the option Plan form's Exercise Intent checkbox.

**Where:** a long-option Plan form (Long Call or Long Put), section "Risk", at the bottom: "I plan to exercise this option if it is in the money".

**Observed** (user's screenshot, desktop width):
- The checkbox is a full-width rounded box about 44 px tall, with the tick drawn small in its centre.
- With focus, the 3 px focus outline traces that whole full-width box.
- The label text sits on its own line underneath, not beside the box.

**Expected:**
- A normal-sized checkbox, about 20 px, on the same line as its label text and before it.
- The whole label row is the click and tap target, at least 44 px tall, as `label.chip` keeps for radios (WCAG 2.5.5, as the app already does).
- The focus outline is drawn around the checkbox, or the row, not across the form's width.
- The same at 375 and 320 px, with the label text wrapping beside the box and no sideways scroll.

**Cause:**
- The `<input type="checkbox">` at `src/ui/screens/PlanForm.tsx:409` has no class, so it takes the global text-control rule at `src/ui/app.css:261`:
  - `input, select, textarea { display: block; width: 100%; min-height: 44px; padding; border; border-radius: 10px; margin-top }`.
  - `display: block` pushes the label text onto the next line.
- Its wrapping `<label>` takes `form label { display: block; font-weight: 600; … }` (`app.css:255`).
- The radio buttons avoid both rules through `label.chip` (`app.css:360`–`405`), which turns the label into an inline-flex row and resets its input.

**Fix (smallest):**
- Give the label a class, for example `label.check`. Style it as a flex row: aligned to the first line, a small gap, `min-height: 44px`, `cursor: pointer`.
- Reset its input inside that class: `display: inline-block`, `width` and `height` about 1.25rem, `min-height: 0`, `margin: 0`, `padding: 0`, no border or radius, so the native checkbox draws itself. `accent-color: var(--ink)` keeps it on the palette.
- The input keeps its native role, name and keyboard behaviour.
- `input:focus-within` (`app.css:39`) still draws its outline, now around the small box.

Don't restyle it as a `chip`. A chip is a choice among radios, and this is a single yes/no.

**Test first (browser, Chromium), failing before the fix.** Add one case to `e2e/d7/plan-open.spec.ts`, or the D7 spec that already plans a Long Call. Plan a Long Call to the Risk section, then check at 1280, 375 and 320 px, using `setWidth` and `expectNoSidewaysScroll` from `e2e/d7p/support.ts`:
- `getByRole('checkbox', { name: 'I plan to exercise this option if it is in the money' })` has a bounding box no wider than 32 px.
- Its vertical centre lies within the label text's first line box. That means it sits beside the text, not above it.
- The label's box is at least 44 px tall.
- There is no sideways page scroll.

Each assertion fails today on the width, as the screenshot shows.

**Keep passing:**
- Every existing case that checks or reads the box: `PlanForm.test.tsx`, `plan-issues.test.ts`, and the D7 browser specs that record `exerciseIntent`.
- axe on the form.
- The keyboard path: Tab to the box, then Space toggles it with a visible focus ring.

**Words:** none change. "I plan to exercise this option if it is in the money" is D7's approved text.

**Out of scope:** the payoff chart's SVG width at narrow viewports (critic-2, observation 6), and any other form control.

---

## BUG-2: the Expiration date has no date picker, rejects US dates, and keeps its error after a fix

**Found:** 2026-11-12, by the user, testing the production build of `claude-opus-5.5-d7s` (`795159cd`) on the option Plan form, section "Contract". The user entered "11/20/2026" and then "2026-11-20"; "neither is accepted", and they expected a date picker.

**Introduced by:** D7 T7.19 (`551ca046`), the option Plan form's contract fields.

**Reproduced by the main session** (production build on `localhost:5175`, real clock 2026-11-12, a scratch Chromium profile; Long Call NVDA, strike 150.00, 1 contract at 15.00, Stop NVDA 140.00, Target NVDA 200):
1. Expiration "2026-11-20" entered once and Confirm Plan: **accepted**. The Plan confirms and Trade Detail opens.
2. Expiration "11/20/2026" and Confirm Plan: **rejected**, with "Enter an expiration date in the years 2000 to 2099." beside the field. The message is misleading, because 2026 is in range.
3. Then the field cleared and "2026-11-20" typed: the field still shows the error and `aria-invalid="true"`, as if the new date were rejected too. Only a second Confirm Plan clears it, and that save **succeeds**. This is why "2026-11-20" looks refused.

**Cause:**
- The field is a plain text input. `{input('expiration', 'Expiration date')}` at `src/ui/screens/PlanForm.tsx:383` goes through the shared `input` helper (`:315`–`:319`), which sets no `type`. So there is no picker, and the text is passed through as typed (`:213`, `fields.expiration.trim()`).
- `validateOptionContract` (`src/domain/instrument/index.ts:97`) rightly accepts only an ISO `YYYY-MM-DD` date from 2000 to 2099, because the contract key stores the date. Any locale format fails as `InvalidExpiration`.
- `InvalidExpiration` is not among the issues the form clears on edit, so its error stays until the next submit. T7S.8's flagged clearing rules cover only W3 and the option-price `InvalidPrice`.

**Expected:**
- **A date picker:** `type="date"` on the Expiration field, the browser's native control. The form already uses a native `type="datetime-local"` for Plan time (`PlanForm.tsx:367`), so this follows the same pattern.
  - The browser shows the date in the trader's locale (11/20/2026 in the US) and always hands the form ISO `2026-11-20`, so locale formats can no longer be rejected.
  - Set `min="2000-01-01"` and `max="2099-12-31"` to match the contract key's range.
- **The error clears when the field changes:** an `InvalidExpiration` beside the field goes away once the field holds a valid date, as `InvalidPrice` does for an option price.
- **Message:** keep "Enter an expiration date in the years 2000 to 2099." It now only ever shows for an empty date or one outside that range, which is what it says. No new words.
- **No domain change:** `validateOptionContract` keeps accepting ISO dates only.

**Tests first, each failing before the fix:**
- **Unit, `src/ui/screens/PlanForm.test.tsx`:**
  - The Expiration field is a date input (`type="date"`, `min` 2000-01-01, `max` 2099-12-31).
  - After a Confirm Plan with an empty Expiration shows `InvalidExpiration`, changing the field to `2026-12-18` removes the error and `aria-invalid` before any new submit.
- **Browser, Chromium,** in the D7 spec that plans a Long Call (`e2e/d7/plan-open.spec.ts`):
  - Confirm Plan with the Expiration empty shows the error beside the field.
  - Then `fill('2026-11-20')`: the error is gone before resubmitting.
  - Then Confirm Plan opens Trade Detail, with the contract's expiration line reading "Expires Fri 20 Nov 2026" (D7 row 23.19).
  - Playwright's `fill` on a date input takes ISO text, so the existing helpers (`fillOptionPlan` in `e2e/d7/support.ts:55`, and the 4 `getByLabel('Expiration date')` uses) keep working unchanged.

**Keep passing:**
- Every D7, D7S and D7SP case that enters an expiration.
- axe on the form, and the 375 and 320 px layout (`e2e/d7p` helpers). The native date control must not cause sideways scroll.
- Keyboard entry: Tab into the field, type the date segments, and use the picker button.

**Note for other engines (pending RC, decision 19):**
- Every browser this app targets has a native date input with a picker: Chromium, Firefox and WebKit.
- iOS Safari opens a wheel picker.
- No date-picker library is needed.

**Out of scope:**
- The Plan time field.
- The Execution and Mark date fields. Check them while there, and report any that is a plain text date, rather than changing it.
