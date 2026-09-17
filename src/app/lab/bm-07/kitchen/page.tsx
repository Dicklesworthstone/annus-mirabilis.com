import "./kitchen.css";
import type { Metadata } from "next";
import { KitchenComparison } from "../../../../components/lab/kitchen/KitchenLab.tsx";
import practice from "../../../../generated/kitchen-practice.json";
export const metadata: Metadata = { title: "Analyze your Brownian observations" };
export default function KitchenObservationPage() {
  return (
    <>
      <header className="page-intro">
        <p className="eyebrow">Brownian motion · Local observation analysis</p>
        <h1>
          From your track
          <br />
          to an honest inference.
        </h1>
        <p className="lead">
          Keep the measured positions, the missing observations and the assumptions together. Change
          the analysis without rewriting the evidence.
        </p>
        <p>
          <a href="/kitchen/">Read the observation guide and worksheet</a> ·{" "}
          <a href="/lab/bm-08/">Explore camera error first</a> ·{" "}
          <a href="/papers/brownian-motion/#arg-bm-inference">Return to the inference argument</a>
        </p>
      </header>
      <KitchenComparison practice={practice} />
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
          Local video annotation and automatic session saving are not included in this preview. A
          CSV export preserves the accepted observations for later import; an analysis export
          records the result and its assumptions.
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
