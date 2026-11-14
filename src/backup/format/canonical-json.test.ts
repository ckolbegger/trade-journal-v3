import { describe, expect, it } from 'vitest';
import { canonicalJson, CanonicalJsonUnsupported } from './canonical-json.ts';

describe('canonical JSON (A123)', () => {
  it('should serialize both key orders to the identical sorted compact text', () => {
    const expected = '{"a":"xé","b":1}';
    expect(canonicalJson({ b: 1, a: 'xé' })).toBe(expected);
    expect(canonicalJson({ a: 'xé', b: 1 })).toBe(expected);
    // UTF-16 code unit order: "Z" (0x5A) < "a" (0x61) < "é" (0xE9) < astral (0xD83D).
    expect(canonicalJson({ '😀': [1, { z: null, y: true }], é: 0, a: '', Z: -3 })).toBe(
      '{"Z":-3,"a":"","é":0,"😀":[1,{"y":true,"z":null}]}',
    );
  });

  it('should reject 1.5, NaN, undefined, and a Date with CanonicalJsonUnsupported naming the path', () => {
    const cases: Array<[unknown, string]> = [
      [{ a: [0, 1.5] }, '$.a[1]'],
      [{ n: NaN }, '$.n'],
      [{ list: [{ u: undefined }] }, '$.list[0].u'],
      [{ d: new Date(0) }, '$.d'],
    ];
    for (const [value, path] of cases) {
      let caught: unknown;
      try {
        canonicalJson(value);
      } catch (e) {
        caught = e;
      }
      expect(caught).toBeInstanceOf(CanonicalJsonUnsupported);
      expect((caught as CanonicalJsonUnsupported).path).toBe(path);
    }
  });

  it('should reject a sparse array hole with CanonicalJsonUnsupported naming its path', () => {
    // Holes built without sparse literals, which the linter forbids.
    const leading = new Array<unknown>(2);
    leading[1] = 1;
    const nested = new Array<unknown>(3);
    nested[0] = 1;
    nested[2] = 2;
    const cases: Array<[unknown, string]> = [
      [leading, '$[0]'],
      [new Array<unknown>(1), '$[0]'],
      [{ a: nested }, '$.a[1]'],
    ];
    for (const [value, path] of cases) {
      let caught: unknown;
      try {
        canonicalJson(value);
      } catch (e) {
        caught = e;
      }
      expect(caught).toBeInstanceOf(CanonicalJsonUnsupported);
      expect((caught as CanonicalJsonUnsupported).path).toBe(path);
    }
  });
});
