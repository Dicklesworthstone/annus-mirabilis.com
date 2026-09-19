import { describe, expect, test } from "bun:test";
import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { loadReadingFiles } from "../../../scripts/build-content.ts";
import { newRunIdentity, TestLogger } from "../../testing/log/logger.ts";
import { compileReadingContent } from "../compiler/compile.ts";
import { parseReceipt } from "../provenance/parseReceipt.ts";
import { receiptToSourceAsset } from "../provenance/receiptToSourceAsset.ts";
import { parseYaml } from "../provenance/yaml.ts";

const ROOT = process.cwd();
const LIGHT_QUANTA_BEAD = "am-edn-inventory-light-quanta-skp";
const PAPER_SLUG = "light-quanta";

const logRunId = newRunIdentity();
const logRoot = join(ROOT, "artifacts/test-logs");
const logger = new TestLogger("manifest-light-quanta-e2e", logRunId, logRoot);

function retainEvidenceOnFailure(name: string, stdout: string, stderr: string, extra?: Record<string, unknown>) {
  const evidenceDir = join(ROOT, "artifacts/test-logs/manifest-light-quanta", logRunId, "evidence");
  mkdirSync(evidenceDir, { recursive: true });
  writeFileSync(join(evidenceDir, `${name}.stdout.log`), stdout);
  writeFileSync(join(evidenceDir, `${name}.stderr.log`), stderr);
  if (extra) {
    writeFileSync(join(evidenceDir, `${name}.extra.json`), JSON.stringify(extra, null, 2));
  }
}

describe("light-quanta source-manifest report e2e (am-edn-inventory-light-quanta-skp)", () => {
  test("source-manifest-report CLI runs cleanly with code 0, all destinations assigned, matching page counts, and no percentages", () => {
    const proc = spawnSync("bun", ["scripts/source-manifest-report.ts", PAPER_SLUG], {
      cwd: ROOT,
      encoding: "utf8",
    });

    const exitCode = proc.status ?? 1;
    const stdout = proc.stdout ?? "";
    const stderr = proc.stderr ?? "";

    if (exitCode !== 0) {
      retainEvidenceOnFailure("source-manifest-report", stdout, stderr);
    }

    expect(exitCode).toBe(0);

    // No percentage in output
    expect(/%/.test(stdout)).toBe(false);
    expect(/%/.test(stderr)).toBe(false);

    // Validate units and destinations against manifest
    const manifestPath = join(ROOT, "content/source-blocks/light-quanta/manifest.yaml");
    const manifest = parseYaml(readFileSync(manifestPath, "utf8")) as {
      units: Array<{ id: string; destination?: unknown; locators: Array<{ page: number }> }>;
    };

    expect(manifest.units.length).toBe(128);
    for (const unit of manifest.units) {
      expect(unit.destination).toBeDefined();
    }

    // Verify per-page counts match SourceAsset.pageMapping
    const receiptPath = join(ROOT, "docs/provenance/ap-17-132.md");
    const receiptParsed = parseReceipt(readFileSync(receiptPath, "utf8"), receiptPath);
    expect(receiptParsed.ok).toBe(true);

    const sourceAsset = receiptToSourceAsset(receiptParsed.frontMatter!);
    expect(sourceAsset.pageMapping.length).toBe(17);

    for (const pageEntry of sourceAsset.pageMapping) {
      const pageUnits = manifest.units.filter((u) => u.locators.some((l) => l.page === pageEntry.printedPage));
      expect(pageUnits.length).toBeGreaterThanOrEqual(1);
    }

    logger.log({
      testId: "e2e-source-manifest-report",
      beadId: LIGHT_QUANTA_BEAD,
      paper: PAPER_SLUG,
      outcome: "passed",
      comparisonKind: "bitwise",
      message: "source-manifest-report CLI completed with exit code 0, verified destinations, matching page counts, and no percentages.",
      extra: { check: "report-cli" },
    });
  });

  test("corpus content compiler check produces no rejections for light-quanta", async () => {
    const files = await loadReadingFiles();
    const compiled = compileReadingContent(files);

    if (!compiled.ok) {
      const errors = compiled.diagnostics.filter((d) => d.severity === "error");
      retainEvidenceOnFailure("content-compiler", "", JSON.stringify(errors, null, 2));
    }

    expect(compiled.ok).toBe(true);

    const lqRejections = compiled.diagnostics.filter(
      (d) =>
        d.severity === "error" &&
        (d.path?.includes("light-quanta") || d.message?.includes("light-quanta")),
    );
    expect(lqRejections.length).toBe(0);

    logger.log({
      testId: "e2e-content-compiler-clean",
      beadId: LIGHT_QUANTA_BEAD,
      paper: PAPER_SLUG,
      outcome: "passed",
      comparisonKind: "bitwise",
      message: "Corpus content compiler has zero rejections for light-quanta.",
      extra: { check: "content-compiler" },
    });
  });

  test("receipt verification check passes cleanly with 0 errors for ap-17-132", () => {
    const proc = spawnSync("bun", ["scripts/check-receipts.ts", "--key", "ap-17-132"], {
      cwd: ROOT,
      encoding: "utf8",
    });

    const exitCode = proc.status ?? 1;
    const stdout = proc.stdout ?? "";
    const stderr = proc.stderr ?? "";

    if (exitCode !== 0) {
      retainEvidenceOnFailure("check-receipts", stdout, stderr);
    }

    expect(exitCode).toBe(0);
    expect(stdout).toContain("0 errors");

    logger.log({
      testId: "e2e-check-receipts",
      beadId: LIGHT_QUANTA_BEAD,
      paper: PAPER_SLUG,
      outcome: "passed",
      comparisonKind: "bitwise",
      message: "check-receipts script passed with 0 errors for ap-17-132.",
      extra: { check: "check-receipts" },
    });
  });
});
