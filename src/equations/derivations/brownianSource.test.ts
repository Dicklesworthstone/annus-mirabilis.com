import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import yaml from "js-yaml";
import diffusionRecord from "../../../content/equations/brownian-motion/eq-model-bm-diffusion-equation.json";
import molarRecord from "../../../content/equations/brownian-motion/eq-model-bm-diffusivity-molar.json";
import { auditReadings } from "../../content/audits/readings.ts";
import { loadLiveReadingsInput } from "../../content/audits/readingsLive.ts";
import { constantValue, getConstantSet } from "../../physics/reference/constants.ts";
import {
  gaussianPropagator,
  stokesEinsteinD,
} from "../../physics/reference/diffusion/distributions.ts";
import {
  driftDiffusionFlux,
  equilibriumBalance,
  stokesMobility,
} from "../../physics/reference/diffusion/routeA.ts";
import { type Expression, walk } from "../ast.ts";
import { verifyBrownianEquilibrium } from "./brownianEquilibriumProof.ts";
import {
  brownianDerivationMetadata,
  brownianDisplayChain,
  brownianDisplayExpression,
  brownianEquilibriumDerivation,
  brownianKernelDerivation,
  brownianReadingSet,
  brownianSourceEquations,
} from "./brownianSource.ts";
import { evaluateExpression } from "./spotCheck.ts";
import { structurallyEqual, substituteNode } from "./treeUtils.ts";
import type { DerivationChain, DerivationStep } from "./types.ts";
import { verifyChain } from "./verifyChain.ts";

const chains = [brownianEquilibriumDerivation, brownianKernelDerivation];
const relation = (tree: Expression) => {
  assert.equal(tree.kind, "relation");
  return tree as Extract<Expression, { kind: "relation" }>;
};
const numeric = (evaluation: {
  readonly result: { readonly status: string; readonly value?: unknown };
}) => {
  assert.equal(evaluation.result.status, "value");
  assert.equal(typeof evaluation.result.value, "number");
  return evaluation.result.value as number;
};
function near(actual: number, expected: number, relative = 1e-10, absolute = 1e-28) {
  assert.ok(
    Math.abs(actual - expected) <= Math.max(absolute, relative * Math.abs(expected)),
    actual + " != " + expected,
  );
}
function evaluate(tree: Expression, quantities: Readonly<Record<string, number>>): number {
  const bindings = Object.fromEntries(
    walk(tree)
      .filter((node) => node.kind === "symbol")
      .map((node) => {
        const value = quantities[node.quantityId];
        assert.notEqual(value, undefined, node.quantityId);
        return [node.termId, value as number];
      }),
  );
  return evaluateExpression(tree, bindings);
}
function findStep(id: string): DerivationStep {
  const found = chains.flatMap((chain) => chain.steps).find((step) => step.id === id);
  assert.ok(found, id);
  return found;
}
function simpson(f: (x: number) => number, lo: number, hi: number, count = 400): number {
  const dx = (hi - lo) / count;
  let sum = f(lo) + f(hi);
  for (let i = 1; i < count; i++) sum += (i % 2 === 0 ? 2 : 4) * f(lo + i * dx);
  return (dx * sum) / 3;
}
function gaussian(x: number, time: number, D: number): number {
  return numeric(gaussianPropagator(x, time, D));
}

test("equilibrium algebra is checked while diffusion-limit calculus stays draft", () => {
  assert.deepEqual(
    chains.map((chain) => chain.steps.length),
    [7, 8],
  );
  for (const chain of chains) {
    const report =
      chain === brownianEquilibriumDerivation
        ? verifyBrownianEquilibrium(chain)
        : verifyChain(chain);
    assert.equal(report.passed, true, JSON.stringify(report));
    const checkedEquilibrium = chain === brownianEquilibriumDerivation;
    assert.equal(report.isPublicationReady, checkedEquilibrium);
    assert.equal(verifyChain(chain, { isPublicationGate: true }).passed, checkedEquilibrium);
    if (checkedEquilibrium)
      assert.ok(report.stepReports.every((step) => step.verificationStatus === "verified"));
    assert.equal(chain.steps.at(-1)?.id, chain.targetStepId);
    assert.equal(chain.steps.filter((step) => step.isMove).length, 1);
    for (const [index, step] of chain.steps.entries()) {
      assert.equal(step.verification.status, "authored-unverified");
      assert.ok(step.tool?.startsWith("foundation:"));
      assert.ok(step.premiseRefs.length > 0);
      assert.ok(step.sourceAnchor);
      if (index > 0) assert.ok(structurallyEqual(chain.steps[index - 1]!.to, step.from));
    }
  }
});

