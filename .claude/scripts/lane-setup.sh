#!/bin/bash
# usage: lane-setup.sh      (run first by every lane task, inside its lane worktree)
# Prepares a lane worktree of a swarm deliverable (decision 111). The lane is a git worktree under
# <deliverable worktree>/.claude/worktrees/. The script:
#   1. clones the deliverable worktree's node_modules into the lane with `cp -c -R` (APFS clone);
#   2. runs tools/install-hooks.sh, so `git rev-parse --git-path hooks` reads .githooks in the lane;
#   3. copies the gitignored .env.local and checks it holds DEV_PORT=5175;
#   4. clones the gitignored dist-releases/ (verify:releases in the checks stage needs it).
# The source worktree is derived from the lane's own path (the directory that contains
# .claude/worktrees/), never from `git worktree list` or the shared git directory, which lead to
# the main checkout and to other implementations' worktrees. Refuses to run anywhere else.
# Rerunning is safe: an existing node_modules or .env.local is left alone.
set -eu
# source_root_of <lane path>: prints the source root, the path before the INNERMOST .claude/worktrees/
# component (the deliverable worktree may itself sit inside a .claude/worktrees/ directory).
source_root_of() {
  case "$1" in
    */.claude/worktrees/*) echo "${1%/.claude/worktrees/*}" ;;
    *) echo "lane-setup: $1 is not under a .claude/worktrees/ directory; run this inside a lane worktree" >&2; return 2 ;;
  esac
}
# Query mode for the test: --print-source-root <path> prints the source root and exits, cloning nothing.
if [[ "${1:-}" == --print-source-root ]]; then
  source_root_of "${2:?lane-setup: --print-source-root needs a path}"
  exit
fi
root=$(git rev-parse --show-toplevel)
cd "$root"
source_root=$(source_root_of "$root") || exit 2
[[ -f "$source_root/package.json" && -d "$source_root/node_modules" ]] || {
  echo "lane-setup: $source_root is not an installed deliverable worktree (no package.json or node_modules)" >&2; exit 2; }
[[ "$source_root" != "$root" ]] || { echo "lane-setup: lane root equals its source root" >&2; exit 2; }
echo "lane-setup: lane $root, source $source_root"

if [[ -e node_modules ]]; then
  echo "lane-setup: node_modules already present; left alone"
else
  cp -c -R "$source_root/node_modules" node_modules
  echo "lane-setup: cloned node_modules (cp -c -R)"
fi

# verify:releases (a checks-stage command) reads dist-releases/, the gitignored build of the frozen
# release tags, which are the same in every lane. Clone it rather than rebuild it.
if [[ -e dist-releases ]]; then
  echo "lane-setup: dist-releases already present; left alone"
elif [[ -d "$source_root/dist-releases" ]]; then
  cp -c -R "$source_root/dist-releases" dist-releases
  echo "lane-setup: cloned dist-releases (cp -c -R)"
else
  echo "lane-setup: $source_root has no dist-releases; verify:releases will fail until npm run build:releases runs (inside the browser lock)" >&2
fi

sh tools/install-hooks.sh
hooks=$(git rev-parse --git-path hooks)
[[ "$hooks" == .githooks || "$hooks" == "$root/.githooks" ]] || { echo "lane-setup: hooks path is $hooks, expected .githooks" >&2; exit 1; }

if [[ -f .env.local ]]; then
  echo "lane-setup: .env.local already present; left alone"
else
  [[ -f "$source_root/.env.local" ]] || { echo "lane-setup: $source_root/.env.local is missing" >&2; exit 1; }
  cp "$source_root/.env.local" .env.local
  echo "lane-setup: copied .env.local"
fi
grep -qx 'DEV_PORT=5175' .env.local || { echo "lane-setup: .env.local does not hold DEV_PORT=5175" >&2; exit 1; }
echo "lane-setup: done (node_modules, hooks=$hooks, DEV_PORT=5175)"
