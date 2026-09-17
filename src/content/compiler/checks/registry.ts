/**
 * Check Plugin Registry for the content compiler.
 * Allows checks across the 16 declared check families to register and run against indexed content.
 *
 * Spec: AGENTS.md and am-cm-compiler-core-oa7
 */

export const DECLARED_CHECK_FAMILIES = [
  "compiler",
  "structural",
  "semantic",
  "epistemic",
  "manifest",
  "dimension",
  "coverage",
  "readings",
  "audit",
  "anachronism",
  "exports",
  "i18n",
  "ids",
  "schema",
  "notation",
  "voice",
] as const;

export type CheckFamily = (typeof DECLARED_CHECK_FAMILIES)[number];

export type CheckSeverity = "error" | "flag";

export interface CheckReportItem {
  recordId?: string | undefined;
  file?: string | undefined;
  path?: string | undefined;
  rule?: string | undefined;
  message: string;
  repair?: string | undefined;
  flaggedText?: string | undefined;
  contentHash?: string | undefined;
  /** Stable SHA-256 fingerprint for review flags and tracking: SHA256(rule:recordId:flaggedText) */
  fingerprint?: string | undefined;
  /** Overrides the check's default severity for this item. */
  severity?: CheckSeverity | undefined;
}

export interface CheckContext {
  records: Map<string, unknown>;
  files: readonly { path: string; text: string }[];
  indexes: unknown;
  report: (item: CheckReportItem) => void;
}

export interface ContentCheck {
  id: string;
  family: CheckFamily;
  severity: CheckSeverity;
  beadId?: string | undefined;
  description?: string | undefined;
  run: (context: CheckContext) => void | Promise<void>;
}

export interface CheckDiagnostic {
  severity: CheckSeverity;
  code: string;
  checkId: string;
  family: CheckFamily;
  beadId?: string | undefined;
  message: string;
  recordId?: string | undefined;
  file?: string | undefined;
  path?: string | undefined;
  rule?: string | undefined;
  repair?: string | undefined;
  flaggedText?: string | undefined;
  contentHash?: string | undefined;
  /** Stable SHA-256 fingerprint for review flags and tracking: SHA256(rule:recordId:flaggedText) */
  fingerprint?: string | undefined;
  stack?: string | undefined;
}

const registry = new Map<string, ContentCheck>();

/**
 * Registers a content check with the compiler.
 * Rejects any family outside the 16 declared families.
 */
export function registerCheck(check: ContentCheck): void {
  if (!DECLARED_CHECK_FAMILIES.includes(check.family)) {
    throw new Error(
      `Invalid check family "${check.family}". Declared families are: ${DECLARED_CHECK_FAMILIES.join(", ")}`,
    );
  }
  if (!check.id || typeof check.id !== "string") {
    throw new Error("Check id must be a non-empty string.");
  }
  if (check.severity !== "error" && check.severity !== "flag") {
    throw new Error(`Invalid check severity "${check.severity}": must be "error" or "flag".`);
  }
  registry.set(check.id, check);
}

/**
 * Unregisters a check by id (useful for testing).
 */
export function unregisterCheck(id: string): boolean {
  return registry.delete(id);
}

/**
 * Returns a read-only list of all currently registered content checks.
 */
export function listRegisteredChecks(): readonly ContentCheck[] {
  return Array.from(registry.values());
}

/**
 * Clears the check registry (for test isolation).
 */
export function clearRegisteredChecksForTests(): void {
  registry.clear();
}

/**
 * Runs all registered checks against the given context.
 * Implements crash containment: a crashing check is recorded as `check-crashed`
 * and does not halt subsequent checks.
 */
export async function runAllChecks(
  context: Omit<CheckContext, "report">,
): Promise<{ diagnostics: CheckDiagnostic[]; passed: boolean }> {
  const diagnostics: CheckDiagnostic[] = [];

  for (const check of Array.from(registry.values())) {
    const report = (item: CheckReportItem): void => {
      diagnostics.push({
        severity: item.severity ?? check.severity,
        code: item.rule ?? check.id,
        checkId: check.id,
        family: check.family,
        beadId: check.beadId,
        message: item.message,
        recordId: item.recordId,
        file: item.file,
        path: item.path ?? item.file ?? check.id,
        rule: item.rule ?? check.id,
        repair: item.repair,
        flaggedText: item.flaggedText,
        contentHash: item.contentHash,
        fingerprint: item.fingerprint,
      });
    };

    try {
      await check.run({ ...context, report });
    } catch (err: unknown) {
      const error = err instanceof Error ? err : new Error(String(err));
      diagnostics.push({
        severity: "error",
        code: "check-crashed",
        checkId: check.id,
        family: check.family,
        beadId: check.beadId ?? "am-cm-compiler-core-oa7",
        message: `Check "${check.id}" crashed: ${error.message}`,
        stack: error.stack,
        file: "compiler",
        path: check.id,
        rule: "check-crashed",
      });
    }
  }

  const passed = !diagnostics.some((d) => d.severity === "error");
  return { diagnostics, passed };
}
