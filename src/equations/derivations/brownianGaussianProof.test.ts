import assert from "node:assert/strict";
import test from "node:test";
import type { Expression } from "../ast.ts";
import {
  type BrownianGaussianCheckId,
  type BrownianGaussianInput,
  brownianGaussianCheckRows,
  brownianGaussianInput,
  gaussianNegative,
  gaussianNumber,
  gaussianProduct,
  gaussianQuotient,
  gaussianRootPi,
  gaussianSquare,
  gaussianSymbols,
} from "./brownianGaussian.ts";
import { verifyBrownianGaussian } from "./brownianGaussianProof.ts";

function rewrite<T>(value: T, transform: (node: Expression) => Expression): T {
  if (Array.isArray(value)) return value.map((part) => rewrite(part, transform)) as T;
  if (value === null || typeof value !== "object") return value;
  const next = Object.fromEntries(
    Object.entries(value).map(([key, child]) => [key, rewrite(child, transform)]),
  );
  return (typeof next.kind === "string" ? transform(next as Expression) : next) as T;
}
function failed(input: BrownianGaussianInput, id: BrownianGaussianCheckId): void {
  const report = verifyBrownianGaussian(input);
  assert.equal(report.passed, false);
  assert.equal(report.rows.find((row) => row.id === id)?.passed, false);
}

test("the rendered Gaussian and canonical moments share one exact, serializable calculation", () => {
  const report = verifyBrownianGaussian();
  assert.equal(report.passed, true, report.reason);
  assert.deepEqual(
    report.rows.map((row) => row.id),
    brownianGaussianCheckRows.map((row) => row.id),
  );
  assert.ok(report.rows.every((row) => row.passed));
  assert.deepEqual(JSON.parse(JSON.stringify(report)), report);
});

test("equivalent exact arithmetic and changed occurrence ids retain the same calculation", () => {
  const rearranged = rewrite(
    {
      ...brownianGaussianInput,
      widthSquared: gaussianProduct(
        gaussianSymbols.t,
        gaussianNumber("2"),
        gaussianSymbols.D,
        gaussianNumber("2"),
      ),
      firstWeight: gaussianProduct(gaussianSymbols.u, gaussianNumber("-2")),
      normalization: gaussianQuotient(
        gaussianNumber("2"),
        gaussianProduct(gaussianNumber("2"), gaussianRootPi),
      ),
    },
    (node) => (node.kind === "symbol" ? { ...node, termId: "another occurrence" } : node),
  );
  assert.equal(verifyBrownianGaussian(rearranged).passed, true);
});

test("changing the spatial width preserves normalization but fails the diffusion equation", () => {
  const input = {
    ...brownianGaussianInput,
    widthSquared: gaussianProduct(gaussianNumber("2"), gaussianSymbols.D, gaussianSymbols.t),
  };
  const report = verifyBrownianGaussian(input);
  assert.equal(report.rows.find((row) => row.id === "normalization")?.passed, true);
  failed(input, "diffusion-equation");
  failed(input, "second-moment");
});

test("a lost product-rule term or a wrong first-derivative sign cannot certify the density", () => {
  failed(
    {
      ...brownianGaussianInput,
      secondWeight: gaussianProduct(gaussianNumber("4"), gaussianSquare(gaussianSymbols.u)),
    },
    "profile-derivatives",
  );
  failed(
    {
      ...brownianGaussianInput,
      firstWeight: gaussianNegative(brownianGaussianInput.firstWeight),
    },
    "diffusion-equation",
  );
});

test("a missing normalization factor cannot be hidden by a correct differential equation", () => {
  failed({ ...brownianGaussianInput, normalization: gaussianNumber("1") }, "normalization");
  failed(
    {
      ...brownianGaussianInput,
      normalization: gaussianQuotient(
        gaussianNumber("1"),
        gaussianProduct(gaussianNumber("2"), gaussianRootPi),
      ),
    },
    "second-moment",
  );
});

test("brownian-gaussian-expression refuses removable singularities in the full-line normalizer", () => {
  const unknown: Expression = { kind: "symbol", quantityId: "undeclaredScalar", termId: "z" };
  const zero: Expression = {
    kind: "sum",
    args: [gaussianSquare(gaussianRootPi), gaussianNegative({ kind: "constant", name: "pi" })],
  };
  for (const singularity of [gaussianSymbols.u, unknown, zero, gaussianNumber("0")]) {
    const normalization = gaussianQuotient(
      gaussianQuotient(singularity, singularity),
      gaussianRootPi,
    );
    const report = verifyBrownianGaussian({ ...brownianGaussianInput, normalization });
    assert.equal(report.passed, false);
    assert.equal(report.refusalCode, "brownian-gaussian-expression");
    assert.deepEqual(report.rows, []);
  }
});

