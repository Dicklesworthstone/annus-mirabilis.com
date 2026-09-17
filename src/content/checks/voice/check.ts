/**
 * check.ts
 *
 * Content Compiler Plugin for Editorial Voice Linting.
 *
 * Requirements:
 * - Family: "voice", Severity: "error".
 * - Bead: "am-edit-voice-lint-trmf".
 * - Scans visitor-facing content records, foundations, arguments, misconceptions, and essays.
 * - Exempts German source blocks from scanning.
 * - Downgrades translation unit findings according to rule definitions.
 * - Applies reviewed exceptions from content/editorial/voice-overrides.yaml.
 * - Reports diagnostics with rule, severity, path, message, repair suggestion, and flagged text.
 *
 * Spec: AGENTS.md "Editorial Voice" and am-edit-voice-lint-trmf
 */

import { type CheckContext, registerCheck } from "../../compiler/checks/registry.ts";
import { resolveVoiceContext } from "./contexts.ts";
import { checkVoice, type MatchSource } from "./index.ts";
import { loadVoiceOverrides, type VoiceOverrideEntry } from "./overrides.ts";

export const VOICE_LINT_CHECK_ID = "editorial.voice";

export const EXCLUDED_FIELDS = new Set([
  "id",
  "kind",
  "type",
  "schemaVersion",
  "frame",
  "dimensionStatus",
  "dimension",
  "dimensionlessKind",
  "timeKind",
  "colorRole",
  "mathematicalKind",
  "status",
  "statuses",
  "allowedStatuses",
  "allowedRefusals",
  "allowedExecutionOutcomes",
  "target",
  "lang",
  "sourceLang",
  "edge",
  "unit",
  "symbol",
  "latex",
  "spoken",
  "math",
  "code",
  "hash",
  "digest",
  "fingerprint",
  "citationId",
  "citation",
  "citations",
  "locators",
  "reviewer",
  "date",
  "reason",
  "ref",
  "sourceRef",
  "sourceRefs",
  "paper",
  "section",
  "argument",
  "arguments",
  "experiments",
  "prerequisites",
  "sections",
  "orderedBlockIds",
  "sentenceSpans",
  "affectedIds",
  "provenance",
  "constantSetId",
  "quantityId",
  "termId",
  "variableId",
  "presetId",
  "tapeId",
  "promptId",
  "candidateId",
  "instanceId",
  "instrumentId",
  "reviewRecordId",
  "checkpointId",
  "stepId",
  "ruleId",
  "controlId",
  "exportName",
  "ownerId",
  "ownerBeadId",
  "beadId",
]);

function isOverridden(
  overrides: readonly VoiceOverrideEntry[],
  target: string,
  rule: string,
  matchedText: string,
): boolean {
  return overrides.some(
    (o) =>
      (o.target === target || target.endsWith(o.target) || o.target.endsWith(target)) &&
      o.rule === rule &&
      matchedText.toLowerCase().includes(o.matchedText.toLowerCase()),
  );
}

/**
 * Recursively scans a content object or array for text fields and runs checkVoice on them.
 */
function scanRecordText(
  recordId: string,
  recordKind: string | undefined,
  data: unknown,
  basePath: string,
  context: CheckContext,
  overrides: readonly VoiceOverrideEntry[],
  source: MatchSource = {},
): void {
  if (data === null || data === undefined) return;

  if (typeof data === "string") {
    // Determine context for field
    const voiceCtx = resolveVoiceContext(recordKind, basePath);
    const findings = checkVoice(data, { context: voiceCtx, source });

    for (const f of findings) {
      if (isOverridden(overrides, recordId, f.rule, f.matchedText)) {
        continue;
      }
      context.report({
        recordId,
        rule: f.rule,
        severity: f.severity === "info" ? "flag" : f.severity,
        path: basePath,
        message: `Voice violation [${f.rule}]: ${f.suggestion}`,
        repair: f.suggestion,
        flaggedText: f.matchedText,
      });
    }
    return;
  }

  if (Array.isArray(data)) {
    for (let i = 0; i < data.length; i++) {
      scanRecordText(
        recordId,
        recordKind,
        data[i],
        `${basePath}[${i}]`,
        context,
        overrides,
        source,
      );
    }
    return;
  }

  if (typeof data === "object") {
    const obj = data as Record<string, unknown>;

    // Skip German source blocks completely
    if (obj.kind === "source-block" || (obj.lang === "de" && obj.kind !== "term")) {
      return;
    }

    // Handle translation unit layer
    const currentSource: MatchSource =
      obj.kind === "translation-unit"
        ? { ...source, layer: "translation" }
        : obj.kind === "quotation" || obj.type === "quotation"
          ? {
              ...source,
              layer: "quotation",
              attribution: typeof obj.attribution === "string" ? obj.attribution : undefined,
            }
          : source;

    for (const [key, val] of Object.entries(obj)) {
      if (EXCLUDED_FIELDS.has(key)) {
        continue;
      }

      const fieldPath = basePath ? `${basePath}.${key}` : key;
      scanRecordText(recordId, recordKind, val, fieldPath, context, overrides, currentSource);
    }
  }
}

/**
 * Validates all content records against editorial voice rules.
 */
export function validateVoiceRecords(context: CheckContext): void {
  let overrides: readonly VoiceOverrideEntry[] = [];
  try {
    overrides = loadVoiceOverrides();
  } catch {
    overrides = [];
  }

  for (const [key, value] of context.records.entries()) {
    if (!value || typeof value !== "object") continue;
    const rec = value as Record<string, unknown>;
    const kind = typeof rec.kind === "string" ? rec.kind : undefined;

    // German source blocks are explicitly exempt
    if (kind === "source-block" || rec.lang === "de") {
      continue;
    }

    scanRecordText(key, kind, rec, "", context, overrides);
  }
}

/**
 * Registers the editorial voice check with the compiler plugin registry.
 */
export function registerVoiceCheck(): void {
  registerCheck({
    id: VOICE_LINT_CHECK_ID,
    family: "voice",
    severity: "error",
    beadId: "am-edit-voice-lint-trmf",
    description: "Editorial voice rules for visitor-facing content and interface strings.",
    run: (context) => {
      validateVoiceRecords(context);
    },
  });
}
