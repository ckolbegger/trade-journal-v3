#!/usr/bin/env bash
# Set up a worktree for a model-specific branch at worktrees/<branch>,
# wiring the worktree-local symlinks the shared harness needs.
#
# Usage: scripts/setup-worktree.sh <branch>
#
# The relative symlinks tracked on main (.claude/skills/* -> ../../.agents/skills/*)
# only resolve when the worktree sits exactly two levels below the repo root,
# i.e. worktrees/<branch>. This script enforces that layout.
set -euo pipefail

if [ $# -ne 1 ]; then
    echo "usage: $0 <branch>" >&2
    exit 1
fi

branch=$1
root="$(cd "$(dirname "$0")/.." && pwd)"
cd "$root"

# Create the branch from main if it doesn't exist yet
if ! git show-ref --verify --quiet "refs/heads/$branch"; then
    git branch "$branch" main
    echo "created branch '$branch' from main"
fi

# Add the worktree in the standard location
if [ ! -d "worktrees/$branch" ]; then
    git worktree add "worktrees/$branch" "$branch"
fi

cd "worktrees/$branch"

# .agents -> repo-root .agents; makes the tracked .claude/skills links resolve
[ -e .agents ] || ln -s ../../.agents .agents

# For branches created before main tracked the harness
if [ ! -e .claude/skills ]; then
    mkdir -p .claude
    ln -s ../../../.agents/skills .claude/skills
fi
[ -e CLAUDE.md ] || ln -s ../../CLAUDE.md CLAUDE.md

# For agents that read AGENTS.md instead of CLAUDE.md
[ -e AGENTS.md ] || ln -s CLAUDE.md AGENTS.md

echo "worktree ready: worktrees/$branch"
echo "note: worktree-local symlinks are untracked; commit them on the branch if wanted"
