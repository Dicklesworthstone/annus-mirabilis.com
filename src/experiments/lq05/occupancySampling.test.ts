import { expect, test } from "bun:test";
import {
  sampleIndependentPoints,
  sampleLockedPoints,
} from "../../physics/reference/radiation/configurations.ts";

test("all occupancy bins use the existing seeded placements and allocation", () => {
  const input = { n: 4, f: 0.5, trials: 32, seed: "12345" };
  for (const [sample, expected, allocation, draws] of [
    [sampleIndependentPoints, [0, 8, 14, 9, 1], "lq-05.configuration.v1", 128],
    [sampleLockedPoints, [18, 0, 0, 0, 14], "lq-05.locked.v1", 32],
  ] as const) {
    const result = sample(input);
    expect(result.occupancyCounts).toEqual(expected);
    expect(result.occupancyCounts.reduce((a, b) => a + b, 0)).toBe(input.trials);
    expect(result).toMatchObject({
      ...input,
      successCount: expected[4],
      sampleFraction: expected[4] / 32,
      drawCountBefore: 0,
      drawCountAfter: draws,
      allocationId: allocation,
      streamKernelId: 0x19050005,
    });
    expect(sample(input)).toEqual(result);
    expect(Object.isFrozen(result.occupancyCounts)).toBe(true);
    const max = sample({ ...input, n: 60, f: 1, allocationId: "custom.v1", streamKernelId: 42 });
    expect(max).toMatchObject({ allocationId: "custom.v1", streamKernelId: 42 });
    expect(max.occupancyCounts).toEqual([...Array(60).fill(0), 32]);
    for (const n of [0, 2.5, 61, 1e10])
      expect(() => sample({ ...input, n })).toThrow("Use 1 to 60 points");
  }
});
