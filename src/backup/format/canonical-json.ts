export class CanonicalJsonUnsupported extends Error {
  readonly path: string;
  constructor(path: string, reason: string) {
    super(`Canonical JSON cannot serialize ${reason} at ${path}`);
    this.name = 'CanonicalJsonUnsupported';
    this.path = path;
  }
}

/**
 * Canonical JSON (A123): keys sorted by UTF-16 code units, no whitespace, JSON.stringify's
 * string escapes, numbers only as safe integers. Anything else is rejected, never coerced.
 */
export function canonicalJson(value: unknown): string {
  return write(value, '$');
}

function write(value: unknown, path: string): string {
  if (value === null) return 'null';
  switch (typeof value) {
    case 'string':
      return JSON.stringify(value);
    case 'boolean':
      return value ? 'true' : 'false';
    case 'number':
      if (!Number.isSafeInteger(value)) {
        throw new CanonicalJsonUnsupported(path, `the number ${String(value)} (only safe integers)`);
      }
      return String(value);
    case 'object':
      return Array.isArray(value) ? writeArray(value, path) : writeObject(value, path);
    default:
      throw new CanonicalJsonUnsupported(path, `a ${typeof value}`);
  }
}

function writeArray(items: readonly unknown[], path: string): string {
  const parts: string[] = [];
  for (let i = 0; i < items.length; i++) {
    if (!(i in items)) throw new CanonicalJsonUnsupported(`${path}[${i}]`, 'a sparse array hole');
    parts.push(write(items[i], `${path}[${i}]`));
  }
  return `[${parts.join(',')}]`;
}

function writeObject(object: object, path: string): string {
  const proto: unknown = Object.getPrototypeOf(object);
  if (proto !== Object.prototype && proto !== null) {
    throw new CanonicalJsonUnsupported(path, 'a non-plain object');
  }
  const entries = Object.entries(object).sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));
  return `{${entries.map(([k, v]) => `${JSON.stringify(k)}:${write(v, `${path}.${k}`)}`).join(',')}}`;
}
