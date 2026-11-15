// The page's handling around a Restore this tab applies (D8 A136, A142; T8.11-B1, T8.11-B2).
import { describe, expect, it, vi } from 'vitest';
import { createPostRestore } from './post-restore.ts';

const restored = (databaseName: string) => ({ kind: 'Restored' as const, receipt: { newBinding: { databaseName, contentRevision: 1 } } });

describe('another tab restoring after this tab finished its own Restore', () => {
  it('should still show the replaced notice when another tab restores after this tab finished its own Restore', async () => {
    const postRestore = createPostRestore();
    await postRestore.apply(() => Promise.resolve(restored('db-mine')));
    expect(postRestore.hearsReplacement('db-mine')).toBe(false);
    expect(postRestore.hearsReplacement('db-theirs')).toBe(true);
  });

  it('should ignore this tab own broadcast while its Restore is still applying', async () => {
    const postRestore = createPostRestore();
    let heardWhileApplying: boolean | undefined;
    await postRestore.apply(() => {
      heardWhileApplying = postRestore.hearsReplacement('db-mine');
      return Promise.resolve(restored('db-mine'));
    });
    expect(heardWhileApplying).toBe(false);
  });

});

describe('rebuilding the shell after a Restore', () => {
  it('should keep the Backup page mounted until the trader leaves the Restore complete summary', async () => {
    const postRestore = createPostRestore();
    const rebuild = vi.fn();
    postRestore.observePath('/backup', rebuild);
    await postRestore.apply(() => Promise.resolve(restored('db-mine')));
    postRestore.observePath('/backup', rebuild);
    expect(rebuild).not.toHaveBeenCalled();
    postRestore.observePath('/accounts', rebuild);
    expect(rebuild).toHaveBeenCalledTimes(1);
    postRestore.observePath('/', rebuild);
    expect(rebuild).toHaveBeenCalledTimes(1);
  });
});
