# ReflectionStore — initial interface design

The store for qualitative reflection: Journal Entries and their self-describing
form. A Trade accumulates a stream of entries spanning its whole life, from
plan-time through final close, and the journal also holds market-wide
observations with no parent Trade. It owns three concepts from CONTEXT.md and the
ADRs: the **Journal Entry** (content, timestamp, 3-level attachment discriminator
Trade/Fill/Market per ADR 0004), the **Journal Placeholder** (a pending entry the
trader owes at a consequential moment), and the **Entry Schema** (the field set
per entry type, trader-customizable, with an immutable version referenced by
each entry per ADR 0003).

It deliberately owns **no derivation** beyond a state filter: no P&L, no risk, no
lifecycle logic — those are CalculationModule's and TradingRecordStore's. It
holds facts only, over an injected StorageBinding (rule 5). "What's owed" is a
filter on a stored fact (a placeholder's `state`), **not** a derivation from
lifecycle ∩ existing entries — the placeholders the coordinators create *are* the
owed record, so there is nothing to compute.

Twelve operations — seven entry ops and five schema ops — over an injected
StorageBinding, testable with an in-memory binding, no mock, no real backend:

```ts
/** Create an owed placeholder — a Journal Entry in 'placeholder' state. Trade and
 *  fill level only (market observations are never owed). Coordinators call this at
 *  the bookends: plan-commit (pre-entry, required) and close (post-close, required);
 *  and for the "later" path of an optional fill-level placeholder. */
createPlaceholder(input: PlaceholderInput): EntryId

/** Create a complete written entry — spontaneous reflection, the "now" path of an
 *  optional prompt, or a market observation. Carries content from the start. */
createEntry(input: EntryInput): EntryId

/** Fulfill a placeholder: transition placeholder → complete on the same record.
 *  The bookend entries (pre-entry, post-close) are created as placeholders by
 *  coordinators and completed later by the trader. */
completePlaceholder(id: EntryId, content: Record<string, unknown>, schemaId: SchemaId, at: Date): void

/** Single read. */
getEntry(id: EntryId): Entry

/** Collapsed multi-filter read (mirrors TradingRecordStore.listTrades). Returns full
 *  entries; callers project. state:'placeholder' is the "what's owed" filter (OQ 5). */
listEntries(filters?: EntryFilters): Entry[]

/** Revise a market entry's affected-trade links (initial links set at createEntry).
 *  The link table is ReflectionStore-owned (ADR 0004 places it "in entry storage"). */
setMarketLinks(entryId: EntryId, tradeIds: TradeId[]): void

/** Restore a fully-formed entry verbatim (incl. embedded schemaId, state, links) —
 *  in one call (ADR 0003 + 0004 facts survive backup/restore). Unlike createEntry
 *  (which pins the current schema version and validates content) and completePlaceholder
 *  (which transitions state), importEntry writes exactly what it's given. Used by the
 *  restore path only. */
importEntry(entry: Entry): EntryId

// ── Schema definitions (versioned, immutable, forward-only) ──

/** Create a new schema version for a type. Forward-only: each call with changed fields
 *  mints a new version; old versions are retained so existing entries' schemaId
 *  references keep resolving (the Taxonomy / retired-provider pattern). No-ops (returns
 *  the existing schemaId) if the fields are identical to the latest version. */
saveSchema(type: EntryType, fields: SchemaField[]): SchemaId

/** The latest version of a type's schema — the one a newly-created entry will pin. */
getSchema(type: EntryType): EntrySchema

/** Resolve a schemaId to its definition — interpret a historical entry's fields, or
 *  restore. Every schemaId ever minted remains resolvable forever (versions are retained). */
getSchemaVersion(schemaId: SchemaId): EntrySchema

/** The latest version of each type — for rendering the journal-writing UI's type picker. */
listSchemas(): EntrySchema[]

/** Restore a schema definition verbatim — type, version, fields, and its schemaId —
 *  in one call. Used by the restore path (schemas must be restored before entries that
 *  reference them). On a present schemaId it overwrites wholesale (the backup is
 *  authoritative on restore). */
importSchema(schema: EntrySchema): void
```

---

## Interface

### Operations

```ts
// ── Entry lifecycle ──
createPlaceholder(input: PlaceholderInput): EntryId
createEntry(input: EntryInput): EntryId
completePlaceholder(
  id:      EntryId,
  content: Record<string, unknown>,
  schemaId: SchemaId,
  at:      Date,
): void
getEntry(id: EntryId): Entry
listEntries(filters?: EntryFilters): Entry[]
setMarketLinks(entryId: EntryId, tradeIds: TradeId[]): void
importEntry(entry: Entry): EntryId

// ── Schema definitions ──
saveSchema(type: EntryType, fields: SchemaField[]): SchemaId
getSchema(type: EntryType): EntrySchema
getSchemaVersion(schemaId: SchemaId): EntrySchema
listSchemas(): EntrySchema[]
importSchema(schema: EntrySchema): void
```

### Types

```ts
/** Identifiers (type aliases for readability; backing type is string).
 *  EntryId and SchemaId are store-assigned. */
type EntryId  = string
type SchemaId = string
type TradeId  = string          // defined in calculation-module.md; restated here.
type FillId   = string          // defined in calculation-module.md; the join key from
                                //   TradingRecordStore (semantic 6), referenced here.

/** The consequential moments a Journal Entry can be about. The domain vocabulary —
 *  each names a real reflection prompt the app drives (CONTEXT.md: Journal Entry,
 *  Journal Placeholder, Daily Review). */
type EntryType =
  | 'pre-entry'      // pre-trade reflection at plan-commit (the "Trade Plan" type)
  | 'post-close'     // post-trade review at close
  | 'fill'           // reflection tied to a specific fill
  | 'daily-review'   // a daily-review observation about an open trade
  | 'market-event'   // a macro observation with no parent trade

/** The three attachment levels (ADR 0004). First-class discriminator. */
type AttachmentLevel = 'trade' | 'fill' | 'market'

/** Whether a Journal Entry is still owed or has been written. Under Candidate B
 *  (the adopted write model), a placeholder IS an entry in 'placeholder' state;
 *  completing it transitions the same record to 'complete'. */
type EntryState = 'placeholder' | 'complete'

/** A field in an Entry Schema. kind drives the UI control and the content value's
 *  semantic (a 'select' stores its choice as a string but is not free text). */
type SchemaField = {
  name: string
  kind: 'text' | 'number' | 'select' | 'rating'   // MVP kinds; the union grows
}

/** A versioned, immutable Entry Schema definition. Forward-only: editing a type's
 *  fields mints a new version; old versions are retained so existing entries'
 *  schemaId references keep resolving (ADR 0003 by reference — the Taxonomy /
 *  retired-provider pattern). schemaId is carried on the record because entries
 *  reference schemas by a single token (the TradeRecord/Fill pattern, not the
 *  PriceMark (instrument,date)-pair pattern). */
type EntrySchema = {
  schemaId: SchemaId            // STORE-ASSIGNED; callers receive and pass it opaquely
  type:    EntryType
  version: number               // STORE-ASSIGNED, monotonic per type; the human-readable counter
  fields:  SchemaField[]
}

/** One Journal Entry — discriminated by attachment level (ADR 0004). The three
 *  levels share the self-describing-form fields (type, schemaId, state, content?,
 *  createdAt, at?) and differ in their attachment reference. */
type Entry = TradeEntry | FillEntry | MarketEntry

type TradeEntry = {
  entryId: EntryId
  level: 'trade'
  type: EntryType               // kept as the filter key (derivable from schemaId, but
                                //   present so listEntries({type}) needs no schema lookup)
  schemaId?: SchemaId           // the ADR 0003 reference (immutable version). ABSENT on
                                //   placeholders (no content to conform — decided semantic
                                //   19), pinned at completePlaceholder (caller passes it).
  state: EntryState
  tradeId: TradeId
  content?: Record<string, unknown>  // present iff state='complete'
  createdAt: Date               // when the record was created (when owed, if a placeholder)
  at?: Date                     // when written; present iff state='complete'
  required?: boolean            // placeholder tier (Required/Optional); present on placeholders
}

type FillEntry = {
  entryId: EntryId
  level: 'fill'
  type: EntryType
  schemaId?: SchemaId           // ABSENT on placeholders, pinned at completion (semantic 19)
  state: EntryState
  tradeId: TradeId              // denormalized (convention C2) so listEntries({tradeId})
                                //   spans trade + fill levels in one call
  fillId: FillId                // the join key from TradingRecordStore (semantic 6)
  content?: Record<string, unknown>
  createdAt: Date
  at?: Date
  required?: boolean
}

type MarketEntry = {
  entryId: EntryId
  level: 'market'
  type: EntryType               // typically 'market-event'
  schemaId: SchemaId            // always present (state is always 'complete' — convention C3)
  state: 'complete'             // market entries are never owed
  links: TradeId[]              // affected trades (ADR 0004); empty if none
  content: Record<string, unknown>
  createdAt: Date
  at: Date                      // always present (state is always 'complete')
}
```

### Input types

```ts
/** Create a placeholder. Trade and fill level only. */
type PlaceholderInput = {
  level: 'trade' | 'fill'
  type: EntryType
  tradeId: TradeId
  fillId?: FillId               // present iff level='fill'
  required: boolean             // Required (bookend) vs Optional (offered)
  createdAt: Date
}

/** Create a complete written entry. Any level. */
type EntryInput = {
  level: AttachmentLevel
  type: EntryType
  tradeId?: TradeId             // present iff level ∈ {'trade','fill'}
  fillId?: FillId               // present iff level='fill'
  links?: TradeId[]             // present iff level='market'
  content: Record<string, unknown>
  schemaId: SchemaId            // caller-provided (ADR 0003 reference)
  at: Date
}

type EntryFilters = {
  tradeId?: TradeId             // trade-level + fill-level entries for this trade
  fillId?: FillId               // fill-level entries for this fill
  level?: AttachmentLevel
  type?: EntryType
  state?: EntryState            // 'placeholder' → the "what's owed" filter (OQ 5)
  linkedToTrade?: TradeId       // market entries linked to this trade
  from?: Date                   // time-range filter on `at` (or createdAt for placeholders)
  to?: Date
}
```

---

## Decided semantics

Each ruling cites the principle or ADR it derives from. Veto any during review.

1. **Twelve operations: seven entry ops + five schema ops.** The one-entity state-
   machine shape (Candidate B — see *Alternatives considered*). `createPlaceholder`,
   `createEntry`, `completePlaceholder`, `getEntry`, `listEntries`,
   `setMarketLinks`, `importEntry` for entries; `saveSchema`, `getSchema`,
   `getSchemaVersion`, `listSchemas`, `importSchema` for schemas. The schema
   sub-area grew from the user's versioned-schema move (OQ 10 → ADR 0003 by
   reference, not by value) — it is the cost of making schema versions explicit
   and queryable instead of emergent in the union of entry snapshots. *(Depth;
   Candidate B; OQ 10 → A.)*