test("each Brownian route refuses swapped opening steps and a missing target step", () => {
  for (const chain of chains) {
    const first = chain.steps[0];
    const second = chain.steps[1];
    assert.ok(first && second);
    const swapped: DerivationChain = { ...chain, steps: [second, first, ...chain.steps.slice(2)] };
    assert.equal(verifyChain(swapped).passed, false);
    assert.equal(verifyChain({ ...chain, steps: chain.steps.slice(0, -1) }).passed, false);
  }
});

test("cancelling the gradient or dividing by the interval cannot lose its nonzero obligation", () => {
  for (const [chain, id] of [
    [brownianEquilibriumDerivation, "bm-equilibrium-cancel-nonzero-gradient"],
    [brownianKernelDerivation, "bm-kernel-divide-by-interval"],
  ] as const) {
    const invalid: DerivationChain = {
      ...chain,
      steps: chain.steps.map((step) =>
        step.id === id
          ? {
              ...step,
              rule: { ...step.rule, params: { ...step.rule.params, nonzeroCondition: "" } },
            }
          : step,
      ),
    };
    assert.equal(verifyChain(invalid).passed, false);
  }
});

test("the authored equilibrium equations agree with reference mobility and flux for both force signs", () => {
  const set = getConstantSet("modern-si-2019"); // A numerical oracle, never a historical premise.
  const R = constantValue(set, "molarGasConstant").value;
  const N = constantValue(set, "avogadroConstant").value;
  const n = 1e12;
  for (const T of [280, 310]) {
    for (const eta of [0.001, 0.003]) {
      for (const a of [0.5e-6, 1.2e-6]) {
        const b = numeric(stokesMobility(eta, a));
        const D = numeric(stokesEinsteinD({ T, eta, a }, set));
        for (const K of [-3e-16, 1e-16, 4e-16]) {
          const gradient = (n * K) / ((R * T) / N);
          const quantities = {
            molarGasConstant: R,
            avogadroConstant: N,
            temperature: T,
            viscosity: eta,
            particleRadius: a,
            numberDensity: n,
            externalForcePerParticle: K,
            mobility: b,
            driftFlux: n * b * K,
            diffusionCoefficient: D,
          };
          for (const step of brownianEquilibriumDerivation.steps) {
            for (const tree of [step.from, step.to]) {
              const equation = relation(
                substituteNode(tree, "bm-source.op.number-gradient", {
                  kind: "number",
                  value: String(gradient),
                }),
              );
              const zeroBalance = equation.right.kind === "number" && equation.right.value === "0";
              near(
                evaluate(equation.left, quantities),
                evaluate(equation.right, quantities),
                3e-12,
                zeroBalance ? Math.abs(n * K) * 3e-12 : 1e-28,
              );
            }
          }
          const flux = driftDiffusionFlux(n, gradient, K, b, D);
          assert.ok("total" in flux);
          near(numeric(flux.total), 0, 1e-10, Math.abs(numeric(flux.drift)) * 3e-12);
          assert.equal(Math.sign(numeric(flux.drift)), -Math.sign(numeric(flux.diffusion)));
        }
      }
    }
  }
});

test("zero force leaves the balance coefficient undetermined, while viscosity and radius retain their scaling", () => {
  const set = getConstantSet("modern-si-2019");
  const parameters = { T: 300, eta: 0.001, a: 1e-6 };
  const D = numeric(stokesEinsteinD(parameters, set));
  const balance = equilibriumBalance(
    {
      force: 0,
      temperature: parameters.T,
      eta: parameters.eta,
      a: parameters.a,
      kickDiffusivity: D,
    },
    set,
  );
  assert.ok("balanceD" in balance);
  assert.equal(balance.balanceD.result.status, "not-applicable");
  assert.equal(balance.agree, null);
  near(numeric(stokesEinsteinD({ ...parameters, eta: 2 * parameters.eta }, set)), D / 2);
  near(numeric(stokesEinsteinD({ ...parameters, a: 2 * parameters.a }, set)), D / 2);
  assert.match(findStep("bm-equilibrium-cancel-nonzero-gradient").reasons.r2, /0\/0/);
  const quantities = brownianEquilibriumDerivation.steps
    .flatMap((step) => walk(step.to))
    .filter((node) => node.kind === "symbol")
    .map((node) => node.quantityId);
  assert.ok(!quantities.includes("boltzmannConstant"));
});

