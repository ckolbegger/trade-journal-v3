# BUG-001 independent critic 04

2026-10-24. **Functional verdict: FAIL. Visual fidelity verdict: PASS for the reviewed installed D1/D2 presentation and documented adaptations. Overall acceptance: FAIL.** A real asynchronous browsing defect remains. This critic made no application, test, tool, configuration or specification changes. A genuine regression, minimal repair, required gates and a different fresh critic are required before completion.

## P2 — An older Planned result replaces the selected Open result

Location: `src/presentation/App.tsx:120`, `browse`.

The function changes the lifecycle/filter immediately, starts a read, and unconditionally installs its result after awaiting it. It does not establish that the completed request still owns the current view. Two ordinary navigation actions can therefore display an older lifecycle page under the latest filter.

Independent production reproduction:

1. In a new isolated native synthetic Workspace, create 51 ten-share Plans through the actual two-stage production forms. Save a separate STALEDEBT opening through the real opening form with Defer; the saved Trade is Open.
2. Launch another page in the same persistent native context. Wait for the initial Trades heading and populated DENSE51 Planned row, establishing Ready.
3. Click Trades, then Open while the first read is pending. Allow the reads to finish (600ms in the focused probe).
4. Observe **Open Trades**, the filled **Open** filter, and **DENSE51 · Planned** through **DENSE02 · Planned**, with Next 50 Trades. The existing STALEDEBT Open row is absent.
5. Click Open again after the competing read has finished. The correct STALEDEBT Open row appears. Subsequent probes with Open already selected also show the correct Open row.

Expected: the final selected lifecycle owns the displayed result. An earlier Planned request cannot overwrite a later Open request; pending work must remain Loading or install only a result for the current request.

Observed: a coherent older Planned response is presented as the Ready contents of the Open screen. The screenshot visibly contradicts the heading/filter. This hides the requested existing Open Trade until another refresh/filter action. It is a product failure of T04's lifecycle/selection/view-state obligations, B01/B04 and AC-UI-001/002, not an incorrect symbol or missing fixture.

Evidence:

- `1792879841011-race-nav-0.png`: viewport screenshot showing the contradiction.
- `run-1792879841011.json`, `navigationProbes[0].body`: full settled body text including all 50 Planned rows under Open Trades; probes1–4 show the recovered correct Open result.
- `focused-debt.mjs`, `attempt-3-focused-debt.log`: exact UI actions and 600ms settling interval. No read delay, application mock, seeded store, coordinator replacement or fixture result induces this race.
- `run-1792879736107.json` / `attempt-2-supplement.log`: the initial secondary-page timeout finding the existing Open row. The focused run identifies its actual cause. This attempt is product-caused, not relabelled as a selector failure.

The focused driver's navigation probes intentionally collected observations before the ordered Debt check; its exit0 means its encoded checks passed, **not** that this observed view contradiction passed acceptance. The finding above controls the verdict.

## Independent B01–B04 coverage

Main run: `run-1792879653008.json`, `driver.mjs`, `attempt-1.log` (exit0). It completed all12 encoded groups before the supplemental finding. Screenshots use prefix `1792879653008-`, width1440/814/390 unless stated. Each result includes actions in the retained driver, observed body text, geometry, native axe results and authority digests. These passes do not waive the later defect.

