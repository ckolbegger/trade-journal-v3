# T9AR.24-B7-D1 (structural: two style fixes, no behavior change)

- corridor-pnl.tsx: the flag's `tie` nested ternary became if / else if.
- corridor.test.tsx: the B2 and B3 case's fixture uses a plain `pnlAt(i)` like T9AR.24-B7-F1's.
- `npx vitest run src/ui/cockpit/replay`: 14 files, 241 tests passed, no expected value changed.
- `npm run typecheck`: exit 0. `npm run lint`: exit 0.
