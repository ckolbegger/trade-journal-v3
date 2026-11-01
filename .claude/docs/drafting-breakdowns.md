# Drafting a deliverable's breakdown

- Read `specs/` in full. The scoped reading lists (plan decision 45) are for implementing, not drafting.
- Retag the deliverable's sections in `plan/spec-map.md`, then regenerate the reading lists with `.claude/scripts/spec-reading-lists.py`.
- When a task points the deliverable's previous release at a tag, the same task tags `@release-history` on any update case whose two ends are then both tag builds (decision 71, P56). Such a case leaves `npm run test:e2e` and runs in `npm run test:e2e:release-history` and RC; the deliverable's browser-suite task runs both commands.
- List each task's `it should` cases in an order where every case introduces behavior the earlier cases do not already require, so each one can go red on its own and first-run passes needing a mutation check stay rare.
