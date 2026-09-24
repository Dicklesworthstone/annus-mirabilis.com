import { describe, expect, test } from "bun:test";
import { readdirSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { strictParse } from "../content/schemas/strictParse.ts";

/**
 * Every predict prompt in a laboratory manifest names the candidate its model supports
 * (am-inst-predict-mode-ti7m). PredictPanel reveals the chosen candidate's separating assumption
 * against it; without it, each adoption copied the prompt into TypeScript by hand, as ME-02 did.
 *
 * The schema makes the field optional and checks that it names one of the prompt's own candidates;
 * this makes it required for every manifest the site ships. It reads the prompts directly rather
 * than through validateExperiment, which does not accept every shipped manifest.
 */
const dir = resolve(dirname(fileURLToPath(import.meta.url)), "../../content/experiments");

describe("predict prompts name their supported candidate", () => {
  const prompts: [string, string, string | undefined, string[]][] = [];
  for (const file of readdirSync(dir)
    .filter((f) => f.endsWith(".yaml"))
    .sort()) {
    const manifest = strictParse(readFileSync(resolve(dir, file), "utf8"), "yaml") as {
      predictMode?: {
        prompts?: {
          promptId: string;
          supportedCandidateId?: string;
          candidates: { id: string }[];
        }[];
      };
    };
    for (const p of manifest.predictMode?.prompts ?? [])
      prompts.push([file, p.promptId, p.supportedCandidateId, p.candidates.map((c) => c.id)]);
  }

  test("the manifests carry prompts (a floor, not a census)", () => {
    expect(prompts.length).toBeGreaterThan(30);
  });

  test("every prompt names one of its own candidates as supported", () => {
    const missing = prompts
      .filter(([, , supported, ids]) => !supported || !ids.includes(supported))
      .map(([file, id]) => `${file}: ${id}`);
    expect(missing).toEqual([]);
  });
});
