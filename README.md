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
