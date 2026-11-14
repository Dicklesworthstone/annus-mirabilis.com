import { describe, expect, test } from "bun:test";
import assert from "node:assert/strict";
import { deflateRawSync } from "node:zlib";
import { parseU64 } from "../identity/u64.ts";
import {
  decodeTapeDocumentInBrowser,
  decodeTapePermalinkInBrowser,
  encodeTapePermalinkInBrowser,
} from "./browserCodec.ts";
import { decodeTapeDocument, decodeTapePermalink, encodeTapePermalink } from "./codec.ts";
import {
  bytesToBase64Url,
  MAX_DECOMPRESSED_TAPE_BYTES,
  MAX_PERMALINK_URL_LENGTH,
  tapePayloadBytes,
} from "./codecCore.ts";
import { validateTapeGroupV3 } from "./groupSchema.ts";
import { TapeValidationError } from "./schema.ts";
import type { TapeGroupV3, TapeV2 } from "./types.ts";

function owner(id: string, seed = "18446744073709551615"): TapeV2 {
  return {
    tapeVersion: 2,
    experimentId: id,
    mode: `${id}:default`,
    modelIdentity: { modelId: `${id}-host`, modelVersion: 1 },
    constantSetId: "modern-si-2019",
    seed: parseU64(seed),
    streamVersion: "deterministic",
    allocationId: "deterministic",
    initialConditions: { beta: 0.6 },
    events: [],
    acceptedCheckpoint: {
      acceptedActionIndex: 0,
      acceptedInputRevision: 0,
      digest: "host:0123456789abcdef",
    },
  };
}

function group(): TapeGroupV3 {
  return {
    tapeVersion: 3,
    group: {
      definitionVersion: 1,
      groupId: "relativity-observer",
      quantityId: "frameSpeed",
      canonicalUnit: "m/s",
      commandClass: "observer-change",
      direction: "propagates",
      conversion: "unit-display",
      commitPolicy: "coherent",
      enabled: true,
      valueSI: 179875474.8,
    },
    members: [
      { memberId: "sr-09", parameterId: "beta", displayUnit: "c", tape: owner("sr-09") },
      { memberId: "sr-10", parameterId: "beta", displayUnit: "c", tape: owner("sr-10", "9007199254740993") },
    ],
  };
}

