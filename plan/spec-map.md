# Spec map

A derived, **non-normative** reading aid for the frozen `specs/` baseline. It changes nothing in the specs: when the map and a spec disagree, the spec wins. It lets an implementation session read only the spec sections its deliverable needs, as decision 45 of the [implementation plan](implementation-plan.md) directs.

## How to use it

Sessions do **not** read this file in full; it is too long for that. Each deliverable has a short generated reading list in `plan/spec-reading/`, which names the exact line ranges to read: every **core** entry plus every entry tagged with that deliverable, without **planning-only** entries. Use this file to review the tags and, later in a session, to look up any other section by its summary (search it rather than reading it whole).

This table is the source of truth. After changing a tag or class here, regenerate the lists with `python3 .claude/scripts/spec-reading-lists.py`. The specs are frozen, so the line ranges stay valid. Under decision 45, if an implementation session finds a section it needed but whose tag was missing, it corrects the tag here, regenerates the lists, and notes the correction in its evidence. That is not a plan revision. A breakdown revision retags its own deliverable.

**Tag quality.** D1–D8 tags come from a review of each deliverable's task breakdown, combined with its plan definition. D9–D28 tags are **provisional**: they come from the plan's short definitions only, and are refined when each breakdown is drafted.

**Built** 2026-10-19 from `specs/` at the commit tagged `claude-opus-5.5-plan-r4`, by subagents; reviewed and approved by the user with plan revision 5 on 2026-10-19.

## Reading cost per deliverable

Characters of spec text a session reads (core plus tagged), and an estimate in tokens at about 2.4 characters per token. All of `specs/` is 310,755 characters.

| Deliverable | Core | Tagged (non-core) | Total characters | ≈ Tokens |
|---|---|---|---|---|
| D1 | 147,591 | 42,647 | 190,238 | 79K |
| D2 | 147,591 | 48,684 | 196,275 | 82K |
| D4 | 147,591 | 64,285 | 211,876 | 88K |
| D5 | 147,591 | 64,346 | 211,937 | 88K |
| D6 | 147,591 | 70,670 | 218,261 | 91K |
| D7 | 147,591 | 71,557 | 219,148 | 91K |
| D8 | 147,591 | 55,115 | 202,706 | 84K |
| D9 (provisional) | 147,591 | 6,953 | 154,544 | 64K |
| D10 (provisional) | 147,591 | 39,232 | 186,823 | 78K |
| D11 (provisional) | 147,591 | 20,661 | 168,252 | 70K |
| D12 (provisional) | 147,591 | 30,727 | 178,318 | 74K |
| D13 (provisional) | 147,591 | 28,578 | 176,169 | 73K |
| D14 (provisional) | 147,591 | 16,321 | 163,912 | 68K |
| D15 (provisional) | 147,591 | 29,974 | 177,565 | 74K |
| D16 (provisional) | 147,591 | 18,430 | 166,021 | 69K |
| D17 (provisional) | 147,591 | 22,558 | 170,149 | 71K |
| D18 (provisional) | 147,591 | 8,307 | 155,898 | 65K |
| D19 (provisional) | 147,591 | 11,084 | 158,675 | 66K |
| D20 (provisional) | 147,591 | 43,809 | 191,400 | 80K |
| D21 (provisional) | 147,591 | 40,188 | 187,779 | 78K |
| D22 (provisional) | 147,591 | 29,210 | 176,801 | 74K |
| D23 (provisional) | 147,591 | 7,514 | 155,105 | 65K |
| D24 (provisional) | 147,591 | 17,336 | 164,927 | 69K |
| D25 (provisional) | 147,591 | 16,444 | 164,035 | 68K |
| D26 (provisional) | 147,591 | 10,291 | 157,882 | 66K |
| D27 (provisional) | 147,591 | 19,613 | 167,204 | 70K |
| D28 (provisional) | 147,591 | 6,314 | 153,905 | 64K |
| RC (provisional) | 147,591 | 5,112 | 152,703 | 64K |

## Entries

### `specs/README.md`

| ID | Lines | Section | Chars | Class | D1–D8 | D9–D28 (provisional) | Summary |
|---|---|---|---|---|---|---|---|
| S001 | 1–6 | (opening) | 710 | core — Governs product boundaries. | D1, D2, D4, D5, D6, D7, D8 | D9, D10, D11, D12, D13, D14, D15, D16, D17, D18, D19, D20, D21, D22, D23, D24, D25, D26, D27, D28 | Spec scope: frozen stack-neutral spec; one-trader after-close journal for U.S. USD securities in one device-local Workspace. |
| S002 | 7–20 | Authority and interpretation | 860 | core — Governs authority and interpretation. | D1, D2, D4, D5, D6, D7, D8 | D9, D10, D11, D12, D13, D14, D15, D16, D17, D18, D19, D20, D21, D22, D23, D24, D25, D26, D27, D28 | Normative wording and precedence order among glossary, ADRs, module contracts, acceptance, visuals; report contradictions. |
| S003 | 21–41 | Product boundaries | 1,681 | core — Governs product boundaries. | D1, D2, D4, D5, D6, D7, D8 | D9, D10, D11, D12, D13, D14, D15, D16, D17, D18, D19, D20, D21, D22, D23, D24, D25, D26, D27, D28 | Required MVP capabilities and explicitly excluded features (live trading, sync, login, Insights, etc.). |
| S004 | 44–57 | Canonical documents › Domain and decisions | 1,115 | core — Canonical-document index under authority rules; points every deliverable to glossary and ADRs. | D1, D2, D4, D5, D6, D7, D8 | D9, D10, D11, D12, D13, D14, D15, D16, D17, D18, D19, D20, D21, D22, D23, D24, D25, D26, D27, D28 | Index of glossary and the ten accepted ADRs. |
| S005 | 58–75 | Canonical documents › Architecture and interfaces | 1,079 | core — States cross-cutting seam rules (Persistence never UI-callable, host capabilities not domain interfaces). | D1, D2, D4, D5, D6, D7, D8 | D9, D10, D11, D12, D13, D14, D15, D16, D17, D18, D19, D20, D21, D22, D23, D24, D25, D26, D27, D28 | Index of design overview, module contracts with operation counts, UI/delivery contracts; Pricing Provider port, host capabilities, internal Persistence seam. |
| S006 | 76–83 | Canonical documents › Acceptance and later evaluation | 400 | core — Small canonical-document index; part of the authority map every session uses. | D1, D2, D4, D5, D6, D7, D8 | D9, D10, D11, D12, D13, D14, D15, D16, D17, D18, D19, D20, D21, D22, D23, D24, D25, D26, D27, D28 | Index of acceptance contract, planning protocol, traceability, kickoff prompt, and screenshot index. |
| S007 | 84–99 | Conformance rules | 1,772 | core — Governs conformance for every deliverable. | D1, D2, D4, D5, D6, D7, D8 | D9, D10, D11, D12, D13, D14, D15, D16, D17, D18, D19, D20, D21, D22, D23, D24, D25, D26, D27, D28, RC | Conformance rules: PWA write gate, request/response results, atomicity, durable facts, honest capabilities, vertical slices, no fake Unavailable. |
| S008 | 100–102 | Handoff to implementation planning | 738 | planning-only — Governs the planning session, already completed by the frozen plan. | D5, D8 |  | Handoff to planning: reading order, planning protocol, frozen decisions, no implementation before plan approval. |

### `specs/acceptance/acceptance-contract.md`

