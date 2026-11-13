#!/bin/bash
# Test of it-titles.sh on scratch src/ trees, each with a `vitest.config.mjs` that turns on globals, so Vitest
# collects them as it does the real tree. Usage: it-titles.test.sh [b1|b2|b3]   (default: all three cases)
# IT_TITLES=<path> runs another copy of the script, for example the pre-fix one when logging a red run.
# b1: it should list each it.each case concretely, and every other `it` form (it.skip, it.only, it.todo,
#     double quotes, template literals, a title on the line after `it(`, a table spanning lines), once per
#     occurrence, with its describe path, a "skip: " or "todo: " prefix on a case that is not run, and no
#     file name (it.only is listed as a plain case: Vitest does not keep its mode).
# b2: it should list an it.each case whose table holds a regex literal or a comment with brackets or quotes.
# b3: it should list a multi-line title differently from a single-line title with the same words.
here=$(cd "$(dirname "$0")" && pwd)
script=${IT_TITLES:-$here/it-titles.sh}
only=${1:-all}
tmp=$(mktemp -d)
trap 'rm -rf "$tmp"' EXIT
fail=0
bad() { echo "FAIL: $*"; fail=1; }

# check <case> <fixture-dir> <expected>: runs the script on <fixture-dir>/src and compares its output.
check() {
  local name=$1 dir=$2 expected=$3 out code
  [[ $only == all || $only == "$name" ]] || return 0
  echo 'export default { test: { globals: true, allowOnly: true } };' > "$dir/vitest.config.mjs"
  out=$("$script" "$dir/src" 2>&1); code=$?
  [[ $code == 0 ]] || bad "$name: exit $code: $out"
  [[ "$out" == "$expected" ]] || bad "$name: titles differ. expected:
$expected
got:
$out"
}

# b1
d=$tmp/b1; mkdir -p "$d/src/a"
cat > "$d/src/a/x.test.ts" <<'TS'
describe('x', () => {
  it('should plain', () => {});
  it("should double quoted", () => {});
  it(`should template`, () => {});
  it(
    'should start on the next line',
    () => {},
  );
  it.skip('should skipped', () => {});
  it.todo('should todo');
  it.each([['Stop'], ['Target']])('should one line %s', (v) => {});
  it.each([
    ['paren (', { a: [1] }],
    ['quote )', { b: 2 }],
  ])('should multi line table %s', (_n, m) => {});
  it('should plain', () => {});
});
TS
cat > "$d/src/a/y.test.tsx" <<'TS'
it('should from another file', () => {});
// it('should not be listed, it is a comment', () => {});
TS
cat > "$d/src/a/z.test.ts" <<'TS'
describe('z', () => { describe('inner', () => { it.only('should only', () => {}); }); });
TS
check b1 "$d" 'should from another file
skip: x > should skipped
todo: x > should todo
x > should double quoted
x > should multi line table paren (
x > should multi line table quote )
x > should one line Stop
x > should one line Target
x > should plain
x > should plain
x > should start on the next line
x > should template
z > inner > should only'

# b2
d=$tmp/b2; mkdir -p "$d/src"
cat > "$d/src/r.test.ts" <<'TS'
describe('r', () => {
  it.each([/\(/, /["'`[]/])('should regex table', () => {});
  it.each([
    'a', // ) ' " [ `
    'b', /* ] ( " */
  ])('should comment table', () => {});
});
TS
check b2 "$d" 'r > should comment table
r > should comment table
r > should regex table
r > should regex table'

# b3
d=$tmp/b3; mkdir -p "$d/src"
cat > "$d/src/m.test.ts" <<'TS'
describe('m', () => {
  it(`should multi
line`, () => {});
  it(`should multi line`, () => {});
});
TS
check b3 "$d" 'm > should multi line
m > should multi\nline'

[[ $fail == 0 ]] && echo "it-titles.test: all passed"
exit $fail
