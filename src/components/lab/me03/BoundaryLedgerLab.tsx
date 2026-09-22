"use client";

import { type FormEvent, useEffect, useId, useState, useSyncExternalStore } from "react";
import { fromMe03Draft, toMe03Draft } from "../../../experiments/me03/controls.ts";
import {
  ME03_BOX_MODEL,
  ME03_CAPTION,
  ME03_DEFAULTS,
  ME03_MODEL,
  ME03_NOT_MODELED,
  ME03_PRESETS,
  ME03_PROMPTS,
  type Me03Boundary,
  type Me03CardId,
  type Me03Mode,
  type Me03Notation,
  type Me03Parameters,
  type Me03PulseSystem,
  type Me03RadiationDisposition,
} from "../../../experiments/me03/definition.ts";
import { decodeMe03Settings, encodeMe03Settings } from "../../../experiments/me03/permalink.ts";
import { buildMe03BoxScale, validateMe03BoxScale } from "../../../experiments/me03/scale.ts";
import {
  createMe03Session,
  evaluateMe03,
  evaluatePhotonBox,
  type PreparedMe03Example,
} from "../../../experiments/me03/session.ts";
import { BoundaryLedgerPlot } from "./BoundaryLedgerPlot.tsx";
import { PhotonBoxPlot } from "./PhotonBoxPlot.tsx";
import "./me03.css";

