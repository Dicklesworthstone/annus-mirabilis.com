"use client";

import type { Expression } from "../equations/ast.ts";
import {
  brownianInferenceChain,
  brownianInferenceEquations,
  brownianInferenceHistory,
  brownianInferenceMetadata,
  presentBrownianInferenceChain,
  presentBrownianInferenceExpression,
} from "../equations/derivations/brownianInference.ts";
import { DerivationChain } from "../equations/derivations/DerivationChain.tsx";
import { renderExpressionMarkup } from "../equations/derivations/mathRenderer.ts";

export interface BrownianInferenceDerivationProps {
  readonly activeDetail?: "0" | "1" | "2";
  readonly perspective?: "historical" | "modern";
}

const chain = presentBrownianInferenceChain(brownianInferenceChain);
function Formula({ expression, label }: { expression: Expression; label: string }) {
  const rendered = renderExpressionMarkup(presentBrownianInferenceExpression(expression));
  return (
    <section
      className="step-math"
      aria-label={label}
      {...{ dangerouslySetInnerHTML: { __html: rendered.html } }}
    />
  );
}

/** Native disclosures and server-rendered mathematics keep the inference readable without script. */
export function BrownianInferenceDerivation({
  activeDetail = "1",
  perspective = "historical",
}: BrownianInferenceDerivationProps) {
  return (
    <section
      id={brownianInferenceMetadata.anchor}
      className="local-steps"
      aria-labelledby="bm-molecular-number-heading"
      data-argument-id={brownianInferenceMetadata.argument}
      data-review="draft"
      data-historical-status="pedagogical-reconstruction"
      data-model-status="exact-within-model"
    >
      <h4 id="bm-molecular-number-heading">
        From observed spread to a molecular-number estimate
      </h4>
      <p>
        Choose the molecular number whose predicted spread matches the observations. The three
        algebraic steps below are checked exactly, conditional on that fitting choice and the
        stated model. They do not establish that the observations satisfy the model.
      </p>
      <details className="step-local-steps" open>
        <summary>Keep the population prediction and the observed sample separate</summary>
        <p>
          In the ideal zero-drift, one-axis model, the population mean square obeys the first
          relation. The second gives the diffusivity for dilute spheres with Stokes drag. The
          brackets in this first display denote the population average.
        </p>
        <Formula
          expression={brownianInferenceEquations.populationMoment}
          label="Ideal population mean square equals twice the diffusivity times the observation interval"
        />
        <Formula
          expression={brownianInferenceEquations.modelDiffusivity}
          label="Molar diffusivity depends on temperature, viscosity, radius and the unknown molecular number"
        />
        <p>
          Now square each observed one-axis displacement and average those squares over the same
          positive observation interval. In the chain below, the brackets denote that observed
          mean square. Define the fitted estimate N̂ by matching the model prediction to this
          observed value. This is a method-of-moments definition; it does not assert that a
          finite sample equals the population mean square, or that N̂ equals the model parameter N.
        </p>
        <Formula
          expression={brownianInferenceEquations.matching}
          label="Fitting definition: observed mean square equals the predicted spread at the candidate molecular-number estimate"
        />
        <p>
          Supply the gas constant, absolute temperature, viscosity and particle radius
          independently. They and the observed mean square must be positive and finite. No
          assumed molecular number or modern exact Boltzmann constant supplies the observations.
          The Gaussian integral and the physical moment law remain admitted premises here.
        </p>
      </details>
      <DerivationChain
        chains={[chain]}
        activeDetail={activeDetail}
        perspective={perspective}
        sourceLinkLabel="Compare with the source passage"
      />
      <details className="step-local-steps">
        <summary>What this estimate can and cannot determine</summary>
        <p>
          Without an independent radius, spreading identifies only the product of radius and
          molecular number. Doubling the radius and halving the molecular number leaves the
          predicted diffusivity unchanged. Measuring a diameter and entering it as a radius
          changes the inference by a factor of two.
        </p>
        <p>
          Mean square means the average of squared displacements, not the square of their signed
          average. Use one coordinate: a two-dimensional radial mean square has a different
          factor. A raw mean square with drift is not the zero-drift variance used by this model.
          An all-zero observed mean square gives no finite positive estimate by this inversion.
        </p>
        <p>
          Finite sampling, motion blur, localization error, drift and uncertainty in the
          independent inputs need separate analysis. Inverting an unbiased estimate of
          diffusivity does not generally produce an unbiased estimate of molecular number.
          Synthetic observations generated from an assumed molecular number demonstrate the
          method; they are not independent evidence for that number.
        </p>
        <p>
          <a href="/lab/bm-07/">
            Try the inference, radius ambiguity and uncertainty in the laboratory
          </a>
          . The laboratory distinguishes a synthetic exercise from later experimental evidence.
          In modern SI, Avogadro&apos;s constant is defined exactly; this is a reconstruction of
          historical inference or a consistency test of the measurement model.
        </p>
      </details>
      <details className="modern-margin" data-reading="3">
        <summary>Historical context and notation</summary>
        <p>{brownianInferenceHistory}</p>
      </details>
      <ul className="fine">
        <li id="bm-inference-source-inversion">
          <a href="/papers/brownian-motion/view/german/#s5-p3">
            §5, page 560: Einstein turns the displacement relation around to determine N
          </a>
          . The printed formula uses λₓ², k and P; the checked teaching route uses an explicit
          estimate, mean square, η and a.
        </li>
        <li id="bm-inference-source-measurement">
          <a href="/papers/brownian-motion/view/german/#s5-p4">
            §5, page 560: the closing proposal to test the relation
          </a>
          . This passage proposes a measurement and reports no measured molecular number.
        </li>
      </ul>
    </section>
  );
}
