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
import {
  type AbsentSourceLayerReason,
  type ManifestReportData,
  type PaperSourceLayers,
  SOURCE_LAYER_KINDS,
  type SourceManifest,
} from "./types.ts";
import type { UnitCoverage } from "./unitCoverage.ts";

export class ManifestReportError extends Error {
  readonly code: "unit-coverage-population";
  constructor(code: ManifestReportError["code"], message: string) {
    super(message);
    this.code = code;
    this.name = "ManifestReportError";
  }
}

/**
 * The statuses that count a unit complete: a reviewed or accepted hand status, or a derived status
 * every applicable layer reaches (unitCoverage.ts).
 */
const COMPLETE_STATUSES = new Set(["reviewed", "accepted", "covered", "covered-declared"]);

/**
 * Typed absent state for the four canonical source layers, for a paper whose tree holds nothing.
 *
 * THIS IS NOT A DEFAULT ANY MORE (am-4cpx). It was the default value of generateManifestReport's
 * `sourceLayers`, and its docblock said "Since no ledger, transcription, translation, or gloss
 * currently exists", which was true when written and false for three of the four by 2026-09-27. The
 * report therefore printed `transcription-not-started` over 456 source blocks, 821 translation
 * units and 542 gloss units, and would have printed the same zeros on a finished edition. Callers
 * now derive the layers from the tree (sourceLayers.ts) and pass them, so this is only for a caller
 * that genuinely has no tree to read, such as a fixture.
 */
export function getAbsentSourceLayers(
  defaultReason?: AbsentSourceLayerReason | string,
): PaperSourceLayers {
  return {
    ledger: {
      layer: "ledger",
      state: "absent",
      reason: defaultReason ?? "no-reviewed-ledger",
      available: false,
      unitCount: 0,
    },
    transcription: {
      layer: "transcription",
      state: "absent",
      reason: defaultReason ?? "transcription-not-started",
      available: false,
      unitCount: 0,
    },
    translation: {
      layer: "translation",
      state: "absent",
      reason: defaultReason ?? "translation-not-started",
      available: false,
      unitCount: 0,
    },
    gloss: {
      layer: "gloss",
      state: "absent",
      reason: defaultReason ?? "gloss-not-started",
      available: false,
      unitCount: 0,
    },
  };
}

/**
 * Computes a detailed inventory report from a SourceManifest.
 */
