// @vitest-environment jsdom
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import type { ApplicationRuntime } from "../../src/composition/application";
import { App } from "../../src/ui/App";

const neverStarting = {
  start: () => new Promise(() => {}),
} as unknown as ApplicationRuntime;

describe("the application shell renders without a network or a domain module", () => {
  it("should render the application heading when the shell mounts", () => {
    render(
      <App
        runtime={neverStarting}
        applicationName="Trade Journal"
        openingInstant="2026-10-19T13:30:00.000Z"
      />
    );

    expect(screen.getByRole("heading", { level: 1, name: "Trade Journal" })).toBeTruthy();
  });
});
