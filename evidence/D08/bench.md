# D8 benchmark run (AC-PERF-001)

D7's latency and correctness harness, unchanged, on the profile `bench:setup` restored from the benchmark artifact through the production first-run Restore (D8 T8.19).

Written by `npm run bench:run` (T2.21, extended by T4.31, T5.22, T5R.13, T6.25, T7.29 and T8.19) on 2026-11-15T14:02:05.770Z, at commit e339d0bf5774376091b7176aef49d388488999f1 plus uncommitted changes to src, tools, bench or package.json.

## Result

| Measure | Runs | Nearest-rank p95 (29th of 30) | Budget | Result |
|---|---|---|---|---|
| Cold start to `tj:interactive` | 30 | 144.8 ms | 2,500 ms | pass |
| Warm Planned-to-Open switch to `tj:open-list-ready` | 30 | 61.7 ms | 1,500 ms | pass |

Open list compared with `bench/expected-open-rows.json`: before the runs 200 rows equal, after the runs 200 rows equal, and each of the 30 cold starts rendered the same 200 rows (figures included). The 10 Missing Instruments on the as-of date (ADBE, AVGO, NKE, QAD, QAM, QAV, QBE, QBN, QBW, UNH) have rows in that list, each showing `Mark missing` in P&L (and no other row does).

## As-of Review's due reflections (T5.22)

The harness opens the Review from the primary navigation and reads its blockers: each "Reflection due for X" or "N reflections due for X" is a reflection due at the as-of Review (X names the Trade in full; the harness compares its underlying symbol) (Review Date 2026-11-20). The expected values are `asOfDueReflections` and the Trades of `outstandingDebts` in `bench/dataset.json` (the Outstanding Debts are from 2026-10-30 and 2026-10-30 and 2026-10-30 and 2026-10-30 and 2026-10-30 and 2026-10-30 and 2026-10-30 and 2026-10-30 and 2026-10-30 and 2026-10-30 and 2026-10-30 and 2026-10-30 and 2026-10-30 and 2026-10-30 and 2026-10-30 and 2026-10-30 and 2026-10-30 and 2026-10-30 and 2026-10-30 and 2026-11-02 and 2026-11-02 and 2026-11-02 and 2026-11-02 and 2026-11-02 and 2026-11-02 and 2026-11-02 and 2026-11-02 and 2026-11-02 and 2026-11-02 and 2026-11-02 and 2026-11-02 and 2026-11-02 and 2026-11-02 and 2026-11-02 and 2026-11-02 and 2026-11-02 and 2026-11-02 and 2026-11-02 and 2026-11-02 and 2026-11-02 and 2026-11-02 and 2026-11-02 and 2026-11-02 and 2026-11-02 and 2026-11-02 and 2026-11-02 and 2026-11-02 and 2026-11-02 and 2026-11-02 and 2026-11-02 and 2026-11-02 and 2026-11-02 and 2026-11-02 and 2026-11-02 and 2026-11-02 and 2026-11-02 and 2026-11-02 and 2026-11-02 and 2026-11-02 and 2026-11-02 and 2026-11-02 and 2026-11-02 and 2026-11-02 and 2026-11-02 and 2026-11-02 and 2026-11-02 and 2026-11-02 and 2026-11-02 and 2026-11-02 and 2026-11-02 and 2026-11-02 and 2026-11-02 and 2026-11-02 and 2026-11-02 and 2026-11-02 and 2026-11-02 and 2026-11-02 and 2026-11-02 and 2026-11-02 and 2026-11-02 and 2026-11-02 and 2026-11-02 and 2026-11-02 and 2026-11-02 and 2026-11-02 and 2026-11-02 and 2026-11-02 and 2026-11-02 and 2026-11-02 and 2026-11-02 and 2026-11-02 and 2026-11-02 and 2026-11-02 and 2026-11-02 and 2026-11-02 and 2026-11-02 and 2026-11-02 and 2026-11-02 and 2026-11-02 and 2026-11-02 and 2026-11-02 and 2026-11-02 and 2026-11-02 and 2026-11-02 and 2026-11-02 and 2026-11-02 and 2026-11-02 and 2026-11-02 and 2026-11-02 and 2026-11-02 and 2026-11-02 and 2026-11-02 and 2026-11-02 and 2026-11-02 and 2026-11-02 and 2026-11-02 and 2026-11-02 and 2026-11-02 and 2026-11-02 and 2026-11-02 and 2026-11-02 and 2026-11-02 and 2026-11-02 and 2026-11-02 and 2026-11-02 and 2026-11-02 and 2026-11-02 and 2026-11-02 and 2026-11-02 and 2026-11-02 and 2026-11-02 and 2026-11-02 and 2026-11-02 and 2026-11-02 and 2026-11-02 and 2026-11-02 and 2026-11-02 and 2026-11-02 and 2026-11-02 and 2026-11-02 and 2026-11-02 and 2026-11-02 and 2026-11-02 and 2026-11-02 and 2026-11-02 and 2026-11-02 and 2026-11-02 and 2026-11-02 and 2026-11-02 and 2026-11-02 and 2026-11-02 and 2026-11-02 and 2026-11-02 and 2026-11-02 and 2026-11-02 and 2026-11-02 and 2026-11-02 and 2026-11-02 and 2026-11-02 and 2026-11-02 and 2026-11-02 and 2026-11-02 and 2026-11-02 and 2026-11-02 and 2026-11-02 and 2026-11-02 and 2026-11-02 and 2026-11-03 and 2026-11-03 and 2026-11-03 and 2026-11-03 and 2026-11-03 and 2026-11-03 and 2026-11-03 and 2026-11-03 and 2026-11-03 and 2026-11-03 and 2026-11-03 and 2026-11-03 and 2026-11-03 and 2026-11-03 and 2026-11-03 and 2026-11-03 and 2026-11-03 and 2026-11-03 and 2026-11-03 and 2026-11-03 and 2026-11-03 and 2026-11-03 and 2026-11-03 and 2026-11-03 and 2026-11-03 and 2026-11-03 and 2026-11-03 and 2026-11-03 and 2026-11-03 and 2026-11-03 and 2026-11-03 and 2026-11-03 and 2026-11-03 and 2026-11-03 and 2026-11-03 and 2026-11-03 and 2026-11-03 and 2026-11-03 and 2026-11-03 and 2026-11-03 and 2026-11-03 and 2026-11-03 and 2026-11-03 and 2026-11-03 and 2026-11-03 and 2026-11-03 and 2026-11-03 and 2026-11-03 and 2026-11-03 and 2026-11-03 and 2026-11-03 and 2026-11-03 and 2026-11-03 and 2026-11-03 and 2026-11-03 and 2026-11-03 and 2026-11-03 and 2026-11-03 and 2026-11-03 and 2026-11-03 and 2026-11-03 and 2026-11-03 and 2026-11-03 and 2026-11-03 and 2026-11-03 and 2026-11-03 and 2026-11-03 and 2026-11-03 and 2026-11-03 and 2026-11-03 and 2026-11-03 and 2026-11-03 and 2026-11-03 and 2026-11-03 and 2026-11-03 and 2026-11-03 and 2026-11-03 and 2026-11-03 and 2026-11-03 and 2026-11-03 and 2026-11-03 and 2026-11-03 and 2026-11-03 and 2026-11-03 and 2026-11-03 and 2026-11-03 and 2026-11-03 and 2026-11-03 and 2026-11-03 and 2026-11-03 and 2026-11-03 and 2026-11-03 and 2026-11-03 and 2026-11-03 and 2026-11-03 and 2026-11-03 and 2026-11-03 and 2026-11-03 and 2026-11-03 and 2026-11-03 and 2026-11-03 and 2026-11-03 and 2026-11-03 and 2026-11-03 and 2026-11-03 and 2026-11-03 and 2026-11-03 and 2026-11-03 and 2026-11-03 and 2026-11-03 and 2026-11-03 and 2026-11-03 and 2026-11-03 and 2026-11-03 and 2026-11-03 and 2026-11-03 and 2026-11-03 and 2026-11-03 and 2026-11-03 and 2026-11-03 and 2026-11-03 and 2026-11-03 and 2026-11-03 and 2026-11-03 and 2026-11-03 and 2026-11-03 and 2026-11-03 and 2026-11-03 and 2026-11-03 and 2026-11-03 and 2026-11-03 and 2026-11-03 and 2026-11-03 and 2026-11-03 and 2026-11-04 and 2026-11-04 and 2026-11-04 and 2026-11-04 and 2026-11-04 and 2026-11-04 and 2026-11-04 and 2026-11-04 and 2026-11-04 and 2026-11-04 and 2026-11-04 and 2026-11-04 and 2026-11-04 and 2026-11-04 and 2026-11-04 and 2026-11-04 and 2026-11-04 and 2026-11-04 and 2026-11-04 and 2026-11-04 and 2026-11-04 and 2026-11-04 and 2026-11-04 and 2026-11-04 and 2026-11-04 and 2026-11-04 and 2026-11-04 and 2026-11-04 and 2026-11-04 and 2026-11-04 and 2026-11-04 and 2026-11-04 and 2026-11-04 and 2026-11-04 and 2026-11-04 and 2026-11-04 and 2026-11-04 and 2026-11-04 and 2026-11-04 and 2026-11-04 and 2026-11-04 and 2026-11-04 and 2026-11-04 and 2026-11-04 and 2026-11-04 and 2026-11-04 and 2026-11-04 and 2026-11-04 and 2026-11-04 and 2026-11-04 and 2026-11-04 and 2026-11-04 and 2026-11-04 and 2026-11-04 and 2026-11-04 and 2026-11-04 and 2026-11-04 and 2026-11-04 and 2026-11-04 and 2026-11-04 and 2026-11-04 and 2026-11-04 and 2026-11-04 and 2026-11-04 and 2026-11-04 and 2026-11-04 and 2026-11-04 and 2026-11-04 and 2026-11-04 and 2026-11-04 and 2026-11-04 and 2026-11-04 and 2026-11-04 and 2026-11-04 and 2026-11-04 and 2026-11-04 and 2026-11-04 and 2026-11-04 and 2026-11-04 and 2026-11-04 and 2026-11-04 and 2026-11-04 and 2026-11-04 and 2026-11-04 and 2026-11-04 and 2026-11-04 and 2026-11-04 and 2026-11-04 and 2026-11-04 and 2026-11-04 and 2026-11-04 and 2026-11-04 and 2026-11-04 and 2026-11-04 and 2026-11-04 and 2026-11-04 and 2026-11-04 and 2026-11-04 and 2026-11-04 and 2026-11-04 and 2026-11-04 and 2026-11-04 and 2026-11-05 and 2026-11-05 and 2026-11-05 and 2026-11-05 and 2026-11-05 and 2026-11-05 and 2026-11-05 and 2026-11-05 and 2026-11-05 and 2026-11-05 and 2026-11-05 and 2026-11-05 and 2026-11-05 and 2026-11-05 and 2026-11-05 and 2026-11-05 and 2026-11-05 and 2026-11-05 and 2026-11-05 and 2026-11-05 and 2026-11-05 and 2026-11-05 and 2026-11-05 and 2026-11-05 and 2026-11-05 and 2026-11-05 and 2026-11-05 and 2026-11-05 and 2026-11-05 and 2026-11-05 and 2026-11-05 and 2026-11-05 and 2026-11-05 and 2026-11-05 and 2026-11-05 and 2026-11-05 and 2026-11-05 and 2026-11-05 and 2026-11-05 and 2026-11-05 and 2026-11-05 and 2026-11-05 and 2026-11-05 and 2026-11-05 and 2026-11-05 and 2026-11-05 and 2026-11-05 and 2026-11-05 and 2026-11-05 and 2026-11-05 and 2026-11-05 and 2026-11-05 and 2026-11-05 and 2026-11-05 and 2026-11-05 and 2026-11-06 and 2026-11-06 and 2026-11-06 and 2026-11-06 and 2026-11-06 and 2026-11-06 and 2026-11-06 and 2026-11-06 and 2026-11-06 and 2026-11-06 and 2026-11-06 and 2026-11-06 and 2026-11-06 and 2026-11-06 and 2026-11-06 and 2026-11-06 and 2026-11-06 and 2026-11-06 and 2026-11-06 and 2026-11-06 and 2026-11-06 and 2026-11-06 and 2026-11-06 and 2026-11-06 and 2026-11-06 and 2026-11-06 and 2026-11-06 and 2026-11-06 and 2026-11-09, both due at the as-of Review, decision 58). A difference fails the run.

| When | Due reflections listed (by Trade) | Expected | Result | Time from the click on Review to its status (disclosed, not gated) |
|---|---|---|---|---|
| before the runs | 487 (QAI 5, QAJ 5, QAH 3, QAE 7, QAR 3, GS 9, QAQ 4, QCOM 12, QAL 4, QAK 5, QAF 7, QAS 3, QAC 4, QAA 6, DE 13, BA 6, MCD 5, TXN 9, INTC 12, AMD 7, PEP 4, ABBV 10, CVX 7, KO 7, NVDA 10, QBV 3, QAT 3, QAB 3, CAT 12, QAN 2, ORCL 5, MRK 3, LLY 12, XOM 7, HD 13, QAG 4, V 11, PFE 9, CSCO 9, META 10, AMZN 4, MSFT 9, AAPL 7, QBQ 3, QBC 3, QAY 3, PG 10, NFLX 11, GOOGL 3, QBU 2, QBS 2, QBP 2, QBL 2, QBI 2, QBD 2, QBB 2, QAX 2, CRM 13, QAO 3, QBO 1, QBJ 1, QBA 1, QAW 1, QAU 1, QAP 3, MA 7, COST 6, DIS 14, TSLA 11, WMT 6, JPM 10, QBX 1, QBR 2, QBG 2, QAZ 2, QBT 1, QBF 1, QAM 2, NKE 13, ADBE 11, QAD 4, UNH 8, AVGO 6, QBW 2, QBN 2, QBE 2, QBK 2, QBM 3, QBH 3) | 487 (CVX 7, LLY 12, WMT 6, AAPL 7, KO 7, PFE 9, QCOM 12, TXN 9, NVDA 10, CSCO 9, ABBV 10, MSFT 9, JPM 10, PG 10, MRK 3, ADBE 11, INTC 12, DIS 14, NKE 13, MCD 5, CAT 12, GOOGL 3, META 10, TSLA 11, AVGO 6, NFLX 11, V 11, MA 7, UNH 8, HD 13, PEP 4, CRM 13, ORCL 5, AMD 7, BA 6, DE 13, GS 9, COST 6, XOM 7, QAA 6, QAB 3, QAC 4, QAE 7, QAF 7, QAG 4, QAI 5, QAJ 5, QAK 5, QAL 4, QAN 2, QAO 3, QAP 3, QAQ 4, QAS 3, QAT 3, QAU 1, QAW 1, QAX 2, QAY 3, QAZ 2, QBA 1, QBB 2, QBC 3, QBD 2, QBE 2, QBF 1, QBG 2, QBH 3, QBI 2, QBJ 1, QBK 2, QBL 2, QBM 3, QBN 2, QBO 1, QBP 2, QBQ 3, QBR 2, QBS 2, QBT 1, QBU 2, AMZN 4, QBV 3, QBW 2, QBX 1, QAD 4, QAH 3, QAM 2, QAR 3) | equal | 361 ms |
| after the runs | 487 (QAI 5, QAJ 5, QAH 3, QAE 7, QAR 3, GS 9, QAQ 4, QCOM 12, QAL 4, QAK 5, QAF 7, QAS 3, QAC 4, QAA 6, DE 13, BA 6, MCD 5, TXN 9, INTC 12, AMD 7, PEP 4, ABBV 10, CVX 7, KO 7, NVDA 10, QBV 3, QAT 3, QAB 3, CAT 12, QAN 2, ORCL 5, MRK 3, LLY 12, XOM 7, HD 13, QAG 4, V 11, PFE 9, CSCO 9, META 10, AMZN 4, MSFT 9, AAPL 7, QBQ 3, QBC 3, QAY 3, PG 10, NFLX 11, GOOGL 3, QBU 2, QBS 2, QBP 2, QBL 2, QBI 2, QBD 2, QBB 2, QAX 2, CRM 13, QAO 3, QBO 1, QBJ 1, QBA 1, QAW 1, QAU 1, QAP 3, MA 7, COST 6, DIS 14, TSLA 11, WMT 6, JPM 10, QBX 1, QBR 2, QBG 2, QAZ 2, QBT 1, QBF 1, QAM 2, NKE 13, ADBE 11, QAD 4, UNH 8, AVGO 6, QBW 2, QBN 2, QBE 2, QBK 2, QBM 3, QBH 3) | 487 (CVX 7, LLY 12, WMT 6, AAPL 7, KO 7, PFE 9, QCOM 12, TXN 9, NVDA 10, CSCO 9, ABBV 10, MSFT 9, JPM 10, PG 10, MRK 3, ADBE 11, INTC 12, DIS 14, NKE 13, MCD 5, CAT 12, GOOGL 3, META 10, TSLA 11, AVGO 6, NFLX 11, V 11, MA 7, UNH 8, HD 13, PEP 4, CRM 13, ORCL 5, AMD 7, BA 6, DE 13, GS 9, COST 6, XOM 7, QAA 6, QAB 3, QAC 4, QAE 7, QAF 7, QAG 4, QAI 5, QAJ 5, QAK 5, QAL 4, QAN 2, QAO 3, QAP 3, QAQ 4, QAS 3, QAT 3, QAU 1, QAW 1, QAX 2, QAY 3, QAZ 2, QBA 1, QBB 2, QBC 3, QBD 2, QBE 2, QBF 1, QBG 2, QBH 3, QBI 2, QBJ 1, QBK 2, QBL 2, QBM 3, QBN 2, QBO 1, QBP 2, QBQ 3, QBR 2, QBS 2, QBT 1, QBU 2, AMZN 4, QBV 3, QBW 2, QBX 1, QAD 4, QAH 3, QAM 2, QAR 3) | equal | 334 ms |

## Card timings (T5R.13, disclosed, not gated)

Each is the time from the pointer press to the rendered result, on the mature dataset above. The thresholds in the first table are the only gates.

| Measure | Runs | Median | Nearest-rank p95 | Min | Max |
|---|---|---|---|---|---|
| Open the first card (press on Review to the first card's content: `open` plus one `getTrade`) | 10 | 303.6 ms | 327.4 ms | 286.5 ms | 327.4 ms |
| Save Marks of one card's Marks (press on Save Marks to the card's drafts cleared) | 5 | 178.2 ms | 183.9 ms | 176.1 ms | 183.9 ms |
| Trade Action save (press on Save in the Action form to the form replaced by the result) | 5 | 186.6 ms | 187.8 ms | 185.3 ms | 187.8 ms |

