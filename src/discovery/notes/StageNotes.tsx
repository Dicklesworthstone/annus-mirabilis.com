"use client";

import { useId, useState } from "react";
import { NOTE_ATTEMPT_LIMIT, NOTE_TEXT_LIMIT, type NoteAttempt, type NoteManifest } from "../notebook.ts";
import type { NotebookSession } from "../notebookSession.ts";
import { useDiscoveryNotebook, useNotebookView } from "./context.tsx";
import { RecordedAlternative } from "./RecordedAlternative.tsx";

/** Optional private reflection; explanations remain outside this collapsed form. */
export function DiscoveryStageNotes({ stageId, prompt }: { stageId: string; prompt: string }) {
  const notebook = useDiscoveryNotebook();
  if (!notebook) return null;
  return <StageNotes notebook={notebook} stageId={stageId} prompt={prompt} />;
}

function StageNotes({
  notebook,
  stageId,
  prompt,
}: {
  notebook: NonNullable<ReturnType<typeof useDiscoveryNotebook>>;
  stageId: string;
  prompt: string;
}) {
  const { session, manifest, editDraft } = notebook;
  const view = useNotebookView(session);
  const stage = manifest.stages.find((item) => item.id === stageId);
  if (!stage) return null;
  const attempts = view.document.entries.find((entry) => entry.stageId === stageId)?.attempts ?? [];
  return (
    <details className="discovery-stage-notes" data-discovery-stage-notes={stageId}>
      <summary>
        Keep a prediction and observation (optional)
        {attempts.length > 0 ? ` · ${attempts.length} recorded` : ""}
      </summary>
      <p>
        Write what you expect before reading on. Return to add what you noticed. Each recorded
        prediction stays as you wrote it; a new attempt keeps the earlier one.
      </p>
      <p>{prompt}</p>
      <StageNoteForm
        key={view.resetSequence}
        session={session}
        manifest={manifest}
        stage={stage}
        attempts={attempts}
        disabled={!view.ready || view.blocked}
        editDraft={editDraft}
      />
      {view.blocked && (
        <p className="notice">
          {view.message}{" "}
          <a href={`#discovery-notes-${manifest.paper}`}>
            Open the guide’s notes controls to recover a copy.
          </a>
        </p>
      )}
      <p className="discovery-notes-hint">
        Only recorded fields are saved. Drafts disappear when you leave. Nothing is uploaded or
        graded. <a href="/notebook/#discovery-notes">Find your recorded notes in the notebook</a>.
      </p>
      <noscript>
        <p>Recording notes needs JavaScript. All of this guide’s explanations remain readable.</p>
      </noscript>
    </details>
  );
}

function StageNoteForm({
  session,
  manifest,
  stage,
  attempts,
  disabled,
  editDraft,
}: {
  session: NotebookSession;
  manifest: NoteManifest;
  stage: NoteManifest["stages"][number];
  attempts: readonly NoteAttempt[];
  disabled: boolean;
  editDraft(): void;
}) {
  const instance = useId();
  const [prediction, setPrediction] = useState("");
  const [alternativeId, setAlternativeId] = useState("");
  const questions = [...new Set(stage.alternatives.map((alternative) => alternative.question))];
  const [notice, setNotice] = useState("");
  return (
    <>
      <form
        onSubmit={(event) => {
          event.preventDefault();
          if (session.capture(stage.id, prediction, alternativeId || null)) {
            setPrediction("");
            setAlternativeId("");
          }
          setNotice(session.getSnapshot().message);
        }}
      >
        <fieldset disabled={disabled || attempts.length >= NOTE_ATTEMPT_LIMIT}>
          <legend>{attempts.length ? "Record another prediction" : "Your prediction"}</legend>
          {stage.alternatives.length > 0 && (
            <>
              <label htmlFor={`${instance}-proposal`}>Which proposal are you considering?</label>
              <select
                id={`${instance}-proposal`}
                value={alternativeId}
                onChange={(event) => {
                  editDraft();
                  setAlternativeId(event.currentTarget.value);
                  setNotice("");
                }}
              >
                <option value="">Leave the proposal open</option>
                {questions.map((question) => (
                  <optgroup key={question ?? ""} label={question ?? "Proposals"}>
                    {stage.alternatives
                      .filter((alternative) => alternative.question === question)
                      .map((alternative) => (
                        <option key={alternative.id} value={alternative.id}>
                          {alternative.title}
                        </option>
                      ))}
                  </optgroup>
                ))}
              </select>
            </>
          )}
          <label htmlFor={`${instance}-prediction`}>What do you expect, and why?</label>
          <textarea
            id={`${instance}-prediction`}
            rows={3}
            maxLength={NOTE_TEXT_LIMIT}
            value={prediction}
            onChange={(event) => {
              editDraft();
              setPrediction(event.currentTarget.value);
              setNotice("");
            }}
          />
          <button type="submit" disabled={!prediction.trim()}>
            Record this prediction
          </button>
        </fieldset>
      </form>
      {attempts.length >= NOTE_ATTEMPT_LIMIT && (
        <p>
          This step has {NOTE_ATTEMPT_LIMIT} recorded attempts. Export a copy before starting a new
          notebook for this guide.
        </p>
      )}
      {attempts.map((attempt, index) => (
        <RecordedAttempt
          // biome-ignore lint/suspicious/noArrayIndexKey: attempts are append-only; import and reset remount the complete form
          key={`${index}-${attempt.prediction}`}
          attempt={attempt}
          index={index}
          stageId={stage.id}
          manifest={manifest}
          session={session}
          disabled={disabled}
          editDraft={editDraft}
          onNotice={setNotice}
        />
      ))}
      <p role="status" aria-atomic="true" data-discovery-note-notice>
        {notice}
      </p>
    </>
  );
}

function RecordedAttempt({
  attempt,
  index,
  stageId,
  manifest,
  session,
  disabled,
  editDraft,
  onNotice,
}: {
  attempt: NoteAttempt;
  index: number;
  stageId: string;
  manifest: NoteManifest;
  session: NotebookSession;
  disabled: boolean;
  editDraft(): void;
  onNotice(message: string): void;
}) {
  const instance = useId();
  const [observation, setObservation] = useState(attempt.observation);
  return (
    <section className="discovery-note-attempt" aria-label={`Recorded prediction ${index + 1}`}>
      <h3>Recorded prediction {index + 1}</h3>
      <p className="discovery-note-text">{attempt.prediction}</p>
      <RecordedAlternative
        manifest={manifest}
        stageId={stageId}
        alternativeId={attempt.alternativeId}
      />
      <form
        onSubmit={(event) => {
          event.preventDefault();
          session.observe(stageId, index, observation);
          onNotice(session.getSnapshot().message);
        }}
      >
        <fieldset disabled={disabled}>
          <legend>After reading or trying the experiment</legend>
          <label htmlFor={`${instance}-observation`}>
            What did you notice? What changed your thinking?
          </label>
          <textarea
            id={`${instance}-observation`}
            rows={3}
            maxLength={NOTE_TEXT_LIMIT}
            value={observation}
            onChange={(event) => {
              editDraft();
              setObservation(event.currentTarget.value);
              onNotice("");
            }}
          />
          <button type="submit" disabled={observation === attempt.observation}>
            Save this observation
          </button>
        </fieldset>
      </form>
    </section>
  );
}
