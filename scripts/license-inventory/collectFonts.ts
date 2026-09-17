/**
 * Collect Font Assets and Licenses.
 * Bead: am-gov-license-inventory-w6yz
 */

import { basename, dirname, join } from "node:path";
import type { LicenseItem } from "./types.ts";

export interface CollectFontsOptions {
  readonly rootDir: string;
  readonly fontFiles: readonly string[]; // relative paths from root, e.g. "public/fonts/newsreader/Newsreader-Variable.ttf"
  readonly readText: (path: string) => string | null;
  readonly exists: (path: string) => boolean;
}

const FONT_EXTENSIONS = new Set([".ttf", ".woff", ".woff2", ".otf", ".eot"]);

export function collectFonts(options: CollectFontsOptions): LicenseItem[] {
  const { rootDir, fontFiles, readText, exists } = options;
  const items: LicenseItem[] = [];

  for (const relPath of fontFiles) {
    const ext = relPath.slice(relPath.lastIndexOf(".")).toLowerCase();
    if (!FONT_EXTENSIONS.has(ext)) continue;

    const fullPath = join(rootDir, relPath);
    const dir = dirname(fullPath);
    const relDir = dirname(relPath);
    const fileName = basename(relPath);

    // Look for license file in the same directory
    const candidates = ["OFL.txt", "OFL.md", "LICENSE", "LICENSE.txt", "SIL_Open_Font_License.txt"];
    let licensePath: string | undefined;
    let licenseText: string | undefined;
    let license = "";

    for (const c of candidates) {
      const candFull = join(dir, c);
      if (exists(candFull)) {
        licensePath = join(relDir, c);
        licenseText = readText(candFull) || undefined;
        if (
          licenseText &&
          (licenseText.includes("SIL OPEN FONT LICENSE") || licenseText.includes("OFL"))
        ) {
          license = "OFL-1.1";
        } else if (licenseText?.includes("MIT License")) {
          license = "MIT";
        } else if (licenseText) {
          license = "OFL-1.1";
        }
        break;
      }
    }

    // Determine font family name
    const familyDir = basename(dir);
    const familyName = familyDir
      .split("-")
      .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
      .join(" ");

    const item: LicenseItem = {
      kind: "font",
      name: `${familyName} (${fileName})`,
      version: "variable",
      license: license || "UNLICENSED",
      source: relPath,
      authorOrNotice: `Hosted subset font under ${relDir}`,
      ...(licensePath !== undefined ? { licensePath } : {}),
      ...(licenseText !== undefined ? { licenseText } : {}),
    };
    items.push(item);
  }

  return items;
}
