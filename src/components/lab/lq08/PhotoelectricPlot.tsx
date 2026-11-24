import type { Lq08CollectorSweep } from "../../../experiments/lq08/collectorSweep.ts";
import type { Lq08EnergyBudget } from "../../../experiments/lq08/energyBudget.ts";
import type { MillikanOverlayResult } from "../../../experiments/lq08/millikan.ts";
import { visibleColor } from "../../../experiments/lq08/session.ts";
import { AwaitingNote, placeholderOf } from "../predictPlaceholder.tsx";
import { fixed, sentenceNumber } from "../presentation.ts";
import { Sci, SciSvg } from "../Sci.tsx";

/**
 * A predict gate's attribute (PredictGate.tsx). Each drawing keeps its axes, levels and inputs in
 * view and spreads this on what the prompts ask about, which then waits for an answer or a skip.
 */
type PredictResponse = Readonly<{ "data-predict-response": "shown" | "awaiting" }>;

export type EnergyLadderProps = Readonly<{
  frequency: number; // Hz
  workFunction: number; // eV
  quantumEnergyEv: number; // eV
  kMaxEv: number | null; // eV only for a determined maximum
  kMaxUpperBoundEv: number | null;
  kineticEnergyStatus: Lq08EnergyBudget["maxKineticEnergy"]["status"] | undefined;
  transferModel: Lq08EnergyBudget["transferModel"];
  thresholdFrequency: number; // Hz
  response?: PredictResponse;
}>;

