// The generator's seams for `bench:generate` (D8 T8.18-F2): Node cannot load the Trades screen's .tsx file itself, so
// Vite's module loader reads the Open list's row function from it. The unit test imports the function directly instead.
import { createServer } from 'vite';
import type { BenchViewsPort } from '../../src/app/bench-generator.ts';
import { restoreInNode } from './node-restore.ts';

// The rows are written once and read in every year: the row function says an option expiration's year only when it is not
// the current one, and the browser path pins the clock to the dataset's as-of instant, so this path does too (B1).
export function pinnedOpenRowsOf(openRowsOf: BenchViewsPort['openRowsOf']): BenchViewsPort['openRowsOf'] {
  return (items, timeZone, asOf) => {
    const RealDate = Date;
    const pinned = new RealDate(asOf).getTime();
    class PinnedDate extends RealDate {
      constructor(...args: [] | [string | number | Date]) {
        if (args.length === 0) super(pinned);
        else super(args[0]);
      }
      static override now = () => pinned;
    }
    globalThis.Date = PinnedDate as DateConstructor;
    try {
      return openRowsOf(items, timeZone, asOf);
    } finally {
      globalThis.Date = RealDate;
    }
  };
}

export async function benchViewsPortFromVite(): Promise<{ readonly port: BenchViewsPort; readonly close: () => Promise<void> }> {
  const server = await createServer({ configFile: false, appType: 'custom', server: { middlewareMode: true }, logLevel: 'error' });
  let screen: { openRowsOf: BenchViewsPort['openRowsOf'] };
  try {
    screen = (await server.ssrLoadModule('/src/ui/screens/TradeList.tsx')) as typeof screen;
  } catch (error) {
    // A server left open keeps the process alive.
    await server.close();
    throw error;
  }
  return { port: { restore: restoreInNode, openRowsOf: pinnedOpenRowsOf(screen.openRowsOf) }, close: () => server.close() };
}
