import assert from "node:assert/strict";
import test from "node:test";
import type { Expression } from "../ast.ts";
import { verifySRFieldCovariance } from "./srFieldCovariance.ts";
import { srFieldComponentRows } from "./srFieldTransforms.ts";

const negative = (argument: Expression): Expression => ({ kind: "negate", argument });
const residual = (row: (typeof srFieldComponentRows)[number]["source"]): Expression => ({
  kind: "sum",
  args: [row.left, negative(row.right)],
});

/** Transform a copied AST from the leaves up, without changing the authored owner. */
function rewrite<T>(value: T, visit: (expression: Expression) => Expression): T {
  if (Array.isArray(value)) return value.map((part) => rewrite(part, visit)) as T;
  if (value === null || typeof value !== "object") return value;
  const next = Object.fromEntries(
    Object.entries(value).map(([key, part]) => [key, rewrite(part, visit)]),
  );
  return (typeof next.kind === "string" ? visit(next as Expression) : next) as T;
}

test("all six field residuals and coordinate changes are exact identities for arbitrary first derivatives", () => {
  const report = verifySRFieldCovariance();
  assert.equal(report.passed, true);
  assert.equal(report.inverseTransform, true);
  assert.equal(report.rows.length, 6);
  assert.ok(report.rows.every((row) => row.coordinateChange && row.residualIdentity));
  assert.deepEqual(
    report.rows.map((row) => row.divergence),
    ["electric", null, null, "magnetic", null, null],
  );
  assert.deepEqual(
    JSON.parse(JSON.stringify(report)),
    report,
    "only the report crosses the server boundary",
  );
});

test("quantity and axis identities determine the check independently of display glyphs and occurrence IDs", () => {
  const rows = rewrite(srFieldComponentRows, (expression) =>
    expression.kind === "symbol"
      ? { ...expression, termId: "same printed glyph" }
      : "opId" in expression
        ? { ...expression, opId: "same occurrence" }
        : expression,
  );
  assert.equal(verifySRFieldCovariance(rows).passed, true);
  const crossed = rows.map((row) =>
    row.component === "Y"
      ? {
          ...row,
          source: rewrite(row.source, (expression) =>
            expression.kind === "symbol" &&
            expression.quantityId === "electricFieldStationary" &&
            expression.index === "y"
              ? { ...expression, index: "z" }
              : expression,
          ),
        }
      : row,
  );
  assert.equal(verifySRFieldCovariance(crossed).passed, false);
});

test("a wrong sign in any one transformed row fails even when every other component remains correct", () => {
  for (let index = 0; index < srFieldComponentRows.length; index++) {
    const rows = srFieldComponentRows.map((row, at) =>
      at === index
        ? { ...row, grouped: { ...row.grouped, left: negative(row.grouped.left) } }
        : row,
    );
    const report = verifySRFieldCovariance(rows);
    assert.equal(report.passed, false, rows[index]?.component);
    assert.equal(report.rows[index]?.residualIdentity, false);
    assert.ok(report.rows.every((row, at) => at === index || row.residualIdentity));
  }
});

test("the parallel rows cannot silently drop their electric or magnetic divergence term", () => {
  for (const component of ["X", "L"]) {
    const rows = srFieldComponentRows.map((row) =>
      row.component === component
        ? {
            ...row,
            residualIdentity: {
              ...row.residualIdentity,
              right: {
                kind: "product",
                args: [
                  { kind: "symbol", termId: "β", quantityId: "lorentzFactor" },
                  residual(row.source),
                ],
              } as Expression,
            },
          }
        : row,
    );
    const report = verifySRFieldCovariance(rows);
    assert.equal(report.passed, false);
    assert.equal(report.rows.find((row) => row.component === component)?.residualIdentity, false);
  }
});

test("a wrong forward chain rule is detected independently of a correct regrouped identity", () => {
  const rows = srFieldComponentRows.map((row) =>
    row.component === "Y"
      ? {
          ...row,
          changed: rewrite(row.changed, (expression) =>
            expression.kind === "symbol" && expression.quantityId === "frameSpeed"
              ? negative(expression)
              : expression,
          ),
        }
      : row,
  );
  const report = verifySRFieldCovariance(rows);
  assert.equal(report.passed, false);
  assert.equal(report.rows[1]?.coordinateChange, false);
  assert.equal(report.rows[1]?.residualIdentity, true);
});

test("a stationary derivative cannot masquerade as a moving derivative with the same printed name", () => {
  const rows = srFieldComponentRows.map((row) =>
    row.component === "Z"
      ? {
          ...row,
          grouped: rewrite(row.grouped, (expression) =>
            expression.kind === "symbol" && expression.quantityId === "coordinateTimeMoving"
              ? { ...expression, quantityId: "coordinateTimeStationary" }
              : expression,
          ),
        }
      : row,
  );
  assert.equal(verifySRFieldCovariance(rows).passed, false);
});

test("complete component coverage and the actual residual are required, rather than a tautology", () => {
  assert.equal(verifySRFieldCovariance(srFieldComponentRows.slice(1)).passed, false);
  assert.equal(verifySRFieldCovariance([...srFieldComponentRows].reverse()).passed, false);
  const rows = srFieldComponentRows.map((row) => ({
    ...row,
    residualIdentity: {
      ...row.residualIdentity,
      left: { kind: "number", value: "0" } as Expression,
      right: { kind: "number", value: "0" } as Expression,
    },
  }));
  assert.equal(verifySRFieldCovariance(rows).passed, false);
});

test("unsupported domains, field denominators, higher derivatives and excessive depth fail closed", () => {
  const original = srFieldComponentRows[0];
  assert.ok(original);
  let deep: Expression = { kind: "number", value: "1" };
  for (let index = 0; index < 30; index++) deep = { kind: "group", argument: deep };
  const unsupported: Expression[] = [
    {
      kind: "quotient",
      numerator: original.source.left,
      denominator: { kind: "number", value: "0" },
    },
    {
      kind: "quotient",
      numerator: original.source.left,
      denominator: {
        kind: "symbol",
        termId: "X",
        quantityId: "electricFieldStationary",
        index: "x",
      },
    },
    {
      kind: "product",
      args: [
        { kind: "number", value: "0" },
        { kind: "function", name: "sin", argument: { kind: "number", value: "0" } },
      ],
    },
    {
      kind: "derivative",
      expression: original.source.left,
      variable: { kind: "symbol", termId: "t", quantityId: "coordinateTimeStationary" },
      order: 2,
      partial: true,
    },
    { kind: "power", base: { kind: "number", value: "2" }, exponent: { num: 1, den: 2 } },
    deep,
  ];
  for (const left of unsupported) {
    const report = verifySRFieldCovariance([
      { ...original, source: { ...original.source, left } },
      ...srFieldComponentRows.slice(1),
    ]);
    assert.equal(report.passed, false);
    assert.equal(report.inverseTransform, false);
    assert.ok(report.reason, left.kind);
  }
});
