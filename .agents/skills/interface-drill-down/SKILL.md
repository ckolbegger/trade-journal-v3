---
name: interface-drill-down
description: Run a structured design session that turns one module from a partition table into a fully specified deep interface — operations, types, decided semantics, sequence diagrams — captured as a committed design doc before any code exists. Use whenever the user wants to "define the X interface," "drill down" on a module, design an API for a component of an agreed architecture, or continue working through a module partition one interface at a time. Also use when a design overview exists but individual modules are still just table rows.
---

# Interface Drill-Down

Take one module from an agreed partition and drive it from a table row to a fully specified interface, in a single focused session, producing a committed design doc. The session's contract: every operation named and typed, every non-obvious behavior written down as a decided semantic, key workflows drawn as sequence diagrams, and dangling threads explicitly exported to the sessions that own them.

## Prerequisites

Two artifacts must exist before drilling into any module — without them the session degenerates into re-litigating architecture:

- A **domain glossary** (canonical terms; every operation and type name must use them)
- A **partition overview**: the module table, the dependency rules (who may call whom), and any cross-cutting principles (e.g., "stores hold facts, math derives, coordinators join")

If these are missing, run the domain-modeling/partitioning work first.

## Choosing the next module

- **Consumers before suppliers.** Design the pure-computation module first: its parameter types *are* the data contract every storage module must serve. Designing suppliers first risks storing the wrong shape.
- **Then harvest-first.** Prefer the module whose contract prior sessions have already pinned (its consumers exist, its serving shapes are decided) — half its design is already done, and finishing it may fully close a coordinator.
- Defer modules whose main consumer doesn't exist yet if the user prefers (e.g., analytics before visualization work) — record the deferral *reason*, not just the fact.

## The session

1. **Import the ledger.** Start by collecting every requirement previous drill-downs exported to this module ("needs `tradesHolding(instrument)` for the edit warning"). These are commitments, not suggestions.

2. **Open with the full sketch.** Present the complete interface in code — operations with signatures, the types they force into existence. A sketch invites specific objections; a list of topics invites vague ones. Scope the *shapes* to the full roadmap even when early slices implement a subset: later slices should add operations, never reshape seams.

3. **State conventions; ask only real questions.** Most decisions are derivable from established principles — state those as conventions with their rationale and an explicit veto invitation. Reserve questions for genuinely owner-decidable trade-offs, asked one at a time, 2–4 options each, recommended option first with honest costs on *all* options including the recommended one. When a question depends on a scenario, include a fully worked numeric example — shorthand the designer understands is not shorthand the owner understands.

4. **Fight for depth while sketching.** Fewer operations hiding more behavior: collapse repeated CRUD into one generic shape reused N times; prefer whole-document saves over fine-grained mutators when the edit is naturally whole (and immutable history makes replacement safe); leave operations out when an existing mechanism composes to cover the need. When a module feels thin, apply the deletion test — but check *what it would be deleted into* before dissolving it: a module that looks like pass-through plumbing may actually be mis-scoped around its least important duty (the session this skill comes from nearly dissolved the module that turned out to own the product's behavioral core).

5. **Write the design doc** using this structure:

   ```markdown
   # <Module> — initial interface design
   One-paragraph charter: what it owns, what it deliberately doesn't.
   ## Interface          — the code sketch, commented
   ## Decided semantics  — bulleted rulings with their why; cite ADRs/decisions
   ## Sequence: <flow>   — one section per instructive workflow
   ## Requirements fulfilled / exported — ledger entries closed here, and new ones sent to future sessions
   ## Open items         — deferred with the session that will own each
   ```

6. **Audit with diagrams.** Run the `sequence-diagram-interface-audit` skill against the drafted interface. Expect findings; apply them in the same sitting. After each diagram, report what it exposed — the owner will ask.

7. **Sync the partition overview.** Update the module's row (op count, link, charter wording — if the charter no longer matches the operations, fix the *charter*, that drift is a finding), the who-calls-whom table, and any walkthroughs the session changed.

8. **Commit per session.** Stage, show what's staged, propose a commit message, commit only on explicit approval. One session, one commit (plus follow-up commits for post-session diagram findings).

## Ripples are part of the session

A drill-down routinely amends *other* modules' docs — a new operation on a coordinator, a registry added to a store, a diagram relocated to the module that owns the flow. Make those edits immediately rather than exporting a note to fix them later; cross-doc consistency rots fast, and the diff reviewer needs to see the whole ripple in one commit.
