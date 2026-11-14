import { createHash } from 'node:crypto';
import { gunzipSync } from 'fflate';
import { describe, expect, it } from 'vitest';
import { ArtifactWriter } from './writer.ts';

const sha256 = (text: string): string => createHash('sha256').update(text, 'utf8').digest('hex');
const at = (lines: string[], i: number): string => lines[i] ?? '';
const decode = (parts: Uint8Array[]): string => {
  const all = new Uint8Array(parts.reduce((n, p) => n + p.length, 0));
  let at = 0;
  for (const p of parts) {
    all.set(p, at);
    at += p.length;
  }
  return new TextDecoder('utf-8', { fatal: true }).decode(gunzipSync(all));
};

describe('ArtifactWriter', () => {
  it('should write header, record, section-end, and manifest lines whose section digests and full digest equal SHA-256 computed over the same lines concatenated by the test', () => {
    const w = new ArtifactWriter();
    w.writeHeader({ formatVersion: 1, sections: ['trades', 'journal'] });
    w.writeRecord('trades', 'trades', { id: 'T1', note: 'é' });
    w.writeRecord('trades', 'positionChanges', { id: 'P1', qty: 3 });
    const tradesDigest = w.writeSectionEnd('trades', { trades: 1, positionChanges: 1 });
    w.writeRecord('journal', 'entries', { id: 'E1' });
    w.writeSectionEnd('journal', { entries: 1 });
    const out = w.finish({ kind: 'ignored-by-writer', counts: { trades: 1 } });

    const text = decode(out.parts);
    expect(text.endsWith('\n')).toBe(true);
    const lines = text.slice(0, -1).split('\n');
    expect(lines).toHaveLength(7);
    expect(out.lineCount).toBe(7);
    expect(lines[0]).toBe('{"formatVersion":1,"kind":"header","sections":["trades","journal"]}');
    expect(lines[1]).toBe('{"r":{"id":"T1","note":"é"},"s":"trades","t":"trades"}');

    const tradesDigestExpected = sha256(at(lines, 1) + '\n' + at(lines, 2) + '\n');
    const journalDigestExpected = sha256(at(lines, 4) + '\n');
    expect(tradesDigest).toBe(tradesDigestExpected);
    expect(out.sectionDigests).toEqual({ trades: tradesDigestExpected, journal: journalDigestExpected });
    expect(JSON.parse(at(lines, 3))).toEqual({
      kind: 'sectionEnd',
      section: 'trades',
      counts: { trades: 1, positionChanges: 1 },
      digest: tradesDigestExpected,
    });

    const fullExpected = sha256(lines.slice(0, 6).map((l) => l + '\n').join(''));
    expect(out.fullDigest).toBe(fullExpected);
    const manifest = JSON.parse(at(lines, 6)) as Record<string, unknown>;
    expect(manifest).toEqual({
      kind: 'manifest',
      counts: { trades: 1 },
      sectionDigests: out.sectionDigests,
      fullDigest: fullExpected,
    });
    expect(out.manifestDigest).toBe(sha256(at(lines, 6)));
  });

  it('should accept records pushed one at a time with no await between pushes and produce gzip output that decompresses to exactly the lines written', () => {
    const w = new ArtifactWriter();
    w.writeHeader({ formatVersion: 1 });
    const expected = ['{"formatVersion":1,"kind":"header"}'];
    for (let i = 0; i < 20000; i++) {
      w.writeRecord('s', 't', { i, pad: 'x'.repeat(i % 50) });
      expected.push(`{"r":{"i":${i},"pad":"${'x'.repeat(i % 50)}"},"s":"s","t":"t"}`);
    }
    const counts = w.writeSectionEnd('s', { t: 20000 });
    expect(counts).toMatch(/^[0-9a-f]{64}$/);
    const out = w.finish({});
    const text = decode(out.parts);
    const lines = text.slice(0, -1).split('\n');
    expect(lines.slice(0, 20001)).toEqual(expected);
    expect(lines).toHaveLength(20003);
    expect([out.parts[0]?.[0], out.parts[0]?.[1]]).toEqual([0x1f, 0x8b]);
    expect(() => w.writeRecord('s', 't', {})).toThrow();
  });
});
