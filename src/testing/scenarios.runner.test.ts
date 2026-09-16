import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { defaultScenarioDirs, loadScenarios } from "./scenario-registry/load.ts";
import { runScenariosIsolated } from "./scenario-registry/run.ts";

describe("scenario runner", () => {
  test("executes passing fixtures of all five kinds and writes JSONL", () => {
    const loaded = loadScenarios(defaultScenarioDirs());
    const { results, logRunId, logRoot, failed } = runScenariosIsolated(loaded);
    expect(failed).toBe(0);
    const byId = Object.fromEntries(results.map((r) => [r.scenarioId, r]));
    expect(byId["self-test-golden"]?.status).toBe("passed");
    expect(byId["self-test-historical-rounds-to"]?.status).toBe("passed");
    expect(byId["self-test-historical-pending"]?.status).toBe("not-available");
    expect(byId["self-test-historical-misprint"]?.status).toBe("passed");
    expect(byId["self-test-historical-misprint"]?.extra.printedReading).toBe("8 x 10^-4 cm");
    expect(byId["self-test-identity"]?.status).toBe("passed");
    expect(byId["sr-02-emf-first-order-agreement"]?.status).toBe("passed");
    expect(byId["sr-02-emf-discriminates-at-0.6c"]?.status).toBe("passed");
    expect(byId["shelf-fizeau-fresnel-versus-relativistic"]?.status).toBe("passed");
    expect(byId["diffusion-adversarial-half-diffusivity"]?.status).toBe("passed");
    expect(byId["diffusion-adversarial-1um-radius"]?.status).toBe("passed");
    expect(byId["diffusion-einstein-1905-printed"]?.status).toBe("not-available");
    const log = readFileSync(join(logRoot, "scenarios", `${logRunId}.jsonl`), "utf8");
    expect(log.includes("self-test-golden")).toBe(true);
    expect(log.includes("not-available")).toBe(true);
  });

  test("1 um adversarial value is outside the 0.8 Mikron interval", () => {
    const loaded = loadScenarios(defaultScenarioDirs()).filter(
      (item) => item.scenario.id === "diffusion-adversarial-1um-radius",
    );
    const { results } = runScenariosIsolated(loaded);
    expect(results[0]?.status).toBe("passed");
    const actuals = results[0]?.extra.actual as { rmsDisplacement1d?: number } | undefined;
    const actual = actuals?.rmsDisplacement1d ?? Number.NaN;
    expect(actual * 1e6).toBeGreaterThan(0.55);
    expect(actual * 1e6).toBeLessThan(0.57);
  });
});
