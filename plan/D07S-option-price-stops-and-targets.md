# D7S — Option-price Stops and Targets: task breakdown

Definition: [implementation plan, D7S](implementation-plan.md#d7s--option-price-stops-and-targets). The definition (story, capability set, introductions, acceptance claim) stays there and is not repeated here. D7S builds on D7's option Plans, `assessPlan`, `evaluate` and Plan form (A99–A122, P24 recorded as decision 31; [D7 breakdown](D07-single-leg-options-happy-path.md)), D7's approved words ([`D07-approved-words.md`](D07-approved-words.md), decision 87), and the D7S prefactor's Mark-to-Market Valuation ([D7S prefactor breakdown](D07S-prefactor-mark-to-market-valuation.md), decision 101). It is drafted from the tag `claude-opus-5.5-d7sp` (commit `27970527`).

Status: **breakdown agreed by the user on 2026-11-11** (plan revision 78, decision 107). P90–P93 and the size check's choice of one breakdown with a checkpoint critic (section 1.4) were agreed as recommended, and the words in section 1.6 were approved the same day. The amendments in section 1.2 are applied. Everything else is written against those decisions and the working assumptions below. **Amended by decision 108 (revision 80, 2026-11-11):** T7S.3 runs straight after T7S.1, and T7S.2 after T7S.3 (section 3). The next plan decision is 109.

---

## 1. Decisions and clarifications

### 1.1 Decisions for this breakdown

Numbering continues from the D7S prefactor's P77–P89.

| # | Question | Recommendation | Alternatives and tradeoff |
|---|---|---|---|
| P90 | **How many Stops and Targets may an option Plan hold?** The glossary makes underlying-price and structure-value conditions independent OR conditions, and decision 89 lifts A100's "exactly one". It sets no upper limit. | **Agreed 2026-11-11 (decision 107): at most one condition of each kind per role**: an option Plan has one or two Stops (one on the Underlying, one on the option's price, or both) and likewise one or two Targets. A second condition of a kind already present returns `ConditionKindRepeated`, naming the extra conditions. This replaces `ConditionCountNotOne` for every Plan. A Long Stock Plan keeps one Stop and one Target (D1 A1), because its only kind is its own price. Two conditions of the same kind are redundant: the nearer one is always crossed first, so it alone decides the headline. | (a) Any number of each kind: the arithmetic handles it, but the Plan form needs add and remove rows, and no Plan gains meaning from it. (b) Exactly one of each kind on every option Plan: forces a trader who wants only an option-price Stop to also enter an Underlying one. |
| P91 | **What is the headline when one condition can be read and another can't?** An option Trade's underlying-price conditions need the Underlying's Mark, and its option-price conditions need only the contract's Mark (decision 31, A110). The glossary's headline "becomes zero when any condition is crossed". | **Agreed 2026-11-11 (decision 107): the headline is the minimum of the condition distances, returned only when the readings that are available already fix it.** Ongoing Risk to Stop is a Value when every Stop condition is a Value (their minimum), or when some available Stop condition's distance is zero (crossed, or at its boundary), which makes the minimum zero. Otherwise it is the first Unavailable condition's result in Plan order, with its reason. The same holds for Incremental Reward to Target. For a stock Trade, or an option Trade with one condition per role, this equals D7's figures. Example (O-S2, section 4): on Wednesday, with the put's Mark and no MNO Mark, Ongoing Risk to Stop is $0.00, because the option-price Stop is breached, while Incremental Reward is `Unavailable(MarkMissing)` naming MNO. | (a) The minimum over the available readings only: shows a number that a missing Mark could make wrong, such as a positive risk while the Underlying Stop may already be crossed. (b) Unavailable whenever any condition is Unavailable: hides the known zero after a breached option-price Stop, which is the figure the trader most needs. |
| P92 | **How does the Plan form offer the condition kind?** The definition says "the Plan form offers the condition kind for each Stop and Target". | **Agreed 2026-11-11: two fixed price fields per role for an option Strategy**: the existing Underlying field and an option-price field beside it, each optional, with at least one per role (W1–W3 in section 1.6). A filled field submits its condition; an empty one submits none. The Underlying field comes first, so conditions are stored in that order. Long Stock keeps its one Stop and one Target field. This fits P90 exactly, needs no add or remove controls, and keeps D7's field names and labels for the Underlying conditions. | (a) A kind selector beside each Stop and Target, with "Add a Stop": more flexible, but more controls on a phone and more ways to submit a repeated kind. (b) One field per role with a kind toggle: can't express both kinds at once, which the story asks for. |
| P93 | **Does an option Trade with only option-price conditions still need the Underlying's Mark each session?** Under A110 the Underlying's Mark serves the condition status (no longer needed then) and the value at expiration at the latest close (A122, still shown). | **Agreed 2026-11-11: yes, keep A110 unchanged:** every open option Trade asks for both Marks until D11's provider fills them. A122's figure on Detail and the Review card still needs the Underlying's close, and one rule for every option Trade keeps the Review's Mark tasks predictable. | (a) Ask for the Underlying's Mark only when the Plan has an Underlying condition: one less Mark task per such Trade, but A122's figure then reads "Mark missing" on every session, and the requirement depends on the Plan's conditions as well as its Instruments. |

### 1.2 Amendments to other plan sections (agreed 2026-11-11 and applied in revision 78)

