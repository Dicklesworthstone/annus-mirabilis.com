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
    <div className="lab-plot-card space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-zinc-200 pb-2 dark:border-zinc-800">
        <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
          Relativistic Four-Current Visualization
        </h3>
        <span className="text-xs text-zinc-500">
          Mode: <strong className="text-zinc-800 dark:text-zinc-200">{mode}</strong> (v ={" "}
          {boostFraction.toFixed(2)}c, γ = {gamma.toFixed(4)})
        </span>
      </div>

      <svg
        viewBox={`0 0 ${width} ${height}`}
        className="w-full h-auto rounded border border-zinc-200 bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-950"
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
          stroke="#71717a"
          strokeDasharray="4 4"
          strokeOpacity="0.4"
        />

        {/* Frame K (Stationary) */}
        <g transform="translate(10, 10)">
          <text x={10} y={20} className="text-xs font-semibold fill-zinc-700 dark:fill-zinc-300">
            Stationary Frame K (Laboratory)
          </text>
          <text x={10} y={36} className="text-[11px] fill-zinc-500">
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
                stroke="#3b82f6"
                strokeWidth={3}
                rx={4}
              />
              {/* Arrows */}
              <path d="M 80 20 L 120 20" stroke="#ef4444" strokeWidth={2} markerEnd="url(#arrow)" />
              <path d="M 140 120 L 100 120" stroke="#ef4444" strokeWidth={2} />
              <text
                x={110}
                y={15}
                textAnchor="middle"
                className="text-[10px] fill-zinc-600 dark:fill-zinc-400"
              >
                Top leg: +I (neutral λ=0)
              </text>
              <text
                x={110}
                y={138}
                textAnchor="middle"
                className="text-[10px] fill-zinc-600 dark:fill-zinc-400"
              >
                Bottom leg: -I (neutral λ=0)
              </text>
              <text
                x={110}
                y={75}
                textAnchor="middle"
                className="text-[11px] font-mono fill-zinc-700 dark:fill-zinc-300"
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
                fill="#3b82f6"
                fillOpacity={0.25}
                stroke="#2563eb"
                strokeWidth={2}
              />
              <text
                x={85}
                y={65}
                textAnchor="middle"
                className="text-[11px] font-mono fill-zinc-800 dark:fill-zinc-200"
              >
                Q ={" "}
                {sphereTotalStationary?.status === "value" &&
                typeof sphereTotalStationary.value === "number"
                  ? display(sphereTotalStationary.value)
                  : "4.189"}{" "}
                C
              </text>
              <text x={85} y={130} textAnchor="middle" className="text-[10px] fill-zinc-500">
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
                fill="#e4e4e7"
                fillOpacity={0.5}
                stroke="#a1a1aa"
                strokeWidth={1.5}
                rx={6}
                className="dark:fill-zinc-800 dark:stroke-zinc-700"
              />
              {/* Positive ions (stationary) */}
              {stationaryIons.map((ion) => (
                <circle key={ion.id} cx={ion.cx} cy={45} r={5} fill="#ef4444" />
              ))}
              {/* Negative electrons (drift speed) */}
              {stationaryElectrons.map((elec) => (
                <circle key={elec.id} cx={elec.cx} cy={75} r={4} fill="#3b82f6" />
              ))}
              <text x={120} y={120} textAnchor="middle" className="text-[10px] fill-zinc-500">
                Equal ion & electron linear density → Neutral wire (ρ = 0)
              </text>
            </g>
          )}
        </g>

        {/* Frame k (Moving at boost v) */}
        <g transform={`translate(${width / 2 + 10}, 10)`}>
          <text x={10} y={20} className="text-xs font-semibold fill-zinc-700 dark:fill-zinc-300">
            Moving Frame k (Speed v = {boostFraction.toFixed(2)}c)
          </text>
          <text x={10} y={36} className="text-[11px] fill-zinc-500">
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
                stroke="#8b5cf6"
                strokeWidth={3}
                rx={4}
              />
              <text
                x={10 + 100 / gamma}
                y={15}
                textAnchor="middle"
                className="text-[10px] fill-red-500 font-semibold"
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
                className="text-[10px] fill-blue-500 font-semibold"
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
                className="text-[11px] font-mono fill-zinc-700 dark:fill-zinc-300"
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
                fill="#8b5cf6"
                fillOpacity={0.25}
                stroke="#7c3aed"
                strokeWidth={2}
              />
              <text
                x={85}
                y={65}
                textAnchor="middle"
                className="text-[11px] font-mono fill-zinc-800 dark:fill-zinc-200"
              >
                Q&apos; ={" "}
                {sphereTotalMoving?.status === "value" &&
                typeof sphereTotalMoving.value === "number"
                  ? display(sphereTotalMoving.value)
                  : "4.189"}{" "}
                C
              </text>
              <text x={85} y={130} textAnchor="middle" className="text-[10px] fill-zinc-500">
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
                fill="#f5f3ff"
                fillOpacity={0.5}
                stroke="#8b5cf6"
                strokeWidth={1.5}
                rx={6}
                className="dark:fill-purple-950/30 dark:stroke-purple-800"
              />
              {/* Contracted ion spacing vs electron spacing */}
              {movingIons.map((ion) => (
                <circle key={ion.id} cx={ion.cx} cy={45} r={4} fill="#ef4444" />
              ))}
              {movingElectrons.map((elec) => (
                <circle key={elec.id} cx={elec.cx} cy={75} r={4} fill="#3b82f6" />
              ))}
              <text
                x={120}
                y={120}
                textAnchor="middle"
                className="text-[10px] font-semibold fill-purple-600 dark:fill-purple-400"
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
