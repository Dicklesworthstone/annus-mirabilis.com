/**
 * Collect Vendored Browser Assets and Licenses.
 * Bead: am-gov-license-inventory-w6yz
 */

import { join } from "node:path";
import type { LicenseItem } from "./types.ts";

export interface CollectVendoredOptions {
  readonly rootDir: string;
  readonly exists: (path: string) => boolean;
  readonly readText: (path: string) => string | null;
}

export function collectVendored(options: CollectVendoredOptions): LicenseItem[] {
  const { rootDir, exists, readText } = options;
  const items: LicenseItem[] = [];

  const pdfjsDir = join(rootDir, "public/pdfjs");
  if (exists(pdfjsDir)) {
    const licensePathCandidates = [
      join(pdfjsDir, "LICENSE"),
      join(pdfjsDir, "LICENSE.txt"),
      join(pdfjsDir, "NOTICE"),
    ];

    let license = "Apache-2.0";
    let licensePath: string | undefined;
    let licenseText: string | undefined;

    for (const c of licensePathCandidates) {
      if (exists(c)) {
        licensePath = "public/pdfjs/LICENSE";
        licenseText = readText(c) || undefined;
        break;
      }
    }

    items.push({
      kind: "vendored",
      name: "PDF.js",
      version: "upstream",
      license,
      source: "public/pdfjs",
      licensePath,
      licenseText,
      authorOrNotice: "Mozilla Foundation (Apache License 2.0)",
    });
  }

  return items;
}
