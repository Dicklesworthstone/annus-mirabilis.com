"use client";

import { useState } from "react";
import type { Expression } from "../equations/ast.ts";
import { expressionToSpokenText } from "../equations/derivations/a11yText.ts";
import { DerivationChain } from "../equations/derivations/DerivationChain.tsx";
import { renderExpressionMarkup } from "../equations/derivations/mathRenderer.ts";
import {
  presentSRCoordinateChain,
  presentSRCoordinateExpression,
  type SRCoordinateNotation,
  type SRCoordinateStage,
  srCoordinateCrossRouteLinks,
  srCoordinateHistoricalReading,
  srCoordinateIntroductions,
  srCoordinateMetadata,
  srCoordinateModernStages,
  srCoordinateResults,
  srCoordinateSourceLinks,
  srCoordinateSourceStages,
} from "../equations/derivations/srCoordinates.ts";

export interface SRCoordinateDerivationProps {
  readonly activeDetail?: "0" | "1" | "2";
  readonly perspective?: "historical" | "modern";
  /** Optional controlled source-route notation; the modern route stays explicitly modern. */
  readonly notation?: SRCoordinateNotation;
}

function CoordinateMath({
  tree,
  notation,
}: {
  readonly tree: Expression;
  readonly notation: SRCoordinateNotation;
}) {
  const display = presentSRCoordinateExpression(tree, notation);
  return (
    <section
      className="step-math"
      aria-label={expressionToSpokenText(display)}
      {...{ dangerouslySetInnerHTML: { __html: renderExpressionMarkup(display).html } }}
    />
  );
}

function CoordinateStages({
  stages,
  notation,
  activeDetail,
  perspective,
}: {
  readonly stages: readonly SRCoordinateStage[];
  readonly notation: SRCoordinateNotation;
  readonly activeDetail: "0" | "1" | "2";
  readonly perspective: "historical" | "modern";
}) {
  return stages.map((stage, index) => (
    <details
      key={stage.chain.id}
      className="step-local-steps"
      open={index === 0}
      data-coordinate-stage={stage.chain.id}
    >
      <summary>{stage.title}</summary>
      <DerivationChain
        chains={[presentSRCoordinateChain(stage.chain, notation)]}
        activeDetail={activeDetail}
        perspective={perspective}
      />
    </details>
  ));
}

/** Both routes and every step exist in the initial HTML. Native details and fragment
 * links remain useful without hydration; the notation selector is an optional enhancement. */