| ID | Lines | Section | Chars | Class | D1–D8 | D9–D28 (provisional) | Summary |
|---|---|---|---|---|---|---|---|
| S009 | 3–8 | Purpose | 808 | core — Acceptance contract Purpose is core per instructions. | D1, D2, D4, D5, D6, D7, D8 | D9, D10, D11, D12, D13, D14, D15, D16, D17, D18, D19, D20, D21, D22, D23, D24, D25, D26, D27, D28, RC | Acceptance boundary purpose: stack-neutral conformance, Given fixtures via domain commands, exact values retained in evidence. |
| S010 | 9–22 | Evidence requirements | 902 | core — Acceptance contract Evidence requirements are core per instructions. | D1, D2, D4, D5, D6, D7, D8 | D9, D10, D11, D12, D13, D14, D15, D16, D17, D18, D19, D20, D21, D22, D23, D24, D25, D26, D27, D28, RC | Evidence each scenario must retain and rules for workflow, no-write, and benchmark evidence. |
| S011 | 25–31 | Request/response mutation results › AC-RESP-001 — accepted mutations return directly usable post-commit state | 1,068 | core — Cumulative obligation every deliverable re-proves for its mutations. | D1, D2, D4, D5, D6, D7, D8 | D9, D10, D11, D12, D13, D14, D15, D16, D17, D18, D19, D20, D21, D22, D23, D24, D25, D26, D27, D28 | AC-RESP-001: accepted mutations return revision-bound post-commit state usable without read-back. |
| S012 | 34–40 | Plan and lifecycle › AC-PLAN-001 — confirmation freezes one complete Plan | 874 | tagged | D1, D7 | D10, D21, D22 | AC-PLAN-001: Plan confirmation atomically commits Trade, frozen Plan/legs/management, Planned lifecycle, 1R, Plan Reflection. |
| S013 | 41–47 | Plan and lifecycle › AC-PLAN-002 — incomplete confirmation writes nothing | 473 | tagged | D1, D7 | D10, D21 | AC-PLAN-002: incomplete Plan confirmation returns typed rejections and writes nothing. |
| S014 | 48–54 | Plan and lifecycle › AC-LIFE-001 — complete lifecycle and agreement | 655 | tagged | D1, D2, D6, D7 |  | AC-LIFE-001: stored lifecycle transitions Planned/Open/Closed agree with derivation; Terminal Disposition separate from Close Reason. |
| S015 | 55–61 | Plan and lifecycle › AC-LIFE-002 — Abandonment eligibility is factual | 548 | tagged |  | D14, D15 | AC-LIFE-002: Abandonment allowed only without effective Execution; retires Plan Debt; Void rederives eligibility. |
| S016 | 62–68 | Plan and lifecycle › AC-LIFE-003 — disagreement cannot pass as Ready | 597 | tagged | D1, D2, D4, D6, D7, D8 | D10, D12, D14, D15, D20, D21 | AC-LIFE-003: lifecycle/Lot Match/Deviation disagreement surfaces on reads, never read-repaired; preparation repairs or rejects. |
| S017 | 71–77 | Position Changes, settlement, and Rolls › AC-POS-001 — stock scaling and FIFO fee allocation | 644 | tagged | D2, D6, D7 |  | AC-POS-001: stock scaling with FIFO Lot Matches, exact fee allocation, partial realization, and closing on flat. |
| S018 | 78–84 | Position Changes, settlement, and Rolls › AC-POS-002 — multi-leg option decision remains one Position Change | 601 | tagged | D2 | D10 | AC-POS-002: multi-leg fills as one Position Change with shared decision identity and one reflection outcome. |
| S019 | 85–91 | Position Changes, settlement, and Rolls › AC-POS-003 — partial Roll preserves ownership and lineage | 662 | tagged |  | D21 | AC-POS-003: partial Roll keeps untouched predecessor holdings, successor ownership, lineage, reflections atomically. |
| S020 | 92–98 | Position Changes, settlement, and Rolls › AC-SET-001 — Assignment/Exercise allocation and basis | 763 | tagged |  | D20 | AC-SET-001: Assignment/Exercise allocation to existing Stock Trade, residual successor, Settlement Price separate from basis. |
| S021 | 99–105 | Position Changes, settlement, and Rolls › AC-SET-002 — allocation is never guessed | 416 | tagged |  | D20 | AC-SET-002: ambiguous settlement allocation returns Needs Resolution with eligible identities and writes nothing. |
| S022 | 106–112 | Position Changes, settlement, and Rolls › AC-SET-003 — Expiration is explicit | 498 | tagged | D7 |  | AC-SET-003: passed expiration is never inferred; Settlement Due shown and Review incomplete until explicit outcome. |
| S023 | 113–119 | Position Changes, settlement, and Rolls › AC-POS-004 — terminal agency requires one Close Reason | 536 | tagged | D6, D7 | D20, D21 | AC-POS-004: trader-directed terminal exit requires one Close Reason; non-agency settlement gets none; Close Review never blocks. |
| S024 | 120–126 | Position Changes, settlement, and Rolls › AC-POS-005 — Planned-Leg fulfillment is evidence-bound | 785 | tagged | D2, D6 | D10 | AC-POS-005: Planned-Leg fulfillment states and Deviations derived only from evidence; Unplanned requires explicit intent. |
| S025 | 127–133 | Position Changes, settlement, and Rolls › AC-SET-004 — settlement planning and later management are distinct | 761 | tagged | D7 | D20 | AC-SET-004: settlement planning vs Exercise Intent; settlement-created Stock creates Management Debt; cash settlement no successor. |
| S026 | 136–142 | Corrections and audit › AC-CORR-001 — Replace preserves fact identity | 593 | tagged |  | D15 | AC-CORR-001: Replace versions the same Execution identity, restates economics, keeps Anchor and visible history. |
| S027 | 143–149 | Corrections and audit › AC-CORR-002 — Void is visible and economically effective | 490 | tagged |  | D15 | AC-CORR-002: Void keeps identity/history visible, removes economic effect, reconciles consequences in one commit. |
| S028 | 150–156 | Corrections and audit › AC-CORR-003 — Rebuild keeps Trade identity and historical Anchors | 567 | tagged |  | D18 | AC-CORR-003: Rebuild keeps Trade identity, new fact identities, old Anchors resolve as historical. |
| S029 | 157–163 | Corrections and audit › AC-CORR-004 — linked correction is all-or-nothing | 516 | tagged |  | D20, D21 | AC-CORR-004: linked multi-Trade settlement/Roll correction is all-or-nothing on stale revision or Journal rejection. |
| S030 | 164–170 | Corrections and audit › AC-CORR-005 — preview is nonmutating and evidence-bound | 453 | tagged |  | D15, D19 | AC-CORR-005: correction preview is nonmutating, discloses footprint; changed evidence rejects stale commit. |
| S031 | 173–179 | Journal and behavioral evidence › AC-JOUR-001 — only Save captures evidence | 426 | core — Cross-cutting rule for every Journal and Review form across deliverables. | D1, D2, D4, D5, D6, D7 | D10, D12, D13, D14, D15, D17, D20, D21, D26 | AC-JOUR-001: only Save captures Journal/Review evidence; no drafts, keystrokes, or placeholders stored. |
| S032 | 180–186 | Journal and behavioral evidence › AC-JOUR-002 — Edit, Addendum, and Void retain distinct meanings | 544 | tagged | D5 | D13 | AC-JOUR-002: Edit appends version, Addendum is new linked Entry, Void preserves history; all visible. |
| S033 | 187–193 | Journal and behavioral evidence › AC-JOUR-003 — Debt is not an incomplete Entry | 469 | tagged | D2, D5, D6, D7 |  | AC-JOUR-003: deferring creates Outstanding Debt with form snapshot, no blank Entry; due Debt blocks Review only. |
| S034 | 194–200 | Journal and behavioral evidence › AC-JOUR-004 — definition changes are prospective | 480 | tagged | D5 | D26 | AC-JOUR-004: definition revisions apply prospectively; existing Entries and Debt keep original snapshots. |
| S035 | 201–207 | Journal and behavioral evidence › AC-JOUR-005 — one obligation has one explicit outcome | 516 | tagged | D2, D4, D5, D6, D7 | D10, D13, D14, D17, D20, D21 | AC-JOUR-005: one obligation key has exactly one outcome under retries; voiding sole settlement Entry reopens Debt. |
| S036 | 208–214 | Journal and behavioral evidence › AC-JOUR-006 — workflow-routed Debt cannot be settled with prose | 478 | tagged | D5 | D17, D20 | AC-JOUR-006: management-coverage Debt resolves only via Management Revision workflow, never Journal prose. |
| S037 | 215–221 | Journal and behavioral evidence › AC-JOUR-007 — fixed types, runtime forms, and defaults | 681 | tagged | D1, D2, D4, D5, D6 | D13, D17, D26 | AC-JOUR-007: seven fixed Entry Types and Sources seeded with exact definitions; idempotent repeat seeding. |
| S038 | 224–230 | Daily Review › AC-REV-001 — exact-date corrected eligibility | 509 | tagged | D4, D5, D6 | D15 | AC-REV-001: Review eligibility uses Open-at-cutoff corrected facts; corrections restate membership. |
| S039 | 231–237 | Daily Review › AC-REV-002 — task ordering and bounded resumption | 587 | tagged | D4, D5, D6, D7 | D11, D20 | AC-REV-002: Review task order Mark, Debt, settlement, Trade; shared Mark once; resumption from facts, no session. |
| S040 | 238–244 | Daily Review › AC-REV-003 — one-click Hold still requires Save | 534 | tagged | D4, D5, D6 | D21 | AC-REV-003: preselected Hold needs explicit Save; Exit/Roll/Adjust need Intent and create no Trade fact. |
| S041 | 245–251 | Daily Review › AC-REV-004 — Action and Stop Deviation reconcile atomically | 483 | tagged | D5 | D12 | AC-REV-004: Action save and Stop-Discipline Deviation reconciliation commit atomically, one episode. |
| S042 | 252–258 | Daily Review › AC-REV-005 — changed evidence prevents stale Save | 406 | tagged | D4, D5 | D11, D15, D19 | AC-REV-005: changed Mark/Bar/acknowledgment/correction/Action before Save returns conflict with no write. |
| S043 | 259–265 | Daily Review › AC-REV-006 — completion states are honest and reversible | 615 | tagged | D4, D5, D6, D7 | D12, D13, D15 | AC-REV-006: Review completion Complete / With Unavailable Marks / Incomplete, derived and reversible. |
| S044 | 268–274 | Market evidence › AC-MARK-001 — prior completed session is normal evidence | 422 | tagged | D4, D5, D7 | D11 | AC-MARK-001: prior completed session Mark is Expected and Available, not Stale. |
| S045 | 275–281 | Market evidence › AC-MARK-002 — Manual Mark is sticky | 442 | tagged |  | D11, D19 | AC-MARK-002: Manual Mark stays effective over later provider closes; Bars may refresh; history shows override. |
| S046 | 282–288 | Market evidence › AC-MARK-003 — acknowledgment never becomes a price | 523 | tagged | D4 | D11 | AC-MARK-003: unavailability acknowledgment never supplies a price; later exact Mark makes it Available. |
| S047 | 289–295 | Market evidence › AC-MARK-004 — series preserve gaps | 456 | tagged | D4 | D9, D11 | AC-MARK-004: Mark/Bar series show explicit gaps, points, candles; no interpolation or fabricated candles. |
| S048 | 296–302 | Market evidence › AC-MARK-005 — provider recovery is partial and nonbehavioral | 578 | tagged | D4 | D11 | AC-MARK-005: provider recovery appends only valid observations, skips Manual keys, failures transient. |
| S049 | 303–309 | Market evidence › AC-MARK-006 — Daily Bar range evidence is honest | 690 | tagged |  | D11, D12 | AC-MARK-006: trailing Stop/Target uses same-date highs/lows for single-Instrument, synchronized Marks for multi. |
| S050 | 312–318 | Risk, valuation, and payoff › AC-CALC-001 — frozen baseline and Entry Quality | 542 | tagged | D1, D2, D4, D6, D7 | D17 | AC-CALC-001: 1R stays frozen; Entry Quality resolved once at Entry Resolution Point; current risk uses effective management. |
| S051 | 319–325 | Risk, valuation, and payoff › AC-CALC-002 — independent calculation availability | 456 | tagged | D4, D6, D7 | D10 | AC-CALC-002: calculations available independently; Missing Mark makes affected results Unavailable without substitution. |
| S052 | 326–332 | Risk, valuation, and payoff › AC-CALC-003 — Stops, Targets, risk, reward, and Overrun | 593 | tagged | D4, D6, D7 | D10, D17 | AC-CALC-003: independent OR Stop/Target conditions, Ongoing/Worst-Case risk, Incremental Reward, Overrun; not Deviations. |
| S053 | 333–339 | Risk, valuation, and payoff › AC-CALC-004 — Expiration Payoff is not valuation | 661 | tagged | D7 | D10 | AC-CALC-004: Planned and Current Expiration Payoff curves separate from valuation; Not Applicable/Unavailable cases. |
| S054 | 342–348 | Deterministic reports › AC-RPT-001 — Report Period resolution | 550 | tagged |  | D16, D24, D25, D27 | AC-RPT-001: Report Period presets resolve exact calendar dates; no custom range; Current Exposure has none. |
| S055 | 349–355 | Deterministic reports › AC-RPT-002 — Outcomes populations and arithmetic | 708 | tagged | D6 | D24 | AC-RPT-002: Outcomes populations, cumulative realization, Closed-R, classification, Profit Factor, corrected points. |
| S056 | 356–362 | Deterministic reports › AC-RPT-003 — Current Exposure preserves coverage | 608 | tagged |  | D16 | AC-RPT-003: Current Exposure keeps covered subtotals, Unbounded contributors, separate unavailable cohorts, no ratio averaging. |
| S057 | 363–369 | Deterministic reports › AC-RPT-004 — Process Scorecard uses metric-specific opportunities | 717 | tagged |  | D25 | AC-RPT-004: Process Scorecard families with natural dates, denominators, episodes, separate Deviations, no composite grade. |
| S058 | 370–376 | Deterministic reports › AC-RPT-005 — categorical Journal Field uses current identity once | 725 | tagged |  | D27 | AC-RPT-005: Journal Field report groups one categorical field by stable value, one count per effective Entry. |
| S059 | 377–383 | Deterministic reports › AC-RPT-006 — filters, grouping, labels, and completeness | 706 | tagged |  | D16, D22, D24, D25, D27 | AC-RPT-006: report filters AND/OR by stable identity, one Break Down By, Unspecified last, exhaustive contributors. |
| S060 | 386–392 | Reference configuration › AC-REF-001 — exact defaults and protection | 608 | tagged | D1, D6, D7 | D10, D14, D21, D22 | AC-REF-001: exact Catalog default seeds (Strategies, reasons, IdeaSource) with stable identities and policies. |
| S061 | 393–399 | Reference configuration › AC-REF-002 — inactive history remains valid but new use is blocked | 572 | tagged |  | D23 | AC-REF-002: retired/renamed references stay valid historically, blocked for new selection; concurrent retirement conflicts. |
| S062 | 402–408 | Backup, Restore, and reconstruction › AC-BACK-001 — full coherent backup, verified download, and secrets exclusion | 1,528 | core — Backup round trip is a cumulative obligation for every data-adding deliverable. | D1, D2, D4, D5, D6, D7, D8 | D9, D10, D11, D12, D13, D14, D15, D16, D17, D18, D19, D20, D21, D22, D23, D24, D25, D26, D27, D28, RC | AC-BACK-001: full single-snapshot backup excluding secrets; Downloaded vs read-back-verified CompletedBackupReceipt; failures yield no receipt. |
| S063 | 409–415 | Backup, Restore, and reconstruction › AC-REST-001 — preparation validates without mutation | 570 | core — Cumulative Restore round-trip obligation for every data-adding/schema-changing deliverable. | D1, D2, D4, D5, D6, D7, D8 | D9, D10, D11, D12, D13, D14, D15, D16, D17, D18, D19, D20, D21, D22, D23, D24, D25, D26, D27, D28 | AC-REST-001: Restore preparation validates, migrates older data in isolation, discloses repair, never mutates or contacts provider. |
| S064 | 416–422 | Backup, Restore, and reconstruction › AC-REST-002 — replace-only confirmation and safety offer | 986 | tagged | D8 |  | AC-REST-002: replace-only Restore needs confirmation and exact-target receipt or explicit decline; unverified/stale write nothing. |
| S065 | 423–429 | Backup, Restore, and reconstruction › AC-REST-003 — all-section atomicity | 636 | tagged | D8 |  | AC-REST-003: Restore apply is all-section atomic; success returns new binding, status, landing; old views invalidated. |
| S066 | 430–436 | Backup, Restore, and reconstruction › AC-REST-004 — migration failure preserves recoverability | 486 | core — Migrations are cross-cutting: every schema-change deliverable carries a migration-failure test. | D1, D2, D4, D5, D6, D7, D8 | D9, D10, D11, D12, D13, D14, D15, D16, D17, D18, D19, D20, D21, D22, D23, D24, D25, D26, D27, D28 | AC-REST-004: failed startup migration never becomes Ready; prior data stays readable/exportable; retry activates atomically. |
| S067 | 437–443 | Backup, Restore, and reconstruction › AC-REBUILD-001 — reconstruction is observationally equivalent | 720 | core — Cumulative obligation for every new index or projection. | D1, D2, D4, D5, D6, D7, D8 | D9, D10, D11, D12, D13, D14, D15, D16, D17, D18, D19, D20, D21, D22, D23, D24, D25, D26, D27, D28 | AC-REBUILD-001: rebuilding private indexes/projections from facts yields observationally equivalent results. |
| S068 | 446–452 | Offline, responsive, accessibility, and performance › AC-DEL-001 — stopped application reopens offline | 769 | core — Offline behavior is cross-cutting; cumulative obligation. | D1, D2, D4, D5, D6, D7, D8 | D9, D10, D11, D12, D13, D14, D15, D16, D17, D18, D19, D20, D21, D22, D23, D24, D25, D26, D27, D28, RC | AC-DEL-001: stopped app reopens offline as Writable with every Manual workflow working. |
| S069 | 453–459 | Offline, responsive, accessibility, and performance › AC-DEL-002 — update never interrupts active work | 797 | tagged | D1, D2, D4, D5, D7, D8 | D28, RC | AC-DEL-002: update staged and verified in background; activation waits for safe reload; unsaved work kept. |
| S070 | 460–466 | Offline, responsive, accessibility, and performance › AC-DEL-003 — PWA identity and support are browser-neutral | 1,221 | core — Cumulative obligation: browser-tab launch and browser-neutral readiness re-proven each deliverable. | D1, D2, D4, D5, D6, D7, D8 | D9, D10, D11, D12, D13, D14, D15, D16, D17, D18, D19, D20, D21, D22, D23, D24, D25, D26, D27, D28, RC | AC-DEL-003: Web App Manifest identity, complete Offline Release Inventory, tab and installed use, browser-neutral readiness. |
| S071 | 467–473 | Offline, responsive, accessibility, and performance › AC-DEL-004 — Runtime Readiness gates every write | 1,722 | core — Runtime Readiness and RuntimeNotWritable are cross-cutting for every mutation. | D1, D2, D4, D5, D6, D7, D8 | D9, D10, D11, D12, D13, D14, D15, D16, D17, D18, D19, D20, D21, D22, D23, D24, D25, D26, D27, D28, RC | AC-DEL-004: Runtime Readiness checks gate every write; failures Unsupported with all reasons; RuntimeNotWritable everywhere. |
| S072 | 474–480 | Offline, responsive, accessibility, and performance › AC-DEL-005 — failed readiness preserves read-only recovery | 1,564 | core — Runtime Readiness/Recovery Only behavior applies to every mutating deliverable. | D1, D2, D4, D5, D6, D7, D8 | D9, D10, D11, D12, D13, D14, D15, D16, D17, D18, D19, D20, D21, D22, D23, D24, D25, D26, D27, D28, RC | AC-DEL-005: failed readiness with readable data is Recovery Only; unreadable store is Integrity Blocked; no false receipts. |
| S073 | 481–487 | Offline, responsive, accessibility, and performance › AC-DEL-006 — readiness is re-established at every safety boundary | 900 | core — Cumulative Runtime Readiness obligation for every mutation. | D1, D2, D4, D5, D6, D7, D8 | D9, D10, D11, D12, D13, D14, D15, D16, D17, D18, D19, D20, D21, D22, D23, D24, D25, D26, D27, D28, RC | AC-DEL-006: readiness re-established at every launch, update, Restore; runtime failure invalidates Writable immediately. |
| S074 | 488–494 | Offline, responsive, accessibility, and performance › AC-UI-001 — viewport-driven live adaptation | 467 | core — UI shared layout; cumulative obligation for every new view. | D1, D2, D4, D5, D6, D7, D8 | D9, D10, D11, D12, D13, D14, D15, D16, D17, D18, D19, D20, D21, D22, D23, D24, D25, D26, D27, D28 | AC-UI-001: live viewport resize switches sidebar/bottom navigation while preserving route and unsaved state. |
| S075 | 495–501 | Offline, responsive, accessibility, and performance › AC-UI-002 — state, availability, and accessibility | 666 | core — UI state and accessibility rules; cumulative obligation for every new view. | D1, D2, D4, D5, D6, D7, D8 | D9, D10, D11, D12, D13, D14, D15, D16, D17, D18, D19, D20, D21, D22, D23, D24, D25, D26, D27, D28 | AC-UI-002: distinguishable view states, keyboard/accessibility semantics, WCAG AA, graph text equivalents. |
| S076 | 502–508 | Offline, responsive, accessibility, and performance › AC-PERF-001 — mature-scale latency and correctness | 787 | core — Cumulative performance obligation re-proven by every deliverable. | D1, D2, D4, D5, D6, D7, D8 | D9, D10, D11, D12, D13, D14, D15, D16, D17, D18, D19, D20, D21, D22, D23, D24, D25, D26, D27, D28 | AC-PERF-001: 25,000-Trade dataset; cold start p95 <= 2.5s, warm open-list p95 <= 1.5s with full correctness. |
| S077 | 509–515 | Offline, responsive, accessibility, and performance › AC-CAP-001 — installed capabilities are honest | 852 | core — Cumulative capability-honesty obligation for every deliverable. | D1, D2, D4, D5, D6, D7, D8 | D9, D10, D11, D12, D13, D14, D15, D16, D17, D18, D19, D20, D21, D22, D23, D24, D25, D26, D27, D28 | AC-CAP-001: Installed Capability Manifest honest; omitted behavior absent; declared capabilities complete and reachable. |
| S078 | 516–518 | Conformance decision | 494 | core — Governs acceptance and conformance for every deliverable. | D1, D2, D4, D5, D6, D7, D8 | D9, D10, D11, D12, D13, D14, D15, D16, D17, D18, D19, D20, D21, D22, D23, D24, D25, D26, D27, D28, RC | Conformance decision: all applicable plus foundational scenarios required; waivers need explicit spec change. |

