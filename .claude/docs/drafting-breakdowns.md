# Drafting a deliverable's breakdown

- Read `specs/` in full. The scoped reading lists (plan decision 45) are for implementing, not drafting.
- Retag the deliverable's sections in `plan/spec-map.md`, then regenerate the reading lists with `.claude/scripts/spec-reading-lists.py`.
- Until tech debt item 10 is resolved, add no previous-release harness task, no upgrade case from the previous release and no critic update flow, and no gate runs `npm run test:e2e:release-history` (decision 76, replacing decision 71's P56 rule). The `@release-history` cases run at RC, before the first release for real use.
- Build each list of affected code by lookup, never from memory, and put the lookup's output in the breakdown (D7 prefactor retro, finding 2):
  - **Texts:** for every text the deliverable changes, grep `e2e/`, `tests/` and `src/**/*.test.*` for the old string. The list of changing expectations is that grep's output.
  - **Shapes:** for every derived shape that changes, grep `tests/fixtures/` and the `verify:*` tools for its fields.
  - **Checks:** for every new check, run a throwaway version on the current tree, and list each hit with what happens to it.
- A planned check on source code is a `no-restricted-syntax` rule in an ESLint config, as `eslint.deps.config.js` and `eslint.wording.config.js` do, never a new scanner under `tools/` (D7 prefactor retro, finding 1).
- List each task's `it should` cases in an order where every case introduces behavior the earlier cases do not already require, so each one can go red on its own and first-run passes needing a mutation check stay rare.
