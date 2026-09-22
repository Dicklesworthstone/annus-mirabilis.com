"use client";

import { useState } from "react";
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

export function PredictPanel({
  prompt,
  record,
  onRecord,
  onSkip,
  onKeepToSelf,
  onAmend,
}: {
  prompt: PredictPanelPrompt;
  record: PredictPromptRecord;
  onRecord: (choice: PredictionChoice) => void;
  onSkip: () => void;
  onKeepToSelf: () => void;
  onAmend: (choice: PredictionChoice) => void;
}) {
  const [activeTab, setActiveTab] = useState<PredictionFormTab>("candidate");

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

  // Sketch pointer helpers
  const handleSvgPointerDown = (e: React.PointerEvent<SVGSVGElement>) => {
    if (record.state !== "hidden") return;
    const rect = e.currentTarget.getBoundingClientRect();
    const px = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    const py = Math.max(0, Math.min(1, 1 - (e.clientY - rect.top) / rect.height));
    const xVal = xRange[0] + px * (xRange[1] - xRange[0]);
    const yVal = yRange[0] + py * (yRange[1] - yRange[0]);

    setIsDrawing(true);
    setSketchState((prev) => ({
      ...prev,
      cursor: [xVal, yVal],
      points: [...prev.points, [xVal, yVal]],
    }));
  };

  const handleSvgPointerMove = (e: React.PointerEvent<SVGSVGElement>) => {
    if (!isDrawing || record.state !== "hidden") return;
    const rect = e.currentTarget.getBoundingClientRect();
    const px = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    const py = Math.max(0, Math.min(1, 1 - (e.clientY - rect.top) / rect.height));
    const xVal = xRange[0] + px * (xRange[1] - xRange[0]);
    const yVal = yRange[0] + py * (yRange[1] - yRange[0]);

    setSketchState((prev) => ({
      ...prev,
      cursor: [xVal, yVal],
      points: [...prev.points, [xVal, yVal]],
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
    const list = targets.map((t) => ({
      targetId: t.targetId,
      value: parseFloat(valueInputs[t.targetId] || "0"),
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
      <p>{prompt.question}</p>

      {pending && (
        <div className="predict-mode-tabs" role="tablist" aria-label="Prediction format">
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === "candidate"}
            className={activeTab === "candidate" ? "active" : ""}
            onClick={() => setActiveTab("candidate")}
          >
            Candidate relation
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === "sketch"}
            className={activeTab === "sketch" ? "active" : ""}
            onClick={() => setActiveTab("sketch")}
          >
            Sketch curve
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === "verbal"}
            className={activeTab === "verbal" ? "active" : ""}
            onClick={() => setActiveTab("verbal")}
          >
            Verbal prediction
          </button>
          {targets.length > 0 && (
            <button
              type="button"
              role="tab"
              aria-selected={activeTab === "values"}
              className={activeTab === "values" ? "active" : ""}
              onClick={() => setActiveTab("values")}
            >
              Enter values
            </button>
          )}
        </div>
      )}

      {pending && activeTab === "candidate" && (
        <fieldset>
          <legend>Three relations the model could have</legend>
          {prompt.candidates.map((candidate) => (
            <label key={candidate.id} className="check">
              <input
                type="radio"
                name={`${prompt.promptId}-candidate`}
                value={candidate.id}
                disabled={record.state !== "hidden"}
                checked={chosenId === candidate.id}
                onChange={() => onRecord({ form: "candidate", candidateId: candidate.id })}
              />{" "}
              {candidate.label}: {candidate.description}
            </label>
          ))}
        </fieldset>
      )}

      {pending && activeTab === "sketch" && (
        <div className="predict-sketch-pane" data-predict-sketch="">
          <h4>Sketch what you expect to see</h4>
          <p id={`${prompt.promptId}-sketch-instructions`}>
            Draw on the canvas or use arrow keys to navigate and Space/Enter to place points. Max 64
            points.
          </p>

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
            aria-describedby={`${prompt.promptId}-sketch-instructions`}
            onPointerDown={handleSvgPointerDown}
            onPointerMove={handleSvgPointerMove}
            onPointerUp={handleSvgPointerUp}
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
            {sketchState.points.map(([x, y]) => {
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
              const cy = (1 - (sketchState.cursor[1] - yRange[0]) / (yRange[1] - yRange[0])) * 200;
              return (
                <circle cx={cx} cy={cy} r="4" fill="none" stroke="currentColor" strokeWidth="1.5" />
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
                  name={`${prompt.promptId}-verbal-direction`}
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
                  name={`${prompt.promptId}-verbal-shape`}
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
              className="predict-target-input"
              style={{ marginBottom: "0.5rem" }}
            >
              <label htmlFor={`${prompt.promptId}-val-${t.targetId}`}>
                {t.label} {t.unit ? `(${t.unit})` : ""}:
              </label>
              <input
                id={`${prompt.promptId}-val-${t.targetId}`}
                type="number"
                step="any"
                disabled={record.state !== "hidden"}
                value={valueInputs[t.targetId] ?? ""}
                onChange={(e) =>
                  setValueInputs((prev) => ({ ...prev, [t.targetId]: e.target.value }))
                }
              />
            </div>
          ))}
          {record.state === "hidden" && (
            <button type="button" onClick={handleCommitValues}>
              Record values
            </button>
          )}
        </fieldset>
      )}

      {record.state === "hidden" ? (
        <div className="preset-list" style={{ marginTop: "1rem" }}>
          <button type="button" className="secondary" onClick={onSkip}>
            Skip prediction
          </button>
          <button type="button" className="secondary" onClick={onKeepToSelf}>
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
        <p>Nothing was stored. Apply settings to see what the model does.</p>
      ) : null}

      {adjudication ? (
        <div data-predict-adjudication={adjudication.status}>
          <p>{adjudication.statement}</p>
          {showAssumption && chosen ? <p>{chosen.separatingAssumption}</p> : null}
          {record.choice?.form === "candidate" ? (
            <p data-predict-original="">
              Recorded prediction: {chosen?.label ?? record.choice.candidateId}
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
              {record.choice.targets.map((t) => `${t.targetId}=${t.value}`).join(", ")}
            </p>
          ) : null}
          {record.choice?.form === "sketch" ? (
            <p data-predict-original="">
              Recorded prediction: Sketch with {record.choice.points.length} points
            </p>
          ) : null}
        </div>
      ) : null}

      {record.state === "revealed" && record.choice !== null ? (
        <fieldset>
          <legend>A later guess, marked as after the result was shown</legend>
          {prompt.candidates.map((candidate) => (
            <label key={`amend-${candidate.id}`} className="check">
              <input
                type="radio"
                name={`${prompt.promptId}-amendment`}
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

      <p>
        <a href="#coefficient-argument">Show me the reasoning</a>
      </p>
    </div>
  );
}
