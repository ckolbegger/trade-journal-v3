# Deliverable 8aR — architecture deepening of D8a

## Scope and authority
D8aR is a new refactor deliverable authorized by the user after D8a was released. It implements **all six** candidates from `plan/global-error-critic-brief.md`’s companion architecture review (HTML report `architecture-review-20261126T142047Z.html`). No D9 work is started. Frozen `specs/` and frozen plan files are read-only; D8aR records its decisions only in new `plan/d8ar-*.md` files. DEV-001 still applies.

This deliverable deepens modules; it does not add trader-visible capability. Two existing defects are corrected because they sit directly on the refactored seams: the complete Trade Detail reports `NotApplicable: StockOnly` for an option Trade, and the option close path fabricates `agreement` and omits a derived Terminal Disposition. All other D1–D8a domain results must be byte-equivalent.

## Removal and test-migration rule (applies to every improvement)
Deepening is **replace, not parallel-add**. For each improvement:

1. **Old implementation is deleted**, not left beside the new module. When behaviour moves behind a deeper seam, the original implementation is removed in the same change. A thin adapter survives only if it still has callers and does nothing but translate to the new interface. A module that would keep its old logic as a fallback is not deepened and the task is incomplete.
2. **Tests migrate to the new seam when behaviour is still required.** A test moves to the new module's interface and keeps its assertions where the behaviour still holds. It is not copied.
3. **A test is removed only when its subject no longer exists** — i.e. the function or branch it asserts has been deleted and there is no equivalent behaviour behind the new seam. "The file was renamed" or "the test was written against the old module" is not a reason to delete a test.
4. **Critic-visible behaviour stays covered.** Every removed test's scenario must reappear in the new module's tests or in the browser critic flow. A green suite with a lost scenario is a defect, not a win.
5. **The final diff must show deletion lines**, not only additions, for each deepened seam. Reviewers check this explicitly.

## ADR decisions to record (do not edit frozen ADRs)
- **ADR 0001** (UI does not join stores or calculate domain results): R1, R4 and R6 move joins and result assembly out of `App.tsx` into deep modules. This deepens the accepted partition; it does not replace it.
- **ADR 0003** (Terminal Disposition derived, never captured): R4 stops the option close path from fabricating `agreement` and requires the same derived disposition as the stock path. This restores the ADR rather than overturning it.
- **ADR 0007** (Expiration Payoff independently available): R2 removes the UI-side payoff calculation and feeds the frozen Planned Leg into the existing pure payoff implementation. This restores the ADR rather than overturning it.
- **ADR 0008** (Runtime Readiness is a session gate): R6 keeps uncaught failures visible without changing the held `Runtime Readiness` outcome.

## Ordering and ownership
1. **R1 — Stored-Trade read assembly** (foundation: one canonical stored-to-displayed projection).
2. **R2 — Complete Trade Detail Expiration Payoff** (consumes R1’s projection).
3. **R3 — Advisory frame adapter** (consumes R1’s projection).
4. **R4 — Position Change commit** (now returns R1’s projection post-commit).
5. **R5 — Close Review obligation read** (independent, after controllers settle).
6. **R6 — Error meaning seam** (cross-cutting last, after all handlers have moved).

Single-owner seams: the canonical Trade read (R1), the payoff seam in complete detail (R2), the advisory frame assembly (R3), the Position Change commit (R4), the obligation read (R5), and error wording/surface selection (R6). Each **replaces** the old implementation per the Removal rule; no parallel fallback path survives. Only genuinely exported D5 `replay`, D8 `expirationPayoff` and D8a advisory formula signatures stay unchanged — their internal callers move to the new seams.

---

## R1 — Deepen stored-Trade read assembly

**Files:** `src/ui/detail-controller.ts`, `src/ui/plan-controller.ts`, `src/ui/option-controller.ts`, `src/ui/App.tsx`, new `src/ui/trade-read.ts`.

