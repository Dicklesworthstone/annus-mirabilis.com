import { describe, expect, test } from "bun:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { TestLogger } from "../../testing/log/logger.ts";
import {
  type CurvePredictionMetadata,
  CurvePredictionValidationError,
  curvePredictionFields,
  validateCurvePrediction,
} from "./curvePrediction.ts";
import { validateExperiment } from "./experiment.ts";
import { strictParse } from "./strictParse.ts";

const logger = new TestLogger("curve-prediction-authoring");

function valid(): CurvePredictionMetadata {
  return {
    x: { label: "Position", min: -2, max: 2, unit: "m" },
    y: { label: "Density", min: 0, max: 1, unit: "m⁻¹" },
    valueTargets: [
      { targetId: "left", label: "At the left edge", x: -2 },
      { targetId: "centre", label: "At the centre", x: 0, min: 0, max: 1, unit: "m⁻¹" },
      { targetId: "right", label: "At the right edge", x: 2, min: 0.25, max: 0.75 },
    ],
    verbalChoices: {
      directionChoices: [{ id: "symmetric", label: "Symmetric" }],
      shapeChoices: [
        { id: "bell", label: "A bell" },
        { id: "flat", label: "Flat" },
      ],
    },
  };
}

function refused(input: unknown, path: string) {
  assert.throws(
    () => validateCurvePrediction(input, "fixture.curvePrediction"),
    (error: unknown) => {
      assert.ok(error instanceof CurvePredictionValidationError);
      assert.equal(error.code, "invalid-curve-prediction");
      assert.equal(error.path, `fixture.curvePrediction${path}`);
      return true;
    },
  );
  logger.log({
    testId: `refuse:${path}`,
    beadId: "am-inst-predict-mode-ti7m",
    expected: "invalid-curve-prediction",
    actual: "invalid-curve-prediction",
    comparisonKind: "bitwise",
    outcome: "passed",
  });
}

