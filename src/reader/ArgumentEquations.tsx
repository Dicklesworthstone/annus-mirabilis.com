import { EquationScope } from "../equations/EquationScope.tsx";
import { SemanticEquation } from "../equations/SemanticEquation.tsx";
import { LazyArgumentEquations } from "./LazyArgumentEquations.tsx";
import { lessonTitlesFor, paperEquations } from "./paperEquations.ts";

/**
 * Server-composed, passage-local disclosure: the worked text is never gated by hydration.
 *
 * `lazy` (whole-paper pages): the cards load on first opening, and until then the disclosure
 * links to `sectionHref`, the section's own page, where this same component renders them inline.
 * See LazyArgumentEquations for the measurement that made it necessary.
 *
 * It imports nothing paper-specific. It used to render mass-energy's two proof explorers, and so
 * imported them: when the Brownian reader began to use it, their client code (with the
 * elimination proof's JSON) joined Brownian's first-route JavaScript, which grew from 211,085 to
 * 216,377 bytes on BUILD 23. PaperPage renders them beside it instead.
 */
export function ArgumentEquations({
  paperId,
  argumentId,
  lazy = false,
  sectionHref,
  title = argumentId,
}: {
  paperId: string;
  argumentId: string;
  lazy?: boolean;
  sectionHref?: string | undefined;
  /** The argument's title, for the lazy form's link name. */
  title?: string | undefined;
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
        <LazyArgumentEquations argumentId={argumentId} sectionHref={sectionHref} title={title}>
          {labLink}
        </LazyArgumentEquations>
      ) : (
        <details className="local-steps" data-argument-equations={argumentId}>
          <summary>Explore the equations in this step</summary>
          <p>
            Read each operation, check its units and assumptions, or open the mathematical step
            behind it. These are modern teaching equations, not the equations as printed.
          </p>
          <EquationScope
            scope={`reader-${argumentId}`}
            lessonTitles={lessonTitlesFor(paperId, equations)}
          >
            {equations.map((equation) => (
              <SemanticEquation key={equation.id} equation={equation} />
            ))}
          </EquationScope>
          {labLink}
        </details>
      )}
    </>
  );
}
