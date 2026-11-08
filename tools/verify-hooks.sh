#!/bin/sh
# Fails when the pre-commit hook is not enabled for this worktree.
cd "$(dirname "$0")/.." || exit 1
fix="run 'npm install' (or 'sh tools/install-hooks.sh')"
if [ "$(git rev-parse --git-path hooks 2>/dev/null)" != ".githooks" ]; then
  echo "verify:hooks: core.hooksPath is not .githooks for this worktree; $fix" >&2
  exit 1
fi
if [ ! -x .githooks/pre-commit ]; then
  echo "verify:hooks: .githooks/pre-commit is missing or not executable; chmod +x it, or $fix" >&2
  exit 1
fi
echo "verify:hooks: pre-commit hook enabled"
