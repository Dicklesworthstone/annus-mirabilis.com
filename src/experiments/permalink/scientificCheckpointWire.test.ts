import { afterAll, expect, test } from "bun:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { loadWalkthroughCatalogue } from "../../content/walkthroughs.ts";
import { TestLogger } from "../../testing/log/logger.ts";
import { encodeFields, scientificDigest } from "../digest/scientificDigest.ts";
import { parseU64 } from "../identity/u64.ts";
import { decodeTapePermalink, encodeTapePermalink, MAX_PERMALINK_URL_LENGTH } from "./codec.ts";
import { tapePayloadBytes } from "./codecCore.ts";
import { TapeValidationError, validateTapeV2 } from "./schema.ts";
import type { TapeV2 } from "./types.ts";

const logger = new TestLogger("scientific-checkpoint-wire");
afterAll(() => logger.flush());
const passed = (testId: string) => logger.log({ testId, instrumentId: "bm-01", outcome: "passed" });
const tape = loadWalkthroughCatalogue().walkthroughs.find(
  (walkthrough) => walkthrough.tapeId === "einstein-0-8-micron",
)?.checkpoints[1]?.tape;
assert.ok(tape);
const payload = JSON.parse(new TextDecoder().decode(tapePayloadBytes(tape))) as {
  acceptedCheckpoint: { scientificState: Record<string, unknown> };
};
const compact = payload.acceptedCheckpoint.scientificState;
function withState(scientificState: unknown): unknown {
  return { ...tape, acceptedCheckpoint: { ...tape?.acceptedCheckpoint, scientificState } };
}
const range = {
  allocationId: "bm-01.latent.v1",
  streamKernelId: "0x19050001",
  firstTile: "0",
  count: 300,
  index: "6000",
};

test("all 300 named stream positions roundtrip through a small scientific tape URL without widening budgets", () => {
  expect(compact.streamPositions).toBeUndefined();
  expect(compact.streamPositionRanges).toEqual([range]);
  expect(tapePayloadBytes(tape).length).toBeLessThan(4096);
  const href = `/lab/bm-01/?tape=${encodeTapePermalink(tape)}`;
  expect(href.length).toBeLessThan(MAX_PERMALINK_URL_LENGTH);
  expect(decodeTapePermalink(href)).toEqual({ kind: "success", tape });
  expect(validateTapeV2(withState(compact)).acceptedCheckpoint.scientificState).toEqual(
    tape.acceptedCheckpoint.scientificState,
  );
  passed("compact-exact-owner-stream-positions");
});

test("range expansion preserves tile, draw index and seed integers above 2^53 and at unsigned 64-bit maximum", () => {
  const state = {
    ...compact,
    seed: "18446744073709551615",
    streamPositionRanges: [
      { ...range, firstTile: "9007199254740993", count: 3, index: "18446744073709551615" },
    ],
  };
  const checked = validateTapeV2(withState(state)).acceptedCheckpoint.scientificState;
  expect(checked?.seed).toBe("18446744073709551615");
  expect(checked?.streamPositions.map((position) => position.tile)).toEqual([
    "9007199254740993",
    "9007199254740994",
    "9007199254740995",
  ]);
  expect(
    checked?.streamPositions.every((position) => position.index === "18446744073709551615"),
  ).toBe(true);
  const last = validateTapeV2(
    withState({
      ...compact,
      streamPositionRanges: [{ ...range, firstTile: "18446744073709551615", count: 1 }],
    }),
  );
  expect(last.acceptedCheckpoint.scientificState?.streamPositions[0]?.tile).toBe(
    "18446744073709551615",
  );
  passed("range-exact-u64-identities");
});

