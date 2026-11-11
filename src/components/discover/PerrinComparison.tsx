import {
  comparePerrin,
  PERRIN_1909_DATASET_ID,
  type PerrinRecord,
} from "../../experiments/bm01/perrin.ts";
import { CurrencyForView } from "../../experiments/labels/CurrencyForView.tsx";
import type { AcceptedSnapshot, ExperimentView } from "../../experiments/store/instanceStore.ts";
import { fixed } from "../lab/presentation.ts";

/** Observation and prediction have separate columns; no fit moves either onto the other. */
export function PerrinComparison({
  record,
  snapshot,
  view,
  onUseSourceConditions,
}: {
  record: PerrinRecord;
  snapshot: AcceptedSnapshot;
  view: ExperimentView;
  onUseSourceConditions?: (() => void) | undefined;
}) {
  const comparison = comparePerrin(record, snapshot);
  return (
    <section
      data-world-check-measurement={record.kind}
      data-historical-dataset={PERRIN_1909_DATASET_ID}
      data-comparison-kind={comparison.kind === "available" ? "measured-fact" : undefined}
      aria-label="Perrin's measured displacements"
    >
      <h3>What the microscope measured in 1909</h3>
      {record.kind === "withheld" ? (
        <p>{record.reason}</p>
      ) : (
        <>
          <p className="eyebrow">{record.evidenceLabel}</p>
          <p>
            Chaudesaigues followed fifty gamboge grains for two minutes. Perrin printed their
            mean-square displacements along one axis: an average of observations, separate from
            the model computed here. The first series used grains of radius 0.212 µm in water at
            17 °C, with a viscosity of 1.1 mPa·s.
          </p>
          {comparison.kind === "available" ? (
            <>
              <CurrencyForView view={view} />
              {view.status === "unavailable" && (
                <p role="status">
                  {view.outcome?.message ?? "No new calculation is available."} The comparison
                  retains the last accepted result.
                </p>
              )}
              <p data-perrin-conditions={comparison.sourceConditionsMatch ? "matched" : "different"}>
                {comparison.sourceConditionsMatch
                  ? "The accepted model uses the source's temperature, viscosity and radius with today's constants."
                  : "The ensemble's accepted settings differ from the source conditions. Its model column below uses those accepted settings."}
              </p>
              {onUseSourceConditions && (
                <p>
                  <button
                    type="button"
                    className="secondary"
                    onClick={onUseSourceConditions}
                    disabled={view.pending}
                  >
                    Use Perrin’s source conditions
                  </button>
                </p>
              )}
              <table>
                <caption>First series, p. 77: one-axis mean square in µm²</caption>
                <thead>
                  <tr>
                    <th scope="col">Interval (s)</th>
                    <th scope="col">Measured</th>
                    <th scope="col">Accepted model</th>
                    <th scope="col">Measured minus model</th>
                  </tr>
                </thead>
                <tbody>
                  {comparison.points.map((point) => (
                    <tr key={point.elapsedTimeSeconds} data-perrin-interval={point.elapsedTimeSeconds}>
                      <th scope="row">{point.elapsedTimeSeconds}</th>
                      <td data-perrin-observed>{fixed(point.observedMeanSquareM2 * 1e12, 1)}</td>
                      <td data-perrin-model>{fixed(point.predictedMeanSquareM2 * 1e12, 1)}</td>
                      <td>{fixed(point.measuredMinusModelM2 * 1e12, 1)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <p>
                The model column follows the ensemble’s accepted diffusivity. Changing the
                controls changes that prediction when applied; it cannot change what Perrin
                printed. The comparison makes no fit, and the differences remain visible.
              </p>
            </>
          ) : (
            <p>{comparison.reason}</p>
          )}
          <details>
            <summary>What the measurements can establish</summary>
            <p>
              Page 76 defines this statistic as half the mean squared displacement in the
              microscope’s horizontal plane. The four intervals share the same grains, so they
              are not four independent experiments. Longer intervals leave fewer displacements
              to average.
            </p>
            <p>{record.uncertainty}</p>
            <p>
              The ideal model assumes dilute spherical particles, liquid Stokes drag, no drift
              and no nearby walls, at times long compared with momentum relaxation. The table
              does not establish all those assumptions. Its values need not lie exactly on the
              model, and printed rounding cannot explain away every difference.
            </p>
          </details>
          <p>
            <a href={record.sourcePageImage}>Read the table on the scanned page</a>
          </p>
          <p className="fine">Source gallica.bnf.fr / Bibliothèque nationale de France.</p>
        </>
      )}
      <p className="fine">{record.citation}</p>
    </section>
  );
}
