# Tech debt register

Items the trader has explicitly deferred. Frozen `specs/` and frozen `plan/d*.md` files are not modified by these records. DEV-001 applies to any later verification.

---

## TD-001 — Review Mark actions and option Mark instrument are unclear to the trader

**Status:** Open — deferred by the trader on 2026-11-26 during D8aV V1 review.
**Raised by:** Trader, after the D8aV V1 underlying-Mark follow-up (`7798600b`).
**Severity:** Medium (usability / correctness-of-interpretation). No known data loss or wrong persisted fact.

### Observations
1. The trader asked what the two Review buttons do — `Record mark for review` and `Acknowledge for review` (`src/ui/App.tsx:1408–1409`) — and said the explanation was still not clear after it was given.
2. There is a second, differently labelled pair in the Open trade detail: `Record mark` / `Acknowledge unavailable` (`src/ui/App.tsx:1176–1177`). Both pairs call the same two intentions but the wording differs.
3. For an option trade, Review saves a Mark against the **underlying** (`AAPL`) at `src/ui/App.tsx:389`, while Complete Detail reads frames for the **option contract** (`AAPL 190Call 2026-12-18 x100`) at `src/ui/detail-controller.ts:52–53`. The V1 follow-up exposes the underlying value as `Underlying Mark: 90 on 2026-11-23` and a Price History `Underlying Mark` row, but the trader still found the model confusing.
4. The trader reported that after entering a Mark in Review and seeing it in Trade Detail, Review still appeared to show it missing. A deterministic replay of that exact sequence could not reproduce the literal symptom (`plan/d8av-v1-execution-record.md`); Review stayed `Available` after in-app navigation and full reload. The cause of that reported perception is therefore still unconfirmed and belongs in this item.

### Why it matters
- A trader can save an exact price without realising it is the underlying, not the Call Mark, and then read the `Call Mark — / Missing` row as a lost Mark.
- `AcknowledgeUnavailable` is not the same outcome as an exact Mark: it opens the Action gate but completes the day as `Complete with unavailable Marks`. The current labels do not convey that difference.
- Success and error text exists (`role="status"` / `role="alert"`), but the trader did not perceive it, so feedback placement or prominence may also need attention.

### Revisit guidance (not authorised work)
- Revisit with the V3 Daily Review fidelity task. The prototype's Marks card (`prototypes/review-coach-mockup/index.html:1024–1040, 1095–1106`) is the authority: an `Instrument / previous date / optional dates / today / Change` table with per-instrument rows, per-row feedback, Save Marks/Discard, and a "Can't get a price" flow. That structure can name the instrument on every row and remove the ambiguity.
- Decide and document whether Review should offer both an underlying Mark and a Call Mark for option trades, and which one the Daily Review gate consumes. Preserve P1 (exact Mark or acknowledgment required before Action Save), P2 completion wording, and the rule that advisory/derived figures never become facts.
- Align the labels used in Review and in the Open trade detail, and make the result of each action visible next to the control that produced it.
- Confirm or close the unreproduced "Review shows missing after re-entry" perception with the trader before assuming a code fix is needed; rule out a stale page.

### Acceptance when resolved
- The trader can state, from the UI alone, which instrument a saved Mark belongs to and why a Call Mark row can be empty while an Underlying Mark row is filled.
- The two actions are distinguishable by label and result without reading code.
- A fresh prototype-based critic verifies the revised Review against the Marks card and the P1/P2 rules.

### Related records
- `plan/d8av-v1-execution-record.md` — diagnosis, RED→GREEN follow-up, and the unreproduced symptom.
- `plan/d8av-v1-followup-critic-brief.md` — the four-path critic that passed after the follow-up.
- `src/domain/market-data.ts:58–136` — `resolveKey` precedence and the two intentions' validation rules.
