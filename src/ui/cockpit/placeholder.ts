// What the shell (`screens/trade-detail/Cockpit.tsx`) passes a card or drawer that has no content yet (D08P T8P.5). A placeholder renders nothing
// and ignores it; the wave-1 lane that owns the path replaces the component and reads what it needs from these.
export interface ShellProps {
  readonly view?: unknown;
  readonly timeZone?: string;
}
