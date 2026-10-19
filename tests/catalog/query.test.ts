import { describe, expect, it } from "vitest";
import { CATALOG_SEED_MANIFEST_V1, seedDefaults } from "../../src/catalog";
import { query, save } from "../../src/catalog/save";
import { closeCatalog, openCatalog } from "./support";

describe("ReferenceCatalog save and query handle Institution and Account identity, availability and history", () => {
  it("should list one typed family in deterministic label-and-identity order with snapshot-bound pagination and an Include-inactive view, and return complete history for one identity", async () => {
    const { database, seam } = await openCatalog();
    await seedDefaults(seam, CATALOG_SEED_MANIFEST_V1);
    for (const [index, label] of ["Beta", "Alpha", "Gamma"].entries()) {
      await save(seam, {
        type: "createInstitution",
        label,
        expectedSnapshotRevision: index + 1,
      });
    }
    await save(seam, {
      type: "archiveInstitution",
      id: "institution:beta",
      expectedSnapshotRevision: 4,
    });
    await save(seam, {
      type: "renameInstitution",
      id: "institution:alpha",
      label: "Zeta Prime",
      expectedSnapshotRevision: 5,
    });

    const selectable = await query(seam, { kind: "institution", view: "selectable" });
    expect(selectable.outcome).toBe("Page");
    if (selectable.outcome === "Page") {
      expect(selectable.records.map((record) => record.label)).toEqual(["Gamma", "Zeta Prime"]);
      expect(selectable.snapshotRevision).toBe(6);
    }

    const includeInactive = await query(seam, { kind: "institution", view: "includeInactive" });
    if (includeInactive.outcome === "Page") {
      expect(includeInactive.records.map((record) => record.label)).toEqual([
        "Beta",
        "Gamma",
        "Zeta Prime",
      ]);
    }

    const firstPage = await query(seam, {
      kind: "institution",
      view: "includeInactive",
      limit: 2,
    });
    expect(firstPage.outcome).toBe("Page");
    if (firstPage.outcome === "Page") {
      expect(firstPage.records.map((record) => record.label)).toEqual(["Beta", "Gamma"]);
      expect(firstPage.nextCursor).toBe("institution:gamma");
    }

    const history = await query(seam, {
      kind: "institution",
      view: "includeInactive",
      identity: "institution:alpha",
    });
    if (history.outcome === "Page") {
      expect(history.records[0]?.label).toBe("Zeta Prime");
      expect(history.history).toEqual([
        { revision: 1, label: "Alpha", inactive: false },
        { revision: 2, label: "Zeta Prime", inactive: false },
      ]);
    }

    await closeCatalog(database);
  });
});
