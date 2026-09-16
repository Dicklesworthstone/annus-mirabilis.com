import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";

describe("datasetRevealRights (am-inst-dataset-overlay-ra9r)", () => {
  test("static scan asserts the reveal component never requests facsimile-scan asset", () => {
    const revealPath = join(process.cwd(), "src/visuals/overlays/DatasetEvidenceReveal.tsx");
    const content = readFileSync(revealPath, "utf8");

    // The reveal is for figure crops only and must not request or route to full facsimile-scan assets
    expect(content).not.toContain("facsimile-scan");
  });
});
