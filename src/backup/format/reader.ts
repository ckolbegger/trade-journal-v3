import { sha256 } from '@noble/hashes/sha2.js';
import { bytesToHex } from '@noble/hashes/utils.js';
import { ArtifactReadError, type ArtifactLine, type HeaderLine } from './types.ts';

const LF = new Uint8Array([0x0a]);
const encoder = new TextEncoder();
// Canonical record lines always start with the key "r" (keys sort r < s < t); every other line kind
// starts with "kind", which sorts earlier, so the prefix is an unambiguous record test.
const RECORD_PREFIX = '{"r":';

/**
 * Streams an artifact line by line (A130): sniffs gzip, decodes UTF-8, splits on LF, and recomputes
 * the section digests, the full digest, and the manifest digest. Record lines are yielded as text
 * and never parsed here. Holds at most one line plus one chunk in memory.
 */
export async function* readArtifact(source: Blob | ReadableStream<Uint8Array>): AsyncGenerator<ArtifactLine, void> {
  const { stream, compressed } = await sniff(source instanceof Blob ? source.stream() : source);
  const gunzip = new DecompressionStream('gzip') as ReadableWritablePair<Uint8Array, Uint8Array>;
  const reader = (compressed ? stream.pipeThrough(gunzip) : stream).getReader();
  const decoder = new TextDecoder('utf-8', { fatal: true });

  const full = sha256.create();
  let section = sha256.create();
  const sectionDigests: Record<string, string> = {};
  let lineNumber = 0;
  let pending = '';

  const handle = (text: string): ArtifactLine => {
    lineNumber += 1;
    const bytes = encoder.encode(text);
    if (text.startsWith(RECORD_PREFIX)) {
      full.update(bytes).update(LF);
      section.update(bytes).update(LF);
      return { kind: 'record', lineNumber, text };
    }
    let value: Record<string, unknown>;
    try {
      value = JSON.parse(text) as Record<string, unknown>;
    } catch {
      throw new ArtifactReadError('Corrupt', `line ${lineNumber} is not JSON`);
    }
    if (value === null || typeof value !== 'object' || !['header', 'sectionEnd', 'manifest'].includes(String(value.kind))) {
      throw new ArtifactReadError('Corrupt', `line ${lineNumber} is neither a record nor a header, section end, or manifest`);
    }
    if (value.kind === 'manifest') {
      return {
        kind: 'manifest',
        lineNumber,
        text,
        value,
        computedSectionDigests: sectionDigests,
        computedFullDigest: bytesToHex(full.digest()),
        computedManifestDigest: bytesToHex(sha256(bytes)),
        compressed,
      };
    }
    full.update(bytes).update(LF);
    if (value.kind === 'sectionEnd') {
      const computedSectionDigest = bytesToHex(section.digest());
      section = sha256.create();
      if (typeof value.section === 'string') sectionDigests[value.section] = computedSectionDigest;
      return { kind: 'sectionEnd', lineNumber, text, value, computedSectionDigest };
    }
    return { kind: 'header', lineNumber, text, value: value as HeaderLine };
  };

  // Reads to the end of the stream: the gzip trailer is checked on the way, and any byte is Corrupt.
  const drain = async (): Promise<void> => {
    try {
      for (;;) {
        const r = await reader.read();
        if (r.done) {
          decoder.decode();
          return;
        }
        if (r.value.length > 0) throw new ArtifactReadError('Corrupt', 'content follows the manifest line');
      }
    } catch (e) {
      if (e instanceof ArtifactReadError) throw e;
      throw new ArtifactReadError('Corrupt', e instanceof Error ? e.message : String(e));
    }
  };

  try {
    for (;;) {
      let chunk: Uint8Array | undefined;
      try {
        const r = await reader.read();
        if (!r.done) {
          chunk = r.value;
          pending += decoder.decode(chunk, { stream: true });
        } else {
          decoder.decode();
        }
      } catch (e) {
        throw new ArtifactReadError('Corrupt', e instanceof Error ? e.message : String(e));
      }
      if (chunk === undefined) {
        throw new ArtifactReadError('Truncated', `the stream ended after line ${lineNumber}, before the manifest line`);
      }
      let at = pending.indexOf('\n');
      let from = 0;
      while (at >= 0) {
        const line = handle(pending.slice(from, at));
        if (line.kind === 'manifest') {
          // Yield the manifest only once the rest of the stream (including the gzip trailer) has proved clean.
          if (pending.length > at + 1) throw new ArtifactReadError('Corrupt', 'content follows the manifest line');
          await drain();
          yield line;
          return;
        }
        yield line;
        from = at + 1;
        at = pending.indexOf('\n', from);
      }
      pending = pending.slice(from);
    }
  } finally {
    // Release the source on every exit: early stop, Truncated, Corrupt. A no-op once the stream has ended.
    await reader.cancel().catch(() => undefined);
  }
}

/** Reads just enough of the stream to tell gzip from plain text, then hands back a stream that replays it. */
async function sniff(input: ReadableStream<Uint8Array>): Promise<{ stream: ReadableStream<Uint8Array>; compressed: boolean }> {
  const reader = input.getReader();
  const head: Uint8Array[] = [];
  let have = 0;
  let ended = false;
  while (have < 2 && !ended) {
    const r = await reader.read();
    if (r.done) ended = true;
    else {
      if (r.value.length === 0) continue; // empty chunks carry no bytes to sniff
      head.push(r.value);
      have += r.value.length;
    }
  }
  const first = head[0] ?? new Uint8Array();
  const second = first.length > 1 ? first[1] : head[1]?.[0];
  const compressed = first[0] === 0x1f && second === 0x8b;
  const stream = new ReadableStream<Uint8Array>({
    async pull(controller) {
      const chunk = head.shift();
      if (chunk !== undefined) return controller.enqueue(chunk);
      const r = ended ? { done: true as const, value: undefined } : await reader.read();
      if (r.done) controller.close();
      else controller.enqueue(r.value);
    },
    cancel: (reason) => reader.cancel(reason),
  });
  return { stream, compressed };
}
