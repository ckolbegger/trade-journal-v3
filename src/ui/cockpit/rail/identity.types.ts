// W2, A221. Finished display values only (A216): no view, coordinator or `app/types` import.
// T8P.12 changed two things the frozen type left open: an action is a link, so it carries `to` where it carried `onSelect`, and the card
// carries `backTo`, the way back to the Trades tab the Trade is listed under, which the Detail's header has always held.
export interface IdentityAction {
  readonly label: 'Record entry' | 'Record exit';
  readonly to: string;
}

export interface IdentityCardProps {
  // The page heading: "NVDA".
  readonly symbol: string;
  // "<Strategy>, <Lifecycle>": "Long Call, Open".
  readonly badge: string;
  // In order: "Strike 150", "Expires Fri 18 Dec 2026 (36 days)" or "Expired Fri 20 Nov 2026", then the account.
  // A stock Trade has no strike or expiration line (A221).
  readonly lines: readonly string[];
  // Only while Writable, and none on an incoherent Detail.
  readonly actions: readonly IdentityAction[];
  // Where "Back to Trades" goes.
  readonly backTo: string;
}
