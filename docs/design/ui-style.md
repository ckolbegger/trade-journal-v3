# UI Style Conventions

The app is a trader's daily working tool: clean, quiet, data-dense. Light theme
only (dark mode is a later story — do not build it). Styling is
[Tailwind CSS v4](https://tailwindcss.com) via the `@tailwindcss/vite` plugin;
`src/ui/index.css` is a single `@import "tailwindcss";`, imported once from
`src/ui/main.tsx`. No component library, no animation framework.

Shared class strings live in `src/ui/styles.ts`; the status pill lives in
`src/ui/components/Badge.tsx`. Reach for those before hand-rolling classes — add
a new shared constant only when the same classes repeat in 3+ places.

## Palette

- **Neutrals**: Tailwind `slate`. Page background `slate-50`; surfaces `white`;
  borders `slate-200`; primary text `slate-900`; secondary text `slate-500/600`.
- **Accent**: `indigo` — primary buttons (`indigo-600`), links, focus rings, and
  the active nav item (`indigo-700` on `indigo-50`).
- **Alert/validation text**: `red-600`.

## Typography

- System font stack (Tailwind default — no custom fonts).
- Page heading (`h2`): `text-xl font-semibold text-slate-900` (`heading`).
- Section sub-heading (`h3`): `text-xs font-semibold uppercase tracking-wide
  text-slate-500` (`subheading`).
- **`tabular-nums` on every money and quantity value** (the `num` constant) so
  digits align in columns — quantities, prices, exit levels, counts.

## Layout

- One page container: centered, `max-w-3xl`, `px-4 py-6`. It lives in App's
  `<main>`; pages render a `<section>` (usually `space-y-4/6`) inside it.
- App shell: white header with a bottom border, app title left, nav right.
  Active nav link uses the accent treatment; inactive links are `slate-600`
  with a hover background.
- Detail page groups facts into **cards** (`card` = `rounded-lg border
  border-slate-200 bg-white p-4 shadow-sm`).
- Onboarding renders outside the shell, so it centers its own card on a
  `slate-50` full-height background.

## Status badges

Small rounded pills (`inline-flex items-center rounded-full px-2 py-0.5 text-xs
font-medium capitalize`) via `<StatusBadge status={…} />`. Tone per status:

| Status  | Tone                              |
| ------- | --------------------------------- |
| planned | amber — `bg-amber-100 text-amber-800` |
| open    | green — `bg-green-100 text-green-800` |
| closed  | gray  — `bg-slate-100 text-slate-600` |

The "journal owed" marker reuses the amber (planned/attention) tone.

## Forms

- Labels wrap their control and stack vertically: `field` = `flex flex-col gap-1
  text-sm font-medium text-slate-700`. Clear label above every input.
- Inputs / selects / textareas share the `input` class (rounded border,
  `px-3 py-2`, indigo focus ring). Adequate touch targets.
- Grouped inputs use a `<fieldset>` with a rounded border and a `<legend>`.

## Buttons

- **Primary** (`btnPrimary`): solid indigo. Confirming/committing actions
  ("Confirm plan", "Get started", "Write journal entry"). Disabled state is
  visibly muted (`bg-slate-200 text-slate-400`, `cursor-not-allowed`).
- **Secondary / ghost** (`btnSecondary`): white with a slate border. Supporting
  actions ("Skip", "Add idea source", "Add account").

## Accessibility

- Never change accessible names, roles, labels, or copy for styling — tests and
  e2e select by role/label/text. Add `className` and thin structural wrappers
  only.
- Focus states are visible: `focus:ring` on inputs, `focus-visible:outline` on
  buttons. `capitalize` is display-only and does not alter DOM text.
