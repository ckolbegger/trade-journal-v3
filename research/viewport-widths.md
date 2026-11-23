# Viewport widths in the browser tests: why 375 and 320 (and 390)?

Method note. Counts below come from grep and a rough split of each spec into test cases (a case is counted at a width if its body names that width; a loop over widths counts once). Treat them as approximate. Nothing was run.

## Short answer

Confirmed: the browser specs use 1280, 375 and 320 px, and also 390 px (more than 375). No spec or acceptance contract fixes any narrow width. The UI contract says "Exact breakpoint and sizing are implementation choices" and "A narrow desktop window uses the same narrow arrangement as a phone." The pair "375 and 320" comes from our own working rules: the critic brief (`.claude/docs/critic-brief.md`, since 2026-10-24) says "check the narrow layout (375 px and 320 px)", and the first test written for it (T2.24, `e2e/d2/narrow.spec.ts`) copied that pair. In the CSS, 375 and 320 fall on the same side of every breakpoint (480, 460 in code, 640, 860, 959/960), so they render the same layout, only narrower. For overflow and wrapping checks, 320 is the stricter case and 375 adds almost nothing. The cases where 375 could matter are the few that are not monotonic (chart label placement), and the D9.5 plan, which names 375 as the agreed phone prototype width.

## Widths in use

| Width | Where it is required | Spec files (approx. cases) | What it pins |
|---|---|---|---|
| 1280 | Plan decision: "1280 and 375/320"; D9 handoff; D9.5 ("every UI task is proven at 1280 and at a real 375-wide viewport") | about 20 files, 43 `width:` literals plus loops | The wide layout (sidebar, two columns). Above the 960 switch. |
| 960 and 959 | Layout switch: UI contract leaves the breakpoint open; the plan fixed it at 960 (D1 breakdown B1.15: "Layout switches at 960 px") | d1, d4, d5, d6, d7 responsive specs (13 literals) | Both sides of the sidebar / bottom-bar switch (AC-UI-001). |
| 390 | D1 B1.15 ("resize to 390 px and back"); D2 screenshot comparison ("at 390 and 1280"); D2 checks "at 320, 390 and 1280" | d1, d2, d4, d5, d6, d7, d7s no-save and responsive specs; d2/ui-alignment (about 30 cases), d2/cockpit-layout; 36 `width:` literals | The ordinary phone. Mostly the resize round trip (unsaved fields survive 1280 to 390 and back, AC-UI-001) and D2 alignment checks. |
| 375 | Critic brief (2026-10-24); D2 narrow.spec; D7P ("layout spec at 320 and 375"); D8P B8P.5 ("every drawer at 1280, 375 and 320 px"); D9, D9AR, D9R ("1280, 375 and 320"); D9.5 ("the mockup is the agreed look at desktop and at 375 wide") | about 36 cases paired with 320 (d2/narrow, d4, d5r, d6, d7, d7p, d8, d8p, d8r, d9, d9ar), plus about 13 cases at 375 alone | A "phone" width. Paired cases check no sideways scroll, tables scroll inside their box, figures stay whole. 375-only cases are touch, nav at the foot, one card a page, one column of Trade lines. |
| 320 | Same sources, plus D2 ("at 320, 390 and 1280"), D8 P106 ("every link inside 390 and 320 px"), D9 requirement C14 (667 px high "at 375 and 320 wide") | the same pairs, plus about 14 cases at 320 alone (d2/ui-alignment 4 plus 17 with 390, d7/payoff-chart-layout 2, d9 and d9ar responsive 3, d8, d8r, d7sp, helpers) | The smallest supported width (the narrowest screen, WCAG 1.4.10 reflow is defined at 320 CSS px). Anything that fits here fits at 375. |
| 340 | D2 only | d2/ui-alignment (2 cases) | Receipt heading alignment at an in-between width. |
| 700, 760, 860 | Not traced | a few cases | 860 is the replay overlay's own CSS breakpoint; 700 and 760 were not investigated. |
| 1440, 1920 | D9AR | d9ar/readout, cards, responsive | Very wide desktop for the replay. |
| Unit tests (jsdom) | n/a | `src/ui/AppShell.test.tsx` sets `window.innerWidth` to 390, 959, 960, 1024, 1280 | Layout switch only. No 375 or 320 in unit tests. |

CSS breakpoints (src/ui): 480 (replay-frame, replay-readout), 640 and 39.99rem container queries, 860/861 (replay overlay, shell), 959.98/960 (shell, Today, Position), 1200 (payoff). In code, `replay/geometry.ts` switches the chart to the phone drawing under 460 px. Nothing sits between 320 and 390. `app.css:545` sizes a scroll region "288 px: the scroll region at 320", a comment that shows 320 is the design target.

## What each narrow width pins, per case

Pairs, 375 and 320 together (the 36 or so cases). They assert the same thing at both widths: no sideways page scroll, wide tables scroll inside their own box, figures and signed amounts stay on one line, nothing is clipped, axe passes, touch targets at least 44 px.
- d2/narrow.spec (T2.24, the first pair): Open list and Trade Detail tables inside scroll containers. Origin was a real bug: the page scrolled sideways at 375 and 320 (scrollWidth 890 and 596).
- d7p/layout.spec: worded reasons and badges fully shown, all four cases at both widths.
- d8p/today-narrow, lot-matches-fit, payoff-fit, responsive-a11y: Marks table columns in the box, tables scrolling inside the box, every drawer fitting.
- d9/gaps, d9ar/readout, cards, sweep: a signed amount stays on one line (the minus sign must not wrap).
- d9, d9ar responsive-a11y, estimates-a11y, meter-a11y: fits one screen (667 px high), no sideways scroll, axe.

