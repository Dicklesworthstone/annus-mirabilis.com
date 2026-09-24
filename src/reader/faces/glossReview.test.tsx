/**
 * The gloss face's banner describes the gloss, not the English translation (dispatch 152). Run on
 * mass-energy's compiled edition, whose gloss is the only one written.
 */
import { describe, expect, test } from "bun:test";
import { Window } from "happy-dom";
import { renderToStaticMarkup } from "react-dom/server";
import { getModalityClasses } from "../../content/schemas/glossConventions.ts";
import type { ReviewRecord } from "../../content/schemas/review.ts";
import type { GlossUnit } from "../../content/schemas/source.ts";
import { loadBilingualEdition } from "./bilingualLoader.ts";
import { GlossFace } from "./GlossFace.tsx";
import { glossReviewSummary } from "./glossReview.ts";

const edition = await loadBilingualEdition("mass-energy");
if (edition === null) throw new Error("mass-energy has no compiled edition");
const gloss = edition.glossUnits ?? [];

function renderGloss(
  glossUnits: readonly GlossUnit[],
  reviewRecords: readonly ReviewRecord[] = [],
) {
  if (edition === null) throw new Error("unreachable");
  const html = renderToStaticMarkup(
    <GlossFace
      paper={edition.paper}
      blocks={edition.blocks}
      glossUnits={glossUnits}
      translations={edition.units}
      alignment={edition.alignment}
      editorialNotes={edition.editorialNotes}
      reviewRecords={reviewRecords}
      modalityClasses={getModalityClasses()}
    />,
  );
  const { document } = new Window();
  document.body.innerHTML = html;
  return document;
}

const corrected = (units: readonly GlossUnit[]): GlossUnit[] =>
  units.map((unit, index) =>
    index === 0
      ? {
          ...unit,
          reviewState: "corrected",
          editor: { id: "fixture-editor", name: "A. Fixture Editor", kind: "human" },
        }
      : unit,
  );

describe("the gloss banner describes the gloss, not the translation", () => {
  test("every unit a machine draft: it names the gloss's maker and counts the draft", () => {
    // Non-vacuity: the claims below are over the real gloss, which must exist.
    expect(gloss.length).toBeGreaterThan(0);
    expect(gloss.every((unit) => unit.reviewState === "machine-draft")).toBe(true);
    const maker = gloss[0]?.attribution.name ?? "";
    expect(maker.length).toBeGreaterThan(0);

    const summary = glossReviewSummary(gloss);
    expect(summary.title).toBe("Machine-drafted gloss, not yet reviewed");
    expect(summary.message).toContain(`drafted by ${maker}`);
    expect(summary.message).toContain(
      `${gloss.length} of its ${gloss.length} glossed sentences are an unreviewed machine draft.`,
    );

    const banner = renderGloss(gloss).querySelector("[data-unreviewed-banner]");
    expect(banner?.getAttribute("aria-label")).toBe("Gloss review status");
    expect(banner?.textContent).toContain(summary.title);
    expect(banner?.textContent).toContain(summary.message);
    // The translation's own banner title, which this face used to show, is not what it says.
    expect(banner?.textContent).not.toContain("translation");
  });

  test("one unit corrected: the count moves and the corrector is named", () => {
    const summary = glossReviewSummary(corrected(gloss));
    expect(summary.title).toBe("Draft gloss, partly corrected, not yet reviewed");
    expect(summary.message).toContain(
      `${gloss.length - 1} of its ${gloss.length} glossed sentences are an unreviewed machine draft, and 1 has been corrected by A. Fixture Editor but not reviewed.`,
    );
    const banner = renderGloss(corrected(gloss)).querySelector("[data-unreviewed-banner]");
    expect(banner?.textContent).toContain(summary.message);
  });

  test("a review of the English sentence is not a review of its gloss", () => {
    const sentence = gloss[0]?.sentenceId ?? "";
    // An accepted translation review of the English unit that shares the gloss's sentence id.
    const record = {
      id: "review-fixture",
      reviewType: "translation",
      result: "accepted",
      reviewer: "A. Fixture Reviewer",
      date: "2026-09-24",
      scope: [{ recordId: sentence }],
    } as unknown as ReviewRecord;
    const plain = renderGloss(gloss).querySelector("[data-unreviewed-banner]")?.textContent;
    const reviewed = renderGloss(gloss, [record]).querySelector(
      "[data-unreviewed-banner]",
    )?.textContent;
    expect(reviewed).toBe(plain);
  });

  test("marked reviewed with no reviewer named, a unit is still an unreviewed draft", () => {
    const unit = gloss[0];
    if (unit === undefined) throw new Error("no gloss unit");
    const summary = glossReviewSummary([{ ...unit, reviewState: "reviewed", editor: undefined }]);
    expect(summary.counts.reviewed).toBe(0);
    expect(summary.message).toContain("1 of its 1 glossed sentence is an unreviewed draft.");
  });
});
