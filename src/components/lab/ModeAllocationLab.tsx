"use client";

import { type FormEvent, type ReactNode, useId, useState } from "react";
import {
  computeLq02Snapshot,
  DEFAULT_LQ02_INPUTS,
  type Lq02Inputs,
  type Lq02Snapshot,
  type RadiationResult,
  removeUpperLimit,
} from "../../experiments/lq02/session";
import { ExperimentSettings } from "./ExperimentSettings.tsx";
import { Sci } from "./Sci.tsx";

const NOT_MODELED = [
  "The mechanism coupling matter and radiation beyond Planck's stated equilibrium condition.",
  "Cavity shape and walls.",
  "The approach to equilibrium.",
  "Any quantum hypothesis.",
  "Measured spectra (a separate instrument shows those).",
] as const;

type Draft = Readonly<{ T: string; nuCutoff: string; probeFrequency: string }>;

function toDraft(inputs: Lq02Inputs): Draft {
  return {
    T: String(inputs.T),
    nuCutoff: String(inputs.nuCutoff),
    probeFrequency: String(inputs.probeFrequency),
  };
}

function fromDraft(draft: Draft): Lq02Inputs {
  return {
    T: Number(draft.T),
    nuCutoff: Number(draft.nuCutoff),
    probeFrequency: Number(draft.probeFrequency),
    constantSetId: "modern-si-2019",
  };
}

function formatValue(result: RadiationResult<number>, unit: string, digits = 6): ReactNode {
  if (result.status === "value")
    return (
      <>
        <Sci value={result.value} digits={digits} />
        {unit ? ` ${unit}` : ""}
      </>
    );
  if (result.status === "outside-domain") return `Not modeled here: ${result.reason}`;
  return result.status;
}