describe("authored curve prediction metadata", () => {
  test("keeps authored coordinates, labels, units and optional ranges, deeply immutable", () => {
    const source = valid();
    const result = validateCurvePrediction(source);
    expect(result).toEqual(source);
    expect(result).not.toBe(source);
    for (const object of [
      result,
      result.x,
      result.y,
      result.valueTargets,
      ...result.valueTargets,
      result.verbalChoices,
      result.verbalChoices?.directionChoices,
      ...(result.verbalChoices?.shapeChoices ?? []),
    ])
      expect(Object.isFrozen(object)).toBe(true);
    logger.log({
      testId: "preserve-authoring",
      beadId: "am-inst-predict-mode-ti7m",
      expected: source,
      actual: result,
      comparisonKind: "bitwise",
      outcome: "passed",
    });
  });

  test("invalid-curve-prediction refuses malformed roots with a typed field path", () => {
    assert.throws(() => validateCurvePrediction(null, "fixture.curvePrediction"), {
      code: "invalid-curve-prediction",
      path: "fixture.curvePrediction",
    });
    for (const input of [null, [], false, "curve", undefined]) refused(input, "");
  });

  test("candidate-only manifests acquire no curve metadata or implied forms", () => {
    const raw = strictParse(
      readFileSync(
        new URL("./__fixtures__/experiment/experiment-valid.yaml", import.meta.url),
        "utf8",
      ),
      "yaml",
    ) as Record<string, any>;
    const original = validateExperiment(raw);
    assert.ok("prompts" in original.predictMode);
    expect(original.predictMode.prompts[0]).not.toHaveProperty("curvePrediction");
    expect(curvePredictionFields({}, "fixture")).toEqual({});
    raw.predictMode.prompts[0].curvePrediction = valid();
    const withCurve = validateExperiment(raw);
    assert.ok("prompts" in withCurve.predictMode);
    expect(withCurve.predictMode.prompts[0]?.curvePrediction).toEqual(valid());
    raw.predictMode.prompts[0].curvePrediction = null;
    expect(() => validateExperiment(raw)).toThrow(CurvePredictionValidationError);
  });

  test("verbal choices are optional; coordinate endpoints and a one-value target range are valid", () => {
    const input = valid();
    const { verbalChoices: _verbal, ...withoutVerbal } = input;
    expect(validateCurvePrediction(withoutVerbal)).not.toHaveProperty("verbalChoices");
    expect(
      validateCurvePrediction({
        ...withoutVerbal,
        valueTargets: [{ targetId: "exact", label: "One value", x: 2, min: 0.5, max: 0.5 }],
      }).valueTargets[0],
    ).toMatchObject({ min: 0.5, max: 0.5 });
  });

  const cases: readonly [string, (input: any) => void, string][] = [
    [
      "unknown root field",
      (v) => {
        v.answers = [];
      },
      ".answers",
    ],
    [
      "missing axis",
      (v) => {
        v.x = undefined;
      },
      ".x",
    ],
    [
      "unknown axis field",
      (v) => {
        v.x.scale = "linear";
      },
      ".x.scale",
    ],
    [
      "empty label",
      (v) => {
        v.x.label = " ";
      },
      ".x.label",
    ],
    [
      "oversized label",
      (v) => {
        v.y.label = "x".repeat(201);
      },
      ".y.label",
    ],
    [
      "nonnumeric minimum",
      (v) => {
        v.x.min = "0";
      },
      ".x.min",
    ],
    [
      "infinite maximum",
      (v) => {
        v.y.max = Infinity;
      },
      ".y.max",
    ],
    [
      "NaN minimum",
      (v) => {
        v.y.min = Number.NaN;
      },
      ".y.min",
    ],
    [
      "reversed axis",
      (v) => {
        v.x.min = 3;
      },
      ".x",
    ],
    [
      "zero axis span",
      (v) => {
        v.y.min = 1;
      },
      ".y",
    ],
    [
      "overflowing axis span",
      (v) => {
        v.x.min = -Number.MAX_VALUE;
        v.x.max = Number.MAX_VALUE;
      },
      ".x",
    ],
    [
      "malformed unit",
      (v) => {
        v.y.unit = 1;
      },
      ".y.unit",
    ],
    [
      "missing targets",
      (v) => {
        v.valueTargets = undefined;
      },
      ".valueTargets",
    ],
    [
      "empty targets",
      (v) => {
        v.valueTargets = [];
      },
      ".valueTargets",
    ],
    [
      "too many targets",
      (v) => {
        v.valueTargets = Array.from({ length: 17 }, (_, i) => ({
          targetId: `p${i}`,
          label: "Value",
          x: 0,
        }));
      },
      ".valueTargets",
    ],
    [
      "malformed target",
      (v) => {
        v.valueTargets[0] = null;
      },
      ".valueTargets[0]",
    ],
    [
      "duplicate target",
      (v) => {
        v.valueTargets[1].targetId = "left";
      },
      ".valueTargets[1].targetId",
    ],
    [
      "empty target id",
      (v) => {
        v.valueTargets[0].targetId = "";
      },
      ".valueTargets[0].targetId",
    ],
    [
      "oversized target id",
      (v) => {
        v.valueTargets[0].targetId = "x".repeat(65);
      },
      ".valueTargets[0].targetId",
    ],
    [
      "target id whitespace",
      (v) => {
        v.valueTargets[0].targetId = " left ";
      },
      ".valueTargets[0].targetId",
    ],
    [
      "missing target position",
      (v) => {
        v.valueTargets[0].x = undefined;
      },
      ".valueTargets[0].x",
    ],
    [
      "outside target position",
      (v) => {
        v.valueTargets[0].x = -3;
      },
      ".valueTargets[0].x",
    ],
    [
      "infinite target position",
      (v) => {
        v.valueTargets[0].x = Infinity;
      },
      ".valueTargets[0].x",
    ],
    [
      "reversed target range",
      (v) => {
        v.valueTargets[0].min = 0.75;
        v.valueTargets[0].max = 0.25;
      },
      ".valueTargets[0]",
    ],
    [
      "target minimum outside y",
      (v) => {
        v.valueTargets[0].min = -1;
      },
      ".valueTargets[0].min",
    ],
    [
      "target maximum outside y",
      (v) => {
        v.valueTargets[0].max = 2;
      },
      ".valueTargets[0].max",
    ],
    [
      "nonnumeric target maximum",
      (v) => {
        v.valueTargets[0].max = "1";
      },
      ".valueTargets[0].max",
    ],
    [
      "unknown target field",
      (v) => {
        v.valueTargets[0].step = 1;
      },
      ".valueTargets[0].step",
    ],
    [
      "missing shape choices",
      (v) => {
        v.verbalChoices.shapeChoices = undefined;
      },
      ".verbalChoices.shapeChoices",
    ],
    [
      "empty direction choices",
      (v) => {
        v.verbalChoices.directionChoices = [];
      },
      ".verbalChoices.directionChoices",
    ],
    [
      "too many shape choices",
      (v) => {
        v.verbalChoices.shapeChoices = Array.from({ length: 17 }, (_, i) => ({
          id: `s${i}`,
          label: "Shape",
        }));
      },
      ".verbalChoices.shapeChoices",
    ],
    [
      "duplicate shape id",
      (v) => {
        v.verbalChoices.shapeChoices[1].id = "bell";
      },
      ".verbalChoices.shapeChoices[1].id",
    ],
    [
      "empty direction id",
      (v) => {
        v.verbalChoices.directionChoices[0].id = "";
      },
      ".verbalChoices.directionChoices[0].id",
    ],
    [
      "oversized shape id",
      (v) => {
        v.verbalChoices.shapeChoices[0].id = "x".repeat(65);
      },
      ".verbalChoices.shapeChoices[0].id",
    ],
    [
      "unknown choice field",
      (v) => {
        v.verbalChoices.shapeChoices[0].correct = true;
      },
      ".verbalChoices.shapeChoices[0].correct",
    ],
  ];
  for (const [name, mutate, path] of cases) {
    test(`refuses ${name}`, () => {
      const input = structuredClone(valid());
      mutate(input);
      refused(input, path);
    });
  }
});
