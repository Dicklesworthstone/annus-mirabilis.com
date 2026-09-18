/**
 * Integration tests for expression tree dimensional analysis.
 * Specified in am-eq-expression-tree-8kl (Test Plan: dimensions.integration.test.ts).
 */

import { describe, expect, test } from "bun:test";
import { checkDimensions, type QuantityRegistryMap } from "../../content/dimensions/check.ts";
import { getQuantityRegistry } from "../../content/quantities/registry.ts";
import { FIXTURE_2_MODERN_DIFFUSION } from "./fixtures.ts";
import type { Expression } from "./types.ts";

describe("Expression Tree Dimensions Integration (dimensions.integration.test.ts)", () => {
  // Build registry map from canonical quantity registry
  const reg = getQuantityRegistry();
  const registryMap: QuantityRegistryMap = {};
  for (const [id, q] of reg.quantities.entries()) {
    const dim = q.dimension
      ? q.dimension.map((s) => (s.den === 1 ? String(s.num) : `${s.num}/${s.den}`))
      : ["0", "0", "0", "0", "0", "0"];
    const semKind = q.frequencyKind ?? q.timeKind ?? q.densityKind;
    registryMap[id] = {
      id: q.id,
      dimension: dim,
      ...(q.gaussianDimension
        ? {
            gaussianDimension: q.gaussianDimension.map((s) =>
              s.den === 1 ? String(s.num) : `${s.num}/${s.den}`,
            ),
          }
        : {}),
      ...(q.emuDimension
        ? {
            emuDimension: q.emuDimension.map((s) =>
              s.den === 1 ? String(s.num) : `${s.num}/${s.den}`,
            ),
          }
        : {}),
      ...(semKind ? { semanticKind: semKind } : {}),
      ...(q.dimensionlessKind ? { dimensionlessKind: q.dimensionlessKind } : {}),
    };
  }

  test("sqrt(Dt) resolves to length dimension [1, 0, 0, 0, 0, 0]", () => {
    const sqrtDt: Expression = {
      kind: "root",
      degree: 2,
      radicand: {
        kind: "product",
        args: [
          { kind: "symbol", termId: "eq-1.t.d", quantityId: "diffusionCoefficient" },
          { kind: "symbol", termId: "eq-1.t.t", quantityId: "elapsedTime" },
        ],
      },
    };

    const res = checkDimensions(sqrtDt, registryMap);
    expect(res.status).toBe("consistent");
    if (res.status === "consistent") {
      // Length slot is 1, all others 0: [length, mass, time, temperature, current, amount]
      expect(res.dimension[0]?.num).toBe(1n);
      expect(res.dimension[0]?.den).toBe(1n);
      expect(res.dimension[1]?.num).toBe(0n);
      expect(res.dimension[2]?.num).toBe(0n);
    }
  });

  test("k_B * T / (6 * pi * eta * a) resolves to area per time (diffusion coefficient dimension)", () => {
    const stokesTree = FIXTURE_2_MODERN_DIFFUSION.root as {
      kind: "relation";
      right: Expression;
    };
    const res = checkDimensions(stokesTree.right, registryMap);
    expect(res.status).toBe("consistent");
    if (res.status === "consistent") {
      // Area per time: length^2 * time^-1 = [2, 0, -1, 0, 0, 0]
      expect(res.dimension[0]?.num).toBe(2n);
      expect(res.dimension[0]?.den).toBe(1n);
      expect(res.dimension[1]?.num).toBe(0n);
      expect(res.dimension[2]?.num).toBe(-1n);
      expect(res.dimension[3]?.num).toBe(0n);
    }
  });

  test("an integral over frequency multiplies expression dimension by frequency dimension", () => {
    // Energy density per frequency [length^-1, mass, time^-1] integrated over frequency [time^-1]
    const integralExpr: Expression = {
      kind: "integral",
      expression: {
        kind: "symbol",
        termId: "eq-int.t.rho",
        quantityId: "frequencyEnergyDensity",
      },
      variable: {
        kind: "symbol",
        termId: "eq-int.t.nu",
        quantityId: "frequency",
      },
    };

    const res = checkDimensions(integralExpr, registryMap);
    expect(res.status).toBe("consistent");
    if (res.status === "consistent") {
      // frequencyEnergyDensity has dimension: [-1, 1, -1, 0, 0, 0]
      // frequency has dimension: [0, 0, -1, 0, 0, 0]
      // Integrated d(nu): [-1, 1, -1] + [0, 0, -1] = [-1, 1, -2] (energy density L^-1 M T^-2)!
      expect(res.dimension[0]?.num).toBe(-1n);
      expect(res.dimension[1]?.num).toBe(1n);
      expect(res.dimension[2]?.num).toBe(-2n);
    }
  });

  test("a Gaussian charge with half-integer exponents resolves exactly or returns unsupported-check, never a truncated exponent", () => {
    // Electric charge in Gaussian CGS: [length^3/2, mass^1/2, time^-1]
    registryMap["gaussianCharge"] = {
      id: "gaussianCharge",
      dimension: ["0", "0", "1", "0", "1", "0"],
      gaussianDimension: ["3/2", "1/2", "-1", "0", "0", "0"],
    };

    const chargeExpr: Expression = {
      kind: "symbol",
      termId: "eq-q.t.e",
      quantityId: "gaussianCharge",
    };

    const res = checkDimensions(chargeExpr, registryMap, { context: "gaussian-cgs" });
    if (res.status === "consistent") {
      // Exponents must be exactly half-integer, never truncated to integer
      expect(res.dimension[0]?.num).toBe(3n);
      expect(res.dimension[0]?.den).toBe(2n);
      expect(res.dimension[1]?.num).toBe(1n);
      expect(res.dimension[1]?.den).toBe(2n);
    } else {
      expect(res.status).toBe("unsupported-check");
    }
  });
});
