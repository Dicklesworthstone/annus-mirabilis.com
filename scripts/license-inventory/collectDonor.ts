/**
 * Collect Extracted Donor Code and Validate Attribution Headers.
 * Bead: am-gov-license-inventory-w6yz
 */

import { join } from "node:path";
import type { LicenseItem } from "./types.ts";

export interface CollectDonorOptions {
  readonly rootDir: string;
  readonly auditMarkdown: string;
  readonly readText: (path: string) => string | null;
  readonly exists: (path: string) => boolean;
}

export interface DonorExtractedEntry {
  readonly sourcePath: string;
  readonly destPath: string;
  readonly noticeForm: string;
}

export function parseDonorAuditExtractedFiles(markdown: string): DonorExtractedEntry[] {
  const entries: DonorExtractedEntry[] = [];
  const lines = markdown.split("\n");

  let inSection11 = false;

  for (const line of lines) {
    if (line.startsWith("## 11. Extracted Files") || line.startsWith("## 11. ")) {
      inSection11 = true;
      continue;
    }
    if (inSection11 && line.startsWith("## ") && !line.startsWith("## 11")) {
      break;
    }

    if (!inSection11) continue;

    // Match table row with sourcePath and destPath
    // e.g. | `src/physics/controlTape.ts` | `src/experiments/tape/controlTape.ts` (`am-scaf-...`) | ... | header | ...
    const match = line.match(
      /^\|\s*`([^`]+)`\s*\|\s*`([^`]+)`(?:\s*\([^)]*\))?\s*\|(?:[^|]*\|){5}\s*([^|]+)\s*\|/,
    );
    if (match) {
      const sourcePath = match[1].trim();
      const destPath = match[2].trim();
      const noticeForm = match[3].trim().toLowerCase();

      // Skip header row
      if (sourcePath === "sourcePath" || sourcePath.startsWith("-")) continue;

      entries.push({
        sourcePath,
        destPath,
        noticeForm,
      });
    }
  }

  return entries;
}

export interface HeaderValidationResult {
  readonly valid: boolean;
  readonly errors: readonly string[];
}

export function validateDonorAttributionHeader(content: string): HeaderValidationResult {
  const errors: string[] = [];
  if (!content.startsWith("/**\n * Extracted from classic-patents.com\n")) {
    errors.push("Missing required opening: '/**\\n * Extracted from classic-patents.com\\n'");
  }
  if (
    !content.includes("Source repository: https://github.com/Dicklesworthstone/classic-patents.com")
  ) {
    errors.push(
      "Missing required 'Source repository: https://github.com/Dicklesworthstone/classic-patents.com'",
    );
  }
  if (!content.includes("Pinned commit: da11ff475902728fd8dd1d9db9f3af37c16ec8a5")) {
    errors.push("Missing required 'Pinned commit: da11ff475902728fd8dd1d9db9f3af37c16ec8a5'");
  }
  if (!content.includes("License: MIT License (with OpenAI/Anthropic Rider)")) {
    errors.push("Missing required 'License: MIT License (with OpenAI/Anthropic Rider)'");
  }
  if (!content.includes("Preserved license text: /LICENSE")) {
    errors.push("Missing required 'Preserved license text: /LICENSE'");
  }
  return {
    valid: errors.length === 0,
    errors,
  };
}

export function collectDonor(options: CollectDonorOptions): LicenseItem[] {
  const { rootDir, auditMarkdown, readText, exists } = options;
  const entries = parseDonorAuditExtractedFiles(auditMarkdown);
  const items: LicenseItem[] = [];

  for (const entry of entries) {
    const fullPath = join(rootDir, entry.destPath);
    const fileExists = exists(fullPath);

    if (!fileExists) {
      // If file doesn't exist on disk yet (e.g. pending batch 2), we only check if it is already extracted or pending
      // But if it's listed in a completed bead or exists, we validate it.
      // Notice: if a file doesn't exist on disk, we skip it or report pending.
      continue;
    }

    const content = readText(fullPath) || "";
    let license = "MIT with OpenAI/Anthropic Rider";
    let noticeError: string | undefined;

    if (
      entry.noticeForm === "header" ||
      entry.destPath.endsWith(".ts") ||
      entry.destPath.endsWith(".js")
    ) {
      const headerCheck = validateDonorAttributionHeader(content);
      if (!headerCheck.valid) {
        license = "ATTRIBUTION-HEADER-INVALID";
        noticeError = headerCheck.errors.join("; ");
      }
    }

    items.push({
      kind: "donor",
      name: entry.destPath,
      version: "da11ff4",
      license,
      source: entry.destPath,
      authorOrNotice:
        noticeError ||
        "Extracted from classic-patents.com at da11ff475902728fd8dd1d9db9f3af37c16ec8a5",
    });
  }

  return items;
}
