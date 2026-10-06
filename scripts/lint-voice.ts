/**
 * lint-voice.ts
 *
 * Standalone editorial voice linting script for CI, quality gates, and local verification.
 *
 * Scans:
 * 1. Content records under content/ (readings, foundations, arguments, misconceptions, etc.)
 * 2. Interface message catalogs under src/i18n/messages/*.json
 * 3. React TSX components and accessible-name attributes under src/
 *
 * Outputs structured JSONL logs to artifacts/test-logs/voice-lint/<log-run-id>.jsonl
 * Exits with code 0 on clean pass, 1 on voice errors.
 *
 * Spec: AGENTS.md "Editorial Voice" and am-edit-voice-lint-trmf
 */

import { existsSync, mkdirSync, readdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { EXCLUDED_FIELDS, isOverridden, QUOTED_FIELDS } from "../src/content/checks/voice/check.ts";
import { extractAllComponentStrings } from "../src/content/checks/voice/componentText.ts";
import { resolveVoiceContext } from "../src/content/checks/voice/contexts.ts";
import { checkVoice } from "../src/content/checks/voice/index.ts";
import { scanRealTreeForParallelDenyLists } from "../src/content/checks/voice/noParallelDenyLists.ts";
import {
  findStaleOverrides,
  loadVoiceOverrides,
  type VoiceOverrideEntry,
} from "../src/content/checks/voice/overrides.ts";
import type { VoiceContext } from "../src/content/checks/voice/rules.ts";
import { parseYaml } from "../src/content/provenance/yaml.ts";
import { newRunIdentity } from "../src/testing/log/logger.ts";
import { reportPopulation } from "./gate-census/population.ts";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const LOGS_DIR = path.join(ROOT, "artifacts", "test-logs", "voice-lint");

interface LogEntry {
  readonly timestamp: string;
  readonly suite: "voice-lint";
  readonly logRunId: string;
  readonly rule?: string | undefined;
  readonly severity?: "error" | "flag" | "info" | undefined;
  /**
   * The shared log schema's outcome vocabulary (am-uxh9). Every row carried a
   * severity and no outcome, so 616 rows told a reader how bad a finding was but
   * never whether the run had failed on it. An error is a failure; a flag and an
   * info are recorded observations that do not fail the gate.
   */
  readonly outcome?: "passed" | "failed" | undefined;
  readonly context?: VoiceContext | undefined;
  readonly recordId?: string | undefined;
  readonly file?: string | undefined;
  readonly path?: string | undefined;
  readonly line?: number | undefined;
  readonly column?: number | undefined;
  readonly matchedText?: string | undefined;
  readonly suggestion?: string | undefined;
  readonly summary?: Record<string, unknown> | undefined;
}

/**
 * Does this record say, in its own data, that its text is translated from another language?
 *
 * Exported so both directions can be driven without reading the corpus. The cross-language test is
 * the whole predicate: a record whose sourceLang EQUALS its lang is not a translation and must get no
 * exemption, and a record declaring neither is ordinary site prose.
 */
export function recordDeclaresTranslation(rec: Record<string, unknown>): boolean {
  return (
    typeof rec.sourceLang === "string" &&
    typeof rec.lang === "string" &&
    rec.sourceLang !== rec.lang
  );
}

export async function runVoiceLint(): Promise<{
  errorCount: number;
  flagCount: number;
  infoCount: number;
  totalScanned: number;
  logRunId: string;
  logFilePath: string;
}> {
  const logRunId = newRunIdentity();
  const timestamp = new Date().toISOString();
  const logEntries: LogEntry[] = [];

  let overrides: readonly VoiceOverrideEntry[] = [];
  try {
    overrides = loadVoiceOverrides();
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    console.error(`Error loading voice overrides: ${message}`);
  }

  let errorCount = 0;
  let flagCount = 0;
  let infoCount = 0;
  let totalScanned = 0;

  const countsByRule: Record<string, number> = {};
  const countsByContext: Record<string, number> = {};
  const allTargetTexts = new Map<string, string>();

  // 1. Scan Content Records
  const contentDir = path.join(ROOT, "content");
  if (existsSync(contentDir)) {
    function walkContent(dir: string): void {
      for (const entry of readdirSync(dir)) {
        const full = path.join(dir, entry);
        const stat = statSync(full);
        if (stat.isDirectory()) {
          if (entry === "source-blocks" || entry === "reviewed-transcriptions") continue;
          walkContent(full);
        } else if (
          stat.isFile() &&
          (entry.endsWith(".json") || entry.endsWith(".yaml") || entry.endsWith(".yml"))
        ) {
          if (entry === "voice-rules.yaml" || entry === "voice-overrides.yaml") continue;
          const text = readFileSync(full, "utf8");
          const relPath = path.relative(ROOT, full);
          allTargetTexts.set(relPath, text);

          let parsed: unknown;
          try {
            parsed = entry.endsWith(".json") ? JSON.parse(text) : parseYaml(text);
          } catch {
            continue;
          }

          scanObject(parsed, relPath, "");
        }
      }
    }

    /**
     * THE RECORD'S KIND AND LAYER ARE INHERITED, NOT RE-READ AT EVERY LEVEL (am-ep-editorial-13x).
     *
     * This read `rec.kind` at whatever depth it had reached, so a nested object answered for the
     * record. A translation unit's prose lives in `inlines[]`, and an inline's own kind is "text",
     * so `rec.kind === "translation-unit"` was false for every sentence in the corpus: the
     * translation LAYER was dropped one level down and `checkVoice` fell back to each rule's
     * `defaultSeverity`.
     *
     * Measured consequence: 47 em-dash ERRORS across content/translation-units/special-relativity,
     * all on `inlines[n].text`, although `content/editorial/voice-rules.yaml` declares
     * `em-dash: translationSeverity: flag` precisely so a translation is not held to house
     * punctuation. The dashes it was failing are Einstein's own: s0-p3-s1 renders "is based — like
     * every other electrodynamics — on the kinematics of the rigid body" as a parenthetical pair,
     * and s4-p4-s1 ends with the trailing dash the 1905 typesetting uses to close a passage. The
     * rule was right and the walk lost the information it needed to apply it.
     *
     * `recordKind` also feeds `resolveVoiceContext`, so the same loss was choosing severities by a
     * nested object's kind rather than the record's.
     */
    function scanObject(
      obj: unknown,
      filePath: string,
      objPath: string,
      inheritedKind?: string,
      inheritedSource: { readonly layer?: "prose" | "translation" | "quotation" } = {},
    ): void {
      if (!obj || typeof obj !== "object") return;
      const rec = obj as Record<string, unknown>;

      // German source blocks are exempt
      if (rec.kind === "source-block" || rec.lang === "de") {
        return;
      }

      // A nested object may name its own kind ("text"), but the RECORD's kind is what the rules are
      // written against, so an inner kind never replaces an outer one.
      const recordKind = inheritedKind ?? (typeof rec.kind === "string" ? rec.kind : undefined);
      /**
       * A RECORD THAT SAYS IT WAS TRANSLATED IS A TRANSLATION, whatever its `kind` (am-dbpk class).
       *
       * This keyed the translation layer on `kind === "translation-unit"` alone. A GLOSS UNIT declares
       * no `kind` at all - it declares `lang: "en"` and `sourceLang: "de"` - so every one of the 542
       * gloss units was linted as the site's own prose, and the `overclaim` rule fired at its default
       * severity of ERROR on six of them.
       *
       * The word is "proved", and in every case it is Einstein's. s4-p8-s1 glosses "bewiesene", the
       * past participle of beweisen, with the note "'the result proved for a polygonal line', the
       * phrase before its noun". AGENTS.md requires a translation to preserve modality - "A heuristic
       * stays a heuristic, an approximation stays approximate" - so the only way to satisfy the rule
       * as it stood was to MISTRANSLATE the source. A gate that can only be made green by corrupting
       * the content it guards is wrong about its own scope, and voice-rules.yaml already carries
       * `translationSeverity` for exactly this: the house voice is the site's, not the source's.
       *
       * Keyed on the record's own declaration rather than on a path, so it cannot drift when a
       * directory is renamed, and it is a cross-language test: a record whose sourceLang EQUALS its
       * lang is not a translation and gets no exemption. Measured across the corpus on 2026-10-06,
       * every record declaring `sourceLang` declares a different `lang`.
       */
      const recordSource =
        recordKind === "translation-unit" || recordDeclaresTranslation(rec)
          ? ({ layer: "translation" } as const)
          : inheritedSource;
      /**
       * A QUOTED FIELD IS NOT THE AUTHOR SPEAKING, and this script was the only reader that did not
       * know. `check.ts` keeps `QUOTED_FIELDS` and sets `layer: "quotation"` for them; the compiler
       * check has always done so and this script never imported it. The field it exists for is a
       * misconception's `temptingClaims`, whose whole purpose is to state the claim the ledger then
       * refutes, so linting it for overclaiming fires the rule on the one field that must overclaim.
       */
      const sourceForField = (key: string) =>
        QUOTED_FIELDS.has(key) ? ({ ...recordSource, layer: "quotation" } as const) : recordSource;
      const recId = typeof rec.id === "string" ? rec.id : filePath;
      if (recId && !allTargetTexts.has(recId)) {
        allTargetTexts.set(recId, JSON.stringify(rec));
      }

      for (const [key, val] of Object.entries(rec)) {
        if (EXCLUDED_FIELDS.has(key)) {
          continue;
        }

        const currentPath = objPath ? `${objPath}.${key}` : key;
        if (typeof val === "string") {
          totalScanned++;
          const voiceCtx = resolveVoiceContext(recordKind, currentPath);
          const findings = checkVoice(val, { context: voiceCtx, source: sourceForField(key) });

          for (const f of findings) {
            if (
              isOverridden(overrides, recId, f.rule, f.matchedText) ||
              isOverridden(overrides, filePath, f.rule, f.matchedText)
            ) {
              continue;
            }

            if (f.severity === "error") errorCount++;
            else if (f.severity === "flag") flagCount++;
            else if (f.severity === "info") infoCount++;

            countsByRule[f.rule] = (countsByRule[f.rule] ?? 0) + 1;
            countsByContext[f.context] = (countsByContext[f.context] ?? 0) + 1;

            logEntries.push({
              timestamp,
              suite: "voice-lint",
              logRunId,
              rule: f.rule,
              severity: f.severity,
              outcome: f.severity === "error" ? "failed" : "passed",
              context: f.context,
              recordId: recId,
              file: filePath,
              path: currentPath,
              matchedText: f.matchedText,
              suggestion: f.suggestion,
            });
          }
        } else if (Array.isArray(val)) {
          for (let i = 0; i < val.length; i++) {
            if (typeof val[i] === "string") {
              totalScanned++;
              const voiceCtx = resolveVoiceContext(recordKind, `${currentPath}[${i}]`);
              // This passed NO source at all, so a translation's string array was judged as prose
              // even when the layer had survived to this level.
              const findings = checkVoice(val[i] as string, {
                context: voiceCtx,
                source: sourceForField(key),
              });
              for (const f of findings) {
                if (
                  isOverridden(overrides, recId, f.rule, f.matchedText) ||
                  isOverridden(overrides, filePath, f.rule, f.matchedText)
                ) {
                  continue;
                }
                if (f.severity === "error") errorCount++;
                else if (f.severity === "flag") flagCount++;
                else if (f.severity === "info") infoCount++;

                countsByRule[f.rule] = (countsByRule[f.rule] ?? 0) + 1;
                countsByContext[f.context] = (countsByContext[f.context] ?? 0) + 1;

                logEntries.push({
                  timestamp,
                  suite: "voice-lint",
                  logRunId,
                  rule: f.rule,
                  severity: f.severity,
                  outcome: f.severity === "error" ? "failed" : "passed",
                  context: f.context,
                  recordId: recId,
                  file: filePath,
                  path: `${currentPath}[${i}]`,
                  matchedText: f.matchedText,
                  suggestion: f.suggestion,
                });
              }
            } else if (typeof val[i] === "object") {
              scanObject(val[i], filePath, `${currentPath}[${i}]`, recordKind, recordSource);
            }
          }
        } else if (typeof val === "object") {
          scanObject(val, filePath, currentPath, recordKind, recordSource);
        }
      }
    }

    walkContent(contentDir);
  }

  // 2. Scan TSX Components
  const srcDir = path.join(ROOT, "src");
  if (existsSync(srcDir)) {
    const componentStrings = extractAllComponentStrings(srcDir, ROOT);
    for (const item of componentStrings) {
      totalScanned++;
      const findings = checkVoice(
        item.text,
        item.source !== undefined
          ? { context: item.context, source: item.source }
          : { context: item.context },
      );

      for (const f of findings) {
        if (isOverridden(overrides, item.file, f.rule, f.matchedText)) {
          continue;
        }

        if (f.severity === "error") errorCount++;
        else if (f.severity === "flag") flagCount++;
        else if (f.severity === "info") infoCount++;

        countsByRule[f.rule] = (countsByRule[f.rule] ?? 0) + 1;
        countsByContext[f.context] = (countsByContext[f.context] ?? 0) + 1;

        logEntries.push({
          timestamp,
          suite: "voice-lint",
          logRunId,
          rule: f.rule,
          severity: f.severity,
          outcome: f.severity === "error" ? "failed" : "passed",
          context: f.context,
          file: item.file,
          line: item.line,
          column: item.column,
          matchedText: f.matchedText,
          suggestion: f.suggestion,
        });
      }
    }
  }

  // 3. Scan Interface Message Catalogs
  const messagesDir = path.join(ROOT, "src", "i18n", "messages");
  if (existsSync(messagesDir)) {
    for (const file of readdirSync(messagesDir)) {
      if (file.endsWith(".json") && file !== "de.json") {
        const fullPath = path.join(messagesDir, file);
        const relPath = path.relative(ROOT, fullPath);
        const raw = readFileSync(fullPath, "utf8");
        allTargetTexts.set(relPath, raw);
        let parsed: unknown;
        try {
          parsed = JSON.parse(raw);
        } catch {
          continue;
        }
        if (parsed && typeof parsed === "object" && "messages" in parsed) {
          const msgs = (parsed as { messages?: Record<string, unknown> }).messages;
          if (msgs && typeof msgs === "object") {
            for (const [msgKey, msgVal] of Object.entries(msgs)) {
              if (typeof msgVal === "string") {
                totalScanned++;
                const voiceCtx = resolveVoiceContext("message-catalog", msgKey);
                const findings = checkVoice(msgVal, { context: voiceCtx });
                for (const f of findings) {
                  if (
                    isOverridden(overrides, relPath, f.rule, f.matchedText) ||
                    isOverridden(overrides, msgKey, f.rule, f.matchedText)
                  ) {
                    continue;
                  }
                  if (f.severity === "error") errorCount++;
                  else if (f.severity === "flag") flagCount++;
                  else if (f.severity === "info") infoCount++;

                  countsByRule[f.rule] = (countsByRule[f.rule] ?? 0) + 1;
                  countsByContext[f.context] = (countsByContext[f.context] ?? 0) + 1;

                  logEntries.push({
                    timestamp,
                    suite: "voice-lint",
                    logRunId,
                    rule: f.rule,
                    severity: f.severity,
                    outcome: f.severity === "error" ? "failed" : "passed",
                    context: f.context,
                    file: relPath,
                    path: msgKey,
                    matchedText: f.matchedText,
                    suggestion: f.suggestion,
                  });
                }
              }
            }
          }
        }
      }
    }
  }

  // 4. Scan for Parallel Deny Lists
  const parallelFindings = scanRealTreeForParallelDenyLists(ROOT);
  for (const pf of parallelFindings) {
    errorCount++;
    countsByRule["no-parallel-deny-lists"] = (countsByRule["no-parallel-deny-lists"] ?? 0) + 1;
    logEntries.push({
      timestamp,
      suite: "voice-lint",
      logRunId,
      rule: "no-parallel-deny-lists",
      severity: "error",
      outcome: "failed",
      context: "prose",
      file: pf.file,
      line: pf.line,
      matchedText: pf.matchedTerms.join(", "),
      suggestion:
        "Remove parallel deny list. Use checkVoice from src/content/checks/voice instead.",
    });
  }

  // 5. Check for Stale Overrides
  const staleOverrides = findStaleOverrides(overrides, (t) => allTargetTexts.get(t));
  for (const stale of staleOverrides) {
    flagCount++;
    logEntries.push({
      timestamp,
      suite: "voice-lint",
      logRunId,
      rule: "stale-override",
      severity: "flag",
      outcome: "passed",
      file: stale.entry.target,
      matchedText: stale.entry.matchedText,
      suggestion: `Override for "${stale.entry.target}" is stale; matched text no longer occurs.`,
    });
  }

  // 4. Summary Line
  logEntries.push({
    timestamp,
    suite: "voice-lint",
    logRunId,
    outcome: errorCount > 0 ? "failed" : "passed",
    summary: {
      totalScanned,
      errorCount,
      flagCount,
      infoCount,
      countsByRule,
      countsByContext,
      staleOverridesCount: staleOverrides.length,
    },
  });

  // Write Log File
  if (!existsSync(LOGS_DIR)) {
    mkdirSync(LOGS_DIR, { recursive: true });
  }
  const logFilePath = path.join(LOGS_DIR, `${logRunId}.jsonl`);
  const logContent = `${logEntries.map((e) => JSON.stringify(e)).join("\n")}\n`;
  writeFileSync(logFilePath, logContent, "utf8");

  return {
    errorCount,
    flagCount,
    infoCount,
    totalScanned,
    logRunId,
    logFilePath,
  };
}

// Direct execution
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  runVoiceLint()
    .then((res) => {
      console.log(`[voice-lint] Run ID: ${res.logRunId}`);
      console.log(
        `[voice-lint] Scanned ${res.totalScanned} items. Errors: ${res.errorCount}, Flags: ${res.flagCount}, Info: ${res.infoCount}`,
      );
      // The census line (am-rc1001-bridge-plan-pcjk.9). The population is the visitor-facing STRINGS
      // scanned. Measured 2026-10-06: 82166 items, 8 errors, 68 flags, 1048 info. A floor of 20000 is
      // well below any real corpus and far above a partial load, which is the failure that would make
      // "Errors: 0" mean nothing.
      reportPopulation({
        gate: "voice-lint",
        examined: res.totalScanned,
        noun: "visitor-facing strings",
        minimum: 20000,
      });
      console.log(`[voice-lint] Log saved to: ${res.logFilePath}`);
      if (res.errorCount > 0) {
        process.exit(1);
      }
    })
    .catch((err) => {
      console.error("[voice-lint] Fatal execution error:", err);
      process.exit(1);
    });
}
