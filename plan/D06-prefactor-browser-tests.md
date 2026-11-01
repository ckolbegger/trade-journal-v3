# D6 prefactor: a leaner browser suite, task breakdown

Status: **agreed by the user, 2026-11-01 (P55–P62, A177–A180).** On 2026-11-01 the user approved the six recommendations of the browser-suite review ([the review](https://claude.ai/artifact/UXeVoHqfZ7khWTG8CtgJJ9)). While this breakdown was being drafted, the user then settled the choices those recommendations left open:
- T2.55-B5 stays a browser test (P59).
- The prefactor ends without a browser critic or a release tag (P61).
- `src/persistence/` changes run the full suite (P55).
- Recommendation 6, the cumulative guarantee specs, is dropped (P60), after a closer look showed a small saving and a shared-state hazard.

Plan revision 30 (decision 71) adds this breakdown and its amendment notes (section 6) to the frozen plan.

The prefactor runs **after D5R2 and before D6's first task**. It changes browser tests, test tooling and process documents only. No file under `src/` changes, so no stored data, schema, facade operation or visible behavior changes, and D6's previous release stays `claude-opus-5.5-d5r2`.

**Why.** The browser suite has 179 tests and takes 7.4 min, and it runs in full after every task: 216 runs so far, 20 of them in D5R2 alone, about 2.4 hours. Only 31 of the tests cover feature behavior. Of the 12 runs that failed, one caught a real product regression; the others were tests broken by intended changes (7) and flaky tests (4), and a run at the end of the deliverable would have found all of them. The suite grows by about 20 tests per deliverable, which points to about 600 tests and 25 minutes per run by D28. Tech debt item 6 (the suite outgrowing the Bash tool's 10-minute limit) has the same cause.

**Goal.** After each D6 task, the browser stage runs in about 0.5 to 1.5 min instead of 7.4. The full suite still runs whenever a task can affect earlier deliverables' screens or the browser harness, and before every critic gate. Expected saving in D6: about 2 hours of runs.

---

## 1. Decisions and assumptions

### 1.1 What changes and what stays

| Today | After the prefactor |
|---|---|
| `full-suite.sh` runs all 179 browser tests after every task. | Two browser tiers (P55). After a task, `full-suite.sh` picks the **task tier** or the **full tier** from the files the task changed. The task tier runs the tests tagged `@every-task` and the current deliverable's own `e2e/` folder. |
| B2.3, B2.5 and B4.7 run every time, although both ends of each upgrade are frozen tag builds. | Tagged `@release-history`, left out of `test:e2e`, and run by `npm run test:e2e:release-history` and by RC (P56). |
| `ui-alignment.spec.ts` has 70 tests, 41 of them copies of 17 bodies looped over widths or inputs. | One test per body, looping inside (P57): 45 tests with the same assertions, apart from the one removal P57 lists. |
| B1.5 runs 6 fault sets; T2.55-B3 repeats a unit test. | B1.5 runs 2 sets; T2.55-B3 is removed (P59). |

**Stays unchanged:**
- **Product code:** `git diff claude-opus-5.5-d5r2 -- src` is empty at the end.
- **Every other browser test:** its file, title, steps and expectations. The changes are only P56's tags, P57's loop collapse and one removal, and P59's two trims.
- **The gate rule:** cumulative unit and integration suites after every task, and the full browser suite before every critic (planning protocol, independent browser-critic gate).
- **Acceptance:** no row changes status. Every case the matrix cites still exists, and B1.5 keeps a two-fault case for AC-DEL-004's simultaneous failures.

### 1.2 Decisions

Numbering continues from D5R2's P42–P54.

| # | Question | Decision | Alternatives and tradeoff |
|---|---|---|---|
| P55 | **Which browser tests run after a task?** (recommendation 1) | **Two tiers.** The **task tier** has two parts: (a) the tests tagged `@every-task`, which are B1.1 (both cases), B1.3, B1.4 and B1.6, five tests of about 10 s; (b) the current deliverable's own folder, derived from the evidence folder (`evidence/D06` gives `e2e/d6`), when it exists. The **full tier** is `npm run test:e2e`. `full-suite.sh` picks the full tier when the task's commits (`git diff --name-only <base> HEAD`) touch `src/ui/`, `src/app/`, `src/sw/`, `src/delivery/`, `src/persistence/`, `src/main.tsx`, any `.css` file, `index.html`, `e2e/`, `playwright.config.ts`, `vite.config.ts`, `package.json`, `package-lock.json`, `tools/release*.ts` or `tools/build-releases.ts`, and the task tier otherwise. It prints which tier it chose and why. The full tier also runs before every critic, in the deliverable's browser-suite task (T6.27 in D6), and whenever the main session asks for it. | (a) Keep the full suite after every task: 7.4 min a task, and growing. (b) Let the main session choose the tier by judgment: easy to get wrong after a context compaction; the path rule is checkable. (c) Leave `src/persistence/` in the task tier, or give it a third tier of about 20 storage tests: **rejected by the user, 2026-11-01.** The browser suite is the only test of real IndexedDB; the Node suites use `fake-indexeddb`, a disclosed substitute. Schema upgrades, the version-change handshake across tabs (B2.5), transaction aborts (D5R's T5R.14-B1) and kill-after-commit are proved only in a browser. D6's T6.5 schema bump is also known to fail B5.6 until T6.21 rebuilds the previous releases, as D4's T4.3 and D5's T5.1 did, and a full run at T6.5 shows the failure where its cause is clear. The cost is about 3–5 full runs in D6. |
| P56 | **What happens to the upgrade tests between two frozen tags?** (recommendation 2) | **Tag them `@release-history`.** `test:e2e` leaves them out with `--grep-invert @release-history`. A new script, `npm run test:e2e:release-history`, runs only them, and RC runs them in all three engines, as D2 section 6.2 already says for B2.3 and B2.5. Tagged now: B2.3 and B2.5 (D1 tag to D2 tag) and B4.7 (D2 tag to D4 tag). **Rule from now on:** when a deliverable's previous-release harness task points the previous release at a tag, the update test whose two ends are now both tags gets the tag in the same task. In D6 that is T6.21 and B5.6 (D4 tag to the `d5r2` tag). | Delete them: RC and the acceptance matrix cite them, and they are the only evidence of those upgrades. |
| P57 | **How are the `ui-alignment.spec.ts` copies collapsed?** (recommendation 3) | **Mechanically.** Each of the 17 bodies that a `for` loop repeats as separate tests (over widths, T2.37-B1's stages, or T2.55-B5's blank field) becomes one test whose body loops. Every `expect` keeps its matcher, value and message, including the `${width}` in the message. A collapsed test's title drops its trailing "at <width>" and lists the widths instead (for example "…at 320, 390 and 1280"), as T2.62's Detail case already does. **One assertion is removed as a duplicate:** the Underlying header height check at 320 and 390 in T2.62's first body, because "should keep the UNDERLYING header inside its own cell on one line" makes the same measurement on the same tables, with the same 1.6 × line-height bound, at both widths. It stays at 1280. **Checked, and kept:** T2.40's badge-in-viewport case and T2.62's badge-in-scroll-region case use different fixtures (two badges against one) and different bounds, so neither covers the other. The file then runs as part of the full tier only, because it lives in `e2e/d2`. | (a) Leave the copies: about 36 s of repeated launches in every full run. (b) Merge every overlapping check: each merge then needs its own argument, for little time saved. |
| P58 | **`card-helpers.spec.ts`** (recommendation 4) | **No change to the file.** It lives in `e2e/d4`, so it is in the full tier only. Any task that changes `e2e/` (its helpers included) gets the full tier under P55. | Move it to its own folder: no gain, since P55 already covers it. |
| P59 | **The small trims** (recommendation 5) | **B1.5 keeps two fault sets:** `diagnostic` alone and `control,inventory`. The single set proves the Unsupported screen; the double set keeps AC-DEL-004's "two failing together" in the browser (D1 section 9 cites "the two-fault cases in B1.5 and B1.6"). The Node matrix in `tests/integration/d1/readiness.test.ts:60` keeps all six. **T2.55-B3 is removed;** `src/ui/screens/TradeDetail.test.tsx:123` asserts the same label and value. **T2.55-B5 stays unchanged** (agreed with the user, 2026-11-01): its unit test mocks the rejection, so B5 is the only test of the real rejection landing on the field. | Keep `capacity` instead of `diagnostic`: no difference in the faults build. Convert B5 to jsdom: a new test seam for one case. |
| P60 | **Cumulative guarantee specs** (recommendation 6) | **Dropped by the user, 2026-11-01.** Each deliverable keeps its own kill-after-commit, offline, Recovery Only, mid-session failure and no-save files, as today, and D6's B6.7–B6.11 stay in `e2e/d6` as drafted. A closer look found three problems. **(1) The saving is small:** D1 to D5R hold 25 such tests, about 65 s of the full run. One test per guarantee saves only their repeated setup, about 20–30 s, and nothing in the task tier, which never runs those folders. **(2) Shared state:** one test per guarantee means one browser profile. Several existing tests assert on whole screens, so their expected values change once other deliverables' data shares the profile. B4.9, for example, completes the whole Review offline, and that Review would also hold D5's deferred reflection and D5R's cards. Folding them in is a rewrite, not a mechanical move. **(3) Growth:** guarantee tests are about 5 of the roughly 20 tests each deliverable adds, so the change slows growth by 5–10 s per deliverable rather than stopping it. The two tiers (P55) already take this time off the run after each task. | (a) D6 starts the shared specs and later deliverables extend them: each step must assert only on its own Trade; a failing step hides the steps after it; the test's timeout grows; it saves about 5–10 s per deliverable. (b) Fold D1–D5R in as well: a rewrite of about 25 tests and the acceptance citations, for 20–30 s per full run. |
| P61 | **Gate** | **No browser critic and no release tag** (agreed with the user, 2026-11-01). No product code changes, so there is nothing new for a critic to judge in the browser (the protocol's critic judges a deliverable's browser flows). The gate is section 5: the full tier, the release-history tests and the task tier all pass, and their wall times are recorded. | A fresh critic on one or two earlier flows: about 25 min and 200,000 tokens to confirm that tests-only changes changed no product behavior, which `git diff -- src` already shows. |
| P62 | **IDs and evidence** | Tasks `T6P.1` to `T6P.6`; `tdd.sh` maps them to `evidence/D06P/`, which holds `tdd-log.md` (with its note that rows are single-case runs), `structural.md` and `suite-runs/`. | Put them under `evidence/D06`: D6's evidence would then open with work that isn't D6's. |

### 1.3 Working assumptions

| # | Assumption |
|---|---|
| A177 | Playwright 1.63 accepts `test(title, { tag: '@every-task' }, body)` and `test.describe(title, { tag }, body)` on the project's extended `test` (`e2e/d1/support.ts`, `base.extend`), and `--grep` / `--grep-invert` match tags. T6P.1 verifies this with `--list` before tagging anything. |
| A178 | A task-tier run needs `build:faults` and `build:releases` like the full tier. Both take seconds when the tagged releases are reused (as in every D5R2 run). |
| A179 | `e2e/smoke/` (the RC engine-capability probe) stays outside both tiers, as it is outside `test:e2e` today. The tag is named `@every-task`, not `@smoke`, to avoid confusing the two. |
| A180 | The base commit for P55's path rule is the commit the task started from, which the main session records in the handoff's progress section before each brief. |

---

## 2. Task graph

| Task | Title | Kind | Depends on | Who |
|---|---|---|---|---|
| T6P.1 | Tags and the routine and release-history scripts | structural | none | `tdd-task` |
| T6P.2 | Two tiers in `full-suite.sh` | structural | T6P.1 | `tdd-task` |
| T6P.3 | B1.5 trim and T2.55-B3 removal | structural | T6P.1 | `tdd-task` |
| T6P.4 | Collapse the `ui-alignment.spec.ts` copies | structural | T6P.3 | `tdd-task` |
| T6P.5 | Process documents and the D6 amendments | documents | T6P.2 | main session |
| T6P.6 | Gate runs | verification | T6P.1–T6P.5 | `suite-runner` |

The tasks run in this order, one at a time. Each code task gets an ocr review as `implementing.md` describes, and test-only commits use the test-only ocr procedure from the D5R2 handoff. Every task changes `e2e/` or the suite tooling, so its cumulative run is the full tier.

---

## 3. Structural tasks

### T6P.1 Tags and the routine and release-history scripts

- **Tag `@every-task`:** the `describe` "B1.1 identity and Writable tab" (`e2e/d1/identity.spec.ts`, both cases), "B1.3 kill after commit" (`e2e/d1/plan.spec.ts:37`), "B1.4 offline cold restart" (`e2e/d1/offline.spec.ts:4`), and "B1.6 Recovery Only matrix" (`e2e/d1/recovery-only.spec.ts:4`).
- **Tag `@release-history`:** B2.3 (`e2e/d2/migration.spec.ts:47`), B2.5 (`:122`), B4.7 (`e2e/d4/update.spec.ts:6`).
- **`package.json`:**
  - `test:e2e` keeps its builds and folder list and adds `--grep-invert @release-history`.
  - A new `test:e2e:release-history` runs the same builds, then `playwright test --grep @release-history` over the same folders.
- **Verification (exact):**
  - `npx playwright test e2e/d1 e2e/d2 e2e/d4 e2e/d5 e2e/d5r --list --grep @every-task` lists 5 tests.
  - `… --list --grep @release-history` lists 3.
  - `… --list --grep-invert @release-history` lists 176.
  - `npm run test:e2e` passes 176.
  - `npm run test:e2e:release-history` passes 3.
  - No test title changes: diff the `--list` output with and without the grep.

### T6P.2 Two tiers in `full-suite.sh`

- **New stages:**
  - `browser-task`: the builds; `playwright test --grep @every-task` over the `test:e2e` folders; then, in a second call, `playwright test --grep-invert "@every-task|@release-history"` over the current deliverable's folder, if it exists. (The grep keeps a test from running twice.) Both calls write to the same `<label>-browser.txt`, and the summary adds up both counts. When the folder doesn't exist, only the first call runs.
  - `browser-auto <base>`: applies P55's path rule to `git diff --name-only <base> HEAD`, prints the tier and the first matching path, and runs `browser-task` or `browser`.
  - The existing `browser` stage stays the full tier. With no stage, the script still runs everything, and it runs the full tier.
- **The current deliverable's folder:** taken from the evidence folder's name, lower case, with the leading zero of the number dropped. `evidence/D06` gives `e2e/d6`, `evidence/D05R` gives `e2e/d5r`, and `evidence/D05R2` gives `e2e/d5r2`, which doesn't exist, so it is skipped.
- **Verification (exact):**
  - `.claude/scripts/full-suite.sh evidence/D06P t6p-2-check browser-task` runs 5 tests (there is no `e2e/d6p`).
  - `.claude/scripts/full-suite.sh evidence/D05R t6p-2-check-d5r browser-task` runs 20 (5 plus `e2e/d5r`'s 15).
  - `browser-auto` with a base whose diff has only `plan/` paths chooses the task tier; with T6P.1's commit as the only change it chooses the full tier, naming `e2e/…`.
  - All three outputs go to `evidence/D06P/suite-runs/`.

### T6P.3 B1.5 trim and T2.55-B3 removal

- **B1.5** (`e2e/d1/readiness.spec.ts:5`): its fault-set list becomes `['diagnostic']` and `['control', 'inventory']`, and the case body is unchanged.
- **T2.55-B3** (`e2e/d2/ui-alignment.spec.ts:1363`): the `describe` is removed. Any helper or import that only it used is removed too.
- **Verification (exact):**
  - `npx playwright test e2e/d1/readiness.spec.ts --list` lists 3.
  - `npx vitest run src/ui/screens/TradeDetail.test.tsx -t "Last activity"` passes 1.
  - `npm run test:e2e` passes 171.

### T6P.4 Collapse the `ui-alignment.spec.ts` copies

- **Collapse:** P57's mechanical rule, applied to the 17 bodies.
  - T2.60 (×3), T2.60-B4 (×3), T2.37-B1 (×2 stages), T2.38's two narrow bodies (×2 each), T2.40's two bodies (×3, ×2), T2.55-B4 (×3), T2.55-B5 (×2), T2.55-B6 (×3), T2.62's four looped bodies (×3, ×2, ×2, ×2), and T2.67's three bodies (×3, ×2, ×2).
  - Inside a collapsed body, each width gets its own fresh profile only if the original copies started from a fresh profile and the body depends on it. Otherwise one setup serves all widths, with `setViewportSize` and `expectLayout` between them. The subagent records which bodies kept a setup per width, and why.
- **Remove one assertion:** the Underlying header height assertion of T2.62's first body is kept at 1280 only (P57).
- **Verification (exact):**
  - `npx playwright test e2e/d2/ui-alignment.spec.ts --list` lists 45.
  - `grep -c 'expect(' e2e/d2/ui-alignment.spec.ts` is unchanged from T6P.3's commit, except for the one removed assertion, if it was its own `expect(` line.
  - The file passes three runs in a row: `npx playwright test e2e/d2/ui-alignment.spec.ts --repeat-each=1`, run three times. Record each duration.
  - `npm run test:e2e` passes 147.
- **Mutation check:** for two collapsed bodies (T2.40 and T2.62's "UNDERLYING header" body), break the measured CSS rule once and confirm the test fails at each width it loops over (the message names the width). Then restore it.

### T6P.5 Process documents and the D6 amendments (main session)

- **`.claude/docs/implementing.md`, step 3:** the cumulative run after a task uses `browser-auto <base>`. Before every critic, and in the deliverable's browser-suite task, the runner uses the full tier.
- **`.claude/agents/suite-runner.md`:**
  - It accepts `browser-task`, `browser-auto <base>` and `browser` as the browser stage.
  - Its report's Browser row names the tier and, for `browser-auto`, the reason it printed.
- **`.claude/docs/drafting-breakdowns.md`:** add P56's rule. The task that points a deliverable's previous release at a tag also tags `@release-history` on any update case whose two ends are now both tags.
- **The user's memory, "record full suite runs":** a task ends with the cumulative run in the tier `browser-auto` picks, and every critic gate is preceded by a full-tier run. **Why:** the user's decision on 2026-11-01 after the browser-suite review.
- **The plan amendments in section 6,** with decision 71 and the revision 30 tag, committed together.

**Verification:** each document cites the decisions it applies (P55, P56) by number, and section 6's list is applied in full: `git diff --stat` names every file it lists.

### T6P.6 Gate runs

Three runs by `suite-runner`, recorded in `evidence/D06P/structural.md`:

| Run | Expected result |
|---|---|
| Complete cumulative, full tier (`full-suite.sh evidence/D06P t6p-6-full`) | unit and integration counts unchanged from T5R2.16 (1051, 117); browser 147 passed; 12 of 12 checks. Browser stage time recorded; about 6.5 min expected. |
| Release history (`npm run test:e2e:release-history`) | 3 passed |
| Task tier (`full-suite.sh evidence/D06P t6p-6-task browser-task`) | 5 passed. Wall time recorded; under 1 min expected. |

Also, from the main session: `git diff claude-opus-5.5-d5r2 -- src` is empty.

---

## 4. Effect on D6

- **The cumulative run after a D6 task:** when the task touches none of P55's paths (domain, modules, coordinators, Node tests), the browser stage runs the task tier. That is the 5 `@every-task` tests, plus `e2e/d6` as D6 writes it. It takes about 0.5 min early in D6 and about 1.5 min by its end. D6's schema, migration, composition, UI and harness tasks (T6.5 and T6.15–T6.21, their bug tasks, and T6.27) get the full tier, about 6.5–7.5 min.
- **Estimate:** about 30 runs in D6, about 12 of them full. That is about 1.7 h of browser runs, against about 3.8 h with no prefactor. The extra full runs for persistence tasks under P55 make the saving smaller than the review's 2.5 h estimate.

---

## 5. Gate

The prefactor is complete when all of the following hold. Then the handoff's progress section is updated and everything is committed locally (never pushed).
- T6P.1 to T6P.5 are committed, with each code commit's ocr findings resolved.
- T6P.6's three runs pass.
- `git diff claude-opus-5.5-d5r2 -- src` is empty.

---

## 6. Amendments to other plan documents (decision 71, revision 30)

Each amendment is a dated note at the place it changes, in the style of decision 70's notes.

| Document | Where | Amendment |
|---|---|---|
| `implementation-plan.md` | Decisions table | Decision 71: this breakdown, P55–P62, and the two tiers. |
| `implementation-plan.md` | Plan record, "Immutable revision" | Revision 30, tag `claude-opus-5.5-plan-r30`. |
| `implementation-plan.md` | Deliverable summary | A row for the D6 prefactor before D6: "0 (tests and tooling)". |
| `implementation-plan.md` | Tech debt, item 6 | The browser stage drops to about 6.5 min in the full tier and about 1 min in the task tier. The trigger (above 8 min) moves further off, and the alternatives stay recorded for when it is reached. |
| `D01-start-a-workspace-and-confirm-a-long-stock-plan.md` | Section 6.2, B1.5 | Two fault sets in the browser (P59). The Node matrix keeps all six. |
| `D02-open-a-long-stock-position.md` | Section 6.2, B2.3 and B2.5 | `@release-history`: out of `test:e2e`, run by `test:e2e:release-history` and RC (P56). |
| `D02-ui-alignment.md` | Section 3, T2.55-B3 and the looped cases | T2.55-B3 removed in favor of the unit case. Looped copies are collapsed into one test per body (P57), with one assertion kept at 1280 only. |
| `D04-daily-review.md` | Section 6.2, B4.7 | `@release-history` (P56). |
| `D06-close-a-long-stock-position.md` | T6.21 and its structural row | B5.6 gets `@release-history` in the same task (P56). |
| `D06-close-a-long-stock-position.md` | T6.27's structural row | "Every case in sections 6.2 of D1, D2, D4, D5, and D6 passes, apart from the `@release-history` cases, which `npm run test:e2e:release-history` runs (P56)." |
| `D06-close-a-long-stock-position.md` | Section 10 | Each task's cumulative run records which tier `browser-auto` chose, and why (P55). |
| `D06-handoff.md` | Opening and working rules | The prefactor runs first. The cumulative run after a task is `browser-auto <base>`, and the progress section records each task's base commit (A180). |

---

## 7. Answers recorded from the user, 2026-11-01

1. **P59:** T2.55-B5 stays a browser test.
2. **P60:** recommendation 6 is dropped. Guarantee tests stay in per-deliverable files.
3. **P61:** no browser critic and no release tag.
4. **P55:** `src/persistence/` changes run the full suite, because the browser suite is the only test of real IndexedDB.
