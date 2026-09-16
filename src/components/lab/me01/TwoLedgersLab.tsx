"use client";

import { type FormEvent, useEffect, useId, useState, useSyncExternalStore } from "react";
import { fromMe01Draft, toMe01Draft } from "../../../experiments/me01/controls.ts";
import {
  ME01_CAPTION,
  ME01_DEFAULTS,
  ME01_MODEL,
  ME01_NOT_MODELED,
  ME01_PRESETS,
  ME01_PROMPTS,
  type Me01Notation,
  type Me01OffsetDisplay,
  type Me01Parameters,
  type Me01Premise,
  type Me01Step,
} from "../../../experiments/me01/definition.ts";
import { decodeMe01Settings, encodeMe01Settings } from "../../../experiments/me01/permalink.ts";
import {
  createMe01Session,
  evaluateMe01,
  type PreparedMe01Example,
} from "../../../experiments/me01/session.ts";
import { TwoLedgersPlot } from "./TwoLedgersPlot.tsx";

const STEPS: readonly { id: Me01Step; label: string; number: number }[] = [
  { id: "intro", label: "1. The setup", number: 1 },
  { id: "moving-pulses", label: "2. Moving pulses", number: 2 },
  { id: "sum-angle", label: "3. Angle-free sum", number: 3 },
  { id: "two-balances", label: "4. Two balances", number: 4 },
  { id: "subtraction-move", label: "5. The subtraction", number: 5 },
  { id: "premise-kinetic", label: "6. Kinetic drop", number: 6 },
];

