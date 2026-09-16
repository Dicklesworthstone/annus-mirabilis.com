import { describe, expect, test } from "bun:test";
import { existsSync, mkdtempSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { newRunIdentity, TestLogger } from "../../testing/log/logger.ts";
import { formatManifestReportText, generateManifestReport } from "../manifest/report.ts";
import { validateSourceManifest } from "../manifest/schema.ts";
import { parseYaml } from "../provenance/yaml.ts";
import { BROWNIAN_INVENTORY_BEAD } from "./brownianInventory.ts";

const logRoot = mkdtempSync(join(tmpdir(), "brownian-manifest-e2e-"));
const logger = new TestLogger("manifest-brownian-motion", newRunIdentity(), logRoot);

describe("brownian source-manifest report CLI (am-edn-inventory-brownian-slg)", () => {
  test("report pipeline exits clean, records absence, and never prints a percentage or a reviewed certificate", () => {
    const path = join(process.cwd(), "content/source-blocks/brownian-motion/manifest.yaml");
    const manifest = validateSourceManifest(parseYaml(readFileSync(path, "utf8")), path);
    const report = generateManifestReport(manifest);
    const json = JSON.stringify(report, null, 2);
    const text = formatManifestReportText(report);
    expect(report.paper).toBe("brownian-motion");
    expect(report.status).toBe("in-preparation");
    expect(report.totalUnits).toBe(0);
    expect(json).not.toMatch(/%/);
    expect(text).not.toMatch(/%/);
    expect(text).toContain("No source units inventoried");
    expect(text.toLowerCase()).not.toContain("are reviewed");
    expect(existsSync("docs/provenance/ap-17-549.md")).toBe(false);
    logger.log({
      testId: "report-cli",
      beadId: BROWNIAN_INVENTORY_BEAD,
      paper: "brownian-motion",
      outcome: "passed",
      extra: { check: "cli-report" },
    });
  });
});
