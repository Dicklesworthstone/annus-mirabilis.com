import type { LowSpeedProofView } from "../equations/derivations/lowSpeedView.ts";
import generated from "../generated/mass-energy-low-speed.json";
import { LazyLowSpeedExplorer } from "./lazyIslands.tsx";

export function MassEnergyLowSpeed() {
  return (
    <details id="me-low-speed-derivation" data-low-speed-disclosure className="local-steps">
      <summary>Follow the low-speed limit all the way to the mass conclusion</summary>
      <LazyLowSpeedExplorer proof={generated as LowSpeedProofView} moveAnchor="me-the-move" />
    </details>
  );
}
