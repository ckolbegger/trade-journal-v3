# Domain facts, pure analysis, and use-case coordinators

Status: accepted

Trade Journal V3 uses a small set of authoritative fact modules, pure analytical modules, and use-case coordinators. The UI consumes finished reads and complete semantic commands. It does not join stores, calculate domain results, or sequence writes to manufacture atomicity.

Entity-by-entity repositories were rejected because they expose storage nouns while scattering lifecycle, correction, settlement, and Journal invariants across callers. Coarse monoliths were rejected because their small visible surface combines unrelated change pressures and weakens ownership. The accepted partition keeps facts local, calculations deterministic, and cross-module workflows explicit.

Consequences:

- Trade Record, Journal, Market Data, and Reference Catalog own durable facts in their domains.
- Trade Analysis and Performance Analysis accept all input explicitly and perform no I/O.
- Trade Workflows, Daily Review, Trade Views and Reporting, and Workspace coordinate complete use cases.
- Pricing Provider is one external port. Persistence/Transaction is one internal seam.
- UI structure, storage representation, and implementation composition remain choices behind these interfaces.
