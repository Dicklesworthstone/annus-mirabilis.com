"use client";

import { useEffect, useMemo, useState, useSyncExternalStore } from "react";
import {
  LQ06_DEFAULTS,
  LQ06_NOT_MODELED,
  LQ06_PRESETS,
  type Lq06ForkAChoice,
  type Lq06Parameters,
  type Lq06SubexpressionChoice,
} from "../../../experiments/lq06/definition.ts";
import { createLq06Session, type PreparedLq06Example } from "../../../experiments/lq06/session.ts";
import { Sci } from "../Sci.tsx";
import { CoefficientMatchSideBySidePlot, MeanEnergyStripPlot } from "./CoefficientMatchPlot.tsx";

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
  const session = useMemo(() => createLq06Session("lq06-interactive-session", example), [example]);

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
  const isMatch = Boolean(
    correspondenceVerdict &&
      correspondenceVerdict.status === "value" &&
      correspondenceVerdict.value === 1,
  );
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
    <section
      className="laboratory"
      data-instrument-id="lq-06"
      data-testid="lq06-coefficient-match-lab"
    >
      <noscript>
        <p className="notice">
          <strong>JavaScript disabled:</strong> Viewing static worked example and reference
          calculation. Interactive exploration, sliders, and predict mode require JavaScript.
        </p>
      </noscript>

      {/* Header & Presets */}
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
            <p className="eyebrow">Interactive critical edition · Instrument LQ-06</p>
            <h2 style={{ margin: "0.25rem 0" }}>
              Matching the entropy laws to derive the light quantum (§6, the move)
            </h2>
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
          {Object.values(LQ06_PRESETS).map((p) => (
            <button
              key={p.id}
              type="button"
              onClick={() => handlePreset(p.parameters as unknown as Lq06Parameters)}
              className="button secondary"
              title={p.description}
            >
              {p.label}
            </button>
          ))}
        </nav>
      </header>

      {/* Predict Mode */}
      {predictActive && (
        <section
          className="notice"
          style={{ margin: "1.5rem 0" }}
          aria-label="Predict Mode: Deduce The Move"
        >
          <p className="eyebrow" style={{ marginBottom: "0.25rem" }}>
            Predict mode: deduce the move
          </p>
          <p className="fine" style={{ margin: "0.25rem 0 1rem" }}>
            Test your deductive reasoning on why the identical functional form implies discrete
            energy quanta before revealing the calculation.
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
                  {prompt.options.map((opt) => (
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
                          userAnswers[prompt.id] === prompt.options.indexOf(opt)
                            ? "1px solid var(--plot)"
                            : "1px solid transparent",
                      }}
                    >
                      <input
                        type="radio"
                        name={prompt.id}
                        checked={userAnswers[prompt.id] === prompt.options.indexOf(opt)}
                        onChange={() =>
                          setUserAnswers({
                            ...userAnswers,
                            [prompt.id]: prompt.options.indexOf(opt),
                          })
                        }
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
                    Check Deduction
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
          gridTemplateColumns: "repeat(auto-fit, minmax(min(320px, 100%), 1fr))",
          gap: "1.5rem",
        }}
      >
        {/* Controls Column */}
        <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
          {/* Subexpression Match Selector */}
          <div
            style={{
              background: "var(--panel)",
              border: "1px solid var(--line)",
              padding: "1rem",
              borderRadius: "4px",
            }}
          >
            <h3 style={{ margin: "0 0 0.5rem", fontSize: "0.95rem" }}>
              Select the Subexpression for &quot;Number of Things (n)&quot;
            </h3>
            <p className="fine" style={{ margin: "0 0 0.75rem" }}>
              Compare S - S₀ = (R/N) ln[(V/V₀)^n_eff] with S - S₀ = (R/N) n ln(V/V₀). Which term
              plays the role of n?
            </p>

            <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
              {[
                {
                  id: "N_E_over_R_beta_nu",
                  label: "N·E / (R·β·ν)  [or E / (h·ν)]",
                  desc: "Exponent of volume ratio (Correct)",
                },
                { id: "E", label: "E", desc: "Total radiation energy (Units: Joules)" },
                { id: "nu", label: "ν", desc: "Frequency (Units: Hz)" },
                {
                  id: "E_over_beta_nu",
                  label: "E / (β·ν)",
                  desc: "Radiation entropy coeff (Units: J/K)",
                },
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
                  className={`button ${
                    currentParams.selectedSubexpression === item.id ? "" : "secondary"
                  }`}
                  style={{
                    textAlign: "left",
                    padding: "0.6rem",
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "flex-start",
                  }}
                >
                  <span style={{ fontFamily: "var(--font-mono)", fontWeight: 600 }}>
                    {item.label}
                  </span>
                  <span className="fine" style={{ fontSize: "0.75rem" }}>
                    {item.desc}
                  </span>
                </button>
              ))}
            </div>
          </div>

          {/* Physical Sliders */}
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
            <h3 style={{ margin: "0 0 0.5rem", fontSize: "0.95rem" }}>State Parameters</h3>

            {/* Radiation Energy */}
            <div className="input-field">
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                }}
              >
                <label htmlFor="energy-slider">Radiation Energy (E)</label>
                <span className="fine" style={{ fontFamily: "var(--font-mono)" }}>
                  {eNanoJ} nJ
                </span>
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
                style={{ width: "100%", marginTop: "0.25rem" }}
              />
            </div>

            {/* Frequency */}
            <div className="input-field">
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                }}
              >
                <label htmlFor="freq-slider">Frequency (ν)</label>
                <span className="fine" style={{ fontFamily: "var(--font-mono)" }}>
                  {freqTHz} THz
                </span>
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
                style={{ width: "100%", marginTop: "0.25rem" }}
              />
            </div>

            {/* Volume Ratio */}
            <div className="input-field">
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                }}
              >
                <label htmlFor="vol-slider">Volume Ratio (V / V₀)</label>
                <span className="fine" style={{ fontFamily: "var(--font-mono)" }}>
                  {volRatio}
                </span>
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
                style={{ width: "100%", marginTop: "0.25rem" }}
              />
            </div>

            {/* Gas Particles */}
            <div className="input-field">
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                }}
              >
                <label htmlFor="gas-slider">Comparison Gas Particles (n)</label>
                <span className="fine" style={{ fontFamily: "var(--font-mono)" }}>
                  {gasN}
                </span>
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
                style={{ width: "100%", marginTop: "0.25rem" }}
              />
            </div>

            {/* Blackbody Temperature */}
            <div className="input-field">
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                }}
              >
                <label htmlFor="temp-slider">Blackbody Temperature (T)</label>
                <span className="fine" style={{ fontFamily: "var(--font-mono)" }}>
                  {tempK} K
                </span>
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
                style={{ width: "100%", marginTop: "0.25rem" }}
              />
            </div>

            {/* Fork A Choice */}
            <div className="input-field">
              <label htmlFor="fork-select" style={{ display: "block", marginBottom: "0.25rem" }}>
                Fork A: Epistemic Interpretation
              </label>
              <select
                id="fork-select"
                value={currentParams.forkAChoice}
                onChange={(e) => {
                  handleApply({ forkAChoice: e.target.value as Lq06ForkAChoice });
                }}
                style={{ width: "100%", padding: "0.4rem" }}
              >
                <option value="none">No philosophical stance chosen</option>
                <option value="independent-quanta">
                  Light Quanta Hypothesis: Radiation behaves as independent energy packets (The
                  Move)
                </option>
                <option value="coincidence">
                  Formal Coincidence: Purely an algebraic curiosity, waves remain continuous
                </option>
              </select>
            </div>
          </div>
        </div>

        {/* Visualizations Column */}
        <div style={{ display: "flex", flexDirection: "column", gap: "1.5rem" }}>
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
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(min(180px, 100%), 1fr))",
              gap: "0.75rem",
            }}
          >
            <div
              style={{
                background: "var(--panel)",
                border: "1px solid var(--line)",
                borderRadius: "4px",
                padding: "0.75rem",
              }}
            >
              <span
                style={{
                  fontWeight: "bold",
                  display: "block",
                  borderBottom: "1px solid var(--line)",
                  paddingBottom: "0.25rem",
                  marginBottom: "0.5rem",
                }}
              >
                1. Derivation (Algebra)
              </span>
              <p className="fine" style={{ margin: 0 }}>
                The functional forms of Wien radiation entropy and Boltzmann gas entropy agree
                identically if and only if n = N·E / (R·β·ν) = E / (h·ν).
              </p>
            </div>

            <div
              style={{
                background: "var(--panel)",
                border: "1px solid var(--line)",
                borderRadius: "4px",
                padding: "0.75rem",
              }}
            >
              <span
                style={{
                  fontWeight: "bold",
                  display: "block",
                  borderBottom: "1px solid var(--line)",
                  paddingBottom: "0.25rem",
                  marginBottom: "0.5rem",
                }}
              >
                2. Heuristic Inference
              </span>
              <p className="fine" style={{ margin: 0 }}>
                Monochromatic radiation of low density in the Wien regime behaves thermodynamically
                <strong> as though</strong> it consists of independent energy quanta of magnitude
                h·ν.
              </p>
            </div>

            <div
              style={{
                background: "var(--panel)",
                border: "1px solid var(--line)",
                borderRadius: "4px",
                padding: "0.75rem",
              }}
            >
              <span
                style={{
                  fontWeight: "bold",
                  display: "block",
                  borderBottom: "1px solid var(--line)",
                  paddingBottom: "0.25rem",
                  marginBottom: "0.5rem",
                }}
              >
                3. Further Hypothesis
              </span>
              <p className="fine" style={{ margin: 0 }}>
                Are the laws of production (Stokes rule §7) and transformation (photoelectric §8,
                ionization §9) also governed by discrete energy exchanges of size h·ν?
              </p>
            </div>
          </div>

          {/* Quantitative Telemetry Table */}
          <div
            style={{
              background: "var(--panel)",
              border: "1px solid var(--line)",
              padding: "1rem",
              borderRadius: "4px",
            }}
          >
            <h4 style={{ margin: "0 0 0.75rem", fontSize: "0.95rem" }}>
              Accepted telemetry snapshot
            </h4>
            <section className="table-scroll" aria-label="Accepted telemetry snapshot table">
              <table aria-label="Accepted telemetry snapshot">
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
                  <tr data-quantity-id="radiationEnergy">
                    <th
                      scope="row"
                      style={{ fontFamily: "var(--font-sans)", fontWeight: "normal" }}
                    >
                      Radiation Energy
                    </th>
                    <td>E</td>
                    <td>
                      <span className="badge">value</span>
                    </td>
                    <td>{(currentParams.radiationEnergy * 1e9).toFixed(4)} nJ</td>
                  </tr>
                  <tr data-quantity-id="frequency">
                    <th
                      scope="row"
                      style={{ fontFamily: "var(--font-sans)", fontWeight: "normal" }}
                    >
                      Frequency
                    </th>
                    <td>ν</td>
                    <td>
                      <span className="badge">value</span>
                    </td>
                    <td>{(currentParams.frequency / 1e12).toFixed(2)} THz</td>
                  </tr>
                  <tr data-quantity-id="volumeRatio">
                    <th
                      scope="row"
                      style={{ fontFamily: "var(--font-sans)", fontWeight: "normal" }}
                    >
                      Volume Ratio
                    </th>
                    <td>V/V₀</td>
                    <td>
                      <span className="badge">value</span>
                    </td>
                    <td>{currentParams.volumeRatio.toFixed(4)}</td>
                  </tr>
                  <tr data-quantity-id="effectiveIndependentCount">
                    <th
                      scope="row"
                      style={{ fontFamily: "var(--font-sans)", fontWeight: "normal" }}
                    >
                      Effective Quanta Count (Never Rounded)
                    </th>
                    <td>n_eff</td>
                    <td>
                      <span className="badge">value</span>
                    </td>
                    <td>
                      <Sci value={effectiveCount} digits={6} />
                    </td>
                  </tr>
                  <tr data-quantity-id="quantumEnergy">
                    <th
                      scope="row"
                      style={{ fontFamily: "var(--font-sans)", fontWeight: "normal" }}
                    >
                      Energy per Quantum (SI)
                    </th>
                    <td>ε = hν</td>
                    <td>
                      <span className="badge">value</span>
                    </td>
                    <td>
                      <Sci value={quantumEnergyJ} digits={6} /> J
                    </td>
                  </tr>
                  <tr data-quantity-id="quantumEnergyEv">
                    <th
                      scope="row"
                      style={{ fontFamily: "var(--font-sans)", fontWeight: "normal" }}
                    >
                      Energy per Quantum (eV)
                    </th>
                    <td>ε_eV</td>
                    <td>
                      <span className="badge">value</span>
                    </td>
                    <td>{quantumEnergyEv.toFixed(6)} eV</td>
                  </tr>
                  <tr data-quantity-id="entropyVolumeCoefficient">
                    <th
                      scope="row"
                      style={{ fontFamily: "var(--font-sans)", fontWeight: "normal" }}
                    >
                      Radiation Entropy Volume Coeff
                    </th>
                    <td>E / (βν)</td>
                    <td>
                      <span className="badge">value</span>
                    </td>
                    <td>
                      <Sci value={radVolumeCoeff} digits={6} /> J/K
                    </td>
                  </tr>
                  <tr data-quantity-id="gasEntropyVolumeCoefficient">
                    <th
                      scope="row"
                      style={{ fontFamily: "var(--font-sans)", fontWeight: "normal" }}
                    >
                      Gas Entropy Volume Coeff
                    </th>
                    <td>(R/N) n</td>
                    <td>
                      <span className="badge">value</span>
                    </td>
                    <td>
                      <Sci value={gasVolumeCoeff} digits={6} /> J/K
                    </td>
                  </tr>
                  <tr data-quantity-id="radiationEntropy">
                    <th
                      scope="row"
                      style={{ fontFamily: "var(--font-sans)", fontWeight: "normal" }}
                    >
                      Radiation Entropy Change
                    </th>
                    <td>ΔS_rad</td>
                    <td>
                      <span className="badge">value</span>
                    </td>
                    <td>
                      <Sci value={radEntropy} digits={6} /> J/K
                    </td>
                  </tr>
                  <tr data-quantity-id="gasEntropy">
                    <th
                      scope="row"
                      style={{ fontFamily: "var(--font-sans)", fontWeight: "normal" }}
                    >
                      Gas Entropy Change
                    </th>
                    <td>ΔS_gas</td>
                    <td>
                      <span className="badge">value</span>
                    </td>
                    <td>
                      <Sci value={gasEntropy} digits={6} /> J/K
                    </td>
                  </tr>
                  <tr data-quantity-id="meanQuantumEnergyWienEv">
                    <th
                      scope="row"
                      style={{ fontFamily: "var(--font-sans)", fontWeight: "normal" }}
                    >
                      Wien Mean Quantum Energy
                    </th>
                    <td>⟨ε⟩ = 3 k_B T</td>
                    <td>
                      <span className="badge">value</span>
                    </td>
                    <td>{meanQuantumEnergyEv.toFixed(6)} eV</td>
                  </tr>
                  <tr data-quantity-id="moleculeMeanKineticEnergyEv">
                    <th
                      scope="row"
                      style={{ fontFamily: "var(--font-sans)", fontWeight: "normal" }}
                    >
                      Gas Molecule Kinetic Energy
                    </th>
                    <td>⟨E_kin⟩ = 1.5 k_B T</td>
                    <td>
                      <span className="badge">value</span>
                    </td>
                    <td>{moleculeKineticEnergyEv.toFixed(6)} eV</td>
                  </tr>
                </tbody>
              </table>
            </section>
          </div>
        </div>
      </div>

      {/* Show the Code */}
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
            <span>Pinned Kernel Evaluator: src/physics/reference/radiation/quanta.ts</span>
            <span className="badge">TypeScript Reference Owner</span>
          </div>
          <pre style={{ margin: 0, overflowX: "auto" }}>
            <code>{`// Paper 1, §6 The Move: Matching Entropy Coefficients
// Radiation entropy: S - S_0 = (E / (beta * nu)) * ln(V / V_0)
// Boltzmann gas entropy: S - S_0 = (R / N) * n * ln(V / V_0)
//
// Equating the exponents in W = (V / V_0)^n:
// n_eff = (N / R) * (E / (beta * nu)) = E / (h * nu)
// Energy per quantum: epsilon = E / n_eff = (R * beta * nu) / N = h * nu
//
// Mean quantum energy over Wien spectrum:
// <epsilon> = 3 * (R / N) * T = 3 * k_B * T  (exactly 2x molecule kinetic energy 1.5 * k_B * T)`}</code>
          </pre>
        </section>
      )}

      {/* Limits of this Reference Model */}
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
            gridTemplateColumns: "repeat(auto-fit, minmax(min(280px, 100%), 1fr))",
            gap: "0.5rem",
            paddingLeft: "1.25rem",
            margin: 0,
          }}
        >
          {LQ06_NOT_MODELED.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
      </footer>
    </section>
  );
}

export const CoefficientMatchComparison = CoefficientMatchLab;
