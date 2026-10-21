# D1 fresh independent browser critic — attempt 01

**Decision: FAIL — one implementation copy defect in B03.** B01, B02, and the locally exercisable B04/B05 behavior passed. Safety gates, atomic abort, recovery reads/history, stopped-browser offline restart, staged update safety, keyboard operation, responsive state retention, and the independent scale spot-check passed. The missing Unsupported-screen recommendation below requires a regression, repair, cumulative verification, and a different fresh critic. This report does not certify deployment, OS installation, or native browser-chrome zoom.

## Provenance and independence

I read the complete handoff, worktree AGENTS.md, indexed frozen specification/contracts/glossary/ADRs/full acceptance and kickoff, complete D1–D6 plans, stack selection, and D1 roadmap boundary. Frozen spec tree `7ca277bffbe19d0ca3c24fc703817a95af54639d` and all four handoff SHA-256 values matched. Historical planning notices are superseded for D1 only by the authorized handoff. Backup D6 and Restore D17 remain absent under the explicit temporary exception.

I waited for PORT RELEASED, started `DEV_PORT=5174 npm run preview -- --host localhost` myself, and used my own Playwright-driven production UI actions in persistent native browser profiles. No existing automated suite was rerun or substituted for observation. No implementation/spec/plan files were edited. Native IndexedDB, service workers, Cache Storage, and built production assets were used throughout; no application response mocks were used.

Verified after the run using the repository source-snapshot recipe:

- Source SHA-256: `0985b99e60f7986eaf3693b2faf4388374534e6d060d8b385048414db5f2c6cd`.
- Base release: `12092e686a53550a45090f41eb805105c2335bd34c96c11abd040589bcee9421`.
- Update experiment release: `2ad2fc41972512c591897f5ff99331039030bb707667a883baf9061fae583684`.
- Base inventory file SHA-256: `a7aa1fa7e3eadd7365cf080e2df9fb9885de1e5c5691867185b6dcaf4ee5b403`.
- macOS 26.6.2, build 25G83, arm64; Node v26.12.0; npm 11.20.0; Playwright 1.64.0.
- WebKit 27.2 supplied writable UI evidence. Native fresh quota was 20,615,843,021 bytes; storage protection was Best Effort. `isSecureContext === true`, actual `sw.js` control, and digest-valid assets were observed on loopback.
- Independently launched Chromium 156.0.8078.4 and Firefox 157.0: native quotas 10,739,187,337 and 10,737,418,240 bytes respectively. Both correctly reported capacity Unsupported without initializing a Workspace. Quota was never raised and the approved budget was never lowered.

See [provenance.json](provenance.json), [other-hosts.json](other-hosts.json), and [server.log](server.log). [session.txt](session.txt) is the saved exploratory Node REPL command journal, including retries and investigation; it is not a one-shot test runner. It preserves exact UI actions and native fault-injection mechanics.

## Finding F01 — Unsupported does not recommend trying another browser

**Severity: P2; B03 FAIL.**

Reproduce with an uninitialized Chromium or Firefox native profile on the production preview. Their actual capacity is below required headroom. Alternatively, in a fresh WebKit profile lower only the native `StorageManager.estimate` result to quota 1, then reload. No application response is replaced.

Expected: Unsupported lists all failed readiness checks, offers safe retry, and recommends another browser, while explaining separate storage and unavailable backup/Restore honestly.

Actual: the screen shows the failed capacity reason and Retry startup. Its only different-browser text is:

> Another browser has separate storage and does not transfer this Workspace. Backup and Restore are not installed in this release.

This explains storage isolation but never recommends trying another browser. The user receives no clear alternative action when retry cannot cure native quota.

Frozen requirements:

- `specs/design/ui-contract.md`, Installation and Runtime Readiness: an Unsupported view “recommends another browser.”
- `specs/design/delivery-contract.md`, PWA identity/Runtime Readiness: it “recommends trying another browser.”
- `specs/acceptance/acceptance-contract.md`, AC-DEL-004: failed checks include “a recommendation to try another browser.”

Evidence: [Chromium screen](b03-chromium-native.png), [Firefox screen](b03-firefox-native.png), exact full text and native estimates in [other-hosts.json](other-hosts.json), fresh fault results in [b03-fresh-failures.json](b03-fresh-failures.json). No ambiguity or product decision is needed. I made no implementation change.

## B01 — onboarding, fixture P, saved reads and stopped-browser offline restart

**PASS.**

Actions: opened a fresh secure-loopback WebKit profile; explicitly entered America/New_York; created Fidelity Institution and Brokerage Account through the UI; opened New Plan; entered AAPL, 100 shares, intended entry 50, Stop 45, Target 60; answered Thesis and Invalidation once; selected Conviction 4 and Calm; explicitly confirmed. Opened Planned list, detail, and View history. Fully closed the browser process, relaunched the same profile with `offline: true` before navigation, and reopened the retained Plan/history.

