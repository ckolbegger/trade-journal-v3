import { useSyncExternalStore } from 'react';
import type { ReleaseUpdateController } from './controller.ts';

export interface UpdateNoticeProps {
  readonly controller: ReleaseUpdateController;
}

// Tells the trader a verified update is waiting; activation is always their explicit choice.
export function UpdateNotice({ controller }: UpdateNoticeProps) {
  const state = useSyncExternalStore(controller.subscribe, controller.state);
  if (state.superseded) {
    return (
      <section className="banner warning" aria-label="Update">
        <p>Updated in another tab: reload when ready</p>
      </section>
    );
  }
  if (state.notice === 'None') return null;
  return (
    <section className="banner notice" aria-label="Update">
      <p>An update is ready</p>
      {state.unsavedHere && <p>The update waits until you save or cancel the open form.</p>}
      {state.unsavedElsewhere && <p>The update waits because another tab has unsaved work.</p>}
      <button
        type="button"
        className="pill primary"
        disabled={state.unsavedHere || state.unsavedElsewhere}
        onClick={() => controller.applyUpdate()}
      >
        Reload
      </button>
    </section>
  );
}
