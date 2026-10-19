import { describe, expect, it } from 'vitest';
import { device, onboarded, restart } from './support.ts';

describe('I1.2 onboarding', () => {
  it('should return Institution and Account records equal to those read after restart at the returned revisions, and reach ReadyForTradePlanning', async () => {
    const d = await device();
    const { app, institution, account } = await onboarded(d);

    const again = await restart(app, d);
    const institutions = await again.ReferenceCatalog.query({ family: 'Institution' });
    const accounts = await again.ReferenceCatalog.query({ family: 'Account' });
    if (institutions.kind !== 'Page' || accounts.kind !== 'Page') throw new Error('query failed');
    expect(institutions.items).toEqual([institution.record]);
    expect(accounts.items).toEqual([account.record]);
    // The Catalog has not moved past the revision the last create returned.
    expect(accounts.snapshot).toEqual(account.snapshot);
    const status = await again.Workspace.getStatus();
    expect(status.kind === 'Ready' && status.onboarding).toBe('ReadyForTradePlanning');
  });
});
