import { createHash } from 'node:crypto';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
function files(path: string): string[] {
  return readdirSync(path, { withFileTypes: true }).filter(entry => !entry.name.endsWith('.tsbuildinfo')).flatMap(entry => entry.isDirectory() ? files(join(path, entry.name)) : [join(path, entry.name)]).sort();
}
export const releaseId = createHash('sha256').update([...files('src'), ...files('worker'), ...files('tools'), ...files('public'), ...readdirSync('.').filter(path => path.endsWith('.config.ts')).sort(), 'index.html', 'package-lock.json'].map(path => `${path}\n${createHash('sha256').update(readFileSync(path)).digest('hex')}`).join('\n')).update(process.env.D1_RELEASE_LABEL ?? '').digest('hex');
