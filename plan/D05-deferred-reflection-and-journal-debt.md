# D5 — Deferred reflection and Journal Debt: task breakdown

Definition: [implementation plan, D5](implementation-plan.md#d5--deferred-reflection-and-journal-debt). The definition (stories, capability set, introductions, acceptance claims) stays there and is not repeated here. D5 builds directly on D4: its schema-3 layout (D4 A38), the Daily Review coordinator and its task families (T4.14–T4.16), the Review UI (T4.21–T4.22), the clock pin (D4 A49), and the benchmark generator (D4 section 1.3). It also extends D2's Position Change Reflection form (D2 A33, T2.12), Journal obligation index (D2 A28), and migration engine (D2 A30), and D1's Entry snapshots by immutable definition reference (D1 A3) ([D4](D04-daily-review.md), [D2](D02-open-a-long-stock-position.md), and [D1](D01-start-a-workspace-and-confirm-a-long-stock-plan.md) breakdowns).

Status: **breakdown agreed by the user on 2026-10-11** (the plan as a whole is still a draft). Decisions P16–P18 were agreed on 2026-10-11; P17 reopens part of the Daily Review contract at the user's explicit direction (plan decision 29). Everything else is written against those decisions and the working assumptions listed below.

---

## 1. Decisions and clarifications

### 1.1 Decisions for this breakdown

Numbering continues from D4's P8–P15.

| # | Question | Decision | Alternatives and tradeoff |
|---|---|---|---|
| P16 | **When does a deferred reflection become due?** Daily Review treats Debt as due when its due time is at or before the Review Cutoff (Daily Review, `getDebt`), and Defer must snapshot the Debt's "due semantics" (Journal, "Debt and obligation semantics"). The spec gives no rule for the due time itself. | **Agreed 2026-10-11: one session of grace.** A deferred reflection is due at the close of the session *after* the session its Position Change belongs to. The Position Change belongs to the first session whose close is at or after its Economic Time. A fill deferred during Monday's session is therefore not owed in Monday's Review; it is owed from Tuesday's Review onward. **How it is stored and tested:** the Debt stores its due anchor (the Position Change's Economic Time) and the rule `OneSessionGrace`. A Debt is due for Review Date R exactly when its anchor is at or before the close of the session before R. That is equivalent to "due time ≤ R's cutoff", and it means Journal and Trade Workflows need no calendar. Daily Review and Trade Views get the previous session's close from Market Data with the dates they already resolve (A75) and compare anchors against it (A63). **Consequences:** a fill after Monday's close (for example at 16:05) belongs to Tuesday's session and is owed from Wednesday's Review. Deferring a fill from the current session never reopens a Review that is already complete. An earlier-dated Position Change from two or more sessions back (decision 21) is due at once and can reopen the latest Review. Debt stays due until it is resolved, and every Review shows all of it, so nothing is lost by not reviewing missed sessions (decision 27). Recorded as plan decision 28. | (a) Due in the fill's own session's Review (the first cutoff at or after the Economic Time): no calendar is needed even in Daily Review, but every deferral blocks that same evening's Review, and deferring a Monday fill on Monday evening reopens a completed Monday Review. (b) Anchor on the save time: a late deferral never reopens a completed Review, but the due time depends on when the fill was typed rather than when it happened. |
| P17 | **Where do deferred reflections appear, and where can they be resolved?** The spec makes due Debt its own task family, between Marks and the Trade walk (Daily Review, "Date, eligibility, and ordering": "The task-family order is normative"; `getDebt`, which pages global due Debt "not restricted to Open Trades"; AC-REV-002, "task families appear in Mark, Debt, settlement, Trade order"). | **Agreed 2026-10-11, reopening the spec at the user's explicit direction.** The user's direction: the Review is a daily ritual in which the trader looks at every open position (and, from D6, positions closed that day), so deferred reflections appear as part of reviewing each position, with no separate list to work through. **(a) In the Review:** there is no Debt task family. Each Trade's card in the walk shows that Trade's Outstanding reflections above its Action form. Reflections that are due (P16) are marked Due and keep the Review Incomplete; the others are marked as falling due in a later Review and are optional. Each can be answered or declined in the card (`DailyReview.save` with `ResolveReviewDebt`). The task-family order becomes Marks, then settlement (D7), then the Trade walk. `getDebt`'s global paging has no consumer while every Trade with Debt is walked, which holds throughout D5, so it is not installed. D6 must decide where Debt for a Trade outside the walk appears (section 9). **(b) On Trade Detail:** an owed reflection can also be answered or declined there through `Journal.save`, for example at lunch on a morning deferral. That writing records Source *Trade Detail*, because Source is "the logical surface from which the trader initiated the writing" (glossary). That Source is not seeded yet, so the Journal seed manifest goes to **v4**, and the D5 definition's "Seeds: none" changes. **Scope change:** recorded as plan decision 29, naming the reopened passages. The frozen `specs/` files are not edited here, because they are the shared baseline for every implementation in this repository; changing their text on `main` is the user's call. | (a) Keep the spec's separate step but keep it light, with reflections also shown in each Trade's card. (b) Keep the separate step only, and answer early on Trade Detail. (c) Trade Detail shows status only, and `Journal.save` arrives with D13. |
| P18 | **Which reflection choice does the entry form preselect?** The spec permits preselecting Defer "so factual capture remains low-friction, but the submitted command always carries the disposition explicitly" (Trade Workflows, `recordPositionChange`). D2 A33 says no disposition is submitted implicitly. | **Agreed 2026-10-11: Reflect now, for now, to encourage traders to reflect right away.** The reflection disposition becomes a radio group in a labelled fieldset, Reflect now, Reflect later, and Decline to reflect, with Reflect now selected and its prompts shown, as in D2. Choosing Reflect later submits `Defer` explicitly; D2 A33 still holds. D2's tests and critic flows are unaffected, because the default is unchanged. "For now" leaves room to revisit the default later; changing it would touch only the form's initial view state. | (a) Preselect Reflect later: capturing fills is one Save, like one-click Hold, but fewer reflections are written in the moment. (b) No preselection, with Save disabled until a disposition is chosen. |

### 1.2 Amendment to D2 (agreed 2026-10-11 and applied to D2's T2.5)

- **D2 T2.5, "it should reject Defer with DispositionNotAllowed"** for the Position Change Reflection is retired by D5's T5.2, because plan decision 3 always intended Defer to arrive here. The test is changed to the new expectation, not deleted silently, and T5.2's first case is its valid red.
- P18 keeps Reflect now as the default, so no other D2 case changes.

### 1.3 Working assumptions

Numbering continues from D4's A35–A60. These are implementation-level choices that do not reopen product semantics. They stand unless you object.

| # | Assumption |
|---|---|
| A61 | **Debt record:** `{ debtId, obligationKey, entryType: PositionChangeReflection, definitionRevision, anchor: Trade, source: PositionChange, origin: PositionChange(id), momentTime, dueAnchor, dueRule: OneSessionGrace, route: JournalOnly, versions }`. The definition is snapshotted by immutable reference, as Entries are (D1 A3). `momentTime` is the Position Change's Economic Time (D2 A19), and `dueAnchor` equals it (P16). A version is `{ versionId, status: Outstanding \| Settled \| Declined, entryId?, declineId?, savedAt }`. The Debt's revision, used as its optimistic binding, is its last `versionId`. The legal transitions in D5 are Outstanding → Settled and Outstanding → Declined. Retirement (D14, D15) and reopening by Void (D13) extend the same chain. |
| A62 | **Storage (schema version 4), extending A38:** a new store `journalDebts`, key path `debtId`. Its index `byOutstandingDue` on `[outstandingDue, debtId]` is sparse: `outstandingDue` holds the due anchor only while the Debt is Outstanding and is removed when it is resolved, so the index contains only Outstanding Debt. A second index, `byAnchorTrade` on `anchorTradeId`, serves Trade Detail. Entries and declines gain an optional `settledDebtId`. `journalObligations` records may now name a Debt as the key's current outcome. A resolution replaces it with a guarded `put`: inside the transaction it reads the record and requires the expected Debt. A new outcome for a key still uses `add`, so a duplicate fails the transaction (D2 A28). Both indexes and `journalObligations` stay private and rebuildable. |
| A63 | **Due classification (P16):** `Journal.query` returns every Outstanding Debt in `[dueAnchor, debtId]` order with one `getAll` on `byOutstandingDue`, and a Trade's Debt with one `getAll` on `byAnchorTrade`. The coordinators classify each Debt from session closes they already resolve (A75). For Review Date R, a Debt is Due when its anchor is at or before the close of the session before R; it falls due in the next Review when its anchor is after that but at or before R's close; otherwise it falls due in the Review after next. Journal and Trade Workflows never need a session date. The spec's "due-through" query filter is not installed, because no D5 caller needs it. |
| A64 | **One resolution core in Journal.** `prepareEffects` accepts `ResolveDebt(debtId, expectedDebtRevision, Answer(form) \| Decline(reason?))` alongside the existing dispositions. `Journal.save(ResolveDebt)` prepares and applies it in its own semantic commit. Daily Review stages the same prepared effect inside its own transaction. An answer creates a Position Change Reflection Entry with the Debt's definition revision, Anchor, origin, and moment time. Its Source is the surface (P17), its authored time comes from the clock, and it carries `settledDebtId`. The Debt gains a Settled version linking the Entry, and the obligation's current outcome moves to the Entry. A decline is the same, with a decline record (D2 A29 shape plus `settledDebtId`) and a Declined version. |
| A65 | **Resolution validation:** the answer form must name the Debt's snapshot revision (`DefinitionRevisionMismatch` otherwise) and satisfy that revision's required prompts (`RequiredAnswerMissing`, all at once). A decline reason is optional, at most 500 characters (`ReasonTooLong`), as in D2 A29. A stale expected Debt revision, or a Debt that is no longer Outstanding, returns `Conflict` carrying the obligation's current outcome. An unknown Debt returns `NotFound`. |
| A66 | **Defer is installed for the Position Change Reflection only.** Close Review gains Defer in D6. Plan Reflection and Daily Trade Review still reject it with `DispositionNotAllowed`. A Debt in D5 always has route JournalOnly. Management Debt, its place in the Trade card, and `NeedsTradeWorkflow` arrive with D20; D5 builds no route handling. |
| A67 | **Post-commit Review result:** after an Action save (T4.16) or a Debt resolution (T5.10), the coordinator assembles the revised progress, completion, and next step from one coherent read at the committed Workspace content revision, retrying under A46's rule. This is result assembly inside the owning coordinator, not a caller read-back (ADR 0002). If a later write has already landed, the result says so, and the next step is to refresh. |
| A68 | **Reflections in the Review (P17):** `open` reads every Outstanding Debt once (A63), groups it by Trade, and returns for each walked Trade its due and not-yet-due reflection counts. Completion lists due reflections among its blockers, by Trade. `getTrade` returns the Trade's Outstanding reflections, oldest anchor first then Debt identity, each with its snapshot definition rendered as a form, the Position Change's Economic Time and Executions, its due classification, and its save binding (Debt revision and definition revision). A walked Trade is done when its Action is saved and it has no due reflection. The next step after any Review save is the first Trade in attention order, starting from the current one, that is not done. Attention bands are unchanged: an owed reflection does not move a Trade between bands. |
| A69 | **Debt on Trade Detail:** an Outstanding Debt reads "Reflection owed" next to its Position Change. Trade Views already resolves the Expected Mark Date E with its close and, from D5, the previous session's close (A75). The Debt is marked "Due" when its anchor is at or before the close of the session before E. It is marked "Due in the next Review" when its anchor is after that but at or before E's close. Otherwise it is marked "Due in the Review after next". No new calendar operation is needed. A settled reflection appears once, as its Entry marked "Deferred, answered" with the authored time and Source. A declined one appears once, as its decline marked "Declined later". The narrative shows one item per obligation. Its Debt history is available on the item, and a full View history arrives in D13. **Amended by decision 56 (revision 15):** when E is outside session-policy coverage, an Outstanding Debt has no due classification and reads "Reflection owed" alone; Reflect now and Decline still work. |
| A70 | **Entry form disposition (P18):** a radio group in a labelled fieldset with Reflect now selected. The prompts show only while Reflect now is selected. Answers typed and then hidden by choosing another disposition stay in view state, are never written anywhere (AC-JOUR-001), and are submitted only with Reflect now. Decline to reflect keeps its optional reason. |
| A71 | **Review screen (extends A57):** the Marks family, then the Trade walk. Each Trade card shows a "Reflections" section above the Action form when the Trade has Outstanding reflections, each labelled "Due", "Due in the next Review", or "Due in the Review after next" as text, and each opening the Debt form inline with Answer and Decline. After a save the reflection renders from the result, and focus moves to the next reflection in the card, or to the Action form when none remains. Moving on without resolving records nothing; a due reflection keeps the Review Incomplete and is named in the overview's blockers. |
| A72 | **Previous release:** the harness builds the D4 release from the tag `claude-opus-5.5-d4`, exported with `git archive` and never as a worktree (D2 A34). |
| A73 | **Fixture views across schemas (extends A51):** a Workspace migrated from schema 1, 2, or 3 has no Debt. Every Debt list and count is empty, and every earlier field equals the fixture's snapshot. |
| A74 | **AC-JOUR-004 evidence before D26:** definitions cannot be revised until D26, so the "answered against its snapshot after a later revision exists" case uses a disclosed definition-revision fixture writer. It appends revision 2 of the Position Change Reflection to the raw store before the application opens it, like D2's integrity fixture writer. |
| A75 | **Market Data frames carry the previous session's close (extends D4 A53).** `ResolveFrames` point frames for the Current and Review contexts, and the Review Date resolution in `recover`, also return the close instant of the session before the frame's date. Market Data already holds the session policy (A39), so this is a field, not a new operation. It is part of the frame, so it is covered by the snapshot binding through the policy revision (A45). |

### 1.4 Benchmark dataset at D5

This extends D4's generator. The generator version is bumped. The mature profile's row "Position Change Reflection outcomes (Entries, declines, Debt), 100,000" ([D1 section 1.3](D01-start-a-workspace-and-confirm-a-long-stock-plan.md#13-mature-dataset-profile-agreed-with-p1)) is split as follows, and the same fractions are used at D5's scale:

| Outcome at capture | Later outcome | Fraction | Count at D5 (400 Position Changes) | Mature profile (100,000) |
|---|---|---|---|---|
| Completed at capture | — | 65% | 260 | 65,000 |
| Declined at capture | — | 15% | 60 | 15,000 |
| Deferred | answered in the Review where it falls due | 18% | 72 | 18,000 |
| Deferred | declined in the Review where it falls due | 1.6% | 6 | 1,600 |
| Deferred | still Outstanding at the as-of instant | 0.4% | 2 | 400 |

The generator still simulates session by session (D4 section 1.3). In each session's Review it now resolves the deferred reflections that fall due there, which are the previous session's (P16). The two Outstanding Debts are from the session before the as-of session, so the as-of Review lists them as due. Counts and the as-of instant are recorded in `bench/dataset.json`.

---

## 2. Implementation boundaries added or extended in D5

| Canonical boundary | Code location | D5 operations |
|---|---|---|
| Market Data | `src/modules/market-data/` | the previous session's close in Current and Review frames and in `recover` (A75) |
| Journal | `src/modules/journal/` | `prepareEffects`/`applyPreparedEffects` (Defer; `ResolveDebt`); `save` (`ResolveDebt`: Answer, Decline); `query` (every Outstanding Debt, Trade narrative with Debt); seed manifest v4 (P17); section validator extended |
| Trade Workflows | `src/coordinators/trade-workflows/` | `recordPositionChange` with the `Defer` disposition |
| Daily Review | `src/coordinators/daily-review/` | `open` with reflections per walked Trade and in completion; `getTrade` with the Trade's owed reflections; `save` (`ResolveReviewDebt`) |
| Trade Views and Reporting | `src/coordinators/trade-views/` | Debt status in `getTradeDetail` |
| Workspace | `src/coordinators/workspace/` | migration to schema 4; seed manifest v4; manifest v4 capabilities |
| Persistence/Transaction (internal) | `src/persistence/` | schema v4 layout |
| Migrations | `src/persistence/migrations/` | `v3→v4` and the `v1→v2→v3→v4` chain |
| UI | `src/ui/` | entry-form disposition, Debt form, reflections in the Review's Trade card, Trade Detail Debt status and actions |

---

## 3. Task graph

Kind: **B** = behavioral (TDD, red→green per case), **S** = structural (exact verification).

| Task | Title | Layer | Kind | Blocked by | Public seam under test |
|---|---|---|---|---|---|
| T5.1 | Persistence: schema v4 and the `v3→v4` transform | persistence | B | D4 T4.3 | internal `Persistence` interface, migration transform |
| T5.2 | Journal: Defer creates Debt | domain/persistence | B | T5.1 | `Journal.prepareEffects`, `applyPreparedEffects` |
| T5.3 | Journal: Debt resolution (answer, decline) | domain/persistence | B | T5.2 | `Journal.save`, `Journal.prepareEffects` |
| T5.4 | Journal: Debt queries and the Trade narrative | domain/persistence | B | T5.3 | `Journal.query` |
| T5.5 | Journal: section validator for Debt; seed manifest v4 | domain | B | T5.3 | `validateSection`, `Journal.seedDefaults` |
| T5.6 | Trade Workflows: `recordPositionChange` with Defer | application | B | T5.2 | `TradeWorkflows.recordPositionChange` |
| T5.7 | Market Data: the previous session's close in frames | domain/persistence | B | D4 T4.6, T4.7 | `MarketData.query`, `MarketData.recover` |
| T5.8 | Daily Review: `open` with reflections per Trade and in completion | application | B | T5.4, T5.7 | `DailyReview.open` |
| T5.9 | Daily Review: `getTrade` with the Trade's owed reflections | application | B | T5.8 | `DailyReview.getTrade` |
| T5.10 | Daily Review: `save` (`ResolveReviewDebt`) | application | B | T5.9 | `DailyReview.save` |
| T5.11 | Trade Views: Debt on Trade Detail | application | B | T5.4, T5.7 | `TradeViewsAndReporting.getTradeDetail` |
| T5.12 | Workspace: migration to schema 4 | application | B | T5.1, T5.5 | `Workspace.initialize` |
| T5.13 | Installed Capability Manifest and composition root for D5 | application | S | T5.6–T5.12 | `verify:capabilities` |
| T5.14 | UI: reflection disposition on the entry form | UI | B | T5.13 | `PositionChangeForm` |
| T5.15 | UI: Debt form | UI | B | T5.13 | `DebtForm` |
| T5.16 | UI: reflections in the Review's Trade card | UI | B | T5.15 | `ReviewView`, `ReviewTrade` |
| T5.17 | UI: Trade Detail Debt status and actions | UI | B | T5.15 | `TradeDetail` |
| T5.18 | Release harness: previous release from the `claude-opus-5.5-d4` tag | test | S | D4 T4.27 | `build:releases`, `verify:releases` |
| T5.19 | Capacity basis recomputed for schema 4 | test/infrastructure | S | T5.13 | `measure:capacity`, `verify:capacity` |
| T5.20 | Freeze the schema-v4 fixture; migrate the v1, v2, and v3 fixtures | test | S | T5.12, T5.13 | `fixtures:freeze`, `verify:fixtures` |
| T5.21 | Benchmark generator: deferral and Debt resolution | test | S | T5.13, D4 T4.30 | `build:bench`, `bench:generate` |
| T5.22 | Latency harness and query-count proof, extended | test | S | T5.21 | `bench:run`, `test:integration -- d5/query-count` |
| T5.23 | Node mock-free integration suite | test | S | T5.13 | `test:integration` |
| T5.24 | Browser integration suite (Chromium) | test | S | T5.14–T5.20 | `test:e2e` |
| T5.25 | Independent browser-critic gate | test | S | all | fresh critic report |

**Parallel tracks.** Once the Debt projection, the `ResolveDebt` command, and the Review Trade and Trade Detail read models are fixed in T5.13's type module, three tracks proceed in parallel:
- **Journal and persistence** (T5.1–T5.5, T5.12).
- **Market Data and coordinators** (T5.6–T5.11), which join the first track as soon as T5.2 and T5.4 land.
- **UI** (T5.14–T5.17), against the facade test double.

---

## 4. Behavioral tasks

Every case runs **red → green** individually, as the kickoff prompt requires. A case that passes on its first run, or fails for a syntax, configuration, fixture, or unrelated reason, is not valid red evidence; it must be fixed and rerun to a genuine red, never logged and skipped. Cases are ordered so that each one targets behavior the previous cases did not need. Where a property would otherwise pass for free, it is folded into the case that first creates it, or proven only by an integration case.

**Reference Trade** (D4's): Long Stock XYZ, Plan for 100 shares, intended entry 50.00, Stop 47.50, Target 56.00, Plan Economic Time Monday 2026-10-12 09:00 America/New_York. **PC1** 10:00, 60 @ 50.10, fee 1.00; **PC2** 11:00, 40 @ 50.30, fee 1.00; **PC3** 14:00, 20 @ 51.00, fee 1.00.

**Debt fixture** (all Long Stock, each Position Change recorded with Defer). Under P16 a Debt is due for Review Date R when its anchor is at or before the close of the session before R. The main clock is Tuesday 2026-10-13 17:00: Review Date 2026-10-13, cutoff Tuesday 16:00, previous session's close Monday 16:00.

| Debt | Trade | Deferred Position Change (Economic Time) | Its session | Due from |
|---|---|---|---|---|
| D-1 | T-A, the reference Trade | PC1, Monday 10:00 | Monday | Tuesday's Review |
| D-2 | T-A | PC2, Monday 11:00 | Monday | Tuesday's Review |
| D-3 | T-F MNO | Friday 2026-10-09 14:00 | Friday | Monday's Review |
| D-4 | T-E JKL | Monday 10:00 (same anchor as D-1; Debt identity orders them) | Monday | Tuesday's Review |
| D-5 | T-G PQR | Monday 16:00:00, exactly at Monday's close | Monday | Tuesday's Review |
| D-6 | T-H STU | Monday 16:05, after Monday's close | Tuesday | Wednesday's Review |
| D-7 | T-A | PC3, moved to Tuesday 10:00 | Tuesday | Wednesday's Review |

Expected due Debt: Monday's Review (clock Monday 17:00) lists D-3 only. Tuesday's Review lists D-3, then D-1 and D-4 by Debt identity, then D-2, then D-5. Wednesday's Review (clock Wednesday 17:00) adds D-6 and D-7.

### T5.1 Persistence: schema v4

Seam: the internal `Persistence` interface and the `v3→v4` transform, against `fake-indexeddb`.

```text
describe("schema v4 layout")
  it should create a fresh Workspace at schema version 4 with the journalDebts store keyed by debtId and its byOutstandingDue and byAnchorTrade indexes

describe("v3 → v4 transform")
  it should copy every v3 store unchanged and create an empty journalDebts store, and migrate a v1 Workspace through every step to v4 inside one candidate

describe("rebuild")
  it should rebuild byOutstandingDue and byAnchorTrade from journalDebts with identical contents, with only Outstanding Debt in byOutstandingDue
```

### T5.2 Journal: Defer creates Debt

Seam: `Journal.prepareEffects` and `applyPreparedEffects`, against `fake-indexeddb`. The first case replaces D2 T2.5's "reject Defer" case (section 1.2) and is red because Defer is still rejected.

```text
describe("prepareEffects: Position Change Reflection, Defer (AC-JOUR-003)")
  it should prepare one Outstanding Debt, and no Entry or decline, with the current definition revision as its snapshot, a Trade Anchor to the originating Trade, Source Position Change, the Position Change origin, moment time and due anchor equal to the Position Change's Economic Time (P16), and route JournalOnly

describe("applyPreparedEffects: Defer")
  it should stage the Debt with one Outstanding version and an obligation record naming it as the current outcome, mapped to Trade Record's durable Position Change identity, return the staged Debt projection, and fail the transaction when the key already has an outcome
```

### T5.3 Journal: Debt resolution

Seam: `Journal.save` (`ResolveDebt`) and `Journal.prepareEffects` (`ResolveDebt`), against `fake-indexeddb`, with D-1 Outstanding and a fixed clock at Tuesday 2026-10-13 12:30.

```text
describe("save: ResolveDebt, Answer (P17, A64)")
  it should create one Position Change Reflection Entry with the Debt's definition revision, Anchor, origin, and moment time, Source Trade Detail, authored time Tuesday 12:30, and settledDebtId; append a Settled version linking it; and move the obligation's current outcome to the Entry, in one semantic commit
  it should validate the answers against the Debt's snapshot revision, not the latest, when the definition fixture writer has added revision 2 (A74, AC-JOUR-004)
  it should return RequiredAnswerMissing for each blank required prompt of the snapshot at once, and DefinitionRevisionMismatch when the form names revision 2
  it should return the Entry, the Debt's Settled transition, and the obligation's current outcome at the new Journal revision, equal to the stored records (AC-RESP-001)

describe("save: ResolveDebt, Decline")
  it should create a decline with the Debt's obligation key, Anchor, origin, moment time, snapshot revision, an optional reason of at most 500 characters (ReasonTooLong otherwise), Source Trade Detail, and settledDebtId; append a Declined version; and move the current outcome to the decline

describe("conflicts (AC-JOUR-005)")
  it should return Conflict carrying the current outcome and write nothing when the expected Debt revision is stale or the Debt is already Settled or Declined
  it should return NotFound for an unknown Debt

describe("write gate")
  it should return RuntimeNotWritable and write nothing when the mutation-boundary readiness recheck fails

describe("prepareEffects: ResolveDebt for a coordinator")
  it should prepare the same Entry with Source Daily Review for staging in a caller's transaction, and fail that transaction at apply when the Debt's revision moved after preparation
```

### T5.4 Journal: Debt queries and the Trade narrative

Seam: `Journal.query`, against `fake-indexeddb` with the request-counting wrapper (D2 section 6.0), loaded with the Debt fixture.

```text
describe("query: Outstanding Debt (A63)")
  it should return every Outstanding Debt, and no Settled or Declined one, in due-anchor then Debt-identity order with one getAll on byOutstandingDue (D-3, D-1, D-4, D-2, D-5, D-6, D-7)

describe("query: Trade narrative (A69)")
  it should return one item per obligation: an Outstanding Debt as a Debt item, a settled Debt inside its Entry item marked answered later, and a declined Debt inside its decline item, in moment-time order, read with one getAll on byAnchorTrade
```

### T5.5 Journal: section validator for Debt; seed manifest v4

Seam: `validateSection(snapshot)` exported by Journal, over a batched record source (D2 T2.9 as amended by D8 A140; D8's `prepareRestore` reuses it) and `Journal.seedDefaults`.

```text
describe("Journal section, Debt")
  it should accept Outstanding, Settled, and Declined Debt whose settlement links agree in both directions
  it should report a Debt whose snapshot revision is absent, a Settled version without an Entry or a version after Settled, an Entry whose definition revision differs from the Debt it settled, a link that does not point back, and two current outcomes for one obligation key (two Outstanding Debts, or a Debt and an Entry)

describe("seedDefaults: manifest v4 (P17)")
  it should add the Trade Detail Source, and nothing else, to a v3-seeded Journal, and add nothing when run again
```

### T5.6 Trade Workflows: `recordPositionChange` with Defer

Seam: `TradeWorkflows.recordPositionChange`.

```text
describe("Defer (AC-JOUR-003)")
  it should commit the Position Change, its Executions, the lifecycle move, the Deviation actions, and one Outstanding Debt in one semantic commit, with no Entry or decline
  it should return TradeMutationSuccess with the Debt identity in the receipt and the Debt projection (snapshot revision, due anchor, status) in the post-commit Journal outcomes, equal to the stored Debt (AC-RESP-001)
```

### T5.7 Market Data: the previous session's close in frames

Seam: `MarketData.query` (`ResolveFrames`) and `MarketData.recover`.

```text
describe("previous session's close (A75)")
  it should return, with each Current and Review point frame, the close instant of the session before the frame's date (Friday 2026-10-09 16:00 for Monday 2026-10-12; Wednesday 2026-11-25 16:00 for Friday 2026-11-27, across Thanksgiving)
  it should return the same field with the Review Date resolved by recover
```

### T5.8 Daily Review: `open` with reflections per Trade

Seam: `DailyReview.open`, against `fake-indexeddb`. The Debt fixture at Tuesday 17:00, with every Tuesday Mark and every Action for Tuesday saved.

```text
describe("reflections per walked Trade (P16, P17, A68)")
  it should return, for each walked Trade, its due and not-yet-due reflection counts, classified against Monday 16:00 (the close of the session before Tuesday): T-A 2 due (D-1, D-2) and 1 later (D-7); T-F, T-E, and T-G 1 due each; T-H 1 later (D-6); with Marks as the first family, the Trade walk next, and no Debt family

describe("completion (AC-REV-006)")
  it should report Incomplete naming the due reflections by Trade while every Mark and Action is resolved, and Complete once each due reflection is answered or declined, with D-6 and D-7 still Outstanding
```

### T5.9 Daily Review: `getTrade` with the Trade's owed reflections

Seam: `DailyReview.getTrade`, with the Debt fixture at Tuesday 17:00.

```text
describe("owed reflections (A68)")
  it should return T-A's Outstanding reflections D-1, D-2, and D-7 in anchor order alongside its Action form, each with its snapshot definition rendered as a form, the Position Change's Economic Time and Executions, its classification (Due, Due, Due in the next Review), and its save binding (Debt revision and definition revision)
  it should return ReviewChanged when one of the Trade's reflections was resolved elsewhere since the overview binding
```

### T5.10 Daily Review: `save` (`ResolveReviewDebt`)

Seam: `DailyReview.save`, with the Debt fixture at Tuesday 17:00.

```text
describe("ResolveReviewDebt")
  it should answer D-1 against its snapshot, creating the Entry with Source Daily Review and settling the Debt in one semantic commit, and return the Entry, the Debt's Settled transition, the revised progress and completion, and T-A as the next step while D-2 is still due (A67, A68)
  it should, with T-A's Action already saved, decline D-2 with an optional reason and return the same result shape, with the next Trade that is not done as the next step
  it should return Conflict carrying the current outcome and write nothing when the Debt was resolved on Trade Detail since the binding
  it should return RuntimeNotWritable and write nothing when the mutation-boundary readiness recheck fails
```

### T5.11 Trade Views: Debt on Trade Detail

Seam: `TradeViewsAndReporting.getTradeDetail`.

```text
describe("Debt status (A69)")
  it should include each Outstanding Debt beside its Position Change with its snapshot revision and status Due, Due in the next Review, or Due in the Review after next (at Tuesday 17:00: D-1 Due, D-6 and D-7 Due in the next Review; at Tuesday 12:00: D-1 Due in the next Review, D-7 Due in the Review after next)
  it should show a settled Debt once, inside its Entry item marked deferred and answered with authored time and Source, and a declined Debt once, inside its decline item
```

**Amended by decision 56 (revision 15):** one more case, under the same describe.

```text
  it should include an Outstanding Debt with no due classification when the as-of date is outside session-policy coverage
```

### T5.12 Workspace: migration to schema 4

Seam: `Workspace.initialize` and `getStatus`.

```text
describe("migration to schema 4")
  it should migrate v1, v2, and v3 Workspaces to schema 4 and return Opened with a receipt naming the from and to versions, per-store counts, and the seed addition (Trade Detail Source)
```

### T5.14 UI: reflection disposition on the entry form

Seam: `PositionChangeForm` with a facade test double.

```text
describe("disposition (P18, A70)")
  it should render Reflect now, Reflect later, and Decline to reflect as a radio group in a labelled fieldset, with Reflect now selected and its prompts shown
  it should hide the prompts and submit Defer explicitly, with no answers, when Reflect later is chosen and Save is pressed
  it should keep answers typed under Reflect now when the trader switches to Reflect later and back, and submit them only with Reflect now
  it should render "Reflection owed" on the saved Position Change from the returned Debt projection, without a read call
```

### T5.15 UI: Debt form

Seam: `DebtForm` with a submit adapter supplied by its host (Daily Review or Trade Detail).

```text
describe("answering")
  it should render the snapshot definition it is given, with that revision's prompt wording, order, and option labels
  it should submit Answer with the Debt identity, expected Debt revision, snapshot revision, and stable Prompt and Option identities, and render the saved Entry from the result without a read call
  it should show RequiredAnswerMissing beside each field and move focus to the first

describe("declining")
  it should submit Decline with an optional reason, showing ReasonTooLong beside the field

describe("conflict and leaving")
  it should show Conflict with the current outcome displayed and the entered values kept
  it should make no call when cancelled or left, register as unsaved once a value is entered, and offer its actions only while Writable
```

### T5.16 UI: reflections in the Review's Trade card

Seam: `ReviewTrade` and `ReviewView` with a facade test double.

```text
describe("reflections in the Trade card (A71)")
  it should show a "Reflections" section above the Action form listing the Trade's owed reflections with the Position Change's date and Executions and "Due", "Due in the next Review", or "Due in the Review after next" as text, and no section when the Trade has none
  it should open DebtForm for a reflection and, after Save, render it resolved from the result and move focus to the next reflection in the card, or to the Action form when none remains

describe("overview")
  it should name the due reflections by Trade among the blockers while completion is Incomplete, each linking to its Trade's card
```

### T5.17 UI: Trade Detail Debt status and actions

Seam: `TradeDetail` with a facade test double.

```text
describe("Debt on Trade Detail (A69, P17)")
  it should show each Outstanding Debt as "Reflection owed" beside its Position Change, with "Due" or "Due in the next Review" as text, and Reflect now and Decline actions only while Writable
  it should show a settled reflection once, marked "Deferred, answered" with its time, and a declined one once, marked "Declined later"
  it should open DebtForm with the Debt's snapshot definition loaded through getDefinitions by exact revision, and render the result after Save without reading the Trade again
```

**Amended by decision 56 (revision 15):** one more case, under the same describe.

```text
  it should show an unclassified Outstanding Debt as "Reflection owed" with no due text, with Reflect now and Decline still offered while Writable
```

---

## 5. Structural tasks

| Task | Verification (exact) | Expected result | Behavior that depends on it |
|---|---|---|---|
| T5.13 Capability manifest and composition | `npm run verify:capabilities` | The manifest adds the `Defer` variant of `recordPositionChange` (Position Change Reflection), `Journal.save` (`ResolveDebt`: Answer, Decline; Journal-only route), `Journal.query` (every Outstanding Debt, Debt in the Trade narrative), owed reflections in `DailyReview.open` and `getTrade`, `DailyReview.save` (`ResolveReviewDebt`), Debt status and actions in `getTradeDetail`, the previous session's close in Market Data frames, the Trade Detail Source, and schema version 4. `DailyReview.getDebt` is absent (P17). Every new operation is reachable from the entry form, the Review's Trade card, or Trade Detail, and nothing beyond D5 is. | AC-CAP-001. |
| T5.18 Previous-release harness | `npm run build:releases && npm run verify:releases` | `dist-releases/d4` is built from tag `claude-opus-5.5-d4` (A72), alongside the existing folders and a current `d5`. `verify:releases` confirms `d4` reports schema 3 and its own release identity. | B5.6, C5.8. |
| T5.19 Capacity basis | `npm run measure:capacity`, then `npm run verify:capacity` | The measurement defers 2,000 Position Change Reflections through the facade and resolves 90% by answer and 8% by decline in Reviews. It replaces the Debt part of the Position Change Reflection outcome allowance with measured bytes, using the section 1.4 split. `capacity-basis.json` carries schema version 4, and `verify:capacity` fails if it still names schema 3. | Capacity readiness check (decision 18). |
| T5.20 Schema fixtures | `npm run fixtures:freeze -- --schema 4`, then `npm run verify:fixtures` | The v4 dump adds to D4's fixture content, as of Monday 17:00: an Outstanding due Debt, an Outstanding Debt not yet due (Position Change at 16:05), a Debt answered in the Review (Source Daily Review), and a Debt declined on Trade Detail (Source Trade Detail). `verify:fixtures` migrates the v1, v2, and v3 dumps and checks their views per A73, then checks that the v4 dump opens Ready and that its lists, Details, and Review equal its own snapshot. | Migration from every earlier version; D6 onward. |
| T5.21 Benchmark generator | `npm run build:bench && npm run bench:generate` | The generator applies the section 1.4 dispositions and resolves deferred reflections in each session's Review through the production facade. It records the as-of instant and every count, including the two Outstanding Debts, in `bench/dataset.json`. A changed generator version regenerates the cached profile. | T5.22. |
| T5.22 Latency harness and query count | `npm run bench:run`; `npm run test:integration -- d5/query-count` | As D4's T4.31; results go to `evidence/D05/bench.md`. Before and after the runs, the harness compares every Open row with the generator's expected values, and the as-of Review's due reflections with the 2 expected. The Node test shows that a Review `open` adds exactly one `getAll` on `byOutstandingDue` to D4's counts, and Trade Detail adds one `getAll` on `byAnchorTrade`. These counts are the same with 10 or 2,000 settled Debts in history, because settled Debt leaves the sparse index. | AC-PERF-001. |
| T5.23 Node integration suite | `npm run test:integration` | Every case in sections 6.1 of D1, D2, D4, and D5 passes. | Cumulative regression. |
| T5.24 Browser integration suite | `npm run test:e2e` (Chromium) | Every case in sections 6.2 of D1, D2, D4, and D5 passes. | Cumulative regression. |
| T5.25 Browser critic | Fresh critic agent per section 7 | A structured report with every flow passing. | Deliverable gate. |

---

## 6. Mock-free integration tests

### 6.0 Disclosed test substitutes

D1's, D2's, and D4's substitutes still apply (`fake-indexeddb`, `NodeTestHost`, fixed clock and identities, release harness, faults build with the clock pin, Chromium as the routine engine, read-only probe, in-process lifecycle lock, integrity fixture writer, migration fault stages, request-counting wrapper, bench build, Playwright clock in the generator and benchmark). D5 adds:

| Substitute | Used in | Replaces | Why it does not weaken the contract |
|---|---|---|---|
| Definition-revision fixture writer (A74) | T5.3, I5.9 | `Journal.reviseDefinition`, which arrives in D26 | It appends one immutable definition revision to the raw store before the application opens it, never during a run. Debt creation, validation against the snapshot, and the Entry it creates are all production code. D26 proves the same scenario through the real operation. |

### 6.1 Node application-stack suite (`tests/integration/d5/`)

Conventions are as in D1, D2, and D4. Clocks are fixed per case.

| Case | Given / When | Then (visible result and durable-state proof) |
|---|---|---|
| I5.1 Migrate earlier fixtures | Load `workspace-v1/`, `workspace-v2/`, and `workspace-v3/` separately; `initialize`; restart; `getStatus`. | Opened with a receipt naming the Trade Detail Source addition. After restart: Ready at schema 4; views follow A73; `journalDebts` empty; the pointer names a new database and no candidate is listed. |
| I5.2 Migration failure and retry | `workspace-v3/` with one Action Entry's definition revision changed to an unknown identity; `initialize`; restore it; Retry. | MigrationBlocked naming the issue; old stores equal the fixture apart from the IndexedDB version; no candidate; never Ready. After Retry: Opened, and Ready after restart (AC-REST-004, re-proven). |
| I5.3 Defer at capture (AC-JOUR-003) | Clock Monday 10:05. Confirm the reference Plan; record PC1 with Defer; restart; `getTradeDetail`; `Journal.query` for PC1's obligation key. | The result's Debt projection equals the stored Debt (AC-RESP-001). Detail shows "Reflection owed" for PC1. Dump: one Debt with one Outstanding version, definition revision 1, Anchor T-A, origin PC1, due anchor 10:00; one obligation record naming the Debt; no Entry and no decline for that key; the Trade is Open. |
| I5.4 Debt never blocks facts (AC-JOUR-003) | After I5.3, clock Tuesday 17:00 (D-1 due): record PC2 with Complete and PC3 with Defer; restart. | Both commit. Two Outstanding Debts (PC1, PC3) and one Entry (PC2); three obligation records; Position 120. |
| I5.5 Due timing (P16) | The Debt fixture. `open` at Monday 17:00, Tuesday 17:00, and Wednesday 17:00. Separately: complete Tuesday's Review with no Debt; at Tuesday 20:00 record a deferred Position Change dated Tuesday 11:00 and `open`; then record one dated Monday 11:00 and `open`. | Monday: due count 1 (D-3). Tuesday: count 5 in the T5.8 order; D-6 and D-7 absent. Wednesday: D-6 and D-7 added. The Tuesday-dated deferral leaves the completed Tuesday Review Complete. The Monday-dated one turns it Incomplete, naming the new Debt, and answering it makes it Complete again. |
| I5.6 Review with Debt end to end (AC-REV-002, AC-REV-006) | D4's five-Trade fixture without T-D, with T-A's PC1 deferred (D-1). Monday 17:00: `open`; save Marks and Actions. Tuesday 17:00: `open`; save Tuesday's Marks; `getTrade` for T-A; answer D-1 through `ResolveReviewDebt`; save every Action; restart; `open`. Repeat in a second Workspace, declining D-1 instead. | Monday: D-1 shown in T-A's card as due in the next Review, and Complete without it. Tuesday: Marks first, then the walk with D-1 marked Due in T-A's card; Incomplete until D-1 is resolved and every Action is saved, then Complete; the same after restart, derived from facts. Dump: an Entry with `settledDebtId` and Source Daily Review (or a decline with `settledDebtId`), the Debt's Settled (or Declined) version, the obligation record naming the Entry (or decline), and no Review-session record. |
| I5.7 Resolve on Trade Detail before due (P17) | Clock Tuesday 10:05: record a deferred Position Change at 10:00. Clock Tuesday 12:30: `getTradeDetail`, then `Journal.save` with an Answer; restart; `getTradeDetail`. Clock Wednesday 17:00: `open`. | Before: "Due in the Review after next". The save result's Entry and Settled transition equal the stored records; Source Trade Detail; moment time 10:00; authored time 12:30. Wednesday's Review lists no Debt for it. |
| I5.8 Retries and concurrency (AC-JOUR-005) | (a) Submit the same Defer command twice. (b) Answer D-1 twice with the same expected revision. (c) With one binding, answer D-1 through the Review and decline it through `Journal.save`. | (a) Second returns Conflict; one Debt. (b) Second returns Conflict carrying the Entry. (c) Exactly one succeeds; the other returns Conflict; one current outcome per key in every dump. |
| I5.9 Snapshot answered after a later definition (AC-JOUR-004, partial) | Defer PC1 under revision 1; the definition fixture writer adds revision 2 (one option relabelled, one Prompt added); restart; answer D-1 with a revision-1 form; then try a revision-2 form on another Debt deferred under revision 1. | The answer validates against revision 1; the Entry stores revision 1 and renders its labels. The revision-2 form returns `DefinitionRevisionMismatch` and writes nothing. |
| I5.10 Rejections write nothing | Answer with a blank required prompt; a 501-character decline reason; a decline of a Settled Debt; Defer for a Plan Reflection through `confirmPlan`. | Typed issues, Conflict, or `DispositionNotAllowed`; every dump unchanged. |
| I5.11 Write gate | Host fails the inventory check; call `recordPositionChange` with Defer, `Journal.save`, and `DailyReview.save` (`ResolveReviewDebt`) through the facade, and `Persistence.commit` directly. | `RuntimeNotWritable` at every boundary; dumps unchanged; the Review, Detail, and Debt still readable (AC-DEL-004, AC-DEL-006). |
| I5.12 Rebuild equivalence | After I5.6 and I5.7: capture the Review, Open list, and Details; run `rebuildPrivateState`; capture again. | Normalized views equal; `byOutstandingDue`, `byAnchorTrade`, and `journalObligations` rebuilt with identical contents (AC-REBUILD-001). |
| I5.13 Fresh initialization at schema 4 | Empty factory; `initialize(zone)`. | Schema 4 created directly; Journal seed manifest v4 including the Trade Detail Source; no migration. |

### 6.2 Browser suite (`e2e/d5/`, Playwright against the built app on `localhost:5175`)

Chromium only (decision 19). Dates are set with Playwright's clock on the production build. Durable state is proven by reload or full browser restart plus D1's read-only probe. RC later repeats B5.6–B5.8 in all three engines.

| Case | Procedure | Expected observable result and durable-state proof |
|---|---|---|
| B5.1 Defer, then answer in the Review | Clock Monday 10:05: Record entry on the reference Plan, choose Reflect later, and press Save. Clock Monday 17:00: open Review; enter the Mark; save Hold. Clock Tuesday 17:00: open Review; enter the Mark; answer the reflection; save Hold; relaunch; open Review. | The form opened on Reflect now with the prompts shown; the entry saves and Detail shows "Reflection owed". Monday's Review shows the reflection in XYZ's card as "Due in the next Review" and reads Complete without it. Tuesday's shows it as "Due" in XYZ's card and stays Incomplete until it is answered; after relaunch, Complete. The probe shows the Debt's Settled version and an Entry with `settledDebtId`. |
| B5.2 Decline in the Review | As B5.1, but decline with a reason in Tuesday's Review. | Complete; Detail shows "Declined later" with the reason; the probe shows a decline with `settledDebtId`. |
| B5.3 Reflect on Trade Detail | Clock Tuesday 10:05: record a deferred entry. Clock Tuesday 12:30: open the Trade; Reflect now; answer; Save. | "Due in the Review after next" before; "Deferred, answered" with Tuesday 12:30 after; Wednesday's Review (clock Wednesday 17:00) lists no reflection for it. |
| B5.4 Due timing | Clock Monday 11:00: record a deferred entry at 10:00. Clock Monday 17:00: open Review. Clock Tuesday 17:00: open Review. | Monday's Review does not list it and can reach Complete; Tuesday's lists it as due. |
| B5.5 Facts never blocked | With a reflection due, record another entry with Reflect now. | It saves; the Review still lists the first reflection. |
| B5.6 Update from D4 with data | Harness serves `d4`; create two Open Trades with Actions; switch to `d5`; Reload from the update notice; record a deferred entry; open Review. | "Updating your journal" shows; the earlier data is intact; the new reflection is listed as due; About shows schema 4. The probe shows the new pointer target and no old database. |
| B5.7 Kill after commit | SIGKILL right after a Debt answer's result renders; relaunch. | The Entry and Settled version are present; the Review no longer lists that reflection. |
| B5.8 Offline cold restart | Close; relaunch offline; record a deferred entry, then answer it on Trade Detail. | Writable offline; both survive another offline restart (AC-DEL-001). |
| B5.9 Recovery Only (*faults build*) | Existing Outstanding Debt; relaunch with `?faults=control`. | The Debt is visible on Detail and in the Review; no Reflect now, Decline, or Save; probe unchanged. |
| B5.10 Mid-session failure (*faults build*) | Fill a Debt answer; `__tjFaults.set(["inventory"])`; Save. | `RuntimeNotWritable` explained; values kept; no Entry (AC-DEL-006). |
| B5.11 Nothing saved without Save | Switch the entry form between Reflect now and Reflect later with answers typed; fill a Debt answer; resize; navigate away; restart. | No Position Change, Entry, decline, or Debt change; no entered value in Web Storage (AC-JOUR-001). |
| B5.12 Responsive and accessible | Half-fill a Debt answer at 1280 px; resize to 390 px and back; run axe on the entry form in each disposition, a Review Trade card with due and later reflections, the Debt form, and Detail with Outstanding, settled, and declined reflections; resolve a reflection using the keyboard only. | Values survive; layout switches at 960 px; no WCAG 2.1 AA violations; "Due", "Due in the next Review", "Due in the Review after next", "Deferred, answered", and "Declined later" are text, not colour alone (AC-UI-001, AC-UI-002). |

---

## 7. Browser-critic flows

The critic receives the frozen `specs/`, the plan index, the D1, D2, D4, and D5 breakdowns, and the list of future capabilities that must not be treated as defects. Those are everything after D5, including:
- exits, Close Review and its Defer, and Closed Trades;
- options and Settlement Due;
- opening an exact past Review date;
- provider prices and Stop Discipline;
- Journal history views, Edit, Addendum, and Void, including reopening a Debt;
- Management Debt;
- backup.

It runs `npm run build && npm run preview` (port 5175) itself, plus `npm run serve:releases` for C5.8 and `npm run preview:faults` for C5.5 and C5.9. It does not edit code.

| Flow | Actions | Pass condition |
|---|---|---|
| C5.1 Defer at capture | Record an entry on a Plan; note the reflection's default; choose Reflect later and Save. | Reflect now was preselected with its prompts shown; after choosing Reflect later the entry saved; Detail shows "Reflection owed" and no blank reflection. |
| C5.2 Answer in the Review | Defer a reflection during a session. Open that session's Review after its close, then the next session's Review. | In the first Review it shows in the Trade's card as due in the next Review, and the Review can complete without it. In the second it shows as Due in the same card, with no separate reflections list; the form shows the prompts as they were when deferred; once it is answered and the Action is saved, the Review reads Complete. |
| C5.3 Decline in the Review | Decline a due reflection with a reason, then with no reason on another. | Both decline; Detail shows "Declined later" and the reason where given. |
| C5.4 Reflect on Trade Detail | Defer a reflection, then answer it from Trade Detail before it falls due. | Saved without visiting the Review; it never appears as due. |
| C5.5 Due timing | Faults build: `?clock=2026-10-12T15:00:00Z` (Monday 11:00): record a deferred entry at 10:00. Relaunch with `?clock=2026-10-12T21:00:00Z` (Monday 17:00) and open the Review; relaunch with `?clock=2026-10-13T21:00:00Z` (Tuesday 17:00) and open the Review. | Monday's Review omits it; Tuesday's lists it as due. |
| C5.6 Facts never blocked | With a reflection due, record another entry. | The entry saves; the due reflection remains. |
| C5.7 Validation | Answer a reflection with Decision mode blank; decline with a 501-character reason. | Errors beside the fields, focus on the first; nothing saved after reload. |
| C5.8 Update with migration | Harness serves `d4`; create Open Trades; switch to `d5`; reload from the notice; record a deferred entry. | Migration message; earlier data intact; the reflection is owed; About shows schema 4. |
| C5.9 Recovery Only | Faults build: defer a reflection; relaunch with `?faults=inventory`. | The owed reflection is readable; no answer or decline controls. |
| C5.10 Offline, responsive, keyboard, About | Stop the server and reload, then defer and answer a reflection; resize with a half-filled Debt form; resolve one by keyboard; open About. | Offline works; values survive resizing; visible focus; About lists only D1, D2, D4, and D5 capabilities. |

---

## 8. Acceptance matrix rows

Status values: `planned`, `covered`, `intentionally not advertised`. All rows are `planned`. AC-DEL rows cite Chromium and faults-build evidence; Firefox, WebKit, and real-state evidence are **pending RC** (decision 19).

| Scenario | Deliverable | Tasks | TDD / structural | Integration case and fixture | Critic flow | Command or procedure | Expected result and durable-state proof | Failure / nonmutation / restart evidence | Status |
|---|---|---|---|---|---|---|---|---|---|
| AC-JOUR-003 (full) | D5 | T5.2, T5.6, T5.8, T5.14 | T5.2 Defer groups; T5.6 group; T5.8 completion group | I5.3, I5.4, I5.5; B5.1, B5.5 | C5.1, C5.6 | `npm run test:integration -- d5/defer` | The Position Change commits with one Outstanding Debt holding its trigger-time snapshot; no blank Entry; due Debt keeps the Review Incomplete; later entries still commit | Restart I5.3; kill after commit B5.7 | planned |
| AC-JOUR-005 (partial: Defer and Debt-resolution retries and concurrency) | D5 | T5.2, T5.3, T5.10 | T5.3 conflicts group; T5.10 Conflict case | I5.8 | — | `npm run test:integration -- d5/retries` | One current outcome per obligation key under repeated or concurrent submissions | Conflicts write nothing | planned (Void reopening in D13) |
| AC-REV-002 (partial, under the ordering reopened by decision 29: Marks, then Trades with due reflections in each Trade's card) | D5 | T5.8, T5.9, T5.16 | T5.8 group; T5.9 group | I5.6; B5.1 | C5.2 | `npm run test:integration -- d5/review` | Marks first; each due reflection in its Trade's card; resumption from facts | Restart I5.6 | planned (settlement in D7) |
| AC-REV-006 (partial: due Debt) | D5 | T5.8, T5.10, T5.16 | T5.8 completion group | I5.5, I5.6 | C5.2 | as AC-REV-002 | Incomplete while due Debt remains; Complete once answered or declined; a late earlier-dated deferral reopens a completed Review | Restart | planned (settlement in D7, Voided Action in D13, correction in D15) |
| AC-JOUR-004 (partial: Debt answered against its snapshot) — **proposed addition** | D5 | T5.3 | T5.3 snapshot case | I5.9 (definition-revision fixture writer, disclosed) | C5.2 | `npm run test:integration -- d5/snapshot` | The answer is validated and stored against the Debt's revision 1 after revision 2 exists | Revision-2 form rejected with no write | planned (full in D26 through `reviseDefinition`) |
| AC-JOUR-007 (partial: Trade Detail Source) | D5 | T5.5, T5.12 | T5.5 seed group | I5.1, I5.13 | — | `npm run test:integration -- d5/seed` | Seed manifest v4 adds only the Trade Detail Source | Second launch adds nothing | planned |
| AC-JOUR-001 (full in D4; re-proven for the new forms) | D5 | T5.14, T5.15 | "make no call when … left" cases | B5.11 | C5.10 | `npx playwright test e2e/d5/no-save.spec.ts` | No Entry, decline, Debt change, or draft from the disposition switch or the Debt form | Restart | planned |
| AC-REST-004 (partial: re-proven for schema 4) | D5 | T5.1, T5.12 | T5.12 migration case | I5.1, I5.2 | C5.8 | `npm run test:integration -- d5/migration` | Old stores unchanged on failure; never Ready; Retry activates with receipt | Restart | planned ("exportable" in D8) |
| AC-RESP-001 (cumulative) | D5 | T5.3, T5.6, T5.10, T5.14, T5.15 | "equal to the stored …" and "without a read call" cases | I5.3, I5.6, I5.7 | C5.1 | `npm run test:integration -- d5/responses` | Defer, `Journal.save`, and `ResolveReviewDebt` results equal durable state; the UI continues from them | — | planned |
| AC-CAP-001 (cumulative) | D5 | T5.13 | `verify:capabilities` | — | C5.10 | `npm run verify:capabilities` | Manifest equals reachable operations; nothing later | — | planned |
| AC-DEL-001 (cumulative) | D5 | T5.14–T5.17 | — | B5.8 | C5.10 | `npx playwright test e2e/d5/offline.spec.ts` | Defer and answer offline after full stop | Second offline restart | planned; other engines **pending RC** |
| AC-DEL-004, AC-DEL-006 (cumulative) | D5 | T5.3, T5.10 | write-gate cases | I5.11; B5.9, B5.10 | C5.9 | `npx playwright test e2e/d5/runtime-failure.spec.ts` | Defer, `Journal.save`, and `ResolveReviewDebt` rejected at UI and persistence | Dumps unchanged | planned; real-state **pending RC** |
| AC-DEL-003 (cumulative) | D5 | T5.18 | `verify:releases` | B5.6 | C5.8 | as B5.6 | Tab launch Writable after a schema-changing update | — | planned; Firefox and WebKit **pending RC**; production HTTPS **pending** |
| AC-UI-001, AC-UI-002 (cumulative) | D5 | T5.14–T5.17 | view-state groups | B5.12 | C5.10 | `npx playwright test e2e/d5/responsive-a11y.spec.ts` | State kept across resize; axe clean; keyboard resolution | — | planned |
| AC-REBUILD-001 (cumulative) | D5 | T5.1 | rebuild case | I5.12 | — | `npm run test:integration -- d5/rebuild` | Equal normalized views; rebuilt Debt and obligation indexes identical | — | planned |
| AC-PERF-001 (cumulative) | D5 | T5.21, T5.22 | structural | Benchmark dataset (section 1.4); query-count test | — | `npm run bench:run` | Budgets met; Review `open` adds one bounded Debt request | Open rows and due reflections equal expected before and after the runs | planned |

---

## 9. Clause-level acceptance check

| Scenario | Clause | Covered by | Finding |
|---|---|---|---|
| AC-JOUR-003 | a Position Change Reflection eligible for Defer; the trader defers | T5.2, T5.6, T5.14, I5.3 | covered |
| | the factual Position Change succeeds with one Outstanding Debt containing its trigger-time form snapshot | T5.2, T5.6, I5.3 | covered |
| | no blank Entry exists | T5.2, I5.3 (dump) | covered |
| | due Debt blocks Review when due | T5.8, I5.5, I5.6 | covered, with due semantics per P16 |
| | never blocks later factual recording | I5.4, B5.5, C5.6 | covered; this completes the scenario |
| | evidence: Trade receipt, Journal query, snapshot, due behavior, absence of placeholder | T5.6, T5.4, I5.3, I5.5 | covered |
| AC-JOUR-005 | retries or concurrency around the same key leave one current outcome | T5.3, I5.8 | covered for Complete, Decline, Defer, Daily Trade Review, and Debt resolution |
| | Voiding the sole Debt-settlement Entry reopens the Debt | — | D13 |
| AC-REV-002 | Mark, Debt, settlement, Trade order | T5.8, I5.6 | **Reopened by the user (P17, decision 29):** due reflections appear inside each Trade's card in the walk instead of as a family before it. D5 covers Marks, then Trades with reflections; settlement in D7. D7 marks the scenario full against the reopened ordering. |
| | global due Debt, not restricted to Open Trades (`getDebt`) | — | **Finding:** in D5 every Trade with a Position Change is Open and, when its Debt is due, walked, so every due reflection has a Trade card. From D6 a Debt can belong to a Trade outside the walk (closed before the cutoff, such as a deferred Close Review). Under decision 29 it then needs a home, either a card for that Trade or a residual list served by `getDebt`. **D6 must decide this and add the integration case.** Added to the review queue for D6. |
| AC-REV-006 | due Debt resolved before Complete | T5.8, I5.6 | covered |
| | Voiding an Action or correcting facts can make a past date Incomplete | I5.5 (late earlier-dated deferral reopens the latest Review) | partial; Void in D13, correction in D15 |
| AC-JOUR-004 | outstanding Debt and historical Entry under D1; D2 adds, reorders, revises, retires prompts; Debt answered later | T5.3, I5.9 | **Finding:** D5 builds the mechanism (Debt snapshot by immutable revision, answers validated against it) and proves it with a disclosed fixture revision. The real revision operation arrives in D26, where the scenario is full. Proposed: list AC-JOUR-004 as partial under D5 in the plan index. |
| AC-JOUR-006 | workflow-routed Debt cannot be settled with prose | — | D20; D5 Debt is Journal-only (A66) |
| AC-JOUR-007 | seven Sources exist | T5.5 | Trade Detail Source added (P17); the scenario stays partial until D26 |
| AC-RESP-001 | Defer, `Journal.save`, and `ResolveReviewDebt` return usable post-commit state | T5.3, T5.6, T5.10, I5.3, I5.6, I5.7 | covered |
| AC-DEL-004, AC-DEL-006 | the new writes return `RuntimeNotWritable` at both boundaries | T5.3, T5.10, I5.11, B5.9, B5.10 | covered |

**Handoff items for D5, and where they are resolved:**

- *When Debt is due, including out-of-order entries:* P16, A63, T5.4, T5.8, I5.5.
- *Where Debt is resolved:* P17, A64, T5.3, T5.10, T5.17, I5.7.
- *Defer preselection:* P18 (Reflect now preselected), A70, T5.14.
- *Decline when resolving Debt:* A65 (optional reason, at most 500 characters, as D2 A29).
- *Storage, obligation index, migration from v1–v3, frozen v4 fixture:* A61, A62, T5.1, T5.12, T5.20, I5.1, I5.2.
- *Debt order in the Review:* reopened by P17; reflections are ordered within each Trade's card (A68, T5.9).
- *Previous-release harness, capacity basis, benchmark:* A72, T5.18, T5.19, T5.21, T5.22, B5.6.

**Raised by the D5 breakdown, for later breakdowns:**

1. **D6:** decide where a Debt whose Trade is not walked appears under decision 29 (a card for that Trade, or a residual list through `getDebt`), and add its integration case. Also settle the user's direction that the Review covers positions closed that day: the spec makes only Trades Open at the session's close eligible (Daily Review, "Date, eligibility, and ordering": "not those open today"; AC-REV-001), so a Trade closed during the session is not walked unless the user reopens that rule too. Close Review's Defer reuses D5's Debt record, due rule (P16, anchored on the closing Position Change's Economic Time), and resolution paths.
2. **D13:** Voiding the sole settling Entry reopens the Debt (a new Outstanding version, and the obligation's outcome moves back to the Debt); the section validator gains that transition.
3. **D20:** Management Debt needs its place in the Trade card under decision 29 (the spec ranks it ahead of Journal-only Debt), and `NeedsTradeWorkflow` from `Journal.save` and `ResolveReviewDebt`.
4. **D7:** AC-REV-002 is marked full against the ordering reopened by decision 29: Marks, then settlement, then Trades with reflections in their cards.

---

## 10. Evidence recording

As in D1, D2, and D4, under `evidence/D05/`: `tdd-log.md` (red and green per case), `structural.md`, `provenance.md` (engine and OS versions, never an allowlist), `bench.md` (raw timings, percentile method, dataset provenance including the pinned as-of instant, environment), and `critic-<n>.md`, with each critic defect first reproduced by a failing test.
