import type { Expression } from "../equations/ast.ts";
import { expressionToSpokenText } from "../equations/derivations/a11yText.ts";
import {
  type LqPlanckDerivationPayload,
  lqPlanckAssumptions,
  lqPlanckMetadata,
  lqPlanckSteps,
  presentPlanckExpression,
} from "../equations/derivations/lightQuantaPlanck.ts";
import { renderExpressionMarkup } from "../equations/derivations/mathRenderer.ts";
import "../equations/derivations/derivation.css";

export type LightQuantaPlanckDerivationProps = Readonly<{
  payload: LqPlanckDerivationPayload;
  activeDetail?: "0" | "1" | "2";
  perspective?: "historical" | "modern";
}>;
function Formula({ expression }: { expression: Expression }) {
  const displayed = presentPlanckExpression(expression);
  return (
    <section
      className="step-math"
      aria-label={expressionToSpokenText(displayed)}
      // biome-ignore lint/security/noDangerouslySetInnerHtml: authored AST rendered by KaTeX with trust false.
      dangerouslySetInnerHTML={{ __html: renderExpressionMarkup(displayed).html }}
    />
  );
}
function Scientific({ value }: { value: string }) {
  const parts = /^([\d.]+)e([+-]?\d+)$/.exec(value);
  if (!parts) return <>{value}</>;
  const exponent = Number(parts[2]);
  return (
    <span role="math" aria-label={`${parts[1]} times ten to the ${exponent}`}>
      {parts[1]} × 10<sup>{exponent}</sup>
    </span>
  );
}