2. **Candidate B: one entity, `placeholder → complete` state machine.** A
   placeholder *is* a Journal Entry in `'placeholder'` state; fulfilling it
   transitions the same record to `'complete'`. This matches CONTEXT.md almost
   literally: "a **pending** Journal Entry the trader owes." It captures the
   "placeholders are real, persisted things" property (so the Daily Review gets
   one filter, not replicated lifecycle logic) without the dual-entity overhead
   of two linked types (Candidate A) or the replicated-derivation cost of no
   stored placeholder (Candidate C). See *Alternatives considered*. *(OQ 5;
   CONTEXT.md: Journal Placeholder.)*

3. **"What's owed" is a filter on a stored fact, not a derivation.** Under
   Candidate B the placeholders the coordinators create *are* the owed record.
   `listEntries({ tradeId, state:'placeholder' })` returns what's owed for one
   trade; `listEntries({ state:'placeholder' })` returns it across all. There is
   no "lifecycle ∩ existing entries" computation — that framing described the
   problem under Candidate C; B removes the problem rather than answering it.
   This reads rule 1 *more* strictly than the overview's framing assumed: the
   store does less, because the facts it stores already encode "owed." *(OQ 5 →
   dissolved by Candidate B; rule 1.)*

4. **Schema versions are referenced by id, not embedded by value (ADR 0003 by
   reference).** An entry carries `schemaId: SchemaId`, not a full field array.
   The user's move: a versioned, immutable schema registry (type+version as the
   key), pointed to by id, with old versions retained forever. This is the
   "references an immutable schema version" branch of ADR 0003's consequences
   ("embeds or references"); the embed branch (full snapshot per entry) was
   rejected as redundant once content no longer needed to self-describe (the
   schemaId resolves to the full field+kind definitions). Net: entries shrink,
   schema history becomes explicit and queryable, and the ADR 0003 guarantee
   holds by reference rather than by repetition. *(ADR 0003 by reference; OQ 10
   → A.)*

