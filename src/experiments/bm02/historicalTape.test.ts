import { describe, expect, test } from "bun:test";
import { LQ02_DRAFT_TAPE } from "../lq02/draftTape.ts";
import { decodeTapePermalink, encodeTapePermalink } from "../permalink/codec.ts";
import {
  type DraftTapeBinding,
  draftTapeForSettings,
  loadDraftTape,
} from "../permalink/draftTape.ts";
import { tapeStateDigestV2 } from "../permalink/sessionTape.ts";
import type { TapeV2 } from "../permalink/types.ts";
import { BM02_DRAFT_TAPE } from "./draftTape.ts";
import { BM02_DEFAULTS, validateBm02Parameters } from "./parameters.ts";
import type { Bm02Inputs } from "./session.ts";

const MODERN = "modern-si-2019";
const HISTORICAL = "einstein-1905-brownian-printed";

function tapeFor(constantSetId: Bm02Inputs["constantSetId"]): TapeV2 {
  const tape = draftTapeForSettings(BM02_DRAFT_TAPE, {
    ...BM02_DEFAULTS,
    Np: 4000,
    constantSetId,
  });
  expect(tape).not.toBeNull();
  return tape as TapeV2;
}

describe("BM-02 shared settings preserve the selected constants", () => {
  for (const constantSetId of [MODERN, HISTORICAL] as const) {
    test(`${constantSetId}: the address carries and restores this constant identity`, () => {
      const tape = tapeFor(constantSetId);
      expect(tape.constantSetId).toBe(constantSetId);
      expect(tape.initialConditions.constantSetId).toBe(constantSetId);
      const decoded = decodeTapePermalink(`?tape=${encodeTapePermalink(tape)}`);
      expect(decoded.kind).toBe("success");
      if (decoded.kind !== "success") return;
      expect(loadDraftTape(BM02_DRAFT_TAPE, decoded.tape)).toEqual({
        kind: "loaded",
        settings: { ...BM02_DEFAULTS, Np: 4000, constantSetId },
      });
    });
  }

  test("a legacy settings link that omits constants keeps the modern default", () => {
    const { constantSetId, ...settings } = BM02_DEFAULTS;
    expect(constantSetId).toBe(MODERN);
    const tape = draftTapeForSettings(BM02_DRAFT_TAPE, settings);
    expect(tape).not.toBeNull();
    if (!tape) return;
    expect(tape.constantSetId).toBe(MODERN);
    expect(loadDraftTape(BM02_DRAFT_TAPE, tape)).toEqual({
      kind: "loaded",
      settings: BM02_DEFAULTS,
    });
    expect(loadDraftTape(BM02_DRAFT_TAPE, { ...tape, constantSetId: HISTORICAL }).kind).toBe(
      "not-restored",
    );
  });

  for (const [selected, different] of [
    [MODERN, HISTORICAL],
    [HISTORICAL, MODERN],
  ] as const) {
    test(`${selected}: a contradictory tape header is refused`, () => {
      const tape = tapeFor(selected);
      const loaded = loadDraftTape(BM02_DRAFT_TAPE, { ...tape, constantSetId: different });
      expect(loaded.kind).toBe("not-restored");
      if (loaded.kind !== "not-restored") return;
      expect(loaded.notice).toContain(`Recorded with constant set "${different}"`);
      expect(loaded.notice).toContain(`current is "${selected}"`);
    });

    test(`${selected}: changing the settings and their digest cannot retain the old identity`, () => {
      const tape = tapeFor(selected);
      const initialConditions = { ...tape.initialConditions, constantSetId: different };
      const loaded = loadDraftTape(BM02_DRAFT_TAPE, {
        ...tape,
        initialConditions,
        acceptedCheckpoint: {
          ...tape.acceptedCheckpoint,
          digest: tapeStateDigestV2(initialConditions, 0),
        },
      });
      expect(loaded.kind).toBe("not-restored");
      if (loaded.kind !== "not-restored") return;
      // This must reach the identity check, not merely fail the settings checksum.
      expect(loaded.notice).toContain(`Recorded with constant set "${selected}"`);
      expect(loaded.notice).toContain(`current is "${different}"`);
    });
  }

  test("an unsupported set cannot be minted or loaded, even with a matching header and digest", () => {
    const constantSetId = "unregistered-constants";
    expect(draftTapeForSettings(BM02_DRAFT_TAPE, { ...BM02_DEFAULTS, constantSetId })).toBeNull();
    const tape = tapeFor(MODERN);
    const initialConditions = { ...tape.initialConditions, constantSetId };
    const loaded = loadDraftTape(BM02_DRAFT_TAPE, {
      ...tape,
      constantSetId,
      initialConditions,
      acceptedCheckpoint: {
        ...tape.acceptedCheckpoint,
        digest: tapeStateDigestV2(initialConditions, 0),
      },
    });
    expect(loaded.kind).toBe("not-restored");
    if (loaded.kind === "not-restored") expect(loaded.notice).toContain("Choose modern SI");
  });

  test("selectable constants do not relax model, stream or allocation compatibility", () => {
    const tape = tapeFor(HISTORICAL);
    for (const changed of [
      { ...tape, modelIdentity: { ...tape.modelIdentity, modelVersion: 2 } },
      { ...tape, streamVersion: "another-stream" },
      { ...tape, allocationId: "another-allocation" },
    ]) {
      expect(loadDraftTape(BM02_DRAFT_TAPE, changed).kind).toBe("not-restored");
    }
  });

  test("a fixed-constant laboratory still refuses a different header", () => {
    const tape = draftTapeForSettings(LQ02_DRAFT_TAPE, LQ02_DRAFT_TAPE.defaults);
    expect(tape).not.toBeNull();
    if (!tape) return;
    expect(loadDraftTape(LQ02_DRAFT_TAPE, tape).kind).toBe("loaded");
    const loaded = loadDraftTape(LQ02_DRAFT_TAPE, { ...tape, constantSetId: HISTORICAL });
    expect(loaded.kind).toBe("not-restored");
    if (loaded.kind === "not-restored") expect(loaded.notice).toContain(`current is "${MODERN}"`);
  });

  test("the identity resolver receives accepted validator output and never refused settings", () => {
    let acceptedData: Bm02Inputs | undefined;
    const resolved: Readonly<Record<string, unknown>>[] = [];
    const binding: DraftTapeBinding = {
      ...BM02_DRAFT_TAPE,
      validate(input) {
        const checked = validateBm02Parameters(input);
        if (checked.kind === "accepted") acceptedData = checked.data;
        return checked;
      },
      constantSetIdForSettings(settings) {
        expect(settings).toBe(acceptedData);
        expect(Object.isFrozen(settings)).toBe(true);
        resolved.push(settings);
        return (settings as Bm02Inputs).constantSetId;
      },
    };
    expect(draftTapeForSettings(binding, { ...BM02_DEFAULTS, T: -1 })).toBeNull();
    expect(resolved).toHaveLength(0);
    const tape = draftTapeForSettings(binding, { ...BM02_DEFAULTS, constantSetId: HISTORICAL });
    expect(tape).not.toBeNull();
    if (!tape) return;
    expect(resolved).toHaveLength(1);
    expect(loadDraftTape(binding, tape).kind).toBe("loaded");
    expect(resolved).toHaveLength(2);
    expect(
      loadDraftTape(binding, {
        ...tape,
        initialConditions: { ...tape.initialConditions, T: -1 },
      }).kind,
    ).toBe("not-restored");
    expect(resolved).toHaveLength(2);
  });
});
