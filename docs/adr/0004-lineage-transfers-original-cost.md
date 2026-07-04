# Trade lineage via Transfers at original cost basis

Rolling spawns a new Trade linked to its predecessor, and covering quantity (e.g., a LEAP behind a rolled short call) is Transferred into it so every Trade's risk/reward is computable standalone — no cross-Trade coverage references. A Transfer is a pure journal-side restructuring with no market transaction; transferred quantity keeps its original cost basis (a $200 LEAP is still a $200 LEAP in the new Trade).

Rejected: transferring at market value (internally realizing P&L at transfer) — it makes per-Trade tenure P&L cleaner, but breaks the lot-based view that matches broker statements, and the trader regards a lineage as one continuing economic story. Consequence to remember: a successor Trade's P&L includes appreciation earned during its predecessor's tenure.
