# T8P.23-B14-B1 TDD log (hand-written: the cases are Playwright browser specs, which tdd.sh cannot run)

Cases (`e2e/d8p/today-narrow.spec.ts`, each at 375 and 320 px): the option case (B14's, now also asserting that no space-separated token of any cell sits on two lines) and the stock case with Marks $418.60 and $412.35 and a change of −$6.25.

| Task | Case | Phase | Command | Outcome | Failure excerpt |
|---|---|---|---|---|---|
| T8P.23-B14-B1 | option case and stock case | red | `.claude/scripts/with-browser-lock.sh npx playwright test e2e/d8p/today-narrow.spec.ts` (B14's CSS, `overflow-wrap: anywhere`) | 2 failed | `tokens broken across lines at 375 px`, received `["Mark", "Mark"]` (the row label split mid-word) |
| T8P.23-B14-B1 | same | green | same, after: `overflow-wrap: normal`; `.whole` nowrap spans around each word of a provenance and nowrap on figures and Change; tighter padding and 0.72rem provenance and header; the scroll box kept at its right end (`ScrollsToEnd`) | 2 passed, also with `--repeat-each 3` (6 passed) | |
| T8P.23-B14-B1 | intermediate | note | same, before `ScrollsToEnd` | 2 failed | `cells outside the scroll box at 320 px`: `"Change 288 > 283"` (the unbreakable table is 5 px too wide at 320 px, so the fit alone does not hold) |
| T8P.23-B14-B1 | refactor | refactor | n/a | none beyond the above | |
