import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { type Expression, walk } from "../../equations/ast.ts";
import { type CheckContext, registerCheck } from "../compiler/checks/registry.ts";
import type { IdentifierBinding, KernelFunctionRef } from "../schemas/experiment.ts";
import {
  checkIdentifierBindings,
  checkIndependentReferences,
  checkLiveTermBindings,
  checkTraceRowCount,
  checkTraceScenario,
  validateDisplayRole,
} from "./bindings.ts";
import { extractRustFunction } from "./extractRust.ts";
import { extractTypeScriptExport, KernelExtractionError } from "./extractTypeScript.ts";
import type { ExtractedKernelSource } from "./types.ts";
import { KERNEL_BEAD_ID, KERNEL_BINDING_CHECK_ID } from "./types.ts";

function quantityIdsFromTree(tree: unknown): string[] {
  if (!tree || typeof tree !== "object") return [];
  try {
    return walk(tree as Expression)
      .filter((n) => n.kind === "symbol")
      .map((n) => n.quantityId);
  } catch {
    return [];
  }
}

function asOwner(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object") return null;
  const rec = value as Record<string, unknown>;
  if (!rec.owner || typeof rec.owner !== "object") return null;
  return rec.owner as Record<string, unknown>;
}

export function liveTermsFromRecords(
  experiment: Record<string, unknown>,
  records: Map<string, unknown>,
): string[] {
  const argumentIds = Array.isArray(experiment.argumentIds)
    ? experiment.argumentIds.filter((id): id is string => typeof id === "string")
    : [];
  const ids = new Set<string>();
  for (const rec of records.values()) {
    if (!rec || typeof rec !== "object") continue;
    const r = rec as Record<string, unknown>;
    if (r.kind !== "equation") continue;
    if (
      argumentIds.length > 0 &&
      typeof r.argument === "string" &&
      !argumentIds.includes(r.argument)
    ) {
      continue;
    }
    for (const q of quantityIdsFromTree(r.tree)) ids.add(q);
  }
  return [...ids].sort();
}

export function runKernelIdentifierCheck(context: CheckContext, root = process.cwd()): void {
  for (const [key, value] of context.records.entries()) {
    const owner = asOwner(value);
    if (!owner) continue;
    const rec = value as Record<string, unknown>;
    const instrumentId = typeof rec.id === "string" ? rec.id : key;
    const kernels = Array.isArray(owner.kernelFunctions)
      ? (owner.kernelFunctions as KernelFunctionRef[])
      : [];
    if (kernels.length === 0) continue;
    const bindings = Array.isArray(owner.identifierBindings)
      ? (owner.identifierBindings as IdentifierBinding[])
      : [];
    const extracted = new Map<string, ExtractedKernelSource>();
    for (const kernel of kernels) {
      const name = kernel.exportName ?? kernel.fnName;
      if (kernel.displayRole !== "pseudocode" && kernel.displayRole !== "derivation" && name) {
        try {
          if (kernel.language === "ts" && kernel.module) {
            extracted.set(
              name,
              extractTypeScriptExport({
                root,
                modulePath: kernel.module,
                exportName: name,
                revision: kernel.revision ?? "unpinned",
              }),
            );
          } else if (kernel.language === "rust" && kernel.path) {
            const rustPath = resolve(root, kernel.path);
            extracted.set(
              name,
              extractRustFunction(readFileSync(rustPath, "utf8"), name, {
                filePath: kernel.path,
                revision: kernel.revision ?? "unpinned",
              }),
            );
          }
        } catch (err) {
          const message = err instanceof KernelExtractionError ? err.message : String(err);
          context.report({
            recordId: instrumentId,
            rule: "kernel-export-missing",
            message,
          });
        }
      }
      for (const issue of validateDisplayRole(
        instrumentId,
        kernel,
        name ? extracted.get(name) : undefined,
      )) {
        context.report({
          recordId: instrumentId,
          rule: issue.code,
          message: issue.message,
          repair: issue.repair,
        });
      }
      if (Array.isArray(kernel.independentReferences) && kernel.independentReferences.length > 0) {
        for (const issue of checkIndependentReferences(
          root,
          instrumentId,
          kernel.independentReferences as readonly Readonly<{
            experimentId: string;
            quantityId: string;
          }>[],
        )) {
          context.report({
            recordId: instrumentId,
            rule: issue.code,
            message: issue.message,
          });
        }
      }
    }
    for (const issue of checkIdentifierBindings({
      instrumentId,
      kernels,
      bindings,
      extracted,
    })) {
      context.report({
        recordId: instrumentId,
        rule: issue.code,
        message: issue.message,
        flaggedText: issue.quantityId,
      });
    }
    const liveTerms = liveTermsFromRecords(rec, context.records);
    for (const issue of checkLiveTermBindings({
      instrumentId,
      liveTerms,
      bindings,
      extracted,
    })) {
      context.report({
        recordId: instrumentId,
        rule: issue.code,
        message: issue.message,
        flaggedText: issue.quantityId,
      });
    }
    if (typeof owner.traceScenarioId === "string") {
      const registered = Array.isArray(rec.acceptanceCases)
        ? rec.acceptanceCases.filter((id): id is string => typeof id === "string")
        : [];
      if (typeof rec.defaultScenario === "string") registered.push(rec.defaultScenario);
      for (const issue of checkTraceScenario(instrumentId, owner.traceScenarioId, registered)) {
        context.report({ recordId: instrumentId, rule: issue.code, message: issue.message });
      }
    }
    if (Array.isArray(owner.traceRows)) {
      for (const issue of checkTraceRowCount(instrumentId, "owner", owner.traceRows.length)) {
        context.report({ recordId: instrumentId, rule: issue.code, message: issue.message });
      }
    }
  }
}

export function registerKernelBindingCheck(): void {
  registerCheck({
    id: KERNEL_BINDING_CHECK_ID,
    family: "audit",
    severity: "error",
    beadId: KERNEL_BEAD_ID,
    description:
      "An instrument whose live terms do not appear as identifiers in its pinned kernel source fails publication.",
    run: (context) => runKernelIdentifierCheck(context),
  });
}
