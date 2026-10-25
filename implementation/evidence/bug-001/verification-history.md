# BUG-001 local repair evidence

2026-10-24. **Automated verification passed; independent acceptance pending.**
No commit, push or deployment. The trader's profile, stored records and unsaved
input have not been used for fixtures or touched by test setup.

## Current candidate and approved faster gate cadence

The trader approved focused iteration checks and critic review before one final
scale qualification after fixes settle. The plan T10 cadence and handoff now
record that policy; `gate-policy-revision.json` retains the authorization and
revised document hashes. Original frozen inputs and previous evidence remain
unchanged. Scale thresholds/populations/provenance remain required at handback.

Critic04 separately passed visual fidelity but found P2: an older Planned-list
response could replace rows after selecting Open. Its native finding and complete
partial acceptance are preserved in `critic-04/report.md`. Genuine
`T12-latest-list-red.json` reproduces the stale response using actual queries with
controlled scheduling; Green retains only the latest request's response. No
query, derivation, persistence, schema or migration implementation changed.

Current source4f341c4308fbd1ee263c97a141975499a88f7248386be5e4cdd0af92a58d744c; release4d8cb5fc0da7a335f886c3dd28c967baee50ea3987b0b5eea89117ebb98a6188.
All iteration gates passed:121 unit,7 integration,lint,typecheck,production build,
93 native browser and9 native visual cases, including rapid Trades/Open switching
five times per1440/814/390 dense-list fixture. The new frozen source is not
certified by old scale hashes. Fresh critic05 and final scale qualification are
pending; `final-local-verification.json` records that status explicitly.
Current comparisons: `visual/list-visual-gate-1792879965508/comparisons`; reproducer `compare-list.py`.

## Prior candidate after keyboard repair

Critic03 independently confirmed P2: during a held Save, disabled controls let
focus fall outside the modal and keyboard scrolling stopped. Its report and
native keyboard/axe evidence remain in `critic-03/`. `T12-busy-focus-red.json`
fails the real-App focus invariant before repair (jsdom retains disabled Save
focus; native Chromium loses it to BODY). `T12-busy-focus-green.json` passes after
the minimal shared ContextPanel repair: tabIndex0 plus focus with preventScroll
when busy. Editing, Cancel and Close stay disabled until the command returns.

Current frozen source6158c98e22f94ad752e40e3e149cfa272f910abb0605a89eee99705cdcccf849;
release825fa371a65315cba0fde10e41d4a8b3779c641e9d35a70b3abc760e9ea77d39.
All `focus-*` gates in final-local-verification.json passed on this same source:
120 unit,7 integration,93 native browser,9 native visual,lint,typecheck,build/inventory,
both25,000-Plan scale gates. Native visual cases now hold real Save at the storage
capacity boundary and verify focus, Tab/Shift+Tab containment, keyboard scrolling
when overflowing, no-write-before-release and axe during Opening and Debt Saving.
A test-only unbound-method lint failure is retained; its correction preceded the
final common source snapshot. The previous final record is preserved in
`pre-focus-repair-verification.json`.

D1 p95 cold271.08ms/warm93.18ms; D2 Planned1855.41/124.39ms;
Open mixed-store startup1858.19ms/complete200-Open read554.85ms. Limits unchanged.
Migration14470.73ms; sampled used JS heap peak722868068 bytes, not RSS or a
low-memory guarantee. Raw50+50 trials and complete migration/reconstruction
population are in `cumulative/focus-*-gate-*`.
Current original-reference comparisons are
`visual/focus-visual-gate-1792878357412/comparisons/` (`compare-focus.py`).
The earlier repair board captured Loading for Open list; it is not Ready-state
visual proof. The current capture explicitly waits for the populated Open row.
Fresh critic04 acceptance is pending. The prior candidate history below is
preserved; its hashes and verdicts are not the current acceptance identity.

## Prior critic repair candidate

Critic01 was interrupted by an account usage limit before issuing a verdict.
Its raw attempts remain available; they do not establish acceptance. Fresh
critic02 independently reproduced P2: the Trade Journal drawer omitted a stored
explicit decline that Detail correctly showed. Its functional FAIL and incomplete
visual verdict are preserved in `critic-02/report.md`.

`T12-decline-red.json` is a genuine real-App failure on the missing outcome.
`T12-decline-green.json` passes after the smallest view-only change: the drawer
renders existing Outstanding Debt and explicit decline outcomes with original
Source, Anchor, moment, due/save time and reason, without fabricating an Entry.
Complete authority remains unchanged on opening. Native visual regression coverage
now also exercises outstanding and later declined outcomes at all three widths;
these extra assertions were added after the fix and are not separate Reds.
The first typecheck attempt caught an unsupported test selector option; its failure
is retained, corrected, and all gates rerun on the final frozen test sources.

