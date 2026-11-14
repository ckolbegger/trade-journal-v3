/**
 * Artifact line shapes (A123, format version 1). These are TypeScript shapes only; zod parsing of
 * the header, section-end, manifest, and record contents belongs to the verification and restore tasks.
 */

/** Line 1. Further fields (versions, export kind, binding, counts) are the exporter's. */
export type HeaderLine = { kind: 'header' } & Record<string, unknown>;

/** `{"s":section,"t":store,"r":record}` with the record already projected by its module. */
export interface RecordLine {
  s: string;
  t: string;
  r: unknown;
}

/** Closes a section: per-store counts and the section digest over that section's record lines. */
export interface SectionEndLine {
  kind: 'sectionEnd';
  section: string;
  counts: Record<string, number>;
  digest: string;
}

/** The final line: caller's fields plus the section digests and the full digest over every earlier line. */
export type ManifestLine = {
  kind: 'manifest';
  sectionDigests: Record<string, string>;
  fullDigest: string;
} & Record<string, unknown>;

/** Hex SHA-256 digests the writer produced. */
export interface ArtifactDigests {
  /** Section name to its digest, in the order the sections were closed. */
  sectionDigests: Record<string, string>;
  /** SHA-256 over every line before the manifest, LFs included. */
  fullDigest: string;
  /** SHA-256 over the manifest line without its LF. */
  manifestDigest: string;
}

export interface ArtifactOutput extends ArtifactDigests {
  /** Gzip bytes in order; hand them to `new Blob(parts)`. */
  parts: Uint8Array[];
  /** Number of lines written, the manifest included. */
  lineCount: number;
}

/** What `readArtifact` yields, one per line, in file order. `text` excludes the LF. */
export type ArtifactLine =
  | { kind: 'header'; lineNumber: number; text: string; value: HeaderLine }
  | { kind: 'record'; lineNumber: number; text: string }
  | {
      kind: 'sectionEnd';
      lineNumber: number;
      text: string;
      /** Unvalidated JSON of the line. */
      value: Record<string, unknown>;
      /** Digest recomputed over the record lines since the previous section end (or the header). */
      computedSectionDigest: string;
    }
  | {
      kind: 'manifest';
      lineNumber: number;
      text: string;
      /** Unvalidated JSON of the line. */
      value: Record<string, unknown>;
      /** Recomputed digests, keyed by the `section` name each section-end line states. */
      computedSectionDigests: Record<string, string>;
      /** Digest recomputed over every line before the manifest. */
      computedFullDigest: string;
      /** Digest recomputed over the manifest line without its LF. */
      computedManifestDigest: string;
      /** The file was gzip (true) or plain text (false). */
      compressed: boolean;
    };

export type ArtifactReadErrorCode = 'Truncated' | 'Corrupt';

export class ArtifactReadError extends Error {
  readonly code: ArtifactReadErrorCode;
  /** `NotUtf8` when the text failed the fatal UTF-8 decode (A130 calls that Unreadable, not corrupt). */
  readonly reason: 'NotUtf8' | undefined;
  constructor(code: ArtifactReadErrorCode, detail: string, reason?: 'NotUtf8') {
    super(`Artifact ${code}: ${detail}`);
    this.name = 'ArtifactReadError';
    this.code = code;
    this.reason = reason;
  }
}
