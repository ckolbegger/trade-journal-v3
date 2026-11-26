# Trade-list sticker fix — focused critic brief

Independent critic for the trade-list sticker bug task. Read-only: modify nothing. Start the app yourself, drive the production UI, return a structured report. Frozen `specs/` and plan files read-only. DEV-001: loopback `http://localhost:5182` only, never production HTTPS.

## What changed
`src/ui/trade-sticker.tsx` now owns the sticker rule: `stickerFor` returns the full uppercased underlying with `compact: true` only for values longer than five characters. `App.tsx` uses `<TradeSticker>` in Planned, Open and Closed rows; the two-character `monogram` helper was deleted. `.monogram` in `styles.css` grows to fit instead of being a fixed `2.25rem` circle, with a smaller font for compact values. The cream colour is unchanged.

## Start
From worktree root run `npm run dev` (port 5182). Use `playwright-cli` at `http://localhost:5182`. Close the browser and stop the server when done.

## Flows
1. **Full ticker in all three lists.** Onboard, confirm a Long Stock `AAPL` plan, open it with one execution, then close it. At each stage capture the sticker text in Planned, Open and Closed trades. Each must read exactly `AAPL`, never `AA`, and must equal the row's underlying title.
2. **Option row uses the same rule.** Confirm and open a Long Call `MSFT` plan. Its Open-list sticker must read exactly `MSFT`; no separate option sticker path.
3. **Narrow viewport.** At 480px width, confirm a plan with a four-character underlying and check the sticker text is still fully visible (no clipping, wrapping or ellipsis) and the row remains usable.
4. **Long underlying degrades gracefully.** Using `page.evaluate` to seed a stored Trade with a long underlying (e.g. `BRK.B-CALL-2026`) and a valid lifecycle index membership, open the trades list. The sticker must show the full value with the compact style (smaller font, no silent truncation). Report not-covered if seeding cannot be done without editing files.

For each flow: actions, observed result, PASS/FAIL. Any FAIL needs repro, expected vs actual and a screenshot. Report exact browser/OS versions. Edit nothing.
