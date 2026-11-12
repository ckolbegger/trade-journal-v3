# D7 benchmark run (AC-PERF-001)

Written by `npm run bench:run` (T2.21, extended by T4.31, T5.22, T5R.13, T6.25 and T7.29) on 2026-11-12T14:33:27.515Z, at commit a4b847495ea70f3ce01b64c00967bc0a76c00cd1.

## Result

| Measure | Runs | Nearest-rank p95 (29th of 30) | Budget | Result |
|---|---|---|---|---|
| Cold start to `tj:interactive` | 30 | 130.0 ms | 2,500 ms | pass |
| Warm Planned-to-Open switch to `tj:open-list-ready` | 30 | 63.5 ms | 1,500 ms | pass |

Open list compared with `bench/expected-open-rows.json`: before the runs 200 rows equal, after the runs 200 rows equal, and each of the 30 cold starts rendered the same 200 rows (figures included). The 10 Missing Instruments on the as-of date (ADBE, AVGO, NKE, QAD, QAM, QAV, QBE, QBN, QBW, UNH) have rows in that list, each showing `Mark missing` in P&L (and no other row does).

## As-of Review's due reflections (T5.22)

The harness opens the Review from the primary navigation and reads its blockers: each "Reflection due for X" or "N reflections due for X" is a reflection due at the as-of Review (X names the Trade in full; the harness compares its underlying symbol) (Review Date 2026-11-20). The expected values are `asOfDueReflections` and the Trades of `outstandingDebts` in `bench/dataset.json` (the Outstanding Debts are from 2026-10-30 and 2026-10-30 and 2026-10-30 and 2026-10-30 and 2026-10-30 and 2026-10-30 and 2026-10-30 and 2026-10-30 and 2026-10-30 and 2026-10-30 and 2026-10-30 and 2026-10-30 and 2026-10-30 and 2026-10-30 and 2026-10-30 and 2026-10-30 and 2026-10-30 and 2026-10-30 and 2026-10-30 and 2026-11-02 and 2026-11-02 and 2026-11-02 and 2026-11-02 and 2026-11-02 and 2026-11-02 and 2026-11-02 and 2026-11-02 and 2026-11-02 and 2026-11-02 and 2026-11-02 and 2026-11-02 and 2026-11-02 and 2026-11-02 and 2026-11-02 and 2026-11-02 and 2026-11-02 and 2026-11-02 and 2026-11-02 and 2026-11-02 and 2026-11-02 and 2026-11-02 and 2026-11-02 and 2026-11-02 and 2026-11-02 and 2026-11-02 and 2026-11-02 and 2026-11-02 and 2026-11-02 and 2026-11-02 and 2026-11-02 and 2026-11-02 and 2026-11-02 and 2026-11-02 and 2026-11-02 and 2026-11-02 and 2026-11-02 and 2026-11-02 and 2026-11-02 and 2026-11-02 and 2026-11-02 and 2026-11-02 and 2026-11-02 and 2026-11-02 and 2026-11-02 and 2026-11-02 and 2026-11-02 and 2026-11-02 and 2026-11-02 and 2026-11-02 and 2026-11-02 and 2026-11-02 and 2026-11-02 and 2026-11-02 and 2026-11-02 and 2026-11-02 and 2026-11-02 and 2026-11-02 and 2026-11-02 and 2026-11-02 and 2026-11-02 and 2026-11-02 and 2026-11-02 and 2026-11-02 and 2026-11-02 and 2026-11-02 and 2026-11-02 and 2026-11-02 and 2026-11-02 and 2026-11-02 and 2026-11-02 and 2026-11-02 and 2026-11-02 and 2026-11-02 and 2026-11-02 and 2026-11-02 and 2026-11-02 and 2026-11-02 and 2026-11-02 and 2026-11-02 and 2026-11-02 and 2026-11-02 and 2026-11-02 and 2026-11-02 and 2026-11-02 and 2026-11-02 and 2026-11-02 and 2026-11-02 and 2026-11-02 and 2026-11-02 and 2026-11-02 and 2026-11-02 and 2026-11-02 and 2026-11-02 and 2026-11-02 and 2026-11-02 and 2026-11-02 and 2026-11-02 and 2026-11-02 and 2026-11-02 and 2026-11-02 and 2026-11-02 and 2026-11-02 and 2026-11-02 and 2026-11-02 and 2026-11-02 and 2026-11-02 and 2026-11-02 and 2026-11-02 and 2026-11-02 and 2026-11-02 and 2026-11-02 and 2026-11-02 and 2026-11-02 and 2026-11-02 and 2026-11-02 and 2026-11-02 and 2026-11-02 and 2026-11-02 and 2026-11-02 and 2026-11-02 and 2026-11-02 and 2026-11-02 and 2026-11-02 and 2026-11-02 and 2026-11-02 and 2026-11-02 and 2026-11-02 and 2026-11-02 and 2026-11-02 and 2026-11-02 and 2026-11-02 and 2026-11-02 and 2026-11-02 and 2026-11-02 and 2026-11-02 and 2026-11-02 and 2026-11-02 and 2026-11-02 and 2026-11-02 and 2026-11-02 and 2026-11-02 and 2026-11-02 and 2026-11-02 and 2026-11-02 and 2026-11-02 and 2026-11-02 and 2026-11-02 and 2026-11-03 and 2026-11-03 and 2026-11-03 and 2026-11-03 and 2026-11-03 and 2026-11-03 and 2026-11-03 and 2026-11-03 and 2026-11-03 and 2026-11-03 and 2026-11-03 and 2026-11-03 and 2026-11-03 and 2026-11-03 and 2026-11-03 and 2026-11-03 and 2026-11-03 and 2026-11-03 and 2026-11-03 and 2026-11-03 and 2026-11-03 and 2026-11-03 and 2026-11-03 and 2026-11-03 and 2026-11-03 and 2026-11-03 and 2026-11-03 and 2026-11-03 and 2026-11-03 and 2026-11-03 and 2026-11-03 and 2026-11-03 and 2026-11-03 and 2026-11-03 and 2026-11-03 and 2026-11-03 and 2026-11-03 and 2026-11-03 and 2026-11-03 and 2026-11-03 and 2026-11-03 and 2026-11-03 and 2026-11-03 and 2026-11-03 and 2026-11-03 and 2026-11-03 and 2026-11-03 and 2026-11-03 and 2026-11-03 and 2026-11-03 and 2026-11-03 and 2026-11-03 and 2026-11-03 and 2026-11-03 and 2026-11-03 and 2026-11-03 and 2026-11-03 and 2026-11-03 and 2026-11-03 and 2026-11-03 and 2026-11-03 and 2026-11-03 and 2026-11-03 and 2026-11-03 and 2026-11-03 and 2026-11-03 and 2026-11-03 and 2026-11-03 and 2026-11-03 and 2026-11-03 and 2026-11-03 and 2026-11-03 and 2026-11-03 and 2026-11-03 and 2026-11-03 and 2026-11-03 and 2026-11-03 and 2026-11-03 and 2026-11-03 and 2026-11-03 and 2026-11-03 and 2026-11-03 and 2026-11-03 and 2026-11-03 and 2026-11-03 and 2026-11-03 and 2026-11-03 and 2026-11-03 and 2026-11-03 and 2026-11-03 and 2026-11-03 and 2026-11-03 and 2026-11-03 and 2026-11-03 and 2026-11-03 and 2026-11-03 and 2026-11-03 and 2026-11-03 and 2026-11-03 and 2026-11-03 and 2026-11-03 and 2026-11-03 and 2026-11-03 and 2026-11-03 and 2026-11-03 and 2026-11-03 and 2026-11-03 and 2026-11-03 and 2026-11-03 and 2026-11-03 and 2026-11-03 and 2026-11-03 and 2026-11-03 and 2026-11-03 and 2026-11-03 and 2026-11-03 and 2026-11-03 and 2026-11-03 and 2026-11-03 and 2026-11-03 and 2026-11-03 and 2026-11-03 and 2026-11-03 and 2026-11-03 and 2026-11-03 and 2026-11-03 and 2026-11-03 and 2026-11-03 and 2026-11-03 and 2026-11-03 and 2026-11-03 and 2026-11-03 and 2026-11-03 and 2026-11-03 and 2026-11-04 and 2026-11-04 and 2026-11-04 and 2026-11-04 and 2026-11-04 and 2026-11-04 and 2026-11-04 and 2026-11-04 and 2026-11-04 and 2026-11-04 and 2026-11-04 and 2026-11-04 and 2026-11-04 and 2026-11-04 and 2026-11-04 and 2026-11-04 and 2026-11-04 and 2026-11-04 and 2026-11-04 and 2026-11-04 and 2026-11-04 and 2026-11-04 and 2026-11-04 and 2026-11-04 and 2026-11-04 and 2026-11-04 and 2026-11-04 and 2026-11-04 and 2026-11-04 and 2026-11-04 and 2026-11-04 and 2026-11-04 and 2026-11-04 and 2026-11-04 and 2026-11-04 and 2026-11-04 and 2026-11-04 and 2026-11-04 and 2026-11-04 and 2026-11-04 and 2026-11-04 and 2026-11-04 and 2026-11-04 and 2026-11-04 and 2026-11-04 and 2026-11-04 and 2026-11-04 and 2026-11-04 and 2026-11-04 and 2026-11-04 and 2026-11-04 and 2026-11-04 and 2026-11-04 and 2026-11-04 and 2026-11-04 and 2026-11-04 and 2026-11-04 and 2026-11-04 and 2026-11-04 and 2026-11-04 and 2026-11-04 and 2026-11-04 and 2026-11-04 and 2026-11-04 and 2026-11-04 and 2026-11-04 and 2026-11-04 and 2026-11-04 and 2026-11-04 and 2026-11-04 and 2026-11-04 and 2026-11-04 and 2026-11-04 and 2026-11-04 and 2026-11-04 and 2026-11-04 and 2026-11-04 and 2026-11-04 and 2026-11-04 and 2026-11-04 and 2026-11-04 and 2026-11-04 and 2026-11-04 and 2026-11-04 and 2026-11-04 and 2026-11-04 and 2026-11-04 and 2026-11-04 and 2026-11-04 and 2026-11-04 and 2026-11-04 and 2026-11-04 and 2026-11-04 and 2026-11-04 and 2026-11-04 and 2026-11-04 and 2026-11-04 and 2026-11-04 and 2026-11-04 and 2026-11-04 and 2026-11-04 and 2026-11-04 and 2026-11-05 and 2026-11-05 and 2026-11-05 and 2026-11-05 and 2026-11-05 and 2026-11-05 and 2026-11-05 and 2026-11-05 and 2026-11-05 and 2026-11-05 and 2026-11-05 and 2026-11-05 and 2026-11-05 and 2026-11-05 and 2026-11-05 and 2026-11-05 and 2026-11-05 and 2026-11-05 and 2026-11-05 and 2026-11-05 and 2026-11-05 and 2026-11-05 and 2026-11-05 and 2026-11-05 and 2026-11-05 and 2026-11-05 and 2026-11-05 and 2026-11-05 and 2026-11-05 and 2026-11-05 and 2026-11-05 and 2026-11-05 and 2026-11-05 and 2026-11-05 and 2026-11-05 and 2026-11-05 and 2026-11-05 and 2026-11-05 and 2026-11-05 and 2026-11-05 and 2026-11-05 and 2026-11-05 and 2026-11-05 and 2026-11-05 and 2026-11-05 and 2026-11-05 and 2026-11-05 and 2026-11-05 and 2026-11-05 and 2026-11-05 and 2026-11-05 and 2026-11-05 and 2026-11-05 and 2026-11-05 and 2026-11-05 and 2026-11-06 and 2026-11-06 and 2026-11-06 and 2026-11-06 and 2026-11-06 and 2026-11-06 and 2026-11-06 and 2026-11-06 and 2026-11-06 and 2026-11-06 and 2026-11-06 and 2026-11-06 and 2026-11-06 and 2026-11-06 and 2026-11-06 and 2026-11-06 and 2026-11-06 and 2026-11-06 and 2026-11-06 and 2026-11-06 and 2026-11-06 and 2026-11-06 and 2026-11-06 and 2026-11-06 and 2026-11-06 and 2026-11-06 and 2026-11-06 and 2026-11-06 and 2026-11-09, both due at the as-of Review, decision 58). A difference fails the run.

| When | Due reflections listed (by Trade) | Expected | Result | Time from the click on Review to its status (disclosed, not gated) |
|---|---|---|---|---|
| before the runs | 487 (QAI 5, QAJ 5, QAH 3, QAE 7, QAR 3, GS 9, QAQ 4, QCOM 12, QAL 4, QAK 5, QAF 7, QAS 3, QAC 4, QAA 6, DE 13, BA 6, MCD 5, TXN 9, INTC 12, AMD 7, PEP 4, ABBV 10, CVX 7, KO 7, NVDA 10, QBV 3, QAT 3, QAB 3, CAT 12, QAN 2, ORCL 5, MRK 3, LLY 12, XOM 7, HD 13, QAG 4, V 11, PFE 9, CSCO 9, META 10, AMZN 4, MSFT 9, AAPL 7, QBQ 3, QBC 3, QAY 3, PG 10, NFLX 11, GOOGL 3, QBU 2, QBS 2, QBP 2, QBL 2, QBI 2, QBD 2, QBB 2, QAX 2, CRM 13, QAO 3, QBO 1, QBJ 1, QBA 1, QAW 1, QAU 1, QAP 3, MA 7, COST 6, DIS 14, TSLA 11, WMT 6, JPM 10, QBX 1, QBR 2, QBG 2, QAZ 2, QBT 1, QBF 1, QAM 2, NKE 13, ADBE 11, QAD 4, UNH 8, AVGO 6, QBW 2, QBN 2, QBE 2, QBK 2, QBM 3, QBH 3) | 487 (CVX 7, LLY 12, WMT 6, AAPL 7, KO 7, PFE 9, QCOM 12, TXN 9, NVDA 10, CSCO 9, ABBV 10, MSFT 9, JPM 10, PG 10, MRK 3, ADBE 11, INTC 12, DIS 14, NKE 13, MCD 5, CAT 12, GOOGL 3, META 10, TSLA 11, AVGO 6, NFLX 11, V 11, MA 7, UNH 8, HD 13, PEP 4, CRM 13, ORCL 5, AMD 7, BA 6, DE 13, GS 9, COST 6, XOM 7, QAA 6, QAB 3, QAC 4, QAE 7, QAF 7, QAG 4, QAI 5, QAJ 5, QAK 5, QAL 4, QAN 2, QAO 3, QAP 3, QAQ 4, QAS 3, QAT 3, QAU 1, QAW 1, QAX 2, QAY 3, QAZ 2, QBA 1, QBB 2, QBC 3, QBD 2, QBE 2, QBF 1, QBG 2, QBH 3, QBI 2, QBJ 1, QBK 2, QBL 2, QBM 3, QBN 2, QBO 1, QBP 2, QBQ 3, QBR 2, QBS 2, QBT 1, QBU 2, AMZN 4, QBV 3, QBW 2, QBX 1, QAD 4, QAH 3, QAM 2, QAR 3) | equal | 322 ms |
| after the runs | 487 (QAI 5, QAJ 5, QAH 3, QAE 7, QAR 3, GS 9, QAQ 4, QCOM 12, QAL 4, QAK 5, QAF 7, QAS 3, QAC 4, QAA 6, DE 13, BA 6, MCD 5, TXN 9, INTC 12, AMD 7, PEP 4, ABBV 10, CVX 7, KO 7, NVDA 10, QBV 3, QAT 3, QAB 3, CAT 12, QAN 2, ORCL 5, MRK 3, LLY 12, XOM 7, HD 13, QAG 4, V 11, PFE 9, CSCO 9, META 10, AMZN 4, MSFT 9, AAPL 7, QBQ 3, QBC 3, QAY 3, PG 10, NFLX 11, GOOGL 3, QBU 2, QBS 2, QBP 2, QBL 2, QBI 2, QBD 2, QBB 2, QAX 2, CRM 13, QAO 3, QBO 1, QBJ 1, QBA 1, QAW 1, QAU 1, QAP 3, MA 7, COST 6, DIS 14, TSLA 11, WMT 6, JPM 10, QBX 1, QBR 2, QBG 2, QAZ 2, QBT 1, QBF 1, QAM 2, NKE 13, ADBE 11, QAD 4, UNH 8, AVGO 6, QBW 2, QBN 2, QBE 2, QBK 2, QBM 3, QBH 3) | 487 (CVX 7, LLY 12, WMT 6, AAPL 7, KO 7, PFE 9, QCOM 12, TXN 9, NVDA 10, CSCO 9, ABBV 10, MSFT 9, JPM 10, PG 10, MRK 3, ADBE 11, INTC 12, DIS 14, NKE 13, MCD 5, CAT 12, GOOGL 3, META 10, TSLA 11, AVGO 6, NFLX 11, V 11, MA 7, UNH 8, HD 13, PEP 4, CRM 13, ORCL 5, AMD 7, BA 6, DE 13, GS 9, COST 6, XOM 7, QAA 6, QAB 3, QAC 4, QAE 7, QAF 7, QAG 4, QAI 5, QAJ 5, QAK 5, QAL 4, QAN 2, QAO 3, QAP 3, QAQ 4, QAS 3, QAT 3, QAU 1, QAW 1, QAX 2, QAY 3, QAZ 2, QBA 1, QBB 2, QBC 3, QBD 2, QBE 2, QBF 1, QBG 2, QBH 3, QBI 2, QBJ 1, QBK 2, QBL 2, QBM 3, QBN 2, QBO 1, QBP 2, QBQ 3, QBR 2, QBS 2, QBT 1, QBU 2, AMZN 4, QBV 3, QBW 2, QBX 1, QAD 4, QAH 3, QAM 2, QAR 3) | equal | 293 ms |

## Card timings (T5R.13, disclosed, not gated)

Each is the time from the pointer press to the rendered result, on the mature dataset above. The thresholds in the first table are the only gates.

| Measure | Runs | Median | Nearest-rank p95 | Min | Max |
|---|---|---|---|---|---|
| Open the first card (press on Review to the first card's content: `open` plus one `getTrade`) | 10 | 272.4 ms | 302.8 ms | 259.2 ms | 302.8 ms |
| Save Marks of one card's Marks (press on Save Marks to the card's drafts cleared) | 5 | 193.5 ms | 217.5 ms | 184.8 ms | 217.5 ms |
| Trade Action save (press on Save in the Action form to the form replaced by the result) | 5 | 189.0 ms | 191.7 ms | 187.7 ms | 191.7 ms |