export function EnergyLadderPlot({
  frequency,
  workFunction,
  quantumEnergyEv,
  kMaxEv,
  kMaxUpperBoundEv,
  kineticEnergyStatus,
  transferModel,
  thresholdFrequency,
  response,
}: EnergyLadderProps) {
  const width = 360;
  const height = 240;
  // left: the level labels are right-aligned 8 units short of it, and at the lab's SVG text size
  // (15.84 units, about 9.5 a mono character) "−2.20 eV" is 76 wide, so at 72 it began at −12
  // and lost its minus sign off the drawing's left edge.
  const padding = { top: 30, right: 30, bottom: 40, left: 94 };

  // The drawn range runs from just below the metal's level, -Φ, to just above the level the
  // quantum lifts the electron to, -Φ + hν. It used to be fixed at -1 to 6 eV and clamped, so
  // the metal's level sat at -1 eV whatever Φ was, and the upper two thirds stayed empty.
  const lo = -Math.max(workFunction, 0.5) - 0.4;
  const hi = Math.max(0, quantumEnergyEv - workFunction) + 0.6;
  const scaleY = (ev: number) =>
    height - padding.bottom - ((ev - lo) / (hi - lo)) * (height - padding.top - padding.bottom);

  const yZero = scaleY(0);
  const yWork = scaleY(-workFunction);
  const yPhoton = scaleY(-workFunction + quantumEnergyEv);
  const col = visibleColor(frequency);
  // The band's colour, set per theme in labShell.css so the photon stands out on either paper.
  const photonColour = `var(--spectral-${col.band})`;

  return (
    <div
      data-view-id="lq-08-energy-diagram"
      style={{
        display: "flex",
        flexDirection: "column",
        gap: "0.5rem",
      }}
    >
      <h3
        style={{
          margin: "0 0 0.25rem",
          fontSize: "0.875rem",
          fontWeight: 600,
          color: "var(--ink)",
        }}
      >
        {transferModel === "partial"
          ? "An energy ceiling from one quantum"
          : "Where one quantum’s energy goes"}
      </h3>
      <p className="fine" style={{ margin: "0 0 0.5rem" }}>
        <span style={{ fontFamily: "var(--font-mono, monospace)" }}>
          h&nu; = {fixed(quantumEnergyEv, 3)} eV
        </span>
        , &Phi; ={" "}
        <span style={{ fontFamily: "var(--font-mono, monospace)" }}>
          {workFunction.toFixed(2)} eV
        </span>{" "}
        , {transferModel === "partial" ? "necessary frequency limit" : "threshold"} &nu;<sub>0</sub>{" "}
        ={" "}
        <span style={{ fontFamily: "var(--font-mono, monospace)" }}>
          {(thresholdFrequency / 1e12).toFixed(1)} THz
        </span>
      </p>
      <svg
        viewBox={`0 0 ${width} ${height}`}
        role="img"
        aria-label={`Energy ladder diagram showing quantum energy ${quantumEnergyEv.toFixed(2)} eV and work function ${workFunction.toFixed(2)} eV`}
        style={{
          width: "100%",
          height: "auto",
          background: "var(--panel)",
          border: "1px solid var(--line)",
          borderRadius: "0.25rem",
        }}
      >
        {/* The vacuum level, 0 eV: the energy an electron needs to be outside the metal, and so
            the line the ladder is about. It takes --muted (5.98:1 on either paper), not the rule
            colour, --line, in which it stood at 1.45:1 like a gridline. */}
        <line
          x1={padding.left}
          y1={yZero}
          x2={width - padding.right}
          y2={yZero}
          stroke="var(--muted)"
          strokeWidth="1.5"
          strokeDasharray="4 3"
        />
        <text
          x={padding.left - 8}
          y={yZero + 4}
          textAnchor="end"
          fontSize="10"
          fill="var(--muted)"
          fontFamily="var(--font-mono, monospace)"
        >
          0 eV
        </text>
        <text x={width - padding.right} y={yZero + 16} textAnchor="end" fill="var(--muted)">
          outside the metal
        </text>

        {/* Bound electron energy level (-Phi) */}
        <line
          x1={padding.left + 30}
          y1={yWork}
          x2={width - padding.right - 30}
          y2={yWork}
          stroke="var(--accent)"
          strokeWidth="2"
        />
        <text
          x={padding.left - 8}
          y={yWork + 4}
          textAnchor="end"
          fontSize="10"
          fill="var(--accent)"
          fontFamily="var(--font-mono, monospace)"
        >
          −{workFunction.toFixed(2)} eV
        </text>
        <text x={width - padding.right - 30} y={yWork + 16} textAnchor="end" fill="var(--muted)">
          −&Phi;, an electron in the metal
        </text>

        {/* Photon excitation arrow */}
        <defs>
          <marker
            id="photon-arrow"
            viewBox="0 0 10 10"
            refX="6"
            refY="5"
            markerWidth="6"
            markerHeight="6"
            orient="auto-start-reverse"
          >
            <path d="M 0 0 L 10 5 L 0 10 z" fill={photonColour} />
          </marker>
        </defs>

        <line
          x1={width / 2 - 20}
          y1={yWork}
          x2={width / 2 - 20}
          y2={yPhoton}
          stroke={photonColour}
          strokeWidth="3"
          markerEnd="url(#photon-arrow)"
        />
        <text
          x={width / 2 - 28}
          y={(yWork + yPhoton) / 2}
          textAnchor="end"
          fontSize="11"
          fontWeight="600"
          fontFamily="var(--font-mono, monospace)"
          fill={photonColour}
        >
          {transferModel === "partial" ? "available " : "+"}h&nu; = {quantumEnergyEv.toFixed(2)} eV
        </text>

        {/* Emitted state or below threshold: the energy the first prompt asks about, so it waits. */}
        <g {...response}>
          {kineticEnergyStatus === "value" && kMaxEv !== null && kMaxEv >= 0 ? (
            <>
              <line
                x1={width / 2 + 10}
                y1={yZero}
                x2={width / 2 + 10}
                y2={yPhoton}
                stroke="var(--plot)"
                strokeWidth="2.5"
              />
              <circle cx={width / 2 + 10} cy={yPhoton} r="4" fill="var(--plot)" />
              <text
                x={width / 2 + 20}
                y={yPhoton + 4}
                textAnchor="start"
                fontSize="11"
                fill="var(--plot)"
                fontWeight="bold"
                fontFamily="var(--font-mono, monospace)"
              >
                K
                <tspan baselineShift="sub" fontSize="75%">
                  max
                </tspan>{" "}
                = {fixed(kMaxEv, 3)} eV
              </text>
            </>
          ) : kineticEnergyStatus === "underdetermined" && kMaxUpperBoundEv !== null ? (
            <g data-lq08-energy-bound data-upper-energy-ev={kMaxUpperBoundEv}>
              <rect
                x={width / 2 + 6}
                y={scaleY(kMaxUpperBoundEv)}
                width={10}
                height={scaleY(0) - scaleY(kMaxUpperBoundEv)}
                fill="var(--accent)"
                fillOpacity="0.15"
              />
              <line
                x1={width / 2 - 2}
                x2={width / 2 + 22}
                y1={scaleY(kMaxUpperBoundEv)}
                y2={scaleY(kMaxUpperBoundEv)}
                stroke="var(--accent)"
                strokeDasharray="4 3"
                strokeWidth="2"
              />
              <text x={width / 2 + 22} y={scaleY(kMaxUpperBoundEv) - 8} fill="var(--accent)">
                K
                <tspan baselineShift="sub" fontSize="75%">
                  max
                </tspan>{" "}
                ≤ {sentenceNumber(kMaxUpperBoundEv, 4)} eV
              </text>
            </g>
          ) : (
            <text
              x={width / 2 + 20}
              y={yPhoton + 4}
              textAnchor="start"
              fontSize="11"
              fill="var(--muted)"
              fontWeight="500"
            >
              {kineticEnergyStatus === "not-applicable"
                ? "hν < Φ: no electron escapes"
                : "Electron energy is not determined"}
            </text>
          )}
        </g>
      </svg>
    </div>
  );
}

