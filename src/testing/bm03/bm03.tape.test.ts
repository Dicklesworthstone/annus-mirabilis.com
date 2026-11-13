import { describe, expect, test } from "bun:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { strictParse } from "../../content/schemas/strictParse.ts";
import { BM03_DEFAULTS, type Bm03Parameters } from "../../experiments/bm03/definition.ts";
import { createBm03Session } from "../../experiments/bm03/session.ts";
import { BM03_TAPE } from "../../experiments/bm03/tape.ts";
import { decodeTapePermalink, encodeTapePermalink } from "../../experiments/permalink/codec.ts";
import { restoreTape, tapeForSettings } from "../../experiments/permalink/sessionTape.ts";
import type { TapeV2 } from "../../experiments/permalink/types.ts";

const SETTINGS: Bm03Parameters = {
  ...BM03_DEFAULTS,
  Np: 3,
  volumeRatio: 3,
  V0: 2_000_000,
  T: 310,
  step: "derivative",
  notation: "modern",
};

function recording(parameters = SETTINGS): TapeV2 {
  const tape = tapeForSettings(BM03_TAPE, parameters);
  assert.ok(tape, "The actual configuration owner must accept the recorded settings.");
  return tape;
}

describe("configuration-integral recordings", () => {
  test("the binding uses the authored model identity and current scientific source", () => {
    const manifest = strictParse(
      readFileSync(new URL("../../../content/experiments/bm-03.yaml", import.meta.url), "utf8"),
      "yaml",
    ) as { tapeModel: { modelId: string; modelVersion: number } };
    expect(BM03_TAPE.environment.modelId).toBe(manifest.tapeModel.modelId);
    expect(BM03_TAPE.environment.modelVersion).toBe(manifest.tapeModel.modelVersion);
    expect(BM03_TAPE.environment.artifactDigest).toMatch(/^host:sha256:[a-f0-9]{64}$/);
    expect(recording().modelIdentity.artifactDigest).toBe(BM03_TAPE.environment.artifactDigest);
  });

  for (const model of ["independent", "locked-cluster"] as const) {
    test(`${model}: a portable recording reproduces the real accepted owner and presentation`, () => {
      const parameters = { ...SETTINGS, model };
      const source = createBm03Session("configuration-source");
      expect(source.apply(parameters).kind).toBe("accepted");
      const decoded = decodeTapePermalink(encodeTapePermalink(recording(parameters)));
      assert.equal(decoded.kind, "success");
      const receiver = createBm03Session("configuration-receiver");
      expect(restoreTape(BM03_TAPE, receiver, decoded.tape).kind).toBe("restored");
      expect(receiver.acceptedParameters()).toEqual(parameters);
      expect(receiver.getSnapshot().accepted?.outputs).toEqual(
        source.getSnapshot().accepted?.outputs,
      );
      expect(receiver.evaluate(receiver.acceptedParameters()).exactDecimalString).toBe(
        model === "independent" ? "27" : "3",
      );
      expect(receiver.getSnapshot().accepted?.final).toBe(true);
    });
  }

  const corruptions: readonly [string, (tape: TapeV2) => TapeV2][] = [
    [
      "changed checkpoint",
      (tape) => ({
        ...tape,
        acceptedCheckpoint: { ...tape.acceptedCheckpoint, digest: "host:0000000000000000" },
      }),
    ],
    [
      "different scientific source",
      (tape) => ({
        ...tape,
        modelIdentity: { ...tape.modelIdentity, artifactDigest: "host:0000000000000000" },
      }),
    ],
    [
      "refused particle count",
      (tape) => ({ ...tape, initialConditions: { ...tape.initialConditions, Np: 0 } }),
    ],
  ];
  for (const [label, corrupt] of corruptions) {
    test(`${label} preserves the previous accepted result and its revision identity`, () => {
      const receiver = createBm03Session("configuration-keep-result");
      expect(receiver.apply({ ...BM03_DEFAULTS, Np: 7 }).kind).toBe("accepted");
      const previous = receiver.getSnapshot();
      const parameters = receiver.acceptedParameters();
      const request = corrupt(recording());
      const before = JSON.stringify(request);
      expect(restoreTape(BM03_TAPE, receiver, request).kind).toBe("not-restored");
      expect(receiver.getSnapshot()).toBe(previous);
      expect(receiver.acceptedParameters()).toBe(parameters);
      expect(JSON.stringify(request)).toBe(before);
    });
  }
});
