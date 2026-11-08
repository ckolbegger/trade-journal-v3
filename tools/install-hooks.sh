#!/bin/sh
# Enables .githooks/pre-commit for this worktree only (D7 retro, finding 7).
# Runs from npm "prepare". Exits 0 without changes when git is missing or the
# directory is not a work tree (Cloudflare Pages build, npm tarball).
# Works on the current directory (npm runs prepare at the package root).
command -v git >/dev/null 2>&1 || { echo "install-hooks: git not found; skipped"; exit 0; }
[ "$(git rev-parse --is-inside-work-tree 2>/dev/null)" = "true" ] || { echo "install-hooks: not a git work tree; skipped"; exit 0; }
[ -d .githooks ] || { echo "install-hooks: no .githooks directory; skipped"; exit 0; }

if [ "$(git rev-parse --git-path hooks 2>/dev/null)" = ".githooks" ]; then
  echo "install-hooks: already enabled (core.hooksPath=.githooks)"
  exit 0
fi
git config extensions.worktreeConfig true && git config --worktree core.hooksPath .githooks || { echo "install-hooks: git config failed; skipped"; exit 0; }
echo "install-hooks: enabled core.hooksPath=.githooks for this worktree"
