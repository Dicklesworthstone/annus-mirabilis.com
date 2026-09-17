import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { type GateStep, QUALITY_GATE_STEPS } from "../quality-gates/registry.ts";

const here = dirname(fileURLToPath(import.meta.url));
const ROOT = join(here, "../..");

export function validateStepRegistration(
  step: GateStep,
  expected: {
    id: string;
    family: string;
    cadence: string;
    owner: string;
  },
): void {
  if (step.id !== expected.id) {
    throw new Error(`Expected step id '${expected.id}', but got '${step.id}'`);
  }
  if (step.family !== expected.family) {
    throw new Error(`Step '${step.id}' has family '${step.family}', expected '${expected.family}'`);
  }
  if (step.cadence !== expected.cadence) {
    throw new Error(
      `Step '${step.id}' has cadence '${step.cadence}', expected '${expected.cadence}'`,
    );
  }
  if (step.owner !== expected.owner) {
    throw new Error(`Step '${step.id}' has owner '${step.owner}', expected '${expected.owner}'`);
  }
}

describe("Gate Registration Verification", () => {
  const stepsMap = new Map(QUALITY_GATE_STEPS.map((s) => [s.id, s]));

  test("registry contains perf-budgets (family perf, cadence nightly, owned by am-plat-perf-budgets-s3ww)", () => {
    const step = stepsMap.get("perf-budgets");
    expect(step).toBeDefined();
    if (!step) return;

    validateStepRegistration(step, {
      id: "perf-budgets",
      family: "perf",
      cadence: "nightly",
      owner: "am-plat-perf-budgets-s3ww",
    });
    expect(step.command).toEqual(["bun", "scripts/run-perf-budgets.ts"]);
    expect(step.availability.scriptPath).toBe("scripts/run-perf-budgets.ts");
    expect(step.requiredInProfiles).toContain("preview");
    expect(step.requiredInProfiles).toContain("launch");
  });

  test("registry contains perf-budget-change (family fast, cadence every-run, owned by am-plat-perf-budgets-s3ww)", () => {
    const step = stepsMap.get("perf-budget-change");
    expect(step).toBeDefined();
    if (!step) return;

    validateStepRegistration(step, {
      id: "perf-budget-change",
      family: "fast",
      cadence: "every-run",
      owner: "am-plat-perf-budgets-s3ww",
    });
    expect(step.command).toEqual(["bun", "scripts/perf-budget-diff.ts"]);
    expect(step.availability.scriptPath).toBe("scripts/perf-budget-diff.ts");
    expect(step.requiredInCi).toBe(true);
    expect(step.requiredInProfiles).toContain("preview");
    expect(step.requiredInProfiles).toContain("launch");
  });

  test("fixture registration with different family, cadence, or id fails naming both values", () => {
    const fixtureStep: GateStep = {
      id: "wrong-id",
      title: "Wrong step",
      command: ["bun", "scripts/wrong.ts"],
      family: "browser",
      cadence: "every-run",
      requiredInCi: false,
      requiredInProfiles: [],
      availability: { scriptPath: "scripts/wrong.ts" },
      owner: "other-bead",
    };

    expect(() =>
      validateStepRegistration(fixtureStep, {
        id: "perf-budgets",
        family: "perf",
        cadence: "nightly",
        owner: "am-plat-perf-budgets-s3ww",
      }),
    ).toThrow("Expected step id 'perf-budgets', but got 'wrong-id'");

    const fixtureWithWrongFamily: GateStep = {
      ...fixtureStep,
      id: "perf-budgets",
    };
    expect(() =>
      validateStepRegistration(fixtureWithWrongFamily, {
        id: "perf-budgets",
        family: "perf",
        cadence: "nightly",
        owner: "am-plat-perf-budgets-s3ww",
      }),
    ).toThrow("Step 'perf-budgets' has family 'browser', expected 'perf'");
  });

  test("workflow file runs perf family and contains no deploy, alias, or DNS command", () => {
    const workflowPath = join(ROOT, ".github/workflows/perf-budgets.yml");
    const content = readFileSync(workflowPath, "utf8");

    // Must run perf family
    expect(content).toContain("--family perf");

    // Must have read-only permissions
    expect(content).toContain("permissions:\n  contents: read");

    // Must NOT contain deploy, alias, or DNS commands
    expect(content.toLowerCase()).not.toContain("deploy");
    expect(content.toLowerCase()).not.toContain("alias");
    expect(content.toLowerCase()).not.toContain("cloudflare");
    expect(content.toLowerCase()).not.toContain("dns");
  });
});
