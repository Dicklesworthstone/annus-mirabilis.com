#!/usr/bin/env bun
/**
 * Facsimile Page Anchor and Offset Quality Gate (am-cf6m).
 *
 * Verifies that each facsimile source configuration records a verified anchor
 * and that articlePages.printedFirst/printedLast map consistently onto parentPageIndices
 * through the anchor's offset, with contiguous indices and matching page counts.
 *
 * Design constraints:
 * - Arithmetic check against recorded, human-verified anchors (no text recognition / local OCR).
 * - A config whose anchor is missing must FAIL loudly (MISSING_VERIFIED_ANCHOR). An unverifiable pin is not a verified pin.
 * - The gate asserts articlePages.printedFirst and printedLast map onto parentPageIndices[0]
 *   and the last index consistently through the anchor's offset.
 * - parentPageIndices must be contiguous and length must equal printedLast - printedFirst + 1.
 *
 * Usage:
 *   bun scripts/verify-facsimile-anchors.ts [--key <key>] [--config-dir <dir>] [--json]
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import yaml from "js-yaml";
import { TestLogger } from "../src/testing/log/logger.ts";
import {
  type AnchorValidationResult,
  validateFacsimileAnchor,
} from "./sources/facsimileSourceSchema.ts";

export interface FacsimileAnchorCheckReport {
  readonly valid: boolean;
  readonly checkedCount: number;
  readonly passedCount: number;
  readonly failedCount: number;
  readonly results: Record<string, AnchorValidationResult>;
}

export function getDefaultConfigDir(): string {
  return path.resolve(path.dirname(fileURLToPath(import.meta.url)), "sources", "facsimile-sources");
}

export function verifyFacsimileAnchors(options?: {
  configDir?: string | undefined;
  key?: string | undefined;
}): FacsimileAnchorCheckReport {
  const dir = options?.configDir ?? getDefaultConfigDir();
  if (!fs.existsSync(dir)) {
    return {
      valid: false,
      checkedCount: 0,
      passedCount: 0,
      failedCount: 1,
      results: {
        [dir]: {
          valid: false,
          errors: [`Config directory '${dir}' does not exist`],
          refusalCode: "invalid-config",
        },
      },
    };
  }

  let files = fs
    .readdirSync(dir)
    .filter((f) => f.endsWith(".yaml") || f.endsWith(".yml"))
    .sort();

  if (options?.key) {
    const keyTarget =
      options.key.endsWith(".yaml") || options.key.endsWith(".yml")
        ? options.key
        : `${options.key}.yaml`;
    files = files.filter((f) => f === keyTarget || f.startsWith(`${options.key}.`));
    if (files.length === 0) {
      return {
        valid: false,
        checkedCount: 0,
        passedCount: 0,
        failedCount: 1,
        results: {
          [options.key]: {
            valid: false,
            errors: [`No facsimile config found matching key '${options.key}' in '${dir}'`],
            refusalCode: "invalid-config",
          },
        },
      };
    }
  }

  const results: Record<string, AnchorValidationResult> = {};
  let passedCount = 0;
  let failedCount = 0;

  for (const file of files) {
    const filePath = path.join(dir, file);
    try {
      const content = fs.readFileSync(filePath, "utf8");
      const parsed = yaml.load(content);
      const res = validateFacsimileAnchor(parsed);
      results[file] = res;
      if (res.valid) {
        passedCount++;
      } else {
        failedCount++;
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      results[file] = {
        valid: false,
        errors: [`Failed to read or parse YAML: ${message}`],
        refusalCode: "invalid-config",
      };
      failedCount++;
    }
  }

  return {
    valid: failedCount === 0 && passedCount > 0,
    checkedCount: files.length,
    passedCount,
    failedCount,
    results,
  };
}

export function formatAnchorReport(report: FacsimileAnchorCheckReport): string {
  const lines: string[] = ["=== Facsimile Page Anchor & Offset Quality Gate ==="];

  for (const [file, res] of Object.entries(report.results)) {
    if (res.valid) {
      const anchorInfo = res.anchor
        ? ` (anchor: parent ${res.anchor.parentPageIndex} -> printed ${res.anchor.printedPage}, offset ${res.offset ?? 0}, verified by ${res.anchor.verifiedBy})`
        : "";
      lines.push(`✓ ${file}: valid${anchorInfo}`);
    } else {
      const code = res.refusalCode ?? "ERROR";
      const errs = res.errors.join("; ");
      lines.push(`✗ ${file}: ${code} - ${errs}`);
    }
  }

  lines.push("");
  lines.push(
    `Summary: ${report.checkedCount} checked, ${report.passedCount} valid, ${report.failedCount} failed.`,
  );
  return lines.join("\n");
}

export async function runCli(): Promise<number> {
  const args = process.argv.slice(2);
  let key: string | undefined;
  let configDir: string | undefined;
  let jsonOutput = false;

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg === "--key" && i + 1 < args.length) {
      key = args[++i];
    } else if (arg === "--config-dir" && i + 1 < args.length) {
      configDir = args[++i];
    } else if (arg === "--json") {
      jsonOutput = true;
    }
  }

  const report = verifyFacsimileAnchors({ key, configDir });

  if (jsonOutput) {
    console.log(JSON.stringify(report, null, 2));
  } else {
    console.log(formatAnchorReport(report));
  }

  // Structured log (am-uxh9). This gate is registered requiredInCi and is RED today on
  // three real defects, and it wrote no artifact at all: the refusals existed only as
  // stdout, so nothing recorded which config failed on which rule.
  const logger = new TestLogger("facsimile-page-anchors");
  for (const [file, result] of Object.entries(report.results)) {
    logger.log({
      testId: file,
      outcome: result.valid ? "passed" : "failed",
      message: result.valid
        ? `Anchor consistent${result.offset === undefined ? "" : ` (offset ${result.offset})`}.`
        : `[${result.refusalCode ?? "ERROR"}] ${result.errors.join("; ")}`,
    });
  }
  logger.log({
    testId: "facsimile-page-anchors-summary",
    outcome: report.valid ? "passed" : "failed",
    message: `${report.checkedCount} checked, ${report.passedCount} valid, ${report.failedCount} failed.`,
  });
  await logger.flush();
  console.log(`Structured log: ${logger.filePath}`);

  return report.valid ? 0 : 3;
}

const isMainModule =
  process.argv[1] !== undefined &&
  (import.meta.url === `file://${process.argv[1]}` ||
    process.argv[1].endsWith("verify-facsimile-anchors.ts"));

if (isMainModule) {
  runCli().then((code) => {
    process.exit(code);
  });
}
