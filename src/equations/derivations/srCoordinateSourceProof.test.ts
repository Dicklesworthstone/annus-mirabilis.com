import { expect, test } from "bun:test";
import type { Expression } from "../ast.ts";
import {
  coordinateAlgebraExpressions as e,
  exactCoordinateIdentity,
} from "./srCoordinateAlgebra.ts";
import {
  srCoordinateConstructionChains as chains,
  srCoordinateConstructionPremises,
  verifySRCoordinateConstruction,
  verifySRCoordinateSource,
} from "./srCoordinateSourceProof.ts";
import { srCoordinateModernStages, srCoordinateSourceStages } from "./srCoordinates.ts";
import { substituteNode } from "./treeUtils.ts";
import type { DerivationChain, DerivationStep } from "./types.ts";

const n = (value: string): Expression => ({ kind: "number", value });
const sum = (...args: Expression[]): Expression => ({ kind: "sum", args });
const product = (...args: Expression[]): Expression => ({ kind: "product", args });
const neg = (argument: Expression): Expression => ({ kind: "negate", argument });
const quotient = (numerator: Expression, denominator: Expression): Expression => ({
  kind: "quotient",
  numerator,
  denominator,
});
const square = (base: Expression): Expression => ({
  kind: "power",
  base,
  exponent: { num: 2, den: 1 },
});
const root = (radicand: Expression): Expression => ({ kind: "root", degree: 2, radicand });
const q: Expression = {
  kind: "symbol",
  quantityId: "auxiliaryGalileanCoordinate",
  termId: "auxiliaryGalileanCoordinate",
};

function changeStep(
  chain: DerivationChain,
  index: number,
  change: (step: DerivationStep) => DerivationStep,
): DerivationChain {
  return {
    ...chain,
    steps: chain.steps.map((step, position) => (position === index ? change(step) : step)),
  };
}

test("all eight source stages have exact checks for every displayed operation without sampled credit", () => {
  const report = verifySRCoordinateConstruction();
  expect(report.passed).toBe(true);
  expect(report.errors).toEqual([]);
  expect(report.reports.map((item) => item.chainId)).toEqual(
    srCoordinateSourceStages.map(({ chain }) => chain.id),
  );
  const steps = report.reports.flatMap((stage) => stage.stepReports);
  expect(steps).toHaveLength(42);
  for (const stage of report.reports) {
    expect(stage.routeKind).toBe("source-order");
    expect(stage.isPublicationReady).toBe(true);
    expect(stage.errors).toEqual([]);
    expect(stage.graphIssues).toEqual([]);
  }
  for (const step of steps) {
    expect(step.ruleOutcome).toBe("pass");
    expect(step.verificationStatus).toBe("verified");
    expect(step.spotCheckResult).toBeUndefined();
  }
  expect(
    chains
      .flatMap((chain) => chain.steps)
      .every((step) => step.verification.status === "authored-unverified"),
  ).toBe(true);
  expect(
    srCoordinateConstructionPremises.find(
      (premise) => premise.id === "sr-linearity-from-homogeneity",
    )?.explanation,
  ).toContain("not as a general solution");
  expect(
    srCoordinateConstructionPremises.find(
      (premise) => premise.id === "sr-reciprocity-identical-calibration",
    )?.explanation,
  ).toContain("Reciprocity alone does not set");
  expect(JSON.parse(JSON.stringify(report))).toEqual(report);
  for (const { chain } of srCoordinateModernStages)
    expect(verifySRCoordinateSource(chain).passed).toBe(false);
});

test("a wrong output in any actual step fails the calculation despite unchanged labels and premises", () => {
  let challenged = 0;
  for (const chain of chains)
    for (const [index, original] of chain.steps.entries()) {
      const altered = changeStep(chain, index, (step) => ({
        ...step,
        to:
          step.to.kind === "relation"
            ? { ...step.to, right: sum(step.to.right, n("1")) }
            : sum(step.to, n("1")),
      }));
      const report = verifySRCoordinateSource(altered);
      expect(report.passed, original.id).toBe(false);
      expect(report.isPublicationReady, original.id).toBe(false);
      expect(report.stepReports[index]?.ruleOutcome, original.id).toBe("fail");
      challenged++;
    }
  expect(challenged).toBe(42);
});

