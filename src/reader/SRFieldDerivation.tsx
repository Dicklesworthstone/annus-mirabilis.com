"use client";

import { type Expression, nodeId } from "../equations/ast.ts";
import { expressionToSpokenText } from "../equations/derivations/a11yText.ts";
import { DerivationChain } from "../equations/derivations/DerivationChain.tsx";
import { renderExpressionMarkup } from "../equations/derivations/mathRenderer.ts";
import {
  srFieldAnsatzEquations,
  srFieldComponentRows,
  srFieldCoordinateMap,
  srFieldGaussianEquations,
  srFieldHistoricalReading,
  srFieldMovingMaxwellRows,
  srFieldNormalizationDerivation,
  srFieldOperatorEquations,
  srFieldSIEquations,
  srFieldSourceDisplayChain,
  srFieldSourceDisplayExpression,
  srFieldTransformDerivations,
  srFieldTransformMetadata,
  srFieldVacuumConstraints,
} from "../equations/derivations/srFieldTransforms.ts";

export interface SRFieldDerivationProps {
  readonly activeDetail?: "0" | "1" | "2";
  readonly perspective?: "historical" | "modern";
}

function FieldEquation({
  expression,
  source = true,
}: {
  readonly expression: Expression;
  readonly source?: boolean;
}) {
  const displayed = source ? srFieldSourceDisplayExpression(expression) : expression;
  const { html } = renderExpressionMarkup(displayed);
  return (
    <section
      className="step-math"
      aria-label={expressionToSpokenText(displayed)}
      // biome-ignore lint/security/noDangerouslySetInnerHtml: authored AST rendered by KaTeX with trust false; no raw input is inserted.
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}

const componentDescriptions = {
  X: "Electric field along the motion",
  Y: "Electric field along y",
  Z: "Electric field along z",
  L: "Magnetic field along the motion",
  M: "Magnetic field along y",
  N: "Magnetic field along z",
} as const;
const sourceReturns = [
  ["sr-field-source-maxwell", "eq-s6-d1", "The six Maxwell–Hertz equations in K"],
  ["sr-field-source-change-variables", "s6-p2", "The change of variables using §3"],
  ["sr-field-source-grouped", "eq-s6-d2", "The six regrouped equations in k"],
  ["sr-field-source-identification", "eq-s6-d5", "The common field-scale factor"],
  ["sr-field-source-inverse", "eq-s6-d6", "The inverse transformation condition"],
  ["sr-field-source-symmetry", "s6-fn1", "The pure magnetic field symmetry example"],
  ["sr-field-source-normalized", "eq-s6-d9", "The six normalized transformations"],
] as const;

export function SRFieldDerivation({
  activeDetail = "1",
  perspective = "historical",
}: SRFieldDerivationProps) {
  return (
    <section
      id="sr-field-derivation"
      className="local-steps"
      aria-labelledby="sr-field-derivation-title"
      data-argument-id={srFieldTransformMetadata.argument}
      data-review={srFieldTransformMetadata.review}
      data-historical-status={srFieldTransformMetadata.historicalStatus}
      data-model-status={srFieldTransformMetadata.modelStatus}
    >
      <h4 id="sr-field-derivation-title">Follow the transformation of the fields</h4>
      <p>
        Follow §6 in its source order: change the derivatives, group the six field equations,
        identify the fields measured in the moving frame, then fix their common scale. This is a
        draft reconstruction of the argument and its intermediate algebra.
      </p>
      <p>
        The system k moves at constant velocity +v along the x axis of K, with |v| &lt; V.
        Einstein&apos;s V is the speed of light, and his β is the Lorentz factor, not the modern
        speed ratio v/c. His τ is coordinate time in k, not a particle&apos;s proper time.
      </p>
      <table>
        <caption>Original notation used in this derivation</caption>
        <thead>
          <tr>
            <th scope="col">In K</th>
            <th scope="col">In k</th>
            <th scope="col">Meaning</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <th scope="row">X, Y, Z</th>
            <td>X′, Y′, Z′</td>
            <td>Electric field components along x, y and z</td>
          </tr>
          <tr>
            <th scope="row">L, M, N</th>
            <td>L′, M′, N′</td>
            <td>Magnetic field components along x, y and z</td>
          </tr>
          <tr>
            <th scope="row">t; x, y, z</th>
            <td>τ; ξ, η, ζ</td>
            <td>Time and position coordinates of the same event</td>
          </tr>
        </tbody>
      </table>

      <section aria-labelledby="sr-field-coordinates-title">
        <h5 id="sr-field-coordinates-title">
          Start with the coordinate map already established in §3
        </h5>
        {srFieldCoordinateMap.map((expression) => (
          <FieldEquation key={nodeId(expression)} expression={expression} />
        ))}
        <p>
          Electric and magnetic components have matching units in this Gaussian convention. The
          factors v/V below are dimensionless. Modern SI fields use different relative units; their
          conversion is shown after the source argument.
        </p>
      </section>

      <section aria-labelledby="sr-field-operators-title">
        <h5 id="sr-field-operators-title">1. Change the derivative operators</h5>
        <p>
          Hold the other stationary coordinates fixed when differentiating with respect to t or x.
          Both τ and ξ change, so both terms of the chain rule matter.
        </p>
        {srFieldTransformDerivations.slice(0, 2).map((chain) => (
          <DerivationChain
            key={chain.id}
            chains={[srFieldSourceDisplayChain(chain)]}
            activeDetail={activeDetail}
            perspective={perspective}
          />
        ))}
        <p>The two remaining derivative operators follow directly from η = y and ζ = z.</p>
        {srFieldOperatorEquations.slice(2).map((expression) => (
          <FieldEquation key={nodeId(expression)} expression={expression} />
        ))}
      </section>

      <section aria-labelledby="sr-field-components-title">
        <h5 id="sr-field-components-title">2. Follow each Maxwell–Hertz component</h5>
        <p>
          The source prints six curl equations for empty space. To expose every assumption in the
          regrouping, also state the vacuum constraints: zero electric divergence in a charge-free
          region and zero magnetic divergence. The X and L rows use them.
        </p>
        {srFieldVacuumConstraints.map((expression) => (
          <FieldEquation key={nodeId(expression)} expression={expression} />
        ))}
        {srFieldComponentRows.map((row) => (
          <details key={row.component} data-field-component={row.component}>
            <summary>
              {row.component}: {componentDescriptions[row.component]}
            </summary>
            <DerivationChain
              chains={[srFieldSourceDisplayChain(row.chain)]}
              activeDetail={activeDetail}
              perspective={perspective}
            />
            <details>
              <summary>Check the complete derivative identity for this row</summary>
              <p>
                Subtract the right side of a field equation from its left side to form its residual.
                The expression below relates the regrouped residual in k to the original residual in
                K. It holds before setting the field equations to zero. For X and L the extra
                divergence term shows exactly where the vacuum constraint enters.
              </p>
              <FieldEquation expression={row.residualIdentity} />
            </details>
          </details>
        ))}
      </section>

      <section aria-labelledby="sr-field-identification-title">
        <h5 id="sr-field-identification-title">
          3. Identify the physical fields, then fix the common factor
        </h5>
        <p>
          The relativity principle requires the fields measured in k to obey the same Maxwell–Hertz
          form. Comparing corresponding functions motivates the local linear identification below,
          with one factor ψ(v) that depends on the frame speed and is independent of position and
          time.
        </p>
        <details>
          <summary>The equations obeyed by the primed fields in k</summary>
          {srFieldMovingMaxwellRows.map((expression) => (
            <FieldEquation key={nodeId(expression)} expression={expression} />
          ))}
        </details>
        {srFieldAnsatzEquations.map((expression) => (
          <FieldEquation key={nodeId(expression)} expression={expression} />
        ))}
        <p>
          Form invariance alone does not prove uniqueness. The physical identification of the same
          fields and the common-factor ansatz are additional premises. A mathematical map between
          solutions need not be the transformation between two observers&apos; measurements of the
          same field.
        </p>
        <p>
          Use ψ consistently for this §6 field scale, distinct from the coordinate scale φ
          considered in §3. Follow the parallel electric component through the forward and inverse
          boosts, then apply the source&apos;s symmetry example.
        </p>
        <DerivationChain
          chains={[srFieldSourceDisplayChain(srFieldNormalizationDerivation)]}
          activeDetail={activeDetail}
          perspective={perspective}
        />
        <h5>The six normalized Gaussian transformations</h5>
        {srFieldGaussianEquations.map((expression) => (
          <FieldEquation key={nodeId(expression)} expression={expression} />
        ))}
      </section>

      <details className="modern-margin" data-unit-system="si">
        <summary>Map the result to modern SI units</summary>
        <p>
          Set V = c and β = γ, but also convert the fields. Write a = √(4πε₀). The Gaussian
          components are (X, Y, Z) = a E in SI and (L, M, N) = ca B in SI; the corresponding charge
          conversion is q in Gaussian units = q in SI units divided by a. These are unit
          conversions, not just renamed letters.
        </p>
        <p>
          For example, insert Y = a E<sub>y</sub> and N = ca B<sub>z</sub> into Y′ = β(Y − vN/V),
          then divide by a. The result is E′<sub>y</sub> = γ(E<sub>y</sub> − vB<sub>z</sub>). For M′
          = β(M + vZ/V), divide by ca instead; the mixed term becomes vE<sub>z</sub>/c². Applying
          the same mapping to all six rows gives:
        </p>
        {srFieldSIEquations.map(({ id, tree }) => (
          <FieldEquation key={id} expression={tree} source={false} />
        ))}
        <p>
          A field tensor and electromagnetic invariants can independently check these results in
          modern notation. They are not premises of the source-order argument above.
        </p>
        <p>
          <a href="/lab/sr-02/">
            Compare the magnetic and electric descriptions in the laboratory.
          </a>
        </p>
      </details>

      <details className="modern-margin" data-reading="3">
        <summary>Historical context and scope</summary>
        <p>{srFieldHistoricalReading.r3}</p>
        {srFieldHistoricalReading.r3Citations.map((citation) => (
          <cite key={citation}>{citation}</cite>
        ))}
      </details>
      <nav aria-label="Return to the §6 source">
        <ul>
          {sourceReturns.map(([id, source, label]) => (
            <li id={id} key={id}>
              <a href={`/papers/special-relativity/view/german/#${source}`}>{label}</a>
            </li>
          ))}
          <li>
            <a href="/papers/special-relativity/view/german/#eq-s6-d4">
              The source&apos;s primed Maxwell–Hertz system
            </a>
          </li>
          <li>
            <a href="/papers/special-relativity/view/german/#eq-s6-d7">The evenness condition</a>
          </li>
          <li>
            <a href="/papers/special-relativity/view/german/#eq-s6-d8">The unit normalization</a>
          </li>
        </ul>
      </nav>
    </section>
  );
}
