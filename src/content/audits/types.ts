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

/**
 * How much of the audit's subject was judged against the full rule.
 *
 * An audit that reports "0 errors" says nothing about how many records it looked at, and both of
 * these audits carry a not-yet-auditable list whose entries have their failures downgraded to
 * flags. Without this a reader cannot tell 24 of 24 from 21 of 24, which is the licence inventory's
 * "72 of 79 evaluated against a settled rights position" in a different gate.
 */
export type AuditPopulation = Readonly<{
  /** Records the audit's input contained. */
  total: number;
  /** Records judged against the full rule. */
  judged: number;
  /** Records whose failures are recorded as not yet auditable, with a reason and a deletion condition. */
  notYetAuditable: number;
}>;

export type AuditReport = Readonly<{
  audit: string;
  ok: boolean;
  errorCount: number;
  flagCount: number;
  findings: readonly AuditFinding[];
  skipped?: readonly string[];
  population?: AuditPopulation;
}>;

export function summarize(
  audit: string,
  findings: readonly AuditFinding[],
  population?: AuditPopulation,
): AuditReport {
  const errorCount = findings.filter((f) => f.severity === "error").length;
  const flagCount = findings.filter((f) => f.severity === "flag").length;

  /**
   * An audit that judged nothing has not passed (am-1hst).
   *
   * `ok` used to be `errorCount === 0` alone, so a declared population of zero produced a
   * clean verdict: no records, therefore no findings, therefore no errors, therefore ok. The
   * prose was already honest about it - populationLine says "no records to judge." - so the
   * two halves of the same report DISAGREED. A person reading the printed line saw the truth
   * and a script reading `ok` never saw that sentence at all. The prose is correct and is not
   * touched here; the defect was entirely in the boolean.
   *
   * THE undefined BRANCH IS DELIBERATELY UNCHANGED, because it is a different proposition.
   * An audit that declares NO population has made no claim about how much it looked at, and
   * most of them do not: twelve of the fourteen callers pass no population at all. An audit
   * that declares a population OF ZERO has made a claim, and the claim is that it judged
   * nothing. Only the second is a failed audit. Treating them alike would turn every
   * population-free audit red and would be a rewrite rather than a fix.
   */
  const declaredNothingToJudge = population !== undefined && population.total === 0;

  return Object.freeze({
    audit,
    ok: errorCount === 0 && !declaredNothingToJudge,
    errorCount,
    flagCount,
    findings,
    ...(population === undefined ? {} : { population }),
  });
}

/** The population sentence, or null when the audit did not declare one. */
export function populationLine(report: AuditReport): string | null {
  const p = report.population;
  if (p === undefined) return null;
  if (p.total === 0) return `${report.audit} audit: no records to judge.`;
  const tail =
    p.notYetAuditable === 0
      ? "none recorded as not yet auditable"
      : `${p.notYetAuditable} recorded as not yet auditable`;
  return `${report.audit} audit: ${p.judged} of ${p.total} records judged against the full rule, ${tail}.`;
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
