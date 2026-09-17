#!/usr/bin/env bun
/**
 * Source Manifest Inventory Report CLI.
 *
 * Usage:
 *   bun scripts/source-manifest-report.ts <paper-slug> [--json] [--corpus <dir>]
 *
 * Spec: AGENTS.md and am-cm-source-manifest-6qa
 */

import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import {
  formatManifestReportText,
  generateManifestReport,
  writeManifestReportJson,
} from "../src/content/manifest/report.ts";
import { validateSourceManifest } from "../src/content/manifest/schema.ts";
import { parseYaml } from "../src/content/provenance/yaml.ts";
import { newRunIdentity } from "../src/testing/log/logger.ts";

function generateToolRunId(): string {
  return newRunIdentity();
}

async function main() {
  const args = process.argv.slice(2);
  let slug = "";
  let jsonOutput = false;
  let corpusDir = "content";

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (!arg) continue;
    if (arg === "--help" || arg === "-h") {
      console.log(
        "Usage: bun scripts/source-manifest-report.ts <paper-slug> [--json] [--corpus <dir>]",
      );
      process.exit(0);
    } else if (arg === "--json") {
      jsonOutput = true;
    } else if (arg === "--corpus" && i + 1 < args.length) {
      const next = args[++i];
      if (next) corpusDir = next;
    } else if (!arg.startsWith("-") && !slug) {
      slug = arg;
    }
  }

  if (!slug) {
    console.error(
      "Usage: bun scripts/source-manifest-report.ts <paper-slug> [--json] [--corpus <dir>]",
    );
    process.exit(1);
  }

  // Look for manifest in corpus directory
  const candidates = [
    join(corpusDir, "source-blocks", slug, "manifest.yaml"),
    join(corpusDir, "source-blocks", slug, "manifest.yml"),
    join(corpusDir, "source-blocks", slug, "manifest.json"),
    join(corpusDir, "manifests", `${slug}.yaml`),
    join(corpusDir, "manifests", `${slug}.json`),
  ];

  let manifestPath: string | null = null;
  for (const c of candidates) {
    if (existsSync(c)) {
      manifestPath = c;
      break;
    }
  }

  if (!manifestPath) {
    console.error(
      `Source manifest not found for paper slug '${slug}'. Searched:\n${candidates.map((c) => `  - ${c}`).join("\n")}`,
    );
    process.exit(1);
  }

  let parsedRaw: unknown;
  try {
    const fileText = readFileSync(manifestPath, "utf8");
    if (manifestPath.endsWith(".json")) {
      parsedRaw = JSON.parse(fileText);
    } else {
      parsedRaw = parseYaml(fileText);
    }
  } catch (err) {
    console.error(`Error parsing manifest at '${manifestPath}':`, err);
    process.exit(1);
  }

  const manifest = validateSourceManifest(parsedRaw, manifestPath);
  const report = generateManifestReport(manifest);

  const toolRunId = generateToolRunId();
  writeManifestReportJson(report, toolRunId);

  if (jsonOutput) {
    console.log(JSON.stringify(report, null, 2));
  } else {
    console.log(formatManifestReportText(report));
  }
}

if (import.meta.main || process.argv[1]?.endsWith("source-manifest-report.ts")) {
  main().catch((err) => {
    console.error(`Fatal error in source manifest report:`, err);
    process.exit(1);
  });
}
