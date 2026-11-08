#!/bin/sh
# Enables .githooks/pre-commit for this worktree only (D7 retro, finding 7).
# Runs from npm "prepare". Exits 0 without changes when git is missing or the
# directory is not a work tree (Cloudflare Pages build, npm tarball).
# Works on the current directory (npm runs prepare at the package root).
command -v git >/dev/null 2>&1 || { echo "install-hooks: git not found; skipped"; exit 0; }
[ "$(git rev-parse --is-inside-work-tree 2>/dev/null)" = "true" ] || { echo "install-hooks: not a git work tree; skipped"; exit 0; }
[ -d .githooks ] || { echo "install-hooks: no .githooks directory; skipped"; exit 0; }

# Only a worktree-scope value counts: a value inherited from the shared or
# global config can change later. Without extensions.worktreeConfig,
# --worktree reads the shared config, so require the extension too.
if [ "$(git config --local --type=bool --get extensions.worktreeConfig 2>/dev/null)" = "true" ] &&
  [ "$(git config --worktree --get core.hooksPath 2>/dev/null)" = ".githooks" ]; then
  echo "install-hooks: already enabled (core.hooksPath=.githooks)"
  exit 0
fi
# Enabling extensions.worktreeConfig makes linked worktrees inherit a shared
# core.bare=true or core.worktree, so change nothing in that case.
if [ "$(git config --local --type=bool --get core.bare 2>/dev/null)" = "true" ]; then
  echo "install-hooks: shared config has core.bare=true; skipped (move it into the main worktree's config.worktree, see git-worktree docs, section CONFIGURATION FILE)"
  exit 0
fi
if git config --local --get core.worktree >/dev/null 2>&1; then
  echo "install-hooks: shared config has core.worktree set; skipped (move it into the main worktree's config.worktree, see git-worktree docs, section CONFIGURATION FILE)"
  exit 0
fi
git config extensions.worktreeConfig true && git config --worktree core.hooksPath .githooks || { echo "install-hooks: git config failed; skipped"; exit 0; }
echo "install-hooks: enabled core.hooksPath=.githooks for this worktree"