Current source: `682f21e4f77151620270ebf258d822b2bd350fb2a455271c2da7ba447e31d8bd`.
Current release: `749a0791565687c4c795c4a1dbfc8ce94b79c15f3a806aa202ffed8a8d9c52fb`.
`final-local-verification.json` now binds this candidate; the previous record is
preserved as `pre-critic-repair-verification.json`.

| Current gate | Record | Result |
| --- | --- | --- |
| Lint | repair-lint-gate-attempt2.json | pass |
| Unit | repair-unit-gate-attempt2.json |120 pass |
| Integration | repair-integration-gate-attempt2.json |7 pass |
| Typecheck | repair-typecheck-gate-attempt2.json |pass |
| Production build/inventory | repair-production-build.json |pass;13 inventoried assets |
| Native browser | repair-browser-gate.json |93 pass;Chromium/Firefox/WebKit |
| Visual/accessibility | repair-visual-gate.json |9 pass;1440/814/390 |
| D1 scale | repair-d1-scale-gate.json |25,000 Plans;50 cold/50 warm;p95268.43/84.21ms |
| D2 scale | repair-d2-scale-gate.json |25,000 historical Plans;migration/reconstruction;200 Open/400 Executions;each phase50 cold/50 warm |

D2 Planned p95 cold1858.26ms/warm127.25ms; mixed-store startup1859.83ms /
complete200-Open read612.19ms. Limits remain2500/1500ms. Migration14949.44ms.
Sampled migration used JS heap peak722885620 bytes, not RSS or a low-memory-device
guarantee. Both historical and current raw benchmark sets remain attributed.
Current comparison pairs/overlays are under
`visual/repair-visual-gate-1792876659511/comparisons/`, reproduced by
`compare-repair.py`; original comparison artifacts remain untouched.
Fresh critic03 visual AND functional B01–B04 acceptance is pending.

## Frozen execution and outcome

Implementation kickoff is the user's request invoking prompts/handoff-BUG-001.md.
The reviewed execution addendum is implementation/plan/bug-001-baseline.md;
the unchanged detailed plan remains the task/acceptance authority. Initial branch
codex-gpt-6.1-sol / HEAD11216bf0138e1dff372e9270afe5c935dfa1e984 matched the
handoff, as did all seven input hashes. Its three planning changes were preserved.
`frozen-inputs.json` records the complete canonical input/reference hashes.

Pre-critic source snapshot: `f9697f14fee1e03b20f3f138a6fb8e41db68741191aec5b4818d45aab198c210`.
Release: `33cc2444e5d648b6fafc68d73011727ae4049bb656c469009133ce7c94b26bc1`.
The original gate table below has this pre-critic source digest; the production application,
update variant and injected actors were rebuilt after release-affecting edits.
`final-local-verification.json` binds all emitted-file hashes and exact commands.
No domain formula, application command, schema, migration or capability changed.

The production App now uses compact reference-shaped navigation/cards and a1024px
breakpoint; one active destination; staged planning; contextual opening, owed-form
and Trade Journal panels; explicit draft, rejected and recorded states. Stable
view-only row identities bind blank-field diagnostics and focus links. Closing
retains drafts; Cancel discards only view state. Opening and Debt pending saves
freeze conflicting edits/dismissal. All durable success is rendered from the real
post-commit result; the original atomic rejections remain authoritative.

## Reference calibration and comparisons

- T01 targets and adaptations were frozen before styling in the execution baseline.
  Original desktop1800/1440 and narrow1018/814 imply1.25 image-to-CSS scaling.
  Source DPR is inferred, explicitly; current native captures use measured DPR1.
- `before/` contains unchanged production captures at1440/814 in an isolated native
  synthetic profile. Its old release2cceb944… was recovered later from that exact
  profile's cached inventory with network offline; see recovered-cached-release.json.
  This is disclosed recovery of cached provenance, not a fabricated pre-edit hash run.
- `before-reference-board.jpg` compares the unchanged UI to the original pictures;
  `reference-assets.json` records all24 original dimensions and hashes.
- Final screenshots, raw geometry, font state, native authority and axe results:
  `visual/T11-visual-complete-states-1792862353465/`.
- Original/current pairs and50% overlays for every directly pictured installed
  screen: that run's `comparisons/`. `compare-reference.py` reproduces them with
  the bundled Pillow runtime. Original host chrome is cropped, then scaled/1.25;
  financial values, warnings, validation and save state are never masked.
 390px checks responsive parity against the814px original, not invented390px source geometry.
