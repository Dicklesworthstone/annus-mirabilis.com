/**
 * WHERE A RESULT CARD'S SOURCE LINK SAYS IT GOES (am-enpr), and why a sentence belongs in the name.
 *
 * am-jmma established the rule these links live under: one name, one destination. It fixed the case
 * where two quotations from a page produced two links both called "Text on page 555 of the German
 * source" by adding the passage to the name. The passage was computed by a PREFIX match on the
 * anchor, `^s(\d+)-p(\d+)`, which threw away everything after the paragraph, so every sentence of a
 * paragraph was still named for the paragraph and the ambiguity came straight back one level down.
 *
 * Measured on the built Results faces before this fix, by reading each link's text and its href:
 *
 *   "Text on page 906 of the German source, § 5, paragraph 2"   -> #s5-p2-s7 AND #s5-p2-s8
 *   "Text on page 915 of the German source, § 8, paragraph 10"  -> two destinations
 *   "Text on page 640 of the German source, paragraph 7"        -> two destinations (mass-energy)
 *
 * The anchor shapes that actually occur, counted over all four built Results faces (142 anchors):
 * `sN-pN-sN` 52, `eq-sN-dN` 37, `sN-pN` 35, `sN` 18. Each is covered below, so this is a closed set
 * rather than a sample.
 */
import { describe, expect, it } from "bun:test";
import { place, sourceLinkName } from "./ResultCard.tsx";

describe("place: the four anchor shapes the Results faces actually carry", () => {
  it("a sentence is named down to the sentence, which is the repair", () => {
    expect(place("s5-p2-s7")).toBe("§ 5, paragraph 2, sentence 7");
    expect(place("s5-p2-s8")).toBe("§ 5, paragraph 2, sentence 8");
    expect(place("s8-p10-s1")).toBe("§ 8, paragraph 10, sentence 1");
  });

  it("a paragraph is still named for the paragraph", () => {
    expect(place("s5-p2")).toBe("§ 5, paragraph 2");
    expect(place("s10-p18")).toBe("§ 10, paragraph 18");
  });

  it("a display keeps its own words", () => {
    expect(place("eq-s5-d5")).toBe("§ 5, display 5");
    expect(place("eq-s10-d12")).toBe("§ 10, display 12");
  });

  it("a section anchor is named, where it used to read as its raw id", () => {
    expect(place("s5")).toBe("§ 5");
    expect(place("s10")).toBe("§ 10");
  });

  it("paper 4 prints no sections, so none is named", () => {
    // AGENTS.md, naming conventions: "Paper 4 has no sections and uses `s0`".
    expect(place("s0-p7")).toBe("paragraph 7");
    expect(place("s0-p7-s3")).toBe("paragraph 7, sentence 3");
    expect(place("s0")).toBe("the opening");
  });

  it("a split sentence keeps its letter, because the id does", () => {
    // A German sentence rendered as two English ones keeps the source id with a letter suffix
    // (AGENTS.md: `s3-p2-s1a`). None is on a Results face today; the grammar admits it.
    expect(place("s3-p2-s1a")).toBe("§ 3, paragraph 2, sentence 1a");
    expect(place("s3-p2-s1b")).toBe("§ 3, paragraph 2, sentence 1b");
  });

  it("an unrecognised anchor is returned unchanged rather than mis-described", () => {
    expect(place("closing-dateline")).toBe("closing-dateline");
  });
});

