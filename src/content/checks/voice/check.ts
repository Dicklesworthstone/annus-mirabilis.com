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

/**
 * FIELDS WHOSE TEXT THE SITE QUOTES RATHER THAN ASSERTS (am-9755).
 *
 * A misconception record's `temptingClaims` holds the claim the record exists to refute:
 * "Einstein's paper proved that molecules exist." The overclaim rule read it as the site making
 * that claim and took verify-content red on misc-bm-proves-molecules, and every record written in
 * future would meet the same wall, because naming the tempting overclaim plainly is what the field
 * is FOR. Blunting it to satisfy a linter would damage the record.
 *
 * So these are scanned as a quotation. That is not a blanket exemption: it hands them to the same
 * `quotationExempt` switch every rule already declares for itself, so overclaim steps back while
 * any rule that does not exempt quotations still binds. A mocking tempting claim is still a
 * finding, which matters, because AGENTS.md's rule is that nobody is mocked.
 *
 * This is the same correction `isDirectlyNegated` made for the same rule and the same phrase
 * (matchers.ts): the rule was reading the site's own careful distinction as the error it guards.
 */
export const QUOTED_FIELDS = new Set(["temptingClaims"]);

/**
 * A SCENARIO'S AUTHORING PROSE IS NOT VISITOR-FACING, AND THE GATE WAS HOLDING IT TO THE HOUSE
 * VOICE ANYWAY (am-3gon).
 *
 * This is the third scope correction this file has needed, and it is the same shape as the first
 * two: the rules were right and the population was not. 13 of voice-lint's 17 errors were in
 * `content/scenarios`, and the one that makes the case is `status-enum-leak` firing on
 * `intendedFailure`. That field exists to say what an adversarial fixture must refuse WITH, so the
 * sentence "a run returning any entropy change fails here, and so does one refusing for a different
 * reason" has to name `outside-domain` to mean anything. Rewording it would delete the statement,
 * which is the condition the docblock below already names: a gate that can only be made green by
 * corrupting the content it guards is wrong about its own scope.
 *
 * MEASURED BEFORE EXEMPTING ANYTHING, against an `out/` freshly built at 095e8fe5:
 *
 *   description        214 phrases sampled    0 found in out/
 *   intendedFailure    100                    0
 *   plausibleMistake   100                    0
 *   tolerance.rationale 467                   0
 *   title              199                    1   <- ships, so NOT exempt
 *
 * The `title` row is why this is a field list rather than a record exemption. One scenario title
 * reaches a reader (bm-07-inversion-golden), so a scenario is not wholesale invisible and its title
 * stays linted; the `theater` error on sr-05-inertial-0.6c's title survives this change, as it
 * should.
 *
 * KEYED ON THE RECORD'S OWN DECLARED KIND, never on a directory. A path exclusion for
 * content/scenarios would stop asking the question, and would go wrong the day a scenario carries
 * genuinely reader-facing prose or the directory is renamed. `intendedFailure` and
 * `plausibleMistake` were measured to exist in no record outside content/scenarios, so the kinds
 * below are the whole population that can reach this.
 */
const SCENARIO_KINDS = new Set(["adversarial", "modern-golden", "historical-fixture", "identity"]);

/** Fields of a scenario that address an author or reviewer, never a visitor. */
const SCENARIO_AUTHORING_FIELDS = new Set([
  "description",
  "intendedFailure",
  "plausibleMistake",
  "rationale",
]);

/**
 * Whether this field of this record is a scenario's authoring prose. `rationale` is nested under
 * `expected.outputs[n].tolerance`, so the field NAME is matched rather than the path: a tolerance
 * rationale is an author's justification wherever it sits.
 */
export function isScenarioAuthoringField(
  recordKind: string | undefined,
  fieldName: string,
): boolean {
  return (
    recordKind !== undefined &&
    SCENARIO_KINDS.has(recordKind) &&
    SCENARIO_AUTHORING_FIELDS.has(fieldName)
  );
}

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
  // am-edit-voice-lint-trmf. A typed enum, not prose: "defined" |
  // "measured-without-counting-molecules" | "not-applicable", declared at
  // src/content/schemas/experiment.ts:3611 and validated at :3646, and carried by all seven
  // content/quantities/constant-sets/*.yaml records. "provenance" one line above is already
  // excluded and the match is exact field-name equality, which is the only reason this sibling
  // was scanned. Two of the seven flagged, and only because "not-applicable" happens to be a
  // registered result status as well as a value of this unrelated enum; "defined" and
  // "measured-without-counting-molecules" are not statuses and passed. The rule was right about
  // the class and wrong about the population. The genuine leak this pointed at was
  // KitchenResults.tsx rendering the identifier to a reader, fixed in dbdc78cb.
  "gasConstantProvenance",
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

export function isOverridden(
  overrides: readonly VoiceOverrideEntry[],
  target: string,
  rule: string,
  matchedText: string,
): boolean {
  return overrides.some(
    (o) =>
      // am-s64j. This used to also accept target.endsWith(o.target) and the reverse, so an
      // override declared for "text" suppressed every record path ending in "text", in both
      // directions. The breadth decision recorded on that bead: a target is a RECORD ID, matched
      // exactly. check.ts:131 passes recordId in every call, so a file-path target never reached
      // this predicate anyway; the suffix disjuncts were compensating for a documented case the
      // call site cannot supply. An exemption must name exactly what it exempts.
      o.target === target &&
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
      // Same scope as the lint script, from the same predicate, so the two readers of this module
      // cannot disagree about what a visitor sees.
      if (typeof obj.kind === "string" && isScenarioAuthoringField(obj.kind, key)) {
        continue;
      }
      if (EXCLUDED_FIELDS.has(key)) {
        continue;
      }

      const fieldPath = basePath ? `${basePath}.${key}` : key;
      scanRecordText(
        recordId,
        recordKind,
        val,
        fieldPath,
        context,
        overrides,
        QUOTED_FIELDS.has(key) ? { ...currentSource, layer: "quotation" } : currentSource,
      );
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
