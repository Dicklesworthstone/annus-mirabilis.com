/**
 * Types for third-party license inventory and verification.
 * Bead: am-gov-license-inventory-w6yz
 */

export type LicenseItemKind = "npm" | "tool" | "font" | "vendored" | "donor" | "wasm";

export interface LicenseItem {
  readonly kind: LicenseItemKind;
  readonly name: string;
  readonly version: string;
  readonly license: string;
  readonly source: string;
  readonly licenseText?: string;
  readonly licensePath?: string;
  readonly authorOrNotice?: string;
  readonly dependencyChain?: readonly string[];
}

export interface LicenseException {
  readonly package: string;
  readonly versionRange: string;
  readonly reason: string;
  readonly reviewer: string;
  readonly date: string;
}

export interface LicensePolicy {
  readonly allowlist: readonly string[];
  readonly exceptions?: readonly LicenseException[];
}

export interface PolicyViolation {
  readonly item: LicenseItem;
  readonly rule: string;
  readonly message: string;
}

export interface EvaluatedItem {
  readonly item: LicenseItem;
  readonly outcome: "passed" | "failed" | "exempt";
  readonly ruleApplied: string;
  readonly notes?: string;
}

export interface EvaluationResult {
  readonly valid: boolean;
  readonly errors: readonly PolicyViolation[];
  readonly evaluatedItems: readonly EvaluatedItem[];
}

export interface StructuredLogEvent {
  readonly timestamp: string;
  readonly suite: "license-inventory";
  readonly logRunId: string;
  readonly testId: string;
  readonly beadId: "am-gov-license-inventory-w6yz";
  readonly kind: LicenseItemKind | "summary";
  readonly name: string;
  readonly version: string;
  readonly license: string;
  readonly source: string;
  readonly rule: string;
  readonly outcome: "passed" | "failed" | "exempt";
  readonly message: string;
  readonly extra?: Record<string, unknown>;
}

/**
 * How much of the inventory has actually been evaluated against a settled rights position.
 *
 * The check used to end with "Third-party license inventory check passed. (79 items evaluated)"
 * whenever no policy violation was found. Seven of those 79 were exempt under `known-donor-gap`,
 * which is the rule for a file whose rights position NOBODY HAS RULED ON. The exit code was right
 * and the sentence was not: "passed" is what a reader uses to conclude there is no open rights
 * question, and there were seven.
 *
 * The population is deliberately NOT narrowed to the settled 72. An open rights position that stops
 * being counted is worse than one reported as passed, because nothing then shows it exists. Every
 * item stays in `total`; what changes is the claim made about them.
 *
 * A settled position is one where a decision exists: an allowlisted licence, a reviewed exception,
 * or the dev-dependency rule, which is a rule someone decided rather than a question left open.
 */
export const PENDING_OWNER_RULING_RULE = "known-donor-gap";

export interface RightsPositionSummary {
  readonly total: number;
  readonly settled: number;
  readonly pendingOwnerRuling: number;
  readonly pendingNames: readonly string[];
}

export function summarizeRightsPositions(
  evaluatedItems: readonly EvaluatedItem[],
): RightsPositionSummary {
  const pending = evaluatedItems.filter((e) => e.ruleApplied === PENDING_OWNER_RULING_RULE);
  return {
    total: evaluatedItems.length,
    settled: evaluatedItems.length - pending.length,
    pendingOwnerRuling: pending.length,
    pendingNames: pending.map((e) => e.item.name),
  };
}

/** The lines the check prints when it finds no policy violation. */
export function formatInventorySummary(summary: RightsPositionSummary): string[] {
  // An inventory that measured nothing has established nothing, so it does not get a tick. The
  // original defect was a headline claiming more than the count beside it, and "passed. (0 items
  // evaluated)" is the same sentence with the count set to zero. Proven reachable end to end: a
  // root whose collectors find nothing and whose committed notices match that nothing printed the
  // tick and exited 0, which is how a broken collector reports a conformance it never measured.
  if (summary.total === 0) {
    return [
      "✖ Third-party license inventory: no items were evaluated.",
      "  The inventory found nothing to check, so nothing is established. A collector or the root",
      "  directory is wrong; an empty result is not a clean result.",
    ];
  }
  if (summary.pendingOwnerRuling === 0) {
    return [`✔ Third-party license inventory check passed. (${summary.total} items evaluated)`];
  }
  return [
    `✔ Third-party license inventory: no policy violations. (${summary.total} items)`,
    `  ${summary.settled} of ${summary.total} evaluated against a settled rights position.`,
    `  ${summary.pendingOwnerRuling} of ${summary.total} are exempt pending an owner ruling and were NOT evaluated against one:`,
    ...summary.pendingNames.map((n) => `      ${n}`),
    "  A pending ruling is an open rights position, not a failure, and not a pass either.",
    "  Owner decision: am-gov-decision-license-rights-tps",
  ];
}
