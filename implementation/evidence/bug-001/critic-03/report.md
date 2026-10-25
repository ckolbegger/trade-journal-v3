# BUG-001 independent critic 03

2026-10-24. **Functional verdict: FAIL. Visual fidelity verdict: INCOMPLETE.**
Acceptance stopped after independently confirming the pending-Save keyboard defect
below. The reference correspondence reviewed so far is substantially improved and
has no separately confirmed blocking visual defect, but this is not a complete
B01–B04 acceptance pass. A different fresh critic is required after repair and
cumulative gates. No implementation changes were made by this critic.

## [P2] Pending Save loses modal keyboard focus and access to scrollable content

Location: `src/presentation/ContextPanel.tsx:16–22`. The dialog has `tabIndex=-1`;
its trap considers only enabled controls. When `busy` disables every form control
and Close, no keyboard target or busy-state focus fallback remains.

Independent real production reproduction, not an application/coordinator mock:

1. Start the strict localhost5174 production preview and a fresh external synthetic
   persistent Chromium profile. Native service-worker, cache, capacity and IndexedDB
   readiness succeed. Create America/New_York Workspace, Institution and Account.
2. At390×1000 use keyboard Tab/Enter/text/typeahead to confirm a10-share KEYBOARD
   Plan at$50, Stop$45, Target$60, with the exact original required Plan Reflection.
3. Open initial entry via keyboard; enter4 shares@$49 fee$0.10 and6@$51 fee$0.20.
   Select Complete reflection, As Planned, Calm, confidence4 and a synthetic Note.
4. Hold the next actual `navigator.storage.estimate` call with an asynchronous
   host-boundary promise, then keyboard-activate Save. No synthetic successful
   estimate, application result or persistence fixture replaces production behavior.
5. Observe Saving…, disabled Execution fields/Close/Save, and Escape correctly not
   dismissing. Entire native roots/versions/lifecycle authority still equals before.
6. Inspect actual focus, then press Tab, Tab, Shift+Tab, PageUp and PageDown.

Expected: the busy modal still contains keyboard focus and provides keyboard
access to its readable scrollable content while editing/dismissal remain frozen.

Observed: focus is already `BODY`, outside the aria-modal dialog. Every Tab probe
remains BODY. PageUp/PageDown leave dialog `scrollTop=1003` with1003px overflow;
the keyboard cannot return to or scroll the dialog. Native axe independently
reports serious `scrollable-region-focusable`, WCAG2.1.1/2.1.3, for this exact
Opening entry dialog. This is actual keyboard behavior, not merely an axe rule
applied to intentionally disabled editing. Preserving the freeze is correct;
losing modal focus/read access is the defect.

Authority: UI contract requires keyboard access, logical focus and accessible
view states. BUG-001-T03 requires focus contained within an open modal; T06/T11
require pending Save, scrolling and keyboard accessibility. Blocking edits during
Save does not waive those requirements.

Focused evidence:

- `busy-keyboard-isolation.mjs`, `attempt-8-busy-keyboard-isolation.log` (exit1).
- `run-1792878225887.json`: source/build/host/profile, full actions, exception,
  preview output and console; no page errors or console errors.
- `1792878225887-busy-keyboard.json`: actual active element, dialog membership,
  scroll position and overflow for all six probes.
- `1792878225887-390-saving-two-executions.png` and adjacent `-axe.json`.
- `1792878225887-keyboard-pending-before-authority.json`: full native authority;
  the driver deep-compares all roots/versions/lifecycle while Save is held.
- `run-1792878041628.json`/`attempt-7.log`: same failure in the larger run.

The focused driver releases the held host promise in `finally`, then closes its
context/runtime. No claim about a completed two-Execution Save is made for this
failed case. It needs a genuine failing regression, smallest repair, all required
cumulative gates and a different fresh acceptance critic. I did not fix or waive it.

## Independent coverage and actual observations

Earlier author gates and critic01/02 artifacts were read as context, not substituted
for these independent runs. Every table observation below comes from critic03.

