import type { JourneyMove } from "../content/schemas/journey.ts";
import "./journeySkeleton.css";

export interface MoveMarkerProps {
  readonly move: JourneyMove;
  /**
   * Where the marked step opens in the reading face. Given, the marker links there in words; the
   * chain and step ids are for the build, and a reader cannot use them, so without a link it
   * names none.
   */
  readonly href?: string | undefined;
}

/**
 * The one non-obvious step of a journey, named as the move (dispatch 276): its label, what it does
 * in plain words, and where the paper makes it. The summary's review state is a record, kept with
 * the journey, and not shown (D-2026-09-25-no-review-status-banners). It is a callout in the site's
 * construction, a quiet field with a rule on its leading edge (journeySkeleton.css), not an accent
 * box: the accent marks where a reader is, and a box drawn in it reads as an error.
 */
export function MoveMarker({ move, href }: MoveMarkerProps) {
  const { label, r0Summary } = move;
  return (
    <aside data-move-marker className="move-marker" aria-label={`The move: ${label}`}>
      <p className="eyebrow">The move</p>
      <h3>{label}</h3>
      <p>{r0Summary.text}</p>
      {href ? (
        <p className="fine">
          <a href={href}>Open this step in the derivation</a>
        </p>
      ) : null}
    </aside>
  );
}
