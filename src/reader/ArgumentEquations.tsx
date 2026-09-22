import { EquationScope } from "../equations/EquationScope.tsx";
import { SemanticEquation } from "../equations/SemanticEquation.tsx";
import type { CompiledEquation } from "../equations/viewTypes.ts";
import { LazyArgumentEquations } from "./LazyArgumentEquations.tsx";
import { MassEnergyDerivation } from "./MassEnergyDerivation.tsx";
import { MassEnergyLowSpeed } from "./MassEnergyLowSpeed.tsx";
import { paperEquations } from "./paperEquations.ts";

/**
 * Server-composed, passage-local disclosure: the worked text is never gated by hydration.
 *
 * `lazy` (whole-paper pages): the cards load on first opening, and until then the disclosure
 * links to `sectionHref`, the section's own page, where this same component renders them inline.
 * See LazyArgumentEquations for the measurement that made it necessary.
 */
export function ArgumentEquations({
  paperId,
  argumentId,
  lazy = false,
  sectionHref,
}: {
  paperId: string;
  argumentId: string;
  lazy?: boolean;
  sectionHref?: string | undefined;
}) {
  const equations = [...paperEquations(paperId).values()].filter(
    (equation) => equation.argument === argumentId,
  );
  if (equations.length === 0) return null;
  // Mass-energy's coefficient laboratory binds these equations; no other paper's do, so the link
  // is mass-energy's alone (it was printed under every paper's equations).
  const labLink =
    paperId === "mass-energy" ? (
      <p>
        <a href="/lab/me-02/#coefficient-equations">
          Connect the result terms to the coefficient laboratory →
        </a>
      </p>
    ) : null;
  return (
    <>
      {lazy && sectionHref ? (
        <LazyArgumentEquations paperId={paperId} argumentId={argumentId} sectionHref={sectionHref}>
          {labLink}
        </LazyArgumentEquations>
      ) : (
        <details className="local-steps" data-argument-equations={argumentId}>
          <summary>Explore the equations in this step</summary>
          <p>
            Read each operation, check its units and assumptions, or open the mathematical step
            behind it. These are modern teaching equations, not a reviewed transcription.
          </p>
          <EquationScope scope={`reader-${argumentId}`}>
            {equations.map((equation) => (
              <SemanticEquation key={equation.id} equation={equation} />
            ))}
          </EquationScope>
          {labLink}
        </details>
      )}
      {paperId === "mass-energy" && argumentId === "arg-me-small-speed" && <MassEnergyLowSpeed />}
      {paperId === "mass-energy" && argumentId === "arg-me-constant-premise" && (
        <MassEnergyDerivation />
      )}
    </>
  );
}
