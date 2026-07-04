# Pricing sources behind an interface; manual entry is a complete workflow

Marks enter the app through a pricing-source abstraction that will front many providers added over time; provider choice is deferred, but any provider must serve individual option-contract marks, not just stock closes. Manual price entry for tickers and contracts is the initial deliverable for Daily Review and remains a first-class, permanently supported workflow — traders with few open Trades may never enable automated pricing. Automated fetch, when enabled, pre-fills and the trader can always override; every Mark is stored as a dated observation regardless of origin.

Marks are keyed by (instrument, date) and stored exactly once: a contract held by several Trades is priced the first time it is encountered and never re-asked. Editing an existing Mark warns the trader that the change affects every Trade referencing it.
