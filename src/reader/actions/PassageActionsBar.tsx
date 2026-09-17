import { FoundationLink } from "../Blocks.tsx";
import { faceLinkHref } from "../paperRoutes.ts";
import { ObstacleMenu } from "./ObstacleMenu.tsx";
import type { PassageActions } from "./passageActions.schema.ts";

export function PassageActionsBar({
  paperId,
  passageId,
  passageLabel,
  actions,
}: {
  paperId: string;
  passageId: string;
  passageLabel: string;
  actions: PassageActions;
}) {
  const defaultLink = `/papers/${paperId}/#${passageId}`;
  return (
    <>
      <nav className="passage-actions" aria-label={`Actions for ${passageLabel}`}>
        {actions.why ? (
          <FoundationLink id={actions.why} title="Why?" caption={`Return to ${passageLabel}.`} />
        ) : null}
        {actions.missingStep ? (
          <FoundationLink
            id={actions.missingStep}
            title="Show the missing step"
            caption={`Return to ${passageLabel}.`}
          />
        ) : null}
        {actions.example ? (
          <FoundationLink
            id={actions.example}
            title="Show me one example first"
            caption={`Return to ${passageLabel}.`}
          />
        ) : null}
        {actions.tryIt?.kind === "instrument" ? (
          <a href={`/lab/${actions.tryIt.instrumentId}/`}>Try it</a>
        ) : null}
        {actions.tryIt?.kind === "static" ? (
          <a href={`#${actions.tryIt.staticExampleId}`}>Try it: static worked example</a>
        ) : null}
        {actions.original ? (
          <a href={`${faceLinkHref(paperId, "german")}#${passageId}`}>Read the original</a>
        ) : null}
        <a
          href={defaultLink}
          data-passage-canonical-link
          aria-label={`Copy a link to this passage: ${passageLabel}`}
        >
          Link to this passage
        </a>
        <button
          type="button"
          className="secondary enhanced-only"
          data-copy-passage={passageId}
          data-passage-label={passageLabel}
          aria-label={`Copy a link to this passage: ${passageLabel}`}
        >
          Copy a link to this passage
        </button>
      </nav>
      <ObstacleMenu
        responses={actions.obstacleResponses}
        passageLabel={passageLabel}
        hard={actions.hard}
        passageId={passageId}
      />
    </>
  );
}
