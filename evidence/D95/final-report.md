# D9.5 final report — the Daily Review redesign

Date: 2026-11-27. Branch `claude-opus-5.5`. Tag `claude-opus-5.5-d9.5`. Frozen plan: revision 130 (decision 141).

## Result

**Agent-done.** All 83 rows of the breakdown's Progress table are Done: Parts A, B and C, the three gates (T95.26, T95.46, T95.67), and the follow-ons and bug tasks. The final gate (T95.67) closed on critic C3 (PASS, one low defect), after run `t95.67-fixes-2` (unit 3,295; integration 394; browser 454 passed, 4 skipped; 14 of 14 checks) and `acceptance-commands.sh` (43 of 43). Every row of the breakdown's acceptance matrix (its section 12) is marked covered; AC-PERF-001 is covered without its `bench:run` measurement (Q18).

## Tasks and fix rounds

Each task's commits, its bug tasks (B), follow-ons (F) and user-decision follow-ons (D) are in the Progress table (`plan/D09.5-daily-review-redesign.md`, section 14). The 45 tasks with fix rounds:

- T95.3: `2f9575d9`; B1 `91ba3635`; B2 `a605bb92`
- T95.4: `4983cfc1`; B1 `f5db240e`; B2 `55788547`
- T95.5: `34d79930`; B1 `b92f956c`; B2 `6ec0a2ab`
- T95.6: `c0c8c27a`; B1 `f3038f3d`; B2 `72dd66a3`
- T95.7: `f9d319d3`; B1 `0a14caae`, `8f1e5f0a`; B1-D1 `ae590335`; F1 `8f0a419c`; F2 `38d61e16`; F2-B1 `8fbf57f3`; F2-B2 `a5edf731`; F3 `0fbe7978`
- T95.8: `85912096`; B1 `edaa9cc6`; B2 `69f574fa`
- T95.16: `f878796f`, D3 `77002281`, B1 `2dfeacb3`, B2 `0827a7bc`, B3 `347ace42`, B4 `5ba40d94`, B5 `e857812f`, F1 `2823e2b7`
- T95.17: `eb20b229`, D1 `5e00f791`, B1 `e0c4b85c`, B2 `1c1dc9e6`, B3 `31bb87f5`, F1 `b0a1f067`
- T95.18: `5307f1b1`, F1 `b34205bd`
- T95.19: `f14e8e71`, B1 `b00bec4a`, B2 `09f6f3d8`
- T95.21: `d542bfe9`, B1 `953cd3c0`, B2 `996d2ee5`
- T95.22: `0afb8500`, B1 `23a7393a`
- T95.23: `a8eef6af`, F1 `6dd789dc`
- T95.24: `78f40087`, B1 `8593a801`, B2 `d8c6ef5a`
- T95.25: `cfa99464`, B1 and B2 `6d25dc13`
- T95.26: critic-1, critic-2 and critic-3 (`evidence/D95/critic-3.md`: PASS; its one moderate defect moved to tech debt by the user); fixes B1, B2, B3, B4, B6; follow-ons F1, F2; B5 to tech debt
- T95.27: `d5f4ada1`, B1 `5e904f21`, B2 `5d17e26e`, B3 `b44f35cf`
- T95.28: `3cee01da`, B1 `9998748f`, B2 `707765c8`, B3 `1a8fb348`, F1 `7e2938c6`
- T95.28-F2: `f25aecb0`, B1 `622ab83e`, B2 `a2dbcc59`, F1 `ce52daf6`
- T95.30: `e0e2a55e`, B1 `e7092508`
- T95.31: `4803ac91`, F1 `efdae00f`
- T95.32: `096be3e1`, F1 `3934d569`
- T95.33: `45cdf246`, B1 `98860c07`, B2 `00361cce`, B3 `dbdfa898`
- T95.34: `785eee18`, B1 `96804a9d`, B2 `73001569`, B3 `00833676`, B4 `06df0de8`
- T95.35: `9c9c0275`, B1 `05194184`, B2 `970dc05f`
- T95.36: `04a1e1d4`, B1 `44ca55d0`, B2 `f2ff9bc6`, B3 `0c616a21`, B4 `c59d4ad7`
- T95.39: `a770136a`, B1 `634c0bcf`, B2 `cbccc891`
- T95.40: `25cc8ba3`, B1 `b8afe82d`, B2 `26286f6e`, B3 `86f6abd9`
- T95.41: `1173c055`, B1 `277640b3`, B2 `011130ff`
- T95.44: `a109c44e`, B1 `3d423c43`, B2 `ca2069f0`
- T95.45: `78d30f66`, B1 `8621f4b8`, B2 `67b66d97`, B3 `84af6c09`, B4 `d0349676`, B5 `f1faff8a`, B95.10 `00a4d031`
- T95.46: B1 `e7ead78f`, B2 `db2de383`, B3 `439f2f34`, B4 `1a774a68`, B5 `e0e2fdbb`, B6 `f90cd581`, B7 `26d98c55`, B8 `c4759ee2`, B9 `b5473f84`
- T95.48: `30301fad`; B1 `a43299b9`
- T95.49: `d7d38d7f`; B1 `4a1f86b6`; B2 `f4b9314a`
- T95.50: `cfdb6088`; B1 `9b8e9c38`
- T95.52: `6a7034e6`; B1 `73ea3b70`
- T95.54: `9f69da24`; B1 `1499c00f`
- T95.56: `801cd4bd`; B1 `e365c63d`; B2 `24ffd1de`
- T95.57: `26626d39`; B1 `774642b4`; B2 `92f7c50b`
- T95.58: `f6f84ca9`; B1 `57a35542`; B2 `0f1a0faa`; B3 `a81e038f`
- T95.59: `c26c6c70`; B1 `8f2d92f6`; B2 `9d0926e8`
- T95.60: `0e243169`; B1 `80a8e8df`
- T95.61: `146cb646`; B1 `6af3aa53`; B2 `2a58109d`; B3 `02d8ef62`
- T95.63: `4c8bab62`; B1 `371a35ae`
- T95.67: C1 `427a1fe3`; B1 `61c95ca5`; B2 `82920e50`; B3 `b2484a46`; B3-D1 `77c3c491`; B4 `d7a9fca1`; B4-B1 `61b4c3e4`; B5 `e590c2a4`; B5-B1 `1dd74e13`; B5-B2 `ad4e19bc`; B6 `301ca1e0`; B6-B1 `e2bb9fa2`; B6-B2 `7e4ba4ca`

