# Technology stack decision

Status: approved by the user, 2026-10-10 (planning protocol Phase 2).
Branch: `claude-opus-5.5`. Local dev/preview port: `DEV_PORT=5175` from `.env.local`.

This records the stack chosen for implementing the frozen `specs/` baseline. It does not change any product semantics. Exact package versions are pinned in the implementation plan, each at a release at least two weeks old when the plan is frozen.

## Decision

Profile A: a TypeScript, React, and IndexedDB static PWA hosted on Cloudflare Pages.

| Concern | Choice |
|---|---|
| Language and build | TypeScript 7.0 (6.0 fallback if lint/type tooling is incompatible); Vite 8 static build with `strictPort` on `DEV_PORT` for dev and preview |
| UI | React 19; React Aria Components for accessible controls; React Router 7 in library mode; hand-drawn SVG charts with textual equivalents |
| Authoritative storage | Native IndexedDB through the thin `idb` 8 wrapper |
| Service worker | Hand-written, versioned service worker; no Workbox or `vite-plugin-pwa` |
| Exact arithmetic | Small in-house BigInt rational type; finite-decimal inputs stored as strings |
| Time and calendar | Temporal through `temporal-polyfill`; explicit injected clock; rule-based NYSE session policy |
| Untrusted input parsing | `zod` 4 for backup/Restore artifacts |
| Backup digests and compression | `@noble/hashes` (incremental SHA-256) and `fflate` (streaming gzip) for export; native `DecompressionStream` for reading (added 2026-10-17, decision 33) |
| Testing | Vitest 4.1 (unit and Node integration with disclosed `fake-indexeddb`); Playwright with Chromium, Firefox, and WebKit against the built app on the secure loopback origin; `@axe-core/playwright` |
| Hosting | Cloudflare Pages, a dedicated `*.pages.dev` HTTPS origin for this implementation |
| Pricing Provider | Marketdata.app as the initial adapter behind the Pricing Provider port; adapters are discovered at build time so another provider needs only a new adapter |

## How the stack meets the frozen contracts

### Semantic atomicity and snapshot reads

One IndexedDB `readwrite` transaction spans every module object store a semantic command touches, so it commits or aborts as a whole. IndexedDB auto-commits a transaction when control awaits anything other than its own requests. Coordinators therefore finish all preparation, analysis, and SubtleCrypto digests before opening the apply transaction, which matches the specification's prepare-then-apply protocol. A guard turns an early auto-commit into a loud failure instead of a partial write. Revision rechecks run inside the apply transaction.

Write transactions request `durability: 'strict'`. Chromium and Firefox honor that hint; WebKit behavior is confirmed by the planned kill-after-commit restart test on all three engines rather than assumed.

Multi-store reads use one `readonly` transaction for a consistent snapshot. A Workspace content revision in a metadata store, incremented by every write transaction, supplies the `WorkspaceSnapshotBinding`.

### Atomic replacement for Restore and migration

A candidate Workspace is built and validated in a separate database. A single write to a pointer record in a small root database activates it atomically. The prior database remains until activation succeeds, so a failure leaves it usable. The Web Locks API serializes migration and Restore across tabs. Ordinary multi-tab writes rely on the specification's optimistic revisions.

### PWA identity, Offline Release Inventory, and Runtime Readiness

A build step emits `inventory.json`: one immutable release identity plus every asset and its SHA-256 digest. The service worker caches and verifies the complete inventory before it installs. It never takes control from an active release and announces an update only after the new inventory is complete and digest-valid. The Web App Manifest supplies stable identity, name, icons, launch URL, scope, and `standalone` display.

Runtime Readiness runs on every launch, after update activation, and after Restore, using only functional checks:

1. an isolated write/read/delete transaction on a diagnostics store that leaves no authoritative fact;
2. capacity from `navigator.storage.estimate()` against a requirement derived from the measured size of the generated mature dataset plus migration and backup headroom (roughly three times the Workspace, finalized in the plan);
3. `navigator.serviceWorker.controller` bound to the current release;
4. recomputed digests of every cached inventory asset.

Storage protection is read with `navigator.storage.persisted()` and reported as advisory only, under ADR 0009. The persistence layer holds the current readiness state and refuses to begin any authoritative write transaction outside `Writable`, returning `RuntimeNotWritable`. A storage failure during a session drops it to `Recovery Only` immediately.

### Exact values, time, and calendar

Money, Price, and Quantity facts are finite decimals stored as strings. Derived values, such as proportional fee allocation and payoff zero crossings, stay exact BigInt rationals. Rounding happens only in presentation and never drives classification.

Workspace time zone and exchange-session arithmetic use Temporal (`temporal-polyfill`) for identical behavior across browsers, with the clock injected everywhere. U.S. sessions come from rule-based NYSE holidays plus an explicit table of one-off closures and early closes, versioned as the session policy. Dates outside the policy's coverage return an explicit diagnostic rather than a guess.

### Backup, verification, and migration

A backup is gzip-compressed canonical JSON, one value per line, with section and full-artifact SHA-256 digests, offered as an ordinary download. Export runs in a worker inside one read-only IndexedDB transaction, so it digests with `@noble/hashes` (incremental SHA-256) and compresses with `fflate`, both synchronous; verification and Restore stream the file through the native `DecompressionStream` (implementation plan, decision 33). Verification reads back the trader-selected file through standard file selection, then compares its full digest and source binding before issuing a `CompletedBackupReceipt`. Secrets and private projections are excluded. Schema versions migrate forward through the isolated candidate database described above.

### Scale and latency

Each Trade's record is stored as one document, with indexes on stored Lifecycle State and the bounded query dimensions. The Open list is one indexed query plus one batch load of at most about 200 records. Indexes and projections are rebuilt during Restore and migration. Playwright measures latency against a deterministic 25,000-Trade dataset loaded through a real Restore.

### Testing and evidence

Unit tests run in Vitest. Mock-free integration tests run the real application stack in Node, with `fake-indexeddb` disclosed as the behaviorally compatible substitute for browser-owned IndexedDB. Browser evidence (service worker, readiness, durability, offline restart, update, responsive layout, accessibility, and benchmarks) runs in Playwright on real Chromium, Firefox, and WebKit against the built app on `localhost:5175`. Each engine treats that origin as a secure context. Production HTTPS evidence comes separately from the Cloudflare Pages deployment.

## Hosting

Cloudflare Pages gives this implementation its own HTTPS origin, so its storage and service worker never share an origin with the other implementations in this repository. GitHub Pages was rejected because every branch would share `ckolbegger.github.io`. The user creates the Cloudflare account and project. Deployment uses `wrangler`.

## Alternatives considered

- **Profile B, React with SQLite WASM on OPFS.** It offers real SQL transactions, but it adds about 1 MB of WASM that must be compiled at every cold start, plus worker messaging. Its OPFS storage driver locks the database to one tab, and Node integration tests would have to use a different storage driver.
- **Profile C, Svelte 5 with IndexedDB.** Persistence is the same as Profile A. Its smaller UI runtime does not move the cold-start bottleneck, which is storage and readiness, and accessible controls would have to be hand-built.

## Deferred decisions

- **Pricing Provider details.** Marketdata.app was chosen on 2026-10-11 and is delivered in D11 of the implementation plan. Its browser callability (CORS with token authentication), end-of-day option closes, and integration-test arrangement are confirmed before D11's task breakdown.
- **Exact package versions** are pinned when the plan is frozen.
