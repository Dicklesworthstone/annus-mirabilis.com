import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import yaml from "js-yaml";
import molarEnergyRecord from "../../../content/equations/light-quanta/eq-model-lq-energy-per-point-molar.json";
import { auditReadings } from "../../content/audits/readings.ts";
import { loadLiveReadingsInput } from "../../content/audits/readingsLive.ts";
import {
  entropyWithUnfixedConstant,
  radiationEntropyVolumeChange,
  wienSpectralEntropyDensity,
  wienTemperatureFromDensity,
} from "../../physics/reference/radiation/entropy.ts";
import { type Expression, walk } from "../ast.ts";
import { parseEquationRecord } from "../record.ts";
import {
  lightQuantaDerivationMetadata,
  lightQuantaDisplayChain,
  lightQuantaDisplayExpression,
  lightQuantaReadingSet,
  lqCoefficientCorrespondence,
  lqEffectiveCountResult,
  lqEnergyPerElementEquation,
  lqEnergyPerElementResult,
  lqUnfixedConstantResult,
  lqWienEntropyDerivation,
} from "./lightQuantaEntropy.ts";
import { verifyLqCoefficientCorrespondence } from "./lightQuantaCoefficientProof.ts";
import { evaluateExpression } from "./spotCheck.ts";
import type { DerivationChain, DerivationStep } from "./types.ts";
import { verifyChain } from "./verifyChain.ts";

const chains = [lqWienEntropyDerivation, lqCoefficientCorrespondence];
const relation = (expression: Expression) => {
  assert.equal(expression.kind, "relation");
  return expression as Extract<Expression, { kind: "relation" }>;
};
function step(id: string): DerivationStep {
  const found = chains.flatMap((chain) => chain.steps).find((entry) => entry.id === id);
  assert.ok(found, id);
  return found;
}
function near(actual: number, expected: number, relative = 1e-10) {
  assert.ok(
    Math.abs(actual - expected) <= relative * Math.max(1e-12, Math.abs(expected)),
    `${actual} != ${expected}`,
  );
}

test("LQ coefficient algebra is checked while calculus and model claims remain drafts", () => {
  for (const chain of chains) {
    const report =
      chain === lqCoefficientCorrespondence
        ? verifyLqCoefficientCorrespondence(chain)
        : verifyChain(chain);
    assert.equal(report.passed, true, JSON.stringify(report));
    const checkedCoefficients = chain === lqCoefficientCorrespondence;
    assert.equal(report.isPublicationReady, checkedCoefficients);
    assert.equal(verifyChain(chain, { isPublicationGate: true }).passed, checkedCoefficients);
    if (checkedCoefficients)
      assert.ok(report.stepReports.every((entry) => entry.verificationStatus === "verified"));
    assert.equal(chain.steps.at(-1)?.id, chain.targetStepId);
    assert.equal(chain.steps.filter((entry) => entry.isMove).length, 1);
    for (const entry of chain.steps) {
      assert.ok(entry.tool?.startsWith("foundation:"));
      assert.ok(entry.premiseRefs.length > 0);
      assert.equal(entry.verification.status, "authored-unverified");
    }
  }
});

test("reordering the opening steps or truncating the target is rejected for each LQ chain", () => {
  for (const chain of chains) {
    const first = chain.steps[0];
    const second = chain.steps[1];
    assert.ok(first && second);
    const reordered: DerivationChain = {
      ...chain,
      steps: [second, first, ...chain.steps.slice(2)],
    };
    assert.equal(verifyChain(reordered).passed, false);
    assert.equal(verifyChain({ ...chain, steps: chain.steps.slice(0, -1) }).passed, false);
  }
});

test("the logarithm carries both positive-domain obligations and cannot lose either", () => {
  const logarithm = step("lq-wien-take-logarithms");
  const broken = {
    ...lqWienEntropyDerivation,
    steps: lqWienEntropyDerivation.steps.map((entry) =>
      entry.id === logarithm.id
        ? {
            ...entry,
            rule: {
              ...entry.rule,
              params: { ...entry.rule.params, positiveArguments: { left: "ρν/(Aν³) > 0" } },
            },
          }
        : entry,
    ),
  };
  assert.equal(verifyChain(broken).passed, false);
});

