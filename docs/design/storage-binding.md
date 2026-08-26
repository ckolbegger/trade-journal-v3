# StorageBinding — initial interface design

The internal persistence seam behind all five stores: opaque keyed records
plus declared secondary indexes plus one atomic-batch primitive. The seam
knows keys, values-as-JSON-text, and index keyPaths — **nothing else**
("zero business rules," overview rule 5). Two implementations behind one
synchronous interface (rule 6): in-memory (unit tests) and SQLite
(production — WASM/OPFS in the domain worker per ADR 0011; the same schema
under Node's SQLite serves the integration tier). TypeScript per ADR 0011.

This was the agreed **narrow session**: the backend was settled by ADR 0011
first (native transactions, real indexes, single-file database), so this doc
pins only the consumer-facing half — the operations, the keying/index model
that honors ADR 0006's "cheap indexed filter," and OQ 9's `transaction`
shape. No design-it-twice ladder: with the backend fixed, the genuine fork
was one (minimal-KV vs declared-indexes vs query-language) and ADR 0006
decides it — recorded in *Alternatives*.

```ts
// caller's-eye — the Daily Review's open-trades query (ADR 0006's claim):
const open = binding.range('trades', { index: 'status', equals: 'Open' })
//   → StoredRecord[] — a real index scan, not a filter over all trades

// commitPlan's cross-store write (OQ 9's recorded home):
const id = binding.transaction(() => {
  trades.commit(input)            // one put of the TradeRecord aggregate
  reflection.createPlaceholder(…) // one put in 'entries'
  return tradeId                  // returned iff both writes committed
})
```

---

## Interface

### Operations

```ts
/** Insert-or-replace one record. Whole values only — there is no patch op;
 *  read-modify-write is single-threaded-safe (semantic 3). */
put(collection: string, key: string, value: string): void

/** One record by key; null when absent (the null-for-absent convention —
 *  never undefined, never a throw). */
get(collection: string, key: string): string | null

/** Remove one record. Exists at the seam because storage mechanics need it;
 *  forward-only retention is a STORE-level invariant the seam does not
 *  enforce (semantic 6). */
delete(collection: string, key: string): void

/** Ordered scan — the seam's one query op, two modes: a primary-key range,
 *  or a scan over a declared secondary index (equality or range). Results
 *  ordered by the scanned key; empty array on no matches. */
range(collection: string, query?: RangeQuery): StoredRecord[]

/** Declare (idempotently) a secondary index over a keyPath into the JSON
 *  value. Called at store construction; declaring an existing index again
 *  is a no-op. The ONLY license the seam has to parse a value (semantic 1). */
ensureIndex(collection: string, name: string, keyPath: string): void

/** Run fn as one atomic batch: every write inside commits together, or —
 *  if fn throws — none of them do (rolled back) and the error rethrows.
 *  OQ 9's primitive, now shaped (semantic 4). */
transaction<T>(fn: () => T): T
```

### Types

```ts
/** One query, two modes — discriminated so a query is always unambiguous
 *  about which ordering it scans. */
type RangeQuery =
  | { fromKey?: string; toKey?: string }   // primary-key range, lexicographic,
                                           //   bounds inclusive; both optional (full scan)
  | { index: string; equals: string }      // secondary index, equality
  | { index: string; from?: string; to?: string }  // secondary index, range (inclusive)

type StoredRecord = {
  key:   string
  value: string
}
```

### The collections (the stores' key composition — seam-opaque, recorded here for review)

| Collection | Primary key (store-composed) | Declared indexes | The query it serves |
|---|---|---|---|
| `trades` | `tradeId` — one value per **whole TradeRecord aggregate** (trade + plan + revisions + fills + finalFigures) | `status`, `strategy`, `accountId`, `underlying`, `closedAt` | `getTradeRecord` (get); `listTrades(filters)` (index scans; ADR 0006's `status:'Open'` is the hot one) |
| `entries` | `entryId` | `state`, `tradeId`, `fillId`, `level`, `type`, `linkedToTrade`, `at` | `getEntry`; `listEntries(filters)` — owed placeholders, market context, the day stream |
| `schemas` | `schemaId` (versions retained forever) | `type` | `getSchema`, `listSchemas` |
| `marks` | `` `${instrument}|${date}` `` (ISO date — lexicographic) | — | `buildMarksFromFills` (point gets); `getMarkSeries` (primary-key range: prefix + date bounds) |
| `accounts` | `accountId` | — | `listAccounts` (full scan, tiny) |
| `taxonomy` | `` `${category}|${valueId}` `` | — | `listValues(category)` (prefix range) |
| `providers` | `providerId` | — | `listProviders` (full scan, tiny) |

Nothing queries fills across trades (every consumer holds a TradeRecord or a
trades list first — coordinators `flatMap(r => r.fills)`), which is what
makes the aggregate-per-trade value safe and OQ 9's in-store multi-fact
cases single puts (semantic 3).

---

## Decided semantics

Each ruling cites the principle it derives from. Veto any during review.

1. **Values are JSON text; the seam may parse them ONLY for declared index
   keyPaths — never interpret.** That is the honest boundary of "zero
   business rules" (rule 5): the SQLite binding reads index keyPaths via
   `json_extract` (real indexes, real query plans); the in-memory binding
   does `JSON.parse` + keyPath lookup. No seam code branches on collection
   names or field meanings. Serialization is the store's job — which means
   unit tests against the in-memory binding exercise the store's real
   serialize/deserialize round-trip, catching encoding bugs at unit-tier
   cost. *(Rule 5; ADR 0011.)*

2. **Keys are store-composed strings; ordering is lexicographic; dates in
   keys are ISO-8601** (`YYYY-MM-DD` sorts correctly under code-unit
   ordering — the one composition rule worth writing down). Composite keys
   join with `|` (see the table). The seam neither knows nor validates key
   grammar. *(Depth — key composition is each store's, once.)*

3. **Whole-value writes; aggregates as single values; read-modify-write
   needs no transaction.** ADR 0011's domain worker is single-threaded —
   there is no concurrent writer, so any single `put` is atomic and a
   read-modify-write sequence cannot interleave. The TradeRecord aggregate
   (one value per trade) therefore collapses OQ 9's "single-store
   multi-fact" cases — `commit` (Trade+Plan) and `recordFill`'s close
   branch (fill+status+closedAt+finalFigures) — into **single puts**,
   trivially atomic. The transaction primitive's real work is
   cross-collection all-or-nothing (the coordinators' 2-write flows).
   *(OQ 9, refined by the keying model; ADR 0011 single-writer.)*

4. **`transaction` = atomic batch, not isolation.** Single-threaded means
   no isolation levels exist or are needed: `transaction(fn)` runs `fn`
   with every write buffered/atombatched — commit-all on normal return,
   rollback-all + rethrow if `fn` throws (SQLite: `BEGIN…COMMIT`/`ROLLBACK`;
   in-memory: an undo log). **Nesting flattens**: an inner `transaction`
   joins the outer batch (no savepoints) — the single writer makes partial
   inner commits meaningless. Return value is `fn`'s. *(OQ 9's resolution,
   shaped; rejected alternatives — sagas, accept-torn-writes — stand.)*

5. **`range` is the one query op; indexes make it honest.** Two modes only
   (primary-key range / index scan) — no predicate trees, no joins, no
   projections: a query language at the seam would push per-store business
   rules into queries and bloat every fake. ADR 0006's "cheap indexed
   filter" is served natively: `range('trades', {index:'status',
   equals:'Open'})` is an index scan in both bindings. Multi-dimensional
   filters (`listTrades({status, strategy, …})`) are store-side: one index
   scan narrows, remaining dims filter the (already narrow) result in
   memory — the store's `TradeFilters` composes one seam query, not six.
   *(ADR 0006; depth — one deep query op over N thin predicates.)*

6. **`delete` exists; forward-only retention does not live here.** The
   stores' public APIs deliberately lack deletes (Taxonomy pattern), but
   that is a store invariant, not a seam mechanic — a seam without delete
   could not implement store *corrections* (`reopenTrade` clears fields —
   still a put) or future compaction ops honestly. The seam enforces
   nothing; stores choose. *(Rule 5 — the seam has zero rules, including
   that one.)*

7. **`put` is upsert; `get` returns `null` on absent; `range` returns `[]`
   on no matches.** The zero-vs-null conventions every store fake already
   follows (PA semantic 7's spirit at the storage tier — callers stay
   branch-light). *(Consumer ergonomics.)*

8. **`ensureIndex` is setup-time and idempotent.** Stores declare their
   indexes at construction (the table above is the full intended set);
   re-declaration is a no-op so store constructors can run unconditionally
   against a fresh or existing binding. Indexes are never declared
   mid-flight — a new index on existing data is a migration, owned by the
   store that wants it, not a seam behavior. *(Testability — constructor
   idempotence; no implicit migrations.)*

---

## Sequence: commitPlan — the cross-collection transaction (OQ 9's home)

```
trader → PlanCommitCoordinator.commitPlan(input)
  → calc.evaluate(sketch, ∅, committedAt)                    // validation first — outside
  │                                                          //   any write (throws → nothing written)
  → binding.transaction(() => {                              // OQ 9: ONE mechanism
      binding.put('trades', tradeId, serialize(tradeRecord)) // status='Planned' + plan,
                                                            //   the whole aggregate, ONE put
      binding.put('entries', entryId, serialize(placeholder))// the required pre-entry bookend
      return tradeId
    })
  → SQLite binding: BEGIN … [put, put] … COMMIT              // or ROLLBACK on throw —
  → in-memory binding: undo log, discarded on throw          //   both bindings, one semantic
  ← { tradeId, figures, warnings }
```

If the second `put` throws (e.g. serialization failure), the first is rolled
back — no Planned trade without its owed placeholder, the bookend invariant
OQ 9 protected.

## Sequence: the indexed open-trades query (ADR 0006's claim, honored)

```
trader → DailyReviewCoordinator.runDailyReview(asOf)
  → TradingRecordStore.listTrades({ status: 'Open' })
    → binding.range('trades', { index: 'status', equals: 'Open' })   // index scan —
    │                                                                //   NOT a filter over all trades
    ← TradeRecord[] (deserialized aggregates)
  → … marks, evaluate, evaluateMany, stopsHit …
```

This is the query ADR 0006 exists for: open trades are a growing minority
of a monotonically growing table; the index keeps the Daily Review's
membership read proportional to the *open* set, in both bindings.

## Sequence: read-modify-write without a transaction (recordFill, non-close branch)

```
trader → FillEntryCoordinator.recordFill(tradeId, fill)
  → record = store.getTradeRecord(tradeId)              // binding.get('trades', tradeId)
  → calc.isFlat(simFills) → false
  → store.recordFill(tradeId, fill)                     // internally:
  │     aggregate = deserialize(get(key))               // read
  │     aggregate.fills.push(fill)                      // modify — single-threaded: no interleave
  │     put(key, serialize(aggregate))                  // ONE whole-value write, atomic
  ← { statusAfter:'Open', fillId }
```

No transaction anywhere — semantic 3. The close branch is the same single
put (the aggregate absorbs fill + status + closedAt + finalFigures); only
the *coordinator's* bookend write after it joins a transaction (sequence 1's
mechanism).

---

## Audit findings (sequence-diagram audit)

Three instructive flows drawn (above); the yield test skipped the trivial
ones — point gets and full scans expose nothing unwritten. Findings the
drawing surfaced, applied in-sitting:

### Finding 1 — the keying model collapses OQ 9's in-store multi-fact cases

Drawing `commit` and `recordFill`'s close branch exposed that both were
modeled as multi-write sequences needing the transaction primitive. With
aggregate-per-trade values (justified: no cross-trade fill query exists —
verified against every consumer in the who-calls-whom matrix), each is ONE
put. The transaction primitive's scope shrinks to cross-collection
atomicity. Applied: semantic 3; OQ 9's ledger entry updated to record the
refinement.

### Finding 2 — who calls `ensureIndex`, and when

The first sequence draft had indexes appearing by the time `range` needed
them, with no declaration moment — an unwritten setup rule. Applied:
semantic 8 — store constructors, idempotent, never mid-flight.

### Finding 3 — multi-dimensional filters were unaddressed

`listTrades` filters on up to six dimensions; a naive reading needs six
indexes and six-way intersection at the seam — a query engine. Applied:
semantic 5's composition rule — one index scan narrows (the store picks,
e.g. `status`), remaining dims filter in memory over the narrowed set. At
this app's scale (years of one trader's trades) the in-memory tail is
noise; if it ever isn't, a second declared index is additive.

---

## Requirements fulfilled / exported

### Closed here

| Item | Resolution |
|---|---|
| **StorageBinding interface (overview `—` row)** | **Pinned: 6 ops** (`put`, `get`, `delete`, `range`, `ensureIndex`, `transaction`) — the overview's `~5` estimate plus the setup-time index declaration. |
| **OQ 9's deferred primitive shape** | **Pinned**: `transaction<T>(fn: () => T): T` — atomic batch, rollback-on-throw, nesting flattens (semantic 4). Plus the refinement: aggregate-per-trade keying collapses the in-store multi-fact cases to single puts (finding 1). |
| **ADR 0006's "cheap indexed filter"** | Honored structurally: declared secondary indexes + `range`'s index mode; the open-trades query is an index scan in both bindings (semantic 5, sequence 2). |
| **The keying/index model** | Pinned in the collections table: store-composed keys, ISO-date composites, the full intended index set per collection. |

### Exported to downstream sessions (commitments)

- **→ every store implementation:** serialize/deserialize is store-owned
  (values are JSON text; the round-trip is exercised by unit tests through
  the in-memory binding — semantic 1); key composition per the table
  (semantic 2); index declarations in constructors (semantic 8).
- **→ OQ 8 (backup architecture) — narrowed, not closed:** full backup is
  the single-file database itself (ADR 0011: copy the file — outside this
  API). What remains open is the **export format + cross-device transfer
  UX** — the PWA's per-device storage (ADR 0011) makes phone ↔ laptop
  transfer a real first-release need served by export/import, and the
  format is not designed here. Owned by the backup/restore feature design.
- **→ schema migrations:** a future store needing a new index on existing
  data owns that as an explicit migration (semantic 8) — no seam behavior
  exists for it yet, deliberately.

---

## Open items

| Item | Owned by |
|---|---|
| **Export format + cross-device transfer UX** (OQ 8's remainder): a portable dump format (JSON over the import ops vs raw file copy) and the phone ↔ laptop transfer flow. First-release scope per ADR 0011. | backup/restore feature design |
| **Schema/record versioning on disk** (a `schemaVersion` field inside stored values, checked at deserialization) — cheap to add now, but no store has a migration yet; YAGNI until the first real migration exists. | first store implementation |

---

## Alternatives considered

### The keying/query model (the one genuine fork)

- **Declared secondary indexes over opaque JSON values (adopted).** Minimal
  CRUD + `ensureIndex` + one two-mode `range`. Honors ADR 0006 natively in
  both bindings (SQLite: `json_extract` + real indexes; in-memory:
  parsed index maps); keeps zero business rules (the seam parses keyPaths,
  never meanings); stores compose multi-dim filters themselves (semantic 5).

- **Minimal KV, store-side filtering only (rejected).** `put/get/delete` +
  primary-key ranges, every secondary dimension filtered in memory. Simplest
  seam — but the open-trades query becomes a full scan + filter, which is
  *exactly* the O(all-trades)-growing read ADR 0006 was written to kill. The
  ADR decides this fork; no owner trade-off exists.

- **A query language at the seam (rejected).** Predicate trees / mini-SQL
  over collections. A database engine API, not a seam: every store would
  embed filtering logic in queries (business rules in callers), every fake
  becomes an interpreter, and the depth the seam exists to provide
  (transactions + indexes + opaque CRUD) is already complete without it.

### Transaction shape

- **Closure-based atomic batch with flattened nesting (adopted).** OQ 9's
  recorded mechanism, now shaped: `fn` runs, writes commit together or not
  at all, errors rethrow. Nesting flattens — savepoints would buy partial
  inner rollback that a single-threaded writer has no use for.

- **Explicit begin/commit/rollback ops (rejected).** Leaks failure paths
  into every store call site (every caller pairs a begin with a commit AND a
  rollback branch) and makes forgotten-rollback a standing bug class. The
  closure makes the batch scope structural.

- **Savepoint-nested transactions (rejected).** Real in SQLite, meaningless
  single-threaded — an inner partial commit has no concurrency story to
   serve. YAGNI with a vengeance.
