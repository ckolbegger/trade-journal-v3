---
name: deep-interface-design
description: Orchestrate the full deep-interface design process — from an agreed domain model to a committed set of module interface designs ready for implementation. Covers scope questions, functionality inventory, partitioning into a small number of deep modules (Ousterhout sense) with alternatives considered, the design overview doc with dependency rules, then per-module drill-down sessions with sequence-diagram audits. Use whenever the user wants to design the architecture or module structure of a system, partition functionality into interfaces or components, asks for "deep interfaces," mentions Ousterhout, or has finished domain modeling and asks what to build the design around — even if they don't name this process.
---

# Deep Interface Design

Take a project from "we know the domain" to "every module's interface is fully specified, decided, and committed" — before writing any code. The output is a set of design documents a fresh implementation session (or a different AI model) can build from without re-litigating decisions.

This is an orchestrator. It owns the partition phase and delegates the per-module work to two sibling skills in this collection — read each **at the moment its phase begins**, not before:

- `../codebase-design/SKILL.md` — the vocabulary and principles (deep/shallow, seam, adapter, deletion test). Read at the start of Phase 2.
- `../interface-drill-down/SKILL.md` — the per-module session procedure. Read at the start of Phase 4.
- `../sequence-diagram-interface-audit/SKILL.md` — the verification method used inside every drill-down.

## Phase 0 — Preconditions

Two artifacts must exist; without them the partition will be built on sand:

1. **A domain model**: a glossary of canonical terms (ubiquitous language) and the record of domain decisions (ADRs or equivalent). Every interface, operation, and type in this process must use glossary terms exactly.
2. **A statement of full-scope functionality**: goals, roadmap, or feature list covering everything the system will eventually do — not just the first release.

If either is missing, stop and do domain modeling first (a grilling-style interview that produces the glossary and decision records). Designing interfaces against fuzzy vocabulary produces fuzzy seams.

## Phase 1 — Ask the scope questions before thinking

Before any partitioning, ask the user the questions whose answers change the shape of the whole answer. Batch these (they are few and independent — unlike design questions later, which go one at a time). The recurring three, with the usual right answers:

1. **Design scope**: full roadmap or first release only? Recommend full roadmap — *shapes now, operations later*: releases should implement subsets of stable interfaces, never reshape seams. Designing only the first slice risks baking in shapes the later features break.
2. **Does the partition include UI-layer modules?** Recommend stopping at the domain seam: the UI is a consumer designed later per-feature; this process designs the seams that carry the testing strategy.
3. **Reactivity contract**: plain request/response, request/response plus change events, or subscribable queries? This decides whether every interface (and every test fake) must implement subscription semantics. Let the user choose; simpler is cheaper everywhere.

Add any project-specific question that is genuinely undetermined and consequential. Present each with a recommended answer and honest costs.

## Phase 2 — Partition (read `../codebase-design/SKILL.md` first)

Think hard here; this phase sets everything downstream.

**1. Inventory all functionality.** Sweep the domain docs, goals, and decisions into an explicit list: entities and their lifecycles, every calculation, every workflow/ritual, external integrations, persistence needs, app lifecycle (init, backup, settings). Missing functionality here becomes a missing module later.

**2. Generate 2–3 radically different candidate partitions** before choosing (design it twice). Typical candidates: per-entity repositories + service layer (usually shallow — logic smears homeless across services); one giant store + pure math (deep but a god interface with no locality); domain-area stores + pure calculation + thin coordinators (usually the winner, but make the losers argue first). Evaluate on depth (behavior per unit of interface), locality of change, and the deletion test.

**3. Establish the cross-cutting rules** — these have proven out repeatedly; adapt to the project rather than copying blindly, but deviate deliberately:

