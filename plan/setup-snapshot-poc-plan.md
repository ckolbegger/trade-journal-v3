# Setup snapshot proof of concept: plan

Status: plan only, waiting for the user's approval. Nothing here has been built or run.
Written 2026-11-23 against claude-opus-5.5 at 3184e11e (TD.7 done; TD.8, TD.9, TD.10 and TD.11 of the dedup still to come).

## 0. In short

Many browser tests build the same Trades through the screens before they check anything. The idea: build that starting point once, save the browser's profile folder (where the journal's IndexedDB lives), and give each test a fresh copy of it.

The proof of concept tries this on one file, e2e/d9ar/review.spec.ts. Its five tests each build the same three-Trade Review. It runs in its own worktree on port 4175, so it stays out of the dedup work's way, and it times the old file against the new one only while no dedup browser run is going.

Before the details, a correction to the research. The real gain is seconds per test, not minutes (section 2.1). The likely result: this file gets roughly twice as fast, and the whole 23-minute browser tier gains only a few percent unless the idea is widened (section 6).

## 1. How the tests launch today

In plain words: every test gets its own empty browser profile folder and its own little web server, both fixed to port 5175. A test that "relaunches" just closes the browser and opens it again on the same folder. Nothing is shared between tests, so each one starts from an empty journal and builds what it needs by clicking through the app.

Technical detail:

- **Runner.** playwright.config.ts: testDir e2e, workers: 1, list reporter, one Chromium project. So all tests run one after another, and the browser tier's time is simply the sum of the test durations. The t95.15 run shows this: 402 test durations add up to 1364 s, against about 1379 s of wall time for the four stages.
- **npm scripts.** test:e2e:1, :2, :3 and :4 each run build:faults, then build:releases, then playwright test on a set of folders. :4 is "e2e/d9", and that also matches d9ar, d95 and d9r2. .claude/scripts/full-suite.sh runs these four stages inside .claude/scripts/with-browser-lock.sh.
- **Server.** In e2e/d1/support.ts the test-scoped server fixture calls startReleaseServer({ root: process.cwd(), release: 'dist-faults' }) from tools/release-server.ts. It listens on HARNESS_PORT = 5175 (tools/release-server.ts line 12) and closes when the test ends. The d4 support (which d9 and d9ar build on) adds an auto fixture, d4Release, that switches the server to dist-releases/current, the production build of the checked-out code.
- **Profile.** The test-scoped profile fixture uses info.outputPath('profile'), a new folder under test-results/ for each test, so every test starts with an empty profile. profile.launch() calls chromium.launchPersistentContext(dir, { channel: 'chromium', baseURL: BASE_URL, timezoneId: America/New_York, viewport 1280x900, ... }), with BASE_URL = 'http://localhost:5175' (e2e/d1/support.ts line 13). Closing the context is a full browser restart. The fixture closes every context the test opened.
- **Clock.** launchAt(profile, instant) (e2e/d4/support.ts) launches the browser and then calls pinClock: context.clock.setFixedTime(instant), plus an init script that points Chromium's native Temporal.Now.instant at the pinned Date. The clock is set again on every launch. Nothing about it is stored in the profile.
- **Kill tests.** spawnedBrowser(dir, port) (e2e/d2/support.ts line 216) starts Chromium by hand with Chrome's debugging port 9341 or 9342 (--remote-debugging-port), so the test can kill it. It is used by d5/kill-offline, d5r/durability, d6/kill, d7/kill and d8/restore.
- **Lock.** with-browser-lock.sh holds a kernel flock on <getconf DARWIN_USER_TEMP_DIR>/tj-browser-lock-5175.flock while its command runs. That lock is what keeps port 5175, Chrome's debugging ports 9341 and 9342, and the shared tj-release-* build cache in the temp folder to one user at a time. TJ_BROWSER_LOCK_DIR overrides the lock file's path; the script calls this a test-only switch.
- **Prior art in the repo.** npm run bench:setup (tools/bench-setup.ts, tools/bench/profile.ts) already caches a finished Chromium profile in .cache/bench/profile. It serves on its own port, 4175, because IndexedDB belongs to the origin. It writes a version stamp (generator version and SCHEMA_VERSION) last, so an interrupted build never looks reusable. The design below borrows that pattern.

## 2. The pick

### 2.1 What the timings say (and a correction to the research)

