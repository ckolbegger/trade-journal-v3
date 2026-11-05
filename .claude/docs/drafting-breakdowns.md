# Drafting a deliverable's breakdown

- Read `specs/` in full. The scoped reading lists (plan decision 45) are for implementing, not drafting.
- Retag the deliverable's sections in `plan/spec-map.md`, then regenerate the reading lists with `.claude/scripts/spec-reading-lists.py`.
- Until tech debt item 10 is resolved, add no previous-release harness task, no upgrade case from the previous release and no critic update flow, and no gate runs `npm run test:e2e:release-history` (decision 76, replacing decision 71's P56 rule). The `@release-history` cases run at RC, before the first release for real use.
- List each task's `it should` cases in an order where every case introduces behavior the earlier cases do not already require, so each one can go red on its own and first-run passes needing a mutation check stay rare.
