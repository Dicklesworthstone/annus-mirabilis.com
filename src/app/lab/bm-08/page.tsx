import { NotModeledLine } from "../NotModeledLine.tsx";
import "./camera.css";
import type { Metadata } from "next";
import { Formula } from "../../../components/edition/Formula.tsx";
import { CameraComparison } from "../../../components/lab/CameraLab.tsx";
import { validateBm08Parameters } from "../../../experiments/bm08/parameters.ts";
import example from "../../../generated/bm08-example.json";
export const metadata: Metadata = {
  title: "The particle, the camera, and the estimate",
  description:
    "A camera averages motion during exposure and adds uncertainty to every position. See why those errors change what you can infer from the same path.",
};
export default function CameraPage() {
  const p = validateBm08Parameters(example.parameters);
  if (p.kind !== "accepted") throw new Error("Invalid prepared camera settings.");
  return (
    <>
      <header className="page-intro">
        <p className="eyebrow">Brownian motion · A later measurement model</p>
        <h1>
          <span>The particle.</span> <span>The camera.</span> <span>The estimate.</span>
        </h1>
        <p className="lead">
          How do camera noise, exposure blur and drift change what displacement data can tell you? A
          camera averages motion during exposure and adds uncertainty to every position. Discover
          why those errors change what you can infer, even when the particle follows exactly the
          same path.
        </p>
      </header>
      <p className="notice">
        Noise-calibration assumption: stationary-feature clicks and the moving particle must have
        the same localization variance. The clicks cannot establish that assumption.
      </p>
      <CameraComparison example={{ ...example, parameters: p.data }} />
      <NotModeledLine instrumentId="bm-08" />
      <nav className="lab-onward" aria-label="From here">
        <h2>From here</h2>
        <ul>
          <li>
            <a href="/lab/bm-07/">Start with ideal molecular-number inference</a>
          </li>
          <li>
            <a href="/papers/brownian-motion/#arg-bm-inference">Return to the argument</a>
          </li>
        </ul>
      </nav>
      <section className="reading" id="camera-model">
        <p className="eyebrow">Why these procedures differ</p>
        <h2>An exposure is an average, not a point</h2>
        <p>
          The camera model uses a uniform exposure beginning at each frame time. Its position is the
          average latent position during that exposure, plus stage drift and independent Gaussian
          localization error. At zero exposure it uses the instantaneous frame-start position. The
          generated bridge integrals make these averages consistent with the same Brownian path.
        </p>
        <Formula
          latex={String.raw`\begin{gathered}\begin{aligned}Y_i &= \frac{1}{T_e}\int_{t_i}^{t_i+T_e}X(s)\,ds \\ &\quad + v_{\mathrm{stage}}(t_i+T_e/2)+\varepsilon_i,\end{aligned} \\ \varepsilon_i\sim\mathcal N(0,\sigma^2)\end{gathered}`}
        />
        <h2>Neighbors are correlated</h2>
        <p>
          For uniform, non-overlapping exposures and equally spaced frames, the per-coordinate
          variance and adjacent covariance of drift-subtracted increments are:
        </p>
        <Formula
          latex={String.raw`\begin{gathered}\gamma_0=2D(\Delta t-T_e/3)+2\sigma^2, \\ \gamma_1=DT_e/3-\sigma^2\end{gathered}`}
        />
        <p>
          Localization error enters two neighboring displacements with opposite signs. Motion blur
          contributes the other sign. Ignoring both can understate or overstate diffusion.
          Subtracting fitted drift alone does not remove either camera effect.
        </p>
        <h2>Use covariance, or choose independent pairs</h2>
        <p>
          For known drift, the combination of the second moment and neighboring product cancels the
          localization and blur terms. The covariance point estimate can still be negative in a
          finite sample; clipping it would conceal a diagnostic.
        </p>
        <Formula
          latex={String.raw`\widehat D_{\mathrm{CVE}}=\frac{\widehat\gamma_0/2+\widehat\gamma_1}{\Delta t}`}
        />
        <p>
          A different route takes disjoint frame pairs (0,1), (2,3), and so on. No pair shares a
          position error, and exposure is no longer than the spacing. These pair displacements are
          independent Gaussian vectors. Fitting one drift per coordinate leaves q = d(K − 1) degrees
          of freedom for K pairs. A chi-square interval for their variance can therefore be inverted
          using the known exposure and localization variance.
        </p>
        <Formula latex={String.raw`D=\frac{V-2\sigma^2}{2(\Delta t-T_e/3)}`} />
        <p>
          When localization variance comes from independent stationary-feature clicks, half the
          allowed error probability goes to its variance interval and half to the pair-variance
          interval. Combining their endpoints gives a conservative confidence set. The set is
          intersected with D ≥ 0. An empty intersection is a possible outcome and is retained as a
          miss, not turned into a positive answer.
        </p>
        <h2>Shorter intervals can magnify camera error</h2>
        <p>
          With zero exposure and mean drift removed, dividing the coordinate spread by the
          observation interval gives an apparent speed. Localization error dominates below the
          noise-only crossover interval σ²/D. This does not reveal a finite instantaneous Brownian
          velocity.
        </p>
        <Formula
          latex={String.raw`\begin{gathered}v_{\mathrm{app,ideal}}=\sqrt{2D/\Delta t}, \\ v_{\mathrm{app,camera}}=\frac{\sqrt{2D\Delta t+2\sigma^2}}{\Delta t}\end{gathered}`}
        />
        <h2>Keep this later model separate from the paper</h2>
        <p>
          These are original explanations of modern camera and inference models, not a transcription
          of Einstein’s argument. Synthetic camera observations are not experimental evidence for a
          physical suspension. The interval procedures assume constant drift, constant diffusivity,
          exact timing and calibration, uniform exposure, and independent Gaussian position errors.
          No irregular or censored data importer is supplied.
        </p>
        <p>
          <a href="https://doi.org/10.1103/PhysRevE.82.011917">
            Berglund (2010): camera-based single-particle tracking
          </a>{" "}
          ·{" "}
          <a href="https://doi.org/10.1103/PhysRevE.89.022726">
            Vestergaard, Blainey and Flyvbjerg (2014): covariance-based diffusion estimation
          </a>{" "}
          · <a href="/foundations/error-and-inference/">Read the uncertainty foundation</a>
        </p>
        <div className="actions">
          <a className="button" href="/lab/bm-07/">
            Return to ideal inference
          </a>
          <a href="/lab/bm-01/">Return to the tracer ensemble</a>
        </div>
      </section>
    </>
  );
}
