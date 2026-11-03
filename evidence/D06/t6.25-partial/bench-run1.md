# D6 benchmark run (AC-PERF-001)

Written by `npm run bench:run` (T2.21, extended by T4.31, T5.22, T5R.13 and T6.25) on 2026-11-03T14:22:36.959Z, at commit 2120a29f4b2dc6a04c036838ccc207cd4d875661.

## Result

| Measure | Runs | Nearest-rank p95 (29th of 30) | Budget | Result |
|---|---|---|---|---|
| Cold start to `tj:interactive` | 30 | 256.0 ms | 2,500 ms | pass |
| Warm Planned-to-Open switch to `tj:open-list-ready` | 30 | 211.2 ms | 1,500 ms | pass |

**PARTIAL DATASET (user decision of 2026-11-03).** Generation (generator 5) was stopped by SIGTERM at session 784 of 1,255 (2027-02-17) because a Review save grows with the stored history. This run is on that snapshot (`.cache/bench/partial-v5-s775/profile`, untouched; the run uses a copy with the service worker and caches stripped, `.cache/bench/partial-v5-s775/run-profile`). The as-of instant is the last session's close plus 35 minutes, 2027-02-17T21:35:00Z, derived from the stored Review Actions. The last session's Review is incomplete: 18 of its 99 walked Trades have their Action. The AC-PERF-001 D6 row is therefore partial, not covered, until a full rerun.

| Record kind | Plan section 1.4 at D6 | This partial dataset |
|---|---|---|
| Sessions | 1,255 | 784 |
| Trades | 25,000 | 15,743 |
| Closed | 24,700 | 15,624 |
| Open | 200 | 99 |
| Planned | 100 | 20 |
| Position Changes | about 100,000 | 62,683 |
| Executions | about 200,000 | 125,340 |
| Close Reasons | 24,700 | 15,624 |
| Position Change Reflection outcomes (entries + declines) | about 100,000 | 62,648 |
| Close Review outcomes (entries + declines) | 24,700 | 15,618 |
| Marks (revisions) | about 190,000 | 118,776 |
| Daily Trade Review Actions | about 126,000 | 78,317 |
| Debts (Outstanding) | not counted in section 1.4 | 15,485 (41) |

How the expectations were fixed (the generator wrote none for this snapshot): the counts, the Open Trades' Underlyings, the Missing Instruments (0: every Instrument has the as-of Mark, as the generator saves them all before its last session), the first Closed page, and the membership of the Review's walk (Trades open at the close) and owed group (Trades outside the walk with an Outstanding Debt) come from the stored records. The stored records do not fix the Open rows' figures, the walk's attention-ranked order or which reflections are due, so those come from the first render, which every later render must equal. The Action saves are timed only on cards whose Action is already saved (they are edits, as in a full dataset): 5 warm and 0 cold, where a full run has 5 and 3. No Save Marks timing is possible, because no Instrument is missing its as-of Mark.