- **Stores hold facts; a pure module derives; coordinators join; the UI sees finished items.** Never store a derivation (status, net position, high-water marks) — stored derivations drift from their facts. Whatever cannot be derived must be *observed* (recorded as input) — that's the same rule's other half.
- **Pure calculation is its own module with no storage access.** Its parameter types *are* the data contract every store must serve — which is also why it gets drilled down first.
- **Storage is an internal seam.** Each store module is a *single implementation* of domain logic over an injected storage binding (in-memory for unit tests, realistic fake for integration, real for production). If the store itself had per-backend implementations, every business rule would be written N times.
- **A who-calls-whom matrix**, written down. It makes coordinator gaps visible: when a needed flow has no legal route, the finding is a missing coordinator, not a rule exception.

**4. Deliver the partition as a markdown table** — `Interface | Domain/functionality it abstracts | Estimated operations` — followed by: the load-bearing decisions baked into the table (with reasoning), the alternatives considered and rejected (so nobody re-proposes them in six months), open questions parked with the drill-down that will own each, and a recommended drill-down order (pure calculation first; then harvest modules whose contracts prior sessions pinned).

**Hold the table loosely.** The best partitions change during drill-downs — the origin session added a coordinator module mid-process when the user asked "whose job is that join?", and dissolving-then-recentering another module produced the design's best insight. Treat partition amendments as findings, not failures.

## Phase 3 — The overview document

Write `docs/design/overview.md` (or equivalent) capturing: the interaction rules from Phase 2, the module table, sketches of any coordinator interfaces, the who-calls-whom matrix, short interaction walkthroughs for the system's main flows, and a note that early releases implement operation subsets of these same shapes. This document is what every later session loads first — it must stand alone. Commit it (with the user's approval) before drilling down.

## Phase 4 — Drill-down loop (read `../interface-drill-down/SKILL.md` first)

One module per session, in the agreed order, following the drill-down skill exactly: import exported requirements, open with a full code sketch, state conventions with veto invitations, ask genuine questions one at a time, write the design doc, audit with sequence diagrams, sync the overview, commit on approval.

Between sessions, maintain the **export ledger**: requirements one drill-down discovers for another ("the price store's edit warning needs `tradesHolding()` from the trade store") are commitments the receiving session must import. The overview's open-questions list is the ledger's home.

Expect the user to defer some modules ("analytics waits until we've done visualization work") — record the deferral reason, not just the fact.

## Phase 5 — Closing the phase

When the last non-deferred module is designed:

1. **Retrospective**: list what the sequence-diagram audits exposed across all sessions — missing operations, unwritten rules, misplaced responsibilities. This is the evidence the process worked (or the warning it was skipped).
2. **Capture**: offer to record durable lessons (project memory, skill amendments) before context is lost.
3. **Hand over cleanly**: the committed docs are the handover. Implementation starts in a fresh session that reads the overview + the relevant module docs — it should need nothing from the design conversation itself.

## How to work with the human — this is half the method

The quality of the origin session came as much from the collaboration pattern as from the process. Follow these regardless of which AI model is executing:

- **The human is the domain expert; you are the design instrument.** Treat their pushback as design input to engage on the merits, not resistance to soothe — in the origin session the human's challenges produced the coordinator module, recentered an entire module on its true purpose, and corrected a subtly wrong derivation rule. Be willing to reverse committed decisions when their argument is better, and say so plainly when it is.
- **Recommend decisively, invite veto explicitly.** For every convention: state it, give the why, say "veto if wrong." For every genuine question: 2–4 options, recommended first, honest costs on *all* options including the recommended one.
- **One question at a time during design discussion.** Batching is only for the Phase 1 scope questions. A wall of questions gets shallow answers.
- **Worked numeric examples, always.** When a question depends on a scenario, build the scenario concretely with real numbers before asking. Shorthand the designer understands is not shorthand the owner understands.
- **No invented jargon.** If a term isn't in the project glossary or the owner's own vocabulary, translate it or define it inline before relying on it.
- **After every artifact, report what changed.** The owner will ask "did this expose anything?" — answer before being asked: findings by category, or an honest "no findings."
- **Commit cadence**: stage, show what's staged, propose a message, commit only on explicit approval, push only when asked. One logical unit per commit.
