"use client";
import { adjudicatePrediction } from "../../experiments/predict/predictAdjudication.ts";
import type {
  PredictionChoice,
  PredictPromptRecord,
} from "../../experiments/predict/predictState.ts";

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
}>;

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
  return (
    <div
      className="predict-panel"
      data-predict-prompt={prompt.promptId}
      data-predict-state={record.state}
      data-predict-score={adjudication?.status ?? ""}
    >
      <h3>Predict before the numbers</h3>
      <p>{prompt.question}</p>
      {pending ? (
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
      ) : null}
      {record.state === "hidden" ? (
        <div className="preset-list">
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
