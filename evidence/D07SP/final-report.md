# D7S prefactor, One Mark-to-Market Valuation: final report

Completed 2026-11-11 and tagged `claude-opus-5.5-d7sp`. The work runs from `claude-opus-5.5-pre-d7sp`: 57 commits, all local, none pushed. The frozen plan is at revision 77.

## Tasks and commits

| Task | What | Commits |
|---|---|---|
| T7SP.1 | Domain: the expiration rules (`expiredOn`, `settlementDueOn`) | `0cc181aa` |
| T7SP.2 | Entry checks call the rules | `e6ac2f5f` |
| T7SP.3 | Contract status in `derive` | `e14f0cc8` |
| T7SP.4 | `evaluate` reads the status | `07449b9d` |
| T7SP.5 | Market Data read session (`openReadSession`) | `5438bfb7`; B1 `40442940`, B2 `f0316f62`, B3 `5921ea19`, B4 `3998e749` |
| T7SP.6 | Mark-to-Market Valuation module (`valueTrade`) | `23edc84b`; B1 `b5398b91` |
| T7SP.7 | Trade Views value through the module | `4f95ab6c` (decision 103); B1 `f9fea5ef` |
| T7SP.8 | Daily Review values through the module | `e8b78874`, `bc47a037` (decision 104); fix `6767ed6e` |
| T7SP.9 | Expiration-comparison lint rule | `552d0d06`; B1 `96660874`, B2 `e66521f6`, B3 `85121bb5` |
| T7SP.10 | Fixture views | `10f52cf2` (no fixture change) |
| T7SP.11 | Browser: the option dated line in the Review | `6c5687c2` |
| T7SP.12 | Trim the coordinator cases that moved | `85feaef2` |
| T7SP.13 | Trim D5R2's due-classification cases (tech debt item 4 resolved) | `982da791` |
| T7SP.16 | At-entry figures in Plan R (decision 105) | `8008446f`; expectations fix `daf2635e` |
| T7SP.17 | Detail carries held quantity and expiration line (decision 105) | `75aaee66` |
| T7SP.18 | Trade Detail reads the finished fields (decision 105) | `a719c7e5` |
| T7SP.19 | Read session scans gaps from the earliest exposure (decision 106) | `fc4fa791` |
| T7SP.14 | Latency harness (O3) | `f2b987dc` (first run), `9c0d14d0` (rerun); accepted, tech debt item 22 |
| T7SP.15 | Gate run, full tier | `t7sp-15-full` on `aa8c4056` |

**Gate run `t7sp-15-full`:**
- unit: 1481 of 1481;
- integration: 202 of 202;
- browser-1: 119 passed (4.8 m);
- browser-2: 65 passed (4.1 m);
- checks: 14 of 14 exit 0.

`src/persistence`, every fixture and every `dump.json` are unchanged since `claude-opus-5.5-pre-d7sp`.

## Decisions and revisions taken during the work

- **Decision 103, revision 73, T7SP.7:**
  - an expired contract's Detail reads no frame, so the due Detail's request list drops its frame reads (24 to 18);
  - Trade Views' unit cases that stubbed `marketData.query` were removed or rewritten at the session.
- **Decision 104, revision 74, T7SP.8:**
  - the session shares a date's snapshot, so `meta.get` counts hold;
  - Daily Review's stub cases moved to the session;
  - the dated line is on `getTrade`'s card only.
- **Decision 105, revision 75, during T7SP.12:** candidate 2, Trade Detail as a finished read, joins as T7SP.16 to T7SP.18.
- **Decision 106, revision 76, after T7SP.14's first run:** T7SP.19 scans gaps from the earliest exposure, not coverage start. T7SP.5-B1's case went from 1 read to 2.
- **Revision 77, no decision:** T7SP.14's remaining slowdowns were accepted and recorded as tech debt item 22.
- **D7S's numbering** starts at P90, A195 and decision 107. The next revision is r78.

## Latency against D7 (O3)

