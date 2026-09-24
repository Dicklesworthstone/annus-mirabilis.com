"use client";

import { type FormEvent, type ReactNode, useId, useState } from "react";
import { executionLabelFor } from "../../experiments/labels/executionLabelFor.ts";
import { executionLabelAttributes } from "../../experiments/labels/resultAttributes.ts";
import { LQ02_CAPTION } from "../../experiments/lq02/definition.ts";
import {
  computeLq02Snapshot,
  DEFAULT_LQ02_INPUTS,
  type Lq02Inputs,
  type Lq02Snapshot,
  type RadiationResult,
  removeUpperLimit,
} from "../../experiments/lq02/session";
import { ExperimentSettings } from "./ExperimentSettings.tsx";
import { display, fixed } from "./presentation.ts";
import { Sci } from "./Sci.tsx";
import { withScripts } from "./subscripts.tsx";

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
  const [accepted, setAcceptedInputs] = useState<Lq02Inputs>(example);
  // The harness DOM contract's runtime identity. With no instance store, evaluation is synchronous on
  // an accepted apply: nothing is ever pending, and the requested input is the accepted one. The
  // revision counts accepted applies, the convention ShelfOpticsLab already uses.
  const [revision, setRevision] = useState(0);
  function setAccepted(next: Lq02Inputs) {
    setAcceptedInputs(next);
    setRevision((r) => r + 1);
  }
  // Earned per state (am-inst-execution-labels-5ywv): the build's worked example until a reader's
  // settings are accepted, a host calculation after. There is no instance store here, so the test is
  // identity with the state the lab started from, as in the reasoning workbenches (12a926b9).
  const executionKind = accepted === example ? "static-example" : "host-accepted";
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
    // Each field is a positive quantity. A zero or negative value used to reach the kernel, and the
    // table printed its outside-domain reason in every row: "Not modeled here: Cutoff frequency must
    // be positive and finite (got -1e+300)."
    if (next.T <= 0) {
      setError("Enter a temperature above 0 K.");
      return;
    }
    if (next.nuCutoff <= 0) {
      setError("Enter a highest resonator frequency above 0 Hz.");
      return;
    }
    if (next.probeFrequency <= 0) {
      setError("Enter a probe frequency above 0 Hz.");
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
      data-instance-id={id}
      data-run-id={`${id}-${revision}`}
      data-snapshot-version={revision}
      data-input-revision={revision}
      data-accepted-input-revision={revision}
      data-pending="false"
      {...executionLabelAttributes(executionKind)}
    >
      <header className="lab-heading">
        <p className="eyebrow">Classical mode-energy allocation</p>
        <h2 id={`${id}-title`}>{title}</h2>
        <span className="badge">{executionLabelFor(executionKind).text}</span>
      </header>

      <noscript>
        <p className="notice">
          JavaScript is off. The table below shows the complete worked example for the default
          settings, calculated when the site was built. Changing settings requires JavaScript.
        </p>
      </noscript>

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
                    : fixed(snapshot.growthRatio, 3)}
                </td>
              </tr>
            </tbody>
          </table>

          <p className="model-note">
            {/* Only a computed energy is stated. The fallback read "holds an unmodeled amount J per
                cubic meter", with the unit left dangling, whenever the cutoff was refused. */}
            {snapshot.energyUpToCutoff.status === "value" && (
              <>
                With resonators up to <Sci value={accepted.nuCutoff} digits={3} /> Hz at{" "}
                {display(accepted.T)} K, the classical allocation holds{" "}
                <Sci value={snapshot.energyUpToCutoff.value} digits={3} /> J per cubic meter; each
                tenfold widening multiplies it by 1000.{" "}
              </>
            )}
            Every resonator oscillation carries the same mean energy <var>k</var>
            <sub>B</sub>
            <var>T</var> (source notation (<var>R</var>/<var>N</var>)<var>T</var>), which §1 notes
            is two-thirds of a free molecule's mean kinetic energy.
          </p>

          <p className="model-note">
            §2's Avogadro match and §4's later entropy argument (a separate instrument) use two
            disjoint limits of the same spectrum: the classical region, admitted at the 1% criterion
            for x ≤ {fixed(snapshot.regimeBoundaries.classicalBoundaryX, 7)}, and the Wien region,
            admitted at x ≥ {fixed(snapshot.regimeBoundaries.wienBoundaryX, 6)}. Meeting both
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
                  <th scope="row">
                    N<sub>A</sub>, defined, 2019 SI (modern)
                  </th>
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

          <p className="fine">
            Not modeled: {NOT_MODELED.map((line) => line.replace(/\.$/, "")).join("; ")}.
          </p>

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
      {/* The prediction sits under the instrument in a closed disclosure, as it does on every other
          lab. Open above it, it was 423px between a phone's heading and the controls. */}
      <details className="lab-predict">
        <summary>Predict before you calculate</summary>
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
            action above shows it.
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
            limit&rdquo; above and read the refusal: this model&apos;s total has no finite value.
          </p>
        )}
      </details>

      {/* The four readings follow the reader's detail setting, as on every other laboratory: direct
          children of the lab root, which labShell.css's detail rules select. */}
      <p data-detail="0">{withScripts(LQ02_CAPTION.r0)}</p>
      <p data-detail="1">{withScripts(LQ02_CAPTION.r1)}</p>
      <p data-detail="2" hidden>
        {withScripts(LQ02_CAPTION.r2)}
      </p>
      <p data-detail="3" hidden>
        {withScripts(LQ02_CAPTION.r3)}
      </p>
    </section>
  );
}
