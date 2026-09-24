import "../../discovery/discovery.css";
import {
  type ExplanationExercisePart,
  explanationOutcome,
} from "../../discovery/exercises/explanation.ts";

export type { ExplanationExercisePart } from "../../discovery/exercises/explanation.ts";

/**
 * A question answered in the reader's own words (am-disc-exercise-checker-i4h2). A server
 * component on purpose: the page ships no code for it, so nothing can read, mark or send what the
 * reader writes, and all of it works without JavaScript. The comparison is a disclosure the reader
 * opens when ready; its outcome is always "needs-human-reading".
 */
export function ExplanationPart({ part }: { part: ExplanationExercisePart }) {
  const outcome = explanationOutcome(part);
  if (outcome.kind === "invalid")
    return (
      <p className="notice" role="alert">
        This exercise is unavailable because its settings are invalid.
      </p>
    );
  const box = `explanation-${part.id}`;
  return (
    <div className="exercise-part" data-exercise-part={part.id} data-outcome={outcome.kind}>
      <p className="exercise-prompt">{part.prompt}</p>
      <label htmlFor={box}>Your explanation</label>
      <p className="exercise-prompt" id={`${box}-note`}>
        What you write stays in this box. Nothing on the page reads it, marks it or sends it
        anywhere, and it is gone when you leave.
      </p>
      <textarea
        id={box}
        className="exercise-explanation"
        rows={5}
        aria-describedby={`${box}-note`}
      />
      <details className="exercise-worked">
        <summary>Compare with a worked explanation</summary>
        <p>{outcome.sentence}</p>
        <ul>
          {outcome.criteria.map((criterion) => (
            <li key={criterion}>{criterion}</li>
          ))}
        </ul>
        <p>{part.workedExplanation}</p>
      </details>
    </div>
  );
}
