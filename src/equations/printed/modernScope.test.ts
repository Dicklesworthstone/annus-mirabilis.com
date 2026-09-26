/**
 * The modern scope (modernScope.ts), read through the real resolver, concordances and registries.
 * Each case is a formula an explanation or a laboratory writes, in the section it is written for.
 * The negatives are collisions in the concordances themselves, which the modern readings must not
 * paper over: relativity's printed c is a direction cosine in § 7, where the modern c is the speed of
 * light.
 */
import { describe, expect, test } from "bun:test";
import { loadConcordanceForPaper } from "../../content/notation/loader.ts";
import { isRegisteredQuantityId } from "../../content/quantities/registry.ts";
import { resolveInlineTerms } from "./inlineTerms.ts";
import { modernInlineEntries } from "./modernScope.ts";

const PAPERS = ["mass-energy", "light-quanta", "brownian-motion", "special-relativity"];

/** The formula in its section, the section as its own anchor, as an explanation passage has it. */
function resolve(paper: string, latex: string, section: string, modern = true) {
  const concordance = loadConcordanceForPaper(paper);
  const r = resolveInlineTerms(
    latex,
    { paper, where: "modernScope.test", anchor: section, section },
    {
      concordance: modern ? modernInlineEntries(paper, concordance) : concordance.entries,
      isRegistered: isRegisteredQuantityId,
      exceptions: [],
    },
  );
  return {
    terms: r.terms.map((t) => `${t.glyph} ${t.quantityId}`),
    problems: r.problems.map((p) => `${p.code} ${p.glyph}`),
  };
}

describe("the modern scope for inline formulas", () => {
  test("every paper gains readings, and the count is printed", () => {
    for (const paper of PAPERS) {
      const concordance = loadConcordanceForPaper(paper);
      const added = modernInlineEntries(paper, concordance).length - concordance.entries.length;
      console.log(
        `[modern scope] ${paper}: ${concordance.entries.length} printed entries + ${added} readings`,
      );
      expect(added).toBeGreaterThan(0);
    }
  });

  test("a modern letter the printed concordance leaves unbound: c in mass-energy", () => {
    // Positive control: without the modern readings c has no reading, so the case can fail.
    expect(resolve("mass-energy", "v/c", "s0", false).problems).toEqual([
      "inline-terms-unbound-glyph c",
    ]);
    expect(resolve("mass-energy", "v/c", "s0")).toEqual({
      terms: ["v frameSpeed", "c speedOfLight"],
      problems: [],
    });
  });

  test("a registry letter no plate prints: m_loss", () => {
    expect(resolve("mass-energy", "m_{\\mathrm{loss}}", "s0")).toEqual({
      terms: ["m_{\\mathrm{loss}} inertialMassDecrease"],
      problems: [],
    });
  });

  test("a printed reading outranks the registry in its sections, and the registry fills in elsewhere", () => {
    // Light quanta prints L for the speed of light in §§ 1-2; the registry's L is the absorbed energy.
    expect(resolve("light-quanta", "L", "s2").terms).toEqual(["L speedOfLight"]);
    expect(resolve("light-quanta", "L", "s6").terms).toEqual(["L absorbedLightEnergy"]);
  });

  test("a glyph the paper prints paper-wide keeps its printed reading: Brownian's x is a coordinate label", () => {
    // Before, the registry's x (positionCoordinate1d) met it at the same level and ⟨x²⟩ was refused.
    expect(resolve("brownian-motion", "\\langle x^2\\rangle", "s4")).toEqual({
      terms: [],
      problems: [],
    });
  });

  test("a modern reading holds only in its rename's scope, and a same-section clash is refused", () => {
    // Einstein's C is renamed k_B in § 5 only; there it meets Boltzmann's k_B and is refused.
    expect(resolve("light-quanta", "k_B", "s2").terms).toEqual(["k_B boltzmannConstant"]);
    expect(resolve("light-quanta", "k_B", "s5").problems).toEqual([
      "inline-terms-ambiguous-glyph k_B",
    ]);
  });

  test("relativity's printed c (a direction cosine in § 7) is never read as the speed of light", () => {
    expect(resolve("special-relativity", "c", "s3").terms).toEqual(["c speedOfLight"]);
    expect(resolve("special-relativity", "c", "s7").problems).toEqual([
      "inline-terms-ambiguous-glyph c",
    ]);
  });
});