test("the derivative and integrated statements cannot certify a nonlinear time map", () => {
  const clockStage = chains[1]!;
  const index = clockStage.steps.findIndex(
    (step) => step.id === "sr-coordinate-source-linear-time",
  );
  for (const addition of [square(q), product(q, e.y), e.y, n("1")]) {
    const report = verifySRCoordinateSource(
      changeStep(clockStage, index, (step) => ({
        ...step,
        to:
          step.to.kind === "relation"
            ? { ...step.to, right: sum(step.to.right, addition) }
            : step.to,
      })),
    );
    expect(report.passed).toBe(false);
    expect(report.stepReports[index]?.ruleOutcome).toBe("fail");
  }
  const nonlinear = verifySRCoordinateSource(
    changeStep(clockStage, index, (step) => ({
      ...step,
      to:
        step.to.kind === "relation"
          ? { ...step.to, right: sum(step.to.right, square(q)) }
          : step.to,
    })),
  );
  expect(nonlinear.stepReports[index]?.ruleReason).toContain("sr-coordinate-calculation-refused");
  expect(nonlinear.stepReports[index]?.ruleReason).toContain("not affine");
  const differentiate = chains[0]!.steps.findIndex(
    (step) => step.id === "sr-coordinate-source-differentiate",
  );
  const wrongGradient = verifySRCoordinateSource(
    changeStep(chains[0]!, differentiate, (step) => ({
      ...step,
      to:
        step.to.kind === "relation"
          ? { ...step.to, right: product(n("1.0000000000001"), step.to.right) }
          : step.to,
    })),
  );
  expect(wrongGradient.passed).toBe(false);
  expect(wrongGradient.stepReports[differentiate]?.ruleOutcome).toBe("fail");
});

test("selected flight directions and nonzero coefficient comparisons never constrain general event maps", () => {
  const stage = chains[3]!;
  const index = stage.steps.findIndex((step) => step.id === "sr-coordinate-source-factor-time");
  for (const change of [
    (tree: Expression) => substituteNode(tree, e.t.termId, root(square(e.t))),
    (tree: Expression) => product(tree, quotient(e.x, e.x)),
  ]) {
    const changed = changeStep(stage, index, (step) => ({
      ...step,
      to: step.to.kind === "relation" ? { ...step.to, right: change(step.to.right) } : step.to,
    }));
    const report = verifySRCoordinateConstruction(
      chains.map((chain) => (chain.id === changed.id ? changed : chain)),
    );
    expect(report.passed).toBe(false);
    expect(report.reports[3]?.stepReports[index]?.ruleOutcome).toBe("fail");
  }
  const approximation = verifySRCoordinateSource(
    changeStep(stage, index, (step) => ({
      ...step,
      to: step.to.kind === "relation" ? { ...step.to, operator: "approx" } : step.to,
    })),
  );
  expect(approximation.passed).toBe(false);
  expect(approximation.stepReports[index]?.ruleOutcome).toBe("fail");
});

test("missing, reordered, disconnected or relabeled stages cannot claim the completed construction", () => {
  for (let index = 0; index < chains.length; index++) {
    expect(
      verifySRCoordinateConstruction(chains.filter((_, position) => position !== index)).passed,
    ).toBe(false);
    const chain = chains[index]!;
    for (const modified of [
      { ...chain, steps: [] },
      { ...chain, steps: [...chain.steps].reverse() },
      { ...chain, target: "unrelated-conclusion" },
      { ...chain, targetStepId: chain.steps[0]!.id },
      { ...chain, routeKind: "pedagogical-reconstruction" as const },
      changeStep(chain, 0, (step) => ({ ...step, from: n("0") })),
      changeStep(chain, 0, (step) => ({ ...step, premiseRefs: [] })),
    ])
      expect(verifySRCoordinateSource(modified).passed).toBe(false);
  }
  expect(verifySRCoordinateConstruction([]).passed).toBe(false);
  expect(verifySRCoordinateConstruction([...chains].reverse()).passed).toBe(false);
  expect(verifySRCoordinateConstruction([...chains, chains[0]!]).passed).toBe(false);
});

