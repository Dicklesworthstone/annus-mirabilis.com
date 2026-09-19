import { LinearProofExplorer } from "../equations/derivations/LinearProofExplorer.tsx";
import type { LinearProofView } from "../equations/derivations/linearProofView.ts";
import generated from "../generated/mass-energy-elimination.json";

/** Only the small pre-rendered proof payload crosses this server/client boundary. */
export function MassEnergyDerivation() {
  return <details id="me-ledger-derivation" data-ledger-disclosure className="local-steps">
    <summary>Follow the checked ledger subtraction step by step</summary>
    <LinearProofExplorer proof={generated as LinearProofView} />
  </details>;
}
