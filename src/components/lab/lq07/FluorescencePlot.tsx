import type { Lq07Parameters } from "../../../experiments/lq07/definition.ts";
import type { Lq07Evaluation } from "../../../experiments/lq07/session.ts";

export interface FluorescencePlotProps {
  parameters: Lq07Parameters;
  evaluation: Lq07Evaluation;
  clipId?: string;
}

function getFrequencyBand(nuTHz: number): { name: string; color: string; wavelengthNm: number } {
  // c = 299792.458 km/s => lambda (nm) = 299792.458 / nu (THz)
  const lambdaNm = Math.round(299792.458 / nuTHz);
  if (nuTHz > 789) {
    return { name: "Ultraviolet (UV)", color: "#7c3aed", wavelengthNm: lambdaNm };
  }
  if (nuTHz >= 400) {
    if (nuTHz > 680) return { name: "Violet", color: "#8b5cf6", wavelengthNm: lambdaNm };
    if (nuTHz > 600) return { name: "Blue", color: "#3b82f6", wavelengthNm: lambdaNm };
    if (nuTHz > 530) return { name: "Green", color: "#10b981", wavelengthNm: lambdaNm };
    if (nuTHz > 510) return { name: "Yellow", color: "#eab308", wavelengthNm: lambdaNm };
    if (nuTHz > 480) return { name: "Orange", color: "#f97316", wavelengthNm: lambdaNm };
    return { name: "Red", color: "#ef4444", wavelengthNm: lambdaNm };
  }
  return { name: "Infrared (IR)", color: "#b91c1c", wavelengthNm: lambdaNm };
}

