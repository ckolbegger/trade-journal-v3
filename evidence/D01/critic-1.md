# D1 browser-critic report (critic-1)

Fresh critic agent spawned 2026-10-19 at commit `b7f7c4d`; report saved verbatim in substance below. Screenshots and scripts were in the git-ignored `test-results/critic-1/`.

## Header

- Date 2026-10-19. Commit `b7f7c4d` (branch `claude-opus-5.5`; tracked tree unchanged, only the existing untracked handoff files present).
- Node v26.12.0 · Playwright 1.63.0 · Chromium 153.0.8010.12 (headless, `channel: 'chromium'`) · macOS 26.6.2.
- Servers (one at a time on 5175; all stopped at the end, port confirmed free):
  - Production: `npm run build` then `npm run preview` (C1.1–C1.7, C1.10(b), C1.11).
  - Release harness: `npm run build:releases`, then a Node script calling `startReleaseServer({ release: 'v1' })` from `tools/release-server.ts`, with `use('v2')` to switch (C1.8).
  - Faults build: `npm run build:faults` then `npm run preview:faults` (C1.9, C1.10(a)). `npm run verify:no-fault-hooks` OK for `dist/`.
- A fresh persistent profile per flow; C1.4 and C1.7 continue the C1.3 profile, as the plan says.

## C1.1 First launch: PASS

Actions: fresh profile, opened `/`; a MutationObserver recorded every rendered state (CPU throttled 20x).
Observations: states in order were empty, "Checking that this browser can safely store your journal…" (no buttons, links, or inputs), then "Start your journal". The time-zone combobox proposes America/New_York from the full IANA list; the only button is "Start my journal". No empty Workspace or navigation appears before the time-zone step.

## C1.2 Onboarding: PASS

Actions: accepted the zone; submitted a blank Institution, then a whitespace Institution with a blank Account; in a fresh profile, a blank submit, then Institution "Fidelity" with a blank Account, then Account "Individual"; opened Accounts.
Observations: a blank or whitespace Institution is marked invalid with "Enter a name for the Institution." and focus moves to it; a blank Account shows "Enter a name for the Account." with focus on Account. After a successful save the Trades empty state ("No planned trades yet. Start by planning one before you enter it.") offers New Plan; navigation is Trades, New Plan, Accounts, About; the state survives reload. Accounts lists one Fidelity with Individual; retrying after the Account error created no duplicate Institution.
Minor: with both fields blank only the Institution error shows; the Account error appears on the next attempt.

## C1.3 Storage protection: PASS

Observations: the shell region "Storage protection" says "This browser may clear your journal data, for example when the device is low on space. It has not promised to keep it." and offers "Ask the browser to keep data". About shows "Storage protection: Best effort". After pressing the button: "The browser declined to promise it will keep your data. You can keep using the journal."; `persisted()` was false before and after. Writing still works.

## C1.4 Confirm a Plan: PASS

Actions: New Plan with Fidelity — Individual, Long Stock, AAPL, 100, entry 50, Stop 47.50, Target 56, default Plan time, Thesis, Invalidation, Conviction 4, Calm; Confirm; Trades; reload.
Observations: only the selectable Account and Long Stock are offered; prompts match `specs/design/journal.md`. Detail: "AAPL", "Long Stock · Planned", Leg "Long 100 shares of AAPL", $50.00 / $47.50 / $56.00, "1R (original risk) $250.00", "Original reward $600.00", "Reward : risk 2.4", and the Plan Reflection with all four prompts and answers. Planned list row (also after reload): "AAPL | Long Stock | Fidelity — Individual | 2026-10-19 04:13 | $250.00 | $600.00 | 2.4 | Awaiting entry".

## C1.5 Validation: PASS

Observations: the summary "This Plan can’t be confirmed yet" lists "Answer “Why this trade, why now?”." and "The Stop must be below the intended entry, so the Plan has a positive risk." together; both fields are marked with the same messages; focus moves to the summary; values are kept. After reload the list is empty; the probe shows `trades: 0`, `journalEntries: 0`.

## C1.6 Leave without saving: PASS

Observations: after filling every field with marker values, navigating away, and reloading, Trades is empty and the form is blank; a full IndexedDB dump is identical before and after with no marker values; `localStorage` and `sessionStorage` are empty; the release cache holds no marker text.

## C1.7 Offline restart: PASS

