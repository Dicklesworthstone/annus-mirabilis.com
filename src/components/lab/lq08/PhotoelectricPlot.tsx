import type { MillikanOverlayResult } from "../../../experiments/lq08/millikan.ts";
import { visibleColor } from "../../../experiments/lq08/session.ts";

export type EnergyLadderProps = Readonly<{
  frequency: number; // Hz
  workFunction: number; // eV
  quantumEnergyEv: number; // eV
  kMaxEv: number | null; // eV or null if sub-threshold
  thresholdFrequency: number; // Hz
}>;

export function EnergyLadderPlot({
  frequency,
  workFunction,
  quantumEnergyEv,
  kMaxEv,
  thresholdFrequency,
}: EnergyLadderProps) {
  const width = 360;
  const height = 240;
  const padding = { top: 30, right: 30, bottom: 40, left: 60 };

  const maxEnergy = Math.max(6.0, quantumEnergyEv * 1.25, workFunction * 1.25);
  const scaleY = (ev: number) => {
    const clamped = Math.max(-1, Math.min(maxEnergy, ev));
    return (
      height -
      padding.bottom -
      ((clamped + 1) / (maxEnergy + 1)) * (height - padding.top - padding.bottom)
    );
  };

  const yZero = scaleY(0);
  const yWork = scaleY(-workFunction);
  const yPhoton = scaleY(-workFunction + quantumEnergyEv);
  const col = visibleColor(frequency);

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
        Single-quantum energy conservation ladder
      </h3>
      <p className="fine" style={{ margin: "0 0 0.5rem" }}>
        <span style={{ fontFamily: "var(--font-mono, monospace)" }}>
          h&nu; = {quantumEnergyEv.toFixed(3)} eV
        </span>{" "}
        | &Phi; ={" "}
        <span style={{ fontFamily: "var(--font-mono, monospace)" }}>
          {workFunction.toFixed(2)} eV
        </span>{" "}
        (&nu;_0 ={" "}
        <span style={{ fontFamily: "var(--font-mono, monospace)" }}>
          {(thresholdFrequency / 1e12).toFixed(1)} THz
        </span>
        )
      </p>
      <svg
        viewBox={`0 0 ${width} ${height}`}
        role="img"
        aria-label={`Energy ladder diagram showing photon energy ${quantumEnergyEv.toFixed(2)} eV and work function ${workFunction.toFixed(2)} eV`}
        style={{
          width: "100%",
          height: "auto",
          background: "var(--panel)",
          border: "1px solid var(--line)",
          borderRadius: "0.25rem",
        }}
      >
        {/* Zero energy reference line (Vacuum level) */}
        <line
          x1={padding.left}
          y1={yZero}
          x2={width - padding.right}
          y2={yZero}
          stroke="var(--line)"
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
          0 eV (Vacuum)
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
          -&Phi; (-{workFunction.toFixed(2)} eV)
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
            <path d="M 0 0 L 10 5 L 0 10 z" fill={col.hexColor} />
          </marker>
        </defs>

        <line
          x1={width / 2 - 20}
          y1={yWork}
          x2={width / 2 - 20}
          y2={yPhoton}
          stroke={col.hexColor}
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
          fill={col.hexColor}
        >
          +h&nu; ({quantumEnergyEv.toFixed(2)} eV)
        </text>

        {/* Emitted state or below threshold */}
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
              K_max = {kMaxEv.toFixed(3)} eV
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
            Sub-threshold (h&nu; &lt; &Phi;)
          </text>
        )}
      </svg>
    </div>
  );
}

export type StoppingPlotProps = Readonly<{
  currentFrequency: number; // Hz
  currentWorkFunction: number; // eV
  currentStoppingPotential: number | null; // V
  millikanOverlay: boolean;
  millikanData?: MillikanOverlayResult;
}>;

export function StoppingPotentialPlot({
  currentFrequency,
  currentWorkFunction,
  currentStoppingPotential,
  millikanOverlay,
  millikanData,
}: StoppingPlotProps) {
  const width = 420;
  const height = 260;
  const padding = { top: 30, right: 30, bottom: 45, left: 65 };

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
        Stopping Potential vs. Light Frequency: V_s(&nu;)
      </h3>
      <p className="fine" style={{ margin: "0 0 0.5rem" }}>
        Universal theoretical slope{" "}
        <span style={{ fontFamily: "var(--font-mono, monospace)" }}>
          h/e = 4.136 &times; 10^-15 V&middot;s
        </span>
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
                y={height - padding.bottom + 16}
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
          y={height - 8}
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
          x={14}
          y={height / 2}
          textAnchor="middle"
          transform={`rotate(-90 14 ${height / 2})`}
          fontSize="11"
          fill="var(--ink)"
          fontWeight="500"
        >
          Stopping Potential V_s (Volts)
        </text>

        {/* Theoretical line */}
        {xStartNu < maxNu && (
          <line x1={x1} y1={y1} x2={x2} y2={y2} stroke="var(--plot)" strokeWidth="2.5" />
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
              &nu;_0 = {(nu0 / 1e12).toFixed(1)} THz
            </text>
          </g>
        )}

        {/* Millikan 1916 Data Points Overlay */}
        {millikanOverlay && millikanData?.dataset?.points && (
          <g data-testid="millikan-dataset">
            {millikanData.dataset.points.map((pt) => {
              const cx = scaleX(pt.frequencyHz);
              const cy = scaleY(pt.stoppingPotentialVolts);
              return (
                <g key={pt.frequencyHz}>
                  <circle
                    cx={cx}
                    cy={cy}
                    r="4"
                    fill="var(--accent)"
                    stroke="var(--panel)"
                    strokeWidth="1"
                  />
                </g>
              );
            })}
          </g>
        )}

        {/* Current Operating Point */}
        {currentStoppingPotential !== null &&
          currentFrequency >= minNu &&
          currentFrequency <= maxNu && (
            <g>
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
      {millikanOverlay && millikanData && (
        <div
          style={{
            marginTop: "0.5rem",
            fontSize: "0.75rem",
            padding: "0.5rem",
            borderRadius: "0.25rem",
            border: "1px solid var(--line)",
            background: "var(--wash)",
            color: "var(--ink)",
          }}
        >
          <p style={{ fontWeight: 600, margin: "0 0 0.25rem" }}>
            Historical Validation: Millikan (1916) Sodium
          </p>
          <p
            className="fine"
            style={{
              margin: 0,
              fontFamily: "var(--font-mono, monospace)",
              fontSize: "0.6875rem",
            }}
          >
            Empirical Fit Slope: {millikanData.fittedSlopeVs.toExponential(4)} V&middot;s &plusmn;{" "}
            {millikanData.fittedSlopeStdErr.toExponential(2)} | Theoretical (h/e):{" "}
            {millikanData.modelLineSlopeVs.toExponential(4)} V&middot;s
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
}>;

export function CurrentVoltagePlot({
  collectorPotential,
  stoppingPotential,
  saturationCurrentMicroAmps,
  currentAtOperatingPoint,
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
        Current-Voltage Characteristic: I(U_c)
      </h3>
      <p className="fine" style={{ margin: "0 0 0.5rem" }}>
        Saturation current{" "}
        <span style={{ fontFamily: "var(--font-mono, monospace)" }}>
          I_sat = {saturationCurrentMicroAmps.toFixed(2)} &mu;A
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
          Collector Potential U_c (Volts)
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

        {/* Curve Segments */}
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
              -V_s (-{vs.toFixed(2)} V)
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
      </svg>
    </div>
  );
}
