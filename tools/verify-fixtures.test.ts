import { describe, expect, it } from 'vitest';
import { missingFixtureSchemas, workspaceFixtureName } from './fixture-schemas.ts';
import { backupFixtureName } from './fixtures-freeze-backup.ts';

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

describe('fixture folder names (P174)', () => {
  it('should name the Workspace fixture of a schema and a seed by both', () => {
    expect(workspaceFixtureName(7, 6)).toBe('workspace-v7-seed6');
    expect(workspaceFixtureName(7)).toBe('workspace-v7');
  });

  it('should refuse a seed no frozen fixture is named for', () => {
    expect(() => workspaceFixtureName(7, 5)).toThrow('seed 5');
  });

  it('should name the backup fixture of schema 7 and seed 6 beside the unseeded one and read its Workspace fixture', () => {
    expect(backupFixtureName(7, 6)).toEqual({ name: 'backup-v7-seed6', schema: 7, blocked: false, workspace: 'workspace-v7-seed6' });
    expect(backupFixtureName(7)).toEqual({ name: 'backup-v7', schema: 7, blocked: false, workspace: 'workspace-v7' });
    expect(backupFixtureName(6)).toEqual({ name: 'backup-v6-blocked', schema: 6, blocked: true, workspace: 'workspace-v6' });
  });
});
