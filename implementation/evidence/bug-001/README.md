# BUG-001 local implementation and verification

Completed local implementation and verification on 2026-10-25. **Independent visual
PASS, functional PASS, and final qualification PASS.** Approved live-tab activation
completed through the normal verified flow after both tabs reported no retained
drafts. No financial Save or Cancel was used. No user profile/data was used by
testing. Verification preceded commit/push authorization; see
[publication notes](publication-notes.md). No deployment.

## Result

All installed D1/D2 screens now use the calibrated compact shell/cards, staged
planning, contextual desktop drawers and narrow sheets. Drafts, rejected saves and
recorded Executions are explicit. Blank rows identify their missing fields; Close
retains input and errors; Cancel discards only view state; saved results appear
only after the real atomic command returns. Original fields, reflection semantics,
exact arithmetic, safety warnings and offline/readiness safeguards remain intact.

Independent review exposed and repaired three further presentation defects, each
with a real failing regression: missing Debt/decline outcomes in Trade Journal,
keyboard focus/scroll loss during Saving, and stale list responses overwriting a
new lifecycle selection. No domain command, calculation, schema or migration changed.

## Accepted candidate and evidence

- Source: `4f341c4308fbd1ee263c97a141975499a88f7248386be5e4cdd0af92a58d744c`.
- Production release: `4d8cb5fc0da7a335f886c3dd28c967baee50ea3987b0b5eea89117ebb98a6188`.
- Exact commands/exits, snapshots, all emitted-file digests and final status:
  [final-local-verification.json](final-local-verification.json).
- Independent acceptance: [critic05 report](critic-05/report.md), all15 main groups
  plus actual Workspace/twoAccounts/install help/empty-state supplement. It includes
  reference measurements,148 clean native axe scans, manual contrast, both shared
  conflicts, both held-Save keyboard checks, complete fault matrices, verified update
  activation and fully stopped offline equality for the recorded opening.
- Current original-reference pairs/overlays:
  [comparison index](visual/list-visual-gate-1792879965508/comparisons/sha256.json).
  Critic05 independently captured viewport modal comparisons and reviewed all screens.
  Licensed local fonts substitute for unknown prototype font identity; required D2
  fields/safety content explain documented height differences. No D3+ UI was added.

## Final qualification

All gates below certify the same source snapshot. Correctness gates already passed
on the accepted unchanged build; final scale qualification followed critic acceptance.

| Gate | Record | Result |
| --- | --- | --- |
| Lint | list-lint-gate.json |PASS |
| Typecheck | list-typecheck-gate.json |PASS |
| Production build/inventory | list-production-build.json |PASS;13 inventoried emitted assets plus inventory |
| Unit | list-unit-gate.json |121 PASS |
| Integration | list-integration-gate.json |7 PASS |
| Native Chromium/Firefox/WebKit | list-browser-gate.json |93 PASS |
| Native visual/accessibility | list-visual-gate.json |9 PASS;1440/814/390, boundary resize, rapid filters, held Save |
| Exact post-critic identity | post-critic-identity.json |PASS |
|25,000-Plan WebKit | qualification-d1-scale-gate.json |50 cold/50 warm;PASS |
| Historical migration +200 Open Chromium | qualification-d2-scale-gate.json |25,000 Plans retained,400 Executions,reconstruction,each phase50 cold/50 warm;PASS |

D1 p95 cold868.40ms/warm84.88ms. D2 Planned1863.50/129.22ms;
mixed-store startup1864.29ms/complete200-Open read535.99ms. Unchanged limits are
2500ms cold/1500ms warm. Migration16182.86ms; historical source digest and all25,000
members retained. Sampled used JS heap peak722884964 bytes is not RSS or a
low-memory-device guarantee. Raw records are linked in the final JSON.

## Repair provenance and revised cadence

Original T02 and later regression Red/Green records, failed attempts, fixture
attribution, calibrated baseline and earlier candidate identities remain in
[verification history](verification-history.md). In particular:

- `T12-decline-red.json` → `T12-decline-green.json`.
- `T12-busy-focus-red.json` → `T12-busy-focus-green.json` (native BODY focus loss;
  jsdom retained disabled Save focus; both violate the required modal focus invariant).
- `T12-latest-list-red.json` → `T12-latest-list-green.json` (actual query results
  with controlled scheduling; native race independently reproduced then retested).

Critic01 and05 account interruptions and all driver corrections are preserved,
without calling them product Reds or acceptance passes. Earlier critic02/03/04
findings/reports remain attributed to their original frozen candidates.

The trader approved focused iteration checks and fresh critic review before one
final scale qualification. [Policy revision](gate-policy-revision.json) binds that
authorization and the updated plan/handoff hashes. Thresholds, populations and
proof requirements remain unchanged. Cached dataset tooling was not introduced.

## Local handback and limits

The final production preview is restored separately and recorded in final JSON.
The trader explicitly approved live-tab access after the earlier automatic denial.
Both tabs reported a verified update with no retained drafts. The redundant clean
tab was closed, normal Reload to update completed, and the accepted asset bundle
finished startup verification. The existing Open Trade and recorded Execution
remain visible. No trading Save/Cancel, site-data clearing or reseeding occurred.
[live-update-receipt.json](live-update-receipt.json) records the action without
copying journal values into repository evidence; the confirmation screenshot is
outside the repository. Verified updates still defer while a draft remains.

OS PWA installation/standalone launch, native browser-chrome200% zoom and production
HTTPS remain unverified. CSS zoom is supplemental. HTTPS/deployment is trader-deferred.
