# BUG-001 implementation handoff

Prepared 2026-10-24 for a fresh session. This session writes the handoff; the
receiving session performs the repair when the user explicitly invokes it.

## Kickoff and authorized scope

Use this handoff with the user's request to **implement BUG-001 according to the
linked plan**. Reading or finding this file alone is not implementation authorization.
The preceding request authorized planning only. An implementation kickoff authorizes
the focused baseline review/freeze and execution of the referenced tasks; routine
implementation choices do not need another permission round. Clarify genuine
product contradictions or material departures before encoding them.

**Goal:** make every installed D1/D2 screen closely match the original mockups and
make unsaved drafts, rejected saves and recorded Executions unmistakable. Deliver
the usable app through real production commands and persistence, not a component
showcase or static imitation.

The trader explicitly answered both questions on 2026-10-24:

1. Cover **all installed D1/D2 screens**: navigation, Planned/Open lists and Detail,
   planning, execution entry, Journal/Debt, Workspace and setup/delivery states.
2. **Closely match** composition, typography, spacing, compact cards, desktop drawers
   and narrow-screen sheets. Retain Trade Journal branding, required D2 fields and
   safeguards. The mockup's future capabilities remain outside this repair.

The task breakdown is a detailed review draft, not a claim that it was previously
frozen or that the repair passed. Review it against actual code, record the exact
implementation baseline and T01's measured targets, then proceed under an explicit
implementation kickoff. Recommended order is before D3; keep D1–D28 numbering intact.
Everything remains local. Deployment is user-deferred. Earlier D2 commit/push
authorization does not authorize committing or pushing BUG-001.

## 1. Establish the actual checkout and inputs

Use this explicit workdir for every repository command/edit:

`/Users/ckolbegger/src/trade-journal-v3/worktrees/codex-gpt-6.1-sol`

- Branch: `codex-gpt-6.1-sol`, tracking `origin/codex-gpt-6.1-sol`.
- Expected HEAD: `11216bf0138e1dff372e9270afe5c935dfa1e984` —
  `feat: implement D2 initial stock entry and Journal Debt`; committed and pushed.
- At preparation: `implementation/delivery-plan.md` is modified; the BUG-001
  breakdown and this handoff are untracked. Preserve them and inspect any newer work.
- Reuse the checkout. Preserve `.env.local`, `.codex/config.toml`, current user
  records and unsaved browser input. A different HEAD/status is a reason to inspect,
  not reset or switch to a sibling implementation.

Verify these preparation-time SHA-256 hashes. Investigate differences and retain
newer authorized changes instead of silently treating a stale digest as current:

| Path relative to worktree | SHA-256 |
| --- | --- |
| `implementation/plan/bug-001-ui-mockup-fidelity.md` | `665d3755a281db3d5296e418dde193fece16b56a30ecaf4da920375c9882e750` |
| `implementation/delivery-plan.md` | `7c289c08f1bbb789ebb09165ee010f17b3fb01784d8a1ddc4f0a1e8e68d6c49c` |
| `specs/design/ui-contract.md` | `3686d8298e5a50d599bd3616b171976a1a686706cca5567bbaac9a1702049c81` |
| `specs/reference/ui-screenshots/index.md` | `f6b9b6f1d08434fa6dbc1cbacc99f9b5c476dda74c190ecfe58037fdd8d71a1d` |
| `package-lock.json` | `4a834319bc9f7a93451a5fadc18ad2bd107993735ca2a577faefe250d33acc55` |
| `implementation/plan/d02-implementation-baseline.md` | `3f0042a94f5be932f0baaf8222b4a2da50b766a4036cd5d785b640f1b64892fb` |
| `implementation/plan/d02-capacity-evidence.md` | `090ef5822f74e2a41ad10f7f33e6ab0290abdc56b80e49bde7d636fc953f413d` |

**Done:** actual branch/status and inputs are recorded, unrelated changes identified,
and no secrets or user data have been copied into fixtures/evidence.

## 2. Read the plan and inspect the actual pictures

Read the worktree instructions and the complete
[BUG-001 breakdown](../implementation/plan/bug-001-ui-mockup-fidelity.md), including
its screen map, state rules, T01–T12 dependencies, I01–I05, B01–B04 and acceptance
matrix. It is the single source for the detailed tasks; this handoff does not replace it.