describe("V3 groups in the existing bounded tape transport", () => {
  test("both codecs retain independent owner identities and canonical member slots", async () => {
    const tape = group();
    const fromServer = encodeTapePermalink(tape);
    const fromBrowser = await encodeTapePermalinkInBrowser(tape);
    expect(fromServer).toBe(fromBrowser);
    expect(fromServer.length).toBeLessThan(MAX_PERMALINK_URL_LENGTH);
    expect(encodeTapePermalink({ ...tape, members: [...tape.members].reverse() })).toBe(fromServer);
    for (const decoded of [
      decodeTapeDocument(fromBrowser),
      await decodeTapeDocumentInBrowser(`https://example.test/lab/linked-observer/?tape=${fromServer}`),
    ]) {
      assert(decoded.kind === "success" && decoded.tape.tapeVersion === 3);
      expect(decoded.tape).toEqual(tape);
      expect(decoded.tape.members.map((member) => member.tape.seed)).toEqual([
        "18446744073709551615",
        "9007199254740993",
      ]);
      expect(new Set(decoded.tape.members.map((member) => member.tape.modelIdentity.modelId)).size).toBe(2);
    }
    for (const decoded of [decodeTapePermalink(fromServer), await decodeTapePermalinkInBrowser(fromBrowser)]) {
      expect(decoded.kind === "invalid" && decoded.reason).toBe("tape-group-route-required");
    }
  });

  test("legacy V2 bytes and decoding remain unchanged", async () => {
    const tape = owner("sr-09");
    // Captured V2 payload order, independent of the new envelope writer.
    const oldPayload = '{"tapeVersion":2,"experimentId":"sr-09","mode":"sr-09:default","modelIdentity":{"modelId":"sr-09-host","modelVersion":1},"constantSetId":"modern-si-2019","seed":"18446744073709551615","streamVersion":"deterministic","allocationId":"deterministic","initialConditions":{"beta":0.6},"events":[],"acceptedCheckpoint":{"acceptedActionIndex":0,"acceptedInputRevision":0,"digest":"host:0123456789abcdef"}}';
    const legacy = bytesToBase64Url(deflateRawSync(new TextEncoder().encode(oldPayload)));
    expect(encodeTapePermalink(tape)).toBe(legacy);
    expect(await encodeTapePermalinkInBrowser(tape)).toBe(legacy);
    for (const decoded of [
      decodeTapePermalink(legacy),
      decodeTapeDocument(legacy),
      await decodeTapePermalinkInBrowser(legacy),
      await decodeTapeDocumentInBrowser(legacy),
    ]) expect(decoded).toEqual({ kind: "success", tape });
  });

  test("prediction exclusion applies to every member without changing checkpoints", () => {
    const tape = group();
    const withPredictions = {
      ...tape,
      members: tape.members.map((member) => ({
        ...member,
        tape: {
          ...member.tape,
          predictions: [{ promptId: member.memberId, form: "candidate" as const, payload: { candidateId: "same-factor" } }],
        },
      })),
    };
    const shared = decodeTapeDocument(encodeTapePermalink(withPredictions));
    const privateLink = decodeTapeDocument(encodeTapePermalink(withPredictions, { includePredictions: false }));
    assert(shared.kind === "success" && shared.tape.tapeVersion === 3);
    assert(privateLink.kind === "success" && privateLink.tape.tapeVersion === 3);
    expect(shared.tape.members.every((member) => member.tape.predictions?.length === 1)).toBe(true);
    expect(privateLink.tape.members.every((member) => member.tape.predictions === undefined)).toBe(true);
    expect(privateLink.tape.members.map((member) => member.tape.acceptedCheckpoint)).toEqual(
      tape.members.map((member) => member.tape.acceptedCheckpoint),
    );
  });

  test("tape-group-invalid rejects malformed relations, duplicate slots and nested groups (groupSchema.ts:16)", () => {
    const tape = group();
    const first = tape.members[0];
    assert(first);
    const invalid: unknown[] = [
      null,
      { ...tape, tapeVersion: 4 },
      { ...tape, extra: true },
      { ...tape, group: { ...tape.group, definitionVersion: 2 } },
      { ...tape, group: { ...tape.group, commitPolicy: "partial" } },
      { ...tape, group: { ...tape.group, commandClass: "presentation-change" } },
      { ...tape, group: { ...tape.group, quantityId: "" } },
      { ...tape, group: { ...tape.group, enabled: false } },
      { ...tape, group: { ...tape.group, valueSI: Number.NaN } },
      { ...tape, members: [first] },
      { ...tape, members: [first, first] },
      { ...tape, members: Array.from({ length: 9 }, (_, index) => ({ ...first, memberId: `member-${index}` })) },
      { ...tape, members: [{ ...first, memberId: "Unstable slot" }, tape.members[1]] },
    ];
    for (const raw of invalid) {
      try {
        validateTapeGroupV3(raw);
        assert.fail("The invalid group must be refused.");
      } catch (error) {
        assert(error instanceof TapeValidationError);
        expect(error.code).toBe("tape-group-invalid");
      }
    }
    expect(() => validateTapeGroupV3({ ...tape, members: [{ ...first, tape }, tape.members[1]] })).toThrow(TapeValidationError);
  });

  test("tape-group-invalid enforces the existing aggregate event budget (groupSchema.ts:16)", () => {
    const tape = group();
    const overloaded = {
      ...tape,
      members: tape.members.map((member) => ({
        ...member,
        tape: {
          ...member.tape,
          events: Array.from({ length: 129 }, (_, index) => ({
            actionIndex: index,
            commandClass: "observer-change" as const,
            paramId: "beta",
            value: 0.6,
          })),
          acceptedCheckpoint: { ...member.tape.acceptedCheckpoint, acceptedActionIndex: 128 },
        },
      })),
    };
    expect(() => validateTapeGroupV3(overloaded)).toThrow("aggregate event");
  });

  test("tape-oversize refuses group payloads beyond the decompressed budget (codecCore.ts:136)", () => {
    const tape = group();
    const tooLarge = {
      ...tape,
      members: tape.members.map((member) => ({
        ...member,
        tape: {
          ...member.tape,
          initialConditions: { ...member.tape.initialConditions, padding: "x".repeat(MAX_DECOMPRESSED_TAPE_BYTES) },
        },
      })),
    };
    expect(() => tapePayloadBytes(tooLarge)).toThrow("maximum decompressed tape size");
  });

  test("tape-oversize refuses unshareable encoded groups before copy (codecCore.ts:372)", async () => {
    let state = 19;
    const noise = Array.from({ length: 6000 }, () => {
      state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
      return String.fromCharCode(33 + (state % 90));
    }).join("");
    const tape = group();
    const oversized = {
      ...tape,
      members: tape.members.map((member) => ({
        ...member,
        tape: { ...member.tape, initialConditions: { ...member.tape.initialConditions, noise } },
      })),
    };
    expect(() => encodeTapePermalink(oversized)).toThrow("maximum encoded tape size");
    await expect(encodeTapePermalinkInBrowser(oversized)).rejects.toThrow("maximum encoded tape size");
  });

  test("unlinked groups retain independent member values and require no shared value", () => {
    const tape = group();
    const independent = {
      ...tape,
      group: { ...tape.group, enabled: false, valueSI: null },
      members: tape.members.map((member, index) => ({
        ...member,
        tape: { ...member.tape, initialConditions: { beta: index === 0 ? -0.6 : 0.2 } },
      })),
    };
    const decoded = decodeTapeDocument(encodeTapePermalink(independent));
    expect(decoded).toEqual({ kind: "success", tape: independent });
  });
});
