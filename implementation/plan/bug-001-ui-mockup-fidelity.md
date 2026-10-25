# BUG-001 — Mockup fidelity and unmistakable save state

Date: 2026-10-24. **Status: detailed plan for review; no application implementation
or passing repair evidence is claimed.** Story: [delivery plan](../delivery-plan.md#bug-001--restore-mockup-fidelity-and-make-saved-versus-draft-state-clear).
Implementation starting point inspected: `11216bf0138e1dff372e9270afe5c935dfa1e984`,
branch `codex-gpt-6.1-sol`, worktree
`/Users/ckolbegger/src/trade-journal-v3/worktrees/codex-gpt-6.1-sol`.

## Decisions and intended outcome

The trader answered both scope questions on 2026-10-24:

1. Cover every installed D1/D2 screen, not only execution entry.
2. Closely reproduce the references' composition, typography, spacing, compact
   cards, desktop drawers and mobile sheets, retaining Trade Journal branding
   and the required D2 fields and safeguards.

Recommended order: complete this repair after D2 and before D3. It repairs existing
end-to-end capabilities; it adds no trading capability or independent theme release.
The approved stack and package-lock pins remain in place: React 19.3.0, Vite 8.3.4,
Dexie 4.4.6, decimal.js 10.6.0, Temporal polyfill 0.5.1, Playwright 1.64.0 and the
recorded TypeScript/native-compiler workaround. No new UI framework,
schema, migration, domain calculation or application command is planned.

Success means a trader can recognize the reference design **and** distinguish an
unsaved draft, rejected Save and committed opening without guessing from retained
input. Functional green tests alone do not satisfy the visual acceptance gate.

## Authority, inputs and compatibility

- [UI contract](../../specs/design/ui-contract.md), [delivery contract](../../specs/design/delivery-contract.md),
  [acceptance contract](../../specs/acceptance/acceptance-contract.md), glossary and
  frozen module contracts remain authoritative for domain meaning and safety.
- [Screenshot index](../../specs/reference/ui-screenshots/index.md) and its original
  assets supply visual targets. The trader's new decision makes close visual
  matching an explicit acceptance criterion for this repair, rather than loose inspiration.
- [D2 implementation baseline](d02-implementation-baseline.md), capacity policy,
  [verification record](../evidence/d02/README.md) and [critic report](../evidence/d02/critic-01/report.md)
  identify behavior and known limits to preserve. Original D1/D2 plans and evidence
  are historical inputs, not files to rewrite as though fidelity had already passed.
- Record the actual implementation HEAD, relevant input hashes, reference image
  dimensions, stack pins and browser/OS provenance at kickoff. This draft is not
  an immutable approved implementation baseline until the final plan is reviewed.
- Keep existing facts, IDs, sequences, exact decimals, Economic/Save Times,
  definition snapshots, immutable history, lifecycle agreement and indexes unchanged.
  React continues to use the existing revision-bound commands and post-commit results.
- Do not copy prototype P&L/adherence, current market prices, review-day counters,
  option fields, sells, exits, Insights, Reports, voluntary Journal, Backup/Restore
  or other uninstalled operations into D2. No fake zero or fill cost as valuation.
- Do not copy the prototype host's Share/Sign in/unverified-content chrome.
  “TradeCoach,” “Position” as campaign, and “Record fill” are not replacement domain labels.
- Use isolated synthetic test Workspaces. Do not copy the trader's screenshot data
  into public fixtures or alter their live draft/database to demonstrate the fix.
  No deployment, automatic commit or push is included in this planning request.

## Screen-by-screen visual specification

Reference filenames below are under `specs/reference/ui-screenshots/`; each has a
narrow version and a `-desktop` version. Extra D2 fields adapt within the design;
they are not grounds to replace its composition with the current generic form.

| Installed screen | Reference | Concrete change and required adaptation |
| --- | --- | --- |
| Shell/navigation | `proto-home` | White sidebar with icon/label destinations, one clear active state, restrained outlined New Plan action, centered content and warm ground. Narrow layout uses bottom navigation. Keep Trades, New Plan, Journal Debt and Workspace reachable; do not introduce Dashboard/Stats placeholders. |
| Planned/Open lists | `proto-home` | Separate compact white rounded row cards, symbol/initial avatar, clear lifecycle, secondary Strategy/Account context where supplied by existing reads, aligned numeric summary and small badges. Preserve filters and bounded pagination. Planned rows show frozen risk/reward; Open rows show holdings/opening fees/Entry Quality, never fake P&L. No unbounded scan merely to reproduce a header count. |
| Planned Detail | `proto-position-detail-planned` | Compact back/title header, visually primary frozen Plan summary, thesis/invalidation, Plan Reflection and history with clear grouping. Record/Continue unsaved entry is the primary contextual action. No exposure or adherence inferred from a draft. |
| Open Detail | `proto-position-detail-stock` | Position summary, aligned holdings/entry/fees/risk/reward, distinct frozen Plan, readable Execution/Lot rows, Journal outcome cards and audit disclosure. Substitute installed exact entry metrics for prototype valuation/adherence. No Add/Close/Insights controls. |
| Plan creation | `proto-new-plan-step1`, `proto-new-plan-step2`, filled variants | Two-stage instrument/Account selection then Plan/Reflection, with reference-like section cards, compact fields, radio chips and one final Confirm Plan action. Keep exact Account/Stock/quantity/entry/Stop/Target and original Plan Reflection. Long Stock is the only installed Strategy; do not show fake selectable option Strategies or invent entry ranges/catalyst/exit-day fields. |
| Opening entry | `proto-add-fill` | Desktop right drawer over retained Detail; narrow bottom sheet. Compact side-by-side quantity/price where space permits, fees/time and additional rows, reflection chips, clear draft badge, internal scrolling and visible save footer. All broker rows and one reflection outcome still commit together. |
| Trade Journal/history | `proto-position-journal` | Contextual Journal drawer/sheet and compact Entry cards with type, source and original moment. Keep original prompt/option wording and full history accessible. No Add/Edit/Void affordances until installed. |
| Global Debt and owed form | `proto-journal-timeline`, `proto-entry-composer` | Compact obligation cards and reference-style reflection composer; original form/source/trigger remain clear. Complete and explicit Decline remain separate; no blank Entry for Defer. These are adaptations, not a claim the prototype fully specified Debt. |
| Workspace/onboarding | Shell/form visual language | Compact, legible setup/reference cards; correct time-zone selection and distinct Add Institution/Add Account actions. No direct matching prototype exists: design these states with the same tokens and hierarchy, explicitly label the adaptation in the comparison board. |
| Loading/Empty/Error/Recovery/update | Contract-led adaptations | Consistent compact state/status surfaces, actionable errors and visible safety warnings. Do not imitate the mockup's omission of these states or hide them to improve a screenshot. |

### Shared layout and chrome

Proposed breakpoint: **1024 CSS px** (wide at or above; narrow below). This permits
the indexed 814px narrow reference and 1440px wide reference to use their intended
arrangements. Test 1023/1024 and retain state-preservation checks at 767/768, which
now both use narrow layout. The reference capture widths are not themselves breakpoints.

Initial geometry targets for calibration against reference pixels: approximately
240px desktop sidebar, 820px centered content, 440px right drawer and 68–76px basic
Trade rows, expanding for required content. T01 records final measured targets,
type hierarchy, spacing, radii and responsive exceptions before styling. Determine
image-to-CSS scaling rather than treating image pixel dimensions as CSS dimensions.

Use near-black primary actions, outlined secondary actions, selected radio chips,
subtle borders and right-aligned tabular numbers. Match the reference's body versus
condensed-heading hierarchy. Check available/licensed font sources; bundle necessary
font weights locally and inventory them for offline use. No runtime font CDN or
unreviewed icon/component package. Use a small consistent icon set with accessible labels.

Normal Ready screens must prioritize the task, rather than repeat oversized update,
installation and storage blocks before every form. Keep the required Best Effort
warning visible in a compact status strip with its clear-data meaning, backup-not-yet-
installed explanation and Request storage protection action. Put installation help
and the manual update check in reachable Workspace/app controls; show update and
Recovery/Unsupported banners prominently when relevant. Do not collapse failed
readiness into an innocuous icon or enable mutations before Writable.

### Contextual form and save-state rules

- One accessible contextual container changes presentation across the breakpoint;
  resizing must not remount/reset the form or duplicate it in the accessibility tree.
- A labelled modal drawer/sheet keeps the invoking Trade visible behind an inert
  backdrop, contains keyboard focus, supports internal scrolling and returns focus
  to its invoking action. No nested modal stack is needed.
- Close/X/Escape retains the unsaved draft and returns to Detail; an explicit
  Cancel/discard action clears the draft only. Backdrop click does not discard it.
  Detail shows **Unsaved entry draft** and **Continue unsaved entry** while it exists.
  Navigation preserves that draft within the running app; no new durable draft or
  restart-survival promise is introduced.
- Start with one row. **Add another execution** adds an explicitly unsaved row;
  **Remove draft row** removes only that row. Every row is labelled Unsaved until
  the complete command succeeds. Do not silently ignore an added blank row.
- In the reported pattern (complete first row, blank second row), validation must
  say **Nothing saved — Execution 2 needs a quantity and price**, mark/link to those
  blank fields and retain all values. Bind displayed row errors to stable draft-row
  identities, including after removal/reordering. Preserve authoritative command
  validation; identifying blank inputs is presentation validation, not a second
  economic calculator. Other domain issues remain truthful even when the current
  result code supplies no precise row; never invent an issue location.
- Errors stay with their form/draft, not as detached execution errors on ordinary
  Trade Detail. Reopening a rejected draft restores its actionable validation.
- Footer action **Save opening entry** explains that all Executions and reflection
  save together. While pending show **Saving…**, prevent duplicate submission and
  conflicting dismissal, and temporarily disable draft editing/add/remove controls
  so a late response cannot erase newly typed input; do not claim success optimistically.
- On rejection/abort, retain draft and show **Nothing saved**. On actual commit,
  show **Opening entry saved · N Executions**, render the returned Open state and
  recorded Execution list, clear the draft and remove the opening action. No required
  read-back or inferred lifecycle. Debt settlement gets the same clear boundary.
- Keep fees, exact instants/time-zone context and all reflection fields available.
  No time-input semantics or storage format change is proposed in this visual repair.
- The focused field, validation, Close and Save/Cancel remain usable with long
  content, 200% reflow and narrow keyboards. The known Note/bottom-nav overlap is
  included in regression coverage, not accepted as a visual exception in this repair.

## Detailed tasks and dependency graph

IDs below are tasks inside one complete repair, not separately advertised releases.
One owner controls the shell/tokens/contextual form behavior; screen tasks consume
that implementation instead of making competing style or focus systems.

`T01 → T02 → T03 → {T04,T05}; T04+T05 → T06; T03 → T07; T03+T05 → T08;`
`T03 → T09; T04–T09 → T10 → T11 visual/accessibility → T12 → T11 final qualification`.
T06 also consumes the regression fixture from T02. Independent screen work can be
sequenced normally; this plan does not launch agents during planning.

### BUG-001-T01 — Freeze the reference comparison board (structural)

Inventory every installed route/state and map it to the table above. Capture the
unchanged app in an isolated synthetic profile at 1440px and the reference narrow
width; record image dimensions, CSS viewport/DPR, fonts and baseline HEAD. Build
an annotated before/reference board covering shell, lists, both Details, Plan,
opening and Journal forms. Record compact-warning and no-reference state adaptations.
Freeze measured visual targets and allowed semantic deviations; do not approve the
current app as the desired screenshot baseline. Verify all named assets/links and
all installed routes are accounted for. No application change in this task.

### BUG-001-T02 — Reproduce draft/save ambiguity before repair

Seam: production `App` → real `TradeWorkflows.recordPositionChange` → store.
Use a synthetic 10-share Plan; complete row 1 and add a blank row 2.

`describe("opening draft and recorded state are distinguishable")`

- it should label retained input and row-removal controls as unsaved, while the Trade remains Planned.
- it should identify blank Execution 2 fields, announce Nothing saved and leave roots/versions/lifecycle unchanged after Save.
- it should return to Detail with Continue unsaved entry, then reopen identical values and form-scoped errors.

For each case, run the new assertion against current production UI, preserve a
behavior-caused Red, then implement the smallest clarification in the existing
forms and verify Green before adding the next case. This fixes the reported
ambiguity before the larger visual restructuring. Existing passing data-safety
assertions are regression evidence, not new Reds. T03/T05/T06 must retain these
Greens; do not change domain rejection or silently drop a blank row to pass.

### BUG-001-T03 — Reference-aligned shell and contextual container

Touch `App.tsx`, `App.module.css` and only shared presentation components actually
used by the installed screens. Replace broad all-buttons-as-primary styling with
explicit nav/action variants. Implement measured type/spacing tokens and local
font/icon assets if needed. Implement one accessible responsive drawer/sheet.

`describe("installed navigation and contextual forms")` — public seam: App/visible DOM.

- it should expose one active destination and the same installed actions in wide and narrow layouts.
- it should close a drawer with Escape without saving/discarding, restore invoker focus and retain its draft.
- it should keep focus within an open modal and leave no enabled background controls or duplicate form.
- it should cross 1023/1024 without losing fields/selection/route, and keep a focused Note and footer accessible above fixed UI.

Structural verification: calibrated shell screenshots, offline asset/font inventory,
no new dependency unless justified, no dead/one-use generic design-system framework.

### BUG-001-T04 — Compact Planned/Open list cards

Seam: `TradeViewsAndReporting.browseTrades` → App list → Detail. Match the Home
composition with lifecycle filters and bounded Next-page action. Retain selected
filter and return context; use actual installed read values only.

`describe("reference-aligned Trade browsing")`

- it should distinguish Planned baseline summaries from Open holdings and Entry Quality without a fake valuation or P&L.
- it should open the selected Trade and return to the same lifecycle/page context.
- it should distinguish Loading, lifecycle-specific Empty and Error/retry without losing selection or claiming an empty result before completion.

Visual checks: row density/alignment, selected nav/filter, 1/10/50-row states, long
symbols/labels, pagination and no global-total claim from a bounded page.

### BUG-001-T05 — Planned/Open Detail and recorded Executions

Seams: `getTradeDetail`, history, existing post-commit result consumed by App.
Implement the stock/planned reference hierarchy and clear recorded Execution rows;
move verbose fact IDs/revisions into reachable audit/history disclosure, retaining
all audit content. Add distinct draft continuation without treating draft as exposure.

`describe("saved Trade detail and draft continuation")`

- it should render Planned with no recorded Executions independently of any retained opening draft.
- it should render committed Open holdings, immutable baseline, Lots, fees, Entry Quality and Journal outcome with their actual availability.
- it should retain original Execution/Position Change identities, times and sequences in reachable history.

Visual checks: Planned/Open summaries, action hierarchy, real Unavailable entry
quality, long reflection/history, compact field grouping at both layouts.

### BUG-001-T06 — Execution drawer/sheet and explicit Save result

Seams: `OpeningForm`, App draft state, actual opening command and returned receipt.
Implement the contextual form specification above. Group quantity/price compactly;
retain fees/time, stable multiple rows, exact planned total requirement and the
original Complete/Defer/Decline form. Keep the T02 regressions Green through the new composition.

`describe("opening all Executions in one contextual Save")`

- it should add/remove only the identified unsaved row and retain the other rows and reflection answers.
- it should move focus to a surviving row or Add another execution after row removal, and focus the exact blank field from its error-summary link.
- it should issue one atomic command for all rows, show Saving and render Saved/Open only after commit, without an operation-required read.
- it should preserve the draft with Nothing saved after rejection, conflict or native abort, and support explicit current-Trade review.
- it should Cancel/discard only view state and leave every authoritative participant unchanged.

Visual checks: one row, multiple rows with scrolling, long original reflection,
blank-row error, conflict/already-Open, disabled Saving, and visible saved outcome.

### BUG-001-T07 — Plan creation and Plan Reflection

Seams: App Plan form → unchanged `confirmPlan`; original definition-bound prompts.
Match the Plan reference's two stages, section cards and compact groups without
copying invalid arithmetic or adding prototype-only fields. Next/Back only changes
view state; the final Confirm Plan remains the sole persistence boundary.

`describe("reference-aligned Plan confirmation")`

- it should retain all installed Plan/Account/reflection fields and the exact required prompt options through responsive changes.
- it should move between instrument/Account and Plan/Reflection stages without losing values or writing facts before final confirmation.
- it should focus contextual validation, preserve input on conflict and Cancel without recording facts.
- it should confirm once and show the returned frozen baseline and saved Plan Reflection directly.

Structural/visual check: blank/filled/error views compared with Plan references;
unchanged Long Stock scope and no alternate Strategy placeholders.

### BUG-001-T08 — Journal cards, Debt queue and owed composer

Seams: existing coherent Detail/Journal query, `DebtForm`, `Journal.save`.
Use contextual Journal presentation and compact global Debt cards, with original
definition/source/origin/moment and explicit outstanding/completed/declined state.

`describe("reference-aligned Journal and Debt")`

- it should distinguish completed Entries, outstanding Debt and explicit declines, with no placeholder Entry for Defer.
- it should open the same original owed form from global queue or Trade Detail, retaining answers when closed and resumed.
- it should show a returned Complete/Decline settlement only after commit; stale/settled conflicts preserve answers and prevent duplicate settlement.

Visual checks: Empty/multiple Debt, Entry cards, original prompt chips, both outcome
types, validation/conflict and long content in drawer/sheet. No Add/Edit/Void controls.

### BUG-001-T09 — Workspace, setup and compact delivery states

Seams: App → Workspace, Catalog and existing delivery methods. Match the same visual
language for screens absent from the prototype, retaining safety text and actions.

`describe("setup and delivery remain explicit in the compact shell")`

- it should reject blank/invalid/fixed-offset time zones, preserve input and create a Workspace only after an explicit valid selection.
- it should create distinct Accounts under one Institution with unambiguous Add Institution/Add Account labels.
- it should keep Best Effort meaning/action visible while allowing valid writes, and disable authoritative mutations in Recovery/Unsupported/Integrity Blocked.
- it should make install/update help reachable and defer activation for every retained unsaved Plan/opening/Debt/reference draft, even with its panel closed.

Visual checks: onboarding, Workspace, normal warning strip, actual update available,
failed checks and retained readable recovery. No failed-state text hidden for fidelity.

### BUG-001-T10 — Real-stack workflow and delivery regressions

Run every existing D1/D2 unit/integration/browser scenario at final qualification.
Use the verification cadence below during repair iterations. Update DOM
locators and interaction sequences for the approved drawers and Next/Back stages;
do not bypass them with hidden controls or direct command calls in UI tests. Retain
scenario meaning, native faults and durable assertions. A passing assertion or
selector repair is not a Red.

Add/extend production-App integration and native browser fixtures:

| ID | Fixture and required visible/durable proof |
| --- | --- |
| I01 | Blank second row → rejected Save → close/resume → remove only blank row → Save. Before repair fail explicit draft/error assertions; after repair whole authority unchanged on rejection, then one complete Open append and one outcome. |
| I02 | Complete/Defer/Decline opening, Debt answer/owed Decline and Cancel through redesigned containers. Return values equal reopened durable facts; original definitions retained; no required result read-back. |
| I03 | Competing tabs on one persistent store, native Journal abort, readiness/cache failures and safe retry in both opening and Debt. Compare all root/versions/lifecycle, not counts alone. |
| I04 | Verified update with open AND closed unsaved drawers; activation remains deferred, Cancel permits safe update, stored facts remain equal after fully stopped offline reopen. |
| I05 | Populated historical D1 → current release migration/recovery and private reconstruction remain correct; redesigned UI never resets a user Workspace or seeds over existing records. |

Fast tests may retain disclosed fake-indexeddb/explicit host infrastructure; no
application/coordinator/calculation/result mocks for these integrations. Native
profiles prove readiness, cache, worker, durability and offline behavior. Never use
the trader's live profile for synthetic data, fault injection or destructive actions.

#### Verification cadence — trader-approved revision, 2026-10-24

The trader approved fast iteration followed by one final scale qualification after
fixes settle. This replaces the earlier requirement to repeat full cumulative and
scale gates before every critic review.

1. **Each repair:** preserve the finding, demonstrate a failing regression, make
   the minimal fix, and run the focused regression plus relevant unit/integration,
   typecheck, build, native workflow and visual/accessibility checks. Select native
   cases from the affected behavior and its dependencies; retain their durable
   assertions. Record the selected checks and why they cover the change. Pure
   presentation changes use focused UI checks during iteration.
2. **Independent acceptance:** after those checks pass, use a different fresh
   critic for all current B01–B04 repair flows. Repeat steps 1–2 for product defects.
   Full 25,000-Trade generation and 50 cold/50 warm trials are deferred while this
   loop is active. Changes to persistence, migration, query behavior, derivation,
   readiness or startup also require focused correctness/performance checks of
   that path during iteration.
3. **Final qualification:** once both critic verdicts pass and implementation
   changes have settled, run the full T10/T11 cumulative suite and both inherited
   scale procedures once on the accepted frozen source/build. Preserve populations,
   thresholds, raw trials and provenance. If a gate exposes a product defect,
   return to steps 1–2; rerun the affected qualification gates after repair. An
   implementation change after qualification requires an explicit impact review;
   rerun affected gates, including scale for changes to the paths listed above.

Earlier passing scale runs remain evidence for their recorded snapshots. They do
not certify a different build. Driver corrections retain their failed attempts
and rerun the affected checks; they are not product fixes or new Reds.

### BUG-001-T11 — Visual fidelity, accessibility and scale gate

Create a reproducible visual suite for the calibrated reference and synthetic data.
Save reference/current side-by-side images plus overlays and a deviation checklist,
not only new snapshots approved against themselves. Pin browser/OS/viewport/DPR,
fonts, clock and fixture. Mask only variable IDs/timestamps or host chrome, never
save state, validation, financial values, safety warnings or required controls.

Compare shell/sidebar/content width, title/body hierarchy, row/card spacing/radii,
primary/secondary hierarchy, drawer/sheet placement and field density with T01's
measured targets. Record measured major geometry within 5% of calibrated targets;
larger differences require a documented content/safety/accessibility adaptation,
not a silent redefinition of the baseline. Use screenshot diffs for subsequent
regressions, but manually assess prototype correspondence and every allowed deviation.
All installed routes and representative states must be accounted for.

Widths: 390, reference narrow 814, desktop 1440; transitions at 767/768 and
1023/1024. Keyboard-only core flows, narrow zoom/reflow, focused Note near footer,
touch targets, radio semantics, focus restoration, contrast and axe AA scans are
required. Distinguish CSS zoom from actual browser-chrome 200% zoom; never claim
one proves the other. Test reduced-motion behavior if transitions are introduced.

Commands: `npm run lint`, `npm run typecheck`, `npm run build`, `npm run test:unit`,
`npm run test:integration`, `npm run test:browser`, `npm run test:benchmark`,
`npm run test:benchmark:d2`, and `git diff --check`. Add an explicitly named visual
Playwright configuration/spec during implementation; its exact command and approved
baseline hashes must be recorded before acceptance. Build base/update releases and
test actors from the same frozen inputs; check matching release IDs before long runs.

At final qualification, run both existing 25,000-Trade benchmark procedures and
D2's 200-Open workload under T10's verification cadence. Preserve bounded reads and the
cold p95 ≤2500ms / warm p95 ≤1500ms thresholds. Do not relax them or hide records.
New bundled assets must pass complete digest inventory and stopped-offline checks.

### BUG-001-T12 — Fresh independent visual/workflow critic and handoff

After T10's iteration checks and T11's visual/accessibility checks pass on one
settled source/build, a fresh critic
reads the full frozen specs, this reviewed plan, reference assets, screen map and
allowed deviations. It starts its own strict production runtime and uses isolated
native profiles. It does not edit implementation or merely repeat author claims.

| Flow | Independent required result |
| --- | --- |
| B01 | Compare every installed screen with the actual reference board at 1440/814/390; report visual fidelity separately from functional correctness, with before/after screenshots and justified adaptations. |
| B02 | Reproduce the blank second-row journey; trader can tell unsaved/rejected/saved state from each screen. Close/resume, row removal, Save, recorded Execution list, Open state, history and stopped offline equality all work. |
| B03 | Confirm Plan and every reflection/Debt outcome through the real redesigned forms; competing shared-store tabs, failed save, readable recovery and safe retry preserve input and authority. |
| B04 | Keyboard, dialog semantics/focus, live boundary resizing, focused Note/footer, reflow/zoom, manual contrast plus axe, Loading/Empty/Error/Ready and update-deferred drafts. |

Report actions/expected/observed/status, actual environment, screenshot/console/
server evidence and exact source/build identity per flow. A product defect first
gets an automated failing regression, then minimal fix, T10's iteration checks and a
**different fresh critic for all current repair flows**. Driver mistakes are attempts,
not passing evidence or valid Reds. Record visual and functional pass separately.
After both verdicts pass, complete T10/T11 final qualification before handback.
Restore the final preview and original distribution after isolated update tests.

## Acceptance mapping and evidence record

| Contract scenario | Repair coverage | Planned evidence |
| --- | --- | --- |
| AC-UI-001 | All installed routes, drafts, selected Trade/filter, new breakpoint | T03–T09; I01/I02; B01/B04 state + geometry captures |
| AC-UI-002 (installed subset) | Names/roles/focus, states, AA, reflow, save clarity | T02–T11; B01–B04, axe + manual checks |
| AC-RESP-001 (D1/D2 subset) | Direct authoritative post-commit outcome | T05–T08; I01/I02, transaction/UI success trace |
| AC-DEL-001–004, AC-CAP-001 | Complete offline assets, readiness, advisory warning, updates | T03/T09–T11; I03–I05; native receipts/cache digests |
| AC-DEL-005–006 (installed subset) | Readable recovery and unreadable-store protection | T09/T10; I03/I05; unchanged authority |
| AC-REST-004, AC-REBUILD-001 (D2 subset) | Preserve migration and reconstruction | T10; I05; cumulative existing migration/rebuild tests |
| AC-PERF-001 (installed workload) | No startup/list/render regression | T11; both inherited benchmark commands/raw trials |
| D1/D2 lifecycle, exact arithmetic, Journal/lot/atomicity obligations | Remain unchanged and cumulatively protected | Existing unit/integration/browser matrix + I01–I05 |
| BUG-001 visual criterion | Close reference match, not merely all-green tests | T01 measured board, T11 comparisons, B01 independent visual verdict |

Keep the complete existing D1/D2 acceptance matrix by reference; no previously
installed scenario is waived by this table. Backup/Restore timing and deferred
HTTPS remain as explicitly accepted; no deployment is proposed. Actual OS install
and native zoom evidence remain honestly incomplete unless directly exercised.

Planned repair evidence directory: `implementation/evidence/bug-001/`. Record exact
commands/exits, source/input/asset hashes, each behavior-caused Red/Green, structural
checks, fixture infrastructure, complete authority comparisons and visual verdicts.
Preserve all failed attempts with unique names; never overwrite them. A case that
passes immediately protects existing behavior but cannot be relabelled a Red.

For each new behavior, add and verify one behavior-caused failing assertion, make
the smallest Green, and rerun earlier cases before the next behavior. Existing
functional assertions that already pass remain regression coverage; never remove
working guards to manufacture Reds. Pure visual/style work uses reproducible
reference/geometry comparisons, not unit tests that only assert CSS class names.

## Completion and remaining decisions

No further trader product choice is currently needed to write this breakdown.
Visual calibration, available licensed fonts and native container details are
bounded implementation investigations in T01/T03, not permission to dilute fidelity.
Any genuine conflict between required semantics and the chosen presentation is
surfaced with a concrete alternative before encoding it.

The story is complete only when all installed screens pass both reference-based
visual review and their real functional/safety flows, the original blank-row confusion
has a regression and demonstrably clear outcome, and a fresh critic passes the
settled build. A component showcase, prettier screenshots without functioning
commands, or functional tests without visual comparison does not complete it.

This document implements the requested planning work only. Application coding,
baseline freeze for execution, commit/push and deployment are not claimed authorized
by the request to add a story and task breakdown.
