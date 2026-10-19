# D1 structural verifications

Each entry records a structural task's exact verification, as D1's breakdown, section 5, specifies.

## T1.1 Toolchain and repository scaffold

Run 2026-10-18 on the machine and versions in [provenance.md](provenance.md).

**Verification (breakdown, section 5):**

```bash
npm ci && npm run typecheck && npx tsc6 --noEmit && npm run lint && npm run test:unit && npm run build && npm run preview -- --strictPort
npx tsc --version
npx tsc6 --version
```

| Step | Result |
|---|---|
| `npm ci` | exit 0, from the committed `package-lock.json`, without `--legacy-peer-deps`; no peer-dependency errors |
| `npm run typecheck` (`tsc`) | exit 0 |
| `npx tsc6 --noEmit` | exit 0 |
| `npm run lint` (`eslint .`, typed linting) | exit 0 |
| `npm run test:unit` (`vitest run`) | exit 0; "No test files found" (`passWithNoTests` until T1.5 adds the first tests) |
| `npm run build` (`vite build`) | exit 0; `dist/index.html` and one JS asset |
| `npm run preview -- --strictPort` | listens on `http://localhost:5175/`; `GET /` returned 200 |
| `npx tsc --version` | `Version 7.0.2` |
| `npx tsc6 --version` | `Version 6.0.3` |

**Supporting checks**

- **The checkers are not vacuous.** A temporary `src/zz-probe.ts` containing `const x: number = 'a'` made `npx tsc` exit 1 and `npx tsc6 --noEmit` exit 2. The file was deleted afterwards.
- **Strict port.** With one preview running on 5175, a second `vite preview --strictPort` exited 1 with `Error: Port 5175 is already in use` rather than choosing another port. `vite.config.ts` also sets `strictPort: true` for both `server` and `preview`, and fails if `DEV_PORT` is missing from `.env.local`.
- **TypeScript resolution (decision 44).** `node_modules/.bin/tsc` links to `@typescript/native/bin/tsc` (7.0.2); `node_modules/.bin/tsc6` links to the wrapper's `bin/tsc6`; `require("typescript").version` is `6.0.3`, so typed linting runs on 6.0.3. `npm ls` shows every `typescript-eslint` package deduped onto `typescript@npm:@typescript/typescript6@6.0.2`, whose `@typescript/old` dependency the `overrides` entry pins to `typescript@6.0.3`.
- **`tsconfig.json`** sets 6.0/7.0's changed defaults explicitly (`target`, `module`, `moduleResolution`, `types`, `rootDir`, `strict`, `esModuleInterop`, `noUncheckedSideEffectImports`, `libReplacement`) and uses none of the options 7.0 removed (no `baseUrl`, no `moduleResolution: node10`, no `target: es5`, no `outFile`, no `downlevelIteration`).
- **Node enforcement.** `package.json` declares `"engines": { "node": ">=26.12.0 <27" }` and `.npmrc` sets `engine-strict=true` (`npm config get engine-strict` prints `true`). The refusal of another Node major was **not exercised**: npm 11.20.0 no longer accepts the `--node-version` setting that could simulate one, and the handoff forbids installing another Node.

**Editor TypeScript server (open detail from the handoff).** The wrapper package ships `lib/typescript.js`, `lib/tsserverlibrary.js`, and `lib/tsc.js`, but **no `lib/tsserver.js`**, so an editor that looks for `node_modules/typescript/lib/tsserver.js` will not find a workspace server. `node_modules/@typescript/old/lib/tsserver.js` (6.0.3) exists; pointing the editor there (for VS Code, `"typescript.tsdk": "node_modules/@typescript/old/lib"`) fixes it. This affects editor feedback only, not the build or tests. `.vscode/` is gitignored, so no editor setting is committed.

**Notes**

- npm 11.20.0 withheld three install scripts not covered by `allowScripts`: `esbuild@0.28.1`, `fsevents@2.3.3`, and `workerd@1.20261001.1`. None is needed by any T1.1 step (the build, preview, lint, and type checks all pass without them). `workerd` belongs to `wrangler`, which is not used until a Cloudflare publish.
- `npm audit` reports 3 high-severity findings, all in `sharp` (CVE-2026-96889, via `miniflare`) pulled in by the pinned `wrangler@4.147.0`, a deploy-only development tool. The suggested fix is `wrangler@4.151.1`, which would change a pin and so needs a plan revision. Raised with the user; not changed here.
