/**
 * Multi-Runner Test Dispatcher & Orphan Test Detector
 *
 * Requirements:
 * - Scans workspace for test files (matching *.test.ts, *.spec.ts, *.test.mjs, etc.).
 * - Partitions files into Bun runner (bun:test) and Node runner (node:test / .test.mjs).
 * - Enforces the Orphan Test Gate: any test file on disk matching neither runner pattern
 *   fails the gate and explicitly names the orphaned file.
 * - Runs both runners and exits with code 0 on complete success, or code 1 on any test failure
 *   or orphan detection.
 */

import { spawnSync } from "node:child_process";
import { readdirSync, readFileSync } from "node:fs";
import { join, normalize, relative, resolve } from "node:path";
import { pathToFileURL } from "node:url";

export type TestRunnerType = "bun" | "node" | "orphan";

export interface ClassifiedTestFile {
  readonly path: string;
  readonly runner: TestRunnerType;
  readonly reason?: string;
}

export interface TestPartitionResult {
  readonly allDiscovered: readonly string[];
  readonly bunFiles: readonly string[];
  readonly nodeFiles: readonly string[];
  readonly orphanFiles: readonly string[];
}

const TEST_FILE_PATTERN = /\.(test|spec)\.(ts|js|mjs|tsx|jsx)$/;
const IGNORED_DIRS = new Set([
  "node_modules",
  ".git",
  ".next",
  "artifacts",
  "sources",
  "dist",
  "build",
  "coverage",
]);

/**
 * Recursively discovers all test files in the repository.
 */
export function discoverTestFiles(rootDir: string = process.cwd()): string[] {
  const results: string[] = [];

  function walk(dir: string): void {
    const entries = readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
      if (IGNORED_DIRS.has(entry.name)) {
        continue;
      }
      const fullPath = join(dir, entry.name);
      if (entry.isDirectory()) {
        walk(fullPath);
      } else if (entry.isFile() && TEST_FILE_PATTERN.test(entry.name)) {
        const relPath = normalize(relative(rootDir, fullPath)).replace(/\\/g, "/");
        results.push(relPath);
      }
    }
  }

  walk(rootDir);
  return results.sort();
}

/**
 * Classifies a test file by analyzing its filename and content.
 */
