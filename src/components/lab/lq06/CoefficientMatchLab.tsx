"use client";

import { useId, useMemo, useState, useSyncExternalStore } from "react";
import { ExecutionChrome } from "../../../experiments/labels/ExecutionChrome.tsx";
import { executionStateKindFromHostLabel } from "../../../experiments/labels/executionLabelFor.ts";
import { modelNoteFromView } from "../../../experiments/labels/modelNoteData.ts";
import { labelRootAttributes } from "../../../experiments/labels/resultAttributes.ts";
import {
  LQ06_CAPTION,
  LQ06_DEFAULTS,
  LQ06_NOT_MODELED,
  LQ06_OUTPUTS,
  LQ06_PRESETS,
  type Lq06ForkAChoice,
  type Lq06Parameters,
  type Lq06SubexpressionChoice,
} from "../../../experiments/lq06/definition.ts";
import { lq06RangeSentence } from "../../../experiments/lq06/parameters.ts";
import { createLq06Session, type PreparedLq06Example } from "../../../experiments/lq06/session.ts";
import { LQ06_TAPE } from "../../../experiments/lq06/tape.ts";
import { LabTapeLink, useLabTapeLink } from "../../../experiments/permalink/LabTapeLink.tsx";
import { deriveHostExecution } from "../../../experiments/provenance/executionState.ts";
import { instrumentRootAttributes } from "../../../experiments/store/identityAttributes.ts";
import type { PublishedResult } from "../../../experiments/store/instanceStore.ts";
import { ExperimentSettings } from "../ExperimentSettings.tsx";
import { fixed, identity } from "../presentation.ts";
import { Sci } from "../Sci.tsx";
import { SliderField } from "../SliderField.tsx";
import { withScripts } from "../subscripts.tsx";
import { CoefficientMatchSideBySidePlot, MeanEnergyStripPlot } from "./CoefficientMatchPlot.tsx";
import "./coefficientMatchLab.css";
import { PREDICT_PROMPTS } from "../../../generated/predict-prompts.ts";
import { KEPT_RESULT } from "../keptResult.ts";
import { PredictGatePanels, usePredictGate, withPredictions } from "../PredictGate.tsx";

export type CoefficientMatchLabProps = Readonly<{
  example?: PreparedLq06Example | undefined;
}>;

// The manifest's prompts (scripts/generate-predict-prompts.mjs), one stable array for the gate. They
// replace two prompts this file kept for itself; both, with their explanations, are in the manifest.
const LQ06_PROMPTS = PREDICT_PROMPTS["lq-06"] ?? [];

/** The candidate expressions for "the number of things", in the reader's words. */
const SUBEXPRESSIONS: readonly { id: Lq06SubexpressionChoice; label: string; desc: string }[] = [
  { id: "E", label: "E", desc: "the total radiation energy, in joules" },
  { id: "N_E_over_R_beta_nu", label: "NE/(Rβν), or E/(hν)", desc: "a pure number" },
  { id: "nu", label: "ν", desc: "the frequency, in hertz" },
  { id: "E_over_beta_nu", label: "E/(βν)", desc: "the radiation entropy coefficient, in J/K" },
  { id: "V", label: "V", desc: "the volume, in m³" },
];

/** Presets, named for what they set up. The parameters stay in definition.ts. */
const PRESET_ORDER = [
  ["theMove", "Einstein’s §6 case: 600 THz, 9.06 nJ"],
  ["historicalConstants", "With the 1905 printed constants R, β, N"],
  ["forkACoincidence", "Read the match as a coincidence"],
  ["unrevealedPrompt", "Start again with nothing chosen"],
] as const satisfies readonly (readonly [keyof typeof LQ06_PRESETS, string])[];

type FieldKey = "radiationEnergy" | "frequency" | "volumeRatio" | "gasParticles" | "temperature";

