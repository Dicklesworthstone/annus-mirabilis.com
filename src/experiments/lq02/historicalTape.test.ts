import { describe, expect, test } from "bun:test";
import { decodeTapePermalink, encodeTapePermalink } from "../permalink/codec.ts";
import { tapeStateDigestV2 } from "../permalink/sessionTape.ts";
import type { TapeV2 } from "../permalink/types.ts";
import { DEFAULT_HISTORICAL_LQ02_INPUTS, HISTORICAL_LQ02_MODE } from "./historical.ts";
import {
  historicalLq02Tape,
  loadHistoricalLq02Tape,
  loadHistoricalLq02TapeFromUrl,
} from "./historicalTape.ts";

function tape(): TapeV2 {
  const result = historicalLq02Tape({ ...DEFAULT_HISTORICAL_LQ02_INPUTS, nuCutoff: 2e14 });
  expect(result).not.toBeNull();
  if (!result) throw new Error("Expected a complete historical tape");
  return result;
}

describe("1904 allocation settings links", () => {
  test("mode, historical constants and settings survive the bounded codec", async () => {
    const encoded = encodeTapePermalink(tape());
    const decoded = decodeTapePermalink(encoded);
    expect(decoded.kind).toBe("success");
    if (decoded.kind !== "success") return;
    expect(decoded.tape.mode).toBe(HISTORICAL_LQ02_MODE);
    expect(decoded.tape.constantSetId).toBe("planck-1900-1901-printed");
    const loaded = await loadHistoricalLq02TapeFromUrl(
      `https://annus-mirabilis.com/lab/lq-02/1904/?tape=${encoded}`,
    );
    expect(loaded.kind).toBe("loaded");
    if (loaded.kind === "loaded") expect(loaded.settings.nuCutoff).toBe(2e14);
  });

  test("a changed mode is refused even if the settings digest is still valid", () => {
    for (const mode of ["lq-02:default", "lq-02:unknown", "sr-04:1904"])
      expect(loadHistoricalLq02Tape({ ...tape(), mode }).kind).toBe("not-restored");
  });

  test("identity changes, later settings and damage are refused", () => {
    const original = tape();
    for (const changed of [
      { ...original, experimentId: "sr-04" },
      { ...original, constantSetId: "modern-si-2019" },
      { ...original, modelIdentity: { modelId: "lq-02", modelVersion: 2 } },
      { ...original, initialConditions: { ...original.initialConditions, T: 3000 } },
    ])
      expect(loadHistoricalLq02Tape(changed).kind).toBe("not-restored");
    const initialConditions = { ...original.initialConditions, constantSetId: "modern-si-2019" };
    expect(
      loadHistoricalLq02Tape({
        ...original,
        initialConditions,
        acceptedCheckpoint: {
          ...original.acceptedCheckpoint,
          digest: tapeStateDigestV2(initialConditions, 0),
        },
      }).kind,
    ).toBe("not-restored");
  });

  test("missing fields cannot borrow historical defaults and masquerade as a complete tape", () => {
    const original = tape();
    const initialConditions = { T: 1500, nuCutoff: 1e14, probeFrequency: 1e13 };
    expect(
      loadHistoricalLq02Tape({
        ...original,
        initialConditions,
        acceptedCheckpoint: {
          ...original.acceptedCheckpoint,
          digest: tapeStateDigestV2(initialConditions, 0),
        },
      }).kind,
    ).toBe("not-restored");
  });
});
