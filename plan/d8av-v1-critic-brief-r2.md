# D8aV V1 — Trade Detail cockpit: repeat critic brief

Independent read-only browser critic, round 2. Start the app yourself, drive the production UI, edit nothing. DEV-001 loopback only (`http://localhost:5182`). Authority and exclusions as in `plan/d8av-v1-critic-brief.md`.

## Prior FAILs that must be re-verified
1. **Fabricated Mark.** With zero stored `market` records the old UI showed `Mark 3.00 / 3.00 / 0.00` and `Since last Mark: 3.00`. Expected now: the Today drawer shows `No Marks yet…` with no comparison table; no previous/now track markers; the rail says `No Mark yet`; the plan entry is never labelled an observed Mark. Re-check with a fresh onboarding and zero market records.
2. **Incoherent-state suppression.** With an over-size open (3) and over-size close (4), the old UI kept Today / Price History / Payoff drawers and all six fulfillment figures. Expected now: a full-width `Facts can't be replayed` banner, only three tabs (Position, Plan and Risk, Journal), `Figures unavailable` in place of the six figures, and no derived payoff/break-even in the rail. Re-check by creating that case through the production UI.
3. **Journal overflow at 480px.** The old cockpit grew to ~639px with `body.scrollWidth` 674. Expected now: one 409px column, `.rail-x` scrolls inside the panel, `body.scrollWidth <= window.innerWidth` on every tab.
4. **Drawer fidelity.** Price History should now be a sessions-as-columns table with `Call Mark / Status / Trade P&L` rows and an `Enter Marks in the Review` button; Plan and Risk should have two kv groups including `Entry, resolved`; an empty Journal narrative shows `No journal entries yet.` rather than a blank list.

## Regression guard
Re-check the round-1 PASS items still hold: two-column cockpit, sticky four-card rail, six-tab tablist, tracks, payoff SVG, full-width banner, read-only store counts, six canonical figure labels at wide and narrow widths, and no `adherence|composite|grade|ohlc` text. Confirm the `Enter Marks in the Review` button navigates to the Review screen without writing any store.

For each check: actions, observed evidence, PASS/FAIL. Report exact browser/OS versions. Close browser and stop the server. Edit nothing.
