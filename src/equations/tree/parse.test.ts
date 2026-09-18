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
});
