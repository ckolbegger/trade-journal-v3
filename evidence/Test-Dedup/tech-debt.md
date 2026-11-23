# Test dedup tech debt

| # | Source | Kind | Item |
|---|---|---|---|
| 1 | TD.10 (`6cfec5d0`); the user, 2026-11-23: record as tech debt | Layout | On the Planned list at 320 px wide, with two Planned rows each showing a "Records disagree" badge (ABC, and XYZ, which can't be replayed), a Trade cell ends about 13 px outside the table's scroll region: right edge 317.8 px against a bound of 304.5 px. Found when TD.10 moved `e2e/d2/ui-alignment.spec.ts` "should keep a Records disagree badge inside the scroll region at 320 and 390" (one row) into "should keep a Records disagree badge inside the viewport with the Trade cell at 390 and 320" (two rows); the stricter check failed there, so both cases were kept (rule 6) and BD18 was not removed. Which row is "cell 1" was not confirmed (likely XYZ). Decide whether the cell must end inside the region (a layout fix, then BD18 can be removed) or whether sideways scroll there is acceptable. |