- Calibrated major geometry passes: sidebar240px, desktop inner content820px,
  standard Trade row70px within66.5–73.5px, drawer440px, Plan maximum448px;
  actual tested viewports1440/814/390 and live767/768/1023/1024 transitions.
  Fields, selected reflection and route survive; the focused Note fits above
  the sticky footer after layout settles. Close remains visible with long scrolling.

### Explicit visual adaptations/deviations

| Surface | Retained adaptation and visual judgment |
| --- | --- |
| Shell | Original240px sidebar, centered820px content, white icon/label navigation, single active state; narrow bottom tabs. Trade Journal branding and installed destinations replace prototype labels. |
| Lists | Separate70px white rounded row cards and initial avatars. Required baseline/holdings/fees/Entry Quality replace P&L/adherence. Long labels may grow rows; counts describe the bounded page, never a global total. |
| Detail | Actual holdings lead Open Detail; frozen baseline and thesis/invalidation remain distinct. Required fees, exact entry results, Lots and recorded Executions increase content relative to the prototype. Opaque IDs/sequences remain reachable in View history. |
| Plan |448px staged card composition, original reflection before compact risk fields and final Confirm. Account and exact Stock controls remain editable in the second stage as well as the first, supporting explicit conflict review; this is additional required context rather than prototype-only Strategy choices. |
| Opening/owed forms |440px inset right drawer; narrow bottom sheet with internal scrolling and sticky header/footer. Required decision/Execution instants, actual fees, multiple rows and original full reflection grow the form beyond the prototype's minimal fields. One command saves everything. |
| Journal/Debt | Original wording/source/moment and Complete/Outstanding/Declined meaning replace prototype taxonomy. No Add/Edit/Void or voluntary Journal affordances. Saved narrative is contextual; Debt queue cards and owed composer use the same language. |
| Safety/setup | Compact persistent Best Effort warning plus protection action; small reachable manual update app control, install guidance in Workspace. Loading/Empty/Error/Unsupported/Recovery/Integrity Blocked have no direct source picture and are contract-led adaptations. No failed safety text is hidden. |
| Fonts | Locally bundled unmodified Rubik regular/bold and Liberation Sans Narrow bold provide the body/condensed-number hierarchy; original font identity is unavailable from the raster captures, so exact font identity is not claimed. Licenses accompany the fonts. All are in the digest-verified offline inventory. |

The author reviewed the actual final screenshots and original/current comparisons;
geometry and hierarchy correspond, with the listed semantic/content adaptations.
This author's assessment is separate from the required fresh critic's verdict.
Screenshots are not newly blessed self-comparison baselines or sole functional proof.

## TDD and regression attribution

The public seams were already agreed in the handoff: production App -> real
TradeWorkflows/Journal -> store. New fast App tests use real modules with disclosed
fake-indexeddb infrastructure and explicit host checks; they do not certify native
readiness/durability. Native profiles supply those separate proofs.

| Case | Retained Red/Green records |
| --- | --- |
| T02 rows explicitly unsaved | T02-case01-red-attempt2.json / T02-case01-green-attempt2.json |
| T02 blank second row + unchanged authority | T02-case02-red.json / T02-case02-green.json |
| T02 Detail continuation + rejected values/errors | T02-case03-red.json / T02-case03-green.json |
| T03 named modal + Close/retention/active destination | T03-context-red.json / T03-context-green-attempt2.json |
| T05 actual recorded rows and saved count | T05-recorded-red.json / T05-recorded-green.json |
| T06 stable blank links/removal focus | T06-row-focus-red.json / T06-row-focus-green.json |
| T06 pending Save freeze | T06-saving-red.json / T06-saving-green.json |
| T07 two Plan stages retain state and write nothing | T07-stages-red.json / T07-stages-green.json |
| T08 rejected owed draft resumes with its errors | T08-debt-resume-red.json / T08-debt-resume-green.json |
| T08 saved Trade Journal panel | T08-trade-journal-red.json / T08-trade-journal-green.json |
| T08 pending owed Save freeze | T08-debt-saving-red.json / T08-debt-saving-green.json |
| T04 Back after new confirmation must refresh bounded list | T04-back-list-red.json / T04-back-list-green.json |
| T11 Close must remain visible after long scroll | T11-close-visible-red.json / T11-visual-complete-states.json |

A Red means the user-visible assertion failed because behavior was absent/incorrect.
Earlier selector/timing/fixture failures and unsuccessful Green attempts remain
separate files. Case01 initially missed the async Detail and subsequently used an
incorrect lifecycle property; neither is a behavior Red. T03 initially tried to
navigate an inert background and was adapted to Close first. The original narrow
Note assertion observed intermediate resize geometry; a settled-layout retry passed,
so that attempt is a driver timing failure, not a claimed product repair.

