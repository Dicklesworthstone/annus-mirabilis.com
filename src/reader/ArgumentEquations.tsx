import { EquationScope } from "../equations/EquationScope.tsx";
import { SemanticEquation } from "../equations/SemanticEquation.tsx";
import type { CompiledEquation } from "../equations/viewTypes.ts";
import massEnergy from "../generated/mass-energy-equations.json";
import { MassEnergyDerivation } from "./MassEnergyDerivation.tsx";
import { MassEnergyLowSpeed } from "./MassEnergyLowSpeed.tsx";

/** Server-composed, passage-local disclosure: the worked text is never gated by hydration. */
export function ArgumentEquations({
  paperId,
  argumentId,
}: {
  paperId: string;
  argumentId: string;
}) {
  const equations = (massEnergy.equations as readonly CompiledEquation[]).filter(
    (equation) => equation.paper === paperId && equation.argument === argumentId,
  );
  if (equations.length === 0) return null;
  return (
    <>
      <details className="local-steps" data-argument-equations={argumentId}>
        <summary>Explore the equations in this step</summary>
        <p>
          Read each operation, check its units and assumptions, or open the mathematical step behind
          it. These are modern teaching equations, not a reviewed transcription.
        </p>
        <EquationScope scope={`reader-${argumentId}`}>
          {equations.map((equation) => (
            <SemanticEquation key={equation.id} equation={equation} />
          ))}
        </EquationScope>
        <p>
          <a href="/lab/me-02/#coefficient-equations">
            Connect the result terms to the coefficient laboratory →
          </a>
        </p>
      </details>
      {paperId === "mass-energy" && argumentId === "arg-me-small-speed" && <MassEnergyLowSpeed />}
      {paperId === "mass-energy" && argumentId === "arg-me-constant-premise" && (
        <MassEnergyDerivation />
      )}
    </>
  );
}
