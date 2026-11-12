import { PERRIN_1909_DATASET_ID } from "../../experiments/bm01/perrin.ts";
import type { PerrinSummaryRecord } from "../../experiments/bm07/perrinSummary.ts";
import { fixed } from "./presentation.ts";

/** Source-pinned observations and reference-owner results remain readable without JavaScript. */
export function PerrinSummary({ record }: { record: PerrinSummaryRecord }) {
  return (
    <section
      id="perrin-1909"
      className="reading"
      aria-labelledby="perrin-summary-title"
      data-historical-dataset={PERRIN_1909_DATASET_ID}
      data-historical-summary={record.kind}
    >
      <h2 id="perrin-summary-title">Use Perrin’s measured displacements</h2>
      {record.kind === "withheld" ? (
        <p>{record.reason}</p>
      ) : (
        <>
          <p className="eyebrow">{record.evidenceLabel}</p>
          <p>
            Chaudesaigues followed fifty gamboge grains for two minutes. Perrin published their
            mean-square displacements along one axis. Turn each reported mean square into an
            apparent diffusivity by dividing by twice its observation interval: D̂ = ⟨x²⟩/(2Δt). This
            assumes the ideal zero-drift diffusion model and leaves position-reading error
            uncorrected.
          </p>
          <table className="inference-summary">
            <caption>
              First series, p. 77 · observed mean squares and calculated point estimates
            </caption>
            <thead>
              <tr>
                <th scope="col">Interval (s)</th>
                <th scope="col">Measured mean square (µm²)</th>
                <th scope="col">Apparent D̂ (µm²/s)</th>
              </tr>
            </thead>
            <tbody>
              {record.points.map((point) => (
                <tr key={point.elapsedTimeSeconds} data-perrin-interval={point.elapsedTimeSeconds}>
                  <th scope="row">{point.elapsedTimeSeconds}</th>
                  <td data-perrin-observed>{fixed(point.observedMeanSquareM2 * 1e12, 1)}</td>
                  <td data-perrin-diffusivity>{fixed(point.diffusivityM2PerSecond * 1e12, 3)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <p>
            A single ideal diffusivity would give the same point estimate at every interval. The
            differences here remain visible. These rows share grains and observations, so they
            cannot be pooled as four independent experiments or turned into raw increments.
          </p>
          <h3>What remains unknown</h3>
          <p data-perrin-interval-status={record.intervalStatus}>
            {record.intervalReason} The number of grains is not the required count of independent
            coordinate displacements. Neither printed rounding nor the scatter between these
            overlapping summaries supplies a confidence interval.
          </p>
          <p>
            A molecular-number estimate also needs independently established radius, viscosity,
            temperature and gas-constant information. This record gives physical conditions, but
            does not yet admit their calibration for that inference. No molecular number is inferred
            here. You can compare the observations with the tracer model or supply a calibrated
            observation record of your own.
          </p>
          <details>
            <summary>Source, measurement limits and calculation</summary>
            <p>
              On p. 76, Perrin defines the statistic as half the mean squared displacement in the
              microscope’s horizontal plane. The first series uses grains of radius 0.212 µm in
              water at 17 °C, with viscosity 1.1 mPa·s. The points above use only the printed mean
              squares and times; no modern molecular constant generates these observations.
            </p>
            <p>{record.uncertainty}</p>
            <p>
              The point estimates are a host calculation using the reference evaluator’s one-axis
              summary model. They do not fit a synthetic path, subtract an assumed camera error or
              replace the observed scatter with the model’s prediction.
            </p>
          </details>
          <p>
            <a href={record.sourcePageImage}>Read Perrin’s table on the scanned page</a>
          </p>
          <p className="fine">Source gallica.bnf.fr / Bibliothèque nationale de France.</p>
        </>
      )}
      <p className="fine">{record.citation}</p>
      <div className="actions">
        <a href="/discover/brownian-motion/#step-06">
          Compare these observations with the tracer model
        </a>
        <a href="/lab/brownian-data/">Analyze a calibrated trajectory CSV</a>
        <a href="/lab/bm-07/kitchen/">Analyze classroom CSV or local microscope video</a>
      </div>
    </section>
  );
}