5. **`EntrySchema` carries its own `schemaId`.** The store assigns `schemaId` on
   `saveSchema`; callers receive it and pass it opaquely. This follows the
   codebase convention: records referenced by a single token (TradeRecord's
   `tradeId`, Fill's `fillId`) carry that token on themselves; records referenced
   by a pair (PriceMark's `(instrument, date)`) do not. Entries reference schemas
   the first way. Carrying it also keeps the id format (e.g. `'pre-entry@3'`) the
   store's business — callers never construct or parse it. *(Codebase symmetry;
   rule 5 — id construction is internal.)*

6. **`type` is denormalized onto entries as a filter key.** Derivable from
   `schemaId` (via `getSchemaVersion`), but kept on the entry so
   `listEntries({ type:'fill' })` needs no schema lookup. Same principle as
   `strategy: StrategyId` on TradeRecord (store-owned convenience; calc ignores).
   *Veto if you'd rather drop it and resolve through the schema.* *(Depth — a
   cheap denormalization that saves a join on a common filter.)*

7. **Entries are immutable once complete (no edit/delete op).** `completePlaceholder`
   transitions placeholder → complete on the same record; there is no edit, no
   delete, no history mechanism on entries. Parallel to append-only Plan
   Revisions (ADR 0001) and append-only PriceMark history. *Veto if you want
   history-preserving entry correction — would add an entry-history mechanism
   like PriceMark's, growing the interface.* *(CONTEXT.md append-only pattern.)*

8. **`tradeId` is denormalized onto fill-level entries (convention C2).** Caller-
   provided at create time, so `listEntries({ tradeId })` spans trade-level +
   fill-level entries for a trade in one call (the Daily Review's common query).
   Same principle as `strategy` on TradeRecord — a store-owned convenience field.
   *(Depth — one filter instead of two-then-merge.)*

9. **Market entries are always `'complete'` (convention C3).** Market observations
   are spontaneous ("25% tariff announced"), never owed — there is no lifecycle
   moment that creates a market placeholder. So `state:'complete'` and `at` is
   always present on MarketEntry. The `required?` field is absent from MarketEntry
   by construction. *(ADR 0004; CONTEXT.md: Journal Entry — Market-level.)*

10. **The market-link table is ReflectionStore-owned.** ADR 0004 places it "in
    entry storage": a MarketEntry carries `links: TradeId[]`, set at `createEntry`
    and revised via `setMarketLinks`. Whether the links are stored on the entry
    record or in a side table is an implementation detail (rule 5); the interface
    owns the concept. `setMarketLinks` replaces the link set wholesale (no
    add/remove primitives — the whole-document-save principle, like
    `importTrade`). *(ADR 0004; depth — the edit is naturally whole.)*

11. **No cross-store referential validation (convention C6).** The store accepts
    `tradeId` / `fillId` / `links` as given; it does not call TradingRecordStore
    to verify a trade or fill exists. This mirrors TradingRecordStore semantic 16
    (the store validates structural invariants, not cross-entity ones). The UI
    offers valid refs; restore tolerates import ordering (entries may land before
    the trades they reference). *Veto if you want runtime FK checks — but see OQ 6
    (dissolved): the only cross-store act was this check, and removing it dissolves
    the coordinator question.)* *(TradingRecordStore semantic 16; rule 1.)*

12. **Journal-writing is a direct store call, not a coordinator (OQ 6 dissolved).**
    `createEntry` / `createPlaceholder` / `completePlaceholder` touch only
    ReflectionStore. With no cross-store referential validation (semantic 11),
    journal-writing has no cross-store act at all. Rule 8 is explicit: a workflow
    that touches one store is a direct store call. Journal-writing is the second
    canonical example (after PlanRevision → TradingRecordStore) of a zero-
    coordinator single-store workflow — evidence the seams are drawn at real
    boundaries. *(OQ 6 → dissolved; overview rule 8.)*

13. **Timestamps are caller-provided, not store-stamped.** `createdAt`
    (placeholders) and `at` (complete entries) come from the caller. The store is
    a fact store, not a clock. This makes import/restore natural (historical
    entries carry original timestamps) and removes a clock dependency from unit
    tests. *(TradingRecordStore semantic 7; testability — no clock to stub.)*

14. **`EntryId` and `SchemaId` are store-assigned.** Generated on `createEntry` /
    `createPlaceholder` / `saveSchema` respectively. Callers receive them in the
    return / via reads and reference by ID. The id format (`'ent_001'`,
    `'pre-entry@3'`) is an implementation detail; callers never construct or parse
    ids. *(The store is the identity authority; rule 5.)*

15. **StorageBinding is the persistence seam — zero business rules.** All twelve
    ops delegate to put/get/range-query over opaque fact records. Two
    implementations: in-memory (unit tests) and real (prod). No per-backend
    business rules. *(Overview rule 5.)*