test("integration by parts checks its derivative and derives the half-area coefficient", () => {
  failed({ ...brownianGaussianInput, partsWeight: gaussianNumber("1") }, "integration-by-parts");
  failed(
    {
      ...brownianGaussianInput,
      unitSecondMoment: gaussianRootPi,
    },
    "integration-by-parts",
  );
});

test("the full-line integral cannot silently become a half-line or a radial moment", () => {
  let changed = 0;
  const halfLine = rewrite(brownianGaussianInput.moment, (node) => {
    if (node.kind !== "integral") return node;
    changed++;
    return { ...node, lower: gaussianNumber("0") };
  });
  assert.equal(changed, 1);
  failed({ ...brownianGaussianInput, moment: halfLine }, "second-moment");

  changed = 0;
  const radial = rewrite(brownianGaussianInput.moment, (node) => {
    if (node.kind !== "symbol" || node.quantityId !== "displacement1d") return node;
    changed++;
    return { ...node, quantityId: "radialDisplacement" };
  });
  assert.ok(changed > 0);
  failed({ ...brownianGaussianInput, moment: radial }, "second-moment");
});

test("mean of squares, square of mean and the nonnegative RMS branch stay distinct", () => {
  const moment = brownianGaussianInput.moment;
  assert.equal(moment.kind, "relation");
  if (moment.kind !== "relation" || moment.left.kind !== "relation") assert.fail("moment shape");
  failed(
    {
      ...brownianGaussianInput,
      moment: {
        ...moment,
        left: {
          ...moment.left,
          left: gaussianSquare({ kind: "average", argument: gaussianSymbols.x }),
        },
      },
    },
    "second-moment",
  );
  const rms = brownianGaussianInput.rms;
  if (rms.kind !== "relation") assert.fail("RMS shape");
  failed(
    { ...brownianGaussianInput, rms: { ...rms, right: gaussianNegative(rms.right) } },
    "root-mean-square",
  );
});

test("a changed canonical conclusion or approximate equality cannot borrow the checked integral", () => {
  const growth = brownianGaussianInput.growth;
  const moment = brownianGaussianInput.moment;
  if (growth.kind !== "relation" || moment.kind !== "relation") assert.fail("record shape");
  failed(
    {
      ...brownianGaussianInput,
      growth: {
        ...growth,
        right: gaussianProduct(gaussianNumber("6"), gaussianSymbols.D, gaussianSymbols.t),
      },
    },
    "second-moment",
  );
  failed({ ...brownianGaussianInput, moment: { ...moment, operator: "approx" } }, "second-moment");
});

test("brownian-gaussian-expression refuses a nondecaying profile or a nonpositive width", () => {
  for (const input of [
    { ...brownianGaussianInput, exponent: gaussianSquare(gaussianSymbols.u) },
    { ...brownianGaussianInput, widthSquared: gaussianNumber("0") },
    {
      ...brownianGaussianInput,
      widthSquared: gaussianNegative(brownianGaussianInput.widthSquared),
    },
  ]) {
    const report = verifyBrownianGaussian(input);
    assert.equal(report.passed, false);
    assert.equal(report.refusalCode, "brownian-gaussian-expression");
    assert.ok(report.reason);
  }
});

test("brownian-gaussian-expression refuses an undeclared profile variable and incomplete input", () => {
  const report = verifyBrownianGaussian({
    ...brownianGaussianInput,
    firstWeight: gaussianSymbols.x,
  });
  assert.equal(report.passed, false);
  assert.equal(report.refusalCode, "brownian-gaussian-expression");
  assert.match(report.reason ?? "", /scaled displacement/);
  const { rms: omitted, ...incomplete } = brownianGaussianInput;
  assert.ok(omitted);
  const missing = verifyBrownianGaussian(incomplete as BrownianGaussianInput);
  assert.equal(missing.passed, false);
  assert.equal(missing.refusalCode, "brownian-gaussian-expression");
});

test("brownian-gaussian-budget refuses excessive expression depth without a partial checked claim", () => {
  let expression: Expression = gaussianSymbols.u;
  for (let i = 0; i < 40; i++) expression = { kind: "group", argument: expression };
  const report = verifyBrownianGaussian({ ...brownianGaussianInput, firstWeight: expression });
  assert.equal(report.passed, false);
  assert.equal(report.refusalCode, "brownian-gaussian-budget");
  assert.deepEqual(report.rows, []);
});
