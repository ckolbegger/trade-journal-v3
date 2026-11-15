import { describe, expect, it } from 'vitest';
import type { PrepareRestoreResult, RestorePreview } from '../../app/types.ts';
import { REPLY_WINDOW_MS, withOtherTabsWarning } from './other-tabs.ts';
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

  // A fake clock: `delay` records the wait and lets the test deliver a reply during it.
  function clock(opts: { preparedAt: number; onDelay?: () => void }) {
    const waits: number[] = [];
    let t = 0;
    return {
      waits,
      advanceToPrepared: () => void (t = opts.preparedAt),
      timing: {
        now: () => t,
        delay: (ms: number) => {
          waits.push(ms);
          opts.onDelay?.();
          t += ms;
          return Promise.resolve();
        },
      },
    };
  }

  it('should still add the warning when a reply arrives after preparation finishes but inside the window', async () => {
    const double = createBackupFacadeDouble();
    let unsaved = false;
    const c = clock({ preparedAt: 40, onDelay: () => void (unsaved = true) });
    double.respond('prepareRestore', () => {
      c.advanceToPrepared();
      return prepared(['OlderSchema']);
    });
    const facade = withOtherTabsWarning(double.facade, { askOthers: () => undefined, unsavedElsewhere: () => unsaved }, c.timing);
    const result = await facade.prepareRestore({ file: FILE });
    expect(c.waits).toEqual([210]); // only what is left of the 250 ms window
    expect(result.kind === 'Prepared' && result.preview.warnings).toEqual(['OlderSchema', 'AnotherTabHasUnsavedWork']);
  });

  it('should add no warning when the reply arrives after the window', async () => {
    const double = createBackupFacadeDouble();
    let unsaved = false;
    const c = clock({ preparedAt: 40 });
    double.respond('prepareRestore', () => {
      c.advanceToPrepared();
      return prepared(['OlderSchema']);
    });
    const facade = withOtherTabsWarning(double.facade, { askOthers: () => undefined, unsavedElsewhere: () => unsaved }, c.timing);
    const result = await facade.prepareRestore({ file: FILE });
    unsaved = true; // too late
    expect(c.waits).toEqual([210]); // held open for the window, not indefinitely
    expect(result.kind === 'Prepared' && result.preview.warnings).toEqual(['OlderSchema']);
  });

  it('should not wait when unsaved work is already reported or the window has passed', async () => {
    const double = createBackupFacadeDouble();
    const known = clock({ preparedAt: 40 });
    double.respond('prepareRestore', () => {
      known.advanceToPrepared();
      return prepared([]);
    });
    await withOtherTabsWarning(double.facade, { askOthers: () => undefined, unsavedElsewhere: () => true }, known.timing).prepareRestore({ file: FILE });
    expect(known.waits).toEqual([]);
    const slow = clock({ preparedAt: 300 });
    double.respond('prepareRestore', () => {
      slow.advanceToPrepared();
      return prepared([]);
    });
    await withOtherTabsWarning(double.facade, { askOthers: () => undefined, unsavedElsewhere: () => false }, slow.timing).prepareRestore({ file: FILE });
    expect(slow.waits).toEqual([]);
  });

  it('should never wait longer than the reply window when the clock reads earlier after preparation', async () => {
    const double = createBackupFacadeDouble();
    let t = 3_600_000;
    const waits: number[] = [];
    double.respond('prepareRestore', () => {
      t = 0; // the clock jumped back an hour while the file was read
      return prepared([]);
    });
    const timing = { now: () => t, delay: (ms: number) => (waits.push(ms), Promise.resolve()) };
    await withOtherTabsWarning(double.facade, { askOthers: () => undefined, unsavedElsewhere: () => false }, timing).prepareRestore({ file: FILE });
    expect(waits).toEqual([REPLY_WINDOW_MS]);
  });
});
