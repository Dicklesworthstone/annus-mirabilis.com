import { describe, expect, test } from "bun:test";
import { readdirSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { strictParse } from "../src/content/schemas/strictParse.ts";
import { predictPromptsFrom, predictPromptsModule } from "./generate-predict-prompts.mjs";

/**
 * The predict prompts a laboratory draws are the ones its manifest writes (am-inst-predict-mode-ti7m).
 * Runs the generator's pure half on the real manifests and on one altered in memory; nothing is
 * written.
 */
const dir = resolve(dirname(fileURLToPath(import.meta.url)), "../content/experiments");
const files = readdirSync(dir)
  .filter((f) => f.endsWith(".yaml"))
  .sort()
  .map((file) => ({ file, text: readFileSync(resolve(dir, file), "utf8") }));

type ManifestPrompt = {
  promptId: string;
  question: string;
  supportedCandidateId?: string;
  candidates: { id: string }[];
};
type Manifest = {
  id: string;
  predictMode: { exempt?: true; reason?: string; prompts?: ManifestPrompt[] };
};

type Generated = {
  promptId: string;
  question: string;
  supportedCandidateId: string;
  candidates: { id: string }[];
};

describe("generate-predict-prompts reads every manifest's prompts", () => {
  // The generator is plain JavaScript, so its tables are typed here.
  const { prompts, exempt } = predictPromptsFrom(files) as {
    prompts: Record<string, Generated[]>;
    exempt: Record<string, string>;
  };

  test("every manifest lands in exactly one table, counted from the directory", () => {
    const prompted = Object.keys(prompts);
    const exempted = Object.keys(exempt);
    const total = prompted.reduce((n, id) => n + (prompts[id]?.length ?? 0), 0);
    console.log(
      `[predict prompts] ${total} prompts on ${prompted.length} labs, ${exempted.length} exempt, of ${files.length} manifests`,
    );
    expect(files.length).toBeGreaterThan(0);
    expect(prompted.length).toBeGreaterThan(0);
    expect(prompted.filter((id) => exempted.includes(id))).toEqual([]);
    const ids = files.map(({ text }) => (strictParse(text, "yaml") as Manifest).id).sort();
    expect([...prompted, ...exempted].sort()).toEqual(ids);
  });

  test("each lab's prompts are its manifest's, in order, each naming a candidate it offers", () => {
    for (const { file, text } of files) {
      const manifest = strictParse(text, "yaml") as Manifest;
      if (manifest.predictMode.exempt) {
        expect(exempt[manifest.id]).toBe(manifest.predictMode.reason ?? "");
        continue;
      }
      const generated = prompts[manifest.id] ?? [];
      const written = manifest.predictMode.prompts ?? [];
      expect(generated.map((p) => p.promptId)).toEqual(written.map((p) => p.promptId));
      for (const [i, p] of generated.entries()) {
        const source = written[i];
        expect(p.question, file).toBe(source?.question ?? "");
        expect(p.candidates.map((c) => c.id)).toEqual(source?.candidates.map((c) => c.id) ?? []);
        expect(p.supportedCandidateId).toBe(source?.supportedCandidateId ?? "");
        expect(p.candidates.map((c) => c.id)).toContain(p.supportedCandidateId);
      }
    }
  });

  test("a prompt with no supported candidate stops the run, naming its manifest and prompt", () => {
    const target = files.find((f) => f.file === "sr-10.yaml");
    expect(target).toBeDefined();
    if (!target) return;
    const altered = target.text.replace(/^\s*supportedCandidateId:.*\n/m, "");
    // The plant landed: one fewer supportedCandidateId than the real manifest has.
    expect(altered.split("supportedCandidateId").length).toBe(
      target.text.split("supportedCandidateId").length - 1,
    );
    expect(() => predictPromptsFrom([{ file: "sr-10.yaml", text: altered }])).toThrow(
      /content\/experiments\/sr-10\.yaml: predict prompt "sr-10-predict-volume" names no supportedCandidateId/,
    );
  });

  test("the module carries both tables exactly as computed", () => {
    const text = predictPromptsModule({ prompts, exempt });
    expect(text).toContain(`export const PREDICT_PROMPTS`);
    expect(text).toContain(JSON.stringify(prompts, null, 2));
    expect(text).toContain(JSON.stringify(exempt, null, 2));
  });
});
