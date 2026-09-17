/**
 * Registered-check inventory (am-cm-audit-scripts-d34).
 * A check registered but absent from the committed inventory, or inventoried
 * but not registered, is an error. The gate cannot quietly lose a family.
 */

import { registerPrintCoverageCheck } from "../../platform/print/printCoverage.ts";
import { registerEpistemicChecks } from "../checks/epistemic/register.ts";
import { registerI18nCheck } from "../checks/i18n/check.ts";
import { registerStructuralChecks } from "../checks/structural/structural.ts";
import { registerVoiceCheck } from "../checks/voice/check.ts";
import { listRegisteredChecks } from "../compiler/checks/registry.ts";
import { registerCoverageCheck } from "../coverage/check.ts";
import { registerKernelBindingCheck } from "../kernel/check.ts";
import { registerSourceManifestCheck } from "../manifest/check.ts";
import type { AuditFinding } from "./types.ts";

export type InventoriedCheck = Readonly<{
  id: string;
  family: string;
}>;

export function registerVerifyContentChecks(): void {
  registerStructuralChecks();
  registerSourceManifestCheck();
  registerVoiceCheck();
  registerPrintCoverageCheck();
  registerKernelBindingCheck();
  registerCoverageCheck();
  registerI18nCheck();
  registerEpistemicChecks();
}

export function compareCheckInventory(
  inventoried: readonly InventoriedCheck[],
  registered: readonly { readonly id: string; readonly family: string }[] = listRegisteredChecks(),
): readonly AuditFinding[] {
  const findings: AuditFinding[] = [];
  const inventoriedIds = new Map(inventoried.map((item) => [item.id, item.family]));
  const registeredIds = new Map(registered.map((item) => [item.id, item.family]));

  for (const [id, family] of registeredIds) {
    if (!inventoriedIds.has(id)) {
      findings.push({
        check: "check-not-inventoried",
        family: "compiler",
        severity: "error",
        recordId: id,
        message: `Check "${id}" (family ${family}) is registered but missing from scripts/verify-content.checks.json.`,
      });
    }
  }
  for (const [id, family] of inventoriedIds) {
    if (!registeredIds.has(id)) {
      findings.push({
        check: "check-missing",
        family: "compiler",
        severity: "error",
        recordId: id,
        message: `Inventoried check "${id}" (family ${family}) is not registered.`,
      });
    } else if (registeredIds.get(id) !== family) {
      const actualFamily = registeredIds.get(id);
      findings.push({
        check: "check-family-mismatch",
        family: "compiler",
        severity: "error",
        recordId: id,
        expected: family,
        ...(actualFamily !== undefined ? { actual: actualFamily } : {}),
        message: `Inventoried family for "${id}" is ${family}; registered family is ${actualFamily}.`,
      });
    }
  }
  return findings;
}