16. **`listEntries` collapses the read surface into one filtered op.** "Entries
    for this trade," "placeholders owed across all trades," "market entries
    linked to this trade," "fill-level entries for this fill" are all
    `listEntries(filters)` with different filters. Returns full entries; callers
    project. Mirrors TradingRecordStore's `listTrades` collapse. *(Depth — one
    generic shape reused N times; deletion test on the near-identical reads.)*

17. **`content` conforms to the referenced schema (runtime check on write).**
    Because schemas are trader-customizable, `content`'s shape is runtime data —
    it cannot be a static TS type. The rigor is a runtime check: on
    `completePlaceholder` and `createEntry` (for complete entries), the store
    resolves `schemaId` → fields via `getSchemaVersion` and validates that
    `content`'s keys match the field names. The snapshot *is* the field-set
    definition; content is bound to it. *(ADR 0003; type-level rigor → runtime
    check where the domain demands it.)*

18. **`schemaId` is absent on placeholders, pinned at completion (audit finding A,
    resolved).** A placeholder has no content, so there is nothing to conform to a
    schema — the `schemaId` is absent on the placeholder record and pinned at
    `completePlaceholder` time (the caller passes it, offering the type's current
    version). This is more elegant than pinning at placeholder creation: the
    schema snaps to whatever's current when content actually appears, so a
    placeholder created under v1 but completed after the trader added a field will
    pin v2 — the schema matches the content at the moment the content exists, which
    is what ADR 0003's purpose ("a faithful record of what was captured at the
    time") actually asks for. `createEntry` entries (always complete) carry
    `schemaId` from creation. *(ADR 0003; audit finding A.)*

19. **`importEntry` restores an entry verbatim; `importSchema` restores a schema
    verbatim.** Both exist because the live write ops build state through rules a
    verbatim restore must bypass. `createEntry` pins the current schema version
    and validates content; `completePlaceholder` transitions state; `saveSchema`
    mints a new version and rejects identical fields. A restore must write exact
    state: an entry's embedded `schemaId`, its `state`, its `links`, a schema's
    exact `version`. Same pattern as `TradingRecordStore.importTrade` and
    `PriceMarkStore.importMark` — earned for the same reason. Restore order:
    schemas first (`importSchema`), then entries (`importEntry`), so every
    `schemaId` reference resolves. *(OQ 8; audit finding — the importMark
    cautionary tale, applied from the start this time.)*

---

## Worked examples

### Plan-commit bookend — the pre-entry placeholder, completed later

An AAPL trade is committed July 15. The coordinator owes the pre-entry reflection
placeholder immediately; the trader completes it that evening.

```ts
// PlanCommitCoordinator — at commit:
const entryId = reflect.createPlaceholder({
  level: 'trade', type: 'pre-entry', tradeId: 'tr_001',
  required: true, createdAt: new Date('2024-07-15T14:20:00Z'),
})
// → 'ent_001'
// Record state: { entryId:'ent_001', level:'trade', type:'pre-entry',
//                 schemaId:'pre-entry@1', state:'placeholder', tradeId:'tr_001',
//                 createdAt:Jul15-14:20, required:true }   // no content, no `at`

// That evening — the trader writes the pre-entry reflection. They're filling the
// 'pre-entry' form, whose current schema is:
//   reflect.getSchema('pre-entry') → { schemaId:'pre-entry@1', type:'pre-entry',
//                                      version:1, fields:[thesis, invalidation,
//                                      entryEmotion, conviction] }
reflect.completePlaceholder('ent_001',
  { thesis:'cup-and-handle breakout above $148 resistance',
    invalidation:'handle fails, closes below $146',
    entryEmotion:'confident',
    conviction:4 },
  'pre-entry@1',
  new Date('2024-07-15T20:00:00Z'))
// → same record, now: state:'complete', content:{...}, at:Jul15-20:00
```

The placeholder and the completed entry are **the same record** — `completePlaceholder`
transitioned its state. This is Candidate B in one operation.

### Fill-level reflection — the "later" optional path

July 20, a fill lands. The coordinator offers an optional fill-level placeholder;
the trader defers ("later"). July 25, during the Daily Review, they complete it.

```ts
// FillEntryCoordinator — at fill (the "later" choice):
const fillEntryId = reflect.createPlaceholder({
  level: 'fill', type: 'fill', tradeId:'tr_001', fillId: 'fill_002',
  required: false, createdAt: new Date('2024-07-20T15:00:00Z'),
})
// → 'ent_006'. State: placeholder, owed but optional.

// July 25 Daily Review — the trader completes it:
reflect.completePlaceholder('ent_006',
  { emotionAtFill:'anxious', panic:3, note:'scaled in too fast' },
  'fill@1', new Date('2024-07-25T20:00:00Z'))
```

Note `tradeId:'tr_001'` is denormalized onto the fill-level entry (convention C2),
so the Daily Review's `listEntries({ tradeId:'tr_001' })` returns this fill entry
alongside the trade's trade-level entries in one call.

### Market observation linked to two trades

July 22, a Fed announcement. The trader records it as a market observation and
links it to the two trades it affects.

```ts
// Spontaneous — createEntry, level='market'. No placeholder; market entries are
// always complete (convention C3).
const mktId = reflect.createEntry({
  level: 'market', type: 'market-event',
  links: ['tr_001', 'tr_005'],
  content: { event:'Fed +25bp', impact:'volatility spike' },
  schemaId: 'market-event@1',
  at: new Date('2024-07-22T14:00:00Z'),
})
// → 'ent_011'. State: complete, at:Jul22-14:00.

// Later, the trader realizes it also affects tr_009:
reflect.setMarketLinks('ent_011', ['tr_001', 'tr_005', 'tr_009'])
// → links replaced wholesale (whole-document save).
```

When the Daily Review assembles the view for tr_001, this entry surfaces via
`listEntries({ linkedToTrade:'tr_001', level:'market' })`.

### Close bookend — the post-close placeholder

July 25, the trade closes. The coordinator owes the post-close reflection.

