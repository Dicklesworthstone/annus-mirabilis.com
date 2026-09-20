/**
 * Evaluate Collected License Items Against License Policy.
 * Bead: am-gov-license-inventory-w6yz
 */

import { checkSpdxExpression } from "./spdx.ts";
import type {
  EvaluatedItem,
  EvaluationResult,
  LicenseItem,
  LicensePolicy,
  PolicyViolation,
} from "./types.ts";

export function versionMatchesRange(version: string, range?: string): boolean {
  if (!range || range === "*" || range === "any") return true;
  if (version === range || version === "unknown") return true;
  if (range.startsWith("^")) {
    const rMaj = range.slice(1).split(".")[0];
    const vMaj = version.split(".")[0];
    return rMaj === vMaj;
  }
  if (range.startsWith("~")) {
    const rParts = range.slice(1).split(".");
    const vParts = version.split(".");
    return rParts[0] === vParts[0] && rParts[1] === vParts[1];
  }
  // A bare range is a version PREFIX BY DOTTED SEGMENT, not by characters
  // (am-avyr). `version.startsWith(range)` admitted 1.10.0 under a bare 1.1,
  // and 2.15.3 under 2.1, because "1.10.0" does begin with the characters
  // "1.1". A policy exception is a decision about which versions a licence
  // finding was reviewed against, so admitting a version nobody reviewed is
  // the failure direction that matters.
  //
  // Latent rather than live: docs/license-policy.yaml carries only ^2.0.0 and
  // *, both handled above, so nothing reaches this line today. The first bare
  // range written into that file is what makes it live.
  const rangeParts = range.split(".");
  const versionParts = version.split(".");
  if (rangeParts.length > versionParts.length) return false;
  return rangeParts.every((part, i) => part === versionParts[i]);
}

export function evaluatePolicy(
  items: readonly LicenseItem[],
  policy: LicensePolicy,
): EvaluationResult {
  const errors: PolicyViolation[] = [];
  const evaluatedItems: EvaluatedItem[] = [];

  const allowlist = policy.allowlist || [];
  const exceptions = policy.exceptions || [];

  // Validate exceptions first: an exception without a reason or reviewer is itself a failure
  for (const exc of exceptions) {
    if (!exc.reason || exc.reason.trim().length === 0) {
      errors.push({
        item: {
          kind: "npm",
          name: exc.package || "unknown",
          version: exc.versionRange || "*",
          license: "POLICY-EXCEPTION-INVALID",
          source: "docs/license-policy.yaml",
        },
        rule: "exception-missing-reason",
        message: `License exception for '${exc.package}' is missing a required 'reason'.`,
      });
    }
    if (!exc.reviewer || exc.reviewer.trim().length === 0) {
      errors.push({
        item: {
          kind: "npm",
          name: exc.package || "unknown",
          version: exc.versionRange || "*",
          license: "POLICY-EXCEPTION-INVALID",
          source: "docs/license-policy.yaml",
        },
        rule: "exception-missing-reviewer",
        message: `License exception for '${exc.package}' is missing a required 'reviewer'.`,
      });
    }
  }

  for (const item of items) {
    // 1. Tool items (devDependencies): exempt from failing the production gate
    if (item.kind === "tool") {
      evaluatedItems.push({
        item,
        outcome: "exempt",
        ruleApplied: "dev-dependency-tool-exemption",
        notes: "Build/test tool dependency; excluded from production artifact checks.",
      });
      continue;
    }

    // 2. Production items (npm, font, vendored, donor, wasm)
    if (item.license === "PENDING-OWNER-RULING") {
      evaluatedItems.push({
        item,
        outcome: "exempt",
        ruleApplied: "known-donor-gap",
        ...(item.authorOrNotice !== undefined ? { notes: item.authorOrNotice } : {}),
      });
      continue;
    }

    if (item.license === "UNATTRIBUTED-DONOR-EXTRACTION") {
      const msg =
        item.authorOrNotice ||
        `Donor extraction at '${item.source}' is missing required attribution header.`;
      errors.push({
        item,
        rule: "unattributed-donor-extraction",
        message: msg,
      });
      evaluatedItems.push({
        item,
        outcome: "failed",
        ruleApplied: "unattributed-donor-extraction",
        notes: msg,
      });
      continue;
    }

    if (!item.license || item.license === "UNKNOWN" || item.license === "UNLICENSED") {
      const chainInfo =
        item.dependencyChain && item.dependencyChain.length > 1
          ? ` (dependency chain: ${item.dependencyChain.join(" -> ")})`
          : "";
      const msg = `Missing license metadata for production ${item.kind} '${item.name}' version '${item.version}' at '${item.source}'${chainInfo}.`;
      errors.push({
        item,
        rule: "missing-license-metadata",
        message: msg,
      });
      evaluatedItems.push({
        item,
        outcome: "failed",
        ruleApplied: "missing-license-metadata",
        notes: msg,
      });
      continue;
    }

    // Check SPDX expression against allowlist
    const spdxResult = checkSpdxExpression(item.license, allowlist);

    if (spdxResult.allowed) {
      evaluatedItems.push({
        item,
        outcome: "passed",
        ruleApplied: `allowlist:${item.license}`,
      });
      continue;
    }

    // If not allowed, check for reviewed exceptions
    let matchedException = false;
    for (const exc of exceptions) {
      if (exc.reason && exc.reviewer && exc.package === item.name) {
        if (versionMatchesRange(item.version, exc.versionRange)) {
          matchedException = true;
          evaluatedItems.push({
            item,
            outcome: "passed",
            ruleApplied: `exception:${exc.package}@${exc.versionRange} (reviewed by ${exc.reviewer} on ${exc.date})`,
            notes: exc.reason,
          });
          break;
        }
      }
    }

    if (!matchedException) {
      const chainInfo =
        item.dependencyChain && item.dependencyChain.length > 1
          ? ` (dependency chain: ${item.dependencyChain.join(" -> ")})`
          : "";
      const failing = spdxResult.failingLicenses.join(", ");
      const msg = `License '${item.license}' (failing terms: [${failing}]) for production ${item.kind} '${item.name}' version '${item.version}' at '${item.source}' is not on the allowlist and has no reviewed exception${chainInfo}.`;
      errors.push({
        item,
        rule: "disallowed-license",
        message: msg,
      });
      evaluatedItems.push({
        item,
        outcome: "failed",
        ruleApplied: "disallowed-license",
        notes: msg,
      });
    }
  }

  return {
    valid: errors.length === 0,
    errors,
    evaluatedItems,
  };
}
