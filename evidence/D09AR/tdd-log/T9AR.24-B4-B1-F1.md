# D09AR TDD log, T9AR.24-B4-B1-F1

Structural follow-on: no case rows.

| refactor | goingGroup's Trade P&L value, a nested ternary, is now a local function of early returns (figure, then No Mark, then the reason words), matching T9AR.24-B2-F1. No test changed. `npx vitest run src/ui/cockpit/replay` exit 0, 233 passed; `npm run typecheck` exit 0; `npm run lint` (with verify:wording) exit 0. Lane tier: unit 2465 passed, integration 286 passed, 14 of 14 checks exit 0. |