**Problem:** three reconstructions of the stored-to-displayed Trade shape, each inventing different defaults (`oneR: '0.00'`, stub revisions, fabricated `agreement`); `App.tsx` joins catalog, trade and journal stores directly. The interface is wide and the implementation is scattered — no locality for "what is stored vs what is shown".

**Solution:** one read module whose interface accepts a Trade identity plus the already-resolved stores and returns the canonical Trade projection with explicit defaults. Controllers become thin adapters; `App.tsx` stops joining stores.

- `describe("canonical Trade read")`
  - `it should normalise a Planned, Open and Closed stored Trade to one projection with explicit defaults`
  - `it should read the frozen Plan fields from plan rather than inventing top-level values`
  - `it should preserve exact contract, revision, lifecycle index membership and journal linkage`
  - `it should serve planned, detail and complete-detail callers through one interface`
  - `it should write nothing to any store`
- **Red/green:** `npx vitest run tests/unit/trade-read.test.ts -t "<case>"` and `npx vitest run tests/integration/trade-read.test.ts -t "<case>"`.
- **Removal:** delete the three stored-to-displayed normalisers from `detail-controller.ts`, `plan-controller.ts` and `option-controller.ts`, and the catalog/trade/journal joins in `App.tsx`. The controllers survive only as thin adapters to `trade-read.ts`; if a controller keeps its own defaults or join logic, R1 is incomplete. Tests pinning the invented defaults migrate to `trade-read.ts` if the behaviour still holds, and are removed only under rule 3.
- **Critic flow:** `B(r1-read)` — open planned, open and closed Trades through the production UI and confirm identical labels/revisions/defaults with no store writes.

---

## R2 — Deepen complete Trade Detail Expiration Payoff

**Files:** `src/domain/complete-detail.ts`, `src/domain/expiration-payoff.ts`, `src/ui/App.tsx`, `src/ui/complete-detail-view.tsx`.

**Problem:** `complete-detail.ts:91` hardcodes `NotApplicable: StockOnly`, so an option Trade's Payoff at expiration is wrong in the complete detail while `App.tsx` computes the real payoff elsewhere. UI calculates a domain result; understanding payoff requires bouncing across modules.

**Solution:** widen the complete-detail input with the frozen Planned Leg and call the existing `expirationPayoff` once. Delete the UI-side calculation and have the detail view render the domain result.

- `describe("complete detail payoff")`
  - `it should derive the option payoff from the frozen Planned Leg through the existing payoff operation`
  - `it should keep stock-only without an option anchor NotApplicable and multiple expirations Unavailable`
  - `it should leave Planned and Current views independent and accept no theoretical price or advisory value`
  - `it should render the same payoff in the detail view and the standalone option panel`
  - `it should byte-match the existing expirationPayoff result for identical inputs`
- **Red/green:** `npx vitest run tests/unit/complete-detail-payoff.test.ts -t "<case>"` and `npx playwright test e2e/d8ar-payoff.spec.ts -g "<case>"`.
- **Removal:** delete the hardcoded `NotApplicable: StockOnly` payoff branch in `complete-detail.ts` and the payoff math in `App.tsx`; the standalone panel and detail view both render the single domain result. Tests of the removed UI calculation migrate to `complete-detail.ts`; if a UI-side payoff calculation remains, R2 is incomplete.
- **Critic flow:** `B(r2-payoff)` — confirm a Long Call, open Complete detail and the standalone panel, compare break-even/extrema, and verify no model price.

---

## R3 — Deepen the advisory frame adapter

**Files:** `src/domain/advisory-iv.ts`, `src/domain/advisory-decomposition.ts`, `src/ui/detail-controller.ts`, `src/ui/App.tsx`.

**Problem:** deep formulas sit behind a boolean `installed` seam; exact contract resolution, underlying join, days-to-expiration and side live in a UI adapter with no domain interface. The previous false-IV bug lived exactly there.

**Solution:** one advisory module whose interface accepts persisted Marks, the frozen Plan and the installed flag, and returns frames plus the advisory result. Frame assembly moves behind that interface; the capability check stays at the app shell.