test("tape-invalid-scientific-checkpoint: malformed, ambiguous, duplicate or oversized metadata is refused (schema.ts:484)", () => {
  const { seed: _seed, ...missingSeed } = compact;
  const invalid: unknown[] = [
    null,
    1,
    [],
    missingSeed,
    { ...compact, surprise: true },
    { ...compact, streamPositions: [] },
    ...[0, -1, 1.5, Number.MAX_SAFE_INTEGER + 1].map((checkpointVersion) => ({
      ...compact,
      checkpointVersion,
    })),
    { ...compact, streamSemanticsVersion: 0 },
    { ...compact, stepIndex: -1 },
    ...[-1, Infinity, NaN, "60"].map((simulatedTime) => ({ ...compact, simulatedTime })),
    { ...compact, streamPositionRanges: {} },
    ...[
      null,
      "position",
      { ...range, unknown: 1 },
      { ...range, allocationId: "" },
      { ...range, streamKernelId: "k".repeat(257) },
    ].map((position) => ({ ...compact, streamPositionRanges: [position] })),
    ...[0, -1, 0.5, "300", 30_001, Number.MAX_SAFE_INTEGER, Infinity].map((count) => ({
      ...compact,
      streamPositionRanges: [{ ...range, count }],
    })),
    {
      ...compact,
      streamPositionRanges: [{ ...range, firstTile: "18446744073709551615", count: 2 }],
    },
    {
      ...compact,
      streamPositionRanges: [
        { ...range, count: 20_000 },
        { ...range, firstTile: "20000", count: 20_000 },
      ],
    },
    { ...compact, streamPositionRanges: [range, { ...range, firstTile: "200", count: 2 }] },
    { ...compact, streamPositionRanges: new Array(30_001).fill({ ...range, count: 1 }) },
  ];
  for (const state of invalid)
    assert.throws(
      () => validateTapeV2(withState(state)),
      (error) =>
        error instanceof TapeValidationError && error.code === "tape-invalid-scientific-checkpoint",
    );
  const full = tape.acceptedCheckpoint.scientificState;
  assert.ok(full);
  assert.throws(
    () =>
      validateTapeV2(
        withState({ ...full, streamPositions: [full.streamPositions[0], full.streamPositions[0]] }),
      ),
    (error) =>
      error instanceof TapeValidationError && error.code === "tape-invalid-scientific-checkpoint",
  );
  expect(
    validateTapeV2(withState(compact)).acceptedCheckpoint.scientificState?.streamPositions,
  ).toHaveLength(300);
  passed("bounded-scientific-wire-refusal");
});

test("range identities reject numeric, rounded, noncanonical and overflowing unsigned strings", () => {
  for (const value of [
    Number("9007199254740993"),
    -1,
    "01",
    "+1",
    "1e3",
    "0x10",
    "18446744073709551616",
  ])
    for (const field of ["firstTile", "index"])
      expect(() =>
        validateTapeV2(
          withState({ ...compact, streamPositionRanges: [{ ...range, [field]: value }] }),
        ),
      ).toThrow();
  for (const seed of [Number("9007199254740993"), "01", "18446744073709551616"])
    expect(() => validateTapeV2(withState({ ...compact, seed }))).toThrow();
  passed("noncanonical-range-seeds-and-counters");
});

test("sparse stream identities keep their exact named layout when ranges would increase wire size", () => {
  const scientificState = tape.acceptedCheckpoint.scientificState;
  assert.ok(scientificState);
  const first = scientificState.streamPositions[0];
  const second = scientificState.streamPositions[1];
  assert.ok(first && second);
  const sparse: TapeV2 = {
    ...tape,
    acceptedCheckpoint: {
      ...tape.acceptedCheckpoint,
      scientificState: {
        ...scientificState,
        streamPositions: [
          { ...first, tile: parseU64("1") },
          { ...second, tile: parseU64("9223372036854775808") },
        ],
      },
    },
  };
  expect(decodeTapePermalink(encodeTapePermalink(sparse))).toEqual({
    kind: "success",
    tape: sparse,
  });
  passed("sparse-range-layout-no-coercion");
});

test("allocation-linear array hashing preserves the existing canonical little-endian bytes", async () => {
  const fields = { samples: new Float64Array([1, -0, 2.5]) };
  const expected = Buffer.from(
    "010000000700000073616d706c65730401010000000300000018000000000000000000f03f00000000000000800000000000000440",
    "hex",
  );
  expect(Buffer.from(encodeFields(fields))).toEqual(expected);
  expect((await scientificDigest(fields)).digest).toBe(
    `host:sha256:${createHash("sha256").update(expected).digest("hex")}`,
  );
  const integers = { samples: new Uint32Array([1, 0xffffffff]) };
  const expectedIntegers = Buffer.from(
    "010000000700000073616d706c6573050201000000020000000800000001000000ffffffff",
    "hex",
  );
  expect(Buffer.from(encodeFields(integers))).toEqual(expectedIntegers);
  passed("array-canonical-bytes-unchanged");
});
