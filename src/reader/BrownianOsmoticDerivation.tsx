import type { Expression } from "../equations/ast.ts";
import { expressionToSpokenText } from "../equations/derivations/a11yText.ts";
import {
  brownianOsmoticSteps,
  brownianOsmoticExpressions as expressions,
  presentBrownianOsmoticExpression,
} from "../equations/derivations/brownianOsmotic.ts";
import type { BrownianOsmoticReport } from "../equations/derivations/brownianOsmoticProof.ts";
import { renderExpressionMarkup } from "../equations/derivations/mathRenderer.ts";
import "../equations/derivations/derivation.css";

export type BrownianOsmoticDerivationProps = Readonly<{
  activeDetail?: "0" | "1" | "2";
  perspective?: "historical" | "modern";
  report?: BrownianOsmoticReport | undefined;
}>;

/** Complete source-order mathematics with native disclosures; no client calculation is required. */
export function BrownianOsmoticDerivation({
  activeDetail = "1",
  perspective = "historical",
  report,
}: BrownianOsmoticDerivationProps) {
  function Formula({ expression }: { expression: Expression }) {
    const displayed = presentBrownianOsmoticExpression(expression, perspective);
    const rendered = renderExpressionMarkup(displayed);
    return (
      <section
        className="step-math"
        aria-label={expressionToSpokenText(displayed)}
        // biome-ignore lint/security/noDangerouslySetInnerHtml: authored AST rendered with KaTeX trust false.
        dangerouslySetInnerHTML={{ __html: rendered.html }}
      />
    );
  }
  return (
    <section
      id="bm-osmotic-derivation"
      className="local-steps"
      aria-labelledby="bm-osmotic-derivation-title"
      data-argument-id="arg-bm-kinetic-justification"
      data-historical-status="pedagogical-reconstruction"
      data-perspective={perspective}
    >
      <h4 id="bm-osmotic-derivation-title">
        Get the pressure without solving the molecular motion
      </h4>
      <p>
        Section 2 supplies the osmotic law that section 3 will need. The whole microscopic integral
        is too difficult to calculate. What matters for the pressure is only how that integral
        changes when a wall gives the suspended particles more room.
      </p>
      <p>
        These teaching equations follow the source’s order. In the printed notation, <i>n</i> counts
        particles, ν is number density, <i>N</i> is the molecular number, and <i>V</i>* is their
        accessible volume. Einstein’s “lg” means the natural logarithm, written ln here; his 2κ is
        modern <i>k</i>
        <sub>B</sub>. The source coordinates <i>p</i>
        <sub>1</sub>, …, <i>p</i>
        <sub>l</sub> describe states and are distinct from pressure <i>p</i>.
      </p>
      <Formula expression={expressions.thermalNotation} />
      <details className="step-local-steps" open>
        <summary>Which assumptions let the unknown factor disappear?</summary>
        <ul>
          <li>
            Thermal equilibrium and the statistical free-energy relation from Einstein’s earlier
            theory are admitted.
          </li>
          <li>
            Particle positions are independent to the required approximation, the liquid is
            homogeneous, and no external forces favour particular positions.
          </li>
          <li>
            The particles occupy a negligible share of the accessible volume. Excluded-volume and
            interaction corrections are outside this argument.
          </li>
          <li>
            The factor <i>J</i> is independent both of the positions and of the confining volume.
            These are distinct requirements.
          </li>
          <li>
            Temperature and particle count stay fixed while the selective wall moves. Volumes and
            the logarithm’s weights are positive.
          </li>
        </ul>
        <p>
          A footnote says this statistical justification can be skipped without losing the paper’s
          later results. It is included here so the pressure law need not arrive as an unexplained
          premise.{" "}
          <a href="/papers/brownian-motion/view/german/#s2-fn1">Read the source’s scope note</a>.
        </p>
      </details>
      <ol className="derivation-steps-list">
        {brownianOsmoticSteps.map((step, index) => (
          <li
            key={step.id}
            id={step.id}
            className="derivation-step"
            data-osmotic-step={step.id}
            data-is-move={step.isMove ? "true" : "false"}
          >
            <h5>
              {index + 1}. {step.title}
            </h5>
            {step.isMove && (
              <p className="step-move-label">
                The move: connect equal placements to equal statistical weights.
              </p>
            )}
            <div className="step-reasons">
              <p
                className="step-reason"
                data-reading="0"
                data-detail="0"
                hidden={activeDetail !== "0"}
              >
                {step.reasons.r0}
              </p>
              <p
                className="step-reason"
                data-reading="1"
                data-detail="1"
                hidden={activeDetail !== "1"}
              >
                {step.reasons.r1}
              </p>
              <p
                className="step-reason"
                data-reading="2"
                data-detail="2"
                hidden={activeDetail !== "2"}
              >
                {step.reasons.r2}
              </p>
            </div>
            {step.expressions.map((expression) => (
              <Formula key={JSON.stringify(expression)} expression={expression} />
            ))}
            <details className="step-local-steps">
              <summary>See the assumptions and limits of this step</summary>
              <p>{step.reasons.r2}</p>
            </details>
            <p className="step-links">
              <a href={`/papers/brownian-motion/view/german/#${step.source.anchor}`}>
                {step.source.label}
              </a>
              {" · "}
              <a href={`/foundations/${step.tool.replace("foundation:", "")}/`}>
                Open the tool used in this step
              </a>
            </p>
          </li>
        ))}
      </ol>
      <details className="step-local-steps" open>
        <summary>Remove independence: many constituents, one locked cluster</summary>
        <p>
          This is an authored comparison, not an additional argument printed in §2. A freely placed
          rigid cluster has one translational position, even when it contains many labelled
          particles. Its internal arrangements can contribute to a different constant <i>J</i>
          <sub>c</sub>. If that factor remains volume-independent and the cluster is small compared
          with its container, its volume ratio appears once.
        </p>
        <Formula expression={expressions.lockedFactorRatio} />
        <Formula expression={expressions.lockedFreeEnergyDifference} />
        <Formula expression={expressions.lockedPressure} />
        <p>
          One cluster therefore has the pressure of one independently placed unit, not zero pressure
          and not the independent pressure of all its constituents. BM03 withholds the
          independent-particle pressure when the locked model is selected. It does not model binding
          energy, cluster formation, breakup, rotations near a wall or excluded-volume corrections.
        </p>
        <p>
          <a href="/lab/bm-03/">Compare independent particles and the locked cluster</a>
          {" · "}
          <a href="/papers/light-quanta/s5/#arg-lq-independent-configurations">
            Follow the same independence question in the light-quanta paper
          </a>
        </p>
      </details>
      {report && (
        <details className="step-local-steps" data-osmotic-check={report.status}>
          <summary>Which local algebraic steps were checked exactly?</summary>
          <p>
            {report.status === "pass"
              ? "The listed identities pass the bounded exact logarithmic calculus."
              : "At least one supplied identity failed the bounded exact calculus; the report below shows which one."}{" "}
            This check admits the stated positive domain and fixed parameters. It does not establish
            the statistical starting relation, independence, uniformity, the n-fold volume
            factorization, the physical constancy of J or the thermodynamic identification of
            pressure. It checks no experimental data.
          </p>
          <table>
            <caption>Local identities under the declared premises</caption>
            <thead>
              <tr>
                <th scope="col">Step</th>
                <th scope="col">Check</th>
              </tr>
            </thead>
            <tbody>
              {report.rows.map((row) => (
                <tr key={row.id} data-osmotic-check-row={row.id}>
                  <th scope="row">{row.label}</th>
                  <td>
                    {row.status === "pass" ? "Exact identity" : "Not established"}. {row.reason}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </details>
      )}
      <p>
        <a href="/papers/brownian-motion/s3/#bm-equilibrium-derivation">
          Next: use this pressure law with drift and diffusion in §3
        </a>
      </p>
    </section>
  );
}
