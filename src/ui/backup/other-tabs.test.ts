import { describe, expect, it } from 'vitest';
import type { PrepareRestoreResult, RestorePreview } from '../../app/types.ts';
import { withOtherTabsWarning } from './other-tabs.ts';
import { createBackupFacadeDouble } from './test-support.ts';

const FILE = new File(['x'], 'journal.tjbackup.gz');

function prepared(warnings: RestorePreview['warnings']): PrepareRestoreResult {
  return { kind: 'Prepared', token: {} as never, preview: { warnings } as unknown as RestorePreview };
}

describe('the Restore preview and other tabs', () => {
  it('should add AnotherTabHasUnsavedWork after the other warnings when another tab has unsaved work when preparation finishes', async () => {
    const double = createBackupFacadeDouble();
    let unsaved = false;
    double.respond('prepareRestore', () => {
      unsaved = true; // a reply arrives while the file is read and checked
      return prepared(['TimeZoneDiffers', 'OlderSchema']);
    });
    let asked = 0;
    const facade = withOtherTabsWarning(double.facade, { askOthers: () => void asked++, unsavedElsewhere: () => unsaved });
    const result = await facade.prepareRestore({ file: FILE });
    expect(asked).toBe(1);
    expect(result.kind === 'Prepared' && result.preview.warnings).toEqual(['TimeZoneDiffers', 'OlderSchema', 'AnotherTabHasUnsavedWork']);
  });

  it('should add no warning when no other tab has unsaved work', async () => {
    const double = createBackupFacadeDouble();
    double.respond('prepareRestore', prepared(['OlderSchema']));
    const facade = withOtherTabsWarning(double.facade, { askOthers: () => undefined, unsavedElsewhere: () => false });
    const result = await facade.prepareRestore({ file: FILE });
    expect(result.kind === 'Prepared' && result.preview.warnings).toEqual(['OlderSchema']);
  });
});
