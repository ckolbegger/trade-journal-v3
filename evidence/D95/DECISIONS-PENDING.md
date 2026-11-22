# D9.5 pending decisions

## Q1 (T95.3): the saved Review views in four frozen fixtures name the old attention bands — asked 2026-11-22

**Plain words.** The Review now sorts Trades into the spec's new bands (Exit not carried out, Settlement due, Stop reached, Target reached, …). Four frozen test fixtures (`workspace-v6`, `workspace-v7`, `backup-v6-blocked`, `backup-v7`) keep a snapshot of what the Review returned when they were frozen. Those snapshots say "BoundaryReached" or "Blocker" (12 places), and with the new order two cards change places. Ten integration tests that compare against them fail (`d7/migration`, `d7s/migration` ×2, `d8/blocked`, `d8/round-trip` ×3, `d8r/restore` ×3). The stored data (`dump.json`, `backup.tjbackup`) is untouched. The plan (P174) lets a task change these snapshots only where a form's latest revision is named, so this needs your answer.

**Options.**
- (a) Regenerate the four `expected-views.json` files in a follow-on task (T95.3-D1), changing only the band values and the order they cause, with the diff recorded. Precedent: decision 117 removed `rangePosition` from eight fixtures' views the same way. Cost: a plan revision (decision 127, r116) amending P174.
- (b) Keep the old snapshots and translate new bands back to old names in the test tool. Rejected before (decision 78): the check would stop testing what the app returns.

**Recommendation:** (a).

**Answer (2026-11-22):** (a). Recorded as decision 127, plan revision 116; follow-on T95.3-D1. **Status:** answered 2026-11-22; T95.3 resumed.

**Previous status:** asked. Paused: T95.3 and the tasks blocked by it (T95.4, T95.10, T95.11, T95.16 onward through T95.3/T95.4/T95.10 chains, T95.22, T95.23). Other tasks continue; until the answer, complete runs carry these 10 known failures.

## Q2 (T95.3-D1): decision 127's scope, as measured — asked 2026-11-22

**Plain words.** Regenerating the saved Review views found (1) six fixtures fail, not four: `workspace-v5` and `backup-v5-blocked` too; (2) the KO Trade (`fx-0075`), which has an Exit saved at an earlier Review and is still open, becomes "Exit not carried out" (from Evidence limited) and moves to the front of the walk; its attention reason changes from "Mark missing for KO on <date>" (`code: Unavailable`, `reason: MarkMissing`, `instrument`, `date`) to `code: ExitNotCarriedOut`. Nothing else differs; `dump.json` and backups untouched.

**Options.** (a) Widen decision 127 to the six fixtures and KO's band and reason (an amendment note within revision 116). (b) Something narrower; none is sound, since KO is an Exit not carried out under the new rules.

**Recommendation:** (a). **Status:** asked. Paused: T95.3-D1 and T95.3's suite run, and the tasks blocked by T95.3.
