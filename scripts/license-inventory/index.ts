/**
 * License Inventory Engine and Verification Harness.
 * Bead: am-gov-license-inventory-w6yz
 */

import { existsSync, readdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { join, relative } from "node:path";
import yaml from "js-yaml";
import { collectDonor } from "./collectDonor.ts";
import { collectFonts } from "./collectFonts.ts";
import { collectNpm } from "./collectNpm.ts";
import { collectVendored } from "./collectVendored.ts";
import { collectWasm } from "./collectWasm.ts";
import { evaluatePolicy } from "./evaluatePolicy.ts";
import { writeLicenseInventoryLogs } from "./logger.ts";
import { renderNotices } from "./renderNotices.ts";
import type { EvaluationResult, LicenseItem, LicensePolicy } from "./types.ts";

export interface FilesystemAdapters {
  readonly readText: (path: string) => string | null;
  readonly exists: (path: string) => boolean;
  readonly findFiles: (dir: string, pattern: RegExp) => string[];
}

export const defaultFsAdapters: FilesystemAdapters = {
  readText(path: string): string | null {
    try {
      if (existsSync(path)) {
        return readFileSync(path, "utf8");
      }
    } catch {
      // ignore
    }
    return null;
  },
  exists(path: string): boolean {
    return existsSync(path);
  },
  findFiles(dir: string, pattern: RegExp): string[] {
    const results: string[] = [];
    if (!existsSync(dir)) return results;

    function walk(current: string) {
      const entries = readdirSync(current);
      for (const entry of entries) {
        const full = join(current, entry);
        try {
          const st = statSync(full);
          if (st.isDirectory()) {
            walk(full);
          } else if (st.isFile() && pattern.test(full)) {
            results.push(full);
          }
        } catch {
          // ignore
        }
      }
    }

    walk(dir);
    return results;
  },
};

export interface InventoryResult {
  readonly items: readonly LicenseItem[];
  readonly evaluation: EvaluationResult;
  readonly renderedNotices: string;
  readonly committedNoticesMatch: boolean;
  readonly committedNoticesDiff?: string;
}

export function buildLicenseInventory(
  rootDir: string,
  fs: FilesystemAdapters = defaultFsAdapters,
): InventoryResult {
  // 1. Read package.json
  const pkgJsonPath = join(rootDir, "package.json");
  const pkgJsonText = fs.readText(pkgJsonPath) || "{}";
  const packageJson = JSON.parse(pkgJsonText);

  // 2. Read docs/license-policy.yaml
  const policyPath = join(rootDir, "docs/license-policy.yaml");
  const policyText = fs.readText(policyPath) || "";
  const policy = (yaml.load(policyText) as LicensePolicy) || { allowlist: [] };

  // 3. Collect NPM items
  const { production: npmProd, tools: npmTools } = collectNpm({
    rootDir,
    packageJson,
    readText: fs.readText,
    exists: fs.exists,
  });

  // 4. Collect Fonts
  const fontsDir = join(rootDir, "public/fonts");
  const fontAbsoluteFiles = fs.findFiles(fontsDir, /\.(ttf|woff|woff2|otf)$/i);
  const fontRelativeFiles = fontAbsoluteFiles.map((p) => relative(rootDir, p));
  const fontItems = collectFonts({
    rootDir,
    fontFiles: fontRelativeFiles,
    readText: fs.readText,
    exists: fs.exists,
  });

  // 5. Collect Vendored
  const vendoredItems = collectVendored({
    rootDir,
    exists: fs.exists,
    readText: fs.readText,
  });

  // 6. Collect Donor extracted modules
  const donorAuditPath = join(rootDir, "docs/DONOR_AUDIT.md");
  const donorAuditText = fs.readText(donorAuditPath) || "";
  const donorItems = collectDonor({
    rootDir,
    auditMarkdown: donorAuditText,
    readText: fs.readText,
    exists: fs.exists,
  });

  // 7. Collect WASM artifacts
  const wasmManifestPath = join(rootDir, "public/wasm/manifest.json");
  let manifestJson: any = null;
  const manifestText = fs.readText(wasmManifestPath);
  if (manifestText) {
    try {
      manifestJson = JSON.parse(manifestText);
    } catch {
      manifestJson = null;
    }
  }

  const wasmDir = join(rootDir, "public/wasm");
  const wasmAbsoluteFiles = fs.findFiles(wasmDir, /\.wasm$/i);
  const wasmRelativeFiles = wasmAbsoluteFiles.map((p) => relative(rootDir, p));
  const wasmItems = collectWasm({
    rootDir,
    manifestJson,
    wasmFilesOnDisk: wasmRelativeFiles,
    readText: fs.readText,
  });

  // Combine all items
  const allItems: LicenseItem[] = [
    ...npmProd,
    ...fontItems,
    ...vendoredItems,
    ...donorItems,
    ...wasmItems,
    ...npmTools,
  ];

  // Evaluate policy
  const evaluation = evaluatePolicy(allItems, policy);

  // Render third-party notices
  const renderedNotices = renderNotices(allItems);

  // Check against committed THIRD_PARTY_NOTICES.md
  const committedNoticesPath = join(rootDir, "THIRD_PARTY_NOTICES.md");
  const committedText = fs.readText(committedNoticesPath);
  const committedNoticesMatch = committedText === renderedNotices;

  let diffDetails: string | undefined;
  if (!committedNoticesMatch) {
    if (!committedText) {
      diffDetails = "Committed 'THIRD_PARTY_NOTICES.md' does not exist.";
    } else {
      const committedLines = committedText.split("\n");
      const renderedLines = renderedNotices.split("\n");
      let diffLine = -1;
      for (let i = 0; i < Math.max(committedLines.length, renderedLines.length); i++) {
        if (committedLines[i] !== renderedLines[i]) {
          diffLine = i + 1;
          break;
        }
      }
      diffDetails = `Committed 'THIRD_PARTY_NOTICES.md' differs from newly generated notices at line ${diffLine}.`;
    }
  }

  return {
    items: allItems,
    evaluation,
    renderedNotices,
    committedNoticesMatch,
    committedNoticesDiff: diffDetails,
  };
}

export interface CheckOptions {
  readonly rootDir?: string;
  readonly write?: boolean;
  readonly silent?: boolean;
  readonly logRunId?: string;
  readonly logsDir?: string;
  readonly fs?: FilesystemAdapters;
}

export function runLicenseInventoryCheck(options: CheckOptions = {}): {
  success: boolean;
  exitCode: number;
  logPath: string;
  inventory: InventoryResult;
} {
  const rootDir = options.rootDir || process.cwd();
  const silent = !!options.silent;
  const fs = options.fs || defaultFsAdapters;

  const inventory = buildLicenseInventory(rootDir, fs);

  // If write/generate requested
  if (options.write) {
    const committedNoticesPath = join(rootDir, "THIRD_PARTY_NOTICES.md");
    writeFileSync(committedNoticesPath, inventory.renderedNotices, "utf8");
    if (!silent) {
      console.log(`Updated ${committedNoticesPath}`);
    }
  }

  const { evaluation, committedNoticesMatch, committedNoticesDiff } = inventory;
  const errors = [...evaluation.errors];

  if (!committedNoticesMatch && !options.write) {
    errors.push({
      item: {
        kind: "npm",
        name: "THIRD_PARTY_NOTICES.md",
        version: "committed",
        license: "INVENTORY-STALE",
        source: "THIRD_PARTY_NOTICES.md",
      },
      rule: "stale-committed-inventory",
      message: committedNoticesDiff || "Committed THIRD_PARTY_NOTICES.md is stale.",
    });
  }

  const { logPath } = writeLicenseInventoryLogs(rootDir, evaluation.evaluatedItems, errors, {
    logRunId: options.logRunId,
    logsDir: options.logsDir,
  });

  const success = errors.length === 0;

  if (!silent) {
    if (success) {
      console.log(
        `✔ Third-party license inventory check passed. (${inventory.items.length} items evaluated)`,
      );
      console.log(`  Structured log: ${logPath}`);
    } else {
      console.error(`✖ Third-party license inventory check FAILED:`);
      for (const err of errors) {
        console.error(`  - [${err.rule}] ${err.message}`);
      }
      console.error(`  Structured log: ${logPath}`);
    }
  }

  return {
    success,
    exitCode: success ? 0 : 1,
    logPath,
    inventory,
  };
}
