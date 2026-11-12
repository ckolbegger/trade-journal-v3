# D7S, Option-price Stops and Targets: final report

Completed 2026-11-12 and tagged `claude-opus-5.5-d7s`. The work runs from `claude-opus-5.5-pre-d7s`, with every commit local and none pushed. The plan was frozen at revision 80 for the run order. Revision 81 was made during the work.

## Tasks and commits

The tasks are listed in run order (decision 108).

| Task | What | Commits |
|---|---|---|
| T7S.1 | Persistence: schema 7 and the `v6→v7` transform | `1627e865` |
| T7S.3 | Trade Analysis: `assessPlan` with option-price conditions | `dd1a89e8` |
| T7S.2 | Capacity basis re-measured at schema 7 | `f40e99e5` |
| T7S.4 | Trade Analysis: `evaluate` per condition and the headline | `51d84965` |
| T7S.5 | Trade Analysis: Entry Quality from the headline conditions | `f7590645` |
| T7S.6 | Daily Review: pressure and range position from the headline conditions | `edbc03a5` |
| T7S.7 | Installed Capability Manifest for D7S | `ef641c00`; F1 `7feef7dc` |
| T7S.8 | UI: option Plan form with both kinds | `4f347d43`; B1 `743defbe`; B2 `f3340232`; F1 `bb461313` |
| T7S.9 | UI: Trade Detail shows every condition | `1e5a2a45`; B1 `7a8486b6` |
| T7S.10 | UI: Review card conditions and list badges | `74ac6e82` |
| T7S.11 | Source check: no first-condition reads | `0d85bc9b` |
| T7S.12 | Checkpoint browser critic | B1 `d34f6670` (critic-1 FAIL, critic-2 PASS) |
| T7S.13 | Freeze the schema-v7 fixture | `b3776f7f`; B1 `9b7ecce2`, `930964e7` |
| T7S.15 | Node mock-free integration suite | `be46f856` |
| T7S.16 | Browser integration suite (Chromium) | `52439579` |
| T7S.14 | Benchmark at schema 7 | `a91c5f94`; B1 `a4b84749`; bench evidence `feabbab3` |
| T7S.17 | Independent browser-critic gate | critic-3 PASS on `4cd9101c`; this report and the tag |

Every implementation commit had an ocr review (`evidence/D07S/ocr/`); test-only commits were reviewed relocated. Each task ended with a cumulative `suite-runner` run, recorded in `evidence/D07S/structural.md`, with outputs in `evidence/D07S/suite-runs/`.

**Last full-tier run `t7s-14`** (on `feabbab3`; only evidence and plan text changed after it), which also stood as the gate's run before the critic:

| Suite | Result |
|---|---|
| Unit | 127 files, 1509 tests passed |
| Node integration | 103 files, 218 tests passed |
| Browser, full tier | `browser-1` 119 passed (4.7 min); `browser-2` 71 passed (4.3 min) |
| Checks | 14 of 14 exit 0 |

`acceptance-commands.sh plan/D07S-option-price-stops-and-targets.md` exits 0, with 11 commands checked and none failing. Section 8's rows are marked covered.

## Critics

| Critic | Flows | Commit | Result |
|---|---|---|---|
| critic-1 (T7S.12 checkpoint) | C7S.1–C7S.4 | `41d8d68f` | FAIL, 1 high: a wrong-side option-price Stop got no W4 while a Target was missing. Fixed by T7S.12-B1 (`d34f6670`). |
| critic-2 (T7S.12, after B1) | C7S.1–C7S.4 | `427d3396` | PASS, no defects |
| critic-3 (T7S.17 gate) | C7S.1–C7S.6, 375/320 px | `4cd9101c` | PASS, no defects. The gate closes on it, because the full run before it stands. |

None of the critics could write its report file, because the harness refuses report files from subagents. The main session recorded each final message verbatim as `critic-1.md`, `critic-2.md` and `critic-3.md`.

## Decisions and the user's directions

- **Decision 108 (revision 80):** the run order is T7S.1, T7S.3, T7S.2, then the rest. T7S.2's measurement confirms option-price conditions, which needs T7S.3. T7S.3 carried the known `verify:capacity` failure.
- **The user's answers, 2026-11-11:**
  - (a) Make the control run before T7S.14's benchmark. This was later dropped; see below.
  - (b) A step 10% to under 35% slower than D7SP r3 is recorded and the session continues. A step 35% or more slower stops the session.
  - (c) Tech debt item 14, the direction-rule copies, is left for D10. Existing direction helpers are reused and no new domain copy is added.
  - (d) New screen words take the closest approved pattern and are listed for approval.
