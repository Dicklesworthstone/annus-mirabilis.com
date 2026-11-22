import assert from "node:assert/strict";
import test from "node:test";
import type { Expression } from "../ast.ts";
import { brownianOsmoticExpressions as e, brownianOsmoticSymbols as s } from "./brownianOsmotic.ts";
import { brownianOsmoticCheckRows, verifyBrownianOsmotic } from "./brownianOsmoticProof.ts";
import { substituteNode } from "./treeUtils.ts";

test("the declared fixed-temperature algebra and one-cluster derivative are exact", () => {
  const report = verifyBrownianOsmotic();
  assert.equal(report.status, "pass");
  assert.deepEqual(
    report.rows.map((row) => row.id),
    [...brownianOsmoticCheckRows],
  );
  assert.ok(report.rows.every((row) => row.status === "pass"));
});

test("a lost count, reversed pressure or absent molecular-number denominator fails", () => {
  const negative = (argument: Expression): Expression => ({ kind: "negate", argument });
  for (const right of [
    substituteNode(e.independentPressure.right, "particleCount", { kind: "number", value: "1" }),
    substituteNode(e.independentPressure.right, "avogadroConstant", { kind: "number", value: "1" }),
    negative(e.independentPressure.right),
  ]) {
    const report = verifyBrownianOsmotic({
      ...e,
      independentPressure: { ...e.independentPressure, right },
    });
    assert.equal(report.status, "fail");
    assert.equal(report.rows.find((row) => row.id === "pressure-sign")?.status, "fail");
  }
});

test("the reference ratio must preserve the expansion sign and the reference volume", () => {
  for (const right of [
    { kind: "negate" as const, argument: e.freeEnergyDifference.right },
    substituteNode(e.freeEnergyDifference.right, "referenceVolume", s.V),
  ]) {
    const report = verifyBrownianOsmotic({
      ...e,
      freeEnergyDifference: { ...e.freeEnergyDifference, right },
    });
    assert.equal(
      report.rows.find((row) => row.id === "reference-volume-difference")?.status,
      "fail",
    );
  }
});

test("a V-dependent statistical factor is not admitted as a constant", () => {
  const dependent: Expression = { ...s.J, at: s.V };
  const changed = substituteNode(
    e.freeEnergySubtraction.right,
    "configurationIntegralFactor",
    dependent,
  );
  const report = verifyBrownianOsmotic({
    ...e,
    freeEnergySubtraction: { ...e.freeEnergySubtraction, right: changed },
  });
  assert.equal(report.status, "fail");
  assert.equal(report.rows.find((row) => row.id === "reference-volume-difference")?.status, "fail");
});

test("an undeclared removable pole cannot be hidden in the pressure expression", () => {
  const z: Expression = { kind: "symbol", termId: "z", quantityId: "unadmittedDenominator" };
  const right: Expression = {
    kind: "product",
    args: [e.independentPressure.right, { kind: "quotient", numerator: z, denominator: z }],
  };
  assert.equal(
    verifyBrownianOsmotic({ ...e, independentPressure: { ...e.independentPressure, right } })
      .status,
    "fail",
  );
});

test("the derivative is of volume at fixed temperature and count, not a changed process", () => {
  assert.equal(e.freeEnergyDerivative.left.kind, "derivative");
  if (e.freeEnergyDerivative.left.kind !== "derivative") return;
  for (const left of [
    { ...e.freeEnergyDerivative.left, variable: s.T },
    { ...e.freeEnergyDerivative.left, heldFixed: [s.T] },
    { ...e.freeEnergyDerivative.left, order: 2 },
  ])
    assert.equal(
      verifyBrownianOsmotic({ ...e, freeEnergyDerivative: { ...e.freeEnergyDerivative, left } })
        .status,
      "fail",
    );
});

test("a cluster pressure cannot silently count all its locked constituents", () => {
  assert.equal(
    verifyBrownianOsmotic({
      ...e,
      lockedPressure: { ...e.lockedPressure, right: e.independentPressure.right },
    }).status,
    "fail",
  );
  assert.equal(
    verifyBrownianOsmotic({ ...e, numberDensity: { ...e.numberDensity, operator: "approx" } })
      .status,
    "fail",
  );
});
