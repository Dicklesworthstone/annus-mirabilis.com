import { describe, expect, test } from "bun:test";
import { mapToFace, mapToFacsimilePage, mapToResultsFace, type StructureIndex } from "./mapToFace";

const FIXTURE: StructureIndex = {
  units: [
    { id: "s3" },
    { id: "s3-p1", parentId: "s3" },
    { id: "s3-p1-s1", parentId: "s3-p1" },
    { id: "s3-p1-s1a", parentId: "s3-p1-s1" },
    { id: "s3-p1-s1b", parentId: "s3-p1-s1" },
    { id: "s3-p1-s1-m1", parentId: "s3-p1-s1" },
    { id: "s3-p2", parentId: "s3" },
    { id: "s3-p2-s1", parentId: "s3-p2" },
  ],
  resultsBySection: {
    s3: ["result-diffusion-coefficient"],
  },
  pdfPageByUnit: {
    "s3-p1-s1": 552,
    s3: 549,
  },
};

describe("mapToFace: nearest-ancestor mapping across faces", () => {
  test("an id present on the face maps to itself", () => {
    expect(mapToFace("s3-p1-s1", FIXTURE, new Set(["s3-p1-s1"]))).toBe("s3-p1-s1");
  });

  test("sentence climbs to paragraph, then to section, when neither is present", () => {
    expect(mapToFace("s3-p1-s1", FIXTURE, new Set(["s3-p1"]))).toBe("s3-p1");
    expect(mapToFace("s3-p1-s1", FIXTURE, new Set(["s3"]))).toBe("s3");
  });

  test("a chain with nothing present, not even the root section, maps to undefined", () => {
    expect(mapToFace("s3-p1-s1", FIXTURE, new Set(["s9"]))).toBeUndefined();
  });

  test("an English split-sentence half maps to the German source id when only the source is present", () => {
    expect(mapToFace("s3-p1-s1a", FIXTURE, new Set(["s3-p1-s1"]))).toBe("s3-p1-s1");
    expect(mapToFace("s3-p1-s1b", FIXTURE, new Set(["s3-p1-s1"]))).toBe("s3-p1-s1");
  });

  test("a German source sentence maps back to its first English half when only the halves are present", () => {
    expect(mapToFace("s3-p1-s1", FIXTURE, new Set(["s3-p1-s1a", "s3-p1-s1b"]))).toBe("s3-p1-s1a");
  });

  test("an id not in the structure index at all still climbs by string-derived parentage for a sentence, then reports undefined past the fixture's known units", () => {
    expect(mapToFace("s9-p1-s1", FIXTURE, new Set(["s3"]))).toBeUndefined();
  });

  test("a shared sentence id is identical on the German and English faces", () => {
    const german = new Set(["s4-p2-s1", "s4-p2"]);
    const english = new Set(["s4-p2-s1", "s4-p2-s1a", "s4-p2-s1b", "s4-p2"]);
    const index: StructureIndex = {
      units: [
        { id: "s4" },
        { id: "s4-p2", parentId: "s4" },
        { id: "s4-p2-s1", parentId: "s4-p2" },
        { id: "s4-p2-s1a", parentId: "s4-p2-s1" },
        { id: "s4-p2-s1b", parentId: "s4-p2-s1" },
      ],
    };
    expect(mapToFace("s4-p2-s1", index, german)).toBe("s4-p2-s1");
    expect(mapToFace("s4-p2-s1", index, english)).toBe("s4-p2-s1");
  });
});

describe("mapToResultsFace: section to its derived results", () => {
  test("returns the declared result ids for a section", () => {
    expect(mapToResultsFace("s3", FIXTURE)).toEqual(["result-diffusion-coefficient"]);
  });

  test("returns an empty list, never undefined, for a section with no declared results", () => {
    expect(mapToResultsFace("s9", FIXTURE)).toEqual([]);
  });
});

describe("mapToFacsimilePage: source anchor to its validated PDF page", () => {
  test("an exactly located unit maps to its own page, marked exact", () => {
    expect(mapToFacsimilePage("s3-p1-s1", FIXTURE)).toEqual({ page: 552, exact: true });
  });

  test("an unlocated unit maps to its nearest located ancestor's page, marked not exact, rather than guessing", () => {
    expect(mapToFacsimilePage("s3-p1-s1a", FIXTURE)).toEqual({ page: 552, exact: false });
    expect(mapToFacsimilePage("s3-p2-s1", FIXTURE)).toEqual({ page: 549, exact: false });
  });

  test("a chain with no located unit at all returns undefined, for the caller to report", () => {
    const noPages: StructureIndex = { units: [{ id: "s9" }] };
    expect(mapToFacsimilePage("s9", noPages)).toBeUndefined();
  });

  test("a 0-based page fails loudly, naming the unit, rather than landing one page early", () => {
    const zeroBased: StructureIndex = {
      units: [{ id: "s3" }],
      pdfPageByUnit: { s3: 0 },
    };
    expect(() => mapToFacsimilePage("s3", zeroBased)).toThrow(/s3/);
    expect(() => mapToFacsimilePage("s3", zeroBased)).toThrow(/1-based/);
  });
});
