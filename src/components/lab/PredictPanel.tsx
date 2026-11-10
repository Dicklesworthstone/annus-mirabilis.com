"use client";

import { useId, useState } from "react";
import { adjudicatePrediction } from "../../experiments/predict/predictAdjudication.ts";
import {
  type AxisRange,
  clearSketchPoints,
  createSketchKeyboardState,
  getSketchStatusAnnouncement,
  moveSketchCursor,
  placeSketchPoint,
  processSketchPoints,
  undoSketchPoint,
} from "../../experiments/predict/predictSketch.ts";
import type {
  PredictionChoice,
  PredictPromptRecord,
} from "../../experiments/predict/predictState.ts";
import "./predict.css";
import { withScripts } from "./subscripts.tsx";

export type PredictPanelCandidate = Readonly<{
  id: string;
  label: string;
  description: string;
  separatingAssumption: string;
}>;

export type PredictPanelPrompt = Readonly<{
  promptId: string;
  question: string;
  supportedCandidateId: string;
  /** Why the supported relation holds, shown once the result is. */
  explanation?: string | undefined;
  candidates: readonly PredictPanelCandidate[];
  sketchAxes?:
    | Readonly<{
        x: Readonly<{ label: string; min: number; max: number; unit?: string }>;
        y: Readonly<{ label: string; min: number; max: number; unit?: string }>;
      }>
    | undefined;
  verbalChoices?:
    | Readonly<{
        directionChoices?: readonly Readonly<{ id: string; label: string }>[];
        shapeChoices?: readonly Readonly<{ id: string; label: string }>[];
      }>
    | undefined;
  valueTargets?:
    | readonly Readonly<{
        targetId: string;
        label: string;
        unit?: string;
        min?: number;
        max?: number;
      }>[]
    | undefined;
}>;

export type PredictionFormTab = "candidate" | "sketch" | "verbal" | "values";

const DEFAULT_DIRECTIONS = [
  { id: "increases", label: "Increases" },
  { id: "decreases", label: "Decreases" },
  { id: "stays-constant", label: "Stays constant" },
] as const;

const DEFAULT_SHAPES = [
  { id: "linear", label: "Linear" },
  { id: "quadratic", label: "Quadratic" },
  { id: "square-root", label: "Square root" },
  { id: "saturating", label: "Saturating" },
] as const;

const ALL_FORMS: readonly PredictionFormTab[] = ["candidate", "sketch", "verbal", "values"];

