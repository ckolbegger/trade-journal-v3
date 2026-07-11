// Shared Tailwind class strings so pages read consistently. Conventions are
// documented in docs/design/ui-style.md. These are display-only — no behavior.

// The page container (centered, max-w-3xl) lives in App's <main>; pages just
// render sections inside it.

// Card-style section wrapper.
export const card = 'rounded-lg border border-slate-200 bg-white p-4 shadow-sm'

// Section heading (h2) and sub-heading (h3) tones.
export const heading = 'text-xl font-semibold text-slate-900'
export const subheading = 'text-xs font-semibold uppercase tracking-wide text-slate-500'

// Vertical label wrapping an input/select/textarea.
export const field = 'flex flex-col gap-1 text-sm font-medium text-slate-700'

// Text input / select / textarea.
export const input =
  'rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500'

// Primary action button (indigo). Reads clearly disabled when disabled.
export const btnPrimary =
  'inline-flex items-center justify-center rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-indigo-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600 disabled:cursor-not-allowed disabled:bg-slate-200 disabled:text-slate-400 disabled:shadow-none'

// Secondary / ghost button.
export const btnSecondary =
  'inline-flex items-center justify-center rounded-md border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 shadow-sm hover:bg-slate-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600'

// Accent link.
export const link = 'font-medium text-indigo-600 hover:text-indigo-500'

// Right-aligned numerics (money / quantities).
export const num = 'tabular-nums'
