/**
 * The derived face-availability table (pane28).
 *
 * These assert PROPERTIES rather than a census: the empty/available boundary per face,
 * that parallel and gloss need both sides, and that facsimile is never claimed from
 * counts. A count of the faces would break the first time one is added and would
 * prove nothing about the question this module answers.
 */

import { describe, expect, test } from "bun:test";
import {
  englishFaceHasContent,
  type FaceContentCounts,
  faceAvailability,
  germanFaceHasContent,
  glossFaceHasContent,
  parallelFaceHasContent,
} from "./faceAvailability.ts";

const counts = (over: Partial<FaceContentCounts> = {}): FaceContentCounts => ({
  blocks: 0,
  units: 0,
  glossUnits: 0,
  germanDraftBlocks: 0,
  ...over,
});

describe("faceAvailability", () => {
  test("a paper with no edition at all offers only the three non-source faces", () => {
    const a = faceAvailability(counts());
    expect(a.reading).toBe("available");
    expect(a.results).toBe("available");
    expect(a.split).toBe("available");
    expect(a.german).toBe("empty");
    expect(a.english).toBe("empty");
    expect(a.parallel).toBe("empty");
    expect(a.gloss).toBe("empty");
  });

  test("German is available from a DRAFT alone, which is how three of four papers have it", () => {
    // brownian-motion, light-quanta and mass-energy reach their German face through
    // loadGermanSourceFace, not through a compiled bilingual edition.
    expect(faceAvailability(counts({ germanDraftBlocks: 87 })).german).toBe("available");
    expect(faceAvailability(counts({ blocks: 87 })).german).toBe("available");
    expect(germanFaceHasContent(0, 87)).toBe(true);
    expect(germanFaceHasContent(87, 0)).toBe(true);
    expect(germanFaceHasContent(0, 0)).toBe(false);
  });

  test("a German draft alone never makes English, parallel or gloss available", () => {
    // The negative a naive implementation fails: "the paper has source text" is not
    // "the paper has a translation". Every one of these is a stub today.
    const a = faceAvailability(counts({ germanDraftBlocks: 87 }));
    expect(a.english).toBe("empty");
    expect(a.parallel).toBe("empty");
    expect(a.gloss).toBe("empty");
  });

  test("parallel and gloss need BOTH sides, not either", () => {
    expect(faceAvailability(counts({ blocks: 10 })).parallel).toBe("empty");
    expect(faceAvailability(counts({ units: 10 })).parallel).toBe("empty");
    expect(faceAvailability(counts({ blocks: 10, units: 10 })).parallel).toBe("available");

    expect(faceAvailability(counts({ blocks: 10 })).gloss).toBe("empty");
    expect(faceAvailability(counts({ glossUnits: 10 })).gloss).toBe("empty");
    expect(faceAvailability(counts({ blocks: 10, glossUnits: 10 })).gloss).toBe("available");

    expect(parallelFaceHasContent(10, 0)).toBe(false);
    expect(parallelFaceHasContent(0, 10)).toBe(false);
    expect(parallelFaceHasContent(10, 10)).toBe(true);
    expect(glossFaceHasContent(10, 0)).toBe(false);
    expect(glossFaceHasContent(10, 10)).toBe(true);
    expect(englishFaceHasContent(0)).toBe(false);
    expect(englishFaceHasContent(1)).toBe(true);
  });

  test("facsimile is never claimed from counts, and is passed through when a caller knows", () => {
    // Deciding it costs a SHA-256 over the whole pinned PDF. Guessing from counts
    // would claim a scan this module has not seen.
    expect(faceAvailability(counts({ blocks: 87, units: 87, glossUnits: 87 })).facsimile).toBe(
      "unknown",
    );
    expect(faceAvailability(counts({ facsimile: "available" })).facsimile).toBe("available");
    expect(faceAvailability(counts({ facsimile: "empty" })).facsimile).toBe("empty");
  });

  test("the table is frozen, so a caller cannot edit one face's answer in place", () => {
    const a = faceAvailability(counts());
    expect(Object.isFrozen(a)).toBe(true);
  });
});
