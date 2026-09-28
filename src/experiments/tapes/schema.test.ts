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

  test("an unknown key is refused by name rather than dropped", () => {
    // BOTH DIRECTIONS (am-2rl9, dispatch 383). Until this, the validator rebuilt each entry from the
    // four keys it knew, so a field an author added was silently discarded: no error, no effect, and
    // nothing saying the record did not mean what it says. Measured before choosing to refuse: across
    // the 22 tape records, 0 of 29 expectation entries carried an unknown key.
    const known = {
      label: "lambda_x at 1 s",
      value: 0.7947833,
      unit: "um",
      constantSetId: "einstein-1905-brownian-printed",
    };
    // The known-keys-only entry still passes, so the refusal below is about the unknown key and not
    // about a validator that has started refusing everything.
    expect(
      validateControlTape(checkpointWith([known])).checkpoints[0]?.expectedDisplayValues?.[0]
        ?.label,
    ).toBe("lambda_x at 1 s");

    let refusal = "";
    try {
      validateControlTape(checkpointWith([{ ...known, quantityId: "diffusionCoefficient" }]));
    } catch (error) {
      refusal = (error as Error).message;
    }
    // Named, so an author can see which key was not understood, and told what is known.
    expect(refusal).toContain("quantityId");
    expect(refusal).toContain("unknown key");
    expect(refusal).toContain("constantSetId");
    // Two unknown keys are both named, and the plural reads correctly.
    let plural = "";
    try {
      validateControlTape(checkpointWith([{ ...known, foo: 1, bar: 2 }]));
    } catch (error) {
      plural = (error as Error).message;
    }
    expect(plural).toContain("unknown keys");
    expect(plural).toContain('"foo"');
    expect(plural).toContain('"bar"');
  });

  test("outputId is optional, carried through, and refused when it is not a name", () => {
    const base = {
      label: "W (locked)",
      value: 0.5,
      unit: "1",
      constantSetId: "modern-si-2019",
    };
    // Absent: the field is optional and an entry without it is unchanged.
    expect(
      validateControlTape(checkpointWith([base])).checkpoints[0]?.expectedDisplayValues?.[0]
        ?.outputId,
    ).toBeUndefined();
    // Present: carried onto the validated record, which is the whole point. Before this schema knew
    // the key, this same record validated and the field vanished.
    expect(
      validateControlTape(checkpointWith([{ ...base, outputId: "lockedProbability" }]))
        .checkpoints[0]?.expectedDisplayValues?.[0]?.outputId,
    ).toBe("lockedProbability");
    // Empty or non-string is refused rather than treated as unset.
    for (const bad of ["", "   ", 7, null]) {
      let refusal = "";
      try {
        validateControlTape(checkpointWith([{ ...base, outputId: bad }]));
      } catch (error) {
        refusal = (error as Error).message;
      }
      expect([JSON.stringify(bad), refusal.includes("outputId")]).toEqual([
        JSON.stringify(bad),
        true,
      ]);
    }
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
