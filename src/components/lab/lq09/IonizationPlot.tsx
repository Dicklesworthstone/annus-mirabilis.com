import { visibleColor } from "../../../experiments/lq09/session.ts";

export type IonizationThresholdLadderProps = Readonly<{
  frequency: number; // Hz
  ionizationEnergyEv: number; // eV
  quantumEnergyEv: number; // eV
  excessEnergyEv: number; // eV
  thresholdFrequencyHz: number; // Hz
  thresholdWavelengthNm: number; // nm
  singleQuantumAllowed: boolean;
}>;

export function IonizationThresholdLadderPlot({
  frequency,
  ionizationEnergyEv,
  quantumEnergyEv,
  excessEnergyEv,
  thresholdFrequencyHz,
  thresholdWavelengthNm,
  singleQuantumAllowed,
}: IonizationThresholdLadderProps) {
  const width = 380;
  const height = 260;
  const padding = { top: 35, right: 30, bottom: 40, left: 75 };

  const maxEnergy = Math.max(15.0, quantumEnergyEv * 1.25, ionizationEnergyEv * 1.25);
  const scaleY = (ev: number) => {
    const clamped = Math.max(0, Math.min(maxEnergy, ev));
    return (
      height - padding.bottom - (clamped / maxEnergy) * (height - padding.top - padding.bottom)
    );
  };

  const yGround = scaleY(0);
  const yIonization = scaleY(ionizationEnergyEv);
  const yPhoton = scaleY(quantumEnergyEv);
  const col = visibleColor(frequency);

  return (
    <div data-view-id="lq-09-energy-ladder">
      <h3
        style={{
          fontSize: "0.875rem",
          fontWeight: 600,
          marginBottom: "0.25rem",
          color: "var(--ink)",
        }}
      >
        Single-quantum ionization energy ladder
      </h3>
      <p
        style={{
          fontSize: "0.75rem",
          color: "var(--muted)",
          marginBottom: "0.5rem",
        }}
      >
        <span style={{ fontFamily: "var(--font-mono, monospace)" }}>
          h&nu; = {quantumEnergyEv.toFixed(2)} eV
        </span>{" "}
        | J_mol ={" "}
        <span style={{ fontFamily: "var(--font-mono, monospace)" }}>
          {ionizationEnergyEv.toFixed(2)} eV
        </span>{" "}
        (&nu;_0 ={" "}
        <span style={{ fontFamily: "var(--font-mono, monospace)" }}>
          {(thresholdFrequencyHz / 1e12).toFixed(1)} THz
        </span>
        , &lambda;_0 ={" "}
        <span style={{ fontFamily: "var(--font-mono, monospace)" }}>
          {thresholdWavelengthNm.toFixed(1)} nm
        </span>
        )
      </p>
      <svg
        viewBox={`0 0 ${width} ${height}`}
        style={{
          width: "100%",
          height: "auto",
          background: "var(--panel)",
          border: "1px solid var(--line)",
          borderRadius: "0.25rem",
        }}
        role="img"
        aria-label={`Ionization ladder showing photon energy ${quantumEnergyEv.toFixed(2)} eV and ionization threshold ${ionizationEnergyEv.toFixed(2)} eV`}
      >
        <defs>
          <marker
            id="lq09-photon-arrow"
            viewBox="0 0 10 10"
            refX="6"
            refY="5"
            markerWidth="6"
            markerHeight="6"
            orient="auto-start-reverse"
          >
            <path d="M 0 1 L 10 5 L 0 9 z" fill={col.hexColor} />
          </marker>
          <marker
            id="lq09-excess-arrow"
            viewBox="0 0 10 10"
            refX="6"
            refY="5"
            markerWidth="6"
            markerHeight="6"
            orient="auto-start-reverse"
          >
            <path d="M 0 1 L 10 5 L 0 9 z" fill="var(--plot)" />
          </marker>
        </defs>

        {/* Molecular Ground State (0 eV) */}
        <line
          x1={padding.left}
          y1={yGround}
          x2={width - padding.right}
          y2={yGround}
          stroke="var(--line)"
          strokeWidth="2"
        />
        <text
          x={padding.left - 8}
          y={yGround + 4}
          textAnchor="end"
          fontSize="10"
          fill="var(--muted)"
          fontFamily="var(--font-mono, monospace)"
        >
          Ground (0 eV)
        </text>

        {/* Ionization Continuum Threshold (J_mol) */}
        <line
          x1={padding.left}
          y1={yIonization}
          x2={width - padding.right}
          y2={yIonization}
          stroke="var(--accent)"
          strokeWidth="2"
          strokeDasharray="4 3"
        />
        <text
          x={padding.left - 8}
          y={yIonization + 4}
          textAnchor="end"
          fontSize="10"
          fill="var(--ink)"
          fontFamily="var(--font-mono, monospace)"
        >
          J_mol ({ionizationEnergyEv.toFixed(1)} eV)
        </text>

        {/* Incident Photon Arrow */}
        <line
          x1={padding.left + 80}
          y1={yGround}
          x2={padding.left + 80}
          y2={yPhoton}
          stroke={col.hexColor}
          strokeWidth="3"
          markerEnd="url(#lq09-photon-arrow)"
        />
        <text
          x={padding.left + 90}
          y={(yGround + yPhoton) / 2}
          fontSize="11"
          fontWeight="600"
          fill={col.hexColor}
        >
          h&nu; = {quantumEnergyEv.toFixed(2)} eV
        </text>

        {/* Excess or Deficit region */}
        {singleQuantumAllowed ? (
          <>
            <rect
              x={padding.left + 190}
              y={yPhoton}
              width={80}
              height={Math.max(2, yIonization - yPhoton)}
              fill="var(--plot)"
              fillOpacity="0.2"
              stroke="var(--plot)"
              strokeWidth="1"
            />
            <text
              x={padding.left + 230}
              y={(yPhoton + yIonization) / 2 + 4}
              textAnchor="middle"
              fontSize="10"
              fill="var(--ink)"
              fontWeight="600"
            >
              +{excessEnergyEv.toFixed(2)} eV kinetic
            </text>
          </>
        ) : (
          <>
            <rect
              x={padding.left + 190}
              y={yPhoton}
              width={100}
              height={Math.max(2, yIonization - yPhoton)}
              fill="var(--accent)"
              fillOpacity="0.15"
              stroke="var(--accent)"
              strokeWidth="1"
              strokeDasharray="2 2"
            />
            <text
              x={padding.left + 240}
              y={(yPhoton + yIonization) / 2 + 4}
              textAnchor="middle"
              fontSize="9"
              fill="var(--ink)"
              fontWeight="600"
            >
              Sub-threshold: -{Math.abs(excessEnergyEv).toFixed(2)} eV deficit
            </text>
          </>
        )}

        {/* Bottom axis label */}
        <text
          x={(width + padding.left - padding.right) / 2}
          y={height - 10}
          textAnchor="middle"
          fontSize="10"
          fill="var(--muted)"
        >
          {singleQuantumAllowed
            ? "Single-quantum ionization permitted (h*nu >= J_mol)"
            : "Single-quantum ionization forbidden (h*nu < J_mol)"}
        </text>
      </svg>
    </div>
  );
}