const MEASURED_NOTE_STYLE = {
  marginTop: "0.5rem",
  fontSize: "var(--type-fine)",
  padding: "0.5rem",
  borderRadius: "0.25rem",
  border: "1px solid var(--line)",
  background: "var(--wash)",
  color: "var(--ink)",
} as const;

export type StoppingPlotProps = Readonly<{
  currentFrequency: number; // Hz, from the same accepted parameters as the budget
  budget: Lq08EnergyBudget | null;
  /** Dated measured points have their own scale; this plot is the accepted model calculation. */
  millikanData?: MillikanOverlayResult | undefined;
  response?: PredictResponse;
}>;

export function StoppingPotentialPlot({
  currentFrequency,
  budget,
  millikanData,
  response,
}: StoppingPlotProps) {
  if (!budget)
    return (
      <div data-view-id="lq-08-stopping-plot">
        <h3>Stopping potential against frequency</h3>
        <p className="fine" {...response}>
          The energy budget is available after the settings are accepted.
        </p>
      </div>
    );
  const partial = budget.transferModel === "partial";
  const { min, max } = budget.stoppingSweep.domain;
  const samples = budget.stoppingSweep.samples;
  const known = samples.flatMap((sample) =>
    sample.result.status === "value"
      ? [{ frequency: sample.frequency, value: sample.result.value }]
      : [],
  );
  const bounded = samples.flatMap((sample) =>
    sample.result.status === "underdetermined" && sample.result.bounds
      ? [
          {
            frequency: sample.frequency,
            lower: sample.result.bounds[0],
            upper: sample.result.bounds[1],
          },
        ]
      : [],
  );
  const width = 420;
  const height = 272;
  const padding = { top: 30, right: 30, bottom: 53, left: 65 };
  const maxV =
    Math.max(1, ...known.map((point) => point.value), ...bounded.map((point) => point.upper)) * 1.1;
  const scaleX = (frequency: number) =>
    padding.left + ((frequency - min) / (max - min)) * (width - padding.left - padding.right);
  const scaleY = (voltage: number) =>
    height - padding.bottom - (voltage / maxV) * (height - padding.top - padding.bottom);
  const line = (points: readonly { frequency: number; value: number }[]) =>
    points
      .map(
        (point, index) =>
          `${index === 0 ? "M" : "L"} ${scaleX(point.frequency)} ${scaleY(point.value)}`,
      )
      .join(" ");
  const upperPoints = bounded.map((point) => ({ frequency: point.frequency, value: point.upper }));
  const lowerPoints = [...bounded]
    .reverse()
    .map((point) => ({ frequency: point.frequency, value: point.lower }));
  const current = budget.stoppingPotentialMagnitude;

  return (
    <div
      data-view-id="lq-08-stopping-plot"
      data-transfer-model={budget.transferModel}
      data-instance-id={budget.instanceId}
      data-run-id={budget.runId}
      data-snapshot-version={budget.snapshotVersion}
      data-action-index={budget.actionIndex}
      style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}
    >
      <h3
        style={{
          margin: "0 0 0.25rem",
          fontSize: "0.875rem",
          fontWeight: 600,
          color: "var(--ink)",
        }}
      >
        {partial
          ? "Stopping-potential upper limit against frequency"
          : "Stopping potential against frequency"}
      </h3>
      <p {...response} className="fine" data-lq08-stopping-explanation>
        {partial
          ? "The dashed boundary gives an upper limit. Shading shows allowed stopping magnitudes; the actual stopping curve is undetermined when the transferred share is unknown."
          : "In the model the slope is h/e for every metal, under the complete-transfer assumption."}
      </p>
      <svg
        viewBox={`0 0 ${width} ${height}`}
        role="img"
        aria-label={
          partial
            ? "Upper limits on stopping potential versus optical frequency"
            : "Plot of stopping potential versus optical frequency"
        }
        style={{
          width: "100%",
          height: "auto",
          background: "var(--panel)",
          border: "1px solid var(--line)",
          borderRadius: "0.25rem",
        }}
      >
        <AwaitingNote placeholder={placeholderOf(response)} x={210} y={120} />
        <line
          x1={padding.left}
          y1={scaleY(0)}
          x2={width - padding.right}
          y2={scaleY(0)}
          stroke="var(--line)"
          strokeWidth="1.5"
        />
        <line
          x1={padding.left}
          y1={padding.top}
          x2={padding.left}
          y2={scaleY(0)}
          stroke="var(--line)"
          strokeWidth="1.5"
        />
        {[0, 1, 2, 3, 4].map((index) => {
          const frequency = min + ((max - min) * index) / 4;
          return (
            <g key={frequency}>
              <line
                x1={scaleX(frequency)}
                y1={scaleY(0)}
                x2={scaleX(frequency)}
                y2={scaleY(0) + 4}
                stroke="var(--line)"
              />
              <text
                x={scaleX(frequency)}
                y={scaleY(0) + 22}
                textAnchor="middle"
                fill="var(--muted)"
              >
                {fixed(frequency / 1e12, 1)}
              </text>
            </g>
          );
        })}
        <text x={width / 2} y={height - 5} textAnchor="middle" fill="var(--ink)">
          Frequency ν (THz)
        </text>
        {[0, 1, 2, 3].map((index) => {
          const voltage = (maxV * index) / 3;
          return (
            <text
              key={voltage}
              x={padding.left - 8}
              y={scaleY(voltage) + 3}
              textAnchor="end"
              fill="var(--muted)"
            >
              {fixed(voltage, 2)}
            </text>
          );
        })}
        <text
          x={18}
          y={height / 2}
          textAnchor="middle"
          transform={`rotate(-90 18 ${height / 2})`}
          fill="var(--ink)"
        >
          {partial ? "Upper limit (V)" : "Stopping potential (V)"}
        </text>
        <g {...response} data-lq08-stopping-response>
          {known.length > 0 && (
            <path
              data-lq08-stopping-values
              d={line(known)}
              fill="none"
              stroke="var(--plot)"
              strokeWidth="2.5"
            />
          )}
          {bounded.length > 0 && (
            <>
              <path
                data-lq08-stopping-band
                d={`${line(upperPoints)} ${line(lowerPoints).replace(/^M/, "L")} Z`}
                fill="var(--accent)"
                fillOpacity="0.12"
                stroke="none"
              />
              <path
                data-lq08-stopping-ceiling
                d={line(upperPoints)}
                fill="none"
                stroke="var(--accent)"
                strokeWidth="2.5"
                strokeDasharray="5 3"
              />
            </>
          )}
          {current.status === "value" && (
            <circle
              data-lq08-stopping-point
              data-voltage={current.value}
              cx={scaleX(currentFrequency)}
              cy={scaleY(current.value)}
              r="5"
              fill="var(--plot)"
              stroke="var(--panel)"
              strokeWidth="1.5"
            />
          )}
          {current.status === "underdetermined" && current.bounds && (
            <g
              data-lq08-stopping-range
              data-lower-voltage={current.bounds[0]}
              data-upper-voltage={current.bounds[1]}
              stroke="var(--accent)"
              strokeWidth="3"
            >
              <line
                x1={scaleX(currentFrequency)}
                x2={scaleX(currentFrequency)}
                y1={scaleY(current.bounds[0])}
                y2={scaleY(current.bounds[1])}
              />
              {[
                { side: "lower", value: current.bounds[0] },
                { side: "upper", value: current.bounds[1] },
              ].map((bound) => (
                <line
                  key={bound.side}
                  x1={scaleX(currentFrequency) - 5}
                  x2={scaleX(currentFrequency) + 5}
                  y1={scaleY(bound.value)}
                  y2={scaleY(bound.value)}
                />
              ))}
            </g>
          )}
        </g>
      </svg>
      <details {...response} data-lq08-stopping-table>
        <summary>Inspect the accepted frequency sweep</summary>
        <div className="table-scroll">
          <table className="data-table" aria-label="Accepted stopping-potential frequency sweep">
            <thead>
              <tr>
                <th scope="col">Frequency (THz)</th>
                <th scope="col">Stopping potential or bound (V)</th>
              </tr>
            </thead>
            <tbody>
              {samples.map((sample) => (
                <tr key={sample.frequency} data-lq08-stopping-frequency={sample.frequency}>
                  <th scope="row">{sentenceNumber(sample.frequency / 1e12, 6)}</th>
                  <td data-result-status={sample.result.status}>
                    {sample.result.status === "value" ? (
                      <Sci value={sample.result.value} digits={3} />
                    ) : sample.result.status === "underdetermined" &&
                      sample.result.upperBound !== undefined ? (
                      <>
                        At most <Sci value={sample.result.upperBound} digits={3} />; actual value
                        undetermined.
                      </>
                    ) : (
                      sample.result.reason
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </details>
      {millikanData?.kind === "withheld" && (
        <div style={MEASURED_NOTE_STYLE} data-testid="millikan-withheld">
          <p style={{ fontWeight: 600, margin: "0 0 0.25rem" }}>
            Millikan’s 1916 sodium measurements are not shown yet.
          </p>
          <p className="fine" style={{ margin: "0 0 0.25rem" }}>
            {millikanData.reason}
          </p>
          <p className="fine" style={{ margin: 0 }}>
            {millikanData.citation}
          </p>
        </div>
      )}
    </div>
  );
}

export type CurrentVoltageProps = Readonly<{
  /** Currents, interval bounds and segment endpoints all belong to this accepted owner view. */
  sweep: Lq08CollectorSweep | null;
  response?: PredictResponse;
}>;

type SweepResult = Lq08CollectorSweep["operatingPoint"]["result"];

function CurrentReading({ result }: { result: SweepResult }) {
  if (result.status === "value") {
    return (
      <>
        <Sci value={result.value * 1e6} digits={3} /> μA
      </>
    );
  }
  if (result.status === "underdetermined" && result.bounds) {
    return (
      <>
        Between <Sci value={result.bounds[0] * 1e6} digits={3} /> and{" "}
        <Sci value={result.bounds[1] * 1e6} digits={3} /> μA; the current is not determined.
      </>
    );
  }
  return <>{result.reason ?? "The current is not available for these settings."}</>;
}

const DISTRIBUTION_EXPLANATIONS = {
  none: "No energy distribution is assumed. In the partly retarding region, shading marks the allowed current range and assigns no probability to values within it.",
  "all-at-kmax":
    "Every emitted electron is assumed to have the largest allowed energy. The ideal current jumps at the retarding cutoff; an open endpoint marks a limiting value and a filled endpoint marks the value at the cutoff.",
  uniform:
    "Emitted energies are assumed to be uniformly spread from zero to the largest allowed energy. For a nonzero energy range, the partly retarded current rises linearly toward full collection.",
} as const;

export function CurrentVoltagePlot({ sweep, response }: CurrentVoltageProps) {
  const width = 420;
  const height = 270;
  const padding = { top: 35, right: 28, bottom: 48, left: 80 };
  if (!sweep) {
    return (
      <div data-view-id="lq-08-iv-curve">
        <h3>Current against collector potential</h3>
        <p className="fine" {...response}>
          A collector sweep is available after the apparatus accepts its settings.
        </p>
      </div>
    );
  }

  const { min: minU, max: maxU } = sweep.domain;
  // Display scaling only: the owner supplies every current, limit and potential endpoint.
  const maxI = sweep.saturationCurrent > 0 ? sweep.saturationCurrent * 1.25 : 1e-6;
  const scaleX = (potential: number) =>
    padding.left + ((potential - minU) / (maxU - minU)) * (width - padding.left - padding.right);
  const scaleY = (current: number) =>
    height - padding.bottom - (current / maxI) * (height - padding.top - padding.bottom);
  const yZero = scaleY(0);
  const operating = sweep.operatingPoint;
  const xOperating = scaleX(operating.collectorPotential);

  return (
    <div
      data-view-id="lq-08-iv-curve"
      data-distribution-model={sweep.distributionModel}
      data-transfer-model={sweep.transferModel}
      data-instance-id={sweep.instanceId}
      data-run-id={sweep.runId}
      data-snapshot-version={sweep.snapshotVersion}
      data-action-index={sweep.actionIndex}
      data-owner-id={sweep.ownerId}
      data-constant-set-id={sweep.constantSetId}
      data-domain-min={minU}
      data-domain-max={maxU}
      style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}
    >
      <h3
        style={{
          margin: "0 0 0.25rem",
          fontSize: "0.875rem",
          fontWeight: 600,
          color: "var(--ink)",
        }}
      >
        Current against collector potential
      </h3>
      <p {...response} className="fine" data-lq08-distribution-explanation>
        {sweep.transferModel === "partial"
          ? "The transferred share is unknown. Even with an electron-energy distribution selected, the partly retarded current is only bounded. Saturation uses the separately prescribed ideal emission yield."
          : DISTRIBUTION_EXPLANATIONS[sweep.distributionModel]}{" "}
        These teaching assumptions do not establish a universal current–voltage curve for real
        materials.
      </p>
      <p {...response} className="fine" data-lq08-operating-reading>
        At collector potential {sentenceNumber(operating.collectorPotential, 6)} V:{" "}
        <span data-lq08-current-status={operating.result.status}>
          <CurrentReading result={operating.result} />
        </span>{" "}
        With full collection, the accepted saturation current is{" "}
        <Sci value={sweep.saturationCurrent * 1e6} digits={3} /> μA.
      </p>
      <svg
        viewBox={`0 0 ${width} ${height}`}
        role="img"
        aria-label="Current against collector potential. Lines show determined currents; shading shows allowed currents when the assumptions leave the current undetermined."
        style={{
          width: "100%",
          height: "auto",
          background: "var(--panel)",
          border: "1px solid var(--line)",
          borderRadius: "0.25rem",
        }}
      >
        <AwaitingNote placeholder={placeholderOf(response)} x={210} y={110} />
        <line
          x1={padding.left}
          y1={yZero}
          x2={width - padding.right}
          y2={yZero}
          stroke="var(--line)"
          strokeWidth="1.5"
        />
        <line
          x1={scaleX(0)}
          y1={padding.top}
          x2={scaleX(0)}
          y2={yZero}
          stroke="var(--line)"
          strokeWidth="1"
          strokeDasharray="2 2"
        />
        {[minU, minU / 2, 0, maxU / 2, maxU].map((potential) => (
          <g key={potential}>
            <line
              x1={scaleX(potential)}
              y1={yZero}
              x2={scaleX(potential)}
              y2={yZero + 4}
              stroke="var(--line)"
            />
            <text
              x={scaleX(potential)}
              y={yZero + 19}
              textAnchor="middle"
              fill="var(--muted)"
              fontFamily="var(--font-mono, monospace)"
            >
              {potential > 0 ? "+" : ""}
              {fixed(potential, 2)}
            </text>
          </g>
        ))}
        <text x={width / 2} y={height - 7} textAnchor="middle" fill="var(--ink)" fontWeight="500">
          Collector potential (V)
        </text>
        <text
          x={18}
          y={height / 2}
          textAnchor="middle"
          transform={`rotate(-90 18 ${height / 2})`}
          fill="var(--ink)"
          fontWeight="500"
        >
          Current I (μA)
        </text>
        <text x={padding.left - 8} y={yZero + 4} textAnchor="end" fill="var(--muted)">
          0
        </text>
        <g {...response} data-lq08-current-response>
          {sweep.saturationCurrent > 0 && (
            <text
              x={padding.left - 8}
              y={scaleY(sweep.saturationCurrent) + 4}
              textAnchor="end"
              fill="var(--muted)"
            >
              <SciSvg value={sweep.saturationCurrent * 1e6} digits={2} />
            </text>
          )}
          {sweep.underdetermined.map((region) => (
            <rect
              key={`${region.minPotential}:${region.maxPotential}`}
              data-lq08-current-band
              data-min-potential={region.minPotential}
              data-max-potential={region.maxPotential}
              data-min-included={region.includeMin}
              data-max-included={region.includeMax}
              data-lower-current={region.lowerCurrent}
              data-upper-current={region.upperCurrent}
              x={scaleX(region.minPotential)}
              y={scaleY(region.upperCurrent)}
              width={scaleX(region.maxPotential) - scaleX(region.minPotential)}
              height={scaleY(region.lowerCurrent) - scaleY(region.upperCurrent)}
              fill="var(--accent)"
              fillOpacity="0.12"
              stroke="var(--accent)"
              strokeDasharray="4 3"
            />
          ))}
          {sweep.segments.map((segment) => {
            const start = segment.points[0];
            const end = segment.points.at(-1);
            if (!start || !end) return null;
            return (
              <g key={`${start.collectorPotential}:${end.collectorPotential}`}>
                <path
                  data-lq08-current-segment
                  data-start-potential={start.collectorPotential}
                  data-end-potential={end.collectorPotential}
                  data-start-included={segment.startIncluded}
                  data-end-included={segment.endIncluded}
                  d={segment.points
                    .map(
                      (point, index) =>
                        `${index === 0 ? "M" : "L"} ${scaleX(point.collectorPotential)} ${scaleY(point.current)}`,
                    )
                    .join(" ")}
                  fill="none"
                  stroke="var(--plot)"
                  strokeWidth="2.5"
                />
                {[
                  { side: "start", point: start, included: segment.startIncluded },
                  { side: "end", point: end, included: segment.endIncluded },
                ].map(({ side, point, included }) => (
                  <circle
                    key={side}
                    data-lq08-segment-endpoint={side}
                    data-endpoint-included={included}
                    data-collector-potential={point.collectorPotential}
                    data-current-amperes={point.current}
                    cx={scaleX(point.collectorPotential)}
                    cy={scaleY(point.current)}
                    r="3.5"
                    fill={included ? "var(--plot)" : "var(--panel)"}
                    stroke="var(--plot)"
                    strokeWidth="1.5"
                  />
                ))}
              </g>
            );
          })}
          {operating.result.status === "value" && (
            <circle
              data-lq08-operating-point
              data-collector-potential={operating.collectorPotential}
              data-current-amperes={operating.result.value}
              cx={xOperating}
              cy={scaleY(operating.result.value)}
              r="5"
              fill="var(--accent)"
              stroke="var(--panel)"
              strokeWidth="1.5"
            />
          )}
          {operating.result.status === "underdetermined" && operating.result.bounds && (
            <g
              data-lq08-operating-range
              data-collector-potential={operating.collectorPotential}
              data-lower-current={operating.result.bounds[0]}
              data-upper-current={operating.result.bounds[1]}
              stroke="var(--accent)"
              strokeWidth="3"
            >
              <line
                x1={xOperating}
                x2={xOperating}
                y1={scaleY(operating.result.bounds[0])}
                y2={scaleY(operating.result.bounds[1])}
              />
              {operating.result.bounds.map((current) => (
                <line
                  key={current}
                  x1={xOperating - 5}
                  x2={xOperating + 5}
                  y1={scaleY(current)}
                  y2={scaleY(current)}
                />
              ))}
            </g>
          )}
        </g>
      </svg>
      <details {...response} data-lq08-sweep-table>
        <summary>Inspect the accepted collector sweep</summary>
        <p className="fine">
          Every row uses the same accepted settings and declared electron energies. Potentials below
          zero retard the emitted electrons; potentials above zero collect all emitted electrons in
          this ideal apparatus.
        </p>
        <div className="table-scroll">
          <table className="data-table" aria-label="Accepted collector sweep">
            <thead>
              <tr>
                <th scope="col">Collector potential (V)</th>
                <th scope="col">Current (μA)</th>
              </tr>
            </thead>
            <tbody>
              {sweep.samples.map((sample) => (
                <tr
                  key={sample.collectorPotential}
                  data-lq08-sweep-potential={sample.collectorPotential}
                >
                  <th scope="row">{sentenceNumber(sample.collectorPotential, 6)}</th>
                  <td data-lq08-current-status={sample.result.status}>
                    <CurrentReading result={sample.result} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </details>
    </div>
  );
}
