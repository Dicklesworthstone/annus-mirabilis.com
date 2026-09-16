"use client";

import { useEffect, useMemo, useState, useSyncExternalStore } from "react";
import {
  LQ09_DEFAULTS,
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
import { IonizationCountingPlot, IonizationThresholdLadderPlot } from "./IonizationPlot.tsx";

export type IonizationLabProps = Readonly<{
  example?: PreparedLq09Example | undefined;
}>;

type PredictPrompt = Readonly<{
  id: string;
  question: string;
  options: readonly { text: string; correct: boolean }[];
  explanation: string;
}>;

const PREDICT_PROMPTS: readonly PredictPrompt[] = [
  {
    id: "sub-threshold",
    question:
      "If the light quantum energy is below the molecular threshold (h*nu < J_mol), what is the single-quantum ionization rate?",
    options: [
      {
        text: "Strictly zero (not-applicable in this hypothesis), regardless of beam intensity.",
        correct: true,
      },
      {
        text: "A non-zero rate if you concentrate the light to a high radiant intensity.",
        correct: false,
      },
      {
        text: "Molecules absorb gradually until accumulating enough energy to ionize.",
        correct: false,
      },
    ],
    explanation:
      "In Einstein's §9 hypothesis, each ionization event is an elementary process requiring at least one quantum of energy h*nu >= J_mol. Below threshold, no single-quantum ionization occurs.",
  },
  {
    id: "power-doubling",
    question:
      "If you double the incident optical power at fixed frequency, what happens to the count of ionized molecules?",
    options: [
      {
        text: "The count doubles because absorbed light energy L doubles: j = L / (R*beta*nu).",
        correct: true,
      },
      {
        text: "The count stays the same because individual quantum energy is unchanged.",
        correct: false,
      },
      {
        text: "The count increases by the square of the power.",
        correct: false,
      },
    ],
    explanation:
      "Under the paper's primary hypothesis, the number of ionized molecules is proportional to absorbed light energy L: j = L / (R*beta*nu). Doubling power doubles absorbed quanta and ionized molecules.",
  },
];

export function IonizationLab({ example }: IonizationLabProps) {
  const session = useMemo(() => createLq09Session("lq09-interactive-session", example), [example]);

  const snapshot = useSyncExternalStore(
    session.subscribe,
    session.getSnapshot,
    session.getServerSnapshot,
  );

  const accepted = snapshot.accepted;
  const currentParams: Lq09Parameters = useMemo(() => {
    return (accepted?.parameters ?? LQ09_DEFAULTS) as unknown as Lq09Parameters;
  }, [accepted]);

  // Extract outputs from accepted snapshot
  const getOutput = (quantityId: string) => {
    return accepted?.outputs.find((o) => o.quantityId === quantityId);
  };

  const getOutputValue = (quantityId: string): number | null => {
    const out = accepted?.outputs.find((o) => o.quantityId === quantityId);
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
  const ionizationRate =
    ionizationRateOut &&
    ionizationRateOut.status === "value" &&
    typeof ionizationRateOut.value === "number"
      ? ionizationRateOut.value
      : null;
  const ionizationStatus = ionizationRateOut?.status ?? "value";

  const ionizedGramMoleculesOut = getOutput("ionizedGramMolecules");

  // Predict mode state
  const [predictActive, setPredictActive] = useState(false);
  const [userAnswers, setUserAnswers] = useState<Record<string, number>>({});
  const [revealed, setRevealed] = useState<Record<string, boolean>>({});

  // Show the code state
  const [showCode, setShowCode] = useState(false);

  // Local draft state for sliders
  const [freqTHz, setFreqTHz] = useState((currentParams.frequency / 1e12).toFixed(2));
  const [jMolEv, setJMolEv] = useState(String(currentParams.ionizationEnergyEv));
  const [pOptMicroW, setPOptMicroW] = useState((currentParams.incidentPower * 1e6).toFixed(2));
  const [etaAbs, setEtaAbs] = useState(String(currentParams.absorptionEfficiency));
  const [durationSec, setDurationSec] = useState(String(currentParams.duration));
  const [absMode, setAbsMode] = useState<Lq09AbsorptionMode>(currentParams.absorptionMode);
  const [decFrac, setDecFrac] = useState(String(currentParams.declaredFraction));

  useEffect(() => {
    setFreqTHz((currentParams.frequency / 1e12).toFixed(2));
    setJMolEv(String(currentParams.ionizationEnergyEv));
    setPOptMicroW((currentParams.incidentPower * 1e6).toFixed(2));
    setEtaAbs(String(currentParams.absorptionEfficiency));
    setDurationSec(String(currentParams.duration));
    setAbsMode(currentParams.absorptionMode);
    setDecFrac(String(currentParams.declaredFraction));
  }, [currentParams]);

  const handleApply = (patch: Partial<Lq09Parameters>) => {
    session.apply(patch);
  };

  const handlePreset = (presetParams: Lq09Parameters) => {
    session.apply(presetParams);
  };

  const histChecks = useMemo(() => einsteinPrintedIonizationChecks(), []);

  return (
    <div className="lab-container max-w-5xl mx-auto p-4 space-y-6" data-instrument-id="lq-09">
      {/* Header & Preset Bar */}
      <section className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg p-4 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
          <div>
            <span className="text-xs uppercase tracking-wider font-semibold text-rose-600 dark:text-rose-400">
              Interactive Critical Edition · Instrument LQ-09
            </span>
            <h2 className="text-xl font-bold text-slate-900 dark:text-slate-100">
              Gas Ionization Bounds and Counting Model
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
          {Object.values(LQ09_PRESETS).map((p) => (
            <button
              key={p.id}
              type="button"
              onClick={() => handlePreset(p.parameters as unknown as Lq09Parameters)}
              className="px-2.5 py-1 text-xs rounded border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 transition-colors"
              title={p.description}
            >
              {p.label}
            </button>
          ))}
        </div>
      </section>

      {/* Predict Mode Overlay */}
      {predictActive && (
        <section className="bg-amber-50 dark:bg-amber-950/40 border border-amber-300 dark:border-amber-800 rounded-lg p-5">
          <h3 className="text-base font-bold text-amber-900 dark:text-amber-200 mb-2">
            Predict Mode: Deductive Predictions
          </h3>
          <p className="text-xs text-amber-800 dark:text-amber-300 mb-4">
            Test your deductive understanding of single-quantum ionization bounds before observing
            the simulator output.
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
                  {prompt.options.map((opt, idx) => (
                    <label
                      key={opt.text}
                      className={`flex items-start gap-2 p-2 rounded cursor-pointer border transition-colors ${
                        userAnswers[prompt.id] === idx
                          ? "border-rose-500 bg-rose-50/40 dark:bg-rose-950/20"
                          : "border-transparent hover:bg-slate-50 dark:hover:bg-slate-800"
                      }`}
                    >
                      <input
                        type="radio"
                        name={prompt.id}
                        checked={userAnswers[prompt.id] === idx}
                        onChange={() => setUserAnswers({ ...userAnswers, [prompt.id]: idx })}
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
                    Check Prediction
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
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg p-4 space-y-4 shadow-sm">
            <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100 border-b pb-2 border-slate-100 dark:border-slate-800">
              Experimental Controls
            </h3>

            {/* Light Frequency */}
            <div>
              <div className="flex justify-between text-xs mb-1">
                <label
                  htmlFor="freq-slider"
                  className="font-medium text-slate-700 dark:text-slate-300"
                >
                  Light Frequency (&nu;)
                </label>
                <span className="font-mono text-slate-600 dark:text-slate-400">
                  {freqTHz} THz ({quantumEnergyEv.toFixed(2)} eV)
                </span>
              </div>
              <input
                id="freq-slider"
                type="range"
                min="1000"
                max="4500"
                step="10"
                value={freqTHz}
                onChange={(e) => {
                  setFreqTHz(e.target.value);
                  handleApply({ frequency: Number.parseFloat(e.target.value) * 1e12 });
                }}
                className="w-full h-1.5 bg-slate-200 dark:bg-slate-700 rounded cursor-pointer"
              />
            </div>

            {/* Ionization Energy */}
            <div>
              <div className="flex justify-between text-xs mb-1">
                <label
                  htmlFor="jmol-slider"
                  className="font-medium text-slate-700 dark:text-slate-300"
                >
                  Ionization Threshold (J_mol)
                </label>
                <span className="font-mono text-slate-600 dark:text-slate-400">{jMolEv} eV</span>
              </div>
              <input
                id="jmol-slider"
                type="range"
                min="4"
                max="20"
                step="0.1"
                value={jMolEv}
                onChange={(e) => {
                  setJMolEv(e.target.value);
                  handleApply({ ionizationEnergyEv: Number.parseFloat(e.target.value) });
                }}
                className="w-full h-1.5 bg-slate-200 dark:bg-slate-700 rounded cursor-pointer"
              />
            </div>

            {/* Optical Power */}
            <div>
              <div className="flex justify-between text-xs mb-1">
                <label
                  htmlFor="popt-slider"
                  className="font-medium text-slate-700 dark:text-slate-300"
                >
                  Incident Power (P_opt)
                </label>
                <span className="font-mono text-slate-600 dark:text-slate-400">
                  {pOptMicroW} &mu;W
                </span>
              </div>
              <input
                id="popt-slider"
                type="range"
                min="0.1"
                max="10"
                step="0.1"
                value={pOptMicroW}
                onChange={(e) => {
                  setPOptMicroW(e.target.value);
                  handleApply({ incidentPower: Number.parseFloat(e.target.value) * 1e-6 });
                }}
                className="w-full h-1.5 bg-slate-200 dark:bg-slate-700 rounded cursor-pointer"
              />
            </div>

            {/* Absorption Efficiency */}
            <div>
              <div className="flex justify-between text-xs mb-1">
                <label
                  htmlFor="eta-slider"
                  className="font-medium text-slate-700 dark:text-slate-300"
                >
                  Absorption Fraction (&eta;_abs)
                </label>
                <span className="font-mono text-slate-600 dark:text-slate-400">
                  {(Number.parseFloat(etaAbs) * 100).toFixed(0)}%
                </span>
              </div>
              <input
                id="eta-slider"
                type="range"
                min="0.05"
                max="1.0"
                step="0.05"
                value={etaAbs}
                onChange={(e) => {
                  setEtaAbs(e.target.value);
                  handleApply({ absorptionEfficiency: Number.parseFloat(e.target.value) });
                }}
                className="w-full h-1.5 bg-slate-200 dark:bg-slate-700 rounded cursor-pointer"
              />
            </div>

            {/* Exposure Duration */}
            <div>
              <div className="flex justify-between text-xs mb-1">
                <label
                  htmlFor="dur-slider"
                  className="font-medium text-slate-700 dark:text-slate-300"
                >
                  Exposure Duration (t)
                </label>
                <span className="font-mono text-slate-600 dark:text-slate-400">
                  {durationSec} s
                </span>
              </div>
              <input
                id="dur-slider"
                type="range"
                min="0.1"
                max="10.0"
                step="0.1"
                value={durationSec}
                onChange={(e) => {
                  setDurationSec(e.target.value);
                  handleApply({ duration: Number.parseFloat(e.target.value) });
                }}
                className="w-full h-1.5 bg-slate-200 dark:bg-slate-700 rounded cursor-pointer"
              />
            </div>

            {/* Absorption Mode Selection */}
            <div>
              <label
                htmlFor="mode-select"
                className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1"
              >
                Absorption Epistemic State
              </label>
              <select
                id="mode-select"
                value={absMode}
                onChange={(e) => {
                  const mode = e.target.value as Lq09AbsorptionMode;
                  setAbsMode(mode);
                  handleApply({ absorptionMode: mode });
                }}
                className="w-full text-xs p-2 border border-slate-300 dark:border-slate-700 rounded bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-slate-100"
              >
                <option value="all-absorbed-ionizes">
                  Primary Hypothesis: All absorbed light ionizes (j = L / R&beta;&nu;)
                </option>
                <option value="declared-fraction">
                  Declared Fraction: Ionization yield a &lt; 1
                </option>
                <option value="unknown">
                  Unknown: Unmeasured non-ionizing channels (Upper Bound only)
                </option>
              </select>
            </div>

            {/* Declared Fraction slider when in declared-fraction mode */}
            {absMode === "declared-fraction" && (
              <div>
                <div className="flex justify-between text-xs mb-1">
                  <label
                    htmlFor="dec-slider"
                    className="font-medium text-slate-700 dark:text-slate-300"
                  >
                    Declared Yield (a)
                  </label>
                  <span className="font-mono text-slate-600 dark:text-slate-400">
                    {(Number.parseFloat(decFrac) * 100).toFixed(0)}%
                  </span>
                </div>
                <input
                  id="dec-slider"
                  type="range"
                  min="0.05"
                  max="1.0"
                  step="0.05"
                  value={decFrac}
                  onChange={(e) => {
                    setDecFrac(e.target.value);
                    handleApply({ declaredFraction: Number.parseFloat(e.target.value) });
                  }}
                  className="w-full h-1.5 bg-slate-200 dark:bg-slate-700 rounded cursor-pointer"
                />
              </div>
            )}
          </div>

          {/* Historical Checks Card */}
          <div className="bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg p-4 space-y-2">
            <h4 className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300">
              Einstein&apos;s 1905 Historical Checks (§9)
            </h4>
            <div className="text-xs space-y-2 text-slate-600 dark:text-slate-400">
              <div className="p-2 bg-white dark:bg-slate-800 rounded border border-slate-100 dark:border-slate-700">
                <p className="font-semibold text-slate-800 dark:text-slate-200">
                  Philipp Lenard (1900) Air Ionization
                </p>
                <p>
                  Observed cutoff: &lambda; &le; 190 nm &rarr; R&beta;&nu; ={" "}
                  <span className="font-mono font-bold text-rose-600 dark:text-rose-400">
                    {histChecks.lenardCheck.printedEnergyText}
                  </span>{" "}
                  ({histChecks.lenardCheck.printedPotentialText})
                </p>
                <p className="text-[11px] text-slate-500">
                  Modern SI at 190 nm: {histChecks.lenardCheck.modernEnergyEvAt190nm.toFixed(2)} eV
                  (per molecule).
                </p>
              </div>

              <div className="p-2 bg-white dark:bg-slate-800 rounded border border-slate-100 dark:border-slate-700">
                <p className="font-semibold text-slate-800 dark:text-slate-200">
                  Johannes Stark (1902) Cathode Rays
                </p>
                <p>
                  Cathode-ray ionization potential:{" "}
                  <span className="font-mono font-bold text-rose-600 dark:text-rose-400">
                    {histChecks.starkCheck.printedPotentialText}
                  </span>{" "}
                  &rarr; &lambda;_0 &approx;{" "}
                  {histChecks.starkCheck.thresholdWavelengthNm.toFixed(0)} nm
                </p>
                <p className="text-[11px] text-slate-500">
                  J = {histChecks.starkCheck.energyPerGramEquivalentErg.toExponential(1)} erg per
                  gram-equivalent.
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Visualizations Column */}
        <div className="lg:col-span-7 space-y-6">
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
            absorptionMode={absMode}
            declaredFraction={Number.parseFloat(decFrac)}
          />

          {/* Quantitative Summary Table */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg p-4 shadow-sm">
            <h4 className="text-sm font-bold text-slate-900 dark:text-slate-100 mb-3">
              Accepted Laboratory Telemetry Snapshot
            </h4>
            <div className="overflow-x-auto">
              <table
                className="w-full text-xs text-left"
                aria-label="Accepted laboratory telemetry snapshot"
              >
                <thead>
                  <tr className="border-b border-slate-200 dark:border-slate-700 text-slate-500 font-medium">
                    <th className="py-1.5">Quantity</th>
                    <th className="py-1.5">Symbol</th>
                    <th className="py-1.5">Status</th>
                    <th className="py-1.5 text-right">Value</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800 font-mono">
                  <tr data-quantity-id="frequency">
                    <td className="py-1.5 font-sans">Light Frequency</td>
                    <td>&nu;</td>
                    <td>
                      <span className="text-emerald-600 font-sans">value</span>
                    </td>
                    <td className="text-right">
                      {(currentParams.frequency / 1e12).toFixed(2)} THz
                    </td>
                  </tr>
                  <tr data-quantity-id="ionizationEnergyPerMolecule">
                    <td className="py-1.5 font-sans">Ionization Work / Molecule</td>
                    <td>J_mol</td>
                    <td>
                      <span className="text-emerald-600 font-sans">value</span>
                    </td>
                    <td className="text-right">{currentParams.ionizationEnergyEv.toFixed(2)} eV</td>
                  </tr>
                  <tr data-quantity-id="quantumEnergyEv">
                    <td className="py-1.5 font-sans">Quantum Energy</td>
                    <td>h&nu;</td>
                    <td>
                      <span className="text-emerald-600 font-sans">value</span>
                    </td>
                    <td className="text-right">{quantumEnergyEv.toFixed(4)} eV</td>
                  </tr>
                  <tr data-quantity-id="excessEnergyEv">
                    <td className="py-1.5 font-sans">Excess Kinetic Energy</td>
                    <td>E_excess</td>
                    <td>
                      <span className="text-emerald-600 font-sans">value</span>
                    </td>
                    <td className="text-right">{excessEnergyEv.toFixed(4)} eV</td>
                  </tr>
                  <tr data-quantity-id="absorbedLightEnergy">
                    <td className="py-1.5 font-sans">Absorbed Light Energy</td>
                    <td>L</td>
                    <td>
                      <span className="text-emerald-600 font-sans">value</span>
                    </td>
                    <td className="text-right">{absorbedLightEnergy.toExponential(4)} J</td>
                  </tr>
                  <tr data-quantity-id="absorbedQuantumRate">
                    <td className="py-1.5 font-sans">Absorbed Quantum Rate</td>
                    <td>N&#775;_abs</td>
                    <td>
                      <span className="text-emerald-600 font-sans">value</span>
                    </td>
                    <td className="text-right">{absorbedQRate.toExponential(4)} s&#8315;&sup1;</td>
                  </tr>
                  <tr data-quantity-id="ionizationRate">
                    <td className="py-1.5 font-sans">Ionization Event Rate</td>
                    <td>N&#775;_ion</td>
                    <td>
                      <span
                        className={`font-sans ${
                          ionizationStatus === "value"
                            ? "text-emerald-600"
                            : ionizationStatus === "underdetermined"
                              ? "text-amber-600"
                              : "text-rose-600"
                        }`}
                      >
                        {ionizationStatus}
                      </span>
                    </td>
                    <td className="text-right">
                      {ionizationStatus === "value" && ionizationRate !== null
                        ? `${ionizationRate.toExponential(4)} s⁻¹`
                        : ionizationStatus === "underdetermined"
                          ? `≤ ${absorbedQRate.toExponential(4)} s⁻¹`
                          : "not-applicable"}
                    </td>
                  </tr>
                  <tr data-quantity-id="ionizedGramMolecules">
                    <td className="py-1.5 font-sans">Ionized Gram-Molecules</td>
                    <td>j</td>
                    <td>
                      <span
                        className={`font-sans ${
                          ionizedGramMoleculesOut?.status === "value"
                            ? "text-emerald-600"
                            : ionizedGramMoleculesOut?.status === "underdetermined"
                              ? "text-amber-600"
                              : "text-rose-600"
                        }`}
                      >
                        {ionizedGramMoleculesOut?.status ?? "value"}
                      </span>
                    </td>
                    <td className="text-right">
                      {ionizedGramMoleculesOut &&
                      ionizedGramMoleculesOut.status === "value" &&
                      typeof ionizedGramMoleculesOut.value === "number"
                        ? `${ionizedGramMoleculesOut.value.toExponential(4)} mol`
                        : ionizedGramMoleculesOut?.status === "underdetermined"
                          ? `≤ ${(absorbedLightEnergy / (6.022e23 * quantumEnergyEv * 1.602e-19)).toExponential(4)} mol`
                          : "not-applicable"}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>

      {/* Show the Code Disclosure */}
      {showCode && (
        <section className="bg-slate-900 text-slate-200 rounded-lg p-5 border border-slate-800 font-mono text-xs overflow-x-auto space-y-3">
          <div className="flex justify-between items-center text-slate-400 border-b border-slate-800 pb-2">
            <span>Pinned Kernel Evaluator: src/physics/reference/photoelectric.ts</span>
            <span className="text-[10px] bg-slate-800 px-2 py-0.5 rounded">
              TypeScript Reference Owner
            </span>
          </div>
          <pre className="text-slate-300 leading-relaxed">
            {`// Paper 1, §9 Single-Quantum Ionization Conservation:
// Threshold frequency: nu_0 = J_mol / h
// If nu < nu_0: ionization count and rate are strictly not-applicable.
// If nu >= nu_0:
//   Under "all-absorbed-ionizes": j = L / (R*beta*nu) or N_ion = L / (h*nu)
//   Under "declared-fraction":   N_ion = a * L / (h*nu)
//   Under "unknown":             underdetermined with upper bound N_abs = L / (h*nu)`}
          </pre>
        </section>
      )}

      {/* Limits of this Reference Model */}
      <section className="bg-slate-50 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-800 rounded-lg p-4">
        <h4 className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300 mb-2">
          Limits of this Reference Model (Not Modeled)
        </h4>
        <ul className="grid grid-cols-1 md:grid-cols-2 gap-2 text-xs text-slate-600 dark:text-slate-400">
          {LQ09_NOT_MODELED.map((item) => (
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

export const IonizationComparison = IonizationLab;
