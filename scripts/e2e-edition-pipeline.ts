/**
 * Staged edition pipeline (am-edn-alignment-tooling-do1).
 *
 * Nine stages in the order the bead specifies: ledger, reconcile, ids, digests,
 * compile, align, contract, coverage, static-html. Each one calls the owner it
 * names and reports what that owner found.
 *
 * WHAT THIS REPLACES (am-06x1's defect class, found here on 2026-09-19). The
 * ledger-present branch of this script used to push three literal results:
 *
 *   stages.push({ stage: "ledger",  outcome: "passed", message: "Ledger present." });
 *   stages.push({ stage: "segment", outcome: "passed", message: "Segmentation ran." });
 *   stages.push({ stage: "align",   outcome: "passed", message: "Alignment ran." });
 *
 * "Segmentation ran" was written by a line that ran no segmentation. Nothing
 * caught it because no ledger is on disk for any of the five papers, so that
 * branch was unreachable in production and untested: every case in
 * e2e-edition-pipeline.test.ts went down the ledger-absent branch.
 *
 * A stage that cannot do its work reports not-available with the reason. A stage
 * that does part of its work reports that part and lists the rest in `pending`
 * with the bead that owns it, so a pass can never be read as covering work that
 * was not done.
 */

import { existsSync, mkdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { load as parseYaml } from "js-yaml";
import { compileReadingContent } from "../src/content/compiler/compile.ts";
import {
  coverageReport,
  coverageReportIsHonest,
  coverageReportJson,
  coverageReportMarkdown,
} from "../src/content/editions/coverageReport.ts";
import { assertEditionContract } from "../src/content/editions/editionContract.ts";
import {
  inspectLedgerPresence,
  PAPER_BIB_KEYS,
  type TranslationCompleteness,
  translationCompleteness,
} from "../src/content/editions/ledgerPresence.ts";
import { germanAlignableIds, segmentLedger } from "../src/content/editions/segmentLedger.ts";
import { parseRouteSlug, type RouteSlug } from "../src/content/ids.ts";
import { validateLedger } from "../src/content/ledger/validateLedger.ts";
import { validateSourceManifest } from "../src/content/manifest/schema.ts";
import { newRunIdentity, TestLogger } from "../src/testing/log/logger.ts";
import { runAlignEditions } from "./align-editions.ts";
import { loadReadingFiles } from "./build-content.ts";

export const PIPELINE_STAGES = [
  "ledger",
  "reconcile",
  "ids",
  "digests",
  "compile",
  "align",
  "contract",
  "coverage",
  "static-html",
] as const;

export type PipelineStage = (typeof PIPELINE_STAGES)[number];

export type StageResult = Readonly<{
  stage: PipelineStage;
  outcome: "passed" | "failed" | "not-available";
  code?: string | undefined;
  message: string;
  /** Work this stage did NOT do, each entry naming the bead that owns it. */
  pending?: readonly string[] | undefined;
  /** Findings kept as evidence when the stage failed. */
  evidence?: readonly string[] | undefined;
  durationMs: number;
}>;

export type PipelineRun = Readonly<{
  exitCode: number;
  slug: RouteSlug;
  translationCompleteness: TranslationCompleteness;
  stages: readonly StageResult[];
  logPath?: string | undefined;
}>;

/**
 * The sentence-unit ruling this pipeline stops at.
 *
 * src/content/manifest/types.ts has no `sentence` kind, so a proposed sentence
 * has no manifest unit to reconcile against. Block-level reconciliation is real
 * and runs; sentence-level reconciliation is not performed and is never counted
 * as performed. The decision belongs to am-xz2d and the owner, not to this file.
 */
export const SENTENCE_UNIT_RULING =
  "sentence-level reconciliation: the manifest format has no sentence kind (am-xz2d decision 1, owner ruling pending)";

/** Control-flow marker for an empty corpus; never surfaced as a compiler error. */
/**
 * The corpus loaded but held nothing to check.
 *
 * Carries a code as its first constructor argument, per the owner's ruling on am-p465
 * ("Positional code argument"). It threw with no arguments at all before, so nothing naming the
 * refusal reached a reader or the scanner.
 */
class EmptyCorpusError extends Error {
  readonly code: string;
  constructor(code: string, message = "The corpus contains no records to check.") {
    super(message);
    this.name = "EmptyCorpusError";
    this.code = code;
  }
}

function argValue(flag: string): string | undefined {
  const i = process.argv.indexOf(flag);
  if (i === -1) return undefined;
  return process.argv[i + 1];
}

function loadManifestUnitIds(root: string, slug: RouteSlug): readonly string[] | null {
  const manifestPath = join(root, `content/source-blocks/${slug}/manifest.yaml`);
  if (!existsSync(manifestPath)) return null;
  try {
    const manifest = validateSourceManifest(
      parseYaml(readFileSync(manifestPath, "utf8")),
      manifestPath,
    );
    return manifest.units.map((unit) => unit.id);
  } catch {
    return null;
  }
}

export async function runEditionPipeline(options: {
  slug: RouteSlug;
  requireStage?: PipelineStage | undefined;
  root?: string | undefined;
  layers?: readonly string[] | undefined;
  sections?: readonly string[] | undefined;
  requireReviewed?: boolean | undefined;
  logger?: TestLogger | undefined;
}): Promise<PipelineRun> {
  const root = options.root ?? process.cwd();
  const slug = options.slug;
  const layers = options.layers ?? ["german"];
  const stages: StageResult[] = [];
  const started = new Map<PipelineStage, number>();

  const push = (
    stage: PipelineStage,
    outcome: StageResult["outcome"],
    message: string,
    extra?: {
      code?: string | undefined;
      pending?: readonly string[] | undefined;
      evidence?: readonly string[] | undefined;
    },
  ): void => {
    const begin = started.get(stage) ?? Date.now();
    stages.push({
      stage,
      outcome,
      message,
      ...(extra?.code !== undefined ? { code: extra.code } : {}),
      ...(extra?.pending !== undefined ? { pending: extra.pending } : {}),
      ...(extra?.evidence !== undefined ? { evidence: extra.evidence } : {}),
      durationMs: Date.now() - begin,
    });
  };
  const begin = (stage: PipelineStage): void => {
    started.set(stage, Date.now());
  };

  // ---------------------------------------------------------------- 1. ledger
  begin("ledger");
  const presence = inspectLedgerPresence(slug, root);
  let ledgerText: string | null = null;
  if (presence.presence === "absent") {
    push("ledger", "not-available", `No ledger present for ${slug} at ${presence.path}.`, {
      code: "ledger-absent",
    });
  } else {
    try {
      ledgerText = readFileSync(join(root, presence.path), "utf8");
      // The receipt that governs this ledger is the one in the root under test, not the one
      // in the process's working directory. validateLedger otherwise resolves it from cwd,
      // so a run against another root would reconcile page counts against a receipt that
      // describes a different document.
      const receiptPath = join(root, `docs/provenance/${PAPER_BIB_KEYS[slug]}.md`);
      const validation = validateLedger(join(root, presence.path), {
        content: ledgerText,
        ...(existsSync(receiptPath) ? { receiptPath } : {}),
      });
      const errors = validation.errors.map((e) => `${e.code ?? "error"}: ${e.message}`);
      if (errors.length > 0) {
        push("ledger", "failed", `Ledger is not clean: ${errors.slice(0, 3).join("; ")}`, {
          code: "ledger-not-clean",
          evidence: errors,
        });
      } else {
        push("ledger", "passed", `Ledger at ${presence.path} validated clean.`);
      }
    } catch (err: unknown) {
      push("ledger", "failed", `Reading or validating the ledger threw: ${String(err)}`, {
        code: "ledger-unreadable",
      });
    }
  }

  // ------------------------------------------------------------- 2. reconcile
  begin("reconcile");
  const manifestIds = loadManifestUnitIds(root, slug);
  let germanIds: readonly string[] = [];
  if (ledgerText === null) {
    push("reconcile", "not-available", "Reconciliation skipped: no ledger to segment.", {
      code: "ledger-absent",
      pending: [SENTENCE_UNIT_RULING],
    });
  } else if (manifestIds === null) {
    push(
      "reconcile",
      "not-available",
      `No manifest at content/source-blocks/${slug}/manifest.yaml to reconcile the proposal against.`,
      { code: "manifest-absent", pending: [SENTENCE_UNIT_RULING] },
    );
  } else {
    const segmented = segmentLedger({ ledgerText, frozenIds: manifestIds });
    if (segmented.status === "absent") {
      push("reconcile", "not-available", segmented.message, {
        code: segmented.code,
        pending: [SENTENCE_UNIT_RULING],
      });
    } else {
      germanIds = germanAlignableIds(segmented.blocks);
      const differences = segmented.differences;
      const detail = differences.map((d) => `${d.kind} ${d.unitId}: ${d.message}`);
      if (differences.length > 0) {
        push(
          "reconcile",
          "failed",
          `${differences.length} unresolved difference(s) between the ledger proposal and the manifest: ${detail
            .slice(0, 3)
            .join("; ")}`,
          {
            code: "reconciliation-differences",
            evidence: detail,
            pending: [SENTENCE_UNIT_RULING],
          },
        );
      } else {
        push(
          "reconcile",
          "passed",
          `${segmented.blocks.length} proposed block(s) reconcile with ${manifestIds.length} manifest unit(s) with no unresolved difference.`,
          { pending: [SENTENCE_UNIT_RULING] },
        );
      }
    }
  }

  // ------------------------------------------- 3 & 4 & 7. contract-owned stages
  const contract = assertEditionContract(slug, {
    root,
    ...(ledgerText !== null ? { ledgerText } : {}),
  });
  const checkOf = (n: number) => contract.checks.find((c) => c.checkNumber === n);

  begin("ids");
  const idCheck = checkOf(6);
  push(
    "ids",
    idCheck?.outcome ?? "not-available",
    idCheck?.message ?? "Contract check 6 produced no result.",
    { ...(idCheck?.code !== undefined ? { code: idCheck.code } : {}) },
  );

  begin("digests");
  const digestCheck = checkOf(1);
  push(
    "digests",
    digestCheck?.outcome ?? "not-available",
    digestCheck?.message ?? "Contract check 1 produced no result.",
    { ...(digestCheck?.code !== undefined ? { code: digestCheck.code } : {}) },
  );

  // --------------------------------------------------------------- 5. compile
  begin("compile");
  try {
    if (!existsSync(join(root, "content"))) {
      // A root with no content directory has no records to compile. loadReadingFiles
      // throws ENOENT here, and reporting that as a compiler failure would blame the
      // compiler for an absent corpus.
      push("compile", "not-available", `No content directory at ${join(root, "content")}.`, {
        code: "content-corpus-absent",
      });
      throw new EmptyCorpusError("corpus-empty");
    }
    const files = await loadReadingFiles(root);
    if (files.length === 0) {
      // Compiling an empty corpus succeeds trivially. A pass here would say the
      // paper's records are sound when none were read, which is the defect this
      // rewrite removes, so an empty corpus is not-available.
      push("compile", "not-available", `No content records found under ${join(root, "content")}.`, {
        code: "content-corpus-absent",
      });
      throw new EmptyCorpusError("corpus-empty");
    }
    const compiled = compileReadingContent(files);
    const errors = compiled.diagnostics.filter((d) => d.severity === "error");
    if (errors.length > 0) {
      push("compile", "failed", `Content compiler reported ${errors.length} error(s).`, {
        code: "compile-errors",
        evidence: errors.map((d) => `${d.code} ${d.path}: ${d.message}`),
      });
    } else {
      push(
        "compile",
        "passed",
        `Content compiler accepted ${files.length} file(s) and produced ${compiled.papers.length} paper payload(s).`,
      );
    }
  } catch (err: unknown) {
    if (err instanceof EmptyCorpusError) {
      // RECORD THE ABORT'S OWN CODE RATHER THAN DISCARDING IT. This catch used to swallow the
      // refusal whole: it discriminated the deliberate abort by class and never read `err.code`,
      // so the code existed for no reader. That is the flattened-refusal class - a catch that
      // keeps less than it caught - and it is the same defect as a catch collapsing several named
      // conditions into one generic code, just smaller.
      //
      // The stage already pushed says WHY the corpus is absent. This says WHICH refusal stopped
      // the stage, and it amends that record rather than adding a second one, because the abort's
      // whole purpose is that the compiler is never asked and never blamed twice.
      const last = stages.at(-1);
      if (last?.stage === "compile") {
        stages[stages.length - 1] = {
          ...last,
          evidence: [...(last.evidence ?? []), `aborted-by: ${err.code}`],
        };
      }
    } else {
      push("compile", "failed", `The content compiler threw: ${String(err)}`, {
        code: "compile-threw",
      });
    }
  }

  // ----------------------------------------------------------------- 6. align
  begin("align");
  if (germanIds.length === 0) {
    push(
      "align",
      "not-available",
      "Alignment skipped: no German alignable units were segmented, so there is nothing to align.",
      { code: "no-german-units" },
    );
  } else {
    const aligned = runAlignEditions({
      slug,
      root,
      layers,
      ...(options.sections !== undefined ? { sections: options.sections } : {}),
      ...(options.requireReviewed !== undefined
        ? { requireReviewed: options.requireReviewed }
        : {}),
    });
    const issues = aligned.issues.map((i) => `${i.code}: ${i.message}`);
    if (aligned.ok) {
      push("align", "passed", `Alignment validated ${germanIds.length} German unit(s).`);
    } else {
      push(
        "align",
        "failed",
        `Alignment reported ${issues.length} issue(s): ${issues.slice(0, 3).join("; ")}`,
        {
          code: aligned.issues[0]?.code ?? "alignment-issues",
          evidence: issues,
        },
      );
    }
  }

  // -------------------------------------------------------------- 7. contract
  begin("contract");
  const failedChecks = contract.checks.filter((c) => c.outcome === "failed");
  const perPaperTests = ["edition", "translation", "gloss", "review"].map(
    (kind) => `src/content/editions/<paperFile>.${kind}.test.ts`,
  );
  push(
    "contract",
    contract.outcome,
    failedChecks.length > 0
      ? `Edition contract failed ${failedChecks.length} check(s): ${failedChecks
          .map((c) => `#${c.checkNumber} ${c.code ?? c.check}`)
          .join("; ")}`
      : `Edition contract reported ${contract.checks.filter((c) => c.outcome === "passed").length} passed and ${contract.checks.filter((c) => c.outcome === "not-available").length} not-available.`,
    {
      evidence: failedChecks.map((c) => `#${c.checkNumber} ${c.code ?? c.check}: ${c.message}`),
      pending: [
        `per-paper edition test files do not exist in this tree (${perPaperTests.join(", ")}); this stage runs assertEditionContract and does not run bun test (am-edn-alignment-tooling-do1)`,
      ],
    },
  );

  // -------------------------------------------------------------- 8. coverage
  begin("coverage");
  const report = coverageReport({
    slug,
    germanUnitCount: germanIds.length,
    translationUnitCount: 0,
    root,
  });
  const markdown = coverageReportMarkdown(report);
  const json = coverageReportJson(report);
  const coverageDir = join(root, "artifacts/edition-coverage", slug);
  const coverageRunId = newRunIdentity();
  mkdirSync(coverageDir, { recursive: true });
  const coverageJsonPath = join(coverageDir, `${coverageRunId}.json`);
  const coverageMarkdownPath = join(coverageDir, `${coverageRunId}.md`);
  writeFileSync(coverageJsonPath, json);
  writeFileSync(coverageMarkdownPath, markdown);
  // Section F: the report carries no percentage, score, or aggregate completeness figure.
  // coverageReportIsHonest owns that rule, and the stage fails when the file it has just
  // written breaks it instead of reporting that a report was written and stopping there.
  if (coverageReportIsHonest(markdown, json)) {
    push(
      "coverage",
      "passed",
      `Coverage report written to ${coverageJsonPath} and ${coverageMarkdownPath}: ledger ${report.ledger}, translation ${report.translation}, no aggregate figure.`,
    );
  } else {
    push(
      "coverage",
      "failed",
      `The coverage report written to ${coverageMarkdownPath} carries a percentage, score, or aggregate completeness figure.`,
      { code: "coverage-report-not-honest", evidence: [coverageJsonPath, coverageMarkdownPath] },
    );
  }

  // ----------------------------------------------------------- 9. static-html
  begin("static-html");
  const outDir = join(root, "out");
  const readerRoute = join(outDir, "papers", slug, "index.html");
  if (!existsSync(readerRoute)) {
    push(
      "static-html",
      "not-available",
      `No prerendered reader page at out/papers/${slug}/index.html, so the emitted HTML cannot be scanned.`,
      { code: "static-html-not-available" },
    );
  } else {
    const html = readFileSync(readerRoute, "utf8");
    const markers = [
      { name: "ledger page marker", pattern: /---\s*REVIEWED\s+TRANSCRIPTION\s+PAGE\s+\d+/ },
      { name: "raw LaTeX delimiter", pattern: /\$\$|\\\[/ },
    ].filter((m) => m.pattern.test(html));
    if (markers.length > 0) {
      push(
        "static-html",
        "failed",
        `Emitted HTML carries ${markers.map((m) => m.name).join(", ")}.`,
        {
          code: "static-html-furniture",
          evidence: markers.map((m) => m.name),
        },
      );
    } else {
      push(
        "static-html",
        "passed",
        `Emitted reader page ${readerRoute} (last written ${statSync(readerRoute).mtime.toISOString()}) carries no ledger furniture or raw LaTeX.`,
        {
          pending: [
            "whether out/ was built from the current commit is not checked here, and a scan of stale output is a scan of stale output (build freshness belongs to am-rel-verified-deploy-qndt)",
          ],
        },
      );
    }
  }

  // ------------------------------------------------------------------ logging
  const logger = options.logger ?? new TestLogger("edition-pipeline");
  for (const stage of stages) {
    logger.log({
      testId: `${slug}:${stage.stage}`,
      paper: slug,
      outcome: stage.outcome,
      durationMs: stage.durationMs,
      message: stage.message,
      ...(stage.code !== undefined ? { extra: { code: stage.code } } : {}),
    });
  }
  await logger.flush();

  // Failure evidence is retained beside the log, never deleted by this script.
  const evidenceRoot = join(dirname(logger.filePath), logger.logRunId, "evidence");
  for (const stage of stages) {
    if (stage.outcome !== "failed" || stage.evidence === undefined) continue;
    const file = join(evidenceRoot, stage.stage, "findings.json");
    mkdirSync(dirname(file), { recursive: true });
    writeFileSync(
      file,
      JSON.stringify({ slug, stage: stage.stage, findings: stage.evidence }, null, 2),
    );
  }

  const completeness = translationCompleteness({
    ledger: presence.presence,
    translationUnitCount: 0,
    germanAlignableCount: germanIds.length,
  });

  if (options.requireStage) {
    const required = stages.find((s) => s.stage === options.requireStage);
    if (required?.outcome !== "passed") {
      return {
        exitCode: 1,
        slug,
        translationCompleteness: completeness,
        stages: Object.freeze(stages),
        logPath: logger.filePath,
      };
    }
  }
  const failed = stages.some((s) => s.outcome === "failed");
  return {
    exitCode: failed ? 1 : 0,
    slug,
    translationCompleteness: completeness,
    stages: Object.freeze(stages),
    logPath: logger.filePath,
  };
}

const isMain = process.argv[1] !== undefined && import.meta.url === `file://${process.argv[1]}`;
if (isMain) {
  const slugRaw = argValue("--paper") ?? argValue("--slug") ?? "brownian-motion";
  const parsed = parseRouteSlug(slugRaw);
  if (!parsed.ok) {
    console.error(parsed.error);
    process.exit(2);
  }
  const requireRaw = argValue("--require-stage");
  const layersRaw = argValue("--layers");
  const sectionsRaw = argValue("--sections");
  const result = await runEditionPipeline({
    slug: parsed.value,
    ...(requireRaw !== undefined ? { requireStage: requireRaw as PipelineStage } : {}),
    ...(layersRaw !== undefined ? { layers: layersRaw.split(",") } : {}),
    ...(sectionsRaw !== undefined ? { sections: sectionsRaw.split(",") } : {}),
    requireReviewed: process.argv.includes("--require-reviewed"),
  });
  console.log(JSON.stringify(result, null, 2));
  for (const stage of result.stages) {
    console.log(`${stage.stage.padEnd(12)} ${stage.outcome.padEnd(14)} ${stage.durationMs}ms`);
  }
  process.exit(result.exitCode);
}
