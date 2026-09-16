import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { parsePredictPromptId } from "../content/ids.ts";
import { validateExperiment } from "../content/schemas/experiment.ts";
import { strictParse } from "../content/schemas/strictParse.ts";
import { catalogueStatus, isCatalogueId } from "../experiments/catalogue.ts";
import { assertOwnerBinding } from "../experiments/owners.ts";
import { SR13_QUESTION } from "../experiments/sr13/definition.ts";
import { validateControlTape } from "../experiments/tapes/schema.ts";

const root = process.cwd();

describe("SR-13 manifest and metadata contract", () => {
  test("manifest validates and declares predict prompt, presets, and embeddable", () => {
    const raw = strictParse(
      readFileSync(join(root, "content/experiments/sr-13.yaml"), "utf8"),
      "yaml",
    );
    const manifest = validateExperiment(raw);
    expect(manifest.id).toBe("sr-13");
    expect(manifest.explanatoryQuestion).toBe(SR13_QUESTION);
    expect(manifest.embeddable).toBe(true);
    expect(manifest.notModeled.length).toBeGreaterThan(0);

    const ids =
      "enabled" in manifest.predictMode && manifest.predictMode.enabled
        ? manifest.predictMode.prompts.map((p) => p.promptId)
        : [];
    expect(ids).toContain("sr-13-predict-transverse-mass");
    for (const id of ids) {
      expect(parsePredictPromptId(id).ok).toBe(true);
    }
  });

  test("control tape electron-dynamics validates", () => {
    const raw = strictParse(
      readFileSync(join(root, "content/experiments/tapes/electron-dynamics.yaml"), "utf8"),
      "yaml",
    );
    const tape = validateControlTape(raw);
    expect(tape.tapeId).toBe("electron-dynamics");
    expect(tape.experimentId).toBe("sr-13");
  });

  test("catalogue and owner binding are registered", () => {
    expect(isCatalogueId("sr-13")).toBe(true);
    expect(catalogueStatus("sr-13")).toBe("registered");
    const binding = assertOwnerBinding("sr-13", "registered");
    expect(binding).not.toBeNull();
    expect(binding?.kind).toBe("reference-evaluator");
  });
});