test("Wien inversion agrees with the physical reference at several positive dilute densities", () => {
  const coefficients = { A: 0.001, B: 2 };
  for (const nu of [100, 400]) {
    for (const x of [8, 12, 20]) {
      const rho = coefficients.A * nu ** 3 * Math.exp(-x);
      const reference = wienTemperatureFromDensity(rho, nu, coefficients);
      assert.equal(reference.status, "value");
      if (reference.status !== "value") continue;
      const bindings = {
        frequencyEnergyDensity: rho,
        frequency: nu,
        wienConstantAlpha: coefficients.A,
        wienConstantBeta: coefficients.B,
        temperature: reference.value,
      };
      for (const entry of lqWienEntropyDerivation.steps.slice(0, 4)) {
        for (const tree of [entry.from, entry.to]) {
          const equation = relation(tree);
          near(
            evaluateExpression(equation.left, bindings),
            evaluateExpression(equation.right, bindings),
          );
        }
      }
    }
  }
});

test("differentiating the authored entropy density recovers inverse temperature and its zero-density limit", () => {
  const densityResult = relation(step("lq-wien-remove-fixed-constant").to);
  const coefficients = { A: 0.001, B: 2 };
  const nu = 100;
  const rho = coefficients.A * nu ** 3 * Math.exp(-8);
  const bindings = {
    frequency: nu,
    wienConstantAlpha: coefficients.A,
    wienConstantBeta: coefficients.B,
  };
  const value = (density: number) =>
    evaluateExpression(densityResult.right, { ...bindings, frequencyEnergyDensity: density });
  const h = rho * 1e-5;
  const derivative = (value(rho + h) - value(rho - h)) / (2 * h);
  const temperature = wienTemperatureFromDensity(rho, nu, coefficients);
  const entropy = wienSpectralEntropyDensity(rho, nu, coefficients);
  assert.equal(temperature.status, "value");
  assert.equal(entropy.status, "value");
  if (temperature.status === "value") near(derivative, 1 / temperature.value, 1e-8);
  if (entropy.status === "value") near(value(rho), entropy.value);
  assert.ok(Math.abs(value(1e-40)) < 1e-38);
  assert.equal(wienSpectralEntropyDensity(0, nu, coefficients).status, "analytic-limit");
  assert.ok(step("lq-wien-integrate-with-constant").rule.params.integrationConstant);
  assert.match(step("lq-wien-fix-zero-density-boundary").reasons.r2, /Approach ρν = 0/);
});

test("fixed-energy fixed-band volume comparison matches the owner for compression, equality and expansion", () => {
  const coefficients = { A: 0.001, B: 2 };
  const nu = 100;
  const dNu = 0.5;
  const V0 = 3;
  const E = coefficients.A * nu ** 3 * Math.exp(-9) * V0 * dNu;
  const total = relation(step("lq-wien-hold-energy-and-band").to);
  const final = relation(step("lq-wien-collect-volume-ratio").to);
  for (const ratio of [0.25, 0.5, 1, 2, 8]) {
    const V = V0 * ratio;
    const bindings = {
      radiationEnergy: E,
      frequency: nu,
      bandwidth: dNu,
      wienConstantAlpha: coefficients.A,
      wienConstantBeta: coefficients.B,
      volume: V,
      "volume[0]": V0,
    };
    const actual =
      evaluateExpression(total.right, bindings) -
      evaluateExpression(total.right, { ...bindings, volume: V0 });
    const reference = radiationEntropyVolumeChange({ E, nu, dNu, V, V0 }, coefficients);
    assert.equal(reference.status, "value");
    if (reference.status !== "value") continue;
    if (ratio === 1) {
      assert.equal(actual, 0);
      assert.equal(evaluateExpression(final.right, bindings), 0);
    } else {
      near(actual, reference.deltaS);
      near(evaluateExpression(final.right, bindings), reference.deltaS);
      assert.equal(Math.sign(actual), Math.sign(ratio - 1));
    }
  }
});

