import { HistoricalModeAllocationPreview } from "../../components/lab/HistoricalModeAllocationPreview.tsx";
import { Sci } from "../../components/lab/Sci.tsx";
import { type ShelfId, shelfFields } from "../../experiments/shelf/definition.ts";
import {
  getHistoricalShelfExample,
  historicalShelfModelLabel,
  historicalShelfUnitLabel,
} from "../../experiments/shelf/historicalExample.ts";
import { SR04_HISTORICAL_EXAMPLE } from "../../experiments/sr04/historical.ts";
import { DEFAULT_SIGNED_DISPLACEMENT_SNAPSHOT } from "../../reader/entrances/signedDisplacementExercise.ts";
import { DESK_INSTRUMENT_BINDINGS } from "./instruments.ts";
import type { DeskExperimentId } from "./model.ts";

function ShelfWorkedExample({ id }: { id: ShelfId }) {
  const example = getHistoricalShelfExample(id);
  const binding = DESK_INSTRUMENT_BINDINGS[id];
  return (
    <div data-instrument-id={id} data-mode-id={binding.modeId} data-preset-id={binding.presetId}>
      <p>{example.question}</p>
      <p className="fine">Illustrative settings; light-related speeds are fractions of c.</p>
      <dl className="desk-accepted-settings">
        {shelfFields(id, "1904").map((field) => (
          <div key={field.id}>
            <dt>{field.label}</dt>
            <dd>
              {typeof example.parameters[field.id] === "boolean"
                ? example.parameters[field.id]
                  ? "Yes"
                  : "No"
                : historicalShelfModelLabel(String(example.parameters[field.id]))}
            </dd>
          </div>
        ))}
      </dl>
      <div className="table-scroll">
        <table>
          <caption>Predictions from the same accepted example</caption>
          <thead>
            <tr>
              <th scope="col">Hypothesis</th>
              <th scope="col">Reading</th>
              <th scope="col">Calculated value</th>
            </tr>
          </thead>
          <tbody>
            {example.readings.map((reading) => {
              const output = example.outputs.find((item) => item.quantityId === reading.id);
              return (
                <tr key={reading.id}>
                  <td>{historicalShelfModelLabel(reading.model)}</td>
                  <th scope="row">{reading.label}</th>
                  <td data-output={reading.id}>
                    {output?.status === "value" && typeof output.value === "number" ? (
                      <>
                        <Sci value={output.value} digits={5} />{" "}
                        {historicalShelfUnitLabel(reading.unit)}
                      </>
                    ) : output?.status === "outside-domain" ? (
                      output.reason
                    ) : (
                      "Reading unavailable"
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <p className="fine">
        Not modeled: {example.notModeled.join("; ")}. These predictions are not historical
        measurements.
      </p>
    </div>
  );
}

function SignedWorkedExample() {
  const example = DEFAULT_SIGNED_DISPLACEMENT_SNAPSHOT;
  return (
    <div data-entrance-id="entrance-brownian-motion">
      <p>
        Four authored displacements in arbitrary exercise units: {example.entries.join(", ")}. They
        illustrate arithmetic; they are not historical particle measurements.
      </p>
      <div className="table-scroll">
        <table>
          <caption>The same four marks, compared three ways</caption>
          <thead>
            <tr>
              <th scope="col">Mark</th>
              <th scope="col">Signed displacement</th>
              <th scope="col">Absolute displacement</th>
              <th scope="col">Squared displacement</th>
            </tr>
          </thead>
          <tbody>
            {example.rows.map((row) => (
              <tr key={row.id}>
                <th scope="row">{row.label}</th>
                <td>{row.displacement}</td>
                <td>{row.absolute}</td>
                <td>{row.square}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p>
        Mean signed displacement: <strong>{example.totals.meanSigned}</strong>. Mean absolute
        displacement: <strong>{example.totals.meanAbsolute}</strong>. Mean square:{" "}
        <strong>{example.totals.meanSquare}</strong>. Root mean square:{" "}
        <strong>
          <Sci value={example.totals.rootMeanSquare} digits={4} />
        </strong>
        .
      </p>
      <p>
        Cancellation in the signed average can coexist with a spread. The calculation says nothing
        yet about the cause of motion.
      </p>
    </div>
  );
}

function GalileanWorkedExample() {
  const example = SR04_HISTORICAL_EXAMPLE;
  const binding = DESK_INSTRUMENT_BINDINGS["sr-04"];
  return (
    <div data-instrument-id="sr-04" data-mode-id={binding.modeId} data-preset-id={binding.presetId}>
      <p>
        An object moves at {example.parameters.objectSpeed} m/s, while its observer moves at{" "}
        {example.parameters.observerSpeed} m/s. In a separate light-ray comparison, the observer
        moves at {example.parameters.vOverC}c. Subtract the observer's velocity in each case.
      </p>
      <table>
        <caption>Galilean predictions; signs indicate direction</caption>
        <thead>
          <tr>
            <th scope="col">Case</th>
            <th scope="col">Velocity assigned by the observer</th>
          </tr>
        </thead>
        <tbody>
          {(
            [
              ["Slow object", example.slowCaseGalilean, "m/s"],
              ["Right-going ray", example.rightRayFraction, "c"],
              ["Left-going ray", example.leftRayFraction, "c"],
            ] as const
          ).map(([label, result, unit]) => (
            <tr key={label}>
              <th scope="row">{label}</th>
              <td>
                {result.status === "value" ? (
                  <>
                    <Sci value={result.value} digits={3} /> {unit}
                  </>
                ) : (
                  result.reason
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <p>
        The differing ray speeds are the ether-frame prediction under this rule. Compare it with the
        null drift result and Poincaré's 1904 principle. No measured value of c is supplied.
      </p>
    </div>
  );
}

export function DeskWorkedExample({ id }: { id: DeskExperimentId }) {
  switch (id) {
    case "lq-02":
      return <HistoricalModeAllocationPreview />;
    case "signed-displacement":
      return <SignedWorkedExample />;
    case "sr-04":
      return <GalileanWorkedExample />;
    default:
      return <ShelfWorkedExample id={id} />;
  }
}

export function RadiationPressureExample() {
  return (
    <section className="desk-pressure-example" aria-labelledby="desk-pressure-title">
      <h3 id="desk-pressure-title">A pressure entry in the ledger</h3>
      <p className="fine">
        Static worked example · symbolic comparison within Maxwell's stated field model.
      </p>
      <p>
        Let u be the light's energy per volume. For waves falling normally on a perfectly absorbing
        surface, the pressure equals u. In a beam travelling at c, the energy flux is c u; the same
        relation can be written pressure = energy flux / c. The speed stays symbolic.
      </p>
      <table>
        <caption>Changing the illumination, keeping the model and surface fixed</caption>
        <thead>
          <tr>
            <th scope="col">Energy per volume</th>
            <th scope="col">Energy flux</th>
            <th scope="col">Pressure</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>u</td>
            <td>c u</td>
            <td>u</td>
          </tr>
          <tr>
            <td>2u</td>
            <td>2c u</td>
            <td>2u</td>
          </tr>
        </tbody>
      </table>
      <p>
        The model predicts a push. This ledger has no calculation of a change in the emitter's
        inertia. It omits oblique incidence, reflection, material response and the thermal forces an
        actual pressure experiment must control.
      </p>
      <p>
        Sources: <a href="#card-maxwell-1873-radiation-pressure">Maxwell's pressure argument</a>,{" "}
        <a href="#card-poynting-1884-energy-flux">Poynting's energy flow</a>, and{" "}
        <a href="#card-lebedev-1901-radiation-pressure-measured">
          Lebedev's measurement and its limits
        </a>
        .
      </p>
    </section>
  );
}
