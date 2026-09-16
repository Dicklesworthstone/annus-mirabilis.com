import { describe, expect, test } from "bun:test";
import { spawnSync } from "node:child_process";
import { scenarioKindLabel } from "./scenario-registry/labels.ts";

describe("run-scenarios CLI", () => {
  test("exits 0 on the passing registry and counts not-available separately", () => {
    const result = spawnSync("bun", ["scripts/run-scenarios.ts"], { encoding: "utf8" });
    expect(result.status).toBe(0);
    const payload = JSON.parse(result.stdout);
    expect(payload.failed).toBe(0);
    expect(payload.notAvailable).toBeGreaterThan(0);
    expect(payload.passed).toBeGreaterThan(0);
  });

  test("kind labels distinguish historical fixtures, golden scenarios, identities, and measurements", () => {
    expect(
      scenarioKindLabel("historical-fixture", "scenario-einstein-1905-brownian-printed"),
    ).toContain("Historical fixture");
    expect(scenarioKindLabel("modern-golden", "modern-si-2019")).toContain("modern constants");
    expect(scenarioKindLabel("identity", "modern-si-2019")).toContain("Identity");
    expect(scenarioKindLabel("historical-measurement", "n/a")).toContain("Historical measurement");
    expect(
      scenarioKindLabel("historical-fixture", "modern-si-2019", { correctedMisprint: true }),
    ).toContain("corrected reading");
  });
});
