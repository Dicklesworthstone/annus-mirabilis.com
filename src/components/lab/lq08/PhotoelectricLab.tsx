"use client";

import { useEffect, useId, useMemo, useState, useSyncExternalStore } from "react";
import { LQ08_HISTORICAL_CHECK, LQ08_NOT_MODELED } from "../../../experiments/lq08/definition.ts";
import { evaluateMillikanOverlay } from "../../../experiments/lq08/millikan.ts";
import { createLq08Session, type PreparedLq08Example } from "../../../experiments/lq08/session.ts";
import {
  CurrentVoltagePlot,
  EnergyLadderPlot,
  StoppingPotentialPlot,
} from "./PhotoelectricPlot.tsx";

export type PhotoelectricLabProps = Readonly<{
  example?: PreparedLq08Example | undefined;
}>;

type Preset = Readonly<{
  id: string;
  name: string;
  description: string;
  patch: Readonly<{
    incidentPower: number;
    frequency: number;
    workFunction: number;
    quantumEfficiency: number;
    collectorPotential: number;
  }>;
}>;

const PRESETS: readonly Preset[] = [
  {
    id: "lq-08-intensity-probe",
    name: "The Intensity Probe (Rate vs Energy)",
    description: "Monochromatic 600 THz on hypothetical Phi = 2.0 eV with 1 mW incident power.",
    patch: {
      incidentPower: 0.001,
      frequency: 6.0e14,
      workFunction: 2.0,
      quantumEfficiency: 0.1,
      collectorPotential: 0.0,
    },
  },
  {
    id: "lq-08-historical-check",
    name: "Einstein 1905 §8 Check (UV Spark, P'=0)",
    description: "Einstein's 1905 order-of-magnitude check with neglected escape work.",
    patch: {
      incidentPower: 0.001,
      frequency: 1.03e15,
      workFunction: 0.0,
      quantumEfficiency: 0.1,
      collectorPotential: 0.0,
    },
  },
  {
    id: "lq-08-two-metals",
    name: "Two Metals Comparison (2.0 eV vs 3.0 eV)",
    description: "Compare stopping line slopes and threshold shifts between two metals.",
    patch: {
      incidentPower: 0.001,
      frequency: 8.0e14,
      workFunction: 3.0,
      quantumEfficiency: 0.1,
      collectorPotential: 0.0,
    },
  },
];

type PredictCandidate = Readonly<{
  id: string;
  label: string;
  description: string;
  separatingAssumption: string;
  correct: boolean;
}>;

type PredictPrompt = Readonly<{
  promptId: string;
  controlId: string;
  question: string;
  candidates: readonly PredictCandidate[];
  explanation: string;
}>;

