import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
const [id, stage, command, ...args] = process.argv.slice(2);
if (!id || !stage || !command) throw new Error('Usage: evidence.mjs ID STAGE COMMAND [ARGUMENTS]');
function files(path) { return readdirSync(path, { withFileTypes: true }).filter(entry => !entry.name.endsWith('.tsbuildinfo')).flatMap(entry => entry.isDirectory() ? files(join(path, entry.name)) : [join(path, entry.name)]); }
const paths = [...files('src'), ...files('worker'), ...files('tests'), ...files('tools'), ...files('public'), ...readdirSync('.').filter(path => /\.config\.(ts|mjs)$/.test(path)), 'package.json', 'package-lock.json', 'tsconfig.json', 'index.html'].sort();
const snapshot = Object.fromEntries(paths.map(path => [path, path.endsWith('.png') ? { encoding: 'base64', data: readFileSync(path).toString('base64') } : readFileSync(path, 'utf8')]));
const digest = createHash('sha256').update(JSON.stringify(snapshot)).digest('hex');
const directory = 'implementation/evidence/d01';
mkdirSync(`${directory}/source-snapshots`, { recursive: true });
writeFileSync(`${directory}/source-snapshots/${digest}.json`, JSON.stringify(snapshot));
const baseline = spawnSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).stdout.trim();
const result = spawnSync(command, args, { encoding: 'utf8', env: process.env, maxBuffer: 32 * 1024 * 1024 });
const log = { id, stage, baseline, sourceDigest: digest, command: [command, ...args], exit: result.status, stdout: result.stdout, stderr: result.stderr, error: result.error?.message };
writeFileSync(`${directory}/${id}-${stage}.json`, JSON.stringify(log, null, 2));
process.stdout.write(result.stdout ?? ''); process.stderr.write(result.stderr ?? '');
process.exit(result.status ?? 1);
