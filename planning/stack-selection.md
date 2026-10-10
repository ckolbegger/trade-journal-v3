# Stack selection

Status: profile A approved by the user on 2026-10-10. Implementation remains subject to a separately approved implementation plan.

Product baseline: `specs/` at Git revision `968bc2b`, including advisory storage protection (ADR 0009) and backup download verified by read-back (ADR 0010).

The checkout contains no application or dependency manifest. The choices below assume a new implementation within this worktree. They preserve the ten public module contracts and the frozen PWA requirement.

## Recommendation and alternatives

| Profile | Composition | Benefit for this product | Main cost or risk |
| --- | --- | --- | --- |
| A — selected | React, strict TypeScript, Vite, Dexie over IndexedDB | One language across UI, pure analysis, coordinators, persistence adapters, and tests; straightforward browser-local transactions and indexed selection | Referential integrity, revision checks, and report population assembly remain application responsibilities |
| B | Svelte, strict TypeScript, Vite, Dexie over IndexedDB | Compiled UI components with concise form/state code; the same storage and domain approach as A | Different UI conventions and component choices; it does not reduce the demanding accounting, audit, and delivery work |
| C | React, strict TypeScript, Vite, official SQLite WASM over OPFS | SQL constraints, joins, and indexes may simplify storage queries and integrity checks | A database worker, VFS selection, file locking, multi-tab behavior, and potentially additional hosting headers add infrastructure decisions |

A is my recommendation based on the frozen requirements, rather than a measured performance claim. The specification needs bounded indexed selection and deterministic calculations, but does not require SQL or a server. C becomes more compelling if a later prototype demonstrates that necessary IndexedDB queries cannot meet the required scale economically. B is a reasonable choice if the user prefers Svelte's UI authoring model.