Expected/observed: confirmation rendered Planned/Unfilled, no exposure, risk/1R $500, reward $1,000, exact ratio 2/1, intended management, one saved exact reflection, and distinguishable confirmation/save time, Recorded Sequence and Plan fact/version identities. The list contained the Plan with baseline/readiness. Offline startup freshly reached usable reads; authoritative version bytes matched the pre-stop snapshot. Diagnostic store had zero rows. No execution, valuation, report, general Journal composer, backup, or Restore action was advertised.

Evidence: [confirmed detail](b01-confirmed.png), [history](b01-history.png), [offline history](b01-offline.png), [durable snapshot](b01-durable.json), [offline comparison](b01-offline.json).

## B02 — invalid input, Cancel, stale references and actual aborted save

**PASS.**

Actions: attempted incomplete reflection and zero-risk Stop; corrected inputs; typed a Plan and canceled. In another actual UI tab created Charles Schwab while MSFT Plan was open, then confirmed the stale form. Reviewed current references without discarding the draft. For abort proof, intercepted native `IDBObjectStore.add` success for a real staged Plan and aborted that same actual IndexedDB transaction before Journal completion. Reloaded and compared durable state. Repeated keyboard-operated Cancel/conflict/reference-review/abort at both 390 and 1440.

Expected/observed: accessible issue text, focused error heading, no Plan/Entry/sequence/root/history mutation on invalid or canceled submissions; CatalogChanged explained the changed brokerage records, offered review, and retained draft values. Actual Plan-stage abort returned “Nothing was recorded” with safe input preserved. Full store/root snapshots and reopened authoritative versions remained unchanged. Removing a later cache fault and Retry startup allowed a corrected NVDA confirmation to succeed. Future controls stayed absent.

Evidence: [invalid](b02-invalid.png), [stale](b02-stale.png), [aborted](b02-aborted.png), [before/after actual abort](b02-failures.json), [keyboard results at both widths](b05-keyboard-b02.json).

## B03 — functional readiness, recovery, unreadable root and late invalidation

**FAIL only for F01 above; all tested safety behavior PASS.**

Native boundary cases:

| Case | Fresh result | Existing readable result | Observation |
|---|---|---|---|
| Diagnostic transaction | Unsupported | Recovery Only | Actual diagnostic put succeeded, then its native transaction was aborted |
| Capacity | Unsupported | Recovery Only | Native estimate lowered; no budget change |
| Worker control | Unsupported | Recovery Only | Native controller getter unavailable; actual worker/cache otherwise remained present |
| Inventory | Unsupported | Recovery Only | Actual cached icon removed (fresh), or bytes corrupted (existing) |
| Transaction + capacity | Unsupported, both reasons | Recovery Only, both reasons | Both failures reported together |
| Known root unreadable | Not a fresh case | IntegrityBlocked | Native roots read threw; no initialization/overwrite |

Fresh failures had zero roots and zero authoritative versions. Readable failures automatically displayed the Planned list; detail and history worked. Authoritative snapshots remained unchanged. The known-root case exposed no initialization/overwrite path and, after removing the read fault, exact prior root/version bytes were intact. All cases stated separate browser storage and the temporary absence of backup/Restore; no completed-backup claim appeared.

Best Effort warning remained visible during accepted writes. Explicit storage-protection request did not fabricate improvement or block normal writes. A later native diagnostic abort and later actual cache corruption each blocked an already-entered Plan at the next mutation, preserved inputs and wrote nothing. Restoring valid bytes and Retry startup recovered. Repeated actual launches were exercised throughout.

Evidence: [readable matrix and histories](b03-matrix.json), [fresh matrix](b03-fresh-failures.json), [late cache failure](b03-late-failure.json), [readable inventory failure](b03-inventory.png), [unreadable known root](b03-root.png), [simultaneous failures](b03-fresh-pair.png).

Disclosure: an initial broad `IDBDatabase.transaction` exception experiment also prevented subsequent reads in that connection and correctly yielded IntegrityBlocked; the independent transaction-only acceptance case was therefore repeated using an actual diagnostic transaction abort. The saved command journal preserves both attempts. Normal capability facts were never injected directly.

## B04 — identity, complete inventory and safe updates

**PASS for local applicable behavior. OS installation unavailable; production HTTPS explicitly deferred by user.**

Actions: independently hashed every cached inventory asset with browser SHA-256, compared lengths/digests, inspected stable manifest identity/name/icons/start URL/scope/standalone and the D1 Installed Capability Manifest. During an entered AMD Plan, backed up base dist and temporarily served the already-built second real release. Corrupted its JS bytes: staging rejected, no waiting worker/update notice, prior cache/control/draft remained. Restored the exact valid second asset: waiting release verified before Update available. Reload was disabled with explicit unsaved-form reason. Created IBM draft in a second real tab; after canceling the first draft, attempted activation: explicit close-other-tabs guidance retained old control and the other draft. Closed/canceled safely, then fully stopped/reopened offline: the verified second release was active, readiness/UI usable, and both saved Plans retained.

Expected/observed: all nine runtime inventory assets digest-valid; no background takeover or discarded draft; failed staging retained only the compatible base cache; valid staging preserved base and second caches; other-tab safety enforced; updated offline launch used second release with unchanged authoritative versions. One immediate post-click inspection preceded asynchronous activation, so [b04-update.json](b04-update.json) still reports the base active worker; [b04-updated-offline.json](b04-updated-offline.json) and screenshot independently prove the final second-release activation. No code update implied synchronization.

