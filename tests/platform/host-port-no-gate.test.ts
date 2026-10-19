import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { createHostPort } from "../../src/platform/host";

const operations = [
  "cachedAsset",
  "capacity",
  "download",
  "protection",
  "readSelectedFile",
  "requestDurability",
  "workerControl",
];

describe("the host port reports host facts and decides nothing about readiness", () => {
  it("should expose exactly the seven reported capabilities and no readiness decision", () => {
    expect(Object.keys(createHostPort({})).sort()).toEqual(operations);
  });

  it("should name no readiness outcome anywhere in its own source", () => {
    const directory = "src/platform/host";
    const source = readdirSync(directory)
      .filter((file) => file.endsWith(".ts"))
      .map((file) => readFileSync(join(directory, file), "utf8"))
      .join("\n");

    expect(source).not.toMatch(/Writable|RecoveryOnly|Recovery Only|Unsupported|Initialization Required/);
  });
});
