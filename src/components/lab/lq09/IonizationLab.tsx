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
    <section className="laboratory" data-instrument-id="lq-09">
      {/* Header & Preset Bar */}
      <header
        className="lab-heading"
        style={{
          borderBottom: "1px solid var(--line)",
          paddingBottom: "1rem",
          marginBottom: "1.5rem",
        }}
      >
        <div
          style={{
            display: "flex",
            flexWrap: "wrap",
            alignItems: "center",
            justifyContent: "space-between",
            gap: "1rem",
            width: "100%",
          }}
        >
          <div>
            <p className="eyebrow">Interactive Critical Edition · Instrument LQ-09</p>
            <h2 style={{ margin: "0.25rem 0" }}>Gas ionization bounds and counting model</h2>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
            <button
              type="button"
              onClick={() => setPredictActive(!predictActive)}
              className={`button ${predictActive ? "" : "secondary"}`}
            >
              {predictActive ? "Exit Predict Mode" : "Enter Predict Mode"}
            </button>
            <button
              type="button"
              onClick={() => setShowCode(!showCode)}
              className="button secondary"
            >
              {showCode ? "Hide Kernel Source" : "Show the Code"}
            </button>
          </div>
        </div>

        {/* Presets */}
        <nav
          aria-label="Presets"
          className="preset-list"
          style={{
            width: "100%",
            marginTop: "1rem",
            paddingTop: "0.75rem",
            borderTop: "1px solid var(--line)",
            alignItems: "center",
          }}
        >
          <span className="fine" style={{ fontWeight: 600, marginRight: "0.25rem" }}>
            Presets:
          </span>
          {Object.values(LQ09_PRESETS).map((p) => (
            <button
              key={p.id}
              type="button"
              onClick={() => handlePreset(p.parameters as unknown as Lq09Parameters)}
              className="button secondary"
              title={p.description}
            >
              {p.label}
            </button>
          ))}
        </nav>
      </header>

      {/* Predict Mode Overlay */}
      {predictActive && (
        <section
          className="notice"
          style={{ margin: "1.5rem 0" }}
          aria-label="Predict Mode: Deductive Predictions"
        >
          <p className="eyebrow" style={{ marginBottom: "0.25rem" }}>
            Predict mode
          </p>
          <p className="fine" style={{ margin: "0.25rem 0 1rem" }}>
            Predict each answer before you look at the simulator output.
          </p>

          <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
            {PREDICT_PROMPTS.map((prompt) => (
              <div
                key={prompt.id}
                style={{
                  background: "var(--panel)",
                  border: "1px solid var(--line)",
                  borderRadius: "4px",
                  padding: "1rem",
                }}
              >
                <p style={{ fontWeight: 600, margin: "0 0 0.5rem" }}>{prompt.question}</p>
                <div
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    gap: "0.5rem",
                    marginBottom: "0.75rem",
                  }}
                >
                  {prompt.options.map((opt, idx) => (
                    <label
                      key={opt.text}
                      style={{
                        display: "flex",
                        alignItems: "flex-start",
                        gap: "0.5rem",
                        padding: "0.5rem",
                        borderRadius: "4px",
                        cursor: "pointer",
                        border:
                          userAnswers[prompt.id] === idx
                            ? "1px solid var(--plot)"
                            : "1px solid transparent",
                      }}
                    >
                      <input
                        type="radio"
                        name={prompt.id}
                        checked={userAnswers[prompt.id] === idx}
                        onChange={() => setUserAnswers({ ...userAnswers, [prompt.id]: idx })}
                        disabled={revealed[prompt.id]}
                        style={{ marginTop: "0.2rem" }}
                      />
                      <span className="fine" style={{ color: "var(--ink)" }}>
                        {opt.text}
                      </span>
                    </label>
                  ))}
                </div>

                {!revealed[prompt.id] ? (
                  <button
                    type="button"
                    disabled={userAnswers[prompt.id] === undefined}
                    onClick={() => setRevealed({ ...revealed, [prompt.id]: true })}
                    className="button"
                  >
                    Check Prediction
                  </button>
                ) : (
                  <div
                    className="notice"
                    style={{
                      padding: "0.75rem",
                      marginTop: "0.5rem",
                    }}
                  >
                    <p style={{ fontWeight: "bold", margin: "0 0 0.25rem" }}>
                      {prompt.options[userAnswers[prompt.id] ?? 0]?.correct
                        ? "✓ Correct Deduction"
                        : "✗ Alternative Hypothesis Disproved"}
                    </p>
                    <p className="fine" style={{ margin: 0 }}>
                      {prompt.explanation}
                    </p>
                  </div>
                )}
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Main Grid: Controls & Visualizations */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))",
          gap: "1.5rem",
        }}
      >
        {/* Controls Column */}
        <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
          <div
            style={{
              background: "var(--panel)",
              border: "1px solid var(--line)",
              padding: "1rem",
              borderRadius: "4px",
              display: "flex",
              flexDirection: "column",
              gap: "1rem",
            }}
          >
            <h3 style={{ margin: "0 0 0.5rem", fontSize: "0.95rem" }}>Experimental Controls</h3>

            {/* Light Frequency */}
            <div className="input-field">
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                }}
              >
                <label htmlFor="freq-slider">Light Frequency (&nu;)</label>
                <span className="fine" style={{ fontFamily: "var(--font-mono)" }}>
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
                style={{ width: "100%", marginTop: "0.25rem" }}
              />
            </div>

            {/* Ionization Energy */}
            <div className="input-field">
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                }}
              >
                <label htmlFor="jmol-slider">Ionization Threshold (J_mol)</label>
                <span className="fine" style={{ fontFamily: "var(--font-mono)" }}>
                  {jMolEv} eV
                </span>
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
                style={{ width: "100%", marginTop: "0.25rem" }}
              />
            </div>

            {/* Optical Power */}
            <div className="input-field">
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                }}
              >
                <label htmlFor="popt-slider">Incident Power (P_opt)</label>
                <span className="fine" style={{ fontFamily: "var(--font-mono)" }}>
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
                style={{ width: "100%", marginTop: "0.25rem" }}
              />
            </div>

            {/* Absorption Efficiency */}
            <div className="input-field">
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                }}
              >
                <label htmlFor="eta-slider">Absorption Fraction (&eta;_abs)</label>
                <span className="fine" style={{ fontFamily: "var(--font-mono)" }}>
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
                style={{ width: "100%", marginTop: "0.25rem" }}
              />
            </div>

            {/* Exposure Duration */}
            <div className="input-field">
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                }}
              >
                <label htmlFor="dur-slider">Exposure Duration (t)</label>
                <span className="fine" style={{ fontFamily: "var(--font-mono)" }}>
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
                style={{ width: "100%", marginTop: "0.25rem" }}
              />
            </div>

            {/* Absorption Mode Selection */}
            <div className="input-field">
              <label htmlFor="mode-select" style={{ display: "block", marginBottom: "0.25rem" }}>
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
                style={{ width: "100%", padding: "0.4rem" }}
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
              <div className="input-field">
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                  }}
                >
                  <label htmlFor="dec-slider">Declared Yield (a)</label>
                  <span className="fine" style={{ fontFamily: "var(--font-mono)" }}>
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
                  style={{ width: "100%", marginTop: "0.25rem" }}
                />
              </div>
            )}
          </div>

          {/* Historical Checks Card */}
          <div
            className="notice"
            style={{
              display: "flex",
              flexDirection: "column",
              gap: "0.75rem",
            }}
          >
            <h4 className="eyebrow" style={{ margin: 0 }}>
              Einstein&apos;s 1905 Historical Checks (§9)
            </h4>
            <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
              <div
                style={{
                  background: "var(--panel)",
                  padding: "0.5rem",
                  borderRadius: "4px",
                  border: "1px solid var(--line)",
                }}
              >
                <p style={{ fontWeight: 600, margin: "0 0 0.25rem" }}>
                  Philipp Lenard (1900) Air Ionization
                </p>
                <p className="fine" style={{ margin: "0 0 0.25rem" }}>
                  Observed cutoff: &lambda; &le; 190 nm &rarr; R&beta;&nu; ={" "}
                  <strong style={{ fontFamily: "var(--font-mono)" }}>
                    {histChecks.lenardCheck.printedEnergyText}
                  </strong>{" "}
                  ({histChecks.lenardCheck.printedPotentialText})
                </p>
                <p className="fine" style={{ margin: 0, fontSize: "0.75rem" }}>
                  Modern SI at 190 nm: {histChecks.lenardCheck.modernEnergyEvAt190nm.toFixed(2)} eV
                  (per molecule).
                </p>
              </div>

              <div
                style={{
                  background: "var(--panel)",
                  padding: "0.5rem",
                  borderRadius: "4px",
                  border: "1px solid var(--line)",
                }}
              >
                <p style={{ fontWeight: 600, margin: "0 0 0.25rem" }}>
                  Johannes Stark (1902) Cathode Rays
                </p>
                <p className="fine" style={{ margin: "0 0 0.25rem" }}>
                  Cathode-ray ionization potential:{" "}
                  <strong style={{ fontFamily: "var(--font-mono)" }}>
                    {histChecks.starkCheck.printedPotentialText}
                  </strong>{" "}
                  &rarr; &lambda;_0 &approx;{" "}
                  {histChecks.starkCheck.thresholdWavelengthNm.toFixed(0)} nm
                </p>
                <p className="fine" style={{ margin: 0, fontSize: "0.75rem" }}>
                  J = {histChecks.starkCheck.energyPerGramEquivalentErg.toExponential(1)} erg per
                  gram-equivalent.
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Visualizations Column */}
        <div style={{ display: "flex", flexDirection: "column", gap: "1.5rem" }}>
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
          <div
            style={{
              background: "var(--panel)",
              border: "1px solid var(--line)",
              padding: "1rem",
              borderRadius: "4px",
            }}
          >
            <h4 style={{ margin: "0 0 0.75rem", fontSize: "0.95rem" }}>
              Accepted laboratory telemetry snapshot
            </h4>
            {/*
              No tabIndex: this table was measured and does not overflow - 286/286 at 320x900 and
              529/529 at 1280x900 on /lab/lq-09/, recorded by pane28 under am-6iz4 and registered
              in RECORDED_NON_OVERFLOWING. A tabIndex here is a tab stop with nothing to scroll,
              which is the phantom stop the scrollable-regions ratchet's own header warns against.
            */}
            <section
              className="table-scroll"
              aria-label="Accepted laboratory telemetry snapshot table"
            >
              <table aria-label="Accepted laboratory telemetry snapshot">
                <thead>
                  <tr>
                    <th scope="col">Quantity</th>
                    <th scope="col">Symbol</th>
                    <th scope="col">Status</th>
                    <th scope="col" style={{ textAlign: "right" }}>
                      Value
                    </th>
                  </tr>
                </thead>
                <tbody style={{ fontFamily: "var(--font-mono)" }}>
                  <tr data-quantity-id="frequency">
                    <th
                      scope="row"
                      style={{ fontFamily: "var(--font-sans)", fontWeight: "normal" }}
                    >
                      Light Frequency
                    </th>
                    <td>&nu;</td>
                    <td>
                      <span className="badge">value</span>
                    </td>
                    <td>{(currentParams.frequency / 1e12).toFixed(2)} THz</td>
                  </tr>
                  <tr data-quantity-id="ionizationEnergyPerMolecule">
                    <th
                      scope="row"
                      style={{ fontFamily: "var(--font-sans)", fontWeight: "normal" }}
                    >
                      Ionization Work / Molecule
                    </th>
                    <td>J_mol</td>
                    <td>
                      <span className="badge">value</span>
                    </td>
                    <td>{currentParams.ionizationEnergyEv.toFixed(2)} eV</td>
                  </tr>
                  <tr data-quantity-id="quantumEnergyEv">
                    <th
                      scope="row"
                      style={{ fontFamily: "var(--font-sans)", fontWeight: "normal" }}
                    >
                      Quantum Energy
                    </th>
                    <td>h&nu;</td>
                    <td>
                      <span className="badge">value</span>
                    </td>
                    <td>{quantumEnergyEv.toFixed(4)} eV</td>
                  </tr>
                  <tr data-quantity-id="excessEnergyEv">
                    <th
                      scope="row"
                      style={{ fontFamily: "var(--font-sans)", fontWeight: "normal" }}
                    >
                      Excess Kinetic Energy
                    </th>
                    <td>E_excess</td>
                    <td>
                      <span className="badge">value</span>
                    </td>
                    <td>{excessEnergyEv.toFixed(4)} eV</td>
                  </tr>
                  <tr data-quantity-id="absorbedLightEnergy">
                    <th
                      scope="row"
                      style={{ fontFamily: "var(--font-sans)", fontWeight: "normal" }}
                    >
                      Absorbed Light Energy
                    </th>
                    <td>L</td>
                    <td>
                      <span className="badge">value</span>
                    </td>
                    <td>{absorbedLightEnergy.toExponential(4)} J</td>
                  </tr>
                  <tr data-quantity-id="absorbedQuantumRate">
                    <th
                      scope="row"
                      style={{ fontFamily: "var(--font-sans)", fontWeight: "normal" }}
                    >
                      Absorbed Quantum Rate
                    </th>
                    <td>N&#775;_abs</td>
                    <td>
                      <span className="badge">value</span>
                    </td>
                    <td>{absorbedQRate.toExponential(4)} s&#8315;&sup1;</td>
                  </tr>
                  <tr data-quantity-id="ionizationRate">
                    <th
                      scope="row"
                      style={{ fontFamily: "var(--font-sans)", fontWeight: "normal" }}
                    >
                      Ionization Event Rate
                    </th>
                    <td>N&#775;_ion</td>
                    <td>
                      <span
                        className="badge"
                        style={
                          ionizationStatus === "value" ? undefined : { color: "var(--accent)" }
                        }
                      >
                        {ionizationStatus}
                      </span>
                    </td>
                    <td>
                      {ionizationStatus === "value" && ionizationRate !== null
                        ? `${ionizationRate.toExponential(4)} s⁻¹`
                        : ionizationStatus === "underdetermined"
                          ? `≤ ${absorbedQRate.toExponential(4)} s⁻¹`
                          : "not-applicable"}
                    </td>
                  </tr>
                  <tr data-quantity-id="ionizedGramMolecules">
                    <th
                      scope="row"
                      style={{ fontFamily: "var(--font-sans)", fontWeight: "normal" }}
                    >
                      Ionized Gram-Molecules
                    </th>
                    <td>j</td>
                    <td>
                      <span
                        className="badge"
                        style={
                          (ionizedGramMoleculesOut?.status ?? "value") === "value"
                            ? undefined
                            : { color: "var(--accent)" }
                        }
                      >
                        {ionizedGramMoleculesOut?.status ?? "value"}
                      </span>
                    </td>
                    <td>
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
            </section>
          </div>
        </div>
      </div>

      {/* Show the Code Disclosure */}
      {showCode && (
        <section
          className="notice"
          style={{
            margin: "1.5rem 0",
            fontFamily: "var(--font-mono)",
          }}
        >
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              borderBottom: "1px solid var(--line)",
              paddingBottom: "0.5rem",
              marginBottom: "0.5rem",
            }}
          >
            <span>Pinned Kernel Evaluator: src/physics/reference/photoelectric.ts</span>
            <span className="badge">TypeScript Reference Owner</span>
          </div>
          <pre style={{ margin: 0, overflowX: "auto" }}>
            <code>{`// Paper 1, §9 Single-Quantum Ionization Conservation:
// Threshold frequency: nu_0 = J_mol / h
// If nu < nu_0: ionization count and rate are strictly not-applicable.
// If nu >= nu_0:
//   Under "all-absorbed-ionizes": j = L / (R*beta*nu) or N_ion = L / (h*nu)
//   Under "declared-fraction":   N_ion = a * L / (h*nu)
//   Under "unknown":             underdetermined with upper bound N_abs = L / (h*nu)`}</code>
          </pre>
        </section>
      )}

      {/* Limits of this reference model */}
      <footer
        style={{
          marginTop: "2rem",
          borderTop: "1px solid var(--line)",
          paddingTop: "1.5rem",
        }}
      >
        <h4 className="eyebrow" style={{ marginBottom: "0.75rem" }}>
          Limits of this reference model (not modeled)
        </h4>
        <ul
          className="fine"
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
            gap: "0.5rem",
            paddingLeft: "1.25rem",
            margin: 0,
          }}
        >
          {LQ09_NOT_MODELED.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
      </footer>
    </section>
  );
}

export const IonizationComparison = IonizationLab;
