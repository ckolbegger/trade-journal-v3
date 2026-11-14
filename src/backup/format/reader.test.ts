import { gunzipSync, gzipSync } from 'fflate';
import { describe, expect, it } from 'vitest';
import { readArtifact } from './reader.ts';
import { ArtifactReadError, type ArtifactLine } from './types.ts';
import { ArtifactWriter } from './writer.ts';

function build() {
  const w = new ArtifactWriter();
  w.writeHeader({ formatVersion: 1 });
  for (let i = 0; i < 300; i++) w.writeRecord('a', 'x', { i, text: 'é'.repeat(i % 7) });
  w.writeSectionEnd('a', { x: 300 });
  w.writeRecord('b', 'y', { n: 1 });
  w.writeSectionEnd('b', { y: 1 });
  const out = w.finish({ counts: { x: 300, y: 1 } });
  const gz = new Uint8Array(out.parts.reduce((n, p) => n + p.length, 0));
  let at = 0;
  for (const p of out.parts) {
    gz.set(p, at);
    at += p.length;
  }
  return { out, gz, plain: gunzipSync(gz) };
}

async function collect(source: Blob | ReadableStream<Uint8Array>): Promise<ArtifactLine[]> {
  const lines: ArtifactLine[] = [];
  for await (const line of readArtifact(source)) lines.push(line);
  return lines;
}

async function failure(source: Blob): Promise<unknown> {
  try {
    await collect(source);
  } catch (e) {
    return e;
  }
  return undefined;
}

describe('readArtifact', () => {
  it('should yield the same lines and digests from the gzip file and from its uncompressed text', async () => {
    const { out, gz, plain } = build();
    const fromGzip = await collect(new File([gz], 'a.tjbackup'));
    const fromPlain = await collect(new Blob([plain]));

    const strip = (ls: ArtifactLine[]) => ls.map((l) => (l.kind === 'manifest' ? { ...l, compressed: undefined } : l));
    expect(strip(fromPlain)).toEqual(strip(fromGzip));
    expect(fromGzip).toHaveLength(out.lineCount);
    expect(fromGzip.map((l) => l.lineNumber)).toEqual(Array.from({ length: out.lineCount }, (_, i) => i + 1));
    expect(fromGzip.map((l) => l.kind).filter((k) => k !== 'record')).toEqual([
      'header',
      'sectionEnd',
      'sectionEnd',
      'manifest',
    ]);
    expect(fromGzip.filter((l) => l.kind === 'record')).toHaveLength(301);

    const ends = fromGzip.filter((l) => l.kind === 'sectionEnd');
    expect(ends.map((l) => l.computedSectionDigest)).toEqual(Object.values(out.sectionDigests));
    const manifest = fromGzip.at(-1);
    const plainManifest = fromPlain.at(-1);
    if (manifest?.kind !== 'manifest' || plainManifest?.kind !== 'manifest') throw new Error('last line is not the manifest');
    expect(manifest.computedFullDigest).toBe(out.fullDigest);
    expect(manifest.computedManifestDigest).toBe(out.manifestDigest);
    expect(manifest.computedSectionDigests).toEqual(out.sectionDigests);
    expect(manifest.value['fullDigest']).toBe(out.fullDigest);
    expect([manifest.compressed, plainManifest.compressed]).toEqual([true, false]);
    expect(fromGzip[1]).toEqual({
      kind: 'record',
      lineNumber: 2,
      text: '{"r":{"i":0,"text":""},"s":"a","t":"x"}',
    });
  });

  it('should report Truncated when the stream ends before the manifest line, and Corrupt for invalid gzip data or text that is not UTF-8', async () => {
    const { plain } = build();
    const text = new TextDecoder().decode(plain);
    const withoutManifest = text.slice(0, text.lastIndexOf('{"fullDigest"'));
    const bytes = new TextEncoder().encode(withoutManifest);

    const plainCut = await failure(new Blob([bytes]));
    expect(plainCut).toBeInstanceOf(ArtifactReadError);
    expect((plainCut as ArtifactReadError).code).toBe('Truncated');

    const gzipCut = await failure(new Blob([gzipSync(bytes)]));
    expect((gzipCut as ArtifactReadError).code).toBe('Truncated');

    const midLine = await failure(new Blob([bytes.slice(0, bytes.length - 5)]));
    expect((midLine as ArtifactReadError).code).toBe('Truncated');

    const empty = await failure(new Blob([]));
    expect((empty as ArtifactReadError).code).toBe('Truncated');

    const badGzip = await failure(new Blob([new Uint8Array([0x1f, 0x8b, 8, 0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12])]));
    expect(badGzip).toBeInstanceOf(ArtifactReadError);
    expect((badGzip as ArtifactReadError).code).toBe('Corrupt');

    const notUtf8 = await failure(new Blob([bytes.slice(0, 20), new Uint8Array([0xff, 0xfe]), bytes.slice(20)]));
    expect((notUtf8 as ArtifactReadError).code).toBe('Corrupt');

    const notJson = await failure(new Blob(['not json\n']));
    expect((notJson as ArtifactReadError).code).toBe('Corrupt');
  });
});
