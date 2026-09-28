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
import { SLICE_KERNEL_CATALOG } from "./catalog.ts";
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
  // AN INSTRUMENT THAT DECLARES NO ARGUMENTS CLAIMS NO EQUATION LIVE TERMS (am-1nnj).
  //
  // The filter below skipped an equation only when argumentIds was non-empty, so an instrument with
  // an EMPTY list skipped nothing and inherited every equation quantity in the corpus as its own
  // live terms. The absent declaration failed OPEN, which is backwards for a check whose purpose is
  // catching an unbound term.
  //
  // Measured 2026-09-28 with verify-content widened to all 33 manifests: exactly four instruments
  // declare no argumentIds (bm-02, lq-03, lq-04, sr-04) and exactly those four carried 433 of the
  // 538 findings, with 104 of their unbound terms shared by all four ACROSS PAPERS, so sr-04, a
  // relativity instrument, was charged with avogadroConstant and bodyMassBefore.
  //
  // Returning nothing here is honest rather than lenient: the manifest declares nothing to derive
  // from, so there is nothing to claim. runKernelIdentifierCheck reports the missing declaration
  // separately, so the gap is visible instead of silently unchecked.
  if (argumentIds.length === 0) return [];
  const ids = new Set<string>();
  for (const rec of records.values()) {
    if (!rec || typeof rec !== "object") continue;
    const r = rec as Record<string, unknown>;
    if (r.kind !== "equation") continue;
    // A reading-only equation has no live terms (AGENTS.md scopes this rule to live terms). The
    // exemption needs BOTH the explicit flag and no bindings: the parser refuses a flagged record
    // that binds an output, and this condition keeps such a record audited even if it got past.
    if (r.live === false && Array.isArray(r.bindings) && r.bindings.length === 0) continue;
    if (typeof r.argument === "string" && !argumentIds.includes(r.argument)) continue;
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
    // The instrument declares kernels but no arguments, so liveTermsFromRecords has nothing to
    // derive its live terms from and returns none (am-1nnj). That is the honest answer and it is
    // also a hole, so it is reported rather than passed over: without this line the four
    // instruments in that state would be silently exempt from the live-term half of this check,
    // which is the same failure shape, one layer further in.
    if (!Array.isArray(rec.argumentIds) || rec.argumentIds.length === 0) {
      context.report({
        recordId: instrumentId,
        rule: "instrument-declares-no-arguments",
        message:
          `Instrument ${instrumentId} declares kernelFunctions but no argumentIds, so its live ` +
          "terms cannot be derived and the live-term half of this check cannot run for it. Declare " +
          "the arguments this instrument interrogates. (am-1nnj)",
      });
    }
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

    // BOTH SOURCES OF A BINDING, BECAUSE THERE ARE TWO AND THEY DRIFT (am-1nnj, dispatch 358).
    //
    // A binding is written in the manifest, `owner.identifierBindings`, which is what everything
    // above this line reads; and in SLICE_KERNEL_CATALOG, which is what verify.ts turns into
    // src/generated/kernel-listings.json and therefore what colours a symbol for a reader. Measured
    // at HEAD across sr-* and me-* on 2026-09-28: 14 bindings in the manifests only, 34 in the
    // catalogue only, 54 in both. A live-term check that read one source would have called 34 terms
    // unbound that a reader already sees coloured, or 14 bound that the gate's own record does not
    // carry. Neither number is small and neither is visible from one side.
    //
    // So the live-term half of this check asks the union: does ANY source bind this quantity. The
    // bindings above are still checked against the manifest alone, because a manifest binding that
    // names an absent identifier is the manifest's defect, and the catalogue's own copies are
    // audited by auditKernelBindings over the same extracted sources.
    const catalogueEntries = SLICE_KERNEL_CATALOG.filter((e) => e.instrumentId === instrumentId);
    const liveTermBindings = [
      ...bindings,
      ...catalogueEntries.flatMap((entry) => entry.identifierBindings),
    ];
    const liveTermExtracted = new Map(extracted);
    for (const entry of catalogueEntries) {
      const name = entry.kernel.exportName;
      if (name === undefined || liveTermExtracted.has(name)) continue;
      if (entry.kernel.language !== "ts" || entry.kernel.module === undefined) continue;
      try {
        liveTermExtracted.set(
          name,
          extractTypeScriptExport({
            root,
            modulePath: entry.kernel.module,
            exportName: name,
            revision: entry.kernel.revision ?? "catalogue",
          }),
        );
      } catch {
        // A catalogue kernel that will not extract is auditKernelBindings' finding, reported there
        // against the catalogue it belongs to. Reporting it again here would name the instrument
        // twice for one defect, and swallowing it cannot hide it: the other gate runs on the same
        // sources in the same lane.
      }
    }

    for (const issue of checkLiveTermBindings({
      instrumentId,
      liveTerms,
      bindings: liveTermBindings,
      extracted: liveTermExtracted,
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
