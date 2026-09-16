import { describe, expect, test } from "bun:test";
import { TapeValidationError, validateControlTape } from "./schema.ts";

const baseTape = {
  tapeVersion: 2,
  tapeId: "expected-display-value-fixture",
  experimentId: "bm-01",
  mode: "bm-01:default",
  modelIdentity: {
    modelId: "brownian-motion-reference",
    modelVersion: "1.0.0",
    artifactDigest: "host:sha256:0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef",
  },
  constantSetId: "einstein-1905-brownian-printed",
  seed: "1905",
  streamVersion: 1,
  allocationId: "bm-01.latent.v1",
  initialConditions: { viscosity: 1.35e-3 },
  events: [],
};

function checkpointWith(expectedDisplayValues: unknown) {
  return {
    ...baseTape,
    checkpoints: [
      {
        actionIndex: 0,
        stepIndex: 0,
        simulatedTime: 0,
        digest: "host:sha256:1111111111111111111111111111111111111111111111111111111111111111",
        digestKind: "host",
        checkpointVersion: 1,
        streamSemanticsVersion: 1,
        seed: "1905",
        streamPositions: [],
        expectedDisplayValues,
      },
    ],
  };
}

describe("schema: expectedDisplayValues (am-bm-01-tracer-ensemble-hdly)", () => {
  test("a checkpoint with no expectedDisplayValues validates (the field is optional)", () => {
    const tape = validateControlTape({
      ...baseTape,
      checkpoints: [
        {
          actionIndex: 0,
          stepIndex: 0,
          simulatedTime: 0,
          digest: "host:sha256:1111111111111111111111111111111111111111111111111111111111111111",
          digestKind: "host",
          checkpointVersion: 1,
          streamSemanticsVersion: 1,
          seed: "1905",
          streamPositions: [],
        },
      ],
    });
    expect(tape.checkpoints[0]?.expectedDisplayValues).toBeUndefined();
  });

  test("an expected display value naming its constant set validates", () => {
    const tape = validateControlTape(
      checkpointWith([
        {
          label: "lambda_x at 1 s",
          value: 0.7947833,
          unit: "um",
          constantSetId: "einstein-1905-brownian-printed",
        },
      ]),
    );
    expect(tape.checkpoints[0]?.expectedDisplayValues?.[0]?.constantSetId).toBe(
      "einstein-1905-brownian-printed",
    );
  });

  test("an expected display value with no constantSetId is rejected", () => {
    expect(() =>
      validateControlTape(checkpointWith([{ label: "lambda_x at 1 s", value: 0.79, unit: "um" }])),
    ).toThrow(TapeValidationError);
  });

  test("an expected display value with an empty constantSetId is rejected", () => {
    expect(() =>
      validateControlTape(
        checkpointWith([{ label: "lambda_x at 1 s", value: 0.79, unit: "um", constantSetId: "" }]),
      ),
    ).toThrow(TapeValidationError);
  });

  test("an expected display value with no unit is rejected", () => {
    expect(() =>
      validateControlTape(
        checkpointWith([
          {
            label: "lambda_x at 1 s",
            value: 0.79,
            constantSetId: "einstein-1905-brownian-printed",
          },
        ]),
      ),
    ).toThrow(TapeValidationError);
  });
});
