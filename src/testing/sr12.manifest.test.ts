import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { parsePredictPromptId } from "../content/ids.ts";
import { validateExperiment } from "../content/schemas/experiment.ts";
import { strictParse } from "../content/schemas/strictParse.ts";
import { catalogueStatus, isCatalogueId } from "../experiments/catalogue.ts";
import { assertOwnerBinding } from "../experiments/owners.ts";
import { SR12_QUESTION } from "../experiments/sr12/definition.ts";
import { validateControlTape } from "../experiments/tapes/schema.ts";

const root = process.cwd();

describe("SR-12 manifest and metadata contract", () => {
  test("manifest validates and declares predict prompt, presets, and embeddable", () => {
    const raw = strictParse(
      readFileSync(join(root, "content/experiments/sr-12.yaml"), "utf8"),
      "yaml",
    );
    const manifest = validateExperiment(raw);
    expect(manifest.id).toBe("sr-12");
    expect(manifest.explanatoryQuestion).toBe(SR12_QUESTION);
    expect(manifest.embeddable).toBe(true);
    expect(manifest.notModeled.length).toBeGreaterThan(0);

    const ids =
      "enabled" in manifest.predictMode && manifest.predictMode.enabled
        ? manifest.predictMode.prompts.map((p) => p.promptId)
        : [];
    expect(ids).toContain("sr-12-predict-neutral-wire");
    for (const id of ids) {
      expect(parsePredictPromptId(id).ok).toBe(true);
    }
  });

  test("control tape charge-current validates", () => {
    const raw = strictParse(
      readFileSync(join(root, "content/experiments/tapes/charge-current.yaml"), "utf8"),
      "yaml",
    );
    const tape = validateControlTape(raw);
    expect(tape.tapeId).toBe("charge-current");
    expect(tape.experimentId).toBe("sr-12");
  });

  test("catalogue and owner binding are registered", () => {
    expect(isCatalogueId("sr-12")).toBe(true);
    expect(catalogueStatus("sr-12")).toBe("registered");
    const binding = assertOwnerBinding("sr-12", "registered");
    expect(binding).not.toBeNull();
    expect(binding?.kind).toBe("reference-evaluator");
  });

  test("readings owner file validates and has R0-R3 captions", () => {
    const raw = strictParse(
      readFileSync(
        join(root, "content/editorial/readings-owners/am-sr-12-charge-current-bgq0.yaml"),
        "utf8",
      ),
      "yaml",
    ) as {
      ownerBeadId: string;
      paper: string;
      targets: Array<{ id: string; readings: { r0: string; r1: string; r2: string; r3: string } }>;
    };
    expect(raw.ownerBeadId).toBe("am-sr-12-charge-current-bgq0");
    // The record's caption lives under `targets`, which verify-content reads; the old unread
    // `entries` block was replaced when the caption was rewritten against §9.
    expect(raw.paper).toBe("special-relativity");
    const entry = raw.targets.find((t) => t.id === "sr-12");
    expect(entry).toBeDefined();
    expect(entry?.readings.r0.length).toBeGreaterThan(10);
    expect(entry?.readings.r1.length).toBeGreaterThan(10);
    expect(entry?.readings.r2.length).toBeGreaterThan(10);
    expect(entry?.readings.r3.length).toBeGreaterThan(10);
  });
});
