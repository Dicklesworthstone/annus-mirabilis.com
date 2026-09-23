"use client";

import { Sci } from "../Sci.tsx";

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
  /** The expression the reader put in the bracket, as it is printed, or undefined before a choice. */
  selectedLabel?: string | undefined;
}>;

/**
 * The two entropy laws, side by side, with the bracket the lab's question is about.
 *
 * This was a 700-unit SVG of two formula cards, so on a 390px phone its text drew at 5.5px. It is
 * now HTML: the cards sit side by side where there is room, stack on a phone, and set their text
 * at the page's own sizes. The radiation card used to print the rewritten law with the answer
 * already in the bracket, "(R/N) · [N·E/(R·β·ν)] · ln(V/V₀)", beside the gas law's "[n]", which
 * answered the question before the reader chose. The bracket now holds "?" until a choice, then
 * the chosen expression, with "=" when it reproduces the law and "≠" when it does not.
 */
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
  selectedLabel,
}: CoefficientMatchPlotProps) {
  const freqTHz = (frequencyHz / 1e12).toFixed(1);
  const energyNJ = (radiationEnergyJ * 1e9).toFixed(3);
  const bracket = hasSelection && selectedLabel ? selectedLabel : "?";
  const relation = !hasSelection ? "=" : isMatch ? "=" : "≠";

  return (
    <figure className="lq06-laws" data-view-id="lq-06-side-by-side">
      <figcaption className="lq06-laws-head">
        <h3>Side-by-side entropy volume laws (§6, the move)</h3>
        <span className="lq06-laws-ratio">V/V₀ = {volumeRatio.toFixed(2)}</span>
      </figcaption>
      <div className="lq06-laws-pair">
        <section className="lq06-law lq06-law-radiation" aria-label="Radiation">
          <h4>Wien monochromatic radiation (§4)</h4>
          <p className="lq06-law-given">
            E = {energyNJ} nJ, ν = {freqTHz} THz
          </p>
          <p className="lq06-law-eq">S − S₀ = (E/βν) · ln(V/V₀)</p>
          <p className="lq06-law-given">Written with Boltzmann’s constant, k = R/N:</p>
          <p className="lq06-law-eq" data-bracket={hasSelection ? "chosen" : "empty"}>
            {relation} (R/N) · [ <span className="lq06-law-bracket">{bracket}</span> ] · ln(V/V₀)
          </p>
        </section>
        <span className="lq06-laws-link" aria-hidden="true">
          ≡
        </span>
        <section className="lq06-law lq06-law-gas" aria-label="Gas">
          <h4>Ideal gas / solute molecules (§5)</h4>
          <p className="lq06-law-given">n = {gasParticles} independent particles</p>
          <p className="lq06-law-eq">S − S₀ = (R/N) · ln W</p>
          <p className="lq06-law-given">Independent positions, W = (V/V₀)ⁿ:</p>
          <p className="lq06-law-eq">
            = (R/N) · [ <span className="lq06-law-bracket">n</span> ] · ln(V/V₀)
          </p>
        </section>
      </div>
      <p className="lq06-laws-verdict" role="status">
        {hasSelection && isMatch ? (
          <>
            The laws match: n_eff = NE/(Rβν) = E/(hν) = <Sci value={effectiveCount} digits={4} />{" "}
            quanta, each carrying ε = hν = {quantumEnergyEv.toFixed(4)} eV.
          </>
        ) : hasSelection ? (
          <>With this term the two laws differ: it is not the exponent n of the gas law.</>
        ) : (
          <>
            Which expression goes in the bracket? Choose one in the controls. Coefficients of
            ln(V/V₀) now: radiation <Sci value={radVolumeCoeff} digits={3} /> J/K, gas{" "}
            <Sci value={gasVolumeCoeff} digits={3} /> J/K.
          </>
        )}
      </p>
    </figure>
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
          Wien spectrum mean quantum energy vs molecule kinetic energy (§6)
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
        {/* Wien Quantum Bar (Data series bar kept literal #f43f5e) */}
        <g transform="translate(20, 20)">
          <text x="0" y="16" fill="var(--ink)" fontSize="12" fontWeight="bold">
            Wien Light Quantum Mean Energy: ⟨ε⟩ = 3 k_B T
          </text>
          <rect x="0" y="26" width={barWidth} height="20" rx="3" fill="var(--wash)" />
          <rect x="0" y="26" width={wienWidth} height="20" rx="3" fill="#f43f5e" />
          <text
            x={wienWidth + 10}
            y="41"
            fill="var(--ink)"
            fontSize="12"
            fontFamily="monospace"
            fontWeight="bold"
          >
            {meanQuantumEnergyEv.toFixed(4)} eV
          </text>
        </g>

        {/* Gas Molecule Bar (Data series bar kept literal #0ea5e9) */}
        <g transform="translate(20, 80)">
          <text x="0" y="16" fill="var(--ink)" fontSize="12" fontWeight="bold">
            Gas Molecule Kinetic Energy: ⟨E_kin⟩ = 3/2 k_B T
          </text>
          <rect x="0" y="26" width={barWidth} height="20" rx="3" fill="var(--wash)" />
          <rect x="0" y="26" width={gasWidth} height="20" rx="3" fill="#0ea5e9" />
          <text
            x={gasWidth + 10}
            y="41"
            fill="var(--ink)"
            fontSize="12"
            fontFamily="monospace"
            fontWeight="bold"
          >
            {moleculeKineticEnergyEv.toFixed(4)} eV
          </text>
        </g>

        {/* 2:1 Badge */}
        <g transform="translate(560, 45)">
          <rect
            x="0"
            y="0"
            width="100"
            height="50"
            rx="6"
            fill="var(--wash)"
            stroke="var(--line)"
            strokeWidth="1"
          />
          <text
            x="50"
            y="22"
            textAnchor="middle"
            fill="var(--muted)"
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
            fill="var(--ink)"
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
