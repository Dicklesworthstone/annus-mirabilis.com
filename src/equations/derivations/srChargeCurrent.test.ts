import { describe, expect, test } from "bun:test";
import { fourCurrentInvariants, transformChargeCurrent } from "../../physics/reference/fields.ts";
import type { Expression } from "../ast.ts";
import { evaluateExpression } from "./spotCheck.ts";
import {
  srChargeCurrentAssumptions,
  srChargeCurrentChains,
  srChargeCurrentPremises,
  srChargeDensity,
  srChargeDensityChain,
  srCurrentXChain,
  srLongitudinalCurrent,
  srTotalChargeChain,
  srTotalCurrentChain,
  srTransverseCurrents,
} from "./srChargeCurrent.ts";
import { verifySRChargeCurrent } from "./srChargeCurrentProof.ts";
import { substituteNode } from "./treeUtils.ts";
import type { DerivationChain } from "./types.ts";
import { verifyChain } from "./verifyChain.ts";

const twice = (value: Expression): Expression => ({
  kind: "product",
  args: [{ kind: "number", value: "2" }, value],
});

describe("SR §9 conditional charge/current proof", () => {
  test("six nonempty routes check every density, current and superposition transformation exactly", () => {
    expect(srChargeCurrentChains).toHaveLength(6);
    expect(srChargeCurrentChains.flatMap((chain) => chain.steps)).toHaveLength(22);
    for (const chain of srChargeCurrentChains) {
      const report = verifySRChargeCurrent(chain);
      expect(report.errors).toEqual([]);
      expect(report.passed).toBe(true);
      expect(report.isPublicationReady).toBe(true);
      expect(report.stepReports).toHaveLength(chain.steps.length);
      expect(report.stepReports.length).toBeGreaterThan(0);
      expect(report.stepReports.every((step) => step.verificationStatus === "verified")).toBe(true);
    }
    console.log("[sr-charge-current] 6 routes; 22 exactly checked transformations");
  });

  test("admitted source laws, species definitions, nonzero domain and additivity cannot disappear", () => {
    for (const chain of srChargeCurrentChains) {
      for (const assumption of srChargeCurrentAssumptions) {
        const dropped = {
          ...chain,
          entryAssumptions: chain.entryAssumptions.filter((premise) => premise.ref !== assumption.id),
        };
        expect(verifySRChargeCurrent(dropped).passed).toBe(false);
      }
      const withoutProducer: DerivationChain = {
        ...chain,
        steps: chain.steps.map((step, index) => index === 1 ? { ...step, premiseRefs: [] } : step),
      };
      expect(verifySRChargeCurrent(withoutProducer).passed).toBe(false);
      const truncated: DerivationChain = {
        ...chain,
        steps: chain.steps.slice(0, -1),
        targetStepId: chain.steps.at(-2)!.id,
      };
      expect(verifySRChargeCurrent(truncated).passed).toBe(false);
    }
    expect(verifySRChargeCurrent(srTotalChargeChain, srChargeCurrentChains.slice(1)).passed).toBe(false);
    expect(verifySRChargeCurrent(srTotalCurrentChain, [
      srChargeDensityChain, ...srChargeCurrentChains.slice(0, -1),
    ]).passed).toBe(false);
  });

  test("a locally valid substitution cannot invent the density producer", () => {
    const first = srCurrentXChain.steps[0]!;
    const forged = twice(first.rule.params.replacement as Expression);
    const forgedStep = {
      ...first,
      rule: { ...first.rule, params: { ...first.rule.params, replacement: forged } },
      to: substituteNode(first.from, "ρ'", forged),
    };
    const local = { ...srCurrentXChain, steps: [forgedStep], targetStepId: forgedStep.id };
    // The generic rule checks application of the supplied replacement. The joined proof
    // also has to establish where that replacement came from.
    expect(verifyChain(local).stepReports[0]?.ruleOutcome).toBe("pass");
    const changed = { ...srCurrentXChain, steps: [forgedStep, ...srCurrentXChain.steps.slice(1)] };
    expect(verifySRChargeCurrent(changed).passed).toBe(false);
    const changedFamily = srChargeCurrentChains.map((chain) => chain.id === changed.id ? changed : chain);
    expect(verifySRChargeCurrent(srTotalCurrentChain, changedFamily).passed).toBe(false);
  });

  test("reversing the convection sign or doubling the producer cannot pass exact collection", () => {
    const collect = srCurrentXChain.steps[2]!;
    const reversedVelocity: Expression = {
      kind: "negate",
      argument: { kind: "symbol", termId: "v", quantityId: "frameSpeed" },
    };
    const wrongSign = { ...collect, to: substituteNode(collect.to, "v", reversedVelocity) };
    expect(verifyChain({
      ...srCurrentXChain, steps: [wrongSign], targetStepId: wrongSign.id,
    }).stepReports[0]?.ruleOutcome).toBe("fail");
    const wrongFactor = { ...collect, to: substituteNode(collect.to, "γ", twice({
      kind: "symbol", termId: "γ", quantityId: "lorentzFactor",
    })) };
    expect(verifyChain({
      ...srCurrentXChain, steps: [wrongFactor], targetStepId: wrongFactor.id,
    }).stepReports[0]?.ruleOutcome).toBe("fail");

    for (const forged of [wrongSign, wrongFactor]) {
      const changed = {
        ...srCurrentXChain,
        steps: srCurrentXChain.steps.map((step) => step.id === forged.id ? forged : step),
      };
      expect(verifySRChargeCurrent(changed).passed).toBe(false);
      expect(verifySRChargeCurrent(srTotalCurrentChain, srChargeCurrentChains.map(
        (chain) => chain.id === changed.id ? changed : chain,
      )).passed).toBe(false);
    }
  });

  test("single-species density times transformed velocity agrees with all current components", () => {
    let comparisons = 0;
    for (const c of [1, 2.5, 7]) {
      for (const beta of [-0.9, -0.6, 0, 0.6, 0.9]) {
        for (const rho of [-2, 0, 3]) {
          for (const uxFraction of [-0.7, 0, 0.4, 0.7]) {
            const v = beta * c;
            const ux = uxFraction * c;
            const uy = 0.2 * c;
            const uz = -0.15 * c;
            const bindings = { "ρ": rho, v, c, "γ": 1 / Math.sqrt(1 - beta * beta),
              u_x: ux, u_y: uy, u_z: uz, J_x: rho * ux, J_y: rho * uy, J_z: rho * uz };
            const density = evaluateExpression(srChargeCurrentPremises.density.right, bindings);
            const movedVelocity = {
              x: evaluateExpression(srChargeCurrentPremises.velocityX.right, bindings),
              y: evaluateExpression(srChargeCurrentPremises.velocityY.right, bindings),
              z: evaluateExpression(srChargeCurrentPremises.velocityZ.right, bindings),
            };
            const owned = transformChargeCurrent({ rho, J: { x: rho * ux, y: rho * uy, z: rho * uz }, boost: v, c });
            expect(1 - v * ux / (c * c)).toBeGreaterThan(0);
            expect(density).toBeCloseTo(owned.rho, 11);
            expect(density * movedVelocity.x).toBeCloseTo(owned.J.x, 10);
            expect(density * movedVelocity.y).toBeCloseTo(owned.J.y, 11);
            expect(density * movedVelocity.z).toBeCloseTo(owned.J.z, 11);
            expect(evaluateExpression(srChargeDensity.right, bindings)).toBeCloseTo(owned.rho, 11);
            expect(evaluateExpression(srLongitudinalCurrent.right, bindings)).toBeCloseTo(owned.J.x, 10);
            expect(evaluateExpression(srTransverseCurrents.y.right, bindings)).toBe(owned.J.y);
            expect(evaluateExpression(srTransverseCurrents.z.right, bindings)).toBe(owned.J.z);
            comparisons++;
          }
        }
      }
    }
    expect(comparisons).toBe(180);
  });

  test("a neutral mixture retains its current and agrees with adding transformed species", () => {
    const positive = transformChargeCurrent({ rho: 1, J: { x: 0, y: 0, z: 0 }, boost: 0.6, c: 1 });
    const negative = transformChargeCurrent({ rho: -1, J: { x: -0.4, y: 0, z: 0 }, boost: 0.6, c: 1 });
    const net = transformChargeCurrent({ rho: 0, J: { x: -0.4, y: 0, z: 0 }, boost: 0.6, c: 1 });
    expect(positive.rho).toBeCloseTo(1.25, 12);
    expect(negative.rho).toBeCloseTo(-0.95, 12);
    expect(positive.J.x).toBeCloseTo(-0.75, 12);
    expect(negative.J.x).toBeCloseTo(0.25, 12);
    expect(net.rho).toBeCloseTo(0.30, 12);
    expect(net.J.x).toBeCloseTo(-0.50, 12);
    expect(positive.rho + negative.rho).toBeCloseTo(net.rho, 12);
    expect(positive.J.x + negative.J.x).toBeCloseTo(net.J.x, 12);
    const bindings = { "ρ": 0, J_x: -0.4, c: 1, v: 0.6, "γ": 1.25 };
    expect(evaluateExpression(srChargeDensity.right, bindings)).toBeCloseTo(0.30, 12);
    expect(evaluateExpression(srLongitudinalCurrent.right, bindings)).toBeCloseTo(-0.50, 12);
    const inverse = transformChargeCurrent({ rho: net.rho, J: net.J, boost: -0.6, c: 1 });
    expect(inverse.rho).toBeCloseTo(0, 12);
    expect(inverse.J.x).toBeCloseTo(-0.4, 12);
  });

  test("the linear totals reverse signed boosts and preserve the modern four-current norm", () => {
    for (const c of [1, 2.5]) {
      for (const beta of [-0.9, -0.6, 0, 0.6, 0.9]) {
        for (const rho of [-1, 0, 2]) {
          const J = { x: -0.4 * c, y: 0.3 * c, z: -0.2 * c };
          const bindings = { "ρ": rho, J_x: J.x, J_y: J.y, J_z: J.z,
            c, v: beta * c, "γ": 1 / Math.sqrt(1 - beta * beta) };
          const derivedRho = evaluateExpression(srChargeDensity.right, bindings);
          const derivedJ = {
            x: evaluateExpression(srLongitudinalCurrent.right, bindings),
            y: evaluateExpression(srTransverseCurrents.y.right, bindings),
            z: evaluateExpression(srTransverseCurrents.z.right, bindings),
          };
          const inverse = transformChargeCurrent({ rho: derivedRho, J: derivedJ, boost: -beta * c, c });
          expect(inverse.rho).toBeCloseTo(rho, 11);
          expect(inverse.J.x).toBeCloseTo(J.x, 11);
          expect(inverse.J.y).toBe(J.y);
          expect(inverse.J.z).toBe(J.z);
          expect(fourCurrentInvariants(derivedRho, derivedJ, c).si).toBeCloseTo(
            fourCurrentInvariants(rho, J, c).si, 10,
          );
        }
      }
    }
  });
});