- `describe("advisory frame assembly")`
  - `it should resolve the frozen Strategy id from both plan and Trade placements`
  - `it should build exact option frames from contract strike, expiration, multiplier and underlying Marks`
  - `it should keep the advisory result deterministic and byte-equivalent with the capability off`
  - `it should return the same stable Unavailable reasons for missing evidence and negligible sensitivity`
  - `it should never feed an advisory value into payoff, evaluation, P&L, risk, Stop/Target, Daily Review or reports`
- **Red/green:** `npx vitest run tests/unit/advisory-frames.test.ts -t "<case>"` and `npx vitest run tests/integration/d8a-read-boundary.test.ts -t "<case>"`.
- **Removal:** delete `contractOf`/`underlyingPrice`/days-to-expiration/side frame assembly from `detail-controller.ts`; it moves behind the advisory module's interface. `detail-controller.ts` becomes a thin adapter that resolves the installed flag at the shell. Tests of the old adapter's frame construction migrate to the new module; if the adapter keeps its own frame logic, R3 is incomplete. The advisory formulas themselves are not duplicated.
- **Critic flow:** `B(r3-advisory)` — reproduce the repaired fixture and verify IV `1.9519`, share equivalent `34`, split `60.03 / -126.32 / 226.29`, with no banner and no write.

---

## R4 — Deepen the Position Change commit

**Files:** `src/ui/option-controller.ts`, `src/ui/position-controller.ts`, `src/ui/close-controller.ts`, `src/ui/App.tsx`, `src/domain/types.ts`, new `src/ui/position-change-commit.ts`.

**Problem:** guard → read → validate → atomic transaction → lifecycle index is implemented three times; `App.tsx` forks stock/option and casts types; the option path fabricates `agreement` and stores no derived Terminal Disposition. No locality for "record this Position Change".

**Solution:** one commit module owning the full command, with stock and option fact adapters behind its interface and a post-commit result in the canonical R1 shape. Both paths call the same derivation for Terminal Disposition and close-reason requirement.

- `describe("Position Change commit")`
  - `it should commit a stock and an option opening through one interface with one reflection outcome`
  - `it should commit a stock and an option close with derived Terminal Disposition, never a fabricated agreement`
  - `it should keep all effects atomic and return revision-bound post-commit state`
  - `it should reject stale revision, invalid contract and non-Writable readiness with no writes`
  - `it should remove the UI casts and the duplicated Account type`
  - `it should preserve every existing D3/D6/D8 receipt, lifecycle index and journal outcome assertion`
- **Red/green:** `npx vitest run tests/unit/position-change-commit.test.ts -t "<case>"` and `npx vitest run tests/integration/position-change-commit.test.ts -t "<case>"`.
- **Removal:** delete the three guard→read→validate→transaction→index implementations from `position-controller.ts`, `close-controller.ts` and `option-controller.ts`, plus the stock/option fork and `as unknown as` casts in `App.tsx` and the duplicated `Account` type in `option-controller.ts`. These modules survive only as fact adapters to `position-change-commit.ts`; a retained commit path or fabricated `agreement` is incomplete. Tests of the old commit seams migrate to the one commit interface, keeping every receipt/index/journal assertion.
- **Critic flow:** `B(r4-commit)` — open and close one stock and one option Trade through the UI, verify receipts, Terminal Disposition and no stale state; reload.

---

## R5 — Deepen the Close Review obligation read

**Files:** `src/ui/close-review-controller.ts`, `src/ui/review-controller.ts`, `src/ui/App.tsx`, `src/domain/close-review.ts`, `src/domain/position-change-reflection.ts`, new `src/ui/obligation-read.ts`.

**Problem:** two read implementations for one Close Review obligation (`currentOutcome` by id prefix, `loadCloseReviewState` by obligation key); the domain result carries `settlementRoute: 'Journal.save(ResolveDebt)'` and callers branch on that string. No locality for "the current outcome".

**Solution:** one obligation read module keyed by obligation identity, returning the effective Journal Entry, Journal Decline or Journal Debt with its due semantics. Both Closed detail and Daily Review use it; the string branch disappears.

