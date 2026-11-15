import type { BackupFacade } from './facade.ts';

export interface OtherTabs {
  // Asks the other tabs of the app to report unsaved work.
  askOthers(): void;
  unsavedElsewhere(): boolean;
}

// The Restore preview warns when another tab has unsaved work (D8 A133). The tabs are asked when
// preparation starts, and the answer is read when it finishes, so replies that arrive while the
// backup file is read and checked count. The warning goes last, after the coordinator's own.
export function withOtherTabsWarning(facade: BackupFacade, tabs: OtherTabs): BackupFacade {
  return {
    ...facade,
    async prepareRestore(request) {
      tabs.askOthers();
      const result = await facade.prepareRestore(request);
      if (result.kind !== 'Prepared' || !tabs.unsavedElsewhere() || result.preview.warnings.includes('AnotherTabHasUnsavedWork')) return result;
      return { ...result, preview: { ...result.preview, warnings: [...result.preview.warnings, 'AnotherTabHasUnsavedWork'] } };
    },
  };
}
