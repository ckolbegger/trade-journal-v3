# Storage protection is advisory, not a write gate

Status: accepted, 2026-10-10. Amends [ADR 0008](0008-pwa-delivery-and-runtime-readiness.md).

ADR 0008 made host-confirmed persistent storage one of the Runtime Readiness checks, so the application refused every write until the browser confirmed that origin storage would not be cleared. Browsers grant that confirmation by their own heuristics, often without asking the trader, and may refuse it in an ordinary tab on first use. The gate could therefore block the application in a browser that passes every other functional check, while still offering no protection against device loss.

Host storage protection is now advisory. Every launch still asks the host and reports protection honestly as Protected, Best Effort, or Unavailable, but protection no longer decides `Writable`, `Recovery Only`, or `Unsupported`. Runtime Readiness gates writes on the four remaining checks: the isolated diagnostic transaction, capacity/headroom, service-worker control, and the complete Offline Release Inventory.

When protection is not Protected, the application keeps a visible warning that the browser may clear the data, offers `Workspace.requestDurability` where the host can request it and installation guidance where the host exposes installation, and recommends a backup. The warning never disables a control. A verified backup, not host persistence, is the protection against data loss.

Consequences:

- A `Writable` Workspace may live in best-effort storage; the trader is told so and is not blocked.
- `Workspace.requestDurability` keeps its result shape, but its result no longer contributes to Runtime Readiness.
- `Unsupported`, `Recovery Only`, Integrity Blocked, and `RuntimeNotWritable` semantics are unchanged for the remaining checks.
- Readiness evidence still records the protection state at every launch.
