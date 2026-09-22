"use client";

import { useId, useMemo, useState, useSyncExternalStore } from "react";
import {
  LQ06_DEFAULTS,
  LQ06_MODEL,
  LQ06_NOT_MODELED,
  LQ06_PRESETS,
  type Lq06ForkAChoice,
  type Lq06Parameters,
  type Lq06SubexpressionChoice,
} from "../../../experiments/lq06/definition.ts";
import { createLq06Session, type PreparedLq06Example } from "../../../experiments/lq06/session.ts";
import type { PublishedResult } from "../../../experiments/store/instanceStore.ts";
import { ExperimentSettings } from "../ExperimentSettings.tsx";
import { identity } from "../presentation.ts";
import { Sci } from "../Sci.tsx";
import { SliderField } from "../SliderField.tsx";
import { CoefficientMatchSideBySidePlot, MeanEnergyStripPlot } from "./CoefficientMatchPlot.tsx";
import "./coefficientMatchLab.css";

export type CoefficientMatchLabProps = Readonly<{
  example?: PreparedLq06Example | undefined;
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
    id: "subexpression-role",
    question:
      "The radiation's entropy is S − S₀ = (R/N) ln[(V/V₀)^(NE/(Rβν))], and a gas of n molecules has S − S₀ = (R/N) n ln(V/V₀). Which expression plays the part of n?",
    options: [
      "NE/(Rβν), which is E/(hν): the exponent of the volume ratio.",
      "E, the total radiant energy.",
      "E/(βν), the radiation's own entropy coefficient.",
    ],
    explanation:
      "The exponent of V/V₀ is what counts independent things in the gas law. So n_eff = NE/(Rβν) = E/(hν), and each of those things carries E/n_eff = hν.",
  },
  {
    id: "mean-energy-ratio",
    question:
      "Over a Wien spectrum the mean energy of a light quantum is ⟨ε⟩ = 3k_BT. A gas molecule's mean kinetic energy is (3/2)k_BT. How do they compare at one temperature?",
    options: [
      "The quantum's is twice the molecule's.",
      "They are equal, by equipartition.",
      "The quantum's is unboundedly larger, because the field has infinitely many modes.",
    ],
    explanation:
      "In §6 Einstein finds ⟨ε⟩ = 3(R/N)T by integrating the Wien distribution, exactly twice the (3/2)(R/N)T of a monatomic gas molecule.",
  },
];

/** The candidate expressions for "the number of things", in the reader's words. */
const SUBEXPRESSIONS: readonly { id: Lq06SubexpressionChoice; label: string; desc: string }[] = [
  {
    id: "N_E_over_R_beta_nu",
    label: "NE/(Rβν), or E/(hν)",
    desc: "the exponent of the volume ratio",
  },
  { id: "E", label: "E", desc: "the total radiation energy, in joules" },
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
    label: "Number of independent quanta, n_eff = E/(hν)",
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
    label: "Mean quantum energy over a Wien spectrum, 3k_BT",
    unit: "eV",
  },
  {
    id: "moleculeMeanKineticEnergyEv",
    label: "Mean kinetic energy of a gas molecule, (3/2)k_BT",
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

  const accepted = snapshot.accepted;
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

  const [answers, setAnswers] = useState<Record<string, number>>({});
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
      data-execution-label="host"
      {...(accepted ? identity(accepted) : {})}
    >
      <header className="lab-heading">
        <p className="eyebrow">LQ-06 · The move in §6</p>
        <h2>Matching the entropy laws to find the light quantum</h2>
        <span className="badge">{LQ06_MODEL.label}</span>
      </header>

      <noscript>
        <p className="notice">
          JavaScript is off. This is the worked example calculated when the site was built; choosing
          an expression and moving the settings need JavaScript.
        </p>
      </noscript>

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
                Radiation behaves as independent quanta of energy hν (Einstein’s move)
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
            readout={`${(currentParams.frequency / 1e12).toFixed(1)} THz: each quantum carries ${quantumEnergyEv.toFixed(3)} eV`}
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
              {error}
            </p>
          )}
        </div>

        <div className="lab-results">
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

      <div className="lq06-roles">
        <div>
          <h3>1. Derivation (Algebra)</h3>
          <p>
            The Wien radiation entropy and the Boltzmann gas entropy have the same form exactly when
            n = NE/(Rβν) = E/(hν).
          </p>
        </div>
        <div>
          <h3>2. Heuristic Inference</h3>
          <p>
            Monochromatic radiation of low density, in the Wien regime, behaves thermodynamically{" "}
            <em>as though</em> it consisted of independent energy quanta of size hν.
          </p>
        </div>
        <div>
          <h3>3. Further Hypothesis</h3>
          <p>
            Are the production of light (Stokes's rule, §7) and its transformation (the
            photoelectric effect, §8; ionization, §9) also exchanges in amounts of hν?
          </p>
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
              <tr data-quantity-id="radiationEnergy">
                <th scope="row">Radiation energy E</th>
                <td>{(currentParams.radiationEnergy * 1e9).toFixed(3)} nJ</td>
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
                  <th scope="row">{row.label}</th>
                  <td data-output={row.id}>{formatOutput(getOutput(row.id), row.unit)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      </div>

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
