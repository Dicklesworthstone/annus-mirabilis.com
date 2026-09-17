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
