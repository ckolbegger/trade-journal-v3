# Standards-based PWA delivery and Runtime Readiness

Status: accepted; amended by [ADR 0009](0009-advisory-storage-protection.md) and [ADR 0010](0010-backup-download-verified-by-read-back.md).

Trade Journal V3 is delivered from a secure hosted origin as a standards-based Progressive Web Application (PWA). Its Web App Manifest provides stable application identity, icons, launch URL, navigation scope, and standalone presentation. A versioned service worker installs and verifies the complete Offline Release Inventory before that release can be treated as available for stopped-application offline restart. Installation is offered where the host exposes it; an ordinary browser tab remains usable when it passes the same Runtime Readiness gate.

Support is determined by functional capability checks, never a browser-name, browser-family, operating-system, or user-agent allowlist. Exact browser and operating-system versions remain part of evidence provenance, not a certification boundary.

Before any authoritative mutation, every application launch establishes Runtime Readiness by confirming:

- host-confirmed persistent storage;
- a successful isolated diagnostic transaction against the authoritative storage mechanism, leaving no authoritative fact;
- sufficient available capacity for the mature Workspace plus implementation-plan-derived migration and backup headroom;
- service-worker control by the intended installed release; and
- complete verified caching of that release's Offline Release Inventory.

The gate runs again after application update activation and Restore, and a later storage/runtime failure invalidates the current writable state immediately. Only `Writable` permits Workspace initialization, Restore application, or any domain/configuration mutation.

If readiness fails before readable data exists, the environment is `Unsupported`: the application explains each failed check, permits safe retry or a durability request where meaningful, recommends another browser, and writes no Workspace or imported data. If an existing Workspace remains readable, the application enters `Recovery Only`: normal reads and backup export remain available, but every authoritative mutation and Restore application is rejected. Only a positively confirmed artifact transfer produces a `CompletedBackupReceipt`; a failed or unconfirmable read or transfer never yields or displays a completed backup.

A known or possible existing storage root that cannot be read combines `Unsupported` Runtime Readiness with Integrity Blocked Workspace status. It is never treated as a fresh empty environment and cannot be initialized, imported over, or replaced by Restore.

A different browser has independent origin storage. The application must not imply that changing browsers transfers an existing Workspace; the trader uses a successfully created backup and Restore on a writable installation.

This decision narrows delivery technology while leaving framework, application architecture, persistence engine, cache tooling, and hosting provider open. It prevents a trader from accumulating the only copy of journal data in best-effort or otherwise unverified browser storage. The tradeoff is that a browser which can render the UI but cannot confirm every readiness condition is intentionally prevented from accepting writes.
