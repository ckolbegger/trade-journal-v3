# D09AR TDD log, T9AR.20-F1

One file per task (decision 111), so parallel lanes never edit one file. Each row is one single-case run; see `../tdd-log.md` for the rules.

| T9AR.20-F1 | structural | note | `npx vitest run src/ui/cockpit/replay` | Structural: `pastLineRow` calls `pastLineWords` from stake-words.props.ts; no test changed; replay folder 211 tests green, typecheck and lint show no unused import. |
