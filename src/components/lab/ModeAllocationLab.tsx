"use client";

import { type FormEvent, type ReactNode, useId, useState } from "react";
import { typedOrNaN } from "../../experiments/controls/typedNumber.ts";
import { executionLabelFor } from "../../experiments/labels/executionLabelFor.ts";
import { executionLabelAttributes } from "../../experiments/labels/resultAttributes.ts";
import { LQ02_CAPTION } from "../../experiments/lq02/definition.ts";
import { validateLq02Parameters } from "../../experiments/lq02/parameters.ts";
import {
  computeLq02Snapshot,
  DEFAULT_LQ02_INPUTS,
  type Lq02Inputs,
  type Lq02Snapshot,
  type RadiationResult,
  removeUpperLimit,
} from "../../experiments/lq02/session";
import { refusalSentence } from "../../experiments/results/refusalSentence.ts";
import { PREDICT_PROMPTS } from "../../generated/predict-prompts.ts";
import { AcceptedStatus } from "./AcceptedStatus.tsx";
import { ExperimentSettings } from "./ExperimentSettings.tsx";
import { KEPT_RESULT } from "./keptResult.ts";
import { PredictGatePanels, usePredictGate } from "./PredictGate.tsx";
import { display, fixed, sentenceNumber } from "./presentation.ts";
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

const LQ02_PROMPTS = PREDICT_PROMPTS["lq-02"] ?? [];

function toDraft(inputs: Lq02Inputs): Draft {
  return {
    T: String(inputs.T),
    nuCutoff: String(inputs.nuCutoff),
    probeFrequency: String(inputs.probeFrequency),
  };
}

function fromDraft(draft: Draft): Lq02Inputs {
  return {
    // A blank or partial field reaches the validator as NaN and is refused as not a number, rather
    // than as a temperature or frequency of zero (dispatch 184).
    T: typedOrNaN(draft.T),
    nuCutoff: typedOrNaN(draft.nuCutoff),
    probeFrequency: typedOrNaN(draft.probeFrequency),
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
  // The controls come first; the energies, their ratio and the refusal to total them wait.
  const gate = usePredictGate("lq-02", LQ02_PROMPTS);

  const snapshot: Lq02Snapshot = computeLq02Snapshot(accepted);
  // One sentence for the status line: the energy the classical allocation holds up to the cutoff,
  // and what widening the cutoff tenfold does to it.
  const cutoffAndTemperature = `with resonators up to ${sentenceNumber(accepted.nuCutoff)} Hz at ${sentenceNumber(accepted.T)} K`;
  const statusSummary =
    snapshot.energyUpToCutoff.status === "value"
      ? `${cutoffAndTemperature}, the classical allocation holds ${sentenceNumber(snapshot.energyUpToCutoff.value)} J per cubic metre${snapshot.growthRatio === null ? "." : `, and widening the cutoff tenfold multiplies it by ${sentenceNumber(snapshot.growthRatio)}.`}`
      : `${cutoffAndTemperature}, the classical allocation's energy is not computed.`;

  function apply(next: Lq02Inputs) {
    // Each field is a positive quantity. A zero or negative value used to reach the kernel, and the
    // table printed its outside-domain reason in every row: "Not modeled here: Cutoff frequency must
    // be positive and finite (got -1e+300)." One validator now serves the page and the domain sweep.
    const checked = validateLq02Parameters(next);
    if (checked.kind !== "accepted") {
      setError(checked.kind === "refused" ? refusalSentence(checked.refusal) : "");
      return;
    }
    setAccepted(checked.data);
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

      {/* The prediction comes first, as on 17 of the 22 laboratories that have both a gate and
          .lab-columns (counted 2026-09-26, dispatch 263). This used to say it sat under the
          instrument "as it does on every other laboratory"; it did so on 5. Below the controls it
          put the prediction 1038px down at 1440. */}
      <PredictGatePanels gate={gate} />
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
              {error} {KEPT_RESULT}
            </p>
          )}
        </form>
        <AcceptedStatus
          worked={executionKind === "static-example"}
          summary={statusSummary}
          response={gate.response}
        />

        <div className="readouts">
          <table {...gate.response}>
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

          <p className="model-note" {...gate.response}>
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
            <div className="refusal" role="status" {...gate.response}>
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
            <summary>Show which functions computed these numbers</summary>
            <p>
              src/physics/reference/radiation/classical.ts (classicalCutoffEnergyDensity,
              classicalTotalEnergy, meanResonatorEnergy),
              src/physics/reference/radiation/avogadro.ts (avogadroFromPlanckConstants),
              src/physics/reference/radiation/spectra.ts (regimeRelativeErrors), and
              src/experiments/lq02/session.ts (which gathers these results for the page; this
              component never recomputes any of them).
            </p>
          </details>
        </div>
      </div>

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