The research report (research/browser-test-duplicates.md) guessed that buildReview takes about 5 minutes and buildOc3 about 3, and that sharing builds could save "about 50 more minutes". The timing logs say otherwise. Every test that uses buildReview takes 5 to 6 s in total, and every buildOc3 test takes 7 to 9 s. The whole tier is 22.7 minutes for 402 tests, an average of 3.4 s per test. So the research's minute figures are about 30 to 60 times too high, and its "50 minutes" cannot fit inside a 23-minute tier.

How the setup cost is estimated (no per-step timings exist on disk yet):

- **Floor.** The cheapest tests that still launch, onboard and confirm a Plan (d8p/planned, d8r/states "Planned Trade") take 1.2 to 1.7 s. That is roughly the cost of the server, the browser launch and onboarding.
- **Build cost.** For each builder, the test with the lightest checks is nearly all build. For buildReview that is the summary test in d9ar/review (5.0 s), and for buildOc3 it is d8p/payoff-fit (7.6 s).
- **Saving per test.** The build cost minus what a snapshot test still pays: the server, one browser launch, copying the profile, and opening the page (estimated 1 to 1.5 s).

Durations come from evidence/D95/suite-runs/t95.15-grid-keys-browser-{1,2,3,4}.txt and t95.14-save-marks-browser-*.txt. Both runs agree to within about 0.4 s per test. Both runs predate the dedup, so where the dedup has since changed a file, current titles and line numbers are given.

### 2.2 Candidates

| File (current) | Tests sharing one identical build | Test time now (t95.15) | Build cost (est.) | Setup share (est.) | Saving if built once per run (est.) | Dedup still to touch it? |
|---|---|---|---|---|---|---|
| e2e/d9ar/review.spec.ts | 5 (all call buildReview(profile), the default three Trades) | about 25 s for the five (5.9, 5.5, 4.8, 4.9, 5.0; one more test, since dropped by TD.7) | about 4.5 s | 75 to 85% | about 12 to 15 s, roughly half the file | No (TD.7 is done) |
| e2e/d9ar/responsive-a11y.spec.ts | about 8 build(BREN, Mon 11-16) and about 7 buildReview([BREN]), plus touch launches, offline and a staged update | mostly 2.5 to 3.6 s, three at 5.8 to 7.8 s (the size sweeps); 19 tests, 67 s | about 1.2 to 1.5 s (one Trade) | 40 to 50% | about 12 to 18 s, but over 15 tests with mixed launch types | No (TD.3 is done) |
| e2e/d8p/history.spec.ts | 2 (buildOc3 with thursdayHold and noTuesdayReview; TD.2 dropped the third) | 7.7 and 7.4 s | about 6 to 6.5 s, over 7 launches at 7 clocks | 80% | about 5 s | No (TD.2 is done) |
| e2e/d9/meter-a11y.spec.ts | 3 (four Trades built by buildOn) | 14.6, 6.2, 6.2 s | about 5 s | 35 to 80% | about 8 s | No |
| e2e/d2/ui-alignment.spec.ts | many, but small seeds (seedTrades) | 43 tests, 106 s, 2.5 s average | about 1 s | about 40% | unclear | Yes, TD.10, so excluded |

**Chosen: e2e/d9ar/review.spec.ts.** All five tests begin with the very same call, buildReview(profile), which plans, enters and Marks three Trades (BREN, AXIO, DALE-hold) across 11 sessions in one launch and ends on the Review. They differ only in what they do afterwards. This file has the largest share of setup, the most tests on one identical build, a single launch type (no touch, no offline, no server switch), and the dedup has finished with it. It is the cleanest measurement of the idea.

**Runner-up: e2e/d8p/history.spec.ts.** It has the heaviest build per test (in this variant buildOc3 launches 7 times at 7 different clocks), and buildOc3 is called at about 15 places in about 12 files (counting d8/backup, d8/restore and the buildOc3Plus and buildOc3BeforeMarks wrappers), which makes it the best family for widening later. But this file now has only 2 tests, so it can save at most one build. Its main use would be to show that a build made of many relaunches survives the copy.

## 3. Design for e2e/d9ar/review.spec.ts

In plain words: when the file starts, build the three-Trade Review once through the screens, close the browser, and keep the finished profile folder in a side directory. Each test then gets its own copy of that folder, opens the browser at the same pinned time, opens the Review, and carries on exactly as before.