export function SRCoordinateDerivation({
  activeDetail = "1",
  perspective = "historical",
  notation,
}: SRCoordinateDerivationProps) {
  const [selectedNotation, setSelectedNotation] = useState<SRCoordinateNotation>("source");
  const sourceNotation = notation ?? selectedNotation;
  return (
    <section
      id="sr-coordinate-derivation"
      className="local-steps"
      aria-labelledby="sr-coordinate-derivation-title"
      data-argument-id={srCoordinateMetadata.argument}
      data-review="draft"
      data-model-status={srCoordinateMetadata.modelStatus}
    >
      <h4 id="sr-coordinate-derivation-title">Build the coordinate transformation by two routes</h4>
      <p>
        The light conditions fix how space and time mix, but leave a scale to determine. Follow the
        source’s synchronization argument, or construct a linear map in modern notation. Both routes
        state their assumptions, keep the unknown scale visible, and derive the transverse equations
        separately.
      </p>
      <p className="fine">
        Authored draft explanations. The algebraic checks do not certify the physical premises or a
        historical review. These are routes through the argument, not accounts of Einstein’s private
        thought process.
      </p>
      <nav aria-label="Coordinate transformation routes">
        <ul>
          <li>
            <a href="#sr-coordinate-source-route">
              A route you could take: the source synchronization argument
            </a>
          </li>
          <li>
            <a href="#sr-coordinate-modern-route">
              A route you could take: a modern linear reconstruction
            </a>
          </li>
          <li>
            <a href="#sr-coordinate-route-comparison">
              Compare the same logical steps in both routes
            </a>
          </li>
        </ul>
      </nav>
      <details className="step-local-steps" open>
        <summary>The setup and the assumptions that do real work</summary>
        <p>
          Frame <i>k</i> moves at constant speed <i>v</i> along increasing <i>x</i> in frame{" "}
          <i>K</i>. Their parallel axes use identical rods and clocks, and their origins’ zero event
          is shared. The speed of light is positive and the frame is subluminal. Homogeneity of
          space and time motivates the linear map used here; it remains an explicit premise.
        </p>
        <p>
          Reciprocity uses the same construction on return with −<i>v</i>. Spatial isotropy compares
          reversed directions. Identically oriented axes, future-increasing clocks, and continuity
          from the identity at rest select the positive branch. These conditions have different
          jobs; the light-speed postulate alone does not fix every coefficient.
        </p>
      </details>

      <section
        id="sr-coordinate-source-route"
        aria-labelledby="sr-coordinate-source-route-title"
        data-historical-status="source-order-reconstruction"
        data-proof-route="route-sr-coordinate-source-synchronization"
      >
        <h5 id="sr-coordinate-source-route-title">
          A route you could take: the source synchronization argument
        </h5>
        <p>
          Follow the printed order: moving-clock synchronization, the light paths, the remaining
          scale, the spherical-wave check, and then the inverse and rod-symmetry argument. The
          source calls the moving coordinates ξ, η, ζ, τ, the light speed <i>V</i>, and the Lorentz
          factor β. Here β means the modern γ; it never means <i>v/c</i>.
        </p>
        {notation === undefined && (
          <label>
            Symbols in the source-route equations{" "}
            <select
              value={sourceNotation}
              onChange={(event) =>
                setSelectedNotation(event.currentTarget.value === "modern" ? "modern" : "source")
              }
              aria-label="Symbols in the source-route equations"
            >
              <option value="source">Source symbols: V, β, ξ, τ</option>
              <option value="modern">Modern symbols: c, γ, x′, t′</option>
            </select>
          </label>
        )}
        <p>
          <strong>Two different coordinates:</strong> the source’s <i>x′</i> is the auxiliary
          <i> x−vt</i>, not ξ. The modern display writes that auxiliary as <i>x̃</i> so it cannot be
          confused with the modern moving coordinate <i>x′</i>. In modern displays, capital
          <i> A</i> preserves the source’s early coefficient <i>a</i>, distinct from the modern
          ansatz coefficient in the second route. The reason text keeps the source’s symbols.
        </p>
        <CoordinateMath tree={srCoordinateIntroductions.auxiliary} notation={sourceNotation} />
        <CoordinateStages
          stages={srCoordinateSourceStages}
          notation={sourceNotation}
          activeDetail={activeDetail}
          perspective={perspective}
        />
        <details className="step-local-steps">
          <summary>Why the two appearances of the unknown scale need different bookkeeping</summary>
          <p>
            The early time function has coefficient <i>a</i>. Its longitudinal coefficient is
            <i> a</i>β² and its sideways coefficient is <i>a</i>β. Writing the later common scale as
            φ therefore means φ=<i>a</i>β, before it is set to one.
          </p>
          <CoordinateMath
            tree={srCoordinateIntroductions.scaleDefinition}
            notation={sourceNotation}
          />
          <p>
            The source prose calls the earlier <i>a</i> an unknown φ(<i>v</i>), then uses φ in the
            common-scale equations. This explanation makes the rescaling explicit while preserving
            the printed expressions. The existing notation concordance records agent comparisons of
            those passages; the historical review remains draft.
          </p>
        </details>
        <details className="step-local-steps">
          <summary>The source’s spherical wave is a consistency check</summary>
          <CoordinateMath
            tree={srCoordinateIntroductions.sphericalStationary}
            notation={sourceNotation}
          />
          <CoordinateMath
            tree={srCoordinateIntroductions.sphericalMoving}
            notation={sourceNotation}
          />
          <p>
            The constructed map takes the emitted light sphere in <i>K</i> to a light sphere in
            <i> k</i>. The detailed cancellation is in stage 5. It works before φ is fixed, so it
            cannot replace the normalization argument. A later spacetime-interval formulation is not
            a premise of this source route.
          </p>
        </details>
      </section>

      <section
        id="sr-coordinate-modern-route"
        aria-labelledby="sr-coordinate-modern-route-title"
        data-historical-status="pedagogical-reconstruction"
        data-proof-route="route-sr-coordinate-linear-reconstruction"
      >
        <h5 id="sr-coordinate-modern-route-title">
          A route you could take: a modern linear reconstruction
        </h5>
        <p>
          Begin with independent coefficients <i>a(v)</i>, <i>b(v)</i>, and <i>d(v)</i>. The moving
          origin gives the spatial combination <i>x−vt</i>; the common zero event removes constant
          offsets. Neither γ nor an unchanged sideways coordinate is built into this ansatz.
        </p>
        <CoordinateMath tree={srCoordinateIntroductions.positionAnsatz} notation="modern" />
        <CoordinateMath tree={srCoordinateIntroductions.timeAnsatz} notation="modern" />
        <p>
          The modern <i>a(v)</i> is a different function from the early source <i>a</i>: it equals
          φβ, or the early <i>a</i>β². A separate transverse coefficient,
          <i> a</i>
          <sub>⊥</sub>, remains free until the sideways light test.
        </p>
        <CoordinateMath tree={srCoordinateIntroductions.transverseAnsatzY} notation="modern" />
        <CoordinateMath tree={srCoordinateIntroductions.transverseAnsatzZ} notation="modern" />
        <CoordinateStages
          stages={srCoordinateModernStages}
          notation="modern"
          activeDetail={activeDetail}
          perspective={perspective}
        />
        <p>
          <a href="/lab/sr-04/">Build and test a candidate map in the Lorentz-map instrument</a>.
        </p>
      </section>

      <section
        id="sr-coordinate-route-comparison"
        aria-labelledby="sr-coordinate-route-comparison-title"
      >
        <h5 id="sr-coordinate-route-comparison-title">Compare the same logical steps</h5>
        <p>
          Each link goes directly to the corresponding authored step. Both routes remain in this
          page.
        </p>
        <table>
          <thead>
            <tr>
              <th scope="col">Question</th>
              <th scope="col">Source route</th>
              <th scope="col">Modern reconstruction</th>
            </tr>
          </thead>
          <tbody>
            {srCoordinateCrossRouteLinks.map((link) => (
              <tr key={link.label}>
                <th scope="row">{link.label}</th>
                <td>
                  <a href={`#${link.source}`}>Source step</a>
                </td>
                <td>
                  <a href={`#${link.modern}`}>Modern step</a>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <details className="step-local-steps">
        <summary>The common result, including the inverse</summary>
        {Object.entries(srCoordinateResults).map(([key, tree]) => (
          <CoordinateMath key={key} tree={tree} notation="modern" />
        ))}
        <p>
          The same event appears on both sides. A prime means coordinates assigned by the moving
          frame. The inverse changes the sign of the velocity mixing and uses the same positive γ.
          The numerical checks use the site’s existing kinematics evaluator.
        </p>
      </details>
      <details className="modern-margin" data-reading="3">
        <summary>Historical context and notation</summary>
        <p>{srCoordinateHistoricalReading.r3}</p>
        <p className="fine">
          <cite>{srCoordinateHistoricalReading.r3Citations[0]}</cite>
        </p>
      </details>
      <h5>Follow the printed argument</h5>
      <ul>
        {srCoordinateSourceLinks.map((link) => (
          <li key={link.id} id={link.id}>
            <a href={`/papers/special-relativity/view/german/#${link.anchor}`}>§3: {link.label}</a>
          </li>
        ))}
      </ul>
    </section>
  );
}
