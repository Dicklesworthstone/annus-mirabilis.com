"use client";

import { useId, useMemo, useState, useSyncExternalStore } from "react";
import {
  LQ09_DEFAULTS,
  LQ09_MODEL,
  LQ09_NOT_MODELED,
  LQ09_PRESETS,
  type Lq09AbsorptionMode,
  type Lq09Parameters,
} from "../../../experiments/lq09/definition.ts";
import {
  createLq09Session,
  einsteinPrintedIonizationChecks,
  type PreparedLq09Example,
} from "../../../experiments/lq09/session.ts";
import type { PublishedResult } from "../../../experiments/store/instanceStore.ts";
import { ExperimentSettings } from "../ExperimentSettings.tsx";
import { identity } from "../presentation.ts";
import { Sci } from "../Sci.tsx";
import { SliderField } from "../SliderField.tsx";
import { IonizationCountingPlot, IonizationThresholdLadderPlot } from "./IonizationPlot.tsx";
import "./ionizationLab.css";

export type IonizationLabProps = Readonly<{
  example?: PreparedLq09Example | undefined;
}>;

type PredictPrompt = Readonly<{
  id: string;
  question: string;
  options: readonly string[];
  explanation: string;
}>;

/**
 * Two predictions. The answer is revealed after a choice and reads the same whichever option
 * was chosen: a prediction is a starting point, never a score.
 */
const PREDICT_PROMPTS: readonly PredictPrompt[] = [
  {
    id: "sub-threshold",
    question:
      "A quantum's energy hν is below the energy J needed to ionize one molecule. How many molecules does the light ionize, one quantum at a time?",
    options: [
      "Some, if the light is concentrated to a high intensity.",
      "None, however bright the light.",
      "Some, once a molecule has absorbed enough energy gradually.",
    ],
    explanation:
      "In Einstein's §9 hypothesis each ionization is one elementary process needing at least one quantum with hν ≥ J. Below that, no single quantum ionizes, whatever the intensity.",
  },
  {
    id: "power-doubling",
    question:
      "Double the light's power at the same frequency. What happens to the number of molecules ionized?",
    options: [
      "It stays the same, because each quantum's energy is unchanged.",
      "It grows fourfold, as the square of the power.",
      "It doubles.",
    ],
    explanation:
      "Under the paper's hypothesis the number ionized is proportional to the light energy absorbed, j = L / (Rβν). Twice the power absorbs twice the quanta, so twice the molecules.",
  },
];

/** Presets, named for what they set up. The parameters stay in definition.ts. */
const PRESET_ORDER = [
  ["thresholdStandard", "12 eV quanta on a 10 eV molecule"],
  ["subThreshold", "9 eV quanta: below the threshold"],
  ["historicalChecks", "Lenard's 1900 check: 190 nm ultraviolet"],
  ["starkCathodeCheck", "Stark's 1902 check: about 10 volts"],
  ["declaredFraction", "Only a quarter of absorbed quanta ionize"],
  ["unknownAbsorption", "The share that ionizes is unknown"],
] as const satisfies readonly (readonly [keyof typeof LQ09_PRESETS, string])[];

type FieldKey =
  | "frequency"
  | "incidentPower"
  | "ionizationEnergyEv"
  | "absorptionEfficiency"
  | "duration"
  | "declaredFraction";

/** Display units for the typed fields: the value shown is the model's value divided by `scale`. */
const FIELDS: Readonly<Record<FieldKey, { label: string; scale: number; digits: number }>> = {
  frequency: { label: "Frequency ν", scale: 1e12, digits: 2 },
  incidentPower: { label: "Light power", scale: 1e-6, digits: 3 },
  ionizationEnergyEv: { label: "Ionization energy per molecule, J", scale: 1, digits: 2 },
  absorptionEfficiency: { label: "Share of the light absorbed", scale: 1, digits: 3 },
  duration: { label: "Exposure", scale: 1, digits: 2 },
  declaredFraction: { label: "Share of absorbed quanta that ionize, a", scale: 1, digits: 3 },
};

function notDetermined(out: PublishedResult | undefined): string {
  if (!out) return "Not reported";
  if (out.status === "not-applicable") return `None: ${out.reason}`;
  if (out.status === "underdetermined")
    return `Not fixed by these settings. Needs: ${out.neededInformation.join("; ")}`;
  if ("reason" in out) return String(out.reason);
  return "Not determined";
}

