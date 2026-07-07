---
name: sequence-diagram-interface-audit
description: Audit a drafted module interface by drawing sequence diagrams of its key workflows, exposing missing operations, undefined types, and unwritten semantics before any code exists. Use whenever a module interface or API design is drafted or revised, when the user asks for a sequence diagram, asks "are we missing anything?" or "did this expose anything?", or before committing an interface design doc — and proactively offer it after drafting any interface, even if no diagram was requested.
---

# Sequence-Diagram Interface Audit

Draw the workflows an interface must serve, as sequence diagrams, *before writing any code* — and treat every awkward moment in the drawing as a design finding. The method works because a diagram forces concreteness an interface sketch can hide: every arrow must name a real operation on a real participant, every returned value must have a defined shape, and every "...and then somehow X happens" is a gap with a name.

An audit that finds nothing is fine (say so), but expect hits: in the session this skill was distilled from, ten diagrams exposed ten findings — missing operations (`lastMarked`, `requestPersistence`), an entity with no home (close reasons), undefined parameter types, unwritten dedup rules, and a module whose stated charter its own operations already violated.

## When to draw, and what

Apply the yield test to candidate workflows: **"would drawing this expose unwritten semantics?"** — not "is this flow important?" Simple one-call flows (export a file, archive an item) yield nothing; skip them and say why. These five flow types hide the most gaps, in rough order of yield:

1. **Initialization / cold start** — first run on an empty store. Exposes seeding rules, onboarding ordering constraints ("an Account must exist before any Trade"), permission requests nothing else triggers, and restore-vs-fresh branches.
2. **Correction / edit ripple** — the user fixes a past mistake. Exposes what re-derives, what re-runs, what must be annotated versus deleted, and status changes nobody considered (a correction that *reopens* a closed record).
3. **Unowned detection** — some real-world event that no user action reports. Ask "who notices X?" for every time-based or external fact (contract expirations, stale data, overdue items). If the answer is "nothing," that is the finding.
4. **Gap / late / missed scenarios** — the user skipped a day, arrived late, or did things out of order. Exposes backfill semantics, self-limiting versus nagging behavior, and derived-state recovery.
5. **The busiest composite page or session** — the screen or ritual that touches the most modules. Exposes coordinator gaps (who assembles the data?), consistency requirements (must all numbers come from one snapshot?), and per-item versus batch workflow decisions.

## How to draw

- **Participants are the actual modules of the design, plus the user and UI.** Honor the design's dependency rules while drawing — if the UI may not call a module directly, the diagram must route around it, and if there is no legal route, that is a finding (a coordinator is missing).
- **Every arrow names a real operation with its real arguments.** If the operation doesn't exist yet, or takes a type nobody has defined, stop and record the finding before continuing. Never draw a hand-wavy arrow to keep the diagram moving — the hand-wave is the gap.
- **Use Note blocks to state rulings, not narration.** A note should say something a future implementer could get wrong ("recording the Action IS what marks the Trade reviewed"), not describe what the arrow already shows.
- **Draw the instructive variant, not the happy path.** For a revision flow, draw the deviation-driven case; for corrections, the case that changes derived status. The easy case teaches nothing.
- **`alt`/`opt` blocks are for genuine branches the caller experiences** (skip vs. write, fresh vs. restore), not for error handling noise.

## Harvest — the audit is the point, the diagram is the instrument

After each diagram, answer explicitly: **"did drawing this expose anything that needs to change?"** Report findings by category, then apply them to the interface and design docs *in the same sitting*:

- **Missing operation** — an arrow had no operation to name
- **Undefined type** — an operation accepted or returned a shape that exists nowhere
- **Unwritten rule** — behavior both obvious-seeming and decidable multiple ways (dedup, ordering, who-annotates); write it into the design doc's decided-semantics section
- **Misplaced responsibility** — the flow only works if a module violates its charter or calls something it may not
- **Charter drift** — the module's stated purpose no longer matches what its operations actually do

If a finding needs a decision the user should make (not a derivable convention), ask before recording it. State derivable conventions with rationale and an explicit veto invitation.

A diagram that changes nothing is a legitimate outcome — report "no findings" honestly rather than inventing changes to justify the drawing.

## Where diagrams live

Put each diagram in the design doc of the module that *owns the flow*, not the module that triggered the drawing (a review session's diagram belongs to the review module even if it started as a pricing question). If a diagram outgrows its host — it now covers a whole session, not one module's step — move it to the right doc and leave a short pointer section behind naming the original module's touchpoints.

## Mermaid rules (GitHub renders these — learned the hard way)

- **No semicolons anywhere in Note or message text.** Mermaid treats `;` as a statement terminator even mid-note and the whole diagram silently fails to render. Before committing, verify:
  ```bash
  awk '/```mermaid/,/^```$/' <file>.md | grep -c ';'   # must print 0
  ```
- Use `<br/>` for line breaks inside notes and messages.
- Avoid `{ }` braces in message text (parenthesize instead) and keep participant counts readable (~9 max).
- `actor` for the human, `participant` with short aliases for modules; `->>' for calls, `-->>` for returns.
