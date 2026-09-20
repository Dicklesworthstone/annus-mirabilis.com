/**
 * Coverage Ledger Computation, Validation, and Report Generation Engine.
 *
 * Enforces seven separate, unaggregated dimensions:
 * 1. Source status
 * 2. Translation review
 * 3. Argument treatment
 * 4. Instrument availability (distinct execution provenance)
 * 5. Accessibility equivalence
 * 6. Numerical validation (from explicit scenario evidence)
 * 7. Editorial review approval
 *
 * Spec: AGENTS.md §10.4 and am-cm-coverage-ledger-0ip
 */

import { createHash, randomBytes } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { mapDetailedProvenanceToDonor } from "./coverageManifest.ts";
import type {
  ArgumentNodeCoverage,
  CoverageDiagnostic,
  CoverageReport,
  CoverageReportInput,
  EditorialReviewStatus,
  ExecutionProvenanceState,
  NumericalValidationStatus,
} from "./types.ts";

export interface LedgerContext {
  readonly argumentNodes: readonly ArgumentNodeCoverage[];
  readonly sourceManifests?:
    | ReadonlyMap<
        string,
        {
          readonly paper: string;
          readonly totalUnits: number;
          readonly byStatus: Readonly<Record<string, number>>;
        }
      >
    | undefined;
  readonly translationUnits?:
    | ReadonlyMap<
        string,
        {
          readonly paper: string;
          readonly status: string;
        }
      >
    | undefined;
  readonly instruments?:
    | ReadonlyMap<
        string,
        {
          readonly id: string;
          readonly provenance: ExecutionProvenanceState;
          readonly paper?: string | undefined;
        }
      >
    | undefined;
  readonly knownExperiments?: ReadonlySet<string> | undefined;
  readonly scenarioEvidence?:
    | readonly {
        readonly scenarioId: string;
        readonly status: "passed" | "failed" | "skipped";
        readonly failureMessage?: string | undefined;
      }[]
    | undefined;
  readonly scenarioEvidencePath?: string | undefined;
  readonly reviewRecords?:
    | readonly {
        readonly paper: string;
        readonly section: string;
        readonly physicsReview?: EditorialReviewStatus | undefined;
        readonly r2Readability?: EditorialReviewStatus | undefined;
        readonly germanSourceReview?: EditorialReviewStatus | undefined;
      }[]
    | undefined;
  readonly reviewRecordsPath?: string | undefined;
}

export function generateToolRunId(date: Date = new Date()): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  const year = date.getUTCFullYear();
  const month = pad(date.getUTCMonth() + 1);
  const day = pad(date.getUTCDate());
  const hours = pad(date.getUTCHours());
  const minutes = pad(date.getUTCMinutes());
  const seconds = pad(date.getUTCSeconds());
  const hex = randomBytes(4).toString("hex");
  return `${year}${month}${day}T${hours}${minutes}${seconds}Z-${hex}`;
}

export function computeSha256(content: string | Buffer): string {
  return createHash("sha256").update(content).digest("hex");
}

/**
 * Validates argument treatment rules and returns actionable diagnostics.
 */
export function validateCoverageLedger(context: LedgerContext): readonly CoverageDiagnostic[] {
  const diagnostics: CoverageDiagnostic[] = [];

  // Track instrument usage for shared-instrument correspondence note checks
  const instrumentUsage = new Map<string, ArgumentNodeCoverage[]>();

  for (const node of context.argumentNodes ?? []) {
    const { treatment } = node;

    // 1. Omitted treatment requires written reason
    if (treatment.kind === "omitted") {
      if (!treatment.reason?.trim()) {
        diagnostics.push({
          severity: "error",
          rule: "omitted-treatment-missing-reason",
          paper: node.paper,
          section: node.section,
          argumentId: node.id,
          message: `Argument node '${node.id}' has omitted treatment without a written reason.`,
          repair: `Add a 'reason' string explaining why this node's treatment is omitted.`,
        });
      }

      // Central inference cannot be omitted
      if (node.logicalRole === "derivation" || node.logicalRole === "heuristic-inference") {
        diagnostics.push({
          severity: "error",
          rule: "central-inference-missing-treatment",
          paper: node.paper,
          section: node.section,
          argumentId: node.id,
          message: `Central inference node '${node.id}' (role: ${node.logicalRole}) cannot have omitted treatment; requires instrument or static treatment.`,
          repair: `Provide an instrument or static worked example for '${node.id}'.`,
        });
      }
    } else if (treatment.kind === "instrument") {
      // 2. Validate experiment IDs
      for (const expId of treatment.experimentIds) {
        if (context.knownExperiments && !context.knownExperiments.has(expId)) {
          diagnostics.push({
            severity: "error",
            rule: "unknown-experiment-id",
            paper: node.paper,
            section: node.section,
            argumentId: node.id,
            message: `Instrument treatment for node '${node.id}' references unknown experiment '${expId}'.`,
            actual: expId,
            repair: `Register experiment '${expId}' or correct the experiment ID.`,
          });
        }

        const list = instrumentUsage.get(expId) ?? [];
        list.push(node);
        instrumentUsage.set(expId, list);
      }
    }
  }

  // 3. Shared instruments require explicit correspondence notes
  for (const [expId, nodes] of instrumentUsage.entries()) {
    if (nodes.length > 1) {
      for (const node of nodes) {
        if (node.treatment.kind === "instrument" && !node.treatment.correspondenceNote?.trim()) {
          diagnostics.push({
            severity: "error",
            rule: "shared-instrument-missing-correspondence-note",
            paper: node.paper,
            section: node.section,
            argumentId: node.id,
            message: `Shared instrument '${expId}' on node '${node.id}' requires an explicit correspondence note.`,
            actual: expId,
            repair: `Add a 'correspondenceNote' explaining how '${expId}' demonstrates node '${node.id}'.`,
          });
        }
      }
    }
  }

  return diagnostics;
}

