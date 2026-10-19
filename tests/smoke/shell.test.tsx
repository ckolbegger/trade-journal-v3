// @vitest-environment jsdom
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { App } from "../../src/ui/App";

describe("the application shell renders without a network or a domain module", () => {
  it("should render the application heading when the shell mounts", () => {
    render(<App applicationName="Trade Journal" />);

    expect(screen.getByRole("heading", { level: 1, name: "Trade Journal" })).toBeTruthy();
  });
});