- **D7 A100 and decision 89.** A100's "exactly one underlying-price Stop and one underlying-price Target" becomes "one or two Stops and one or two Targets, at most one of each kind (P90)". `ConditionCountNotOne` is removed from `PlanIssue`, `plan-issues.ts` and D7 approved-words row 19.23; `ConditionKindRepeated` and `ConditionKindNotApplicable` take their words from section 1.6 (W9).
- **D7 approved words.** Rows 19.9 and 19.10 gain the option-price labels (W1). The note "Risk and reward are measured by the option's value at expiration at these prices" (A116, which row 19.x left unchanged) becomes W2. Row 23.17's conditions table gains W7, and the Detail Stop and Target figures become W6. Each amended row points to this section.
- **D8 breakdown (agreed 2026-10-17).** D8 now follows schema 7, not 6. P31 and A145 read "export schema 7; Restore from schemas 1 through 7". A126's capability footprint adds `condition.structureValue`. Every "schema 6" in D8's cases (I8.x restored "Ready at schema 6", About "shows schema 6") reads schema 7, and D8's latest fixture is `workspace-v7/`. D8's breakdown is amended by its own revision when D8 starts. It is listed here so that revision is not missed.
- **D10 definition.** Its capability and durable-representation lines already say that D10 extends D7S's single-leg kind to structures. No change is needed.
- **Plan open questions.** "Raised by the D4 breakdown", item 3 (AC-CALC-003's "one crossed Stop and one reached Target" needs structure-value conditions) is resolved for single legs by D7S (I7S.4); D10 keeps the multi-leg part.
- **Spec map and reading list (A205).** No retag. D7S's implementation reading list is `plan/spec-reading/D07.md`.

### 1.3 Working assumptions

Numbering continues from the D7S prefactor's A189–A194. These are implementation-level choices that do not reopen product semantics. They stand unless you object.

| # | Assumption |
|---|---|
| A195 | **Option-price condition fact:** `{ kind: 'StructureValue', price }` beside D7's `{ kind: 'UnderlyingPrice', price }` in `ConditionInput`. `price` is a price per share of the contract, a positive finite decimal with at most 6 fractional digits (`InvalidPrice` otherwise), stored normalized, with its own fact identity like every Stop and Target (D1 A1). Only an option Plan may hold one; on a Long Stock Plan it returns `ConditionKindNotApplicable`. Code and types say "structure value", as the spec does; the screens say "option price" (section 1.6). |
| A196 | **Measurement and validation (decision 89):** an option-price condition is measured at its own price, with no value at expiration. Its boundary distance is contracts × 100 × (entry − price) for a long Stop and × (price − entry) for a short one; Targets mirror it. Its `ConditionBasis` has no `valueAtExpiration`, so it is never labelled as one (trade-analysis, `assessPlan`). One exported helper, `measurementOf(basis)` in `src/domain/trade-analysis/plan.ts`, returns `valueAtExpiration` when present and the condition's price otherwise. It replaces the three `valueAtExpiration ?? price` fallbacks (section 1.5, checks). Validation is per condition. A long option's option-price Stop must be below the intended entry and its Target above it; the Cash-Secured Put reverses both. Failures are `NoPositiveRisk` and `TargetNotBeyondEntry`, with `details.condition` naming the role, the 1-based position in Plan order, and the kind. Only an underlying-price issue names the breakeven (A100, decision 87 K12). Issues are de-duplicated by code and condition, not by code alone. `StopTargetOrder` compares only underlying-price Stops with underlying-price Targets; option-price conditions are ordered by the entry checks. |
| A197 | **Headline conditions:** in the Plan Baseline, the condition with the nearest boundary in each role (the smallest distance, with Plan order breaking a tie) is that role's headline condition. 1R and Original Planned Reward already use it (`nearest`). The at-entry line, Entry Quality and the Review's at-entry pressure take its measurement value in place of the first condition's. Because each distance is the planned contracts times a fixed price difference, the same condition is nearest at any entry price. The current headline figures follow P91. |
| A198 | **`evaluate` per condition:** an option-price condition is read at the contract's exact Mark. A long Stop is crossed at or below its price and a long Target at or above it; the Cash-Secured Put reverses both (D4 A42's contact rule). Its distance is contracts × 100 × the price difference toward the boundary while not crossed, zero once crossed. Its Overrun is the amount beyond, in dollars and Plan R. Its evidence is the contract's frame, and it has no `underlying` part. Underlying-price conditions are read as in D7 (decision 31, A109). `ConditionStatus.kind` carries each condition's kind. Ids stay `stop-<n>` and `target-<n>` in Plan order. `expirationValueAtUnderlyingClose` is `NotApplicable(NoOptionExpirationAnchor)` only when the Trade has no option, never because its first Stop has no value at expiration. |
| A199 | **Storage (schema version 7):** schema 7 admits the `StructureValue` condition kind. Every stored condition already carries `kind` (`UnderlyingPrice` since schema 1, section 1.5's shapes lookup), so no record changes. As in `v5→v6` (decision 84), the `v6→v7` transform only drops private fields for the rebuild after the chain (D8 A139). No new store or index, and Instrument keys, the Catalog manifest and Market Data are unchanged. The Installed Capability Manifest reports schema 7. |
| A200 | **No new stored-Plan check:** the Trade section validator still tests only shape match and Exercise Intent (decision 88; D7 approved-words row 11.3). A stored option-price condition is measured at its price wherever it sits. D8's Restore inherits this. |
| A201 | **Lists show one badge per role:** an Open row shows "Stop breached" once when any Stop is breached and "Target reached" once when any Target is reached, as D7 words them. Two badges with the same words would add nothing on a narrow row. Detail and the Review card list every condition (W7, W8). This is how D7S reads the definition's "the lists show every condition": the row shows every crossed role, and an active condition shows nothing (D7). |
| A202 | **Capability manifest:** `TradeWorkflows.confirmPlan` gains the variant `StructureValueCondition`. No other operation or variant changes, because every read already carries `conditions`. |
| A203 | **Benchmark at D7S:** the generator version is bumped and the dataset regenerated at schema 7. Counts and lifecycles are unchanged (D7 section 1.4, decision 95). Of the option Plans, 30% hold an option-price Stop beside their Underlying Stop, and 10% hold only option-price conditions. Results are compared with the D7S prefactor's accepted numbers (`evidence/D07SP/bench-r3.md`, tech debt item 22). |
| A204 | **Schema-v7 fixture:** the v7 dump adds to the v6 content O-S2 (section 4) after S1′, with MNO 44.60 and the put 3.65 as Friday 11-20's Marks, so the frozen views hold an option-price Stop Breached and an Underlying Target Reached. O-S2's contract expires 2026-12-18, so it is not due at the fixture's as-of instant. `verify:fixtures` requires the v7 snapshot to hold at least two `StructureValue` conditions in its Open details, as it requires the v6 content (D7 T7.27). |
| A205 | **Reading list:** D7's tags already cover every spec section D7S uses, including AC-CALC-003 (S052), glossary S252, `assessPlan` S165, Daily Review S090 and Daily Bar use S126 (section 1.5). So D7S follows D5R's precedent: no retag, and its implementation sessions read `plan/spec-reading/D07.md`. A `D7S` tag would also break `.claude/scripts/spec-reading-lists.py`, whose `dnum` parses the digits after "D". |

### 1.4 Size check and the split proposal

The task graph (section 3) has 17 tasks, 4 open decisions (P90–P93); the words batch is approved. The schema change reaches every layer: domain (T7S.3–T7S.5), persistence (T7S.1), a coordinator (T7S.6) and UI (T7S.8–T7S.10). That meets the guide's second criterion, so here is a split.

**Proposed seam: D7S-1, option-price conditions in place of Underlying ones, then D7S-2, both kinds together.**
- **D7S-1** covers schema 7, `ConditionKindNotApplicable`, option-price measurement and readings in `assessPlan` and `evaluate`, a kind choice per role in the Plan form, and Detail showing the kind. A100's "exactly one Stop and one Target" stays. Its gate is light: the cumulative suites and a browser critic. It still needs the capacity re-measure (T7S.2), because `verify:capacity` fails at a new schema version.
- **D7S-2** lifts "exactly one" (P90), adds the headline across conditions (P91), Entry Quality and pressure from the headline condition, both fields per role, the Review card's conditions, the source check, and the full structural tail.
- **What D7S-1 leaves unfinished:** the story's "together with an Underlying-price one", and AC-CALC-003 (one crossed Stop and one reached Target at once needs both kinds). Nothing is released for real use between the parts, so a trader never sees the in-between state.

**Agreed 2026-11-11: keep one breakdown, with a checkpoint critic (T7S.12) after the UI tasks and before the structural tail.** The split would build the Plan form twice: a kind selector in D7S-1 that D7S-2 replaces with two fields (P92). It would also rework `evaluate`'s headline twice and double the critic cost. The work is 9 behavioral tasks, against D7's 27. The checkpoint gives the same early browser look at the UI that the split's light gate would.

### 1.5 Lookups (drafting guide)

All run on `claude-opus-5.5-d7sp` (`27970527`).

**Texts.** Each changing text, grepped in `e2e/`, `tests/` and `src/**/*.test.*`. Every hit is an expectation that changes, in the task named.

| Old text | Hits | Changes in |
|---|---|---|
| "Risk and reward are measured by the option's value at expiration at these prices" | `src/ui/screens/PlanForm.test.tsx:582` | T7S.8 (W2) |
| "An option Plan takes one Stop and one Target." / `ConditionCountNotOne` | `src/ui/screens/plan-issues.test.ts:27`; `src/domain/trade-analysis/plan-option.test.ts:158`, `:161`; `tests/integration/d7/rejections.test.ts:68`, `:77`, `:81`, `:83` | `plan-option.test.ts` and `rejections.test.ts` in T7S.3 (the second Stop and second Target become `ConditionKindRepeated`); `plan-issues.test.ts` in T7S.8 (W9) |
| The Detail Stop and Target figures for an option ("48.00", "60.00") | `src/ui/screens/TradeDetailOptions.test.tsx:286`, `:287` | T7S.9 (W6: "XYZ at or below 48.00", "XYZ at or above 60.00") |
| The conditions table's row label "Stop" / "Target" on an option Trade | `src/ui/screens/TradeDetailOptions.test.tsx:272`–`:276` (`cell('Stop', …)`, `cell('Target', …)`) | T7S.9 (W7: rows "Stop on XYZ", "Target on XYZ") |
| "Stop (XYZ at or below)", "Target (XYZ at or above)" and the other Underlying labels | `src/ui/screens/PlanForm.test.tsx:577`–`:740` (16 hits) | none: W1 keeps them |
| "Value at expiration", "Distance on XYZ", "Stop and Target conditions" | `TradeDetailOptions.test.tsx:93`, `:99`, `:264`, `:270`; `CardFigures.test.tsx:95`, `:99`; `e2e/d7/settlement-due.spec.ts:50` | none: W7 keeps the columns, and an option-price row shows "—" in them |
| The Long Stock Detail figures "$47.50", "$56.00" | `src/ui/screens/TradeDetail.test.tsx:68`, `:69`, `:474`, `:475`, `:487`, `:488` | none: a stock Plan is unchanged (W6) |
| `e2e/d7/plan-open.spec.ts:47`, `:48` (probe reads `{ kind: 'UnderlyingPrice', price: '48' }`) | 2 | none: the stored shape is unchanged |

**Shapes.** `ConditionInput`, `ConditionStatus.kind` and `PlanIssue.details` change; no field is removed or retyped. Grep of `tests/fixtures/` and the verify tools:

```text
stopBasis / targetBasis: workspace-v1..v6 expected-views.json (5, 8, 14, 16, 33, 41 hits each)
valueAtExpiration:       workspace-v6 expected-views.json (16)
"conditions":            workspace-v3..v6 expected-views.json (9, 11, 26, 31)
"boundary":              workspace-v3..v6 expected-views.json (18, 22, 52, 62)
measurementValue, extraConditions: no hits
tools: verify-fixtures.ts, fixture-views.ts, bench-expected-rows.ts, bench-run.ts, capacity/: no condition fields
```

`compareSnapshot` (`tools/fixtures/snapshot-compare.ts`) compares only the keys a snapshot holds. A v1–v6 Trade keeps its single `UnderlyingPrice` conditions, `valueAtExpiration` stays on them, and D7S adds no field to a basis (A196 uses a helper, not a field). So **no v1–v6 expected view changes**, and the v6 content check in `verify-fixtures.ts:122` still holds. `SCHEMA_VERSION` is read by `verify-capabilities.ts:69`, `verify-fixtures.ts`, `verify-capacity.ts:16`, `measure-capacity.ts:41`, `fixtures-freeze.ts:31`, `bench-generate.ts:38`, `bench-run.ts:81`, `bench-partial.ts:90` and `verify-releases.ts:41`. Of these, only `verify:capacity` runs in every task's checks and fails at schema 7 until re-measured, so T7S.2 runs straight after T7S.1 (D7 instead carried that known failure from T7.7 to T7.26). **Amended by decision 108 (revision 80):** T7S.2's measurement confirms option-price conditions through the facade, which needs T7S.3, so T7S.3 runs straight after T7S.1 and T7S.2 after it; T7S.3 alone carries the known failure. `verify:releases` checks `d6` against `SCHEMA_VERSION`, but no release is built (decision 76), so it doesn't run. `bench:run` refuses a dataset stamped schema 6 until T7S.14 regenerates it, and it is not in the cumulative run.

**Checks.** T7S.11's rule, run as a throwaway config on `src` (non-test files): `no-restricted-syntax` on `MemberExpression[computed=true][property.type='Literal']` whose object is a member named `stops`, `targets`, `stopBasis` or `targetBasis`. Hits, and what happens to each:

```text
src/coordinators/daily-review/attention.ts   53:37, 53:67                        T7S.6 reads the headline condition (A197)
src/domain/trade-analysis/derive.ts          776:16, 776:68, 777:18, 777:72      T7S.5 reads the headline condition
src/domain/trade-analysis/evaluate.ts        215:16, 215:74, 216:18, 216:78      T7S.4 (at-entry line, A197)
                                             363:77, 366:79                      T7S.4 (headline from the condition results, P91)
                                             387:9                               T7S.4 (anchor from the option, A198)
src/ui/screens/TradeDetail.tsx               155:16, 156:18, 311:16, 312:18      T7S.9 (every condition, W6)
```

`TradeDetail.tsx:505` indexes `stopBasis` by a computed position, which the rule allows, and is kept. `tools/`, `tests/`, `e2e/` and the 11 test-file hits under `src/` are outside the rule's files. After T7S.4–T7S.6 and T7S.9 the rule has no hits, which T7S.11 proves.

### 1.6 Approved words

**Approved by the user on 2026-11-11** on a review page (`https://claude.ai/artifact/99VXZp5VTemJNLzP8xAZTg`): W1–W3 and W5–W10 as proposed; W4 changed to the user's words. Task briefs name the rows they use, and words no row covers still need approval.

Examples use O-S2 (MNO, a Cash-Secured Put) and O-C2 (XYZ, a Long Call) from section 4. Conventions C1–C8 of the D7 approved words apply. An option price has a "$" and two decimals, as in C5 ("$3.60"); an Underlying price keeps C3 ("41.00"). `verify:wording` still applies.

| # | Where, and the code or state | Approved words |
|---|---|---|
| W1 | Plan form, option Strategy: the option-price fields beside rows 19.9 and 19.10's Underlying fields, which keep their labels | Long Call and Long Put: "Stop (option price at or below)", "Target (option price at or above)". Cash-Secured Put: "Stop (option price at or above)", "Target (option price at or below)". |
| W2 | Plan form note under the four price fields (replaces "Risk and reward are measured by the option's value at expiration at these prices") | "Enter a price on MNO, an option price, or both. A price on MNO is measured by the option's value at expiration there; an option price is measured as entered. The nearer one sets the risk or reward." With no symbol typed yet, "MNO" reads "the Underlying". |
| W3 | Field error beside the Underlying field; `MissingStop` / `MissingTarget` on an option Plan | "Enter a Stop on MNO, an option price, or both." / "Enter a Target on MNO, an option price, or both." |
| W4 | Field error beside the option-price Stop; `NoPositiveRisk` with an option-price condition | Long Call and Long Put: "The option-price Stop must be below the intended entry price to calculate Risk properly." Cash-Secured Put: "The option-price Stop must be above the intended entry price to calculate Risk properly." (The user's words, 2026-11-11, replacing the proposed "…, so the Plan has a positive risk.") |
| W5 | Field error beside the option-price Target; `TargetNotBeyondEntry` with an option-price condition | Long Call and Long Put: "The option-price Target must be above the intended entry price." Cash-Secured Put: "The option-price Target must be below the intended entry price." |
| W6 | Trade Detail, the Plan's Stop and Target figures (Planned detail and Summary card), one line per condition in Plan order | Option Plan: "MNO at or below 41.00" and "Option at or above $3.60" under Stop; "MNO at or above 44.50" and "Option at or below $0.30" under Target. A D7 option Plan reads "XYZ at or below 48.00" (was "48.00"). A stock Plan is unchanged ("$47.50"). |
| W7 | Trade Detail, conditions table (amends row 23.17) | Condition column: "Stop on MNO", "Stop on the option price", "Target on MNO", "Target on the option price"; stock rows stay "Stop" and "Target". Boundary for an option-price row: "$3.60". "Value at expiration" and "Distance on MNO" for an option-price row: "—". |
| W8 | Review card, under the risk figures: a list headed "Conditions", one line per condition | "Stop on MNO at or below 41.00: Active"; "Stop on the option price at or above $3.60: Breached, $20.00 beyond"; "Target on MNO at or above 44.50: Reached"; a condition with no reading shows its reason's figure from `calculation-words.ts`, for example "Stop on MNO at or below 41.00: Mark missing: MNO, Wed Oct 14". A stock card reads "Stop at or below $47.50: Active". |
| W9 | Plan issue sentences for codes the form can't produce (amends row 19.23) | `ConditionKindRepeated`: "A Plan takes at most one Stop and one Target of each kind." `ConditionKindNotApplicable` (on the stock form's issue list): "A stock Plan takes no option-price Stop or Target." `ConditionCountNotOne`'s sentence is removed. |
| W10 | Field error beside an option-price field; `InvalidPrice` | "Enter an option price greater than zero, with at most 6 decimal places." |

---

## 2. Implementation boundaries extended in D7S

| Canonical boundary | Code location | D7S operations |
|---|---|---|
| Trade Analysis (pure) | `src/domain/trade-analysis/` | `assessPlan` with option-price conditions, P90's count rule and per-condition issues; `measurementOf`; `evaluate` per condition and the headline (P91); Entry Quality from the headline condition |
| Daily Review | `src/coordinators/daily-review/` | pressure and range position from the headline condition (`attention.ts`) |
| Workspace | `src/coordinators/workspace/` | Installed Capability Manifest: `StructureValueCondition` on `confirmPlan`; schema 7 reported |
| Persistence/Transaction (internal) | `src/persistence/` | `SCHEMA_VERSION` 7 |
| Migrations | `src/persistence/migrations/` | `v6→v7` and the `v1→…→v7` chain |
| UI | `src/ui/` | Plan form option-price fields; Detail figures and conditions table; Review card conditions; list badges per role |
| Lint | `eslint.config.js` (a new `eslint.conditions.config.js` merged in, as `eslint.wording.config.js` is) | no reads of only the first Stop or Target |

Trade Record, Market Data, the Reference Catalog, Trade Workflows, Trade Views and the valuation module need no code change. They carry `ConditionInput` and `ConditionStatus` through by type, and the integration suite proves them (I7S.3, I7S.4).

---

## 3. Task graph

Kind: **B** = behavioral (TDD, red→green per case), **S** = structural (exact verification).

| Task | Title | Layer | Kind | Blocked by | Public seam under test |
|---|---|---|---|---|---|
| T7S.1 | Persistence: schema 7 and the `v6→v7` transform | persistence | B | — | internal `Persistence`, `migrationChain` |
| T7S.2 | Capacity basis re-measured at schema 7 | test/infrastructure | S | T7S.1, T7S.3 (decision 108) | `measure:capacity`, `verify:capacity` |
| T7S.3 | Trade Analysis: `assessPlan` with option-price conditions | domain | B | — | `TradeAnalysis.assessPlan` |
| T7S.4 | Trade Analysis: `evaluate` per condition and the headline | domain | B | T7S.3 | `TradeAnalysis.evaluate` |
| T7S.5 | Trade Analysis: Entry Quality from the headline conditions | domain | B | T7S.3 | `TradeAnalysis.derive` |
| T7S.6 | Daily Review: pressure and range position from the headline conditions | application | B | T7S.4 | `DailyReview.open` |
| T7S.7 | Installed Capability Manifest for D7S | application | S | T7S.1, T7S.3 | `verify:capabilities` |
| T7S.8 | UI: option Plan form with both kinds | UI | B | T7S.3, T7S.7 | `PlanForm` |
| T7S.9 | UI: Trade Detail shows every condition | UI | B | T7S.4 | `TradeDetail` |
| T7S.10 | UI: Review card conditions and list badges | UI | B | T7S.4, T7S.6 | `ReviewCard`, `TradeList` |
| T7S.11 | Source check: no first-condition reads | lint | S | T7S.4–T7S.6, T7S.9 | `npm run lint` |
| T7S.12 | Checkpoint browser critic (section 1.4) | test | S | T7S.8–T7S.11 | fresh critic report |
| T7S.13 | Freeze the schema-v7 fixture | test | S | T7S.1, T7S.4 | `fixtures:freeze`, `verify:fixtures` |
| T7S.14 | Benchmark at schema 7 | test | S | T7S.13 | `build:bench`, `bench:generate`, `bench:run` |
| T7S.15 | Node mock-free integration suite | test | S | T7S.1–T7S.10 | `test:integration` |
| T7S.16 | Browser integration suite (Chromium) | test | S | T7S.8–T7S.13 | `test:e2e` |
| T7S.17 | Independent browser-critic gate | test | S | all | fresh critic report |

**Run order:** T7S.1, T7S.2, T7S.3, T7S.4, T7S.5, T7S.6, T7S.7, T7S.8, T7S.9, T7S.10, T7S.11, T7S.12, T7S.13, T7S.15, T7S.16, T7S.14, T7S.17. The schema comes first, so no commit stores an option-price condition at schema 6, and T7S.2 follows it at once, so no task's checks carry a known `verify:capacity` failure. **Amended by decision 108 (revision 80):** the run order is T7S.1, T7S.3, T7S.2, T7S.4, then as above, because T7S.2's measurement confirms option-price conditions through the facade, which T7S.3 builds. T7S.3's checks carry the known `verify:capacity` failure, recorded and not fixed. The benchmark runs after the suites, so a fix found by them is measured. Every UI task takes its words from section 1.6.

---

## 4. Behavioral tasks

Every case runs **red → green** individually, as the kickoff prompt requires. A case that passes on its first run, or fails for a syntax, configuration, fixture or unrelated reason, is not valid red evidence. A genuine first-run pass needs a mutation check (an assertion failure or runtime exception, not a compile error) and is flagged. Cases are ordered so that each one needs behavior the earlier ones don't, and each fold is named.

All dates are 2026, New York time. Plans are confirmed Monday 10-12 09:00. **O-S2 and O-C2 use contracts expiring Friday 2026-12-18**, so nothing in D7S is Settlement Due.

**O-S2, Cash-Secured Put with both kinds**, on MNO: MNO 18 Dec 2026 45 Put, short. Plan −2 contracts at 1.20 (breakeven 43.80). Conditions in Plan order:
- **S-u** "MNO at or below 41.00" (value at expiration 4.00; distance 2 × 100 × (4.00 − 1.20) = $560)
- **S-o** "option at or above 3.60" (decision 89's buy-back at twice the premium; distance 2 × 100 × (3.60 − 1.20) = **$480**)
- **T-u** "MNO at or above 44.50" (value 0.50; distance 2 × 100 × (1.20 − 0.50) = **$140**)
- **T-o** "option at or below 0.30" (distance 2 × 100 × (1.20 − 0.30) = $180)

So 1R = **$480** (from S-o), Original Planned Reward **$140** (from T-u), ratio **7/24**. **S1′** Monday 10:00, Sell 2 @ 1.25, fee 1.30. The Marks for MNO and the put:

| Session | MNO | Put | S-u | S-o | T-u | T-o | Headline risk / reward |
|---|---|---|---|---|---|---|---|
| Tue 10-13 | 44.00 | 1.80 | Active $440 | Active **$360** | Active **$260** | Active $300 | $360 (3/4 R) / $260 (13/24 R) |
| Wed 10-14 | 43.20 | 3.70 | Active $60 | **Breached**, Overrun $20 (1/24 R) | Active $640 | Active $680 | $0 / $640 |
| Thu 10-15 | 44.60 | 3.65 | Active $70 | **Breached**, Overrun $10 | **Reached**, Overrun $0.00, MNO 0.10 beyond | Active $670 | $0 / $0 |

Thursday is a volatility spike: the put trades rich while MNO recovers, so one Stop is crossed and one Target is reached at once (AC-CALC-003). Worst-Case Ongoing Risk on Thursday is 2 × 100 × (45 − 3.65) = $8,270 (827/48 R); Maximum Incremental Reward 2 × 100 × 3.65 = $730.

**O-C2, Long Call with both kinds**, on XYZ: XYZ 18 Dec 2026 55 Call. Plan 2 contracts at 2.00, Exercise Intent NotAuthorized. Stops "XYZ at or below 48.00" (value 0, $400) and "option at or below 1.00" (**$200**); Targets "XYZ at or above 60.00" (value 5.00, $600) and "option at or above 4.00" (**$400**). 1R **$200**, reward **$400**, ratio 2. **P1′** Monday 10:00, Buy 2 @ 2.00, fee 1.30.

**T-A** (D6's Long Stock) and **O-S** (D7's Cash-Secured Put, one condition per role) are the unchanged comparisons.

Test support: `os2Record` and `oc2Record` join `src/domain/trade-analysis/option-trade.ts`.

### T7S.1 Persistence: schema 7 and the `v6→v7` transform

Seam: the internal `Persistence` interface and `migrationChain` (A199). New file `src/persistence/schema-v7.test.ts`, modelled on `schema-v6.test.ts`.

```text
describe("schema 7 (A199)")
  it should open a schema-6 database holding an option Trade at schema 7 with every authoritative record unchanged, private fields dropped for the rebuild, and migrationChain(1) reaching 7
```

Folded: storing and reading back a `StructureValue` condition is generic persistence and would pass on its first run; I7S.3's dump proves it.

### T7S.2 Capacity basis re-measured at schema 7

Structural (section 5).

### T7S.3 Trade Analysis: `assessPlan` with option-price conditions

Seam: `TradeAnalysis.assessPlan` (pure). Cases join `src/domain/trade-analysis/plan-option.test.ts`. Its two `ConditionCountNotOne` cases (`:158`, `:161`) and `tests/integration/d7/rejections.test.ts:68`–`:83` change to `ConditionKindRepeated` with the same extra conditions.

```text
describe("assessPlan: option-price conditions (decision 89, A195, A196)")
  it should accept O-C2 with 1R $200 from the option-price Stop, reward $400 from the option-price Target, ratio 2, and four per-condition bases in Plan order, the Underlying ones carrying values at expiration 0 and 5.00 and the option-price ones none; and accept O-S2 with 1R $480 from S-o, reward $140 from T-u and ratio 7/24, its option-price conditions left out of StopTargetOrder
  it should reject O-C2 with its option-price Stop at 2.50 and its Underlying Stop at 58.00 with two NoPositiveRisk issues, each naming its condition (Stop 2 StructureValue with no breakeven; Stop 1 UnderlyingPrice with the breakeven 57.00), and O-S2 with its option-price Target at 1.50 with TargetNotBeyondEntry naming Target 2
  it should reject an option Plan with two option-price Stops, or two Underlying Targets, with ConditionKindRepeated naming the extra conditions
  it should reject T-A with an option-price Stop added with ConditionKindNotApplicable
```

Folded: the option-price measurement on the short side is in case 1's O-S2 half. It needs no code beyond the long side, and alone it would pass on its first run. `measurementOf` is exercised through T7S.4 and T7S.5.

### T7S.4 Trade Analysis: `evaluate` per condition and the headline

Seam: `TradeAnalysis.evaluate` (pure). New file `src/domain/trade-analysis/evaluate-conditions.test.ts`.

```text
describe("evaluate: option-price conditions (A198)")
  it should read O-S2 on Wednesday as four conditions in Plan order with their kinds: S-u Active $60 with MNO 2.20 away, S-o Breached at the put's 3.70 with Overrun $20 (1/24 R) and the contract's Mark as evidence and no Underlying part, T-u Active $640, T-o Active $680
  it should read O-C2 after P1′ with the call at 0.95 as its option-price Stop Breached with Overrun $10 and its XYZ Stop Active, and with the call at exactly 4.00 as its option-price Target Reached

describe("evaluate: the headline across conditions (P91, A197)")
  it should take O-S2's Tuesday Ongoing Risk to Stop $360 (3/4 R) from S-o, nearer than S-u's $440, and Incremental Reward $260 (13/24 R) from T-u, with Reward : risk now 13/18
  it should return Ongoing Risk to Stop $0.00 for O-S2 on Wednesday with the put's Mark and no MNO Mark, because S-o is Breached, while Incremental Reward is Unavailable(MarkMissing) naming MNO and 2026-10-14; and on Tuesday with no MNO Mark return Ongoing Risk Unavailable(MarkMissing) naming MNO
  it should measure O-S2's at-entry line from S-o and T-u: on Monday 10-12 with the put's Mark Missing and no earlier Mark, so S1′ is at entry, risk from entry $470 and reward from entry $150
  it should return the value at expiration at MNO's latest close for an option Plan whose only conditions are option prices, not NotApplicable(NoOptionExpirationAnchor)
```

Folded: Thursday's crossed Stop and reached Target at once (AC-CALC-003) needs no behavior beyond cases 1, 3 and 4, so I7S.4 proves it end to end with Worst-Case, Maximum Reward, Plan R and the empty Deviation set. O-S and T-A keep D7's and D4's figures, which their existing cases prove.

### T7S.5 Trade Analysis: Entry Quality from the headline conditions

Seam: `TradeAnalysis.derive` (pure). Cases join `src/domain/trade-analysis/entry.test.ts`.

```text
describe("Entry Quality with several conditions (A197)")
  it should derive O-S2's Entry Quality after S1′ from S-o and T-u: actual initial risk $471.30 (4713/4800 R), actual initial reward $148.70, slippage −$10.00
```

Folded: the `EntryAtOrBeyondStop` and `EntryAtOrBeyondTarget` flags use the same headline values in the same function, so they need no case of their own.

### T7S.6 Daily Review: pressure and range position from the headline conditions

Seam: `DailyReview.open` through `attentionOf` (`src/coordinators/daily-review/option-attention.test.ts`).

```text
describe("pressure with several conditions (A197)")
  it should give O-S2 in Tuesday 10-13's Review a pressure toward the Stop of 11/47, from S-o's at-entry risk $470 and its current $360, with the range position measured between S-o and T-u
```

Folded: Wednesday's band `BoundaryReached`, naming `stop-2` with Overrun $20, already follows from `evaluate`'s conditions (D4's attention rule iterates them), so I7S.6 proves it.

### T7S.7 Installed Capability Manifest for D7S

Structural (section 5).

### T7S.8 UI: option Plan form with both kinds

Seam: `PlanForm` against the facade test double (`src/ui/screens/PlanForm.test.tsx`), with words W1–W5, W9 and W10. `PlanForm.test.tsx:582` changes to W2, and `plan-issues.test.ts:27` to W9.

```text
describe("option Plan form: Stop and Target kinds (P92)")
  it should show, for the Cash-Secured Put on MNO, the fields "Stop (MNO at or below)", "Stop (option price at or above)", "Target (MNO at or above)" and "Target (option price at or below)" with W2's note, and submit O-S2 as two Stops and two Targets in that order with their kinds
  it should submit only the filled fields, so a Long Call with only "Stop (option price at or below)" 1.00 and "Target (XYZ at or above)" 60.00 sends one option-price Stop and one Underlying Target
  it should show W3 beside "Stop (MNO at or below)" when both Stop fields are empty, without submitting
  it should put a rejected option-price condition's error beside its own field, W4 for NoPositiveRisk on Stop 2 and W5 for TargetNotBeyondEntry on Target 2, and W10 for an option price that isn't a positive decimal
```

Folded: Long Stock's form is unchanged and keeps its tests. Values kept across a Strategy switch (D7 A116) extend to the new fields in case 1's view state and are re-proven by B7S.5.

### T7S.9 UI: Trade Detail shows every condition

Seam: `TradeDetail` against the facade double (`src/ui/screens/TradeDetailOptions.test.tsx`), with words W6 and W7. `:272`–`:276`, `:286` and `:287` change.

```text
describe("Trade Detail: every condition (W6, W7)")
  it should show a Planned O-S2's Stop as "MNO at or below 41.00" and "Option at or above $3.60" and its Target as "MNO at or above 44.50" and "Option at or below $0.30"
  it should list Wednesday's O-S2 conditions as four rows, "Stop on MNO" Active $60.00 with value at expiration $4.00 and 2.20 on MNO, "Stop on the option price" at $3.60 Breached with Overrun $20.00 and "—" in both option columns, then both Targets
```

### T7S.10 UI: Review card conditions and list badges

Seam: `ReviewCard` (through `CardFigures`) and `TradeList` against the facade double, with words W8 and A201.

```text
describe("Review card: conditions (W8)")
  it should list O-S2's four conditions on Wednesday's card with their status, "Stop on the option price at or above $3.60: Breached, $20.00 beyond", and an Unavailable condition by its reason's figure

describe("Open list: one badge per role (A201)")
  it should show one "Stop breached" badge on a row whose two Stops are both Breached
```

### T7S.11 Source check

Structural (section 5).

---

## 5. Structural tasks

| Task | Exact verification | Expected result | Notes |
|---|---|---|---|
| T7S.2 Capacity basis | `npm run measure:capacity`, then `npm run verify:capacity` | The basis is measured at schema 7. The option phase's 600 option Plans hold option-price conditions in A203's mix, so the measured bytes include them. `verify:capacity` exits 0. | Runs straight after T7S.1 (section 1.5, shapes). **Amended by decision 108 (revision 80):** runs straight after T7S.3, which T7S.1 precedes. |
| T7S.7 Capability manifest | `npm run verify:capabilities` | The manifest reports schema 7 and `StructureValueCondition` on `confirmPlan` (A202), and equals the reachable operations. | |
| T7S.11 Source check | Add `eslint.conditions.config.js` with section 1.5's selector and message, merged into `eslint.config.js`; plant `plan.stops[0]` in a non-test file under `src/`; `npm run lint` | With the plant, `lint` fails naming the planted line; without it, `lint` exits 0, and the throwaway run's 17 hits (section 1.5) are gone. | `tools/wording-rules.test.ts`'s pattern: a test in `tools/` lints a planted source string, so the plant is never committed. |
| T7S.12 Checkpoint critic | Fresh critic agent per section 7, flows C7S.1–C7S.4 | A structured report. Defects become bug tasks before the structural tail. | Section 1.4. |
| T7S.13 Schema fixture | `npm run fixtures:freeze -- --schema 7`, then `npm run verify:fixtures` | `workspace-v7/` adds A204's content to the v6 content. `verify:fixtures` opens v1–v6 migrated to 7 and v7 without migration, every one Ready with views equal to its snapshot, and the v7 snapshot holds at least two `StructureValue` conditions. | v1–v6 snapshots are unchanged (section 1.5, shapes). |
| T7S.14 Benchmark | `npm run build:bench && npm run bench:generate`, then `npm run bench:run` | A203's dataset at schema 7, with its counts, generator version and as-of instant in `bench/dataset.json`. Results go to `evidence/D07S/bench.md` and are compared with `evidence/D07SP/bench-r3.md`. A step more than 10% slower than r3 is reported to the user before the gate (tech debt item 22). | `tools/bench-run.ts` writes D7's evidence path; move the output aside and restore D7's file, as in the D7S prefactor. |
| T7S.15 Node integration suite | `npm run test:integration`, then `.claude/scripts/acceptance-commands.sh plan/D07S-option-price-stops-and-targets.md` | Every case in sections 6.1 of D1, D2, D4, D5, D6, D7, the D7S prefactor and D7S passes. The script exits 0 for the Node rows. | Cumulative regression. |
| T7S.16 Browser integration suite | `npm run test:e2e` (Chromium, stages `browser-1` and `browser-2`), then `.claude/scripts/acceptance-commands.sh plan/D07S-option-price-stops-and-targets.md` | Every case in sections 6.2 of D1 to D7S passes. The script exits 0 for every row. | `test:e2e:2`'s `e2e/d7` filter already matches `e2e/d7s/` (it matches `e2e/d7sp/` today), so `package.json` needs no change. |
| T7S.17 Browser critic | Fresh critic agent per section 7 | A structured report with every flow passing. | Deliverable gate. |

---

## 6. Mock-free integration tests

### 6.0 Disclosed test substitutes

D1's to D7's and the D7S prefactor's substitutes still apply. D7S adds none.

### 6.1 Node application-stack suite (`tests/integration/d7s/`)

Conventions are as in earlier deliverables. Clocks are fixed per case.

| Case | File | Given / When | Then (visible result and durable-state proof) |
|---|---|---|---|
| I7S.1 Migrate earlier fixtures | `migration.test.ts` | Load `workspace-v1/` through `workspace-v6/` separately; `initialize`; restart; `getStatus`. | Opened; after restart Ready at schema 7; views equal each fixture's snapshot, every condition `UnderlyingPrice`; the pointer names a new database and no candidate is listed. |
| I7S.2 Migration failure and retry (AC-REST-004, re-proven) | `migration.test.ts` | `workspace-v6/` with one Close Reason fact naming an unknown Catalog identity; `initialize`; restore it; Retry. | MigrationBlocked naming the issue; old stores equal the fixture apart from the IndexedDB version; never Ready; after Retry Opened, and Ready at schema 7 after restart. |
| I7S.3 Confirm O-S2 (AC-PLAN-001, re-proven) | `confirm-plan.test.ts` | Confirm O-S2; restart; `getTradeDetail`. | The result carries 1R $480, reward $140, ratio 7/24 and four per-condition bases; the dump holds four condition facts with their own identities, kinds and normalized prices; the Detail equals the result (AC-RESP-001). |
| I7S.4 One crossed Stop and one reached Target (AC-CALC-003) | `conditions.test.ts` | O-S2 after S1′ with section 4's Marks; `getTradeDetail` and `browseTrades` Open at Tuesday, Wednesday and Thursday 17:00; restart between. | Each day's four condition results and headlines equal section 4's table. Thursday: S-o Breached with Overrun $10, T-u Reached with MNO 0.10 beyond, S-u and T-o Active; Ongoing Risk and Incremental Reward $0.00; Worst-Case $8,270 (827/48 R); Maximum Reward $730; Current Marked P&L from the put's Mark. Lifecycle Open throughout. Deviation set empty in the evaluation and in the dump. |
| I7S.5 Underlying Mark missing (AC-CALC-002, re-proven) | `conditions.test.ts` | O-S2 after S1′, with only the put's Marks on Tuesday and Wednesday. | Tuesday: Ongoing Risk and condition S-u `Unavailable(MarkMissing)` naming MNO; S-o and T-o Values; valuation a Value. Wednesday: Ongoing Risk $0.00 from S-o, Incremental Reward `Unavailable(MarkMissing)` naming MNO and 2026-10-14 (P91). |
| I7S.6 Review with option-price conditions | `review.test.ts` | O-S2 after S1′; `open` at Tuesday and Wednesday 17:00; `getTrade`. | Tuesday: pressure toward the Stop 11/47. Wednesday: band `BoundaryReached` naming `stop-2` with Overrun $20; MNO and the put are each one Mark task. |
| I7S.7 Rejections write nothing | `confirm-plan.test.ts` | Confirm O-C2 with its option-price Stop at 2.50; O-S2 with two option-price Stops; T-A with an option-price Stop; O-S2 with an option-price price of 0. | `NoPositiveRisk` naming Stop 2; `ConditionKindRepeated`; `ConditionKindNotApplicable`; `InvalidPrice`. Every store dump unchanged. |
| I7S.8 Entry Quality | `conditions.test.ts` | O-S2 after S1′; `getTradeDetail`. | Actual initial risk $471.30, reward $148.70, risk 4713/4800 R, slippage −$10.00. |
| I7S.9 Fresh initialization at schema 7 | `migration.test.ts` | Empty factory; `initialize(zone)`. | Schema 7 created directly; no migration; manifest reports schema 7. |
| I7S.10 Rebuild equivalence (AC-REBUILD-001) | `rebuild.test.ts` | After I7S.4's Thursday: capture lists, Detail and the Review; `rebuildPrivateState`; capture again. | Normalized views equal; private indexes identical. |
| I7S.11 Write gate (AC-DEL-004, AC-DEL-006) | `runtime.test.ts` | Host fails the inventory check; `confirmPlan` O-S2; `Persistence.commit` directly. | `RuntimeNotWritable` at both; dumps unchanged; Detail still readable. |

### 6.2 Browser suite (`e2e/d7s/`, Playwright against the built app on `localhost:5175`)

Chromium only (decision 19). Dates use Playwright's clock on the production build. Durable state is proven by reload or full restart plus D1's read-only probe. Visible text follows section 1.6.

| Case | File | Procedure | Expected observable result and durable-state proof |
|---|---|---|---|
| B7S.1 Plan a Cash-Secured Put with both kinds | `plan.spec.ts` | Clock Monday 10-12 09:00: New Plan, Cash-Secured Put, O-S2's terms in all four price fields, reflection; confirm. Relaunch; open Detail. | 1R $480.00 and Reward : risk 0.29 after confirmation; Detail lists W6's four lines. The probe shows four conditions with their kinds and prices. |
| B7S.2 Plan validation | `plan.spec.ts` | Long Call O-C2 with the option-price Stop at 2.50 and both Target fields empty; Save. | W4 beside "Stop (option price at or below)" and W3 beside "Target (XYZ at or above)", focus on the summary, values kept; nothing saved after reload. |
| B7S.3 Detail and list on Thursday | `conditions.spec.ts` | O-S2 created through the UI with S1′ and section 4's Thursday Marks; open the Open list, then Detail. | One "Stop breached" and one "Target reached" badge on the row; Detail's conditions table shows S-o Breached and T-u Reached, Risk to stop and Reward to target $0.00. |
| B7S.4 Review card conditions | `conditions.spec.ts` | Same Trade; clock Wednesday 17:00; open the Review and walk to O-S2's card. | W8's four lines with "Breached, $20.00 beyond"; the card sits in the boundary band. |
| B7S.5 Responsive and accessible (AC-UI-001, AC-UI-002) | `responsive-a11y.spec.ts` | Half-fill the four price fields at 1280 px; resize to 390 px and back; axe on the option Plan form, Detail's conditions and the Review card's conditions; plan O-S2 by keyboard only. | Values survive; no WCAG 2.1 AA violations; status is text, not colour alone. |

---

## 7. Browser-critic flows

The critic receives the frozen `specs/`, the plan index, the D1 to D7 breakdowns, the D7S prefactor's and this one, and the list of future capabilities that must not be treated as defects: everything after D7S, including multi-leg structures and their structure-value conditions (D10), Management Revision of conditions (D17), Stop Discipline and Daily Bars (D12), Assignment and Exercise (D20), backup and Restore (D8), and provider prices (D11). It runs `npm run build && npm run preview` (port 5175) itself and does not edit code. The checkpoint critic (T7S.12) runs C7S.1–C7S.4; the gate (T7S.17) runs all six.

| Flow | Actions | Pass condition |
|---|---|---|
| C7S.1 Plan the buy-back | Plan a Cash-Secured Put on a 45 Put, 2 contracts at 1.20, with only an option-price Stop at 3.60 and an Underlying Target. | 1R $480.00 (twice the premium on 2 contracts); the Detail shows "Option at or above $3.60"; no Underlying Stop was required. |
| C7S.2 Both kinds | Plan with an Underlying and an option-price Stop and Target. | 1R and the original reward come from the nearer condition of each role; every condition is listed with its kind on Detail. |
| C7S.3 Crossing | Enter Marks that breach the option-price Stop while the Underlying Stop holds. | That condition shows Breached with its Overrun; Risk to stop $0.00; the Underlying Stop stays Active; the Trade stays Open, with no Deviation shown. |
| C7S.4 Validation | Enter an option-price Stop on the wrong side of the entry, and leave a Target empty. | Errors beside the right fields; nothing saved. |
| C7S.5 Review | With option-price conditions crossed, open the Review. | The card lists every condition with its status; the Trade is in the boundary band; both Mark tasks are asked. |
| C7S.6 Offline, responsive, keyboard, About | Stop the server and reload, then plan with both kinds; resize a half-filled form; open About. | Offline works; values survive; visible focus; About lists only D1 to D7S capabilities and schema 7. |

---

## 8. Acceptance matrix rows

Status values: `planned`, `covered`, `intentionally not advertised`. All rows are `planned`. AC-DEL rows cite Chromium evidence; other engines are **pending RC** (decision 19).

| Scenario | Deliverable | Tasks | TDD / structural | Integration case and fixture | Critic flow | Command or procedure | Expected result and durable-state proof | Failure / nonmutation / restart evidence | Status |
|---|---|---|---|---|---|---|---|---|---|
| AC-CALC-003 (partial: structure-value conditions on single-leg options, one crossed Stop and one reached Target at once) | D7S | T7S.3, T7S.4, T7S.9, T7S.10 | T7S.4 both groups | I7S.4; B7S.3 | C7S.2, C7S.3 | `npm run test:integration -- d7s/conditions` | Each condition's independent status and detail; headline Ongoing Risk, Worst-Case, Incremental Reward and Plan R follow the remaining Position and zero on crossing; Overrun disclosed; Deviation set empty | Lifecycle unchanged across restarts | planned (structures in D10, revision in D17) |
| AC-CALC-002 (partial: an option Trade with the Underlying Mark Missing, re-proven with option-price conditions) | D7S | T7S.4 | T7S.4 availability case | I7S.5 | — | `npm run test:integration -- d7s/conditions` | Option-price conditions and valuation Values; Underlying conditions Unavailable naming MNO; headline per P91 | — | planned |
| AC-PLAN-001 (re-proven: option-price conditions) | D7S | T7S.3, T7S.8 | T7S.3 case 1 | I7S.3; B7S.1 | C7S.1, C7S.2 | `npm run test:integration -- d7s/confirm-plan` | One Trade with four conditions, frozen basis, positive 1R, in one commit | Restart | planned |
| AC-PLAN-002 (re-proven: option-price rejections) | D7S | T7S.3, T7S.8 | T7S.3 rejection cases | I7S.7; B7S.2 | C7S.4 | `npm run test:integration -- d7s/confirm-plan` | Typed issues naming each failing condition | Dumps unchanged | planned |
| AC-REST-004 (partial: schema 7) | D7S | T7S.1 | T7S.1 case | I7S.1, I7S.2, I7S.9 | — | `npm run test:integration -- d7s/migration` | Old stores unchanged on failure; never Ready; Retry activates | Restart | planned ("exportable" in D8) |
| AC-RESP-001 (cumulative) | D7S | T7S.3 | — | I7S.3 | — | `npm run test:integration -- d7s/confirm-plan` | The confirmation result equals durable state | — | planned |
| AC-REBUILD-001 (cumulative) | D7S | T7S.1 | — | I7S.10 | — | `npm run test:integration -- d7s/rebuild` | Equal normalized views; rebuilt indexes identical | — | planned |
| AC-DEL-004, AC-DEL-006 (cumulative) | D7S | T7S.3 | — | I7S.11 | — | `npm run test:integration -- d7s/runtime` | `RuntimeNotWritable` at both boundaries | Dumps unchanged | planned; real-state **pending RC** |
| AC-CAP-001 (cumulative) | D7S | T7S.7 | `verify:capabilities` | — | C7S.6 | `npm run verify:capabilities` | Manifest equals reachable operations, schema 7 | — | planned |
| AC-UI-001, AC-UI-002 (cumulative) | D7S | T7S.8–T7S.10 | — | B7S.5 | C7S.6 | `npx playwright test e2e/d7s/responsive-a11y.spec.ts` | State kept across resize; axe clean | — | planned |
| AC-PERF-001 (cumulative) | D7S | T7S.14 | structural | A203 dataset | — | `npm run bench:run` | Budgets met with option-price conditions in the mix; compared with D7SP r3 | — | planned |

---

## 9. Clause-level acceptance check

| Scenario | Clause | Covered by | Finding |
|---|---|---|---|
| AC-CALC-003 | effective underlying-price and structure-value Stops/Targets | A195, T7S.3, I7S.3 | covered for single-leg options; structures in D10 |
| | one crossed Stop and one reached Target | section 4's Thursday, I7S.4 | covered: S-o Breached by the put, T-u Reached by MNO |
| | exact bound evidence is evaluated | A198 (contract frame for option prices, Underlying frame for MNO) | covered |
| | each condition retains independent OR status/detail | T7S.4 case 1, I7S.4, T7S.9, T7S.10 | covered |
| | headline Ongoing Risk, Worst-Case, Incremental Reward, Plan R follow the remaining Position | T7S.4 headline cases, I7S.4 | covered; P91 settles availability |
| | crossing produces disclosed Overrun | T7S.4 case 1, I7S.4 | covered in dollars and Plan R, with the MNO distance for T-u |
| | Target/revision is not classified as a Deviation | I7S.4 (empty Deviation set) | Target covered; revision is D17 |
| glossary, Stop and Target language | every condition remains visible | T7S.9, T7S.10, A201 | covered on Detail and the Review card; lists show each crossed role (A201) |
| | the headline uses the nearest monetary boundary and is zero when any is crossed | A197, P91, T7S.4 | covered |
| | never changes the Position or Lifecycle State by itself | I7S.4 | covered |
| trade-analysis, `assessPlan` | per-condition basis; an Underlying option Stop's frozen boundary is not labelled structure-value | A196, T7S.3 case 1 | covered: option-price bases carry no value at expiration, Underlying ones keep it |

**Review-queue items for D7S, and where they are resolved:** "Raised by the D4 breakdown", item 3 (AC-CALC-003 at once): I7S.4 for single legs. D7's "Raised by the D7 breakdown", item 2: D10 keeps structures.

---

## 10. Evidence recording

As in earlier deliverables, under `evidence/D07S/`: `tdd-log.md` (red and green per case), `structural.md`, `provenance.md`, `bench.md`, `critic-<n>.md` (the checkpoint and the gate), `suite-runs/` and `ocr/`. Each critic defect is first reproduced by a failing test.

---

## 11. Progress

Status, not plan: editing this section is not a plan revision (decision 100). The main session alone edits it. Before a task's brief, it marks the row "In progress from `<commit>`". After the task, it marks the row "Done" and lists the commits. The order is the run order, so the next task is the first row not marked "Done". Each row lists the task's own commits, then its bug tasks (B), suite-failure fixes (F) and their rounds (R). Runs, ocr results and notes stay in `evidence/D07S/structural.md`.

| Task | Status | Commits |
|---|---|---|
| T7S.1 | Done | `1627e865` |
| T7S.3 | Done | `dd1a89e8` |
| T7S.2 | Done | `f40e99e5` |
| T7S.4 | Done | `51d84965` |
| T7S.5 | Done | `f7590645` |
| T7S.6 | Done | `edbc03a5` |
| T7S.7 | Done | `ef641c00`; F1 `7feef7dc` |
| T7S.8 | Done | `4f347d43`; B1 `743defbe`; B2 `f3340232`; F1 `bb461313` |
| T7S.9 | In progress from `bb461313` | |
| T7S.10 | Not started | |
| T7S.11 | Not started | |
| T7S.12 | Not started | |
| T7S.13 | Not started | |
| T7S.15 | Not started | |
| T7S.16 | Not started | |
| T7S.14 | Not started | |
| T7S.17 | Not started | |
