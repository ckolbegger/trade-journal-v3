Committed violation fixtures (D1 T1.4; the last two from D4 T4.19). Each folder must make `npm run lint:deps -- <folder>` fail with its named rule:

| Folder | Rule |
|---|---|
| `ui-imports-module` | `ui-only-through-facade` (dependency-cruiser) |
| `domain-uses-date-now` | `domain-purity` (ESLint) |
| `reads-user-agent` | `no-identity` (ESLint) |
| `trade-analysis-imports-session-policy` | `trade-analysis-never-sees-session-policy` (dependency-cruiser) |
| `daily-review-imports-session-policy` | `daily-review-never-sees-session-policy` (dependency-cruiser) |