### `specs/adr/0001-domain-facts-pure-analysis-and-coordinators.md`

| ID | Lines | Section | Chars | Class | D1–D8 | D9–D28 (provisional) | Summary |
|---|---|---|---|---|---|---|---|
| S079 | 1–15 | (opening) | 1,260 | core — Every ADR is core. | D1, D2, D4, D5, D6, D7, D8 | D9, D10, D11, D12, D13, D14, D15, D16, D17, D18, D19, D20, D21, D22, D23, D24, D25, D26, D27, D28 | ADR 0001: fact modules, pure analysis modules, use-case coordinators; UI consumes finished reads and commands. |

### `specs/adr/0002-semantic-command-atomicity.md`

| ID | Lines | Section | Chars | Class | D1–D8 | D9–D28 (provisional) | Summary |
|---|---|---|---|---|---|---|---|
| S080 | 1–17 | (opening) | 1,627 | core — Every ADR is core. | D1, D2, D4, D5, D6, D7, D8 | D9, D10, D11, D12, D13, D14, D15, D16, D17, D18, D19, D20, D21, D22, D23, D24, D25, D26, D27, D28 | ADR 0002: every domain command atomic; typed no-write conflicts; revision-bound post-commit results without read-back. |

### `specs/adr/0003-authoritative-lifecycle-and-derived-disposition.md`

| ID | Lines | Section | Chars | Class | D1–D8 | D9–D28 (provisional) | Summary |
|---|---|---|---|---|---|---|---|
| S081 | 1–9 | (opening) | 954 | core — Every ADR is core. | D1, D2, D4, D5, D6, D7, D8 | D12, D14, D15, D16, D18, D20, D21, D24, D25 | ADR 0003: Lifecycle State stored/indexed and command-set only; Terminal Disposition always derived. |

### `specs/adr/0004-corrected-economic-history-with-visible-audit.md`

| ID | Lines | Section | Chars | Class | D1–D8 | D9–D28 (provisional) | Summary |
|---|---|---|---|---|---|---|---|
| S082 | 1–9 | (opening) | 973 | core — Every ADR is core. | D1, D2, D4, D5, D6, D7, D8 | D9, D13, D15, D17, D18, D19, D20, D21, D23, D24, D25, D26 | ADR 0004: one corrected economic history with append-versioned Replace/Void/Rebuild and Correction Footprint. |

### `specs/adr/0005-journal-entry-and-journal-debt-are-separate.md`

| ID | Lines | Section | Chars | Class | D1–D8 | D9–D28 (provisional) | Summary |
|---|---|---|---|---|---|---|---|
| S083 | 1–9 | (opening) | 909 | core — Every ADR is core. | D1, D2, D4, D5, D6, D7, D8 | D10, D13, D14, D17, D20, D21, D26, D27 | ADR 0005: Journal Entry immutable writing vs Journal Debt obligation; settle, decline, retire, reopen rules. |

### `specs/adr/0006-device-local-workspace-and-replace-only-restore.md`

| ID | Lines | Section | Chars | Class | D1–D8 | D9–D28 (provisional) | Summary |
|---|---|---|---|---|---|---|---|
| S084 | 1–9 | (opening) | 937 | core — Every ADR is core. | D1, D5, D6, D7, D8 | D11, D23, D28 | ADR 0006: single device-local Workspace, no login/sync; validation-first atomic replace-only Restore. |

### `specs/adr/0007-observed-valuation-and-expiration-payoff.md`

| ID | Lines | Section | Chars | Class | D1–D8 | D9–D28 (provisional) | Summary |
|---|---|---|---|---|---|---|---|
| S085 | 1–9 | (opening) | 981 | core — Every ADR is core. | D1, D4, D5, D6, D7, D8 | D9, D10, D11, D16, D17, D19, D24 | ADR 0007: Mark-to-Market valuation separate from Expiration Payoff; no theoretical pricing; mixed expirations unavailable. |

### `specs/adr/0008-pwa-delivery-and-runtime-readiness.md`

| ID | Lines | Section | Chars | Class | D1–D8 | D9–D28 (provisional) | Summary |
|---|---|---|---|---|---|---|---|
| S086 | 1–25 | (opening) | 3,336 | core — Every ADR is core; Runtime Readiness gates every write. | D1, D2, D4, D5, D6, D7, D8 | D9, D10, D11, D12, D13, D14, D15, D16, D17, D18, D19, D20, D21, D22, D23, D24, D25, D26, D27, D28, RC | ADR 0008: standards-based PWA, Offline Release Inventory, functional Runtime Readiness gate, Unsupported/Recovery Only/Integrity Blocked. |

### `specs/adr/0009-advisory-storage-protection.md`

| ID | Lines | Section | Chars | Class | D1–D8 | D9–D28 (provisional) | Summary |
|---|---|---|---|---|---|---|---|
| S087 | 1–16 | (opening) | 1,870 | core — Every ADR is core. | D1, D2, D4, D5, D7, D8 | D28, RC | ADR 0009: storage protection advisory only; warning, durability request; readiness gates on four remaining checks. |

### `specs/adr/0010-backup-download-verified-by-read-back.md`

| ID | Lines | Section | Chars | Class | D1–D8 | D9–D28 (provisional) | Summary |
|---|---|---|---|---|---|---|---|
| S088 | 1–15 | (opening) | 1,741 | core — Every ADR is core. | D1, D5, D8 | D11, D28, RC | ADR 0010: backup is download then read-back verification; only verification yields CompletedBackupReceipt; confirmBackup added. |

### `specs/adr/0011-optimistic-bindings-and-shared-counter-retry.md`

| ID | Lines | Section | Chars | Class | D1–D8 | D9–D28 (provisional) | Summary |
|---|---|---|---|---|---|---|---|
| S259 | 1–19 | (opening) | 2,320 | core — Every ADR is core. | D1, D2, D4, D5, D6, D7, D8 | D9, D10, D11, D12, D13, D14, D15, D16, D17, D18, D19, D20, D21, D22, D23, D24, D25, D26, D27, D28 | ADR 0011 (revision 11): subject-binding conflicts reported; shared-counter-only conflicts retried up to 3 attempts; no persistence increment primitive. |

### `specs/design/daily-review.md`