export function classifyTestFile(
  filePath: string,
  contentGetter: (p: string) => string = (p) => readFileSync(p, "utf8"),
): ClassifiedTestFile {
  const normPath = normalize(filePath).replace(/\\/g, "/");
  let content = "";
  try {
    content = contentGetter(normPath);
  } catch (err) {
    return {
      path: normPath,
      runner: "orphan",
      reason: `Could not read file: ${(err as Error).message}`,
    };
  }

  // Explicit bun:test import or Bun global APIs (Bun.spawn, etc.)
  const hasBunTest = /from\s+["']bun:test["']|require\(["']bun:test["']\)|\bBun\.[a-zA-Z]/.test(
    content,
  );
  // Explicit node:test import
  const hasNodeTest = /from\s+["']node:test["']|require\(["']node:test["']\)/.test(content);

  if (hasBunTest && hasNodeTest) {
    // If it uses Bun APIs with node:test, it must run under Bun runner since Node does not define global Bun
    if (/\bBun\.[a-zA-Z]/.test(content)) {
      return { path: normPath, runner: "bun" };
    }
    // Ambiguous file using both
    return {
      path: normPath,
      runner: "orphan",
      reason:
        "File imports both 'bun:test' and 'node:test'. A test file must target exactly one runner.",
    };
  }

  if (hasBunTest) {
    return { path: normPath, runner: "bun" };
  }

  if (hasNodeTest) {
    return { path: normPath, runner: "node" };
  }

  // Check file extension conventions
  if (normPath.endsWith(".test.mjs") || normPath.endsWith(".spec.mjs")) {
    return { path: normPath, runner: "node" };
  }

  // If the file uses node:assert or test harness methods
  if (/from\s+["']node:assert/.test(content) || /require\(["']node:assert/.test(content)) {
    return { path: normPath, runner: "node" };
  }

  // If TypeScript/JavaScript test file with describe/it/test/expect without imports, check for Bun globals
  if (/\b(describe|it|test|expect)\s*\(/.test(content)) {
    // In Bun, expect/describe/test can be global
    return { path: normPath, runner: "bun" };
  }

  // Does not match any recognized runner pattern
  return {
    path: normPath,
    runner: "orphan",
    reason:
      "File does not import 'bun:test', 'node:test', 'node:assert', and does not follow runner conventions.",
  };
}

/**
 * Partitions discovered test files into Bun, Node, and Orphan buckets.
 */
export function partitionTestFiles(
  files: readonly string[],
  contentGetter?: (p: string) => string,
): TestPartitionResult {
  const bunFiles: string[] = [];
  const nodeFiles: string[] = [];
  const orphanFiles: string[] = [];

  for (const f of files) {
    const classification = classifyTestFile(f, contentGetter);
    if (classification.runner === "bun") {
      bunFiles.push(f);
    } else if (classification.runner === "node") {
      nodeFiles.push(f);
    } else {
      orphanFiles.push(f);
    }
  }

  return {
    allDiscovered: files,
    bunFiles,
    nodeFiles,
    orphanFiles,
  };
}

/**
 * Executes test suites across Bun and Node runners.
 */
export function runAllTests(options: { rootDir?: string; targetFiles?: readonly string[] } = {}): {
  success: boolean;
  discoveredCount: number;
  bunCount: number;
  nodeCount: number;
  orphanCount: number;
  exitCode: number;
} {
  const rootDir = options.rootDir || process.cwd();
  const allDiscovered =
    options.targetFiles && options.targetFiles.length > 0
      ? [...options.targetFiles]
      : discoverTestFiles(rootDir);

  const partition = partitionTestFiles(allDiscovered, (p) => {
    const fullPath = resolve(rootDir, p);
    return readFileSync(fullPath, "utf8");
  });

  console.log(`\n📋 Discovered ${partition.allDiscovered.length} test files:`);
  console.log(`   - Bun runner suite:  ${partition.bunFiles.length} files`);
  console.log(`   - Node runner suite: ${partition.nodeFiles.length} files`);

  // Check Orphan Test Gate
  if (partition.orphanFiles.length > 0) {
    console.error(
      `\n🚨 Orphan Test Gate Failed: Found ${partition.orphanFiles.length} test file(s) matching no runner pattern:`,
    );
    for (const orphan of partition.orphanFiles) {
      const classification = classifyTestFile(orphan, (p) =>
        readFileSync(resolve(rootDir, p), "utf8"),
      );
      console.error(`   - ${orphan}: ${classification.reason || "Unrecognized test structure"}`);
    }
    console.error(
      `\nEvery test file must import 'bun:test' (for Bun runner) or 'node:test' (for Node runner).\n`,
    );
    return {
      success: false,
      discoveredCount: partition.allDiscovered.length,
      bunCount: partition.bunFiles.length,
      nodeCount: partition.nodeFiles.length,
      orphanCount: partition.orphanFiles.length,
      exitCode: 1,
    };
  }

  let overallSuccess = true;

  // 1. Run Bun tests
  if (partition.bunFiles.length > 0) {
    console.log(`\n▶ Running ${partition.bunFiles.length} Bun test files (bun test)...`);
    const bunResult = spawnSync("bun", ["test", ...partition.bunFiles], {
      cwd: rootDir,
      stdio: "inherit",
    });

    if (bunResult.status !== 0) {
      console.error(`✖ Bun test suite failed with exit code ${bunResult.status}`);
      overallSuccess = false;
    } else {
      console.log(`✔ Bun test suite completed successfully.`);
    }
  }

  // 2. Run Node tests
  if (partition.nodeFiles.length > 0) {
    console.log(
      `\n▶ Running ${partition.nodeFiles.length} Node test files (node --experimental-strip-types --test)...`,
    );
    const nodeResult = spawnSync(
      "node",
      ["--experimental-strip-types", "--test", ...partition.nodeFiles],
      {
        cwd: rootDir,
        stdio: "inherit",
      },
    );

    if (nodeResult.status !== 0) {
      console.error(`✖ Node test suite failed with exit code ${nodeResult.status}`);
      overallSuccess = false;
    } else {
      console.log(`✔ Node test suite completed successfully.`);
    }
  }

  const exitCode = overallSuccess ? 0 : 1;
  return {
    success: overallSuccess,
    discoveredCount: partition.allDiscovered.length,
    bunCount: partition.bunFiles.length,
    nodeCount: partition.nodeFiles.length,
    orphanCount: partition.orphanFiles.length,
    exitCode,
  };
}

// Auto-run if executed directly as a script
const isMain =
  typeof process !== "undefined" &&
  process.argv[1] &&
  (process.argv[1].endsWith("test-runner.ts") ||
    pathToFileURL(process.argv[1]).href === import.meta.url);

if (isMain) {
  const cliArgs = process.argv.slice(2).filter((arg) => !arg.startsWith("-"));
  const result = runAllTests({
    rootDir: process.cwd(),
    targetFiles: cliArgs.length > 0 ? cliArgs : undefined,
  });
  if (result.exitCode !== 0) {
    process.exit(result.exitCode);
  }
}
