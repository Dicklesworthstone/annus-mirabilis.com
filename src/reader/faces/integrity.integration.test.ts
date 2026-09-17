import { describe, expect, it } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { checkReceipt } from "../../content/provenance/checkReceipt.ts";

describe("facsimile integrity and receipt verification (am-read-facsimile-face-er0)", () => {
  const fixturesDir = join(process.cwd(), "src/testing/fixtures/provenance");

  it("passes for valid provenance receipt ap-99-001", () => {
    const filePath = join(fixturesDir, "ap-99-001.md");
    const content = readFileSync(filePath, "utf8");
    const result = checkReceipt(content, filePath);
    expect(result.ok).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it("seeded digest mismatch for publish fixture fails receipt validation", () => {
    const filePath = join(fixturesDir, "err-scan-digest-mismatch.md");
    const content = readFileSync(filePath, "utf8");
    const result = checkReceipt(content, filePath, {
      configDir: join(fixturesDir, "facsimile-sources"),
    });
    expect(result.ok).toBe(false);
    expect(result.errors.some((e) => e.rule === "receipt-config-digest-mismatch")).toBe(true);
  });

  it("absent pin-local-only file is flagged as not-available without crashing receipt checker", () => {
    const filePath = join(fixturesDir, "flag-absent-local-only.md");
    const content = readFileSync(filePath, "utf8");
    const result = checkReceipt(content, filePath, {
      requireLocal: false,
      rootDir: "/tmp/nonexistent-local-root",
    });
    // Should be ok under non-requireLocal mode, with a flag recorded
    expect(result.ok).toBe(true);
    expect(result.flags.some((f) => f.rule === "receipt-local-file-not-available")).toBe(true);
  });
});
