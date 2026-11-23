# Implementation plan: vertical deliverables

Status: **frozen, revision 14, approved by the user on 2026-10-29** (revision 13 on 2026-10-28, revision 12 on 2026-10-27, revision 11 on 2026-10-27, revision 10 on 2026-10-27, revision 7 on 2026-10-24, revision 6 on 2026-10-24, revision 5 on 2026-10-19, revision 4 on 2026-10-18, revision 1 on 2026-10-17; see "Freeze record"). Planning continues as a rolling wave (decision 40): each later deliverable's task breakdown is an approved revision of this frozen plan.
Basis: the frozen `specs/` baseline and the approved stack in [technology-stack.md](technology-stack.md) (Profile A: React 19 + IndexedDB, hand-written service worker, Cloudflare Pages; Marketdata.app behind a replaceable Pricing Provider adapter). Branch `claude-opus-5.5`, `DEV_PORT=5175`.

This document is the ordered list of vertical deliverables and the decisions that govern them. Task breakdowns (`describe`/`it should` cases, red/green procedures, per-task evidence) live in one file per deliverable, linked from the summary table; D1–D8 have them, and D9–D28 receive theirs one at a time before implementation (decision 40). The [acceptance matrix](acceptance-matrix.md) has one row per scenario.

## Recorded decisions

| # | Decision | Effect on this plan |
|---|---|---|
| 1 | The early signature sequence is built on **Long Stock**. | The Strategy selector offers only Long Stock until D7. |
| 2 | **Backup is not in D1.** | Until D8, `Recovery Only` offers reads and history but no backup export, and the not-protected warning offers the durability request but does not recommend a backup. **Ended by D8:** `Recovery Only` offers backup export and verification, and the not-protected warning recommends a backup. |
| 3 | The first Position Change Reflection offers **Complete and Decline only**. | Defer, Journal Debt, and Debt resolution arrive in D5, next to Daily Review. |
| 4 | **Cloudflare project not yet available; loopback first.** | Deliverables complete on the secure loopback origin. Production HTTPS evidence for AC-DEL-003 stays *pending*, never passed, until the project exists. |
| 5 | **The single-leg option happy path moves early (D7),** ahead of Backup and Restore. | The first backup format and Restore validation cover stock and single-leg option Trades. |
| 6 | **Trade replay is a signature feature (D9).** | It comes right after single-leg options and Backup, before any correction or management-revision work. |
| 7 | **Multi-leg options (D10) come right after replay, before Stop Discipline, voluntary journaling, Abandon, and Execution correction.** | Stop Discipline handles single- and multi-Instrument structures from the start, and Execution correction is leg-aware from the start, because choosing the leg to correct is part of that flow. |
| 8 | **Revise management (D17) follows Execution correction (D15).** | Traders can fix entry errors before revising Stops and Targets. |
| 9 | **D1 boundary accepted, without installation.** D1 keeps a minimal Web App Manifest for PWA identity (id, name, icons, start URL, scope) with `display: "browser"`, so no browser offers to install it. Installation is its own final deliverable (D28). | This narrows how the planning protocol's "PWA identity in the first mutating deliverable" requirement applies: identity, service worker, Offline Release Inventory, Runtime Readiness, and the write gate stay in D1. The `standalone` request, the install affordance, installed-mode testing, and installed-launch evidence move to D28. Until then, installation is neither offered nor supported. |
| 10 | **Recording an assigned or exercised option waits for D20.** | From D7 to D20, an assigned Cash-Secured Put or exercised long option cannot be recorded. Its Settlement Due keeps that Review date Incomplete, and the app explains why. **Amended by decision 124, from when D9.5 is built:** the trader may press "record later", which lets that one Review finish as "Complete, settlement to record"; the next Review asks again. |
| 11 | **Trade facts are stored as version chains from the start; only the representation is built early.** | From D1 (Plan facts), D2 (Executions), and D7 (settlements), each Trade fact is stored as a stable fact identity with a version list holding exactly one version. Lot Matches, Anchors, and Deviations reference fact identities. No version-history read, View history, Replace, Void, or effective-version selection beyond "the single version" is built before D15, which then adds those on the existing chains without a fact-shape migration. |
| 12 | **No historical Stop Discipline backfill.** D12 records a Workspace-level Stop Discipline coverage start, the instant D12 first activates, kept in Workspace metadata and in backups. | Breach episodes are evaluated only from that instant: Trades open then are tracked forward, and an existing breach starts an episode at the first observation after activation, as after a gap. Earlier periods and already-closed Trades are "not evaluated". Expected and recorded occurrences therefore agree, Restore reproduces the same result instead of backfilling, and Daily Review, replay, Trade Detail, and the Scorecard disclose the boundary instead of implying no breaches. |
| 13 | **Pricing Provider is D11, before Stop Discipline; the initial provider is Marketdata.app** (https://www.marketdata.app/). | Automatic closing prices and Daily Bars arrive when multi-leg Trades make manual Marks a daily chore, and Stop Discipline (D12) is built with Daily Bar high/low evidence from the start. |
| 14 | **The provider sits behind a replaceable adapter.** | Marketdata.app is one adapter behind the spec's Pricing Provider port. Switching providers means building a new adapter and nothing else: no change to Market Data, Daily Review, Trade Analysis, the UI, storage, or backup. |
| 15 | **D11 conditions accepted.** | Browser callability of Marketdata.app is verified before D11's task breakdown, with a stop-and-discuss if it fails; integration tests use a disclosed local HTTP emulator plus an optional live smoke test. |
| 16 | **Current Exposure is D16, immediately before Revise management.** | It creates the reports area and `runReport` boundary, with no Report Period. Outcomes (D24) adds Report Periods; Scorecard, Journal Field, Customize prompts, and Install keep their order. |
| 17 | **Customize Journal prompts (D26) precedes the Journal Field report (D27).** | The Journal Field report's Tag Select case needs a trader-configured Tag Select Prompt, which no initial definition has. |
| 18 | **Capacity requirement uses a mature projection** (D1 breakdown, 2026-10-11). The readiness capacity check requires `quota ≥ 3 × M`, where `M` is the projected on-disk size of a Workspace at the mature dataset profile defined in the D1 breakdown. | D1 measures the record kinds it has and uses stated allowances for the rest. Every schema-changing deliverable replaces its allowances with measurements and recomputes the basis; a build check fails if the schema version changes without a recomputed basis. D8 checks the projection against the benchmark dataset loaded through a real Restore. The benchmark generator (D2 onward) uses the same profile. **Amended by decision 114 (revision 103):** the basis is recomputed with `measure:capacity:reset-basis`, which leaves the growth baseline alone. |
| 19 | **Two test tiers; three-engine real-state evidence in RC** (D1 breakdown, 2026-10-11). | Routine browser suites run in Chromium only, and every readiness failure in them is produced by a disclosed fault-injection build. The real-state readiness and delivery matrix in Chromium, Firefox, and WebKit is RC, an approved layer-only checkpoint (see "Layer-only exceptions"). Each deliverable's AC-DEL rows cite Chromium evidence, with Firefox, WebKit, and real-state evidence marked pending RC until RC runs. |
| 20 | **Plan confirmation Economic Time is trader-entered** (D1 breakdown, 2026-10-11). | It defaults to "now" in the Workspace time zone and may not be in the future. Opening Executions (D2 onward) must be at or after it, so a Plan recorded after the close still precedes its entry. |
| 21 | **Position Changes may be recorded out of Economic Time order** (D2 breakdown, 2026-10-11). | Any Economic Time from the Plan's up to now is accepted. Every Trade commit rederives the Trade and reconciles recorded Deviation occurrences by fingerprint (create, retain, new version, supersede) in the same transaction, disclosing in the receipt when the entry window or Entry Quality moved. D6, D10, D12, and D15 extend this one mechanism. |
| 22 | **A failed or not-yet-possible migration leaves data intact but unreadable by the new release** (D2 breakdown, 2026-10-11). | Migration Blocked keeps the old database's stores unchanged, is never Ready, and offers Retry. If readiness fails on the first launch of a schema-changing release, the Workspace is reported Integrity Blocked (`AwaitingMigration`) rather than Recovery Only with reads; this narrows D1's confirmed AC-DEL-002 reading for that launch only. Each release reads only its own schema. D8 adds export of a blocked older database, which completes AC-REST-004's "exportable" (decision 36). |
| 23 | **Coherent agreement disagreements are repaired and disclosed; incoherent facts reject** (D2 breakdown, 2026-10-11). | A Trade mutation whose before-state disagrees with coherent facts commits, writes the expected lifecycle, Deviation (and from D6, Lot-Match) records, and lists each repair in its receipt. Incoherent facts return a no-write `IntegrityDisagreement`. Migration (D2) and Restore (D8) apply the same rule. Normal reads never repair. |
| 24 | **Marks are entered in the Daily Review; D3 is merged into D4** (D3 breakdown, 2026-10-11). | There is no separate Marks page. D4 delivers Manual Marks, the session policy, `evaluate`, current figures on the Open list and Trade Detail, and the Daily Review together. D11's provider fills Marks when the Review opens. D3's number is retired so later numbers stay stable. |
| 25 | **NYSE session policy: covered 2024 (2000 before revision 10, decision 51) through the last published year (2028); a session completes 30 minutes after its close** (D3/D4 breakdown, 2026-10-11). | Regular holidays come from rules; one-off closures and early closes come from a cited, versioned table. Outside coverage the app gives a diagnostic, never a guessed session. The close (16:00, or 13:00) stays the Review Cutoff for eligibility. The session becomes the Expected Mark Date and the latest Review Date at 16:30 (or 13:30). |
| 26 | **Missing or later evidence is shown as Missing, with a dated last-close line and an at-entry line** (D3/D4 breakdown, 2026-10-11). | Current figures never use an earlier Mark or fill cost. When the current Mark is missing, or shares were bought after its close, a separately labelled line values the Position held at the latest earlier close with that session's own Mark. Shares bought after that close show risk and reward from their execution prices, labelled "at entry", never as P&L. D10's multi-Instrument and D7's option Trades extend the same lines. |
| 27 | **No Reviews of missed sessions** (D4 breakdown, 2026-10-11). | Daily Review opens on the latest completed session only. Its Marks task also lists skipped sessions without Marks, which can be filled but do not block completion (AC-MARK-004). Opening an exact past date arrives in D15, because AC-REV-001 requires it. |
| 28 | **A deferred reflection is due one session after the session it belongs to** (D5 breakdown, P16, 2026-10-11). | A Position Change belongs to the first session whose close is at or after its Economic Time, and its deferred reflection is due at the next session's close. The Debt stores its anchor and the rule; Daily Review and Trade Views classify it against session closes from Market Data, so Journal and Trade Workflows need no calendar. A deferral from the current session never reopens a completed Review. D6's Close Review Defer uses the same rule. |
| 29 | **Spec reopened: owed reflections appear inside each Trade's card in the Daily Review, not as a separate task family** (D5 breakdown, P17, 2026-10-11, at the user's explicit direction). | Reopened passages: Daily Review, "Date, eligibility, and ordering" (task family 2, due Journal Debt) and `getDebt`'s global paging; the overview's "Open and save Daily Review"; AC-REV-002's "Mark, Debt, settlement, Trade order". The order becomes Marks, settlement (D7), then the Trade walk, and each Trade's card shows its Outstanding reflections, due ones blocking completion. Due Debt still blocks completion (glossary; ADR 0005). `getDebt` is not installed while every Trade with Debt is walked; D6 decides where Debt for a Trade outside the walk appears. Owed reflections can also be answered on Trade Detail through `Journal.save`, recording Source Trade Detail. The `specs/` files are unchanged here, because they are the shared baseline for every implementation; the user decides whether to amend them on `main`. |
| 30 | **Spec reopened: Lot Matches are derived, never stored** (D6 breakdown, P23, 2026-10-17, at the user's explicit direction). | Matching order changes no Closed Trade's totals; it only splits a partly closed Trade's P&L between realized-to-date and open, and times the realization increments of the Outcomes curve. Trade Analysis still derives FIFO matches, lot-aware fees, and realized P&L from the effective Executions whenever needed, identified by (opening Execution, disposing Execution, FIFO); Trade Record stores no Lot-Match record, and an earlier-dated exit simply changes the derived result, disclosed in the receipt. Reopened passages: Trade Record's "Contract", "Record content", "Change protocol", and "Backup and Restore" (stored and backed-up Lot-Match links); the overview's authority-map row "Lot matching" and load-bearing rule 5; ADR 0002's "Lot Match set"; Restore's Lot-Match agreement check in Workspace and Trade Analysis; the delivery contract's rebuild item "active FIFO Lot Matches" (now a derived result); and AC-LIFE-003's Lot-Match case. The `specs/` files are unchanged here. |
| 31 | **An underlying-price option Stop or Target is measured by the contract's value at expiration at its trigger price** (D7 breakdown, P24, 2026-10-17, at the user's direction). | The trader enters only the Underlying trigger. Its measurement value is the contract's intrinsic value at that price, a point on the Planned Expiration Payoff, frozen because the trigger and contract are frozen; 1R, Original Planned Reward, Ongoing Risk to Stop, Reward to Target, Overrun, Entry Quality, and the at-entry line all use it. No option pricing model is used. Trade Detail and the Review also show the position's value at expiration at the Underlying's exact latest close, labelled as an expiration value and kept apart from Mark-to-Market figures. An option Trade with underlying-price conditions needs both the contract's and the Underlying's Marks. Accepted tradeoff: expiration values ignore time value left at an early exit, so a long option's Stop on the worthless side of its strike makes 1R the whole premium. D10 must extend this to multi-leg structures, including those with two expirations. |
| 32 | **A Mark may be exactly 0 for any Instrument, never negative** (D7 breakdown, P27, 2026-10-17, at the user's direction). | An option or a stock that closed with no value is recorded honestly as 0 rather than 0.01. Execution and intended entry prices stay positive. Amends D4 A37, T4.13, I4.8, and C4.12. |
| 33 | **A backup is streamed, never built in memory** (D8 breakdown, P29, 2026-10-17). | The artifact is gzip-compressed canonical JSON, one value per line: a header, record lines by section, a closing line per section, and a final manifest with counts, exclusions, and digests. Export runs in a worker inside one read-only IndexedDB transaction, hashing with `@noble/hashes` and compressing with `fflate` synchronously, so a concurrent save commits after the snapshot and is wholly outside it. Verification and Restore stream the file through `DecompressionStream`. Saves wait while a backup runs, and the backup screen says so. |
| 34 | **Restore preparation builds the complete candidate database; apply rechecks and flips the pointer** (D8 breakdown, P30, 2026-10-17). | Preparation stages, migrates, validates, repairs, and rebuilds inside an unreferenced candidate, so live data is untouched and apply is one atomic root transaction. Because it writes a database, preparation needs `Writable` readiness and otherwise returns `RuntimeNotWritable`; `Recovery Only` explains that Restore needs a browser that can save safely. |
| 35 | **A backup's content version is the schema version it was read from** (D8 breakdown, P31, 2026-10-17). | The header carries `formatVersion` (line layout) and `schemaVersion`. Restore accepts every schema the release can migrate from (1 through the current one) through the same per-record transforms as startup migration, then validates against the current schema with `zod`. Transforms read only authoritative fields; private fields come only from the private rebuild. A schema change freezes a backup fixture at its version and proves Restore from every earlier one. **Amended by decision 114 (revision 103):** Restore accepts schemas 3 through the current one; schemas 1 and 2 were never used. |
| 36 | **A blocked older database is exported at its own schema version** (D8 breakdown, P32, 2026-10-17). | Migration Blocked offers Download a copy and Verify; `IntegrityBlocked(AwaitingMigration)` offers Download a copy only, so it never claims a backup (glossary, Integrity Blocked); an unreadable root offers neither. Restore stays unavailable while blocked. |
| 37 | **Restore is offered on the Backup page and at first run; a safety backup is required only when user data exists** (D8 breakdown, P33, 2026-10-17). | User data is any Trade, Journal outcome, observation, Institution, or Account. The confirmation's safety choice is Back up this journal first (download and verify inline, bound to the preview's target) or Replace without a backup (with its own warning acknowledgment). Apply accepts only a receipt issued in the same application instance and bound to the live binding. Provider credentials stay out of every backup, as the spec requires; the user declined reopening it for an encrypted credential section. |
| 38 | **Backup round trip is a cumulative obligation** (D8 breakdown, P34, 2026-10-17). | AC-BACK-001 and AC-REST-001 are cumulative (full at D28); D11 adds the credential exclusion and provider non-contact. AC-LIFE-003 becomes full in D12, after D10 and D12 add their agreed record kinds. |
| 39 | **The benchmark dataset is written as a backup artifact and loaded through the production Restore** (D8 breakdown, P35, 2026-10-17). | `bench:setup` restores it at first run, requiring zero issues and repairs. `verify:capacity` fails if the restored Workspace's usage exceeds the projection by more than 10%, and peak usage during a second Restore over it must stay within `3 × M`. **Amended by decision 114 (revision 103):** those restored checks are run by `bench:verify-capacity`, which also fails above 1.50 × a committed usage baseline. `verify:capacity` checks D7's capacity figures only. |
| 40 | **Rolling-wave freeze** (plan freeze, 2026-10-17, at the user's direction). | The plan freezes with task-level breakdowns for D1–D8, and with D9–D28 at the deliverable level (stories, capabilities, acceptance claims, and blocking order). The user judged that breaking down all 27 deliverables before any code exists would rest on assumptions implementation is certain to overturn. **This departs from the planning protocol**, whose Phase 6 freezes a "complete task graph" with "per-task TDD red/green or structural evidence" for every deliverable. The departure is recorded here, not made silently. Before any deliverable without a breakdown is implemented, its breakdown is written and approved as a revision of the frozen plan under the protocol's own clause ("a required deviation pauses work, identifies affected acceptance scenarios and durable compatibility, and obtains approval before the frozen plan is revised"). Each revision gets the next revision number and a tag, names any amendment to an earlier (possibly implemented) deliverable together with its migration and fixture consequences, and updates the acceptance matrix rows it touches. |
| 41 | **D4's P14 is settled before D4's first task, not before the freeze** (plan freeze, 2026-10-17, at the user's direction). | P14, the boundary between the "quantified pressure" and "routine" attention bands, changes public behavior only in D4's Review. D1 and D2 do not touch it. It no longer blocks the freeze; it blocks the start of D4's implementation, and its answer is recorded as a revision. |
| 42 | **Package versions pinned** (plan freeze, 2026-10-17). | Each package is the newest stable release on or before 2026-10-03 within the approved majors, listed in [technology-stack.md, "Pinned versions"](technology-stack.md#pinned-versions) with the browser and OS provenance. TypeScript is 6.0.3, the stack's planned fallback, because `typescript-eslint` does not support 7.0. React Router stays on 7 and Vitest on 4.1, as approved, although newer majors exist. Node.js was 24.21.0 LTS, and is the 26.x line from revision 2 (decision 43). |
| 43 | **Node.js is the 26.x line, at least 26.12.0** (plan revisions 2 and 3, 2026-10-18, at the user's direction). | Replaces decision 42's Node.js 24.21.0. Node runs only the build and test tooling, every pinned tool supports Node 26, Node 26 enters LTS in late October 2026, and the machine uses Homebrew's Node. 26.12.0 (2026-10-14) is an accepted exception to the two-week rule. Revision 3: the user does not pin Homebrew, so the plan pins a range instead of an exact version. `package.json` declares `"engines": { "node": ">=26.12.0 <27" }` and `.npmrc` sets `engine-strict=true` (both created by T1.1). Minor and patch upgrades within 26.x need no revision; a new major does. Every evidence run records its exact Node version. `@types/node` moves to 26.6.4. |
| 44 | **TypeScript 7.0 type checking with the 6.0 API for typed linting** (plan revision 4, 2026-10-18, at the user's direction). | Replaces decision 42's single `typescript` 6.0.3. `typescript-eslint` still requires TypeScript `<6.1.0` (8.71.2, 2026-10-18), and 7.0 has no programmatic API, so the plan adopts the side-by-side setup from Microsoft's TypeScript 7.0 announcement: `typescript` aliased to `@typescript/typescript6` 6.0.2 with its `@typescript/old` dependency overridden to `typescript` 6.0.3, and `@typescript/native` aliased to `typescript` 7.0.2. `tsc` (7.0) runs `npm run typecheck`; `tsc6` and every tool that imports `typescript` run on 6.0.3. T1.1 records both versions and checks that `tsc6 --noEmit` also passes. The `tsconfig` sets 7.0's changed defaults explicitly and uses no option 7.0 removed. Revisit when `typescript-eslint` supports TypeScript 7's API. |
| 45 | **Implementation sessions read a scoped part of `specs/`, chosen by the spec map** (plan revision 5, 2026-10-19, at the user's direction). | At the start of a deliverable, the implementing session reads that deliverable's list in `plan/spec-reading/` instead of every spec document. The list holds every core section of the [spec map](spec-map.md) plus every section tagged with the deliverable, and no planning-only section. From this document it reads every section except the definitions of deliverables later than the current one. Measured at the start of D2, the reading fell from 235K to 181K tokens of context. **This departs from the specification's kickoff prompt**, which says to read `specs/README.md` and every document it indexes. The departure is recorded here and in the kickoff's plan-specific conditions, not made silently. `specs/` stays the complete, read-only baseline. The map is non-normative, and a spec passage wins over its summary. Before building on or deciding about any section that is not on its list, the session reads that section, found through the map. The browser critic keeps access to the complete specs and plan. Drafting a breakdown still means reading the specs in full; the drafting session also retags its deliverable's sections in the map, since the D9–D28 tags are provisional, taken from the definitions alone. A missing tag found during implementation is corrected in the map, the lists are regenerated, and the correction is noted in the deliverable's evidence. It changes no product semantics, so it is not a revision. |
| 46 | **D2 follow-ups are deferred into a batch before D4, not reopened in D2's gate** (plan revision 6, 2026-10-24, at the user's direction). | After the D2 gate passed, the known gaps and the critics' minor observations became follow-ups F1–F12 in [D2, section 11](D02-open-a-long-stock-position.md#11-deferred-follow-ups-plan-revision-6-decision-46). F1–F11 (tasks T2.25–T2.35) run before D4's first task, each test-first in a fresh subagent with a cumulative run, followed by one fresh critic over the touched flows; F12 (section-validator gaps) is carried into D8's T8.6. The D2 gate, its tag `claude-opus-5.5-d2`, and its `covered` rows stand, because no item failed a pass condition. No schema, fixture, bench-dataset, or backup-version change. |
| 47 | **The D2 UI is aligned with the reference screenshots in a batch after the D2 follow-ups and before D4** (plan revision 7, 2026-10-24, at the user's direction). | From the screenshot comparison in `evidence/D02/screenshot-comparison.md`, [D02-ui-alignment.md](D02-ui-alignment.md) adds tasks T2.36–T2.55 (T2.46 withdrawn) in four batches (shell, Trades, forms, Detail), screenshots, and a fresh critic gate. They run after F1–F11 (decision 46) and before D4's first task, absorbing F8 (into T2.38) and F9 (into T2.40). Revision 7 also gives T2.25–T2.35 full task breakdowns in [D2, section 11.1](D02-open-a-long-stock-position.md#111-task-breakdowns-for-t225t235). Decisions U1–U7 were answered by the user: a narrow scrolling table with a pinned Underlying; no live preview; expandable Execution rows; corrected issues clear; dedicated routes; drawn inline SVG icons; heading only on Trades. The column order (I1) and the collapsed Execution row (I2) are settled with the user during T2.40 and T2.50. Specs override the screenshots; no view-model shape, schema, fixture, bench-dataset or backup-version change. |

| 48 | **The Trades tables describe each Trade in one Trade column, built from a structured Trade Summary, beside a separate Underlying column, with a Net cost figure** (plan revision 8, 2026-10-25, at the user's direction during T2.40). | Replaces the I1 column proposal of decision 47. A column per figure cannot describe a multi-leg structure, so Trade Views attaches a derived `summary: TradeSummary` to every coherent list item and Detail: a discriminated union with `Stock` in D2, `Option` in D7, and `Structure` and `Legs` in D10. The UI formats it as text such as "Long 60 shares @ $50.10", "Long 1 Nov 20 $300 Call", or "Short 1 Nov 20 $240/$250/$320/$330 Iron Condor". Trade Analysis's `derive` returns **Net cost**: the signed cost of the open Lots plus their unconsumed opening fees, D4 A41's `C + F`, shown from D2 because it needs no Mark. Underlying stays the first, pinned, linked column. Only columns a trader scans by stay: the Open table is Underlying · Trade · Net cost · Entry · Account (P&L joins in D4), and the Planned table Underlying · Trade · 1R · Reward : risk · Entry · Account. Strategy, Quantity, Average cost, Fees, Integrity, Deviations and Last activity leave the Open table; Strategy, Planned reward and Plan time leave the Planned one. The planned quantity moves into the Entry cell. An integrity disagreement is still surfaced on its row (AC-LIFE-003), as a "Records disagree" badge in the Trade cell. On narrow the Trade cell has a second line with the row's key figures and attention badges, and the columns it repeats are hidden; on wide the reverse. Current P&L joins after Net cost in D4. Underlying and Strategy sorts are added to `browseTrades` in D22. The design and its later-deliverable amendments (D4 T4.23, D6 A95/T6.16/T6.18, D7 A119/T7.16/T7.23, D10, D22) are in [D02-ui-alignment.md, section 2a](D02-ui-alignment.md#2a-the-trade-column-and-net-cost-plan-revision-8-decision-48). It adds tasks T2.56–T2.59 and rewrites T2.40. **Durable compatibility:** no schema, committed fixture, bench dataset or backup-version change. The two fields are derived on read. `verify:fixtures` adopts D4's A51 rule early (T2.56), so the frozen v1 and v2 snapshots stay valid unchanged, and the new fields' values on them are asserted by an integration case. The bench's expected rendered rows and items are regenerated. No acceptance row changes status. |
| 49 | **Attention pressure is the share of the planned range travelled since entry, and settles D4's P14** (plan revision 9, 2026-10-27, at the user's direction, with an approved edit to `specs/design/daily-review.md`, "Date, eligibility, and ordering"). | The spec's pressure (risk to Stop against reward to Target) rose as a Trade worked and fell as it neared its Stop, which ranks winners above losers. The user wants the walk to encourage cutting losers and letting winners run, with the dollar figures on each card carrying the size of what is at stake. Pressure is now the losing share (risk consumed since entry ÷ risk at entry) or the winning share (reward consumed since entry ÷ reward at entry), each figure evaluated with the open Lots' open cost, without fees, in place of the Mark; for Long Stock this is (average open cost − Mark) ÷ (average open cost − Stop) or (Mark − average open cost) ÷ (Target − average open cost). Halfway to the Stop and halfway to the Target both read 1/2. At equal pressure the losing Trade comes first, then Last Activity, then identity. **P14:** pressure above 0 is quantified pressure; pressure 0 (at entry, or a winner with Unbounded reward) and Not Comparable Trades that are not evidence limited are routine. The range uses the effective Stop and Target, which equal the Plan Baseline's until D17 adds management revisions; D17's breakdown decides whether a revised Stop moves the range. **Affected:** the spec passage above (the Highest case is dropped: a Trade with no reward left is past its Target, in boundary reached; Zero keeps its meaning for Unbounded reward); D4 P14, the five-Trade fixture's expected pressures (T-A 91/291, T-E 1/10; the order T-D, T-B, T-C, T-A, T-E is unchanged) and T4.14's attention cases. No acceptance scenario names pressure, so none changes. **Durable compatibility:** none; pressure is derived on read, with no schema, fixture, bench-dataset or backup-version change. |
| 50 | **The `claude-opus-5.5-d2` tag marks the complete D2, including its follow-ups and UI alignment** (plan revision 9, 2026-10-27, at the user's direction). | D2 section 11 and D02-ui-alignment.md said the tag would not move during the follow-up and UI-alignment batches. After T2.66-B1 the user moved it from `ccce51a` (critic-3's gate) to `de3fa27`, the last D2 commit, and pushed it. D4 A50 and T4.27 therefore build the previous release from the finished D2, which is still schema 2, so the migration and previous-release cases test the D2 a trader would actually have. **Durable compatibility:** none; the frozen `workspace-v1` and `workspace-v2` fixtures are unchanged, and `verify:fixtures` passed on `de3fa27`. |
| 51 | **Session-policy coverage starts on 2024-01-01** (plan revision 10, 2026-10-27, at the user's direction during T4.2). | The user journals only from now on and does not backtest, so no calendar before 2024 is needed; T4.2 also found no NYSE-published source for 2011 or for 2000–2002's regular holidays. Coverage is 2024-01-01 through 2028-12-31 (D4 P8; amends decision 25). A date before 2024 returns the `SessionPolicyCoverage` diagnostic, so a Trade recorded with pre-2024 dates never gets Marks for them. Coverage is extended by a release with a new policy revision once NYSE publishes a later year (D4 A40); a short-notice closure also needs a release, and until then the trader can acknowledge the Mark unavailable. **Affected:** D4 P8; T4.1's cases, restated within coverage (Sunday observance with Independence Day 2027, the Saturday New Year's case with 2027-12-31, the closure case with 2025-01-09, the coverage case before 2024-01-01; "Juneteenth only from 2022" is dropped, leaving 19 cases), T4.2 (2024–2028 only), and D4 section 1.3 and T4.30, whose generator clock starts on 2024-01-02 instead of D2's 2021-10-11 (about 1,260 sessions, so the mature counts are unchanged, with the as-of instant in late 2028). No acceptance scenario changes status. **Durable compatibility:** none; no release has shipped the policy, the frozen v1 and v2 fixtures hold no pre-2024 dates, and the bench dataset is regenerated once under a bumped generator version. |
| 52 | **Optimistic bindings: subject conflicts are reported, shared-counter conflicts are retried** (plan revision 11, 2026-10-27, at the user's direction during T4.4). | [ADR 0011](../specs/adr/0011-optimistic-bindings-and-shared-counter-retry.md) refines ADR 0002. A write that advances a shared `meta` counter (Market Data, Catalog, or Journal revision) binds that counter; when only counter bindings fail, the owning module re-reads, re-validates, and commits again, up to 3 attempts in all, then returns its typed conflict. Subject bindings (a Mark key's resolution revision, a Trade's fact revision, a referenced Catalog record, the whole Catalog for label distinctness) still return the typed conflict at once. T4.4's ocr review found that two Marks saved at once for different keys conflicted on the Market Data counter; an in-transaction increment primitive was tried in T4.4-B3 to B5 and reverted in T4.4-B6. **Affected:** D4 T4.4 (bug tasks T4.4-B6 to B8 in `evidence/D04/structural.md`); D1's Catalog `seedDefaults` and D2's Journal `seedDefaults`, which commit with no checks and write their counter from a value read before the transaction, so two tabs starting at once can lose a counter advance and duplicate default records (T4.4-B7, T4.4-B8). No acceptance scenario changes status. **Durable compatibility:** none; no stored format changes. |
| 53 | **No module-wide Market Data counter** (plan revision 12, 2026-10-27, at the user's direction during T4.4). | `meta.marketDataRevision` is removed. Nothing read it: `MarketDataSnapshotId`'s change detection is its evidence digest (A45 recomputes it on every `ExpectedSnapshot`), and coherent cross-module reads bind the Workspace content revision (A46). Every Mark save advanced it whatever the key, so it made unrelated saves contend and cost a second record write per save; Marks are the most frequently written data, and per-key binding also suits a later multi-tenant deployment. A Mark save binds only its key's `resolutionRevision` (A38), with no retry; ADR 0011's counter retry stays for the Catalog and Journal seeds. **Affected:** D4 A38, A45, the T4.3 fresh-Workspace case, the T4.4 semantic-commit case, the T4.18 binding case, I4.3's dump; D8 A125 and I8.3; ADR 0011's examples; code by bug task T4.4-B10 (the v2→v3 migration, schema-v3 test, and `MarketData.save`, removing B6's retry). No acceptance scenario changes status. **Durable compatibility:** none; schema 3 has not been released and its fixture is frozen only by T4.29. |
| 54 | **Outside session-policy coverage, every figure that needs a Mark is Unavailable, and the shell shows a calendar warning icon** (plan revision 13, 2026-10-28, at the user's direction during T4.18). | P8 named `Unavailable(SessionPolicyNotCovered)` but no shape. When the as-of date is outside coverage there is no Expected Mark Date or frame, so each Mark-dependent figure of an Open item and Open Detail is `Unavailable(SessionPolicyNotCovered)`; figures that need no Mark (realized-to-date, fees, cost basis) keep their values, and the Expected Mark Date and Mark resolution are absent. The shell's coverage notice becomes a warning icon like the browser-storage icon, whose message is "Coming soon - update calendar" until a calendar-update capability exists. **Affected:** D4 P8, T4.18 (bug task T4.18-B1), T4.25's notice case. No acceptance scenario changes status. **Durable compatibility:** none. |
| 55 | **Vitest 4.1.12 and Wrangler 4.153.0** (plan revision 14, 2026-10-29, at the user's direction after D4). | `npm audit` reported `@vitest/mocker` (moderate) in Vitest 4.1.11, and `sharp` and `undici` (high) through Wrangler 4.147.0's Miniflare. The pins in [technology-stack.md](technology-stack.md) move to the patched versions; 4.153.0 is the earliest Wrangler past the vulnerable range. **Affected:** the development and deploy pins only; the full cumulative suite passes unchanged (`evidence/D04/structural.md`, "Dependency bump: wrangler and vitest"). No acceptance scenario changes status. **Durable compatibility:** none. |
| 56 | **Outside session-policy coverage, an Outstanding Debt on Trade Detail reads "Reflection owed" with no due classification** (plan revision 15, 2026-10-29, at the user's direction before D5's T5.11). | A69 classifies a Debt on Trade Detail against the Expected Mark Date E and the previous session's close. Outside coverage (decision 54) there is neither, so A69 had no answer. Such a Debt carries no classification, reads "Reflection owed" without "Due" or "Due in the next Review", and Reflect now and Decline still work. **Affected:** D5's A69, T5.11 and T5.17 (amendment notes there). No acceptance scenario changes status. **Durable compatibility:** none; the classification is derived, never stored. |
| 57 | **A Plan Reflection cannot be deferred through the facade, so D5's I5.10 does not attempt it** (plan revision 16, 2026-10-30, at the user's direction during D5's T5.23). | I5.10 asked for "Defer for a Plan Reflection through `confirmPlan`" to return `DispositionNotAllowed`. `confirmPlan`'s command carries only the reflection's answers and the coordinator always submits a Complete disposition, so no facade caller can express a deferral; a forged object fails as a storage error, not a typed rejection. The row now submits the Plan with its reflection unanswered (typed `RequiredAnswerMissing` issues, nothing written), and `DispositionNotAllowed` stays proven at the Journal module (A66; its module test "should reject Defer or Decline for Plan Reflection with DispositionNotAllowed"). **Affected:** D5's I5.10 (amended in place). No acceptance scenario changes status. **Durable compatibility:** none. |
| 58 | **D5's benchmark Outstanding Debts may span two sessions, and a deferral is listed in every Review until resolved** (plan revision 17, 2026-10-30, at the user's direction during D5's T5.21 and T5.24). | Section 1.4 put both Outstanding Debts in the session before the as-of session. D4's unchanged schedule has one Position Change there, so the generator takes the second from 2028-12-27; the 2028-12-28 Review in the history stays Incomplete, and both Debts are due at the as-of Review. Section 1.4 now says the Debts are from the last sessions before the as-of session that have a Position Change. B5.4 said Monday's Review "does not list" a Monday deferral, while B5.1 and C5.2 show it there as "Due in the next Review"; the user's direction is that every deferral is surfaced in every Review until it is resolved, so B5.4 now expects "Due in the next Review" on Monday (Review still able to reach Complete) and "Due" on Tuesday. **Affected:** D5's section 1.4 and B5.4 (amended in place). No acceptance scenario changes status. **Durable compatibility:** none. |
| 59 | **D5's critic flow C5.5 lists a Monday deferral in Monday's Review** (plan revision 18, 2026-10-30, applying the user's direction recorded in decision 58 before D5's T5.25). | C5.5 said Monday's Review "omits" a Monday deferral, the same disagreement decision 58 settled for B5.4: C5.2 shows such a deferral in the first Review as due in the next Review, and the user's direction is that every deferral is surfaced in every Review until resolved. C5.5 now expects "Due in the next Review" on Monday (the Review can still reach Complete) and "Due" on Tuesday. **Affected:** D5's C5.5 (amended in place). No acceptance scenario changes status. **Durable compatibility:** none. |
| 60 | **Vite 8.3.4 and Zod 4.6.7** (plan revision 19, 2026-10-30, at the user's direction after D5). | `npm audit` reported Vite 8.3.0–8.3.2 (high: `launch-editor` and dev-server file-exposure advisories) and Zod below 4.6.6 (high: memory exhaustion on oversized constrained collections). The pins in [technology-stack.md](technology-stack.md) move to Vite 8.3.4, the newest release at least two weeks old (8.3.5 was nine days old), and Zod 4.6.7. `npm audit` then finds 0 vulnerabilities; unit tests (893), typecheck, `tsc6`, lint and build pass (commit `4e7a620`). **Affected:** the development and runtime pins only. No acceptance scenario changes status. **Durable compatibility:** none. |
| 61 | **D5R: the Daily Review redesigned as one card per position** (plan revision 20, 2026-10-31, at the user's direction after D5, from layout B of the Review prototype `prototypes/review-workflow/index.html`). | [D05R](D05R-review-redesign.md) revises D4's and D5's Review screen: each walked Trade is a card opened in place, holding its Marks (saved together with Save Marks), its reflections grouped by day, and its Action, with a Stop-to-Target slider and Reward : risk now and planned. **Reopened passages:** (1) Daily Review "Date, eligibility, and ordering" (the task-family order as a screen order) and AC-REV-002's "task families appear in Mark, Debt, settlement, Trade order": cards follow attention order, and inside each card the work keeps the spec's order (P36). As with decision 29, the frozen `specs/` files are not edited. (2) Daily Review `save`, which "is either `SaveTradeAction` or `ResolveReviewDebt`", gains a third command, `SaveReviewMarks`, which saves a card's Marks in one commit and returns the refreshed Review in its result (P37, P38). (3) The Market Data interface gains `prepareEffects` and `applyPreparedEffects`, an internal module seam the UI never calls; `save` is rebuilt on them with unchanged behaviour (P37). Also added: a range position per walked Trade and the Trades of each historical gap group in `open`, the Plan baseline in `getTrade` (P39, P40), and Reward : risk now in Trade Analysis `evaluate` (P40). **Affected:** D4 A48, A57, A60 (superseded); D5 A67 (extended), A71 (superseded); D6 P20, A90, A94, T6.20; D7 A112, A115; AC-REV-002 (a note in the matrix). D5R runs before D6 (P41). No acceptance scenario changes status. **Durable compatibility:** none; no store, index or schema change (A163). |
| 62 | **D5R: Market Data's historical gaps return each listed session's close** (plan revision 21, 2026-10-31, approved by the user during T5R.3). | A153 has each historical gap group name its Trades, with the first session each Trade is relevant from. Relevance starts at the first session whose close is at or after the Trade's exposure (Market Data, "Manual writes and precedence"; D4 A56). Only Market Data sees the session policy (D4 A39). `recover`'s computed `HistoricalGaps` therefore also returns the session close of each listed date (Missing or acknowledged), which its scan already holds, and Daily Review sets each Trade's `from` to the first listed date whose close is at or after that Trade's earliest exposure. A Trade with no such date is not listed. **Reopened passage:** the Market Data `recover` result, beyond decision 61's prepare/apply pair. Nothing is stored: gaps stay computed from the `observations` records and the session policy at each `open`. No new request. **Affected:** D5R A153 and T5R.3 (bug task T5R.3-B1). No acceptance scenario changes status. **Durable compatibility:** none; no store, index or schema change (A163). |
| 63 | **D5R: a Trade after every listed gap date is listed from the Review date** (plan revision 22, 2026-10-31, approved by the user while closing T5R.3). | Decision 62's last sentence ("A Trade with no such date is not listed") contradicted T5R.3's planned case and I5R.5, which list XYZ's Friday gap group with T-A from Friday 2026-10-09 and T-F from Monday 2026-10-12. The user confirmed that a gap shows only on the cards of Trades that held the Instrument at that session's close (T-A only for Friday). **Amended rule:** every eligible Trade that holds the Instrument is listed with the gap group. Its `from` is the first listed date whose close is at or after the Trade's earliest exposure. When there is no such date, `from` is the Review date. A card shows a listed gap only when the gap date is on or after its `from`. T5R.3's planned case and I5R.5 stand as written. **Affected:** decision 62 (last sentence superseded); T5R.3 (bug task T5R.3-B2). No acceptance scenario changes status. **Durable compatibility:** none; no store, index or schema change (A163). |
| 64 | **D5R: the cards re-sort when a save returns a refreshed Review** (plan revision 23, 2026-10-31, at the user's direction while closing T5R.8). | A150 kept the cards in the order the screen first showed ("stable within a Review view"), and T5R.8-B2 enforced it. Marks are entered on the cards, so a saved Mark that moves a Trade into another band (B4.1: ABC past its Stop, "Boundary reached") left the most urgent card below less urgent ones until the Review was reopened. The user's direction: when entering a Mark changes the attention order, the cards re-sort. **Amended rule:** the cards follow the newest Review the screen holds; the open card stays open, with its entered values, as it moves. The spec passage is not reopened: Daily Review "Date, eligibility, and ordering" says "Within a Review view, order is stable. A fresh `open` may produce a new order", and each save's refreshed Review is read as a fresh one. **Affected:** D5R A150 (amended in place); T5R.8 (bug task T5R.8-B4 undoes B2's fixed order); B4.1 stands as written. No acceptance scenario changes status. **Durable compatibility:** none; no store, index or schema change (A163). |
| 65 | **D5R: browser card helpers that reach what a step reads** (plan revision 24, 2026-10-31, at the user's direction while closing T5R.10). | D5R section 6.3 moved the D4 and D5 browser cases onto cards through helper changes only. That held for cards and drafts, but with T5R.10's panels (one open at a time, A152) 19 cases read a panel the card didn't open on, and fixing them inline would mean the same sweep through every spec at each later layout change (T5R.11, T5R.12, D6, D7). The user chose helpers that reach the card and panel a step reads or uses, with a task breakdown. **Added:** D5R section 6.4 (API, five rules, a mechanical-only migration rule) and tasks T5R.10-H1 (behavioral, 4 cases), T5R.10-H2 and T5R.10-H3 (structural: the D4 and D5 specs moved onto the helpers, every `expect` keeping its matcher and value). Section 6.3's helper-only rule is amended. The breakdown guide's full `specs/` reading and spec-map retagging are not done: the tasks change test helpers only, with no product behavior. **Affected:** D5R sections 3, 5, 6.3, 6.4; T5R.15 builds its `e2e/d5r` specs on the helpers. No acceptance scenario changes status. **Durable compatibility:** none. |
| 66 | **D5R: two raw locators kept from section 6.4's retire list** (plan revision 25, 2026-10-31, approved by the user during T5R.10-H2). | Moving the D4 specs found two uses that need a locator that never clicks: B4.1 asserts the first card opens on its Marks panel before any reach (rule 4), and the D4 update case reads the old release's Trades section (rule 5). Retiring them would change two expectations' matchers, against the migration rule. **Amended:** `marksFamily` and a plain `tradesFamily` (without the click-rewriting proxy) stay as raw locators for rule 4 and rule 5 steps only. **Affected:** D5R section 6.4's retire list; T5R.10-H3. No acceptance scenario changes status. **Durable compatibility:** none. |
| 67 | **D5R: "also held by" names the other Trades by their summary line** (plan revision 26, 2026-10-31, at the user's direction during T5R.15). | A153 named the other Trades holding a shared Instrument by their Underlyings, but a shared Instrument has one Underlying, so the row read "also held by XYZ" on XYZ's own card. The T5R.9 case and B5R.3 expected "also held by T-F", a fixture label the app never shows. **Amended:** the row names each other Trade by the summary line the Trade list and Trade Detail show (`tradeSummary`, e.g. "Buy 100 shares @ $50.00"), linked to that Trade. The Review already reads each Trade's summary, so no request is added (P38). **Affected:** A153; the T5R.9 case; B5R.3; gap task T5R.9-B5. No acceptance scenario changes status. **Durable compatibility:** none (no stored data changes). |
| 68 | **D5R: each Review card is identified by its Trade** (plan revision 27, 2026-10-31, at the user's direction during T5R.15). | Two Trades can hold one Underlying (the card fixture's T-A and T-F on XYZ). Their card headers both read "XYZ", the messages and blockers named both "XYZ", and the Open list's and Trade Detail's Missing-Mark links opened the first card holding the Instrument, which could be the other Trade's. The tests couldn't reach either card by its symbol, so `e2e/d5r/support.ts` tagged them from load-time state (T5R.15-B2, whose first attempt stopped with no change because no rendered card carried its Trade id). The user decided six things. **(1)** Each card's list item carries `data-trade-id`, a test hook that shows nothing. **(2)** The header shows the Trade's summary line (`tradeSummary`) after the Underlying, or the Underlying alone when there is none. **(3)** Every message and blocker names the Trade as "XYZ (Long 100 shares @ $50.18)" (option (a), always), while "Mark missing" keeps naming the Instrument and "also held by" keeps the summary line alone. **(4)** The Missing-Mark links carry `?trade=<id>&instrument=<key>`. **(5)** The slider leaves the header's side only when the card's header is under 40rem, by a container query on the card rather than the viewport (measured: at the old 640 px viewport switch, the fixture's longer header took three lines beside the slider). **Amended:** A150, A156, A161 and A162; section 6.4's API (a symbol or Trade reference); B5R.11; section 7's C5R.4, C5R.8 and C5R.9. **Added:** section 6.5 with tasks T5R.15-I1 to I6, B5R.12, and a structural row for I3. **(6)** The open card's body is labelled with the Trade's name ("XYZ (Long 100 shares @ $50.18) review", or "XYZ review" without a summary), so a screen-reader user hears which Trade a region belongs to (I4). The unit matchers on the label don't change, because their fixtures carry no summary, and after I3 the browser tests read it only through `tradeCard`, which matches the label with or without a summary. **Sanctioned expectation changes:**<br>• B5R.5's hold-message text (I4);<br>• `e2e/d5r/review.spec.ts`'s `data-trade` 'T-A' check, which becomes `data-trade-id` with T-A's id (I3);<br>• four unit link `href` values (I5).<br>Every other spec edit follows section 6.4's migration rule. T5R.15-B2 is superseded: its three findings are absorbed by I2 and I3. **Reading:** the drafting guide's full `specs/` reading was scoped to `specs/design/daily-review.md` and `specs/design/ui-contract.md` in full, whose sections are all already tagged for D5 or core, so the spec map is unchanged. The change is presentation and test hooks only. The UI contract's "Responsive behavior" says "Exact breakpoint and sizing are implementation choices", and a card's width follows the live viewport width. **Affected:** D5R sections 1.4, 3, 5, 6.2, 6.4, 6.5, 7 and 8; T5R.15 (its cumulative run follows I6). No acceptance scenario changes status. **Durable compatibility:** none; no store, index or schema change (A163). |
| 69 | **D5R2: Review card progress from the coordinator, one due rule, one held-Review module, bindings staged by their owners, and additive glossary entries** (plan revision 28, 2026-11-01, at the user's direction after D5R, from candidate 1 of the architecture review). | [D05R2](D05R2-review-card-progress.md) is a refactor deliverable that runs before D6 (P43). **(1)** The Daily Review coordinator computes each card's progress as data (P42): the card's panels in work order, Marks resolved and needed, reflections due now and later, Action owed, each panel's done, and the card's done (A164). It is carried on `open`'s walked items, on `getTrade`, and in every save result (A165). The screen words it and counts nothing (A167, A169). `WalkedTrade.reflections` is removed. This follows the spec, which gives progress to the coordinator: Daily Review "derives eligibility and progress" ("Contract"), and `open` and `save` return progress (`open`, `save`). **(2)** The due classification moves into a domain module, `src/domain/journal-debt/` (`classifyDue`, with decision 56's no classification without closes). Daily Review and Trade Views both call it, and Journal's `OneSessionGrace` type moves there (P44, A166). The move is type-only: stored data, fixtures and backups are byte-identical. **(3)** One UI formatter words the classification for the Review and Trade Detail (P45). **(4) The held Review (candidate 2, added the same day):** one pure UI module, `src/ui/screens/held-review.ts`, folds every result into the Review the screen holds, keeps each Mark key's standing (removing `CardMarks`' second copy), and picks the card to open next. `ReviewView` keeps the requests, the guards against late results, and the effects (P50, P51, A171–A173). **(5) Bindings staged by their owners (candidate 5, added the same day):** Journal's `applyPreparedEffects` binds the counter it advances. Trade Workflows wrote it without a binding, which ADR 0011 calls a defect. Trade Workflows now retries a counter-only conflict, as the coordinator that owns the command, and Daily Review drops its two copies of the check. Review frames carry an opaque evidence binding that Market Data stages through an internal `bindEvidence`, so Daily Review no longer reads the `observations` store (P52–P54, A174–A176). **(6)** The one visible change: a Reflections panel with nothing owed reads "None", as after a reload, never "Resolved" (P46). It is the one sanctioned unit expectation change. All 179 browser cases and every file under `e2e/` are unchanged (P47). **(7) The glossary rule:** this branch may add entries to `specs/glossary.md` but never change or remove one. Each new entry cites the decision that added it, and earlier decisions are not edited. Only domain terms are added. "Due Classification" is added now; card progress is defined in the breakdown, not the glossary. Each glossary edit updates the spec map's line ranges and character counts for the glossary and regenerates the reading lists. The frozen spec on `main` then shows exactly what was added. **Spec map corrections** (decision 45, found while regenerating the lists): revision 11's added line in `specs/README.md` had left S004–S008 one line short, so every reading list stopped one line before the end of "Conformance rules". Revision 12's added consequence in ADR 0011 had left S259 at 1–19 of 20 lines. S090 kept its count from before decision 49 rewrote the pressure paragraph. Each now matches its file, and all 259 rows were checked. **P49 (agreed, option a):** the earlier-optional Mark count stays out of the record, because a save does not scan historical gaps. The screen counts the earlier rows it lists. **Reading:** the drafting guide's full `specs/` reading was scoped, as decision 68's was, to `specs/glossary.md` and the Daily Review, Journal, Trade Views and Reporting, and UI contract design documents, read in full (A170). **Affected:** D5 A63 and A69 (notes); D5R A150 and A152 (notes); D6 A86, A89, A90, T6.11–T6.13 and T6.20; D7 (two notes: Settlement Due as a panel progress variant, and tech debt item 5 to raise before D7 starts); tech debt items 4 and 5; D9's numbering, now from P55 and A177. No acceptance scenario changes status. **Durable compatibility:** none; no facade operation, store, index or schema change (A168). |
| 70 | **D6: the previous release is D5R2** (plan revision 29, 2026-11-01, at the user's direction after D5R2). | D6's A97 and T6.21 named the tag `claude-opus-5.5-d5`, written before plan revisions 20 and 28 inserted D5R and D5R2. The release harness now builds D6's previous release from `claude-opus-5.5-d5r2` (`765ac1e`), the last release before D6, so B6.6 and C6.8 test the update a trader would actually take. All three tags are schema 4. The user chose a folder named for the release: `dist-releases/d5r2`, beside a current `d6`, with no `d5` folder, following D5's T5.18, which moved the current source from `d4` to `d5`. Browser cases that serve `dist-releases/d5` move to `d5r2` where they update into the previous release, and to `d6` where they mean the current source. **Affected:** D6 A97, T6.21, its structural row, B6.6 and C6.8 (amendment notes). No acceptance scenario changes status. **Durable compatibility:** none; the release harness is test tooling, and no store, index, schema or facade operation changes. |
| 71 | **The D6 prefactor: two browser tiers and a leaner browser suite** (plan revision 30, 2026-11-01, at the user's direction, after a review of the browser suite). | [The D6 prefactor](D06-prefactor-browser-tests.md) runs after D5R2 and before D6's first task. It changes browser tests, test tooling and process documents only; no file under `src/` changes. **Why:** the suite had 179 browser tests (7.4 minutes) and ran in full after every task. Only 31 of the tests covered feature behavior, and 1 of 216 runs had caught a product regression. **(1) Two tiers (P55).** After a task, `full-suite.sh` runs the full browser suite when the task's commits touch the UI, the app shell, the service worker, delivery, persistence, styles, `e2e/`, the Playwright or Vite config, the package files or the release tools. Otherwise it runs a task tier: the 5 tests tagged `@every-task` and the current deliverable's `e2e/` folder. Persistence is in the full tier because the browser suite is the only test of real IndexedDB. The full suite still runs before every critic, as the planning protocol requires. **(2) Release history (P56).** B2.3, B2.5 and B4.7 upgrade between two frozen tag builds, so no change on the branch can fail them. They are tagged `@release-history`, leave `test:e2e`, and are run by `test:e2e:release-history` and by RC. From now on, the task that points a deliverable's previous release at a tag tags the update case whose two ends are then both tags (D6's T6.21: B5.6). **(3)** `ui-alignment.spec.ts`'s 41 looped copies become 17 tests that loop inside, keeping every assertion except one listed duplicate (P57). **(4)** B1.5 keeps 2 of its 6 fault sets in the browser, and T2.55-B3, which repeats a unit case, is removed (P59). **(5)** The user dropped the review's sixth recommendation, cumulative guarantee specs (P60). **(6)** No critic and no release tag (P61); the prefactor's starting and finishing tags are `claude-opus-5.5-pre-d6p` and `claude-opus-5.5-pre-d6d`. **specs/ reading (decision 45):** the planning protocol's testing and critic-gate sections and the acceptance rows below, since no product behavior changes. **Affected:** D1 B1.5; D2 B2.3 and B2.5; D2 UI alignment, section 6; D4 B4.7; D6 T6.21, T6.27 and section 10; tech debt item 6 (amendment notes). AC-DEL-003 (B2.3, B4.7, B5.6, still run by `test:e2e:release-history` and RC) and AC-DEL-004 (B1.5 keeps a two-fault case) do not change status. **Durable compatibility:** none: no store, index, schema, fixture, backup content or facade operation changes. |
| 72 | **D6: the Review records Exit intent only, with no Exit link** (plan revision 32, 2026-11-02, at the user's direction during D6's T6.20). | **The user's reading:** in a Review card's Action panel, the trader records intent; they do not perform the action. Saving Exit records the Exit Action and nothing more, so the card no longer opens the exit form. The trader records the exit itself later, from Trade Detail's **Record exit** (T6.19). If the trader does not exit by the next market session, that would be a Deviation. **Why now:** T6.20 built A94's **Record the exit**, which hosted the exit form inside the Action panel. Three bug-task rounds left a finding about unsaved Action edits beside the hosted form. The user then saw that the form contradicts what an Action means. **The spec allows this:** `specs/design/daily-review.md` ("`getTrade`") says that saving any Action "records intent only and *may* offer navigation to a Trade Workflow". AC-REV-003 does not ask for a link. **(1) What changes in D6:** A94 is withdrawn. T6.20 removes Record the exit, the exit form hosted in the Review, and its Refresh Review. T6.12's walked cards lose their exit route (`exitRoute`), because only the link read it; a walked Closed Trade still has no route. The owed-reflection cards (A90, P20) are unchanged. **(2) The tests that change:** T6.20's "Exit link (A94)" case becomes a check that a card with a saved Exit Action offers no exit form and no link. B6.5 and C6.7 record the exit from Trade Detail after saving Exit in the Review. AC-REV-003's D6 re-proof rests on I6.11, which already records the exit outside the Review. **(3) Exit intent not carried out (an open issue, not built):** the user proposes a new Deviation category. An Exit Action whose Trade is still Open after the next market session would be a Deviation. The spec has four categories (`specs/design/trade-analysis.md`, "Normative analytical rules"): Planned-Leg Terms, Entry Size, Unplanned Exposure and Stop Discipline. The new one is a spec change, and it is recorded as an open issue for D12, which adds the Review-based Deviation (Stop Discipline). **Affected:** D4 A58 (its "D6 adds Exit's link" no longer holds); D6 A94, the UI boundary row, the T6.20 heading and cases, the T6.12 walked-cards case, B6.5, C6.7, the AC-REV-003 rows in sections 8 and 9, and the clause-check index (amendment notes); D12 (an open issue). AC-REV-003 does not change status. D7's A113 is not changed. Its Record expiration from the Review's settlement item answers Settlement Due, a fact the trader must record; it is not an Action's intent. **Durable compatibility:** none. No store, index, schema, fixture, backup content or facade operation changes. `getTrade`'s walked card loses an optional field that only the UI read. **Amended by decision 124, from when D9.5 is built:** the Review card holds the Trade's exit form after an Exit is saved; the Action itself still records intent only, and no link between the Action and the sale is stored. |
| 73 | **D6: T6.25 is measured on a partial benchmark dataset, and the Review-save growth is tech debt item 8** (plan revision 33, 2026-11-03, at the user's decision after generator 5 was stopped). | **What happened:** generator 5 ran 31,418 s (about 8.7 hours) and was stopped by SIGTERM. Its last log line is session 775 of 1,255; the stored data reached session 784 (2027-02-17). That is 15,743 Trades (15,624 Closed, 99 Open, 20 Planned), 62,683 Position Changes, 125,340 Executions, 118,776 Mark revisions and 78,317 Actions, and the last session's Review was part-way (18 of 99 Actions). **Why:** each Review save costs more as stored history grows, linearly, so the full run was estimated at about 23 hours (tech debt item 8). **The decision:** (1) T6.25 is measured on that partial dataset and closes with a disclosed deviation: `bench:partial` derives the expectations from the stored records and `bench:run -- --partial <dir>` runs the harness (T6.25-P1). Results are in `evidence/D06/bench.md`. (2) The AC-PERF-001 D6 row is **partial, not covered** until a full regeneration and rerun. (3) The save growth is recorded as tech debt item 8, not fixed in D6. **Affected:** D6 T6.24 and T6.25 (rows in the task list and section 7), and the AC-PERF-001 rows in sections 8 and 9 (amendment notes); tech debt item 8. AC-PERF-001 changes status from planned to partial for D6. **Durable compatibility:** none. No store, index, schema, fixture, backup content or facade operation changes; the changes are tools and evidence only. |
| 74 | **D6: the Review-save growth is fixed in D6 as bug task T6.25-B2, and the benchmark is regenerated and rerun in full** (plan revision 39, 2026-11-03, at the user's decision). This partly reverses decision 73. | **Why:** the cause is verified, with a verified fix. Chromium's IndexedDB keeps the old index entry when a record's index key moves, and removes it only when a read-write cursor visits it. Every Position Change and every lifecycle move leaves one in the Open or Planned range of `trades.byLifecycleActivity` and `trades.byLifecycle`, and every eligibility read scans those ranges. At session 784 the Open read took 168 ms against 1.6 ms on a fresh copy. The full analysis is in tech debt item 8, now T6.25-B2's description. **The decision:** (1) **T6.25-B2** (product code) makes `applyPreparedChange` stage, after its Trade `put`, a new Persistence write `{ op: 'vacateIndexKey', store, index, key }` for each of those two index keys the write moved. `commit` performs it as a read-write cursor over `IDBKeyRange.only(key)` in the same transaction. Migration writes are left out (revision 38), and there is no backlog cleanup (revision 36). A Chromium regression test churns Trades through the real write path and fails if the Open read grows beyond a small factor of a fresh database's. Reading the Open set once per save (item 8, option 3) stays out of scope unless the smoke run below shows it is needed. (2) **Regeneration:** after the fix, a smoke generation of about 300 sessions must show the per-save, `getTrade` and `open` costs flat across sessions. Then the full generation runs to all 1,255 sessions (the section 1.4 profile), and `bench:run` runs on it alone. That run replaces the partial run as the run of record in `evidence/D06/bench.md`, and the partial results stay there as history. (3) **The gate:** the T6.28 critic gate is held until the fix lands, then runs on the final code. The critic and the full generation may run at once, on different ports; `bench:run` may not. (4) **AC-PERF-001's D6 row** becomes coverable again once the full rerun passes. The user is asked before it is marked covered. **Affected:** D6 T6.24 and T6.25 (task-list rows and section 7), the AC-PERF-001 rows in sections 8 and 9 (amendment notes), and tech debt item 8 (moved out). **Durable compatibility:** none. There is no store, index, schema, fixture, backup content or facade operation change. The new write op is internal to Persistence, and the stored records are unchanged. |
| 75 | **D6: the stale entries in `journalDebts.byOutstandingDue` are fixed as bug task T6.25-B3, and a general cleanup inside Persistence becomes tech debt item 9** (plan revision 40, 2026-11-03, at the user's decision). This extends decision 74. | **Why:** with T6.25-B2 in the bench build, a 300-session smoke generation still grew. Saves went from 29 ms in sessions 1–25 to 63 ms in sessions 251–275, and `getTrade` from 4 s to 12–13 s per 25 sessions. An investigation (`evidence/D06/t6.25-residual/report.md`) found a second stale index. The Journal's Debt resolution drops the sparse `outstandingDue` field with a plain `put`, so each settled or declined Debt leaves a stale entry in `journalDebts.byOutstandingDue`. That was about 5,800 at 300 sessions, against 119 live entries. Each `getTrade` reads the full range once, and each save twice. The read took 13.2 ms on the churned profile, against 1.2 ms on a fresh copy and 1.9 ms after one sweep. Sweeping it made `getTrade` and the save match a rebuilt database. No other index or store showed growth. **The decision:** (1) **T6.25-B3** (product code): the Debt resolution branch of the Journal's `applyPreparedEffects` stages B2's `vacateIndexKey` for `journalDebts.byOutstandingDue`, with key `[outstandingDue, debtId]` from the record before the write, whenever a write removes or moves that key. A Chromium regression test settles and declines many Debts through the real write path and fails if the Outstanding read grows beyond a small factor of a fresh database's. There is no backlog cleanup (as in revision 36). (2) **Tech debt item 9:** the general fix in Persistence, which vacates any index key a `put` or `delete` moves, derived from each store's index key paths. (3) **Order:** no critic run and no generation until B3 lands. Then one 300-session smoke generation checks both fixes together, before the full generation, `bench:run` and the T6.28 gate, as decision 74 sets out. **Affected:** D6 T6.25 (task-list row and section 7, amendment notes), and tech debt item 9 (new). **Durable compatibility:** none. There is no store, index, schema, fixture, backup content or facade operation change. |
| 76 | **Upgrade tests are deferred until the first release for real use** (plan revision 41, 2026-11-04, at the user's decision after D6). This partly reverses decision 71's P56. | **Why:** nothing has been released and no one has the app installed with real data. A migration step for a schema no one ever installs never runs against real data: the schema of the first release for real use is every user's starting point. Meanwhile the upgrade tests cost time on every deliverable. The `@release-history` tests rebuild every old tag in the system temp folder and run `npm install` there; each deliverable's own upgrade case adds a previous-release harness task, a browser case and a critic flow on `serve:releases`. **The decision:** (1) No deliverable gate runs `npm run test:e2e:release-history`. (2) Breakdowns add no previous-release harness task, no upgrade case from the previous release and no critic update flow until tech debt item 10 is resolved. (3) D7's A120, B7.7 and C7.8 and D8's A146, T8.16, B8.12 and C8.9 are withdrawn. (4) D7's T7.25 becomes a structural task that tags B6.6 (`e2e/d6/update.spec.ts`) `@release-history`, so it leaves routine runs. (5) Upgrade logic stays covered by each schema change's integration migration tests (I6.1 and their successors migrate every earlier schema to the current one), by B2.4 and B2.6 (a D1 build to the current code in Chromium) and by D1's update-flow tests B1.10–B1.13. `test:e2e:release-history` and `build:releases` stay, since B2.4, B2.6 and the card helpers use the D1 and D4 builds. **Risk accepted:** each new migration step runs in a real browser only at the first release for real use, and old tag builds may stop building unnoticed. **Affected:** D7 A120, T7.25, B7.7, C7.8, the critic's servers and the AC-DEL-003 row; D8 A146, T8.16, B8.12, C8.9, the critic's servers and the AC-DEL-003 row (amendment notes); the AC-DEL-003 row in the acceptance matrix; RC; the drafting guide; tech debt item 10 (new). AC-DEL-003's D7 and D8 rows change from planned to deferred; D6's stays covered. `specs/` is unchanged: AC-DEL-003 asks for PWA identity and tab readiness, not an upgrade per deliverable. **Durable compatibility:** none. There is no store, index, schema, fixture, backup content or facade operation change. **Amended by decision 112 (revision 101):** B6.6 is deleted, and the checked-out build is `dist-releases/current`. |
| 77 | **The D7 prefactor: one Calculation Result throughout, worded once** (plan revision 42, 2026-11-04, at the user's decision, resolving tech debt item 5 before D7). | [The D7 prefactor](D07-prefactor-calculation-results.md) runs after D6 and before D7's first task, from `claude-opus-5.5-d6`. **Why:** a figure's reason for having no number starts in Trade Analysis as a Calculation Result, and Daily Review converts it into three home-made copies (`PressureBasis`, `RangePosition`, `AttentionReason`, through a private `RiskReward`), each dropping or renaming something; the reason is then worded in about eight places. A date outside session-policy coverage reads three different ways for one Trade. D7, D10 and D11 each add reasons. **The decision (P63–P76):** (1) The one value is the Calculation Result itself, covering every way a calculation fails. Its `Unavailable` and `NotApplicable` hold one case each of two typed unions, a reason with its own details, in `src/domain/calculation-result/`. (2) Facts that can't be replayed are `Unavailable(FactsIncoherent)` with self-describing findings. (3) Daily Review's risk and reward, pressure and range position become Calculation Results, and every reason passes through unchanged; ranking keeps its meaning. (4) Reason details carry the tagged `Instrument`; `src/domain/instrument/` owns `instrumentKey` and `instrumentOf`. (5) One UI module, `src/ui/calculation-words.ts`, words every reason at three lengths (label, figure, sentence), returned in parts, with the texts approved in the breakdown's section 1.4; a new `verify:wording` check keeps it the only one. Approved text changes: "Outside the market calendar" in place of decision 54's "Not available"; `NoOpenQuantity` merged into `NoRemainingPosition`; "Records disagree" only for an integrity disagreement, with "Facts can't be replayed" for facts that can't be replayed. (6) No browser critic; unit, component and new browser layout tests and `verify:wording` stand in. (7) **D7's option Instrument key becomes the unpadded OCC option symbol** (for example `XYZ261120C00055000`), so stored keys match exchange and data-vendor data: the Option Instrument stores its OCC root as a field of its own, which D7 fills in as the symbol without "." (at most 6 characters), and option strikes have at most 3 decimal places. D7's options are equity options; index options (cash-settled, roots such as `SPXW`) wait for cash settlement in D20, recorded as an open question. **Reading** (decision 45): scoped, as decisions 68 and 69 scoped theirs, to the glossary, ADR 0007 and the Trade Analysis, Daily Review, Trade Views and Reporting, UI contract and overview design documents (A181). **Numbering:** P63–P76 and A181–A188; D9's numbering now starts at P77, A189 and decision 78. **Affected:** D7's opening note, A99 and its key cases, and its `SettlementDue` and option-Instrument tasks; D2 UI alignment (T2.40's badge, the incoherent Detail); D4 P8 and T4.18-B1 (decision 54's figures); tech debt item 5 (resolved); the D7 breakdown's open question for D11 (amendment notes). No acceptance scenario changes status. `specs/` and the glossary are unchanged. **Durable compatibility:** none. No store, index, schema, stored record, fixture, backup content or facade operation changes; only the shapes of derived results do. |
| 78 | **The D7 prefactor updates the derived-view fixture snapshots to the new result shapes** (plan revision 43, 2026-11-04, at the user's decision before T7P.1). | **Why:** the D7 prefactor's A182 and its gate assumed `npm run verify:fixtures` guards stored data only. It also compares the views the current release derives from each fixture with that fixture's committed `expected-views.json`, field by field over the snapshot's fields, and `tests/integration/d4` and `d6` load the same snapshots. The v4 and v5 snapshots hold the shapes the prefactor replaces (Unavailable `detail`, `NoOpenQuantity`, `PressureBasis` `NotComparable`, `RangePosition` `NotPlaced`, `RiskReward` `MissingInput`, `instrumentKey`, and the findings), so the check cannot pass unchanged. **The decision:** (1) In the task that changes each producer (T7P.1, T7P.4, T7P.5), the derived-view snapshots `tests/fixtures/workspace-v*/expected-views.json` change only the shapes that task changes, keeping every value (A185 applied to the snapshots). (2) Every `dump.json`, the stored records, stays byte-identical, and `git diff claude-opus-5.5-pre-d7p -- src/persistence` stays empty. (3) The gate reads: `npm run verify:fixtures` passes, `git diff claude-opus-5.5-pre-d7p -- tests/fixtures` touches only `expected-views.json` files, and each task's evidence lists the snapshot shapes it changed, old and new. Translating the new shapes back in the tool, or loosening the comparison, were rejected: either would stop the check testing what the app returns. **Affected:** the D7 prefactor's section 1.1 ("Stays unchanged"), A182, section 5 (gate) and section 6.1 (amendment notes). No acceptance scenario changes status. `specs/` is unchanged. **Durable compatibility:** none. No store, index, schema, stored record, backup content or facade operation changes; `dump.json` files are unchanged, and only derived-view snapshots change. **Numbering:** D9 now starts at P77, A189 and decision 79. |
| 79 | **The D7 prefactor: Trade Detail's Valuation note for an acknowledged Mark takes the module's sentence** (plan revision 44, 2026-11-05, at the user's decision during T7P.7). | **Why:** T7P.7 routes Open Detail's Valuation note through `src/ui/calculation-words.ts` at the sentence length (P70, P71). Its text for an acknowledged Mark, "Acknowledged unavailable for DEF on Mon Oct 12: your acknowledgment, not a price", was none of section 1.4's three lengths, so routing it through the module changes it to "Mark acknowledged unavailable for DEF on Mon Oct 12: your acknowledgment, not a price". The browser expectation in `e2e/d4/responsive-a11y.spec.ts` (line 175 at `claude-opus-5.5-pre-d7p`) was not in the breakdown's section 6.2. The missing-Mark note ("Mark missing for XYZ on Mon Oct 12") is unchanged. **The decision:** the sentence length stays, and section 6.2 gains this row, which T7P.10 changes. The figure length (two colons in one note) and keeping the old words outside the module (a second wording, which P74's check forbids) were rejected. **Affected:** the D7 prefactor's section 6.2 (amendment note). No acceptance scenario changes status. `specs/` is unchanged. **Durable compatibility:** none. **Numbering:** D9 now starts at P77, A189 and decision 80. |
| 80 | **The D7 prefactor: `verify:wording` keeps no exemption; the Mark row's status words and the exit form's issue-code checks move into the wording module** (plan revision 45, 2026-11-05, at the user's decision during T7P.9). | **Why:** P74's check, as built in T7P.9, hit two texts that aren't a Calculation Result's reason: the Mark row's Expected-Mark Status words "Acknowledged Unavailable" (`MarkEntry.tsx`), which the prefactor's section 1.1 keeps unchanged, and the Position Change form's comparisons on the validation issue codes `ExceedsOpenQuantity` and `FlatBeforeLaterFacts` (`position-change-issues.ts`), which share the finding codes. **The decision:** the check stays exactly as P74 states, with only the module and test files exempt. `src/ui/calculation-words.ts` gains an Expected-Mark Status label (the same text) and predicates for those two issue codes, and the screens call them; no visible text changes. Narrowing the check (a rule for one screen) and rewording the Mark row (a change section 1.1 ruled out) were rejected. **Affected:** the D7 prefactor's P74 (amendment note). No acceptance scenario changes status. `specs/` is unchanged. **Durable compatibility:** none. **Numbering:** D9 now starts at P77, A189 and decision 81. |
| 81 | **D7's new reasons get approved words, and two D7 seams follow the code the prefactor and D5R left** (plan revision 47, 2026-11-06, at the user's decision while D7's handoff was written). | **Why:** D7 adds `SettlementDue` (an `UnavailableReason`) and `NoOptionExpirationAnchor` (a `NotApplicableReason`). The prefactor's wording module has exhaustive switches, so each case must be worded at the three lengths before `typecheck` passes (P70–P72, A188), and the D7 breakdown gave no text for either. Separately, D7's section 2 and T7.1 name a new `src/domain/instruments/` holding the label, which A99's amendment already replaced with the prefactor's `src/domain/instrument/` and the wording module's `instrumentLabel`; and T7.24's seam names D4's `ReviewTrade`, which D5R replaced with `ReviewCard`. **The decision:** (1) `SettlementDue` reads "Settlement due" (label), "Settlement due: XYZ 20 Nov 2026 55 Call" (figure) and "Settlement due for XYZ 20 Nov 2026 55 Call, which expired Fri Nov 20" (sentence); `NoOptionExpirationAnchor` reads "Not applicable" (label) and "Not applicable: no option expiration" (figure and sentence). (2) T7.1 extends `src/domain/instrument/`, with the label in `calculation-words.ts`. (3) T7.24 builds on `ReviewCard`, with Settlement Due as a panel between Reflections and Action and a `PanelProgress` variant (D5R and D5R2, section 9). **Rejected:** leaving the words for D7's session to raise at T7.3, which would stop the session mid-deliverable. **Affected:** the D7 breakdown's opening note, section 2, and T7.1's and T7.24's seams (amendment notes). No acceptance scenario changes status. `specs/` is unchanged. **Durable compatibility:** none; reason words are derived on every read. **Numbering:** D9 now starts at P77, A189 and decision 82. |
| 82 | **D7's two new findings get approved words, and a contract quantity reads "contracts"** (plan revision 49, 2026-11-06, at the user's decision during T7.4). | **Why:** T7.4 reports an option Execution dated after its contract's expiration (`AfterExpiration`) and a fractional contract quantity (`ContractQuantityNotWhole`) the way `derive` reports every fact that can't be replayed: as self-describing `IncoherentFact` findings carried by `Unavailable(FactsIncoherent)` (the D7 prefactor's P69). `findingWords` in `src/ui/calculation-words.ts` has an exhaustive switch, so each needs a sentence, and the D7 breakdown gave none. The existing `ExceedsOpenQuantity` sentence also said "shares" for any Instrument. **The decision:** with the prefactor's head ("Buy of 1 XYZ 20 Nov 2026 55 Call on Mon Nov 23, 10:00"), `AfterExpiration` reads "… is dated after the contract's expiration" and `ContractQuantityNotWhole` reads "… isn't a whole number of contracts"; `ExceedsOpenQuantity` reads "is more than the 2 contracts open" for an option and keeps "shares" for stock. These words appear only for stored facts that can't be replayed (for example an integrity disagreement on Trade Detail); the forms reject such input before saving. **Rejected:** keeping "shares" for options; reporting the two outside `IncoherentFact`, which would depart from P69. **Affected:** the D7 breakdown's T7.4 (amendment note). No acceptance scenario changes status. `specs/` is unchanged. **Durable compatibility:** none; finding words are derived on every read. **Numbering:** D9 now starts at P77, A189 and decision 83. |
| 83 | **D7's Expiration findings get a head of their own and approved words** (plan revision 50, 2026-11-06, at the user's decision during T7.5). | **Why:** T7.5 reports an Expiration that doesn't settle every contract open (`ExpirationMustSettleAllOpen`), one dated after its contract's expiration or before an Execution on the contract (`SettlementTimeInvalid`), and one on a stock Instrument (`NotAnOption`) as `IncoherentFact` findings (P69). `findingWords` has an exhaustive switch, the D7 breakdown gave no words, and the prefactor's head names a side (Buy or Sell) that an Expiration doesn't have. **The decision:** an Expiration finding is its own description kind (`kind: 'Expiration'`, with the fact, Instrument, settlement time and quantity), and its head reads "Expiration of 1 XYZ 20 Nov 2026 55 Call at Fri Nov 20, 16:00". After it, `ExpirationMustSettleAllOpen` reads "… doesn't settle all 2 contracts open", `SettlementTimeInvalid` reads "… is dated after the contract's expiration or before an Execution on it", and `NotAnOption` reads "Expiration of 100 XYZ at … names a stock, not an option". These words appear only for stored facts that can't be replayed (for example an integrity disagreement); the expiration form and the workflow reject such input before saving. **Rejected:** two `SettlementTimeInvalid` sentences, one per cause. **Affected:** the D7 breakdown's T7.5 (amendment note). No acceptance scenario changes status. `specs/` is unchanged. **Durable compatibility:** none; finding words are derived on every read. **Numbering:** D9 now starts at P77, A189 and decision 84. |
| 84 | **Schema 6 keeps stored Stock Instruments as they are; the `v5→v6` transform only bumps the version** (plan revision 51, 2026-11-06, at the user's decision during T7.7). | **Why:** A118 says Planned Leg and Execution Instruments "become a tagged value" and that the `v5→v6` transform "rewrites every existing Instrument as `Stock` with multiplier 1". Schema 5 already stores the tagged `{ kind: 'Stock', symbol }` (for example `tests/fixtures/workspace-v5/dump.json`), and the domain's `StockInstrument` (T7.1) has no multiplier field: `multiplierOf` derives 1 for Stock and only the Option Instrument stores `multiplier: 100`. Storing `multiplier: 1` would make migrated Stock records differ from new ones, or need a domain type change. **The decision:** at schema 6 a Stock Instrument stays `{ kind: 'Stock', symbol }` with no stored multiplier; the `v5→v6` transform changes no record (like `v2→v3`, it drops private fields only) and the schema version still moves to 6, because schema 6 records can hold Option Instruments, `exerciseIntent` and the Expiration member, which a schema 5 release can't read. T7.7's second case proves every Stock Instrument is unchanged after the chain, nothing else changes in any store, and a v1 Workspace reaches v6 inside one candidate. **Rejected:** storing `multiplier: 1` on Stock, which would add a durable field the domain never reads and a T7.1 type change. **Affected:** A118 and T7.7 in the D7 breakdown (amendment notes). No acceptance scenario changes status. `specs/` is unchanged. **Durable compatibility:** schema 6's Stock Instrument is schema 5's, byte for byte; no stored field is added or removed by the transform. **Numbering:** D9 now starts at P77, A189 and decision 85. |
| 85 | **The Reference Catalog lists Strategies in the spec's label/identity order, not seed order** (plan revision 52, 2026-11-07, at the user's decision during T7.9). | **Why:** T7.9's second case says `query` should "list the four selectable Strategies in seed order", but the Reference Catalog design (`specs/design/reference-catalog.md`, Query) says Query lists "in deterministic label/identity order". T7.9's commit `e82f155f` followed the plan and sorted by manifest seed order, which departs from the spec. **The decision:** `query` keeps the spec's label/identity order, so the four selectable Strategies list as Cash-Secured Put, Long Call, Long Put, Long Stock. A fix task (T7.9-F1) reverts the seed-order sort and amends the case. Seed order still governs the manifest (A101: the seeds are added after Long Stock in that order). **Rejected:** seed order as a spec deviation, which would need a `specs/` amendment outside D7. **Affected:** T7.9's second case in the D7 breakdown (amendment note). No acceptance scenario changes status. `specs/` is unchanged. **Durable compatibility:** none; list order is derived on every read and no stored field is added. **Numbering:** D9 now starts at P77, A189 and decision 86. |
| 86 | **D7's section-validator issues get approved sentences, and the Trade section validator receives Strategy shapes as an input** (plan revision 53, 2026-11-07, at the user's decision during T7.11). | **Why:** T7.11's Trade Record and Catalog checks need issue codes that reach `MIGRATION_ISSUES` in `src/ui/readiness-copy.ts`, which holds a sentence for every code, and the plan gave none. Separately, the Trade section validator received only the identities it closes references against (Account, Close Reason and Anchor ids), so A100's rule that a Cash-Secured Put has no Exercise Intent could only be guessed from the leg's sign, while the write path already passes the Strategy shape into the domain (`confirmPlan` → `assessPlan({ strategyShape, … })`). **The decision:** (1) Sentences: `ExerciseIntentNotApplicable` "A Cash-Secured Put records an exercise intent, which only a long option has."; `CloseReasonNotApplicable` "A Trade that closed by expiration records a close reason."; `ExpirationHasPriceOrFee` "An expiration records a price or fee."; `StrategyShapeMismatch` (Catalog section) "A default strategy's roles differ from the product it names.". Market Data's section `AfterExpiration` and the reused `PriceNegative` don't reach `MigrationIssue` and need no sentence; a fractional option Execution reuses `IncoherentFacts` (`ContractQuantityNotWhole`, decision 82). (2) The Reference Catalog's `validateSection` also returns `strategyShapes` (Strategy id → `StrategyShape`) in its `references`, and Workspace passes them to the Trade Record's `validateSection` as it passes `closeReasonIds`; fact modules still never call each other. (3) The Trade validator checks each stored Plan against its Strategy's shape with the domain's own Plan rules (`src/domain/trade-analysis/plan.ts`, shared with `assessPlan`), never a re-implementation: a Cash-Secured Put is known by its Strategy (one short Put role), never by the leg's sign, and a short Call is not a Cash-Secured Put; a stored Plan whose legs don't fill its Strategy's roles is caught by the same rule. (4) The Close Reason check reads the terminal member from the derived facts: a Trade whose terminal member is an Expiration owes no Close Reason (`MissingCloseReason` skips it) and reports one it carries as `CloseReasonNotApplicable`. (5) A stored Trade naming a Strategy the Catalog doesn't hold is not reported in D7 (no code); its shape check is skipped. **Rejected:** deciding the Cash-Secured Put from the leg's sign; the Trade validator reading the Catalog itself. **Affected:** T7.11 (amendment note); T7.11 also passes `strategyShapes` through `src/coordinators/workspace/migration.ts`, still seeding `D6_CATALOG_MANIFEST` until T7.17. No acceptance scenario changes status. `specs/` is unchanged. **Durable compatibility:** none; no stored field changes, and the sentences are derived on every read. **Numbering:** D9 now starts at P77, A189 and decision 87. |
| 87 | **D7's remaining words are approved in one batch, in [`plan/D07-approved-words.md`](D07-approved-words.md)** (plan revision 54, 2026-11-07, at the user's direction before T7.11 resumed). | **Why:** T7.5, T7.9 and T7.11 each stopped for words the plan didn't give, and the user asked to approve the rest at once so D7 runs uninterrupted. A subagent surveyed T7.11 to T7.32 against the plan, the spec reading and the code; the user reviewed all 141 rows on a review page, chose an alternative or an edit on 11 and discussed 22 to a resolution. **The decision:** (1) The file holds the approved words for T7.11 and T7.18 to T7.24 (eight conventions and 104 task rows), the resolutions of 18 conflicts between the plan, the specs and the code, and the answers to 3 open questions. Task briefs name the rows they use; words a row doesn't cover still need approval. (2) Words that already exist change in a new task, T7.36, before the UI tasks: decision 81's "Settlement due" becomes "Settlement Due" at every length; decisions 82 and 83's quantity findings take the singular at 1 and "in the position" ("is more than the 1 contract in the position"); the stock forms' "Only 2 shares are open." family becomes "The position has only 2 shares."; stock Execution lines on the receipts drop the fee. (3) The notable choices: "Type" labels the right, the screens say "price" and never "premium", every Underlying price has two decimals including "0.00" (amending A114), a short closed by a purchase is "Closed via buyback", every rejection code in the live forms has its own sentence, the Review has no screen-level settlement section (the card's Settlement panel and the blockers list carry it), and Record expiration from the Review opens the form on its own page with "Back to the Review" and no Refresh Review, as decision 72 did for exits. (4) A long option's `NoPositiveRisk` names the breakeven, as A100 says (new task T7.35, before T7.19). **Rejected:** approving words task by task. **Affected:** T7.11, T7.19 to T7.24 and section 6.2 (amendment notes); A100, A112, A113, A114, A119, B7.1 to B7.6, T7.22's texts and D7's capability set, as the file lists; new tasks T7.35 and T7.36. No acceptance scenario changes status. `specs/` is unchanged. **Durable compatibility:** none; words are derived on every read. |
| 88 | **Strategy is a first-class domain module whose shape is passed in, never looked up; Daily Review's pressure is fixed for options** (plan revision 54, 2026-11-07, at the user's decision after a design review). | **Why:** decision 86 found a validator about to guess a Strategy fact from a leg's sign, because only one Strategy had existed. The user asked which other components should receive the Strategy, or a map to look it up in, and whether Strategy needs a class hierarchy. A review of the whole design (the code at revision 53 and every later deliverable) found Strategy rules scattered or about to be copied (Exercise Intent from the first leg's sign in `plan.ts`, shape equality by `JSON.stringify` in `catalog.ts`, direction derived in five places) and two D7 defects: Daily Review's pressure and range position (`src/coordinators/daily-review/attention.ts`) use a Long Stock formula for options, and six helpers take `strategies.items[0]` as Long Stock, which decision 85's label order breaks once T7.17 seeds the option Strategies. **The decision:** (1) A pure domain module `src/domain/strategy/`, built like `src/domain/instrument/`: the plain-data `StrategyShape` and `StrategyRole` move there with `matchesShape`, and it adds `sameShape` and `exerciseIntentApplies(shape)`; D10 adds shape constraints and D23 shape validation. No class hierarchy: it can't represent trader-created shapes, fights plain stored data and Restore, and would pull Trade Analysis formulas into Strategy classes. (2) The Reference Catalog stays the only store. Coordinators resolve a Strategy once per command or view and pass its shape, or a map of shapes by Strategy id, to the modules that need it; the Catalog's section map holds every Strategy, active or not. (3) Rules the spec states "of any Strategy" (which side a condition is crossed on, breakeven, worst case, maximum reward, payoff) stay in Trade Analysis, worked from legs and Lots. (4) T7.11 creates the module, and `assessPlan`, the Trade section validator, the Catalog's `StrategyShapeMismatch` check and `prepareSeed` use it. The Trade validator checks each stored Plan only for shape match and Exercise Intent, so a later Plan rule can't block migration or Restore of existing history; this narrows decision 86's point 3. (5) New task T7.33, after T7.15: pressure and range position measure options as `evaluate` does (the trigger's value at expiration, the multiplier, signed quantities), and pressure's side is the larger positive consumed share, as the spec defines it, not `mark < averageCost`. (6) New task T7.34, before T7.17: Long Stock is looked up by product key in the bench generator, the fixture freezer, the capacity tool and two test helpers, and by label in the browser case. (7) The settlement item's assignment or exercise sentence follows its signed quantity, never the Strategy. (8) The Plan form preselects Long Stock by product key, and uses `exerciseIntentApplies(shape)` and the shape's role for its fields. (9) The changes and questions for D8, D10, D16, D20, D22 and D23 go to the review queue, and four simplifications to tech debt (items 14 to 17). **Rejected:** a Strategy class hierarchy; leaving the rules in their consumers. **Affected:** T7.11, T7.14, T7.17 and T7.19 (amendment notes); new tasks T7.33 and T7.34. No acceptance scenario changes status. `specs/` is unchanged. **Durable compatibility:** none; no stored field changes. |
| 89 | **Option-price Stops and Targets get a deliverable of their own, D7S, straight after D7** (plan revision 54, 2026-11-07, at the user's decision). | **Why:** reviewing D7's words, the user said an option Stop the trader sets on the option's price is a must: for example, buying back a Cash-Secured Put if it trades at 3.60, a loss of twice the premium, or an Underlying Stop and an option-price Stop together. D7 has only underlying-price conditions, measured at expiration (decision 31). What P24 rejected was a trader-estimated option price attached to an Underlying Stop; option-price (structure-value) conditions are in the spec and were planned for D10. **The decision:** D7S, after D7 and before D8, adds structure-value Stops and Targets to single-leg option Plans. Such a condition holds a price of the option itself, is crossed by the contract's Mark, and is measured directly from that price, with no expiration modelling. It combines with underlying-price conditions as independent OR conditions (glossary), so an option Plan may hold more than one Stop or Target, and D7's "exactly one" (A100, `ConditionCountNotOne`) lifts there. Schema 7 adds the condition kind. D10 extends structure value to multi-leg structures. D7 finishes as planned. **Rejected:** adding them inside D7, which reopens `assessPlan`, `evaluate` and the Plan form after ten tasks; leaving them in D10. **Affected:** the deliverable summary and a new D7S section; D10's capability set and durable representation; AC-CALC-003's declared scope; the D7 breakdown's review-queue item 2. D7S's breakdown is drafted after D7's tag. `specs/` is unchanged. **Durable compatibility:** schema 7, in D7S. **Numbering:** the next breakdown (D7S) starts at P77, A189 and decision 90. |
| 90 | **The startup check's exercise-intent sentence names no Strategy** (plan revision 55, 2026-11-07, at the user's decision before T7.11 started). | **Why:** decision 86 worded the Trade section's `ExerciseIntentNotApplicable` as "A Cash-Secured Put records an exercise intent, which only a long option has.", when a Cash-Secured Put was the only Strategy the check could see. Decision 88 widened the check to every Strategy whose shape takes no exercise intent (`exerciseIntentApplies(shape)` false), so a Long Stock Plan carrying one, which only a hand-edited backup can hold, would be called a Cash-Secured Put. **The decision:** the Trade section's `ExerciseIntentNotApplicable` reads "A Plan records an exercise intent, which only a long option has." for every Strategy (approved-words row 11.4), replacing decision 86's sentence. One code, one sentence. **Rejected:** a code and sentence per Strategy; keeping decision 86's sentence. **Affected:** T7.11 (amendment note); `plan/D07-approved-words.md` row 11.4. No acceptance scenario changes status. `specs/` is unchanged. **Durable compatibility:** none; the sentence is derived on every read. **Numbering:** the next breakdown (D7S) starts at P77, A189 and decision 91. |
| 91 | **After expiration, an expired option leaves its Underlying's Mark task** (plan revision 56, 2026-11-07, at the user's decision when T7.14 stopped). | **Why:** T7.14's third case said that at Monday 17:00, after T-1's XYZ call and T-3's MNO put expired on Friday, the Review lists no Mark task for either contract or for MNO "while XYZ's task names T-1 and T-2". A110 says a frame date after the expiration date requires neither the contract's Mark nor the Underlying's, and T7.6 built that rule, so T-1 cannot stay on XYZ's task while T-3 leaves MNO's. **The decision:** the case reads "while XYZ's task names T-2 only"; A110 is unchanged. **Rejected:** keeping the expired option on its Underlying's task. **Affected:** T7.14 (amendment note). No acceptance scenario changes status. `specs/` is unchanged. **Durable compatibility:** none. **Numbering:** the next breakdown (D7S) starts at P77, A189 and decision 92. |
| 92 | **The Plan receipt's Planned payoff moves from T7.19 to T7.22** (plan revision 57, 2026-11-07, at the user's decision before T7.19 started). | **Why:** T7.19's fourth case renders "the confirmed Plan's 1R and Planned payoff from the result", but `PayoffView`, which draws a payoff, is built in T7.22, after T7.19. **The decision:** T7.19's fourth case renders the confirmed Plan's 1R only; T7.22 gains a fourth case that mounts `PayoffView` on the option Plan form's receipt with the confirmed Plan's Planned payoff from the result (`postCommit.payoff.planned`). A114 and A116 are unchanged. **Rejected:** running T7.22 before T7.19; a placeholder payoff section in T7.19. **Affected:** T7.19 and T7.22 (amendment notes). No acceptance scenario changes status. `specs/` is unchanged. **Durable compatibility:** none. **Numbering:** the next breakdown (D7S) starts at P77, A189 and decision 93. |
| 93 | **A Closed option Trade's Detail shows no expiration line** (plan revision 58, 2026-11-08, at the user's decision after T7.23's ocr review). | **Why:** approved-words row 23.19 gave "Expired Fri 20 Nov 2026" for "a Closed or expired option Trade", so a Trade sold or bought back weeks before its expiration date would read "Expired" while the date was still ahead. The user: "A closed trade did not expire, it was closed. There should be no expiration line at all, and the wording should echo the wording used for a closed stock trade." **The decision:** a Closed option Trade's Detail shows no expiration line; its Terminal Disposition (row 23.12, "Closed via sale of 1 contract", "Closed via expiration of 2 contracts") says how it ended, as a Closed stock Trade's "Closed via sale of 100 shares" does. An Open option Trade keeps A119's "Expires Fri 20 Nov 2026" until the Settlement Due panel replaces it. Row 23.19 is amended. **Rejected:** "Expired" on every Closed Trade; "Expired" or "Expires" by the date. **Affected:** T7.23 (amendment note; bug task T7.23-B3). No acceptance scenario changes status. `specs/` is unchanged. **Durable compatibility:** none. **Numbering:** the next breakdown (D7S) starts at P77, A189 and decision 94. |
| 94 | **Only an expired option Trade shows "Expired"; a Trade the trader closed shows no expiration line** (plan revision 59, 2026-11-08, at the user's decision; replaces decision 93). | **Why:** decision 93 was recorded on a misreading: it dropped the line from every Closed option Trade, including one an Expiration left flat. The user: "A trade that is closed disposes of the position because of a direct action the trade[r] chooses to take. A trade that expires does so without any direct action by the trader. The term close/closed should refer to a position that the trader chooses to exit via an execution. An expired trade is no longer open, but it was never closed by the trader." That distinction conflicts with the specs, where Closed is the Lifecycle State of every flat Trade (glossary, ADR 0003) and approved rows 23.12, 23.14, 21.x word an expiration as "Closed via expiration". Asked how far D7 should apply it, the user chose the expiration line only. **The decision:** row 23.19 shows "Expired Fri 20 Nov 2026" when the Terminal Disposition includes an expiration (wholly or in part), and no expiration line when only the trader's Executions disposed of the Trade; an Open Trade keeps "Expires …" until its Settlement Due panel. Every other approved word, and the specs' model, stay as they are for D7. **Follow-up, after D7:** the wider wording ("Closed via expiration", the Closed list's expired rows, the expiration form's "Closing the Trade" and Close Review, the "Closed" lifecycle shown for an expired Trade) is to be reconsidered with the user under this distinction, possibly with a spec revision. **Rejected:** screen-word changes across D7 now; a domain Expired outcome now. **Affected:** T7.23 (amendment note; bug task T7.23-B4, correcting B3). No acceptance scenario changes status. `specs/` is unchanged. **Durable compatibility:** none. **Numbering:** the next breakdown (D7S) starts at P77, A189 and decision 95. |
| 95 | **D7's benchmark runs 726 sessions, so its Marks are about 120,000, not 190,000** (plan revision 60, 2026-11-08, at the user's decision, during T7.28). | **Why:** D7 section 1.4 moves the as-of instant to Friday 2026-11-20 17:00 and keeps about 150 distinct Instruments per session, but its "about 190,000 Marks" assumes D6's 1,255 sessions, which ran to the end of session-policy coverage (2028-12-31). The clock starts 2024-01-02, where coverage starts (decision 51), so only 726 sessions end on 2026-11-20, and 150 Instruments over 726 sessions give about 120,000 Marks. **The decision:** keep 726 sessions and about 150 Instruments per session; the Marks count is what that produces and is recorded in `bench/dataset.json`. The 25,000 Trades, their lifecycles, about 200,000 Executions and settlement facts, the option mix, the Expirations, the Exercise Intent Plans and the Close Review outcomes are unchanged. The full generation runs in the background from the main session. **Rejected:** about 260 Instruments per session (contradicts section 1.4); extending session-policy coverage back to about 2021 (changes the delivered session policy, out of D7's scope). **Affected:** D7 section 1.4 (amendment note), T7.28, T7.29. AC-PERF-001's D7 row is measured with the smaller Marks count, disclosed. `specs/` is unchanged. **Durable compatibility:** none. **Numbering:** the next breakdown (D7S) starts at P77, A189 and decision 96. |
| 96 | **The commit that makes a Trade Closed asks for the Close Reason and owes the Close Review, even when the change it records is dated earlier than the Trade's last fill** (plan revision 61, 2026-11-08, at the user's decision, during T7.30). | **Why:** T7.30's I7.4 Workspace B (S1 Sell 2 Monday 10:00; B1 Buy 1 Tuesday; then a Buy 1 dated Monday 10:30, recorded after B1) leaves the Trade Closed with no Close Reason and no Close Review owed. `closeRequirementOf` (`src/domain/trade-analysis/derive.ts`) requires them only when the newest recorded Position Change is also the terminal one in Fact Order. D6's P22 reasoned that its path rules make every terminal change the Trade's last fact, so nothing could be stranded; but an earlier-dated change can make an already-recorded last fact terminal. **The decision:** when a commit changes the derived lifecycle to Closed, that commit is the closing one: an Execution close is `TerminalWithAgency` (Close Reason required, Close Review owed), and an Expiration close stays `TerminalWithoutAgency` (an Expiration is always the last fact). This applies to stock and option Trades alike. Nothing is stranded, because a Closed Trade accepts no later Position Change (P22). **Rejected:** rejecting an earlier-dated change that makes the Trade flat (conflicts with decision 21's out-of-order recording); leaving the gap past D7. **Affected:** bug task T7.30-B1 (domain fix, the Execution form's Closing section if it reads the same requirement, and I7.4 Workspace B asserting the Close Reason and Close Review); D6's P22 reasoning (amendment note in this row only). `specs/` is unchanged. **Durable compatibility:** none; no stored record changes shape, and an existing Workspace with such a Trade simply has no Close Reason on it. **Corrected in revision 62 (2026-11-08, after T7.30-B1's ocr review):** the Close Reason fact recorded by that commit names the Trade's terminal Position Change in Fact Order (the last fill, B1 in the example), as the spec and the Trade Record section check (`closeReasonIssuesOf`) already require, not the earlier-dated change the commit records; `terminalTime` stays the last fact's time. The commit that closes still asks for it. And the durable note above was wrong: a Workspace in which such a Trade was closed before the fix fails the section check with `MissingCloseReason`. No such Workspace exists, because no release for real use has shipped (decision 76), so no repair is planned. Bug task T7.30-B1-R1. **Numbering:** the next breakdown (D7S) starts at P77, A189 and decision 97. |
| 97 | **The Open page may make one extra Market Data read per distinct earlier close date that its option Trades' dated lines need** (plan revision 63, 2026-11-08, at the user's decision, during T7.30). | **Why:** an option Trade with no Mark today shows a dated "At … close" line (T7.6, D4's mechanism; bug tasks T7.30-B3 to B3-R2). A Stock Trade's dated line needs only its own earlier Mark, which the Open page's existing read for each Missing Instrument already returns. An option's needs the Underlying's price at the contract's earlier close too, for the Stop and Target readings, Risk to Stop, Reward to Target and the distances, and the current frame doesn't hold that price. D4's T4.31 budget for an Open page (one `getAll` on `trades`, one `getAll` on `observations`, one `byInstrumentDate` per Missing Instrument) has no room for it, and D7's T7.29 bounds only the Review and Trade Detail. **The decision:** the Open page's budget is D4's counts plus one `Historical` `observations` read per distinct earlier close date of its option Trades' dated lines, each carrying every Underlying needed at that date, and never one per Trade. Trade Detail keeps T7.29's "at most one". Stock-only pages are unchanged. **Note for multi-leg options (D10, at the user's direction):** when spreads arrive, the read for an earlier date should pick up every contract in the spread (and the Underlying) at that date in a single read, not one read per leg; tech debt item 19. **Rejected:** no extra reads, with a contract-only dated line on the Open page and the full line on Detail; folding the earlier dates into the page's single `observations` read (a new Market Data query shape). **Affected:** T7.29 (amendment note; its query-count and benchmark proofs measure the Open page by this rule), bug task T7.30-B3-R3 (the review findings on B3-R2), D10 (tech debt item 19). AC-PERF-001's budget for the Open page is as stated here. `specs/` is unchanged. **Durable compatibility:** none. **Numbering:** the next breakdown (D7S) starts at P77, A189 and decision 98. |
| 98 | **Unit-test files leave the full-tier list, and the full browser tier runs as two foreground stages** (plan revision 64, 2026-11-08, at the user's direction, during T7.29; part (2) revised in revision 65, the same day, before any run of record used it). | **Why:** about 26 of D7's 37 cumulative runs through T7.30 ran the full browser tier (about 8 minutes) rather than the task tier (about 12 seconds), and many were triggered only by a Vitest file under a full-tier path (`src/ui/calculation-words.test.ts`, `TradeList.test.tsx`, `PlanForm.test.tsx`, `src/persistence/candidate.test.ts`), which can't change what the browser sees. The full tier is 7.9 minutes before `e2e/d7`, and T7.31 takes it past the Bash tool's 10-minute foreground limit. **The decision:** (1) P55's full-tier paths exclude `*.test.ts` and `*.test.tsx`; `e2e/` stays on the list (its files are `*.spec.ts` and helpers). (2) **As revised in revision 65:** the full browser tier runs as two stages, each its own foreground Bash call with the 600,000 ms limit, split by deliverable folder: `browser-1` runs `e2e/d1`, `e2e/d2` and `e2e/d4` (119 cases, about 4.8 minutes at T7.30), and `browser-2` runs `e2e/d5`, `e2e/d5r`, `e2e/d6`, `e2e/d7p` and `e2e/d7` (47 cases, about 3.1 minutes before `e2e/d7`). Each builds first (`build:faults && build:releases`, seconds), so either can run alone, and each keeps `--grep-invert @release-history`. They run one after the other, since both use port 5175. When `browser-auto <base>` picks the full tier, it runs nothing itself and prints the two stages to run, and `suite-runner` then runs `browser-1` and `browser-2` as two separate foreground calls (clarified in revision 66); the task tier stays one call. `run-complete.sh` checks five stage files. New deliverables' folders join `browser-2`. The trigger for a `browser-3` (the newest folders) is a runner reporting either stage above 8 minutes. A split by folder was chosen over Playwright shards because a failure names its half of the history, and growth lands in one known stage. *Revision 64's first version of (2), replaced:* a 12-minute limit, with `suite-runner` starting the stage in the background and `full-suite.sh` enforcing the limit with a watchdog. It was withdrawn because the user preferred keeping every stage a normal foreground call; its one run, `t7-29-final`, was stopped at the user's request and is not a run of record. **Rejected:** shards (tech debt item 6 (a)); more workers on their own ports (d). **Affected:** P55 (D6 prefactor), `package.json`'s browser scripts, `.claude/scripts/full-suite.sh`, `.claude/scripts/run-complete.sh`, `.claude/agents/suite-runner.md`, the D7 handoff's suite-runner row, tech debt item 6. No product behavior, acceptance scenario or durable representation changes. `specs/` is unchanged. **Numbering:** the next breakdown (D7S) starts at P77, A189 and decision 99. |
| 99 | **A D7 settlement item needs no stored read: its terms come from the contract and its time from the session policy** (plan revision 67, 2026-11-08, at the user's decision, during T7.29). | **Why:** A111 had Daily Review and Trade Views fetch one `Historical(expirationDate)` frame per distinct due date only to take that session's close from it as the settlement time. The code asks Market Data `ResolveSession` instead, which answers the close from the session policy with no stored read (T7.29's query-count test, and T7.29-B7's trace). The item's other terms need no read either: the contract names its strike and expiration, and the trader's records give the open quantity. D7's Expiration records contracts expiring unexercised, so it needs no price. **The decision:** A111's settlement time comes from `ResolveSession` for the expiration date. A non-session date falls back to the latest session before it, with its close, as A111 already says. The Review `open` adds nothing to D6's stored requests for settlement items. Trade Detail adds none for settlement, and keeps decision 97's at most one `Historical` read for a dated line. **Rejected:** changing the code to fetch the frame, which costs stored reads for an answer the session policy already gives. **Note for D20 (at the user's direction):** exercise and assignment depend on the Underlying's close on the expiration date against the strike, so D20's settlement needs at most one stored read per Underlying per distinct expiration date; tech debt item 20. **Affected:** A111 and T7.29 (amendment notes in the D7 breakdown), D20 (tech debt item 20). AC-PERF-001's budget for the Review is D6's counts. `specs/` is unchanged. **Durable compatibility:** none. **Numbering:** the next breakdown (D7S) starts at P77, A189 and decision 100. |
| 100 | **A breakdown's Progress section records status, not plan, and editing it is not a plan revision** (plan revision 69, 2026-11-08, at the user's direction, after the D7 retro). | **Why:** the handoff tracked progress in one table cell that grew to about 19,500 characters, mixing commit history with notes for later tasks (D7 retro, finding 2). The user: progress belongs in the task breakdown, so the plan is the source of truth and its commits are the audit trail; marking a task complete and adding its commits is a status update, not a change of scope or design. **The decision:** every breakdown ends with a "Progress" section: one row per task in run order, giving its status ("Not started", "In progress from `<commit>`" or "Done") and its commits. The commits are the task's own, then its bug tasks, suite-failure fixes and their rounds, by ID. Only the main session edits it. Edits to that section alone need no revision and no tag; any other change to a breakdown is still a revision. A180 is amended: the base commit is recorded in the task's Progress row, not in the handoff. The next task is the first row not marked "Done". The handoff keeps what the plan cannot hold: the notes for later tasks, the open questions for the final report, the session-start reading and the stop conditions. Run results, ocr outcomes and notes stay in `evidence/`. **Affected:** A180 (amendment note in the D6 prefactor breakdown), the D7 breakdown (section 11, backfilled from the D7 handoff and `git log`), `.claude/docs/implementing.md` and `.claude/docs/drafting-breakdowns.md`. `specs/` is unchanged. **Durable compatibility:** none. **Numbering:** the next breakdown (D7S) starts at P77, A189 and decision 101. **Amended by decision 111 (revision 84):** a deliverable whose Progress section has Wave and Lane columns runs its lanes at once, each lane one task at a time in its own order. |
| 101 | **The D7S prefactor: one Mark-to-Market Valuation, run after D7 and before D7S's breakdown** (plan revision 72, 2026-11-10, at the user's decision, after an architecture review of D7's commits). | **Why:** Trade Views and Daily Review each turn a Trade plus its Marks into an evaluation by hand. They take the Instruments from different places, settle the valuation date in opposite orders, and disagree on an option's dated line; Trade Views copies `derive`'s expiration rule, and D7's T7.32-B6 fixed only that copy. The expiration rule is a raw date comparison at nine places in four modules. D7S measures its structure-value conditions from the contract's Mark, so its breakdown should be written against one valuation. **The decision:** [the D7S prefactor](D07S-prefactor-mark-to-market-valuation.md) (P77–P89, A189–A194, 15 tasks) adds Mark-to-Market Valuation, one Trade per call, reading Marks through a Market Data read session opened once per coordinator operation, which reads each date and each Instrument once and never per Trade; the session settles the valuation date. `derive` records each option position's contract status (`Live`, `DueToday`, `PastExpiration`) and `evaluate` reads it; `expiredOn` and `settlementDueOn` in the Instrument module hold the two expiration rules, enforced by an ESLint rule. The Review card shows an option Trade's dated line, as the Trades list and Detail do (reversing the T7.30-B3 note in `evidence/D07/structural.md`). The prefactor also clears tech debt item 4. No browser critic; one latency harness run. **Rejected:** callers reading Market Data and passing frames in; many Trades per call; per-Trade reads with the query-count proofs relaxed; a cache that only production uses (section 9 of the breakdown). **Affected:** `specs/design/market-data.md` (the read session) and `specs/design/trade-analysis.md` (`derive`'s contract status); the D7 breakdown's T7.6 note; tech debt item 4. **Durable compatibility:** none; no stored data, schema or index changes. **Numbering:** the D7S breakdown starts at P90, A195 and decision 103. |
| 102 | **The Review open may make one read per distinct earlier close date that its option Trades' dated lines need, and none per Trade** (plan revision 72, 2026-11-10, at the user's decision, with decision 101). | **Why:** with the option dated line in the Review (decision 101), the Review open reads the earlier closes those lines need, as the Open page already does under decision 97. **The decision:** decision 97's rule applies to the Review open: one `observations` read per distinct earlier close date, carrying every Instrument needed at that date, and none per Trade. A new proof, `tests/integration/d7sp/review-query-count.test.ts`, pins it; the existing Review proofs are unchanged, because none of their Trades has an option dated line. **Affected:** the D7S prefactor's T7SP.8. **Durable compatibility:** none. |
| 103 | **T7SP.7: an expired contract's Trade Detail reads no frame, and the Trade Views unit cases that stub `query` move to the read session or are trimmed** (plan revision 73, 2026-11-10, at the user's decision, during T7SP.7). | **Why:** T7SP.7's first attempt routed Trade Views through the Mark-to-Market Valuation module; nothing was committed. After expiration the module reads no frame (P80 and P81; T7SP.6's fourth case). So an expired contract's Detail no longer makes the reads for its contract and Underlying frames. Today those are the date-wide `observations.getAll`, plus the Stale Mark lookup's `meta.get` and its two `observations.openCursor`. `tests/integration/d7/query-count.test.ts:97` pins those reads and treats fewer as a defect. Separately, 8 Trade Views unit cases in `option-views.test.ts` and `closed-views.test.ts` stub `marketData.query`, which the read session never calls, so they can't pass unchanged as the breakdown's section 6.1 required. **The decision:** (1) The due Detail's request list in `d7/query-count.test.ts:97` drops exactly the requests its frame reads made. Every other request stays unchanged, and T7SP.7's evidence records the old and new lists. After expiration, or with no Position, the Open page's view no longer carries `markResolution`; no screen shows it there. (2) Each of the 8 stub cases is handled one of two ways. Where a T7SP.6 module case covers its behaviour, the case is removed, bringing that part of T7SP.12 forward, with one wiring case kept per behaviour and the evidence naming the covering case. Otherwise it is rewritten to stub or count at `openReadSession` or at the session's methods, keeping its name and assertion. A rewritten case counts only after it goes red under a mutation of the coordinator: an assertion failure or a runtime exception, never a compile error. The cases that count `derive` calls stay unchanged, because Trade Views takes the state from the valuation instead of deriving a second time. **Affected:** T7SP.7; T7SP.12 trims only what remains. **Durable compatibility:** none. |
| 104 | **T7SP.8: the read session shares a date's snapshot, Daily Review's `query` stub cases move to the session, and the option dated line is computed on the Review card only** (plan revision 74, 2026-11-10, at the user's decision, during T7SP.8). | **Why:** T7SP.8's first attempt stopped with nothing committed, for three reasons. (a) In `tests/integration/d7/query-count.test.ts:87`, a Review open of live option Trades made 4 more `meta.get` than today, because T7SP.5's session opens a read snapshot, costing one `meta.get` each, for every Stale-context lookup and gaps scan, where `recover` and `ResolveFrames` share one (A193). (b) `src/coordinators/daily-review/settlement.test.ts:253` stubs `marketData.query`, which the session's `settlementTime` never calls. (c) The breakdown assumed the Review open's items carry the dated line (section 1.5, P83, P84), but only `getTrade`'s card (`DailyTradeReview.datedLastClose`, `types.ts:281`) has the field, and that card is what `CardFigures` renders. The open carries no figure groups, so dated-line reads in the open would buy nothing visible. **The decision:** (1) The read session's Stale-context lookups and gaps scans share their date's read snapshot, as `recover` does. Every existing query-count proof then keeps its exact request lists, `meta.get` included, with no proof edited. This is fixed in T7SP.8 itself, reproduced first by a failing case. (2) Decision 103's treatment extends to Daily Review: a unit case that stubs `marketData.query` is rewritten to stub or count at the read session, with its name and assertion kept and a mutation check, or trimmed where a T7SP.6 case covers it. (3) The option dated line is computed only for `getTrade`'s card. `open` computes none and makes no dated-line read, and P83 is delivered on the card. P84's proof is retargeted: the Review open adds no request for option Trades' dated lines, and `getTrade` adds at most one `observations` read for its Trade's line. Decision 102's rule ("one read per distinct earlier close date, none per Trade") then holds trivially for the open. **Affected:** T7SP.8's cases and proof (breakdown section 3), section 1.5's "Shapes" note, P83, P84, and decision 102's application. **Durable compatibility:** none. |
| 106 | **The read session scans an Instrument's gaps from the earliest exposure asked, not from coverage start** (plan revision 76, 2026-11-11, at the user's direction, after T7SP.14 stopped on O3). | **Why:** T7SP.14's `bench:run` (`evidence/D07SP/bench.md`, commit `f2b987dc`) measured the Review open about 10x slower than D7's `evidence/D07/bench.md`, in two runs that agreed: Review status went from 210 ms to 2014 ms, and opening the first card from a 154.9 ms median to 1841.3 ms. Saves, the warm switch and the Closed page median were also more than 10% slower. T7SP.5-B1 (`40442940`) made each session scan start at the session policy's coverage start (2024-01-01), so that a later call with an earlier exposure needed no second read. Since T7SP.8, the Review open goes through the session, so every open reads each Instrument's whole stored history, where D7's `recover` read from the earliest exposure. **The decision:** new task T7SP.19, run before T7SP.14's rerun. (1) A scan starts at the earliest exposure asked for that Instrument in the batch that asks for it; calls in one synchronous run share one batch, so the Review open's Trades share one scan per Instrument, as `recover`'s did. (2) A later call that asks from an earlier exposure than a finished scan scans again from that exposure, one more read. (3) A call at or after a scan's exposure reuses it, narrowed to its own exposure. T7SP.5-B1's case changes from one read to two, with each answer still equal to `recover`'s. That is the only existing case that changes. Every query-count proof keeps its exact request lists; a change there stops the task. T7SP.14 then reruns against D7. If a step is still more than 10% slower, the gate stops again for the user. **Affected:** the D7S prefactor's task graph, sections 3, 6.1 and 9, and Progress. **Durable compatibility:** none (no stored, schema or `specs/` change). |
| 105 | **Trade Detail as a finished read joins the D7S prefactor (candidate 2 of the architecture review)** (plan revision 75, 2026-11-10, at the user's direction, during T7SP.12). | **Why:** ADR 0001 says the UI consumes finished reads. `src/ui/screens/TradeDetail.tsx` still sums the Positions' quantities into a held quantity, divides the at-entry risk and reward by 1R, and decides the "Expires" or "Expired" line from the lifecycle, the Settlement Due panel and the Terminal Disposition. The user kept this out of the prefactor at drafting (breakdown section 9, answer 1), then asked for it here, before the latency harness and the gate. **The decision:** three tasks, run after T7SP.13 and before T7SP.14: (1) T7SP.16: `evaluate`'s `AtEntryFigures` gains `riskFromEntryInPlanR` and `rewardFromEntryInPlanR`. (2) T7SP.17: `getTradeDetail`'s Open view gains `heldQuantity`, and option Trades' Planned, Open and Closed views gain `contractExpiration` (`Expires` or `Expired` with the date, or absent), decided as the screen decides today. (3) T7SP.18: `TradeDetail.tsx` reads those fields and stops calculating them. Every change is additive, so no fixture changes and the fixture views stay valid. No text or request list changes, and no spec changes, since `getTradeDetail`'s contract already says it returns finished valuation and risk/reward. Out of scope: `TradeList.tsx`'s own `closedByExpiration` use, and candidates 3 to 5. **Affected:** the D7S prefactor's task graph, sections 3 and 4, Progress, and section 9. **Durable compatibility:** none. |
| 107 | **D7S's breakdown: at most one Stop and one Target of each kind, and a headline returned only when the readable conditions settle it** (plan revision 78, 2026-11-11, at the user's decision, with the breakdown's P90–P93 and the approved words). | **Why:** decision 89 lifts A100's "exactly one" but sets no limit, and the glossary's "nearest monetary boundary, zero when any condition is crossed" says nothing about a condition whose Mark is missing. An option Trade's Underlying conditions need the Underlying's Mark, and its option-price conditions only the contract's. **The decision:** (1) P90: an option Plan holds one or two Stops and one or two Targets, at most one of each kind (Underlying price, option price); a repeated kind is `ConditionKindRepeated`, which replaces `ConditionCountNotOne` for every Plan; an option-price condition on a stock Plan is `ConditionKindNotApplicable`. (2) P91: Ongoing Risk to Stop and Incremental Reward to Target are the minimum of their conditions' distances, returned when every condition is a Value or some readable one is already zero; otherwise the first Unavailable condition's result in Plan order. (3) P92: the option Plan form has two fixed price fields per role. (4) P93: every open option Trade still needs both Marks (A110 unchanged). (5) One breakdown with a checkpoint critic, not a split (the size check). (6) The breakdown's words W1–W10 are approved, W4 in the user's words. **Rejected:** any number of conditions per kind; the minimum over readable conditions only; Unavailable whenever any condition is; a kind selector with add and remove rows; splitting D7S in two. **Affected:** the D7S definition; D7's A100 and its approved-words rows 19.9, 19.10, 19.23 and 23.17 (amendment notes there); the D8 breakdown, which follows schema 7 when D8 starts (a note there; applied in revision 102); the D4 breakdown's open question 3 for later breakdowns, resolved for single legs. **Durable compatibility:** schema 7 admits the `StructureValue` condition kind; the `v6→v7` transform changes no record. |
| 108 | **D7S runs T7S.3 straight after T7S.1, and T7S.2 after T7S.3** (plan revision 80, 2026-11-11, at the user's decision, during T7S.1). | **Why:** T7S.2's row expects "the option phase's 600 option Plans hold option-price conditions in A203's mix", but `tools/capacity/measure-page.ts` confirms its Plans through the production facade, which accepts an option-price (`StructureValue`) condition only once T7S.3 adds it to `ConditionInput` and `assessPlan`. The run order put T7S.2 straight after T7S.1, before T7S.3, so the row couldn't be met as written. **The decision:** the run order becomes T7S.1, T7S.3, T7S.2, T7S.4, … (the rest unchanged); T7S.2 is blocked by T7S.1 and T7S.3. Between T7S.1's commit and T7S.2's, `verify:capacity` failing at schema 7 is expected and recorded, not fixed, so T7S.3's checks carry that one known failure. T7S.2 then measures A203's mix exactly as written. **Rejected:** measuring twice (now with D7's mix, again after T7S.3), which adds a task; measuring once without the option-price mix, which drops part of T7S.2's expected result. **Affected:** the D7S breakdown's section 1.5 (shapes), section 3 (T7S.2's blockers and the run order), section 5 (T7S.2's notes) and Progress order; the D7S handoff's section 3. No acceptance scenario changes status. `specs/` is unchanged. **Durable compatibility:** none. **Numbering:** the next decision is 109. |
| 109 | **At entry, each role is measured to its nearest condition not yet crossed at the fill (BUG-3, amends D7S's A197)** (plan revision 82, 2026-11-12, at the user's decision, after the D7S tag). | **Why:** the user found Trade Detail's "Risk from entry" and "Actual initial risk" reading $0.00 on a Long Call NVDA 150 filled at 7.35, with Stops at NVDA 140 and at an option price of 7.50 (`plan/bug-tasks.md`, BUG-3). A197 measures the at-entry line and Entry Quality to the Plan Baseline's headline condition, the one nearest the intended entry (here the 7.50 option Stop), and says the same condition is nearest at any entry price. That holds only while the fill is short of every condition: a fill already beyond the headline gives a negative distance, clamped to zero, though the NVDA 140 Stop is still live and the whole $735 premium is at risk. Before D7S a role had one condition, so "entry at or beyond the Stop" meant no Stop was left. **The decision:** for the at-entry line (`evaluate`'s `atEntryOf`) and Entry Quality (`derive`), each role is measured, per lot, to the nearest of its Plan Baseline conditions whose measurement lies beyond that lot's fill on the role's side (an Underlying condition by its value at expiration, as `measurementOf` does). Only when every condition of a role is crossed at the fill does the figure fall back to zero and "Not applicable: entry at or beyond the Stop" (or Target), as today. The Plan Baseline, 1R, Original Planned Reward, the current headline (P91) and the Review's pressure and range position (A197, T7S.6) are unchanged: the Review compares the at-entry figure with the current headline's distance, so it keeps A197's single headline condition, and its `NonPositiveAtEntry` result already covers a fill beyond that condition. **Rejected:** keeping A197 and labelling the case "Stop crossed at entry", which would still hide the live Stop's risk. **Affected:** D7S's A197 and status line (amendment notes); `plan/bug-tasks.md` BUG-3. No acceptance scenario changes status: AC-CALC-003's D7S row ("the headline uses the nearest monetary boundary and is zero when any is crossed") concerns the current headline, which is unchanged. `specs/` is unchanged. **Durable compatibility:** none; at-entry figures are derived on every read. No fixture's expected view is expected to change, since the fix differs from A197 only for a fill beyond the headline condition; a changed one stops the work for the user's decision. **Numbering:** the next decision is 110. |
| 110 | **D08P's breakdown: the Trade Detail cockpit, with a slice of D9's read model** (plan revision 84, 2026-11-12, at the user's decision, with the breakdown's P94–P102 and the approved words). | **Why:** the user chose the "C. Cockpit" layout of `prototypes/trade-detail/index.html` for Trade Detail, and asked for it to be built before any more functionality, as quickly as possible, by several agents at once. The user expected no backend change. Four of its parts need each earlier session's Marks and Trade P&L, which no current read gives: the P&L card's change, the Today drawer's comparison, Price History and the Journal's session cards. The "nearest" badge, the days to expiration and tech debt item 23's fix also need small backend changes. **The decision:** (1) D08P runs after D7S and before D8, as the D8 prefactor. Its breakdown is [D08P-trade-detail-cockpit.md](D08P-trade-detail-cockpit.md): 26 tasks in three waves with lanes, run under decision 111. (2) P94: a slice of D9's read model is built inside D08P: Market Data's `ReadSeries`, a cut-down `TradeAnalysis.replay` and Trade Views' `replayTrade`. D9 later extends the same three operations. (3) P95: `replayTrade` is its own read, as the spec names it. It takes the Detail's binding, and answers `ChangedDuringAssembly` when the Workspace has moved since. (4) P96: moved content keeps its approved words. (5) P98: one port, behind a lock. (6) P99: Price History is unpaged, newest on the left, and includes the latest session. (7) P100: "Today's Action is not recorded" becomes a follow-on. (8) P101: one breakdown with a checkpoint critic. (9) P102: "latest close" and the dated heading say "Mark", on Detail and on the Review card. (10) The words W1–W20 are approved. W1's "Plan and entry" is renamed "Plan and Risk", in the user's words. **Rejected:** a `history` field on `getTradeDetail`; history of Marks only; leaving history to D9; splitting D9 before D8, or running all of D9 first; splitting D08P at the history seam. **Affected:** the deliverable summary and a new D08P definition section; the D9 definition (a note); tech debt items 21 and 23 (notes); the acceptance matrix's AC-MARK-004 row (a D08P entry); the prototype's C. Cockpit tab. The D8 breakdown is unchanged. There is no retag (the breakdown's A218). `specs/` is unchanged. **Durable compatibility:** none. No schema, store, seed or fixture changes, and the new view fields are additive. **Numbering:** the next decision is 111. |
| 111 | **A swarm deliverable runs its tasks in waves of parallel lanes** (plan revision 84, 2026-11-12, at the user's decision, with D08P's breakdown). | **Why:** decision 100 runs tasks one at a time, and every task ends with a complete cumulative run of about 12 minutes, so D08P's 26 tasks would take about 24 hours. The user asked for the most parallelism possible. **The decision:** for a breakdown whose Progress section has Wave and Lane columns: (1) Tasks run wave by wave. Within a wave, every lane runs at once, up to the breakdown's agent cap (six for D08P). Each lane runs its tasks one at a time, in its own order, and a task starts when everything it is blocked by is merged. (2) Each lane task runs in a fresh `tdd-task`, in its own git worktree under `.claude/worktrees/<dnn>-<lane>` on the branch `<dnn>/<lane>`, and edits only the files its lane owns. (3) A lane task ends with its lane tier (unit, integration and checks) recorded. It gets its `ocr-review` as today, and once both are clean it is merged by rebase and fast-forward. (4) The complete cumulative run, with the browser tier `browser-auto` picks, runs once per merge batch on the deliverable branch. The full tier still runs before every critic. (5) Every browser run takes a lock on the port. (6) `tdd.sh` writes one log file per task. Unchanged: red then green per case, the first-run mutation check, ocr per commit, fresh critics, and the isolation from other implementations. **Rejected:** a second port (the user may assign one later); a full cumulative run after every lane task. **Affected:** decision 100 (a note); `.claude/docs/implementing.md`, `.claude/agents/tdd-task.md`, `.claude/agents/suite-runner.md`, `.claude/scripts/tdd.sh`, `full-suite.sh` and `run-complete.sh`, and the ESLint ignores. D08P's T8P.1 applies all of these with the tooling (the breakdown's section 9 holds the text). Also the full-run rule in the assistant's memory. `specs/` is unchanged. **Durable compatibility:** none. **Numbering:** the next decision is 112. |
| 112 | **B6.6 is deleted, the checked-out build is `current`, and every schema needs a fixture** (plan revision 101, 2026-11-14, at the user's decision after the D08P retrospective, finding 8). Decision 76 stands. | **Why:** B6.6 always fails, because `dist-releases/d6` holds the checked-out code labelled "d6", not D6. Its `@release-history` tag kept it out of every run, so it failed unnoticed from D7 to D08P. Every schema step is already covered without a browser upgrade test. Each schema change froze a fixture written by that release's own code, and its integration tests migrate every earlier fixture to the new schema and compare the views with each snapshot (I7S.1 for schema 7, including D7's option Trades in the v6 fixture). `verify:fixtures` repeats that in every complete run. In Chromium, B2.4 and B2.6 migrate a D1 build through every step in every full tier. No schema up to 7 will be released for real use, so an upgrade test between two of them guards no real path. **The decision:** (1) B6.6 (`e2e/d6/update.spec.ts`) is deleted. (2) The checked-out build is renamed from `dist-releases/d6` to `dist-releases/current`, named for where it comes from, so no deliverable renames it again. (3) `verify:fixtures` fails unless a `workspace-v<n>` fixture exists for every schema from 1 to `SCHEMA_VERSION`, so a schema change can't skip freezing its fixture. (4) The work is [BUG-4](bug-tasks.md#bug-4-b66-always-fails-and-the-checked-out-build-is-misnamed-d6), tasks BUG-4.1 and BUG-4.2, before D8, with no browser critic. **Rejected:** start builds for D6 and D7 from their tags with browser upgrades to the checked-out code (the main session's first draft): the fixtures already migrate the same data, field by field. Keeping B6.6 and pointing it at the checked-out code: about a minute per full tier for Chromium coverage over schema-4 stock data only. Marking B6.6 `test.fixme`. **Unchanged:** B2.3, B2.5, B4.7 and B5.6 stay tagged `@release-history`; browser upgrade tests start at the first release for real use (tech debt item 10). **Affected:** `e2e/d6/update.spec.ts` (deleted), `tools/build-releases.ts`, `tools/verify-releases.ts`, `tools/verify-fixtures.ts`, `e2e/d4/support.ts` and comments in the D5 to D7 support files, the D6 breakdown's B6.6 and AC-DEL-003 rows, the acceptance matrix's AC-DEL-003 row, tech debt item 10 and `plan/bug-tasks.md`. AC-DEL-003's D6 row keeps `covered`, from B6.6's pass at the D6 gate. `specs/` is unchanged. **Durable compatibility:** none: no store, index, schema, fixture or backup change. **Numbering:** the next decision is 113. |
| 113 | **A deliverable's session holds a lock, prints its run order first, keeps working while a decision is pending, and reports fix rounds, flakes and pending decisions** (plan revision 102, 2026-11-14, at the user's decision, from the coordinator prompt the user drafted for D8). Stop and ask stays in force. | **Why:** during D5R a second session worked in the same worktree and took over T5R.5, and an evidence commit swept in the other session's files. In a swarm, stopping everything for one question idles every lane, though most of them don't depend on the answer. **The decision:** (1) **Session lock.** At its start, a session implementing a deliverable checks for `.claude/session.lock`. If it exists, the session stops and asks the user, and starts nothing. Otherwise it writes the file (its start time and the deliverable), and removes it when the session ends, after the final report or a full stop. Git ignores the file. (2) **Run order first.** Before the first task, the session prints the Progress table's tasks with their waves, lanes and blocking tasks. (3) **Pending decisions.** The session never decides a question the specs or the plan leave to the user. When one arises, it asks at once in an ordinary message, not a question dialog that blocks the session, and records it in `evidence/D<nn>/DECISIONS-PENDING.md` with its options and a recommendation. It pauses that task, every task blocked by it, and the later tasks in its lane, and keeps working on everything else that is unblocked. When nothing unblocked remains, it stops and waits. On the user's answer, it records the decision (with a plan revision when the plan changes), marks the entry answered, and resumes the paused tasks. A subagent that hits such a question still stops and reports it, and the session then handles it this way. **Amended by decision 115 (revision 104, D8 retro finding 3, the user's choice on 2026-11-15):** questions are asked one at a time. A question is asked only when no earlier one is waiting for its answer; any other is queued in `DECISIONS-PENDING.md` and asked, in its own message, after the answer before it, as `.claude/docs/implementing.md` "Pending decisions" says. (4) **Final report.** It adds each task's fix rounds (ocr bug-task rounds and suite-failure fixes), every flaky test seen with the run it flaked in, and every decision still pending. **Rejected:** a `SessionStart` hook that writes the lock: it would fire in the user's planning sessions too, and a `Stop` hook removing it fires at the end of every turn, not of the session. Deciding in the session and recording the choice for later review: the plan's questions stay the user's. Stopping all work at each question, as before: it idles every lane. **Affected:** `.claude/docs/implementing.md` (the stop-and-ask line in "After each task", and new paragraphs for the lock, the run order, pending decisions and the final report); `.gitignore`; the D8 breakdown's section 10; D8's handoff. It applies to every deliverable from D8. **Durable compatibility:** none. **Numbering:** the next decision is 114. |
| 114 | **Restore reads schemas 3 through 7, and the restored-capacity checks gain a growth baseline and command names that say what they write** (plan revision 103, 2026-11-15, at the user's answers to D8's Q14 and Q29). It amends decisions 35 and 39. | **Why (Q14).** T8.6's strict parser requires `workspace.sessionPolicy`, which schemas 1 and 2 lack, and "there is no one that ever used them" (the user). **Why (Q29).** Two problems with T8.19's capacity checks: its projection for the dataset's counts is a safe upper bound (206.5 MB measured against 782.0 MB), so the 10% limit catches only gross growth; and bare `measure:capacity` rewrote the app's capacity figures, so forgetting `--restored` would overwrite them. **The decision:** (1) Restore accepts schemas 3 through 7 in format 1 (A145); the backup fixtures are `backup-v3-blocked/` through `backup-v6-blocked/` plus `backup-v7/` (A147). The blocked-database export of a schema 1 or 2 database is unchanged. (2) T8.19's projection formula stays: the dataset's record counts priced at D7's measured Chromium bytes per kind. (3) A growth guard is added. The restored usage of 206,540,122 bytes from T8.19's run is committed as a baseline (`bench/capacity-baseline.json`), and a later run fails if its restored usage is more than 50% above it. (4) The command names decide what is written, and no option does. `measure:capacity` measures the restored benchmark and writes no stored figure. `measure:capacity:reset-basis` rewrites only D7's capacity figures (`src/delivery/capacity-basis.json`), so a schema change re-measures M (decision 18) without moving the growth baseline. `measure:capacity:reset-baseline` rewrites only the baseline, and runs only when the user says so. `verify:capacity` checks D7's figures only; `bench:verify-capacity` checks those plus all three restored limits (10% of the projection, peak below 3 × M, 50% of the baseline). The `--restored` option is removed. (5) The restored check is named `bench:verify-capacity`, not `verify:capacity:restored`, at the user's choice. The complete run's checks stage runs every `verify:` script, and this check needs the git-ignored benchmark files and runs alone (A227). Its name keeps it out of that stage with no tooling change. (6) The work is T8.19-F1 in the D8 breakdown, section 1.6. It runs after D8's gate, alone in the main worktree, with no browser critic. The `claude-opus-5.5-d8` tag stays where it is. (7) **From D9 on, the benchmark runs once per deliverable, at the end** ("Rules every deliverable follows"). It runs after the gate closes, when no development work remains, and before the deliverable's tag. A breakdown has no benchmark task of its own. Changes to the generator, or a schema change's `measure:capacity:reset-basis`, are ordinary tasks before the gate. (8) **A failed benchmark starts no fix.** The session stops, reports the failing command, figures and limits to the user, and waits. The user decides between a fix now, as bug tasks followed by one more benchmark run, and a tech debt item; only then is the deliverable tagged. **Rejected:** (benchmark) a benchmark task inside each breakdown, as in D2 to D8: it ran mid-deliverable, and each breakdown had to remember the capacity checks. Fixing a failed benchmark at once, without asking. `measure:capacity:reset-baseline` also rewriting D7's figures (Q29's first wording): every schema change would then move the baseline. (Q14) keeping schemas 1 and 2, which needs a parse before the transforms for data nobody holds. (Q29) tightening the projection instead, for example D7's mature-profile measurement scaled to the counts. A `--restored` flag, which T8.19 built. Keeping the restored checks inside `verify:capacity` whenever the cache exists, which makes the same check pass or fail by worktree. **Affected:** the D8 breakdown (P35, A145, A147, the T8.17 and T8.19 rows, section 1.6, the Progress table); `package.json`; `tools/measure-capacity.ts`, `verify-capacity.ts` and `tools/bench/`; "Rules every deliverable follows", the AC-PERF-001 row of the cumulative obligations and the note on decision 18; `.claude/docs/implementing.md` ("Benchmark"). `specs/` is unchanged. **Durable compatibility:** none for the Workspace. A schema 1 or 2 backup lies outside the manifest's Restore range and is rejected by preparation, as T8.8 found; no such backup exists. **Numbering:** the next decision is 115. |
| 115 | **D8R's breakdown: the Trade Detail refactor, from the Trade Detail audit** (plan revision 104, 2026-11-17, at the user's decision, with the breakdown's P108–P116, its six answered questions and the approved words). | **Why:** after D08P, the user asked for an audit of Trade Detail (`research/trade-detail-audit.html`, 2026-11-14). It found leftovers of the pre-cockpit page, figures shown twice, misplaced parts (Deviations under every drawer, dollars in the rail), no Today view on Settlement Due and Closed Trades, and Position rows that don't name their contract. The user put the whole audit in scope, as one deliverable run as a swarm. **The decision:** (1) D8R runs after D8 and before D9, and D9 doesn't start until D8R is done. Its breakdown is [D08R-trade-detail-refactor.md](D08R-trade-detail-refactor.md): 28 tasks in three waves and eleven lanes, an agent cap of six, run under decision 111 (P108), with a checkpoint critic and one breakdown (P115). (2) P110: Market Data's read session names the session before its trading date and a current context's as-of exchange date, and Trade Views gives Today's column dates; after Thursday's close, Today is Thursday. (3) P111: the `nearest` flag is removed, and its 90 `"nearest": true` lines are deleted from the five backup fixtures' expected views; the backup data is unchanged. (4) P112: Trade Detail's Journal leaves out a Trade Anchor. (5) P113: `AwaitingClose` names the session that brings the Marks, worded "Awaiting the Mon Oct 12 close" (W34). The user's rule: a price is a Mark, never a "close"; the end of a session is "the close". (6) P114: a contract name has no year when it expires in the current year ("XYZ Dec 18 $55 Call") and the full year otherwise ("XYZ Jan 15 2027 $55 Call"); screen readers read exactly what is shown; the Trade Summary line follows the same rule. (7) The words in the audit's sections 15 and 19 are approved, with W28 amended by (6) and W34 by (5). (8) Decision 113 (3) is amended: pending questions are asked one at a time and the others queued. **Rejected:** the replay's `pending.date` for Today's column (wrong after the close); keeping `nearest` unread; keeping the Anchor on every line; "Due once the Mon Oct 12 session ends"; a hidden spoken year; the audit's "'27" form; splitting D8R at the backend seam. **Affected:** the deliverable summary and a new D8R definition section; `specs/design/market-data.md`'s read-session paragraph and `specs/design/ui-contract.md`'s Journal-timeline paragraph, with the spec map's S124 and S211 counts and the regenerated reading lists; D08P's A206, A207, A217, A223, W1, W3–W6, W8, W10, W16, W18, W19, C8P.2 and tasks T8P.5, T8P.6, T8P.13, T8P.14, T8P.15, T8P.16, T8P.17, T8P.18, T8P.29 and T8P.31 (reversed or amended for D8R, section 1.2 of its breakdown); the D7 approved words' C2, C5 and C6; decision 113; tech debt item 24 (a note: T8R.16 fixes it). The acceptance matrix is unchanged: D8R re-proves AC-CALC-003, AC-MARK-003, AC-MARK-004, AC-PERF-001, AC-UI-001 and AC-UI-002 and makes no new claim. There is no spec-map retag (A244). **Durable compatibility:** no schema, store, seed, migration or backup-version change. New view fields are additive. The one fixture change is (3). **Numbering:** the next decision is 116. |
| 116 | **D8R's run rules, answered before the run** (plan revision 105, 2026-11-17, the user's answers, all as recommended). | **Why:** the user answered in advance the questions D8R's implementing session would otherwise stop for. **The decision:** (1) **P117:** a contract name shows the full year for any year other than the current one, an earlier year included ("XYZ Dec 19 2025 $55 Call"); T8R.3 gains one case for the name and one for the Trade Summary line. (2) **New screen text:** when a fix or task needs words no approved row covers, the session uses its best wording, following the approved words and the Mark and close rule, and continues. It lists every such phrase in `evidence/D08R/new-words.md` and in the final report for the user's approval; a rejected phrase becomes a fix after the gate. (3) **The critic limit:** if three critics at one checkpoint leave only moderate or lower defects, the session closes that checkpoint, records each remaining defect as a tech debt item, and lists them in the final report. A remaining high defect, or a FAIL, still stops the run. (4) **Tech debt item 11:** if `TradeList.test.tsx`'s Ready-state case fails a run, the runner reruns it alone once; a pass is logged as a flake and the run continues. Two failures in a row are a pending decision. **Rejected:** stopping for each of these. **Affected:** the D8R breakdown (P117, W28, T8R.3) and its handoff; the D7 approved words' note. **Durable compatibility:** none. **Numbering:** the next decision is 117. |
| 117 | **D9's breakdown: Trade replay as Corridor, with option estimates and the Stop-to-Target meter, in three stages** (plan revision 106, 2026-11-17, at the user's decision, with the breakdown's P118–P138, its ten answered questions and the approved words W35–W52). | **Why:** the spec describes the replay chart only in words. The user was interviewed and reviewed two rounds of prototypes (`research/replay-requirements.md`), chose Corridor, and asked for implied volatility and the meter in D9. **The decision:** (1) D9's breakdown is [D09-trade-replay.md](D09-trade-replay.md): 40 tasks in one deliverable, run as three stages, each with its own session, cumulative suites and fresh critic (P118): **A**, the replay chart, a swarm under decision 111 with an agent cap of 4; **B**, the option estimates, and **C**, the meter, each one task at a time under decision 100 (P119). The benchmark runs once, after stage C. (2) **Replay** is Corridor: the Underlying's price over the Trade P&L as an area between the Trade's result at its Stop and at its Target, with a headline, a slider that reveals sessions, a readout and a table. It is a seventh Trade Detail drawer and a section of the Review card before the Action (P128). `evaluate` gains the Trade's result at each boundary and its standing; `replay` returns each session's figures, condition status, markers and the Plan column (P120). `DailyReview.getTrade` returns the replay to the Review Date through an assembly both coordinators share (P127). (3) **Estimates** (P121, P123): a separate pure module in floating point prices by Black-Scholes; implied volatility, the Share Equivalent and the Mark Change Split are Estimates, kept apart from exact figures by their type and an ESLint rule, and never read by an exact calculation. ADR 0007, the spec index, the glossary, Trade Analysis and the UI contract are amended, and the acceptance contract gains AC-CALC-005. (4) **The rate** (P122): 4% up to 365 days to expiration and 5.25% beyond, constants in code, stated on the About page only and never beside an estimate. (5) **The meter** (P130, P132, P133): one component on Review cards, Open-list rows and the top of Trade Detail's Conditions card; it replaces `StopTargetSlider`, and `rangePosition` is removed with its 84 entries in eight frozen fixtures' expected views (the backup data is unchanged). The mark for the session before is built everywhere, and the benchmark decides whether it stays on the list. (6) **The Open list's default order is the Review's attention order** (P131), built as one sort step after the page is valued, so that sorting and filtering can be added later; Trade Record's query is unchanged. (7) **P137:** a task that puts words on screen may shorten them (fewer words, a dropped chart label, part of a sentence moved to the readout), may not lengthen them, change or remove a figure, or change what a planned case tests, and records each change with its before and after in `evidence/D09/words-changed.md`. (8) P124 keeps the app's valuation of the expiration session; P126 leaves a moved Stop's marker to D17; P134 leaves out Deviation markers, spreads and Daily Bar candles; P136 adds a third browser stage. (9) **Run rules (P138; the user, 2026-11-17, after agreeing the breakdown):** decision 116 (3) and (4) are carried to every stage of D9. If three critics at one gate leave only moderate or lower defects, the gate closes and each becomes a tech debt item; a high defect or a FAIL still stops the run. A known flaky case (tech debt item 11's, and the `PositionChangeForm` focus case D8R reported) that fails a run is rerun alone once; a pass is logged as a flake, and two failures in a row are a pending decision. **Rejected:** one run of 40 tasks; a swarm in every stage; a rate the trader sets; estimates as exact Calculation Results; the rate shown beside each estimate; keeping `rangePosition` unread; Last Activity as the Open list's order; a payoff line in replay. **Affected:** the deliverable summary and the D9 definition; the Parallelism note on D9; `specs/adr/0007`, `specs/README.md`, `specs/glossary.md`, `specs/design/trade-analysis.md`, `specs/design/ui-contract.md`, `specs/design/trade-views-and-reporting.md` and `specs/acceptance/acceptance-contract.md` (AC-CALC-005), with the spec map's 260 entries rechecked, D9 retagged and the reading lists regenerated; the acceptance matrix (68 rows: AC-MARK-004's D9 entry and AC-CALC-005) and the coverage index; D5R's P39 (the slider and range position, replaced), D08P's W1 and A211, and D8R's W1 (notes in each breakdown). **Durable compatibility:** no schema, store, seed, migration or backup-version change. New view fields are additive. The one fixture change is the removal of `rangePosition` in (5). **Numbering:** the next decision is 118. |
| 118 | **D9A-R, the D9 stage A refactor: the replay as an overlay, with the Plan beside what happened, the estimated odds and session cards** (plan revision 107, 2026-11-18, at the user's decision, with the breakdown's P139–P153, its five answered questions and the approved words W53–W70). | **Why:** the coach review of the built replay (`evidence/D09/coach-review-1.md`) scored it 6 of 10 with 15 suggestions, and the user decided all of them in `plan/D09A-R-decisions.md`. **The decision:** (1) D9A-R's breakdown is [D09A-R-stage-a-refactor.md](D09A-R-stage-a-refactor.md): 24 tasks in one deliverable, run after D9's stage A gate and before its stage B, in lanes under decision 111 with an agent cap of 4, with its own critic and a light gate with no benchmark (P139, P140, A285). (2) **The overlay:** Replay opens over the whole page from a button beside Trade Detail's drawers and from a "Replay" button on the Review card, whose inline replay goes; the address carries `replay=open`, so Back, Close and Escape close it; the drawers are D8R's six again (P143, P144). (3) **The figures:** `evaluate` gains the No-Edge Odds from here and the Plan's own, and whether the structural extremes are the Trade's main risk; `replay` gains the Plan's terms, each fill against the Plan and each condition's first crossing (P142). The readout's stake is a grid; reward to risk is shown with the estimated odds; session cards, paged as the Journal is and synced with the slider, replace the table; one name per figure across the replay and the Review card's summary. (4) **The answers:** (a) the spec text of section 1.2 as written, with the glossary term "No-Edge Odds" (P147); (a) no bridge across a session with no Mark: its column is shaded and labelled "No Mark" (P146); (a) cards exist only up to the slider's session (P145); W53–W70 approved, W55's third heading "P&L if hit" (P149); (b) the shell's warnings and banners stay in place under the overlay, unchanged and never dismissed (P153). (5) P151 carries D9's run rules (P138) to D9A-R, and D9's wording rule P137 is carried over. **Rejected:** a split at the overlay; a dashed bridge across a missing Mark; every session's card always present; the warnings above the overlay. **Affected:** the deliverable summary and a D9A-R definition; `specs/glossary.md` (No-Edge Odds and six compact labels), `specs/design/trade-analysis.md` (`evaluate` and `replay`), `specs/design/trade-views-and-reporting.md` (the invariants) and `specs/design/ui-contract.md` (a note on a read-only overlay), with the spec map's line ranges and character counts recalculated and the reading lists regenerated, no tag added (A284); the acceptance matrix (D9A-R's cumulative entries; no new scenario); D9's breakdown (stage A's wording, stage B's and stage C's tasks, per D9A-R's section 10); D08P's and D8R's W1 notes. `.claude/scripts/status.sh` changes in task T9AR.1. **Durable compatibility:** no schema, store, seed, migration, fixture or backup-version change. New view fields are additive; the replay's unread `riskChange` and `rewardChange` are removed (T9AR.21), and no fixture holds them. **Numbering:** the next decision is 119. |
| 119 | **D9 stage B's browser stages: one duplicate case removed, AC-DEL-001's D9 command repointed, and a fourth browser stage** (plan revision 108, 2026-11-19, the user's answer to stage B's question SB-Q2, option (c)). | **Why:** `browser-3` took 8.2 and 8.7 minutes at D9A-R's gate, over the 8-minute limit, and stage B adds two specs to it. The user asked first to remove any duplication between `e2e/d9` and `e2e/d9ar`, then chose both. **The decision:** (1) **T9.20-D1** compares each `e2e/d9` case with `e2e/d9ar` by code and deletes only a true duplicate (every assertion made by an `e2e/d9ar` case for the same Trade and situation); it deleted one, B9.5's offline cold restart, which `e2e/d9ar/responsive-a11y.spec.ts` makes with one more check, and renamed stale "drawer" and "table" words. (2) **AC-DEL-001's D9 command** in D9's section 13 becomes `npx playwright test e2e/d9ar/responsive-a11y.spec.ts`, and B9.5's row notes that its offline reload is B9AR.7's. (3) **T9.20-D2** adds a `browser-4` stage for `e2e/d9` and `e2e/d9ar`, as T9.1 added `browser-3` (P136). **Rejected:** accepting a stage near the Bash tool's 10-minute limit; a different split. **Affected:** D9's breakdown (sections 7.2 and 13, and its Progress rows T9.20-D1 and T9.20-D2). **Durable compatibility:** none touched; test and tooling only. **Numbering:** the next decision is 120. |
| 120 | **"Realized" names what was realized, for a gain as for a loss** (plan revision 109, 2026-11-20, the user's answer in the D9 word review, item A9). | **Why:** one idea, the P&L locked in by sales, had two screen words chosen by its sign ("Banked +$478", "Realized −$495"); the sign already says gain or loss, and "Realized" is the trading term. **The decision:** every screen text that said "Banked" says "Realized": D9's W40 chart label, W43's readout row, W51's meter text (stage C), D9A-R's W57, W65's card row and W69's phone strip. The chart's key, which must name two colours, reads "Realized gain" and "Realized loss" (W44, W66). T9.29's added case becomes "Realized" for a loss as for a gain. Code names (`banked`, A260) do not change. **T9.28-D1** carries it out in the built app (stage A's and D9A-R's screens and their cases). **Rejected:** keeping "Banked" for a gain (D9A-R's W57). **Affected:** D9's breakdown (W40, W43, W44, W51, T9.29's case, Progress), D9A-R's breakdown (W57, W65, W66, W69). **Durable compatibility:** none touched; screen words only. **Numbering:** the next decision is 121. |
| 121 | **The chart's key names what was realized "Realized" too** (plan revision 110, 2026-11-20, the user's answer when T9.28-D1 found "Realized gain" wrapped the key at 1280). | **Why:** decision 120 named the key's two entries "Realized gain" and "Realized loss"; the longer gain entry made W66's one-line key wrap on R-BREN-U's busiest session at 1280. The key has no number, so its swatch's colour (green for a gain, red for a loss) does what the sign does elsewhere. **The decision:** the key's entry is "Realized", with its swatch in the colour drawn; a Trade that has drawn both colours so far lists "Realized" once per swatch. Amends decision 120's key wording (W44, W66). **Rejected:** tighter key spacing; a two-line key; "Realized" and "Realized loss". **Affected:** D9's W44, D9A-R's W66. **Durable compatibility:** none touched. **Numbering:** the next decision is 122. |
| 122 | **The process scales to the risk, and word-only decisions need no plan revision** (plan revision 111, 2026-11-20, the user's decision after the D9 stage B retro, "we are slogging through molasses"). | **Why:** every task paid the same cost, a full ocr round and a complete cumulative run whose browser tier took about 20 minutes whenever a screen changed, so a word change cost as much as a calculation change; and a wording answer (decisions 120 and 121) took a decision, a plan revision and a tag. **The decision:** (1) **Each task has a level**, set in its deliverable's handoff (from D10, in its breakdown's task graph): **Full** for calculations, saving, data, fixtures, backup, persistence, delivery and the service worker; **Standard** for screens and components that show values worked out elsewhere; **Light** for wording, styles-only, tests-only and tools changes. The main session raises a task's level when its commits touch a higher level's paths, and never lowers it. (2) **Full:** unchanged (ocr, then the complete cumulative run with `browser-auto <base>`). **Standard:** ocr, then unit, integration, checks and the `browser-task` tier; the task's own subagent also runs every `e2e/` spec file it edits, under the browser lock, and reports it; the four-stage full tier waits for the stage's browser-suite task and the critic. **Light:** no ocr and no suite run; the subagent runs the affected tests, and the pre-commit hook runs typecheck and lint; the next run covers the rest. (3) The full tier before every critic, and the critic gate itself, are unchanged. (4) **Word-only decisions:** an answer that changes only screen words (approved-word rows and the words a planned case quotes), with no figure, calculation, layout, behaviour, glossary term or `specs/` text changed, gets no decision number, no plan revision and no tag. The main session edits the breakdown's word rows and the quoted words, records the answer with its date and its before and after in the deliverable's `evidence/<Dnn>/word-decisions.md`, and commits it with the message prefix `words(<Dnn>)`; like a Progress edit, that is not a revision. Anything more than words keeps the revision path. **Rejected:** keeping one process for every task; dropping ocr for Standard tasks. **Trade-off accepted:** a Standard task that breaks an older screen's browser case is found at the browser-suite task, not at once. **Affected:** `.claude/docs/implementing.md` (a section on levels; the word-only rule), `.claude/docs/drafting-breakdowns.md` (a level per task), `plan/revisions.md`'s opening, D9's stage C handoff (each task's level). **Durable compatibility:** none touched; process only. **Numbering:** the next decision is 123. |
| 123 | **D9R2, the Review's Marks grid: several sessions' Marks entered and saved at once** (plan revision 112, 2026-11-20, at the user's decision, with the breakdown's P154–P162, its three answered questions and the approved words W71–W81). | **Why:** the Review's Marks panel takes one session at a time, holds a typed Mark on its card, and lists earlier gaps apart from today's; D08P's follow-on (its section 10.2) and the research page `research/review-page-style.html` proposed a Price History-style grid, and the user settled its shape and asked for it first, before the coach review of the Review page and the rest of its restyle. **The decision:** (1) D9R2's breakdown is [D09R2-review-marks-grid.md](D09R2-review-marks-grid.md): 17 tasks, run one at a time (P162), after D9 and before the coach review, with one browser critic and the benchmark after the gate (decision 114). (2) **The grid** (P158–P161): one per Trade, in its card's Marks panel, a row per Instrument and a column per session, newest on the left: the Review Date, the previous session, then each earlier session missing a Mark, 20 a page with the first two fixed; one cell editor under the grid; on a card under 40rem sessions become rows. Price History and the Review render through one shared session grid under `src/ui/cockpit/` (A216). (3) **Drafts belong to the Review** (P156): a price typed in one Trade shows "Unsaved" in every Trade holding the Instrument; a Mark draft no longer holds a card; a Correct in progress and Action, Debt and reflection forms still do; leaving the page is still held. (4) **One Save Marks** (P157; the user, 2026-11-20) sends every draft, across Trades, sessions and Instruments, as one `SaveReviewMarks` command, unchanged; more than 100 drafts are refused before sending. (5) **The data** (P155): the open result's Marks family gains `previousSession` and `earlierMarks`, read from the open's existing read session with no added store request; an Available series point gains `resolutionRevision`. (6) **Three small fixes first** (P154): the Review card's dated heading "At the Fri Oct 9 Marks"; Price History and the Journal show an acknowledged session as "Acknowledged Unavailable", the tab counting Missing sessions only and the line under the table naming both counts (the user's answer to question 3); Price History's gain and loss colours. (7) **The answers:** the research page's mockups sign off the grid, with no clickable prototype first (question 1); W71–W80 approved as proposed (question 2); W81 for the acknowledged count (question 3). **Rejected:** a clickable prototype first; the three fixes as a deliverable of their own; Mark drafts held per card; saving the first 100 drafts and keeping the rest; a Trade P&L row in the Review's grid. **Affected:** the deliverable summary and a D9R2 definition; amendment notes on D4's A57, D5R's A153, A156, A161, T5R.12 and section 6.4, D5R2's A171 and A172, and D08P's A210, A214, A216, W1, W9 and W19; the acceptance matrix (D9R2's cumulative entries; no new scenario); the spec map (D9's tag on S039, S042, S043, S046, S091, S094, S096 and S123, with the reading lists regenerated). Tech debt item 11 stays tech debt. `specs/` is unchanged: the new view fields are additive. **Durable compatibility:** no schema, store, seed, migration, fixture or backup-version change; no frozen view changes. **Numbering:** the next decision is 124. |
| 124 | **D9.5, the Daily Review redesign, defined at the deliverable level** (plan revision 113, 2026-11-22, at the user's approval of the draft, with their 11 decisions of 2026-11-21 in the mockup's notes and their twelve drafting answers of 2026-11-22). | **Why:** the coach's second review of the Review page (`evidence/D09/coach-review-2.md`) scored it 6 of 10 with 15 suggestions. The coach mockup (`prototypes/review-coach-mockup/`) answers them, and the user wants the Review taken to everything it shows. **The decision:** (1) **D9.5** is added after D9R2 and before D10, defined in its own section with nine stories: the day's summary and order of need; one Marks step with a slip check; "Plan" and "Now" with the last decisions; follow-the-Plan rules for Hold and Exit; a sale recorded in the Review against the Plan's exit; expiration and "record later"; the Replay on every card with each Review's Action; the Close Review walk; keyboard and focus, at phone and desktop widths. It has no breakdown yet (decision 40). (2) **Before the breakdown:** a 375-wide phone prototype agreed by the user, which also draws the Review after a "record later"; and the exact text of the spec changes agreed by the user. (3) **The twelve answers:** the Plan check is the sale's reflection, saved complete, with one exit form in the Review and on the Trade page; "follows the Plan" is worked out each time, only reasons are stored, and the rules are enforced on save; "record later" is that day's Daily Trade Review entry, with the state "Complete, settlement to record"; the slip-check limits are fixed (5% for a stock or an Underlying; 100% up or 50% down for an option) and the setting moves to D23; a closing sale always puts the Close Review off, it is written with the walk, and "key lesson" becomes required; phone is in D9.5; what is shared with other pages changes everywhere it is shared, keeping Trade Detail's and the Replay's figure phrases; a Mark saved in the same Review is fixed with the fixed reason "Fixed in the same Review"; the Hold and Exit reason rule is enforced by the Review's save, the form requiring a reason only for Roll and Adjust; the Review may state the Plan's own terms and what is due, never an opinion, a prediction or a pattern across Trades; the Close Reason is still asked at a closing sale, nothing preselected; an expiration saves a completed reflection as a sale does. (4) **Spec changes agreed in principle, not yet made** (rows 1, 2, 6, 7, 8, 9, 11 and 16 of the section's table): Daily Review (`getTrade`, `save`, "Default Action definition", "Settlement Due", "Completion and resumption", the attention bands), the UI contract ("Forms and evidence capture"), the Journal's Daily Trade Review, Position Change Reflection and Close Review definitions, the glossary (Daily Review, Settlement Due), and the scenario texts AC-REV-003, AC-SET-003, AC-REV-006 and AC-JOUR-007. Three new scenarios are proposed: AC-REV-007, AC-REV-008 and AC-SET-005. (5) **Owners:** D10 extends the card and the Plan check to spreads; D11 decides the slip check for fetched Marks; D12 keeps Stop Discipline Deviations and decision 72's open issue; D17 owns Plans that sell in parts; D19 owns correcting earlier Marks; D20 replaces "record later"; D21 adds "Record the roll"; D23 gains the slip-check setting; D26 decides how the three revised forms may be customised. **Rejected:** deferring the sale's reflection; storing the verdict or recording it as a Deviation; a new stored record for "record later", leaving it to D20, or moving D20 forward; a Settings page and a schema change in D9.5; the walk only in the Review; a desktop-only D9.5; restyling Trade Detail; a Market Data spec change for same-Review fixes; a new kind of form condition in the Journal; preselecting or deriving the Close Reason; an automatic Decline for an expiration. **Affected:** the deliverable summary and the D9.5 section; notes on D10, D11, D12, D17, D19, D20, D21, D23 and D26, and on decisions 10 and 72; the serialized `replay` order under "Parallelism"; the acceptance matrix (notes on AC-REV-003, AC-SET-003, AC-REV-006 and AC-JOUR-007; no new row until the scenarios are in the contract). Decisions 49, 61, 64, 117, 118 and 123 are amended when D9.5 is built, as its table says. The spec map's D9.5 tags and reading list come with the breakdown. `specs/` is unchanged by this revision. **Durable compatibility:** none in this revision. D9.5 itself will take the Journal seed manifest to version 6 with no schema change. **Numbering:** the next decision is 125. |
| 125 | **D9.5's spec changes made: the Review follows the Plan, Settle Later, and three new scenarios** (plan revision 114, 2026-11-22, at the user's agreement of the drafted text and their four choices). | **Why:** decision 124 agreed D9.5's spec changes in principle and left their exact text to be agreed before the breakdown. **The decision:** the 21 edits in [D09.5-spec-changes.md](D09.5-spec-changes.md) are made in `specs/`. (1) **Daily Review:** due Debt and settlement may sit with their Trade in the walk; the attention bands become factual or management blocker, an Exit not carried out, settlement due, Stop reached (deepest in R first), Target reached, evidence limited, quantified pressure, routine, re-ordered only by a fresh `open` or a Marks save; a new section "Following the Plan" defines the Plan Exit and the Plan Call (`Out`, `Hold`, `Unknown`), refuses an Action while a needed Mark is Missing, and makes Intent follow the call, enforced at Save; `getTrade` preselects Hold only when the call is `Hold` and may show the Trade Workflow's form in place; Settle Later resolves Settlement Due for one Review Date, with the new state `CompleteWithSettlementToRecord`; a Trade with Settlement Due owes no other Action. (2) **UI contract:** the Hold paragraph of "Forms and evidence capture" follows the Plan Call. (3) **Journal:** Position Change Reflection gains "Why did you leave the Plan?" and "Why did it expire worthless?", and every prompt is optional; Close Review's "What is the key lesson?" is required; Daily Trade Review gains the protected Settle Later and its Intent prompt is renamed "Why?", required by the form only for Roll and Adjust. (4) **Trade Workflows:** a sale is measured against the Plan Exit; a sale and an Expiration submit Complete for the reflection and Defer for a terminal Close Review; the Plan Departure Reason and the Expiration Reason are required where the paragraph says. (5) **Glossary:** Plan Exit, Plan Call and Settle Later are added; no entry changes (decision 69). (6) **Acceptance:** AC-REV-002, AC-REV-003, AC-REV-006 and AC-SET-003 change; AC-REV-007, AC-REV-008 and AC-SET-005 are added, full in D9.5, making 71 scenarios. **The four choices** (the user, 2026-11-22, each as recommended): the reflection's three existing prompts become optional, behind "Add more" on a sale and still shown on a buy; one short prompt per form with the situation on a line above; glossary entries are added and none changed; Debt and settlement appear with their Trade, so an Exit not carried out ranks ahead of an expired contract. **Applied as drafted, not separately answered:** with a Mark acknowledged Unavailable the Plan Call is `Unknown`, nothing is preselected, a Hold needs no reason and an Exit needs one. **Corrects decision 124:** AC-JOUR-007's text does not change; the glossary's Daily Review and Settlement Due entries do not change; Trade Workflows' contract gains a paragraph; AC-REV-002 changes. **Rejected:** retiring the three prompts or keeping them required on a sale; a prompt per situation, or a screen label that differs from the form's; lifting the glossary rule; putting expired contracts first to keep the spec's order. **Affected:** six spec files; the spec map (four new entries, S261, S262, S263 and S264, 264 in all, every range and count rechecked by script) and all 28 reading lists; the acceptance matrix (three rows, notes on five) and the coverage index; D9.5's section. The code still follows the earlier text until D9.5 is built. **Durable compatibility:** none in this revision. **Numbering:** the next decision is 126. |
| 126 | **D9.5's breakdown agreed, with "Say why later": a reason never stops a sale being recorded** (plan revision 115, 2026-11-22, at the user's agreement of the breakdown, their nine answers, the spec text and the words W82 through W155). | **Why:** decision 124 defined D9.5 without a breakdown, and decision 125 made its spec changes. The breakdown raised nine questions; the user took eight recommendations and answered the ninth themselves: a reason or reflection must never keep the trader from recording an exit and getting back to work, mid-session above all. **The decision:** (1) D9.5's breakdown is [D09.5-daily-review-redesign.md](D09.5-daily-review-redesign.md): 67 tasks in three parts, each ending in a gate (P164): Part A, the page (stories 1, 2 and 3; T95.26 is a light gate); Part B, following the Plan (stories 4 and 5 and Journal seed manifest 6; T95.46 is a light gate); Part C, endings and the Replay (stories 6, 7 and 8 and story 9's closing proof; T95.67 is the final gate, with the benchmark). Tasks run one at a time. Its decisions P163 through P174, assumptions A300 through A327 and the user's points U1 through U21 are in its section 1. (2) **Names** (P163): tasks are `T95.n`, with evidence under `evidence/D95/`, browser tests under `e2e/d95/` and integration tests under `tests/integration/d95/`, because the scripts read `T9.5.1` as a D9 task. (3) **"Say why later"** (U14; question 2): a sale that leaves the Plan Exit saves at once, with its Plan Departure Reason given in a completed reflection or put off. Put off, the reflection becomes a Debt that names the reason as required: it cannot be answered without it, and it can still be declined, with more steps than answering. A sale that follows the Plan Exit asks nothing and owes nothing. Trade Workflows accepts Complete or Defer for a sale's reflection and refuses Decline; a completed reflection for a sale that leaves the Plan Exit must hold the reason. An Expiration is as decision 125 left it: Complete only, with the Expiration Reason on the spot when it is recorded in the money. **This amends decision 125's item 4** ("a sale and an Expiration submit Complete for the reflection") **and drafting answer 1 of decision 124** ("saved complete, so nothing is owed later"), which now holds when the sale follows the Plan or the reason is given at the sale. (4) **The other answers**, each as recommended: with a needed Mark acknowledged Unavailable the Plan Call stays `Unknown`, as applied by decision 125 (U13); three places in `specs/` that still stated the rules decision 125 replaced are corrected (U15); the schema stays 7, and optional additions to a stored form or Debt are not a schema change (U16); the three parts (U17); the words W82 through W153, with two mockup lines dropped for failing drafting answer 10 (U18); a saved "record later" has no undo (U19); no glossary rows for the two arrow captions (U20); the measure of a sale is one pure function in `src/domain/plan-exit/`, called by the form to show the check and by Trade Workflows to enforce it (U21, P165). (5) **Spec text**, agreed as written in the breakdown's section 11.1 and made in `specs/`: the overview's "Open and save Daily Review" steps 2, 3 and 5; the Journal's "One-click Hold" (its diagram line and closing line) and one sentence added to "Debt and obligation semantics" (a Debt may name prompts, by role, that its answer must include); the README's product boundary ("every eligible Trade that owes one"); the Plan Exit paragraph of Trade Workflows' `recordPositionChange`; AC-REV-008's "Then". No line moved in any spec. (6) **The Open list** follows the Review's attention order in full, as Trade Views already says: it makes the same one range read of saved Actions and places an Exit not carried out first (A301). (7) **Words:** W82 through W155 are approved; W154 is "Say why later" and W155 the receipt and to-do lines for a reason owed. (8) **Where the mockup differs from the spec, the spec is followed** (U11; the breakdown's section 1.3 lists each case). **Rejected:** a required sentence before a sale that leaves the Plan saves; a reason that is optional and never owed; a rule that differs between the Review and Trade Detail; a command that also accepts Decline at a sale; schema 8; two parts, or one breakdown of 67 tasks; an undo for "record later"; a precomputed Plan check or a new preview operation. **Affected:** five spec files; the spec map (six entries' character counts and five summaries, D9.5's tags on 44 entries now final, a D9.5 row in the reading-cost table) and all 29 reading lists; the deliverable summary; D9.5's section (the amendment notes marked "decision 126"); the acceptance matrix (D9.5's entries on 25 scenario rows; AC-REV-008's text changed); the breakdown's status; [D09.5-handoff.md](D09.5-handoff.md). The earlier breakdowns whose Review rules D9.5 replaces are listed in the breakdown's section 1.3 and carry no note of their own. **Durable compatibility:** the schema stays 7, with no store, key or index change and no stored record rewritten. Journal seed manifest 6 revises three forms for future entries only (a migration, with the frozen fixtures `workspace-v7-seed6` and `backup-v7-seed6`, P174). Three optional stored additions (A321): `protected` on a form option, the prompt roles `PlanDepartureReason` and `ExpirationReason`, and `requires` on a Debt. The older fixtures' expected views change only where they name a form's latest revision (T95.28). **Accepted with the schema staying 7** (the user, 2026-11-22): the schema number is what tells an older release that data is newer, so an older release cannot tell that a Workspace or backup holds these additions. Its strict restore check refuses such a backup as malformed. A stale tab of the older release is expected to apply the old rules to the new forms; whether a release check forces it to reload was not checked. **Numbering:** the next decision is 127. |

| 127 | **T95.3: the frozen fixtures' saved Review views take the new attention bands** (plan revision 116, 2026-11-22, the user's answer to D9.5's Q1, option (a)). | **Why:** T95.3 gives the Review the spec's new bands (decision 125). Four frozen fixtures' `expected-views.json` (`workspace-v6`, `workspace-v7`, `backup-v6-blocked`, `backup-v7`) name the old values "BoundaryReached" and "Blocker" (12 places), and the new order swaps two walked Trades, so ten integration tests that compare against them fail. P174 allowed an expected view to change only where it names a form's latest revision. **The decision:** follow-on task T95.3-D1 regenerates those four `expected-views.json` files through the app's own code, changing only the band values and the order they cause, with the diff recorded in `evidence/D95/structural.md`; any other field that changes stops the task. Every `dump.json` and `backup.tjbackup` stays byte-identical. P174 is amended accordingly. Precedent: decision 117's removal of `rangePosition`. **Amended within revision 116 (the user, 2026-11-22, Q2 answer (a) and a standing direction):** the regeneration found six fixtures, not four (`workspace-v5` and `backup-v5-blocked` too), and KO's Trade (`fx-0075`) moves from Evidence limited to Exit not carried out with its attention reason changing to match; both are covered. **Standing direction for D9.5:** wherever the Review redesign requires updating a frozen derived-view snapshot (`expected-views.json` and similar), the task may update it, provided no figure or computation changes; the stored data (`dump.json`, `backup.tjbackup`) never changes, and each diff is recorded in `evidence/D95/structural.md`. A snapshot change that alters a figure or a computation is still a pending decision. **Rejected:** translating the new bands back to the old names in the test tool (decision 78's reason: the check would stop testing what the app returns). **Affected:** the D9.5 breakdown's P174 and Progress (T95.3-D1). No acceptance scenario changes status. `specs/` is unchanged. **Durable compatibility:** none; only derived-view snapshots change. **Numbering:** the next decision is 128. |
| 128 | **T95.4: sessions left before an expiration come from a calendar-only Market Data call** (plan revision 117, 2026-11-22, the user's answer to D9.5's Q3, option (a)). | **Why:** the day summary lists each contract's expiration with the sessions left; Daily Review never sees the session policy (decision 62), and Market Data's read session gave only the next and previous session. **What:** `MarketDataReadSession.sessionDatesBetween(from, to)`, calendar only, no store read; one sentence in `specs/design/market-data.md`, added by T95.4 (precedent: `nextSessionDate`, revision 92). D9.5's P175. **Rejected:** giving Daily Review the session policy (reverses decision 62); dropping the count. |
| 129 | **T95.4-D1: every Daily Review save returns the day summary; the coordinator returns the figures T95.10 and T95.11 need** (plan revision 118, 2026-11-22, the user's answer to D9.5's Q5, option (a)). | **Why:** `day` came only with `open`, so the day card would go stale after each save; the spec has the screen continue from each save's response without calling `open` again, and the request-count pins hold that. T95.11's labels need the session before's zone and whether a contract expires on the Review Date, which the coordinator holds but didn't return. **What:** follow-on T95.4-D1 before T95.10: `day` on every save result (Save Marks, Action save, Debt resolution), from the same pass, no new store read; the finished-day lists with the save that finishes the day; `day.lines` gains each Trade's count of Marks to go and whether an owed reflection is a Close Review; `meter.previous` gains its zone; a Trade's card says when a contract expires on the Review Date. Fields only: no figure or computation changes. D9.5's P176. **Rejected:** reopening the Review after each save (breaks the spec and the pins); refreshing only when the day finishes. |

Review decisions accepted during the walkthrough are appended here.

## Freeze record

Protocol Phase 6, adapted by decision 40.

| Item | Record |
|---|---|
| Repository path | `plan/implementation-plan.md` on branch `claude-opus-5.5` of `ckolbegger/trade-journal-v3`, worktree `worktrees/claude-opus-5.5` |
| Immutable revision | **Revision 119**: the commit tagged `claude-opus-5.5-plan-r119` (revision 118 plus a to-do in D10's section: "expires on the Review Date" per contract once a Trade holds several, from D9.5's T95.13-D1 ocr review (2026-11-23); revision 118, the commit tagged `claude-opus-5.5-plan-r118` (revision 117 plus decision 129: every Daily Review save returns the day summary, and the figures T95.10 and T95.11 need, by follow-on T95.4-D1, D9.5's P176 (2026-11-22); revision 117, the commit tagged `claude-opus-5.5-plan-r117` (revision 116 plus decision 128: sessions left before an expiration from a calendar-only Market Data call, D9.5's P175 (2026-11-22); revision 116, the commit tagged `claude-opus-5.5-plan-r116` (revision 115 plus decision 127: the four frozen fixtures' saved Review views take the new attention bands, by follow-on task T95.3-D1, amending D9.5's P174 (2026-11-22); revision 115, the commit tagged `claude-opus-5.5-plan-r115` (revision 114 plus decision 126: D9.5's breakdown is agreed, 67 tasks in three parts each ending in a gate, with the user's nine answers; "Say why later" lets a sale that leaves the Plan save at once and owe its reason as a reflection Debt that requires it, and a sale's reflection may be completed or deferred but not declined; six agreed texts are made in `specs/` (the overview, the Journal, the README, Trade Workflows and AC-REV-008) with no line moved; the schema stays 7; words W82 through W155 approved (2026-11-22); revision 114, decision 125: D9.5's spec changes are made in `specs/`, 21 edits to Daily Review, the UI contract, the Journal, Trade Workflows, the glossary and the acceptance contract, with the new scenarios AC-REV-007, AC-REV-008 and AC-SET-005 and the spec map and reading lists regenerated (2026-11-22); revision 113, decision 124: D9.5, the Daily Review redesign, is defined at the deliverable level after D9R2 and before D10, with nine stories and no breakdown yet; its spec changes are agreed in principle and not yet made, a phone prototype and the spec text come before the breakdown, and D23 gains the slip-check setting (2026-11-22); revision 112, decision 123: D9R2, the Review's Marks grid, runs after D9 from its breakdown, 17 tasks one at a time; each Trade's Marks panel becomes a grid of Instruments by sessions with one cell editor, drafts belong to the Review and one Save Marks sends them all, the open result gains `previousSession` and `earlierMarks` and series points `resolutionRevision`, and Price History and the Journal show acknowledged sessions (2026-11-20); revision 111, decision 122: each task has a level, Full, Standard or Light, that sets its ocr review and suite run, and word-only decisions need no decision, revision or tag (2026-11-20); revision 110, decision 121: the chart's key names what was realized "Realized", the swatch's colour showing gain or loss (2026-11-20); revision 109, decision 120: "Realized" names what was realized, for a gain as for a loss, replacing "Banked" on every screen (the user's word review, 2026-11-20); revision 108, decision 119: D9 stage B's browser stages (the user's answer to SB-Q2, option (c), 2026-11-19): T9.20-D1 removes the one `e2e/d9` case `e2e/d9ar` duplicates (B9.5's offline reload) and AC-DEL-001's D9 command moves to `e2e/d9ar/responsive-a11y.spec.ts`; T9.20-D2 adds a `browser-4` stage for `e2e/d9` and `e2e/d9ar`; revision 107, decision 118: D9A-R, the D9 stage A refactor, runs after D9's stage A and before its stage B from its breakdown, 24 tasks in lanes with an agent cap of 4; the replay opens as an overlay from a button beside Trade Detail's drawers and from the Review card, with `replay=open` in the address; the readout's stake is a grid, reward to risk carries the No-Edge Odds, the Plan stands beside what happened, and session cards replace the table; the glossary gains No-Edge Odds and six compact labels, Trade Analysis's `evaluate` and `replay` gain the new results, Trade Views' invariants say the odds are not a prediction, and the UI contract lets a read-only overlay cover the shell's warnings without dismissing them; revision 106, decision 117: D9's breakdown, 40 tasks in three stages, the replay chart as a swarm and the option estimates and the meter serial; replay is Corridor, in Trade Detail and the Review card; implied volatility, the Share Equivalent and the Mark Change Split are labelled Estimates kept apart from exact figures, amending ADR 0007, the spec index, the glossary, Trade Analysis and the UI contract, with the new scenario AC-CALC-005; fixed rates stated on the About page only; the meter replaces the Review slider and `rangePosition` is removed with its 84 entries in eight fixtures' expected views; the Open list's default order is the Review's attention order, amending Trade Views; a task may shorten screen text and records it; revision 105, decision 116: D8R's run rules answered in advance, the full year for any year other than the current one in a contract name, provisional new words listed for approval, moderate defects after three critics become tech debt, and one rerun for tech debt item 11's flake; revision 104, decision 115: D8R, the Trade Detail refactor, runs after D8 and before D9 from its breakdown, 28 tasks in three waves and eleven lanes; Market Data's read session names the previous session and the as-of exchange date, and Trade Detail's Journal leaves out the Trade Anchor, both amending `specs/`; `nearest` is removed with its 90 lines in five backup fixtures' expected views; "Awaiting the Mon Oct 12 close"; contract names carry the full year only for a later year; decision 113's pending questions are asked one at a time; revision 103, decision 114: Restore reads schemas 3 through 7, and the restored-capacity checks gain a 50% growth baseline and the commands `measure:capacity`, `measure:capacity:reset-basis`, `measure:capacity:reset-baseline` and `bench:verify-capacity`, built by the follow-up T8.19-F1; from D9 the benchmark runs once per deliverable, after the gate, and a failure starts no fix until the user chooses; D8's 29 answered questions are carried into its breakdown, section 1.6; revision 102, decision 113: a deliverable's session holds `.claude/session.lock`, prints its run order first, keeps working on unblocked tasks while a decision it has asked the user is pending in `DECISIONS-PENDING.md`, and reports fix rounds, flakes and pending decisions; and the D8 breakdown runs as a swarm in three waves with the new T8.23, follows schema 7 (decision 107), gains a Progress section, shows Backup only in the wide sidebar and from About on narrow screens, and keeps "Start my journal"; revision 101, decision 112: B6.6 is deleted, the checked-out build is renamed from `dist-releases/d6` to `dist-releases/current`, and `verify:fixtures` requires a fixture for every schema, in bug tasks BUG-4.1 and BUG-4.2 before D8; revision 100, no decision: D08P's gate closes on its third critic, critic-6, whose one defect, Journal paging dropping keyboard focus, is accepted as tech debt item 24; revision 99 makes D08P's C8P.2 accepts the Trade Summary line's repeats, and its checkpoint closes after bug task T8P.23-B14 without a fourth critic; revision 98 makes D08P's A212 ends a Settlement Due Trade's replay lifetime with its contract's expiration session, bug task T8P.23-B13, and the Stale context line keeps "close"; revision 97 makes D08P's C8P.2 names every accepted exception to "each figure appears once", adding the five existing-wording repeats critic-2 found; revision 96 gives D08P T8P.31, which places every figure of the three legacy Trade Detail blocks that no task had placed, before T8P.22 retires them; revision 95 gives D08P's T8P.22 a case, a Debt answered or declined on its card leaves Needs you without a read; revision 94 lets D08P's lane R2 may edit `OwedDebtItem.tsx` and the legacy `Journal.tsx` so Reflect now opens a Debt's form by its id, bug task T8P.15-B2; revision 93 makes D08P's series points carry Mark provenance, made in T8P.10, and lane R2 wires Reflect now as bug task T8P.15-B1; revision 92 makes Market Data's read session names the session after its trading date, from the calendar alone, for D08P's T8P.28 (`specs/design/market-data.md`); revision 91 makes D08P's before-Marks words in W3, W7 and W8 always name dates; revision 90 gives D08P T8P.28 (Trade Views states "no Marks yet"), T8P.29 (the Today drawer, P&L card and Conditions card read it) and T8P.30 (absence checks prove absence); revision 89 gives a bounded Max reward its R in `evaluate` (T8P.7) and on the Conditions card (T8P.15); revision 88 lets strict checks in D08P gain the additive `nearest` and `days` fields; revision 87 re-anchored two `ui-alignment` geometry checks to D08P's rail-beside-drawers layout; revision 86 tightened T8P.27's test pairing, and revision 85 added T8P.27). Every revision, newest first, is in [revisions.md](revisions.md). A new revision adds its entry at the top there and replaces this one. Revisions are tagged `claude-opus-5.5-plan-r<n>`. |
| Stack and versions | [technology-stack.md](technology-stack.md), Profile A, with ["Pinned versions"](technology-stack.md#pinned-versions) (decision 42) |
| Browser and OS provenance | Chromium 153.0.8010.12, Firefox 155.0, and WebKit 26.6 as bundled with Playwright 1.63.0, on macOS 26.6.2 (25G83) arm64. This is provenance, not a support allowlist. |
| Task graph and boundaries | The 35 ordered deliverables in the summary table (27, plus D5R from revision 20, D5R2 from revision 28, the D6 prefactor from revision 30, the D7 prefactor from revision 42, D7S from revision 54, the D7S prefactor from revision 72, D08P from revision 84 and D8R from revision 104; revision 72 also corrects the count, which revision 54 left at 31). Task graphs for D1, D2, D4–D8, D5R, D5R2, D08P, D8R, D9 (revision 106) and the D6, D7 and D7S prefactors are in their breakdown files; D10–D28 get theirs by revision (decision 40). |
| Layer-only exceptions | RC (approved 2026-10-11); its breakdown file is written before the first Cloudflare publish. |
| Acceptance matrix | [acceptance-matrix.md](acceptance-matrix.md): 68 rows (AC-CALC-005 added by revision 106). 14 are fully planned at task level, 31 partly at task level and completed later, and 23 at deliverable level. |
| Per-task and per-deliverable evidence | Sections 4–7 and 10 of each breakdown: red/green per case, structural verifications, mock-free integration suites with disclosed substitutes, and the fresh browser-critic gate |
| Kickoff prompt | [kickoff.md](kickoff.md), instantiated with this path and revision |
| Approval | **Revision 1 approved by the user on 2026-10-17**, after reviewing decisions 40–42, the acceptance matrix, the pinned versions, the freeze record, and the kickoff prompt. **Revisions 2 and 3 (decision 43) proposed and approved by the user on 2026-10-18.** **Revision 4 (decision 44) proposed and approved by the user on 2026-10-18.** **Revision 5 (decision 45) proposed and approved by the user on 2026-10-19**, including that a tag correction to the spec map is not a revision. **Revision 6 (decision 46) requested and approved by the user on 2026-10-24.** **Revision 7 (decision 47) requested and approved by the user on 2026-10-24**, with decisions U1–U7 answered and I1–I2 left to the named tasks. **Revision 8 (decision 48) requested and approved by the user on 2026-10-25**, after narrowing the Open and Planned tables to the columns a trader scans by. **Revision 9 (decisions 49 and 50) requested and approved by the user on 2026-10-27**, with the edit to the spec's pressure definition and the moved `claude-opus-5.5-d2` tag. **Revision 10 (decision 51) requested and approved by the user on 2026-10-27**, after T4.2 found no NYSE source for 2011 and the user said no calendar before 2024 is needed. **Revision 11 (decision 52, ADR 0011) requested and approved by the user on 2026-10-27**, after T4.4's shared-counter conflict, with the Catalog and Journal seed fixes as D4 bug tasks. **Revision 12 (decision 53) requested and approved by the user on 2026-10-27**, removing the Market Data counter for scalability and per-key binding. **Revision 13 (decision 54) requested and approved by the user on 2026-10-28**, answering T4.18-B1: everything that needs a Mark is Unavailable outside coverage, and a calendar warning icon says "Coming soon - update calendar". **Revision 14 (decision 55) requested and approved by the user on 2026-10-29**, moving Vitest to 4.1.12 and Wrangler to 4.153.0 to clear `npm audit` findings. |

**Explicit assumptions and remaining non-product implementation risks**

1. **Rolling-wave planning (decision 40).** A later breakdown may amend an already implemented deliverable. Each revision must name the affected scenarios and the durable compatibility (migration, fixtures, backup content version) before work resumes.
2. **D4's P14 is settled** by decision 49 (revision 9), so it no longer blocks D4's first task (decision 41). The D2 follow-up batch F1–F11 (decision 46) and the UI-alignment batch T2.36–T2.59 (decisions 47 and 48) ran before it and are complete.
3. **Engine coverage.** Routine evidence is Chromium-only, so Firefox and WebKit defects, including WebKit's handling of `durability: 'strict'`, IndexedDB in workers, and `.tjbackup` downloads, can surface only when RC runs before the first publish (decision 19).
4. **Production HTTPS evidence** is pending until the Cloudflare project exists (decision 4).
5. **Marketdata.app's browser callability** (CORS with token authentication) is unverified until D11's breakdown (decision 15). A failure would reshape D11.
6. **Two TypeScript checkers** (decision 44): typed linting runs on 6.0.3 while `tsc` runs 7.0.2. Microsoft states that code compiling cleanly on 6.0 compiles identically on 7.0; T1.1's `tsc6 --noEmit` check exposes any disagreement, and the setup collapses to one version when typed linting supports 7.
7. **The capacity basis** stays partly estimated until D8 measures it through a real Restore (decisions 18 and 39). A large miss would change the readiness threshold.
8. **`fake-indexeddb` fidelity.** Node integration cases rely on its transaction scheduling (for example D8's I8.2, where a concurrent save waits behind the export snapshot) and on its upgrade and versionchange behavior. The Chromium suites repeat the decisive cases.
9. **Mature-scale backup on phones** (decision 33): export and preparation times and memory are measured only on the development machine. Phone behavior is unmeasured until RC or real use.
10. **Node.js is a range, not an exact version** (decision 43). Test runs months apart may use different 26.x patches, and 26.12.0 is younger than the two-week rule. Node runs only the tooling, `engine-strict` blocks other majors, and each run's provenance records the exact version.
11. **Scoped spec reading (decision 45).** An implementing session doesn't read up front any section the map fails to tag for its deliverable. Several things limit this. Every deliverable reads the 117 core sections. The session must read any other section its work touches. D1–D8's tags come from a review of each breakdown. The critic has full access, so a miss shows up at the gate at the latest.

## Rules every deliverable follows

- **Vertical and production-reachable.** Every deliverable is operated through the production UI, through the real application/domain code, against real IndexedDB persistence. No deliverable is layer-only. The one approved layer-only checkpoint, RC, is not a deliverable and advertises no capability (see "Layer-only exceptions").
- **Selectors offer only deliverable values.** Strategies, Entry Types/definitions, Sources, reasons, Tag Types, Report Periods/families, Break Down By dimensions, and lifecycle filters appear only when the deliverable that can honor them lands.
- **Seed additions are migrations.** Each deliverable that adds defaults bumps the Catalog or Journal seed-manifest version. Existing Workspaces receive the additions through the startup migration/seed path without overwriting trader changes.
- **Durable-representation changes carry their migration.** A deliverable marked "schema change" bumps the schema version and includes the forward migration from every earlier supported version through the isolated candidate database and pointer flip. It also includes the migration-failure test. It freezes a raw fixture of its new schema version, produced by its own commands (as D1's T1.31 does for version 1), so every later migration is tested from every earlier version. From D8 onward, the new schema version is also the backup content version (decision 35): the deliverable freezes a backup fixture at that version, produced by its own `exportBackup`, and proves Restore from every earlier backup fixture through the same per-record transforms.
- **Capability honesty.** Each deliverable adds exactly its completed operations and variants to the Installed Capability Manifest. Anything not yet delivered is absent from navigation and calls, never shown as a domain `Unavailable`.
- **Gate.** Each deliverable ends with its cumulative unit and mock-free integration suites green, then a passing fresh browser critic, as required by the planning protocol. The browser part of those suites runs in Chromium with the faults build (decision 19). RC runs before every Cloudflare publish.
- **Benchmark once, at the end (decision 114, from D9).** After the gate closes, with no development work left, the session runs the benchmark once, before the deliverable's tag. It runs alone, on port 4175, in the deliverable's worktree. The steps are:
  1. `npm run build:bench`;
  2. `npm run bench:generate`, which reuses the cached dataset unless the generator version changed;
  3. `npm run bench:setup`;
  4. `npm run measure:capacity`;
  5. `npm run bench:verify-capacity`;
  6. `npm run bench:run`.

  Results go to `evidence/D<nn>/bench.md`.
  - **Pass:** every command exits 0 and every budget and limit holds.
  - **Fail:** the session starts no fix. It stops, tells the user which command failed and its figures against their limits, and waits. The user chooses a fix now (bug tasks, then one more benchmark run) or a tech debt item. The tag follows that choice.
  - **Not part of the run:** `measure:capacity:reset-baseline` runs only when the user says so. A schema change's `measure:capacity:reset-basis` is an ordinary task before the gate (decision 18).

### Cumulative obligations

These scenarios cover properties of the whole product. Every deliverable must re-prove them for the capabilities it adds. Each remains **partial** until the last deliverable, where it is marked full.

| Scenario | What each deliverable re-proves |
|---|---|
| AC-RESP-001 | One-call post-commit results for each new mutation family, with no required read-back |
| AC-CAP-001 | Manifest matches what is reachable; omitted behavior is absent |
| AC-DEL-001 | Each new manual workflow works after a stopped, offline restart |
| AC-DEL-004, AC-DEL-006 | Each new authoritative mutation returns `RuntimeNotWritable` outside `Writable`, at both the UI and persistence boundaries; readiness reruns at every boundary |
| AC-UI-001, AC-UI-002 | Each new view has live narrow/wide resize with state kept, Loading/Ready/Empty/Error states, keyboard use, axe checks, and WCAG AA |
| AC-REBUILD-001 | Each new index or projection rebuilds to observationally equivalent results |
| AC-BACK-001, AC-REST-001 | Backup round trip (decision 38): each deliverable that adds or changes stored data extends the round-trip case (export, verify, Restore into an empty origin, equal views and identities) to its new record kinds; each schema change freezes a backup fixture and restores every earlier one (decision 35) |
| AC-PERF-001 | Cold start and warm Open-list latency stay within budget at the dataset scale the deliverable supports (harness introduced in D2). From D9, re-proven by the end-of-deliverable benchmark, which also checks capacity (decision 114) |
| AC-DEL-003 | Browser-tab launch and browser-neutral readiness each deliverable (Chromium; Firefox and WebKit through RC, decision 19); installation and installed launch in D28 (decision 9); production HTTPS evidence **pending** until the Cloudflare project exists (decision 4) |

## Deliverable summary

| # | Deliverable | Stories |
|---|---|---|
| D1 | [Start a Workspace and confirm a Long Stock Plan](D01-start-a-workspace-and-confirm-a-long-stock-plan.md) | 4 |
| D2 | [Open a Long Stock position](D02-open-a-long-stock-position.md) | 3 |
| ~~D3~~ | Manual Marks and ongoing risk/reward: **merged into D4** (decision 24) | — |
| D4 | [Daily Review, with Manual Marks and ongoing risk/reward](D04-daily-review.md) | 7 |
| D5 | [Deferred reflection and Journal Debt](D05-deferred-reflection-and-journal-debt.md) | 2 |
| D5R | [Review redesign: one card per position](D05R-review-redesign.md) (decision 61) | 6 |
| D5R2 | [Review card progress](D05R2-review-card-progress.md) (decision 69) | 0 (refactor) |
| D6 prefactor | [A leaner browser suite](D06-prefactor-browser-tests.md) (decision 71) | 0 (tests and tooling) |
| D6 | [Close a Long Stock position](D06-close-a-long-stock-position.md) | 3 |
| D7 prefactor | [One Calculation Result throughout](D07-prefactor-calculation-results.md) (decision 77) | 0 (refactor) |
| D7 | [Single-leg options: happy path](D07-single-leg-options-happy-path.md) | 3 |
| D7S prefactor | [One Mark-to-Market Valuation](D07S-prefactor-mark-to-market-valuation.md) (decision 101) | 0 (refactor) |
| D7S | [Option-price Stops and Targets](D07S-option-price-stops-and-targets.md) (decisions 89, 107) | 1 |
| D08P | [The Trade Detail cockpit](D08P-trade-detail-cockpit.md) (decisions 110, 111) | 0 (refactor) |
| D8 | [Backup and Restore](D08-backup-and-restore.md) | 3 |
| D8R | [The Trade Detail refactor](D08R-trade-detail-refactor.md) (decision 115) | 0 (refactor) |
| D9 | [Trade replay, option estimates and the Stop-to-Target meter](D09-trade-replay.md) (decision 117) | 1 |
| D9A-R | [D9 Stage A Refactor](D09A-R-stage-a-refactor.md) (decision 118) | 0 (refactor) |
| D9R2 | [The Review's Marks grid](D09R2-review-marks-grid.md) (decision 123) | 0 (refactor) |
| D9.5 | [The Daily Review redesign](D09.5-daily-review-redesign.md) (decisions 124, 125 and 126) | 3 |
| D10 | Multi-leg option Strategies | 3 |
| D11 | Automatic closing prices (Pricing Provider) | 3 |
| D12 | Stop Discipline in Daily Review | 1 |
| D13 | Voluntary journaling and Journal history | 3 |
| D14 | Abandon a Plan | 1 |
| D15 | Correct an Execution (Replace and Void) | 2 |
| D16 | Current Exposure report | 1 |
| D17 | Revise management | 1 |
| D18 | Rebuild a Trade | 1 |
| D19 | Mark history and change impact | 2 |
| D20 | Assignment and Exercise | 2 |
| D21 | Roll | 1 |
| D22 | Tags, Idea Source, and Trade filters | 2 |
| D23 | Manage references and Workspace settings | 2 |
| D24 | Outcomes report | 2 |
| D25 | Process Scorecard | 1 |
| D26 | Customize Journal prompts | 1 |
| D27 | Journal Field report | 1 |
| D28 | Install the app | 1 |

## Layer-only exceptions

Each exception below has its own recorded user approval, as the planning protocol requires. None is a deliverable or release boundary, and none advertises a capability.

### RC — Release conformance across engines

Approved by the user on 2026-10-11, during the D1 breakdown.

- **Why it is not tasks inside a vertical deliverable:** at the user's direction, the real-state readiness and delivery matrix in Chromium, Firefox, and WebKit stays out of routine test runs (decision 19). It is a reusable pre-publish procedure, not part of building any one capability.
- **Why no smaller vertical slice is available:** it adds no trader-visible behavior; its only output is evidence.
- **Advertised capability:** none. The Installed Capability Manifest and navigation are unchanged.
- **How it is verified:** it runs in all three engines with real browser state and no faults build: each readiness check failing alone and two failing together; Integrity Blocked; offline cold restart and kill-after-commit restart; update with the synthetic second release, the corrupt release, and offline retention; tab launch with an unknown user agent; and the capacity measurement in Firefox and WebKit. Each run records exact engine and OS versions. Any failure blocks publishing.
- **Consumer and blocking edges:** D1 → RC, because RC needs D1's service worker, readiness gate, and update flow. RC → every Cloudflare publish. Deliverables that change delivery behavior add cases to RC; D8 adds backup and verification in `Recovery Only`, the after-Restore readiness boundary, and real downloads and file selection of `.tjbackup` files (D8 B8.1, B8.3, B8.8, B8.10), and D28 adds installed launch.
- **When it is built:** before the first Cloudflare publish (user's choice). Until it runs, every AC-DEL row's Firefox, WebKit, and real-state evidence is marked pending RC, and engine-specific defects may surface only then.
- **Upgrade tests (decision 76):** RC also runs `npm run test:e2e:release-history` and tech debt item 10's upgrade case in every engine.
- **Effect on facts or historical coverage:** none.
- **Task breakdown:** its own file in `plan/`, written when it is scheduled.

---

## D1 — Start a Workspace and confirm a Long Stock Plan

**Stories**

1. As a trader, I would like the journal to verify that this browser can safely hold my data before I enter anything, so that I can trust that nothing I record is written somewhere that silently fails.
2. As a trader, I would like to set up my Workspace with my brokerage Institution and Account, so that I can attribute every Trade to the account it was placed in.
3. As a trader, I would like to confirm a Long Stock Plan with intended entry, Stop, Target, thesis, and invalidation before I enter, so that I can commit to a defined 1R before money is at stake.
4. As a trader, I would like the app to reopen offline and to update only when I'm not in the middle of entering something, so that I can journal anywhere without losing unsaved work.

**Capability set.** This is the PWA foundation plus the smallest real capability. It includes:

- ordinary browser-tab use (installation is not offered until D28), with the full Runtime Readiness gate on every launch and the write gate in persistence;
- `Unsupported`, `Recovery Only` (reads only), and Integrity Blocked views;
- advisory storage-protection reporting with the durability request;
- safe update notice and activation;
- first-run initialization with time zone, then Institution and Account onboarding;
- confirming a Long Stock Plan with its completed Plan Reflection;
- a Planned Trade list and Trade Detail.

**Introduces**

- *Operations:*
  - Workspace: `initialize` (fresh Workspace), `getStatus`, and `requestDurability`.
  - Reference Catalog: `seedDefaults`, `save` (create Institution and create Account only), `query`, and `resolve` (`NewSelection` and `DisplayOnly`).
  - Journal: `seedDefaults`, `getDefinitions`, and `prepareEffects`/`applyPreparedEffects` (Complete only).
  - Journal: `query` (Trade narrative scope).
  - Trade Analysis: `assessPlan` (Long Stock) and `derive` (Planned only).
  - Trade Record: `prepareChange`/`applyPreparedChange` (ConfirmPlan), `getRecord`, and `queryRecords` (`CurrentState`, Summary and AnalysisInput).
  - Trade Workflows: `confirmPlan`.
  - Trade Views and Reporting: `browseTrades` (Planned) and `getTradeDetail` (Planned).
- *Mechanisms:*
  - A minimal Web App Manifest for identity (id, name, icons, start URL, scope) with `display: "browser"`.
  - The versioned service worker with a digest-verified Offline Release Inventory, and the update-available notice with deferred activation.
  - The four-check Runtime Readiness gate, with simultaneous failures reported together.
  - The persistence-level write gate and `RuntimeNotWritable`.
  - Root pointer database plus Workspace database; one-transaction semantic commit with the early-auto-commit guard; revision counters and `WorkspaceSnapshotBinding`.
  - Installed Capability Manifest.
  - BigInt rational values; injected clock and Temporal time-zone handling.
  - Responsive navigation shell (narrow bottom bar, wide sidebar).
  - The capacity requirement formula, which is recomputed whenever the schema grows.
- *Seeds:*
  - Catalog: the Long Stock Strategy only.
  - Journal: the Plan Reflection Entry Type with its exact initial definition, and the Plan Confirmation Source.
- *Durable representation:* the initial schema, holding Workspace metadata and settings (time zone), the Catalog, the Journal (Entry identities and versions, definitions), Trade documents (Plan, Planned Leg, original management, stored lifecycle and index), with each Trade fact held as a stable fact identity plus a single-version list (decision 11), and the diagnostics store.

**Acceptance**

- AC-PLAN-001 — partial. Declared scope: options are added in D7, and objective selection criteria complete it in D10.
- AC-PLAN-002 — partial. Declared scope: incoherent multi-leg shape and objective-leg evidence are completed in D10.
- AC-LIFE-001 — partial (Planned). Declared scope: Open is completed in D2, and Closed with Terminal Disposition in D6.
- AC-JOUR-001 — partial (Plan form). Declared scope: Review forms are completed in D4.
- AC-JOUR-007 — partial (Plan Reflection). Declared scope: all seven types are seeded by D17, and repeat seeding over trader revisions is proven in D26.
- AC-REF-001 — partial (Long Stock). Declared scope: completed in D22.
- AC-DEL-002 — full, proven with a synthetic second release.
- AC-DEL-005 — partial. Declared scope: backup export and verification in `Recovery Only` are completed in D8.
- AC-DEL-003 — partial (manifest identity, Offline Release Inventory, browser-tab launch, browser-neutral readiness on loopback). Declared scope: the `standalone` request, installation, and installed launch are completed in D28; production HTTPS evidence is pending.
- Cumulative obligations begin here.

**Parallelism.** Once the command and result shapes and the Trade List and Detail read models are fixed, the domain and persistence work (Catalog, Journal, Trade Record, Trade Analysis, Workflows) can proceed in parallel with the UI. The delivery and readiness track (manifest, service worker, inventory, gate) is independent of the domain track until the write gate joins them.

---

## D2 — Open a Long Stock position

**Stories**

1. As a trader, I would like to record the fills from one entry decision as a single Position Change against my Plan, so that I can see my open Position, Lots, and fees exactly as executed.
2. As a trader, I would like to reflect on each entry decision when I record it, or explicitly decline, so that I can capture my state of mind while it's fresh.
3. As a trader, I would like to see how my actual entry compared with my Plan, so that I can learn whether I execute my plans as written.

**Capability set.** This covers opening and scale-in Position Changes for Long Stock, with one or more Executions per decision. The Trade moves from Planned to Open. The trader sees the Position, Open Lots, and opening fees; Entry Quality once the plan is fully entered; and an Entry Size deviation when the planned quantity is exceeded. There is a Position Change Reflection that can be completed or declined, an Open Trade list, and Open Trade Detail.

**Introduces**

- *Operations:*
  - Trade Workflows: `recordPositionChange` (opening and increase only).
  - Trade Analysis: `derive`, extended with replay of facts, Positions, Lots, fees, expected lifecycle, Entry Resolution Point, Entry Quality, and Entry Size excess.
  - Trade Record: Position Change change variant; recorded Deviation occurrences.
  - Journal: Decline outcome.
  - Trade Views and Reporting: `browseTrades` and `getTradeDetail` for Open Trades.
- *Mechanisms:*
  - First schema migration through the isolated candidate and pointer flip.
  - Lifecycle-index Open query with batched AnalysisInput.
  - Deterministic benchmark data generation through domain commands in the browser, and the latency harness for cold start and Open list.
- *Seeds:* Journal: the Position Change Reflection definition and the Position Change Source.
- *Durable representation:* schema change adding Position Changes and Executions (each a fact identity with a single-version list, per decision 11) with their Planned-Leg intent, recorded Deviation occurrences, and Journal decline records.

**Acceptance**

- AC-POS-001 — partial (opening and scale-in). Declared scope: completed in D6.
- AC-POS-005 — partial (partial fills, Entry Size excess). Declared scope: Entry Size shortfall is added in D6; Not Entered, Not Verifiable, Planned-Leg Terms, and Unplanned Exposure in D10 (Not Entered needs an untouched second leg; D6 breakdown, section 1.2).
- AC-LIFE-001 — partial (Open).
- AC-CALC-001 — partial (Entry Quality). Declared scope: Management Revisions are completed in D17.
- AC-LIFE-003 — partial (normal reads surface disagreement without repairing it; mutation preparation repairs coherent disagreement with disclosure or rejects incoherent facts, decision 23). Declared scope: Restore-preparation repair is completed in D8.
- AC-REST-004 — partial (a migration failure keeps prior data intact, is never Ready, and a retry activates atomically; decision 22). Declared scope: "exportable" is completed in D8.
- AC-JOUR-001 — partial (entry form).
- AC-JOUR-005 — partial (Complete and Decline retries keep one outcome per obligation key).
- AC-JOUR-007 — partial (Position Change Reflection and its Source).

**Parallelism.** Once `PositionChangeCommand`/`Result` and the Open read model are fixed, the Trade Analysis replay and opening-Lot work, the Trade Record and migration work, and the entry form/Detail UI can proceed in parallel.

---

## D3 — Manual Marks and ongoing risk/reward (merged into D4)

Merged into D4 on 2026-10-11 so that Marks are entered as part of the Daily Review (decision 24). The number is retired so that later deliverable numbers and references stay stable.

---

## D4 — Daily Review

Includes the former D3, Manual Marks and ongoing risk/reward (decision 24).

**Stories**

1. As a trader, I would like an after-close review that walks me through every Trade that was open in that session, ordered by what needs my attention, so that I can manage my book deliberately each day.
2. As a trader, I would like to record an Action for each Trade (Hold with one Save, or Exit, Roll, or Adjust with my intent), so that I can hold myself to an explicit daily decision.
3. As a trader, I would like to enter closing Marks for my open Instruments as part of the Review, including sessions I skipped, so that I can value my positions on real closing prices.
4. As a trader, I would like to see each open Trade's current P&L, risk to Stop, reward to Target, worst case, and their Plan-R equivalents, so that I can manage risk against the 1R I committed to.
5. As a trader, I would like the app to show a missing or stale Mark plainly instead of a substitute number, so that I can trust every figure it does show.
6. As a trader, I would like to acknowledge when a closing price can't be obtained, so that I can complete the Review honestly without inventing a price.
7. As a trader, I would like to resume an unfinished Review, so that I can keep every session reviewed without starting over.

**Capability set.**

- *Session policy and Marks:* the U.S. session policy sets the Expected Mark Date and the latest Review Date (decision 25). Manual Marks are entered in the Review's Marks task: initial entry, correction with a reason, acknowledging an unavailable Mark, and withdrawing that acknowledgment. Mark resolution is Available, Missing (with optional Stale context), or Acknowledged Unavailable.
- *Current figures:* each open Trade shows Mark-to-Market valuation, Ongoing Risk to Stop, Worst-Case Ongoing Risk, Incremental Reward to Target, Maximum Incremental Reward (Unbounded for Long Stock), Plan-R conversions, per-condition Stop and Target status, and Overrun. Each has its own availability. When evidence is missing or later than the Mark, a dated last-close line and an at-entry line appear instead of a substitute (decision 26). These figures appear on the Open list, on Trade Detail, and in the Review.
- *The Review:* it opens on `LatestCompleted` only (decision 27). Eligibility is "Open at the session cutoff" under current facts. Task families run in this order: the Review Date's Missing Marks (with skipped sessions listed as optional, nonblocking gaps), then the attention-ranked Trade walk, using transparent attention bands and reasons. The Daily Trade Review Action form preselects Hold as unsaved view state. Exit, Roll, and Adjust require Intent and record intent only. Completion is derived as Complete, Complete with Unavailable Marks, or Incomplete, and resumes from facts.

**Introduces**

- *Operations:*
  - Market Data: `save` (initial Manual Mark, correction of a believed-wrong Mark, assert unavailable, withdraw acknowledgment), `query` (`ResolveFrames`, `ExpectedSnapshot`), and `recover` without a provider adapter.
  - Trade Analysis: `derive` at an economic cutoff; `evaluate`.
  - Trade Record: `queryRecords` (`StateAtEconomicCutoff`).
  - Journal: obligation keying for (Trade, Review Date) and edit-by-expected-revision for Action retries.
  - Daily Review: `open` (`LatestCompleted`), `getTrade`, and `save` (`SaveTradeAction`).
  - Trade Views and Reporting: current evaluation for the Open list and Detail.
- *Mechanisms:*
  - The rule-based NYSE session policy (holidays, one-off closures, early closes) with a versioned identity, a 30-minute completion buffer, and an explicit diagnostic for dates outside coverage.
  - `MarketDataSnapshotId` with evidence digests, and `ExpectedSnapshot` checks at Save.
  - The attention-band ordering, with pressure as the share of the planned range travelled since entry (decision 49, which also settles the boundary between quantified pressure and routine).
  - Derived completion.
- *Seeds:* Journal: the Daily Trade Review definition and the Daily Review Source.
- *Durable representation:* schema change adding Market Data observation records (Mark revision chains and Unavailable Mark Acknowledgment history), the session-policy compatibility metadata, each Trade's exposure start, and Daily Trade Review obligation keys.

**Acceptance**

- AC-MARK-001 — full.
- AC-REV-003 — full.
- AC-JOUR-001 — full.
- AC-REV-001 — partial (Open-at-cutoff eligibility for the latest session). Declared scope: Trades closed after the cutoff are added in D6; exact-date open and restatement after correction are completed in D15.
- AC-REV-002 — partial (Marks, then Trades). Declared scope: due reflections in each Trade's card are added in D5 (decision 29), and the settlement family in D7.
- AC-REV-005 — partial (Mark, acknowledgment, Trade fact, existing Action). Declared scope: correction is completed in D15, and changed Daily Bars in D11.
- AC-REV-006 — partial. Declared scope: due Debt is completed in D5, settlement in D7, a Voided Action in D13, and fact correction in D15.
- AC-MARK-003 — partial. Declared scope: "provider error never creates acknowledgment" is completed in D11.
- AC-MARK-004 — partial (historical gaps visible and nonblocking in the Review). Declared scope: series and replay in D9, Daily Bars in D11.
- AC-MARK-005 — partial (recovery without a provider). Declared scope: provider behavior is completed in D11.
- AC-CALC-001 — partial (current risk uses the remaining Position and effective management). Found in the D2 clause-level check.
- AC-CALC-002 — partial (single-Instrument Missing Mark). Declared scope: the multi-Instrument case is completed in D10.
- AC-CALC-003 — partial (underlying-price conditions). Declared scope: structure-value conditions are added in D7S for single-leg options (decision 89) and in D10 for structures, and the "revision is not a Deviation" case completes it in D17.
- AC-JOUR-005 — partial (Daily Trade Review retries keep one Entry identity).
- AC-JOUR-007 — partial (Daily Trade Review and its Source).
- AC-REST-004 — partial (re-proven for the schema-3 migration).

**Parallelism.** The session policy and Market Data work, the `evaluate` arithmetic, and the Trade Record and Journal work are independent until Daily Review and Trade Views join them. The UI can build against fixed frame, evaluation, Review, and Action read models.

---

## D5 — Deferred reflection and Journal Debt

**Stories**

1. As a trader, I would like to defer a Position Change Reflection when I record the fills, so that I can capture facts quickly and reflect when I have time.
2. As a trader, I would like Daily Review to show my due reflections and let me answer or decline them there, so that I can keep my journal complete without hunting for what I owe.

**Capability set.** Defer on Position Change Reflection creates Debt that snapshots the exact definition shown at the time. It falls due one session after the session it belongs to (decision 28). In Daily Review, each Trade's card shows its owed reflections, and due ones keep the Review Incomplete (decision 29). An owed reflection can be answered against its original snapshot, which settles it, or explicitly declined, in the Review or on Trade Detail. Debt status appears on Trade Detail. The entry form keeps Reflect now preselected.

**Introduces**

- *Operations:*
  - Journal: Defer outcome; `save` (Journal-only Debt resolution: answer or decline); `query` (Outstanding Debt, Debt in the Trade narrative).
  - Daily Review: owed reflections in `open` and `getTrade`; `save` (`ResolveReviewDebt`). `getDebt` is not installed (decision 29).
  - Market Data: the previous session's close in frames.
- *Mechanisms:* due classification against session closes; the one-outcome-per-obligation-key invariant.
- *Seeds:* Journal: the Trade Detail Source (seed manifest v4).
- *Durable representation:* schema change adding Journal Debt with its version history and the settlement link.

**Acceptance**

- AC-JOUR-003 — full.
- AC-JOUR-005 — partial. Declared scope: Void reopening Debt is completed in D13.
- AC-REV-002 — partial (Marks, then Trades with due reflections in each Trade's card; decision 29).
- AC-REV-006 — partial (due Debt).
- AC-JOUR-004 — partial (Debt answered against its snapshot, proven with a disclosed fixture revision). Declared scope: completed through `reviseDefinition` in D26. Found in the D5 clause-level check.
- AC-JOUR-007 — partial (the Trade Detail Source).
- AC-REST-004 — partial (re-proven for the schema-4 migration).

**Parallelism.** The Debt store and obligation invariant, and the Review and Trade Detail reflection UI, proceed in parallel once the Debt projection and the `ResolveDebt` command are fixed.

---

## D5R — Review redesign: one card per position

Added by decision 61 (revision 20). The breakdown, [D05R](D05R-review-redesign.md), holds the stories, decisions P36–P41, assumptions A150–A163 and the task graph.

**Stories.** Six, in section 1.1 of the breakdown: position cards opened in place; a card's Marks grouped and saved together; reflections grouped by day; a Stop-to-Target slider; risk and Reward : risk in the open card; the next position, keyboard and phone.

**Introduces**

- *Operations:*
  - Market Data: `prepareEffects` and `applyPreparedEffects` (internal); `save` rebuilt on them.
  - Trade Analysis: Reward : risk now in `evaluate`.
  - Daily Review: range positions and gap-group Trades in `open`; the Plan baseline in `getTrade`; `save` (`SaveReviewMarks`).
- *UI:* the card list, the slider, the Marks, Reflections and Action panels, and the open-card figures. The Marks family view and Continue to Trades are retired.
- *Durable representation:* none.

**Acceptance.** No new row. AC-REV-002, AC-REV-003, AC-REV-005, AC-REV-006, AC-MARK-004, AC-RESP-001, AC-JOUR-001, AC-UI-001, AC-UI-002, AC-DEL-001, AC-DEL-006 and AC-PERF-001 are re-proven on the new screen (section 8 of the breakdown).

---

## D5R2 — Review card progress

Added by decision 69 (revision 28). The breakdown, [D05R2](D05R2-review-card-progress.md), holds the decisions P42–P54, assumptions A164–A176 and the task graph.

**Stories.** No trader story. There are four developer stories, in section 1.1 of the breakdown: a card's progress comes from the coordinator, there is one due rule, one pure module folds every result into the Review the screen holds, and each module stages its own bindings.

**Introduces**

- *Operations:* no facade operation. Market Data gains an internal `bindEvidence`, and Journal's `applyPreparedEffects` binds its counter. Daily Review's `open`, `getTrade` and `save` results carry a card progress record. Daily Review and Trade Views classify Debt through a domain module, `src/domain/journal-debt/`.
- *UI:* the cards and panels word the progress record and count nothing. One pure module folds every result into the held Review, keeps each Mark key's standing, and picks the next card. One due-classification formatter is shared by the Review and Trade Detail. A Reflections panel with nothing owed reads "None" instead of "Resolved".
- *Durable representation:* none. Journal's due-rule type moves to the domain module, and stored data is unchanged.

**Acceptance.** No new row. AC-REV-002, AC-REV-006, AC-RESP-001, AC-UI-001, AC-UI-002 and AC-PERF-001 are re-proven (section 8 of the breakdown).

---

## D6 prefactor — A leaner browser suite

Added by decision 71 (revision 30). The breakdown, [D06-prefactor-browser-tests.md](D06-prefactor-browser-tests.md), holds the decisions P55–P62, assumptions A177–A180 and the task graph.

**Stories.** No trader story. The developer story is that the run after each task tests what the task can affect, in about 1 minute instead of 7.4. The full suite still runs whenever a task can affect earlier deliverables' screens, persistence or the browser harness, and before every critic.

**Introduces**

- *Operations:* none. No file under `src/` changes.
- *Tests and tooling:* the `@every-task` and `@release-history` tags, `npm run test:e2e:release-history`, `full-suite.sh`'s `browser-task` and `browser-auto` stages, 17 collapsed `ui-alignment` tests, B1.5's two fault sets, and T2.55-B3's removal.
- *Durable representation:* none.

**Acceptance.** No new row, and no row changes status (decision 71).

---

## D6 — Close a Long Stock position

**Stories**

1. As a trader, I would like to record partial and final exits, so that I can see exactly realized P&L under FIFO with fees counted once.
2. As a trader, I would like to give one Close Reason when I close a Trade by choice, so that I can later study why my trades end.
3. As a trader, I would like to complete, defer, or decline a Close Review when a Trade closes, so that I can capture the lesson without blocking the close.

**Capability set.** This adds exposure-reducing and closing Position Changes: FIFO Lot Matches, lot-aware fee allocation, and realized P&L, with Realized R shown where 1R exists. The first reduction cuts off the Entry Resolution Point, which resolves Entry Size shortfall. Lot Matches are derived, never stored (decision 30). A Sell may not exceed the open quantity at its time, leave the Position flat before later fills, or be recorded on a Closed Trade. The Trade moves from Open to Closed. Terminal Disposition is shown and kept separate from Close Reason, which is required only with trader agency. Close Review can be completed, deferred, or declined, with Reflect now preselected for it and for the exit's own reflection. There is a Closed Trade list. In Daily Review, a Trade closed after the cutoff stays in the walk, every Trade outside the walk with an owed reflection gets a card after it (due or not yet due), and the Exit Action links to recording the exit.

**Introduces**

- *Operations:*
  - Trade Workflows: `recordPositionChange` (reduce and close), with Close Reason and Close Review dispositions.
  - Trade Analysis: derived FIFO matching, disposal fee allocation, realized P&L, Realized R, Terminal Disposition, Entry Size shortfall; `evaluate` with realized-to-date.
  - Trade Record: Close Reason facts, Closed lifecycle index, `queryRecords` (`CurrentState` Closed; `StateAtEconomicCutoff` including Trades closed after the cutoff).
  - Reference Catalog: `query` and `resolve` for Close Reasons.
  - Journal: Close Review (Complete, Decline, Defer) and resolution of Close Review Debt.
  - Daily Review: the owed-reflection group after the walk (`getDebt` stays uninstalled).
  - Trade Views and Reporting: Closed list and Detail.
- *Mechanisms:* derived Lot Matches (decision 30); the Closed index by Terminal Time.
- *Seeds:*
  - Catalog (seed manifest v2): Close Reasons Target Reached, Stop Triggered, Thesis Invalidated, and Time-Based Exit. Rolled waits for D21.
  - Journal (seed manifest v5): the Close Review definition and the Trade Close Source.
- *Durable representation:* schema change (version 5) adding Close Reason facts, each Trade's terminal time with its index, and the Close Review obligation key. No Lot-Match record (decision 30).

**Acceptance**

- AC-POS-001 — full.
- AC-LIFE-001 — full.
- AC-POS-004 — partial (trader-directed exit). Declared scope: non-agency settlement is completed in D7.
- AC-POS-005 — partial (Entry Size shortfall). Declared scope: Not Entered is completed in D10.
- AC-REV-001 — partial (a Trade closed after the cutoff stays eligible, for the latest session).
- AC-REV-006 — partial (due Close Review on a Trade outside the walk).
- AC-CALC-002 — partial (realized-to-date stays a Value beside a Missing Mark).
- AC-LIFE-003 — partial (Closed lifecycle agreement; the Lot-Match case is reopened by decision 30).
- AC-JOUR-005, AC-JOUR-007, AC-REF-001 — partial (Close Review key and definition, Trade Close Source, four Close Reasons).
- AC-REST-004 — partial (re-proven for the schema-5 migration).

**Parallelism.** Once the close command and Closed Detail read model are fixed, FIFO and fee arithmetic, lifecycle and disposition derivation, and the exit/Close Review UI proceed in parallel.

---

## D7 prefactor — One Calculation Result throughout

Added by decision 77 (revision 42). The breakdown, [D07-prefactor-calculation-results.md](D07-prefactor-calculation-results.md), holds the decisions P63–P76, assumptions A181–A188 and the task graph.

**Stories.** No trader story. The developer story is that every reason a figure has no number is one typed case of the Calculation Result, carried unchanged to every screen and worded once, so a new reason is one type change and one wording change.

**Introduces**

- *Operations:* no facade operation. `src/domain/calculation-result/` (the Calculation Result and its two reason unions) and `src/domain/instrument/` (`instrumentKey`, `instrumentOf`). Daily Review's pressure, range position and risk and reward become Calculation Results, and findings for facts that can't be replayed describe themselves.
- *UI:* one wording module, `src/ui/calculation-words.ts`, at three lengths, with the texts approved in section 1.4 of the breakdown. "Facts can't be replayed" replaces "Records disagree" for facts that can't be replayed.
- *Tests and tooling:* `npm run verify:wording`; `e2e/d7p/layout.spec.ts` at 320 and 375 px.
- *Durable representation:* none.

**Acceptance.** No new row, and no row changes status. AC-CALC-002, AC-LIFE-003, AC-REV-002, AC-REV-006, AC-UI-001, AC-UI-002 and AC-RESP-001 are re-proven (section 7 of the breakdown).

---

## D7 — Single-leg options: happy path

**Stories**

1. As a trader, I would like to plan and trade Long Calls, Long Puts, and Cash-Secured Puts on exact contracts, recording whether I intend to exercise, so that I can journal my option trades with the same discipline as stock.
2. As a trader, I would like to see planned and current expiration payoff, including breakevens and maximum profit and loss, so that I can understand what each option position can do by expiration.
3. As a trader, I would like Daily Review to tell me when an option needs a settlement outcome and let me record its Expiration explicitly, so that I can close out expired contracts truthfully.

**Capability set.** The happy path for single-leg options covers:

- *Instruments and Plans:* option Instruments (Underlying, expiration, strike, right, multiplier 100) and exact-contract Planned Legs. An underlying-price Stop and Target are measured by the contract's value at expiration at their trigger prices, which freezes the Stop's monetary loss boundary (decision 31). Exercise Intent is captured for long options now, because D20 needs it.
- *Trading:* opening, scaling, and closing through Executions, reusing D2 and D6.
- *Marks and risk:* option Manual Marks (a Mark may be 0, decision 32) and ongoing risk/reward, with condition status from the Underlying's Mark.
- *Payoff:* independent Planned and Current Expiration Payoff, with exact zero sets, signed extrema, and attainment sets, and the position's value at expiration at the Underlying's latest close (decision 31).
- *Settlement:* Settlement Due from the expiration date's session, in Daily Review (each card's Settlement panel and the overview's blockers list, decision 87) and on Trade Detail, and explicit Expiration as a no-agency settlement Position Change at the expiration session's close, with no Close Reason and Terminal Disposition of Expiration. An Expiration that closes the Trade still creates a Close Review obligation.
- *Reporting fact:* Option Disposition Timing is derived and shown on Closed option Trades.

**Introduces**

- *Operations:*
  - Trade Analysis: `assessPlan` for single-leg options; `expirationPayoff`; Option Disposition Timing.
  - Trade Workflows: `recordPositionChange` with an Expiration settlement member.
  - Daily Review: settlement task family.
- *Mechanisms:* option `InstrumentKey`, and exact rational payoff arithmetic.
- *Seeds:* Catalog: the Long Call, Long Put, and Cash-Secured Put Strategies.
- *Durable representation:* schema change adding option Instruments, Exercise Intent, and Expiration settlement facts.

**Acceptance**

- AC-SET-003 — full.
- AC-POS-004 — full.
- AC-REV-002 — full.
- AC-CALC-004 — partial (single-leg and stock-only Not Applicable). Declared scope: multiple expirations are completed in D10.
- AC-PLAN-001 — partial (exact contracts). Declared scope: objective selection criteria are completed in D10.
- AC-CALC-003 — partial (underlying-price conditions on options, measured by decision 31).
- AC-CALC-002 — partial (an option Trade whose Underlying Mark is Missing keeps its valuation).
- AC-REF-001 — partial (the Long Call, Long Put, and Cash-Secured Put seeds).
- AC-REST-004 — partial (re-proven for the schema-6 migration).

**Known limitation until D20 (accepted, decision 10).** An assigned Cash-Secured Put, or an exercised long option, can't be recorded until Assignment and Exercise land in D20. Settlement Due for that contract stays open, which keeps that Review date Incomplete, and the app says why.

**Parallelism.** Payoff arithmetic, the option Plan form, and the Settlement Due task family can proceed in parallel once the option Plan facts and payoff read model are fixed.

---

## D7S prefactor — One Mark-to-Market Valuation

Added by decision 101 (revision 72). The breakdown, [D07S-prefactor-mark-to-market-valuation.md](D07S-prefactor-mark-to-market-valuation.md), holds the decisions P77–P89, assumptions A189–A194 and the task graph. It runs after D7 and before D7S's breakdown is drafted.

**Stories.** No trader story, except that the Review card shows an option Trade's dated line as the Trades list and Detail do. The developer story is that one module values a Trade on one date for both coordinators, with the date settled once and the expiration rules written once, so D7S, D9, D10 and D11 build on one valuation.

**Introduces**

- *Operations:* Market Data's `openReadSession(context)`, a read session per coordinator operation that reads each date and Instrument once (decision 101; `specs/design/market-data.md` amended). Mark-to-Market Valuation in `src/coordinators/valuation/`, one Trade per call. `derive`'s contract status (`Live`, `DueToday`, `PastExpiration`); `expiredOn` and `settlementDueOn` in `src/domain/instrument/`.
- *UI:* the option dated line on the Review card, through the existing figure group.
- *Tests and tooling:* an ESLint rule against comparing a date with a contract expiration outside the Instrument module; `tests/integration/d7sp/review-query-count.test.ts` (decision 102); `e2e/d7sp/review-dated-line.spec.ts`; the trims of tech debt item 4 and of the coordinator cases the module covers.
- *Durable representation:* none.

**Acceptance.** No new row, and no row changes status. AC-PERF-001, AC-CALC-002, AC-REV-002 and AC-REV-006 are re-proven (section 7 of the breakdown).

---

## D7S — Option-price Stops and Targets

Added by decision 89 (revision 54). The breakdown is drafted after D7's tag, following `.claude/docs/drafting-breakdowns.md`. **Amended by decision 101 (revision 72):** drafted after the D7S prefactor's tag, `claude-opus-5.5-d7sp`, against its Mark-to-Market Valuation; numbering starts at P90, A195 and decision 107 (decisions 103 to 106 taken by revisions 73 to 76). **Breakdown agreed by decision 107 (revision 78, 2026-11-11):** [D07S-option-price-stops-and-targets.md](D07S-option-price-stops-and-targets.md) holds P90–P93, A195–A205, the approved words and 17 tasks. **Amended by decision 108 (revision 80):** T7S.3 runs straight after T7S.1, and T7S.2 after T7S.3. The next plan decision is 109.

**Stories**

1. As a trader, I would like to set a Stop or Target on the option's own price, such as buying back a Cash-Secured Put if it trades at 3.60, alone or together with an Underlying-price one, so that my Plan says what I would actually do.

**Capability set.**

- *Plans:* structure-value (option-price) Stops and Targets on single-leg option Plans, holding a price of the contract itself. They combine with underlying-price conditions as independent OR conditions, so an option Plan may hold more than one Stop or Target; D7's "exactly one" (A100) lifts.
- *Measurement:* a structure-value condition is measured directly from its price (quantity × multiplier × the price difference), with no expiration modelling; 1R, Original Planned Reward, the headline nearest boundary, Ongoing Risk to Stop, Reward to Target, Overrun, Entry Quality and Daily Review's pressure use it.
- *Evaluation:* a structure-value condition is crossed by the contract's exact Mark; underlying-price conditions keep decision 31.
- *UI:* the Plan form offers the condition kind for each Stop and Target; Detail, the Review card and the lists show every condition.

**Introduces**

- *Operations:* Trade Analysis: structure-value conditions in `assessPlan` and `evaluate` for single legs.
- *Durable representation:* schema 7 adds the structure-value condition kind, with the `v6→v7` migration and its fixtures.

**Acceptance**

- AC-CALC-003 — partial (structure-value conditions on single-leg options, with one crossed Stop and one reached Target at once). Declared scope: structures in D10, revision in D17.

---

## D08P — The Trade Detail cockpit

Added by decision 110 (revision 84). The breakdown, [D08P-trade-detail-cockpit.md](D08P-trade-detail-cockpit.md), holds:
- the decisions P94–P102;
- the assumptions A206–A224;
- the approved words W1–W20;
- 26 tasks in three waves with lanes, run under decision 111, plus T8P.27 (revision 85), which removes the old Detail sections after T8P.22.

It runs after D7S and before D8, as the D8 prefactor.

**Stories.** Trade Detail is rebuilt as the cockpit the user chose in `prototypes/trade-detail/index.html` ("C. Cockpit"):
- a rail that always shows the state of play: the identity, Trade P&L and its change, every condition, and what needs the trader;
- drawers for the detail: Today, Position, Plan and Risk, Price History, Journal and Payoff.

The only new trader-facing views are the history ones. Price History and the Journal's session cards show each earlier session's Marks and Trade P&L, with gaps shown as gaps.

**Introduces**

- *Operations:*
  - Market Data: `query` `ReadSeries`, and the read session's `series`.
  - Trade Analysis: a slice of `replay` (Position, and realized and marked P&L, per completed session); `ConditionStatus.nearest`.
  - Trade Views: `replayTrade`; `ContractExpiration.days`.
  - Trade Workflows: `confirmPlan`'s post-commit expiration line.
- *UI:* the cockpit, as presentational components in `src/ui/cockpit/`.
- *Tests and tooling:*
  - the swarm tooling (decision 111);
  - the drawer-reach helpers for the earlier browser cases;
  - an ESLint rule that keeps the cockpit's components presentational;
  - `tests/integration/d8p/` and `e2e/d8p/`.
- *Durable representation:* none.

**Acceptance.** AC-MARK-004 gains a partial claim: series and replay keep explicit gaps, and Price History shows them. AC-RESP-001, AC-PERF-001, AC-CAP-001, AC-UI-001 and AC-UI-002 are re-proven (section 13 of the breakdown).

---

## D8 — Backup and Restore

**Stories**

1. As a trader, I would like to download a backup and then verify the saved file, so that I can know I really have a good copy of my journal.
2. As a trader, I would like to restore a backup on this or another device after seeing exactly what it will replace, so that I can recover from loss or move my journal deliberately.
3. As a trader, I would like to keep reading and backing up my journal when the browser can no longer write safely, so that a storage problem never traps my data.

**Capability set.**

- *Backup:* full backup export of one snapshot as a file download (Downloaded, with no receipt), and read-back verification that issues a `CompletedBackupReceipt`.
- *Restore preparation:* treats the artifact as untrusted and is nonmutating. It verifies digests and versions, validates every module section, rederives lifecycle and Deviation agreement (Lot Matches are derived, decision 30), migrates supported older versions, and discloses repairs.
- *Restore application:* a replace-only atomic apply with an exact-target safety receipt or an explicit decline, followed by rerunning readiness. Preparation builds the complete candidate and needs `Writable` readiness (decision 34). Restore is offered on the Backup page and on the first-run screen; a safety choice is required only when user data exists (decision 37).
- *Blocked databases:* a Migration Blocked or `AwaitingMigration` journal can be downloaded as a copy at its own schema version; only Migration Blocked can verify it (decision 36).
- *Recovery Only:* gains backup export and verification.
- *Warnings:* the not-protected warning now recommends a backup.
- *Coverage:* backup and Restore cover everything delivered so far, including stock and single-leg option Trades.

**Introduces**

- *Operations:*
  - Workspace: `exportBackup`, `confirmBackup`, `prepareRestore`, and `applyPreparedRestore`.
  - Every fact module: `exportSnapshot`, `prepareRestore`, and `applyPreparedRestore`.
- *Mechanisms:* the streamed canonical-JSON-lines artifact with section and full SHA-256 digests, built in a worker inside one read-only transaction (decision 33); content version equal to the schema version (decision 35); the Workspace Backup Manifest; `zod` parsing of untrusted input; reuse of the candidate-database Restore path; the benchmark dataset loaded through a real Restore.
- *Seeds:* none.
- *Durable representation:* backup artifact format v1. This is portable and stores nothing in the Workspace, so the Workspace schema does not change.

**Acceptance**

- AC-REST-001 — partial (cumulative, decision 38). Declared scope: provider non-contact is re-proven in D11, and each data-adding deliverable extends the round trip.
- AC-REST-002 — full.
- AC-REST-003 — full.
- AC-REST-004 — full.
- AC-DEL-005 — full.
- AC-LIFE-003 — partial (Restore branch for lifecycle, including Closed Trades, and Entry Size). Declared scope: D10 and D12 add their agreed record kinds; full in D12 (decision 38).
- AC-BACK-001 — partial (cumulative, decision 38). Declared scope: the provider credential exclusion arrives in D11, and corrections, Voids, Daily Bars, revised definitions, and reference changes in their deliverables.
- AC-DEL-006, AC-REBUILD-001 — cumulative (the after-Restore readiness boundary; Restore as the reconstruction path).

**Parallelism.** Each module's section export and prepare can be built in parallel once the artifact envelope is fixed. The Restore preview and confirmation UI proceeds against the fixed preview model.

---

## D8R — The Trade Detail refactor

Added by decision 115 (revision 104). The breakdown, [D08R-trade-detail-refactor.md](D08R-trade-detail-refactor.md), holds:
- the decisions P108–P116 and the six answered questions;
- the assumptions A230–A246;
- the approved words W21–W34, with W1 and W28 amended;
- 28 tasks in three waves and eleven lanes, run under decision 111 with an agent cap of six.

It runs after D8 and before D9. D9 doesn't start until D8R is done.

**Stories.** It carries out the Trade Detail audit (`research/trade-detail-audit.html`), so each part of the page shows each thing once, where the trader looks for it:
- Today becomes one Marks table (Today, Yesterday, Change) on every Trade with a Position, Settlement Due and Closed Trades included;
- the rail shows each condition's distance to its trigger, and the latest dated P&L when today's isn't in;
- Plan and Risk holds every risk and reward figure, "Since the last Marks", Planned-Leg Fulfillment and Deviations;
- Position names each contract; Journal entries become one dated line; Price History shows each Mark's source and correction;
- every contract is named in the broker style, and the before-Marks figures name the session that brings the Marks.

**Introduces**

- *Operations:*
  - Market Data: the read session's `previousSessionDate` and `exchangeDate`.
  - Trade Analysis: `ConditionReading.trigger`; `AwaitingClose.due`; `ConditionStatus.nearest` removed.
  - Trade Views: the Detail's `marksColumns`, `settlementUnderlying` and `openAverage`.
- *UI:* the reworked cockpit drawers and rail; contract names in `instrumentLabel` and the Trade Summary line.
- *Tests:* `tests/integration/d8r/` and `e2e/d8r/`.
- *Durable representation:* none. The five backup fixtures' expected views lose their `nearest` lines (decision 115 (3)).

**Acceptance.** No new claim. AC-CALC-003, AC-MARK-003, AC-MARK-004, AC-PERF-001, AC-UI-001 and AC-UI-002 are re-proven (section 13 of the breakdown).

---

## D9 — Trade replay

**Stories**

1. As a trader, I would like to see a stock or option Trade's session-by-session history of marked P&L, Position, Stops, Targets, and events, with gaps shown as gaps, so that I can review how a Trade really unfolded.

**Capability set.** The replay derives its own lifetime for a Trade: from first exposure to the current Expected Mark Date for Open Trades, or to the final session for Closed Trades. It shows Position Change and settlement markers, close-only Mark points, explicit gaps, and calculated tracks for realized and marked P&L and Stop and Target status. A textual or tabular equivalent accompanies the chart, and audit navigation is available. It accepts no user range, does no interpolation, and is kept separate from Expiration Payoff. Planned and Abandoned Trades are Not Applicable.

**Introduces**

- *Operations:*
  - Trade Analysis: `replay` (Positions, results, and condition status per frame).
  - Market Data: `query` (`ReadSeries`).
  - Trade Views and Reporting: `replayTrade`.
- *Mechanisms:* the accessible SVG replay chart.
- *Seeds:* none.
- *Durable representation:* none.

**Acceptance**

- AC-MARK-004 — partial (points and gaps). Declared scope: Daily Bar candles are completed in D11.

**Amended by decision 110 (revision 84).** D08P builds a slice of `ReadSeries`, `replay` and `replayTrade` (A210–A213 of its breakdown), and shares AC-MARK-004's partial claim for the read and for Price History. D9 extends the same three operations with:
- condition status per session;
- Position Change and settlement markers;
- the chart and its text equivalent;
- audit navigation.

**Amended by decision 117 (revision 106).** The breakdown is [D09-trade-replay.md](D09-trade-replay.md): 40 tasks in three stages, each with its own session, suites and fresh critic.
- **Stage A, the replay chart** (a swarm): Corridor, in a Replay drawer on Trade Detail and in the Review card before the Action (D9A-R: both open the replay as an overlay). `evaluate` gains the Trade's result at each boundary and its standing. `DailyReview.getTrade` returns the replay to the Review Date.
- **Stage B, the option estimates** (serial): implied volatility, the Share Equivalent and the Mark Change Split, as labelled Estimates from a separate pure module. They amend ADR 0007 and add AC-CALC-005. The rates are stated on the About page.
- **Stage C, the meter** (serial): the Stop-to-Target meter on Review cards, Open-list rows and Trade Detail; the Open list's default order becomes the Review's attention order; `rangePosition` is removed.
- *Acceptance, added:* AC-CALC-005, partial (single-leg options; per-leg estimates on multi-leg Trades in D10). AC-CALC-003, AC-CAP-001, AC-PERF-001, AC-UI-001, AC-UI-002 and AC-DEL-001 are re-proven (section 13 of the breakdown).
- *Durable representation:* none. Eight frozen fixtures' expected views lose their `rangePosition` entries.
- *Scope:* stock and single options. Spreads wait for D10, Daily Bar candles for D11.

**Parallelism.** The `replay` arithmetic, the series read assembly, and the chart UI proceed in parallel once `TradeReplayView` is fixed.

---

## D9A-R — D9 Stage A Refactor

Added by decision 118 (revision 107). The breakdown, [D09A-R-stage-a-refactor.md](D09A-R-stage-a-refactor.md), holds:
- the user's eight decisions on the coach review of the built replay (`plan/D09A-R-decisions.md`), the proposals P139–P153 and the five answered questions;
- the assumptions A266–A287;
- the approved words W53–W70;
- 24 tasks, run in lanes under decision 111 with an agent cap of 4.

It runs after D9's stage A and before its stage B. D9's stage B doesn't start until D9A-R is done.

**Stories.** It reworks the replay as built, so it reads at a glance:
- the replay opens as an overlay of the whole page, from Trade Detail and from a "Replay" button on the Review card;
- the readout's stake is a grid: from here, in R, and where the Trade would end;
- the Plan stands beside what happened: the Plan's terms, each fill against the Plan, and each condition's first crossing;
- reward to risk carries the estimated odds (the No-Edge Odds);
- session cards, paged and synced with the slider, replace the table;
- one name per figure across the replay and the Review card's summary.

**Introduces**

- *Operations:*
  - Trade Analysis: `evaluate` gains the No-Edge Odds, the Plan's odds and the extremes' weight; `replay` gains the Plan's terms, each fill against the Plan and each condition's first crossing.
- *UI:* the Replay overlay (`replay=open` in the address); the session cards; the readout's stake grid.
- *Tests:* `tests/integration/d9ar/` and `e2e/d9ar/`.
- *Durable representation:* none.

**Acceptance.** No new claim. AC-CALC-003, AC-MARK-004, AC-JOUR-001, AC-REV-003, AC-CAP-001, AC-PERF-001, AC-UI-001, AC-UI-002 and AC-DEL-001 are re-proven (section 13 of the breakdown). A light gate with no benchmark (A285).

---

## D9R2 — The Review's Marks grid

Added by decision 123 (revision 112). The breakdown, [D09R2-review-marks-grid.md](D09R2-review-marks-grid.md), holds:
- the user's decisions (one save for several sessions' Marks; the grid first, then the coach review; the research page's settled answers), the proposals P154–P162 and the three answered questions;
- the assumptions A288–A299;
- the approved words W71–W81;
- 17 tasks, run one at a time.

It runs after D9 and before the coach review of the Review page (`evidence/D09/coach-review-2-prompt.md`), whose answers decide the rest of the Review's restyle.

**Stories.** The trader enters several sessions' Marks at once:
- each Trade's Marks panel is a grid like Price History: a row per Instrument, a column per session, the Review Date and the previous session always, then each earlier session missing a Mark;
- a price typed in one Trade shows "Unsaved" in every Trade holding the Instrument, and one Save Marks saves every draft;
- one cell editor under the grid holds "Can't get a price", Correct and Withdraw;
- on a phone the grid turns, sessions as rows;
- Price History and the Journal show an acknowledged session as "Acknowledged Unavailable", and the Review card's dated heading says "At the … Marks".

**Introduces**

- *Operations:* none. Daily Review's `open` gains `previousSession` and `earlierMarks` on the Marks family; Market Data's series points gain `resolutionRevision`. Both are additive.
- *UI:* the Review's Marks grid and its cell editor; the shared session grid under `src/ui/cockpit/`.
- *Tests:* `tests/integration/d9r2/` and `e2e/d9r2/`.
- *Durable representation:* none.

**Acceptance.** No new claim. AC-MARK-004, AC-REV-002, AC-RESP-001, AC-REV-005, AC-MARK-003, AC-REV-006, AC-JOUR-001, AC-UI-001, AC-UI-002 and AC-PERF-001 are re-proven (section 12 of the breakdown). The benchmark runs once, after the gate (decision 114).

---


## D9.5 — The Daily Review redesign

Added by decision 124 (revision 113), approved by the user on 2026-11-22. Its breakdown, [D09.5-daily-review-redesign.md](D09.5-daily-review-redesign.md), was agreed by decision 126 (revision 115): 67 tasks in three parts, each ending in a gate, run one at a time. The breakdown holds the user's points U1 through U21, its decisions P163 through P174, the assumptions A300 through A327 and the approved words W82 through W155. Where this section and the breakdown differ, the notes below marked "decision 126" say what holds. It comes from:
- the coach's second review of the Review page (`evidence/D09/coach-review-2.md`, score 6 of 10, 15 suggestions);
- the coach mockup and its notes (`prototypes/review-coach-mockup/index.html`, `NOTES.md`), with the user's 11 decisions of 2026-11-21;
- the user's twelve drafting answers of 2026-11-22, listed under "Decisions taken while drafting".

It runs after D9R2 and before D10. It takes the Review page from what D9R2 left to everything the mockup shows, at phone and desktop widths.

**Before the breakdown is drafted** (both done)
- Done: a phone prototype, 375 wide, of every new part, agreed by the user on 2026-11-22 as the desktop mockup was. It also draws the Review that follows a "record later".
- Done: the spec changes listed under "Earlier rules this changes" were agreed by the user and made in `specs/` by decision 125 (revision 114). Their text is in [D09.5-spec-changes.md](D09.5-spec-changes.md).

**Stories.** Each one leaves the Review better and usable on its own, in this order.

1. As a trader, I would like the Review to open on a summary of the day with my Trades in order of need, so that I know what is left and where to start.
   - The top card says how many Trades, Marks and Actions are to go, the day's change in Trade P&L, and one line per Trade with its label and what it still needs. One button leads to the next thing to do.
   - The order is: a decision not carried out, then an expired contract, then past the Stop (deepest in R first), then at the Target, then inside the lines by how far along. The Open list follows the same order (decision 117).
   - The labels say what is true in plain words ("Past Stop", "At Target", "63% to Stop", "Marks needed", "Expired: settle"). "Blocker", "Boundary reached", "Evidence limited", "Quantified pressure" and "Routine" leave the screen.
   - The list of every missing item goes. A finished day shows "The day": the day's Trade P&L, what is past a line, what was chosen, what comes due next, any session with no Review, and when the next Review is.
2. As a trader, I would like to enter every Mark for the day in one step at the top of the page, with a far-off price questioned before it is saved, so that the figures I decide on are right.
   - One grid holds every Instrument: the previous session, the Review Date and the change. Skipped sessions are optional columns, added on request.
   - A typed Mark is checked when the cell is left. One that reads as a slip is questioned in place: 10 times too big or small ("$44.00 or $440.00?"), not a price, or zero ("Worth nothing?"). The limits are fixed in D9.5: 5% either way for a stock or an Underlying; 100% up or 50% down for an option. They are stated under the grid.
   - One Save Marks saves the lot. The grid then folds to one line with Edit, the Trades re-sort once, and focus moves to the first Trade.
   - A Mark saved in this Review is fixed in place with no reason asked.
   - No Action can be saved for a Trade until the Review Date's Marks it needs are saved or marked "Can't get a price".
3. As a trader, I would like each Trade's card to show my Plan beside where the Trade stands now, and what I decided at the last Reviews, so that I decide against the Plan and not from memory.
   - The card opens with the last decision and its reason, and names any session with no Review.
   - "Plan": entry, Stop, Target, thesis, "No longer valid if", risk and reward. "Now": the Mark and its change, Trade P&L in dollars and R, Realized and open, what is held, the distance to the Stop and the Target, and the expiration. Everything else sits behind "More figures".
   - The meter prints its key and its sentence; neither is hover-only.
   - **Amended by decision 126 (the breakdown's U3, U4, U5 and U6):** on the Review card the distance to each line is the caption under its arrow, Trade P&L in dollars and R stays in the card's header, and the "Now" drawing shows its key and no printed sentence; the sentence is its accessible name. "More figures" holds only an option's expiration figures. The shared meter is unchanged on other pages (U9).
   - "Your last decisions" sits beside the Action: the last four with the day's P&L and the reason or "no reason given", and a count when the Trade has been held past a line for sessions running.
   - Figure phrases are the ones Trade Detail and the Replay already use (see "Words").
4. As a trader, I would like the Review to say what my Plan calls for and to ask for a reason only when I leave it, so that following the Plan is the easy path.
   - Each card states the Plan's call from its own terms: out when past the Stop or at the Target, hold when inside the lines.
   - Inside the lines Hold is preselected and one Save records it. When the Plan says out, nothing is preselected.
   - A Hold when the Plan says out needs a reason. An Exit when the Plan says out needs none. An Exit before a line is reached needs a reason. Roll and Adjust always need a reason.
   - "What you decided against" and "Note" sit behind "Add more". The form has a Discard.
   - Pressing another Trade with a half-typed Action shows the refusal on the Trade pressed, with "Save it", "Discard it" and "Back to".
5. As a trader, I would like to record a sale in the Review and have it measured against my Plan's exit, so that a decision and its execution stay together and I am asked only about what I did differently.
   - After an Exit is saved the card offers "Record the sale". The form is the Trade's own exit form, shown in the Review; Trade Detail's Record exit shows the same form.
   - The Plan's exit is: all that is held, when the Stop or the Target is reached, without having held past the line first. A sale that follows it asks nothing.
   - A sale that leaves it asks "Why did you leave the Plan?" once. A reason already given on the Exit Action carries to the sale. A part sale always asks "Why only part?".
   - The Plan check replaces "Reflect now", "Reflect later" and "Decline to reflect" for a sale. It is saved as the sale's completed reflection, so nothing is owed later.
   - **Amended by decision 126 ("Say why later"):** a reason never stops a sale being recorded. A sale that leaves the Plan has "Say why later" beside the question; pressing it saves the sale at once, and the question becomes an owed reflection on that Trade's card at the next Review. That reflection cannot be answered without the reason and can still be declined. "Nothing is owed later" holds when the sale follows the Plan or the reason is given at the sale. A reason is asked once, even after several Holds past the Stop (U10).
   - The Review after an Exit that was not carried out says so first, with "I sold: record it" and "Still holding". "Still holding" saves nothing; the Trade's Action for the day is then asked as usual.
   - A sale that closes the Trade puts the Close Review off (story 8).
6. As a trader, I would like to settle an expired contract in the Review, or say I will record an exercise or assignment later, so that expiration day can be finished honestly.
   - An expired contract needs no Action. Its card says whether it ended in or out of the money and by how much.
   - Out of the money: "Record expiration" is the main button, with "Bought it back before the close" or "Sold before the close" beside it, which opens the sale form.
   - In the money: "Exercised: record later" or "Assigned: record later" is the main button. "It expired worthless" is a link that states what it would book and needs a reason.
   - "Record later" lets that one Review finish and creates no Trade fact. The day then reads "Complete, settlement to record" and names the Trades. The next Review asks again.
7. As a trader, I would like the Replay on every card to show what I decided at each Review, so that I can see how my decisions tracked the Trade.
   - Every card, open or closed, has a Replay strip: a small chart, one line saying how the Trade stands, and the Replay button. The strip is more prominent the more pressing the Trade.
   - The Replay opens on the session that teaches most (the first crossing of a line, when there is one).
   - Each session shows "What you did that day": fills, the Action and its reason, or "No Review this session". A row under the chart marks each session's Action.
   - "Key moments" is a drop-down: entry, the worst and best sessions, the first session past the Stop, the Target first reached, each sale, and now or the end.
8. As a trader, I would like to walk a closed Trade's key moments before I write its Close Review, so that the lesson I write comes from what happened.
   - The closed card says how it ended in plain words with the result, and sets the Plan beside what happened. "Lifecycle" and "Terminal Disposition" leave the screen; dates read as dates.
   - "Write the Close Review" opens the Replay with the questions beside it. They unlock once every key moment has been seen; sliding past a moment counts. "Seen" is never saved.
   - "Would you take it again?" and "What is the key lesson?" are required. "What worked, and what did not?" stays optional.
   - The Close Review is always written this way, from the Review or from the Trade page. The exit form no longer offers to write or decline it at the sale.
   - Decline stays possible without the walk, behind a link and a confirm. Declining any owed reflection takes more steps than answering it.
9. As a trader, I would like to get through the whole Review from the keyboard, with focus always on the next thing to do, so that a routine day takes little effort.
   - In the grid: Enter moves to the next cell and then to Save, the arrow keys move, N marks "Can't get a price".
   - After each save, focus lands on the next thing to do. Escape or "Back to the Review" closes an overlay and returns focus to where it was opened.
   - Every story above is proven at phone and desktop widths, with the same information, fields and actions at both.

**Capability set.** The Review becomes three steps on one page: Marks, Trades, the day. Marks are entered once for the whole page and checked for slips. Each Trade's card sets the Plan beside the present, remembers earlier decisions, and judges Hold, Exit and each sale against the Plan's own exit. Whether something follows the Plan is worked out each time from the Plan, the Marks, the Position and the saved Actions; only the trader's reasons are stored. The rules are enforced when saving, not only on screen. A sale and an expiration are recorded from inside the Review through the Trade's own forms. A Review with an exercise or assignment still to record can finish, disclosed as such. The Close Review is written with a walk through the Trade's key moments.

**Introduces**

- *Operations:* no new operation. Existing ones change:
  - Daily Review `open`: the day's summary; the new order and labels; the Plan's call for each Trade; each Trade's last decisions and its count of sessions held past a line; an Exit not carried out; an expired contract's standing and choices; the "Complete, settlement to record" state.
  - Daily Review `getTrade`: the Plan and Now figures; a new Action form's preselection follows the Plan's call; the replay carries each session's Action and reason and the key moments.
  - Daily Review `save`: `SaveTradeAction` refuses an Action while the Trade's Review Date Marks are unresolved, a Hold with no reason when the Plan says out, and accepts an Exit with no reason when the Plan says out; `SaveReviewMarks` saves the whole page's drafts (the limit of 100 from decision 123 stays); a new variant records "settle later" for one Trade and Review Date.
  - Trade Workflows `recordPositionChange`: the operation is unchanged; its contract gains the measure of a sale against the Plan Exit (decision 125). The exit form sends a completed reflection carrying the Plan check, and Defer for the Close Review on every closing sale. **Amended by decision 126:** for a sale the command accepts Complete or Defer for the reflection and refuses Decline; a deferred reflection for a sale that leaves the Plan Exit leaves a Debt that requires the Plan Departure Reason.
  - Trade Analysis: `replay` and `evaluate` supply the Plan's call per session, the Plan check for a sale, and the key moments. Which module joins them to the saved Actions is for the breakdown; Trade Analysis does not read the Journal. **Settled by decision 126:** Daily Review and Trade Workflows read the saved Actions; the measure of a sale is one pure function in `src/domain/plan-exit/`, called by the form and by Trade Workflows (the breakdown's P165, P171 and P172).
  - Trade Views and Reporting: the Open list's order follows; Trade Detail's Record exit and its owed Close Review use the shared forms. **Decision 126:** the Open list makes the Review's one range read of saved Actions, so an Exit not carried out comes first there too (the breakdown's A301).
- *Mechanisms:* the page's Marks step and its slip check with fixed limits, kept in one place so D23 can replace them; the Plan check; the key-moments walk (screen state only); the day's summary.
- *Seeds:* Journal seed manifest version 6, with a new revision of three forms, for future entries only:
  - Daily Trade Review: a protected "settle later" choice, never offered among Hold, Exit, Roll and Adjust; a reason required only for Roll and Adjust (answer 9).
  - Position Change Reflection: carries the "left the Plan", "only part" and "expired worthless" reasons, and may be saved with no answers.
  - Close Review: "What is the key lesson?" required.
- *Durable representation:* no schema change. The seed manifest change is a migration with its frozen fixture and backup fixture. Reflections already owed keep the form they were owed under. **Decision 126:** the schema stays 7 with three optional stored additions: `protected` on a form option, the prompt roles `PlanDepartureReason` and `ExpirationReason`, and `requires` on a Debt (the breakdown's A321).

**Decisions taken while drafting (the user, 2026-11-22)**

1. The Plan check is the sale's reflection, saved complete; one exit form in the Review and on the Trade page. **Amended by decision 126:** the reason may be put off with "Say why later", which saves the sale and leaves the reflection owed.
2. "Follows the Plan" or "leaves the Plan" is worked out each time; only reasons are stored; the rules are enforced on save. No new Deviation category.
3. D9.5 owns "record later", saved as that day's Daily Trade Review entry for the Trade, with the "Complete, settlement to record" state.
4. The slip-check limits are fixed in D9.5. No Settings page and no schema change. The setting moves to D23.
5. A closing sale always puts the Close Review off; it is written with the walk from the Review or the Trade page; "key lesson" becomes required.
6. Phone is in D9.5, with a 375-wide prototype agreed before the breakdown.
7. What is shared with other pages changes everywhere it is shared, and nothing else there changes. Figure phrases already used on Trade Detail or the Replay are kept; a wording changes only when it makes the Review substantially easier to understand.
8. A Mark saved in this Review is fixed with no reason asked: the Review sends the correction with the fixed reason "Fixed in the same Review". "This Review" means a typed Mark for the Review Date, until the next Review opens. Market Data's spec is unchanged.
9. The reason rule for Hold and Exit is enforced by the Review's save. The Daily Trade Review form requires a reason only for Roll and Adjust.
10. The Review may state what the trader's own Plan calls for and what is due, when each line traces to one Plan term or one saved fact. It never gives the app's opinion, a prediction, or a pattern drawn across Trades. No spec text changes; the words step checks every new line against this.
11. The Close Reason is still asked when a sale closes the Trade, with nothing preselected.
12. An expiration is treated as a sale is: it saves a completed reflection, holding the reason only when "It expired worthless" is recorded in the money; its Close Review is put off; the expiration form loses its reflection and Close Review choices in the Review and on the Trade page. The new Position Change Reflection revision must allow a reflection with no answers. **Amended by decision 126:** this holds for an expiration. A sale may also put its reflection off (answer 1's note).

**Earlier rules this changes.** The numbers are those of the mockup notes. "Decision" means a recorded decision is enough; "Both" means a spec change as well. Nothing in `specs/` is edited until the user agrees its exact text.

| # | Change | Needs | Spec sections affected |
|---|---|---|---|
| 1 | Hold is preselected only when the Plan says hold; a Hold when the Plan says out needs a reason; an Exit when the Plan says out needs none. The Review's save enforces it (answer 9) | Both | Daily Review: `getTrade`, "Default Action definition". UI contract: "Forms and evidence capture". Journal: the Daily Trade Review definition. Acceptance: AC-REV-003, AC-JOUR-007 |
| 2 | No Action until the Review Date's Marks are resolved | Both | Daily Review: `save` |
| 3 | Marks leave the card for one grid for the page | Decision (amends decisions 61 and 123) | None; the spec already puts Marks first |
| 4 | A slip is questioned on screen when the cell is left | Decision | None |
| 5 | A Mark saved in this Review is corrected with no reason asked | Decision (answer 8): the Review supplies the fixed reason | None |
| 6 | The Review holds the sale form; the Plan check replaces the sale's reflection choice | Both (amends decision 72) | Journal: the Position Change Reflection definition. Acceptance: AC-JOUR-007. Daily Review's "records intent only" still holds for the Action itself |
| 7 | An expired contract needs no Action | Both | Daily Review: "Completion and resumption". Glossary: Daily Review. Acceptance: AC-REV-006 |
| 8 | A day can be Complete with an exercise or assignment still to record | Both (amends decision 10) | Daily Review: "Settlement Due", "Completion and resumption". Glossary: Settlement Due, Daily Review. Journal: the Daily Trade Review definition. Acceptance: AC-SET-003, AC-REV-006 |
| 9 | "Record expiration" is not the main button in the money; "It expired worthless" there needs a reason; an expiration saves a completed reflection (answer 12) | Both | Journal: the Position Change Reflection definition (the same revision as row 6) |
| 10 | Expiration is settled inside the Review | Decision | None; it is still recorded by the Trade Workflows operation |
| 11 | New order and labels; the cards re-sort only when Marks are saved | Both (amends decisions 49, 64 and 117) | Daily Review: the attention bands and "Within a Review view, order is stable" |
| 12 | The list of every missing item goes | Decision | None; each Trade still shows what it needs |
| 13 | "Plan" and "Now" replace the figure grid; the rest sits behind "More figures" (**decision 126:** "More figures" holds only an option's expiration figures) | Decision | None |
| 14 | The refusal moves to the Trade pressed, with three choices | Decision | None |
| 15 | Declining takes more steps than answering | Decision | None; Decline stays possible |
| 16 | The Close Review needs the walk and a key lesson; a closing sale always puts it off | Both | Journal: the Close Review definition. Acceptance: AC-JOUR-007 |
| 17 | The Replay strip on every card; the Replay shows each Review's Action and reason | Decision (amends decisions 117 and 118) | None |
| 18 | "What you decided against" and "Note" sit behind "Add more" | Decision | None |
| 19 | New screen words | Neither | The breakdown runs every new word through the approved-words step |
| 20 | A setting and a Settings page | Dropped from D9.5 (answer 4) | Workspace: "the only Workspace-wide setting", changed with D23 |
| 21 | Desktop only | Not carried over (answer 6) | None |

**As made in `specs/` (decision 125, revision 114).** The 21 edits are in [D09.5-spec-changes.md](D09.5-spec-changes.md). Where they differ from the table above:
- The glossary gains three entries (Plan Exit, Plan Call, Settle Later) and no existing entry changes, keeping decision 69's rule.
- AC-JOUR-007's text is unchanged: it checks the seeded forms against the Journal contract, which changed.
- AC-REV-002's text changes: due Debt and Settlement Due appear with their Trade, in the attention order.
- Trade Workflows gains one paragraph, the measure of a sale against the Plan Exit.
- The Position Change Reflection's three existing prompts become optional; a buy still shows them, and a sale or expiration keeps them behind "Add more".
- The Action's prompt is renamed "Why?", with the situation stated on a line above it; a sale has one prompt, "Why did you leave the Plan?".
- When a Mark is acknowledged Unavailable the Plan Call is `Unknown`: nothing is preselected, a Hold needs no reason and an Exit needs one. This was drafted as an assumption and applied as written.

**Words.** One wording for each figure, shared by the Review, Trade Detail and the Replay. The existing phrases stay unless the breakdown shows a substantial gain. **Amended by decision 126:** the distance, "From here" and odds phrases are not on the Review card (the breakdown's U5 and U8); they stay on Trade Detail and the Replay. The approved words are the breakdown's W82 through W155.
- distance to a line: "$1.80 away", "Breached · $3.00 past" (the mockup has "AXIO $3.00 below the Stop · $300.00 past it");
- past a line in dollars and R: "Past the Stop by $300.00 (0.50R)";
- what is at stake: "From here: $352.00 at risk to the Stop · $912.00 more to the Target", with reward to risk and odds as "11.69 to 1 · about 8% : 92%" (the mockup has "needs to work about 18% of the time to break even");
- the meter's sentence: "P&L −$1,040.00, past the Stop by $300.00.", printed as it stands;
- "Realized", never "banked" (decisions 120 and 121); the mockup's meter key says "banked".

**Later deliverables this touches, and who owns what**

| Deliverable | D9.5 owns | The later deliverable owns |
|---|---|---|
| D10 (multi-leg) | Stock and single options | Plan and Now, the Plan check and expiration for spreads |
| D11 (Pricing Provider) | Typed Marks. The Marks step is "resolve what is missing", so a day the provider fills opens at the Trades | Whether a fetched Mark is slip-checked; candles |
| D12 (Stop Discipline) | The reason for holding when the Plan says out; the count of sessions held past a line, from saved Actions and Marks; saying an Exit was not carried out | Stop Discipline Deviations and the "Exit not carried out" Deviation question (decision 72). D12 decides whether the card's count switches to its episodes |
| D17 (Revise management) | The Plan's exit read as "all, at the Stop or the Target"; every part sale asks "Why only part?"; Adjust records intent only | Plans that sell in parts; "Change the Stop or Target" from an Adjust |
| D19 (Mark history) | Fixing a Mark saved in the same Review | Correcting any earlier Mark, with its effect shown |
| D20 (Assignment and Exercise) | "Record later" and the "Complete, settlement to record" state | Recording the exercise or assignment, which replaces the buttons; old "settle later" entries stay as history |
| D21 (Roll) | Roll records intent and a reason | "Record the roll" from a Roll |
| D23 (Settings) | Fixed limits | The Settings page, saving settings, and the slip-check setting (added to D23's scope) |
| D26 (Customize Journal prompts) | Three form revisions; the forms are drawn from their definitions | Whether "key lesson" can be made optional again; how the protected choice and the Plan-check reasons behave when a form is customised |

**D11 ahead of D10.** Agreed on 2026-11-21 and not yet in the plan. D9.5 comes before both either way and assumes every Mark is typed. Nothing in it should block a fetched Mark: the "no Action until Marks are in" rule counts any saved Mark, and the same-Review fix applies to typed Marks. The reorder is its own plan revision, to follow D9.5's approval.

**Acceptance**

- *Scenario texts changed by decision 125:* AC-REV-002 (due Debt and Settlement Due appear with their Trade), AC-REV-003 (Hold preselected only when the Plan says hold; the reason rules), AC-SET-003 ("record later" lets one Review finish) and AC-REV-006 (the new completion state). AC-JOUR-007's text is unchanged, but it now checks three revised forms. AC-REV-002, AC-REV-003 and AC-SET-003 are re-proven full against the new text; AC-REV-006 and AC-JOUR-007 stay partial. The breakdown's section 12 labels them so (decision 126).
- *New scenarios, added by decision 125, full in D9.5:*
  - AC-REV-007, the Review follows the Plan: a Hold with no reason when the Plan says out is refused; an Exit with no reason when the Plan says out saves; no Action saves while a needed Mark is unresolved.
  - AC-REV-008, a sale against the Plan: a sale recorded in the Review creates one Position Change with a completed reflection; a sale that follows the Plan asks nothing; a reason given on the Exit Action is not asked again; a part sale asks. **Changed by decision 126:** a sale that leaves the Plan saves with its reason, or with the reflection deferred, which leaves a Debt that cannot be answered without the reason; Decline is refused for every sale.
  - AC-SET-005, settlement put off: "record later" creates no Trade fact; that Review is "Complete, settlement to record" and names the Trade; the next Review asks again.
- *Re-proven:* AC-REV-002, AC-REV-005, AC-MARK-003, AC-MARK-004, AC-JOUR-001 (drafts, slip answers and "seen" are never saved), AC-JOUR-003, AC-POS-004, AC-CALC-003, AC-UI-001, AC-UI-002, AC-RESP-001, AC-CAP-001, AC-DEL-001, AC-DEL-006, AC-PERF-001, AC-BACK-001, AC-REST-001 and AC-REBUILD-001.
- The gate's critic also checks what the coach could not: a real phone width, a screen reader, a day Complete with Unavailable Marks, and a reflection owed on an open Trade.

**Declared scope**

- Stock and single options; spreads in D10.
- The latest completed session only; earlier Review dates in D15.
- Marks are typed; fetched in D11.
- A line is "reached" by the session's Marks or the sale's price. A touch during the day is not seen until Daily Bars (D11, D12).
- Exercise and assignment are not recorded (D20). Roll and Adjust record intent only (D21, D17).
- Trade Detail is not redesigned. It takes the shared words, the Open list's order, the exit form and the Close Review walk.
- The rules apply from D9.5 on. Earlier Actions keep what they recorded and show "no reason given" where none was.

**Parallelism.** Stories 1, 2 and 3 share the page's shell and go first, in order. After them, the Action rules (story 4), expiration (story 6) and the Replay (story 7) touch different parts and can run side by side. Story 5 needs story 4; story 8 needs story 7. Story 9 is proven with each story and closed last. **Decision 126:** the breakdown runs its 67 tasks one at a time, in three parts (A: stories 1, 2 and 3; B: stories 4 and 5; C: stories 6, 7 and 8). `replay` is extended here, between D9R2 and D10, which keeps the order its later extensions need.

**Open issues.** The first ten are the mockup notes' own, in their order.

1. **The late Exit asks again.** After several Holds past the Stop, each with a reason, the Exit still asks "Why did you leave the Plan?". The other way is to ask nothing and show the Hold reasons. Settled by decision 126 (the breakdown's U10): the Exit asks nothing when the Plan says out, and the sale asks once.
2. **Plans that sell in parts.** Owner D17. Until then such a Plan's first sale reads as leaving the Plan.
3. **A line touched during the day.** Not seen from Marks alone. Left to D11 and D12.
4. **A line set on the Underlying, a sale priced in the option.** Assumed: only the session's Underlying Mark decides whether the line was reached.
5. **"Anything different on the day?"** is gone from a sale that follows the Plan. Assumed: it stays gone.
6. **Roll and Adjust always ask a reason.** Whether either can follow the Plan is not considered. Assumed: always asked.
7. **Settings and D23.** Settled by answer 4.
8. **The Review after "record later"** is described in words only. To be drawn in the phone prototype pass. Drawn, and agreed on 2026-11-22.
9. **Trade Detail's wording.** Settled by answer 7.
10. **Phone.** Settled by answer 6.
11. **The Close Reason at a closing sale.** Settled by answer 11: still asked, nothing preselected.
12. **"The Plan says out."** Settled by answer 10.
13. **Where the reason rule sits.** Settled by answer 9. D26 cannot remove the rule by customising the form.
14. **An expiration's reflection.** Settled by answer 12. The breakdown settles how the Position Change Reflection's three required prompts change.
15. **Mark fixes without a reason.** Settled by answer 8.
16. **Holds saved before D9.5** count toward "held past the Stop N sessions running" and show "no reason given".

---

## D10 — Multi-leg option Strategies

**Stories**

1. As a trader, I would like to plan and trade verticals, iron condors, PMCCs, and covered calls as one Trade, recording each multi-leg order as one decision, so that I can journal spreads the way I actually trade them.
2. As a trader, I would like structure-level risk, reward, and payoff, and an explanation when payoff isn't available, so that I can manage a spread as a whole.
3. As a trader, I would like to plan legs by objective selection criteria or exact contract, and mark an Execution as an unplanned hedge, so that I can keep honest records of how my fills relate to the Plan.

**Capability set.**

- *Strategies:* multi-leg Strategy shapes with coherence validation; multi-member Position Changes across legs; the Covered Call combination of Stock and Call.
- *Plans:* objective selection criteria with retained evidence, and Not Verifiable when evidence is absent.
- *Valuation:* structure-value Stops and Targets on structures, extending D7S's single-leg ones (decision 89); synchronized multi-Instrument Marks; Payoff Unavailable for mixed expirations such as PMCC.
- *Deviations:* Planned-Leg Terms and Unplanned Exposure.
- *Replay and Review:* both cover multi-leg structures.
- *Trades tables:* the Trade Summary's `Structure` and `Legs` variants, the shape-to-direction mapping, and the two-expiration (PMCC) and stock-and-option (Covered Call) texts (decision 48; D02-ui-alignment.md, section 2a).

**Introduces**

- *Operations:* Trade Analysis: shape validation, objective-criteria conformance, multi-leg Deviations, structure-value evaluation and replay tracks, and multi-expiration payoff Unavailable.
- *Mechanisms:* none new.
- *Seeds:* Catalog: the Vertical Call Debit Spread, Vertical Call Credit Spread, Vertical Put Debit Spread, Vertical Put Credit Spread, PMCC, Iron Condor, and Covered Call Strategies.
- *Durable representation:* schema change adding Plan selection criteria and evidence, structure-value conditions on structures (D7S's schema 7 adds the single-leg kind), and the `ExplicitlyUnplanned` intent.

**Acceptance**

- AC-POS-002 — full.
- AC-POS-005 — full.
- AC-PLAN-001 — full.
- AC-PLAN-002 — full.
- AC-CALC-002 — full.
- AC-CALC-004 — full.
- AC-CALC-003 — partial. Declared scope: completed in D17.

**Parallelism.** Shape validation and conformance, structure valuation, and the multi-leg entry UI proceed in parallel once the Plan and Position Change shapes are fixed.

**Touched by decision 124 (D9.5).** D9.5's "Plan" and "Now", its Plan check and its expiration choices cover stock and single options. D10 extends them to spreads. See D9.5, "Later deliverables this touches, and who owns what".

**To do in D10 (plan revision 119, 2026-11-23, from D9.5's T95.13-D1 ocr review).** D9.5 knows "a contract expires on the Review Date" per Trade (`WalkedTrade.expiresOnReviewDate`), which is exact while a Trade holds one option contract. Once a Trade can hold several contracts with different expirations (a calendar or diagonal spread), it must be known per contract: the Marks grid's slip check skips "Worth nothing?" for a $0.00 Mark only on that contract's expiration day (T95.13-D1), and the grid's "Expired worth nothing: enter 0." line (W111) shows only on the expiring contract's row.

---

## D11 — Automatic closing prices (Pricing Provider)

**Stories**

1. As a trader, I would like the app to fetch closing prices and daily ranges for my open stocks and options automatically when I open Daily Review, so that I can stop typing Marks by hand.
2. As a trader, I would like my own Manual Marks always to win over fetched prices, and to see where each price came from, so that I can trust the data and override it when it's wrong.
3. As a trader, I would like to connect, replace, or disable my market-data provider with my API key kept private, so that I can choose my data source without exposing credentials or losing history.

**Capability set.**

- *Provider configuration:* zero or one enabled provider, shown as Disabled, Enabled (with redacted credential status), or Needs Setup. The credential is write-only: it is never returned, exported, or written into diagnostics.
- *Automatic recovery:* Daily Review's `open` runs recovery for the Instruments it needs. Market Data enumerates the completed sessions, finds the real gaps, and fetches them in bounded batches. Partial responses are fine, and failures remain transient diagnostics.
- *Precedence:* Manual Marks stay sticky. An identical provider price creates no new revision; a changed one appends a refresh revision. On an empty key, a Daily Bar's close seeds the provider Mark. Acknowledged keys remain eligible for later recovery.
- *Daily Bars:* stored as their own evidence. Replay shows candles for Bar dates, points for close-only dates, and gaps.
- *Offline and Restore:* with no network, recovery reports a safe operational diagnostic and every Manual path still works. A restored configuration comes back as Needs Setup until the credential is entered again.
- *Initial adapter:* Marketdata.app (decision 13).

**Adapter boundary (decision 14).** All provider-specific code lives in one adapter. The adapter:

- implements the port's single operation, `fetchClosingObservations`;
- maps Instrument keys to and from the provider's symbols, including option contract symbols;
- converts provider payloads into the port's observations and safe diagnostics;
- declares a descriptor with a stable `ProviderId`, a display label, its credential fields, supported Instrument kinds, and request bounds.

Adapters are discovered at build time from one adapters folder, so adding one changes nothing elsewhere in the app. The configuration UI is rendered from the descriptor. The Installed Capability Manifest lists the installed adapters. Historical `ProviderId` provenance on Marks and Bars survives a provider switch, and every adapter must pass one shared conformance suite.

**Introduces**

- *Operations:*
  - Market Data: `recover`, `getProviderConfiguration`, `configureProvider`; Daily Bar handling in `query` (`ResolveFrames`, `ReadSeries`).
  - Pricing Provider: `fetchClosingObservations`, implemented by the Marketdata.app adapter.
  - Daily Review: `open` with automatic recovery.
  - Trade Views and Reporting: `replayTrade` with candles.
- *Mechanisms:* the adapter registry and descriptor; the adapter conformance suite; device-local credential storage outside every backup section.
- *Seeds:* none.
- *Durable representation:* schema change adding Daily Bar revision chains, provider-configuration revisions (no secrets), provider provenance on Marks, and the separate credential store. The backup artifact version bumps too, and its secrets-exclusion checks now cover the credential.

**Acceptance**

- AC-MARK-003 — full.
- AC-MARK-004 — full.
- AC-MARK-005 — full.
- AC-BACK-001 — full.
- AC-MARK-002 — partial (Manual stickiness against provider closes and Bars). Declared scope: Mark history inspection is completed in D19.
- AC-REV-005 — partial (changed Daily Bars). Declared scope: correction is completed in D15.
- AC-MARK-006 — partial (Daily Bar evidence available). Declared scope: completed in D12, where Stop Discipline uses it.

**Accepted conditions (decision 15).**

1. Before task breakdown, confirm that Marketdata.app supports direct browser calls (CORS) with its token authentication, and that it provides end-of-day option closes and stock Daily Bars. If browser calls are not supported, stop and discuss: a server-side proxy would be new infrastructure outside the spec.
2. Mock-free integration tests use a disclosed local HTTP emulator of the Marketdata.app endpoints as behaviorally compatible test infrastructure, plus an optional live smoke test with a real key.

**Parallelism.** Once the port types and the adapter descriptor are fixed, three tracks can run in parallel: the Marketdata.app adapter, Market Data recovery and precedence, and the provider configuration UI.

**Touched by decision 124 (D9.5).** D9.5's Marks step and slip check assume typed Marks. D11 decides whether a fetched Mark is slip-checked; a day the provider fills opens at the Trades. See D9.5, "Later deliverables this touches, and who owns what".

---

## D12 — Stop Discipline in Daily Review

**Stories**

1. As a trader, I would like Daily Review to detect when I held a Position through a breached Stop and record it once per breach episode, so that I can see my real Stop discipline without daily duplicates.

**Capability set.** `replay` is extended to find continuous breach episodes against the original Stops, from the Stop Discipline coverage start onward (decision 12), using "first observed" after a gap or at the coverage start. Long single-Instrument conditions use the same-date Daily Bar high and short ones the low, falling back to the exact Mark; multi-Instrument structures use synchronized same-date exact Marks; a gap proves nothing. Stable fingerprints identify each episode. Saving a Review Action atomically creates, retains, supersedes, or Voids the episode record. Completion is Incomplete while a deterministic Deviation awaits reconciliation. Episodes appear on Trade Detail and as replay markers.

**Introduces**

- *Operations:*
  - Trade Analysis: `replay` episodes.
  - Trade Record: the Deviation-reconciliation change.
  - Daily Review: `save` with reconciliation.
- *Mechanisms:* episode fingerprints.
- *Seeds:* none.
- *Durable representation:* schema change adding Stop Discipline occurrences with their evidence links, and the Stop Discipline coverage start in Workspace metadata, which is exported and restored with the Workspace.

**Acceptance**

- AC-REV-004 — full.
- AC-MARK-006 — full.

**Declared scope.** Stop revisions that end an episode by replacing its condition are completed in D17.

**Coverage boundary (decision 12).** Periods before the coverage start are not evaluated for Stop Discipline. Review dates saved before D12 are unaffected, and Trade Detail and replay mark the boundary visibly.

**Parallelism.** The episode work is domain-only until the reconciliation is wired into Review Save. The Detail and replay display is parallel with both.

**Open issue (decision 72, 2026-11-02): an Exit Action not carried out.** The user proposes a new Deviation category. A Trade whose Daily Trade Review Action is Exit, and which is still Open after the next market session, would record a Deviation. In D6 the Review records Exit intent only, and the trader records the exit later from Trade Detail. The spec allows only four Deviation categories (`specs/design/trade-analysis.md`, "Normative analytical rules"): Planned-Leg Terms, Entry Size, Unplanned Exposure and Stop Discipline. So this needs a spec change, agreed with the user before D12's breakdown. It sits here because D12 adds the first Review-based Deviation and its save-time reconciliation. Questions for the breakdown: (1) which session counts as "the next market session" after the Review Date, and whether a partial exit counts; (2) whether a later Hold, or a changed Action, withdraws the intent; (3) whether the Deviation is reconciled when a Review is saved (as Stop Discipline is) or derived by Trade Analysis from the Action and the Position Changes; (4) its place in the Process Scorecard (D25).

**Touched by decision 124 (D9.5).** D9.5 asks a reason for a Hold when the Plan says out, counts the sessions held past a line from saved Actions and Marks, and says when an Exit was not carried out. All three are worked out each time and none is a Deviation. D12 keeps Stop Discipline Deviations and the open issue above, and decides whether the card's count switches to its episodes. See D9.5, "Later deliverables this touches, and who owns what".

---

## D13 — Voluntary journaling and Journal history

**Stories**

1. As a trader, I would like to write a Trader Reflection or Review Note at any time, about the market, a Trade, or one Execution, so that I can capture thoughts beyond the forms the workflows ask for.
2. As a trader, I would like to browse my Journal timeline and each Trade's narrative, so that I can reread my reasoning in context.
3. As a trader, I would like to edit, add to, or void an entry while its history stays visible, so that I can correct the record honestly.

**Capability set.** This adds direct creation of Review Notes and Trader Reflections with a Standalone, Trade, or Execution Anchor. It adds a Journal timeline with its own navigation destination, filters, and the Trade narrative (deduplicated). The trader can Edit, add an Addendum, or Void an entry, with View history. Voiding the only Entry that settled a Debt reopens that Debt, and a Daily Trade Review Action can be Voided.

**Introduces**

- *Operations:*
  - Journal: `save` (Create, Edit, Addendum, Void) and `query` (Timeline, Full History, filters).
  - Trade Record: `resolveAnchors`.
- *Mechanisms:* none new.
- *Seeds:* Journal: the Review Note and Trader Reflection definitions, and the Trade Detail and Journal Sources.
- *Durable representation:* schema change adding Addendum parent links and Void versions.

**Acceptance**

- AC-JOUR-002 — full.
- AC-JOUR-005 — full.
- AC-REV-006 — partial (Voided Action).

**Parallelism.** The Journal mutation and query work and the timeline/composer UI proceed in parallel once the read models are fixed.

---

## D14 — Abandon a Plan

**Stories**

1. As a trader, I would like to abandon a Plan I never entered, with a reason, so that I can keep my Planned list honest and later study why I pass on ideas.

**Capability set.** This delivers Abandonment of a confirmed Plan with no effective real position-changing fact. It requires one active Abandonment Reason and retires applicable Plan-related Debt. It produces no Close Reason and no Terminal Disposition, and adds an Abandoned list.

**Introduces**

- *Operations:*
  - Trade Workflows: `abandonPlan`.
  - Trade Record: the Abandon change.
  - Trade Analysis: expected `Abandoned` lifecycle.
- *Mechanisms:* none new.
- *Seeds:* Catalog: the five Abandonment Reasons.
- *Durable representation:* schema change adding the Abandonment fact.

**Acceptance**

- AC-LIFE-002 — partial. Declared scope: "Void the Execution first, then abandon" is completed in D15.

**Parallelism.** Small; serial.

---

## D15 — Correct an Execution (Replace and Void)

**Stories**

1. As a trader, I would like to choose the Execution or leg that was recorded wrongly and fix it, or void one that never happened, after seeing what the correction changes, so that my records are right while the original stays visible.
2. As a trader, I would like corrections to restate everything affected (lifecycle, Lots, P&L, Deviations, replay, and Review eligibility) at the original date, so that I can trust one consistent history.

**Capability set.**

- *Selection:* leg-aware selection of the fact to correct, within a multi-member Position Change.
- *Preview:* the Correction Footprint for Replace and Void of single-Trade facts (Executions and Expiration).
- *Commit:* an atomic commit of the corrected history and its reconciliation, with an impact acknowledgment where the change is material.
- *History:* fact version chains with View history.
- *Downstream effects:* Anchors stay attached; Debt retires when an underlying fact is Voided; Daily Review eligibility and completion are restated; replay reflects the corrected history.

**Introduces**

- *Operations:*
  - Trade Workflows: `previewCorrection` and `commitCorrection` (Replace and Void).
  - Trade Analysis: `assessChange`.
  - Trade Record: `history` and the Correction change.
- *Mechanisms:* Correction Footprint.
- *Seeds:* none.
- *Durable representation:* schema change adding Replace and Void version kinds, correction reasons, and the history index on the version chains that have existed since D1 (decision 11). Existing facts are not reshaped.

**Acceptance**

- AC-CORR-001 — full.
- AC-CORR-002 — full.
- AC-LIFE-002 — full.
- AC-REV-001 — full.
- AC-REV-006 — full.
- AC-CORR-005 — partial (fact corrections). Declared scope: Mark corrections are completed in D19.
- AC-REV-005 — full.

**Parallelism.** `assessChange` and the footprint (domain) and the preview/commit UI proceed in parallel once the `CorrectionPreview` shape is fixed.

---

## D16 — Current Exposure report

**Stories**

1. As a trader, I would like one view of my aggregate open risk, reward, and P&L across all open Trades, with honest coverage, so that I can see my total exposure at a glance.
2. As a trader, I would like to filter that view and break it down by one dimension, such as Strategy, Underlying, or Account, so that I can see where my risk is concentrated.

**Capability set.** This creates the reports area with its first family, Current Exposure. It has no Report Period.

- *Scope:* the Open Trades whose stored and expected lifecycle agree, all valued at one common valuation lens (the Expected Mark Date).
- *P&L:* realized-to-date, remaining-open marked, and combined, each available independently.
- *Risk and reward:* aggregate Plan Risk, Ongoing Risk to Stop, Worst-Case Ongoing Risk, and Incremental Reward.
- *Conditions:* Stop and Target counts that count each Trade once; Overrun as each Trade's largest simultaneous overrun; Plan-R distributions.
- *Coverage:* finite covered subtotals, Unbounded contributors named (for example short calls from D10), and Missing and Acknowledged Unavailable cohorts kept separate.
- *Ratio:* an optional portfolio reward/risk ratio, only over an exactly like-covered finite set. Per-Trade ratios are never averaged.
- *Filters and breakdown:* filters on Lifecycle, Account, Institution, Strategy, and Underlying (AND across dimensions, OR within one), with one Break Down By on Strategy, Underlying, Account, or Institution. Overall is always visible, and every figure navigates to its contributing Trades. Requesting a Lifecycle filter that excludes Open makes Current Exposure Not Applicable, never a zero portfolio.
- *Shared report mechanism:* this filter and breakdown mechanism belongs to the reports area, not to Exposure. Every later report family (D24, D25, D27) uses it, and dimensions added later apply to every installed family where the spec allows them: Tag and Idea Source in D22; Option Disposition Timing and Entry/Exit Scaling in D24. Each filter offers only values the installed deliverables can honor. There are no custom Boolean filters, custom date ranges, or nested grouping.

**Introduces**

- *Operations:*
  - Performance Analysis: `exposure`.
  - Trade Views and Reporting: `runReport` (Exposure).
- *Mechanisms:* the reports area and its navigation entry; `EvaluationSetBinding`; a population binding with page-exhaustion proof; the one-dimensional breakdown and contributor navigation shared by later report families.
- *Seeds:* none.
- *Durable representation:* none.

**Acceptance**

- AC-RPT-003 — full.
- AC-RPT-006 — partial (Exposure filters and breakdown). Declared scope: completed in D27.
- AC-RPT-001 — partial (Exposure offers no Report Period). Declared scope: the dated presets are completed in D24.

**Parallelism.** The pure `exposure` fold and the reports-area UI proceed in parallel once the report view model is fixed.

---

## D17 — Revise management

**Stories**

1. As a trader, I would like to move my Stop or Target, including structure-value conditions, with a written rationale, so that my current risk numbers reflect how I'm managing the Trade while my original 1R stays frozen.

**Capability set.** This delivers Management Revision of Stops and Targets from an Economic Time, with the required Revision Rationale and an optional revised thesis/invalidation pair. It saves one immutable Management Revision Entry. Ongoing risk and reward use the effective management, and the Plan Baseline never changes. Stop Discipline episodes end or restart on condition replacement. Management history appears on Trade Detail and as replay markers. A revision is never a Deviation.

**Introduces**

- *Operations:*
  - Trade Workflows: `reviseManagement`.
  - Trade Record: Management Revision change.
  - Trade Analysis: `evaluate` and `replay`, using the effective management.
- *Mechanisms:* none new.
- *Seeds:* Journal: the Management Revision definition and Source. All seven Entry Types now exist.
- *Durable representation:* schema change adding Management Revision facts.

**Acceptance**

- AC-CALC-001 — full.
- AC-CALC-003 — full.

**Parallelism.** The revision workflow and the revision UI proceed in parallel once the command and result are fixed.

**Touched by decision 124 (D9.5).** D9.5 reads every Plan's exit as all that is held, at the Stop or the Target, so a part sale always asks "Why only part?". D17 owns Plans that sell in parts, and adds "Change the Stop or Target" from an Adjust Action in the Review. See D9.5, "Later deliverables this touches, and who owns what".

---

## D18 — Rebuild a Trade

**Stories**

1. As a trader, I would like to reconstruct a Trade's Executions when the record is badly wrong, keeping my journal entries attached to the original history, so that I can repair the record without losing what I wrote.

**Capability set.** Rebuild keeps the Trade's identity. Reconstructed facts receive new identities in an explicit order, and superseded facts remain addressable. Old Execution Anchors resolve as Superseded or Voided and are never redirected.

**Introduces**

- *Operations:* Trade Workflows: `previewCorrection` and `commitCorrection` (Rebuild).
- *Mechanisms:* none new.
- *Seeds:* none.
- *Durable representation:* schema change adding Rebuild lineage and the superseded-fact markers.

**Acceptance**

- AC-CORR-003 — full.

**Parallelism.** Small; serial.

---

## D19 — Mark history and change impact

**Stories**

1. As a trader, I would like to see which Trades, calculations, and recorded Deviations a Mark correction would affect before I save it, so that I can correct prices without surprises.
2. As a trader, I would like to inspect a Mark's full history, including Manual saves, corrections, and acknowledgments, so that I can audit where every price came from.

**Capability set.** This adds Mark change preview across every affected Trade, and a Mark correction committed against the exact Save precondition. Observation history becomes inspectable.

**Introduces**

- *Operations:*
  - Trade Views and Reporting: `previewMarkChange`.
  - Market Data: `query` (`InspectObservations`, Candidate Manual Mark frames).
- *Mechanisms:* none new.
- *Seeds:* none.
- *Durable representation:* none.

**Acceptance**

- AC-CORR-005 — full.
- AC-MARK-002 — full (Manual history and correction meaning here; Manual stickiness against provider data since D11).

**Parallelism.** Small; the preview domain work and the UI can split once `MarkChangeImpactView` is fixed.

**Touched by decision 124 (D9.5).** D9.5 lets a Mark saved in the same Review be fixed with the fixed reason "Fixed in the same Review". D19 owns correcting any earlier Mark. See D9.5, "Later deliverables this touches, and who owns what".

---

## D20 — Assignment and Exercise

**Stories**

1. As a trader, I would like to record an Assignment or Exercise and allocate the resulting shares to an existing stock Trade or a new one, so that my stock basis and option premium are accounted for exactly once.
2. As a trader, I would like to be required to set management for stock I received through settlement, so that I can't carry unplanned exposure without Stops and Targets.

**Capability set.**

- *Settlement:* physical and cash Assignment and Exercise with a Settlement Price kept separate from adjusted basis or proceeds.
- *Allocation:* explicit allocation, with Needs Resolution when ambiguous; a residual successor Stock Trade with settlement-origin Plan context; typed Exercise lineage; Exercise Intent (captured since D7) honored.
- *Management:* Management Debt that only a Management Revision or exposure removal can resolve; workflow-routed Debt in Daily Review.
- *Corrections:* linked multi-Trade correction for settlements.

**Introduces**

- *Operations:*
  - Trade Workflows: `recordPositionChange` with Assignment, Exercise, and cash-settlement members.
  - Trade Workflows: the linked `previewCorrection`/`commitCorrection`.
  - Journal: Management Debt; `NeedsTradeWorkflow` routing.
- *Mechanisms:* none new.
- *Seeds:* none.
- *Durable representation:* schema change adding settlement allocation, lineage, settlement-origin Plan context, and Management Debt routes.

**Acceptance**

- AC-SET-001 — full.
- AC-SET-002 — full.
- AC-SET-004 — full.
- AC-JOUR-006 — full.
- AC-CORR-004 — partial (settlement-linked). Declared scope: Roll-linked correction is completed in D21.

**Parallelism.** The allocation and basis arithmetic and the settlement UI proceed in parallel once the settlement command shape is fixed.

**Touched by decision 124 (D9.5).** D9.5 adds "Exercised: record later" and "Assigned: record later", saved as that day's Daily Trade Review entry, and the state "Complete, settlement to record" (decision 10 is amended). D20's recording replaces those buttons; old "settle later" entries stay as history. See D9.5, "Later deliverables this touches, and who owns what".

---

## D21 — Roll

**Stories**

1. As a trader, I would like to roll part or all of a position into a newly planned Trade in one step, so that I can keep predecessor and successor linked without double-entering anything.

**Capability set.** One Roll Position Change closes the selected predecessor quantity, confirms the successor Plan with its Plan Reflection, assigns the new Executions only to the successor, writes typed lineage, and takes Close Reason Rolled when the predecessor closes. Daily Review's Roll Action links here.

**Introduces**

- *Operations:* Trade Workflows: `recordPositionChange` (Roll variant), and linked Roll correction.
- *Mechanisms:* none new.
- *Seeds:* Catalog: the Rolled Close Reason.
- *Durable representation:* schema change adding Roll lineage.

**Acceptance**

- AC-POS-003 — full.
- AC-CORR-004 — full.

**Parallelism.** Small; serial.

**Touched by decision 124 (D9.5).** D21 adds "Record the roll" from a Roll Action in the Review; until then a Roll records intent and a reason only. See D9.5, "Later deliverables this touches, and who owns what".

---

## D22 — Tags, Idea Source, and Trade filters

**Stories**

1. As a trader, I would like to tag my Trades and record where each idea came from, so that I can organize my journal and later analyze by them.
2. As a trader, I would like to filter my Trades by Account, Institution, Strategy, Underlying, tag, and Idea Source, so that I can find the Trades I'm looking for.

**Capability set.** This adds trader-defined Tag Types and Values, plus the fixed IdeaSource Tag Type with trader-created Values. Typed Trade tags and a Plan Idea Source can be set at confirmation. `browseTrades` gains filters (AND across dimensions, OR within) with Institution expansion, and the Underlying and Strategy sorts behind the Trades tables' sortable Underlying and Trade columns (decision 48; the Trade column sorts by Strategy, then Underlying). Tag and Idea Source become filters and Break Down By dimensions for every report family through the shared report mechanism (D16): Current Exposure now, and each later family as it lands. Tag grouping is disclosed as non-additive multi-membership.

**Introduces**

- *Operations:*
  - Reference Catalog: `save` (Tag Types and Values).
  - Trade Views and Reporting: `browseTrades` filters.
  - Trade Record: `queryRecords` dimensions.
- *Mechanisms:* none new.
- *Seeds:* Catalog: the IdeaSource Tag Type, with no Values. All Catalog seeds now exist.
- *Durable representation:* schema change adding Tag Type and Tag Value records, Trade tag references, and Plan IdeaSource.

**Acceptance**

- AC-REF-001 — full.
- AC-RPT-006 — partial (filters). Declared scope: report grouping is completed in D27.

**Note.** Plans confirmed before D22 have no Idea Source. Reports show them under `Unspecified`, which is honest because Idea Source is optional, so no history is lost.

**Parallelism.** The tag management UI and the browse-filter work proceed in parallel.

---

## D23 — Manage references and Workspace settings

**Stories**

1. As a trader, I would like to rename, archive, retire, or reactivate my Accounts, Institutions, Strategies, Tags, and reasons, and define a custom Strategy shape, so that I can keep my reference lists current without rewriting history.
2. As a trader, I would like to change my Workspace time zone after being told what it affects, so that I can keep review and report dates right if I move.

**Capability set.** This adds catalog administration with revision history: rename, archive/retire, and reactivation. It also adds the policies that keep seeded values selectable and block archiving an Institution that still has active Accounts, plus typed custom Strategy shapes. Historical records keep both their label at the time and the current label, and new selections of inactive values are blocked. Time-zone settings get an explanation before Save.

**Introduces**

- *Operations:*
  - Reference Catalog: `save` (rename, archive/retire, reactivate, custom shape) and `resolve` (`RetainedReference` and `HistoricalSnapshot`).
  - Workspace: `saveSettings`.
- *Mechanisms:* none new.
- *Seeds:* none.
- *Durable representation:* schema change adding Catalog availability and label revisions and the settings revision.

**Acceptance**

- AC-REF-002 — full.

**Parallelism.** Catalog administration and time-zone settings are independent.

**Touched by decision 124 (D9.5).** D23 gains the slip-check setting. D9.5 fixes the limits (5% for a stock or an Underlying; 100% up or 50% down for an option) in one place; D23's Settings page lets the trader change them, and the Workspace spec's "the only Workspace-wide setting" changes then. See D9.5, "Later deliverables this touches, and who owns what".

---

## D24 — Outcomes report

**Stories**

1. As a trader, I would like to see my closed-trade outcomes (P&L, win rate, R distribution, Profit Factor, and cumulative curves) for a named period, so that I can measure results honestly.
2. As a trader, I would like to break those outcomes down by one dimension such as Strategy or Account, so that I can compare where my results come from.

**Capability set.** This adds Report Period presets (All Time, Year to Date, Quarter to Date, Month to Date, This Week, Last Week) to the reports area created in D16, with the exact resolved dates echoed. It adds the Outcomes family, using the shared filters, breakdown, Coverage, and contributor navigation from D16, plus correction sensitivity. Option Disposition Timing and Entry/Exit Scaling become both filters and Break Down By dimensions, through the shared mechanism. They apply only to Closed Trades (Option Disposition Timing to Closed option Trades); inapplicable or insufficient-evidence Trades are disclosed in breakdown coverage while Overall keeps its full population.

**Introduces**

- *Operations:*
  - Performance Analysis: `outcomes`.
  - Trade Views and Reporting: `runReport` (Outcomes).
  - Trade Analysis: Entry/Exit Scaling.
- *Mechanisms:* Report Period resolution in the Workspace time zone.
- *Seeds:* none.
- *Durable representation:* none.

**Acceptance**

- AC-RPT-002 — full.
- AC-RPT-001 — full, including Current Exposure continuing to offer no period.
- AC-RPT-006 — partial (Outcomes with every filter and breakdown dimension). Declared scope: completed in D27.

**Parallelism.** The pure `outcomes` fold and the period controls proceed in parallel once the period request shape is fixed.

---

## D25 — Process Scorecard

**Stories**

1. As a trader, I would like a descriptive scorecard of my process (Plans entered or abandoned, Entry Quality, Deviations, management, Stop and Target behavior, reflection follow-through, and option disposition), so that I can see how faithfully I follow my own process without a made-up grade.

**Capability set.** This delivers every Scorecard family with its fixed natural dates, denominators, opportunity populations, and Coverage, with no composite score. It uses the shared report filters and one Break Down By (D16), with every dimension installed by then. Stop behavior before the Stop Discipline coverage start is disclosed as not evaluable, never counted as compliant (decision 12).

**Introduces**

- *Operations:*
  - Performance Analysis: `scorecard`.
  - Trade Views and Reporting: `runReport` (Scorecard).
- *Mechanisms:* none new.
- *Seeds:* none.
- *Durable representation:* none.

**Acceptance**

- AC-RPT-004 — full.

---

## D26 — Customize Journal prompts

**Stories**

1. As a trader, I would like to reword, reorder, add, or retire prompts and options for future entries, so that I can evolve my journal without altering what I already wrote or owe.

**Capability set.** This adds forward-only Entry Definition revisions with stable Prompt and Option identities. Workflow-critical roles are protected. Outstanding Debt and earlier Entries keep their original snapshots, and an open form is never silently replaced.

**Introduces**

- *Operations:* Journal: `reviseDefinition`.
- *Mechanisms:* none new.
- *Seeds:* none.
- *Durable representation:* none, because definitions were revisioned from D1.

**Acceptance**

- AC-JOUR-004 — full.
- AC-JOUR-007 — full.

**Touched by decision 124 (D9.5).** D9.5 revises three seeded forms (Daily Trade Review, Position Change Reflection, Close Review). D26 decides whether "What is the key lesson?" can be made optional again, and how the protected "settle later" choice and the Plan-check reasons behave when a form is customised. The Hold and Exit reason rule is enforced by the Review's save and cannot be customised away. See D9.5, "Later deliverables this touches, and who owns what".

---

## D27 — Journal Field report

**Stories**

1. As a trader, I would like to see how one categorical journal answer (such as Primary emotion or Conviction) is distributed over a period, so that I can notice patterns in my state of mind.

**Capability set.** One Entry Type and one categorical Prompt are grouped by stable value. Each current effective Entry counts once. Outcome states are reported distinctly, and Text, Number, and Date Prompts return Not Applicable. It uses the shared report filters (D16). Any Trade filter excludes Standalone Entries, which have no Trade dimensions; with no Trade filter, an applicable Standalone Entry participates without a related Trade. Journal Field has no second breakdown, and a later Journal Idea Source answer never rewrites the Plan Idea Source dimension.

**Introduces**

- *Operations:*
  - Performance Analysis: `journalField`.
  - Trade Views and Reporting: `runReport` (Journal Field).
  - Journal: `query` (Analysis projection).
- *Mechanisms:* none new.
- *Seeds:* none.
- *Durable representation:* none.

**Acceptance**

- AC-RPT-005 — full.
- AC-RPT-006 — full.

---

## D28 — Install the app

**Stories**

1. As a trader, I would like to install the journal as an app on my phone and laptop where my browser supports it, and launch it like any other app, so that I can open my journal in one tap, offline, without a browser tab.

**Capability set.**

- *Manifest:* switches to `display: "standalone"`.
- *Install affordance:* offers installation where the host exposes it, or clear platform-appropriate instructions otherwise. It never infers support from browser or operating-system identity, and never requires installation when a tab is `Writable`.
- *Installed launch:* runs the same Runtime Readiness gate, update safety, and offline restart as a tab.
- *Separate storage:* where installation creates storage separate from the browser (for example an iPhone home-screen app), the app says plainly that this is a new, empty Workspace and that a verified backup plus Restore moves the journal in. It never implies that installation transferred data.

**Introduces**

- *Operations:* none new.
- *Mechanisms:* manifest `standalone` request; install affordance and instructions; installed-mode test runs in the engines that expose installation.
- *Seeds:* none.
- *Durable representation:* none.

**Acceptance**

- AC-DEL-003 — full, except production HTTPS evidence, which remains pending until the Cloudflare project exists.
- Cumulative obligations close here, re-proven in installed mode as well as in a browser tab: AC-RESP-001, AC-CAP-001, AC-DEL-001, AC-DEL-004, AC-DEL-006, AC-UI-001, AC-UI-002, AC-REBUILD-001, and AC-PERF-001 are marked full.

---

## Parallelism

**Shared resources that need a single owner at a time:**

1. The IndexedDB schema version and the migration chain, including the Trade Record document format and, from D8, the backup content version, which is the schema version (decision 35).
2. The Catalog and Journal seed manifests.
3. The Installed Capability Manifest.
4. The release pipeline: Offline Release Inventory, service-worker version, and Web App Manifest.
5. The navigation shell and route map.
6. Shared Trade Analysis operations and the `DerivedTradeState` shape (`derive`, `evaluate`, `replay`, `assessChange`, `expirationPayoff`).
7. The U.S. session policy.
8. The shared Trade List and Trade Detail read models.
9. The Pricing Provider port types and adapter descriptor. Adapters themselves are independent of each other.

Every deliverable touches the capability manifest and the release pipeline. Even a safe pair can be developed in parallel only up to its release step, which a single owner applies in deliverable order.

**Safe cross-deliverable pairs**, which avoid schema, seed, analysis-shape, and navigation-shell changes in at least one member:

- **D8 ∥ D9.** Backup and Restore changes no Workspace schema, seeds, or analysis shapes, and adds its own navigation entry. Replay adds `replay` and lives inside Trade Detail. The one coordination point is that Restore verification calls `derive` but not `replay`.
- **D9 ∥ D13**, and **D9 ∥ D14** (stages A and B only: decision 117's stage C changes the shared Trade List and Review read models, so it runs alone). Replay is read-only, has no schema or seeds, and does not touch the navigation shell. D13 and D14 change schema and seeds, but not `replay`.
- **D25 ∥ D26**, after D24 adds Report Periods. The Scorecard is a read-only report; Customize Journal prompts revises Journal definitions, which already carry revisions, so neither changes the schema or seeds. They share only the release step.
- **D23 ∥ D24.** Catalog administration and settings against a read-only report. This is safe provided D23's schema change lands before D24 releases.

All other adjacent pairs share the schema, a seed manifest, or a Trade Analysis operation and are serialized. In particular, D9 → D9.5 → D10 → D11 → D12 → D17 all extend `replay` or its series and must stay in order.

## Acceptance coverage index

The deliverable listed is the one where each scenario becomes **full**. 

| Scenario | Full in | | Scenario | Full in |
|---|---|---|---|---|
| AC-RESP-001 | D28 (cumulative) | | AC-REV-001 | D15 |
| AC-PLAN-001 | D10 | | AC-REV-002 | D7 |
| AC-PLAN-002 | D10 | | AC-REV-003 | D4 |
| AC-LIFE-001 | D6 | | AC-REV-004 | D12 |
| AC-LIFE-002 | D15 | | AC-REV-005 | D15 |
| AC-LIFE-003 | D12 | | AC-REV-006 | D15 |
| | | | AC-REV-007, AC-REV-008 (revision 114) | D9.5 |
| AC-POS-001 | D6 | | AC-MARK-001 | D4 |
| AC-POS-002 | D10 | | AC-MARK-002 | D19 |
| AC-POS-003 | D21 | | AC-MARK-003 | D11 |
| AC-POS-004 | D7 | | AC-MARK-004 | D11 |
| AC-POS-005 | D10 | | AC-MARK-005 | D11 |
| AC-SET-001 | D20 | | AC-MARK-006 | D12 |
| AC-SET-002 | D20 | | AC-CALC-001 | D17 |
| AC-SET-003 | D7 | | AC-CALC-002 | D10 |
| AC-SET-004 | D20 | | AC-CALC-003 | D17 |
| AC-SET-005 (revision 114) | D9.5 | | | |
| AC-CORR-001 | D15 | | AC-CALC-004 | D10 |
| | | | AC-CALC-005 (revision 106) | D10 |
| AC-CORR-002 | D15 | | AC-RPT-001 | D24 |
| AC-CORR-003 | D18 | | AC-RPT-002 | D24 |
| AC-CORR-004 | D21 | | AC-RPT-003 | D16 |
| AC-CORR-005 | D19 | | AC-RPT-004 | D25 |
| AC-JOUR-001 | D4 | | AC-RPT-005 | D27 |
| AC-JOUR-002 | D13 | | AC-RPT-006 | D27 |
| AC-JOUR-003 | D5 | | AC-REF-001 | D22 |
| AC-JOUR-004 | D26 | | AC-REF-002 | D23 |
| AC-JOUR-005 | D13 | | AC-BACK-001 | D28 (cumulative) |
| AC-JOUR-006 | D20 | | AC-REST-001 | D28 (cumulative) |
| | | | AC-REST-002, AC-REST-003, AC-REST-004 | D8 |
| AC-JOUR-007 | D26 | | AC-REBUILD-001 | D28 (cumulative) |
| AC-DEL-001 | D28 (cumulative) | | AC-UI-001, AC-UI-002 | D28 (cumulative) |
| AC-DEL-002 | D1 | | AC-PERF-001 | D28 (cumulative) |
| AC-DEL-003 | D28 + Cloudflare | | AC-CAP-001 | D28 (cumulative) |
| AC-DEL-004 | D28 (cumulative) | | AC-DEL-005 | D8 |
| AC-DEL-006 | D28 (cumulative) | | | |

## Review queue

All queued decisions have been resolved and recorded above. New questions raised in later review are added here.

### Deferred to task breakdown: clause-level acceptance check

At the user's direction (2026-10-11), the clause-by-clause check of each acceptance scenario against its deliverables is done during each deliverable's task breakdown. A mechanical pass confirmed that every one of the 67 scenarios is marked full in exactly the deliverable the coverage index names. A partial clause-level read found these candidate gaps, to be resolved in the named deliverables' breakdowns:

1. ~~**AC-RPT-005 needs a Tag Select Prompt.**~~ Resolved by decision 17: Customize Journal prompts (D26) now precedes the Journal Field report (D27).
2. **AC-REF-001 (D22) includes retire and protection policy behavior.** Retirement arrives in D23, so the scenario may only become full there.
3. ~~**AC-BACK-001 (D11) and AC-REST-001 (D8) presume corrections, Voids, and every data kind.** Those arrive through D23. They may need to become cumulative obligations, re-proven by each data-adding deliverable.~~ Resolved by decision 38: both are cumulative.
4. ~~**AC-LIFE-003 (D8) covers each kind of agreed record.**~~ Resolved by decision 38: full in D12, with D10 and D12 adding their kinds. Planned-Leg Terms and Unplanned Exposure (D10) and Stop Discipline (D12) add new recorded Deviation kinds after D8. ~~Its "mutation is prepared" branch also needs an explicit owner, likely D2.~~ Resolved: D2 owns it (decision 23). The Lot-Match case is reopened by decision 30, because no Lot Match is stored; D6 adds Closed lifecycle agreement.
5. ~~**AC-SET-003 (D7) requires Settlement Due on Trade Detail as well as in Daily Review.**~~ Resolved in D7 (T7.16, I7.6).
6. **AC-MARK-002 (D11 and D19) needs Market Data's "deliberate Manual valuation override" save intention.** D11 does not yet list it.
7. ~~**AC-MARK-004 says historical gaps are visible and nonblocking in Daily Review.**~~ Resolved: D4 lists skipped sessions as optional gaps that do not block completion (decision 27), and claims AC-MARK-004 as partial.

### Open decision blocking D4's implementation

- ~~**D4 P14: the boundary between the "quantified pressure" and "routine" attention bands.** The user deferred it on 2026-10-11, to be settled before D4's implementation starts. It changes public behavior in D4's Review, so D4's first task cannot start while it is open; it no longer blocks the freeze (decision 41).~~ Resolved by decision 49 (revision 9, 2026-10-27). See [D4, section 1.1](D04-daily-review.md#11-decisions-for-this-breakdown).

### Raised by the D4 breakdown, for later breakdowns

1. ~~**D6:** extend `StateAtEconomicCutoff` to include Trades closed after the cutoff, because D6 first produces them (D4 A55).~~ Resolved in D6 (A88).
2. ~~**D7:** AC-REV-002's "missed Review … the same exact date reopens" is read as reopening an unfinished Review while it is still the latest session, because missed sessions are not reviewed (decision 27). Confirm that reading when D7 marks the scenario full.~~ Resolved in D7 (P28).
3. **D10:** AC-CALC-002's fixture needs a partial exit so that realized-to-date is nonzero. AC-CALC-003's "one crossed Stop and one reached Target" at once needs structure-value conditions, since one Long Stock Trade cannot cross both. **Resolved for single legs in D7S (decision 107, I7S.4);** D10 keeps the multi-leg part and the AC-CALC-002 fixture.
4. **D11:** `MarketData.recover` without a provider is installed in D4. D11 adds the Marketdata.app adapter inside it and the provider-configuration operations, rather than introducing `recover`.
5. **D12:** `DailyReview.save` gains its Stop-Discipline Deviation reconciliation (D4 has none, A44).
6. **D15:** add `DailyReview.open` with `ExactCompleted`, which AC-REV-001 requires (decision 27).

### Raised by the D5 breakdown, for later breakdowns

1. ~~**D6:** decide where a Debt whose Trade is not walked appears under decision 29 (a card for that Trade, or a residual list through `getDebt`), with its integration case. Also settle the user's direction that the Review covers positions closed that day: the spec makes only Trades Open at the session's close eligible (Daily Review, "Date, eligibility, and ordering"; AC-REV-001), so a Trade closed during the session is not walked unless that rule is reopened too. Close Review's Defer reuses D5's Debt record, due rule (decision 28), and resolution paths.~~ Resolved in D6 (P19, P20): eligibility is unchanged, and every Trade outside the walk with an owed reflection, due or not, gets a card after the walk.
2. ~~**D7:** mark AC-REV-002 full against the ordering reopened by decision 29: Marks, then settlement, then Trades with reflections in their cards.~~ Resolved in D7 (T7.14, I7.7).
3. **D13:** Voiding the sole settling Entry reopens the Debt; the Journal section validator gains that transition.
4. **D20:** Management Debt needs its place in the Trade card under decision 29 (the spec ranks it ahead of Journal-only Debt), plus `NeedsTradeWorkflow` from `Journal.save` and `ResolveReviewDebt`.

### Raised by the D6 breakdown, for later breakdowns

1. ~~**D7:** AC-REV-002's order becomes Marks, settlement, the Trade walk, then the owed-reflection group (D6 P20). An Expiration that closes a Trade still creates a Close Review obligation, with no Close Reason. D6's position-path rules (P22) and derived FIFO (decision 30) apply to option Lots.~~ Resolved in D7 (A103, A104, A107, T7.14, I7.5, I7.7).
2. ~~**D8:** Restore verifies lifecycle and Deviation agreement only (decision 30), and is the first path that can repair a Closed Trade's lifecycle disagreement, because no Position Change is accepted on flat facts (D6 P22, A96).~~ Resolved in D8 (A132, T8.8, I8.7).
3. **D10:** Not Entered, which needs an untouched second Planned Leg (D6 section 1.2).
4. **D15:** correcting or Voiding an exit can reopen a Closed Trade; decide how its Close Reason and Close Review outcome are retired, since D6 rejects new Position Changes on Closed Trades (P22).
5. **D24:** the cumulative realized-dollar curve reads derived Lot-Match realization increments, and its tie order uses the derived identity (opening Execution, disposing Execution), not a stored Lot Match identity (decision 30).

### Raised by the D7 breakdown, for later breakdowns

1. ~~**D8:** backup and Restore cover option Plan facts, Exercise Intent, option Executions, Expiration settlement facts, and schema 6.~~ Resolved in D8 (T8.2, I8.1).
2. **D10:** extend decision 31 to multi-leg structures. A structure with two expirations, such as the PMCC, has no single payoff to read a trigger's value from, so it needs its own rule. D10 also extends D7S's option-price (structure-value) Stops and Targets to structures (decision 89) and returns multiple-expiration payoff as Unavailable.
3. **D11:** the provider must supply both contract closes and Underlying closes, map option Instrument keys (`OPT:<symbol>:<expiration>:<C|P>:<strike>`) to its contract symbols, and pass a 0 close through as 0 (decision 32). **Amended by decision 77 (revision 42):** the key is the unpadded OCC option symbol (`XYZ261120C00055000`), which Marketdata.app uses, so no mapping is needed beyond dropping the padding of the 21-character OCC form.
4. **D12:** Stop Discipline on an option's underlying-price Stop uses the Underlying's Daily Bars and Marks as its evidence.
5. **D15:** correcting or Voiding an Expiration reopens the Trade; its Close Review outcome raises the same question as D6 item 4.
6. **D20:** Assignment or Exercise may share a Position Change with a partial Expiration, lifting D7's rule that an Expiration settles all open contracts (D7 A106). D20 also clears Settlement Due on assigned or exercised contracts (decision 10) and uses the Exercise Intent captured in D7.

### Raised by the D5R breakdown, for later breakdowns

1. **D10:** a multi-leg card's Marks panel lists one row per leg under each date, and Save Marks saves every leg in one commit ([D5R](D05R-review-redesign.md) P37, section 9).
2. **D11:** provider Marks arrive filled in each card's rows with their Source. Override joins the per-row actions; if Override is wanted inside Save Marks, it becomes another prepared entry intention. A card whose Marks all arrived opens on its first panel that is not done.
3. **Tech debt item 3:** D5R takes the history-sized gap scan off the save path but not off the first `open` of each Review; T5R.13's timings give it a measured baseline.

### Raised during D6's implementation, for later breakdowns

1. **D12:** the proposed Exit-intent Deviation (decision 72). See the open issue in D12's section.

### Raised by the D7 prefactor, for later breakdowns

1. **D20 (or a deliverable of their own): index options** (decision 77). D7's options are equity options, settled by delivering shares. Index options also have OCC symbols, but they need: an Index underlying variant of `Instrument` for the underlying's Marks; an explicit root that can differ from the symbol (`SPXW` for SPX weeklies and PM-settled contracts, and `NDXP`, `RUTW`, `VIXW`), which D7's stored `root` field already allows; cash settlement, with no Stock successor (Trade Workflows, "Cash settlement creates no Stock successor"); and AM-settlement timing for Settlement Due, since standard monthlies stop trading the day before expiration and settle on the next morning's opening prices. The Cash-Secured Put has no index form.

### Raised by the Strategy review (decision 88), for later breakdowns

1. **D8:** Restore closes Strategy references (`CrossSectionReference(Strategy, id)`, D8 A134) and checks stored Plans against the candidate Catalog's `strategyShapes`, the path migration uses. A stored Trade naming an unknown Strategy is reported there; D7 doesn't report it (decision 86).
2. **D10:** shape constraints in the Strategy module, absent meaning none so stored seeds stay equal under `sameShape`; `matchLegs` with typed issues; multi-leg `assessPlan` over the Planned payoff; one condition-side rule in Trade Analysis (tech debt item 14); worst case and maximum from the payoff; the Trade Summary takes `{ label, shape }`; a Strategy map in Daily Review's `open`; Option Disposition Timing for any option position, not `positions[0]`. Questions: Exercise Intent on multi-leg shapes (one Plan fact, one per long leg, or single-leg only); Long or Short for a structure (a per-seed mapping, or the sign of the Plan's net premium, in decision 31's spirit); which side an underlying-price condition is crossed on for a neutral shape such as the Iron Condor (derived from the payoff, stored on each condition, or structure-value only), and whether such a Plan may have a Stop on each side.
3. **D16 and D22:** a Strategy filter by identity (D16), and the Strategy-label sort (D22, decision 48), whose labels the Trade Record doesn't hold: sort a fully read population in Trade Views, pass a Catalog label order into the Trade Record's query, or sort by identity groups.
4. **D20:** the Strategy of a Stock Trade created by assignment or exercise, including when Long Stock is retired and for short Stock after a short-call assignment, which has no seed; short-Stock evaluation removes `evaluate`'s Long Stock branches (tech debt item 15); Exercise Intent honoured through `exerciseIntentApplies`; "the Cash-Secured Put has no index form" in the Strategy module.
5. **D23:** `validateShape` for trader-created shapes; `productKey` optional on `StrategyRecord`; one installed-shape check used by both the picker and `confirmPlan` (declare the supported vocabulary, or allow any well-formed shape and let `assessPlan` reject what it can't assess); retired Strategies through `RetainedReference` and `HistoricalSnapshot`, with the section map holding them.

### Raised by the D8 breakdown, for later breakdowns

1. **Every deliverable that adds or changes stored data:** extend the backup round-trip case to the new record kinds (decision 38). A schema change also adds its stores and private fields to the per-schema layout table (D8 A149), extends the current-schema `zod` record schemas, freezes `tests/fixtures/backup-v<N>/`, and restores every earlier backup fixture (decision 35).
2. **D10:** add AC-LIFE-003 (partial) to D10's acceptance list, with a disagreement fixture for Planned-Leg Terms and Unplanned Exposure through normal reads, mutation preparation, and Restore preparation.
3. **D11:** keep provider credentials out of the backup (decision 37): the backup keeps the nonsecret provider settings, the Restore preview lists "needs its API key again", and the restored provider shows Needs Setup with an "Enter your API key" action. Extend D8's I8.3 with a credential canary saved through `configureProvider`, prove that Restore preparation contacts no provider with one configured (AC-REST-001), and change D11's AC-BACK-001 claim from full to partial (cumulative, decision 38). Daily Bars join the `marketData` section.
4. **D12:** mark AC-LIFE-003 full, adding Stop Discipline to its disagreement fixtures. Its Mark-evidence checks during Restore read the candidate's observations (decision 34), and the Stop Discipline coverage start (decision 12) joins the `workspace` section.
5. **D13 and D15:** Void and Replace versions, Debt reopening, and corrected facts join the round trip and the section validators; their Restore repairs follow decision 23.

## Tech debt

Known gaps accepted for now, each with what a fix would need. Added at the user's direction.

1. **Late Stale-context Mark at a Daily Review save (D4, T4.16-B1 ocr; accepted 2026-10-29).** `DailyReview.save` binds the exact keys it read, but a Mark that newly becomes a Trade's Stale-context source between the save's read and its commit is not caught. Accepted because Stale context is disclosure only and the Action Entry stores no evidence. A fix needs a range binding in persistence `commit`, beyond ADR 0011's exact-key checks.
2. **Older tab writes after a session-policy change (D4, T4.17-B1; accepted 2026-10-29).** A tab still on an older release can keep writing observations after a newer release recorded its session-policy identity: no write-gate check compares policies, and a policy-only release keeps schema 3. A key on a newly closed date written then is never listed as an A40 finding, though it is never selected as a Mark. A fix needs the write gate to compare the release's session-policy identity with the stored one.
3. **Opening the Daily Review grows with history (D5, T5.22; recorded 2026-10-30, not yet measured step by step).** On D5's benchmark profile (25,000 Trades, 200 Open across 150 Instruments, 1,255 sessions, 188,240 Marks, as of 2028-12-29), the time from pressing Review to its status region is about 2.2 s; no plan budget covers it (AC-PERF-001 gates only cold start, 105 ms, and the Planned-to-Open switch, 44 ms). *Cause, from reading the code:* `DailyReview.open` calls `MarketData.recover` with gaps (`daily-review.ts` `assemble`), and `historicalGaps` (`market-data.ts`) does, per Instrument, enumerate every session from the earliest eligible exposure to the day before the Review Date, read every stored Mark in that range with `getAllFromIndex('observations', 'byInstrumentDate', …)`, resolve each, and build the missing and acknowledged lists (A56). The request count stays one per Instrument as A47 requires, but the records read and resolved grow with each Open Trade's age, so a long-held position costs a little more every session, approaching the whole observations store. A47 names `getAllKeys` for the gap enumeration; the code reads full records. The other steps are bounded: the eligibility page walk and two `derive` calls per Open Trade, today's frames, one Debt `getAll`, the Actions of the Review Date, and rendering the Marks family and Trade walk (not separated from the scan in the 2.2 s). *Proposed fixes, any of which is a design change to D4 (A47, A56) and needs a decision:* (a) **measure first**: time `eligibleTrades`, `recover` (and within it `historicalGaps`) and the first render on the bench profile, with no product change; (b) **gap watermark**: keep, per Instrument, the latest date through which every relevant session has a Mark or acknowledgment, maintained on Mark and acknowledgment writes and rebuilt by migration, so `recover` scans only sessions after it, making the scan proportional to recent gaps rather than history; (c) **keys only**: read `getAllKeys` on `byInstrumentDate` as A47 says, and fetch full records only for the dates that are acknowledged or need a revision, which cuts the per-record work but stays linear in history; (d) **defer the scan**: render the Review from the frames path (`framesOnly`, already used after a save) and load historical gaps into the Marks family afterwards, which removes the scan from the first paint but not from total work; (e) **add a budget**: a gated "press Review to status" measure in the latency harness, so a fix is held and later growth is caught. Recommended: (a), then (b) with (e); (c) is a cheap interim step.
4. **Due-classification cases repeated in the coordinator suites (D5R2, decision 69; recorded 2026-11-01).** D5R2 moves the due rule into `classifyDue` (`src/domain/journal-debt/`), whose own cases cover each classification and both inclusive boundaries (T5R2.1). The coordinators' existing due cases, in `src/coordinators/daily-review/reflections.test.ts` and `src/coordinators/trade-views/debt-status.test.ts`, are kept unchanged through D5R2 as evidence that the refactor changed nothing (T5R2.3). They now test the boundaries a second time. A fix trims each suite to one case per classification, plus decision 56's no-frame case in Trade Views, which proves the coordinator passes the right closes. Every boundary case then lives only in the domain module. It touches tests only: no code, and no visible change. **Scheduled by decision 101 (revision 72):** the [D7S prefactor](D07S-prefactor-mark-to-market-valuation.md)'s T7SP.13 makes this fix (P89); the item is marked resolved when that task commits. **Resolved by the D7S prefactor's T7SP.13 (P89, commit `982da791`, 2026-11-10).** `debt-status.test.ts` keeps one case per classification plus decision 56's no-frame case:
- D-1 Due;
- D-7 Due in the next Review;
- D-7 Due in the Review after next.

Its repeats (D-2, T-H's D-6 and the midday D-1) were removed. `reflections.test.ts` lost its case for an anchor written with a New York offset. That case moved to `classify-due.test.ts`, where it fails when `classifyDue` compares anchors as text. Tests only; no code changed.
5. **Missing evidence has four shapes and five wordings (architecture review candidate 4, 2026-11-01; recorded with decision 69, at the user's direction). Resolved by decision 77 (revision 42):** the [D7 prefactor](D07-prefactor-calculation-results.md) makes the Calculation Result the one value, carried unchanged through Daily Review and worded once. The analysis below is its starting point. A figure that cannot be a Value because a Mark is missing or acknowledged unavailable, the close has not happened, or the facts cannot be replayed, is carried by four different shapes: Trade Analysis's `CalculationResult` `Unavailable(reason)`, Daily Review's `PressureBasis` `NotComparable` and `AttentionReason` `MarkMissing` and `AcknowledgedUnavailable`, D5R's `RangePosition` `NotPlaced`, and the attention ranking's `RiskReward` `Missing`. It is worded in five places: `figures.ts`, `StopTargetSlider`'s `notPlaced`, `review-attention.ts`'s `reasonText`, `ReviewView`'s `blockerText`, and `TradeList`'s `missingMark`. Every new reason means an edit to each shape and each wording, and a shape that drops a reason misreports silently: D5R's T5R.16-B3 was the slider reading an acknowledged Mark as missing, because `RangePosition` had no `AcknowledgedUnavailable` reason. **Why not in D5R2:** it reaches about 20 source files and 35 test files, it changes the shape of values that D4 and D5 tests assert on (so a refactor could not keep every expected value), and its design is open. **A spec constraint:** "Calculation Result" is a glossary term (`Value`, `Unbounded`, `Unavailable(reason)`, `Not Applicable(reason)`) under ADR 0007, and decision 69 allows the glossary only additions. **Trigger:** a refactor deliverable of its own before D7, as D5R2 runs before D6. D7 adds option contract Marks and expiration, D10 multi-leg Marks, and D11 provider failures, each a new reason. It needs its own design session first: what the one missing-evidence value is, whether `PressureBasis` and `RangePosition` carry it unchanged, and whether ADR 0007's reasons change. D6 does not depend on it, since Closed and Abandoned detail needs no current Mark (Trade Views and Reporting, `getTradeDetail`).
6. **The cumulative suite outgrows the Bash tool's 10-minute limit (D5R2 and the D6 handoff review; recorded 2026-11-01, at the user's direction).** A complete cumulative run took about 9.5 minutes at D5R2: the browser suite 7.4 minutes for 179 cases, integration 45 s, unit 8 s, and the 12 static and verify checks the rest. A foreground Bash call is cut off at 600,000 ms. Through D5 and D5R2, `suite-runner` subagents ran the suite in the background to get past the limit and then waited with `pgrep` and `until` loops, which several times kept running after the runner had returned. *Interim fix (2026-11-01):* `.claude/scripts/full-suite.sh` takes a stage (`unit`, `integration`, `browser`, `checks`), and the runner makes four foreground calls and never backgrounds or polls. That holds only while each stage stays under 10 minutes. The browser stage grows with every deliverable (D6 adds `e2e/d6`), and Playwright runs one worker (`playwright.config.ts`) because every server shares port 5175, so the stage will cross the limit. Other long commands meet the same limit: `ocr-review` runs with the same timeout, and `bench:generate` takes hours. *Alternatives, to be tried before one is chosen:* (a) **split the browser stage**: one foreground call per spec directory, or per Playwright shard (`--shard=i/n`); it keeps blocking calls and needs no new harness behavior, but the number of calls grows with the suite and the runner has to add up the counts; (b) **background with a completion notice**: the runner starts the stage with `run_in_background` and waits for the harness to report its exit, with no polling; it is the fewest calls, but it is unproven that a subagent is woken when its own background command exits, and the old loops suggest the runners did not rely on that; (c) **the main session runs it in the background**: the main session is woken when a background command exits, and the script already prints only a summary, but it reverses the rule that the full suite never runs in the main session, and its output enters the main context; (d) **a faster suite**: more Playwright workers, each on its own port, which conflicts with the one-port rule and needs the user's approval, or fewer redundant release builds per run. *Recommended:* try (b) and (a) once each on a real cumulative run. For each, record the wall time, whether the runner's table matches the output files, and whether any process it started is still running afterwards (checked from the main session). Then choose one and update `suite-runner.md`, `full-suite.sh` and the handoff's working rules. (d) can follow if the run is still too slow. *Trigger:* when a suite runner reports the browser stage above 8 minutes, or before D7 starts, whichever comes first. **Amended by decision 71 (revision 30):** the D6 prefactor takes the browser stage to about 6.5 minutes in the full tier and about 1 minute in the task tier that most task runs use, so the trigger moves further off. The full tier still grows with each deliverable, so the alternatives above stay recorded, and the trigger is unchanged. **Amended by decision 98 (revision 64):** the trigger was reached at D7 (7.9 minutes before `e2e/d7`). The user took unit-test files off the full-tier list, so the full tier runs less often, and (as revised in revision 65) chose (a) by deliverable folder: two foreground stages, `browser-1` (D1, D2, D4) and `browser-2` (D5 onward). The new trigger is a runner reporting either stage above 8 minutes, which adds a `browser-3` for the newest folders. Revision 64 had first chosen (b) with a 12-minute watchdog. The user withdrew that before any run of record used it.
7. **Scratch copies have no standard procedure (the D6 prefactor's retrospective; recorded 2026-11-01 as plan revision 31, at the user's direction).** During the prefactor, an `ocr-review` agent needed an old commit and ran `git checkout <sha>` in the worktree, which detached its HEAD until the agent switched back. The retrospective took two steps. `ocr-review.md` now spells out a scratch clone inside the agent's own `mktemp -d` directory for relocated reviews. `.claude/hooks/guard-shell-writes.sh` refuses git commands that move HEAD in the worktree (bug tasks Retro-B1 and Retro-B2, `evidence/D06P/structural.md`). The guard reads command text only, so a third ocr round still found rare spellings that pass it, recorded as its known limits: relative `--git-dir` and `--work-tree` values followed by `-C <root>` from outside the root, and a first `cd -` that bash resolves through `$OLDPWD`. *Fix:* a script, `.claude/scripts/scratch-clone.sh <rev>`, that clones the worktree into a fresh `mktemp -d` directory, checks out `<rev>` there and prints the path, with `--remove <path>` deleting only a directory it created. The guard's refusal message would name it, and so would `ocr-review.md`'s relocation steps and `tdd-task.md`'s "Scratch work" rule. An agent that needs an old commit then has one prescribed path, which leaves only deliberate spellings to meet the guard's limits. It is a tooling task for a fresh `tdd-task` subagent, red first, with its own ocr review. It isn't part of D6. *Trigger:* the first of these:
   - a subagent's report shows the guard refusing a HEAD move;
   - an agent sets up a scratch copy some other way (`git worktree add`, a clone inside the repository, or a copy left behind);
   - a task needs an old commit outside an ocr review.
8. **A Daily Review save costs more as stored history grows (D6, T6.24 and T6.25; recorded 2026-11-03 as plan revision 33 and decision 73, at the user's decision). Moved out of tech debt by decision 74 (revision 39):** it is now D6 bug task T6.25-B2, which fixes it with option 1 below, then regenerates the benchmark dataset in full and reruns `bench:run`. The analysis below is that bug task's description. *What grows,* measured from generator 5's log (`evidence/D06/bench-generate-v5.log`, 25 sessions per line, phase seconds rounded to whole seconds), in Chromium on the development machine: the time of `DailyReview.save`, per Action saved, was 0.055 s over sessions 25–50, 0.19 s over 175–200, 0.46 s over 475–500 and 0.75 s over 750–775, which is about 1 ms more per session of history. `review.getTrade` per Action went from 3.6 ms to 54 ms over the same span. `review.open` per session went from about 0.04 s to about 0.28 s (the log's rounding makes this figure coarse). The timed harness shows the cost at session 784: a Trade Action save takes about 0.68 s warm and 0.69 s cold, and opening the first card about 0.52 s (`evidence/D06/bench.md`). *What stayed flat:* the request counts per save were flat in Node (T6.24-B1), so the growth is not extra IndexedDB requests per save. *Cause (verified 2026-11-03 on a copy of the partial snapshot; revision 34):* stale index entries in Chromium's IndexedDB. Chromium's backend (LevelDB) does not delete a record's old index entry when the record's index key changes. It leaves the entry behind and skips it on later reads, and it deletes a stale entry only when a read-write transaction iterates over it. Every Review read is read-only, and no write scans these ranges, so the stale entries accumulate without limit.
- **Where it bites:** the Open range of `trades.byLifecycleActivity`, keyed on `['lifecycle', 'activityDesc', 'tradeId']`. It gains a stale entry with every Position Change (each one moves `activityDesc`) and every Trade that leaves Open. The Planned and Open ranges of `byLifecycle` gain one each time a Trade changes lifecycle. The Closed range of `byLifecycleTerminal` is unaffected, because a Closed Trade's key never changes.
- **Measured at session 784, same rows from the snapshot and from a fresh database holding the same documents:**

  | Query | Snapshot | Fresh database |
  |---|---|---|
  | `byLifecycleActivity` Open, 99 rows | 168 ms | 1.6 ms |
  | `byLifecycle` Open, 99 rows | 75 ms | 1.6 ms |
  | `byLifecycle` Planned, 20 rows | 73 ms | 0.3 ms |
  | `byLifecycleTerminal` Closed, 51 rows | 1.0 ms | 1.2 ms |

- **Repeated reads don't help.** Seven read-only reads in a row stayed at 168 ms.
- **One read-write pass does.** It took 1,000 ms over the Open range, and read-only reads then stayed at 31–32 ms. The remaining gap to 1.6 ms is probably LevelDB's deletion markers awaiting compaction.
- **How this produces the save growth.** Every eligibility read (`eligibleRecords` in `src/coordinators/daily-review/daily-review.ts`) scans the Open range. A Trade Action save makes three or four such reads: the binding check, the post-save reassembly and the next card. That costs about 0.5–0.7 s at session 784, matching the 0.73–0.75 s per save in the log. `open` makes one, which matches its smaller growth. The request count stays flat while the time grows with total history, and Node's `fake-indexeddb` doesn't store data this way, so Node can't show it.
- **Details and the probe scripts:** `evidence/D06/t6.25-partial/report.md`.

*What it cost:* generator 5 ran 31,418 s (about 8.7 hours) for 784 of 1,255 sessions and was stopped; a full run was estimated at about 23 hours. *Which writes leave stale entries (revision 35):*
- **Only Trade writes do.** The `trades` store is written only by Confirm Plan (an add), by every Position Change (`applyPreparedChange` rewrites the document) and by a migration repair. Review Actions, Marks, reflections and Debts never write it.
- **A write leaves a stale entry only when it moves a key.**
  - `byLifecycle` (`[lifecycle, planTime, tradeId]`) moves only on a lifecycle change.
  - `byLifecycleActivity` (`[lifecycle, activityDesc, tradeId]`) also moves on every Position Change dated later than the Trade's last activity.
  - `byLifecycleTerminal` is set once, at the close.
- **Lifecycle moves alone are enough to cause growth** in any index keyed on lifecycle. The `byLifecycle` reads above (75 ms and 73 ms) come only from the Trades that have left Open and Planned.

*Targeted cleanup, verified 2026-11-03 (revision 35):* the test used synthetic data in a fresh Chromium 153 profile: 100 live Open Trades plus 10,000 that each opened, moved activity once and closed, leaving 20,000 stale `'Open'` entries.

| Setup | Open read (100 rows) | Cleanup cost |
|---|---|---|
| Fresh database | 0.5 ms | — |
| No cleanup | 36.6 ms | — |
| Cleanup in a separate read-write transaction after each commit | 0.8 ms | 0.25 ms per write |
| Cleanup inside the write's own transaction, after its `put` | 0.5 ms | 0.25 ms per write |
| One-time cleanup of all 20,000 old keys, one transaction each | 2.1 ms | 18 s |

- **How it works:** a read-write cursor over `IDBKeyRange.only(oldKey)` on the index makes Chromium delete exactly that stale entry.
- **No effect on the app's logic:** the cursor returned no records, because stale entries are skipped.
- **The probe:** `targeted-sweep-probe.mjs`, kept with the stale-index probes noted in `evidence/D06/t6.25-partial/report.md`.

*Fix options, best first:*
1. **Clean up the vacated key inside the Trade write.** When a Trade write moves a record's key in `byLifecycle` or `byLifecycleActivity`, the same commit opens a read-write cursor on `only(oldKey)` for that index after the `put`.
   - **Shape:** Persistence gains a write op such as `{ op: 'vacateIndexKey', store, index, key }`, which `commit` performs after the writes. Trade Record stages it with the old keys it already knows from the record before the change, and only when a key actually moved, because a cursor on an unchanged key would land on the live record.
   - **Existing Workspaces: no backlog cleanup (the user's decision, 2026-11-03, revision 36).** There is no reason for one:
     - No live Workspace exists, because the app has not been published.
     - The benchmark dataset is regenerated with the fix in place.
     - Every schema migration copies the records into a fresh candidate database, so its indexes start with no stale entries.

     The Chromium regression test is the guard.
   - **Where the cleanup goes (the user's decision, 2026-11-03, revision 37):** only in Trade Record's `applyPreparedChange`, the write every Position Change goes through.
     - **Migration writes are left out on purpose.** That means the migration repair in `src/coordinators/workspace/migration.ts`, which rewrites only Trades whose stored state disagreed with their facts, and the candidate rebuild in `src/persistence/rebuild.ts`.
     - **Why (corrected in revision 38):** a migration leaves no stale entries at all. After copying the records into a fresh candidate database and applying the repairs, it runs the candidate rebuild (`rebuildPrivateState`, AC-REBUILD-001). In one version-change transaction, the rebuild:
       1. drops every index on every store;
       2. recomputes the private fields (on each Trade, `activityDesc`, `exposureStart`, `terminalTime` and `terminalDesc`; on each Debt, `anchorTradeId` and `outstandingDue`);
       3. rebuilds `journalObligations`;
       4. recreates every index from the stored records.

       So any stale entry the repair created goes when its index is dropped. Every migration therefore clears all stale entries, including any backlog carried over from the old database.
     - **A backlog cleanup already exists.** If one were ever needed, `rebuildPrivateState` is the existing mechanism to use, not new sweep code. If it were ever needed, a full-range read-write pass over the Planned and Open ranges of both indexes would clear a backlog: about 1 s on the 15,600-Trade snapshot.
   - **Trade-offs:** there is no schema change. It relies on unspecified Chromium behaviour, so it needs a Chromium regression test: churn a few thousand Trades, then assert the Open read stays within a small factor of a fresh database's.
2. **Keep live membership in a store whose rows are deleted.** For example, an `openTrades` and `plannedTrades` store keyed by `tradeId`: a row is added when a Trade enters the lifecycle and deleted with a primary-key delete when it leaves.
   - **Why not an index:** a primary-key delete is a real LevelDB delete, cleared by normal compaction. An index keyed on lifecycle would not do, because lifecycle moves alone leave stale entries.
   - **Ordering:** read the members by key and order them in memory.
   - **Trade-offs:** it doesn't depend on engine behaviour. It needs a schema change and migration, and touches Trade Record's `queryRecords` Open and Planned paths, the Review's eligibility read and the Trades list.
3. **Read eligibility once per save, not three or four times.** Carry the eligible set from the binding check through the post-save reassembly while the Workspace content revision is unchanged. This cuts the save cost by about three to four times, but it still grows with history. It is worth doing alongside option 1 or 2.

*What a fix needs besides the change:* (a) a Chromium regression test that builds many Position Changes and lifecycle changes, then checks that the Open eligibility read stays within a fixed factor of a fresh database's; (b) a full regeneration and rerun of `bench:run`, which then covers AC-PERF-001's D6 row. Until then that row is partial. The gated reads (`bench.md`: cold p95 252.7 ms, warm 208.7 ms, against D5's 104.8 and 43.6 ms) probably carry part of this cost too, because the Trades list's Open tab reads the same range. *Trigger:* before the next full benchmark generation, and before any deliverable that adds a gated Review-save budget.
9. **Each module must remember to vacate the index keys its writes move (D6, T6.25-B2 and T6.25-B3; recorded 2026-11-03 as plan revision 40 and decision 75, at the user's direction).** Chromium's IndexedDB keeps a record's old index entry when the record's index key moves or disappears, until a read-write cursor visits it (item 8). B2 and B3 fix this one index at a time: Trade Record stages `vacateIndexKey` for `trades.byLifecycle` and `trades.byLifecycleActivity`, and the Journal for `journalDebts.byOutstandingDue`. Any index whose key a write moves, and which nobody remembers to vacate, will grow without limit again. B3's index was found only by the 300-session smoke run, after B2. A latent case already exists: `trades.byLifecycleTerminal` would go stale if a Closed Trade's Terminal Time ever changed or a Trade reopened (D17 and D18 may do either).
   - **The fix:** Persistence's `commit` vacates moved keys for every write, so modules stage nothing.
     - For each `put`, it reads the current record in the same transaction, before the put. For each `delete`, it reads the record being deleted.
     - For each index on the store (`store.indexNames`, with each index's `keyPath` read at run time), it computes the old and new keys. A missing field or an invalid key part means no entry, which covers the sparse indexes.
     - It vacates the old key with the existing read-write cursor over `IDBKeyRange.only(oldKey)` if the key changed or the new record has none.
     - The index list comes from the database itself, so a new store or index in `createWorkspaceIndexes` needs no other change.
     - `vacateIndexKey` becomes internal to `commit`, and B2's and B3's staging is removed.
   - **Limits:**
     - Key extraction must match IndexedDB's rules: today every key path is flat field names, as a string or an array. A unit test compares the helper's keys with fake-indexeddb's.
     - A `multiEntry` index, of which there are none today, is rejected with a clear error until one is needed.
     - Each `put` costs one extra get, and writes that already read the record could share it.
   - **What it needs:**
     - a Chromium regression test over every index;
     - a check that deletes are covered (not yet measured);
     - B2's and B3's regression tests kept green.
   - **Trigger:** the next deliverable that adds an index, or a write that moves `byLifecycleTerminal` (Revise, Rebuild, Correct an Execution), whichever comes first.
10. **Upgrade tests deferred until the first release for real use (after D6; recorded 2026-11-04 as plan revision 41 and decision 76, at the user's decision).** No deliverable gate runs `npm run test:e2e:release-history` (B2.3, B2.5, B4.7, B5.6, and B6.6 once D7's T7.25 tags it), and from D7 on no deliverable has its own upgrade case from the previous release. Until then a new migration step runs in a real browser only through B2.4 and B2.6 (D1-shaped data) and is otherwise checked by its integration migration tests. **Decision 112 (revision 101):** B6.6 is deleted, since it tested a path no release for real use will take, and `verify:fixtures` requires a fixture for every schema, so those integration tests stay complete.
   - **What it needs, before the first release for real use:**
     - the previous-release harness rebuilt with `npm run build:releases && npm run verify:releases`, fixing any old tag that no longer builds;
     - `npm run test:e2e:release-history` passing;
     - an upgrade case with data, from the last tagged release to the release candidate, passing in Chromium, and in every engine at RC.
   - **From then on:** every release adds an upgrade case from the release users have, and runs it at its gate.
   - **Trigger:** the decision to publish for real use, alongside RC.
11. **A timing race in the Open list's Ready-state unit case (the D7 prefactor, T7P.12; recorded 2026-11-06 as plan revision 46, at the user's direction).** `src/ui/screens/TradeList.test.tsx:125` ("Open list › should render distinct Loading, Ready, Empty … and Error with Retry states") reads `marks('tj:open-list-ready')` as soon as `findByRole('table')` resolves. The mark is made in a passive effect after the Ready table renders (`TradeList.tsx:149-150`), so under load the read can come first: the case failed with `expected +0 to be 1` in the first gate run (`evidence/D07P/suite-runs/t7p-12-full-unit.txt`), then passed 35 of 35, five times alone. The prefactor didn't change the mark, its effect or the case. A fix waits for the mark in the case (for example `await waitFor(...)` on the mark count), leaving the product code alone. **Trigger:** the next time the case fails a cumulative run, or any task that touches the Open list's readiness mark.
12. **`verify:wording` can name the wrong line for a reason word in a multi-line template (the D7 prefactor, T7P.9-B12's ocr review; recorded 2026-11-06 as plan revision 46, at the user's direction). Resolved by revision 48:** the D7 prefactor's retrospective (`evidence/D07P/retro.md`, finding 1) rebuilt `verify:wording` as ESLint `no-restricted-syntax` selectors in `eslint.wording.config.js` (Retro-B1, `dd0c8224`, and its bug tasks B1–B3, `625d4a38`), with the same name, rule and lists. ESLint reports each hit at its node's start line, and `tools/wording-scan.ts` is gone. The analysis below is kept as the record. In `tools/wording-scan.ts:114` (as of `claude-opus-5.5-d7p`), the reason-word branch adds `raw.indexOf(whole)` to the literal's start, so a reason word after a newline (or an escape) in a multi-line template literal is reported on a later line than the one it is on. The check still fails, naming the file and the words; only the line number is off. T7P.9 was closed after B12 at the user's decision with this finding recorded (`evidence/D07P/structural.md`, T7P.9-B12). A fix computes the line from the match's offset in the source text, with a case for a reason word on the second line of a template. **Trigger:** a `verify:wording` report whose line doesn't hold the word, or the next change to `tools/wording-scan.ts`.
13. **D2's record writer leaves its browser context open when it fails (the D7 prefactor, T7P.11-B1; recorded 2026-11-06 as plan revision 46, at the user's direction).** `writeIntegrityFixture` in `e2e/d2/support.ts:271` launches a persistent context, edits the stored records and closes the context outside a `finally`, so a failed edit leaves the context, and the profile's lock, in place for the rest of the run. T7P.11-B1 fixed the same shape in `e2e/d7p/support.ts`'s `writeSellQuantities` (`78967377`); `e2e/d2` was outside the prefactor's change set. A fix wraps the work after the launch in `try { ... } finally { await context.close(); }`, as B1 did. **Trigger:** the next task that changes `e2e/d2/support.ts`, or a browser run in which a failed fixture write is followed by unrelated launch failures.
14. **Three copies of the direction rule (the Strategy review; recorded 2026-11-07 as plan revision 54 and decision 88, at the user's decision).** `assessPlan`'s `bullish` (`src/domain/trade-analysis/plan.ts`), `evaluate`'s `stopBelow` (`evaluate.ts`) and Entry Quality's `direction` (`derive.ts`) each derive direction from a leg's side and right. A fix is one condition-side function in Trade Analysis over the frozen Planned Legs. **Trigger:** D10's breakdown, or the first change to any of the three.
    - **Deferred to D10's cleanup (plan revision 81, 2026-11-12, at the user's direction).** D7S met the "first change" trigger: T7S.3 and T7S.4 changed `plan.ts` and `evaluate.ts`. The user chose to leave the fix for D10 rather than do it in D7S. D7S's tasks reused the existing rules and added no new domain copy. One caveat: the option-price side is still decided inline, by the leg's side in `plan.ts`'s condition basis and in `evaluate.ts`. D7S also added a UI-side rule:
      - `isBullish` and `conditionDirection(role, kind, leg)` in `src/ui/screens/option-words.ts`, used by the Plan form, Trade Detail and the Review card;
      - `plan-issues.ts` takes `bullish` as an input.

      D10's fix should cover these too, so the UI reads the same condition-side function. **Trigger:** D10's breakdown only.
15. **Long Stock assumptions in `evaluate` (decision 88).** Stock conditions are always crossed as for a long position, "a long Stock Position has no price ceiling", and the stock worst case is `q × m`. A fix reads direction from the position and the extrema from the Current payoff. **Trigger:** D20 (short Stock after a short-call assignment) or D23.
16. **The Long Stock fallback in `assessPlan` after a shape mismatch (decision 88).** `plan.ts` still assesses a leading Long Stock leg after `StrategyShapeMismatch`, for AC-PLAN-002's combined issues. **Trigger:** D10's multi-leg `assessPlan`.
17. **`*LongStockSummary` names (decision 88).** `plannedLongStockSummary`, `openLongStockSummary` and `closedLongStockSummary` keep their names once T7.16 adds the Trade Summary's `Option` variant. **Trigger:** T7.16, if it doesn't rename them.
18. **Settlement outside the market calendar (decision 87, question Q1; recorded 2026-11-07).** The market calendar covers 2024 to 2028 (decision 54), so a contract expiring later has no settlement time: its Settlement Due item shows "outside the market calendar" and offers no Record expiration. A fix extends the calendar. **Trigger:** before the first 2029 expiration can come due, or the first Plan on a 2029 contract.
19. **One earlier-date read per spread (decision 97; recorded 2026-11-08, at the user's direction).** D7's Open page makes one extra `Historical` `observations` read per distinct earlier close date that an option Trade's dated line needs, carrying every Underlying needed at that date. When multi-leg options arrive (D10), a spread's dated line needs every leg's contract and the Underlying at that earlier close. The read for that date should pick them all up in a single read, not one per leg or per contract, so the budget stays one read per distinct date. **Trigger:** D10's breakdown, when it extends the dated line and the Open page's query count to multi-leg Trades.
20. **Exercise and assignment need the Underlying's close on the expiration date (decision 99; recorded 2026-11-08, at the user's direction).** D7's settlement item needs no price read: the contract names its strike and expiration, the trader's records give the open quantity, and the settlement time is the expiration session's close from the session policy. D7's Expiration records contracts expiring unexercised. Exercise and assignment (D20) depend on where the Underlying closed that day against the strike, and a cash-settled option pays the difference from the Underlying's settlement price. So D20's settlement needs the Underlying's close on the expiration date: at most one stored read per Underlying per distinct expiration date, never one per Trade or per contract. **Trigger:** D20's breakdown, when it adds exercise and assignment to the settlement family and Trade Detail.
21. **The payoff view builds its own value-at-expiration sentence (D7, T7.32-B7; recorded 2026-11-08, at the user's direction).** A122's line "If XYZ is at 57.50 at expiration: +$148.05" has one shared builder, `valueAtCloseText` in `src/ui/screens/payoff-text.ts`, which the Review card (`CardFigures.tsx`) uses since B7. Trade Detail's `PayoffView.tsx` still assembles the same sentence inline from `underlyingPrice` and `signedMoney`, so the wording lives in two places and could drift (convention C1: one wording per concept). A fix points `PayoffView` at `valueAtCloseText`, with no change to the words, and the existing Detail and card tests prove the text is unchanged. **Trigger:** the next task that changes `PayoffView.tsx` or the payoff wording, and at the latest D10's breakdown, when spreads extend the payoff view. **Scheduled by decision 110 (revision 84):** D08P's T8P.19 fixes it.
22. **The D7S prefactor left the measured steps 30 to 75% slower than D7 (T7SP.14, O3; recorded 2026-11-11, at the user's decision to accept the numbers).**
    - **Measured.** `bench:run` after T7SP.19 (`evidence/D07SP/bench-r2.md` and `bench-r3.md`, commit `9c0d14d0`) was compared with `evidence/D07/bench.md` (2026-11-08). Two runs agreed:
      - Review status: 210 → 309–332 ms (+47–61%);
      - first card median: 154.9 → 268 ms (+73%);
      - Save Marks median: 149.5 → 215 ms (+44%);
      - Action save median: 124.1 → 189–193 ms (+52–56%);
      - cold Action save median: 132.0 → 228 ms (+73%);
      - warm switch p95: 47.0 → 65 ms (+38%);
      - Closed page median: 87 → 114 ms (+30%).

      Cold start p95 (+4–5%) and the Closed page p95 (−26%) are within 10%. Both gated budgets pass (cold 135 of 2,500 ms, warm 65 of 1,500 ms), and every row comparison passes. T7SP.19 (decision 106) had already removed the 10x Review open regression caused by the gaps scan from coverage start.
    - **Not yet known.** How much of this is the environment. D7 was measured on 2026-11-08, and no control run of D7's code was made on the same machine on 2026-11-11. The Closed page does no valuation read, yet it is 30% slower at the median, which points partly at the machine.
    - **Suspected product causes** (from reading the code; unmeasured):
      - the read session's per-call batching and per-Instrument `ResolveFrames` assembly (T7SP.5, T7SP.7) on the Open list and the Review;
      - `getTrade`'s double `derive` (T7SP.8);
      - the post-save rebuild through the session (T7SP.8).
    - **Proposed fixes:**
      - (a) **Control first.** Build `claude-opus-5.5-pre-d7sp` in a scratch clone and run `bench:run` on the same machine back to back with the current head, so the comparison is like for like.
      - (b) **Bisect**, if (a) shows a real regression. Bench at T7SP.5-B4, T7SP.7, T7SP.8 and T7SP.19 to pin each step's cost to a commit.
      - (c) Fix what (b) names, each fix with a before-and-after bench.
    - **Trigger:** before D7S's latency harness, or sooner if a deliverable's bench shows further growth on these steps.
23. **A Planned option Trade's Detail may show no "Expires" line (BUG-2's fix; recorded 2026-11-12 as plan revision 83, at the user's direction).** While fixing BUG-2 (`2bef1d4e`), the subagent saw no "Expires" line on a **Planned** option Trade's Detail in the browser. It checked the line on an Open Trade instead, where it shows. Not investigated, and not written up as a bug task, at the user's direction.
    - **Where to look:** `getTradeDetail`'s Planned view sets `contractExpiration` (`src/coordinators/trade-views/trade-views.ts:794`, `expirationLineOf(analysis, 'Expires')`). The screen draws it in `SummaryCard` (`src/ui/screens/TradeDetail.tsx:329` and `:335`), which is rendered only when the view has no `recordedPositionChanges` (`:197`). Find which of these drops the line for a Planned Trade.
    - **Fix:** a browser case first, on a Planned option Trade's Detail reading "Expires <date>", then the fix.
    - **Trigger:** the planned UI refactor of Trade Detail, or the next change to `SummaryCard` or the Planned Trade Detail view, whichever comes first.
    - **Scheduled by decision 110 (revision 84):** D08P's T8P.9 fixes it, after its browser case B8P.3. The probable cause, a just-confirmed Detail built without the line, is the breakdown's A209.
24. **Journal paging drops keyboard focus at either end (D08P, critic-6's defect; recorded 2026-11-14 as plan revision 100, at the user's direction).** In the Trade Detail cockpit's Journal drawer, pressing Enter on "Earlier sessions" (›) to reach the last page, or on "Newer sessions" (‹) to reach the first, disables the pressed button. A disabled button can't hold focus, so focus falls to the page body and the next Tab starts again at the top of the document; a screen reader hears nothing about the new page. Mouse users are unaffected, and nothing on screen is lost or wrong. It falls short of `specs/design/ui-contract.md`'s "logical focus after navigation" and AC-UI-002's "focus/order/names/roles are coherent". axe passes, because it checks a static page. **Triggered by D8R (decision 115):** its T8R.15 changes the session cards, and T8R.16 fixes this item, with B8R.6's case red first.
    - **Where to look:** the paging buttons in the Journal drawer's session cards (`src/ui/cockpit/journal-cards.tsx`).
    - **Fix:** a browser case first, pressing each paging button by keyboard to its end and asserting focus stays in the Journal drawer (on the other paging button, or the cards list), then the fix. A likely shape: when the pressed button becomes disabled, move focus to the other paging button.
    - **Trigger:** the next change to the Journal drawer's paging or session cards, or D08P's follow-on that trims the Journal (breakdown section 10), whichever comes first.
25. **The Today table opens scrolled to its right end at 960 to 1100 px, hiding the Today column's heading (D8R, T8R.25 critic-3's defect 1, moderate; recorded 2026-11-17 under decision 116 (3)).**
    - **Symptom.** In Trade Detail's Today drawer, the Marks box opens with `scrollLeft` at 146 px at 960 px wide, 82 px at 1024 px and 6 px at 1100 px. The sticky row-header column then covers the start of the Today column. At 1024 px the heading reads ", THU OCT 15", so the trader can't tell which column is Today without scrolling back. Open, Closed and Settlement Due Trades are all affected. At 1280, 375 and 320 px the table fits.
    - **Cause.** `ScrollsToEnd` in `src/ui/cockpit/drawers/today.tsx` keeps the box at its right end. That made sense when the latest session was the right-hand column. W29's order (Today, Yesterday, Change) now puts it on the left.
    - **Fix.** A browser case first: at 1024 px, `scrollLeft` is 0 and the first heading is not covered. Then drop the scroll-to-end, or scroll to the start instead.
    - **Trigger.** The next change to the Today drawer, or D9's breakdown, which adds the chart beside it.
26. **An owed reflection keeps the old Journal layout (D8R, critic-3's defect 2, low; recorded 2026-11-17 under decision 116 (3)).**
    - **Symptom.** An owed Position Change reflection in the Journal drawer reads "Position Change at 2026-10-14 11:00", followed by a "Due" term whose value is also "Due". Every other item has W27's one dated line in the app's format, for example "Position Change · Wed Oct 14, 11:00 am" (A239).
    - **Fix.** Give the owed item the same dated line, with a case first.
    - **Trigger.** The next change to the Journal drawer's items or to owed reflections.
27. **W24's Deviation line has no final full stop (D8R, critic-3's defect 3, low; recorded 2026-11-17 under decision 116 (3)).**
    - **Symptom.** The Journal shows "1 active Deviation. See Plan and Risk", with nothing after the button. W24 reads "… See Plan and Risk.".
    - **Fix.** Add the full stop after the button, with a case first.
    - **Trigger.** The next change to the Journal's Deviation line.
28. **An Underlying condition can read "Breached" on the rail with no alert elsewhere (D8R, T8R.25-B5's review note; recorded 2026-11-17 at the user's direction).**
    - **Symptom.** On an option Trade whose contract Mark is missing or acknowledged unavailable while the Underlying's Mark is in, an Underlying Stop or Target is read from the Underlying's Mark alone (T8R.25-B5). If the Underlying has crossed it, the rail and Plan and Risk read "Breached · X past", but the other screens disagree:
      - no Needs you alert appears;
      - the Trade List shows no "Stop breached" or "Target reached" badge;
      - the Daily Review shows no attention band;
      - the Review card says "Mark missing".
    - **Why.** An Alert and its band need the dollar overrun, which needs the contract's Mark (A109). The other screens read the condition's `result`; only the rail and Plan and Risk read `ConditionStatus.underlyingReading`.
    - **Where to look:**
      - `src/domain/trade-analysis/evaluate.ts` (`underlyingReading`)
      - `src/ui/screens/daily-review/attention.ts`
      - `src/ui/cockpit/rail/needs-you.props.ts`
      - `src/ui/screens/TradeList.tsx`
      - `src/ui/screens/CardFigures.tsx`
    - **Fix.** First decide, as a specs question, whether a crossing known from the Underlying alone raises an Alert without its dollar figure. Then make every screen follow that one answer, with a case for each.
    - **Trigger.** The next change to Alerts or attention bands, or D9's breakdown, which adds condition status per session.
29. **The contract-names browser test builds accessible names by hand and can miss a misnamed contract (D8R, ocr's third round on T8R.27-B2; recorded 2026-11-17 under decision P2, at the user's direction).**
    - **What the test does.** `e2e/d8r/names.spec.ts` (B8R.5) checks that a screen reader hears each contract name as shown (P114). It works out each element's accessible name from the page's markup itself, instead of reading the name Chromium computes. That leaves two gaps:
      - **A label inside a button.** For `<button><span aria-label="Open">XYZ Dec 18 $55 Call</span></button>`, a screen reader announces "Open". The test takes the button's name from its text, so it passes.
      - **Labelled elements of other roles.** For something like `<div role="img" aria-label="Open">XYZ Dec 18 $55 Call</div>`, the test keeps no visible text. Its label is never compared with the contract it shows. The same applies to checkboxes, switches and cells.
    - **Current effect.** Neither pattern exists in the app today. The test passes on every screen, and D8R's gate critic found every accessible name equal to its visible text.
    - **Fix.** Read the computed names from Chromium's accessibility tree, through CDP `Accessibility.getFullAXTree` or Playwright's accessible-name support, and compare those. This closes both gaps and any others like them. Show each gap red first with a planted mutation, as T8R.27-B1 and T8R.27-B2 did.
    - **Trigger.** The next change to `e2e/d8r/names.spec.ts`, or D10's breakdown, which adds new contract screens for spreads.
