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
  TitleCaseRule,
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
  /**
   * The element a string came from, where that changes what it IS rather than how it reads
   * (am-edit-voice-lint-trmf). Set only for h1-h6 by componentText.ts. Content records never
   * carry it, which is what keeps a bibliography entry or a printed German title structurally
   * out of reach of the heading rule rather than allowlisted out of it.
   */
  readonly element?: "heading" | undefined;
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
        rule.repair ??
          "Restructure without a joining dash; use a comma, colon, or separate sentence.",
      ),
    );
  }
  return findings;
}

/**
 * True when a scoring construction reaches the occurrence at `index` (am-gzxs). The search runs
 * BACKWARDS from the occurrence, stops at the nearest sentence boundary so a scoring sentence
 * cannot leak into the next one, and looks only at the last `maxTokensBetween` words. That bound
 * is what separates "Earn 5 points" from the second occurrence in "Earn 5 points for every 10
 * data points you plot", where the verb is six tokens away and the noun is ordinary.
 */
function precedingTokensContain(
  text: string,
  index: number,
  wanted: readonly string[],
  maxTokens: number,
): boolean {
  const before = text.slice(0, index);
  const sentenceStart = Math.max(
    before.lastIndexOf("."),
    before.lastIndexOf(";"),
    before.lastIndexOf("!"),
    before.lastIndexOf("?"),
    before.lastIndexOf("\n"),
  );
  const window = before.slice(sentenceStart + 1);
  const tokens = window
    .split(/[^\p{L}\p{N}'-]+/u)
    .filter((t) => t.length > 0)
    .slice(-maxTokens)
    .map((t) => t.toLowerCase());
  const wantedSet = new Set(wanted.map((t) => t.toLowerCase()));
  return tokens.some((t) => wantedSet.has(t));
}

/** The mirror of precedingTokensContain, for a word that is judged by what it MODIFIES. */
function followingTokensContain(
  text: string,
  endIndex: number,
  wanted: readonly string[],
  maxTokens: number,
): boolean {
  const after = text.slice(endIndex);
  const sentenceEnd = after.search(/[.;!?\n]/u);
  const window = sentenceEnd === -1 ? after : after.slice(0, sentenceEnd);
  const tokens = window
    .split(/[^\p{L}\p{N}'-]+/u)
    .filter((t) => t.length > 0)
    .slice(0, maxTokens)
    .map((t) => t.toLowerCase());
  const wantedSet = new Set(wanted.map((t) => t.toLowerCase()));
  return tokens.some((t) => wantedSet.has(t));
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
      // A negated noun is a disclaimer, not an instance. Deliberately NOT applied to the
      // markWords loop below: "not wrong" still grades the attempt.
      if (
        rule.negationExempt &&
        precedingTokensContain(
          text,
          m.index,
          rule.negationExempt.markers,
          rule.negationExempt.maxTokensBefore,
        )
      ) {
        continue;
      }
      let severity =
        isQuotation && rule.quotationDowngrade ? rule.quotationDowngrade : baseSeverity;
      if (source.layer === "translation" && severity === "error") {
        severity = "flag";
      }
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

  // Qualifier-gated words (am-x9xf). Kept OUT of `words` above for the same reason as the
  // construction-gated ones: the plain path must never see them. "naive" is a term of art
  // modifying a METHOD and is this rule's vocabulary only when it is asserted OF someone, or
  // modifies a person or what a person holds.
  if (rule.qualifierGated) {
    const gated = rule.qualifierGated;
    for (const word of gated.words) {
      for (const m of findPhraseMatches(text, word)) {
        if (overlapsAny(m.index, m.matchedText.length, exceptionRanges)) continue;
        if (overlapsAny(m.index, m.matchedText.length, allowlistRanges)) continue;
        // A context whose whole purpose is presenting a rival account or a reader's own branch:
        // there, "naive" is about whoever holds the thing, whatever noun follows it. This is the
        // arm that keeps "This naive candidate." loud in countermodel-cell, where no person noun
        // appears at all. The allowlist is checked ABOVE, so "naive estimate" stays exempt even
        // here.
        if (gated.alwaysFiringContexts.includes(context)) {
          let contextSeverity =
            isQuotation && rule.quotationDowngrade ? rule.quotationDowngrade : baseSeverity;
          if (source.layer === "translation" && contextSeverity === "error")
            contextSeverity = "flag";
          findings.push(
            finding(
              ruleId,
              contextSeverity,
              context,
              m,
              `Remove or rephrase "${m.matchedText}"; say what the account gets wrong, not what kind of person holds it.`,
            ),
          );
          continue;
        }
        const predicative = precedingTokensContain(
          text,
          m.index,
          gated.predicateTriggers,
          gated.maxTokensBefore,
        );
        const aboutAPerson = followingTokensContain(
          text,
          m.index + m.matchedText.length,
          gated.targets,
          gated.maxTokensAfter,
        );
        if (!predicative && !aboutAPerson) continue;
        let severity =
          isQuotation && rule.quotationDowngrade ? rule.quotationDowngrade : baseSeverity;
        if (source.layer === "translation" && severity === "error") severity = "flag";
        findings.push(
          finding(
            ruleId,
            severity,
            context,
            m,
            `Remove or rephrase "${m.matchedText}"; say what the account gets wrong, not what kind of person holds it.`,
          ),
        );
      }
    }
  }

  // Construction-gated words (am-gzxs). Kept OUT of `words` above, so the plain path never sees
  // them: they are this rule's vocabulary only inside a scoring construction, or in a context
  // whose entire purpose is scoring. The allowlist still applies, because a scoring context is
  // exactly where "Plot all data points" appears as a button label.
  if (rule.constructionGated) {
    const gated = rule.constructionGated;
    const inScoringContext = gated.scoringContexts.includes(context);
    for (const word of gated.words) {
      for (const m of findPhraseMatches(text, word)) {
        if (overlapsAny(m.index, m.matchedText.length, allowlistRanges)) continue;
        if (
          !inScoringContext &&
          !precedingTokensContain(text, m.index, gated.triggers, gated.maxTokensBetween)
        ) {
          continue;
        }
        let severity =
          isQuotation && rule.quotationDowngrade ? rule.quotationDowngrade : baseSeverity;
        if (source.layer === "translation" && severity === "error") severity = "flag";
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
  }

  if (rule.markWords) {
    for (const word of rule.markWords) {
      if (rule.markWordsProseExempt && context === "prose") continue;
      for (const m of findPhraseMatches(text, word)) {
        if (overlapsAny(m.index, m.matchedText.length, allowlistRanges)) continue;
        let markSeverity = baseSeverity;
        if (source.layer === "translation" && markSeverity === "error") {
          markSeverity = "flag";
        }
        findings.push(
          finding(ruleId, markSeverity, context, m, "Describe the result instead of grading it."),
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
  source: MatchSource = {},
): VoiceFinding[] {
  let severity = severityByContext(
    context,
    rule.severityByContext,
    rule.defaultSeverity ?? "error",
  );
  if (source.layer === "translation" && severity === "error") {
    severity = "flag";
  }
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

/**
 * Whether this occurrence of "proved" is the thing a sentence DENIES (am-edit-voice-lint-trmf).
 *
 * The overclaim rule exists to catch a verdict on the world. A sentence that says a
 * relation is "assumed, not proved by conservation", or that something is "an additional
 * hypothesis, not as something proved by drawing separate dots", is making exactly the
 * distinction the rule is protecting, and the rule was failing it: five of the six errors
 * that took verify-content red in CI run 35481561814 were negated uses in the
 * mass-energy equation records and one light-quanta argument. Rewriting those sentences to
 * satisfy the linter would have damaged correct epistemics to keep a gate quiet.
 *
 * The negator must be in the same sentence and must reach the match without crossing a
 * sentence-ending mark, so "It was not obvious. Perrin proved it." is still a finding.
 */
function isDirectlyNegated(text: string, matchIndex: number): boolean {
  const lookbehind = text.slice(Math.max(0, matchIndex - 40), matchIndex).toLowerCase();
  const negator = Math.max(
    lookbehind.lastIndexOf("not "),
    lookbehind.lastIndexOf("never "),
    lookbehind.lastIndexOf("n't "),
  );
  if (negator === -1) return false;
  const between = lookbehind.slice(negator);
  return !/[.;:!?]/.test(between);
}

export function matchOverclaim(
  text: string,
  rule: OverclaimRule,
  ruleId: RuleId,
  context: VoiceContext,
  source: MatchSource,
): VoiceFinding[] {
  const isQuotation = source.layer === "quotation";
  if (isQuotation && rule.quotationExempt) return [];
  let severity = severityByContext(context, rule.severityByContext, "flag");
  if (source.layer === "translation" && severity === "error") {
    severity = "flag";
  }
  const findings: VoiceFinding[] = [];
  for (const phrase of rule.phrases) {
    for (const m of findPhraseMatches(text, phrase)) {
      if (phrase.toLowerCase() === "proved") {
        const windowStart = Math.max(0, m.index - 60);
        const windowEnd = Math.min(text.length, m.index + m.matchedText.length + 60);
        const window = text.slice(windowStart, windowEnd).toLowerCase();
        if (rule.provedAllowlistNearWords.some((w) => window.includes(w.toLowerCase()))) continue;
        if (isDirectlyNegated(text, m.index)) continue;
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

/**
 * Title Case in a heading (am-edit-voice-lint-trmf). The discriminator is a CONSTRUCTION - the
 * proportion of content words carrying a capital - rather than a list of offending words, because
 * Title Case is a shape and any word can appear in it.
 *
 * TWO THINGS IT CANNOT DO, both stated rather than hidden:
 *
 * 1. It cannot see that a string is a heading. componentText.ts hands every JSX text node over as
 *    `prose`, so a heading and a paragraph arrive indistinguishable. The substitute is a SHAPE
 *    test - at most maxWords words, and no sentence-ending punctuation - which is what keeps the
 *    rule off ordinary prose. If a `heading` context is ever added to the extractor, this test
 *    should be replaced by it rather than kept alongside.
 * 2. It cannot tell a proper noun from a style choice. "Stokes's Rule and the Drag Force" is Title
 *    Case; "Einstein 1905 §7" is a name and a citation. The exception is therefore enumerated -
 *    properNouns - and the rule additionally requires minNonProperCapitals capitalised words that
 *    are NOT on that list, so a heading whose capitals are all names cannot trip it.
 */
export function matchTitleCase(
  text: string,
  rule: TitleCaseRule,
  ruleId: RuleId,
  context: VoiceContext,
  source: MatchSource,
): VoiceFinding[] {
  if (source.element !== "heading") return [];
  if (source.layer === "translation" || source.layer === "quotation") return [];
  const trimmed = text.trim();
  if (/[.!?]$/.test(trimmed)) return [];
  const tokens = trimmed.match(/[\p{L}][\p{L}'\u2019-]*/gu) ?? [];
  if (tokens.length < 2 || tokens.length > rule.maxWords) return [];

  const fn = new Set(rule.functionWords.map((w) => w.toLowerCase()));
  const proper = new Set(rule.properNouns.map((w) => w.toLowerCase()));
  const isProper = (w: string) => {
    const bare = w.toLowerCase().replace(/[''\u2019]s$/, "");
    return (
      proper.has(w.toLowerCase()) ||
      proper.has(bare) ||
      w.split("-").every((p) => proper.has(p.toLowerCase()))
    );
  };
  // The first word is capitalised in BOTH styles, so it carries no information and is excluded.
  const content = tokens.slice(1).filter((w) => !fn.has(w.toLowerCase()));
  if (content.length < rule.minContentWords) return [];
  const capitalised = content.filter(
    (w) => w[0] === w[0]?.toUpperCase() && w[0] !== w[0]?.toLowerCase(),
  );
  // An all-caps token is an acronym, not a style choice.
  const styled = capitalised.filter((w) => w !== w.toUpperCase());
  const nonProper = styled.filter((w) => !isProper(w));
  if (capitalised.length / content.length < rule.minCapitalisedRatio) return [];
  if (nonProper.length < rule.minNonProperCapitals) return [];
  return [
    finding(
      ruleId,
      rule.defaultSeverity,
      context,
      { index: 0, matchedText: trimmed },
      "Use sentence case: capitalise the first word and proper nouns only.",
    ),
  ];
}
