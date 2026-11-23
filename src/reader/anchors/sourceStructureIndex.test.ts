import { describe, expect, test } from "bun:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { sectionAnchorOf, splitSentenceIds } from "../../content/anchors.ts";
import { printedUnits } from "../../content/editions/germanSourceFace.ts";
import type { RouteSlug } from "../../content/ids.ts";
import { isSentenceContentId } from "../weave/contentIds.ts";
import { mapToFace } from "./mapToFace.ts";
import { sourceStructureIndex } from "./sourceStructureIndex.ts";

const PAPERS: readonly RouteSlug[] = [
  "mass-energy",
  "light-quanta",
  "brownian-motion",
  "special-relativity",
];

describe("the four source manifests supply the reader's nearest published ancestor", () => {
  for (const paper of PAPERS) {
    test(paper, () => {
      const units = printedUnits(process.cwd(), paper);
      const record = JSON.parse(
        readFileSync(join(process.cwd(), "content", "papers", `${paper}.json`), "utf8"),
      ) as { sections: { id: string }[] };
      const index = sourceStructureIndex(units, record.sections.map((section) => section.id));
      const publishedIds = new Set(index.units.map((unit) => unit.id));
      expect(units.length).toBeGreaterThan(0);
      for (const unit of units) {
        expect(publishedIds.has(unit.id)).toBe(true);
        if (unit.containedIn !== undefined) {
          expect(index.units.find((item) => item.id === unit.id)?.parentId).toBe(unit.containedIn);
        }
      }
      for (const unit of index.units) {
        if (unit.parentId !== undefined) expect(publishedIds.has(unit.parentId)).toBe(true);
      }

      const inline = units.find(
        (unit) =>
          unit.kind === "inline-equation" &&
          unit.containedIn !== undefined &&
          isSentenceContentId(unit.containedIn),
      );
      if (!inline?.containedIn) throw new Error(`${paper} has no inline sentence fixture.`);
      const sentence = units.find((unit) => unit.id === inline.containedIn);
      if (!sentence?.containedIn) throw new Error(`${paper} has no paragraph fixture.`);
      const paragraph = sentence.containedIn;
      const section = sectionAnchorOf(sentence.id);
      if (!section) throw new Error(`${paper} has no section fixture.`);
      const [firstHalf, secondHalf] = splitSentenceIds(sentence.id);

      // A source formula without an exact target stays inside its sentence, not at the section.
      expect(mapToFace(inline.id, index, new Set([sentence.id, paragraph, section]))).toBe(
        sentence.id,
      );
      // The English face can publish only split halves of the containing German sentence.
      expect(mapToFace(inline.id, index, new Set([firstHalf, secondHalf, paragraph]))).toBe(
        firstHalf,
      );
      expect(mapToFace(sentence.id, index, new Set([firstHalf, secondHalf]))).toBe(firstHalf);
      expect(mapToFace(secondHalf, index, new Set([sentence.id]))).toBe(sentence.id);
      expect(mapToFace(secondHalf, index, new Set([firstHalf, secondHalf]))).toBe(secondHalf);
      // Neither split halves nor inline formulas require synthetic records in the manifest.
      expect(mapToFace(secondHalf, index, new Set([paragraph, section]))).toBe(paragraph);
      expect(mapToFace(inline.id, index, new Set([paragraph, section]))).toBe(paragraph);
      expect(mapToFace(inline.id, index, new Set([section]))).toBe(section);
      expect(mapToFace(inline.id, index, new Set(["unrelated"]))).toBeUndefined();
      expect(index.pdfPageByUnit).toBeUndefined();
    });
  }
});

describe("source structure admits declared containment without inventing destinations", () => {
  test("an unsectioned paper uses its explanation's declared root", () => {
    const index = sourceStructureIndex(
      [
        { id: "s0-p5" },
        { id: "s0-p5-s1", containedIn: "s0-p5" },
        { id: "s0-p5-s1-m1", containedIn: "s0-p5-s1" },
      ],
      ["s0"],
    );
    expect(mapToFace("s0-p5-s1-m1", index, new Set(["s0"]))).toBe("s0");
  });

  test("a section declared by the source is retained even without an explanation section", () => {
    const index = sourceStructureIndex([{ id: "s3-p1", section: "s3" }], ["s0", "s1"]);
    expect(mapToFace("s3-p1", index, new Set(["s3"]))).toBe("s3");
  });

  test("an anchor prefix alone cannot invent a section root", () => {
    const index = sourceStructureIndex([{ id: "s9-p1" }], ["s0"]);
    expect(mapToFace("s9-p1", index, new Set(["s9"]))).toBeUndefined();
    expect(index.units.some((unit) => unit.id === "s9")).toBe(false);
  });

  test("closing labels remain roots, and locators never become a second PDF map", () => {
    const source = [
      { id: "closing-dateline", section: "closing", locators: [{ page: 641 }] },
    ];
    const index = sourceStructureIndex(source, ["s0"]);
    expect(index.units.find((unit) => unit.id === "closing-dateline")).toEqual({
      id: "closing-dateline",
    });
    expect(Object.keys(index)).toEqual(["units"]);
    expect(index.units.every((unit) => !("locators" in unit))).toBe(true);
  });

  test("source-structure-parent-missing identifies the broken source unit", () => {
    assert.throws(
      () => sourceStructureIndex([{ id: "s1-p1-s1", containedIn: "s1-p1" }], ["s1"]),
      {
        name: "SourceStructureError",
        code: "source-structure-parent-missing",
        message: /s1-p1-s1.*absent parent.*s1-p1/,
      },
    );
  });

  test("source-structure-duplicate cannot overwrite a source unit's parent silently", () => {
    assert.throws(
      () =>
        sourceStructureIndex([{ id: "s1-p1" }, { id: "s1-p1", containedIn: "s1" }], ["s1"]),
      {
        name: "SourceStructureError",
        code: "source-structure-duplicate",
        message: /s1-p1.*twice/,
      },
    );
  });

  test("source-structure-cycle refuses cyclic containment before it reaches the browser", () => {
    assert.throws(
      () =>
        sourceStructureIndex(
          [
            { id: "s1-p1", containedIn: "s1-p1-s1" },
            { id: "s1-p1-s1", containedIn: "s1-p1" },
          ],
          ["s1"],
        ),
      {
        name: "SourceStructureError",
        code: "source-structure-cycle",
        message: /cyclic containment/,
      },
    );
  });
});
