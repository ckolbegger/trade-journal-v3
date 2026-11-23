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
