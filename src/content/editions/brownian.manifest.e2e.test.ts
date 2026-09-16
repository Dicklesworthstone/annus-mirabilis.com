import assert from "node:assert/strict";
import { existsSync, mkdtempSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, it } from "node:test";
import { newRunIdentity, TestLogger } from "../../testing/log/logger.ts";
import { formatManifestReportText, generateManifestReport } from "../manifest/report.ts";
import { validateSourceManifest } from "../manifest/schema.ts";
import { parseYaml } from "../provenance/yaml.ts";
import { BROWNIAN_INVENTORY_BEAD } from "./brownianInventory.ts";

const logRoot = mkdtempSync(join(tmpdir(), "brownian-manifest-e2e-"));
const logger = new TestLogger("manifest-brownian-motion", newRunIdentity(), logRoot);

describe("brownian source-manifest report CLI (am-edn-inventory-brownian-slg)", () => {
  it("report pipeline exits clean, records absence, and never prints a percentage or a reviewed certificate", () => {
    const path = join(process.cwd(), "content/source-blocks/brownian-motion/manifest.yaml");
    const manifest = validateSourceManifest(parseYaml(readFileSync(path, "utf8")), path);
    const report = generateManifestReport(manifest);
    const json = JSON.stringify(report, null, 2);
    const text = formatManifestReportText(report);
    assert.equal(report.paper, "brownian-motion");
    assert.equal(report.status, "in-preparation");
    assert.equal(report.totalUnits, 0);
    assert.ok(!/%/.test(json));
    assert.ok(!/%/.test(text));
    assert.ok(text.includes("No source units inventoried"));
    assert.ok(!text.toLowerCase().includes("are reviewed"));
    assert.equal(existsSync("docs/provenance/ap-17-549.md"), false);
    logger.log({
      testId: "report-cli",
      beadId: BROWNIAN_INVENTORY_BEAD,
      paper: "brownian-motion",
      outcome: "passed",
      extra: { check: "cli-report" },
    });
  });
});