export type IonizationCountingPlotProps = Readonly<{
  absorbedQuantaRate: number;
  incidentQuantaRate: number;
  ionizationRate: number | null;
  ionizationStatus: string;
  absorptionMode: string;
  declaredFraction: number;
}>;

export function IonizationCountingPlot({
  absorbedQuantaRate,
  incidentQuantaRate,
  ionizationRate,
  ionizationStatus,
  absorptionMode,
  declaredFraction,
}: IonizationCountingPlotProps) {
  const width = 380;
  const height = 220;
  const padding = { top: 30, right: 30, bottom: 40, left: 110 };

  const maxRate = Math.max(1e10, incidentQuantaRate * 1.15);
  const scaleX = (rate: number) => {
    const clamped = Math.max(0, Math.min(maxRate, rate));
    return padding.left + (clamped / maxRate) * (width - padding.left - padding.right);
  };

  const yIncident = padding.top + 25;
  const yAbsorbed = padding.top + 65;
  const yIons = padding.top + 105;

  return (
    <div data-view-id="lq-09-rate-budget">
      <h3
        style={{
          fontSize: "0.875rem",
          fontWeight: 600,
          marginBottom: "0.25rem",
          color: "var(--ink)",
        }}
      >
        Quantum Rate &amp; Ionization Accounting
      </h3>
      <p
        style={{
          fontSize: "0.75rem",
          color: "var(--muted)",
          marginBottom: "0.5rem",
        }}
      >
        Mode: <span style={{ fontWeight: 600, color: "var(--ink)" }}>{absorptionMode}</span>
        {absorptionMode === "declared-fraction" && ` (a = ${declaredFraction.toFixed(2)})`}
      </p>
      <svg
        viewBox={`0 0 ${width} ${height}`}
        style={{
          width: "100%",
          height: "auto",
          background: "var(--panel)",
          border: "1px solid var(--line)",
          borderRadius: "0.25rem",
        }}
        role="img"
        aria-label="Bar chart showing incident quanta, absorbed quanta, and ionization rate"
      >
        {/* Incident Quanta Bar */}
        <text
          x={padding.left - 8}
          y={yIncident + 12}
          textAnchor="end"
          fontSize="10"
          fill="var(--muted)"
        >
          Incident Quanta
        </text>
        <rect
          x={padding.left}
          y={yIncident}
          width={Math.max(2, scaleX(incidentQuantaRate) - padding.left)}
          height={18}
          fill="var(--muted)"
          rx="2"
        />
        <text
          x={scaleX(incidentQuantaRate) + 6}
          y={yIncident + 13}
          fontSize="10"
          fontFamily="var(--font-mono, monospace)"
          fill="var(--ink)"
        >
          {incidentQuantaRate.toExponential(2)}/s
        </text>

        {/* Absorbed Quanta Bar */}
        <text
          x={padding.left - 8}
          y={yAbsorbed + 12}
          textAnchor="end"
          fontSize="10"
          fill="var(--muted)"
        >
          Absorbed Quanta
        </text>
        <rect
          x={padding.left}
          y={yAbsorbed}
          width={Math.max(2, scaleX(absorbedQuantaRate) - padding.left)}
          height={18}
          fill="var(--accent)"
          rx="2"
        />
        <text
          x={scaleX(absorbedQuantaRate) + 6}
          y={yAbsorbed + 13}
          fontSize="10"
          fontFamily="var(--font-mono, monospace)"
          fill="var(--ink)"
        >
          {absorbedQuantaRate.toExponential(2)}/s
        </text>

        {/* Ionization Events Bar */}
        <text
          x={padding.left - 8}
          y={yIons + 12}
          textAnchor="end"
          fontSize="10"
          fill="var(--muted)"
        >
          Ionization Rate
        </text>

        {ionizationStatus === "value" && ionizationRate !== null ? (
          <>
            <rect
              x={padding.left}
              y={yIons}
              width={Math.max(2, scaleX(ionizationRate) - padding.left)}
              height={18}
              fill="var(--plot)"
              rx="2"
            />
            <text
              x={scaleX(ionizationRate) + 6}
              y={yIons + 13}
              fontSize="10"
              fontFamily="var(--font-mono, monospace)"
              fill="var(--ink)"
            >
              {ionizationRate.toExponential(2)}/s
            </text>
          </>
        ) : ionizationStatus === "underdetermined" ? (
          <>
            <rect
              x={padding.left}
              y={yIons}
              width={Math.max(2, scaleX(absorbedQuantaRate) - padding.left)}
              height={18}
              fill="var(--accent)"
              fillOpacity="0.2"
              stroke="var(--accent)"
              strokeDasharray="3 3"
              rx="2"
            />
            <text
              x={scaleX(absorbedQuantaRate) + 6}
              y={yIons + 13}
              fontSize="10"
              fill="var(--ink)"
              fontWeight="600"
            >
              Bounded: &le; {absorbedQuantaRate.toExponential(2)}/s
            </text>
          </>
        ) : (
          <text
            x={padding.left + 6}
            y={yIons + 13}
            fontSize="10"
            fill="var(--ink)"
            fontWeight="600"
            fontStyle="italic"
          >
            {ionizationStatus === "not-applicable"
              ? "not-applicable (below threshold)"
              : ionizationStatus}
          </text>
        )}

        {/* Base line */}
        <line
          x1={padding.left}
          y1={padding.top + 10}
          x2={padding.left}
          y2={height - padding.bottom + 10}
          stroke="var(--line)"
          strokeWidth="1.5"
        />
        <text
          x={(width + padding.left - padding.right) / 2}
          y={height - 10}
          textAnchor="middle"
          fontSize="10"
          fill="var(--muted)"
        >
          Rate of elementary events per second
        </text>
      </svg>
    </div>
  );
}
