// Shared by I95.8 and I95.9: the Journal contract's three revised forms, written out from "Initial Entry Definitions" in specs/design/journal.md, and readers of what a Workspace holds.
import type { Application } from '../../../src/app/compose.ts';
import type { dumpAll } from '../d8/support.ts';

export const DAILY = 'entry-type.daily-trade-review';
export const REFLECTION = 'entry-type.position-change-reflection';
export const CLOSE = 'entry-type.close-review';
export const REVISED = [CLOSE, DAILY, REFLECTION];
const EMOTIONS = ['Calm', 'Eager', 'Anxious', 'FOMO', 'Revenge', 'Relieved', 'Frustrated', 'Other'];

export type Dump = Awaited<ReturnType<typeof dumpAll>>;
export type Definition = { id: string; entryTypeKey: string; revisionNumber: number };

export const definitionsOf = (dump: Dump): Definition[] => {
  const [name] = Object.keys(dump).filter((n) => n.startsWith('tj-ws-'));
  return (dump[name!] as Record<string, unknown[]>)['journalDefinitions'] as Definition[];
};

// The contract's prompt lists: text, kind, whether required, the workflow role, options, range, and for a conditionally required prompt the text of the prompt that controls it.
export const CONTRACT: Record<string, readonly object[]> = {
  [REFLECTION]: [
    { text: 'Why did you leave the Plan?', kind: 'Text', required: false, role: 'PlanDepartureReason' },
    { text: 'Why did it expire worthless?', kind: 'Text', required: false, role: 'ExpirationReason' },
    { text: 'Decision mode', kind: 'SingleSelect', required: false, options: ['As Planned', 'Deliberate Adjustment', 'Reactive', 'Externally Imposed'] },
    { text: 'Primary emotion', kind: 'SingleSelect', required: false, options: EMOTIONS },
    { text: 'Decision confidence', kind: 'Scale', required: false, range: [1, 5] },
    { text: 'Note', kind: 'Text', required: false },
  ],
  [CLOSE]: [
    { text: 'Would you take this Trade again under similar conditions?', kind: 'SingleSelect', required: true, options: ['Yes, as planned', 'Yes, with changes', 'No', 'Unsure'] },
    { text: 'What worked, and what did not?', kind: 'Text', required: false },
    { text: 'What is the key lesson?', kind: 'Text', required: true },
  ],
  [DAILY]: [
    { text: 'Action', kind: 'SingleSelect', required: true, role: 'Action', options: ['Hold', 'Exit', 'Roll', 'Adjust', 'Settle Later'], protectedOptions: ['Settle Later'] },
    { text: 'Why?', kind: 'Text', required: false, role: 'Intent', requiredWhenPrompt: 'Action', requiredWhenOptions: ['Roll', 'Adjust'] },
    { text: 'Conviction now', kind: 'Scale', required: false, range: [1, 5] },
    { text: 'Anything you considered doing and decided against?', kind: 'Text', required: false },
    { text: 'Note', kind: 'Text', required: false },
  ],
};

export async function latestForm(app: Application, key: string) {
  const found = await app.Journal.getDefinitions({ latestFor: key });
  if (found.kind !== 'Found') throw new Error(`no definition for ${key}`);
  return found.definition;
}

// A form's prompts as the contract states them.
export function shapeOf(prompts: Awaited<ReturnType<typeof latestForm>>['prompts']): object[] {
  const action = prompts.find((p) => p.kind === 'SingleSelect' && p.options.some((o) => o.label === 'Exit'));
  const label = (id: string) => (action?.kind === 'SingleSelect' ? action.options.find((o) => o.id === id)?.label : undefined);
  return prompts.map((p) => ({
    text: p.text,
    kind: p.kind,
    required: p.required,
    ...('role' in p && p.role ? { role: p.role } : {}),
    ...(p.kind === 'SingleSelect' ? { options: p.options.map((o) => o.label) } : {}),
    ...(p.kind === 'SingleSelect' && p.options.some((o) => o.protected) ? { protectedOptions: p.options.filter((o) => o.protected).map((o) => o.label) } : {}),
    ...(p.kind === 'Scale' ? { range: [p.min, p.max] } : {}),
    ...('requiredWhen' in p && p.requiredWhen ? { requiredWhenPrompt: prompts.find((q) => q.id === p.requiredWhen!.promptId)?.text ?? p.requiredWhen.promptId, requiredWhenOptions: p.requiredWhen.optionIds.map((id) => label(id)) } : {}),
  }));
}