/**
 * Computes the multi-dimensional coverage report conforming strictly to the no-aggregate schema.
 */
export function generateCoverageReport(
  context: LedgerContext,
  toolRunId: string = generateToolRunId(),
): CoverageReport {
  const inputs: CoverageReportInput[] = [];

  // Record scenario evidence input if present
  if (context.scenarioEvidencePath && existsSync(context.scenarioEvidencePath)) {
    const fileBytes = readFileSync(context.scenarioEvidencePath);
    inputs.push({
      path: context.scenarioEvidencePath,
      sha256: computeSha256(fileBytes),
      kind: "scenario-evidence",
    });
  }

  // Record review records input if present
  if (context.reviewRecordsPath && existsSync(context.reviewRecordsPath)) {
    const fileBytes = readFileSync(context.reviewRecordsPath);
    inputs.push({
      path: context.reviewRecordsPath,
      sha256: computeSha256(fileBytes),
      kind: "review-records",
    });
  }

  // 1. Source Status Dimension
  const sourcePapers: Record<string, { totalUnits: number; byStatus: Record<string, number> }> = {};
  const sourceByStatus: Record<string, number> = {};
  let totalSourceUnits = 0;

  if (context.sourceManifests) {
    for (const [slug, m] of context.sourceManifests.entries()) {
      sourcePapers[slug] = {
        totalUnits: m.totalUnits,
        byStatus: { ...m.byStatus },
      };
      totalSourceUnits += m.totalUnits;
      for (const [st, count] of Object.entries(m.byStatus)) {
        sourceByStatus[st] = (sourceByStatus[st] ?? 0) + count;
      }
    }
  }

  // 2. Translation Review Dimension
  const translationPapers: Record<
    string,
    { totalUnits: number; byStatus: Record<string, number> }
  > = {};
  const translationByStatus: Record<string, number> = {};
  let totalTranslationUnits = 0;

  if (context.translationUnits) {
    for (const unit of context.translationUnits.values()) {
      totalTranslationUnits++;
      const p = unit.paper;
      const entry = translationPapers[p] ?? { totalUnits: 0, byStatus: {} };
      entry.totalUnits++;
      entry.byStatus[unit.status] = (entry.byStatus[unit.status] ?? 0) + 1;
      translationPapers[p] = entry;
      translationByStatus[unit.status] = (translationByStatus[unit.status] ?? 0) + 1;
    }
  }

  // 3. Argument Treatment Dimension
  const argumentPapers: Record<string, { totalNodes: number; byKind: Record<string, number> }> = {};
  const argumentByKind: Record<string, number> = {};
  let totalArgNodes = 0;

  for (const node of context.argumentNodes ?? []) {
    totalArgNodes++;
    const p = node.paper;
    const kind = node.treatment.kind;
    const entry = argumentPapers[p] ?? { totalNodes: 0, byKind: {} };
    entry.totalNodes++;
    entry.byKind[kind] = (entry.byKind[kind] ?? 0) + 1;
    argumentPapers[p] = entry;
    argumentByKind[kind] = (argumentByKind[kind] ?? 0) + 1;
  }

  // 4. Instrument Availability Dimension (Distinct Execution Provenance)
  const instrumentsMap: Record<
    string,
    {
      provenance: ExecutionProvenanceState;
      donorState: "WASM" | "TS_FALLBACK" | "HONEST_PLACEHOLDER";
    }
  > = {};
  const instrumentByProvenance: Record<string, number> = {};
  let totalInstruments = 0;

  if (context.instruments) {
    for (const [id, inst] of context.instruments.entries()) {
      totalInstruments++;
      const donorState = mapDetailedProvenanceToDonor(inst.provenance);
      instrumentsMap[id] = {
        provenance: inst.provenance,
        donorState,
      };
      instrumentByProvenance[inst.provenance] = (instrumentByProvenance[inst.provenance] ?? 0) + 1;
    }
  }

  // 5. Accessibility Equivalence Dimension
  const a11yNodes: Record<string, { kind: string; details?: string | undefined }> = {};
  const a11yByKind: Record<string, number> = {};

  for (const node of context.argumentNodes ?? []) {
    const kind = node.accessibilityEquivalent?.kind ?? "missing";
    a11yNodes[node.id] = {
      kind,
      details: node.accessibilityEquivalent?.details,
    };
    a11yByKind[kind] = (a11yByKind[kind] ?? 0) + 1;
  }

  // 6. Numerical Validation Dimension
  const scenariosMap: Record<
    string,
    { status: NumericalValidationStatus; reason?: string | undefined }
  > = {};
  const numericalByStatus: Record<string, number> = {};
  let totalScenarios = 0;

  if (context.scenarioEvidence && context.scenarioEvidence.length > 0) {
    for (const sc of context.scenarioEvidence) {
      totalScenarios++;
      let st: NumericalValidationStatus = "not-run";
      if (sc.status === "passed") st = "passing";
      else if (sc.status === "failed") st = "failing";

      scenariosMap[sc.scenarioId] = {
        status: st,
        reason: sc.failureMessage,
      };
      numericalByStatus[st] = (numericalByStatus[st] ?? 0) + 1;
    }
  } else {
    // Honest not-run state when evidence is absent
    numericalByStatus["not-run"] = 1;
    scenariosMap._all_ = {
      status: "not-run",
      reason: "No scenario evidence provided.",
    };
  }

  // 7. Editorial Review Dimension
  const reviewsMap: Record<
    string,
    {
      physicsReview: EditorialReviewStatus;
      r2Readability: EditorialReviewStatus;
      germanSourceReview: EditorialReviewStatus;
    }
  > = {};
  const reviewByStatus: Record<string, number> = {};
  let totalReviews = 0;

  if (context.reviewRecords && context.reviewRecords.length > 0) {
    for (const r of context.reviewRecords) {
      totalReviews++;
      const key = `${r.paper}#${r.section}`;
      const physics = r.physicsReview ?? "not-reviewed";
      const r2 = r.r2Readability ?? "not-reviewed";
      const german = r.germanSourceReview ?? "not-reviewed";

      reviewsMap[key] = {
        physicsReview: physics,
        r2Readability: r2,
        germanSourceReview: german,
      };

      reviewByStatus[`physics:${physics}`] = (reviewByStatus[`physics:${physics}`] ?? 0) + 1;
      reviewByStatus[`r2:${r2}`] = (reviewByStatus[`r2:${r2}`] ?? 0) + 1;
      reviewByStatus[`german:${german}`] = (reviewByStatus[`german:${german}`] ?? 0) + 1;
    }
  } else {
    reviewByStatus["not-reviewed"] = 1;
    reviewsMap._all_ = {
      physicsReview: "not-reviewed",
      r2Readability: "not-reviewed",
      germanSourceReview: "not-reviewed",
    };
  }

  return {
    logRunId: toolRunId,
    generatedAt: new Date().toISOString(),
    inputs,
    sourceStatus: {
      byStatus: sourceByStatus,
      totalUnits: totalSourceUnits,
      papers: sourcePapers,
    },
    translationReview: {
      byStatus: translationByStatus,
      totalUnits: totalTranslationUnits,
      papers: translationPapers,
    },
    argumentTreatment: {
      byKind: argumentByKind,
      totalNodes: totalArgNodes,
      papers: argumentPapers,
    },
    instrumentAvailability: {
      byProvenance: instrumentByProvenance,
      totalInstruments,
      instruments: instrumentsMap,
    },
    accessibilityEquivalence: {
      byKind: a11yByKind,
      totalNodes: totalArgNodes,
      nodes: a11yNodes,
    },
    numericalValidation: {
      byStatus: numericalByStatus,
      totalScenarios,
      scenarios: scenariosMap,
    },
    editorialReview: {
      byStatus: reviewByStatus,
      totalReviews,
      reviews: reviewsMap,
    },
  };
}

