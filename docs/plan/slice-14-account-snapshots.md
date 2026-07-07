# Slice 14 — Account Snapshots

Account value enters the journal as dated observations: recorded opportunistically at the end of a review (or anytime), never derived, never prefilled — a stale number confirmed is a fake data point; an absent one is an honest gap (ADR 0013; [tradebook.md](../design/tradebook.md)).

**Out of scope (JIT):** the equity curve rendered from these snapshots (Slice 15's curves story); cash ledger (rejected forever, ADR 0013).

Design references: ADR 0013, [tradebook.md](../design/tradebook.md) (`recordAccountValue`), [review.md](../design/review.md) (end-of-session prompt).

---

## ☐ Story S14.1 — Recording account value

> As a trader, I want to jot my accounts' liquidation values when I have them in front of me, so that a true equity curve accumulates at whatever cadence I actually sustain.

**Deep interfaces**: `TradeBook.recordAccountValue(accountId, date, totalValue, note?)`, `ReviewAgenda.accountsForSnapshot` (the deferred agenda field arrives), snapshot history per Account.

**Decided in this slice:** one snapshot per (account, date); re-recording the same date replaces the observation (correcting a typo'd reading, not building history-of-history).

### Tasks

- [ ] **S14.1.T1 — recordAccountValue.**

  ```
  describe "TradeBook.recordAccountValue"
  - it stores (account, date, totalValue, note) as an observation
  - it rejects an unknown account and a negative value
  - it replaces the observation on re-record of the same (account, date)
  - it keeps snapshots of different dates as independent points
  describe "snapshot history"
  - it lists an account's snapshots date-ordered with gaps simply absent
  ```

- [ ] **S14.1.T2 — Review prompt + entry points.** `Review.agenda` gains `accountsForSnapshot` (accounts holding open Trades, or all non-archived — simplest: all non-archived); the walk's completion screen offers a value field per account — **always blank** (never prefilled with the prior value), skippable as a whole and per account. A second entry point on the account's Settings page shows the history table.

  ```
  describe "ReviewAgenda.accountsForSnapshot"
  - it lists non-archived accounts
  describe "SnapshotPrompt"
  - it renders blank value fields (no prior-value prefill, ever)
  - it records only the accounts the trader filled
  - it is skippable without any nag state
  describe "AccountHistory"
  - it shows the snapshot series with dates and notes
  ```

- [ ] **S14.1.T3 — Integration tests**: two accounts over Dexie — record one at session end, skip the other → reopen → history shows the one point; re-record same date replaces; next session prompts blank again.
- [ ] **S14.1.T4 — Playwright e2e** (`e2e/s14-1-snapshots.spec.ts`): finish a review → enter one account's value → history shows it; the field was blank despite yesterday's snapshot existing.
- [ ] **S14.1.T5 — Browser verification.** Real browser: full review ending with a snapshot for one of two accounts; verify blank fields, per-account skip, the history table, and that skipping created no debt or nag anywhere. All suites green.
