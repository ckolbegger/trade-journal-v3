# Interactive visualizations are reflective, not predictive

The interactive Trade visualization replays actual history: a time slider moves through the recorded Marks, showing how realized/unrealized P&L and risk/reward (including risk vs incremental reward) actually evolved as the Trade played out. The initial deliverable performs no future-value calculation — no Black-Scholes projection, no what-if sliders for price/time/IV. If IV is shown, it is implied from observed Marks, used only for display.

Rejected for v1: a predictive what-if simulator. The intuition goal is served first by replaying reality, and the Daily Review ritual naturally accumulates the Mark history that powers it. Prediction can be layered on later without disturbing this model.
