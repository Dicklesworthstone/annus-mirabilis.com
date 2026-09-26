import "./inference.css";
import type { Metadata } from "next";
import { InferenceComparison } from "../../../components/lab/InferenceLab.tsx";
import { LabFormula } from "../../../components/lab/LabFormula.tsx";
import { validateBm07Parameters } from "../../../experiments/bm07/parameters.ts";
import example from "../../../generated/bm07-example.json";
export const metadata: Metadata = {
  title: "From wandering to molecular-number inference",
  description:
    "What can a finite set of displacements tell you about the hidden parameters of the equation that predicts their spread, and what must you know independently?",
};
export default function InferencePage() {
  const checked = validateBm07Parameters(example.parameters);
  if (checked.kind !== "accepted") throw new Error("The prepared inference settings are invalid.");
  return (
    <>
      <header className="page-intro">
        <p className="eyebrow">Brownian motion · Learning from a finite sample</p>
        <h1>
          <span>From wandering</span> <span>to a number.</span>
        </h1>
        <p className="lead">
          An equation predicts how particles spread. Turn the question around: what can a finite set
          of displacements tell you about its hidden parameters, and what must you know
          independently?
        </p>
      </header>
      <InferenceComparison example={{ ...example, parameters: checked.data }} />
      <nav className="lab-onward" aria-label="From here">
        <h2>From here</h2>
        <ul>
          <li>
            <a href="/papers/brownian-motion/#arg-bm-inference">Read the inference argument</a>
          </li>
          <li>
            <a href="/lab/brownian-data/">Bring your own calibrated trajectory CSV</a>
          </li>
        </ul>
      </nav>
      <section className="reading" id="inference-argument">
        <p className="eyebrow">Open the inverse argument</p>
        <h2>The same positions, different questions</h2>
        <p>
          For independent, equally spaced Gaussian increments in d coordinates with known zero
          drift, average their squared lengths and divide by twice the number of coordinates and the
          time interval. The result estimates the diffusion coefficient.
        </p>
        <LabFormula
          lab="bm-07"
          latex={String.raw`\begin{gathered}\widehat D=\frac{1}{2dM\Delta t}\sum_{i=1}^{M}\lVert\Delta\mathbf r_i\rVert^2, \\ q=dM\end{gathered}`}
        />
        <p>
          When drift is fitted from the same observations, subtract the mean increment in each
          coordinate. The unbiased spread estimate uses M − 1 in place of M and q = d(M − 1). The
          centered maximum-likelihood estimate instead divides by M and must be rescaled before
          applying the same interval procedure.
        </p>
        <h2>An interval for a procedure</h2>
        <p>
          Under this ideal model, q times the unbiased diffusion estimate divided by the true
          diffusivity follows a chi-square distribution. Its quantiles provide the following
          conditional interval. More independent observations generally tighten uncertainty;
          changing the assumptions changes what the interval means.
        </p>
        <LabFormula
          lab="bm-07"
          latex={String.raw`\left[\frac{q\widehat D_{\mathrm{unbiased}}}{\chi^2_{q,1-\alpha/2}},\ \frac{q\widehat D_{\mathrm{unbiased}}}{\chi^2_{q,\alpha/2}}\right]`}
        />
        <p>
          At 95% coverage, the procedure covers the fixed true value in 95% of repetitions under its
          assumptions. That is not a 95% posterior probability for one parameter in one realized
          interval. The repeated-trial plots retain the misses as well as the successes.
        </p>
        <h2>Why an independent radius matters</h2>
        <LabFormula
          lab="bm-07"
          latex={String.raw`N a=\frac{RT}{6\pi\eta D},\qquad \widehat N=\frac{RT}{6\pi\eta a\widehat D}`}
        />
        <p>
          With temperature and viscosity given, displacements identify the product Na. They cannot
          separately identify N and the radius a. Declaring a radius permits a conditional
          inversion, but deriving that radius from the same data using an assumed N would merely
          return the assumption.
        </p>
        <p>
          Inversion also reverses the interval’s endpoints. It does not preserve unbiasedness: for
          the known-zero-drift estimate, the mean recovered-to-true number ratio is q/(q − 2) when q
          is greater than two. A point estimate can be finite even when that repeated-estimate mean
          does not exist.
        </p>
        <h2>Do not hide input uncertainty</h2>
        <p>
          The conditional interval treats the stated inputs as exact. The combined procedure uses
          the declared temperature, viscosity and radius intervals and adds their error
          probabilities with the diffusion interval’s error probability. This union-bound guarantee
          is conservative and does not require their statistical independence. It remains
          conditional on exact calibration, timing and the chosen gas constant in this preview.
        </p>
        <h2>Worked interval (readable without JavaScript)</h2>
        <table className="inference-summary">
          <caption>
            d = 2, M = 50, q = 100, D̂ = 0.42944 μm²/s, 95% chi-square interval. Not a molecular
            count.
          </caption>
          <thead>
            <tr>
              <th scope="col">Quantity</th>
              <th scope="col">Value</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <th scope="row">Diffusion interval</th>
              <td>[0.331457, 0.578589] μm²/s</td>
            </tr>
            <tr>
              <th scope="row">Modern-SI inversion (consistency check)</th>
              <td>N̂ = 6.02213 × 10²³ mol⁻¹</td>
            </tr>
            <tr>
              <th scope="row">Inverse-bias factor at q = 100</th>
              <td>q/(q − 2) = 1.020408; an unbiased D̂ is not unbiased after inversion</td>
            </tr>
          </tbody>
        </table>
        <h2>A synthetic recovery is not a new molecular count</h2>
        <p>
          This exercise draws a hidden number and generates data from it using a chosen gas
          constant. Recovering that number tests inference under the model; it does not measure a
          real suspension. With modern SI constants, the Avogadro constant is defined, so an
          observational inversion would be a consistency check rather than an independent
          determination. Historical observations and independent gas-constant measurements are not
          supplied here. This instrument uses ideal positions; the separate camera laboratory adds
          an explicitly later measurement model.
        </p>
        <p>
          <a href="https://www.itl.nist.gov/div898/handbook/eda/section3/eda358.htm">
            NIST: chi-square confidence limits for a normal variance
          </a>{" "}
          ·{" "}
          <a href="https://www.bipm.org/en/measurement-units">
            BIPM: SI units and defining constants
          </a>
        </p>
        <p>
          <a href="/lab/bm-08/">
            Next: keep the particle, change the camera, and test the inference
          </a>
        </p>
        <div className="actions">
          <a className="button" href="/lab/bm-01/">
            Return to the tracer ensemble
          </a>
          <a href="/lab/bm-06/">Compare with the predicted spread</a>
        </div>
      </section>
    </>
  );
}