export function FluorescencePlot({
  parameters,
  evaluation,
  clipId = "lq07-plot-clip",
}: FluorescencePlotProps) {
  const { nu1, nu2, regime, multiQuantumK } = parameters;
  const { budget, rates } = evaluation;

  const band1 = getFrequencyBand(nu1);
  const band2 = getFrequencyBand(nu2);

  const maxEnergyEv = Math.max(
    5.0,
    budget.e1Ev * (regime === "deviation-multi-quantum" ? multiQuantumK : 1.2),
    budget.e2Ev * 1.1,
  );
  const scale = 220 / maxEnergyEv; // px per eV

  const barWidth = 44;
  const svgWidth = 460;
  const svgHeight = 280;
  const groundY = 230;

  const h1Px = budget.e1Ev * scale;
  const h2Px = budget.e2Ev * scale;
  const hOtherPx = budget.allowed ? budget.eOtherEv * scale : 0;
  const hDeficitPx = !budget.allowed ? budget.energyDeficitEv * scale : 0;
  const hMaxPx =
    (budget.status === "value"
      ? budget.e1Ev * (regime === "deviation-multi-quantum" ? multiQuantumK : 1)
      : budget.e1Ev) * scale;

  return (
    <div
      className="lq07-plot-container flex flex-col gap-5 w-full max-w-2xl mx-auto"
      data-regime={regime}
      data-allowed={budget.allowed ? "true" : "false"}
    >
      {/* 1. Main Energy Budget SVG Chart */}
      <div className="border border-border/80 rounded-xl p-5 bg-muted/20 relative">
        <div className="flex justify-between items-center mb-3">
          <div className="flex items-center gap-2">
            <span className="text-xs font-mono font-bold uppercase tracking-wide text-foreground/80">
              Elementary Quantum Energy Ledger
            </span>
            <span
              className={`text-xs px-2 py-0.5 rounded-full font-bold font-mono ${
                budget.status === "outside-domain"
                  ? "bg-amber-500/20 text-amber-700 dark:text-amber-300 border border-amber-500/30"
                  : budget.allowed
                    ? "bg-emerald-500/20 text-emerald-700 dark:text-emerald-300 border border-emerald-500/30"
                    : "bg-rose-500/20 text-rose-700 dark:text-rose-300 border border-rose-500/30"
              }`}
            >
              {budget.status === "outside-domain"
                ? "Outside Wien Regime"
                : budget.allowed
                  ? "Allowed by Budget"
                  : "Disallowed (Deficit)"}
            </span>
          </div>

          <span className="text-xs font-mono text-muted-foreground">
            {regime === "standard-stokes" && "Stokes's Rule (§7)"}
            {regime === "deviation-multi-quantum" && `Deviation Case 1 (k = ${multiQuantumK})`}
            {regime === "deviation-non-wien" && "Deviation Case 2 (Wien Check)"}
            {regime === "modern-thermal" && "Modern Thermal Allowance"}
          </span>
        </div>

        <svg
          viewBox={`0 0 ${svgWidth} ${svgHeight}`}
          width="100%"
          height="240"
          className="overflow-visible rounded-lg border border-border/60 bg-background"
          role="img"
          aria-label={`Fluorescence energy budget: incident ${nu1} THz (${budget.e1Ev.toFixed(3)} eV), emitted ${nu2} THz (${budget.e2Ev.toFixed(3)} eV), status ${budget.allowed ? "allowed" : "disallowed"}`}
        >
          <defs>
            <clipPath id={clipId}>
              <rect x="0" y="0" width={svgWidth} height={svgHeight} rx="8" />
            </clipPath>
            <pattern
              id="deficit-hatch"
              width="8"
              height="8"
              patternUnits="userSpaceOnUse"
              patternTransform="rotate(45)"
            >
              <line x1="0" y1="0" x2="0" y2="8" stroke="#ef4444" strokeWidth="2.5" />
            </pattern>
          </defs>

          {/* Ground level line */}
          <line
            x1="30"
            y1={groundY}
            x2={svgWidth - 20}
            y2={groundY}
            stroke="currentColor"
            strokeWidth="1.5"
            className="text-border"
          />
          <text
            x="35"
            y={groundY + 16}
            fontSize="10"
            fontFamily="monospace"
            fill="currentColor"
            className="text-muted-foreground"
          >
            0 eV (Ground State)
          </text>

          {/* Bar 1: Absorbed Energy */}
          <g transform="translate(90, 0)">
            <rect
              x={-barWidth / 2}
              y={groundY - h1Px}
              width={barWidth}
              height={h1Px}
              fill={band1.color}
              rx="4"
              opacity="0.9"
            />
            <text
              x="0"
              y={groundY - h1Px - 8}
              textAnchor="middle"
              fontSize="11"
              fontWeight="bold"
              fontFamily="monospace"
              fill="currentColor"
              className="text-foreground"
            >
              {budget.e1Ev.toFixed(3)} eV
            </text>
            <text
              x="0"
              y={groundY + 16}
              textAnchor="middle"
              fontSize="10"
              fontWeight="600"
              fill="currentColor"
              className="text-foreground/90"
            >
              Absorbed (hν₁)
            </text>
            <text
              x="0"
              y={groundY + 28}
              textAnchor="middle"
              fontSize="9"
              fontFamily="monospace"
              fill="currentColor"
              className="text-muted-foreground"
            >
              {nu1} THz · {band1.wavelengthNm} nm
            </text>
          </g>

          {/* Upper bound threshold line */}
          <line
            x1="140"
            y1={groundY - hMaxPx}
            x2={svgWidth - 50}
            y2={groundY - hMaxPx}
            stroke="currentColor"
            strokeWidth="1.5"
            strokeDasharray="4 3"
            className="text-primary"
          />
          <text
            x={svgWidth - 45}
            y={groundY - hMaxPx + 3}
            fontSize="9"
            fontFamily="monospace"
            fontWeight="bold"
            fill="currentColor"
            className="text-primary"
          >
            ν₂,max = {(budget.nu2MaxHz / 1e12).toFixed(1)} THz
          </text>

          {/* Bar 2: Emitted Light Energy */}
          <g transform="translate(220, 0)">
            <rect
              x={-barWidth / 2}
              y={groundY - h2Px}
              width={barWidth}
              height={h2Px}
              fill={band2.color}
              rx="4"
              opacity="0.9"
            />
            <text
              x="0"
              y={groundY - h2Px - 8}
              textAnchor="middle"
              fontSize="11"
              fontWeight="bold"
              fontFamily="monospace"
              fill="currentColor"
              className="text-foreground"
            >
              {budget.e2Ev.toFixed(3)} eV
            </text>
            <text
              x="0"
              y={groundY + 16}
              textAnchor="middle"
              fontSize="10"
              fontWeight="600"
              fill="currentColor"
              className="text-foreground/90"
            >
              Emitted (hν₂)
            </text>
            <text
              x="0"
              y={groundY + 28}
              textAnchor="middle"
              fontSize="9"
              fontFamily="monospace"
              fill="currentColor"
              className="text-muted-foreground"
            >
              {nu2} THz · {band2.wavelengthNm} nm
            </text>
          </g>

          {/* Bar 3: Other Channels (Heat) OR Energy Deficit */}
          <g transform="translate(340, 0)">
            {budget.allowed ? (
              <rect
                x={-barWidth / 2}
                y={groundY - hOtherPx}
                width={barWidth}
                height={Math.max(2, hOtherPx)}
                fill="#10b981"
                rx="4"
                opacity="0.85"
              />
            ) : (
              <rect
                x={-barWidth / 2}
                y={groundY - hDeficitPx}
                width={barWidth}
                height={Math.max(4, hDeficitPx)}
                fill="url(#deficit-hatch)"
                stroke="#ef4444"
                strokeWidth="1.5"
                rx="4"
              />
            )}

            <text
              x="0"
              y={groundY - (budget.allowed ? hOtherPx : hDeficitPx) - 8}
              textAnchor="middle"
              fontSize="11"
              fontWeight="bold"
              fontFamily="monospace"
              fill="currentColor"
              className={
                budget.allowed
                  ? "text-emerald-600 dark:text-emerald-400"
                  : "text-rose-600 dark:text-rose-400"
              }
            >
              {budget.allowed
                ? `+${budget.eOtherEv.toFixed(3)} eV`
                : `-${budget.energyDeficitEv.toFixed(3)} eV`}
            </text>
            <text
              x="0"
              y={groundY + 16}
              textAnchor="middle"
              fontSize="10"
              fontWeight="600"
              fill="currentColor"
              className="text-foreground/90"
            >
              {budget.allowed ? "Heat (E_other)" : "Energy Deficit"}
            </text>
            <text
              x="0"
              y={groundY + 28}
              textAnchor="middle"
              fontSize="9"
              fontFamily="monospace"
              fill="currentColor"
              className="text-muted-foreground"
            >
              {budget.allowed ? "Dissipated in medium" : "Forbidden by single-quantum"}
            </text>
          </g>
        </svg>

        {/* Reason / Verdict Callout */}
        <div
          className={`mt-4 p-3 rounded-lg border text-xs leading-relaxed ${
            budget.status === "outside-domain"
              ? "bg-amber-500/10 border-amber-500/30 text-amber-900 dark:text-amber-200"
              : budget.allowed
                ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-900 dark:text-emerald-200"
                : "bg-rose-500/10 border-rose-500/30 text-rose-900 dark:text-rose-200"
          }`}
        >
          <strong>Verdict:</strong> {budget.verdictReason}
        </div>
      </div>

      {/* 2. False-Color Spectral Band Legend */}
      <div className="border border-border/80 rounded-xl p-4 bg-muted/10">
        <div className="flex justify-between items-center mb-2">
          <h4 className="text-xs font-mono uppercase tracking-wide text-foreground/80 font-bold">
            Spectral Bands &amp; False-Color Legend
          </h4>
          <span className="text-xs text-muted-foreground">Wavelength λ = c / ν</span>
        </div>

        <div className="grid grid-cols-3 gap-2 text-xs">
          <div className="p-2 rounded-lg border border-border/60 bg-background flex items-center gap-2">
            <span className="w-3.5 h-3.5 rounded-full bg-[#7c3aed] shrink-0" />
            <div>
              <div className="font-semibold">Ultraviolet (UV)</div>
              <div className="text-[10px] font-mono text-muted-foreground">
                &gt; 789 THz (&lt; 380 nm)
              </div>
            </div>
          </div>
          <div className="p-2 rounded-lg border border-border/60 bg-background flex items-center gap-2">
            <span className="w-3.5 h-3.5 rounded-full bg-gradient-to-r from-[#3b82f6] via-[#10b981] to-[#ef4444] shrink-0" />
            <div>
              <div className="font-semibold">Visible Spectrum</div>
              <div className="text-[10px] font-mono text-muted-foreground">
                400–789 THz (380–750 nm)
              </div>
            </div>
          </div>
          <div className="p-2 rounded-lg border border-border/60 bg-background flex items-center gap-2">
            <span className="w-3.5 h-3.5 rounded-full bg-[#b91c1c] shrink-0" />
            <div>
              <div className="font-semibold">Infrared (IR)</div>
              <div className="text-[10px] font-mono text-muted-foreground">
                &lt; 400 THz (&gt; 750 nm)
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* 3. Rates and Intensity Linearity Readout */}
      {rates.status === "value" && (
        <div className="border border-border/80 rounded-xl p-4 bg-muted/10 text-xs flex flex-col gap-2">
          <div className="flex justify-between items-center">
            <span className="font-bold text-foreground/90 uppercase font-mono tracking-wide">
              Weak-Illumination Photon Rates (Zero Threshold)
            </span>
            <span className="font-mono text-primary font-semibold">
              Yield Y = {rates.quantumYield.toFixed(2)}
            </span>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-1">
            <div>
              <span className="text-muted-foreground block text-[11px]">Absorbed Rate Ṅ₁:</span>
              <span className="font-mono font-bold">
                {rates.absorbedRatePerSecond.toExponential(4)} s⁻¹
              </span>
            </div>
            <div>
              <span className="text-muted-foreground block text-[11px]">Emitted Rate Ṅ₂:</span>
              <span className="font-mono font-bold text-primary">
                {rates.emittedRatePerSecond.toExponential(4)} s⁻¹
              </span>
            </div>
            <div>
              <span className="text-muted-foreground block text-[11px]">Emitted Power:</span>
              <span className="font-mono font-bold">
                {(rates.emittedPowerWatts * 1e6).toFixed(4)} μW
              </span>
            </div>
            <div>
              <span className="text-muted-foreground block text-[11px]">Heat Dissipated:</span>
              <span className="font-mono font-bold">
                {(rates.dissipatedHeatWatts * 1e6).toFixed(4)} μW
              </span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