| ID | Lines | Section | Chars | Class | D1–D8 | D9–D28 (provisional) | Summary |
|---|---|---|---|---|---|---|---|
| S089 | 3–16 | Contract | 764 | core — Module contract/purpose section. | D4, D5, D6, D7, D8 | D11, D12, D13, D15, D20, D21 | Daily Review contract: coordinates after-close ritual for one session; owns no Review state; four operations. |
| S090 | 17–33 | Date, eligibility, and ordering | 1,626 | tagged | D4, D5, D6, D7, D8 | D12, D15, D20 | Review Date selection, Open-at-cutoff eligibility, normative task-family order, attention bands and ranking rules. |
| S091 | 34–65 | `open` | 1,718 | tagged | D4, D5, D6, D7, D8 | D11, D12, D15, D20 | open: resolves date, queries cutoff-eligible Trades, derives, recovers Marks, assembles one coherent Review read. |
| S092 | 66–71 | `getTrade` | 670 | tagged | D4, D5, D6, D7 | D10, D12, D20, D21 | getTrade: one bound eligible Trade view, ReviewChanged on incoherence, Hold preselection, Action Intent rules. |
| S093 | 72–77 | `getDebt` | 531 | tagged | D4, D5, D6, D7 | D20 | getDebt: pages global due Debt; workflow-routed Debt first; routes rather than settles management Debt. |
| S094 | 78–126 | `save` | 2,731 | tagged | D4, D5, D6, D7 | D12, D13, D15, D20, D21 | save: SaveTradeAction with exact bindings and atomic Deviation reconciliation, or ResolveReviewDebt; uniqueness and retries. |
| S095 | 127–145 | Settlement Due | 981 | tagged | D5, D7 | D15, D20 | Settlement Due keeps Review incomplete until Trade Workflows records explicit settlement; calendar never manufactures Expiration. |
| S096 | 146–157 | Completion and resumption | 969 | tagged | D4, D5, D6, D7, D8 | D11, D12, D13, D15, D20 | Derived completion: Incomplete, Complete, CompleteWithUnavailableMarks; no finish gesture; resumption from facts. |
| S097 | 158–162 | Default Action definition | 418 | tagged | D4, D5, D6, D7 | D13, D21, D26 | Default Daily Trade Review Action options Hold, Exit, Roll, Adjust and their Intent requirements. |

### `specs/design/delivery-contract.md`

| ID | Lines | Section | Chars | Class | D1–D8 | D9–D28 (provisional) | Summary |
|---|---|---|---|---|---|---|---|
| S098 | 3–8 | Product boundary | 710 | core — Product boundary every deliverable must respect. | D1, D2, D4, D5, D6, D7, D8 | D9, D10, D11, D12, D13, D14, D15, D16, D17, D18, D19, D20, D21, D22, D23, D24, D25, D26, D27, D28, RC | Installable local-first PWA for one trader, one device-local Workspace; no login, backend, sync, or brokerage. |
| S099 | 9–37 | PWA identity, installation, and Runtime Readiness | 4,677 | core — Runtime Readiness and RuntimeNotWritable gate every write in every deliverable. | D1, D2, D4, D5, D6, D7, D8 | D9, D10, D11, D12, D13, D14, D15, D16, D17, D18, D19, D20, D21, D22, D23, D24, D25, D26, D27, D28, RC | Web App Manifest, Offline Release Inventory, artifact table, four Runtime Readiness checks, protection reporting, Unsupported/Recovery Only/Integrity Blocked. |
| S100 | 38–45 | Offline guarantee | 924 | core — Offline behavior is cross-cutting for every installed workflow. | D1, D2, D4, D5, D6, D7, D8 | D9, D10, D11, D12, D13, D14, D15, D16, D17, D18, D19, D20, D21, D22, D23, D24, D25, D26, D27, D28, RC | After one writable online load, every installed manual workflow works offline, including cold restart. |
| S101 | 46–60 | Update safety | 1,261 | core — Every form-bearing deliverable must not lose unsaved input on update activation. | D1, D2, D4, D5, D6, D7, D8 | D9, D10, D11, D12, D13, D14, D15, D16, D17, D18, D19, D20, D21, D22, D23, D24, D25, D26, D27, D28, RC | Update detection, notice, and safe deferred activation preserving unsaved forms; readiness and migration before mutations. |
| S102 | 61–68 | Data migration and recovery | 835 | core — Migrations are cross-cutting for every schema-changing deliverable. | D1, D2, D4, D5, D6, D7, D8 | D9, D10, D11, D12, D13, D14, D15, D16, D17, D18, D19, D20, D21, D22, D23, D24, D25, D26, D27, D28, RC | Every durable representation change is versioned with staged, lossless, atomic forward migration; failures leave prior data intact. |
| S103 | 69–80 | Installed capability declaration | 1,311 | core — Every deliverable extends the manifest and must honor capability honesty. | D1, D2, D4, D5, D6, D7, D8 | D9, D10, D11, D12, D13, D14, D15, D16, D17, D18, D19, D20, D21, D22, D23, D24, D25, D26, D27, D28, RC | Immutable dependency-closed Installed Capability Manifest; only complete vertical capabilities declared; absent capability is absent. |
| S104 | 81–86 | Workspace portability | 742 | core — Backup/Restore compatibility of stored data applies to every data-adding deliverable. | D1, D2, D4, D5, D6, D7, D8 | D9, D10, D11, D12, D13, D14, D15, D16, D17, D18, D19, D20, D21, D22, D23, D24, D25, D26, D27, D28, RC | One self-contained versioned backup file is the portability unit; secrets excluded; Restore never merges or remints identities. |
| S105 | 87–100 | Rebuild equivalence | 851 | core — Rebuild equivalence is a cumulative obligation for all derived and stored state. | D1, D2, D4, D5, D6, D7, D8 | D9, D10, D11, D12, D13, D14, D15, D16, D17, D18, D19, D20, D21, D22, D23, D24, D25, D26, D27, D28, RC | After Restore, migration, or private-state rebuild, observable results must be identical from the same facts. |
| S106 | 101–104 | Responsive delivery | 382 | core — Shared responsive layout rule for every UI deliverable. | D1, D2, D4, D5, D6, D7, D8 | D9, D10, D11, D12, D13, D14, D15, D16, D17, D18, D19, D20, D21, D22, D23, D24, D25, D26, D27, D28, RC | Same app provides the UI contract at all widths; live resize switches narrow/wide layout without losing state. |
| S107 | 105–123 | Scale and latency | 1,262 | core — Cumulative performance obligation; any deliverable can regress startup or Open list. | D1, D2, D4, D5, D6, D7, D8 | D9, D10, D11, D12, D13, D14, D15, D16, D17, D18, D19, D20, D21, D22, D23, D24, D25, D26, D27, D28, RC | Mature workload sizes and p95 latency targets for cold start and Open list, with disclosed evidence rules. |
| S108 | 124–129 | Durability and failure behavior | 865 | core — Atomicity and durability apply to every mutating deliverable. | D1, D2, D4, D5, D6, D7, D8 | D9, D10, D11, D12, D13, D14, D15, D16, D17, D18, D19, D20, D21, D22, D23, D24, D25, D26, D27, D28, RC | Semantic mutations all-or-nothing, durable across restart, no read-back; honest advisory storage protection reporting. |
| S109 | 130–134 | Delivery acceptance evidence | 1,348 | core — Evidence requirements accumulate across deliverables and RC. | D1, D2, D4, D5, D6, D7, D8 | D9, D10, D11, D12, D13, D14, D15, D16, D17, D18, D19, D20, D21, D22, D23, D24, D25, D26, D27, D28, RC | Required repeatable delivery evidence: manifest, inventory, readiness, offline, update, migration, backup, resize, accessibility, scale, latency. |

### `specs/design/journal.md`

| ID | Lines | Section | Chars | Class | D1–D8 | D9–D28 (provisional) | Summary |
|---|---|---|---|---|---|---|---|
| S110 | 3–22 | Contract | 1,341 | core — Module contract section. | D1, D2, D4, D5, D6, D7, D8 | D9, D10, D11, D12, D13, D14, D15, D16, D17, D18, D19, D20, D21, D22, D23, D24, D25, D26, D27, D28 | Journal owns saved reflective evidence and definitions; explicit Save only; ten-operation interface. |
| S111 | 23–40 | Fixed identities and versioned definitions | 1,077 | tagged | D1, D2, D4, D5, D6, D7, D8 | D13, D17, D20, D21, D22, D26, D27 | Seven fixed Entry Types, seven Sources, immutable versioned EntryDefinitions with stable Prompt/Option identities. |
| S112 | 41–107 | Fixed identities and versioned definitions › Initial Entry Definitions | 4,131 | tagged | D1, D2, D4, D5, D6, D7, D8 | D12, D13, D17, D20, D21, D22, D26, D27 | Exact initial Prompts, options, requiredness, roles, and conditional rules for each of the seven Entry Types. |
| S113 | 108–132 | Entry semantics | 1,707 | tagged | D1, D2, D4, D5, D6, D7, D8 | D13, D15, D17, D18, D20, D21, D27 | Anchor, Origin, Entry value shape; Edit, Addendum, Void semantics and immutable fields. |
| S114 | 133–158 | Debt and obligation semantics | 1,870 | tagged | D1, D2, D4, D5, D6, D7, D8 | D13, D14, D15, D17, D20, D21, D25 | One outcome per obligation key; Defer creates Debt with snapshot; decline, retirement, Void reopening, Review blocking. |
| S115 | 161–183 | Mutation contracts › `save` | 1,204 | tagged | D1, D4, D5, D6, D7 | D13, D20, D22, D26 | Journal save: direct Create, Edit, Addendum, Void, Debt resolution; validation and complete outcome result. |
| S116 | 184–189 | Mutation contracts › `prepareEffects` and `applyPreparedEffects` | 977 | tagged | D1, D2, D4, D5, D6, D7 | D12, D14, D15, D17, D18, D20, D21 | Nonpersistent prepared workflow obligations with Complete/Defer/Decline/retire; staged in shared transaction; per-type requirements. |
| S117 | 190–210 | Mutation contracts › Definition and seed operations | 1,098 | tagged | D1, D2, D4, D5, D6, D8 | D13, D17, D26 | getDefinitions, reviseDefinition forward-only full replacement, and idempotent stable-keyed seedDefaults. |
| S118 | 211–216 | Mutation contracts › Query | 592 | tagged | D1, D2, D4, D5, D6, D7, D8 | D13, D22, D25, D27 | Journal query filters, scopes, and Timeline, Analysis, Full History projections; AND/OR filter rules. |
| S119 | 217–222 | Mutation contracts › Backup and Restore | 681 | core — Backup/Restore compatibility: every Journal-data-adding deliverable extends this section. | D1, D2, D4, D5, D6, D7, D8 | D13, D17, D20, D26 | Journal backup section contents, restore preparation validation, and atomic identity-preserving apply. |
| S120 | 223–241 | One-click Hold | 702 | tagged | D4, D5, D7 | D12, D13 | Daily Review Hold flow: preselected unsaved Hold, prepared CompleteNow Action Entry; Intent required for others. |

### `specs/design/market-data.md`

| ID | Lines | Section | Chars | Class | D1–D8 | D9–D28 (provisional) | Summary |
|---|---|---|---|---|---|---|---|
| S121 | 3–23 | Contract | 1,280 | core — Module contract/purpose section. | D4, D5, D6, D7, D8 | D9, D10, D11, D12, D19 | Market Data contract: owns closing evidence, acknowledgments, precedence, recovery, provider config; Pricing Provider port. |
| S122 | 24–52 | Observation model | 1,456 | tagged | D4, D5, D6, D7, D8 | D9, D10, D11, D12, D16, D19 | Observation keys and sources, Mark/Daily Bar resolution precedence, Stale context, Expected Mark Date semantics. |
| S123 | 53–85 | Manual writes and precedence | 2,296 | tagged | D4, D5, D7, D8 | D10, D11, D19 | save intentions: Manual Mark, override, correction, assert/withdraw unavailable; Manual stickiness; provider refresh rules. |
| S124 | 86–113 | Query contract | 1,554 | tagged | D4, D5, D6, D7, D8 | D9, D10, D11, D12, D15, D19 | query family ResolveFrames, InspectObservations, ReadSeries; MarketDataSnapshotId, ExpectedSnapshot; gaps never interpolated. |
| S125 | 114–136 | Automatic recovery | 1,974 | tagged | D4, D5, D6, D7, D8 | D11 | recover: enumerate sessions, find gaps, bounded provider fetch, Manual preserved, diagnostics only; NotConfigured without provider. |
| S126 | 137–147 | Daily Bar use | 537 | tagged | D4, D7 | D9, D11, D12 | Daily Bar evidence rules for condition checks (high/low, synchronized Marks); Bars never alter valuation. |
| S127 | 148–151 | Provider configuration | 550 | tagged | D8 | D11 | Provider configuration: zero or one provider, revisioned views, write-only credential never exported or logged. |
| S128 | 152–158 | Backup and Restore | 863 | core — Backup/Restore compatibility of stored data is cross-cutting; every Market-Data-adding deliverable extends it. | D4, D7, D8 | D11, D12 | Market Data backup section contents, exclusions, provider-free Restore validation, restored config becomes Needs Setup. |