Every task's ocr result, run and first-run passes are in `evidence/D95/structural.md` under its heading; dismissed ocr findings are recorded there with their reasons (the latest: T95.67-B5-B1's, a state the UI cannot reach).

## Cleanup before the gate (T95.66.5, decision 141)

At the user's direction, six pieces of D9.5-era code nothing reached were removed with their tests (13 unit cases, 1 integration case, about 670 lines): the Session grid's editable parts, "Closing the Trade"'s Close Review choices, a card's own Marks, the record-expiration route's `?from=review`, the Review's page-level Plan Call and expired-contract standing (5 fewer stored reads per Settlement Due Trade on each Review open), and the old blocker helpers. Older unused code found by the same audit is in the tech debt list.

## Flaky tests

- `tools/estimate-rules.test.ts:122` "should pass every file of the current tree" times out at 5 s under load (runs `t95.3-t95.5`, `t95.6-t95.7`); passes alone. Tech debt.
- `src/ui/screens/TradeList.test.tsx:154` (Open list state counts) failed once in run `t95.26-gate-2`; fixed by `ce3e1043` (1 of 12 failed under load before, 0 after).
- No flake in the final gate's runs.

## Decisions

Eighteen questions were asked (`evidence/D95/DECISIONS-PENDING.md`, Q1 to Q18 listed by number there); all are answered, none pending. Plan decisions 127, 128, 129, 130, 131, 136, 137, 138, 139, 140 and 141 (revisions 116, 117, 118, 120, 121, 125, 126, 127, 128, 129 and 130). Q17 was a word-only answer (W141: "Your loss on the trade is $X" / "Your net loss (gain) on the trade is $X" / "You keep $X"; `evidence/D95/word-decisions.md`). Q18: the benchmark's `bench:run` gap goes to tech debt.

Main-session decisions recorded for review: T95.66.5's full run stood as the final gate's run (no code changed between); the five critic C1 bug tasks shared one test run after the last; T95.67-B3's own ocr was covered by T95.67-B3-D1's review (it rewrote everything B3 changed).

## Critics

| Critic | Gate | Tokens | Tool calls | Time | Result |
|---|---|---|---|---|---|
| critic-1 | T95.26 | 315,588 | 250 | 29.1 min | 2 moderate, 4 low |
| critic-2 | T95.26 | 285,710 | 206 | 35.2 min | 3 moderate, 2 low |
| critic-3 | T95.26 | 253,884 | 177 | 23.7 min | PASS, 1 moderate (to tech debt by the user) |
| critic B1 | T95.46 | see `structural.md` | | | PASS, 2 moderate, 1 low |
| critic B2 | T95.46 | see `structural.md` | | | PASS, 2 moderate, 1 low |
| critic B3 | T95.46 | see `structural.md` | | | PASS, lows only |
| critic C1 | T95.67 | 364,982 | 638 | 33.9 min | PASS, 5 moderate, 4 low |
| critic C2 | T95.67 | 87,565 | 295 | 39.9 min | FAIL (1 moderate), 1 low |
| critic C3 | T95.67 | 350,625 | 346 | 37.2 min | PASS, 1 low |

## Benchmark (`evidence/D95/bench.md`)

Capacity passed every limit: restored usage 0.277 × the projection (limit 1.10), second Restore peak 0.515 × M (limit below 3), 1.164 × the baseline (limit 1.50). `bench:run` failed: `tools/bench-run.ts` still waits for the Review status block D9.5 removed, so the Review-open time was not measured. The user chose tech debt (Q18).

## For user review

- **Tech debt:** `evidence/D95/tech-debt.md` (style-only ocr findings, low critic defects and minor observations, the older unused code, the benchmark script). One minor observation asks for a ruling: the Now box measures expired contracts on the expiration evening, as the mockup draws, while Trade Detail says they are no longer measured.
- **New words awaiting approval:** `evidence/D95/new-words.md`.
- **Texts shortened under P137:** `evidence/D95/words-changed.md`.
- **Data added under the standing approval:** `evidence/D95/data-additions.md`.
- A $0.00 Trade result after a part sale reads "Your net gain on the trade is $0.00" (no wording covers it).

## Next

The next deliverable's handoff is not written: the agreed order puts D11 before D10, and that reorder is still to be made a plan revision (memory: "revise the plan only after the Review redesign is planned"). Ask the user which deliverable comes next and whether to make that revision first.
