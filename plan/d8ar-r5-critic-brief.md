# D8aR R5 — Close Review obligation read: focused critic brief

Independent critic for the fifth D8aR deepening. Read-only: modify nothing. Start the app yourself, drive the production UI, return a structured report. Frozen `specs/` and plan files read-only. DEV-001: loopback `http://localhost:5182` only, never production HTTPS.

## What changed
`src/ui/obligation-read.ts` is now the one read for a Close Review obligation. `close-review-controller.ts` no longer has its id-prefix `currentOutcome`; `App.tsx` no longer has its obligation-key `loadCloseReviewState`; `review-controller.ts` no longer string-matches `settlementRoute`. Effective-outcome precedence (Entry > JournalDecline > unsettled Debt) and due semantics live in the one module; storage nouns do not escape its result.

## Start
From worktree root run `npm run dev` (port 5182). Use `playwright-cli` at `http://localhost:5182`. Close the browser and stop the server when done.

## Flows
1. **Defer shows Outstanding Debt in both places.** Onboard, confirm and close a Long Stock Trade with a **Defer** Close Review (no journal writing). Closed detail must show the Close Review status `Outstanding Debt` with `Needs you`; Daily Review must list the same Debt as due with a Resolve action. No global banner.
2. **Answer from Review, then both reads agree.** In Daily Review, answer that Debt with the required TakeAgain answer. Confirm the Debt is settled, the Journal narrative shows exactly one Close Review Entry, and Closed detail now shows the saved outcome with no duplicate narrative row.
3. **Complete and Decline stay correct.** Close a second Trade with a **Complete** Close Review and a third with **Decline**. Closed detail must show `Saved` / `Declined` respectively and each narrative row must appear exactly once. Review must not list them as outstanding Debts.
4. **Management-revision Debt still routes to Trade Workflow.** If the UI can produce such a Debt, report; otherwise use IndexedDB seeding via `page.evaluate` to insert a Debt with `obligationKey: ManagementRevision:<id>`, open Review, and confirm the reported message is the Trade-Workflow one rather than a generic validation. No file edits.

For each flow: actions, observed result, PASS/FAIL. Any FAIL needs repro, expected vs actual and a screenshot. Report exact browser/OS versions. Edit nothing.
