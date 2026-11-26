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

## Session of 2026-11-26

Recorded at the location checks of the session that took over the 2026-11-22 lock at the user's word (the previous session was paused by the user on 2026-11-25), on `claude-opus-5.5` at `f096250f` (latest plan tag `claude-opus-5.5-plan-r121`).

| Item | Value |
|---|---|
| Node | v26.12.0 |
| `npm ci` | exit 0 |
| `npx vitest run --project unit` | 258 files, 3113 tests passed |
| `npx vitest run tests/integration` | 158 files, 368 tests passed |
| `ocr llm test` | fails: it tests ocr's default provider (Anthropic API), which is past its usage limit until 2026-12-01. ocr reviews use `--provider chatgpt`; a one-commit ChatGPT review of `a518f759` completed the same evening with no failed items (account chris.kolbegger@gmail.com, switched at the user's request) |
| Ports 5175, 4175, 9341, 9342 | nothing listening |
