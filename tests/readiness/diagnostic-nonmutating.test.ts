import { afterEach, describe, expect, it } from "vitest";
import { runDiagnosticTransaction } from "../../src/persistence/indexeddb/diagnostic";
import { deleteDatabase, openDatabase, transactionDone } from "../../src/persistence/indexeddb/schema";
import { establishReadiness } from "../../src/readiness";
import { passingPorts } from "./support";

afterEach(async () => {
  await deleteDatabase();
});

describe("the Runtime Readiness gate decides Writable from four functional checks and reports every failure", () => {
  it("should return Unsupported with a safe retry action when the isolated diagnostic transaction fails, and leave no authoritative fact behind, proven by an unchanged revision binding", async () => {
    const database = await openDatabase();
    const seed = database.transaction("workspaceMeta", "readwrite");
    seed.objectStore("workspaceMeta").put({ key: "revisions", value: { tradeRecord: 4 } });
    await transactionDone(seed);

    const before = await new Promise<string>((resolve, reject) => {
      const request = database
        .transaction("workspaceMeta", "readonly")
        .objectStore("workspaceMeta")
        .getAll();
      request.onsuccess = () => resolve(JSON.stringify(request.result));
      request.onerror = () => reject(request.error);
    });

    const passed = await runDiagnosticTransaction(database);
    expect(passed).toEqual({ outcome: "Passed" });

    const after = await new Promise<string>((resolve, reject) => {
      const request = database
        .transaction("workspaceMeta", "readonly")
        .objectStore("workspaceMeta")
        .getAll();
      request.onsuccess = () => resolve(JSON.stringify(request.result));
      request.onerror = () => reject(request.error);
    });
    expect(after).toBe(before);
    expect(after).not.toContain("__readiness_probe__");
    database.close();

    const failed = await establishReadiness(
      passingPorts({ diagnostic: async () => ({ outcome: "Failed", detail: "the store did not open" }) }),
    );
    expect(failed.outcome).toBe("Unsupported");
    expect(failed.safeActions.map((action) => action.id)).toContain("retry");
  });
});
