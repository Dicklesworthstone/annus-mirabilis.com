#!/usr/bin/env bun
/**
 * Computes build-time SHA-256 hashes for host evaluator modules.
 * Specification: am-rt-worker-protocol-gaq requirement 9.
 *
 * Each evaluator module's source bytes are hashed to produce a canonical:
 *   "source:sha256:<hex>"
 * which is registered in the provenance registry.
 */

import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";

export interface EvaluatorHashRecord {
  readonly evaluatorId: string;
  readonly relativePath: string;
  readonly sha256: string;
  readonly sourceHash: string;
  readonly bytes: number;
}

const EVALUATOR_DIRS = ["src/workers/host", "src/workers/operations"] as const;

export function computeEvaluatorHashes(
  root: string = process.cwd(),
): Record<string, EvaluatorHashRecord> {
  const result: Record<string, EvaluatorHashRecord> = {};

  for (const dir of EVALUATOR_DIRS) {
    const fullDir = resolve(root, dir);
    if (!existsSync(fullDir)) continue;

    const entries = readdirSync(fullDir, { withFileTypes: true });
    for (const entry of entries) {
      if (!entry.isFile() || !entry.name.endsWith(".ts") || entry.name.endsWith(".test.ts")) {
        continue;
      }

      const filePath = join(fullDir, entry.name);
      const content = readFileSync(filePath);
      const sha256 = createHash("sha256").update(content).digest("hex");
      const sourceHash = `source:sha256:${sha256}`;
      const relPath = `${dir}/${entry.name}`;
      const evaluatorId = entry.name.replace(/\.ts$/, "");

      result[evaluatorId] = {
        evaluatorId,
        relativePath: relPath,
        sha256,
        sourceHash,
        bytes: content.byteLength,
      };
    }
  }

  return result;
}

export function writeEvaluatorHashes(
  root: string = process.cwd(),
  outputPath = "src/generated/evaluatorHashes.json",
): void {
  const hashes = computeEvaluatorHashes(root);
  const outFull = resolve(root, outputPath);
  mkdirSync(resolve(root, "src/generated"), { recursive: true });
  writeFileSync(outFull, JSON.stringify(hashes, null, 2), "utf8");
}

const isMain =
  process.argv[1] !== undefined &&
  (process.argv[1].endsWith("hash-evaluators.ts") || import.meta.url.endsWith(process.argv[1]));

if (isMain) {
  const args = process.argv.slice(2);
  const isCheck = args.includes("--check");
  const root = process.cwd();
  const current = computeEvaluatorHashes(root);

  if (isCheck) {
    const existingPath = resolve(root, "src/generated/evaluatorHashes.json");
    if (!existsSync(existingPath)) {
      console.error("evaluatorHashes.json does not exist. Run bun scripts/hash-evaluators.ts");
      process.exit(1);
    }
    const existing = JSON.parse(readFileSync(existingPath, "utf8"));
    const keysA = Object.keys(current).sort();
    const keysB = Object.keys(existing).sort();

    if (JSON.stringify(keysA) !== JSON.stringify(keysB)) {
      console.error("Evaluator hash key mismatch.");
      process.exit(1);
    }

    for (const k of keysA) {
      if (current[k]?.sha256 !== existing[k]?.sha256) {
        console.error(
          `Evaluator ${k} hash drifted: expected ${existing[k]?.sha256}, got ${current[k]?.sha256}`,
        );
        process.exit(1);
      }
    }
    console.log(`Evaluator hashes verified (${keysA.length} modules).`);
    process.exit(0);
  } else {
    writeEvaluatorHashes(root);
    console.log(
      `Evaluator hashes written to src/generated/evaluatorHashes.json (${Object.keys(current).length} modules).`,
    );
  }
}
