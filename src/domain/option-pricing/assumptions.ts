// D9 P122: the interest rate the estimates assume, in two constants. The About page (T9.24) may read this file alone, so it holds no formula.

// 4% for an option up to 365 days from expiration.
export const SHORT_TERM_RATE = 0.04
// 5.25% beyond that.
export const LONG_TERM_RATE = 0.0525
// Days to expiration up to which, and including, the short-term rate applies.
export const SHORT_TERM_LAST_DAY = 365
