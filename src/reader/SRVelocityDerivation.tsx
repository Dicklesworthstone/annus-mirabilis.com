"use client";

import { expressionToSpokenText } from "../equations/derivations/a11yText.ts";
import { DerivationChain } from "../equations/derivations/DerivationChain.tsx";
import { renderExpressionMarkup } from "../equations/derivations/mathRenderer.ts";
import {
  presentSRVelocityChain,
  presentSRVelocityExpression,
  srVelocityDerivations,
  srVelocityHistoricalReading,
  srVelocitySourceLinks,
} from "../equations/derivations/srVelocityComposition.ts";

export interface SRVelocityDerivationProps {
  readonly activeDetail?: "0" | "1" | "2";
  readonly perspective?: "historical" | "modern";
}

const longitudinal = presentSRVelocityChain(srVelocityDerivations.longitudinal);
const transverse = presentSRVelocityChain(srVelocityDerivations.transverse);

/** The two frame directions and the sideways component remain explicit before hydration. */
export function SRVelocityDerivation({
  activeDetail = "1",
  perspective = "historical",
}: SRVelocityDerivationProps) {
  const motion = presentSRVelocityExpression(srVelocityDerivations.setup.longitudinalMotion);
  return (
    <section
      id="sr-velocity-derivation"
      className="local-steps"
      aria-labelledby="sr-velocity-derivation-title"
      data-argument-id="arg-sr-velocity-composition"
      data-review="draft"
      data-historical-status="pedagogical-reconstruction"
      data-model-status="exact-within-stated-assumptions"
    >
      <h4 id="sr-velocity-derivation-title">
        Transform the clock as well as the displacement
      </h4>
      <p>
        The point’s velocity is given in the moving frame k. What velocity does K assign to the
        same path? Section 5 answers by inserting the coordinate transformation into a straight,
        uniform motion. Open each step to see where the denominator comes from.
      </p>
      <p>
        Here V is light speed and β is Einstein’s Lorentz factor, written c and γ in the modern
        formulas above. The given velocity components in k are w<sub>ξ</sub> and w<sub>η</sub>.
        We call the resulting components in K U<sub>x</sub> and U<sub>y</sub>; the paper’s U is
        their combined speed.
      </p>
      <details className="step-local-steps">
        <summary>The same path, two clocks, and the allowed divisions</summary>
        <p>
          The frames are inertial, their origins coincide at time zero, and k moves with signed
          velocity v along K’s x axis. The axes use the same normalization and orientation. The
          point starts at their common origin and moves uniformly in k.
        </p>
        <section
          className="step-math"
          aria-label={expressionToSpokenText(motion)}
          dangerouslySetInnerHTML={{ __html: renderExpressionMarkup(motion).html }}
        />
        <p>
          Require V &gt; 0, |v| &lt; V, and a point speed at most V. Since its longitudinal
          component cannot exceed that speed, |v w<sub>ξ</sub>/V²| &lt; 1 and the denominator
          1 + v w<sub>ξ</sub>/V² is positive. The Lorentz factor is positive as well.
        </p>
        <p>
          Use a nonzero elapsed time when dividing displacement by time. At the common origin both
          are zero; evaluating 0/0 there does not define a velocity. Uniform motion gives the
          same ratio at every other admitted time.
        </p>
        <p>
          The coordinate map and its domain are premises. The checks below establish the stated
          algebra conditional on them; they do not supply an experiment testing those premises.
        </p>
      </details>
      <h5>Along the frame motion</h5>
      <DerivationChain
        chains={[longitudinal]}
        activeDetail={activeDetail}
        perspective={perspective}
        sourceLinkLabel="Return to the source relation"
      />
      <h5>Across the frame motion</h5>
      <p>
        The sideways coordinate is unchanged by the admitted §3 map. Its velocity still changes
        because K and k assign different times to the same displacement. This chain keeps that
        elapsed-time conversion visible.
      </p>
      <DerivationChain
        chains={[transverse]}
        activeDetail={activeDetail}
        perspective={perspective}
        sourceLinkLabel="Return to the source relation"
      />
      <details className="step-local-steps">
        <summary>When does this become the familiar one-line addition rule?</summary>
        <p>
          Set w<sub>η</sub> to zero. Then U<sub>y</sub> is zero and the longitudinal formula gives
          the collinear motion. When both motions point along positive x, its result is also the
          paper’s positive speed U. If a signed component points in the opposite direction, the
          speed is its magnitude.
        </p>
        <p>
          With a sideways component, both transformed components are needed before finding the
          speed. A single boost describing one oblique path is also different from two successive
          boosts in different directions. The latter can rotate the axes and has a separate
          laboratory mode.
        </p>
      </details>
      <details className="step-local-steps">
        <summary>Why do the modern formulas above have minus signs?</summary>
        <p>
          They take a velocity given in K and ask for it in k. This derivation follows the paper
          in the other direction: the velocity is given in k and the result is expressed in K.
          Exchanging the given and resulting frame roles reverses the relative frame velocity.
          The denominator changes sign with it; the transverse Lorentz factor remains.
        </p>
      </details>
      <h5>Try the same compositions</h5>
      <p>
        The velocity laboratory takes the point’s velocity in k and calculates both components
        in K, matching the direction of these chains. Its inverse readout returns to the given
        motion.
      </p>
      <ul>
        <li>
          <a href="/lab/sr-06/?v=0.6&w=0.6&alpha=0&mode=collinear">
            Compose two velocities of 0.6c along the same line
          </a>
        </li>
        <li>
          <a href="/lab/sr-06/?v=0.6&w=0.6&alpha=90&mode=angled">
            Keep both speeds and turn the point’s motion sideways
          </a>
        </li>
        <li>
          <a href="/lab/sr-06/?v=0.6&w=1&alpha=90&mode=angled">
            Compare a transverse light ray between the same frames
          </a>
        </li>
      </ul>
      <p>
        The two chains establish the component transformations. The paper’s further speed bound,
        light-speed case and group-composition claims have their own arguments; this check does
        not silently certify all of them.
      </p>
      <details className="modern-margin" data-reading="3">
        <summary>Historical context and the scope of this reconstruction</summary>
        <p>{srVelocityHistoricalReading.r3}</p>
        <p className="fine"><cite>{srVelocityHistoricalReading.r3Citations[0]}</cite></p>
      </details>
      <h5>Return to the printed argument</h5>
      <ul>
        {srVelocitySourceLinks.map((source) => (
          <li key={source.id} id={source.id}>
            <a href={"/papers/special-relativity/view/german/#" + source.anchor}>
              {source.label}
            </a>
          </li>
        ))}
      </ul>
    </section>
  );
}