test("canonical equation targets and function arguments survive the display projection", () => {
  assert.deepEqual(
    brownianDisplayExpression(brownianEquilibriumDerivation.steps.at(-1)!.to),
    brownianDisplayExpression(molarRecord.tree as Expression),
  );
  assert.deepEqual(
    brownianDisplayExpression(brownianKernelDerivation.steps.at(-1)!.to),
    brownianDisplayExpression(diffusionRecord.tree as Expression),
  );
  const source = relation(brownianSourceEquations.printedSignTransition);
  const modern = relation(brownianSourceEquations.modernTransition);
  const sourceDensity = walk(source.right).find(
    (node) => node.kind === "symbol" && node.quantityId === "probabilityDensity",
  );
  const modernDensity = walk(modern.right).find(
    (node) => node.kind === "symbol" && node.quantityId === "probabilityDensity",
  );
  assert.ok(sourceDensity?.kind === "symbol" && modernDensity?.kind === "symbol");
  assert.notEqual(sourceDensity.termId, modernDensity.termId);
  const plusOrigin = sourceDensity.args?.[0];
  const minusOrigin = modernDensity.args?.[0];
  assert.ok(plusOrigin && minusOrigin);
  assert.ok(!walk(plusOrigin).some((node) => node.kind === "negate"));
  assert.ok(walk(minusOrigin).some((node) => node.kind === "negate"));
  const shown = brownianDisplayChain(brownianKernelDerivation);
  assert.ok(
    shown.steps
      .flatMap((step) => walk(step.to))
      .some((node) => node.kind === "symbol" && node.termId === "p" && node.args?.length === 2),
  );
});

test("normalized symmetric kernels give exactly the authored second moment per twice the interval", () => {
  for (const halfWidth of [0.1, 0.4, 1.2]) {
    const tau = 0.3 * halfWidth * halfWidth;
    const density = 1 / (2 * halfWidth);
    near(
      simpson(() => density, -halfWidth, halfWidth),
      1,
    );
    near(
      simpson((delta) => delta * density, -halfWidth, halfWidth),
      0,
      1e-10,
      1e-14,
    );
    const second = simpson((delta) => delta * delta * density, -halfWidth, halfWidth);
    near(second, (halfWidth * halfWidth) / 3);
    const rhs = brownianSourceEquations.jumpMoment.right;
    const integral = walk(rhs).find((node) => node.kind === "integral");
    assert.ok(integral?.opId);
    const evaluated = substituteNode(rhs, integral.opId, { kind: "number", value: String(second) });
    near(evaluate(evaluated, { stepInterval: tau }), (halfWidth * halfWidth) / (6 * tau));
  }
});

test("source and modern transition signs agree for symmetric kernels but differ for a biased law", () => {
  const x = 0.6,
    time = 1.3,
    D = 0.4,
    width = 0.8;
  const plus = simpson((delta) => gaussian(x + delta, time, D) / width, -width / 2, width / 2);
  const minus = simpson((delta) => gaussian(x - delta, time, D) / width, -width / 2, width / 2);
  near(plus, minus);
  const biasedPlus = simpson((delta) => gaussian(x + delta, time, D) / width, 0, width);
  const biasedMinus = simpson((delta) => gaussian(x - delta, time, D) / width, 0, width);
  assert.ok(Math.abs(biasedPlus - biasedMinus) > 0.01);
  near(
    simpson((delta) => delta / width, 0, width),
    width / 2,
  );
  assert.match(findStep("bm-kernel-remove-odd-moment").reasons.r2, /biased/);
});

test("Taylor approximations stay marked until the controlled continuum limit and have decreasing remainders", () => {
  const steps = brownianKernelDerivation.steps;
  assert.ok(steps.slice(0, -1).every((step) => relation(step.to).operator === "approx"));
  const final = steps.at(-1)!;
  assert.equal(relation(final.to).operator, "=");
  assert.equal(final.rule.kind, "take-limit");
  assert.equal(final.rule.params.approaches, 0);
  assert.match(String(final.rule.params.domain), /⟨Δ⁴⟩\/τ/);
  for (const step of steps.slice(0, 2)) {
    assert.ok(step.approximation?.domain);
    assert.ok(step.approximation?.neglected);
  }
  const x = 0.6,
    time = 1.3,
    D = 0.4;
  const p = gaussian(x, time, D);
  const curvature = ((x * x) / (4 * D * D * time * time) - 1 / (2 * D * time)) * p;
  const errors = [0.4, 0.2, 0.1].map((halfWidth) => {
    const tau = (halfWidth * halfWidth) / (6 * D);
    const average = simpson(
      (delta) => gaussian(x + delta, time, D) / (2 * halfWidth),
      -halfWidth,
      halfWidth,
    );
    return {
      space: Math.abs(average - (p + (halfWidth * halfWidth * curvature) / 6)),
      time: Math.abs(gaussian(x, time + tau, D) - (p + tau * D * curvature)),
      remainderPerTime: halfWidth ** 4 / 5 / tau,
    };
  });
  for (let i = 1; i < errors.length; i++) {
    assert.ok(errors[i]!.space < errors[i - 1]!.space / 10);
    assert.ok(errors[i]!.time < errors[i - 1]!.time / 10);
    near(errors[i]!.remainderPerTime, errors[i - 1]!.remainderPerTime / 4);
  }
});

