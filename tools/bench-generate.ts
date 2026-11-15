// npm run bench:generate: creates the benchmark dataset (D7 plan section 1.4) as a schema-7 backup artifact (D8 T8.18, P35),
// once per generator version and schema version. The generator (src/app/bench-generator.ts) writes the artifact in this
// process with the production artifact writer: no browser is driven and no domain command is run. This tool writes the file
// under .cache/bench/ (git-ignored), records the artifact's digests and sizes, the dataset's counts and its expected values
// in bench/dataset.json, and resets bench/expected-open-rows.json, whose rendered rows `bench:setup` and `bench:run` take
// from the restored profile's first render (the application, not the generator, formats and orders them).
// A dataset whose recorded generator version, schema version and file digest match the file on disk is reused.
// The bench build (`npm run build:bench`, dist-bench/) must carry this generator version's marker, so a stale one is caught.
import { createHash } from 'node:crypto';
import { mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { BENCH_AS_OF_DATE, BENCH_CLOCK_START, BENCH_GENERATOR_MARKER, BENCH_GENERATOR_VERSION, BENCH_SEED, BENCH_TIME_ZONE } from '../src/app/bench.ts';
import { generateBenchArtifact } from '../src/app/bench-generator.ts';
import { nyseSessionPolicy } from '../src/domain/session-policy/index.ts';
import { SCHEMA_VERSION } from '../src/persistence/schema.ts';
import { BENCH_BUILD_DIR, BENCH_DATASET_FILE as FULL_DATASET_FILE, BENCH_EXPECTED_ROWS_FILE as FULL_EXPECTED_ROWS_FILE, type ExpectedOpenRows } from './bench/profile.ts';
import { listFiles } from './release.ts';

// BENCH_SESSIONS=<n> runs a short smoke generation over the first n sessions (D6 T6.24), scaling every count.
// It writes only under .cache/bench/smoke-<n>/ (never bench/dataset.json) and always regenerates.
const smokeSessions = process.env['BENCH_SESSIONS'] ? Number(process.env['BENCH_SESSIONS']) : undefined;
if (smokeSessions !== undefined && !(Number.isInteger(smokeSessions) && smokeSessions > 0)) throw new Error(`BENCH_SESSIONS=${process.env['BENCH_SESSIONS']} is not a positive integer`);
const smokeDir = smokeSessions === undefined ? undefined : path.resolve(`.cache/bench/smoke-${smokeSessions}`);
const ARTIFACT_FILE = path.join(smokeDir ?? path.resolve('.cache/bench'), 'benchmark.tjbackup');
const BENCH_DATASET_FILE = smokeDir ? path.join(smokeDir, 'dataset.json') : FULL_DATASET_FILE;
const BENCH_EXPECTED_ROWS_FILE = smokeDir ? path.join(smokeDir, 'expected-open-rows.json') : FULL_EXPECTED_ROWS_FILE;

const sha256 = (bytes: Uint8Array) => createHash('sha256').update(bytes).digest('hex');

// The bench build exists only to carry the marker of the generator version that made the dataset.
const bundled = await Promise.all(
  (await listFiles(BENCH_BUILD_DIR)).filter((f) => f.endsWith('.js')).map((f) => readFile(`${BENCH_BUILD_DIR}/${f}`, 'utf8')),
).catch(() => []);
if (!bundled.some((text) => text.includes(BENCH_GENERATOR_MARKER))) {
  console.error(`FAIL ${BENCH_BUILD_DIR}/ has no generator entry point; run npm run build:bench first`);
  process.exit(1);
}

const recorded = (await readFile(BENCH_DATASET_FILE, 'utf8').then(JSON.parse, () => undefined)) as { generatorVersion?: number; schemaVersion?: number; artifact?: { fileDigest?: string } } | undefined;
const onDisk = await readFile(ARTIFACT_FILE).catch(() => undefined);
if (smokeSessions === undefined && onDisk && recorded?.generatorVersion === BENCH_GENERATOR_VERSION && recorded.schemaVersion === SCHEMA_VERSION && recorded.artifact?.fileDigest === sha256(onDisk)) {
  console.log(`bench:generate OK: reusing ${path.relative(process.cwd(), ARTIFACT_FILE)} (generator ${BENCH_GENERATOR_VERSION}, schema ${SCHEMA_VERSION}, ${onDisk.length} bytes)`);
  process.exit(0);
}
console.log(`bench:generate: generating for generator ${BENCH_GENERATOR_VERSION}, schema ${SCHEMA_VERSION}${smokeSessions === undefined ? '' : ` (smoke, ${smokeSessions} sessions)`}`);

const started = performance.now();
// The session policy is handed in: only Market Data and the composition root import it (D4 A39).
const covered = nyseSessionPolicy.sessionsBetween(BENCH_CLOCK_START.slice(0, 10), BENCH_AS_OF_DATE);
if (!covered.ok) throw new Error('the session policy does not cover the benchmark run');
const calendar = { identity: nyseSessionPolicy.identity, sessions: covered.value };
const { artifact, bytes, uncompressedBytes, storeCounts, expected } = await generateBenchArtifact({ calendar, ...(smokeSessions !== undefined && { sessions: smokeSessions }) });
const generationMs = Math.round(performance.now() - started);
const file = Buffer.concat(artifact.parts);
await mkdir(path.dirname(ARTIFACT_FILE), { recursive: true });
// An interrupted write never leaves a file whose digest the dataset records.
await rm(BENCH_DATASET_FILE, { force: true });
await writeFile(ARTIFACT_FILE, file);

const provenance = {
  generatorVersion: BENCH_GENERATOR_VERSION,
  schemaVersion: SCHEMA_VERSION,
  seed: BENCH_SEED,
  clockStart: BENCH_CLOCK_START,
  timeZone: BENCH_TIME_ZONE,
  asOf: expected.asOf,
  reviewDate: expected.reviewDate,
  missingInstruments: expected.missingInstruments,
  counts: expected.counts,
  actionsByChoice: expected.actionsByChoice,
  dispositions: expected.dispositions,
  closeReviewDispositions: expected.closeReviewDispositions,
  asOfReview: expected.asOfReview,
  asOfDueReflections: expected.asOfDueReflections,
  outstandingDebts: expected.outstandingDebts,
  // The artifact: where it is, and what it is. `bench:setup` restores it and adds the Restore timings.
  artifact: {
    path: path.relative(process.cwd(), ARTIFACT_FILE),
    fileDigest: sha256(file),
    fullDigest: artifact.fullDigest,
    manifestDigest: artifact.manifestDigest,
    sectionDigests: artifact.sectionDigests,
    bytes,
    uncompressedBytes,
    lines: artifact.lineCount,
    storeCounts,
  },
  generationMs,
  engine: `node ${process.version}`,
  host: { platform: os.platform(), release: os.release(), arch: os.arch(), cpu: os.cpus()[0]?.model ?? 'unknown', cores: os.cpus().length },
  expectedOpenRows: path.relative(process.cwd(), BENCH_EXPECTED_ROWS_FILE),
  ...(smokeSessions !== undefined && { smokeSessions }),
};
// The Open list as the trader sees it is the application's rendering of the restored Workspace, so the rows are taken from
// the first render after `bench:setup` (`bench:expected`); until then there are none.
const rows: ExpectedOpenRows = { generatorVersion: BENCH_GENERATOR_VERSION, schemaVersion: SCHEMA_VERSION, headers: [], rows: [], items: [] };
await writeFile(BENCH_EXPECTED_ROWS_FILE, `${JSON.stringify(rows, null, 2)}\n`);
// Written last: a dataset without this file is regenerated.
await writeFile(BENCH_DATASET_FILE, `${JSON.stringify(provenance, null, 2)}\n`);
console.log(`bench:generate OK: ${JSON.stringify(expected.counts)}`);
console.log(`bench:generate: ${path.relative(process.cwd(), ARTIFACT_FILE)} ${bytes} bytes (${uncompressedBytes} uncompressed, ${artifact.lineCount} lines), full digest ${artifact.fullDigest}, in ${generationMs} ms`);
