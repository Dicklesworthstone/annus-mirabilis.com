/**
 * Scanner enforcing the no-retries policy for statistical suites.
 * (am-ver-statistical-policy-grj)
 */

import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import path from "node:path";

export interface RetryScanResult {
  readonly filename: string;
  readonly line: number;
  readonly match: string;
  readonly reason: string;
}

const RETRY_PATTERNS: readonly { pattern: RegExp; reason: string }[] = [
  {
    pattern: /\bretry\s*[:=]\s*[1-9]\d*/i,
    reason: "Test or configuration specifies a retry count > 0",
  },
  {
    pattern: /\bretries\s*[:=]\s*[1-9]\d*/i,
    reason: "Configuration specifies retries count > 0",
  },
  {
    pattern: /--retry\s+[1-9]\d*/i,
    reason: "CLI command contains --retry flag",
  },
  {
    pattern: /nick-fields\/retry/i,
    reason: "GitHub Actions workflow uses retry action",
  },
  {
    pattern: /\bretry-times\s*[:=]\s*[1-9]\d*/i,
    reason: "Workflow step specifies retry-times",
  },
];

/**
 * Scans a single file's text content for prohibited retry patterns.
 */
export function scanContentForRetries(
  content: string,
  filename: string,
): readonly RetryScanResult[] {
  const results: RetryScanResult[] = [];
  const lines = content.split("\n");

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]!;
    const trimmed = line.trim();
    if (
      trimmed.startsWith("//") ||
      trimmed.startsWith("#") ||
      trimmed.startsWith("*") ||
      trimmed.startsWith("/*")
    ) {
      if (
        trimmed.includes("no-retries") ||
        trimmed.includes("no-retry") ||
        trimmed.includes("noRetries") ||
        trimmed.includes("never rerun") ||
        trimmed.includes("no reruns") ||
        trimmed.includes("RETRY_PATTERNS")
      ) {
        continue;
      }
    }

    for (const { pattern, reason } of RETRY_PATTERNS) {
      const match = line.match(pattern);
      if (match) {
        results.push({
          filename,
          line: i + 1,
          match: match[0],
          reason,
        });
      }
    }
  }

  return results;
}

/**
 * Scans key project configuration files and statistical test files for retry options.
 */
export function scanProjectForRetries(rootDir: string = process.cwd()): {
  violations: readonly RetryScanResult[];
  passed: boolean;
} {
  const violations: RetryScanResult[] = [];

  const candidateFiles: string[] = [
    path.join(rootDir, "bunfig.toml"),
    path.join(rootDir, "playwright.config.ts"),
  ];

  // Add github workflow files
  const workflowsDir = path.join(rootDir, ".github", "workflows");
  if (existsSync(workflowsDir)) {
    for (const file of readdirSync(workflowsDir)) {
      if (file.endsWith(".yml") || file.endsWith(".yaml")) {
        candidateFiles.push(path.join(workflowsDir, file));
      }
    }
  }

  // Add statistical test files under src/testing/stats/ (skipping noRetries.test.ts)
  const statsDir = path.join(rootDir, "src", "testing", "stats");
  if (existsSync(statsDir)) {
    for (const file of readdirSync(statsDir)) {
      if (file.endsWith(".ts") && file !== "noRetries.ts" && file !== "noRetries.test.ts") {
        candidateFiles.push(path.join(statsDir, file));
      }
    }
  }

  for (const filePath of candidateFiles) {
    if (existsSync(filePath) && statSync(filePath).isFile()) {
      const content = readFileSync(filePath, "utf8");
      const fileViolations = scanContentForRetries(content, path.relative(rootDir, filePath));
      violations.push(...fileViolations);
    }
  }

  return {
    violations,
    passed: violations.length === 0,
  };
}