export function BoundaryLedgerLab({
  example,
  title = "ME-03: System-boundary energy ledger with cited energy-source cards",
}: {
  example?: PreparedMe03Example | undefined;
  title?: string | undefined;
}) {
  const id = useId();
  const [session] = useState(() =>
    createMe03Session(`me03-${id}`, example?.parameters ?? ME03_DEFAULTS),
  );

  const view = useSyncExternalStore(
    session.subscribe,
    session.getSnapshot,
    session.getServerSnapshot,
  );

  const fallbackParams = example?.parameters ?? ME03_DEFAULTS;
  const accepted = view.accepted;
  const p = (accepted?.parameters ?? fallbackParams) as Me03Parameters;
  const [draft, setDraft] = useState(() => toMe03Draft(p));
  const [error, setError] = useState("");
  const [refusalCode, setRefusalCode] = useState<string | null>(null);
  const [linkNote, setLinkNote] = useState("");
  const [sharedUrl, setSharedUrl] = useState("");
  const [predictAnswer, setPredictAnswer] = useState<string | null>(null);
  const [predictRevealed, setPredictRevealed] = useState(false);

  const isBox = p.mode === "box-1906";
  const evaluation = evaluateMe03(p);
  const card = evaluation.card;
  const facts = card.boundary;

  const boxEvaluation = isBox
    ? evaluatePhotonBox({
        M: p.boxMass,
        ell: p.boxLength,
        E: p.pulseEnergy,
        assignLightMass: p.assignLightMass,
      })
    : null;

  const boxScale = isBox
    ? buildMe03BoxScale(p.magnification, boxEvaluation?.flightTimeValue ?? 3.33564095198152e-9)
    : null;
  if (boxScale) {
    validateMe03BoxScale(boxScale, "me-03:box-1906");
  }

  useEffect(() => {
    const shared = decodeMe03Settings(window.location.search);
    if (shared.kind === "settings") {
      setDraft(toMe03Draft(shared.parameters));
      setLinkNote(
        "Shared settings are loaded. Choose Apply changes to calculate them; the worked example is still displayed.",
      );
    } else if (shared.kind === "invalid") {
      setLinkNote(shared.message);
    }
  }, []);

  function apply(parameters: Me03Parameters) {
    const outcome = session.apply(parameters);
    if (outcome.kind === "refused") {
      const details = outcome.refusal.details;
      const req =
        typeof details?.requirements === "string" ? details.requirements : outcome.refusal.message;
      const code =
        typeof details?.code === "string" ? (details.code as string) : outcome.refusal.code;
      setError(req);
      setRefusalCode(code);
      return;
    }
    setError("");
    setRefusalCode(null);
    setLinkNote("");
  }

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const parsed = fromMe03Draft(draft);
    if (parsed.mode === "box-1906") {
      if (!Number.isFinite(parsed.boxMass) || parsed.boxMass <= 0) {
        setError("Box mass M must be a positive finite number.");
        setRefusalCode("nonfinite-input");
        return;
      }
      if (!Number.isFinite(parsed.boxLength) || parsed.boxLength <= 0) {
        setError("Box length ell must be a positive finite number.");
        setRefusalCode("nonfinite-input");
        return;
      }
      if (!Number.isFinite(parsed.pulseEnergy) || parsed.pulseEnergy <= 0) {
        setError("Pulse energy E must be a positive finite number.");
        setRefusalCode("nonfinite-input");
        return;
      }
    } else {
      if (!Number.isFinite(parsed.emittedEnergy) || parsed.emittedEnergy <= 0) {
        setError("Emitted energy L must be a positive finite number (L > 0).");
        setRefusalCode("nonfinite-input");
        return;
      }
      if (!Number.isFinite(parsed.inputEnergy) || parsed.inputEnergy < 0) {
        setError("Input energy Ein must be a non-negative finite number.");
        setRefusalCode("nonfinite-input");
        return;
      }
    }
    apply(parsed);
  }

  function loadPreset(presetId: string) {
    const found = ME03_PRESETS.find((pr) => pr.presetId === presetId);
    if (!found) return;
    const nextParams: Me03Parameters = {
      ...p,
      ...found.parameterValues,
    };
    setDraft(toMe03Draft(nextParams));
    apply(nextParams);
  }

  function setBoundary(boundary: Me03Boundary) {
    const next = { ...p, boundary };
    setDraft(toMe03Draft(next));
    apply(next);
  }

  function setDisposition(disposition: Me03RadiationDisposition) {
    const next = { ...p, disposition };
    setDraft(toMe03Draft(next));
    apply(next);
  }

  function setCardId(cardId: Me03CardId) {
    const next = { ...p, cardId };
    setDraft(toMe03Draft(next));
    apply(next);
  }

  function setMode(mode: Me03Mode) {
    const next = { ...p, mode };
    setDraft(toMe03Draft(next));
    apply(next);
  }

  function setPulseSystem(pulseSystem: Me03PulseSystem) {
    const next = { ...p, pulseSystem };
    setDraft(toMe03Draft(next));
    apply(next);
  }

  function setAssignLightMass(assignLightMass: boolean) {
    const next = { ...p, assignLightMass };
    setDraft(toMe03Draft(next));
    apply(next);
  }

  function setMagnification(magnification: number) {
    const next = { ...p, magnification };
    setDraft(toMe03Draft(next));
    apply(next);
  }

  function toggleNotation(notation: Me03Notation) {
    const next = { ...p, notation };
    setDraft(toMe03Draft(next));
    apply(next);
  }

  function share() {
    const query = encodeMe03Settings(p);
    const url = `${window.location.origin}${window.location.pathname}${query}`;
    setSharedUrl(url);
    if (navigator.clipboard) {
      navigator.clipboard.writeText(url).catch(() => {});
    }
  }

  const prompt = isBox ? ME03_PROMPTS.boxLightMass : ME03_PROMPTS.sealedBox;

  return (
    <section
      className="laboratory-shell"
      aria-label={title}
      data-instrument-id={isBox ? "me-03:box-1906" : "me-03"}
      data-instance-id={session.getSnapshot().accepted?.instanceId ?? "me-03"}
      data-run-id={session.getSnapshot().accepted?.runId ?? "me03-init"}
      data-snapshot-version={session.getSnapshot().accepted?.snapshotVersion ?? 0}
      data-input-revision={session.getSnapshot().requested?.revisions.input ?? 0}
      data-accepted-input-revision={session.getSnapshot().accepted?.revisions.input ?? 0}
      data-pending={session.getSnapshot().pending ? "true" : "false"}
      data-execution-label="host"
      data-refusal-code={refusalCode ?? undefined}
    >
      <div className="lab-header">
        <div>
          <p className="eyebrow">{isBox ? ME03_BOX_MODEL.label : ME03_MODEL.label}</p>
          <h2>{title}</h2>
          <p className="caption-r0">{ME03_CAPTION.r0}</p>
          {isBox && (
            <div className="box-badges">
              <span className="box-badge box-badge-primary">1906 argument</span>
              <span className="box-badge box-badge-credit">credit: Poincaré 1900</span>
            </div>
          )}
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
            Modern γ / Invariant Mass
          </button>
        </div>
      </div>

      {/* Preset Bar */}
      <div className="presets-bar">
        <span className="presets-label">Presets:</span>
        {ME03_PRESETS.map((pr) => (
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

      {/* Main Visual Plot */}
      {isBox && boxEvaluation && boxScale ? (
        <PhotonBoxPlot
          parameters={p}
          evaluation={boxEvaluation}
          scale={boxScale}
          clipId={`me03-box-clip-${id}`}
        />
      ) : (
        <>
          <BoundaryLedgerPlot parameters={p} evaluation={evaluation} clipId={`me03-clip-${id}`} />

          {/* Seven Typed Boundary Facts Panel */}
          <section className="card-boundary-panel" aria-label="Cited energy-source boundary facts">
            <h3
              style={{
                fontSize: "0.875rem",
                fontWeight: "bold",
                marginBottom: "0.5rem",
                color: "var(--ink)",
              }}
            >
              Case study facts: {card.label}
            </h3>
            <p
              style={{
                fontSize: "0.75rem",
                color: "var(--muted)",
                marginBottom: "0.75rem",
                fontStyle: "italic",
              }}
            >
              Citation: {card.citation}
            </p>

            <dl className="boundary-facts-list">
              <div className="fact-item">
                <dt style={{ fontWeight: 600, color: "var(--ink)" }}>1. System before:</dt>
                <dd style={{ color: "var(--ink)" }}>{facts.systemBefore}</dd>
              </div>
              <div className="fact-item">
                <dt style={{ fontWeight: 600, color: "var(--ink)" }}>2. System after:</dt>
                <dd style={{ color: "var(--ink)" }}>{facts.systemAfter}</dd>
              </div>
              <div className="fact-item">
                <dt style={{ fontWeight: 600, color: "var(--ink)" }}>
                  3. Matter crosses boundary:
                </dt>
                <dd
                  style={{
                    color: facts.matterCrossesBoundary.crosses ? "var(--accent)" : "var(--ink)",
                  }}
                >
                  {facts.matterCrossesBoundary.crosses
                    ? "Yes (Matter transfer: "
                    : "No (Closed system: "}
                  {facts.matterCrossesBoundary.note})
                </dd>
              </div>
              <div className="fact-item">
                <dt style={{ fontWeight: 600, color: "var(--ink)" }}>4. Radiation disposition:</dt>
                <dd style={{ color: "var(--ink)" }}>
                  <span style={{ fontWeight: 600, textTransform: "capitalize" }}>
                    {facts.radiation.disposition}
                  </span>{" "}
                  ({facts.radiation.note})
                </dd>
              </div>
              <div className="fact-item">
                <dt style={{ fontWeight: 600, color: "var(--ink)" }}>5. Reference frame:</dt>
                <dd style={{ color: "var(--ink)" }}>{facts.referenceFrame}</dd>
              </div>
              <div className="fact-item">
                <dt style={{ fontWeight: 600, color: "var(--ink)" }}>6. Energy figure:</dt>
                <dd style={{ color: "var(--ink)", fontFamily: "var(--font-mono, monospace)" }}>
                  {facts.energyFigure.value} {facts.energyFigure.unit} ({facts.energyFigure.kind})
                </dd>
              </div>
            </dl>

            {facts.closedButNotIsolated.value && (
              <div
                style={{
                  marginTop: "0.75rem",
                  padding: "0.5rem",
                  background: "var(--wash)",
                  border: "1px solid var(--line)",
                  borderRadius: "0.25rem",
                  fontSize: "0.75rem",
                  color: "var(--ink)",
                }}
              >
                <strong>7. Closed but not isolated:</strong> Nothing material crosses this boundary,
                but the system is not isolated: energy still enters or leaves it.
              </div>
            )}
          </section>
        </>
      )}

      {/* Form Controls */}
      <form className="lab-controls" onSubmit={submit}>
        <fieldset className="control-group">
          <legend>Formalism & Mode</legend>
          <div className="control-row">
            <span className="field-label">Mode:</span>
            <div className="toggle-group" role="radiogroup" aria-label="Formalism mode">
              <button
                type="button"
                className={`button-toggle ${p.mode === "1905" ? "active" : ""}`}
                onClick={() => setMode("1905")}
                aria-pressed={p.mode === "1905"}
              >
                1905 Energy Ledger
              </button>
              <button
                type="button"
                className={`button-toggle ${p.mode === "four-momentum" ? "active" : ""}`}
                onClick={() => setMode("four-momentum")}
                aria-pressed={p.mode === "four-momentum"}
              >
                Modern Four-Momentum
              </button>
              <button
                type="button"
                className={`button-toggle ${p.mode === "box-1906" ? "active" : ""}`}
                onClick={() => setMode("box-1906")}
                aria-pressed={p.mode === "box-1906"}
              >
                1906 Photon in a Box
              </button>
            </div>
          </div>
        </fieldset>

        {isBox ? (
          <fieldset className="control-group" aria-label="1906 box parameters">
            <legend>1906 Thought Experiment Parameters</legend>

            <div className="control-row">
              <label htmlFor={`box-mass-${id}`}>Box mass M (kg):</label>
              <input
                id={`box-mass-${id}`}
                type="number"
                step="any"
                min="0"
                className="input-number"
                value={draft.boxMass}
                onChange={(e) => setDraft({ ...draft, boxMass: e.target.value })}
              />
            </div>

            <div className="control-row">
              <label htmlFor={`box-len-${id}`}>Box length ℓ (m):</label>
              <input
                id={`box-len-${id}`}
                type="number"
                step="any"
                min="0"
                className="input-number"
                value={draft.boxLength}
                onChange={(e) => setDraft({ ...draft, boxLength: e.target.value })}
              />
            </div>

            <div className="control-row">
              <label htmlFor={`pulse-energy-${id}`}>Pulse energy E (J):</label>
              <input
                id={`pulse-energy-${id}`}
                type="number"
                step="any"
                min="0"
                className="input-number"
                value={draft.pulseEnergy}
                onChange={(e) => setDraft({ ...draft, pulseEnergy: e.target.value })}
              />
            </div>

            <div className="control-row">
              <span className="field-label">Assign light mass m = E/c²:</span>
              <div className="toggle-group">
                <button
                  type="button"
                  data-testid="assign-light-mass-toggle"
                  className={`button-toggle ${p.assignLightMass ? "active" : ""}`}
                  onClick={() => setAssignLightMass(!p.assignLightMass)}
                  aria-pressed={p.assignLightMass}
                >
                  {p.assignLightMass ? "Yes (m = E/c²)" : "No (m = 0)"}
                </button>
              </div>
            </div>

            <div className="control-row">
              <span className="field-label">Visual displacement magnification:</span>
              <div className="toggle-group" role="radiogroup" aria-label="Magnification factor">
                <button
                  type="button"
                  className={`button-toggle ${p.magnification === 1e15 ? "active" : ""}`}
                  onClick={() => setMagnification(1e15)}
                  aria-pressed={p.magnification === 1e15}
                >
                  10¹⁵×
                </button>
                <button
                  type="button"
                  className={`button-toggle ${p.magnification === 1e17 ? "active" : ""}`}
                  onClick={() => setMagnification(1e17)}
                  aria-pressed={p.magnification === 1e17}
                >
                  10¹⁷×
                </button>
                <button
                  type="button"
                  className={`button-toggle ${p.magnification === 1e20 ? "active" : ""}`}
                  onClick={() => setMagnification(1e20)}
                  aria-pressed={p.magnification === 1e20}
                >
                  10²⁰×
                </button>
              </div>
            </div>
          </fieldset>
        ) : (
          <>
            <fieldset className="control-group">
              <legend>System Boundary & Formalism</legend>

              {/* Boundary Selection */}
              <div className="control-row">
                <span className="field-label">System boundary (objects included):</span>
                <div className="toggle-group" role="radiogroup" aria-label="System boundary">
                  <button
                    type="button"
                    className={`button-toggle ${p.boundary === "body-alone" ? "active" : ""}`}
                    onClick={() => setBoundary("body-alone")}
                    aria-pressed={p.boundary === "body-alone"}
                  >
                    Body Alone
                  </button>
                  <button
                    type="button"
                    className={`button-toggle ${p.boundary === "radiation" ? "active" : ""}`}
                    onClick={() => setBoundary("radiation")}
                    aria-pressed={p.boundary === "radiation"}
                  >
                    Radiation
                  </button>
                  <button
                    type="button"
                    className={`button-toggle ${p.boundary === "combined-isolated-system" ? "active" : ""}`}
                    onClick={() => setBoundary("combined-isolated-system")}
                    aria-pressed={p.boundary === "combined-isolated-system"}
                  >
                    Combined Isolated System
                  </button>
                </div>
              </div>

              {/* Radiation Disposition */}
              <div className="control-row">
                <span className="field-label">Energy retained or released:</span>
                <div className="toggle-group" role="radiogroup" aria-label="Radiation disposition">
                  <button
                    type="button"
                    className={`button-toggle ${p.disposition === "escapes" ? "active" : ""}`}
                    onClick={() => setDisposition("escapes")}
                    aria-pressed={p.disposition === "escapes"}
                  >
                    Radiation Escapes
                  </button>
                  <button
                    type="button"
                    className={`button-toggle ${p.disposition === "retained" ? "active" : ""}`}
                    onClick={() => setDisposition("retained")}
                    aria-pressed={p.disposition === "retained"}
                  >
                    Radiation Absorbed in Enclosure
                  </button>
                </div>
              </div>

              {p.mode === "four-momentum" && (
                <div className="control-row">
                  <span className="field-label">Four-momentum pulse geometry:</span>
                  <div className="toggle-group">
                    <button
                      type="button"
                      className={`button-toggle ${p.pulseSystem === "single-pulse" ? "active" : ""}`}
                      onClick={() => setPulseSystem("single-pulse")}
                      aria-pressed={p.pulseSystem === "single-pulse"}
                    >
                      Single Pulse (m = 0)
                    </button>
                    <button
                      type="button"
                      className={`button-toggle ${p.pulseSystem === "two-collinear" ? "active" : ""}`}
                      onClick={() => setPulseSystem("two-collinear")}
                      aria-pressed={p.pulseSystem === "two-collinear"}
                    >
                      Two Collinear (m = 0)
                    </button>
                    <button
                      type="button"
                      className={`button-toggle ${p.pulseSystem === "two-opposite" ? "active" : ""}`}
                      onClick={() => setPulseSystem("two-opposite")}
                      aria-pressed={p.pulseSystem === "two-opposite"}
                    >
                      Two Opposite (m = L/c²)
                    </button>
                  </div>
                </div>
              )}
            </fieldset>

            <fieldset className="control-group">
              <legend>Cited Energy-Source Case Studies</legend>
              <div className="control-row">
                <span className="field-label">Select case study:</span>
                <div className="card-buttons-grid">
                  <button
                    type="button"
                    className={`button-toggle ${p.cardId === "me-03-card-radium" ? "active" : ""}`}
                    onClick={() => setCardId("me-03-card-radium")}
                  >
                    Radium Decay
                  </button>
                  <button
                    type="button"
                    className={`button-toggle ${p.cardId === "me-03-card-sun" ? "active" : ""}`}
                    onClick={() => setCardId("me-03-card-sun")}
                  >
                    The Sun
                  </button>
                  <button
                    type="button"
                    className={`button-toggle ${p.cardId === "me-03-card-coal" ? "active" : ""}`}
                    onClick={() => setCardId("me-03-card-coal")}
                  >
                    Burning Coal
                  </button>
                  <button
                    type="button"
                    className={`button-toggle ${p.cardId === "me-03-card-candle" ? "active" : ""}`}
                    onClick={() => setCardId("me-03-card-candle")}
                  >
                    Candle
                  </button>
                  <button
                    type="button"
                    className={`button-toggle ${p.cardId === "me-03-card-bulb" ? "active" : ""}`}
                    onClick={() => setCardId("me-03-card-bulb")}
                  >
                    100 W Bulb (1 Yr)
                  </button>
                  <button
                    type="button"
                    className={`button-toggle ${p.cardId === "me-03-heated-sealed-box" ? "active" : ""}`}
                    onClick={() => setCardId("me-03-heated-sealed-box")}
                  >
                    Heated Box
                  </button>
                  <button
                    type="button"
                    className={`button-toggle ${p.cardId === "me-03-sealed-lamp-and-mirror" ? "active" : ""}`}
                    onClick={() => setCardId("me-03-sealed-lamp-and-mirror")}
                  >
                    Sealed Lamp & Mirror
                  </button>
                </div>
              </div>
            </fieldset>
          </>
        )}

        <div className="form-actions">
          <button type="submit" className="button">
            Apply changes
          </button>
          <button type="button" className="button" onClick={share}>
            Share configuration link
          </button>
        </div>

        {error && (
          <div
            className="notice error error-banner"
            role="alert"
            data-refusal-code={refusalCode ?? undefined}
          >
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
        <h3>
          {isBox
            ? "Predict before evaluating the light pulse recoil:"
            : "Predict before inspecting the sealed box:"}
        </h3>
        <p className="predict-question">{prompt.question}</p>
        <div className="predict-options" role="radiogroup">
          {prompt.candidates.map((c) => (
            <label key={c.id} className="predict-candidate">
              <input
                type="radio"
                name={isBox ? "predict-box-light-mass" : "predict-sealed-box"}
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
              {predictAnswer === prompt.settledCandidateId ? "✓ Correct prediction!" : "Outcome:"}
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
            Reference evaluator: <code>{isBox ? ME03_BOX_MODEL.source : ME03_MODEL.source}</code>
          </p>
          <pre>
            <code>
              {isBox
                ? `// evaluatePhotonBox (Einstein 1906 / Poincaré 1900)
const dt = ell / c;
const pPulse = E / c;
const vRecoil = -pPulse / M;
const boxDeltaX = vRecoil * dt; // -E * ell / (M * c^2)
const mLight = assignLightMass ? E / (c * c) : 0;
const comShift = (M * boxDeltaX + mLight * ell) / (M + mLight);`
                : `// evaluateBoundaryLedger
const bodyDeltaM = -emittedEnergy / (c * c);
const sysDeltaM = disposition === "retained" ? inputEnergy / (c * c) : 0;

// evaluateFourMomentum
const mSquared = (totalEnergy / c)^2 - p^2;
const invariantMass = Math.sqrt(Math.max(0, mSquared));`}
            </code>
          </pre>
        </div>
      </details>

      {/* Not Modeled Section */}
      <footer className="lab-not-modeled">
        <p className="not-modeled-heading">Not modeled in this ideal reference calculation:</p>
        <p className="not-modeled-line">{ME03_NOT_MODELED.join(" · ")}</p>
      </footer>
    </section>
  );
}

export function BoundaryLedgerComparison({ example }: { example: PreparedMe03Example }) {
  return <BoundaryLedgerLab example={example} />;
}