### `specs/design/overview.md`

| ID | Lines | Section | Chars | Class | D1–D8 | D9–D28 (provisional) | Summary |
|---|---|---|---|---|---|---|---|
| S129 | 3–8 | Purpose | 752 | core — Design overview architecture. | D1, D2, D4, D5, D6, D7, D8 | D9, D10, D11, D12, D13, D14, D15, D16, D17, D18, D19, D20, D21, D22, D23, D24, D25, D26, D27, D28, RC | Product purpose and design shape: ten deep interfaces, pricing port, delivery seams, persistence seam; stack-neutral. |
| S130 | 9–24 | Load-bearing rules | 2,790 | core — Architecture rules governing every deliverable. | D1, D2, D4, D5, D6, D7, D8 | D9, D10, D11, D12, D13, D14, D15, D16, D17, D18, D19, D20, D21, D22, D23, D24, D25, D26, D27, D28, RC | Eleven load-bearing rules: fact/pure/coordinator roles, atomicity, no read-back, corrections, capability honesty, readiness gate. |
| S131 | 25–45 | Approved modules | 3,456 | core — Module boundaries. | D1, D2, D4, D5, D6, D7, D8 | D9, D10, D11, D12, D13, D14, D15, D16, D17, D18, D19, D20, D21, D22, D23, D24, D25, D26, D27, D28, RC | Table of approved modules, kinds, operation counts, responsibilities; browser-host seams aggregated by Workspace. |
| S132 | 46–97 | Dependency shape | 1,084 | core — Dependency rules. | D1, D2, D4, D5, D6, D7, D8 | D9, D10, D11, D12, D13, D14, D15, D16, D17, D18, D19, D20, D21, D22, D23, D24, D25, D26, D27, D28, RC | Mermaid dependency graph of permitted calls between presentation, modules, provider, and persistence. |
| S133 | 98–122 | Who may call whom | 1,635 | core — Dependency rules. | D1, D2, D4, D5, D6, D7, D8 | D9, D10, D11, D12, D13, D14, D15, D16, D17, D18, D19, D20, D21, D22, D23, D24, D25, D26, D27, D28, RC | Caller-by-module permission matrix and additional call prohibitions. |
| S134 | 123–136 | Internal Persistence/Transaction obligations | 1,278 | core — Persistence obligations underlie every mutating and reading deliverable. | D1, D2, D4, D5, D6, D7, D8 | D9, D10, D11, D12, D13, D14, D15, D16, D17, D18, D19, D20, D21, D22, D23, D24, D25, D26, D27, D28, RC | Observable guarantees the internal persistence/transaction seam must provide: atomic commit, bindings, snapshots, migration, indexes. |
| S135 | 137–151 | Authority map | 1,209 | core — Shared architecture convention on authority. | D1, D2, D4, D5, D6, D7, D8 | D9, D10, D11, D12, D13, D14, D15, D16, D17, D18, D19, D20, D21, D22, D23, D24, D25, D26, D27, D28, RC | Which facts are authoritative versus derived for lifecycle, positions, lots, deviations, risk, journal, market, reports. |
| S136 | 154–159 | Shared value and result conventions › Identity and history | 534 | core — Shared value convention. | D1, D2, D4, D5, D6, D7, D8 | D9, D10, D11, D12, D13, D14, D15, D16, D17, D18, D19, D20, D21, D22, D23, D24, D25, D26, D27, D28, RC | Stable identity vs label vs revision; Replace/Void/Rebuild identity rules; Economic Time and Recorded Sequence ordering. |
| S137 | 160–172 | Shared value and result conventions › Calculation availability | 452 | core — Shared value convention. | D1, D2, D4, D5, D6, D7, D8 | D9, D10, D11, D12, D13, D14, D15, D16, D17, D18, D19, D20, D21, D22, D23, D24, D25, D26, D27, D28, RC | Value, Unbounded, Unavailable, NotApplicable calculation results; no substitutes; covered subtotals. |
| S138 | 173–187 | Shared value and result conventions › Expected domain failures | 1,258 | core — Shared result convention; RuntimeNotWritable on every mutation. | D1, D2, D4, D5, D6, D7, D8 | D9, D10, D11, D12, D13, D14, D15, D16, D17, D18, D19, D20, D21, D22, D23, D24, D25, D26, D27, D28, RC | Typed no-write domain failures and the cross-cutting RuntimeNotWritable result shape. |
| S139 | 188–191 | Shared value and result conventions › Snapshot binding | 318 | core — Shared convention. | D1, D2, D4, D5, D6, D7, D8 | D9, D10, D11, D12, D13, D14, D15, D16, D17, D18, D19, D20, D21, D22, D23, D24, D25, D26, D27, D28, RC | Cross-module reads carry revisions; bounded retry or changed-during-assembly; snapshot not a mutation revision. |
| S140 | 192–214 | Shared value and result conventions › Mutation results | 1,555 | core — Shared result convention for every mutation. | D1, D2, D4, D5, D6, D7, D8 | D9, D10, D11, D12, D13, D14, D15, D16, D17, D18, D19, D20, D21, D22, D23, D24, D25, D26, D27, D28, RC | Accepted mutations return revision-bound command-specific post-commit results; no read-back required. |
| S141 | 217–224 | Main workflow walkthroughs › Confirm a Plan | 513 | tagged | D1, D5, D7 | D10, D20, D21, D22 | Confirm a Plan walkthrough: resolve references, Plan Reflection, assess Plan, prepare Trade, one transaction. |
| S142 | 225–232 | Main workflow walkthroughs › Record a Position Change | 618 | tagged | D2, D4, D5, D6, D7 | D10, D15, D20, D21 | Record a Position Change walkthrough: grouped members, candidate Trades, analysis derivations, Journal effects, one commit. |
| S143 | 233–240 | Main workflow walkthroughs › Open and save Daily Review | 688 | tagged | D4, D5, D6, D7 | D11, D12, D13, D15, D20 | Daily Review walkthrough: eligibility, Mark recovery, attention order, Hold preselect, verified Save, derived completion. |
| S144 | 241–247 | Main workflow walkthroughs › Run a deterministic report | 557 | tagged |  | D16, D22, D24, D25, D27 | Report walkthrough: period, filters, full population, per-Trade datum, fixed metric rules, contributor navigation. |
| S145 | 248–255 | Main workflow walkthroughs › Restore a Workspace | 809 | tagged | D5, D6, D8 | D11, D12, D28, RC | Restore walkthrough: verify artifact, module prepare, analysis verification, preview, atomic apply, view invalidation. |
| S146 | 256–265 | Incremental delivery contract | 1,508 | core — Incremental delivery rules govern every deliverable. | D1, D2, D4, D5, D6, D7, D8 | D9, D10, D11, D12, D13, D14, D15, D16, D17, D18, D19, D20, D21, D22, D23, D24, D25, D26, D27, D28, RC | Delivery as dependency-closed vertical slices with honest manifest; PWA foundation in first mutating slice; coverage disclosure. |
| S147 | 266–273 | Performance design constraint | 775 | core — Cumulative performance obligation every deliverable must preserve. | D1, D2, D4, D5, D6, D7, D8 | D9, D10, D11, D12, D13, D14, D15, D16, D17, D18, D19, D20, D21, D22, D23, D24, D25, D26, D27, D28, RC | Mature-scale p95 cold start and Open-list targets; Open selection via stored lifecycle and bounded batch. |

### `specs/design/performance-analysis.md`

| ID | Lines | Section | Chars | Class | D1–D8 | D9–D28 (provisional) | Summary |
|---|---|---|---|---|---|---|---|
| S148 | 3–16 | Contract | 863 | core — Module contract/purpose section. |  | D16, D22, D24, D25, D27 | Performance Analysis contract: pure cross-Trade fold over supplied projections; four report families. |
| S149 | 17–39 | Scope and population rules | 1,907 | tagged |  | D16, D22, D24, D25, D27 | Report filters, AND/OR combination, single Break Down By, Unspecified group, Report Period presets, PopulationBinding. |
| S150 | 40–47 | Common result contract | 882 | core — Module common rules shared by every report family. |  | D16, D22, D24, D25, D27 | Common report result: InvalidInput/NotApplicable/Available, per-metric states, contributors, correction sensitivity. |
| S151 | 48–68 | `outcomes` | 1,790 | tagged | D6 | D22, D24 | outcomes metrics: counts, P&L, Win Rate, R distribution, Profit Factor, curves, median and tie rules. |
| S152 | 69–88 | `exposure` | 1,664 | tagged | D6 | D10, D16, D22 | exposure metrics: Open population, independent P&L components, covered subtotals, Unbounded, no averaged ratios. |
| S153 | 89–128 | `scorecard` | 3,403 | tagged | D2, D6 | D25 | Process Scorecard families, natural dates, denominators, opportunity populations, no composite grade. |
| S154 | 129–147 | `journalField` | 1,519 | tagged |  | D27 | journalField: one Entry Type and categorical Prompt grouped by stable value; Standalone and Trade-filter rules. |

### `specs/design/reference-catalog.md`

| ID | Lines | Section | Chars | Class | D1–D8 | D9–D28 (provisional) | Summary |
|---|---|---|---|---|---|---|---|
| S155 | 3–19 | Contract | 998 | core — Module contract/purpose section. | D1, D2, D4, D6, D7, D8 | D10, D13, D14, D21, D22, D23 | Reference Catalog contract: identity, availability, labels, Strategy shapes, seeds, backup for reference families. |
| S156 | 20–32 | Records and identity | 1,271 | tagged | D1, D2, D6, D7, D8 | D14, D21, D22, D23 | Record hierarchy, immutable parents and shapes, IdeaSource and Rolled roles, Archived/Retired, label distinguishability. |
| S157 | 33–40 | `save` | 916 | tagged | D1, D6, D8 | D22, D23 | save: typed create, rename, archive/retire, reactivate; Institution archive guard; seeded values remain selectable. |
| S158 | 41–77 | `query` and `resolve` | 1,652 | tagged | D1, D2, D4, D6, D7, D8 | D13, D14, D16, D21, D22, D23, D24 | query listings and resolve modes NewSelection, RetainedReference, HistoricalSnapshot, DisplayOnly; snapshot conflicts. |
| S159 | 78–99 | Strategy shapes and canonical seeds | 1,901 | tagged | D1, D2, D7, D8 | D10, D23 | Strategy shape vocabulary and the eleven exact canonical Strategy seeds. |
| S160 | 100–119 | Taxonomy seeds | 560 | tagged | D1, D6, D7, D8 | D14, D21, D22 | Exact Close Reason and Abandonment Reason seeds; IdeaSource Tag Type with no Values. |
| S161 | 120–138 | `seedDefaults` | 1,147 | tagged | D1, D2, D6, D7, D8 | D10, D14, D21, D22 | seedDefaults: versioned manifest, stable-key idempotent atomic seeding, never overwrites renames, SeedConflict. |
| S162 | 139–145 | Backup and Restore | 808 | core — Backup/Restore compatibility of stored data is cross-cutting; every Catalog-changing deliverable extends it. | D1, D2, D6, D7, D8 | D22, D23 | Catalog backup section contents and Restore validation; no per-reference import or ID remapping. |

### `specs/design/trade-analysis.md`

