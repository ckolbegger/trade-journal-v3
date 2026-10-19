# D1 TDD log

Every `it should` case from D1's breakdown, section 4, run red and then green, one at a time (kickoff prompt; breakdown, section 10). Each row is one run: the task, the case, the phase, the exact command, the exit code with Vitest's test summary, and an excerpt of the failure for red runs. A red row is valid only when it fails because the planned behavior is absent or incorrect; a red run that passes or fails for another reason is fixed and rerun, never skipped.

| Task | Case | Phase | Command | Outcome | Failure excerpt |
|---|---|---|---|---|---|
| T1.5 | should parse "100" | red | `npx vitest run src/domain/values/decimal.test.ts -t "should parse "100""` | exit 1; Tests  1 failed (1) | TypeError: parseDecimal is not a function 6\| if (!result.ok) throw new Error(`expected ${input} to parse, got ${r…  |
| T1.5 | should parse "100" | green | `npx vitest run src/domain/values/decimal.test.ts -t "should parse "100""` | exit 0; Tests  1 passed (1) |  |
| T1.5 | should normalize | red | `npx vitest run src/domain/values/decimal.test.ts -t "should normalize"` | exit 1; Tests  1 failed | 1 skipped (2) | AssertionError: expected '50.250' to be '50.25' // Object.is equality Expected: "50.25"  |
| T1.5 | should normalize | green | `npx vitest run src/domain/values/decimal.test.ts -t "should normalize"` | exit 0; Tests  1 passed | 1 skipped (2) |  |
| T1.5 | should reject "" | red | `npx vitest run src/domain/values/decimal.test.ts -t "should reject """` | exit 1; Tests  1 failed | 2 skipped (3) | AssertionError: 1.0000001: expected { ok: true, …(2) } to deeply equal { ok: false, reason: 'InvalidDecimal' } - Expected  |
| T1.5 | should reject "" | green | `npx vitest run src/domain/values/decimal.test.ts -t "should reject """` | exit 0; Tests  1 passed | 2 skipped (3) |  |
| T1.5 | should reject zero and negative | red | `npx vitest run src/domain/values/decimal.test.ts -t "should reject zero and negative"` | exit 1; Tests  1 failed | 3 skipped (4) | AssertionError: 0: expected { ok: true, …(2) } to deeply equal { ok: false, reason: 'NotPositive' } - Expected  |
| T1.5 | should reject zero and negative | green | `npx vitest run src/domain/values/decimal.test.ts -t "should reject zero and negative"` | exit 0; Tests  1 passed | 3 skipped (4) |  |
| T1.5 | should add 0.1 | red | `npx vitest run src/domain/values/decimal.test.ts -t "should add 0.1"` | exit 1; Tests  1 failed | 4 skipped (5) | TypeError: parsed(...).value.add is not a function  |
| T1.5 | should add 0.1 | green | `npx vitest run src/domain/values/decimal.test.ts -t "should add 0.1"` | exit 0; Tests  1 passed | 4 skipped (5) |  |
| T1.5 | should return exactly 1 | red | `npx vitest run src/domain/values/decimal.test.ts -t "should return exactly 1"` | exit 1; Tests  1 failed | 5 skipped (6) | TypeError: Rational.of(...).mul is not a function  |
| T1.5 | should return exactly 1 | green | `npx vitest run src/domain/values/decimal.test.ts -t "should return exactly 1"` | exit 0; Tests  1 passed | 5 skipped (6) |  |
| T1.5 | should compare and order | red | `npx vitest run src/domain/values/decimal.test.ts -t "should compare and order"` | exit 1; Tests  1 failed | 6 skipped (7) | TypeError: third.compare is not a function  |
| T1.5 | should compare and order | green | `npx vitest run src/domain/values/decimal.test.ts -t "should compare and order"` | exit 0; Tests  1 passed | 6 skipped (7) |  |
| T1.5 | should throw a typed DivisionByZero | red | `npx vitest run src/domain/values/decimal.test.ts -t "should throw a typed DivisionByZero"` | exit 1; Tests  1 failed | 7 skipped (8) | TypeError: Rational.of(...).div is not a function 58\| expect(() => Rational.of(1n).div(Rational.of(0n))).toThrow(Divisio…  |
| T1.5 | should throw a typed DivisionByZero | green | `npx vitest run src/domain/values/decimal.test.ts -t "should throw a typed DivisionByZero"` | exit 0; Tests  1 passed | 7 skipped (8) |  |
| T1.5 | should format 1/3 dollar | red | `npx vitest run src/domain/values/decimal.test.ts -t "should format 1/3 dollar"` | exit 1; Tests  1 failed | 8 skipped (9) | TypeError: formatMoney is not a function  |
| T1.5 | should format 1/3 dollar | green | `npx vitest run src/domain/values/decimal.test.ts -t "should format 1/3 dollar"` | exit 0; Tests  1 passed | 8 skipped (9) |  |
| T1.5 | should format negative Money | red | `npx vitest run src/domain/values/decimal.test.ts -t "should format negative Money"` | exit 1; Tests  1 failed | 9 skipped (10) | AssertionError: expected '$12.50' to be '−$12.50' // Object.is equality Expected: "−$12.50"  |
| T1.5 | should format negative Money | green | `npx vitest run src/domain/values/decimal.test.ts -t "should format negative Money"` | exit 0; Tests  1 passed | 9 skipped (10) |  |
