// I8R.6: the five frozen backup fixtures still restore after D8R removed `nearest` from the views (P111), through the real facade on
// fake-indexeddb. Same restore as D8's I8.12; here the expected views are the edited ones and no view carries `nearest`.
import { readFileSync } from 'node:fs';
import { IDBFactory } from 'fake-indexeddb';
import { describe, expect, it } from 'vitest';
import { withWalkedReflections } from '../../../tools/fixture-views.ts';
import { compareSnapshot } from '../../../tools/fixtures/snapshot-compare.ts';
import { viewsOf } from '../../../tools/fixtures/workspace-fixture.ts';
import { BACKUP_SCHEMAS, backupFixtureName } from '../../../tools/fixtures-freeze-backup.ts';
import { artifactOf, CONFIRM, device, FIXTURES, launch, prepared, restart } from '../d8/support.ts';

describe('I8R.6 Frozen backups still restore', () => {
  for (const schema of BACKUP_SCHEMAS) {
    const { name } = backupFixtureName(schema);
    it(`I8R.6 Frozen backups still restore: ${name}`, { timeout: 120_000 }, async () => {
      const asOf = (JSON.parse(readFileSync(`${FIXTURES}/${name}/downloaded.json`, 'utf8')) as { asOf: string }).asOf;
      const target = await device(new IDBFactory(), asOf, 'bk');
      const first = await launch(target);
      const { token, preview } = await prepared(first, artifactOf(name));
      expect(preview.source.schemaVersion).toBe(schema);
      const applied = await first.Workspace.applyPreparedRestore({ token, confirmation: CONFIRM });
      expect(applied.kind).toBe('Restored');

      const app = await restart(first, target);
      const status = await app.Workspace.getStatus();
      expect(status.kind === 'Ready' && status.schemaVersion).toBe(7);

      const expectedText = readFileSync(`${FIXTURES}/${name}/expected-views.json`, 'utf8');
      const views = withWalkedReflections(await viewsOf(app, schema, asOf));
      // Every view equals its edited expected views, and neither side holds the removed field.
      expect(compareSnapshot(views, JSON.parse(expectedText) as unknown)).toEqual([]);
      expect(expectedText).not.toContain('"nearest"');
      expect(JSON.stringify(views)).not.toContain('"nearest"');
    });
  }
});