```ts
// FillEntryCoordinator — at close:
reflect.createPlaceholder({
  level: 'trade', type: 'post-close', tradeId:'tr_001',
  required: true, createdAt: new Date('2024-07-25T16:00:00Z'),
})
// → 'ent_012'. Owed, required. The trader completes it on their own schedule.
```

### Daily Review — "what's owed" + market context, in two filters

The Daily Review for tr_001 pulls owed placeholders and linked market entries.
Under Candidate B both are `listEntries` filters — no derivation, no cross-store
join.

```ts
// What's owed for this trade (pre-entry if not yet completed, post-close after close):
reflect.listEntries({ tradeId:'tr_001', state:'placeholder' })
// → [ent_012 (post-close, required)]   (pre-entry ent_001 was completed earlier)

// Market context linked to this trade:
reflect.listEntries({ linkedToTrade:'tr_001', level:'market' })
// → [ent_011 (Fed +25bp)]

// Across all trades — the Daily Review's "everywhere something is owed":
reflect.listEntries({ state:'placeholder' })
// → [ent_006 (fill, optional, tr_001), ent_012 (post-close, required, tr_001), …]
```

### Schema evolution — forward-only versioning

Six months later, the trader adds a field to their pre-entry template.

```ts
// Before: pre-entry@1 has [thesis, invalidation, entryEmotion, conviction].
reflect.saveSchema('pre-entry', [
  { name:'thesis', kind:'text' },
  { name:'invalidation', kind:'text' },
  { name:'entryEmotion', kind:'select' },
  { name:'conviction', kind:'rating' },
  { name:'marketContext', kind:'text' },   // ← new field
])
// → 'pre-entry@2'.  Old 'pre-entry@1' is RETAINED.
//   ent_001 still references 'pre-entry@1' — its form still shows 4 fields.
//   New pre-entry placeholders pin 'pre-entry@2' — their form shows 5.

// A historian reading ent_001 (created under v1) resolves its schema:
reflect.getSchemaVersion('pre-entry@1')
// → { schemaId:'pre-entry@1', type:'pre-entry', version:1, fields:[4 fields] }
```

Schema history is explicit in the version registry, not emergent in the union of
entry snapshots. This is the payoff of the user's versioned-schema move (decided
semantics 4).

### Reads — `listEntries` collapses the read surface

```ts
// "Show me everything owed for tr_001" (Daily Review)
reflect.listEntries({ tradeId:'tr_001', state:'placeholder' })

// "All fill-level entries for fill_002"
reflect.listEntries({ fillId:'fill_002' })

// "Every market observation linked to tr_005"
reflect.listEntries({ linkedToTrade:'tr_005', level:'market' })

// "All complete entries in July, for the time-interleaved review stream"
reflect.listEntries({ from: jul1, to: jul31, state:'complete' })
```

---

## Sequence: plan-commit (the store's half of the bookend)

The store's half of the plan-commit workflow. (Coordinator internals are
illustrative; pinned in its own drill-down.)

```
trader → PlanCommitCoordinator.commitPlan(planInput)
  → CalculationModule.evaluate(recordSketch, emptyMarks, now)   // validate planned R:R
  → TradingRecordStore.commit(tradeInput)                        // write Trade (Planned) + Plan
  → ReflectionStore.createPlaceholder({                          // ← this store
      level:'trade', type:'pre-entry', tradeId, required:true, createdAt:now
    })
← { tradeId }
```

Single store write. The pre-entry placeholder is now owed; the trade's reflection
stream has begun.

## Sequence: fill-entry close path (the post-close bookend)

```
trader → FillEntryCoordinator.recordFill(tradeId, fillInput)
  → [existing isFlat/evaluate/recordFill sequence — see TradingRecordStore doc]
  → on close:
      → ReflectionStore.createPlaceholder({                      // ← this store
          level:'trade', type:'post-close', tradeId, required:true, createdAt:now
        })
  → (always) ReflectionStore.createPlaceholder({                // the optional fill-level offer
      level:'fill', type:'fill', tradeId, fillId, required:false, createdAt:now
    })
    ← trader's 3-way choice (now/later/none) drives the coordinator, not this store:
       'now'   → coordinator calls createEntry (complete) or completePlaceholder immediately
       'later' → the placeholder created above persists (state:'placeholder')
       'none'  → coordinator deletes the placeholder (importEntry/none — see Open items)
```

The bookend asymmetry (CONTEXT.md: Journal Placeholder): pre-entry and post-close
are *required* and auto-created; fill-level is *optional* and offered. This store
creates what it's told to create; the coordinator owns *when* and *whether*.

## Sequence: daily-review reflection assembly

```
trader → DailyReviewCoordinator.runDailyReview(today)
  → [existing openTrades + marks + evaluate sequence — see TradingRecordStore doc]
  → for each open trade:
      → owed = ReflectionStore.listEntries({ tradeId, state:'placeholder' })   // OQ 5: a filter
      → marketCtx = ReflectionStore.listEntries({ linkedToTrade:tradeId, level:'market' })
      ← assembled into DailyReviewView (open trades + live figures + owed + market, interleaved by time)
trader records an observation → ReflectionStore.createEntry(...)   // optional, journal-writing path
```

Two filters, no derivation. This is OQ 5's resolution made concrete: "what's
owed" is `listEntries({ state:'placeholder' })`, a fact filter — not a lifecycle
computation.

## Sequence: journal-writing (direct store call, no coordinator — rule 8)

```
trader → ReflectionStore.createEntry({ level:'trade', type:'daily-review',
        tradeId, content:{…}, schemaId, at:now })
```

Single store. No coordinator. This is OQ 6's resolution: the only cross-store act
was validating a parent ref, and convention C6 removed it. Journal-writing joins
PlanRevision as the canonical zero-coordinator single-store workflows.

## Sequence: schema evolution (forward-only versioning)