| ID | Lines | Section | Chars | Class | D1–D8 | D9–D28 (provisional) | Summary |
|---|---|---|---|---|---|---|---|
| S163 | 3–20 | Contract | 1,450 | core — Module contract/purpose section. | D1, D2, D4, D5, D6, D7, D8 | D9, D10, D12, D14, D15, D17, D20, D21, D24 | Trade Analysis contract: pure per-Trade interpretation authority; six operations; no public formula toolkit. |
| S164 | 21–48 | Shared values | 1,015 | core — Shared result vocabulary used by every calculating and displaying deliverable. | D1, D2, D4, D6, D7, D8 | D9, D10, D16 | CalculationResult states, FactOrder, DerivedTradeState contents; no substitution of fabricated values. |
| S165 | 51–58 | Operation contracts › `assessPlan` | 1,109 | tagged | D1, D2, D4, D7 | D10, D20, D21 | assessPlan: Plan validation, Plan Baseline and 1R, option underlying-price Stop monetary boundary, typed rejection. |
| S166 | 59–70 | Operation contracts › `derive` | 1,931 | tagged | D1, D2, D4, D5, D6, D7, D8 | D10, D14, D15, D20, D24 | derive: replay effective facts, Positions, Lots, fees, lifecycle, Entry window, leg fulfillment, Scaling, Disposition Timing. |
| S167 | 71–84 | Operation contracts › `evaluate` | 1,173 | tagged | D4, D5, D6, D7 | D10, D12, D16, D17 | evaluate: valuation, ongoing risk/reward, condition status, Overrun, independent P&L components and coverage. |
| S168 | 85–90 | Operation contracts › `expirationPayoff` | 866 | tagged | D1, D7, D8 | D10 | expirationPayoff: Planned and Current piecewise payoff, zero sets, extrema; Not Applicable and multi-expiration Unavailable. |
| S169 | 91–96 | Operation contracts › `replay` | 876 | tagged | D4, D5 | D9, D10, D12, D17 | replay: per-frame corrected tracks with gaps; Stop Discipline episodes and stable fingerprints. |
| S170 | 97–100 | Operation contracts › `assessChange` | 390 | tagged |  | D15, D18, D19, D20, D21 | assessChange: validates before/candidate records, returns reconciliation and Correction Footprint; never writes. |
| S171 | 101–114 | Normative analytical rules | 2,200 | tagged | D1, D2, D4, D6, D7, D8 | D10, D12, D14, D17, D20, D21 | Normative rules: Execution ownership, FIFO, lot-aware fees, settlement basis, lifecycle, 1R, Deviation categories. |
| S172 | 115–131 | Staged evaluation | 622 | tagged | D1, D2, D4, D5, D6, D7 | D9, D16 | Staged evaluation data dependency: derive, obtain one observation frame, evaluate, expirationPayoff. |
| S173 | 132–136 | Failures and integrity | 704 | core — Module failures section. | D1, D2, D4, D5, D6, D7, D8 | D10, D20 | Typed rejections versus calculation states; callers never convert either into a plausible number. |

### `specs/design/trade-record.md`

| ID | Lines | Section | Chars | Class | D1–D8 | D9–D28 (provisional) | Summary |
|---|---|---|---|---|---|---|---|
| S174 | 3–21 | Contract | 1,493 | core — Module contract/purpose section. | D1, D2, D4, D5, D6, D7, D8 | D12, D13, D14, D15, D17, D18, D20, D21, D22 | Trade Record contract: owns facts, audit history, stored Lifecycle State; nine operations; no CRUD. |
| S175 | 22–41 | Identity and ordering | 1,248 | core — Identity and ordering rules every Trade-mutating deliverable must respect. | D1, D2, D4, D5, D6, D7, D8 | D15, D18 | Trade, fact, version, FactRevision identities; FactOrder; Replace/Void/Rebuild versioning; no placeholder identities. |
| S176 | 42–55 | Record content | 962 | core — Snapshot shape and projections underlie every Trade read and write. | D1, D2, D4, D5, D6, D7, D8 | D10, D14, D17, D20, D21, D22 | TradeRecordSnapshot contents, shared cross-Trade Position Change, Summary/AnalysisInput/FullAudit projections. |
| S177 | 56–59 | Change protocol | 252 | core — Part of the atomic change protocol used by every Trade mutation. | D1, D2, D5, D6, D7, D8 | D12, D14, D15, D17, D18, D20, D21 | TradeRecordChange closed union of change variants. |
| S178 | 60–63 | Change protocol › `prepareChange` | 331 | core — Part of the atomic change protocol used by every Trade mutation. | D1, D2, D5, D6, D7 | D12, D14, D15, D17, D18, D20, D21 | prepareChange: no-write revision checks, candidate AnalysisInput and digest, NeedsResolution for missing allocation. |
| S179 | 64–90 | Change protocol › `applyPreparedChange` | 1,732 | core — Atomicity protocol for every Trade mutation. | D1, D2, D4, D5, D6, D7, D8 | D12, D14, D15, D17, D18, D20, D21 | applyPreparedChange inside coordinator transaction, reconciliation binding, staged projections; Deviation-reconciliation variant. |
| S180 | 93–96 | Read contracts › `getRecord` | 185 | tagged | D1, D2, D4, D5, D6, D7, D8 | D9, D15 | getRecord returns one projection with FactRevision, NotFound, or integrity failure. |
| S181 | 97–117 | Read contracts › `queryRecords` | 1,393 | tagged | D1, D2, D4, D5, D6, D7, D8 | D16, D19, D22, D24 | queryRecords filters, CurrentState and StateAtEconomicCutoff, fixed sorts, bound pagination, batched AnalysisInput. |
| S182 | 118–121 | Read contracts › `history` | 281 | tagged | D5, D6, D8 | D15, D18, D20, D21 | history returns version chains, Voided status, correction reasons, lineage for View history. |
| S183 | 122–140 | Read contracts › `resolveAnchors` | 810 | tagged | D2, D5, D6, D8 | D13, D15, D18 | resolveAnchors: Effective, Superseded, Voided, Unknown; Execution Anchors never redirected. |
| S184 | 141–150 | Backup and Restore | 1,051 | core — Backup/Restore compatibility of stored data is cross-cutting; every Trade-data deliverable extends it. | D1, D2, D4, D6, D7, D8 | D10, D12, D15, D18, D20, D21 | Trade Record backup section, Restore validation and repair of coherent agreement, evidence-bound Deviations kept. |
| S185 | 151–160 | Invariants and failures | 808 | core — Module invariants and failures section. | D1, D2, D4, D5, D6, D7, D8 | D14, D15, D20, D21 | Trade Record invariants: one Account, one owning Trade per fill, atomic lifecycle index, no repair on read, typed no-write. |

### `specs/design/trade-views-and-reporting.md`

| ID | Lines | Section | Chars | Class | D1–D8 | D9–D28 (provisional) | Summary |
|---|---|---|---|---|---|---|---|
| S186 | 3–17 | Contract | 1,139 | core — Module contract/purpose section. | D1, D2, D4, D5, D6, D7, D8 | D9, D16, D19, D22, D24, D25, D27 | Trade Views and Reporting contract: cross-module read boundary, five operations, ReadViewResult states and bindings. |
| S187 | 18–23 | Labels and navigation | 622 | core — Label and navigation rules apply to every read view and report. | D1, D2, D4, D5, D6, D7 | D16, D22, D23, D24 | Current versus at-time label lenses, inactive status, stable contributor navigation in every view. |
| S188 | 24–36 | `browseTrades` | 876 | tagged | D1, D2, D4, D5, D6, D7, D8 | D14, D22 | browseTrades filters, Institution expansion, page-only derivation, lifecycle-specific list item contents. |
| S189 | 37–67 | `getTradeDetail` | 1,519 | tagged | D1, D2, D4, D5, D6, D7, D8 | D10, D12, D13, D15, D17, D20, D21 | getTradeDetail contents and assembly sequence; derive once; reads never repair or record. |
| S190 | 68–92 | `replayTrade` | 1,267 | tagged |  | D9, D10, D11, D12, D15, D17 | replayTrade: automatically derived lifetime, markers, candles, points, gaps; no user range or interpolation. |
| S191 | 93–96 | `runReport` | 436 | tagged |  | D16, D22, D24, D25, D27 | runReport: four families; coordinator exhausts population, derives data, delegates meaning to Performance Analysis. |
| S192 | 97–135 | `runReport` › Report Periods | 1,854 | tagged |  | D16, D24, D25, D27 | Report Period presets and calendar resolution in Workspace time zone; one breakdown; report assembly sequence. |
| S193 | 136–160 | `previewMarkChange` | 1,492 | tagged |  | D19 | previewMarkChange: nonmutating impact preview of a Manual Mark change with exact Save precondition. |
| S194 | 161–170 | Invariants | 540 | core — Module invariants section. | D1, D2, D4, D5, D6, D7, D8 | D9, D16 | Read invariants: coherent snapshot, UI-independent interfaces, gaps survive, no Insights or saved reports. |

### `specs/design/trade-workflows.md`

| ID | Lines | Section | Chars | Class | D1–D8 | D9–D28 (provisional) | Summary |
|---|---|---|---|---|---|---|---|
| S195 | 3–20 | Contract | 1,239 | core — Module contract/purpose section. | D1, D2, D4, D5, D6, D7, D8 | D14, D15, D17, D18, D20, D21 | Trade Workflows contract: only trader mutation interface for Trade facts; six operations; atomic commits. |
| S196 | 21–48 | Common command rules | 1,553 | core — Module common command rules. | D1, D2, D4, D5, D6, D7, D8 | D14, D15, D17, D18, D20, D21 | Common command rules: expected revisions, Economic Time, exact form revisions, ReflectionDisposition, TradeMutationSuccess. |
| S197 | 51–79 | Operation contracts › `confirmPlan` | 1,484 | tagged | D1, D2, D5, D7, D8 | D10, D21, D22 | confirmPlan requirements, atomic Trade plus Plan Reflection commit, sequence. |
| S198 | 80–83 | Operation contracts › `abandonPlan` | 366 | tagged |  | D14, D15 | abandonPlan: only without effective position facts, Abandonment Reason, retires Plan Debt. |
| S199 | 84–147 | Operation contracts › `recordPositionChange` | 4,972 | tagged | D2, D4, D5, D6, D7, D8 | D10, D20, D21 | recordPositionChange: grouped decision, reflections, Close Reason, Roll, Assignment/Exercise, settlement-origin Plan, Management Debt. |
| S200 | 148–153 | Operation contracts › `reviseManagement` | 651 | tagged |  | D17, D20 | reviseManagement: rationale, effective conditions, immutable Entry, resolves Management Debt, never a Deviation. |
| S201 | 154–159 | Operation contracts › `previewCorrection` | 793 | tagged |  | D15, D18, D20, D21 | previewCorrection: Replace, Void, Rebuild preview with Correction Footprint and acknowledgment requirement. |
| S202 | 160–190 | Operation contracts › `commitCorrection` | 1,580 | tagged |  | D15, D18, D20, D21 | commitCorrection: exact preview binding, atomic corrected history, Replace/Void/Rebuild identity semantics. |
| S203 | 191–202 | Invariants | 953 | core — Module invariants section. | D1, D2, D4, D5, D6, D7, D8 | D14, D20 | Workflow invariants: atomic effects, Economic Time order, one reflection per Position Change, no inferred settlement. |

### `specs/design/ui-contract.md`

