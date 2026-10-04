/**
 * THE EXPLAINER LINK'S ACCESSIBLE NAME, and the property that makes it worth having (am-enpr).
 *
 * The defect: every explainer link renders the same visible words, so a Results face presented a
 * links list of 33 entries all named "Explain this equation", each with a different destination.
 * Measured at 320 and 1440, in both themes, with script on and off: special-relativity 33 under one
 * name, light-quanta 20, brownian-motion 13, mass-energy 7.
 *
 * What is asserted here is not a set of strings but the two properties that fix it and keep it
 * fixed: the name identifies the destination (distinct ids give distinct names), and it still
 * contains the words on screen (WCAG 2.5.3, Label in Name). The per-shape expectations below exist
 * so the PHRASING is reviewable, not because any one of them is the point.
 */
import { describe, expect, it } from "bun:test";
import { EXPLAINER_LINK_TEXT, explainerHref, explainerLinkName } from "./explainerLinks.ts";

const paper = "special-relativity";

describe("explainerLinkName: the phrasing, one shape at a time", () => {
  it("names an unnumbered display by its section and display number", () => {
    expect(explainerLinkName({ paper, display: "eq-s8-d4" })).toBe(
      "Explain this equation: § 8, display 4",
    );
    expect(explainerLinkName({ paper, display: "eq-s10-d12" })).toBe(
      "Explain this equation: § 10, display 12",
    );
  });

  it("names a display in a paper with no sections without inventing one", () => {
    // AGENTS.md, naming conventions: "Paper 4 has no sections and uses `s0`". Saying "§ 0" would be
    // naming a section the paper does not print.
    expect(explainerLinkName({ paper: "mass-energy", display: "eq-s0-d7" })).toBe(
      "Explain this equation: display 7",
    );
  });

  it("names a printed label, including one carrying a letter", () => {
    expect(explainerLinkName({ paper, display: "eq-7" })).toBe("Explain this equation: equation 7");
    expect(explainerLinkName({ paper, display: "eq-7a" })).toBe(
      "Explain this equation: equation 7a",
    );
  });

  it("qualifies a printed label that repeats within the paper", () => {
    expect(explainerLinkName({ paper, display: "eq-s8-5" })).toBe(
      "Explain this equation: equation 5 in § 8",
    );
  });

  it("falls back to the id rather than leaving a link unnamed", () => {
    // An awkward name beats an ambiguous one, so an unrecognised shape is still distinguished.
    expect(explainerLinkName({ paper, display: "eq-something-odd" })).toBe(
      "Explain this equation: something-odd",
    );
    expect(explainerLinkName({ paper, equation: "model-lorentz" })).toBe(
      "Explain this equation: model-lorentz",
    );
  });

  it("gives the bare visible words when there is no id at all", () => {
    // Nothing to add, and an empty suffix would read as "Explain this equation: ".
    expect(explainerLinkName({ paper })).toBe(EXPLAINER_LINK_TEXT);
  });
});

describe("explainerLinkName: the properties that make the fix hold", () => {
  /** The ids actually in use on the four Results faces, read from the built pages. */
  const REAL_IDS = [
    "eq-s1-d1",
    "eq-s1-d2",
    "eq-s10-d10",
    "eq-s10-d12",
    "eq-s10-d4",
    "eq-s0-d1",
    "eq-s0-d7",
    "eq-s2-d4",
    "eq-s3-d8",
    "eq-s4-d5",
  ] as const;

  it("ONE NAME, ONE DESTINATION: distinct ids never share a name", () => {
    // This is the assertion the e2e gate makes against a rendered page, held here over the shapes
    // without a browser. It holds by construction because both the name and the href are derived
    // from the same id, and this test is what keeps that true if either derivation changes.
    const byName = new Map<string, Set<string>>();
    for (const display of REAL_IDS) {
      const name = explainerLinkName({ paper, display });
      const hrefs = byName.get(name) ?? new Set<string>();
      hrefs.add(explainerHref({ paper, display }));
      byName.set(name, hrefs);
    }
    const ambiguous = [...byName]
      .filter(([, hrefs]) => hrefs.size > 1)
      .map(([name, hrefs]) => `${name} -> ${hrefs.size} destinations`);
    expect(ambiguous).toEqual([]);
    // Non-vacuity: the loop must have examined every id, or an empty map would also pass.
    expect(byName.size).toBe(REAL_IDS.length);
  });

  it("LABEL IN NAME: every name begins with the words on screen (WCAG 2.5.3)", () => {
    for (const display of REAL_IDS) {
      expect(explainerLinkName({ paper, display }).startsWith(EXPLAINER_LINK_TEXT)).toBe(true);
    }
  });

  it("the planted regression: a name that ignored its id would be caught here", () => {
    // What the code did before, as an explicit negative, so the old behaviour cannot return under a
    // passing suite: a constant name over distinct destinations is exactly the ambiguity the gate
    // measured on the Results faces.
    const constantName = (_: { paper: string; display: string }) => EXPLAINER_LINK_TEXT;
    const byName = new Map<string, Set<string>>();
    for (const display of REAL_IDS) {
      const name = constantName({ paper, display });
      const hrefs = byName.get(name) ?? new Set<string>();
      hrefs.add(explainerHref({ paper, display }));
      byName.set(name, hrefs);
    }
    expect(byName.size).toBe(1);
    expect([...byName.values()][0]?.size).toBe(REAL_IDS.length);
  });
});
