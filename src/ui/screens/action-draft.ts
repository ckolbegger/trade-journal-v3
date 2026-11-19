// A started Action (the choice and what the trader typed) that survives the Review's trip to Price History and back (C9AR.5). The Review leaves
// the page for that trip, so its form's state is gone when the way back reads it again; a trip that is not that one keeps nothing.
export interface ActionDraft {
  readonly action: string;
  readonly intent: string;
  readonly conviction: string;
  readonly considered: string;
  readonly note: string;
}

// The drafts the mounted forms hold now (a form with no change holds none), and the ones set aside by a trip to Price History.
const live = new Map<string, ActionDraft>();
const setAside = new Map<string, ActionDraft>();

export const draftKey = (reviewDate: string, tradeId: string): string => `${reviewDate}:${tradeId}`;

// A mounted form reports what it holds, or nothing once it holds no change or is gone.
export function holdDraft(key: string, draft: ActionDraft | undefined): void {
  if (draft) live.set(key, draft);
  else live.delete(key);
}

// The trader presses Price History: every draft held now waits for the way back.
export function setDraftsAside(): void {
  setAside.clear();
  for (const [key, draft] of live) setAside.set(key, draft);
}

// A Review that is not the way back from Price History (its address does not reopen the overlay) takes up nothing that waited.
export const discardDraftsSetAside = (): void => setAside.clear();

// The form that opens for the Trade picks up what waited for it.
export const draftSetAside = (key: string): ActionDraft | undefined => setAside.get(key);
export const dropDraftSetAside = (key: string): void => void setAside.delete(key);