| ID | Lines | Section | Chars | Class | D1–D8 | D9–D28 (provisional) | Summary |
|---|---|---|---|---|---|---|---|
| S204 | 3–8 | Status and authority | 452 | core — UI contract authority. | D1, D2, D4, D5, D6, D7, D8 | D9, D10, D11, D12, D13, D14, D15, D16, D17, D18, D19, D20, D21, D22, D23, D24, D25, D26, D27, D28 | UI contract is presentation behavior only; screenshots non-authoritative, domain docs win. |
| S205 | 9–25 | Visual language | 1,118 | core — Shared UI layout and accessibility rules. | D1, D2, D4, D5, D6, D7, D8 | D9, D10, D11, D12, D13, D14, D15, D16, D17, D18, D19, D20, D21, D22, D23, D24, D25, D26, D27, D28 | Visual language: cream ground, cards, pill actions, tabular numerals, semantic colors, WCAG AA contrast, focus. |
| S206 | 26–38 | Responsive behavior | 921 | core — Shared responsive layout rule. | D1, D2, D4, D5, D6, D7, D8 | D9, D10, D11, D12, D13, D14, D15, D16, D17, D18, D19, D20, D21, D22, D23, D24, D25, D26, D27, D28 | Live-width responsive layout: narrow bottom nav, wide sidebar, state-preserving resize, parity across widths. |
| S207 | 39–46 | Navigation and context | 1,151 | core — Shared navigation and form outcome rules. | D1, D2, D4, D5, D6, D7, D8 | D9, D10, D11, D12, D13, D14, D15, D16, D17, D18, D19, D20, D21, D22, D23, D24, D25, D26, D27, D28 | Navigation reaches installed capabilities with domain language; contextual forms preserve state; clear Save/Cancel/conflict. |
| S208 | 47–57 | View states | 825 | core — Shared UI state rules. | D1, D2, D4, D5, D6, D7, D8 | D9, D10, D11, D12, D13, D14, D15, D16, D17, D18, D19, D20, D21, D22, D23, D24, D25, D26, D27, D28 | Loading, Ready, Empty, Error view states distinguished from domain status values. |
| S209 | 58–69 | Installation and Runtime Readiness | 2,412 | core — Runtime Readiness UI gating applies to every mutating control. | D1, D2, D4, D5, D6, D7, D8 | D9, D10, D11, D12, D13, D14, D15, D16, D17, D18, D19, D20, D21, D22, D23, D24, D25, D26, D27, D28, RC | UI for readiness pending, install affordance, protection warning, Unsupported, Recovery Only, Integrity Blocked, backup claims. |
| S210 | 70–81 | Forms and evidence capture | 1,053 | core — Form rules apply to every form-bearing deliverable. | D1, D2, D4, D5, D6, D7, D8 | D9, D10, D11, D12, D13, D14, D15, D16, D17, D18, D19, D20, D21, D22, D23, D24, D25, D26, D27, D28 | Accessible forms, chip semantics, exact definition rendering, no implicit evidence, Save as boundary, Hold preselect. |
| S211 | 82–89 | Trade and Journal presentation | 1,216 | core — Trade Detail and Journal presentation is extended by most deliverables. | D1, D2, D4, D5, D6, D7, D8 | D9, D10, D11, D12, D13, D14, D15, D16, D17, D18, D19, D20, D21, D22, D23, D24, D25, D26, D27, D28 | Distinguish Plan, Leg, Position Change, Execution, Position, Lot; Trade Detail concepts; Journal timeline display. |
| S212 | 90–99 | Numbers, availability, and graphs | 1,140 | core — Calculation-availability rendering is used by every figure-showing deliverable. | D1, D2, D4, D5, D6, D7, D8 | D9, D10, D11, D12, D13, D14, D15, D16, D17, D18, D19, D20, D21, D22, D23, D24, D25, D26, D27, D28 | Unrounded values, distinct availability rendering, Missing evidence display, replay candles/points/gaps, accessible graphs. |
| S213 | 100–107 | Corrections and destructive actions | 1,202 | tagged | D4, D5, D8 | D13, D14, D15, D17, D18, D19, D20, D21, D23, D26, D28 | Edit/View history, previewed Replace/Void/Rebuild, two-step backup verify, whole-Workspace Restore confirmation and safety backup. |
| S214 | 108–122 | Screenshot limitations | 731 | core — Applies to all UI work referencing screenshots. | D1, D2, D4, D5, D6, D7, D8 | D9, D10, D11, D12, D13, D14, D15, D16, D17, D18, D19, D20, D21, D22, D23, D24, D25, D26, D27, D28 | Prototype screenshot behaviors not to copy; screenshots omit many normative flows. |
| S215 | 123–127 | Accessibility and responsive acceptance | 508 | core — Accessibility acceptance is cumulative across all UI. | D1, D2, D4, D5, D6, D7, D8 | D9, D10, D11, D12, D13, D14, D15, D16, D17, D18, D19, D20, D21, D22, D23, D24, D25, D26, D27, D28, RC | Keyboard-only core workflows, names/roles/states, focus, zoom/reflow, non-color cues, live resize; manual verification. |

### `specs/design/workspace.md`

| ID | Lines | Section | Chars | Class | D1–D8 | D9–D28 (provisional) | Summary |
|---|---|---|---|---|---|---|---|
| S216 | 3–22 | Contract | 1,292 | core — Module contract section. | D1, D2, D4, D5, D6, D7, D8 | D9, D10, D11, D12, D13, D14, D15, D16, D17, D18, D19, D20, D21, D22, D23, D24, D25, D26, D27, D28, RC | Workspace lifecycle coordinator responsibilities and eight-operation interface; no login, sync, merge, delete. |
| S217 | 23–36 | Status and capabilities | 2,188 | core — Status, readiness evidence, and manifest are used by every deliverable. | D1, D2, D4, D5, D6, D7, D8 | D9, D10, D11, D12, D13, D14, D15, D16, D17, D18, D19, D20, D21, D22, D23, D24, D25, D26, D27, D28, RC | Workspace status contents, Installed Capability Manifest, onboarding, time-zone setting, getStatus outcomes, saveSettings. |
| S218 | 37–95 | Initialization and update migration | 4,001 | core — Migrations and seeding apply to every schema- or seed-changing deliverable. | D1, D2, D4, D5, D6, D7, D8 | D9, D10, D11, D12, D13, D14, D15, D16, D17, D18, D19, D20, D21, D22, D23, D24, D25, D26, D27, D28, RC | Fresh initialization with seeding, initialize result branches, isolated-candidate update migration, normal startup checks. |
| S219 | 96–105 | Local durability | 767 | tagged | D1, D4, D8 | D28, RC | requestDurability result variants; advisory protection never affects readiness; warning stays visible. |
| S220 | 106–158 | Full backup | 4,252 | core — Backup/Restore compatibility: every data-adding deliverable extends the backup round trip. | D1, D2, D4, D5, D6, D7, D8 | D10, D11, D12, D13, D14, D15, D17, D18, D20, D21, D22, D23, D28, RC | Full backup contents, exportBackup Downloaded/Conflict/Not Completed, confirmBackup verification, CompletedBackupReceipt, exclusions. |
| S221 | 161–168 | Restore › `prepareRestore` | 973 | core — Restore validation extends with every data-adding deliverable. | D1, D2, D4, D5, D6, D7, D8 | D10, D11, D12, D13, D14, D15, D17, D18, D20, D21, D22, D23, RC | prepareRestore treats artifact untrusted, validates sections and migrations, repairs or rejects, binds preview token. |
| S222 | 169–207 | Restore › `applyPreparedRestore` | 2,739 | tagged | D5, D8 | D11, D12, D28, RC | applyPreparedRestore preconditions, safety receipt, one-transaction replace, Needs Setup, readiness rerun, view invalidation. |
| S223 | 208–212 | Device-local meaning | 740 | core — Product boundary for device-local data. | D1, D8 | D28, RC | One trader, one device-local root; browsers and profiles independent; Restore copies are independent. |

### `specs/evaluation/kickoff-prompt.md`

| ID | Lines | Section | Chars | Class | D1–D8 | D9–D28 (provisional) | Summary |
|---|---|---|---|---|---|---|---|
| S224 | 1–26 | (opening) | 4,815 | planning-only — Reproduced in plan/kickoff.md, which sessions already follow. |  |  | Kickoff prompt: read baseline and plan, readiness-first, per-case TDD red/green, mock-free integration, fresh browser-critic loop. |

### `specs/evaluation/planning-protocol.md`

| ID | Lines | Section | Chars | Class | D1–D8 | D9–D28 (provisional) | Summary |
|---|---|---|---|---|---|---|---|
| S225 | 3–8 | Purpose | 522 | planning-only — Governs planning, not implementation; the frozen plan and plan/kickoff.md carry its implementation-facing rules. |  |  | Planning protocol purpose: governs the stack-choice and planning session; specs are frozen inputs. |
| S226 | 9–19 | Entry conditions | 629 | planning-only — Governs planning, not implementation; the frozen plan and plan/kickoff.md carry its implementation-facing rules. |  |  | Planning entry conditions: complete specs, repo instructions read, no scaffolding; contradictions pause planning. |
| S227 | 20–43 | Phase 1 — read and freeze the specification model | 1,462 | planning-only — Governs planning, not implementation; the frozen plan and plan/kickoff.md carry its implementation-facing rules. |  |  | Planning Phase 1: spec reading order and comprehension check topics before technology discussion. |
| S228 | 44–60 | Phase 2 — propose technology choices and tradeoffs | 1,762 | planning-only — Governs planning, not implementation; the frozen plan and plan/kickoff.md carry its implementation-facing rules. |  |  | Planning Phase 2: stack profiles must address PWA, readiness, transactions, decimals, migrations, scale, testing. |
| S229 | 61–84 | Phase 3 — produce a vertical-deliverable plan and task graph | 3,102 | planning-only — Governs planning, not implementation; the frozen plan and plan/kickoff.md carry its implementation-facing rules. |  |  | Planning Phase 3: vertical deliverables, task graph requirements, readiness in first mutating deliverable. |
| S230 | 85–99 | Phase 3 — produce a vertical-deliverable plan and task graph › Layer-only exception gate | 1,040 | planning-only — Governs planning, not implementation; the frozen plan and plan/kickoff.md carry its implementation-facing rules. RC exception already approved in the plan. |  |  | Layer-only exception gate: conditions and separate approval required for any layer-only checkpoint. |
| S231 | 100–123 | Phase 3 — produce a vertical-deliverable plan and task graph › Required task and deliverable evidence | 2,752 | planning-only — Governs planning, not implementation; the frozen plan and plan/kickoff.md carry its implementation-facing rules. Its rules are in the plan Rules section and kickoff. | D1, D6 |  | Required evidence: per-case TDD red/green, structural verifications, mock-free real-stack cumulative integration tests. |
| S232 | 124–136 | Phase 3 — produce a vertical-deliverable plan and task graph › Independent browser-critic gate | 2,168 | planning-only — Governs planning, not implementation; the frozen plan and plan/kickoff.md carry its implementation-facing rules. Its rules are in the plan Rules section and kickoff. | D1, D6 |  | Independent browser-critic gate: fresh critic per attempt, test-first defect repair loop, stop on ambiguity. |
| S233 | 137–168 | Phase 4 — map acceptance scenarios to evidence | 1,708 | planning-only — Governs planning, not implementation; the frozen plan and plan/kickoff.md carry its implementation-facing rules. Realised in plan/acceptance-matrix.md. |  |  | Phase 4: acceptance matrix row fields, required evidence kinds, secrets and no-write verification statement. |
| S234 | 169–188 | Phase 5 — interactive review | 1,573 | planning-only — Governs planning, not implementation; the frozen plan and plan/kickoff.md carry its implementation-facing rules. |  |  | Phase 5: interactive review checklist of planning decisions with the user. |
| S235 | 189–204 | Phase 6 — freeze before implementation | 1,097 | planning-only — Governs planning, not implementation; the frozen plan and plan/kickoff.md carry its implementation-facing rules. |  |  | Phase 6: freeze contents of approved plan; kickoff instantiation; deviations pause for approval. |
| S236 | 205–223 | Planning completion checklist | 2,208 | planning-only — Governs planning, not implementation; the frozen plan and plan/kickoff.md carry its implementation-facing rules. |  |  | Planning completion checklist. |

### `specs/evaluation/traceability.md`

| ID | Lines | Section | Chars | Class | D1–D8 | D9–D28 (provisional) | Summary |
|---|---|---|---|---|---|---|---|
| S237 | 3–16 | Purpose and authority | 922 | planning-only — Traceability declares itself non-normative provenance; normative content lives in glossary, ADRs, and contracts. |  |  | Traceability purpose: non-normative provenance and source precedence for interpreting disagreements. |
| S238 | 17–27 | Product and architecture lineage | 2,043 | planning-only — Traceability declares itself non-normative provenance; normative content lives in glossary, ADRs, and contracts. |  |  | Lineage of product scope, architecture, communication, atomicity, lifecycle, and module partition decisions. |
| S239 | 28–43 | Trade, correction, and calculation lineage | 3,021 | planning-only — Traceability declares itself non-normative provenance; normative content lives in glossary, ADRs, and contracts. |  |  | Lineage of Trade, Position Change, Roll, settlement, correction, lot/fee, risk, payoff, Missing Mark decisions. |
| S240 | 44–56 | Journal and Daily Review lineage | 1,984 | planning-only — Traceability declares itself non-normative provenance; normative content lives in glossary, ADRs, and contracts. |  |  | Lineage of Journal model, Edit/Addendum/Void, Anchor/Source, Debt, Daily Review, Hold, settlement-due decisions. |
| S241 | 57–70 | Market Data and analytics lineage | 2,257 | planning-only — Traceability declares itself non-normative provenance; normative content lives in glossary, ADRs, and contracts. |  |  | Lineage of Marks/provider, Expected date, Daily Bars, and analytics report family decisions. |
| S242 | 71–88 | Reference, Workspace, delivery, and UI lineage | 3,566 | planning-only — Traceability declares itself non-normative provenance; normative content lives in glossary, ADRs, and contracts. |  |  | Lineage of reference data, seeds, Workspace identity, PWA readiness, backup, layout, UI states decisions. |
| S243 | 89–101 | Known source supersessions | 1,558 | planning-only — Traceability declares itself non-normative provenance; normative content lives in glossary, ADRs, and contracts. The ADRs themselves are core. |  |  | Superseded source positions, including ADR 0009 and 0010 supersessions; no open product decisions. |

