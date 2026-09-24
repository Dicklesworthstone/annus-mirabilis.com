"use client";

import { type FormEvent, useEffect, useId, useRef, useState } from "react";
import "../../discovery/discovery.css";
import {
  type AnswerVerdict,
  checkExerciseAnswer,
  type ExpressionExercisePart,
  exerciseRenderKey,
  NEXT_ACTION,
} from "../../discovery/exercises/answer.ts";
import type { DomainProbeOutcome } from "../../discovery/exercises/domainProbe.ts";
import { Sci } from "../lab/Sci.tsx";

export type { ExpressionExercisePart } from "../../discovery/exercises/answer.ts";

/** A changed computational definition remounts the form instead of relabelling its verdict. */
export function ExercisePart({ part }: { part: ExpressionExercisePart }) {
  let key: string;
  try {
    key = exerciseRenderKey(part);
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
      <CheckedRanges domains={part.domains} />
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
      {verdict?.kind === "unsupported-expression" && (
        <div className="exercise-verdict" role="status">
          <p>{verdict.message}</p>
          <p>{verdict.nextAction}</p>
        </div>
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
          {verdict.probe && <ProbeNote probe={verdict.probe} />}
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
            <>
              <p>
                The checker could not compare your answer with the reference.{" "}
                {verdict.outcome.reason}
              </p>
              <p>{NEXT_ACTION["could-not-compare"]}</p>
            </>
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

/**
 * Where an agreement stops, drawn as ordinary prose under the verdict, which stays "equivalent".
 * Agreement at every probe point adds nothing; a probe that could not run says so, so a missing
 * note is never read as agreement everywhere.
 */
function ProbeNote({ probe }: { probe: DomainProbeOutcome }) {
  if (probe.kind === "agrees") return null;
  if (probe.kind === "probe-not-available") return <p>{probe.reason}</p>;
  return (
    <p>
      {probe.segments.map((segment, i) =>
        typeof segment === "string" ? (
          // biome-ignore lint/suspicious/noArrayIndexKey: a fixed sentence; segments never reorder
          <span key={i}>{segment}</span>
        ) : (
          // biome-ignore lint/suspicious/noArrayIndexKey: a fixed sentence; segments never reorder
          <Sci key={i} value={segment.number} />
        ),
      )}
    </p>
  );
}

/** A range end drawn plainly: 100 stays 100, and 1e-14 is drawn as a power of ten. */
function RangeEnd({ value }: { value: number }) {
  if (Number.isInteger(value) && Math.abs(value) < 1e6)
    return <>{String(value).replace("-", "\u2212")}</>;
  return <Sci value={value} />;
}

/**
 * The ranges the checker compares over, stated where the reader answers, because a verdict that
 * says "in the stated ranges" has to have stated them. Rendered without JavaScript too.
 */
function CheckedRanges({ domains }: { domains: ExpressionExercisePart["domains"] }) {
  const names = Object.keys(domains);
  if (names.length === 0) return null;
  return (
    <p className="exercise-prompt">
      Answers are compared for{" "}
      {names.map((name, i) => {
        const domain = domains[name];
        if (!domain) return null;
        return (
          <span key={name}>
            {i === 0 ? "" : i === names.length - 1 ? " and " : ", "}
            {name} from <RangeEnd value={domain.min} /> to <RangeEnd value={domain.max} />
          </span>
        );
      })}
      .
    </p>
  );
}
