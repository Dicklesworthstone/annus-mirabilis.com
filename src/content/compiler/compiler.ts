/**
 * Core Content Compiler Pipeline.
 * Coordinates loading, schema validation, indexing, reference resolution,
 * check execution, review queue computation, and route payload construction.
 *
 * Spec: AGENTS.md and am-cm-compiler-core-oa7
 */

import type { EquationRecord } from "../../equations/record.ts";
import { registerPrintCoverageCheck } from "../../platform/print/printCoverage.ts";
import { registerEpistemicChecks } from "../checks/epistemic/register.ts";
import { registerStructuralChecks } from "../checks/structural/structural.ts";
import { registerVoiceCheck } from "../checks/voice/check.ts";
import { registerKernelBindingCheck } from "../kernel/check.ts";
import { registerSourceManifestCheck } from "../manifest/check.ts";
import {
  type Argument,
  type Citation,
  type Foundation,
  type Paper,
  READING_IDS,
  validateReadingRecord,
} from "../schemas/reading.ts";
import { type CheckFamily, listRegisteredChecks, runAllChecks } from "./checks/registry.ts";
import { buildContentIndexes, type ContentIndexes } from "./indexes.ts";
import { ContentError, checkFileSize, checkNfc, parseContentFile } from "./loaders.ts";
import {
  buildReviewQueue,
  type FlagReviewRecord,
  parseFlagReviews,
  type ReviewFlagItem,
  type ReviewQueueResult,
} from "./reviewQueue.ts";
import { matchContentRoute } from "./routes.ts";

export type DiagnosticSeverity = "error" | "flag" | "review";

export interface CompilerDiagnostic {
  readonly severity: DiagnosticSeverity;
  readonly code: string;
  readonly path: string;
  readonly message: string;
  readonly family?: CheckFamily | undefined;
  readonly checkId?: string | undefined;
  readonly beadId?: string | undefined;
  readonly file?: string | undefined;
  readonly recordId?: string | undefined;
  readonly rule?: string | undefined;
  readonly repair?: string | undefined;
  readonly flaggedText?: string | undefined;
  readonly contentHash?: string | undefined;
  readonly fingerprint?: string | undefined;
  readonly stack?: string | undefined;
}

export type PaperPayload = Readonly<{
  schemaVersion: 1;
  paper: Paper;
  arguments: readonly Argument[];
  foundations: readonly Foundation[];
  citations: readonly Citation[];
  equations: readonly EquationRecord[];
}>;

export interface CompilerOptions {
  readonly maxFileBytes?: number | undefined;
  readonly flagReviewsYaml?: string | undefined;
  readonly mathRenderer?: ((latex: string) => { html: string; mathml: string }) | undefined;
}

export interface CompilerPhaseDurations {
  readonly loadMs: number;
  readonly validateMs: number;
  readonly indexMs: number;
  readonly checkMs: number;
  readonly totalMs: number;
}

export interface CompileResult {
  readonly ok: boolean;
  readonly diagnostics: readonly CompilerDiagnostic[];
  readonly papers: readonly PaperPayload[];
  readonly foundations: readonly Foundation[];
  readonly indexes: ContentIndexes | null;
  readonly reviewQueue: ReviewQueueResult | null;
  readonly durations: CompilerPhaseDurations;
}

/**
 * Compiles all content files into validated models, indexes, diagnostics, and review queue.
 */
