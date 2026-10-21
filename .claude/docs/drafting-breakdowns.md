# Drafting a deliverable's breakdown

- Read `specs/` in full. The scoped reading lists (plan decision 45) are for implementing, not drafting.
- Retag the deliverable's sections in `plan/spec-map.md`, then regenerate the reading lists with `.claude/scripts/spec-reading-lists.py`.
- List each task's `it should` cases in an order where every case introduces behavior the earlier cases do not already require, so each one can go red on its own and first-run passes needing a mutation check stay rare.
