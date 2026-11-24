import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import yaml from "js-yaml";
import { type Expression, nodeId, walk } from "../ast.ts";
import { expressionToSpokenText } from "./a11yText.ts";
import { getRule } from "./rules/index.ts";
import { evaluateExpression } from "./spotCheck.ts";
import {
  electronMeasurementReadings,
  presentElectronMeasurementChain,
  srElectronDeflectability,
  srElectronMagneticRadius,
  srElectronMeasurementChains,
  srElectronMeasurementPremises,
  srElectronVoltage,
} from "./srElectronMeasurements.ts";
import {
  verifySRElectronMeasurementRoute,
  verifySRElectronMeasurements,
} from "./srElectronMeasurementsProof.ts";
import { structurallyEqual, substituteNode } from "./treeUtils.ts";
import type { DerivationChain, DerivationStep } from "./types.ts";

const clone = <T>(value: T): T => JSON.parse(JSON.stringify(value)) as T;
function required<T>(value: T | undefined): T {
  if (value === undefined) throw new Error("The measurement fixture is missing a required value.");
  return value;
}
function replaceStep(chain: DerivationChain, step: DerivationStep): DerivationChain {
  return { ...chain, steps: chain.steps.map((item) => (item.id === step.id ? step : item)) };
}
function numeric(tree: Expression, values: Readonly<Record<string, number>>): number {
  return evaluateExpression(tree, values);
}
function agrees(tree: Expression, values: Readonly<Record<string, number>>) {
  expect(tree.kind).toBe("relation");
  if (tree.kind !== "relation") throw new Error("Expected an equation.");
  expect(numeric(tree.left, values)).toBeCloseTo(numeric(tree.right, values), 10);
}

test("the complete endpoint checks all three conditional laws with exact rules", () => {
  const route = verifySRElectronMeasurementRoute();
  expect(route.passed).toBe(true);
  expect(route.reports.length).toBeGreaterThan(0);
  const ids = new Set(route.reports.map((report) => report.chainId));
  for (const chain of [srElectronDeflectability, srElectronVoltage, srElectronMagneticRadius]) {
    expect(ids.has(chain.id)).toBe(true);
    const report = verifySRElectronMeasurements(chain);
    expect(report.passed).toBe(true);
    expect(report.isPublicationReady).toBe(true);
    expect(report.stepReports.length).toBe(chain.steps.length);
    expect(chain.steps.at(-1)?.id).toBe(chain.targetStepId);
    expect(chain.essentialForPrint).toBe(true);
    for (const step of report.stepReports) {
      expect(step.ruleOutcome).toBe("pass");
      expect(step.verificationStatus).toBe("verified");
      expect(step.spotCheckResult).toBeUndefined();
    }
    for (let index = 1; index < chain.steps.length; index++)
      expect(
        structurallyEqual(required(chain.steps[index - 1]).to, required(chain.steps[index]).from),
      ).toBe(true);
  }
});

test("the result cannot lose, duplicate, or reorder a measured consequence", () => {
  for (const missing of srElectronMeasurementChains)
    expect(
      verifySRElectronMeasurementRoute(
        srElectronMeasurementChains.filter((chain) => chain !== missing),
      ).passed,
    ).toBe(false);
  expect(
    verifySRElectronMeasurementRoute([...srElectronMeasurementChains, srElectronVoltage]).passed,
  ).toBe(false);
  expect(verifySRElectronMeasurementRoute([...srElectronMeasurementChains].reverse()).passed).toBe(
    false,
  );
});

describe("each complete argument", () => {
  for (const original of srElectronMeasurementChains) {
    test(`${original.id} refuses missing steps, exchanged steps, and a changed conclusion`, () => {
      expect(
        verifySRElectronMeasurements({ ...original, steps: original.steps.slice(0, -1) }).passed,
      ).toBe(false);
      for (let index = 0; index < original.steps.length - 1; index++) {
        const steps = [...original.steps];
        [steps[index], steps[index + 1]] = [required(steps[index + 1]), required(steps[index])];
        expect(verifySRElectronMeasurements({ ...original, steps }).passed).toBe(false);
      }
      expect(
        verifySRElectronMeasurements({ ...original, target: "unrelated-conclusion" }).passed,
      ).toBe(false);
    });
    test(`${original.id} retains the exact physical premises and their edge meaning`, () => {
      expect(verifySRElectronMeasurements({ ...original, entryAssumptions: [] }).passed).toBe(
        false,
      );
      for (const step of original.steps)
        expect(
          verifySRElectronMeasurements(replaceStep(original, { ...step, premiseRefs: [] })).passed,
        ).toBe(false);
      const premise = required(original.entryAssumptions[0]);
      expect(
        verifySRElectronMeasurements({
          ...original,
          entryAssumptions: [
            { ...premise, edgeType: "cross-reference" },
            ...original.entryAssumptions.slice(1),
          ],
        }).passed,
      ).toBe(false);
    });
  }
});

