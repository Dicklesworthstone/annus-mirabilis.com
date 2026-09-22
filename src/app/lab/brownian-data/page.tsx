import "../bm-07/inference.css";
import "./observations.css";
import type { Metadata } from "next";
import { MeasuredTrajectoryLab } from "../../../components/lab/MeasuredTrajectoryLab.tsx";

export const metadata: Metadata = { title: "Analyze your Brownian trajectory data" };
export default function BrownianDataPage() {
  return (
    <>
      <header className="page-intro">
        <p className="eyebrow">Brownian motion · Your observations</p>
        <h1>What does your recording actually identify?</h1>
        <p className="lead">
          Bring an explicitly calibrated trajectory CSV, inspect the observations, and ask whether
          the selected observation model admits them before interpreting an estimate.
        </p>
        <p>
          <a href="/lab/bm-07/">Return to the synthetic inference exercise and derivation</a>
        </p>
      </header>
      <section className="reading" aria-labelledby="trajectory-format">
        <h2 id="trajectory-format">A small, explicit data format</h2>
        <p>
          The following is a format illustration, not experimental evidence. A row is a position;
          successive rows for the same track produce non-overlapping displacements. Choose time and
          position units in the form rather than relying on a filename or coordinate magnitude.
        </p>
        <figure aria-label="Illustrative CSV format">
          <pre>{"track,time,x,y\nA,0,0,0\nA,1,0.4,-0.2\nA,2,0.1,0.3"}</pre>
        </figure>
        <p>
          Choose ideal independent increments or camera-aware disjoint frame pairs. The camera
          method includes an explicitly known Gaussian localization noise scale and uniform
          exposure, rather than silently ignoring them. Pairs stay within the same track; unmatched
          final frames remain in the observations and are listed in the result and export. Unknown
          noise, selection bias and unsupported observation models still receive no interval.
        </p>
      </section>
      <MeasuredTrajectoryLab />
      <section className="reading" aria-labelledby="trajectory-limits">
        <h2 id="trajectory-limits">An interval is not an authenticity certificate</h2>
        <p>
          Conditional coverage describes a procedure under a model, not a posterior probability for
          a realized interval. The camera method models the declared noise and exposure while
          holding their values, timing and spatial calibration exact. Uncertainty in those inputs,
          selection, confinement, correlated tracking errors and different particle properties are
          not included. A successful calculation does not establish that the recording satisfies the
          model. A negative estimate or an empty physical confidence set is retained as a
          diagnostic, never silently replaced by a plausible positive answer.
        </p>
        <p>
          <a href="/lab/bm-08/">Explore how a camera changes the inference</a>
        </p>
        <p>
          <a href="/papers/brownian-motion/#arg-bm-inference">
            Return to the paper’s inverse argument
          </a>
        </p>
      </section>
    </>
  );
}
