import { afterEach, describe, expect, it, vi } from 'vitest';
import { instrumentOf } from '../../domain/instrument/index.ts';
import { reasonText } from './review-attention.ts';

afterEach(() => {
  vi.useRealTimers();
});

describe('contract names in the Workspace zone (A238)', () => {
  it('should word an unavailable Mark sentence with the contracts year decided in the Workspace zone', () => {
    vi.useFakeTimers({ toFake: ['Date'], now: new Date('2027-01-01T03:00:00Z') });
    const reason = { code: 'Unavailable', reason: 'MarkMissing', instrument: instrumentOf('XYZ270115C00055000'), date: '2026-12-31' };
    expect(reasonText(reason as never, { kind: 'Unavailable' } as never, 'America/New_York')).toContain('XYZ Jan 15 2027');
  });
});
