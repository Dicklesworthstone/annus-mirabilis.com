/**
 * Shared audit finding and report types (am-cm-audit-scripts-d34).
 * Reports never carry an aggregate score.
 */

export type AuditSeverity = "error" | "flag";

export type AuditFinding = Readonly<{
  check: string;
  family: "audit" | "readings" | "voice" | "compiler";
  severity: AuditSeverity;
  message: string;
  paper?: string;
  recordId?: string;
  targetKind?: string;
  ownerBeadId?: string;
  requirement?: string;
  expected?: string;
  actual?: string;
}>;

export type AuditReport = Readonly<{
  audit: string;
  ok: boolean;
  errorCount: number;
  flagCount: number;
  findings: readonly AuditFinding[];
  skipped?: readonly string[];
}>;

export function summarize(audit: string, findings: readonly AuditFinding[]): AuditReport {
  const errorCount = findings.filter((f) => f.severity === "error").length;
  const flagCount = findings.filter((f) => f.severity === "flag").length;
  return Object.freeze({
    audit,
    ok: errorCount === 0,
    errorCount,
    flagCount,
    findings,
  });
}

/** Error check codes only. Tests assert these, never message strings. */
export function errorCheckCodes(report: AuditReport): readonly string[] {
  return report.findings
    .filter((finding) => finding.severity === "error")
    .map((finding) => finding.check);
}

export function findingLine(finding: AuditFinding): string {
  const parts = [
    finding.severity.toUpperCase(),
    finding.check,
    finding.recordId,
    finding.ownerBeadId,
    finding.message,
  ].filter((part): part is string => typeof part === "string" && part.length > 0);
  return parts.join(": ");
}
