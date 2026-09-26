import type { SourceJump as SourceJumpType } from "../content/schemas/journey.ts";
import "./journeySkeleton.css";

export interface SourceJumpProps {
  readonly jump: SourceJumpType;
}

/**
 * Where the paper makes the step the reader has just made (dispatch 276): a note in the margin with
 * a rule on its leading edge, what the passage does, and a link into it. The weave predicate that
 * lights the passage is the build's, carried as data and not printed.
 */
export function SourceJump({ jump }: SourceJumpProps) {
  const { id, label, paperId, section, targetAnchor, weavePredicateId, pointer } = jump;

  const targetHref = section
    ? `/papers/${paperId}/${section}/#${targetAnchor}`
    : `/papers/${paperId}/#${targetAnchor}`;

  return (
    <div
      id={id}
      className="source-jump"
      data-source-jump-id={id}
      data-target-anchor={targetAnchor}
      data-weave-predicate={weavePredicateId}
    >
      <p className="eyebrow">In the 1905 paper</p>
      <p>{pointer}</p>
      <p>
        <a href={targetHref}>{label} →</a>
      </p>
    </div>
  );
}
