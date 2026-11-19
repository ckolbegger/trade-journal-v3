# D09AR TDD log, T9AR.18-B1

One file per task (decision 111), so parallel lanes never edit one file. Each row is one single-case run; see `../tdd-log.md` for the rules.

| T9AR.18-B1 | structural | note | `npm run typecheck` | Structural: no behaviour changes (the one producer, `replay-series.ts` `plan`, already fills `terms`, and `assemble-replay.ts` passes it through), so no case can go red. `terms` made required in `ReplayPlan` (replay-series.ts) and `ReplayPlanColumn` (replay-view.ts); typecheck then named each test double without it (view-doubles.props.ts default, PLAN, DALE_PLAN; one inline plan in readout.props.test.ts), now filled with an empty `NO_TERMS`, which keeps the Plan block out of those readouts as before; `planBlockOf` drops its optional-terms check. Replay, coordinator and trade-analysis folders: 931 tests green. |