test("an unfixed entropy-density constant adds a noncancelling volume term", () => {
  const params = { E: 0.1, nu: 100, dNu: 0.5, V: 6, V0: 3, C: 0.7 };
  const reference = entropyWithUnfixedConstant(params, { A: 0.001, B: 2 });
  const extra = evaluateExpression(lqUnfixedConstantResult.right, {
    bandwidth: params.dNu,
    volume: params.V,
    "volume[0]": params.V0,
    "entropyDensityConstant(frequency)": params.C,
  });
  near(extra, reference.extraTerm);
  assert.notEqual(extra, 0);
  assert.notEqual(reference.deltaS, reference.deltaSWithC);
});

test("the proposed count matches coefficients and leaves RBν/N without an h premise", () => {
  for (const energy of [1, 3.7, 9]) {
    const bindings = {
      radiationEnergy: energy,
      wienConstantBeta: 2,
      frequency: 3,
      molarGasConstant: 5,
      avogadroConstant: 7,
      volume: 2,
      "volume[0]": 1,
    };
    const count = evaluateExpression(lqEffectiveCountResult.right, bindings);
    const withCount = { ...bindings, effectiveIndependentCount: count };
    for (const entry of lqCoefficientCorrespondence.steps.slice(0, 2)) {
      for (const tree of [entry.from, entry.to]) {
        const equation = relation(tree);
        near(
          evaluateExpression(equation.left, withCount),
          evaluateExpression(equation.right, withCount),
        );
      }
    }
    near(energy / count, evaluateExpression(lqEnergyPerElementResult, bindings));
    assert.notEqual(count, Math.round(count));
  }
  const quantities = lqCoefficientCorrespondence.steps
    .flatMap((entry) => [entry.from, entry.to])
    .flatMap(walk)
    .filter((node) => node.kind === "symbol")
    .map((node) => node.quantityId);
  assert.ok(!quantities.includes("planckConstant"));
  assert.match(
    step("lq-correspondence-match-coefficients").rule.params.nonzeroCondition as string,
    /≠ 1/,
  );
  assert.match(step("lq-correspondence-match-coefficients").reasons.r2, /Correlated points/);
});

test("render projection preserves distinct reference bindings in the checked chain", () => {
  const final = relation(step("lq-wien-collect-volume-ratio").to);
  const volumes = walk(final).filter(
    (node): node is Extract<Expression, { kind: "symbol" }> =>
      node.kind === "symbol" && node.quantityId === "volume",
  );
  assert.deepEqual(new Set(volumes.map((node) => node.termId)), new Set(["volume", "volume[0]"]));
  const display = lightQuantaDisplayChain(lqWienEntropyDerivation);
  assert.ok(
    display.steps
      .flatMap((entry) => walk(entry.to))
      .some((node) => node.kind === "symbol" && node.termId === "V" && node.index === "0"),
  );
  assert.equal(verifyChain(lqWienEntropyDerivation).passed, true);
});

test("every displayed LQ step has synchronized owned R0–R3 readings that pass the live audit", () => {
  const owners = [
    lightQuantaDerivationMetadata.s4.ownerBeadId,
    lightQuantaDerivationMetadata.s6.ownerBeadId,
  ];
  const live = loadLiveReadingsInput(process.cwd(), { ownerBeadIds: owners });
  assert.deepEqual(live.unparseable, []);
  assert.equal(live.input.targets.length, 15);
  assert.deepEqual(auditReadings(live.input).findings, []);
  for (const [section, chain] of [
    ["s4", lqWienEntropyDerivation],
    ["s6", lqCoefficientCorrespondence],
  ] as const) {
    const owner = lightQuantaDerivationMetadata[section].ownerBeadId;
    const record = yaml.load(
      readFileSync(`content/editorial/readings-owners/${owner}.yaml`, "utf8"),
    ) as {
      targets: { id: string; readings: unknown }[];
    };
    for (const entry of chain.steps) {
      const target = record.targets.find((item) => item.id === `${chain.id}/${entry.id}`);
      assert.ok(target, entry.id);
      assert.deepEqual(target.readings, lightQuantaReadingSet(entry, section));
    }
  }
});

