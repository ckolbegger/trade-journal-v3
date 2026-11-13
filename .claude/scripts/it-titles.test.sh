#!/bin/bash
# Test of it-titles.sh on a scratch src/ tree holding one case of each `it` form.
# Main case: it should list each it.each case's title template, and every other `it` form (it.skip,
# it.only, it.todo, double quotes, template literals, a title on the line after `it(`, an it.each table
# spanning lines with brackets and parens inside strings), once per occurrence.
here=$(cd "$(dirname "$0")" && pwd)
tmp=$(mktemp -d)
trap 'rm -rf "$tmp"' EXIT
fail=0
bad() { echo "FAIL: $*"; fail=1; }

mkdir -p "$tmp/src/a"
cat > "$tmp/src/a/x.test.ts" <<'TS'
describe('x', () => {
  it('should plain', () => {});
  it("should double quoted", () => {});
  it(`should template`, () => {});
  it(
    'should start on the next line',
    () => {},
  );
  it.skip('should skipped', () => {});
  it.only('should only', () => {});
  it.todo('should todo');
  it.each([['Stop'], ['Target']])('should one line %s', (v) => {});
  it.each([
    ['paren (', { a: [1] }],
    ['quote )', { b: 2 }],
  ])('should multi line table %s', (_n, m) => {});
  it('should plain', () => {});
});
TS
cat > "$tmp/src/a/y.test.tsx" <<'TS'
it('should from another file', () => {});
// it('should not be listed, it is a comment', () => {});
TS

expected='it.each: should multi line table %s
it.each: should one line %s
it.only: should only
it.skip: should skipped
it.todo: should todo
should double quoted
should from another file
should plain
should plain
should start on the next line
should template'

out=$("$here/it-titles.sh" "$tmp/src" 2>&1); code=$?
[[ $code == 0 ]] || bad "exit $code: $out"
[[ "$out" == "$expected" ]] || bad "titles differ. expected:
$expected
got:
$out"

[[ $fail == 0 ]] && echo "it-titles.test: all passed"
exit $fail
