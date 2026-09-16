import { describe, expect, it } from "bun:test";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import {
  expectedLaterAllocations,
  streamAllocationRegistry,
} from "../../experiments/streams/allocation.ts";

describe("Expected Later Allocations: Registry and Documentation Invariants", () => {
  const allocationDocPath = resolve(process.cwd(), "docs/STREAM_ALLOCATION.md");
  const docContent = readFileSync(allocationDocPath, "utf-8");

  it("contains expected later allocations matching docs/STREAM_ALLOCATION.md", () => {
    expect(expectedLaterAllocations.length).toBeGreaterThan(0);

    for (const entry of expectedLaterAllocations) {
      // Must be mentioned in the doc
      expect(docContent).toContain(entry.beadId);
      expect(docContent).toContain(entry.modeId);

      // Must follow colon grammar <experiment>:<mode>
      expect(entry.modeId).toMatch(/^[a-z0-9-]+:[a-z0-9-]+$/);

      // Must match bead naming pattern
      expect(entry.beadId).toMatch(/^am-[a-z0-9-]+$/);

      // Must have detailed reason
      expect(entry.reason.length).toBeGreaterThan(20);
    }
  });

  it("verifies bm-01:underdamped entry is present with am-later-deep-underdamped-ide4 owner", () => {
    const underdamped = expectedLaterAllocations.find((e) => e.modeId === "bm-01:underdamped");
    expect(underdamped).toBeDefined();
    expect(underdamped?.beadId).toBe("am-later-deep-underdamped-ide4");
    expect(underdamped?.reason).toContain("Ornstein–Uhlenbeck");
  });

  it("ensures no expected later allocation modeId is currently registered as an active allocationId", () => {
    for (const entry of expectedLaterAllocations) {
      expect(streamAllocationRegistry.hasAllocation(entry.modeId)).toBe(false);
      expect(streamAllocationRegistry.hasAllocation(`${entry.modeId}.v1`)).toBe(false);
    }
  });
});
