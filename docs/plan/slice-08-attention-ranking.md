# Slice 8 — Attention ranking

The Daily Review walk stops being first-in-first-out: open Trades are ranked by how badly they need the trader's eyes tonight, using the ongoing-risk-to-incremental-reward ratio ([trademath.md](../design/trademath.md): attentionScore v1 — "more signals later").

**Decided in this slice — score definition (v1):**

- risk = `plannedRisk` when defined, else `worstCaseRisk`; reward = `plannedReward` when defined, else `maxReward`.
- score = risk ÷ reward. **Higher ranks first.**
- reward ≤ 0 (at/past target) or `'unlimited'` risk → score +∞, ranks top: these demand a decision tonight.
- `'unlimited'` reward with finite risk ranks by risk ÷ worstCase-of-nothing → use maxReward = worstCaseRisk as a neutral denominator? No — an unlimited-reward Trade scores risk ÷ ∞ = 0 only if nothing else signals; v1 rule: `'unlimited'` reward → score = 0 (risk framing has no finite comparison; later signals will do better).
- A Trade with stale Marks ranks on its most recent Marks ([review.md](../design/review.md)); a never-marked Trade ranks last, flagged.
- Ties (including several +∞ or 0) break by insertion order — deterministic.

Worked ranking (three open Trades): bull put spread at ADR-0010 marks (950/50 = 19.0) → PMCC at worked marks with structureValue levels (finite ratio ≈ 1s) → long stock past its target (reward ≤ 0 → +∞)… order: **stock-past-target, spread, PMCC**.

Design references: [trademath.md](../design/trademath.md), [review.md](../design/review.md) (fetch → rank → walk, snapshotted order), [overview.md](../design/overview.md) (`Valuations.attentionBoard`).

---

## ☐ Story S8.1 — The ranked walk

> As a trader, I want tonight's walk to start with the Trades that most need a decision, so that my best attention lands where the risk is instead of wherever the list happened to start.

**Deep interfaces**: `TradeMath.attentionScore(trade, marks)`, `Valuations.attentionBoard(asOf)` (open Trades scored and sorted), `Review.walk` consumes the board; `WalkItem` gains its `attentionScore` field (deferred from Slice 1).

### Tasks

- [ ] **S8.1.T1 — attentionScore.**

  ```
  describe "TradeMath.attentionScore"
  - it scores the ADR-0010 spread marks at 19.0 (950/50)
  - it scores +Infinity when reward is zero or negative (target reached)
  - it scores +Infinity for 'unlimited' risk
  - it scores 0 for 'unlimited' reward with finite risk
  - it falls back to worst-case/max anchors when planned levels are absent
  ```

- [ ] **S8.1.T2 — attentionBoard + ranked walk.**

  ```
  describe "Valuations.attentionBoard"
  - it returns open Trades sorted by score descending
  - it ranks a stale-marked Trade on its most recent Marks
  - it ranks a never-marked Trade last with a flag
  - it breaks ties by insertion order
  - it excludes planned and closed Trades
  describe "Review.walk (ranked)"
  - it orders WalkItems by the board and carries each score
  - it keeps the session order snapshotted as marks land mid-walk (no reshuffling)
  ```

- [ ] **S8.1.T3 — UI.** The walk proceeds in board order; each checkpoint and the session list show a plain-language attention cue ("risking $950 to make $50") rather than the bare ratio; the Trades page gains an optional sort-by-attention.

  ```
  describe "Walk UI (ranked)"
  - it walks Trades in board order
  - it renders the risk-to-reward cue in words and dollars
  - it flags the never-marked Trade's rank as unmarked
  - it does not reorder the session after inline marks change scores
  ```

- [ ] **S8.1.T4 — Integration tests**: the three-Trade worked ranking over Dexie — walk order matches **stock-past-target, spread, PMCC**; marking mid-session leaves the order; next session reranks.
- [ ] **S8.1.T5 — Playwright e2e** (`e2e/s8-1-ranked-walk.spec.ts`): seeded three-Trade scenario → walk visits them in the worked order.
- [ ] **S8.1.T6 — Browser verification.** Real browser with three differently-shaped open Trades: confirm the order matches hand-computed scores, the cue text reads sensibly, and tomorrow's session reranks after today's marks. All suites green.
