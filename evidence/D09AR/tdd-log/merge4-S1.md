# merge4-S1 (e2e/d8/restore.spec.ts B8.3, Marks block missing after relaunch)

Cause: a race in the test helper viewsOf. It waited only for the Detail heading; the Detail shows before its replay is read (W20, unchanged since the D9 tag), and the Today Marks are built from the replay.

- before, unchanged helper, CPU throttle 20x (CDP Emulation.setCPUThrottlingRate, temporary hook, removed): 1 failed; Today lacked the Marks block and the "Wed Oct 14" labels (same diff as merge4). At 40x it passed once (timing).
- after, helper waits until no `[role=status]` says "Loading the Trade", same 20x, --repeat-each=3: 3 passed.
- whole e2e/d8/restore.spec.ts, no throttle, under the lock: 6 passed.
- Product: TradeDetail.tsx read order (Ready+Pending then replay) is identical to the D9 tag; the D9A-R diff adds only the Replay overlay.
