# Trade-list sticker bug — execution record

Task: `plan/monogram-sticker-bug-task.md`. Committed as its own task, no tag. Frozen `specs/` read-only; DEV-001 loopback only.

**RED first.** `tests/unit/trade-sticker.test.ts` and `e2e/trade-sticker.spec.ts` were written before production code. Unit failed on the missing module; browser showed the sticker text `AA` for `AAPL`. Test timing/selector issues found while writing the e2e were corrected in the tests (await sticker count; scope clicks to `.trade-row`), never by weakening assertions.

**Implement/removal.** `src/ui/trade-sticker.tsx` owns `stickerFor` (full uppercased underlying; `compact` only when longer than five characters) and the `<TradeSticker>` view. Deleted the two-character `monogram` helper from `App.tsx` and replaced all three trade-list call sites. `.monogram` now grows to fit with `white-space: nowrap`; `.monogram.compact` uses a smaller font. Cream colour unchanged.

**Test migration, not deletion.** Showing the full ticker made the sticker text duplicate `.row-title`, so 36 existing browser selectors using `getByText('AAPL')` hit strict-mode ambiguity. They were migrated to `.trade-row` filters across `e2e/` and `e2e-prod/offline.spec.ts`. Two unrelated institution/account selectors that the bulk edit touched were restored to their original `getByText` form. No assertion was removed.

**Verification:** 346 Vitest, 64 integration, 61 browser, 1 offline, lint, both typechecks, build. Offline Release Inventory `sha256-d6d2926436bff4bc8975cf989d85ec641dfa5d0647f8cc40e732d63452870fcb`.

**Critic:** `plan/trade-sticker-critic-brief.md`, fresh independent subagent — **4 PASS / 0 FAIL** (Chromium 158.0.8127.37 / macOS 26.6.2 arm64, loopback). Verified full `AAPL` sticker in Planned/Open/Closed matching the row title, the same rule on an option `MSFT` row, no clipping/wrapping/ellipsis at 480px, and a seeded long underlying `BRK.B-CALL-2026` rendered in full with the compact style. User also reported a two-letter sticker after refresh; the cause was a stale cached page while the dev server had been stopped by test runs — a hard reload resolved it. The live server serves the new module with `Cache-Control: no-cache`.
