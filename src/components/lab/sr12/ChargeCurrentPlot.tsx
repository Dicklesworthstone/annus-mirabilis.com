"use client";

import type { PublishedResult } from "../../../experiments/store/instanceStore.ts";
import { display } from "../presentation.ts";

export function ChargeCurrentPlot({
  rhoStationary,
  rhoMoving,
  jStationary: _jStationary,
  jMoving,
  lorentzFactor,
  boostFraction,
  mode,
  loopLegChargePos,
  loopLegChargeNeg,
  loopTotal: _loopTotal,
  sphereTotalStationary,
  sphereTotalMoving,
}: {
  rhoStationary: PublishedResult | undefined;
  rhoMoving: PublishedResult | undefined;
  jStationary: PublishedResult | undefined;
  jMoving: PublishedResult | undefined;
  lorentzFactor: PublishedResult | undefined;
  boostFraction: number;
  mode: string;
  loopLegChargePos?: PublishedResult | undefined;
  loopLegChargeNeg?: PublishedResult | undefined;
  loopTotal?: PublishedResult | undefined;
  sphereTotalStationary?: PublishedResult | undefined;
  sphereTotalMoving?: PublishedResult | undefined;
}) {
  const gamma =
    lorentzFactor && lorentzFactor.status === "value" && typeof lorentzFactor.value === "number"
      ? lorentzFactor.value
      : 1.25;

  const rhoM =
    rhoMoving && rhoMoving.status === "value" && typeof rhoMoving.value === "number"
      ? rhoMoving.value
      : 0;

  const jM =
    jMoving && jMoving.status === "value" && jMoving.value instanceof Float64Array
      ? (jMoving.value[0] ?? 0)
      : 1;

  // Grid for wire carrier animation / visualization
  const ionCount = 12;
  const electronCount = 12;
  const stationaryIons = Array.from({ length: ionCount }, (_, i) => ({
    id: `stat-ion-${i}`,
    cx: 15 + i * 19,
  }));
  const stationaryElectrons = Array.from({ length: electronCount }, (_, i) => ({
    id: `stat-elec-${i}`,
    cx: 15 + i * 19,
  }));

  const movingIonCount = Math.round(ionCount * gamma);
  const movingIons = Array.from({ length: movingIonCount }, (_, i) => ({
    id: `mov-ion-${i}`,
    cx: 10 + i * (220 / (ionCount * gamma)),
  }));

  const movingElectronCount = Math.round(electronCount / gamma);
  const movingElectrons = Array.from({ length: movingElectronCount }, (_, i) => ({
    id: `mov-elec-${i}`,
    cx: 15 + i * (220 / (electronCount / gamma)),
  }));

  // Stationary frame spacing
  const width = 560;
  const height = 280;

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        gap: "1rem",
        background: "var(--panel)",
        border: "1px solid var(--line)",
        borderRadius: "0.5rem",
        padding: "1rem",
      }}
    >
      <div
        style={{
          display: "flex",
          flexWrap: "wrap",
          alignItems: "center",
          justifyContent: "space-between",
          gap: "0.5rem",
          borderBottom: "1px solid var(--line)",
          paddingBottom: "0.5rem",
        }}
      >
        <h3
          style={{
            fontSize: "0.875rem",
            fontWeight: 600,
            color: "var(--ink)",
            margin: 0,
          }}
        >
          Relativistic four-current visualization
        </h3>
        <span style={{ fontSize: "0.75rem", color: "var(--muted)" }}>
          Mode: <strong style={{ color: "var(--ink)" }}>{mode}</strong> (v ={" "}
          {boostFraction.toFixed(2)}c, γ = {gamma.toFixed(4)})
        </span>
      </div>

      <svg
        viewBox={`0 0 ${width} ${height}`}
        style={{
          width: "100%",
          height: "auto",
          borderRadius: "0.25rem",
          border: "1px solid var(--line)",
          background: "var(--wash)",
        }}
        aria-label="Side-by-side charge and current density visualization in stationary and moving frames"
      >
        <defs>
          <pattern id="wire-grid" width="20" height="20" patternUnits="userSpaceOnUse">
            <path d="M 20 0 L 0 0 0 20" fill="none" stroke="currentColor" strokeOpacity="0.05" />
          </pattern>
        </defs>

        {/* Background */}
        <rect width={width} height={height} fill="url(#wire-grid)" />

        {/* Divider */}
        <line
          x1={width / 2}
          y1={10}
          x2={width / 2}
          y2={height - 10}
          stroke="var(--line)"
          strokeDasharray="4 4"
        />

        {/* Frame K (Stationary) */}
        <g transform="translate(10, 10)">
          <text x={10} y={20} fontSize="12" fontWeight="600" fill="var(--ink)">
            Stationary frame K (laboratory)
          </text>
          <text x={10} y={36} fontSize="11" fill="var(--muted)">
            ρ ={" "}
            {rhoStationary?.status === "value" && typeof rhoStationary.value === "number"
              ? display(rhoStationary.value)
              : "0"}{" "}
            C/m³
          </text>

          {mode === "current-loop" ? (
            <g transform="translate(20, 60)">
              {/* Rectangular loop in K */}
              <rect
                x={10}
                y={20}
                width={200}
                height={100}
                fill="none"
                stroke="var(--plot)"
                strokeWidth={3}
                rx={4}
              />
              {/* Arrows */}
              <path
                d="M 80 20 L 120 20"
                stroke="var(--accent)"
                strokeWidth={2}
                markerEnd="url(#arrow)"
              />
              <path d="M 140 120 L 100 120" stroke="var(--accent)" strokeWidth={2} />
              <text x={110} y={15} textAnchor="middle" fontSize="10" fill="var(--muted)">
                Top leg: +I (neutral λ=0)
              </text>
              <text x={110} y={138} textAnchor="middle" fontSize="10" fill="var(--muted)">
                Bottom leg: -I (neutral λ=0)
              </text>
              <text
                x={110}
                y={75}
                textAnchor="middle"
                fontSize="11"
                fontFamily="var(--font-mono, monospace)"
                fill="var(--ink)"
              >
                Q_total = 0 C
              </text>
            </g>
          ) : mode === "moving-sphere" ? (
            <g transform="translate(40, 60)">
              {/* Sphere in K */}
              <circle
                cx={85}
                cy={60}
                r={50}
                fill="var(--plot)"
                fillOpacity={0.25}
                stroke="var(--plot)"
                strokeWidth={2}
              />
              <text
                x={85}
                y={65}
                textAnchor="middle"
                fontSize="11"
                fontFamily="var(--font-mono, monospace)"
                fill="var(--ink)"
              >
                Q ={" "}
                {sphereTotalStationary?.status === "value" &&
                typeof sphereTotalStationary.value === "number"
                  ? display(sphereTotalStationary.value)
                  : "4.189"}{" "}
                C
              </text>
              <text x={85} y={130} textAnchor="middle" fontSize="10" fill="var(--muted)">
                Rest volume V = 4π/3 R³
              </text>
            </g>
          ) : (
            <g transform="translate(15, 60)">
              {/* Wire casing */}
              <rect
                x={0}
                y={25}
                width={240}
                height={70}
                fill="var(--panel)"
                stroke="var(--line)"
                strokeWidth={1.5}
                rx={6}
              />
              {/* Positive ions (stationary) */}
              {stationaryIons.map((ion) => (
                <circle key={ion.id} cx={ion.cx} cy={45} r={5} fill="var(--accent)" />
              ))}
              {/* Negative electrons (drift speed) */}
              {stationaryElectrons.map((elec) => (
                <circle key={elec.id} cx={elec.cx} cy={75} r={4} fill="var(--plot)" />
              ))}
              <text x={120} y={120} textAnchor="middle" fontSize="10" fill="var(--muted)">
                Equal ion & electron linear density → Neutral wire (ρ = 0)
              </text>
            </g>
          )}
        </g>

        {/* Frame k (Moving at boost v) */}
        <g transform={`translate(${width / 2 + 10}, 10)`}>
          <text x={10} y={20} fontSize="12" fontWeight="600" fill="var(--ink)">
            Moving frame k (speed v = {boostFraction.toFixed(2)}c)
          </text>
          <text x={10} y={36} fontSize="11" fill="var(--muted)">
            ρ&apos; = {display(rhoM)} C/m³, J&apos;x = {display(jM)} A/m²
          </text>

          {mode === "current-loop" ? (
            <g transform="translate(20, 60)">
              {/* Contracted Rectangular loop in k */}
              <rect
                x={10 + 20 * (1 - 1 / gamma)}
                y={20}
                width={200 / gamma}
                height={100}
                fill="none"
                stroke="var(--accent)"
                strokeWidth={3}
                rx={4}
              />
              <text
                x={10 + 100 / gamma}
                y={15}
                textAnchor="middle"
                fontSize="10"
                fontWeight="600"
                fill="var(--ink)"
              >
                q&apos;+ ={" "}
                {loopLegChargePos?.status === "value" && typeof loopLegChargePos.value === "number"
                  ? display(loopLegChargePos.value)
                  : "-2.001e-9"}{" "}
                C
              </text>
              <text
                x={10 + 100 / gamma}
                y={138}
                textAnchor="middle"
                fontSize="10"
                fontWeight="600"
                fill="var(--ink)"
              >
                q&apos;- ={" "}
                {loopLegChargeNeg?.status === "value" && typeof loopLegChargeNeg.value === "number"
                  ? display(loopLegChargeNeg.value)
                  : "+2.001e-9"}{" "}
                C
              </text>
              <text
                x={10 + 100 / gamma}
                y={75}
                textAnchor="middle"
                fontSize="11"
                fontFamily="var(--font-mono, monospace)"
                fill="var(--ink)"
              >
                Q&apos;_total = 0 C
              </text>
            </g>
          ) : mode === "moving-sphere" ? (
            <g transform="translate(40, 60)">
              {/* Contracted Spheroid in k */}
              <ellipse
                cx={85}
                cy={60}
                rx={50 / gamma}
                ry={50}
                fill="var(--accent)"
                fillOpacity={0.25}
                stroke="var(--accent)"
                strokeWidth={2}
              />
              <text
                x={85}
                y={65}
                textAnchor="middle"
                fontSize="11"
                fontFamily="var(--font-mono, monospace)"
                fill="var(--ink)"
              >
                Q&apos; ={" "}
                {sphereTotalMoving?.status === "value" &&
                typeof sphereTotalMoving.value === "number"
                  ? display(sphereTotalMoving.value)
                  : "4.189"}{" "}
                C
              </text>
              <text x={85} y={130} textAnchor="middle" fontSize="10" fill="var(--muted)">
                Contracted volume V&apos; = V/γ, density ρ&apos; = γρ
              </text>
            </g>
          ) : (
            <g transform="translate(15, 60)">
              {/* Wire casing contracted */}
              <rect
                x={0}
                y={25}
                width={240}
                height={70}
                fill="var(--panel)"
                stroke="var(--accent)"
                strokeWidth={1.5}
                rx={6}
              />
              {/* Contracted ion spacing vs electron spacing */}
              {movingIons.map((ion) => (
                <circle key={ion.id} cx={ion.cx} cy={45} r={4} fill="var(--accent)" />
              ))}
              {movingElectrons.map((elec) => (
                <circle key={elec.id} cx={elec.cx} cy={75} r={4} fill="var(--plot)" />
              ))}
              <text
                x={120}
                y={120}
                textAnchor="middle"
                fontSize="10"
                fontWeight="600"
                fill="var(--ink)"
              >
                Differential Lorentz contraction → Net charge density ρ&apos; ≠ 0
              </text>
            </g>
          )}
        </g>
      </svg>
    </div>
  );
}