const PREDICT_PROMPTS: readonly PredictPrompt[] = [
  {
    promptId: "lq-08-predict-double-power",
    controlId: "incidentPower",
    question:
      "Make the lamp twice as bright without changing its frequency. What happens to the energy of the fastest electrons?",
    candidates: [
      {
        id: "energy-increases",
        label: "It increases",
        description: "Greater wave intensity delivers more energy per electron.",
        separatingAssumption:
          "Classical wave assumption: energy transfer depends on light intensity.",
        correct: false,
      },
      {
        id: "energy-unchanged",
        label: "It stays the same",
        description:
          "Each electron absorbs exactly one light quantum whose energy depends on frequency alone.",
        separatingAssumption:
          "Light-quantum assumption: one quantum transfers its energy to one electron, changing emission rate but not individual energy.",
        correct: true,
      },
      {
        id: "energy-decreases",
        label: "It decreases",
        description:
          "Crowding more electrons slows individual electrons down through space charge.",
        separatingAssumption:
          "Space-charge assumption: assumes collective electron repulsion degrades individual peak kinetic energy.",
        correct: false,
      },
    ],
    explanation:
      "In the light-quantum hypothesis, each electron absorbs exactly one quantum. Radiant power changes the arrival rate, not the energy of individual quanta.",
  },
  {
    promptId: "lq-08-predict-raise-frequency",
    controlId: "frequency",
    question:
      "Raise the frequency while keeping the lamp's power the same. What happens to the number of quanta arriving each second?",
    candidates: [
      {
        id: "rate-rises",
        label: "More arrive each second",
        description:
          "Higher-frequency light has greater penetrating power and frees electrons more readily.",
        separatingAssumption:
          "Assumes higher frequency increases the quantum count per unit power.",
        correct: false,
      },
      {
        id: "rate-falls",
        label: "Fewer arrive each second",
        description:
          "At fixed power, each quantum carries more energy, so fewer quanta arrive each second.",
        separatingAssumption:
          "Light-quantum accounting: total power equals quantum rate times quantum energy, so rate falls as frequency rises.",
        correct: true,
      },
      {
        id: "rate-unchanged",
        label: "The same number arrive each second",
        description:
          "Total power determines the total energy entering the metal per second, so the quantum count is conserved.",
        separatingAssumption:
          "Assumes light delivers continuous energy with constant quantum rate at fixed power.",
        correct: false,
      },
    ],
    explanation:
      "Because total power P = N_dot * h * nu, higher frequency means each quantum carries more energy, so fewer quanta arrive each second at fixed total power.",
  },
  {
    promptId: "lq-08-predict-two-metals",
    controlId: "workFunction",
    question:
      "Two different metals are lit by the same lamp. Plotted against frequency, are their stopping-potential lines parallel, crossing, or identical?",
    candidates: [
      {
        id: "lines-parallel",
        label: "Parallel, with different starting thresholds",
        description:
          "The slope is a universal constant of radiation and charge, while the work function shifts the starting threshold.",
        separatingAssumption:
          "Universal quantum slope: the stopping line slope is universal and independent of the material.",
        correct: true,
      },
      {
        id: "lines-crossing",
        label: "Crossing",
        description:
          "Different metals couple differently to light, so each metal has its own characteristic slope.",
        separatingAssumption:
          "Material-specific coupling: assumes frequency sensitivity depends on the metal electron structure.",
        correct: false,
      },
      {
        id: "lines-identical",
        label: "Identical",
        description:
          "The photoelectric response is a universal property of free electrons in all conductors.",
        separatingAssumption:
          "Free electron assumption: ignores the material-dependent surface escape barrier.",
        correct: false,
      },
    ],
    explanation:
      "The slope dVs/dnu = h/e is a universal constant of radiation and charge, independent of the metal. Only the threshold frequency nu_0 = Phi / h differs.",
  },
];

