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
    expect(sourceUnitLabel("s3-p2-s1", "sentence", true)).toBe("s3-p2-s1 (sentence)");
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