[Svelte's documentation](https://svelte.dev/tutorial/svelte/welcome-to-svelte) describes its compiler-based component approach. [SQLite's persistence documentation](https://sqlite.org/wasm/doc/trunk/persistence.md) describes its OPFS implementations, worker requirements, and locking/concurrency tradeoffs. Exact requirements depend on the chosen VFS; cross-origin isolation is not a blanket requirement of every SQLite option.

## Supporting choices

These are the supporting defaults carried forward into implementation planning for A. Hosting and optional pricing-provider selection remain separate decisions. Exact dependency versions will be recorded at plan freeze. B shares these defaults except for React-specific UI components. C replaces Dexie and its test infrastructure with SQLite and real OPFS browser evidence.

| Concern | Proposed choice |
| --- | --- |
| UI | React with CSS Modules, shared CSS variables, semantic HTML, and Radix primitives only where they solve a concrete accessibility need such as dialogs |
| Application boundaries | Plain TypeScript request/response interfaces; four fact modules, two pure analysis modules, and four coordinators; UI consumes finished results |
| Persistence | One local IndexedDB database through Dexie, with coordinated transactions covering every participating store |
| Exact arithmetic | Fraction.js behind a small domain numeric boundary; parse decimal inputs as strings, retain exact BigInt rational values for calculation and classification, serialize exact values losslessly |
| Time | Explicit injected observation instants and Workspace time zone; Temporal with a pinned polyfill; a separate versioned U.S. session calendar with holiday, early-close, and exceptional-closure fixtures |
| Input validation | Zod for untrusted commands and backup envelopes; domain modules retain semantic validation and aggregate expected issues |
| PWA | Vite PWA plugin in `injectManifest` mode, a custom TypeScript service worker, an explicit asset/digest inventory, and prompted safe update activation |
| Backup | Versioned portable JSON representation, stable digest serialization, browser file download, then ordinary file selection and read-back verification; secrets excluded |
| Tests | Vitest for unit/TDD work; real-browser integration tests using actual IndexedDB; Playwright against the built production UI; accessibility automation plus keyboard/manual verification |
| Hosting | Static HTTPS hosting, provisionally Cloudflare Pages, with explicit asset/cache/security headers and stable production-origin identity |
| Dependency management | npm and a committed lockfile; stable releases with exact compatible versions recorded when the implementation plan is frozen |

[Fraction.js](https://github.com/rawify/Fraction.js) uses BigInt numerator/denominator representations. Exact proportional fee allocations and repeating ratios can therefore remain exact until display. Financial classifications never use a rounded display number. [Radix](https://www.radix-ui.com/primitives/docs/overview/accessibility) supplies accessibility behavior, but our labels, contrast, layout, and workflow focus still require verification.

No server is required for journal storage or calculation. Pricing-provider selection is a separate optional integration decision. Its CORS and credential constraints must be verified before declaring that adapter; all manual workflows must remain independent of it. A stateless provider relay, if later necessary, would require a separate decision and cannot become hosted journal storage.

## Fit against the frozen contracts

### Transactions, snapshots, and revisions

For A and B, every semantic mutation uses one transaction over all participating stores in the same database. It rechecks readiness and optimistic bindings, writes facts and related outcomes, and returns the assembled result only after commit. No provider fetch, file operation, worker round trip, or asynchronous hashing belongs inside the live transaction. A consistent read loads its required inputs under a scoped read transaction; pure analysis then operates on those inputs.

[Dexie's transaction contract](https://dexie.org/docs/Dexie/Dexie.transaction()) resolves its promise after commit and warns that unrelated asynchronous waits can cause IndexedDB auto-commit. It provides a mechanism, not proof of our semantic atomicity. C uses explicit SQL transactions and the same coordinator/result rules. All profiles require rollback, stale-revision, interrupted-write, restart, and concurrent-surface evidence.

### Offline release and Runtime Readiness

All profiles deliver a Web App Manifest and complete versioned offline assets from HTTPS. Local browser automation uses the worktree's loopback origin on port 5174 only after confirming that the tested browser treats it as a secure context. Separate production HTTPS and installation evidence remains required.

The service worker stages a release, verifies cached asset bytes against the inventory, and exposes release readiness. Activation waits for a safe reload/restart. The application reruns its four readiness checks on launch and after update/Restore: diagnostic transaction, capacity/headroom, intended worker control, and complete digest-valid inventory. The persistence boundary rejects authoritative writes outside `Writable`. Storage protection is reported and warned about independently.

[Vite PWA's custom-worker mode](https://vite-pwa-org.netlify.app/guide/inject-manifest) supplies build integration. Its default revision manifest is not sufficient evidence that our complete inventory is present and digest-valid. Automatic takeover and premature deletion of a prior compatible release would violate the product contract. These behaviors require explicit implementation and failure evidence in every profile.

### Migration, backup, and Restore

All profiles validate migrations and restored data in an isolated candidate, preserve stable identities and audit versions, and activate the entire replacement atomically after rechecking the live target. A portable domain artifact is independent of the physical database and excludes credentials and private acceleration.

Export captures one coherent snapshot, hashes the complete artifact, and offers a download. Verification reads the trader-selected saved file and checks its completeness, digest, and source binding. Only verification yields the completed receipt. Restore requires an exact-target receipt or explicit decline of the safety backup, as well as replacement confirmation. Recovery-only reads, export, and verification remain usable.

Neither SQL migration tooling nor Dexie schema upgrades automatically establishes these domain guarantees. The approved plan must map concrete failure, round-trip, interrupted replacement, and rebuild-equivalence tests.

### Scale and capacity

All profiles use authoritative lifecycle membership and bounded batch reads for the Open list. They retain narrow factual indexes and rebuildable projections only where needed. A and B assemble report populations explicitly; C can use SQL to select those populations, while Trade Analysis still owns the arithmetic.

The plan must derive storage headroom from a representative 25,000-Trade/200,000-fact dataset, including migration candidates, backup construction, and peak temporary allocations. It must benchmark cold startup p95 <= 2,500 ms and warm complete Open-list navigation p95 <= 1,500 ms, without network or all-history replay. Heavy calculations may move to a worker if measurements justify it. None of these targets has yet been demonstrated for any profile.

### Verification, maintenance, and cost

All profiles require per-behavior red/green evidence, cumulative integration tests, and a fresh independent browser critic for every vertical deliverable. Integration tests traverse production module paths and actual browser storage. Fast test substitutes may supplement these checks but cannot certify the browser's durability, service worker, or recovery behavior.

[Vitest Browser Mode](https://vitest.dev/guide/browser/) supports Playwright-backed browser execution. Playwright's service-worker instrumentation is Chromium-specific according to its [service-worker documentation](https://playwright.dev/docs/service-workers), so the plan must distinguish automation API coverage from page-observable behavior and obtain appropriate real-browser evidence for other hosts. Test browsers are evidence provenance, never an application allowlist.

TypeScript module contracts and portable backups reduce dependence on a particular UI or storage library. All three profiles have a static application deployment with no mandatory database server or recurring compute service. Hosting terms and any pricing-provider charges remain separate choices. Cloudflare Pages is provisional; its [static header configuration](https://developers.cloudflare.com/pages/configuration/headers/) allows explicit deployment headers. No paid service or deployment has been selected or created.

## Recorded decision and next step

The user selected profile A on 2026-10-10: React + strict TypeScript + Vite + Dexie/IndexedDB. The next planning step is to draft dependency-ordered vertical deliverables and map every acceptance scenario to implementation and verification evidence, resolving consequential remaining choices during review. The implementation plan requires separate approval before scaffolding or feature implementation. No packages or application scaffolding have been installed.