| Flow | Actions and expected outcome | Independently observed evidence | Result |
| --- | --- | --- | --- |
| B01 setup/Workspace | Reject fixed-offset zone, retain it, then initialize rules zone and explicitly add Institution/Account. Inspect all widths. | Invalid +05:00 retained; no premature catalog control. America/New_York, Institution and Account succeed. `*-setup.png`, `*-workspace.png`; native secure context, worker/cache/capacity readiness recorded. | PASS |
| B01/B03 Plan | Blank/filled instrument stage, Next/Back, validation and Cancel without writes, final ten-share confirmation with original reflection. | Stages retain Stock symbol. Validation and Cancel leave full authority equal. Real Confirm returns Planned baseline/reflection. `*-plan-stage1-{blank,filled}.png`, `*-plan-stage2-blank.png`, `*-plan-validation.png`, `*-planned-detail.png`, `*-plan-stage-before-authority.json`. | PASS |
| B01 lists/Detail | Inspect Planned/Open row, both Details, exact fees/holdings/quality, saved Execution and audit history; inspect density1/10/50/51 and page return. | Standard desktop row70px; nav240px. Real saved opening visible in Open list. Supplemental UI-created density and second-page Detail/Back context pass (`1792879736107-*-density-{10,50,51}.png`). Rapid lifecycle navigation fails as reported. | FAIL overall |
| B02 rejected blank row | TEN ten-share Plan; row1 ten@$50 fee$0.25, add blank row2, Save, error link, Escape/resume, remove row2, Complete and Save. | Exact Nothing saved/Execution2 diagnostics; full native roots/versions/lifecycle equal on rejection. Planned/draft unmistakable; quantity/fee/blank row/errors resume identically. Link focuses row2; removal focuses surviving row1. Real Save shows saved1Execution/Open; recorded rows, Lots, history and Journal. `*-opening-{blank,rejected,filled}.png`, `*-retained-draft-detail.png`, `*-blank-row-{before,saved}-authority.json`, `*-open-detail.png`, `*-history.png`. | PASS |
| B02 fully stopped offline | Immediately after that opening journey, close the entire native persistent browser context; relaunch same external synthetic profile offline; verify release, Open recorded facts/history and whole authority. | No secondary browser page survives. `*-b02-before-stop-authority.json` and `*-b02-after-stop-authority.json` deep-equal, not just counts; `*-b02-stopped-offline-opening.png`. No opening action reappears. This independently completes the missing critic03 case. | PASS |
| B03 opening/Journal outcomes | Complete, Defer, explicit Decline with reason; inspect outstanding and declined Journal drawer at all widths; owed Cancel, Complete and Decline. | Original prompt/source/Anchor/moment retained. Defer displays Outstanding rather than a fabricated Entry; explicit decline/reason now in Journal. Cancel preserves authority. `*-outstanding-journal.png`, `*-opening-declined.png`, `*-debt-queue.png`, `*-owed-{composer,declined}.png`, owed snapshots. | PASS |
| B03 native failed saves | Both Opening and Debt: actual Journal transaction abort, diagnostic throw, capacity failure and corrupted real cached asset; restore fault and Retry. | Every case protects writes in Recovery Only, preserves entered Note/draft, and deep-compares full authority unchanged before/after; retry enables real Save and succeeds. `*-opening-*.png`, `*-debt-*.png`, respective `*-fault-before-authority.json`; details in main run. Host-boundary faults never replace a successful application result. | PASS |
| B03 shared native store | Competing opening tabs on one native store; separate owed Debt conflict after both have rendered the same obligation. | Opening winner saves; loser Nothing saved retains quantity; entire authority equals winner. Focused ordered Debt winner Decline settles; stale Complete loser retains Note and writes nothing. `*-shared-store-conflict.png`, `1792879841011-*-shared-debt-conflict.png`, winner authority snapshots. | PASS for both conflicts |
| B04 ordinary keyboard/modal/resize | One dialog/inert background, Tab/ShiftTab wrap, Escape/Close restores invoker; long Note retained through1023/1024/767/768/390/814/1440; CSSzoom2 supplemental. | Fields/answers retained; settled focused Note stays above footer, Close remains visible, no horizontal overflow; Cancel changes only view state. Main run contains geometry; `*-css-zoom-supplemental.png`. | PASS |
| B04 keyboard-only Plan/two Executions | Tab/Enter/text/typeahead confirm Plan; enter4@$49 fee$0.10 and6@$51 fee$0.20; keyboard choose original reflection and Save. | Real two-Execution atomic Save returns Open and recorded rows; `*-keyboard-two-executions-recorded.png`, complete before/after authority. | PASS |
| B04 repaired pending Save | Hold the real native storage estimate promise during actual Opening and Debt Save; inspect disabled editing/dismissal, Tab/ShiftTab/PageUp/PageDown, full no-write authority, then release. | Focus remains the dialog DIV. Opening PageUp scroll1003→249; PageDown→1003; Tab/ShiftTab stay inside. Debt also retains dialog focus; its content fits1000px viewport so scrolling correctly remains0. Both native axe clean. `*-opening-busy-keyboard.json`, `*-debt-busy-keyboard.json`, `*-390-{opening,debt}-held-saving.png`; real saves complete after release. | PASS |
| B04 Loading/Error/Recovery | Held real startup estimate; native indexed list-read error/retry; capacity failure with retained readable data/history; unreadable root; separate fresh unsupported profile. | Explicit Loading rather than false Empty; Retry returns Ready. Recovery reads/history remain reachable; unreadable/Unsupported show no Create Workspace. Entire authority unchanged. `*-loading.png`, `*-list-error.png`, `*-recovery-readable-history.png`, `*-integrity-blocked.png`, `*-unsupported.png`. | PASS |
| B04 update and stopped offline | Stage complete update, close retained unsaved opening, check update; reopen draft; Cancel, real activation, close entire browser context and reopen offline. | Reload disabled for both closed/open retained draft; values preserved, authority equal. After Cancel actual document reload occurs, then worker identity verified7420a409…; whole authority equal online and fully stopped offline, including TEN opening. `*-update-{closed,open}-draft.png`, `*-update-{before,after}-authority.json`, `*-stopped-offline*.png`. | PASS |