/**
 * Formats coverage report into per-paper Markdown tables.
 */
/**
 * One dimension's lines.
 *
 * A dimension with no population used to print its total beside its status map, and when evidence
 * was absent the generator seeds a marker - numericalByStatus["not-run"] = 1,
 * reviewByStatus["not-reviewed"] = 1 - so the report emitted
 *
 *     ## 6. Numerical Validation
 *     Total scenarios: 0
 *     - not-run: 1
 *
 * One scenario not run, out of a declared total of zero. The 1 is a marker meaning "no evidence",
 * rendered in the same shape as a count, and it survives the removal of its own population. A
 * reader cannot tell it from arithmetic, and two figures from different sources sat under one
 * heading.
 *
 * At a total of zero the figures are therefore not printed as counts. The marker is still shown,
 * because suppressing it would hide which absence state the generator recorded, but it is labelled
 * as a marker. Removing the marker from the DATA belongs to am-cm-coverage-ledger-0ip; this is the
 * rendering not asserting arithmetic it does not have.
 */
function dimensionLines(
  heading: string,
  totalLabel: string,
  total: number,
  breakdown: Record<string, number>,
): string[] {
  const lines = [heading];
  const entries = Object.entries(breakdown);
  if (total === 0) {
    lines.push(`${totalLabel}: none measured.`);
    for (const [key, value] of entries) {
      lines.push(`- \`${key}\` is an absence marker (recorded as ${value}), not a count.`);
    }
    return lines;
  }
  lines.push(`${totalLabel}: ${total}`);
  for (const [key, value] of entries) lines.push(`- ${key}: ${value}`);
  return lines;
}

