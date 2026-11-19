# D09AR TDD log, T9AR.24-B7-B3

B3 shares its fix and its cases with T9AR.24-B7-B2 (one commit): the case "should join the Stop breached label to its pole, paint it above every drawn shape and keep it off the cursor line" asserts both. Its red, green, e2e red and green rows are in `T9AR.24-B7-B2.md`. Its B3 clauses, the halo, painted-after-everything and the cursor line, passed on the old code except the cursor line (the red row: "the label crosses the cursor line"); the halo and the paint order are the existing CSS and DOM order, now asserted, not changed.
