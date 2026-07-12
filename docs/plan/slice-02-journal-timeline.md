# Slice 2 — Journal timeline & standalone entries

The journal becomes a first-class surface: the trader can write reflections not tied to any Trade, read the whole growth story on one timeline, and grow an immutable entry by addendum.

**Out of scope (JIT):** `timeline` takes no `filter` parameter yet — `TimelineFilter` is settled with Analytics ([journal.md](../design/journal.md) open item, Slice 15). Entry Type editing is Slice 13.

Design references: [journal.md](../design/journal.md), ADRs 0006, 0007.

---

## ☑ Story S2.1 — Standalone entries

> As a trader, I want to write a reflection that isn't about any one Trade, so that market observations and self-assessment have a home in my journal.

**Deep interfaces**: `Journal.write` with `{kind: 'standalone'}`; `Journal.entryTypes.list` (the picker); seeds: Entry Types **Trader Reflection** and **Review Note** (both undesignated — the trader picks them freely).

**Seed content — "Trader Reflection"**: What's on your mind? (text) · Current emotional state (select: calm / eager / anxious / FOMO / revenge) · Energy (scale 1–5). **"Review Note"**: Observation (text) · Follow-up needed? (select: yes / no).

### Tasks

- [x] **S2.1.T1 — Standalone anchor + seeds.**

  ```
  describe "Journal.write (standalone)"
  - it stores an entry anchored {kind:'standalone'} with no tradeId
  - it snapshots the chosen Entry Type's prompts as answered
  describe "seeding (extension)"
  - it seeds Trader Reflection and Review Note iff absent
  ```

- [x] **S2.1.T2 — New-entry UI.** A "Journal" nav destination with "New entry": pick an Entry Type from the full list, answer its prompts, save. No skip path — standalone writing is voluntary, so no placeholder exists here (Journal Debt is only for required lifecycle entries, ADR 0006).

  ```
  describe "NewEntryPage"
  - it lists all non-archived Entry Types in the picker
  - it renders the picked type's prompt widgets
  - it writes a standalone entry on save
  - it offers no skip/placeholder path
  ```

- [x] **S2.1.T3 — Integration tests**: seed → write a Trader Reflection over Dexie → reopen DB → entry present with snapshot, anchored standalone.
- [x] **S2.1.T4 — Playwright e2e** (`e2e/s2-1-standalone.spec.ts`): Journal → New entry → Trader Reflection → answer prompts → entry visible on the Journal page.
- [x] **S2.1.T5 — Browser verification.** Write one entry of each seeded type in a real browser; both render their distinct prompts; reload persists; no placeholder machinery appears anywhere in the flow. All suites green.

---

## ☑ Story S2.2 — The growth timeline

> As a trader, I want one chronological timeline of everything I've written — plan entries, reviews, closes, standalone reflections — so that I can read my growth as a trader as a single story.

**Deep interfaces**: `Journal.timeline(range?)` ([journal.md](../design/journal.md) — "the growth story"); renders mixed prompt shapes by construction (ADR 0007).

### Tasks

- [x] **S2.2.T1 — Journal.timeline.**

  ```
  describe "Journal.timeline"
  - it returns all entries across anchors in 'at' order
  - it includes standalone, plan, close, and review entries together
  - it respects a date range when given
  - it includes unsettled placeholders (owed is part of the story)
  - it returns entries of the same type with different prompt snapshots side by side (ADR 0007)
  ```

- [x] **S2.2.T2 — Timeline UI.** The Journal page becomes the timeline: each entry shows its date, Entry Type, anchor context ("Plan — AAPL", "Review — AAPL, Jul 3", "Standalone"), and its prompts-as-answered; trade-anchored entries link to their Trade detail; placeholders render as owed with a settle affordance (reusing S1.7's settle flow). A simple date-range control.

  ```
  describe "TimelinePage"
  - it renders entries newest-first with anchor labels
  - it links a trade-anchored entry to its Trade detail page
  - it renders two entries of one type with different snapshots correctly
  - it shows placeholders as owed and lets the trader settle inline
  - it narrows to the selected date range
  ```

- [x] **S2.2.T3 — Integration tests**: a seeded lifecycle (plan entry, review entry, close entry, standalone) over Dexie → timeline returns all four in order; range excludes correctly.
- [x] **S2.2.T4 — Playwright e2e** (`e2e/s2-2-timeline.spec.ts`): after a lifecycle + standalone entry, the timeline shows all entries in order; clicking a plan entry's Trade label lands on that Trade.
- [x] **S2.2.T5 — Browser verification.** With real data from earlier stories: timeline reads as one story; anchors label and link correctly; an owed placeholder settles inline and both timestamps show (late journaling visible). All suites green.

---

## ☐ Story S2.3 — Addenda: growing an immutable entry

> As a trader, I want to add to something I wrote earlier without editing it, so that hindsight becomes a visible layer on the record instead of a rewrite of it.

**Deep interfaces**: `Journal.write` with `{kind: 'entry', entryId}` — an addendum is an ordinary Entry anchored to its parent, no extra operation ([journal.md](../design/journal.md): "editing an entry is intentionally impossible").

**Decided in this slice**: an addendum's anchor also carries the parent's `tradeId` when the parent is trade-anchored (copied at write time) — this keeps `entriesFor({trade})` one indexed query, per the trade-detail requirement. Addenda can themselves receive addenda; rendering flattens the chain under the root entry.

### Tasks

- [ ] **S2.3.T1 — Addendum anchor.**

  ```
  describe "Journal.write (addendum)"
  - it stores an entry anchored {kind:'entry'} to its parent
  - it copies the parent's tradeId into the anchor when present
  - it rejects an addendum to a nonexistent entry
  describe "Journal.entriesFor with addenda"
  - it returns addenda on trade-anchored entries in entriesFor({trade})
  - it returns an addendum chain flattened under the root entry's context
  ```

- [ ] **S2.3.T2 — Addendum UI.** "Add addendum" on any displayed entry (timeline, trade detail); the form uses the parent's Entry Type by default with a free-text-only fallback type choice; rendered nested under the parent with its own timestamp. Entries themselves remain visibly uneditable (no edit affordance exists anywhere).

  ```
  describe "AddendumUI"
  - it opens the addendum form from an entry
  - it renders the addendum nested under its parent with its own date
  - it nests an addendum-to-an-addendum under the same root
  - it offers no edit affordance on any written entry
  ```

- [ ] **S2.3.T3 — Integration tests**: write entry → addendum → addendum-to-addendum over Dexie → reopen → `entriesFor({trade})` returns all three; timeline renders the chain under the root.
- [ ] **S2.3.T4 — Playwright e2e** (`e2e/s2-3-addendum.spec.ts`): add an addendum to a plan entry from Trade detail → appears nested there and on the timeline.
- [ ] **S2.3.T5 — Browser verification.** Add addenda from both surfaces in a real browser; nesting, timestamps, and links correct; confirm by inspection there is no path to alter a written answer. All suites green.
