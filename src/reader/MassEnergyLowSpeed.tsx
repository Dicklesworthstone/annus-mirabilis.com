import { LowSpeedExplorer } from "../equations/derivations/LowSpeedExplorer.tsx";
import type { LowSpeedProofView } from "../equations/derivations/lowSpeedView.ts";
import generated from "../generated/mass-energy-low-speed.json";

export function MassEnergyLowSpeed() {
  return (
    <details id="me-low-speed-derivation" data-low-speed-disclosure className="local-steps">
      <summary>Follow the low-speed limit all the way to the mass conclusion</summary>
      <LowSpeedExplorer proof={generated as LowSpeedProofView} />
    </details>
  );
}