Process scope: the missing-dialog Red preceded the shared container implementation;
its focus trap and responsive behavior were implemented together. Later separate
native assertions passed immediately, and are regression coverage, not independent
per-assertion Reds. No historical chronology is reconstructed or working guard
removed to manufacture a Red. Pure visual restructuring uses reference/geometry
comparisons. Existing unchanged safeguards and extra state/density cases are
cumulative regression coverage, not new behavior Reds.

## Cumulative gates and real-stack evidence

| Gate | Record | Result |
| --- | --- | --- |
| Lint | final-lint-gate.json | pass; generated evidence scripts excluded from source lint |
| Strict typecheck | final-typecheck-gate.json | pass |
| Production build + complete inventory | final-production-build.json | pass,13 inventoried assets plus inventory file |
| Unit | final-unit-gate.json |119 pass |
| Integration | final-integration-gate.json |7 pass, real modules/compatible storage infrastructure |
| Native browser | T10-browser-exclusive-operation.json |93 pass, Chromium/Firefox/WebKit |
| Native visual/accessibility | T11-visual-complete-states.json |9 pass at1440/814/390; screenshot/axe/geometry/authority artifacts |
|25,000-Plan WebKit scale | T11-d1-scale-gate.json |50 cold +50 warm; p95370.53ms /96.65ms |
| Historical migration +200 Open Chromium scale | T11-d2-scale-gate.json |All25,000 retained; historical digest equal; both phases50 cold +50 warm |
| Diff whitespace | git diff --check | pass before critic |

D2 Planned p95 cold1858.78ms / warm120.24ms; mixed-store startup1858.39ms /
complete200-Open read528.46ms. Limits remain2500ms /1500ms. Migration14799ms;
sampled used JS heap peak920718668 bytes. This is not total RSS, a guaranteed peak,
a low-memory-device guarantee or a new capacity policy. Migration code is unchanged.
Raw trials, environment, native counts, private reconstruction, matching source/candidate
digests and heap samples are under the corresponding unique `cumulative/` run paths.

I01 is proved by the10-share real-App regression and native blank-row journeys,
including full roots/versions/lifecycle equality on rejection and direct Open outcome.
I02–I05 retain every earlier scenario through the actual redesigned controls:
Complete/Defer/Decline/owed outcomes and Cancel; same persistent-store competing tabs;
native Journal abort/readiness/cache failures and safe retries; update deferral with
open AND closed drafts; stopped offline equality; historical migration and private
reconstruction. No application/calculation/result mocks certify these native cases.
Base/update releases and injected actors share the frozen release inputs; D2 scale
checks actor/target identity before generating25,000 Plans.

Actual host: macOS26.6.2(25G83), Darwin25.6.0, AppleM4Max, Node26.12.0.
Exact engine versions/profile paths are in each native artifact. Browser names are
provenance, not support gates. Profiles remain outside the repository.

### Attempts and infrastructure limits

All attempts are retained. Initial browser launch was sandbox-blocked before UI
access; permitted native escalation then worked. A historical release build reused
an output directory containing a stale inventory and correctly failed the inventory
check; clearing only that generated output and rebuilding passed. Lint initially
included pre-existing historical critic scripts; those archived evidence artifacts
were excluded without rewriting them. New lint issues were repaired.

Several attempts lost their preview process and failed before app load; they are
not product Reds or passing browser gates. A separately supervised preview did not
eliminate that symptom. Running each full native suite as one exclusive command,
without overlapping other command sessions, completed93 cases and both long scale
runs. The relationship to process termination is observed, not claimed as a proven
host cause. The optional BUG001_EXTERNAL_PREVIEW test flag changes test server
ownership only, never application readiness; final cumulative gates used their own
strict-port production preview. Failed traces/output are retained alongside logs.

## Acceptance and local delivery

T12 fresh independent B01–B04 visual AND functional verdicts are pending. Do not
read the automated green checks as independent acceptance. No source changes are
permitted during that frozen review. A product finding requires its own failing
regression, minimal fix, cumulative gates and a different fresh critic.

External limits remain explicit: actual OS PWA installation/standalone launch,
native browser-chrome200% zoom and production HTTPS are unverified. CSS zoom is
supplemental; HTTPS/deployment is user-deferred. No trader site data may be cleared,
reseeded or copied into evidence. Final release activation must use the normal
verified update flow and defer while the trader retains an unsaved draft.
