# Expiration date picker fix — focused critic brief

Independent critic for the post-D8aR expiration fix. Read-only: modify nothing. Start the app yourself, drive the production UI, return a structured report. Frozen `specs/` and plan files read-only. DEV-001: loopback `http://localhost:5182` only, never production HTTPS.

## What changed
The Long Call/Long Put **Expiration** field is now a native date picker (`<input type="date">`) so the chosen value is always ISO `YYYY-MM-DD`, which `parseOptionContract` requires. `error-meaning.ts` maps the `Expiration` issue to `Enter the expiration as YYYY-MM-DD.` instead of echoing the raw token, for corrupted/restored drafts that bypass the picker.

## Start
From worktree root run `npm run dev` (port 5182). Use `playwright-cli` at `http://localhost:5182`. Close the browser and stop the server when done.

## Flows
1. **Date picker present and usable.** Onboard (Institution, Account) → New Plan → Long Call. The Expiration input must be `type=date`. Pick `2026-12-16`, fill the rest of a valid Long Call, confirm. The planned Trade must appear with exact contract `AAPL 190Call 2026-12-16 x100`, no alert, no global banner.
2. **No stale US-format failure through the UI.** Reload, open the confirmed planned Trade, confirm the stored contract expiration is `2026-12-16` (not `12/16/2026`) and the payoff panel renders a break-even. No error text anywhere.
3. **Helpful error for a corrupted draft.** Using `page.evaluate`, turn the date input into a text input with value `12/16/2026` and dispatch a native `input` event so React state sees it; submit the rest of a valid plan. The local alert must read `Enter the expiration as YYYY-MM-DD.`; no Trade is written; no global banner.
4. **Regression check.** Confirm a second Long Call with a different picked date (e.g. `2027-01-15`) and a Long Stock plan; both must save normally with no banner.

For each flow: actions, observed result, PASS/FAIL. Any FAIL needs repro, expected vs actual and a screenshot. Report exact browser/OS versions. Edit nothing.
