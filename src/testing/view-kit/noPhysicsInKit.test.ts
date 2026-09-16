import { describe, expect, test } from "bun:test";
import * as fs from "node:fs";
import * as path from "node:path";
import { fileURLToPath } from "node:url";
import { findPhysicsImportViolations } from "../noPhysicsInComponents.test.ts";

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..");
const KIT_DIR = path.join(REPO_ROOT, "src/visuals/kit");

describe("no physics in view kit (am-inst-2d-view-kit-u75r)", () => {
  test("src/visuals/kit contains zero forbidden physics imports", () => {
    const files: { path: string; content: string }[] = [];
    for (const name of fs.readdirSync(KIT_DIR)) {
      if (!/\.(ts|tsx)$/.test(name)) continue;
      const full = path.join(KIT_DIR, name);
      const repoRelative = path.relative(REPO_ROOT, full).split(path.sep).join("/");
      files.push({
        path: repoRelative,
        content: fs.readFileSync(full, "utf8"),
      });
    }

    expect(files.length).toBeGreaterThan(5);
    const violations = findPhysicsImportViolations(files);
    expect(violations).toEqual([]);
  });
});
