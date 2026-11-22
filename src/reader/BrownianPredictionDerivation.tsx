import type { Expression } from "../equations/ast.ts";
import { expressionToSpokenText } from "../equations/derivations/a11yText.ts";
import {
  brownianPredictionAssumptions,
  brownianPredictionCheckRows,
  brownianPredictionDisplay,
  brownianPredictionEquations,
} from "../equations/derivations/brownianPrediction.ts";
import type { BrownianPredictionReport } from "../equations/derivations/brownianPredictionProof.ts";
import { renderExpressionMarkup } from "../equations/derivations/mathRenderer.ts";

const steps = brownianPredictionEquations();

function Formula({
  expression,
  notation = "modern",
}: {
  readonly expression: Expression;
  readonly notation?: "modern" | "printed";
}) {
  const display = brownianPredictionDisplay(expression, notation);
  const rendered = renderExpressionMarkup(display);
  return (
    <section
      className="step-math"
      aria-label={expressionToSpokenText(display)}
      // biome-ignore lint/security/noDangerouslySetInnerHtml: Authored AST rendered by KaTeX with trust false.
      dangerouslySetInnerHTML={{ __html: rendered.html }}
    />
  );
}

/** Static reading path. Exact work and the established numerical owner run outside this component. */
export function BrownianPredictionDerivation({
  report,
}: {
  readonly report?: BrownianPredictionReport | undefined;
}) {
  const checked = report?.passed === true;
  const reconstruction = report?.reconstruction;
  return (
    <section
      id="bm-prediction-derivation"
      className="local-steps"
      data-argument-id="arg-bm-inference"
      data-prediction-proof={checked ? "checked" : "unavailable"}
      aria-labelledby="bm-prediction-title"
    >
      <h4 id="bm-prediction-title">From a diffusion coefficient to a visible displacement</h4>
      <p>
        Section 5 joins two earlier results: the liquid and particle determine a diffusion
        coefficient, and that coefficient determines the spread of one coordinate after an
        observation interval. Follow the substitution to see where the time, viscosity and particle
        size enter the prediction.
      </p>
      <p>
        <a href="/papers/brownian-motion/s5/#eq-s5-d1">Printed diffusivity</a>
        {" · "}
        <a href="/papers/brownian-motion/s5/#eq-s5-d2">Printed RMS law</a>
        {" · "}
        <a href="/papers/brownian-motion/s5/#eq-s5-d3">Printed combined formula</a>
      </p>

      <details open>
        <summary>What this argument assumes</summary>
        <ul>
          {brownianPredictionAssumptions.map((assumption) => (
            <li key={assumption.id}>
              <strong>{assumption.label}.</strong> {assumption.explanation}
            </li>
          ))}
        </ul>
      </details>

      <ol>
        <li>
          <h5>Keep both earlier laws and their quantities</h5>
          <Formula expression={steps.diffusivity} />
          <Formula expression={steps.rms} />
          <p>
            The first law supplies D from temperature, viscosity and particle radius. The second law
            gives the root mean square of a signed displacement along one axis. It describes a
            spread of positions, not the distance a particle travels along its irregular path or an
            instantaneous speed.
          </p>
          <p>
            Here N is a supplied molecular number. Inferring N from measured spreading is the
            inverse question later in this section. The two questions retain distinct quantity
            identities.
          </p>
          <a href="/papers/brownian-motion/s4/#bm-gaussian-derivation">
            Revisit the Gaussian moment and its nonnegative RMS
          </a>
        </li>
        <li>
          <h5>Replace the same D inside the RMS root</h5>
          <Formula expression={steps.substituted} />
          <p>
            This substitution carries the same temperature, viscosity, radius and input N into the
            displacement law. No new value of D is fitted at this step.
          </p>
        </li>
        <li>
          <h5>Collect the factor two with the six in Stokes drag</h5>
          <Formula expression={steps.collected} />
          <p>
            Two divided by six is one third. The cancellation happens inside the square root; it
            does not halve the displacement. The combined radicand has dimensions of length squared.
          </p>
        </li>
        <li>
          <h5>Separate the nonnegative time and material factors</h5>
          <Formula expression={steps.prediction} />
          <p>
            The material factor is positive and t is nonnegative, so the nonnegative square root of
            their product equals the product of their nonnegative roots. With all other inputs
            fixed, four times the observation interval gives twice the RMS displacement. The
            Gaussian density requires t greater than zero; zero RMS at t = 0 is its continuous
            limit.
          </p>
          <details>
            <summary>Read the same quantities in Einstein’s notation</summary>
            <Formula expression={steps.prediction} notation="printed" />
            <p>
              The paper writes k for dynamic viscosity and P for particle radius. This change of
              letters preserves the quantities. It does not convert their units; in particular, k
              here is not Boltzmann’s constant.
            </p>
          </details>
        </li>
      </ol>

      <details open>
        <summary>Radius, diameter and a consistent unit system</summary>
        <p>
          The <a href="/papers/brownian-motion/s5/#s5-p2-s1">printed example</a> gives a particle{" "}
          <strong>diameter</strong> of 0.001 millimetre, a water temperature of 17 degrees Celsius,
          a viscosity of 0.0135 poise and an input N of 6 × 10²³ per mole. The equation needs the
          radius and absolute temperature.
        </p>
        <table>
          <caption>Inputs to the declared historical reconstruction</caption>
          <thead>
            <tr>
              <th scope="col">Quantity</th>
              <th scope="col">Centimetre-gram-second reading</th>
              <th scope="col">SI input</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <th scope="row">Particle size</th>
              <td>Diameter 0.0001 cm; radius 0.00005 cm</td>
              <td>Diameter 1 micrometre; radius 0.5 micrometre = 5 × 10⁻⁷ m</td>
            </tr>
            <tr>
              <th scope="row">Dynamic viscosity</th>
              <td>0.0135 poise</td>
              <td>0.00135 Pa s; one poise is 0.1 Pa s</td>
            </tr>
            <tr>
              <th scope="row">Absolute temperature</th>
              <td>17 degrees Celsius converted to absolute temperature</td>
              <td>290.15 K, using the modern Celsius-to-kelvin conversion</td>
            </tr>
            <tr>
              <th scope="row">Molar gas constant R</th>
              <td>8.31 × 10⁷ erg per mole per kelvin</td>
              <td>8.31 J per mole per kelvin; an editorial numerical input</td>
            </tr>
            <tr>
              <th scope="row">Input molecular number N</th>
              <td>6 × 10²³ per mole</td>
              <td>The same 6 × 10²³ per mole; no estimate is fitted here</td>
            </tr>
          </tbody>
        </table>
        <p>
          The paper does not print a numerical value for R in this example. The reconstruction
          declares that input explicitly. Using CGS inputs throughout gives D in square centimetres
          per second and displacement in centimetres; using SI inputs throughout gives square metres
          per second and metres.
        </p>
        <p>
          The coefficient conversion is consistent: one erg contributes a factor of 10⁻⁷, one poise
          contributes 10⁻¹, and one centimetre contributes 10⁻². Their ratio gives 10⁻⁴ for the
          squared-length factor, and its square root gives 10⁻² for length.
        </p>
        <p>
          Treating the printed diameter as the radius would double a, halve D and reduce the
          predicted RMS by a factor of the square root of two. Converting a diameter’s units does
          not perform the separate division by two.
        </p>
      </details>

      <details open>
        <summary>What the declared inputs predict numerically</summary>
        {reconstruction?.status === "value" ? (
          <table data-constant-set={reconstruction.constantSetId}>
            <caption>
              Reconstructed values from the shared printed-displacement calculation; these are model
              predictions, not measured displacements
            </caption>
            <thead>
              <tr>
                <th scope="col">Observation interval</th>
                <th scope="col">D (m²/s)</th>
                <th scope="col">One-coordinate RMS (micrometres)</th>
              </tr>
            </thead>
            <tbody>
              {reconstruction.rows.map((row) => (
                <tr key={row.elapsedSeconds}>
                  <th scope="row">{row.elapsedSeconds} seconds</th>
                  <td>{row.diffusionCoefficientM2PerS.toPrecision(6)}</td>
                  <td>{row.rmsMicrometres.toPrecision(6)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <p>
            The numerical reconstruction is unavailable in this render.
            {reconstruction?.status === "unavailable" ? ` ${reconstruction.reason}` : ""} The
            authored substitution and unit setup remain readable above.
          </p>
        )}
        <p>
          The source reports{" "}
          <a href="/papers/brownian-motion/s5/#eq-s5-d4">0.8 micrometre for one second</a> and{" "}
          <a href="/papers/brownian-motion/s5/#s5-p2-s3">about 6 micrometres for one minute</a>.
          Those are the paper’s approximate predictions. The exact algebra check below does not
          certify their historical rounding or the draft transcription.
        </p>
        <a href="/lab/bm-01/">Explore how temperature, viscosity and radius change diffusion</a>
      </details>

      <details>
        <summary>
          {checked ? "The conditional algebra checks pass" : "Exact check unavailable"}
        </summary>
        <p>
          The checks join the two admitted equations, preserve the canonical quantities, choose the
          nonnegative roots and verify the unit scale. They do not establish the physical premises
          or compare the prediction with an observed trajectory. Floating numerical values above are
          a separate reconstruction.
        </p>
        {report ? (
          <ul>
            {brownianPredictionCheckRows.map((check) => {
              const result = report.rows.find((row) => row.id === check.id);
              return (
                <li key={check.id}>
                  {check.label}: {result?.passed ? "passed" : "unavailable or refused"}
                </li>
              );
            })}
          </ul>
        ) : null}
        {report?.reason ? <p>{report.reason}</p> : null}
      </details>
    </section>
  );
}
