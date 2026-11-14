# T8P.22: browser checks that measured the Summary card and retire with it (revision 96)

Lines are those of `e2e/d2/ui-alignment.spec.ts` before T8P.22 (base `0e9ac4c2`). T8P.25's layout cases name the cockpit check that replaces each one.

| Was | Title | What it asserted | Why it has no subject now |
|---|---|---|---|
| :1111 (removed) | should set the summary card figures at 18 px or more, bold and tabular | At 390 and 1280 px, every `dd` of the Summary card (at least five) had a computed font size of 18 px or more, weight 600 or more, and tabular numerals. | The Summary card is no longer rendered, and its `.summary-card dd` rule is removed from `legacy-detail.css`. Its figures are in the Position, Plan and Risk cards and the identity card, which have their own figure styling. |
| :1135 (removed) | should show Stop and Target with their labels in colours that reach 4.5:1 on white | The Summary card's Stop and Target `dd` used the `--stop` and `--target` tokens as their colour, and each reached 4.5:1 against `--card`. | The Summary card's Stop and Target figures are gone (the `.summary-card .stop` and `.target` rules are removed). The Plan card repeats the Stop and Target without that colour rule, and the Conditions card colours its own `condition-role` labels. |
| :1361 to :1373 (the assertion only; the test stays, retitled) | should keep every label/value row on the Planned and Open Details at most 480 px wide at 1280 (was "... with the summary values on one right edge") | In the Planned and Open states, every Summary-card `dd` had its right edge within 1 px of the others. | The Summary card is gone, so there is no column of summary values. The 480 px row-width check in the same test stays, on every drawer's rows. |

Moved, not retired (the reads have a place, so their assertions stay with the same expected values):

- :1329 to :1338, "should lead the summary card of a just-confirmed Planned Detail ...": the Trade Summary text and its position as the first element now read the Plan and Risk drawer (`detail.tradeSummary`), before and after a reload.
- :1558 to :1590, "should keep "@" with its price in the Detail summary card Trade text at 320, 340 and 390": the Trade Summary text now reads the Position drawer on the Open Detail and Plan and Risk on the Planned one; the "@ stays with its price" check is unchanged.
