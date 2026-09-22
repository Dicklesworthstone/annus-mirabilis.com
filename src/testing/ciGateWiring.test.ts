import { describe, expect, test } from "bun:test";
import { readdirSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { QUALITY_GATE_STEPS } from "../../scripts/quality-gates/registry.ts";

/**
 * A gate that declares itself required must be RUN by a job (am-browser-gate-identity-7nq2).
 *
 * The defect this exists for: browser-acceptance read `requiredInCi: true` from the day it was
 * written, and no workflow ever executed it. Its family was "browser" and no job passed
 * --family browser; the workflow that carried its name ran a different command over 20 files
 * the node lane already runs. The flag was never wrong. The wiring was missing, and nothing
 * compared the two.
 *
 * SO THIS TEST MUST NOT ASSERT THE DECLARATION. A test that read requiredInCi and checked it was
 * true would have passed every day of that period, which is the tautology the bead exists
 * because of. The flag is used only to SELECT the population; the evidence is the workflow text
 * on disk. Nothing in scripts/quality-gates/ can satisfy this test on its own.
 */

const ROOT = dirname(dirname(dirname(fileURLToPath(import.meta.url))));
const WORKFLOWS = join(ROOT, ".github/workflows");

type Step = Readonly<{ file: string; line: string }>;

function workflowRunSteps(): readonly Step[] {
  const steps: Step[] = [];
  for (const name of readdirSync(WORKFLOWS).filter((n) => n.endsWith(".yml"))) {
    for (const raw of readFileSync(join(WORKFLOWS, name), "utf8").split("\n")) {
      const match = /^\s*run:\s*(.+)$/.exec(raw);
      if (match?.[1]) steps.push({ file: name, line: match[1].trim() });
    }
  }
  return steps;
}

/** Families the gate chain is invoked for, and whether any invocation omits the filter. */
function chainCoverage(steps: readonly Step[]): {
  families: ReadonlySet<string>;
  everyFamily: boolean;
  cadences: ReadonlySet<string>;
} {
  const families = new Set<string>();
  const cadences = new Set<string>();
  let everyFamily = false;
  for (const step of steps) {
    if (!step.line.includes("quality-gates.ts")) continue;
    const family = /--family\s+(\S+)/.exec(step.line)?.[1];
    if (family === undefined || family === "all") everyFamily = true;
    else families.add(family);
    const cadence = /--cadence\s+(\S+)/.exec(step.line)?.[1];
    cadences.add(cadence ?? "all");
  }
  return { families, everyFamily, cadences };
}

describe("a gate required in CI is run by a CI job (am-browser-gate-identity-7nq2)", () => {
  const steps = workflowRunSteps();
  const required = QUALITY_GATE_STEPS.filter((step) => step.requiredInCi);

  test("the population is real, so a pass cannot mean the test found nothing", () => {
    // Every assertion below quantifies over these three. An empty one would make the suite green
    // by computing over nothing, which is how a check that has stopped running looks from here.
    expect(readdirSync(WORKFLOWS).filter((n) => n.endsWith(".yml")).length).toBeGreaterThan(0);
    expect(steps.length, "no `run:` step parsed out of any workflow").toBeGreaterThan(0);
    expect(required.length, "no gate declares requiredInCi").toBeGreaterThan(0);
    expect(steps.some((s) => s.line.includes("quality-gates.ts"))).toBe(true);
  });

  test("every requiredInCi gate is executed by some workflow job", () => {
    const { families, everyFamily, cadences } = chainCoverage(steps);
    const unwired = required
      .filter((gate) => {
        const byChain = everyFamily || families.has(gate.family);
        // A cadence filter can exclude a gate the family would otherwise cover, so a gate is
        // only chain-covered when some invocation would admit its cadence too.
        const cadenceOk = cadences.has("all") || cadences.has(gate.cadence);
        if (byChain && cadenceOk) return false;
        // Or a job may run the gate's own command directly, which is equally real wiring.
        const direct = steps.some((s) =>
          gate.command.slice(1).every((part) => s.line.includes(part)),
        );
        return !direct;
      })
      .map((gate) => `${gate.id} (family ${gate.family}, cadence ${gate.cadence})`);

    expect(
      unwired,
      `A gate declares requiredInCi and no workflow job runs it. Declaring a requirement is not the same as wiring one, and this is the exact defect am-browser-gate-identity-7nq2 documents: browser-acceptance read true for its whole life while nothing executed it. Either run its family in a workflow, run its command directly, or stop claiming it is required.\n${unwired.join("\n")}`,
    ).toEqual([]);
  });

  test("the browser gate specifically, by name, because it is the one that was unwired", () => {
    // Named as well as counted. A refactor that dropped --family browser would otherwise only
    // shrink a list, and the failure would not say which capability had gone quiet.
    const browser = required.find((gate) => gate.family === "browser");
    expect(browser, "no requiredInCi gate in the browser family").toBeDefined();
    const runsBrowserFamily = steps.some(
      (s) => s.line.includes("quality-gates.ts") && /--family\s+(browser|all)/.test(s.line),
    );
    expect(
      runsBrowserFamily,
      "no workflow runs the browser gate family. The nine live-class runtime-conformance assertions would then be carried only by live.test.ts in the node lane, which is the accidental route this decision replaced.",
    ).toBe(true);
  });
});
