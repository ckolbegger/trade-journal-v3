# D2 implementation baseline — 2026-10-21

Reviewed against actual D1 at HEAD f36c52df0fdc101498067aaed1f5ffdc46185438 in worktrees/codex-gpt-6.1-sol. User authorized D2 implementation after reading prompts/handoff-D2.md. The historical draft remains unchanged. This addendum fixes implementation decisions within its semantics; it is not a claim that its evidence has passed.

## Inputs and authority

Frozen specs tree: 7ca277bffbe19d0ca3c24fc703817a95af54639d. Authority order is specs/README.md. Input SHA-256, verified before edits:

| Path | SHA-256 |
|---|---|
| implementation/plan/d02-initial-stock-entry.md | f178999f16b99c3e961f4d2f63e55a5be6e86961d2b3c772e3f2614ccf3e62ec |
| implementation/technology-stack.md | c078489445a6cefdec797d295e3ad4e27a889468ade8c9b09d6840abdc9b6980 |
| implementation/delivery-plan.md | 811b49b60200ba43fca01cce9b1cc79bf36d11a41918f83fe5ab14d58cd55b33 |
| implementation/plan/d01-capacity-policy-revision.md | ba560d7d8eb724fb6f74cdc0f5990cccb650b733302836a120393256f273ed64 |
| package-lock.json | 4a834319bc9f7a93451a5fadc18ad2bd107993735ca2a577faefe250d33acc55 |
| specs/evaluation/kickoff-prompt.md | 03c97d607bfd55e086b626a710a6475372320233c2e67ef8b5427016f85bc795 |

Kickoff placeholder is instantiated with this addendum plus the unchanged D2 draft and above input revision/digests. Kickoff scope is D2 only. Pre-D6 readable recovery exception and local-only delivery remain. No commits, pushes or deployment are authorized.

## Reviewed seams and representation (T01)

Public seams remain those in D2-T01–T07. `recordPositionChange` accepts only InitialStockEntry: generation, Workspace revision, Catalog revision, Trade ID/FactRevision, planned-leg ID, exact reflection definition revision, explicit Position Change instant, ordered broker Executions with Stock instrument/action/quantity/price/actual fee/instant and served planned-leg intent, and Complete/Defer/Decline. Client row keys are view state, not domain identities. Preparation reserves no identities; stable execution order is explicitly submitted and becomes Recorded Sequence at commit.

Failures are Rejected(issues), Conflict(issues or generation reason), IntegrityBlocked(findings), RuntimeNotWritable(full current context), StorageFailure. Success Recorded contains generated Position Change/Execution identities, revised Open Trade, exact derivation/reconciliation, Journal outcome, labels, Workspace revision and receipt, returned after the shared transaction commits. Journal.save supports ResolveDebt only; Saved contains the changed outcome, settled Debt and any Entry/decline; failures additionally include NotFound and NeedsTradeWorkflow(exact stored route).

Keep immutable Plan envelopes and snapshots intact. Append PositionChange, Execution, TradeState, Agreement, JournalObligation and JournalEntry/JournalDecline envelopes. Obligation stable key is Position Change ID plus position-change-reflection. Debt history appends under the same obligation identity; current outcome is its latest committed version. No Entry is stored for defer/decline. Opening Lots and financial values remain derived from facts. Agreement stores fact-bound expected lot-match/deviation/entry-resolution evidence, not a competing price or basis.

All participants use one overlapping roots/versions/lifecycle/projections transaction. Generation, Workspace/Trade/catalog/definition/obligation bindings and readiness epoch are rechecked before effect. Each economic fact receives one new sequence; commit ordinal counts commands, so schema 2 must not assume ordinal exceeds economic-fact count. Lifecycle.version points to the current TradeState envelope. Reads bind one IndexedDB read transaction and use indexed lifecycle membership plus bulk loads. Execution Anchors resolve original stable identities. Private size/projection deletion cannot erase authority.

Logical schema 2 uses the existing envelope stores. Any new physical index uses Dexie version 2; versionchange closes old connections and blocked opening must be reported, never initialized over. D1 validation retains the original count invariant. D2 validation uses its explicit per-kind receipt/counts and required seeds instead of Planned-only equations. Migration copies a bound D1 snapshot into a distinct generation, preserves all domain IDs/version IDs/values/times/order and remaps only physical envelope/lifecycle keys. Validate module graphs, references and analysis, seal candidate, then atomically activate after source/readiness recheck. Keep old generation. Interrupted staging cannot become current; stale generation writes fail.

## Analysis and Journal decisions (T02–T05)

Decimal.js remains the engine. Finite sums/products use operand-derived precision; nonterminating weighted prices, fee portions and ratios retain reduced positive-denominator numerator/denominator decimal strings. Comparison uses exact cross products. No rounded/native-number value enters derivation. Full original opening fees remain with their Lots; no hypothetical disposal fee. The 40@49+1 / 60@51+2 fixture yields quantity 100, gross basis 5020, fees 3, weighted entry 251/5, risk 523, reward 977, frozen 1R 500 and BelowPlan. Same-time Lots follow economic time then explicit sequence. Analytical served-leg mismatches yield one Planned-Leg Terms occurrence, never implicit Unplanned Exposure; assessChange rejects missing management for command acceptance.

Seed only Position Change Reflection and Source Position Change in addition to D1. Exact prompts/options/requiredness come from specs/design/journal.md. Complete validates required decision mode/emotion/confidence and snapshots optional Note as Unanswered. Defer creates Outstanding Debt due at decision Economic Time, with original form/source/origin/Trade Anchor and Journal-only route. Decline is separate. ResolveDebt validates original snapshot and expected revision, appends Entry or decline plus settlement atomically. Unrelated Debt never blocks factual recording.

## Capacity and evidence decisions (T07)

Preserve H=(max(0,M-L)+C)*1.25 and actual quota/usage, with no browser allowlist. Extend M for measured installed opening/Journal facts and indexes only after recording serialized/native measurements; migration additionally preflights actual concurrent candidate copy at invocation. Missing estimates and real allocation/abort failures remain failures. No speculative later-market budget or fake facts.

Freeze target population: 25,000 command-created Stock Plans, 200 opened by one decision with two Executions each, cycling Complete/Defer/Decline, and a deterministic subset of Debt settlements; remaining Plans retained because D2 cannot close Trades. Measure full startup and indexed complete Open navigation with 50 stopped offline cold/50 warm trials, raw percentiles and before/after/reconstruction correctness. This is installed D2 evidence, not the later 200,000 mixed-fact workload.

Record every task/case, behavior-caused Red/Green, current source snapshots and command exits separately under implementation/evidence/d02. Integration uses production modules with fake-indexeddb only as disclosed infrastructure and explicit host/clock evidence; native browser evidence owns readiness/durability. Race independent tabs sharing one actual store, never isolated contexts. Native failures use isolated profiles. Cumulative D1+D2 lint/typecheck/build/unit/integration/browser/scale precedes a fresh independent browser critic, with the handoff's repair/new-critic loop. Preserve prior D1 evidence and actual OS-install/native-zoom/HTTPS limits. No D2 capability is advertised until its complete flow/evidence passes.