export function PhotoelectricLab({ example }: PhotoelectricLabProps) {
  const instanceId = useId();
  const session = useMemo(() => createLq08Session(instanceId, example), [instanceId, example]);
  const view = useSyncExternalStore(
    session.subscribe,
    session.getSnapshot,
    session.getServerSnapshot,
  );

  const [activePromptIndex, setActivePromptIndex] = useState<number | null>(null);
  const [selectedAnswer, setSelectedAnswer] = useState<number | null>(null);
  const [showMillikan, setShowMillikan] = useState<boolean>(true);

  const accepted = view.accepted;
  const params = (accepted?.parameters ??
    example?.parameters ?? {
      incidentPower: 0.001,
      frequency: 6.0e14,
      workFunction: 2.2,
      quantumEfficiency: 0.1,
      collectorPotential: 0.0,
    }) as {
    incidentPower: number;
    frequency: number;
    workFunction: number;
    quantumEfficiency: number;
    collectorPotential: number;
  };

  const outputs = accepted?.outputs ?? [];
  const qEnergyRes = outputs.find((o) => o.quantityId === "quantumEnergy");
  const tfRes = outputs.find((o) => o.quantityId === "thresholdFrequency");
  const kMaxRes = outputs.find((o) => o.quantityId === "maxKineticEnergy");
  const vsRes = outputs.find((o) => o.quantityId === "stoppingPotentialMagnitude");
  const eRateRes = outputs.find((o) => o.quantityId === "emissionRate");
  const pcRes = outputs.find((o) => o.quantityId === "photocurrent");

  const qEnergyEv =
    qEnergyRes?.status === "value" ? (qEnergyRes.value as number) / 1.602176634e-19 : 0;
  const kMaxEv = kMaxRes?.status === "value" ? (kMaxRes.value as number) / 1.602176634e-19 : null;
  const vsVal = vsRes?.status === "value" ? (vsRes.value as number) : null;
  const tfVal = tfRes?.status === "value" ? (tfRes.value as number) : 0;
  const eRateVal = eRateRes?.status === "value" ? (eRateRes.value as number) : 0;
  const pcVal = pcRes?.status === "value" ? (pcRes.value as number) : null;

  // Saturation current in microamperes: e * eRate * 1e6
  const iSatMicroAmps = eRateVal * 1.602176634e-19 * 1e6;
  const pcMicroAmps = pcVal !== null ? pcVal * 1e6 : null;

  const millikanData = useMemo(() => evaluateMillikanOverlay(), []);

  return (
    <div
      className="lab-surface flex flex-col gap-6 p-4 max-w-5xl mx-auto"
      data-testid="photoelectric-lab"
    >
      {/* Telemetry and Header */}
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 dark:border-slate-800 pb-3">
        <div>
          <span className="text-xs font-mono uppercase tracking-wider bg-sky-100 dark:bg-sky-950 text-sky-800 dark:text-sky-300 px-2 py-0.5 rounded mr-2">
            LQ-08
          </span>
          <span className="text-xs font-mono text-slate-500">
            Status: {view.status} | Step: {accepted?.stepIndex ?? 0} | Run:{" "}
            {accepted?.runId ?? "init"}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <label className="text-xs flex items-center gap-1 cursor-pointer text-slate-700 dark:text-slate-300">
            <input
              type="checkbox"
              checked={showMillikan}
              onChange={(e) => setShowMillikan(e.target.checked)}
              className="rounded"
            />
            Millikan (1916) Overlay
          </label>
        </div>
      </div>

      {/* Presets Bar */}
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-xs font-semibold text-slate-600 dark:text-slate-400">Presets:</span>
        {PRESETS.map((preset) => (
          <button
            key={preset.name}
            type="button"
            onClick={() => session.apply(preset.patch)}
            className="text-xs px-2.5 py-1 rounded bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 border border-slate-300 dark:border-slate-700 transition"
          >
            {preset.name}
          </button>
        ))}
      </div>

      {/* Control Sliders Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 bg-slate-50 dark:bg-slate-900/60 p-4 rounded-lg border border-slate-200 dark:border-slate-800">
        {/* Optical Power */}
        <div className="flex flex-col gap-1">
          <div className="flex justify-between text-xs">
            <label htmlFor="power-input" className="font-medium text-slate-700 dark:text-slate-300">
              Incident Power P_opt (mW)
            </label>
            <span className="font-mono text-slate-500">
              {(params.incidentPower * 1e3).toFixed(2)} mW
            </span>
          </div>
          <input
            id="power-slider"
            type="range"
            min="0.1"
            max="10.0"
            step="0.1"
            value={params.incidentPower * 1e3}
            onChange={(e) => session.apply({ incidentPower: Number(e.target.value) * 1e-3 })}
            className="w-full"
          />
          <input
            id="power-input"
            type="number"
            min="0.1"
            max="100.0"
            step="0.1"
            value={params.incidentPower * 1e3}
            onChange={(e) => session.apply({ incidentPower: Number(e.target.value) * 1e-3 })}
            className="text-xs px-2 py-0.5 rounded border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 font-mono w-24"
          />
        </div>

        {/* Frequency */}
        <div className="flex flex-col gap-1">
          <div className="flex justify-between text-xs">
            <label htmlFor="freq-input" className="font-medium text-slate-700 dark:text-slate-300">
              Frequency &nu; (THz)
            </label>
            <span className="font-mono text-slate-500">
              {(params.frequency / 1e12).toFixed(1)} THz
            </span>
          </div>
          <input
            id="freq-slider"
            type="range"
            min="300"
            max="1200"
            step="5"
            value={params.frequency / 1e12}
            onChange={(e) => session.apply({ frequency: Number(e.target.value) * 1e12 })}
            className="w-full"
          />
          <input
            id="freq-input"
            type="number"
            min="100"
            max="2000"
            step="1"
            value={params.frequency / 1e12}
            onChange={(e) => session.apply({ frequency: Number(e.target.value) * 1e12 })}
            className="text-xs px-2 py-0.5 rounded border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 font-mono w-24"
          />
        </div>

        {/* Work Function */}
        <div className="flex flex-col gap-1">
          <div className="flex justify-between text-xs">
            <label htmlFor="wf-input" className="font-medium text-slate-700 dark:text-slate-300">
              Work Function &Phi; (eV)
            </label>
            <span className="font-mono text-slate-500">{params.workFunction.toFixed(2)} eV</span>
          </div>
          <input
            id="wf-slider"
            type="range"
            min="0.0"
            max="5.5"
            step="0.05"
            value={params.workFunction}
            onChange={(e) => session.apply({ workFunction: Number(e.target.value) })}
            className="w-full"
          />
          <input
            id="wf-input"
            type="number"
            min="0.0"
            max="10.0"
            step="0.01"
            value={params.workFunction}
            onChange={(e) => session.apply({ workFunction: Number(e.target.value) })}
            className="text-xs px-2 py-0.5 rounded border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 font-mono w-24"
          />
        </div>

        {/* Quantum Efficiency */}
        <div className="flex flex-col gap-1">
          <div className="flex justify-between text-xs">
            <label htmlFor="qe-input" className="font-medium text-slate-700 dark:text-slate-300">
              Quantum Efficiency &eta;
            </label>
            <span className="font-mono text-slate-500">
              {(params.quantumEfficiency * 100).toFixed(1)} %
            </span>
          </div>
          <input
            id="qe-slider"
            type="range"
            min="0.01"
            max="1.0"
            step="0.01"
            value={params.quantumEfficiency}
            onChange={(e) => session.apply({ quantumEfficiency: Number(e.target.value) })}
            className="w-full"
          />
          <input
            id="qe-input"
            type="number"
            min="0.0"
            max="1.0"
            step="0.01"
            value={params.quantumEfficiency}
            onChange={(e) => session.apply({ quantumEfficiency: Number(e.target.value) })}
            className="text-xs px-2 py-0.5 rounded border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 font-mono w-24"
          />
        </div>

        {/* Collector Potential */}
        <div className="flex flex-col gap-1">
          <div className="flex justify-between text-xs">
            <label htmlFor="uc-input" className="font-medium text-slate-700 dark:text-slate-300">
              Collector Potential U_c (V)
            </label>
            <span className="font-mono text-slate-500">
              {params.collectorPotential.toFixed(2)} V
            </span>
          </div>
          <input
            id="uc-slider"
            type="range"
            min="-3.0"
            max="3.0"
            step="0.05"
            value={params.collectorPotential}
            onChange={(e) => session.apply({ collectorPotential: Number(e.target.value) })}
            className="w-full"
          />
          <input
            id="uc-input"
            type="number"
            min="-50.0"
            max="50.0"
            step="0.1"
            value={params.collectorPotential}
            onChange={(e) => session.apply({ collectorPotential: Number(e.target.value) })}
            className="text-xs px-2 py-0.5 rounded border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 font-mono w-24"
          />
        </div>
      </div>

      {/* Visualizations Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <EnergyLadderPlot
          frequency={params.frequency}
          workFunction={params.workFunction}
          quantumEnergyEv={qEnergyEv}
          kMaxEv={kMaxEv}
          thresholdFrequency={tfVal}
        />
        <StoppingPotentialPlot
          currentFrequency={params.frequency}
          currentWorkFunction={params.workFunction}
          currentStoppingPotential={vsVal}
          millikanOverlay={showMillikan}
          millikanData={millikanData}
        />
        <CurrentVoltagePlot
          collectorPotential={params.collectorPotential}
          stoppingPotential={vsVal}
          saturationCurrentMicroAmps={iSatMicroAmps}
          currentAtOperatingPoint={pcMicroAmps}
        />
      </div>

      {/* Accepted Results Table */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg p-4">
        <h3 className="text-sm font-semibold mb-3 text-slate-800 dark:text-slate-100">
          Accepted Laboratory Snapshot (Instance Telemetry)
        </h3>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs font-mono border-collapse">
            <thead>
              <tr className="border-b border-slate-200 dark:border-slate-800 text-slate-500">
                <th className="py-1.5 px-2">Quantity ID</th>
                <th className="py-1.5 px-2">Status</th>
                <th className="py-1.5 px-2">Value / Result</th>
                <th className="py-1.5 px-2">Unit</th>
                <th className="py-1.5 px-2">Owner ID</th>
              </tr>
            </thead>
            <tbody>
              {outputs.map((out) => (
                <tr
                  key={out.quantityId}
                  className="border-b border-slate-100 dark:border-slate-800/50 hover:bg-slate-50 dark:hover:bg-slate-800/30"
                  data-quantity-id={out.quantityId}
                >
                  <td className="py-1.5 px-2 font-medium">{out.quantityId}</td>
                  <td className="py-1.5 px-2">
                    <span
                      className={`px-1.5 py-0.5 rounded text-[10px] ${
                        out.status === "value"
                          ? "bg-emerald-100 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-300"
                          : out.status === "not-applicable"
                            ? "bg-amber-100 dark:bg-amber-950 text-amber-800 dark:text-amber-300"
                            : "bg-purple-100 dark:bg-purple-950 text-purple-800 dark:text-purple-300"
                      }`}
                    >
                      {out.status}
                    </span>
                  </td>
                  <td className="py-1.5 px-2">
                    {out.status === "value"
                      ? typeof out.value === "number"
                        ? out.value.toExponential(4)
                        : String(out.value)
                      : out.status === "not-applicable"
                        ? `N/A (${"reason" in out ? String(out.reason) : ""})`
                        : `Underdetermined (${"compatibleFamily" in out ? String(out.compatibleFamily) : ""})`}
                  </td>
                  <td className="py-1.5 px-2 text-slate-500">{out.unit}</td>
                  <td className="py-1.5 px-2 text-slate-400 text-[10px]">{out.ownerId}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Historical Readout: Einstein 1905 §8 Order-of-Magnitude Check */}
      <div className="bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg p-4">
        <h3 className="text-sm font-semibold mb-2 text-slate-800 dark:text-slate-100">
          Historical Readout: Einstein 1905 §8 Order-of-Magnitude Check
        </h3>
        <div className="space-y-3 text-xs text-slate-700 dark:text-slate-300">
          <div className="p-2.5 rounded bg-amber-50/60 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900/50">
            <span className="font-semibold text-amber-900 dark:text-amber-200">
              What was neglected:{" "}
            </span>
            {LQ08_HISTORICAL_CHECK.neglectStatement}
          </div>
          <div className="p-2.5 rounded bg-blue-50/60 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-900/50">
            <span className="font-semibold text-blue-900 dark:text-blue-200">What it is not: </span>
            {LQ08_HISTORICAL_CHECK.notNamedMetalStatement}
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-1">
            <div className="p-2.5 rounded bg-white dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700">
              <div className="font-semibold text-slate-800 dark:text-slate-200 mb-1">
                Representation A (Printed Form):
              </div>
              <p className="font-mono text-xs">
                &Pi; = (R &middot; &beta; &middot; &nu;) / E ={" "}
                {LQ08_HISTORICAL_CHECK.representationA.stoppingPotentialVolts.toFixed(4)} V (
                {LQ08_HISTORICAL_CHECK.representationA.printedText})
              </p>
              <p className="text-[11px] text-slate-500 mt-1">
                Slope: {LQ08_HISTORICAL_CHECK.representationA.slopeVsPerHz.toExponential(4)}{" "}
                V&middot;s (modern h/e ={" "}
                {LQ08_HISTORICAL_CHECK.representationA.modernSlopeVsPerHz.toExponential(4)}{" "}
                V&middot;s)
              </p>
            </div>
            <div className="p-2.5 rounded bg-white dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700">
              <div className="font-semibold text-slate-800 dark:text-slate-200 mb-1">
                Live Hypothetical Comparison:
              </div>
              <p className="font-mono text-xs">
                &nu; = {(params.frequency / 1e12).toFixed(1)} THz &rarr; h&nu; ={" "}
                {qEnergyEv.toFixed(6)} eV
              </p>
              <p className="text-[11px] text-slate-500 mt-1">
                Hypothetical &Phi; = {params.workFunction.toFixed(1)} eV &rarr; V_s ={" "}
                {(vsVal ?? 0).toFixed(6)} V (hypothetical)
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Discovery Predict Mode */}
      <div className="bg-amber-50/50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-900/50 rounded-lg p-4">
        <h3 className="text-sm font-semibold mb-2 text-amber-900 dark:text-amber-200">
          Discovery Mode: Predict Before Interacting
        </h3>
        <p className="text-xs text-amber-800/80 dark:text-amber-300/80 mb-3">
          Select an inquiry to test your deductive understanding of light-quantum mechanics:
        </p>
        <div className="flex flex-wrap gap-2 mb-3">
          {PREDICT_PROMPTS.map((p, idx) => (
            <button
              key={p.promptId}
              type="button"
              onClick={() => {
                setActivePromptIndex(idx);
                setSelectedAnswer(null);
              }}
              className={`text-xs px-3 py-1.5 rounded transition ${
                activePromptIndex === idx
                  ? "bg-amber-600 text-white font-medium"
                  : "bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-amber-300 dark:border-amber-800"
              }`}
            >
              Inquiry {idx + 1}
            </button>
          ))}
        </div>

        {activePromptIndex !== null && (
          <div className="bg-white dark:bg-slate-900 p-4 rounded border border-amber-200 dark:border-amber-900/60">
            <p className="text-sm font-medium mb-3 text-slate-800 dark:text-slate-100">
              {PREDICT_PROMPTS[activePromptIndex]?.question}
            </p>
            <div className="flex flex-col gap-2 mb-3">
              {PREDICT_PROMPTS[activePromptIndex]?.candidates.map((cand, oIdx) => (
                <button
                  key={cand.id}
                  type="button"
                  onClick={() => setSelectedAnswer(oIdx)}
                  className={`text-left text-xs p-2.5 rounded border transition ${
                    selectedAnswer === oIdx
                      ? cand.correct
                        ? "bg-emerald-50 dark:bg-emerald-950/50 border-emerald-500 text-emerald-900 dark:text-emerald-100"
                        : "bg-rose-50 dark:bg-rose-950/50 border-rose-500 text-rose-900 dark:text-rose-100"
                      : "bg-slate-50 dark:bg-slate-800/50 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-100"
                  }`}
                >
                  <span className="font-mono mr-2">{String.fromCharCode(65 + oIdx)}.</span>
                  <span className="font-medium">{cand.label}</span> &mdash;{" "}
                  <span className="text-slate-500 dark:text-slate-400">{cand.description}</span>
                </button>
              ))}
            </div>
            {selectedAnswer !== null && (
              <div className="text-xs p-3 rounded bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700">
                <span className="font-semibold">Explanation: </span>
                {PREDICT_PROMPTS[activePromptIndex]?.explanation}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Epistemic Limits (Not Modeled) */}
      <div className="bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg p-4">
        <h3 className="text-sm font-semibold mb-2 text-slate-800 dark:text-slate-100">
          Limits of this Reference Model (Not Modeled)
        </h3>
        <p className="text-xs text-slate-600 dark:text-slate-400 mb-2">
          This reference owner implements Einstein’s 1905 single-quantum absorption and escape
          energy relations. The following physical regimes require higher-order quantum optics or
          microscopic surface physics and are explicitly <strong>not modeled</strong>:
        </p>
        <ul className="text-xs text-slate-600 dark:text-slate-400 list-disc list-inside space-y-1">
          {LQ08_NOT_MODELED.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
      </div>
    </div>
  );
}

export function PhotoelectricComparison({ example }: { example?: PreparedLq08Example }) {
  const [second, setSecond] = useState(false);
  const [ready, setReady] = useState(false);
  useEffect(() => setReady(true), []);

  return (
    <>
      <PhotoelectricLab example={example} />
      <div className="comparison-toggle my-6 flex flex-col items-center gap-2">
        <button
          type="button"
          className="text-xs px-3 py-1.5 rounded bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 border border-slate-300 dark:border-slate-700 transition"
          disabled={!ready}
          onClick={() => setSecond(!second)}
        >
          {second ? "Close the second laboratory" : "Open an independent second laboratory"}
        </button>
        <p className="text-xs text-slate-500">
          Compare two setups side by side in your reading. Each laboratory has its own settings,
          stepwise state and accepted results.
        </p>
      </div>
      {second && <PhotoelectricLab example={example} />}
    </>
  );
}
