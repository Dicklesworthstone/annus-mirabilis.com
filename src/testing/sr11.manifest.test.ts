import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { parsePredictPromptId } from "../content/ids.ts";
import { validateExperiment } from "../content/schemas/experiment.ts";
import { strictParse } from "../content/schemas/strictParse.ts";
import { catalogueStatus, isCatalogueId } from "../experiments/catalogue.ts";
import { assertOwnerBinding } from "../experiments/owners.ts";
import { SR11_QUESTION } from "../experiments/sr11/definition.ts";
import { validateControlTape } from "../experiments/tapes/schema.ts";

const root = process.cwd();

describe("SR-11 manifest and metadata contract", () => {
  test("manifest validates and declares predict prompt, presets, and embeddable", () => {
    const raw = strictParse(
      readFileSync(join(root, "content/experiments/sr-11.yaml"), "utf8"),
      "yaml",
    );
    const manifest = validateExperiment(raw);
    expect(manifest.id).toBe("sr-11");
    expect(manifest.explanatoryQuestion).toBe(SR11_QUESTION);
    expect(manifest.embeddable).toBe(true);
    expect(manifest.notModeled.length).toBeGreaterThan(0);

    const ids =
      "enabled" in manifest.predictMode && manifest.predictMode.enabled
        ? manifest.predictMode.prompts.map((p) => p.promptId)
        : [];
    expect(ids).toContain("sr-11-predict-receding-frequency");
    for (const id of ids) {
      expect(parsePredictPromptId(id).ok).toBe(true);
    }
  });

  test("control tape moving-mirror validates", () => {
    const raw = strictParse(
      readFileSync(join(root, "content/experiments/tapes/moving-mirror.yaml"), "utf8"),
      "yaml",
    );
    const tape = validateControlTape(raw);
    expect(tape.tapeId).toBe("moving-mirror");
    expect(tape.experimentId).toBe("sr-11");
  });

  test("catalogue and owner binding are registered", () => {
    expect(isCatalogueId("sr-11")).toBe(true);
    expect(catalogueStatus("sr-11")).toBe("registered");
    const binding = assertOwnerBinding("sr-11", "registered");
    expect(binding).not.toBeNull();
    expect(binding?.kind).toBe("reference-evaluator");
  });
});