- **Against D5 and D5R2:** D5 measured the cold start at 104.8 ms and the warm switch at 43.6 ms (p95), D5R2 96.2 ms and 47.3 ms on the same generator-3 dataset; this run's are 144.8 ms and 61.7 ms. D5 timed the press on Review to the Review's status at 2342 ms before its runs and 2225 ms after (single measurements); opening the first card here, which adds the first Trade's `getTrade`, takes a median of 303.6 ms.
- **Tech debt item 3** (the Review's open cost grows with history) is measured here, not fixed: D5R takes the save path off it (P38) but not the first `open` of each Review, and the open-the-first-card timing is its baseline.
- **The saves** are timed on cards of the cached profile's copy: Save Marks on ADBE, Save Marks on AVGO, Save Marks on NKE, Save Marks on QAD, Save Marks on QAM; and a Hold Action on AMZN tr-24710, NVDA tr-24702, MSFT tr-24701, AAPL tr-24700, QAR tr-24784. A Marks save fills the Instrument's Missing Review-date Mark with 51.00. The dataset holds an Action for every Trade on the Review Date, so each Action save is an edit of the saved Action (Change, Hold, an Intent of "bench edit", Save): each is a `SaveTradeAction` with the entry's expected revision, with the same post-save rebuild as a first save. The Review is opened afresh before each, which is not timed.
- **Raw timings (ms, in run order):** open the first card 286.5, 304.1, 299.3, 326.5, 301.0, 323.5, 299.7, 324.8, 303.1, 327.4; Save Marks 183.9, 176.1, 178.6, 178.2, 178.2; Trade Action save 185.4, 185.3, 186.6, 187.8, 186.8.
- **Method:** a MutationObserver in the page reads the real clock on the first DOM change after which the result holds (the card's content shown with no card still loading; the card's Save Marks counting no drafts; the card's Action form gone with no card still loading), and a capture-phase pointer press records the start on the same clock.

## Closed page, Review walk and owed group (T6.25)

- **Closed page.** The generator records no Closed page, so the expected first page is derived from the stored data: the first 50 Closed Trades of the profile's `byLifecycleTerminal` index (terminal time descending), read raw in the page before any timed run. Each rendered row (its Trade from the link, Underlying and Close date in America/New_York) must equal the stored Trade's, in order, before the runs (50 rows equal) and after them (50 rows equal), and at each of the 10 renders below. Realized figures, Disposition and Close Reason are not compared (the stored Trade does not hold them).
- **Review walk and owed group.** The as-of Review's cards must equal `asOfReview` in `bench/dataset.json`, in order, each by its Trade (`data-trade-id`) and Underlying (the walked Trades' Underlyings are read from the stored Trades, the owed group's are the dataset's):before the runs 200 walked and 99 owed cards equal; after the runs 200 walked and 99 owed cards equal. The owed group's Debt identities are not rendered, so they are not compared here; the Trades and their order are.

- **Settlement family (T7.29).** The as-of Review's "Settlement Due for ..." blockers must equal `asOfReview.settlement` in `bench/dataset.json`, in the Review's order, each by its Trade (from the blocker's link), contract, open quantity (read from the Settlement panel the link opens) and expiration date: before the runs 4 items equal; after the runs 4 items equal. The Open list's rows, option figures and dated lines included, are the `bench/expected-open-rows.json` comparison in the first section; the profile holds 7500 option Trades of 25000 and 60 Open ones.

| Measure (disclosed, not gated) | Runs | Median | Nearest-rank p95 | Min | Max |
|---|---|---|---|---|---|
| Closed tab to its first page (50 rows; press on Trades, then Closed, to the last row rendered) | 10 | 114.5 ms | 125.0 ms | 102.0 ms | 125.0 ms |

## Daily Trade Review Action save (requested measurement, disclosed, not gated; not in the plan's T6.25 row)

A single Action save on a card of the as-of Review (Change, Hold, an Intent, Save: a `SaveTradeAction` with the entry's expected revision, so the Review's post-save rebuild is included), from the press on Save to the form replaced by the result. Generator 5's Review save grew by about 1 ms per session in Chromium; this shows its cost at the mature profile. **Warm** is the five saves of the card timings above, in one long-lived page. **Cold** is one save on each of 3 fresh browser processes (offline, from the service worker), on a card no warm save used, the Review opened afresh first (not timed). These figures are not gated; only the two p95 above are.

| Save | Runs | Median | Nearest-rank p95 | Min | Max |
|---|---|---|---|---|---|
| Warm | 5 | 186.6 ms | 187.8 ms | 185.3 ms | 187.8 ms |
| Cold | 3 | 226.5 ms | 232.8 ms | 223.8 ms | 232.8 ms |

Raw (ms): warm 185.4, 185.3, 186.6, 187.8, 186.8; cold PEP tr-24780 226.5, MRK tr-24772 232.8, QAH tr-24768 223.8; closed page renders 124.0, 113.0, 102.0, 124.0, 123.0, 113.0, 125.0, 115.0, 114.0, 113.0.

## Restore, capacity and backup timings (D8 T8.19)

The benchmark artifact (digest `6d819703928c5aa37ec3e9181b4ba164b325846296cf015f9412715cc894304b`, 20,869,684 bytes (19.9 MiB)) was restored through the production first-run Restore in a fresh Chromium profile: 0 issues, 0 repairs.

| Step | Result |
| --- | --- |
| First-run Restore, prepare (choose file to preview) | 90.5 s |
| First-run Restore, apply (Replace to Restore complete) | 5.9 s |
| Restored Workspace `estimate().usage` | 206,540,122 bytes (197.0 MiB) |
| Projection for the same counts | 781,961,664 bytes (745.7 MiB) |
| Usage over projection (limit 1.10) | 0.264: pass |
| Peak usage during a second Restore over the restored Workspace | 439,119,065 bytes (418.8 MiB) |
| M, the mature projection | 912,516,132 bytes (870.2 MiB) |
| Peak over M (limit below 3) | 0.481: pass |
| One export of the mature dataset (Download backup) | 21.9 s, 20,871,394 bytes (19.9 MiB) |
| One verification of that export (Verify backup) | 12.2 s |

The usage samples are taken every 250 ms (402 samples during the second Restore); the peak is the largest sample. The projection for the same counts prices the dataset's counts with the chromium measurement's bytes per record (tools/bench/restore-checks.ts `projectForDataset`); it leaves out the Allowances, which the dataset does not hold. M is the mature projection embedded in the release. The export and verification timings are disclosed, not gated.

## Method

- Playwright's clock also swaps `window.performance` for a fake that records no marks, so the harness keeps the real object before the pin and points the fake's `mark` at it; `performance.now` and timers are the real ones.
- `Date` is pinned to the dataset's as-of instant (2026-11-20T22:00:00.000Z, A52) with Playwright `context.clock.setFixedTime`, and native `Temporal.Now.instant` (the application's clock) is pointed at it (T4.31-B1); every comparison first checks both read the as-of instant and that exactly the Missing Instruments' rows show `Mark missing`. Timers and `performance.now` are real, and the build is production.
- A copy of the cached profile (`.cache/bench/profile`, generator 8, schema 7) per run of the harness; the cached profile itself is never opened.
- The production build (`dist/`) served by the release harness server at http://localhost:4175, the origin the profile's IndexedDB belongs to.
- One warm-up launch, online, installs the service worker and is excluded. The server is then stopped and every later launch is offline (Playwright `offline: true`), so the app loads from the service worker and IndexedDB only.
- Cold start: the Chromium process is launched on the profile, navigates to the origin, and the time is the `tj:interactive` mark's `startTime` (from navigation start; readiness Writable and the Open list fully rendered with every row's figures, each run's rendered list compared with the expected rows afterwards); the process is then closed. The time from the call that launches the browser process to the same mark is recorded beside it for disclosure and is not gated.
- Warm switch: in one launched page, the Planned tab is opened and its first page rendered, then the Open tab is clicked; the time runs from the pointer press on the Open tab to the next `tj:open-list-ready` mark.

## Raw timings (ms, in run order)

| Run | Cold (navigation start to mark) | Cold, disclosed: process launch to mark | Warm |
|---|---|---|---|
| 1 | 374.3 | 460.5 | 55.3 |
| 2 | 136.3 | 223.5 | 54.6 |
| 3 | 138.8 | 216.6 | 59.6 |
| 4 | 138.9 | 226.0 | 61.2 |
| 5 | 137.9 | 224.2 | 64.8 |
| 6 | 138.8 | 227.4 | 56.9 |
| 7 | 140.1 | 222.1 | 58.6 |
| 8 | 143.1 | 224.4 | 53.1 |
| 9 | 139.6 | 217.2 | 60.2 |
| 10 | 136.7 | 216.5 | 55.0 |
| 11 | 139.5 | 217.8 | 54.4 |
| 12 | 138.7 | 215.6 | 54.9 |
| 13 | 141.9 | 223.1 | 61.3 |
| 14 | 136.2 | 207.5 | 58.3 |
| 15 | 140.2 | 221.1 | 52.7 |
| 16 | 135.9 | 214.4 | 55.4 |
| 17 | 127.3 | 206.5 | 54.3 |
| 18 | 136.3 | 217.3 | 55.7 |
| 19 | 122.4 | 215.4 | 61.5 |
| 20 | 137.0 | 222.3 | 52.9 |
| 21 | 136.2 | 241.7 | 57.4 |
| 22 | 144.8 | 229.4 | 60.5 |
| 23 | 137.9 | 216.9 | 56.4 |
| 24 | 137.7 | 221.7 | 52.7 |
| 25 | 140.2 | 230.0 | 54.3 |
| 26 | 136.6 | 224.3 | 54.8 |
| 27 | 138.2 | 210.0 | 54.3 |
| 28 | 135.0 | 216.1 | 56.7 |
| 29 | 139.6 | 221.4 | 61.7 |
| 30 | 140.3 | 225.2 | 52.6 |

Sorted cold: 122.4, 127.3, 135.0, 135.9, 136.2, 136.2, 136.3, 136.3, 136.6, 136.7, 137.0, 137.7, 137.9, 137.9, 138.2, 138.7, 138.8, 138.8, 138.9, 139.5, 139.6, 139.6, 140.1, 140.2, 140.2, 140.3, 141.9, 143.1, 144.8, 374.3

Process launch to mark (not gated): p95 241.7 ms.

Sorted warm: 52.6, 52.7, 52.7, 52.9, 53.1, 54.3, 54.3, 54.3, 54.4, 54.6, 54.8, 54.9, 55.0, 55.3, 55.4, 55.7, 56.4, 56.7, 56.9, 57.4, 58.3, 58.6, 59.6, 60.2, 60.5, 61.2, 61.3, 61.5, 61.7, 64.8

## Environment

| Item | Value |
|---|---|
| Hardware | Apple M4 Max, 16 cores, 64 GiB memory, arm64 |
| OS | Darwin 25.6.0 (darwin) |
| Browser engine | Chromium 153.0.8010.12, headless, via Playwright 1.63.0 |
| Node | v26.12.0 |

## Dataset provenance (`bench/dataset.json`)

```json
{
  "generatorVersion": 8,
  "schemaVersion": 7,
  "seed": 20211011,
  "clockStart": "2024-01-02T13:00:00Z",
  "timeZone": "America/New_York",
  "asOf": "2026-11-20T22:00:00Z",
  "reviewDate": "2026-11-20",
  "missingInstruments": [
    "ADBE",
    "AVGO",
    "NKE",
    "QAD",
    "QAM",
    "QAV",
    "QBE",
    "QBN",
    "QBW",
    "UNH"
  ],
  "counts": {
    "trades": 25000,
    "openTrades": 200,
    "plannedTrades": 100,
    "closedTrades": 24700,
    "positionChanges": 97127,
    "executions": 187435,
    "institutions": 3,
    "accounts": 6,
    "strategies": 4,
    "marks": 106985,
    "markCorrections": 1069,
    "acknowledgments": 0,
    "planReflectionEntries": 25000,
    "positionChangeReflectionEntries": 80616,
    "positionChangeReflectionDeclines": 16123,
    "actions": 130234,
    "editedActions": 2605,
    "debts": 24365,
    "debtsSettled": 21929,
    "debtsDeclined": 1949,
    "debtsOutstanding": 487,
    "closeReviewEntries": 20501,
    "closeReviewDeclines": 4100,
    "closeReviewDebts": 4940,
    "closeReviewDebtsSettled": 4446,
    "closeReviewDebtsDeclined": 395,
    "closeReviewDebtsOutstanding": 99,
    "optionTrades": 7500,
    "longCalls": 3000,
    "longPuts": 2000,
    "cashSecuredPuts": 2500,
    "exerciseIntentPlans": 5000,
    "authorizedPlans": 500,
    "expirations": 2964,
    "expirationsAfterPartialExit": 891,
    "openOptionTrades": 60,
    "sessions": 726,
    "openInstruments": 150,
    "sharedInstruments": 50,
    "closeReasons": {
      "Target Reached": 5928,
      "Stop Triggered": 7163,
      "Thesis Invalidated": 3705,
      "Time-Based Exit": 4940
    },
    "openContracts": 60,
    "openStockInstruments": 90,
    "optionUnderlyingsHeldAsStock": 60,
    "instrumentsPerSessionMean": 147.4,
    "instrumentsPerSessionMax": 160
  },
  "actionsByChoice": {
    "Exit": 6512,
    "Roll": 6512,
    "Adjust": 6512,
    "Hold": 110698
  },
  "dispositions": {
    "complete": 63133,
    "declined": 14569,
    "answered": 17483,
    "declinedLater": 1554,
    "outstanding": 388
  },
  "closeReviewDispositions": {
    "complete": 16055,
    "declined": 3705,
    "answered": 4446,
    "declinedLater": 395,
    "outstanding": 99
  },
  "asOfReview": {
    "walk": [
      "tr-24710",
      "tr-24702",
      "tr-24701",
      "tr-24700",
      "tr-24898",
      "tr-24899",
      "tr-24897",
      "tr-24894",
      "tr-24890",
      "tr-24886",
      "tr-24882",
      "tr-24874",
      "tr-24870",
      "tr-24862",
      "tr-24895",
      "tr-24891",
      "tr-24889",
      "tr-24887",
      "tr-24885",
      "tr-24883",
      "tr-24879",
      "tr-24875",
      "tr-24873",
      "tr-24869",
      "tr-24865",
      "tr-24863",
      "tr-24861",
      "tr-24858",
      "tr-24850",
      "tr-24846",
      "tr-24842",
      "tr-24834",
      "tr-24830",
      "tr-24826",
      "tr-24892",
      "tr-24888",
      "tr-24884",
      "tr-24872",
      "tr-24868",
      "tr-24864",
      "tr-24859",
      "tr-24857",
      "tr-24855",
      "tr-24851",
      "tr-24849",
      "tr-24847",
      "tr-24845",
      "tr-24837",
      "tr-24835",
      "tr-24833",
      "tr-24829",
      "tr-24822",
      "tr-24818",
      "tr-24798",
      "tr-24794",
      "tr-24860",
      "tr-24856",
      "tr-24852",
      "tr-24844",
      "tr-24836",
      "tr-24832",
      "tr-24825",
      "tr-24823",
      "tr-24821",
      "tr-24817",
      "tr-24813",
      "tr-24807",
      "tr-24799",
      "tr-24797",
      "tr-24793",
      "tr-24791",
      "tr-24790",
      "tr-24786",
      "tr-24782",
      "tr-24778",
      "tr-24774",
      "tr-24770",
      "tr-24758",
      "tr-24816",
      "tr-24808",
      "tr-24796",
      "tr-24792",
      "tr-24789",
      "tr-24787",
      "tr-24783",
      "tr-24779",
      "tr-24775",
      "tr-24773",
      "tr-24771",
      "tr-24769",
      "tr-24767",
      "tr-24765",
      "tr-24763",
      "tr-24759",
      "tr-24757",
      "tr-24754",
      "tr-24750",
      "tr-24746",
      "tr-24742",
      "tr-24738",
      "tr-24734",
      "tr-24730",
      "tr-24726",
      "tr-24722",
      "tr-24784",
      "tr-24780",
      "tr-24772",
      "tr-24768",
      "tr-24760",
      "tr-24755",
      "tr-24745",
      "tr-24743",
      "tr-24741",
      "tr-24739",
      "tr-24735",
      "tr-24733",
      "tr-24729",
      "tr-24727",
      "tr-24714",
      "tr-24706",
      "tr-24752",
      "tr-24744",
      "tr-24736",
      "tr-24732",
      "tr-24728",
      "tr-24717",
      "tr-24715",
      "tr-24711",
      "tr-24709",
      "tr-24707",
      "tr-24705",
      "tr-24703",
      "tr-24720",
      "tr-24716",
      "tr-24712",
      "tr-24704",
      "tr-24896",
      "tr-24881",
      "tr-24877",
      "tr-24867",
      "tr-24838",
      "tr-24880",
      "tr-24876",
      "tr-24853",
      "tr-24843",
      "tr-24831",
      "tr-24810",
      "tr-24802",
      "tr-24848",
      "tr-24828",
      "tr-24819",
      "tr-24805",
      "tr-24801",
      "tr-24795",
      "tr-24766",
      "tr-24824",
      "tr-24820",
      "tr-24812",
      "tr-24804",
      "tr-24761",
      "tr-24756",
      "tr-24747",
      "tr-24723",
      "tr-24718",
      "tr-24708",
      "tr-24871",
      "tr-24878",
      "tr-24866",
      "tr-24893",
      "tr-24854",
      "tr-24841",
      "tr-24839",
      "tr-24827",
      "tr-24815",
      "tr-24811",
      "tr-24803",
      "tr-24781",
      "tr-24788",
      "tr-24776",
      "tr-24764",
      "tr-24751",
      "tr-24749",
      "tr-24737",
      "tr-24725",
      "tr-24721",
      "tr-24713",
      "tr-24840",
      "tr-24724",
      "tr-24785",
      "tr-24753",
      "tr-24719",
      "tr-24809",
      "tr-24748",
      "tr-24800",
      "tr-24762",
      "tr-24814",
      "tr-24731",
      "tr-24777",
      "tr-24806",
      "tr-24740"
    ],
    "owedGroup": [
      {
        "tradeId": "tr-24500",
        "underlying": "CVX",
        "debtIds": [
          "jd-c-0024601"
        ]
      },
      {
        "tradeId": "tr-24501",
        "underlying": "LLY",
        "debtIds": [
          "jd-c-0024602"
        ]
      },
      {
        "tradeId": "tr-24512",
        "underlying": "WMT",
        "debtIds": [
          "jd-c-0024603"
        ]
      },
      {
        "tradeId": "tr-24520",
        "underlying": "AAPL",
        "debtIds": [
          "jd-c-0024604"
        ]
      },
      {
        "tradeId": "tr-24531",
        "underlying": "KO",
        "debtIds": [
          "jd-c-0024605"
        ]
      },
      {
        "tradeId": "tr-24532",
        "underlying": "PFE",
        "debtIds": [
          "jd-c-0024606"
        ]
      },
      {
        "tradeId": "tr-24550",
        "underlying": "QCOM",
        "debtIds": [
          "jd-c-0024607"
        ]
      },
      {
        "tradeId": "tr-24551",
        "underlying": "TXN",
        "debtIds": [
          "jd-c-0024608"
        ]
      },
      {
        "tradeId": "tr-24562",
        "underlying": "NVDA",
        "debtIds": [
          "jd-c-0024609"
        ]
      },
      {
        "tradeId": "tr-24570",
        "underlying": "CSCO",
        "debtIds": [
          "jd-c-0024610"
        ]
      },
      {
        "tradeId": "tr-24581",
        "underlying": "LLY",
        "debtIds": [
          "jd-c-0024611"
        ]
      },
      {
        "tradeId": "tr-24582",
        "underlying": "ABBV",
        "debtIds": [
          "jd-c-0024612"
        ]
      },
      {
        "tradeId": "tr-24600",
        "underlying": "AAPL",
        "debtIds": [
          "jd-c-0024613"
        ]
      },
      {
        "tradeId": "tr-24601",
        "underlying": "MSFT",
        "debtIds": [
          "jd-c-0024614"
        ]
      },
      {
        "tradeId": "tr-24612",
        "underlying": "PFE",
        "debtIds": [
          "jd-c-0024615"
        ]
      },
      {
        "tradeId": "tr-24620",
        "underlying": "CVX",
        "debtIds": [
          "jd-c-0024616"
        ]
      },
      {
        "tradeId": "tr-24631",
        "underlying": "TXN",
        "debtIds": [
          "jd-c-0024617"
        ]
      },
      {
        "tradeId": "tr-24632",
        "underlying": "WMT",
        "debtIds": [
          "jd-c-0024618"
        ]
      },
      {
        "tradeId": "tr-24651",
        "underlying": "KO",
        "debtIds": [
          "jd-c-0024619"
        ]
      },
      {
        "tradeId": "tr-24610",
        "underlying": "CSCO",
        "debtIds": [
          "jd-c-0024620"
        ]
      },
      {
        "tradeId": "tr-24613",
        "underlying": "JPM",
        "debtIds": [
          "jd-c-0024621"
        ]
      },
      {
        "tradeId": "tr-24618",
        "underlying": "PG",
        "debtIds": [
          "jd-c-0024622"
        ]
      },
      {
        "tradeId": "tr-24621",
        "underlying": "LLY",
        "debtIds": [
          "jd-b-0096739",
          "jd-c-0024623"
        ]
      },
      {
        "tradeId": "tr-24622",
        "underlying": "ABBV",
        "debtIds": [
          "jd-b-0096740",
          "jd-b-0096862",
          "jd-c-0024652"
        ]
      },
      {
        "tradeId": "tr-24623",
        "underlying": "MRK",
        "debtIds": [
          "jd-b-0096741",
          "jd-c-0024624"
        ]
      },
      {
        "tradeId": "tr-24625",
        "underlying": "ADBE",
        "debtIds": [
          "jd-b-0096742",
          "jd-b-0096863",
          "jd-c-0024653"
        ]
      },
      {
        "tradeId": "tr-24629",
        "underlying": "INTC",
        "debtIds": [
          "jd-b-0096743",
          "jd-b-0096865",
          "jd-b-0096970",
          "jd-c-0024675"
        ]
      },
      {
        "tradeId": "tr-24630",
        "underlying": "QCOM",
        "debtIds": [
          "jd-b-0096744",
          "jd-c-0024625"
        ]
      },
      {
        "tradeId": "tr-24633",
        "underlying": "DIS",
        "debtIds": [
          "jd-b-0096745",
          "jd-c-0024626"
        ]
      },
      {
        "tradeId": "tr-24634",
        "underlying": "NKE",
        "debtIds": [
          "jd-b-0096746",
          "jd-b-0096866",
          "jd-c-0024654"
        ]
      },
      {
        "tradeId": "tr-24635",
        "underlying": "MCD",
        "debtIds": [
          "jd-b-0096747",
          "jd-c-0024627"
        ]
      },
      {
        "tradeId": "tr-24637",
        "underlying": "CAT",
        "debtIds": [
          "jd-b-0096748",
          "jd-b-0096867",
          "jd-c-0024655"
        ]
      },
      {
        "tradeId": "tr-24641",
        "underlying": "MSFT",
        "debtIds": [
          "jd-b-0096749",
          "jd-b-0096869",
          "jd-b-0096972",
          "jd-c-0024677"
        ]
      },
      {
        "tradeId": "tr-24642",
        "underlying": "NVDA",
        "debtIds": [
          "jd-b-0096750",
          "jd-c-0024628"
        ]
      },
      {
        "tradeId": "tr-24644",
        "underlying": "GOOGL",
        "debtIds": [
          "jd-b-0096751",
          "jd-c-0024629"
        ]
      },
      {
        "tradeId": "tr-24645",
        "underlying": "META",
        "debtIds": [
          "jd-b-0096752",
          "jd-c-0024630"
        ]
      },
      {
        "tradeId": "tr-24646",
        "underlying": "TSLA",
        "debtIds": [
          "jd-b-0096753",
          "jd-b-0096870",
          "jd-c-0024656"
        ]
      },
      {
        "tradeId": "tr-24647",
        "underlying": "AVGO",
        "debtIds": [
          "jd-b-0096754",
          "jd-c-0024631"
        ]
      },
      {
        "tradeId": "tr-24649",
        "underlying": "NFLX",
        "debtIds": [
          "jd-b-0096755",
          "jd-b-0096871",
          "jd-c-0024657"
        ]
      },
      {
        "tradeId": "tr-24652",
        "underlying": "PFE",
        "debtIds": [
          "jd-b-0096756",
          "jd-c-0024632"
        ]
      },
      {
        "tradeId": "tr-24654",
        "underlying": "V",
        "debtIds": [
          "jd-b-0096757",
          "jd-b-0096873",
          "jd-c-0024658"
        ]
      },
      {
        "tradeId": "tr-24655",
        "underlying": "MA",
        "debtIds": [
          "jd-b-0096758",
          "jd-c-0024633"
        ]
      },
      {
        "tradeId": "tr-24656",
        "underlying": "UNH",
        "debtIds": [
          "jd-b-0096759",
          "jd-b-0096874",
          "jd-c-0024659"
        ]
      },
      {
        "tradeId": "tr-24657",
        "underlying": "HD",
        "debtIds": [
          "jd-b-0096760",
          "jd-b-0096875",
          "jd-c-0024660"
        ]
      },
      {
        "tradeId": "tr-24661",
        "underlying": "LLY",
        "debtIds": [
          "jd-b-0096761",
          "jd-b-0096878",
          "jd-b-0096975",
          "jd-c-0024679"
        ]
      },
      {
        "tradeId": "tr-24664",
        "underlying": "PEP",
        "debtIds": [
          "jd-b-0096762",
          "jd-c-0024634"
        ]
      },
      {
        "tradeId": "tr-24666",
        "underlying": "CRM",
        "debtIds": [
          "jd-b-0096763",
          "jd-b-0096880",
          "jd-c-0024662"
        ]
      },
      {
        "tradeId": "tr-24667",
        "underlying": "ORCL",
        "debtIds": [
          "jd-b-0096764",
          "jd-c-0024635"
        ]
      },
      {
        "tradeId": "tr-24668",
        "underlying": "AMD",
        "debtIds": [
          "jd-b-0096765",
          "jd-b-0096881",
          "jd-c-0024663"
        ]
      },
      {
        "tradeId": "tr-24669",
        "underlying": "INTC",
        "debtIds": [
          "jd-b-0096766",
          "jd-b-0096882",
          "jd-c-0024664"
        ]
      },
      {
        "tradeId": "tr-24673",
        "underlying": "DIS",
        "debtIds": [
          "jd-b-0096767",
          "jd-b-0096884",
          "jd-b-0096977",
          "jd-c-0024680"
        ]
      },
      {
        "tradeId": "tr-24676",
        "underlying": "BA",
        "debtIds": [
          "jd-b-0096768",
          "jd-c-0024636"
        ]
      },
      {
        "tradeId": "tr-24678",
        "underlying": "DE",
        "debtIds": [
          "jd-b-0096769",
          "jd-b-0096886",
          "jd-c-0024666"
        ]
      },
      {
        "tradeId": "tr-24679",
        "underlying": "GS",
        "debtIds": [
          "jd-b-0096770",
          "jd-c-0024637"
        ]
      },
      {
        "tradeId": "tr-24680",
        "underlying": "AAPL",
        "debtIds": [
          "jd-b-0096771",
          "jd-b-0096887",
          "jd-c-0024667"
        ]
      },
      {
        "tradeId": "tr-24685",
        "underlying": "META",
        "debtIds": [
          "jd-b-0096772",
          "jd-b-0096889",
          "jd-b-0096980",
          "jd-c-0024681"
        ]
      },
      {
        "tradeId": "tr-24687",
        "underlying": "AVGO",
        "debtIds": [
          "jd-b-0096773",
          "jd-c-0024638"
        ]
      },
      {
        "tradeId": "tr-24688",
        "underlying": "COST",
        "debtIds": [
          "jd-b-0096774",
          "jd-b-0096890",
          "jd-c-0024669"
        ]
      },
      {
        "tradeId": "tr-24693",
        "underlying": "JPM",
        "debtIds": [
          "jd-b-0096775",
          "jd-b-0096894",
          "jd-b-0096984",
          "jd-c-0024684"
        ]
      },
      {
        "tradeId": "tr-24696",
        "underlying": "UNH",
        "debtIds": [
          "jd-b-0096776",
          "jd-c-0024639"
        ]
      },
      {
        "tradeId": "tr-24699",
        "underlying": "XOM",
        "debtIds": [
          "jd-b-0096777",
          "jd-c-0024640"
        ]
      },
      {
        "tradeId": "tr-24554",
        "underlying": "NKE",
        "debtIds": [
          "jd-b-0096848",
          "jd-c-0024641"
        ]
      },
      {
        "tradeId": "tr-24557",
        "underlying": "CAT",
        "debtIds": [
          "jd-b-0096849",
          "jd-c-0024642"
        ]
      },
      {
        "tradeId": "tr-24566",
        "underlying": "TSLA",
        "debtIds": [
          "jd-b-0096850",
          "jd-c-0024643"
        ]
      },
      {
        "tradeId": "tr-24569",
        "underlying": "NFLX",
        "debtIds": [
          "jd-b-0096851",
          "jd-c-0024644"
        ]
      },
      {
        "tradeId": "tr-24578",
        "underlying": "PG",
        "debtIds": [
          "jd-b-0096852",
          "jd-c-0024645"
        ]
      },
      {
        "tradeId": "tr-24586",
        "underlying": "CRM",
        "debtIds": [
          "jd-b-0096853",
          "jd-c-0024646"
        ]
      },
      {
        "tradeId": "tr-24589",
        "underlying": "INTC",
        "debtIds": [
          "jd-b-0096854",
          "jd-c-0024647"
        ]
      },
      {
        "tradeId": "tr-24590",
        "underlying": "QCOM",
        "debtIds": [
          "jd-b-0096855",
          "jd-b-0096966",
          "jd-c-0024671"
        ]
      },
      {
        "tradeId": "tr-24593",
        "underlying": "DIS",
        "debtIds": [
          "jd-b-0096856",
          "jd-b-0096967",
          "jd-c-0024672"
        ]
      },
      {
        "tradeId": "tr-24598",
        "underlying": "DE",
        "debtIds": [
          "jd-b-0096857",
          "jd-c-0024648"
        ]
      },
      {
        "tradeId": "tr-24602",
        "underlying": "NVDA",
        "debtIds": [
          "jd-b-0096858",
          "jd-c-0024649"
        ]
      },
      {
        "tradeId": "tr-24605",
        "underlying": "META",
        "debtIds": [
          "jd-b-0096859",
          "jd-c-0024650"
        ]
      },
      {
        "tradeId": "tr-24614",
        "underlying": "V",
        "debtIds": [
          "jd-b-0096860",
          "jd-c-0024651"
        ]
      },
      {
        "tradeId": "tr-24617",
        "underlying": "HD",
        "debtIds": [
          "jd-b-0096861",
          "jd-b-0096968",
          "jd-c-0024673"
        ]
      },
      {
        "tradeId": "tr-24626",
        "underlying": "CRM",
        "debtIds": [
          "jd-b-0096864",
          "jd-b-0096969",
          "jd-c-0024674"
        ]
      },
      {
        "tradeId": "tr-24638",
        "underlying": "DE",
        "debtIds": [
          "jd-b-0096868",
          "jd-b-0096971",
          "jd-c-0024676"
        ]
      },
      {
        "tradeId": "tr-24653",
        "underlying": "JPM",
        "debtIds": [
          "jd-b-0096872",
          "jd-b-0096973",
          "jd-b-0097057",
          "jd-c-0024686"
        ]
      },
      {
        "tradeId": "tr-24658",
        "underlying": "PG",
        "debtIds": [
          "jd-b-0096876",
          "jd-b-0096974",
          "jd-c-0024678"
        ]
      },
      {
        "tradeId": "tr-24659",
        "underlying": "XOM",
        "debtIds": [
          "jd-b-0096877",
          "jd-c-0024661"
        ]
      },
      {
        "tradeId": "tr-24665",
        "underlying": "ADBE",
        "debtIds": [
          "jd-b-0096879",
          "jd-b-0096976",
          "jd-b-0097058",
          "jd-c-0024687"
        ]
      },
      {
        "tradeId": "tr-24671",
        "underlying": "TXN",
        "debtIds": [
          "jd-b-0096883",
          "jd-c-0024665"
        ]
      },
      {
        "tradeId": "tr-24677",
        "underlying": "CAT",
        "debtIds": [
          "jd-b-0096885",
          "jd-b-0096979",
          "jd-b-0097060",
          "jd-c-0024689"
        ]
      },
      {
        "tradeId": "tr-24683",
        "underlying": "AMZN",
        "debtIds": [
          "jd-b-0096888",
          "jd-c-0024668"
        ]
      },
      {
        "tradeId": "tr-24690",
        "underlying": "CSCO",
        "debtIds": [
          "jd-b-0096891",
          "jd-b-0096982",
          "jd-c-0024682"
        ]
      },
      {
        "tradeId": "tr-24691",
        "underlying": "KO",
        "debtIds": [
          "jd-b-0096892",
          "jd-c-0024670"
        ]
      },
      {
        "tradeId": "tr-24692",
        "underlying": "PFE",
        "debtIds": [
          "jd-b-0096893",
          "jd-b-0096983",
          "jd-c-0024683"
        ]
      },
      {
        "tradeId": "tr-24697",
        "underlying": "HD",
        "debtIds": [
          "jd-b-0096895",
          "jd-b-0096987",
          "jd-b-0097064",
          "jd-c-0024691"
        ]
      },
      {
        "tradeId": "tr-24674",
        "underlying": "NKE",
        "debtIds": [
          "jd-b-0096978",
          "jd-b-0097059",
          "jd-c-0024688"
        ]
      },
      {
        "tradeId": "tr-24689",
        "underlying": "NFLX",
        "debtIds": [
          "jd-b-0096981",
          "jd-b-0097062",
          "jd-b-0097107",
          "jd-c-0024693"
        ]
      },
      {
        "tradeId": "tr-24694",
        "underlying": "V",
        "debtIds": [
          "jd-b-0096985",
          "jd-b-0097063",
          "jd-c-0024690"
        ]
      },
      {
        "tradeId": "tr-24695",
        "underlying": "MA",
        "debtIds": [
          "jd-b-0096986",
          "jd-c-0024685"
        ]
      },
      {
        "tradeId": "tr-24686",
        "underlying": "TSLA",
        "debtIds": [
          "jd-b-0097061",
          "jd-b-0097106",
          "jd-c-0024692"
        ]
      },
      {
        "tradeId": "tr-24698",
        "underlying": "PG",
        "debtIds": [
          "jd-b-0097065",
          "jd-b-0097108",
          "jd-c-0024694"
        ]
      },
      {
        "tradeId": "tr-24650",
        "underlying": "CSCO",
        "debtIds": [
          "jd-b-0097121",
          "jd-c-0024695"
        ]
      },
      {
        "tradeId": "tr-24662",
        "underlying": "ABBV",
        "debtIds": [
          "jd-b-0097122",
          "jd-c-0024696"
        ]
      },
      {
        "tradeId": "tr-24670",
        "underlying": "QCOM",
        "debtIds": [
          "jd-b-0097123",
          "jd-c-0024697"
        ]
      },
      {
        "tradeId": "tr-24681",
        "underlying": "MSFT",
        "debtIds": [
          "jd-b-0097124",
          "jd-c-0024698"
        ]
      },
      {
        "tradeId": "tr-24682",
        "underlying": "NVDA",
        "debtIds": [
          "jd-b-0097125",
          "jd-c-0024699"
        ]
      }
    ],
    "settlement": [
      {
        "tradeId": "tr-24700",
        "underlying": "AAPL",
        "contract": "AAPL261120C00105000",
        "expiration": "2026-11-20",
        "quantity": "20"
      },
      {
        "tradeId": "tr-24701",
        "underlying": "MSFT",
        "contract": "MSFT261120C00106000",
        "expiration": "2026-11-20",
        "quantity": "24"
      },
      {
        "tradeId": "tr-24702",
        "underlying": "NVDA",
        "contract": "NVDA261120C00107000",
        "expiration": "2026-11-20",
        "quantity": "20"
      },
      {
        "tradeId": "tr-24710",
        "underlying": "AMZN",
        "contract": "AMZN261120C00115000",
        "expiration": "2026-11-20",
        "quantity": "20"
      }
    ]
  },
  "asOfDueReflections": 487,
  "outstandingDebts": [
    {
      "debtId": "jd-c-0024601",
      "tradeId": "tr-24500",
      "underlying": "CVX",
      "kind": "CloseReview",
      "positionChange": 24601,
      "momentDate": "2026-10-30"
    },
    {
      "debtId": "jd-c-0024602",
      "tradeId": "tr-24501",
      "underlying": "LLY",
      "kind": "CloseReview",
      "positionChange": 24602,
      "momentDate": "2026-10-30"
    },
    {
      "debtId": "jd-c-0024603",
      "tradeId": "tr-24512",
      "underlying": "WMT",
      "kind": "CloseReview",
      "positionChange": 24603,
      "momentDate": "2026-10-30"
    },
    {
      "debtId": "jd-c-0024604",
      "tradeId": "tr-24520",
      "underlying": "AAPL",
      "kind": "CloseReview",
      "positionChange": 24604,
      "momentDate": "2026-10-30"
    },
    {
      "debtId": "jd-c-0024605",
      "tradeId": "tr-24531",
      "underlying": "KO",
      "kind": "CloseReview",
      "positionChange": 24605,
      "momentDate": "2026-10-30"
    },
    {
      "debtId": "jd-c-0024606",
      "tradeId": "tr-24532",
      "underlying": "PFE",
      "kind": "CloseReview",
      "positionChange": 24606,
      "momentDate": "2026-10-30"
    },
    {
      "debtId": "jd-c-0024607",
      "tradeId": "tr-24550",
      "underlying": "QCOM",
      "kind": "CloseReview",
      "positionChange": 24607,
      "momentDate": "2026-10-30"
    },
    {
      "debtId": "jd-c-0024608",
      "tradeId": "tr-24551",
      "underlying": "TXN",
      "kind": "CloseReview",
      "positionChange": 24608,
      "momentDate": "2026-10-30"
    },
    {
      "debtId": "jd-c-0024609",
      "tradeId": "tr-24562",
      "underlying": "NVDA",
      "kind": "CloseReview",
      "positionChange": 24609,
      "momentDate": "2026-10-30"
    },
    {
      "debtId": "jd-c-0024610",
      "tradeId": "tr-24570",
      "underlying": "CSCO",
      "kind": "CloseReview",
      "positionChange": 24610,
      "momentDate": "2026-10-30"
    },
    {
      "debtId": "jd-c-0024611",
      "tradeId": "tr-24581",
      "underlying": "LLY",
      "kind": "CloseReview",
      "positionChange": 24611,
      "momentDate": "2026-10-30"
    },
    {
      "debtId": "jd-c-0024612",
      "tradeId": "tr-24582",
      "underlying": "ABBV",
      "kind": "CloseReview",
      "positionChange": 24612,
      "momentDate": "2026-10-30"
    },
    {
      "debtId": "jd-c-0024613",
      "tradeId": "tr-24600",
      "underlying": "AAPL",
      "kind": "CloseReview",
      "positionChange": 24613,
      "momentDate": "2026-10-30"
    },
    {
      "debtId": "jd-c-0024614",
      "tradeId": "tr-24601",
      "underlying": "MSFT",
      "kind": "CloseReview",
      "positionChange": 24614,
      "momentDate": "2026-10-30"
    },
    {
      "debtId": "jd-c-0024615",
      "tradeId": "tr-24612",
      "underlying": "PFE",
      "kind": "CloseReview",
      "positionChange": 24615,
      "momentDate": "2026-10-30"
    },
    {
      "debtId": "jd-c-0024616",
      "tradeId": "tr-24620",
      "underlying": "CVX",
      "kind": "CloseReview",
      "positionChange": 24616,
      "momentDate": "2026-10-30"
    },
    {
      "debtId": "jd-c-0024617",
      "tradeId": "tr-24631",
      "underlying": "TXN",
      "kind": "CloseReview",
      "positionChange": 24617,
      "momentDate": "2026-10-30"
    },
    {
      "debtId": "jd-c-0024618",
      "tradeId": "tr-24632",
      "underlying": "WMT",
      "kind": "CloseReview",
      "positionChange": 24618,
      "momentDate": "2026-10-30"
    },
    {
      "debtId": "jd-c-0024619",
      "tradeId": "tr-24651",
      "underlying": "KO",
      "kind": "CloseReview",
      "positionChange": 24619,
      "momentDate": "2026-10-30"
    },
    {
      "debtId": "jd-c-0024620",
      "tradeId": "tr-24610",
      "underlying": "CSCO",
      "kind": "CloseReview",
      "positionChange": 24620,
      "momentDate": "2026-11-02"
    },
    {
      "debtId": "jd-c-0024621",
      "tradeId": "tr-24613",
      "underlying": "JPM",
      "kind": "CloseReview",
      "positionChange": 24621,
      "momentDate": "2026-11-02"
    },
    {
      "debtId": "jd-c-0024622",
      "tradeId": "tr-24618",
      "underlying": "PG",
      "kind": "CloseReview",
      "positionChange": 24622,
      "momentDate": "2026-11-02"
    },
    {
      "debtId": "jd-b-0096739",
      "tradeId": "tr-24621",
      "underlying": "LLY",
      "kind": "PositionChange",
      "positionChange": 96739,
      "momentDate": "2026-11-02"
    },
    {
      "debtId": "jd-c-0024623",
      "tradeId": "tr-24621",
      "underlying": "LLY",
      "kind": "CloseReview",
      "positionChange": 24623,
      "momentDate": "2026-11-02"
    },
    {
      "debtId": "jd-b-0096740",
      "tradeId": "tr-24622",
      "underlying": "ABBV",
      "kind": "PositionChange",
      "positionChange": 96740,
      "momentDate": "2026-11-02"
    },
    {
      "debtId": "jd-b-0096741",
      "tradeId": "tr-24623",
      "underlying": "MRK",
      "kind": "PositionChange",
      "positionChange": 96741,
      "momentDate": "2026-11-02"
    },
    {
      "debtId": "jd-c-0024624",
      "tradeId": "tr-24623",
      "underlying": "MRK",
      "kind": "CloseReview",
      "positionChange": 24624,
      "momentDate": "2026-11-02"
    },
    {
      "debtId": "jd-b-0096742",
      "tradeId": "tr-24625",
      "underlying": "ADBE",
      "kind": "PositionChange",
      "positionChange": 96742,
      "momentDate": "2026-11-02"
    },
    {
      "debtId": "jd-b-0096743",
      "tradeId": "tr-24629",
      "underlying": "INTC",
      "kind": "PositionChange",
      "positionChange": 96743,
      "momentDate": "2026-11-02"
    },
    {
      "debtId": "jd-b-0096744",
      "tradeId": "tr-24630",
      "underlying": "QCOM",
      "kind": "PositionChange",
      "positionChange": 96744,
      "momentDate": "2026-11-02"
    },
    {
      "debtId": "jd-c-0024625",
      "tradeId": "tr-24630",
      "underlying": "QCOM",
      "kind": "CloseReview",
      "positionChange": 24625,
      "momentDate": "2026-11-02"
    },
    {
      "debtId": "jd-b-0096745",
      "tradeId": "tr-24633",
      "underlying": "DIS",
      "kind": "PositionChange",
      "positionChange": 96745,
      "momentDate": "2026-11-02"
    },
    {
      "debtId": "jd-c-0024626",
      "tradeId": "tr-24633",
      "underlying": "DIS",
      "kind": "CloseReview",
      "positionChange": 24626,
      "momentDate": "2026-11-02"
    },
    {
      "debtId": "jd-b-0096746",
      "tradeId": "tr-24634",
      "underlying": "NKE",
      "kind": "PositionChange",
      "positionChange": 96746,
      "momentDate": "2026-11-02"
    },
    {
      "debtId": "jd-b-0096747",
      "tradeId": "tr-24635",
      "underlying": "MCD",
      "kind": "PositionChange",
      "positionChange": 96747,
      "momentDate": "2026-11-02"
    },
    {
      "debtId": "jd-c-0024627",
      "tradeId": "tr-24635",
      "underlying": "MCD",
      "kind": "CloseReview",
      "positionChange": 24627,
      "momentDate": "2026-11-02"
    },
    {
      "debtId": "jd-b-0096748",
      "tradeId": "tr-24637",
      "underlying": "CAT",
      "kind": "PositionChange",
      "positionChange": 96748,
      "momentDate": "2026-11-02"
    },
    {
      "debtId": "jd-b-0096749",
      "tradeId": "tr-24641",
      "underlying": "MSFT",
      "kind": "PositionChange",
      "positionChange": 96749,
      "momentDate": "2026-11-02"
    },
    {
      "debtId": "jd-b-0096750",
      "tradeId": "tr-24642",
      "underlying": "NVDA",
      "kind": "PositionChange",
      "positionChange": 96750,
      "momentDate": "2026-11-02"
    },
    {
      "debtId": "jd-c-0024628",
      "tradeId": "tr-24642",
      "underlying": "NVDA",
      "kind": "CloseReview",
      "positionChange": 24628,
      "momentDate": "2026-11-02"
    },
    {
      "debtId": "jd-b-0096751",
      "tradeId": "tr-24644",
      "underlying": "GOOGL",
      "kind": "PositionChange",
      "positionChange": 96751,
      "momentDate": "2026-11-02"
    },
    {
      "debtId": "jd-c-0024629",
      "tradeId": "tr-24644",
      "underlying": "GOOGL",
      "kind": "CloseReview",
      "positionChange": 24629,
      "momentDate": "2026-11-02"
    },
    {
      "debtId": "jd-b-0096752",
      "tradeId": "tr-24645",
      "underlying": "META",
      "kind": "PositionChange",
      "positionChange": 96752,
      "momentDate": "2026-11-02"
    },
    {
      "debtId": "jd-c-0024630",
      "tradeId": "tr-24645",
      "underlying": "META",
      "kind": "CloseReview",
      "positionChange": 24630,
      "momentDate": "2026-11-02"
    },
    {
      "debtId": "jd-b-0096753",
      "tradeId": "tr-24646",
      "underlying": "TSLA",
      "kind": "PositionChange",
      "positionChange": 96753,
      "momentDate": "2026-11-02"
    },
    {
      "debtId": "jd-b-0096754",
      "tradeId": "tr-24647",
      "underlying": "AVGO",
      "kind": "PositionChange",
      "positionChange": 96754,
      "momentDate": "2026-11-02"
    },
    {
      "debtId": "jd-c-0024631",
      "tradeId": "tr-24647",
      "underlying": "AVGO",
      "kind": "CloseReview",
      "positionChange": 24631,
      "momentDate": "2026-11-02"
    },
    {
      "debtId": "jd-b-0096755",
      "tradeId": "tr-24649",
      "underlying": "NFLX",
      "kind": "PositionChange",
      "positionChange": 96755,
      "momentDate": "2026-11-02"
    },
    {
      "debtId": "jd-b-0096756",
      "tradeId": "tr-24652",
      "underlying": "PFE",
      "kind": "PositionChange",
      "positionChange": 96756,
      "momentDate": "2026-11-02"
    },
    {
      "debtId": "jd-c-0024632",
      "tradeId": "tr-24652",
      "underlying": "PFE",
      "kind": "CloseReview",
      "positionChange": 24632,
      "momentDate": "2026-11-02"
    },
    {
      "debtId": "jd-b-0096757",
      "tradeId": "tr-24654",
      "underlying": "V",
      "kind": "PositionChange",
      "positionChange": 96757,
      "momentDate": "2026-11-02"
    },
    {
      "debtId": "jd-b-0096758",
      "tradeId": "tr-24655",
      "underlying": "MA",
      "kind": "PositionChange",
      "positionChange": 96758,
      "momentDate": "2026-11-02"
    },
    {
      "debtId": "jd-c-0024633",
      "tradeId": "tr-24655",
      "underlying": "MA",
      "kind": "CloseReview",
      "positionChange": 24633,
      "momentDate": "2026-11-02"
    },
    {
      "debtId": "jd-b-0096759",
      "tradeId": "tr-24656",
      "underlying": "UNH",
      "kind": "PositionChange",
      "positionChange": 96759,
      "momentDate": "2026-11-02"
    },
    {
      "debtId": "jd-b-0096760",
      "tradeId": "tr-24657",
      "underlying": "HD",
      "kind": "PositionChange",
      "positionChange": 96760,
      "momentDate": "2026-11-02"
    },
    {
      "debtId": "jd-b-0096761",
      "tradeId": "tr-24661",
      "underlying": "LLY",
      "kind": "PositionChange",
      "positionChange": 96761,
      "momentDate": "2026-11-02"
    },
    {
      "debtId": "jd-b-0096762",
      "tradeId": "tr-24664",
      "underlying": "PEP",
      "kind": "PositionChange",
      "positionChange": 96762,
      "momentDate": "2026-11-02"
    },
    {
      "debtId": "jd-c-0024634",
      "tradeId": "tr-24664",
      "underlying": "PEP",
      "kind": "CloseReview",
      "positionChange": 24634,
      "momentDate": "2026-11-02"
    },
    {
      "debtId": "jd-b-0096763",
      "tradeId": "tr-24666",
      "underlying": "CRM",
      "kind": "PositionChange",
      "positionChange": 96763,
      "momentDate": "2026-11-02"
    },
    {
      "debtId": "jd-b-0096764",
      "tradeId": "tr-24667",
      "underlying": "ORCL",
      "kind": "PositionChange",
      "positionChange": 96764,
      "momentDate": "2026-11-02"
    },
    {
      "debtId": "jd-c-0024635",
      "tradeId": "tr-24667",
      "underlying": "ORCL",
      "kind": "CloseReview",
      "positionChange": 24635,
      "momentDate": "2026-11-02"
    },
    {
      "debtId": "jd-b-0096765",
      "tradeId": "tr-24668",
      "underlying": "AMD",
      "kind": "PositionChange",
      "positionChange": 96765,
      "momentDate": "2026-11-02"
    },
    {
      "debtId": "jd-b-0096766",
      "tradeId": "tr-24669",
      "underlying": "INTC",
      "kind": "PositionChange",
      "positionChange": 96766,
      "momentDate": "2026-11-02"
    },
    {
      "debtId": "jd-b-0096767",
      "tradeId": "tr-24673",
      "underlying": "DIS",
      "kind": "PositionChange",
      "positionChange": 96767,
      "momentDate": "2026-11-02"
    },
    {
      "debtId": "jd-b-0096768",
      "tradeId": "tr-24676",
      "underlying": "BA",
      "kind": "PositionChange",
      "positionChange": 96768,
      "momentDate": "2026-11-02"
    },
    {
      "debtId": "jd-c-0024636",
      "tradeId": "tr-24676",
      "underlying": "BA",
      "kind": "CloseReview",
      "positionChange": 24636,
      "momentDate": "2026-11-02"
    },
    {
      "debtId": "jd-b-0096769",
      "tradeId": "tr-24678",
      "underlying": "DE",
      "kind": "PositionChange",
      "positionChange": 96769,
      "momentDate": "2026-11-02"
    },
    {
      "debtId": "jd-b-0096770",
      "tradeId": "tr-24679",
      "underlying": "GS",
      "kind": "PositionChange",
      "positionChange": 96770,
      "momentDate": "2026-11-02"
    },
    {
      "debtId": "jd-c-0024637",
      "tradeId": "tr-24679",
      "underlying": "GS",
      "kind": "CloseReview",
      "positionChange": 24637,
      "momentDate": "2026-11-02"
    },
    {
      "debtId": "jd-b-0096771",
      "tradeId": "tr-24680",
      "underlying": "AAPL",
      "kind": "PositionChange",
      "positionChange": 96771,
      "momentDate": "2026-11-02"
    },
    {
      "debtId": "jd-b-0096772",
      "tradeId": "tr-24685",
      "underlying": "META",
      "kind": "PositionChange",
      "positionChange": 96772,
      "momentDate": "2026-11-02"
    },
    {
      "debtId": "jd-b-0096773",
      "tradeId": "tr-24687",
      "underlying": "AVGO",
      "kind": "PositionChange",
      "positionChange": 96773,
      "momentDate": "2026-11-02"
    },
    {
      "debtId": "jd-c-0024638",
      "tradeId": "tr-24687",
      "underlying": "AVGO",
      "kind": "CloseReview",
      "positionChange": 24638,
      "momentDate": "2026-11-02"
    },
    {
      "debtId": "jd-b-0096774",
      "tradeId": "tr-24688",
      "underlying": "COST",
      "kind": "PositionChange",
      "positionChange": 96774,
      "momentDate": "2026-11-02"
    },
    {
      "debtId": "jd-b-0096775",
      "tradeId": "tr-24693",
      "underlying": "JPM",
      "kind": "PositionChange",
      "positionChange": 96775,
      "momentDate": "2026-11-02"
    },
    {
      "debtId": "jd-b-0096776",
      "tradeId": "tr-24696",
      "underlying": "UNH",
      "kind": "PositionChange",
      "positionChange": 96776,
      "momentDate": "2026-11-02"
    },
    {
      "debtId": "jd-c-0024639",
      "tradeId": "tr-24696",
      "underlying": "UNH",
      "kind": "CloseReview",
      "positionChange": 24639,
      "momentDate": "2026-11-02"
    },
    {
      "debtId": "jd-b-0096777",
      "tradeId": "tr-24699",
      "underlying": "XOM",
      "kind": "PositionChange",
      "positionChange": 96777,
      "momentDate": "2026-11-02"
    },
    {
      "debtId": "jd-c-0024640",
      "tradeId": "tr-24699",
      "underlying": "XOM",
      "kind": "CloseReview",
      "positionChange": 24640,
      "momentDate": "2026-11-02"
    },
    {
      "debtId": "jd-b-0096778",
      "tradeId": "tr-24722",
      "underlying": "COST",
      "kind": "PositionChange",
      "positionChange": 96778,
      "momentDate": "2026-11-02"
    },
    {
      "debtId": "jd-b-0096779",
      "tradeId": "tr-24726",
      "underlying": "HD",
      "kind": "PositionChange",
      "positionChange": 96779,
      "momentDate": "2026-11-02"
    },
    {
      "debtId": "jd-b-0096780",
      "tradeId": "tr-24730",
      "underlying": "NFLX",
      "kind": "PositionChange",
      "positionChange": 96780,
      "momentDate": "2026-11-02"
    },
    {
      "debtId": "jd-b-0096781",
      "tradeId": "tr-24734",
      "underlying": "ABBV",
      "kind": "PositionChange",
      "positionChange": 96781,
      "momentDate": "2026-11-02"
    },
    {
      "debtId": "jd-b-0096782",
      "tradeId": "tr-24738",
      "underlying": "CRM",
      "kind": "PositionChange",
      "positionChange": 96782,
      "momentDate": "2026-11-02"
    },
    {
      "debtId": "jd-b-0096783",
      "tradeId": "tr-24742",
      "underlying": "V",
      "kind": "PositionChange",
      "positionChange": 96783,
      "momentDate": "2026-11-02"
    },
    {
      "debtId": "jd-b-0096784",
      "tradeId": "tr-24746",
      "underlying": "TXN",
      "kind": "PositionChange",
      "positionChange": 96784,
      "momentDate": "2026-11-02"
    },
    {
      "debtId": "jd-b-0096785",
      "tradeId": "tr-24750",
      "underlying": "MA",
      "kind": "PositionChange",
      "positionChange": 96785,
      "momentDate": "2026-11-02"
    },
    {
      "debtId": "jd-b-0096786",
      "tradeId": "tr-24754",
      "underlying": "BA",
      "kind": "PositionChange",
      "positionChange": 96786,
      "momentDate": "2026-11-02"
    },
    {
      "debtId": "jd-b-0096787",
      "tradeId": "tr-24757",
      "underlying": "GS",
      "kind": "PositionChange",
      "positionChange": 96787,
      "momentDate": "2026-11-02"
    },
    {
      "debtId": "jd-b-0096788",
      "tradeId": "tr-24758",
      "underlying": "QAA",
      "kind": "PositionChange",
      "positionChange": 96788,
      "momentDate": "2026-11-02"
    },
    {
      "debtId": "jd-b-0096789",
      "tradeId": "tr-24759",
      "underlying": "QAB",
      "kind": "PositionChange",
      "positionChange": 96789,
      "momentDate": "2026-11-02"
    },
    {
      "debtId": "jd-b-0096790",
      "tradeId": "tr-24761",
      "underlying": "XOM",
      "kind": "PositionChange",
      "positionChange": 96790,
      "momentDate": "2026-11-02"
    },
    {
      "debtId": "jd-b-0096791",
      "tradeId": "tr-24762",
      "underlying": "CVX",
      "kind": "PositionChange",
      "positionChange": 96791,
      "momentDate": "2026-11-02"
    },
    {
      "debtId": "jd-b-0096792",
      "tradeId": "tr-24763",
      "underlying": "QAC",
      "kind": "PositionChange",
      "positionChange": 96792,
      "momentDate": "2026-11-02"
    },
    {
      "debtId": "jd-b-0096793",
      "tradeId": "tr-24765",
      "underlying": "QAE",
      "kind": "PositionChange",
      "positionChange": 96793,
      "momentDate": "2026-11-02"
    },
    {
      "debtId": "jd-b-0096794",
      "tradeId": "tr-24766",
      "underlying": "QAF",
      "kind": "PositionChange",
      "positionChange": 96794,
      "momentDate": "2026-11-02"
    },
    {
      "debtId": "jd-b-0096795",
      "tradeId": "tr-24767",
      "underlying": "QAG",
      "kind": "PositionChange",
      "positionChange": 96795,
      "momentDate": "2026-11-02"
    },
    {
      "debtId": "jd-b-0096796",
      "tradeId": "tr-24769",
      "underlying": "QAI",
      "kind": "PositionChange",
      "positionChange": 96796,
      "momentDate": "2026-11-02"
    },
    {
      "debtId": "jd-b-0096797",
      "tradeId": "tr-24770",
      "underlying": "LLY",
      "kind": "PositionChange",
      "positionChange": 96797,
      "momentDate": "2026-11-02"
    },
    {
      "debtId": "jd-b-0096798",
      "tradeId": "tr-24771",
      "underlying": "ABBV",
      "kind": "PositionChange",
      "positionChange": 96798,
      "momentDate": "2026-11-02"
    },
    {
      "debtId": "jd-b-0096799",
      "tradeId": "tr-24773",
      "underlying": "QAJ",
      "kind": "PositionChange",
      "positionChange": 96799,
      "momentDate": "2026-11-02"
    },
    {
      "debtId": "jd-b-0096800",
      "tradeId": "tr-24774",
      "underlying": "QAK",
      "kind": "PositionChange",
      "positionChange": 96800,
      "momentDate": "2026-11-02"
    },
    {
      "debtId": "jd-b-0096801",
      "tradeId": "tr-24775",
      "underlying": "QAL",
      "kind": "PositionChange",
      "positionChange": 96801,
      "momentDate": "2026-11-02"
    },
    {
      "debtId": "jd-b-0096802",
      "tradeId": "tr-24777",
      "underlying": "QAN",
      "kind": "PositionChange",
      "positionChange": 96802,
      "momentDate": "2026-11-02"
    },
    {
      "debtId": "jd-b-0096803",
      "tradeId": "tr-24778",
      "underlying": "QAO",
      "kind": "PositionChange",
      "positionChange": 96803,
      "momentDate": "2026-11-02"
    },
    {
      "debtId": "jd-b-0096804",
      "tradeId": "tr-24779",
      "underlying": "QAP",
      "kind": "PositionChange",
      "positionChange": 96804,
      "momentDate": "2026-11-02"
    },
    {
      "debtId": "jd-b-0096805",
      "tradeId": "tr-24781",
      "underlying": "ADBE",
      "kind": "PositionChange",
      "positionChange": 96805,
      "momentDate": "2026-11-02"
    },
    {
      "debtId": "jd-b-0096806",
      "tradeId": "tr-24782",
      "underlying": "CRM",
      "kind": "PositionChange",
      "positionChange": 96806,
      "momentDate": "2026-11-02"
    },
    {
      "debtId": "jd-b-0096807",
      "tradeId": "tr-24783",
      "underlying": "QAQ",
      "kind": "PositionChange",
      "positionChange": 96807,
      "momentDate": "2026-11-02"
    },
    {
      "debtId": "jd-b-0096808",
      "tradeId": "tr-24785",
      "underlying": "QAS",
      "kind": "PositionChange",
      "positionChange": 96808,
      "momentDate": "2026-11-02"
    },
    {
      "debtId": "jd-b-0096809",
      "tradeId": "tr-24786",
      "underlying": "QAT",
      "kind": "PositionChange",
      "positionChange": 96809,
      "momentDate": "2026-11-02"
    },
    {
      "debtId": "jd-b-0096810",
      "tradeId": "tr-24787",
      "underlying": "QAU",
      "kind": "PositionChange",
      "positionChange": 96810,
      "momentDate": "2026-11-02"
    },
    {
      "debtId": "jd-b-0096811",
      "tradeId": "tr-24789",
      "underlying": "QAW",
      "kind": "PositionChange",
      "positionChange": 96811,
      "momentDate": "2026-11-02"
    },
    {
      "debtId": "jd-b-0096812",
      "tradeId": "tr-24790",
      "underlying": "ORCL",
      "kind": "PositionChange",
      "positionChange": 96812,
      "momentDate": "2026-11-02"
    },
    {
      "debtId": "jd-b-0096813",
      "tradeId": "tr-24791",
      "underlying": "AMD",
      "kind": "PositionChange",
      "positionChange": 96813,
      "momentDate": "2026-11-02"
    },
    {
      "debtId": "jd-b-0096814",
      "tradeId": "tr-24792",
      "underlying": "INTC",
      "kind": "PositionChange",
      "positionChange": 96814,
      "momentDate": "2026-11-02"
    },
    {
      "debtId": "jd-b-0096815",
      "tradeId": "tr-24793",
      "underlying": "QAX",
      "kind": "PositionChange",
      "positionChange": 96815,
      "momentDate": "2026-11-02"
    },
    {
      "debtId": "jd-b-0096816",
      "tradeId": "tr-24794",
      "underlying": "QAY",
      "kind": "PositionChange",
      "positionChange": 96816,
      "momentDate": "2026-11-02"
    },
    {
      "debtId": "jd-b-0096817",
      "tradeId": "tr-24795",
      "underlying": "QAZ",
      "kind": "PositionChange",
      "positionChange": 96817,
      "momentDate": "2026-11-02"
    },
    {
      "debtId": "jd-b-0096818",
      "tradeId": "tr-24796",
      "underlying": "QBA",
      "kind": "PositionChange",
      "positionChange": 96818,
      "momentDate": "2026-11-02"
    },
    {
      "debtId": "jd-b-0096819",
      "tradeId": "tr-24797",
      "underlying": "QBB",
      "kind": "PositionChange",
      "positionChange": 96819,
      "momentDate": "2026-11-02"
    },
    {
      "debtId": "jd-b-0096820",
      "tradeId": "tr-24798",
      "underlying": "QBC",
      "kind": "PositionChange",
      "positionChange": 96820,
      "momentDate": "2026-11-02"
    },
    {
      "debtId": "jd-b-0096821",
      "tradeId": "tr-24799",
      "underlying": "QBD",
      "kind": "PositionChange",
      "positionChange": 96821,
      "momentDate": "2026-11-02"
    },
    {
      "debtId": "jd-b-0096822",
      "tradeId": "tr-24800",
      "underlying": "QCOM",
      "kind": "PositionChange",
      "positionChange": 96822,
      "momentDate": "2026-11-02"
    },
    {
      "debtId": "jd-b-0096823",
      "tradeId": "tr-24801",
      "underlying": "TXN",
      "kind": "PositionChange",
      "positionChange": 96823,
      "momentDate": "2026-11-02"
    },
    {
      "debtId": "jd-b-0096824",
      "tradeId": "tr-24802",
      "underlying": "WMT",
      "kind": "PositionChange",
      "positionChange": 96824,
      "momentDate": "2026-11-02"
    },
    {
      "debtId": "jd-b-0096825",
      "tradeId": "tr-24803",
      "underlying": "QBE",
      "kind": "PositionChange",
      "positionChange": 96825,
      "momentDate": "2026-11-02"
    },
    {
      "debtId": "jd-b-0096826",
      "tradeId": "tr-24804",
      "underlying": "QBF",
      "kind": "PositionChange",
      "positionChange": 96826,
      "momentDate": "2026-11-02"
    },
    {
      "debtId": "jd-b-0096827",
      "tradeId": "tr-24805",
      "underlying": "QBG",
      "kind": "PositionChange",
      "positionChange": 96827,
      "momentDate": "2026-11-02"
    },
    {
      "debtId": "jd-b-0096828",
      "tradeId": "tr-24806",
      "underlying": "QBH",
      "kind": "PositionChange",
      "positionChange": 96828,
      "momentDate": "2026-11-02"
    },
    {
      "debtId": "jd-b-0096829",
      "tradeId": "tr-24807",
      "underlying": "QBI",
      "kind": "PositionChange",
      "positionChange": 96829,
      "momentDate": "2026-11-02"
    },
    {
      "debtId": "jd-b-0096830",
      "tradeId": "tr-24808",
      "underlying": "QBJ",
      "kind": "PositionChange",
      "positionChange": 96830,
      "momentDate": "2026-11-02"
    },
    {
      "debtId": "jd-b-0096831",
      "tradeId": "tr-24809",
      "underlying": "QBK",
      "kind": "PositionChange",
      "positionChange": 96831,
      "momentDate": "2026-11-02"
    },
    {
      "debtId": "jd-b-0096832",
      "tradeId": "tr-24810",
      "underlying": "DIS",
      "kind": "PositionChange",
      "positionChange": 96832,
      "momentDate": "2026-11-02"
    },
    {
      "debtId": "jd-b-0096833",
      "tradeId": "tr-24811",
      "underlying": "NKE",
      "kind": "PositionChange",
      "positionChange": 96833,
      "momentDate": "2026-11-02"
    },
    {
      "debtId": "jd-b-0096834",
      "tradeId": "tr-24812",
      "underlying": "MCD",
      "kind": "PositionChange",
      "positionChange": 96834,
      "momentDate": "2026-11-02"
    },
    {
      "debtId": "jd-b-0096835",
      "tradeId": "tr-24813",
      "underlying": "QBL",
      "kind": "PositionChange",
      "positionChange": 96835,
      "momentDate": "2026-11-02"
    },
    {
      "debtId": "jd-b-0096836",
      "tradeId": "tr-24814",
      "underlying": "QBM",
      "kind": "PositionChange",
      "positionChange": 96836,
      "momentDate": "2026-11-02"
    },
    {
      "debtId": "jd-b-0096837",
      "tradeId": "tr-24815",
      "underlying": "QBN",
      "kind": "PositionChange",
      "positionChange": 96837,
      "momentDate": "2026-11-02"
    },
    {
      "debtId": "jd-b-0096838",
      "tradeId": "tr-24816",
      "underlying": "QBO",
      "kind": "PositionChange",
      "positionChange": 96838,
      "momentDate": "2026-11-02"
    },
    {
      "debtId": "jd-b-0096839",
      "tradeId": "tr-24817",
      "underlying": "QBP",
      "kind": "PositionChange",
      "positionChange": 96839,
      "momentDate": "2026-11-02"
    },
    {
      "debtId": "jd-b-0096840",
      "tradeId": "tr-24818",
      "underlying": "QBQ",
      "kind": "PositionChange",
      "positionChange": 96840,
      "momentDate": "2026-11-02"
    },
    {
      "debtId": "jd-b-0096841",
      "tradeId": "tr-24819",
      "underlying": "QBR",
      "kind": "PositionChange",
      "positionChange": 96841,
      "momentDate": "2026-11-02"
    },
    {
      "debtId": "jd-b-0096842",
      "tradeId": "tr-24820",
      "underlying": "BA",
      "kind": "PositionChange",
      "positionChange": 96842,
      "momentDate": "2026-11-02"
    },
    {
      "debtId": "jd-b-0096843",
      "tradeId": "tr-24821",
      "underlying": "CAT",
      "kind": "PositionChange",
      "positionChange": 96843,
      "momentDate": "2026-11-02"
    },
    {
      "debtId": "jd-b-0096844",
      "tradeId": "tr-24822",
      "underlying": "DE",
      "kind": "PositionChange",
      "positionChange": 96844,
      "momentDate": "2026-11-02"
    },
    {
      "debtId": "jd-b-0096845",
      "tradeId": "tr-24823",
      "underlying": "QBS",
      "kind": "PositionChange",
      "positionChange": 96845,
      "momentDate": "2026-11-02"
    },
    {
      "debtId": "jd-b-0096846",
      "tradeId": "tr-24824",
      "underlying": "QBT",
      "kind": "PositionChange",
      "positionChange": 96846,
      "momentDate": "2026-11-02"
    },
    {
      "debtId": "jd-b-0096847",
      "tradeId": "tr-24825",
      "underlying": "QBU",
      "kind": "PositionChange",
      "positionChange": 96847,
      "momentDate": "2026-11-02"
    },
    {
      "debtId": "jd-b-0096848",
      "tradeId": "tr-24554",
      "underlying": "NKE",
      "kind": "PositionChange",
      "positionChange": 96848,
      "momentDate": "2026-11-02"
    },
    {
      "debtId": "jd-c-0024641",
      "tradeId": "tr-24554",
      "underlying": "NKE",
      "kind": "CloseReview",
      "positionChange": 24641,
      "momentDate": "2026-11-02"
    },
    {
      "debtId": "jd-b-0096849",
      "tradeId": "tr-24557",
      "underlying": "CAT",
      "kind": "PositionChange",
      "positionChange": 96849,
      "momentDate": "2026-11-02"
    },
    {
      "debtId": "jd-c-0024642",
      "tradeId": "tr-24557",
      "underlying": "CAT",
      "kind": "CloseReview",
      "positionChange": 24642,
      "momentDate": "2026-11-02"
    },
    {
      "debtId": "jd-b-0096850",
      "tradeId": "tr-24566",
      "underlying": "TSLA",
      "kind": "PositionChange",
      "positionChange": 96850,
      "momentDate": "2026-11-02"
    },
    {
      "debtId": "jd-c-0024643",
      "tradeId": "tr-24566",
      "underlying": "TSLA",
      "kind": "CloseReview",
      "positionChange": 24643,
      "momentDate": "2026-11-02"
    },
    {
      "debtId": "jd-b-0096851",
      "tradeId": "tr-24569",
      "underlying": "NFLX",
      "kind": "PositionChange",
      "positionChange": 96851,
      "momentDate": "2026-11-02"
    },
    {
      "debtId": "jd-c-0024644",
      "tradeId": "tr-24569",
      "underlying": "NFLX",
      "kind": "CloseReview",
      "positionChange": 24644,
      "momentDate": "2026-11-02"
    },
    {
      "debtId": "jd-b-0096852",
      "tradeId": "tr-24578",
      "underlying": "PG",
      "kind": "PositionChange",
      "positionChange": 96852,
      "momentDate": "2026-11-02"
    },
    {
      "debtId": "jd-c-0024645",
      "tradeId": "tr-24578",
      "underlying": "PG",
      "kind": "CloseReview",
      "positionChange": 24645,
      "momentDate": "2026-11-02"
    },
    {
      "debtId": "jd-b-0096853",
      "tradeId": "tr-24586",
      "underlying": "CRM",
      "kind": "PositionChange",
      "positionChange": 96853,
      "momentDate": "2026-11-02"
    },
    {
      "debtId": "jd-c-0024646",
      "tradeId": "tr-24586",
      "underlying": "CRM",
      "kind": "CloseReview",
      "positionChange": 24646,
      "momentDate": "2026-11-02"
    },
    {
      "debtId": "jd-b-0096854",
      "tradeId": "tr-24589",
      "underlying": "INTC",
      "kind": "PositionChange",
      "positionChange": 96854,
      "momentDate": "2026-11-02"
    },
    {
      "debtId": "jd-c-0024647",
      "tradeId": "tr-24589",
      "underlying": "INTC",
      "kind": "CloseReview",
      "positionChange": 24647,
      "momentDate": "2026-11-02"
    },
    {
      "debtId": "jd-b-0096855",
      "tradeId": "tr-24590",
      "underlying": "QCOM",
      "kind": "PositionChange",
      "positionChange": 96855,
      "momentDate": "2026-11-02"
    },
    {
      "debtId": "jd-b-0096856",
      "tradeId": "tr-24593",
      "underlying": "DIS",
      "kind": "PositionChange",
      "positionChange": 96856,
      "momentDate": "2026-11-02"
    },
    {
      "debtId": "jd-b-0096857",
      "tradeId": "tr-24598",
      "underlying": "DE",
      "kind": "PositionChange",
      "positionChange": 96857,
      "momentDate": "2026-11-02"
    },
    {
      "debtId": "jd-c-0024648",
      "tradeId": "tr-24598",
      "underlying": "DE",
      "kind": "CloseReview",
      "positionChange": 24648,
      "momentDate": "2026-11-02"
    },
    {
      "debtId": "jd-b-0096858",
      "tradeId": "tr-24602",
      "underlying": "NVDA",
      "kind": "PositionChange",
      "positionChange": 96858,
      "momentDate": "2026-11-03"
    },
    {
      "debtId": "jd-c-0024649",
      "tradeId": "tr-24602",
      "underlying": "NVDA",
      "kind": "CloseReview",
      "positionChange": 24649,
      "momentDate": "2026-11-03"
    },
    {
      "debtId": "jd-b-0096859",
      "tradeId": "tr-24605",
      "underlying": "META",
      "kind": "PositionChange",
      "positionChange": 96859,
      "momentDate": "2026-11-03"
    },
    {
      "debtId": "jd-c-0024650",
      "tradeId": "tr-24605",
      "underlying": "META",
      "kind": "CloseReview",
      "positionChange": 24650,
      "momentDate": "2026-11-03"
    },
    {
      "debtId": "jd-b-0096860",
      "tradeId": "tr-24614",
      "underlying": "V",
      "kind": "PositionChange",
      "positionChange": 96860,
      "momentDate": "2026-11-03"
    },
    {
      "debtId": "jd-c-0024651",
      "tradeId": "tr-24614",
      "underlying": "V",
      "kind": "CloseReview",
      "positionChange": 24651,
      "momentDate": "2026-11-03"
    },
    {
      "debtId": "jd-b-0096861",
      "tradeId": "tr-24617",
      "underlying": "HD",
      "kind": "PositionChange",
      "positionChange": 96861,
      "momentDate": "2026-11-03"
    },
    {
      "debtId": "jd-b-0096862",
      "tradeId": "tr-24622",
      "underlying": "ABBV",
      "kind": "PositionChange",
      "positionChange": 96862,
      "momentDate": "2026-11-03"
    },
    {
      "debtId": "jd-c-0024652",
      "tradeId": "tr-24622",
      "underlying": "ABBV",
      "kind": "CloseReview",
      "positionChange": 24652,
      "momentDate": "2026-11-03"
    },
    {
      "debtId": "jd-b-0096863",
      "tradeId": "tr-24625",
      "underlying": "ADBE",
      "kind": "PositionChange",
      "positionChange": 96863,
      "momentDate": "2026-11-03"
    },
    {
      "debtId": "jd-c-0024653",
      "tradeId": "tr-24625",
      "underlying": "ADBE",
      "kind": "CloseReview",
      "positionChange": 24653,
      "momentDate": "2026-11-03"
    },
    {
      "debtId": "jd-b-0096864",
      "tradeId": "tr-24626",
      "underlying": "CRM",
      "kind": "PositionChange",
      "positionChange": 96864,
      "momentDate": "2026-11-03"
    },
    {
      "debtId": "jd-b-0096865",
      "tradeId": "tr-24629",
      "underlying": "INTC",
      "kind": "PositionChange",
      "positionChange": 96865,
      "momentDate": "2026-11-03"
    },
    {
      "debtId": "jd-b-0096866",
      "tradeId": "tr-24634",
      "underlying": "NKE",
      "kind": "PositionChange",
      "positionChange": 96866,
      "momentDate": "2026-11-03"
    },
    {
      "debtId": "jd-c-0024654",
      "tradeId": "tr-24634",
      "underlying": "NKE",
      "kind": "CloseReview",
      "positionChange": 24654,
      "momentDate": "2026-11-03"
    },
    {
      "debtId": "jd-b-0096867",
      "tradeId": "tr-24637",
      "underlying": "CAT",
      "kind": "PositionChange",
      "positionChange": 96867,
      "momentDate": "2026-11-03"
    },
    {
      "debtId": "jd-c-0024655",
      "tradeId": "tr-24637",
      "underlying": "CAT",
      "kind": "CloseReview",
      "positionChange": 24655,
      "momentDate": "2026-11-03"
    },
    {
      "debtId": "jd-b-0096868",
      "tradeId": "tr-24638",
      "underlying": "DE",
      "kind": "PositionChange",
      "positionChange": 96868,
      "momentDate": "2026-11-03"
    },
    {
      "debtId": "jd-b-0096869",
      "tradeId": "tr-24641",
      "underlying": "MSFT",
      "kind": "PositionChange",
      "positionChange": 96869,
      "momentDate": "2026-11-03"
    },
    {
      "debtId": "jd-b-0096870",
      "tradeId": "tr-24646",
      "underlying": "TSLA",
      "kind": "PositionChange",
      "positionChange": 96870,
      "momentDate": "2026-11-03"
    },
    {
      "debtId": "jd-c-0024656",
      "tradeId": "tr-24646",
      "underlying": "TSLA",
      "kind": "CloseReview",
      "positionChange": 24656,
      "momentDate": "2026-11-03"
    },
    {
      "debtId": "jd-b-0096871",
      "tradeId": "tr-24649",
      "underlying": "NFLX",
      "kind": "PositionChange",
      "positionChange": 96871,
      "momentDate": "2026-11-03"
    },
    {
      "debtId": "jd-c-0024657",
      "tradeId": "tr-24649",
      "underlying": "NFLX",
      "kind": "CloseReview",
      "positionChange": 24657,
      "momentDate": "2026-11-03"
    },
    {
      "debtId": "jd-b-0096872",
      "tradeId": "tr-24653",
      "underlying": "JPM",
      "kind": "PositionChange",
      "positionChange": 96872,
      "momentDate": "2026-11-03"
    },
    {
      "debtId": "jd-b-0096873",
      "tradeId": "tr-24654",
      "underlying": "V",
      "kind": "PositionChange",
      "positionChange": 96873,
      "momentDate": "2026-11-03"
    },
    {
      "debtId": "jd-c-0024658",
      "tradeId": "tr-24654",
      "underlying": "V",
      "kind": "CloseReview",
      "positionChange": 24658,
      "momentDate": "2026-11-03"
    },
    {
      "debtId": "jd-b-0096874",
      "tradeId": "tr-24656",
      "underlying": "UNH",
      "kind": "PositionChange",
      "positionChange": 96874,
      "momentDate": "2026-11-03"
    },
    {
      "debtId": "jd-c-0024659",
      "tradeId": "tr-24656",
      "underlying": "UNH",
      "kind": "CloseReview",
      "positionChange": 24659,
      "momentDate": "2026-11-03"
    },
    {
      "debtId": "jd-b-0096875",
      "tradeId": "tr-24657",
      "underlying": "HD",
      "kind": "PositionChange",
      "positionChange": 96875,
      "momentDate": "2026-11-03"
    },
    {
      "debtId": "jd-c-0024660",
      "tradeId": "tr-24657",
      "underlying": "HD",
      "kind": "CloseReview",
      "positionChange": 24660,
      "momentDate": "2026-11-03"
    },
    {
      "debtId": "jd-b-0096876",
      "tradeId": "tr-24658",
      "underlying": "PG",
      "kind": "PositionChange",
      "positionChange": 96876,
      "momentDate": "2026-11-03"
    },
    {
      "debtId": "jd-b-0096877",
      "tradeId": "tr-24659",
      "underlying": "XOM",
      "kind": "PositionChange",
      "positionChange": 96877,
      "momentDate": "2026-11-03"
    },
    {
      "debtId": "jd-c-0024661",
      "tradeId": "tr-24659",
      "underlying": "XOM",
      "kind": "CloseReview",
      "positionChange": 24661,
      "momentDate": "2026-11-03"
    },
    {
      "debtId": "jd-b-0096878",
      "tradeId": "tr-24661",
      "underlying": "LLY",
      "kind": "PositionChange",
      "positionChange": 96878,
      "momentDate": "2026-11-03"
    },
    {
      "debtId": "jd-b-0096879",
      "tradeId": "tr-24665",
      "underlying": "ADBE",
      "kind": "PositionChange",
      "positionChange": 96879,
      "momentDate": "2026-11-03"
    },
    {
      "debtId": "jd-b-0096880",
      "tradeId": "tr-24666",
      "underlying": "CRM",
      "kind": "PositionChange",
      "positionChange": 96880,
      "momentDate": "2026-11-03"
    },
    {
      "debtId": "jd-c-0024662",
      "tradeId": "tr-24666",
      "underlying": "CRM",
      "kind": "CloseReview",
      "positionChange": 24662,
      "momentDate": "2026-11-03"
    },
    {
      "debtId": "jd-b-0096881",
      "tradeId": "tr-24668",
      "underlying": "AMD",
      "kind": "PositionChange",
      "positionChange": 96881,
      "momentDate": "2026-11-03"
    },
    {
      "debtId": "jd-c-0024663",
      "tradeId": "tr-24668",
      "underlying": "AMD",
      "kind": "CloseReview",
      "positionChange": 24663,
      "momentDate": "2026-11-03"
    },
    {
      "debtId": "jd-b-0096882",
      "tradeId": "tr-24669",
      "underlying": "INTC",
      "kind": "PositionChange",
      "positionChange": 96882,
      "momentDate": "2026-11-03"
    },
    {
      "debtId": "jd-c-0024664",
      "tradeId": "tr-24669",
      "underlying": "INTC",
      "kind": "CloseReview",
      "positionChange": 24664,
      "momentDate": "2026-11-03"
    },
    {
      "debtId": "jd-b-0096883",
      "tradeId": "tr-24671",
      "underlying": "TXN",
      "kind": "PositionChange",
      "positionChange": 96883,
      "momentDate": "2026-11-03"
    },
    {
      "debtId": "jd-c-0024665",
      "tradeId": "tr-24671",
      "underlying": "TXN",
      "kind": "CloseReview",
      "positionChange": 24665,
      "momentDate": "2026-11-03"
    },
    {
      "debtId": "jd-b-0096884",
      "tradeId": "tr-24673",
      "underlying": "DIS",
      "kind": "PositionChange",
      "positionChange": 96884,
      "momentDate": "2026-11-03"
    },
    {
      "debtId": "jd-b-0096885",
      "tradeId": "tr-24677",
      "underlying": "CAT",
      "kind": "PositionChange",
      "positionChange": 96885,
      "momentDate": "2026-11-03"
    },
    {
      "debtId": "jd-b-0096886",
      "tradeId": "tr-24678",
      "underlying": "DE",
      "kind": "PositionChange",
      "positionChange": 96886,
      "momentDate": "2026-11-03"
    },
    {
      "debtId": "jd-c-0024666",
      "tradeId": "tr-24678",
      "underlying": "DE",
      "kind": "CloseReview",
      "positionChange": 24666,
      "momentDate": "2026-11-03"
    },
    {
      "debtId": "jd-b-0096887",
      "tradeId": "tr-24680",
      "underlying": "AAPL",
      "kind": "PositionChange",
      "positionChange": 96887,
      "momentDate": "2026-11-03"
    },
    {
      "debtId": "jd-c-0024667",
      "tradeId": "tr-24680",
      "underlying": "AAPL",
      "kind": "CloseReview",
      "positionChange": 24667,
      "momentDate": "2026-11-03"
    },
    {
      "debtId": "jd-b-0096888",
      "tradeId": "tr-24683",
      "underlying": "AMZN",
      "kind": "PositionChange",
      "positionChange": 96888,
      "momentDate": "2026-11-03"
    },
    {
      "debtId": "jd-c-0024668",
      "tradeId": "tr-24683",
      "underlying": "AMZN",
      "kind": "CloseReview",
      "positionChange": 24668,
      "momentDate": "2026-11-03"
    },
    {
      "debtId": "jd-b-0096889",
      "tradeId": "tr-24685",
      "underlying": "META",
      "kind": "PositionChange",
      "positionChange": 96889,
      "momentDate": "2026-11-03"
    },
    {
      "debtId": "jd-b-0096890",
      "tradeId": "tr-24688",
      "underlying": "COST",
      "kind": "PositionChange",
      "positionChange": 96890,
      "momentDate": "2026-11-03"
    },
    {
      "debtId": "jd-c-0024669",
      "tradeId": "tr-24688",
      "underlying": "COST",
      "kind": "CloseReview",
      "positionChange": 24669,
      "momentDate": "2026-11-03"
    },
    {
      "debtId": "jd-b-0096891",
      "tradeId": "tr-24690",
      "underlying": "CSCO",
      "kind": "PositionChange",
      "positionChange": 96891,
      "momentDate": "2026-11-03"
    },
    {
      "debtId": "jd-b-0096892",
      "tradeId": "tr-24691",
      "underlying": "KO",
      "kind": "PositionChange",
      "positionChange": 96892,
      "momentDate": "2026-11-03"
    },
    {
      "debtId": "jd-c-0024670",
      "tradeId": "tr-24691",
      "underlying": "KO",
      "kind": "CloseReview",
      "positionChange": 24670,
      "momentDate": "2026-11-03"
    },
    {
      "debtId": "jd-b-0096893",
      "tradeId": "tr-24692",
      "underlying": "PFE",
      "kind": "PositionChange",
      "positionChange": 96893,
      "momentDate": "2026-11-03"
    },
    {
      "debtId": "jd-b-0096894",
      "tradeId": "tr-24693",
      "underlying": "JPM",
      "kind": "PositionChange",
      "positionChange": 96894,
      "momentDate": "2026-11-03"
    },
    {
      "debtId": "jd-b-0096895",
      "tradeId": "tr-24697",
      "underlying": "HD",
      "kind": "PositionChange",
      "positionChange": 96895,
      "momentDate": "2026-11-03"
    },
    {
      "debtId": "jd-b-0096896",
      "tradeId": "tr-24758",
      "underlying": "QAA",
      "kind": "PositionChange",
      "positionChange": 96896,
      "momentDate": "2026-11-03"
    },
    {
      "debtId": "jd-b-0096897",
      "tradeId": "tr-24762",
      "underlying": "CVX",
      "kind": "PositionChange",
      "positionChange": 96897,
      "momentDate": "2026-11-03"
    },
    {
      "debtId": "jd-b-0096898",
      "tradeId": "tr-24766",
      "underlying": "QAF",
      "kind": "PositionChange",
      "positionChange": 96898,
      "momentDate": "2026-11-03"
    },
    {
      "debtId": "jd-b-0096899",
      "tradeId": "tr-24770",
      "underlying": "LLY",
      "kind": "PositionChange",
      "positionChange": 96899,
      "momentDate": "2026-11-03"
    },
    {
      "debtId": "jd-b-0096900",
      "tradeId": "tr-24774",
      "underlying": "QAK",
      "kind": "PositionChange",
      "positionChange": 96900,
      "momentDate": "2026-11-03"
    },
    {
      "debtId": "jd-b-0096901",
      "tradeId": "tr-24778",
      "underlying": "QAO",
      "kind": "PositionChange",
      "positionChange": 96901,
      "momentDate": "2026-11-03"
    },
    {
      "debtId": "jd-b-0096902",
      "tradeId": "tr-24782",
      "underlying": "CRM",
      "kind": "PositionChange",
      "positionChange": 96902,
      "momentDate": "2026-11-03"
    },
    {
      "debtId": "jd-b-0096903",
      "tradeId": "tr-24786",
      "underlying": "QAT",
      "kind": "PositionChange",
      "positionChange": 96903,
      "momentDate": "2026-11-03"
    },
    {
      "debtId": "jd-b-0096904",
      "tradeId": "tr-24790",
      "underlying": "ORCL",
      "kind": "PositionChange",
      "positionChange": 96904,
      "momentDate": "2026-11-03"
    },
    {
      "debtId": "jd-b-0096905",
      "tradeId": "tr-24791",
      "underlying": "AMD",
      "kind": "PositionChange",
      "positionChange": 96905,
      "momentDate": "2026-11-03"
    },
    {
      "debtId": "jd-b-0096906",
      "tradeId": "tr-24793",
      "underlying": "QAX",
      "kind": "PositionChange",
      "positionChange": 96906,
      "momentDate": "2026-11-03"
    },
    {
      "debtId": "jd-b-0096907",
      "tradeId": "tr-24794",
      "underlying": "QAY",
      "kind": "PositionChange",
      "positionChange": 96907,
      "momentDate": "2026-11-03"
    },
    {
      "debtId": "jd-b-0096908",
      "tradeId": "tr-24795",
      "underlying": "QAZ",
      "kind": "PositionChange",
      "positionChange": 96908,
      "momentDate": "2026-11-03"
    },
    {
      "debtId": "jd-b-0096909",
      "tradeId": "tr-24797",
      "underlying": "QBB",
      "kind": "PositionChange",
      "positionChange": 96909,
      "momentDate": "2026-11-03"
    },
    {
      "debtId": "jd-b-0096910",
      "tradeId": "tr-24798",
      "underlying": "QBC",
      "kind": "PositionChange",
      "positionChange": 96910,
      "momentDate": "2026-11-03"
    },
    {
      "debtId": "jd-b-0096911",
      "tradeId": "tr-24799",
      "underlying": "QBD",
      "kind": "PositionChange",
      "positionChange": 96911,
      "momentDate": "2026-11-03"
    },
    {
      "debtId": "jd-b-0096912",
      "tradeId": "tr-24801",
      "underlying": "TXN",
      "kind": "PositionChange",
      "positionChange": 96912,
      "momentDate": "2026-11-03"
    },
    {
      "debtId": "jd-b-0096913",
      "tradeId": "tr-24802",
      "underlying": "WMT",
      "kind": "PositionChange",
      "positionChange": 96913,
      "momentDate": "2026-11-03"
    },
    {
      "debtId": "jd-b-0096914",
      "tradeId": "tr-24803",
      "underlying": "QBE",
      "kind": "PositionChange",
      "positionChange": 96914,
      "momentDate": "2026-11-03"
    },
    {
      "debtId": "jd-b-0096915",
      "tradeId": "tr-24805",
      "underlying": "QBG",
      "kind": "PositionChange",
      "positionChange": 96915,
      "momentDate": "2026-11-03"
    },
    {
      "debtId": "jd-b-0096916",
      "tradeId": "tr-24806",
      "underlying": "QBH",
      "kind": "PositionChange",
      "positionChange": 96916,
      "momentDate": "2026-11-03"
    },
    {
      "debtId": "jd-b-0096917",
      "tradeId": "tr-24807",
      "underlying": "QBI",
      "kind": "PositionChange",
      "positionChange": 96917,
      "momentDate": "2026-11-03"
    },
    {
      "debtId": "jd-b-0096918",
      "tradeId": "tr-24809",
      "underlying": "QBK",
      "kind": "PositionChange",
      "positionChange": 96918,
      "momentDate": "2026-11-03"
    },
    {
      "debtId": "jd-b-0096919",
      "tradeId": "tr-24810",
      "underlying": "DIS",
      "kind": "PositionChange",
      "positionChange": 96919,
      "momentDate": "2026-11-03"
    },
    {
      "debtId": "jd-b-0096920",
      "tradeId": "tr-24811",
      "underlying": "NKE",
      "kind": "PositionChange",
      "positionChange": 96920,
      "momentDate": "2026-11-03"
    },
    {
      "debtId": "jd-b-0096921",
      "tradeId": "tr-24813",
      "underlying": "QBL",
      "kind": "PositionChange",
      "positionChange": 96921,
      "momentDate": "2026-11-03"
    },
    {
      "debtId": "jd-b-0096922",
      "tradeId": "tr-24814",
      "underlying": "QBM",
      "kind": "PositionChange",
      "positionChange": 96922,
      "momentDate": "2026-11-03"
    },
    {
      "debtId": "jd-b-0096923",
      "tradeId": "tr-24815",
      "underlying": "QBN",
      "kind": "PositionChange",
      "positionChange": 96923,
      "momentDate": "2026-11-03"
    },
    {
      "debtId": "jd-b-0096924",
      "tradeId": "tr-24817",
      "underlying": "QBP",
      "kind": "PositionChange",
      "positionChange": 96924,
      "momentDate": "2026-11-03"
    },
    {
      "debtId": "jd-b-0096925",
      "tradeId": "tr-24818",
      "underlying": "QBQ",
      "kind": "PositionChange",
      "positionChange": 96925,
      "momentDate": "2026-11-03"
    },
    {
      "debtId": "jd-b-0096926",
      "tradeId": "tr-24819",
      "underlying": "QBR",
      "kind": "PositionChange",
      "positionChange": 96926,
      "momentDate": "2026-11-03"
    },
    {
      "debtId": "jd-b-0096927",
      "tradeId": "tr-24821",
      "underlying": "CAT",
      "kind": "PositionChange",
      "positionChange": 96927,
      "momentDate": "2026-11-03"
    },
    {
      "debtId": "jd-b-0096928",
      "tradeId": "tr-24822",
      "underlying": "DE",
      "kind": "PositionChange",
      "positionChange": 96928,
      "momentDate": "2026-11-03"
    },
    {
      "debtId": "jd-b-0096929",
      "tradeId": "tr-24823",
      "underlying": "QBS",
      "kind": "PositionChange",
      "positionChange": 96929,
      "momentDate": "2026-11-03"
    },
    {
      "debtId": "jd-b-0096930",
      "tradeId": "tr-24825",
      "underlying": "QBU",
      "kind": "PositionChange",
      "positionChange": 96930,
      "momentDate": "2026-11-03"
    },
    {
      "debtId": "jd-b-0096931",
      "tradeId": "tr-24826",
      "underlying": "QBV",
      "kind": "PositionChange",
      "positionChange": 96931,
      "momentDate": "2026-11-03"
    },
    {
      "debtId": "jd-b-0096932",
      "tradeId": "tr-24827",
      "underlying": "QBW",
      "kind": "PositionChange",
      "positionChange": 96932,
      "momentDate": "2026-11-03"
    },
    {
      "debtId": "jd-b-0096933",
      "tradeId": "tr-24828",
      "underlying": "QBX",
      "kind": "PositionChange",
      "positionChange": 96933,
      "momentDate": "2026-11-03"
    },
    {
      "debtId": "jd-b-0096934",
      "tradeId": "tr-24829",
      "underlying": "AAPL",
      "kind": "PositionChange",
      "positionChange": 96934,
      "momentDate": "2026-11-03"
    },
    {
      "debtId": "jd-b-0096935",
      "tradeId": "tr-24830",
      "underlying": "GS",
      "kind": "PositionChange",
      "positionChange": 96935,
      "momentDate": "2026-11-03"
    },
    {
      "debtId": "jd-b-0096936",
      "tradeId": "tr-24831",
      "underlying": "QAA",
      "kind": "PositionChange",
      "positionChange": 96936,
      "momentDate": "2026-11-03"
    },
    {
      "debtId": "jd-b-0096937",
      "tradeId": "tr-24832",
      "underlying": "QAB",
      "kind": "PositionChange",
      "positionChange": 96937,
      "momentDate": "2026-11-03"
    },
    {
      "debtId": "jd-b-0096938",
      "tradeId": "tr-24833",
      "underlying": "MSFT",
      "kind": "PositionChange",
      "positionChange": 96938,
      "momentDate": "2026-11-03"
    },
    {
      "debtId": "jd-b-0096939",
      "tradeId": "tr-24834",
      "underlying": "NVDA",
      "kind": "PositionChange",
      "positionChange": 96939,
      "momentDate": "2026-11-03"
    },
    {
      "debtId": "jd-b-0096940",
      "tradeId": "tr-24835",
      "underlying": "AMZN",
      "kind": "PositionChange",
      "positionChange": 96940,
      "momentDate": "2026-11-03"
    },
    {
      "debtId": "jd-b-0096941",
      "tradeId": "tr-24836",
      "underlying": "GOOGL",
      "kind": "PositionChange",
      "positionChange": 96941,
      "momentDate": "2026-11-03"
    },
    {
      "debtId": "jd-b-0096942",
      "tradeId": "tr-24837",
      "underlying": "META",
      "kind": "PositionChange",
      "positionChange": 96942,
      "momentDate": "2026-11-03"
    },
    {
      "debtId": "jd-b-0096943",
      "tradeId": "tr-24838",
      "underlying": "TSLA",
      "kind": "PositionChange",
      "positionChange": 96943,
      "momentDate": "2026-11-03"
    },
    {
      "debtId": "jd-b-0096944",
      "tradeId": "tr-24839",
      "underlying": "AVGO",
      "kind": "PositionChange",
      "positionChange": 96944,
      "momentDate": "2026-11-03"
    },
    {
      "debtId": "jd-b-0096945",
      "tradeId": "tr-24840",
      "underlying": "QAC",
      "kind": "PositionChange",
      "positionChange": 96945,
      "momentDate": "2026-11-03"
    },
    {
      "debtId": "jd-b-0096946",
      "tradeId": "tr-24841",
      "underlying": "QAD",
      "kind": "PositionChange",
      "positionChange": 96946,
      "momentDate": "2026-11-03"
    },
    {
      "debtId": "jd-b-0096947",
      "tradeId": "tr-24842",
      "underlying": "QAE",
      "kind": "PositionChange",
      "positionChange": 96947,
      "momentDate": "2026-11-03"
    },
    {
      "debtId": "jd-b-0096948",
      "tradeId": "tr-24843",
      "underlying": "COST",
      "kind": "PositionChange",
      "positionChange": 96948,
      "momentDate": "2026-11-03"
    },
    {
      "debtId": "jd-b-0096949",
      "tradeId": "tr-24844",
      "underlying": "NFLX",
      "kind": "PositionChange",
      "positionChange": 96949,
      "momentDate": "2026-11-03"
    },
    {
      "debtId": "jd-b-0096950",
      "tradeId": "tr-24845",
      "underlying": "CSCO",
      "kind": "PositionChange",
      "positionChange": 96950,
      "momentDate": "2026-11-03"
    },
    {
      "debtId": "jd-b-0096951",
      "tradeId": "tr-24846",
      "underlying": "KO",
      "kind": "PositionChange",
      "positionChange": 96951,
      "momentDate": "2026-11-03"
    },
    {
      "debtId": "jd-b-0096952",
      "tradeId": "tr-24847",
      "underlying": "PFE",
      "kind": "PositionChange",
      "positionChange": 96952,
      "momentDate": "2026-11-03"
    },
    {
      "debtId": "jd-b-0096953",
      "tradeId": "tr-24848",
      "underlying": "JPM",
      "kind": "PositionChange",
      "positionChange": 96953,
      "momentDate": "2026-11-03"
    },
    {
      "debtId": "jd-b-0096954",
      "tradeId": "tr-24849",
      "underlying": "V",
      "kind": "PositionChange",
      "positionChange": 96954,
      "momentDate": "2026-11-03"
    },
    {
      "debtId": "jd-b-0096955",
      "tradeId": "tr-24850",
      "underlying": "QAF",
      "kind": "PositionChange",
      "positionChange": 96955,
      "momentDate": "2026-11-03"
    },
    {
      "debtId": "jd-b-0096956",
      "tradeId": "tr-24851",
      "underlying": "QAG",
      "kind": "PositionChange",
      "positionChange": 96956,
      "momentDate": "2026-11-03"
    },
    {
      "debtId": "jd-b-0096957",
      "tradeId": "tr-24852",
      "underlying": "QAH",
      "kind": "PositionChange",
      "positionChange": 96957,
      "momentDate": "2026-11-03"
    },
    {
      "debtId": "jd-b-0096958",
      "tradeId": "tr-24853",
      "underlying": "MA",
      "kind": "PositionChange",
      "positionChange": 96958,
      "momentDate": "2026-11-03"
    },
    {
      "debtId": "jd-b-0096959",
      "tradeId": "tr-24854",
      "underlying": "UNH",
      "kind": "PositionChange",
      "positionChange": 96959,
      "momentDate": "2026-11-03"
    },
    {
      "debtId": "jd-b-0096960",
      "tradeId": "tr-24855",
      "underlying": "HD",
      "kind": "PositionChange",
      "positionChange": 96960,
      "momentDate": "2026-11-03"
    },
    {
      "debtId": "jd-b-0096961",
      "tradeId": "tr-24856",
      "underlying": "PG",
      "kind": "PositionChange",
      "positionChange": 96961,
      "momentDate": "2026-11-03"
    },
    {
      "debtId": "jd-b-0096962",
      "tradeId": "tr-24857",
      "underlying": "XOM",
      "kind": "PositionChange",
      "positionChange": 96962,
      "momentDate": "2026-11-03"
    },
    {
      "debtId": "jd-b-0096963",
      "tradeId": "tr-24858",
      "underlying": "CVX",
      "kind": "PositionChange",
      "positionChange": 96963,
      "momentDate": "2026-11-03"
    },
    {
      "debtId": "jd-b-0096964",
      "tradeId": "tr-24859",
      "underlying": "LLY",
      "kind": "PositionChange",
      "positionChange": 96964,
      "momentDate": "2026-11-03"
    },
    {
      "debtId": "jd-b-0096965",
      "tradeId": "tr-24860",
      "underlying": "QAI",
      "kind": "PositionChange",
      "positionChange": 96965,
      "momentDate": "2026-11-03"
    },
    {
      "debtId": "jd-b-0096966",
      "tradeId": "tr-24590",
      "underlying": "QCOM",
      "kind": "PositionChange",
      "positionChange": 96966,
      "momentDate": "2026-11-03"
    },
    {
      "debtId": "jd-c-0024671",
      "tradeId": "tr-24590",
      "underlying": "QCOM",
      "kind": "CloseReview",
      "positionChange": 24671,
      "momentDate": "2026-11-03"
    },
    {
      "debtId": "jd-b-0096967",
      "tradeId": "tr-24593",
      "underlying": "DIS",
      "kind": "PositionChange",
      "positionChange": 96967,
      "momentDate": "2026-11-03"
    },
    {
      "debtId": "jd-c-0024672",
      "tradeId": "tr-24593",
      "underlying": "DIS",
      "kind": "CloseReview",
      "positionChange": 24672,
      "momentDate": "2026-11-03"
    },
    {
      "debtId": "jd-b-0096968",
      "tradeId": "tr-24617",
      "underlying": "HD",
      "kind": "PositionChange",
      "positionChange": 96968,
      "momentDate": "2026-11-04"
    },
    {
      "debtId": "jd-c-0024673",
      "tradeId": "tr-24617",
      "underlying": "HD",
      "kind": "CloseReview",
      "positionChange": 24673,
      "momentDate": "2026-11-04"
    },
    {
      "debtId": "jd-b-0096969",
      "tradeId": "tr-24626",
      "underlying": "CRM",
      "kind": "PositionChange",
      "positionChange": 96969,
      "momentDate": "2026-11-04"
    },
    {
      "debtId": "jd-c-0024674",
      "tradeId": "tr-24626",
      "underlying": "CRM",
      "kind": "CloseReview",
      "positionChange": 24674,
      "momentDate": "2026-11-04"
    },
    {
      "debtId": "jd-b-0096970",
      "tradeId": "tr-24629",
      "underlying": "INTC",
      "kind": "PositionChange",
      "positionChange": 96970,
      "momentDate": "2026-11-04"
    },
    {
      "debtId": "jd-c-0024675",
      "tradeId": "tr-24629",
      "underlying": "INTC",
      "kind": "CloseReview",
      "positionChange": 24675,
      "momentDate": "2026-11-04"
    },
    {
      "debtId": "jd-b-0096971",
      "tradeId": "tr-24638",
      "underlying": "DE",
      "kind": "PositionChange",
      "positionChange": 96971,
      "momentDate": "2026-11-04"
    },
    {
      "debtId": "jd-c-0024676",
      "tradeId": "tr-24638",
      "underlying": "DE",
      "kind": "CloseReview",
      "positionChange": 24676,
      "momentDate": "2026-11-04"
    },
    {
      "debtId": "jd-b-0096972",
      "tradeId": "tr-24641",
      "underlying": "MSFT",
      "kind": "PositionChange",
      "positionChange": 96972,
      "momentDate": "2026-11-04"
    },
    {
      "debtId": "jd-c-0024677",
      "tradeId": "tr-24641",
      "underlying": "MSFT",
      "kind": "CloseReview",
      "positionChange": 24677,
      "momentDate": "2026-11-04"
    },
    {
      "debtId": "jd-b-0096973",
      "tradeId": "tr-24653",
      "underlying": "JPM",
      "kind": "PositionChange",
      "positionChange": 96973,
      "momentDate": "2026-11-04"
    },
    {
      "debtId": "jd-b-0096974",
      "tradeId": "tr-24658",
      "underlying": "PG",
      "kind": "PositionChange",
      "positionChange": 96974,
      "momentDate": "2026-11-04"
    },
    {
      "debtId": "jd-c-0024678",
      "tradeId": "tr-24658",
      "underlying": "PG",
      "kind": "CloseReview",
      "positionChange": 24678,
      "momentDate": "2026-11-04"
    },
    {
      "debtId": "jd-b-0096975",
      "tradeId": "tr-24661",
      "underlying": "LLY",
      "kind": "PositionChange",
      "positionChange": 96975,
      "momentDate": "2026-11-04"
    },
    {
      "debtId": "jd-c-0024679",
      "tradeId": "tr-24661",
      "underlying": "LLY",
      "kind": "CloseReview",
      "positionChange": 24679,
      "momentDate": "2026-11-04"
    },
    {
      "debtId": "jd-b-0096976",
      "tradeId": "tr-24665",
      "underlying": "ADBE",
      "kind": "PositionChange",
      "positionChange": 96976,
      "momentDate": "2026-11-04"
    },
    {
      "debtId": "jd-b-0096977",
      "tradeId": "tr-24673",
      "underlying": "DIS",
      "kind": "PositionChange",
      "positionChange": 96977,
      "momentDate": "2026-11-04"
    },
    {
      "debtId": "jd-c-0024680",
      "tradeId": "tr-24673",
      "underlying": "DIS",
      "kind": "CloseReview",
      "positionChange": 24680,
      "momentDate": "2026-11-04"
    },
    {
      "debtId": "jd-b-0096978",
      "tradeId": "tr-24674",
      "underlying": "NKE",
      "kind": "PositionChange",
      "positionChange": 96978,
      "momentDate": "2026-11-04"
    },
    {
      "debtId": "jd-b-0096979",
      "tradeId": "tr-24677",
      "underlying": "CAT",
      "kind": "PositionChange",
      "positionChange": 96979,
      "momentDate": "2026-11-04"
    },
    {
      "debtId": "jd-b-0096980",
      "tradeId": "tr-24685",
      "underlying": "META",
      "kind": "PositionChange",
      "positionChange": 96980,
      "momentDate": "2026-11-04"
    },
    {
      "debtId": "jd-c-0024681",
      "tradeId": "tr-24685",
      "underlying": "META",
      "kind": "CloseReview",
      "positionChange": 24681,
      "momentDate": "2026-11-04"
    },
    {
      "debtId": "jd-b-0096981",
      "tradeId": "tr-24689",
      "underlying": "NFLX",
      "kind": "PositionChange",
      "positionChange": 96981,
      "momentDate": "2026-11-04"
    },
    {
      "debtId": "jd-b-0096982",
      "tradeId": "tr-24690",
      "underlying": "CSCO",
      "kind": "PositionChange",
      "positionChange": 96982,
      "momentDate": "2026-11-04"
    },
    {
      "debtId": "jd-c-0024682",
      "tradeId": "tr-24690",
      "underlying": "CSCO",
      "kind": "CloseReview",
      "positionChange": 24682,
      "momentDate": "2026-11-04"
    },
    {
      "debtId": "jd-b-0096983",
      "tradeId": "tr-24692",
      "underlying": "PFE",
      "kind": "PositionChange",
      "positionChange": 96983,
      "momentDate": "2026-11-04"
    },
    {
      "debtId": "jd-c-0024683",
      "tradeId": "tr-24692",
      "underlying": "PFE",
      "kind": "CloseReview",
      "positionChange": 24683,
      "momentDate": "2026-11-04"
    },
    {
      "debtId": "jd-b-0096984",
      "tradeId": "tr-24693",
      "underlying": "JPM",
      "kind": "PositionChange",
      "positionChange": 96984,
      "momentDate": "2026-11-04"
    },
    {
      "debtId": "jd-c-0024684",
      "tradeId": "tr-24693",
      "underlying": "JPM",
      "kind": "CloseReview",
      "positionChange": 24684,
      "momentDate": "2026-11-04"
    },
    {
      "debtId": "jd-b-0096985",
      "tradeId": "tr-24694",
      "underlying": "V",
      "kind": "PositionChange",
      "positionChange": 96985,
      "momentDate": "2026-11-04"
    },
    {
      "debtId": "jd-b-0096986",
      "tradeId": "tr-24695",
      "underlying": "MA",
      "kind": "PositionChange",
      "positionChange": 96986,
      "momentDate": "2026-11-04"
    },
    {
      "debtId": "jd-c-0024685",
      "tradeId": "tr-24695",
      "underlying": "MA",
      "kind": "CloseReview",
      "positionChange": 24685,
      "momentDate": "2026-11-04"
    },
    {
      "debtId": "jd-b-0096987",
      "tradeId": "tr-24697",
      "underlying": "HD",
      "kind": "PositionChange",
      "positionChange": 96987,
      "momentDate": "2026-11-04"
    },
    {
      "debtId": "jd-b-0096988",
      "tradeId": "tr-24794",
      "underlying": "QAY",
      "kind": "PositionChange",
      "positionChange": 96988,
      "momentDate": "2026-11-04"
    },
    {
      "debtId": "jd-b-0096989",
      "tradeId": "tr-24798",
      "underlying": "QBC",
      "kind": "PositionChange",
      "positionChange": 96989,
      "momentDate": "2026-11-04"
    },
    {
      "debtId": "jd-b-0096990",
      "tradeId": "tr-24802",
      "underlying": "WMT",
      "kind": "PositionChange",
      "positionChange": 96990,
      "momentDate": "2026-11-04"
    },
    {
      "debtId": "jd-b-0096991",
      "tradeId": "tr-24806",
      "underlying": "QBH",
      "kind": "PositionChange",
      "positionChange": 96991,
      "momentDate": "2026-11-04"
    },
    {
      "debtId": "jd-b-0096992",
      "tradeId": "tr-24810",
      "underlying": "DIS",
      "kind": "PositionChange",
      "positionChange": 96992,
      "momentDate": "2026-11-04"
    },
    {
      "debtId": "jd-b-0096993",
      "tradeId": "tr-24814",
      "underlying": "QBM",
      "kind": "PositionChange",
      "positionChange": 96993,
      "momentDate": "2026-11-04"
    },
    {
      "debtId": "jd-b-0096994",
      "tradeId": "tr-24818",
      "underlying": "QBQ",
      "kind": "PositionChange",
      "positionChange": 96994,
      "momentDate": "2026-11-04"
    },
    {
      "debtId": "jd-b-0096995",
      "tradeId": "tr-24822",
      "underlying": "DE",
      "kind": "PositionChange",
      "positionChange": 96995,
      "momentDate": "2026-11-04"
    },
    {
      "debtId": "jd-b-0096996",
      "tradeId": "tr-24826",
      "underlying": "QBV",
      "kind": "PositionChange",
      "positionChange": 96996,
      "momentDate": "2026-11-04"
    },
    {
      "debtId": "jd-b-0096997",
      "tradeId": "tr-24827",
      "underlying": "QBW",
      "kind": "PositionChange",
      "positionChange": 96997,
      "momentDate": "2026-11-04"
    },
    {
      "debtId": "jd-b-0096998",
      "tradeId": "tr-24829",
      "underlying": "AAPL",
      "kind": "PositionChange",
      "positionChange": 96998,
      "momentDate": "2026-11-04"
    },
    {
      "debtId": "jd-b-0096999",
      "tradeId": "tr-24830",
      "underlying": "GS",
      "kind": "PositionChange",
      "positionChange": 96999,
      "momentDate": "2026-11-04"
    },
    {
      "debtId": "jd-b-0097000",
      "tradeId": "tr-24831",
      "underlying": "QAA",
      "kind": "PositionChange",
      "positionChange": 97000,
      "momentDate": "2026-11-04"
    },
    {
      "debtId": "jd-b-0097001",
      "tradeId": "tr-24833",
      "underlying": "MSFT",
      "kind": "PositionChange",
      "positionChange": 97001,
      "momentDate": "2026-11-04"
    },
    {
      "debtId": "jd-b-0097002",
      "tradeId": "tr-24834",
      "underlying": "NVDA",
      "kind": "PositionChange",
      "positionChange": 97002,
      "momentDate": "2026-11-04"
    },
    {
      "debtId": "jd-b-0097003",
      "tradeId": "tr-24835",
      "underlying": "AMZN",
      "kind": "PositionChange",
      "positionChange": 97003,
      "momentDate": "2026-11-04"
    },
    {
      "debtId": "jd-b-0097004",
      "tradeId": "tr-24837",
      "underlying": "META",
      "kind": "PositionChange",
      "positionChange": 97004,
      "momentDate": "2026-11-04"
    },
    {
      "debtId": "jd-b-0097005",
      "tradeId": "tr-24838",
      "underlying": "TSLA",
      "kind": "PositionChange",
      "positionChange": 97005,
      "momentDate": "2026-11-04"
    },
    {
      "debtId": "jd-b-0097006",
      "tradeId": "tr-24839",
      "underlying": "AVGO",
      "kind": "PositionChange",
      "positionChange": 97006,
      "momentDate": "2026-11-04"
    },
    {
      "debtId": "jd-b-0097007",
      "tradeId": "tr-24841",
      "underlying": "QAD",
      "kind": "PositionChange",
      "positionChange": 97007,
      "momentDate": "2026-11-04"
    },
    {
      "debtId": "jd-b-0097008",
      "tradeId": "tr-24842",
      "underlying": "QAE",
      "kind": "PositionChange",
      "positionChange": 97008,
      "momentDate": "2026-11-04"
    },
    {
      "debtId": "jd-b-0097009",
      "tradeId": "tr-24843",
      "underlying": "COST",
      "kind": "PositionChange",
      "positionChange": 97009,
      "momentDate": "2026-11-04"
    },
    {
      "debtId": "jd-b-0097010",
      "tradeId": "tr-24845",
      "underlying": "CSCO",
      "kind": "PositionChange",
      "positionChange": 97010,
      "momentDate": "2026-11-04"
    },
    {
      "debtId": "jd-b-0097011",
      "tradeId": "tr-24846",
      "underlying": "KO",
      "kind": "PositionChange",
      "positionChange": 97011,
      "momentDate": "2026-11-04"
    },
    {
      "debtId": "jd-b-0097012",
      "tradeId": "tr-24847",
      "underlying": "PFE",
      "kind": "PositionChange",
      "positionChange": 97012,
      "momentDate": "2026-11-04"
    },
    {
      "debtId": "jd-b-0097013",
      "tradeId": "tr-24849",
      "underlying": "V",
      "kind": "PositionChange",
      "positionChange": 97013,
      "momentDate": "2026-11-04"
    },
    {
      "debtId": "jd-b-0097014",
      "tradeId": "tr-24850",
      "underlying": "QAF",
      "kind": "PositionChange",
      "positionChange": 97014,
      "momentDate": "2026-11-04"
    },
    {
      "debtId": "jd-b-0097015",
      "tradeId": "tr-24851",
      "underlying": "QAG",
      "kind": "PositionChange",
      "positionChange": 97015,
      "momentDate": "2026-11-04"
    },
    {
      "debtId": "jd-b-0097016",
      "tradeId": "tr-24853",
      "underlying": "MA",
      "kind": "PositionChange",
      "positionChange": 97016,
      "momentDate": "2026-11-04"
    },
    {
      "debtId": "jd-b-0097017",
      "tradeId": "tr-24854",
      "underlying": "UNH",
      "kind": "PositionChange",
      "positionChange": 97017,
      "momentDate": "2026-11-04"
    },
    {
      "debtId": "jd-b-0097018",
      "tradeId": "tr-24855",
      "underlying": "HD",
      "kind": "PositionChange",
      "positionChange": 97018,
      "momentDate": "2026-11-04"
    },
    {
      "debtId": "jd-b-0097019",
      "tradeId": "tr-24857",
      "underlying": "XOM",
      "kind": "PositionChange",
      "positionChange": 97019,
      "momentDate": "2026-11-04"
    },
    {
      "debtId": "jd-b-0097020",
      "tradeId": "tr-24858",
      "underlying": "CVX",
      "kind": "PositionChange",
      "positionChange": 97020,
      "momentDate": "2026-11-04"
    },
    {
      "debtId": "jd-b-0097021",
      "tradeId": "tr-24859",
      "underlying": "LLY",
      "kind": "PositionChange",
      "positionChange": 97021,
      "momentDate": "2026-11-04"
    },
    {
      "debtId": "jd-b-0097022",
      "tradeId": "tr-24861",
      "underlying": "QAJ",
      "kind": "PositionChange",
      "positionChange": 97022,
      "momentDate": "2026-11-04"
    },
    {
      "debtId": "jd-b-0097023",
      "tradeId": "tr-24862",
      "underlying": "QAK",
      "kind": "PositionChange",
      "positionChange": 97023,
      "momentDate": "2026-11-04"
    },
    {
      "debtId": "jd-b-0097024",
      "tradeId": "tr-24863",
      "underlying": "ABBV",
      "kind": "PositionChange",
      "positionChange": 97024,
      "momentDate": "2026-11-04"
    },
    {
      "debtId": "jd-b-0097025",
      "tradeId": "tr-24864",
      "underlying": "MRK",
      "kind": "PositionChange",
      "positionChange": 97025,
      "momentDate": "2026-11-04"
    },
    {
      "debtId": "jd-b-0097026",
      "tradeId": "tr-24865",
      "underlying": "PEP",
      "kind": "PositionChange",
      "positionChange": 97026,
      "momentDate": "2026-11-04"
    },
    {
      "debtId": "jd-b-0097027",
      "tradeId": "tr-24866",
      "underlying": "ADBE",
      "kind": "PositionChange",
      "positionChange": 97027,
      "momentDate": "2026-11-04"
    },
    {
      "debtId": "jd-b-0097028",
      "tradeId": "tr-24867",
      "underlying": "CRM",
      "kind": "PositionChange",
      "positionChange": 97028,
      "momentDate": "2026-11-04"
    },
    {
      "debtId": "jd-b-0097029",
      "tradeId": "tr-24868",
      "underlying": "ORCL",
      "kind": "PositionChange",
      "positionChange": 97029,
      "momentDate": "2026-11-04"
    },
    {
      "debtId": "jd-b-0097030",
      "tradeId": "tr-24869",
      "underlying": "AMD",
      "kind": "PositionChange",
      "positionChange": 97030,
      "momentDate": "2026-11-04"
    },
    {
      "debtId": "jd-b-0097031",
      "tradeId": "tr-24870",
      "underlying": "QAL",
      "kind": "PositionChange",
      "positionChange": 97031,
      "momentDate": "2026-11-04"
    },
    {
      "debtId": "jd-b-0097032",
      "tradeId": "tr-24871",
      "underlying": "QAM",
      "kind": "PositionChange",
      "positionChange": 97032,
      "momentDate": "2026-11-04"
    },
    {
      "debtId": "jd-b-0097033",
      "tradeId": "tr-24872",
      "underlying": "QAN",
      "kind": "PositionChange",
      "positionChange": 97033,
      "momentDate": "2026-11-04"
    },
    {
      "debtId": "jd-b-0097034",
      "tradeId": "tr-24873",
      "underlying": "INTC",
      "kind": "PositionChange",
      "positionChange": 97034,
      "momentDate": "2026-11-04"
    },
    {
      "debtId": "jd-b-0097035",
      "tradeId": "tr-24874",
      "underlying": "QCOM",
      "kind": "PositionChange",
      "positionChange": 97035,
      "momentDate": "2026-11-04"
    },
    {
      "debtId": "jd-b-0097036",
      "tradeId": "tr-24875",
      "underlying": "TXN",
      "kind": "PositionChange",
      "positionChange": 97036,
      "momentDate": "2026-11-04"
    },
    {
      "debtId": "jd-b-0097037",
      "tradeId": "tr-24876",
      "underlying": "WMT",
      "kind": "PositionChange",
      "positionChange": 97037,
      "momentDate": "2026-11-04"
    },
    {
      "debtId": "jd-b-0097038",
      "tradeId": "tr-24877",
      "underlying": "DIS",
      "kind": "PositionChange",
      "positionChange": 97038,
      "momentDate": "2026-11-04"
    },
    {
      "debtId": "jd-b-0097039",
      "tradeId": "tr-24878",
      "underlying": "NKE",
      "kind": "PositionChange",
      "positionChange": 97039,
      "momentDate": "2026-11-04"
    },
    {
      "debtId": "jd-b-0097040",
      "tradeId": "tr-24879",
      "underlying": "MCD",
      "kind": "PositionChange",
      "positionChange": 97040,
      "momentDate": "2026-11-04"
    },
    {
      "debtId": "jd-b-0097041",
      "tradeId": "tr-24880",
      "underlying": "QAO",
      "kind": "PositionChange",
      "positionChange": 97041,
      "momentDate": "2026-11-04"
    },
    {
      "debtId": "jd-b-0097042",
      "tradeId": "tr-24881",
      "underlying": "QAP",
      "kind": "PositionChange",
      "positionChange": 97042,
      "momentDate": "2026-11-04"
    },
    {
      "debtId": "jd-b-0097043",
      "tradeId": "tr-24882",
      "underlying": "QAQ",
      "kind": "PositionChange",
      "positionChange": 97043,
      "momentDate": "2026-11-04"
    },
    {
      "debtId": "jd-b-0097044",
      "tradeId": "tr-24883",
      "underlying": "BA",
      "kind": "PositionChange",
      "positionChange": 97044,
      "momentDate": "2026-11-04"
    },
    {
      "debtId": "jd-b-0097045",
      "tradeId": "tr-24884",
      "underlying": "CAT",
      "kind": "PositionChange",
      "positionChange": 97045,
      "momentDate": "2026-11-04"
    },
    {
      "debtId": "jd-b-0097046",
      "tradeId": "tr-24885",
      "underlying": "DE",
      "kind": "PositionChange",
      "positionChange": 97046,
      "momentDate": "2026-11-04"
    },
    {
      "debtId": "jd-b-0097047",
      "tradeId": "tr-24886",
      "underlying": "GS",
      "kind": "PositionChange",
      "positionChange": 97047,
      "momentDate": "2026-11-04"
    },
    {
      "debtId": "jd-b-0097048",
      "tradeId": "tr-24887",
      "underlying": "QAA",
      "kind": "PositionChange",
      "positionChange": 97048,
      "momentDate": "2026-11-04"
    },
    {
      "debtId": "jd-b-0097049",
      "tradeId": "tr-24888",
      "underlying": "QAB",
      "kind": "PositionChange",
      "positionChange": 97049,
      "momentDate": "2026-11-04"
    },
    {
      "debtId": "jd-b-0097050",
      "tradeId": "tr-24889",
      "underlying": "QAC",
      "kind": "PositionChange",
      "positionChange": 97050,
      "momentDate": "2026-11-04"
    },
    {
      "debtId": "jd-b-0097051",
      "tradeId": "tr-24890",
      "underlying": "QAR",
      "kind": "PositionChange",
      "positionChange": 97051,
      "momentDate": "2026-11-04"
    },
    {
      "debtId": "jd-b-0097052",
      "tradeId": "tr-24891",
      "underlying": "QAS",
      "kind": "PositionChange",
      "positionChange": 97052,
      "momentDate": "2026-11-04"
    },
    {
      "debtId": "jd-b-0097053",
      "tradeId": "tr-24892",
      "underlying": "QAT",
      "kind": "PositionChange",
      "positionChange": 97053,
      "momentDate": "2026-11-04"
    },
    {
      "debtId": "jd-b-0097054",
      "tradeId": "tr-24893",
      "underlying": "QAD",
      "kind": "PositionChange",
      "positionChange": 97054,
      "momentDate": "2026-11-04"
    },
    {
      "debtId": "jd-b-0097055",
      "tradeId": "tr-24894",
      "underlying": "QAE",
      "kind": "PositionChange",
      "positionChange": 97055,
      "momentDate": "2026-11-04"
    },
    {
      "debtId": "jd-b-0097056",
      "tradeId": "tr-24895",
      "underlying": "QAF",
      "kind": "PositionChange",
      "positionChange": 97056,
      "momentDate": "2026-11-04"
    },
    {
      "debtId": "jd-b-0097057",
      "tradeId": "tr-24653",
      "underlying": "JPM",
      "kind": "PositionChange",
      "positionChange": 97057,
      "momentDate": "2026-11-05"
    },
    {
      "debtId": "jd-c-0024686",
      "tradeId": "tr-24653",
      "underlying": "JPM",
      "kind": "CloseReview",
      "positionChange": 24686,
      "momentDate": "2026-11-05"
    },
    {
      "debtId": "jd-b-0097058",
      "tradeId": "tr-24665",
      "underlying": "ADBE",
      "kind": "PositionChange",
      "positionChange": 97058,
      "momentDate": "2026-11-05"
    },
    {
      "debtId": "jd-c-0024687",
      "tradeId": "tr-24665",
      "underlying": "ADBE",
      "kind": "CloseReview",
      "positionChange": 24687,
      "momentDate": "2026-11-05"
    },
    {
      "debtId": "jd-b-0097059",
      "tradeId": "tr-24674",
      "underlying": "NKE",
      "kind": "PositionChange",
      "positionChange": 97059,
      "momentDate": "2026-11-05"
    },
    {
      "debtId": "jd-c-0024688",
      "tradeId": "tr-24674",
      "underlying": "NKE",
      "kind": "CloseReview",
      "positionChange": 24688,
      "momentDate": "2026-11-05"
    },
    {
      "debtId": "jd-b-0097060",
      "tradeId": "tr-24677",
      "underlying": "CAT",
      "kind": "PositionChange",
      "positionChange": 97060,
      "momentDate": "2026-11-05"
    },
    {
      "debtId": "jd-c-0024689",
      "tradeId": "tr-24677",
      "underlying": "CAT",
      "kind": "CloseReview",
      "positionChange": 24689,
      "momentDate": "2026-11-05"
    },
    {
      "debtId": "jd-b-0097061",
      "tradeId": "tr-24686",
      "underlying": "TSLA",
      "kind": "PositionChange",
      "positionChange": 97061,
      "momentDate": "2026-11-05"
    },
    {
      "debtId": "jd-b-0097062",
      "tradeId": "tr-24689",
      "underlying": "NFLX",
      "kind": "PositionChange",
      "positionChange": 97062,
      "momentDate": "2026-11-05"
    },
    {
      "debtId": "jd-b-0097063",
      "tradeId": "tr-24694",
      "underlying": "V",
      "kind": "PositionChange",
      "positionChange": 97063,
      "momentDate": "2026-11-05"
    },
    {
      "debtId": "jd-c-0024690",
      "tradeId": "tr-24694",
      "underlying": "V",
      "kind": "CloseReview",
      "positionChange": 24690,
      "momentDate": "2026-11-05"
    },
    {
      "debtId": "jd-b-0097064",
      "tradeId": "tr-24697",
      "underlying": "HD",
      "kind": "PositionChange",
      "positionChange": 97064,
      "momentDate": "2026-11-05"
    },
    {
      "debtId": "jd-c-0024691",
      "tradeId": "tr-24697",
      "underlying": "HD",
      "kind": "CloseReview",
      "positionChange": 24691,
      "momentDate": "2026-11-05"
    },
    {
      "debtId": "jd-b-0097065",
      "tradeId": "tr-24698",
      "underlying": "PG",
      "kind": "PositionChange",
      "positionChange": 97065,
      "momentDate": "2026-11-05"
    },
    {
      "debtId": "jd-b-0097066",
      "tradeId": "tr-24826",
      "underlying": "QBV",
      "kind": "PositionChange",
      "positionChange": 97066,
      "momentDate": "2026-11-05"
    },
    {
      "debtId": "jd-b-0097067",
      "tradeId": "tr-24830",
      "underlying": "GS",
      "kind": "PositionChange",
      "positionChange": 97067,
      "momentDate": "2026-11-05"
    },
    {
      "debtId": "jd-b-0097068",
      "tradeId": "tr-24834",
      "underlying": "NVDA",
      "kind": "PositionChange",
      "positionChange": 97068,
      "momentDate": "2026-11-05"
    },
    {
      "debtId": "jd-b-0097069",
      "tradeId": "tr-24838",
      "underlying": "TSLA",
      "kind": "PositionChange",
      "positionChange": 97069,
      "momentDate": "2026-11-05"
    },
    {
      "debtId": "jd-b-0097070",
      "tradeId": "tr-24842",
      "underlying": "QAE",
      "kind": "PositionChange",
      "positionChange": 97070,
      "momentDate": "2026-11-05"
    },
    {
      "debtId": "jd-b-0097071",
      "tradeId": "tr-24846",
      "underlying": "KO",
      "kind": "PositionChange",
      "positionChange": 97071,
      "momentDate": "2026-11-05"
    },
    {
      "debtId": "jd-b-0097072",
      "tradeId": "tr-24850",
      "underlying": "QAF",
      "kind": "PositionChange",
      "positionChange": 97072,
      "momentDate": "2026-11-05"
    },
    {
      "debtId": "jd-b-0097073",
      "tradeId": "tr-24854",
      "underlying": "UNH",
      "kind": "PositionChange",
      "positionChange": 97073,
      "momentDate": "2026-11-05"
    },
    {
      "debtId": "jd-b-0097074",
      "tradeId": "tr-24858",
      "underlying": "CVX",
      "kind": "PositionChange",
      "positionChange": 97074,
      "momentDate": "2026-11-05"
    },
    {
      "debtId": "jd-b-0097075",
      "tradeId": "tr-24861",
      "underlying": "QAJ",
      "kind": "PositionChange",
      "positionChange": 97075,
      "momentDate": "2026-11-05"
    },
    {
      "debtId": "jd-b-0097076",
      "tradeId": "tr-24862",
      "underlying": "QAK",
      "kind": "PositionChange",
      "positionChange": 97076,
      "momentDate": "2026-11-05"
    },
    {
      "debtId": "jd-b-0097077",
      "tradeId": "tr-24863",
      "underlying": "ABBV",
      "kind": "PositionChange",
      "positionChange": 97077,
      "momentDate": "2026-11-05"
    },
    {
      "debtId": "jd-b-0097078",
      "tradeId": "tr-24865",
      "underlying": "PEP",
      "kind": "PositionChange",
      "positionChange": 97078,
      "momentDate": "2026-11-05"
    },
    {
      "debtId": "jd-b-0097079",
      "tradeId": "tr-24866",
      "underlying": "ADBE",
      "kind": "PositionChange",
      "positionChange": 97079,
      "momentDate": "2026-11-05"
    },
    {
      "debtId": "jd-b-0097080",
      "tradeId": "tr-24867",
      "underlying": "CRM",
      "kind": "PositionChange",
      "positionChange": 97080,
      "momentDate": "2026-11-05"
    },
    {
      "debtId": "jd-b-0097081",
      "tradeId": "tr-24869",
      "underlying": "AMD",
      "kind": "PositionChange",
      "positionChange": 97081,
      "momentDate": "2026-11-05"
    },
    {
      "debtId": "jd-b-0097082",
      "tradeId": "tr-24870",
      "underlying": "QAL",
      "kind": "PositionChange",
      "positionChange": 97082,
      "momentDate": "2026-11-05"
    },
    {
      "debtId": "jd-b-0097083",
      "tradeId": "tr-24871",
      "underlying": "QAM",
      "kind": "PositionChange",
      "positionChange": 97083,
      "momentDate": "2026-11-05"
    },
    {
      "debtId": "jd-b-0097084",
      "tradeId": "tr-24873",
      "underlying": "INTC",
      "kind": "PositionChange",
      "positionChange": 97084,
      "momentDate": "2026-11-05"
    },
    {
      "debtId": "jd-b-0097085",
      "tradeId": "tr-24874",
      "underlying": "QCOM",
      "kind": "PositionChange",
      "positionChange": 97085,
      "momentDate": "2026-11-05"
    },
    {
      "debtId": "jd-b-0097086",
      "tradeId": "tr-24875",
      "underlying": "TXN",
      "kind": "PositionChange",
      "positionChange": 97086,
      "momentDate": "2026-11-05"
    },
    {
      "debtId": "jd-b-0097087",
      "tradeId": "tr-24877",
      "underlying": "DIS",
      "kind": "PositionChange",
      "positionChange": 97087,
      "momentDate": "2026-11-05"
    },
    {
      "debtId": "jd-b-0097088",
      "tradeId": "tr-24878",
      "underlying": "NKE",
      "kind": "PositionChange",
      "positionChange": 97088,
      "momentDate": "2026-11-05"
    },
    {
      "debtId": "jd-b-0097089",
      "tradeId": "tr-24879",
      "underlying": "MCD",
      "kind": "PositionChange",
      "positionChange": 97089,
      "momentDate": "2026-11-05"
    },
    {
      "debtId": "jd-b-0097090",
      "tradeId": "tr-24881",
      "underlying": "QAP",
      "kind": "PositionChange",
      "positionChange": 97090,
      "momentDate": "2026-11-05"
    },
    {
      "debtId": "jd-b-0097091",
      "tradeId": "tr-24882",
      "underlying": "QAQ",
      "kind": "PositionChange",
      "positionChange": 97091,
      "momentDate": "2026-11-05"
    },
    {
      "debtId": "jd-b-0097092",
      "tradeId": "tr-24883",
      "underlying": "BA",
      "kind": "PositionChange",
      "positionChange": 97092,
      "momentDate": "2026-11-05"
    },
    {
      "debtId": "jd-b-0097093",
      "tradeId": "tr-24885",
      "underlying": "DE",
      "kind": "PositionChange",
      "positionChange": 97093,
      "momentDate": "2026-11-05"
    },
    {
      "debtId": "jd-b-0097094",
      "tradeId": "tr-24886",
      "underlying": "GS",
      "kind": "PositionChange",
      "positionChange": 97094,
      "momentDate": "2026-11-05"
    },
    {
      "debtId": "jd-b-0097095",
      "tradeId": "tr-24887",
      "underlying": "QAA",
      "kind": "PositionChange",
      "positionChange": 97095,
      "momentDate": "2026-11-05"
    },
    {
      "debtId": "jd-b-0097096",
      "tradeId": "tr-24889",
      "underlying": "QAC",
      "kind": "PositionChange",
      "positionChange": 97096,
      "momentDate": "2026-11-05"
    },
    {
      "debtId": "jd-b-0097097",
      "tradeId": "tr-24890",
      "underlying": "QAR",
      "kind": "PositionChange",
      "positionChange": 97097,
      "momentDate": "2026-11-05"
    },
    {
      "debtId": "jd-b-0097098",
      "tradeId": "tr-24891",
      "underlying": "QAS",
      "kind": "PositionChange",
      "positionChange": 97098,
      "momentDate": "2026-11-05"
    },
    {
      "debtId": "jd-b-0097099",
      "tradeId": "tr-24893",
      "underlying": "QAD",
      "kind": "PositionChange",
      "positionChange": 97099,
      "momentDate": "2026-11-05"
    },
    {
      "debtId": "jd-b-0097100",
      "tradeId": "tr-24894",
      "underlying": "QAE",
      "kind": "PositionChange",
      "positionChange": 97100,
      "momentDate": "2026-11-05"
    },
    {
      "debtId": "jd-b-0097101",
      "tradeId": "tr-24895",
      "underlying": "QAF",
      "kind": "PositionChange",
      "positionChange": 97101,
      "momentDate": "2026-11-05"
    },
    {
      "debtId": "jd-b-0097102",
      "tradeId": "tr-24896",
      "underlying": "QAG",
      "kind": "PositionChange",
      "positionChange": 97102,
      "momentDate": "2026-11-05"
    },
    {
      "debtId": "jd-b-0097103",
      "tradeId": "tr-24897",
      "underlying": "QAH",
      "kind": "PositionChange",
      "positionChange": 97103,
      "momentDate": "2026-11-05"
    },
    {
      "debtId": "jd-b-0097104",
      "tradeId": "tr-24898",
      "underlying": "QAI",
      "kind": "PositionChange",
      "positionChange": 97104,
      "momentDate": "2026-11-05"
    },
    {
      "debtId": "jd-b-0097105",
      "tradeId": "tr-24899",
      "underlying": "QAJ",
      "kind": "PositionChange",
      "positionChange": 97105,
      "momentDate": "2026-11-05"
    },
    {
      "debtId": "jd-b-0097106",
      "tradeId": "tr-24686",
      "underlying": "TSLA",
      "kind": "PositionChange",
      "positionChange": 97106,
      "momentDate": "2026-11-06"
    },
    {
      "debtId": "jd-c-0024692",
      "tradeId": "tr-24686",
      "underlying": "TSLA",
      "kind": "CloseReview",
      "positionChange": 24692,
      "momentDate": "2026-11-06"
    },
    {
      "debtId": "jd-b-0097107",
      "tradeId": "tr-24689",
      "underlying": "NFLX",
      "kind": "PositionChange",
      "positionChange": 97107,
      "momentDate": "2026-11-06"
    },
    {
      "debtId": "jd-c-0024693",
      "tradeId": "tr-24689",
      "underlying": "NFLX",
      "kind": "CloseReview",
      "positionChange": 24693,
      "momentDate": "2026-11-06"
    },
    {
      "debtId": "jd-b-0097108",
      "tradeId": "tr-24698",
      "underlying": "PG",
      "kind": "PositionChange",
      "positionChange": 97108,
      "momentDate": "2026-11-06"
    },
    {
      "debtId": "jd-c-0024694",
      "tradeId": "tr-24698",
      "underlying": "PG",
      "kind": "CloseReview",
      "positionChange": 24694,
      "momentDate": "2026-11-06"
    },
    {
      "debtId": "jd-b-0097109",
      "tradeId": "tr-24862",
      "underlying": "QAK",
      "kind": "PositionChange",
      "positionChange": 97109,
      "momentDate": "2026-11-06"
    },
    {
      "debtId": "jd-b-0097110",
      "tradeId": "tr-24866",
      "underlying": "ADBE",
      "kind": "PositionChange",
      "positionChange": 97110,
      "momentDate": "2026-11-06"
    },
    {
      "debtId": "jd-b-0097111",
      "tradeId": "tr-24870",
      "underlying": "QAL",
      "kind": "PositionChange",
      "positionChange": 97111,
      "momentDate": "2026-11-06"
    },
    {
      "debtId": "jd-b-0097112",
      "tradeId": "tr-24874",
      "underlying": "QCOM",
      "kind": "PositionChange",
      "positionChange": 97112,
      "momentDate": "2026-11-06"
    },
    {
      "debtId": "jd-b-0097113",
      "tradeId": "tr-24878",
      "underlying": "NKE",
      "kind": "PositionChange",
      "positionChange": 97113,
      "momentDate": "2026-11-06"
    },
    {
      "debtId": "jd-b-0097114",
      "tradeId": "tr-24882",
      "underlying": "QAQ",
      "kind": "PositionChange",
      "positionChange": 97114,
      "momentDate": "2026-11-06"
    },
    {
      "debtId": "jd-b-0097115",
      "tradeId": "tr-24886",
      "underlying": "GS",
      "kind": "PositionChange",
      "positionChange": 97115,
      "momentDate": "2026-11-06"
    },
    {
      "debtId": "jd-b-0097116",
      "tradeId": "tr-24890",
      "underlying": "QAR",
      "kind": "PositionChange",
      "positionChange": 97116,
      "momentDate": "2026-11-06"
    },
    {
      "debtId": "jd-b-0097117",
      "tradeId": "tr-24894",
      "underlying": "QAE",
      "kind": "PositionChange",
      "positionChange": 97117,
      "momentDate": "2026-11-06"
    },
    {
      "debtId": "jd-b-0097118",
      "tradeId": "tr-24897",
      "underlying": "QAH",
      "kind": "PositionChange",
      "positionChange": 97118,
      "momentDate": "2026-11-06"
    },
    {
      "debtId": "jd-b-0097119",
      "tradeId": "tr-24898",
      "underlying": "QAI",
      "kind": "PositionChange",
      "positionChange": 97119,
      "momentDate": "2026-11-06"
    },
    {
      "debtId": "jd-b-0097120",
      "tradeId": "tr-24899",
      "underlying": "QAJ",
      "kind": "PositionChange",
      "positionChange": 97120,
      "momentDate": "2026-11-06"
    },
    {
      "debtId": "jd-b-0097121",
      "tradeId": "tr-24650",
      "underlying": "CSCO",
      "kind": "PositionChange",
      "positionChange": 97121,
      "momentDate": "2026-11-06"
    },
    {
      "debtId": "jd-c-0024695",
      "tradeId": "tr-24650",
      "underlying": "CSCO",
      "kind": "CloseReview",
      "positionChange": 24695,
      "momentDate": "2026-11-06"
    },
    {
      "debtId": "jd-b-0097122",
      "tradeId": "tr-24662",
      "underlying": "ABBV",
      "kind": "PositionChange",
      "positionChange": 97122,
      "momentDate": "2026-11-06"
    },
    {
      "debtId": "jd-c-0024696",
      "tradeId": "tr-24662",
      "underlying": "ABBV",
      "kind": "CloseReview",
      "positionChange": 24696,
      "momentDate": "2026-11-06"
    },
    {
      "debtId": "jd-b-0097123",
      "tradeId": "tr-24670",
      "underlying": "QCOM",
      "kind": "PositionChange",
      "positionChange": 97123,
      "momentDate": "2026-11-06"
    },
    {
      "debtId": "jd-c-0024697",
      "tradeId": "tr-24670",
      "underlying": "QCOM",
      "kind": "CloseReview",
      "positionChange": 24697,
      "momentDate": "2026-11-06"
    },
    {
      "debtId": "jd-b-0097124",
      "tradeId": "tr-24681",
      "underlying": "MSFT",
      "kind": "PositionChange",
      "positionChange": 97124,
      "momentDate": "2026-11-06"
    },
    {
      "debtId": "jd-c-0024698",
      "tradeId": "tr-24681",
      "underlying": "MSFT",
      "kind": "CloseReview",
      "positionChange": 24698,
      "momentDate": "2026-11-06"
    },
    {
      "debtId": "jd-b-0097125",
      "tradeId": "tr-24682",
      "underlying": "NVDA",
      "kind": "PositionChange",
      "positionChange": 97125,
      "momentDate": "2026-11-06"
    },
    {
      "debtId": "jd-c-0024699",
      "tradeId": "tr-24682",
      "underlying": "NVDA",
      "kind": "CloseReview",
      "positionChange": 24699,
      "momentDate": "2026-11-06"
    },
    {
      "debtId": "jd-b-0097126",
      "tradeId": "tr-24898",
      "underlying": "QAI",
      "kind": "PositionChange",
      "positionChange": 97126,
      "momentDate": "2026-11-09"
    }
  ],
  "artifact": {
    "path": ".cache/bench/benchmark.tjbackup",
    "fileDigest": "6d819703928c5aa37ec3e9181b4ba164b325846296cf015f9412715cc894304b",
    "fullDigest": "c78d80f93d696873153d5fe91168f80c388a2a607ab27213ca69c4758154e79f",
    "manifestDigest": "eb7c3a179486c142cace9bd62951284823174b7c41672718eef476caf273c430",
    "sectionDigests": {
      "workspace": "4a1643aef4df59afa5e54a405b8a9e7e948398d2cfbadda03045cec97fd33867",
      "catalog": "e6f186b7efa83048292768c29bae76f1501e28cc457f5d87962ecbfd299943c3",
      "marketData": "d19ec86891b3ef0a9c9363ebb0d3fc4fde89228d755ec76283ef148b4a3e9d0b",
      "trades": "10e9915e2ead0a3edd84f02a8d5c48ce50140062e3c96d8771e994352ee35b79",
      "journal": "605cdc7cacdf4a332a39ee70b81884729255401565a5df7005e85c243093d457"
    },
    "bytes": 20869684,
    "uncompressedBytes": 453413121,
    "lines": 432962,
    "storeCounts": {
      "catalog": 17,
      "observations": 106985,
      "trades": 25000,
      "journalTypes": 9,
      "journalDefinitions": 4,
      "journalEntries": 256351,
      "journalDeclines": 20223,
      "journalDebts": 24365
    }
  },
  "generationMs": 1029736,
  "engine": "node v26.12.0",
  "host": {
    "platform": "darwin",
    "release": "25.6.0",
    "arch": "arm64",
    "cpu": "Apple M4 Max",
    "cores": 16
  },
  "expectedOpenRows": "bench/expected-open-rows.json"
}
```
