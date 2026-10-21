# Independent D1 browser critic 05

Result: **local B01–B05 functional checks pass**, with the explicit evidence limitations below. No new defect in the final capacity-policy release was found. This is local verification, not production HTTPS or OS-install certification.

Worktree: `/Users/ckolbegger/src/trade-journal-v3/worktrees/codex-gpt-6.1-sol`, branch `codex-gpt-6.1-sol`. Reviewed source supplied by root: `564da40305d97f30220c30934108df6f446c8148b81aec8cb937389a1b0996f6`. Base release: `0df453b26465fd0b7da9c2cdeb6f48331b793ef8e6e285d12422f0239924c261`. Four handoff hashes match; frozen specs tree `7ca277bffbe19d0ca3c24fc703817a95af54639d` has no diff. Complete intake and scope are recorded in `intake.txt` and `baseline-hashes.txt`.

The user-authorized `d01-capacity-policy-revision.md` governs capacity: installed M=543,817,728 bytes, H=(max(0,M−L)+C)×1.25. The historical 16GB floor was not enforced as an acceptance expectation. No native quota was raised or fabricated to obtain Writable. Low/missing estimates were injected only for negative cases.

## Environment and method

macOS 26.6.2 (25G83), Node 26.12.0. Primary host: installed Google Chrome channel, **155.0.8059.85**, Playwright persistent isolated profiles under `/private/tmp/critic05-*`. Normal primary checks ran headless; one separate headed isolated profile was opened solely to assess whether safe native UI proof was possible. Initial native Chrome quota was 10,739,186,928 bytes with 1,768,688 bytes usage; `isSecureContext=true`, actual worker control, Best Effort protection. Final quota/usage observation is retained separately; native estimates may vary. `native-chrome.txt`, `native-chrome-final.txt`, `os.txt` preserve provenance.

I started my own strict `DEV_PORT=5174 npm run preview -- --host localhost --port 5174 --strictPort` against production assets. Initial sandbox listen/browser-launch denial was resolved with authorized escalation. Native IndexedDB, worker, Cache Storage, and browser APIs were used. No application result mocks, domain command substitutes, fixture facts inserted directly into IndexedDB, earlier critic scripts/results, or cumulative test-suite reuse supplied these browser results. All normal authoritative creation used production UI. Own profiles were copied only while closed for independent native failure cases.

Faults were disclosed infrastructure replacements: actual transaction abort on native diagnostic/Plan/Journal object-store requests; low or unavailable native storage-estimate response; absent controller getter; actual deletion of a cached CSS asset; native root-read exception; denied persisted/persist response; delayed native estimate for Loading; native lifecycle-index cursor exception for Error. Scripts are preserved as `script-critic05-*.txt`; executable originals remained in `/private/tmp`.

## B01 — onboarding, retained Plan, history, stopped offline

**PASS.** Actions: choose America/New_York; create Charles Schwab and Critic taxable through UI; confirm AAPL Long Stock, 100 shares, intended entry 50, Stop 45, Target 60; enter Thesis/Invalidation once; select Conviction 4 and Calm. Expected: one immutable Planned Trade and completed Reflection, risk/1R $500, reward $1,000, ratio 2/1, no exposure or future navigation. Observed exactly that in confirmation result, list, detail and expanded history. Economic Time and Save Time are distinct; Recorded Sequence, fact/version identities, prompt/response snapshots, Anchor and Source are retained.

Closed the complete persistent browser context/process, launched the same profile with offline mode enabled **before navigation**, reopened list/detail/history and compared the full serialized roots, versions and authoritative lifecycle tables byte-for-byte with the saved online snapshot. Equal. Native readiness succeeded offline and normal installed controls remained available.

Evidence: `b01-first.*`, `b01-confirmed.*`, `b01-list.*`, `b01-detail.*`, `b01-authoritative.txt`, `b01-stopped-offline.*`. The authority snapshot includes every version, current lifecycle/index row, sequence and Workspace binding, not just Trade counts.

## B02 — invalid, correction, cancellation, conflict, rollback

**PASS.** Actions/expected/observed:

- Submit zero-risk Stop and missing Thesis: visible typed validation; complete authoritative state unchanged.
- Correct both: MSFT Plan confirms, with proper $500/$1,000 baseline.
- Type a separate Plan and Cancel: no authoritative mutation.
- Keep a Plan form open; another app tab saves a real additional Institution; Confirm the stale form: conflict, no mutation, entered symbol retained; Review current references works.
- Abort the actual native transaction on the Plan participant, then independently on JournalEntry after Plan staging: no participant, lifecycle row, root revision or sequence commits; error explains no save and preserves input; Retry startup restores safe operation and still preserves the draft. Both failure cases compare full authoritative serialized bytes.

Evidence: `b02-invalid.*`, `b02-corrected.*`, `b02-cancel.*`, `b02-stale.*`, `b02-abortPlan.*`, `b02-abortJournal.*`, `b02-summary.txt`, own B02 scripts/assertions. `b03-*-bytes.txt` additionally preserves complete post-B02 existing-profile authority snapshots; all failure-matrix reopen proofs retain that same state. Expected-failure scripts use full roots/versions/lifecycle comparisons, including full history and bindings.

## B03 — fail-closed readiness and recovery

**PASS.** Thirteen independent native-profile cases: fresh and existing diagnostic transaction, insufficient capacity, missing controller and damaged actual inventory; fresh and existing simultaneous transaction+capacity; fresh and existing unavailable estimate; existing unreadable known root. All individual failures were named; both simultaneous failures were visible. Fresh cases were Unsupported and had no Workspace/default/fact initialization. Existing readable cases were Recovery Only with New Plan disabled and list/detail/history available. The unreadable case was IntegrityBlocked, never fresh initialization or overwrite. Every case preserved full authoritative bytes, including after a subsequently fully stopped process reopen. Another-browser separate-storage guidance and honest pre-D6 backup/Restore absence were present.

Best Effort was accepted during real onboarding/Plan writes. Explicit host durability denial changed no authoritative byte and left New Plan enabled. A later capacity failure during an already open Plan rejected Confirm, preserved all bytes, entered Recovery Only, and Retry startup preserved input and restored the writable path.

Evidence: `b03-matrix.txt` (each case actions/state/issues), `b03-*-bytes.txt` (complete before/after authority), `b03-reopened-authoritative.txt` (all thirteen process-reopen comparisons), `b03-*-history.*`, `b03-denied-durability.*`, `b03-late.*`, `b03-retry.*`.

## B04 — complete inventories, old-policy upgrade, real update safety

**PASS local update behavior; native installation/production HTTPS are not proven.** Inspected stable manifest identity `/`, start URL `/`, scope `/`, standalone request and real 192/512/SVG icons. Independently hashed every inventory asset from actual Cache Storage, checking exact byte lengths and SHA-256; the base inventory has nine assets including worker and HTML. No asset was silently omitted.

Served preserved `.cache/capacity-before-dist` to a fresh own Chrome profile. Native quota produced old-policy Unsupported. Restored final base, allowed normal registration/update polling and retained native DB/caches. Explicitly closing all old application clients let the new verified worker activate; reopening reached new-policy writable time-zone selection, with old and new valid release caches still present and no data/cache clearing.

**Upgrade transition observation:** stopping the entire old-policy process before the last-client worker transition completed briefly reopened a blank page. Console showed old JS fetched as HTML/MIME failure while old controller and new waiting worker coexisted. Explicitly closing every app page, allowing worker activation, and reopening recovered to the new policy without clearing anything. This observation belongs to the preserved old release and is retained in `b04-upgrade-observed.*`, `b04-upgrade-reload.*`, `b04-upgrade-allclients-closed.*`; it is not concealed as a clean first-restart upgrade. The requested close-all-clients activation route succeeded. No corresponding blank restart occurred for the final base or second new-policy release.

Second actual build `.cache/update-dist`: while a Plan had unsaved values, deliberately damaged the served new CSS bytes. Failed digest staging produced no update notice; old controller/form/full Workspace remained safe. Restored exact second build; complete verified inventory preceded update notice. Reload was disabled with dirty form and the symbol persisted. After Cancel, a second open app tab blocked activation with a clear message. Closed that tab; explicit Reload safely activated, reran readiness, preserved full authority, and the updated release reopened after fully stopped Chrome with network disabled. Exact base dist was then restored.

