# D8aV V2 — repeat critic brief

Independent read-only browser critic, round 2. Start the app yourself, drive the production UI, edit nothing. DEV-001 loopback only. Authority and exclusions as in `plan/d8av-v2-critic-brief.md`.

## Prior FAIL and divergences to re-verify
1. Chip labels: both advisory chips previously rendered `[object Object]` because JSX sparklines were interpolated into strings. Expected now: `Implied volatility <number>` and `Share equivalent <number>` with inline sparkline SVGs and no literal object text.
2. Step buttons: ‹ should be named `Earlier session`, › `Later session`, matching their direction.
3. Each chip popover should carry `Never used for valuation, P&L, risk or the expiration payoff.` in addition to the footer disclaimer.
4. Replay should open on the last session, as the prototype's Corridor view does.

## Regression guard
Re-check the round-1 PASS items: chart rails/gap bands/observed dots with no gap dots, click and slider and step seeking, mark-only replay with no number inputs, advisory estimate labels and no feedback into results, unchanged `trade`/`journal`/`market` counts across all interactions, every-session table with Plan row and `—` gaps, one-column 480px layout with no horizontal overflow, disabled visualization tabs.

The critic also logged compositional divergences it did not fail on (single simplified chart vs the prototype's price strip plus P&L mountain; narrower app shell). Report them as context, not as new FAILs, unless a mechanism is now missing.

Actions, observed evidence, PASS/FAIL per check. Any FAIL needs repro, expected vs actual, screenshot. Close browser and stop the server. Report exact browser/OS versions. Edit nothing.
