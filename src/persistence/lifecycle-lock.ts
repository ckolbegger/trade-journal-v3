// The exclusive Workspace lifecycle lock: at most one migration or activation runs at a time
// across every tab (D2 A30). Not reentrant: a task must not take the lock again.
export interface LifecycleLock {
  run<T>(task: () => Promise<T>): Promise<T>;
}

export const LIFECYCLE_LOCK_NAME = 'tj-lifecycle';

// Node has no Web Locks: one process, one queue (a disclosed test substitute, D2 section 6.0).
export function createInProcessLifecycleLock(): LifecycleLock {
  let tail: Promise<unknown> = Promise.resolve();
  return {
    run(task) {
      const result = tail.then(task);
      tail = result.catch(() => undefined);
      return result;
    },
  };
}

// The browser lock, shared by every tab of the origin.
export function createWebLocksLifecycleLock(locks: LockManager): LifecycleLock {
  return {
    run: (task) => locks.request(LIFECYCLE_LOCK_NAME, { mode: 'exclusive' }, task),
  };
}
