/**
 * Pure text matchers for each voice-rule kind. Every matcher takes already-scoped text (the
 * caller decides what is scanned at all — German source blocks are never passed here) and
 * returns zero or more findings. Matching uses word boundaries and Unicode-aware case folding
 * (the `u` and `i` regex flags plus `\p{L}`/`\p{N}` boundaries), so "Revolutionary" and
 * "REVOLUTIONARY" both match.
 */

import type {
  DataOnlyRule,
  LiteralCharsRule,
  OverclaimRule,
  PhraseListRule,
  RegexRule,
  RuleId,
  Severity,
  StatusEnumLeakRule,
  VoiceContext,
  WordListRule,
} from "./rules.ts";

export interface VoiceFinding {
  readonly rule: RuleId;
  readonly severity: Severity;
  readonly context: VoiceContext;
  readonly matchedText: string;
  readonly index: number;
  readonly suggestion: string;
}

export interface MatchSource {
  readonly layer?: "prose" | "translation" | "quotation" | undefined;
  readonly attribution?: string | undefined;
}

interface TextMatch {
  readonly index: number;
  readonly matchedText: string;
}

interface Range {
  readonly start: number;
  readonly end: number;
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

const ALPHANUMERIC = /[\p{L}\p{N}]/u;

/**
 * A phrase (single word or multi-word) matched with Unicode letter/number boundaries,
 * case-insensitively. A boundary is only asserted on a side whose edge character is itself a
 * letter or number — a phrase like "% complete" must still match "75% complete", where the
 * character before "%" is a digit, and a bare mark like "✓" needs no boundary at all.
 */
function phraseRegex(phrase: string, flags = "giu"): RegExp {
  const escaped = escapeRegExp(phrase).replace(/ /g, "\\s+");
  const firstChar = phrase[0];
  const lastChar = phrase[phrase.length - 1];
  const left = firstChar && ALPHANUMERIC.test(firstChar) ? "(?<![\\p{L}\\p{N}])" : "";
  const right = lastChar && ALPHANUMERIC.test(lastChar) ? "(?![\\p{L}\\p{N}])" : "";
  return new RegExp(`${left}${escaped}${right}`, flags);
}

function findPhraseMatches(text: string, phrase: string, flags = "giu"): TextMatch[] {
  return [...text.matchAll(phraseRegex(phrase, flags))].map((m) => ({
    index: m.index,
    matchedText: m[0],
  }));
}

function rangesOf(text: string, phrases: readonly string[]): Range[] {
  return phrases.flatMap((phrase) =>
    findPhraseMatches(text, phrase).map((m) => ({
      start: m.index,
      end: m.index + m.matchedText.length,
    })),
  );
}

function overlapsAny(index: number, length: number, ranges: readonly Range[]): boolean {
  return ranges.some((r) => index < r.end && index + length > r.start);
}

/** Backtick-delimited inline code spans, so `ascii-dash` can skip a `--profile` flag inside one. */
function findCodeSpanRanges(text: string): Range[] {
  const ranges: Range[] = [];
  const re = /`[^`\n]+`/g;
  for (const m of text.matchAll(re)) ranges.push({ start: m.index, end: m.index + m[0].length });
  return ranges;
}

function severityByContext(
  context: VoiceContext,
  byContext: Readonly<Partial<Record<VoiceContext | "default", Severity>>> | undefined,
  fallback: Severity,
): Severity {
  if (!byContext) return fallback;
  return byContext[context] ?? byContext.default ?? fallback;
}

function finding(
  rule: RuleId,
  severity: Severity,
  context: VoiceContext,
  m: TextMatch,
  suggestion: string,
): VoiceFinding {
  return { rule, severity, context, matchedText: m.matchedText, index: m.index, suggestion };
}

export function matchLiteralChars(
  text: string,
  rule: LiteralCharsRule,
  ruleId: RuleId,
  context: VoiceContext,
  source: MatchSource,
): VoiceFinding[] {
  const isQuotation = source.layer === "quotation" && !!source.attribution;
  if (isQuotation && rule.quotationExempt) return [];
  const severity =
    source.layer === "translation" && rule.translationSeverity
      ? rule.translationSeverity
      : rule.defaultSeverity;
  const findings: VoiceFinding[] = [];
  for (const char of rule.chars) {
    let idx = text.indexOf(char);
    while (idx !== -1) {
      findings.push(
        finding(
          ruleId,
          severity,
          context,
          { index: idx, matchedText: char },
          "Use an en dash for a range, or restructure the sentence; avoid the em dash.",
        ),
      );
      idx = text.indexOf(char, idx + 1);
    }
  }
  return findings;
}

export function matchRegexRule(
  text: string,
  rule: RegexRule,
  ruleId: RuleId,
  context: VoiceContext,
  source: MatchSource,
): VoiceFinding[] {
  const isQuotation = source.layer === "quotation" && !!source.attribution;
  if (isQuotation && rule.quotationExempt) return [];
  const severity =
    source.layer === "translation" && rule.translationSeverity
      ? rule.translationSeverity
      : rule.defaultSeverity;
  const codeSpans = rule.codeSpanExempt ? findCodeSpanRanges(text) : [];
  const re = new RegExp(rule.pattern, "gu");
  const findings: VoiceFinding[] = [];
  for (const m of text.matchAll(re)) {
    if (m.index === undefined) continue;
    if (rule.codeSpanExempt && overlapsAny(m.index, m[0].length, codeSpans)) continue;
    findings.push(
      finding(
        ruleId,
        severity,
        context,
        { index: m.index, matchedText: m[0] },
        "Restructure without a joining dash; use a comma, colon, or separate sentence.",
      ),
    );
  }
  return findings;
}

export function matchWordListRule(
  text: string,
  rule: WordListRule,
  ruleId: RuleId,
  context: VoiceContext,
  source: MatchSource,
): VoiceFinding[] {
  const isQuotation = source.layer === "quotation" && !!source.attribution;
  const findings: VoiceFinding[] = [];

  let exceptionRanges: Range[] = [];
  if (rule.exception && isQuotation && source.attribution === rule.exception.attribution) {
    exceptionRanges = rangesOf(text, [rule.exception.phrase]);
  }
  const allowlistRanges = rangesOf(text, rule.allowlist ?? []);

  const baseSeverity = severityByContext(
    context,
    rule.severityByContext,
    rule.defaultSeverity ?? "error",
  );

  for (const word of rule.words) {
    for (const m of findPhraseMatches(text, word)) {
      if (overlapsAny(m.index, m.matchedText.length, exceptionRanges)) continue;
      if (overlapsAny(m.index, m.matchedText.length, allowlistRanges)) continue;
      const severity =
        isQuotation && rule.quotationDowngrade ? rule.quotationDowngrade : baseSeverity;
      findings.push(
        finding(
          ruleId,
          severity,
          context,
          m,
          `Remove or rephrase "${m.matchedText}"; state the specific claim instead.`,
        ),
      );
    }
  }

  if (rule.markWords) {
    for (const word of rule.markWords) {
      if (rule.markWordsProseExempt && context === "prose") continue;
      for (const m of findPhraseMatches(text, word)) {
        if (overlapsAny(m.index, m.matchedText.length, allowlistRanges)) continue;
        findings.push(
          finding(ruleId, baseSeverity, context, m, "Describe the result instead of grading it."),
        );
      }
    }
  }

  return findings;
}

export function matchPhraseListRule(
  text: string,
  rule: PhraseListRule,
  ruleId: RuleId,
  context: VoiceContext,
): VoiceFinding[] {
  const severity = severityByContext(
    context,
    rule.severityByContext,
    rule.defaultSeverity ?? "error",
  );
  const findings: VoiceFinding[] = [];
  for (const phrase of rule.phrases) {
    for (const m of findPhraseMatches(text, phrase)) {
      findings.push(
        finding(
          ruleId,
          severity,
          context,
          m,
          `Rephrase; "${m.matchedText}" is a reviewed voice violation.`,
        ),
      );
    }
  }
  return findings;
}

function isSingleWordStandalone(text: string, match: TextMatch): boolean {
  if (text.trim() === match.matchedText.trim()) return true;
  const before = text.slice(0, match.index);
  return /\bstatus\s*[:-]?\s*$/iu.test(before);
}

export function matchStatusEnumLeak(
  text: string,
  rule: StatusEnumLeakRule,
  ruleId: RuleId,
  context: VoiceContext,
): VoiceFinding[] {
  const findings: VoiceFinding[] = [];
  const wordIds = [...rule.ids.statuses, ...rule.ids.executionOutcomes, ...rule.ids.refusalCodes];
  for (const id of wordIds) {
    for (const m of findPhraseMatches(text, id)) {
      const hyphenated = id.includes("-");
      let severity: Severity = rule.defaultSeverity;
      if (!hyphenated) {
        const standalone = isSingleWordStandalone(text, m);
        if (!standalone && context === "prose") severity = rule.singleWordProseSeverity;
      }
      findings.push(
        finding(
          ruleId,
          severity,
          context,
          m,
          "Replace the identifier with the ordinary-language explanation a reader sees for this status.",
        ),
      );
    }
  }
  for (const label of rule.ids.donorLabels) {
    for (const m of findPhraseMatches(text, label, "gu")) {
      findings.push(
        finding(
          ruleId,
          rule.defaultSeverity,
          context,
          m,
          "A loaded artifact never earns this label; use the honest execution label instead.",
        ),
      );
    }
  }
  return findings;
}

export function matchOverclaim(
  text: string,
  rule: OverclaimRule,
  ruleId: RuleId,
  context: VoiceContext,
  source: MatchSource,
): VoiceFinding[] {
  const isQuotation = source.layer === "quotation" && !!source.attribution;
  if (isQuotation && rule.quotationExempt) return [];
  const severity = severityByContext(context, rule.severityByContext, "flag");
  const findings: VoiceFinding[] = [];
  for (const phrase of rule.phrases) {
    for (const m of findPhraseMatches(text, phrase)) {
      if (phrase.toLowerCase() === "proved") {
        const windowStart = Math.max(0, m.index - 60);
        const windowEnd = Math.min(text.length, m.index + m.matchedText.length + 60);
        const window = text.slice(windowStart, windowEnd).toLowerCase();
        if (rule.provedAllowlistNearWords.some((w) => window.includes(w.toLowerCase()))) continue;
      }
      findings.push(
        finding(
          ruleId,
          severity,
          context,
          m,
          "State what the evidence shows and what it does not settle; a later result is evidence, not a verdict.",
        ),
      );
    }
  }
  return findings;
}

/** Data-only rules (independence-claim) are never pass/fail; matches are informational for the owning bead. */
export function matchDataOnly(
  text: string,
  rule: DataOnlyRule,
  ruleId: RuleId,
  context: VoiceContext,
): VoiceFinding[] {
  const findings: VoiceFinding[] = [];
  for (const phrase of rule.phrases) {
    for (const m of findPhraseMatches(text, phrase)) {
      findings.push(
        finding(
          ruleId,
          "info",
          context,
          m,
          "Informational: independence-claim vocabulary, matched for am-dataset-independence-registry-3dfb.",
        ),
      );
    }
  }
  return findings;
}
