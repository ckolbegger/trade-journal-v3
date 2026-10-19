export function App({ applicationName }: { applicationName: string }) {
  return (
    <main className="app-shell">
      <header className="app-shell__header">
        <p className="app-shell__eyebrow">Device-local journal</p>
        <h1>{applicationName}</h1>
      </header>
    </main>
  );
}
