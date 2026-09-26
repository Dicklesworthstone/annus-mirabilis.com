import { FORK_VARIES_EXPLANATIONS, type Fork as ForkType } from "../content/schemas/journey.ts";
import { Branch } from "./Branch.tsx";
import "./journeySkeleton.css";

export interface ForkProps {
  readonly fork: ForkType;
}

const WAYS = ["", "One way on", "Two ways on", "Three ways on", "Four ways on", "Five ways on"];

/**
 * A point where the route divides (dispatch 276): the question, what the branches vary, and the
 * branches side by side. The fork itself draws no box; each branch is the one container
 * (journeySkeleton.css), and the eyebrow counts the ways in words rather than stamping a
 * framework name in red.
 */
export function Fork({ fork }: ForkProps) {
  const { id, afterStageId, question, varies, branches } = fork;
  const variesExplanation = FORK_VARIES_EXPLANATIONS[varies] ?? `Varies: ${varies}`;

  return (
    <section
      id={id}
      className="journey-fork"
      data-fork-id={id}
      data-after-stage-id={afterStageId}
      data-varies={varies}
    >
      <p className="eyebrow">{WAYS[branches.length] ?? `${branches.length} ways on`}</p>
      <h3>{question}</h3>
      <p className="fine">{variesExplanation}</p>
      <div className="journey-branches">
        {branches.map((branch) => (
          <Branch key={branch.id} branch={branch} variesKind={varies} />
        ))}
      </div>
    </section>
  );
}
