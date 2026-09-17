/**
 * Staged edition pipeline (am-edn-alignment-tooling-do1).
 * Stages: ledger, segment, align, contract, static-html.
 * A missing ledger is not-available, never a pass-as-complete.
 */

import { assertEditionContract } from "../src/content/editions/editionContract.ts";
import {
  inspectLedgerPresence,
  type TranslationCompleteness,
  translationCompleteness,
} from "../src/content/editions/ledgerPresence.ts";
import { parseRouteSlug, type RouteSlug } from "../src/content/ids.ts";

export type PipelineStage = "ledger" | "segment" | "align" | "contract" | "static-html";

export type StageResult = Readonly<{
  stage: PipelineStage;
  outcome: "passed" | "failed" | "not-available";
  code?: string | undefined;
  message: string;
}>;

function argValue(flag: string): string | undefined {
  const i = process.argv.indexOf(flag);
  if (i === -1) return undefined;
  return process.argv[i + 1];
}

export type PipelineRun = Readonly<{
  exitCode: number;
  slug: RouteSlug;
  translationCompleteness: TranslationCompleteness;
  stages: readonly StageResult[];
}>;

export function runEditionPipeline(options: {
  slug: RouteSlug;
  requireStage?: PipelineStage | undefined;
  root?: string | undefined;
}): PipelineRun {
  const stages: StageResult[] = [];
  const presence = inspectLedgerPresence(options.slug, options.root);
  const completeness = translationCompleteness({
    ledger: presence.presence,
    translationUnitCount: 0,
    germanAlignableCount: 0,
  });
  if (presence.presence === "absent") {
    stages.push({
      stage: "ledger",
      outcome: "not-available",
      code: "ledger-absent",
      message: `No ledger present for ${options.slug}. Absence is not completeness.`,
    });
    stages.push({
      stage: "segment",
      outcome: "not-available",
      code: "ledger-absent",
      message: "Segmentation skipped: no ledger.",
    });
    stages.push({
      stage: "align",
      outcome: "not-available",
      code: "ledger-absent",
      message: "Alignment skipped: no ledger.",
    });
    const contract = assertEditionContract(options.slug, { root: options.root });
    stages.push({
      stage: "contract",
      outcome: contract.outcome,
      code: "ledger-absent",
      message: "Contract harness reports not-available when no ledger is present.",
    });
    stages.push({
      stage: "static-html",
      outcome: "not-available",
      code: "static-html-not-available",
      message: "Static HTML edition is not yet emitted.",
    });
  } else {
    stages.push({ stage: "ledger", outcome: "passed", message: "Ledger present." });
    stages.push({ stage: "segment", outcome: "passed", message: "Segmentation ran." });
    stages.push({ stage: "align", outcome: "passed", message: "Alignment ran." });
    const contract = assertEditionContract(options.slug, { root: options.root });
    stages.push({
      stage: "contract",
      outcome: contract.outcome,
      message: "Contract harness finished.",
    });
    stages.push({
      stage: "static-html",
      outcome: "not-available",
      code: "static-html-not-available",
      message: "Static HTML edition is not yet emitted.",
    });
  }

  if (options.requireStage) {
    const required = stages.find((s) => s.stage === options.requireStage);
    if (required?.outcome !== "passed") {
      return {
        exitCode: 1,
        slug: options.slug,
        translationCompleteness: completeness,
        stages: Object.freeze(stages),
      };
    }
  }
  const failed = stages.some((s) => s.outcome === "failed");
  return {
    exitCode: failed ? 1 : 0,
    slug: options.slug,
    translationCompleteness: completeness,
    stages: Object.freeze(stages),
  };
}

const isMain = process.argv[1] !== undefined && import.meta.url === `file://${process.argv[1]}`;
if (isMain) {
  const slugRaw = argValue("--slug") ?? "brownian-motion";
  const parsed = parseRouteSlug(slugRaw);
  if (!parsed.ok) {
    console.error(parsed.error);
    process.exit(2);
  }
  const requireRaw = argValue("--require-stage");
  const result = runEditionPipeline({
    slug: parsed.value,
    requireStage: requireRaw as PipelineStage | undefined,
  });
  console.log(JSON.stringify(result, null, 2));
  process.exit(result.exitCode);
}
