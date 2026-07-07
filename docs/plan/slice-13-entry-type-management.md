# Slice 13 — Entry Type management

The journal's questions become the trader's own: edit any Entry Type's Prompts (including the Trade Review type's Action list), create new types, archive old ones, and re-designate which type each lifecycle moment uses — all safe by construction, because every written entry keeps the prompts it answered (ADR 0007; no migration, no version history).

Design references: ADR 0007, [journal.md](../design/journal.md) (whole-definition save; "Managing Entry Type structure"), [review.md](../design/review.md) (the Action list is just a prompt's options).

---

## ☐ Story S13.1 — Editing a type's Prompts

> As a trader, I want to change what my journal asks me — add a question, drop one, tune my Action list — so that my reflection practice can evolve faster than any app ships.

**Deep interfaces**: `Journal.entryTypes.save` as whole-definition replacement (no fine-grained prompt operations, by design); ADR 0007 drift tolerated by construction; the Action list = the Trade Review type's select options — editing it changes future checkpoints, zero review-code changes.

### Tasks

- [ ] **S13.1.T1 — Whole-definition save semantics.**

  ```
  describe "Journal.entryTypes.save (edit)"
  - it replaces the prompt list wholesale (add, remove, reorder, reword in one save)
  - it leaves every existing entry's snapshot untouched
  - it serves the new prompts to the next write of that type
  - it answers an unsettled placeholder with its ORIGINAL snapshot after the edit
  - it rejects a select prompt with no options and a scale without min/max
  describe "Action list (Trade Review type)"
  - it offers the edited Action options at the next review checkpoint
  - it leaves past review entries showing the Action they answered
  ```

- [ ] **S13.1.T2 — Editor UI.** A Journal settings section lists Entry Types; the editor edits name and prompts (kind-specific fields: options, scale bounds) and saves whole. Timeline and trade journals render old and new shapes side by side — visible proof of ADR 0007.

  ```
  describe "EntryTypeEditor"
  - it edits prompt text, kind, options, and order, saving whole
  - it adds an Action option ("Roll It") that appears at the next checkpoint
  - it shows no warning about existing entries (none is needed — they are safe)
  ```

- [ ] **S13.1.T3 — Integration tests**: write a Plan entry → add a conviction prompt to the Plan type → write another → both render their own shapes over Dexie reopen; a pre-edit placeholder settles against pre-edit questions.
- [ ] **S13.1.T4 — Playwright e2e** (`e2e/s13-1-edit-type.spec.ts`): add "Roll It" to the Action list → run a checkpoint → the new option is offered; the timeline shows an old review entry unchanged.
- [ ] **S13.1.T5 — Browser verification.** Real browser: edit the Plan type's prompts and the Action list; verify next-write uses new questions, history renders old answers under old questions, and a stale placeholder still asks its original questions. All suites green.

---

## ☐ Story S13.2 — New types, archiving & designation

> As a trader, I want to add my own kinds of entries and retire ones I've outgrown, so that the journal's structure is mine — without ever orphaning what I already wrote.

**Deep interfaces**: `entryTypes.save` (create), `entryTypes.archive` (never delete — entries reference types forever), `designatedFor` re-designation (which type each lifecycle moment uses; seeded Plan/Revision/Close/Trade Review are re-designatable, [journal.md](../design/journal.md)).

### Tasks

- [ ] **S13.2.T1 — Create, archive, designate.**

  ```
  describe "entryTypes (create)"
  - it saves a new custom type that appears in the standalone picker
  describe "entryTypes.archive"
  - it hides the archived type from pickers
  - it keeps rendering existing entries of the archived type by name
  - it never deletes the type record
  describe "designatedFor"
  - it re-designates a moment (plan) to a different type, used at the next confirm
  - it enforces at most one type designated per moment
  - it rejects archiving a type currently designated to a moment (re-designate first)
  ```

- [ ] **S13.2.T2 — UI.** "New Entry Type" in the editor; archive action with the designated-type guard explained; a designation control per lifecycle moment (plan / revision / close / review) listing eligible types.

  ```
  describe "TypeManagementUI"
  - it creates a type usable immediately for a standalone entry
  - it archives an undesignated type and hides it from pickers
  - it explains the guard when archiving a designated type
  - it re-designates 'plan' and the next confirm uses the new type
  ```

- [ ] **S13.2.T3 — Integration tests**: create → write with it → archive → over Dexie reopen the entry still renders; re-designated plan moment writes the new type on the next confirm while old plan entries keep the old.
- [ ] **S13.2.T4 — Playwright e2e** (`e2e/s13-2-manage-types.spec.ts`): create "Earnings Note" → write one → archive it → picker lacks it, timeline still shows the entry.
- [ ] **S13.2.T5 — Browser verification.** Real browser: full cycle — create, use, archive, re-designate a lifecycle moment, confirm a Trade against the new designation; verify nothing written ever changes shape. All suites green.
