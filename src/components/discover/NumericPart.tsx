"use client";

import { type FormEvent, useEffect, useId, useState } from "react";
import "../../discovery/discovery.css";
import {
  checkNumericAnswer,
  type NumericExercisePart,
  type NumericVerdict,
  numericPartProblems,
  unitLabel,
} from "../../discovery/exercises/numeric.ts";

export type { NumericExercisePart } from "../../discovery/exercises/numeric.ts";

/**
 * A numeric exercise part (am-disc-exercise-checker-i4h2): a value, a unit chosen from a list, and
 * a check against a reference computed at build time. The answer stays in the page's memory and is
 * never sent anywhere; the worked explanation is available before and after any check.
 */
export function NumericPart({ part }: { part: NumericExercisePart }) {
  const id = useId();
  const [value, setValue] = useState("");
  const [unit, setUnit] = useState(part.units[0] ?? "");
  const [verdict, setVerdict] = useState<NumericVerdict | null>(null);
  const [ready, setReady] = useState(false);
  useEffect(() => setReady(true), []);

  if (numericPartProblems(part).length > 0)
    return (
      <p className="notice" role="alert">
        This exercise is unavailable because its settings are invalid.
      </p>
    );

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setVerdict(checkNumericAnswer(part, value, unit));
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
        <label htmlFor={`${id}-value`}>Your answer</label>
        <div className="exercise-number">
          <input
            id={`${id}-value`}
            type="text"
            inputMode="decimal"
            autoComplete="off"
            spellCheck={false}
            maxLength={64}
            disabled={!ready}
            value={value}
            aria-invalid={verdict?.kind === "input-error" || undefined}
            onChange={(event) => {
              setValue(event.target.value);
              setVerdict(null);
            }}
          />
          <select
            aria-label="Unit"
            disabled={!ready}
            value={unit}
            onChange={(event) => {
              setUnit(event.target.value);
              setVerdict(null);
            }}
          >
            {part.units.map((u) => (
              <option key={u} value={u}>
                {unitLabel(u)}
              </option>
            ))}
          </select>
        </div>
        <button type="submit" disabled={!ready}>
          Check
        </button>
      </form>
      {verdict && (
        <div className="exercise-verdict" role="status">
          <p>{verdict.message}</p>
        </div>
      )}
      <details className="exercise-worked">
        <summary>Show a worked explanation</summary>
        <p>{part.workedExplanation}</p>
        <p>{part.toleranceReason}</p>
      </details>
    </div>
  );
}