test("the published baselines cannot be changed into their own new proof standards", () => {
  expect(Object.isFrozen(srElectronMeasurementChains)).toBe(true);
  expect(Object.isFrozen(srElectronMeasurementPremises)).toBe(true);
  for (const chain of srElectronMeasurementChains) {
    expect(Object.isFrozen(chain)).toBe(true);
    expect(Object.isFrozen(chain.entryAssumptions)).toBe(true);
    expect(Reflect.set(chain, "entryAssumptions", [])).toBe(false);
    for (const step of chain.steps) {
      expect(Object.isFrozen(step)).toBe(true);
      expect(Object.isFrozen(step.rule.params)).toBe(true);
      expect(Reflect.set(step, "premiseRefs", [])).toBe(false);
    }
  }
  expect(verifySRElectronMeasurementRoute().passed).toBe(true);
});

test("a structurally valid replacement is not allowed to invent a different magnetic force", () => {
  const step = required(
    srElectronMagneticRadius.steps.find(
      (candidate) => candidate.id === "sr-electron-measurements-magnetic-force",
    ),
  );
  const replacement: Expression = {
    kind: "product",
    args: [
      { kind: "symbol", quantityId: "particleChargeMagnitude", termId: "particleChargeMagnitude" },
      { kind: "symbol", quantityId: "magneticFieldStationary", termId: "magneticFieldStationary" },
    ],
  };
  const forged: DerivationStep = {
    ...step,
    to: substituteNode(step.from, "transverseForceLaboratory", replacement),
    rule: { ...step.rule, params: { ...step.rule.params, replacement } },
  };
  const local = required(getRule("substitute")).check({
    from: forged.from,
    to: forged.to,
    params: forged.rule.params,
    changed: forged.changedSubexpressionIds,
  });
  expect(local.outcome).toBe("pass"); // A replacement operation alone does not establish a physical law.
  expect(verifySRElectronMeasurements(replaceStep(srElectronMagneticRadius, forged)).passed).toBe(
    false,
  );
});

test("the actual exact arithmetic rule rejects an extra gamma in the radius", () => {
  const step = required(srElectronMagneticRadius.steps.at(-1));
  expect(step.to.kind).toBe("relation");
  if (step.to.kind !== "relation") throw new Error("Expected the canonical radius.");
  const bad: Expression = {
    ...step.to,
    right: {
      kind: "product",
      args: [
        step.to.right,
        { kind: "symbol", termId: "lorentzFactor", quantityId: "lorentzFactor" },
      ],
    },
  };
  expect(
    required(getRule(step.rule.kind)).check({
      from: step.from,
      to: bad,
      params: step.rule.params,
      changed: step.changedSubexpressionIds,
    }).outcome,
  ).toBe("fail");
  expect(
    verifySRElectronMeasurements(replaceStep(srElectronMagneticRadius, { ...step, to: bad }))
      .passed,
  ).toBe(false);
});

test("division retains positive charge, field, and strictly nonzero orbit speed", () => {
  for (const chain of [srElectronVoltage, srElectronMagneticRadius]) {
    const step = required(chain.steps.at(-1));
    expect(step.rule.kind).toBe("add-subtract-multiply-divide");
    const bad = {
      ...step,
      rule: { ...step.rule, params: { ...step.rule.params, nonzeroCondition: "" } },
    };
    expect(verifySRElectronMeasurements(replaceStep(chain, bad)).passed).toBe(false);
  }
  const circle = required(
    srElectronMeasurementPremises.find((item) => item.id === "sr-electron-magnetic-circle"),
  );
  expect(circle.explanation).toContain("0 < v < c");
  expect(circle.explanation).toContain("B > 0");
  expect(circle.explanation).toContain("R > 0");
});

