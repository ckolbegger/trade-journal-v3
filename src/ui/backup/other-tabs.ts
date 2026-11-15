import type { BackupFacade } from './facade.ts';

export interface OtherTabs {
  // Asks the other tabs of the app to report unsaved work.
  askOthers(): void;
  unsavedElsewhere(): boolean;
}

// How long after the question another tab's reply still counts (replies are asynchronous).
export const REPLY_WINDOW_MS = 250;

export interface Timing {
  now(): number;
  delay(ms: number): Promise<void>;
}

const realTiming: Timing = { now: () => Date.now(), delay: (ms) => new Promise((resolve) => setTimeout(resolve, ms)) };

// The Restore preview warns when another tab has unsaved work (D8 A133). The tabs are asked when
// preparation starts, and the answer is read when it finishes, so replies that arrive while the
// backup file is read and checked count. When nobody has reported yet, the rest of the reply window
// (measured from the question) is allowed before deciding. The warning goes last, after the coordinator's own.
export function withOtherTabsWarning(facade: BackupFacade, tabs: OtherTabs, timing: Timing = realTiming): BackupFacade {
  return {
    ...facade,
    async prepareRestore(request) {
      const askedAt = timing.now();
      tabs.askOthers();
      const result = await facade.prepareRestore(request);
      if (result.kind !== 'Prepared') return result;
      if (!tabs.unsavedElsewhere()) {
        const remaining = REPLY_WINDOW_MS - (timing.now() - askedAt);
        if (remaining > 0) await timing.delay(remaining);
      }
      if (!tabs.unsavedElsewhere() || result.preview.warnings.includes('AnotherTabHasUnsavedWork')) return result;
      return { ...result, preview: { ...result.preview, warnings: [...result.preview.warnings, 'AnotherTabHasUnsavedWork'] } };
    },
  };
}
