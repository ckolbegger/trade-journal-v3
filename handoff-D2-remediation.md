# Handoff — D2 remediation: implement T21 and T22, then close D2

**Purpose of this session:** D2 was delivered and tagged, then **reopened** by a recorded deviation
(D-001) because the trader could not see the plan's reward-to-risk ratio or maximum loss before it was
frozen. The plan is already amended; the code is not. Implement the two new tasks, re-run the
integration suite and the critic gate, grow the capability manifest, and close D2.

**Do not re-plan.** The plan changes are recorded, approved and validated. Do not start D3–D7 or
D8–D22. Do not edit `specs/`.

---

## 0. Confirm you are in the right place

```sh
cd /Users/ckolbegger/src/trade-journal-v3/worktrees/deepseek-v41-flash
git rev-parse --abbrev-ref HEAD                 # deepseek-v41-flash
git status --porcelain --untracked-files=all    # must print nothing
git log --oneline -1                            # ec5ac40 docs(plan): freeze revision 2 …
git rev-list --count origin/deepseek-v41-flash..HEAD   # 3 (the plan commits are unpushed)

git rev-parse --short 'deepseek-v41-flash-D1^{commit}'                   # ea4fd85
git rev-parse --short 'deepseek-v41-flash-D2^{commit}'                   # b35a7b9
git rev-parse --short 'deepseek-v41-flash-D2-tdd-behavior-enforcement^{commit}'  # e748e55
```

The tags are **annotated**, so `git rev-parse --short <tag>` prints the *tag object* SHA, not the
commit. Always dereference with `^{commit}`. The two `-D2` tags mark the deliverable **before** this
remediation and must not be presented as its final state.

Then the gates, which must all be as stated before you touch anything:

```sh
shasum -a 256 -c plan/freeze-manifest-2026-10-17.sha256        # 11 x OK
node scripts/check-deliverable-breakdown.mjs plan/deliverable-breakdowns/*.md   # 0 failure(s), 0 warning(s)
node scripts/audit-breakdown-coverage.mjs                      # 0 failure(s), 0 warning(s)
node scripts/derive-acceptance-ownership.mjs                   # 67 scenarios, 32 claimed
npx vitest run                                                 # 44 files, 325 tests pass
npx playwright test                                            # 168 tests pass (4 projects)
```

No server may be listening on port **5177** before you run Playwright — see §5.

---

## 1. Read these first, in this order

1. `AGENTS.md` — behavioural rules. §6 is new and is the evidence standard for this session (see §6
   below). `CLAUDE.md` is a separate tracked copy that must stay identical.
2. [plan/freeze-2026-10-19.md](plan/freeze-2026-10-19.md) — **freeze revision 2, the authority for
   this session.** It records deviation D-001, what changed, the affected scenarios and the durable
   compatibility argument.
3. [plan/deliverable-breakdowns/D2-confirm-first-plan.md](plan/deliverable-breakdowns/D2-confirm-first-plan.md)
   §3 **T21 and T22** (new "Phase P8"), plus T19 and T20 whose blocking edges now include them. These
   task bodies are the complete specification for the work.
4. [plan/freeze-errata-2026-10-17.md](plan/freeze-errata-2026-10-17.md) — **E-012, E-013, E-014**.
   E-012 and E-013 are approved changes that are *recorded but not yet implemented*; T22 and T21
   implement them respectively.
5. `specs/design/trade-analysis.md:51-57`, `specs/design/trade-workflows.md:21-45`,
   `specs/design/ui-contract.md:70-78` — the normative text behind the new behaviour.
6. [artifacts/evidence/D2-red-green.md](artifacts/evidence/D2-red-green.md) — read the top three
   sections (provenance, the recorded format deviation, and the mutation audits) and note that its
   **"Status at the end of this session" section is stale** and must be rewritten by you (§7).

---

## 2. What is already decided — do not re-litigate