export function IonizationLab({ example }: IonizationLabProps) {
  const session = useMemo(() => createLq09Session("lq09-interactive-session", example), [example]);
  const uid = useId();

  const snapshot = useSyncExternalStore(
    session.subscribe,
    session.getSnapshot,
    session.getServerSnapshot,
  );

  const accepted = snapshot.accepted;
  const currentParams: Lq09Parameters = useMemo(() => {
    return (accepted?.parameters ?? LQ09_DEFAULTS) as unknown as Lq09Parameters;
  }, [accepted]);

  const getOutput = (quantityId: string) =>
    accepted?.outputs.find((o) => o.quantityId === quantityId);

  const getOutputValue = (quantityId: string): number | null => {
    const out = getOutput(quantityId);
    return out && out.status === "value" && typeof out.value === "number" ? out.value : null;
  };

  const quantumEnergyEv = getOutputValue("quantumEnergyEv") ?? 12.0;
  const excessEnergyEv = getOutputValue("excessEnergyEv") ?? 2.0;
  const thresholdFrequency = getOutputValue("thresholdFrequency") ?? 2.418e15;
  const thresholdWavelengthNm = getOutputValue("thresholdWavelengthNm") ?? 123.98;
  const singleQuantumAllowed = (getOutputValue("singleQuantumAllowed") ?? 1) === 1;

  const incidentQRate = getOutputValue("quantumRate") ?? 5.201e11;
  const absorbedQRate = getOutputValue("absorbedQuantumRate") ?? 2.601e11;
  const absorbedLightEnergy = getOutputValue("absorbedLightEnergy") ?? 5e-7;

  const ionizationRateOut = getOutput("ionizationRate");
  const ionizationRate = getOutputValue("ionizationRate");
  const ionizationStatus = ionizationRateOut?.status ?? "value";
  const ionizedGramMoleculesOut = getOutput("ionizedGramMolecules");
  const ionizedGramMolecules = getOutputValue("ionizedGramMolecules");

  const [answers, setAnswers] = useState<Record<string, number>>({});
  const [drafts, setDrafts] = useState<Partial<Record<FieldKey, string>>>({});
  const [error, setError] = useState("");

  function apply(patch: Partial<Lq09Parameters>) {
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
    if (apply({ [key]: n * FIELDS[key].scale })) {
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

  function preset(key: keyof typeof LQ09_PRESETS) {
    setDrafts({});
    apply(LQ09_PRESETS[key].parameters);
  }

  const histChecks = useMemo(() => einsteinPrintedIonizationChecks(), []);

  return (
    <section
      className="laboratory lq09"
      data-instrument-id="lq-09"
      data-execution-label="host"
      {...(accepted ? identity(accepted) : {})}
    >
      <header className="lab-heading">
        <p className="eyebrow">LQ-09 · Gas ionization by light</p>
        <h2>Gas ionization bounds and counting model</h2>
        <span className="badge">{LQ09_MODEL.label}</span>
      </header>

      <div className="lab-columns">
        <div>
          <details className="lab-predict">
            <summary>Predict first</summary>
            {PREDICT_PROMPTS.map((prompt) => (
              <fieldset key={prompt.id}>
                <legend>{prompt.question}</legend>
                {prompt.options.map((option, idx) => (
                  <label key={option} className="lab-predict-candidate">
                    <input
                      type="radio"
                      name={`${uid}-${prompt.id}`}
                      checked={answers[prompt.id] === idx}
                      onChange={() => setAnswers((a) => ({ ...a, [prompt.id]: idx }))}
                    />
                    <span>{option}</span>
                  </label>
                ))}
                {answers[prompt.id] !== undefined && (
                  <p className="lab-predict-reveal">{prompt.explanation}</p>
                )}
              </fieldset>
            ))}
          </details>

          <SliderField
            {...field("frequency")}
            unit="THz"
            min={1000}
            max={4500}
            step={10}
            readout={`${(currentParams.frequency / 1e12).toFixed(2)} THz: one quantum carries ${quantumEnergyEv.toFixed(2)} eV`}
          />
          <SliderField
            {...field("incidentPower")}
            unit="μW"
            min={0.1}
            max={10}
            step={0.1}
            readout={`${(currentParams.incidentPower * 1e6).toFixed(2)} μW`}
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

          <ExperimentSettings contents="ionization energy, absorption, exposure, what absorbed light does">
            <SliderField
              {...field("ionizationEnergyEv")}
              unit="eV"
              min={4}
              max={20}
              step={0.1}
              readout={`${currentParams.ionizationEnergyEv.toFixed(2)} eV`}
            />
            <SliderField
              {...field("absorptionEfficiency")}
              unit="fraction"
              min={0.05}
              max={1}
              step={0.05}
            />
            <SliderField {...field("duration")} unit="s" min={0.1} max={10} step={0.1} />
            <div className="input-field">
              <label htmlFor={`${uid}-mode`}>What absorbed light does</label>
              <select
                id={`${uid}-mode`}
                value={currentParams.absorptionMode}
                onChange={(e) => {
                  setDrafts({});
                  apply({ absorptionMode: e.target.value as Lq09AbsorptionMode });
                }}
              >
                <option value="all-absorbed-ionizes">
                  Every absorbed quantum ionizes one molecule (Einstein’s hypothesis)
                </option>
                <option value="declared-fraction">A declared share a of them ionizes</option>
                <option value="unknown">Unknown: only an upper bound holds</option>
              </select>
            </div>
            {currentParams.absorptionMode === "declared-fraction" && (
              <SliderField
                {...field("declaredFraction")}
                unit="fraction"
                min={0}
                max={1}
                step={0.05}
              />
            )}
          </ExperimentSettings>

          {error && (
            <p role="alert" className="notice error">
              {error}
            </p>
          )}
        </div>

        <div className="lab-results">
          <div className="lq09-plots">
            <IonizationThresholdLadderPlot
              frequency={currentParams.frequency}
              ionizationEnergyEv={currentParams.ionizationEnergyEv}
              quantumEnergyEv={quantumEnergyEv}
              excessEnergyEv={excessEnergyEv}
              thresholdFrequencyHz={thresholdFrequency}
              thresholdWavelengthNm={thresholdWavelengthNm}
              singleQuantumAllowed={singleQuantumAllowed}
            />
            <IonizationCountingPlot
              absorbedQuantaRate={absorbedQRate}
              incidentQuantaRate={incidentQRate}
              ionizationRate={ionizationRate}
              ionizationStatus={ionizationStatus}
              absorptionMode={currentParams.absorptionMode}
              declaredFraction={currentParams.declaredFraction}
            />
          </div>
        </div>
      </div>

      <div className="lab-values">
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
              <tr data-quantity-id="frequency">
                <th scope="row">Frequency ν</th>
                <td>{(currentParams.frequency / 1e12).toFixed(2)} THz</td>
              </tr>
              <tr data-quantity-id="ionizationEnergyPerMolecule">
                <th scope="row">Ionization energy per molecule, J</th>
                <td>{currentParams.ionizationEnergyEv.toFixed(2)} eV</td>
              </tr>
              <tr data-quantity-id="quantumEnergyEv">
                <th scope="row">Energy of one quantum, hν</th>
                <td>{quantumEnergyEv.toFixed(3)} eV</td>
              </tr>
              <tr data-quantity-id="excessEnergyEv">
                <th scope="row">Energy left over, hν − J</th>
                <td>{excessEnergyEv.toFixed(3)} eV</td>
              </tr>
              <tr data-quantity-id="absorbedLightEnergy">
                <th scope="row">Light energy absorbed, L</th>
                <td>
                  <Sci value={absorbedLightEnergy} digits={3} /> J
                </td>
              </tr>
              <tr data-quantity-id="absorbedQuantumRate">
                <th scope="row">Quanta absorbed each second</th>
                <td>
                  <Sci value={absorbedQRate} digits={3} />
                </td>
              </tr>
              <tr data-quantity-id="ionizationRate">
                <th scope="row">Molecules ionized each second</th>
                <td>
                  {ionizationRate !== null ? (
                    <Sci value={ionizationRate} digits={3} />
                  ) : ionizationStatus === "underdetermined" ? (
                    <>
                      At most <Sci value={absorbedQRate} digits={3} />, the absorbed rate.{" "}
                      {notDetermined(ionizationRateOut)}
                    </>
                  ) : (
                    notDetermined(ionizationRateOut)
                  )}
                </td>
              </tr>
              <tr data-quantity-id="ionizedGramMolecules">
                <th scope="row">Gram-molecules ionized, j</th>
                <td>
                  {ionizedGramMolecules !== null ? (
                    <>
                      <Sci value={ionizedGramMolecules} digits={3} /> mol
                    </>
                  ) : (
                    notDetermined(ionizedGramMoleculesOut)
                  )}
                </td>
              </tr>
            </tbody>
          </table>
        </section>
      </div>

      <div className="lab-bottom">
        <div className="lq09-historical">
          <h3>Einstein’s 1905 checks in §9</h3>
          <p>
            <strong>Lenard, 1900, air ionized by ultraviolet.</strong> Cutoff λ ≤ 190 nm, so Rβν ={" "}
            {histChecks.lenardCheck.printedEnergyText} (
            {histChecks.lenardCheck.printedPotentialText}
            ). With modern constants, 190 nm is{" "}
            {histChecks.lenardCheck.modernEnergyEvAt190nm.toFixed(2)} eV per molecule.
          </p>
          <p>
            <strong>Stark, 1902, cathode rays.</strong> Ionization potential{" "}
            {histChecks.starkCheck.printedPotentialText}, so λ₀ ≈{" "}
            {histChecks.starkCheck.thresholdWavelengthNm.toFixed(0)} nm; J ={" "}
            <Sci value={histChecks.starkCheck.energyPerGramEquivalentErg} digits={1} /> erg per
            gram-equivalent.
          </p>
        </div>
        <div className="not-modeled">
          <h3>What this model leaves out</h3>
          <ul>
            {LQ09_NOT_MODELED.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </div>
      </div>

      <details className="lq09-code">
        <summary>The rule this laboratory evaluates</summary>
        <p className="fine">
          From src/physics/reference/photoelectric.ts, the audited TypeScript reference evaluator.
        </p>
        <pre>
          <code>{`// Paper 1, §9: one quantum, one ionization.
// Threshold frequency: nu_0 = J / h
// If nu < nu_0: no single-quantum ionization; the count is not applicable.
// If nu >= nu_0:
//   every absorbed quantum ionizes:  j = L / (R*beta*nu), or N_ion = L / (h*nu)
//   a declared share a ionizes:      N_ion = a * L / (h*nu)
//   the share is unknown:            underdetermined, at most N_abs = L / (h*nu)`}</code>
        </pre>
      </details>
    </section>
  );
}

export const IonizationComparison = IonizationLab;
