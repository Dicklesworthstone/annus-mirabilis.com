import {
  type Branch as BranchType,
  type ForkVariesKind,
  OUTCOME_TYPE_LABELS,
} from "../content/schemas/journey.ts";
import "./journeySkeleton.css";

export interface BranchProps {
  readonly branch: BranchType;
  readonly variesKind?: ForkVariesKind | undefined;
}

/**
 * A knowledge card's anchor on the page. KnowledgeCardView and CardDetail anchor a card as
 * "card-<id>", and a proponent names the card by its id, so the link adds the prefix. An id that
 * already carries it (the framework's fixtures write "card-exner-1900") is left as it is.
 */
export function cardAnchor(cardId: string): string {
  return cardId.startsWith("card-") ? cardId : `card-${cardId}`;
}

/**
 * One way on from a fork (dispatch 276), the fork's one container: its name, who held it, the
 * idea and where it holds, its steps, and where it leads. The parts inside are text, not boxes,
 * and none is drawn in the accent: a dead end is said in words, and the links are ordinary links.
 * A step's lab preset id is a name for the build and is not printed.
 */
export function Branch({ branch }: BranchProps) {
  const { id, label, proponent, hypothesis, worksWhen, steps, outcome } = branch;

  return (
    <article
      id={id}
      className="journey-branch"
      data-branch-id={id}
      data-outcome-type={outcome.type}
    >
      <h4>{label}</h4>
      {proponent ? (
        <p className="fine">
          Held by <a href={`#${cardAnchor(proponent.cardId)}`}>{proponent.name}</a>
        </p>
      ) : null}
      <p className="fine journey-branch-kind">
        {OUTCOME_TYPE_LABELS[outcome.type] ?? outcome.type}
      </p>

      <dl>
        <dt>Hypothesis</dt>
        <dd>{hypothesis}</dd>
        <dt>Where it holds</dt>
        <dd>{worksWhen}</dd>
      </dl>

      {steps && steps.length > 0 ? (
        <details>
          <summary className="fine">Its steps ({steps.length})</summary>
          <ol>
            {steps.map((step) => (
              <li key={`${id}-step-${step.presetId ?? step.text}`}>{step.text}</li>
            ))}
          </ol>
        </details>
      ) : null}

      <p>{outcome.plainLanguage}</p>
      {outcome.constraintRef ? (
        <p className="fine">
          It fails against{" "}
          {/* The constraint is a card on the page, anchored as proponents' cards are. */}
          <a href={`#${cardAnchor(outcome.constraintRef)}`}>the measurement on the shelf</a>.
        </p>
      ) : null}
      {outcome.scopeNote ? (
        <p className="fine">Where it gives the same numbers: {outcome.scopeNote}</p>
      ) : null}
      {outcome.insufficiency ? (
        <p className="fine">Why the 1904 shelf cannot decide: {outcome.insufficiency}</p>
      ) : null}
      {outcome.whatWouldDecide ? (
        <p className="fine">
          The measurement that bears on it:{" "}
          {/* The record is a card on the page, anchored as proponents' cards are. */}
          <a href={`#${cardAnchor(outcome.whatWouldDecide.recordId)}`}>
            {outcome.whatWouldDecide.name}
          </a>
          {outcome.whatWouldDecide.year ? ` (${outcome.whatWouldDecide.year})` : null}
        </p>
      ) : null}
    </article>
  );
}
