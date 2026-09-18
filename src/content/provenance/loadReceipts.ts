/**
 * Loads and validates provenance receipts from `docs/provenance/`.
 * Emits typed SourceAsset records, PinnedAsset records for audit,
 * and structured audit findings.
 *
 * Spec: AGENTS.md, docs/editorial/RECEIPT_FORMAT.md, am-src-receipt-format-npo5
 */

import fs from "node:fs";
import path from "node:path";
import type { PinnedAsset } from "../audits/pinnedAssets.ts";
import { type AuditFinding, type AuditReport, summarize } from "../audits/types.ts";
import { type CheckResult, checkReceipt } from "./checkReceipt.ts";
import type { Receipt } from "./receiptSchema.ts";
import { receiptToSourceAsset, type SourceAsset } from "./receiptToSourceAsset.ts";

export interface LoadReceiptsOptions {
  readonly provenanceDir?: string | undefined;
  readonly configDir?: string | undefined;
  readonly rootDir?: string | undefined;
  readonly requireLocal?: boolean | undefined;
}

export interface LoadedProvenanceReceipt {
  readonly key: string;
  readonly filePath: string;
  readonly receipt?: Receipt | undefined;
  readonly sourceAsset?: SourceAsset | undefined;
  readonly pinnedAsset?: PinnedAsset | undefined;
  readonly checkResult: CheckResult;
}

export interface ProvenanceLoadResult {
  readonly ok: boolean;
  readonly receipts: readonly LoadedProvenanceReceipt[];
  readonly sourceAssets: ReadonlyMap<string, SourceAsset>;
  readonly pinnedAssets: readonly PinnedAsset[];
  readonly findings: readonly AuditFinding[];
  readonly report: AuditReport;
}

export function loadProvenanceReceipts(options: LoadReceiptsOptions = {}): ProvenanceLoadResult {
  const provenanceDir = options.provenanceDir ?? path.resolve("docs/provenance");
  const findings: AuditFinding[] = [];
  const loadedReceipts: LoadedProvenanceReceipt[] = [];
  const sourceAssets = new Map<string, SourceAsset>();
  const pinnedAssets: PinnedAsset[] = [];

  if (!fs.existsSync(provenanceDir)) {
    const report = summarize("audit-provenance-receipts", findings);
    return Object.freeze({
      ok: true,
      receipts: Object.freeze(loadedReceipts),
      sourceAssets,
      pinnedAssets: Object.freeze(pinnedAssets),
      findings: Object.freeze(findings),
      report,
    });
  }

  const entries = fs.readdirSync(provenanceDir);
  const receiptFiles = entries.filter((f) => f.endsWith(".md") && !f.startsWith(".")).sort();

  for (const f of receiptFiles) {
    const fullPath = path.join(provenanceDir, f);
    const stat = fs.statSync(fullPath);
    if (!stat.isFile()) continue;

    const content = fs.readFileSync(fullPath, "utf8");
    const checkResult = checkReceipt(content, fullPath, {
      requireLocal: options.requireLocal,
      configDir: options.configDir,
      rootDir: options.rootDir,
    });

    for (const err of checkResult.errors) {
      findings.push({
        check: err.rule,
        family: "audit",
        severity: "error",
        recordId: checkResult.key,
        ownerBeadId: "am-src-receipt-format-npo5",
        message: `${err.path}: ${err.message}`,
        ...(err.expected !== undefined ? { expected: err.expected } : {}),
        ...(err.actual !== undefined ? { actual: err.actual } : {}),
      });
    }

    for (const fl of checkResult.flags) {
      findings.push({
        check: fl.rule,
        family: "audit",
        severity: "flag",
        recordId: checkResult.key,
        ownerBeadId: "am-src-receipt-format-npo5",
        message: `${fl.path}: ${fl.message}`,
        ...(fl.expected !== undefined ? { expected: fl.expected } : {}),
        ...(fl.actual !== undefined ? { actual: fl.actual } : {}),
      });
    }

    let sourceAsset: SourceAsset | undefined;
    let pinnedAsset: PinnedAsset | undefined;

    if (checkResult.receipt) {
      sourceAsset = receiptToSourceAsset(checkResult.receipt);
      sourceAssets.set(checkResult.key, sourceAsset);

      const scan = checkResult.receipt.frontMatter.scan;
      const assetPath = scan.path ?? "";
      pinnedAsset = {
        id: checkResult.key,
        path: assetPath,
        publicationDecision: scan.publicationDecision,
      };
      pinnedAssets.push(pinnedAsset);
    }

    loadedReceipts.push(
      Object.freeze({
        key: checkResult.key,
        filePath: fullPath,
        receipt: checkResult.receipt,
        sourceAsset,
        pinnedAsset,
        checkResult,
      }),
    );
  }

  const report = summarize("audit-provenance-receipts", findings);
  const ok = findings.every((f) => f.severity !== "error");

  return Object.freeze({
    ok,
    receipts: Object.freeze(loadedReceipts),
    sourceAssets,
    pinnedAssets: Object.freeze(pinnedAssets),
    findings: Object.freeze(findings),
    report,
  });
}
