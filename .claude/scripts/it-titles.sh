#!/usr/bin/env bash
# Lists every test case collected by Vitest under src/, sorted, one per line, with no file names. Run before
# and after a test-file split and diff the two outputs: an empty diff means the same multiset of cases.
# Usage: it-titles.sh [dir]   (default: <repo>/src; Vitest's root is dir's parent, so its config applies)
#
# The cases come from Vitest's own collection (the Node API, `createVitest(...).collect()`), not from parsing
# source, so every form is covered: it, it.each (one line per concrete case), test, nested describe blocks.
# The CLI's `vitest list` is not used, because it leaves skipped and todo cases out.
# Each line is the case's full name, its describe path and title joined by " > ", every character kept, with
# a backslash written as \\ and a newline as \n so one case stays one line and a multi-line title differs from
# a single-line one. A case that is not run is prefixed with its mode ("skip: ", "todo: "), so a diff also
# shows a case being skipped. Vitest does not keep an `.only` mode, so it lists as a plain case, and in a file
# holding one it marks the file's other cases as skipped.
set -euo pipefail
here="$(cd "$(dirname "$0")" && pwd)"
root="$(git rev-parse --show-toplevel)"
dir="$(cd "${1:-$root/src}" && pwd -P)"
read -r -d '' prog <<'JS' || true
const [vitestNode, dir] = process.argv.slice(1);
const { createVitest } = await import(vitestNode);
const vitest = await createVitest('test', { root: dir + '/..', watch: false, run: true, reporters: [] });
const { testModules, unhandledErrors } = await vitest.collect([dir]);
let failed = unhandledErrors.length > 0;
for (const m of testModules) {
  if (m.state() === 'failed') {
    failed = true;
    console.error(`collection failed: ${m.moduleId}`);
  }
}
if (failed) process.exit(1);
const esc = (s) => s.replace(/\\/g, '\\\\').replace(/\n/g, '\\n').replace(/\r/g, '\\r');
for (const m of testModules)
  for (const t of m.children.allTests()) {
    const mode = t.options.mode;
    console.log((mode === 'run' ? '' : `${mode}: `) + esc(t.fullName));
  }
await vitest.close();
JS
node --input-type=module -e "$prog" "$here/../../node_modules/vitest/dist/node.js" "$dir" |
  LC_ALL=C sort
