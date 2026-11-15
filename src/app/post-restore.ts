// What the page does around a Restore this tab applies (D8 A136, A142).
export interface PostRestore {
  // Runs this tab's own apply; its WorkspaceReplaced broadcast is not another tab's Restore.
  apply<R extends { readonly kind: string }>(run: () => Promise<R>): Promise<R>;
  // A WorkspaceReplaced broadcast naming `databaseName`. This tab's own broadcast (naming the database its apply
  // produced) is ignored; any heard during the apply is held until the result is known. Another tab's Restore is
  // terminal for this tab: it is remembered and delivered to every current and later subscriber.
  hearReplacement(databaseName: string): void;
  // Listens for another tab's Restore. A listener added after one was heard is told at once, which covers a shell
  // that mounts after a rebuild. Returns the unsubscribe.
  subscribeReplaced(listener: (databaseName: string) => void): () => void;
  // Called with every route; after a Restored result, rebuilds the shell once the route leaves the summary's.
  observePath(pathname: string, rebuild: () => void): void;
  // Whether the Restore complete summary is on screen (from a Restored result until the trader leaves its route).
  summaryShowing(): boolean;
}

interface RestoredResult {
  readonly kind: 'Restored';
  readonly receipt: { readonly newBinding: { readonly databaseName: string } };
}

export function createPostRestore(): PostRestore {
  let applying = false;
  let ownDatabase: string | undefined;
  let held: string[] = [];
  let path: string | undefined;
  let rebuildShell: (() => void) | undefined;
  // The route the Restore complete summary is on, until the trader leaves it.
  let summaryPath: string | undefined;
  let summaryShown = false;
  // The route the running apply started on, and whether the trader left it at any point since.
  let startPath: string | undefined;
  let leftStartPath = false;
  // The database another tab's Restore produced, once heard.
  let replacedBy: string | undefined;
  const listeners = new Set<(databaseName: string) => void>();
  // Whether the shell on screen has been told. A shell that resubscribes (it does so on every route change) is not
  // replayed the notice again; a rebuilt shell is a new shell and is told once.
  let told = false;
  // A rebuild was requested and the new shell has not subscribed yet, so a notice delivered now reaches a dying shell.
  let rebuilding = false;
  const markReplaced = (databaseName: string) => {
    replacedBy = databaseName;
    for (const listener of [...listeners]) listener(databaseName);
    if (listeners.size > 0 && !rebuilding) told = true;
  };
  const requestRebuild = (run: (() => void) | undefined) => {
    told = false;
    rebuilding = true;
    run?.();
  };
  return {
    async apply<R extends { readonly kind: string }>(run: () => Promise<R>) {
      applying = true;
      startPath = path;
      leftStartPath = false;
      let produced: string | undefined;
      try {
        const result = await run();
        if (result.kind === 'Restored') {
          produced = ownDatabase = (result as R & RestoredResult).receipt.newBinding.databaseName;
          summaryShown = true;
          summaryPath = startPath;
          // The trader left the route the apply started on (even if back by now): the flow that would show the
          // summary was unmounted, so rebuild now.
          if (leftStartPath || path !== startPath) {
            summaryShown = false;
            requestRebuild(rebuildShell);
          }
        }
        return result;
      } finally {
        applying = false;
        const heard = held;
        held = [];
        const foreign = heard.find((databaseName) => databaseName !== produced);
        if (foreign !== undefined) markReplaced(foreign);
      }
    },
    hearReplacement(databaseName) {
      if (applying) held.push(databaseName);
      else if (databaseName !== ownDatabase) markReplaced(databaseName);
    },
    subscribeReplaced(listener) {
      listeners.add(listener);
      rebuilding = false;
      if (replacedBy !== undefined && !told) {
        told = true;
        listener(replacedBy);
      }
      return () => {
        listeners.delete(listener);
      };
    },
    summaryShowing: () => summaryShown,
    observePath(pathname, rebuild) {
      path = pathname;
      rebuildShell = rebuild;
      if (applying && pathname !== startPath) leftStartPath = true;
      if (!summaryShown || pathname === summaryPath) return;
      summaryShown = false;
      requestRebuild(rebuild);
    },
  };
}
