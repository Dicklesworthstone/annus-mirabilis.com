"use client";

import { useEffect, useMemo, useState, useSyncExternalStore } from "react";
import {
  LQ06_DEFAULTS,
  LQ06_NOT_MODELED,
  LQ06_PRESETS,
  type Lq06ForkAChoice,
  type Lq06Parameters,
  type Lq06ProposedEnergy,
  type Lq06SubexpressionChoice,
} from "../../../experiments/lq06/definition.ts";
import {
  createLq06Session,
  type PreparedLq06Example,
} from "../../../experiments/lq06/session.ts";
import {
  CoefficientMatchSideBySidePlot,
  MeanEnergyStripPlot,
} from "./CoefficientMatchPlot.tsx";

export type CoefficientMatchLabProps = Readonly<{
  example?: PreparedLq06Example | undefined;
}>;

type PredictPrompt = Readonly<{
  id: string;
  question: string;
  options: readonly { text: string; correct: boolean }[];
  explanation: string;
}>;

const PREDICT_PROMPTS: readonly PredictPrompt[] = [
  {
    id: "subexpression-role",
    question:
      "In the radiation entropy equation S - S₀ = (R/N) ln[(V/V₀)^(N·E / (R·β·ν))], what expression plays the mathematical role of the particle count n in S - S₀ = (R/N) n ln(V/V₀)?",
    options: [
      {
        text: "n_eff = N·E / (R·β·ν) = E / (h·ν), the exponent of the volume ratio.",
        correct: true,
      },
      {
        text: "n_eff = E, the total radiant energy.",
        correct: false,
      },
      {
        text: "n_eff = E / (β·ν), the unscaled radiation coefficient.",
        correct: false,
      },
    ],
    explanation:
      "The exponent of the volume ratio V/V₀ directly corresponds to the count of independent particles n. This identifies n_eff = N·E / (R·β·ν) = E / (h·ν) and quantum energy ε = E / n_eff = h·ν.",
  },
  {
    id: "mean-energy-ratio",
    question:
      "How does the mean energy of light quanta in a Wien spectrum ⟨ε⟩ = 3 k_B T compare to the mean translational kinetic energy of a gas molecule ⟨E_kin⟩ = (3/2) k_B T at the same temperature?",
    options: [
      {
        text: "Exactly twice as large: the ratio is 3 k_B T / (1.5 k_B T) = 2.",
        correct: true,
      },
      {
        text: "Exactly equal: thermal equipartition gives the same energy to both.",
        correct: false,
      },
      {
        text: "Infinitely larger because electromagnetic fields have infinite modes.",
        correct: false,
      },
    ],
    explanation:
      "Einstein §6 integrates the Wien energy and quantum distributions to find ⟨ε⟩ = 3(R/N)T, which is exactly twice the average kinetic energy of a monoatomic gas molecule (3/2)(R/N)T.",
  },
];