### 3.1 When and where the snapshot is built

- **Where it lives.** A file-local test.extend in a new spec, e2e/d9ar/review-snapshot.spec.ts, holds a worker-scoped fixture with auto: true, named reviewSnapshot. The old file stays as it is, so it serves as the control. No support file changes, so no other spec is affected.
- **Why auto worker scope.** A worker fixture cannot use the test-scoped server or profile. The port is fixed, so the build needs its own server, and that server must be closed before the first test's server starts. An auto worker fixture should be set up when the worker starts, before any test fixture (including d4Release, which starts the test's server), and that gives exactly this order. Give it its own timeout (for example { scope: 'worker', auto: true, timeout: 120_000 }). This order is not yet confirmed in this repo: confirm it in step 6 (the first test would fail to bind the port if it were wrong). Fallback if it is wrong: build in a test.beforeAll in the new spec, which runs before the first test's fixtures.
- **What it does.**
  1. Make a folder: workerInfo.project.outputDir + '/review-snapshot-' + workerInfo.workerIndex, emptied first.
  2. startReleaseServer({ root: process.cwd(), release: 'dist-releases/current' }). This is the same build d4Release serves, on the same port.
  3. buildReview(profileAt(dir)), unchanged.
  4. Close the context and then the server.
  5. Write trades.json beside the profile with the TradeRefs (symbol, tradeId, label). The Trade ids are made by the app during the build, so the tests cannot know them any other way.
  6. Record the build's duration (performance.now() around the build; also log it) as a direct measure of setup cost.
- **Re-running.** With workers: 1 this runs once per run of the file. Playwright starts a new worker after a failed test, and the new worker rebuilds. That costs one more build per failure and is otherwise harmless.

### 3.2 What is saved, and how each test gets its copy

- **Saved:** the whole profile folder, copied as it is. An IndexedDB export and import was considered and rejected. It would need new code inside the page and would skip the service worker registration and its Cache Storage, which the app's readiness checks expect, so it would test a different starting state.
- **Per-test copy.** Override the test-scoped profile fixture in the new spec. Before it provides the profile, run cp -c -R <snapshot>/. <info.outputPath('profile')> (an APFS clone, which is near-instant). Then delete SingletonLock, SingletonSocket and SingletonCookie if present. Keep the rest of the fixture as it is, including closing every launched context at the end.
- **Opening.** A local helper, openSnapshotReview(profile), returns the same shape as buildReview: { context, page, trades }. It calls launchAt(profile, closeOf(REPLAY_SESSION_DATES[10])), the same pinned time the build used. Then it does firstPage, page.goto('/'), checks the Review heading with LAUNCH, and calls openReview(page). Each test body changes in one line only: buildReview(profile) becomes openSnapshotReview(profile).
- **Sanity checks in the new file.** First, "Start your journal" never appears, so the copy really was used. Second, the Trade ids on the Review match trades.json. Before the timing runs, make one deliberate break (for example, skip the copy so the profile is empty) and confirm the tests fail. This shows the new file really depends on the snapshot.

### 3.3 What stays per test

- **The server.** Each test still gets its own (the test-scoped fixture is unchanged).
- **The pinned clock.** pinClock runs on each launch and nothing about it is stored in the profile. The tests keep the same Review Date because they launch at the same instant the build used.
- **Relaunches and reloads.** Those inside the tests (the reload in the "return focus to Replay" test, goBack and goForward) behave as before.
- **The profile folder.** Each test still writes to its own folder, so tests that save Actions do not affect each other.

### 3.4 One real difference from the old file, and why it is acceptable

In the old file, each test continues in the same browser launch that did the build. In the new one, each test starts a new launch on the copied profile. buildReview already ends with a full page load (page.goto('/') and then openReview), so the page's in-memory state is the same either way. What differs:

- **Session storage.** It is lost on a restart, but the app does not use sessionStorage (rg finds none in src).
- **Back history.** It starts empty instead of holding the build's pages. The Forward and Back test goes back only through entries it created itself, so this is safe, but watch that test.
- **Service worker start.** On a fresh launch the service worker starts up again and the readiness checks run again. That is why the first check uses LAUNCH.

### 3.5 What makes a profile copy unsafe, and how this design avoids it

