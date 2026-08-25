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