Base dist was restored exactly afterward, and its release/inventory digest reverified. No production deployment occurred. Headless WebKit exposed no actual OS installation UI; manifest and ordinary writable-tab proof do not substitute for OS installation. Secure loopback does not substitute for deferred production HTTPS.

Evidence: [inventory and manifest proof](b04-inventory.json), [failed staging](b04-failed-staging.png), [unsaved deferral](b04-unsaved-update.png), [other-tab protection](b04-other-tab.png), [updated offline](b04-updated-offline.png).

## B05 — keyboard, accessibility, responsive state and reflow

**PASS for local applicable interaction/rendering checks; native browser-chrome zoom is unverified.**

Actions: at both 390 and 1440 completed explicit time zone → real Institution/Account → invalid empty Plan → corrected Plan confirmation → history using only native Option-Tab, typing, arrows and Enter. No programmatic focus was used. Option-Tab follows this macOS WebKit host's all-control traversal preference; ordinary Tab is text-focused. Narrow flow selected Conviction and Calm using keyboard and radio arrows. Both widths also completed typed Cancel, stale Catalog/review, native Plan-stage abort, and restart no-write proof by keyboard.

Observed: logical reachable controls, visible 3px blue focus outline, focused “Review before continuing” heading after validation, native labeled input/select controls and fieldset/group with named radio states. Browser accessibility tree retained stable prompt names despite entered textarea values. Normal text/status did not depend on color alone. Screenshots were visually inspected. axe reported zero violations on narrow/wide detail/history, active form, Empty, and tested 200% rendering-zoom states. Measured focus indicator contrast was 5.43:1 on white and 4.94:1 on cream, above 3:1.

Live viewport sequence 1440→768→767→390→768→1440 preserved New Plan route, Account, all entered fields and validation with no horizontal document overflow. Sidebar/bottom navigation changed live at 768/767. Tests used no reload during resize.

Zoom method: applied the engine's actual CSS rendering zoom `document.documentElement.style.zoom = '2'` separately at 1440 and 390, inspected full-page rendering, reflow, native keyboard editing/focus, control access and no horizontal document overflow. This was additional to, not merely a viewport-resize substitute. Headless WebKit browser-chrome Command-plus shortcuts produced no zoom change, so native menu/browser-chrome zoom was not verified and is not claimed. CSS rendering-zoom evidence supports local reflow but does not close that host-level evidence limitation.

States: real native transaction lock held a list read pending and produced Loading; releasing it produced Ready. A native lifecycle-index read fault produced explicit Error and Retry list, without false Empty; reload recovered. A separately initialized real Workspace with Account and no Plans produced honest Empty. Conflict, validation, Recovery Only, Unsupported and IntegrityBlocked were inspected in the other flows.

Evidence: [keyboard narrow](b05-keyboard390.json), [keyboard wide](b05-keyboard1440.json), [keyboard B02](b05-keyboard-b02.json), [live resize](b05-resize.json), [accessibility tree](b05-accessibility-tree.txt), [200% method/results](b05-zoom200.json), [390 zoom screenshot](b05-zoom200-390.png), [1440 zoom screenshot](b05-zoom200-1440.png), [Loading](b05-loading.png), [Error](b05-error.png), [Empty](b05-empty.png), `b05-axe*.json`, [focus contrast](b05-focus-contrast.json).

## Independent target-scale spot-check

Opened the parent's preserved command-created native profile offline, without altering its facts or rerunning the benchmark. Independently counted 25,000 Plans, 25,000 Journal Entries, 25,000 lifecycle rows and 50,005 versions; all three supplied sample Trade IDs had Plan/Entry records and expected sequences 1, 12,501 and 25,000. UI first page contained 50 complete rows with baseline/readiness; navigated three Next 50 pages and opened another Plan's exact detail/reflection/history. The selected detail retained distinct 2025 Economic Time and 2026 Save Time. No Open Trades or future fact types were fabricated. This is an independent correctness/browsing spot-check, not a second latency benchmark or exhaustive pagination claim.

See [scale-spotcheck.json](scale-spotcheck.json), [first page](scale-first-page.png), [detail/history](scale-detail-history.png). The parent's benchmark timings remain separate evidence.

## Console, runtime and cleanup

The initial ordinary-flow console capture and final ordinary narrow/wide reload/form capture contained no console/page errors: [console.json](console.json), [console-final.json](console-final.json). Full-session console capture was not installed on every exploratory context, so no blanket clean-console claim is made for all injected-failure/update attempts. Their observable errors/status and screenshots are recorded above. Initial sandbox server/browser launch refusals were environmental; authorized escalated native processes supplied the run. The interrupted preview listener stopped between sessions and was restarted by this critic; cached/offline flows remained usable.

All owned browser contexts were closed, the saved REPL process exited, preview was stopped, base dist was restored, and port 5174 was checked with no listener. The report/evidence are the only retained critic changes. F01 remains outstanding; this attempt cannot be marked a passing fresh-critic gate.