test("worked finite instances satisfy every displayed equation without serving as the proof", () => {
  const c = 5,
    v = 3,
    m = 7,
    gamma = 5 / 4,
    q = 2,
    B = 11;
  const qG = 13,
    EG = 17,
    BG = 19;
  const R = (gamma * m * v) / (q * B);
  const aE = (qG * EG) / (m * gamma);
  const aB = (qG * v * BG) / (c * m * gamma);
  const values = {
    speedOfLight: c,
    frameSpeed: v,
    electronMass: m,
    lorentzFactor: gamma,
    particleChargeMagnitude: q,
    acceleratingPotential: (m * c * c * (gamma - 1)) / q,
    kineticEnergy: m * c * c * (gamma - 1),
    magneticFieldStationary: B,
    radiusCurvatureMagnetic: R,
    transverseForceLaboratory: q * v * B,
    accelerationTransverseLaboratory: (v * v) / R,
    gaussianChargeMagnitude: qG,
    gaussianElectricFieldMagnitude: EG,
    gaussianMagneticFieldMagnitude: BG,
    electricDeflectionAcceleration: aE,
    magneticDeflectionAcceleration: aB,
    gaussianElectricDeflectability: aE / EG,
    gaussianMagneticDeflectability: aB / BG,
  };
  for (const chain of srElectronMeasurementChains)
    for (const step of chain.steps) for (const tree of [step.from, step.to]) agrees(tree, values);
  expect(values.acceleratingPotential / ((m * c * c) / q)).toBe(1 / 4);
  expect(R / ((m * c) / (q * B))).toBeCloseTo(3 / 4, 12);
});

test("the non-orbit relations retain zero speed without dividing by v", () => {
  const values = {
    speedOfLight: 5,
    frameSpeed: 0,
    electronMass: 7,
    lorentzFactor: 1,
    particleChargeMagnitude: 2,
    acceleratingPotential: 0,
    kineticEnergy: 0,
    gaussianChargeMagnitude: 13,
    gaussianElectricFieldMagnitude: 17,
    gaussianMagneticFieldMagnitude: 19,
    electricDeflectionAcceleration: 221 / 7,
    magneticDeflectionAcceleration: 0,
    gaussianElectricDeflectability: 13 / 7,
    gaussianMagneticDeflectability: 0,
  };
  for (const chain of [srElectronDeflectability, srElectronVoltage])
    for (const step of chain.steps) for (const tree of [step.from, step.to]) agrees(tree, values);
});

test("the existing equation owner supplies all displayed R0–R3 readings", () => {
  const owner = yaml.load(
    readFileSync(
      new URL(
        "../../../content/editorial/readings-owners/am-sre-equations-2g3h.yaml",
        import.meta.url,
      ),
      "utf8",
    ),
  ) as { targets: { id: string; kind: string; readings: unknown }[] };
  expect(srElectronMeasurementChains.some((chain) => chain.steps.length > 0)).toBe(true);
  for (const chain of srElectronMeasurementChains)
    for (const step of chain.steps) {
      const matches = owner.targets.filter((target) => target.id === step.id);
      expect(matches.length).toBe(1);
      expect(required(matches[0]).kind).toBe("derivation-step");
      expect(required(matches[0]).readings).toEqual(electronMeasurementReadings(step));
    }
});

test("a caller can revise a copied fixture without altering a published route", () => {
  const edited = clone(srElectronVoltage);
  expect(edited).toEqual(srElectronVoltage);
  expect(verifySRElectronMeasurements(edited).passed).toBe(true);
});

test("display projection preserves changed-node highlights and readable spoken symbols", () => {
  for (const chain of srElectronMeasurementChains) {
    const shown = presentElectronMeasurementChain(chain);
    for (const step of shown.steps) {
      const ids = new Set([...walk(step.from), ...walk(step.to)].map(nodeId));
      expect(step.changedSubexpressionIds.length).toBeGreaterThan(0);
      for (const id of step.changedSubexpressionIds) expect(ids.has(id)).toBe(true);
      for (const expression of [step.from, step.to])
        expect(expressionToSpokenText(expression)).not.toMatch(/[\\{}]/);
    }
  }
});
