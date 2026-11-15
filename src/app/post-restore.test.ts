// The page's handling around a Restore this tab applies (D8 A136, A142; T8.11-B1, T8.11-B2).
import { describe, expect, it, vi } from 'vitest';
import { createPostRestore } from './post-restore.ts';

const restored = (databaseName: string) => ({ kind: 'Restored' as const, receipt: { newBinding: { databaseName, contentRevision: 1 } } });

describe('another tab restoring after this tab finished its own Restore', () => {
  it('should still show the replaced notice when another tab restores after this tab finished its own Restore', async () => {
    const postRestore = createPostRestore();
    const listener = vi.fn();
    postRestore.subscribeReplaced(listener);
    await postRestore.apply(() => Promise.resolve(restored('db-mine')));
    postRestore.hearReplacement('db-mine');
    expect(listener).not.toHaveBeenCalled();
    postRestore.hearReplacement('db-theirs');
    expect(listener).toHaveBeenCalledTimes(1);
  });

  it('should ignore this tab own broadcast while its Restore is still applying', async () => {
    const postRestore = createPostRestore();
    const listener = vi.fn();
    postRestore.subscribeReplaced(listener);
    await postRestore.apply(() => {
      postRestore.hearReplacement('db-mine');
      expect(listener).not.toHaveBeenCalled();
      return Promise.resolve(restored('db-mine'));
    });
    expect(listener).not.toHaveBeenCalled();
  });

  it('should show the replaced notice for another tab Restore heard while this tab is still applying', async () => {
    const postRestore = createPostRestore();
    const late = vi.fn();
    postRestore.subscribeReplaced(late);
    await postRestore.apply(() => {
      postRestore.hearReplacement('db-theirs');
      expect(late).not.toHaveBeenCalled();
      return Promise.resolve(restored('db-mine'));
    });
    expect(late).toHaveBeenCalledTimes(1);
  });

  it('should drop this tab own broadcast heard while applying once the result names its database', async () => {
    const postRestore = createPostRestore();
    const late = vi.fn();
    postRestore.subscribeReplaced(late);
    await postRestore.apply(() => {
      postRestore.hearReplacement('db-mine');
      return Promise.resolve(restored('db-mine'));
    });
    expect(late).not.toHaveBeenCalled();
  });

});

describe('a notice for another tab Restore reaches the shell the trader sees (T8.11-B5, T8.11-B7)', () => {
  it('should show the replaced notice in the rebuilt shell when another tab restored during the apply', async () => {
    const postRestore = createPostRestore();
    postRestore.observePath('/backup', vi.fn());
    postRestore.subscribeReplaced(vi.fn());
    await postRestore.apply(() => {
      postRestore.observePath('/accounts', vi.fn());
      postRestore.hearReplacement('db-theirs');
      return Promise.resolve(restored('db-mine'));
    });
    // The shell that mounts after the rebuild subscribes late and must still be told.
    const rebuiltShell = vi.fn();
    postRestore.subscribeReplaced(rebuiltShell);
    expect(rebuiltShell).toHaveBeenCalledTimes(1);
  });

  it('should deliver a held notice only to the listener subscribed when it is delivered', async () => {
    const postRestore = createPostRestore();
    const stale = vi.fn();
    const current = vi.fn();
    const unsubscribe = postRestore.subscribeReplaced(stale);
    await postRestore.apply(() => {
      postRestore.hearReplacement('db-theirs');
      unsubscribe();
      postRestore.subscribeReplaced(current);
      return Promise.resolve(restored('db-mine'));
    });
    expect(stale).not.toHaveBeenCalled();
    expect(current).toHaveBeenCalledTimes(1);
  });
});

describe('a shell that resubscribes after it was told (T8.11-B8)', () => {
  it('should not replay a replacement to a shell that resubscribes after it was told', () => {
    const postRestore = createPostRestore();
    const first = vi.fn();
    const unsubscribe = postRestore.subscribeReplaced(first);
    postRestore.hearReplacement('db-theirs');
    expect(first).toHaveBeenCalledTimes(1);
    // The same shell moves to another route and subscribes again.
    unsubscribe();
    const again = vi.fn();
    postRestore.subscribeReplaced(again);
    expect(again).not.toHaveBeenCalled();
  });
});

describe('rebuilding the shell after a Restore', () => {
  it('should rebuild when the trader left and came back to the summary route during the apply', async () => {
    const postRestore = createPostRestore();
    const rebuild = vi.fn();
    postRestore.observePath('/backup', rebuild);
    await postRestore.apply(() => {
      postRestore.observePath('/accounts', rebuild);
      postRestore.observePath('/backup', rebuild);
      return Promise.resolve(restored('db-mine'));
    });
    expect(rebuild).toHaveBeenCalledTimes(1);
  });

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
