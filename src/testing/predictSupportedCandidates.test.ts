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

const CORE_LABS = [
  "bm-01",
  "bm-02",
  "bm-03",
  "bm-04",
  "bm-05",
  "bm-06",
  "bm-07",
  "bm-08",
  "lq-01",
  "lq-02",
  "lq-03",
  "lq-04",
  "lq-05",
  "lq-06",
  "lq-07",
  "lq-08",
  "lq-09",
  "me-01",
  "me-02",
  "me-03",
  "sr-01",
  "sr-02",
  "sr-03",
  "sr-04",
  "sr-05",
  "sr-06",
  "sr-07",
  "sr-08",
  "sr-09",
  "sr-10",
  "sr-11",
  "sr-12",
  "sr-13",
];

describe("predict prompts name their supported candidate", () => {
  const prompts: [string, string, string | undefined, string[]][] = [];
  const coreCoverage: [string, boolean, number][] = [];
  for (const file of readdirSync(dir)
    .filter((f) => f.endsWith(".yaml"))
    .sort()) {
    const manifest = strictParse(readFileSync(resolve(dir, file), "utf8"), "yaml") as {
      predictMode?: {
        enabled?: boolean;
        exempt?: boolean;
        prompts?: {
          promptId: string;
          supportedCandidateId?: string;
          candidates: { id: string }[];
        }[];
      };
    };
    if (/^(bm|lq|me|sr)-\d\d\.yaml$/.test(file)) {
      coreCoverage.push([
        file.slice(0, -5),
        manifest.predictMode?.enabled === true && manifest.predictMode.exempt !== true,
        manifest.predictMode?.prompts?.length ?? 0,
      ]);
    }
    for (const p of manifest.predictMode?.prompts ?? [])
      prompts.push([file, p.promptId, p.supportedCandidateId, p.candidates.map((c) => c.id)]);
  }

  test("all 33 core laboratories have enabled authored prompts without an exemption", () => {
    expect(coreCoverage.map(([id]) => id)).toEqual(CORE_LABS);
    expect(coreCoverage.filter(([, enabled, count]) => !enabled || count === 0)).toEqual([]);
  });

  test("every prompt names one of its own candidates as supported", () => {
    const missing = prompts
      .filter(([, , supported, ids]) => !supported || !ids.includes(supported))
      .map(([file, id]) => `${file}: ${id}`);
    expect(missing).toEqual([]);
  });
});
