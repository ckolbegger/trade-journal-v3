# Fresh-session prompt: extract the Trade Journal V3 specifications

Use this prompt in a new session with an empty context window.

---

@/home/ckolbegger/src/trade-journal-v3/trade-journal-v3-spec-consolidation-handoff-2026-08-26.md

Work in:

`/home/ckolbegger/src/trade-journal-v3`

First read and obey:

`/home/ckolbegger/src/trade-journal-v3/AGENTS.md`

## Goal

Extract the fully settled Trade Journal V3 product specification and deep-interface design from the attached handoff into a self-contained `specs/` directory suitable for handing to a coding assistant during a later, separate planning session.

This is specification work only. Do not implement the application and do not create an implementation plan.

## Current state

The attached handoff is authoritative. All consequential product decisions, the Candidate C architecture, all ten MVP module interfaces, and their sequence-diagram audits are complete.

No further module drill-down is required. No known product decision remains open.

Important final interface counts:

- Trade Analysis: 6 operations
- Trade Workflows: 6 operations
- Trade Record: 9 operations
- Journal: 10 operations, including the Workspace-only `seedDefaults`
- Market Data: 8 operations
- Daily Review: 4 operations
- Performance Analysis: 4 operations
- Reference Catalog: 7 operations
- Trade Views and Reporting: 5 operations
- Workspace: 7 operations
- Pricing Provider: 1 external-port operation
- Persistence/Transaction: internal and not UI-callable

The approved Report Period presets are:

- All Time
- Year to Date
- Quarter to Date
- Month to Date
- This Week
- Last Week

`This Week` is Monday through the current date in the Workspace time zone. `Last Week` is the preceding Monday through Sunday. They are calendar periods, not trading-session ranges. Current Exposure has no Report Period.

## Output location and structure

Create everything under the repository-root `specs/` directory so these specifications remain separate from existing project artifacts.

Use this structure:

```text
specs/
  README.md
  glossary.md
  adr/
  design/
    overview.md
    trade-analysis.md
    trade-workflows.md
    trade-record.md
    journal.md
    market-data.md
    daily-review.md
    performance-analysis.md
    reference-catalog.md
    trade-views-and-reporting.md
    workspace.md
    ui-contract.md
    delivery-contract.md
  acceptance/
    acceptance-contract.md
  evaluation/
    planning-protocol.md
    traceability.md
    kickoff-prompt.md
  reference/
    ui-screenshots/
```

You may add an index or a narrowly justified supporting specification under this tree if needed, but do not create application plans, tickets, or implementation artifacts.

## Screenshots

Copy the canonical Claude prototype screenshots once from:

`worktrees/claude/docs/design/prototype/*.png`

to:

`specs/reference/ui-screenshots/`

There are 24 screenshots. Ox Alpha's copies are duplicates and should not be copied again.

The screenshots are visual references only. They are not authoritative for calculations, lifecycle semantics, terminology, or known prototype inconsistencies.

Use relative links from the UI contract to the copied screenshots. Also create a short screenshot index explaining which workflow or viewport each image illustrates.

## Authoritative inputs

1. Primary authority:

   `/home/ckolbegger/src/trade-journal-v3/trade-journal-v3-spec-consolidation-handoff-2026-08-26.md`

   Read it completely in bounded sections. Do not rely on a heading-only skim. The latest resumption directive and completed module sections override earlier exploratory or historical statements.

2. Repository instructions:

   `/home/ckolbegger/src/trade-journal-v3/AGENTS.md`

3. UI reference material, when needed:

   - `worktrees/claude/docs/design/ui-style.md`
   - `worktrees/claude/docs/design/prototype/README.md`
   - `worktrees/claude/docs/design/prototype/*.png`

4. Source-design material, only when needed to verify provenance:

   - `worktrees/claude/docs/`
   - `worktrees/glm/docs/`
   - `worktrees/ox-alpha/docs/`

Do not read application code. Enumerate documentation files before opening them. Ox Alpha descends from Claude and substantially duplicates it, so duplicated material is one design lineage rather than two independent votes.

## Suggested skills

Use the smallest applicable set and read each selected `SKILL.md` completely before acting:

- `deep-interface-design` — preserve the approved partition, module contracts, dependency rules, and extraction discipline.
- `domain-modeling` — create the canonical glossary and only genuinely selective ADRs.
- `ubiquitous-language` — harden terminology, relationships, and aliases; write its result to `specs/glossary.md` as required here.
- `sequence-diagram-interface-audit` — preserve and verify the completed high-yield workflows in their owning module documents.

The user-approved output path overrides any skill's default documentation path. Do not invoke implementation, TDD, implementation-planning, ticketing, or code-review skills for the application.

Do not use subagents.

## Writing requirements

Produce a coherent canonical specification, not a pasted or mechanically split copy of the handoff.

The build-facing documents must:

- Be technology-neutral.
- Use the canonical glossary consistently.
- State normative observable behavior, invariants, operation contracts, inputs, outputs, and failure semantics.
- Preserve the approved dependency direction and module ownership.
- Include the completed high-yield Mermaid sequence diagrams in the owning module documents.
- Contain no source-branch debate or historical narration unless it helps explain a selective ADR.
- Avoid prescribing frameworks, databases, programming languages, component structures, or implementation task ordering.
- Distinguish required MVP behavior from explicitly deferred Future Insights.
- Make incremental deployment possible through honest installed capability declarations.
- Be sufficient for a fresh coding assistant to conduct an interactive technology and implementation-planning phase without reopening settled product decisions.

Keep source lineage separate in:

`specs/evaluation/traceability.md`

That matrix should identify Claude, GLM, Ox Alpha, canonical synthesis, explicit user decisions, conflicts, and supersessions. Branch history should not distract an implementation assistant reading the build-facing specification.

The glossary must contain domain language only. Include precise definitions, relationships, and aliases to avoid. In particular, preserve distinctions among:

- Trade, Plan, Planned Leg, Position Change, Execution, Position, and Lot Match
- Management Revision, Deviation, Close Reason, Terminal Disposition, and Lifecycle State
- Journal Entry, Journal Debt, Entry Type, Prompt, Anchor, Source, and originating-fact association
- Mark, Daily Bar, Expected Mark Date, Expected-Mark Status, Stale, and Unavailable
- Plan Baseline, 1R, Ongoing Risk to Stop, Worst-Case Ongoing Risk, Incremental Reward, and Overrun
- Account, Institution, Workspace, and application identity
- Strategy, Tag Type, Tag Value, and IdeaSource

Create ADRs selectively. Record only decisions that are hard to reverse, surprising without context, and based on real tradeoffs. Do not reproduce every requirement as an ADR.

## Acceptance and evaluation

The acceptance contract must be technology-neutral and scenario-based. It must cover, at minimum:

- Complete Trade lifecycle and stored Lifecycle State agreement
- Plan confirmation and frozen Plan Baseline
- Stock and option Position Changes, scaling, settlement, and Rolls
- Corrections, Voids, stable identity, and visible audit history
- Journal Entry versus Journal Debt semantics
- Daily Review, explicit Save, and the preselected one-click Hold path
- Mark precedence, normal prior-session evidence, unavailable acknowledgments, and gaps
- Ongoing risk/reward and Expiration Payoff
- All four Performance Analysis report families, filters, groupings, coverage, and Report Periods
- Full backup, secrets exclusion, migration, validation, and atomic replace-only Restore
- Offline restart, update safety, responsive behavior, and the stated scale/latency targets
- Rebuild equivalence after Restore or private-projection reconstruction

The evaluation-planning protocol must describe how a future evaluated coding assistant:

1. Reads the frozen specifications.
2. Proposes technology choices and tradeoffs.
3. Produces an incremental implementation plan and task graph.
4. Maps acceptance scenarios to evidence.
5. Reviews the plan interactively with the user.
6. Freezes the approved plan before implementation begins.

Do not create that implementation plan now.

The kickoff prompt should be concise and should point the future coding assistant to the approved specifications and its separately approved, frozen implementation plan.

## Verification

Before reporting completion:

- Verify every Markdown link and copied screenshot reference.
- Verify all expected files exist under `specs/`.
- Verify no specification file was written outside `specs/`.
- Verify Mermaid fences are balanced and Mermaid blocks contain no semicolons.
- Search for stale or rejected terminology and semantics, including:
  - derived-only Lifecycle State
  - Account Snapshot
  - Bull Put Spread
  - 0-DTE Iron Condor
  - Watch Closely as an Action
  - missing Action inferred as Hold
  - fill cost substituted for a missing Mark
  - provider-performance analytics
  - nested or arbitrary grouping
  - custom date ranges
  - Future Insights in MVP
- Verify the canonical Strategy seed list and all seven Entry Type definitions.
- Verify the operation counts listed above.
- Verify build-facing specifications do not depend on Claude, GLM, or Ox Alpha names.
- Report any contradiction you discover rather than silently choosing.

## Working constraints

- Preserve the user-owned untracked `.codex/` and `AGENTS.md`.
- Do not inspect application code.
- Do not build or test application code.
- Do not select a technology stack.
- Do not create implementation tasks or tickets.
- Do not commit anything until the user explicitly approves the staged specification set.
- Do not use subagents.
- Ask only if you discover a genuinely consequential contradiction that cannot be resolved from the handoff.
- Otherwise work autonomously through the complete specification set.

## Completion report

When finished, provide:

1. A concise inventory of created files.
2. The material findings or clarifications exposed during extraction.
3. Verification results.
4. The uncommitted Git status.
5. A proposed commit message while waiting for explicit approval before committing.
