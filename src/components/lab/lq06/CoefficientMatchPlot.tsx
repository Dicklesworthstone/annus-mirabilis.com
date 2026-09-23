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
        <h4 className="lq06-energy-title">
          Wien spectrum mean quantum energy against a gas molecule’s kinetic energy (§6)
        </h4>
        <span
          className="fine"
          style={{
            fontSize: "var(--type-fine)",
            fontFamily: "var(--font-mono, monospace)",
          }}
        >
          T = {temperatureK} K
        </span>
      </div>

      <p
        className="fine"
        style={{
          fontSize: "var(--type-fine)",
          marginBottom: "1rem",
        }}
      >
        Integrating over a full Wien spectrum, the average energy of a light quantum is exactly
        twice the average translational kinetic energy of a gas molecule (at 600 THz, monochromatic
        h·ν is {ratioAt600THz.toFixed(2)}× this mean quantum energy):
      </p>

      {/* Two bars and a ratio are HTML, not a drawing: in a 680-unit SVG every word shrank to 5.6px
          on a phone. The bars keep the drawing's scale (1.3 times the quantum's mean energy, or
          1 eV, whichever is larger) and its two data colours. */}
      <div className="lq06-energy-bars">
        <div className="lq06-energy-row">
          <p className="lq06-energy-label">
            Mean energy of a light quantum in a Wien spectrum, ⟨ε⟩ = 3k<sub>B</sub>T
          </p>
          <div className="lq06-energy-track">
            <span className="lq06-energy-rail" aria-hidden="true">
              <span
                className="lq06-energy-bar"
                style={{
                  width: `${((wienWidth / barWidth) * 100).toFixed(1)}%`,
                  background: "#f43f5e",
                }}
              />
            </span>
            <span className="lq06-energy-value">{meanQuantumEnergyEv.toFixed(4)} eV</span>
          </div>
        </div>
        <div className="lq06-energy-row">
          <p className="lq06-energy-label">
            Mean translational kinetic energy of a gas molecule, ⟨E<sub>kin</sub>⟩ = (3/2)k
            <sub>B</sub>T
          </p>
          <div className="lq06-energy-track">
            <span className="lq06-energy-rail" aria-hidden="true">
              <span
                className="lq06-energy-bar"
                style={{
                  width: `${((gasWidth / barWidth) * 100).toFixed(1)}%`,
                  background: "#0ea5e9",
                }}
              />
            </span>
            <span className="lq06-energy-value">{moleculeKineticEnergyEv.toFixed(4)} eV</span>
          </div>
        </div>
        <p className="lq06-energy-ratio">
          Ratio of the two: <strong>{ratio.toFixed(1)} : 1</strong>
        </p>
      </div>
    </div>
  );
}
