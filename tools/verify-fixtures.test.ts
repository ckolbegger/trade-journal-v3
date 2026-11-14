import { describe, expect, it } from 'vitest';
import { missingFixtureSchemas } from './fixture-schemas.ts';

describe('missingFixtureSchemas', () => {
  it('should return nothing when a fixture exists for every schema from 1 to the current one', () => {
    expect(missingFixtureSchemas(['workspace-v1', 'workspace-v2', 'workspace-v3'], 3)).toEqual([]);
  });

  it('should name a missing middle schema', () => {
    expect(missingFixtureSchemas(['workspace-v1', 'workspace-v3', 'workspace-v4'], 4)).toEqual([2]);
  });

  it('should name the current schema when its fixture is missing', () => {
    expect(missingFixtureSchemas(['workspace-v1', 'workspace-v2'], 3)).toEqual([3]);
  });

  it('should ignore names that are not Workspace fixtures', () => {
    expect(missingFixtureSchemas(['workspace-v1', 'README.md', 'workspace-v2-copy', 'workspace-v9'], 2)).toEqual([2]);
  });
});
