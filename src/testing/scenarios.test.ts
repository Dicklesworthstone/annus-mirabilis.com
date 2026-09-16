import { describe, expect, test } from "bun:test";
import { scenarioKindLabel } from "./scenario-registry/labels.ts";
import { defaultScenarioDirs, loadScenarios } from "./scenario-registry/load.ts";
import { runLoadedScenarios } from "./scenario-registry/run.ts";

describe("run-scenarios CLI", () => {
  test("exits 0 on the passing registry and counts not-available separately", () => {
    const loaded = loadScenarios(defaultScenarioDirs());
    const { results, failed, notAvailable } = runLoadedScenarios(loaded);
    const passed = results.filter((r) => r.status === "passed").length;
    expect(failed).toBe(0);
    expect(notAvailable).toBeGreaterThan(0);
    expect(passed).toBeGreaterThan(0);
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
