import { describe, expect, test } from "bun:test";
import { canonicalContentId, contentIdVariants, isSentenceContentId } from "./contentIds.ts";

describe("isSentenceContentId: real anchor grammar, not a homemade pattern", () => {
  test("a canonical (unsuffixed) sentence id is a sentence content id", () => {
    expect(isSentenceContentId("s4-p1-s1")).toBe(true);
  });
  test("an English split-sentence half is also a sentence content id", () => {
    expect(isSentenceContentId("s4-p1-s1a")).toBe(true);
    expect(isSentenceContentId("s4-p1-s1b")).toBe(true);
  });
  test("a section anchor is not a sentence content id", () => {
    expect(isSentenceContentId("s4")).toBe(false);
  });
  test("a paragraph anchor is not a sentence content id", () => {
    expect(isSentenceContentId("s4-p1")).toBe(false);
  });
  test("a retired heading anchor form is rejected outright, not silently accepted as a sentence", () => {
    expect(isSentenceContentId("s4-h")).toBe(false);
  });
  test("a descriptive slug that is not a real anchor at all is not a sentence content id", () => {
    expect(isSentenceContentId("s4-second-moment")).toBe(false);
  });
});

describe("canonicalContentId: normalizes an English split half back to its German source id", () => {
  test("the canonical id maps to itself", () => {
    expect(canonicalContentId("s4-p1-s1")).toBe("s4-p1-s1");
  });
  test("either English split half maps to the same canonical id as the German source", () => {
    expect(canonicalContentId("s4-p1-s1a")).toBe("s4-p1-s1");
    expect(canonicalContentId("s4-p1-s1b")).toBe("s4-p1-s1");
  });
  test("a non-sentence anchor passes through unchanged (no split concept applies)", () => {
    expect(canonicalContentId("s4")).toBe("s4");
    expect(canonicalContentId("eq-s4-d1")).toBe("eq-s4-d1");
  });
});

describe("contentIdVariants: every id a canonical sentence can be rendered under on some face", () => {
  test("a sentence id expands to itself plus both English split halves", () => {
    expect(contentIdVariants("s4-p1-s1")).toEqual(["s4-p1-s1", "s4-p1-s1a", "s4-p1-s1b"]);
  });
  test("passing an already-suffixed id still expands from its canonical form", () => {
    expect(contentIdVariants("s4-p1-s1a")).toEqual(["s4-p1-s1", "s4-p1-s1a", "s4-p1-s1b"]);
  });
  test("a non-sentence anchor expands to just itself", () => {
    expect(contentIdVariants("s4")).toEqual(["s4"]);
  });
});