### `specs/glossary.md`

| ID | Lines | Section | Chars | Class | D1–D8 | D9–D28 (provisional) | Summary |
|---|---|---|---|---|---|---|---|
| S244 | 1–4 | (opening) | 232 | core — The glossary is core. | D1, D2, D4, D5, D6, D7, D8 | D9, D10, D11, D12, D13, D14, D15, D16, D17, D18, D19, D20, D21, D22, D23, D24, D25, D26, D27, D28 | Glossary is normative; capitalized terms canonical; UI short labels only when unambiguous. |
| S245 | 5–27 | Workspace and reference language | 4,294 | core — The glossary is core. | D1, D2, D4, D5, D6, D7, D8 | D9, D10, D11, D12, D13, D14, D15, D16, D17, D18, D19, D20, D21, D22, D23, D24, D25, D26, D27, D28, RC | Terms: Workspace, PWA, Offline Release Inventory, Runtime Readiness, RuntimeNotWritable, Recovery Only, Integrity Blocked, receipt, references. |
| S246 | 28–40 | Fact and history language | 1,222 | core — The glossary is core. | D1, D2, D4, D5, D6, D7, D8 | D9, D10, D11, D12, D13, D14, D15, D16, D17, D18, D19, D20, D21, D22, D23, D24, D25, D26, D27, D28 | Terms: Economic Time, Recorded Sequence, Save Time, Effective Fact, Stable Identity, Revision; ordering rules. |
| S247 | 41–70 | Planning and trading facts | 4,430 | core — The glossary is core. | D1, D2, D4, D5, D6, D7, D8 | D9, D10, D11, D12, D13, D14, D15, D16, D17, D18, D19, D20, D21, D22, D23, D24, D25, D26, D27, D28 | Terms: Trade, Plan, Planned Leg, Position Change, Execution, settlements, Roll, Lots, Deviation, Lifecycle, Disposition, Settlement Due. |
| S248 | 71–81 | Planning and trading facts › Lifecycle meanings | 776 | core — The glossary is core. | D1, D2, D4, D5, D6, D7, D8 | D9, D10, D11, D12, D13, D14, D15, D16, D17, D18, D19, D20, D21, D22, D23, D24, D25, D26, D27, D28 | Lifecycle meanings Planned/Open/Closed/Abandoned; Abandonment eligibility; Terminal Disposition applicability. |
| S249 | 82–92 | Planning and trading facts › Deviation taxonomy | 607 | core — The glossary is core. | D2, D4, D5, D6, D7, D8 | D10, D12, D15, D17, D18, D20, D21, D25 | Fixed Deviation types: Planned-Leg Terms, Entry Size, Unplanned Exposure, Stop Discipline; non-Deviation facts. |
| S250 | 93–119 | Journal language | 3,222 | core — The glossary is core. | D1, D2, D4, D5, D6, D7, D8 | D9, D10, D11, D12, D13, D14, D15, D16, D17, D18, D19, D20, D21, D22, D23, D24, D25, D26, D27, D28 | Terms: Journal, Entry, Entry Type/Definition, Prompt, Option, Anchor, Source, Edit, Addendum, Void, Debt, Decline, Action; seven types. |
| S251 | 120–141 | Market observations and valuation | 2,807 | core — The glossary is core. | D2, D4, D5, D6, D7, D8 | D9, D10, D11, D12, D15, D16, D17, D19, D20, D21, D24, D25 | Terms: Mark, Manual Mark, Daily Bar, Expected Mark Date/Status, acknowledgment, Stale, Calculation Result, valuation, payoff sets. |
| S252 | 142–171 | Risk, reward, and outcome language | 2,728 | core — The glossary is core. | D1, D2, D4, D5, D6, D7 | D9, D10, D12, D16, D17, D20, D21, D24, D25 | Terms: Plan Baseline, 1R, original and ongoing risk/reward, Overrun, Entry Quality, Realized R; OR conditions; compact labels. |
| S253 | 172–187 | Review and reporting language | 1,671 | core — The glossary is core. | D4, D5, D6, D7 | D11, D12, D13, D15, D16, D20, D21, D22, D23, D24, D25, D27 | Terms: Daily Review, Review Date/Cutoff, Report Period presets, Break Down By dimensions, Coverage, Future Insights. |
| S254 | 188–200 | Key relationships and invariants | 1,316 | core — The glossary is core. | D1, D2, D4, D5, D6, D7, D8 | D9, D10, D11, D12, D13, D14, D15, D16, D17, D18, D19, D20, D21, D22, D23, D24, D25, D26, D27, D28 | Key relationships and invariants among Trade, Account, Plan, Position Change, Execution, Lots, Entries, Marks, Review. |
| S255 | 201–214 | Example dialogue | 850 | core — The glossary is core. | D2, D5, D6, D7 | D10, D20 | Example dialogue: fills in one Position Change, explicit Expiration without Close Reason, deferral as Debt. |
| S256 | 215–224 | Flagged ambiguities and canonical resolutions | 964 | core — The glossary is core. | D1, D2, D4, D5, D6, D7, D8 | D9, D10, D11, D12, D13, D14, D15, D16, D17, D18, D19, D20, D21, D22, D23, D24, D25, D26, D27, D28 | Canonical resolutions for Position, Fill, Actual Leg, Closed via, Idea Source, Unavailable, Review complete, Insight. |

### `specs/reference/ui-screenshots/index.md`

| ID | Lines | Section | Chars | Class | D1–D8 | D9–D28 (provisional) | Summary |
|---|---|---|---|---|---|---|---|
| S257 | 1–4 | (opening) | 443 | tagged | D1, D2, D4, D5, D6, D7 | D10, D13, D16, D22, D24, D25, D27 | Screenshot set: 24 narrow/wide prototype captures, illustrative only; contracts and glossary override them. |
| S258 | 5–29 | Capture layouts | 3,409 | tagged | D1, D2, D4, D5, D6, D7 | D10, D13, D16, D22, D24, D25, D27 | Narrow vs wide prototype layouts and per-workflow screenshot references with caveats; missing behaviors listed. |

## Review notes

### Largest core entries

Core is read by every deliverable, so it sets the floor of every reading list. These are the biggest core entries, the first places to look if you want to narrow it.

- S099 (4,677 chars) `specs/design/delivery-contract.md` PWA identity, installation, and Runtime Readiness
- S247 (4,430 chars) `specs/glossary.md` Planning and trading facts
- S245 (4,294 chars) `specs/glossary.md` Workspace and reference language
- S220 (4,252 chars) `specs/design/workspace.md` Full backup
- S218 (4,001 chars) `specs/design/workspace.md` Initialization and update migration
- S131 (3,456 chars) `specs/design/overview.md` Approved modules
- S086 (3,336 chars) `specs/adr/0008-pwa-delivery-and-runtime-readiness.md` (opening)
- S250 (3,222 chars) `specs/glossary.md` Journal language
- S251 (2,807 chars) `specs/glossary.md` Market observations and valuation
- S130 (2,790 chars) `specs/design/overview.md` Load-bearing rules
- S252 (2,728 chars) `specs/glossary.md` Risk, reward, and outcome language
- S209 (2,412 chars) `specs/design/ui-contract.md` Installation and Runtime Readiness
- S217 (2,188 chars) `specs/design/workspace.md` Status and capabilities
- S087 (1,870 chars) `specs/adr/0009-advisory-storage-protection.md` (opening)
- S007 (1,772 chars) `specs/README.md` Conformance rules

### Classification calls the agents were unsure about

- S128, S162, S184 (Backup and Restore sections of Market Data, Reference Catalog, Trade Record): core, because every data-adding deliverable extends the backup round trip; could instead be tagged D8 plus the data-adding deliverables.
- S164 (Trade Analysis shared values): core for the "never substituted" rule; could be tagged.
- S175, S176 (Trade Record identity and ordering, record content): core as cross-cutting fact identity and snapshot shape; arguably tagged.
- S177–S179 (Trade Record change protocol): core as the atomic mutation protocol for every Trade write; could be tagged.
- S150 (Performance Analysis common result contract): core under the "module common rules" rule, though only report deliverables use it.
- S187 (Trade Views labels and navigation): core as applying to every view; could be tagged D1, D16, D22, D23, D24.
- S171, S172 (Trade Analysis normative rules, staged evaluation): tagged widely rather than core; borderline.
- S093 (Daily Review `getDebt`): stays uninstalled (decision 29) but tagged D5, D6, D20 so those sessions read why.
- S127 (provider configuration): D8 added beside D11 for the Restore behaviour; possibly over-inclusive.
- S147, S107 (performance and scale): core as a cumulative obligation; tagging D2 and D28 only is defensible.
- S109 (Delivery acceptance evidence): core because evidence accumulates; could be tagged D1, D8, D28, RC.
- S101 (Update safety): core because every form must keep unsaved input across an update; otherwise D1, D28, RC.
- S211 (Trade and Journal presentation): core because nearly every deliverable extends Trade Detail or the timeline; not strictly shared layout.
- S217 (Status and capabilities): core for the manifest and readiness status, though it also holds saveSettings (D23).
- S220, S221 (Full backup, prepareRestore): core under the backup compatibility rule; really D8 plus data-adding deliverables.
- S222 (applyPreparedRestore): tagged, not core (D8, D11, D12, D28, RC).
- S219 (Local durability): tagged D1, D8, D28, RC, not core, though its required warning appears in every view.
- S223 (Device-local meaning): core as a product boundary, with deliverables D1, D8, D28, RC.
- S119 (Journal Backup and Restore): core, deliverables limited to those adding Journal data.
- S231, S232 (planning protocol: TDD and integration evidence rules, browser-critic gate): planning-only, since the plan's "Rules every deliverable follows" and plan/kickoff.md carry them; make them core if sessions don't reliably read kickoff.md.
- S224 (kickoff prompt): planning-only because plan/kickoff.md reproduces it, though it holds implementation rules.
- S006, S004 (README document-index sections): core as part of the authority map; S006 indexes only evaluation docs and could be planning-only.
- S031 (AC-JOUR-001, only Save captures evidence): core as a rule for every Journal and Review form; the matrix lists only D1–D7.
- S062, S063, S066, S072, S070 (AC-BACK-001, AC-REST-001, AC-REST-004, AC-DEL-005, AC-DEL-003): core as cross-cutting; the matrix's Full-in values are narrower.
- S069 (AC-DEL-002, safe update): tagged D1, D28, RC only, though every deliverable with unsaved forms arguably relies on it.
- Judgment additions beyond the matrix and plan lists, e.g. D21, D22 on AC-PLAN-001; D14, D15, D18, D20, D21 on AC-LIFE-003; D7 on AC-SET-004; D17 on AC-JOUR-006; D19 on AC-REV-005; D25, D27 on AC-RPT-001.
- S257, S258 (screenshot index): tagged with the deliverables whose UI the captures illustrate; visual reference only.

### Tags not confirmed by a breakdown review

These came from a plan definition only. They were kept under the inclusive rule, but the deliverable's breakdown review did not confirm them.

- S172 D1: tagged from the plan definition only, not by the D1 breakdown review
- S172 D2: tagged from the plan definition only, not by the D2 breakdown review
- S257 D6: tagged from the plan definition only, not by the D6 breakdown review
- S257 D7: tagged from the plan definition only, not by the D7 breakdown review
- S258 D7: tagged from the plan definition only, not by the D7 breakdown review
