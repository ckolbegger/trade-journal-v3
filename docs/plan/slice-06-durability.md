# Slice 6 — Durability

The trader's data stops being hostage to one browser profile: versioned export to a file, replace-only restore from one, durable-storage request, and a review-time nudge when the last backup is stale.

**Decided in this slice (JIT):** `importAll` *validates* the file's schema version and rejects mismatches; the forward-migration machinery the design describes ([workspace.md](../design/workspace.md)) arrives with the first schema change that creates a second version to migrate — until one exists, migration code is untestable. The export file carries `schemaVersion` from day one so old files are migratable then.

**Cross-slice note:** if Slice 4 (pricing sources) is already complete, this slice adds the secrets-exclusion tests (API keys never exported; restored sources show needs-key). If not, Slice 4 adds them — noted there.

Design references: [workspace.md](../design/workspace.md), ADR 0011 (durability posture).

---

## ☐ Story S6.1 — Export & storage health

> As a trader, I want to download my entire journal as one file and see how safe my browser storage is, so that years of trading history can't vanish with a cleared cache.

**Deep interfaces**: `Workspace.exportAll` (reads raw stores, not Book interfaces — a faithful dump that can never fail on a domain rule), `Workspace.storageHealth`, `Workspace.requestPersistence` (`navigator.storage.persist()` — the UI picks this moment).

### Tasks

- [ ] **S6.1.T1 — exportAll + lastExportAt.**

  ```
  describe "Workspace.exportAll"
  - it produces one JSON blob containing every store's records
  - it stamps schemaVersion and exportedAt
  - it reads raw stores (a record invalid under current domain rules still exports)
  - it round-trips byte-faithful record content (deep-equal after parse)
  - it records lastExportAt as a fact
  - it excludes pricing-source API keys        [only if Slice 4 landed]
  ```

- [ ] **S6.1.T2 — storageHealth + requestPersistence.**

  ```
  describe "Workspace.storageHealth"
  - it reports persisted true/false from the storage manager
  - it reports usage and quota bytes
  - it reports lastExportAt, or absent when never exported
  describe "Workspace.requestPersistence"
  - it returns the browser's grant/deny verdict
  - it is reflected by storageHealth afterward
  ```

- [ ] **S6.1.T3 — UI.** Settings gains a **Backup** section: storage health (persisted?, usage, last export), a "Request durable storage" action shown until granted, and **Export backup** (downloads `trade-journal-YYYY-MM-DD.json`).

  ```
  describe "BackupSettings"
  - it shows health figures and last-export date
  - it triggers a download and updates lastExportAt
  - it hides the persistence request once granted
  ```

- [ ] **S6.1.T4 — Integration tests**: populated database over Dexie → export → parsed file contains the trades/entries/marks counts written; lastExportAt round-trips a reopen.
- [ ] **S6.1.T5 — Playwright e2e** (`e2e/s6-1-export.spec.ts`): populate → export → assert the downloaded file's counts and version.
- [ ] **S6.1.T6 — Browser verification.** Real browser: export real data, open the file, eyeball a Trade and an entry in it; storage health shows plausible numbers; persistence grant flips the health flag. All suites green.

---

## ☐ Story S6.2 — Restore from backup

> As a trader, I want to restore my journal from a backup file onto a fresh browser, so that a new machine or a wiped profile is a ten-second recovery, not a data loss.

**Deep interfaces**: `Workspace.importAll` (replace-only — a restore, not a merge; merging is sync territory, rejected in ADR 0001/0011), `ImportReport`.

### Tasks

- [ ] **S6.2.T1 — importAll.**

  ```
  describe "Workspace.importAll"
  - it replaces every store with the file's records (pre-existing data gone)
  - it reports per-store restored counts
  - it rejects a file with an unknown or newer schemaVersion, changing nothing
  - it rejects a non-export JSON file, changing nothing
  - it restores atomically (a failure mid-import leaves the prior data intact)
  - it leaves restored pricing sources as needs-key    [only if Slice 4 landed]
  ```

- [ ] **S6.2.T2 — Restore flow UI.** In Backup settings and on the onboarding screen ("returning trader with a backup file" — [workspace.md](../design/workspace.md) init sequence): pick file → confirmation states plainly that current data will be replaced → offers a safety export of current data first → restores → shows the ImportReport.

  ```
  describe "RestoreFlow"
  - it requires explicit confirmation naming the replacement
  - it offers a safety export before replacing
  - it shows restored counts on success
  - it shows the rejection reason and leaves data untouched on a bad file
  - it is reachable from onboarding on a fresh profile
  ```

- [ ] **S6.2.T3 — Integration tests**: export populated DB → wipe → import → every Book serves identical content (trades, entries, marks, settings sans secrets); import of a truncated file leaves the wiped DB empty and reports the reason.
- [ ] **S6.2.T4 — Playwright e2e** (`e2e/s6-2-restore.spec.ts`): populate → export → clear site data → onboarding → restore → the Trade list and journal match pre-wipe.
- [ ] **S6.2.T5 — Browser verification.** Full circle in a real browser: export, clear site data (DevTools), restore from onboarding, verify a Trade's numbers and a journal entry survived intact; verify a deliberate double-import doesn't duplicate anything (replace, not merge). All suites green.

---

## ☐ Story S6.3 — Backup nudge

> As a trader, I want my review to remind me when my last backup is getting old, so that staying protected takes no memory of my own.

**Deep interfaces**: `Settings.backupNudgeDays` (default 7), `storageHealth().lastExportAt` — the fact lives in Workspace, the nudge policy renders in the Review UI ([workspace.md](../design/workspace.md): same facts-vs-behavior split as everywhere).

### Tasks

- [ ] **S6.3.T1 — Nudge.**

  ```
  describe "Review start (backup nudge)"
  - it nudges when lastExportAt is older than backupNudgeDays
  - it nudges when no export has ever happened
  - it stays silent within the window
  - it links to the export action and clears after exporting
  - it never blocks the session (dismissable, same posture as Journal Debt)
  describe "Settings"
  - it round-trips backupNudgeDays
  ```

- [ ] **S6.3.T2 — Integration test**: stale lastExportAt over Dexie → agenda page model includes the nudge; fresh export clears it.
- [ ] **S6.3.T3 — Playwright e2e** (`e2e/s6-3-nudge.spec.ts`): stale state → nudge visible → export → nudge gone.
- [ ] **S6.3.T4 — Browser verification.** Real browser: set nudge days to 0, open Review — nudge appears; export; nudge gone; session never blocked. All suites green.