export async function compileContent(
  files: readonly Readonly<{ path: string; text: string }>[],
  options?: CompilerOptions,
): Promise<CompileResult> {
  const startTotal = performance.now();
  const diagnostics: CompilerDiagnostic[] = [];

  const addIssue = (
    severity: DiagnosticSeverity,
    code: string,
    path: string,
    message: string,
    extra?: Partial<CompilerDiagnostic>,
  ) => {
    diagnostics.push({
      severity,
      code,
      path,
      message,
      family: extra?.family ?? "compiler",
      rule: extra?.rule ?? code,
      ...extra,
    });
  };

  // =========================================================================
  // Phase 1: Load and Route
  // =========================================================================
  const startLoad = performance.now();
  const rawRecords = new Map<string, unknown>();
  const seenPaths = new Set<string>();
  let flagReviewsText = options?.flagReviewsYaml;

  // Sort files by path for deterministic compilation order
  const sortedFiles = [...files].sort((a, b) => (a.path < b.path ? -1 : a.path > b.path ? 1 : 0));

  for (const file of sortedFiles) {
    if (seenPaths.has(file.path)) {
      addIssue("error", "duplicate-path", file.path, "A content file was supplied more than once.");
      continue;
    }
    seenPaths.add(file.path);

    // Verify NFC and size budget
    try {
      checkNfc(file.text, file.path);
      checkFileSize(new TextEncoder().encode(file.text).length, file.path, options?.maxFileBytes);
    } catch (err) {
      if (err instanceof ContentError) {
        addIssue("error", err.code, err.path, err.message);
        continue;
      }
      throw err;
    }

    const routeMatch = matchContentRoute(file.path);
    if (!routeMatch) {
      addIssue(
        "error",
        "unrouted-content",
        file.path,
        `No schema owns this path: '${file.path}'. The content compiler rejects unrouted files.`,
      );
      continue;
    }

    // Allow documentation files without schema parsing
    if (routeMatch.kind === "documentation") {
      continue;
    }

    // Plain text snapshots
    if (routeMatch.kind === "frozen-id-snapshot") {
      rawRecords.set(`snapshot:${routeMatch.params.paper ?? file.path}`, {
        kind: "frozen-id-snapshot",
        id: `snapshot:${routeMatch.params.paper ?? file.path}`,
        text: file.text,
        file: file.path,
      });
      continue;
    }

    // Editorial flag reviews
    if (routeMatch.kind === "flag-reviews") {
      flagReviewsText = file.text;
      continue;
    }

    // Parse JSON/YAML
    try {
      const parsed = parseContentFile(file);
      const record = validateRecordContent(parsed, file.path, routeMatch.kind);
      const matchParams = routeMatch.params;

      // Identity validation: record ID matches path parameters
      if (record && typeof record === "object" && "id" in record) {
        const recId = String((record as { id: unknown }).id);
        const expectedId = matchParams.id ?? matchParams.slug;
        if (expectedId && recId !== expectedId) {
          throw new ContentError(
            "path-identity",
            file.path,
            `Record id '${recId}' disagrees with file path parameter '${expectedId}'.`,
          );
        }

        const recordKey =
          routeMatch.kind === "paper" ||
          routeMatch.kind === "argument" ||
          routeMatch.kind === "foundation" ||
          routeMatch.kind === "citation" ||
          routeMatch.kind === "equation"
            ? recId
            : `${routeMatch.kind}:${matchParams.paper ?? ""}:${recId}`;

        if (rawRecords.has(recordKey)) {
          addIssue("error", "duplicate-id", file.path, `Duplicate record id: ${recId}.`, {
            recordId: recId,
            file: file.path,
            repair: `Ensure record id "${recId}" is unique within its namespace.`,
            family: "structural",
          });
          continue;
        }
        rawRecords.set(recordKey, record);
      } else {
        // Record without explicit ID (e.g. quantity set or manifest)
        const syntheticId = `${routeMatch.kind}:${matchParams.slug ?? matchParams.paper ?? file.path}`;
        rawRecords.set(syntheticId, record);
      }
    } catch (e) {
      if (e instanceof ContentError) {
        addIssue("error", e.code, e.path, e.message);
      } else if (e instanceof Error) {
        addIssue("error", "invalid-content", file.path, e.message);
      } else {
        addIssue("error", "invalid-content", file.path, String(e));
      }
    }
  }
  const loadDuration = performance.now() - startLoad;

  // =========================================================================
  // Phase 2 & 3: Validate & Index
  // =========================================================================
  const startValidate = performance.now();
  const { indexes, errors: indexErrors } = buildContentIndexes(rawRecords);
  for (const err of indexErrors) {
    addIssue("error", err.code, err.path, err.message, { family: "structural" });
  }

  // Create standard review flags for draft content
  for (const r of rawRecords.values()) {
    if (r && typeof r === "object") {
      const rec = r as Record<string, unknown>;
      const recId = typeof rec.id === "string" ? rec.id : "";
      const kind = typeof rec.kind === "string" ? rec.kind : "";

      if (kind === "equation") {
        addIssue(
          "flag",
          "equation-review-pending",
          recId,
          "Modern teaching equation; historical notation and editorial review are not claimed.",
          {
            family: "notation",
            recordId: recId,
            rule: "equation-review-pending",
            flaggedText: typeof rec.title === "string" ? rec.title : undefined,
          },
        );
      } else if (kind === "argument" || kind === "foundation") {
        addIssue(
          "flag",
          "editorial-review-pending",
          recId,
          "Authored explanation; no human review is claimed.",
          {
            family: "readings",
            recordId: recId,
            rule: "editorial-review-pending",
            flaggedText: typeof rec.title === "string" ? rec.title : undefined,
          },
        );
      }
    }
  }
  const validateDuration = performance.now() - startValidate;

  // =========================================================================
  // Phase 4: Run Registered Checks
  // =========================================================================
  const startCheck = performance.now();
  if (listRegisteredChecks().length === 0) {
    registerStructuralChecks();
    registerSourceManifestCheck();
    registerVoiceCheck();
    registerPrintCoverageCheck();
    registerKernelBindingCheck();
    registerEpistemicChecks();
  }
  const checkContext = {
    records: rawRecords,
    files,
    indexes,
  };
  const checkResult = await runAllChecks(checkContext);
  for (const cd of checkResult.diagnostics) {
    addIssue(
      cd.severity === "error" ? "error" : "flag",
      cd.code,
      cd.path ?? "compiler",
      cd.message,
      {
        family: cd.family,
        checkId: cd.checkId,
        beadId: cd.beadId,
        rule: cd.rule,
        recordId: cd.recordId,
        file: cd.file,
        repair: cd.repair,
        flaggedText: cd.flaggedText,
        contentHash: cd.contentHash,
        fingerprint: cd.fingerprint,
        stack: cd.stack,
      },
    );
  }
  const checkDuration = performance.now() - startCheck;

  // =========================================================================
  // Phase 5: Review Queue
  // =========================================================================
  const flagReviewsMap = flagReviewsText
    ? parseFlagReviews(flagReviewsText)
    : new Map<string, FlagReviewRecord>();
  const rawFlags: ReviewFlagItem[] = diagnostics
    .filter((d) => d.severity === "flag" || d.severity === "review")
    .map((d) => ({
      code: d.code,
      rule: d.rule ?? d.code,
      recordId: d.recordId ?? d.path,
      file: d.file,
      path: d.path,
      message: d.message,
      repair: d.repair,
      flaggedText: d.flaggedText,
      contentHash: d.contentHash,
      family: d.family,
    }));

  const reviewQueue = buildReviewQueue(rawFlags, flagReviewsMap, {
    paperLookup: (recId) => {
      const rec = rawRecords.get(recId) as Record<string, unknown> | undefined;
      return typeof rec?.paper === "string" ? rec.paper : undefined;
    },
  });

  // =========================================================================
  // Phase 6: Build Paper & Foundation Payloads
  // =========================================================================
  const hasErrors = diagnostics.some((d) => d.severity === "error");
  const papers: PaperPayload[] = [];

  if (!hasErrors) {
    for (const paper of indexes.papers.values()) {
      const paperArgs = paper.sections.flatMap((s) =>
        s.arguments.map((id) => indexes.arguments.get(id)).filter((a): a is Argument => Boolean(a)),
      );

      const neededFoundations = new Set<string>();
      function addFoundation(id: string): void {
        if (neededFoundations.has(id)) return;
        neededFoundations.add(id);
        const f = indexes.foundations.get(id);
        if (f) {
          f.prerequisites.forEach(addFoundation);
          for (const b of [...f.explanation, ...f.example]) {
            if (b.kind === "foundation") addFoundation(b.id);
          }
        }
      }

      for (const a of paperArgs) {
        Object.values(a.help ?? {}).forEach(addFoundation);
        for (const reading of READING_IDS) {
          for (const b of a.readings[reading] ?? []) {
            if (b.kind === "foundation") addFoundation(b.id);
          }
        }
      }

      const paperEquations = Array.from(indexes.equations.values()).filter(
        (e) => e.paper === paper.id,
      );
      for (const eq of paperEquations) {
        for (const note of eq.notes) {
          addFoundation(note.foundation);
        }
      }

      const paperFoundations = Array.from(neededFoundations)
        .sort()
        .map((id) => indexes.foundations.get(id))
        .filter((f): f is Foundation => Boolean(f));

      const citationIds = Array.from(
        new Set([
          paper.citation,
          ...paperArgs.flatMap((a) => a.citations ?? []),
          ...paperFoundations.flatMap((f) => f.citations ?? []),
        ]),
      )
        .sort()
        .filter(Boolean);

      const citations = citationIds
        .map((id) => indexes.citations.get(id))
        .filter((c): c is Citation => Boolean(c));

      papers.push({
        schemaVersion: 1,
        paper,
        arguments: paperArgs,
        foundations: paperFoundations,
        citations,
        equations: paperEquations,
      });
    }
  }

  const totalDuration = performance.now() - startTotal;

  return {
    ok: !hasErrors,
    diagnostics,
    papers,
    foundations: Array.from(indexes.foundations.values()),
    indexes,
    reviewQueue,
    durations: {
      loadMs: loadDuration,
      validateMs: validateDuration,
      indexMs: validateDuration,
      checkMs: checkDuration,
      totalMs: totalDuration,
    },
  };
}

/**
 * Validates record content against known schemas.
 */
function validateRecordContent(parsed: unknown, filePath: string, routeKind: string): unknown {
  if (
    routeKind === "paper" ||
    routeKind === "argument" ||
    routeKind === "foundation" ||
    routeKind === "citation"
  ) {
    // If it's a reading record, validate with validateReadingRecord
    if (parsed && typeof parsed === "object" && "kind" in parsed) {
      try {
        return validateReadingRecord(parsed, filePath);
      } catch {
        return parsed;
      }
    }
  }
  return parsed;
}