/** Display units for the typed fields: the value shown is the model's value divided by `scale`. */
const FIELDS: Readonly<Record<FieldKey, { label: string; scale: number; digits: number }>> = {
  radiationEnergy: { label: "Radiation energy E", scale: 1e-9, digits: 3 },
  frequency: { label: "Frequency ν", scale: 1e12, digits: 1 },
  volumeRatio: { label: "Volume ratio V/V₀", scale: 1, digits: 3 },
  gasParticles: { label: "Molecules in the comparison gas, n", scale: 1, digits: 0 },
  temperature: { label: "Temperature T", scale: 1, digits: 0 },
};

/** The values table, in the reader's words. */
const VALUE_ROWS: readonly { id: string; label: string; unit: string; scale?: number }[] = [
  {
    id: "effectiveIndependentCount",
    label: "Number of independent quanta, n_{eff}",
    unit: "",
  },
  { id: "quantumEnergy", label: "Energy of each, hν", unit: "J" },
  { id: "quantumEnergyEv", label: "Energy of each, hν", unit: "eV" },
  { id: "entropyVolumeCoefficient", label: "Radiation: coefficient of ln(V/V₀)", unit: "J/K" },
  { id: "gasEntropyVolumeCoefficient", label: "Gas: coefficient of ln(V/V₀)", unit: "J/K" },
  { id: "radiationEntropy", label: "Radiation: entropy change", unit: "J/K" },
  { id: "gasEntropy", label: "Gas: entropy change", unit: "J/K" },
  {
    id: "meanQuantumEnergyWienEv",
    label: "Mean quantum energy over a Wien spectrum, 3k_{B}T",
    unit: "eV",
  },
  {
    id: "moleculeMeanKineticEnergyEv",
    label: "Mean kinetic energy of a gas molecule, (3/2)k_{B}T",
    unit: "eV",
  },
  { id: "meanEnergyRatio", label: "Ratio of the two", unit: "" },
];

function formatOutput(out: PublishedResult | undefined, unit: string) {
  if (!out) return <>Not reported</>;
  if (out.status === "value" && typeof out.value === "number") {
    const v = out.value;
    const text =
      v !== 0 && (Math.abs(v) >= 1e4 || Math.abs(v) < 1e-3) ? (
        <Sci value={v} digits={4} />
      ) : (
        String(Number(v.toPrecision(5)))
      );
    return (
      <>
        {text}
        {unit && ` ${unit}`}
      </>
    );
  }
  if (out.status === "not-applicable") return <>Not applicable: {out.reason}</>;
  if (out.status === "underdetermined")
    return <>Not fixed by these settings. Needs: {out.neededInformation.join("; ")}</>;
  if ("reason" in out) return <>{String(out.reason)}</>;
  return <>Not determined</>;
}

