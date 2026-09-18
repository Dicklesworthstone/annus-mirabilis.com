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
    // This once asserted the receipt did NOT exist. It does now: f88de57 landed a
    // real 14 KB facsimile receipt for ap-17-549. The invariant worth guarding was
    // never "no provenance exists" - it is that a facsimile receipt does not by
    // itself make the report claim source units. Those are separate states, and
    // conflating them is how a reviewed-looking number appears before any
    // transcription has happened.
    const receipt = "docs/provenance/ap-17-549.md";
    assert.equal(existsSync(receipt), true, `${receipt} should exist; f88de57 added it`);
    assert.ok(readFileSync(receipt, "utf8").includes("receiptKind: facsimile-scan"));
    assert.equal(report.totalUnits, 0);
    assert.equal(report.status, "in-preparation");
    logger.log({
      testId: "report-cli",
      beadId: BROWNIAN_INVENTORY_BEAD,
      paper: "brownian-motion",
      outcome: "passed",
      extra: { check: "cli-report" },
    });
  });
});