```mermaid
sequenceDiagram
    actor T as trader
    participant RS as ReflectionStore

    Note over T,RS: v1 exists: pre-entry@1 → [thesis, invalidation, entryEmotion, conviction]
    T->>RS: saveSchema('pre-entry', [thesis, invalidation, entryEmotion, conviction, marketContext])
    Note over RS: fields differ from v1 → mint v2. v1 retained.
    RS-->>T: 'pre-entry@2'
    Note over T,RS: Existing ent_001 still references pre-entry@1.<br/>Its form still shows 4 fields. New entries pin v2 (5 fields).
    T->>RS: getSchemaVersion('pre-entry@1')
    RS-->>T: { schemaId:'pre-entry@1', version:1, fields:[4 fields] }
    Note over RS: Every schemaId ever minted resolves forever.
end
```

Forward-only versioning: old versions are retained so existing entries' references
keep resolving. This is the Taxonomy / retired-provider pattern (CONTEXT.md:
Taxonomy; PriceMarkStore semantic 2) applied to schemas.

## Sequence: cold-start restore (audit diagram — schemas first, then entries)

```mermaid
sequenceDiagram
    actor T as trader
    participant Imp as restore tool
    participant RS as ReflectionStore

    T->>Imp: restore(backup incl. entries + schemas)
    Note over Imp,RS: Restore order: schemas first, then entries.<br/>Every schemaId reference must resolve on import.
    loop each backed-up schema
        Imp->>RS: importSchema(entrySchema)
        Note over RS: writes type, version, fields, schemaId verbatim<br/>overwrites on present schemaId (backup authoritative)
    end
    loop each backed-up entry
        Imp->>RS: importEntry(entry)
        Note over RS: writes entry verbatim — state, schemaId, links, content<br/>bypasses createEntry's pin-current-version and completePlaceholder's transition
    end
end
```

Restore is two-phase (schemas then entries) so `schemaId` references resolve. This
is the cost of the reference model (decided semantics 4): under embed, a single
`importEntry` was self-sufficient; under reference, the restore fan-out spans two
collections. Same shape as restoring trades + marks together — no new architecture,
one more collection in the fan-out.

## Sequence: schema revised while a placeholder is outstanding (audit diagram A)

```mermaid
sequenceDiagram
    actor T as trader
    participant Coord as PlanCommitCoordinator
    participant RS as ReflectionStore

    Note over T,RS: Jul 15: pre-entry schema is at v1
    T->>Coord: commitPlan(AAPL trade)
    Coord->>RS: createPlaceholder({type:'pre-entry', tradeId, required:true})
    Note over RS: placeholder created — NO schemaId yet.<br/>state='placeholder', no content, no schemaId.
    RS-->>Coord: ent_001

    Note over T,RS: Jul 20: trader adds a field to the pre-entry schema
    T->>RS: saveSchema('pre-entry', [5 fields])
    RS-->>T: 'pre-entry@2'. v1 retained.

    Note over T,RS: Jul 25: trader completes the pre-entry placeholder
    Note over RS: Which schema version? The placeholder has no schemaId.<br/>completePlaceholder takes schemaId as a param — caller chooses.<br/>UI offers the current latest (v2).
    T->>RS: completePlaceholder('ent_001', content, 'pre-entry@2', at)
    Note over RS: schemaId pinned NOW (at completion). Content validated<br/>against v2 fields. ADR 0003 purpose honored: content matches<br/>its schema at the moment content appears.
    RS-->>T: ent_001 now state='complete'
end
```

This diagram exposed **audit finding A**: the placeholder record carries no
`schemaId` (there is no content to conform yet), and the schema is pinned at
*completion*, not creation. The original sketch typed `schemaId: SchemaId` as
always-present — a type-level bug. Fixed: `schemaId?` (absent on placeholders,
pinned at `completePlaceholder`). This is more elegant than pinning at creation:
the schema snaps to whatever's current when content appears. Decided semantics 18.

## Sequence: the 3-way fill-level choice at close (audit diagram B)

```mermaid
sequenceDiagram
    actor T as trader
    participant FEC as FillEntryCoordinator
    participant RS as ReflectionStore

    Note over T,RS: Trade closes (flat). Post-close placeholder owed.
    FEC->>RS: createPlaceholder({type:'post-close', tradeId, required:true})
    RS-->>FEC: ent_012

    Note over FEC: Fill-level placeholder OFFERED (optional).<br/>Coordinator asks trader: now / later / none?
    alt now (write immediately)
        T->>FEC: "now"
        FEC->>RS: createEntry({level:'fill', type:'fill', content, schemaId, at})
        Note over RS: complete entry created directly. NO placeholder.
    else later (defer)
        T->>FEC: "later"
        FEC->>RS: createPlaceholder({level:'fill', type:'fill', fillId, required:false})
        Note over RS: placeholder persists (state='placeholder'). Owed but optional.
    else none (decline)
        T->>FEC: "none"
        Note over FEC: nothing created. The offer preceded creation —<br/>declining means the placeholder never exists. No store op needed.
    end
end
```

This diagram validated the Open-item provisional answer: "none" needs no store op
because the coordinator's offer *precedes* creation. "Now" creates a complete
entry directly (no placeholder). "Later" creates the placeholder. The store has
exactly the right ops; the coordinator owns the branching. **No new finding** —
but it confirms the design against a flow the initial sketch hadn't drawn.

---

## Audit findings (sequence-diagram audit) — applied in this session

The audit drew two candidate flows (schema-revised-while-placeholder-outstanding;
3-way fill-level choice) and applied the yield test. Two more were skipped with
reason: unowned detection (a required placeholder being "overdue" — DailyReview
surfaces it via `listEntries({ state:'placeholder' })`, OQ 5 already closed, no
store-level notion of "overdue"); and gap/late for schemas (a schema version is
retained forever — there is no "late" case; an entry referencing an old version
resolves via `getSchemaVersion` always).

