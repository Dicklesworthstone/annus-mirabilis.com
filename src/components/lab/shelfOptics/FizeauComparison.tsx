import {
  compareFizeau,
  FIZEAU_ASSUMED_INDEX,
  FIZEAU_DATASET_ID,
  type FizeauRecord,
} from "../../../experiments/shelfOptics/fizeau.ts";
import type { ShelfSnapshot } from "../../../experiments/shelfOptics/state.ts";
import { sentenceNumber } from "../presentation.ts";

/** The observations are immutable; every model cell selects this laboratory's accepted snapshot. */
export function FizeauComparison({
  record,
  snapshot,
  onUseSourceConditions,
  ready = true,
  dirty = false,
  refused = false,
}: {
  record: FizeauRecord;
  snapshot: ShelfSnapshot;
  onUseSourceConditions?: (() => void) | undefined;
  ready?: boolean;
  dirty?: boolean;
  refused?: boolean;
}) {
  const comparison = compareFizeau(record, snapshot);
  const parameters = snapshot.report.parameters;
  return (
    <section
      id="fizeau-measurements"
      className="shelf-measurement"
      data-world-check-measurement={record.kind}
      data-historical-dataset={FIZEAU_DATASET_ID}
      data-comparison-kind={comparison.kind === "available" ? "measured-fact" : undefined}
      data-comparison-revision={snapshot.revision}
      aria-label="Fizeau's measured moving-water displacements"
    >
      <h3>What moving water did to the fringes</h3>
      {record.kind === "withheld" ? (
        <p>{record.reason}</p>
      ) : (
        <>
          <p className="eyebrow">{record.evidenceLabel}</p>
          <p>
            Fizeau printed nineteen observations, reduced to a common bulk water speed of{" "}
            {record.sourceInputs.waterSpeed} m/s. Their mean is{" "}
            <strong data-fizeau-observed-mean>{sentenceNumber(record.meanFringeShift, 5)}</strong>{" "}
            fringe: the pattern moved by about a quarter of one stripe. These are the printed
            observations, separate from the model predictions.
          </p>
          {dirty || refused ? (
            <p role="status" data-fizeau-currency="previous-accepted">
              {refused
                ? "The requested settings were refused."
                : "Your edits have not been applied."}{" "}
              This comparison retains accepted calculation {snapshot.revision}.
            </p>
          ) : null}
          {comparison.kind === "available" ? (
            <>
              <p
                data-fizeau-conditions={comparison.sourceConditionsMatch ? "matched" : "different"}
              >
                {comparison.sourceConditionsMatch
                  ? "The accepted calculation uses the source's bulk-flow reduction, two-traversal path and selected wavelength."
                  : "The accepted settings differ from the source's apparatus or bulk-flow reduction. The model column follows those accepted settings; the measurements stay fixed."}{" "}
                It uses today’s speed of light and an assumed refractive index of{" "}
                {parameters.instrumentId === "shelf-fizeau"
                  ? parameters.refractiveIndex
                  : "unknown"}
                . This is a modern recalculation with a stated index assumption.
              </p>
              <table>
                <caption>One-direction fringe displacement · same accepted model settings</caption>
                <thead>
                  <tr>
                    <th scope="col">Hypothesis</th>
                    <th scope="col">Accepted model</th>
                    <th scope="col">Measured mean</th>
                    <th scope="col">Measured minus model</th>
                  </tr>
                </thead>
                <tbody>
                  {comparison.predictions.map((prediction) => (
                    <tr key={prediction.modelId} data-fizeau-model={prediction.modelId}>
                      <th scope="row">{prediction.label}</th>
                      <td data-fizeau-predicted>
                        {sentenceNumber(prediction.predictedFringeShift, 5)}
                      </td>
                      <td>{sentenceNumber(record.meanFringeShift, 5)}</td>
                      <td>{sentenceNumber(prediction.observedMinusModel, 5)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </>
          ) : (
            <p data-fizeau-unavailable>{comparison.reason}</p>
          )}
          {onUseSourceConditions && (
            <p>
              <button
                type="button"
                className="secondary"
                disabled={!ready}
                onClick={onUseSourceConditions}
              >
                Apply Fizeau’s apparatus settings
              </button>
            </p>
          )}
          <p className="fine">
            That setup uses {record.sourceInputs.waterPathPerBeam} m of moving water per beam, twice
            the {record.sourceInputs.tubeLength} m tube length in the source calculation, and its
            selected solar E-line wavelength of {record.sourceInputs.wavelength * 1e9} nm. The
            preset’s index, {FIZEAU_ASSUMED_INDEX}, is an explicit model assumption; the source
            pages do not supply a numerical index. The sunlight was not monochromatic.
          </p>
          <details>
            <summary>The nineteen printed observations</summary>
            <table>
              <caption>
                Full memoir, p. 392 · reduced to 7.059 m/s · one-direction displacement
              </caption>
              <thead>
                <tr>
                  <th scope="col">Printed row</th>
                  <th scope="col">Fringes</th>
                </tr>
              </thead>
              <tbody>
                {record.observations.map((observation) => (
                  <tr key={observation.rowNumber}>
                    <th scope="row">{observation.rowNumber}</th>
                    <td data-fizeau-observed>{observation.fringeShift.toFixed(3)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <p>
              Fizeau prints a sum of 4.373 and a mean of 0.23016. He reduced observations made at
              several speeds to the same speed; individual original speeds are not given for these
              rows. Reversing the flow gives twice the one-direction displacement. The table above
              is not doubled when the laboratory’s reversal switch changes.
            </p>
            <p>{record.uncertainty}</p>
          </details>
          <details>
            <summary>What the difference can and cannot decide</summary>
            <p>
              The water speed came from discharged volume per second divided by tube area. On pp.
              398–399 Fizeau explains that the rays pass through the faster central water, while
              this procedure gives the average speed. He did not measure the correction. No
              correction, fitted refractive index or experimental error bar has been added here. The
              nineteen values share that uncertainty in the apparatus.
            </p>
            <p>
              His printed predictions were 0.4597 fringe for full drag and 0.2022 for Fresnel drag.
              They use his calculation and are distinct from the modern model column. The observed
              shift favors partial over complete or absent drag under the stated conditions; this
              first-order comparison does not distinguish an ether account from the later
              relativistic account.
            </p>
            <p>
              The laboratory’s optional relativistic speed comparison is a later explanation:
              velocity addition gives Fresnel’s coefficient to first order. It is not an extra
              measurement or a premise available to the 1904 reader.
            </p>
          </details>
          <p>
            <a href={record.sourcePageImage}>Inspect the table on the scanned page</a>
          </p>
          <p className="fine">Source gallica.bnf.fr / Bibliothèque nationale de France.</p>
        </>
      )}
      <p className="fine">{record.citation}</p>
    </section>
  );
}
