# Setup snapshot: structural evidence

## ST.1 The shared helper, and d9ar/review.spec.ts on it

What changed (test code only):
- e2e/d1/support.ts: `defineSetup(name, build)` registers a setup (build runs on an empty profile and returns its open context plus what a test needs, such as Trade ids). The shared `test` gains a worker fixture `savedSetups` (builds each setup once on first use, in a side folder under the output folder, through the first asking test's own server switched to dist-releases/current and then switched back; closes the browser after the build; removes the folders at worker end) and a test fixture `copySetup(setup)` (clones the saved folder with cp -c -R into the test's own profile folder, removes Chromium's Singleton lock files, returns what the build returned). Declared, not automatic: a test that does not ask keeps an empty profile.
- e2e/d9ar/support.ts: `STANDARD_REVIEW` (the three-Trade Review, BREN, AXIO, DALE held, through session 10) built with the existing buildReview, and `openStandardReview(profile, copySetup)` with buildReview's return shape: copy, launch at Mon 11-16 close, check the Review link is there and "Start your journal" is not, open the Review, check the stored Trades are the setup's.
- e2e/d9ar/review.spec.ts: the five tests start with `openStandardReview(profile, copySetup)` instead of `buildReview(profile)`; bodies otherwise unchanged.

Later tasks: define a setup beside its builder, ask for it with `copySetup`, and change how their tests start.

Which tests start from which setup: all five tests of d9ar/review.spec.ts start from STANDARD_REVIEW. None kept its own build.

Port note: the work uses the primary ports (5175, 9341, 9342); no port change.

Deviation from the proof of concept: the build runs inside the first asking test (through that test's server, switched to dist-releases/current and back), not in an automatic worker fixture before any test. This avoids two servers on 5175 when the shared test already has an automatic server (d4's). The first test's time therefore includes the build.

Break check (copy switched off, so an empty profile): all 5 tests failed (the Review link never appeared on the first screen); copy switched back on: all 5 pass. The switch was one line in copySetup (the cp call), restored by an edit (git diff shows no trace).

Unchanged-spec check: e2e/d2/narrow.spec.ts (uses `profile`, no setup) passed with it (5 passed) in the same run as review.spec.ts (10 passed, 20.2 s).

### ST.1 ocr

gpt-6.1-sol, session 32f3707a: 3 files reviewed (2 excluded), 2 findings, both Valid. `evidence/Setup-Snapshot/ocr/ST.1-2ef488d0.json`.

- **ST.1-B1** (`e2e/d1/support.ts:86`): the setup is always built on `dist-releases/current`, but the d9ar tests serve `dist-faults` (d7's automatic fixture switches the server). The copy carries `current`'s service worker and cache, so the tests may run a different build than before.
- **ST.1-B2** (`e2e/d1/support.ts:88`): if a builder throws after launching a browser, its context is never closed, and the rejected build stays in the map.

## ST.1-B1 A saved setup is built on the release its tests serve

What changed (test code only, e2e/d1/support.ts): the build no longer switches the asking test's server to dist-releases/current. It runs through the asking test's own server on the release that server serves now (dist-faults for the d9ar tests). Saved setups are keyed by setup name and release, with the release in its own side folder, so a copy is only built for, and handed to, a test serving that release. The helper records the release it built on and, when a test asks, fails loudly if it differs from the one the test serves: `Saved setup "<name>" was built on <release> but this test serves <release>`.

Which tests start from which setup: unchanged from ST.1 (the five tests of d9ar/review.spec.ts start from STANDARD_REVIEW). None kept its own build.

Mutation run (the check shows): the recorded release forced to dist-releases/current. All 5 review tests failed with `Saved setup "standard-review" was built on dist-releases/current but this test serves dist-faults`; restored (git diff shows only the fix); the 5 pass, with narrow.spec.ts 10 passed together (20.6 s; before 20.9 s).

Assumption: a test that switches the server after its copy was made is not detected (the check runs when the copy is asked for), and the saved copy keeps the service worker and release cache of the release it was built on.

## ST.1-B2 A failed build closes what it launched

What changed (test code only, e2e/d1/support.ts): the builder gets a profile whose launch tracks every context it opens, as the profile fixture does; they are all closed in a finally when the build ends, failed or not. A build that throws fails with `Saved setup "<name>" failed to build: <the builder's message>` (the original error kept as cause).

Failure kept, not retried (one sentence): the rejected build stays in the map so each asking test fails at once naming the setup, because a retry would repeat a long build that already failed, once per asking test.

Check (temporary spec, deleted, not committed): a setup that launches a browser, opens a page and throws; two tests asking for it both fail with the message above (the second without a second build). With the finally close: no Chromium on the setup's folder left after the failure; with the close removed (mutation): one was left (pgrep found its process). Restored.

Which tests start from which setup, which kept their build: unchanged (the five d9ar/review.spec.ts tests on STANDARD_REVIEW; none kept its own build).

Break check after both fixes (e2e/d9ar/review.spec.ts): copy switched off (the cp call replaced): 5 failed (toBeVisible on the first screen); switched on: 5 passed (11.3 s). Both specs together after B2: 10 passed (20.4 s).

### ST.1-B1 and ST.1-B2 ocr

gpt-6.1-sol, session 84331d74, range 2ef488d0..2aa85183: 1 file reviewed (e2e/d1/support.ts), 0 findings. `evidence/Setup-Snapshot/ocr/ST.1-B1-B2-2aa85183.json`.

## ST.2 d9ar/responsive-a11y.spec.ts on the shared helper

What changed (test code only):
- e2e/d9ar/support.ts, beside openStandardReview: `openStandardReview` now shares a private `launchStandardCopy` (copy, launch at Mon 11-16 close, go to a page, check the Review link and "Start your journal" absent, check the stored Trades are the setup's; the stored-Trades check now runs before the Review is opened, nothing else differs). New: `openStandardReviewOf(profile, copySetup, fixtures)` (the copy, with any fixture it lacks, here CORV, added on top through the screens with buildOn; the Trades in the order asked for), `openStandardDetail(profile, copySetup, fixture)` (the copy opened on that Trade's Detail), `copyStandardTrade(copySetup, fixture)` (copy only, nothing launched, for tests that launch their own touch or offline context).
- e2e/d9ar/responsive-a11y.spec.ts: 17 of 18 tests start from STANDARD_REVIEW; only how they start changed (plus one comment above the four-Trade case).

Which tests start from which setup (all STANDARD_REVIEW, the three-Trade Review BREN, AXIO, DALE held):
- openStandardDetail (BREN): Detail overlay at every size; Detail 320 by 667 screen; P&L chart 800 wide; Tab inside the overlay; overlay Close 44 px; staged update's notice.
- openStandardReviewOf [BREN]: Review card's overlay at every size; Review card 320 by 667 screen; page layout after Close; phone's Replay buttons 44 px.
- openStandardReviewOf with CORV added on top: the four-Trade group (R-BREN-U, R-AXIO-D, R-CORV-D, R-DALE-D).
- copy only (copyStandardTrade, then the test's own touch launch): tap on a session and a heading (BREN); Review card Replay tap at 320 (BREN); Price History link at 375 and 320 (BREN); DALE slider value at 320 (DALE held).
- copy only, then server stopped and offline launch: overlay offline after a cold restart (BREN).

Kept its own build: R-DALE-U (the other case of the group test): its Marks differ from the DALE held that the standard setup records, so it cannot share the profile; unchanged (buildReview).

Break check (e2e/d9ar/responsive-a11y.spec.ts): copy switched off (the cp call in copySetup replaced by a no-op): 17 failed (toBeVisible on the first screen), the R-DALE-U test passed (own build); switched back on: 18 passed (36.2 s). The switch was an edit, restored by an edit (git diff e2e/d1/support.ts shows no trace). e2e/d9ar/review.spec.ts, which shares the changed helper: 5 passed (11.8 s).

Assumptions: the staged-update test, which saved nothing in the proof of concept, is still converted (it passes on the copy; it is in the plan's 17). The service worker and release cache the copy carries are those of dist-faults, the release the tests serve (ST.1-B1).

## ST.3 Group 1, the d9 files, on the shared Review

What changed (test code only): the six e2e/d9 specs (estimates-a11y, estimates, meter-detail, replay, review, session-cards). Each converted test asks for `copySetup` and starts with `openStandardDetail(profile, copySetup, BREN)` (ST.2's helper, e2e/d9ar/support.ts) instead of `build(profile, BREN, closeOf('2026-11-16'), 10)`; bodies unchanged. No support file changed. The three specs that import from ./support.ts (meter-detail, replay, review, session-cards) gain one import of openStandardDetail from ../d9ar/support.ts, through the support chain, not from another spec. estimates.spec.ts's `openBren` takes `copySetup` (typed from openStandardDetail's parameter) and uses the same start.

Which tests start from which setup: 15 tests start from STANDARD_REVIEW (BREN's Trade Detail at Mon 11-16 on the three-Trade copy): estimates-a11y (2), estimates (3: chips, W48 line, About page), meter-detail (2), replay (5), review (2), session-cards (1).

Kept its own build: estimates.spec.ts line 102 (R-CORV-D, built to Wed 11-11 through session 7): a different Trade at another clock; CORV is not in the standard setup.

Watch points: d9/review lines 11 and 39 keep their body (page.goto('/'), openReview, reachCard(page, trade) and openCardReplay by Trade), so with three cards in the Review they still reach BREN's card by Trade; both pass unchanged. meter-detail's Tue 11-17 test uses setClock on the copy's context and passes.

Break check (the six files, one run each): copy switched off (the cp call in e2e/d1/support.ts replaced by `execFileSync('true')`): 15 failed (toBeVisible on the first screen), 1 passed (the CORV test, own build); switched on: 16 passed (22.3 s). Switch made and restored by edits; git status shows e2e/d1/support.ts unchanged.

Assumptions: none beyond the plan. First test of the file set (estimates-a11y at 375 px) pays the one build of the setup (6.7 s).