- **Origin.** IndexedDB, the service worker registration and Cache Storage all belong to http://localhost:<port>. The snapshot must be built and used on the same port. Here both happen in the same run on the same port.
- **Service worker cache and release.** The cache is named tj-release-<release id>. If a snapshot from another build were served a different dist-releases/current, the app would see a new release and show an update notice, so the test would be checking a different state. Building in the same run avoids this.
- **Chromium version.** A profile written by a newer Chromium may not open in an older one. Same run, same binary.
- **Locks and crash state.** Copy only after context.close() has returned, so the LevelDB files are flushed and the browser is gone. Delete the Singleton* files: they are absolute symlinks naming the host and process, and a stale one can make Chromium refuse the profile or treat it as in use. If a later version copies a killed profile, also apply spawnedBrowser's clean-exit fix (remove Default/Sessions and mark exited_cleanly).
- **Absolute paths.** Preferences and Local State can hold the original folder's path. Chromium tolerates a moved user data folder, and the sanity checks above would catch any trouble. Do not copy caches the tests do not need: if the copy proves slow, drop GPUCache, ShaderCache and Crashpad from the snapshot and record the folder's size.

### 3.6 What would invalidate a snapshot (only if it is ever kept between runs)

The proof of concept rebuilds the snapshot on every run, so it is never stale. A later version that keeps a snapshot between runs (like bench:setup) would need a stamp file, written last, holding:

- a hash of dist-releases/current (or its release id);
- SCHEMA_VERSION (src/persistence/schema.ts, now 7);
- a hash of the fixture-building code (e2e/d9ar/support.ts, e2e/d9/support.ts, e2e/d4/support.ts and the support files they import);
- the builder's arguments;
- chromium.version() and the Playwright version;
- the port.

If any of these differ, rebuild.

## 4. Proof-of-concept steps (only after the user approves)

1. **Note the starting point.** Record git rev-parse HEAD of claude-opus-5.5 and confirm git status is clean. Never pull in dedup commits during the timing runs.
2. **Create the worktree by hand.** lane-setup.sh refuses any folder that is not under this worktree's .claude/worktrees/, which is git-ignored through the worktrees/ pattern.
   - git -C /Users/ckolbegger/src/trade-journal-v3/worktrees/claude-opus-5.5 worktree add -b setup-snapshot-poc .claude/worktrees/setup-snapshot-poc claude-opus-5.5
   - Then, in the new worktree, run .claude/scripts/lane-setup.sh without the main lock. It clones node_modules and dist-releases, installs the hooks, and copies .env.local. Run it when the lock probe of section 5 says the main lock is free, since a dedup build:releases rewrites dist-releases/ while it holds the lock. A clone caught halfway would still be harmless: the chosen file serves only dist-releases/current (through d4Release), and step 4 rebuilds that folder from the worktree's own source. The other releases (v1, v2, d1, d2, d4, d5r2) are served only by update and migration tests that the proof of concept does not run. Leave .env.local alone: lane-setup insists it holds DEV_PORT=5175, and that value is only read by vite dev and preview, which the proof of concept never runs.
3. **Move every port in the new worktree** (one commit on setup-snapshot-poc):
   - tools/release-server.ts line 12: HARNESS_PORT 5175 to 4175. This is the port every test server binds.
   - e2e/d1/support.ts line 13: BASE_URL to http://localhost:4175. Also update the comment on line 2.
   - Chrome's debugging ports 9341 to 8343 and 9342 to 8344 in e2e/d5/kill-offline.spec.ts, e2e/d5r/durability.spec.ts, e2e/d6/kill.spec.ts, e2e/d7/kill.spec.ts and e2e/d8/restore.spec.ts (PORT_BEFORE and PORT_AFTER). None of these run in the proof of concept; they are changed so an accidental wider run cannot touch the dedup's ports.
   - Literal origins and ports in files that would bind or compare them: e2e/d6/stale-index.spec.ts and e2e/d6/stale-debt.spec.ts (ORIGIN), e2e/smoke/engine-capabilities.spec.ts (PORT), tools/capacity/measure-basis.ts (port 5175 and its URL).
   - Leave alone (no port is bound): src/sw/test-doubles.ts ORIGIN (a unit-test double), DEV_PORT: '5175' in tools/build-releases.ts (an env value for a build), .env.local, and lane-setup.sh's DEV_PORT=5175 check (lines 7, 64 and 65).
   - Not to be used in the worktree (they hard-wire 5175, 9341 and 9342 or the main lock): .claude/scripts/full-suite.sh (comments on lines 15 and 38; it runs the npm test:e2e scripts), and the suite-runner and tdd-task agents (.claude/agents/suite-runner.md, .claude/agents/tdd-task.md), whose port checks name 5175, 9341 and 9342. The proof of concept runs npx playwright test directly. .claude/docs/critic-brief.md and implementing.md mention 5175 only in prose.
   - with-browser-lock.sh: its default lock name, tj-browser-lock-5175.flock (line 48, comments on lines 3, 4 and 6), stays unchanged on purpose, because the timed runs use it as the quiet signal (section 5). Untimed runs override it as below.
   - **Lock for untimed runs.** Put TJ_BROWSER_LOCK_DIR=<DARWIN_USER_TEMP_DIR>/tj-browser-lock-4175.flock in front of with-browser-lock.sh. This gives the worktree its own lock, which also guards against the benchmark, the only other user of 4175.
   - **Check.** rg -n "5175|9341|9342" e2e tools src .claude in the worktree (name .claude explicitly; a search of . skips hidden folders) shows only the items listed as left alone or not to be used, and comments.
