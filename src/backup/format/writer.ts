import { sha256 } from '@noble/hashes/sha2.js';
import { bytesToHex } from '@noble/hashes/utils.js';
import { Gzip } from 'fflate';
import { canonicalJson } from './canonical-json.ts';
import type { ArtifactOutput } from './types.ts';

const LF = new Uint8Array([0x0a]);
const encoder = new TextEncoder();

/**
 * Builds an artifact (A123) one line at a time, fully synchronously, so an IndexedDB callback can
 * push records without ever yielding. Each line is canonical JSON, hashed incrementally and fed to
 * a streaming gzip; only the compressed chunks are kept.
 */
export class ArtifactWriter {
  private readonly parts: Uint8Array[] = [];
  private readonly gzip = new Gzip((chunk) => {
    this.parts.push(chunk);
  });
  private readonly full = sha256.create();
  private readonly sectionDigests: Record<string, string> = Object.create(null) as Record<string, string>; // no prototype: a section named __proto__ stays an own key
  private openSection: { name: string; hash: ReturnType<typeof sha256.create> } | undefined;
  private lineCount = 0;

  writeHeader(fields: Record<string, unknown>): void {
    this.line(canonicalJson({ ...fields, kind: 'header' }));
  }

  /** `record` must already be a canonical-JSON-safe projection. */
  writeRecord(section: string, store: string, record: unknown): void {
    if (this.openSection === undefined) {
      this.openSection = { name: section, hash: sha256.create() };
    } else if (this.openSection.name !== section) {
      throw new Error(`Section ${this.openSection.name} is still open; cannot write a record for ${section}`);
    }
    const bytes = encoder.encode(canonicalJson({ r: record, s: section, t: store }));
    this.openSection.hash.update(bytes).update(LF);
    this.emit(bytes);
  }

  /** Closes the section and returns its digest (hex SHA-256 over its record lines). */
  writeSectionEnd(section: string, counts: Record<string, number>): string {
    if (this.openSection !== undefined && this.openSection.name !== section) {
      throw new Error(`Section ${this.openSection.name} is still open; cannot end section ${section}`);
    }
    // No open section means the section had no records: its digest is SHA-256 of nothing.
    const hash = this.openSection?.hash ?? sha256.create();
    const digest = bytesToHex(hash.digest());
    this.openSection = undefined;
    this.sectionDigests[section] = digest;
    this.line(canonicalJson({ counts, digest, kind: 'sectionEnd', section }));
    return digest;
  }

  /** Writes the manifest line (the caller's fields plus the section digests and full digest) and closes the gzip. */
  finish(manifestFields: Record<string, unknown>): ArtifactOutput {
    if (this.openSection !== undefined) {
      throw new Error(`Section ${this.openSection.name} is still open; cannot finish the artifact`);
    }
    const fullDigest = bytesToHex(this.full.clone().digest());
    const manifest = encoder.encode(
      canonicalJson({ ...manifestFields, fullDigest, kind: 'manifest', sectionDigests: this.sectionDigests }),
    );
    this.lineCount += 1;
    this.gzip.push(manifest);
    this.gzip.push(LF, true);
    return {
      parts: this.parts,
      lineCount: this.lineCount,
      sectionDigests: this.sectionDigests,
      fullDigest,
      manifestDigest: bytesToHex(sha256(manifest)),
    };
  }

  private line(text: string): void {
    this.emit(encoder.encode(text));
  }

  private emit(bytes: Uint8Array): void {
    this.full.update(bytes).update(LF);
    this.gzip.push(bytes);
    this.gzip.push(LF);
    this.lineCount += 1;
  }
}
