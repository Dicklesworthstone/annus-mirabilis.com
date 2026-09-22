/**
 * REQUIREMENT 3: it must be impossible to render a draft German face without the notice.
 *
 * am-dl4n criterion 2. "Requirement 3 is the one that makes the label real rather than
 * decorative - a payload whose receipt says draft, rendered with the notice removed, must
 * FAIL." Every arm below is written to be that failure.
 *
 * Two halves, because either alone is a convention rather than a guarantee:
 *
 *   The TYPE half lives on GermanSourceFace, where `notice` is not optional, so no caller
 *   can hold the German text without also holding the sentence that qualifies it.
 *
 *   The RENDER half is here: for every paper whose shipped receipt says draft, the
 *   rendered markup must carry the label and the body. Deleting the notice from the
 *   component fails these, which is the plant the criterion asks for.
 */

import { describe, expect, test } from "bun:test";
import { renderToStaticMarkup } from "react-dom/server";
import { loadGermanSourceFace } from "../../content/editions/germanSourceFace.ts";
import type { Transcription } from "../../content/provenance/receiptSchema.ts";
import { sourceFaceNotice } from "../../content/provenance/sourceFaceNotice.ts";
import { SourceFaceNotice } from "./SourceFaceNotice.tsx";

const DRAFT_PAPERS = ["mass-energy", "brownian-motion", "light-quanta"] as const;

describe("a draft source face cannot be rendered without its notice", () => {
  test("every shipped draft paper renders both the persistent label and the full sentence", () => {
    for (const slug of DRAFT_PAPERS) {
      const face = loadGermanSourceFace(slug);
      expect(face).not.toBeNull();
      if (!face) continue;
      expect(face.notice.state).toBe("machine-draft");

      const html = renderToStaticMarkup(<SourceFaceNotice notice={face.notice} />);

      // The full sentence, met once in the reading order.
      expect(html).toContain(face.notice.body);
      // And the label that persists, which is what makes it a label ON the content
      // rather than one a reader passes and never sees again.
      expect(html).toContain(face.notice.label);
      expect(html).toContain("data-source-draft-persistent");
      // Sticky is a style, so the hook the stylesheet targets must actually be emitted.
      expect(html).toContain("source-draft-notice__persistent");
    }
  });

  test("NOT DISMISSIBLE: no control, no script, nothing to click it away", () => {
    // Requirement 1's other half. A dismissible notice is a notice a reader removes once
    // and never sees again, which is the same failure as one that scrolls away.
    const face = loadGermanSourceFace("brownian-motion");
    expect(face).not.toBeNull();
    if (!face) return;
    const html = renderToStaticMarkup(<SourceFaceNotice notice={face.notice} />);
    expect(html).not.toContain("<button");
    expect(html).not.toContain("onclick");
    expect(html).not.toContain("<script");
    // The HTML `hidden` ATTRIBUTE, not the substring. `expect(html).not.toContain("hidden")`
    // was my first version and it failed on `aria-hidden="true"`, which is a different
    // thing and a correct one - a substring standing in for a structural test, in a guard
    // written by someone who has spent the session finding exactly that.
    expect(html).not.toMatch(/\shidden(?=[\s=>])/);
    // No <details>: a notice a reader can fold shut is dismissible by another name.
    expect(html).not.toContain("<details");
  });

  test("the words come from the receipt, not from the component", () => {
    // Requirement 2 asserted at the RENDER boundary as well as in the deriving module,
    // because a component is free to ignore what it is handed. The role here is one no
    // author would type, so markup containing a hardcoded sentence fails.
    const invented = {
      ocrRuns: [],
      ledgerStatus: "corrected",
      editors: [],
      draftedBy: [
        {
          id: "agent:Nobody",
          kind: "model",
          role: "plate-scan-retyped-against-microfilm",
          basis: "Retyped from a 1953 microfilm reel held at the Augsburg reading room",
        },
      ],
    } as unknown as Transcription;

    const html = renderToStaticMarkup(<SourceFaceNotice notice={sourceFaceNotice(invented)} />);
    expect(html).toContain("plate scan retyped against microfilm");
    expect(html).toContain("1953 microfilm reel");
  });

  test("A REVIEWED TEXT RENDERS NO BADGE AT ALL, with no component edited", () => {
    // The property requirement 2 exists for, at the render boundary. When a receipt
    // advances, this component stops emitting a draft label on its own.
    const reviewed = {
      ocrRuns: [],
      ledgerStatus: "reviewed",
      editors: [
        {
          name: "A. Reviewer",
          role: "german-source-review",
          pages: "639-641",
          dates: "2026-10-01",
        },
      ],
    } as unknown as Transcription;

    const html = renderToStaticMarkup(<SourceFaceNotice notice={sourceFaceNotice(reviewed)} />);
    expect(html).toBe("");
  });

  test("the persistent label is hidden from assistive technology, and the sentence is not", () => {
    // The full sentence is already in the accessibility tree. A screen reader meeting the
    // same words twice learns nothing the second time and loses its place, so the
    // duplicate is aria-hidden while the sentence it duplicates stays announced.
    const face = loadGermanSourceFace("mass-energy");
    expect(face).not.toBeNull();
    if (!face) return;
    const html = renderToStaticMarkup(<SourceFaceNotice notice={face.notice} />);
    // aria-hidden sits on the persistent element, not on the aside carrying the sentence.
    // Each element's OWN open tag is read. This was a ±200-character window around the marker,
    // which went negative once the label moved first in the markup, and String#slice counts a
    // negative start from the END, so the window was empty and the check failed on correct markup.
    const openTagAt = (marker: string) => {
      const at = html.indexOf(marker);
      expect(at).toBeGreaterThan(-1);
      return html.slice(html.lastIndexOf("<", at), html.indexOf(">", at) + 1);
    };
    expect(openTagAt("data-source-draft-persistent")).toContain('aria-hidden="true"');
    expect(openTagAt("data-source-draft-notice")).not.toContain("aria-hidden");
  });
});
