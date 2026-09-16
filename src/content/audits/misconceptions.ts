/**
 * Misconceptions audit (am-cm-audit-scripts-d34): at least five entries once
 * a ledger is declared or the paper is complete; every anchor, instrument
 * id, result id, and source must resolve.
 */

import { type AuditFinding, type AuditReport, summarize } from "./types.ts";

export type MisconceptionEntry = Readonly<{
  id: string;
  anchors: readonly string[];
  instrumentIds: readonly string[];
  resultIds: readonly string[];
  sources: readonly string[];
}>;

export type PaperMisconceptionLedger = Readonly<{
  paper: string;
  complete: boolean;
  ledgerDeclared: boolean;
  entries: readonly MisconceptionEntry[];
}>;

export type MisconceptionAuditInput = Readonly<{
  papers: readonly PaperMisconceptionLedger[];
  knownAnchors: ReadonlySet<string>;
  knownInstruments: ReadonlySet<string>;
  knownResults: ReadonlySet<string>;
  knownSources: ReadonlySet<string>;
}>;

export function auditMisconceptions(input: MisconceptionAuditInput): AuditReport {
  const findings: AuditFinding[] = [];

  for (const paper of input.papers) {
    const required = paper.complete || paper.ledgerDeclared;
    if (required && paper.entries.length < 5) {
      findings.push({
        check: "misconception-count",
        family: "audit",
        severity: "error",
        paper: paper.paper,
        recordId: paper.paper,
        expected: "at least 5",
        actual: String(paper.entries.length),
        message: `Paper ${paper.paper} is complete or has a declared ledger but has ${paper.entries.length} misconception entries.`,
      });
    }
    for (const entry of paper.entries) {
      for (const anchor of entry.anchors) {
        if (!input.knownAnchors.has(anchor)) {
          findings.push({
            check: "dangling-anchor",
            family: "audit",
            severity: "error",
            paper: paper.paper,
            recordId: entry.id,
            message: `Misconception ${entry.id} cites unknown anchor ${anchor}.`,
          });
        }
      }
      for (const instrumentId of entry.instrumentIds) {
        if (!input.knownInstruments.has(instrumentId)) {
          findings.push({
            check: "dangling-instrument",
            family: "audit",
            severity: "error",
            paper: paper.paper,
            recordId: entry.id,
            message: `Misconception ${entry.id} cites unknown instrument ${instrumentId}.`,
          });
        }
      }
      for (const resultId of entry.resultIds) {
        if (!input.knownResults.has(resultId)) {
          findings.push({
            check: "dangling-result",
            family: "audit",
            severity: "error",
            paper: paper.paper,
            recordId: entry.id,
            message: `Misconception ${entry.id} cites unknown result ${resultId}.`,
          });
        }
      }
      for (const source of entry.sources) {
        if (!input.knownSources.has(source)) {
          findings.push({
            check: "dangling-source",
            family: "audit",
            severity: "error",
            paper: paper.paper,
            recordId: entry.id,
            message: `Misconception ${entry.id} cites unknown source ${source}.`,
          });
        }
      }
    }
  }

  return summarize("audit-misconceptions", findings);
}
