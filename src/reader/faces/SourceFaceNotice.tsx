/**
 * RETIRED BY AN OWNER DECISION, AND NOT TO BE MOUNTED AGAIN (am-50bk triage, 2026-10-24).
 *
 * `docs/DECISIONS.md` D-2026-09-25-no-review-status-banners lists, among the notices the owner
 * removed, "the German face's 'Machine draft, not reviewed' box" -- this component. The decision
 * quotes him directly: "we don't need messages like this on the site, they just detract from the
 * site and the experience and aren't meaningful". The record stays in each unit's `reviewState`
 * and in `docs/provenance/`, which are the audit trail and not reader copy.
 *
 * So no production module imports this file, and that is the correct state rather than a gap.
 * `GermanFace.tsx` and `GermanDraftFace.tsx` both cite the decision at the point where the label
 * used to go, and the live faces are guarded against its return by explicit negatives in
 * `GermanDraftFace.test.tsx` and `editionCoverage.test.tsx` (they assert the rendered HTML carries
 * neither `data-source-draft-notice` nor "Machine draft, not reviewed").
 *
 * READ THAT BEFORE BELIEVING THE TEST BESIDE THIS FILE. `SourceFaceNotice.test.tsx` renders this
 * component directly and asserts that "every shipped draft paper renders both the persistent label
 * and the full sentence". It passes, and it describes a design that was withdrawn: it is green,
 * faithful, and to the wrong design, which AGENTS.md names as its own failure mode under "A Check
 * Inherits The Silence Of Whatever It Reads". The decision governs; the requirement below is the
 * superseded one, kept because RULE 1 forbids deleting the file.
 *
 * The notices D-2026-09-25 kept are the ones that tell a reader what is MISSING, "because those
 * are navigation, not provenance". A draft label is provenance, which is why it went.
 *
 * ---- the superseded requirement, as authored ----
 *
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

// Only the state, label and sentence are rendered, so a label derived from an edition's own block
// statuses (editionCoverage.ts) renders through the same component as one derived from a receipt.
export function SourceFaceNotice({ notice }: { notice: Pick<Notice, "state" | "label" | "body"> }) {
  // A reviewed text carries no badge. The receipt decides, not this component.
  if (notice.state !== "machine-draft") return null;

  /*
    ONE STATUS, TWO PARTS. The label comes first and heads the callout; the full sentence sits
    directly beneath it inside the same field and rule, so a reader meets one quiet note rather
    than a red-ruled box followed by a red-ruled bar saying the same thing. Only the label is
    sticky, so after the sentence scrolls away the label alone stays with the text it
    qualifies. Order in the page is still: label, full sentence, then the first word of German.
  */
  return (
    <>
      {/*
        The persistent half. It carries the label only, and it is aria-hidden because the
        full sentence below is already in the accessibility tree: a screen reader meeting
        the same words twice learns nothing the second time and loses its place.
      */}
      <p
        className="source-draft-notice__persistent"
        data-source-draft-persistent
        aria-hidden="true"
      >
        {notice.label}
      </p>
      <aside
        className="source-draft-notice"
        data-source-draft-notice
        data-notice-state={notice.state}
        aria-label={notice.label}
      >
        <p className="source-draft-notice__body">{notice.body}</p>
      </aside>
    </>
  );
}
