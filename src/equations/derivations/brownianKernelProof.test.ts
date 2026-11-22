import assert from "node:assert/strict";
import test from "node:test";
import type { Expression } from "../ast.ts";
import {
  type BrownianKernelCheckId,
  type BrownianKernelInput,
  brownianKernelCheckRows,
  brownianKernelInput,
  kernelNegative,
  kernelNumber,
  kernelProduct,
  kernelQuotient,
  kernelSymbols,
} from "./brownianKernel.ts";
import { verifyBrownianKernel } from "./brownianKernelProof.ts";

function rewrite<T>(value: T, transform: (node: Expression) => Expression): T {
  if (Array.isArray(value)) return value.map((part) => rewrite(part, transform)) as T;
  if (value === null || typeof value !== "object") return value;
  const next = Object.fromEntries(
    Object.entries(value).map(([key, child]) => [key, rewrite(child, transform)]),
  );
  return (typeof next.kind === "string" ? transform(next as Expression) : next) as T;
}
function failed(input: BrownianKernelInput, id: BrownianKernelCheckId): void {
  const report = verifyBrownianKernel(input);
  assert.equal(report.passed, false);
  assert.equal(report.rows.find((row) => row.id === id)?.passed, false, report.reason);
}
function changeStep(
  index: number,
  transform: (value: Expression) => Expression,
): BrownianKernelInput {
  return {
    ...brownianKernelInput,
    chain: {
      ...brownianKernelInput.chain,
      steps: brownianKernelInput.chain.steps.map((step, position) =>
        position === index ? { ...step, to: transform(step.to) } : step,
      ),
    },
  };
}

test("the source recurrence has exact coefficient and remainder support with an explicit conditional limit", () => {
  const report = verifyBrownianKernel();
  assert.equal(report.passed, true, report.reason);
  assert.deepEqual(
    report.rows.map((row) => row.id),
    brownianKernelCheckRows.map((row) => row.id),
  );
  assert.ok(report.rows.every((row) => row.passed));
  assert.equal(report.scope, "conditional-coefficients-and-remainder");
  assert.equal(report.continuumLimit, "requires-stated-convergence");
  assert.deepEqual(JSON.parse(JSON.stringify(report)), report);
});

test("equivalent time-polynomial order and occurrence ids retain the calculation", () => {
  const time = brownianKernelInput.timeTaylor;
  if (time.kind !== "relation" || time.right.kind !== "sum") assert.fail("time record shape");
  const input = rewrite(
    {
      ...brownianKernelInput,
      timeTaylor: { ...time, right: { ...time.right, args: [...time.right.args].reverse() } },
    },
    (node) => (node.kind === "symbol" ? { ...node, termId: "different-occurrence" } : node),
  );
  assert.equal(verifyBrownianKernel(input).passed, true);
});

test("the first-order time coefficient cannot change to a half-interval", () => {
  const time = brownianKernelInput.timeTaylor;
  if (time.kind !== "relation" || time.right.kind !== "sum") assert.fail("time record shape");
  const [value, change] = time.right.args;
  if (!value || !change) assert.fail("time terms");
  failed(
    {
      ...brownianKernelInput,
      timeTaylor: {
        ...time,
        right: { ...time.right, args: [value, kernelQuotient(change, kernelNumber("2"))] },
      },
    },
    "time-coefficients",
  );
});

test("a lost spatial half or the wrong source sign fails the arbitrary polynomial jet", () => {
  const withoutHalf = rewrite(brownianKernelInput.spaceTaylor, (node) =>
    node.kind === "number" && node.value === "2" ? kernelNumber("1") : node,
  );
  failed({ ...brownianKernelInput, spaceTaylor: withoutHalf }, "spatial-coefficients");
  const space = brownianKernelInput.spaceTaylor;
  if (space.kind !== "relation" || space.right.kind !== "sum") assert.fail("space record shape");
  failed(
    {
      ...brownianKernelInput,
      spaceTaylor: {
        ...space,
        right: {
          ...space.right,
          args: space.right.args.map((term, index) => (index === 1 ? kernelNegative(term) : term)),
        },
      },
    },
    "spatial-coefficients",
  );
});

