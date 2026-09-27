/**
 * A REFUSAL IS A RESULT, AND THE RUNNER COMPARES IT (am-nxbq, dispatch 304).
 *
 * `expected.status` has been in the scenario schema from the start and nothing read it: the runner
 * compared `expected.outputs` alone, and an owner could return numbers or throw and had no way to
 * say it refused. So a scenario could declare a refusal and pass without one ever happening, which
 * is the defect am-nxbq is about wearing its worst costume, because the case would then read as
 * covered. All four branches of the comparison are planted here.
 *
 * The plants are made by editing a loaded scenario in memory, never the file, because several
 * agents edit this checkout at once.
 */
import { describe, expect, test } from "bun:test";
import type { Scenario } from "../content/schemas/experiment.ts";
import { loadScenarioFile } from "./scenario-registry/load.ts";
import { runScenariosIsolated } from "./scenario-registry/run.ts";

const PATH = "content/scenarios/bm-02-nonpositive-inputs-refused.yaml";

/** The scenario as written, with one field of it replaced. */
function withScenario(change: (s: Scenario) => Scenario) {
  const item = loadScenarioFile(PATH);
  const planted = { ...item, scenario: change(item.scenario) };
  return runScenariosIsolated([planted]).results[0];
}

describe("a scenario that expects a refusal", () => {
  test("passes when the owner refuses with exactly that status and reason", () => {
    const result = runScenariosIsolated([loadScenarioFile(PATH)]).results[0];
    expect(result?.status).toBe("passed");
    // The message names what was refused, so a reader of the log knows which output it was.
    expect(result?.message).toContain("outside-domain");
    expect(result?.message).toContain("osmoticPressure");
  });

  test("fails when the owner refuses for a different reason than the one declared", () => {
    const result = withScenario((s) => ({
      ...s,
      expected: {
        ...s.expected,
        status: { outputId: "osmoticPressure", status: "outside-domain", reasonCode: "a > 0" },
      },
    }));
    expect(result?.status).toBe("failed");
    // Both sides are named, so the author can see which one is wrong.
    expect(result?.message).toContain("a > 0");
    expect(result?.message).toContain("n >= 0 and T > 0");
  });

  test("fails when the owner refuses and the scenario expects numbers", () => {
    const result = withScenario((s) => ({ ...s, expected: { outputs: [] } }));
    expect(result?.status).toBe("failed");
    expect(result?.message).toContain("expects numbers");
  });

  test("fails when the scenario expects a refusal and the owner returns numbers", () => {
    // The same scenario at an admissible temperature: the model has an answer, so the declared
    // refusal never arrives. Without this branch a stale refusal expectation would pass the day the
    // model stopped refusing.
    const result = withScenario((s) => ({
      ...s,
      inputs: { ...s.inputs, temperature: { value: 293.15, unit: "K" } },
    }));
    expect(result?.status).toBe("failed");
    expect(result?.message).toContain("returned numbers");
  });

  test("fails when the refusal arrives on an output the scenario did not name", () => {
    const result = withScenario((s) => ({
      ...s,
      expected: {
        ...s.expected,
        status: {
          outputId: "someOtherOutput",
          status: "outside-domain",
          reasonCode: "n >= 0 and T > 0",
        },
      },
    }));
    expect(result?.status).toBe("failed");
    expect(result?.message).toContain("someOtherOutput");
  });
});
