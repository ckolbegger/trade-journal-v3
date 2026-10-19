# Test substitutions

Every test-specific infrastructure replacement is recorded here, with the fidelity it gives up and
the real-engine counterpart that closes the gap (`planning-protocol.md:120-121`, D1 §8). No entry
bypasses an application layer, and none stands in for production HTTPS evidence.

| Substitution | Substituted component | Fidelity gap | Real-engine counterpart |
|---|---|---|---|
| fake-indexeddb | The browser-owned IndexedDB engine behind the persistence seam | A Node substitute cannot reproduce real transaction scheduling under contention, browser quota accounting (`navigator.storage.estimate()`), or service-worker-controlled cache behaviour; durability ordering after a process kill is simulated, not observed | T9.4, T11.6, T18.3, T18.4, T20's two-engine readiness run, and T33's real-engine repetition of the durability-critical proofs |
| loopback origin | The production HTTPS secure origin | A browser-recognised secure loopback origin proves service-worker and storage behaviour but is not a deployed HTTPS delivery, so it cannot satisfy AC-DEL-003's production-origin evidence | A deployed HTTPS origin, owned by no D1 task and carried open as C-5; never claimed as delivered |
| controlled host-capability implementation | The browser's storage-estimate and protection reporting in the Node integration suite | Supplies a configured capacity and protection value, so the Node suite cannot prove what a real host reports or how it changes | T20's two-engine browser run and T33's real-engine repetition, where the true host estimate is read |
| in-memory release cache | The service worker's Cache Storage in the Node integration suite | Serves the release assets from a map, so it cannot prove real cache eviction, quota pressure or the browser's cache-first ordering; it does exercise the real inventory validator, real SHA-256 digests and real URL handling | T18.3, T18.4, T20's two-engine readiness run, `tests/browser/offline-restart.spec.ts` and `tests/browser/durability-real-engine.spec.ts` |