Read [specs/README.md](../specs/README.md), glossary/indexed decisions, overview and
all ten module contracts, the full UI/delivery/acceptance contracts and
[kickoff prompt](../specs/evaluation/kickoff-prompt.md). Apply the approved
per-deliverable approach and backup/Restore timing exception in the roadmap.
Existing stack/semantics are settled; this is not a new technology-selection exercise.

Open the **images themselves**, not just their filenames or the screenshot index:
Home, Planned/Stock Detail, blank/filled Plan stages, Add Execution, Trade Journal,
Journal timeline and entry composer, both narrow and desktop. All pairs are linked
from [the index](../specs/reference/ui-screenshots/index.md). Inspect current
`App.tsx`, `App.module.css`, `OpeningForm.tsx`, `DebtForm.tsx`, their real service
calls and tests before changing them.

Read D2's [baseline](../implementation/plan/d02-implementation-baseline.md),
[capacity evidence](../implementation/plan/d02-capacity-evidence.md),
[verification README](../implementation/evidence/d02/README.md),
[final record](../implementation/evidence/d02/final-local-verification.json),
[remaining limits](../implementation/evidence/d02/pending-verification.md) and
[critic report](../implementation/evidence/d02/critic-01/report.md).
Old statements that D2 was uncommitted describe the verification-time snapshot;
the later commit/push above supersedes that delivery status. Passing D2 checks did
not establish mockup fidelity. That missing gate is the reason for BUG-001.

**Done:** every installed screen has a reference or an explicit contract-led
adaptation, and all required fields/actions have a place in the intended design.

## 3. Start with reference measurements and the reported regression

Execute **T01** before styling: capture the unchanged production UI in isolated
synthetic profiles, calibrate reference image pixels to CSS viewport/DPR, and
produce the annotated before/reference board. Record exact visual targets and
allowed semantic/safety adaptations. Current oversized generic forms are the
defect baseline, not a screenshot baseline to approve against itself.

Then execute **T02** one behavior at a time through Red → smallest Green → earlier
cases still Green. The reported pattern is: row 1 complete, added row 2 blank,
Save rejected, navigate back to Planned Detail, reopen and see retained values plus
“Remove Execution,” with no clear distinction between draft and saved facts.
Use synthetic data; the original trader input is not a test fixture to publish.

Retain atomic rejection. Identify blank Execution 2 fields, say Nothing saved,
label draft rows/removal explicitly and show Continue unsaved entry on Detail.
Then follow T03–T12's dependency graph. Pure style work uses reproducible visual
comparisons; behavioral work requires actual failing assertions before its change.
Immediate passes, bad selectors, TypeErrors and fixture failures are not valid Reds.

**Done:** the ambiguity has genuine regression evidence, truthful draft/rejection
state and unchanged authoritative storage, before the larger redesign proceeds.

## 4. Preserve the plan's consequential presentation and safety rules

- The proposed breakpoint is **1024 CSS px** so the 814px reference is narrow.
  Test 1023/1024 and state retention at 767/768; update old layout assertions without
  dropping their state-preservation obligations. T01 calibrates the geometry targets.
- Use compact reference-like shell/cards, one active navigation state, meaningful
  type hierarchy and contextual right drawers/bottom sheets. Setup/Recovery screens
  without direct pictures must visibly belong to the same design.
- Close/X/Escape retains a draft; explicit Cancel/discard clears only view state.
  A closed retained draft still defers application-update activation. Focus,
  background inertness, scrolling and Save/Cancel remain accessible during resize.
- The one explicit Save commits every Execution and reflection outcome together.
  Saving disables duplicate submission and conflicting edits; Saved/Open appears
  only after the existing post-commit response. Render it directly, with no required
  read-back or UI-inferred lifecycle. Rejection/abort preserves the draft.
- Keep required warnings visible compactly. Installation/help/manual update controls
  remain reachable; failed readiness and unreadable existing data remain prominent
  and protective. Do not hide safety information to make a reference comparison pass.
- Preserve exact arithmetic, original Journal definitions and all existing durable
  contracts. No schema/command change is planned. If inspection proves one necessary,
  surface the concrete reason before expanding scope.
