/**
 * AN AUDIT EXEMPTION IS A DEBT WITH A CEILING, NOT A STANDING PERMISSION (am-unwired-audits-uwot).
 *
 * `verify-content` records items an audit cannot yet judge and downgrades their findings to flags,
 * which is how a real gap stays visible without a red gate refusing every release. It already
 * guards the obvious failure: an exemption whose findings have all disappeared becomes an error, so
 * the map cannot outlive its reason. Moved here from scripts/verify-content.ts, where nothing could
 * test it, because that file exports nothing.
 *
 * WHAT IT DID NOT GUARD, and the reason this module exists. The key is an ITEM, so once an item is
 * exempted every finding against it is silenced, including findings that arrive later. The
 * exemption is a budget with no ceiling, which is AGENTS.md's "A baseline is the record of a debt,
 * not a budget to draw on" in a different costume.
 *
 * Measured 2026-10-09 against the instrument exemptions recorded on 2026-09-19, whose reasons each
 * state the number of findings they were recorded for:
 *
 *   item                      recorded   today
 *   avogadro-lab                     5       7
 *   light-thread                     5       6
 *   shelf-fizeau                     5       6
 *   shelf-maxwell-galilean           5       6
 *   shelf-michelson-morley           5       6
 *   lq-09                            3       1
 *   sr-04                            3       1
 *   me-01                            2       1
 *   sr-01                            2       1
 *   me-03                            1       1
 *
 * Five grew and four were paid down, and nothing reported either. The five that grew are the ones
 * that matter: new findings against an already-exempted item were indistinguishable from the ones
 * the exemption was written for.
 *
 * So an exemption may now carry `findings`, the count it is recorded for, and exceeding it is an
 * error naming both numbers. A bare string stays a string and behaves exactly as before, so the
 * three other audits' maps are untouched and adopt the ceiling when someone measures them.
 */

import { type AuditFinding, type AuditReport, summarize } from "./types.ts";

/** A reason alone, or a reason with the number of findings it was recorded for. */
export type AuditExemption = string | Readonly<{ reason: string; findings: number }>;

export const exemptionReason = (exemption: AuditExemption): string =>
  typeof exemption === "string" ? exemption : exemption.reason;

/** The ceiling, where one is recorded. `undefined` means this exemption carries no ceiling yet. */
export const exemptionCeiling = (exemption: AuditExemption): number | undefined =>
  typeof exemption === "string" ? undefined : exemption.findings;

/**
 * Downgrade findings against recorded items to flags, and raise an error for any recorded item that
 * no longer has findings or that now has MORE than it was recorded for.
 *
 * The two error halves are deliberately different shapes. A disappeared debt means the exemption is
 * stale and should be deleted; a grown debt means work has gone in under cover of an exemption
 * written for something else, and the number has to be re-measured and the growth accounted for.
 * Neither is a reason to delete the entry quietly.
 */
export function applyAuditExemptions(
  auditName: string,
  report: AuditReport,
  exemptions: ReadonlyMap<string, AuditExemption>,
  keyOf: (finding: AuditFinding) => string | undefined,
  /** Records the audit's input held. Reported so "0 errors" cannot be read as "all of them". */
  populationTotal: number,
): AuditReport {
  const covered = new Set<string>();
  const counts = new Map<string, number>();
  const out: AuditFinding[] = [];
  for (const finding of report.findings) {
    const key = keyOf(finding);
    const exemption = key === undefined ? undefined : exemptions.get(key);
    if (key !== undefined && exemption !== undefined) {
      covered.add(key);
      counts.set(key, (counts.get(key) ?? 0) + 1);
      out.push({
        ...finding,
        severity: "flag",
        message: `${finding.message} [recorded as not yet auditable: ${exemptionReason(exemption)}]`,
      });
    } else {
      out.push(finding);
    }
  }
  for (const [key, exemption] of exemptions) {
    const reason = exemptionReason(exemption);
    if (!covered.has(key)) {
      out.push({
        check: "stale-audit-exemption",
        family: "audit",
        severity: "error",
        recordId: key,
        message: `${key} is recorded as not yet auditable, but the ${auditName} audit now reports nothing against it. Delete its entry and this reason: ${reason}`,
      });
      continue;
    }
    const ceiling = exemptionCeiling(exemption);
    const actual = counts.get(key) ?? 0;
    if (ceiling !== undefined && actual > ceiling) {
      out.push({
        check: "grown-audit-exemption",
        family: "audit",
        severity: "error",
        recordId: key,
        message: `${key} is recorded as not yet auditable for ${ceiling} ${auditName} finding(s) and now has ${actual}. An exemption records a debt, not a budget: account for the ${actual - ceiling} new finding(s) before raising the number. Recorded reason: ${reason}`,
      });
    }
  }
  return summarize(auditName, out, {
    total: populationTotal,
    judged: Math.max(0, populationTotal - exemptions.size),
    notYetAuditable: exemptions.size,
  });
}