- **Revision 81** (`47dea28c`, tag `claude-opus-5.5-plan-r81`, 2026-11-12, at the user's direction): tech debt item 14 is deferred to D10's cleanup, and D10's breakdown is its only trigger. The entry records the D7S facts:
  - T7S.3 and T7S.4 met the old "first change" trigger;
  - the option-price side is decided inline by the leg's side;
  - `isBullish` and `conditionDirection` are in `src/ui/screens/option-words.ts`;
  - `plan-issues.ts` takes `bullish` as an input.
- **Control run skipped (2026-11-12, at the user's direction).** T7S.14's `bench:generate` deleted the cached generator-6 profile, because `tools/bench-generate.ts:60` removes `.cache/bench/profile` first. A control run of `claude-opus-5.5-pre-d7sp` would have needed about 2.5 more hours of regeneration.

## Benchmark against D7SP r3 (T7S.14)

One `bench:run` on `a4b84749`, on a generator-7, schema-7 dataset with A203's mix: 750 option Plans hold only option-price conditions, and 2,250 hold an option-price Stop beside the Underlying Stop. Both gated budgets pass, and every row comparison passes. All times are in ms; negative changes are faster.

| Measure | r3 | D7S | Change |
|---|---|---|---|
| Cold start p95 (gated, 2,500) | 136.5 | 130.0 | −4.8% |
| Warm switch p95 (gated, 1,500) | 64.9 | 63.5 | −2.2% |
| Review status before / after | 321 / 332 | 322 / 293 | +0.3% / −11.7% |
| First card median / p95 | 268.1 / 288.7 | 272.4 / 302.8 | +1.6% / +4.9% |
| Save Marks median / p95 | 216.1 / 219.3 | 193.5 / 217.5 | −10.5% / −0.8% |
| Action save median / p95 | 193.3 / 243.4 | 189.0 / 191.7 | −2.2% / −21.2% |
| Closed page median / p95 | 113.0 / 116.0 | 114.0 / 122.0 | +0.9% / +5.2% |
| Cold Daily Trade Review Action save median / p95 | 227.2 / 229.2 | 227.2 / 227.3 | 0.0% / −0.8% |

- **Thresholds:** every step is within 10% of r3, with +5.2% the slowest, so the user's thresholds did not fire. Tech debt item 22 (D7SP's slowdown against D7) stands as recorded.
- **Not like for like:**
  - There was no control run, so machine drift is unknown.
  - The dataset differs from r3's: generator 7 against 6.
  - Activity Monitor was using about one of 16 cores during the run.
- **Generation was slow and is unexplained:** 4 h 51 min, about 24.0 s per session and flat, against D7's 12.7 s. `review.save` took 16,411 of its 17,478 s.
  - The measured Review steps match r3, so these steps don't explain it, and it was not investigated.
  - A first `bench:generate` attempt failed after about a minute with "Execution context was destroyed" (`tools/bench-generate.ts:86`). It was rerun unchanged.

## Flagged items

- **First-run passes, each with a mutation check that failed it by assertion:**
  - T7S.4 case 2, "should read O-C2 after P1". T7S.4 case 4's first run was an invalid red, because the headline's zero clause had been coded during case 3. The clause was removed, the case went red, then green.
  - T7S.13-B1 case 2, "should count the two StructureValue conditions on the frozen v7 Open detail". Its mutation check was run after the fact (`930964e7`).
  - T7S.15: every I7S case, I7S.1 to I7S.11, as an integration suite over behaviour already built.
  - T7S.16: every B7S case, B7S.1 to B7S.5, as a browser suite over behaviour already built.
- **T7S.8 behaviour without a planned case of its own:**
  - W3 clears once either price of its role is filled.
  - An `InvalidPrice` beside an option-price field clears once that field holds a positive decimal.
  - The option-price `NoPositiveRisk` and `TargetNotBeyondEntry` stay until the next submit.
  - Only W3's clearing has a regression guard, the stock case.
- **Provisional words awaiting approval,** from T7S.10 (`74ac6e82`). Every critic read them as clear.
  1. A crossed condition reads "<status>, $X beyond" only when its Overrun is above zero. A zero Overrun reads bare, as "Reached".
  2. "Target on the option price at or below $0.30: Active".
  3. The card's "Conditions" heading is an `h4`.
  4. A stock card's Target line reads "Target at or above $X: <status>".
- **Dismissed ocr comments:**
  - T7S.2: `measure-page.ts:727` and `:744`, maintainability notes with no failure scenario.
  - T7S.9: `TradeDetail.tsx:80` and `option-detail-fixtures.ts:18`, style notes.
  - T7S.10: `CardFigures.tsx:53`, a style note.
  - T7S.15 and T7S.16: one each, Wrong, artifacts of the relocated copy.
- **Critics' minor observations (not defects).** The full list is in the handoff's open questions. Worth a decision:
  - **Errors in two rounds** (critic-3, observation 2). An invalid option price such as "0" (W10) shows alone in a submit. A wrong-side option-price Stop gets W4 only after that is fixed. This is the same kind of issue as critic-1's defect, but for W10 with W4; T7S.12-B1 fixed W3 with W4.
  - **No Underlying distance beyond a crossed condition** (critics 2 and 3). Thursday's "Distance on MNO" reads 0.00 with MNO 0.10 beyond. This is D7 behaviour.
  - **The 320 px conditions table** shows only its Condition column until scrolled sideways (all three critics). It is an allowed pattern.
- **Other open items:**
  - The v6 content check in `tools/verify-fixtures.ts:122–131` has no lifecycle filter. It is a candidate for T7S.13-B1's tightening.
  - `ReviewCards.test.tsx:670` and `:694` failed once in `t7s-1`, while an ocr review ran alongside. They have passed since.
  - Under `tsx`, the d1 `probe` helper fails with `__name is not defined`; plain `node` works.
- **Leftover processes:** T7S.16's subagent left wait loops that matched their own `pgrep -f "playwright test"`. A shell `kill` was denied. They were stopped later through the session's task controls, and none remain.
- **Benchmark profiles:** only the newest profile is kept. Keeping one profile per generator version would have kept the control run possible. This is suggested as tech debt; it is not recorded.

## D8 follow-up

D8's breakdown moves to schema 7 by its own revision when D8 starts (D7S breakdown section 1.2; the note at the top of `plan/D08-backup-and-restore.md`). D7S didn't edit D8's breakdown.
