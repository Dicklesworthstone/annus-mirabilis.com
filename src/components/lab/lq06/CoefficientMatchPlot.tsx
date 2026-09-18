"use client";

export type CoefficientMatchPlotProps = Readonly<{
  radiationEnergyJ: number;
  frequencyHz: number;
  volumeRatio: number;
  gasParticles: number;
  effectiveCount: number;
  quantumEnergyEv: number;
  radVolumeCoeff: number;
  gasVolumeCoeff: number;
  isMatch: boolean;
  hasSelection: boolean;
}>;

export function CoefficientMatchSideBySidePlot({
  radiationEnergyJ,
  frequencyHz,
  volumeRatio,
  gasParticles,
  effectiveCount,
  quantumEnergyEv,
  radVolumeCoeff,
  gasVolumeCoeff,
  isMatch,
  hasSelection,
}: CoefficientMatchPlotProps) {
  const freqTHz = (frequencyHz / 1e12).toFixed(1);
  const energyNJ = (radiationEnergyJ * 1e9).toFixed(3);

  return (
    <div
      style={{
        border: "1px solid var(--line)",
        borderRadius: "0.5rem",
        padding: "1rem",
        background: "var(--panel)",
      }}
      data-view-id="lq-06-side-by-side"
    >
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: "0.75rem",
          flexWrap: "wrap",
          gap: "0.25rem",
        }}
      >
        <h3
          style={{
            fontSize: "0.875rem",
            fontWeight: "bold",
            color: "var(--ink)",
            margin: 0,
          }}
        >
          Side-by-Side Entropy Volume Laws (§6 The Move)
        </h3>
        <span
          className="fine"
          style={{
            fontSize: "0.75rem",
            fontFamily: "var(--font-mono, monospace)",
            padding: "0.125rem 0.5rem",
            borderRadius: "0.25rem",
            background: "var(--wash)",
            color: "var(--muted)",
            border: "1px solid var(--line)",
          }}
        >
          V/V₀ = {volumeRatio.toFixed(2)}
        </span>
      </div>

      <svg
        viewBox="0 0 700 280"
        style={{ width: "100%", height: "auto" }}
        role="img"
        aria-label="Side-by-side comparison of Wien radiation entropy and Boltzmann gas entropy laws"
      >
        <defs>
          <linearGradient id="radGrad" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#f43f5e" stopOpacity="0.1" />
            <stop offset="100%" stopColor="#f43f5e" stopOpacity="0.02" />
          </linearGradient>
          <linearGradient id="gasGrad" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#0ea5e9" stopOpacity="0.1" />
            <stop offset="100%" stopColor="#0ea5e9" stopOpacity="0.02" />
          </linearGradient>
          <marker
            id="arrow"
            viewBox="0 0 10 10"
            refX="5"
            refY="5"
            markerWidth="6"
            markerHeight="6"
            orient="auto-start-reverse"
          >
            <path d="M 0 0 L 10 5 L 0 10 z" fill="#64748b" />
          </marker>
        </defs>

        {/* Left Box: Radiation Side (Data datum - kept literal rose) */}
        <g transform="translate(20, 20)">
          <rect
            x="0"
            y="0"
            width="300"
            height="180"
            rx="8"
            fill="url(#radGrad)"
            stroke="#f43f5e"
            strokeWidth="1.5"
          />
          <text x="15" y="28" fill="#e11d48" fontSize="12" fontWeight="bold">
            Wien Monochromatic Radiation (§4)
          </text>
          <text x="15" y="52" fill="var(--muted)" fontSize="11">
            E = {energyNJ} nJ · ν = {freqTHz} THz
          </text>

          {/* Radiation Entropy Formula */}
          <rect
            x="15"
            y="65"
            width="270"
            height="42"
            rx="4"
            fill="var(--panel)"
            stroke="var(--line)"
            strokeWidth="1"
          />
          <text
            x="150"
            y="92"
            textAnchor="middle"
            fill="var(--ink)"
            fontSize="12"
            fontFamily="monospace"
            fontWeight="bold"
          >
            S - S₀ = (E / βν) · ln(V/V₀)
          </text>

          <text x="15" y="128" fill="var(--muted)" fontSize="11">
            With Boltzmann&apos;s constant k_B = R/N:
          </text>
          <rect
            x="15"
            y="136"
            width="270"
            height="34"
            rx="4"
            fill="#fff1f2"
            stroke="#fecdd3"
            strokeWidth="1"
          />
          <text
            x="150"
            y="158"
            textAnchor="middle"
            fill="#be123c"
            fontSize="12"
            fontFamily="monospace"
            fontWeight="bold"
          >
            = (R/N) · [ N·E / (R·β·ν) ] · ln(V/V₀)
          </text>
        </g>

        {/* Right Box: Ideal Gas Side (Data datum - kept literal sky) */}
        <g transform="translate(380, 20)">
          <rect
            x="0"
            y="0"
            width="300"
            height="180"
            rx="8"
            fill="url(#gasGrad)"
            stroke="#0ea5e9"
            strokeWidth="1.5"
          />
          <text x="15" y="28" fill="#0284c7" fontSize="12" fontWeight="bold">
            Ideal Gas / Solute Molecules (§5)
          </text>
          <text x="15" y="52" fill="var(--muted)" fontSize="11">
            n = {gasParticles} independent particles
          </text>

          {/* Gas Entropy Formula */}
          <rect
            x="15"
            y="65"
            width="270"
            height="42"
            rx="4"
            fill="var(--panel)"
            stroke="var(--line)"
            strokeWidth="1"
          />
          <text
            x="150"
            y="92"
            textAnchor="middle"
            fill="var(--ink)"
            fontSize="12"
            fontFamily="monospace"
            fontWeight="bold"
          >
            S - S₀ = (R/N) · ln W
          </text>

          <text x="15" y="128" fill="var(--muted)" fontSize="11">
            Independent points W = (V/V₀)ⁿ:
          </text>
          <rect
            x="15"
            y="136"
            width="270"
            height="34"
            rx="4"
            fill="#f0f9ff"
            stroke="#bae6fd"
            strokeWidth="1"
          />
          <text
            x="150"
            y="158"
            textAnchor="middle"
            fill="#0369a1"
            fontSize="12"
            fontFamily="monospace"
            fontWeight="bold"
          >
            = (R/N) · [ n ] · ln(V/V₀)
          </text>
        </g>

        {/* Center Connection Arrow & Verdict */}
        <g transform="translate(320, 95)">
          <path d="M 0 15 L 60 15" stroke="var(--line)" strokeWidth="2" strokeDasharray="3 3" />
          <circle
            cx="30"
            cy="15"
            r="14"
            fill="var(--panel)"
            stroke="var(--line)"
            strokeWidth="1.5"
          />
          <text x="30" y="19" textAnchor="middle" fill="var(--ink)" fontSize="12" fontWeight="bold">
            ≡
          </text>
        </g>

        {/* Bottom Equivalence Banner (Data datum - kept literal green/rose) */}
        <g transform="translate(20, 215)">
          <rect
            x="0"
            y="0"
            width="660"
            height="55"
            rx="6"
            fill={hasSelection && isMatch ? "#ecfdf5" : hasSelection ? "#fff1f2" : "var(--wash)"}
            stroke={hasSelection && isMatch ? "#10b981" : hasSelection ? "#f43f5e" : "var(--line)"}
            strokeWidth="1.5"
          />
          {hasSelection && isMatch ? (
            <>
              <text
                x="330"
                y="24"
                textAnchor="middle"
                fill="#065f46"
                fontSize="12"
                fontWeight="bold"
              >
                ✓ Exact Functional Identification: n_eff = N·E / (R·β·ν) = E / (h·ν)
              </text>
              <text
                x="330"
                y="44"
                textAnchor="middle"
                fill="#047857"
                fontSize="12"
                fontFamily="monospace"
              >
                n_eff = {effectiveCount.toExponential(4)} quanta · ε = {quantumEnergyEv.toFixed(4)}{" "}
                eV ({quantumEnergyEv.toFixed(2)} eV / packet)
              </text>
            </>
          ) : hasSelection ? (
            <>
              <text
                x="330"
                y="24"
                textAnchor="middle"
                fill="#9f1239"
                fontSize="12"
                fontWeight="bold"
              >
                ✗ Subexpression Mismatch
              </text>
              <text x="330" y="44" textAnchor="middle" fill="#be123c" fontSize="12">
                The selected term does not match the dimensionless exponent n in S - S₀ = (R/N) n
                ln(V/V₀).
              </text>
            </>
          ) : (
            <>
              <text
                x="330"
                y="24"
                textAnchor="middle"
                fill="var(--muted)"
                fontSize="12"
                fontWeight="500"
              >
                Select the subexpression in the controls above to test the correspondence
              </text>
              <text
                x="330"
                y="44"
                textAnchor="middle"
                fill="var(--muted)"
                fontSize="11"
                fontFamily="monospace"
              >
                Radiation coeff: {radVolumeCoeff.toExponential(3)} J/K ↔ Gas coeff:{" "}
                {gasVolumeCoeff.toExponential(3)} J/K
              </text>
            </>
          )}
        </g>
      </svg>
    </div>
  );
}