Open list compared with its first render (the baseline, which was checked against the stored Open Trades' Underlyings): before the runs 99 rows equal, after the runs 99 rows equal, and each of the 30 cold starts rendered the same 99 rows (figures included). The 0 Missing Instruments on the as-of date () have rows in that list, each showing `Mark missing` in P&L (and no other row does).

## As-of Review's due reflections (T5.22)

The harness opens the Review from the primary navigation and reads its blockers: each "Reflection due for X" or "N reflections due for X" is a reflection due at the as-of Review (X names the Trade in full; the harness compares its underlying symbol) (Review Date 2027-02-17). The expected values are `asOfDueReflections` and the Trades of `outstandingDebts` in `bench/dataset.json` (the Outstanding Debts are from , both due at the as-of Review, decision 58). A difference fails the run.

| When | Due reflections listed (by Trade) | Expected | Result | Time from the click on Review to its status (disclosed, not gated) |
|---|---|---|---|---|
| before the runs | 19 (ABBV 2, MA 1, KO 1, TXN 1, CSCO 1, PG 1, NKE 1, JPM 1, UNH 1, CVX 1, ORCL 2, BA 2, AAPL 1, V 1, PEP 1, CAT 1) | 19 (ABBV 2, MA 1, KO 1, TXN 1, CSCO 1, PG 1, NKE 1, JPM 1, UNH 1, CVX 1, ORCL 2, BA 2, AAPL 1, V 1, PEP 1, CAT 1) | equal | 309 ms |
| after the runs | 19 (ABBV 2, MA 1, KO 1, TXN 1, CSCO 1, PG 1, NKE 1, JPM 1, UNH 1, CVX 1, ORCL 2, BA 2, AAPL 1, V 1, PEP 1, CAT 1) | 19 (ABBV 2, MA 1, KO 1, TXN 1, CSCO 1, PG 1, NKE 1, JPM 1, UNH 1, CVX 1, ORCL 2, BA 2, AAPL 1, V 1, PEP 1, CAT 1) | equal | 301 ms |

## Card timings (T5R.13, disclosed, not gated)

Each is the time from the pointer press to the rendered result, on the mature dataset above. The thresholds in the first table are the only gates.

| Measure | Runs | Median | Nearest-rank p95 | Min | Max |
|---|---|---|---|---|---|
| Open the first card (press on Review to the first card's content: `open` plus one `getTrade`) | 10 | 517.2 ms | 522.7 ms | 511.6 ms | 522.7 ms |
| Save Marks of one card's Marks (press on Save Marks to the card's drafts cleared) | 0 | none | none | none | none |
| Trade Action save (press on Save in the Action form to the form replaced by the result) | 5 | 681.0 ms | 682.5 ms | 677.8 ms | 682.5 ms |

- **Against D5 and D5R2:** D5 measured the cold start at 104.8 ms and the warm switch at 43.6 ms (p95), D5R2 96.2 ms and 47.3 ms on the same generator-3 dataset; this run's are 256.0 ms and 211.2 ms. D5 timed the press on Review to the Review's status at 2342 ms before its runs and 2225 ms after (single measurements); opening the first card here, which adds the first Trade's `getTrade`, takes a median of 517.2 ms.
- **Tech debt item 3** (the Review's open cost grows with history) is measured here, not fixed: D5R takes the save path off it (P38) but not the first `open` of each Review, and the open-the-first-card timing is its baseline.
- **The saves** are timed on cards of the cached profile's copy: ; and a Hold Action on QCOM, GS, DE, AMD, MRK. A Marks save fills the Instrument's Missing Review-date Mark with 51.00. The dataset holds an Action for every Trade on the Review Date, so each Action save is an edit of the saved Action (Change, Hold, an Intent of "bench edit", Save): a `SaveTradeAction` with the entry's expected revision, with the same post-save rebuild as a first save. The Review is opened afresh before each, which is not timed.
- **Raw timings (ms, in run order):** open the first card 519.3, 511.6, 514.5, 517.5, 516.9, 514.7, 520.9, 522.7, 515.3, 522.2; Save Marks ; Trade Action save 681.0, 682.5, 681.8, 679.4, 677.8.
- **Method:** a MutationObserver in the page reads the real clock on the first DOM change after which the result holds (the card's content shown with no card still loading; the card's Save Marks counting no drafts; the card's Action form gone with no card still loading), and a capture-phase pointer press records the start on the same clock.

## Closed page, Review walk and owed group (T6.25)

- **Closed page.** The generator records no Closed page, so the expected first page is derived from the stored data: the first 50 Closed Trades of the profile's `byLifecycleTerminal` index (terminal time descending), read raw in the page before any timed run. Each rendered row (its Trade from the link, Underlying and Close date in America/New_York) must equal the stored Trade's, in order, before the runs (50 rows equal) and after them (50 rows equal), and at each of the 10 renders below. Realized figures, Disposition and Close Reason are not compared (the stored Trade does not hold them).
- **Review walk and owed group.** The as-of Review's cards must equal `asOfReview` in `bench/dataset.json`, in order, each by its Trade (`data-trade-id`) and Underlying (the walked Trades' Underlyings are read from the stored Trades, the owed group's are the dataset's): before the runs 99 walked and 18 owed cards equal; after the runs 99 walked and 18 owed cards equal. The owed group's Debt identities are not rendered, so they are not compared here; the Trades and their order are.

| Measure (disclosed, not gated) | Runs | Median | Nearest-rank p95 | Min | Max |
|---|---|---|---|---|---|
| Closed tab to its first page (50 rows; press on Trades, then Closed, to the last row rendered) | 10 | 326.0 ms | 331.0 ms | 323.0 ms | 331.0 ms |

## Daily Trade Review Action save (requested measurement, disclosed, not gated; not in the plan's T6.25 row)

A single Action save on a card of the as-of Review (Change, Hold, an Intent, Save: a `SaveTradeAction` with the entry's expected revision, so the Review's post-save rebuild is included), from the press on Save to the form replaced by the result. Generator 5's Review save grew by about 1 ms per session in Chromium; this shows its cost at the mature profile. **Warm** is the five saves of the card timings above, in one long-lived page. **Cold** is one save on each of 3 fresh browser processes (offline, from the service worker), on a card no warm save used, the Review opened afresh first (not timed). These figures are not gated; only the two p95 above are.

| Save | Runs | Median | Nearest-rank p95 | Min | Max |
|---|---|---|---|---|---|
| Warm | 5 | 681.0 ms | 682.5 ms | 677.8 ms | 682.5 ms |
| Cold | 0 | none | none | none | none |

Raw (ms): warm 681.0, 682.5, 681.8, 679.4, 677.8; cold ; closed page renders 326.0, 323.0, 324.0, 331.0, 327.0, 327.0, 326.0, 325.0, 328.0, 324.0.

## Method

- Playwright's clock also swaps `window.performance` for a fake that records no marks, so the harness keeps the real object before the pin and points the fake's `mark` at it; `performance.now` and timers are the real ones.
- `Date` is pinned to the dataset's as-of instant (2027-02-17T21:35:00.000Z, A52) with Playwright `context.clock.setFixedTime`, and native `Temporal.Now.instant` (the application's clock) is pointed at it (T4.31-B1); every comparison first checks both read the as-of instant and that exactly the Missing Instruments' rows show `Mark missing`. Timers and `performance.now` are real, and the build is production.
- A copy of the cached profile (`.cache/bench/profile`, generator 5, schema 5) per run of the harness; the cached profile itself is never opened.
- The production build (`dist/`) served by the release harness server at http://localhost:5181, the origin the profile's IndexedDB belongs to.
- One warm-up launch, online, installs the service worker and is excluded. The server is then stopped and every later launch is offline (Playwright `offline: true`), so the app loads from the service worker and IndexedDB only.
- Cold start: the Chromium process is launched on the profile, navigates to the origin, and the time is the `tj:interactive` mark's `startTime` (from navigation start; readiness Writable and the Open list fully rendered with every row's figures, each run's rendered list compared with the expected rows afterwards); the process is then closed. The time from the call that launches the browser process to the same mark is recorded beside it for disclosure and is not gated.
- Warm switch: in one launched page, the Planned tab is opened and its first page rendered, then the Open tab is clicked; the time runs from the pointer press on the Open tab to the next `tj:open-list-ready` mark.

## Raw timings (ms, in run order)

| Run | Cold (navigation start to mark) | Cold, disclosed: process launch to mark | Warm |
|---|---|---|---|
| 1 | 251.5 | 320.3 | 197.8 |
| 2 | 253.9 | 323.5 | 207.2 |
| 3 | 256.0 | 325.0 | 203.8 |
| 4 | 251.1 | 319.5 | 207.3 |
| 5 | 251.6 | 325.3 | 212.2 |
| 6 | 251.1 | 320.9 | 207.3 |
| 7 | 250.8 | 322.3 | 205.5 |
| 8 | 251.1 | 320.8 | 207.5 |
| 9 | 251.3 | 319.3 | 206.8 |
| 10 | 250.7 | 319.8 | 206.3 |
| 11 | 249.5 | 318.9 | 201.6 |
| 12 | 249.6 | 319.5 | 206.1 |
| 13 | 252.7 | 321.6 | 200.1 |
| 14 | 250.2 | 318.8 | 211.2 |
| 15 | 248.8 | 318.2 | 205.2 |
| 16 | 249.8 | 318.0 | 206.3 |
| 17 | 251.5 | 321.0 | 200.2 |
| 18 | 249.6 | 319.2 | 201.3 |
| 19 | 251.7 | 320.5 | 197.1 |
| 20 | 259.0 | 327.0 | 200.4 |
| 21 | 251.5 | 321.0 | 201.7 |
| 22 | 249.3 | 321.4 | 208.2 |
| 23 | 250.5 | 320.3 | 203.4 |
| 24 | 249.6 | 317.3 | 206.8 |
| 25 | 250.2 | 319.2 | 201.2 |
| 26 | 252.9 | 321.4 | 200.0 |
| 27 | 247.7 | 317.0 | 205.0 |
| 28 | 249.4 | 317.9 | 207.0 |
| 29 | 250.6 | 319.6 | 202.6 |
| 30 | 252.3 | 323.1 | 204.1 |

Sorted cold: 247.7, 248.8, 249.3, 249.4, 249.5, 249.6, 249.6, 249.6, 249.8, 250.2, 250.2, 250.5, 250.6, 250.7, 250.8, 251.1, 251.1, 251.1, 251.3, 251.5, 251.5, 251.5, 251.6, 251.7, 252.3, 252.7, 252.9, 253.9, 256.0, 259.0

Process launch to mark (not gated): p95 325.3 ms.

Sorted warm: 197.1, 197.8, 200.0, 200.1, 200.2, 200.4, 201.2, 201.3, 201.6, 201.7, 202.6, 203.4, 203.8, 204.1, 205.0, 205.2, 205.5, 206.1, 206.3, 206.3, 206.8, 206.8, 207.0, 207.2, 207.3, 207.3, 207.5, 208.2, 211.2, 212.2

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
  "partial": true,
  "sessions": 784,
  "generatorVersion": 5,
  "schemaVersion": 5,
  "timeZone": "America/New_York",
  "origin": "http://localhost:5181",
  "asOf": "2027-02-17T21:35:00Z",
  "reviewDate": "2027-02-17",
  "cutoff": "2027-02-17T21:00:00Z",
  "missingInstruments": [],
  "counts": {
    "trades": 15743,
    "openTrades": 99,
    "plannedTrades": 20,
    "closedTrades": 15624,
    "positionChanges": 62683,
    "executions": 125340,
    "closeReasons": 15624,
    "sessions": 784,
    "marks": 118776,
    "markCorrections": 1176,
    "actions": 78317,
    "editedActions": 1567,
    "planReflectionEntries": 15743,
    "positionChangeReflectionEntries": 52323,
    "positionChangeReflectionDeclines": 10325,
    "closeReviewEntries": 12977,
    "closeReviewDeclines": 2641,
    "debts": 15485,
    "debtsSettled": 14172,
    "debtsDeclined": 1272,
    "debtsOutstanding": 41
  },
  "walkIdentities": [
    "000b64f8-1e81-4b1a-9a00-30fe15487f3b DE",
    "01239b29-03cf-4d61-9e09-209c4b7bc09b MRK",
    "03416653-807e-4f67-a7d6-b1c88f497da0 GOOGL",
    "04370444-0b9f-4a33-b44b-3e8e0e9a4fb4 META",
    "04d41c4c-2bea-4f38-be20-17b93c8daebc TXN",
    "058fff4c-7894-49c5-93ba-893a85e9c095 LLY",
    "09fba59d-0a28-486a-913f-1e71be2845ce DE",
    "0fe88ffd-ba04-4812-9043-916e428d73a0 NVDA",
    "106ec3c8-00d5-4e0c-8c17-3954f013bf26 QCOM",
    "10ebefa8-50fa-4c32-9fb3-b026de184a6d MSFT",
    "1626de85-0b59-4c60-8ce9-02d82f35e2bb MSFT",
    "193dc45e-acb6-43c6-a065-0eba9983ab48 ABBV",
    "1a01537d-45ee-42ea-9f66-acd57b93a69a XOM",
    "1a9c12b7-1aa2-4c14-8bc1-332e8078e41b HD",
    "1db4f31b-1265-4a33-8e66-7c455651ff6a PEP",
    "1f0de342-b2db-43cb-bc73-9be365fb024e NVDA",
    "203fc6f8-753f-4793-9d24-3e0cadabd267 INTC",
    "207227ed-da0e-4f9d-9330-74f67bc931c9 AAPL",
    "20797462-11a1-4292-a9bd-9bcd1f76c6ef BA",
    "20ba27c0-0db1-44a8-bcfe-d9dc81cbc0eb QCOM",
    "2574589d-0c85-4188-a2f2-6445277d12c7 AAPL",
    "2844448e-615c-411e-bfe7-88500da344cf ORCL",
    "28814f0c-f4ba-437c-8c9e-7e69304a823a DIS",
    "28899ab1-49fa-4a31-a3fc-06d09283b68b MA",
    "2902ec90-e601-4d51-a0d7-904f4fbf3725 UNH",
    "2aaf73ca-c1f8-43fc-8017-30cbb2cfde45 DE",
    "2b4dff08-03e6-4cf2-9c84-1827bc25d399 WMT",
    "2c564743-c6f1-4d81-821c-8141474739b1 NFLX",
    "3050b5c3-0dc1-47dd-b020-3f3e00273fde PFE",
    "32695447-29b7-4233-946e-e71346eef38c DIS",
    "3656c2dc-da97-42b5-9d89-df5fea5a6289 JPM",
    "374502ef-b6b7-4344-9743-07ea3b37039b ABBV",
    "3916e0fc-1387-436c-ad38-fbdd581da616 MRK",
    "39d650ca-9755-4d11-8c7d-6e7425fe0cb2 MSFT",
    "3b310732-52a9-45d7-9551-7cd515977aac CRM",
    "3b89d100-9fb5-479d-9857-2ceb2513df92 AVGO",
    "3e1df6d6-477b-490b-8b27-4b3935ebe85b V",
    "41d64ecc-ee45-4d30-bc3c-8f5785032c38 NVDA",
    "43f01c0b-c8ae-4631-9c83-561af704ff29 INTC",
    "47cab6ec-4fb7-4618-8196-6cbf1a9b2e9c CSCO",
    "48fdf2cf-f546-43a0-a348-c414004066d6 CSCO",
    "4bb6fac4-d064-4f9d-ade7-0ec53bee4be3 CRM",
    "516c94c3-851b-45e8-a459-89fedd1dc8b9 CAT",
    "5893cf60-62ed-46eb-9602-ba25b7e23113 LLY",
    "5a5c101e-59cd-4648-8723-4124bfda96db NKE",
    "5e648ceb-9035-4094-8a86-8e344a26fd0f CAT",
    "5f530f2f-09a1-40df-8d09-e4ade7d81513 CRM",
    "60d199b2-1686-4601-a0f2-2d5ef6c80ef6 COST",
    "6131ef51-81ad-4781-8982-5af1b9fc10b8 WMT",
    "6739430a-a44c-4eb1-b933-147f84de28cf TSLA",
    "696461b1-eeba-40c1-abbb-3407005547c0 GOOGL",
    "6e497ea7-3790-4e91-9eb4-32c0bebfc632 HD",
    "6fc5995f-0445-4940-acb9-9d817a060e09 GS",
    "73e24b03-73a8-40d6-bb44-7677de430da8 PFE",
    "73fd4d4f-4f7c-4c83-a64f-c73fe66650ed GS",
    "7675542b-cbc7-46d9-a150-6b73ca2c1b07 BA",
    "77d054d4-dc0f-4a1f-a14b-bd737e7ec462 AMZN",
    "7805b052-b504-4bdd-bb33-a56d983127c7 NFLX",
    "812e3050-a053-4556-b233-ee9b4c318fc1 CVX",
    "832ae680-5ae4-4a66-9bec-bba59963839e XOM",
    "83b40d8c-3bb9-47c5-ac64-b600022b32f9 META",
    "89fe7a58-0a1b-4b0a-afe3-d67bd5882ee9 DIS",
    "8ad4c5fa-dc64-4412-be64-dbad81dd0de1 MRK",
    "8dcdc614-9ba5-4a7d-be52-49ee7590e63f QCOM",
    "973de504-41a2-49b2-a242-22344b17dda4 TXN",
    "9c76840d-6e36-4d16-9e5f-5ecc944e9bfa NKE",
    "9daea44b-8e6d-4f02-9520-1c8e81c02905 ABBV",
    "a2e3f7b1-24ca-4643-8e30-c80d7d807af6 DIS",
    "a628cf17-15a0-4d9c-ad2a-766d4d8b3e4f ORCL",
    "aa7798a6-bc6a-4365-b635-c33fca5cc74e TSLA",
    "aa9fe3d6-3eff-43d2-ab9c-e2f7dd6eefc7 AMD",
    "af9d30e1-17e2-458a-aad4-5fb6659f103c AMZN",
    "b0644367-924a-4dd8-a048-dc014bc4a27f UNH",
    "b3d306fb-420d-4304-baba-1deef79804a9 INTC",
    "b5e2ec61-39bc-4fbd-be04-0bd4443148b6 PG",
    "b86d6c8e-f2ee-4a5d-9665-31c9cc9f3d26 KO",
    "b977839f-0be3-49ea-86b2-5a0f7d3af858 QCOM",
    "bb717c4f-f0fb-4dec-8832-225b42606679 PG",
    "bb9ba147-dd61-4e2d-ae69-6f4a39d392b3 JPM",
    "bc383cd2-d1c6-4a25-98c2-89c43527bc85 PEP",
    "bcf4ed69-7ff1-4818-8c8e-9df635995692 V",
    "bcfa719d-2e2b-47fe-bc4c-ccf9abc4a942 AMD",
    "cb6f03bc-4a10-4d64-8aeb-850829a0c76b V",
    "cd4e8af6-4f05-4452-8133-597a3b8865c9 ADBE",
    "d35afadc-228e-4c0e-9a66-ac63740cbfdb HD",
    "d761a866-6ba1-42c2-a207-5c99dacba205 MCD",
    "e3a54e17-9025-407e-9863-0c6f84bd8815 ADBE",
    "e400bd12-692e-4cd2-bd12-5d89c074c05c MA",
    "e5e707f4-149b-466a-91d4-3c0aded26d1c ADBE",
    "ec60a423-a021-4de3-96ad-4c5c10b84660 CSCO",
    "efcfd621-b9a4-497b-b5ce-18da8f6f762e WMT",
    "f327df4a-20b1-4bc8-8d7c-8841dff2496d CAT",
    "f507d1f3-8196-48a2-b14d-46fcf312e6f2 MCD",
    "f7d8c06f-cd67-4470-82f2-e1c71e001e11 NVDA",
    "fb1b1f28-1727-49c6-8d20-34bd6a499d9b NKE",
    "fcd41371-a174-4fc3-9abb-e4c837dfdf20 MCD",
    "fce29ec1-4f03-4248-90ae-3d1e9a4c846a JPM",
    "fe5dbb70-207f-4aee-8491-0521c095571c AVGO",
    "fe66a7d3-bbf3-4e43-b903-ec8d097c79f2 META"
  ],
  "owedIdentities": [
    "05076833-e235-4ed8-a45e-2fc8d42fb254 AAPL",
    "2015e9ec-4446-4116-92ed-c226fc20e438 LLY",
    "2578fcc1-fb51-43db-b1ce-3ba18b4f8885 INTC",
    "2c6e90c5-c68c-4891-8961-e2eb7f1c732e PG",
    "401ec685-938d-49be-9e37-41355839356f UNH",
    "44c2d2b1-5f93-4247-90d2-683f4d1e5f0d ORCL",
    "4c8bb287-22cc-41d9-9cad-b162aa5eb84d CVX",
    "627ecad2-b3a8-4db0-b97e-e1e2dc421b32 TSLA",
    "7e47dcfb-7d74-45ed-99cf-071652246fa7 CAT",
    "7fd818db-4787-403f-99ba-19db4893693f PEP",
    "a55d388b-08a7-4182-bffe-1515d41b81d3 CRM",
    "b43714f0-b107-43a8-b78a-248ff2f6dec0 BA",
    "b4568300-ff0d-473a-933d-d79a3998085c CVX",
    "becf82ef-8d29-47df-a1d7-a765a209d8a3 BA",
    "cb752f68-22d8-4ed1-b124-d933acc47ae8 KO",
    "d277bf33-6d5e-41e0-9dbd-ea94e8388cb3 ORCL",
    "edfcb997-8b31-44be-ba50-822618df2230 V",
    "f8602eb2-f878-4ebf-935c-405c690be3e8 MSFT"
  ],
  "openUnderlyings": [
    "AAPL",
    "AAPL",
    "ABBV",
    "ABBV",
    "ABBV",
    "ADBE",
    "ADBE",
    "ADBE",
    "AMD",
    "AMD",
    "AMZN",
    "AMZN",
    "AVGO",
    "AVGO",
    "BA",
    "BA",
    "CAT",
    "CAT",
    "CAT",
    "COST",
    "CRM",
    "CRM",
    "CRM",
    "CSCO",
    "CSCO",
    "CSCO",
    "CVX",
    "DE",
    "DE",
    "DE",
    "DIS",
    "DIS",
    "DIS",
    "DIS",
    "GOOGL",
    "GOOGL",
    "GS",
    "GS",
    "HD",
    "HD",
    "HD",
    "INTC",
    "INTC",
    "INTC",
    "JPM",
    "JPM",
    "JPM",
    "KO",
    "LLY",
    "LLY",
    "MA",
    "MA",
    "MCD",
    "MCD",
    "MCD",
    "META",
    "META",
    "META",
    "MRK",
    "MRK",
    "MRK",
    "MSFT",
    "MSFT",
    "MSFT",
    "NFLX",
    "NFLX",
    "NKE",
    "NKE",
    "NKE",
    "NVDA",
    "NVDA",
    "NVDA",
    "NVDA",
    "ORCL",
    "ORCL",
    "PEP",
    "PEP",
    "PFE",
    "PFE",
    "PG",
    "PG",
    "QCOM",
    "QCOM",
    "QCOM",
    "QCOM",
    "TSLA",
    "TSLA",
    "TXN",
    "TXN",
    "UNH",
    "UNH",
    "V",
    "V",
    "V",
    "WMT",
    "WMT",
    "WMT",
    "XOM",
    "XOM"
  ],
  "actionedTradeIds": [
    "000b64f8-1e81-4b1a-9a00-30fe15487f3b",
    "0fe88ffd-ba04-4812-9043-916e428d73a0",
    "1626de85-0b59-4c60-8ce9-02d82f35e2bb",
    "207227ed-da0e-4f9d-9330-74f67bc931c9",
    "28814f0c-f4ba-437c-8c9e-7e69304a823a",
    "3916e0fc-1387-436c-ad38-fbdd581da616",
    "6fc5995f-0445-4940-acb9-9d817a060e09",
    "8dcdc614-9ba5-4a7d-be52-49ee7590e63f",
    "a2e3f7b1-24ca-4643-8e30-c80d7d807af6",
    "a628cf17-15a0-4d9c-ad2a-766d4d8b3e4f",
    "aa9fe3d6-3eff-43d2-ab9c-e2f7dd6eefc7",
    "b3d306fb-420d-4304-baba-1deef79804a9",
    "b977839f-0be3-49ea-86b2-5a0f7d3af858",
    "bc383cd2-d1c6-4a25-98c2-89c43527bc85",
    "e3a54e17-9025-407e-9863-0c6f84bd8815",
    "f327df4a-20b1-4bc8-8d7c-8841dff2496d",
    "fb1b1f28-1727-49c6-8d20-34bd6a499d9b",
    "fcd41371-a174-4fc3-9abb-e4c837dfdf20"
  ],
  "outstandingUnderlyings": [
    "AAPL",
    "ABBV",
    "ADBE",
    "BA",
    "CAT",
    "CRM",
    "CSCO",
    "CVX",
    "DIS",
    "HD",
    "INTC",
    "JPM",
    "KO",
    "LLY",
    "MA",
    "MCD",
    "META",
    "MSFT",
    "NKE",
    "NVDA",
    "ORCL",
    "PEP",
    "PFE",
    "PG",
    "TSLA",
    "TXN",
    "UNH",
    "V",
    "WMT"
  ],
  "snapshotDir": ".cache/bench/partial-v5-s775/profile",
  "runProfileDir": ".cache/bench/partial-v5-s775/run-profile",
  "derivedAt": "2026-11-03T14:21:30.223Z",
  "engine": "chromium 153.0.8010.12",
  "host": {
    "platform": "darwin",
    "release": "25.6.0",
    "arch": "arm64",
    "cpu": "Apple M4 Max",
    "cores": 16
  }
}
```
