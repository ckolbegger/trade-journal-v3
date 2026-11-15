// The page's handling around a Restore this tab applies (D8 A136, A142; T8.11-B1, T8.11-B2).
import { describe, expect, it, vi } from 'vitest';
import { createPostRestore } from './post-restore.ts';

const restored = (databaseName: string) => ({ kind: 'Restored' as const, receipt: { newBinding: { databaseName, contentRevision: 1 } } });

describe('another tab restoring after this tab finished its own Restore', () => {
  it('should still show the replaced notice when another tab restores after this tab finished its own Restore', async () => {
    const postRestore = createPostRestore();
    await postRestore.apply(() => Promise.resolve(restored('db-mine')));
    expect(postRestore.hearsReplacement('db-mine', vi.fn())).toBe(false);
    expect(postRestore.hearsReplacement('db-theirs', vi.fn())).toBe(true);
  });

  it('should ignore this tab own broadcast while its Restore is still applying', async () => {
    const postRestore = createPostRestore();
    let heardWhileApplying: boolean | undefined;
    await postRestore.apply(() => {
      heardWhileApplying = postRestore.hearsReplacement('db-mine', vi.fn());
      return Promise.resolve(restored('db-mine'));
    });
    expect(heardWhileApplying).toBe(false);
  });

  it('should show the replaced notice for another tab Restore heard while this tab is still applying', async () => {
    const postRestore = createPostRestore();
    const late = vi.fn();
    await postRestore.apply(() => {
      expect(postRestore.hearsReplacement('db-theirs', late)).toBe(false);
      expect(late).not.toHaveBeenCalled();
      return Promise.resolve(restored('db-mine'));
    });
    expect(late).toHaveBeenCalledTimes(1);
  });

  it('should drop this tab own broadcast heard while applying once the result names its database', async () => {
    const postRestore = createPostRestore();
    const late = vi.fn();
    await postRestore.apply(() => {
      postRestore.hearsReplacement('db-mine', late);
      return Promise.resolve(restored('db-mine'));
    });
    expect(late).not.toHaveBeenCalled();
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

  it('should rebuild at once when the trader left the summary route before the Restore finished', async () => {
    const postRestore = createPostRestore();
    const rebuild = vi.fn();
    postRestore.observePath('/backup', rebuild);
    await postRestore.apply(() => {
      postRestore.observePath('/accounts', rebuild);
      return Promise.resolve(restored('db-mine'));
    });
    expect(rebuild).toHaveBeenCalledTimes(1);
    postRestore.observePath('/accounts', rebuild);
    postRestore.observePath('/', rebuild);
    expect(rebuild).toHaveBeenCalledTimes(1);
  });
});
