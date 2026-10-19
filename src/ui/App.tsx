export function App({
  applicationName,
  openingInstant,
}: {
  applicationName: string;
  openingInstant: string;
}) {
  return (
    <main className="app-shell">
      <header className="app-shell__header">
        <p className="app-shell__eyebrow">Device-local journal</p>
        <h1>{applicationName}</h1>
        <p className="app-shell__instant">
          Opening instant: <time dateTime={openingInstant}>{openingInstant}</time>
        </p>
      </header>
    </main>
  );
}
