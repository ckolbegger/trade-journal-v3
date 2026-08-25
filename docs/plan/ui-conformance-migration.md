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

Home renders the page heading and the Settings icon. Where the prototype shows the hero P&L and the "Day N · K open" count line, Home states plainly that account-wide totals are not computed yet — **without naming a future slice at the trader**. "Analytics" is a name from this plan; there is no such screen in the app, and a dateless roadmap promise on the first screen becomes a lie the day the slice slips. State the fact, not the plan.

Mind the vocabulary while writing it (this is where UX.3's review found its one blocker): a **Position** is holdings derived from Executions, so "planned positions" is the exact phrase [ADR 0014](../adr/0014-trade-is-the-campaign.md) exists to ban, and `portfolio` is an _Avoid_ term for Account in [CONTEXT.md](../../CONTEXT.md). The noun for what the trader has planned is **Trades**.

_Verify:_ Home is reachable from the tab bar and from `/`; Settings opens; no number on the page is derived in the UI.

_Deferred to S15.3:_ the `Valuations` totals operation (open P&L, open count, planned count, realized-to-date), the hero P&L treatment, the count line, and the "what shows when a Trade has no Mark today" ruling.

### UX.4 — Trades list

Conform `TradesPage` to the prototype row: monogram circle, ticker, strategy, P&L right-aligned. "New plan" stays as the page's own CTA, now a black pill. **Omit** the REVIEW DUE badge — that is attention ranking, S8.1, which links this same screenshot.

**Scoped 2026-08-25: two thirds of the prototype's subline cannot be built here.** The screenshot's row reads `Long Stock · Day 12 · 100% adh`. Of those three:

- **Strategy** — a stored fact. Show it.
- **Day count** — `plannedAt` is stored, but "Day 12" is days-between-then-and-today, a calendar computation. Constraint 2 forbids the UI deriving it, and the only sanctioned UI exception is the `InstrumentKey` codec — not `domain/dates`. Needs a coordinator field, which this migration is not adding (same ruling that deferred Home's totals). **Omit.**
- **Adherence** — does not exist. Deviations are Slice 9, unstarted. [slice-09](./slice-09-deviations-structural-sizing.md) explicitly names the prototype's adherence number as the thing *not* to reproduce: it shows 85% on a plan with zero fills, which measures plan completeness rather than behaviour. **Omit**, and do not invent a placeholder.

So the row is monogram · ticker · strategy · P&L · status badge. Keep the existing `aria-label` on the row and on `pnl` — e2e selects by them.

_Verify:_ planned, open and closed rows all render; a row reaches its detail page.

### UX.5 — Trade detail

The densest screen. Hero card (strategy, large P&L, Current/Target/Stop with the "away"/"cushion" framing, consistent with ADR 0010), then a Plan / Invalidation / Catalyst card, a Legs & Fills card, then actions. Keep Execution wording (constraint 3). Keep the four R/R numbers the design docs require — the prototype's two-number framing is a display idea, not licence to drop them.

The hero's **day count and adherence chip are omitted for the same reasons as UX.4** — one needs a coordinator field this migration isn't adding, the other needs Slice 9. Both return when their slice lands.

_Verify:_ the stock, spread and planned-no-fills variants all read correctly.

### UX.6 — Journal timeline

Date-group headers, coloured type badges, filter chips, and the "Tap to view plan →" affordance. Filters are display-only over already-loaded entries; `TimelineFilter` proper is settled in S15.3 and is not built here.

**Built test-first** (user ruling 2026-08-25): this story adds real filtering behaviour, so the implementer invokes the `tdd` skill and works red → green against the TestSpec below.

**Scoped 2026-08-25 — the badge/filter taxonomy is Anchor kind, not Entry Type.** Entry Types are trader-editable from Slice 13 onward, so their set is open and cannot carry a fixed four-colour palette. `Anchor.kind` is a closed set that already maps 1:1 onto the prototype's four badges:

| Prototype badge | Our `Anchor.kind` | Chip label |
| --- | --- | --- |
| PLAN | `plan` | Plans |
| CLOSE | `close` | Closes |
| POSITION | `review` (Trade-anchored review entries) | **Reviews** |
| MARKET | `standalone` | Market |

**The prototype's "POSITION" label cannot be used.** A Position is holdings derived from Executions ([CONTEXT.md](../../CONTEXT.md)); using it for a Trade-anchored journal entry is the campaign sense ADR 0014 bans — the same violation UX.3's review caught in Home's copy. The chip is **Reviews** and the badge is **REVIEW**.

`entry` anchors never reach a timeline row (`buildEntryThreads` nests addenda under their root), so they need no chip.

#### TestSpec — `src/ui/pages/TimelinePage.test.tsx`

```
describe('TimelinePage filter chips')
  it('renders All, Plans, Reviews, Market and Closes chips')
  it('shows every entry when All is selected, which is the default')
  it('shows only plan-anchored entries when Plans is selected')
  it('shows only close-anchored entries when Closes is selected')
  it('shows only review-anchored entries when Reviews is selected')
  it('shows only standalone entries when Market is selected')
  it('marks the selected chip as pressed and the others as not pressed')
  it('keeps an owed placeholder settleable inline while a filter is active')
  it('keeps addenda nested under their root when a filter is active')
  it('shows an empty timeline, not an error, when a filter matches nothing')
  it('re-applies the active filter after an entry is added')

describe('TimelinePage type badges')
  it('labels a plan-anchored entry PLAN')
  it('labels a close-anchored entry CLOSE')
  it('labels a review-anchored entry REVIEW')
  it('labels a standalone entry MARKET')
  it('never labels an entry POSITION')
```

The last one is a vocabulary guard, not a display test — it is the assertion that keeps the banned term out of the timeline.

_Changes tests:_ the date-group headers restructure the list, so specs asserting the flat row shape may need updating. Those updates belong to this story; the `aria-label="timeline"` and `aria-label="addenda"` lists and the `aria-label="journal owed"` marker must survive unchanged — e2e selects by them.

_Verify:_ grouping and each filter; addenda still nest; owed placeholders still settle inline.

### UX.7 — Plan form and entry composer

Card-grouped sections, small-caps labels, option chips for the feeling prompt, the risk/reward summary panel, full-width black submit. `PromptFields` gains a chip rendering for select prompts — in that one component, since S1.9 just consolidated prompt rendering there and it must stay consolidated.

**Built test-first** (user ruling 2026-08-25): converting a `<select>` to chips changes a real interaction, so the implementer invokes the `tdd` skill and works red → green against the TestSpec below.

**Scoped 2026-08-25 — this story CANNOT pass the suites unmodified, and the Verification section's claim that UX.4–UX.7 do is wrong for this one.** Replacing the select changes how every caller drives it:

- `src/ui/pages/PlanEntryForm.test.tsx` — `getByRole('combobox', { name: 'Emotional state' })`
- `src/ui/pages/WalkSession.test.tsx`, `src/ui/pages/WalkCheckpoint.test.tsx` — the Action prompt select
- 5 e2e specs — `s1-2`, `s2-1`, `s2-2`, `s2-3`, `s6-2` use Playwright's `selectOption`, which only works on a real `<select>`

That churn is owned by this story and is unavoidable, not a signal something was renamed carelessly. **Render chips as radio inputs inside a `<fieldset>` with the prompt text as its `<legend>`** — the same pattern `PromptFields` already uses for scale prompts, so the two renderings stay consistent and keyboard and screen-reader behaviour is preserved. Do not use buttons with `aria-pressed`; a single-choice prompt is a radio group.

Seeded option ids equal their labels and are lowercase (`calm`, `eager`, `anxious`, `FOMO`, `revenge`), so chips read as `capitalize` — display-only, exactly as `StatusBadge` already does. **The accessible name of each chip is the raw option label**, so `getByRole('radio', { name: 'calm' })` is the new selector.

#### TestSpec — `src/ui/components/PromptFields.test.tsx`

```
describe('PromptFields select prompts as chips')
  it('renders one radio per option, named by the option label')
  it('groups the radios in a fieldset whose legend is the prompt text')
  it('selects no option initially')
  it('reports the chosen option id through onChange when a chip is clicked')
  it('marks only the chosen chip as checked')
  it('replaces the previous choice when a second chip is clicked')
  it('keeps radio groups distinct when two select prompts share a form')
  it('renders text and scale prompts unchanged alongside a select prompt')
```

The last two are regression guards: `namespace` already exists to keep scale groups distinct and must now do the same job for chips, and S1.9's consolidation of prompt rendering into this one component must survive.

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

1. `npm test` — unit + integration. For UX.1, UX.4 and UX.5 these should pass **unmodified**; a styling change that breaks a test is a signal it touched an accessible name, not that the test is wrong. **UX.6 and UX.7 are the exceptions** — both add behaviour, both are built test-first, and both own real test churn (see their sections).
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
