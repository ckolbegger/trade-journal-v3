// The generator's seams for `bench:generate` (D8 T8.18-F2): Node cannot load the Trades screen's .tsx file itself, so
// Vite's module loader reads the Open list's row function from it. The unit test imports the function directly instead.
import { createServer } from 'vite';
import type { BenchViewsPort } from '../../src/app/bench-generator.ts';
import { restoreInNode } from './node-restore.ts';

export async function benchViewsPortFromVite(): Promise<{ readonly port: BenchViewsPort; readonly close: () => Promise<void> }> {
  const server = await createServer({ configFile: false, appType: 'custom', server: { middlewareMode: true }, logLevel: 'error' });
  const screen = (await server.ssrLoadModule('/src/ui/screens/TradeList.tsx')) as { openRowsOf: BenchViewsPort['openRowsOf'] };
  return { port: { restore: restoreInNode, openRowsOf: screen.openRowsOf }, close: () => server.close() };
}