/** All mathematics and historical comparisons are available in static HTML and print. */
export function LightQuantaPlanckDerivation({
  payload,
  activeDetail = "1",
  perspective = "historical",
}: LightQuantaPlanckDerivationProps) {
  return (
    <section
      id="lq-planck-constants-derivation"
      className="local-steps"
      aria-labelledby="lq-planck-constants-derivation-title"
      data-argument-id="arg-lq-planck-constants"
      data-historical-status="pedagogical-reconstruction"
      data-perspective={perspective}
    >
      <h4 id="lq-planck-constants-derivation-title">
        From the low-frequency spectrum to a molecular number
      </h4>
      <p>
        Section 2 asks how much of Planck’s molecular-scale inference follows from the part of his
        spectrum that agrees with the classical picture. Follow the actual limiting ratio, then the
        coefficient comparison and its historical numerical inputs.
      </p>
      <p>
        These teaching equations write A and B for the paper’s α and β, c for L, and k<sub>B</sub>{" "}
        for R/N. The symbolic calculation uses consistent units. The worked calculation below uses
        the historical CGS inputs together.
      </p>
      <details className="local-steps" open>
        <summary>Which premises remain assumptions?</summary>
        <ul>
          {lqPlanckAssumptions.map((premise) => (
            <li key={premise.id}>
              <strong>{premise.label}.</strong> {premise.explanation}
            </li>
          ))}
        </ul>
      </details>
      <ol className="derivation-steps-list">
        {lqPlanckSteps.map((step, index) => (
          <li
            key={step.id}
            id={step.id}
            className="derivation-step"
            data-planck-step={step.id}
            data-is-move={step.move ? "true" : "false"}
          >
            <h5>
              {index + 1}. {step.title}
            </h5>
            {step.move && <p className="the-move-box">The move: {step.move}</p>}
            <div className="step-reasons">
              {(["0", "1", "2"] as const).map((detail) => (
                <p
                  key={detail}
                  className="step-reason"
                  data-reading={detail}
                  data-detail={detail}
                  hidden={activeDetail !== detail}
                >
                  <noscript>
                    <b className="reading-label">
                      {detail === "0"
                        ? "In one breath"
                        : detail === "1"
                          ? "Full explanation"
                          : "Every step"}
                    </b>
                  </noscript>
                  {step.reasons[`r${detail}`]}
                </p>
              ))}
            </div>
            {step.expressions.map((expression) => (
              <Formula key={JSON.stringify(expression)} expression={expression} />
            ))}
            {activeDetail !== "2" && (
              <details className="local-steps">
                <summary>See every step and its limits</summary>
                <p>{step.reasons.r2}</p>
              </details>
            )}
            <p className="step-links">
              <a href={`/foundations/${step.tool.replace("foundation:", "")}/`}>
                Open the mathematical tool
              </a>
              {" · "}
              <a href={`/papers/light-quanta/view/german/#${step.source}`}>
                Read this step’s source
              </a>
            </p>
          </li>
        ))}
      </ol>
      <details className="local-steps" open>
        <summary>What the local limit establishes</summary>
        <p>
          The first coefficients of (exp(x) − 1)/x are {payload.limit.coefficients.join(", ")}. Its
          limit is {payload.limit.value}. The quotient at exactly zero remains undefined.
        </p>
        <p>
          This establishes a leading spectral coefficient as positive x approaches zero. It supplies
          no error bound at an arbitrary finite frequency and no experimental confirmation of the
          admitted radiation law.
        </p>
        <a href="/lab/lq-03/">Compare the spectra away from the low-frequency limit</a>
      </details>
      <section
        aria-labelledby="lq-planck-worked-calculation-title"
        data-planck-worked-calculation="historical"
      >
        <h5 id="lq-planck-worked-calculation-title">A worked calculation with historical inputs</h5>
        <table>
          <caption>The inputs used together in this numerical reconstruction</caption>
          <thead>
            <tr>
              <th scope="col">Quantity</th>
              <th scope="col">Calculation value and units</th>
              <th scope="col">Where the input comes from</th>
            </tr>
          </thead>
          <tbody>
            {payload.worked.inputs.map((input) => (
              <tr key={input.quantityId}>
                <th scope="row">{input.label}</th>
                <td>
                  <Scientific value={input.value} /> {input.unit}
                </td>
                <td>
                  {input.role}. {input.provenance}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        <p>
          The edition’s calculation gives N ≈ <Scientific value={payload.worked.calculatedN} /> per
          gram-molecule. The source prints N = <Scientific value={payload.worked.printedN} />. These
          are the calculated value and the printed rounded number, shown separately.
        </p>
        <details className="local-steps" open>
          <summary>Keep the printed α exponent visible</summary>
          <p>
            The source display reads α = {payload.worked.alphaAsPrinted}. The edition’s numerical
            reconstruction uses exponent −57. Keeping the printed exponent −56 in the same
            calculation gives N ≈ <Scientific value={payload.worked.printedExponentN} />, ten times
            smaller. Reproducing the printed N motivates the edition’s calculation choice; it does
            not replace the source display.
          </p>
          <p>
            <a href="/papers/light-quanta/view/german/#eq-s2-d2">Read the printed α</a>
            {" · "}
            <a href="/papers/light-quanta/view/german/#eq-s2-d6">
              Read the printed molecular number
            </a>
            {" · "}
            <a href="/lab/lq-02/">Inspect the historical calculation in the laboratory</a>
          </p>
        </details>
        <p>
          <strong>Separate modern comparison.</strong> The modern exact N<sub>A</sub> is{" "}
          <Scientific value={payload.worked.modernN} /> mol<sup>−1</sup>. It is not an input to the
          historical calculation above. Substituting modern constants constructed from N<sub>A</sub>{" "}
          and k<sub>B</sub> would reproduce their defining relationship, rather than independently
          measure a molecular number.
        </p>
        <p>
          This coefficient comparison also does not turn quantized resonator energies into a
          hypothesis about freely propagating light. That further argument is the subject of the
          later sections.
        </p>
      </section>
      <details className="local-steps" data-reading="3" data-detail="3">
        <summary>Historian’s margin</summary>
        <p>{lqPlanckMetadata.historicalReading}</p>
        <p>
          <cite>{lqPlanckMetadata.citation}</cite>{" "}
          <a href="/papers/light-quanta/view/german/#s2-p2">Read the source argument</a>
        </p>
      </details>
    </section>
  );
}
