/**
 * Source Manifest Reporting Engine.
 *
 * Generates per-kind and per-status inventory reports without misleading aggregate percentages,
 * separating in-scope units from not-in-scope units.
 *
 * Spec: AGENTS.md and am-cm-source-manifest-6qa
 */

import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import type { ManifestReportData, SourceManifest } from "./types.ts";

/**
 * Computes a detailed inventory report from a SourceManifest.
 */
export function generateManifestReport(manifest: SourceManifest): ManifestReportData {
  const byKind: Record<string, number> = {};
  const byStatus: Record<string, number> = {};
  const incompleteUnits: { id: string; kind: string; section?: string; status: string }[] = [];

  let inScopeCount = 0;
  let notInScopeCount = 0;

  for (const unit of manifest.units) {
    const isNotInScope = unit.scope === "not-in-scope";
    if (isNotInScope) {
      notInScopeCount++;
    } else {
      inScopeCount++;
    }

    const kindKey = isNotInScope ? `${unit.kind} (not-in-scope)` : unit.kind;
    byKind[kindKey] = (byKind[kindKey] ?? 0) + 1;

    const st = unit.status ?? "unspecified";
    const statusKey = isNotInScope ? `${st} (not-in-scope)` : st;
    byStatus[statusKey] = (byStatus[statusKey] ?? 0) + 1;

    if (!isNotInScope && st !== "reviewed" && st !== "accepted") {
      incompleteUnits.push({
        id: unit.id,
        kind: unit.kind,
        section: unit.section,
        status: st,
      });
    }
  }

  return {
    paper: manifest.paper,
    document: manifest.document,
    status: manifest.status,
    scope: manifest.scope ?? "full-document",
    pageCount: manifest.pageCount,
    pageRange: manifest.pageRange,
    totalUnits: manifest.units.length,
    inScopeCount,
    notInScopeCount,
    byKind,
    byStatus,
    incompleteUnits,
    exportedCount: manifest.exports?.length ?? 0,
    importedCount: manifest.importedResults?.length ?? 0,
  };
}

/**
 * Formats report data into human-readable text.
 * Strictly avoids aggregate percentages per AGENTS.md and bead specification.
 */
export function formatManifestReportText(report: ManifestReportData): string {
  const lines: string[] = [];

  lines.push(`================================================================`);
  lines.push(`SOURCE MANIFEST INVENTORY REPORT: ${report.paper} (${report.document})`);
  lines.push(`================================================================`);
  lines.push(`Status:     ${report.status}`);
  lines.push(`Scope:      ${report.scope}`);
  lines.push(
    `Pages:      ${report.pageRange[0]}–${report.pageRange[1]} (${report.pageCount} pages)`,
  );
  lines.push(
    `Total Units: ${report.totalUnits} (In-Scope: ${report.inScopeCount}, Not-In-Scope: ${report.notInScopeCount})`,
  );
  lines.push(``);

  lines.push(`--- Units by Kind ---`);
  for (const [kind, count] of Object.entries(report.byKind).sort((a, b) => b[1] - a[1])) {
    lines.push(`  ${kind.padEnd(30)}: ${count}`);
  }
  lines.push(``);

  lines.push(`--- Units by Status ---`);
  for (const [st, count] of Object.entries(report.byStatus).sort((a, b) => b[1] - a[1])) {
    lines.push(`  ${st.padEnd(30)}: ${count}`);
  }
  lines.push(``);

  if (report.incompleteUnits.length > 0) {
    lines.push(`--- Incomplete Units (${report.incompleteUnits.length}) ---`);
    for (const u of report.incompleteUnits.slice(0, 20)) {
      lines.push(
        `  - ${u.id.padEnd(20)} [${u.kind}] status: ${u.status}${u.section ? ` (${u.section})` : ""}`,
      );
    }
    if (report.incompleteUnits.length > 20) {
      lines.push(`  ... and ${report.incompleteUnits.length - 20} more`);
    }
    lines.push(``);
  } else {
    lines.push(`All in-scope units are reviewed.`);
    lines.push(``);
  }

  lines.push(`Exports: ${report.exportedCount} | Imports: ${report.importedCount}`);
  lines.push(`================================================================`);

  return lines.join("\n");
}

/**
 * Writes the report JSON to artifacts/source-manifest/<slug>-<toolRunId>.json.
 */
export function writeManifestReportJson(
  report: ManifestReportData,
  toolRunId: string,
  outDir = join(process.cwd(), "artifacts", "source-manifest"),
): string {
  mkdirSync(outDir, { recursive: true });
  const outPath = join(outDir, `${report.paper}-${toolRunId}.json`);
  writeFileSync(outPath, `${JSON.stringify(report, null, 2)}\n`, "utf8");
  return outPath;
}