export function ModeAllocationLab({
  example = DEFAULT_LQ02_INPUTS,
  title = "Classical mode-energy allocation",
}: {
  example?: Lq02Inputs;
  title?: string;
}) {
  const id = useId();
  const [accepted, setAccepted] = useState<Lq02Inputs>(example);
  const [draft, setDraft] = useState<Draft>(() => toDraft(example));
  const [error, setError] = useState("");
  const [divergence, setDivergence] = useState<RadiationResult<number> | null>(null);
  const [predictWiden, setPredictWiden] = useState<"10x" | "1000x" | "levels-off" | null>(null);
  const [predictDiverge, setPredictDiverge] = useState<"yes" | "no" | null>(null);

  const snapshot: Lq02Snapshot = computeLq02Snapshot(accepted);

  function apply(next: Lq02Inputs) {
    if (
      !Number.isFinite(next.T) ||
      !Number.isFinite(next.nuCutoff) ||
      !Number.isFinite(next.probeFrequency)
    ) {
      setError("Every field must be a real, finite number. Check for a typo or an empty field.");
      return;
    }
    setAccepted(next);
    setDivergence(null);
    setError("");
  }

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    apply(fromDraft(draft));
  }

  function widen(factor: number) {
    const next = { ...accepted, nuCutoff: accepted.nuCutoff * factor };
    setDraft(toDraft(next));
    apply(next);
  }

  function handleRemoveUpperLimit() {
    setDivergence(removeUpperLimit(accepted));
  }

  return (
    <section
      className="laboratory"
      aria-labelledby={`${id}-title`}
      data-instrument-id="lq-02"
      data-execution-label="host"
    >
      <header className="lab-heading">
        <p className="eyebrow">LQ-02 · Classical mode-energy allocation</p>
        <h2 id={`${id}-title`}>{title}</h2>
      </header>

      <noscript>
        <p className="notice">
          JavaScript is off. The table below shows the complete worked example for the default
          settings, calculated when the site was built. Changing settings requires JavaScript.
        </p>
      </noscript>

      <div className="predict-card">
        <h3>Predict before you calculate</h3>
        <p>Widening the resonator range from 100 THz to 1000 THz changes the energy by:</p>
        <div className="actions">
          <button
            type="button"
            className={predictWiden === "10x" ? "primary" : "secondary"}
            onClick={() => setPredictWiden("10x")}
          >
            About ×10
          </button>
          <button
            type="button"
            className={predictWiden === "1000x" ? "primary" : "secondary"}
            onClick={() => setPredictWiden("1000x")}
          >
            About ×1000
          </button>
          <button
            type="button"
            className={predictWiden === "levels-off" ? "primary" : "secondary"}
            onClick={() => setPredictWiden("levels-off")}
          >
            It levels off
          </button>
        </div>
        {predictWiden && (
          <p className="fine">
            The model: the classical energy density grows as the cube of the cutoff frequency, so
            widening tenfold multiplies the energy up to the cutoff by 1000. The widen-tenfold
            action below shows it.
          </p>
        )}
        <p className="fine">
          Before removing the upper limit: will the total settle at a finite value?
        </p>
        <div className="actions">
          <button
            type="button"
            className={predictDiverge === "yes" ? "primary" : "secondary"}
            onClick={() => setPredictDiverge("yes")}
          >
            Yes, it settles
          </button>
          <button
            type="button"
            className={predictDiverge === "no" ? "primary" : "secondary"}
            onClick={() => setPredictDiverge("no")}
          >
            No, it grows without bound
          </button>
        </div>
        {predictDiverge && (
          <p className="fine">
            The model: every resonator frequency receives the same mean energy, so widening the
            range without limit grows the total without bound. Press &ldquo;remove the upper
            limit&rdquo; below and read the refusal: this model&apos;s total has no finite value.
          </p>
        )}
      </div>

      <div className="lab-columns">
        <form onSubmit={submit} aria-label="Mode-allocation settings" className="controls">
          <div className="actions">
            <button type="button" onClick={() => widen(10)}>
              Widen tenfold
            </button>
            <button type="button" onClick={() => widen(0.1)}>
              Narrow tenfold
            </button>
            <button type="button" onClick={handleRemoveUpperLimit}>
              Remove the upper limit
            </button>
          </div>
          <ExperimentSettings contents="temperature, cutoff and probe frequencies">
            <label htmlFor={`${id}-T`}>Temperature (K)</label>
            <input
              id={`${id}-T`}
              inputMode="decimal"
              value={draft.T}
              onChange={(e) => setDraft({ ...draft, T: e.target.value })}
            />

            <label htmlFor={`${id}-nuc`}>Highest resonator frequency, the cutoff (Hz)</label>
            <input
              id={`${id}-nuc`}
              inputMode="decimal"
              value={draft.nuCutoff}
              onChange={(e) => setDraft({ ...draft, nuCutoff: e.target.value })}
            />

            <label htmlFor={`${id}-probe`}>Probe frequency, for the share-above readout (Hz)</label>
            <input
              id={`${id}-probe`}
              inputMode="decimal"
              value={draft.probeFrequency}
              onChange={(e) => setDraft({ ...draft, probeFrequency: e.target.value })}
            />

            <button type="submit">Apply</button>
          </ExperimentSettings>
          {error && (
            <p className="error" role="alert">
              {error}
            </p>
          )}
        </form>

        <div className="readouts">
          <table>
            <tbody>
              <tr>
                <th scope="row">Mean energy per resonator oscillation</th>
                <td>{formatValue(snapshot.meanResonatorEnergy, "J")}</td>
              </tr>
              <tr>
                <th scope="row">Energy with resonators up to the cutoff</th>
                <td>{formatValue(snapshot.energyUpToCutoff, "J/m³")}</td>
              </tr>
              <tr>
                <th scope="row">Share of that energy above the probe frequency</th>
                <td>{formatValue(snapshot.shareAboveProbe, "")}</td>
              </tr>
              <tr>
                <th scope="row">Energy after widening the cutoff tenfold</th>
                <td>{formatValue(snapshot.tenfoldWidenedEnergy, "J/m³")}</td>
              </tr>
              <tr>
                <th scope="row">Ratio: tenfold-widened energy ÷ current energy</th>
                <td>
                  {snapshot.growthRatio === null
                    ? "not computable"
                    : snapshot.growthRatio.toFixed(3)}
                </td>
              </tr>
            </tbody>
          </table>

          <p className="model-note">
            With resonators up to <Sci value={accepted.nuCutoff} digits={3} /> Hz at {accepted.T} K,
            the classical allocation holds{" "}
            {snapshot.energyUpToCutoff.status === "value" ? (
              <Sci value={snapshot.energyUpToCutoff.value} digits={3} />
            ) : (
              "an unmodeled amount"
            )}{" "}
            J per cubic meter; each tenfold widening multiplies it by 1000. Every resonator
            oscillation carries the same mean energy <var>k</var>
            <sub>B</sub>
            <var>T</var> (source notation (<var>R</var>/<var>N</var>)<var>T</var>), which §1 notes
            is two-thirds of a free molecule's mean kinetic energy.
          </p>

          <p className="model-note">
            §2's Avogadro match and §4's later entropy argument (a separate instrument) use two
            disjoint limits of the same spectrum: the classical region, admitted at the 1% criterion
            for x ≤ {snapshot.regimeBoundaries.classicalBoundaryX.toFixed(7)}, and the Wien region,
            admitted at x ≥ {snapshot.regimeBoundaries.wienBoundaryX.toFixed(6)}. Meeting both
            arguments does not mean one "quantum regime" supplied both numbers.
          </p>

          {divergence && divergence.status === "outside-domain" && (
            <div className="refusal" role="status">
              <p>
                <strong>Not modeled here:</strong> {divergence.reason}
              </p>
              <p className="fine">
                The last accepted, finite-range snapshot above (up to{" "}
                <Sci value={accepted.nuCutoff} digits={3} /> Hz) stays visible and is not replaced
                by this refusal.
              </p>
            </div>
          )}

          <details>
            <summary>The historical Avogadro readout, from Einstein's §2 constants</summary>
            <table>
              <tbody>
                <tr>
                  <th scope="row">N, from Einstein's printed §2 constants (historical)</th>
                  <td>
                    <Sci value={snapshot.avogadro.avogadroConstant} digits={6} /> mol⁻¹
                  </td>
                </tr>
                <tr>
                  <th scope="row">N, as printed in §2</th>
                  <td>
                    <Sci value={snapshot.avogadro.printedAvogadroConstant} digits={2} /> mol⁻¹
                  </td>
                </tr>
                <tr>
                  <th scope="row">N_A, defined, 2019 SI (modern)</th>
                  <td>
                    <Sci value={snapshot.avogadro.modernComparisons.modernAvogadro} digits={8} />{" "}
                    mol⁻¹
                  </td>
                </tr>
                <tr>
                  <th scope="row">Hydrogen-atom mass from the printed N (historical)</th>
                  <td>
                    <Sci value={snapshot.avogadro.printedHydrogenAtomMassGrams} digits={2} /> g
                  </td>
                </tr>
                <tr>
                  <th scope="row">Hydrogen-atom mass, modern (labeled modern)</th>
                  <td>
                    <Sci
                      value={snapshot.avogadro.modernComparisons.modernHydrogenAtomMassGrams}
                      digits={6}
                    />{" "}
                    g
                  </td>
                </tr>
              </tbody>
            </table>
            <p className="fine">
              α is a suspected historical typographical correction (10⁻⁵⁷, not the witness's 10⁻⁵⁶);
              R = 8.31×10⁷ erg mol⁻¹ K⁻¹ and L = 3×10¹⁰ cm s⁻¹ are declared editorial inputs, not
              printed values, since §2 does not appear to print either. This readout is never mixed
              with a modern constant in the same number.
            </p>
          </details>

          <details>
            <summary>What this model leaves out</summary>
            {NOT_MODELED.map((line) => (
              <p key={line}>• {line}</p>
            ))}
          </details>

          <details>
            <summary>
              Show the calculation owner: which real functions computed these numbers
            </summary>
            <p>
              src/physics/reference/radiation/classical.ts (classicalCutoffEnergyDensity,
              classicalTotalEnergy, meanResonatorEnergy),
              src/physics/reference/radiation/avogadro.ts (avogadroFromPlanckConstants),
              src/physics/reference/radiation/spectra.ts (regimeRelativeErrors), and
              src/experiments/lq02/session.ts (composing the snapshot; this component never
              recomputes any of these).
            </p>
          </details>
        </div>
      </div>
    </section>
  );
}