| Finding | Category | Resolution |
|---|---|---|
| **A — `schemaId` typed as always-present, but placeholders have no content to conform.** A placeholder created under schema v1, completed after the schema moved to v2, pins v2 — but only if `schemaId` is absent on the placeholder and supplied at `completePlaceholder`. The original sketch's `schemaId: SchemaId` (always-present) was wrong for placeholders and would have forced pinning at creation (the wrong moment). | Unwritten rule → type fix | **`schemaId?` on TradeEntry/FillEntry** (absent on placeholders), pinned at completion. Decided semantics 18. The schema matches content at the moment content appears — what ADR 0003's purpose actually asks for. |
| **B — the "none" path of the 3-way optional choice needed an op?** | Unwritten rule (validated, not a finding) | **No op needed.** The coordinator's offer precedes creation; "none" = the placeholder is never created. Confirms the Open-item provisional answer. The store's op set is correct as designed. |

---

## Requirements fulfilled / exported

### Closed here (open questions resolved)

| OQ | Resolution |
|---|---|
| **5 — Placeholders: derived how exactly?** | **Dissolved by Candidate B.** Placeholders are stored facts (entries in `'placeholder'` state) the coordinators create at lifecycle moments. "What's owed" is `listEntries({ state:'placeholder' })` — a fact filter, not a derivation. The "lifecycle ∩ existing entries" computation does not exist. ReflectionStore stores and filters; coordinators own *when to create*. |
| **6 — JournalWriting: separate coordinator or in-store parent-ref check?** | **Direct store call, no coordinator.** Convention C6 (no cross-store referential validation) removes the only cross-store act. `createEntry`/`createPlaceholder`/`completePlaceholder` touch only ReflectionStore → rule 8 applies (single-store workflow = direct call). Journal-writing joins PlanRevision as a zero-coordinator workflow. |
| **10 — Entry Schema definitions: ReflectionStore vs ReferenceStore?** | **ReflectionStore (Option A).** The versioned-schema registry is structurally a reference collection, but it has one consumer (the journal) in one domain (journal entries). The PriceProviderStore split criterion (separate consumer + separate domain) is not met. Snapshot locality (ADR 0003's purpose — entry↔schema binding) is honored at the store boundary. |

### Exported to downstream sessions (commitments)

- **→ PlanCommitCoordinator:** calls `createPlaceholder({ level:'trade',
  type:'pre-entry', tradeId, required:true, createdAt:now })` after
  `TradingRecordStore.commit`. Creates the first bookend.
- **→ FillEntryCoordinator:** on close, calls `createPlaceholder({ level:'trade',
  type:'post-close', tradeId, required:true, createdAt:now })`; per fill, offers
  the optional fill-level placeholder via `createPlaceholder({ level:'fill',
  type:'fill', tradeId, fillId, required:false })` and drives the trader's 3-way
  choice (now/later/none). The coordinator owns *when* owed; ReflectionStore owns
  the placeholder concept.
- **→ DailyReviewCoordinator:** reads owed placeholders via `listEntries({ tradeId,
  state:'placeholder' })` and linked market entries via `listEntries({
  linkedToTrade:tradeId, level:'market' })`. Two filters, no derivation. The
  coordinator interleaves these with open-trade figures into the DailyReviewView.
- **→ CalculationModule (ripple, none required):** ReflectionStore consumes the
  `revisionCount` *concept* (FigureSet's qualitative counterpart is the journal
  stream) but calls no calc op. No type changes in calculation-module.md.
- **→ TradingRecordStore (ripple, none required):** ReflectionStore references
  `FillId` and `TradeId` as opaque strings (convention C6 — no FK validation). No
  type changes in trading-record-store.md.
- **→ Backup/restore (OQ 8):** this store's restore slice is served by `importEntry`
  + `importSchema` (two-phase: schemas first, then entries). The broader backup
  architecture (OQ 8) remains open globally, but this store's slice is served.

---

## Open items

| Item | Owned by |
|---|---|
| **The "none" path of the optional fill-level placeholder.** CONTEXT.md offers a 3-way choice (now/later/none). "now" → createEntry immediately; "later" → the placeholder persists. "none" means the trader declines — but entries are immutable once complete (decided semantics 7) and there is no delete op. Options: (a) a `declinePlaceholder(id)` op that transitions to a `'declined'` terminal state (widening `EntryState`); (b) the coordinator simply doesn't call `createPlaceholder` for "none" (the placeholder only exists once the coordinator creates it, so "none" = never created — the cleanest reading, since the offer precedes creation). Provisional: (b) — "none" is a coordinator-side decision *before* creation, so no store op is needed. Confirm during FillEntryCoordinator drill-down. | FillEntryCoordinator drill-down |
| **OQ 9 — multi-fact write atomicity.** `createEntry` for a market entry writes content + links together; `completePlaceholder` transitions state + writes content. These are single-store multi-fact writes that should be atomic, same class as `recordFill`'s close path and PriceMarkStore's `upsertMark` read-modify-write. | overview / StorageBinding (OQ 9) |
| **OQ 14 — mark-correction snapshot invalidation (touched, not owned).** If a mark correction invalidates a closed-trade snapshot, the post-close placeholder may need re-surfacing. But under Candidate B, the post-close placeholder is a stored fact: if the trader already completed it, it's `'complete'` (immutable, decided semantics 7) and won't re-surface; if not, it's still `'placeholder'` and already surfaces. So ReflectionStore has no active role — the question is whether OQ 14's response creates a *new* owed placeholder (a "re-review after correction" type), which would be a coordinator decision, not a store change. | FillEntryCoordinator / TradingRecordStore (OQ 12 owner) |
| **OQ 8 — backup/export/import architecture.** This store's restore slice is served (`importEntry` + `importSchema`, two-phase). The broader architecture (storage-seam fan-out vs. coordinator) remains open globally. | overview / lifecycle (OQ 8) |
| **StorageBinding shape.** This store assumes put/get/range-query over opaque records (overview rule 5). `listEntries` with multiple optional filters needs either compound range queries or in-memory filtering; the exact primitive set is deferred. | StorageBinding drill-down / implementation |
| **`EntryId` / `SchemaId` generation strategy.** Store-assigned (decided semantics 14), but the format (UUID, sequential, prefixed like `'ent_001'`, `'pre-entry@3'`) is an implementation detail. | Implementation |
| **`SchemaField.kind` expansion.** The MVP kinds (text, number, select, rating) cover the journal form types; the union grows as the UI does (date, multi-select, etc.). The shape is stable; the values grow. | UI-release drill-down |
| **Entry history / correction.** Entries are immutable once complete (decided semantics 7). If traders need to correct a written entry, a history mechanism (like PriceMark's append-only `history`) would be needed. Deferred until the need is real. | later, if the need arises |

---

## Alternatives considered

### The placeholder model (design-it-twice — the load-bearing structural choice)

- **Candidate A — Two entities (Placeholder + Entry, linked)** (rejected). Distinct
  types; fulfilling creates an entry *linked* to the placeholder; "due" =
  unfulfilled placeholders. Most explicit about "owed" being a real thing. Rejected
  on three grounds. First, fulfilling is a two-record write (mark placeholder
  fulfilled + create linked entry) — an OQ 9 atomicity cost for every bookend.
  Second, the Daily Review merges two streams (placeholders + entries) to interleave
  by time. Third, A's only real advantage — type-level enforcement that a
  placeholder has no content — is an invariant B enforces at write time
  (`content` absent iff `state='placeholder'`) rather than via two types. Deeper
  under B: one type, one stream, one filter.

- **Candidate B — One entity, `placeholder → complete` state machine** (adopted).
  A placeholder *is* an entry in `'placeholder'` state; completing transitions the
  same record. Matches CONTEXT.md literally ("a **pending** Journal Entry the
  trader owes"). Captures A's "placeholders are persisted" property (Daily Review
  gets one filter, not replicated logic) without A's dual-entity overhead, and is
  lean like C without C's replication. The decisive point: under B, "due" is a
  *filter on facts* (state), not a derivation — so it satisfies rule 1 more
  strictly than the overview's "lifecycle ∩ existing entries" framing assumed. B
  removes the problem (OQ 5 dissolves) rather than answering it.

- **Candidate C — No placeholder entity; coordinator derives due** (rejected). Store
  holds only complete entries + schemas; "due" = coordinator computes lifecycle ∩
  entry-presence. Leanest store. Rejected on three grounds. First, "owed" logic
  replicates across every consumer (Daily Review + any future UI) — the deletion
  test run in reverse: complexity reappears across N callers. Second, "Required
  must eventually be completed" has no persistent home — an unfulfilled pre-entry
  is just an *absence*. Third, it fights CONTEXT.md's "auto-created" placeholders
  and the handoff's "ReflectionStore owns the placeholder concept."

### Entry Schema: embed by value vs. reference by id (ADR 0003's two branches)

- **Embed by value (initial sketch — rejected).** Each entry carries a full
  `SchemaSnapshot` (the field array) copied at creation. The literal reading of
  ADR 0003 ("carries a snapshot"). Rejected after the user's challenge: the
  embedded schema is redundant once content no longer needs to self-describe
  (the schemaId resolves to the full field+kind definitions), and it bloats every
  entry record. The versioned-reference model keeps the ADR 0003 guarantee (fields
  don't drift) without the per-entry repetition.

- **Reference by id, versioned registry (adopted — the user's move).** A versioned,
  immutable schema registry (type+version as the key, schemaId as the handle), with
  old versions retained forever. Entries carry `schemaId`, not the field array.
  This is the "references an immutable schema version" branch of ADR 0003's
  consequences ("embeds or references"). Net wins: entries shrink, schema history
  becomes explicit and queryable (vs. emergent in the union of snapshots), and the
  ADR 0003 guarantee holds by reference rather than by repetition. Cost:
  referential integrity (a schemaId must keep resolving — mitigated structurally by
  forward-only retention) and a two-phase restore (schemas first, then entries).

### Schema-definition location (OQ 10)

- **Option A — ReflectionStore owns schema definitions** (adopted). Schemas and
  entries co-locate; `getEntry` + `getSchemaVersion` are two calls but one
  dependency; ADR 0003's entry↔schema binding honored at the store boundary. Chosen
  because the split criterion that justified PriceProviderStore (a separate consumer
  in a separate domain) is not met: entry schemas have one consumer (the journal)
  in one domain (journal entries). Splitting would create a reference store whose
  only client is the store next door — a pass-through the deletion test rejects.
  The honest price: a 12-op store with two invariants (journal facts + a versioned
  reference registry), justified because they serve one purpose (faithful entries).

- **Option B — Split into EntrySchemaStore (13th module)** (rejected). Schemas
  become a reference store joining the step-5 cluster (Account, Taxonomy,
  PriceProvider). Customization symmetry with Taxonomy. Rejected on the split
  criterion: every entry-schema consumer is the journal (journal-writing UI,
  entry-rendering UI, the entries themselves) — no external domain touches them.
  Contrast TaxonomyStore (separate consumer: Performance Reporting) and
  PriceProviderStore (separate consumer: the roadmap fetcher). A 4-op store that's
  ~90% a TaxonomyStore clone with one different entity, whose only client is
  ReflectionStore — fails the deletion test.

### `EntrySchema` carrying its own `schemaId` (session finding)

- **Carry `schemaId` on `EntrySchema`** (adopted). The store assigns it; callers
  receive and pass it opaquely. Follows the codebase convention: records referenced
  by a single token (TradeRecord's `tradeId`, Fill's `fillId`) carry that token;
  records referenced by a pair (PriceMark's `(instrument, date)`) do not. Carrying
  it also keeps the id format internal — callers never construct or parse
  `'pre-entry@3'`.

- **Omit `schemaId` from `EntrySchema` (initial sketch — rejected).** The id is
  derivable from type+version, so it need not be stored on the record. Rejected for
  symmetry (the single-token-reference pattern carries the token) and for the
  id-format-internal argument (forcing callers to construct `'pre-entry@3'` makes
  the encoding a public contract).
