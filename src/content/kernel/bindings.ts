import { existsSync } from "node:fs";
import { resolve } from "node:path";
import type { IdentifierBinding, KernelFunctionRef } from "../schemas/experiment.ts";
import type { ExtractedKernelSource, KernelIssue } from "./types.ts";
import { KERNEL_DISPLAY_ROLE_LABELS, MAX_TRACE_ROWS } from "./types.ts";

export function kernelFunctionName(k: KernelFunctionRef): string | undefined {
  return k.exportName ?? k.fnName;
}

export function validateDisplayRole(
  instrumentId: string,
  kernel: KernelFunctionRef,
  extracted?: ExtractedKernelSource,
): KernelIssue[] {
  const issues: KernelIssue[] = [];
  const name = kernelFunctionName(kernel) ?? "(unnamed)";
  const role = kernel.displayRole;
  if (!(role in KERNEL_DISPLAY_ROLE_LABELS)) {
    issues.push({
      code: "invalid-kernel-display-role",
      instrumentId,
      functionName: name,
      message: `Kernel function "${name}" has invalid displayRole "${String(role)}".`,
    });
    return issues;
  }
  const execFields = [kernel.module, kernel.crate, kernel.path, kernel.fnName, kernel.revision];
  const hasExecField = execFields.some((v) => typeof v === "string" && v.length > 0);
  if (role === "pseudocode" || role === "derivation") {
    if (hasExecField || extracted?.sourceHash) {
      issues.push({
        code: "pseudocode-with-exec-fields",
        instrumentId,
        functionName: name,
        message: `Kernel function "${name}" with displayRole "${role}" must not declare module, crate, path, fnName, revision, or a source hash.`,
      });
    }
    return issues;
  }
  if (role === "executing-source" || role === "reference-implementation") {
    if (kernel.language === "ts") {
      if (!kernel.module || !kernel.exportName) {
        issues.push({
          code: "missing-ts-kernel-fields",
          instrumentId,
          functionName: name,
          message: `TypeScript kernel "${name}" with displayRole "${role}" requires module and exportName.`,
        });
      }
    } else if (kernel.language === "rust") {
      if (!kernel.crate || !kernel.path || !kernel.fnName || !kernel.revision) {
        issues.push({
          code: "missing-rust-kernel-fields",
          instrumentId,
          functionName: name,
          message: `Rust kernel "${name}" with displayRole "${role}" requires crate, path, fnName, and revision.`,
        });
      }
    } else {
      issues.push({
        code: "missing-kernel-language",
        instrumentId,
        functionName: name,
        message: `Kernel "${name}" requires language "ts" or "rust".`,
      });
    }
    if (!extracted?.revision) {
      issues.push({
        code: "missing-kernel-revision",
        instrumentId,
        functionName: name,
        message: `Kernel "${name}" with displayRole "${role}" is missing a revision.`,
      });
    }
    if (!extracted?.sourceHash) {
      issues.push({
        code: "missing-kernel-source-hash",
        instrumentId,
        functionName: name,
        message: `Kernel "${name}" with displayRole "${role}" is missing a pinned source hash.`,
      });
    }
  }
  return issues;
}

export function checkIdentifierBindings(options: {
  instrumentId: string;
  kernels: readonly KernelFunctionRef[];
  bindings: readonly IdentifierBinding[];
  extracted: ReadonlyMap<string, ExtractedKernelSource>;
}): KernelIssue[] {
  const issues: KernelIssue[] = [];
  const declared = new Set(
    options.kernels.map(kernelFunctionName).filter((n): n is string => typeof n === "string"),
  );
  for (const binding of options.bindings) {
    if (!declared.has(binding.kernelFunction)) {
      issues.push({
        code: "undeclared-kernel-function",
        instrumentId: options.instrumentId,
        functionName: binding.kernelFunction,
        identifier: binding.identifier,
        quantityId: binding.quantityId,
        message: `Instrument ${options.instrumentId}: binding for "${binding.identifier}" names kernelFunction "${binding.kernelFunction}", which is not a declared kernelFunctions[] entry.`,
      });
      continue;
    }
    const source = options.extracted.get(binding.kernelFunction);
    if (!source) {
      issues.push({
        code: "kernel-source-unextracted",
        instrumentId: options.instrumentId,
        functionName: binding.kernelFunction,
        identifier: binding.identifier,
        quantityId: binding.quantityId,
        message: `Instrument ${options.instrumentId}: kernel "${binding.kernelFunction}" has no extracted source for identifier "${binding.identifier}".`,
      });
      continue;
    }
    if (!source.identifiers.includes(binding.identifier)) {
      issues.push({
        code: "identifier-absent-from-kernel",
        instrumentId: options.instrumentId,
        functionName: binding.kernelFunction,
        identifier: binding.identifier,
        quantityId: binding.quantityId,
        message: `Instrument ${options.instrumentId}: identifier "${binding.identifier}" for quantity "${binding.quantityId}" does not occur in pinned kernel source of "${binding.kernelFunction}".`,
      });
    }
  }
  return issues;
}