export function PredictPanel({
  prompt,
  record,
  onRecord,
  onSkip,
  onKeepToSelf,
  onAmend,
  forms = ALL_FORMS,
  resultShown = false,
  reasoningHref,
  describeCandidates = true,
}: {
  prompt: PredictPanelPrompt;
  record: PredictPromptRecord;
  onRecord: (choice: PredictionChoice) => void;
  onSkip: () => void;
  onKeepToSelf: () => void;
  onAmend: (choice: PredictionChoice) => void;
  /** The prediction formats offered; one format draws no tabs. */
  forms?: readonly PredictionFormTab[];
  /** True where the result shows as soon as the reader answers (PredictGate), not after Apply. */
  resultShown?: boolean;
  /** Where "Show me the reasoning" goes; no link without one. */
  reasoningHref?: string;
  /**
   * False draws each candidate by its label alone. A manifest's candidate descriptions give each
   * candidate's reasoning ("Because the moving frame cuts simultaneous slices ... = 2.0"), which
   * names the supported one before the reader has chosen.
   */
  describeCandidates?: boolean;
}) {
  const instanceId = useId();
  const controlId = `${prompt.promptId}-${instanceId}`;
  const [activeTab, setActiveTab] = useState<PredictionFormTab>(forms[0] ?? "candidate");
  const offers = (tab: PredictionFormTab) => forms.includes(tab);

  // Verbal state
  const directions = prompt.verbalChoices?.directionChoices ?? DEFAULT_DIRECTIONS;
  const shapes = prompt.verbalChoices?.shapeChoices ?? DEFAULT_SHAPES;
  // Nothing is chosen until the reader chooses: a pre-checked "Increases" is a prediction the
  // reader never made, recorded as theirs if they press Record without looking.
  const [selectedDirection, setSelectedDirection] = useState<string>("");
  const [selectedShape, setSelectedShape] = useState<string>("");

  // Values state
  const targets = prompt.valueTargets ?? [];
  const [valueInputs, setValueInputs] = useState<Record<string, string>>({});
  const validValues =
    targets.length > 0 &&
    targets.every((target) => {
      const text = valueInputs[target.targetId]?.trim() ?? "";
      const value = Number(text);
      return (
        text !== "" &&
        Number.isFinite(value) &&
        (target.min === undefined || value >= target.min) &&
        (target.max === undefined || value <= target.max)
      );
    });
  const availableForms = forms.filter((form) => form !== "values" || targets.length > 0);

  // Sketch state
  const xRange: AxisRange = prompt.sketchAxes
    ? [prompt.sketchAxes.x.min, prompt.sketchAxes.x.max]
    : [0, 1];
  const yRange: AxisRange = prompt.sketchAxes
    ? [prompt.sketchAxes.y.min, prompt.sketchAxes.y.max]
    : [0, 1];
  const [sketchState, setSketchState] = useState(() => createSketchKeyboardState(xRange, yRange));
  const [sketchAnnouncement, setSketchAnnouncement] = useState("");
  const [isDrawing, setIsDrawing] = useState(false);

  const chosenId = record.choice?.form === "candidate" ? record.choice.candidateId : null;
  const adjudication =
    record.state === "revealed"
      ? adjudicatePrediction({
          choice: record.choice,
          supportedCandidateId: prompt.supportedCandidateId,
        })
      : null;
  const chosen = prompt.candidates.find((c) => c.id === chosenId);
  const showAssumption =
    adjudication?.status === "not-close" &&
    chosen !== undefined &&
    chosen.id !== prompt.supportedCandidateId;
  const pending = record.state === "hidden" || record.state === "predicted";
  // Why the supported relation holds: once the result is shown, whether or not the reader answered.
  const explained =
    record.state === "revealed" ||
    (resultShown && (record.state === "predicted-unrecorded" || record.state === "skipped"));

  // Sketch pointer helpers
  const handleSvgPointerDown = (e: React.PointerEvent<SVGSVGElement>) => {
    if (record.state !== "hidden") return;
    const rect = e.currentTarget.getBoundingClientRect();
    if (rect.width <= 0 || rect.height <= 0) return;
    e.currentTarget.setPointerCapture?.(e.pointerId);
    const px = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    const py = Math.max(0, Math.min(1, 1 - (e.clientY - rect.top) / rect.height));
    const xVal = xRange[0] + px * (xRange[1] - xRange[0]);
    const yVal = yRange[0] + py * (yRange[1] - yRange[0]);

    setIsDrawing(true);
    setSketchState((prev) => ({
      ...prev,
      cursor: [xVal, yVal],
      points:
        prev.points.length < 256
          ? [...prev.points, [xVal, yVal]]
          : [...processSketchPoints(prev.points, { xRange, yRange }), [xVal, yVal]],
    }));
  };

  const handleSvgPointerMove = (e: React.PointerEvent<SVGSVGElement>) => {
    if (!isDrawing || record.state !== "hidden") return;
    const rect = e.currentTarget.getBoundingClientRect();
    if (rect.width <= 0 || rect.height <= 0) return;
    const px = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    const py = Math.max(0, Math.min(1, 1 - (e.clientY - rect.top) / rect.height));
    const xVal = xRange[0] + px * (xRange[1] - xRange[0]);
    const yVal = yRange[0] + py * (yRange[1] - yRange[0]);

    setSketchState((prev) => ({
      ...prev,
      cursor: [xVal, yVal],
      points:
        prev.points.length < 256
          ? [...prev.points, [xVal, yVal]]
          : [...processSketchPoints(prev.points, { xRange, yRange }), [xVal, yVal]],
    }));
  };

  const handleSvgPointerUp = () => {
    setIsDrawing(false);
  };

  const handleCommitSketch = () => {
    const processed = processSketchPoints(sketchState.points, { xRange, yRange });
    if (processed.length > 0) {
      onRecord({ form: "sketch", points: processed });
    }
  };

  const handleCommitVerbal = () => {
    if (selectedDirection && selectedShape) {
      onRecord({ form: "verbal", directionId: selectedDirection, shapeId: selectedShape });
    }
  };

  const handleCommitValues = () => {
    if (!validValues) return;
    const list = targets.map((t) => ({
      targetId: t.targetId,
      value: Number(valueInputs[t.targetId]),
    }));
    onRecord({ form: "values", targets: list });
  };

  return (
    <div
      className="predict-panel"
      data-predict-prompt={prompt.promptId}
      data-predict-state={record.state}
      data-predict-score={adjudication?.status ?? ""}
    >
      <h3>Predict before the numbers</h3>
      <p>{withScripts(prompt.question)}</p>

      {pending && forms.length > 1 && (
        // The chosen format is drawn as an action button and the others as secondary, from the same
        // test as aria-selected. They used an "active" class no stylesheet declares, so every tab
        // drew in the same ink and the choice showed only to a screen reader (live /lab/me-02/).
        <div
          className="predict-mode-tabs"
          role="tablist"
          aria-label={`Prediction format for ${prompt.question}`}
          onKeyDown={(event) => {
            const current = availableForms.indexOf(activeTab);
            const next =
              event.key === "Home"
                ? 0
                : event.key === "End"
                  ? availableForms.length - 1
                  : event.key === "ArrowRight"
                    ? (current + 1) % availableForms.length
                    : event.key === "ArrowLeft"
                      ? (current + availableForms.length - 1) % availableForms.length
                      : -1;
            const form = availableForms[next];
            if (form) {
              event.preventDefault();
              setActiveTab(form);
              document.getElementById(`${controlId}-format-${form}`)?.focus();
            }
          }}
        >
          {offers("candidate") && (
            <button
              type="button"
              role="tab"
              id={`${controlId}-format-candidate`}
              aria-controls={`${controlId}-format-panel`}
              tabIndex={activeTab === "candidate" ? 0 : -1}
              aria-selected={activeTab === "candidate"}
              className={activeTab === "candidate" ? undefined : "secondary"}
              onClick={() => setActiveTab("candidate")}
            >
              Candidate relation
            </button>
          )}
          {offers("sketch") && (
            <button
              type="button"
              role="tab"
              id={`${controlId}-format-sketch`}
              aria-controls={`${controlId}-format-panel`}
              tabIndex={activeTab === "sketch" ? 0 : -1}
              aria-selected={activeTab === "sketch"}
              className={activeTab === "sketch" ? undefined : "secondary"}
              onClick={() => setActiveTab("sketch")}
            >
              Sketch curve
            </button>
          )}
          {offers("verbal") && (
            <button
              type="button"
              role="tab"
              id={`${controlId}-format-verbal`}
              aria-controls={`${controlId}-format-panel`}
              tabIndex={activeTab === "verbal" ? 0 : -1}
              aria-selected={activeTab === "verbal"}
              className={activeTab === "verbal" ? undefined : "secondary"}
              onClick={() => setActiveTab("verbal")}
            >
              Verbal prediction
            </button>
          )}
          {offers("values") && targets.length > 0 && (
            <button
              type="button"
              role="tab"
              id={`${controlId}-format-values`}
              aria-controls={`${controlId}-format-panel`}
              tabIndex={activeTab === "values" ? 0 : -1}
              aria-selected={activeTab === "values"}
              className={activeTab === "values" ? undefined : "secondary"}
              onClick={() => setActiveTab("values")}
            >
              Enter values
            </button>
          )}
        </div>
      )}

      <div
        id={`${controlId}-format-panel`}
        role="tabpanel"
        aria-label={pending && availableForms.length > 1 ? undefined : prompt.question}
        aria-labelledby={
          pending && availableForms.length > 1 ? `${controlId}-format-${activeTab}` : undefined
        }
      >
        {pending && activeTab === "candidate" && (
          <fieldset>
            <legend>Three relations the model could have</legend>
            {prompt.candidates.map((candidate) => (
              <label key={candidate.id} className="check">
                <input
                  type="radio"
                  name={`${controlId}-candidate`}
                  value={candidate.id}
                  disabled={record.state !== "hidden"}
                  checked={chosenId === candidate.id}
                  onChange={() => onRecord({ form: "candidate", candidateId: candidate.id })}
                />{" "}
                {describeCandidates
                  ? `${candidate.label}: ${candidate.description}`
                  : withScripts(candidate.label)}
              </label>
            ))}
          </fieldset>
        )}

        {pending && activeTab === "sketch" && (
          <div className="predict-sketch-pane" data-predict-sketch="">
            <h4>Sketch what you expect to see</h4>
            <p id={`${controlId}-sketch-instructions`}>
              Draw a curve, or use arrow keys to move and Space or Enter to place a point. The saved
              sketch keeps at most 64 points.
            </p>
            {prompt.sketchAxes && (
              <p className="fine" id={`${controlId}-sketch-axes`}>
                Horizontal: {prompt.sketchAxes.x.label}, {xRange[0]} to {xRange[1]}
                {prompt.sketchAxes.x.unit ? ` (${prompt.sketchAxes.x.unit})` : ""}. Vertical:{" "}
                {prompt.sketchAxes.y.label}, {yRange[0]} to {yRange[1]}
                {prompt.sketchAxes.y.unit ? ` (${prompt.sketchAxes.y.unit})` : ""}.
              </p>
            )}

            <div role="status" aria-live="polite" className="sr-only" data-sketch-announcement="">
              {sketchAnnouncement}
            </div>

            <svg
              width={320}
              height={200}
              viewBox="0 0 320 200"
              className="predict-sketch-canvas"
              tabIndex={record.state === "hidden" ? 0 : -1}
              role="application"
              aria-label={`Sketch input area for ${prompt.question}.`}
              aria-describedby={`${controlId}-sketch-instructions${prompt.sketchAxes ? ` ${controlId}-sketch-axes` : ""}`}
              onPointerDown={handleSvgPointerDown}
              onPointerMove={handleSvgPointerMove}
              onPointerUp={handleSvgPointerUp}
              onPointerCancel={handleSvgPointerUp}
              onLostPointerCapture={handleSvgPointerUp}
              onKeyDown={(e) => {
                if (record.state !== "hidden") return;
                if (e.key === "ArrowLeft") {
                  e.preventDefault();
                  setSketchState((s) => {
                    const n = moveSketchCursor(s, -1, 0);
                    setSketchAnnouncement(getSketchStatusAnnouncement(n, "move"));
                    return n;
                  });
                } else if (e.key === "ArrowRight") {
                  e.preventDefault();
                  setSketchState((s) => {
                    const n = moveSketchCursor(s, 1, 0);
                    setSketchAnnouncement(getSketchStatusAnnouncement(n, "move"));
                    return n;
                  });
                } else if (e.key === "ArrowUp") {
                  e.preventDefault();
                  setSketchState((s) => {
                    const n = moveSketchCursor(s, 0, 1);
                    setSketchAnnouncement(getSketchStatusAnnouncement(n, "move"));
                    return n;
                  });
                } else if (e.key === "ArrowDown") {
                  e.preventDefault();
                  setSketchState((s) => {
                    const n = moveSketchCursor(s, 0, -1);
                    setSketchAnnouncement(getSketchStatusAnnouncement(n, "move"));
                    return n;
                  });
                } else if (e.key === " " || e.key === "Enter") {
                  e.preventDefault();
                  setSketchState((s) => {
                    const n = placeSketchPoint(s);
                    setSketchAnnouncement(getSketchStatusAnnouncement(n, "add"));
                    return n;
                  });
                } else if (e.key === "Backspace" || e.key === "u") {
                  e.preventDefault();
                  setSketchState((s) => {
                    const n = undoSketchPoint(s);
                    setSketchAnnouncement(getSketchStatusAnnouncement(n, "undo"));
                    return n;
                  });
                }
              }}
              style={{ border: "1px solid var(--line)", touchAction: "none", cursor: "crosshair" }}
            >
              <path
                d="M0,199 H320 M1,0 V200 M160,0 V200 M0,100 H320"
                fill="none"
                stroke="currentColor"
                strokeWidth="0.5"
                strokeDasharray="2 4"
              />
              {/* Draw polyline */}
              {sketchState.points.length > 1 && (
                <polyline
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeDasharray="4 2"
                  points={sketchState.points
                    .map(([x, y]) => {
                      const sx = ((x - xRange[0]) / (xRange[1] - xRange[0])) * 320;
                      const sy = (1 - (y - yRange[0]) / (yRange[1] - yRange[0])) * 200;
                      return `${sx},${sy}`;
                    })
                    .join(" ")}
                />
              )}
              {/* Draw points */}
              {Array.from(
                new Map(sketchState.points.map((point) => [point.join(","), point])).values(),
              ).map(([x, y]) => {
                const sx = ((x - xRange[0]) / (xRange[1] - xRange[0])) * 320;
                const sy = (1 - (y - yRange[0]) / (yRange[1] - yRange[0])) * 200;
                return (
                  <rect
                    key={`pt-${x}-${y}`}
                    x={sx - 3}
                    y={sy - 3}
                    width={6}
                    height={6}
                    fill="currentColor"
                  />
                );
              })}
              {/* Draw active cursor crosshair */}
              {(() => {
                const cx = ((sketchState.cursor[0] - xRange[0]) / (xRange[1] - xRange[0])) * 320;
                const cy =
                  (1 - (sketchState.cursor[1] - yRange[0]) / (yRange[1] - yRange[0])) * 200;
                return (
                  <circle
                    cx={cx}
                    cy={cy}
                    r="4"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.5"
                  />
                );
              })()}
            </svg>

            {record.state === "hidden" && (
              <div
                className="sketch-controls"
                style={{ display: "flex", gap: "0.5rem", marginTop: "0.5rem" }}
              >
                <button
                  type="button"
                  className="secondary"
                  onClick={() =>
                    setSketchState((s) => {
                      const n = placeSketchPoint(s);
                      setSketchAnnouncement(getSketchStatusAnnouncement(n, "add"));
                      return n;
                    })
                  }
                >
                  Place point
                </button>
                <button
                  type="button"
                  className="secondary"
                  disabled={sketchState.points.length === 0}
                  onClick={() =>
                    setSketchState((s) => {
                      const n = undoSketchPoint(s);
                      setSketchAnnouncement(getSketchStatusAnnouncement(n, "undo"));
                      return n;
                    })
                  }
                >
                  Undo point
                </button>
                <button
                  type="button"
                  className="secondary"
                  disabled={sketchState.points.length === 0}
                  onClick={() =>
                    setSketchState((s) => {
                      const n = clearSketchPoints(s);
                      setSketchAnnouncement(getSketchStatusAnnouncement(n, "clear"));
                      return n;
                    })
                  }
                >
                  Clear
                </button>
                <button
                  type="button"
                  disabled={sketchState.points.length === 0}
                  onClick={handleCommitSketch}
                >
                  Record sketch ({sketchState.points.length} pts)
                </button>
              </div>
            )}
          </div>
        )}

        {pending && activeTab === "verbal" && (
          <fieldset data-predict-verbal="">
            <legend>State the expected direction and shape</legend>
            <div className="verbal-direction-options">
              <strong>Direction:</strong>
              {directions.map((d) => (
                <label key={d.id} className="check">
                  <input
                    type="radio"
                    name={`${controlId}-verbal-direction`}
                    value={d.id}
                    disabled={record.state !== "hidden"}
                    checked={selectedDirection === d.id}
                    onChange={() => setSelectedDirection(d.id)}
                  />{" "}
                  {d.label}
                </label>
              ))}
            </div>
            <div className="verbal-shape-options" style={{ marginTop: "0.5rem" }}>
              <strong>Curve shape:</strong>
              {shapes.map((s) => (
                <label key={s.id} className="check">
                  <input
                    type="radio"
                    name={`${controlId}-verbal-shape`}
                    value={s.id}
                    disabled={record.state !== "hidden"}
                    checked={selectedShape === s.id}
                    onChange={() => setSelectedShape(s.id)}
                  />{" "}
                  {s.label}
                </label>
              ))}
            </div>
            {record.state === "hidden" && (
              <button
                type="button"
                style={{ marginTop: "0.5rem" }}
                disabled={!selectedDirection || !selectedShape}
                onClick={handleCommitVerbal}
              >
                Record verbal prediction
              </button>
            )}
          </fieldset>
        )}

        {pending && activeTab === "values" && targets.length > 0 && (
          <fieldset data-predict-values="">
            <legend>Enter predicted numerical values</legend>
            {targets.map((t) => (
              <div
                key={t.targetId}
                className="predict-target-field"
                style={{ marginBottom: "0.5rem" }}
              >
                <label htmlFor={`${controlId}-val-${t.targetId}`}>
                  {t.label} {t.unit ? `(${t.unit})` : ""}:
                </label>
                <input
                  id={`${controlId}-val-${t.targetId}`}
                  className="predict-target-input"
                  type="number"
                  step="any"
                  required
                  min={t.min}
                  max={t.max}
                  disabled={record.state !== "hidden"}
                  value={valueInputs[t.targetId] ?? ""}
                  onChange={(e) =>
                    setValueInputs((prev) => ({ ...prev, [t.targetId]: e.target.value }))
                  }
                />
              </div>
            ))}
            {record.state === "hidden" && (
              <button type="button" disabled={!validValues} onClick={handleCommitValues}>
                Record values
              </button>
            )}
          </fieldset>
        )}
      </div>

      {record.state === "hidden" ? (
        <div className="preset-list" style={{ marginTop: "1rem" }}>
          {/* THE ACCESSIBLE NAME NAMES ITS PROMPT, because a page may hold several (am-svdj).
              Counted in the built site: of the 58 pages carrying a prediction prompt, 22 carried
              two or three of these controls with IDENTICAL names -- 19 pages with two and 3 with
              three -- so a reader navigating by control name met "Skip prediction" repeatedly with
              nothing to say which prediction it skipped. A sighted reader tells them apart by the
              fieldset above; a control list, a rotor and voice control have only the name.

              `aria-label` rather than visually-hidden text, following the sketch canvas at :311
              which already disambiguates this way in this component. The visible words stay the
              first words of the accessible name, so WCAG 2.5.3 Label in Name holds and a voice
              user saying "Skip prediction" still matches. */}
          <button
            type="button"
            className="secondary"
            onClick={onSkip}
            aria-label={`Skip prediction for ${prompt.question}`}
          >
            Skip prediction
          </button>
          <button
            type="button"
            className="secondary"
            onClick={onKeepToSelf}
            aria-label={`I have one in mind for ${prompt.question}`}
          >
            I have one in mind
          </button>
        </div>
      ) : null}

      {record.state === "predicted" ? (
        <p>
          Prediction recorded. Apply settings to see what the model does. The recorded choice cannot
          be edited after that.
        </p>
      ) : null}

      {record.state === "predicted-unrecorded" ? (
        <p>
          {resultShown
            ? "Nothing was stored. Compare the one you have in mind with the result."
            : "Nothing was stored. Apply settings to see what the model does."}
        </p>
      ) : null}

      {record.state === "cleared" ? (
        <p role="status">
          Prediction cleared. The accepted result remains available, and this prediction is no
          longer included in a shared link.
        </p>
      ) : null}

      {adjudication ? (
        <div data-predict-adjudication={adjudication.status}>
          <p>{adjudication.statement}</p>
          {showAssumption && chosen ? <p>{withScripts(chosen.separatingAssumption)}</p> : null}
          {record.choice?.form === "candidate" ? (
            <p data-predict-original="">
              Recorded prediction: {chosen ? withScripts(chosen.label) : record.choice.candidateId}
            </p>
          ) : null}
          {record.choice?.form === "verbal" ? (
            <p data-predict-original="">
              Recorded prediction: {record.choice.directionId}, {record.choice.shapeId}
            </p>
          ) : null}
          {record.choice?.form === "values" ? (
            <p data-predict-original="">
              Recorded prediction:{" "}
              {record.choice.targets
                .map(
                  (t) =>
                    `${targets.find((target) => target.targetId === t.targetId)?.label ?? t.targetId}: ${t.value}`,
                )
                .join(", ")}
            </p>
          ) : null}
          {record.choice?.form === "sketch" ? (
            <p data-predict-original="">
              Recorded prediction: Sketch with {record.choice.points.length} points
            </p>
          ) : null}
        </div>
      ) : null}

      {prompt.explanation && explained ? (
        <p data-predict-explanation="">{withScripts(prompt.explanation)}</p>
      ) : null}

      {record.state === "revealed" && record.choice !== null ? (
        <fieldset>
          <legend>A later guess, marked as after the result was shown</legend>
          {prompt.candidates.map((candidate) => (
            <label key={`amend-${candidate.id}`} className="check">
              <input
                type="radio"
                name={`${controlId}-amendment`}
                value={candidate.id}
                checked={
                  record.amendment?.choice.form === "candidate" &&
                  record.amendment.choice.candidateId === candidate.id
                }
                onChange={() => onAmend({ form: "candidate", candidateId: candidate.id })}
              />{" "}
              {candidate.label}
            </label>
          ))}
          {record.amendment?.recordedAfterReveal ? (
            <p data-predict-after-the-fact="">
              Recorded after the result was shown. The original prediction is unchanged.
            </p>
          ) : null}
        </fieldset>
      ) : null}

      {reasoningHref ? (
        <p>
          {/* THE THIRD PROMPT CONTROL, named for the same reason as the two above and missed when
              they were fixed. The lane written for am-svdj found it: on /lab/me-02/ and
              /embed/lab/me-02/ this link resolved to two enabled controls named "Show me the
              reasoning", acting on me-02-predict-exact-versus-quadratic and
              me-02-predict-toward-low-speed. Those two are the only pages that render it twice,
              which is why counting only "Skip prediction" and "I have one in mind" reported the
              population as repaired. */}
          <a href={reasoningHref} aria-label={`Show me the reasoning for ${prompt.question}`}>
            Show me the reasoning
          </a>
        </p>
      ) : null}
    </div>
  );
}
