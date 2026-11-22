import type { Expression } from "../equations/ast.ts";
import { expressionToSpokenText } from "../equations/derivations/a11yText.ts";
import {
  brownianKernelAssumptions,
  brownianKernelCheckRows,
  brownianKernelDisplay,
  brownianKernelInput,
} from "../equations/derivations/brownianKernel.ts";
import type { BrownianKernelReport } from "../equations/derivations/brownianKernelProof.ts";
import { renderExpressionMarkup } from "../equations/derivations/mathRenderer.ts";

function Formula({ expression }: { readonly expression: Expression }) {
  const display = brownianKernelDisplay(expression);
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

/** The server supplies the report. All mathematical reasoning stays readable without JavaScript. */
export function BrownianKernelCheck({
  report,
}: {
  readonly report?: BrownianKernelReport | undefined;
}) {
  const failed = report?.rows.filter((row) => !row.passed) ?? [];
  return (
    <section
      id="bm-kernel-checked-calculus"
      className="local-steps"
      aria-labelledby="bm-kernel-checked-calculus-title"
      data-kernel-calculus={report?.passed ? "checked" : "unavailable"}
    >
      <h5 id="bm-kernel-checked-calculus-title">From finite steps to the diffusion equation</h5>
      <p>
        The calculation above keeps a density, a slope and a curvature. Its coefficients can be
        checked exactly. Passing from that finite-step calculation to a differential equation also
        requires control of the discarded terms. These are separate parts of the argument.
      </p>
      <p>
        The printed recurrence uses the density at <i>x</i> + Δ. The modern arrival-from-origin
        convention uses <i>x</i> − Δ. Reversing the integration variable gives the same recurrence
        for a symmetric law. With a biased law the first-derivative term survives, and its sign must
        follow the chosen definition of the displacement.
      </p>

      <details className="step-local-steps">
        <summary>Which premises make this passage possible?</summary>
        <dl>
          {brownianKernelAssumptions.map((assumption) => (
            <div key={assumption.id}>
              <dt id={assumption.id}>{assumption.label}</dt>
              <dd>{assumption.explanation}</dd>
            </div>
          ))}
        </dl>
      </details>

      <ol className="derivation-steps-list">
        <li id="bm-kernel-check-coefficient">
          <h6>1. Keep normalization, symmetry and scale separate</h6>
          <p>
            Normalization fixes the zeroth moment at one, so the current density cancels. Symmetry
            sets the signed first moment to zero, removing drift. Neither condition fixes the second
            moment. The factor one half comes from the second spatial Taylor derivative, and
            dividing by the positive interval turns that moment into a rate:
          </p>
          <Formula expression={brownianKernelInput.jumpMoment} />
          <p>
            The law and its interval belong together. A homogeneous stationary law gives the same
            coefficient throughout space and time. No division by the second moment or by
            <i> D</i> occurs, so a zero-spread degenerate law is not excluded by this algebra.
          </p>
          <p>
            <a href="/foundations/taylor-expansion/">Review the Taylor coefficient</a>
            {" · "}
            <a href="/papers/brownian-motion/view/german/#eq-s4-d9">
              Read Einstein’s definition of D
            </a>
          </p>
        </li>
        <li id="bm-kernel-check-remainders" data-is-move="true">
          <h6>2. The move: keep enough terms to control the error</h6>
          <p>
            For the time expansion, retain the first derivative and bound the remainder using a
            uniform bound on the second time derivative. After division by the interval, that bound
            is multiplied by:
          </p>
          <Formula expression={brownianKernelInput.timeErrorCoefficient} />
          <p>
            For space, first expand through the cubic term about the same point <i>x</i>. The cubic
            term has a fixed third derivative multiplying Δ³, so symmetry cancels its average. Bound
            what remains using a uniform bound on the fourth spatial derivative. After averaging and
            dividing by the interval, its coefficient is:
          </p>
          <Formula expression={brownianKernelInput.spaceErrorCoefficient} />
          <p>
            A third-order Taylor remainder evaluated at an intermediate position depends on the
            displacement. Symmetry alone cannot cancel that remainder. Expanding one term further
            gives the fourth-moment bound above.
          </p>
          <details className="step-local-steps">
            <summary>See the exact finite-interval remainder identity</summary>
            <p>
              In the numerator below, the integral contains the full spatial remainder after
              subtracting the cubic Taylor polynomial. The final parenthesis is the full time
              remainder after subtracting its first-order polynomial. Their difference divided by τ
              equals the residual of the proposed diffusion equation. No remainder has been set to
              zero in this identity.
            </p>
            <Formula expression={brownianKernelInput.finiteResidual} />
          </details>
          <a href="/papers/brownian-motion/view/german/#eq-s4-d6">
            Return to the printed spatial expansion
          </a>
        </li>
        <li id="bm-kernel-check-limit">
          <h6>3. State what must converge</h6>
          <p>
            Consider a mathematical family with τ approaching zero. Keep the second moment divided
            by 2τ tending to a finite <i>D</i>, and require the fourth moment divided by τ to tend
            to zero. With the stated uniform derivative bounds, both error contributions then
            vanish.
          </p>
          <p>
            The density, its time derivative and its second spatial derivative must also converge to
            the fields in the limiting equation. Under these convergence assumptions the retained
            relation becomes:
          </p>
          <Formula expression={brownianKernelInput.diffusion} />
          <p>
            At a finite interval the earlier approximation sign remains. The exact coefficient
            calculation does not establish existence or uniqueness of a limiting family. Applying
            the continuum model to a liquid still requires observation times above its relevant
            correlation time.
          </p>
          <a href="/foundations/diffusion-equation/">Review the continuum model and its scope</a>
        </li>
      </ol>

      <details className="step-local-steps">
        <summary>Why finite variance alone is insufficient</summary>
        <p>
          Two symmetric transition families can have the same second moment per interval and
          different higher-order behavior:
        </p>
        <table>
          <caption>What happens to the omitted spatial contribution?</caption>
          <thead>
            <tr>
              <th scope="col">Family of transition laws</th>
              <th scope="col">Second moment divided by the interval</th>
              <th scope="col">Fourth moment divided by the interval</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <th scope="row">Every interval has a symmetric jump whose length shrinks as √τ</th>
              <td>Can stay at the fixed value 2D</td>
              <td>Tends to zero with τ</td>
            </tr>
            <tr>
              <th scope="row">Most intervals stay put; rare jumps keep a fixed nonzero length</th>
              <td>Can stay at the same fixed value 2D</td>
              <td>Can stay positive</td>
            </tr>
          </tbody>
        </table>
        <p>
          For a concrete discrete transition law, fix <i>D</i> &gt; 0 and a length <i>L</i> &gt; 0.
          Give each of −<i>L</i> and +<i>L</i> probability <i>D</i>τ/<i>L</i>², and give zero
          displacement the remaining probability 1 − 2<i>D</i>τ/<i>L</i>². These are valid
          probabilities for 0 &lt; τ ≤ <i>L</i>²/(2<i>D</i>). The second moment is 2<i>D</i>τ, but
          the fourth moment divided by τ is 2<i>DL</i>² and does not shrink.
        </p>
        <p>
          This example uses probability masses at three points, so its recurrence is a sum rather
          than an integral against an ordinary density. It shows why a finite second moment does not
          by itself justify dropping higher jump terms. Heavy-tailed laws without a finite second
          moment fall outside the displayed definition of <i>D</i>
          altogether.
        </p>
        <a href="/lab/bm-05/">Compare step distributions in the laboratory</a>
      </details>

      {report?.passed ? (
        <details className="step-local-steps">
          <summary>What has an exact check, and what is assumed?</summary>
          <p>
            The source expressions, their retained polynomial coefficients, the moment cancellations
            and the finite-interval residual agree by exact algebra. The Taylor remainder theorem,
            the uniform bounds and convergence of the scaled family remain the explicit mathematical
            premises above. The last row identifies the equation conditional on those premises; it
            does not verify convergence of an arbitrary jump law or provide empirical evidence for
            the molecular model.
          </p>
          <ul>
            {brownianKernelCheckRows.map((row) => (
              <li key={row.id}>{row.label}</li>
            ))}
          </ul>
        </details>
      ) : (
        <details className="step-local-steps">
          <summary>Why the exact coefficient check is unavailable</summary>
          <p>The source calculation and its assumptions remain readable without a checked claim.</p>
          {report?.reason && <p>{report.reason}</p>}
          {failed.length > 0 && (
            <ul>
              {failed.map((row) => (
                <li key={row.id} data-kernel-check-failure={row.id}>
                  {brownianKernelCheckRows.find((entry) => entry.id === row.id)?.label ?? row.id}
                </li>
              ))}
            </ul>
          )}
        </details>
      )}
      <p>
        <a href="/papers/brownian-motion/view/german/#eq-s4-d4">Read the printed recurrence</a>
        {" · "}
        <a href="/papers/brownian-motion/view/german/#eq-s4-1">
          Read the printed diffusion equation
        </a>
        {" · "}
        <a href="#bm-gaussian-derivation">Continue to the Gaussian solution and measured spread</a>
      </p>
    </section>
  );
}
