// The field rule of `verify:fixtures` (D2 T2.56, brought forward from D4 A51; plan revision 8):
// the current views must equal a committed snapshot on every field the snapshot contains,
// recursively. Arrays are compared item by item and must have equal lengths. A field the current
// release adds is allowed. Returns the path of each difference, empty when the snapshot holds.

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

export function compareSnapshot(views: unknown, snapshot: unknown, path = ''): string[] {
  if (Array.isArray(snapshot)) {
    if (!Array.isArray(views)) return [path];
    const lengthDiff = views.length === snapshot.length ? [] : [`${path} (length ${views.length}, snapshot ${snapshot.length})`];
    const items = snapshot.slice(0, views.length).flatMap((item, i) => compareSnapshot(views[i], item, `${path}[${i}]`));
    return [...lengthDiff, ...items];
  }
  if (isRecord(snapshot)) {
    if (!isRecord(views)) return [path];
    return Object.keys(snapshot).flatMap((key) => compareSnapshot(views[key], snapshot[key], path === '' ? key : `${path}.${key}`));
  }
  return Object.is(views, snapshot) ? [] : [path];
}