| Decision | Content |
|---|---|
| **D-001** | A new UI-callable operation `TradeWorkflows.previewPlan` is added so the form can show the Plan Baseline before Save. It reuses one shared assess-and-derive step with `confirmPlan`, so a previewed figure cannot differ from the frozen one. |
| **E-012** | The form offers **exactly one Stop and one Target**. The "Add another condition" control is removed. The plural condition set remains a model capability (T6's two-Stop OR case, and T19). |
| **E-013** | The **frozen fact** still requires `monetaryBoundary` on every underlying-price condition (PD9). The **input** does not, for a derivable condition: the trader supplies `boundaryPrice`, Trade Analysis derives `|boundary − intendedEntry| × quantity`, and Trade Record freezes that value. Non-derivable conditions (option legs' boundary at D8, `StructureValueCondition`) must still supply one. **Derivability is decided in analysis, never in the form.** |
| **Gate** | §4 gained flow 13, so the critic gate is **13 flows × 2 viewports = 26 entries**. |

The architectural constraint that forced D-001: `scripts/layers.config.mjs:70` declares
`presentation: ["contract", "fact", "coordinator"]`, so **the UI may not import `analysis`** and no
domain arithmetic may live in a form. `npm run lint:layers` enforces it.

---

## 3. The work

### T21 — `B` `previewPlan` and the shared assess-and-derive step

Extract the resolve → `assessPlan` → `frozenBaseline` → `derive` sequence that
`src/trade-workflows/confirmPlan.ts` already performs into **one function** with two callers.

- `previewPlan(seam, command)` returns the baseline, `1R`, per-condition basis and any typed issues,
  and **writes nothing** — no transaction, no participants.
- `confirmPlan` must keep re-assessing at commit time from the same function, so a preview can never
  be used as a stale binding, and the two can never drift.
- Add `trade.previewPlan` to `src/capability/manifest.ts` as an installed operation whose
  `dependencies` are `["runtime.readiness", "workspace.getStatus", "referenceCatalog.query",
  "journal.getDefinitions"]` and whose `entryPoint` is `"app.plan.preview"`. Keep `schema`
  `{min:1,max:2}`, `navigation` `["startup","onboarding","plan","trades"]`, and the self-check green.
  `tests/capability/manifest.test.ts` asserts the **exact** operation list — extend it.
- Six planned cases, plus the step-4 integration case, are in T21's body. Use them verbatim.

### T22 — `B` Plan form: pre-Save disclosure and reduced input set

In `src/ui/PlanForm.tsx` (and `src/ui/styles.css` only if needed):

1. **Show provisional reward-to-risk and maximum loss before Save**, from `previewPlan`. Maximum loss
   for a long stock plan is the `1R` / `originalPlannedRisk`. Label them provisional.
2. **Remove the "Add another condition" control** and its state handling (E-012).
3. **Remove the monetary-boundary inputs**; display the amount the preview derives, read-only (E-013).
4. **Render the preview's typed issues** instead of the form's own duplicated required-field rules.
   Keep the inline messages where they are today so the existing accessibility and keyboard cases
   still pass.
5. Do not call `previewPlan` while a required identity field is blank.
6. After Save, show the **frozen** figures from `ConfirmPlanResult` and label them as frozen. They
   will equal the provisional ones — say so rather than letting the trader guess.

Six planned behaviour cases are in T22's body. Six existing browser cases in
`tests/browser/plan-confirmation.spec.ts` must keep passing, including the `d2-form-layout` case and
the axe case.

### T19 and T20 — re-run

- Add one integration case to `tests/integration/d2-confirm-plan.test.ts`: preview and confirmation
  return an identical baseline for the same draft, and the preview wrote nothing (store-by-store and
  participant-revision comparison).
- Re-run the critic gate: a **fresh** critic that did not write this code, starting the runtime
  itself, 13 flows at 375×812 and 1440×900, **26 entries** at `artifacts/critic/D2-report.json` with
  `spawnedAfterFix: true` and the served URL/port.

---

## 4. Wiring you will need

- `src/workspace/runtime.ts` — add `previewPlan(command): Promise<PlanPreview>` to `ApplicationRuntime`.
- `src/composition/application.ts` — implement it against the same `seam()`.
- `src/trade-workflows/index.ts` — export `previewPlan` and its types.
- The form calls `runtime.previewPlan`, never `assessPlan`. `npm run lint:layers` will tell you at once
  if you get this wrong.

---

## 5. Traps — every one of these bit this session

1. **`npm run dev` does not work for this app.** The frozen readiness gate needs the built, versioned
   service worker; `/sw.js` only exists after `vite build`, so a dev server shows `Unsupported`. Use
   `npm run build && npx vite preview --port $DEV_PORT` (`DEV_PORT=5177`).
2. **A preview server on 5177 breaks the browser suite.** `playwright.config.ts` sets
   `webServer.reuseExistingServer: true`, so Playwright reuses your preview instead of starting
   `scripts/sw-test-server.mjs`, and **8 service-worker specs fail spuriously**. Kill any server on
   5177 before `npx playwright test`, and never leave one running.
3. **The app is a PWA: a rebuild serves the *old* release from the service worker** on the same
   origin. If the UI looks unchanged, check that the **Status** tab's release id matches
   `dist/release-inventory.json`, then DevTools → Application → Service Workers → Unregister +
   Storage → Clear site data (or open a fresh port / incognito window).
4. **Annotated tags**: dereference with `^{commit}` (§0).
5. **Red evidence must be genuine.** A missing module gives a transform error, not a failure — create
   the seam as a stub returning the absent value *or* deliberately throwing "not implemented", then
   run and see it fail for the behaviour. A case that passes at once is not evidence. See AGENTS.md §6.
6. **Record evidence per case for this work.** D2's file carries a *declared* deviation to per-behaviour
   evidence, but AGENTS.md §6 now requires one line per planned case: task id, case phrase, exact
   command, the red observation and why it failed, the green observation. The 12 new cases are cheap
   to record properly — do it that way.
7. **Mutation-audit each new task before calling it done** (AGENTS.md §6): break the behaviour it
   names, confirm the intended case fails, revert. Two audit passes on the original tasks found four
   real gaps; expect this to find something.
8. **`specs/` is read-only.** Any manifested plan file you change needs a register entry, a manifest
   re-stamp and both validators. This session changes **no** plan file — the plan is already amended.
9. **A full suite run is recorded per source-changing commit** in `D2-red-green.md`. A commit without
   a recorded run is not a finished step.
10. **Do not push** unless the user asks.

---

## 6. Definition of done

- [ ] T21 and T22 implemented, every planned case with a recorded red and green observation, both
      mutation-audited.
- [ ] `trade.previewPlan` in the Installed Capability Manifest, dependency-closed, self-check green,
      and the manifest honesty rule respected: it advertises confirmation (now previewable) only —
      not Plan lifecycle, not the response contract, not Journal defaults.
- [ ] T19 re-run with the preview/confirm equivalence case green.
- [ ] A **fresh** critic passes **26/26** entries at both viewports; report at
      `artifacts/critic/D2-report.json`. Any defect it finds is reproduced by an automated test
      before any fix, then a fresh critic re-runs.
- [ ] `npx vitest run`, `npx playwright test`, `npx tsc --noEmit`, `npm run lint:layers`,
      `npx eslint .` all exit 0, with D1's behaviour still green.
- [ ] `shasum -a 256 -c plan/freeze-manifest-2026-10-17.sha256` still 11 × OK (you are not changing
      the plan; if you must, use the register).
- [ ] `D2-red-green.md`'s stale "Status at the end of this session" section rewritten to the truth,
      and a new section recording T21/T22.
- [ ] D2's seams for D3 reported: the frozen Plan fact shape, the `Planned` index entry, the Journal
      definition revision, the manifest v2 state, and `ConfirmPlanResult` — landed as contracted or
      what moved and under which change class. Note the **new** `previewPlan` result shape for D4,
      which should reuse it rather than build its own preview.

---

## 7. Known-stale text you must fix

`artifacts/evidence/D2-red-green.md` §"Status at the end of this session — D2 is **not** complete"
says T13–T20 were not started. That has been false since the deliverable was closed; all twenty tasks
were implemented, criticised and mutation-audited. Rewrite that section rather than leaving a
contradiction inside the evidence file.

---

## 8. Suggested first actions

1. Run §0 in full and stop on anything unexpected.
2. Read T21 and T22 in the breakdown, then deviation D-001 and E-012/E-013 — that is the whole brief.
3. **T21 first, red-first**: stub `previewPlan`, write its six cases, watch them fail, then extract
   `assessDraft` from `confirmPlan` and make them pass without changing `confirmPlan`'s observable
   behaviour (325 Vitest and 168 Playwright must stay green).
4. Manifest growth + its exact-list test.
5. **T22**, red-first, in the browser spec.
6. T19 equivalence case, then the full suites, then the fresh critic for 26 entries.
7. Rewrite the stale status section, append the T21/T22 evidence, commit with full runs recorded.
