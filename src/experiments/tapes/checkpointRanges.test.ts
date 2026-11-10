import { expect, test } from "bun:test";
import { strictParse } from "../../content/schemas/strictParse.ts";
import { decodeTapePermalink, encodeTapePermalink } from "../permalink/codec.ts";
import { permalinkTapeFromControlTape } from "../permalink/fromControlTape.ts";
import { validateControlTape } from "./schema.ts";

const range = {
  allocationId: "bm-07.synthetic-latent.v1",
  streamKernelId: "0x19050003",
  firstTile: "0",
  count: 4096,
  index: "4",
};
const checkpoint = {
  actionIndex: 0,
  stepIndex: 4096,
  simulatedTime: 4096,
  digest: `host:sha256:${"a".repeat(64)}`,
  digestKind: "host",
  checkpointVersion: 1,
  streamSemanticsVersion: 1,
  seed: "18446744073709551615",
  streamPositionRanges: [
    {
      allocationId: "bm-07.generator-parameter.v1",
      streamKernelId: "0x19050007",
      firstTile: "0",
      count: 1,
      index: "1",
    },
    range,
  ],
};
function authored(record: Record<string, unknown> = checkpoint) {
  return {
    tapeVersion: 2,
    tapeId: "range-checkpoint-fixture",
    experimentId: "bm-07",
    mode: "bm-07:default",
    modelIdentity: {
      modelId: "inference-bm07-host",
      modelVersion: "1",
      artifactDigest: `host:sha256:${"b".repeat(64)}`,
    },
    constantSetId: "scenario-bm07-hidden-number",
    seed: checkpoint.seed,
    streamVersion: 1,
    allocationId: range.allocationId,
    initialConditions: {},
    events: [],
    checkpoints: [record],
  };
}

test("authored ranges retain all 4097 streams through conversion and a bounded shared link", () => {
  const record = validateControlTape(authored());
  const positions = record.checkpoints[0]?.streamPositions;
  expect(positions).toHaveLength(4097);
  expect(positions?.[0]?.allocationId).toBe("bm-07.generator-parameter.v1");
  expect(positions?.[1]?.tile).toBe("0");
  expect(positions?.at(-1)?.tile).toBe("4095");
  const converted = permalinkTapeFromControlTape(record);
  expect(converted.kind).toBe("converted");
  if (converted.kind !== "converted") return;
  const encoded = encodeTapePermalink(converted.tape);
  expect(`/lab/bm-07/?tape=${encoded}`.length).toBeLessThanOrEqual(2048);
  expect(decodeTapePermalink(encoded)).toEqual({ kind: "success", tape: converted.tape });
});

test("the authored YAML parser preserves exact unsigned tile and seed strings", () => {
  const parsed = strictParse(
    'streamPositionRanges:\n  - allocationId: bm-07.synthetic-latent.v1\n    streamKernelId: "0x19050003"\n    firstTile: "9007199254740993"\n    count: 3\n    index: "18446744073709551615"\n',
    "yaml",
  ) as Record<string, unknown>;
  const record = validateControlTape(authored({ ...checkpoint, ...parsed }));
  expect(record.checkpoints[0]?.seed).toBe("18446744073709551615");
  expect(record.checkpoints[0]?.streamPositions.map((entry) => entry.tile)).toEqual([
    "9007199254740993",
    "9007199254740994",
    "9007199254740995",
  ]);
});

test("authored ranges refuse ambiguous, duplicate, overflowing and over-budget stream identities", () => {
  for (const invalid of [
    { ...checkpoint, streamPositions: [] },
    { ...checkpoint, streamPositionRanges: [range, range] },
    ...[0, -1, 0.5, 30_001, "4096"].map((count) => ({
      ...checkpoint,
      streamPositionRanges: [{ ...range, count }],
    })),
    {
      ...checkpoint,
      streamPositionRanges: [{ ...range, firstTile: "18446744073709551615", count: 2 }],
    },
    { ...checkpoint, streamPositionRanges: [{ ...range, firstTile: 9007199254740992 }] },
    { ...checkpoint, streamPositionRanges: [{ ...range, extra: "discard-me" }] },
  ])
    expect(() => validateControlTape(authored(invalid))).toThrow();
});