| Step (ms) | D7 (2026-11-08) | First run (before T7SP.19) | Final (runs 2 and 3) | Change |
|---|---|---|---|---|
| Cold start p95 (gated, 2,500) | 129.8 | 134.5 | 134.9 / 136.5 | +4–5% |
| Warm switch p95 (gated, 1,500) | 47.0 | 65.4 | 65.3 / 64.9 | +38% |
| Review status, before runs | 210 | 2014 | 309 / 321 | +47–53% |
| Review status, after runs | 206 | 1794 | 328 / 332 | +59–61% |
| First card, median | 154.9 | 1841.3 | 268.7 / 268.1 | +73% |
| First card, p95 | 165.7 | 1888.2 | 288.5 / 288.7 | +74% |
| Save Marks, median | 149.5 | 191.1 | 214.5 / 216.1 | +44% |
| Action save, median | 124.1 | 187.1 | 188.9 / 193.3 | +52–56% |
| Cold Action save, median | 132.0 | 239.8 | 228.5 / 227.2 | +72–73% |
| Closed page, median | 87.0 | 114.0 | 114.0 / 113.0 | +30–31% |
| Closed page, p95 | 163.0 | 122.0 | 120.0 / 116.0 | −26–29% |

- Both gated budgets pass, and every row comparison passes.
- T7SP.19 removed the 10x Review open regression.
- The rest is accepted as tech debt item 22. Its first proposed step is a same-machine control run of D7's code: no such control was made, so the environment's share of the slowdown is unknown.

## D8 follow-up

`plan/D08-backup-and-restore.md` has no hits for any of the eight names: `coordinators/valuation.ts`, `settlementTimeOf`, `instrumentsOf`, `afterExpiration`, `primaryFrameOf`, `evaluateCurrent`, `closedCurrent` and `currentFrames`. No revision is needed.

## Flagged items

**First-run passes.** Each failed by assertion under a mutation check:
- T7SP.3: three cases;
- T7SP.4: two, expected by the plan;
- T7SP.5: one;
- T7SP.6: two;
- T7SP.8: case 2 and three query-count cases;
- T7SP.11: the browser case;
- T7SP.17: cases 4 and 6.

**Existing expectations changed** (each additive, or sanctioned by a decision):
- T7SP.8: setup-only derives at a date (`evaluate-option.test.ts:166`, `option-detail-fixtures.ts`).
- T7SP.16: six whole-object `toEqual`s gained the two Plan-R fields. The plan's "no existing case changes" was a drafting miss.
- T7SP.17: `trade-summary.test.ts:154`'s key list and three typed builders gained `heldQuantity`.
- T7SP.18: `option-detail-fixtures.ts` gained `contractExpiration`. Its Open builder keys on "no Due item", where the coordinator keys on an empty list; this is test support only.
- T7SP.19: T7SP.5-B1's case, sanctioned by decision 106.

**Behaviour notes:**
- `getTrade` derives the Trade twice (T7SP.8).
- An expired or no-Position Detail with a Debt still makes a closes read outside the binding (T7SP.7-B1). Removing it needs a spec change.
- A Closed Trade is valued at the UTC date of its terminal instant (unchanged from Trade Views).
- `ClosedTradeDetail` inherits `heldQuantity` (0).
- The lint rule's known limits: more than 3 stacked wrappers, and template-literal keys.

**Reviewer notes (not ocr findings, so no bug tasks):**
- T7SP.12 and T7SP.13: coverage notes.
- T7SP.19: a Mark saved between two scans of one Instrument in one session leaves `gapKeys` holding the later scan's revision. This is Doubtful.

**Dismissed ocr findings:** T7SP.3, T7SP.5 and T7SP.5-B1 (style or wrong), and T7SP.8 (a dateless `evaluate`, which A192 rules out).

**Tech debt triggers:** item 11 (`TradeList.test.tsx:125`) and item 1 (the Review save recheck) never fired. Item 4 is resolved. Item 22 is new.

Details of every item are in `evidence/D07SP/structural.md`, `tdd-log.md` and the handoff's open questions.
