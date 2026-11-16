"use client";

import { expressionToSpokenText } from "../equations/derivations/a11yText.ts";
import { DerivationChain } from "../equations/derivations/DerivationChain.tsx";
import { renderExpressionMarkup } from "../equations/derivations/mathRenderer.ts";
import {
  presentSRDopplerChain,
  presentSRDopplerExpression,
  srDopplerAberrationChain,
  srDopplerAssumptions,
  srDopplerCoefficientEquations,
  srDopplerFrequencyChain,
  srDopplerPhaseChain,
  srDopplerSidewaysChain,
  srDopplerSourceLinks,
} from "../equations/derivations/srDoppler.ts";

export interface SRDopplerDerivationProps {
  readonly activeDetail?: "0" | "1" | "2";
  readonly perspective?: "historical" | "modern";
}

/** The full phase argument, operation choices and source returns also render without script. */
export function SRDopplerDerivation({
  activeDetail = "1",
  perspective = "historical",
}: SRDopplerDerivationProps) {
  return (
    <section
      id="sr-doppler-derivation"
      className="local-steps"
      aria-labelledby="sr-doppler-derivation-title"
      data-argument-id="arg-sr-doppler-aberration"
      data-review="draft"
      data-historical-status="pedagogical-reconstruction"
      data-model-status="vacuum-plane-wave-subluminal-boost"
    >
      <h4 id="sr-doppler-derivation-title">One wave phase fixes frequency and direction</h4>
      <p>
        Follow one plane wave through the coordinate change already established in §3. Its phase
        counts wave crests: both frames describe the same crest at the same event. Rewriting that
        one expression gives both the frequency shift and the changed direction. Neither result is
        assumed in the starting phase.
      </p>
      <p>
        The moving frame <i>k</i> travels at signed speed <i>v</i> along <i>K</i>’s x axis. The
        angle φ is the light’s <strong>propagation direction in K</strong>, measured from the
        positive x axis; φ′ belongs to <i>k</i>. Choose the sideways axes so this ray lies in the
        x-y plane. Here γ is the paper’s β, <i>c</i> its <i>V</i>, and primed coordinates its ξ, η
        and τ.
      </p>
      <details className="step-local-steps">
        <summary>What the calculation takes as given</summary>
        <dl>
          {srDopplerAssumptions.map((assumption) => (
            <div key={assumption.id}>
              <dt>{assumption.label}</dt>
              <dd>{assumption.explanation}</dd>
            </div>
          ))}
        </dl>
        <p>
          The phase here is measured in cycles, so its time coefficient is ordinary frequency ν. The
          paper writes angular frequency ω instead. Multiplying every phase by 2π changes neither
          the frequency ratio nor the direction.
        </p>
        <a href="/papers/special-relativity/s3/#sr-coordinate-derivation">
          Return to the coordinate transformation and its own premises
        </a>
      </details>
      <h5>1. Put the same phase into the moving coordinates</h5>
      <DerivationChain
        chains={[presentSRDopplerChain(srDopplerPhaseChain)]}
        activeDetail={activeDetail}
        perspective={perspective}
      />
      <h5>2. Match the coefficients at every event</h5>
      <p>
        In the moving description, the clock coefficient is ν′ and the position coefficients are
        −ν′cos φ′/c and −ν′sin φ′/c. The two descriptions must agree for independently variable t′,
        x′ and y′. Matching the three coefficients therefore gives these three equations. Matching
        only at one event, or following only a single crest, would not establish them.
      </p>
      {Object.entries(srDopplerCoefficientEquations).map(([id, expression]) => (
        <section
          key={id}
          className="step-math"
          aria-label={expressionToSpokenText(presentSRDopplerExpression(expression))}
          {...{
            dangerouslySetInnerHTML: {
              __html: renderExpressionMarkup(presentSRDopplerExpression(expression)).html,
            },
          }}
        />
      ))}
      <h5>3. Read the frequency ratio</h5>
      <DerivationChain
        chains={[presentSRDopplerChain(srDopplerFrequencyChain)]}
        activeDetail={activeDetail}
        perspective={perspective}
      />
      <h5>4. Use that frequency to read the direction</h5>
      <DerivationChain
        chains={[presentSRDopplerChain(srDopplerAberrationChain)]}
        activeDetail={activeDetail}
        perspective={perspective}
      />
      <details className="step-local-steps">
        <summary>Keep the sideways direction as well</summary>
        <DerivationChain
          chains={[presentSRDopplerChain(srDopplerSidewaysChain)]}
          activeDetail={activeDetail}
          perspective={perspective}
        />
        <p>
          These two components describe one direction. The same denominator appears because the two
          position coefficients are divided by the same frequency. A ray parallel to the motion is
          allowed: no step divides by its zero sideways component.
        </p>
      </details>
      <details className="step-local-steps">
        <summary>Right angles in which frame?</summary>
        <p>
          At <i>v</i> = 0.6<i>c</i>, γ = 1.25. A ray parallel to the motion in <i>K</i> has q = 0.5;
          a head-on ray has q = 2. Light perpendicular in <i>K</i> has q = 1.25 and cos φ′ = −0.6,
          with sin φ′ = 0.8. It is no longer perpendicular in <i>k</i>.
        </p>
        <p>
          To make the ray perpendicular in <i>k</i> instead, choose cos φ = 0.6 in <i>K</i>. Now q =
          0.8, cos φ′ = 0 and sin φ′ = 1. The two transverse cases have different input directions
          and different frequency shifts; naming the frame is part of the question.
        </p>
        <a href="/lab/sr-09/">Change the signed speed and light direction in the laboratory</a>
      </details>
      <details className="modern-margin" data-reading="3">
        <summary>What has been established</summary>
        <p>
          This is a teaching reconstruction of §7’s phase substitution, conditional on the already
          derived coordinate map and the vacuum plane-wave description. The checked algebra
          establishes its frequency and direction consequences. It does not establish those physical
          premises from observations, or derive the separate field-amplitude law. The sound Doppler
          effect is an analogy involving a medium; it is not a premise here.
        </p>
        <p>
          The formula admits |v| &lt; c. Taking a limit toward c does not supply an observer moving
          at c. Phase and wave-vector language may be used in a later geometric formulation, but the
          argument above does not import that later formulation as a historical premise.
        </p>
        <p className="fine">
          <cite>A. Einstein, “Zur Elektrodynamik bewegter Körper” (1905), §7, pp. 910–912.</cite>
        </p>
      </details>
      <h5>Return to the printed argument</h5>
      <ul>
        {srDopplerSourceLinks.map((source) => (
          <li key={source.id} id={source.id}>
            <a href={`/papers/special-relativity/view/german/#${source.anchor}`}>{source.label}</a>
          </li>
        ))}
      </ul>
    </section>
  );
}
