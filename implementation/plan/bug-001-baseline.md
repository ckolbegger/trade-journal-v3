# BUG-001 execution baseline

User implementation kickoff: 2026-10-24. Reviewed task plan SHA-256
665d3755a281db3d5296e418dde193fece16b56a30ecaf4da920375c9882e750.
HEAD 11216bf0138e1dff372e9270afe5c935dfa1e984, branch codex-gpt-6.1-sol.
All seven handoff input digests matched. Existing delivery-plan modification and
untracked repair plan/handoff are preserved. No schema/command/semantic changes
are needed. Implementation is local; no commit, push or deployment authorized.

## T01 calibration and measured targets (frozen before styling)

Original desktop images are 1800 physical pixels for a 1440 CSS-pixel capture;
narrow images are 1018 physical pixels for 814 CSS pixels (rounding). Thus scale
is 1.25. The host's 45 physical-pixel top bar is excluded (36 CSS pixels). Source
reference DPR is inferred from supplied capture dimensions, not measured at source.
Our baseline captures use actual DPR 1, Chromium native profiles; see before/host.json.

Measured desktop Home: sidebar x0–300 physical → 240 CSS; content x528–1553 →
820 CSS; row y271–358 → 69.6 CSS; row gap 11→8.8 CSS; row radius ~18→14.4 CSS.
Drawer x1200–1750 → 440 CSS, inset 24 CSS, radius20 CSS, padding20 CSS.
Narrow form x220–780 → 448 CSS centered; narrow detail shares 448 CSS maximum.
Desktop Home content maximum820 CSS; Plan maximum448 CSS. Body14 CSS, heading22
CSS, section labels11 CSS, input height42 CSS, action44–48 CSS. Target shell/sidebar,
content, standard row and drawer geometry ±5%; content-required growth is disclosed.
Breakpoint1024 CSS; test1023/1024 and retain767/768 state checks.

Original images themselves inspected: all twenty installed-flow assets in the
reference contact sheet (before-reference-board.jpg), plus full Home desktop,
Add Execution desktop, filled Plan narrow. Each reference physical size is in
reference-assets.json; hashes identify original assets.

## Screen/state inventory and permitted adaptations

| Installed screen/state | Original reference | Required adaptation |
| --- | --- | --- |
| Trades Planned/Open, Empty/Loading/Error | Home both | Actual baseline/holdings/fees/Entry Quality replace fake P&L; bounded page, no total claim |
| Planned/Open Detail | Planned/Stock Detail both | Actual frozen baseline and holdings, no valuation/adherence; recorded Executions; retained draft continuation |
| New Plan blank/filled/validation, stages1/2 | Plan stages both, filled variants | Account + exact Stock only; exact price/quantity/Stop/Target; original reflection |
| Opening one/multiple/rejected/conflict/saving | Add Execution both | Time/fees/multiple rows/original reflection; explicitly unsaved; atomic Save |
| Trade Journal, saved/declined/outstanding | Trade Journal both | Original Entry wording/source/moment, audit disclosure, no add/edit |
| Debt queue and composer | Timeline/composer both | Original owed form and explicit Complete/Decline; no voluntary entry |
| Workspace/onboarding | Form/shell tokens | No direct picture; rules-based zone and distinct Institution/Account |
| Loading/Unsupported/Recovery/Integrity Blocked/update | Contract-led | No direct picture; prominent failed checks, protected reads and compact visible advisory warning |

Best Effort warning remains visible on all normal screens. Installation/help and
manual update control move to Workspace. Required D2 content can increase cards,
drawer scroll and page height; touch controls minimum44 CSS. Fonts must be local,
licensed and inventoried; no remote runtime dependency. Keep every installed field,
audit identity and safe action. No D3+ controls. No hidden warning to improve a diff.

## Evidence and execution

Unchanged production UI captured in isolated synthetic profile at1440/814 via
/private/tmp/bug001-before.mjs against pre-existing owned preview port5174.
The initial sandbox browser launch failed before UI access; escalation permitted
native browser launch. Profile path/provenance in before/host.json. No trader data
or browser touched. Subsequent production evidence retains unique attempts through
tools/bug001-evidence.mjs. Plan T01–T12 and I01–I05/B01–B04 remain acceptance scope.
