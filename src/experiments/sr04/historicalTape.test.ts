import { describe, expect, test } from "bun:test";
import { decodeTapePermalink, encodeTapePermalink } from "../permalink/codec.ts";
import { tapeStateDigestV2 } from "../permalink/sessionTape.ts";
import type { TapeV2 } from "../permalink/types.ts";
import { SR04_HISTORICAL_MODE } from "./historical.ts";
import {
  historicalSr04Tape,
  loadHistoricalSr04Tape,
  loadHistoricalSr04TapeFromUrl,
} from "./historicalTape.ts";

const inputs = { objectSpeed: -15, observerSpeed: 5, vOverC: -0.25 };
function tape(): TapeV2 {
  const result = historicalSr04Tape(inputs);
  expect(result).not.toBeNull();
  if (!result) throw new Error("The valid illustrative settings must have a tape");
  return result;
}

function withSettings(initialConditions: TapeV2["initialConditions"]): TapeV2 {
  const original = tape();
  return {
    ...original,
    initialConditions,
    acceptedCheckpoint: {
      ...original.acceptedCheckpoint,
      digest: tapeStateDigestV2(initialConditions, 0),
    },
  };
}

describe("the historical Galilean settings link", () => {
  test("accepted settings round-trip through the real bounded codec into a draft", async () => {
    const encoded = encodeTapePermalink(tape());
    const decoded = decodeTapePermalink(encoded);
    expect(decoded.kind).toBe("success");
    if (decoded.kind !== "success") return;
    expect(decoded.tape.mode).toBe(SR04_HISTORICAL_MODE);
    expect(decoded.tape.constantSetId).toBe("1904-symbolic-light-speed");
    expect(decoded.tape.events).toEqual([]);
    expect(loadHistoricalSr04Tape(decoded.tape)).toEqual({ kind: "loaded", settings: inputs });
    expect(
      await loadHistoricalSr04TapeFromUrl(
        `https://annus-mirabilis.com/lab/sr-04/1904/?tape=${encoded}`,
      ),
    ).toEqual({ kind: "loaded", settings: inputs });
  });

  test("a changed mode cannot pass on the strength of the settings digest", () => {
    for (const mode of ["sr-04:default", "sr-04:full", "lq-02:1904"])
      expect(loadHistoricalSr04Tape({ ...tape(), mode }).kind).toBe("not-restored");
  });

  test("identity changes and a damaged payload keep the existing settings", () => {
    const original = tape();
    for (const changed of [
      { ...original, experimentId: "sr-03" },
      { ...original, constantSetId: "modern-si-2019" },
      { ...original, modelIdentity: { modelId: "sr-04", modelVersion: 2 } },
      { ...original, streamVersion: "other" },
      { ...original, initialConditions: { ...inputs, objectSpeed: -16 } },
    ])
      expect(loadHistoricalSr04Tape(changed).kind).toBe("not-restored");
  });

  test("missing, invalid and later-mode settings are refused even with a matching digest", () => {
    for (const initialConditions of [
      { objectSpeed: -15, observerSpeed: 5 },
      { ...inputs, vOverC: "-0.25" },
      { ...inputs, vOverC: 1 },
      { ...inputs, objectSpeed: 10_001 },
      { ...inputs, showLaterAids: "true" },
      { ...inputs, enabledConstraints: "right-moving-light" },
    ])
      expect(loadHistoricalSr04Tape(withSettings(initialConditions)).kind).toBe("not-restored");
  });

  test("settings links cannot replay later construction or prediction commands", () => {
    const original = tape();
    expect(
      loadHistoricalSr04Tape({
        ...original,
        events: [
          { actionIndex: 1, commandClass: "setup-change", paramId: "candidateA", value: 1.25 },
        ],
      }).kind,
    ).toBe("not-restored");
    expect(
      loadHistoricalSr04Tape({
        ...original,
        predictions: [
          {
            promptId: "sr-04-predict-light-constraints",
            form: "candidate",
            payload: { candidateId: "b-equals-a" },
          },
        ],
      }).kind,
    ).toBe("not-restored");
    expect(
      loadHistoricalSr04Tape({
        ...original,
        teachingTapeRef: { tapeId: "sr-04-construction", stepIndex: 2 },
      }).kind,
    ).toBe("not-restored");
  });

  test("an invalid address is absent and invalid settings cannot become a shared link", async () => {
    expect(await loadHistoricalSr04TapeFromUrl("not a URL")).toEqual({ kind: "absent" });
    expect(
      await loadHistoricalSr04TapeFromUrl("https://annus-mirabilis.com/lab/sr-04/1904/"),
    ).toEqual({ kind: "absent" });
    expect(historicalSr04Tape({ ...inputs, vOverC: Infinity })).toBeNull();
  });
});
