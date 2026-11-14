// The Workspace fixture schemas a release still owes a fixture for (decision 112).
export function missingFixtureSchemas(names: readonly string[], schemaVersion: number): number[] {
  const present = new Set(names);
  const missing: number[] = [];
  for (let schema = 1; schema <= schemaVersion; schema += 1) {
    if (!present.has(`workspace-v${schema}`)) missing.push(schema);
  }
  return missing;
}
