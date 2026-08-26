# UI Style Conventions

The app is a trader's daily working tool: clean, quiet, data-dense. Light theme
only (dark mode is a later story — do not build it). Styling is
[Tailwind CSS v4](https://tailwindcss.com) via the `@tailwindcss/vite` plugin;
`src/ui/index.css` adds the cream page colour as a Tailwind theme colour and is
imported once from `src/ui/main.tsx`. No component library, no animation
framework, no overlay machinery — no dialog, portal, fixed positioning
(besides the bottom tab bar itself), z-index, or transition anywhere in
`src/ui`. Every "open a form" is inline expansion, not a sheet or drawer.

Shared class strings live in `src/ui/styles.ts`; the status and journal-type
pills live in `src/ui/components/Badge.tsx`. Reach for those before
hand-rolling classes — add a new shared constant only when the same classes
repeat in 3+ places. This document describes the system **as built** by the
`ui-conformance-migration` (UX.1–UX.8), which replaced an earlier
slate/indigo, header-nav language; where this doc and the code disagree, the
code and `styles.ts` win.

## Palette

- **Neutrals**: Tailwind `stone`. Page ground is a warm cream (`bg-cream`,
  `#f2f0e9`, themed in `index.css`); card surfaces are `white`; borders
  `stone-200`; primary text `stone-900`; secondary text `stone-500/600/700`
  depending on where it sits (see **Contrast**, below — the two grounds don't
  take the same shade).
- **Accent**: black (`stone-900`) — primary buttons, links, the active tab,
  selected chips, focus rings. There is no accent hue: colour is reserved for
  meaning (P&L sign, badge tones), not for chrome.
- **P&L and stop/target**: green/red by sign, **`green-700`/`red-700`, not
  600** — `green-600` is 3.22:1 on white and fails AA outright.
- **Alert/validation text**: `red-600`/`red-700`. Like `stone-500`, `red-600`
  is ground-dependent: 4.76:1 on white (passes) but 4.18:1 on cream (fails) —
  every alert site today sits inside a white card, so nothing is broken, but
  an alert placed directly on the cream ground needs `red-700` instead.
- **Journal type badges** (`EntryBadge`, keyed on `Anchor.kind`, not Entry
  Type — see **Badges**, below): `plan` blue, `review` neutral stone, `standalone`
  amber, `close` red.
- The one surviving non-neutral, non-badge colour is the replay chart's P&L
  line, `blue-600` — a data-series colour, not UI chrome; see **Charts**.

## Typography

- System font stack (Tailwind default — no custom fonts).
- Page heading (`h2`): `text-xl font-semibold text-stone-900` (`heading`).
- Section sub-heading / small-caps section label (`h3`, or a chip/prompt
  group's legend): `text-xs font-semibold uppercase tracking-wider
  text-stone-600` (`subheading`, `promptLegend`).
- **`tabular-nums` on every money and quantity value** (the `num` constant) so
  digits align in columns — quantities, prices, exit levels, counts.
- Links: black + `underline underline-offset-2` (`link`). Colour alone no
  longer distinguishes a link once the accent is the same near-black as body
  text — the underline is load-bearing, not decorative.

## Layout

- One page container: centered, `max-w-3xl`, `px-4 py-6 pb-24` (the bottom
  padding clears the fixed tab bar). It lives in App's `<main>`; pages render
  a `<section>` (usually `space-y-4/6`) inside it, directly on the cream
  ground.
- **Navigation is a fixed bottom tab bar, at every width** — no sidebar, no
  responsive breakpoint. Four tabs: **Home · Trades · Journal · Review**. The
  header above it keeps only the page title; there is no header nav. Settings
  is reached from an icon on Home, not a fifth tab.
- Detail pages group facts into **cards** (`card` = `rounded-2xl border
  border-stone-200 bg-white p-4`) — larger radius than a typical Tailwind
  default, hairline border, no shadow. A card is the one place body text can
  safely sit at `stone-500` (see **Contrast**); text directly on the cream
  ground needs a darker shade.
- Onboarding renders outside the shell, so it centers its own white card
  (`bg-white`, `border-stone-200`) on the same cream full-height background.
  Its card diverges slightly from the `card` token — `rounded-lg` and
  `shadow-sm` rather than `rounded-2xl` with no shadow — a pre-existing
  difference this migration's colour-only conform of Onboarding didn't
  reach; treat it as scope, not a defect, if you notice it.

## Buttons

- **Primary** (`btnPrimary`): a **black pill** — `bg-stone-900 rounded-full`,
  full-width where it is the page's one primary action (e.g. a form's
  submit). Confirming/committing actions ("Confirm plan", "Get started",
  "Write journal entry"). Disabled state is visibly muted (`bg-stone-200
  text-stone-400`, `cursor-not-allowed`).
- **Secondary / ghost** (`btnSecondary`): a white pill, same radius, hairline
  `stone-300` border. Supporting actions ("Skip", "Add idea source", "Add
  account").

## Chips

A pill, black when selected, white with a border when not — but this shape is
built by **two different constant pairs for two different roles**, and the
distinction is load-bearing, not cosmetic:

- **Filter chips** (e.g. Journal's Plans/Reviews/Market/Closes row) reuse the
  ordinary button constants, `btnPrimary`/`btnSecondary` (`border-stone-300`,
  `px-4 py-2`), rendered as `aria-pressed` **buttons** — a view toggle over
  already-rendered rows, with no persisted value and no single-choice
  constraint in principle (a filter row happens to be single-select today,
  but the mechanism is "is this pressed", not "which one is chosen").
- **Prompt chips** (a select prompt rendered by `PromptFields`, e.g. the
  Emotional-state or Action prompt) use the dedicated `chip`/`chipSelected`
  constants (`border-stone-500`, `px-3 py-1.5`) as **radio inputs inside a
  `<fieldset>`**, with the prompt text as the `<legend>` — a single-choice
  **form value**, exactly like the scale-prompt radios `PromptFields` already
  renders. The radio itself is visually hidden (`opacity-0`, layered over the
  whole label); focus is painted from the label via `:has(:focus-visible)`,
  since a peer-\* selector can't reach an input that is the label's child
  rather than a preceding sibling.

They read as the same pill by design — both are "select one of these" at a
glance — but do not reuse one pair for the other: a single-choice form value
belongs in a radio group built from `chip`/`chipSelected`, and a filter
belongs on `aria-pressed` buttons built from `btnPrimary`/`btnSecondary`.
Swapping them changes both the accessibility tree and the keyboard behaviour
a screen reader user expects.

## Badges

Small rounded pills (`inline-flex items-center rounded-full px-2 py-0.5
text-xs font-medium capitalize`). Two families, both display-only and never
the source of derived state (ADR 0005 — a badge always reads a stored fact,
never a computed status):

**`StatusBadge`** — a Trade's lifecycle status:

| Status  | Tone                                   |
| ------- | --------------------------------------- |
| planned | amber — `bg-amber-100 text-amber-800`   |
| open    | green — `bg-green-100 text-green-800`   |
| closed  | gray  — `bg-stone-100 text-stone-600`   |

**`EntryBadge`** — a journal entry's `Anchor.kind`, **not its Entry Type**:
Entry Types are trader-editable from Slice 13 onward, so their set is open and
cannot carry a fixed palette, while `Anchor.kind` is closed and maps 1:1 onto
four tones (ratios computed against WCAG AA, 4.5:1 normal text, from Tailwind
v4's oklch colour values — the v3 hex swatches read close but not identical,
so compute against the version actually installed):

| `Anchor.kind` | Label    | Tone                                | Contrast |
| ------------- | -------- | ------------------------------------ | -------- |
| `plan`        | PLAN     | `bg-blue-100 text-blue-800`          | 7.25:1   |
| `review`      | REVIEW   | `bg-stone-200 text-stone-700`        | 8.18:1   |
| `standalone`  | MARKET   | `bg-amber-100 text-amber-800`        | 6.41:1   |
| `close`       | CLOSE    | `bg-red-100 text-red-800`            | 6.86:1   |

The Trade detail page's execution-history card is titled **"Legs &
Executions"**, not the prototype's "Legs & Fills" — CONTEXT.md's Avoid list
for Execution names "fill" directly, without carving out UI copy, and this
migration's own vocabulary rule (constraint 3) already treats a stale design
doc or prototype string as losing to that list, the same way "Add trade"
loses to "Trade" for a fill everywhere else in this app. Settled here in
UX.8, which owns this document. "Record fill" as a button label is untouched
pre-existing copy either way — narrower wording churn than a heading rename,
and out of this story's scope.

`review` is deliberately **not** labelled POSITION, though that is the
prototype's word for it: a Position is holdings derived from Executions
(CONTEXT.md), and using it for a Trade-anchored journal entry is the campaign
sense [ADR 0014](../adr/0014-trade-is-the-campaign.md) exists to ban. `entry`
(an addendum) never reaches a timeline row — `buildEntryThreads` nests it
under its root — so it carries no badge.

The "journal owed" marker reuses the amber (planned/attention) tone.

## Forms

- Labels wrap their control and stack vertically: `field` = `flex flex-col
  gap-1 text-sm font-medium text-stone-700`. Clear label above every input.
- Inputs / selects / textareas share the `input` class (rounded border,
  `px-3 py-2`, a `stone-500` focus ring). Adequate touch targets.
- Grouped inputs use a `<fieldset>` with a rounded border and a `<legend>` —
  the same shape scale-prompt radios and select-prompt chips both use
  (`promptGroup` / `promptLegend`).
- Forms stay **inline** — no dialog, sheet, or drawer. "Open a form" always
  means expanding a section already on the page.

## Charts

The replay graph (`ReplayChart`, `docs/design/trade-detail-sequence.md`) is a
hand-rolled inline SVG, not a charting library (ADR 0009 keeps this surface
reflective — a polyline, a gap segmentation, and a slider, not a charting
problem). SVG paint attributes (`stroke`/`fill`) can't take a Tailwind
class, so the chart reads its colours from the CSS custom properties Tailwind
v4 already defines — `var(--color-blue-600)`, `var(--color-amber-500)`,
`var(--color-stone-900)`, `var(--color-stone-200)` — rather than a
hard-coded hex literal. That is not a style preference: a literal drifts the
moment the theme's colour value changes upstream, and this migration shipped
exactly that bug **twice** — the total-P&L legend swatch (an ordinary
`bg-blue-600` Tailwind class, which always tracks the theme) and the
polyline it names (a literal `#2563eb`, Tailwind **v3's** blue-600) painted
two different blues, because Tailwind v4's `blue-600` is `#155dfc`; the
dashed risk-line's legend swatch (`border-amber-500`) and its own polyline
(a literal `#f59e0b`, v3's amber-500) had the identical mismatch one legend
row lower, against v4's amber-500 of `#fe9a00`. The zero line and
execution-marker dots had the same class of bug already, one shade further
back — hard-coded slate hexes (`#e2e8f0`, `#0f172a`) surviving under a
`stone` neutral palette. Reading the CSS variable removes the whole class of
drift, not just any one instance of it.

**This fix has its own fragility, and it is worth knowing about rather than
rediscovering.** Tailwind v4 tree-shakes theme variables: a `--color-*`
custom property is only emitted into the stylesheet if some *utility class*
using that colour is generated somewhere in the build. `var(--color-stone-900)`
inside a raw SVG attribute does not itself count as a use — the four colours
this chart reads only resolve today because each is also used as a class
elsewhere (`stone-200`/`stone-900` in `styles.ts`'s `card`/`btnPrimary` and
in `App.tsx`; `blue-600` and `amber-500` in this same file's own legend
swatches). If a future change removes the last class use of one of these
colours, the variable stops being emitted and the chart element silently
loses its paint — `stroke`/`fill` fall back to their SVG default (`none` for
the zero line, black for a fill) — with no test to catch it, since nothing
here asserts a colour. Keep at least one class use of `stone-200`,
`stone-900`, `blue-600`, and `amber-500` alive somewhere, or convert this
chart to read literals again with a comment pointing at this paragraph.

The total-P&L line and its legend swatch are `blue-600` — the one
non-neutral, non-badge colour left in the app, because a data series is not
UI chrome and the contrast rule below applies to it as non-text content:
`blue-600` (`#155dfc` in Tailwind v4) is 5.25:1 against the white card it
draws on, comfortably past the 3:1 large-content/graphics floor, and reads as
a distinct hue from both the near-black execution markers (`stone-900`) and
the dashed amber "if stopped out that day" reference line (`amber-500`,
`#fe9a00` in v4) beside it. Every number the chart plots is also shown as
plain text below it — the chart is secondary, the selected-date dashboard is
primary.

## Accessibility

- **Never change accessible names, roles, labels, or copy for styling** —
  tests and e2e select by role/label/text (`aria-label="progress"`,
  `"walk summary"`, `"journal owed"`, and many more). Add `className` and thin
  structural wrappers only.
- Focus states are visible: `focus:ring` on inputs, `focus-visible:outline` on
  buttons and chips. `capitalize` is display-only and does not alter DOM text.

### Contrast rule

Every colour choice in this app meets **WCAG AA**: **4.5:1 for normal text**,
and **3:1 for large text** (18.66px bold / 24px), **non-text UI components**
(borders, focus rings), and **graphics** (the chart line above). **Compute
the ratio — don't judge it by eye.** Four regressions in the
`ui-conformance-migration` looked correct on screen and were not:
`subheading` at `stone-500` on the cream ground (4.21:1), positive P&L at
`green-600` on white (3.22:1), `stone-400` timeline text on a white card
(2.59:1), and a chip's focus ring. Every one was invisible to inspection and
caught only by computing the ratio.

The practical consequence: **the cream ground and a white card don't take the
same shade of grey.** `stone-500` is 4.80:1 on white (passes) but 4.21:1 on
cream (fails) — so body text sitting directly on the page (not inside a
`card`) needs `stone-600` (6.69:1 on cream) or darker, while the same text
inside a white card can use `stone-500`. When converting or adding a text
colour, check what it actually renders on, not what colour the surrounding
markup implies.