- `describe("obligation read")`
  - `it should resolve one effective outcome per obligation key from Entry, JournalDecline and unsettled Debt`
  - `it should agree between Closed detail and Daily Review without reimplementing lookup`
  - `it should keep due-at-next-Review semantics and never expose a storage noun in the result`
  - `it should preserve one outcome per obligation and no duplicate narrative rows`
  - `it should write nothing on a read`
- **Red/green:** `npx vitest run tests/unit/obligation-read.test.ts -t "<case>"` and `npx vitest run tests/integration/obligation-read.test.ts -t "<case>"`.
- **Removal:** delete the `currentOutcome` id-prefix lookup in `close-review-controller.ts` and the obligation-key lookup in `loadCloseReviewState` (`App.tsx` / `review-controller.ts`), and the `settlementRoute` string branch in `review-controller.ts`. Both callers use `obligation-read.ts`; if either keeps its own lookup, R5 is incomplete. Tests of the two lookups migrate to the one read module without losing a Complete/Defer/Decline scenario.
- **Critic flow:** `B(r5-obligation)` — Complete, Defer and Decline outcomes across Closed detail and Review, including settle-from-Review and reload.

---

## R6 — Unify error meaning behind one seam

**Files:** `src/ui/global-errors.ts`, `src/ui/global-error-banner.tsx`, `src/ui/global-error-boundary.tsx`, `src/main.tsx`, `src/ui/App.tsx`, `src/ui/plan-controller.ts`, `src/ui/review-controller.ts`, `src/ui/issue-copy.ts`.

**Problem:** typed `Result` failures collapse to strings in controllers, each handler switches kinds into prose, and the global banner is a separate store. Error meaning has no locality; the two adapters (window listeners, render catch) justify a seam but the per-handler switch is shallow.

**Solution:** one error module whose interface accepts a typed failure and returns canonical prose plus its surface (field alert or global banner). Controllers keep typed results; handlers request wording; global listeners feed the same module. Runtime Readiness semantics stay unchanged.

- `describe("error meaning")`
  - `it should map every controller error kind to one canonical prose string`
  - `it should select a field alert for expected validation and the global banner for uncaught failures`
  - `it should keep the local catch leverage for the three command handlers`
  - `it should preserve Runtime Readiness and safe-action wording on a RuntimeNotWritable result`
  - `it should ignore element-targeted resource errors such as favicon 404`
- **Red/green:** `npx vitest run tests/unit/error-meaning.test.ts -t "<case>"` and `npx playwright test e2e/global-error.spec.ts -g "<case>"`.
- **Removal:** delete the per-handler kind→prose switches in `App.tsx`, the string collapse in `plan-controller.ts` and the bare-kind collapse in `review-controller.ts`; wording lives in one error module only. The three local catches remain as surface selectors, but no handler keeps its own message mapping. `issue-copy.ts` merges into that module rather than staying a parallel wording source. Tests of old wording migrate to the error module; if the same error string is produced in two places, R6 is incomplete.
- **Critic flow:** `B(r6-errors)` — unguarded storage throw on Accounts and Review, synthetic rejection + Dismiss, Long Call without `crypto.randomUUID`, empty Strike local alert, favicon no-op.

## Cumulative verification before each critic
`npm run test:all`, `npm run test:integration`, `npx playwright test`, `npm run lint`, `npm run typecheck`, `npm run typecheck:6`, `npm run build`, production offline test. Every defect found by a critic gets a failing test first, then a fix, then all suites, then a fresh repeat critic.

## Acceptance for D8aR
- All six deepening opportunities implemented with their named seams and tests.
- All D1–D8a structural, unit, integration and browser suites remain green; D8a acceptance scenarios unchanged.
- No new trader-visible capability; the two corrected defects are the only result changes.
- No D9 research, planning or code started before D8aR is released.

## Release
Write `plan/d8ar-execution-record.md`, commit `refactor(d8a): ...`, tag `hy4-flash-d8ar-complete`, push branch and tag, verify with `git ls-remote`.
