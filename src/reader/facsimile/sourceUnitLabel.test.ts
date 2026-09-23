import { describe, expect, test } from "bun:test";
import { loadPaper } from "../../content/server.ts";
import { loadFacsimileDocument } from "./server.ts";
import { sourceUnitLabel } from "./sourceUnitLabel.ts";

describe("sourceUnitLabel", () => {
  test("each id shape in the pinned papers gets the reader's name for it", () => {
    expect(sourceUnitLabel("masthead-title", "masthead-title", true)).toBe("Title");
    expect(sourceUnitLabel("masthead-author", "masthead-author", true)).toBe("Author line");
    expect(sourceUnitLabel("closing-dateline", "closing-dateline", true)).toBe("Date-line");
    expect(sourceUnitLabel("closing-received", "closing-received", true)).toBe("Date received");
    expect(sourceUnitLabel("s3", "section-heading", true)).toBe("§3 heading");
    expect(sourceUnitLabel("s3-p2", "paragraph", true)).toBe("§3, paragraph 2");
    expect(sourceUnitLabel("s0-p1", "paragraph", true)).toBe("Introduction, paragraph 1");
    expect(sourceUnitLabel("s1-fn1", "footnote", true)).toBe("§1, footnote 1");
    expect(sourceUnitLabel("eq-s4-d2", "display-equation", true)).toBe("§4, display equation 2");
  });

  test("an unsectioned paper's s0 names no place", () => {
    expect(sourceUnitLabel("s0-p5", "paragraph", false)).toBe("Paragraph 5");
    expect(sourceUnitLabel("s0-fn2", "footnote", false)).toBe("Footnote 2");
    expect(sourceUnitLabel("eq-s0-d1", "display-equation", false)).toBe("Display equation 1");
  });

  test("an unknown shape keeps its id and kind rather than a guessed name", () => {
    expect(sourceUnitLabel("part-1", "part-heading", true)).toBe("part-1 (part heading)");
    // A roman printed label is normalised to roman-<n> (CONTENT_IDS.md §4.2) and has no name yet.
    expect(sourceUnitLabel("eq-roman-2", "display-equation", true)).toBe(
      "eq-roman-2 (display equation)",
    );
  });

  test("sentences and printed equation numbers are named by place and printed label", () => {
    // Brownian's inventory has 90 sentence units and three printed labels; they reached the page
    // map once its facsimile face was admitted, as "s0-p1-s1 (sentence)".
    expect(sourceUnitLabel("s0-p1-s1", "sentence", true)).toBe(
      "Introduction, paragraph 1, sentence 1",
    );
    expect(sourceUnitLabel("s3-p2-s4", "sentence", true)).toBe("§3, paragraph 2, sentence 4");
    expect(sourceUnitLabel("s0-p2-s3", "sentence", false)).toBe("Paragraph 2, sentence 3");
    expect(sourceUnitLabel("eq-s3-1", "display-equation", true)).toBe("§3, equation (1)");
    expect(sourceUnitLabel("eq-2", "display-equation", true)).toBe("Equation (2)");
    expect(sourceUnitLabel("eq-1p", "display-equation", true)).toBe("Equation (1′)");
    expect(sourceUnitLabel("eq-7a", "display-equation", true)).toBe("Equation (7a)");
    // The unnumbered display form still wins over the printed one.
    expect(sourceUnitLabel("eq-s3-d4", "display-equation", true)).toBe("§3, display equation 4");
  });

  test("no unit on a published facsimile is named by its raw id", async () => {
    // The population is what the facsimile face itself loads, not a list typed here.
    let seen = 0;
    for (const paperId of [
      "light-quanta",
      "brownian-motion",
      "special-relativity",
      "mass-energy",
    ]) {
      const { paper } = await loadPaper(paperId);
      const facsimile = await loadFacsimileDocument(paperId, paper.citation);
      if (facsimile.kind !== "available") continue;
      const units = facsimile.document.units;
      const sectioned = units.some((unit) => unit.kind === "section-heading");
      for (const unit of units) {
        seen += 1;
        expect(sourceUnitLabel(unit.id, unit.kind, sectioned)).not.toContain(unit.id);
      }
    }
    expect(seen).toBeGreaterThan(0);
  });
});
