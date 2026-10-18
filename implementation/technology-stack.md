# Trade Journal V3 technology stack

Status: approved stack selection, 2026-10-10.

Implementation branch: `codex-gpt-6.1-sol`.

## Approval and scope

The trader approved the React/Vite/IndexedDB recommendation with decimal.js:

> I am fine with decimal.js. Please commit our technology stack selection using your React/Vite/IndexedDB recommendation

This decision completes technology-profile selection under the
[planning protocol](../specs/evaluation/planning-protocol.md). It is separate from
the frozen [product specification](../specs/README.md). It does not approve an
implementation task graph or authorize starting implementation before that plan
has been reviewed and frozen.

## Selected technologies

| Concern | Selection |
|---|---|
| Language | TypeScript `7.0.2` with strict checking; Microsoft TypeScript 6 compatibility alias for ESLint API access |
| Presentation | React, semantic HTML, CSS Modules, shared design tokens; accessible primitives where needed |
| Build and tooling | Vite, Node.js `26.12.0` from Homebrew, npm `11.20.0` with a committed lockfile |
| Architecture | The ten canonical module boundaries and plain asynchronous request/response contracts |
| Persistence | One device-local IndexedDB database accessed through Dexie |
| Financial arithmetic | decimal.js for Money, Price, Quantity, fees, P&L, and financial aggregates |
| Numeric representation | Decimal strings for storage and backup; native numbers for counts and presentation/chart coordinates |
| Time | `@js-temporal/polyfill`, explicit clock inputs, and a bundled, versioned U.S. trading-session calendar |
| PWA delivery | `vite-plugin-pwa` with `injectManifest` and an application-owned service worker |
| Backup format | Versioned JSON domain sections, canonical serialization, and SHA-256 integrity digests |
| Unit and integration testing | Vitest, Testing Library, and disclosed fake-indexeddb infrastructure for fast integration runs |
| Browser and accessibility testing | Playwright and axe, supplemented by actual-browser installation/offline evidence and independent browser critics |
| Hosting | Cloudflare Pages for static HTTPS application delivery |

On 2026-10-18, the trader selected their existing Homebrew Node.js `26.12.0`
installation instead of the planned Node.js `24.21.0` LTS runtime. Read-only local
checks confirmed `/opt/homebrew/bin/node` reports `v26.12.0` and
`/opt/homebrew/bin/npm` reports `11.20.0`. This explicitly replaces the earlier
LTS-only tooling choice; the [official release index](https://nodejs.org/dist/index.json)
currently classifies this exact Node release as Current (`lts: false`).

The [D1 dependency profile](plan/d01-long-stock-plan.md#typescript-7-and-eslint-compatibility--pins-finalized-2026-10-18) records matching Node types, exact lint pins and Microsoft's compiler/API aliases. D1-T01 creates their actual pin/config files, verifies compiler/API routing, and produces the lockfile and successful lint/typecheck/build evidence under these exact runtime/package-manager versions. No packages or application
scaffolding are introduced by this decision.

## Architectural application

Trade Record, Journal, Market Data, and Reference Catalog retain ownership of
authoritative facts. Trade Analysis and Performance Analysis remain pure modules
with explicit inputs. Trade Workflows, Daily Review, Trade Views and Reporting,
and Workspace coordinate complete use cases. React consumes their results and
does not duplicate domain arithmetic or orchestrate multi-module writes.

Dexie is used behind the internal Persistence/Transaction seam. A semantic command
uses one transaction spanning every participating table, rechecks optimistic
bindings, and returns its revision-bound post-commit state only after commit.
Provider calls, file access, and unrelated asynchronous preparation stay outside
the write transaction. Read assembly and full export require coherent snapshots.
Indexes and private projections remain rebuildable; stored Lifecycle State keeps
the specification's authoritative status.

The application service worker must implement the complete, versioned Offline
Release Inventory and digest verification, safe update staging and activation,
and stopped-application offline restart. The PWA plugin supplies build integration,
not automatic conformance. Runtime Readiness runs at every specified safety
boundary, with `RuntimeNotWritable` enforcement at the persistence seam. Storage
protection remains advisory.

Backup uses an ordinary file download followed by trader-selected file read-back
verification. Only a successfully verified artifact produces a
`CompletedBackupReceipt`. Restore validates an isolated candidate before atomic,
replace-only application; migrations must preserve prior data on failure. Secrets
are excluded. Hosted application assets do not imply hosted journal storage or
synchronization. A Pricing Provider remains optional and its adapter is a later
planning choice.

## Rationale and alternatives

React/Vite with Dexie uses browser-native transactional storage and keeps the
deployment small. It supports the required local-first application without an
application server. Fixed report families and bounded indexed reads make it a
reasonable starting point, subject to target-scale evidence.

SQLite WASM with OPFS was considered. Its SQL joins and constraints are useful,
but its runtime, worker coordination, filesystem locking, and adapter-specific
concurrency/hosting choices add complexity. It is not selected.

Fraction.js was considered for exact rational allocations. The trader preferred a
decimal numeric model, so decimal.js replaces that recommendation. Financial
classification and aggregation must not use native floating-point approximations
or presentation-rounded values. Conversion to native numbers is a presentation
boundary, not a source for later financial calculations.

## Required planning work and evidence

The approved implementation plan must still specify:

- Decimal input bounds, working precision, division and proportional-fee handling,
  conservation checks, and display rounding. Finite decimal precision does not
  make repeating division mathematically exact; this choice does not silently
  relax the canonical arithmetic or classification requirements.
- Calendar provenance, supported date coverage, time-zone behavior, holidays,
  early closes, and deterministic test clocks.
- Transaction boundaries, revisions, cross-tab conflicts, snapshot consistency,
  staged migration/Restore mechanics, and projection invalidation/reconstruction.
- Measured capacity requirements for the mature Workspace plus migration and
  backup headroom; functional readiness checks without browser/OS allowlists.
- Production HTTPS evidence and a browser-recognized secure loopback origin for
  local automation. Dev, preview, and browser tests use the worktree's `DEV_PORT`
  with strict port selection, as required by the repository README.
- Recorded per-behavior TDD, mock-free integration through the real application
  stack, actual IndexedDB browser verification, failure injection, offline
  restart, update safety, backup/Restore, responsive parity, and accessibility.
- Target-scale correctness and raw percentile evidence: 25,000 Trades, up to
  200 Open Trades, about 200,000 position-changing facts; cold startup p95 at most
  2,500 ms and warm open-list p95 at most 1,500 ms, without network dependency.
- A fresh independent browser-critic gate for each usable vertical deliverable,
  with test-first repairs and a complete acceptance-to-evidence matrix.

No technology in this selection proves atomicity, durability, exactness,
accessibility, or performance merely by being selected. Those guarantees must be
demonstrated by the implementation plan and its execution evidence.
