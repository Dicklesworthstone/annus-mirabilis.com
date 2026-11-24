import type { Expression } from "../equations/ast.ts";
import { expressionToSpokenText } from "../equations/derivations/a11yText.ts";
import {
  classicalCutoffAssumptions,
  independentEntropyAssumptions,
  type LqFoundationsSection,
  lqFoundationSteps,
  lqFoundationsMetadata,
  presentLqFoundationExpression,
} from "../equations/derivations/lightQuantaFoundations.ts";
import { renderExpressionMarkup } from "../equations/derivations/mathRenderer.ts";
import "../equations/derivations/derivation.css";

export type LightQuantaFoundationsDerivationProps = Readonly<{
  section: LqFoundationsSection;
  activeDetail?: "0" | "1" | "2";
  perspective?: "historical" | "modern";
}>;

function Formula({ expression }: { expression: Expression }) {
  const displayed = presentLqFoundationExpression(expression);
  return (
    <section
      className="step-math"
      aria-label={expressionToSpokenText(displayed)}
      // biome-ignore lint/security/noDangerouslySetInnerHtml: authored AST rendered by KaTeX with trust false.
      dangerouslySetInnerHTML={{ __html: renderExpressionMarkup(displayed).html }}
    />
  );
}

/** Static equations, reason layers and real links remain usable without JavaScript. */
export function LightQuantaFoundationsDerivation({
  section,
  activeDetail = "1",
  perspective = "historical",
}: LightQuantaFoundationsDerivationProps) {
  const classical = section === "s1";
  const anchor = classical ? "lq-classical-cutoff-derivation" : "lq-independent-entropy-derivation";
  const assumptions = classical ? classicalCutoffAssumptions : independentEntropyAssumptions;
  const historical = lqFoundationsMetadata[section];
  return (
    <section
      id={anchor}
      className="local-steps"
      aria-labelledby={`${anchor}-title`}
      data-argument-id={
        classical ? "arg-lq-classical-allocation" : "arg-lq-independent-configurations"
      }
      data-lq-foundations-section={section}
      data-historical-status="pedagogical-reconstruction"
      data-perspective={perspective}
    >
      <h4 id={`${anchor}-title`}>
        {classical
          ? "Why the classical spectrum has no finite total over all frequencies"
          : "Why independent chances give one entropy contribution per point"}
      </h4>
      <p>
        {classical
          ? "Section 1 combines two equilibrium conditions and finds a radiation density that cannot be integrated to a finite total over all frequencies. Follow the finite integral first, then the argument that rules out a finite limit."
          : "Section 5 compares a configuration's probability with its entropy. Follow the independent-point product into Boltzmann's relation, and see exactly where the count becomes a coefficient."}
      </p>
      <p>
        These teaching steps use <i>k</i>
        <sub>B</sub> for the paper’s <i>R</i>/<i>N</i>
        {classical ? (
          <>
            {" "}
            and <i>c</i> for its <i>L</i>
          </>
        ) : (
          <>
            {" "}
            and <i>f</i> for its volume ratio <i>v</i>/<i>v</i>
            <sub>0</sub>
          </>
        )}
        . The logarithm is natural. No modern numerical constants or independent experimental
        evidence enter the calculation.
      </p>
      <details className="local-steps" open>
        <summary>Which premises remain assumptions?</summary>
        <ul>
          {assumptions.map((premise) => (
            <li key={premise.id}>
              <strong>{premise.label}.</strong> {premise.explanation}
            </li>
          ))}
        </ul>
      </details>
      <ol className="derivation-steps-list">
        {lqFoundationSteps[section].map((step, index) => (
          <li
            key={step.id}
            id={step.id}
            className="derivation-step"
            data-lq-foundations-step={step.id}
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
              <details className="step-local-steps">
                <summary>See the assumptions and limits of this step</summary>
                <p>{step.reasons.r2}</p>
              </details>
            )}
            <p className="step-links">
              <a href={`/foundations/${step.tool.replace("foundation:", "")}/`}>{step.toolLabel}</a>
              {" · "}
              <a href={`/papers/light-quanta/view/german/#${step.source.anchor}`}>
                {step.source.label}
              </a>
            </p>
          </li>
        ))}
      </ol>
      <details className="step-local-steps" data-reading="3" data-detail="3">
        <summary>Historian’s margin</summary>
        <p>{historical.historicalReading}</p>
        <p>
          <cite>{historical.citation}</cite>{" "}
          <a href={`/papers/light-quanta/view/german/#${historical.sourceAnchor}`}>
            Read the source passage
          </a>
        </p>
      </details>
      <details className="local-steps" open>
        <summary>
          {classical
            ? "What does the divergence say about the physical model?"
            : "What changes when the positions are correlated?"}
        </summary>
        {classical ? (
          <>
            <p>
              The positive-temperature premise matters. At zero temperature this classical
              expression vanishes; the calculation above does not divide by that limiting value. At
              any fixed positive temperature, every finite cutoff gives a finite result. Raising
              that cutoff gives larger results without curing the divergence over all frequencies.
            </p>
            <p>
              The result is a difficulty of the admitted classical equilibrium model. It does not
              refute the wave description’s successes in interference and diffraction, nor does it
              derive the light-quantum hypothesis.
            </p>
            <a href="/lab/lq-02/">Widen the cutoff and request the total over all frequencies</a>
          </>
        ) : (
          <>
            <p>
              Points locked to one common position enter the chosen region together. Their joint
              probability is f, regardless of how many labels are attached to that position.
              Applying the same admitted entropy principle would give k<sub>B</sub> ln f; the factor
              n was licensed by independence.
            </p>
            <p>
              At f = 1, ln f = 0 and the entropy difference vanishes. Zero points also give zero
              within the admitted positive-fraction domain. At f = 0 the logarithm is undefined, so
              this finite-entropy calculation refuses the comparison.
            </p>
            <p>
              <a href="/lab/lq-05/">Compare independent points with locked positions</a>
              {" · "}
              <a href="/papers/light-quanta/s6/#lq-entropy-correspondence-derivation">
                See how §6 uses the entropy coefficient
              </a>
            </p>
          </>
        )}
      </details>
    </section>
  );
}