test("the checked molar conclusion passes the actual equation and dimension parser", () => {
  const record = parseEquationRecord(molarEnergyRecord, "conditional molar energy scale");
  assert.equal(record.argument, "arg-lq-entropy-correspondence");
  assert.equal(lqCoefficientCorrespondence.target, record.id);
  assert.deepEqual(
    lightQuantaDisplayExpression(lqCoefficientCorrespondence.steps.at(-1)!.to),
    lightQuantaDisplayExpression(record.tree),
  );
  assert.deepEqual(lqCoefficientCorrespondence.steps.at(-1)?.to, lqEnergyPerElementEquation);
  const quantities = walk(record.tree)
    .filter((node) => node.kind === "symbol")
    .map((node) => node.quantityId);
  assert.ok(quantities.includes("molarGasConstant"));
  assert.ok(quantities.includes("avogadroConstant"));
  assert.ok(!quantities.includes("planckConstant"));
  assert.ok(!quantities.includes("boltzmannConstant"));
});

test("checked correspondence refuses lost domain conditions and altered coefficients", () => {
  const chain = lqCoefficientCorrespondence;
  assert.equal(verifyLqCoefficientCorrespondence(chain).passed, true);
  for (const id of [
    "lq-correspondence-match-coefficients",
    "lq-correspondence-solve-effective-count",
  ]) {
    const changed: DerivationChain = {
      ...chain,
      steps: chain.steps.map((entry) =>
        entry.id === id
          ? {
              ...entry,
              rule: { ...entry.rule, params: { ...entry.rule.params, nonzeroCondition: "" } },
            }
          : entry,
      ),
    };
    assert.equal(verifyLqCoefficientCorrespondence(changed).passed, false);
  }
  const wrongCoefficient: DerivationChain = {
    ...chain,
    steps: chain.steps.map((entry): DerivationStep =>
      entry.id === chain.targetStepId
        ? {
            ...entry,
            to: {
              ...lqEnergyPerElementEquation,
              right: {
                kind: "product",
                args: [{ kind: "number", value: "2" }, lqEnergyPerElementResult],
              },
            },
          }
        : entry,
    ),
  };
  assert.equal(verifyLqCoefficientCorrespondence(wrongCoefficient).passed, false);
});

test("altering either admitted entropy law breaks the coefficient correspondence", () => {
  const chain = lqCoefficientCorrespondence;
  const first = chain.steps[0];
  assert.ok(first);
  const from = relation(first.from);
  for (const side of ["left", "right"] as const) {
    const changed: DerivationChain = {
      ...chain,
      steps: chain.steps.map((entry): DerivationStep =>
        entry.id === first.id
          ? {
              ...entry,
              from: {
                ...from,
                [side]: {
                  kind: "product",
                  args: [{ kind: "number", value: "2" }, from[side]],
                },
              },
            }
          : entry,
      ),
    };
    assert.equal(verifyLqCoefficientCorrespondence(changed).passed, false);
  }
});

test("the coefficient owner requires every producer and its actual consumer", () => {
  const chain = lqCoefficientCorrespondence;
  assert.equal(verifyLqCoefficientCorrespondence(chain).passed, true);
  for (const removed of chain.steps) {
    const changed = { ...chain, steps: chain.steps.filter((entry) => entry.id !== removed.id) };
    assert.equal(verifyLqCoefficientCorrespondence(changed).passed, false, removed.id);
  }

  const substitution = step("lq-correspondence-substitute-effective-count");
  const zero: Expression = { kind: "number", value: "0" };
  const unrelated: DerivationChain = {
    ...chain,
    steps: chain.steps.map((entry): DerivationStep =>
      entry.id === substitution.id
        ? {
            ...entry,
            from: { kind: "product", args: [zero, entry.from] },
            to: { kind: "product", args: [zero, entry.to] },
          }
        : entry,
    ),
  };
  // Each local rewrite still passes, but this substitution no longer supplies the final equality.
  assert.equal(verifyChain(unrelated, { isPublicationGate: true }).passed, true);
  assert.equal(verifyLqCoefficientCorrespondence(unrelated).passed, false);

  const missingLink: DerivationChain = {
    ...chain,
    steps: chain.steps.map((entry) =>
      entry.id === chain.targetStepId
        ? {
            ...entry,
            premiseRefs: entry.premiseRefs.filter((premise) => premise.ref !== substitution.id),
          }
        : entry,
    ),
  };
  assert.equal(verifyLqCoefficientCorrespondence(missingLink).passed, false);
});
