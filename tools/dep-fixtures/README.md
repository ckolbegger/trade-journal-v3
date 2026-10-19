Committed violation fixtures for D1 T1.4. Each folder must make `npm run lint:deps -- <folder>` fail with its named rule:

| Folder | Rule |
|---|---|
| `ui-imports-module` | `ui-only-through-facade` (dependency-cruiser) |
| `domain-uses-date-now` | `domain-purity` (ESLint) |
| `reads-user-agent` | `no-identity` (ESLint) |