export function TwoLedgersLab({
  example,
  title = "ME-01: Two ledgers and opposite pulses",
}: {
  example?: PreparedMe01Example | undefined;
  title?: string | undefined;
}) {
  const id = useId();
  const [session] = useState(() =>
    createMe01Session(`me01-${id}`, example?.parameters ?? ME01_DEFAULTS),
  );

  const view = useSyncExternalStore(
    session.subscribe,
    session.getSnapshot,
    session.getServerSnapshot,
  );

  const fallbackParams = example?.parameters ?? ME01_DEFAULTS;
  const accepted = view.accepted;
  const p = (accepted?.parameters ?? fallbackParams) as Me01Parameters;
  const [draft, setDraft] = useState(() => toMe01Draft(p));
  const [error, setError] = useState("");
  const [refusalCode, setRefusalCode] = useState<string | null>(null);
  const [linkNote, setLinkNote] = useState("");
  const [sharedUrl, setSharedUrl] = useState("");
  const [predictAnswer, setPredictAnswer] = useState<string | null>(null);
  const [predictRevealed, setPredictRevealed] = useState(false);

  const evaluation = evaluateMe01(p);

  useEffect(() => {
    const shared = decodeMe01Settings(window.location.search);
    if (shared.kind === "settings") {
      setDraft(toMe01Draft(shared.parameters));
      setDirty(true);
      setLinkNote(
        "Shared settings are loaded. Choose Apply settings to calculate them; the worked example is still displayed.",
      );
    } else if (shared.kind === "invalid") {
      setLinkNote(shared.message);
    }
  }, []);

  function apply(parameters: Me01Parameters) {
    const outcome = session.apply(parameters);
    if (outcome.kind === "refused") {
      const details = outcome.refusal.details;
      const req =
        typeof details?.requirements === "string" ? details.requirements : outcome.refusal.message;
      const code = typeof details?.code === "string" ? details.code : null;
      setError(req);
      setRefusalCode(code);
      return;
    }
    setError("");
    setRefusalCode(null);
    setDirty(false);
    setLinkNote("");
  }

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const parsed = fromMe01Draft(draft);
    if (Math.abs(parsed.frameSpeed) >= 1) {
      setError("No inertial observer moves at or above the speed of light (|v/c| < 1).");
      setRefusalCode("superluminal-observer");
      return;
    }
    if (
      !Number.isFinite(parsed.frameSpeed) ||
      !Number.isFinite(parsed.emittedEnergyRestFrame) ||
      !Number.isFinite(parsed.emissionAngle)
    ) {
      setError("Inputs must be finite real numbers.");
      setRefusalCode("nonfinite-input");
      return;
    }
    if (parsed.emittedEnergyRestFrame <= 0) {
      setError("Emitted energy L must be a positive finite number.");
      setRefusalCode(null);
      return;
    }
    apply(parsed);
  }

  function loadPreset(presetId: string) {
    const found = ME01_PRESETS.find((pr) => pr.presetId === presetId);
    if (!found) return;
    const nextParams: Me01Parameters = {
      ...p,
      ...found.parameterValues,
    };
    setDraft(toMe01Draft(nextParams));
    apply(nextParams);
  }

  function toggleNotation(notation: Me01Notation) {
    const next = { ...p, notation };
    setDraft(toMe01Draft(next));
    apply(next);
  }

  function togglePremise(premise: Me01Premise) {
    const next = { ...p, premise };
    setDraft(toMe01Draft(next));
    apply(next);
  }

  function toggleOffsetDisplay(offsetDisplay: Me01OffsetDisplay) {
    const next = { ...p, offsetDisplay };
    setDraft(toMe01Draft(next));
    apply(next);
  }

  function setStep(step: Me01Step) {
    const next = { ...p, step };
    setDraft(toMe01Draft(next));
    apply(next);
  }

  function share() {
    const query = encodeMe01Settings(p);
    const url = `${window.location.origin}${window.location.pathname}${query}`;
    setSharedUrl(url);
    if (navigator.clipboard) {
      navigator.clipboard.writeText(url).catch(() => {});
    }
  }

  const prompt = ME01_PROMPTS.tiltAxis;

  return (
    <section
      className="laboratory-shell"
      aria-label={title}
      data-instrument-id="me-01"
      data-instance-id={session.getSnapshot().accepted?.instanceId ?? "me-01"}
      data-run-id={session.getSnapshot().accepted?.runId ?? "me01-init"}
      data-snapshot-version={session.getSnapshot().accepted?.snapshotVersion ?? 0}
      data-input-revision={session.getSnapshot().requested?.revisions.input ?? 0}
      data-accepted-input-revision={session.getSnapshot().accepted?.revisions.input ?? 0}
      data-pending={session.getSnapshot().pending ? "true" : "false"}
      data-execution-label="host"
      data-refusal-code={refusalCode ?? undefined}
    >
      <div className="lab-header">
        <div>
          <p className="eyebrow">{ME01_MODEL.label}</p>
          <h2>{title}</h2>
          <p className="caption-r0">{ME01_CAPTION.r0}</p>
        </div>

        <div className="notation-toggle-wrap">
          <span className="toggle-label">Notation:</span>
          <button
            type="button"
            className={`button-toggle ${p.notation === "printed" ? "active" : ""}`}
            onClick={() => toggleNotation("printed")}
            aria-pressed={p.notation === "printed"}
          >
            1905 Printed Radical
          </button>
          <button
            type="button"
            className={`button-toggle ${p.notation === "modern" ? "active" : ""}`}
            onClick={() => toggleNotation("modern")}
            aria-pressed={p.notation === "modern"}
          >
            Modern γ Notation
          </button>
        </div>
      </div>

      {/* Preset Quick Links */}
      <div className="presets-bar">
        <span className="presets-label">Presets:</span>
        {ME01_PRESETS.map((pr) => (
          <button
            key={pr.presetId}
            type="button"
            className="button-preset"
            onClick={() => loadPreset(pr.presetId)}
          >
            {pr.label}
          </button>
        ))}
      </div>

      {/* Step Navigation */}
      <nav className="step-nav" aria-label="Derivation steps">
        {STEPS.map((s) => (
          <button
            key={s.id}
            type="button"
            className={`button-step ${p.step === s.id ? "active" : ""}`}
            onClick={() => setStep(s.id)}
            aria-current={p.step === s.id ? "step" : undefined}
          >
            {s.label}
          </button>
        ))}
      </nav>

      {/* Main Visual Comparison */}
      <TwoLedgersPlot parameters={p} evaluation={evaluation} clipId={`plot-clip-${id}`} />

      {/* Form Controls */}
      <form className="lab-controls" onSubmit={submit}>
        <fieldset className="control-group">
          <legend>Observer & Geometry</legend>

          {/* Observer Speed */}
          <div className="control-row">
            <label htmlFor={`speed-${id}`}>
              Observer speed <var>v/c</var> (signed fraction of <var>c</var>):
            </label>
            <div className="input-with-slider">
              <input
                id={`speed-${id}`}
                type="range"
                min="-0.95"
                max="0.95"
                step="0.01"
                value={draft.frameSpeed}
                onChange={(e) => {
                  setDraft({ ...draft, frameSpeed: e.target.value });
                }}
              />
              <input
                type="number"
                step="0.01"
                className="input-number"
                aria-label="Observer speed v/c"
                value={draft.frameSpeed}
                onChange={(e) => {
                  setDraft({ ...draft, frameSpeed: e.target.value });
                }}
              />
            </div>
          </div>

          {/* Emission Angle */}
          <div className="control-row">
            <label htmlFor={`angle-${id}`}>
              Emission angle <var>φ</var> (degrees relative to velocity):
            </label>
            <div className="input-with-slider">
              <input
                id={`angle-${id}`}
                type="range"
                min="0"
                max="180"
                step="1"
                value={draft.emissionAngle}
                onChange={(e) => {
                  setDraft({ ...draft, emissionAngle: e.target.value });
                }}
              />
              <input
                type="number"
                step="1"
                min="0"
                max="180"
                className="input-number"
                aria-label="Emission angle in degrees"
                value={draft.emissionAngle}
                onChange={(e) => {
                  setDraft({ ...draft, emissionAngle: e.target.value });
                }}
              />
            </div>
          </div>

          {/* Emitted Energy */}
          <div className="control-row">
            <label htmlFor={`energy-${id}`}>
              Emitted energy <var>L</var> (rest frame):
            </label>
            <div className="input-with-slider">
              <input
                id={`energy-${id}`}
                type="range"
                min="0.1"
                max="5.0"
                step="0.1"
                value={draft.emittedEnergyRestFrame}
                onChange={(e) => {
                  setDraft({ ...draft, emittedEnergyRestFrame: e.target.value });
                }}
              />
              <input
                type="number"
                step="0.1"
                min="0.01"
                className="input-number"
                aria-label="Emitted energy L in rest frame"
                value={draft.emittedEnergyRestFrame}
                onChange={(e) => {
                  setDraft({ ...draft, emittedEnergyRestFrame: e.target.value });
                }}
              />
            </div>
          </div>
        </fieldset>

        <fieldset className="control-group">
          <legend>Premise Probe & Account Presentation</legend>

          {/* Source Premise Probe */}
          <div className="control-row">
            <span className="field-label">
              Source premise (additive constant <var>C</var>):
            </span>
            <div className="toggle-group">
              <button
                type="button"
                className={`button-toggle ${p.premise === "unchanged" ? "active" : ""}`}
                onClick={() => togglePremise("unchanged")}
                aria-pressed={p.premise === "unchanged"}
              >
                C Unchanged (Source Premise)
              </button>
              <button
                type="button"
                className={`button-toggle ${p.premise === "relaxed" ? "active" : ""}`}
                onClick={() => togglePremise("relaxed")}
                aria-pressed={p.premise === "relaxed"}
              >
                C Relaxed (Underdetermined)
              </button>
            </div>
          </div>

          {/* Offset Display Mode */}
          <div className="control-row">
            <span className="field-label">Internal energy display:</span>
            <div className="toggle-group">
              <button
                type="button"
                className={`button-toggle ${p.offsetDisplay === "symbolic" ? "active" : ""}`}
                onClick={() => toggleOffsetDisplay("symbolic")}
                aria-pressed={p.offsetDisplay === "symbolic"}
              >
                Symbolic (E₀, H₀)
              </button>
              <button
                type="button"
                className={`button-toggle ${p.offsetDisplay === "offsets" ? "active" : ""}`}
                onClick={() => toggleOffsetDisplay("offsets")}
                aria-pressed={p.offsetDisplay === "offsets"}
              >
                Explicit Offsets (Cancel)
              </button>
            </div>
          </div>
        </fieldset>

        <div className="form-actions">
          <button type="submit" className="button button-primary">
            Apply changes
          </button>
          <button type="button" className="button" onClick={share}>
            Share configuration link
          </button>
        </div>

        {error && (
          <div className="error-banner" role="alert" data-refusal-code={refusalCode ?? undefined}>
            {error}
          </div>
        )}

        {linkNote && <div className="info-banner">{linkNote}</div>}
        {sharedUrl && (
          <div className="share-banner">
            Link copied to clipboard: <code>{sharedUrl}</code>
          </div>
        )}
      </form>

      {/* Predict Mode Section */}
      <section className="predict-section" aria-label="Prediction mode">
        <h3>Predict before changing the angle:</h3>
        <p className="predict-question">{prompt.question}</p>
        <div className="predict-options" role="radiogroup">
          {prompt.candidates.map((c) => (
            <label key={c.id} className="predict-candidate">
              <input
                type="radio"
                name="predict-angle"
                value={c.id}
                checked={predictAnswer === c.id}
                onChange={() => setPredictAnswer(c.id)}
              />
              <span>{c.label}</span>
            </label>
          ))}
        </div>
        <div className="predict-actions">
          <button
            type="button"
            className="button"
            disabled={!predictAnswer}
            onClick={() => setPredictRevealed(true)}
          >
            Commit prediction and reveal
          </button>
        </div>
        {predictRevealed && (
          <section className="predict-reveal" aria-live="polite">
            <p className="reveal-title">
              {predictAnswer === "me-01-candidate-sum-unchanged"
                ? "✓ Correct prediction!"
                : "Outcome:"}
            </p>
            <p>{prompt.explanation}</p>
          </section>
        )}
      </section>

      {/* Show The Code Section */}
      <details className="show-the-code">
        <summary>Show the reference code & kernel bindings</summary>
        <div className="code-panel">
          <p>
            Reference evaluator: <code>{ME01_MODEL.source}</code>
          </p>
          <pre>
            <code>{`// evaluatePulseEnergies
const g = 1 / Math.sqrt(1 - frameSpeed * frameSpeed);
const p1 = (emittedEnergyRestFrame / 2) * g * (1 - frameSpeed * Math.cos(phi));
const p2 = (emittedEnergyRestFrame / 2) * g * (1 + frameSpeed * Math.cos(phi));
const pulseSumMoving = g * emittedEnergyRestFrame; // invariant under phi!

// evaluateSubtraction
const subtractionDifference = emittedEnergyRestFrame * (g - 1);
const kineticEnergyDifference = premise === "unchanged" ? subtractionDifference : null;`}</code>
          </pre>
        </div>
      </details>

      {/* Not Modeled Section - Plain Line List */}
      <footer className="lab-not-modeled">
        <p className="not-modeled-heading">Not modeled in this ideal reference calculation:</p>
        <p className="not-modeled-line">{ME01_NOT_MODELED.join(" · ")}</p>
      </footer>
    </section>
  );
}

export function TwoLedgersComparison({ example }: { example: PreparedMe01Example }) {
  return <TwoLedgersLab example={example} />;
}
