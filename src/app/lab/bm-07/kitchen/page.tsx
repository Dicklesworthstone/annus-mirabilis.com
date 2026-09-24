import "./kitchen.css";
import type { Metadata } from "next";
import { KitchenComparison } from "../../../../components/lab/kitchen/KitchenLab.tsx";
import { withScripts } from "../../../../components/lab/subscripts.tsx";
import { KITCHEN_CAPTION } from "../../../../experiments/bm07/kitchen/caption.ts";
import practice from "../../../../generated/kitchen-practice.json";
export const metadata: Metadata = {
  title: "Analyze your Brownian observations",
  description:
    "Keep the measured positions, the missing observations and the assumptions together. Change the analysis without rewriting the evidence.",
};
export default function KitchenObservationPage() {
  return (
    <>
      <header className="page-intro">
        <p className="eyebrow">Brownian motion · Your observations</p>
        <h1>
          <span>From your track</span> <span>to an honest inference.</span>
        </h1>
        <p className="lead">
          Keep the measured positions, the missing observations and the assumptions together. Change
          the analysis without rewriting the evidence.
        </p>
      </header>
      <KitchenComparison practice={practice} />
      <section className="lab-readings" aria-label="The analysis in words">
        <p data-detail="0">{withScripts(KITCHEN_CAPTION.r0)}</p>
        <p data-detail="1">{withScripts(KITCHEN_CAPTION.r1)}</p>
        <p data-detail="2" hidden>
          {withScripts(KITCHEN_CAPTION.r2)}
        </p>
        <p data-detail="3" hidden>
          {withScripts(KITCHEN_CAPTION.r3)}
        </p>
      </section>
      <nav className="lab-onward" aria-label="From here">
        <h2>From here</h2>
        <ul>
          <li>
            <a href="/kitchen/">Read the observation guide and worksheet</a>
          </li>
          <li>
            <a href="/lab/bm-08/">Start with camera error</a>
          </li>
          <li>
            <a href="/papers/brownian-motion/#arg-bm-inference">Return to the inference argument</a>
          </li>
        </ul>
      </nav>
      <section className="reading">
        <h2>What this version admits</h2>
        <p>
          Classroom CSVs contain source-image coordinates, actual timestamps, per-axis calibration,
          stationary-feature clicks and physical-input declarations. The calculation uses one
          calibrated coordinate and disjoint frame pairs. Unknown click error, exposure or radius
          stays unknown. Invalid equal-spacing or calibration assumptions cannot acquire a
          confident-looking interval.
        </p>
        <p>
          Manual exclusions preserve the recorded row and its reason, and withhold interval coverage
          after sample selection. Calibration and physical-input uncertainty are not included in a
          combined interval. A record marked reader-supplied is not automatically a verified
          experiment.
        </p>
        <p>
          Local video annotation is available at the end of each laboratory; automatic session
          saving is not. Browser-reported orientation and frame timing are not an independent camera
          calibration. A CSV export preserves the accepted observations for later import; an
          analysis export records the result and its assumptions.
        </p>
        <div className="actions">
          <a href="/edition/kitchen/practice.csv" download>
            Download the synthetic practice CSV
          </a>
          <a href="/edition/kitchen/worksheet.txt" download>
            Download the shared-schema worksheet
          </a>
        </div>
      </section>
    </>
  );
}
