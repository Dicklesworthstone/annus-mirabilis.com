import type { Lq06SubexpressionChoice } from "../../../experiments/lq06/definition.ts";

export interface EntropyComparisonPlotProps {
  radiationEnergy: number;
  frequency: number;
  gasParticles: number;
  volumeRatio: number;
  radiationEntropy: number;
  gasEntropy: number;
  radVolumeCoeff: number;
  gasVolumeCoeff: number;
  effectiveCount: number;
  quantumEnergyEv: number;
  selectedSubexpression: Lq06SubexpressionChoice;
  isMatch: boolean;
}

export function EntropyComparisonPlot({
  radiationEnergy,
  frequency,
  gasParticles,
  volumeRatio,
  radiationEntropy,
  gasEntropy,
  radVolumeCoeff: _radVolumeCoeff,
  gasVolumeCoeff: _gasVolumeCoeff,
  effectiveCount,
  quantumEnergyEv,
  selectedSubexpression,
  isMatch,
}: EntropyComparisonPlotProps) {
  const width = 580;
  const height = 260;

  return (
    <div className="plot-container flex flex-col gap-2" data-view-id="lq-06-side-by-side">
      <div className="flex justify-between items-center">
        <h3 className="text-sm font-semibold text-slate-800 dark:text-slate-100">
          Entropy Volume Law Comparison (§6)
        </h3>
        <span className="text-[11px] font-mono px-2 py-0.5 rounded bg-sky-100 dark:bg-sky-950 text-sky-800 dark:text-sky-300">
          V/V₀ = {volumeRatio.toFixed(2)} | ln(V/V₀) = {Math.log(volumeRatio).toFixed(3)}
        </span>
      </div>
      <p className="text-xs text-slate-600 dark:text-slate-400">
        Side-by-side mathematical structure: Wien radiation entropy vs. Boltzmann ideal gas entropy
        under identical isothermal volume changes.
      </p>

      <svg
        viewBox={`0 0 ${width} ${height}`}
        className="w-full h-auto bg-slate-900 border border-slate-800 rounded overflow-hidden"
        role="img"
        aria-label="Side-by-side comparison of radiation and gas entropy volume laws"
      >
        {/* Left Column: Monochromatic Radiation */}
        <g transform="translate(20, 24)">
          <rect
            x="0"
            y="0"
            width="260"
            height="180"
            rx="6"
            fill="#0f172a"
            stroke={isMatch ? "#38bdf8" : "#334155"}
            strokeWidth={isMatch ? "2" : "1"}
          />
          <text x="14" y="24" className="text-[12px] fill-sky-400 font-bold font-mono">
            Monochromatic Radiation (§4)
          </text>
          <text x="14" y="48" className="text-[11px] fill-slate-300 font-mono">
            S − S₀ = (E / βν) · ln(V / V₀)
          </text>
          <text x="14" y="70" className="text-[10px] fill-slate-400 font-mono">
            = (R/N) · [ (N·E)/(R·β·ν) ] · ln(V/V₀)
          </text>

          {/* Radiation Values */}
          <line x1="14" y1="84" x2="246" y2="84" stroke="#1e293b" strokeWidth="1" />
          <text x="14" y="104" className="text-[10px] fill-slate-400">
            Enclosed energy E:
          </text>
          <text x="246" y="104" textAnchor="end" className="text-[10px] fill-slate-200 font-mono">
            {(radiationEnergy * 1e9).toFixed(3)} nJ
          </text>
          <text x="14" y="122" className="text-[10px] fill-slate-400">
            Frequency ν:
          </text>
          <text x="246" y="122" textAnchor="end" className="text-[10px] fill-slate-200 font-mono">
            {(frequency * 1e-12).toFixed(1)} THz
          </text>
          <text x="14" y="140" className="text-[10px] fill-slate-400">
            Entropy change ΔS:
          </text>
          <text
            x="246"
            y="140"
            textAnchor="end"
            className="text-[10px] fill-sky-300 font-mono font-semibold"
          >
            {radiationEntropy.toExponential(4)} J/K
          </text>
          <text x="14" y="158" className="text-[10px] fill-slate-400">
            Effective count n_eff:
          </text>
          <text
            x="246"
            y="158"
            textAnchor="end"
            className="text-[10px] fill-amber-300 font-mono font-bold"
          >
            {effectiveCount.toExponential(4)}
          </text>
        </g>

        {/* Right Column: Ideal Gas */}
        <g transform="translate(300, 24)">
          <rect
            x="0"
            y="0"
            width="260"
            height="180"
            rx="6"
            fill="#0f172a"
            stroke={isMatch ? "#f59e0b" : "#334155"}
            strokeWidth={isMatch ? "2" : "1"}
          />
          <text x="14" y="24" className="text-[12px] fill-amber-400 font-bold font-mono">
            Ideal Gas / Discrete Particles (§5)
          </text>
          <text x="14" y="48" className="text-[11px] fill-slate-300 font-mono">
            S − S₀ = (R/N) · n · ln(V / V₀)
          </text>
          <text x="14" y="70" className="text-[10px] fill-slate-400 font-mono">
            = k_B · n · ln(V/V₀)
          </text>

          {/* Gas Values */}
          <line x1="14" y1="84" x2="246" y2="84" stroke="#1e293b" strokeWidth="1" />
          <text x="14" y="104" className="text-[10px] fill-slate-400">
            Gas particle count n:
          </text>
          <text
            x="246"
            y="104"
            textAnchor="end"
            className="text-[10px] fill-slate-200 font-mono font-bold"
          >
            {gasParticles}
          </text>
          <text x="14" y="122" className="text-[10px] fill-slate-400">
            Gas constant R/N = k_B:
          </text>
          <text x="246" y="122" textAnchor="end" className="text-[10px] fill-slate-200 font-mono">
            1.381 × 10⁻²³ J/K
          </text>
          <text x="14" y="140" className="text-[10px] fill-slate-400">
            Entropy change ΔS:
          </text>
          <text
            x="246"
            y="140"
            textAnchor="end"
            className="text-[10px] fill-amber-300 font-mono font-semibold"
          >
            {gasEntropy.toExponential(4)} J/K
          </text>
          <text x="14" y="158" className="text-[10px] fill-slate-400">
            Quantum energy ε = h·ν:
          </text>
          <text
            x="246"
            y="158"
            textAnchor="end"
            className="text-[10px] fill-emerald-300 font-mono font-bold"
          >
            {quantumEnergyEv.toFixed(4)} eV
          </text>
        </g>

        {/* Central Correspondence Indicator */}
        <g transform="translate(290, 114)">
          <circle
            cx="0"
            cy="0"
            r="16"
            fill="#1e293b"
            stroke={isMatch ? "#10b981" : "#64748b"}
            strokeWidth="2"
          />
          <text x="0" y="4" textAnchor="middle" className="text-[12px] fill-slate-200 font-bold">
            {isMatch ? "≡" : "vs"}
          </text>
        </g>

        {/* Bottom Equivalence Bar */}
        <g transform="translate(20, 218)">
          <rect
            x="0"
            y="0"
            width="540"
            height="32"
            rx="4"
            fill={isMatch ? "rgba(16, 185, 129, 0.1)" : "rgba(30, 41, 59, 0.5)"}
            stroke={isMatch ? "#059669" : "#334155"}
          />
          <text x="270" y="20" textAnchor="middle" className="text-[11px] font-mono fill-slate-200">
            {isMatch ? (
              <tspan fill="#34d399">
                ✓ Correspondence: n_eff = (N·E)/(R·β·ν) = E/(h·ν) ⟹ Energy per quantum ε = R·β·ν/N =
                h·ν = {quantumEnergyEv.toFixed(4)} eV
              </tspan>
            ) : selectedSubexpression !== "none" ? (
              <tspan fill="#f87171">
                ✗ Proposed candidate does not match the dimensionless particle count n
              </tspan>
            ) : (
              <tspan fill="#94a3b8">
                Select a subexpression in Discovery Mode to test the coefficient match
              </tspan>
            )}
          </text>
        </g>
      </svg>
    </div>
  );
}
