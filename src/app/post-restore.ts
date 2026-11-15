// What the page does around a Restore this tab applies (D8 A136, A142).
export interface PostRestore {
  // Runs this tab's own apply; its WorkspaceReplaced broadcast is not another tab's Restore.
  apply<R extends { readonly kind: string }>(run: () => Promise<R>): Promise<R>;
  // True when the broadcast is another tab's Restore to show now. False for this tab's own broadcast (naming the
  // database its apply produced), and for any broadcast heard during the apply: that one is held, and
  // `showLater` runs when the result is known unless it names the database this apply produced.
  hearsReplacement(databaseName: string, showLater: () => void): boolean;
  // Called with every route; after a Restored result, rebuilds the shell once the route leaves the summary's.
  observePath(pathname: string, rebuild: () => void): void;
}

interface RestoredResult {
  readonly kind: 'Restored';
  readonly receipt: { readonly newBinding: { readonly databaseName: string } };
}

export function createPostRestore(): PostRestore {
  let applying = false;
  let ownDatabase: string | undefined;
  let held: { databaseName: string; showLater: () => void }[] = [];
  let path: string | undefined;
  let rebuildShell: (() => void) | undefined;
  // The route the Restore complete summary is on, until the trader leaves it.
  let summaryPath: string | undefined;
  let summaryShown = false;
  return {
    async apply<R extends { readonly kind: string }>(run: () => Promise<R>) {
      applying = true;
      const startPath = path;
      let produced: string | undefined;
      try {
        const result = await run();
        if (result.kind === 'Restored') {
          produced = ownDatabase = (result as R & RestoredResult).receipt.newBinding.databaseName;
          summaryShown = true;
          summaryPath = startPath;
          // The trader already left the route the apply started on: nothing will show the summary, so rebuild now.
          if (path !== startPath) {
            summaryShown = false;
            rebuildShell?.();
          }
        }
        return result;
      } finally {
        applying = false;
        const heard = held;
        held = [];
        for (const { databaseName, showLater } of heard) if (databaseName !== produced) showLater();
      }
    },
    hearsReplacement(databaseName, showLater) {
      if (applying) {
        held.push({ databaseName, showLater });
        return false;
      }
      return databaseName !== ownDatabase;
    },
    observePath(pathname, rebuild) {
      path = pathname;
      rebuildShell = rebuild;
      if (!summaryShown || pathname === summaryPath) return;
      summaryShown = false;
      rebuild();
    },
  };
}
