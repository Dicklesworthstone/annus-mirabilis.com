import {
  DEFAULT_HISTORICAL_LQ02_SNAPSHOT,
  HISTORICAL_LQ02_CONSTANT_SET,
  HISTORICAL_LQ02_MODE,
  HISTORICAL_LQ02_PRESET,
  type HistoricalLq02Snapshot,
} from "../../experiments/lq02/historical.ts";
import type { ClassicalRelativeResult } from "../../physics/reference/radiation/classicalRelative.ts";
import { Sci } from "./Sci.tsx";

function RelativeValue({ result }: { result: ClassicalRelativeResult }) {
  return result.status === "value" ? (
    <Sci value={result.value} digits={6} />
  ) : (
    <>Not available for these settings: {result.reason}</>
  );
}

/** Shared by the interactive lab and its server-rendered, reading-only worked case. */
export function HistoricalModeAllocationReadout({
  snapshot,
}: {
  snapshot: HistoricalLq02Snapshot;
}) {
  return (
    <>
      <p className="model-note">
        At <Sci value={snapshot.inputs.T} digits={5} /> K, include frequencies up to{" "}
        <Sci value={snapshot.inputs.nuCutoff} digits={5} /> Hz. The equal-shares allocation gives U
        = A T ν<sub>max</sub>
        <sup>3</sup>, with the coefficient A left unspecified.
      </p>
      <table>
        <caption>Equal-shares allocation with a finite upper frequency</caption>
        <tbody>
          <tr>
            <th scope="row">Absolute energy per volume up to the upper frequency</th>
            <td
              data-output="energyUpToCutoff"
              data-result-status={snapshot.energyUpToCutoff.status}
            >
              Symbolic: A T ν<sub>max</sub>
              <sup>3</sup>
            </td>
          </tr>
          <tr>
            <th scope="row">
              Energy relative to <Sci value={snapshot.reference.T} digits={3} /> K and{" "}
              <Sci value={snapshot.reference.nuCutoff} digits={3} /> Hz
            </th>
            <td data-output="relativeEnergy" data-result-status={snapshot.relativeEnergy.status}>
              <RelativeValue result={snapshot.relativeEnergy} />
            </td>
          </tr>
          <tr>
            <th scope="row">
              Fraction of energy above <Sci value={snapshot.inputs.probeFrequency} digits={5} /> Hz
            </th>
            <td data-output="shareAboveProbe" data-result-status={snapshot.shareAboveProbe.status}>
              <RelativeValue result={snapshot.shareAboveProbe} />
            </td>
          </tr>
          <tr>
            <th scope="row">Energy multiplier for a tenfold wider frequency range</th>
            <td data-output="tenfoldGrowth" data-result-status={snapshot.tenfoldGrowth.status}>
              <RelativeValue result={snapshot.tenfoldGrowth} />
            </td>
          </tr>
          <tr>
            <th scope="row">Planck's printed molecular number, 1901</th>
            <td data-output="planckNumber">
              <Sci value={snapshot.planckNumber.value} digits={3} /> per mole
            </td>
          </tr>
        </tbody>
      </table>
      <p className="fine">
        Planck's printed number is a separate historical estimate, not a coefficient supplied to the
        allocation. Source: <cite>Ueber die Elementarquanta der Materie und der Elektricität</cite>,{" "}
        {snapshot.planckNumber.source}.
      </p>
    </>
  );
}

/** No client boundary, effects or generated assets: the desk can render this before loading a lab. */
export function HistoricalModeAllocationPreview() {
  return (
    <section
      aria-label="Classical allocation: 1904 worked example"
      data-instrument-id="lq-02"
      data-mode={HISTORICAL_LQ02_MODE}
      data-constant-set={HISTORICAL_LQ02_CONSTANT_SET}
      data-preset-id={HISTORICAL_LQ02_PRESET}
    >
      <p className="badge">Static worked example</p>
      <HistoricalModeAllocationReadout snapshot={DEFAULT_HISTORICAL_LQ02_SNAPSHOT} />
    </section>
  );
}
