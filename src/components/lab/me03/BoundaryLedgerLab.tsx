"use client";

import { type FormEvent, useEffect, useId, useState, useSyncExternalStore } from "react";
import { ExecutionChrome } from "../../../experiments/labels/ExecutionChrome.tsx";
import { executionStateKindFromHostLabel } from "../../../experiments/labels/executionLabelFor.ts";
import { modelNoteFromView } from "../../../experiments/labels/modelNoteData.ts";
import { executionLabelAttributes } from "../../../experiments/labels/resultAttributes.ts";
import { fromMe03Draft, toMe03Draft } from "../../../experiments/me03/controls.ts";
import {
  ME03_BOX_MODEL,
  ME03_CAPTION,
  ME03_DEFAULTS,
  ME03_MODEL,
  ME03_NOT_MODELED,
  ME03_OUTPUTS,
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
import { deriveHostExecution } from "../../../experiments/provenance/executionState.ts";
import { instrumentRootAttributes } from "../../../experiments/store/identityAttributes.ts";
import { ExperimentSettings } from "../ExperimentSettings.tsx";
import { withScripts } from "../subscripts.tsx";
import { BoundaryLedgerPlot } from "./BoundaryLedgerPlot.tsx";
import { PhotonBoxPlot } from "./PhotonBoxPlot.tsx";
import "../labControls.css";
import "./me03.css";
import "../showTheCode.css";
import { AcceptedStatus } from "../AcceptedStatus.tsx";
import { numberText, sentenceNumber } from "../presentation.ts";

/** The energy figure's kind, in words: the card carried its id ("radiated-power") to the reader. */
const ENERGY_FIGURE_WORDS: Readonly<Record<string, string>> = {
  "decay-energy-per-event": "energy released per decay",
  "radiated-power": "power radiated",
  "heat-of-combustion": "heat of combustion",
  "heat-release-rate": "rate of heat release",
  "electrical-input": "electrical input",
  "stated-transfer": "stated energy transfer",
};

export function BoundaryLedgerLab({
  example,
  title = "System-boundary energy ledger with cited energy-source cards",
  session: sharedSession,
}: {
  example?: PreparedMe03Example | undefined;
  title?: string | undefined;
  /**
   * A session owned by the component that embeds the lab, so that something beside it reads the
   * same accepted snapshot (the mass-energy journey's check against the world). Omitted, the lab
   * owns its own, as on /lab/me-03/.
   */
  session?: ReturnType<typeof createMe03Session> | undefined;
}) {
  const id = useId();
  const [session] = useState(
    () => sharedSession ?? createMe03Session(`me03-${id}`, example?.parameters ?? ME03_DEFAULTS),
  );

  const view = useSyncExternalStore(
    session.subscribe,
    session.getSnapshot,
    session.getServerSnapshot,
  );

  const fallbackParams = example?.parameters ?? ME03_DEFAULTS;
  const accepted = view.accepted;
  // Earned per snapshot (am-inst-execution-labels-5ywv), in both the boundary and the 1906 box mode:
  // the build-time example is a static worked example, an accepted recalculation a host
  // calculation; an example without a source digest earns no label at all.
  const executionKind = executionStateKindFromHostLabel(
    deriveHostExecution(
      view,
      ME03_OUTPUTS,
      example?.sourceDigest ?? "",
      accepted !== undefined && accepted === session.getServerSnapshot().accepted,
    ).label,
  );
  const p = (accepted?.parameters ?? fallbackParams) as Me03Parameters;
  const [draft, setDraft] = useState(() => toMe03Draft(p));
  const [error, setError] = useState("");
  const [refusalCode, setRefusalCode] = useState<string | null>(null);
  const [linkNote, setLinkNote] = useState("");
  const [linkPending, setLinkPending] = useState(false);
  const [sharedUrl, setSharedUrl] = useState("");
  const [predictAnswer, setPredictAnswer] = useState<string | null>(null);

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
  // One sentence for the status line: in the box mode, how long the pulse takes and how far the
  // box moves; otherwise the case, where the boundary is drawn and what happens to the radiation.
  const boundaryWords = {
    "body-alone": "the body alone",
    radiation: "the radiation",
    "combined-isolated-system": "the body and the radiation as one isolated system",
  }[p.boundary];
  const statusSummary = boxEvaluation
    ? boxEvaluation.status === "value"
      ? `a ${sentenceNumber(p.pulseEnergy)} J pulse crosses a ${sentenceNumber(p.boxMass)} kg box ${sentenceNumber(p.boxLength)} m long in ${sentenceNumber(boxEvaluation.flightTimeValue)} s, and the box moves back ${sentenceNumber(Math.abs(boxEvaluation.displacement))} m.`
      : (boxEvaluation.reason ?? "the photon box is outside the model's domain at these settings.")
    : `${card.label}, with the boundary around ${boundaryWords}: the radiation ${facts.radiation.disposition === "partly-retained" ? "is partly retained" : facts.radiation.disposition === "retained" ? "is retained" : "escapes"}, and the energy figure is ${numberText(facts.energyFigure.value)} ${facts.energyFigure.unit}.`;

  useEffect(() => {
    const shared = decodeMe03Settings(window.location.search);
    if (shared.kind === "settings") {
      setDraft(toMe03Draft(shared.parameters));
      setLinkPending(true);
      setLinkNote(
        "The link's settings are loaded. The drawing still shows the worked example until you calculate them.",
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
    setLinkPending(false);
  }

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    commitDraft();
  }

  /** Apply the whole draft. The session's validator owns the domain and says what to enter. */
  function commitDraft() {
    apply(fromMe03Draft(draft));
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
      {...instrumentRootAttributes(view)}
      {...executionLabelAttributes(executionKind)}
      data-refusal-code={refusalCode ?? undefined}
    >
      <div className="lab-header">
        <div>
          <p className="eyebrow">
            {isBox ? "1906 photon-in-a-box extension" : "System boundary energy ledger"}
          </p>
          <h2>{title}</h2>
          {isBox && (
            <div className="box-badges">
              <span className="box-badge box-badge-primary">1906 argument</span>
              <span className="box-badge box-badge-credit">credit: Poincaré 1900</span>
            </div>
          )}
        </div>
      </div>
      <div className="lab-status-row">
        <ExecutionChrome
          state={executionKind}
          view={view}
          modelNote={modelNoteFromView(view, { notModeled: `${ME03_NOT_MODELED.join("; ")}.` })}
        />
      </div>

      <noscript>
        <p className="notice">
          JavaScript is off. This is a complete worked example calculated when the site was built,
          and its values and explanations remain available. The controls need JavaScript to respond.
        </p>
      </noscript>

      <div className="lab-columns">
        <div>
          <details className="lab-predict">
            <summary>Predict first</summary>
            <fieldset>
              <legend>{prompt.question}</legend>
              {prompt.candidates.map((c) => (
                <label key={c.id} className="lab-predict-candidate">
                  <input
                    type="radio"
                    name={`${isBox ? "predict-box-light-mass" : "predict-sealed-box"}-${id}`}
                    value={c.id}
                    checked={predictAnswer === c.id}
                    onChange={() => setPredictAnswer(c.id)}
                  />
                  <span>{c.label}</span>
                </label>
              ))}
              {predictAnswer && <p className="lab-predict-reveal">{prompt.explanation}</p>}
            </fieldset>
          </details>
          <fieldset className="lab-choice">
            <legend>Compare</legend>
            <div className="actions">
              <button
                type="button"
                className={`button-toggle ${p.mode === "1905" ? "active" : ""}`}
                onClick={() => setMode("1905")}
                aria-pressed={p.mode === "1905"}
              >
                The 1905 energy ledger
              </button>
              <button
                type="button"
                className={`button-toggle ${p.mode === "four-momentum" ? "active" : ""}`}
                onClick={() => setMode("four-momentum")}
                aria-pressed={p.mode === "four-momentum"}
              >
                Modern four-momentum
              </button>
              <button
                type="button"
                className={`button-toggle ${p.mode === "box-1906" ? "active" : ""}`}
                onClick={() => setMode("box-1906")}
                aria-pressed={p.mode === "box-1906"}
              >
                The 1906 photon in a box
              </button>
            </div>
          </fieldset>
          {isBox ? (
            <fieldset className="lab-choice">
              <legend>Give the light pulse a mass m = E/c²?</legend>
              <div className="actions">
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
            </fieldset>
          ) : (
            <>
              <fieldset className="lab-choice">
                <legend>Inside the boundary</legend>
                <div className="actions">
                  <button
                    type="button"
                    className={`button-toggle ${p.boundary === "body-alone" ? "active" : ""}`}
                    onClick={() => setBoundary("body-alone")}
                    aria-pressed={p.boundary === "body-alone"}
                  >
                    The body alone
                  </button>
                  <button
                    type="button"
                    className={`button-toggle ${p.boundary === "radiation" ? "active" : ""}`}
                    onClick={() => setBoundary("radiation")}
                    aria-pressed={p.boundary === "radiation"}
                  >
                    The radiation
                  </button>
                  <button
                    type="button"
                    className={`button-toggle ${p.boundary === "combined-isolated-system" ? "active" : ""}`}
                    onClick={() => setBoundary("combined-isolated-system")}
                    aria-pressed={p.boundary === "combined-isolated-system"}
                  >
                    Both, as one isolated system
                  </button>
                </div>
              </fieldset>
              <fieldset className="lab-choice">
                <legend>The radiation</legend>
                <div className="actions">
                  <button
                    type="button"
                    className={`button-toggle ${p.disposition === "escapes" ? "active" : ""}`}
                    onClick={() => setDisposition("escapes")}
                    aria-pressed={p.disposition === "escapes"}
                  >
                    Escapes
                  </button>
                  <button
                    type="button"
                    className={`button-toggle ${p.disposition === "retained" ? "active" : ""}`}
                    onClick={() => setDisposition("retained")}
                    aria-pressed={p.disposition === "retained"}
                  >
                    Is absorbed inside an enclosure
                  </button>
                </div>
              </fieldset>
              {p.mode === "four-momentum" && (
                <fieldset className="lab-choice">
                  <legend>Pulses</legend>
                  <div className="actions">
                    <button
                      type="button"
                      className={`button-toggle ${p.pulseSystem === "single-pulse" ? "active" : ""}`}
                      onClick={() => setPulseSystem("single-pulse")}
                      aria-pressed={p.pulseSystem === "single-pulse"}
                    >
                      One pulse (m = 0)
                    </button>
                    <button
                      type="button"
                      className={`button-toggle ${p.pulseSystem === "two-collinear" ? "active" : ""}`}
                      onClick={() => setPulseSystem("two-collinear")}
                      aria-pressed={p.pulseSystem === "two-collinear"}
                    >
                      Two, same direction (m = 0)
                    </button>
                    <button
                      type="button"
                      className={`button-toggle ${p.pulseSystem === "two-opposite" ? "active" : ""}`}
                      onClick={() => setPulseSystem("two-opposite")}
                      aria-pressed={p.pulseSystem === "two-opposite"}
                    >
                      Two, opposite directions (m = L/c²)
                    </button>
                  </div>
                </fieldset>
              )}
            </>
          )}
          <fieldset className="lab-choice">
            <legend>Try</legend>
            <div className="actions">
              {ME03_PRESETS.map((pr) => (
                <button
                  key={pr.presetId}
                  type="button"
                  className="secondary"
                  onClick={() => loadPreset(pr.presetId)}
                >
                  {pr.label}
                </button>
              ))}
            </div>
          </fieldset>
          <ExperimentSettings
            contents={
              isBox
                ? "the box's mass, length and pulse energy, magnification, notation, a link to these settings"
                : "seven cited energy sources, notation, a link to these settings"
            }
          >
            {isBox ? (
              <form onSubmit={submit} aria-label="1906 box parameters">
                <div className="control-row">
                  <label htmlFor={`box-mass-${id}`}>Box mass M (kg)</label>
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
                  <label htmlFor={`box-len-${id}`}>Box length ℓ (m)</label>
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
                  <label htmlFor={`pulse-energy-${id}`}>Pulse energy E (J)</label>
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
                <button type="submit" className="secondary">
                  Calculate with these values
                </button>
              </form>
            ) : (
              <fieldset className="lab-choice">
                <legend>A cited energy source</legend>
                <div className="actions">
                  <button
                    type="button"
                    className={`button-toggle ${p.cardId === "me-03-card-radium" ? "active" : ""}`}
                    onClick={() => setCardId("me-03-card-radium")}
                    aria-pressed={p.cardId === "me-03-card-radium"}
                  >
                    Radium decay
                  </button>
                  <button
                    type="button"
                    className={`button-toggle ${p.cardId === "me-03-card-sun" ? "active" : ""}`}
                    onClick={() => setCardId("me-03-card-sun")}
                    aria-pressed={p.cardId === "me-03-card-sun"}
                  >
                    The Sun
                  </button>
                  <button
                    type="button"
                    className={`button-toggle ${p.cardId === "me-03-card-coal" ? "active" : ""}`}
                    onClick={() => setCardId("me-03-card-coal")}
                    aria-pressed={p.cardId === "me-03-card-coal"}
                  >
                    Burning coal
                  </button>
                  <button
                    type="button"
                    className={`button-toggle ${p.cardId === "me-03-card-candle" ? "active" : ""}`}
                    onClick={() => setCardId("me-03-card-candle")}
                    aria-pressed={p.cardId === "me-03-card-candle"}
                  >
                    A candle
                  </button>
                  <button
                    type="button"
                    className={`button-toggle ${p.cardId === "me-03-card-bulb" ? "active" : ""}`}
                    onClick={() => setCardId("me-03-card-bulb")}
                    aria-pressed={p.cardId === "me-03-card-bulb"}
                  >
                    A 100 W bulb for a year
                  </button>
                  <button
                    type="button"
                    className={`button-toggle ${p.cardId === "me-03-heated-sealed-box" ? "active" : ""}`}
                    onClick={() => setCardId("me-03-heated-sealed-box")}
                    aria-pressed={p.cardId === "me-03-heated-sealed-box"}
                  >
                    A heated sealed box
                  </button>
                  <button
                    type="button"
                    className={`button-toggle ${p.cardId === "me-03-sealed-lamp-and-mirror" ? "active" : ""}`}
                    onClick={() => setCardId("me-03-sealed-lamp-and-mirror")}
                    aria-pressed={p.cardId === "me-03-sealed-lamp-and-mirror"}
                  >
                    A sealed lamp and mirror
                  </button>
                </div>
              </fieldset>
            )}
            {isBox && (
              <fieldset className="lab-choice">
                <legend>Magnify the displacement</legend>
                <div className="actions">
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
              </fieldset>
            )}
            <fieldset className="lab-choice">
              <legend>Notation</legend>
              <div className="actions">
                <button
                  type="button"
                  className={`button-toggle ${p.notation === "printed" ? "active" : ""}`}
                  onClick={() => toggleNotation("printed")}
                  aria-pressed={p.notation === "printed"}
                >
                  As printed in 1905, with the radical
                </button>
                <button
                  type="button"
                  className={`button-toggle ${p.notation === "modern" ? "active" : ""}`}
                  onClick={() => toggleNotation("modern")}
                  aria-pressed={p.notation === "modern"}
                >
                  Modern, with γ and invariant mass
                </button>
              </div>
            </fieldset>
            <button type="button" className="secondary" onClick={share}>
              Copy a link to these settings
            </button>
            {sharedUrl && (
              <p className="fine">
                Link copied: <code>{sharedUrl}</code>
              </p>
            )}
          </ExperimentSettings>
          {error && (
            <p className="notice error" role="alert" data-refusal-code={refusalCode ?? undefined}>
              {error}
            </p>
          )}
          <AcceptedStatus
            worked={accepted === undefined || accepted === session.getServerSnapshot().accepted}
            summary={statusSummary}
          />
          {linkNote && (
            <div className="notice">
              <p>{linkNote}</p>
              {linkPending && (
                <button type="button" className="secondary" onClick={commitDraft}>
                  Calculate the linked settings
                </button>
              )}
            </div>
          )}
        </div>

        <div className="lab-results">
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
              <BoundaryLedgerPlot
                parameters={p}
                evaluation={evaluation}
                clipId={`me03-clip-${id}`}
              />

              {/* Seven Typed Boundary Facts Panel */}
              <section
                className="card-boundary-panel"
                aria-label="Cited energy-source boundary facts"
              >
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
                    fontSize: "var(--type-fine)",
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
                    <dt style={{ fontWeight: 600, color: "var(--ink)" }}>
                      4. Radiation disposition:
                    </dt>
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
                      {numberText(facts.energyFigure.value)} {facts.energyFigure.unit} (
                      {ENERGY_FIGURE_WORDS[facts.energyFigure.kind]})
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
                      fontSize: "var(--type-fine)",
                      color: "var(--ink)",
                    }}
                  >
                    <strong>7. Closed but not isolated:</strong> Nothing material crosses this
                    boundary, but the system is not isolated: energy still enters or leaves it.
                  </div>
                )}
              </section>
            </>
          )}
        </div>
      </div>

      {/* Show The Code Section */}
      <details className="show-the-code">
        <summary>Show the reference code & kernel bindings</summary>
        <div className="code-panel">
          <p>
            Reference evaluator: <code>{isBox ? ME03_BOX_MODEL.source : ME03_MODEL.source}</code>
          </p>
          {/* A code line does not wrap, so the block scrolls inside its own named region
              instead of widening the page (+378px on a phone with this section open). */}
          <section
            className="show-the-code-scroll"
            aria-label="ME-03 reference code"
            // biome-ignore lint/a11y/noNoninteractiveTabindex: a scrollable region must be focusable
            tabIndex={0}
          >
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
          </section>
        </div>
      </details>

      {/* Not Modeled Section */}
      <footer className="lab-not-modeled">
        <p className="not-modeled-heading">Not modeled in this ideal reference calculation:</p>
        <p className="not-modeled-line">{ME03_NOT_MODELED.join(" · ")}</p>
      </footer>

      {/* The four readings follow the reader's detail setting, as on every other laboratory: direct
          children of the lab root, which labShell.css's detail rules select. */}
      <p data-detail="0">{withScripts(ME03_CAPTION.r0)}</p>
      <p data-detail="1">{withScripts(ME03_CAPTION.r1)}</p>
      <p data-detail="2" hidden>
        {withScripts(ME03_CAPTION.r2)}
      </p>
      <p data-detail="3" hidden>
        {withScripts(ME03_CAPTION.r3)}
      </p>
    </section>
  );
}

export function BoundaryLedgerComparison({ example }: { example: PreparedMe03Example }) {
  return <BoundaryLedgerLab example={example} />;
}