| Flow | Actions and expected result | Observed / exact evidence | Status |
| --- | --- | --- | --- |
| B01 setup/Workspace | Invalid fixed-offset zone, then valid rules zone; explicit Institution/Account; inspect1440/814/390. | Invalid input retained, no Institution mutation surface before valid Workspace; real catalog setup succeeds; compact warning/help present. `run-1792878041628.json`, `*-setup.png`, `*-workspace.png`. | Exercised |
| B01 Plan/list/Detail/Journal/Debt | Inspect original references and before board; compare current staged Plan, compact lists, both Details, opening, Journal and owed composer across all three widths. | Own settled current pairs/overlays in `comparisons/`; screen observations below. Pending-Save finding stops a complete final visual decision. | INCOMPLETE |
| B02 blank second row |10-share TEN, fill row1, add blank row2, Save, inspect summary and native authority, focus quantity link, Escape/resume, remove only row2, Complete, Save. | Exact “Nothing saved — Execution2 needs a quantity and price”; whole authority unchanged; returned Planned/draft clear; values/errors resume; removal focuses surviving quantity; actual saved1Execution/Open, fees, Lots, history and Journal shown. `1792878041628-blank-row-{before,saved}-authority.json`, width-specific opening/rejected/retained/Open/history captures. | Online journey PASS; full B02 incomplete |
| B03 Complete/Defer/Decline/owed outcomes/Cancel | Real forms and commands; explicit opening Decline reason; Defer, owed filled Cancel and Complete, separate owed Decline; inspect Journal outcomes. | Complete and direct/owed Decline save; Outstanding Journal Debt and reasoned Explicit decline appear inside Journal, repairing critic02 omission. Cancel leaves complete authority unchanged. Original prompt/source/Anchor/moment remain visible. `run-1792878041628.json`, `*-outstanding-journal.png`, `*-opening-declined.png`, `*-owed-composer.png`, `*-owed-declined.png`, owed snapshots. | PASS for exercised outcomes |
| B03 native failed saves | Opening and owed form: native Journal transaction abort, diagnostic throw, capacity failure, corrupted real cache asset; retry after restoring host boundary. | Each enters protective Recovery Only, preserves Note/draft, writes no authority; retry re-enables Save and succeeds. All roots/versions/lifecycle deep-compared, not counts alone. `run-1792878041628.json`, `*-opening-*-authority.json`, `*-debt-*-authority.json` and fault screenshots. | PASS |
| B03 shared store | Two pages in one actual persistent context, same Planned revision; first saves, second submits stale opening. | Winner Open; loser Nothing saved retains quantity; full authority equals winner snapshot. `*-race-winner-authority.json`, `*-shared-store-conflict.png`. | PASS |
| B04 modal/resize/reflow | Escape/restore focus, inert backdrop, Tab/ShiftTab wrap; retain long Note and answers through1023/1024/767/768/390/814/1440; supplemental CSSzoom2. | One modal and one inert background; ordinary nonbusy focus loop/restore pass. Settled Note fits above footer and Close remains visible. No horizontal overflow. `run-1792878041628.json`, `*-css-zoom-supplemental.png`. Busy case fails as above. | FAIL overall |
| B04 Loading/Error/recovery | Hold real estimate during startup; native indexed list error; capacity failure with readable data; unreadable-root guard; separate fresh unsupported profile. | Loading status distinct from Empty; Error offers Retry and returns Ready; readable Recovery permits Detail/history; IntegrityBlocked offers no Create Workspace; all authority unchanged. `run-1792877802361.json` and its loading/list-error/recovery-readable-history/integrity-blocked/unsupported screenshots. | PASS in corrected attempt3 |
| B04 update/offline | New verified release; opening retained closed and open; Cancel permits activation; observe actual reload then verify release; close full browser context and reopen same profile offline. | Both draft presentations defer update and retain input; Cancel permits real activation749a…→bc44…; complete authority equals pre-update and stopped-offline. `run-1792877988088.json`, `attempt-6-update-isolation.log` (exit0), update/stopped-offline captures and snapshots. This focused profile holds a saved Plan, not a saved opening. | PASS for this update/Plan offline case |
| B02 stopped-offline saved opening | Compare committed TEN opening after fully stopped offline reopen. | Not completed before confirmed busy-state defect stopped acceptance. The focused update profile's Plan equality is not substituted for a saved Execution equality check. | INCOMPLETE |

Attempt7's later Loading/update failures are cascading driver failures: its failed
axe assertion left the held estimate unresolved until browser cleanup. Those rows
are not new product findings. Corrected attempt3 owns the state matrix; focused
attempt6 owns actual update/offline proof. Neither proves the missing full B02 case.
The broad final acceptance remains failed/incomplete despite those partial passes.

## Visual assessment, calibration and limits

Read the full handoff/BUG plan/execution baseline, canonical UI/delivery contracts,
overview and module contracts, glossary/ADRs and acceptance requirements. Inspected
the original installed-flow pictures via reference grids and full assets, including
Home, Add Execution, filled Plan and Journal; the before/reference board; and the
current author comparisons. Current independent scenes are captured at1440/814/390,
DPR1,1000px viewport height with native local fonts. `run-1792878041628.json` binds
body text, font readiness, geometry, scan results and the source for these scenes.

