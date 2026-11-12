# Bug tasks found outside a deliverable's gate

This file holds bugs the user finds by hand between deliverables. Each one is written so that a fresh `tdd-task` subagent can take it, failing test first, as a critic defect is handled (`.claude/docs/critic-brief.md`, "After each critic"). Each fix gets an `ocr-review` and a quick `suite-runner` run with the touched browser specs.

| ID | Title | Found | Severity | Status |
|---|---|---|---|---|
| BUG-1 | The exercise checkbox is drawn as a full-width text box | 2026-11-12, user, after the D7S tag | Low (cosmetic) | Open |

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
