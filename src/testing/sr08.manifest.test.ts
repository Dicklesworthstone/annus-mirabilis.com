import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { parsePredictPromptId } from "../content/ids.ts";
import { validateExperiment } from "../content/schemas/experiment.ts";
import { strictParse } from "../content/schemas/strictParse.ts";
import { catalogueStatus, isCatalogueId } from "../experiments/catalogue.ts";
import { assertOwnerBinding } from "../experiments/owners.ts";
import { SR08_QUESTION } from "../experiments/sr08/definition.ts";
import { validateControlTape } from "../experiments/tapes/schema.ts";

const root = process.cwd();

describe("SR-08 manifest and metadata contract", () => {
  test("manifest validates and declares predict prompt, presets, and embeddable", () => {
    const raw = strictParse(
      readFileSync(join(root, "content/experiments/sr-08.yaml"), "utf8"),
      "yaml",
    );
    const manifest = validateExperiment(raw);
    expect(manifest.id).toBe("sr-08");
    expect(manifest.explanatoryQuestion).toBe(SR08_QUESTION);
    expect(manifest.embeddable).toBe(true);
    expect(manifest.notModeled.length).toBeGreaterThan(0);

    const ids =
      "enabled" in manifest.predictMode && manifest.predictMode.enabled
        ? manifest.predictMode.prompts.map((p) => p.promptId)
        : [];
    expect(ids).toContain("sr-08-predict-appearing-field");
    for (const id of ids) {
      expect(parsePredictPromptId(id).ok).toBe(true);
    }
  });

  test("control tape field-frame-change validates", () => {
    const raw = strictParse(
      readFileSync(join(root, "content/experiments/tapes/field-frame-change.yaml"), "utf8"),
      "yaml",
    );
    const tape = validateControlTape(raw);
    expect(tape.tapeId).toBe("field-frame-change");
    expect(tape.experimentId).toBe("sr-08");
  });

  test("catalogue and owner binding are registered", () => {
    expect(isCatalogueId("sr-08")).toBe(true);
    expect(catalogueStatus("sr-08")).toBe("registered");
    const binding = assertOwnerBinding("sr-08", "registered");
    expect(binding).not.toBeNull();
    expect(binding?.kind).toBe("reference-evaluator");
  });
});
