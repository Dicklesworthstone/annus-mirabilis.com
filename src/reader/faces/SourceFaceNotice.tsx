/**
 * The persistent label on a German source face that is not a reviewed text.
 *
 * am-dl4n criterion 2, requirement 1: the notice is not dismissible and does not scroll
 * away from the text it qualifies. A label a reader passes once and never sees again is
 * not a label on the content.
 *
 * WHY STICKY AND NOT REPEATED. A notice repeated every screenful interleaves editorial
 * apparatus with the text it qualifies, and this edition's whole discipline is keeping
 * those apart: furniture belongs in the ledger and the receipt, never in the continuous
 * edition. A notice printed between paragraphs IS furniture by that standard. Sticky
 * keeps one label continuously visible without ever entering the reading order.
 *
 * THE SHAPE AT SMALL VIEWPORTS IS MEASURED, NOT ASSUMED. The full sentence is rendered
 * once, in the reading order, where a reader meets it before the first word of German.
 * What persists is the short label alone. A sticky bar carrying the whole paragraph eats
 * a third of a 320px viewport and makes the German it qualifies unreadable, which would
 * be its own failure of the same requirement.
 *
 * NOTHING HERE IS WRITTEN IN THIS FILE. Every word of the label and the body comes from
 * `sourceFaceNotice`, which derives them from the provenance receipt. That is requirement
 * 2, and it is why a paper becoming reviewed stops the page calling it a draft without
 * anyone editing this component.
 */

import type { SourceFaceNotice as Notice } from "../../content/provenance/sourceFaceNotice.ts";

export function SourceFaceNotice({ notice }: { notice: Notice }) {
  // A reviewed text carries no badge. The receipt decides, not this component.
  if (notice.state !== "machine-draft") return null;

  return (
    <>
      <aside
        className="source-draft-notice"
        data-source-draft-notice
        data-notice-state={notice.state}
        aria-label={notice.label}
      >
        <p className="source-draft-notice__body">{notice.body}</p>
      </aside>
      {/*
        The persistent half. It carries the label only, and it is aria-hidden because the
        full sentence above is already in the accessibility tree: a screen reader meeting
        the same words twice learns nothing the second time and loses its place.
      */}
      <p
        className="source-draft-notice__persistent"
        data-source-draft-persistent
        aria-hidden="true"
      >
        {notice.label}
      </p>
    </>
  );
}
