/**
 * Render Deterministic THIRD_PARTY_NOTICES.md.
 * Bead: am-gov-license-inventory-w6yz
 */

import type { LicenseItem, LicenseItemKind } from "./types.ts";

const KIND_ORDER: Record<LicenseItemKind, number> = {
  npm: 1,
  font: 2,
  wasm: 3,
  donor: 4,
  vendored: 5,
  tool: 6,
};

const KIND_HEADERS: Record<LicenseItemKind, string> = {
  npm: "## 1. Production NPM Dependencies",
  font: "## 2. Typefaces and Fonts",
  wasm: "## 3. Compiled WebAssembly Artifacts",
  donor: "## 4. Extracted Donor Modules (classic-patents.com)",
  vendored: "## 5. Vendored Browser Assets",
  tool: "## 6. Build and Test Tooling (devDependencies)",
};

export function renderNotices(items: readonly LicenseItem[]): string {
  // Sort items deterministically: by kind order, then lowercase name, then version
  const sorted = [...items].sort((a, b) => {
    const kDiff = (KIND_ORDER[a.kind] ?? 99) - (KIND_ORDER[b.kind] ?? 99);
    if (kDiff !== 0) return kDiff;
    const nameDiff = a.name.toLowerCase().localeCompare(b.name.toLowerCase());
    if (nameDiff !== 0) return nameDiff;
    return a.version.localeCompare(b.version);
  });

  const lines: string[] = [];

  lines.push("# Third-Party Software and Asset Notices");
  lines.push("");
  lines.push(
    "This document contains third-party software, typeface, library, and artifact notices for dependencies included in or used to build `annus-mirabilis.com`.",
  );
  lines.push("");
  lines.push("## Scope and Honesty Declaration");
  lines.push("");
  lines.push(
    "The third-party material listed below is used in annus-mirabilis.com under the respective licenses.",
  );
  lines.push(
    "This inventory does not state or imply rights to scans, photographs, historical datasets, the German source text, the English translation, or original explanatory prose. Rights to those layers are recorded in their respective provenance receipts (`docs/provenance/`) and rights records.",
  );
  lines.push("");

  // Group by kind
  const groups = new Map<LicenseItemKind, LicenseItem[]>();
  for (const item of sorted) {
    const list = groups.get(item.kind) || [];
    list.push(item);
    groups.set(item.kind, list);
  }

  const kindsInOrder: LicenseItemKind[] = ["npm", "font", "wasm", "donor", "vendored", "tool"];

  for (const kind of kindsInOrder) {
    const groupItems = groups.get(kind);
    if (!groupItems || groupItems.length === 0) continue;

    lines.push(KIND_HEADERS[kind]);
    lines.push("");

    lines.push("| Package / Asset | Version | License | Source Path | Notes / Reference |");
    lines.push("|---|---|---|---|---|");

    for (const item of groupItems) {
      if (
        item.license === "PENDING-OWNER-RULING" ||
        item.license === "UNATTRIBUTED-DONOR-EXTRACTION" ||
        item.license === "ATTRIBUTION-HEADER-INVALID"
      ) {
        continue;
      }
      const escapedName = item.name.replace(/\|/g, "\\|");
      const escapedVer = item.version.replace(/\|/g, "\\|");
      const escapedLic = item.license.replace(/\|/g, "\\|");
      const escapedSrc = `\`${item.source.replace(/\|/g, "\\|")}\``;
      const refOrNote = (
        item.licensePath ? `File: \`${item.licensePath}\`` : item.authorOrNotice || ""
      )
        .replace(/\|/g, "\\|")
        .replace(/\n/g, " ");

      lines.push(
        `| ${escapedName} | ${escapedVer} | ${escapedLic} | ${escapedSrc} | ${refOrNote} |`,
      );
    }

    lines.push("");
  }

  return lines.join("\n").trimEnd() + "\n";
}
