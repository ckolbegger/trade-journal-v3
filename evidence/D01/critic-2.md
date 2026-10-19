# D1 browser-critic report (critic-2)

Fresh critic agent spawned 2026-10-19 at commit `bb283dd`, after the critic-1 fixes. Report saved in substance below; scripts and screenshots were in the git-ignored `test-results/critic-2/`.

## Header

- Date 2026-10-19 (about 04:20–04:36 EDT). Commit `bb283dd`; tree clean apart from the two untracked handoff files.
- Node v26.12.0; Chromium 153.0.8010.12 (Playwright 1.63, `launchPersistentContext(dir, { channel: 'chromium', headless: true })`, 1280×900 unless stated).
- Servers: production `npm run build` then `npm run preview` (C1.1–C1.7, C1.11; stopped for the offline steps of C1.7); release harness `npm run build:releases` then a Node script importing `startReleaseServer` from `tools/release-server.ts` run from the repository root, switching with `use('v2')` (C1.8); faults build `npm run build:faults && npm run preview:faults` (C1.9, C1.10). All stopped at the end. No tracked file edited, no commit.
- A fresh persistent profile per flow; C1.2–C1.7 continue one profile, as "After C1.4" implies.

## Results

| Flow | Status | Key observations |
|---|---|---|
| C1.1 First launch | PASS | Empty root, then "Checking that this browser can safely store your journal…" with no controls or navigation, then "Start your journal" proposing America/New_York with every IANA zone listed. |
| C1.2 Onboarding | PASS | Blank or spaces-only Institution: "Enter a name for the Institution." under the field, `aria-invalid`, focus moved to it. After a valid save: "No planned trades yet. Start by planning one before you enter it." with New Plan; navigation Trades, New Plan, Accounts, About; survives reload. |
| C1.3 Storage protection | PASS | Shell warning "This browser may clear your journal data…" with "Ask the browser to keep data"; About "Storage protection: Best effort" matching `persisted() === false`; after pressing, "The browser declined to promise it will keep your data. You can keep using the journal."; writing still works. |
| C1.4 Confirm a Plan | PASS | Detail "AAPL", "Long Stock · Planned", "Long 100 shares of AAPL", $50.00 / $47.50 / $56.00, "1R (original risk) $250.00", "Original reward $600.00", "Reward : risk 2.4", reflection with prompt labels; list row `AAPL / Long Stock / Schwab — Individual / … / $250.00 / $600.00 / 2.4 / Awaiting entry`, numbers right-aligned; unchanged after restart. |
| C1.5 Validation | PASS | Summary "This Plan can't be confirmed yet" lists the blank-Thesis and Stop-above-entry issues together, each also under its field; focus moves to the summary; values kept; nothing listed after reload and no new Trade in the probe. |
| C1.6 Leave without saving | PASS | Leaving by navigation link, Back, and Cancel, each followed by reload: form empty, store dump byte-identical, Web Storage `{}`, marker text nowhere. |
| C1.7 Offline restart | PASS | With the server stopped: Writable, all four checks passed, AAPL listed; BRK.B confirmed (1R $205.00, reward $605.00, ratio 2.95); both present after a second offline restart; the reload-in-open-tab variant also worked. |
| C1.8 Update | PASS | Two tabs (form in A, About in B): after the check B shows "An update was found. Use Reload in the update notice." and the notice "The update waits because another tab has unsaved work." with Reload disabled; A shows "The update waits until you save or cancel the open form." with Reload disabled, still on v1 with values kept. After Cancel, Reload enabled; after Reload, About shows the v2 identity, all checks passed, both tabs on v2, store dump identical. Variants: single tab (notice within about 6 s with the save-or-cancel reason), a tab opened while v2 waits, a third tab typing then clearing, closing a dirty tab — all behave as specified. |
| C1.9 Recovery Only | PASS | "Read only: this browser can't save right now" naming the inventory check, with the A13 paragraph word for word; navigation Trades, Accounts, About only; list, Detail, Accounts (no Add buttons), About ("Offline copy complete: failed (InventoryMissing)") readable; store dump unchanged. |
| C1.10 Unsupported and Integrity Blocked | PASS | (a) `?faults=diagnostic,capacity`: both checks named in plain language, "…or try another browser.", Retry; no Workspace database; diagnostics empty. (b) `tj-root` bumped to 99 from the page then reload: "Your journal data may already exist here, but it can't be read … nothing will be created, imported, or overwritten." with Retry only; root stays at 99, no Workspace. A stale Plan-form tab pressing Confirm after the bump shows Recovery Only with values kept and writes nothing. |
| C1.11 Responsive, keyboard, About | PASS | Sidebar at 960 px and above, bottom navigation at 959 and below, values and URL intact, no horizontal scroll at 390 px; keyboard-only first run, onboarding, and Plan with a `3px solid` outline on every focused control (Plan time included); About lists the release identity and only D1 operations, Strategy, and Entry Type; navigation offers nothing beyond D1; unknown paths reach nothing. |

**Overall: PASS. Defects: none.**

## Minor observations (not pass-condition failures)

1. A tab still on the first-run step silently ignores "Start my journal" after the root is made unreadable in the background (nothing is created; after reload Integrity Blocked appears correctly).
2. A partly failed onboarding (Institution saved, Account blank) leaves an Institution that, after reload, cannot be chosen again: re-entering its name is rejected as a duplicate. With both fields blank only the Institution error shows at first.
3. The storage-protection warning is not shown on the first-run and onboarding screens, although data is saved there.
4. `/plans/new` opened directly in Recovery Only, and unknown routes, render an empty content area with no message.
5. Focus is left on `<body>` after route changes.
6. About's "Offline assets" value is right-aligned while the card's other values are left-aligned.
7. One unreproduced glitch: About once showed an empty "Time zone"; eight later runs always showed America/New_York.
8. The rejection summary lists the Thesis issue before the Stop issue, the reverse of the form order.

## Ambiguities

- C1.8 tab count: read as two tabs (form in A, About in B); the single-tab reading also passes.
- C1.10(b): on a fresh profile, reaching the console loads the app, which creates `tj-root` at version 1, so the step is an upgrade from 1 to 99; the result matches the pass condition.
