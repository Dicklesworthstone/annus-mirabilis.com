"use client";

import { useId, useMemo, useState, useSyncExternalStore } from "react";
import { evaluateMillikanOverlay } from "../../../experiments/lq08/millikan.ts";
import { createLq08Session, type PreparedLq08Example } from "../../../experiments/lq08/session.ts";
import {
  CurrentVoltagePlot,
  EnergyLadderPlot,
  StoppingPotentialPlot,
} from "./PhotoelectricPlot.tsx";

export type PhotoelectricLabProps = Readonly<{
  example?: PreparedLq08Example;
}>;

type Preset = Readonly<{
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
    name: "Sodium Standard (Yellow-Green, 600 THz)",
    description: "Monochromatic 600 THz (~500 nm) on fresh sodium (Phi = 2.2 eV).",
    patch: {
      incidentPower: 0.001,
      frequency: 6.0e14,
      workFunction: 2.2,
      quantumEfficiency: 0.1,
      collectorPotential: 0.0,
    },
  },
  {
    name: "Sub-Threshold (Red Light, 450 THz)",
    description: "450 THz red light: photon energy 1.86 eV < 2.2 eV. No electrons emitted.",
    patch: {
      incidentPower: 0.005,
      frequency: 4.5e14,
      workFunction: 2.2,
      quantumEfficiency: 0.1,
      collectorPotential: 0.0,
    },
  },
  {
    name: "Historical Spark Check (UV, 1030 THz, Phi=0)",
    description: "Einstein's 1905 order-of-magnitude check with neglected escape work.",
    patch: {
      incidentPower: 0.001,
      frequency: 1.03e15,
      workFunction: 0.0,
      quantumEfficiency: 0.1,
      collectorPotential: 0.0,
    },
  },
];

type PredictPrompt = Readonly<{
  id: string;
  question: string;
  options: readonly { text: string; correct: boolean }[];
  explanation: string;
}>;

const PREDICT_PROMPTS: readonly PredictPrompt[] = [
  {
    id: "power-invariance",
    question:
      "What happens to maximum electron kinetic energy (K_max) if you double the optical power?",
    options: [
      { text: "K_max doubles because more wave energy impinges on the surface.", correct: false },
      {
        text: "K_max stays exactly unchanged; only the photon flux and electron count double.",
        correct: true,
      },
      { text: "K_max increases by sqrt(2).", correct: false },
    ],
    explanation:
      "In the quantum hypothesis, each electron absorbs exactly one light quantum (h*nu). Radiant power only governs the rate of incoming photons (N_dot = P / h*nu), not the energy carried by individual quanta.",
  },
  {
    id: "sub-threshold",
    question: "What happens to the photocurrent if light frequency is below threshold (nu < nu_0)?",
    options: [
      {
        text: "Photocurrent is zero, regardless of how intense or long the illumination is.",
        correct: true,
      },
      {
        text: "A small current flows if you make the light beam sufficiently bright.",
        correct: false,
      },
      {
        text: "Electrons emerge after a time lag required to accumulate enough energy.",
        correct: false,
      },
    ],
    explanation:
      "Classical wave theory predicts energy accumulates over time until an electron escapes. The quantum law requires h*nu >= Phi in a single collision event; if h*nu < Phi, no electron can escape.",
  },
  {
    id: "slope-universality",
    question:
      "How does the slope of stopping potential versus frequency (dVs/dnu) compare across different metals?",
    options: [
      {
        text: "Different metals have different slopes depending on their electrical conductivity.",
        correct: false,
      },
      { text: "Every metal has the exact same universal slope: h/e.", correct: true },
      { text: "The slope is proportional to the work function of the metal.", correct: false },
    ],
    explanation:
      "Because e*Vs = h*nu - Phi, differentiating with respect to frequency gives dVs/dnu = h/e, a fundamental constant of nature independent of the cathode material.",
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
              key={p.id}
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
              {PREDICT_PROMPTS[activePromptIndex]?.options.map((opt, oIdx) => (
                <button
                  key={opt.text}
                  type="button"
                  onClick={() => setSelectedAnswer(oIdx)}
                  className={`text-left text-xs p-2.5 rounded border transition ${
                    selectedAnswer === oIdx
                      ? opt.correct
                        ? "bg-emerald-50 dark:bg-emerald-950/50 border-emerald-500 text-emerald-900 dark:text-emerald-100"
                        : "bg-rose-50 dark:bg-rose-950/50 border-rose-500 text-rose-900 dark:text-rose-100"
                      : "bg-slate-50 dark:bg-slate-800/50 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-100"
                  }`}
                >
                  <span className="font-mono mr-2">{String.fromCharCode(65 + oIdx)}.</span>
                  {opt.text}
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
          <li>Multi-photon absorption processes at ultra-high laser intensities.</li>
          <li>Detailed angular distribution of emitted photoelectrons.</li>
          <li>Surface oxidation layer work-function drift.</li>
          <li>Finite-temperature Fermi-Dirac tail thermal emission broadening.</li>
        </ul>
      </div>
    </div>
  );
}
