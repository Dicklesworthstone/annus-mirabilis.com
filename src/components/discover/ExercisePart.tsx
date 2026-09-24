"use client";

import { type FormEvent, useEffect, useId, useRef, useState } from "react";
import "../../discovery/discovery.css";
import {
  type AnswerVerdict,
  checkExerciseAnswer,
  type ExpressionExercisePart,
  exerciseDefinitionKey,
} from "../../discovery/exercises/answer.ts";
import { Sci } from "../lab/Sci.tsx";

export type { ExpressionExercisePart } from "../../discovery/exercises/answer.ts";

/** A changed computational definition remounts the form instead of relabelling its verdict. */
export function ExercisePart({ part }: { part: ExpressionExercisePart }) {
  let key: string;
  try {
    key = exerciseDefinitionKey(part);
  } catch {
    return (
      <p className="notice" role="alert">
        This exercise is unavailable because its settings are invalid.
      </p>
    );
  }
  return <ExerciseForm key={key} part={part} />;
}

function ExerciseForm({ part }: { part: ExpressionExercisePart }) {
  const id = useId();
  const epoch = useRef(0);
  const [draft, setDraft] = useState("");
  const [verdict, setVerdict] = useState<AnswerVerdict | null>(null);
  const [ready, setReady] = useState(false);
  const [pending, setPending] = useState(false);
  useEffect(() => {
    setReady(true);
    return () => {
      epoch.current++;
    };
  }, []);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const request = ++epoch.current;
    setVerdict(null);
    setPending(true);
    const result = await checkExerciseAnswer(part, draft);
    if (request !== epoch.current) return;
    setVerdict(result);
    setPending(false);
  }

  return (
    <div className="exercise-part" data-exercise-part={part.id}>
      <p className="exercise-prompt">{part.prompt}</p>
      <noscript>
        <p className="notice">
          Checking your answer needs JavaScript. The worked explanation below still works.
        </p>
      </noscript>
      <form onSubmit={submit} className="exercise-form enhanced-only" aria-busy={pending}>
        <label htmlFor={`${id}-answer`}>
          Your answer, using {part.declaredNames.join(", ") || "numbers"}
        </label>
        <input
          id={`${id}-answer`}
          type="text"
          inputMode="text"
          autoComplete="off"
          spellCheck={false}
          maxLength={200}
          disabled={!ready}
          value={draft}
          aria-invalid={verdict?.kind === "parse-error" || undefined}
          aria-describedby={verdict?.kind === "parse-error" ? `${id}-error` : undefined}
          onChange={(event) => {
            epoch.current++;
            setDraft(event.target.value);
            setVerdict(null);
            setPending(false);
          }}
        />
        <button type="submit" disabled={!ready || pending}>
          Check
        </button>
      </form>
      {pending && <p role="status">Checking the submitted expression…</p>}
      {verdict?.kind === "parse-error" && (
        <p id={`${id}-error`} className="exercise-error" role="alert">
          At position {verdict.position}: {verdict.message}
        </p>
      )}
      {verdict?.kind === "dimension" && (
        <div className="exercise-verdict" role="status">
          <p>
            Read as <code>{verdict.readAs}</code>
          </p>
          <p>{verdict.message}</p>
        </div>
      )}
      {verdict?.kind === "checked" && (
        <div className="exercise-verdict" role="status">
          {verdict.readAs && (
            <p>
              Read as <code>{verdict.readAs}</code>
            </p>
          )}
          {verdict.outcome.status === "equivalent" && <p>{verdict.outcome.label}</p>}
          {verdict.outcome.status === "not-equivalent" && (
            <p>
              Not equivalent. At{" "}
              {Object.entries(verdict.outcome.point).length === 0
                ? "the constant input"
                : Object.entries(verdict.outcome.point).map(([name, value], i) => (
                    <span key={name}>
                      {i > 0 ? ", " : ""}
                      {name} = <Sci value={value} digits={5} />
                    </span>
                  ))}
              , your expression gives <Sci value={verdict.outcome.readerValue} digits={5} /> and the
              reference gives <Sci value={verdict.outcome.referenceValue} digits={5} />.
            </p>
          )}
          {verdict.outcome.status === "could-not-compare" && (
            <p>Could not compare: {verdict.outcome.reason}</p>
          )}
        </div>
      )}
      <details className="exercise-worked">
        <summary>Show a worked explanation</summary>
        <p>{part.workedExplanation}</p>
      </details>
    </div>
  );
}
