# UI conformance — migrating to the Claude Design prototype

_Planned 2026-08-24. Not yet scheduled: this document is the breakdown, not a commitment to a slice number. See [Open questions](#open-questions)._

## Why

The UI was built to [ui-style.md](../design/ui-style.md): a centered `max-w-3xl` document column, a white header bar with four nav links, a slate/indigo palette. It is consistent and fully tested — 588 unit/integration tests and 34 Playwright specs pass against it.

A Claude Design prototype ("TradeCoach") was then captured to [docs/design/prototype/](../design/prototype/) — 24 screenshots across 12 screens. It proposes a different visual language (warm cream ground, white rounded cards, black pill CTAs, small-caps section labels, coloured type badges, option chips) and a different navigation model (bottom tab bar on mobile, left sidebar on desktop).

This work brings the built app to that visual language, plus a bottom tab bar, without disturbing the behaviour underneath. **It is a restyle with exactly one new feature** — a Home screen showing portfolio totals, which cannot be built by summing in the UI (see constraint 2).

## Decided before starting

| Decision              | Value                                                                     |
| --------------------- | ------------------------------------------------------------------------- |
| Navigation            | Bottom tab bar, **at every width** — no sidebar, no breakpoints            |
| Tabs                  | **Home · Trades · Journal · Review**                                      |
| Stats tab             | Deferred to Analytics (S15.3), which adds it as a fifth tab                |
| "New plan"            | **Not** a tab — stays triggered from the Trades page, as built today       |
| Settings              | Icon on the Home screen, keeping the bar at four                           |
| Home content          | Open P&L total · open and planned counts · realized P&L to date            |
| Home totals           | One narrow new coordinator operation, built with this work                 |
| Attention cues on Home | Excluded — review-due and journal-owed counts are not shown               |

The desktop sidebar is explicitly **not** adopted. [prototype/README.md](../design/prototype/README.md) calls it "an architecture change, not a restyle", and [ui-style.md](../design/ui-style.md) prescribes no responsive strategy at all. If it is ever wanted, it is its own story.

## Constraints

Repo law, not preference. Each removes an option that would otherwise look obvious.

1. **Never change accessible names, roles, labels, or copy for styling.** [ui-style.md](../design/ui-style.md) states it and the suites enforce it — tests and e2e select by role, label and text (`aria-label="timeline"`, `"pnl"`, `"progress"`, `"journal owed"`). A restyle is therefore **`className`-only plus thin structural wrappers**, and the existing suites are the regression net. Any story that genuinely changes structure or copy owns its test updates and says so.

2. **The UI never derives.** [overview.md](../design/overview.md) — facts arriving in coordinator bundles are display-only; the UI calls Books for facts and coordinators for anything computed, never TradeMath or a StorageBinding. An ESLint boundary rule enforces it. Summing per-Trade P&L inside a Home component is illegal, which is why Home needs a real coordinator operation.

3. **The prototype is a design target, not a spec.** Where a screenshot and a design doc or ADR disagree, the doc wins ([prototype/README.md](../design/prototype/README.md), restated in [README.md](./README.md)). Two conflicts resolve against the prototype:
   - Its **"Add trade"** button violates ADR 0014 — an individual fill is always an _Execution_, and "trade" for a fill is banned in code, UI copy and test names. Keep the built wording.
   - Its **"Insights"** button is the Coach, which [ADR 0016](../adr/0016-automated-coaching-deferred.md) defers out of the initial deliverable and no slice covers. Do not build it.

4. **Take layout and wording from the prototype, never its numbers.** Its arithmetic is known-broken: position risk off by 100× for stock, P&L booking full cost basis as loss, adherence 85% on a plan with zero fills, a "Close position" that does not close.

5. **No overlay machinery exists today.** No dialog, portal, fixed positioning, z-index or transition anywhere in `src/ui` — every "open a form" is inline expansion. The prototype's bottom sheets and right-hand drawers would be new infrastructure. This work does **not** build them; forms stay inline. The tab bar is the only newly fixed-positioned element.

## The design system

Extract the prototype's language into `src/ui/styles.ts`, which already holds the shared class constants and is the documented place for them. Most of the visual change lands there; the per-screen work is replacing recurring inline strings.

| Token          | Today                                                | Prototype                                                              |
| -------------- | ---------------------------------------------------- | ---------------------------------------------------------------------- |
| Page ground    | `bg-slate-50`                                        | warm cream — add as a Tailwind v4 theme colour in `src/ui/index.css`    |
| Card           | `rounded-lg border-slate-200 bg-white p-4 shadow-sm` | larger radius (`rounded-2xl`), hairline border, minimal shadow          |
| Primary button | `bg-indigo-600`, `rounded-md`                        | **black pill** — `bg-slate-900 rounded-full`, full-width where primary  |
| Secondary      | white + slate border                                 | white pill, same radius                                                 |
| Accent         | indigo                                               | black for action; green/red reserved for P&L and stop                   |
| Section label  | `subheading`                                         | same idea, slightly wider tracking — already close                      |
| Badges         | `StatusBadge` amber/green/slate                      | same shape; add journal **type** tones (PLAN blue, POSITION neutral, MARKET amber, CLOSE red) |
| Chips          | none                                                 | option chips — black when selected, white outline when not              |
| Numbers        | `tabular-nums` via `num`                             | unchanged — keep `num` everywhere                                       |

Keep the light-theme-only rule and the system font stack; the prototype's typeface is not available and is not worth adding.

## Stories

Sequenced so every story ships something visible and independently verifiable — the slice convention is vertical, and a single horizontal "restyle everything" story would violate it. Each ends in browser verification, per the story loop in [README.md](./README.md).

### UX.1 — Design tokens

Rewrite `src/ui/styles.ts` to the prototype language; add the cream page colour to the Tailwind theme in `src/ui/index.css`. No structural change, no new components. Every screen shifts at once because they all consume these constants.

_Verify:_ the full suite passes **unmodified** — that is the proof the change is `className`-only. Every page loads and reads correctly.

### UX.2 — The tab bar

Replace the header nav in `src/ui/App.tsx` with a fixed bottom tab bar: Home · Trades · Journal · Review. The header keeps the page title only. `<main>` gains bottom padding so content clears the bar. Trades moves to `/trades`; `/` becomes Home.

_Changes tests:_ nav selectors and any e2e that navigates by header link. Those updates belong to this story.

_Verify:_ every route reachable, active tab correct on each, nothing hidden behind the bar.

### UX.3 — Home

The new screen, and **the only new non-UI code**: a narrow `Valuations` totals operation returning open P&L, open count, planned count and realized-to-date — signature taken verbatim from [overview.md](../design/overview.md). Unit tests against the in-memory binding, integration over Dexie, one Playwright happy path. Home renders the hero P&L treatment, the count line ("Day N · K open") and the Settings icon.

_Decide in this story:_ what totals show when not every open Trade has today's Mark. They must not silently understate; reporting marked/unmarked counts alongside is the suggested answer.

_Verify:_ totals match hand-computed values from a seeded book; unmarked Trades are handled visibly.

### UX.4 — Trades list

Conform `TradesPage` to the prototype row: monogram circle, ticker, strategy · day count · adherence, P&L right-aligned. "New plan" stays as the page's own CTA, now a black pill. **Omit** the REVIEW DUE badge — that is attention ranking, S8.1, which links this same screenshot.

_Verify:_ planned, open and closed rows all render; a row reaches its detail page.

### UX.5 — Trade detail

The densest screen. Hero card (day · strategy, large P&L, adherence chip, Current/Target/Stop with the "away"/"cushion" framing, consistent with ADR 0010), then a Plan / Invalidation / Catalyst card, a Legs & Fills card, then actions. Keep Execution wording (constraint 3). Keep the four R/R numbers the design docs require — the prototype's two-number framing is a display idea, not licence to drop them.

_Verify:_ the stock, spread and planned-no-fills variants all read correctly.

### UX.6 — Journal timeline

Date-group headers, coloured type badges, filter chips (All / Plans / Positions / Market / Closes), and the "Tap to view plan →" affordance. Filters are display-only over already-loaded entries; `TimelineFilter` proper is settled in S15.3 and is not built here.

_Verify:_ grouping and each filter; addenda still nest; owed placeholders still settle inline.

### UX.7 — Plan form and entry composer

Card-grouped sections, small-caps labels, option chips for the feeling prompt, the risk/reward summary panel, full-width black submit. `PromptFields` gains a chip rendering for select prompts — in that one component, since S1.9 just consolidated prompt rendering there and it must stay consolidated.

_Verify:_ a full plan → confirm → journal round trip.

### UX.8 — Review, Settings, and the design doc

Conform the walk checkpoint, the review agenda and Settings. Then **rewrite [ui-style.md](../design/ui-style.md)** to describe the new system: it currently prescribes the header nav and indigo palette this work replaces, and under constraint 3 a stale design doc outranks the prototype.

_Verify:_ a full review walk; export and restore; all suites green.

## Files

- `src/ui/styles.ts` — the token rewrite (UX.1), the highest-leverage change here
- `src/ui/index.css` — Tailwind v4 theme block for the cream ground (today a bare `@import`)
- `src/ui/App.tsx` — shell and tab bar (UX.2)
- `src/ui/pages/HomePage.tsx` — new (UX.3)
- `src/coordinators/valuations.ts` — the totals operation (UX.3)
- Per screen: `TradesPage.tsx`, `TradeDetail.tsx` (+ `TradeDashboard.tsx`), `TimelinePage.tsx`, `PlanForm.tsx`, `WalkSession.tsx` / `WalkCheckpoint.tsx`, `ReviewPage.tsx`, `SettingsPage.tsx`, `Onboarding.tsx`
- `src/ui/components/Badge.tsx` — journal type tones; `PromptFields.tsx` — chips
- [ui-style.md](../design/ui-style.md) — rewritten last (UX.8)

Reuse rather than rebuild: the `styles.ts` constants, `StatusBadge`, `PromptFields`, `AnsweredPrompts`, and the `num` convention on every money and quantity value.

## Verification

Per story, in order:

1. `npm test` — unit + integration. For UX.1 and UX.4–UX.7 these should pass **unmodified**; a styling change that breaks a test is a signal it touched an accessible name, not that the test is wrong.
2. `npx tsc -b` and `npm run lint` — lint also enforces the module-boundary rule.
3. `npm run dev`, then drive the story's screens in a real browser.
4. `npx playwright test` — 34 specs today; UX.2 and UX.3 add or update specs.
5. An acceptance pass per screen, from a cleared database.

Whole-migration acceptance: onboard → plan → fill → mark → review walk → close, entirely through the new UI, with a reload mid-flow and nothing lost.

## Effort

Roughly 2–3× story S1.9 in total. UX.3 is about a third of it on its own and is not a restyle; deferring its numbers to Analytics would shrink the whole materially. UX.5 and UX.7 are the two large files. Everything else is cheap precisely because of constraint 1. The main risk is UX.2, the only story that changes navigation structure and therefore where test churn concentrates.

The cheapest useful increment is **UX.1 alone** — one file, and the new visual language appears across every screen, enough to judge the direction before committing to the rest.

## Open questions

1. **Slice number.** This is written as stories so the story loop applies unchanged, but it is deliberately unnumbered. Numbering it (Slice 18) makes it schedulable; leaving it unnumbered keeps it a proposal.
2. **Vertical-slice tension.** The convention is that each slice ships trader-visible functionality; this one is largely horizontal. The story order mitigates it — each story conforms one screen end to end — but the tension is real and worth acknowledging rather than hiding.
3. **Home and unmarked Trades** — settled inside UX.3.
4. **Out of scope**: the Stats screen (arrives with Analytics) and the Coach / Insights panel (deferred by ADR 0016).