## Separate visual fidelity assessment

Visual fidelity **PASS** is a presentation judgment against the actual original images, before/reference board and current candidate, not a screenshot-only acceptance or a claim that the incorrect lifecycle view is functionally acceptable.

Read the complete handoff/BUG plan, execution baseline, canonical UI/delivery and acceptance contracts, overview, glossary and module boundaries; inspected the evidence README/current verification record. Opened the actual24 reference assets through original image contact sheets and selected full-resolution Home desktop, filled Plan narrow and Add Execution desktop images. Inspected `before-reference-board.jpg` and all39 current author side-by-side scenes through five contact sheets (`current-board-*.jpg`), with independent runtime screenshots as the final presentation evidence. Future spread/statistics assets are reference context only; those capabilities remain absent.

Independent `comparisons/` contains calibrated original/current pairs and50% overlays, generated by retained `compare-current.py` with hashes. Original host chrome45physical pixels is removed, then1800→1440 and1018→814 at1.25. Source DPR is inferred, not measured; actual independent native DPR1 is recorded.390 is responsive parity against the814 reference, not an invented original390 geometry. Author fixed-modal full-page board offsets are not treated as UI defects; independent dialogs use viewport captures after fonts/layout settle.

Measured desktop sidebar240px, inner content820px (868outer minus48padding), standard row70px, drawer440px with24px inset agree with T01±5% major targets. Narrow centered form uses448px inner content at814 and adapts at390. White navigation with one active state, outlined New Plan, cream ground, restrained rounded cards, avatars, condensed numeric hierarchy, compact chips and right drawer/bottom sheet composition closely correspond to the references. Independent 10/50-row density remains consistent; no wide generic all-primary form remains.

Permitted semantic/safety adaptations remain justified and visible:

- Trade Journal branding and installed canonical destinations replace prototype host/name/navigation.
- Real fees, holdings, Entry Quality and frozen risk/reward replace fake valuation/P&L/adherence; no future operations are added.
- Actual Account/Stock controls and original Plan Reflection add height to staged Plan cards; prototype-only option strategies/catalyst/exit-day fields are absent.
- Required exact instants, fees, multiple Execution rows and original complete reflection increase drawer content; sticky header/footer and scrolling keep the single Save boundary accessible.
- Completed/Outstanding/Explicit decline and original metadata replace prototype taxonomy; no placeholder Entries or Add/Edit/Void affordances.
- Setup/recovery/readiness have no direct original picture and use the same composition while keeping protective text and Best Effort action visible.
- Locally bundled Rubik and Liberation Sans Narrow supply the visual hierarchy; original raster font identity is unknown, so exact font identity is not claimed.

Manual screenshot inspection plus independent current-CSS contrast recomputation is retained in `manual-contrast.json`: text5.667–18.953:1, warning8.793:1, input boundary3.544:1, focus4.819–5.433:1.131 independent native WCAG A/AA scans report zero violations, including both repaired held-Save states. This supplements actual keyboard behavior and visual inspection; it does not certify every native widget/OS interaction.

## Provenance, commands and cleanup

Frozen observed source SHA-256 on all three runs:
`6158c98e22f94ad752e40e3e149cfa272f910abb0605a89eee99705cdcccf849`.
Base production release:
`825fa371a65315cba0fde10e41d4a8b3779c641e9d35a70b3abc760e9ea77d39`.
Verified update release:
`7420a4095fd05afe31cac6cd619915b792f8f730b9d47e68bd0db5189edb38c3`.
HEAD11216bf0138e1dff372e9270afe5c935dfa1e984 plus authorized frozen candidate.

Actual commands from the explicit workdir:

1. `node implementation/evidence/bug-001/critic-04/driver.mjs` → `attempt-1.log`, exit0; run1792879653008.
2. `node implementation/evidence/bug-001/critic-04/supplement.mjs` → `attempt-2-supplement.log`, exit1; run1792879736107. Retained product-caused secondary navigation failure.
3. `node implementation/evidence/bug-001/critic-04/focused-debt.mjs` → `attempt-3-focused-debt.log`, exit0; run1792879841011. Observational navigation evidence confirms the defect; ordered Debt conflict passes.

Each owning command starts its own `npm run preview -- --host localhost --port 5174 --strictPort`, native browsers and cleanup. Main/supplement/focused driver scaffolding is adapted from critic03, but every attributed observation here was freshly run. The copied `evidence.command` field names the main driver in all three JSONs; the exact actual invocations are the command/log mapping above and retained separate scripts.

Native Chromium156.0.8078.4; Node26.12.0; Darwin25.6.0; AppleM4Max. Secure browser-recognized loopback localhost5174. Profiles are new synthetic external temp directories recorded in run JSONs; focused run reopens only the known critic-created supplemental synthetic profile. No user tab/profile/records, fake-indexeddb, application/coordinator/calculation/result mock or direct seeding bypass. Faults are disclosed native host boundaries only.

Server stdout/stderr and entire browser console/pageerror events are in every run JSON. All three have no console errors, page errors or server errors. All contexts closed; only the owned preview stopped. Main update swap restored exact original dist; every run compares all14 emitted-file hashes before/after, with no restoreFailure. Every final run records `portFree=true`; separate final `lsof -nP -iTCP:5174 -sTCP:LISTEN` returned no listener. Parent was signaled on runtime start/cleanup. Parent owns final trader-preview restoration.

All critic writes are confined to `implementation/evidence/bug-001/critic-04/`. No commit, push or deployment. Main successful12 groups plus supplementary density/ordered conflict do not override the confirmed current functional defect.

External limits remain explicit: OS installation/standalone launch, native browser-chrome200% zoom and production HTTPS are UNVERIFIED; CSSzoom is supplemental, HTTPS/deployment user-deferred. Cumulative120unit/7integration/93native-browser/9visual/scale/migration gates are author-attributed context bound by the verification record, not independently rerun by this critic. No broad completeness claim is made beyond the independent coverage and limits above.