Original images calibrate1800→1440 and1018→814 at1.25, with45 physical pixels of
prototype host chrome removed. Source DPR is inferred, not claimed measured.
Independent wide nav is240px, main outer868px minus48px padding gives820px inner
content; standard row70px; drawer440px with24px inset. These agree with T01's5%
targets. Narrow modal widths814/390 and centered480px outer main at814 match the
448px inner form target.390 is responsive parity, not an original390px mockup.

White navigation, one filled active destination, outlined New Plan, compact avatar
rows, warm ground, quiet borders, near-black actions, condensed numerical headings,
chips and contextual drawer/sheet now visibly correspond to the references. Actual
fees/entry metrics, exact times, original reflection fields and explicit outcome
status grow Detail/forms; those are documented semantic/safety adaptations. Plan's
additional Account/instrument card and full original reflection increase height.
Journal cards display complete historical metadata rather than prototype taxonomy.
Setup/protective states have no original direct picture and use the same tokens.
Required safety warnings remain visible; no fake P&L/adherence or future controls.

Own settled reference/current pairs and50% overlays are in `comparisons/`, generated
by `compare-current.py`, with image hashes. In the author's supporting board,
`1440-open-list-side-by-side.jpg` captured Loading rather than Ready; it cannot
prove row fidelity. My same-named independent pair has the actual TEN Open row.
Early full-page screenshots of fixed modals can place the panel at page-scroll
offset; final attempt7 modal captures use viewport screenshots and retain scrollY
and viewport geometry. Neither artifact is treated as an application defect.

`manual-contrast.json` calculates actual CSS pairs: normal text5.667–18.953:1,
warning8.793:1, input boundary3.544:1, focus4.819–5.433:1. Screenshot inspection and
native axe supplement this, not an exhaustive claim about every native widget.
Attempt7 has76 scans,75 with zero violations and the one confirmed busy failure;
focused attempt8 has10 scans, nine clean plus the same serious failure. Visual
fidelity is left INCOMPLETE because the repair-loop stop prevents a complete final
all-state acceptance; no screenshot-only approval is issued.

## Provenance, retained attempts and cleanup

Observed source SHA-256 on every native attempt:
`682f21e4f77151620270ebf258d822b2bd350fb2a455271c2da7ba447e31d8bd`.
Observed base release:
`749a0791565687c4c795c4a1dbfc8ce94b79c15f3a806aa202ffed8a8d9c52fb`.
Verified update release:
`bc44f5b7d8170a5dc90d8beead45afe6c62722a12f526f6a7ba94ce398aa69cf`.
HEAD11216bf0138e1dff372e9270afe5c935dfa1e984 plus authorized frozen candidate.

Native Chromium156.0.8078.4, Node26.12.0, Darwin25.6.0, AppleM4Max; secure loopback
localhost5174 with strict production preview. No fake-indexeddb, application mock,
seed bypass, user profile or existing browser tab. Profiles are external temp paths
listed in each run; all contexts closed. Browser Mach-port launch needed permitted
escalation after attempt1 failed before UI access. Server stdout/stderr and complete
browser console are retained in run JSONs; normal/focused runs report no console
errors or page errors. Faults operate only on isolated native host boundaries.

Attempt2 preserves incorrect literal Outstanding/Loading selectors and cascading
secondary-tab update blockage. Attempt3 corrects those, but repeated VERIFY_RELEASE
polling holds old-worker extendable events and interferes with activation. Attempt4
has an instrumentation Client.url property error. Attempt5 retains worker-polling
interference. Attempt6 passively waits for a document marker to disappear on reload
before asking for actual worker release; it passes activation/offline. These are
classified driver attempts, not valid product Reds and not passing full reviews.
Attempt7 adds keyboard-only multirow pending Save and finds the actual product
failure; attempt8 independently isolates and confirms actual keyboard behavior.
Driver versions and logs remain under this directory. Drivers were adapted from
critic01's reviewed scaffolding; every attributed result above was freshly executed.

After every swap, dist was removed and restored from the exact owned backup.
Each run verifies all14 emitted-file digests against final-local-verification before
and after; no restoreFailure, and final `portFree=true`. Final independent `lsof
-nP -iTCP:5174 -sTCP:LISTEN` returns no listener. Only owned previews were stopped.
Parent was signaled before runtime and after final cleanup. No implementation,
tests, tools, config, specs, user records, commit, push or deployment were changed.
All critic writes are within `implementation/evidence/bug-001/critic-03/`.

OS installation/standalone launch, actual browser-chrome200% zoom and HTTPS remain
UNVERIFIED; CSSzoom is supplemental. Cumulative unit/integration/browser/scale and
migration gates are author-attributed context, not independently rerun here. This
report neither waives those limits nor certifies completed acceptance.