export function generateManifestReport(
  manifest: SourceManifest,
  /**
   * Required, and deliberately without a default (am-4cpx): a default that reported every layer
   * absent meant every caller that forgot the argument published zeros that looked like a
   * measurement. readSourceLayers(root, paper, document, pageCount) derives them from the tree.
   */
  sourceLayers: PaperSourceLayers,
  /**
   * Each unit's status derived from the tree (deriveUnitCoverage, am-rc1001-bridge-plan-pcjk.13).
   * Without it the statuses are the manifest's own fields, which no manifest fills in, so every unit
   * reads `unspecified`; the report says which source it used, and only a derived one can say every
   * block is covered. A hand-written `status` on a unit still wins, as a declared override.
   */
  unitCoverage?: readonly UnitCoverage[],
): ManifestReportData {
  const derived = new Map((unitCoverage ?? []).map((c) => [c.id, c]));
  if (unitCoverage !== undefined && unitCoverage.length !== manifest.units.length)
    throw new ManifestReportError(
      "unit-coverage-population",
      `unit coverage holds ${unitCoverage.length} units and ${manifest.paper}'s manifest lists ${manifest.units.length}; a coverage over fewer units than the manifest cannot report it.`,
    );
  const byKind: Record<string, number> = {};
  const byStatus: Record<string, number> = {};
  const incompleteUnits: {
    id: string;
    kind: string;
    section?: string | undefined;
    status: string;
  }[] = [];

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

    const coverage = derived.get(unit.id);
    const st = unit.status ?? coverage?.status ?? "unspecified";
    const statusKey = isNotInScope ? `${st} (not-in-scope)` : st;
    byStatus[statusKey] = (byStatus[statusKey] ?? 0) + 1;

    if (!isNotInScope && !COMPLETE_STATUSES.has(st)) {
      incompleteUnits.push({
        id: unit.id,
        kind: unit.kind,
        section: unit.section,
        status: st,
      });
    }
  }

  const covered = (unitCoverage ?? []).filter(
    (c) => c.status === "covered" || c.status === "covered-declared",
  );
  return {
    unitStatusSource: unitCoverage === undefined ? "manifest-fields" : "derived-from-tree",
    coveredCount: covered.length,
    glossedCount: (unitCoverage ?? []).filter((c) => c.glossed).length,
    declaredUnits: (unitCoverage ?? []).flatMap((c) =>
      c.declared ? [{ id: c.id, status: c.declared.status, reason: c.declared.reason }] : [],
    ),
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
    layers: sourceLayers,
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

  lines.push(`--- Source Layers ---`);
  for (const layerKind of SOURCE_LAYER_KINDS) {
    const layer = report.layers[layerKind];
    if (layer.state === "absent") {
      lines.push(`  ${layerKind.padEnd(30)}: absent (${layer.reason})`);
    } else {
      // The denominator beside the count, so "0 of 542" cannot read like "542 of 542" (am-4cpx).
      const of = layer.of === undefined ? "" : ` of ${layer.of}`;
      const population = layer.population ? ` ${layer.population}` : " units";
      lines.push(
        `  ${layerKind.padEnd(30)}: present (${layer.status}, ${layer.unitCount}${of}${population})`,
      );
      if (layer.note) lines.push(`  ${"".padEnd(30)}  ${layer.note}`);
    }
  }
  lines.push(``);

  lines.push(`--- Units by Kind ---`);
  for (const [kind, count] of Object.entries(report.byKind).sort((a, b) => b[1] - a[1])) {
    lines.push(`  ${kind.padEnd(30)}: ${count}`);
  }
  lines.push(``);

  lines.push(
    report.unitStatusSource === "derived-from-tree"
      ? `--- Units by Status (derived from the tree: ${report.totalUnits} units, the manifest's ${report.totalUnits}) ---`
      : `--- Units by Status (the manifest's own fields; not derived) ---`,
  );
  for (const [st, count] of Object.entries(report.byStatus).sort((a, b) => b[1] - a[1])) {
    lines.push(`  ${st.padEnd(30)}: ${count}`);
  }
  if (report.unitStatusSource === "derived-from-tree")
    lines.push(`  ${"glossed (reported, not gating)".padEnd(30)}: ${report.glossedCount}`);
  lines.push(``);
  if (report.declaredUnits.length > 0) {
    lines.push(
      `--- Covered by a declaration, not an explanation (${report.declaredUnits.length}) ---`,
    );
    for (const d of report.declaredUnits.slice(0, 10))
      lines.push(`  - ${d.id.padEnd(20)} ${d.status}: ${d.reason}`);
    if (report.declaredUnits.length > 10)
      lines.push(`  ... and ${report.declaredUnits.length - 10} more`);
    lines.push(``);
  }

  if (report.totalUnits === 0) {
    lines.push(`No source units inventoried. Absence is recorded; review is not claimed.`);
    lines.push(``);
  } else if (
    report.unitStatusSource === "derived-from-tree" &&
    report.incompleteUnits.length === 0 &&
    report.coveredCount === report.inScopeCount
  ) {
    lines.push(
      `Every block covered: ${report.coveredCount} of ${report.inScopeCount} in-scope units (${report.declaredUnits.length} by a declaration). That is not a review certificate: see the layers above for what is a draft.`,
    );
    lines.push(``);
  } else if (report.incompleteUnits.length > 0) {
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
    lines.push(
      `In-scope units have no incomplete statuses in this count. That is not a human-review certificate.`,
    );
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