Evidence: `b04-inventory.txt`, `b04-old-policy-unsupported.*`, `b04-old-policy-native.txt`, `b04-old-policy-staged.txt`, `b04-upgrade-inventory.txt`, `b04-failed-staging.*`, `b04-dirty-deferred.*`, `b04-other-tab-guard.*`, `b04-safe-activated.*`, `b04-second-release-inventory.txt`, `b04-final-inventory.txt`, `b04-updated-stopped-offline.*`, manifest in `native-chrome-final.txt`.

## B05 — keyboard, responsive parity, semantics and contrast

**PASS tested local behavior; actual native browser zoom remains unverified.** Completed onboarding, real references, invalid then corrected Plan, detail/history, list and typed-form Cancel using only native Chromium Tab/Enter and keyboard typing at **390 and 1440 px**. No programmatic focus was used to drive these workflows. Recorded actual focused element names/tags/outline in `b05-keyboard-trace.txt`; validation moves focus to a clear error heading. Radio/fieldset names and available states were inspected in accessibility snapshots.

Live transitions 767→768→original width retained symbol, validation and workflow, switching bottom-row/left-column navigation as expected. Separate CSS zoom=2 supplemental checks at 390 and 1440 preserved form actions/information; measured individual action bounds and visible text ranges were within the viewport, with no horizontal document overflow. CSS zoom is explicitly **not native browser-chrome zoom proof**.

Twenty-four independent axe runs reported zero violations, including contrast checks, on timezone, Empty, validation, list/detail, Recovery Only, Unsupported, IntegrityBlocked, Loading, Error/retry, conflict and update states, plus selected CSS200 variants. Captured each accessibility tree. Manual inspection of reflow screenshots confirmed content hierarchy, readable status/error text, visible focus and non-color recovery/validation meaning. Native select selections expose their full accessible text even when the native collapsed picker cannot visually wrap a long value.

Evidence: `b05-390-*`, `b05-1440-*`, `b05-*-axe.txt`, `b05-*-tree.txt`, `b05-*-bounds.txt`, `b05-css200-*`, live-resize and keyboard traces. Loading used a delayed actual host estimate; Error used a native index-read failure and recovered through Retry list with authority unchanged.

## Supplemental hosts

**PASS startup/readiness/resource observations only**, not a replacement for primary Chrome flows. Bundled Firefox UA 157.0, quota 10,737,418,240 bytes, Best Effort; bundled WebKit UA Safari 27.2, quota 20,615,843,021 bytes, Best Effort. Both at unmodified native quota, secure context, actual worker control, writable time-zone selection and complete digest-valid native inventories. Evidence: `firefox-native.txt`, `webkit-native.txt`, respective startup screenshots/text and inventory receipts. Browser identities were provenance, never support decisions.

## Evidence limits and cleanup

- Actual OS installation/installed launch and native Chrome 200% browser-chrome zoom are **not proven**. The available CUA Chrome app binding selected an unrelated existing user-profile window instead of the isolated headed profile. I took no UI action in that unrelated window and stopped this route. Manifest and CSS zoom are not substituted as proof.
- Production HTTPS was explicitly deferred by the user's LOCAL ONLY direction. No deployment, Cloudflare action, push or commit occurred. Local `isSecureContext` does not replace that release gate.
- The preserved old-release transition observation above remains explicit. The final base's own stopped-offline and verified second-release paths passed.
- Own browser contexts, including the headed isolated profile, were closed. Harness exited; own strict preview stopped. Elevated `lsof` found no listener on 5174; `pgrep critic05-` found no remaining owned process. Per-file SHA-256 confirms exact pre-run base dist restoration (`restored-dist-hashes.txt`, `cleanup.txt`). Root was notified that port/runtime ownership is released.
- No implementation, test, configuration, spec or plan was modified. Evidence and the report are the only repository writes made by this critic.
