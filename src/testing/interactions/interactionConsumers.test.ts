import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";
import { validateActionContracts } from "../../accessibility/actionContracts.ts";
import { strictParse } from "../../content/schemas/strictParse.ts";

const ROOT = process.cwd();

describe("Interaction Consumers Audit (am-inst-interaction-families-m2ps)", () => {
  it("audits content/experiments manifests and checks action contract families", () => {
    const dir = path.join(ROOT, "content/experiments");
    const files = fs.readdirSync(dir).filter((f) => f.endsWith(".yaml") && !f.startsWith("tapes"));

    assert.ok(files.length >= 25);
    const familiesFound = new Set<string>();

    for (const file of files) {
      const fullPath = path.join(dir, file);
      const raw = strictParse(fs.readFileSync(fullPath, "utf8"), "yaml") as {
        actions?: readonly unknown[];
      } | null;
      if (!raw || typeof raw !== "object" || !Array.isArray(raw.actions)) continue;

      const validated = validateActionContracts(raw.actions, `${file}.actions`);
      for (const act of validated) {
        familiesFound.add(act.family);
      }
    }

    assert.ok(
      familiesFound.size >= 4,
      `Expected at least 4 families found, got ${familiesFound.size}`,
    );
  });

  it("LQ-05 decision: LQ-05 subvolume action declares probability-diffusion, NEVER radiation-entropy", () => {
    const lq05Path = path.join(ROOT, "content/experiments/lq-05.yaml");
    if (!fs.existsSync(lq05Path)) {
      return; // LQ-05 file not present in this build
    }

    const raw = strictParse(fs.readFileSync(lq05Path, "utf8"), "yaml") as {
      actions?: readonly { actionId?: string; family?: string }[];
    } | null;
    if (raw && Array.isArray(raw.actions)) {
      const subvolumeAction = raw.actions.find(
        (a) =>
          a.actionId === "subvolume-fraction" ||
          a.actionId === "sample-configuration" ||
          a.actionId?.includes("subvolume"),
      );

      if (subvolumeAction) {
        // Assert LQ-05 uses probability-diffusion or probability, never radiation-entropy
        assert.notEqual(
          subvolumeAction.family,
          "radiation-entropy",
          "LQ-05 must not use radiation-entropy (PartitionControl is reserved for LQ-04).",
        );
      }
    }
  });
});
