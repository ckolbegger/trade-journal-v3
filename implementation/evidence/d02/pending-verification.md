# Remaining evidence and local limits

The automated D2 local gates passed on one source digest (`907d3332fe5164476fbd7d3e03d5d45ce54cc0d93eb103fe8f3a1db3f1180912`) and release (`2cceb94481214601e7a1d43f28b5008985956048b0f0040a2593c33e9fedc723`). The fresh critic's final report and final-local-verification.json record its independent local result. These do not certify the following external or procedural items:

- Actual OS PWA installation and installed standalone launch were not exercised. The installed browser tab/offline flows were exercised in native isolated profiles.
- Native browser-chrome 200% zoom remains unverified. CSS zoom screenshots and DOM/reflow checks are supplemental only.
- Production HTTPS and deployment are explicitly user-deferred. Secure loopback testing does not certify a public HTTPS deployment.
- Per-behavior TDD exceptions and an early repeated-attempt retention gap are disclosed in README.md. Immediate passes and driver/type/configuration failures are not valid Reds, and missing historical logs are not reconstructed.
- The target-scale migration peaked at 722,808,772 sampled used JavaScript heap bytes on the tested host. This is not total RSS or a low-memory-device guarantee. Migration currently materializes its source/candidate validation graph.

The independent critic retained one narrow-layout usability observation in focus-390-settled.png/json: after a live wide-to-narrow resize, the lower portion of an already-focused optional Note textarea can sit behind the fixed bottom navigation until the user scrolls. The top focus indicator remains visible; fields/values/actions remain accessible and keyboard completion succeeded. Parent checked the frozen responsive/accessibility requirements and classified this as an observation rather than a demonstrated acceptance failure. It is not claimed fixed.

The critic intentionally did not swap production assets for another independent update test. The current cumulative native suite separately passes update deferral and offline retention for both opening and Debt flows on all three engines.

All work remains local and uncommitted. No D2 commit, push, deployment, user database reset, test seeding into the user's profile, or fault injection into user data was performed. The restored preview serves the completed release; an existing browser tab should use its normal verified Check for application updates / Reload to update flow, which defers activation while unsaved drafts exist.