test("all 15 Brownian source steps have synchronized owned R0–R3 readings", () => {
  const owners = [
    brownianDerivationMetadata.s3.ownerBeadId,
    brownianDerivationMetadata.s4.ownerBeadId,
  ];
  const live = loadLiveReadingsInput(process.cwd(), { ownerBeadIds: owners });
  assert.deepEqual(live.unparseable, []);
  assert.equal(live.input.targets.length, 15);
  assert.deepEqual(auditReadings(live.input).findings, []);
  for (const [section, chain] of [
    ["s3", brownianEquilibriumDerivation],
    ["s4", brownianKernelDerivation],
  ] as const) {
    const path =
      "content/editorial/readings-owners/" +
      brownianDerivationMetadata[section].ownerBeadId +
      ".yaml";
    const owner = yaml.load(readFileSync(path, "utf8")) as {
      targets: { id: string; readings: unknown }[];
    };
    for (const step of chain.steps) {
      const target = owner.targets.find((entry) => entry.id === chain.id + "/" + step.id);
      assert.ok(target, step.id);
      assert.deepEqual(target.readings, brownianReadingSet(step, section));
    }
  }
});

test("equilibrium support rejects altered operations, premises and result coefficients", () => {
  const chain = brownianEquilibriumDerivation;
  assert.equal(verifyBrownianEquilibrium(chain).passed, true);
  const changed = (id: string, replace: (step: DerivationStep) => DerivationStep) => ({
    ...chain,
    steps: chain.steps.map((step) => (step.id === id ? replace(step) : step)),
  });
  const changedOperation = changed("bm-equilibrium-read-pressure-balance", (step) => ({
    ...step,
    rule: {
      ...step.rule,
      params: { ...step.rule.params, quantity: { kind: "number", value: "0" } },
    },
  }));
  assert.equal(verifyBrownianEquilibrium(changedOperation).passed, false);

  const wrongSix = (tree: unknown): Expression => {
    const before = JSON.stringify(tree);
    const after = before.replace('"value":"6"', '"value":"12"');
    assert.notEqual(after, before, "The wrong coefficient must change the control.");
    return JSON.parse(after) as Expression;
  };
  const changedPremise = changed("bm-equilibrium-insert-stokes-mobility", (step) => ({
    ...step,
    rule: {
      ...step.rule,
      params: { ...step.rule.params, replacement: wrongSix(step.rule.params.replacement) },
    },
  }));
  assert.equal(verifyBrownianEquilibrium(changedPremise).passed, false);
  const changedResult = changed("bm-equilibrium-collect-diffusivity", (step) => ({
    ...step,
    to: wrongSix(step.to),
  }));
  assert.equal(verifyBrownianEquilibrium(changedResult).passed, false);
});

test("the equilibrium owner refuses deleted stages and detached valid substitutions", () => {
  const chain = brownianEquilibriumDerivation;
  assert.equal(verifyBrownianEquilibrium(chain).passed, true);
  for (const removed of chain.steps) {
    const changed = { ...chain, steps: chain.steps.filter((entry) => entry.id !== removed.id) };
    assert.equal(verifyBrownianEquilibrium(changed).passed, false, removed.id);
  }
  const doubleSides = (tree: Expression): Expression => {
    const equation = relation(tree);
    const twice = (value: Expression): Expression => ({
      kind: "product",
      args: [{ kind: "number", value: "2" }, value],
    });
    return { ...equation, left: twice(equation.left), right: twice(equation.right) };
  };
  const detached: DerivationChain = {
    ...chain,
    steps: chain.steps.map((entry) =>
      entry.id === "bm-equilibrium-name-drift-flux"
        ? { ...entry, from: doubleSides(entry.from), to: doubleSides(entry.to) }
        : entry,
    ),
  };
  // The isolated substitution still works; its input and output no longer join its neighbors.
  assert.equal(verifyChain(detached, { isPublicationGate: true }).passed, true);
  assert.equal(verifyBrownianEquilibrium(detached).passed, false);

  const sampledCollection: DerivationChain = {
    ...chain,
    steps: chain.steps.map((entry) =>
      entry.id === chain.targetStepId
        ? { ...entry, rule: { ...entry.rule, params: { ...entry.rule.params, exact: false } } }
        : entry,
    ),
  };
  assert.equal(verifyBrownianEquilibrium(sampledCollection).passed, false);
});
