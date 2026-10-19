import { useState } from "react";
import type { WorkspaceDurabilityResult } from "../workspace/durability";

/** The structurally compatible view of the host port's protection result. */
type ProtectionView =
  | { readonly kind: "Protected" }
  | { readonly kind: "BestEffort"; readonly reason: string }
  | { readonly kind: "Unavailable"; readonly reason: string }
  | { readonly kind: "NotExposed" };

export function ProtectionWarning({
  protection,
  request,
}: {
  protection: ProtectionView;
  request: () => Promise<WorkspaceDurabilityResult>;
}) {
  const [outcome, setOutcome] = useState<WorkspaceDurabilityResult | undefined>(undefined);
  const [busy, setBusy] = useState(false);

  const label =
    protection.kind === "BestEffort"
      ? "Best effort"
      : protection.kind === "Unavailable"
        ? "Unavailable"
        : "Protected";

  return (
    <section role="status" aria-live="polite" className="card warning" aria-labelledby="protection-title">
      <h2 id="protection-title">This browser may clear your journal data</h2>
      <p>
        Origin storage protection is <strong>{label}</strong>. Recommend exporting a backup; the warning
        never disables writing.
      </p>
      {outcome?.outcome === "Improved" && <p>This data is now protected on this device.</p>}
      {outcome?.outcome === "AlreadyProtected" && <p>This data is already protected on this device.</p>}
      {outcome?.outcome === "NotImproved" && (
        <p>The browser did not confirm stronger protection. Keep an exported backup.</p>
      )}
      <button
        type="button"
        disabled={busy}
        onClick={() => {
          setBusy(true);
          void request()
            .then(setOutcome)
            .finally(() => setBusy(false));
        }}
      >
        Keep this data on this device
      </button>
    </section>
  );
}
