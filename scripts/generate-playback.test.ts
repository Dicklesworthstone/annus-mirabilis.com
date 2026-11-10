import { expect, test } from "bun:test";
import { readdir, readFile } from "node:fs/promises";
import {
  ExperimentValidationError,
  validateExperiment,
} from "../src/content/schemas/experiment.ts";
import { strictParse } from "../src/content/schemas/strictParse.ts";
import { playbackDeclarations } from "./generate-playback.mjs";

test("playback declarations preserve eligibility and calibrated length from every real manifest", async () => {
  const files = await Promise.all(
    (await readdir("content/experiments"))
      .filter((name) => name.endsWith(".yaml"))
      .map(async (file) => ({ file, text: await readFile(`content/experiments/${file}`, "utf8") })),
  );
  const declarations = playbackDeclarations(files);
  expect(files.length).toBeGreaterThan(0);
  expect(declarations["bm-01"]?.natural).toBe(true);
  expect(declarations["sr-05"]?.natural).toBe(false);
  for (const file of files) {
    const manifest = validateExperiment(strictParse(file.text, "yaml"));
    expect(declarations[manifest.id]).toEqual(manifest.realRate);
  }
  console.log(`[playback manifests] examined ${files.length} declarations`);
});

test("the real manifest validator refuses a missing declaration or scale calibration", async () => {
  const text = await readFile("content/experiments/bm-01.yaml", "utf8");
  const declaration = text.match(/^realRate:\n(?: {2}.+\n)+/m)?.[0];
  expect(declaration).toBeDefined();
  for (const replacement of ["", "realRate:\n  natural: true\n  quantity: displacement1d\n"])
    expect(() =>
      playbackDeclarations([
        { file: "bm-01.yaml", text: text.replace(declaration as string, replacement) },
      ]),
    ).toThrow(ExperimentValidationError);
});
