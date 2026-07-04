# Strategy as template; deviations measured against the original Plan

A Strategy is a declared template, not a classification: it pre-fills the Plan's structured Planned Legs and defines the semantics of stop/target (underlying price, Trade value, or % of max profit). P&L and structural risk/reward computation never read Strategy — one universal formula over Legs, Executions, and Marks handles debit and credit structures identically, because buy/sell direction carries the signs.

Deviations (structural: unplanned leg; sizing: quantity beyond plan; discipline: stop/target crossed without action) are auto-detected against the original Plan and remain recorded even when a Plan Revision documents the change of intent — adherence analytics need the fact of departure, and Revision timestamps distinguish planned adaptation (revised, then executed) from rationalization (executed, then revised). Time-horizon overrun is deliberately not a Deviation; it surfaces via the "Timed Out" Close Reason instead.

Performance analytics group by declaration (Strategy, Tags) and by derived dimensions computed from the data (e.g., net opening cash flow classifies every spread as credit or debit), so cross-cutting questions never depend on labeling discipline.
