/**
 * Unit tests for authoring format parser and printer.
 * Specified in am-eq-expression-tree-8kl (Test Plan: parse.test.ts).
 */

import { describe, expect, test } from "bun:test";
import { ParseError, ParseLimitError, parseAuthoring } from "./parse.ts";
import { printAuthoring } from "./printAuthoring.ts";
import type { Expression } from "./types.ts";
import { structuralEqual } from "./walk.ts";

describe("Authoring Format Parser (parse.test.ts)", () => {
  const symbols = {
    a: { termId: "eq-1.t.a", quantityId: "quantityA" },
    b: { termId: "eq-1.t.b", quantityId: "quantityB" },
    c: { termId: "eq-1.t.c", quantityId: "quantityC" },
    x: { termId: "eq-1.t.x", quantityId: "coordinateX" },
    k: { termId: "eq-1.t.k", quantityId: "viscosity" },
    kappa: { termId: "eq-1.t.kappa", quantityId: "boltzmannConstant" },
    k_B: { termId: "eq-1.t.kB", quantityId: "boltzmannConstant" },
    T: { termId: "eq-1.t.t", quantityId: "temperature" },
    D: { termId: "eq-1.t.d", quantityId: "diffusionCoefficient" },
    t: { termId: "eq-1.t.time", quantityId: "timeElapsed" },
    eta: { termId: "eq-1.t.eta", quantityId: "viscosity" },
    v: { termId: "eq-1.t.v", quantityId: "frameSpeed" },
    gamma: { termId: "eq-1.t.gamma", quantityId: "lorentzFactor" },
    Phi: { termId: "eq-1.t.phi", quantityId: "workFunction" },
    nu: { termId: "eq-1.t.nu", quantityId: "frequency" },
    h: { termId: "eq-1.t.h", quantityId: "planckConstant" },
    s_nu: { termId: "eq-1.t.sNu", quantityId: "entropyDensity" },
    rho_nu: { termId: "eq-1.t.rhoNu", quantityId: "energyDensity" },
  };

  test("precedence and associativity: a - b - c parses as (a - b) - c", () => {
    const parsed = parseAuthoring("a - b - c", { symbols });
    const expected: Expression = {
      kind: "sum",
      args: [
        {
          kind: "sum",
          args: [
            { kind: "symbol", termId: "eq-1.t.a", quantityId: "quantityA" },
            {
              kind: "negate",
              argument: { kind: "symbol", termId: "eq-1.t.b", quantityId: "quantityB" },
            },
          ],
        },
        {
          kind: "negate",
          argument: { kind: "symbol", termId: "eq-1.t.c", quantityId: "quantityC" },
        },
      ],
    };
    expect(structuralEqual(parsed, expected)).toBe(true);
  });

  test("precedence and associativity: -x^2 parses as -(x^2)", () => {
    const parsed = parseAuthoring("-x^2", { symbols });
    const expected: Expression = {
      kind: "negate",
      argument: {
        kind: "power",
        base: { kind: "symbol", termId: "eq-1.t.x", quantityId: "coordinateX" },
        exponent: { kind: "number", value: "2" },
      },
    };
    expect(structuralEqual(parsed, expected)).toBe(true);
  });

  test("precedence and associativity: a / b * c parses as (a / b) * c", () => {
    const parsed = parseAuthoring("a / b * c", { symbols });
    const expected: Expression = {
      kind: "product",
      style: "explicit",
      args: [
        {
          kind: "quotient",
          style: "solidus",
          numerator: { kind: "symbol", termId: "eq-1.t.a", quantityId: "quantityA" },
          denominator: { kind: "symbol", termId: "eq-1.t.b", quantityId: "quantityB" },
        },
        { kind: "symbol", termId: "eq-1.t.c", quantityId: "quantityC" },
      ],
    };
    expect(structuralEqual(parsed, expected)).toBe(true);
  });

  test("explicit versus juxtaposed products", () => {
    const explicit = parseAuthoring("a * b", { symbols });
    const juxtaposed = parseAuthoring("a b", { symbols });

    expect(explicit.kind).toBe("product");
    expect(juxtaposed.kind).toBe("product");
    if (explicit.kind === "product" && juxtaposed.kind === "product") {
      expect(explicit.style).toBe("explicit");
      expect(juxtaposed.style).toBe("juxtaposed");
    }
  });

  test("unknown identifier failure", () => {
    expect(() => parseAuthoring("a + unknownVar", { symbols })).toThrow(ParseError);
    expect(() => parseAuthoring("a + unknownVar", { symbols })).toThrow(
      /Unknown identifier 'unknownVar'/,
    );
  });

  test("identifiers containing letters of LaTeX command names do not bind (sinh, kappa, and k_B never bind k)", () => {
    const parsedSinh = parseAuthoring("sinh(x)", { symbols });
    expect(parsedSinh.kind).toBe("function");
    if (parsedSinh.kind === "function") {
      expect(parsedSinh.name).toBe("sinh");
    }

    const parsedKappa = parseAuthoring("kappa", { symbols });
    expect(parsedKappa.kind).toBe("symbol");
    if (parsedKappa.kind === "symbol") {
      expect(parsedKappa.termId).toBe("eq-1.t.kappa");
      expect(parsedKappa.quantityId).toBe("boltzmannConstant");
    }

    const parsedKB = parseAuthoring("k_B", { symbols });
    expect(parsedKB.kind).toBe("symbol");
    if (parsedKB.kind === "symbol") {
      expect(parsedKB.termId).toBe("eq-1.t.kB");
      expect(parsedKB.quantityId).toBe("boltzmannConstant");
    }
  });

  test("derivative with a held-fixed annotation", () => {
    const parsed = parseAuthoring("pdiff(s_nu, rho_nu, 1, nu)", { symbols });
    expect(parsed.kind).toBe("derivative");
    if (parsed.kind === "derivative") {
      expect(parsed.partial).toBe(true);
      expect(parsed.order).toBe(1);
      expect(parsed.heldFixed).toBeDefined();
      if (parsed.heldFixed && typeof parsed.heldFixed === "object") {
        expect(parsed.heldFixed.kind).toBe("symbol");
      }
    }
  });

  test("integral with bounds", () => {
    const parsed = parseAuthoring("int(x^2, x, 0, 1)", { symbols });
    expect(parsed.kind).toBe("integral");
    if (parsed.kind === "integral") {
      expect(parsed.lowerBound).toBeDefined();
      expect(parsed.upperBound).toBeDefined();
    }
  });

  test("piecewise expression", () => {
    const parsed = parseAuthoring("piecewise([h * nu >= Phi, h * nu - Phi], 0)", { symbols });
    expect(parsed.kind).toBe("piecewise");
    if (parsed.kind === "piecewise") {
      expect(parsed.cases.length).toBe(1);
      expect(parsed.otherwise).toBeDefined();
    }
  });

  test("matrix expression", () => {
    const parsed = parseAuthoring("matrix([[gamma, -gamma * v], [-gamma * v / c^2, gamma]])", {
      symbols,
    });
    expect(parsed.kind).toBe("matrix");
    if (parsed.kind === "matrix") {
      expect(parsed.rows.length).toBe(2);
      expect(parsed.rows[0]?.length).toBe(2);
    }
  });

  test("nesting depth 65 and a 9 KiB expression fail with typed limit errors", () => {
    // 9 KiB source
    const longSource = "a + ".repeat(2500) + "a";
    expect(longSource.length).toBeGreaterThan(8192);
    expect(() => parseAuthoring(longSource, { symbols })).toThrow(ParseLimitError);
    try {
      parseAuthoring(longSource, { symbols });
    } catch (e) {
      expect((e as ParseLimitError).code).toBe("size-limit");
    }

    // 65 nesting depth
    const deepSource = "(".repeat(66) + "a" + ")".repeat(66);
    expect(() => parseAuthoring(deepSource, { symbols })).toThrow(ParseLimitError);
    try {
      parseAuthoring(deepSource, { symbols });
    } catch (e) {
      expect((e as ParseLimitError).code).toBe("depth-limit");
    }
  });

  test("a Cyrillic 'а' in an identifier fails", () => {
    // \u0430 is Cyrillic small letter a
    const cyrillicA = "\u0430";
    expect(() => parseAuthoring(`k_${cyrillicA}`, { symbols })).toThrow(ParseError);
    expect(() => parseAuthoring(`k_${cyrillicA}`, { symbols })).toThrow(/Non-ASCII/);
  });

  /**
   * Arity and syntax refusals (am-muyh).
   *
   * A deletion-mode plant sweep found 19 of this parser's 23 throw sites
   * deletable with parse.test.ts and roundtrip.property.test.ts fully green.
   * An unexercised arity guard is not a cosmetic gap: with it gone,
   * sqrt(a, b) silently builds a root node from the first argument and drops
   * the second, and the malformed authoring reaches publication as a valid
   * tree. Each case below asserts the guard's own message, so a test pins one
   * site rather than the word ParseError.
   *
   * One site is not covered here and cannot be: parse.ts:542, the
   * "Unexpected infix token" default. getInfixPrecedence returns the floor
   * for every token type that the branches above it do not handle, so no
   * input reaches it. That is an argument from the dispatch, not a fuzz
   * result, and it is recorded rather than papered over with a test that
   * would have to reach inside the parser to fire.
   */
  describe("arity and syntax refusals, one case per throw site", () => {
    const cases: readonly (readonly [string, string, RegExp])[] = [
      ["parse.ts:140", "(a", /Expected '\)' to close grouped expression/],
      ["parse.ts:257", ")", /Unexpected token '\)' \(RPAREN\)/],
      ["parse.ts:274", "frac(a)", /frac\(numerator, denominator\) requires exactly 2 arguments/],
      ["parse.ts:286", "sqrt(a, b)", /sqrt\(radicand\) requires exactly 1 argument/],
      ["parse.ts:293", "root(a)", /root\(radicand, degree\) requires exactly 2 arguments/],
      ["parse.ts:302", "ln(a, b)", /ln\(x\) requires exactly 1 argument/],
      ["parse.ts:309", "diff(a)", /diff\(.*\) requires at least 2 arguments/],
      ["parse.ts:328", "int(a)", /int\(.*\) requires at least 2 arguments/],
      ["parse.ts:344", "sum(a)", /sum\(.*\) requires at least 2 arguments/],
      ["parse.ts:360", "prod(a)", /prod\(.*\) requires at least 2 arguments/],
      ["parse.ts:376", "limit(a, x)", /limit\(body, variable, target\) requires 3 arguments/],
      ["parse.ts:388", "avg(a, b)", /avg\(x\) requires 1 argument/],
      ["parse.ts:395", "norm(a, b)", /norm\(x\) requires 1 argument/],
      ["parse.ts:402", "dot(a)", /dot\(a, b\) requires 2 arguments/],
      ["parse.ts:409", "cross(a)", /cross\(a, b\) requires 2 arguments/],
      ["parse.ts:466", "bogusfn(a)", /Unknown function or operator 'bogusfn'/],
      ["parse.ts:578", "a )", /Extra tokens after expression: '\)'/],
      ["parse.ts:794", "a # b", /Unexpected character '#'/],
    ];

    for (const [site, source, message] of cases) {
      test(`site (${site}) refuses ${JSON.stringify(source)}`, () => {
        expect(() => parseAuthoring(source, { symbols })).toThrow(ParseError);
        expect(() => parseAuthoring(source, { symbols })).toThrow(message);
      });
    }

    test("the accept side: every refused form has a well-formed counterpart that parses", () => {
      // Without these the cases above would pass against a parser that
      // refused everything.
      for (const source of [
        "(a)",
        "a",
        "frac(a, b)",
        "sqrt(a)",
        "root(a, 2)",
        "ln(a)",
        "diff(a, x)",
        "int(a, x)",
        "sum(a, x)",
        "prod(a, x)",
        "limit(a, x, 0)",
        "avg(a)",
        "norm(a)",
        "dot(a, b)",
        "cross(a, b)",
        "a + b",
      ]) {
        expect(() => parseAuthoring(source, { symbols })).not.toThrow();
      }
    });
  });
});
