import { describe, expect, it } from "vitest";
import { FixedClock, createApplicationContext } from "../../src/composition/root";

const injected = "2026-10-19T13:30:00.000Z";

function sessionSummary(context: { clock: { now(): string } }): string {
  return context.clock.now();
}

function readinessInstant(context: { clock: { now(): string } }): string {
  return context.clock.now();
}

describe("the injected Clock is the only time source and one root serves every module", () => {
  it("should return exactly the injected instant from the fixed clock", () => {
    const clock = new FixedClock(injected);

    expect(clock.now()).toBe(injected);
  });

  it("should let two modules composed from the same root observe the identical instant", () => {
    const context = createApplicationContext({ clock: new FixedClock(injected) });

    expect(sessionSummary(context)).toBe(injected);
    expect(readinessInstant(context)).toBe(injected);
    expect(sessionSummary(context)).toBe(readinessInstant(context));
  });
});
