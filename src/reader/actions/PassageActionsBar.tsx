import { FoundationLink } from "../Blocks.tsx";
import { faceLinkHref } from "../paperRoutes.ts";
import { LAB_NAMES } from "./labNames.ts";
import { ObstacleMenu } from "./ObstacleMenu.tsx";
import type { PassageActions } from "./passageActions.schema.ts";

/*
  ONE LINK PER LESSON. The three help actions each name a foundation lesson, and on 36 of the
  42 argument records all three name the same one: light quanta's allocation passage offered
  "Why?", "Show the missing step" and "Show me one example first", and all three opened
  /foundations/integration/. Three promises, one page. A slot that repeats a lesson an earlier
  slot already offers is not rendered, so each label that shows leads somewhere its neighbours
  do not. Every lesson stays one tap away, under the first label (in the plan's order) that
  names it; a record that authors three different lessons still shows all three labels.
*/
const HELP_ACTIONS = [
  ["why", "Why?"],
  ["missingStep", "Show the missing step"],
  ["example", "Show me one example first"],
] as const;

export function distinctHelpActions(
  actions: PassageActions,
): readonly { readonly foundationId: string; readonly title: string }[] {
  const offered = new Set<string>();
  return HELP_ACTIONS.flatMap(([slot, title]) => {
    const foundationId = actions[slot];
    if (!foundationId || offered.has(foundationId)) return [];
    offered.add(foundationId);
    return [{ foundationId, title }];
  });
}

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
  const tryItLabel =
    actions.tryIt?.kind === "instrument"
      ? (actions.tryIt.label ?? LAB_NAMES[actions.tryIt.instrumentId] ?? actions.tryIt.instrumentId)
      : undefined;

  return (
    <>
      <nav className="passage-actions" aria-label={`Actions for ${passageLabel}`}>
        {distinctHelpActions(actions).map(({ foundationId, title }) => (
          <FoundationLink
            key={title}
            id={foundationId}
            title={title}
            caption={`Return to ${passageLabel}.`}
            ariaLabel={`${title}: ${passageLabel}`}
          />
        ))}
        {actions.tryIt?.kind === "instrument" ? (
          <a href={`/lab/${actions.tryIt.instrumentId}/`} aria-label={`Try it: ${tryItLabel}`}>
            Try it
          </a>
        ) : null}
        {actions.tryIt?.kind === "static" ? (
          <a
            href={`#${actions.tryIt.staticExampleId}`}
            aria-label={`Try it: ${actions.tryIt.label ?? `static worked example for ${passageLabel}`}`}
          >
            Try it: static worked example
          </a>
        ) : null}
        {actions.original ? (
          <a
            href={`${faceLinkHref(paperId, "german")}#${passageId}`}
            aria-label={`Read the original German: ${passageLabel}`}
          >
            Read the original
          </a>
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
          Copy a link
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
