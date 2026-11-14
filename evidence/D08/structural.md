# D08 structural verifications

Each entry records a structural task's exact verification (D08 breakdown, section 5), each lane tier, each merge run, and each task's `ocr-review` findings and bug tasks under the task's heading (raw outputs in `ocr/`). D8 runs as a swarm under decision 111: each lane task ends with its lane tier (unit, integration, checks, in its lane worktree); the complete cumulative run runs once per merge batch on `claude-opus-5.5`, with the full tier before every critic. Full outputs are in `suite-runs/`. Versions are in [provenance.md](provenance.md).

## Start of D8

Session lock `.claude/session.lock` taken (none existed). Location checks (D8 handoff, section 1) on 2026-11-14:
- worktree `/Users/ckolbegger/src/trade-journal-v3/worktrees/claude-opus-5.5`, branch `claude-opus-5.5`: matched.
- `git status -sb`: `## claude-opus-5.5...origin/claude-opus-5.5`, clean.
- `git log --oneline claude-opus-5.5-pre-d08..HEAD`: one commit, `8374b793` "docs(plan): D8 handoff".
- `claude-opus-5.5-plan-r102^{commit}` and `claude-opus-5.5-pre-d08^{commit}`: both `3de5f838f5e397e55119fba282f05d5f1d68e239`.
- `claude-opus-5.5-d08p^{commit}`: `05b914afeec35ebdaa84c25f65a20ade5c3d0323`.
- `git diff --stat 4028908d claude-opus-5.5-pre-d08 -- src e2e tests tools package.json package-lock.json 'eslint*'`: empty.
- `ls .claude/worktrees`: absent.
- `git rev-parse --git-path hooks`: `.githooks`.
- `ocr llm test`: `✓ Connection test successful` (and `✓ Tool-call round trip verified`).
- `DEV_PORT=5175`; Node v26.12.0.
- `npm ci`: exit 0. `npx vitest run --project unit`: `Test Files 162 passed (162)`, `Tests 1748 passed (1748)`. `npx vitest run tests/integration`: `Test Files 106 passed (106)`, `Tests 229 passed (229)`.

**Reading.** The D8 breakdown in full; `plan/implementation-plan.md` except the D9–D28 definitions (decisions 1–113, freeze record, rules and cumulative obligations, the D08P and D8 definitions, parallelism, coverage index, review queue, tech debt); `plan/technology-stack.md`; the acceptance matrix's opening sections; D08P sections 9 and 4.2; approved-words conventions C1–C8. From `plan/spec-reading/D08.md`: `specs/README.md` 1–100, the acceptance contract's ranges (AC-BACK-001 through AC-CAP-001), every ADR, `specs/design/workspace.md` and `delivery-contract.md`. The remaining ranges (UI contract, glossary, the module design files and the overview ranges) are read before the briefs that build on them, and noted here.

**Lane creation.** Lanes are created by the main session with `git worktree add .claude/worktrees/d08-<lane> -b d08/<lane> <head>` inside this worktree, and each `tdd-task` is dispatched without the isolation flag, told to work only in that lane's absolute path. This follows the user's decision of 2026-11-13 in D08P (`evidence/D08P/structural.md`, "Lane creation"): the Agent tool's `isolation: "worktree"` creates its worktrees under the main checkout from a commit without `plan/` or `.claude/scripts/`. The path and branch are section 3.2's.

## T8.1 Artifact format

