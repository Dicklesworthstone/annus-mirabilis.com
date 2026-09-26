import type { PpeTask as PpeTaskType } from "../content/schemas/journey.ts";
import "./journeySkeleton.css";

export interface PpeTaskProps {
  readonly task: PpeTaskType;
}

/**
 * The reader's own try (dispatch 276): predict, change one thing, then explain, in that order.
 * One container, a rule on its leading edge as an aside callout has (journeySkeleton.css); the
 * three asks are an ordered list, not boxes, and nothing is in the accent. The framework's name for
 * the task, "Predict · Perturb · Explain", is not shown: the heading says it in the reader's words.
 */
export function PpeTask({ task }: PpeTaskProps) {
  const { promptId, task: taskPrompt, perturbPrompt, explainPrompt } = task;

  return (
    <section id={promptId} className="journey-ppe" data-ppe-task-id={promptId}>
      <h3>Predict, change one thing, then explain</h3>
      <ol>
        <li>
          <p className="eyebrow">Predict</p>
          <p>{taskPrompt}</p>
        </li>
        <li>
          <p className="eyebrow">Change one thing</p>
          <p>{perturbPrompt}</p>
        </li>
        <li>
          <p className="eyebrow">Explain</p>
          <p>{explainPrompt}</p>
        </li>
      </ol>
    </section>
  );
}
