"use client";

import { type FormEvent, useId, useState } from "react";
import { checkEquivalence, type EquivalenceOutcome } from "../../discovery/exercises/equivalence";
import { parse } from "../../discovery/exercises/grammar";
import { normalize } from "../../discovery/exercises/normalize";
import type { Domain } from "../../discovery/exercises/samplePoints";
import type { ToleranceSpec } from "../../units/tolerance";

export interface ExpressionExercisePart {
  readonly id: string;
  readonly prompt: string;
  /** Variables and constants this part declares; the only identifiers an answer may use. */
  readonly declaredNames: readonly string[];
  readonly domains: Readonly<Record<string, Domain>>;
  /** The reference expression's source text, in the same grammar the reader types in. */
  readonly referenceSource: string;
  readonly tolerance: ToleranceSpec;
  readonly workedExplanation: string;
}

type Verdict =
  | Readonly<{ kind: "parse-error"; position: number; message: string }>
  | Readonly<{ kind: "checked"; outcome: EquivalenceOutcome }>;

function checkAnswer(part: ExpressionExercisePart, rawInput: string): Verdict {
  const normalized = normalize(rawInput);
  if (!normalized.ok)
    return { kind: "parse-error", position: normalized.position, message: normalized.message };
  const names = new Set(part.declaredNames);
  const reader = parse(normalized.text, names);
  if (!reader.ok)
    return { kind: "parse-error", position: reader.position, message: reader.message };
  const reference = parse(part.referenceSource, names);
  if (!reference.ok) {
    throw new Error(
      `This exercise's own reference expression fails to parse: ${reference.message}`,
    );
  }
  const outcome = checkEquivalence(reader.expr, reference.expr, part.domains, part.tolerance);
  return { kind: "checked", outcome };
}

export function ExercisePart({ part }: { part: ExpressionExercisePart }) {
  const id = useId();
  const [draft, setDraft] = useState("");
  const [verdict, setVerdict] = useState<Verdict | null>(null);

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setVerdict(checkAnswer(part, draft));
  }

  return (
    <div className="exercise-part" data-exercise-part={part.id}>
      <p className="exercise-prompt">{part.prompt}</p>

      <noscript>
        <p className="notice">
          Checking your answer needs JavaScript. The worked explanation below still works.
        </p>
      </noscript>

      <form onSubmit={submit} className="exercise-form enhanced-only">
        <label htmlFor={`${id}-answer`}>Your answer, using {part.declaredNames.join(", ")}</label>
        <input
          id={`${id}-answer`}
          type="text"
          inputMode="text"
          autoComplete="off"
          spellCheck={false}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
        />
        <button type="submit">Check</button>
      </form>

      {verdict?.kind === "parse-error" && (
        <p className="exercise-error" role="alert">
          At position {verdict.position}: {verdict.message}
        </p>
      )}

      {verdict?.kind === "checked" && (
        <div className="exercise-verdict" role="status" aria-live="polite">
          {verdict.outcome.status === "equivalent" && <p>{verdict.outcome.label}</p>}
          {verdict.outcome.status === "not-equivalent" && (
            <p>
              Not equivalent. At{" "}
              {Object.entries(verdict.outcome.point)
                .map(([name, value]) => `${name} = ${value.toPrecision(6)}`)
                .join(", ")}
              , your expression gives {verdict.outcome.readerValue.toPrecision(6)} and the reference
              gives {verdict.outcome.referenceValue.toPrecision(6)}.
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