Lane F, commit `fdd92d08` (6 cases red then green; one first-run pass flagged: "should accept records pushed one at a time", mutation-checked, see `tdd-log/T8.1.md`). Lane tier `T8.1`: unit 165 files / 1754 tests, integration 106 / 229, checks pass. `@noble/hashes` 2.4.0 and `fflate` 0.8.3 were already exact pins in `package.json` and `package-lock.json` at the base commit, so T8.1 changed neither (A226's `npm install` is expected to change nothing).

**ocr review of `fdd92d08`** (session `a59b69e2-a670-42ad-8601-ce119ce9875d`, gpt-6.1-sol, 8 files, 7 findings; raw: `ocr/T8.1-fdd92d08.json`). All 7 judged Valid, so each becomes a bug task, run one at a time in lane F:

| Bug task | Finding | Defect | `it should` case |
|---|---|---|---|
| T8.1-B1 | `reader.ts:88` returns at the manifest line without reading the rest of the stream | a damaged gzip trailer, or content after the manifest, goes undetected | it should report Corrupt when the gzip trailer is damaged or content follows the manifest line |
| T8.1-B2 | `reader.ts:19` never cancels or releases the source on early return, error or an abandoned iteration | the source stream stays locked and its cancel never runs | it should cancel the source stream when the consumer stops early or the read fails |
| T8.1-B3 | `reader.ts:110` sniffs the gzip magic only in the first two chunks | an empty leading or middle chunk makes valid gzip read as plain text | it should detect gzip when the magic bytes arrive after or across empty chunks |
| T8.1-B4 | `writer.ts:43` `writeSectionEnd` for a section other than the open one writes an empty digest | a caller slip yields an artifact that fails verification | it should throw when writeSectionEnd names a section other than the open one |
| T8.1-B5 | `writer.ts:52` `finish()` accepts an open section | a forgotten section end yields a quietly incomplete artifact | it should throw when finish is called while a section is open |
| T8.1-B6 | `canonical-json.ts:38` sparse-array holes become empty text | invalid JSON or a silently dropped element | it should reject a sparse array hole with CanonicalJsonUnsupported naming its path |
| T8.1-B7 | `writer.ts:21` a section named `__proto__` is lost from the plain-object digest map | the section is missing from the manifest and returned digests | it should record a section named __proto__ in the manifest and returned digests |

- **T8.1-B1** `cf7c5795`: red (assertion: no `ArtifactReadError`) then green; the manifest line is yielded only after the stream drains clean. Lane tier: unit 1755, integration 229, checks 14 of 14. ocr (session `e924278e-371e-4427-b9d8-ee7b463a13a5`, 2 files): **No findings.** Raw: `ocr/T8.1-B1-cf7c5795.json`.
- **T8.1-B2** `3a48d696`: red ("expected +0 to be 1": no cancel after `break`) then green; `try/finally` cancels the source reader. Lane tier: unit 1756, integration 229, checks 14 of 14. ocr (session `00b8f02e-3356-4259-8c9d-8420f1c8b628`, 2 files): **No findings.** Raw: `ocr/T8.1-B2-3a48d696.json`.
- **T8.1-B3** `9e731c68`: red (gzip read as plain text: "not valid for encoding utf-8") then green; the sniff skips empty chunks. Lane tier: unit 1757, integration 229, checks 14 of 14. ocr (session `e5093f15-9809-497f-b71a-5c95ff35c8d6`, 2 files): **No findings.** Raw: `ocr/T8.1-B3-9e731c68.json`.
- **T8.1-B4** `b137b550`: red ("expected [Function] to throw") then green; `writeSectionEnd` throws "Section trades is still open; cannot end section journal". Implementation-level choice accepted: ending a section with nothing open stays legal (an empty section, digest = SHA-256 of nothing), since an empty store must export; the brief's extra "no section open" throw was the main session's addition, not ocr's finding. Lane tier: unit 1758, integration 229, checks 14 of 14. ocr (session `fdfe7bee-5793-4eb5-bd9f-e90524ef6657`, 2 files): **No findings.** Raw: `ocr/T8.1-B4-b137b550.json`.

## T8.23 Types, skeletons and ports

Lane T, commit `f6bce21e`. Verification (section 5) in the lane's `T8.23-verification.md`, copied here at merge: typecheck, `tsc6 --noEmit`, lint, lint:deps exit 0; `npx vitest run --project unit` 162 files / 1748 tests (unchanged). Lane tier `T8.23`: unit 162 / 1748, integration 106 / 229, checks 14 of 14.

**Implementation-level choices (recorded, not stops).** (1) NodeTestHost lives in `tests/support/node-test-host.ts`; section 3.2's "`tests/integration/d1/support.ts`'s NodeTestHost" names the wrong file, so the task edited the real one, which no other lane owns. (2) A new `src/coordinators/workspace/backup-types.ts` holds the shared shapes, because coordinators can't import `src/app`; `src/app/types.ts` re-exports them. (3) `backup.ts` and `restore.ts` take their own deps interfaces that `WorkspaceDeps` satisfies structurally, to avoid import cycles. A WB or WR task that needs a dependency `WorkspaceDeps` lacks would edit `workspace.ts`, which is a pending decision (section 3.2). (4) A127: `WorkspaceSnapshotBinding` already holds `databaseName` and `contentRevision`; unchanged. (5) `StatusBase.backupActions?` is optional and unset until T8.10.

**ocr review of `f6bce21e`** (session `8d6da0c5-7fa6-42cd-8c51-2e0ac2e51776`, gpt-6.1-sol, 12 files, 1 finding; raw: `ocr/T8.23-f6bce21e.json`):

| Bug task | Finding | Defect | `it should` case |
|---|---|---|---|
| T8.23-B1 | `src/ui/backup/test-support.ts:29` a throwing responder escapes synchronously | a UI test asserting a rejected operation sees a synchronous throw instead | it should return a rejected promise when a configured responder throws |

## Critic cost

| Critic | Report | Flows | Result | Tokens | Tool calls | Duration | Brief |
|---|---|---|---|---|---|---|---|

## Lane worktrees

| Task | Lane | Worktree | Branch | Base |
|---|---|---|---|---|
| T8.1 | F (wave 0) | `.claude/worktrees/d08-f` | `d08/f` | `a6c88cdd` |
| T8.23 | T (wave 0) | `.claude/worktrees/d08-t` | `d08/t` | `a6c88cdd` |
| T8.3 | PS (wave 1) | `.claude/worktrees/d08-ps` | `d08/ps` | `fdc5e858` |
| T8.14 | US (wave 1) | `.claude/worktrees/d08-us` | `d08/us` | `fdc5e858` |
| T8.12 | UB (wave 1) | `.claude/worktrees/d08-ub` | `d08/ub` | `9312835b` |

## Flakes

| Run | Test | Targeted rerun |
|---|---|---|
