import { describe, expect, it } from "vitest";
import {
  SCHEMA_MANIFEST,
  validateManifest,
  type StoreDefinition,
} from "../../src/persistence/indexeddb/schema";

function without(name: string, change: Partial<StoreDefinition>): StoreDefinition[] {
  return SCHEMA_MANIFEST.map((store) => (store.name === name ? { ...store, ...change } : store));
}

describe("every declared store declares its residency and rebuildability", () => {
  it("should accept the declared manifest with no problem", () => {
    expect(validateManifest()).toEqual([]);
  });

  it("should fail naming the store when an added store declares no residency", () => {
    const added = [
      ...SCHEMA_MANIFEST,
      { name: "undeclaredStore", keyPath: "id" } as unknown as StoreDefinition,
    ];

    expect(validateManifest(added)).toContain(
      "undeclaredStore: declares no residency (authoritative or rebuildable)",
    );
  });

  it("should fail naming the projection when a rebuildable store names no rebuild source", () => {
    const problems = validateManifest(
      without("lifecycleListProjection", { rebuildSource: undefined }),
    );

    expect(problems).toContain(
      "lifecycleListProjection: a rebuildable store must declare its rebuild source",
    );
  });

  it("should fail naming the projection when its rebuild source is not authoritative", () => {
    const problems = validateManifest(
      without("lifecycleListProjection", { rebuildSource: "unknownStore" }),
    );

    expect(problems).toContain(
      "lifecycleListProjection: rebuild source unknownStore is not an authoritative store",
    );
  });
});
