import { describe, expect, test } from "bun:test";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { parseYaml } from "../../content/provenance/yaml.ts";
import type { SourceBlock } from "../../content/schemas/source.ts";
import { sortBlocksByManifest } from "./bilingualLoader.ts";
import { glossPageForStrandedAnchor, glossRedirectTransfer } from "./glossNavigation.ts";
import { glossAnchorSections } from "./glossSections.ts";

// Read authored inputs directly, so no compiled payload or filtered loader can hide a missing
// source block. Manifest order is the renderer's existing owner, including unsectioned headings.
function sourceBlocks(paper: string): SourceBlock[] {
  const dir = join(process.cwd(), "content", "source-blocks", paper);
  const manifest = parseYaml(readFileSync(join(dir, "manifest.yaml"), "utf8")) as {
    units: { id: string }[];
  };
  const blocks = readdirSync(dir)
    .filter((name) => name.endsWith(".yaml") && name !== "manifest.yaml")
    .map((name) => parseYaml(readFileSync(join(dir, name), "utf8")))
    .filter(
      (value): value is SourceBlock =>
        value !== null &&
        typeof value === "object" &&
        !Array.isArray(value) &&
        "id" in value &&
        "diplomaticText" in value,
    );
  sortBlocksByManifest(
    blocks,
    manifest.units.map((unit) => unit.id),
  );
  expect(blocks.length).toBeGreaterThan(0);
  return blocks;
}

const PAPER = "/papers/special-relativity";
const PATH = `${PAPER}/view/gloss/`;
const srBlocks = sourceBlocks("special-relativity");
const srSections = JSON.stringify(glossAnchorSections(srBlocks));

describe("a paginated gloss keeps every declared kind of source address", () => {
  test("real equations, part headings, and closing lines reach their sections", () => {
    for (const [anchor, section] of [
      ["s0", "s0"],
      ["eq-s7-d1", "s7"],
      ["eq-A", "s10"],
      ["part-1", "s1"],
      ["part-2", "s6"],
      ["closing-ack", "s10"],
      ["closing-dateline", "s10"],
      ["closing-received", "s10"],
      ["masthead-title", "s0"],
      ["masthead-author", "s0"],
    ] as const) {
      expect(glossPageForStrandedAnchor(anchor, PATH, srSections)).toBe(
        `${PAPER}/${section}/view/gloss/#${anchor}`,
      );
    }
  });

  test("the same closing id follows each paper's own final section", () => {
    for (const [paper, lastSection] of [
      ["mass-energy", "s0"],
      ["light-quanta", "s9"],
      ["brownian-motion", "s5"],
      ["special-relativity", "s10"],
    ] as const) {
      const sections = JSON.stringify(glossAnchorSections(sourceBlocks(paper)));
      expect(
        glossPageForStrandedAnchor("closing-received", `/papers/${paper}/view/gloss/`, sections),
      ).toBe(`/papers/${paper}/${lastSection}/view/gloss/#closing-received`);
    }
    const brownian = JSON.stringify(glossAnchorSections(sourceBlocks("brownian-motion")));
    expect(
      glossPageForStrandedAnchor("eq-2", "/papers/brownian-motion/view/gloss/", brownian),
    ).toBe("/papers/brownian-motion/s3/view/gloss/#eq-2");
  });

  test("the actual source sentence owns an English split half's destination", () => {
    expect(glossPageForStrandedAnchor("s1-p10-s1a", PATH, srSections)).toBe(
      `${PAPER}/s1/view/gloss/#s1-p10-s1a`,
    );
  });

  test("authored inline formulas retain their section; unrecorded formulas do not", () => {
    const block = srBlocks.find((source) => source.id === "s7-p1");
    expect(block).toBeDefined();
    if (!block) return;
    const sections = JSON.stringify(
      glossAnchorSections([
        {
          ...block,
          inlines: [
            { kind: "math", latex: "x", inlineId: "s7-p1-s1-m1" },
            {
              kind: "emphasis",
              inlines: [{ kind: "math", latex: "y", inlineId: "s7-p1-s1-m2" }],
            },
          ],
        },
      ]),
    );
    for (const id of ["s7-p1-s1-m1", "s7-p1-s1-m2"])
      expect(glossPageForStrandedAnchor(id, PATH, sections)).toBe(
        `${PAPER}/s7/view/gloss/#${id}`,
      );
    expect(glossPageForStrandedAnchor("s7-p1-s1-m99", PATH, sections)).toBeNull();
  });

  test("retired addresses follow their resolved successor, including a different section", () => {
    const sections = JSON.stringify(
      glossAnchorSections(srBlocks, { "s1-p999-s1": "s7-p1-s1", "s1-p998": "absent" }),
    );
    expect(glossPageForStrandedAnchor("s1-p999-s1", PATH, sections)).toBe(
      `${PAPER}/s7/view/gloss/#s1-p999-s1`,
    );
    expect(glossPageForStrandedAnchor("s1-p998", PATH, sections)).toBeNull();
  });

  test("removing a real source block removes its destination", () => {
    expect(glossPageForStrandedAnchor("eq-A", PATH, srSections)).not.toBeNull();
    const missing = JSON.stringify(glossAnchorSections(srBlocks.filter((b) => b.id !== "eq-A")));
    expect(glossPageForStrandedAnchor("eq-A", PATH, missing)).toBeNull();
    expect(glossPageForStrandedAnchor("s7-p999-s1", PATH, srSections)).toBeNull();
  });

  test("every real block is assigned once, without inventing ids from paragraph positions", () => {
    for (const paper of ["mass-energy", "light-quanta", "brownian-motion", "special-relativity"]) {
      const blocks = sourceBlocks(paper);
      const indexed = Object.values(glossAnchorSections(blocks)).flat();
      for (const block of blocks) expect(indexed.filter((id) => id === block.id)).toHaveLength(1);
    }
  });
});

