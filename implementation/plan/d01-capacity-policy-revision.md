# D1 capacity policy revision

The user explicitly authorized this revision after the Chrome lockout comparison: “Go ahead and revise the capacity policy so that we can get around this error.” This supersedes the runtime capacity floor/formula in the original D1 plan, without changing its other requirements. Preserve the original plan as the historical baseline.

## Installed workload and required free space

D1 readiness budgets for its installed operations: 25,000 Plans and their 25,000 Plan Reflection Entries. It does not require storage for future Executions, market observations, hundreds of thousands of future Journal versions, or a full generation migration before the first Plan can be saved.

Retain the conservative per-record budgets from the baseline: 4 KiB per Plan/history, 4 KiB per reflection, 64 MiB other metadata/reference/definition history, and 100% index/private overhead. The installed envelope M is therefore 543,817,728 bytes. This is a disclosed planning envelope, not a claim of measured physical use. The actual prior command-created 25,000-Plan fixture occupied approximately 146 MB of origin storage, below that envelope.

Retain measured active serialized-byte receipts as a conservative lower bound L, complete release-cache estimate C, and actual available origin quota Q = quota − usage. Required incremental headroom is:

`H = (max(0, M − L) + C) × 1.25`

A fresh Workspace requires 679,772,160 bytes before cache reserve (approximately 680 MB including the current release). Missing/stale private size receipts credit zero; retained caches/other origin storage stay in observed usage. Browser identity does not affect the result. No quota is fabricated or increased to make Chrome pass.

## Safety and future operations

All four functional readiness checks still run on launch/update and before authoritative mutation. Missing/nonfinite estimates and genuinely insufficient space remain failures. Best Effort protection remains advisory. Native diagnostic transactions, complete digest-valid worker/cache checks, atomic participant transactions, rollback and immediate readiness invalidation after actual storage failure remain mandatory. An estimate never guarantees a future write; arbitrary user text is not artificially bounded by the model.

Full generation migration/copy and backup/export memory/storage must be preflighted against their actual requirements when those operations are introduced or invoked. They are not installed in D1. Later deliverables must revise the installed workload envelope using measured records for their added facts before acceptance. No future capability or fake domain record is introduced by this revision.

## Verification and release handling

Remove the old 16.46 GB skip/expected-Unsupported behavior from Chrome/Firefox acceptance tests. Run their real production-UI onboarding, Plan confirmation, recovery/abort, offline/update and accessibility cases at unmodified native quotas. Retain independent low-capacity/unavailable-estimate failure coverage. Reconfirm target-scale storage, correctness and latency and use a fresh independent browser critic under the existing D1 procedure.

Existing profiles may have the previous release cached. Upgrade through normal verified service-worker staging/activation; do not clear their database or browser data to resolve the old policy. All work stays local, with deployment explicitly deferred by the user.
