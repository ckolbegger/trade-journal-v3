# UI conformance — migrating to the Claude Design prototype

_Planned 2026-08-24. Scheduled 2026-08-25 on branch `ui-conformance` (branched from `claude` at `98f0b14`). Deliberately unnumbered — stories keep their `UX.n` ids rather than becoming a slice; see [Open questions](#open-questions)._

## Why

The UI was built to [ui-style.md](../design/ui-style.md): a centered `max-w-3xl` document column, a white header bar with four nav links, a slate/indigo palette. It is consistent and fully tested — 588 unit/integration tests and 34 Playwright specs pass against it.

A Claude Design prototype ("TradeCoach") was then captured to [docs/design/prototype/](../design/prototype/) — 24 screenshots across 12 screens. It proposes a different visual language (warm cream ground, white rounded cards, black pill CTAs, small-caps section labels, coloured type badges, option chips) and a different navigation model (bottom tab bar on mobile, left sidebar on desktop).

This work brings the built app to that visual language, plus a bottom tab bar, without disturbing the behaviour underneath. **It is a pure restyle**: the portfolio totals that would have made Home a real feature are deferred to Analytics (S15.3) by user ruling, so no new coordinator operation is built here and constraint 2 is never tested.

## Decided before starting

| Decision              | Value                                                                     |
| --------------------- | ------------------------------------------------------------------------- |
| Navigation            | Bottom tab bar, **at every width** — no sidebar, no breakpoints            |
| Tabs                  | **Home · Trades · Journal · Review**                                      |
| Stats tab             | Deferred to Analytics (S15.3), which adds it as a fifth tab                |
| "New plan"            | **Not** a tab — stays triggered from the Trades page, as built today       |
| Settings              | Icon on the Home screen, keeping the bar at four                           |
| Home content          | ~~Open P&L total · open and planned counts · realized P&L to date~~ — see the row below |
| Home totals           | **Deferred to Analytics (S15.3)** — user ruling 2026-08-25. UX.3 ships the Home screen as a shell |
| Attention cues on Home | Excluded — review-due and journal-owed counts are not shown               |

The desktop sidebar is explicitly **not** adopted. [prototype/README.md](../design/prototype/README.md) calls it "an architecture change, not a restyle", and [ui-style.md](../design/ui-style.md) prescribes no responsive strategy at all. If it is ever wanted, it is its own story.

## Constraints

Repo law, not preference. Each removes an option that would otherwise look obvious.

1. **Never change accessible names, roles, labels, or copy for styling.** [ui-style.md](../design/ui-style.md) states it and the suites enforce it — tests and e2e select by role, label and text (`aria-label="timeline"`, `"pnl"`, `"progress"`, `"journal owed"`). A restyle is therefore **`className`-only plus thin structural wrappers**, and the existing suites are the regression net. Any story that genuinely changes structure or copy owns its test updates and says so.

2. **The UI never derives.** [overview.md](../design/overview.md) — facts arriving in coordinator bundles are display-only; the UI calls Books for facts and coordinators for anything computed, never TradeMath or a StorageBinding. An ESLint boundary rule enforces it. Summing per-Trade P&L inside a Home component is illegal — which is why, with the totals operation deferred, UX.3's Home shows no totals rather than deriving them.

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
| Links          | indigo, no underline                                 | black + `underline underline-offset-2` — colour alone no longer distinguishes a link once the accent is the same near-black as body text (added 2026-08-25 after UX.1 review) |
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

**Scoped 2026-08-25, before starting.** The churn is routing, not selectors, and only if the tab bar keeps the accessible names the suites already use:

- Keep the tabs as links named exactly **Trades**, **Journal**, **Review**, and keep a link named exactly **Settings** reachable from Home. 7 e2e specs click `getByRole('link', { name: 'Settings' })`; every nav click in the suite survives untouched if these names hold.
- **All 31 e2e specs open `goto('/')`.** `Onboarding` is a gate inside `AppRoot`, not a route, so a spec that onboards is still sitting on `/` afterwards — which today renders Trades and after this story renders Home. Every spec that then reaches for the trades list or the "New Trade" link needs one added line (`goto('/trades')` or a Trades tab click). That is the whole cost: one line per spec, no selector rewrites.
- `AppRoot`'s "Loading…" fallback still carries `text-slate-500`; convert it with the shell.

_Verify:_ every route reachable, active tab correct on each, nothing hidden behind the bar.

### UX.3 — Home

A new route at `/` that gives the Home tab somewhere to land. **Totals are deferred** (user ruling 2026-08-25): no `Valuations` totals operation is built here, and Home derives nothing — constraint 2 forbids summing in the UI, and the honest alternative to a coordinator operation is to show no totals at all.

Home renders the greeting and the Settings icon, and links onward to the tabs. Where the prototype shows the hero P&L and the "Day N · K open" count line, Home says plainly that portfolio totals arrive with Analytics rather than showing a computed-looking zero.

_Verify:_ Home is reachable from the tab bar and from `/`; Settings opens; no number on the page is derived in the UI.

_Deferred to S15.3:_ the `Valuations` totals operation (open P&L, open count, planned count, realized-to-date), the hero P&L treatment, the count line, and the "what shows when a Trade has no Mark today" ruling.

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

### UX.8 — Review, Settings, Replay, and the design doc

Conform the walk checkpoint, the review agenda and Settings.

**Discovered 2026-08-25, added to this story:** `ReplayView.tsx` / `ReplayChart.tsx` (the S15.1 replay screen) were missing from this plan's file list entirely. `ReplayChart` draws its series in `indigo-600` with a matching legend swatch — indigo surviving the token rewrite because it is a chart colour rather than a shared constant. (`TradesPage.tsx` also keeps a `hover:text-indigo-600`, but UX.4 converts that one.) Convert it with the rest.

Then **rewrite [ui-style.md](../design/ui-style.md)** to describe the new system: it currently prescribes the header nav and indigo palette this work replaces, and under constraint 3 a stale design doc outranks the prototype.

_Verify:_ a full review walk; export and restore; all suites green.

## Files

- `src/ui/styles.ts` — the token rewrite (UX.1), the highest-leverage change here
- `src/ui/index.css` — Tailwind v4 theme block for the cream ground (today a bare `@import`)
- `src/ui/App.tsx` — shell and tab bar (UX.2)
- `src/ui/pages/HomePage.tsx` — new (UX.3)
- Per screen: `TradesPage.tsx`, `TradeDetail.tsx` (+ `TradeDashboard.tsx`), `TimelinePage.tsx`, `PlanForm.tsx`, `WalkSession.tsx` / `WalkCheckpoint.tsx`, `ReviewPage.tsx`, `SettingsPage.tsx`, `Onboarding.tsx`
- Also carrying inline slate/indigo the per-screen stories must convert: `RecordFillForm.tsx`, `CloseForm.tsx`, `MarkEntry.tsx`, `NewEntryPage.tsx`, `PlanEntryForm.tsx`, `AddendumForm.tsx`, `AnsweredPrompts.tsx`, `RestoreFlow.tsx`, `SettleForm.tsx`
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

Roughly 2–3× story S1.9 as first written; deferring UX.3's totals to Analytics removes about a third of it, so the real figure is nearer 1.5–2×. UX.5 and UX.7 are the two large files. Everything else is cheap precisely because of constraint 1. The main risk is UX.2, the only story that changes navigation structure and therefore where test churn concentrates.

The cheapest useful increment is **UX.1 alone** — one file, and the new visual language appears across every screen, enough to judge the direction before committing to the rest.

## Open questions

1. **Slice number.** This is written as stories so the story loop applies unchanged, but it is deliberately unnumbered. Numbering it (Slice 18) makes it schedulable; leaving it unnumbered keeps it a proposal.
2. **Vertical-slice tension.** The convention is that each slice ships trader-visible functionality; this one is largely horizontal. The story order mitigates it — each story conforms one screen end to end — but the tension is real and worth acknowledging rather than hiding.
3. ~~**Home and unmarked Trades** — settled inside UX.3.~~ Moot: totals deferred to S15.3, which inherits the question.
4. **Out of scope**: the Stats screen (arrives with Analytics) and the Coach / Insights panel (deferred by ADR 0016).