- **Against D5 and D5R2:** D5 measured the cold start at 104.8 ms and the warm switch at 43.6 ms (p95), D5R2 96.2 ms and 47.3 ms on the same generator-3 dataset; this run's are 130.0 ms and 63.5 ms. D5 timed the press on Review to the Review's status at 2342 ms before its runs and 2225 ms after (single measurements); opening the first card here, which adds the first Trade's `getTrade`, takes a median of 272.4 ms.
- **Tech debt item 3** (the Review's open cost grows with history) is measured here, not fixed: D5R takes the save path off it (P38) but not the first `open` of each Review, and the open-the-first-card timing is its baseline.
- **The saves** are timed on cards of the cached profile's copy: Save Marks on ADBE, Save Marks on AVGO, Save Marks on NKE, Save Marks on QAD, Save Marks on QAM; and a Hold Action on AMZN 088c8fd5, NVDA edc69c13, MSFT 47d923ca, AAPL a317e058, QAR d6c46a69. A Marks save fills the Instrument's Missing Review-date Mark with 51.00. The dataset holds an Action for every Trade on the Review Date, so each Action save is an edit of the saved Action (Change, Hold, an Intent of "bench edit", Save): each is a `SaveTradeAction` with the entry's expected revision, with the same post-save rebuild as a first save. The Review is opened afresh before each, which is not timed.
- **Raw timings (ms, in run order):** open the first card 259.2, 293.3, 282.0, 272.9, 267.7, 271.9, 260.0, 302.8, 269.5, 275.0; Save Marks 193.5, 191.5, 212.6, 217.5, 184.8; Trade Action save 191.7, 187.7, 189.6, 188.0, 189.0.
- **Method:** a MutationObserver in the page reads the real clock on the first DOM change after which the result holds (the card's content shown with no card still loading; the card's Save Marks counting no drafts; the card's Action form gone with no card still loading), and a capture-phase pointer press records the start on the same clock.

## Closed page, Review walk and owed group (T6.25)

- **Closed page.** The generator records no Closed page, so the expected first page is derived from the stored data: the first 50 Closed Trades of the profile's `byLifecycleTerminal` index (terminal time descending), read raw in the page before any timed run. Each rendered row (its Trade from the link, Underlying and Close date in America/New_York) must equal the stored Trade's, in order, before the runs (50 rows equal) and after them (50 rows equal), and at each of the 10 renders below. Realized figures, Disposition and Close Reason are not compared (the stored Trade does not hold them).
- **Review walk and owed group.** The as-of Review's cards must equal `asOfReview` in `bench/dataset.json`, in order, each by its Trade (`data-trade-id`) and Underlying (the walked Trades' Underlyings are read from the stored Trades, the owed group's are the dataset's):before the runs 200 walked and 99 owed cards equal; after the runs 200 walked and 99 owed cards equal. The owed group's Debt identities are not rendered, so they are not compared here; the Trades and their order are.

- **Settlement family (T7.29).** The as-of Review's "Settlement Due for ..." blockers must equal `asOfReview.settlement` in `bench/dataset.json`, in the Review's order, each by its Trade (from the blocker's link), contract, open quantity (read from the Settlement panel the link opens) and expiration date: before the runs 4 items equal; after the runs 4 items equal. The Open list's rows, option figures and dated lines included, are the `bench/expected-open-rows.json` comparison in the first section; the profile holds 7500 option Trades of 25000 and 60 Open ones.

| Measure (disclosed, not gated) | Runs | Median | Nearest-rank p95 | Min | Max |
|---|---|---|---|---|---|
| Closed tab to its first page (50 rows; press on Trades, then Closed, to the last row rendered) | 10 | 114.0 ms | 122.0 ms | 110.0 ms | 122.0 ms |

## Daily Trade Review Action save (requested measurement, disclosed, not gated; not in the plan's T6.25 row)

A single Action save on a card of the as-of Review (Change, Hold, an Intent, Save: a `SaveTradeAction` with the entry's expected revision, so the Review's post-save rebuild is included), from the press on Save to the form replaced by the result. Generator 5's Review save grew by about 1 ms per session in Chromium; this shows its cost at the mature profile. **Warm** is the five saves of the card timings above, in one long-lived page. **Cold** is one save on each of 3 fresh browser processes (offline, from the service worker), on a card no warm save used, the Review opened afresh first (not timed). These figures are not gated; only the two p95 above are.

| Save | Runs | Median | Nearest-rank p95 | Min | Max |
|---|---|---|---|---|---|
| Warm | 5 | 189.0 ms | 191.7 ms | 187.7 ms | 191.7 ms |
| Cold | 3 | 227.2 ms | 227.3 ms | 227.2 ms | 227.3 ms |

Raw (ms): warm 191.7, 187.7, 189.6, 188.0, 189.0; cold PEP b0cb5188 227.2, MRK 74277d45 227.3, QAH 503e4448 227.2; closed page renders 122.0, 116.0, 114.0, 113.0, 115.0, 114.0, 114.0, 114.0, 115.0, 110.0.

## Method

- Playwright's clock also swaps `window.performance` for a fake that records no marks, so the harness keeps the real object before the pin and points the fake's `mark` at it; `performance.now` and timers are the real ones.
- `Date` is pinned to the dataset's as-of instant (2026-11-20T22:00:00.000Z, A52) with Playwright `context.clock.setFixedTime`, and native `Temporal.Now.instant` (the application's clock) is pointed at it (T4.31-B1); every comparison first checks both read the as-of instant and that exactly the Missing Instruments' rows show `Mark missing`. Timers and `performance.now` are real, and the build is production.
- A copy of the cached profile (`.cache/bench/profile`, generator 7, schema 7) per run of the harness; the cached profile itself is never opened.
- The production build (`dist/`) served by the release harness server at http://localhost:4175, the origin the profile's IndexedDB belongs to.
- One warm-up launch, online, installs the service worker and is excluded. The server is then stopped and every later launch is offline (Playwright `offline: true`), so the app loads from the service worker and IndexedDB only.
- Cold start: the Chromium process is launched on the profile, navigates to the origin, and the time is the `tj:interactive` mark's `startTime` (from navigation start; readiness Writable and the Open list fully rendered with every row's figures, each run's rendered list compared with the expected rows afterwards); the process is then closed. The time from the call that launches the browser process to the same mark is recorded beside it for disclosure and is not gated.
- Warm switch: in one launched page, the Planned tab is opened and its first page rendered, then the Open tab is clicked; the time runs from the pointer press on the Open tab to the next `tj:open-list-ready` mark.

## Raw timings (ms, in run order)

| Run | Cold (navigation start to mark) | Cold, disclosed: process launch to mark | Warm |
|---|---|---|---|
| 1 | 127.7 | 198.0 | 54.6 |
| 2 | 126.3 | 197.6 | 62.1 |
| 3 | 127.8 | 199.6 | 59.7 |
| 4 | 116.9 | 186.7 | 60.5 |
| 5 | 129.2 | 199.7 | 60.6 |
| 6 | 127.7 | 199.8 | 60.6 |
| 7 | 129.1 | 198.8 | 62.7 |
| 8 | 128.6 | 199.6 | 57.4 |
| 9 | 127.4 | 200.9 | 58.2 |
| 10 | 127.6 | 198.8 | 57.5 |
| 11 | 127.4 | 197.8 | 57.5 |
| 12 | 127.0 | 196.1 | 56.8 |
| 13 | 127.3 | 198.0 | 63.5 |
| 14 | 125.9 | 194.5 | 56.9 |
| 15 | 127.1 | 198.0 | 57.2 |
| 16 | 127.7 | 199.2 | 57.4 |
| 17 | 115.6 | 186.4 | 57.5 |
| 18 | 127.6 | 197.0 | 57.0 |
| 19 | 128.9 | 199.3 | 56.8 |
| 20 | 127.1 | 196.1 | 68.0 |
| 21 | 130.0 | 199.7 | 57.0 |
| 22 | 125.4 | 195.4 | 56.7 |
| 23 | 129.4 | 199.6 | 57.1 |
| 24 | 128.3 | 198.0 | 57.4 |
| 25 | 126.7 | 197.0 | 58.4 |
| 26 | 127.4 | 196.0 | 57.6 |
| 27 | 129.1 | 197.6 | 57.7 |
| 28 | 132.1 | 202.3 | 57.2 |
| 29 | 129.0 | 198.4 | 57.4 |
| 30 | 128.3 | 198.5 | 56.7 |

Sorted cold: 115.6, 116.9, 125.4, 125.9, 126.3, 126.7, 127.0, 127.1, 127.1, 127.3, 127.4, 127.4, 127.4, 127.6, 127.6, 127.7, 127.7, 127.7, 127.8, 128.3, 128.3, 128.6, 128.9, 129.0, 129.1, 129.1, 129.2, 129.4, 130.0, 132.1

Process launch to mark (not gated): p95 200.9 ms.

Sorted warm: 54.6, 56.7, 56.7, 56.8, 56.8, 56.9, 57.0, 57.0, 57.1, 57.2, 57.2, 57.4, 57.4, 57.4, 57.4, 57.5, 57.5, 57.5, 57.6, 57.7, 58.2, 58.4, 59.7, 60.5, 60.6, 60.6, 62.1, 62.7, 63.5, 68.0

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
  "generatorVersion": 7,
  "schemaVersion": 7,
  "seed": 20211011,
  "clockStart": "2024-01-02T13:00:00Z",
  "timeZone": "America/New_York",
  "origin": "http://localhost:4175",
  "buildDir": "dist-bench",
  "benchRelease": "6f68708fd275a9b85c6216b016ab0ade8e648b3a2cd1d4ddb0a5396f58e459ef",
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
    "positionChanges": 97127,
    "executions": 187435,
    "planReflectionEntries": 25000,
    "positionChangeReflectionEntries": 80616,
    "positionChangeReflectionDeclines": 16123,
    "institutions": 3,
    "accounts": 6,
    "strategies": 4,
    "sessions": 726,
    "openInstruments": 150,
    "sharedInstruments": 50,
    "marks": 106985,
    "markCorrections": 1069,
    "acknowledgments": 0,
    "actions": 130234,
    "editedActions": 2605,
    "debts": 24365,
    "debtsSettled": 21929,
    "debtsDeclined": 1949,
    "debtsOutstanding": 487,
    "closedTrades": 24700,
    "closeReasons": {
      "Stop Triggered": 7163,
      "Thesis Invalidated": 3705,
      "Time-Based Exit": 4940,
      "Target Reached": 5928
    },
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
    "settlement": [
      {
        "tradeId": "088c8fd5-3a68-4801-a9d4-b9c0f84c46ab",
        "underlying": "AMZN",
        "contract": "AMZN261120C00115000",
        "expiration": "2026-11-20",
        "quantity": "20"
      },
      {
        "tradeId": "47d923ca-2c7f-4109-b80f-ff26f6c5c71e",
        "underlying": "MSFT",
        "contract": "MSFT261120C00106000",
        "expiration": "2026-11-20",
        "quantity": "24"
      },
      {
        "tradeId": "a317e058-0caa-447f-ade1-29da1b99482d",
        "underlying": "AAPL",
        "contract": "AAPL261120C00105000",
        "expiration": "2026-11-20",
        "quantity": "20"
      },
      {
        "tradeId": "edc69c13-c5ed-49f6-92e6-af107ecdd8d1",
        "underlying": "NVDA",
        "contract": "NVDA261120C00107000",
        "expiration": "2026-11-20",
        "quantity": "20"
      }
    ],
    "walk": [
      "088c8fd5-3a68-4801-a9d4-b9c0f84c46ab",
      "edc69c13-c5ed-49f6-92e6-af107ecdd8d1",
      "47d923ca-2c7f-4109-b80f-ff26f6c5c71e",
      "a317e058-0caa-447f-ade1-29da1b99482d",
      "c323a517-b034-404e-9375-ea121f51d269",
      "9c16e445-3d78-4ca2-abc3-144c771ebf6e",
      "9dfc371a-9b48-46bf-a7a5-8b280a73426e",
      "b165a4c0-1d78-436d-9ab7-2e775a13d505",
      "1900e77f-24cd-490f-ad4d-dbea676ba4d6",
      "9ee56dfa-bce3-4450-ae35-1b0a21c201d1",
      "1b5b41f8-7f9f-4b06-a5bf-43ffd122f041",
      "929f38c8-71d9-4dd0-96b7-f710584b90e3",
      "0c67d711-604e-4780-b3c9-83aaa74d8a08",
      "1b48efa9-a480-4f8d-8c95-026d2b046dac",
      "d03edb61-1d2c-43f5-b9af-958659b49bf9",
      "0956e929-94fb-472d-81e3-5102040f5fb8",
      "e8774cbd-25ff-4c94-805c-655365810b84",
      "2fb70863-bb9a-448d-bd89-eda3ba4ecabe",
      "21c54b7e-74f0-40b4-b5a9-498f053dbd20",
      "298f4193-0549-4ec8-b18a-54f55478ddfa",
      "52069b82-1d13-46fa-b57a-d79b119657c7",
      "e8f54075-84bd-4dc1-bdca-7bcf96d6790c",
      "d9e23c31-45ac-4d56-88cb-d47c5483cdd9",
      "7d5aab57-3d0d-4f57-a447-aa905f432dcb",
      "ede1156e-daa0-4b4f-8484-e5abd0d81544",
      "7fbafb51-382d-4bc5-b5cb-5c3d7a077064",
      "11d7f457-1012-417e-87ae-11340378d022",
      "d66c4132-4238-4f18-b8cf-0338e58c5610",
      "2f41e12b-787d-4faf-b579-ddc734121294",
      "3f9dcaa0-865f-475f-aafb-f0e1f3b8966c",
      "f5bc3445-2801-4274-97ef-8b82c7d7003e",
      "a718055e-2b61-4bbf-b78b-4bf7aa3c2089",
      "44339297-1d29-45f1-b278-d5e3717e36ca",
      "313abb62-763b-41be-b01b-66e18acbb54a",
      "756828f5-8892-49a3-87af-bb7bf47f9fc0",
      "357d7d78-aef1-4716-8e4a-5622d54d3686",
      "4e9db26d-b439-48f3-b0f2-fe3d7a0cecc7",
      "ac21bd4d-7273-4208-8cff-448371178299",
      "13440bd8-8f05-4440-9d1d-b7ad6b70d830",
      "ea0c6894-2e80-4f4b-8a7f-249b4b0cebbd",
      "21918c69-b1f5-4567-aa4a-98bd4c78d952",
      "85cf7a6d-46ec-47e2-b786-317e36842593",
      "f69ee396-1d00-4809-ad4e-076d9674430b",
      "7591debd-9dad-441b-bbde-3d2c5bf53875",
      "78bef750-ed64-4cc6-9944-4d61d6049c68",
      "527e4866-06df-4b2d-98e1-490e1b05b060",
      "7da74465-4116-46af-9068-1709161a3827",
      "ef94307a-909b-4d58-8479-39ae68a3ca9e",
      "5418d89c-249c-4828-ae78-7f99c9b00887",
      "a47dab25-6105-40ee-b85d-2fbc5844c207",
      "57f98934-1152-4a74-b60f-eec018264234",
      "f41edac6-d82b-4d09-8aa0-7f3a7bfcddd1",
      "f8d267b4-da0e-48a2-afbd-9eb947c56fb4",
      "e852fddf-debf-48c1-9d57-a10e0d17286a",
      "56ab7eaa-b228-467b-80cb-88a2ce3aaf6f",
      "d0eef693-d4f3-4fe8-bd61-a787bda1e12b",
      "eff63013-fc89-443f-850f-17f02fe72c3e",
      "7ffd1cec-3f5b-4b59-9850-7de0252faf02",
      "d564a92f-588d-4e76-a0ad-997ef6361c12",
      "e4f27e26-1045-4af3-a119-06ec7b0c571a",
      "392e532f-7ac0-484e-bc0b-117896d319c7",
      "4ca7dc92-71bd-4b05-a2c3-7eb272a18b96",
      "944fc62c-4990-4b5a-a528-4285aea0b0b5",
      "48630489-e277-441c-b39d-dd4a36bf2bbc",
      "7bda8682-bd17-47b1-892b-dac3f56ed66a",
      "2c9a4413-ce85-4cf7-83a5-19289ad2ddb0",
      "631a20e9-087c-4b1c-83b7-77841d86d41f",
      "ef12b7d5-67ad-4269-a7b2-e1263ffdd0a1",
      "206c4b5e-efe0-4b10-9706-a4bfd0a221ad",
      "dcef7523-48b2-4629-b47d-12b83e8d582e",
      "d995113a-2b52-460d-9a6f-5a754afaf744",
      "3e613f64-f15b-48ec-a81d-a655ef7cef30",
      "15a49725-0bb5-4b03-b97a-56ed6c1698f0",
      "4cf35023-0c84-43ac-963d-855f23c3a13c",
      "cc0853c9-fb37-4c48-8ca3-3586fe8d0058",
      "2f571148-7449-4d9a-b1f7-4050d498a08f",
      "09bd2b20-2ad7-47a4-8faf-6b210d76a617",
      "1fc12e3c-3b42-4f61-a27a-b8fe3b03680f",
      "245385b5-1f32-457e-b7e2-c24b98addfb0",
      "f0f90c1f-3010-474a-9c86-3d7d3c338603",
      "66fc8310-a9a7-400c-b81f-81d75903eada",
      "955977e0-3e88-43ad-8682-7302dc3c51c1",
      "69cf21ae-bf73-4a4e-9aac-dcf115e1e12a",
      "0d320052-9b01-420a-8c52-5bec4ef12267",
      "44461a6a-5ba2-4310-8590-141564a9f80b",
      "3826256c-dc67-4cda-b459-dff3fb3d23e6",
      "ff339659-66b4-409f-be1d-a25880ad008e",
      "06842f4b-cf97-44e2-bf36-c3a93d46680d",
      "8eeb91a5-d68e-48d4-bc48-eda78f3659b6",
      "ec7f401b-32df-447a-8efa-c50e3954dce1",
      "d9b78400-df14-48a8-8473-10141e1886bb",
      "cdb4d319-543f-453c-b32b-8a030f7bcb1e",
      "53ec7cbd-0213-43ec-bae4-bf5358ff836b",
      "f025294b-465d-4599-a0bd-5bd59c5202f8",
      "c2df0da1-935b-4a7e-8955-49392fa1bf7f",
      "ac3947e4-2168-4b4c-8502-b94398008a95",
      "729a6894-3379-45d6-9429-f38e01e0b124",
      "5fb6cbb1-b7a8-4377-814b-ed1bbd98e425",
      "38ec869c-9407-42cf-9ac8-8586db95ea34",
      "ec8932ea-dc60-4512-8d31-7a040d968750",
      "47284d37-b9cb-4fb8-a015-74f31ee7fab4",
      "426b39b4-ffed-4481-97e5-db867bc6b223",
      "f94a4f07-481b-4b3c-aba5-5b68032deb1e",
      "b447f6e6-d34e-4c65-8d88-353e94741308",
      "d6c46a69-731e-400a-9fff-aed35e46d3ac",
      "b0cb5188-e4cd-46db-8ab1-4614b52a7211",
      "74277d45-42c5-4e23-bed2-d0060df59bc2",
      "503e4448-7075-480c-88cd-52d60df3481a",
      "46a1a8e7-acb7-45e8-90bb-910abb00a997",
      "86f1c590-e301-4dd2-b584-7b013d2625d9",
      "c48dfd69-15ea-40b8-961b-5890a6845ca4",
      "5e5c01c7-7e9f-4cb1-803b-2b428a5fcb1b",
      "2892ab71-00b0-4096-86d5-28abc9d37372",
      "48162827-de71-42cc-a693-4d98f84492c1",
      "0fde031c-86e4-443d-b456-2d46f1dd90f7",
      "2381f7a2-592e-44ab-a0d2-12c94e730b36",
      "1dbbfa1c-57c7-44d7-a5b7-8019967af595",
      "eda91d8e-bb00-4f1a-8fce-949ed1d440d1",
      "6ad1228b-6754-4c6a-a3e0-9ce8435079d3",
      "33dccc34-d8fe-4818-bf75-3e54b807976b",
      "493b0865-1601-4660-9e39-f39fb1fbda78",
      "aa4f6292-ac0f-4df0-9361-c4f1fd40f8bc",
      "45bc7760-e46e-477b-a23c-04b45ec3066f",
      "3836af87-2e77-4218-8304-a1db86fe812b",
      "ff3c17bc-fce6-4211-867c-c172b95d7585",
      "6c10a06c-e5cc-4bc0-9a07-3438e652f6e8",
      "988e0df8-7be2-4836-836b-29b64321d486",
      "40d59404-685f-41df-8cf2-d07c15d5b2a6",
      "fc9ee2ca-58f4-471f-ac16-0cd5caec5d1b",
      "33fb9327-b324-440c-a38c-e34806d0d2bc",
      "14c163f3-b5e7-4d6b-8ce0-9b571dff1e98",
      "7fe2cba2-214e-483b-95e2-4e9b6d2d0569",
      "db8f6af6-85c8-4c7f-9ba2-ff7f47e12bc1",
      "1a2649a9-6a43-4d37-9c00-9a1d23a17be4",
      "5a8de928-6750-489b-9ed4-9ad8d2ab3c88",
      "3cefcf51-fa80-447e-adf9-c8084d4c6b9c",
      "d2ef8d42-baec-49bb-94f8-b55798553236",
      "a73e4605-2085-47be-9016-119d78e21964",
      "31859212-8535-4301-b82b-f86aab2a4d9a",
      "7bbbaa3d-3648-4588-8f93-d6158da28b0d",
      "22a90a65-d634-4575-80be-3f5494448f72",
      "5e71e69c-aded-4757-b751-b5f21b576ca8",
      "529a7b49-9a7b-4b18-9434-3a0cc99adacc",
      "778a2c95-3caf-4165-bb22-5c87c55f8e72",
      "2d0c3194-1d0f-4e49-bceb-0082ff798619",
      "4e485777-a1bd-41d5-9359-9c98fa20b740",
      "1bcf132f-114d-4563-890f-d31161cb7db9",
      "1ac4cd82-2a61-45c1-be16-050607e537b9",
      "8184f750-e2bd-4547-bbf7-890e18af0244",
      "62ad1115-3199-44fa-8a62-cc4bb82ddbe6",
      "1e4ca3cf-3ea3-4d3d-8796-3f698e9f9840",
      "9d821665-5e09-4269-8aa2-b74b73c03c96",
      "6f4f320d-a015-496c-9289-89352c147ac5",
      "2d3eab5d-0fbf-4510-af9d-ba7ae3afd5cd",
      "343fe133-6416-4d7d-a0bb-de9b94a48eb0",
      "88191ae8-8db6-4d34-8c0a-62fa15d789d3",
      "d30ef2ee-e95e-4904-8967-91886a1935bf",
      "b21c2192-9e47-4706-bf4e-6b5ea6232fa3",
      "fb2023c2-4ad2-4532-862a-bd9424e58955",
      "41dd65a7-bb09-430f-990f-29e2742318bc",
      "c12d5353-0665-418e-833a-c7016ecfe72c",
      "e564ca75-f986-41b9-9555-888da6959253",
      "dc9aa571-143a-42ef-acd5-36cd3b5fae75",
      "bbaf03fd-0f97-4f6a-9bc0-e738f536c09d",
      "5850c8c0-1b25-427a-9eba-06aa2d55458f",
      "75ac56ce-768a-488f-86d7-8feb77a87526",
      "2cab88f0-aa36-46d8-9c8c-cddfe548d84b",
      "d290c2de-8cda-4acd-bb11-e3d8cdcb6883",
      "2b897b59-9a40-41b9-b4ec-6b7ca348541b",
      "313c387b-9b96-4159-9c0f-4f8fae6f8c1e",
      "f9f81ce3-a3ba-4678-aa63-ac14137199a1",
      "f96728cf-ec5e-4ef6-9269-5fc1897e465c",
      "cdd5301a-4074-4f6e-a7ae-9b84040dbcc4",
      "25c9dc91-9360-420a-a6b6-e9432fa9c424",
      "c0926bbf-033f-4d74-b6e9-878540280a07",
      "26ae765c-a357-487b-86ee-25635c1ca919",
      "bdd600dc-59ed-4047-86bd-750407cd3818",
      "d89ed589-26e7-42ab-8196-785270dcf83f",
      "58e5b065-c2d6-42b3-826a-451a7a74854e",
      "3bdf7937-f708-4c2c-b531-c049fc4b857e",
      "f6472196-c2ce-4236-9bc2-2bdae36c6771",
      "af7aa9e4-6d53-4275-8f84-61fef22d4d9f",
      "523c668d-1cdf-46a5-ad8d-8055a5c8757a",
      "b4a2ccbc-4411-4c08-8b7d-8d39b5b92c34",
      "c258ae86-c8b5-42de-b4ad-19a93ba6a38e",
      "8890a535-e9c1-400e-9d4e-17f73b9b4e46",
      "db1ccbe0-1b89-41d2-8e0b-67976a5d5616",
      "df04e11c-6b9c-47c4-8b93-5d8fa9080dbf",
      "f10748d0-6aad-4674-b94d-4dba88fc537e",
      "3f4ef664-61c1-458d-8c40-9a1488befc8b",
      "f893a75b-e07e-40bf-b4d7-c2d93cd1f66a",
      "cf7641d9-dada-43c4-9f17-c3ba97ce2353",
      "819df883-7d86-4fa9-bfa8-c9ca416fca53",
      "a8562831-ce48-4eec-8a25-0998c58e29c8",
      "272c7b05-50e1-4038-b524-633ac342fbbf",
      "b0292d77-444a-44d4-b7dd-1387e38da9af",
      "50b20127-3407-4570-809c-8e4a41ed9432",
      "be31c7a1-f145-4b49-9b03-ab8e65c07896",
      "bb4cafef-2054-42f4-b798-3e470a5f9be8",
      "7e247dbb-eb48-440e-8042-551addc1a766"
    ],
    "owedGroup": [
      {
        "tradeId": "2aca990a-633d-490f-a3b3-1242d96f7274",
        "underlying": "LLY",
        "debtIds": [
          "2a1f727c-8f80-44d6-b9c1-d8f2c7bb58fc"
        ]
      },
      {
        "tradeId": "2d34f8b4-d6f6-4e71-a1dd-0a4a948eb5e4",
        "underlying": "KO",
        "debtIds": [
          "56c177a9-5fdc-4904-b37f-eae39ee96916"
        ]
      },
      {
        "tradeId": "3d6fef93-8074-4372-b53d-51cb22ba93a0",
        "underlying": "CSCO",
        "debtIds": [
          "839f8834-1d65-42e7-9846-7fbc8575efb6"
        ]
      },
      {
        "tradeId": "40b6efb1-f0c0-4364-b2d0-181eac26a220",
        "underlying": "TXN",
        "debtIds": [
          "faee4feb-a0b0-4f0f-9bd6-9ff779ee6f28"
        ]
      },
      {
        "tradeId": "47c2d2eb-bf00-498c-b5f7-2596e1c8ba2b",
        "underlying": "MSFT",
        "debtIds": [
          "a0b801ce-fe34-4d95-ac0a-33b2db7f0066"
        ]
      },
      {
        "tradeId": "50fa9880-381e-4c15-b0b8-90911e45e85f",
        "underlying": "LLY",
        "debtIds": [
          "c7e5efdc-1a73-4301-a7a5-85eb54399936"
        ]
      },
      {
        "tradeId": "57938cc0-9666-4de5-8955-9251ebff7c54",
        "underlying": "AAPL",
        "debtIds": [
          "f933ebaf-752a-4c29-baa2-f81f9bdfd901"
        ]
      },
      {
        "tradeId": "5a5afa65-48bc-4408-8af2-bc01c5cf4503",
        "underlying": "ABBV",
        "debtIds": [
          "3f8c550c-4c93-4bc9-8eed-0bedde73800d"
        ]
      },
      {
        "tradeId": "5b657570-14b0-47a4-91ff-8dac54e52847",
        "underlying": "TXN",
        "debtIds": [
          "35270237-e3f9-4413-b069-abfed893e76a"
        ]
      },
      {
        "tradeId": "6961456a-a301-4d2a-8cc9-7e43d138468c",
        "underlying": "NVDA",
        "debtIds": [
          "a723cec9-706e-42cf-9710-4c262f769038"
        ]
      },
      {
        "tradeId": "71f822e7-e1f9-4b70-b86a-c023854eabc3",
        "underlying": "WMT",
        "debtIds": [
          "f13c86a0-3260-4fdb-b802-4997a6775706"
        ]
      },
      {
        "tradeId": "7b694350-7f33-475f-8612-d17558e04d8f",
        "underlying": "CVX",
        "debtIds": [
          "62851838-791a-46bc-83f0-a42bfaaada4f"
        ]
      },
      {
        "tradeId": "80aad448-1a6c-4718-b68e-c67a8af1e98c",
        "underlying": "KO",
        "debtIds": [
          "c2cbdcec-e969-4074-9390-a75dd1469b4e"
        ]
      },
      {
        "tradeId": "961d3c71-f8bf-478d-ab71-d80e6f1c8e4a",
        "underlying": "PFE",
        "debtIds": [
          "15acbe11-a4c7-4496-a73b-39f83b12917c"
        ]
      },
      {
        "tradeId": "9637a330-e1d7-448e-b0ea-022096b28763",
        "underlying": "CVX",
        "debtIds": [
          "25be4f34-69cd-44a9-b3df-4674d426ee87"
        ]
      },
      {
        "tradeId": "d7d24d0e-00c0-4955-a40a-bbec357b2a4d",
        "underlying": "PFE",
        "debtIds": [
          "a381eb5a-90ea-45ae-91d5-433f9c2c5b87"
        ]
      },
      {
        "tradeId": "de844708-64aa-481b-bf34-29cd65e96699",
        "underlying": "QCOM",
        "debtIds": [
          "2ca0a165-0540-4777-9946-3d2ddd249495"
        ]
      },
      {
        "tradeId": "e5c387c7-c2f3-4694-a9d5-ad7f52781d64",
        "underlying": "WMT",
        "debtIds": [
          "bef6383e-f089-4226-b82f-e47eaa2a59c9"
        ]
      },
      {
        "tradeId": "fcbfb6bf-0f5c-4c37-9dcd-42c4bbcceaa7",
        "underlying": "AAPL",
        "debtIds": [
          "f35f90db-30b8-45f6-ab49-ecf520cadd5a"
        ]
      },
      {
        "tradeId": "54e58533-f5fa-46f7-ab34-0c1367eecd4d",
        "underlying": "CSCO",
        "debtIds": [
          "5653f780-cc4f-463b-b408-52eb21ee80fd"
        ]
      },
      {
        "tradeId": "d2bad5fc-8462-4173-99aa-5c57646ce96d",
        "underlying": "JPM",
        "debtIds": [
          "c1317d75-7c7a-4a93-913e-96418f2cd2d3"
        ]
      },
      {
        "tradeId": "11ae3237-4018-4cdb-b67b-f2232695ec6d",
        "underlying": "PG",
        "debtIds": [
          "32a289bc-eca3-4143-9bce-b2e0543fb61b"
        ]
      },
      {
        "tradeId": "d79900a3-366c-478d-af9d-fb8fbb8e053c",
        "underlying": "LLY",
        "debtIds": [
          "6ca67b6e-d71a-458e-9aee-0f1cb6df03ba",
          "ec0baa92-f84d-4cd6-9387-7c5233113664"
        ]
      },
      {
        "tradeId": "e5a15d3e-79fc-44ef-a5a0-5071beb3f720",
        "underlying": "ABBV",
        "debtIds": [
          "c20d0602-4d49-49da-82ff-20fae7758796",
          "1623353d-d5f3-496b-a50c-32d673698f0d",
          "b680c362-b720-4afd-9e16-df237ae21a39"
        ]
      },
      {
        "tradeId": "9b12e1c5-b94c-4fb5-a437-284aee9d77cb",
        "underlying": "MRK",
        "debtIds": [
          "6160e534-90e2-4c54-af83-0cf11f8ecab3",
          "e3b1cda7-3b14-4d59-bbc5-24bfd7bd022f"
        ]
      },
      {
        "tradeId": "c6b3c1fa-2057-4061-8e44-b3fa4344b8eb",
        "underlying": "ADBE",
        "debtIds": [
          "8fe74605-d029-4687-80c1-71197c98a908",
          "7f58aa5a-2e43-46d3-a792-cffa23f982f0",
          "ebb99c6e-ff8c-4da7-a826-c7f4ad33e0cc"
        ]
      },
      {
        "tradeId": "19b241fe-ea9e-4f3b-b50e-f1a840b1eafe",
        "underlying": "INTC",
        "debtIds": [
          "03ffcd56-ab93-406d-88e7-2bed547c5095",
          "8e58e987-a307-4b11-88d0-ed123d98dcc3",
          "1b12d7db-73dc-4fbb-b7e2-fe46eb47b88c",
          "c7236202-4634-4a98-8770-924a4679afac"
        ]
      },
      {
        "tradeId": "0725b227-9674-42b3-ac9a-3990fdb8cbd7",
        "underlying": "QCOM",
        "debtIds": [
          "5d58ad6f-f8e1-4ed4-8a5d-dc0da0f5a831",
          "96b2f00f-2750-4c60-9920-945cdc319f3c"
        ]
      },
      {
        "tradeId": "859fc0ff-22d1-4ada-bd93-4338fd4c7bce",
        "underlying": "DIS",
        "debtIds": [
          "22ad1dee-b02b-4df6-95c4-e7e4e6bd0975",
          "9133b201-0e3d-47d8-a35f-c316380c6ac5"
        ]
      },
      {
        "tradeId": "8932c2a4-95f7-446b-b71d-8d1c1fe2a048",
        "underlying": "NKE",
        "debtIds": [
          "0d1a9e91-7c2a-4d79-b026-e1b957236171",
          "70b56e30-1b23-43ed-a373-f4be98df6db3",
          "b7fdf64a-9e6b-4e67-be19-582adf9dabfd"
        ]
      },
      {
        "tradeId": "78dccb88-560c-42bf-8184-f441e19a1154",
        "underlying": "MCD",
        "debtIds": [
          "b402c3a8-4587-4174-b765-0c1b33e87ae1",
          "f2a2b2f5-dea5-418f-a589-acc2e326882c"
        ]
      },
      {
        "tradeId": "aced863f-f5bd-4ded-9b26-d2252161de38",
        "underlying": "CAT",
        "debtIds": [
          "adc199ca-b508-4080-989c-2f0f37fd0bc9",
          "27a39215-5a8b-4e2a-8206-f14b170c6c9e",
          "f0cb203f-22d1-473f-90a2-b23d6aaf8744"
        ]
      },
      {
        "tradeId": "80cd837b-6ad1-43f3-9886-7bf600304b92",
        "underlying": "MSFT",
        "debtIds": [
          "1f577215-52d3-4b90-8f6a-d908c3edda49",
          "d0ae32fc-e4eb-44e4-97e4-929c644f8c5d",
          "56e2cabc-b497-4b45-8126-0cad577c025f",
          "fdb27257-05b6-4aeb-8348-5991ec8df00d"
        ]
      },
      {
        "tradeId": "e05e1bf0-ddfc-41d9-9b60-0cf993ee0888",
        "underlying": "NVDA",
        "debtIds": [
          "0ff07bbb-5daf-46c4-b489-3aba081a2349",
          "5864cc85-c39f-412c-8762-326bdc560932"
        ]
      },
      {
        "tradeId": "a50edb71-0fe8-48a5-b998-dbfffa339183",
        "underlying": "GOOGL",
        "debtIds": [
          "57399b7a-a7ec-412f-89e9-5086edf32ccd",
          "7b22e96d-22ed-4765-b910-40c8689912eb"
        ]
      },
      {
        "tradeId": "7e0e3756-de52-4720-be97-883d61f41212",
        "underlying": "META",
        "debtIds": [
          "a6890271-3655-4fa3-bc80-647f35b00811",
          "f696dea4-e446-4d6f-9a74-84174e39c50c"
        ]
      },
      {
        "tradeId": "fce5464a-f737-420d-a757-548e53926f51",
        "underlying": "TSLA",
        "debtIds": [
          "035d3413-0b2b-4902-ab52-5b795f8edf2d",
          "c36cd218-77ed-432a-b4fe-2cf6c5b8aefd",
          "d10a87bc-4ff9-45de-a9b1-55b65fb352e9"
        ]
      },
      {
        "tradeId": "cf92158e-2fd5-4140-b9fc-a12c1528cf0a",
        "underlying": "AVGO",
        "debtIds": [
          "8fae941c-984d-48ee-b03b-37ba70dd1e0a",
          "90e3800d-2258-4e5a-b3e7-98893e2b6fa8"
        ]
      },
      {
        "tradeId": "81b2ccd7-06e3-49b2-b9f8-fe326cae5ddf",
        "underlying": "NFLX",
        "debtIds": [
          "72a702b5-1b6f-4185-aa86-23e3feb5611f",
          "35eb6d6e-9351-4300-876d-87a7cc1abfdc",
          "d04957e2-019f-430f-9813-5de687bc279d"
        ]
      },
      {
        "tradeId": "83d3ce79-59e1-4cd5-b625-6e7a706be61e",
        "underlying": "PFE",
        "debtIds": [
          "0717289c-3036-43d4-9ef4-3ef00af83b8a",
          "cb013bbe-d02b-423c-8504-0faa4adcfb4c"
        ]
      },
      {
        "tradeId": "851659fd-a93d-4693-b17a-d2a87b8aa201",
        "underlying": "V",
        "debtIds": [
          "ce11850f-fc3d-453b-a469-ca81b3248ad8",
          "645fcdfb-f502-46c6-a895-a41e44c0905e",
          "dbf5ad35-10de-470c-a587-2505a5aedd65"
        ]
      },
      {
        "tradeId": "95b175c4-4cf5-4bfe-ae02-ae3852cb6f5c",
        "underlying": "MA",
        "debtIds": [
          "8d97b972-d912-4d23-ab8d-e499c219efd2",
          "a43f9b75-40a3-4ce4-8334-cdf0aa5c0d56"
        ]
      },
      {
        "tradeId": "49822015-c2cf-4d1c-81fc-2593b280709a",
        "underlying": "UNH",
        "debtIds": [
          "e7bfd93b-1410-42f7-aa02-69e0017fab23",
          "05b412ce-eee0-4efa-a921-5075be585c65",
          "ebfe35ba-4ce6-42d0-8e9c-40dfb3f2444f"
        ]
      },
      {
        "tradeId": "047bd03e-ccdd-4b6d-8ec1-98b9d66b2656",
        "underlying": "HD",
        "debtIds": [
          "3a111138-be07-47aa-a015-c4f4924ea507",
          "7fa27603-d80c-4c98-a7ec-b7afdec96fa4",
          "f6ad68b7-80c3-49a0-809f-f8c4f7bdc6f9"
        ]
      },
      {
        "tradeId": "72b1fb06-817a-4d41-a5d2-55afe8080131",
        "underlying": "LLY",
        "debtIds": [
          "058434ee-a936-40ce-b287-83b400298a06",
          "9ccdc360-2eec-4237-9479-1a4570024527",
          "d026eb96-6cf6-40c5-a967-ba3bef55d150",
          "f0710947-d8fe-4880-a9ae-3f141dc9aa12"
        ]
      },
      {
        "tradeId": "41b25484-ebdc-4622-b1d2-29d1930e91f0",
        "underlying": "PEP",
        "debtIds": [
          "a17fad48-6972-4957-9e4b-7a823b2950c3",
          "fcf0d020-c0a4-47cf-a801-9e253ce87e29"
        ]
      },
      {
        "tradeId": "27e45da4-8f0c-4a3d-bbbe-8d07d14b0930",
        "underlying": "CRM",
        "debtIds": [
          "d15ac604-172c-4870-8e0f-5868a81c730a",
          "a6fcd592-860d-4ec7-99f9-0feeab760182",
          "c49c75f0-dbfc-4463-bf8c-3820dfc98c43"
        ]
      },
      {
        "tradeId": "cb01e183-0472-47ea-a347-84b1c9be16fb",
        "underlying": "ORCL",
        "debtIds": [
          "3d1d595d-3bf0-498b-ae19-7e305296b031",
          "e8b42501-d19b-4d77-9676-ddaef966d058"
        ]
      },
      {
        "tradeId": "09388b4b-f67b-4bfb-88d1-6b15ad2f9dd5",
        "underlying": "AMD",
        "debtIds": [
          "f18f9c90-b7a1-48f4-9011-6b8b77941bf9",
          "594cae92-5bf2-41a9-bc0f-6e49f9c2f22d",
          "8cd038d4-df93-4130-83f1-61539af7afce"
        ]
      },
      {
        "tradeId": "27586019-a421-44cf-b43d-2d988bc0c924",
        "underlying": "INTC",
        "debtIds": [
          "d087066b-e17e-4a0b-91df-cf59c4cfdc40",
          "4cb65cb1-0dd8-4bdd-a29e-53941551bfb5",
          "a97c3243-4830-435f-b3cd-41f21878ba3d"
        ]
      },
      {
        "tradeId": "486ec1c1-f989-4ca0-89da-cad48fa5d387",
        "underlying": "DIS",
        "debtIds": [
          "c30c5ee3-743d-434c-bc8d-0d7cdb784b78",
          "05fb8022-462b-4952-adda-d126b9289238",
          "1b920ac7-a525-4ef7-8ec7-c496d78da90b",
          "4975eb0a-c0be-462c-bef1-139c99c8f295"
        ]
      },
      {
        "tradeId": "7f2ac9fd-092c-478b-9d86-70c2cd2d8156",
        "underlying": "BA",
        "debtIds": [
          "3c99d96b-f3da-4ffa-afb4-31828ca8d0e9",
          "4f6ae160-b6f4-478d-9815-3ac7bb894aa6"
        ]
      },
      {
        "tradeId": "cca37ee1-539a-4ecd-b623-a213feb9b76a",
        "underlying": "DE",
        "debtIds": [
          "663acaa5-ba9e-4c85-bd76-36632743a8f0",
          "9c463af1-4a6e-4c67-b4d6-6a16622f98ec",
          "de134be4-f30c-4b17-af55-3eee716d29c3"
        ]
      },
      {
        "tradeId": "b8fe953c-8bee-4bbe-96bb-eabe3bcccfb3",
        "underlying": "GS",
        "debtIds": [
          "6446a8d3-613a-4248-965b-69b80d142508",
          "cffc9050-9805-46ca-a607-7d4a0666902e"
        ]
      },
      {
        "tradeId": "20d13650-df1c-4bf1-bf13-4fb00efb3932",
        "underlying": "AAPL",
        "debtIds": [
          "c326a9c4-1019-423c-8507-160d269c3879",
          "65e226aa-8c01-4adf-88b3-e5bfc716dd52",
          "bd8fafc7-19eb-482b-86b5-a9b3ab9250b9"
        ]
      },
      {
        "tradeId": "679cf38f-c5e5-4476-8d98-c836f081eb7d",
        "underlying": "META",
        "debtIds": [
          "c9daf087-c331-48d2-8bfa-ec5935b31217",
          "e0221a6c-329f-4a64-bee8-778e5d465d8a",
          "4434097f-ddb6-4b91-9df1-fe5f0010fb01",
          "878d6cb5-a85a-43fb-98bd-482feda43f40"
        ]
      },
      {
        "tradeId": "1b074856-2645-4464-b805-24038a25063b",
        "underlying": "AVGO",
        "debtIds": [
          "3cecae31-8fc5-410e-83a3-ede0e19ecb0b",
          "710b3aa5-0540-41c2-8f8e-e7958ad72000"
        ]
      },
      {
        "tradeId": "63bb1a5c-b9e3-4cb7-af3f-ea1ec8f01238",
        "underlying": "COST",
        "debtIds": [
          "ea466fd2-2676-4f18-a536-0c49e8526b1d",
          "43791e99-3a5b-44d9-85b3-796fe93a2421",
          "63f2cd51-e1e2-4f82-88ed-38cbfc189eb6"
        ]
      },
      {
        "tradeId": "07c7ff67-cd6c-4f24-af40-3bcd8bd5a28c",
        "underlying": "JPM",
        "debtIds": [
          "a22a1a15-746e-4faf-8514-b4f323352c4a",
          "f8a3b8e8-fcc3-4625-87ea-a58172cf6a32",
          "4a0227f5-5101-4fc3-9eb2-9af43045ef5b",
          "7e3e7b0b-2419-4f89-8fda-6cf3229e3d9a"
        ]
      },
      {
        "tradeId": "72d02456-820c-47ec-8f89-980a5cb810c9",
        "underlying": "UNH",
        "debtIds": [
          "4eb95ae4-acd7-4f34-9079-bd0326b3fe3b",
          "5b4a0c94-7ab7-4e0b-b2eb-786601d72129"
        ]
      },
      {
        "tradeId": "ec4d27a1-34ec-45fc-9164-949053224a02",
        "underlying": "XOM",
        "debtIds": [
          "0aed51c7-9dec-4e5f-a87d-2f86c5444ebc",
          "2464ee3d-8430-48e1-8388-8607c893cf65"
        ]
      },
      {
        "tradeId": "67bf2bc0-ebc4-45d6-8f69-9b5301cad9b9",
        "underlying": "NKE",
        "debtIds": [
          "7395dfb5-5011-4d42-8fe8-5c016464594a",
          "ecb72db8-84f8-47e1-bd8c-c67c711b2ab5"
        ]
      },
      {
        "tradeId": "d1fad3c8-56f7-42bd-acc9-68400de86f5b",
        "underlying": "CAT",
        "debtIds": [
          "4883f9f4-4f71-49dc-a21e-96fa4eef96c8",
          "87780e22-f88e-4f9a-9c19-2991027760eb"
        ]
      },
      {
        "tradeId": "1331b594-c8ad-48a0-93d3-7912a8524ce2",
        "underlying": "TSLA",
        "debtIds": [
          "c1689360-347f-4ebe-8260-6ea276042539",
          "e38b7bc6-fb0a-4c4b-b0d5-2050c93adbba"
        ]
      },
      {
        "tradeId": "4f1801e7-9779-4093-ba19-e64b5e31319f",
        "underlying": "NFLX",
        "debtIds": [
          "b820ddaf-ca8f-43ad-a43e-ab6018f064f1",
          "bead6931-da0e-423c-9a41-7e042a9597cf"
        ]
      },
      {
        "tradeId": "704b0af5-6c4d-4ae4-9966-6d2a32373fc8",
        "underlying": "PG",
        "debtIds": [
          "65dba94a-18fa-45fa-bfbd-384dc632109b",
          "be97c784-f9ee-4b79-a5d5-55b27fbf4704"
        ]
      },
      {
        "tradeId": "e25e9779-fc7c-4fdc-89b0-f95bacf365b1",
        "underlying": "CRM",
        "debtIds": [
          "57731a78-8e25-4064-8378-44018b99e502",
          "71232d10-c25d-4b7f-88a0-e2f3eab9493e"
        ]
      },
      {
        "tradeId": "13fbca0c-89b7-4b42-b600-12788ab763a8",
        "underlying": "INTC",
        "debtIds": [
          "792ffbc3-6eb3-4a38-b251-57827db6896a",
          "9b9969cd-a3b6-41c3-a51b-ec57a9b0ebe6"
        ]
      },
      {
        "tradeId": "55ee422b-6a9c-4daa-9aa4-552b734d7cd1",
        "underlying": "QCOM",
        "debtIds": [
          "5c5db9f2-954b-4953-ae06-9fd96c0d9de7",
          "49bf26cb-7838-4213-9c89-329ea1398e4c",
          "ec985601-1086-4fe2-84bb-4f9ed822824d"
        ]
      },
      {
        "tradeId": "29979fa7-b43e-409d-9545-ec1c31c5d30b",
        "underlying": "DIS",
        "debtIds": [
          "fd48690e-0f51-4692-af4f-3ee0c5ab0f21",
          "61508571-539e-4b6c-8c77-be6462d59a70",
          "cf160c26-c642-4810-ad02-254d6e04b37c"
        ]
      },
      {
        "tradeId": "94a27baa-d934-4366-bb57-823a452bfa31",
        "underlying": "DE",
        "debtIds": [
          "d1763a92-e389-4675-8958-5cec810096e8",
          "dd329ce7-acdc-4eb3-96c8-a9965eab466c"
        ]
      },
      {
        "tradeId": "4ac546dc-b749-4ed2-bd1a-96430b793af3",
        "underlying": "NVDA",
        "debtIds": [
          "9df6b44c-3127-42ff-ac51-52ea1f8b8554",
          "de64cde2-8f13-45c2-af36-0e04b9bf4636"
        ]
      },
      {
        "tradeId": "e55bb4d6-43c3-413f-8734-41951aad3f00",
        "underlying": "META",
        "debtIds": [
          "3000e0d7-5036-4cc1-b995-ba8eebcd1dab",
          "8fa97db3-dda6-4ff6-9a57-7bcde9ab821a"
        ]
      },
      {
        "tradeId": "3a97f5f9-8a52-4efd-83a7-3291f6633698",
        "underlying": "V",
        "debtIds": [
          "76b89d3b-f39c-4c01-b524-faeeb5bdda7e",
          "e21f69e9-a582-4d48-87a4-000f921546da"
        ]
      },
      {
        "tradeId": "3d553e13-d7b0-48c2-84bc-38c1651acbda",
        "underlying": "HD",
        "debtIds": [
          "923bcf09-42e1-4d49-98c5-b8c161feeaff",
          "22e802e1-e4b1-49b1-9209-c38c7c766270",
          "eea4688f-aab5-41e2-885d-9ff5b9a7ba89"
        ]
      },
      {
        "tradeId": "f7b7280e-f43e-428a-8cd8-9aceb37292e0",
        "underlying": "CRM",
        "debtIds": [
          "f13a7482-f66a-48d3-a526-cefadfe74adc",
          "07fdff42-86ad-455c-bc83-51c131773f29",
          "62a81c8b-8d55-4590-b6b8-39ea02dfb76a"
        ]
      },
      {
        "tradeId": "763c48df-45e9-4f16-8214-34ee70201a17",
        "underlying": "DE",
        "debtIds": [
          "d77920df-75c0-42df-8853-f9f0732fe738",
          "696731ba-51ef-4f34-ba73-d075cb9cb4a5",
          "d3fde867-be6c-43ea-934d-d54adb7285f9"
        ]
      },
      {
        "tradeId": "96e97d77-4343-4bd0-888e-7b18201fd256",
        "underlying": "JPM",
        "debtIds": [
          "505ba064-5222-4d19-b722-fcbab3343572",
          "a45c9c5c-e0d5-4c1e-b892-317b759093c0",
          "0503bfde-9c02-46fe-a657-febec5ca9d10",
          "dd0d9d25-0c1c-456d-ae20-815a7ecb2b53"
        ]
      },
      {
        "tradeId": "94378866-223a-4d01-982c-b9408b21842f",
        "underlying": "PG",
        "debtIds": [
          "c015ed1f-3cf7-459f-b9d9-5db2d0d89bcf",
          "301e7ef2-c55a-47a2-ae15-ced874efc9a9",
          "80109f86-72e4-4c2e-a56a-b0803fe33aec"
        ]
      },
      {
        "tradeId": "0dc4980b-3089-4a65-bb05-228eb71700ee",
        "underlying": "XOM",
        "debtIds": [
          "b9d11811-743f-42c0-afe2-7a930cbb82b5",
          "c334ee32-4dbe-430e-85a5-c4ab98ac9cf0"
        ]
      },
      {
        "tradeId": "be25b24a-d623-4f1a-81b8-4bcbe1974f92",
        "underlying": "ADBE",
        "debtIds": [
          "1e5312ed-b5d7-44a5-85ed-150abc59c732",
          "a075bd1e-8996-4aee-af23-b575bd735c7b",
          "11732658-8126-4968-bf61-b83f74375e0c",
          "b3caa1a2-d912-403e-bc70-22df6bb20f5d"
        ]
      },
      {
        "tradeId": "871118d4-1bed-4f2c-963a-c1b3127b793f",
        "underlying": "TXN",
        "debtIds": [
          "13d64a95-8556-4648-8acb-604b284d52c1",
          "c17680e1-581b-446a-b693-177b3562c806"
        ]
      },
      {
        "tradeId": "8ede93d2-4620-45d4-890b-7f1ccc4a6c81",
        "underlying": "CAT",
        "debtIds": [
          "7c13bbfd-c002-4102-8d5d-a3694024a078",
          "8f62a38a-9106-4bcc-ac4a-bb1ab061e052",
          "73299635-3610-4efe-9dc9-15b66ed69a4b",
          "cb4c20d2-d10d-43a6-9cc4-681f6a505053"
        ]
      },
      {
        "tradeId": "71dfa840-bc4d-42d4-8cc9-5e1d1d391b7c",
        "underlying": "AMZN",
        "debtIds": [
          "6486a556-c075-48c2-929a-106a0fe7a09d",
          "9a748227-185d-429c-abfb-0e06a627f114"
        ]
      },
      {
        "tradeId": "e19d3f44-5ed4-4033-9759-0d825de9ee91",
        "underlying": "CSCO",
        "debtIds": [
          "dcdc6009-3c8f-4fdb-a566-a67e41881b86",
          "6e7dbf5f-3085-4b34-98de-efb47bbca606",
          "87ceaa8d-5f05-4148-b329-b788a6047c2f"
        ]
      },
      {
        "tradeId": "f278a175-923c-4ee5-8875-cb2b0f71be17",
        "underlying": "KO",
        "debtIds": [
          "4ff0f683-041c-4e64-86d0-18e23b6832cf",
          "e4d159ee-c78a-460f-8438-72731ca78263"
        ]
      },
      {
        "tradeId": "a919d594-8427-4803-be80-68cd7245f2de",
        "underlying": "PFE",
        "debtIds": [
          "8e3bf6db-7919-4f94-ab94-e23110d01f0e",
          "587a6ad0-63fa-425b-b13b-dcf5913e9a52",
          "efece9a4-2176-434f-8e54-0f4e867e546b"
        ]
      },
      {
        "tradeId": "4a29ca86-2526-42ed-af96-55ed4f4913a8",
        "underlying": "HD",
        "debtIds": [
          "82739151-195a-437d-b492-2117f13bdf82",
          "95e079cf-6dc9-4a8b-9b36-ecf5fb34d427",
          "613145a9-0f0c-46a0-99bc-bacc92c42928",
          "ba42395d-4a16-4ee4-a102-c4702208c69d"
        ]
      },
      {
        "tradeId": "30ec5869-cf70-4367-ad8e-47fe33f04c7e",
        "underlying": "NKE",
        "debtIds": [
          "3e3c0886-631a-4e5f-b21b-3b6af225e119",
          "9c1b7650-7e4b-4b4f-8cb6-3fb37dbbb120",
          "c2061a6d-e574-4c28-b0cb-29bbec4aadf2"
        ]
      },
      {
        "tradeId": "cede4d72-19b8-4f48-a934-640af69bd94e",
        "underlying": "NFLX",
        "debtIds": [
          "f8ba65b7-9739-4ef2-943d-207652fad744",
          "bd159397-01e2-4c77-b44d-e358f63f98e2",
          "031c4ed2-b4da-4258-8373-f7f4b4770c70",
          "5b861a02-bdb3-49e0-a35c-de48d334d4b0"
        ]
      },
      {
        "tradeId": "4cc00063-c782-49a5-9590-cb6351fe1fe5",
        "underlying": "V",
        "debtIds": [
          "5bd31464-38c7-4bab-ae6c-6f3970181d18",
          "a85ea4d6-c68e-4b2f-bdfd-c747dc099447",
          "e4f2f5c3-b200-4929-a2f8-2d0897143fe1"
        ]
      },
      {
        "tradeId": "8535d565-16f8-4b68-9215-0f628ca681a7",
        "underlying": "MA",
        "debtIds": [
          "0ab17c7e-a074-4b98-9991-7b7c6d08569b",
          "ed1df058-3458-42f6-8106-91e458e3357e"
        ]
      },
      {
        "tradeId": "005c6f55-46a8-4dde-b101-f4ed9a7cd1eb",
        "underlying": "TSLA",
        "debtIds": [
          "3b693c2e-aca4-4361-b402-b89953dff53a",
          "3eb6de24-d820-4ea7-8257-9e4edc5ebfbe",
          "4243aac6-0b8a-4df4-9389-a6680f1ae927"
        ]
      },
      {
        "tradeId": "43097398-fa27-4395-a41f-362651f63e55",
        "underlying": "PG",
        "debtIds": [
          "bf9a8274-9199-4c9f-b9d3-a00f21e6fc84",
          "b317d5c8-d019-4c80-ae1b-962eb0e3dd0b",
          "f37100ba-71c3-4c68-844f-c0a0462c436a"
        ]
      },
      {
        "tradeId": "42340328-6781-470a-9952-bde8fecbea8d",
        "underlying": "MSFT",
        "debtIds": [
          "30c07e9f-74aa-4815-934c-1c37c3e788d2",
          "5b2f7c83-d850-48ed-9709-45f52f5a4260"
        ]
      },
      {
        "tradeId": "653c57db-f8c9-42d6-bb4b-769da19956f0",
        "underlying": "QCOM",
        "debtIds": [
          "b2cecb70-e979-42ff-b05d-f04ec08845fb",
          "d536fcaa-cd45-492f-9a5c-a7f43d8ca282"
        ]
      },
      {
        "tradeId": "912eb056-4b9f-4c08-a583-7c544d487008",
        "underlying": "NVDA",
        "debtIds": [
          "1503bad1-dd5b-4a3d-aa90-dd46e3e7e66a",
          "1a35c083-9f6e-4449-b273-67ee61c514fe"
        ]
      },
      {
        "tradeId": "b2b099c2-1c51-474e-958d-7b71febf3f6c",
        "underlying": "ABBV",
        "debtIds": [
          "168dbbe1-a5ce-4fde-894a-cd0a4423ba6a",
          "403d879e-29bb-4e8d-a5b5-2f98c6111ca6"
        ]
      },
      {
        "tradeId": "cdca9874-229f-4253-9576-9163d0fe08f6",
        "underlying": "CSCO",
        "debtIds": [
          "25ed07d5-f01e-439f-90d1-28f9d2cfc978",
          "4a7e16b7-8908-4ace-92f2-10fce0b88d03"
        ]
      }
    ]
  },
  "asOfDueReflections": 487,
  "outstandingDebts": [
    {
      "debtId": "25be4f34-69cd-44a9-b3df-4674d426ee87",
      "tradeId": "9637a330-e1d7-448e-b0ea-022096b28763",
      "underlying": "CVX",
      "kind": "CloseReview",
      "positionChange": 24601,
      "momentDate": "2026-10-30"
    },
    {
      "debtId": "c7e5efdc-1a73-4301-a7a5-85eb54399936",
      "tradeId": "50fa9880-381e-4c15-b0b8-90911e45e85f",
      "underlying": "LLY",
      "kind": "CloseReview",
      "positionChange": 24602,
      "momentDate": "2026-10-30"
    },
    {
      "debtId": "f13c86a0-3260-4fdb-b802-4997a6775706",
      "tradeId": "71f822e7-e1f9-4b70-b86a-c023854eabc3",
      "underlying": "WMT",
      "kind": "CloseReview",
      "positionChange": 24603,
      "momentDate": "2026-10-30"
    },
    {
      "debtId": "f35f90db-30b8-45f6-ab49-ecf520cadd5a",
      "tradeId": "fcbfb6bf-0f5c-4c37-9dcd-42c4bbcceaa7",
      "underlying": "AAPL",
      "kind": "CloseReview",
      "positionChange": 24604,
      "momentDate": "2026-10-30"
    },
    {
      "debtId": "56c177a9-5fdc-4904-b37f-eae39ee96916",
      "tradeId": "2d34f8b4-d6f6-4e71-a1dd-0a4a948eb5e4",
      "underlying": "KO",
      "kind": "CloseReview",
      "positionChange": 24605,
      "momentDate": "2026-10-30"
    },
    {
      "debtId": "a381eb5a-90ea-45ae-91d5-433f9c2c5b87",
      "tradeId": "d7d24d0e-00c0-4955-a40a-bbec357b2a4d",
      "underlying": "PFE",
      "kind": "CloseReview",
      "positionChange": 24606,
      "momentDate": "2026-10-30"
    },
    {
      "debtId": "2ca0a165-0540-4777-9946-3d2ddd249495",
      "tradeId": "de844708-64aa-481b-bf34-29cd65e96699",
      "underlying": "QCOM",
      "kind": "CloseReview",
      "positionChange": 24607,
      "momentDate": "2026-10-30"
    },
    {
      "debtId": "faee4feb-a0b0-4f0f-9bd6-9ff779ee6f28",
      "tradeId": "40b6efb1-f0c0-4364-b2d0-181eac26a220",
      "underlying": "TXN",
      "kind": "CloseReview",
      "positionChange": 24608,
      "momentDate": "2026-10-30"
    },
    {
      "debtId": "a723cec9-706e-42cf-9710-4c262f769038",
      "tradeId": "6961456a-a301-4d2a-8cc9-7e43d138468c",
      "underlying": "NVDA",
      "kind": "CloseReview",
      "positionChange": 24609,
      "momentDate": "2026-10-30"
    },
    {
      "debtId": "839f8834-1d65-42e7-9846-7fbc8575efb6",
      "tradeId": "3d6fef93-8074-4372-b53d-51cb22ba93a0",
      "underlying": "CSCO",
      "kind": "CloseReview",
      "positionChange": 24610,
      "momentDate": "2026-10-30"
    },
    {
      "debtId": "2a1f727c-8f80-44d6-b9c1-d8f2c7bb58fc",
      "tradeId": "2aca990a-633d-490f-a3b3-1242d96f7274",
      "underlying": "LLY",
      "kind": "CloseReview",
      "positionChange": 24611,
      "momentDate": "2026-10-30"
    },
    {
      "debtId": "3f8c550c-4c93-4bc9-8eed-0bedde73800d",
      "tradeId": "5a5afa65-48bc-4408-8af2-bc01c5cf4503",
      "underlying": "ABBV",
      "kind": "CloseReview",
      "positionChange": 24612,
      "momentDate": "2026-10-30"
    },
    {
      "debtId": "f933ebaf-752a-4c29-baa2-f81f9bdfd901",
      "tradeId": "57938cc0-9666-4de5-8955-9251ebff7c54",
      "underlying": "AAPL",
      "kind": "CloseReview",
      "positionChange": 24613,
      "momentDate": "2026-10-30"
    },
    {
      "debtId": "a0b801ce-fe34-4d95-ac0a-33b2db7f0066",
      "tradeId": "47c2d2eb-bf00-498c-b5f7-2596e1c8ba2b",
      "underlying": "MSFT",
      "kind": "CloseReview",
      "positionChange": 24614,
      "momentDate": "2026-10-30"
    },
    {
      "debtId": "15acbe11-a4c7-4496-a73b-39f83b12917c",
      "tradeId": "961d3c71-f8bf-478d-ab71-d80e6f1c8e4a",
      "underlying": "PFE",
      "kind": "CloseReview",
      "positionChange": 24615,
      "momentDate": "2026-10-30"
    },
    {
      "debtId": "62851838-791a-46bc-83f0-a42bfaaada4f",
      "tradeId": "7b694350-7f33-475f-8612-d17558e04d8f",
      "underlying": "CVX",
      "kind": "CloseReview",
      "positionChange": 24616,
      "momentDate": "2026-10-30"
    },
    {
      "debtId": "35270237-e3f9-4413-b069-abfed893e76a",
      "tradeId": "5b657570-14b0-47a4-91ff-8dac54e52847",
      "underlying": "TXN",
      "kind": "CloseReview",
      "positionChange": 24617,
      "momentDate": "2026-10-30"
    },
    {
      "debtId": "bef6383e-f089-4226-b82f-e47eaa2a59c9",
      "tradeId": "e5c387c7-c2f3-4694-a9d5-ad7f52781d64",
      "underlying": "WMT",
      "kind": "CloseReview",
      "positionChange": 24618,
      "momentDate": "2026-10-30"
    },
    {
      "debtId": "c2cbdcec-e969-4074-9390-a75dd1469b4e",
      "tradeId": "80aad448-1a6c-4718-b68e-c67a8af1e98c",
      "underlying": "KO",
      "kind": "CloseReview",
      "positionChange": 24619,
      "momentDate": "2026-10-30"
    },
    {
      "debtId": "5653f780-cc4f-463b-b408-52eb21ee80fd",
      "tradeId": "54e58533-f5fa-46f7-ab34-0c1367eecd4d",
      "underlying": "CSCO",
      "kind": "CloseReview",
      "positionChange": 24620,
      "momentDate": "2026-11-02"
    },
    {
      "debtId": "c1317d75-7c7a-4a93-913e-96418f2cd2d3",
      "tradeId": "d2bad5fc-8462-4173-99aa-5c57646ce96d",
      "underlying": "JPM",
      "kind": "CloseReview",
      "positionChange": 24621,
      "momentDate": "2026-11-02"
    },
    {
      "debtId": "32a289bc-eca3-4143-9bce-b2e0543fb61b",
      "tradeId": "11ae3237-4018-4cdb-b67b-f2232695ec6d",
      "underlying": "PG",
      "kind": "CloseReview",
      "positionChange": 24622,
      "momentDate": "2026-11-02"
    },
    {
      "debtId": "6ca67b6e-d71a-458e-9aee-0f1cb6df03ba",
      "tradeId": "d79900a3-366c-478d-af9d-fb8fbb8e053c",
      "underlying": "LLY",
      "kind": "PositionChange",
      "positionChange": 96739,
      "momentDate": "2026-11-02"
    },
    {
      "debtId": "ec0baa92-f84d-4cd6-9387-7c5233113664",
      "tradeId": "d79900a3-366c-478d-af9d-fb8fbb8e053c",
      "underlying": "LLY",
      "kind": "CloseReview",
      "positionChange": 24623,
      "momentDate": "2026-11-02"
    },
    {
      "debtId": "c20d0602-4d49-49da-82ff-20fae7758796",
      "tradeId": "e5a15d3e-79fc-44ef-a5a0-5071beb3f720",
      "underlying": "ABBV",
      "kind": "PositionChange",
      "positionChange": 96740,
      "momentDate": "2026-11-02"
    },
    {
      "debtId": "6160e534-90e2-4c54-af83-0cf11f8ecab3",
      "tradeId": "9b12e1c5-b94c-4fb5-a437-284aee9d77cb",
      "underlying": "MRK",
      "kind": "PositionChange",
      "positionChange": 96741,
      "momentDate": "2026-11-02"
    },
    {
      "debtId": "e3b1cda7-3b14-4d59-bbc5-24bfd7bd022f",
      "tradeId": "9b12e1c5-b94c-4fb5-a437-284aee9d77cb",
      "underlying": "MRK",
      "kind": "CloseReview",
      "positionChange": 24624,
      "momentDate": "2026-11-02"
    },
    {
      "debtId": "8fe74605-d029-4687-80c1-71197c98a908",
      "tradeId": "c6b3c1fa-2057-4061-8e44-b3fa4344b8eb",
      "underlying": "ADBE",
      "kind": "PositionChange",
      "positionChange": 96742,
      "momentDate": "2026-11-02"
    },
    {
      "debtId": "03ffcd56-ab93-406d-88e7-2bed547c5095",
      "tradeId": "19b241fe-ea9e-4f3b-b50e-f1a840b1eafe",
      "underlying": "INTC",
      "kind": "PositionChange",
      "positionChange": 96743,
      "momentDate": "2026-11-02"
    },
    {
      "debtId": "96b2f00f-2750-4c60-9920-945cdc319f3c",
      "tradeId": "0725b227-9674-42b3-ac9a-3990fdb8cbd7",
      "underlying": "QCOM",
      "kind": "PositionChange",
      "positionChange": 96744,
      "momentDate": "2026-11-02"
    },
    {
      "debtId": "5d58ad6f-f8e1-4ed4-8a5d-dc0da0f5a831",
      "tradeId": "0725b227-9674-42b3-ac9a-3990fdb8cbd7",
      "underlying": "QCOM",
      "kind": "CloseReview",
      "positionChange": 24625,
      "momentDate": "2026-11-02"
    },
    {
      "debtId": "22ad1dee-b02b-4df6-95c4-e7e4e6bd0975",
      "tradeId": "859fc0ff-22d1-4ada-bd93-4338fd4c7bce",
      "underlying": "DIS",
      "kind": "PositionChange",
      "positionChange": 96745,
      "momentDate": "2026-11-02"
    },
    {
      "debtId": "9133b201-0e3d-47d8-a35f-c316380c6ac5",
      "tradeId": "859fc0ff-22d1-4ada-bd93-4338fd4c7bce",
      "underlying": "DIS",
      "kind": "CloseReview",
      "positionChange": 24626,
      "momentDate": "2026-11-02"
    },
    {
      "debtId": "0d1a9e91-7c2a-4d79-b026-e1b957236171",
      "tradeId": "8932c2a4-95f7-446b-b71d-8d1c1fe2a048",
      "underlying": "NKE",
      "kind": "PositionChange",
      "positionChange": 96746,
      "momentDate": "2026-11-02"
    },
    {
      "debtId": "b402c3a8-4587-4174-b765-0c1b33e87ae1",
      "tradeId": "78dccb88-560c-42bf-8184-f441e19a1154",
      "underlying": "MCD",
      "kind": "PositionChange",
      "positionChange": 96747,
      "momentDate": "2026-11-02"
    },
    {
      "debtId": "f2a2b2f5-dea5-418f-a589-acc2e326882c",
      "tradeId": "78dccb88-560c-42bf-8184-f441e19a1154",
      "underlying": "MCD",
      "kind": "CloseReview",
      "positionChange": 24627,
      "momentDate": "2026-11-02"
    },
    {
      "debtId": "adc199ca-b508-4080-989c-2f0f37fd0bc9",
      "tradeId": "aced863f-f5bd-4ded-9b26-d2252161de38",
      "underlying": "CAT",
      "kind": "PositionChange",
      "positionChange": 96748,
      "momentDate": "2026-11-02"
    },
    {
      "debtId": "1f577215-52d3-4b90-8f6a-d908c3edda49",
      "tradeId": "80cd837b-6ad1-43f3-9886-7bf600304b92",
      "underlying": "MSFT",
      "kind": "PositionChange",
      "positionChange": 96749,
      "momentDate": "2026-11-02"
    },
    {
      "debtId": "0ff07bbb-5daf-46c4-b489-3aba081a2349",
      "tradeId": "e05e1bf0-ddfc-41d9-9b60-0cf993ee0888",
      "underlying": "NVDA",
      "kind": "PositionChange",
      "positionChange": 96750,
      "momentDate": "2026-11-02"
    },
    {
      "debtId": "5864cc85-c39f-412c-8762-326bdc560932",
      "tradeId": "e05e1bf0-ddfc-41d9-9b60-0cf993ee0888",
      "underlying": "NVDA",
      "kind": "CloseReview",
      "positionChange": 24628,
      "momentDate": "2026-11-02"
    },
    {
      "debtId": "57399b7a-a7ec-412f-89e9-5086edf32ccd",
      "tradeId": "a50edb71-0fe8-48a5-b998-dbfffa339183",
      "underlying": "GOOGL",
      "kind": "PositionChange",
      "positionChange": 96751,
      "momentDate": "2026-11-02"
    },
    {
      "debtId": "7b22e96d-22ed-4765-b910-40c8689912eb",
      "tradeId": "a50edb71-0fe8-48a5-b998-dbfffa339183",
      "underlying": "GOOGL",
      "kind": "CloseReview",
      "positionChange": 24629,
      "momentDate": "2026-11-02"
    },
    {
      "debtId": "a6890271-3655-4fa3-bc80-647f35b00811",
      "tradeId": "7e0e3756-de52-4720-be97-883d61f41212",
      "underlying": "META",
      "kind": "PositionChange",
      "positionChange": 96752,
      "momentDate": "2026-11-02"
    },
    {
      "debtId": "f696dea4-e446-4d6f-9a74-84174e39c50c",
      "tradeId": "7e0e3756-de52-4720-be97-883d61f41212",
      "underlying": "META",
      "kind": "CloseReview",
      "positionChange": 24630,
      "momentDate": "2026-11-02"
    },
    {
      "debtId": "035d3413-0b2b-4902-ab52-5b795f8edf2d",
      "tradeId": "fce5464a-f737-420d-a757-548e53926f51",
      "underlying": "TSLA",
      "kind": "PositionChange",
      "positionChange": 96753,
      "momentDate": "2026-11-02"
    },
    {
      "debtId": "90e3800d-2258-4e5a-b3e7-98893e2b6fa8",
      "tradeId": "cf92158e-2fd5-4140-b9fc-a12c1528cf0a",
      "underlying": "AVGO",
      "kind": "PositionChange",
      "positionChange": 96754,
      "momentDate": "2026-11-02"
    },
    {
      "debtId": "8fae941c-984d-48ee-b03b-37ba70dd1e0a",
      "tradeId": "cf92158e-2fd5-4140-b9fc-a12c1528cf0a",
      "underlying": "AVGO",
      "kind": "CloseReview",
      "positionChange": 24631,
      "momentDate": "2026-11-02"
    },
    {
      "debtId": "72a702b5-1b6f-4185-aa86-23e3feb5611f",
      "tradeId": "81b2ccd7-06e3-49b2-b9f8-fe326cae5ddf",
      "underlying": "NFLX",
      "kind": "PositionChange",
      "positionChange": 96755,
      "momentDate": "2026-11-02"
    },
    {
      "debtId": "0717289c-3036-43d4-9ef4-3ef00af83b8a",
      "tradeId": "83d3ce79-59e1-4cd5-b625-6e7a706be61e",
      "underlying": "PFE",
      "kind": "PositionChange",
      "positionChange": 96756,
      "momentDate": "2026-11-02"
    },
    {
      "debtId": "cb013bbe-d02b-423c-8504-0faa4adcfb4c",
      "tradeId": "83d3ce79-59e1-4cd5-b625-6e7a706be61e",
      "underlying": "PFE",
      "kind": "CloseReview",
      "positionChange": 24632,
      "momentDate": "2026-11-02"
    },
    {
      "debtId": "ce11850f-fc3d-453b-a469-ca81b3248ad8",
      "tradeId": "851659fd-a93d-4693-b17a-d2a87b8aa201",
      "underlying": "V",
      "kind": "PositionChange",
      "positionChange": 96757,
      "momentDate": "2026-11-02"
    },
    {
      "debtId": "a43f9b75-40a3-4ce4-8334-cdf0aa5c0d56",
      "tradeId": "95b175c4-4cf5-4bfe-ae02-ae3852cb6f5c",
      "underlying": "MA",
      "kind": "PositionChange",
      "positionChange": 96758,
      "momentDate": "2026-11-02"
    },
    {
      "debtId": "8d97b972-d912-4d23-ab8d-e499c219efd2",
      "tradeId": "95b175c4-4cf5-4bfe-ae02-ae3852cb6f5c",
      "underlying": "MA",
      "kind": "CloseReview",
      "positionChange": 24633,
      "momentDate": "2026-11-02"
    },
    {
      "debtId": "e7bfd93b-1410-42f7-aa02-69e0017fab23",
      "tradeId": "49822015-c2cf-4d1c-81fc-2593b280709a",
      "underlying": "UNH",
      "kind": "PositionChange",
      "positionChange": 96759,
      "momentDate": "2026-11-02"
    },
    {
      "debtId": "3a111138-be07-47aa-a015-c4f4924ea507",
      "tradeId": "047bd03e-ccdd-4b6d-8ec1-98b9d66b2656",
      "underlying": "HD",
      "kind": "PositionChange",
      "positionChange": 96760,
      "momentDate": "2026-11-02"
    },
    {
      "debtId": "058434ee-a936-40ce-b287-83b400298a06",
      "tradeId": "72b1fb06-817a-4d41-a5d2-55afe8080131",
      "underlying": "LLY",
      "kind": "PositionChange",
      "positionChange": 96761,
      "momentDate": "2026-11-02"
    },
    {
      "debtId": "a17fad48-6972-4957-9e4b-7a823b2950c3",
      "tradeId": "41b25484-ebdc-4622-b1d2-29d1930e91f0",
      "underlying": "PEP",
      "kind": "PositionChange",
      "positionChange": 96762,
      "momentDate": "2026-11-02"
    },
    {
      "debtId": "fcf0d020-c0a4-47cf-a801-9e253ce87e29",
      "tradeId": "41b25484-ebdc-4622-b1d2-29d1930e91f0",
      "underlying": "PEP",
      "kind": "CloseReview",
      "positionChange": 24634,
      "momentDate": "2026-11-02"
    },
    {
      "debtId": "d15ac604-172c-4870-8e0f-5868a81c730a",
      "tradeId": "27e45da4-8f0c-4a3d-bbbe-8d07d14b0930",
      "underlying": "CRM",
      "kind": "PositionChange",
      "positionChange": 96763,
      "momentDate": "2026-11-02"
    },
    {
      "debtId": "3d1d595d-3bf0-498b-ae19-7e305296b031",
      "tradeId": "cb01e183-0472-47ea-a347-84b1c9be16fb",
      "underlying": "ORCL",
      "kind": "PositionChange",
      "positionChange": 96764,
      "momentDate": "2026-11-02"
    },
    {
      "debtId": "e8b42501-d19b-4d77-9676-ddaef966d058",
      "tradeId": "cb01e183-0472-47ea-a347-84b1c9be16fb",
      "underlying": "ORCL",
      "kind": "CloseReview",
      "positionChange": 24635,
      "momentDate": "2026-11-02"
    },
    {
      "debtId": "f18f9c90-b7a1-48f4-9011-6b8b77941bf9",
      "tradeId": "09388b4b-f67b-4bfb-88d1-6b15ad2f9dd5",
      "underlying": "AMD",
      "kind": "PositionChange",
      "positionChange": 96765,
      "momentDate": "2026-11-02"
    },
    {
      "debtId": "d087066b-e17e-4a0b-91df-cf59c4cfdc40",
      "tradeId": "27586019-a421-44cf-b43d-2d988bc0c924",
      "underlying": "INTC",
      "kind": "PositionChange",
      "positionChange": 96766,
      "momentDate": "2026-11-02"
    },
    {
      "debtId": "c30c5ee3-743d-434c-bc8d-0d7cdb784b78",
      "tradeId": "486ec1c1-f989-4ca0-89da-cad48fa5d387",
      "underlying": "DIS",
      "kind": "PositionChange",
      "positionChange": 96767,
      "momentDate": "2026-11-02"
    },
    {
      "debtId": "4f6ae160-b6f4-478d-9815-3ac7bb894aa6",
      "tradeId": "7f2ac9fd-092c-478b-9d86-70c2cd2d8156",
      "underlying": "BA",
      "kind": "PositionChange",
      "positionChange": 96768,
      "momentDate": "2026-11-02"
    },
    {
      "debtId": "3c99d96b-f3da-4ffa-afb4-31828ca8d0e9",
      "tradeId": "7f2ac9fd-092c-478b-9d86-70c2cd2d8156",
      "underlying": "BA",
      "kind": "CloseReview",
      "positionChange": 24636,
      "momentDate": "2026-11-02"
    },
    {
      "debtId": "663acaa5-ba9e-4c85-bd76-36632743a8f0",
      "tradeId": "cca37ee1-539a-4ecd-b623-a213feb9b76a",
      "underlying": "DE",
      "kind": "PositionChange",
      "positionChange": 96769,
      "momentDate": "2026-11-02"
    },
    {
      "debtId": "cffc9050-9805-46ca-a607-7d4a0666902e",
      "tradeId": "b8fe953c-8bee-4bbe-96bb-eabe3bcccfb3",
      "underlying": "GS",
      "kind": "PositionChange",
      "positionChange": 96770,
      "momentDate": "2026-11-02"
    },
    {
      "debtId": "6446a8d3-613a-4248-965b-69b80d142508",
      "tradeId": "b8fe953c-8bee-4bbe-96bb-eabe3bcccfb3",
      "underlying": "GS",
      "kind": "CloseReview",
      "positionChange": 24637,
      "momentDate": "2026-11-02"
    },
    {
      "debtId": "c326a9c4-1019-423c-8507-160d269c3879",
      "tradeId": "20d13650-df1c-4bf1-bf13-4fb00efb3932",
      "underlying": "AAPL",
      "kind": "PositionChange",
      "positionChange": 96771,
      "momentDate": "2026-11-02"
    },
    {
      "debtId": "c9daf087-c331-48d2-8bfa-ec5935b31217",
      "tradeId": "679cf38f-c5e5-4476-8d98-c836f081eb7d",
      "underlying": "META",
      "kind": "PositionChange",
      "positionChange": 96772,
      "momentDate": "2026-11-02"
    },
    {
      "debtId": "710b3aa5-0540-41c2-8f8e-e7958ad72000",
      "tradeId": "1b074856-2645-4464-b805-24038a25063b",
      "underlying": "AVGO",
      "kind": "PositionChange",
      "positionChange": 96773,
      "momentDate": "2026-11-02"
    },
    {
      "debtId": "3cecae31-8fc5-410e-83a3-ede0e19ecb0b",
      "tradeId": "1b074856-2645-4464-b805-24038a25063b",
      "underlying": "AVGO",
      "kind": "CloseReview",
      "positionChange": 24638,
      "momentDate": "2026-11-02"
    },
    {
      "debtId": "ea466fd2-2676-4f18-a536-0c49e8526b1d",
      "tradeId": "63bb1a5c-b9e3-4cb7-af3f-ea1ec8f01238",
      "underlying": "COST",
      "kind": "PositionChange",
      "positionChange": 96774,
      "momentDate": "2026-11-02"
    },
    {
      "debtId": "a22a1a15-746e-4faf-8514-b4f323352c4a",
      "tradeId": "07c7ff67-cd6c-4f24-af40-3bcd8bd5a28c",
      "underlying": "JPM",
      "kind": "PositionChange",
      "positionChange": 96775,
      "momentDate": "2026-11-02"
    },
    {
      "debtId": "4eb95ae4-acd7-4f34-9079-bd0326b3fe3b",
      "tradeId": "72d02456-820c-47ec-8f89-980a5cb810c9",
      "underlying": "UNH",
      "kind": "PositionChange",
      "positionChange": 96776,
      "momentDate": "2026-11-02"
    },
    {
      "debtId": "5b4a0c94-7ab7-4e0b-b2eb-786601d72129",
      "tradeId": "72d02456-820c-47ec-8f89-980a5cb810c9",
      "underlying": "UNH",
      "kind": "CloseReview",
      "positionChange": 24639,
      "momentDate": "2026-11-02"
    },
    {
      "debtId": "2464ee3d-8430-48e1-8388-8607c893cf65",
      "tradeId": "ec4d27a1-34ec-45fc-9164-949053224a02",
      "underlying": "XOM",
      "kind": "PositionChange",
      "positionChange": 96777,
      "momentDate": "2026-11-02"
    },
    {
      "debtId": "0aed51c7-9dec-4e5f-a87d-2f86c5444ebc",
      "tradeId": "ec4d27a1-34ec-45fc-9164-949053224a02",
      "underlying": "XOM",
      "kind": "CloseReview",
      "positionChange": 24640,
      "momentDate": "2026-11-02"
    },
    {
      "debtId": "f7cbc31f-6615-4bad-b80d-ee629d73b083",
      "tradeId": "b447f6e6-d34e-4c65-8d88-353e94741308",
      "underlying": "COST",
      "kind": "PositionChange",
      "positionChange": 96778,
      "momentDate": "2026-11-02"
    },
    {
      "debtId": "557e1ca8-801c-49b4-b218-49e3a8344180",
      "tradeId": "f94a4f07-481b-4b3c-aba5-5b68032deb1e",
      "underlying": "HD",
      "kind": "PositionChange",
      "positionChange": 96779,
      "momentDate": "2026-11-02"
    },
    {
      "debtId": "49be4065-2c5f-4e6a-b537-2a3b23c9441c",
      "tradeId": "426b39b4-ffed-4481-97e5-db867bc6b223",
      "underlying": "NFLX",
      "kind": "PositionChange",
      "positionChange": 96780,
      "momentDate": "2026-11-02"
    },
    {
      "debtId": "328c07df-dd4c-413b-ab12-2f224c27288b",
      "tradeId": "47284d37-b9cb-4fb8-a015-74f31ee7fab4",
      "underlying": "ABBV",
      "kind": "PositionChange",
      "positionChange": 96781,
      "momentDate": "2026-11-02"
    },
    {
      "debtId": "f4009444-75f3-48a5-ab13-9d0e8c4b8e8a",
      "tradeId": "ec8932ea-dc60-4512-8d31-7a040d968750",
      "underlying": "CRM",
      "kind": "PositionChange",
      "positionChange": 96782,
      "momentDate": "2026-11-02"
    },
    {
      "debtId": "6df91783-c088-4deb-b2c2-d3cfe41a57dc",
      "tradeId": "38ec869c-9407-42cf-9ac8-8586db95ea34",
      "underlying": "V",
      "kind": "PositionChange",
      "positionChange": 96783,
      "momentDate": "2026-11-02"
    },
    {
      "debtId": "6f4dcfe4-b238-4863-aac7-efa435d6fd9a",
      "tradeId": "5fb6cbb1-b7a8-4377-814b-ed1bbd98e425",
      "underlying": "TXN",
      "kind": "PositionChange",
      "positionChange": 96784,
      "momentDate": "2026-11-02"
    },
    {
      "debtId": "85c30159-156b-4595-8861-059759136ba2",
      "tradeId": "729a6894-3379-45d6-9429-f38e01e0b124",
      "underlying": "MA",
      "kind": "PositionChange",
      "positionChange": 96785,
      "momentDate": "2026-11-02"
    },
    {
      "debtId": "7356cf36-3b9d-472a-bfdb-bcca42df741b",
      "tradeId": "ac3947e4-2168-4b4c-8502-b94398008a95",
      "underlying": "BA",
      "kind": "PositionChange",
      "positionChange": 96786,
      "momentDate": "2026-11-02"
    },
    {
      "debtId": "08fc2661-72e0-4c02-a18d-2d45907ef84f",
      "tradeId": "c2df0da1-935b-4a7e-8955-49392fa1bf7f",
      "underlying": "GS",
      "kind": "PositionChange",
      "positionChange": 96787,
      "momentDate": "2026-11-02"
    },
    {
      "debtId": "6d1dd870-5661-4364-b59a-d40c626bbf30",
      "tradeId": "1fc12e3c-3b42-4f61-a27a-b8fe3b03680f",
      "underlying": "QAA",
      "kind": "PositionChange",
      "positionChange": 96788,
      "momentDate": "2026-11-02"
    },
    {
      "debtId": "5925744f-5527-4177-8f24-4205c97412c3",
      "tradeId": "f025294b-465d-4599-a0bd-5bd59c5202f8",
      "underlying": "QAB",
      "kind": "PositionChange",
      "positionChange": 96789,
      "momentDate": "2026-11-02"
    },
    {
      "debtId": "8f1c0a85-7907-4f73-9a03-7ccf8a90117b",
      "tradeId": "41dd65a7-bb09-430f-990f-29e2742318bc",
      "underlying": "XOM",
      "kind": "PositionChange",
      "positionChange": 96790,
      "momentDate": "2026-11-02"
    },
    {
      "debtId": "9a76e73e-bb49-42c5-9823-20e4fe74b634",
      "tradeId": "272c7b05-50e1-4038-b524-633ac342fbbf",
      "underlying": "CVX",
      "kind": "PositionChange",
      "positionChange": 96791,
      "momentDate": "2026-11-02"
    },
    {
      "debtId": "adb706a1-83db-4040-86ff-6b1210c78be4",
      "tradeId": "53ec7cbd-0213-43ec-bae4-bf5358ff836b",
      "underlying": "QAC",
      "kind": "PositionChange",
      "positionChange": 96792,
      "momentDate": "2026-11-02"
    },
    {
      "debtId": "9e603db7-eefc-4747-a7de-e53f702885e7",
      "tradeId": "cdb4d319-543f-453c-b32b-8a030f7bcb1e",
      "underlying": "QAE",
      "kind": "PositionChange",
      "positionChange": 96793,
      "momentDate": "2026-11-02"
    },
    {
      "debtId": "50bd0c4f-ffa7-4de9-9e6e-be85e3dbe251",
      "tradeId": "343fe133-6416-4d7d-a0bb-de9b94a48eb0",
      "underlying": "QAF",
      "kind": "PositionChange",
      "positionChange": 96794,
      "momentDate": "2026-11-02"
    },
    {
      "debtId": "d75d2afe-248a-4ec0-996d-657a7604adc7",
      "tradeId": "d9b78400-df14-48a8-8473-10141e1886bb",
      "underlying": "QAG",
      "kind": "PositionChange",
      "positionChange": 96795,
      "momentDate": "2026-11-02"
    },
    {
      "debtId": "f18e65c1-0e2f-4024-bf72-ce9a3898b1a3",
      "tradeId": "ec7f401b-32df-447a-8efa-c50e3954dce1",
      "underlying": "QAI",
      "kind": "PositionChange",
      "positionChange": 96796,
      "momentDate": "2026-11-02"
    },
    {
      "debtId": "866392d5-2a3b-441f-8bce-17c83c4c507a",
      "tradeId": "09bd2b20-2ad7-47a4-8faf-6b210d76a617",
      "underlying": "LLY",
      "kind": "PositionChange",
      "positionChange": 96797,
      "momentDate": "2026-11-02"
    },
    {
      "debtId": "a2f4be49-f290-4690-9d48-296e1f22d7d5",
      "tradeId": "8eeb91a5-d68e-48d4-bc48-eda78f3659b6",
      "underlying": "ABBV",
      "kind": "PositionChange",
      "positionChange": 96798,
      "momentDate": "2026-11-02"
    },
    {
      "debtId": "3d8f6fa7-8911-4458-870d-f0fac844b292",
      "tradeId": "06842f4b-cf97-44e2-bf36-c3a93d46680d",
      "underlying": "QAJ",
      "kind": "PositionChange",
      "positionChange": 96799,
      "momentDate": "2026-11-02"
    },
    {
      "debtId": "54f18469-3fc9-4c98-9617-b3c6b7140c17",
      "tradeId": "2f571148-7449-4d9a-b1f7-4050d498a08f",
      "underlying": "QAK",
      "kind": "PositionChange",
      "positionChange": 96800,
      "momentDate": "2026-11-02"
    },
    {
      "debtId": "bfa2314b-c02f-478a-8b86-8fa2acc464e5",
      "tradeId": "ff339659-66b4-409f-be1d-a25880ad008e",
      "underlying": "QAL",
      "kind": "PositionChange",
      "positionChange": 96801,
      "momentDate": "2026-11-02"
    },
    {
      "debtId": "c18157a5-5f3b-4415-8a79-862d37249707",
      "tradeId": "be31c7a1-f145-4b49-9b03-ab8e65c07896",
      "underlying": "QAN",
      "kind": "PositionChange",
      "positionChange": 96802,
      "momentDate": "2026-11-02"
    },
    {
      "debtId": "a2cff6a9-4deb-43c2-9488-803d6dcc93a5",
      "tradeId": "cc0853c9-fb37-4c48-8ca3-3586fe8d0058",
      "underlying": "QAO",
      "kind": "PositionChange",
      "positionChange": 96803,
      "momentDate": "2026-11-02"
    },
    {
      "debtId": "f94ef590-02b6-46aa-8d25-2a32064b5ccd",
      "tradeId": "3826256c-dc67-4cda-b459-dff3fb3d23e6",
      "underlying": "QAP",
      "kind": "PositionChange",
      "positionChange": 96804,
      "momentDate": "2026-11-02"
    },
    {
      "debtId": "a0b62251-25fe-4425-b63b-66ae7440db9e",
      "tradeId": "bdd600dc-59ed-4047-86bd-750407cd3818",
      "underlying": "ADBE",
      "kind": "PositionChange",
      "positionChange": 96805,
      "momentDate": "2026-11-02"
    },
    {
      "debtId": "9ee024a7-46a2-4ef6-a53c-43b775dbf59f",
      "tradeId": "4cf35023-0c84-43ac-963d-855f23c3a13c",
      "underlying": "CRM",
      "kind": "PositionChange",
      "positionChange": 96806,
      "momentDate": "2026-11-02"
    },
    {
      "debtId": "8cb6fe0b-b57a-4439-8c89-c9225422b896",
      "tradeId": "44461a6a-5ba2-4310-8590-141564a9f80b",
      "underlying": "QAQ",
      "kind": "PositionChange",
      "positionChange": 96807,
      "momentDate": "2026-11-02"
    },
    {
      "debtId": "4c61e3dc-6f70-42de-8974-700c6ab32ba3",
      "tradeId": "f10748d0-6aad-4674-b94d-4dba88fc537e",
      "underlying": "QAS",
      "kind": "PositionChange",
      "positionChange": 96808,
      "momentDate": "2026-11-02"
    },
    {
      "debtId": "c1fe6526-f62e-44d2-8b54-55d257b8ccc8",
      "tradeId": "15a49725-0bb5-4b03-b97a-56ed6c1698f0",
      "underlying": "QAT",
      "kind": "PositionChange",
      "positionChange": 96809,
      "momentDate": "2026-11-02"
    },
    {
      "debtId": "6035f8d1-4180-4582-af5a-69526de85e3f",
      "tradeId": "0d320052-9b01-420a-8c52-5bec4ef12267",
      "underlying": "QAU",
      "kind": "PositionChange",
      "positionChange": 96810,
      "momentDate": "2026-11-02"
    },
    {
      "debtId": "9163beb7-4b78-48b0-a9e9-74edd7cb95ab",
      "tradeId": "69cf21ae-bf73-4a4e-9aac-dcf115e1e12a",
      "underlying": "QAW",
      "kind": "PositionChange",
      "positionChange": 96811,
      "momentDate": "2026-11-02"
    },
    {
      "debtId": "1dec2864-0828-46d4-ac91-bafd5bae9902",
      "tradeId": "3e613f64-f15b-48ec-a81d-a655ef7cef30",
      "underlying": "ORCL",
      "kind": "PositionChange",
      "positionChange": 96812,
      "momentDate": "2026-11-02"
    },
    {
      "debtId": "e592c831-ea24-4420-bc35-3cac445e7a7a",
      "tradeId": "d995113a-2b52-460d-9a6f-5a754afaf744",
      "underlying": "AMD",
      "kind": "PositionChange",
      "positionChange": 96813,
      "momentDate": "2026-11-02"
    },
    {
      "debtId": "5cbd48b0-e8d7-453d-ae64-601bc1476cbf",
      "tradeId": "955977e0-3e88-43ad-8682-7302dc3c51c1",
      "underlying": "INTC",
      "kind": "PositionChange",
      "positionChange": 96814,
      "momentDate": "2026-11-02"
    },
    {
      "debtId": "4f208989-4747-46ac-ae77-1420e425dab3",
      "tradeId": "dcef7523-48b2-4629-b47d-12b83e8d582e",
      "underlying": "QAX",
      "kind": "PositionChange",
      "positionChange": 96815,
      "momentDate": "2026-11-02"
    },
    {
      "debtId": "a64ea965-7ec7-451b-b1dd-84bdf985d334",
      "tradeId": "56ab7eaa-b228-467b-80cb-88a2ce3aaf6f",
      "underlying": "QAY",
      "kind": "PositionChange",
      "positionChange": 96816,
      "momentDate": "2026-11-02"
    },
    {
      "debtId": "7805ad74-185a-4b14-beb6-378e451210a6",
      "tradeId": "2d3eab5d-0fbf-4510-af9d-ba7ae3afd5cd",
      "underlying": "QAZ",
      "kind": "PositionChange",
      "positionChange": 96817,
      "momentDate": "2026-11-02"
    },
    {
      "debtId": "48391b32-1dc3-488d-bce0-f6ab13839037",
      "tradeId": "66fc8310-a9a7-400c-b81f-81d75903eada",
      "underlying": "QBA",
      "kind": "PositionChange",
      "positionChange": 96818,
      "momentDate": "2026-11-02"
    },
    {
      "debtId": "f8b51879-3e22-439f-ac22-d4a20b686228",
      "tradeId": "206c4b5e-efe0-4b10-9706-a4bfd0a221ad",
      "underlying": "QBB",
      "kind": "PositionChange",
      "positionChange": 96819,
      "momentDate": "2026-11-02"
    },
    {
      "debtId": "e0245ae6-df93-4ed1-b88d-2950cd1ed3c0",
      "tradeId": "e852fddf-debf-48c1-9d57-a10e0d17286a",
      "underlying": "QBC",
      "kind": "PositionChange",
      "positionChange": 96820,
      "momentDate": "2026-11-02"
    },
    {
      "debtId": "d402af7d-90ef-4f25-a590-94370a71320d",
      "tradeId": "ef12b7d5-67ad-4269-a7b2-e1263ffdd0a1",
      "underlying": "QBD",
      "kind": "PositionChange",
      "positionChange": 96821,
      "momentDate": "2026-11-02"
    },
    {
      "debtId": "8de144a2-dca1-45b5-94a5-afa68ec852ff",
      "tradeId": "a8562831-ce48-4eec-8a25-0998c58e29c8",
      "underlying": "QCOM",
      "kind": "PositionChange",
      "positionChange": 96822,
      "momentDate": "2026-11-02"
    },
    {
      "debtId": "4a5aabb6-70f3-42d2-9954-921587535aa7",
      "tradeId": "6f4f320d-a015-496c-9289-89352c147ac5",
      "underlying": "TXN",
      "kind": "PositionChange",
      "positionChange": 96823,
      "momentDate": "2026-11-02"
    },
    {
      "debtId": "551061fc-e9b6-4288-9807-6c6e3f2069c2",
      "tradeId": "1ac4cd82-2a61-45c1-be16-050607e537b9",
      "underlying": "WMT",
      "kind": "PositionChange",
      "positionChange": 96824,
      "momentDate": "2026-11-02"
    },
    {
      "debtId": "f38972f7-88d5-44fb-9857-f244dc0c22ae",
      "tradeId": "26ae765c-a357-487b-86ee-25635c1ca919",
      "underlying": "QBE",
      "kind": "PositionChange",
      "positionChange": 96825,
      "momentDate": "2026-11-02"
    },
    {
      "debtId": "e9b2d314-2972-4e2c-ad5d-ba9a18db694f",
      "tradeId": "fb2023c2-4ad2-4532-862a-bd9424e58955",
      "underlying": "QBF",
      "kind": "PositionChange",
      "positionChange": 96826,
      "momentDate": "2026-11-02"
    },
    {
      "debtId": "f96b31d2-9ea8-4aac-bbf1-9d3d12a92e8a",
      "tradeId": "9d821665-5e09-4269-8aa2-b74b73c03c96",
      "underlying": "QBG",
      "kind": "PositionChange",
      "positionChange": 96827,
      "momentDate": "2026-11-02"
    },
    {
      "debtId": "873f8576-75a3-4132-a6fb-f0cf85008764",
      "tradeId": "bb4cafef-2054-42f4-b798-3e470a5f9be8",
      "underlying": "QBH",
      "kind": "PositionChange",
      "positionChange": 96828,
      "momentDate": "2026-11-02"
    },
    {
      "debtId": "1969eb1d-4380-455a-b38c-cfa5cec4a402",
      "tradeId": "631a20e9-087c-4b1c-83b7-77841d86d41f",
      "underlying": "QBI",
      "kind": "PositionChange",
      "positionChange": 96829,
      "momentDate": "2026-11-02"
    },
    {
      "debtId": "8900624f-2c0a-4043-ad79-5977c93f290c",
      "tradeId": "f0f90c1f-3010-474a-9c86-3d7d3c338603",
      "underlying": "QBJ",
      "kind": "PositionChange",
      "positionChange": 96830,
      "momentDate": "2026-11-02"
    },
    {
      "debtId": "ac1257e6-d645-4730-a7d8-0d3cb200e09a",
      "tradeId": "cf7641d9-dada-43c4-9f17-c3ba97ce2353",
      "underlying": "QBK",
      "kind": "PositionChange",
      "positionChange": 96831,
      "momentDate": "2026-11-02"
    },
    {
      "debtId": "7b40f642-430b-4612-be5e-0fa9b32c1dfe",
      "tradeId": "1bcf132f-114d-4563-890f-d31161cb7db9",
      "underlying": "DIS",
      "kind": "PositionChange",
      "positionChange": 96832,
      "momentDate": "2026-11-02"
    },
    {
      "debtId": "6a8d0be1-b949-4a80-8487-7a7bd51f70cf",
      "tradeId": "c0926bbf-033f-4d74-b6e9-878540280a07",
      "underlying": "NKE",
      "kind": "PositionChange",
      "positionChange": 96833,
      "momentDate": "2026-11-02"
    },
    {
      "debtId": "a638a25a-3170-498a-b018-d50176aa6860",
      "tradeId": "b21c2192-9e47-4706-bf4e-6b5ea6232fa3",
      "underlying": "MCD",
      "kind": "PositionChange",
      "positionChange": 96834,
      "momentDate": "2026-11-02"
    },
    {
      "debtId": "a9ff6600-03d2-4205-a674-7f4bc58c62b7",
      "tradeId": "2c9a4413-ce85-4cf7-83a5-19289ad2ddb0",
      "underlying": "QBL",
      "kind": "PositionChange",
      "positionChange": 96835,
      "momentDate": "2026-11-02"
    },
    {
      "debtId": "547083f3-8e4f-44a8-8414-2efbd01d2758",
      "tradeId": "b0292d77-444a-44d4-b7dd-1387e38da9af",
      "underlying": "QBM",
      "kind": "PositionChange",
      "positionChange": 96836,
      "momentDate": "2026-11-02"
    },
    {
      "debtId": "553ef4bc-65a6-4b18-a66b-e429b1432be9",
      "tradeId": "25c9dc91-9360-420a-a6b6-e9432fa9c424",
      "underlying": "QBN",
      "kind": "PositionChange",
      "positionChange": 96837,
      "momentDate": "2026-11-02"
    },
    {
      "debtId": "7002cb28-3054-4db4-9ca8-acd8c0288a79",
      "tradeId": "245385b5-1f32-457e-b7e2-c24b98addfb0",
      "underlying": "QBO",
      "kind": "PositionChange",
      "positionChange": 96838,
      "momentDate": "2026-11-02"
    },
    {
      "debtId": "85f7268a-e2c5-4a81-978d-b7e93a1369ca",
      "tradeId": "7bda8682-bd17-47b1-892b-dac3f56ed66a",
      "underlying": "QBP",
      "kind": "PositionChange",
      "positionChange": 96839,
      "momentDate": "2026-11-02"
    },
    {
      "debtId": "83471fb1-49b9-40b3-9f10-b98bdff496e2",
      "tradeId": "f8d267b4-da0e-48a2-afbd-9eb947c56fb4",
      "underlying": "QBQ",
      "kind": "PositionChange",
      "positionChange": 96840,
      "momentDate": "2026-11-02"
    },
    {
      "debtId": "da1af065-b979-4590-abbe-a4648f9fd1d4",
      "tradeId": "1e4ca3cf-3ea3-4d3d-8796-3f698e9f9840",
      "underlying": "QBR",
      "kind": "PositionChange",
      "positionChange": 96841,
      "momentDate": "2026-11-02"
    },
    {
      "debtId": "2f3be532-f2d9-41ad-b205-ac70bc2df070",
      "tradeId": "d30ef2ee-e95e-4904-8967-91886a1935bf",
      "underlying": "BA",
      "kind": "PositionChange",
      "positionChange": 96842,
      "momentDate": "2026-11-02"
    },
    {
      "debtId": "24679134-ba03-4be1-be87-a1e42d60d908",
      "tradeId": "48630489-e277-441c-b39d-dd4a36bf2bbc",
      "underlying": "CAT",
      "kind": "PositionChange",
      "positionChange": 96843,
      "momentDate": "2026-11-02"
    },
    {
      "debtId": "f91674b2-c29a-4966-85b0-1411af24b904",
      "tradeId": "f41edac6-d82b-4d09-8aa0-7f3a7bfcddd1",
      "underlying": "DE",
      "kind": "PositionChange",
      "positionChange": 96844,
      "momentDate": "2026-11-02"
    },
    {
      "debtId": "318474bf-f75b-40c8-8154-d0612c0a3942",
      "tradeId": "944fc62c-4990-4b5a-a528-4285aea0b0b5",
      "underlying": "QBS",
      "kind": "PositionChange",
      "positionChange": 96845,
      "momentDate": "2026-11-02"
    },
    {
      "debtId": "e8fa422e-2bf3-4de8-805c-29cbba743f4e",
      "tradeId": "88191ae8-8db6-4d34-8c0a-62fa15d789d3",
      "underlying": "QBT",
      "kind": "PositionChange",
      "positionChange": 96846,
      "momentDate": "2026-11-02"
    },
    {
      "debtId": "d151c4c0-cdc7-49ee-bd24-b4c56f2a1ae9",
      "tradeId": "4ca7dc92-71bd-4b05-a2c3-7eb272a18b96",
      "underlying": "QBU",
      "kind": "PositionChange",
      "positionChange": 96847,
      "momentDate": "2026-11-02"
    },
    {
      "debtId": "7395dfb5-5011-4d42-8fe8-5c016464594a",
      "tradeId": "67bf2bc0-ebc4-45d6-8f69-9b5301cad9b9",
      "underlying": "NKE",
      "kind": "PositionChange",
      "positionChange": 96848,
      "momentDate": "2026-11-02"
    },
    {
      "debtId": "ecb72db8-84f8-47e1-bd8c-c67c711b2ab5",
      "tradeId": "67bf2bc0-ebc4-45d6-8f69-9b5301cad9b9",
      "underlying": "NKE",
      "kind": "CloseReview",
      "positionChange": 24641,
      "momentDate": "2026-11-02"
    },
    {
      "debtId": "87780e22-f88e-4f9a-9c19-2991027760eb",
      "tradeId": "d1fad3c8-56f7-42bd-acc9-68400de86f5b",
      "underlying": "CAT",
      "kind": "PositionChange",
      "positionChange": 96849,
      "momentDate": "2026-11-02"
    },
    {
      "debtId": "4883f9f4-4f71-49dc-a21e-96fa4eef96c8",
      "tradeId": "d1fad3c8-56f7-42bd-acc9-68400de86f5b",
      "underlying": "CAT",
      "kind": "CloseReview",
      "positionChange": 24642,
      "momentDate": "2026-11-02"
    },
    {
      "debtId": "e38b7bc6-fb0a-4c4b-b0d5-2050c93adbba",
      "tradeId": "1331b594-c8ad-48a0-93d3-7912a8524ce2",
      "underlying": "TSLA",
      "kind": "PositionChange",
      "positionChange": 96850,
      "momentDate": "2026-11-02"
    },
    {
      "debtId": "c1689360-347f-4ebe-8260-6ea276042539",
      "tradeId": "1331b594-c8ad-48a0-93d3-7912a8524ce2",
      "underlying": "TSLA",
      "kind": "CloseReview",
      "positionChange": 24643,
      "momentDate": "2026-11-02"
    },
    {
      "debtId": "b820ddaf-ca8f-43ad-a43e-ab6018f064f1",
      "tradeId": "4f1801e7-9779-4093-ba19-e64b5e31319f",
      "underlying": "NFLX",
      "kind": "PositionChange",
      "positionChange": 96851,
      "momentDate": "2026-11-02"
    },
    {
      "debtId": "bead6931-da0e-423c-9a41-7e042a9597cf",
      "tradeId": "4f1801e7-9779-4093-ba19-e64b5e31319f",
      "underlying": "NFLX",
      "kind": "CloseReview",
      "positionChange": 24644,
      "momentDate": "2026-11-02"
    },
    {
      "debtId": "65dba94a-18fa-45fa-bfbd-384dc632109b",
      "tradeId": "704b0af5-6c4d-4ae4-9966-6d2a32373fc8",
      "underlying": "PG",
      "kind": "PositionChange",
      "positionChange": 96852,
      "momentDate": "2026-11-02"
    },
    {
      "debtId": "be97c784-f9ee-4b79-a5d5-55b27fbf4704",
      "tradeId": "704b0af5-6c4d-4ae4-9966-6d2a32373fc8",
      "underlying": "PG",
      "kind": "CloseReview",
      "positionChange": 24645,
      "momentDate": "2026-11-02"
    },
    {
      "debtId": "57731a78-8e25-4064-8378-44018b99e502",
      "tradeId": "e25e9779-fc7c-4fdc-89b0-f95bacf365b1",
      "underlying": "CRM",
      "kind": "PositionChange",
      "positionChange": 96853,
      "momentDate": "2026-11-02"
    },
    {
      "debtId": "71232d10-c25d-4b7f-88a0-e2f3eab9493e",
      "tradeId": "e25e9779-fc7c-4fdc-89b0-f95bacf365b1",
      "underlying": "CRM",
      "kind": "CloseReview",
      "positionChange": 24646,
      "momentDate": "2026-11-02"
    },
    {
      "debtId": "9b9969cd-a3b6-41c3-a51b-ec57a9b0ebe6",
      "tradeId": "13fbca0c-89b7-4b42-b600-12788ab763a8",
      "underlying": "INTC",
      "kind": "PositionChange",
      "positionChange": 96854,
      "momentDate": "2026-11-02"
    },
    {
      "debtId": "792ffbc3-6eb3-4a38-b251-57827db6896a",
      "tradeId": "13fbca0c-89b7-4b42-b600-12788ab763a8",
      "underlying": "INTC",
      "kind": "CloseReview",
      "positionChange": 24647,
      "momentDate": "2026-11-02"
    },
    {
      "debtId": "5c5db9f2-954b-4953-ae06-9fd96c0d9de7",
      "tradeId": "55ee422b-6a9c-4daa-9aa4-552b734d7cd1",
      "underlying": "QCOM",
      "kind": "PositionChange",
      "positionChange": 96855,
      "momentDate": "2026-11-02"
    },
    {
      "debtId": "fd48690e-0f51-4692-af4f-3ee0c5ab0f21",
      "tradeId": "29979fa7-b43e-409d-9545-ec1c31c5d30b",
      "underlying": "DIS",
      "kind": "PositionChange",
      "positionChange": 96856,
      "momentDate": "2026-11-02"
    },
    {
      "debtId": "d1763a92-e389-4675-8958-5cec810096e8",
      "tradeId": "94a27baa-d934-4366-bb57-823a452bfa31",
      "underlying": "DE",
      "kind": "PositionChange",
      "positionChange": 96857,
      "momentDate": "2026-11-02"
    },
    {
      "debtId": "dd329ce7-acdc-4eb3-96c8-a9965eab466c",
      "tradeId": "94a27baa-d934-4366-bb57-823a452bfa31",
      "underlying": "DE",
      "kind": "CloseReview",
      "positionChange": 24648,
      "momentDate": "2026-11-02"
    },
    {
      "debtId": "de64cde2-8f13-45c2-af36-0e04b9bf4636",
      "tradeId": "4ac546dc-b749-4ed2-bd1a-96430b793af3",
      "underlying": "NVDA",
      "kind": "PositionChange",
      "positionChange": 96858,
      "momentDate": "2026-11-03"
    },
    {
      "debtId": "9df6b44c-3127-42ff-ac51-52ea1f8b8554",
      "tradeId": "4ac546dc-b749-4ed2-bd1a-96430b793af3",
      "underlying": "NVDA",
      "kind": "CloseReview",
      "positionChange": 24649,
      "momentDate": "2026-11-03"
    },
    {
      "debtId": "3000e0d7-5036-4cc1-b995-ba8eebcd1dab",
      "tradeId": "e55bb4d6-43c3-413f-8734-41951aad3f00",
      "underlying": "META",
      "kind": "PositionChange",
      "positionChange": 96859,
      "momentDate": "2026-11-03"
    },
    {
      "debtId": "8fa97db3-dda6-4ff6-9a57-7bcde9ab821a",
      "tradeId": "e55bb4d6-43c3-413f-8734-41951aad3f00",
      "underlying": "META",
      "kind": "CloseReview",
      "positionChange": 24650,
      "momentDate": "2026-11-03"
    },
    {
      "debtId": "76b89d3b-f39c-4c01-b524-faeeb5bdda7e",
      "tradeId": "3a97f5f9-8a52-4efd-83a7-3291f6633698",
      "underlying": "V",
      "kind": "PositionChange",
      "positionChange": 96860,
      "momentDate": "2026-11-03"
    },
    {
      "debtId": "e21f69e9-a582-4d48-87a4-000f921546da",
      "tradeId": "3a97f5f9-8a52-4efd-83a7-3291f6633698",
      "underlying": "V",
      "kind": "CloseReview",
      "positionChange": 24651,
      "momentDate": "2026-11-03"
    },
    {
      "debtId": "923bcf09-42e1-4d49-98c5-b8c161feeaff",
      "tradeId": "3d553e13-d7b0-48c2-84bc-38c1651acbda",
      "underlying": "HD",
      "kind": "PositionChange",
      "positionChange": 96861,
      "momentDate": "2026-11-03"
    },
    {
      "debtId": "1623353d-d5f3-496b-a50c-32d673698f0d",
      "tradeId": "e5a15d3e-79fc-44ef-a5a0-5071beb3f720",
      "underlying": "ABBV",
      "kind": "PositionChange",
      "positionChange": 96862,
      "momentDate": "2026-11-03"
    },
    {
      "debtId": "b680c362-b720-4afd-9e16-df237ae21a39",
      "tradeId": "e5a15d3e-79fc-44ef-a5a0-5071beb3f720",
      "underlying": "ABBV",
      "kind": "CloseReview",
      "positionChange": 24652,
      "momentDate": "2026-11-03"
    },
    {
      "debtId": "7f58aa5a-2e43-46d3-a792-cffa23f982f0",
      "tradeId": "c6b3c1fa-2057-4061-8e44-b3fa4344b8eb",
      "underlying": "ADBE",
      "kind": "PositionChange",
      "positionChange": 96863,
      "momentDate": "2026-11-03"
    },
    {
      "debtId": "ebb99c6e-ff8c-4da7-a826-c7f4ad33e0cc",
      "tradeId": "c6b3c1fa-2057-4061-8e44-b3fa4344b8eb",
      "underlying": "ADBE",
      "kind": "CloseReview",
      "positionChange": 24653,
      "momentDate": "2026-11-03"
    },
    {
      "debtId": "f13a7482-f66a-48d3-a526-cefadfe74adc",
      "tradeId": "f7b7280e-f43e-428a-8cd8-9aceb37292e0",
      "underlying": "CRM",
      "kind": "PositionChange",
      "positionChange": 96864,
      "momentDate": "2026-11-03"
    },
    {
      "debtId": "8e58e987-a307-4b11-88d0-ed123d98dcc3",
      "tradeId": "19b241fe-ea9e-4f3b-b50e-f1a840b1eafe",
      "underlying": "INTC",
      "kind": "PositionChange",
      "positionChange": 96865,
      "momentDate": "2026-11-03"
    },
    {
      "debtId": "70b56e30-1b23-43ed-a373-f4be98df6db3",
      "tradeId": "8932c2a4-95f7-446b-b71d-8d1c1fe2a048",
      "underlying": "NKE",
      "kind": "PositionChange",
      "positionChange": 96866,
      "momentDate": "2026-11-03"
    },
    {
      "debtId": "b7fdf64a-9e6b-4e67-be19-582adf9dabfd",
      "tradeId": "8932c2a4-95f7-446b-b71d-8d1c1fe2a048",
      "underlying": "NKE",
      "kind": "CloseReview",
      "positionChange": 24654,
      "momentDate": "2026-11-03"
    },
    {
      "debtId": "f0cb203f-22d1-473f-90a2-b23d6aaf8744",
      "tradeId": "aced863f-f5bd-4ded-9b26-d2252161de38",
      "underlying": "CAT",
      "kind": "PositionChange",
      "positionChange": 96867,
      "momentDate": "2026-11-03"
    },
    {
      "debtId": "27a39215-5a8b-4e2a-8206-f14b170c6c9e",
      "tradeId": "aced863f-f5bd-4ded-9b26-d2252161de38",
      "underlying": "CAT",
      "kind": "CloseReview",
      "positionChange": 24655,
      "momentDate": "2026-11-03"
    },
    {
      "debtId": "d77920df-75c0-42df-8853-f9f0732fe738",
      "tradeId": "763c48df-45e9-4f16-8214-34ee70201a17",
      "underlying": "DE",
      "kind": "PositionChange",
      "positionChange": 96868,
      "momentDate": "2026-11-03"
    },
    {
      "debtId": "d0ae32fc-e4eb-44e4-97e4-929c644f8c5d",
      "tradeId": "80cd837b-6ad1-43f3-9886-7bf600304b92",
      "underlying": "MSFT",
      "kind": "PositionChange",
      "positionChange": 96869,
      "momentDate": "2026-11-03"
    },
    {
      "debtId": "c36cd218-77ed-432a-b4fe-2cf6c5b8aefd",
      "tradeId": "fce5464a-f737-420d-a757-548e53926f51",
      "underlying": "TSLA",
      "kind": "PositionChange",
      "positionChange": 96870,
      "momentDate": "2026-11-03"
    },
    {
      "debtId": "d10a87bc-4ff9-45de-a9b1-55b65fb352e9",
      "tradeId": "fce5464a-f737-420d-a757-548e53926f51",
      "underlying": "TSLA",
      "kind": "CloseReview",
      "positionChange": 24656,
      "momentDate": "2026-11-03"
    },
    {
      "debtId": "d04957e2-019f-430f-9813-5de687bc279d",
      "tradeId": "81b2ccd7-06e3-49b2-b9f8-fe326cae5ddf",
      "underlying": "NFLX",
      "kind": "PositionChange",
      "positionChange": 96871,
      "momentDate": "2026-11-03"
    },
    {
      "debtId": "35eb6d6e-9351-4300-876d-87a7cc1abfdc",
      "tradeId": "81b2ccd7-06e3-49b2-b9f8-fe326cae5ddf",
      "underlying": "NFLX",
      "kind": "CloseReview",
      "positionChange": 24657,
      "momentDate": "2026-11-03"
    },
    {
      "debtId": "505ba064-5222-4d19-b722-fcbab3343572",
      "tradeId": "96e97d77-4343-4bd0-888e-7b18201fd256",
      "underlying": "JPM",
      "kind": "PositionChange",
      "positionChange": 96872,
      "momentDate": "2026-11-03"
    },
    {
      "debtId": "645fcdfb-f502-46c6-a895-a41e44c0905e",
      "tradeId": "851659fd-a93d-4693-b17a-d2a87b8aa201",
      "underlying": "V",
      "kind": "PositionChange",
      "positionChange": 96873,
      "momentDate": "2026-11-03"
    },
    {
      "debtId": "dbf5ad35-10de-470c-a587-2505a5aedd65",
      "tradeId": "851659fd-a93d-4693-b17a-d2a87b8aa201",
      "underlying": "V",
      "kind": "CloseReview",
      "positionChange": 24658,
      "momentDate": "2026-11-03"
    },
    {
      "debtId": "ebfe35ba-4ce6-42d0-8e9c-40dfb3f2444f",
      "tradeId": "49822015-c2cf-4d1c-81fc-2593b280709a",
      "underlying": "UNH",
      "kind": "PositionChange",
      "positionChange": 96874,
      "momentDate": "2026-11-03"
    },
    {
      "debtId": "05b412ce-eee0-4efa-a921-5075be585c65",
      "tradeId": "49822015-c2cf-4d1c-81fc-2593b280709a",
      "underlying": "UNH",
      "kind": "CloseReview",
      "positionChange": 24659,
      "momentDate": "2026-11-03"
    },
    {
      "debtId": "f6ad68b7-80c3-49a0-809f-f8c4f7bdc6f9",
      "tradeId": "047bd03e-ccdd-4b6d-8ec1-98b9d66b2656",
      "underlying": "HD",
      "kind": "PositionChange",
      "positionChange": 96875,
      "momentDate": "2026-11-03"
    },
    {
      "debtId": "7fa27603-d80c-4c98-a7ec-b7afdec96fa4",
      "tradeId": "047bd03e-ccdd-4b6d-8ec1-98b9d66b2656",
      "underlying": "HD",
      "kind": "CloseReview",
      "positionChange": 24660,
      "momentDate": "2026-11-03"
    },
    {
      "debtId": "c015ed1f-3cf7-459f-b9d9-5db2d0d89bcf",
      "tradeId": "94378866-223a-4d01-982c-b9408b21842f",
      "underlying": "PG",
      "kind": "PositionChange",
      "positionChange": 96876,
      "momentDate": "2026-11-03"
    },
    {
      "debtId": "b9d11811-743f-42c0-afe2-7a930cbb82b5",
      "tradeId": "0dc4980b-3089-4a65-bb05-228eb71700ee",
      "underlying": "XOM",
      "kind": "PositionChange",
      "positionChange": 96877,
      "momentDate": "2026-11-03"
    },
    {
      "debtId": "c334ee32-4dbe-430e-85a5-c4ab98ac9cf0",
      "tradeId": "0dc4980b-3089-4a65-bb05-228eb71700ee",
      "underlying": "XOM",
      "kind": "CloseReview",
      "positionChange": 24661,
      "momentDate": "2026-11-03"
    },
    {
      "debtId": "9ccdc360-2eec-4237-9479-1a4570024527",
      "tradeId": "72b1fb06-817a-4d41-a5d2-55afe8080131",
      "underlying": "LLY",
      "kind": "PositionChange",
      "positionChange": 96878,
      "momentDate": "2026-11-03"
    },
    {
      "debtId": "1e5312ed-b5d7-44a5-85ed-150abc59c732",
      "tradeId": "be25b24a-d623-4f1a-81b8-4bcbe1974f92",
      "underlying": "ADBE",
      "kind": "PositionChange",
      "positionChange": 96879,
      "momentDate": "2026-11-03"
    },
    {
      "debtId": "a6fcd592-860d-4ec7-99f9-0feeab760182",
      "tradeId": "27e45da4-8f0c-4a3d-bbbe-8d07d14b0930",
      "underlying": "CRM",
      "kind": "PositionChange",
      "positionChange": 96880,
      "momentDate": "2026-11-03"
    },
    {
      "debtId": "c49c75f0-dbfc-4463-bf8c-3820dfc98c43",
      "tradeId": "27e45da4-8f0c-4a3d-bbbe-8d07d14b0930",
      "underlying": "CRM",
      "kind": "CloseReview",
      "positionChange": 24662,
      "momentDate": "2026-11-03"
    },
    {
      "debtId": "594cae92-5bf2-41a9-bc0f-6e49f9c2f22d",
      "tradeId": "09388b4b-f67b-4bfb-88d1-6b15ad2f9dd5",
      "underlying": "AMD",
      "kind": "PositionChange",
      "positionChange": 96881,
      "momentDate": "2026-11-03"
    },
    {
      "debtId": "8cd038d4-df93-4130-83f1-61539af7afce",
      "tradeId": "09388b4b-f67b-4bfb-88d1-6b15ad2f9dd5",
      "underlying": "AMD",
      "kind": "CloseReview",
      "positionChange": 24663,
      "momentDate": "2026-11-03"
    },
    {
      "debtId": "4cb65cb1-0dd8-4bdd-a29e-53941551bfb5",
      "tradeId": "27586019-a421-44cf-b43d-2d988bc0c924",
      "underlying": "INTC",
      "kind": "PositionChange",
      "positionChange": 96882,
      "momentDate": "2026-11-03"
    },
    {
      "debtId": "a97c3243-4830-435f-b3cd-41f21878ba3d",
      "tradeId": "27586019-a421-44cf-b43d-2d988bc0c924",
      "underlying": "INTC",
      "kind": "CloseReview",
      "positionChange": 24664,
      "momentDate": "2026-11-03"
    },
    {
      "debtId": "13d64a95-8556-4648-8acb-604b284d52c1",
      "tradeId": "871118d4-1bed-4f2c-963a-c1b3127b793f",
      "underlying": "TXN",
      "kind": "PositionChange",
      "positionChange": 96883,
      "momentDate": "2026-11-03"
    },
    {
      "debtId": "c17680e1-581b-446a-b693-177b3562c806",
      "tradeId": "871118d4-1bed-4f2c-963a-c1b3127b793f",
      "underlying": "TXN",
      "kind": "CloseReview",
      "positionChange": 24665,
      "momentDate": "2026-11-03"
    },
    {
      "debtId": "05fb8022-462b-4952-adda-d126b9289238",
      "tradeId": "486ec1c1-f989-4ca0-89da-cad48fa5d387",
      "underlying": "DIS",
      "kind": "PositionChange",
      "positionChange": 96884,
      "momentDate": "2026-11-03"
    },
    {
      "debtId": "7c13bbfd-c002-4102-8d5d-a3694024a078",
      "tradeId": "8ede93d2-4620-45d4-890b-7f1ccc4a6c81",
      "underlying": "CAT",
      "kind": "PositionChange",
      "positionChange": 96885,
      "momentDate": "2026-11-03"
    },
    {
      "debtId": "de134be4-f30c-4b17-af55-3eee716d29c3",
      "tradeId": "cca37ee1-539a-4ecd-b623-a213feb9b76a",
      "underlying": "DE",
      "kind": "PositionChange",
      "positionChange": 96886,
      "momentDate": "2026-11-03"
    },
    {
      "debtId": "9c463af1-4a6e-4c67-b4d6-6a16622f98ec",
      "tradeId": "cca37ee1-539a-4ecd-b623-a213feb9b76a",
      "underlying": "DE",
      "kind": "CloseReview",
      "positionChange": 24666,
      "momentDate": "2026-11-03"
    },
    {
      "debtId": "bd8fafc7-19eb-482b-86b5-a9b3ab9250b9",
      "tradeId": "20d13650-df1c-4bf1-bf13-4fb00efb3932",
      "underlying": "AAPL",
      "kind": "PositionChange",
      "positionChange": 96887,
      "momentDate": "2026-11-03"
    },
    {
      "debtId": "65e226aa-8c01-4adf-88b3-e5bfc716dd52",
      "tradeId": "20d13650-df1c-4bf1-bf13-4fb00efb3932",
      "underlying": "AAPL",
      "kind": "CloseReview",
      "positionChange": 24667,
      "momentDate": "2026-11-03"
    },
    {
      "debtId": "6486a556-c075-48c2-929a-106a0fe7a09d",
      "tradeId": "71dfa840-bc4d-42d4-8cc9-5e1d1d391b7c",
      "underlying": "AMZN",
      "kind": "PositionChange",
      "positionChange": 96888,
      "momentDate": "2026-11-03"
    },
    {
      "debtId": "9a748227-185d-429c-abfb-0e06a627f114",
      "tradeId": "71dfa840-bc4d-42d4-8cc9-5e1d1d391b7c",
      "underlying": "AMZN",
      "kind": "CloseReview",
      "positionChange": 24668,
      "momentDate": "2026-11-03"
    },
    {
      "debtId": "e0221a6c-329f-4a64-bee8-778e5d465d8a",
      "tradeId": "679cf38f-c5e5-4476-8d98-c836f081eb7d",
      "underlying": "META",
      "kind": "PositionChange",
      "positionChange": 96889,
      "momentDate": "2026-11-03"
    },
    {
      "debtId": "43791e99-3a5b-44d9-85b3-796fe93a2421",
      "tradeId": "63bb1a5c-b9e3-4cb7-af3f-ea1ec8f01238",
      "underlying": "COST",
      "kind": "PositionChange",
      "positionChange": 96890,
      "momentDate": "2026-11-03"
    },
    {
      "debtId": "63f2cd51-e1e2-4f82-88ed-38cbfc189eb6",
      "tradeId": "63bb1a5c-b9e3-4cb7-af3f-ea1ec8f01238",
      "underlying": "COST",
      "kind": "CloseReview",
      "positionChange": 24669,
      "momentDate": "2026-11-03"
    },
    {
      "debtId": "dcdc6009-3c8f-4fdb-a566-a67e41881b86",
      "tradeId": "e19d3f44-5ed4-4033-9759-0d825de9ee91",
      "underlying": "CSCO",
      "kind": "PositionChange",
      "positionChange": 96891,
      "momentDate": "2026-11-03"
    },
    {
      "debtId": "e4d159ee-c78a-460f-8438-72731ca78263",
      "tradeId": "f278a175-923c-4ee5-8875-cb2b0f71be17",
      "underlying": "KO",
      "kind": "PositionChange",
      "positionChange": 96892,
      "momentDate": "2026-11-03"
    },
    {
      "debtId": "4ff0f683-041c-4e64-86d0-18e23b6832cf",
      "tradeId": "f278a175-923c-4ee5-8875-cb2b0f71be17",
      "underlying": "KO",
      "kind": "CloseReview",
      "positionChange": 24670,
      "momentDate": "2026-11-03"
    },
    {
      "debtId": "8e3bf6db-7919-4f94-ab94-e23110d01f0e",
      "tradeId": "a919d594-8427-4803-be80-68cd7245f2de",
      "underlying": "PFE",
      "kind": "PositionChange",
      "positionChange": 96893,
      "momentDate": "2026-11-03"
    },
    {
      "debtId": "f8a3b8e8-fcc3-4625-87ea-a58172cf6a32",
      "tradeId": "07c7ff67-cd6c-4f24-af40-3bcd8bd5a28c",
      "underlying": "JPM",
      "kind": "PositionChange",
      "positionChange": 96894,
      "momentDate": "2026-11-03"
    },
    {
      "debtId": "82739151-195a-437d-b492-2117f13bdf82",
      "tradeId": "4a29ca86-2526-42ed-af96-55ed4f4913a8",
      "underlying": "HD",
      "kind": "PositionChange",
      "positionChange": 96895,
      "momentDate": "2026-11-03"
    },
    {
      "debtId": "1a185215-c096-413c-a455-278f2c46373f",
      "tradeId": "1fc12e3c-3b42-4f61-a27a-b8fe3b03680f",
      "underlying": "QAA",
      "kind": "PositionChange",
      "positionChange": 96896,
      "momentDate": "2026-11-03"
    },
    {
      "debtId": "99f2be68-24ec-4744-a9de-c1dd0f1ddd9a",
      "tradeId": "272c7b05-50e1-4038-b524-633ac342fbbf",
      "underlying": "CVX",
      "kind": "PositionChange",
      "positionChange": 96897,
      "momentDate": "2026-11-03"
    },
    {
      "debtId": "d2b6c53a-af4e-4b37-afe9-1d73590711bf",
      "tradeId": "343fe133-6416-4d7d-a0bb-de9b94a48eb0",
      "underlying": "QAF",
      "kind": "PositionChange",
      "positionChange": 96898,
      "momentDate": "2026-11-03"
    },
    {
      "debtId": "354b74c7-2b8c-48fc-aafd-df4ca51df93b",
      "tradeId": "09bd2b20-2ad7-47a4-8faf-6b210d76a617",
      "underlying": "LLY",
      "kind": "PositionChange",
      "positionChange": 96899,
      "momentDate": "2026-11-03"
    },
    {
      "debtId": "994bd9f5-c13e-421a-b909-807b78ef3907",
      "tradeId": "2f571148-7449-4d9a-b1f7-4050d498a08f",
      "underlying": "QAK",
      "kind": "PositionChange",
      "positionChange": 96900,
      "momentDate": "2026-11-03"
    },
    {
      "debtId": "9253a274-785f-4e19-921a-fbf0caa116ec",
      "tradeId": "cc0853c9-fb37-4c48-8ca3-3586fe8d0058",
      "underlying": "QAO",
      "kind": "PositionChange",
      "positionChange": 96901,
      "momentDate": "2026-11-03"
    },
    {
      "debtId": "db3bf72c-b341-4a01-89f8-d9971c59f9ee",
      "tradeId": "4cf35023-0c84-43ac-963d-855f23c3a13c",
      "underlying": "CRM",
      "kind": "PositionChange",
      "positionChange": 96902,
      "momentDate": "2026-11-03"
    },
    {
      "debtId": "19a56a05-a1cd-42fc-a7e5-2a9509b01cea",
      "tradeId": "15a49725-0bb5-4b03-b97a-56ed6c1698f0",
      "underlying": "QAT",
      "kind": "PositionChange",
      "positionChange": 96903,
      "momentDate": "2026-11-03"
    },
    {
      "debtId": "14719a66-c99a-4baa-b8ed-2f1aa6d9db77",
      "tradeId": "3e613f64-f15b-48ec-a81d-a655ef7cef30",
      "underlying": "ORCL",
      "kind": "PositionChange",
      "positionChange": 96904,
      "momentDate": "2026-11-03"
    },
    {
      "debtId": "a3c28622-21bb-46bf-bb79-6bf4bac3abae",
      "tradeId": "d995113a-2b52-460d-9a6f-5a754afaf744",
      "underlying": "AMD",
      "kind": "PositionChange",
      "positionChange": 96905,
      "momentDate": "2026-11-03"
    },
    {
      "debtId": "29bcc2dc-b9a6-4107-9537-dae216995347",
      "tradeId": "dcef7523-48b2-4629-b47d-12b83e8d582e",
      "underlying": "QAX",
      "kind": "PositionChange",
      "positionChange": 96906,
      "momentDate": "2026-11-03"
    },
    {
      "debtId": "b2669e75-14ef-42b0-b3f9-3d2772c8de04",
      "tradeId": "56ab7eaa-b228-467b-80cb-88a2ce3aaf6f",
      "underlying": "QAY",
      "kind": "PositionChange",
      "positionChange": 96907,
      "momentDate": "2026-11-03"
    },
    {
      "debtId": "647d53ff-2a4b-4cea-a26b-f0d6704c26a0",
      "tradeId": "2d3eab5d-0fbf-4510-af9d-ba7ae3afd5cd",
      "underlying": "QAZ",
      "kind": "PositionChange",
      "positionChange": 96908,
      "momentDate": "2026-11-03"
    },
    {
      "debtId": "7ac656a2-09b6-4aa7-a2a6-71489d4d390a",
      "tradeId": "206c4b5e-efe0-4b10-9706-a4bfd0a221ad",
      "underlying": "QBB",
      "kind": "PositionChange",
      "positionChange": 96909,
      "momentDate": "2026-11-03"
    },
    {
      "debtId": "43953cd7-76d8-4fb4-aea0-37ae68b0a50b",
      "tradeId": "e852fddf-debf-48c1-9d57-a10e0d17286a",
      "underlying": "QBC",
      "kind": "PositionChange",
      "positionChange": 96910,
      "momentDate": "2026-11-03"
    },
    {
      "debtId": "9dd3514d-9968-4c5e-91b9-2880809f615e",
      "tradeId": "ef12b7d5-67ad-4269-a7b2-e1263ffdd0a1",
      "underlying": "QBD",
      "kind": "PositionChange",
      "positionChange": 96911,
      "momentDate": "2026-11-03"
    },
    {
      "debtId": "215efb44-fced-40b7-a7d2-a97e39eac09c",
      "tradeId": "6f4f320d-a015-496c-9289-89352c147ac5",
      "underlying": "TXN",
      "kind": "PositionChange",
      "positionChange": 96912,
      "momentDate": "2026-11-03"
    },
    {
      "debtId": "ba6bcfdc-d373-4933-bf69-01e3570f6cfc",
      "tradeId": "1ac4cd82-2a61-45c1-be16-050607e537b9",
      "underlying": "WMT",
      "kind": "PositionChange",
      "positionChange": 96913,
      "momentDate": "2026-11-03"
    },
    {
      "debtId": "eb0b1abc-d3f1-4d71-98a7-6c62eb243e75",
      "tradeId": "26ae765c-a357-487b-86ee-25635c1ca919",
      "underlying": "QBE",
      "kind": "PositionChange",
      "positionChange": 96914,
      "momentDate": "2026-11-03"
    },
    {
      "debtId": "65811457-0c25-442b-957a-71a6a5a9115f",
      "tradeId": "9d821665-5e09-4269-8aa2-b74b73c03c96",
      "underlying": "QBG",
      "kind": "PositionChange",
      "positionChange": 96915,
      "momentDate": "2026-11-03"
    },
    {
      "debtId": "2c1b125f-9a09-47d1-b81f-b9e10cfd5ef8",
      "tradeId": "bb4cafef-2054-42f4-b798-3e470a5f9be8",
      "underlying": "QBH",
      "kind": "PositionChange",
      "positionChange": 96916,
      "momentDate": "2026-11-03"
    },
    {
      "debtId": "87f93ed6-910c-4a4a-ac86-828abbbaf462",
      "tradeId": "631a20e9-087c-4b1c-83b7-77841d86d41f",
      "underlying": "QBI",
      "kind": "PositionChange",
      "positionChange": 96917,
      "momentDate": "2026-11-03"
    },
    {
      "debtId": "02905730-b137-45b9-8a77-ec16d5ad9a5a",
      "tradeId": "cf7641d9-dada-43c4-9f17-c3ba97ce2353",
      "underlying": "QBK",
      "kind": "PositionChange",
      "positionChange": 96918,
      "momentDate": "2026-11-03"
    },
    {
      "debtId": "279e2ca1-7e83-4c91-8344-f2e5efd3b6db",
      "tradeId": "1bcf132f-114d-4563-890f-d31161cb7db9",
      "underlying": "DIS",
      "kind": "PositionChange",
      "positionChange": 96919,
      "momentDate": "2026-11-03"
    },
    {
      "debtId": "5aa606eb-6298-447c-99de-e85ed49c2d64",
      "tradeId": "c0926bbf-033f-4d74-b6e9-878540280a07",
      "underlying": "NKE",
      "kind": "PositionChange",
      "positionChange": 96920,
      "momentDate": "2026-11-03"
    },
    {
      "debtId": "54800de0-9006-40af-b660-45e304741fa8",
      "tradeId": "2c9a4413-ce85-4cf7-83a5-19289ad2ddb0",
      "underlying": "QBL",
      "kind": "PositionChange",
      "positionChange": 96921,
      "momentDate": "2026-11-03"
    },
    {
      "debtId": "59564088-d9f7-486a-82c6-eb028e2c2f7e",
      "tradeId": "b0292d77-444a-44d4-b7dd-1387e38da9af",
      "underlying": "QBM",
      "kind": "PositionChange",
      "positionChange": 96922,
      "momentDate": "2026-11-03"
    },
    {
      "debtId": "82e9593b-9256-41ce-9d6b-a06ace4debb8",
      "tradeId": "25c9dc91-9360-420a-a6b6-e9432fa9c424",
      "underlying": "QBN",
      "kind": "PositionChange",
      "positionChange": 96923,
      "momentDate": "2026-11-03"
    },
    {
      "debtId": "f6a2bafa-7d12-4978-99c6-7a707d327ba8",
      "tradeId": "7bda8682-bd17-47b1-892b-dac3f56ed66a",
      "underlying": "QBP",
      "kind": "PositionChange",
      "positionChange": 96924,
      "momentDate": "2026-11-03"
    },
    {
      "debtId": "30b7e790-5320-4d5e-bd17-01214fc8c8f5",
      "tradeId": "f8d267b4-da0e-48a2-afbd-9eb947c56fb4",
      "underlying": "QBQ",
      "kind": "PositionChange",
      "positionChange": 96925,
      "momentDate": "2026-11-03"
    },
    {
      "debtId": "f74a9ed7-5af1-425d-9059-937eb042cdda",
      "tradeId": "1e4ca3cf-3ea3-4d3d-8796-3f698e9f9840",
      "underlying": "QBR",
      "kind": "PositionChange",
      "positionChange": 96926,
      "momentDate": "2026-11-03"
    },
    {
      "debtId": "f2eec825-a02f-4739-84d6-6afc37618e71",
      "tradeId": "48630489-e277-441c-b39d-dd4a36bf2bbc",
      "underlying": "CAT",
      "kind": "PositionChange",
      "positionChange": 96927,
      "momentDate": "2026-11-03"
    },
    {
      "debtId": "06992afb-316a-4ac5-97df-221cb0695ee9",
      "tradeId": "f41edac6-d82b-4d09-8aa0-7f3a7bfcddd1",
      "underlying": "DE",
      "kind": "PositionChange",
      "positionChange": 96928,
      "momentDate": "2026-11-03"
    },
    {
      "debtId": "e3fe8dd5-36fd-4a41-98d5-19f3820c49f9",
      "tradeId": "944fc62c-4990-4b5a-a528-4285aea0b0b5",
      "underlying": "QBS",
      "kind": "PositionChange",
      "positionChange": 96929,
      "momentDate": "2026-11-03"
    },
    {
      "debtId": "45d45327-e985-4798-87c5-fb2cf3c115a6",
      "tradeId": "4ca7dc92-71bd-4b05-a2c3-7eb272a18b96",
      "underlying": "QBU",
      "kind": "PositionChange",
      "positionChange": 96930,
      "momentDate": "2026-11-03"
    },
    {
      "debtId": "a90509d3-0668-4641-9980-1d5f3f325b85",
      "tradeId": "313abb62-763b-41be-b01b-66e18acbb54a",
      "underlying": "QBV",
      "kind": "PositionChange",
      "positionChange": 96931,
      "momentDate": "2026-11-03"
    },
    {
      "debtId": "c5ccc9f4-6a65-4ee0-ae55-2a0167d92ab3",
      "tradeId": "cdd5301a-4074-4f6e-a7ae-9b84040dbcc4",
      "underlying": "QBW",
      "kind": "PositionChange",
      "positionChange": 96932,
      "momentDate": "2026-11-03"
    },
    {
      "debtId": "5bccc37c-eb3d-4c33-9656-ab94d90a4cb4",
      "tradeId": "62ad1115-3199-44fa-8a62-cc4bb82ddbe6",
      "underlying": "QBX",
      "kind": "PositionChange",
      "positionChange": 96933,
      "momentDate": "2026-11-03"
    },
    {
      "debtId": "1e482345-1f49-4285-a997-f75cfda49eca",
      "tradeId": "57f98934-1152-4a74-b60f-eec018264234",
      "underlying": "AAPL",
      "kind": "PositionChange",
      "positionChange": 96934,
      "momentDate": "2026-11-03"
    },
    {
      "debtId": "f2a5fdeb-b7ab-423a-ba46-676d7e2e281d",
      "tradeId": "44339297-1d29-45f1-b278-d5e3717e36ca",
      "underlying": "GS",
      "kind": "PositionChange",
      "positionChange": 96935,
      "momentDate": "2026-11-03"
    },
    {
      "debtId": "6598ff3e-dc98-4f0c-bb9d-f84a8709b9be",
      "tradeId": "4e485777-a1bd-41d5-9359-9c98fa20b740",
      "underlying": "QAA",
      "kind": "PositionChange",
      "positionChange": 96936,
      "momentDate": "2026-11-03"
    },
    {
      "debtId": "3aec812f-9dd4-4cf4-a046-967cf1baabff",
      "tradeId": "392e532f-7ac0-484e-bc0b-117896d319c7",
      "underlying": "QAB",
      "kind": "PositionChange",
      "positionChange": 96937,
      "momentDate": "2026-11-03"
    },
    {
      "debtId": "ed3175e2-78fe-4bd6-890d-c99fea3df41e",
      "tradeId": "a47dab25-6105-40ee-b85d-2fbc5844c207",
      "underlying": "MSFT",
      "kind": "PositionChange",
      "positionChange": 96938,
      "momentDate": "2026-11-03"
    },
    {
      "debtId": "90774f1b-d73f-4882-8128-8f816647ae68",
      "tradeId": "a718055e-2b61-4bbf-b78b-4bf7aa3c2089",
      "underlying": "NVDA",
      "kind": "PositionChange",
      "positionChange": 96939,
      "momentDate": "2026-11-03"
    },
    {
      "debtId": "0b57a5c0-e5d0-4fe5-a874-2c4f5f3fc989",
      "tradeId": "5418d89c-249c-4828-ae78-7f99c9b00887",
      "underlying": "AMZN",
      "kind": "PositionChange",
      "positionChange": 96940,
      "momentDate": "2026-11-03"
    },
    {
      "debtId": "7cc9d270-45d7-4907-9eeb-0bc9feea0fe7",
      "tradeId": "e4f27e26-1045-4af3-a119-06ec7b0c571a",
      "underlying": "GOOGL",
      "kind": "PositionChange",
      "positionChange": 96941,
      "momentDate": "2026-11-03"
    },
    {
      "debtId": "7917b8b7-fa93-451e-b982-cb5062992bbc",
      "tradeId": "ef94307a-909b-4d58-8479-39ae68a3ca9e",
      "underlying": "META",
      "kind": "PositionChange",
      "positionChange": 96942,
      "momentDate": "2026-11-03"
    },
    {
      "debtId": "8a52ebc3-9ce6-4154-9aa3-690bed499da4",
      "tradeId": "22a90a65-d634-4575-80be-3f5494448f72",
      "underlying": "TSLA",
      "kind": "PositionChange",
      "positionChange": 96943,
      "momentDate": "2026-11-03"
    },
    {
      "debtId": "916e70ff-1cf9-42d0-90f2-0bca710defcc",
      "tradeId": "f96728cf-ec5e-4ef6-9269-5fc1897e465c",
      "underlying": "AVGO",
      "kind": "PositionChange",
      "positionChange": 96944,
      "momentDate": "2026-11-03"
    },
    {
      "debtId": "86750025-662e-43ff-843e-b3390eaa949c",
      "tradeId": "db1ccbe0-1b89-41d2-8e0b-67976a5d5616",
      "underlying": "QAC",
      "kind": "PositionChange",
      "positionChange": 96945,
      "momentDate": "2026-11-03"
    },
    {
      "debtId": "16d75171-8f48-42ba-992e-a2f8e1079cd8",
      "tradeId": "f9f81ce3-a3ba-4678-aa63-ac14137199a1",
      "underlying": "QAD",
      "kind": "PositionChange",
      "positionChange": 96946,
      "momentDate": "2026-11-03"
    },
    {
      "debtId": "e462177a-8ce9-4955-86ca-15990ec95273",
      "tradeId": "f5bc3445-2801-4274-97ef-8b82c7d7003e",
      "underlying": "QAE",
      "kind": "PositionChange",
      "positionChange": 96947,
      "momentDate": "2026-11-03"
    },
    {
      "debtId": "dce21b0f-08db-400a-a43d-81ca889055b6",
      "tradeId": "2d0c3194-1d0f-4e49-bceb-0082ff798619",
      "underlying": "COST",
      "kind": "PositionChange",
      "positionChange": 96948,
      "momentDate": "2026-11-03"
    },
    {
      "debtId": "eb452d1f-200d-4c2c-9e04-0815a77224e5",
      "tradeId": "d564a92f-588d-4e76-a0ad-997ef6361c12",
      "underlying": "NFLX",
      "kind": "PositionChange",
      "positionChange": 96949,
      "momentDate": "2026-11-03"
    },
    {
      "debtId": "caa35ba5-686a-4873-bf2e-eef65525b78d",
      "tradeId": "7da74465-4116-46af-9068-1709161a3827",
      "underlying": "CSCO",
      "kind": "PositionChange",
      "positionChange": 96950,
      "momentDate": "2026-11-03"
    },
    {
      "debtId": "c92e10ab-ee49-4a33-9f76-9c2e44f72d6b",
      "tradeId": "3f9dcaa0-865f-475f-aafb-f0e1f3b8966c",
      "underlying": "KO",
      "kind": "PositionChange",
      "positionChange": 96951,
      "momentDate": "2026-11-03"
    },
    {
      "debtId": "7233fad3-5b34-4154-a485-457104709247",
      "tradeId": "527e4866-06df-4b2d-98e1-490e1b05b060",
      "underlying": "PFE",
      "kind": "PositionChange",
      "positionChange": 96952,
      "momentDate": "2026-11-03"
    },
    {
      "debtId": "a2364ca8-2564-4a23-9c0e-cb7e4d2f025e",
      "tradeId": "8184f750-e2bd-4547-bbf7-890e18af0244",
      "underlying": "JPM",
      "kind": "PositionChange",
      "positionChange": 96953,
      "momentDate": "2026-11-03"
    },
    {
      "debtId": "406b0660-c48d-4ccc-bfc1-1db37df82b89",
      "tradeId": "78bef750-ed64-4cc6-9944-4d61d6049c68",
      "underlying": "V",
      "kind": "PositionChange",
      "positionChange": 96954,
      "momentDate": "2026-11-03"
    },
    {
      "debtId": "edf5b850-a0b2-493b-a32f-d79b67a7695e",
      "tradeId": "2f41e12b-787d-4faf-b579-ddc734121294",
      "underlying": "QAF",
      "kind": "PositionChange",
      "positionChange": 96955,
      "momentDate": "2026-11-03"
    },
    {
      "debtId": "3dd577d4-0aa1-4166-a02a-cf15e3b70a06",
      "tradeId": "7591debd-9dad-441b-bbde-3d2c5bf53875",
      "underlying": "QAG",
      "kind": "PositionChange",
      "positionChange": 96956,
      "momentDate": "2026-11-03"
    },
    {
      "debtId": "34808a9c-53d7-4495-9dad-0fcb24703632",
      "tradeId": "7ffd1cec-3f5b-4b59-9850-7de0252faf02",
      "underlying": "QAH",
      "kind": "PositionChange",
      "positionChange": 96957,
      "momentDate": "2026-11-03"
    },
    {
      "debtId": "49720184-617b-42b7-b728-4db2bf9cee4d",
      "tradeId": "778a2c95-3caf-4165-bb22-5c87c55f8e72",
      "underlying": "MA",
      "kind": "PositionChange",
      "positionChange": 96958,
      "momentDate": "2026-11-03"
    },
    {
      "debtId": "badd7736-2af1-4a23-9191-5fa109093191",
      "tradeId": "313c387b-9b96-4159-9c0f-4f8fae6f8c1e",
      "underlying": "UNH",
      "kind": "PositionChange",
      "positionChange": 96959,
      "momentDate": "2026-11-03"
    },
    {
      "debtId": "ff506e73-1b8a-47ba-a6c9-ec28bd12122a",
      "tradeId": "f69ee396-1d00-4809-ad4e-076d9674430b",
      "underlying": "HD",
      "kind": "PositionChange",
      "positionChange": 96960,
      "momentDate": "2026-11-03"
    },
    {
      "debtId": "a7ed5849-00c2-4c0c-aaf2-e2ead1b55a67",
      "tradeId": "eff63013-fc89-443f-850f-17f02fe72c3e",
      "underlying": "PG",
      "kind": "PositionChange",
      "positionChange": 96961,
      "momentDate": "2026-11-03"
    },
    {
      "debtId": "0a8c5de4-70f0-4db2-a55c-2c818e71cc2b",
      "tradeId": "85cf7a6d-46ec-47e2-b786-317e36842593",
      "underlying": "XOM",
      "kind": "PositionChange",
      "positionChange": 96962,
      "momentDate": "2026-11-03"
    },
    {
      "debtId": "7b16012b-e5b1-4d2a-8559-b292b6c9a4db",
      "tradeId": "d66c4132-4238-4f18-b8cf-0338e58c5610",
      "underlying": "CVX",
      "kind": "PositionChange",
      "positionChange": 96963,
      "momentDate": "2026-11-03"
    },
    {
      "debtId": "cff6a03e-2822-4f8a-b9c1-0fca0412670e",
      "tradeId": "21918c69-b1f5-4567-aa4a-98bd4c78d952",
      "underlying": "LLY",
      "kind": "PositionChange",
      "positionChange": 96964,
      "momentDate": "2026-11-03"
    },
    {
      "debtId": "fc08504e-0f98-469f-80b6-b55f2e982489",
      "tradeId": "d0eef693-d4f3-4fe8-bd61-a787bda1e12b",
      "underlying": "QAI",
      "kind": "PositionChange",
      "positionChange": 96965,
      "momentDate": "2026-11-03"
    },
    {
      "debtId": "ec985601-1086-4fe2-84bb-4f9ed822824d",
      "tradeId": "55ee422b-6a9c-4daa-9aa4-552b734d7cd1",
      "underlying": "QCOM",
      "kind": "PositionChange",
      "positionChange": 96966,
      "momentDate": "2026-11-03"
    },
    {
      "debtId": "49bf26cb-7838-4213-9c89-329ea1398e4c",
      "tradeId": "55ee422b-6a9c-4daa-9aa4-552b734d7cd1",
      "underlying": "QCOM",
      "kind": "CloseReview",
      "positionChange": 24671,
      "momentDate": "2026-11-03"
    },
    {
      "debtId": "cf160c26-c642-4810-ad02-254d6e04b37c",
      "tradeId": "29979fa7-b43e-409d-9545-ec1c31c5d30b",
      "underlying": "DIS",
      "kind": "PositionChange",
      "positionChange": 96967,
      "momentDate": "2026-11-03"
    },
    {
      "debtId": "61508571-539e-4b6c-8c77-be6462d59a70",
      "tradeId": "29979fa7-b43e-409d-9545-ec1c31c5d30b",
      "underlying": "DIS",
      "kind": "CloseReview",
      "positionChange": 24672,
      "momentDate": "2026-11-03"
    },
    {
      "debtId": "eea4688f-aab5-41e2-885d-9ff5b9a7ba89",
      "tradeId": "3d553e13-d7b0-48c2-84bc-38c1651acbda",
      "underlying": "HD",
      "kind": "PositionChange",
      "positionChange": 96968,
      "momentDate": "2026-11-04"
    },
    {
      "debtId": "22e802e1-e4b1-49b1-9209-c38c7c766270",
      "tradeId": "3d553e13-d7b0-48c2-84bc-38c1651acbda",
      "underlying": "HD",
      "kind": "CloseReview",
      "positionChange": 24673,
      "momentDate": "2026-11-04"
    },
    {
      "debtId": "62a81c8b-8d55-4590-b6b8-39ea02dfb76a",
      "tradeId": "f7b7280e-f43e-428a-8cd8-9aceb37292e0",
      "underlying": "CRM",
      "kind": "PositionChange",
      "positionChange": 96969,
      "momentDate": "2026-11-04"
    },
    {
      "debtId": "07fdff42-86ad-455c-bc83-51c131773f29",
      "tradeId": "f7b7280e-f43e-428a-8cd8-9aceb37292e0",
      "underlying": "CRM",
      "kind": "CloseReview",
      "positionChange": 24674,
      "momentDate": "2026-11-04"
    },
    {
      "debtId": "1b12d7db-73dc-4fbb-b7e2-fe46eb47b88c",
      "tradeId": "19b241fe-ea9e-4f3b-b50e-f1a840b1eafe",
      "underlying": "INTC",
      "kind": "PositionChange",
      "positionChange": 96970,
      "momentDate": "2026-11-04"
    },
    {
      "debtId": "c7236202-4634-4a98-8770-924a4679afac",
      "tradeId": "19b241fe-ea9e-4f3b-b50e-f1a840b1eafe",
      "underlying": "INTC",
      "kind": "CloseReview",
      "positionChange": 24675,
      "momentDate": "2026-11-04"
    },
    {
      "debtId": "d3fde867-be6c-43ea-934d-d54adb7285f9",
      "tradeId": "763c48df-45e9-4f16-8214-34ee70201a17",
      "underlying": "DE",
      "kind": "PositionChange",
      "positionChange": 96971,
      "momentDate": "2026-11-04"
    },
    {
      "debtId": "696731ba-51ef-4f34-ba73-d075cb9cb4a5",
      "tradeId": "763c48df-45e9-4f16-8214-34ee70201a17",
      "underlying": "DE",
      "kind": "CloseReview",
      "positionChange": 24676,
      "momentDate": "2026-11-04"
    },
    {
      "debtId": "fdb27257-05b6-4aeb-8348-5991ec8df00d",
      "tradeId": "80cd837b-6ad1-43f3-9886-7bf600304b92",
      "underlying": "MSFT",
      "kind": "PositionChange",
      "positionChange": 96972,
      "momentDate": "2026-11-04"
    },
    {
      "debtId": "56e2cabc-b497-4b45-8126-0cad577c025f",
      "tradeId": "80cd837b-6ad1-43f3-9886-7bf600304b92",
      "underlying": "MSFT",
      "kind": "CloseReview",
      "positionChange": 24677,
      "momentDate": "2026-11-04"
    },
    {
      "debtId": "a45c9c5c-e0d5-4c1e-b892-317b759093c0",
      "tradeId": "96e97d77-4343-4bd0-888e-7b18201fd256",
      "underlying": "JPM",
      "kind": "PositionChange",
      "positionChange": 96973,
      "momentDate": "2026-11-04"
    },
    {
      "debtId": "301e7ef2-c55a-47a2-ae15-ced874efc9a9",
      "tradeId": "94378866-223a-4d01-982c-b9408b21842f",
      "underlying": "PG",
      "kind": "PositionChange",
      "positionChange": 96974,
      "momentDate": "2026-11-04"
    },
    {
      "debtId": "80109f86-72e4-4c2e-a56a-b0803fe33aec",
      "tradeId": "94378866-223a-4d01-982c-b9408b21842f",
      "underlying": "PG",
      "kind": "CloseReview",
      "positionChange": 24678,
      "momentDate": "2026-11-04"
    },
    {
      "debtId": "d026eb96-6cf6-40c5-a967-ba3bef55d150",
      "tradeId": "72b1fb06-817a-4d41-a5d2-55afe8080131",
      "underlying": "LLY",
      "kind": "PositionChange",
      "positionChange": 96975,
      "momentDate": "2026-11-04"
    },
    {
      "debtId": "f0710947-d8fe-4880-a9ae-3f141dc9aa12",
      "tradeId": "72b1fb06-817a-4d41-a5d2-55afe8080131",
      "underlying": "LLY",
      "kind": "CloseReview",
      "positionChange": 24679,
      "momentDate": "2026-11-04"
    },
    {
      "debtId": "a075bd1e-8996-4aee-af23-b575bd735c7b",
      "tradeId": "be25b24a-d623-4f1a-81b8-4bcbe1974f92",
      "underlying": "ADBE",
      "kind": "PositionChange",
      "positionChange": 96976,
      "momentDate": "2026-11-04"
    },
    {
      "debtId": "4975eb0a-c0be-462c-bef1-139c99c8f295",
      "tradeId": "486ec1c1-f989-4ca0-89da-cad48fa5d387",
      "underlying": "DIS",
      "kind": "PositionChange",
      "positionChange": 96977,
      "momentDate": "2026-11-04"
    },
    {
      "debtId": "1b920ac7-a525-4ef7-8ec7-c496d78da90b",
      "tradeId": "486ec1c1-f989-4ca0-89da-cad48fa5d387",
      "underlying": "DIS",
      "kind": "CloseReview",
      "positionChange": 24680,
      "momentDate": "2026-11-04"
    },
    {
      "debtId": "3e3c0886-631a-4e5f-b21b-3b6af225e119",
      "tradeId": "30ec5869-cf70-4367-ad8e-47fe33f04c7e",
      "underlying": "NKE",
      "kind": "PositionChange",
      "positionChange": 96978,
      "momentDate": "2026-11-04"
    },
    {
      "debtId": "8f62a38a-9106-4bcc-ac4a-bb1ab061e052",
      "tradeId": "8ede93d2-4620-45d4-890b-7f1ccc4a6c81",
      "underlying": "CAT",
      "kind": "PositionChange",
      "positionChange": 96979,
      "momentDate": "2026-11-04"
    },
    {
      "debtId": "878d6cb5-a85a-43fb-98bd-482feda43f40",
      "tradeId": "679cf38f-c5e5-4476-8d98-c836f081eb7d",
      "underlying": "META",
      "kind": "PositionChange",
      "positionChange": 96980,
      "momentDate": "2026-11-04"
    },
    {
      "debtId": "4434097f-ddb6-4b91-9df1-fe5f0010fb01",
      "tradeId": "679cf38f-c5e5-4476-8d98-c836f081eb7d",
      "underlying": "META",
      "kind": "CloseReview",
      "positionChange": 24681,
      "momentDate": "2026-11-04"
    },
    {
      "debtId": "f8ba65b7-9739-4ef2-943d-207652fad744",
      "tradeId": "cede4d72-19b8-4f48-a934-640af69bd94e",
      "underlying": "NFLX",
      "kind": "PositionChange",
      "positionChange": 96981,
      "momentDate": "2026-11-04"
    },
    {
      "debtId": "87ceaa8d-5f05-4148-b329-b788a6047c2f",
      "tradeId": "e19d3f44-5ed4-4033-9759-0d825de9ee91",
      "underlying": "CSCO",
      "kind": "PositionChange",
      "positionChange": 96982,
      "momentDate": "2026-11-04"
    },
    {
      "debtId": "6e7dbf5f-3085-4b34-98de-efb47bbca606",
      "tradeId": "e19d3f44-5ed4-4033-9759-0d825de9ee91",
      "underlying": "CSCO",
      "kind": "CloseReview",
      "positionChange": 24682,
      "momentDate": "2026-11-04"
    },
    {
      "debtId": "efece9a4-2176-434f-8e54-0f4e867e546b",
      "tradeId": "a919d594-8427-4803-be80-68cd7245f2de",
      "underlying": "PFE",
      "kind": "PositionChange",
      "positionChange": 96983,
      "momentDate": "2026-11-04"
    },
    {
      "debtId": "587a6ad0-63fa-425b-b13b-dcf5913e9a52",
      "tradeId": "a919d594-8427-4803-be80-68cd7245f2de",
      "underlying": "PFE",
      "kind": "CloseReview",
      "positionChange": 24683,
      "momentDate": "2026-11-04"
    },
    {
      "debtId": "4a0227f5-5101-4fc3-9eb2-9af43045ef5b",
      "tradeId": "07c7ff67-cd6c-4f24-af40-3bcd8bd5a28c",
      "underlying": "JPM",
      "kind": "PositionChange",
      "positionChange": 96984,
      "momentDate": "2026-11-04"
    },
    {
      "debtId": "7e3e7b0b-2419-4f89-8fda-6cf3229e3d9a",
      "tradeId": "07c7ff67-cd6c-4f24-af40-3bcd8bd5a28c",
      "underlying": "JPM",
      "kind": "CloseReview",
      "positionChange": 24684,
      "momentDate": "2026-11-04"
    },
    {
      "debtId": "5bd31464-38c7-4bab-ae6c-6f3970181d18",
      "tradeId": "4cc00063-c782-49a5-9590-cb6351fe1fe5",
      "underlying": "V",
      "kind": "PositionChange",
      "positionChange": 96985,
      "momentDate": "2026-11-04"
    },
    {
      "debtId": "0ab17c7e-a074-4b98-9991-7b7c6d08569b",
      "tradeId": "8535d565-16f8-4b68-9215-0f628ca681a7",
      "underlying": "MA",
      "kind": "PositionChange",
      "positionChange": 96986,
      "momentDate": "2026-11-04"
    },
    {
      "debtId": "ed1df058-3458-42f6-8106-91e458e3357e",
      "tradeId": "8535d565-16f8-4b68-9215-0f628ca681a7",
      "underlying": "MA",
      "kind": "CloseReview",
      "positionChange": 24685,
      "momentDate": "2026-11-04"
    },
    {
      "debtId": "95e079cf-6dc9-4a8b-9b36-ecf5fb34d427",
      "tradeId": "4a29ca86-2526-42ed-af96-55ed4f4913a8",
      "underlying": "HD",
      "kind": "PositionChange",
      "positionChange": 96987,
      "momentDate": "2026-11-04"
    },
    {
      "debtId": "79bbe42f-2bf1-4102-9760-958beb70dd0d",
      "tradeId": "56ab7eaa-b228-467b-80cb-88a2ce3aaf6f",
      "underlying": "QAY",
      "kind": "PositionChange",
      "positionChange": 96988,
      "momentDate": "2026-11-04"
    },
    {
      "debtId": "6c94b49d-59fd-4f62-aaeb-73bc2c417158",
      "tradeId": "e852fddf-debf-48c1-9d57-a10e0d17286a",
      "underlying": "QBC",
      "kind": "PositionChange",
      "positionChange": 96989,
      "momentDate": "2026-11-04"
    },
    {
      "debtId": "962b58b2-c421-4f8b-ab5b-12186990c14c",
      "tradeId": "1ac4cd82-2a61-45c1-be16-050607e537b9",
      "underlying": "WMT",
      "kind": "PositionChange",
      "positionChange": 96990,
      "momentDate": "2026-11-04"
    },
    {
      "debtId": "b9c18726-b17b-413e-ba6b-eb6baf6e72b1",
      "tradeId": "bb4cafef-2054-42f4-b798-3e470a5f9be8",
      "underlying": "QBH",
      "kind": "PositionChange",
      "positionChange": 96991,
      "momentDate": "2026-11-04"
    },
    {
      "debtId": "ba12560d-9993-4d66-a24e-c01dac906e2f",
      "tradeId": "1bcf132f-114d-4563-890f-d31161cb7db9",
      "underlying": "DIS",
      "kind": "PositionChange",
      "positionChange": 96992,
      "momentDate": "2026-11-04"
    },
    {
      "debtId": "ffdea30a-4f91-474c-91c5-1e3249d0c2c0",
      "tradeId": "b0292d77-444a-44d4-b7dd-1387e38da9af",
      "underlying": "QBM",
      "kind": "PositionChange",
      "positionChange": 96993,
      "momentDate": "2026-11-04"
    },
    {
      "debtId": "54ea17d0-3612-41dc-9f68-3ca401597111",
      "tradeId": "f8d267b4-da0e-48a2-afbd-9eb947c56fb4",
      "underlying": "QBQ",
      "kind": "PositionChange",
      "positionChange": 96994,
      "momentDate": "2026-11-04"
    },
    {
      "debtId": "6b37c28b-afa2-4cf4-b425-f5e6daa967f2",
      "tradeId": "f41edac6-d82b-4d09-8aa0-7f3a7bfcddd1",
      "underlying": "DE",
      "kind": "PositionChange",
      "positionChange": 96995,
      "momentDate": "2026-11-04"
    },
    {
      "debtId": "af10b14b-8371-4bab-b4e3-6574cf5ef966",
      "tradeId": "313abb62-763b-41be-b01b-66e18acbb54a",
      "underlying": "QBV",
      "kind": "PositionChange",
      "positionChange": 96996,
      "momentDate": "2026-11-04"
    },
    {
      "debtId": "83dab576-32b0-4f06-bdd6-084eaebd803c",
      "tradeId": "cdd5301a-4074-4f6e-a7ae-9b84040dbcc4",
      "underlying": "QBW",
      "kind": "PositionChange",
      "positionChange": 96997,
      "momentDate": "2026-11-04"
    },
    {
      "debtId": "d4edeed7-38c3-4002-b275-111552a233c3",
      "tradeId": "57f98934-1152-4a74-b60f-eec018264234",
      "underlying": "AAPL",
      "kind": "PositionChange",
      "positionChange": 96998,
      "momentDate": "2026-11-04"
    },
    {
      "debtId": "09df0acc-93dd-4536-bea6-5d0a8cb46427",
      "tradeId": "44339297-1d29-45f1-b278-d5e3717e36ca",
      "underlying": "GS",
      "kind": "PositionChange",
      "positionChange": 96999,
      "momentDate": "2026-11-04"
    },
    {
      "debtId": "a81c9049-493a-41d6-bae8-93331ac844d2",
      "tradeId": "4e485777-a1bd-41d5-9359-9c98fa20b740",
      "underlying": "QAA",
      "kind": "PositionChange",
      "positionChange": 97000,
      "momentDate": "2026-11-04"
    },
    {
      "debtId": "e26b78d5-86e2-4640-9b16-879ba4bb02e7",
      "tradeId": "a47dab25-6105-40ee-b85d-2fbc5844c207",
      "underlying": "MSFT",
      "kind": "PositionChange",
      "positionChange": 97001,
      "momentDate": "2026-11-04"
    },
    {
      "debtId": "bb97d645-8bfe-4464-842d-fcafab1fcfe7",
      "tradeId": "a718055e-2b61-4bbf-b78b-4bf7aa3c2089",
      "underlying": "NVDA",
      "kind": "PositionChange",
      "positionChange": 97002,
      "momentDate": "2026-11-04"
    },
    {
      "debtId": "59c1cddf-0982-467a-b7ab-f6bb720bd35a",
      "tradeId": "5418d89c-249c-4828-ae78-7f99c9b00887",
      "underlying": "AMZN",
      "kind": "PositionChange",
      "positionChange": 97003,
      "momentDate": "2026-11-04"
    },
    {
      "debtId": "f7851327-0f66-4917-bdf8-612032b17ba6",
      "tradeId": "ef94307a-909b-4d58-8479-39ae68a3ca9e",
      "underlying": "META",
      "kind": "PositionChange",
      "positionChange": 97004,
      "momentDate": "2026-11-04"
    },
    {
      "debtId": "9faab264-67c0-487f-bc99-c56f9d961b28",
      "tradeId": "22a90a65-d634-4575-80be-3f5494448f72",
      "underlying": "TSLA",
      "kind": "PositionChange",
      "positionChange": 97005,
      "momentDate": "2026-11-04"
    },
    {
      "debtId": "01bcbf6d-e99c-43e8-a5fb-2673b8ab4f47",
      "tradeId": "f96728cf-ec5e-4ef6-9269-5fc1897e465c",
      "underlying": "AVGO",
      "kind": "PositionChange",
      "positionChange": 97006,
      "momentDate": "2026-11-04"
    },
    {
      "debtId": "76acb5b8-4007-41d3-bedb-859c1665b8ab",
      "tradeId": "f9f81ce3-a3ba-4678-aa63-ac14137199a1",
      "underlying": "QAD",
      "kind": "PositionChange",
      "positionChange": 97007,
      "momentDate": "2026-11-04"
    },
    {
      "debtId": "3661aafd-e1b9-4867-bb80-2c4c1efc150e",
      "tradeId": "f5bc3445-2801-4274-97ef-8b82c7d7003e",
      "underlying": "QAE",
      "kind": "PositionChange",
      "positionChange": 97008,
      "momentDate": "2026-11-04"
    },
    {
      "debtId": "9c03830f-8e76-46a3-98ae-ceecd067ab90",
      "tradeId": "2d0c3194-1d0f-4e49-bceb-0082ff798619",
      "underlying": "COST",
      "kind": "PositionChange",
      "positionChange": 97009,
      "momentDate": "2026-11-04"
    },
    {
      "debtId": "b2d25ac0-ad4b-4f92-8aad-2f16b7530427",
      "tradeId": "7da74465-4116-46af-9068-1709161a3827",
      "underlying": "CSCO",
      "kind": "PositionChange",
      "positionChange": 97010,
      "momentDate": "2026-11-04"
    },
    {
      "debtId": "973cdc92-6fdb-4992-a694-7ee30f76f217",
      "tradeId": "3f9dcaa0-865f-475f-aafb-f0e1f3b8966c",
      "underlying": "KO",
      "kind": "PositionChange",
      "positionChange": 97011,
      "momentDate": "2026-11-04"
    },
    {
      "debtId": "f1035a53-7bb7-420d-bade-136b6fc3ce83",
      "tradeId": "527e4866-06df-4b2d-98e1-490e1b05b060",
      "underlying": "PFE",
      "kind": "PositionChange",
      "positionChange": 97012,
      "momentDate": "2026-11-04"
    },
    {
      "debtId": "bd57acc4-c3de-4ad4-a4c2-6c829e8b2296",
      "tradeId": "78bef750-ed64-4cc6-9944-4d61d6049c68",
      "underlying": "V",
      "kind": "PositionChange",
      "positionChange": 97013,
      "momentDate": "2026-11-04"
    },
    {
      "debtId": "b2b2c69f-5461-4570-8935-45bc15e99fda",
      "tradeId": "2f41e12b-787d-4faf-b579-ddc734121294",
      "underlying": "QAF",
      "kind": "PositionChange",
      "positionChange": 97014,
      "momentDate": "2026-11-04"
    },
    {
      "debtId": "ec101c01-1773-4c22-a993-c5d99779a820",
      "tradeId": "7591debd-9dad-441b-bbde-3d2c5bf53875",
      "underlying": "QAG",
      "kind": "PositionChange",
      "positionChange": 97015,
      "momentDate": "2026-11-04"
    },
    {
      "debtId": "3c8423f1-e9d9-40c0-8b5f-52d5520784ee",
      "tradeId": "778a2c95-3caf-4165-bb22-5c87c55f8e72",
      "underlying": "MA",
      "kind": "PositionChange",
      "positionChange": 97016,
      "momentDate": "2026-11-04"
    },
    {
      "debtId": "0a13c57a-b0bc-4708-b55f-6146ff2da5bd",
      "tradeId": "313c387b-9b96-4159-9c0f-4f8fae6f8c1e",
      "underlying": "UNH",
      "kind": "PositionChange",
      "positionChange": 97017,
      "momentDate": "2026-11-04"
    },
    {
      "debtId": "7bf360db-9d1c-48e9-b547-22b5c04f5920",
      "tradeId": "f69ee396-1d00-4809-ad4e-076d9674430b",
      "underlying": "HD",
      "kind": "PositionChange",
      "positionChange": 97018,
      "momentDate": "2026-11-04"
    },
    {
      "debtId": "5f66e190-bba3-400f-a180-45ac2fdc35bf",
      "tradeId": "85cf7a6d-46ec-47e2-b786-317e36842593",
      "underlying": "XOM",
      "kind": "PositionChange",
      "positionChange": 97019,
      "momentDate": "2026-11-04"
    },
    {
      "debtId": "052171a8-0437-4234-b39f-83acffd6eb66",
      "tradeId": "d66c4132-4238-4f18-b8cf-0338e58c5610",
      "underlying": "CVX",
      "kind": "PositionChange",
      "positionChange": 97020,
      "momentDate": "2026-11-04"
    },
    {
      "debtId": "579be75d-97df-444d-a77a-013175c42a15",
      "tradeId": "21918c69-b1f5-4567-aa4a-98bd4c78d952",
      "underlying": "LLY",
      "kind": "PositionChange",
      "positionChange": 97021,
      "momentDate": "2026-11-04"
    },
    {
      "debtId": "7dd1fcc0-4cba-497b-95f7-51f2e1195bf6",
      "tradeId": "11d7f457-1012-417e-87ae-11340378d022",
      "underlying": "QAJ",
      "kind": "PositionChange",
      "positionChange": 97022,
      "momentDate": "2026-11-04"
    },
    {
      "debtId": "2cf098bf-ccbb-4017-8210-7182918ce337",
      "tradeId": "1b48efa9-a480-4f8d-8c95-026d2b046dac",
      "underlying": "QAK",
      "kind": "PositionChange",
      "positionChange": 97023,
      "momentDate": "2026-11-04"
    },
    {
      "debtId": "04bcf729-db4d-4c68-9567-2039a8ea4459",
      "tradeId": "7fbafb51-382d-4bc5-b5cb-5c3d7a077064",
      "underlying": "ABBV",
      "kind": "PositionChange",
      "positionChange": 97024,
      "momentDate": "2026-11-04"
    },
    {
      "debtId": "9fffbc30-d891-4316-846f-23698ddc8a15",
      "tradeId": "ea0c6894-2e80-4f4b-8a7f-249b4b0cebbd",
      "underlying": "MRK",
      "kind": "PositionChange",
      "positionChange": 97025,
      "momentDate": "2026-11-04"
    },
    {
      "debtId": "c230b74a-bb5d-4d71-a7a0-d0bf4abe3d8c",
      "tradeId": "ede1156e-daa0-4b4f-8484-e5abd0d81544",
      "underlying": "PEP",
      "kind": "PositionChange",
      "positionChange": 97026,
      "momentDate": "2026-11-04"
    },
    {
      "debtId": "b7cafaef-4f4e-41a4-9e7c-84568a7b4f53",
      "tradeId": "d290c2de-8cda-4acd-bb11-e3d8cdcb6883",
      "underlying": "ADBE",
      "kind": "PositionChange",
      "positionChange": 97027,
      "momentDate": "2026-11-04"
    },
    {
      "debtId": "670ef305-b936-48bc-99d2-512c8fef88e4",
      "tradeId": "7bbbaa3d-3648-4588-8f93-d6158da28b0d",
      "underlying": "CRM",
      "kind": "PositionChange",
      "positionChange": 97028,
      "momentDate": "2026-11-04"
    },
    {
      "debtId": "7b114d60-467b-40d6-a01d-afa6ea35b7c0",
      "tradeId": "13440bd8-8f05-4440-9d1d-b7ad6b70d830",
      "underlying": "ORCL",
      "kind": "PositionChange",
      "positionChange": 97029,
      "momentDate": "2026-11-04"
    },
    {
      "debtId": "07076875-65f1-4464-ad35-153b9428c2dc",
      "tradeId": "7d5aab57-3d0d-4f57-a447-aa905f432dcb",
      "underlying": "AMD",
      "kind": "PositionChange",
      "positionChange": 97030,
      "momentDate": "2026-11-04"
    },
    {
      "debtId": "7be34ec9-0b57-4897-898e-ce42d786f340",
      "tradeId": "0c67d711-604e-4780-b3c9-83aaa74d8a08",
      "underlying": "QAL",
      "kind": "PositionChange",
      "positionChange": 97031,
      "momentDate": "2026-11-04"
    },
    {
      "debtId": "433474c6-0be8-4c65-b4c6-1d3580f86618",
      "tradeId": "75ac56ce-768a-488f-86d7-8feb77a87526",
      "underlying": "QAM",
      "kind": "PositionChange",
      "positionChange": 97032,
      "momentDate": "2026-11-04"
    },
    {
      "debtId": "7f278804-93df-4674-b008-25588938d2d1",
      "tradeId": "ac21bd4d-7273-4208-8cff-448371178299",
      "underlying": "QAN",
      "kind": "PositionChange",
      "positionChange": 97033,
      "momentDate": "2026-11-04"
    },
    {
      "debtId": "ebb2c1ca-fd90-4558-998a-45c9867ddabc",
      "tradeId": "d9e23c31-45ac-4d56-88cb-d47c5483cdd9",
      "underlying": "INTC",
      "kind": "PositionChange",
      "positionChange": 97034,
      "momentDate": "2026-11-04"
    },
    {
      "debtId": "398a4b8f-df1c-4d59-a0bd-4c5b4067ee18",
      "tradeId": "929f38c8-71d9-4dd0-96b7-f710584b90e3",
      "underlying": "QCOM",
      "kind": "PositionChange",
      "positionChange": 97035,
      "momentDate": "2026-11-04"
    },
    {
      "debtId": "d52040b1-21d5-4151-92a4-a024db8884c5",
      "tradeId": "e8f54075-84bd-4dc1-bdca-7bcf96d6790c",
      "underlying": "TXN",
      "kind": "PositionChange",
      "positionChange": 97036,
      "momentDate": "2026-11-04"
    },
    {
      "debtId": "d456e734-5941-4f7d-9141-1c168bfd1008",
      "tradeId": "529a7b49-9a7b-4b18-9434-3a0cc99adacc",
      "underlying": "WMT",
      "kind": "PositionChange",
      "positionChange": 97037,
      "momentDate": "2026-11-04"
    },
    {
      "debtId": "39424d7d-673b-455b-99fd-2f074a0fbcdf",
      "tradeId": "31859212-8535-4301-b82b-f86aab2a4d9a",
      "underlying": "DIS",
      "kind": "PositionChange",
      "positionChange": 97038,
      "momentDate": "2026-11-04"
    },
    {
      "debtId": "10100b4c-e8ce-4ef4-9dcd-f5a993a2e244",
      "tradeId": "2cab88f0-aa36-46d8-9c8c-cddfe548d84b",
      "underlying": "NKE",
      "kind": "PositionChange",
      "positionChange": 97039,
      "momentDate": "2026-11-04"
    },
    {
      "debtId": "3cfe331e-b975-431a-9e98-4ecb16caa30e",
      "tradeId": "52069b82-1d13-46fa-b57a-d79b119657c7",
      "underlying": "MCD",
      "kind": "PositionChange",
      "positionChange": 97040,
      "momentDate": "2026-11-04"
    },
    {
      "debtId": "cc27a6cf-be3b-4167-8398-55770a9b2dba",
      "tradeId": "5e71e69c-aded-4757-b751-b5f21b576ca8",
      "underlying": "QAO",
      "kind": "PositionChange",
      "positionChange": 97041,
      "momentDate": "2026-11-04"
    },
    {
      "debtId": "a1ad033c-dd2d-4dcf-8bec-7ecc4bbb467c",
      "tradeId": "a73e4605-2085-47be-9016-119d78e21964",
      "underlying": "QAP",
      "kind": "PositionChange",
      "positionChange": 97042,
      "momentDate": "2026-11-04"
    },
    {
      "debtId": "9e40f3b2-d9ba-44e1-9abd-37670c86c8f6",
      "tradeId": "1b5b41f8-7f9f-4b06-a5bf-43ffd122f041",
      "underlying": "QAQ",
      "kind": "PositionChange",
      "positionChange": 97043,
      "momentDate": "2026-11-04"
    },
    {
      "debtId": "655f6438-e000-47ae-bba5-ed319d458694",
      "tradeId": "298f4193-0549-4ec8-b18a-54f55478ddfa",
      "underlying": "BA",
      "kind": "PositionChange",
      "positionChange": 97044,
      "momentDate": "2026-11-04"
    },
    {
      "debtId": "6f512dab-7ba2-4fca-ae74-c280227e2f61",
      "tradeId": "4e9db26d-b439-48f3-b0f2-fe3d7a0cecc7",
      "underlying": "CAT",
      "kind": "PositionChange",
      "positionChange": 97045,
      "momentDate": "2026-11-04"
    },
    {
      "debtId": "8d4f852b-87a1-4762-987f-0df5dade344e",
      "tradeId": "21c54b7e-74f0-40b4-b5a9-498f053dbd20",
      "underlying": "DE",
      "kind": "PositionChange",
      "positionChange": 97046,
      "momentDate": "2026-11-04"
    },
    {
      "debtId": "0c27112e-5b2f-4dff-86f8-02df3dccdd59",
      "tradeId": "9ee56dfa-bce3-4450-ae35-1b0a21c201d1",
      "underlying": "GS",
      "kind": "PositionChange",
      "positionChange": 97047,
      "momentDate": "2026-11-04"
    },
    {
      "debtId": "c2e50b9a-1f4a-4088-9c78-5b14ba1cbca8",
      "tradeId": "2fb70863-bb9a-448d-bd89-eda3ba4ecabe",
      "underlying": "QAA",
      "kind": "PositionChange",
      "positionChange": 97048,
      "momentDate": "2026-11-04"
    },
    {
      "debtId": "267d79d5-c14f-416f-9519-c8db5642f63c",
      "tradeId": "357d7d78-aef1-4716-8e4a-5622d54d3686",
      "underlying": "QAB",
      "kind": "PositionChange",
      "positionChange": 97049,
      "momentDate": "2026-11-04"
    },
    {
      "debtId": "62d2dffd-bafe-4830-8ff0-5bf7123674cc",
      "tradeId": "e8774cbd-25ff-4c94-805c-655365810b84",
      "underlying": "QAC",
      "kind": "PositionChange",
      "positionChange": 97050,
      "momentDate": "2026-11-04"
    },
    {
      "debtId": "9ae169f9-9c3e-4739-a3a9-86f3a97a3b6d",
      "tradeId": "1900e77f-24cd-490f-ad4d-dbea676ba4d6",
      "underlying": "QAR",
      "kind": "PositionChange",
      "positionChange": 97051,
      "momentDate": "2026-11-04"
    },
    {
      "debtId": "afdca396-9081-43f9-92c7-8f29aa28062c",
      "tradeId": "0956e929-94fb-472d-81e3-5102040f5fb8",
      "underlying": "QAS",
      "kind": "PositionChange",
      "positionChange": 97052,
      "momentDate": "2026-11-04"
    },
    {
      "debtId": "77f3e910-ab36-4792-99b4-9015d81d0c70",
      "tradeId": "756828f5-8892-49a3-87af-bb7bf47f9fc0",
      "underlying": "QAT",
      "kind": "PositionChange",
      "positionChange": 97053,
      "momentDate": "2026-11-04"
    },
    {
      "debtId": "aa9b9da6-a7e3-4514-8cdb-1b31f49fb2b9",
      "tradeId": "2b897b59-9a40-41b9-b4ec-6b7ca348541b",
      "underlying": "QAD",
      "kind": "PositionChange",
      "positionChange": 97054,
      "momentDate": "2026-11-04"
    },
    {
      "debtId": "722f3aad-669e-44a7-a60c-0d74ece26832",
      "tradeId": "b165a4c0-1d78-436d-9ab7-2e775a13d505",
      "underlying": "QAE",
      "kind": "PositionChange",
      "positionChange": 97055,
      "momentDate": "2026-11-04"
    },
    {
      "debtId": "2d60ca18-2098-4181-9faa-8e37430929c0",
      "tradeId": "d03edb61-1d2c-43f5-b9af-958659b49bf9",
      "underlying": "QAF",
      "kind": "PositionChange",
      "positionChange": 97056,
      "momentDate": "2026-11-04"
    },
    {
      "debtId": "0503bfde-9c02-46fe-a657-febec5ca9d10",
      "tradeId": "96e97d77-4343-4bd0-888e-7b18201fd256",
      "underlying": "JPM",
      "kind": "PositionChange",
      "positionChange": 97057,
      "momentDate": "2026-11-05"
    },
    {
      "debtId": "dd0d9d25-0c1c-456d-ae20-815a7ecb2b53",
      "tradeId": "96e97d77-4343-4bd0-888e-7b18201fd256",
      "underlying": "JPM",
      "kind": "CloseReview",
      "positionChange": 24686,
      "momentDate": "2026-11-05"
    },
    {
      "debtId": "b3caa1a2-d912-403e-bc70-22df6bb20f5d",
      "tradeId": "be25b24a-d623-4f1a-81b8-4bcbe1974f92",
      "underlying": "ADBE",
      "kind": "PositionChange",
      "positionChange": 97058,
      "momentDate": "2026-11-05"
    },
    {
      "debtId": "11732658-8126-4968-bf61-b83f74375e0c",
      "tradeId": "be25b24a-d623-4f1a-81b8-4bcbe1974f92",
      "underlying": "ADBE",
      "kind": "CloseReview",
      "positionChange": 24687,
      "momentDate": "2026-11-05"
    },
    {
      "debtId": "9c1b7650-7e4b-4b4f-8cb6-3fb37dbbb120",
      "tradeId": "30ec5869-cf70-4367-ad8e-47fe33f04c7e",
      "underlying": "NKE",
      "kind": "PositionChange",
      "positionChange": 97059,
      "momentDate": "2026-11-05"
    },
    {
      "debtId": "c2061a6d-e574-4c28-b0cb-29bbec4aadf2",
      "tradeId": "30ec5869-cf70-4367-ad8e-47fe33f04c7e",
      "underlying": "NKE",
      "kind": "CloseReview",
      "positionChange": 24688,
      "momentDate": "2026-11-05"
    },
    {
      "debtId": "cb4c20d2-d10d-43a6-9cc4-681f6a505053",
      "tradeId": "8ede93d2-4620-45d4-890b-7f1ccc4a6c81",
      "underlying": "CAT",
      "kind": "PositionChange",
      "positionChange": 97060,
      "momentDate": "2026-11-05"
    },
    {
      "debtId": "73299635-3610-4efe-9dc9-15b66ed69a4b",
      "tradeId": "8ede93d2-4620-45d4-890b-7f1ccc4a6c81",
      "underlying": "CAT",
      "kind": "CloseReview",
      "positionChange": 24689,
      "momentDate": "2026-11-05"
    },
    {
      "debtId": "3b693c2e-aca4-4361-b402-b89953dff53a",
      "tradeId": "005c6f55-46a8-4dde-b101-f4ed9a7cd1eb",
      "underlying": "TSLA",
      "kind": "PositionChange",
      "positionChange": 97061,
      "momentDate": "2026-11-05"
    },
    {
      "debtId": "bd159397-01e2-4c77-b44d-e358f63f98e2",
      "tradeId": "cede4d72-19b8-4f48-a934-640af69bd94e",
      "underlying": "NFLX",
      "kind": "PositionChange",
      "positionChange": 97062,
      "momentDate": "2026-11-05"
    },
    {
      "debtId": "a85ea4d6-c68e-4b2f-bdfd-c747dc099447",
      "tradeId": "4cc00063-c782-49a5-9590-cb6351fe1fe5",
      "underlying": "V",
      "kind": "PositionChange",
      "positionChange": 97063,
      "momentDate": "2026-11-05"
    },
    {
      "debtId": "e4f2f5c3-b200-4929-a2f8-2d0897143fe1",
      "tradeId": "4cc00063-c782-49a5-9590-cb6351fe1fe5",
      "underlying": "V",
      "kind": "CloseReview",
      "positionChange": 24690,
      "momentDate": "2026-11-05"
    },
    {
      "debtId": "613145a9-0f0c-46a0-99bc-bacc92c42928",
      "tradeId": "4a29ca86-2526-42ed-af96-55ed4f4913a8",
      "underlying": "HD",
      "kind": "PositionChange",
      "positionChange": 97064,
      "momentDate": "2026-11-05"
    },
    {
      "debtId": "ba42395d-4a16-4ee4-a102-c4702208c69d",
      "tradeId": "4a29ca86-2526-42ed-af96-55ed4f4913a8",
      "underlying": "HD",
      "kind": "CloseReview",
      "positionChange": 24691,
      "momentDate": "2026-11-05"
    },
    {
      "debtId": "bf9a8274-9199-4c9f-b9d3-a00f21e6fc84",
      "tradeId": "43097398-fa27-4395-a41f-362651f63e55",
      "underlying": "PG",
      "kind": "PositionChange",
      "positionChange": 97065,
      "momentDate": "2026-11-05"
    },
    {
      "debtId": "d13a4ab0-7f1c-4026-842b-aa3f068c6ff1",
      "tradeId": "313abb62-763b-41be-b01b-66e18acbb54a",
      "underlying": "QBV",
      "kind": "PositionChange",
      "positionChange": 97066,
      "momentDate": "2026-11-05"
    },
    {
      "debtId": "4b4031c2-711c-4814-84ff-d2369296276f",
      "tradeId": "44339297-1d29-45f1-b278-d5e3717e36ca",
      "underlying": "GS",
      "kind": "PositionChange",
      "positionChange": 97067,
      "momentDate": "2026-11-05"
    },
    {
      "debtId": "98954168-28c5-4bb6-840c-d22ca0331ed4",
      "tradeId": "a718055e-2b61-4bbf-b78b-4bf7aa3c2089",
      "underlying": "NVDA",
      "kind": "PositionChange",
      "positionChange": 97068,
      "momentDate": "2026-11-05"
    },
    {
      "debtId": "c1111efc-0d6c-406f-8059-122495c4f378",
      "tradeId": "22a90a65-d634-4575-80be-3f5494448f72",
      "underlying": "TSLA",
      "kind": "PositionChange",
      "positionChange": 97069,
      "momentDate": "2026-11-05"
    },
    {
      "debtId": "f67750d0-0a8a-48cb-9e53-44bf3a8f95d0",
      "tradeId": "f5bc3445-2801-4274-97ef-8b82c7d7003e",
      "underlying": "QAE",
      "kind": "PositionChange",
      "positionChange": 97070,
      "momentDate": "2026-11-05"
    },
    {
      "debtId": "c627e0fa-6929-41e3-b65c-dbc2d44a44fa",
      "tradeId": "3f9dcaa0-865f-475f-aafb-f0e1f3b8966c",
      "underlying": "KO",
      "kind": "PositionChange",
      "positionChange": 97071,
      "momentDate": "2026-11-05"
    },
    {
      "debtId": "1a0ae9fd-7ccb-4e03-a956-2e620dbbc483",
      "tradeId": "2f41e12b-787d-4faf-b579-ddc734121294",
      "underlying": "QAF",
      "kind": "PositionChange",
      "positionChange": 97072,
      "momentDate": "2026-11-05"
    },
    {
      "debtId": "0008b191-e6e3-4c7f-a287-29add1db08d9",
      "tradeId": "313c387b-9b96-4159-9c0f-4f8fae6f8c1e",
      "underlying": "UNH",
      "kind": "PositionChange",
      "positionChange": 97073,
      "momentDate": "2026-11-05"
    },
    {
      "debtId": "685dbc4d-14fd-451d-ad07-cd13b09cb799",
      "tradeId": "d66c4132-4238-4f18-b8cf-0338e58c5610",
      "underlying": "CVX",
      "kind": "PositionChange",
      "positionChange": 97074,
      "momentDate": "2026-11-05"
    },
    {
      "debtId": "bb0bfa22-9e97-41e0-be59-04de022d70e6",
      "tradeId": "11d7f457-1012-417e-87ae-11340378d022",
      "underlying": "QAJ",
      "kind": "PositionChange",
      "positionChange": 97075,
      "momentDate": "2026-11-05"
    },
    {
      "debtId": "798a1890-1a6e-418f-8fd6-04b909559b70",
      "tradeId": "1b48efa9-a480-4f8d-8c95-026d2b046dac",
      "underlying": "QAK",
      "kind": "PositionChange",
      "positionChange": 97076,
      "momentDate": "2026-11-05"
    },
    {
      "debtId": "ca92c1d4-8ce5-4c57-b1a9-4bd12c5ca34d",
      "tradeId": "7fbafb51-382d-4bc5-b5cb-5c3d7a077064",
      "underlying": "ABBV",
      "kind": "PositionChange",
      "positionChange": 97077,
      "momentDate": "2026-11-05"
    },
    {
      "debtId": "56cfdb79-ea77-47e0-95ca-7bff91243691",
      "tradeId": "ede1156e-daa0-4b4f-8484-e5abd0d81544",
      "underlying": "PEP",
      "kind": "PositionChange",
      "positionChange": 97078,
      "momentDate": "2026-11-05"
    },
    {
      "debtId": "de394387-58b2-44cd-82b8-bc662ba22390",
      "tradeId": "d290c2de-8cda-4acd-bb11-e3d8cdcb6883",
      "underlying": "ADBE",
      "kind": "PositionChange",
      "positionChange": 97079,
      "momentDate": "2026-11-05"
    },
    {
      "debtId": "5a3e067a-5ede-4d71-851b-bb0547ab0bb8",
      "tradeId": "7bbbaa3d-3648-4588-8f93-d6158da28b0d",
      "underlying": "CRM",
      "kind": "PositionChange",
      "positionChange": 97080,
      "momentDate": "2026-11-05"
    },
    {
      "debtId": "1497de03-ce3e-4fe8-a490-43b1b64714f9",
      "tradeId": "7d5aab57-3d0d-4f57-a447-aa905f432dcb",
      "underlying": "AMD",
      "kind": "PositionChange",
      "positionChange": 97081,
      "momentDate": "2026-11-05"
    },
    {
      "debtId": "713d7e85-cd05-4bff-943b-fe4fa47d7abf",
      "tradeId": "0c67d711-604e-4780-b3c9-83aaa74d8a08",
      "underlying": "QAL",
      "kind": "PositionChange",
      "positionChange": 97082,
      "momentDate": "2026-11-05"
    },
    {
      "debtId": "00704144-6864-4c8d-9fe6-1238989de6a4",
      "tradeId": "75ac56ce-768a-488f-86d7-8feb77a87526",
      "underlying": "QAM",
      "kind": "PositionChange",
      "positionChange": 97083,
      "momentDate": "2026-11-05"
    },
    {
      "debtId": "413e2134-37d8-471e-b88d-1f728b483be7",
      "tradeId": "d9e23c31-45ac-4d56-88cb-d47c5483cdd9",
      "underlying": "INTC",
      "kind": "PositionChange",
      "positionChange": 97084,
      "momentDate": "2026-11-05"
    },
    {
      "debtId": "09fd67f9-a8f7-41c5-9939-cdbde54de6cd",
      "tradeId": "929f38c8-71d9-4dd0-96b7-f710584b90e3",
      "underlying": "QCOM",
      "kind": "PositionChange",
      "positionChange": 97085,
      "momentDate": "2026-11-05"
    },
    {
      "debtId": "1c116339-adb7-466d-a132-de3f8b10f2b2",
      "tradeId": "e8f54075-84bd-4dc1-bdca-7bcf96d6790c",
      "underlying": "TXN",
      "kind": "PositionChange",
      "positionChange": 97086,
      "momentDate": "2026-11-05"
    },
    {
      "debtId": "752f8c88-5227-47d6-b2ee-3a9a9542aa92",
      "tradeId": "31859212-8535-4301-b82b-f86aab2a4d9a",
      "underlying": "DIS",
      "kind": "PositionChange",
      "positionChange": 97087,
      "momentDate": "2026-11-05"
    },
    {
      "debtId": "852eb0bc-2eec-4778-9216-715e685255d8",
      "tradeId": "2cab88f0-aa36-46d8-9c8c-cddfe548d84b",
      "underlying": "NKE",
      "kind": "PositionChange",
      "positionChange": 97088,
      "momentDate": "2026-11-05"
    },
    {
      "debtId": "b8b1cd90-af4f-49fc-ad97-66623199be7c",
      "tradeId": "52069b82-1d13-46fa-b57a-d79b119657c7",
      "underlying": "MCD",
      "kind": "PositionChange",
      "positionChange": 97089,
      "momentDate": "2026-11-05"
    },
    {
      "debtId": "68658653-9ffa-4d1a-a3cc-719d4f2be67c",
      "tradeId": "a73e4605-2085-47be-9016-119d78e21964",
      "underlying": "QAP",
      "kind": "PositionChange",
      "positionChange": 97090,
      "momentDate": "2026-11-05"
    },
    {
      "debtId": "e88150cd-80a2-47ef-b77a-d8d6cd1f1882",
      "tradeId": "1b5b41f8-7f9f-4b06-a5bf-43ffd122f041",
      "underlying": "QAQ",
      "kind": "PositionChange",
      "positionChange": 97091,
      "momentDate": "2026-11-05"
    },
    {
      "debtId": "6d0ac4ea-5ea5-4f19-9673-83bd1c5002cd",
      "tradeId": "298f4193-0549-4ec8-b18a-54f55478ddfa",
      "underlying": "BA",
      "kind": "PositionChange",
      "positionChange": 97092,
      "momentDate": "2026-11-05"
    },
    {
      "debtId": "33be753f-e500-4b1d-84c4-b3013780570d",
      "tradeId": "21c54b7e-74f0-40b4-b5a9-498f053dbd20",
      "underlying": "DE",
      "kind": "PositionChange",
      "positionChange": 97093,
      "momentDate": "2026-11-05"
    },
    {
      "debtId": "e76e4880-54b3-485d-9212-dc1d40a401f0",
      "tradeId": "9ee56dfa-bce3-4450-ae35-1b0a21c201d1",
      "underlying": "GS",
      "kind": "PositionChange",
      "positionChange": 97094,
      "momentDate": "2026-11-05"
    },
    {
      "debtId": "459f1b5c-baba-4136-9e4e-adbbff7605f3",
      "tradeId": "2fb70863-bb9a-448d-bd89-eda3ba4ecabe",
      "underlying": "QAA",
      "kind": "PositionChange",
      "positionChange": 97095,
      "momentDate": "2026-11-05"
    },
    {
      "debtId": "8ddc6e44-17e6-4441-bae2-8bbeff7390c9",
      "tradeId": "e8774cbd-25ff-4c94-805c-655365810b84",
      "underlying": "QAC",
      "kind": "PositionChange",
      "positionChange": 97096,
      "momentDate": "2026-11-05"
    },
    {
      "debtId": "ad09c5f7-8631-47fe-b846-aee07a5d4432",
      "tradeId": "1900e77f-24cd-490f-ad4d-dbea676ba4d6",
      "underlying": "QAR",
      "kind": "PositionChange",
      "positionChange": 97097,
      "momentDate": "2026-11-05"
    },
    {
      "debtId": "c619a2d2-bd6e-4302-9ad9-4f2ffd1759fc",
      "tradeId": "0956e929-94fb-472d-81e3-5102040f5fb8",
      "underlying": "QAS",
      "kind": "PositionChange",
      "positionChange": 97098,
      "momentDate": "2026-11-05"
    },
    {
      "debtId": "15533e18-d391-4c2b-ac59-374a2f0ff00c",
      "tradeId": "2b897b59-9a40-41b9-b4ec-6b7ca348541b",
      "underlying": "QAD",
      "kind": "PositionChange",
      "positionChange": 97099,
      "momentDate": "2026-11-05"
    },
    {
      "debtId": "ffe0f2bb-6d86-4a51-82f1-fe13f7bb8158",
      "tradeId": "b165a4c0-1d78-436d-9ab7-2e775a13d505",
      "underlying": "QAE",
      "kind": "PositionChange",
      "positionChange": 97100,
      "momentDate": "2026-11-05"
    },
    {
      "debtId": "e3b04f9c-0073-4a94-92ec-241488c8de3a",
      "tradeId": "d03edb61-1d2c-43f5-b9af-958659b49bf9",
      "underlying": "QAF",
      "kind": "PositionChange",
      "positionChange": 97101,
      "momentDate": "2026-11-05"
    },
    {
      "debtId": "9cf16574-c931-477b-a1d6-42953ce8e789",
      "tradeId": "d2ef8d42-baec-49bb-94f8-b55798553236",
      "underlying": "QAG",
      "kind": "PositionChange",
      "positionChange": 97102,
      "momentDate": "2026-11-05"
    },
    {
      "debtId": "3fe41ef5-960a-446b-8995-4120932f8523",
      "tradeId": "9dfc371a-9b48-46bf-a7a5-8b280a73426e",
      "underlying": "QAH",
      "kind": "PositionChange",
      "positionChange": 97103,
      "momentDate": "2026-11-05"
    },
    {
      "debtId": "adfa65a8-60f2-410f-a6ac-7b2495eb4f1e",
      "tradeId": "c323a517-b034-404e-9375-ea121f51d269",
      "underlying": "QAI",
      "kind": "PositionChange",
      "positionChange": 97104,
      "momentDate": "2026-11-05"
    },
    {
      "debtId": "0833940d-0f9c-4e38-ae3c-7f720bb97910",
      "tradeId": "9c16e445-3d78-4ca2-abc3-144c771ebf6e",
      "underlying": "QAJ",
      "kind": "PositionChange",
      "positionChange": 97105,
      "momentDate": "2026-11-05"
    },
    {
      "debtId": "3eb6de24-d820-4ea7-8257-9e4edc5ebfbe",
      "tradeId": "005c6f55-46a8-4dde-b101-f4ed9a7cd1eb",
      "underlying": "TSLA",
      "kind": "PositionChange",
      "positionChange": 97106,
      "momentDate": "2026-11-06"
    },
    {
      "debtId": "4243aac6-0b8a-4df4-9389-a6680f1ae927",
      "tradeId": "005c6f55-46a8-4dde-b101-f4ed9a7cd1eb",
      "underlying": "TSLA",
      "kind": "CloseReview",
      "positionChange": 24692,
      "momentDate": "2026-11-06"
    },
    {
      "debtId": "031c4ed2-b4da-4258-8373-f7f4b4770c70",
      "tradeId": "cede4d72-19b8-4f48-a934-640af69bd94e",
      "underlying": "NFLX",
      "kind": "PositionChange",
      "positionChange": 97107,
      "momentDate": "2026-11-06"
    },
    {
      "debtId": "5b861a02-bdb3-49e0-a35c-de48d334d4b0",
      "tradeId": "cede4d72-19b8-4f48-a934-640af69bd94e",
      "underlying": "NFLX",
      "kind": "CloseReview",
      "positionChange": 24693,
      "momentDate": "2026-11-06"
    },
    {
      "debtId": "f37100ba-71c3-4c68-844f-c0a0462c436a",
      "tradeId": "43097398-fa27-4395-a41f-362651f63e55",
      "underlying": "PG",
      "kind": "PositionChange",
      "positionChange": 97108,
      "momentDate": "2026-11-06"
    },
    {
      "debtId": "b317d5c8-d019-4c80-ae1b-962eb0e3dd0b",
      "tradeId": "43097398-fa27-4395-a41f-362651f63e55",
      "underlying": "PG",
      "kind": "CloseReview",
      "positionChange": 24694,
      "momentDate": "2026-11-06"
    },
    {
      "debtId": "fe5a1847-8c33-4dbf-a841-8b5bab1e3bf5",
      "tradeId": "1b48efa9-a480-4f8d-8c95-026d2b046dac",
      "underlying": "QAK",
      "kind": "PositionChange",
      "positionChange": 97109,
      "momentDate": "2026-11-06"
    },
    {
      "debtId": "812cd6b8-3eb7-4ea0-a11c-ab4b045df7d2",
      "tradeId": "d290c2de-8cda-4acd-bb11-e3d8cdcb6883",
      "underlying": "ADBE",
      "kind": "PositionChange",
      "positionChange": 97110,
      "momentDate": "2026-11-06"
    },
    {
      "debtId": "81762243-bf3d-4808-bc42-27841e5f24b4",
      "tradeId": "0c67d711-604e-4780-b3c9-83aaa74d8a08",
      "underlying": "QAL",
      "kind": "PositionChange",
      "positionChange": 97111,
      "momentDate": "2026-11-06"
    },
    {
      "debtId": "b511283f-e57f-47ff-871b-c60dbc9e3cd9",
      "tradeId": "929f38c8-71d9-4dd0-96b7-f710584b90e3",
      "underlying": "QCOM",
      "kind": "PositionChange",
      "positionChange": 97112,
      "momentDate": "2026-11-06"
    },
    {
      "debtId": "b90b3aff-03a8-465f-80bf-7a3b74081138",
      "tradeId": "2cab88f0-aa36-46d8-9c8c-cddfe548d84b",
      "underlying": "NKE",
      "kind": "PositionChange",
      "positionChange": 97113,
      "momentDate": "2026-11-06"
    },
    {
      "debtId": "3d396db2-fac6-4e7f-bd6d-441144ebc549",
      "tradeId": "1b5b41f8-7f9f-4b06-a5bf-43ffd122f041",
      "underlying": "QAQ",
      "kind": "PositionChange",
      "positionChange": 97114,
      "momentDate": "2026-11-06"
    },
    {
      "debtId": "e8347913-fd23-4320-a11c-ffd015ae1dc3",
      "tradeId": "9ee56dfa-bce3-4450-ae35-1b0a21c201d1",
      "underlying": "GS",
      "kind": "PositionChange",
      "positionChange": 97115,
      "momentDate": "2026-11-06"
    },
    {
      "debtId": "8a94250d-938f-4730-aec2-6adea23e2078",
      "tradeId": "1900e77f-24cd-490f-ad4d-dbea676ba4d6",
      "underlying": "QAR",
      "kind": "PositionChange",
      "positionChange": 97116,
      "momentDate": "2026-11-06"
    },
    {
      "debtId": "f719d641-eca9-47b9-9cea-ceec6eb132fd",
      "tradeId": "b165a4c0-1d78-436d-9ab7-2e775a13d505",
      "underlying": "QAE",
      "kind": "PositionChange",
      "positionChange": 97117,
      "momentDate": "2026-11-06"
    },
    {
      "debtId": "24f7eaee-e270-40ec-b627-df53c741244c",
      "tradeId": "9dfc371a-9b48-46bf-a7a5-8b280a73426e",
      "underlying": "QAH",
      "kind": "PositionChange",
      "positionChange": 97118,
      "momentDate": "2026-11-06"
    },
    {
      "debtId": "e1de8d51-67e4-4a83-acd3-889538ce243e",
      "tradeId": "c323a517-b034-404e-9375-ea121f51d269",
      "underlying": "QAI",
      "kind": "PositionChange",
      "positionChange": 97119,
      "momentDate": "2026-11-06"
    },
    {
      "debtId": "c4d306d0-6260-4dad-a174-b640a5daec2b",
      "tradeId": "9c16e445-3d78-4ca2-abc3-144c771ebf6e",
      "underlying": "QAJ",
      "kind": "PositionChange",
      "positionChange": 97120,
      "momentDate": "2026-11-06"
    },
    {
      "debtId": "25ed07d5-f01e-439f-90d1-28f9d2cfc978",
      "tradeId": "cdca9874-229f-4253-9576-9163d0fe08f6",
      "underlying": "CSCO",
      "kind": "PositionChange",
      "positionChange": 97121,
      "momentDate": "2026-11-06"
    },
    {
      "debtId": "4a7e16b7-8908-4ace-92f2-10fce0b88d03",
      "tradeId": "cdca9874-229f-4253-9576-9163d0fe08f6",
      "underlying": "CSCO",
      "kind": "CloseReview",
      "positionChange": 24695,
      "momentDate": "2026-11-06"
    },
    {
      "debtId": "168dbbe1-a5ce-4fde-894a-cd0a4423ba6a",
      "tradeId": "b2b099c2-1c51-474e-958d-7b71febf3f6c",
      "underlying": "ABBV",
      "kind": "PositionChange",
      "positionChange": 97122,
      "momentDate": "2026-11-06"
    },
    {
      "debtId": "403d879e-29bb-4e8d-a5b5-2f98c6111ca6",
      "tradeId": "b2b099c2-1c51-474e-958d-7b71febf3f6c",
      "underlying": "ABBV",
      "kind": "CloseReview",
      "positionChange": 24696,
      "momentDate": "2026-11-06"
    },
    {
      "debtId": "d536fcaa-cd45-492f-9a5c-a7f43d8ca282",
      "tradeId": "653c57db-f8c9-42d6-bb4b-769da19956f0",
      "underlying": "QCOM",
      "kind": "PositionChange",
      "positionChange": 97123,
      "momentDate": "2026-11-06"
    },
    {
      "debtId": "b2cecb70-e979-42ff-b05d-f04ec08845fb",
      "tradeId": "653c57db-f8c9-42d6-bb4b-769da19956f0",
      "underlying": "QCOM",
      "kind": "CloseReview",
      "positionChange": 24697,
      "momentDate": "2026-11-06"
    },
    {
      "debtId": "5b2f7c83-d850-48ed-9709-45f52f5a4260",
      "tradeId": "42340328-6781-470a-9952-bde8fecbea8d",
      "underlying": "MSFT",
      "kind": "PositionChange",
      "positionChange": 97124,
      "momentDate": "2026-11-06"
    },
    {
      "debtId": "30c07e9f-74aa-4815-934c-1c37c3e788d2",
      "tradeId": "42340328-6781-470a-9952-bde8fecbea8d",
      "underlying": "MSFT",
      "kind": "CloseReview",
      "positionChange": 24698,
      "momentDate": "2026-11-06"
    },
    {
      "debtId": "1503bad1-dd5b-4a3d-aa90-dd46e3e7e66a",
      "tradeId": "912eb056-4b9f-4c08-a583-7c544d487008",
      "underlying": "NVDA",
      "kind": "PositionChange",
      "positionChange": 97125,
      "momentDate": "2026-11-06"
    },
    {
      "debtId": "1a35c083-9f6e-4449-b273-67ee61c514fe",
      "tradeId": "912eb056-4b9f-4c08-a583-7c544d487008",
      "underlying": "NVDA",
      "kind": "CloseReview",
      "positionChange": 24699,
      "momentDate": "2026-11-06"
    },
    {
      "debtId": "d158a70d-72bc-4696-9137-4a69a9663eae",
      "tradeId": "c323a517-b034-404e-9375-ea121f51d269",
      "underlying": "QAI",
      "kind": "PositionChange",
      "positionChange": 97126,
      "momentDate": "2026-11-09"
    }
  ],
  "generationMs": 17478432,
  "generatedAt": "2026-11-12T14:28:09.140Z",
  "engine": "chromium 153.0.8010.12",
  "host": {
    "platform": "darwin",
    "release": "25.6.0",
    "arch": "arm64",
    "cpu": "Apple M4 Max",
    "cores": 16
  },
  "profileDir": ".cache/bench/profile",
  "expectedOpenRows": "bench/expected-open-rows.json"
}
```

## Against D7SP r3 (T7S.14)

`bench:run` at head a4b84749 (generator 7, schema 7, A203's option-price mix), started 2026-11-12 09:32:53 EST and finished 09:33:27 EST (one run, cached profile reused, no regeneration). Compared with `evidence/D07SP/bench-r3.md` (generator 6, schema 6). A negative change is faster. Every step is "within 10%" (faster, equal or at most 5.2% slower), except the three marked faster by more than 10%, which are also within the gate. None is 10% or more slower.

| Measure | r3 | T7S.14 | Change | Mark |
|---|---|---|---|---|
| Gated cold start p95 | 136.5 ms | 130.0 ms | -4.8% | within 10% |
| Gated warm switch p95 | 64.9 ms | 63.5 ms | -2.2% | within 10% |
| Review status, before the runs | 321 ms | 322 ms | +0.3% | within 10% |
| Review status, after the runs | 332 ms | 293 ms | -11.7% | within 10% (faster) |
| First card, median | 268.1 ms | 272.4 ms | +1.6% | within 10% |
| First card, p95 | 288.7 ms | 302.8 ms | +4.9% | within 10% |
| Save Marks, median | 216.1 ms | 193.5 ms | -10.5% | within 10% (faster) |
| Save Marks, p95 | 219.3 ms | 217.5 ms | -0.8% | within 10% |
| Trade Action save, median | 193.3 ms | 189.0 ms | -2.2% | within 10% |
| Trade Action save, p95 | 243.4 ms | 191.7 ms | -21.2% | within 10% (faster) |
| Closed page, median | 113.0 ms | 114.0 ms | +0.9% | within 10% |
| Closed page, p95 | 116.0 ms | 122.0 ms | +5.2% | within 10% |
| Daily Trade Review Action save, warm, median | 193.3 ms | 189.0 ms | -2.2% | within 10% |
| Daily Trade Review Action save, warm, p95 | 243.4 ms | 191.7 ms | -21.2% | within 10% |
| Daily Trade Review Action save, cold, median | 227.2 ms | 227.2 ms | 0.0% | within 10% |
| Daily Trade Review Action save, cold, p95 | 229.2 ms | 227.3 ms | -0.8% | within 10% |

Gate result: no step is 10% or more slower than r3; the tech debt item 22 trigger does not fire for this run.

Notes:
- The dataset differs from r3's: generator 7 with A203's option-price mix (750 option Plans hold only option-price conditions, 2,250 an option-price Stop beside the Underlying Stop) versus generator 6. Counts and lifecycles are unchanged.
- No control run was made (skipped at the user's direction, 2026-11-12: the generator-6 profile was replaced by the regeneration), so machine drift is unknown.
- The generation itself ran at 24.0 s per session (17,478 s for 726 sessions) against D7's 12.7 s per session at T7.28.
- CPU before the run (`top -l 2 -n 5 -o cpu`, 09:32): Activity Monitor 91.3%, Google Chrome Helper 37.0%, WindowServer 9.4%, kernel_task 7.4%. After the run (09:34): Activity Monitor 91.4%, WindowServer 8.4%, kernel_task 8.3%, WallpaperAerials 7.9%. Activity Monitor holds about one core throughout; the user's Playwright Firefox Nightly was idle and left alone.
