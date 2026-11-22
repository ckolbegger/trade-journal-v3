# D9.5 provenance

Recorded 2026-11-22 at the session's location checks (handoff, section 1), on `claude-opus-5.5` at `c4faa392` (plan revision 115, tag `claude-opus-5.5-plan-r115`), code base `claude-opus-5.5-d9r2` (`73a48567`).

| Item | Value |
|---|---|
| Node | v26.12.0 |
| `npm ci` | exit 0 |
| `npx vitest run --project unit` | 227 files, 2688 tests passed |
| `npx vitest run tests/integration` | 141 files, 300 tests passed |
| `ocr llm test` | ✓ Connection test successful (provider chatgpt, model gpt-6.1-sol) |
| Ports 5175, 4175, 9341, 9342 | nothing listening |
