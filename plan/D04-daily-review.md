# D4 — Daily Review, with Manual Marks and ongoing risk/reward: task breakdown

Definition: [implementation plan, D4](implementation-plan.md#d4--daily-review). The definition (stories, capability set, introductions, acceptance claims) stays there and is not repeated here. On 2026-10-11 the former D3 (Manual Marks and ongoing risk/reward) was merged into D4, so that Marks are entered as part of the Daily Review (plan decision 24). D4 builds on D2's task identities, schema-2 layout (D2 A28), migration engine (D2 A30), benchmark generator (D2 section 1.3, T2.20–T2.21), and harnesses ([D2 breakdown](D02-open-a-long-stock-position.md)), which in turn build on [D1's](D01-start-a-workspace-and-confirm-a-long-stock-plan.md).

Status: **draft, under review.** Decisions P8–P13 and P15 were agreed on 2026-10-11 (first section). **P14 is open** and must be settled before the plan freezes. Everything else is written against those decisions and the working assumptions listed below.

---

## 1. Decisions and clarifications

### 1.1 Decisions for this breakdown

Numbering continues from D2's P4–P7. P8–P13 were raised while this was still D3.

| # | Question | Decision | Alternatives and tradeoff |
|---|---|---|---|
| P8 | **Session-policy coverage.** The stack decision requires dates outside the policy's coverage to return an explicit diagnostic rather than a guess, but leaves the window open. | **Agreed 2026-10-11.** Regular NYSE holidays come from rules (weekend observance, Good Friday from Easter, Juneteenth from 2022). Every one-off closure and every early close is listed in an explicit table, each row citing its NYSE source. The policy has an identity, revision, and digest. It is **covered from 2000-01-01 through the last year NYSE has published at plan freeze (expected 2028-12-31)**. For any date outside coverage, the policy returns a `SessionPolicyCoverage` diagnostic and never a guessed session. Mark entry is refused for uncovered dates, and current valuation is `Unavailable(SessionPolicyNotCovered)`. When today is past the end of coverage, the shell shows a notice that the app needs an update to value positions and review. Every other control stays enabled. | (a) Start in 2016: about 50 fewer table rows to verify, but Trades journaled from earlier years could never get Marks. (b) Beyond the table, generate holidays from rules and label them provisional: the app keeps working without updates, but unannounced closures and early closes would be guessed. |
| P9 | **When does a session count as completed?** This sets the Expected Mark Date and the latest Review Date. | **Agreed 2026-10-11: 30 minutes after the close.** The policy gives two instants per session. The **close** is 16:00 America/New_York, or 13:00 on early-close days. It is the Review Cutoff, which decides eligibility, exactly as the glossary defines it. The **completion** is 30 minutes later: 16:30, or 13:30. From that instant the session is "completed": it becomes the Expected Mark Date, a valid Mark key, and the `LatestCompleted` Review Date. Market Data and Daily Review share this rule, so the Expected Mark Date and the latest Review Date never disagree. During the 30 minutes after the close, the previous session is still current. This reads "completed" as "closing prices have settled". The buffer is part of the policy identity and digest. Session dates are exchange dates whatever the Workspace time zone. | (a) The exact close instant: simplest, but a Mark shows Missing from 16:00 while closing prints may still arrive. (b) 15 or 60 minutes. |
| P10 | **Which Mark keys may be entered?** | **Agreed 2026-10-11, adjusted by P11 and P15.** Market Data accepts any well-formed Instrument key on any completed session within coverage, never an in-progress or future session. It cannot restrict entry to Trade Instruments, because Market Data knows no Trades (Market Data contract; overview, "Additional prohibitions"). The UI offers Marks for the Instruments of the Review's eligible Trades: on the Review Date, and on every earlier session without a Mark since each Instrument's exposure began, so days skipped while away can be filled in. | (a) Only the current date. (b) Any symbol in the UI: Marks could be stored for Instruments no Trade uses. |
| P11 | **Where are Marks entered?** | **Agreed 2026-10-11: as part of the Daily Review.** The Review's first task family is its Missing Marks, as the spec orders it, and that is where Marks are entered, corrected, acknowledged unavailable, or withdrawn. D11's provider later fills them automatically when the Review opens. There is no separate Marks page. Because D3 could not be used without an entry point, **D3 was merged into D4** (plan decision 24). Open list and Trade Detail link to the Review's Marks task when a Mark is missing. | (a) A Marks page in D3 as an interim entry point, kept or retired once D4 arrives. (b) Inline entry on Trade Detail, which would need a read after each save. |
| P12 | **Shares bought after the Expected Mark Date's close.** For example, shares bought Tuesday at 10:00 and viewed at Tuesday noon, when Monday's close is current. | **Agreed 2026-10-11: at-entry line, awaiting close.** Monday's Mark cannot honestly value shares that did not exist at Monday's close. Valuing them at their execution price is fill-cost substitution, which the spec forbids (overview, "Calculation availability"; Market Data, "Observation model"; UI contract, "Numbers, availability, and graphs"). So the Trade's current figures read "Awaiting the Tue Oct 13 close". A dated line shows the shares held at Monday's close valued with Monday's Mark (P13). An **at-entry line** shows the newer shares' risk and reward measured from their execution prices, labelled "at entry" and never as a valuation or P&L. Normal current figures return once that close's Mark is entered. | (a) Value every current share at Monday's Mark with a note: the spec's literal arithmetic, but it values shares at a price from before they existed. (b) Reopen the spec to allow execution price as a provisional Mark. |
| P13 | **What does an open Trade show when the current Mark is missing?** | **Agreed 2026-10-11: Missing plus a dated last close.** Current figures say "Mark missing for XYZ on Tue Oct 13", as the spec requires; the previous Mark is never used in them (AC-CALC-002). Beside them, a separately labelled line, "At Mon Oct 12 close", values the Position held at that earlier session's close with that session's own exact Mark. That is a real dated valuation of the kind replay produces, not a substitute for today. Shares acquired after that earlier close get the at-entry line (P12). Today's figures appear once today's Mark is entered. | Reopen the spec so that current figures use the latest available Mark. That would change the glossary's Stale definition, Market Data, Trade Analysis, AC-CALC-002, and the UI contract. |
| P14 | **Attention bands: what separates "quantified pressure" from "routine"?** The spec names five bands (factual or management blocker, boundary reached, evidence limited, quantified pressure, routine) and defines pressure and its Highest, Zero, and Not Comparable cases, but not the boundary between the last two bands. | **OPEN, deferred by the user on 2026-10-11 to be settled before D4's implementation starts.** The planning protocol does not allow the plan to freeze with this open, because it changes public behavior. Option on the table when it was deferred: quantified pressure holds every Trade with comparable finite or Highest pressure; routine holds Zero-pressure Trades (finite risk against unbounded reward) and Not Comparable ones not already in evidence limited. For Long Stock, routine would be empty until options and structures arrive. Other options: a threshold at pressure 1.0, or no separate routine band. **Effect on this breakdown:** the band order and the ordering inside each band are specified and tested, and only one case (T4.14, marked pending) depends on P14. The five-Trade attention fixture has the same order under every option. | — |
| P15 | **Missed sessions.** | **Agreed 2026-10-11: the trader does not review missed sessions.** Daily Review opens only on `LatestCompleted`. Marks for sessions skipped since an Instrument's exposure began are entered in the current Review's Marks task. Under the spec they are historical gaps: shown, and fillable, but they **do not block** the current Review's completion (Daily Review, "Date, eligibility, and ordering"; AC-MARK-004). Opening an exact past date (`ExactCompleted`) is still required by AC-REV-001, so it arrives where that scenario is completed, in D15. | A list of recent sessions with their completion status, each opening an exact-date Review. |

### 1.2 Working assumptions

Numbering continues from D2's A18–A34. These are implementation-level choices that do not reopen product semantics. They stand unless you object.

| # | Assumption |
|---|---|
| A35 | **Market Data save intentions in D4:** `RecordInitialManualMark`, `CorrectMark`, `AssertUnavailable`, and `WithdrawAcknowledgment`. `OverrideManualValuation` returns `VariantNotInstalled` until provider Marks exist (D11; review-queue item 6). A correction needs an existing Mark, a reason of 1–500 characters, and a price different from the effective one (`CorrectionUnchanged` otherwise). Asserting unavailable needs no effective Mark (`MarkExists` otherwise) and a reason of 1–500 characters. Withdrawing needs an asserted acknowledgment (`NothingToWithdraw` otherwise) and takes an optional reason. |
| A36 | **Observation history:** a Mark revision is `{ revisionId, price, source: Manual, intention: InitialManual \| Correction, reason?, supersedes?, correctionFootprint?, observedAt, savedAt }`. For a Manual Mark `observedAt` equals `savedAt`, because the trader attests to the price when saving. An acknowledgment version is `{ versionId, kind: Asserted \| Withdrawn, reason?, savedAt }` and carries no price. A Correction stores an observation-level Correction Footprint: the key, its effect date, the save time, the affected calculation domains (Mark-to-Market valuation, condition status, replay), and the replay interval (that one session). Market Data can produce this without knowing Trades, and storing it now captures what D16, D19, and D24 need. |
| A37 | **Mark price in D4:** a positive finite decimal with at most 6 fractional digits (A9), stored as a normalized string. Whether an option Mark may be exactly 0 is decided in D7. |
| A38 | **Storage (schema version 3), extending A28:** a new store `observations` with key path `[tradingDate, instrumentKey]` holds one record per key with its Mark revision chain, its acknowledgment chain, the effective heads, and a per-key `resolutionRevision` counter used as the optimistic binding (a key with no record binds as `None`). D11's Daily Bars will join the same record. The new index `byInstrumentDate` on `[instrumentKey, tradingDate]` serves Stale context and gap enumeration. `meta` gains `sessionPolicy` (`id`, `revision`, `digest`, coverage) and `marketDataRevision`, which every Market Data write increments. Each Trade document gains `exposureStart`, the Economic Time of its first effective opening Execution, maintained by every commit (A55). Daily Trade Review obligation keys are `['DailyTradeReview', reviewDate, tradeId]` in `journalObligations`, so one range read finds every Action for a Review Date. Action edits use the Entry version lists D1 already stores. |
| A39 | **Session policy location and shape:** pure code in `src/domain/session-policy/` with no clock, so callers pass the instant. A dependency rule (A17) lets only `src/modules/market-data/` import it, and Trade Analysis and Daily Review never see a calendar. Its exports classify a date (`Session(close, completion)`, `Weekend`, `Holiday(name)`, `Closure(name)`, `NotCovered`), give the latest completed session at an instant, the previous and next session, and an inclusive enumeration. The table, the rules version, and the 30-minute buffer determine the digest. A build check fails if they change without a revision bump (T4.2). |
| A40 | **Session-policy compatibility:** at startup, if the release's policy revision differs from `meta.sessionPolicy`, Workspace revalidates every stored observation key against the new policy, records the new identity, and lists in the receipt any key whose date is no longer a covered session. Such a record is kept, never deleted, and never selected, because frames enumerate only sessions. Extending coverage is the normal case and produces no findings. |
| A41 | **Long Stock `evaluate`**, with remaining quantity `q`, open cost `C = Σ qᵢpᵢ` over Open Lots, unconsumed opening fees `F`, exact Mark `m`, effective Stop `s`, effective Target `t`, and 1R from the frozen Plan Baseline. Remaining-open marked P&L is `q·m − C − F`. Realized-to-date is `0` as a Value, because there are no disposals before D6. Current Marked Trade P&L is the sum of the two, and incurred fees are `Σ` Execution fees. Ongoing Risk to Stop is `q·(m − s)` when `m > s`, otherwise `0` with Stop Overrun `q·(s − m)`. Fees cancel between two P&L points, and no closing fee is projected. Worst-Case Ongoing Risk is `q·m` (price to zero). Incremental Reward to Target is `q·(t − m)` when `m < t`, otherwise `0` with Target Overrun `q·(m − t)`. Maximum Incremental Reward is `Unbounded(Above)` whatever the Mark's status. Plan-R conversions divide Current Marked Trade P&L, both risks, the reward, and both Overruns by 1R, each as its own Calculation Result. |
| A42 | **Boundary contact:** a Mark exactly at the Stop is Breached with Overrun 0, and exactly at the Target is Reached with Overrun 0. This matches D2's `EntryAtOrBeyondStop` and `EntryAtOrBeyondTarget`. |
| A43 | **Covered subtotal:** returned only when at least one remaining Instrument component is covered and another is not. A single-Instrument Long Stock Trade with a Missing Mark has none. D10's multi-Instrument Trades exercise it. |
| A44 | **No Mark-dependent Deviation in D4.** `evaluate` returns none until Stop Discipline lands in D12 (decision 12), so `DailyReview.save` has no Deviation reconciliation yet. A reached Target is never a Deviation. |
| A45 | **`MarketDataSnapshotId` and evidence digest:** the digest is SHA-256 over the canonical request (context, as-of instant, valuation or Review Date, sorted Instrument keys), the policy revision, each key's selected Mark revision, acknowledgment version, or absence, and each Stale-context revision. `MarketDataSnapshotId` is an opaque token holding `marketDataRevision` and that digest. The digest is computed after the read transaction closes. `ExpectedSnapshot` recomputes the digest for the same normalized request and returns `SnapshotUnchanged` or `SnapshotChanged` with current frames. |
| A46 | **Coherent reads:** Trade Views and Daily Review bind one Workspace content revision across their Trade, Journal, Catalog, and Market Data reads. If a write lands between phases, they retry up to 3 times, then return `ChangedDuringAssembly`. They never return a torn view. |
| A47 | **Bounded Mark reads:** a frame request is answered in one read-only transaction with one `getAll` over the valuation date's range, plus one reverse-cursor request on `byInstrumentDate` per Missing Instrument for Stale context. Gap enumeration in `recover` adds one `getAllKeys` per Instrument. Request counts depend only on the number of Instruments, never on Trade count or history length. |
| A48 | **After a Mark save (AC-RESP-001):** the Marks task row renders the saved resolution, revision, and classification from the save result alone. Trade figures in the Review update when the trader presses **Continue to Trades**, which calls `open` again (a refresh is part of the Review contract). Open list and Detail update when next opened. No read follows a save automatically. |
| A49 | **Faults-build clock pin:** the faults build (D1 T1.27) accepts `?clock=<ISO instant>`, which fixes `Date` for that launch while timers run normally. The browser critic needs it for date-specific flows. Like every other fault hook, it is absent from production `dist/`. |
| A50 | **Previous release:** the harness builds the D2 release from the tag `claude-opus-5.5-d2`, exported with `git archive` and never as a worktree (D2 A34). |
| A51 | **Fixture views across schemas:** `verify:fixtures` runs each fixture at its recorded as-of instant (fixed clock). Migrated views must equal the fixture's committed snapshot on every field that snapshot contains. Every later field must have its defined value: in D4, every current figure of a pre-schema-3 Open Trade is `Unavailable(MarkMissing)`. Committed fixtures are never regenerated. |
| A52 | **Benchmark clock:** `bench:run` pins `Date` to the dataset's as-of instant with Playwright `clock.setFixedTime`, which leaves timers and `performance.now` real. |
| A53 | **Frame contexts:** `ResolveFrames` accepts `Current(asOf)`, `Review(reviewDate)`, and `Historical(tradingDate)` point contexts. Every frame carries its date, that session's close instant, and the next session if it is completed. A date that is not a session returns `NotASession`. A date not yet completed returns `SessionNotCompleted`. Coordinators pass these instants to Trade Analysis, so Trade Analysis never needs a calendar. |
| A54 | **Dated last-close and at-entry lines (P12, P13):** when a Trade's current or Review-date figures are not all Values because the Mark is Missing or Lots opened after the frame's close, the coordinator finds the latest earlier date `D` with an exact Mark: the Stale context's date, or the frame's own date in the P12 case. It derives the Trade at `D`'s close, then evaluates that state with `D`'s exact frame. The result is the dated line, shown only if the Trade had exposure then. For remaining Lots opened after `D`'s close, `evaluate` returns at-entry figures: quantity, average entry, risk from entry `Σ qᵢ(pᵢ − s)` floored at 0, and reward from entry `Σ qᵢ(t − pᵢ)` floored at 0. Fees cancel, as in A41. These are never called valuation or P&L. The current figures' reason is `MarkMissing(Instrument, date)` or `AwaitingClose(after D)`. |
| A55 | **Eligibility in D4:** `StateAtEconomicCutoff(Open, cutoff)` selects Trades that are Open in the lifecycle index with `exposureStart` at or before the cutoff, and Daily Review confirms each by deriving at the cutoff. With no exits before D6, that is exactly "Open at the cutoff". **D6 must extend it** to Trades closed after the cutoff, because D6 first produces them. An earlier-dated Position Change (P5) moves `exposureStart`, so it can make a Trade eligible for the current Review afterwards, which restates progress. |
| A56 | **`recover` without a provider:** for each Instrument, relevance starts at the first session whose close is at or after its earliest exposure among the eligible Trades. `recover` enumerates sessions from there through the Review Date. It returns the Review-date frames and current resolutions, historical gaps (sessions without a Mark, with acknowledged sessions listed separately), the current-date Missing keys as Manual tasks, the snapshot binding, and a `NotConfigured` diagnostic. It writes nothing. The UI does not show `NotConfigured`, because no provider capability exists until D11. |
| A57 | **Review screen:** a header with the Review Date, its completion as text, and blockers. The **Marks** family comes first. Its *Today* rows, one per Instrument needing the Review-date Mark, offer Enter, "Can't get a price" (acknowledge), Correct, and Withdraw. Its *Earlier sessions without Marks — optional* group lists each Instrument's gaps, newest first and 20 per page, each with Enter or "Can't get a price". **Continue to Trades** refreshes the Review (A48) and shows the Trade walk in attention order with band labels and reasons. There is no finish gesture. |
| A58 | **Action form:** Hold is preselected only in returned view state; one visible Save records it. Exit, Roll, and Adjust require Intent. Saving again for the same Trade and Review Date edits the same Entry under its expected revision, appending a version. Trade Detail's narrative shows Actions with an Edited indicator; their history view arrives in D13. No Trade-workflow link is offered yet: D6 adds Exit's link to recording the exit. |
| A59 | **Integrity disagreement in the Review:** the Trade goes in the blocker band. An Action can still be saved, but completion stays Incomplete, naming the integrity finding, until a Trade mutation repairs it (P7). |
| A60 | **Navigation:** a Review destination opens `LatestCompleted` (P15). Missing-Mark disclosures on the Open list and Trade Detail link to the Review's Marks family with the Instrument focused. |

### 1.3 Benchmark dataset at D4

This extends D2's generator toward the mature profile in [D1 section 1.3](D01-start-a-workspace-and-confirm-a-long-stock-plan.md#13-mature-dataset-profile-agreed-with-p1). The generator version is bumped.

| Record kind | Count at D4 | Mature profile |
|---|---|---|
| Trades, Position Changes, Executions, reflections | as at D2 | as at D2 |
| Distinct Instruments of the 200 Open Trades | 150 (50 shared by two Trades) | about 150 |
| Marks | about 189,000: every session from 2021-10-11 through the as-of date for those 150 Instruments, **except** the as-of date for 10 Instruments (disclosed Missing fraction) | 190,000 |
| Mark corrections | about 1,900 (1% of Marks) | part of "representative correction history" |
| Daily Trade Review Actions | about 126,000: one per eligible Trade per session, 85% Hold, 15% Exit/Roll/Adjust with Intent, 2% edited once | 126,000 |

The generator simulates the trader session by session through the production facade. For each session it advances Playwright's pinned clock to that session's completion, saves that session's Marks, opens the Review, and saves an Action for each eligible Trade. Generation is slow (on the order of an hour) but runs only once per generator and schema version. The as-of instant is recorded in `bench/dataset.json` and pinned during measurement (A52).

---

## 2. Implementation boundaries added or extended in D4

| Canonical boundary | Code location | D4 operations |
|---|---|---|
| U.S. session policy (pure; behind Market Data) | `src/domain/session-policy/` | classification, close and completion instants, latest completed, previous and next, enumeration, coverage, identity |
| Market Data | `src/modules/market-data/` (new) | `save` (initial, correction, assert, withdraw); `query` (`ResolveFrames` with Current, Review, and Historical point contexts; `ExpectedSnapshot`); `recover` (no provider); section validator |
| Trade Analysis (pure) | `src/domain/trade-analysis/` | `derive` at an economic cutoff with observation requirements and exposure start; `evaluate` (Long Stock) |
| Trade Record | `src/modules/trade-record/` | `exposureStart` maintenance; `queryRecords` (`StateAtEconomicCutoff` Open) |
| Journal | `src/modules/journal/` | seed manifest v3; Daily Trade Review (`CompleteNow`, edit by expected revision); query by Review Date; section validator extended |
| Daily Review | `src/coordinators/daily-review/` (new) | `open` (`LatestCompleted`), `getTrade`, `save` (`SaveTradeAction`) |
| Trade Views and Reporting | `src/coordinators/trade-views/` | current evaluation, dated last-close and at-entry lines on the Open list and Open Trade Detail |
| Workspace | `src/coordinators/workspace/` | migration to schema 3; seed manifest v3; session-policy compatibility; manifest v3 capabilities |
| Persistence/Transaction (internal) | `src/persistence/` | schema v3 layout |
| Migrations | `src/persistence/migrations/` | `v2→v3` and the `v1→v2→v3` chain |
| UI | `src/ui/` | Review overview, Mark entry, Trade walk and Action form, Open list figures, Trade Detail valuation and risk, coverage notice, About additions |

---

## 3. Task graph

Kind: **B** = behavioral (TDD, red→green per case), **S** = structural (exact verification).

| Task | Title | Layer | Kind | Blocked by | Public seam under test |
|---|---|---|---|---|---|
| T4.1 | Session policy: rules, table, close and completion instants, coverage | domain | B | D2 | `src/domain/session-policy` exports |
| T4.2 | Session-policy verification against NYSE's published calendars | test | S | T4.1 | `verify:session-policy` |
| T4.3 | Persistence: schema v3 and the `v2→v3` transform | persistence | B | D2 T2.8 | internal `Persistence` interface, migration transform |
| T4.4 | Market Data: Manual Mark save (initial, correction) | domain/persistence | B | T4.1, T4.3 | `MarketData.save` |
| T4.5 | Market Data: acknowledgments and resolution precedence | domain/persistence | B | T4.4 | `MarketData.save` |
| T4.6 | Market Data: `ResolveFrames`, Stale context, snapshot binding, `ExpectedSnapshot` | domain/persistence | B | T4.5 | `MarketData.query` |
| T4.7 | Market Data: `recover` without a provider | domain/persistence | B | T4.6 | `MarketData.recover` |
| T4.8 | Trade Analysis: derive at a cutoff, observation requirements, exposure start | domain | B | D2 | `TradeAnalysis.derive` |
| T4.9 | Trade Analysis: valuation, availability, dated last-close and at-entry figures | domain | B | T4.8 | `TradeAnalysis.evaluate` |
| T4.10 | Trade Analysis: ongoing risk and reward, conditions, Overrun, Plan R | domain | B | T4.9 | `TradeAnalysis.evaluate` |
| T4.11 | Trade Record: exposure start and `StateAtEconomicCutoff` | domain/persistence | B | T4.3, T4.8 | `TradeRecord` |
| T4.12 | Journal: Daily Trade Review seed, Action effects, edit by expected revision, query by Review Date | domain/persistence | B | T4.3 | `Journal` |
| T4.13 | Section validators: Market Data; Journal extended | domain | B | T4.5, T4.12 | `validateSection` |
| T4.14 | Daily Review: `open` | application | B | T4.7, T4.10, T4.11, T4.12 | `DailyReview.open` |
| T4.15 | Daily Review: `getTrade` | application | B | T4.14 | `DailyReview.getTrade` |
| T4.16 | Daily Review: `save` (`SaveTradeAction`) | application | B | T4.15 | `DailyReview.save` |
| T4.17 | Workspace: migration to schema 3, seed manifest v3, session-policy compatibility | application | B | T4.3, T4.13 | `Workspace.initialize` |
| T4.18 | Trade Views: current evaluation and dated lines for the Open list and Detail | application | B | T4.6, T4.10 | `TradeViewsAndReporting` |
| T4.19 | Installed Capability Manifest, composition root, and dependency rules for D4 | application | S | T4.14–T4.18 | `verify:capabilities`, `lint:deps` |
| T4.20 | UI: Mark entry | UI | B | T4.19 | `MarkEntry` |
| T4.21 | UI: Review overview and Marks family | UI | B | T4.20 | `ReviewView` |
| T4.22 | UI: Trade walk and Action form | UI | B | T4.21 | `ReviewTrade`, `ActionForm` |
| T4.23 | UI: Open list figures | UI | B | T4.19 | `TradeList` |
| T4.24 | UI: Trade Detail valuation, risk, and Actions | UI | B | T4.19 | `TradeDetail` |
| T4.25 | UI: coverage notice and About additions | UI | B | T4.19 | `AppShell`, `AboutView` |
| T4.26 | Faults build: clock pin | test | S | D1 T1.27 | `build:faults`, `verify:no-fault-hooks` |
| T4.27 | Release harness: previous release from the `claude-opus-5.5-d2` tag | test | S | D2 T2.17 | `build:releases`, `verify:releases` |
| T4.28 | Capacity basis recomputed for schema 3 | test/infrastructure | S | T4.19 | `measure:capacity`, `verify:capacity` |
| T4.29 | Freeze the schema-v3 fixture; migrate the v1 and v2 fixtures | test | S | T4.17, T4.19 | `fixtures:freeze`, `verify:fixtures` |
| T4.30 | Benchmark generator: Marks and Actions | test | S | T4.19, D2 T2.20 | `build:bench`, `bench:generate` |
| T4.31 | Latency harness and query-count proof, extended | test | S | T4.30 | `bench:run`, `test:integration -- d4/query-count` |
| T4.32 | Node mock-free integration suite | test | S | T4.19 | `test:integration` |
| T4.33 | Browser integration suite (Chromium) | test | S | T4.20–T4.29 | `test:e2e` |
| T4.34 | Independent browser-critic gate | test | S | all | fresh critic report |

**Parallel tracks.** There are four, which join as follows:
- **Session policy and Market Data** (T4.1–T4.7).
- **Trade Analysis** (T4.8–T4.10).
- **Persistence, Trade Record, and Journal** (T4.3, T4.11–T4.13, T4.17).
- **UI** (T4.20–T4.25), built against the facade test double once the frame, evaluation, Review, and Open read models are fixed in T4.19's type module.

Daily Review (T4.14–T4.16) and Trade Views (T4.18) join the first three tracks.

---

## 4. Behavioral tasks

Every case runs **red → green** individually, as the kickoff prompt requires. A case that passes on its first run, or fails for a syntax, configuration, fixture, or unrelated reason, is not valid red evidence; it must be fixed and rerun to a genuine red, never logged and skipped.

**Reference Trade** (D2's, with a symbol): Long Stock XYZ, Plan for 100 shares, intended entry 50.00, Stop 47.50, Target 56.00 (1R $250), Plan Economic Time Monday 2026-10-12 09:00 America/New_York. **PC1** 10:00, 60 @ 50.10, fee 1.00; **PC2** 11:00, 40 @ 50.30, fee 1.00; **PC3** 14:00, 20 @ 51.00, fee 1.00. After PC2: `q` 100, `C` $5,018.00, `F` $2.00. After PC3: `q` 120, `C` $6,038.00, `F` $3.00.

**Five-Trade Review fixture** (all Long Stock; fills on Monday 2026-10-12 at 10:00, fee 1.00; Review at Monday 17:00, Review Date 2026-10-12, cutoff 16:00):

| Trade | Plan (shares, entry, Stop, Target) | Fills | Monday Mark | Expected band |
|---|---|---|---|---|
| T-A | the reference Trade | PC1, PC2 | XYZ 52.00 | pressure 450/400 = 9/8 |
| T-B | ABC 100, 30.00, 28.00, 36.00 | 100 @ 30.00 | ABC 27.50 | boundary reached (Stop breached, Overrun $50.00) |
| T-C | DEF 100, 40.00, 38.00, 46.00 | 100 @ 40.00 | none | evidence limited |
| T-D | GHI 100, 60.00, 57.00, 70.00 | 120 @ 60.00 (Entry Size 20) | GHI 61.00 | blocker: the integrity fixture writer removes its recorded Entry Size occurrence |
| T-E | JKL 100, 20.00, 19.00, 30.00 | 100 @ 20.00 | JKL 21.00 | pressure 200/900 = 2/9 |

Expected order: T-D, T-B, T-C, T-A, T-E.

### T4.1 Session policy

Seam: the exports of `src/domain/session-policy` (pure; instants are passed in).

```text
describe("regular holiday rules")
  it should classify New Year's Day, Martin Luther King Jr. Day, Washington's Birthday, Good Friday, Memorial Day, Juneteenth, Independence Day, Labor Day, Thanksgiving, and Christmas of 2026 as holidays with their names, and the weekdays around each as sessions
  it should observe a Saturday holiday on the preceding Friday (Independence Day 2026 on 2026-07-03) and a Sunday holiday on the following Monday (Juneteenth 2022 on 2022-06-20)
  it should keep Friday 2021-12-31 a session, because New Year's Day 2022 falls on a Saturday
  it should place Good Friday two days before Easter (2026-04-03, 2027-03-26)
  it should treat Juneteenth as a holiday only from 2022
  it should keep Columbus Day 2026-10-12 a session

describe("explicit table")
  it should classify each listed one-off closure (2001-09-11 through 09-14, 2012-10-29 and 10-30, 2018-12-05, 2025-01-09) as a Closure with its name
  it should give each listed early-close day (2026-11-27, 2026-12-24) a 13:00 America/New_York close and every other session a 16:00 close

describe("close and completion instants (P9)")
  it should return each close as an exact instant across daylight-saving changes (Friday 2026-03-06 closes at 21:00Z, Monday 2026-03-09 at 20:00Z)
  it should return each completion 30 minutes after its close (16:30 on a normal day, 13:30 on 2026-11-27)

describe("latest completed session (P9)")
  it should return Monday 2026-10-12 at Tuesday 2026-10-13 12:00 (AC-MARK-001)
  it should return Tuesday at exactly Tuesday 16:30:00, and Monday at Tuesday 16:00 and at 16:29:59.999
  it should return Friday 2026-10-16 on Saturday, on Sunday, and on Monday 2026-10-19 before 16:30
  it should return Friday 2026-11-27 at 13:30 that day and Wednesday 2026-11-25 at 13:29 that day
  it should skip a holiday, returning 2026-11-25 at Thanksgiving 2026-11-26 18:00

describe("neighbours and enumeration")
  it should return the previous and next sessions of a date, skipping weekends, holidays, and closures
  it should enumerate sessions inclusively (2026-11-23 to 2026-11-30 gives 23, 24, 25, 27, and 30)

describe("coverage (P8)")
  it should classify a date before 2000-01-01 or after the last covered year as NotCovered with the coverage range, never as a session or a holiday
  it should return a SessionPolicyCoverage diagnostic from latest completed session when the instant's exchange date is outside coverage
  it should expose its identity (id, revision, digest, coverage range) and return deep-equal results for identical inputs
```

### T4.3 Persistence: schema v3

Seam: the internal `Persistence` interface and the `v2→v3` transform, against `fake-indexeddb`.

```text
describe("schema v3 layout")
  it should create a fresh Workspace at schema version 3 with the observations store keyed by [tradingDate, instrumentKey], its byInstrumentDate index, and meta fields sessionPolicy and marketDataRevision 0

describe("v2 → v3 transform")
  it should copy every v2 store, add exposureStart to each Trade document from its first opening Execution, create an empty observations store, and record the release's session-policy identity in meta
  it should migrate a v1 Workspace through v1→v2 and v2→v3 inside one candidate

describe("rebuild")
  it should rebuild byInstrumentDate from observations with identical contents
```

### T4.4 Market Data: Manual Mark save

Seam: `MarketData.save`, against `fake-indexeddb`, with a fixed clock at Tuesday 2026-10-13 12:00 unless stated.

```text
describe("record an initial Manual Mark")
  it should append revision 1 (Manual, InitialManual, 52.00) for (XYZ, 2026-10-12) and return Saved with resolution Available, the new resolution revision, the saved-intention classification, and the accepted command binding
  it should store "52.000" as "52" without changing its exact value
  it should commit in one semantic commit that increments marketDataRevision and the Workspace content revision exactly once
  it should return Conflict with the current resolution and write nothing when the key already has a Mark

describe("correct a believed-wrong Mark")
  it should append revision 2 (Correction, 51.50, reason, superseding revision 1) with its Correction Footprint (key, effect date 2026-10-12, save time, domains valuation, condition status, and replay, interval 2026-10-12 to 2026-10-12), make it effective, and keep revision 1
  it should require a reason of 1 to 500 characters, returning ReasonRequired or ReasonTooLong
  it should reject a correction to the effective price with CorrectionUnchanged and a correction for a key with no Mark with NothingToCorrect
  it should return Conflict and write nothing when the expected resolution revision is stale

describe("key and price validation (P8, P9, P10)")
  it should reject a weekend, holiday, or closure date with NotASession and a date outside coverage with SessionPolicyCoverage
  it should reject Tuesday at Tuesday noon and at Tuesday 16:10 (closed but not completed), and any later date, with SessionNotCompleted
  it should accept Friday 2026-10-09, because past completed sessions are valid keys
  it should reject a malformed symbol with InvalidInstrument and a zero, negative, non-finite, or over-precise price with InvalidPrice, all at once
  it should reject OverrideManualValuation with VariantNotInstalled

describe("write gate")
  it should return RuntimeNotWritable and write nothing when the mutation-boundary readiness recheck fails
```

### T4.5 Market Data: acknowledgments and precedence

Seam: `MarketData.save`.

```text
describe("assert unavailable (AC-MARK-003)")
  it should append an Asserted acknowledgment with its reason and time, and no price, for (DEF, 2026-10-12), returning AcknowledgedUnavailable with Stale context and the new resolution revision
  it should reject assert on a key with an effective Mark with MarkExists, and a blank or over-long reason
  it should accept assert for a past session, so a skipped day can be acknowledged

describe("withdraw")
  it should append a Withdrawn version, return Missing, and keep the assertion in history
  it should reject withdraw when no assertion is effective with NothingToWithdraw

describe("precedence")
  it should resolve Available when an exact Mark is saved after an acknowledgment, keeping the acknowledgment history
  it should never return a price for an acknowledged key
```

### T4.6 Market Data: `ResolveFrames` and `ExpectedSnapshot`

Seam: `MarketData.query`, against `fake-indexeddb` with the request-counting wrapper (D2 section 6.0).

```text
describe("Current and Review contexts")
  it should resolve the Expected Mark Date from the as-of instant and return one point frame per Instrument with its date, close instant, and next completed session
  it should return Available for XYZ at Tuesday noon when a Monday Mark exists (AC-MARK-001)
  it should return Missing for 2026-10-12 with Stale context (2026-10-09, 51.20, its revision, its close instant) when only a Friday Mark exists, and Missing without Stale context when there is no earlier Mark
  it should return AcknowledgedUnavailable with Stale context for an acknowledged key
  it should never select a Mark from another date as the exact Mark, and select the corrected revision after a correction
  it should return the same frames for a Review context naming 2026-10-12 as for the Current context at Tuesday noon
  it should return SessionPolicyCoverage and no frames when the as-of instant is outside coverage

describe("Historical point context (A53)")
  it should return Available for (XYZ, 2026-10-09) from a Friday Mark when asked at Tuesday noon
  it should return NotASession for Saturday 2026-10-10 and SessionNotCompleted for Tuesday at Tuesday noon

describe("snapshot binding and ExpectedSnapshot")
  it should return equal MarketDataSnapshotIds and evidence digests for the same evidence and request, whatever the Instrument order
  it should include the session-policy revision in the binding
  it should return SnapshotUnchanged for the same request when nothing material changed
  it should return SnapshotChanged with current frames when a selected Mark, an acknowledgment, a Stale-context Mark, or an absence changed

describe("bounded reads (A47)")
  it should read all exact-date observations with one request and Stale context with one request per Missing Instrument, whether each Instrument has 10 or 1,000 earlier Marks
```

### T4.7 Market Data: `recover` without a provider

Seam: `MarketData.recover`. Fixture: MNO opened Wednesday 2026-10-07 10:00, with Marks for 10-07 and 10-08; XYZ (reference Trade); Review Date 2026-10-12.

```text
describe("recover without a provider (A56)")
  it should return Review-date frames, current resolutions, the MarketDataSnapshotId, and a NotConfigured diagnostic, and write nothing
  it should list Friday 2026-10-09 as MNO's historical gap and no gap for XYZ, whose relevance starts on 2026-10-12
  it should list acknowledged earlier sessions separately from Missing ones
  it should start relevance at the first session whose close is at or after the earliest exposure, so a first fill at Monday 17:00 starts relevance on Tuesday
  it should return the current-date Missing keys (MNO and XYZ on 2026-10-12) as Manual tasks
  it should issue one gap request per Instrument, whatever the history length
```

### T4.8 Trade Analysis: derive at a cutoff

Seam: `TradeAnalysis.derive` (pure).

```text
describe("derive at an economic cutoff")
  it should derive Position and Lots from facts at or before the cutoff only (the reference Trade at Monday 10:30 has 60 shares)
  it should report exposure start as the first effective opening Execution's Economic Time, moving earlier when an earlier-dated Position Change is supplied
  it should require an exact Mark on the valuation date for each Instrument with remaining quantity at the cutoff, with earliest relevance at its exposure start, and nothing for a Planned Trade
```

### T4.9 Trade Analysis: valuation and availability

Seam: `TradeAnalysis.evaluate` (pure). Frames are built in the test.

```text
describe("Mark-to-Market valuation (after PC2, Mark 52.00 for 2026-10-12)")
  it should return valuation date 2026-10-12, coverage Available with the Mark revision, open quantity 100, open cost $5,018.00, unconsumed opening fees $2.00, and market value $5,200.00
  it should return remaining-open marked P&L $180.00, realized-to-date $0.00, Current Marked Trade P&L $180.00 (18/25 R), and incurred fees $2.00, each as its own Calculation Result
  it should use the remaining Position after PC3 and return $199.00 at the same Mark (AC-CALC-001)

describe("Missing Mark (AC-CALC-002, single Instrument)")
  it should return the open component, Current Marked Trade P&L, and its Plan-R conversion as Unavailable(MarkMissing) naming XYZ and the frame's date
  it should keep realized-to-date, incurred fees, Plan Baseline, 1R, and Entry Quality as Values
  it should carry Stale context as disclosure only, so no current figure changes when its price changes
  it should return no covered subtotal for a single-Instrument Trade (A43)
  it should return Unavailable(AcknowledgedUnavailable) for an acknowledged key, never a value
  it should return every current figure of a Planned Trade as NotApplicable(NoRemainingPosition)

describe("Lots opened after the frame's close (P12, A54)")
  it should return current figures as Unavailable(AwaitingClose after 2026-10-12) when PC2 (40 @ 50.30) is dated Tuesday 10:00 and the frame is Monday's
  it should return at-entry figures for those 40 shares: average entry 50.30, risk from entry $112.00, reward from entry $228.00, labelled at entry
  it should evaluate the state derived at Monday's close with Monday's Mark as the dated line: 60 shares, P&L $113.00, risk to stop $270.00, worst case $3,120.00, reward $240.00

describe("dated last close with a Missing Mark (P13, A54)")
  it should, given only a Friday Mark and Monday fills, return no dated line (no exposure at Friday's close) and at-entry figures for all 100 shares: risk from entry $268.00, reward from entry $582.00
```

### T4.10 Trade Analysis: risk and reward

Seam: `TradeAnalysis.evaluate` (pure), reference Trade after PC2.

```text
describe("ongoing risk and reward (Mark 52.00)")
  it should return Ongoing Risk to Stop $450.00 (9/5 R), Worst-Case Ongoing Risk $5,200.00 (104/5 R), Incremental Reward to Target $400.00 (8/5 R), and Maximum Incremental Reward Unbounded(Above)
  it should return Maximum Incremental Reward Unbounded(Above) when the Mark is Missing, and the other three as Unavailable(MarkMissing)

describe("Stop crossed (Mark 47.00)")
  it should report the Stop Breached, Ongoing Risk to Stop $0.00, Stop Overrun $50.00 (1/5 R), Worst-Case $4,700.00, Incremental Reward $900.00, and Current Marked Trade P&L −$320.00 (−32/25 R)
  it should report a Mark of exactly 47.50 as Breached with Overrun $0.00 (A42)
  it should return no Deviation occurrence (A44)

describe("Target reached (Mark 57.00)")
  it should report the Target Reached, Incremental Reward to Target $0.00, Target Overrun $100.00 (2/5 R), and Ongoing Risk to Stop $950.00 (19/5 R)
  it should not classify the reached Target as a Deviation (AC-CALC-003)

describe("per-condition status")
  it should return each Stop and Target condition with its identity, kind UnderlyingPrice, boundary, status, distance in dollars and Plan R, Overrun when crossed, and its evidence (Instrument, date, Mark revision)
  it should return each condition as Unavailable with the Mark's reason when the Mark is Missing or acknowledged
  it should return the observation binding it used and deep-equal results for identical inputs
```

### T4.11 Trade Record: exposure start and `StateAtEconomicCutoff`

Seam: `TradeRecord`, against `fake-indexeddb`.

```text
describe("exposure start")
  it should store exposureStart in the Trade document at each Position Change commit, as supplied by the reconciliation, moving it earlier for an earlier-dated Position Change (P5)

describe("queryRecords: StateAtEconomicCutoff Open (A55)")
  it should return Open Trades whose exposure started at or before the cutoff, excluding an Open Trade whose first fill is after it and every Planned Trade
  it should read each page with one lifecycle-index getAll and return AnalysisInput for the page from one read snapshot
```

### T4.12 Journal: Daily Trade Review

Seam: `Journal`.

```text
describe("seedDefaults: manifest v3")
  it should add the Daily Trade Review Entry Type, its definition revision 1, and the Daily Review Source, and nothing else, to a v2-seeded Journal
  it should match the contract exactly: "Action" required workflow-critical Single Select (Hold, Exit, Roll, Adjust); "Why are you taking this action?" Text required when Action is Exit, Roll, or Adjust; "Conviction now" optional Scale 1–5; "Anything you considered doing and decided against?" optional Text; "Note" optional Text, in that order
  it should add nothing when run again

describe("prepareEffects: Daily Trade Review (CompleteNow)")
  it should prepare an Entry with the definition snapshot, a Trade Anchor, Source Daily Review, origin DailyReview (Trade, Review Date), moment time at the Review cutoff, and authored time from the clock
  it should accept Hold with no Intent and return RequiredAnswerMissing for Exit, Roll, or Adjust without Intent
  it should reject Defer and Decline with DispositionNotAllowed

describe("edit by expected revision (AC-JOUR-005)")
  it should append a version under the same Entry identity, using the original definition snapshot, when the obligation already has an Entry and the expected Entry revision matches
  it should return Conflict when the expected Entry revision is stale, and fail the transaction on a second new Entry for the same key

describe("query")
  it should return every Action for a Review Date with one range read, keyed by Trade
  it should include Daily Trade Review Entries, with an Edited indicator when they have more than one version, in the Trade narrative
```

### T4.13 Section validators

Seam: `validateSection(snapshot)` exported by Market Data and Journal, returning `{ issues, repairs }`. D8's `prepareRestore` reuses them.

```text
describe("Market Data section")
  it should accept observation records with continuous Mark and acknowledgment chains and correct effective heads
  it should report a missing or duplicated revision identity, an effective head that is not the chain's last entry, a Correction without a reason or footprint, an Asserted acknowledgment while a Mark is effective, a price that is not a positive finite decimal, and a key whose date is not a covered session under the stored policy

describe("Journal section, Daily Trade Review")
  it should accept Action Entries with version chains under their obligation keys
  it should report two Entries for one (Trade, Review Date) key and an Edit version whose definition snapshot differs from the first version's
```

### T4.14 Daily Review: `open`

Seam: `DailyReview.open`, against `fake-indexeddb`, with the five-Trade fixture at Monday 17:00 unless stated.

```text
describe("date and eligibility (P9, P15, A55)")
  it should resolve LatestCompleted to 2026-10-12 with cutoff 16:00 at Monday 17:00, and to Friday 2026-10-09 at Monday 16:15
  it should include a Trade whose first fill is before the cutoff and exclude one whose first fill is at 16:05, though both are Open now (AC-REV-001)
  it should make a Trade eligible after an earlier-dated Position Change moves its exposure start before the cutoff
  it should return Empty when no Trade is eligible and no task exists

describe("task families (AC-REV-002, AC-MARK-004)")
  it should return the Marks family first, listing DEF's Review-date Mark as a Manual task, then the Trade walk
  it should list one Mark task for an Instrument shared by two eligible Trades, naming both
  it should list skipped sessions (MNO 2026-10-09) as historical gaps marked nonblocking
  it should write nothing

describe("attention order")
  it should order the fixture T-D, T-B, T-C, T-A, T-E, returning each Trade's band, reasons, and selected basis (risk to stop and reward to target, or the missing input)
  it should keep T-B in boundary reached although its risk to stop is zero
  it should break equal pressure by Last Activity descending, then Trade identity
  PENDING P14: it should place T-E in the band P14 assigns to its pressure of 2/9

describe("completion")
  it should report Incomplete listing DEF's missing Review-date Mark and each Trade without an Action
  it should report Complete when every eligible Trade has an Action and every Review-date Mark is exact (fixture without T-D)
  it should report CompleteWithUnavailableMarks naming DEF, T-C, and the affected calculation families when DEF is acknowledged and every Action is saved (fixture without T-D)
  it should report Incomplete while T-D's integrity disagreement remains, even with an Action saved (A59)
  it should leave historical gaps out of completion
  it should derive completion from facts only, with no stored Review, stage, or flag
```

### T4.15 Daily Review: `getTrade`

Seam: `DailyReview.getTrade`.

```text
describe("getTrade")
  it should return the Trade's summary, labels, Review-date frame with Stale context, Review-context evaluation, the existing Action or a new form with Hold preselected only in view state, the definition revision, and the save binding
  it should include the dated last-close and at-entry lines when the Review-date Mark is Missing (P13)
  it should return ReviewChanged when the Trade's revision or its evidence no longer matches the overview binding
  it should record nothing
```

### T4.16 Daily Review: `save` (`SaveTradeAction`)

Seam: `DailyReview.save`.

```text
describe("SaveTradeAction (AC-REV-003)")
  it should save Hold with no Intent as one Daily Trade Review Entry and return the Entry, the revised progress and completion, and the next step
  it should reject Exit, Roll, or Adjust without Intent, and save them with Intent while creating no Trade fact
  it should edit the same Entry identity when the Action is saved again with the expected Entry revision

describe("changed evidence (AC-REV-005)")
  it should return ReviewChanged with refreshed evidence and write nothing when a Mark, an acknowledgment, or the Trade's facts changed since the binding
  it should return Conflict and write nothing when another Action was saved for the same Trade and date since the binding

describe("write gate")
  it should return RuntimeNotWritable and write nothing when the mutation-boundary readiness recheck fails
```

### T4.17 Workspace: migration, seeds, policy compatibility

Seam: `Workspace.initialize` and `getStatus`. The Node composition root accepts a test session policy (disclosed in section 6.0).

```text
describe("migration to schema 3")
  it should migrate a v2 Workspace and return Opened with a receipt naming 2 → 3, per-store counts, seed additions (Daily Trade Review, Daily Review Source), and the recorded session-policy identity
  it should migrate a v1 Workspace to schema 3 in one candidate
  it should keep every earlier field of the Planned and Open lists and Details equal to the pre-migration views, with each current figure Unavailable(MarkMissing) (A51)
  it should return MigrationBlocked with the old stores unchanged when candidate validation fails, and Opened after Retry once the cause is removed

describe("session-policy compatibility (A40)")
  it should record a newer policy revision that only extends coverage, with no findings
  it should keep an observation record whose date the newer policy turns into a closure, list it as a finding in the receipt, and leave it out of every frame
```

### T4.18 Trade Views: current evaluation

Seam: `TradeViewsAndReporting.browseTrades` and `getTradeDetail`.

```text
describe("browseTrades: Open with current evaluation")
  it should add to each item the Expected Mark Date, its Mark resolution, remaining-open marked P&L, Current Marked Trade P&L, Ongoing Risk to Stop, Worst-Case Ongoing Risk, Incremental Reward to Target, Maximum Incremental Reward, their Plan-R conversions, and Stop and Target status, each with its own availability
  it should return Unavailable figures naming the Instrument and date when the Mark is Missing, with the dated last-close and at-entry lines (P13), never fill cost or zero
  it should return AwaitingClose figures with the dated and at-entry lines when Lots opened after the Expected Mark Date's close (P12)
  it should derive and evaluate each Trade once, plus once more at the dated line's close only for Trades that need it
  it should bind the Trade, Journal, Catalog, and Market Data revisions and the MarketDataSnapshotId of one Workspace content revision, retrying when a write lands between phases and returning ChangedDuringAssembly after 3 retries (A46)

describe("getTradeDetail: Open with current evaluation")
  it should return valuation with per-Instrument coverage, the P&L components, risk and reward with Plan R, every condition's status and Overrun, the dated and at-entry lines when present, and the Mark's source, revision, save time, and correction reason
  it should include Daily Trade Review Actions in the narrative
  it should return Planned Detail without current evaluation and leave every content revision unchanged after reading
```

### T4.20 UI: Mark entry

Seam: `MarkEntry` with a facade test double. It is used by the Review's Marks family.

```text
describe("entering, correcting, acknowledging, withdrawing")
  it should submit an initial Mark with the Instrument, date, price, and expected resolution revision, then render the saved resolution from the result without a read call
  it should open Correct with the effective price shown, require a reason, and submit the new price and reason
  it should submit "Can't get a price" with a required reason and render Acknowledged Unavailable as a trader acknowledgment, never as a price
  it should offer Withdraw on an acknowledged key and render Missing afterwards
  it should show InvalidPrice, ReasonRequired, ReasonTooLong, CorrectionUnchanged, and MarkExists beside their fields and move focus to the first
  it should show Conflict with the entered values kept and the current resolution displayed
  it should make no call when cancelled or left, register as unsaved while a value has been entered, and offer its actions only while Writable
```

### T4.21 UI: Review overview and Marks family

Seam: `ReviewView` with a facade test double.

```text
describe("overview")
  it should show the Review Date, completion as text (Incomplete, Complete, or Complete with Unavailable Marks), and each blocker
  it should render distinct Loading, Ready, Empty ("No Trades were open at this session's close"), and Error (with Retry) states
  it should name the Instruments, Trades, and calculation families when completion is Complete with Unavailable Marks

describe("Marks family (P11, P15)")
  it should list Today's Mark tasks first, each shared Instrument once with its Trades, using MarkEntry
  it should list "Earlier sessions without Marks — optional" per Instrument, newest first, 20 per page, and say they do not block the Review
  it should focus the Instrument named by the link it was opened from

describe("moving on")
  it should call open again when Continue to Trades is pressed, then show the Trade walk in the returned order with band labels and reasons as text
  it should resume from the returned state after a reload, showing saved Actions and Marks without any stored session
```

### T4.22 UI: Trade walk and Action form

Seam: `ReviewTrade` and `ActionForm` with a facade test double.

```text
describe("Trade in the walk")
  it should show the Trade's figures for the Review Date, the dated and at-entry lines when present, and its attention reasons

describe("Action form (AC-REV-003)")
  it should render Action as a radio group in a labelled fieldset with Hold selected, and one visible Save
  it should save Hold with one press of Save and move to the next Trade from the returned next step without calling open or getTrade
  it should require Intent when Exit, Roll, or Adjust is selected, showing the issue beside the field
  it should show a saved Action with its values and allow changing it, submitting the expected Entry revision
  it should show ReviewChanged with the entered values kept and offer Refresh
  it should make no call when the trader leaves, and register as unsaved only after a value differs from the returned state
```

### T4.23 UI: Open list figures

Seam: `TradeList` with a facade test double.

```text
describe("Open list current evaluation")
  it should show per row the Mark status, Current Marked Trade P&L with sign, Risk to stop and Reward to target in dollars and R, and "Stop breached" or "Target reached" badges with text, right-aligned in tabular numerals
  it should show "Mark missing: XYZ, Oct 13" linking to the Review's Marks family in place of each Mark-dependent figure, never a number, plus the dated line's P&L labelled with its date when present
  it should show "Awaiting the next close" with the at-entry risk labelled "at entry" when the evaluation reports AwaitingClose
  it should give each compact heading its canonical term in its accessible name (for example "Risk to stop" is "Ongoing Risk to Stop")
```

### T4.24 UI: Trade Detail

Seam: `TradeDetail` with a facade test double.

```text
describe("valuation")
  it should show the Expected Mark Date, the Mark price, source Manual, save time in the Workspace zone, and a "Corrected" badge with its reason when the effective revision is a Correction
  it should show realized to date, open, Current Marked Trade P&L, and incurred fees as separate figures with units and signs

describe("risk and reward")
  it should show Original risk, Risk to stop, Worst case, Reward to target, Max reward, and Original reward with dollars and R, rendering Unbounded as "Unbounded" and Unavailable with its reason, never as 0
  it should show each condition with its boundary, status as text, distance, and Overrun when crossed

describe("missing or later evidence (P12, P13)")
  it should show "Mark missing for XYZ on Tue Oct 13", the Stale context labelled stale, an "At Mon Oct 12 close" section with its own figures, and a link to the Review's Marks family
  it should show an "At entry" section for shares bought after the dated close, with risk and reward labelled from entry and no P&L

describe("Actions")
  it should list Daily Trade Review Actions in the narrative with Review Date, Action, Intent, and an Edited indicator
```

### T4.25 UI: coverage notice and About

Seam: `AppShell` and `AboutView` with a facade test double.

```text
describe("session-policy coverage")
  it should show in About the session policy's id, revision, and coverage range
  it should show a shell notice when today is outside coverage, saying valuation and review need an updated release, while every other control stays enabled
```

---

## 5. Structural tasks

| Task | Verification (exact) | Expected result | Behavior that depends on it |
|---|---|---|---|
| T4.2 Session-policy verification | `npm run verify:session-policy` | `src/domain/session-policy/nyse-published.json` transcribes NYSE's published holiday and early-close calendars, and its historical closings record, for every covered year, each year with its source and retrieval date. The check generates every non-session weekday and every early close for every covered year from the rules and table, and requires exact equality with the transcription. It also fails if the digest changed while the declared revision did not. | T4.1's coverage claim (P8); every Expected Mark Date and Review Date. |
| T4.19 Capability manifest, composition, dependency rules | `npm run verify:capabilities`; `npm run lint:deps`, then the same command on the new fixtures in `tools/dep-fixtures/` | The manifest adds `MarketData.save` (initial, correction, assert, withdraw; Stock Instruments), `MarketData.query` (`ResolveFrames` with Current, Review, and Historical point contexts), `MarketData.recover` (no provider adapters), `DailyReview.open` (`LatestCompleted`), `getTrade`, `save` (`SaveTradeAction`), current evaluation in `browseTrades` and `getTradeDetail` for Open Trades, the Daily Trade Review Entry Type, schema version 3, and the session-policy identity. The Review destination appears in navigation, and nothing beyond D4 is reachable. The new dependency fixtures fail with their named rules: Trade Analysis or Daily Review importing the session policy. | AC-CAP-001; Trade Analysis purity. |
| T4.26 Faults-build clock pin | `npm run build:faults && npm run verify:no-fault-hooks` | `dist-faults/` accepts `?clock=<ISO instant>` and fixes `Date` to it for that launch (A49). `verify:no-fault-hooks` confirms production `dist/` contains no clock-pin hook. | C4.6–C4.8. |
| T4.27 Previous-release harness | `npm run build:releases && npm run verify:releases` | `dist-releases/d2` is built from tag `claude-opus-5.5-d2` (A50), alongside the existing folders and a current `d4`. `verify:releases` confirms `d2` reports schema 2 and its own release identity. | B4.7, C4.10. |
| T4.28 Capacity basis | `npm run measure:capacity`, then `npm run verify:capacity` | The measurement adds 2,000 Marks (1% corrected), 100 acknowledgments, and 2,000 Daily Trade Review Actions through the facade, and replaces the Marks and Daily Trade Review allowances with measured bytes. Daily Bars stay an allowance until D11. `capacity-basis.json` carries schema version 3, and `verify:capacity` fails if it still names schema 2. | Capacity readiness check (decision 18). |
| T4.29 Schema fixtures | `npm run fixtures:freeze -- --schema 3`, then `npm run verify:fixtures` | The v3 dump adds to D2's fixture content: Marks (one with a Correction), an acknowledgment, a skipped-session gap, and Actions (Hold, and Exit with Intent and one edit) for one Review Date, as of Monday 17:00. `verify:fixtures` migrates the v1 and v2 dumps and checks their views per A51, then checks that the v3 dump opens Ready and that its lists, Details, and Review equal its own snapshot. | Migration from every earlier version; D5 onward. |
| T4.30 Benchmark generator | `npm run build:bench && npm run bench:generate` | The generator adds the Marks and Actions in section 1.3, session by session, through the production facade, and records the as-of instant, the Missing Instruments, and every count in `bench/dataset.json`. Changing the generator version regenerates the cached profile. | T4.31. |
| T4.31 Latency harness and query count | `npm run bench:run`; `npm run test:integration -- d4/query-count` | As D2's T2.21, with `Date` pinned to the as-of instant (A52), and with `tj:interactive` and `tj:open-list-ready` now requiring every Open row's figures to have rendered. Results go to `evidence/D04/bench.md`. The harness fails if cold p95 exceeds 2,500 ms or warm p95 exceeds 1,500 ms. Before and after the runs, it compares every Open row's figures with the generator's expected values, including the 10 Missing Instruments. The Node test shows the following counts, which are the same whether each Instrument has 100 or 1,260 sessions of history: one Open page issues one `getAll` on `trades`, one `getAll` on `observations`, and one `byInstrumentDate` request per Missing Instrument; a Review `open` issues one lifecycle-index `getAll`, one `observations` `getAll`, one gap request per Instrument, and one `journalObligations` range read. | AC-PERF-001. |
| T4.32 Node integration suite | `npm run test:integration` | Every case in sections 6.1 of D1, D2, and D4 passes. | Cumulative regression. |
| T4.33 Browser integration suite | `npm run test:e2e` (Chromium) | Every case in sections 6.2 of D1, D2, and D4 passes. | Cumulative regression. |
| T4.34 Browser critic | Fresh critic agent per section 7 | A structured report with every flow passing. | Deliverable gate. |

---

## 6. Mock-free integration tests

### 6.0 Disclosed test substitutes

D1's and D2's substitutes still apply (`fake-indexeddb`, `NodeTestHost`, fixed clock and identities, release harness, faults build, Chromium as the routine engine, read-only probe, in-process lifecycle lock, integrity fixture writer, migration fault stages, request-counting wrapper, bench build). D4 adds:

| Substitute | Used in | Replaces | Why it does not weaken the contract |
|---|---|---|---|
| Test session policy passed to the Node composition root | I4.11 | the release's built-in policy | Only the policy's table and revision differ; the compatibility check, Market Data, and every view are production code. In production a policy change arrives only with a new release, which B4.7 exercises for the schema change. |
| Faults-build clock pin (A49) | C4.6–C4.8 | the system clock | It fixes `Date` at the host boundary only. The production bundle provably has no hook, and the browser suite uses Playwright's clock control on the unmodified production build instead. |
| Playwright `clock.setFixedTime` in the benchmark and generator (A52) | T4.30, T4.31 | the system clock | Only `Date` is pinned. Timers and `performance.now` stay real, and measurement runs the production build. |

### 6.1 Node application-stack suite (`tests/integration/d4/`)

Conventions are as in D1 and D2. Clocks are fixed per case.

| Case | Given / When | Then (visible result and durable-state proof) |
|---|---|---|
| I4.1 Migrate earlier fixtures | Load `workspace-v1/` and, separately, `workspace-v2/`; `initialize`; restart; `getStatus`. | Opened with a migration receipt naming the seed additions and session-policy identity. After restart, each is Ready at schema 3; views follow A51; `observations` is empty; the pointer names a new database and no candidate is listed. |
| I4.2 Migration failure and retry | `workspace-v2/` with one Trade's Account reference changed to an unknown identity; `initialize`; restore the reference; Retry. | MigrationBlocked naming the issue; old stores equal the fixture apart from the IndexedDB version; no candidate; never Ready. After Retry: Opened, and Ready after restart (AC-REST-004, re-proven). |
| I4.3 Value a Trade | Reference Trade through PC2; clock Monday 17:00; save XYZ 52.00 for 2026-10-12; restart; `browseTrades` Open; `getTradeDetail`. Then record PC3 and read again. | The save result's resolution equals the stored record (AC-RESP-001). List and Detail show $180.00 (0.72R), risk $450.00, worst case $5,200.00, reward $400.00, max reward Unbounded. After PC3: $199.00 and risk $540.00 (AC-CALC-001). Dump: one `observations` record with one Mark revision; `marketDataRevision` 1. |
| I4.4 Expected Mark Date and Stale context (AC-MARK-001, AC-CALC-002) | Clock Tuesday noon. Workspace A: Monday Mark 52.00. Workspace B: only a Friday Mark of 51.20. Read both; restart; read again. | A: Expected Mark Date 2026-10-12, Available, not Stale, figures as I4.3. B: Missing for 2026-10-12 with Stale 51.20 on 2026-10-09; Mark-dependent figures Unavailable naming XYZ and 2026-10-12; no dated line; at-entry risk $268.00 and reward $582.00; realized-to-date, fees, Plan Baseline, and Entry Quality still Values; no figure uses 51.20. Same after restart. |
| I4.5 Correct a Mark | After I4.3 (PC2 only): correct to 51.50 with a reason; then submit another correction with the original binding. | Correction classification and footprint in the result; Detail shows $130.00, risk $400.00, reward $450.00, Corrected. Dump: two revisions. The stale correction returns Conflict, and the dump is unchanged. |
| I4.6 Shared Instrument | Two Open Trades on XYZ; Review at Monday 17:00; save one Mark from the Mark task. | One Mark task naming both Trades; both evaluate with the same Mark revision; one `observations` record. |
| I4.7 Stop crossed and Target reached (AC-CALC-003) | Two Workspaces at Marks 47.00 and 57.00. | Per-condition statuses, Overruns, and headlines as in T4.10; recorded Deviation occurrences unchanged (dump comparison). |
| I4.8 Mark rejections write nothing | Saves for a Saturday, Thanksgiving 2026, Tuesday at Tuesday 16:10, a 2030 date, price 0, a correction with a blank reason, an initial Mark on an existing key, and an acknowledgment on a key with a Mark. | Each typed rejection or Conflict; all store dumps unchanged. |
| I4.9 Write gate | Host fails the inventory check; call `MarketData.save` and `DailyReview.save` through the facade and `Persistence.commit` directly. | `RuntimeNotWritable` at every boundary; dumps unchanged; the Review, Open list, and Detail still readable (AC-DEL-004, AC-DEL-006). |
| I4.10 Rebuild equivalence | After I4.13: capture the Review, Open list, and Details; run `rebuildPrivateState`; capture again. | Normalized views equal; `byInstrumentDate` and `journalObligations` rebuilt with identical contents (AC-REBUILD-001). |
| I4.11 Session-policy revision change | Marks on 2026-10-12 and 2026-10-13; restart with test policy revision 2 (coverage extended), then revision 3 (2026-10-13 a closure). | Revision 2: no findings; `meta.sessionPolicy` updated. Revision 3: the 2026-10-13 record listed as a finding and kept; frames skip it; at Wednesday 17:00 the Expected Mark Date is 2026-10-12. |
| I4.12 Fresh initialization at schema 3 | Empty factory; `initialize(zone)`. | Schema 3 created directly with the session-policy identity; Journal seed manifest v3 with all three reflection and review types; no migration. |
| I4.13 Review end to end (AC-REV-002, AC-REV-006, AC-MARK-003) | Five-Trade fixture without T-D; Monday 17:00. `open`; save Marks for XYZ, ABC, JKL and acknowledge DEF; `open`; save Hold for T-A with one call and Actions for the rest (T-B Exit with Intent); restart; `open`. Then save DEF 40.50 and `open`. | First open: Marks family then Trades; Incomplete. After the acknowledgment and Actions: CompleteWithUnavailableMarks naming DEF and T-C. After restart: the same, from facts. After DEF's Mark: Complete, with the acknowledgment still in DEF's history. Dump: four Action Entries under `('DailyTradeReview', 2026-10-12, Trade)` keys, no Review-session record, no Trade fact added. |
| I4.14 Eligibility at the cutoff (AC-REV-001) | Monday 17:00: Trade P opened at 10:00, Trade Q first filled at 16:05. `open`. Then record an earlier-dated fill for Q at 15:00 and `open` again. | Only P is eligible at first; after the earlier-dated fill, Q is eligible and the Review is Incomplete again until Q has an Action. |
| I4.15 Changed evidence (AC-REV-005) | `getTrade` for T-A; then (a) correct XYZ, (b) acknowledge and withdraw on another bound key, (c) record PC3, (d) save an Action for T-A from a second binding; then `save` with the first binding. | (a)–(c) ReviewChanged with refreshed evidence; (d) Conflict; dumps unchanged after each failed save. |
| I4.16 Action retry and edit (AC-JOUR-005) | Save Hold for T-A; save Exit with Intent using the returned Entry revision; save again with the old revision. | One Entry identity with two versions sharing the original definition snapshot; the stale save returns Conflict. |
| I4.17 Skipped sessions (AC-MARK-004, P15) | MNO opened Wednesday 2026-10-07 with Marks for 10-07 and 10-08; Review Monday 17:00. Save Monday's Mark and an Action; then enter Friday's Mark from the gap list. | Before Friday's Mark: Complete, with Friday listed as an optional gap. After: no gap; `observations` holds Friday's record. |
| I4.18 Intraday and missing lines (P12, P13) | (a) Clock Tuesday noon, Monday Mark 52.00, PC1 Monday and PC2 (40 @ 50.30) Tuesday 10:00. (b) Clock Tuesday 17:00, Tuesday Mark absent. Read Detail in each. | (a) AwaitingClose; dated line At Mon Oct 12 close: 60 shares, $113.00, risk $270.00; at-entry: 40 shares, risk $112.00, reward $228.00. (b) Mark missing for Tue Oct 13; dated line At Mon Oct 12 close for the Position held then; no current figure uses Monday's Mark. |

### 6.2 Browser suite (`e2e/d4/`, Playwright against the built app on `localhost:5175`)

Chromium only (decision 19). Dates are set with Playwright's clock on the production build. Durable state is proven by reload or full browser restart plus D1's read-only probe. RC later repeats B4.7–B4.9 in all three engines.

| Case | Procedure | Expected observable result and durable-state proof |
|---|---|---|
| B4.1 Daily Review end to end | Clock Monday 17:00; the five-Trade fixture without T-D created through the UI. Open Review; enter four Marks; Continue to Trades; press Save on T-A's form (Hold preselected); give the others Actions; relaunch; open Review. | Marks family first; Trades in attention order with reasons; after relaunch, Complete with every Action shown. The probe shows four Action Entries and four `observations` records. |
| B4.2 One-click Hold and Intent | On a new Action form: leave; reopen; choose Exit without Intent and Save; add Intent and Save. | Leaving records nothing and the Review stays Incomplete; Exit without Intent shows the error; with Intent it saves; no Trade fact is added. |
| B4.3 Can't get a price | Acknowledge DEF with a reason; finish the Actions; then withdraw; then enter a Mark. | Complete with Unavailable Marks naming DEF; after withdrawing, Incomplete; after the Mark, Complete; the probe shows the acknowledgment history kept. |
| B4.4 Correct a Mark | In the Marks family, Correct XYZ 52.00 to 51.50 with a reason; open the Trade. | Detail shows Corrected with the reason and +$130.00; the probe shows two revisions. |
| B4.5 Expected Mark Date (AC-MARK-001) | Trade opened Thursday 2026-10-08. Clock Friday 17:00: enter 51.20 in the Review. Clock Tuesday noon: open the Trade, then the Review, and enter 52.00 for Monday; open the Trade again. | Before: "Mark missing for XYZ on Mon Oct 12", "last 51.20 on Fri Oct 9 (stale)", an "At Fri Oct 9 close" section, and no current dollar figure. After: Available for Oct 12, not stale. |
| B4.6 Skipped sessions | MNO opened Wednesday 2026-10-07 with Marks for 10-07 and 10-08; clock Monday 17:00; open Review. Enter Monday's Mark and an Action; then Friday's Mark from the optional list. | Friday is listed as optional and the Review reaches Complete without it; after entering it, the list is empty. |
| B4.7 Update from D2 with data | Harness serves `d2`; create two Open Trades; switch to `d4`; Reload from the update notice; open Review. | "Updating your journal" shows; the Review lists both Instruments' Marks; entering a Mark and an Action works; About shows schema 3 and the session policy. The probe shows the new pointer target and no old database. |
| B4.8 Kill after commit | SIGKILL right after an Action save result renders; relaunch. | The Action is present; the Review resumes from it. |
| B4.9 Offline cold restart | After B4.1 on the next session (clock Tuesday 17:00), close; relaunch offline; complete that Review. | Writable offline; Marks and Actions save and survive another offline restart (AC-DEL-001). |
| B4.10 Recovery Only (*faults build*) | Existing Review data; relaunch with `?faults=control`. | Review, Open list, and Detail readable; no Mark entry or Save; probe unchanged. |
| B4.11 Mid-session failure (*faults build*) | Fill an Exit Action with Intent; `__tjFaults.set(["inventory"])`; Save. | `RuntimeNotWritable` explained; values kept; no Entry (AC-DEL-006). |
| B4.12 Nothing saved without Save | Type a Mark price, a correction reason, and an Action with Intent and Note; resize; navigate away; restart. | No new observation revision or Entry; no entered value in Web Storage (AC-JOUR-001). |
| B4.13 Responsive and accessible | Half-fill an Action form at 1280 px; resize to 390 px and back; run axe on the Review (all states and both families), the Action form, the Open list with Available, Missing, and AwaitingClose rows, and Detail with every evaluation state; complete a Review using the keyboard only. | Values survive; layout switches at 960 px; no WCAG 2.1 AA violations; Unavailable, Unbounded, Missing, Stale, Acknowledged Unavailable, and at-entry figures are distinguishable without colour (AC-UI-001, AC-UI-002). |
| B4.14 Breach, overrun, and intraday lines | Clock Monday 17:00, Mark 47.00. Then clock Tuesday noon after recording 40 more shares at Tuesday 10:00. | Stop "Breached", Risk to stop $0.00, Stop Overrun $50.00, no Deviation listed. Then "Awaiting the next close" with an "At Mon Oct 12 close" section and an "At entry" section for the 40 shares. |

---

## 7. Browser-critic flows

The critic receives the frozen `specs/`, the plan index, the D1, D2, and D4 breakdowns, and the list of future capabilities that must not be treated as defects. Those are everything after D4, including:
- deferred reflection and due Debt;
- exits and their Daily Review link;
- options and Settlement Due;
- opening an exact past Review date;
- provider prices;
- Stop Discipline Deviations;
- Mark and Journal history views;
- backup.

It runs `npm run build && npm run preview` (port 5175) itself, plus `npm run serve:releases` for C4.10 and `npm run preview:faults` for C4.6–C4.8 and C4.11. It does not edit code.

| Flow | Actions | Pass condition |
|---|---|---|
| C4.1 First Review | With two Open Trades on different symbols, open Review after the close; enter both Marks; Continue to Trades; press Save on the first Trade's form without changing it; give the second an Action. | Marks come first; each Trade shows P&L, risk to stop, worst case, reward to target, and R; the first saves Hold in one press; the Review reads Complete. |
| C4.2 Attention order | Create Trades that breach a Stop, lack a Mark, and are comparable with different pressures; open the Review. | Breached first, then the Missing-Mark Trade, then comparable Trades by pressure; each shows its reason in words. |
| C4.3 Exit, Roll, Adjust | Choose each without Intent, then with Intent. | Intent is required; with it each saves as intent only and no Position Change appears. |
| C4.4 Can't get a price | Acknowledge one Instrument with a reason; finish; then withdraw; then enter a price. | Complete with Unavailable Marks naming it; Incomplete after withdrawing; Complete after the price. |
| C4.5 Correct | Correct a Mark without a reason, then with one; open the Trade. | Reason required; Detail shows Corrected and the new figures. |
| C4.6 Missing and Stale | Faults build. `?clock=2026-10-09T21:00:00Z`: create a Trade with Plan and fill on Thursday 2026-10-08 and enter 51.20 in the Review. Relaunch with `?clock=2026-10-13T16:00:00Z` and open the Trade, then enter Monday's Mark. | Before: Mark for Mon Oct 12 missing, 51.20 labelled stale, an "At Fri Oct 9 close" section, no current dollar figure. After: Monday's Mark is current and not stale. |
| C4.7 Bought today | Faults build with `?clock=2026-10-13T16:00:00Z`: on a Trade valued at Monday's close, record 40 more shares at Tuesday 10:00. | Current figures await the next close; "At Mon Oct 12 close" and "At entry" sections show, the latter with risk and reward from entry and no P&L. |
| C4.8 Skipped sessions | Faults build with `?clock=2026-10-12T21:00:00Z`: a Trade opened Wednesday 2026-10-07 with a Mark only for that day. Open the Review; complete it without the optional sessions; then fill them. | Thursday and Friday appear as optional; the Review completes without them; filling them empties the list. |
| C4.9 Resume | Save some Actions, reload, reopen the Review. | Saved Actions and Marks show; progress continues; nothing else was recorded. |
| C4.10 Update with migration | Harness serves `d2`; create Open Trades; switch to `d4`; reload from the notice; open Review. | Migration message; the Review lists the Trades' Marks; Marks and Actions can be saved; About shows schema 3 and the session policy. |
| C4.11 Recovery Only | Faults build: complete a Review; relaunch with `?faults=inventory`. | Review and Detail readable; no entry or Save controls. |
| C4.12 Validation, offline, responsive, keyboard, About | Enter price 0 and a 7-decimal price; stop the server and reload, then save a Mark and an Action; resize with a half-filled Action form; complete a Trade's Action by keyboard; open About. | Errors beside the fields; offline saving works; values survive resizing; visible focus; About lists only D1, D2, and D4 capabilities and the session policy. |

---

## 8. Acceptance matrix rows

Status values: `planned`, `covered`, `intentionally not advertised`. All rows are `planned`. AC-DEL rows cite Chromium and faults-build evidence; Firefox, WebKit, and real-state evidence are **pending RC** (decision 19).

| Scenario | Deliverable | Tasks | TDD / structural | Integration case and fixture | Critic flow | Command or procedure | Expected result and durable-state proof | Failure / nonmutation / restart evidence | Status |
|---|---|---|---|---|---|---|---|---|---|
| AC-MARK-001 (full) | D4 | T4.1, T4.2, T4.6, T4.18, T4.24 | T4.1 latest-completed group; T4.6 contexts group; `verify:session-policy` | I4.4; B4.5 | C4.6 | `npm run test:integration -- d4/expected-mark`; `npx playwright test e2e/d4/expected-mark.spec.ts` | At Tuesday noon: Expected Mark Date 2026-10-12, Available, not Stale; with only a Friday Mark: Missing, Stale 51.20 shown as context and absent from every current figure | Restart in I4.4 | planned |
| AC-REV-003 (full) | D4 | T4.12, T4.15, T4.16, T4.22 | T4.16 SaveTradeAction group; T4.22 Action form group | I4.13; B4.2 | C4.1, C4.3 | `npx playwright test e2e/d4/hold.spec.ts` | Leaving records nothing; one Save creates one Hold Entry; Exit, Roll, and Adjust need Intent and create no Trade fact | Before and after Entry queries; Trade dumps unchanged | planned |
| AC-JOUR-001 (full) | D4 | T4.20, T4.22 | "make no call when … left" cases | B4.12 | C4.9 | `npx playwright test e2e/d4/no-save.spec.ts` | No Entry, version, Action, or draft from the Review forms; no Web Storage values | Restart | planned |
| AC-REV-001 (partial: Open-at-cutoff eligibility for the latest session) | D4 | T4.11, T4.14 | T4.14 eligibility group | I4.14 | C4.2 | `npm run test:integration -- d4/eligibility` | A Trade first filled after the cutoff is excluded; an earlier-dated fill restates eligibility | Restart | planned (exact-date open, later-closed Trades, and correction in D15; D6 extends the query) |
| AC-REV-002 (partial: Marks then Trades; shared Mark once; resumption) | D4 | T4.14, T4.21 | T4.14 task-family group | I4.6, I4.13; B4.1, B4.8 | C4.1, C4.9 | `npm run test:integration -- d4/review` | Family order; one shared Mark task; resumption from facts; no Review session or flag | Restart; kill after commit | planned (Debt in D5, settlement in D7) |
| AC-REV-005 (partial: Mark, acknowledgment, Trade fact, existing Action) | D4 | T4.6, T4.16 | T4.16 changed-evidence group | I4.15 | — | `npm run test:integration -- d4/changed-evidence` | ReviewChanged or Conflict with refreshed evidence | Dumps unchanged | planned (Bars in D11, correction in D15) |
| AC-REV-006 (partial: Complete, Complete with Unavailable Marks, Missing stays Incomplete, earlier-dated fill reopens) | D4 | T4.14, T4.21 | T4.14 completion group | I4.13, I4.14 | C4.4 | as AC-REV-002 | Completion states named with Instruments, Trades, and families | Restart | planned (Debt in D5, settlement in D7, Voided Action in D13, correction in D15) |
| AC-MARK-003 (partial) | D4 | T4.5, T4.6, T4.9, T4.20 | T4.5 groups | I4.13; B4.3 | C4.4 | `npm run test:integration -- d4/acknowledge` | Acknowledged Unavailable with Stale context; calculations Unavailable; a later Mark makes it Available; history kept | Restart | planned (provider-error case in D11) |
| AC-MARK-004 (partial: historical gaps visible and nonblocking in the Review) | D4 | T4.7, T4.14, T4.21 | T4.7; T4.14 "leave historical gaps out of completion" | I4.17; B4.6 | C4.8 | `npm run test:integration -- d4/gaps` | Gaps listed, optional, fillable; completion unaffected | Restart | planned (series and replay in D9, Bars in D11) |
| AC-MARK-005 (partial: no provider) | D4 | T4.7 | T4.7 group | I4.17 | — | as AC-MARK-004 | Current Missing keys become Manual tasks; acknowledged keys stay recoverable gaps; `NotConfigured` creates no fact | Journal and observation dumps unchanged by `recover` | planned (provider behavior in D11) |
| AC-CALC-001 (partial: current risk uses the remaining Position) | D4 | T4.9, T4.10, T4.18 | T4.9 "after PC3" | I4.3 | C4.1 | `npm run test:integration -- d4/value-trade` | $199.00 and risk $540.00 at 120 shares; 1R and Entry Quality unchanged | Restart | planned (management in D17) |
| AC-CALC-002 (partial: single Instrument) | D4 | T4.9, T4.18, T4.23, T4.24 | T4.9 Missing group | I4.4 | C4.6 | as AC-MARK-001 | Realized and fees Values; dependent figures Unavailable naming XYZ and date; no substitution | Restart | planned (multi-Instrument and nonzero realized in D10) |
| AC-CALC-003 (partial: underlying-price conditions) | D4 | T4.10, T4.18, T4.24 | T4.10 groups | I4.7; B4.14 | C4.2 | `npm run test:integration -- d4/conditions` | Per-condition status and Overrun; Target reached is not a Deviation | Deviation records unchanged | planned (structure-value in D10; revision in D17) |
| AC-JOUR-005 (partial: Daily Trade Review retries) | D4 | T4.12, T4.16 | T4.12 edit group | I4.16 | — | `npm run test:integration -- d4/action-edit` | One Entry identity per (Trade, Review Date); edits append versions | Stale save returns Conflict | planned (Void reopening in D13) |
| AC-JOUR-007 (partial: Daily Trade Review and its Source) | D4 | T4.12, T4.17 | T4.12 seed group | I4.1, I4.12 | — | `npm run test:integration -- d4/seed` | Definition manifest equals the contract text | Second launch adds nothing | planned |
| AC-REST-004 (partial: re-proven for schema 3) | D4 | T4.3, T4.17 | T4.17 migration group | I4.1, I4.2 | C4.10 | `npm run test:integration -- d4/migration` | Old stores unchanged on failure; never Ready; Retry activates with receipt | Restart | planned ("exportable" in D8) |
| AC-RESP-001 (cumulative) | D4 | T4.4, T4.5, T4.16, T4.17, T4.20, T4.22 | "render … without a read call" cases | I4.3, I4.5, I4.13 | C4.1 | `npm run test:integration -- d4/responses` | Every `MarketData.save` intention and `DailyReview.save` result equals durable state; the Review continues from the save result | — | planned |
| AC-CAP-001 (cumulative) | D4 | T4.19, T4.25 | `verify:capabilities` | — | C4.12 | `npm run verify:capabilities` | Manifest equals reachable operations, including the Review destination; nothing later | — | planned |
| AC-DEL-001 (cumulative) | D4 | T4.20–T4.22 | — | B4.9 | C4.12 | `npx playwright test e2e/d4/offline.spec.ts` | A Review completed offline after full stop | Second offline restart | planned; other engines **pending RC** |
| AC-DEL-004, AC-DEL-006 (cumulative) | D4 | T4.4, T4.16 | write-gate cases | I4.9; B4.10, B4.11 | C4.11 | `npx playwright test e2e/d4/runtime-failure.spec.ts` | `MarketData.save` and `DailyReview.save` rejected at UI and persistence | Dumps unchanged | planned; real-state **pending RC** |
| AC-DEL-003 (cumulative) | D4 | T4.27 | `verify:releases` | B4.7 | C4.10 | as B4.7 | Tab launch Writable after a schema-changing update | — | planned; Firefox and WebKit **pending RC**; production HTTPS **pending** |
| AC-UI-001, AC-UI-002 (cumulative) | D4 | T4.20–T4.25 | view-state groups | B4.13 | C4.12 | `npx playwright test e2e/d4/responsive-a11y.spec.ts` | State kept across resize; partial availability distinct; axe clean; keyboard Review | — | planned |
| AC-REBUILD-001 (cumulative) | D4 | T4.3, T4.12 | rebuild cases | I4.10 | — | `npm run test:integration -- d4/rebuild` | Equal normalized Review, list, and Detail; rebuilt indexes identical | — | planned |
| AC-PERF-001 (cumulative) | D4 | T4.30, T4.31 | structural | Benchmark dataset (section 1.3); query-count test | — | `npm run bench:run` | Cold p95 ≤ 2,500 ms and warm p95 ≤ 1,500 ms with figures rendered; bounded requests | Open rows equal expected before and after the runs | planned |

---

## 9. Clause-level acceptance check

| Scenario | Clause | Covered by | Finding |
|---|---|---|---|
| AC-MARK-001 | noon Tuesday, Monday exact Mark, Expected Mark Date Monday, Available, not Stale | T4.1, T4.6, I4.4, B4.5 | covered |
| | a Friday Mark is Stale context only if Monday evidence is absent | T4.6, T4.9, I4.4, C4.6 | covered |
| | evidence: session resolution, frame, displayed date and status | T4.1, T4.6, T4.24, B4.5 | covered |
| AC-REV-003 | opening and leaving records no Action; Review stays incomplete | T4.15, T4.22, B4.2 | covered |
| | one Save creates exactly one Hold Entry | T4.16, I4.13 | covered |
| | Exit, Roll, Adjust reject without Intent; with Intent they save intent only and create no Trade fact | T4.12, T4.16, B4.2 | covered |
| AC-JOUR-001 | Journal or Review form left without Save stores nothing | T4.20, T4.22, B4.12 (and D1, D2 forms) | covered; this completes the scenario |
| AC-REV-001 | Open-at-cutoff eligibility, not current Open membership | T4.14, I4.14 | covered for the latest session |
| | one later closed | — | D6 (closing); D6 must extend `StateAtEconomicCutoff` (A55) |
| | correction restates membership and progress | I4.14 (earlier-dated fill) | partial: an earlier-dated fill restates it now; Replace and Void in D15 |
| | exact-date Review opened before and after | — | **Finding:** D4 opens `LatestCompleted` only (P15), so exact-date open arrives in D15 with this scenario's completion. Added to the review queue for D15. |
| AC-REV-002 | Mark, Debt, settlement, Trade order | T4.14 | Marks and Trades; Debt in D5; settlement in D7 |
| | shared Mark resolves once for all affected Trades | T4.14, I4.6 | covered |
| | saved outcomes resume from facts; no session, finish flag, or placeholders | T4.14, I4.13, B4.8 | covered |
| | "a missed Review … the same exact date reopens" | I4.13 (restart before the next session) | **Finding:** under P15 a Review is reopened while it is still the latest session. Reading "missed" as "unfinished" is how D7 can mark this scenario full. Added to the review queue for D7. |
| AC-REV-005 | Mark, acknowledgment, Trade fact, existing Action changed → no write | T4.16, I4.15 | covered |
| | Bar, correction | — | D11, D15 |
| AC-REV-006 | Complete with exact Marks; Complete With Unavailable Marks naming Instruments, Trades, calculations; Missing stays Incomplete | T4.14, I4.13 | covered |
| | Voiding an Action or correcting facts can make a past date Incomplete | I4.14 (earlier-dated fill on the latest date) | partial; Void in D13, correction in D15 |
| | due Debt, settlement, Deviation tasks | — | D5, D7, D12 |
| AC-MARK-003 | Acknowledged Unavailable with Stale context; calculations unavailable; later exact Mark → Available; history kept | T4.5, T4.6, T4.9, I4.13, B4.3 | covered |
| | provider error alone never creates acknowledgment | — | D11 |
| AC-MARK-004 | historical gaps do not block today's Review | T4.7, T4.14, I4.17 | covered. This resolves the handoff's open item for D4. |
| | series with gap, point, and candle; no interpolation | — | D9, D11 |
| AC-MARK-005 | current Missing keys become Manual tasks; acknowledgments remain recoverable gaps; failures create no facts | T4.7 | covered without a provider; provider behavior in D11 |
| AC-CALC-001 | current risk uses the remaining Position | T4.9, I4.3 | covered; effective management after revisions in D17 |
| AC-CALC-002 | multi-Instrument Trade | — | D10 |
| | known realized-to-date P&L remains a Value | T4.9 | covered as an exact $0.00. **Finding:** a nonzero value needs D6's exits; D10's fixture must include a partial exit. Added to the review queue for D10. |
| | dependent results Unavailable with exact Instrument and date; no substitution | T4.9, T4.10, I4.4 | covered for one Instrument, including P12 and P13 (no fill cost or earlier Mark in current figures) |
| AC-CALC-003 | underlying-price conditions; Overrun; headlines follow the remaining Position; valid Plan R | T4.10, I4.7 | covered |
| | one crossed Stop **and** one reached Target in the same evaluation | — | **Finding:** impossible for one Long Stock Trade, where Stop < entry < Target on one price. The simultaneous case needs D10's structure-value conditions. Added to the review queue for D10. |
| | Target or revision is not a Deviation | T4.10, I4.7 | Target covered; revision in D17 |
| AC-JOUR-005 | retries keep one outcome per obligation key | T4.12, I4.16 | Daily Trade Review covered |
| AC-JOUR-007 | Daily Trade Review definition and Daily Review Source match the contract | T4.12 | covered |
| AC-REST-004 | migration failure for the new schema | T4.17, I4.2 | covered (re-proven) |
| AC-RESP-001 | each new mutation family returns usable post-commit state | T4.4, T4.5, T4.16, I4.3, I4.13 | covered |
| AC-DEL-004, AC-DEL-006 | Mark and Action writes return `RuntimeNotWritable` at both boundaries | T4.4, T4.16, I4.9, B4.10, B4.11 | covered |

**Handoff open items for D3 and D4, and where they are resolved:**

- *Session-policy coverage, completion instant, which keys, where:* P8–P11, P15, T4.1, T4.2, T4.4, T4.21.
- *Save intentions:* A35 (initial, correction, assert, withdraw; override in D11).
- *Long Stock `evaluate` formulas:* A41–A44, A54, T4.9, T4.10.
- *Storage, snapshot identity, session-policy compatibility:* A38, A40, A45, T4.3, T4.17.
- *Open list single-`getAll` rule and batched Mark reads:* A47, T4.31.
- *AC-MARK-004 in Daily Review:* P15, T4.7, I4.17.
- *Forward migration, every earlier fixture, previous-release harness, capacity basis, benchmark:* T4.17, T4.27–T4.31, I4.1, I4.2, B4.7.

---

## 10. Evidence recording

As in D1 and D2, under `evidence/D04/`: `tdd-log.md` (red and green per case), `structural.md`, `provenance.md` (engine and OS versions, never an allowlist), `bench.md` (raw timings, percentile method, dataset provenance including the pinned as-of instant, environment), and `critic-<n>.md`, with each critic defect first reproduced by a failing test.
