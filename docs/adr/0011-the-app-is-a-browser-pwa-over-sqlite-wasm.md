# The app is an installable browser PWA over SQLite-WASM (ADR 0011)

## Context

The domain design is complete and platform-neutral, but it constrains any
backend choice hard:

- **Rule 6 (overview): everything synchronous** — "every interface and every
  test fake is synchronous." Async-only storage APIs cannot live inside the
  domain seam.
- **OQ 9's transaction primitive**: closure-based, all-or-nothing — needing a
  genuinely transactional store, not hand-rolled file writes.
- **ADR 0006's "cheap indexed filter"** for `listTrades({status:'Open'})`,
  plus `getMarkSeries` keyed (instrument, date) and `listEntries` date-range
  reads — the seam owes real indexed/range queries.
- **Single user, local data, no live feeds** (CONTEXT out-of-scope), years of
  trades/fills/entries/marks — modest scale, real integrity requirements.

The deciding requirement, confirmed by the owner during the tech discussion:
the trader is **not super technical** and must be able to install and run the
app **on a laptop or phone** — and **the phone case is real and immediate**,
a first-release requirement, not a future one. That fact was not previously
recorded anywhere and it eliminates shapes that survive every technical
constraint above.

Four shapes were compared on install-ease for that persona:

- **Local web app** (Node process + SQLite + localhost UI) — a developer's
  install (Node, terminal, `npm start`); no phone story.
- **Desktop app** (Electron/Tauri) — easiest laptop-only install; no phone
  (or a second codebase later).
- **Browser-only PWA** — a URL plus "Add to Home Screen"; the only
  single-codebase answer for laptop *and* phone.
- **CLI first** — terminal app; wrong persona.

## Decision

**The app is an installable browser PWA. The domain runs, fully synchronous,
in a dedicated Web Worker backed by SQLite compiled to WASM over OPFS; the UI
talks to it by plain request/response worker messages. TypeScript is the
implementation language (the design docs' parameter and return types are
TS-adjacent; nothing else was ever implied).**

The worker message boundary is the system's **one async edge** between UI and
domain — the same count as every alternative shape (HTTP for the local web
app, IPC for Electron), not extra plumbing. Inside the worker, rule 6 holds
absolutely: every store, coordinator, and pure module call is synchronous,
and `StorageBinding.transaction` maps to a native SQLite transaction.

SQLite specifics: the official `sqlite3` WASM build with the OPFS
sync-access-handle VFS (`opfs-sahpool`) — no SharedArrayBuffer/COOP-COEP
requirement, works in Chrome/Edge and iOS Safari 15.2+. Hosting is static
(any static host); there is no server, no account, and the trader's data
stays on their device.

## Rationale

- The persona test is decisive and single-handedly: for a non-technical
  trader, "open a URL, Add to Home Screen" beats every install story, and it
  is the only shape where the phone is the same codebase, same data, same
  build — with the phone requirement immediate, not eventual.
- Every technical constraint is honored *more* directly than by the
  alternatives, not grudgingly: SQLite gives native transactions (OQ 9's
  primitive is a `BEGIN…COMMIT`, not an invention), real secondary indexes
  (ADR 0006's indexed-filter claim), and a single-file database (OQ 8's
  backup/export becomes "copy the file" *plus* the API-level import ops
  already designed).
- The daily-usage pattern fits: fills and the Daily Review are entered
  wherever the trader is; reports are read, not administered.

## Consequences

- **The first usable release targets both form factors** — the phone is not
  a later milestone; the PWA must be installable and correct on iOS Safari
  from the first release.
- **Backup/export is a day-one feature, not a nice-to-have.** Data lives in
  browser storage. On iOS, persistence requires a *properly installed*
  home-screen PWA (casual Safari visits risk storage eviction). The
  export/import path (OQ 8's `importTrade`/`importMark`/`importEntry` +
  verbatim restore) must ship with the first usable release and be prominent
  in the UI.
- The real `StorageBinding` implementation targets SQLite; the same schema
  runs under Node's SQLite for integration tests (rule 5's "realistic fake"
  tier maps to real-SQLite-in-Node), and the in-memory binding serves unit
  tests unchanged.
- **The shape is promotable without domain changes.** The schema is plain
  SQLite: wrapping the same domain worker in Electron/Tauri later (if the
  desktop-install story ever wins) is packaging work, not architecture work.
- The roadmap market-data fetcher runs on the page side of the worker
  boundary — async at the edge (network), then synchronous writes into the
  domain via the worker. Rule 6 governs the domain seam, not the UI
  transport.
- Rejected alternatives and their reasons are recorded above; the runner-up
  (desktop app) lost only on phone — with that requirement now confirmed
  immediate, the ranking is settled.
