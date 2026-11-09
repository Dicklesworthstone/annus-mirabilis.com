import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import densityRecord from "../../../content/equations/special-relativity/eq-model-sr-light-density.json";
import energyRecord from "../../../content/equations/special-relativity/eq-model-sr-light-energy.json";
import volumeRecord from "../../../content/equations/special-relativity/eq-model-sr-light-volume.json";
import { parseYaml } from "../../content/provenance/yaml.ts";
import {
  dopplerFactor,
  lightComplexFactors,
  lightComplexMaterialContractionCountermodel,
  lightComplexVolumeNumeric,
} from "../../physics/reference/waves.ts";
import { type Expression, walk } from "../ast.ts";
import { expressionToDerivationLatex } from "./mathRenderer.ts";
import { parseDerivationChain } from "./schema.ts";
import { evaluateExpression } from "./spotCheck.ts";
import {
  srLightComplexDerivation as chain,
  srLightComplexDerivationMetadata,
  srLightComplexDoppler,
  srLightComplexReadingSet,
} from "./srLightComplex.ts";
import { structurallyEqual } from "./treeUtils.ts";
import { verifyChain } from "./verifyChain.ts";

describe("SR §8 light-complex derivation", () => {
  test("the declared equation owner audits the exact readings rendered by every step", () => {
    const owner = parseYaml(
      readFileSync(
        new URL(
          "../../../content/editorial/readings-owners/am-sre-equations-2g3h.yaml",
          import.meta.url,
        ),
        "utf8",
      ),
    ) as { ownerBeadId: string; targets: { kind: string; id: string; readings: unknown }[] };
    expect(owner.ownerBeadId).toBe("am-sre-equations-2g3h");
    const lightComplexTargets = owner.targets.filter((target) =>
      target.id.startsWith("sr-light-complex-"),
    );
    expect(lightComplexTargets).toHaveLength(chain.steps.length);
    for (const step of chain.steps) {
      const target = owner.targets.find((candidate) => candidate.id === step.id);
      expect(target?.kind).toBe("derivation-step");
      expect(target?.readings).toEqual(srLightComplexReadingSet(step));
    }
  });

  test("the authored five-step route parses and its algebra verifies", () => {
    const parsed = parseDerivationChain(JSON.parse(JSON.stringify(chain)));
    const report = verifyChain(parsed);
    expect(report.errors).toEqual([]);
    expect(report.graphIssues).toEqual([]);
    expect(report.stepReports).toHaveLength(5);
    expect(report.passed).toBe(true);
    expect(chain.steps.filter((step) => step.isMove).map((step) => step.id)).toEqual([
      "sr-light-complex-moving-volume",
    ]);
    expect(chain.steps.at(-1)?.id).toBe(chain.targetStepId);
    for (let index = 0; index < chain.steps.length - 1; index++) {
      expect(structurallyEqual(chain.steps[index]!.to, chain.steps[index + 1]!.from)).toBe(true);
    }
  });

  test("removing the conclusion or reversing dependent steps cannot verify", () => {
    const truncated = verifyChain({ ...chain, steps: chain.steps.slice(0, -1) });
    expect(truncated.passed).toBe(false);
    expect(truncated.errors.join(" ")).toContain("targetStepId");
    for (let index = 0; index < chain.steps.length - 1; index++) {
      const reordered = [...chain.steps];
      [reordered[index], reordered[index + 1]] = [reordered[index + 1]!, reordered[index]!];
      const report = verifyChain({ ...chain, steps: reordered });
      expect(report.passed).toBe(false);
    }
  });

  test("draft physical premises and reconstruction status remain explicit", () => {
    expect(srLightComplexDerivationMetadata.review).toBe("draft");
    expect(chain.routeKind).toBe("pedagogical-reconstruction");
    for (const step of chain.steps) {
      expect(step.verification).toEqual({ status: "authored-unverified" });
      expect(step.historicalStatus).toBe("pedagogical-reconstruction");
      expect(step.modelStatus).toBe("exact-within-model");
      expect(step.tool).toMatch(/^foundation:/);
      expect(step.premiseRefs.some((ref) => ref.ref === chain.target)).toBe(false);
    }
    expect(chain.entryAssumptions.some((ref) => /photon|mass-energy|mc2/.test(ref.ref))).toBe(
      false,
    );
  });

  test("the displayed factors retain their existing equation identities", () => {
    const quantities = (tree: Expression) =>
      walk(tree)
        .filter((node) => node.kind === "symbol")
        .map((node) => node.quantityId);
    expect(quantities(chain.steps[0]!.from)).toEqual(
      quantities(energyRecord.tree.left as Expression),
    );
    expect(quantities(chain.steps[1]!.to)).toEqual([
      ...quantities(densityRecord.tree.right as Expression),
      ...quantities(volumeRecord.tree.left as Expression),
    ]);
    for (const step of chain.steps) {
      expect(expressionToDerivationLatex(step.from)).not.toContain("eq-model-");
      expect(expressionToDerivationLatex(step.to)).not.toContain("eq-model-");
    }
  });

  const cases = [
    { name: "zero relative speed", beta: 0, angle: 0.7, expectedQ: 1 },
    { name: "along the motion", beta: 0.6, angle: 0, expectedQ: 0.5 },
    { name: "against the motion", beta: 0.6, angle: Math.PI, expectedQ: 2 },
    { name: "perpendicular in K", beta: 0.6, angle: Math.PI / 2, expectedQ: 1.25 },
    { name: "perpendicular in k", beta: 0.6, angle: Math.acos(0.6), expectedQ: 0.8 },
    { name: "negative boost", beta: -0.6, angle: 0, expectedQ: 2 },
  ];
  for (const { name, beta, angle, expectedQ } of cases) {
    test(`every transformation agrees with the independent volume slice and wave owner: ${name}`, () => {
      const factors = lightComplexFactors(beta, angle);
      const q = dopplerFactor(beta, angle);
      expect(q).toBeCloseTo(expectedQ, 12);
      expect(factors.volumeFactor).toBeCloseTo(lightComplexVolumeNumeric(beta, angle), 12);
      const density = 7;
      const volume = 3;
      const bindings = {
        q,
        u: density,
        "u'": density * factors.energyDensityFactor,
        S: volume,
        "S'": volume * factors.volumeFactor,
        E: density * volume,
        "E'": density * volume * factors.energyFactor,
        ν: 11,
        "ν'": 11 * q,
        γ: 1 / Math.sqrt(1 - beta * beta),
        v: beta,
        c: 1,
        φ: angle,
      };
      expect(evaluateExpression(srLightComplexDoppler.right, bindings)).toBeCloseTo(q, 12);
      for (const step of chain.steps) {
        expect(evaluateExpression(step.from, bindings)).toBeCloseTo(expectedQ, 12);
        expect(evaluateExpression(step.to, bindings)).toBeCloseTo(expectedQ, 12);
      }
    });
  }

  test("the material-volume countermodel fails along the ray, but coincides across K", () => {
    const along = lightComplexMaterialContractionCountermodel(0.6, 0);
    expect(along.factor).toBeCloseTo(0.2, 12);
    expect(along.factor).not.toBeCloseTo(dopplerFactor(0.6, 0), 8);
    const acrossK = lightComplexMaterialContractionCountermodel(0.6, Math.PI / 2);
    expect(acrossK.factor).toBeCloseTo(dopplerFactor(0.6, Math.PI / 2), 12);
    const acrossKPrime = lightComplexMaterialContractionCountermodel(0.6, Math.acos(0.6));
    expect(acrossKPrime.factor).toBeCloseTo(0.512, 12);
    expect(acrossKPrime.factor).not.toBeCloseTo(0.8, 8);
  });

  test("a planted wrong net factor fails the algebra check", () => {
    const steps = [...chain.steps];
    steps[3] = {
      ...steps[3]!,
      to: { kind: "power", base: steps[3]!.to, exponent: { num: 2, den: 1 } },
    };
    expect(verifyChain({ ...chain, steps }).passed).toBe(false);
  });
});
