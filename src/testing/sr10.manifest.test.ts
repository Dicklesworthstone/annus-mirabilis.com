import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { parsePredictPromptId } from "../content/ids.ts";
import { validateExperiment } from "../content/schemas/experiment.ts";
import { strictParse } from "../content/schemas/strictParse.ts";
import { catalogueStatus, isCatalogueId } from "../experiments/catalogue.ts";
import { assertOwnerBinding } from "../experiments/owners.ts";
import { SR10_QUESTION } from "../experiments/sr10/definition.ts";
import { validateControlTape } from "../experiments/tapes/schema.ts";

const root = process.cwd();

describe("SR-10 manifest and metadata contract", () => {
  test("manifest validates and declares predict prompts, presets, and embeddable", () => {
    const raw = strictParse(
      readFileSync(join(root, "content/experiments/sr-10.yaml"), "utf8"),
      "yaml",
    );
    const manifest = validateExperiment(raw);
    expect(manifest.id).toBe("sr-10");
    expect(manifest.explanatoryQuestion).toBe(SR10_QUESTION);
    expect(manifest.embeddable).toBe(true);
    expect(manifest.notModeled.length).toBeGreaterThan(0);

    const ids =
      "enabled" in manifest.predictMode && manifest.predictMode.enabled
        ? manifest.predictMode.prompts.map((p) => p.promptId)
        : [];
    expect(ids).toContain("sr-10-predict-volume");
    for (const id of ids) {
      expect(parsePredictPromptId(id).ok).toBe(true);
    }
  });

  test("control tape finite-light-complex validates", () => {
    const raw = strictParse(
      readFileSync(join(root, "content/experiments/tapes/finite-light-complex.yaml"), "utf8"),
      "yaml",
    );
    const tape = validateControlTape(raw);
    expect(tape.tapeId).toBe("finite-light-complex");
    expect(tape.experimentId).toBe("sr-10");
  });

  test("catalogue and owner binding are registered", () => {
    expect(isCatalogueId("sr-10")).toBe(true);
    expect(catalogueStatus("sr-10")).toBe("registered");
    const binding = assertOwnerBinding("sr-10", "registered");
    expect(binding).not.toBeNull();
    expect(binding?.kind).toBe("reference-evaluator");
  });
});