describe("place: the property am-jmma asked for", () => {
  /** The anchors that collided before this fix, plus their paragraph-level neighbours. */
  const ANCHORS = [
    "s5-p2",
    "s5-p2-s7",
    "s5-p2-s8",
    "s8-p10",
    "s8-p10-s1",
    "s8-p10-s2",
    "s0-p7",
    "s0-p7-s1",
    "s0-p7-s2",
    "eq-s5-d5",
    "eq-s5-d6",
    "s5",
  ] as const;

  it("ONE NAME, ONE DESTINATION: distinct anchors never share a place", () => {
    const byPlace = new Map<string, Set<string>>();
    for (const anchor of ANCHORS) {
      const key = place(anchor);
      const set = byPlace.get(key) ?? new Set<string>();
      set.add(anchor);
      byPlace.set(key, set);
    }
    const collisions = [...byPlace]
      .filter(([, anchors]) => anchors.size > 1)
      .map(([name, anchors]) => `${name} <- ${[...anchors].join(", ")}`);
    expect(collisions).toEqual([]);
    // Non-vacuity: every anchor produced a distinct key, so the map is as large as the input.
    expect(byPlace.size).toBe(ANCHORS.length);
  });

  it("the planted regression: the old prefix match collapsed a paragraph's sentences", () => {
    // Kept as an explicit negative so the prefix form cannot return under a passing suite.
    const oldPlace = (anchor: string): string => {
      const paragraph = anchor.match(/^s(\d+)-p(\d+)/);
      if (!paragraph) return anchor;
      const [, section, n] = paragraph;
      return section === "0" ? `paragraph ${n}` : `§ ${section}, paragraph ${n}`;
    };
    expect(oldPlace("s5-p2-s7")).toBe(oldPlace("s5-p2-s8"));
    expect(oldPlace("s5-p2-s7")).toBe(oldPlace("s5-p2"));
    // And the repair separates exactly those three.
    expect(new Set([place("s5-p2-s7"), place("s5-p2-s8"), place("s5-p2")]).size).toBe(3);
  });
});

describe("sourceLinkName: named from the destination, which is where the collision was", () => {
  /** The two excerpts that collided: one paragraph, two sentences, two destinations. */
  const entry = (germanHref: string) => ({
    anchor: "s5-p2",
    kind: "sentences" as const,
    text: "",
    page: 906,
    germanHref,
  });

  it("two excerpts from ONE paragraph get two names, because they go to two sentences", () => {
    const a = sourceLinkName(entry("/papers/special-relativity/view/german/#s5-p2-s7"));
    const b = sourceLinkName(entry("/papers/special-relativity/view/german/#s5-p2-s8"));
    expect(a).toBe("Text on page 906 of the German source, § 5, paragraph 2, sentence 7");
    expect(b).toBe("Text on page 906 of the German source, § 5, paragraph 2, sentence 8");
    expect(a).not.toBe(b);
  });

  it("the planted regression: naming from the paragraph anchor collapsed them", () => {
    // What the code did before. Both entries carry anchor "s5-p2", so the paragraph can never
    // separate them however well `place` describes it; only the destination can.
    const oldName = (p: { anchor: string; page: number }) =>
      `Text on page ${p.page} of the German source, ${place(p.anchor)}`;
    expect(oldName({ anchor: "s5-p2", page: 906 })).toBe(oldName({ anchor: "s5-p2", page: 906 }));
    expect(place("s5-p2")).toBe("§ 5, paragraph 2");
  });

  it("an href with no fragment falls back to the anchor rather than losing its place", () => {
    expect(sourceLinkName(entry("/papers/special-relativity/view/german/"))).toBe(
      "Text on page 906 of the German source, § 5, paragraph 2",
    );
  });

  it("a display row keeps the words it had", () => {
    expect(
      sourceLinkName({
        anchor: "eq-s5-d5",
        kind: "display",
        text: "",
        page: 906,
        germanHref: "/papers/special-relativity/view/german/#eq-s5-d5",
      }),
    ).toBe("Display on page 906 of the German source, § 5, display 5");
  });

  it("a run across a page turn names both pages", () => {
    expect(
      sourceLinkName({
        anchor: "s5-p2",
        kind: "sentences",
        text: "",
        page: 906,
        lastPage: 907,
        germanHref: "/papers/special-relativity/view/german/#s5-p2-s7",
      }),
    ).toBe("Text on pages 906\u2013907 of the German source, § 5, paragraph 2, sentence 7");
  });
});