test("normalization cannot be used to change the current density or erase the second moment", () => {
  const doubled = changeStep(2, (value) => {
    if (value.kind !== "relation" || value.right.kind !== "sum") assert.fail("normalization step");
    return {
      ...value,
      right: {
        ...value.right,
        args: value.right.args.map((term, index) =>
          index === 0 ? kernelProduct(kernelNumber("2"), term) : term,
        ),
      },
    };
  });
  failed(doubled, "normalization");
  const erased = changeStep(3, (value) => {
    if (value.kind !== "relation" || value.right.kind !== "sum") assert.fail("symmetry step");
    return { ...value, right: { ...value.right, args: value.right.args.slice(0, 2) } };
  });
  failed(erased, "odd-moments");
});

test("the moment expansion checks the drift sign before symmetry removes it", () => {
  const wrongSign = changeStep(1, (value) => {
    if (value.kind !== "relation" || value.right.kind !== "sum") assert.fail("moment step");
    return {
      ...value,
      right: {
        ...value.right,
        args: value.right.args.map((term, index) => (index === 1 ? kernelNegative(term) : term)),
      },
    };
  });
  failed(wrongSign, "moment-expansion");
});

test("the supplied canonical diffusivity cannot change a half, interval or quantity", () => {
  const jump = brownianKernelInput.jumpMoment;
  if (jump.kind !== "relation") assert.fail("jump moment record");
  failed(
    {
      ...brownianKernelInput,
      jumpMoment: { ...jump, right: kernelProduct(kernelNumber("2"), jump.right) },
    },
    "interval-coefficient",
  );
  const changedTime = rewrite(jump, (node) =>
    node.kind === "symbol" && node.quantityId === "stepInterval"
      ? { ...node, quantityId: "properTimeElapsed" }
      : node,
  );
  const report = verifyBrownianKernel({ ...brownianKernelInput, jumpMoment: changedTime });
  assert.equal(report.passed, false);
  assert.equal(report.refusalCode, "brownian-kernel-expression");
});

test("a removable displacement singularity cannot be hidden in the diffusivity coefficient", () => {
  const jump = brownianKernelInput.jumpMoment;
  if (jump.kind !== "relation") assert.fail("jump moment record");
  failed(
    {
      ...brownianKernelInput,
      jumpMoment: {
        ...jump,
        right: kernelProduct(jump.right, kernelQuotient(kernelSymbols.delta, kernelSymbols.delta)),
      },
    },
    "interval-coefficient",
  );
});

test("the finite residual keeps both remainders instead of asserting an exact finite-step PDE", () => {
  const residual = brownianKernelInput.finiteResidual;
  if (residual.kind !== "relation") assert.fail("residual shape");
  failed(
    {
      ...brownianKernelInput,
      finiteResidual: { ...residual, right: kernelNumber("0") },
    },
    "finite-remainder",
  );
  failed(
    {
      ...brownianKernelInput,
      finiteResidual: { ...residual, right: kernelNegative(residual.right) },
    },
    "finite-remainder",
  );
});

test("the cubic coefficient is checked before parity can conceal its corruption", () => {
  const corrupted = rewrite(brownianKernelInput.finiteResidual, (node) =>
    node.kind === "number" && node.value === "6" ? kernelNumber("3") : node,
  );
  const report = verifyBrownianKernel({ ...brownianKernelInput, finiteResidual: corrupted });
  assert.equal(report.rows.find((row) => row.id === "finite-remainder")?.passed, true);
  assert.equal(report.rows.find((row) => row.id === "remainder-coefficients")?.passed, false);
  assert.equal(report.passed, false);
});

