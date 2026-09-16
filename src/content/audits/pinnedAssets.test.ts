import { afterAll, describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { getLogger } from "../../testing/log/logger.ts";
import { auditPinnedAssets, type PinnedAsset } from "./pinnedAssets.ts";
import { errorCheckCodes } from "./types.ts";

const FIXTURES = join(dirname(fileURLToPath(import.meta.url)), "__fixtures__", "pinnedAssets");
const logger = getLogger("verify-content-tests");
const BEAD = "am-cm-audit-scripts-d34";

type PinnedFixture = Readonly<{
  assets: PinnedAsset[];
  present: string[];
  requireLocal?: boolean;
}>;

function loadFixture(name: string): PinnedFixture {
  return JSON.parse(readFileSync(join(FIXTURES, name), "utf8")) as PinnedFixture;
}

function run(name: string) {
  const fixture = loadFixture(name);
  const present = new Set(fixture.present);
  return auditPinnedAssets(fixture.assets, {
    exists: (path) => present.has(path),
    ...(fixture.requireLocal === undefined ? {} : { requireLocal: fixture.requireLocal }),
  });
}

describe("auditPinnedAssets: paired ok/broken fixtures", () => {
  test("GOOD RECORD: a present publish file, a present pin-local-only file, and a reference-only asset pass", () => {
    const report = run("present.ok.json");
    expect(report.ok).toBe(true);
    expect(errorCheckCodes(report)).toEqual([]);
    logger.log({
      testId: "pinned-assets-present-ok",
      beadId: BEAD,
      extra: { family: "audit", check: "pinned-asset-present" },
      outcome: "passed",
      message: "present published assets are admitted",
    });
  });

  test("PLANTED: a missing publish file is rejected by code", () => {
    const report = run("publish-missing.broken.json");
    expect(report.ok).toBe(false);
    expect(errorCheckCodes(report)).toContain("pinned-asset-present");
    expect(report.findings[0]?.recordId).toBe("ap-17-549-pdf");
  });

  test("GOOD RECORD: a missing pin-local-only file without --require-local is not-available, not an error", () => {
    const report = run("pin-local-absent.ok.json");
    expect(report.ok).toBe(true);
    expect(errorCheckCodes(report)).toEqual([]);
    expect(report.findings.some((f) => f.check === "pinned-asset-not-available")).toBe(true);
  });

  test("PLANTED: a missing pin-local-only file with --require-local is rejected by code", () => {
    const report = run("pin-local-require-local.broken.json");
    expect(report.ok).toBe(false);
    expect(errorCheckCodes(report)).toContain("pinned-asset-present");
  });

  test("GOOD RECORD: reference-only has no file to check", () => {
    const report = run("reference-only.ok.json");
    expect(report.ok).toBe(true);
    expect(errorCheckCodes(report)).toEqual([]);
    expect(report.findings).toEqual([]);
  });
});

afterAll(async () => {
  await logger.flush();
});
