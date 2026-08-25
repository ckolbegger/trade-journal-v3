// Shared Tailwind class strings so pages read consistently. Conventions are
// documented in docs/design/ui-style.md. These are display-only — no behavior.

// The page container (centered, max-w-3xl) lives in App's <main>; pages just
// render sections inside it.

// Card-style section wrapper.
export const card = 'rounded-2xl border border-stone-200 bg-white p-4'

// Section heading (h2) and sub-heading (h3) tones.
export const heading = 'text-xl font-semibold text-stone-900'
export const subheading = 'text-xs font-semibold uppercase tracking-wider text-stone-600'

// Vertical label wrapping an input/select/textarea.
export const field = 'flex flex-col gap-1 text-sm font-medium text-stone-700'

// Text input / select / textarea.
export const input =
  'rounded-xl border border-stone-300 bg-white px-3 py-2 text-sm text-stone-900 focus:border-stone-500 focus:outline-none focus:ring-1 focus:ring-stone-500'

// Primary action button — black pill. Reads clearly disabled when disabled.
export const btnPrimary =
  'inline-flex items-center justify-center rounded-full bg-stone-900 px-4 py-2 text-sm font-medium text-white hover:bg-stone-800 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-stone-900 disabled:cursor-not-allowed disabled:bg-stone-200 disabled:text-stone-400'

// Secondary / ghost button — white pill, hairline border.
export const btnSecondary =
  'inline-flex items-center justify-center rounded-full border border-stone-300 bg-white px-4 py-2 text-sm font-medium text-stone-700 hover:bg-stone-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-stone-900'

// Accent link.
export const link = 'font-medium text-stone-900 underline underline-offset-2 hover:text-stone-600'

// Right-aligned numerics (money / quantities).
export const num = 'tabular-nums'

// Prompt group wrapper (scale radios, select-as-chips) and its legend —
// small-caps label over the option row, matching the card section heading
// language (subheading, above).
export const promptGroup = 'space-y-2 rounded-lg border border-stone-200 p-3'
export const promptLegend = 'px-1 text-xs font-semibold uppercase tracking-wider text-stone-600'

// Option chip (a select prompt's radio, rendered as a pill — PromptFields).
// Unselected: white pill, stone-500 border (3:1 vs white, WCAG AA
// non-text minimum) and stone-700 text (10.3:1). Selected: black pill,
// white text (17.5:1) — same fill as btnPrimary. The radio itself is visually
// hidden (opacity-0, layered over the whole label), so focus has to be
// painted from the label via :has() — a peer-* selector can't reach it,
// since the input is a child of the label, not a preceding sibling.
export const chip =
  'inline-flex cursor-pointer items-center rounded-full border border-stone-500 bg-white px-3 py-1.5 text-sm font-medium text-stone-700 hover:bg-stone-50 has-[:focus-visible]:outline has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-stone-900'
export const chipSelected =
  'inline-flex cursor-pointer items-center rounded-full border border-stone-900 bg-stone-900 px-3 py-1.5 text-sm font-medium text-white has-[:focus-visible]:outline has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-stone-900'

// Bottom tab bar item — icon above label. Active reads near-black and bold;
// inactive reads muted grey.
const tabItem = 'flex flex-1 flex-col items-center gap-1 py-2 text-xs'
export const tabItemActive = `${tabItem} font-semibold text-stone-900`
export const tabItemInactive = `${tabItem} font-medium text-stone-500`
