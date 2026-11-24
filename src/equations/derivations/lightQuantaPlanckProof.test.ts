import { expect, test } from "bun:test";
import type { Expression } from "../ast.ts";
import {
  lqPlanckExpressions as e,
  lqPlanckInput as input,
  lqPlanckCheckRows,
  lqPlanckSymbols as p,
  planckExp,
  planckNumber,
  planckProduct,
  planckQuotient,
  planckRelation,
  planckSum,
} from "./lightQuantaPlanck.ts";
import { verifyLqPlanckConstants } from "./lightQuantaPlanckProof.ts";
import { substituteNode } from "./treeUtils.ts";

const number = planckNumber,
  product = planckProduct,
  quotient = planckQuotient,
  relation = planckRelation;

test("the actual Planck records establish every analytic and coefficient step", () => {
  const result = verifyLqPlanckConstants();
  expect(result.passed).toBe(true);
  expect(result.rows.map((row) => [row.id, row.passed])).toEqual(
    lqPlanckCheckRows.map((id) => [id, true]),
  );
  expect(result.limit).toMatchObject({
    status: "analytic-limit",
    limit: "1",
    quotientAtZero: "not-applicable",
    coefficients: ["1", "1/2", "1/6"],
    scope: "local-series-not-finite-error-bound",
  });
});

test("the leading spectrum must retain its actual coefficient, powers and temperature", () => {
  for (const right of [
    product(number("2"), e.lowFrequency.right),
    product(number("-1"), e.lowFrequency.right),
    quotient(e.lowFrequency.right, p.nu),
    quotient(e.lowFrequency.right, p.T),
  ])
    expect(
      verifyLqPlanckConstants({ ...input, lowFrequency: { ...e.lowFrequency, right } }).passed,
    ).toBe(false);
  expect(
    verifyLqPlanckConstants({ ...input, lowFrequency: { ...e.lowFrequency, operator: "=" } })
      .passed,
  ).toBe(false);
});

test("a changed exponent or hidden dependence cannot inherit the admitted spectral model", () => {
  for (const replacement of [product(number("2"), p.B), p.T, { ...p.B, at: p.nu } as Expression]) {
    const changed = substituteNode(e.lowFrequency, p.B.termId, replacement);
    expect(verifyLqPlanckConstants({ ...input, lowFrequency: changed }).passed).toBe(false);
  }
  expect(
    verifyLqPlanckConstants({ ...input, frequencyScale: relation(p.thermal, quotient(p.B, p.T)) })
      .passed,
  ).toBe(false);
  expect(
    verifyLqPlanckConstants({
      ...input,
      frequencyScale: relation(p.thermal, product(number("2"), e.frequencyScale.right)),
    }).passed,
  ).toBe(false);
});

test("the normalization must compare the actual spectra and the same defined ratio", () => {
  for (const ratio of [
    relation(p.one, p.one),
    relation(quotient(e.lowFrequency.left, e.lowFrequency.left), e.ratio.right),
    relation(e.ratio.left, quotient(product(number("2"), p.x), e.difference)),
    relation(e.ratio.left, quotient(p.x, planckSum(planckExp(p.x), number("1")))),
  ])
    expect(verifyLqPlanckConstants({ ...input, ratio }).passed).toBe(false);
});

test("the exponential difference is computed rather than silently assigned limit one", () => {
  for (const difference of [
    planckSum(planckExp(product(number("2"), p.x)), number("-1")),
    planckSum(planckExp(p.x), number("-1"), number("1e-100")),
    planckSum(planckExp({ kind: "power", base: p.x, exponent: { num: 2, den: 1 } }), number("-1")),
    { kind: "function", name: "sin", argument: p.x } as Expression,
  ])
    expect(verifyLqPlanckConstants({ ...input, difference }).passed).toBe(false);
});

test("the removable and reciprocal limits retain their variable, approach and actual quotient", () => {
  for (const key of ["differenceLimit", "spectrumLimit"] as const) {
    const limit = e[key].left as Extract<Expression, { kind: "limit" }>;
    for (const changed of [
      relation(limit, number("0")),
      relation(limit, number("2")),
      relation({ ...limit, approaches: p.one }, p.one),
      relation({ ...limit, variable: p.nu }, p.one),
      relation({ ...limit, expression: p.one }, p.one),
    ])
      expect(verifyLqPlanckConstants({ ...input, [key]: changed }).passed).toBe(false);
  }
});

test("a coordinated wrong coefficient and inferred N still fail the physical coefficient join", () => {
  const wrong = verifyLqPlanckConstants({
    ...input,
    coefficient: relation(product(number("2"), e.coefficient.left), e.coefficient.right),
    conclusion: relation(p.N, quotient(e.conclusion.right, number("2"))),
  });
  expect(wrong.rows.find((row) => row.id === "planck-number-inference")?.passed).toBe(true);
  expect(wrong.rows.find((row) => row.id === "planck-coefficient-match")?.passed).toBe(false);
  expect(wrong.passed).toBe(false);
  expect(
    verifyLqPlanckConstants({
      ...input,
      classical: relation(e.classical.left, product(number("2"), e.classical.right)),
    }).passed,
  ).toBe(false);
});

test("the inferred number cannot lose a factor, change sign or become its own premise", () => {
  for (const right of [
    product(number("2"), e.conclusion.right),
    product(number("-1"), e.conclusion.right),
    quotient(e.conclusion.right, p.R),
    p.N,
  ])
    expect(verifyLqPlanckConstants({ ...input, conclusion: relation(p.N, right) }).passed).toBe(
      false,
    );
  expect(
    verifyLqPlanckConstants({ ...input, conclusion: relation(p.R, e.conclusion.right) }).passed,
  ).toBe(false);
});

test("each premise and each displayed transformation remains necessary", () => {
  for (const premise of input.premises)
    expect(
      verifyLqPlanckConstants({ ...input, premises: input.premises.filter((id) => id !== premise) })
        .passed,
    ).toBe(false);
  for (const key of [
    "lowFrequency",
    "classical",
    "coefficient",
    "conclusion",
    "frequencyScale",
    "difference",
    "ratio",
    "differenceLimit",
    "spectrumLimit",
  ] as const)
    expect(
      verifyLqPlanckConstants({ ...input, [key]: undefined as unknown as Expression }).passed,
    ).toBe(false);
});

test("the shared guard refuses cycles, getters and undefined arithmetic without running accessors", () => {
  let accessed = 0;
  const accessor = Object.defineProperty({}, "kind", {
    enumerable: true,
    get() {
      accessed++;
      return "function";
    },
  });
  const cycle: Record<string, unknown> = { kind: "group" };
  cycle.argument = cycle;
  for (const difference of [
    accessor,
    cycle,
    { kind: "symbol", termId: "broken", quantityId: Object.create(null) },
    { kind: "symbol", termId: "broken", quantityId: "frequency", index: Object.create(null) },
    product(number("0"), quotient(p.one, p.zero)),
    { kind: "constant", name: "infinity" },
  ])
    expect(verifyLqPlanckConstants({ ...input, difference: difference as Expression }).passed).toBe(
      false,
    );
  expect(accessed).toBe(0);
});
