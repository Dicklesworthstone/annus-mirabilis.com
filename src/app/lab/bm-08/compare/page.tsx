import type { Metadata } from "next";
import { CameraControlledComparison } from "../../../../components/lab/CameraControlledComparison.tsx";
import { validateBm08Parameters } from "../../../../experiments/bm08/parameters.ts";
import { ExperimentRuntimeError } from "../../../../experiments/refusal.ts";
import example from "../../../../generated/bm08-example.json";
import "../../../../experiments/compare/comparison.css";
import "./cameraComparison.css";

export const metadata: Metadata = {
  title: "One particle, two cameras: a controlled observation comparison",
  description:
    "Hold a Brownian path fixed while changing one camera or estimator setting. Compare accepted frames, diffusion estimates and conditional confidence sets.",
  alternates: { canonical: "/lab/bm-08/compare/" },
};
export default function CameraComparisonPage() {
  const checked = validateBm08Parameters(example.parameters);
  if (checked.kind !== "accepted")
    throw new ExperimentRuntimeError(
      "parameters-rejected",
      "The prepared camera settings are invalid.",
      "bm-08",
    );
  return (
    <>
      <header className="page-intro">
        <p className="eyebrow">Brownian motion · Controlled observation · Later model</p>
        <h1>The same path. A different answer?</h1>
        <p className="lead">
          A noisier camera can make a particle appear to diffuse differently without changing its
          motion. Hold the particle's path fixed, change one part of the measurement, and compare
          what each estimate and confidence set actually says.
        </p>
      </header>
      <CameraControlledComparison example={{ ...example, parameters: checked.data }} />
      <nav className="lab-onward" aria-label="From this comparison">
        <h2>From here</h2>
        <ul>
          <li>
            <a href="/lab/bm-08/">Full camera laboratory and repeated-experiment checks</a>
          </li>
          <li>
            <a href="/lab/bm-01/compare/">Change the physical setup instead of the measurement</a>
          </li>
          <li>
            <a href="/lab/bm-07/">What information determines the molecular number?</a>
          </li>
          <li>
            <a href="/papers/brownian-motion/#arg-bm-inference">
              Return to the paper's inference argument
            </a>
          </li>
        </ul>
      </nav>
    </>
  );
}