4. **Build only locally.** Do not run the npm test:e2e scripts or build:releases there: build:releases writes the tj-release-* scratch folders in the shared temp folder that the main lock protects. Instead run npm run build:faults (it writes only dist-faults/). Then rebuild the production build from the worktree's own source: TJ_BUILD_LABEL=current npx vite build --outDir dist-releases/current --emptyOutDir. Rebuild after any source change. The proof of concept changes only e2e files.
5. **Write the new file** as described in section 3 (e2e/d9ar/review-snapshot.spec.ts), then commit.
6. **Untimed checks**, under the 4175 lock:
   - npx playwright test e2e/d9ar/review.spec.ts and npx playwright test e2e/d9ar/review-snapshot.spec.ts both pass;
   - the deliberate break fails, and the file passes again once the break is undone;
   - record the snapshot folder's size and the time of one copy.
7. **Timed runs** (section 5).
8. **Record the results** in the worktree in evidence/Setup-Snapshot-PoC/timings.md (per-test and total durations of every run, medians, build time, copy time, folder size, load averages, discarded runs) and commit them on setup-snapshot-poc.

## 5. Timing method: wait for quiet

In plain words: building and checking can happen at any time. A timing run only counts if no dedup browser run was going while it ran. The dedup's browser runs all hold the main lock, so the main lock is what tells us the machine is quiet.

**Recommended: hold the main lock for each short timed pair.** Each timed pair runs inside the main worktree's lock: in the PoC worktree, .claude/scripts/with-browser-lock.sh with no TJ_BROWSER_LOCK_DIR, which takes the same <DARWIN_USER_TEMP_DIR>/tj-browser-lock-5175.flock. One pair is the old file then the new one, about 40 s in all. The wrapper waits while a dedup run holds the lock (that is the wait for quiet). While the pair runs, no dedup browser run can start, so no run is spoiled halfway. The cost is that a dedup run that wants the lock waits at most one pair. Sleep 120 s between pairs so a waiting dedup run can take the lock.

**Alternative: probe and discard.** Before and after each run, test the lock without waiting:

    /usr/bin/perl -MFcntl=:flock -e 'open(my $f, "<", $ARGV[0]) or exit 0; exit(flock($f, LOCK_EX|LOCK_NB) ? 0 : 1)' <lock path>

A busy lock either time means the run is discarded. This never delays the dedup, but it cannot stop a dedup run that starts and ends inside the window. It also takes the lock for an instant, so add a check that no Playwright process of the main worktree is running (pgrep -f "worktrees/claude-opus-5.5/node_modules"). Use this one only if the user does not want the dedup ever to wait.

**Runs:**

- Alternate: old, new, new, old, old, new, and so on (ABBA order cancels slow drift). At least 3 runs of each, 4 preferred.
- Use npx playwright test <file> --reporter=list,json with PLAYWRIGHT_JSON_OUTPUT_NAME=evidence/Setup-Snapshot-PoC/<run>.json, to get per-test durations (results[].duration) and the file total (stats.duration). Also take wall time with date +%s.%N before and after.
- Where Playwright puts the snapshot build's time (the auto worker fixture) is not confirmed: it may land in the first test's duration or in no test. Check it on the first untimed run by comparing the logged build time with the first test's duration. Report the per-test figures with the build separated out, and use file totals (which include the build either way) as the main measure.
- Record sysctl -n vm.loadavg before each run. Report the loads, and report but do not count runs where the 1-minute load is far above the others (unit or integration runs of the dedup hold no lock and can still load the CPU).