export type MeanEnergyPlotProps = Readonly<{
  meanQuantumEnergyEv: number;
  moleculeKineticEnergyEv: number;
  temperatureK: number;
  ratio: number;
  ratioAt600THz: number;
}>;

export function MeanEnergyStripPlot({
  meanQuantumEnergyEv,
  moleculeKineticEnergyEv,
  temperatureK,
  ratio,
  ratioAt600THz,
}: MeanEnergyPlotProps) {
  const maxEv = Math.max(meanQuantumEnergyEv * 1.3, 1.0);
  const barWidth = 460;
  const wienWidth = Math.min((meanQuantumEnergyEv / maxEv) * barWidth, barWidth);
  const gasWidth = Math.min((moleculeKineticEnergyEv / maxEv) * barWidth, barWidth);

  return (
    <div
      style={{
        border: "1px solid var(--line)",
        borderRadius: "0.5rem",
        padding: "1rem",
        background: "var(--panel)",
      }}
      data-view-id="lq-06-mean-energy-strip"
    >
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: "0.5rem",
          flexWrap: "wrap",
          gap: "0.25rem",
        }}
      >
        <h4
          style={{
            fontSize: "0.75rem",
            fontWeight: "bold",
            textTransform: "uppercase",
            letterSpacing: "0.05em",
            color: "var(--ink)",
            margin: 0,
          }}
        >
          Wien Spectrum Mean Quantum Energy vs Molecule Kinetic Energy (§6)
        </h4>
        <span
          className="fine"
          style={{
            fontSize: "0.75rem",
            fontFamily: "var(--font-mono, monospace)",
          }}
        >
          T = {temperatureK} K
        </span>
      </div>

      <p
        className="fine"
        style={{
          fontSize: "0.75rem",
          marginBottom: "1rem",
        }}
      >
        Integrating over a full Wien spectrum, the average energy of a light quantum is exactly
        twice the average translational kinetic energy of a gas molecule (at 600 THz, monochromatic
        h·ν is {ratioAt600THz.toFixed(2)}× this mean quantum energy):
      </p>

      <svg
        viewBox="0 0 680 140"
        style={{ width: "100%", height: "auto" }}
        role="img"
        aria-label="Mean quantum energy compared to molecule translational kinetic energy"
      >
        {/* Wien Quantum Bar (Data datum - kept literal rose) */}
        <g transform="translate(20, 20)">
          <text x="0" y="16" fill="var(--ink)" fontSize="12" fontWeight="bold">
            Wien Light Quantum Mean Energy: ⟨ε⟩ = 3 k_B T
          </text>
          <rect x="0" y="26" width={barWidth} height="20" rx="3" fill="var(--wash)" />
          <rect x="0" y="26" width={wienWidth} height="20" rx="3" fill="#f43f5e" />
          <text
            x={wienWidth + 10}
            y="41"
            fill="#be123c"
            fontSize="12"
            fontFamily="monospace"
            fontWeight="bold"
          >
            {meanQuantumEnergyEv.toFixed(4)} eV
          </text>
        </g>

        {/* Gas Molecule Bar (Data datum - kept literal sky) */}
        <g transform="translate(20, 80)">
          <text x="0" y="16" fill="var(--ink)" fontSize="12" fontWeight="bold">
            Gas Molecule Kinetic Energy: ⟨E_kin⟩ = 3/2 k_B T
          </text>
          <rect x="0" y="26" width={barWidth} height="20" rx="3" fill="var(--wash)" />
          <rect x="0" y="26" width={gasWidth} height="20" rx="3" fill="#0ea5e9" />
          <text
            x={gasWidth + 10}
            y="41"
            fill="#0284c7"
            fontSize="12"
            fontFamily="monospace"
            fontWeight="bold"
          >
            {moleculeKineticEnergyEv.toFixed(4)} eV
          </text>
        </g>

        {/* 2:1 Badge (Data datum - kept literal emerald) */}
        <g transform="translate(560, 45)">
          <rect
            x="0"
            y="0"
            width="100"
            height="50"
            rx="6"
            fill="#ecfdf5"
            stroke="#10b981"
            strokeWidth="1"
          />
          <text
            x="50"
            y="22"
            textAnchor="middle"
            fill="#065f46"
            fontSize="10"
            fontWeight="bold"
            letterSpacing="0.05em"
          >
            Exact Ratio
          </text>
          <text
            x="50"
            y="42"
            textAnchor="middle"
            fill="#047857"
            fontSize="16"
            fontFamily="monospace"
            fontWeight="bold"
          >
            {ratio.toFixed(1)} : 1
          </text>
        </g>
      </svg>
    </div>
  );
}
