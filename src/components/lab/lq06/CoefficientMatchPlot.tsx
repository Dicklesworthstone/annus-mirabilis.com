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
      className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg p-4 shadow-sm"
      data-view-id="lq-06-side-by-side"
    >
      <div className="flex justify-between items-center mb-3">
        <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">
          Side-by-Side Entropy Volume Laws (§6 The Move)
        </h3>
        <span className="text-xs font-mono px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400">
          V/V₀ = {volumeRatio.toFixed(2)}
        </span>
      </div>

      <svg
        viewBox="0 0 700 280"
        className="w-full h-auto"
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
          <marker id="arrow" viewBox="0 0 10 10" refX="5" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
            <path d="M 0 0 L 10 5 L 0 10 z" fill="#64748b" />
          </marker>
        </defs>

        {/* Left Box: Radiation Side */}
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
          <text x="15" y="28" fill="#e11d48" className="text-xs font-bold font-sans">
            Wien Monochromatic Radiation (§4)
          </text>
          <text x="15" y="52" fill="#475569" className="text-[11px] font-sans">
            E = {energyNJ} nJ · ν = {freqTHz} THz
          </text>

          {/* Radiation Entropy Formula */}
          <rect x="15" y="65" width="270" height="42" rx="4" fill="#ffffff" stroke="#cbd5e1" strokeWidth="1" className="dark:fill-slate-800 dark:stroke-slate-700" />
          <text x="150" y="92" textAnchor="middle" fill="#0f172a" className="text-xs font-mono font-bold dark:fill-slate-100">
            S - S₀ = (E / βν) · ln(V/V₀)
          </text>

          <text x="15" y="128" fill="#64748b" className="text-[11px] font-sans">
            With Boltzmann&apos;s constant k_B = R/N:
          </text>
          <rect x="15" y="136" width="270" height="34" rx="4" fill="#fff1f2" stroke="#fecdd3" strokeWidth="1" className="dark:fill-rose-950/30 dark:stroke-rose-900" />
          <text x="150" y="158" textAnchor="middle" fill="#be123c" className="text-xs font-mono font-bold dark:fill-rose-300">
            = (R/N) · [ N·E / (R·β·ν) ] · ln(V/V₀)
          </text>
        </g>

        {/* Right Box: Ideal Gas Side */}
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
          <text x="15" y="28" fill="#0284c7" className="text-xs font-bold font-sans">
            Ideal Gas / Solute Molecules (§5)
          </text>
          <text x="15" y="52" fill="#475569" className="text-[11px] font-sans">
            n = {gasParticles} independent particles
          </text>

          {/* Gas Entropy Formula */}
          <rect x="15" y="65" width="270" height="42" rx="4" fill="#ffffff" stroke="#cbd5e1" strokeWidth="1" className="dark:fill-slate-800 dark:stroke-slate-700" />
          <text x="150" y="92" textAnchor="middle" fill="#0f172a" className="text-xs font-mono font-bold dark:fill-slate-100">
            S - S₀ = (R/N) · ln W
          </text>

          <text x="15" y="128" fill="#64748b" className="text-[11px] font-sans">
            Independent points W = (V/V₀)ⁿ:
          </text>
          <rect x="15" y="136" width="270" height="34" rx="4" fill="#f0f9ff" stroke="#bae6fd" strokeWidth="1" className="dark:fill-sky-950/30 dark:stroke-sky-900" />
          <text x="150" y="158" textAnchor="middle" fill="#0369a1" className="text-xs font-mono font-bold dark:fill-sky-300">
            = (R/N) · [ n ] · ln(V/V₀)
          </text>
        </g>

        {/* Center Connection Arrow & Verdict */}
        <g transform="translate(320, 95)">
          <path d="M 0 15 L 60 15" stroke="#94a3b8" strokeWidth="2" strokeDasharray="3 3" />
          <circle cx="30" cy="15" r="14" fill="#f8fafc" stroke="#cbd5e1" strokeWidth="1.5" className="dark:fill-slate-800 dark:stroke-slate-600" />
          <text x="30" y="19" textAnchor="middle" fill="#475569" className="text-xs font-bold dark:fill-slate-300">
            ≡
          </text>
        </g>

        {/* Bottom Equivalence Banner */}
        <g transform="translate(20, 215)">
          <rect
            x="0"
            y="0"
            width="660"
            height="55"
            rx="6"
            fill={hasSelection && isMatch ? "#ecfdf5" : hasSelection ? "#fff1f2" : "#f8fafc"}
            stroke={hasSelection && isMatch ? "#10b981" : hasSelection ? "#f43f5e" : "#cbd5e1"}
            strokeWidth="1.5"
            className="dark:fill-slate-800/80"
          />
          {hasSelection && isMatch ? (
            <>
              <text x="330" y="24" textAnchor="middle" fill="#065f46" className="text-xs font-bold font-sans dark:fill-emerald-400">
                ✓ Exact Functional Identification: n_eff = N·E / (R·β·ν) = E / (h·ν)
              </text>
              <text x="330" y="44" textAnchor="middle" fill="#047857" className="text-xs font-mono dark:fill-emerald-300">
                n_eff = {effectiveCount.toExponential(4)} quanta · ε = {quantumEnergyEv.toFixed(4)} eV ({quantumEnergyEv.toFixed(2)} eV / packet)
              </text>
            </>
          ) : hasSelection ? (
            <>
              <text x="330" y="24" textAnchor="middle" fill="#9f1239" className="text-xs font-bold font-sans dark:fill-rose-400">
                ✗ Subexpression Mismatch
              </text>
              <text x="330" y="44" textAnchor="middle" fill="#be123c" className="text-xs font-sans dark:fill-rose-300">
                The selected term does not match the dimensionless exponent n in S - S₀ = (R/N) n ln(V/V₀).
              </text>
            </>
          ) : (
            <>
              <text x="330" y="24" textAnchor="middle" fill="#475569" className="text-xs font-medium font-sans dark:fill-slate-300">
                Select the subexpression in the controls above to test the correspondence
              </text>
              <text x="330" y="44" textAnchor="middle" fill="#64748b" className="text-[11px] font-mono dark:fill-slate-400">
                Radiation coeff: {radVolumeCoeff.toExponential(3)} J/K ↔ Gas coeff: {gasVolumeCoeff.toExponential(3)} J/K
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
      className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg p-4 shadow-sm"
      data-view-id="lq-06-mean-energy-strip"
    >
      <div className="flex justify-between items-center mb-2">
        <h4 className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300">
          Wien Spectrum Mean Quantum Energy vs Molecule Kinetic Energy (§6)
        </h4>
        <span className="text-xs font-mono text-slate-500">T = {temperatureK} K</span>
      </div>

      <p className="text-xs text-slate-600 dark:text-slate-400 mb-4">
        Integrating over a full Wien spectrum, the average energy of a light quantum is exactly twice
        the average translational kinetic energy of a gas molecule:
      </p>

      <svg
        viewBox="0 0 680 140"
        className="w-full h-auto"
        role="img"
        aria-label="Mean quantum energy compared to molecule translational kinetic energy"
      >
        {/* Wien Quantum Bar */}
        <g transform="translate(20, 20)">
          <text x="0" y="16" fill="#0f172a" className="text-xs font-bold dark:fill-slate-100">
            Wien Light Quantum Mean Energy: ⟨ε⟩ = 3 k_B T
          </text>
          <rect x="0" y="26" width={barWidth} height="20" rx="3" fill="#f1f5f9" className="dark:fill-slate-800" />
          <rect x="0" y="26" width={wienWidth} height="20" rx="3" fill="#f43f5e" />
          <text x={wienWidth + 10} y="41" fill="#be123c" className="text-xs font-mono font-bold dark:fill-rose-400">
            {meanQuantumEnergyEv.toFixed(4)} eV
          </text>
        </g>

        {/* Gas Molecule Bar */}
        <g transform="translate(20, 80)">
          <text x="0" y="16" fill="#0f172a" className="text-xs font-bold dark:fill-slate-100">
            Gas Molecule Kinetic Energy: ⟨E_kin⟩ = 3/2 k_B T
          </text>
          <rect x="0" y="26" width={barWidth} height="20" rx="3" fill="#f1f5f9" className="dark:fill-slate-800" />
          <rect x="0" y="26" width={gasWidth} height="20" rx="3" fill="#0ea5e9" />
          <text x={gasWidth + 10} y="41" fill="#0284c7" className="text-xs font-mono font-bold dark:fill-sky-400">
            {moleculeKineticEnergyEv.toFixed(4)} eV
          </text>
        </g>

        {/* 2:1 Badge */}
        <g transform="translate(560, 45)">
          <rect x="0" y="0" width="100" height="50" rx="6" fill="#ecfdf5" stroke="#10b981" strokeWidth="1" className="dark:fill-emerald-950/40 dark:stroke-emerald-800" />
          <text x="50" y="22" textAnchor="middle" fill="#065f46" className="text-[10px] font-bold uppercase tracking-wider dark:fill-emerald-300">
            Exact Ratio
          </text>
          <text x="50" y="42" textAnchor="middle" fill="#047857" className="text-base font-mono font-bold dark:fill-emerald-200">
            {ratio.toFixed(1)} : 1
          </text>
        </g>
      </svg>
    </div>
  );
}
