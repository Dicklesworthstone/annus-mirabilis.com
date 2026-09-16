import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { type Scenario, validateScenario } from "../../content/schemas/experiment.ts";
import { strictParse } from "../../content/schemas/strictParse.ts";
import { getOwner } from "./owners.ts";

export type LoadedScenario = Readonly<{
  scenario: Scenario;
  path: string;
  raw: Record<string, unknown>;
}>;

function walkYaml(dir: string, acc: string[] = []): string[] {
  if (!existsSync(dir)) return acc;
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const next = join(dir, entry.name);
    if (entry.isDirectory()) walkYaml(next, acc);
    else if (entry.name.endsWith(".yaml") || entry.name.endsWith(".yml")) acc.push(next);
  }
  return acc;
}

export function defaultScenarioDirs(root = process.cwd()): string[] {
  return [join(root, "content/scenarios"), join(root, "src/testing/scenario-fixtures/passing")];
}

export function loadScenarioFile(path: string): LoadedScenario {
  const raw = strictParse(readFileSync(path, "utf8"), "yaml") as Record<string, unknown>;
  const scenario = validateScenario(raw, path);
  if (scenario.kind === "identity") {
    return { scenario, path, raw };
  }
  if (scenario.kind === "discrimination") {
    for (const hyp of scenario.hypotheses ?? []) getOwner(hyp.owner);
    return { scenario, path, raw };
  }
  if (!scenario.owner) {
    throw new Error(`${path}: scenario owner is required.`);
  }
  getOwner(scenario.owner);
  return { scenario, path, raw };
}

export function loadScenarios(dirs: readonly string[]): LoadedScenario[] {
  const files = dirs.flatMap((dir) => walkYaml(dir));
  return files.map(loadScenarioFile);
}
