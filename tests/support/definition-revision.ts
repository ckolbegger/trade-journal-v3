// The definition-revision fixture writer (D5 A74, section 6.0): definitions cannot be revised
// until D26, so a test appends revision 2 of the Position Change Reflection to the raw store, as
// D2's integrity fixture writer edits records. Debt creation, validation against the snapshot, and
// the Entry it creates stay production code. Used only while the test arranges its Workspace.
import type { IDBFactory } from 'fake-indexeddb';

export const REVISION_2_ID = 'fixture-position-change-reflection-2';
export const REVISION_2_RELABELLED_OPTION = 'option.position-change-reflection.decision-mode.reactive';
export const REVISION_2_ADDED_PROMPT = 'prompt.position-change-reflection.lesson';

interface RawPrompt {
  readonly id: string;
  readonly options?: readonly { readonly id: string; readonly label: string }[];
  readonly [key: string]: unknown;
}

function request<T>(r: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    r.onsuccess = () => resolve(r.result);
    r.onerror = () => reject(r.error ?? new Error('request failed'));
  });
}

// Appends revision 2: the Reactive option relabelled "Impulsive" and one required Text prompt, "Lesson", added.
export async function appendPositionChangeReflectionRevision2(factory: IDBFactory): Promise<string> {
  const names = (await factory.databases()).map((d) => d.name).filter((n): n is string => n?.startsWith('tj-ws-') ?? false);
  if (names.length !== 1) throw new Error(`expected one Workspace database, found ${names.length}`);
  const open = factory.open(names[0]!);
  const db = await request(open);
  try {
    const store = db.transaction('journalDefinitions', 'readwrite').objectStore('journalDefinitions');
    const all = (await request(store.getAll())) as { entryTypeKey: string; revisionNumber: number; prompts: RawPrompt[]; revision: number }[];
    const first = all.find((d) => d.entryTypeKey === 'entry-type.position-change-reflection' && d.revisionNumber === 1);
    if (!first) throw new Error('revision 1 of the Position Change Reflection is not seeded');
    const prompts = first.prompts.map((p): RawPrompt =>
      p.options
        ? { ...p, options: p.options.map((o) => (o.id === REVISION_2_RELABELLED_OPTION ? { ...o, label: 'Impulsive' } : o)) }
        : p,
    );
    prompts.push({ id: REVISION_2_ADDED_PROMPT, kind: 'Text', text: 'Lesson', required: true });
    await request(
      store.put({ id: REVISION_2_ID, entryTypeKey: first.entryTypeKey, revisionNumber: 2, prompts, revision: first.revision }),
    );
  } finally {
    db.close();
  }
  return REVISION_2_ID;
}