test("the remainder coefficient requires the fourth moment and the factorial 24", () => {
  failed(
    {
      ...brownianKernelInput,
      timeErrorCoefficient: kernelSymbols.tau,
    },
    "remainder-coefficients",
  );
  const wrongFourth = rewrite(brownianKernelInput.spaceErrorCoefficient, (node) =>
    node.kind === "number" && node.value === "24" ? kernelNumber("6") : node,
  );
  failed({ ...brownianKernelInput, spaceErrorCoefficient: wrongFourth }, "remainder-coefficients");
  const wrongMoment = rewrite(brownianKernelInput.spaceErrorCoefficient, (node) =>
    node.kind === "power" && node.exponent.num === 4
      ? { ...node, exponent: { num: 2, den: 1 } }
      : node,
  );
  failed({ ...brownianKernelInput, spaceErrorCoefficient: wrongMoment }, "remainder-coefficients");
});

test("approximation cannot become equality before the explicitly conditional limit", () => {
  failed(
    changeStep(6, (value) => {
      if (value.kind !== "relation") assert.fail("retained equation");
      return { ...value, operator: "=" };
    }),
    "diffusivity-substitution",
  );
  const changed = {
    ...brownianKernelInput,
    chain: {
      ...brownianKernelInput.chain,
      steps: brownianKernelInput.chain.steps.map((step, index) =>
        index === 7
          ? { ...step, rule: { ...step.rule, params: { ...step.rule.params, approaches: 1 } } }
          : step,
      ),
    },
  };
  failed(changed, "continuum-statement");
});

test("brownian-kernel-expression refuses an incomplete source chain without partial support", () => {
  const report = verifyBrownianKernel({
    ...brownianKernelInput,
    chain: { ...brownianKernelInput.chain, steps: brownianKernelInput.chain.steps.slice(0, -1) },
  });
  assert.equal(report.passed, false);
  assert.equal(report.refusalCode, "brownian-kernel-expression");
  assert.deepEqual(report.rows, []);
  const reordered = [...brownianKernelInput.chain.steps];
  [reordered[2], reordered[3]] = [reordered[3]!, reordered[2]!];
  assert.equal(
    verifyBrownianKernel({
      ...brownianKernelInput,
      chain: { ...brownianKernelInput.chain, steps: reordered },
    }).passed,
    false,
  );
});

test("the source route keeps its historical and reconstruction premise roles distinct", () => {
  failed(
    {
      ...brownianKernelInput,
      chain: {
        ...brownianKernelInput.chain,
        entryAssumptions: brownianKernelInput.chain.entryAssumptions.map((premise) =>
          premise.ref === "bm-normalized-transition-kernel"
            ? { ...premise, edgeType: "pedagogical-reconstruction" as const }
            : premise,
        ),
      },
    },
    "chain-order",
  );
});

test("brownian-kernel-expression refuses a half-line moment and a changed evaluation point", () => {
  const halfLine = rewrite(brownianKernelInput.jumpMoment, (node) =>
    node.kind === "integral" ? { ...node, lower: kernelNumber("0") } : node,
  );
  const report = verifyBrownianKernel({ ...brownianKernelInput, jumpMoment: halfLine });
  assert.equal(report.passed, false);
  assert.equal(report.refusalCode, "brownian-kernel-expression");
  const changedPoint = rewrite(brownianKernelInput.timeTaylor, (node) =>
    node.kind === "symbol" && node.quantityId === "positionCoordinate1d"
      ? { ...node, index: "a" }
      : node,
  );
  assert.equal(
    verifyBrownianKernel({ ...brownianKernelInput, timeTaylor: changedPoint }).passed,
    false,
  );
});

test("brownian-kernel-budget refuses excessive expression depth", () => {
  let expression: Expression = kernelSymbols.tau;
  for (let n = 0; n < 50; n++) expression = { kind: "group", argument: expression };
  const report = verifyBrownianKernel({ ...brownianKernelInput, timeErrorCoefficient: expression });
  assert.equal(report.passed, false);
  assert.equal(report.refusalCode, "brownian-kernel-budget");
  assert.deepEqual(report.rows, []);
});