## 6. Success measures and risks

**Measures** (medians over the timed runs):

1. Per test: old duration minus new duration, for each of the five tests.
2. For the file: old total, new total, and the ratio. Expect roughly 25 s to 12 to 14 s (about 2x). Below 1.3x would mean the idea is not worth spreading.
3. Measured parts: the build (from the fixture's log), one copy, and what a snapshot test pays before its first check. Together these give saving = (k − 1) × build − k × (copy + launch overhead) for any group of k tests that share one identical build.

**Extrapolating to the browser tier** (about 23 min: browser-1 5.6m, browser-2 5.3m, browser-3 4.5m, browser-4 7.5m). Assumptions: workers: 1, so the tier is the sum of test durations; build cost scales as measured here; the tier's test list stays as it is after the dedup. Three levels:

- **Within a file, one identical build per run** (this design, applied wherever two or more tests in a file start with the same build): d9ar/review, d9ar/responsive-a11y, d8p/history, d8p and d8r responsive-a11y pairs, d9/meter-a11y, and some groups in d9ar/chart and d9ar/readout. Estimated 1 to 2 minutes, about 5 to 8% of the tier.
- **Across files, a snapshot kept between runs** (needs the stamp from section 3.6): each distinct build is paid once per run, or not at all when nothing changed. buildOc3 (about 15 call sites, about 4 variants), buildReview, build(BREN) and the d4 and d5r card fixtures dominate. Estimated 3 to 5 minutes, about 15 to 20%, at the price of stale-snapshot risk.
- **An onboarded-profile snapshot for every test** (skipping first run and onboarding everywhere, except the tests of onboarding itself): unknown. The proof of concept can measure onboarding's share in passing (the floor tests are 1.2 to 1.7 s in total). With about 400 tests, even 0.4 s each is about 2.5 minutes, which may beat the targeted snapshots.

The tests of 4 s or more total about 9.7 minutes (83 tests). That is a hard ceiling on what any build-sharing can save among the heavy tests.

**Risks:**

- **Flake.** Every test now starts with a relaunch on a copied profile, so watch the first-screen waits. Run the new file 10 times untimed (step 6). If the build fails, all five tests fail, which is loud but has a wider blast radius.
- **A stale snapshot hiding a bug.** None in this design: the snapshot is rebuilt through the screens on every run. This becomes a real risk only with the across-files cache, and the stamp must then cover the app build, the schema, the fixture code and Chromium.
- **Setup steps as coverage.** The build still goes through the screens (planning, entry, Marks with the skipped sessions, the slip questions) once per run, so that coverage is kept, though once instead of five times. With an across-files cache it would be lost on cached runs, so any step that is itself the point of a test (onboarding, Save Marks) must keep a test that drives it.
- **Different starting state.** Covered in section 3.4. The sanity checks guard the snapshot path.
- **Port 4175 is the benchmark's port too.** A benchmark run during the proof of concept would collide; the 4175 lock in step 3 guards only the proof of concept's own runs.

## 7. Afterwards

The worktree .claude/worktrees/setup-snapshot-poc and its branch setup-snapshot-poc stay as they are, committed locally and unpushed, for the user to look at. Nothing is merged into claude-opus-5.5. The main worktree's lock is taken only for the timed pairs of section 5 (or only probed, if the user picks the alternative). Port 5175 and Chrome's debugging ports 9341 and 9342 are never used.

## 8. Open questions for the user

1. **Quiet check.** Hold the main lock for each timed pair, about 40 s, so a dedup run may wait up to that long (recommended)? Or probe and discard, so the dedup never waits?
2. **Port 4175.** It is also the benchmark's port (tools/bench/profile.ts). Is it fine to use, as long as no benchmark runs during the proof of concept?
3. **Runs of the new file.** Is 10 untimed runs as the flake check enough, or should it match the timed count?
4. **If the result is good.** Should the next step be the across-files cache with a stamp (bigger gain, stale risk), or the onboarded-profile snapshot (smaller per test, but every test)? This decides what the proof of concept should also measure; it can time onboarding's share in passing at no cost.
