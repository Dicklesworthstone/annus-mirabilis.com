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
    <section className="laboratory" data-testid="photoelectric-lab">
      {/* Telemetry and Header */}
      <header
        className="lab-heading"
        style={{
          borderBottom: "1px solid var(--line)",
          paddingBottom: "1rem",
          marginBottom: "1rem",
        }}
      >
        <div
          style={{
            display: "flex",
            flexWrap: "wrap",
            alignItems: "center",
            justifyContent: "space-between",
            gap: "0.5rem",
            width: "100%",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", flexWrap: "wrap" }}>
            <span className="badge">LQ-08</span>
            <span className="fine" style={{ fontFamily: "var(--font-mono)" }}>
              Status: {view.status} | Step: {accepted?.stepIndex ?? 0} | Run:{" "}
              {accepted?.runId ?? "init"}
            </span>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
            <label
              className="fine"
              style={{
                display: "flex",
                alignItems: "center",
                gap: "0.25rem",
                cursor: "pointer",
              }}
            >
              <input
                type="checkbox"
                checked={showMillikan}
                onChange={(e) => setShowMillikan(e.target.checked)}
              />
              Millikan (1916) Overlay
            </label>
          </div>
        </div>
      </header>

      {/* Presets Bar */}
      <nav
        aria-label="Presets"
        className="preset-list"
        style={{ alignItems: "center", marginBottom: "1rem" }}
      >
        <span className="fine" style={{ fontWeight: 600, marginRight: "0.25rem" }}>
          Presets:
        </span>
        {PRESETS.map((preset) => (
          <button
            key={preset.name}
            type="button"
            onClick={() => session.apply(preset.patch)}
            className="button secondary"
          >
            {preset.name}
          </button>
        ))}
      </nav>

      {/* Control Sliders Grid */}
      <div
        className="input-grid"
        style={{
          gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))",
          background: "var(--panel)",
          padding: "1rem",
          borderRadius: "4px",
          border: "1px solid var(--line)",
        }}
      >
        {/* Optical Power */}
        <div className="input-field">
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <label htmlFor="power-input">Incident Power P_opt (mW)</label>
            <span className="fine" style={{ fontFamily: "var(--font-mono)" }}>
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
            style={{ width: "100%", marginTop: "0.25rem" }}
          />
          <input
            id="power-input"
            type="number"
            min="0.1"
            max="100.0"
            step="0.1"
            value={params.incidentPower * 1e3}
            onChange={(e) => session.apply({ incidentPower: Number(e.target.value) * 1e-3 })}
            style={{ width: "6rem", marginTop: "0.25rem" }}
          />
        </div>

        {/* Frequency */}
        <div className="input-field">
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <label htmlFor="freq-input">Frequency &nu; (THz)</label>
            <span className="fine" style={{ fontFamily: "var(--font-mono)" }}>
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
            style={{ width: "100%", marginTop: "0.25rem" }}
          />
          <input
            id="freq-input"
            type="number"
            min="100"
            max="2000"
            step="1"
            value={params.frequency / 1e12}
            onChange={(e) => session.apply({ frequency: Number(e.target.value) * 1e12 })}
            style={{ width: "6rem", marginTop: "0.25rem" }}
          />
        </div>

        {/* Work Function */}
        <div className="input-field">
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <label htmlFor="wf-input">Work Function &Phi; (eV)</label>
            <span className="fine" style={{ fontFamily: "var(--font-mono)" }}>
              {params.workFunction.toFixed(2)} eV
            </span>
          </div>
          <input
            id="wf-slider"
            type="range"
            min="0.0"
            max="5.5"
            step="0.05"
            value={params.workFunction}
            onChange={(e) => session.apply({ workFunction: Number(e.target.value) })}
            style={{ width: "100%", marginTop: "0.25rem" }}
          />
          <input
            id="wf-input"
            type="number"
            min="0.0"
            max="10.0"
            step="0.01"
            value={params.workFunction}
            onChange={(e) => session.apply({ workFunction: Number(e.target.value) })}
            style={{ width: "6rem", marginTop: "0.25rem" }}
          />
        </div>

        {/* Quantum Efficiency */}
        <div className="input-field">
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <label htmlFor="qe-input">Quantum Efficiency &eta;</label>
            <span className="fine" style={{ fontFamily: "var(--font-mono)" }}>
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
            style={{ width: "100%", marginTop: "0.25rem" }}
          />
          <input
            id="qe-input"
            type="number"
            min="0.0"
            max="1.0"
            step="0.01"
            value={params.quantumEfficiency}
            onChange={(e) => session.apply({ quantumEfficiency: Number(e.target.value) })}
            style={{ width: "6rem", marginTop: "0.25rem" }}
          />
        </div>

        {/* Collector Potential */}
        <div className="input-field">
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <label htmlFor="uc-input">Collector Potential U_c (V)</label>
            <span className="fine" style={{ fontFamily: "var(--font-mono)" }}>
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
            style={{ width: "100%", marginTop: "0.25rem" }}
          />
          <input
            id="uc-input"
            type="number"
            min="-50.0"
            max="50.0"
            step="0.1"
            value={params.collectorPotential}
            onChange={(e) => session.apply({ collectorPotential: Number(e.target.value) })}
            style={{ width: "6rem", marginTop: "0.25rem" }}
          />
        </div>
      </div>

      {/* Visualizations Grid */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
          gap: "1.5rem",
          marginTop: "1.5rem",
        }}
      >
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
      <div
        style={{
          background: "var(--panel)",
          border: "1px solid var(--line)",
          borderRadius: "4px",
          padding: "1rem",
          marginTop: "1.5rem",
        }}
      >
        <h3 style={{ margin: "0 0 0.75rem", fontSize: "0.95rem" }}>
          Accepted laboratory snapshot (instance telemetry)
        </h3>
        <section className="table-scroll" aria-label="Accepted laboratory snapshot telemetry table">
          <table
            style={{
              width: "100%",
              textAlign: "left",
              fontFamily: "var(--font-mono)",
              fontSize: "0.75rem",
              borderCollapse: "collapse",
            }}
          >
            <thead>
              <tr style={{ borderBottom: "1px solid var(--line)", color: "var(--muted)" }}>
                <th style={{ padding: "0.4rem var(--table-cell-x)" }}>Quantity ID</th>
                <th style={{ padding: "0.4rem var(--table-cell-x)" }}>Status</th>
                <th style={{ padding: "0.4rem var(--table-cell-x)" }}>Value / Result</th>
                <th style={{ padding: "0.4rem var(--table-cell-x)" }}>Unit</th>
                <th style={{ padding: "0.4rem var(--table-cell-x)" }}>Owner ID</th>
              </tr>
            </thead>
            <tbody>
              {outputs.map((out) => (
                <tr
                  key={out.quantityId}
                  style={{ borderBottom: "1px solid var(--line)" }}
                  data-quantity-id={out.quantityId}
                >
                  <td style={{ padding: "0.4rem var(--table-cell-x)", fontWeight: 500 }}>
                    {out.quantityId}
                  </td>
                  <td style={{ padding: "0.4rem var(--table-cell-x)" }}>
                    <span
                      className="badge"
                      style={out.status === "value" ? undefined : { color: "var(--accent)" }}
                    >
                      {out.status}
                    </span>
                  </td>
                  <td style={{ padding: "0.4rem var(--table-cell-x)" }}>
                    {out.status === "value"
                      ? typeof out.value === "number"
                        ? out.value.toExponential(4)
                        : String(out.value)
                      : out.status === "not-applicable"
                        ? `N/A (${"reason" in out ? String(out.reason) : ""})`
                        : `Underdetermined (${"compatibleFamily" in out ? String(out.compatibleFamily) : ""})`}
                  </td>
                  <td style={{ padding: "0.4rem var(--table-cell-x)", color: "var(--muted)" }}>
                    {out.unit}
                  </td>
                  <td
                    style={{
                      padding: "0.4rem var(--table-cell-x)",
                      color: "var(--muted)",
                      fontSize: "0.7rem",
                    }}
                  >
                    {out.ownerId}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      </div>

      {/* Historical readout: Einstein 1905 §8 order-of-magnitude check */}
      <div className="notice" style={{ marginTop: "1.5rem" }}>
        <h3 style={{ margin: "0 0 0.5rem", fontSize: "0.95rem" }}>
          Historical readout: Einstein 1905 §8 order-of-magnitude check
        </h3>
        <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
          <div
            style={{
              background: "var(--panel)",
              padding: "0.625rem",
              borderRadius: "4px",
              border: "1px solid var(--line)",
            }}
          >
            <span style={{ fontWeight: 600 }}>What was neglected: </span>
            <span className="fine">{LQ08_HISTORICAL_CHECK.neglectStatement}</span>
          </div>
          <div
            style={{
              background: "var(--panel)",
              padding: "0.625rem",
              borderRadius: "4px",
              border: "1px solid var(--line)",
            }}
          >
            <span style={{ fontWeight: 600 }}>What it is not: </span>
            <span className="fine">{LQ08_HISTORICAL_CHECK.notNamedMetalStatement}</span>
          </div>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))",
              gap: "0.75rem",
            }}
          >
            <div
              style={{
                background: "var(--panel)",
                padding: "0.625rem",
                borderRadius: "4px",
                border: "1px solid var(--line)",
              }}
            >
              <div style={{ fontWeight: 600, marginBottom: "0.25rem", fontSize: "0.85rem" }}>
                Representation A (Printed Form):
              </div>
              <p className="fine" style={{ fontFamily: "var(--font-mono)", margin: 0 }}>
                &Pi; = (R &middot; &beta; &middot; &nu;) / E ={" "}
                {LQ08_HISTORICAL_CHECK.representationA.stoppingPotentialVolts.toFixed(4)} V (
                {LQ08_HISTORICAL_CHECK.representationA.printedText})
              </p>
              <p className="fine" style={{ color: "var(--muted)", margin: "0.25rem 0 0" }}>
                Slope: {LQ08_HISTORICAL_CHECK.representationA.slopeVsPerHz.toExponential(4)}{" "}
                V&middot;s (modern h/e ={" "}
                {LQ08_HISTORICAL_CHECK.representationA.modernSlopeVsPerHz.toExponential(4)}{" "}
                V&middot;s)
              </p>
            </div>
            <div
              style={{
                background: "var(--panel)",
                padding: "0.625rem",
                borderRadius: "4px",
                border: "1px solid var(--line)",
              }}
            >
              <div style={{ fontWeight: 600, marginBottom: "0.25rem", fontSize: "0.85rem" }}>
                Live Hypothetical Comparison:
              </div>
              <p className="fine" style={{ fontFamily: "var(--font-mono)", margin: 0 }}>
                &nu; = {(params.frequency / 1e12).toFixed(1)} THz &rarr; h&nu; ={" "}
                {qEnergyEv.toFixed(6)} eV
              </p>
              <p className="fine" style={{ color: "var(--muted)", margin: "0.25rem 0 0" }}>
                Hypothetical &Phi; = {params.workFunction.toFixed(1)} eV &rarr; V_s ={" "}
                {(vsVal ?? 0).toFixed(6)} V (hypothetical)
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Discovery Predict Mode */}
      <section
        className="notice"
        style={{ marginTop: "1.5rem" }}
        aria-label="Discovery mode: predict before interacting"
      >
        <h3 style={{ margin: "0 0 0.5rem", fontSize: "0.95rem" }}>
          Discovery mode: predict before interacting
        </h3>
        <p className="fine" style={{ margin: "0 0 0.75rem" }}>
          Choose a question and predict the answer before you change a control:
        </p>
        <div className="preset-list" style={{ marginBottom: "0.75rem" }}>
          {PREDICT_PROMPTS.map((p, idx) => (
            <button
              key={p.promptId}
              type="button"
              onClick={() => {
                setActivePromptIndex(idx);
                setSelectedAnswer(null);
              }}
              className={`button ${activePromptIndex === idx ? "" : "secondary"}`}
              style={{ padding: "0.25rem 0.625rem", fontSize: "0.75rem" }}
            >
              Question {idx + 1}
            </button>
          ))}
        </div>

        {activePromptIndex !== null && (
          <div
            style={{
              background: "var(--panel)",
              padding: "1rem",
              borderRadius: "4px",
              border: "1px solid var(--line)",
            }}
          >
            <p style={{ fontWeight: 600, margin: "0 0 0.75rem", fontSize: "0.875rem" }}>
              {PREDICT_PROMPTS[activePromptIndex]?.question}
            </p>
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                gap: "0.5rem",
                marginBottom: "0.75rem",
              }}
            >
              {PREDICT_PROMPTS[activePromptIndex]?.candidates.map((cand, oIdx) => (
                <button
                  key={cand.id}
                  type="button"
                  onClick={() => setSelectedAnswer(oIdx)}
                  className="button secondary"
                  style={{
                    textAlign: "left",
                    padding: "0.5rem 0.75rem",
                    border:
                      selectedAnswer === oIdx ? "1px solid var(--plot)" : "1px solid var(--line)",
                    background: selectedAnswer === oIdx ? "var(--wash)" : undefined,
                  }}
                >
                  <span
                    className="fine"
                    style={{ fontFamily: "var(--font-mono)", marginRight: "0.5rem" }}
                  >
                    {String.fromCharCode(65 + oIdx)}.
                  </span>
                  <span style={{ fontWeight: 600, fontSize: "0.8rem" }}>{cand.label}</span> &mdash;{" "}
                  <span className="fine">{cand.description}</span>
                </button>
              ))}
            </div>
            {selectedAnswer !== null && (
              <div
                className="notice"
                style={{
                  padding: "0.75rem",
                  background: "var(--panel)",
                  border: "1px solid var(--line)",
                }}
              >
                <span style={{ fontWeight: 600 }}>Explanation: </span>
                <span className="fine">{PREDICT_PROMPTS[activePromptIndex]?.explanation}</span>
              </div>
            )}
          </div>
        )}
      </section>

      {/* Epistemic Limits (Not Modeled) */}
      <div
        style={{
          background: "var(--panel)",
          border: "1px solid var(--line)",
          borderRadius: "4px",
          padding: "1rem",
          marginTop: "1.5rem",
        }}
      >
        <h3 style={{ margin: "0 0 0.5rem", fontSize: "0.95rem" }}>
          Limits of this reference model (not modeled)
        </h3>
        <p className="fine" style={{ margin: "0 0 0.5rem" }}>
          This reference owner implements Einstein’s 1905 single-quantum absorption and escape
          energy relations. The following physical regimes require higher-order quantum optics or
          microscopic surface physics and are explicitly <strong>not modeled</strong>:
        </p>
        <ul
          className="fine"
          style={{
            paddingLeft: "1.25rem",
            margin: 0,
            display: "flex",
            flexDirection: "column",
            gap: "0.25rem",
          }}
        >
          {LQ08_NOT_MODELED.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
      </div>
    </section>
  );
}

export function PhotoelectricComparison({ example }: { example?: PreparedLq08Example }) {
  const [second, setSecond] = useState(false);
  const [ready, setReady] = useState(false);
  useEffect(() => setReady(true), []);

  return (
    <>
      <PhotoelectricLab example={example} />
      <div
        className="comparison-toggle"
        style={{
          margin: "1.5rem 0",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: "0.5rem",
        }}
      >
        <button
          type="button"
          className="button secondary"
          disabled={!ready}
          onClick={() => setSecond(!second)}
        >
          {second ? "Close the second laboratory" : "Open an independent second laboratory"}
        </button>
        <p className="fine" style={{ margin: 0 }}>
          Compare two setups side by side in your reading. Each laboratory has its own settings,
          stepwise state and accepted results.
        </p>
      </div>
      {second && <PhotoelectricLab example={example} />}
    </>
  );
}
