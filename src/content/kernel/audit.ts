/**
 * Audit for kernel identifier bindings and slice manifests (am-inst-show-the-code-4brv).
 */

import { resolve } from "node:path";
import { type AuditFinding, type AuditReport, summarize } from "../audits/types.ts";
import { type KernelPinFile, verifySliceKernels } from "./verify.ts";

export function auditKernelBindings(
  root = process.cwd(),
  revision = "workspace",
  options?: {
    pinsPath?: string | undefined;
    pins?: KernelPinFile | undefined;
    checkCommitted?: boolean | undefined;
    gitRunner?: ((args: readonly string[]) => string) | undefined;
  },
): AuditReport {
  const pinsPath = options?.pinsPath ?? resolve(root, "src/content/kernel/pins.json");
  const result = verifySliceKernels({
    root,
    revision,
    pinsPath,
    ...(options?.pins !== undefined ? { pins: options.pins } : {}),
    ...(options?.checkCommitted !== undefined ? { checkCommitted: options.checkCommitted } : {}),
    ...(options?.gitRunner !== undefined ? { gitRunner: options.gitRunner } : {}),
  });

  const findings: AuditFinding[] = result.issues.map((issue) => ({
    check: issue.code,
    family: "audit",
    severity: "error",
    message: issue.message,
    recordId: issue.instrumentId,
    ownerBeadId: "am-inst-show-the-code-4brv",
  }));

  return summarize("audit-kernel-bindings", findings);
}
