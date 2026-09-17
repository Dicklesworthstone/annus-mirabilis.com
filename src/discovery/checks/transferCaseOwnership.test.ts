import { describe, expect, test } from "bun:test";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

describe("transferCaseOwnership", () => {
  test("this bead registers no duplicate transfer-case compiler rule or deny list", () => {
    const thisDir = join(process.cwd(), "src/discovery");
    const files: string[] = [];

    function walk(dir: string) {
      for (const entry of readdirSync(dir, { withFileTypes: true })) {
        const full = join(dir, entry.name);
        if (entry.isDirectory()) {
          walk(full);
        } else if (/\.(ts|tsx)$/.test(entry.name) && full !== fileURLToPath(import.meta.url)) {
          files.push(full);
        }
      }
    }
    walk(thisDir);

    for (const file of files) {
      const content = readFileSync(file, "utf8");
      // Must not define a second copy of transfer-not-structural or transfer-feedback-incomplete
      expect(content).not.toContain("function validateTransferCase(");
      expect(content).not.toContain('rule: "transfer-not-structural"');
      expect(content).not.toContain('rule: "transfer-feedback-incomplete"');
    }
  });
});