export function formatCoverageMarkdown(report: CoverageReport): string {
  const lines: string[] = [];

  lines.push(`# Annus Mirabilis Multi-Dimensional Coverage Ledger`);
  lines.push(``);
  lines.push(`- **Tool Run ID:** \`${report.logRunId}\``);
  lines.push(`- **Generated At:** ${report.generatedAt}`);
  lines.push(
    `- **Inputs:** ${report.inputs.length > 0 ? report.inputs.map((i) => `\`${i.path}\` (${i.sha256.slice(0, 8)})`).join(", ") : "None"}`,
  );
  lines.push(``);

  lines.push(
    ...dimensionLines(
      `## 1. Source Status`,
      "Total source units",
      report.sourceStatus.totalUnits,
      report.sourceStatus.byStatus,
    ),
  );
  lines.push(``);

  lines.push(
    ...dimensionLines(
      `## 2. Translation Review`,
      "Total translation units",
      report.translationReview.totalUnits,
      report.translationReview.byStatus,
    ),
  );
  lines.push(``);

  lines.push(
    ...dimensionLines(
      `## 3. Argument Treatment`,
      "Total argument nodes",
      report.argumentTreatment.totalNodes,
      report.argumentTreatment.byKind,
    ),
  );
  lines.push(``);

  lines.push(
    ...dimensionLines(
      `## 4. Instrument Availability`,
      "Total instruments",
      report.instrumentAvailability.totalInstruments,
      report.instrumentAvailability.byProvenance,
    ),
  );
  lines.push(``);

  lines.push(
    ...dimensionLines(
      `## 5. Accessibility Equivalence`,
      "Total nodes",
      report.accessibilityEquivalence.totalNodes,
      report.accessibilityEquivalence.byKind,
    ),
  );
  lines.push(``);

  lines.push(
    ...dimensionLines(
      `## 6. Numerical Validation`,
      "Total scenarios",
      report.numericalValidation.totalScenarios,
      report.numericalValidation.byStatus,
    ),
  );
  lines.push(``);

  lines.push(
    ...dimensionLines(
      `## 7. Editorial Review Approval`,
      "Total review records",
      report.editorialReview.totalReviews,
      report.editorialReview.byStatus,
    ),
  );
  lines.push(``);

  return lines.join("\n");
}

/**
 * Writes JSON and Markdown coverage artifacts to outDir.
 */
export function writeCoverageReportArtifacts(
  report: CoverageReport,
  outDir = join(process.cwd(), "artifacts", "coverage"),
): { jsonPath: string; mdPath: string } {
  mkdirSync(outDir, { recursive: true });
  const jsonPath = join(outDir, `${report.logRunId}.json`);
  const mdPath = join(outDir, `${report.logRunId}.md`);

  writeFileSync(jsonPath, `${JSON.stringify(report, null, 2)}\n`, "utf8");
  writeFileSync(mdPath, `${formatCoverageMarkdown(report)}\n`, "utf8");

  return { jsonPath, mdPath };
}
