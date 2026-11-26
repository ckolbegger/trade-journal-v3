// The Workspace fixture schemas a release still owes a fixture for (decision 112).
export function missingFixtureSchemas(names: readonly string[], schemaVersion: number): number[] {
  const present = new Set(names);
  const missing: number[] = [];
  for (let schema = 1; schema <= schemaVersion; schema += 1) {
    if (!present.has(`workspace-v${schema}`)) missing.push(schema);
  }
  return missing;
}

// The seed of the Journal manifest a frozen fixture holds beyond its schema's own (P174): schema 7 seeded at manifest 6.
export const FIXTURE_SEEDS = [6] as const;

// The folder of the Workspace fixture of a schema, and of a seed when it has one (P174).
export function workspaceFixtureName(schema: number, seed?: number): string {
  if (seed === undefined) return `workspace-v${schema}`;
  if (!(FIXTURE_SEEDS as readonly number[]).includes(seed)) throw new Error(`no fixture is frozen for seed ${seed}`);
  return `workspace-v${schema}-seed${seed}`;
}
