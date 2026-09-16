import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { parsePredictPromptId } from "../content/ids.ts";
import { validateExperiment } from "../content/schemas/experiment.ts";
import { strictParse } from "../content/schemas/strictParse.ts";
import { catalogueStatus, isCatalogueId } from "../experiments/catalogue.ts";
import { assertOwnerBinding } from "../experiments/owners.ts";
import { SR09_QUESTION } from "../experiments/sr09/definition.ts";
import { validateControlTape } from "../experiments/tapes/schema.ts";

const root = process.cwd();

describe("SR-09 manifest and metadata contract", () => {
  test("manifest validates and declares predict prompts, presets, and embeddable", () => {
    const raw = strictParse(
      readFileSync(join(root, "content/experiments/sr-09.yaml"), "utf8"),
      "yaml",
    );
    const manifest = validateExperiment(raw);
    expect(manifest.id).toBe("sr-09");
    expect(manifest.explanatoryQuestion).toBe(SR09_QUESTION);
    expect(manifest.embeddable).toBe(true);
    expect(manifest.notModeled.length).toBeGreaterThan(0);

    const ids =
      "enabled" in manifest.predictMode && manifest.predictMode.enabled
        ? manifest.predictMode.prompts.map((p) => p.promptId)
        : [];
    expect(ids).toContain("sr-09-predict-receding");
    expect(ids).toContain("sr-09-predict-approaching");
    for (const id of ids) {
      expect(parsePredictPromptId(id).ok).toBe(true);
    }
  });

  test("control tape doppler-aberration validates", () => {
    const raw = strictParse(
      readFileSync(join(root, "content/experiments/tapes/doppler-aberration.yaml"), "utf8"),
      "yaml",
    );
    const tape = validateControlTape(raw);
    expect(tape.tapeId).toBe("doppler-aberration");
    expect(tape.experimentId).toBe("sr-09");
  });

  test("catalogue and owner binding are registered", () => {
    expect(isCatalogueId("sr-09")).toBe(true);
    expect(catalogueStatus("sr-09")).toBe("registered");
    const binding = assertOwnerBinding("sr-09", "registered");
    expect(binding).not.toBeNull();
    expect(binding?.kind).toBe("reference-evaluator");
  });
});
