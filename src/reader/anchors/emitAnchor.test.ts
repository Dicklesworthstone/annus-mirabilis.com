import { describe, expect, test } from "bun:test";
import { emitAnchor, emitContentId, InvalidAnchorEmissionError } from "./emitAnchor.ts";

describe("emitAnchor: the full grammar", () => {
  test("section", () => {
    expect(emitAnchor({ kind: "section", n: 4 })).toBe("#s4");
  });

  test("paper 4 and unnumbered introductions use s0", () => {
    expect(emitAnchor({ kind: "section", n: 0 })).toBe("#s0");
  });

  test("paragraph", () => {
    expect(emitAnchor({ kind: "paragraph", n: 4, m: 2 })).toBe("#s4-p2");
  });

  test("sentence, unsuffixed", () => {
    expect(emitAnchor({ kind: "sentence", n: 4, m: 2, k: 1 })).toBe("#s4-p2-s1");
  });

  test("sentence, English split suffixes a and b", () => {
    expect(emitAnchor({ kind: "sentence", n: 4, m: 2, k: 1, splitSuffix: "a" })).toBe(
      "#s4-p2-s1a",
    );
    expect(emitAnchor({ kind: "sentence", n: 4, m: 2, k: 1, splitSuffix: "b" })).toBe(
      "#s4-p2-s1b",
    );
  });

  test("substantive inline equation, attached to a sentence", () => {
    expect(emitAnchor({ kind: "inline-equation", n: 4, m: 2, k: 1, i: 3 })).toBe("#s4-p2-s1-m3");
  });

  test("footnote", () => {
    expect(emitAnchor({ kind: "footnote", n: 3, k: 2 })).toBe("#s3-fn2");
  });

  test("closing blocks", () => {
    expect(emitAnchor({ kind: "closing", block: "dateline" })).toBe("#closing-dateline");
    expect(emitAnchor({ kind: "closing", block: "ack" })).toBe("#closing-ack");
  });

  test("masthead", () => {
    expect(emitAnchor({ kind: "masthead", part: "title" })).toBe("#masthead-title");
    expect(emitAnchor({ kind: "masthead", part: "author" })).toBe("#masthead-author");
  });

  test("paper 3 part headings", () => {
    expect(emitAnchor({ kind: "part", n: 1 })).toBe("#part-1");
    expect(emitAnchor({ kind: "part", n: 2 })).toBe("#part-2");
  });

  test("first encounter, for each of the four main papers", () => {
    expect(emitAnchor({ kind: "entry", paperSlug: "brownian-motion" })).toBe(
      "#entry-brownian-motion",
    );
    expect(emitAnchor({ kind: "entry", paperSlug: "light-quanta" })).toBe("#entry-light-quanta");
    expect(emitAnchor({ kind: "entry", paperSlug: "special-relativity" })).toBe(
      "#entry-special-relativity",
    );
    expect(emitAnchor({ kind: "entry", paperSlug: "mass-energy" })).toBe("#entry-mass-energy");
  });

  test("result, argument, and lab anchors", () => {
    expect(emitAnchor({ kind: "result", slug: "diffusion-coefficient" })).toBe(
      "#result-diffusion-coefficient",
    );
    expect(emitAnchor({ kind: "argument", id: "bm-two-ledgers" })).toBe("#arg-bm-two-ledgers");
    expect(emitAnchor({ kind: "lab", instrumentId: "bm-06" })).toBe("#lab-bm-06");
  });
});

describe("emitAnchor: every emission round-trips through the real parser", () => {
  test("an invalid argument id (missing the paper-code prefix) throws, naming the fragment", () => {
    expect(() => emitAnchor({ kind: "argument", id: "two-ledgers" })).toThrow(
      InvalidAnchorEmissionError,
    );
  });

  test("an invalid lab id (unregistered instrument) throws", () => {
    expect(() => emitAnchor({ kind: "lab", instrumentId: "xx-99" })).toThrow(
      InvalidAnchorEmissionError,
    );
  });

  test("an invalid result slug throws", () => {
    expect(() => emitAnchor({ kind: "result", slug: "Not Valid!" })).toThrow(
      InvalidAnchorEmissionError,
    );
  });
});

describe("emitContentId: the bare DOM id, no leading #", () => {
  test("strips the leading # for a section", () => {
    expect(emitContentId({ kind: "section", n: 3 })).toBe("s3");
  });

  test("strips the leading # for a sentence", () => {
    expect(emitContentId({ kind: "sentence", n: 3, m: 2, k: 1 })).toBe("s3-p2-s1");
  });
});
