# "Trade" names the campaign; "Position" names current holdings

The strategic unit (campaign with one thesis) is called Trade, matching trader vernacular — "I'm in a trade," "trade plan," and the app's own name, trade journal. Position is redefined to match brokerage usage: the derived current holdings of a Trade (net open quantity across its Legs), never stored. The original naming (Position = campaign) was rejected because a "planned Position" or "closed Position" holds nothing, which contradicts every broker's use of the word.

The known cost: "trade" also colloquially means a single fill. That sense is banned everywhere — glossary, UI copy, code — an individual fill is always an Execution. If any surface ever says "add a trade" meaning a fill, this vocabulary collapses; guard it in review.