test("physical premises, positive branches and local versus imported provenance are real requirements", () => {
  for (const chain of chains)
    for (const premise of chain.entryAssumptions) {
      const report = verifySRCoordinateSource({
        ...chain,
        entryAssumptions: chain.entryAssumptions.filter((candidate) => candidate !== premise),
      });
      expect(report.passed, `${chain.id}: ${premise.ref}`).toBe(false);
      expect(report.stepReports).toEqual([]);
    }
  for (const chain of chains)
    for (const [index, step] of chain.steps.entries()) {
      if (step.rule.kind !== "monotonic-function") continue;
      const report = verifySRCoordinateSource(
        changeStep(chain, index, (original) => ({
          ...original,
          rule: { ...original.rule, params: { ...original.rule.params, branch: "negative" } },
        })),
      );
      expect(report.passed).toBe(false);
      expect(report.stepReports).toEqual([]);
    }
  expect(
    verifySRCoordinateSource({
      ...chains[0]!,
      entryAssumptions: chains[0]!.entryAssumptions.map((premise, index) =>
        index === 0
          ? {
              ...premise,
              admittedImport: {
                sourcePaper: "light-quanta",
                sourceSection: "s1",
                sourceEquationId: "eq-s1-d1",
                admissionRule: "Invented import of a local premise.",
              },
            }
          : premise,
      ),
    }).passed,
  ).toBe(false);
});

test("the exact field preserves signed speeds, transverse axes and scale-at-speed identities", () => {
  const width = root(e.radicand);
  for (const [left, right] of [
    [square(width), e.radicand],
    [product(e.gamma, width), e.c],
    [product(square(e.gamma), e.unitRadicand), n("1")],
    [quotient(e.c, root(e.unitRadicand)), product(e.c, e.gamma)],
    [quotient(n("1"), sum(e.c, neg(e.v))), quotient(sum(e.c, e.v), e.radicand)],
    [product(n("0"), quotient(e.c, e.radicand)), n("0")],
  ] as const)
    expect(exactCoordinateIdentity(left, right).passed).toBe(true);
  for (const [left, right] of [
    [e.gamma, neg(e.gamma)],
    [e.y, e.z],
    [e.phi, e.phiMinus],
    [width, e.radicand],
    [product(square(e.gamma), e.unitRadicand), n("1.0000000000001")],
  ] as const)
    expect(exactCoordinateIdentity(left, right).passed).toBe(false);
});

test("unjustified roots, nonzero lengths and invalid partials refuse even inside zero products", () => {
  const length: Expression = { kind: "symbol", quantityId: "lengthProper", termId: "lengthProper" };
  const badPartial: Expression = {
    kind: "derivative",
    expression: {
      kind: "symbol",
      quantityId: "coordinateTimeMoving",
      termId: "coordinateTimeMoving",
    },
    variable: n("1"),
    order: 1,
    partial: true,
  };
  for (const expression of [
    root(square(e.x)),
    root(square(e.y)),
    root(square(e.phi)),
    quotient(e.v, e.v),
    quotient(n("0"), n("0")),
    root(sum(e.radicand, n("1"))),
    quotient(length, length),
    badPartial,
    { kind: "function", name: "sin", argument: e.v } as Expression,
  ]) {
    const direct = exactCoordinateIdentity(expression, expression);
    expect(direct.passed).toBe(false);
    expect(direct.reason).toContain("sr-coordinate-algebra-refused");
    expect(exactCoordinateIdentity(product(n("0"), expression), n("0")).passed).toBe(false);
  }
  expect(exactCoordinateIdentity(root(square(e.y)), e.y, { positiveFlight: true }).passed).toBe(
    true,
  );
  expect(
    exactCoordinateIdentity(
      root(quotient(square(e.y), e.radicand)),
      quotient(e.y, root(e.radicand)),
      { positiveFlight: true },
    ).passed,
  ).toBe(true);
  expect(exactCoordinateIdentity(root(square(e.phi)), e.phi, { positiveScale: true }).passed).toBe(
    true,
  );
  expect(
    exactCoordinateIdentity(quotient(e.x, e.x), n("1"), { nonzeroCoordinate: true }).passed,
  ).toBe(true);
  expect(exactCoordinateIdentity(quotient(e.x, e.x), n("1")).passed).toBe(false);
  expect(
    exactCoordinateIdentity(quotient(length, length), n("1"), { positiveRodLength: true }).passed,
  ).toBe(true);
});
