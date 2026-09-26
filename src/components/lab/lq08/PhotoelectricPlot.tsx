import type { MillikanOverlayResult } from "../../../experiments/lq08/millikan.ts";
import { visibleColor } from "../../../experiments/lq08/session.ts";
import { fixed } from "../presentation.ts";
import { Sci, SubSvg } from "../Sci.tsx";

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
  collectorPotential: number; // V
  stoppingPotential: number | null; // V
  saturationCurrentMicroAmps: number; // uA
  currentAtOperatingPoint: number | null; // uA or null if underdetermined
  response?: PredictResponse;
}>;

export function CurrentVoltagePlot({
  collectorPotential,
  stoppingPotential,
  saturationCurrentMicroAmps,
  currentAtOperatingPoint,
  response,
}: CurrentVoltageProps) {
  const width = 380;
  const height = 220;
  const padding = { top: 25, right: 30, bottom: 40, left: 60 };

  const minU = -3.0;
  const maxU = 3.0;
  const maxI = Math.max(10, saturationCurrentMicroAmps * 1.3);

  const scaleX = (u: number) =>
    padding.left + ((u - minU) / (maxU - minU)) * (width - padding.left - padding.right);
  const scaleY = (i: number) =>
    height - padding.bottom - (i / maxI) * (height - padding.top - padding.bottom);

  const vs = stoppingPotential ?? 0;
  const xZero = scaleX(0);
  const xCutoff = scaleX(-vs);
  const ySat = scaleY(saturationCurrentMicroAmps);
  const yZeroI = scaleY(0);

  return (
    <div
      data-view-id="lq-08-iv-curve"
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
        Current against collector potential
      </h3>
      <p {...response} className="fine" style={{ margin: "0 0 0.5rem" }}>
        Saturation current{" "}
        <span style={{ fontFamily: "var(--font-mono, monospace)" }}>
          I<sub>sat</sub> = {saturationCurrentMicroAmps.toFixed(2)} &mu;A
        </span>
      </p>
      <svg
        viewBox={`0 0 ${width} ${height}`}
        role="img"
        aria-label="Current-voltage characteristic curve showing saturation and retarding cutoff"
        style={{
          width: "100%",
          height: "auto",
          background: "var(--panel)",
          border: "1px solid var(--line)",
          borderRadius: "0.25rem",
        }}
      >
        {/* Axes */}
        <line
          x1={padding.left}
          y1={yZeroI}
          x2={width - padding.right}
          y2={yZeroI}
          stroke="var(--line)"
          strokeWidth="1.5"
        />
        <line
          x1={xZero}
          y1={padding.top}
          x2={xZero}
          y2={height - padding.bottom}
          stroke="var(--line)"
          strokeWidth="1"
          strokeDasharray="2 2"
        />

        {/* X Ticks & Labels */}
        {[-3, -2, -1, 0, 1, 2, 3].map((u) => {
          const x = scaleX(u);
          return (
            <g key={u}>
              <line
                x1={x}
                y1={height - padding.bottom}
                x2={x}
                y2={height - padding.bottom + 4}
                stroke="var(--line)"
              />
              <text
                x={x}
                y={height - padding.bottom + 16}
                textAnchor="middle"
                fontSize="10"
                fill="var(--muted)"
                fontFamily="var(--font-mono, monospace)"
              >
                {u > 0 ? `+${u}` : u}
              </text>
            </g>
          );
        })}
        <text
          x={width / 2}
          y={height - 6}
          textAnchor="middle"
          fontSize="11"
          fill="var(--ink)"
          fontWeight="500"
        >
          Collector potential (V)
        </text>

        {/* Y Axis Label */}
        <text
          x={16}
          y={height / 2}
          textAnchor="middle"
          transform={`rotate(-90 16 ${height / 2})`}
          fontSize="11"
          fill="var(--ink)"
          fontWeight="500"
        >
          Current I (&mu;A)
        </text>

        {/* Curve Segments, the stopping mark and the operating point: they show how the fastest
            electrons' energy and the current respond, so they wait. The axes stay. */}
        <g {...response}>
          {/* 1. Full cutoff U_c <= -Vs */}
          <line
            x1={padding.left}
            y1={yZeroI}
            x2={Math.min(xZero, Math.max(padding.left, xCutoff))}
            y2={yZeroI}
            stroke="var(--plot)"
            strokeWidth="2.5"
          />

          {/* 2. Underdetermined intermediate regime -Vs < U_c < 0 (dashed) */}
          {vs > 0 && (
            <path
              d={`M ${Math.max(padding.left, xCutoff)} ${yZeroI} Q ${(Math.max(padding.left, xCutoff) + xZero) / 2} ${yZeroI} ${xZero} ${ySat}`}
              fill="none"
              stroke="var(--accent)"
              strokeWidth="2"
              strokeDasharray="4 3"
            />
          )}

          {/* 3. Saturation regime U_c >= 0 */}
          <line
            x1={xZero}
            y1={ySat}
            x2={width - padding.right}
            y2={ySat}
            stroke="var(--plot)"
            strokeWidth="2.5"
          />

          {/* Stopping potential mark */}
          {vs > 0 && (
            <g>
              <circle cx={xCutoff} cy={yZeroI} r="4" fill="var(--accent)" />
              <text
                x={xCutoff}
                y={yZeroI - 8}
                textAnchor="middle"
                fontSize="10"
                fill="var(--accent)"
                fontFamily="var(--font-mono, monospace)"
                fontWeight="600"
              >
                −V<SubSvg>s</SubSvg> = −{vs.toFixed(2)} V
              </text>
            </g>
          )}

          {/* Operating Point */}
          {collectorPotential >= minU && collectorPotential <= maxU && (
            <circle
              cx={scaleX(collectorPotential)}
              cy={
                currentAtOperatingPoint !== null
                  ? scaleY(currentAtOperatingPoint)
                  : collectorPotential >= 0
                    ? ySat
                    : collectorPotential <= -vs
                      ? yZeroI
                      : (ySat + yZeroI) / 2
              }
              r="5"
              fill="var(--plot)"
              stroke="var(--panel)"
              strokeWidth="1.5"
            />
          )}
        </g>
      </svg>
    </div>
  );
}
