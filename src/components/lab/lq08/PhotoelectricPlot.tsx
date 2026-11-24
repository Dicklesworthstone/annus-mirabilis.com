import type { Lq08CollectorSweep } from "../../../experiments/lq08/collectorSweep.ts";
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
  kMaxEv: number | null; // eV or null if sub-threshold
  thresholdFrequency: number; // Hz
  response?: PredictResponse;
}>;

export function EnergyLadderPlot({
  frequency,
  workFunction,
  quantumEnergyEv,
  kMaxEv,
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
        Where one quantum’s energy goes
      </h3>
      <p className="fine" style={{ margin: "0 0 0.5rem" }}>
        <span style={{ fontFamily: "var(--font-mono, monospace)" }}>
          h&nu; = {fixed(quantumEnergyEv, 3)} eV
        </span>
        , &Phi; ={" "}
        <span style={{ fontFamily: "var(--font-mono, monospace)" }}>
          {workFunction.toFixed(2)} eV
        </span>{" "}
        , threshold &nu;<sub>0</sub> ={" "}
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
          +h&nu; = {quantumEnergyEv.toFixed(2)} eV
        </text>

        {/* Emitted state or below threshold: the energy the first prompt asks about, so it waits. */}
        <g {...response}>
          {kMaxEv !== null && kMaxEv >= 0 ? (
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
          ) : (
            <text
              x={width / 2 + 20}
              y={yPhoton + 4}
              textAnchor="start"
              fontSize="11"
              fill="var(--muted)"
              fontWeight="500"
            >
              h&nu; &lt; &Phi;: no electron escapes
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
  currentFrequency: number; // Hz
  currentWorkFunction: number; // eV
  currentStoppingPotential: number | null; // V
  /**
   * Built on the server from the record's plot verdict. Only a withheld result is noted here; a
   * plottable one is drawn on its own scale by MillikanFigure6Panel, never on this model's axis.
   */
  millikanData?: MillikanOverlayResult | undefined;
  response?: PredictResponse;
}>;

export function StoppingPotentialPlot({
  currentFrequency,
  currentWorkFunction,
  currentStoppingPotential,
  millikanData,
  response,
}: StoppingPlotProps) {
  const width = 420;
  // 272 tall with a 53-unit bottom margin (it was 260 and 45). At the lab's SVG text size (15.84
  // units, a 21-unit line box) the "400" tick's box met the "0.0" tick's in the corner by 9 × 5
  // units; the tick labels are lowered 6 units and the title keeps its room below them.
  const height = 272;
  const padding = { top: 30, right: 30, bottom: 53, left: 65 };

  // Frequency range: 400 THz to 1200 THz (0.4 to 1.2 PHz)
  const minNu = 4.0e14;
  const maxNu = 1.2e15;
  const minV = 0.0;
  const maxV = 3.5;

  const scaleX = (nu: number) =>
    padding.left + ((nu - minNu) / (maxNu - minNu)) * (width - padding.left - padding.right);
  const scaleY = (v: number) =>
    height -
    padding.bottom -
    ((v - minV) / (maxV - minV)) * (height - padding.top - padding.bottom);

  // Theoretical line: V_s = (h/e)*nu - Phi
  const hOverE = 4.135667696e-15; // V s
  const nu0 = currentWorkFunction / hOverE; // Hz
  const xStartNu = Math.max(minNu, nu0);
  const x1 = scaleX(xStartNu);
  const y1 = scaleY(Math.max(0, hOverE * xStartNu - currentWorkFunction));
  const x2 = scaleX(maxNu);
  const y2 = scaleY(Math.max(0, hOverE * maxNu - currentWorkFunction));

  return (
    <div
      data-view-id="lq-08-stopping-plot"
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
        Stopping potential against frequency
      </h3>
      {/* The slope for every metal is the third prompt's answer, so the sentence waits. */}
      <p {...response} className="fine" style={{ margin: "0 0 0.5rem" }}>
        In the model the slope is h/e = <Sci value={4.1357e-15} digits={3} /> V&middot;s for every
        metal.
      </p>
      <svg
        viewBox={`0 0 ${width} ${height}`}
        role="img"
        aria-label="Plot of stopping potential versus optical frequency"
        style={{
          width: "100%",
          height: "auto",
          background: "var(--panel)",
          border: "1px solid var(--line)",
          borderRadius: "0.25rem",
        }}
      >
        <AwaitingNote placeholder={placeholderOf(response)} x={210} y={120} />
        {/* Axes */}
        <line
          x1={padding.left}
          y1={height - padding.bottom}
          x2={width - padding.right}
          y2={height - padding.bottom}
          stroke="var(--line)"
          strokeWidth="1.5"
        />
        <line
          x1={padding.left}
          y1={padding.top}
          x2={padding.left}
          y2={height - padding.bottom}
          stroke="var(--line)"
          strokeWidth="1.5"
        />

        {/* X Ticks & Labels (Frequency in THz) */}
        {[400, 600, 800, 1000, 1200].map((thz) => {
          const x = scaleX(thz * 1e12);
          return (
            <g key={thz}>
              <line
                x1={x}
                y1={height - padding.bottom}
                x2={x}
                y2={height - padding.bottom + 4}
                stroke="var(--line)"
              />
              <text
                x={x}
                y={height - padding.bottom + 22}
                textAnchor="middle"
                fontSize="10"
                fill="var(--muted)"
                fontFamily="var(--font-mono, monospace)"
              >
                {thz}
              </text>
            </g>
          );
        })}
        <text
          x={width / 2}
          y={height - 5}
          textAnchor="middle"
          fontSize="11"
          fill="var(--ink)"
          fontWeight="500"
        >
          Frequency &nu; (THz)
        </text>

        {/* Y Ticks & Labels (Stopping Potential in V) */}
        {[0, 1, 2, 3].map((v) => {
          const y = scaleY(v);
          return (
            <g key={v}>
              <line x1={padding.left - 4} y1={y} x2={padding.left} y2={y} stroke="var(--line)" />
              <text
                x={padding.left - 8}
                y={y + 3}
                textAnchor="end"
                fontSize="10"
                fill="var(--muted)"
                fontFamily="var(--font-mono, monospace)"
              >
                {v.toFixed(1)}
              </text>
            </g>
          );
        })}
        <text
          x={18}
          y={height / 2}
          textAnchor="middle"
          transform={`rotate(-90 18 ${height / 2})`}
          fontSize="11"
          fill="var(--ink)"
          fontWeight="500"
        >
          Stopping potential (V)
        </text>

        {/* Theoretical line */}
        {xStartNu < maxNu && (
          <line
            {...response}
            x1={x1}
            y1={y1}
            x2={x2}
            y2={y2}
            stroke="var(--plot)"
            strokeWidth="2.5"
          />
        )}

        {/* Threshold frequency vertical dashed mark */}
        {nu0 >= minNu && nu0 <= maxNu && (
          <g>
            <line
              x1={scaleX(nu0)}
              y1={padding.top}
              x2={scaleX(nu0)}
              y2={height - padding.bottom}
              stroke="var(--accent)"
              strokeDasharray="3 3"
              strokeWidth="1.5"
            />
            <text
              x={scaleX(nu0)}
              y={padding.top - 6}
              textAnchor="middle"
              fontSize="10"
              fill="var(--accent)"
              fontFamily="var(--font-mono, monospace)"
              fontWeight="600"
            >
              &nu;₀ = {(nu0 / 1e12).toFixed(1)} THz
            </text>
          </g>
        )}

        {/* Current Operating Point */}
        {currentStoppingPotential !== null &&
          currentFrequency >= minNu &&
          currentFrequency <= maxNu && (
            <g {...response}>
              <circle
                cx={scaleX(currentFrequency)}
                cy={scaleY(currentStoppingPotential)}
                r="6"
                fill="var(--plot)"
                stroke="var(--panel)"
                strokeWidth="2"
              />
            </g>
          )}
      </svg>
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
        {DISTRIBUTION_EXPLANATIONS[sweep.distributionModel]} These teaching assumptions do not
        establish a universal current–voltage curve for real materials.
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
        aria-label="Current against collector potential. Lines show determined currents; shading shows allowed currents when the distribution is unknown."
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
