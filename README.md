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
