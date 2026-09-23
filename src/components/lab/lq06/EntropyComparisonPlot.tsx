import type { Lq06SubexpressionChoice } from "../../../experiments/lq06/definition.ts";
import { SciSvg, SubSvg } from "../Sci.tsx";

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
    <div
      data-view-id="lq-06-side-by-side"
      style={{
        display: "flex",
        flexDirection: "column",
        gap: "0.5rem",
      }}
    >
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          flexWrap: "wrap",
          gap: "0.5rem",
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
          Entropy volume law comparison (§6)
        </h3>
        <span
          style={{
            fontSize: "0.6875rem",
            fontFamily: "var(--font-mono, monospace)",
            padding: "0.125rem 0.5rem",
            borderRadius: "0.25rem",
            background: "var(--wash)",
            color: "var(--accent)",
            border: "1px solid var(--line)",
          }}
        >
          V/V₀ = {volumeRatio.toFixed(2)} | ln(V/V₀) = {Math.log(volumeRatio).toFixed(3)}
        </span>
      </div>
      <p className="fine" style={{ margin: 0, fontSize: "0.75rem" }}>
        Side-by-side mathematical structure: Wien radiation entropy vs. Boltzmann ideal gas entropy
        under identical isothermal volume changes.
      </p>

      <svg
        viewBox={`0 0 ${width} ${height}`}
        role="img"
        aria-label="Side-by-side comparison of radiation and gas entropy volume laws"
        style={{
          width: "100%",
          height: "auto",
          background: "var(--panel)",
          border: "1px solid var(--line)",
          borderRadius: "0.25rem",
          overflow: "hidden",
        }}
      >
        {/* Left Column: Monochromatic Radiation */}
        <g transform="translate(20, 24)">
          <rect
            x="0"
            y="0"
            width="260"
            height="180"
            rx="6"
            fill="var(--wash)"
            stroke={isMatch ? "var(--plot)" : "var(--line)"}
            strokeWidth={isMatch ? "2" : "1"}
          />
          <text
            x="14"
            y="24"
            fontSize="12"
            fill="var(--plot)"
            fontWeight="bold"
            fontFamily="var(--font-mono, monospace)"
          >
            Monochromatic Radiation (§4)
          </text>
          <text
            x="14"
            y="48"
            fontSize="11"
            fill="var(--ink)"
            fontFamily="var(--font-mono, monospace)"
          >
            S − S₀ = (E / βν) · ln(V / V₀)
          </text>
          <text
            x="14"
            y="70"
            fontSize="10"
            fill="var(--muted)"
            fontFamily="var(--font-mono, monospace)"
          >
            = (R/N) · [ (N·E)/(R·β·ν) ] · ln(V/V₀)
          </text>

          {/* Radiation Values */}
          <line x1="14" y1="84" x2="246" y2="84" stroke="var(--line)" strokeWidth="1" />
          <text x="14" y="104" fontSize="10" fill="var(--muted)">
            Enclosed energy E:
          </text>
          <text
            x="246"
            y="104"
            textAnchor="end"
            fontSize="10"
            fill="var(--ink)"
            fontFamily="var(--font-mono, monospace)"
          >
            {(radiationEnergy * 1e9).toFixed(3)} nJ
          </text>
          <text x="14" y="122" fontSize="10" fill="var(--muted)">
            Frequency ν:
          </text>
          <text
            x="246"
            y="122"
            textAnchor="end"
            fontSize="10"
            fill="var(--ink)"
            fontFamily="var(--font-mono, monospace)"
          >
            {(frequency * 1e-12).toFixed(1)} THz
          </text>
          <text x="14" y="140" fontSize="10" fill="var(--muted)">
            Entropy change ΔS:
          </text>
          <text
            x="246"
            y="140"
            textAnchor="end"
            fontSize="10"
            fill="var(--plot)"
            fontFamily="var(--font-mono, monospace)"
            fontWeight="600"
          >
            <SciSvg value={radiationEntropy} digits={4} /> J/K
          </text>
          <text x="14" y="158" fontSize="10" fill="var(--muted)">
            Effective count n<SubSvg>eff</SubSvg>:
          </text>
          <text
            x="246"
            y="158"
            textAnchor="end"
            fontSize="10"
            fill="var(--accent)"
            fontFamily="var(--font-mono, monospace)"
            fontWeight="bold"
          >
            <SciSvg value={effectiveCount} digits={4} />
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
            fill="var(--wash)"
            stroke={isMatch ? "var(--accent)" : "var(--line)"}
            strokeWidth={isMatch ? "2" : "1"}
          />
          <text
            x="14"
            y="24"
            fontSize="12"
            fill="var(--accent)"
            fontWeight="bold"
            fontFamily="var(--font-mono, monospace)"
          >
            Ideal Gas / Discrete Particles (§5)
          </text>
          <text
            x="14"
            y="48"
            fontSize="11"
            fill="var(--ink)"
            fontFamily="var(--font-mono, monospace)"
          >
            S − S₀ = (R/N) · n · ln(V / V₀)
          </text>
          <text
            x="14"
            y="70"
            fontSize="10"
            fill="var(--muted)"
            fontFamily="var(--font-mono, monospace)"
          >
            = k<SubSvg>B</SubSvg> · n · ln(V/V₀)
          </text>

          {/* Gas Values */}
          <line x1="14" y1="84" x2="246" y2="84" stroke="var(--line)" strokeWidth="1" />
          <text x="14" y="104" fontSize="10" fill="var(--muted)">
            Gas particle count n:
          </text>
          <text
            x="246"
            y="104"
            textAnchor="end"
            fontSize="10"
            fill="var(--ink)"
            fontFamily="var(--font-mono, monospace)"
            fontWeight="bold"
          >
            {gasParticles}
          </text>
          <text x="14" y="122" fontSize="10" fill="var(--muted)">
            Gas constant R/N = k<SubSvg>B</SubSvg>:
          </text>
          <text
            x="246"
            y="122"
            textAnchor="end"
            fontSize="10"
            fill="var(--ink)"
            fontFamily="var(--font-mono, monospace)"
          >
            1.381 × 10⁻²³ J/K
          </text>
          <text x="14" y="140" fontSize="10" fill="var(--muted)">
            Entropy change ΔS:
          </text>
          <text
            x="246"
            y="140"
            textAnchor="end"
            fontSize="10"
            fill="var(--accent)"
            fontFamily="var(--font-mono, monospace)"
            fontWeight="600"
          >
            <SciSvg value={gasEntropy} digits={4} /> J/K
          </text>
          <text x="14" y="158" fontSize="10" fill="var(--muted)">
            Quantum energy ε = h·ν:
          </text>
          <text
            x="246"
            y="158"
            textAnchor="end"
            fontSize="10"
            fill="var(--plot)"
            fontFamily="var(--font-mono, monospace)"
            fontWeight="bold"
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
            fill="var(--panel)"
            stroke={isMatch ? "var(--plot)" : "var(--line)"}
            strokeWidth="2"
          />
          <text x="0" y="4" textAnchor="middle" fontSize="12" fill="var(--ink)" fontWeight="bold">
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
            fill={isMatch ? "rgba(16, 185, 129, 0.15)" : "var(--wash)"}
            stroke={isMatch ? "var(--plot)" : "var(--line)"}
          />
          <text
            x="270"
            y="20"
            textAnchor="middle"
            fontSize="11"
            fontFamily="var(--font-mono, monospace)"
          >
            {isMatch ? (
              <tspan fill="var(--plot)">
                The laws match: n<SubSvg>eff</SubSvg> = NE/(Rβν) = E/(hν), so each quantum carries ε
                = Rβν/N = hν = {quantumEnergyEv.toFixed(4)} eV
              </tspan>
            ) : selectedSubexpression !== "none" ? (
              <tspan fill="var(--ink)">
                With this term the two laws differ: it is not the particle count n
              </tspan>
            ) : (
              <tspan fill="var(--muted)">Choose an expression to test the match</tspan>
            )}
          </text>
        </g>
      </svg>
    </div>
  );
}
