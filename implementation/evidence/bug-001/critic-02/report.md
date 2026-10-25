# BUG-001 independent critic 02 — acceptance stopped on product defect

Date: 2026-10-24. Functional verdict: **FAIL**. Visual fidelity verdict: **INCOMPLETE**.
This is an independent native reproduction of a concrete acceptance failure, not a
complete B01–B04 acceptance pass. Following the repair-loop rule, review stopped
at the confirmed defect so the implementer can add a regression, repair it, rerun
the required cumulative gates and appoint a different fresh critic.

## [P2] Trade Journal omits saved explicit declines

Location: `src/presentation/App.tsx:278`, Trade Journal `ContextPanel` body.
The body maps only `detail.entries`; the adjacent ordinary Detail also renders
`detail.journal.obligations` and linked declines. Consequently, the contextual
Journal loses outcomes that were correctly saved and are visible on Detail.

Independent actions through real production controls:

1. Start a new isolated Chromium persistent profile and pass native readiness.
2. Create synthetic America/New_York Workspace, Institution and Account.
3. Confirm an exact 10-share DECL Plan at $50, Stop $45, Target $60, completing
   the original Plan Reflection.
4. Record one initial buy Execution, 10 shares at $50, fee $0.25. Choose
   Decline reflection and enter `Independent explicit decline evidence` as reason.
5. Save opening entry. Observe returned Open state and recorded Execution.
6. Observe `Position Change Reflection · Explicit decline`, save time and reason
   on ordinary Detail. Capture complete roots/versions/lifecycle authority.
7. Open `View Trade Journal`. Capture dialog at 1440, 814 and 390 CSS pixels.

Expected: Trade Journal explicitly shows the Position Change Reflection decline,
its Source/Anchor and time/reason, distinct from completed Entries. It must not
manufacture an Entry. Exact wording need not be `Explicit decline`; semantic
presence of the saved outcome is the requirement.

Observed: the named Trade Journal dialog contains only Plan Reflection and its
answers. It has no Position Change Reflection, decline, reason or outcome time.
The outcome exists on the inert background Detail but is absent from the dialog's
accessible and visible content. Opening the view leaves the complete authority
unchanged. This is a presentation defect, not lost storage or failed settlement.

Authority: `specs/design/ui-contract.md`, Trade and Journal presentation, requires
Journal timelines to display Debt/decline status without inventing incomplete
Entries. BUG-001-T08 explicitly requires original definition/source/origin/moment
and explicit outstanding/completed/declined state, including both outcome types.
The frozen execution baseline lists Trade Journal saved/declined/outstanding.

Evidence:

- `run-1792876310311.json`: exact command, frozen hashes, host/browser/profile,
  expected/observed assertion, full Detail/dialog text, geometry, six axe scans,
  preview stdout and console. No page errors or console errors.
- `1792876310311-decline-before-authority.json` and
  `1792876310311-decline-saved-authority.json`: complete authority before/after Save.
- `1792876310311-{1440,814,390}-declined-detail.png` versus
  `1792876310311-{1440,814,390}-declined-journal.png`: visible outcome on Detail,
  omitted from dialog. Each screenshot has adjacent `-axe.json`; no AA violations.
- `attempt-2.log`: behavior-caused assertion failure. Process exit is 0 because
  the critic driver retains assertion failures in its result array; **this is not
  a passing test or acceptance run**.

The same body also has no rendering path for Outstanding Debt. That is a code
observation requiring regression coverage, not an independently exercised second
native finding in this focused run. Cover both states during the fix.

## Provenance and cleanup

Observed source digest: `f9697f14fee1e03b20f3f138a6fb8e41db68741191aec5b4818d45aab198c210`.
Observed release: `33cc2444e5d648b6fafc68d73011727ae4049bb656c469009133ce7c94b26bc1`.
Every distribution digest matched `final-local-verification.json` before and after.
No application, test, tools, config, spec or distribution changes were made.

Native Chromium 156.0.8078.4, Darwin 25.6.0, Apple M4 Max, Node v26.12.0;
DPR1, viewports1440/814/390 by1000. Profile is outside the repo and named in the
run record. Only synthetic data was used. No existing browser tab/profile or user
records were accessed. No fixture bypassed production application commands.

First attempt failed before UI access because sandbox macOS Mach port permission
prevented Chromium launch; `attempt-1.log` and `run-1792876288953.json` retain it.
Permitted escalation for the isolated native launch produced the second attempt.
That infrastructure failure is not a product Red.

The profile was closed and only this driver's preview was stopped. `lsof -nP
-iTCP:5174 -sTCP:LISTEN` returned no listener after cleanup. No distribution swap
was needed; all files retain exact frozen digests. No commit/push/deploy.

## Acceptance coverage and limits

B03 Decline visibility: FAIL as above. Real setup/Plan confirmation/Decline Save
and modal AA/reflow captured as supporting evidence. B01 full reference fidelity,
B02 blank-row/offline equality and B04 full keyboard/update/state matrix are not
independently accepted by this critic; prior automated or critic01 artifacts are
not substituted for my own acceptance. A new critic must exercise all B01–B04
against the repaired frozen build. OS installation, browser-chrome200% zoom and
HTTPS remain unverified; CSS dimensions do not certify native zoom.