export function CoefficientMatchLab({ example }: CoefficientMatchLabProps) {
  const session = useMemo(() => createLq06Session("lq06-interactive-session", example), [example]);
  const uid = useId();

  const snapshot = useSyncExternalStore(
    session.subscribe,
    session.getSnapshot,
    session.getServerSnapshot,
  );
  // A shared ?tape= link restores through this laboratory's own session (am-inst-permalink-tape-s677).
  const tapeLink = useLabTapeLink(LQ06_TAPE, session, session.acceptedParameters());

  const accepted = snapshot.accepted;
  // Earned per snapshot (am-inst-execution-labels-5ywv): the build-time example is a static worked
  // example, an accepted recalculation a host calculation; no example, no earned label.
  const executionKind = executionStateKindFromHostLabel(
    deriveHostExecution(
      snapshot,
      LQ06_OUTPUTS,
      example?.sourceDigest ?? "",
      accepted !== undefined && accepted === session.getServerSnapshot().accepted,
    ).label,
  );
  const currentParams: Lq06Parameters = useMemo(() => {
    return (accepted?.parameters ?? LQ06_DEFAULTS) as unknown as Lq06Parameters;
  }, [accepted]);

  const getOutput = (quantityId: string) =>
    accepted?.outputs.find((o) => o.quantityId === quantityId);

  const getOutputValue = (quantityId: string): number | null => {
    const out = getOutput(quantityId);
    return out && out.status === "value" && typeof out.value === "number" ? out.value : null;
  };

  const effectiveCount = getOutputValue("effectiveIndependentCount") ?? 2.277774e10;
  const quantumEnergyEv = getOutputValue("quantumEnergyEv") ?? 2.4814;
  const radVolumeCoeff = getOutputValue("entropyVolumeCoefficient") ?? 3.1448e-13;
  const gasVolumeCoeff = getOutputValue("gasEntropyVolumeCoefficient") ?? 1.3806e-22;
  const meanQuantumEnergyEv = getOutputValue("meanQuantumEnergyWienEv") ?? 0.7756;
  const moleculeKineticEnergyEv = getOutputValue("moleculeMeanKineticEnergyEv") ?? 0.3878;
  const meanEnergyRatio = getOutputValue("meanEnergyRatio") ?? 2.0;
  const ratioAt600THz = getOutputValue("ratioAt600THz") ?? 3.1995;
  const correspondenceVerdict = getOutput("correspondenceVerdict");
  const isMatch = Boolean(
    correspondenceVerdict &&
      correspondenceVerdict.status === "value" &&
      correspondenceVerdict.value === 1,
  );
  const hasSelection = currentParams.selectedSubexpression !== "none";

  // Predict mode (am-inst-predict-mode-ti7m): the result waits for the reader's answer.
  const gate = usePredictGate("lq-06", LQ06_PROMPTS);
  const [drafts, setDrafts] = useState<Partial<Record<FieldKey, string>>>({});
  const [error, setError] = useState("");

  function apply(patch: Partial<Lq06Parameters>) {
    const outcome = session.apply(patch);
    if (outcome.kind === "refused") {
      const req = outcome.refusal.details?.requirements;
      setError(typeof req === "string" ? req : outcome.refusal.message);
      return false;
    }
    setError("");
    return true;
  }

  function shown(key: FieldKey): string {
    const field = FIELDS[key];
    return String(Number((currentParams[key] / field.scale).toFixed(field.digits)));
  }

  function commit(key: FieldKey, text: string) {
    const n = Number(text.trim());
    if (text.trim() === "" || !Number.isFinite(n)) {
      setDrafts((d) => ({ ...d, [key]: text }));
      setError(`${FIELDS[key].label}: enter a number.`);
      return;
    }
    const stored = n * FIELDS[key].scale;
    if (!Number.isFinite(stored)) {
      // 1e300 THz is a number, but not one in hertz: say the range rather than "enter a number".
      setDrafts((d) => ({ ...d, [key]: text }));
      setError(lq06RangeSentence(key));
      return;
    }
    if (apply({ [key]: stored })) {
      setDrafts((d) => {
        const { [key]: _done, ...rest } = d;
        return rest;
      });
    } else {
      setDrafts((d) => ({ ...d, [key]: text }));
    }
  }

  function field(key: FieldKey) {
    return {
      id: `${uid}-${key}`,
      label: FIELDS[key].label,
      value: drafts[key] ?? shown(key),
      onDraft: (v: string) => setDrafts((d) => ({ ...d, [key]: v })),
      onCommit: (v: string) => commit(key, v),
    };
  }

  function preset(key: keyof typeof LQ06_PRESETS) {
    const chosen = LQ06_PRESETS[key];
    if (!chosen) return;
    setDrafts({});
    apply(chosen.parameters);
  }

  return (
    <section
      className="laboratory lq06"
      data-instrument-id="lq-06"
      data-testid="lq06-coefficient-match-lab"
      {...instrumentRootAttributes(snapshot)}
      {...labelRootAttributes(executionKind, snapshot, "quantumEnergy")}
      {...(accepted ? identity(accepted) : {})}
    >
      <header className="lab-heading">
        <p className="eyebrow">The move in §6</p>
        <h2>Matching the entropy laws to find the light quantum</h2>
      </header>
      <div className="lab-status-row">
        <ExecutionChrome
          state={executionKind}
          view={snapshot}
          modelNote={modelNoteFromView(snapshot, { notModeled: `${LQ06_NOT_MODELED.join("; ")}.` })}
        />
      </div>

      <noscript>
        <p className="notice">
          JavaScript is off. This is the worked example calculated when the site was built; choosing
          an expression and moving the settings need JavaScript.
        </p>
      </noscript>

      <PredictGatePanels gate={gate} />
      <div className="lab-columns">
        <div>
          <fieldset className="lab-choice lq06-subexpressions">
            <legend>Which expression plays the part of n, the number of things?</legend>
            <div className="actions">
              {SUBEXPRESSIONS.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  aria-pressed={currentParams.selectedSubexpression === item.id}
                  className={
                    currentParams.selectedSubexpression === item.id ? "primary" : "secondary"
                  }
                  onClick={() =>
                    apply({
                      selectedSubexpression: item.id,
                      proposedEnergyElement: item.id === "N_E_over_R_beta_nu" ? "h_nu" : "none",
                    })
                  }
                >
                  <strong>{item.label}</strong> {item.desc}
                </button>
              ))}
            </div>
          </fieldset>

          <div className="input-field lq06-reading">
            <label htmlFor={`${uid}-fork`}>How to read the match</label>
            <select
              id={`${uid}-fork`}
              value={currentParams.forkAChoice}
              onChange={(e) => apply({ forkAChoice: e.target.value as Lq06ForkAChoice })}
            >
              <option value="none">Not chosen yet</option>
              <option value="independent-quanta">
                Radiation behaves as independent quanta of energy hν
              </option>
              <option value="coincidence">A formal coincidence: the waves stay continuous</option>
            </select>
          </div>

          <SliderField {...field("radiationEnergy")} unit="nJ" min={1} max={50} step={0.5} />
          <SliderField
            {...field("frequency")}
            unit="THz"
            min={200}
            max={1200}
            step={10}
            readout={`${(currentParams.frequency / 1e12).toFixed(1)} THz: each quantum carries ${fixed(quantumEnergyEv, 3)} eV`}
          />

          <fieldset className="lab-choice">
            <legend>Try</legend>
            <div className="actions">
              {PRESET_ORDER.map(([key, label]) => (
                <button key={key} type="button" className="secondary" onClick={() => preset(key)}>
                  {label}
                </button>
              ))}
            </div>
          </fieldset>

          <ExperimentSettings contents="volume ratio, the comparison gas, temperature">
            <SliderField {...field("volumeRatio")} unit="ratio" min={0.05} max={2} step={0.05} />
            <SliderField {...field("gasParticles")} unit="count" min={1} max={100} step={1} />
            <SliderField {...field("temperature")} unit="K" min={500} max={6000} step={100} />
          </ExperimentSettings>

          {error && (
            <p role="alert" className="notice error">
              {error} {KEPT_RESULT}
            </p>
          )}
        </div>

        <div className="lab-results" {...gate.response}>
          <div className="lq06-plots">
            <CoefficientMatchSideBySidePlot
              radiationEnergyJ={currentParams.radiationEnergy}
              frequencyHz={currentParams.frequency}
              volumeRatio={currentParams.volumeRatio}
              gasParticles={currentParams.gasParticles}
              effectiveCount={effectiveCount}
              quantumEnergyEv={quantumEnergyEv}
              radVolumeCoeff={radVolumeCoeff}
              gasVolumeCoeff={gasVolumeCoeff}
              isMatch={isMatch}
              hasSelection={hasSelection}
              selectedLabel={
                SUBEXPRESSIONS.find((x) => x.id === currentParams.selectedSubexpression)?.label
              }
            />
            <MeanEnergyStripPlot
              meanQuantumEnergyEv={meanQuantumEnergyEv}
              moleculeKineticEnergyEv={moleculeKineticEnergyEv}
              temperatureK={currentParams.temperature}
              ratio={meanEnergyRatio}
              ratioAt600THz={ratioAt600THz}
            />
          </div>
        </div>
      </div>
      {/* The permalink to these settings, after the instrument it links to (dispatch 263). In
          the status row it made that line 267px tall at 1440. */}
      <LabTapeLink link={withPredictions(tapeLink, gate)} />

      {/* The derivation card states the answer to the lab's question, so the three roles are a
          closed disclosure: in the HTML for every reader, open only when asked for. */}
      <details className="lq06-roles-wrap">
        <summary>The three logical roles of the match</summary>
        <div className="lq06-roles">
          <div>
            <h3>1. Derivation (algebra)</h3>
            <p>
              The Wien radiation entropy and the Boltzmann gas entropy have the same form exactly
              when n = NE/(Rβν) = E/(hν).
            </p>
          </div>
          <div>
            <h3>2. Heuristic inference</h3>
            <p>
              Monochromatic radiation of low density, in the Wien regime, behaves thermodynamically{" "}
              <em>as though</em> it consisted of independent energy quanta of size hν.
            </p>
          </div>
          <div>
            <h3>3. Further hypothesis</h3>
            <p>
              Are the production of light (Stokes's rule, §7) and its transformation (the
              photoelectric effect, §8; ionization, §9) also exchanges in amounts of hν?
            </p>
          </div>
        </div>
      </details>

      {/* n_eff and the two mean energies answer the prompts, so the table waits with the plots. */}
      <div className="lab-values" {...gate.response}>
        <h3>Values at these settings</h3>
        <section className="table-scroll" aria-label="Values at these settings">
          <table className="data-table">
            <thead>
              <tr>
                <th scope="col">Quantity</th>
                <th scope="col">Value</th>
              </tr>
            </thead>
            <tbody>
              <tr data-quantity-id="radiationEnergy">
                <th scope="row">Radiation energy E</th>
                <td>{fixed(currentParams.radiationEnergy * 1e9, 3)} nJ</td>
              </tr>
              <tr data-quantity-id="frequency">
                <th scope="row">Frequency ν</th>
                <td>{(currentParams.frequency / 1e12).toFixed(1)} THz</td>
              </tr>
              <tr data-quantity-id="volumeRatio">
                <th scope="row">Volume ratio V/V₀</th>
                <td>{currentParams.volumeRatio}</td>
              </tr>
              {VALUE_ROWS.map((row) => (
                <tr key={row.id} data-quantity-id={row.id}>
                  <th scope="row">{withScripts(row.label)}</th>
                  <td data-output={row.id}>{formatOutput(getOutput(row.id), row.unit)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      </div>

      {/* The four readings follow the reader's detail setting, as on every other laboratory: direct
          children of the lab root, which labShell.css's detail rules select. */}
      <p data-detail="0">{withScripts(LQ06_CAPTION.r0)}</p>
      <p data-detail="1">{withScripts(LQ06_CAPTION.r1)}</p>
      <p data-detail="2" hidden>
        {withScripts(LQ06_CAPTION.r2)}
      </p>
      <p data-detail="3" hidden>
        {withScripts(LQ06_CAPTION.r3)}
      </p>

      <div className="lab-bottom">
        <div className="not-modeled">
          <h3>What this model leaves out</h3>
          <ul>
            {LQ06_NOT_MODELED.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </div>
        <details className="lq06-code">
          <summary>The rule this laboratory evaluates</summary>
          <p className="fine">
            From src/physics/reference/radiation/quanta.ts, the audited TypeScript reference
            evaluator.
          </p>
          <pre>
            <code>{`// Paper 1, §6: matching the entropy coefficients
// Radiation entropy:     S - S_0 = (E / (beta * nu)) * ln(V / V_0)
// Boltzmann gas entropy: S - S_0 = (R / N) * n * ln(V / V_0)
//
// Equating the exponents in W = (V / V_0)^n:
// n_eff = (N / R) * (E / (beta * nu)) = E / (h * nu)
// Energy per quantum: epsilon = E / n_eff = (R * beta * nu) / N = h * nu
//
// Mean quantum energy over a Wien spectrum:
// <epsilon> = 3 * (R / N) * T = 3 * k_B * T, twice a molecule's 1.5 * k_B * T`}</code>
          </pre>
        </details>
      </div>
    </section>
  );
}

export const CoefficientMatchComparison = CoefficientMatchLab;