Observations: with the preview server killed (confirmed unreachable), the reload shows the AAPL row and About shows all four checks passed. A second Plan (MSFT, 10 @ 400 / 390 / 430) confirmed (1R $100.00, reward $300.00, ratio 3). After an offline cold restart both rows are listed.

## C1.8 Update: FAIL

Actions: harness serving v1; fresh profile onboarded with one Plan; About showed v1 `e00d80de…3f19`; stores dumped. Tab A: New Plan, typed Symbol "NVDA" and a Thesis. Switched the harness to v2. Opened About in a second tab B (a single tab cannot reach About without leaving the form) and pressed "Check for updates". Cancelled in tab A and pressed Reload there. Repeated twice in fresh profiles, with tab B opened before and after typing in tab A.
Observations:
- Tab A: "An update is ready" / "The update waits until you save or cancel the open form." with Reload disabled; values kept; v2 waiting while v1 stayed active. After Cancel, Reload was enabled and activated v2; About showed `6c3c6bdd…c9e2`; all four checks passed; the Workspace dump was unchanged.
- Tab B opened before typing: "The update waits because another tab has unsaved work." with Reload disabled. Correct.
- Tab B opened after typing in tab A: "An update is ready" with Reload enabled and no explanation. Pressing it activated v2 while tab A's form was unsaved; tab A then showed "Updated in another tab: reload when ready" with its values still on screen.
- In every run tab B showed "No update" directly above an "An update is ready" notice, and the notice appeared twice on About (in the shell and inside the About article).
Failure evidence: C1.8 expects "The notice explains the update waits for the form"; A5 requires activation to be deferred while any tab holds an unsaved form, with tabs coordinating over BroadcastChannel; T1.21 requires Reload disabled with an explanation when another tab reports unsaved work; T1.25 says "report 'No update' or show the update notice". Observed: a tab opened after another tab's form became unsaved never learns of it; "No update" and "An update is ready" appear together.

## C1.9 Recovery Only: PASS

Observations: with `?faults=inventory` after a Plan was confirmed with no faults, the banner "Read only: this browser can't save right now" names "The app's offline copy is missing or damaged, so it could not reopen without a network." and includes the A13 paragraph word for word. List and Detail are readable; navigation is Trades, Accounts, About; no New Plan anywhere; Accounts has no Add buttons; About shows "Offline copy complete: failed (InventoryMissing)". Stores unchanged.
Minor: `/plans/new` opened directly renders an empty main area with no explanation (the banner is still shown).

## C1.10 Unsupported and Integrity Blocked: PASS

(a) Faults build, `?faults=diagnostic,capacity`: "This browser can't safely store your journal" lists both checks in plain language, "You can retry once the problem is fixed, or try another browser.", Retry the only control; no Workspace database; `diagnostics` and `pointer` empty.
(b) Production build, `tj-root` at version 99 created from the console (before and after the app had created version 1): "Your journal data may already exist here, but it can't be read … nothing will be created, imported, or overwritten. Retry once the problem is fixed."; Retry the only button; only `tj-root@99` exists.

## C1.11 Responsive, keyboard, About: PASS

Observations: sidebar at 960 px and above, bottom navigation at 959 px and below, no horizontal scroll, URL and values intact at every width. A keyboard-only Plan (Tab, typing, arrows, Space, Enter) confirmed with the correct Detail. Every focused control had a 3 px blue outline, except that the critic saw the Plan time field's focus only as Chromium's highlighted date segment. About lists the release identity and only D1 capabilities; navigation is Trades, New Plan, Accounts, About at both widths.
Minor: after activating the New Plan link from the keyboard, focus lands on `<body>`.

## Summary

Overall: FAIL (10 of 11 flows pass; C1.8 fails).

Defects:
1. C1.8: update activation is not deferred for a tab opened after another tab's form became unsaved. Repro: harness v1, onboarded; tab A New Plan, type; open tab B at `/about`; switch to v2; press "Check for updates" in tab B. Tab B shows an enabled Reload and no explanation, and pressing it activates v2 while tab A's form is unsaved.
2. C1.8 / About: "No update" is shown together with "An update is ready" (and the notice appears twice on About).

Minor observations: onboarding shows only the first blank-field error; Recovery Only `/plans/new` renders an empty main area; focus goes to `<body>` after keyboard navigation; Plan time focus shown only as the native segment highlight.

Ambiguities: C1.8 single tab versus two tabs (the critic used a second tab for About, since leaving the form discards it); C1.10(b) "fresh profile" plus "create from the console" (both variants tested; both pass).
