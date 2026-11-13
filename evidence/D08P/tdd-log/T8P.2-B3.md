# T8P.2-B3 TDD log (hand-written: the case is a shell test, which tdd.sh cannot run)

| Task | Case | Phase | Command | Outcome | Failure excerpt |
|---|---|---|---|---|---|
| T8P.2-B3 | it should list a multi-line title differently from a single-line title with the same words | red | `IT_TITLES=<pre-fix script from HEAD> .claude/scripts/it-titles.test.sh b3` (scratch tree: a backtick title broken over two lines, and the same words on one line) | exit 1 | `FAIL: b3: titles differ.` expected `m > should multi line` and `m > should multi\nline`, got `should multi line` twice |
| T8P.2-B3 | it should list a multi-line title differently from a single-line title with the same words | green | `.claude/scripts/it-titles.test.sh b3` against the Vitest-collection script (newline escaped as `\n`, backslash as `\\`) | exit 0 | `it-titles.test: all passed` |
| T8P.2-B3 | existing case b1 (from T8P.2-B1) | green | `.claude/scripts/it-titles.test.sh b1`, then the whole test | exit 0 | expectations moved to the new format: describe path, `skip: ` and `todo: ` prefixes, concrete it.each cases, no `it.only` prefix because Vitest does not keep that mode |