export function CoefficientMatchLab({ example }: CoefficientMatchLabProps) {
  const session = useMemo(
    () => createLq06Session("lq06-interactive-session", example),
    [example],
  );

  const snapshot = useSyncExternalStore(
    session.subscribe,
    session.getSnapshot,
    session.getServerSnapshot,
  );

  const accepted = snapshot.accepted;
  const currentParams: Lq06Parameters = useMemo(() => {
    return (accepted?.parameters ?? LQ06_DEFAULTS) as unknown as Lq06Parameters;
  }, [accepted]);

  const getOutput = (quantityId: string) => {
    return accepted?.outputs.find((o) => o.quantityId === quantityId);
  };

  const getOutputValue = (quantityId: string): number | null => {
    const out = accepted?.outputs.find((o) => o.quantityId === quantityId);
    return out && out.status === "value" && typeof out.value === "number" ? out.value : null;
  };

  const effectiveCount = getOutputValue("effectiveIndependentCount") ?? 2.277774e10;
  const quantumEnergyJ = getOutputValue("quantumEnergy") ?? 3.975642e-19;
  const quantumEnergyEv = getOutputValue("quantumEnergyEv") ?? 2.4814;
  const radEntropy = getOutputValue("radiationEntropy") ?? -2.1798e-13;
  const gasEntropy = getOutputValue("gasEntropy") ?? -9.5699e-23;
  const radVolumeCoeff = getOutputValue("entropyVolumeCoefficient") ?? 3.1448e-13;
  const gasVolumeCoeff = getOutputValue("gasEntropyVolumeCoefficient") ?? 1.3806e-22;
  const meanQuantumEnergyEv = getOutputValue("meanQuantumEnergyWienEv") ?? 0.7756;
  const moleculeKineticEnergyEv = getOutputValue("moleculeMeanKineticEnergyEv") ?? 0.3878;
  const meanEnergyRatio = getOutputValue("meanEnergyRatio") ?? 2.0;
  const ratioAt600THz = getOutputValue("ratioAt600THz") ?? 3.1995;
  const correspondenceVerdict = getOutput("correspondenceVerdict");
  const isMatch =
    correspondenceVerdict &&
    correspondenceVerdict.status === "value" &&
    correspondenceVerdict.value === 1;
  const hasSelection = currentParams.selectedSubexpression !== "none";

  // Predict mode state
  const [predictActive, setPredictActive] = useState(false);
  const [userAnswers, setUserAnswers] = useState<Record<string, number>>({});
  const [revealed, setRevealed] = useState<Record<string, boolean>>({});

  // Show the code state
  const [showCode, setShowCode] = useState(false);

  // Local draft sliders
  const [eNanoJ, setENanoJ] = useState((currentParams.radiationEnergy * 1e9).toFixed(3));
  const [freqTHz, setFreqTHz] = useState((currentParams.frequency / 1e12).toFixed(1));
  const [gasN, setGasN] = useState(String(currentParams.gasParticles));
  const [volRatio, setVolRatio] = useState(currentParams.volumeRatio.toFixed(2));
  const [tempK, setTempK] = useState(String(currentParams.temperature));

  useEffect(() => {
    setENanoJ((currentParams.radiationEnergy * 1e9).toFixed(3));
    setFreqTHz((currentParams.frequency / 1e12).toFixed(1));
    setGasN(String(currentParams.gasParticles));
    setVolRatio(currentParams.volumeRatio.toFixed(2));
    setTempK(String(currentParams.temperature));
  }, [currentParams]);

  const handleApply = (patch: Partial<Lq06Parameters>) => {
    session.apply(patch);
  };

  const handlePreset = (presetParams: Lq06Parameters) => {
    session.apply(presetParams);
  };

  return (
    <div className="lab-container max-w-5xl mx-auto p-4 space-y-6" data-instrument-id="lq-06">
      {/* Header & Presets */}
      <section className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg p-4 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
          <div>
            <span className="text-xs uppercase tracking-wider font-semibold text-rose-600 dark:text-rose-400">
              Interactive Critical Edition · Instrument LQ-06
            </span>
            <h2 className="text-xl font-bold text-slate-900 dark:text-slate-100">
              Matching the Entropy Laws to Derive the Light Quantum (§6 The Move)
            </h2>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setPredictActive(!predictActive)}
              className={`px-3 py-1.5 text-xs font-semibold rounded transition-colors ${
                predictActive
                  ? "bg-rose-600 text-white"
                  : "bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200"
              }`}
            >
              {predictActive ? "Exit Predict Mode" : "Enter Predict Mode"}
            </button>
            <button
              type="button"
              onClick={() => setShowCode(!showCode)}
              className="px-3 py-1.5 text-xs font-semibold rounded bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200 transition-colors"
            >
              {showCode ? "Hide Kernel Source" : "Show the Code"}
            </button>
          </div>
        </div>

        {/* Presets */}
        <div className="flex flex-wrap gap-2 pt-2 border-t border-slate-100 dark:border-slate-800">
          <span className="text-xs text-slate-500 self-center font-medium">Presets:</span>
          {Object.values(LQ06_PRESETS).map((p) => (
            <button
              key={p.id}
              type="button"
              onClick={() => handlePreset(p.parameters as unknown as Lq06Parameters)}
              className="px-2.5 py-1 text-xs rounded border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 transition-colors"
              title={p.description}
            >
              {p.label}
            </button>
          ))}
        </div>
      </section>

      {/* Predict Mode */}
      {predictActive && (
        <section className="bg-amber-50 dark:bg-amber-950/40 border border-amber-300 dark:border-amber-800 rounded-lg p-5">
          <h3 className="text-base font-bold text-amber-900 dark:text-amber-200 mb-2">
            Predict Mode: Deduce The Move
          </h3>
          <p className="text-xs text-amber-800 dark:text-amber-300 mb-4">
            Test your deductive reasoning on why the identical functional form implies discrete
            energy quanta before revealing the calculation.
          </p>

          <div className="space-y-4">
            {PREDICT_PROMPTS.map((prompt) => (
              <div
                key={prompt.id}
                className="bg-white dark:bg-slate-900 border border-amber-200 dark:border-amber-900 rounded p-4 text-sm"
              >
                <p className="font-semibold text-slate-800 dark:text-slate-200 mb-2">
                  {prompt.question}
                </p>
                <div className="space-y-1.5 mb-3">
                  {prompt.options.map((opt) => (
                    <label
                      key={opt.text}
                      className={`flex items-start gap-2 p-2 rounded cursor-pointer border transition-colors ${
                        userAnswers[prompt.id] === prompt.options.indexOf(opt)
                          ? "border-rose-500 bg-rose-50/40 dark:bg-rose-950/20"
                          : "border-transparent hover:bg-slate-50 dark:hover:bg-slate-800"
                      }`}
                    >
                      <input
                        type="radio"
                        name={prompt.id}
                        checked={userAnswers[prompt.id] === prompt.options.indexOf(opt)}
                        onChange={() =>
                          setUserAnswers({ ...userAnswers, [prompt.id]: prompt.options.indexOf(opt) })
                        }
                        disabled={revealed[prompt.id]}
                        className="mt-0.5"
                      />
                      <span className="text-xs text-slate-700 dark:text-slate-300">{opt.text}</span>
                    </label>
                  ))}
                </div>

                {!revealed[prompt.id] ? (
                  <button
                    type="button"
                    disabled={userAnswers[prompt.id] === undefined}
                    onClick={() => setRevealed({ ...revealed, [prompt.id]: true })}
                    className="px-3 py-1 bg-amber-600 hover:bg-amber-700 disabled:opacity-50 text-white text-xs font-semibold rounded"
                  >
                    Check Deduction
                  </button>
                ) : (
                  <div
                    className={`p-3 rounded text-xs ${
                      prompt.options[userAnswers[prompt.id] ?? 0]?.correct
                        ? "bg-emerald-50 dark:bg-emerald-950/40 text-emerald-900 dark:text-emerald-200 border border-emerald-300"
                        : "bg-rose-50 dark:bg-rose-950/40 text-rose-900 dark:text-rose-200 border border-rose-300"
                    }`}
                  >
                    <p className="font-bold mb-1">
                      {prompt.options[userAnswers[prompt.id] ?? 0]?.correct
                        ? "✓ Correct Deduction"
                        : "✗ Alternative Hypothesis Disproved"}
                    </p>
                    <p>{prompt.explanation}</p>
                  </div>
                )}
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Main Grid: Controls & Visualizations */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Controls Column */}
        <div className="lg:col-span-5 space-y-4">
          {/* Subexpression Match Selector */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg p-4 space-y-3 shadow-sm">
            <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100 border-b pb-2 border-slate-100 dark:border-slate-800">
              Select the Subexpression for &quot;Number of Things (n)&quot;
            </h3>
            <p className="text-xs text-slate-600 dark:text-slate-400">
              Compare S - S₀ = (R/N) ln[(V/V₀)^n_eff] with S - S₀ = (R/N) n ln(V/V₀). Which term
              plays the role of n?
            </p>

            <div className="grid grid-cols-1 gap-1.5">
              {[
                { id: "N_E_over_R_beta_nu", label: "N·E / (R·β·ν)  [or E / (h·ν)]", desc: "Exponent of volume ratio (Correct)" },
                { id: "E", label: "E", desc: "Total radiation energy (Units: Joules)" },
                { id: "nu", label: "ν", desc: "Frequency (Units: Hz)" },
                { id: "E_over_beta_nu", label: "E / (β·ν)", desc: "Radiation entropy coeff (Units: J/K)" },
                { id: "V", label: "V", desc: "Volume (Units: m³)" },
              ].map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() =>
                    handleApply({
                      selectedSubexpression: item.id as Lq06SubexpressionChoice,
                      proposedEnergyElement: item.id === "N_E_over_R_beta_nu" ? "h_nu" : "none",
                    })
                  }
                  className={`text-left p-2 rounded text-xs border transition-colors ${
                    currentParams.selectedSubexpression === item.id
                      ? item.id === "N_E_over_R_beta_nu"
                        ? "border-emerald-500 bg-emerald-50/50 dark:bg-emerald-950/30 text-emerald-900 dark:text-emerald-200 font-semibold"
                        : "border-rose-500 bg-rose-50/50 dark:bg-rose-950/30 text-rose-900 dark:text-rose-200 font-semibold"
                      : "border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300"
                  }`}
                >
                  <div className="font-mono">{item.label}</div>
                  <div className="text-[10px] text-slate-500 dark:text-slate-400 font-sans">{item.desc}</div>
                </button>
              ))}
            </div>
          </div>

          {/* Physical Sliders */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg p-4 space-y-4 shadow-sm">
            <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100 border-b pb-2 border-slate-100 dark:border-slate-800">
              State Parameters
            </h3>

            {/* Radiation Energy */}
            <div>
              <div className="flex justify-between text-xs mb-1">
                <label htmlFor="energy-slider" className="font-medium text-slate-700 dark:text-slate-300">
                  Radiation Energy (E)
                </label>
                <span className="font-mono text-slate-600 dark:text-slate-400">{eNanoJ} nJ</span>
              </div>
              <input
                id="energy-slider"
                type="range"
                min="1"
                max="50"
                step="0.5"
                value={eNanoJ}
                onChange={(e) => {
                  setENanoJ(e.target.value);
                  handleApply({ radiationEnergy: Number.parseFloat(e.target.value) * 1e-9 });
                }}
                className="w-full h-1.5 bg-slate-200 dark:bg-slate-700 rounded cursor-pointer"
              />
            </div>

            {/* Frequency */}
            <div>
              <div className="flex justify-between text-xs mb-1">
                <label htmlFor="freq-slider" className="font-medium text-slate-700 dark:text-slate-300">
                  Frequency (ν)
                </label>
                <span className="font-mono text-slate-600 dark:text-slate-400">{freqTHz} THz</span>
              </div>
              <input
                id="freq-slider"
                type="range"
                min="200"
                max="1200"
                step="10"
                value={freqTHz}
                onChange={(e) => {
                  setFreqTHz(e.target.value);
                  handleApply({ frequency: Number.parseFloat(e.target.value) * 1e12 });
                }}
                className="w-full h-1.5 bg-slate-200 dark:bg-slate-700 rounded cursor-pointer"
              />
            </div>

            {/* Volume Ratio */}
            <div>
              <div className="flex justify-between text-xs mb-1">
                <label htmlFor="vol-slider" className="font-medium text-slate-700 dark:text-slate-300">
                  Volume Ratio (V / V₀)
                </label>
                <span className="font-mono text-slate-600 dark:text-slate-400">{volRatio}</span>
              </div>
              <input
                id="vol-slider"
                type="range"
                min="0.05"
                max="2.0"
                step="0.05"
                value={volRatio}
                onChange={(e) => {
                  setVolRatio(e.target.value);
                  handleApply({ volumeRatio: Number.parseFloat(e.target.value) });
                }}
                className="w-full h-1.5 bg-slate-200 dark:bg-slate-700 rounded cursor-pointer"
              />
            </div>

            {/* Gas Particles */}
            <div>
              <div className="flex justify-between text-xs mb-1">
                <label htmlFor="gas-slider" className="font-medium text-slate-700 dark:text-slate-300">
                  Comparison Gas Particles (n)
                </label>
                <span className="font-mono text-slate-600 dark:text-slate-400">{gasN}</span>
              </div>
              <input
                id="gas-slider"
                type="range"
                min="1"
                max="100"
                step="1"
                value={gasN}
                onChange={(e) => {
                  setGasN(e.target.value);
                  handleApply({ gasParticles: Number.parseInt(e.target.value, 10) });
                }}
                className="w-full h-1.5 bg-slate-200 dark:bg-slate-700 rounded cursor-pointer"
              />
            </div>

            {/* Blackbody Temperature */}
            <div>
              <div className="flex justify-between text-xs mb-1">
                <label htmlFor="temp-slider" className="font-medium text-slate-700 dark:text-slate-300">
                  Blackbody Temperature (T)
                </label>
                <span className="font-mono text-slate-600 dark:text-slate-400">{tempK} K</span>
              </div>
              <input
                id="temp-slider"
                type="range"
                min="500"
                max="6000"
                step="100"
                value={tempK}
                onChange={(e) => {
                  setTempK(e.target.value);
                  handleApply({ temperature: Number.parseFloat(e.target.value) });
                }}
                className="w-full h-1.5 bg-slate-200 dark:bg-slate-700 rounded cursor-pointer"
              />
            </div>

            {/* Fork A Choice */}
            <div>
              <label htmlFor="fork-select" className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                Fork A: Epistemic Interpretation
              </label>
              <select
                id="fork-select"
                value={currentParams.forkAChoice}
                onChange={(e) => {
                  handleApply({ forkAChoice: e.target.value as Lq06ForkAChoice });
                }}
                className="w-full text-xs p-2 border border-slate-300 dark:border-slate-700 rounded bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-slate-100"
              >
                <option value="none">No philosophical stance chosen</option>
                <option value="independent-quanta">
                  Light Quanta Hypothesis: Radiation behaves as independent energy packets (The Move)
                </option>
                <option value="coincidence">
                  Formal Coincidence: Purely an algebraic curiosity, waves remain continuous
                </option>
              </select>
            </div>
          </div>
        </div>

        {/* Visualizations Column */}
        <div className="lg:col-span-7 space-y-6">
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
          />

          <MeanEnergyStripPlot
            meanQuantumEnergyEv={meanQuantumEnergyEv}
            moleculeKineticEnergyEv={moleculeKineticEnergyEv}
            temperatureK={currentParams.temperature}
            ratio={meanEnergyRatio}
            ratioAt600THz={ratioAt600THz}
          />

          {/* Three Logical-Role Cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg p-3 text-xs space-y-1.5 shadow-sm">
              <span className="font-bold text-slate-800 dark:text-slate-200 block border-b pb-1 border-slate-100 dark:border-slate-800">
                1. Derivation (Algebra)
              </span>
              <p className="text-slate-600 dark:text-slate-400">
                The functional forms of Wien radiation entropy and Boltzmann gas entropy agree
                identically if and only if n = N·E / (R·β·ν) = E / (h·ν).
              </p>
            </div>

            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg p-3 text-xs space-y-1.5 shadow-sm">
              <span className="font-bold text-slate-800 dark:text-slate-200 block border-b pb-1 border-slate-100 dark:border-slate-800">
                2. Heuristic Inference
              </span>
              <p className="text-slate-600 dark:text-slate-400">
                Monochromatic radiation of low density in the Wien regime behaves thermodynamically
                <strong> as though</strong> it consists of independent energy quanta of magnitude
                h·ν.
              </p>
            </div>

            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg p-3 text-xs space-y-1.5 shadow-sm">
              <span className="font-bold text-slate-800 dark:text-slate-200 block border-b pb-1 border-slate-100 dark:border-slate-800">
                3. Further Hypothesis
              </span>
              <p className="text-slate-600 dark:text-slate-400">
                Are the laws of production (Stokes rule §7) and transformation (photoelectric §8,
                ionization §9) also governed by discrete energy exchanges of size h·ν?
              </p>
            </div>
          </div>

          {/* Quantitative Telemetry Table */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg p-4 shadow-sm">
            <h4 className="text-sm font-bold text-slate-900 dark:text-slate-100 mb-3">
              Accepted Telemetry Snapshot
            </h4>
            <div className="overflow-x-auto">
              <table className="w-full text-xs text-left" aria-label="Accepted telemetry snapshot">
                <thead>
                  <tr className="border-b border-slate-200 dark:border-slate-700 text-slate-500 font-medium">
                    <th className="py-1.5">Quantity</th>
                    <th className="py-1.5">Symbol</th>
                    <th className="py-1.5">Status</th>
                    <th className="py-1.5 text-right">Value</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800 font-mono">
                  <tr data-quantity-id="radiationEnergy">
                    <td className="py-1.5 font-sans">Radiation Energy</td>
                    <td>E</td>
                    <td><span className="text-emerald-600 font-sans">value</span></td>
                    <td className="text-right">{(currentParams.radiationEnergy * 1e9).toFixed(4)} nJ</td>
                  </tr>
                  <tr data-quantity-id="frequency">
                    <td className="py-1.5 font-sans">Frequency</td>
                    <td>ν</td>
                    <td><span className="text-emerald-600 font-sans">value</span></td>
                    <td className="text-right">{(currentParams.frequency / 1e12).toFixed(2)} THz</td>
                  </tr>
                  <tr data-quantity-id="volumeRatio">
                    <td className="py-1.5 font-sans">Volume Ratio</td>
                    <td>V/V₀</td>
                    <td><span className="text-emerald-600 font-sans">value</span></td>
                    <td className="text-right">{currentParams.volumeRatio.toFixed(4)}</td>
                  </tr>
                  <tr data-quantity-id="effectiveIndependentCount">
                    <td className="py-1.5 font-sans">Effective Quanta Count (Never Rounded)</td>
                    <td>n_eff</td>
                    <td><span className="text-emerald-600 font-sans">value</span></td>
                    <td className="text-right">{effectiveCount.toExponential(6)}</td>
                  </tr>
                  <tr data-quantity-id="quantumEnergy">
                    <td className="py-1.5 font-sans">Energy per Quantum (SI)</td>
                    <td>ε = hν</td>
                    <td><span className="text-emerald-600 font-sans">value</span></td>
                    <td className="text-right">{quantumEnergyJ.toExponential(6)} J</td>
                  </tr>
                  <tr data-quantity-id="quantumEnergyEv">
                    <td className="py-1.5 font-sans">Energy per Quantum (eV)</td>
                    <td>ε_eV</td>
                    <td><span className="text-emerald-600 font-sans">value</span></td>
                    <td className="text-right">{quantumEnergyEv.toFixed(6)} eV</td>
                  </tr>
                  <tr data-quantity-id="entropyVolumeCoefficient">
                    <td className="py-1.5 font-sans">Radiation Entropy Volume Coeff</td>
                    <td>E / (βν)</td>
                    <td><span className="text-emerald-600 font-sans">value</span></td>
                    <td className="text-right">{radVolumeCoeff.toExponential(6)} J/K</td>
                  </tr>
                  <tr data-quantity-id="gasEntropyVolumeCoefficient">
                    <td className="py-1.5 font-sans">Gas Entropy Volume Coeff</td>
                    <td>(R/N) n</td>
                    <td><span className="text-emerald-600 font-sans">value</span></td>
                    <td className="text-right">{gasVolumeCoeff.toExponential(6)} J/K</td>
                  </tr>
                  <tr data-quantity-id="radiationEntropy">
                    <td className="py-1.5 font-sans">Radiation Entropy Change</td>
                    <td>ΔS_rad</td>
                    <td><span className="text-emerald-600 font-sans">value</span></td>
                    <td className="text-right">{radEntropy.toExponential(6)} J/K</td>
                  </tr>
                  <tr data-quantity-id="gasEntropy">
                    <td className="py-1.5 font-sans">Gas Entropy Change</td>
                    <td>ΔS_gas</td>
                    <td><span className="text-emerald-600 font-sans">value</span></td>
                    <td className="text-right">{gasEntropy.toExponential(6)} J/K</td>
                  </tr>
                  <tr data-quantity-id="meanQuantumEnergyWienEv">
                    <td className="py-1.5 font-sans">Wien Mean Quantum Energy</td>
                    <td>⟨ε⟩ = 3 k_B T</td>
                    <td><span className="text-emerald-600 font-sans">value</span></td>
                    <td className="text-right">{meanQuantumEnergyEv.toFixed(6)} eV</td>
                  </tr>
                  <tr data-quantity-id="moleculeMeanKineticEnergyEv">
                    <td className="py-1.5 font-sans">Gas Molecule Kinetic Energy</td>
                    <td>⟨E_kin⟩ = 1.5 k_B T</td>
                    <td><span className="text-emerald-600 font-sans">value</span></td>
                    <td className="text-right">{moleculeKineticEnergyEv.toFixed(6)} eV</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>

      {/* Show the Code */}
      {showCode && (
        <section className="bg-slate-900 text-slate-200 rounded-lg p-5 border border-slate-800 font-mono text-xs overflow-x-auto space-y-3">
          <div className="flex justify-between items-center text-slate-400 border-b border-slate-800 pb-2">
            <span>Pinned Kernel Evaluator: src/physics/reference/radiation/quanta.ts</span>
            <span className="text-[10px] bg-slate-800 px-2 py-0.5 rounded">TypeScript Reference Owner</span>
          </div>
          <pre className="text-slate-300 leading-relaxed">
{`// Paper 1, §6 The Move: Matching Entropy Coefficients
// Radiation entropy: S - S_0 = (E / (beta * nu)) * ln(V / V_0)
// Boltzmann gas entropy: S - S_0 = (R / N) * n * ln(V / V_0)
//
// Equating the exponents in W = (V / V_0)^n:
// n_eff = (N / R) * (E / (beta * nu)) = E / (h * nu)
// Energy per quantum: epsilon = E / n_eff = (R * beta * nu) / N = h * nu
//
// Mean quantum energy over Wien spectrum:
// <epsilon> = 3 * (R / N) * T = 3 * k_B * T  (exactly 2x molecule kinetic energy 1.5 * k_B * T)`}
          </pre>
        </section>
      )}

      {/* Limits of this Reference Model */}
      <section className="bg-slate-50 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-800 rounded-lg p-4">
        <h4 className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300 mb-2">
          Limits of this Reference Model (Not Modeled)
        </h4>
        <ul className="grid grid-cols-1 md:grid-cols-2 gap-2 text-xs text-slate-600 dark:text-slate-400">
          {LQ06_NOT_MODELED.map((item) => (
            <li key={item} className="flex items-start gap-1.5">
              <span className="text-rose-500 font-bold">&bull;</span>
              <span>{item}</span>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}

export const CoefficientMatchComparison = CoefficientMatchLab;
