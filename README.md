# Trade Journal v3

A set of dueling implementations of a trading journal app. Each version is built
in its own branch on a separate worktree under `worktrees/`, so different models
can implement the same spec independently and be compared side by side.

## Worktrees

| Branch       | Location                  |
| ------------ | ------------------------- |
| `claude`     | `worktrees/claude`        |
| `codex`      | `worktrees/codex`         |
| `glm`        | `worktrees/glm`           |
| `antigravity`| `worktrees/antigravity`   |
| `minimax`    | `worktrees/minimax`       |
| `kimi`       | `worktrees/kimi`          |
| `qwen3.8-27B`| `worktrees/qwen3.8-27B`   |

Each worktree is an isolated checkout of its branch. Work in a worktree does not
affect the others.

## Setting up a worktree

The shared harness lives on `main`: `.agents/skills/` holds the skill content,
`.claude/skills/` is a farm of relative symlinks into it, and `CLAUDE.md` holds
the shared instructions. Those relative links only resolve when a worktree sits
exactly two levels below the repo root, at `worktrees/<branch>` — keep that
layout.

To set up a worktree (creating the branch from `main` first if needed):

```sh
scripts/setup-worktree.sh <branch>
```

The script adds the worktree at `worktrees/<branch>` and creates the
worktree-local symlinks `main` doesn't track: `.agents -> ../../.agents`
(which makes the tracked `.claude/skills` links resolve) and
`AGENTS.md -> CLAUDE.md` for agents that read `AGENTS.md`. For branches
predating the shared harness it also links `CLAUDE.md` and `.claude/skills`
back to the repo root. The created symlinks are left uncommitted; commit them
on the branch if you want them in its history.

## Dev server ports

Several agents run their dev servers on this host at once, so each worktree
gets its own port. Vite's default, `5173`, is reserved for `main`.

`scripts/setup-worktree.sh` assigns the port when it creates the worktree: it
finds the highest `DEV_PORT` in `worktrees/*/.env.local`, adds one (starting at
`5174`), and appends `DEV_PORT=<port>` to the new worktree's `.env.local`
(gitignored, never committed). Re-running the script keeps an existing port.
Check a worktree's port with:

```sh
grep DEV_PORT worktrees/<branch>/.env.local
```

The app in each worktree must use that port. In `vite.config.ts`, read
`DEV_PORT` and set `strictPort` so Vite fails instead of silently moving onto
another worktree's port:

```ts
import { defineConfig, loadEnv } from 'vite'

export default defineConfig(({ mode }) => {
  const port = Number(loadEnv(mode, process.cwd(), '').DEV_PORT || 5173)
  return {
    server: { port, strictPort: true },
    preview: { port, strictPort: true },
    // ...rest of the config
  }
})
```

Anything else that needs the dev server URL — e.g. Playwright's `baseURL` and
`webServer.url` — must read the same `DEV_PORT` rather than hardcoding `5173`:

```ts
import { loadEnv } from 'vite'
const port = Number(loadEnv('development', process.cwd(), '').DEV_PORT || 5173)
```
