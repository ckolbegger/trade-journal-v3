# Bug task — trade-list sticker truncates the underlying to two characters

**Status:** queued as the next task. Not started. No production code, tests or commits have been made for it. Frozen `specs/` and plan files remain read-only; DEV-001 loopback evidence only.

## Reported symptom
In the trade list, the cream-coloured circle beside each Trade shows only the first two characters of the sticker — for example `AA` instead of `AAPL`. The user expects the sticker to show the underlying, not a two-letter abbreviation.

## Observed cause (read-only inspection)
- `src/ui/App.tsx:131` — `const monogram = (label: string) => label.slice(0, 2).toUpperCase()`. This hardcodes the two-character truncation.
- `src/ui/App.tsx:786`, `:806`, `:827` — the helper feeds the Planned, Open and Closed trade rows; all three lists are affected equally.
- `src/ui/styles.css:143–153` — `.monogram` is a fixed `2.25rem` circle, `font-size: 0.7rem`, `flex: 0 0 2.25rem`. Even if the text were lengthened, the fixed circle would clip or wrap a four-character ticker.
- The circle is `aria-hidden="true"`; the full underlying is already present in `.row-title`, so assistive technology is not affected. This is a visual defect only.

## Scope and assumption
Working term: **sticker** = the cream circular monogram badge in a trade-row. (Not a frozen glossary term; do not edit `specs/glossary.md`.)

Assumption to confirm at the start of work: show the **full underlying ticker** in the sticker for ordinary tickers (1–5 characters), e.g. `AAPL`, `MSFT`, `TSLA`, `BRK.B`. If the underlying is longer, the sticker must degrade gracefully rather than silently truncate — either widen into a pill or scale the font, keeping the full text visible. No change to Trade facts, storage, labels in `.row-title`, or any domain result.

## Task steps (test-first, one commit at the end)

1. **Extract the sticker rule behind a testable interface.** Move the inline `monogram` helper into a small UI module (e.g. `src/ui/trade-sticker.ts`) exposing `stickerFor(underlying: string): { text: string; compact: boolean }` or equivalent. `compact` lets the view choose a wider pill for long values without the view inventing its own truncation rule.
2. **RED tests before production code.**
   - `tests/unit/trade-sticker.test.ts`: `should keep the full underlying for a normal ticker` (`AAPL` → `AAPL`, not `AA`); `should uppercase without losing characters`; `should mark an unusually long underlying compact instead of truncating it` (assert no `slice(0, 2)` behaviour survives).
   - `e2e/trade-sticker.spec.ts`: onboard, confirm one Long Stock and one Long Call plan, then assert the Planned/Open/Closed row stickers render the full underlying text and the sticker's rendered text equals the row title's underlying. Include a long-underlying case seeded through the UI or IndexedDB, asserting the full value is visible (no silent ellipsis) — report as not-covered if the app cannot author that value without page-side seeding.
3. **GREEN implementation.** Replace all three `monogram(...)` call sites with the new helper. Adjust `.monogram` so a 4–5 character ticker fits on one line and an unusually long value falls back to the pill/font-scaling rule from step 1. Do not add a second sticker implementation for options; stock and option rows use the same rule.
4. **Removal.** Delete the inline `monogram` helper from `App.tsx`. No parallel path or fallback that still slices to two characters may remain.
5. **Verification before the critic.** `npm run test:all`, `npm run test:integration`, `npx playwright test`, `npm run lint`, `npm run typecheck`, `npm run typecheck:6`, `npm run build`, production offline test.
6. **Fresh browser critic.** New brief `plan/trade-sticker-critic-brief.md`; independent subagent starts the app itself, drives the production UI with `playwright-cli`, checks all three lists at desktop and narrow widths, edits nothing. Any defect: failing test → fix → all suites → repeat critic.
7. **Commit at the end of this task only.** `fix(ui): show the full underlying in trade-list stickers`, push to `Hy4-Flash`, verify with `git ls-remote`. No tag — this is a fix, not a deliverable. Restart the dev server for the user afterwards.

## Acceptance
- Planned, Open and Closed stickers show the full underlying ticker; no two-character truncation.
- Long underlyings remain fully visible or use an explicit compact style — never silently clipped.
- No Trade, Journal, Market or domain result changes; no new trader-visible capability.
- All cumulative suites green, fresh critic PASS with 0 FAIL, working tree clean at commit.

## Out of scope
Recolouring the sticker, changing the cream visual language, adding icons/logos for institutions, or editing frozen specs.
