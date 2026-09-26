/**
 * The Discover pages' formulas in their papers' colours (dispatch 276).
 *
 * The census of the pages themselves is src/app/discover/formulaCensus.test.tsx. The bindings
 * asserted below are the ones a naive reading gets wrong: the relativity investigation's a(v) is the
 * modern ansatz's, not § 3's printed a; Brownian § 2's ν is the number density only in the
 * paragraph the journey quotes; and a page's reading reaches no other page.
 */
import { describe, expect, test } from "bun:test";
import { resolveInlineTerms } from "../equations/printed/inlineTerms.ts";
import { journeyScope } from "./JourneyFormula.tsx";
import {
  JourneyFormulaError,
  JourneyReadingsError,
  journeyContext,
  journeyFormula,
  loadDiscoverReadings,
  parseJourneyExceptions,
  parseJourneyReadings,
} from "./journeyFormulas.ts";

describe("the bindings a naive reading gets wrong", () => {
  const terms = (latex: string, scope: ReturnType<typeof journeyScope>) =>
    journeyFormula(latex, scope, true).terms.map((t) => `${t.glyph}=${t.quantityId}`);

  test("the relativity investigation's a(v) is the modern ansatz's, not § 3's printed a", () => {
    const scope = journeyScope("special-relativity", "s3", "linear-map", "investigate");
    expect(terms("x'=a(v)(x-vt),\\qquad t'=b(v)t+d(v)x", scope)).toEqual([
      "x'=coordinatePositionMoving",
      "a=ansatzSpatialScale",
      "v=frameSpeed",
      "x=coordinatePositionStationary",
      "v=frameSpeed",
      "t=coordinateTimeStationary",
      "t'=coordinateTimeMoving",
      "b=ansatzTimeScale",
      "v=frameSpeed",
      "t=coordinateTimeStationary",
      "d=ansatzTimeSpaceCoefficient",
      "v=frameSpeed",
      "x=coordinatePositionStationary",
    ]);
  });

  test("Brownian's ⟨x²⟩ = 2Dt reads t as the laboratory on the same page does", () => {
    // The embedded BM-01 explorer colours the t of λ_x = √(2Dt) as the observation interval; the
    // journey's own formula, a few lines above it, read § 4's t as the field's time coordinate,
    // so one letter took two colours on one page.
    const scope = journeyScope("brownian-motion", "s4", "step-04");
    const bound = terms("\\langle x^2\\rangle=2Dt \\qquad \\lambda_x=\\sqrt{2Dt}", scope);
    expect(bound).toContain("t=observationInterval");
    expect(bound).not.toContain("t=fieldTimeCoordinate");
  });

  test("a page's reading reaches no other page: the journey reads § 3's a as printed", () => {
    const journey = journeyContext("special-relativity", "discover-special-relativity");
    const resolved = resolveInlineTerms(
      "a",
      { paper: "special-relativity", where: "probe", anchor: "s3", section: "s3" },
      journey,
    );
    expect(resolved.terms.map((t) => t.quantityId)).toEqual(["transformationCoefficientA"]);
  });

  test("Brownian § 2's ν is the number density in the paragraph the journey quotes, not elsewhere", () => {
    const quoted = journeyScope("brownian-motion", "s2", "step-02", "journey", "s2-p7");
    expect(terms("p=\\frac{RT}{N}\\,\\nu", quoted)).toContain("\\nu=numberDensity");
    const section = resolveInlineTerms(
      "\\nu",
      { paper: "brownian-motion", where: "probe", anchor: "s2", section: "s2" },
      journeyContext("brownian-motion", "discover-brownian-motion"),
    );
    expect(section.terms).toEqual([]);
    expect(section.declared).toBe(1);
  });

  test("an unbound glyph stops the build, naming the page, the step and the glyph", () => {
    let error: unknown;
    try {
      journeyFormula("q = D", journeyScope("brownian-motion", "s4", "step-99"), true);
    } catch (e) {
      error = e;
    }
    expect(error).toBeInstanceOf(JourneyFormulaError);
    expect((error as JourneyFormulaError).code).toBe("journey-formula-refused");
    expect((error as Error).message).toContain("discover/brownian-motion step-99");
    expect((error as Error).message).toContain('"q"');
  });
});

describe("content/inline-terms/discover.yaml", () => {
  test("every reading and exception is checked, and each names its page", () => {
    const file = loadDiscoverReadings();
    expect(file.readings.length).toBeGreaterThan(0);
    expect(file.exceptions.length).toBeGreaterThan(0);
    for (const r of file.readings) expect(r.anchor).toMatch(/^discover-/);
    for (const e of file.exceptions) for (const s of e.scope) expect(s).toMatch(/^discover-/);
  });

  const registered = (id: string) => id === "viscosity";
  const reading = {
    paper: "brownian-motion",
    anchor: "discover-brownian-motion",
    glyph: "\\eta",
    quantityId: "viscosity",
    reason: "The fluid's viscosity, as the journey's Stokes formula writes it.",
  };
  const codeOf = (run: () => unknown) => {
    try {
      run();
    } catch (error) {
      return error instanceof JourneyReadingsError ? error.code : String(error);
    }
    return "accepted";
  };

  test("a reading is refused without a page anchor, one atom, a registered quantity or a reason", () => {
    const parse = (r: unknown) => () => parseJourneyReadings({ readings: [r] }, "t", registered);
    expect(codeOf(parse(reading))).toBe("accepted");
    expect(codeOf(() => parseJourneyReadings({ readings: "x" }, "t", registered))).toBe(
      "journey-readings-not-a-list",
    );
    expect(codeOf(parse({ ...reading, anchor: "s3" }))).toBe("journey-reading-no-anchor");
    expect(codeOf(parse({ ...reading, glyph: "a+b" }))).toBe("journey-reading-glyph-not-one-atom");
    expect(codeOf(parse({ ...reading, quantityId: "dynamicViscosity" }))).toBe(
      "journey-reading-unregistered-quantity",
    );
    expect(codeOf(parse({ ...reading, reason: "viscosity" }))).toBe("journey-reading-no-reason");
  });

  test("an exception is refused without page anchors, one atom or a reason", () => {
    const exception = {
      paper: "brownian-motion",
      glyph: "\\pi",
      scope: ["discover-brownian-motion"],
      reason: "The number π, a constant of geometry and no quantity.",
    };
    const parse = (e: unknown) => () => parseJourneyExceptions({ exceptions: [e] }, "t");
    expect(codeOf(parse(exception))).toBe("accepted");
    expect(codeOf(() => parseJourneyExceptions({ exceptions: {} }, "t"))).toBe(
      "journey-exceptions-not-a-list",
    );
    expect(codeOf(parse({ ...exception, scope: ["s3"] }))).toBe("journey-exception-no-scope");
    expect(codeOf(parse({ ...exception, glyph: "6\\pi" }))).toBe(
      "journey-exception-glyph-not-one-atom",
    );
    expect(codeOf(parse({ ...exception, reason: "pi" }))).toBe("journey-exception-no-reason");
  });
});
