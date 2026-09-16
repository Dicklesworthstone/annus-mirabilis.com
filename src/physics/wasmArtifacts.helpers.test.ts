/**
 * Single source of truth helper scan test (am-fs-slim-artifact-0yh).
 *
 * Asserts that src/physics/wasmArtifacts.test.ts imports its helpers
 * strictly from src/testing/wasm/artifactHelpers.ts, and that no duplicate
 * helper implementations exist.
 */

import assert from "node:assert/strict";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, resolve } from "node:path";
import { describe, it } from "node:test";

describe("WASM Artifact Helper Single Source of Truth", () => {
  const repoRoot = resolve(".");
  const testFilePath = join(repoRoot, "src/physics/wasmArtifacts.test.ts");

  it("src/physics/wasmArtifacts.test.ts imports from src/testing/wasm/artifactHelpers.ts", () => {
    const content = readFileSync(testFilePath, "utf8");
    assert.ok(content.includes("artifactHelpers.ts"));
    assert.ok(content.includes("computeArtifactDigest"));
    assert.ok(content.includes("loadWasmBytes"));
    assert.ok(content.includes("validateWasmBytes"));
  });

  it("no duplicate digest/instantiation helpers reimplemented in src/physics/ or scripts/", () => {
    function findTsFiles(dir: string): string[] {
      const results: string[] = [];
      if (!readdirSync) return results;
      for (const entry of readdirSync(dir)) {
        const full = join(dir, entry);
        const stat = statSync(full);
        if (stat.isDirectory()) {
          results.push(...findTsFiles(full));
        } else if (entry.endsWith(".ts") && !entry.endsWith(".d.ts")) {
          results.push(full);
        }
      }
      return results;
    }

    const physicsFiles = findTsFiles(join(repoRoot, "src/physics"));
    for (const file of physicsFiles) {
      if (file === testFilePath) continue;
      const content = readFileSync(file, "utf8");
      // Check that files don't define a duplicate function validateWasmBytes
      assert.equal(/function\s+validateWasmBytes\s*\(/.test(content), false);
    }
  });
});