375 only (about 13 cases). These are not about being narrow. They use 375 as "the phone":
- d9ar/responsive-a11y (4): touch checks, nav along the foot after Close, the Close button size.
- d9/session-cards: "A phone's width holds one card a page" (one visible card).
- d9/meter-a11y (2): what each meter shows in shape and words.
- d4/responsive-a11y: Review Trade lines in one column.
- d5/detail-debt: form scrolls into view with focus at 375 and 1280.
- d95/marks-step: Marks step stacks rows at 375, the D9.5 prototype width.
- d9ar/crossing-position: 860 and 375 (860 is the real breakpoint, 375 is the phone).

320 only (about 14 cases). These are the tight-fit cases:
- d7/payoff-chart-layout: "chart text 10 px or more at 320" (text scales with the SVG, so 320 is the worst case) and "a negative payoff amount on one line at 320".
- d9/responsive-a11y: "Review card replay at 320 px". At 320 the readout reached x = 328 ("+$478.00"); this was a real defect (T9.18-F2) that 375 did not show.
- d9ar/responsive-a11y: the 320 by 667 header, headline and charts fit one screen (the tightest height fit: 588.9 px of budget); the slider value uncovered; the hover-band tap check.
- d2/ui-alignment: header "UNDERL / YING" breaking, Detail rows, bottom bar links (with 390).

390 (D1 to D7 era, about 25 cases alone, 17 more with 320). Mostly resize round trips and the D2 alignment pass. It is a leftover from the first screenshots (390 and 1280) and was never replaced when 375 and 320 became the critic's pair.

Non-monotonic cases, where a wider screen can fail and a narrower one pass:
- d7/payoff-chart-layout "no two chart text labels over each other at 1280, 375 and 320": label collision depends on how the SVG scales, so a pass at 320 does not prove a pass at 375.
- d9ar/label-sweep (a report only, at 1280 and 320, launched at 375).
- 44 px touch target cases: wrapping at 320 can only make the target taller, so 320 is safe, but only if the test measures height.

No defect in the history was found that failed at 375 and passed at 320. I looked for one in git messages and in the case comments, not exhaustively. The defects named in the comments are 320 failures.

## Recommendation

1. Run the narrow overflow, wrapping and fit checks at 320 only. A page that does not scroll at 320 with 16 px gutters, with a table scrolling inside its box, does not scroll at 375 either, since both are under every breakpoint. That covers most of the 36 paired cases (d2/narrow, d7p, d8p, d8r, d8, d9 gaps and readout, d6, d7 plan-open, d5r). Dropping the 375 half would lose almost nothing and would save about one run of each of those cases.
2. Keep 375 for a small set where "the phone" is the point, not "narrowest": the D9.5 phone cases (the plan names a 375 prototype, T95.25, T95.45 and T95.66 say "at desktop and 375 wide", and the D9.5 breakdown says every spec runs "at 1280 and at 375 wide through one helper in `e2e/d95/support.ts`"), touch and nav-at-the-foot cases (d9ar), one-card-a-page (d9/session-cards), and the one-column Review list (d4).
3. Keep one 375 case for non-monotonic checks: the payoff chart label overlap test (d7), unless the chart's label placement is made width-independent.
4. Move the 390 cases to 375 or 320 when next touched. They exist for the resize round trip (AC-UI-001), which needs "any narrow width", so 320 would do. Keep 959 and 960: they test the real breakpoint.
5. Guard against height: the 667 px height at 320 and 375 is fixed by D9 requirement C14 ("800 px at 1280 wide, 667 px at 375 and 320 wide"), so it is a height rule, not a width one.

What would be lost by running 320 only: the 375 half of the D9 and D9AR "fits one screen" checks (the phone's more common height case), and a width where chart label layout differs. Nothing in the acceptance contract needs it.

## What a change would require

- No spec fixes a width, so no spec change. UI contract: "Exact breakpoint and sizing are implementation choices." AC-UI-001 asks for "boundary widths" around the implementation's disclosed breakpoint (960), and AC-UI-002 for "supported zoom/widths".
- The plan does name widths. Changing them would need a plan revision, recorded as a decision: the critic brief line (a tooling doc), D8P B8P.5 and C8P.5, D8R B8R.7 and C8R.6, D9 B9.5, B9.7, B9.11, C9.4 and C9.9, D9A-R B9AR.7 and C9AR.7, D9 handoff ("price and P&L are on screen together at 1280, 375 and 320 px"), and D9.5 (decision 124, "Phone is in D9.5", U1, the 375 prototype). The D9.5 and D9 phone statements are the user's own decisions, so they stay unless the user changes them.
- A lighter option: keep the plan text, and change only the helper defaults (a shared `WIDTHS` for the pair, as in `e2e/d8p`, `e2e/d2/narrow.spec.ts`) to a single width, and note it as a test-tier rule. The critic brief can keep both widths, since a critic looks by eye.