export function checkLiveTermBindings(options: {
  instrumentId: string;
  liveTerms: readonly string[];
  bindings: readonly IdentifierBinding[];
  extracted: ReadonlyMap<string, ExtractedKernelSource>;
}): KernelIssue[] {
  const issues: KernelIssue[] = [];
  for (const quantityId of options.liveTerms) {
    const matches = options.bindings.filter((b) => b.quantityId === quantityId);
    if (matches.length === 0) {
      issues.push({
        code: "live-term-unbound",
        instrumentId: options.instrumentId,
        quantityId,
        message: `Instrument ${options.instrumentId}: live term quantity id "${quantityId}" has no identifier binding in any listed kernel function.`,
      });
      continue;
    }
    const occurs = matches.some((b) => {
      const source = options.extracted.get(b.kernelFunction);
      return !!source && source.identifiers.includes(b.identifier);
    });
    if (!occurs) {
      issues.push({
        code: "live-term-identifier-missing",
        instrumentId: options.instrumentId,
        quantityId,
        identifier: matches[0]?.identifier,
        functionName: matches[0]?.kernelFunction,
        message: `Instrument ${options.instrumentId}: live term quantity id "${quantityId}" does not appear as an identifier binding in its pinned kernel source.`,
      });
    }
  }
  return issues;
}

export function checkPinnedHash(options: {
  instrumentId: string;
  functionName: string;
  expectedHash: string;
  actualHash: string;
}): KernelIssue[] {
  if (options.expectedHash === options.actualHash) return [];
  return [
    {
      code: "kernel-hash-drift",
      instrumentId: options.instrumentId,
      functionName: options.functionName,
      oldHash: options.expectedHash,
      newHash: options.actualHash,
      message: `Instrument ${options.instrumentId}: kernel "${options.functionName}" source hash drifted. Pinned ${options.expectedHash}; extracted ${options.actualHash}. Update the pin in the same commit as the kernel change.`,
    },
  ];
}

export function checkIndependentReferences(
  root: string,
  instrumentId: string,
  refs: readonly Readonly<{ experimentId: string; quantityId: string }>[],
): KernelIssue[] {
  const issues: KernelIssue[] = [];
  for (const ref of refs) {
    const rel = `content/verification/${ref.experimentId}/${ref.quantityId}.yaml`;
    if (!existsSync(resolve(root, rel))) {
      issues.push({
        code: "dangling-independent-reference",
        instrumentId,
        quantityId: ref.quantityId,
        message: `Instrument ${instrumentId}: independentReferences entry ${ref.experimentId}/${ref.quantityId} does not resolve to ${rel}.`,
      });
    }
  }
  return issues;
}

export function checkTraceRowCount(
  instrumentId: string,
  functionName: string,
  rowCount: number,
): KernelIssue[] {
  if (rowCount <= MAX_TRACE_ROWS) return [];
  return [
    {
      code: "trace-rows-exceeded",
      instrumentId,
      functionName,
      message: `Instrument ${instrumentId}: trace for "${functionName}" declares ${rowCount} rows, exceeding the ${MAX_TRACE_ROWS}-row cap.`,
    },
  ];
}

export function checkTraceScenario(
  instrumentId: string,
  traceScenarioId: string | undefined,
  registered: readonly string[],
): KernelIssue[] {
  if (!traceScenarioId) return [];
  if (registered.includes(traceScenarioId)) return [];
  return [
    {
      code: "unregistered-trace-scenario",
      instrumentId,
      message: `Instrument ${instrumentId}: traceScenarioId "${traceScenarioId}" is not a registered scenario of this instrument.`,
    },
  ];
}
