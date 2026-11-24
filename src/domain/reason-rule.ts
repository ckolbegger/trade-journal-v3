// The reason rule (A308), one place for the Review's save and its form: Roll and Adjust always; Hold when the Plan Call is Out; Exit unless it is Out.
// An Unknown call, or none, is not Out.
export function reasonOwed(action: 'Hold' | 'Exit' | 'Roll' | 'Adjust', call: 'Out' | 'Hold' | 'Unknown' | undefined): boolean {
  if (action === 'Hold') return call === 'Out';
  if (action === 'Exit') return call !== 'Out';
  return true;
}