describe("section redirects preserve settings and cannot leave the selected paper's gloss", () => {
  test("query bytes survive both whole-paper and wrong-section arrivals", () => {
    const query = "?detail=2&lens=modern&tour=light%2Bmatter&stop=3";
    for (const path of [PATH, `${PAPER}/s3/view/gloss/`])
      expect(glossPageForStrandedAnchor("eq-A", path + query, srSections)).toBe(
        `${PAPER}/s10/view/gloss/${query}#eq-A`,
      );
  });

  test("the current section never redirects to itself, with or without a trailing slash", () => {
    for (const path of [`${PAPER}/s10/view/gloss/`, `${PAPER}/s10/view/gloss?detail=2`])
      expect(glossPageForStrandedAnchor("eq-A", path, srSections)).toBeNull();
  });

  test("a malformed index, ambiguous address, or path-like section is refused", () => {
    for (const sections of [
      "{",
      "null",
      "[]",
      '{"s10":"eq-A"}',
      '{"s10":[7]}',
      '{"../elsewhere":["eq-A"]}',
      '{"s9":["eq-A"],"s10":["eq-A"]}',
    ])
      expect(glossPageForStrandedAnchor("eq-A", PATH, sections)).toBeNull();
    for (const anchor of ["constructor", "__proto__", "#eq-A", "", "<script>"])
      expect(glossPageForStrandedAnchor(anchor, PATH, srSections)).toBeNull();
  });

  test("external URLs, path traversal, other faces, and non-face routes are refused", () => {
    for (const path of [
      `https://example.com${PATH}`,
      `//example.com${PATH}`,
      "/papers/../special-relativity/view/gloss/",
      `${PAPER}/view/english/`,
      `${PAPER}/view/facsimile/`,
      `${PAPER}/`,
      `${PATH}#eq-A`,
    ])
      expect(glossPageForStrandedAnchor("eq-A", path, srSections)).toBeNull();
  });
});

describe("an intermediate gloss redirect preserves the final destination's place", () => {
  const anchor = "s7-p1-s1";
  const path = `${PATH}?detail=2`;
  const destination = `${PAPER}/s7/view/gloss/?detail=2#${anchor}`;
  const saved = { path, anchorId: anchor, relativeOffset: 0.2 };

  test("the final section receives the same viewport fraction and an exactly bound path", () => {
    expect(glossRedirectTransfer(saved, path, `#${anchor}`, destination)).toEqual({
      ...saved,
      path: `${PAPER}/s7/view/gloss/?detail=2`,
    });
  });

  test("other destinations, malformed records, and nonfinite positions cannot take it", () => {
    for (const next of [
      destination.replace("special-relativity", "mass-energy"),
      destination.replace("detail=2", "detail=0"),
      destination.replace(anchor, "s7-p2-s1"),
      destination.replace("/gloss/", "/german/"),
    ])
      expect(glossRedirectTransfer(saved, path, `#${anchor}`, next)).toBeNull();
    for (const value of [
      null,
      [],
      { ...saved, path: PATH },
      { ...saved, relativeOffset: Infinity },
    ])
      expect(glossRedirectTransfer(value, path, `#${anchor}`, destination)).toBeNull();
  });
});