- Keep D3+ absent: no valuation/P&L placeholders, adherence, sells/exits, scaling,
  option variants, Daily Review, Reports, Insights, Edit/Void, Backup or Restore.
  Fees, exact instants and required reflection fields adapt within the design.

The previous critic's partial focused-Note overlap with bottom navigation is an
explicit BUG-001 regression target. It remains unfixed in the starting release.

## 5. Verify behavior and visual fidelity separately

Keep BUG-001 evidence under `implementation/evidence/bug-001/`; preserve D1/D2
records. For each attempt retain exact command/exit, source/build/input hashes,
actual host/browser provenance, fixture replacements, screenshots and complete
authority comparisons. Preserve failures with unique names, not overwritten logs.

Follow T10's **Verification cadence — trader-approved revision, 2026-10-24**:
focused checks during repairs, fresh critic acceptance, then one final cumulative
and scale qualification after fixes settle. T10/T11 retain all unit/integration/
native browser, offline/update, migration/reconstruction and both scale benchmark
requirements for final qualification. Adapt test interaction
sequences to drawers and Plan stages while preserving every prior scenario and
durable assertion. Native faults stay in isolated profiles; fake-indexeddb cannot
certify browser readiness/durability. Shared-store races use actual shared storage.

**Build provenance gotcha:** release identity includes `tools/` and root config
files, not only application source. After such an edit, rebuild the application,
base/update releases and injected test actors from matching frozen inputs. Check
actor/release identities **before** generating 25,000 Plans. An old D2 scale actor
was correctly rejected after it was rebuilt against a different release identity;
do not bypass control/inventory checks to fix a harness mismatch.

Visual evidence must compare the real app with the original references plus the
T01 board. T11 requires calibrated geometry, side-by-side/overlay review, documented
adaptations, font/asset completeness and every installed screen/state accounted
for. Newly blessed screenshots of a divergent implementation are not fidelity proof.
Preserve the cold/warm thresholds and complete data population in the plan.

**Done:** cumulative correctness/delivery/performance gates and the distinct
reference-based visual gate pass on one settled source/build. Honest inherited
limits remain explicit: OS installation/standalone launch and native browser-chrome
200% zoom were unverified; CSS zoom is supplemental. HTTPS remains user-deferred.

## 6. Fresh independent acceptance, repair loop and local handback

After T10's iteration checks and T11's visual/accessibility checks pass,
**spawn a fresh independent critic**, as T12 explicitly
requires. This handoff authorizes that delegation. Give it the complete frozen
specs, this plan, actual image assets, T01 board, allowed deviations and exact
source/build identity. It starts its own strict production runtime and independently
exercises all BUG-001 B01–B04. It reports **visual fidelity and functional behavior
separately**, with per-flow actions, expected/observed results, screenshots and
console/server evidence. It does not edit implementation or self-certify unavailable
checks. Earlier implementation/review agents are not the fresh acceptance critic.

For a product defect: preserve finding → failing automated regression → minimal
fix → T10's focused iteration checks → **different fresh critic for every current
repair flow**. A driver correction is retained as an attempt, not a product fix.
When a critic/runtime cannot be supplied, leave acceptance incomplete with the
concrete blocker. A screenshot pass alone and a functional pass alone are both insufficient.

After both verdicts pass and fixes settle, run T10/T11 final cumulative and scale
qualification on that accepted frozen source/build. Use T10's impact rules for
later changes. The trader approved this cadence on 2026-10-24 to replace full
scale reruns after every critic finding; thresholds and evidence remain unchanged.

Local preview is configured for secure loopback `http://localhost:5174` with a
strict port. Inspect an existing listener and its workdir before stopping only the
owned preview. Coordinate exclusive port use across suites and critic; have the
critic close its profiles, restore any swapped distribution exactly and hand back
the port. Restore the final production preview for the trader after verification.

The trader's live browser contains real records and may retain unsaved execution
input. Preserve it. Apply the final release through the normal verified update
flow with safe draft handling; never clear site data or reseed it. Keep isolated
browser profiles outside the repository evidence directory.

**Done:** all T01–T12/I01–I05/B01–B04 evidence is attributed honestly, a fresh critic
passes both acceptance dimensions, the completed local app is testable, and remaining
limits are disclosed. Report changed screens, proof and limits clearly. Commit,
push and deployment require separate user authorization.
