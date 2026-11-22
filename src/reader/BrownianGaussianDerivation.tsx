import type { Expression } from "../equations/ast.ts";
import { expressionToSpokenText } from "../equations/derivations/a11yText.ts";
import {
  brownianGaussianAssumptions,
  brownianGaussianCheckRows,
  brownianGaussianDisplay,
  brownianGaussianEquations,
} from "../equations/derivations/brownianGaussian.ts";
import type { BrownianGaussianReport } from "../equations/derivations/brownianGaussianProof.ts";
import { renderExpressionMarkup } from "../equations/derivations/mathRenderer.ts";

function Formula({ expression }: { readonly expression: Expression }) {
  const display = brownianGaussianDisplay(expression);
  const rendered = renderExpressionMarkup(display);
  return (
    <section
      className="step-math"
      aria-label={expressionToSpokenText(display)}
      // biome-ignore lint/security/noDangerouslySetInnerHtml: authored AST rendered by KaTeX with trust false.
      dangerouslySetInnerHTML={{ __html: rendered.html }}
    />
  );
}

/** Native disclosures keep the complete reasoning and mathematical premises readable without JS. */
export function BrownianGaussianDerivation({
  report,
}: {
  readonly report?: BrownianGaussianReport | undefined;
}) {
  const equations = brownianGaussianEquations();
  const failed = report?.rows.filter((row) => !row.passed) ?? [];
  return (
    <section
      id="bm-gaussian-derivation"
      className="local-steps"
      aria-labelledby="bm-gaussian-derivation-title"
      data-argument-id="arg-bm-gaussian"
      data-gaussian-proof={report?.passed ? "checked" : "unavailable"}
    >
      <h5 id="bm-gaussian-derivation-title">From the Gaussian density to a measurable spread</h5>
      <p>
        The diffusion equation describes how a density changes. To predict a distance, choose its
        solution for particles that all start at the same point, normalize it, then average the
        squared displacement. This fills in the calculation between the two formulas at the end of
        §4.
      </p>
      <p>
        Here <i>p</i> is a probability density along one coordinate: <i>p</i> times a small interval
        of position gives a probability. Einstein prints <i>f</i> = <i>np</i>, the corresponding
        number density for a fixed positive count <i>n</i> of particles. Dividing by that same count
        before averaging leaves the normalized calculation below. Time <i>t</i> means the elapsed
        interval since their common point start.
      </p>

      <details className="step-local-steps" open>
        <summary>The assumptions used in this calculation</summary>
        <dl>
          {brownianGaussianAssumptions.map((assumption) => (
            <div key={assumption.id}>
              <dt id={assumption.id}>{assumption.label}</dt>
              <dd>{assumption.explanation}</dd>
            </div>
          ))}
        </dl>
        <p>
          The Gaussian area and tail properties are mathematical inputs. The diffusion equation and
          its application to a suspension are physical model assumptions discussed separately; this
          calculation checks a candidate solution and its moments.
        </p>
      </details>

      <ol className="derivation-steps-list">
        <li id="bm-gaussian-scaled-coordinate">
          <h6>1. Separate the changing length scale from the shape</h6>
          <Formula expression={equations.coordinate} />
          <Formula expression={equations.density} />
          <p>
            The scale √(4<i>Dt</i>) has units of length, so <i>u</i> has no units. Changing the
            elapsed time stretches the density horizontally and changes its height by the reciprocal
            factor. The area can stay one while the peak falls.
          </p>
          <a href="/foundations/gaussian-distributions/">Review the Gaussian shape and its scale</a>
        </li>
        <li id="bm-gaussian-diffusion-check">
          <details className="step-local-steps">
            <summary>2. Check this same density in the diffusion equation</summary>
            <p>
              Differentiate the shape with respect to <i>u</i>. The second derivative needs both the
              derivative of −2<i>u</i> and the derivative of the exponential.
            </p>
            <Formula expression={equations.firstDerivative} />
            <Formula expression={equations.secondDerivative} />
            <p>
              At fixed position, ∂<i>u</i>/∂<i>t</i> = −<i>u</i>/(2<i>t</i>); the reciprocal width
              also contributes −1/(2<i>t</i>). At fixed time, each position derivative contributes
              1/√(4<i>Dt</i>). Divide by the positive density to compare the two sides.
            </p>
            <Formula expression={equations.timeRatio} />
            <Formula expression={equations.diffusionRatio} />
            <p>
              Both expressions are (2<i>u</i>² − 1)/(2<i>t</i>). Thus the candidate satisfies ∂
              <i>p</i>/∂<i>t</i> = <i>D</i> ∂²<i>p</i>/∂<i>x</i>² for positive time. No
              approximation is taken in this substitution. The earlier passage explains the
              assumptions needed to obtain the diffusion equation itself.
            </p>
            <a href="/foundations/partial-derivatives/">
              Review what is held fixed in a partial derivative
            </a>
          </details>
        </li>
        <li id="bm-gaussian-normalization">
          <h6>3. Check the area and the signed mean</h6>
          <p>
            At fixed time, d<i>x</i> = √(4<i>Dt</i>) d<i>u</i>. That factor cancels the width in the
            denominator of <i>p</i>. The remaining area uses the standard Gaussian integral:
          </p>
          <Formula expression={equations.normalization} />
          <Formula expression={equations.normalizationCancellation} />
          <p>
            The total probability is one. For the signed mean, the extra factor <i>x</i> changes
            sign when <i>u</i> changes sign, while the Gaussian does not. Opposite contributions
            cancel over the full line, so the mean displacement is zero. The particles can still
            spread.
          </p>
          <a href="/foundations/integration/">Review an integral as an accumulated amount</a>
        </li>
        <li id="bm-gaussian-second-moment" data-is-move="true">
          <h6>4. The move: integrate a derivative whose end values vanish</h6>
          <p>
            Squaring the displacement keeps contributions from both directions. The change of
            variable replaces <i>x</i>² with 4<i>Dt u</i>². To find the remaining Gaussian integral,
            differentiate <i>u</i> exp(−<i>u</i>²):
          </p>
          <Formula expression={equations.parts} />
          <p>
            Integrate over the whole line. The difference of the end values is zero. The right side
            is the Gaussian area minus twice its second moment. Therefore the second moment of the
            unnormalized shape is half its area:
          </p>
          <Formula expression={equations.unitSecondMoment} />
          <Formula expression={equations.moment} />
          <p>
            All units sit in 4<i>Dt</i>; the remaining integral is a pure number. The factor one
            half produces 2<i>Dt</i>, rather than 4<i>Dt</i>. This is one coordinate’s mean square.
          </p>
          <a href="/foundations/integration/">Follow the integration-by-parts tool</a>
        </li>
        <li id="bm-gaussian-rms">
          <h6>5. Return from squared length to a distance</h6>
          <Formula expression={equations.rms} />
          <p>
            RMS means the nonnegative square root after averaging the squares. At fixed diffusivity,
            four times the observation interval gives twice the RMS displacement. It does not
            specify the distance travelled along an individual winding path.
          </p>
          <p>
            In this zero-drift model the mean square equals the variance. If the centre drifts, the
            raw mean square also includes the square of that mean displacement. A radial distance in
            three dimensions is another quantity again.
          </p>
          <a href="/foundations/mean-variance-rms/">Keep mean, variance and RMS distinct</a>
        </li>
      </ol>

      <details className="step-local-steps">
        <summary>What happens at the point start?</summary>
        <p>
          The displayed density requires <i>t</i> &gt; 0. As <i>t</i> approaches zero, its area
          stays one and its mean square approaches zero. For any fixed distance from the start, the
          probability outside that distance is bounded by the mean square divided by the distance
          squared, and therefore tends to zero. That is convergence to a point distribution, not an
          ordinary finite density at <i>t</i> = 0. This limiting argument uses the nonnegative
          normalized density and its second moment; it is not an additional conclusion of the
          positive-time derivative check.
        </p>
        <a href="/lab/bm-06/">Compare the point start with positive-time spreading</a>
      </details>

      {report?.passed ? (
        <details className="step-local-steps">
          <summary>What the exact calculation checks</summary>
          <p>
            The displayed polynomial derivatives, diffusion substitution, normalization
            cancellation, integration-by-parts coefficients and canonical mean-square and RMS
            equations agree exactly. The Gaussian area and tail properties remain the explicit
            mathematical inputs above. This does not prove uniqueness of the diffusion solution or
            validate a microscopic model of the liquid.
          </p>
          <ul>
            {brownianGaussianCheckRows.map((row) => (
              <li key={row.id}>{row.label}</li>
            ))}
          </ul>
        </details>
      ) : (
        <details className="step-local-steps">
          <summary>Why the exact Gaussian check is unavailable</summary>
          <p>
            The authored steps remain readable, but this page does not claim a checked Gaussian
            calculation.
          </p>
          {report?.reason && <p>{report.reason}</p>}
          {failed.length > 0 && (
            <ul>
              {failed.map((row) => (
                <li key={row.id} data-gaussian-check-failure={row.id}>
                  {brownianGaussianCheckRows.find((entry) => entry.id === row.id)?.label ?? row.id}
                </li>
              ))}
            </ul>
          )}
        </details>
      )}
      <p>
        <a href="/papers/brownian-motion/view/german/#eq-s4-d11">
          Read the printed density, §4, p. 558
        </a>
        {" · "}
        <a href="/papers/brownian-motion/view/german/#eq-s4-d12">Read the printed RMS relation</a>
        {" · "}
        <a href="/lab/bm-06/">Explore the spreading density</a>
      </p>
    </section>
  );
}
